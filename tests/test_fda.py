import pytest
from datetime import datetime
from src.scrapers.fda import FDAScraper
from src.models import RecallInfo

MOCK_HTML = """
<html>
<body>
    <table>
        <thead>
            <tr>
                <th>Date</th>
                <th>Brand Name(s)</th>
                <th>Product Description</th>
                <th>Product Type</th>
                <th>Recall Reason Description</th>
                <th>Company Name</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td>02/20/2026</td>
                <td><a href="/safety/recalls/fake-baby-formula">SafeBaby</a></td>
                <td>Infant Formula</td>
                <td>Food & Beverages</td>
                <td>Potential contamination</td>
                <td>SafeBaby Inc.</td>
            </tr>
            <tr>
                <td>02/19/2026</td>
                <td><a href="/safety/recalls/fake-adult-snack">AdultSnack</a></td>
                <td>Spicy Chips</td>
                <td>Food & Beverages</td>
                <td>Undeclared allergen</td>
                <td>Snack Corp</td>
            </tr>
        </tbody>
    </table>
</body>
</html>
"""

def test_fda_scraper_parse_and_filter():
    scraper = FDAScraper()
    recalls = scraper.parse_data(MOCK_HTML)
    
    # Should only return the baby related recall
    assert len(recalls) == 1
    recall = recalls[0]
    
    assert recall.id == "https://www.fda.gov/safety/recalls/fake-baby-formula"
    assert recall.title == "SafeBaby"
    assert recall.url == "https://www.fda.gov/safety/recalls/fake-baby-formula"
    assert recall.country_sold_in == "US"
    assert recall.source == "FDA"
    assert recall.reason == "Potential contamination"
    assert recall.company == "SafeBaby Inc."
    assert "Infant Formula" in recall.annotation
    assert recall.publish_date.year == 2026
    assert recall.publish_date.month == 2
    assert recall.publish_date.day == 20
