/**
 * Mock translation service for testing
 */
class MockTranslationService {
  constructor() {
    this.translations = {
      'en': {
        'Hello': {
          'es': 'Hola',
          'fr': 'Bonjour',
          'de': 'Hallo'
        },
        'Goodbye': {
          'es': 'Adiós',
          'fr': 'Au revoir',
          'de': 'Auf Wiedersehen'
        },
        'How are you?': {
          'es': '¿Cómo estás?',
          'fr': 'Comment ça va?',
          'de': 'Wie geht es dir?'
        }
      }
    };
  }

  /**
   * Translate text from source to target language
   * @param {string} text - Text to translate
   * @param {string} sourceLang - Source language code
   * @param {string} targetLang - Target language code
   * @returns {Promise<string>} Translated text
   */
  async translate(text, sourceLang, targetLang) {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Check if we have a translation
    if (this.translations[sourceLang]?.[text]?.[targetLang]) {
      return this.translations[sourceLang][text][targetLang];
    }
    
    // Fallback to mock translation
    return `[${targetLang.toUpperCase()}] ${text}`;
  }

  /**
   * Detect language of the given text
   * @param {string} text - Text to detect language
   * @returns {Promise<{language: string, score: number}>} Detection result
   */
  async detectLanguage(text) {
    // Simple language detection based on text content
    const enWords = ['the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'I'];
    const esWords = ['el', 'la', 'los', 'las', 'de', 'que', 'y', 'a', 'en', 'un'];
    const frWords = ['le', 'la', 'les', 'de', 'et', 'à', 'un', 'une', 'des', 'que'];
    
    const words = text.toLowerCase().split(/\s+/);
    const enScore = words.filter(word => enWords.includes(word)).length;
    const esScore = words.filter(word => esWords.includes(word)).length;
    const frScore = words.filter(word => frWords.includes(word)).length;
    
    const scores = [
      { language: 'en', score: enScore },
      { language: 'es', score: esScore },
      { language: 'fr', score: frScore },
    ];
    
    const bestMatch = scores.reduce((best, current) => 
      (current.score > best.score) ? current : best, 
      { language: 'en', score: 0 }
    );
    
    return {
      language: bestMatch.language,
      score: bestMatch.score / words.length
    };
  }

  /**
   * Get supported languages
   * @returns {Promise<Array<{code: string, name: string}>>} List of supported languages
   */
  async getSupportedLanguages() {
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
}

module.exports = MockTranslationService;
