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

    # FDA's bot detection redirects requests from GitHub's runners to an "abuse detection" page.
    # openFDA is FDA's API for programs; its enforcement reports cover the same recalls, about a week later.
    OPENFDA_URL = "https://api.fda.gov/{category}/enforcement.json"
    OPENFDA_CATEGORIES = ("food", "drug", "device")
    OPENFDA_PAGE = 1000

    def scrape(self) -> List[RecallInfo]:
        try:
            return super().scrape()
        except Exception as e:
            print(f"FDA recalls list unavailable ({e!r}); using openFDA enforcement reports.")
            return self.parse_openfda(self.fetch_openfda())

    def fetch_data(self) -> str:
        headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}
        response = self.client.get(self.URL, headers=headers)
        response.raise_for_status()
        return response.text

    def fetch_openfda(self) -> List[dict]:
        today = datetime.now(timezone.utc)
        since = today - timedelta(days=self.DAYS)
        search = f"report_date:[{since:%Y%m%d} TO {today:%Y%m%d}]"
        results = []
        for category in self.OPENFDA_CATEGORIES:
            skip = 0
            while True:
                response = self.client.get(
                    self.OPENFDA_URL.format(category=category),
                    params={"search": search, "limit": self.OPENFDA_PAGE, "skip": skip},
                )
                if response.status_code == 404:  # openFDA's answer when nothing matches
                    break
                response.raise_for_status()
                body = response.json()
                results.extend(body.get("results", []))
                skip += self.OPENFDA_PAGE
                if skip >= body["meta"]["results"]["total"]:
                    break
        return results

    def parse_openfda(self, rows: List[dict]) -> List[RecallInfo]:
        recalls = []
        for row in rows:
            try:
                pub_date = datetime.strptime(row.get("report_date", ""), "%Y%m%d").replace(tzinfo=timezone.utc)
            except ValueError:
                continue
            product_desc = (row.get("product_description") or "").strip()
            reason = (row.get("reason_for_recall") or "").strip()
            if not is_baby_related(f"{product_desc} {reason}"):
                continue
            recall_number = row.get("recall_number") or f"{pub_date:%Y-%m-%d}-{product_desc[:40]}"
            event_id = row.get("event_id")
            recalls.append(RecallInfo(
                id=f"FDA-{recall_number}",
                title=product_desc or "FDA Recall",
                url=f"https://www.accessdata.fda.gov/scripts/ires/index.cfm?Event={event_id}" if event_id else "",
                publish_datetime=pub_date,
                country_sold_in=self.country_code,
                location_sold_in=None,
                source=self.source_name,
                reason=reason or None,
                company=(row.get("recalling_firm") or "").strip() or None,
                annotation=None,  # the description already names the product and brand
            ))
        return recalls

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
