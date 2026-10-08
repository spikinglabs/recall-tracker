import json
from src.scrapers.cpsc import CPSCScraper

MOCK = json.dumps([
    {"RecallNumber": "27003", "RecallDate": "2026-10-01T00:00:00", "URL": "https://www.cpsc.gov/Recalls/2027/crib",
     "Title": "Acme Recalls Cribs Due to Entrapment Hazard", "Description": "This recall involves wooden cribs.",
     "Products": [{"Name": "Acme Wooden Cribs", "Type": "Cribs"}], "Hazards": [{"Name": "Entrapment hazard"}],
     "Manufacturers": [{"Name": "Acme Inc."}]},
    {"RecallNumber": "27004", "RecallDate": "2026-10-02T00:00:00", "URL": "https://www.cpsc.gov/Recalls/2027/ladder",
     "Title": "Ladders Recalled Due to Fall Hazard", "Description": "Aluminium ladders.",
     "Products": [{"Name": "Step Ladders", "Type": "Ladders"}], "Hazards": [{"Name": "Fall hazard"}]},
])


def test_cpsc_parse_and_filter():
    recalls = CPSCScraper().parse_data(MOCK)
    assert len(recalls) == 1
    r = recalls[0]
    assert r.title == "Acme Wooden Cribs"
    assert r.url == "https://www.cpsc.gov/Recalls/2027/crib"
    assert r.reason == "Entrapment hazard"
    assert r.company == "Acme Inc."
    assert r.country_sold_in == "US"
    assert r.publish_date == "2026-10-01"
