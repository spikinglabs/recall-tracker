from src.translate import LANGS, Translator, known_translations


class Echo:
    """Pretends to translate: prefixes each line with the target language."""
    calls = 0

    def __init__(self, source, target):
        self.target = target

    def translate(self, text):
        Echo.calls += 1
        return "\n".join(f"[{self.target}] {line}" for line in text.split("\n"))


class Refuses:
    calls = 0

    def __init__(self, source, target):
        pass

    def translate(self, text):
        Refuses.calls += 1
        raise RuntimeError("Server Error: You made too many requests to the server.")


def test_batches_and_reuses_known_translations():
    known = known_translations([{"reason": {"en": "Foreign bodies", "de": "Fremdkörper", "es": "a", "fr": "b", "zh-CN": "c"}}])
    t = Translator(make=Echo, pause=0, backoff=0)
    Echo.calls = 0
    done = t.translate_all(["Fremdkörper", "Gesundheitsschädliche\nSubstanz", "Lead"], known)
    assert done["Fremdkörper"]["en"] == "Foreign bodies"
    assert done["Gesundheitsschädliche Substanz"]["fr"] == "[fr] Gesundheitsschädliche Substanz"
    assert t.lookup(done, "Lead")["zh-CN"] == "[zh-CN] Lead"
    assert Echo.calls == len(LANGS)  # one batched request per language
    assert t.stats == {"reused": 1, "translated": 2, "untranslated": 0}


def test_stops_asking_once_refused_and_keeps_original():
    t = Translator(make=Refuses, pause=0, backoff=0)
    Refuses.calls = 0
    done = t.translate_all(["Lead", "Choking hazard"], {})
    assert done["Lead"] == {lang: "Lead" for lang in LANGS}
    assert Refuses.calls == 3  # three tries, then no more requests
    # Untranslated texts are not reused next time, so a later run tries again
    assert known_translations([{"reason": done["Lead"]}]) == {}
