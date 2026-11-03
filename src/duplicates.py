"""Folds reports of the same product into one recall.

The same unsafe product turns up more than once: the UK writes one report per marketplace ("... sold via Amazon",
"... sold via eBay"), a German toy recall on Lebensmittelwarnung.de is also a German alert on the EU Safety Gate,
and the Safety Gate often repeats a UK report. This step runs after all sources are collected and classified, so
it can compare the English titles Claude wrote for each one.

The recall kept is the one from the most specific source (Lebensmittelwarnung.de names the German states; the EU
alert covers Europe), then the earliest. The others go into its `also` list whole, so their links can be shown
with it, their codes still find it, and the next run reloads them from there.
"""
import re
from datetime import timedelta
from typing import Dict, List, Set

from src.models import RecallInfo

# Most specific first.
SOURCE_ORDER = ["Lebensmittelwarnung.de", "EU Safety Gate", "UK OPSS", "CPSC", "FDA"]
WINDOW = timedelta(days=180)

# Words that say what kind of report or product it is, not which product.
GENERIC = set("""
a an and the of for with in on by to from via sold product products recall recalled report safety alert
baby babies infant child children childrens kid kids toddler toy toys set pack piece pieces pcs item items
model models version type colour color colours colors various assorted different new style mini large small
amazon ebay wish etsy aliexpress alibaba temu shein fruugo onbuy joom vinted
""".split())

_SOLD = re.compile(r"\b(sold|available)\s+(via|by|on|at)\b.*$", re.IGNORECASE)
_PREFIX = re.compile(r"^\s*(product\s+(recall|safety\s+report|safety\s+alert)|rückruf|warnung)\s*:\s*", re.IGNORECASE)
_BRACKETS = re.compile(r"\([^)]*\)|\[[^\]]*\]")


def english_title(recall: RecallInfo) -> str:
    return (recall.title_i18n or {}).get("en") or recall.title or ""


def tokens(text: str) -> Set[str]:
    text = _BRACKETS.sub(" ", _SOLD.sub("", _PREFIX.sub("", text)))
    words = re.findall(r"[a-z0-9äöüß]+", text.lower().replace("'", ""))
    return {w.rstrip("s") if len(w) > 4 else w for w in words if len(w) > 2 and w not in GENERIC}


def company_key(recall: RecallInfo) -> str:
    name = re.split(r"\s{2,}|\n|,|Produktbezeichnung", recall.company or "")[0]
    words = [w for w in re.findall(r"[a-z0-9]+", name.lower()) if w not in {"gmbh", "ltd", "limited", "inc", "co", "kg", "ag", "llc", "bv", "srl", "sa"}]
    return " ".join(words)


def same_product(a: RecallInfo, b: RecallInfo, ta: Set[str], tb: Set[str]) -> bool:
    if abs(a.publish_datetime - b.publish_datetime) > WINDOW:
        return False
    if not ta or not tb:
        return False
    shared = len(ta & tb)
    overlap = shared / min(len(ta), len(tb))  # one title is often the other plus a model or shop
    jaccard = shared / len(ta | tb)
    ca, cb = company_key(a), company_key(b)
    short = min(len(ta), len(tb)) < 3  # "High Chairs", "Balloons", "Sand-filled toy": a kind of product, not one product
    if a.source == b.source and a.source != "UK OPSS":
        # Within one source, separate alerts are separate products (models, batches), unless the title is the same.
        return ta == tb and ca == cb and (not short or bool(ca))
    if ca and cb and ca == cb:
        return shared >= 1 and overlap >= 0.5
    if short:
        return ta == tb and a.source != b.source
    return overlap >= 0.8 and jaccard >= 0.6


def barcodes_of(recall: RecallInfo) -> Set[str]:
    return {c.lstrip("0") for c in recall.codes or [] if c.isdigit() and len(c) >= 8}


def same_barcode(a: RecallInfo, b: RecallInfo) -> bool:
    """One barcode is one product, whatever the titles say."""
    return abs(a.publish_datetime - b.publish_datetime) <= WINDOW and bool(barcodes_of(a) & barcodes_of(b))


def rank(recall: RecallInfo):
    order = SOURCE_ORDER.index(recall.source) if recall.source in SOURCE_ORDER else len(SOURCE_ORDER)
    return (order, recall.publish_datetime, recall.id)


def fold(recalls: List[RecallInfo]) -> List[RecallInfo]:
    """Returns one recall per product, each with the others in `also` (sorted by date)."""
    flat: Dict[str, RecallInfo] = {}
    for r in recalls:
        # Duplicates folded on an earlier run come back inside `also`; compare them afresh.
        for inner in [r, *(RecallInfo.model_validate(x) if isinstance(x, dict) else x for x in (r.also or []))]:
            inner.also = None
            flat.setdefault(inner.id, inner)
    items = sorted(flat.values(), key=rank)
    toks = {r.id: tokens(english_title(r)) for r in items}

    # Union-find over matching pairs.
    parent = {r.id: r.id for r in items}

    def root(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    # Only recalls that share a word, a company or a barcode can match; an index of those keeps this fast on the
    # ten-year history (thousands of recalls). Words in very many titles say nothing and are left out.
    index: Dict[str, List[int]] = {}
    for i, r in enumerate(items):
        keys = {f"w:{w}" for w in toks[r.id]} | {f"b:{b}" for b in barcodes_of(r)}
        for k in keys:
            index.setdefault(k, []).append(i)
    pairs = set()
    for k, members in index.items():
        if len(members) > 300 and not k.startswith("b:"):
            continue
        for x, i in enumerate(members):
            for j in members[x + 1:]:
                pairs.add((i, j))
    for i, j in sorted(pairs):
        a, b = items[i], items[j]
        if root(a.id) != root(b.id) and (same_barcode(a, b) or same_product(a, b, toks[a.id], toks[b.id])):
            parent[root(b.id)] = root(a.id)

    groups: Dict[str, List[RecallInfo]] = {}
    for r in items:
        groups.setdefault(root(r.id), []).append(r)
    out = []
    for members in groups.values():
        members.sort(key=rank)
        head, rest = members[0], members[1:]
        head.also = sorted(rest, key=lambda r: r.publish_datetime) or None
        out.append(head)
    return out
