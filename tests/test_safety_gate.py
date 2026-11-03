from pathlib import Path

from src.scrapers.safety_gate import SafetyGateScraper

WEEK = (Path(__file__).parent / "data" / "safety_gate_week.xml").read_text(encoding="utf-8")


def test_safety_gate_keeps_child_products_only():
    recalls = SafetyGateScraper().parse_data(WEEK)
    titles = [r.title for r in recalls]
    # Two childcare and two toy alerts are kept; the nail polish isn't for children.
    assert len(recalls) == 4
    assert not any("Gel" in t for t in titles)
    r = next(r for r in recalls if "Teething" in r.title)
    assert r.title.startswith("Vicloon Baby Teething Glove")
    assert r.url == r.id == "https://ec.europa.eu/safety-gate-alerts/screen/webReport/alertDetail/10119200"
    assert r.company == "Vicloon"
    assert r.country_sold_in == "EU"
    assert r.location_sold_in == ["GB"]
    assert r.publish_date == "2026-10-30"
    assert r.reason.startswith("Asphyxiation, Choking.")
    assert r.source == "EU Safety Gate"
