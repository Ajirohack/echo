/**
 * Translator Utility Tests
 *
 * This file contains unit tests for the Translator utility.
 */

const Translator = require('./src/utils/translator');

describe('Translator Utility', () => {
  let translator;
  let mockService;

  beforeEach(() => {
    // Create a new instance for each test
    translator = new Translator.constructor();

    // Mock translation service
    mockService = {
      translate: jest.fn(),
      getSupportedLanguages: jest.fn(),
    };

    // Initialize translator with mock service
    translator.initialize(mockService);
  });

  afterEach(() => {
    // Clear all mocks after each test
    jest.clearAllMocks();
  });

  describe('Initialization', () => {
    test('should initialize with provided service', () => {
      const newTranslator = new Translator.constructor();
      newTranslator.initialize(mockService);
      expect(newTranslator.translationService).toBe(mockService);
    });
  });

  describe('translate()', () => {
    test('should translate text using the provided service', async () => {
      // Arrange
      const mockTranslation = {
        text: 'Hola, ¿cómo estás?',
        from: 'en',
        to: 'es',
      };

      mockService.translate.mockResolvedValue(mockTranslation);

      // Act
      const result = await translator.translate('Hello, how are you?', 'en', 'es');

      // Assert
      expect(mockService.translate).toHaveBeenCalledWith('Hello, how are you?', {
        from: 'en',
        to: 'es',
      });

      expect(result).toEqual({
        originalText: 'Hello, how are you?',
        translatedText: 'Hola, ¿cómo estás?',
        sourceLanguage: 'en',
        targetLanguage: 'es',
        timestamp: expect.any(String),
      });
    });

    test('should throw error when service is not initialized', async () => {
      // Arrange
      const uninitializedTranslator = new Translator.constructor();

      // Act & Assert
      await expect(uninitializedTranslator.translate('Hello', 'en', 'es')).rejects.toThrow(
        'Translation service not initialized'
      );
    });

    test('should throw error when required parameters are missing', async () => {
      // Arrange
      const testCases = [
        { text: '', sourceLang: 'en', targetLang: 'es', description: 'empty text' },
        { text: 'Hello', sourceLang: '', targetLang: 'es', description: 'empty sourceLang' },
        { text: 'Hello', sourceLang: 'en', targetLang: '', description: 'empty targetLang' },
      ];

      // Act & Assert
      for (const testCase of testCases) {
        await expect(
          translator.translate(testCase.text, testCase.sourceLang, testCase.targetLang)
        ).rejects.toThrow('Missing required parameters');
      }
    });

    test('should handle translation service errors', async () => {
      // Arrange
      const error = new Error('Translation service unavailable');
      mockService.translate.mockRejectedValue(error);

      // Act & Assert
      await expect(translator.translate('Hello', 'en', 'es')).rejects.toThrow(
        'Translation failed: Translation service unavailable'
      );
    });
  });

  describe('getSupportedLanguages()', () => {
    test('should return supported languages from the service', async () => {
      // Arrange
      const mockLanguages = [
        { code: 'en', name: 'English' },
        { code: 'es', name: 'Spanish' },
        { code: 'fr', name: 'French' },
      ];

      mockService.getSupportedLanguages.mockResolvedValue(mockLanguages);

      // Act
      const result = await translator.getSupportedLanguages();

      // Assert
      expect(mockService.getSupportedLanguages).toHaveBeenCalled();
      expect(result).toEqual(mockLanguages);
    });

    test('should throw error when service is not initialized', async () => {
      // Arrange
      const uninitializedTranslator = new Translator.constructor();

      // Act & Assert
      await expect(uninitializedTranslator.getSupportedLanguages()).rejects.toThrow(
        'Translation service not initialized'
      );
    });

    test('should handle errors when getting supported languages', async () => {
      // Arrange
      const error = new Error('Failed to fetch languages');
      mockService.getSupportedLanguages.mockRejectedValue(error);

      // Act & Assert
      await expect(translator.getSupportedLanguages()).rejects.toThrow(
        'Failed to get supported languages: Failed to fetch languages'
      );
    });
  });
});
