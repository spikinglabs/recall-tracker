from datetime import datetime, timedelta, timezone
import html
import json
from typing import List
from bs4 import BeautifulSoup
from src.models import RecallInfo
from src.scrapers.base import BaseScraper
from src.scrapers.keywords import is_baby_related


def _text(value) -> str:
    """FDA fields hold HTML fragments and entities ('<a href=...>Babies&#039; Magic Tea</a>')."""
    if not value:
        return ""
    return html.unescape(BeautifulSoup(value, "html.parser").get_text()).strip()


class FDAScraper(BaseScraper):
    source_name = "FDA"
    country_code = "US"

    # The recalls page only renders the newest 10 rows; its table reads the full list from this JSON file.
    URL = "https://www.fda.gov/datatables-json/recalls-market-withdrawals.json"
    DAYS = 365

    def fetch_data(self) -> str:
        headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}
        response = self.client.get(self.URL, headers=headers)
        response.raise_for_status()
        return response.text

    def parse_data(self, raw_data: str) -> List[RecallInfo]:
        recalls = []
        since = datetime.now(timezone.utc) - timedelta(days=self.DAYS)
        for row in json.loads(raw_data):
            try:
                pub_date = datetime.strptime(row.get("field_change_date_2", "").strip(), "%m/%d/%Y").replace(tzinfo=timezone.utc)
            except ValueError:
                continue
            if pub_date < since:
                continue
            brand_name = _text(row.get("field_brand_name"))
            product_desc = _text(row.get("field_product_description"))
            product_type = _text(row.get("field_regulated_product_field"))
            reason = _text(row.get("field_recall_reason_description"))
            if not is_baby_related(f"{brand_name} {product_desc} {product_type} {reason}"):
                continue
            path = row.get("path") or ""
            url = "https://www.fda.gov" + path if path.startswith("/") else path
            recalls.append(RecallInfo(
                id=url or f"FDA-{pub_date:%Y-%m-%d}-{brand_name}",
                title=product_desc or brand_name or "FDA Recall",
                url=url,
                publish_datetime=pub_date,
                country_sold_in=self.country_code,
                location_sold_in=None,
                source=self.source_name,
                reason=reason or _text(row.get("field_recall_reason")) or None,
                company=_text(row.get("field_company_name")) or None,
                annotation=f"Brand: {brand_name}" if brand_name else None,
            ))
        return recalls
