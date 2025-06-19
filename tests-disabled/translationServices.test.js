const DeepLTranslation = require('../../../src/services/translation/deepl.js');
const GPT4oTranslation = require('../../../src/services/translation/gpt4o.js');
const GoogleTranslation = require('../../../src/services/translation/google.js');
const AzureTranslation = require('../../../src/services/translation/azure.js');

jest.mock('../../../src/services/translation/deepl.js');
jest.mock('../../../src/services/translation/gpt4o.js');
jest.mock('../../../src/services/translation/google.js');
jest.mock('../../../src/services/translation/azure.js');

describe('Translation Services', () => {
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
