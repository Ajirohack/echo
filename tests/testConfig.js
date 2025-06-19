export const TEST_CONFIG = {
    // API Keys (should be loaded from environment variables)
    apiKeys: {
        openai: process.env.OPENAI_API_KEY,
        elevenlabs: process.env.ELEVENLABS_API_KEY,
        deepl: process.env.DEEPL_API_KEY,
        azure: process.env.AZURE_API_KEY,
        google: process.env.GOOGLE_API_KEY
    },
    
    // Test data paths
    fixtures: {
        audio: './tests/fixtures/test_audio.wav',
        text: './tests/fixtures/test_text.txt'
    },
    
    // Performance thresholds (in milliseconds)
    performance: {
        sttLatency: 1000, // 1 second
        translationLatency: 500, // 0.5 seconds
        ttsLatency: 1500, // 1.5 seconds
        totalPipelineLatency: 4000 // 4 seconds
    },
    
    // Rate limiting
    rateLimits: {
        stt: 10, // requests per minute
        translation: 50, // requests per minute
        tts: 20 // requests per minute
    },
    
    // Supported languages
    languages: [
        'en', 'fr', 'es', 'de', 'it', 'nl', 'pt', 'ru', 'zh', 'ja'
    ],
    
    // Test environment settings
    environment: {
        timeout: 10000, // 10 seconds
        retries: 3,
        parallel: true
    }
};
