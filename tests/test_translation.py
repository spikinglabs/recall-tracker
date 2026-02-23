from src.models import RecallInfo
from datetime import datetime, timezone

def test_recall_translation():
    # Setup a mock recall that mimics what the scrapers return initially
    recall = RecallInfo(
        id="test-1",
        title="Test Recall",
        url="http://example.com",
        publish_datetime=datetime.now(timezone.utc),
        country_sold_in="DE",
        source="Test Source",
        reason="Gesundheitsschädliche Substanz",
        annotation=None
    )
    
    # Assert initial types
    assert isinstance(recall.reason, str)
    assert recall.annotation is None
    
    # Run the translation loop logic (extracted loosely from main.py)
    target_langs = ['en', 'de', 'es', 'fr', 'zh-CN']
    # Normally we use GoogleTranslator, but we will mock it here to prevent network issues in CI
    class MockTranslator:
        def __init__(self, target):
            self.target = target
        def translate(self, text):
            # very simple mock
            return f"Translated to {self.target}: {text}"
            
    translators = {lang: MockTranslator(lang) for lang in target_langs}
    
    def translate_text(text):
        if not text:
            return None
        if isinstance(text, dict):
            return text
        translations = {}
        for lang in target_langs:
            translations[lang] = translators[lang].translate(text)
        return translations
        
    recall.reason = translate_text(recall.reason)
    recall.annotation = translate_text(recall.annotation)
    
    # Assert dictionary types
    assert isinstance(recall.reason, dict)
    assert recall.reason['en'] == "Translated to en: Gesundheitsschädliche Substanz"
    assert recall.annotation is None
    
    # Ensure Pydantic serialization doesn't choke on the Union type
    dumped = recall.model_dump(mode="json")
    assert isinstance(dumped['reason'], dict)
    assert "en" in dumped['reason']
