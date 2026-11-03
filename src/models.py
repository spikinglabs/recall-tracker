from pydantic import BaseModel, Field, computed_field
from datetime import datetime, timezone
from typing import Optional, List, Dict, Union

class RecallInfo(BaseModel):
    id: str  # Unique identifier for the recall
    title: str
    url: str
    publish_datetime: datetime
    country_sold_in: str  # e.g., "DE", "US"
    location_sold_in: Optional[List[str]] = None  # e.g. states or cities
    source: str  # e.g., "Lebensmittelwarnung", "FDA"
    # False for recalls from a non-official source (retailers' recalls collected by a news site); None means official.
    official: Optional[bool] = None
    # For a non-official recall: which official recalls Claude compared it with, and whether they were the same.
    checked_with: Optional[Dict[str, bool]] = None
    reason: Optional[Union[str, Dict[str, str]]] = None
    company: Optional[str] = None
    annotation: Optional[Union[str, Dict[str, str]]] = None
    # Filled in by the classification step (src/classify.py); None when it hasn't run for this recall.
    title_i18n: Optional[Dict[str, str]] = None  # the title in each site language; `title` stays the original
    category: Optional[str] = None  # food, feeding, toys, sleep, travel, clothing, furniture, health, other
    for_children: Optional[bool] = None
    rules: Optional[int] = None  # version of the for_children rules that gave the verdict (classify.RULES)
    # When the tracker first and last found this recall at its source (the archive keeps it after that).
    first_seen: Optional[datetime] = None
    last_seen: Optional[datetime] = None
    scraped_datetime: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    # Other reports of the same product (another source, or another shop), folded in by src/duplicates.py.
    also: Optional[List["RecallInfo"]] = None

    @computed_field
    def publish_date(self) -> str:
        """String representation of publish_datetime (YYYY-MM-DD) useful for partitioning"""
        return self.publish_datetime.strftime("%Y-%m-%d")



RecallInfo.model_rebuild()
