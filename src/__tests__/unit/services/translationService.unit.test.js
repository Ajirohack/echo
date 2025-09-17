jest.mock('@/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

jest.mock('@google-cloud/translate');

const TranslationService = require('@/services/translation/translation-service');
const { TranslationError } = require('@/errors/translations');

// Legacy suite currently skipped
describe.skip('TranslationService', () => {
  let service;
  let mockClient;

  beforeEach(() => {
    service = new TranslationService({ apiKey: 'test-key' });
    mockClient = {
      translate: jest.fn((text, options) =>
        Promise.resolve([`${text} translated`, options.target])
      ),
      detect: jest.fn((text) => Promise.resolve([{ language: 'en' }])),
      getLanguages: jest.fn(() =>
        Promise.resolve([[{ code: 'en' }, { code: 'es' }, { code: 'fr' }]])
      ),
      batchTranslate: jest.fn((texts, target) =>
        Promise.resolve([texts.map((t) => `${t} translated to ${target}`)])
      ),
    };

    // Inject mock client into service if applicable
    service.client = mockClient;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('translateText', () => {
    it('should translate text successfully', async () => {
      const result = await service.translate('Hello', 'en', 'es');
      expect(result).toBe('Hello translated');
      expect(mockClient.translate).toHaveBeenCalledWith('Hello', { from: 'en', to: 'es' });
    });

    it('should handle errors gracefully', async () => {
      mockClient.translate.mockRejectedValueOnce(new Error('Translation failed'));
      await expect(service.translate('Hello', 'en', 'es')).rejects.toThrow(TranslationError);
    });
  });

  describe('detectLanguage', () => {
    it('should detect language successfully', async () => {
      const result = await service.detectLanguage('Hello');
      expect(result).toBe('en');
      expect(mockClient.detect).toHaveBeenCalledWith('Hello');
    });

    it('should handle errors gracefully', async () => {
      mockClient.detect.mockRejectedValueOnce(new Error('Detection failed'));
      await expect(service.detectLanguage('Hello')).rejects.toThrow(TranslationError);
    });
  });

  describe('getSupportedLanguages', () => {
    it('should return supported languages', async () => {
      const result = await service.getSupportedLanguages();
      expect(result).toEqual(['en', 'es', 'fr']);
      expect(mockClient.getLanguages).toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      mockClient.getLanguages.mockRejectedValueOnce(new Error('Failed to get languages'));
      await expect(service.getSupportedLanguages()).rejects.toThrow(TranslationError);
    });
  });

  describe('batchTranslate', () => {
    it('should translate multiple texts', async () => {
      const texts = ['Hello', 'World'];
      const target = 'fr';
      const result = await service.batchTranslate(texts, 'en', target);
      expect(result).toEqual(['Hello translated to fr', 'World translated to fr']);
      expect(mockClient.batchTranslate).toHaveBeenCalledWith(texts, target);
    });

    it('should handle empty input', async () => {
      const result = await service.batchTranslate([], 'en', 'fr');
      expect(result).toEqual([]);
    });

    it('should handle errors gracefully', async () => {
      mockClient.batchTranslate.mockRejectedValueOnce(new Error('Batch translation failed'));
      await expect(service.batchTranslate(['Hello'], 'en', 'fr')).rejects.toThrow(TranslationError);
    });
  });

  describe('isSupportedLanguage', () => {
    it('should return true for supported languages', async () => {
      const result = await service.isSupportedLanguage('en');
      expect(result).toBe(true);
    });

    it('should return false for unsupported languages', async () => {
      const result = await service.isSupportedLanguage('xx');
      expect(result).toBe(false);
    });
  });
});
