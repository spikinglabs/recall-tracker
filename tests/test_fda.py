import json
from datetime import datetime, timedelta, timezone
from src.scrapers.fda import FDAScraper

TODAY = datetime.now(timezone.utc).strftime("%m/%d/%Y")
OLD = (datetime.now(timezone.utc) - timedelta(days=800)).strftime("%m/%d/%Y")


def row(date, brand, desc, reason, company, path):
    return {
        "path": path,
        "field_change_date_2": date,
        "field_brand_name": f'<a href="{path}">{brand}</a>',
        "field_product_description": desc,
        "field_recall_reason_description": reason,
        "field_recall_reason": "Other",
        "field_company_name": company,
        "field_regulated_product_field": "Food &amp; Beverages",
    }


MOCK_JSON = json.dumps([
    row(TODAY, "Babies&#039; Magic Tea", "Babies&#039; Magic Tea brand Baby Sleep Gripe Water 4 oz bottle", "Undeclared ethanol", "Pacific Health Sciences", "/safety/recalls/gripe-water"),
    row(TODAY, "BeanCo", "Canned kidney beans", "Undeclared allergen", "Bean Corp", "/safety/recalls/kidney-beans"),
    row(OLD, "SafeBaby", "Infant Formula", "Potential contamination", "SafeBaby Inc.", "/safety/recalls/old-formula"),
])


def test_fda_scraper_parse_and_filter():
    recalls = FDAScraper().parse_data(MOCK_JSON)

    # Only the recent baby recall: "kidney" is not "kid", and old recalls are left out
    assert len(recalls) == 1
    recall = recalls[0]
    assert recall.id == "https://www.fda.gov/safety/recalls/gripe-water"
    assert recall.url == recall.id
    assert recall.title == "Babies' Magic Tea brand Baby Sleep Gripe Water 4 oz bottle"
    assert recall.annotation == "Brand: Babies' Magic Tea"
    assert recall.country_sold_in == "US"
    assert recall.source == "FDA"
    assert recall.reason == "Undeclared ethanol"
    assert recall.company == "Pacific Health Sciences"
