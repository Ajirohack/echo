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

    // Initialize language pairs from config
    this.languagePairs = new Map();
    // Add some default language pairs for testing
    this.languagePairs.set('en-es', {
      source: 'en',
      target: 'es',
      services: {
        deepl: { quality: 0.95, speed: 0.8 },
        gpt4o: { quality: 0.9, speed: 0.7 },
        ai: { quality: 0.92, speed: 0.6 },
        google: { quality: 0.85, speed: 0.9 },
        azure: { quality: 0.8, speed: 0.85 },
      },
    });
    this.europeanLanguages = new Set([
      'en',
      'es',
      'fr',
      'de',
      'it',
      'pt',
      'nl',
      'pl',
      'sv',
      'da',
      'fi',
      'no',
      'cs',
      'hu',
      'ro',
      'bg',
      'hr',
      'sk',
      'sl',
      'et',
      'lv',
      'lt',
      'mt',
      'el',
    ]);
    this.asianLanguages = new Set([
      'ja',
      'ko',
      'zh',
      'th',
      'vi',
      'id',
      'ms',
      'fil',
      'my',
      'km',
      'lo',
      'mn',
      'ne',
      'si',
      'ta',
      'te',
      'ur',
      'bn',
      'gu',
      'hi',
      'kn',
      'ml',
      'mr',
      'pa',
      'or',
    ]);
    this.adaptationLanguages = new Set([
      'ja',
      'ko',
      'zh',
      'ar',
      'he',
      'fa',
      'ur',
      'hi',
      'th',
      'vi',
    ]);

    // Default service rankings
    this.defaultRanking = {
      quality: ['deepl', 'gpt4o', 'ai', 'azure', 'google'],
      speed: ['google', 'azure', 'deepl', 'gpt4o', 'ai'],
      cost: ['google', 'azure', 'deepl', 'gpt4o', 'ai'],
      context: ['ai', 'gpt4o', 'deepl', 'azure', 'google'],
    };

    // Initialize service health with default services
    const defaultServices = ['deepl', 'gpt4o', 'google', 'azure', 'ai'];
    defaultServices.forEach((service) => {
      this.serviceHealth[service] = {
        available: true,
        responseTime: 0,
        errorRate: 0,
        lastChecked: Date.now(),
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
      serviceHealth = {},
    } = options;

    // Normalize language codes
    sourceLanguage = sourceLanguage.toLowerCase();
    targetLanguage = targetLanguage.toLowerCase();

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
    if (
      userPreference &&
      this.isServiceSupportingLanguagePair(userPreference, sourceLanguage, targetLanguage)
    ) {
      if (this.serviceHealth[userPreference]?.available !== false) {
        return userPreference;
      }
    }

    // If context awareness is required or context is provided, prefer GPT-4o
    if (requiresContext || hasContext) {
      if (
        this.isServiceSupportingLanguagePair('gpt4o', sourceLanguage, targetLanguage) &&
        this.serviceHealth['gpt4o']?.available !== false
      ) {
        return 'gpt4o';
      }
    }

    // Check if we have a configured language pair
    if (this.languagePairs.has(langPairKey)) {
      const pairConfig = this.languagePairs.get(langPairKey);
      const services = Object.keys(pairConfig.services);

      // Sort by priority
      const sortedServices = services.sort((a, b) => {
        const scoreA = pairConfig.services[a][priority] || 0;
        const scoreB = pairConfig.services[b][priority] || 0;
        return scoreB - scoreA;
      });

      // Return the first healthy service
      for (const service of sortedServices) {
        if (this.serviceHealth[service]?.available !== false) {
          return service;
        }
      }
    }

    // For European languages, prefer DeepL
    if (this.europeanLanguages.has(sourceLanguage) && this.europeanLanguages.has(targetLanguage)) {
      if (
        this.isServiceSupportingLanguagePair('deepl', sourceLanguage, targetLanguage) &&
        this.serviceHealth['deepl']?.available !== false
      ) {
        return 'deepl';
      }
    }

    // For Asian languages, prefer GPT-4o
    if (
      this.adaptationLanguages.has(sourceLanguage) ||
      this.adaptationLanguages.has(targetLanguage)
    ) {
      if (
        this.isServiceSupportingLanguagePair('gpt4o', sourceLanguage, targetLanguage) &&
        this.serviceHealth['gpt4o']?.available !== false
      ) {
        return 'gpt4o';
      }
    }

    // Use default ranking based on priority
    let ranking = this.defaultRanking[priority] || this.defaultRanking.quality;

    // If context is required, use context ranking
    if (requiresContext || hasContext) {
      ranking = this.defaultRanking.context;
    }

    for (const service of ranking) {
      if (
        this.isServiceSupportingLanguagePair(service, sourceLanguage, targetLanguage) &&
        this.serviceHealth[service]?.available !== false
      ) {
        return service;
      }
    }

    // Last resort: return any available service
    const availableServices = Object.keys(this.serviceHealth).filter(
      (service) => this.serviceHealth[service]?.available !== false
    );

    return availableServices.length > 0 ? availableServices[0] : 'google';
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
    // For now, assume all services support all languages
    // In a real implementation, this would check against actual service capabilities
    return true;
  }

  /**
   * Check if a language is European
   *
   * @param {string} languageCode - Language code to check
   * @returns {boolean} - Whether it's a European language
   */
  isEuropeanLanguage(languageCode) {
    const europeanLanguages = [
      'BG',
      'CS',
      'DA',
      'DE',
      'EL',
      'EN',
      'ES',
      'ET',
      'FI',
      'FR',
      'HU',
      'IT',
      'LT',
      'LV',
      'NL',
      'PL',
      'PT',
      'RO',
      'SK',
      'SL',
      'SV',
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
      'EN',
      'ES',
      'FR',
      'DE',
      'IT',
      'PT',
      'RU',
      'JA',
      'ZH',
      'KO',
      'AR',
      'HI',
      'BN',
      'ID',
      'TR',
      'VI',
      'TH',
      'NL',
      'PL',
      'SV',
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
      deepl: 0.9,
      gpt4o: 0.85,
      google: 0.8,
      azure: 0.78,
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
        lastChecked: Date.now(),
      };
    }

    this.serviceHealth[service] = {
      ...this.serviceHealth[service],
      ...healthData,
      lastChecked: Date.now(),
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
    const langPairKey = `${sourceLanguage}-${targetLanguage}`;

    // Create language pair if it doesn't exist
    if (!this.languagePairs.has(langPairKey)) {
      this.languagePairs.set(langPairKey, {
        source: sourceLanguage,
        target: targetLanguage,
        services: {},
      });
    }

    const pairConfig = this.languagePairs.get(langPairKey);

    // Initialize service config if it doesn't exist
    if (!pairConfig.services[service]) {
      pairConfig.services[service] = {
        quality: 0.7,
        speed: 0.7,
        cost: 0.7,
      };
    }

    // Update quality score with smoothing
    const currentScore = pairConfig.services[service].quality;
    const alpha = 0.1; // Weight for new observation
    pairConfig.services[service].quality = (1 - alpha) * currentScore + alpha * score;

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
