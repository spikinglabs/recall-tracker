from datetime import datetime, timedelta, timezone
import json
from typing import List
from src.codes import barcodes, models, unique
from src.models import RecallInfo
from src.scrapers.base import BaseScraper
from src.scrapers.keywords import is_baby_related


class CPSCScraper(BaseScraper):
    """US Consumer Product Safety Commission recalls (toys, cribs, strollers, ...), via its public REST API."""
    source_name = "CPSC"
    country_code = "US"

    URL = "https://www.saferproducts.gov/RestWebServices/Recall"
    DAYS = 365

    def fetch_data(self, start=None, end=None) -> str:
        since = start or (datetime.now(timezone.utc) - timedelta(days=self.DAYS)).strftime("%Y-%m-%d")
        params = {"format": "json", "RecallDateStart": since}
        if end:
            params["RecallDateEnd"] = end
        response = self.client.get(self.URL, params=params, timeout=120.0)
        response.raise_for_status()
        return response.text

    def parse_data(self, raw_data: str) -> List[RecallInfo]:
        recalls = []
        for item in json.loads(raw_data):
            products = item.get("Products") or []
            names = ", ".join(p.get("Name", "") for p in products if p.get("Name"))
            text = " ".join([item.get("Title") or "", item.get("Description") or "", names, " ".join(p.get("Type") or "" for p in products)])
            if not is_baby_related(text):
                continue
            hazards = "; ".join(h.get("Name", "") for h in item.get("Hazards") or [] if h.get("Name"))
            companies = item.get("Manufacturers") or item.get("Importers") or item.get("Distributors") or []
            company = ", ".join(c.get("Name", "") for c in companies if c.get("Name")) or None
            date = datetime.fromisoformat(item["RecallDate"]).replace(tzinfo=timezone.utc)
            recalls.append(RecallInfo(
                id=item.get("URL") or f"CPSC-{item.get('RecallNumber')}",
                title=names or item.get("Title") or "CPSC recall",
                url=item.get("URL") or "",
                publish_datetime=date,
                country_sold_in=self.country_code,
                location_sold_in=None,
                source=self.source_name,
                reason=hazards or item.get("Title"),
                company=company,
                codes=unique(
                    [b for u in item.get("ProductUPCs") or [] for b in barcodes(str(u.get("UPC") if isinstance(u, dict) else u))]
                    + [m for p in products for m in models(p.get("Model") or "")]
                ) or None,
                annotation=None,  # the title repeats the product and hazard
            ))
        return recalls
