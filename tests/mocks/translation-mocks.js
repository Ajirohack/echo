/**
 * Mock Translation Services
 * Provides mock implementations of translation services for testing
 */

class MockTranslationService {
    constructor(options = {}) {
        this.name = options.name || 'mock-service';
        this.delay = options.delay || 50;
        this.failureRate = options.failureRate || 0;
        this.supportedLanguages = options.supportedLanguages || ['en', 'es', 'fr', 'de', 'zh', 'ja'];
        this.isInitialized = false;
        this.translations = options.translations || {
            'en': {
                'es': {
                    'Hello': 'Hola',
                    'Hello world': 'Hola mundo',
                    'How are you?': '¿Cómo estás?',
                    'Thank you': 'Gracias',
                    'Good morning': 'Buenos días',
                    'Good evening': 'Buenas noches'
                },
                'fr': {
                    'Hello': 'Bonjour',
                    'Hello world': 'Bonjour le monde',
                    'How are you?': 'Comment allez-vous?',
                    'Thank you': 'Merci',
                    'Good morning': 'Bonjour',
                    'Good evening': 'Bonsoir'
                },
                'de': {
                    'Hello': 'Hallo',
                    'Hello world': 'Hallo Welt',
                    'How are you?': 'Wie geht es dir?',
                    'Thank you': 'Danke',
                    'Good morning': 'Guten Morgen',
                    'Good evening': 'Guten Abend'
                }
            }
        };
    }

    async initialize() {
        // Simulate async initialization
        await new Promise(resolve => setTimeout(resolve, this.delay));
        this.isInitialized = true;
        return { success: true };
    }

    async translate(text, fromLanguage, toLanguage, options = {}) {
        if (!this.isInitialized) {
            throw new Error('Service not initialized');
        }

        // Simulate delay
        await new Promise(resolve => setTimeout(resolve, this.delay));

        // Simulate random failure
        if (Math.random() < this.failureRate) {
            throw new Error('Service temporarily unavailable');
        }

        // Try to find an exact match
        const fromLang = fromLanguage.toLowerCase();
        const toLang = toLanguage.toLowerCase();
        let translation;

        if (this.translations[fromLang]?.[toLang]?.[text]) {
            translation = this.translations[fromLang][toLang][text];
        } else {
            // Generate mock translation if no exact match
            translation = `[${toLang}] ${text}`;
        }

        return {
            translation,
            service: this.name,
            confidence: 0.85 + (Math.random() * 0.1),
            processingTime: this.delay,
            fromLanguage: fromLang,
            toLanguage: toLang
        };
    }

    async testConnection() {
        await new Promise(resolve => setTimeout(resolve, this.delay));
        return Math.random() >= this.failureRate;
    }

    async getSupportedLanguages() {
        return this.supportedLanguages;
    }

    destroy() {
        this.isInitialized = false;
    }
}

// Export mock service classes
module.exports = {
    MockTranslationService,
    MockDeepLService: class MockDeepLService extends MockTranslationService {
        constructor(options = {}) {
            super({
                name: 'deepl',
                delay: 80,
                ...options
            });
        }
    },
    MockGPT4oTranslator: class MockGPT4oTranslator extends MockTranslationService {
        constructor(options = {}) {
            super({
                name: 'gpt4o',
                delay: 150,
                ...options
            });
        }

        async translateWithContext(text, fromLanguage, toLanguage, context, options = {}) {
            const result = await this.translate(text, fromLanguage, toLanguage, options);
            return {
                ...result,
                reasoning: 'Context-aware translation from mock service',
                alternatives: [`Alternative translation for: ${text}`]
            };
        }
    },
    MockGoogleTranslate: class MockGoogleTranslate extends MockTranslationService {
        constructor(options = {}) {
            super({
                name: 'google',
                delay: 60,
                ...options
            });
        }
    },
    MockAzureTranslator: class MockAzureTranslator extends MockTranslationService {
        constructor(options = {}) {
            super({
                name: 'azure',
                delay: 70,
                ...options
            });
        }

        async detectLanguage(text) {
            await new Promise(resolve => setTimeout(resolve, this.delay / 2));
            return {
                language: 'en',
                confidence: 0.9,
                isTranslationSupported: true
            };
        }
    }
};
