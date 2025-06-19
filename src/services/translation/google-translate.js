/**
 * Google Translate Service
 * Implements integration with Google Cloud Translation API
 * for comprehensive language coverage and reliable translation.
 */

const { Translate } = require('@google-cloud/translate').v2;
const EventEmitter = require('events');
const fs = require('fs');
const path = require('path');

class GoogleTranslate extends EventEmitter {
    constructor(config = {}) {
        super();

        // Configuration
        this.config = {
            projectId: config.projectId || process.env.GOOGLE_PROJECT_ID,
            keyFilename: config.keyFilename || process.env.GOOGLE_APPLICATION_CREDENTIALS,
            apiKey: config.apiKey || process.env.GOOGLE_TRANSLATE_API_KEY,
            model: config.model || 'nmt', // 'base' or 'nmt' (Neural Machine Translation)
            timeout: config.timeout || 10000,
            maxRetries: config.maxRetries || 3,
            ...config
        };

        this.translate = null;
        this.isInitialized = false;
        this.supportedLanguages = [];
        this.metrics = {
            requestCount: 0,
            charactersProcessed: 0,
            averageLatency: 0,
            successRate: 1.0,
            lastError: null
        };
    }

    /**
     * Initialize Google Translate service
     * 
     * @returns {Promise<object>} Initialization result
     */
    async initialize() {
        try {
            // Initialize with API key if provided, otherwise use key file
            const options = {};

            if (this.config.projectId) {
                options.projectId = this.config.projectId;
            }

            if (this.config.apiKey) {
                options.key = this.config.apiKey;
            } else if (this.config.keyFilename) {
                options.keyFilename = this.config.keyFilename;
            }

            this.translate = new Translate(options);

            // Test connection and load supported languages
            await this.testConnection();
            await this.loadSupportedLanguages();

            this.isInitialized = true;

            return {
                success: true,
                supportedLanguages: this.supportedLanguages.length,
                model: this.config.model
            };

        } catch (error) {
            console.error('Google Translate initialization failed:', error);
            throw error;
        }
    }

    /**
     * Test Google Translate connection
     * 
     * @returns {Promise<boolean>} Connection test result
     */
    async testConnection() {
        try {
            const [translation] = await this.translate.translate('Hello', 'es');
            return translation.toLowerCase().includes('hola');
        } catch (error) {
            throw new Error(`Google Translate connection test failed: ${error.message}`);
        }
    }

    /**
     * Load supported languages
     * 
     * @returns {Promise<void>}
     */
    async loadSupportedLanguages() {
        try {
            const [languages] = await this.translate.getLanguages();
            this.supportedLanguages = languages.map(lang => lang.code);
            console.log(`Google Translate supports ${this.supportedLanguages.length} languages`);
        } catch (error) {
            console.error('Failed to load Google Translate languages:', error);
            // Fallback to a common set of languages
            this.supportedLanguages = ['en', 'es', 'fr', 'de', 'it', 'pt', 'nl', 'ru', 'ja', 'ko', 'zh', 'ar'];
        }
    }

    /**
     * Main translation function
     * 
     * @param {string} text - Text to translate
     * @param {string} fromLanguage - Source language code (or 'auto' for detection)
     * @param {string} toLanguage - Target language code
     * @param {object} options - Translation options
     * @returns {Promise<object>} Translation result
     */
    async translate(text, fromLanguage, toLanguage, options = {}) {
        try {
            if (!this.isInitialized) {
                throw new Error('Google Translate service not initialized');
            }

            const startTime = Date.now();

            // Format options for Google Translate
            const translateOptions = {
                to: toLanguage,
                model: this.config.model
            };

            // Only set from if not auto-detect
            if (fromLanguage && fromLanguage.toLowerCase() !== 'auto') {
                translateOptions.from = fromLanguage;
            }

            // Execute translation
            const [translation, metadata] = await this.googleTranslateInstance.translate(
                text,
                translateOptions
            );

            const processingTime = Date.now() - startTime;

            // Update metrics
            this.metrics.requestCount++;
            this.metrics.charactersProcessed += text.length;
            this.metrics.averageLatency = (this.metrics.averageLatency * 0.9) + (processingTime * 0.1);
            this.metrics.successRate = (this.metrics.successRate * 0.9) + 1; // 100% success

            // Detected language when auto-detect was used
            const detectedLanguage = metadata?.data?.translations?.[0]?.detectedSourceLanguage || fromLanguage;

            return {
                translation: translation,
                detectedLanguage: detectedLanguage,
                confidence: 0.9, // Google doesn't provide confidence, using a high default
                service: 'google',
                fromLanguage: detectedLanguage,
                toLanguage: toLanguage,
                processingTime: processingTime
            };

        } catch (error) {
            console.error('Google Translate translation failed:', error);

            // Update metrics
            this.metrics.requestCount++;
            this.metrics.successRate = (this.metrics.successRate * 0.9) + 0; // 0% success
            this.metrics.lastError = error.message;

            throw error;
        }
    }

    /**
     * Detect language of text
     * 
     * @param {string} text - Text to detect language
     * @returns {Promise<object>} Detection result
     */
    async detectLanguage(text) {
        try {
            const startTime = Date.now();

            const [detections] = await this.googleTranslateInstance.detect(text);
            const detection = Array.isArray(detections) ? detections[0] : detections;

            const processingTime = Date.now() - startTime;

            return {
                language: detection.language,
                confidence: detection.confidence,
                isReliable: detection.confidence > 0.7,
                processingTime: processingTime
            };

        } catch (error) {
            console.error('Language detection failed:', error);
            throw error;
        }
    }

    /**
     * Batch translation of multiple texts
     * 
     * @param {string[]} texts - Array of texts to translate
     * @param {string} fromLanguage - Source language code
     * @param {string} toLanguage - Target language code
     * @param {object} options - Translation options
     * @returns {Promise<object[]>} Array of translation results
     */
    async translateBatch(texts, fromLanguage, toLanguage, options = {}) {
        try {
            if (!this.isInitialized) {
                throw new Error('Google Translate service not initialized');
            }

            if (!Array.isArray(texts) || texts.length === 0) {
                throw new Error('Invalid texts array for batch translation');
            }

            const startTime = Date.now();

            // Format options for Google Translate
            const translateOptions = {
                to: toLanguage,
                model: this.config.model
            };

            // Only set from if not auto-detect
            if (fromLanguage && fromLanguage.toLowerCase() !== 'auto') {
                translateOptions.from = fromLanguage;
            }

            // Execute batch translation
            const [translations] = await this.googleTranslateInstance.translate(
                texts,
                translateOptions
            );

            const processingTime = Date.now() - startTime;

            // Update metrics
            this.metrics.requestCount++;
            this.metrics.charactersProcessed += texts.reduce((sum, text) => sum + text.length, 0);
            this.metrics.averageLatency = (this.metrics.averageLatency * 0.9) + (processingTime * 0.1);
            this.metrics.successRate = (this.metrics.successRate * 0.9) + 1; // 100% success

            // Prepare results
            return texts.map((text, index) => {
                const translation = translations[index];
                return {
                    original: text,
                    translation: translation,
                    confidence: 0.9, // Google doesn't provide confidence, using a high default
                    service: 'google',
                    fromLanguage: fromLanguage,
                    toLanguage: toLanguage,
                    processingTime: processingTime / texts.length
                };
            });

        } catch (error) {
            console.error('Google Translate batch translation failed:', error);

            // Update metrics
            this.metrics.requestCount++;
            this.metrics.successRate = (this.metrics.successRate * 0.9) + 0; // 0% success
            this.metrics.lastError = error.message;

            throw error;
        }
    }

    /**
     * Get supported languages
     * 
     * @returns {string[]} Array of supported language codes
     */
    getSupportedLanguages() {
        return this.supportedLanguages;
    }

    /**
     * Get service metrics
     * 
     * @returns {object} Service metrics
     */
    getMetrics() {
        return {
            ...this.metrics,
            timestamp: Date.now()
        };
    }

    /**
     * Check service health
     * 
     * @returns {Promise<object>} Health status
     */
    async checkHealth() {
        try {
            await this.testConnection();
            return {
                healthy: true,
                supportedLanguages: this.supportedLanguages.length,
                metrics: this.getMetrics()
            };
        } catch (error) {
            return {
                healthy: false,
                error: error.message,
                metrics: this.getMetrics()
            };
        }
    }

    /**
     * Access the Google Translate instance with error handling
     * 
     * @private
     * @returns {object} Google Translate instance
     */
    get googleTranslateInstance() {
        if (!this.translate) {
            throw new Error('Google Translate not initialized');
        }
        return this.translate;
    }

    /**
     * Cleanup resources
     */
    destroy() {
        this.isInitialized = false;
        this.translate = null;
        this.removeAllListeners();
    }
}

module.exports = GoogleTranslate;
