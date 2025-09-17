// Mock uuid first
jest.mock('uuid', () => ({
    v4: jest.fn(() => 'test-uuid')
}));

// Mock axios
jest.mock('axios');

// Jest functionality for testing
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const AzureTranslator = require('../../../../src/services/translation/azure-translator');

const mockedAxios = axios;

describe('AzureTranslator', () => {
    let translator;

    beforeEach(() => {
        jest.clearAllMocks();
        translator = new AzureTranslator({
            apiKey: 'test-api-key',
            endpoint: 'https://api.cognitive.microsofttranslator.com',
            region: 'eastus'
        });

    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('initialization', () => {
        it('should initialize successfully with valid credentials', async () => {
            // Mock translation API response for connection test
            mockedAxios.post.mockResolvedValue({
                data: [{
                    translations: [{ text: 'Hola', to: 'es' }]
                }]
            });

            // Mock languages API response
            mockedAxios.get.mockResolvedValue({
                data: {
                    translation: {
                        en: { name: 'English', dir: 'ltr', supported: true },
                        es: { name: 'Spanish', dir: 'ltr', supported: true },
                        fr: { name: 'French', dir: 'ltr', supported: true }
                    }
                }
            });

            const result = await translator.initialize();

            expect(result.success).toBe(true);
            expect(translator.isInitialized).toBe(true);
            expect(translator.supportedLanguages.length).toBeGreaterThan(0);
            expect(mockedAxios.get).toHaveBeenCalledTimes(1);
        });

        it('should handle missing API key', async () => {
            translator = new AzureTranslator({
                apiKey: null,
                endpoint: 'https://api.cognitive.microsofttranslator.com',
                region: 'eastus'
            });

            await expect(translator.initialize()).rejects.toThrow('API key');
        });

        it('should handle API errors during initialization', async () => {
            // Mock languages API error
            mockedAxios.get.mockRejectedValue(new Error('Unable to connect to Azure'));

            await expect(translator.initialize()).rejects.toThrow('Azure Translator connection test failed');
            expect(translator.isInitialized).toBe(false);
        });
    });

    describe('translate', () => {
        beforeEach(() => {
            // Setup initialized translator
            translator.isInitialized = true;
        });

        it('should translate text successfully', async () => {
            // Mock successful translation response
            mockedAxios.post.mockResolvedValue({
                data: [
                    {
                        translations: [
                            {
                                text: 'Hola mundo',
                                to: 'es',
                                alignment: { proj: '0:4-0:3 6:10-5:9' },
                                sentLen: { srcSentLen: [11], transSentLen: [10] }
                            }
                        ],
                        detectedLanguage: {
                            language: 'en',
                            score: 0.95
                        }
                    }
                ]
            });

            // UUID is already mocked globally

            const result = await translator.translate('Hello world', 'en', 'es');

            expect(result.translation).toBe('Hola mundo');
            expect(result.detectedLanguage).toBe('en');
            expect(result.confidence).toBe(0.95);
            expect(result.service).toBe('azure');
            expect(mockedAxios.post).toHaveBeenCalledTimes(1);

            // Verify correct API call parameters
            const postCall = mockedAxios.post.mock.calls[0];
            expect(postCall[0]).toContain('translate');
            expect(postCall[1]).toEqual([{ text: 'Hello world' }]);
            expect(postCall[2].params).toMatchObject({
                'api-version': translator.config.apiVersion,
                'to': 'es',
                'from': 'en'
            });
            expect(postCall[2].headers).toMatchObject({
                'Ocp-Apim-Subscription-Key': 'test-api-key',
                'Ocp-Apim-Subscription-Region': 'eastus',
                'Content-Type': 'application/json'
            });
        });

        it('should detect language when fromLanguage is "auto"', async () => {
            // Mock successful translation with language detection
            mockedAxios.post.mockResolvedValue({
                data: [
                    {
                        translations: [
                            {
                                text: 'Hello world',
                                to: 'en'
                            }
                        ],
                        detectedLanguage: {
                            language: 'es',
                            score: 0.92
                        }
                    }
                ]
            });

            const result = await translator.translate('Hola mundo', 'auto', 'en');

            expect(result.translation).toBe('Hello world');
            expect(result.detectedLanguage).toBe('es');
            expect(result.confidence).toBe(0.92);

            // Verify API call does not include 'from' parameter
            const postCall = mockedAxios.post.mock.calls[0];
            expect(postCall[2].params.from).toBeUndefined();
        });

        it('should handle API errors gracefully', async () => {
            // Mock API error
            mockedAxios.post.mockRejectedValue({
                response: {
                    data: {
                        error: {
                            code: 401,
                            message: 'Access denied due to invalid subscription key'
                        }
                    }
                }
            });

            await expect(translator.translate('Hello world', 'en', 'es')).rejects.toThrow('Access denied');

            // Check metrics update
            expect(translator.metrics.successRate).toBeLessThan(1.0);
            expect(translator.metrics.lastError).toContain('Access denied');
        });

        it('should handle text formatting options', async () => {
            // Mock successful translation response
            mockedAxios.post.mockResolvedValue({
                data: [
                    {
                        translations: [
                            {
                                text: '<p>Hola <b>mundo</b></p>',
                                to: 'es'
                            }
                        ],
                        detectedLanguage: {
                            language: 'en',
                            score: 0.95
                        }
                    }
                ]
            });

            await translator.translate('<p>Hello <b>world</b></p>', 'en', 'es', {
                textType: 'html',
                preserveFormatting: true
            });

            // Verify API call includes textType parameter
            const postCall = mockedAxios.post.mock.calls[0];
            expect(postCall[2].params.textType).toBe('html');
        });

        it('should respect formality setting when available', async () => {
            // Mock successful translation response
            mockedAxios.post.mockResolvedValue({
                data: [
                    {
                        translations: [
                            {
                                text: 'Hola mundo',
                                to: 'es'
                            }
                        ]
                    }
                ]
            });

            await translator.translate('Hello world', 'en', 'es', {
                formality: 'formal'
            });

            // Verify API call includes textType parameter
            const postCall = mockedAxios.post.mock.calls[0];

            // Check if the API supports formality parameter
            if (translator.supportsFormality) {
                expect(postCall[2].params).toMatchObject({ 'formality': 'formal' });
            }
        });
    });

    describe('detectLanguage', () => {
        beforeEach(() => {
            translator.isInitialized = true;
        });

        it('should detect language correctly', async () => {
            // Mock successful language detection
            mockedAxios.post.mockResolvedValue({
                data: [
                    {
                        language: 'es',
                        score: 0.95,
                        isTranslationSupported: true,
                        isTransliterationSupported: false
                    }
                ]
            });

            const result = await translator.detectLanguage('Hola mundo');

            expect(result.language).toBe('es');
            expect(result.confidence).toBe(0.95);
            expect(result.isReliable).toBe(true);
            expect(mockedAxios.post).toHaveBeenCalledTimes(1);

            // Verify correct API call
            const postCall = mockedAxios.post.mock.calls[0];
            expect(postCall[0]).toContain('detect');
            expect(postCall[1]).toEqual([{ text: 'Hola mundo' }]);
        });

        it('should handle empty text in language detection', async () => {
            // Mock API response for empty text
            mockedAxios.post.mockResolvedValue({
                data: [
                    {
                        language: 'unknown',
                        score: 0.0,
                        isTranslationSupported: false,
                        isTransliterationSupported: false
                    }
                ]
            });

            const result = await translator.detectLanguage('');

            expect(result.language).toBe('unknown');
            expect(result.confidence).toBe(0.0);
            expect(result.isReliable).toBe(false);
        });
    });
});
