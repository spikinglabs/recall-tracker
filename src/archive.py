"""Keeps recalls listed after they leave their source.

Lebensmittelwarnung.de's feed only holds its latest items, and the FDA and CPSC lists cover the last 365 days, so
each day's scrape alone forgets older recalls. Each run merges today's recalls into the previously published list and
keeps the older ones for KEEP_DAYS after they were published.
"""
from datetime import datetime, timedelta
from typing import Iterable, List

from src.models import RecallInfo

KEEP_DAYS = 730


def merge(today: List[RecallInfo], previous: Iterable[dict], now: datetime, keep_days: int = KEEP_DAYS) -> List[RecallInfo]:
    earlier = {}
    for item in previous:
        if isinstance(item, dict) and item.get("id"):
            earlier[item["id"]] = item
    merged = {}
    for r in today:
        before = earlier.get(r.id) or {}
        seen = before.get("first_seen") or before.get("scraped_datetime")
        r.first_seen = datetime.fromisoformat(seen.replace("Z", "+00:00")) if isinstance(seen, str) else now
        r.last_seen = now
        # Answers from the duplicate check for retailer recalls (src/duplicates.py), so each pair is asked once.
        r.checked_with = r.checked_with or before.get("checked_with")
        merged[r.id] = r
    cutoff = now - timedelta(days=keep_days)
    kept = 0
    for id_, item in earlier.items():
        if id_ in merged:
            continue
        try:
            old = RecallInfo(**{k: v for k, v in item.items() if k != "publish_date"})
        except Exception as e:
            print(f"Dropping unreadable archived recall {id_}: {e!r}", flush=True)
            continue
        if old.publish_datetime < cutoff:
            continue
        old.first_seen = old.first_seen or old.scraped_datetime
        old.last_seen = old.last_seen or old.scraped_datetime
        merged[id_] = old
        kept += 1
    print(f"Archive: {len(today)} recalls found today, {kept} kept from earlier days.", flush=True)
    return list(merged.values())
