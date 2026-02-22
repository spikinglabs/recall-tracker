from datetime import datetime
from typing import List
from bs4 import BeautifulSoup
from src.models import RecallInfo
from src.scrapers.base import BaseScraper

class FDAScraper(BaseScraper):
    source_name = "FDA"
    country_code = "US"
    
    URL = "https://www.fda.gov/safety/recalls-market-withdrawals-safety-alerts"
    
    # Keywords to identify baby/kid related recalls
    KEYWORDS = ["baby", "infant", "toddler", "kid", "child", "children", "formula"]

    def fetch_data(self) -> str:
        # Pass a user-agent to avoid simple scraping blocks
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
        }
        response = self.client.get(self.URL, headers=headers)
        response.raise_for_status()
        return response.text

    def is_baby_related(self, text: str) -> bool:
        if not text:
            return False
        text_lower = text.lower()
        return any(keyword in text_lower for keyword in self.KEYWORDS)

    def parse_data(self, raw_data: str) -> List[RecallInfo]:
        recalls = []
        soup = BeautifulSoup(raw_data, "html.parser")
        table = soup.find("table")
        if not table:
            return recalls

        tbody = table.find("tbody")
        rows = tbody.find_all("tr") if tbody else table.find_all("tr")[1:] # skip header if no tbody

        for row in rows:
            cells = row.find_all(["td", "th"])
            if len(cells) < 6:
                continue
            
            date_str = cells[0].text.strip()
            brand_name = cells[1].text.strip()
            product_desc = cells[2].text.strip()
            product_type = cells[3].text.strip()
            reason = cells[4].text.strip()
            company = cells[5].text.strip()
            
            # Combine fields to check keywords
            full_text = f"{brand_name} {product_desc} {product_type} {reason}"
            if not self.is_baby_related(full_text):
                continue
                
            # Parse Date
            try:
                from datetime import timezone
                pub_date = datetime.strptime(date_str, "%m/%d/%Y").replace(tzinfo=timezone.utc)
            except ValueError:
                from datetime import timezone
                pub_date = datetime.now(timezone.utc)
            
            # Extract URL (usually found in an <a> tag in the row)
            a_tag = row.find("a", href=True)
            url = ""
            if a_tag:
                url = a_tag["href"]
                if url.startswith("/"):
                    url = "https://www.fda.gov" + url

            title = brand_name if brand_name else "FDA Recall"
            # Id can just be the URL
            recall_id = url if url else f"FDA-{date_str}-{brand_name}"
            
            recall = RecallInfo(
                id=recall_id,
                title=title,
                url=url,
                publish_date=pub_date,
                country_sold_in=self.country_code,
                location_sold_in=None,  # FDA table doesn't easily show locations
                source=self.source_name,
                reason=reason,
                company=company,
                annotation=f"Product Description: {product_desc}"
            )
            recalls.append(recall)
            
        return recalls
