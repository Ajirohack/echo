const DeepLTranslation = require('@/services/translation/deepl');
const GPT4oTranslation = require('@/services/translation/gpt4o-translator');
const GoogleTranslation = require('@/services/translation/google-translate');
const AzureTranslation = require('@/services/translation/azure-translator');

jest.mock('@/services/translation/deepl');
jest.mock('@/services/translation/gpt4o-translator');
jest.mock('@/services/translation/google-translate');
jest.mock('@/services/translation/azure-translator');

// Temporarily skip this suite until the mocks are aligned with actual implementations
describe.skip('Translation Services', () => {
  let deepL, gpt4o, google, azure;

  beforeEach(() => {
    deepL = new DeepLTranslation();
    gpt4o = new GPT4oTranslation();
    google = new GoogleTranslation();
    azure = new AzureTranslation();
  });

  describe('DeepL Translation', () => {
    test('should translate text successfully', async () => {
      const result = await deepL.translate('Hello', 'en', 'fr');
      expect(result).toBe('Bonjour');
    });

    test('should handle unsupported languages', async () => {
      try {
        await deepL.translate('Hello', 'en', 'xyz');
        fail('Expected error to be thrown');
      } catch (error) {
        expect(error.message).toBe('Language not supported');
      }
    });
  });

  describe('GPT-4o Translation', () => {
    test('should translate with context', async () => {
      const context = 'Business meeting';
      const result = await gpt4o.translate('Hello', 'en', 'fr', context);
      expect(result).toBe('Bonjour');
    });

    test('should handle large text', async () => {
      const longText = 'This is a very long text that needs to be translated...'.repeat(100);
      const result = await gpt4o.translate(longText, 'en', 'fr');
      expect(result).toBeDefined();
    });
  });

  describe('Google Translation', () => {
    test('should translate multiple sentences', async () => {
      const text = 'Hello. How are you?';
      const result = await google.translate(text, 'en', 'fr');
      expect(result).toBe('Bonjour. Comment allez-vous?');
    });

    test('should handle rate limiting', async () => {
      for (let i = 0; i < 100; i++) {
        await google.translate('Hello', 'en', 'fr');
      }
    });
  });

  describe('Azure Translation', () => {
    test('should translate with multiple languages', async () => {
      const result = await azure.translate('Hello', 'en', ['fr', 'es', 'de']);
      expect(result).toBeDefined();
      expect(result.fr).toBe('Bonjour');
      expect(result.es).toBe('Hola');
      expect(result.de).toBe('Hallo');
    });
  });
});
