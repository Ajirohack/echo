/**
 * AI Translation Integration Tests
 */

const { expect } = require('chai');
// Sinon functionality replaced with Jest mocks
const TranslationManager = require('../../../../src/services/translation/translation-manager');
const AITranslationService = require('../../../../src/services/translation/ai-translation-service');

describe('AI Translation Integration', () => {
    let translationManager;
    let sandbox;

    beforeEach(() => {
        sandbox = sinon.createSandbox();
        
        // Mock AI providers configuration
        const config = {
            aiProviders: {
                ollama: {
                    enabled: true,
                    baseUrl: 'http://localhost:11434',
                    defaultModel: 'llama2'
                },
                openrouter: {
                    enabled: false,
                    apiKey: 'test-key'
                },
                groq: {
                    enabled: false,
                    apiKey: 'test-key'
                },
                huggingface: {
                    enabled: false,
                    apiKey: 'test-key'
                }
            },
            defaultAIProvider: 'ollama',
            fallbackAIProvider: 'huggingface'
        };

        translationManager = new TranslationManager(config);
    });

    afterEach(() => {
        sandbox.restore();
        if (translationManager) {
            translationManager.destroy();
        }
    });

    describe('Initialization', () => {
        it('should initialize with AI translation service', async () => {
            // Mock fetch for Ollama API
            global.fetch = sandbox.stub();
            global.fetch.resolves({
                ok: true,
                json: async () => ({ models: [] })
            });

            const result = await translationManager.initialize();
            
            expect(result.success).to.be.true;
            expect(result.services).to.be.defined;
            expect(result.services.ai).to.be.defined;
            expect(translationManager.aiTranslationService).to.be.defined;
        });

        it('should handle AI service initialization failure gracefully', async () => {
            // Mock failed API response
            global.fetch = sandbox.stub();
            global.fetch.rejects(new Error('Network error'));

            const result = await translationManager.initialize();
            
            expect(result.success).to.be.true;
            expect(result.services.ai.success).to.be.false;
            expect(result.services.ai.error).to.be.defined;
        });
    });

    describe('Translation with AI Service', () => {
        beforeEach(async () => {
            // Mock successful initialization
            global.fetch = sandbox.stub();
            global.fetch.resolves({
                ok: true,
                json: async () => ({ models: [] })
            });

            await translationManager.initialize();
        });

        it('should use AI service for context-aware translation', async () => {
            // Mock AI translation service
            translationManager.aiTranslationService.translate = sandbox.stub().resolves({
                translatedText: 'Hola mundo',
                confidence: 0.9,
                metadata: {
                    provider: 'ollama',
                    model: 'llama2'
                }
            });

            const result = await translationManager.translate(
                'Hello world',
                'en',
                'es',
                {
                    context: 'Casual conversation',
                    preferredService: 'ai'
                }
            );

            expect(result.success).to.be.true;
            expect(result.translation).to.equal('Hola mundo');
            expect(result.service).to.equal('ai');
            expect(result.confidence).to.equal(0.9);
            expect(translationManager.aiTranslationService.translate).to.have.been.called;
        });

        it('should fallback to AI service when other services fail', async () => {
            // Mock traditional services to fail
            translationManager.services.deepl.translate = sandbox.stub().rejects(new Error('Service unavailable'));
            translationManager.services.google.translate = sandbox.stub().rejects(new Error('Service unavailable'));

            // Mock AI service to succeed
            translationManager.aiTranslationService.translate = sandbox.stub().resolves({
                translatedText: 'Bonjour le monde',
                confidence: 0.85,
                metadata: {
                    provider: 'ollama',
                    model: 'llama2'
                }
            });

            const result = await translationManager.translate(
                'Hello world',
                'en',
                'fr',
                { priority: 'quality' }
            );

            expect(result.success).to.be.true;
            expect(result.translation).to.equal('Bonjour le monde');
            expect(result.service).to.equal('ai');
        });

        it('should handle AI service failure gracefully', async () => {
            // Mock AI service to fail
            translationManager.aiTranslationService.translate = sandbox.stub().rejects(new Error('AI service unavailable'));

            // Mock traditional service to succeed
            translationManager.services.google.translate = sandbox.stub().resolves({
                translation: 'Hola mundo',
                confidence: 0.8
            });

            const result = await translationManager.translate(
                'Hello world',
                'en',
                'es',
                { preferredService: 'ai' }
            );

            // Should fallback to traditional service
            expect(result.success).to.be.true;
            expect(result.translation).to.equal('Hola mundo');
            expect(result.service).to.equal('google');
        });
    });

    describe('Service Status', () => {
        it('should include AI service in status', async () => {
            // Mock successful initialization
            global.fetch = sandbox.stub();
            global.fetch.resolves({
                ok: true,
                json: async () => ({ models: [] })
            });

            await translationManager.initialize();

            const status = translationManager.getServiceStatus();
            
            expect(status.services.ai).to.be.defined;
            expect(status.services.ai.healthy).to.be.true;
            expect(status.services.ai.initialized).to.be.true;
            expect(status.services.ai.supportedLanguages).to.equal('all');
        });

        it('should show AI service as unhealthy when initialization fails', async () => {
            // Mock failed initialization
            global.fetch = sandbox.stub();
            global.fetch.rejects(new Error('Network error'));

            await translationManager.initialize();

            const status = translationManager.getServiceStatus();
            
            expect(status.services.ai).to.be.defined;
            expect(status.services.ai.healthy).to.be.false;
            expect(status.services.ai.lastError).to.be.defined;
        });
    });

    describe('Language Pair Optimization', () => {
        it('should prioritize AI service for context-aware translation', async () => {
            // Mock successful initialization
            global.fetch = sandbox.stub();
            global.fetch.resolves({
                ok: true,
                json: async () => ({ models: [] })
            });

            await translationManager.initialize();

            const optimizer = translationManager.languagePairOptimizer;
            const selectedService = optimizer.getBestServiceForLanguagePair(
                'en',
                'es',
                {
                    requiresContext: true,
                    hasContext: true,
                    serviceHealth: {
                        ai: { healthy: true },
                        deepl: { healthy: true },
                        google: { healthy: true }
                    }
                }
            );

            expect(selectedService).to.equal('ai');
        });

        it('should include AI service in fallback order', async () => {
            // Mock successful initialization
            global.fetch = sandbox.stub();
            global.fetch.resolves({
                ok: true,
                json: async () => ({ models: [] })
            });

            await translationManager.initialize();

            // Mock AI service to succeed
            translationManager.aiTranslationService.translate = sandbox.stub().resolves({
                translatedText: 'Hola mundo',
                confidence: 0.9,
                metadata: {
                    provider: 'ollama',
                    model: 'llama2'
                }
            });

            // Mock other services to fail
            translationManager.services.deepl.translate = sandbox.stub().rejects(new Error('Service unavailable'));
            translationManager.services.google.translate = sandbox.stub().rejects(new Error('Service unavailable'));

            const result = await translationManager.translate(
                'Hello world',
                'en',
                'es',
                { context: 'Test context' }
            );

            expect(result.success).to.be.true;
            expect(result.service).to.equal('ai');
        });
    });

    describe('Cleanup', () => {
        it('should properly destroy AI translation service', async () => {
            // Mock successful initialization
            global.fetch = sandbox.stub();
            global.fetch.resolves({
                ok: true,
                json: async () => ({ models: [] })
            });

            await translationManager.initialize();

            // Mock destroy method
            translationManager.aiTranslationService.destroy = sandbox.stub();

            translationManager.destroy();

            expect(translationManager.aiTranslationService.destroy).to.have.been.called;
        });
    });
});