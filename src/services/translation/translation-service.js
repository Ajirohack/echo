const DeepLTranslator = require('./deepl');
const logger = require('../../utils/logger');

/**
 * Translation service for handling text translations between languages
 */
class TranslationService {
  /**
   * Create a new TranslationService instance
   * @param {Object} options - Configuration options
   * @param {string} [options.apiKey] - API key for the translation service
   * @param {string} [options.defaultSourceLanguage='en'] - Default source language
   * @param {string} [options.defaultTargetLanguage='es'] - Default target language
   */
  constructor(options = {}) {
    this.apiKey = options.apiKey;
    this.defaultSourceLanguage = options.defaultSourceLanguage || 'en';
    this.defaultTargetLanguage = options.defaultTargetLanguage || 'es';

    // Initialize DeepL translator if API key is provided
    if (this.apiKey) {
      this.deepLTranslator = new DeepLTranslator(this.apiKey);
      this.deepLTranslator.initialize().catch((error) => {
        logger.error('Failed to initialize DeepL translator:', error);
      });
    }
  }

  /**
   * Translate text from source to target language
   * @param {string} text - Text to translate
   * @param {string} [sourceLang] - Source language code (defaults to defaultSourceLanguage)
   * @param {string} [targetLang] - Target language code (defaults to defaultTargetLanguage)
   * @returns {Promise<string>} Translated text
   */
  async translate(text, sourceLang, targetLang) {
    if (!text) return '';

    const source = sourceLang || this.defaultSourceLanguage;
    const target = targetLang || this.defaultTargetLanguage;

    try {
      // Use DeepL translator if available
      if (this.deepLTranslator) {
        const result = await this.deepLTranslator.translate(text, {
          from: source === 'auto' ? 'auto' : source,
          to: target,
        });

        logger.info(`Translation completed: ${source} -> ${target}`);
        return result.translatedText;
      }

      // Fallback error if no translator is configured
      throw new Error('No translation service configured. Please provide a valid API key.');
    } catch (error) {
      logger.error('Translation failed:', error);
      throw new Error(`Translation failed: ${error.message}`);
    }
  }

  /**
   * Get a list of supported languages
   * @returns {Promise<Array<{code: string, name: string}>>} List of supported languages
   */
  async getSupportedLanguages() {
    // In a real implementation, this would fetch from an API
    return [
      { code: 'en', name: 'English' },
      { code: 'es', name: 'Spanish' },
      { code: 'fr', name: 'French' },
      { code: 'de', name: 'German' },
      { code: 'it', name: 'Italian' },
      { code: 'pt', name: 'Portuguese' },
      { code: 'ru', name: 'Russian' },
      { code: 'zh', name: 'Chinese' },
      { code: 'ja', name: 'Japanese' },
      { code: 'ko', name: 'Korean' },
    ];
  }

  /**
   * Detect the language of the given text
   * @param {string} text - Text to detect language for
   * @returns {Promise<{language: string, score: number}>} Detection result
   */
  async detectLanguage(text) {
    // Simple language detection based on common words
    const languageScores = {
      en: ['the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'I'],
      es: ['el', 'la', 'los', 'las', 'de', 'que', 'y', 'a', 'en', 'un'],
      fr: ['le', 'la', 'les', 'de', 'et', 'à', 'un', 'une', 'des', 'que'],
      de: ['der', 'die', 'das', 'und', 'in', 'den', 'von', 'zu', 'das', 'mit'],
      it: ['il', 'la', 'le', 'di', 'e', 'a', 'in', 'che', 'un', 'per'],
    };

    const words = text.toLowerCase().split(/\s+/);
    let bestMatch = { language: 'en', score: 0 };

    for (const [lang, commonWords] of Object.entries(languageScores)) {
      const score = words.filter((word) => commonWords.includes(word)).length;
      if (score > bestMatch.score) {
        bestMatch = { language: lang, score };
      }
    }

    return {
      language: bestMatch.language,
      score: bestMatch.score / words.length,
    };
  }
}

module.exports = TranslationService;
