/**
 * Unit tests for Translation Services
 * 
 * These tests verify the core translation functionality including:
 * - Text translation
 * - Language detection
 * - Error handling
 */

const TranslationService = require('../src/services/translationService');
const { TranslationError } = require('../src/utils/errors');

// Mock the translation clients
jest.mock('@google-cloud/translate', () => ({
  v2: {
    Translate: jest.fn().mockImplementation(() => ({
      translate: jest.fn(),
      detect: jest.fn(),
    })),
  },
}));

describe('TranslationService', () => {
  let translationService;
  let mockTranslateClient;
  
  beforeEach(() => {
    // Create a new instance of the service for each test
    translationService = new TranslationService();
    
    // Get the mock client instance
    const GoogleTranslate = require('@google-cloud/translate').v2;
    mockTranslateClient = new GoogleTranslate.Translate();
    
    // Reset all mocks
    jest.clearAllMocks();
  });
  
  describe('translateText', () => {
    it('should translate text successfully', async () => {
      // Mock the response from the translation API
      const mockTranslation = ['Hola Mundo'];
      mockTranslateClient.translate.mockResolvedValue(mockTranslation);
      
      // Call the method
      const result = await translationService.translateText(
        'Hello World',
        'en',
        'es'
      );
      
      // Verify the result
      expect(result).toBe('Hola Mundo');
      expect(mockTranslateClient.translate).toHaveBeenCalledWith(
        'Hello World',
        {
          from: 'en',
          to: 'es',
        }
      );
    });
    
    it('should handle empty text', async () => {
      const result = await translationService.translateText('', 'en', 'es');
      expect(result).toBe('');
      expect(mockTranslateClient.translate).not.toHaveBeenCalled();
    });
    
    it('should throw TranslationError when translation fails', async () => {
      // Mock a failed API call
      const error = new Error('API Error');
      mockTranslateClient.translate.mockRejectedValue(error);
      
      // Expect the method to throw
      await expect(
        translationService.translateText('Hello', 'en', 'es')
      ).rejects.toThrow(TranslationError);
    });
  });
  
  describe('detectLanguage', () => {
    it('should detect language successfully', async () => {
      // Mock the response from the detection API
      const mockDetection = [{
        language: 'en',
        confidence: 0.95,
        input: 'Hello',
      }];
      
      mockTranslateClient.detect.mockResolvedValue(mockDetection);
      
      // Call the method
      const result = await translationService.detectLanguage('Hello');
      
      // Verify the result
      expect(result).toEqual({
        language: 'en',
        confidence: 0.95,
      });
      expect(mockTranslateClient.detect).toHaveBeenCalledWith('Hello');
    });
    
    it('should handle empty text', async () => {
      const result = await translationService.detectLanguage('');
      expect(result).toBeNull();
      expect(mockTranslateClient.detect).not.toHaveBeenCalled();
    });
    
    it('should throw TranslationError when detection fails', async () => {
      // Mock a failed API call
      const error = new Error('API Error');
      mockTranslateClient.detect.mockRejectedValue(error);
      
      // Expect the method to throw
      await expect(
        translationService.detectLanguage('Hello')
      ).rejects.toThrow(TranslationError);
    });
  });
  
  describe('getSupportedLanguages', () => {
    it('should return supported languages', async () => {
      // Mock the response from the API
      const mockLanguages = [
        { code: 'en', name: 'English' },
        { code: 'es', name: 'Spanish' },
        { code: 'fr', name: 'French' },
      ];
      
      mockTranslateClient.getLanguages = jest.fn().mockResolvedValue(mockLanguages);
      
      // Call the method
      const result = await translationService.getSupportedLanguages();
      
      // Verify the result
      expect(result).toEqual(mockLanguages);
      expect(mockTranslateClient.getLanguages).toHaveBeenCalled();
    });
    
    it('should throw TranslationError when fetching languages fails', async () => {
      // Mock a failed API call
      const error = new Error('API Error');
      mockTranslateClient.getLanguages = jest.fn().mockRejectedValue(error);
      
      // Expect the method to throw
      await expect(
        translationService.getSupportedLanguages()
      ).rejects.toThrow(TranslationError);
    });
  });
  
  describe('batchTranslate', () => {
    it('should translate multiple texts', async () => {
      // Mock the response from the translation API
      const mockTranslations = [
        'Hola',
        'Mundo',
      ];
      
      mockTranslateClient.translate.mockResolvedValueOnce([mockTranslations[0]])
        .mockResolvedValueOnce([mockTranslations[1]]);
      
      // Call the method
      const texts = ['Hello', 'World'];
      const result = await translationService.batchTranslate(texts, 'en', 'es');
      
      // Verify the result
      expect(result).toEqual(mockTranslations);
      expect(mockTranslateClient.translate).toHaveBeenCalledTimes(2);
    });
    
    it('should handle empty array', async () => {
      const result = await translationService.batchTranslate([], 'en', 'es');
      expect(result).toEqual([]);
      expect(mockTranslateClient.translate).not.toHaveBeenCalled();
    });
  });
  
  describe('isSupportedLanguage', () => {
    it('should check if language is supported', async () => {
      // Mock the response from the API
      const mockLanguages = [
        { code: 'en', name: 'English' },
        { code: 'es', name: 'Spanish' },
      ];
      
      mockTranslateClient.getLanguages = jest.fn().mockResolvedValue(mockLanguages);
      
      // Test supported language
      let result = await translationService.isSupportedLanguage('es');
      expect(result).toBe(true);
      
      // Test unsupported language
      result = await translationService.isSupportedLanguage('xx');
      expect(result).toBe(false);
    });
  });
});
