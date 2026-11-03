"""Barcodes and model numbers of recalled products, so a parent can check a product in hand (or one for sale
second-hand) by typing or scanning its code.

Sources write them loosely: Safety Gate sometimes runs several barcodes together without a space
("80541178377928054117837808..."), model fields hold lists ("276, 276 KIT, 929"). Barcodes are kept only when
their check digit is right, so a run of digits splits into the real codes.
"""
import re
from typing import Iterable, List

_DIGITS = re.compile(r"\d{8,}")
_SPLIT = re.compile(r"\s*(?:[,;/|]|\band\b|\bund\b)\s*", re.IGNORECASE)
NOT_A_MODEL = {"", "-", "n/a", "na", "unknown", "none", "various", "all", "diverse", "unbekannt"}


def gtin_ok(code: str) -> bool:
    """EAN-8, UPC-A (12), EAN-13 or GTIN-14 with a correct check digit."""
    if len(code) not in (8, 12, 13, 14) or not code.isdigit():
        return False
    digits = [int(c) for c in code]
    total = sum(d * (3 if i % 2 == 0 else 1) for i, d in enumerate(reversed(digits[:-1])))
    return (10 - total % 10) % 10 == digits[-1]


def barcodes(text: str) -> List[str]:
    """The valid barcodes in a text. A run of digits counts only if it is one barcode or splits exactly into
    several (no digits left over), so a stray number never yields a code."""
    found = []
    for run in _DIGITS.findall(text or ""):
        found += _split(run) or []
    return found


def _split(run: str):
    if gtin_ok(run):
        return [run]
    for size in (13, 12, 8, 14):
        head = run[:size]
        if len(run) > size and gtin_ok(head):
            rest = _split(run[size:])
            if rest:
                return [head, *rest]
    return None


def models(text: str) -> List[str]:
    """Model or article numbers from a model field: "276, 276 KIT, 929" -> ["276", "276 KIT", "929"]."""
    out = []
    for part in _SPLIT.split(text or ""):
        part = part.strip(" .:()[]\"'")
        # Plain words ("Blue Fish", "Top Color Nail System") are names, not numbers.
        if part.lower() in NOT_A_MODEL or len(re.findall(r"\d", part)) < 2 or len(part) > 40:
            continue
        out.append(part)
    return out


def unique(codes: Iterable[str]) -> List[str]:
    seen, out = set(), []
    for c in codes:
        key = c.upper()
        if c and key not in seen:
            seen.add(key)
            out.append(c)
    return out


_LABELLED = re.compile(r"\b(?:EAN|GTIN|UPC|Barcode|Strichcode)[^0-9]{0,25}((?:\d[\d ]{6,}\d[,;/ ]*)+)", re.IGNORECASE)


def labelled_barcodes(text: str) -> List[str]:
    """Barcodes that a free text names as such ("EAN: 4 006040 123456", "UPC 0 12345 67890 5")."""
    return [b for m in _LABELLED.finditer(text or "") for part in re.split(r"[,;/]", m.group(1)) for b in barcodes(part.replace(" ", ""))]
