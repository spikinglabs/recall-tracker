from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List

class RecallInfo(BaseModel):
    id: str  # Unique identifier for the recall
    title: str
    url: str
    publish_date: datetime
    country_sold_in: str  # e.g., "DE", "US"
    location_sold_in: Optional[List[str]] = None  # e.g. states or cities
    source: str  # e.g., "Lebensmittelwarnung", "FDA"
    reason: Optional[str] = None
    company: Optional[str] = None
    annotation: Optional[str] = None
