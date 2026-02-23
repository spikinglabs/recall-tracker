import email.utils
from typing import List
from bs4 import BeautifulSoup
from src.models import RecallInfo
from src.scrapers.base import BaseScraper

class GermanyScraper(BaseScraper):
    source_name = "Lebensmittelwarnung.de"
    country_code = "DE"
    
    URL = "https://www.lebensmittelwarnung.de/___LMW-Redaktion/RSSNewsfeed/Functions/RssFeeds/rssnewsfeed_Alle_DE.xml?nn=314268&type=babyundkinderprodukte"

    def fetch_data(self) -> str:
        response = self.client.get(self.URL)
        response.raise_for_status()
        return response.text

    def parse_data(self, raw_data: str) -> List[RecallInfo]:
        recalls = []
        soup = BeautifulSoup(raw_data, "xml")
        items = soup.find_all("item")
        
        for item in items:
            title = item.find("title").text if item.find("title") else ""
            link = item.find("link").text if item.find("link") else ""
            guid = item.find("guid").text if item.find("guid") else link
            pubDate_str = item.find("pubDate").text if item.find("pubDate") else ""
            pubDate = email.utils.parsedate_to_datetime(pubDate_str) if pubDate_str else None
            
            description_html = item.find("description").text if item.find("description") else ""
            desc_soup = BeautifulSoup(description_html, "html.parser")
            
            reason = None
            company = None
            locations = None
            
            # Extract info from the HTML description using bold tags
            b_tags = desc_soup.find_all("b")
            for b in b_tags:
                label = b.text.strip()
                # Text following the bold tag
                parent_text = b.parent.text if b.parent else ""
                
                # We can also get next sibling
                next_sibling = b.next_sibling
                value = ""
                if isinstance(next_sibling, str):
                    value = next_sibling.strip().strip(":")
                
                if "Grund der Meldung" in label:
                    reason = value.strip()
                elif "Hersteller / Inverkehrbringer" in label:
                    reason_split = parent_text.split("Hersteller / Inverkehrbringer:", 1)
                    if len(reason_split) > 1:
                        company_text = reason_split[1].split("Betroffene Bundesländer", 1)[0]
                        company = company_text.strip()
                elif "Betroffene Bundesländer" in label:
                    loc_split = parent_text.split("Betroffene Bundesländer nach derzeitigem Stand:", 1)
                    if len(loc_split) > 1:
                        locs = loc_split[1].strip()
                        if locs:
                            locations = [loc.strip() for loc in locs.split(",")]

            recall = RecallInfo(
                id=guid,
                title=title,
                url=link,
                publish_datetime=pubDate,
                country_sold_in=self.country_code,
                location_sold_in=locations,
                source=self.source_name,
                reason=reason,
                company=company,
                annotation=None
            )
            recalls.append(recall)
            
        return recalls
