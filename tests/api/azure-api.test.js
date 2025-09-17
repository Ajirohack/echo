const { expect } = require('chai');
// Sinon functionality replaced with Jest mocks
const nock = require('nock');
const axios = require('axios');

// Import the actual service
const AzureTranslator = require('../../src/services/translation/azure-translator');

describe('Azure Translator API Tests', () => {
    let translator;
    let sandbox;

    beforeEach(() => {
        // Disable real HTTP requests
        nock.disableNetConnect();

        sandbox = sinon.createSandbox();

        // Create service with test credentials
        translator = new AzureTranslator({
            apiKey: 'test-api-key',
            endpoint: 'https://api.cognitive.microsofttranslator.com',
            region: 'eastus'
        });
    });

    afterEach(() => {
        sandbox.restore();
        nock.cleanAll();
        nock.enableNetConnect();
    });

    describe('Translation API', () => {
        it('should make correct API calls to translate text', async () => {
            // Set up mock API response
            nock('https://api.cognitive.microsofttranslator.com')
                .post('/translate')
                .query(q => q.to === 'es' && q['api-version'] === '3.0')
                .reply(200, [
                    {
                        detectedLanguage: {
                            language: 'en',
                            score: 0.91
                        },
                        translations: [
                            {
                                text: 'Hola mundo',
                                to: 'es'
                            }
                        ]
                    }
                ]);

            // Mock UUID generation for deterministic testing
            sandbox.stub(require('uuid'), 'v4').returns('test-uuid');

            // Initialize translator
            await translator.initialize();

            // Call translation method
            const result = await translator.translate('Hello world', 'en', 'es');

            expect(result.translation).to.equal('Hola mundo');
            expect(result.service).to.equal('azure');
            expect(result.detectedLanguage).to.equal('en');

            // Verify all nock mocks were called
            expect(nock.isDone()).to.be.true;
        });

        it('should handle API errors correctly', async () => {
            // Set up mock API error response
            nock('https://api.cognitive.microsofttranslator.com')
                .post('/translate')
                .query(true)
                .reply(401, {
                    error: {
                        code: 401000,
                        message: 'The request is not authorized because credentials are missing or invalid.'
                    }
                });

            // Initialize translator
            await translator.initialize();

            // Call translation method
            try {
                await translator.translate('Hello world', 'en', 'es');
                expect.fail('Should have thrown an error');
            } catch (error) {
                expect(error.message).to.include('credentials are missing or invalid');
            }

            // Verify all nock mocks were called
            expect(nock.isDone()).to.be.true;
        });

        it('should handle network errors gracefully', async () => {
            // Set up mock network error
            nock('https://api.cognitive.microsofttranslator.com')
                .post('/translate')
                .query(true)
                .replyWithError('Connection refused');

            // Initialize translator
            await translator.initialize();

            // Call translation method
            try {
                await translator.translate('Hello world', 'en', 'es');
                expect.fail('Should have thrown an error');
            } catch (error) {
                expect(error.message).to.include('Connection refused');
            }

            // Verify all nock mocks were called
            expect(nock.isDone()).to.be.true;
        });
    });

    describe('Language Detection API', () => {
        it('should detect language correctly', async () => {
            // Set up mock API response
            nock('https://api.cognitive.microsofttranslator.com')
                .post('/detect')
                .query(q => q['api-version'] === '3.0')
                .reply(200, [
                    {
                        language: 'fr',
                        score: 0.95,
                        isTranslationSupported: true,
                        isTransliterationSupported: false
                    }
                ]);

            // Initialize translator
            await translator.initialize();

            // Call detection method
            const result = await translator.detectLanguage('Bonjour le monde');

            expect(result.language).to.equal('fr');
            expect(result.confidence).to.equal(0.95);
            expect(result.isTranslationSupported).to.be.true;

            // Verify all nock mocks were called
            expect(nock.isDone()).to.be.true;
        });
    });

    describe('Supported Languages API', () => {
        it('should retrieve supported languages', async () => {
            // Set up mock API response
            nock('https://api.cognitive.microsofttranslator.com')
                .get('/languages')
                .query(q => q['api-version'] === '3.0' && q.scope === 'translation')
                .reply(200, {
                    translation: {
                        en: {
                            name: 'English',
                            nativeName: 'English',
                            dir: 'ltr'
                        },
                        es: {
                            name: 'Spanish',
                            nativeName: 'Español',
                            dir: 'ltr'
                        },
                        fr: {
                            name: 'French',
                            nativeName: 'Français',
                            dir: 'ltr'
                        }
                    }
                });

            // Call the load languages method
            await translator.loadSupportedLanguages();

            expect(translator.supportedLanguages).to.be.an('array');
            expect(translator.supportedLanguages).to.include.members(['en', 'es', 'fr']);

            // Verify all nock mocks were called
            expect(nock.isDone()).to.be.true;
        });
    });

    describe('Authentication', () => {
        it('should include correct authentication headers', async () => {
            // Set up header verification
            let capturedHeaders = {};

            nock('https://api.cognitive.microsofttranslator.com')
                .post('/translate')
                .query(true)
                .reply(function (uri, requestBody) {
                    // Capture the headers for verification
                    capturedHeaders = this.req.headers;
                    return [200, [{
                        translations: [{ text: 'Hola', to: 'es' }]
                    }]];
                });

            // Initialize translator
            await translator.initialize();

            // Call translation method
            await translator.translate('Hello', 'en', 'es');

            // Verify authentication headers
            expect(capturedHeaders).to.have.property('ocp-apim-subscription-key');
            expect(capturedHeaders['ocp-apim-subscription-key'][0]).to.equal('test-api-key');
            expect(capturedHeaders).to.have.property('ocp-apim-subscription-region');
            expect(capturedHeaders['ocp-apim-subscription-region'][0]).to.equal('eastus');

            // Verify all nock mocks were called
            expect(nock.isDone()).to.be.true;
        });
    });
});
