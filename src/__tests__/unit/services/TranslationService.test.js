const path = require('path');

// Resolve logger module path to mock out filesystem/electron usage
const loggerModulePath = path.resolve(__dirname, '../../../utils/logger.js');

// Mock logger to avoid touching filesystem/electron app paths
jest.doMock(loggerModulePath, () => ({
  log: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

const TranslationService = require('../../../services/translation/translation-service');

describe('TranslationService', () => {
  let translationService;

  beforeEach(() => {
    // Create a new instance of the service for each test WITHOUT apiKey to avoid init
    translationService = new TranslationService({
      defaultSourceLanguage: 'en',
      defaultTargetLanguage: 'es',
    });

    // Inject a stub DeepL translator to avoid real API and initialization
    translationService.deepLTranslator = {
      translate: jest.fn(async (text, { from, to }) => {
        if (!text) return { translatedText: '' };
        const normalized = String(text).toLowerCase();
        if (from === 'en' && to === 'es') {
          if (normalized === 'hello') return { translatedText: 'hola' };
        }
        if (from === 'en' && to === 'fr') {
          if (normalized === 'hello') return { translatedText: 'bonjour' };
        }
        return { translatedText: `[${from}->${to}] ${text}` };
      }),
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with the provided configuration', () => {
      expect(translationService.apiKey).toBeUndefined();
      expect(translationService.defaultSourceLanguage).toBe('en');
      expect(translationService.defaultTargetLanguage).toBe('es');
    });

    it('should use default values when not provided', () => {
      const service = new TranslationService({});
      expect(service.defaultSourceLanguage).toBe('en');
      expect(service.defaultTargetLanguage).toBe('es');
    });
  });

  describe('translate', () => {
    it('should return empty string for empty input', async () => {
      const result = await translationService.translate('');
      expect(result).toBe('');
    });

    it('should use default languages when not provided', async () => {
      const result = await translationService.translate('Hello');
      expect(result).toBe('hola'); // Default mock translation for 'Hello' in en->es
    });

    it('should use provided languages when specified', async () => {
      const result = await translationService.translate('Hello', 'en', 'fr');
      expect(result).toBe('bonjour'); // Default mock translation for 'Hello' in en->fr
    });

    it('should return the text with language codes if translation not found in mock', async () => {
      const result = await translationService.translate('Unknown text', 'en', 'es');
      expect(result).toBe('[en->es] Unknown text');
    });
  });

  // Legacy tests for an internal mockTranslate helper that no longer exists
  describe.skip('mockTranslate', () => {
    it('should return correct mock translations', async () => {
      // Test some common phrases
      expect(await translationService.mockTranslate('hello', 'en', 'es')).toBe('hola');
      expect(await translationService.mockTranslate('goodbye', 'en', 'es')).toBe('adiós');
      expect(await translationService.mockTranslate('hello', 'en', 'fr')).toBe('bonjour');
      expect(await translationService.mockTranslate('goodbye', 'en', 'fr')).toBe('au revoir');
    });

    it('should handle case-insensitive matching', async () => {
      expect(await translationService.mockTranslate('HELLO', 'en', 'es')).toBe('hola');
      expect(await translationService.mockTranslate('Hello', 'en', 'es')).toBe('hola');
    });
  });
});
