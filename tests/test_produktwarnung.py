import email.utils
from datetime import datetime, timezone

from src.scrapers.produktwarnung import ProduktwarnungScraper

NOW = email.utils.format_datetime(datetime.now(timezone.utc))


def item(title, categories, description="Text."):
    cats = "".join(f"<category><![CDATA[{c}]]></category>" for c in categories)
    return (f"<item><title>{title}</title><link>https://www.produktwarnung.eu/x/{abs(hash(title))}</link>"
            f"<pubDate>{NOW}</pubDate>{cats}<description><![CDATA[{description}...]]></description></item>")


FEED = "<rss><channel>" + "".join([
    item("Rückruf: Kleinteile &#8211; TEDi ruft Holz Stapelspiele zurück", ["Spielzeug", "TEDi"],
         "<img src='x.jpg'/>TEDi informiert über den Rückruf der Stapelspiele aus Holz."),
    item("Rückruf: Metallteile &#8211; Netto ApS ruft Fintons Frischeiwaffeln zurück", ["Lebensmittel"]),
    item("Safety Gate-Meldung: Rückruf eines Treppenschutzgitters von ECD Germany", ["Babyausstattung"]),
    item("Rückruf: Einklemmrisiko &#8211; Kinderschaukel via Globus Baumarkt", ["Garten"]),
]) + "</channel></rss>"


def test_retailer_recalls_for_children_are_kept_and_marked():
    recalls = ProduktwarnungScraper().parse_data(FEED)
    assert [r.title for r in recalls] == ["Holz Stapelspiele", "Einklemmrisiko – Kinderschaukel via Globus Baumarkt"]
    r = recalls[0]
    assert r.company == "TEDi"
    assert r.reason == "Kleinteile. TEDi informiert über den Rückruf der Stapelspiele aus Holz"
    assert r.official is False
    assert r.source == "Produktwarnung.eu" and r.country_sold_in == "DE"
