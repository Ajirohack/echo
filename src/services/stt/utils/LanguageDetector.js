const cld = require('cld');
const franc = require('franc');
const { v4: uuidv4 } = require('uuid');
const logger = require('../../../utils/logger');

/**
 * LanguageDetector provides language detection functionality using multiple algorithms
 * and combines their results for better accuracy.
 */
class LanguageDetector {
  constructor(config = {}) {
    this.config = {
      // Minimum text length to attempt detection
      minLength: 10,
      // Minimum confidence threshold (0-1)
      minConfidence: 0.1,
      // List of supported languages (ISO 639-1/2/3 codes)
      supportedLanguages: [
        'af', 'am', 'ar', 'az', 'be', 'bg', 'bn', 'bs', 'ca', 'ceb', 'co', 'cs', 'cy', 'da', 'de',
        'el', 'en', 'eo', 'es', 'et', 'eu', 'fa', 'fi', 'fr', 'fy', 'ga', 'gd', 'gl', 'gu', 'ha',
        'haw', 'hi', 'hmn', 'hr', 'ht', 'hu', 'hy', 'id', 'ig', 'is', 'it', 'iw', 'ja', 'jw', 'ka',
        'kk', 'km', 'kn', 'ko', 'ku', 'ky', 'la', 'lb', 'lo', 'lt', 'lv', 'mg', 'mi', 'mk', 'ml',
        'mn', 'mr', 'ms', 'mt', 'my', 'ne', 'nl', 'no', 'ny', 'pa', 'pl', 'ps', 'pt', 'ro', 'ru',
        'sd', 'si', 'sk', 'sl', 'sm', 'sn', 'so', 'sq', 'sr', 'st', 'su', 'sv', 'sw', 'ta', 'te',
        'tg', 'th', 'tl', 'tr', 'uk', 'ur', 'uz', 'vi', 'xh', 'yi', 'yo', 'zh', 'zu'
      ],
      // Weights for different detection methods (sum should be 1.0)
      methodWeights: {
        cld: 0.5,    // Compact Language Detector (Google)
        franc: 0.5   // Franc (based on trigrams)
      },
      ...config
    };
  }

  /**
   * Detect the language of the given text
   * @param {string} text - The text to analyze
   * @param {Object} options - Detection options
   * @returns {Promise<Object>} Detection result
   */
  async detect(text, options = {}) {
    const requestId = options.requestId || uuidv4();
    const minConfidence = options.minConfidence || this.config.minConfidence;
    const minLength = options.minLength || this.config.minLength;
    
    // Clean and validate the input text
    const cleanText = this._cleanText(text);
    
    // If text is too short, return unknown
    if (cleanText.length < minLength) {
      return {
        language: 'un',
        confidence: 0,
        isReliable: false,
        textLength: cleanText.length,
        requestId,
        method: 'none',
        alternatives: []
      };
    }

    try {
      // Run all detection methods in parallel
      const [cldResult, francResult] = await Promise.all([
        this._detectWithCLD(cleanText, options),
        this._detectWithFranc(cleanText, options)
      ]);

      // Combine results using weighted scores
      const combinedResults = this._combineResults([
        { ...cldResult, weight: this.config.methodWeights.cld },
        { ...francResult, weight: this.config.methodWeights.franc }
      ]);

      // Get the top result
      const topResult = combinedResults[0] || { language: 'un', confidence: 0 };
      
      // Filter out low-confidence results
      const filteredResults = combinedResults.filter(r => r.confidence >= minConfidence);
      
      // If no results meet the confidence threshold, return unknown
      if (filteredResults.length === 0) {
        return {
          language: 'un',
          confidence: 0,
          isReliable: false,
          textLength: cleanText.length,
          requestId,
          method: 'combined',
          alternatives: []
        };
      }

      // Return the top result with alternatives
      return {
        language: filteredResults[0].language,
        confidence: filteredResults[0].confidence,
        isReliable: filteredResults[0].confidence >= 0.8, // Arbitrary threshold for reliability
        textLength: cleanText.length,
        requestId,
        method: 'combined',
        alternatives: filteredResults.slice(1).map(r => ({
          language: r.language,
          confidence: r.confidence
        }))
      };
    } catch (error) {
      logger.error('Language detection failed:', error);
      return {
        language: 'un',
        confidence: 0,
        isReliable: false,
        textLength: cleanText.length,
        requestId,
        method: 'error',
        error: error.message,
        alternatives: []
      };
    }
  }

  /**
   * Detect language using Compact Language Detector (Google's CLD)
   * @private
   */
  async _detectWithCLD(text, options = {}) {
    try {
      const result = await new Promise((resolve, reject) => {
        cld.detect(text, (err, result) => {
          if (err) return reject(err);
          resolve(result);
        });
      });

      // Map CLD's language codes to ISO 639-1
      const language = this._normalizeLanguageCode(result.languages[0].code);
      const confidence = result.languages[0].percent / 100;
      
      return {
        language,
        confidence,
        method: 'cld',
        raw: result
      };
    } catch (error) {
      logger.warn('CLD detection failed:', error);
      return {
        language: 'un',
        confidence: 0,
        method: 'cld',
        error: error.message
      };
    }
  }

  /**
   * Detect language using Franc
   * @private
   */
  async _detectWithFranc(text, options = {}) {
    try {
      const result = franc.all(text, { only: this.config.supportedLanguages });
      
      if (!result || result.length === 0) {
        return {
          language: 'un',
          confidence: 0,
          method: 'franc',
          error: 'No language detected'
        };
      }
      
      // Franc returns results sorted by confidence (highest first)
      const topResult = result[0];
      const language = this._normalizeLanguageCode(topResult[0]);
      const confidence = topResult[1]; // Franc returns a score between 0 and 1
      
      return {
        language,
        confidence,
        method: 'franc',
        raw: result
      };
    } catch (error) {
      logger.warn('Franc detection failed:', error);
      return {
        language: 'un',
        confidence: 0,
        method: 'franc',
        error: error.message
      };
    }
  }

  /**
   * Combine results from multiple detection methods
   * @private
   */
  _combineResults(results) {
    const scores = {};
    const weights = {};
    
    // Calculate weighted scores for each language
    for (const result of results) {
      if (result.language === 'un' || result.confidence <= 0) continue;
      
      const lang = result.language;
      const score = result.confidence * (result.weight || 1);
      
      if (!scores[lang]) {
        scores[lang] = 0;
        weights[lang] = 0;
      }
      
      scores[lang] += score;
      weights[lang] += (result.weight || 1);
    }
    
    // Normalize scores and create result objects
    const combined = Object.entries(scores).map(([language, score]) => {
      const weightSum = weights[language] || 1;
      const confidence = Math.min(1, score / weightSum); // Ensure confidence doesn't exceed 1
      
      return {
        language,
        confidence: parseFloat(confidence.toFixed(4)),
        methods: results
          .filter(r => r.language === language)
          .map(r => ({
            method: r.method,
            confidence: r.confidence,
            weight: r.weight || 0
          }))
      };
    });
    
    // Sort by confidence (descending)
    return combined.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Normalize language code to ISO 639-1
   * @private
   */
  _normalizeLanguageCode(code) {
    if (!code) return 'un';
    
    // Convert to lowercase and remove any region code
    const normalized = code.toLowerCase().split('-')[0].split('_')[0];
    
    // Map known non-standard codes
    const codeMap = {
      'iw': 'he',   // Hebrew
      'jw': 'jv',   // Javanese
      'tl': 'fil',  // Filipino
      'in': 'id',   // Indonesian
      'ji': 'yi',   // Yiddish
      'zh-cn': 'zh', // Chinese (Simplified)
      'zh-tw': 'zh'  // Chinese (Traditional)
    };
    
    return codeMap[normalized] || normalized;
  }

  /**
   * Clean and preprocess text before language detection
   * @private
   */
  _cleanText(text) {
    if (!text || typeof text !== 'string') return '';
    
    // Remove URLs, email addresses, and other noise
    let clean = text
      .replace(/https?:\/\/[^\s]+/g, '')  // URLs
      .replace(/[\w.-]+@[\w.-]+\.[a-z]{2,}/gi, '')  // Email addresses
      .replace(/[\u2018\u2019\u201C\u201D\u201E\u201F\u2033\u2036\u275B\u275C\u275D\u275E\u276E\u276F\uFF02\uFF07]+/g, '')  // Smart quotes
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')  // Remove punctuation but keep letters, numbers, and whitespace
      .replace(/\s+/g, ' ')  // Normalize whitespace
      .trim();
    
    return clean;
  }
}

module.exports = LanguageDetector;
