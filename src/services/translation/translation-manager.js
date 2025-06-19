/**
 * Translation Manager
 * Coordinates all translation services with intelligent routing,
 * fallback mechanisms, and quality assessment.
 */

const DeepLService = require('./deepl-service');
const GPT4oTranslator = require('./gpt4o-translator');
const GoogleTranslate = require('./google-translate');
const AzureTranslator = require('./azure-translator');
const LanguagePairOptimizer = require('./utils/language-pair-optimizer');
const ContextManager = require('./utils/context-manager');
const TranslationCache = require('./utils/translation-cache');
const TranslationQuality = require('./translation-quality');
const EventEmitter = require('events');
const path = require('path');
const fs = require('fs');

class TranslationManager extends EventEmitter {
    constructor(config = {}) {
        super();

        // Load configuration
        this.config = {
            enableCaching: true,
            cacheExpiryMs: 24 * 60 * 60 * 1000, // 24 hours
            maxRetries: 3,
            timeoutMs: 10000,
            qualityThreshold: 0.8,
            contextWindowSize: 10,
            ...config
        };

        // Initialize all translation services
        this.services = {
            deepl: new DeepLService(),
            gpt4o: new GPT4oTranslator(),
            google: new GoogleTranslate(),
            azure: new AzureTranslator()
        };

        // Core components
        this.languagePairOptimizer = new LanguagePairOptimizer(this);
        this.contextManager = new ContextManager();
        this.translationCache = new TranslationCache();
        this.qualityAssessment = new TranslationQuality();

        // State management
        this.isInitialized = false;
        this.serviceHealth = {};
        this.translationHistory = [];
    }

    /**
     * Initialize all translation services
     * 
     * @returns {Promise<object>} Initialization results
     */
    async initialize() {
        try {
            console.log('Initializing translation services...');

            const initResults = {};

            // Initialize each service
            for (const [name, service] of Object.entries(this.services)) {
                try {
                    initResults[name] = await service.initialize();
                    this.serviceHealth[name] = { healthy: true, lastError: null };
                    console.log(`${name} translation service initialized:`, initResults[name]);
                } catch (error) {
                    console.error(`Failed to initialize ${name}:`, error);
                    initResults[name] = { success: false, error: error.message };
                    this.serviceHealth[name] = { healthy: false, lastError: error.message };
                }
            }

            // Initialize supporting components
            await this.languagePairOptimizer.initialize();
            await this.contextManager.initialize();
            await this.translationCache.initialize();
            await this.qualityAssessment.initialize();

            this.isInitialized = true;

            return {
                success: true,
                services: initResults,
                supportedLanguagePairs: await this.getSupportedLanguagePairs()
            };

        } catch (error) {
            console.error('Translation Manager initialization failed:', error);
            throw error;
        }
    }

    /**
     * Main translation function with intelligent routing
     * 
     * @param {string} text - Text to translate
     * @param {string} fromLanguage - Source language code
     * @param {string} toLanguage - Target language code
     * @param {object} options - Translation options
     * @returns {Promise<object>} Translation result
     */
    async translate(text, fromLanguage, toLanguage, options = {}) {
        try {
            if (!this.isInitialized) {
                throw new Error('Translation Manager not initialized');
            }

            const {
                context = '',
                priority = 'quality', // 'quality', 'speed', 'cost'
                useCache = true,
                conversationId = null,
                domain = 'general',
                formality = 'neutral',
                preserveFormatting = true,
                preferredService = null,
                requiresContext = !!context
            } = options;

            // Check cache first
            if (useCache && this.config.enableCaching) {
                const cached = await this.translationCache.get(text, fromLanguage, toLanguage,
                    preferredService || 'any', { formality, preserveFormatting });

                if (cached) {
                    console.log('Translation retrieved from cache');
                    this.emit('translationComplete', { ...cached, cached: true });
                    return cached;
                }
            }

            // Get conversation context
            const conversationContext = conversationId
                ? await this.contextManager.getConversationContext(conversationId)
                : '';

            const fullContext = [context, conversationContext].filter(Boolean).join(' ');

            // Select optimal service for this language pair
            const selectedService = this.languagePairOptimizer.getBestServiceForLanguagePair(
                fromLanguage,
                toLanguage,
                {
                    priority: priority,
                    serviceHealth: this.serviceHealth,
                    textLength: text.length,
                    hasContext: !!fullContext,
                    domain: domain,
                    requiresContext: requiresContext,
                    userPreference: preferredService
                }
            );

            console.log(`Using ${selectedService} for ${fromLanguage} → ${toLanguage} translation`);

            // Perform translation with primary service
            let result = await this.attemptTranslation(
                selectedService,
                text,
                fromLanguage,
                toLanguage,
                fullContext,
                { formality, preserveFormatting, domain }
            );

            // If primary service fails, try fallback services
            if (!result.success && this.config.maxRetries > 0) {
                result = await this.fallbackTranslation(
                    text,
                    fromLanguage,
                    toLanguage,
                    fullContext,
                    selectedService,
                    { formality, preserveFormatting, domain }
                );
            }

            // Assess translation quality
            if (result.success) {
                result.quality = await this.qualityAssessment.assessTranslation({
                    original: text,
                    translated: result.translation,
                    fromLanguage,
                    toLanguage,
                    service: result.service,
                    context: fullContext,
                    domainContext: domain
                });

                // Cache high-quality translations
                if (result.quality.score >= this.config.qualityThreshold && useCache && this.config.enableCaching) {
                    await this.translationCache.set(
                        text,
                        fromLanguage,
                        toLanguage,
                        result.service,
                        result,
                        { formality, preserveFormatting, domain },
                        this.config.cacheExpiryMs / 1000 // Convert to seconds for the cache
                    );
                }

                // Update conversation context
                if (conversationId) {
                    await this.contextManager.addTranslationEntry(
                        conversationId,
                        {
                            original: text,
                            translated: result.translation,
                            fromLanguage,
                            toLanguage,
                            timestamp: Date.now(),
                            service: result.service,
                            domain: domain,
                            isSourceToTarget: true
                        }
                    );
                }

                // Update language pair optimizer with quality data
                this.languagePairOptimizer.updateQualityScore(
                    result.service,
                    fromLanguage,
                    toLanguage,
                    result.quality.score
                );

                // Store in translation history
                this.translationHistory.push({
                    ...result,
                    timestamp: Date.now(),
                    conversationId,
                    domain
                });

                this.emit('translationComplete', result);
            } else {
                this.emit('translationError', result.error);
            }

            return result;

        } catch (error) {
            console.error('Translation failed:', error);
            const errorResult = {
                success: false,
                error: error.message,
                translation: '',
                fromLanguage,
                toLanguage,
                service: 'none',
                timestamp: Date.now()
            };

            this.emit('translationError', error);
            return errorResult;
        }
    }

    /**
     * Attempt translation with specific service
     * 
     * @param {string} serviceName - Name of translation service to use
     * @param {string} text - Text to translate
     * @param {string} fromLang - Source language code
     * @param {string} toLang - Target language code
     * @param {string} context - Context for context-aware translation
     * @param {object} options - Additional translation options
     * @returns {Promise<object>} Translation result
     */
    async attemptTranslation(serviceName, text, fromLang, toLang, context = '', options = {}) {
        try {
            const service = this.services[serviceName];
            if (!service) {
                throw new Error(`Service ${serviceName} not available`);
            }

            const startTime = Date.now();
            let result;

            // Call service-specific translation method
            if (serviceName === 'gpt4o' && context) {
                result = await service.translateWithContext(text, fromLang, toLang, context, options);
            } else {
                result = await service.translate(text, fromLang, toLang, {
                    context,
                    ...options
                });
            }

            const processingTime = Date.now() - startTime;

            // Mark service as healthy
            this.serviceHealth[serviceName] = { healthy: true, lastError: null };

            return {
                success: true,
                translation: result.translation || result.translatedText || result.text || result,
                confidence: result.confidence || 0.85,
                service: serviceName,
                processingTime: processingTime,
                fromLanguage: fromLang,
                toLanguage: toLang,
                timestamp: Date.now(),
                alternatives: result.alternatives || [],
                reasoning: result.reasoning || '',
                formality: result.formality || options.formality || 'neutral',
                cultural_notes: result.cultural_notes || ''
            };

        } catch (error) {
            console.error(`${serviceName} translation failed:`, error);

            // Mark service as potentially unhealthy
            this.serviceHealth[serviceName] = {
                healthy: false,
                lastError: error.message
            };

            return {
                success: false,
                error: error.message,
                service: serviceName,
                timestamp: Date.now()
            };
        }
    }

    /**
     * Fallback translation with other services
     * 
     * @param {string} text - Text to translate
     * @param {string} fromLang - Source language code
     * @param {string} toLang - Target language code
     * @param {string} context - Context for context-aware translation
     * @param {string} excludeService - Service to exclude from fallbacks
     * @param {object} options - Additional translation options
     * @returns {Promise<object>} Translation result
     */
    async fallbackTranslation(text, fromLang, toLang, context, excludeService, options = {}) {
        // Get services in fallback order based on priority
        let availableServices = [];

        // For short text, prioritize speed: Google > Azure > DeepL > GPT-4o
        if (text.length < 100 && options.priority === 'speed') {
            availableServices = ['google', 'azure', 'deepl', 'gpt4o'];
        }
        // For European languages, prioritize DeepL
        else if (this.isEuropeanLanguagePair(fromLang, toLang)) {
            availableServices = ['deepl', 'gpt4o', 'azure', 'google'];
        }
        // For context-aware translation, prioritize GPT-4o
        else if (context) {
            availableServices = ['gpt4o', 'deepl', 'azure', 'google'];
        }
        // Default fallback order
        else {
            availableServices = ['gpt4o', 'google', 'azure', 'deepl'];
        }

        // Filter out the excluded service and unhealthy services
        availableServices = availableServices.filter(service =>
            service !== excludeService && this.serviceHealth[service]?.healthy !== false
        );

        for (const serviceName of availableServices) {
            console.log(`Attempting fallback translation with ${serviceName}`);

            const result = await this.attemptTranslation(
                serviceName,
                text,
                fromLang,
                toLang,
                context,
                options
            );

            if (result.success) {
                console.log(`Fallback successful with ${serviceName}`);
                return result;
            }
        }

        // All services failed
        return {
            success: false,
            error: 'All translation services failed',
            translation: '',
            fromLanguage: fromLang,
            toLanguage: toLang,
            service: 'none',
            timestamp: Date.now()
        };
    }

    /**
     * Check if a language pair is European
     * 
     * @param {string} fromLang - Source language
     * @param {string} toLang - Target language
     * @returns {boolean} Whether both languages are European
     */
    isEuropeanLanguagePair(fromLang, toLang) {
        const europeanLanguages = [
            'BG', 'CS', 'DA', 'DE', 'EL', 'EN', 'ES', 'ET', 'FI', 'FR',
            'HU', 'IT', 'LT', 'LV', 'NL', 'PL', 'PT', 'RO', 'SK', 'SL', 'SV'
        ];

        const normFromLang = fromLang.toUpperCase().split('-')[0];
        const normToLang = toLang.toUpperCase().split('-')[0];

        return europeanLanguages.includes(normFromLang) && europeanLanguages.includes(normToLang);
    }

    /**
     * Batch translation for efficiency
     * 
     * @param {string[]} texts - Array of texts to translate
     * @param {string} fromLanguage - Source language code
     * @param {string} toLanguage - Target language code
     * @param {object} options - Translation options
     * @returns {Promise<object[]>} Array of translation results
     */
    async translateBatch(texts, fromLanguage, toLanguage, options = {}) {
        try {
            if (!Array.isArray(texts) || texts.length === 0) {
                throw new Error('Invalid texts array for batch translation');
            }

            const results = [];
            const batchSize = options.batchSize || 10;

            // Process in batches to avoid overwhelming services
            for (let i = 0; i < texts.length; i += batchSize) {
                const batch = texts.slice(i, i + batchSize);

                const batchPromises = batch.map(text =>
                    this.translate(text, fromLanguage, toLanguage, options)
                );

                const batchResults = await Promise.all(batchPromises);
                results.push(...batchResults);

                // Small delay between batches to be respectful to APIs
                if (i + batchSize < texts.length) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
            }

            return results;

        } catch (error) {
            console.error('Batch translation failed:', error);
            throw error;
        }
    }

    /**
     * Get supported language pairs
     * 
     * @returns {Promise<string[]>} Array of supported language pairs (e.g. 'en-es')
     */
    async getSupportedLanguagePairs() {
        const allPairs = new Set();

        for (const [serviceName, service] of Object.entries(this.services)) {
            try {
                if (service.getSupportedLanguages) {
                    const languages = await service.getSupportedLanguages();

                    if (languages && (Array.isArray(languages) || languages.source)) {
                        // Handle different return formats
                        const sourceLanguages = Array.isArray(languages) ? languages : languages.source;
                        const targetLanguages = Array.isArray(languages) ? languages : languages.target;

                        // Create all possible pairs
                        for (const from of sourceLanguages) {
                            for (const to of targetLanguages) {
                                if (from !== to) {
                                    allPairs.add(`${from}-${to}`);
                                }
                            }
                        }
                    }
                }
            } catch (error) {
                console.error(`Error getting languages from ${serviceName}:`, error);
            }
        }

        return Array.from(allPairs).sort();
    }

    /**
     * Get service status and health
     * 
     * @returns {object} Service status information
     */
    getServiceStatus() {
        const status = {};

        for (const [name, service] of Object.entries(this.services)) {
            status[name] = {
                healthy: this.serviceHealth[name]?.healthy || false,
                initialized: service.isInitialized || false,
                lastError: this.serviceHealth[name]?.lastError || null,
                supportedLanguages: service.supportedLanguages?.length || 0
            };
        }

        return {
            services: status,
            cacheStats: this.translationCache.getStats ? this.translationCache.getStats() : {},
            translationHistory: this.translationHistory.length,
            contextSessions: this.contextManager.getActiveSessions ? this.contextManager.getActiveSessions() : 0
        };
    }

    /**
     * Clear conversation context
     * 
     * @param {string} conversationId - Conversation ID to clear (all if null)
     */
    async clearContext(conversationId) {
        if (conversationId) {
            await this.contextManager.clearConversation(conversationId);
        } else {
            await this.contextManager.clearAllConversations();
        }
    }

    /**
     * Get translation history
     * 
     * @param {number} limit - Maximum number of history items to return
     * @returns {object[]} Translation history
     */
    getTranslationHistory(limit = 100) {
        return this.translationHistory.slice(-limit);
    }

    /**
     * Export translation history
     * 
     * @returns {object} Exportable translation history and metrics
     */
    exportTranslationHistory() {
        return {
            timestamp: new Date().toISOString(),
            totalTranslations: this.translationHistory.length,
            translations: this.translationHistory,
            serviceStats: this.getServiceStatus()
        };
    }

    /**
     * Cleanup resources
     */
    destroy() {
        // Cleanup all services
        for (const service of Object.values(this.services)) {
            if (service.destroy) {
                service.destroy();
            }
        }

        // Cleanup supporting components
        if (this.translationCache && this.translationCache.destroy) {
            this.translationCache.destroy();
        }

        if (this.contextManager && this.contextManager.destroy) {
            this.contextManager.destroy();
        }

        // Clear history and state
        this.translationHistory = [];
        this.isInitialized = false;

        this.removeAllListeners();
    }
}

module.exports = TranslationManager;
