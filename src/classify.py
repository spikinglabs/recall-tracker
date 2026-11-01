"""Checks each new recall once with Claude: is it a product for babies or children, which kind of product, and
what its title and reason say in the site's languages.

The keyword filter in the scrapers lets through adult products whose warnings mention children (fuel cans,
paint thinner, medicines in packaging that isn't child-resistant). Claude sorts those out, and translates in the
same call, because Google's free endpoint refuses most requests from GitHub's runners.

Every result is published with the recall, and the next run reuses it, so each recall is sent once.
Without ANTHROPIC_API_KEY the run skips this step and keeps every recall, as before.
"""
import os
import time
from enum import Enum
from typing import Callable, Dict, Iterable, List, Optional

from pydantic import BaseModel, Field

from src.models import RecallInfo

MODEL = "claude-haiku-5-5"


class Category(str, Enum):
    food = "food"  # formula, baby food, snacks, drinks
    feeding = "feeding"  # bottles, pacifiers, teethers, tableware
    toys = "toys"
    sleep = "sleep"  # cribs, bassinets, mattresses, sleep sacks
    travel = "travel"  # car seats, strollers, carriers
    clothing = "clothing"  # clothes, shoes, costumes, helmets
    furniture = "furniture"  # high chairs, changing tables, step stools, gates
    health = "health"  # medicines, vitamins, skin care, diapers, wipes
    other = "other"


class Texts(BaseModel):
    en: str
    de: str
    es: str
    fr: str
    zh_CN: str = Field(description="Simplified Chinese")

    def as_dict(self) -> Dict[str, str]:
        return {"en": self.en, "de": self.de, "es": self.es, "fr": self.fr, "zh-CN": self.zh_CN}


class Verdict(BaseModel):
    for_children: bool = Field(description="True if babies or children use, eat or play with the product itself")
    category: Category
    title: Texts
    reason: Optional[Texts] = Field(default=None, description="Null when the recall gives no reason")


SYSTEM = """You sort product recalls for a website that warns parents about recalls of baby and children's products.

For each recall, decide:
- for_children: true if the product is made for babies or children, or a child uses, eats, wears or plays with it
  directly (toys, children's clothing, formula, baby food, cribs, car seats, children's medicine, sweets sold to
  kids). False if it is an adult or household product and children only appear in the hazard, for example fuel
  cans, paint thinner, adult medicines or cosmetics recalled for packaging that is not child-resistant, or
  hospital equipment. When unsure, answer true.
- category: the kind of product.
- title: the product name, translated. Keep brand names, model numbers and sizes as they are. Keep it short.
- reason: the recall reason in one or two plain sentences, translated. Null if the recall gives no reason.

Write each translation as a native speaker would. zh_CN is Simplified Chinese."""


def describe(recall: RecallInfo) -> str:
    reason = recall.reason if isinstance(recall.reason, str) else (recall.reason or {}).get("en") or next(iter((recall.reason or {}).values()), "")
    note = recall.annotation if isinstance(recall.annotation, str) else (recall.annotation or {}).get("en") or ""
    return "\n".join(
        f"{label}: {value}"
        for label, value in [
            ("Source", recall.source), ("Country", recall.country_sold_in), ("Title", recall.title),
            ("Company", recall.company), ("Reason", reason), ("Note", note),
        ]
        if value
    )


def classified(recall: RecallInfo) -> bool:
    return recall.category is not None and recall.for_children is not None


def apply(recall: RecallInfo, verdict: Verdict) -> None:
    recall.for_children = verdict.for_children
    recall.category = verdict.category.value
    recall.title_i18n = verdict.title.as_dict()
    if verdict.reason is not None:
        recall.reason = verdict.reason.as_dict()


def copy_from(recall: RecallInfo, earlier: dict) -> bool:
    """Takes the verdict published for this recall on an earlier day. False if there was none."""
    if earlier.get("category") is None or earlier.get("for_children") is None:
        return False
    recall.for_children = earlier["for_children"]
    recall.category = earlier["category"]
    recall.title_i18n = earlier.get("title_i18n")
    if isinstance(earlier.get("reason"), dict):
        recall.reason = earlier["reason"]
    return True


class Classifier:
    def __init__(self, ask: Optional[Callable[[str], Verdict]] = None, budget_s: float = 20 * 60, limit: int = 600):
        self.ask = ask or self._ask_claude
        self.deadline = time.monotonic() + budget_s
        self.limit = limit
        self.stats = {"reused": 0, "classified": 0, "failed": 0, "skipped": 0}
        self._client = None

    @staticmethod
    def available() -> bool:
        return bool(os.environ.get("ANTHROPIC_API_KEY"))

    def _ask_claude(self, text: str) -> Verdict:
        if self._client is None:
            import anthropic
            self._client = anthropic.Anthropic(max_retries=4, timeout=60)
        response = self._client.messages.parse(
            model=MODEL,
            max_tokens=2000,
            output_config={"effort": "low"},
            system=SYSTEM,
            messages=[{"role": "user", "content": text}],
            output_format=Verdict,
        )
        if response.parsed_output is None:
            raise ValueError(f"no verdict (stop reason: {response.stop_reason})")
        return response.parsed_output

    def run(self, recalls: Iterable[RecallInfo], earlier: Dict[str, dict]) -> None:
        """Gives each recall a verdict, reusing earlier ones. A recall that can't be checked today stays unchecked
        (and is kept), so tomorrow's run tries it again."""
        todo: List[RecallInfo] = []
        for r in recalls:
            if classified(r) or (r.id in earlier and copy_from(r, earlier[r.id])):
                self.stats["reused"] += 1
            else:
                todo.append(r)
        print(f"Classifying {len(todo)} new recalls with {MODEL} ({self.stats['reused']} reused)...", flush=True)
        for r in todo:
            if self.stats["classified"] + self.stats["failed"] >= self.limit or time.monotonic() > self.deadline:
                self.stats["skipped"] += 1
                continue
            try:
                apply(r, self.ask(describe(r)))
                self.stats["classified"] += 1
            except Exception as e:
                print(f"Could not classify {r.id}: {e!r}", flush=True)
                self.stats["failed"] += 1
