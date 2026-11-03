from datetime import datetime, timedelta, timezone
import email.utils
import html
import re
import time
from typing import List
import xml.etree.ElementTree as ET

from src.models import RecallInfo
from src.scrapers.base import BaseScraper

CHILD_CATEGORIES = {"Spielzeug", "Baby & Kind", "Babyausstattung", "Babynahrung", "Kinderschuhe", "Kindersitze"}
CHILD_WORDS = re.compile(
    r"kind|baby|babies|säugling|kleinkind|spielzeug|schnuller|beißring|kinderwagen|buggy|babyschale|"
    r"hochstuhl|laufstall|wickel|windel|strampler|schlafsack|stillkissen|milchpumpe|fläschchen|trinklern|beikost",
    re.IGNORECASE,
)
# "Rückruf: Kleinteile – TEDi ruft Holz Stapelspiele zurück"
TITLE = re.compile(r"^(?:UPDATE\s+)?Rückruf(?:\s+Update)?\s*:\s*(?:(?P<hazard>[^–-]{2,60}?)\s+[–-]\s+)?(?P<who>.+?)\s+ruft\s+(?P<what>.+?)\s+zurück\s*$", re.IGNORECASE)


class ProduktwarnungScraper(BaseScraper):
    """Recalls by retailers and manufacturers in Germany (dm, Rossmann, Lidl, TEDi, Zeeman, ...), collected by
    Produktwarnung.eu, a private news site. Not an official source: every recall from it is marked
    `official: False`, and the site says so on the card. Official reports of the same product take its place
    in the duplicate step.

    Its RSS feed holds ten posts a page; the scraper reads back DAYS days. Posts that only repeat a Safety Gate
    alert are skipped (that source is read directly)."""
    source_name = "Produktwarnung.eu"
    country_code = "DE"

    URL = "https://www.produktwarnung.eu/feed"
    DAYS = 120
    MAX_PAGES = 30

    def fetch_data(self) -> List[str]:
        since = datetime.now(timezone.utc) - timedelta(days=self.DAYS)
        pages = []
        for page in range(1, self.MAX_PAGES + 1):
            response = self.client.get(self.URL, params={"paged": page} if page > 1 else None,
                                        headers={"User-Agent": "AlloRecalls/1.0 (+https://recalls.allo.land)"})
            if response.status_code == 404:
                break
            response.raise_for_status()
            pages.append(response.text)
            dates = [email.utils.parsedate_to_datetime(d.text) for d in ET.fromstring(response.content).iter("pubDate")]
            if not dates or min(dates) < since:
                break
            time.sleep(1)  # a small site: one page a second
        return pages

    def scrape(self) -> List[RecallInfo]:
        recalls = {}
        for page in self.fetch_data():
            for r in self.parse_data(page):
                recalls.setdefault(r.id, r)
        return list(recalls.values())

    def parse_data(self, raw_data: str) -> List[RecallInfo]:
        since = datetime.now(timezone.utc) - timedelta(days=self.DAYS)
        recalls = []
        for item in ET.fromstring(raw_data.encode("utf-8") if isinstance(raw_data, str) else raw_data).iter("item"):
            title = html.unescape(item.findtext("title") or "").strip()
            link = (item.findtext("link") or "").strip()
            date = email.utils.parsedate_to_datetime(item.findtext("pubDate") or "")
            categories = [c.text or "" for c in item.findall("category")]
            if date < since or not title.lower().startswith(("rückruf", "update rückruf")):
                continue  # "Safety Gate-Meldung", warnings and blog posts
            if not (CHILD_CATEGORIES & set(categories) or CHILD_WORDS.search(title)):
                continue
            text = re.sub(r"<[^>]+>", " ", html.unescape(item.findtext("description") or ""))
            text = re.sub(r"\s+", " ", text).replace("...", "").strip(" .")
            m = TITLE.match(title)
            recalls.append(RecallInfo(
                id=link,
                title=m.group("what").strip() if m else re.sub(r"^(UPDATE\s+)?Rückruf(\s+Update)?\s*:\s*", "", title, flags=re.IGNORECASE),
                url=link,
                publish_datetime=date,
                country_sold_in=self.country_code,
                location_sold_in=None,
                source=self.source_name,
                reason=". ".join(x for x in [m.group("hazard") if m and m.group("hazard") else "", text[:320]] if x) or None,
                company=m.group("who").strip() if m else None,
                annotation=None,
                official=False,
            ))
        return recalls
