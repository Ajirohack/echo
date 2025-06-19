import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

class TestConfig:
    # API Keys
    API_KEYS = {
        'OPENAI_API_KEY': os.getenv('OPENAI_API_KEY'),
        'ELEVENLABS_API_KEY': os.getenv('ELEVENLABS_API_KEY'),
        'DEEPL_API_KEY': os.getenv('DEEPL_API_KEY'),
        'AZURE_API_KEY': os.getenv('AZURE_API_KEY'),
        'GOOGLE_API_KEY': os.getenv('GOOGLE_API_KEY')
    }
    
    # Test data paths
    TEST_AUDIO_PATH = 'tests/fixtures/test_audio.wav'
    TEST_TEXT_PATH = 'tests/fixtures/test_text.txt'
    
    # Performance thresholds
    STT_LATENCY_THRESHOLD = 1.0  # seconds
    TRANSLATION_LATENCY_THRESHOLD = 0.5  # seconds
    TTS_LATENCY_THRESHOLD = 1.5  # seconds
    TOTAL_PIPELINE_LATENCY_THRESHOLD = 4.0  # seconds
    
    # Rate limiting
    RATE_LIMITS = {
        'STT': 10,  # requests per minute
        'TRANSLATION': 50,  # requests per minute
        'TTS': 20  # requests per minute
    }
    
    # Test languages
    SUPPORTED_LANGUAGES = [
        'en', 'fr', 'es', 'de', 'it', 'nl', 'pt', 'ru', 'zh', 'ja'
    ]
