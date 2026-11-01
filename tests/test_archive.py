from datetime import datetime, timedelta, timezone

from src.archive import merge
from src.models import RecallInfo

NOW = datetime(2026, 11, 1, tzinfo=timezone.utc)


def recall(id_, days_ago, **kw):
    return RecallInfo(id=id_, title=id_, url="", publish_datetime=NOW - timedelta(days=days_ago),
                      country_sold_in="DE", source="Test", **kw)


def published(r, **kw):
    return {**r.model_dump(mode="json"), **kw}


def test_keeps_recalls_that_left_the_source_and_dates_them():
    old = published(recall("gone", 100), first_seen="2026-07-25T00:00:00Z", last_seen="2026-08-01T00:00:00Z")
    again = published(recall("again", 5), first_seen="2026-10-27T00:00:00Z", category="toys", for_children=True)
    expired = published(recall("expired", 800))
    out = {r.id: r for r in merge([recall("again", 5), recall("new", 0)], [old, again, expired], NOW)}
    assert set(out) == {"gone", "again", "new"}
    assert out["gone"].last_seen == datetime(2026, 8, 1, tzinfo=timezone.utc)
    assert out["again"].first_seen == datetime(2026, 10, 27, tzinfo=timezone.utc)
    assert out["again"].last_seen == NOW
    assert out["new"].first_seen == NOW


def test_files_from_before_the_archive_still_load():
    item = published(recall("plain", 10))
    for key in ("title_i18n", "category", "for_children", "first_seen", "last_seen"):
        item.pop(key)
    out = merge([], [item], NOW)
    assert out[0].first_seen == out[0].scraped_datetime
