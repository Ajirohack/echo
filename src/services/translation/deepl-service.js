/**
 * DeepL Translation Service
 * Implements integration with DeepL API for high-quality translations,
 * particularly excelling at European languages.
 */

const deepl = require('deepl-node');
const EventEmitter = require('events');
const fs = require('fs');
const path = require('path');

class DeepLService extends EventEmitter {
    constructor(config = {}) {
        super();
        this.config = {
            apiKey: config.apiKey || process.env.DEEPL_API_KEY,
            formality: config.formality || 'default',
            preserveFormatting: config.preserveFormatting !== false,
            timeout: config.timeout || 5000,
            maxRetries: config.maxRetries || 3,
            ...config
        };

        this.translator = null;
        this.isInitialized = false;
        this.supportedLanguages = {
            source: [],
            target: []
        };

        // Metrics
        this.metrics = {
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            totalCharacters: 0,
            averageLatency: 0,
            totalLatency: 0,
            usage: {
                character: {
                    count: 0,
                    limit: 0
                }
            }
        };
    }

    /**
     * Initialize the DeepL service
     * 
     * @returns {Promise<boolean>} - Success status
     */
    async initialize() {
        if (this.isInitialized) {
            return true;
        }

        try {
            if (!this.config.apiKey) {
                throw new Error('DeepL API key is required');
            }

            this.translator = new deepl.Translator(this.config.apiKey);

            // Get supported languages
            const sourceLanguages = await this.translator.getSourceLanguages();
            const targetLanguages = await this.translator.getTargetLanguages();

            this.supportedLanguages.source = sourceLanguages.map(lang => lang.code);
            this.supportedLanguages.target = targetLanguages.map(lang => lang.code);

            // Get usage information
            await this.updateUsage();

            this.isInitialized = true;
            console.log('DeepL service initialized successfully');

            // Emit initialization event
            this.emit('initialized', {
                service: 'deepl',
                supportedLanguages: this.supportedLanguages
            });

            return true;
        } catch (error) {
            console.error('Failed to initialize DeepL service:', error);
            this.emit('error', {
                service: 'deepl',
                error: error.message,
                type: 'initialization'
            });

            return false;
        }
    }

    /**
     * Translate text using DeepL
     * 
     * @param {string} text - Text to translate
     * @param {string} sourceLanguage - Source language code
     * @param {string} targetLanguage - Target language code
     * @param {object} options - Additional options
     * @returns {Promise<object>} - Translation result
     */
    async translate(text, sourceLanguage, targetLanguage, options = {}) {
        // Ensure service is initialized
        if (!this.isInitialized) {
            await this.initialize();
        }

        // Metrics
        const startTime = Date.now();
        this.metrics.totalRequests++;
        this.metrics.totalCharacters += text.length;

        try {
            // Normalize language codes for DeepL
            sourceLanguage = this.normalizeLanguageCode(sourceLanguage);
            targetLanguage = this.normalizeLanguageCode(targetLanguage, true);

            // Check if languages are supported
            if (!this.isLanguagePairSupported(sourceLanguage, targetLanguage)) {
                throw new Error(`Language pair not supported: ${sourceLanguage} to ${targetLanguage}`);
            }

            // Merge options with defaults
            const translationOptions = {
                preserveFormatting: options.preserveFormatting ?? this.config.preserveFormatting,
                formality: options.formality || this.config.formality,
                context: options.context || null,
                ...options
            };

            // Special handling for auto-detection
            const translationParams = {};
            if (sourceLanguage.toLowerCase() !== 'auto') {
                translationParams.sourceLanguage = sourceLanguage;
            }

            // Perform translation
            const result = await this.translator.translateText(
                text,
                sourceLanguage === 'auto' ? null : sourceLanguage,
                targetLanguage,
                {
                    preserveFormatting: translationOptions.preserveFormatting,
                    formality: translationOptions.formality,
                    context: translationOptions.context
                }
            );

            // Get detected source language if auto-detection was used
            const detectedLanguage = sourceLanguage === 'auto' ?
                result.detectedSourceLanguage : sourceLanguage;

            // Update metrics
            const latency = Date.now() - startTime;
            this.metrics.successfulRequests++;
            this.metrics.totalLatency += latency;
            this.metrics.averageLatency = this.metrics.totalLatency / this.metrics.successfulRequests;

            // Update usage info periodically
            if (this.metrics.successfulRequests % 10 === 0) {
                this.updateUsage().catch(err => console.error('Failed to update DeepL usage:', err));
            }

            // Emit success event
            this.emit('translationSuccess', {
                service: 'deepl',
                latencyMs: latency,
                sourceLanguage,
                targetLanguage,
                detectedLanguage
            });

            // Return standardized result
            return {
                translatedText: result.text,
                originalText: text,
                detectedLanguage: detectedLanguage,
                sourceLanguage,
                targetLanguage,
                service: 'deepl',
                confidence: 0.9, // DeepL doesn't provide confidence scores, so use a high default
                alternatives: [],
                metadata: {
                    formality: translationOptions.formality,
                    latencyMs: latency
                }
            };
        } catch (error) {
            // Update metrics
            this.metrics.failedRequests++;
            const latency = Date.now() - startTime;

            // Determine error type
            let errorType = 'unknown';
            if (error.message.includes('Authentication failed')) {
                errorType = 'authentication';
            } else if (error.message.includes('quota')) {
                errorType = 'quota';
            } else if (error.message.includes('Language pair not supported')) {
                errorType = 'unsupported_language';
            } else if (error.response && error.response.status === 429) {
                errorType = 'rate_limit';
            }

            // Emit error event
            this.emit('translationError', {
                service: 'deepl',
                error: error.message,
                type: errorType,
                sourceLanguage,
                targetLanguage,
                latencyMs: latency
            });

            // Re-throw the error for the caller to handle
            throw error;
        }
    }

    /**
     * Normalize language code for DeepL
     * 
     * @param {string} code - Language code to normalize
     * @param {boolean} isTarget - Whether this is a target language
     * @returns {string} - Normalized language code
     */
    normalizeLanguageCode(code, isTarget = false) {
        if (!code) return isTarget ? 'EN-US' : 'EN';

        // Convert to uppercase
        code = code.toUpperCase();

        // Handle special cases
        if (code === 'EN' && isTarget) {
            return 'EN-US'; // Default to US English for targets
        }

        if (code === 'PT' && isTarget) {
            return 'PT-PT'; // Default to European Portuguese
        }

        if (code === 'AUTO') {
            return 'auto';
        }

        return code;
    }

    /**
     * Check if a language pair is supported
     * 
     * @param {string} sourceLanguage - Source language code
     * @param {string} targetLanguage - Target language code
     * @returns {boolean} - Whether the pair is supported
     */
    isLanguagePairSupported(sourceLanguage, targetLanguage) {
        // Auto-detection is always supported for source
        if (sourceLanguage.toLowerCase() === 'auto') {
            return this.supportedLanguages.target.includes(targetLanguage);
        }

        return this.supportedLanguages.source.includes(sourceLanguage) &&
            this.supportedLanguages.target.includes(targetLanguage);
    }

    /**
     * Update DeepL usage information
     * 
     * @returns {Promise<object>} - Usage information
     */
    async updateUsage() {
        try {
            if (!this.isInitialized) {
                await this.initialize();
            }

            const usage = await this.translator.getUsage();
            this.metrics.usage = usage;

            return usage;
        } catch (error) {
            console.error('Failed to get DeepL usage:', error);
            return this.metrics.usage;
        }
    }

    /**
     * Get current metrics
     * 
     * @returns {object} - Service metrics
     */
    getMetrics() {
        return {
            ...this.metrics,
            status: this.isInitialized ? 'active' : 'inactive',
            supportedLanguagePairs: {
                sourceCount: this.supportedLanguages.source.length,
                targetCount: this.supportedLanguages.target.length
            }
        };
    }

    /**
     * Get supported languages
     * 
     * @returns {object} - Supported languages
     */
    getSupportedLanguages() {
        return this.supportedLanguages;
    }

    /**
     * Reset metrics
     */
    resetMetrics() {
        this.metrics = {
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            totalCharacters: 0,
            averageLatency: 0,
            totalLatency: 0,
            usage: this.metrics.usage
        };
    }

    /**
     * Check service health
     * 
     * @returns {Promise<object>} - Health status
     */
    async checkHealth() {
        try {
            if (!this.isInitialized) {
                await this.initialize();
            }

            // Simple health check by getting supported languages
            await this.translator.getSourceLanguages();

            const usage = await this.updateUsage();
            const isQuotaAvailable = usage.character.limit === 0 || usage.character.count < usage.character.limit;

            return {
                available: true,
                responseTime: this.metrics.averageLatency,
                errorRate: this.metrics.totalRequests > 0 ?
                    this.metrics.failedRequests / this.metrics.totalRequests : 0,
                quotaAvailable: isQuotaAvailable,
                quotaRemaining: usage.character.limit === 0 ?
                    Infinity : usage.character.limit - usage.character.count,
                lastChecked: Date.now()
            };
        } catch (error) {
            console.error('DeepL health check failed:', error);

            return {
                available: false,
                error: error.message,
                errorType: error.message.includes('Authentication') ? 'auth' : 'service',
                lastChecked: Date.now()
            };
        }
    }

    /**
     * Close the service and clean up resources
     */
    destroy() {
        this.isInitialized = false;
        this.translator = null;
        this.removeAllListeners();
        console.log('DeepL service destroyed');
    }
}

module.exports = DeepLService;
