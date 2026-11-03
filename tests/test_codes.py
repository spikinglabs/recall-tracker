from src.codes import barcodes, gtin_ok, labelled_barcodes, models


def test_barcodes_split_runs_and_reject_stray_numbers():
    run = "805411783779280541178378088054117837815"
    assert barcodes(run) == ["8054117837792", "8054117837808", "8054117837815"]
    assert barcodes("4006381333931") == ["4006381333931"]
    assert barcodes("2026103112") == []  # a date-like number is not a barcode
    assert gtin_ok("036000291452")  # UPC-A


def test_models_keep_numbers_not_names():
    assert models("276, 276 KIT, 929") == ["276", "276 KIT", "929"]
    assert models("Blue Fish") == []
    assert models(" HJ-15L") == ["HJ-15L"]


def test_labelled_barcodes_in_free_text():
    assert labelled_barcodes("Los L123, EAN: 4006381333931") == ["4006381333931"]
