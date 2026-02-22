from abc import ABC, abstractmethod
from typing import List
import httpx
from src.models import RecallInfo

class BaseScraper(ABC):
    source_name: str
    country_code: str

    def __init__(self):
        self.client = httpx.Client(timeout=30.0)

    @abstractmethod
    def fetch_data(self) -> str:
        """Fetch raw data from the source returning the content as string"""
        pass

    @abstractmethod
    def parse_data(self, raw_data: str) -> List[RecallInfo]:
        """Parse raw data into a list of RecallInfo objects"""
        pass

    def scrape(self) -> List[RecallInfo]:
        """Execute the full scrape job"""
        raw_data = self.fetch_data()
        return self.parse_data(raw_data)
