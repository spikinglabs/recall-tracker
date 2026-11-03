# recall-tracker
Collects recalls of baby and children's products every day (US CPSC, US FDA, Lebensmittelwarnung.de, EU Safety Gate, UK OPSS, and retailer recalls via Produktwarnung.eu, marked as not official) into one public
JSON file on Cloudflare R2, and shows them at https://recalls.allo.land/ (formerly tracker.babybaras.com, which
redirects there). Allo Auri reads the same file.

## Files published each day

At `https://recalls-api.allo.land/baby/scraped_date=latest/` (the R2 bucket `recall-tracker-data` in the Cloudflare
account that holds allo.land, on its custom domain; dated copies under `scraped_date=YYYY-MM-DD/`). Until every reader
has moved, the job also writes the old bucket behind `pub-f36c3831e82845e4af2d54940ea6c32d.r2.dev`. Browsers can read them from the origins in the bucket's CORS
policy.


- `processed.json`: the recalls. Recalls stay listed for 2 years after publication, also after they leave their source
  (`first_seen` / `last_seen` say when the tracker found them).
- `excluded.json`: recalls Claude judged to be adult products (fuel cans, adult medicines and so on), for review.
- `status.json`: when the list was made and which sources answered.

## Classification and translation

With the repository secret `ANTHROPIC_API_KEY` set, each new recall is sent once to Claude Haiku
(`src/classify.py`). It decides whether the product is for children, gives it a category, and translates its title
and reason into the site's languages. Results are published with the recall and reused, so each recall costs one
call. Without the secret, every recall is kept and the reasons are translated with Google's free endpoint, as before.

## Pages for search engines

`npm run build` in `web/` also runs `scripts/prerender.mjs`. It reads the published data and writes a page for
each language (`/`, `/de/`, `/es/`, `/fr/`, `/zh/`) and for each recall in each language (`/de/r/7KQ3MX/`), with
the title, description, link-preview tags and schema.org data, plus `sitemap.xml` and `robots.txt`. The site
is deployed again after every scrape, so the pages follow the data.

## Run locally

    uv sync
    PYTHONPATH=. uv run pytest -q
    PYTHONPATH=. uv run python -u src/main.py

## Duplicates

The same product often comes from more than one source (a UK report and an EU Safety Gate alert, a German notice
and the German alert in Safety Gate), and the UK writes one report per marketplace. After classification,
`src/duplicates.py` folds these into one recall: it compares the English titles (and company names), keeps the
report from the most specific source, and puts the others in its `also` list. The site links them as
"Also reported by", and a code from a folded report still opens the recall.

Retailer recalls come from Produktwarnung.eu, a private news site, and are the only source that isn't an
authority. They carry `official: false`, and the site labels them "Retailer recall" / "Retailer notice
(unofficial)". Because their titles are worded freely, a retailer recall that the title rules don't match is
compared by Claude with close official recalls (same country, within 45 days, a word in common); the answer is
kept in `checked_with`, so each pair is asked once. An official report always heads its group.
