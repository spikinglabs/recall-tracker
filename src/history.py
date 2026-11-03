"""The ten-year history of children's product recalls, for checking a product before buying it second-hand.

A used stroller or car seat can be years old, so the check can't rely on the main list (two years, translated
and checked by Claude). This file goes back YEARS years and holds just what a check needs: title, brand, barcodes
and model numbers, date, source and link. Old recalls stay in their original language (no Claude), so the
history costs nothing to keep; searching by brand, model or barcode doesn't need a translation.

Sources: the EU Safety Gate's weekly reports back to YEARS ago (fetched a batch at a time, then only new ones),
CPSC by year, the UK's whole list, and everything in the main list (with its English titles). Duplicates are
folded as in the main list.

Runs after src/main.py:  PYTHONPATH=. python src/history.py   ->  data/history.json
"""
import json
import os
import time
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional

import httpx

from src.duplicates import fold
from src.models import RecallInfo
from src.scrapers.cpsc import CPSCScraper
from src.scrapers.safety_gate import SafetyGateScraper
from src.scrapers.uk_opss import UKScraper
from src.translate import LATEST

YEARS = 10
BUDGET_S = int(os.environ.get("HISTORY_BUDGET_S", 12 * 60))  # for old Safety Gate reports; the rest follows next run


def compact(r: RecallInfo) -> dict:
    """A recall as the history keeps it."""
    out = {
        "id": r.id,
        "title": r.title,
        "en": (r.title_i18n or {}).get("en"),
        "company": r.company,
        "codes": r.codes,
        "date": r.publish_date,
        "source": r.source,
        "country": r.country_sold_in,
        "url": r.url,
        "category": r.category,
    }
    if r.also:
        out["also"] = [compact(a) for a in r.also]
    return {k: v for k, v in out.items() if v not in (None, [], "")}


def expand(d: dict) -> RecallInfo:
    return RecallInfo(
        id=d["id"], title=d.get("title") or "", url=d.get("url") or d["id"],
        publish_datetime=datetime.fromisoformat(d["date"]).replace(tzinfo=timezone.utc),
        country_sold_in=d.get("country") or "", source=d.get("source") or "", company=d.get("company"),
        codes=d.get("codes"), category=d.get("category"), title_i18n={"en": d["en"]} if d.get("en") else None,
    )


def load_previous() -> Optional[dict]:
    for base in LATEST:
        try:
            response = httpx.get(base + "history.json", timeout=60)
            response.raise_for_status()
            data = response.json()
            if isinstance(data, dict) and isinstance(data.get("recalls"), list):
                return data
        except Exception as e:
            print(f"Could not load {base}history.json ({e!r}).", flush=True)
    return None


def build(previous: Optional[dict], current: List[RecallInfo], now: datetime) -> dict:
    previous = previous or {}
    since = now - timedelta(days=365 * YEARS)
    found: Dict[str, RecallInfo] = {}
    for d in previous.get("recalls", []):
        for x in [d, *d.get("also", [])]:
            r = expand(x)
            found[r.id] = r
    done_reports = set(previous.get("reports_done", []))
    done_years = set(previous.get("cpsc_years_done", []))

    # EU Safety Gate: every weekly report in the period, a batch at a time. The newest weeks are read again by
    # the main scrape, so a report counts as done once read here.
    sg = SafetyGateScraper()
    deadline = time.monotonic() + BUDGET_S
    try:
        todo = [(ref, url) for ref, url in sg.reports() if ref not in done_reports and _year(ref) >= since.year]
        print(f"Safety Gate: {len(todo)} weekly reports to read", flush=True)
        for ref, url in todo:
            if time.monotonic() > deadline:
                print("Safety Gate: time is up; the rest follows on the next run", flush=True)
                break
            try:
                for r in sg.parse_data(sg.report(url)):
                    found[r.id] = r
                done_reports.add(ref)
            except Exception as e:
                print(f"Safety Gate {ref}: {e!r}", flush=True)
    except Exception as e:
        print(f"Safety Gate list: {e!r}", flush=True)

    # CPSC, a year at a time; past years are done once read.
    cpsc = CPSCScraper()
    for year in range(since.year, now.year + 1):
        if str(year) in done_years:
            continue
        try:
            for r in cpsc.parse_data(cpsc.fetch_data(f"{year}-01-01", f"{year}-12-31")):
                found[r.id] = r
            if year < now.year:
                done_years.add(str(year))
        except Exception as e:
            print(f"CPSC {year}: {e!r}", flush=True)

    # The UK's whole list is a few pages.
    uk = UKScraper()
    uk.DAYS = 365 * YEARS
    try:
        for r in uk.scrape_all():
            found[r.id] = r
    except Exception as e:
        print(f"UK: {e!r}", flush=True)

    # The main list last: its recalls have English titles, categories and adult products taken out.
    for top in current:
        for r in [top, *(top.also or [])]:
            r = r.model_copy(update={"also": None})
            found[r.id] = r

    recalls = [r for r in found.values() if r.publish_datetime >= since]
    folded = fold(recalls)
    folded.sort(key=lambda r: r.publish_datetime, reverse=True)
    print(f"History: {len(recalls)} reports, {len(folded)} recalls since {since.date()}", flush=True)
    return {
        "updated": now.isoformat(),
        "since": since.date().isoformat(),
        "reports_done": sorted(done_reports),
        "cpsc_years_done": sorted(done_years),
        "recalls": [compact(r) for r in folded],
    }


def _year(ref: str) -> int:
    # "Report-2017-041"
    try:
        return int(ref.split("-")[1])
    except (IndexError, ValueError):
        return 0


def main():
    now = datetime.now(timezone.utc)
    with open("data/processed.json", encoding="utf-8") as f:
        current = [RecallInfo.model_validate({k: v for k, v in d.items() if k != "publish_date"}) for d in json.load(f)]
    excluded_ids = set()
    if os.path.exists("data/excluded.json"):
        with open("data/excluded.json", encoding="utf-8") as f:
            excluded_ids = {d["id"] for d in json.load(f)}
    history = build(load_previous(), current, now)
    # Recalls Claude judged to be adult products stay out of the history too.
    history["recalls"] = [r for r in history["recalls"] if r["id"] not in excluded_ids]
    with open("data/history.json", "w", encoding="utf-8") as f:
        json.dump(history, f, ensure_ascii=False, separators=(",", ":"))
    print(f"Wrote data/history.json ({os.path.getsize('data/history.json') // 1024} KB)", flush=True)


if __name__ == "__main__":
    main()
