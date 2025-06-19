/**
 * Language Pair Optimizer
 * Determines the optimal translation service for a given language pair based on:
 * - Service capabilities and language support
 * - Quality metrics for specific language pairs
 * - Domain/context requirements
 * - Current service health and availability
 * - User preferences
 */

const fs = require('fs');
const path = require('path');
const languagePairsConfig = require('../../../config/language-pairs.json');

class LanguagePairOptimizer {
    constructor(translationManager) {
        this.translationManager = translationManager;
        this.languagePairsConfig = languagePairsConfig;
        this.serviceHealth = {};
        this.qualityMatrix = {};

        // Initialize service health
        Object.keys(this.translationManager.services).forEach(service => {
            this.serviceHealth[service] = {
                available: true,
                responseTime: 0,
                errorRate: 0,
                lastChecked: Date.now()
            };
        });

        // Load quality matrix if exists
        this.loadQualityMatrix();
    }

    /**
     * Determine the best translation service for a language pair
     * 
     * @param {string} sourceLanguage - Source language code
     * @param {string} targetLanguage - Target language code
     * @param {object} options - Additional options for service selection
     * @returns {string} - The name of the best service for this language pair
     */
    getBestServiceForLanguagePair(sourceLanguage, targetLanguage, options = {}) {
        const {
            domain = 'general',
            requiresContext = false,
            userPreference = null,
            priority = 'quality', // 'quality', 'speed', 'cost'
            textLength = 0,
            hasContext = false,
            serviceHealth = {}
        } = options;

        // Normalize language codes
        sourceLanguage = sourceLanguage.toUpperCase();
        targetLanguage = targetLanguage.toUpperCase();

        // Create language pair key
        const langPairKey = `${sourceLanguage}-${targetLanguage}`;

        // Update service health if provided
        if (Object.keys(serviceHealth).length > 0) {
            Object.entries(serviceHealth).forEach(([service, health]) => {
                if (this.serviceHealth[service]) {
                    this.serviceHealth[service].available = health.healthy !== false;
                }
            });
        }

        // Check if user has a preferred service
        if (userPreference && this.isServiceSupportingLanguagePair(userPreference, sourceLanguage, targetLanguage)) {
            if (this.serviceHealth[userPreference]?.available !== false) {
                return userPreference;
            }
        }

        // If context awareness is required or context is provided, prefer GPT-4o
        if (requiresContext || hasContext) {
            if (this.isServiceSupportingLanguagePair('gpt4o', sourceLanguage, targetLanguage) &&
                this.serviceHealth['gpt4o']?.available !== false) {
                return 'gpt4o';
            }
        }

        // For very short text (< 50 chars), prefer faster services
        if (textLength > 0 && textLength < 50 && priority !== 'quality') {
            if (this.isServiceSupportingLanguagePair('google', sourceLanguage, targetLanguage) &&
                this.serviceHealth['google']?.available !== false) {
                return 'google';
            }
        }

        // For long text (> 1000 chars) in quality mode, prefer DeepL or GPT-4o
        if (textLength > 1000 && priority === 'quality') {
            // European languages -> DeepL
            if (this.isEuropeanLanguage(sourceLanguage) && this.isEuropeanLanguage(targetLanguage)) {
                if (this.isServiceSupportingLanguagePair('deepl', sourceLanguage, targetLanguage) &&
                    this.serviceHealth['deepl']?.available !== false) {
                    return 'deepl';
                }
            }

            // Non-European -> GPT-4o
            if (this.isServiceSupportingLanguagePair('gpt4o', sourceLanguage, targetLanguage) &&
                this.serviceHealth['gpt4o']?.available !== false) {
                return 'gpt4o';
            }
        }

        // Check optimized routing map for domain-specific service
        if (this.languagePairsConfig.optimizedRoutingMap[domain]) {
            const domainMap = this.languagePairsConfig.optimizedRoutingMap[domain];

            // Check if there's a specific mapping for this language pair
            if (domainMap.pairs[langPairKey]) {
                const recommendedService = domainMap.pairs[langPairKey];
                if (this.serviceHealth[recommendedService]?.available !== false) {
                    return recommendedService;
                }
            }

            // If no specific pair mapping, use the domain default
            if (domainMap.default && this.serviceHealth[domainMap.default]?.available !== false &&
                this.isServiceSupportingLanguagePair(domainMap.default, sourceLanguage, targetLanguage)) {
                return domainMap.default;
            }
        }

        // For European languages, prefer DeepL
        if (this.isEuropeanLanguage(sourceLanguage) && this.isEuropeanLanguage(targetLanguage)) {
            if (this.isServiceSupportingLanguagePair('deepl', sourceLanguage, targetLanguage) &&
                this.serviceHealth['deepl']?.available !== false) {
                return 'deepl';
            }
        }

        // For rare or uncommon languages, prefer GPT-4o
        if (this.isRareLanguage(sourceLanguage) || this.isRareLanguage(targetLanguage)) {
            if (this.isServiceSupportingLanguagePair('gpt4o', sourceLanguage, targetLanguage) &&
                this.serviceHealth['gpt4o']?.available !== false) {
                return 'gpt4o';
            }
        }

        // Priority-based selection
        if (priority === 'speed') {
            // For speed, prioritize Google > Azure > DeepL > GPT-4o
            const speedPriority = ['google', 'azure', 'deepl', 'gpt4o'];
            for (const service of speedPriority) {
                if (this.isServiceSupportingLanguagePair(service, sourceLanguage, targetLanguage) &&
                    this.serviceHealth[service]?.available !== false) {
                    return service;
                }
            }
        } else if (priority === 'cost') {
            // For cost, prioritize Google > Azure > DeepL > GPT-4o
            const costPriority = ['google', 'azure', 'deepl', 'gpt4o'];
            for (const service of costPriority) {
                if (this.isServiceSupportingLanguagePair(service, sourceLanguage, targetLanguage) &&
                    this.serviceHealth[service]?.available !== false) {
                    return service;
                }
            }
        }

        // Check all available services in order of priority
        const availableServices = Object.keys(this.translationManager.services)
            .filter(service => this.serviceHealth[service].available)
            .filter(service => this.isServiceSupportingLanguagePair(service, sourceLanguage, targetLanguage))
            .sort((a, b) => {
                // First sort by quality score for this language pair if available
                const qualityScoreA = this.getQualityScore(a, sourceLanguage, targetLanguage);
                const qualityScoreB = this.getQualityScore(b, sourceLanguage, targetLanguage);

                if (qualityScoreA !== qualityScoreB) {
                    return qualityScoreB - qualityScoreA;
                }

                // Then sort by priority defined in config
                return this.translationManager.serviceConfig[a].priority -
                    this.translationManager.serviceConfig[b].priority;
            });

        // Return the best available service or default to Google (most language coverage)
        if (availableServices.length > 0) {
            return availableServices[0];
        }

        // Last resort: use Google Translate if available (best coverage)
        if (this.serviceHealth['google'].available) {
            return 'google';
        }

        // If no service is available or supports the language pair, return null
        return null;
    }

    /**
     * Check if a service supports a specific language pair
     * 
     * @param {string} service - Service name
     * @param {string} sourceLanguage - Source language code
     * @param {string} targetLanguage - Target language code
     * @returns {boolean} - Whether service supports this language pair
     */
    isServiceSupportingLanguagePair(service, sourceLanguage, targetLanguage) {
        const serviceConfig = this.languagePairsConfig.supportedLanguages[service];

        if (!serviceConfig) return false;

        // Special case for GPT-4o which supports all languages
        if (service === 'gpt4o') return true;

        // Check if source language is supported
        const supportsSource = serviceConfig.source.includes(sourceLanguage) ||
            serviceConfig.source.includes('ALL') ||
            serviceConfig.source.includes('AUTO');

        // Check if target language is supported
        const supportsTarget = serviceConfig.target.includes(targetLanguage) ||
            serviceConfig.target.includes('ALL');

        return supportsSource && supportsTarget;
    }

    /**
     * Check if a language is European
     * 
     * @param {string} languageCode - Language code to check
     * @returns {boolean} - Whether it's a European language
     */
    isEuropeanLanguage(languageCode) {
        const europeanLanguages = [
            'BG', 'CS', 'DA', 'DE', 'EL', 'EN', 'ES', 'ET', 'FI', 'FR',
            'HU', 'IT', 'LT', 'LV', 'NL', 'PL', 'PT', 'RO', 'SK', 'SL', 'SV'
        ];

        return europeanLanguages.includes(languageCode);
    }

    /**
     * Check if a language is considered rare/uncommon
     * 
     * @param {string} languageCode - Language code to check
     * @returns {boolean} - Whether it's a rare language
     */
    isRareLanguage(languageCode) {
        const commonLanguages = [
            'EN', 'ES', 'FR', 'DE', 'IT', 'PT', 'RU', 'JA', 'ZH', 'KO',
            'AR', 'HI', 'BN', 'ID', 'TR', 'VI', 'TH', 'NL', 'PL', 'SV'
        ];

        return !commonLanguages.includes(languageCode);
    }

    /**
     * Get quality score for a service and language pair
     * 
     * @param {string} service - Service name
     * @param {string} sourceLanguage - Source language code
     * @param {string} targetLanguage - Target language code
     * @returns {number} - Quality score (0-1)
     */
    getQualityScore(service, sourceLanguage, targetLanguage) {
        const langPairKey = `${sourceLanguage}-${targetLanguage}`;

        if (this.qualityMatrix[service] && this.qualityMatrix[service][langPairKey]) {
            return this.qualityMatrix[service][langPairKey];
        }

        // Default quality scores based on general performance
        const defaultScores = {
            'deepl': 0.9,
            'gpt4o': 0.85,
            'google': 0.8,
            'azure': 0.78
        };

        return defaultScores[service] || 0.7;
    }

    /**
     * Update service health status
     * 
     * @param {string} service - Service name
     * @param {object} healthData - Health data including availability and metrics
     */
    updateServiceHealth(service, healthData) {
        if (!this.serviceHealth[service]) {
            this.serviceHealth[service] = {
                available: true,
                responseTime: 0,
                errorRate: 0,
                lastChecked: Date.now()
            };
        }

        this.serviceHealth[service] = {
            ...this.serviceHealth[service],
            ...healthData,
            lastChecked: Date.now()
        };

        console.log(`Updated health for ${service}:`, this.serviceHealth[service]);
    }

    /**
     * Update quality score for a service and language pair
     * 
     * @param {string} service - Service name
     * @param {string} sourceLanguage - Source language code
     * @param {string} targetLanguage - Target language code
     * @param {number} score - Quality score (0-1)
     */
    updateQualityScore(service, sourceLanguage, targetLanguage, score) {
        if (!this.qualityMatrix[service]) {
            this.qualityMatrix[service] = {};
        }

        const langPairKey = `${sourceLanguage}-${targetLanguage}`;

        // Use exponential moving average to update quality score
        const currentScore = this.qualityMatrix[service][langPairKey] || 0.7;
        const alpha = 0.1; // Weight for new observation

        this.qualityMatrix[service][langPairKey] = (1 - alpha) * currentScore + alpha * score;

        // Save quality matrix to disk
        this.saveQualityMatrix();
    }

    /**
     * Load quality matrix from disk
     */
    loadQualityMatrix() {
        try {
            const matrixPath = path.join(__dirname, '../../../config/quality-matrix.json');

            if (fs.existsSync(matrixPath)) {
                const matrixData = fs.readFileSync(matrixPath, 'utf8');
                this.qualityMatrix = JSON.parse(matrixData);
            } else {
                this.qualityMatrix = {};
            }
        } catch (error) {
            console.error('Error loading quality matrix:', error);
            this.qualityMatrix = {};
        }
    }

    /**
     * Save quality matrix to disk
     */
    saveQualityMatrix() {
        try {
            const matrixPath = path.join(__dirname, '../../../config/quality-matrix.json');
            fs.writeFileSync(matrixPath, JSON.stringify(this.qualityMatrix, null, 2), 'utf8');
        } catch (error) {
            console.error('Error saving quality matrix:', error);
        }
    }
}

module.exports = LanguagePairOptimizer;
