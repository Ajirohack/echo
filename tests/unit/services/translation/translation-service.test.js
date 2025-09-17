// Jest functionality replaces Sinon
const TranslationService = require('../../../../src/services/translation/translation-service');

describe('TranslationService', () => {
    let service;

    beforeEach(() => {
        service = new TranslationService({
            apiKey: 'test-api-key',
            defaultSourceLanguage: 'en',
            defaultTargetLanguage: 'es'
        });
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('initialization', () => {
        it('should create an instance with the provided config', () => {
            expect(service).toBeInstanceOf(TranslationService);
            expect(service.apiKey).toBe('test-api-key');
            expect(service.defaultSourceLanguage).toBe('en');
            expect(service.defaultTargetLanguage).toBe('es');
        });

        it('should have default values for non-provided config options', () => {
            const defaultService = new TranslationService();
            expect(defaultService.defaultSourceLanguage).toBe('en');
            expect(defaultService.defaultTargetLanguage).toBe('es');
        });
    });

    describe('translation methods', () => {
        it('should throw error for unimplemented translate method', async () => {
            await expect(service.translate('Hello', 'en', 'fr'))
                .rejects
                .toThrow('Translation service not yet implemented');
        });

        it('should detect language correctly', async () => {
            const result = await service.detectLanguage('Hello world');
            expect(result).toHaveProperty('language');
            expect(result).toHaveProperty('score');
            expect(typeof result.language).toBe('string');
            expect(typeof result.score).toBe('number');
        });

        it('should return empty string for empty text', async () => {
            const result = await service.translate('', 'en', 'fr');
            expect(result).toBe('');
        });
    });

    describe('utility methods', () => {
        it('should return supported languages', async () => {
            const languages = await service.getSupportedLanguages();
            expect(Array.isArray(languages)).toBe(true);
            expect(languages.length).toBeGreaterThan(0);
            expect(languages[0]).toHaveProperty('code');
            expect(languages[0]).toHaveProperty('name');
        });
    });
});
