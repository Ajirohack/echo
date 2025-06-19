/**
 * Azure Translator Service
 * Implements integration with Microsoft Azure Translator API
 * for enterprise-grade reliability and broad language support.
 */

const axios = require('axios');
const EventEmitter = require('events');
const { v4: uuidv4 } = require('uuid');

class AzureTranslator extends EventEmitter {
    constructor(config = {}) {
        super();

        // Configuration
        this.config = {
            apiKey: config.apiKey || process.env.AZURE_TRANSLATOR_KEY,
            endpoint: config.endpoint || process.env.AZURE_TRANSLATOR_ENDPOINT || 'https://api.cognitive.microsofttranslator.com',
            region: config.region || process.env.AZURE_REGION || 'eastus',
            apiVersion: config.apiVersion || '3.0',
            category: config.category || 'general', // 'general', 'conversational', 'technology'
            profanityAction: config.profanityAction || 'NoAction', // 'NoAction', 'Marked', 'Deleted'
            timeout: config.timeout || 10000,
            maxRetries: config.maxRetries || 3,
            ...config
        };

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
     * Initialize Azure Translator service
     * 
     * @returns {Promise<object>} Initialization result
     */
    async initialize() {
        try {
            if (!this.config.apiKey) {
                throw new Error('Azure Translator API key not found');
            }

            // Test connection and load supported languages
            await this.testConnection();
            await this.loadSupportedLanguages();

            this.isInitialized = true;

            return {
                success: true,
                supportedLanguages: this.supportedLanguages.length,
                endpoint: this.config.endpoint,
                region: this.config.region
            };

        } catch (error) {
            console.error('Azure Translator initialization failed:', error);
            throw error;
        }
    }

    /**
     * Test Azure Translator connection
     * 
     * @returns {Promise<boolean>} Connection test result
     */
    async testConnection() {
        try {
            const result = await this.translateText('Hello', 'en', 'es');
            return result.translation.toLowerCase().includes('hola');
        } catch (error) {
            throw new Error(`Azure Translator connection test failed: ${error.message}`);
        }
    }

    /**
     * Load supported languages
     * 
     * @returns {Promise<void>}
     */
    async loadSupportedLanguages() {
        try {
            const response = await axios.get(
                `${this.config.endpoint}/languages?api-version=${this.config.apiVersion}&scope=translation`,
                {
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    timeout: this.config.timeout
                }
            );

            if (response.data && response.data.translation) {
                this.supportedLanguages = Object.keys(response.data.translation);
                console.log(`Azure Translator supports ${this.supportedLanguages.length} languages`);
            } else {
                throw new Error('Invalid response format for languages');
            }

        } catch (error) {
            console.error('Failed to load Azure Translator languages:', error);
            // Fallback to a common set of languages
            this.supportedLanguages = ['en', 'es', 'fr', 'de', 'it', 'pt', 'nl', 'ru', 'ja', 'ko', 'zh-Hans', 'ar'];
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
                throw new Error('Azure Translator service not initialized');
            }

            return await this.translateText(text, fromLanguage, toLanguage, options);

        } catch (error) {
            console.error('Azure Translator translation failed:', error);

            // Update metrics
            this.metrics.requestCount++;
            this.metrics.successRate = (this.metrics.successRate * 0.9) + 0; // 0% success
            this.metrics.lastError = error.message;

            throw error;
        }
    }

    /**
     * Internal implementation of text translation
     * 
     * @private
     * @param {string} text - Text to translate
     * @param {string} fromLanguage - Source language code
     * @param {string} toLanguage - Target language code
     * @param {object} options - Translation options
     * @returns {Promise<object>} Translation result
     */
    async translateText(text, fromLanguage, toLanguage, options = {}) {
        const startTime = Date.now();

        // Prepare request parameters
        const params = {
            'api-version': this.config.apiVersion,
            'to': toLanguage,
            'category': options.category || this.config.category,
            'profanityAction': options.profanityAction || this.config.profanityAction,
            'includeAlignment': options.includeAlignment || false,
            'includeSentenceLength': options.includeSentenceLength || false,
            'textType': options.textType || 'plain' // 'plain' or 'html'
        };

        // Add source language if not auto-detect
        if (fromLanguage && fromLanguage.toLowerCase() !== 'auto') {
            params.from = fromLanguage;
        }

        // Make request
        try {
            const response = await axios.post(
                `${this.config.endpoint}/translate`,
                [{ text: text }],
                {
                    params: params,
                    headers: {
                        'Ocp-Apim-Subscription-Key': this.config.apiKey,
                        'Ocp-Apim-Subscription-Region': this.config.region,
                        'Content-Type': 'application/json',
                        'X-ClientTraceId': uuidv4()
                    },
                    timeout: this.config.timeout
                }
            );

            const processingTime = Date.now() - startTime;

            // Update metrics
            this.metrics.requestCount++;
            this.metrics.charactersProcessed += text.length;
            this.metrics.averageLatency = (this.metrics.averageLatency * 0.9) + (processingTime * 0.1);
            this.metrics.successRate = (this.metrics.successRate * 0.9) + 1; // 100% success

            // Extract results
            const result = response.data[0];
            const translation = result.translations[0];
            const detectedLanguage = result.detectedLanguage?.language || fromLanguage;

            return {
                translation: translation.text,
                detectedLanguage: detectedLanguage,
                confidence: result.detectedLanguage?.score || 0.9,
                service: 'azure',
                fromLanguage: detectedLanguage,
                toLanguage: toLanguage,
                processingTime: processingTime,
                alignment: result.translations[0].alignment,
                sentenceLength: result.translations[0].sentLen
            };

        } catch (error) {
            // Handle API-specific errors
            const errorMessage = error.response?.data?.error?.message || error.message;
            console.error('Azure translation error:', errorMessage);

            // Update metrics for error
            this.metrics.successRate = (this.metrics.successRate * 0.9) + 0; // 0% success
            this.metrics.lastError = errorMessage;

            throw new Error(`Azure Translator error: ${errorMessage}`);
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

            const response = await axios.post(
                `${this.config.endpoint}/detect`,
                [{ text: text }],
                {
                    params: { 'api-version': this.config.apiVersion },
                    headers: {
                        'Ocp-Apim-Subscription-Key': this.config.apiKey,
                        'Ocp-Apim-Subscription-Region': this.config.region,
                        'Content-Type': 'application/json',
                        'X-ClientTraceId': uuidv4()
                    },
                    timeout: this.config.timeout
                }
            );

            const processingTime = Date.now() - startTime;
            const detection = response.data[0];

            return {
                language: detection.language,
                confidence: detection.score,
                isReliable: detection.isTranslationSupported && detection.score > 0.7,
                alternatives: detection.alternatives?.map(alt => ({
                    language: alt.language,
                    confidence: alt.score
                })) || [],
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
                throw new Error('Azure Translator service not initialized');
            }

            if (!Array.isArray(texts) || texts.length === 0) {
                throw new Error('Invalid texts array for batch translation');
            }

            const startTime = Date.now();

            // Prepare request parameters
            const params = {
                'api-version': this.config.apiVersion,
                'to': toLanguage,
                'category': options.category || this.config.category,
                'profanityAction': options.profanityAction || this.config.profanityAction
            };

            // Add source language if not auto-detect
            if (fromLanguage && fromLanguage.toLowerCase() !== 'auto') {
                params.from = fromLanguage;
            }

            // Prepare request body
            const requestBody = texts.map(text => ({ text }));

            // Make request
            const response = await axios.post(
                `${this.config.endpoint}/translate`,
                requestBody,
                {
                    params: params,
                    headers: {
                        'Ocp-Apim-Subscription-Key': this.config.apiKey,
                        'Ocp-Apim-Subscription-Region': this.config.region,
                        'Content-Type': 'application/json',
                        'X-ClientTraceId': uuidv4()
                    },
                    timeout: this.config.timeout
                }
            );

            const processingTime = Date.now() - startTime;

            // Update metrics
            this.metrics.requestCount++;
            this.metrics.charactersProcessed += texts.reduce((sum, text) => sum + text.length, 0);
            this.metrics.averageLatency = (this.metrics.averageLatency * 0.9) + (processingTime * 0.1);
            this.metrics.successRate = (this.metrics.successRate * 0.9) + 1; // 100% success

            // Prepare results
            return response.data.map((result, index) => {
                const translation = result.translations[0];
                const detectedLanguage = result.detectedLanguage?.language || fromLanguage;

                return {
                    original: texts[index],
                    translation: translation.text,
                    detectedLanguage: detectedLanguage,
                    confidence: result.detectedLanguage?.score || 0.9,
                    service: 'azure',
                    fromLanguage: detectedLanguage,
                    toLanguage: toLanguage,
                    processingTime: processingTime / texts.length
                };
            });

        } catch (error) {
            console.error('Azure Translator batch translation failed:', error);

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
     * Cleanup resources
     */
    destroy() {
        this.isInitialized = false;
        this.removeAllListeners();
    }
}

module.exports = AzureTranslator;
