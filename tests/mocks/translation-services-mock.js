/**
 * Testing Mocks for the Translation Service
 * Provides mock implementations of various services for testing
 */

const fs = require('fs');
const path = require('path');

// Load test data
const testDataPath = path.join(__dirname, '../fixtures/test-data/translation-test-data.json');
const mockDataPath = path.join(__dirname, '../fixtures/mock-responses/translation-api-responses.json');

let testData;
let mockResponses;

try {
    testData = JSON.parse(fs.readFileSync(testDataPath, 'utf8'));
} catch (err) {
    testData = {
        sampleTranslations: {
            en: {
                es: {
                    "Hello world": "Hola mundo",
                    "How are you?": "¿Cómo estás?"
                }
            }
        }
    };
}

try {
    mockResponses = JSON.parse(fs.readFileSync(mockDataPath, 'utf8'));
} catch (err) {
    mockResponses = {};
}

/**
 * Base Mock Translation Service
 */
class MockTranslationService {
    constructor(options = {}) {
        this.isInitialized = false;
        this.failureRate = options.failureRate || 0;
        this.delay = options.delay || 0;
        this.supportedLanguages = Object.keys(testData.supportedLanguages || {});
        this.config = options.config || {};
        this.id = Math.random().toString(36).substring(2, 9);
        this.health = { healthy: options.failureRate < 0.9 };
    }

    /**
     * Initialize the service
     * 
     * @returns {Promise<void>}
     */
    async initialize() {
        await this._simulateDelay();

        // Simulate initialization failure based on failure rate
        if (Math.random() < this.failureRate) {
            throw new Error('Failed to initialize translation service');
        }

        this.isInitialized = true;
        return Promise.resolve();
    }

    /**
     * Translate text using the service
     * 
     * @param {string} text - Text to translate
     * @param {string} fromLang - Source language
     * @param {string} toLang - Target language
     * @param {object} options - Translation options
     * @returns {Promise<object>} Translation result
     */
    async translate(text, fromLang, toLang, options = {}) {
        if (!this.isInitialized) {
            throw new Error('Service not initialized');
        }

        await this._simulateDelay();

        // Simulate translation failure based on failure rate
        if (Math.random() < this.failureRate) {
            throw new Error('Translation failed');
        }

        // Get translation from test data if available
        const translation = this._getTranslation(text, fromLang, toLang);

        return {
            translation,
            fromLanguage: fromLang,
            toLanguage: toLang,
            service: this.constructor.name,
            confidence: 0.85 + (Math.random() * 0.15),
            success: true
        };
    }

    /**
     * Get translation from test data
     * 
     * @param {string} text - Text to translate
     * @param {string} fromLang - Source language
     * @param {string} toLang - Target language
     * @returns {string} Translated text
     * @private
     */
    _getTranslation(text, fromLang, toLang) {
        // Try to get translation from test data
        try {
            if (testData.sampleTranslations?.[fromLang]?.[toLang]?.[text]) {
                return testData.sampleTranslations[fromLang][toLang][text];
            }
        } catch (e) {
            console.warn('Error accessing test data:', e.message);
        }

        // Generate a simple translation for testing if not found
        return `[${toLang}] ${text}`;
    }

    /**
     * Simulate network delay
     * 
     * @returns {Promise<void>}
     * @private
     */
    async _simulateDelay() {
        if (this.delay) {
            await new Promise(resolve => setTimeout(resolve, this.delay));
        }
    }

    /**
     * Get supported languages
     * 
     * @returns {Promise<string[]>} List of supported language codes
     */
    async getSupportedLanguages() {
        await this._simulateDelay();
        return this.supportedLanguages;
    }

    /**
     * Detect language of text
     * 
     * @param {string} text - Text to detect
     * @returns {Promise<object>} Detection result
     */
    async detectLanguage(text) {
        await this._simulateDelay();
        return {
            language: 'en',
            confidence: 0.95
        };
    }

    /**
     * Get service health
     * 
     * @returns {object} Health status
     */
    getHealth() {
        return this.health;
    }
}

/**
 * Mock DeepL Service
 */
class MockDeepLService extends MockTranslationService {
    constructor(options = {}) {
        super({
            ...options,
            config: {
                serviceName: 'deepl',
                apiKey: 'mock-deepl-api-key',
                ...options.config
            }
        });
    }

    async translate(text, fromLang, toLang, options = {}) {
        const result = await super.translate(text, fromLang, toLang, options);

        // Add DeepL-specific fields
        return {
            ...result,
            service: 'deepl',
            detectedLanguage: fromLang,
            formality: options.formality || 'default'
        };
    }
}

/**
 * Mock GPT-4o Translator
 */
class MockGPT4oTranslator extends MockTranslationService {
    constructor(options = {}) {
        super({
            ...options,
            config: {
                serviceName: 'gpt4o',
                apiKey: 'mock-openai-api-key',
                ...options.config
            }
        });
        this.conversationContexts = new Map();
    }

    async translate(text, fromLang, toLang, options = {}) {
        const result = await super.translate(text, fromLang, toLang, options);

        // Add GPT-4o-specific fields
        return {
            ...result,
            service: 'gpt4o',
            detectedLanguage: fromLang,
            adaptationScore: 0.92,
            alternatives: [result.translation + ' (alt)'],
            model: 'gpt-4o'
        };
    }
}

/**
 * Mock Google Translate
 */
class MockGoogleTranslate extends MockTranslationService {
    constructor(options = {}) {
        super({
            ...options,
            config: {
                serviceName: 'google',
                apiKey: 'mock-google-api-key',
                ...options.config
            }
        });
    }

    async translate(text, fromLang, toLang, options = {}) {
        const result = await super.translate(text, fromLang, toLang, options);

        // Add Google-specific fields
        return {
            ...result,
            service: 'google',
            detectedLanguage: fromLang,
            model: 'nmt'
        };
    }
}

/**
 * Mock Azure Translator
 */
class MockAzureTranslator extends MockTranslationService {
    constructor(options = {}) {
        super({
            ...options,
            config: {
                serviceName: 'azure',
                apiKey: 'mock-azure-api-key',
                region: 'eastus',
                ...options.config
            }
        });
    }

    async translate(text, fromLang, toLang, options = {}) {
        const result = await super.translate(text, fromLang, toLang, options);

        // Add Azure-specific fields
        return {
            ...result,
            service: 'azure',
            detectedLanguage: fromLang,
            alignment: {
                proj: '0:4-0:3 6:10-5:9'
            }
        };
    }
}

// Export mock service classes
module.exports = {
    MockTranslationService,
    MockDeepLService,
    MockGPT4oTranslator,
    MockGoogleTranslate,
    MockAzureTranslator
};
