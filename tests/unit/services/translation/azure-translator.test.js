const { expect } = require('chai');
const sinon = require('sinon');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const AzureTranslator = require('../../../../src/services/translation/azure-translator');

describe('AzureTranslator', () => {
    let translator;
    let sandbox;

    beforeEach(() => {
        sandbox = sinon.createSandbox();
        translator = new AzureTranslator({
            apiKey: 'test-api-key',
            endpoint: 'https://api.cognitive.microsofttranslator.com',
            region: 'eastus'
        });

        // Mock axios
        sandbox.stub(axios, 'post');
        sandbox.stub(axios, 'get');
    });

    afterEach(() => {
        sandbox.restore();
    });

    describe('initialization', () => {
        it('should initialize successfully with valid credentials', async () => {
            // Mock languages API response
            axios.get.resolves({
                data: {
                    translation: {
                        en: { name: 'English', dir: 'ltr', supported: true },
                        es: { name: 'Spanish', dir: 'ltr', supported: true },
                        fr: { name: 'French', dir: 'ltr', supported: true }
                    }
                }
            });

            const result = await translator.initialize();

            expect(result.success).to.be.true;
            expect(translator.isInitialized).to.be.true;
            expect(translator.supportedLanguages.length).to.be.greaterThan(0);
            expect(axios.get.calledOnce).to.be.true;
        });

        it('should handle missing API key', async () => {
            translator = new AzureTranslator({
                apiKey: null,
                endpoint: 'https://api.cognitive.microsofttranslator.com',
                region: 'eastus'
            });

            try {
                await translator.initialize();
                expect.fail('Should have thrown an error');
            } catch (error) {
                expect(error.message).to.include('API key');
            }
        });

        it('should handle API errors during initialization', async () => {
            // Mock languages API error
            axios.get.rejects(new Error('Unable to connect to Azure'));

            try {
                await translator.initialize();
                expect.fail('Should have thrown an error');
            } catch (error) {
                expect(error.message).to.include('Unable to connect to Azure');
                expect(translator.isInitialized).to.be.false;
            }
        });
    });

    describe('translate', () => {
        beforeEach(() => {
            // Setup initialized translator
            translator.isInitialized = true;
        });

        it('should translate text successfully', async () => {
            // Mock successful translation response
            axios.post.resolves({
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

            // Mock UUID generation for deterministic testing
            sandbox.stub(uuidv4).returns('test-uuid');

            const result = await translator.translate('Hello world', 'en', 'es');

            expect(result.translation).to.equal('Hola mundo');
            expect(result.detectedLanguage).to.equal('en');
            expect(result.confidence).to.equal(0.95);
            expect(result.service).to.equal('azure');
            expect(axios.post.calledOnce).to.be.true;

            // Verify correct API call parameters
            const postCall = axios.post.getCall(0);
            expect(postCall.args[0]).to.include('translate');
            expect(postCall.args[1]).to.deep.equal([{ text: 'Hello world' }]);
            expect(postCall.args[2].params).to.include({
                'api-version': translator.config.apiVersion,
                'to': 'es',
                'from': 'en'
            });
            expect(postCall.args[2].headers).to.include({
                'Ocp-Apim-Subscription-Key': 'test-api-key',
                'Ocp-Apim-Subscription-Region': 'eastus',
                'Content-Type': 'application/json',
                'X-ClientTraceId': 'test-uuid'
            });
        });

        it('should detect language when fromLanguage is "auto"', async () => {
            // Mock successful translation with language detection
            axios.post.resolves({
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

            expect(result.translation).to.equal('Hello world');
            expect(result.detectedLanguage).to.equal('es');
            expect(result.confidence).to.equal(0.92);

            // Verify API call does not include 'from' parameter
            const postCall = axios.post.getCall(0);
            expect(postCall.args[2].params.from).to.be.undefined;
        });

        it('should handle API errors gracefully', async () => {
            // Mock API error
            axios.post.rejects({
                response: {
                    data: {
                        error: {
                            code: 401,
                            message: 'Access denied due to invalid subscription key'
                        }
                    }
                }
            });

            try {
                await translator.translate('Hello world', 'en', 'es');
                expect.fail('Should have thrown an error');
            } catch (error) {
                expect(error.message).to.include('Access denied');

                // Check metrics update
                expect(translator.metrics.successRate).to.be.lessThan(1.0);
                expect(translator.metrics.lastError).to.include('Access denied');
            }
        });

        it('should handle text formatting options', async () => {
            // Mock successful translation response
            axios.post.resolves({
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
            const postCall = axios.post.getCall(0);
            expect(postCall.args[2].params.textType).to.equal('html');
        });

        it('should respect formality setting when available', async () => {
            // Mock successful translation response
            axios.post.resolves({
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
            const postCall = axios.post.getCall(0);

            // Check if the API supports formality parameter
            if (translator.supportsFormality) {
                expect(postCall.args[2].params).to.include({ 'formality': 'formal' });
            }
        });
    });

    describe('detectLanguage', () => {
        beforeEach(() => {
            translator.isInitialized = true;
        });

        it('should detect language correctly', async () => {
            // Mock successful language detection
            axios.post.resolves({
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

            expect(result.language).to.equal('es');
            expect(result.confidence).to.equal(0.95);
            expect(result.isTranslationSupported).to.be.true;
            expect(axios.post.calledOnce).to.be.true;

            // Verify correct API call
            const postCall = axios.post.getCall(0);
            expect(postCall.args[0]).to.include('detect');
            expect(postCall.args[1]).to.deep.equal([{ text: 'Hola mundo' }]);
        });

        it('should handle empty text in language detection', async () => {
            try {
                await translator.detectLanguage('');
                expect.fail('Should have thrown an error');
            } catch (error) {
                expect(error.message).to.include('Text cannot be empty');
            }
        });
    });
});
