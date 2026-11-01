# recall-tracker
Collects recalls of baby and children's products every day (US CPSC, US FDA, Lebensmittelwarnung.de) into one public
JSON file on Cloudflare R2, and shows them at https://tracker.babybaras.com/. Allo Auri reads the same file.

## Files published each day (`baby/scraped_date=latest/` on R2)

- `processed.json`: the recalls. Recalls stay listed for 2 years after publication, also after they leave their source
  (`first_seen` / `last_seen` say when the tracker found them).
- `excluded.json`: recalls Claude judged to be adult products (fuel cans, adult medicines and so on), for review.
- `status.json`: when the list was made and which sources answered.

## Classification and translation

With the repository secret `ANTHROPIC_API_KEY` set, each new recall is sent once to Claude Haiku
(`src/classify.py`). It decides whether the product is for children, gives it a category, and translates its title
and reason into the site's languages. Results are published with the recall and reused, so each recall costs one
call. Without the secret, every recall is kept and the reasons are translated with Google's free endpoint, as before.

## Run locally

    uv sync
    PYTHONPATH=. uv run pytest -q
    PYTHONPATH=. uv run python -u src/main.py
