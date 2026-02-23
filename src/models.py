from pydantic import BaseModel, Field, computed_field
from datetime import datetime, timezone
from typing import Optional, List, Dict

class RecallInfo(BaseModel):
    id: str  # Unique identifier for the recall
    title: str
    url: str
    publish_datetime: datetime
    country_sold_in: str  # e.g., "DE", "US"
    location_sold_in: Optional[List[str]] = None  # e.g. states or cities
    source: str  # e.g., "Lebensmittelwarnung", "FDA"
    reason: Optional[Dict[str, str]] = None
    company: Optional[str] = None
    annotation: Optional[Dict[str, str]] = None
    scraped_datetime: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    @computed_field
    def publish_date(self) -> str:
        """String representation of publish_datetime (YYYY-MM-DD) useful for partitioning"""
        return self.publish_datetime.strftime("%Y-%m-%d")

