import json
from datetime import datetime, timezone

from src.scrapers.uk_opss import UKScraper

NOW = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
MOCK = json.dumps({"results": [
    {"title": "Product Recall: Lorelli Silicone Rattle Teether (2606-0257)", "link": "/product-safety-alerts-reports-recalls/lorelli",
     "public_timestamp": NOW, "description": "Product Recall for Lorelli Silicone Rattle Teether presenting a serious risk of choking. ",
     "product_category": "childcare-articles-childrens-equipment"},
    {"title": "Product Safety Report: Toddler Ghost Costume sold via Amazon (2609-0106)", "link": "/x/ghost",
     "public_timestamp": NOW, "description": "Product Safety Report for Toddler Ghost Costume presenting a serious risk of burns.",
     "product_category": "clothing-textiles-fashion"},
    {"title": "Product Recall: Ambiano Hair Dryer (2610-0001)", "link": "/x/dryer", "public_timestamp": NOW,
     "description": "Product Recall for a hair dryer presenting a serious risk of electric shock.", "product_category": "electrical-appliances-equipment"},
]})


def test_uk_keeps_child_products():
    recalls = UKScraper().parse_data(MOCK)
    assert [r.title for r in recalls] == ["Lorelli Silicone Rattle Teether (2606-0257)", "Toddler Ghost Costume sold via Amazon (2609-0106)"]
    r = recalls[0]
    assert r.url == r.id == "https://www.gov.uk/product-safety-alerts-reports-recalls/lorelli"
    assert r.reason == "Serious risk of choking."
    assert r.country_sold_in == "GB" and r.source == "UK OPSS"
