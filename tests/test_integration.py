import unittest
import time
from src.core.pipeline import TranslationPipeline
from src.services.stt.whisper_stt import WhisperSTT
from src.services.translation.deepl_translation import DeepLTranslation
from src.services.tts.elevenlabs_tts import ElevenLabsTTS

class TestTranslationPipeline(unittest.TestCase):
    def setUp(self):
        self.pipeline = TranslationPipeline()
        self.stt = WhisperSTT()
        self.translation = DeepLTranslation()
        self.tts = ElevenLabsTTS()
    
    def test_stt_to_translation(self):
        """Test STT to Translation pipeline"""
        start_time = time.time()
        text = self.stt.transcribe("test_audio.wav")
        translated_text = self.translation.translate(text, "en", "fr")
        end_time = time.time()
        
        self.assertLess(end_time - start_time, 5.0)  # <5 second processing time
        self.assertIsNotNone(translated_text)
    
    def test_translation_to_tts(self):
        """Test Translation to TTS pipeline"""
        start_time = time.time()
        audio = self.tts.synthesize("Hello, how are you?", "en")
        end_time = time.time()
        
        self.assertLess(end_time - start_time, 1.5)  # <1.5 second processing time
        self.assertIsNotNone(audio)
    
    def test_complete_pipeline(self):
        """Test complete audio pipeline"""
        start_time = time.time()
        result = self.pipeline.process_audio("test_audio.wav", "en", "fr")
        end_time = time.time()
        
        self.assertLess(end_time - start_time, 4.0)  # <4 second total latency
        self.assertIsNotNone(result)

if __name__ == '__main__':
    unittest.main()
