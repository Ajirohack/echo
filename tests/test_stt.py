import unittest
from src.services.stt.whisper_stt import WhisperSTT
from src.services.stt.azure_stt import AzureSTT
from src.services.stt.google_stt import GoogleSTT
from src.services.stt.gpt4o_stt import GPT4oSTT

class TestSTTServices(unittest.TestCase):
    def setUp(self):
        self.whisper = WhisperSTT()
        self.azure = AzureSTT()
        self.google = GoogleSTT()
        self.gpt4o = GPT4oSTT()
    
    def test_whisper_transcription(self):
        # Test Whisper STT service
        pass
    
    def test_azure_transcription(self):
        # Test Azure STT service
        pass
    
    def test_google_transcription(self):
        # Test Google STT service
        pass
    
    def test_gpt4o_transcription(self):
        # Test GPT-4o STT service
        pass

if __name__ == '__main__':
    unittest.main()
