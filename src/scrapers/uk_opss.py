from datetime import datetime, timedelta, timezone
import json
import re
from typing import List

from src.models import RecallInfo
from src.scrapers.base import BaseScraper
from src.scrapers.keywords import is_baby_related


class UKScraper(BaseScraper):
    """UK Office for Product Safety and Standards: product recalls, safety reports and alerts, from GOV.UK's
    search API. Toys and childcare reports are all kept; other categories when the title names babies or children.
    One unsafe product sold on several marketplaces gets one report per marketplace; the duplicate step
    (src/duplicates.py) folds those into one recall."""
    source_name = "UK OPSS"
    country_code = "GB"

    URL = "https://www.gov.uk/api/search.json"
    DAYS = 365
    CHILD_CATEGORIES = {"toys", "childcare-articles-childrens-equipment"}
    PREFIX = re.compile(r"^\s*Product (Recall|Safety Report|Safety Alert)\s*:\s*", re.IGNORECASE)

    def fetch_data(self, start: int = 0) -> str:
        response = self.client.get(self.URL, params={
            "filter_format": "product_safety_alert_report_recall",
            "order": "-public_timestamp",
            "count": 1000,
            "start": start,
            "fields": "title,link,public_timestamp,description,product_category",
        })
        response.raise_for_status()
        return response.text

    def scrape_all(self) -> List[RecallInfo]:
        """Every page of the list (a few thousand reports since 2018), for the history."""
        recalls, start = [], 0
        while True:
            page = self.fetch_data(start)
            recalls += self.parse_data(page)
            total = json.loads(page).get("total", 0)
            start += 1000
            if start >= total:
                return recalls

    def parse_data(self, raw_data: str) -> List[RecallInfo]:
        since = datetime.now(timezone.utc) - timedelta(days=self.DAYS)
        recalls = []
        for item in json.loads(raw_data).get("results", []):
            title = self.PREFIX.sub("", item.get("title") or "").strip()
            date = datetime.fromisoformat((item.get("public_timestamp") or "").replace("Z", "+00:00"))
            if date < since or not title:
                continue
            if item.get("product_category") not in self.CHILD_CATEGORIES and not is_baby_related(title):
                continue
            url = "https://www.gov.uk" + item.get("link", "")
            description = (item.get("description") or "").strip()
            # "Product Recall for X presenting a serious risk of choking." -> "Serious risk of choking."
            hazard = re.search(r"presenting an? (.+)", description, re.IGNORECASE)
            recalls.append(RecallInfo(
                id=url,
                title=title,
                url=url,
                publish_datetime=date,
                country_sold_in=self.country_code,
                location_sold_in=None,
                source=self.source_name,
                reason=(hazard.group(1)[0].upper() + hazard.group(1)[1:]).strip() if hazard else description or None,
                company=None,
                annotation=None,
            ))
        return recalls
