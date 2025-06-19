/**
 * Mock Language Pair Optimizer for testing
 */

class MockLanguagePairOptimizer {
    constructor() {
        this.isInitialized = false;

        // Define default ranking for different priorities
        this.defaultRanking = {
            quality: ['deepl', 'gpt4o', 'azure', 'google'],
            speed: ['google', 'azure', 'deepl', 'gpt4o'],
            cost: ['google', 'azure', 'deepl', 'gpt4o'],
            context: ['gpt4o', 'deepl', 'azure', 'google']
        };

        // Mock language pairs with scores for different services
        this.languagePairs = new Map([
            ['en-es', {
                source: 'en',
                target: 'es',
                services: {
                    deepl: { quality: 0.95, speed: 0.85, cost: 0.7 },
                    gpt4o: { quality: 0.93, speed: 0.6, cost: 0.4 },
                    google: { quality: 0.85, speed: 0.9, cost: 0.8 },
                    azure: { quality: 0.87, speed: 0.8, cost: 0.75 }
                }
            }],
            ['en-fr', {
                source: 'en',
                target: 'fr',
                services: {
                    deepl: { quality: 0.94, speed: 0.84, cost: 0.7 },
                    gpt4o: { quality: 0.92, speed: 0.6, cost: 0.4 },
                    google: { quality: 0.84, speed: 0.9, cost: 0.8 },
                    azure: { quality: 0.86, speed: 0.8, cost: 0.75 }
                }
            }],
            ['en-de', {
                source: 'en',
                target: 'de',
                services: {
                    deepl: { quality: 0.96, speed: 0.86, cost: 0.7 },
                    gpt4o: { quality: 0.91, speed: 0.6, cost: 0.4 },
                    google: { quality: 0.83, speed: 0.9, cost: 0.8 },
                    azure: { quality: 0.85, speed: 0.8, cost: 0.75 }
                }
            }]
        ]);

        // For language adaptation
        this.europeanLanguages = new Set(['en', 'fr', 'de', 'es', 'it']);
        this.asianLanguages = new Set(['ja', 'zh', 'ko']);
        this.adaptationLanguages = new Set(['ja', 'zh', 'ko', 'ar', 'ru']);
    }

    /**
     * Initialize the optimizer
     * 
     * @returns {Promise<void>}
     */
    async initialize() {
        this.isInitialized = true;
        return Promise.resolve();
    }

    /**
     * Get the best service for a language pair based on metrics
     * 
     * @param {string} fromLang - Source language code
     * @param {string} toLang - Target language code
     * @param {object} options - Selection options
     * @returns {string} Best service name
     */
    getBestServiceForLanguagePair(fromLang, toLang, options = {}) {
        const {
            priority = 'quality',
            serviceHealth = {},
            textLength = 0,
            hasContext = false,
            domain = 'general',
            requiresContext = false,
            userPreference = null
        } = options;

        // If user has a specific preference and service is healthy, use it
        if (userPreference && serviceHealth[userPreference]?.healthy !== false) {
            return userPreference;
        }

        // If requires context, prioritize context-aware services
        if (requiresContext || hasContext) {
            for (const service of this.defaultRanking.context) {
                if (serviceHealth[service]?.healthy !== false) {
                    return service;
                }
            }
        }

        // Get language pair
        const pairKey = `${fromLang}-${toLang}`;
        const pair = this.languagePairs.get(pairKey);

        // If pair not found, use default ranking
        if (!pair) {
            // For European languages, prefer DeepL
            if (this.europeanLanguages.has(fromLang) && this.europeanLanguages.has(toLang)) {
                if (serviceHealth.deepl?.healthy !== false) return 'deepl';
            }

            // For Asian languages or cultural adaptation, prefer GPT-4o
            if (this.adaptationLanguages.has(toLang) || this.adaptationLanguages.has(fromLang)) {
                if (serviceHealth.gpt4o?.healthy !== false) return 'gpt4o';
            }

            // Use default ranking
            for (const service of this.defaultRanking[priority]) {
                if (serviceHealth[service]?.healthy !== false) {
                    return service;
                }
            }

            // If all preferred services are unhealthy, return any healthy service
            for (const service of Object.keys(serviceHealth)) {
                if (serviceHealth[service]?.healthy !== false) {
                    return service;
                }
            }

            // If no healthy service, return default
            return 'google';
        }

        // Get services sorted by priority metric
        const sortedServices = Object.entries(pair.services)
            .sort((a, b) => b[1][priority] - a[1][priority])
            .map(([service]) => service);

        // Return first healthy service
        for (const service of sortedServices) {
            if (serviceHealth[service]?.healthy !== false) {
                return service;
            }
        }

        // Fallback to any healthy service
        for (const service of Object.keys(serviceHealth)) {
            if (serviceHealth[service]?.healthy !== false) {
                return service;
            }
        }

        // Default to Google if all else fails
        return 'google';
    }

    /**
     * Update quality score for a service and language pair
     * 
     * @param {string} service - Service name
     * @param {string} fromLang - Source language code
     * @param {string} toLang - Target language code
     * @param {number} score - Quality score
     */
    updateQualityScore(service, fromLang, toLang, score) {
        const pairKey = `${fromLang}-${toLang}`;
        const pair = this.languagePairs.get(pairKey);

        if (pair && pair.services[service]) {
            // Update with some smoothing
            const currentScore = pair.services[service].quality;
            pair.services[service].quality = currentScore * 0.9 + score * 0.1;
        }
    }
}

module.exports = MockLanguagePairOptimizer;
