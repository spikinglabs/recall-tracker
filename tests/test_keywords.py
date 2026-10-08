from src.scrapers.keywords import is_baby_related


def test_whole_words_only():
    assert is_baby_related("Infant Formula")
    assert is_baby_related("Children's Cough Syrup")
    assert is_baby_related("Kids' toothpaste")
    assert not is_baby_related("Canned kidney beans")
    assert not is_baby_related("Kidding goat cheese")


def test_child_resistant_packaging_is_not_a_kids_product():
    assert not is_baby_related("Pain reliever recalled; packaging is not child-resistant")
    assert is_baby_related("Children's pain reliever; packaging is not child-resistant")
