import json
import os
import sys
from collections import Counter
from datetime import datetime, timezone

from src.archive import merge
from src.classify import Classifier
from src.scrapers.cpsc import CPSCScraper
from src.scrapers.fda import FDAScraper
from src.scrapers.germany import GermanyScraper
from src.translate import Translator, known_translations, load_previous


def write_json(path, data):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


def main():
    print("Starting recall data collection...")
    now = datetime.now(timezone.utc)
    scrapers = [
        GermanyScraper(),
        FDAScraper(),
        CPSCScraper(),
    ]

    found = []
    failed = []
    sources = []

    for scraper in scrapers:
        print(f"Running scraper for {scraper.source_name}...")
        try:
            recalls = scraper.scrape()
            found.extend(recalls)
            sources.append({"name": scraper.source_name, "country": scraper.country_code, "ok": True, "found": len(recalls)})
            print(f"Found {len(recalls)} recalls from {scraper.source_name}")
        except Exception as e:
            print(f"Error scraping {scraper.source_name}: {e!r}")
            failed.append(f"{scraper.source_name}: {e!r}")
            sources.append({"name": scraper.source_name, "country": scraper.country_code, "ok": False, "found": 0, "error": repr(e)[:300]})

    if not found:
        # Never publish an empty list over the last good one.
        print("No recalls collected from any source; not writing output.")
        sys.exit(1)

    previous = load_previous()
    # Recalls Claude judged to be adult products, published separately for review; reloaded so their verdicts are reused.
    previous_excluded = load_previous("excluded.json")
    earlier = {item["id"]: item for item in previous + previous_excluded if isinstance(item, dict) and item.get("id")}

    all_recalls = merge(found, list(earlier.values()), now)

    if Classifier.available():
        classifier = Classifier()
        classifier.run(all_recalls, earlier)
        print("Classification:", classifier.stats, flush=True)
    else:
        print("ANTHROPIC_API_KEY is not set; keeping every recall and translating with Google.", flush=True)

    # Google is the fallback for texts Claude hasn't translated (no key, or a failed call).
    translator = Translator()
    pending = [r for r in all_recalls if r.title_i18n is None]
    done = translator.translate_all((t for r in pending for t in (r.reason, r.annotation)), known_translations(previous))
    for recall in all_recalls:
        recall.reason = translator.lookup(done, recall.reason)
        recall.annotation = translator.lookup(done, recall.annotation)
    print("Translations:", translator.stats, flush=True)

    all_recalls.sort(key=lambda x: x.publish_datetime, reverse=True)
    kept = [r for r in all_recalls if r.for_children is not False]
    excluded = [r for r in all_recalls if r.for_children is False]
    print("Recalls per source:", dict(Counter(r.source for r in kept)))
    print(f"Excluded as adult products: {len(excluded)}")
    for r in excluded:
        if r.id not in earlier or earlier[r.id].get("for_children") is not False:
            print(f"  newly excluded: {r.source} {r.publish_date} {r.title[:80]}")

    os.makedirs("data", exist_ok=True)
    write_json("data/processed.json", [r.model_dump(mode="json") for r in kept])
    write_json("data/excluded.json", [r.model_dump(mode="json") for r in excluded])
    # For the site: when the list was made and which sources answered today.
    write_json("data/status.json", {
        "updated": now.isoformat(),
        "recalls": len(kept),
        "found_today": len(found),
        "excluded": len(excluded),
        "sources": sources,
    })
    print(f"Successfully exported {len(kept)} records to data/processed.json")

    # The workflow uploads what was collected, then fails on this file so a broken source gets noticed.
    with open("data/errors.txt", "w", encoding="utf-8") as f:
        f.write("\n".join(failed))


if __name__ == "__main__":
    main()
