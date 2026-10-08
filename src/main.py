import json
import os
import sys
from datetime import datetime
from src.scrapers.germany import GermanyScraper
from src.scrapers.fda import FDAScraper
from src.scrapers.cpsc import CPSCScraper
from src.translate import Translator, known_translations, load_previous

def main():
    print("Starting recall data collection...")
    scrapers = [
        GermanyScraper(),
        FDAScraper(),
        CPSCScraper(),
    ]

    all_recalls = []
    failed = []

    for scraper_cls in scrapers:
        print(f"Running scraper for {scraper_cls.source_name}...")
        try:
            recalls = scraper_cls.scrape()
            all_recalls.extend(recalls)
            print(f"Found {len(recalls)} recalls from {scraper_cls.source_name}")
        except Exception as e:
            print(f"Error scraping {scraper_cls.source_name}: {e!r}")
            failed.append(f"{scraper_cls.source_name}: {e!r}")

    if not all_recalls:
        # Never publish an empty list over the last good one.
        print("No recalls collected from any source; not writing output.")
        sys.exit(1)

    # Process and sort by publish date
    from datetime import timezone
    all_recalls.sort(key=lambda x: x.publish_datetime if x.publish_datetime else datetime.min.replace(tzinfo=timezone.utc), reverse=True)
    
    translator = Translator()
    done = translator.translate_all((t for r in all_recalls for t in (r.reason, r.annotation)), known_translations(load_previous()))
    for recall in all_recalls:
        recall.reason = translator.lookup(done, recall.reason)
        recall.annotation = translator.lookup(done, recall.annotation)
    print("Translations:", translator.stats, flush=True)

    from collections import Counter
    print("Recalls per source:", dict(Counter(r.source for r in all_recalls)))

    # Ensure output directory exists
    os.makedirs("data", exist_ok=True)
    
    # Export to JSON
    output_path = "data/processed.json"
    with open(output_path, "w", encoding="utf-8") as f:
        # Avoid datetime serialization errors by using model_dump_json (Pydantic V2)
        # We manually dump a list of dictionaries via json.dump after formatting datetimes
        json.dump([recall.model_dump(mode="json") for recall in all_recalls], f, indent=2, ensure_ascii=False)
        
    print(f"Successfully exported {len(all_recalls)} records to {output_path}")

    # The workflow uploads what was collected, then fails on this file so a broken source gets noticed.
    with open("data/errors.txt", "w", encoding="utf-8") as f:
        f.write("\n".join(failed))

if __name__ == "__main__":
    main()
