from datetime import datetime, timezone

from src import history
from src.models import RecallInfo


class Quiet:
    """Stands in for a scraper with nothing to add."""
    def __init__(self, *a, **k): self.DAYS = 0
    def reports(self): return []
    def fetch_data(self, *a): return "[]"
    def parse_data(self, *a): return []
    def scrape_all(self): return []


def test_history_keeps_old_recalls_and_folds_the_current_list(monkeypatch):
    for name in ("SafetyGateScraper", "CPSCScraper", "UKScraper"):
        monkeypatch.setattr(history, name, Quiet)
    now = datetime(2026, 11, 3, tzinfo=timezone.utc)
    old = {"id": "sg-2019", "title": "Kinderwagen X (A-1)", "company": "Brand", "codes": ["4006381333931"], "date": "2019-05-01",
           "source": "EU Safety Gate", "country": "EU", "url": "https://x/sg-2019"}
    too_old = dict(old, id="sg-2010", date="2010-01-01")
    current = [RecallInfo(id="cpsc-1", title="Acme Crib", url="https://x/c", country_sold_in="US", source="CPSC",
                          publish_datetime=datetime(2026, 10, 1, tzinfo=timezone.utc), title_i18n={"en": "Acme Crib"})]
    out = history.build({"recalls": [old, too_old], "reports_done": ["Report-2019-1"]}, current, now)
    ids = [r["id"] for r in out["recalls"]]
    assert ids == ["cpsc-1", "sg-2019"]
    assert out["recalls"][1]["codes"] == ["4006381333931"]
    assert out["recalls"][0]["en"] == "Acme Crib"
    assert out["reports_done"] == ["Report-2019-1"]
