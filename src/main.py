import json
import os
from datetime import datetime
from src.scrapers.germany import GermanyScraper
from src.scrapers.fda import FDAScraper

def main():
    print("Starting recall data collection...")
    scrapers = [
        GermanyScraper(),
        FDAScraper()
    ]

    all_recalls = []
    
    for scraper_cls in scrapers:
        print(f"Running scraper for {scraper_cls.source_name}...")
        try:
            recalls = scraper_cls.scrape()
            all_recalls.extend(recalls)
            print(f"Found {len(recalls)} recalls from {scraper_cls.source_name}")
        except Exception as e:
            print(f"Error scraping {scraper_cls.source_name}: {e}")

    # Process and sort by publish date
    from datetime import timezone
    all_recalls.sort(key=lambda x: x.publish_datetime if x.publish_datetime else datetime.min.replace(tzinfo=timezone.utc), reverse=True)
    
    # Ensure output directory exists
    os.makedirs("data", exist_ok=True)
    
    # Export to JSON
    output_path = "data/processed.json"
    with open(output_path, "w", encoding="utf-8") as f:
        # Avoid datetime serialization errors by using model_dump_json (Pydantic V2)
        # We manually dump a list of dictionaries via json.dump after formatting datetimes
        json.dump([recall.model_dump(mode="json") for recall in all_recalls], f, indent=2, ensure_ascii=False)
        
    print(f"Successfully exported {len(all_recalls)} records to {output_path}")

if __name__ == "__main__":
    main()
