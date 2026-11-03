from datetime import datetime, timezone

from src.classify import Category, Classifier, Texts, Verdict, describe
from src.models import RecallInfo


def recall(id_, title, reason="Poisoning hazard"):
    return RecallInfo(id=id_, title=title, url="", publish_datetime=datetime(2026, 10, 1, tzinfo=timezone.utc),
                      country_sold_in="US", source="CPSC", reason=reason, company="Acme")


def texts(s):
    return Texts(en=s, de=f"de {s}", es=f"es {s}", fr=f"fr {s}", zh_CN=f"zh {s}")


def fake(text):
    adult = "Fuel" in text
    return Verdict(for_children=not adult, category=Category.other if adult else Category.toys,
                   title=texts(text.split("Title: ")[1].split("\n")[0]), reason=texts("reason"))


def test_classifies_new_recalls_and_reuses_earlier_verdicts():
    asked = []
    c = Classifier(ask=lambda t: asked.append(t) or fake(t))
    items = [recall("a", "Fuel Containers"), recall("b", "Stacking Blocks"), recall("c", "Crib")]
    earlier = {"c": {"category": "sleep", "for_children": True, "title_i18n": {"de": "Kinderbett"}, "reason": {"en": "x", "de": "y"}}}
    c.run(items, earlier)
    a, b, cc = items
    assert len(asked) == 2 and "Company: Acme" in asked[0]
    assert a.for_children is False and a.category == "other"
    assert b.for_children is True and b.category == "toys"
    assert b.title == "Stacking Blocks" and b.title_i18n["zh-CN"] == "zh Stacking Blocks"
    assert b.reason["de"] == "de reason"
    assert cc.category == "sleep" and cc.title_i18n == {"de": "Kinderbett"}
    assert c.stats == {"reused": 1, "classified": 2, "failed": 0, "skipped": 0}


def test_failed_calls_leave_the_recall_unchecked_and_kept():
    def boom(_):
        raise RuntimeError("overloaded")
    c = Classifier(ask=boom)
    item = recall("a", "Teether")
    c.run([item], {})
    assert item.for_children is None and item.category is None
    assert c.stats["failed"] == 1


def test_stops_at_the_limit():
    c = Classifier(ask=fake, limit=1)
    items = [recall("a", "Blocks"), recall("b", "Doll")]
    c.run(items, {})
    assert c.stats == {"reused": 0, "classified": 1, "failed": 0, "skipped": 1}


def test_describe_reads_translated_reasons():
    r = recall("a", "Doll", reason={"en": "Choking", "de": "Erstickung"})
    assert "Reason: Choking" in describe(r)


def test_exclusions_under_older_rules_are_checked_again():
    asked = []
    c = Classifier(ask=lambda t: asked.append(t) or fake(t))
    gate = recall("gate", "Safety Gates")
    gate.category, gate.for_children = "other", False  # excluded by the first rules, no `rules` recorded
    kept = recall("kept", "Blocks")
    kept.category, kept.for_children = "toys", True
    fuel = recall("fuel", "Fuel Cans")
    earlier = {"fuel": {"category": "other", "for_children": False, "rules": 2, "title_i18n": {"en": "Fuel Cans"}}}
    c.run([gate, kept, fuel], earlier)
    assert len(asked) == 1 and "Safety Gates" in asked[0]
    assert gate.for_children is True and gate.rules == 2
    assert fuel.for_children is False
    assert c.stats["reused"] == 2
