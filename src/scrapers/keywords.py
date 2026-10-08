import re

# Words that mark a recall as a baby or children's product. Matched as whole words, so "kid" does not match "kidney".
KEYWORDS = [
    "baby", "babies", "infant", "infants", "newborn", "toddler", "toddlers",
    "child", "children", "childrens", "kid", "kids", "nursery", "crib", "cribs",
    "bassinet", "bassinets", "stroller", "strollers", "pacifier", "pacifiers",
    "teether", "teethers", "teething", "high chair", "highchair", "car seat",
    "baby formula", "infant formula", "toy", "toys", "diaper", "diapers",
]
_PATTERN = re.compile(r"\b(" + "|".join(re.escape(k) for k in KEYWORDS) + r")\b", re.IGNORECASE)


# "Not child-resistant" packaging recalls (medicines, cleaners, lighters) are about adult products.
_NOT_FOR_KIDS = re.compile(r"\bchild[- ]resistant\b|\bchild[- ]proof\b", re.IGNORECASE)


def is_baby_related(text: str) -> bool:
    if not text:
        return False
    return bool(_PATTERN.search(_NOT_FOR_KIDS.sub(" ", text).replace("'", "")))
