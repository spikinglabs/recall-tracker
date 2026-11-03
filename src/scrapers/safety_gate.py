from datetime import datetime, timezone
from typing import List
import xml.etree.ElementTree as ET

from src.models import RecallInfo
from src.scrapers.base import BaseScraper
from src.scrapers.keywords import is_baby_related


# The reporting countries, as ISO codes, so the site can name them in each language.
COUNTRIES = {
    "Austria": "AT", "Belgium": "BE", "Bulgaria": "BG", "Croatia": "HR", "Cyprus": "CY", "Czechia": "CZ",
    "Denmark": "DK", "Estonia": "EE", "Finland": "FI", "France": "FR", "Germany": "DE", "Greece": "GR",
    "Hungary": "HU", "Iceland": "IS", "Ireland": "IE", "Italy": "IT", "Latvia": "LV", "Liechtenstein": "LI",
    "Lithuania": "LT", "Luxembourg": "LU", "Malta": "MT", "Netherlands": "NL", "Norway": "NO", "Poland": "PL",
    "Portugal": "PT", "Romania": "RO", "Slovakia": "SK", "Slovenia": "SI", "Spain": "ES", "Sweden": "SE",
    "United Kingdom in respect of Northern Ireland": "GB",
    "The Netherlands": "NL", "Czech Republic": "CZ", "Slovak Republic": "SK",
}


class SafetyGateScraper(BaseScraper):
    """EU Safety Gate (formerly RAPEX): dangerous non-food products found by the market surveillance authorities of
    the EU countries (Germany's BAuA among them), Norway, Iceland, Liechtenstein and Northern Ireland.

    The Commission publishes one report a week, every Friday, as XML. Toys and childcare alerts are all kept; other
    categories (clothing, cosmetics, sports equipment, ...) only when the product itself names babies or children,
    because the hazard text of adult products often mentions children too.
    """
    source_name = "EU Safety Gate"
    country_code = "EU"

    LIST = "https://ec.europa.eu/safety-gate-alerts/api/download/weeklyReport/list/xml/{year}"
    WEEKS = 12  # about three months on each run; the archive keeps them after that
    CHILD_CATEGORIES = {"Toys", "Childcare articles and children's equipment"}

    def fetch_data(self) -> List[str]:
        reports = []
        year = datetime.now(timezone.utc).year
        for y in (year, year - 1):
            response = self.client.get(self.LIST.format(year=y))
            response.raise_for_status()
            reports += [r.findtext("URL") for r in ET.fromstring(response.content).iter("weeklyReport")]
            if len(reports) >= self.WEEKS:
                break
        pages = []
        for url in [u for u in reports if u][: self.WEEKS]:
            # The listed address asks for the report's year as its language; English is wanted.
            url = url.replace(f"language={url.split('language=')[1].split('&')[0]}", "language=en")
            response = self.client.get(url, timeout=90.0)
            response.raise_for_status()
            pages.append(response.text)
        return pages

    @staticmethod
    def short_reason(risk: str, danger: str, limit: int = 320) -> str | None:
        """The risk types, then the danger text cut after a sentence: some alerts list every measured substance.
        Claude shortens it further when it translates."""
        reason = " ".join(x for x in [f"{risk}." if risk else "", danger] if x)
        if len(reason) <= limit:
            return reason or None
        cut = reason[:limit]
        end = cut.rfind(". ")
        return cut[: end + 1] if end > 40 else cut.rsplit(" ", 1)[0] + "…"

    def scrape(self) -> List[RecallInfo]:
        recalls = {}
        for page in self.fetch_data():
            for r in self.parse_data(page):
                recalls.setdefault(r.id, r)
        return list(recalls.values())

    def parse_data(self, raw_data: str) -> List[RecallInfo]:
        root = ET.fromstring(raw_data.encode("utf-8") if isinstance(raw_data, str) else raw_data)
        day = datetime.strptime(root.findtext("report_date") or "", "%d/%m/%Y").replace(tzinfo=timezone.utc)
        recalls = []
        for item in root.findall("notifications"):
            text = lambda key: (item.findtext(key) or "").strip()
            if text("type") and text("type") != "Consumer":
                continue
            product, name, brand = text("product"), text("name"), text("brand")
            if text("category") not in self.CHILD_CATEGORIES and not is_baby_related(" ".join([product, name, text("description")])):
                continue
            link = text("reference")
            title = name or product
            if brand and brand.lower() not in title.lower():
                title = f"{brand} {title}"
            model = text("type_numberOfModel")
            recalls.append(RecallInfo(
                id=link or f"SafetyGate-{text('caseNumber')}",
                title=f"{title} ({model})" if model and model.lower() not in title.lower() else title,
                url=link,
                publish_datetime=day,
                country_sold_in=self.country_code,
                # The country whose authority reported it; the product may be sold anywhere in Europe.
                location_sold_in=[COUNTRIES.get(text("notifyingCountry"), text("notifyingCountry"))] if text("notifyingCountry") else None,
                source=self.source_name,
                reason=self.short_reason(text("riskType"), text("danger")),
                company=brand or None,
                annotation=None,
            ))
        return recalls
