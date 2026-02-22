import pytest
from src.scrapers.germany import GermanyScraper
from src.models import RecallInfo

MOCK_XML = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<rss version="2.0">
<channel>
<item>
<title>Spielfiguren "Stretcherz Slammerz"</title>
<link>https://www.lebensmittelwarnung.de/example.html</link>
<pubDate>Fri, 20 Feb 2026 10:20:00 +0100</pubDate>
<description><![CDATA[<img src="..." width="100" /><br/><b>Bildquelle</b> © Woolworth GmbH<br/><b>Verpackungseinheit:</b> ein Stück<br/><b>Grund der Meldung:</b>   Gesundheitsschädliche Substanz<br/><b>Hersteller / Inverkehrbringer:</b> HTI<br/><b>Betroffene Bundesländer nach derzeitigem Stand:</b>   Baden-Württemberg, Bayern, Berlin<br/>]]></description>
<guid>https://www.lebensmittelwarnung.de/example.html</guid>
</item>
</channel>
</rss>
"""

def test_germany_scraper_parse():
    scraper = GermanyScraper()
    recalls = scraper.parse_data(MOCK_XML)
    
    assert len(recalls) == 1
    recall = recalls[0]
    
    assert recall.id == "https://www.lebensmittelwarnung.de/example.html"
    assert recall.title == 'Spielfiguren "Stretcherz Slammerz"'
    assert recall.url == "https://www.lebensmittelwarnung.de/example.html"
    assert recall.country_sold_in == "DE"
    assert recall.source == "Lebensmittelwarnung.de"
    assert recall.reason == "Gesundheitsschädliche Substanz"
    assert recall.company == "HTI"
    assert set(recall.location_sold_in) == {"Baden-Württemberg", "Bayern", "Berlin"}
