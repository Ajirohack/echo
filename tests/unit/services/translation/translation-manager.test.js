const { expect } = require('chai');
const sinon = require('sinon');
const TranslationManager = require('../../../../src/services/translation/translation-manager');
const DeepLService = require('../../../../src/services/translation/deepl-service');
const GPT4oTranslator = require('../../../../src/services/translation/gpt4o-translator');
const GoogleTranslate = require('../../../../src/services/translation/google-translate');
const AzureTranslator = require('../../../../src/services/translation/azure-translator');

describe('TranslationManager', () => {
    let translationManager;
    let sandbox;

    beforeEach(() => {
        sandbox = sinon.createSandbox();
        translationManager = new TranslationManager();
    });

    afterEach(() => {
        sandbox.restore();
    });

    describe('initialization', () => {
        it('should initialize successfully with all services', async () => {
            // Mock all service initializations
            const mockDeeplInit = sandbox.stub(translationManager.services.deepl, 'initialize').resolves({ success: true });
            const mockGpt4oInit = sandbox.stub(translationManager.services.gpt4o, 'initialize').resolves({ success: true });
            const mockGoogleInit = sandbox.stub(translationManager.services.google, 'initialize').resolves({ success: true });
            const mockAzureInit = sandbox.stub(translationManager.services.azure, 'initialize').resolves({ success: true });

            // Mock supporting components
            sandbox.stub(translationManager.languagePairOptimizer, 'initialize').resolves();
            sandbox.stub(translationManager.contextManager, 'initialize').resolves();
            sandbox.stub(translationManager.translationCache, 'initialize').resolves();
            sandbox.stub(translationManager.qualityAssessment, 'initialize').resolves();

            const result = await translationManager.initialize();

            expect(result.success).to.be.true;
            expect(mockDeeplInit.calledOnce).to.be.true;
            expect(mockGpt4oInit.calledOnce).to.be.true;
            expect(mockGoogleInit.calledOnce).to.be.true;
            expect(mockAzureInit.calledOnce).to.be.true;
            expect(translationManager.isInitialized).to.be.true;
        });

        it('should handle service initialization failures gracefully', async () => {
            // Mock one service failing
            sandbox.stub(translationManager.services.deepl, 'initialize').resolves({ success: true });
            sandbox.stub(translationManager.services.gpt4o, 'initialize').rejects(new Error('API key not found'));
            sandbox.stub(translationManager.services.google, 'initialize').resolves({ success: true });
            sandbox.stub(translationManager.services.azure, 'initialize').resolves({ success: true });

            // Mock supporting components
            sandbox.stub(translationManager.languagePairOptimizer, 'initialize').resolves();
            sandbox.stub(translationManager.contextManager, 'initialize').resolves();
            sandbox.stub(translationManager.translationCache, 'initialize').resolves();
            sandbox.stub(translationManager.qualityAssessment, 'initialize').resolves();

            const result = await translationManager.initialize();

            expect(result.success).to.be.true; // Still succeeds with some services available
            expect(translationManager.serviceHealth.gpt4o.healthy).to.be.false;
            expect(translationManager.isInitialized).to.be.true;
        });
    });

    describe('translate', () => {
        beforeEach(async () => {
            // Setup initialized translation manager
            translationManager.isInitialized = true;

            // Mock the supporting components
            sandbox.stub(translationManager.languagePairOptimizer, 'getBestServiceForLanguagePair').returns('deepl');
            sandbox.stub(translationManager.translationCache, 'get').resolves(null);
            sandbox.stub(translationManager.contextManager, 'getConversationContext').resolves('');
        });

        it('should translate text using the best service', async () => {
            // Mock successful translation
            const mockTranslation = {
                success: true,
                translation: 'Hola, mundo',
                confidence: 0.95,
                service: 'deepl',
                processingTime: 120,
                fromLanguage: 'en',
                toLanguage: 'es'
            };

            sandbox.stub(translationManager, 'attemptTranslation').resolves(mockTranslation);
            sandbox.stub(translationManager.qualityAssessment, 'assessTranslation').resolves({
                score: 0.92,
                metrics: {
                    accuracy: 0.95,
                    fluency: 0.90,
                    cultural: 0.88
                }
            });

            const result = await translationManager.translate('Hello, world', 'en', 'es');

            expect(result.success).to.be.true;
            expect(result.translation).to.equal('Hola, mundo');
            expect(result.service).to.equal('deepl');
        });

        it('should use cached translation when available', async () => {
            // Mock cache hit
            const cachedTranslation = {
                success: true,
                translation: 'Hola, mundo',
                confidence: 0.95,
                service: 'deepl',
                processingTime: 5, // Fast because cached
                fromLanguage: 'en',
                toLanguage: 'es',
                cached: true
            };

            sandbox.stub(translationManager.translationCache, 'get').resolves(cachedTranslation);

            // The attemptTranslation should not be called because of cache hit
            const attemptStub = sandbox.stub(translationManager, 'attemptTranslation');

            const result = await translationManager.translate('Hello, world', 'en', 'es', { useCache: true });

            expect(result.success).to.be.true;
            expect(result.translation).to.equal('Hola, mundo');
            expect(result.cached).to.be.true;
            expect(attemptStub.called).to.be.false;
        });

        it('should try fallback services when primary service fails', async () => {
            // Primary service fails
            sandbox.stub(translationManager, 'attemptTranslation')
                .withArgs('deepl', sinon.match.any, sinon.match.any, sinon.match.any, sinon.match.any, sinon.match.any)
                .resolves({
                    success: false,
                    error: 'Service unavailable',
                    service: 'deepl'
                });

            // Fallback succeeds
            sandbox.stub(translationManager, 'fallbackTranslation').resolves({
                success: true,
                translation: 'Hola, mundo',
                confidence: 0.85,
                service: 'google',
                processingTime: 180,
                fromLanguage: 'en',
                toLanguage: 'es'
            });

            sandbox.stub(translationManager.qualityAssessment, 'assessTranslation').resolves({
                score: 0.85,
                metrics: {
                    accuracy: 0.87,
                    fluency: 0.82,
                    cultural: 0.80
                }
            });

            const result = await translationManager.translate('Hello, world', 'en', 'es');

            expect(result.success).to.be.true;
            expect(result.translation).to.equal('Hola, mundo');
            expect(result.service).to.equal('google');
        });
    });

    describe('attemptTranslation', () => {
        beforeEach(() => {
            translationManager.isInitialized = true;
        });

        it('should translate text with the specified service', async () => {
            // Mock deepl service
            const mockResult = {
                translation: 'Hola, mundo',
                confidence: 0.95,
                detectedLanguage: 'en'
            };

            sandbox.stub(translationManager.services.deepl, 'translate').resolves(mockResult);

            const result = await translationManager.attemptTranslation(
                'deepl',
                'Hello, world',
                'en',
                'es'
            );

            expect(result.success).to.be.true;
            expect(result.translation).to.equal('Hola, mundo');
            expect(result.service).to.equal('deepl');
            expect(translationManager.serviceHealth.deepl.healthy).to.be.true;
        });

        it('should handle service errors gracefully', async () => {
            // Mock service error
            sandbox.stub(translationManager.services.deepl, 'translate')
                .rejects(new Error('API rate limit exceeded'));

            const result = await translationManager.attemptTranslation(
                'deepl',
                'Hello, world',
                'en',
                'es'
            );

            expect(result.success).to.be.false;
            expect(result.error).to.include('API rate limit exceeded');
            expect(result.service).to.equal('deepl');
            expect(translationManager.serviceHealth.deepl.healthy).to.be.false;
        });
    });

    describe('fallbackTranslation', () => {
        it('should try alternative services when primary fails', async () => {
            translationManager.isInitialized = true;

            // Mock successful translation with Google after DeepL fails
            sandbox.stub(translationManager, 'attemptTranslation')
                .withArgs('google', sinon.match.any, sinon.match.any, sinon.match.any, sinon.match.any, sinon.match.any)
                .resolves({
                    success: true,
                    translation: 'Hola, mundo',
                    confidence: 0.85,
                    service: 'google',
                    processingTime: 150
                })
                .withArgs('deepl', sinon.match.any, sinon.match.any, sinon.match.any, sinon.match.any, sinon.match.any)
                .resolves({
                    success: false,
                    error: 'Service unavailable',
                    service: 'deepl'
                });

            // Mock service health
            translationManager.serviceHealth = {
                deepl: { healthy: false },
                google: { healthy: true },
                azure: { healthy: true },
                gpt4o: { healthy: true }
            };

            const result = await translationManager.fallbackTranslation(
                'Hello, world',
                'en',
                'es',
                '',
                'deepl'
            );

            expect(result.success).to.be.true;
            expect(result.translation).to.equal('Hola, mundo');
            expect(result.service).to.equal('google');
        });

        it('should return error when all services fail', async () => {
            translationManager.isInitialized = true;

            // Mock all services failing
            sandbox.stub(translationManager, 'attemptTranslation').resolves({
                success: false,
                error: 'Service unavailable'
            });

            const result = await translationManager.fallbackTranslation(
                'Hello, world',
                'en',
                'es',
                '',
                'deepl'
            );

            expect(result.success).to.be.false;
            expect(result.error).to.include('All translation services failed');
        });
    });
});
