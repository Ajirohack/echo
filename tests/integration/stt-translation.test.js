const { expect } = require('chai');
const sinon = require('sinon');
const TranslationManager = require('../../src/services/translation/translation-manager');
const {
    MockDeepLService,
    MockGPT4oTranslator,
    MockGoogleTranslate,
    MockAzureTranslator
} = require('../mocks/translation-mocks');

describe('Translation Integration Tests', () => {
    let translationManager;
    let sandbox;

    beforeEach(() => {
        sandbox = sinon.createSandbox();

        // Create a translation manager with mock services
        translationManager = new TranslationManager();

        // Replace real services with mocks
        translationManager.services = {
            deepl: new MockDeepLService(),
            gpt4o: new MockGPT4oTranslator(),
            google: new MockGoogleTranslate(),
            azure: new MockAzureTranslator()
        };
    });

    afterEach(() => {
        sandbox.restore();
        translationManager.destroy();
    });

    describe('End-to-end translation workflow', () => {
        it('should complete the full translation pipeline', async () => {
            // Initialize the translation manager
            await translationManager.initialize();

            // Verify all services initialized
            expect(translationManager.isInitialized).to.be.true;
            expect(Object.values(translationManager.serviceHealth).every(s => s.healthy)).to.be.true;

            // Get supported language pairs
            const supportedPairs = await translationManager.getSupportedLanguagePairs();
            expect(supportedPairs).to.be.an('array').that.is.not.empty;

            // Test basic translation
            const result1 = await translationManager.translate('Hello world', 'en', 'es');

            expect(result1.success).to.be.true;
            expect(result1.translation).to.equal('Hola mundo');
            expect(result1.service).to.be.oneOf(['deepl', 'gpt4o', 'google', 'azure']);

            // Test translation with context
            const result2 = await translationManager.translate(
                'How are you?',
                'en',
                'fr',
                {
                    context: 'Casual conversation between friends',
                    domain: 'casual'
                }
            );

            expect(result2.success).to.be.true;
            expect(result2.translation).to.equal('Comment allez-vous?');

            // Test translation with conversation context
            const result3 = await translationManager.translate(
                'Thank you',
                'en',
                'de',
                {
                    conversationId: 'test-conversation',
                    domain: 'business'
                }
            );

            expect(result3.success).to.be.true;
            expect(result3.translation).to.equal('Danke');

            // Test translation cache
            const result4 = await translationManager.translate(
                'Hello world',
                'en',
                'es',
                { useCache: true }
            );

            expect(result4.success).to.be.true;
            expect(result4.cached).to.be.true;
        });

        it('should handle service failover correctly', async () => {
            // Create translation manager with one failing service
            translationManager.services.deepl = new MockDeepLService({ failureRate: 1.0 });
            await translationManager.initialize();

            // Verify service health reflects the failure
            expect(translationManager.serviceHealth.deepl.healthy).to.be.false;

            // Test that translation still works using a different service
            const result = await translationManager.translate('Hello world', 'en', 'es');

            expect(result.success).to.be.true;
            expect(result.translation).to.equal('Hola mundo');
            expect(result.service).to.not.equal('deepl');
        });

        it('should maintain conversation context between translations', async () => {
            await translationManager.initialize();

            // Perform a series of translations in the same conversation
            const conversationId = 'test-conversation-context';

            // First message
            await translationManager.translate(
                'Hello, how are you today?',
                'en',
                'es',
                { conversationId }
            );

            // Second message
            await translationManager.translate(
                'I am fine, thank you!',
                'en',
                'es',
                { conversationId }
            );

            // Test that the context is used
            const contextSpy = sandbox.spy(translationManager.contextManager, 'getConversationContext');

            await translationManager.translate(
                'Would you like to meet for coffee?',
                'en',
                'es',
                { conversationId }
            );

            expect(contextSpy.calledOnce).to.be.true;
        });

        it('should handle different priority settings', async () => {
            await translationManager.initialize();

            // Test quality-focused translation
            const qualityResult = await translationManager.translate(
                'Good morning',
                'en',
                'fr',
                { priority: 'quality' }
            );

            // Test speed-focused translation
            const speedResult = await translationManager.translate(
                'Good morning',
                'en',
                'fr',
                { priority: 'speed' }
            );

            // These might use different services based on the routing logic
            expect(qualityResult.translation).to.equal('Bonjour');
            expect(speedResult.translation).to.equal('Bonjour');

            // Test cost-focused translation
            const costResult = await translationManager.translate(
                'Good evening',
                'en',
                'fr',
                { priority: 'cost' }
            );

            expect(costResult.translation).to.equal('Bonsoir');
        });
    });
});
