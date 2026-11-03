from datetime import datetime, timezone

from src.duplicates import fold
from src.models import RecallInfo


def recall(id, title, source, day, company=None, en=None):
    return RecallInfo(id=id, title=title, url=id, publish_datetime=datetime(2026, 10, day, tzinfo=timezone.utc),
                      country_sold_in="EU", source=source, company=company, title_i18n={"en": en} if en else None)


def test_same_product_from_several_sources_and_shops_becomes_one():
    out = fold([
        recall("uk1", "Unicorn Pink Busy Board sold via Amazon (2609-0044)", "UK OPSS", 1),
        recall("uk2", "Unicorn Pink Busy Board sold via eBay (2609-0045)", "UK OPSS", 2),
        recall("sg1", "Unicorn Pink Busy Board (A-001)", "EU Safety Gate", 20),
        recall("de1", "Spielfiguren Stretcherz", "Lebensmittelwarnung.de", 3, "HTI", en="Stretcherz toy figures"),
        recall("sg2", "Stretcherz figures", "EU Safety Gate", 10, "HTI"),
    ])
    by_id = {r.id: r for r in out}
    assert set(by_id) == {"sg1", "de1"}  # the EU alert and the German notice are kept, being more specific
    assert [a.id for a in by_id["sg1"].also] == ["uk1", "uk2"]
    assert [a.id for a in by_id["de1"].also] == ["sg2"]


def test_kinds_of_product_and_other_models_stay_apart():
    out = fold([
        recall("a", "High Chairs", "CPSC", 1),
        recall("b", "Simpa Baby High Chair", "UK OPSS", 2),
        recall("c", "Balloons", "EU Safety Gate", 3),
        recall("d", "Balloons", "EU Safety Gate", 4),
        recall("e", "Blue Starfish Shaped Baby Sleeping Bag sold via Joom", "UK OPSS", 5),
        recall("f", "Shark Tail Baby Sleeping Bag sold via Wish", "UK OPSS", 6),
    ])
    assert len(out) == 6 and not any(r.also for r in out)


def test_folded_reports_are_compared_again_next_run():
    first = fold([recall("sg1", "Earthsound Plush Bear", "EU Safety Gate", 2), recall("uk1", "Earthsound Plush Bear (2510-0212)", "UK OPSS", 1)])
    again = fold([RecallInfo.model_validate(r.model_dump(mode="json")) for r in first])
    assert len(again) == 1 and again[0].id == "sg1" and [a.id for a in again[0].also] == ["uk1"]
