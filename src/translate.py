"""Translates recall reasons and notes into the site's languages.

Google's free endpoint often refuses requests from GitHub's runners ("too many requests"), so:
- translations already published yesterday are reused (most recalls and reasons repeat day to day),
- the rest go out in a few batched requests, one text per line,
- once Google refuses, the run stops asking and keeps the original wording for the rest; tomorrow's run tries
  those again, because untranslated texts are not reused.
"""
import threading
import time
from typing import Dict, Iterable, List, Optional

import httpx
from deep_translator import GoogleTranslator

LANGS = ["en", "de", "es", "fr", "zh-CN"]
PREVIOUS_URL = "https://pub-f36c3831e82845e4af2d54940ea6c32d.r2.dev/baby/scraped_date%3Dlatest/processed.json"


def clean(text: str) -> str:
    return " ".join(text.split())[:4500]


def known_translations(previous: Iterable[dict]) -> Dict[str, Dict[str, str]]:
    """Maps each text in a previously published file to its translations, if it was really translated."""
    known = {}
    for item in previous:
        for field in ("reason", "annotation"):
            value = item.get(field) if isinstance(item, dict) else None
            if isinstance(value, dict) and len(set(value.values())) > 1:
                for text in value.values():
                    if isinstance(text, str) and text.strip():
                        known[clean(text)] = value
    return known


def load_previous(url: str = PREVIOUS_URL) -> List[dict]:
    try:
        response = httpx.get(url, timeout=30)
        response.raise_for_status()
        data = response.json()
        return data if isinstance(data, list) else []
    except Exception as e:
        print(f"Could not load the previous file ({e!r}); translating everything.", flush=True)
        return []


def batches(texts: List[str], limit: int = 4500) -> Iterable[List[str]]:
    batch, size = [], 0
    for t in texts:
        if batch and size + len(t) + 1 > limit:
            yield batch
            batch, size = [], 0
        batch.append(t)
        size += len(t) + 1
    if batch:
        yield batch


class Translator:
    def __init__(self, make=GoogleTranslator, pause: float = 0.5, timeout: float = 30, budget_s: float = 15 * 60, backoff: float = 5):
        self.engines = {lang: make(source="auto", target=lang) for lang in LANGS}
        self.pause, self.timeout, self.backoff = pause, timeout, backoff
        self.deadline = time.monotonic() + budget_s
        self.refused = False
        self.stats = {"reused": 0, "translated": 0, "untranslated": 0}

    def _call(self, text: str, lang: str) -> Optional[str]:
        # deep_translator sets no network timeout, so a stalled request would hang the run; give up on it instead.
        box = {}

        def run():
            try:
                box["out"] = self.engines[lang].translate(text)
            except Exception as e:
                box["err"] = e
        worker = threading.Thread(target=run, daemon=True)
        worker.start()
        worker.join(self.timeout)
        if worker.is_alive():
            raise TimeoutError(f"no answer within {self.timeout} s")
        if "err" in box:
            raise box["err"]
        return box.get("out")

    def _request(self, text: str, lang: str) -> Optional[str]:
        for attempt in range(3):
            if self.refused or time.monotonic() > self.deadline:
                return None
            try:
                time.sleep(self.pause)
                return self._call(text, lang)
            except Exception as e:
                if "too many requests" in str(e).lower() and attempt == 2:
                    print(f"Google refuses translations ({e}); keeping original wording for the rest.", flush=True)
                    self.refused = True
                elif attempt == 2:
                    print(f"Translation error to {lang}: {e}", flush=True)
                else:
                    time.sleep(self.backoff * (attempt + 1))
        return None

    def translate_all(self, texts: Iterable[str], known: Dict[str, Dict[str, str]]) -> Dict[str, Dict[str, str]]:
        texts = sorted({clean(t) for t in texts if isinstance(t, str) and t.strip()})
        done = {}
        todo = []
        for t in texts:
            if t in known:
                done[t] = known[t]
                self.stats["reused"] += 1
            else:
                todo.append(t)
        print(f"Translating {len(todo)} new texts ({len(done)} reused from the last file)...", flush=True)
        out = {t: {} for t in todo}
        for lang in LANGS:
            for batch in batches(todo):
                lines = (self._request("\n".join(batch), lang) or "").split("\n")
                if len(lines) != len(batch):
                    lines = [self._request(t, lang) for t in batch] if len(batch) > 1 and not self.refused else [None] * len(batch)
                for t, result in zip(batch, lines):
                    out[t][lang] = result.strip() if result and result.strip() else t
        for t, value in out.items():
            self.stats["translated" if len(set(value.values())) > 1 else "untranslated"] += 1
            done[t] = value
        return done

    def lookup(self, done: Dict[str, Dict[str, str]], text):
        if not text or isinstance(text, dict):
            return text or None
        return done.get(clean(text)) or {lang: text for lang in LANGS}
