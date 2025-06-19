/**
 * Translation Service
 * 
 * This module provides translation functionality using the configured translation service.
 */

class Translator {
  constructor() {
    this.translationService = null;
  }

  /**
   * Initialize the translator with a specific service
   * @param {Object} service - The translation service to use
   */
  initialize(service) {
    this.translationService = service;
  }

  /**
   * Translate text from source language to target language
   * @param {string} text - The text to translate
   * @param {string} sourceLang - Source language code (e.g., 'en')
   * @param {string} targetLang - Target language code (e.g., 'es')
   * @returns {Promise<Object>} Translation result
   */
  async translate(text, sourceLang, targetLang) {
    if (!this.translationService) {
      throw new Error('Translation service not initialized');
    }

    if (!text || !sourceLang || !targetLang) {
      throw new Error('Missing required parameters');
    }

    try {
      const result = await this.translationService.translate(text, {
        from: sourceLang,
        to: targetLang,
      });

      return {
        originalText: text,
        translatedText: result.text,
        sourceLanguage: sourceLang,
        targetLanguage: targetLang,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Translation error:', error);
      throw new Error(`Translation failed: ${error.message}`);
    }
  }

  /**
   * Get a list of supported languages
   * @returns {Promise<Array>} List of supported languages
   */
  async getSupportedLanguages() {
    if (!this.translationService) {
      throw new Error('Translation service not initialized');
    }

    try {
      return await this.translationService.getSupportedLanguages();
    } catch (error) {
      console.error('Error getting supported languages:', error);
      throw new Error(`Failed to get supported languages: ${error.message}`);
    }
  }
}

// Export a singleton instance
const translator = new Translator();
module.exports = translator;
