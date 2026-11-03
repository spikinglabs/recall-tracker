from src.classify import Texts, unescape


def test_unescape_turns_escapes_back_into_letters():
    assert unescape("\\u7a92\\u606f risk") == "窒息 risk"
    assert unescape("plain") == "plain"


def test_texts_and_earlier_verdicts_are_unescaped():
    t = Texts(en="Choking", de="Ersticken", es="Asfixia", fr="\\u00c9touffement", zh_CN="\\u7a92\\u606f")
    assert t.as_dict()["zh-CN"] == "窒息" and t.as_dict()["fr"] == "Étouffement"
