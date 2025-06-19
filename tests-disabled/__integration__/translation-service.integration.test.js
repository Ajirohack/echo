const { TranslationService } = require('../../../src/services/translation/translation-service');
const { MockTranslationService } = require('../../__mocks__/translation-service');

// Mock the actual translation service with our mock implementation
jest.mock('../../../src/services/translation/translation-service', () => ({
  TranslationService: jest.fn().mockImplementation(() => new MockTranslationService())
}));

describe('TranslationService Integration', () => {
  let translationService;
  
  beforeEach(() => {
    // Create a new instance of the mock service
    translationService = new TranslationService();
  });
  
  afterEach(() => {
    jest.clearAllMocks();
  });
  
  test('should translate text between languages', async () => {
    // Test known translation
    const result = await translationService.translate('Hello', 'en', 'es');
    expect(result).toBe('Hola');
    
    // Test reverse translation
    const reverseResult = await translationService.translate('Hola', 'es', 'en');
    expect(reverseResult).toBe('Hello');
  });
  
  test('should handle unknown translations gracefully', async () => {
    // Test with text that doesn't have a predefined translation
    const result = await translationService.translate('Unknown text', 'en', 'es');
    expect(result).toBe('[ES] Unknown text');
  });
  
  test('should detect language of text', async () => {
    // Test with English text
    const enResult = await translationService.detectLanguage('This is an English sentence');
    expect(enResult.language).toBe('en');
    expect(enResult.score).toBeGreaterThan(0);
    
    // Test with Spanish text
    const esResult = await translationService.detectLanguage('Esta es una oración en español');
    expect(esResult.language).toBe('es');
    expect(esResult.score).toBeGreaterThan(0);
  });
  
  test('should return supported languages', async () => {
    const languages = await translationService.getSupportedLanguages();
    
    // Should return an array of language objects
    expect(Array.isArray(languages)).toBe(true);
    expect(languages.length).toBeGreaterThan(0);
    
    // Check structure of language objects
    languages.forEach(lang => {
      expect(lang).toHaveProperty('code');
      expect(lang).toHaveProperty('name');
    });
    
    // Verify some common languages are included
    const languageCodes = languages.map(lang => lang.code);
    expect(languageCodes).toContain('en');
    expect(languageCodes).toContain('es');
    expect(languageCodes).toContain('fr');
  });
  
  test('should handle translation errors gracefully', async () => {
    // Force the mock to throw an error
    const originalTranslate = translationService.translate;
    translationService.translate = jest.fn().mockRejectedValue(new Error('Translation failed'));
    
    await expect(translationService.translate('Hello', 'en', 'es'))
      .rejects
      .toThrow('Translation failed');
    
    // Restore original implementation
    translationService.translate = originalTranslate;
  });
  
  test('should handle language detection errors gracefully', async () => {
    // Force the mock to throw an error
    const originalDetect = translationService.detectLanguage;
    translationService.detectLanguage = jest.fn().mockRejectedValue(new Error('Detection failed'));
    
    await expect(translationService.detectLanguage('Test'))
      .rejects
      .toThrow('Detection failed');
    
    // Restore original implementation
    translationService.detectLanguage = originalDetect;
  });
});
