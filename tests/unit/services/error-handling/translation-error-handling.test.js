/**
 * Tests for error handling in the translation pipeline
 */

const { expect } = require('chai');
// Sinon functionality replaced with Jest mocks
const TranslationManager = require('../../../../src/services/translation/translation-manager');
const { createMockServices, createTestSandbox } = require('../../../utils/translation-test-utils');

describe('Translation Error Handling', () => {
    let translationManager;
    let sandbox;

    beforeEach(async () => {
        sandbox = createTestSandbox();

        // Create translation manager with mock services
        translationManager = new TranslationManager();
        translationManager.services = createMockServices();

        // Initialize
        await translationManager.initialize();
    });

    afterEach(() => {
        sandbox.restore();
        if (translationManager) translationManager.destroy();
    });

    describe('Service failure handling', () => {
        it('should handle all services failing', async () => {
            // Make all services fail
            for (const service of Object.keys(translationManager.services)) {
                sandbox.stub(translationManager.services[service], 'translate').rejects(
                    new Error(`${service} service error`)
                );
            }

            // Try to translate
            const result = await translationManager.translate('Hello world', 'en', 'es');

            // Should report failure
            expect(result.success).to.be.false;
            expect(result.error).to.exist;
            expect(result.failedServices).to.be.an('array');
            expect(result.failedServices.length).to.be.greaterThan(0);
        });

        it('should use fallback when primary service fails', async () => {
            // Make primary service fail but leave fallbacks working
            const primaryService = 'deepl';
            sandbox.stub(translationManager.languagePairOptimizer, 'getBestServiceForLanguagePair')
                .returns(primaryService);

            // Make primary service fail
            sandbox.stub(translationManager.services[primaryService], 'translate').rejects(
                new Error('Service temporarily unavailable')
            );

            // Try to translate
            const result = await translationManager.translate('Hello world', 'en', 'es');

            // Should succeed using a fallback
            expect(result.success).to.be.true;
            expect(result.service).to.not.equal(primaryService);
            expect(result.usedFallback).to.be.true;
        });

        it('should handle intermittent failures', async () => {
            // Simulate service that fails half the time
            const mockService = translationManager.services.deepl;

            let callCount = 0;
            sandbox.stub(mockService, 'translate').callsFake(async (text, fromLang, toLang) => {
                callCount++;
                if (callCount % 2 === 1) {
                    throw new Error('Intermittent failure');
                }

                return {
                    translation: 'Hola mundo',
                    confidence: 0.9
                };
            });

            // Force using this service
            sandbox.stub(translationManager.languagePairOptimizer, 'getBestServiceForLanguagePair')
                .returns('deepl');

            // First call should fail, retry should succeed
            const result = await translationManager.translate('Hello world', 'en', 'es', {
                retry: true, // Enable retry
                maxRetries: 3
            });

            // Should succeed after retry
            expect(result.success).to.be.true;
            expect(result.translation).to.equal('Hola mundo');
            expect(result.retryCount).to.be.greaterThan(0);
        });
    });

    describe('Invalid input handling', () => {
        it('should handle empty text input', async () => {
            const result = await translationManager.translate('', 'en', 'es');

            // Should return quickly without calling services
            expect(result.success).to.be.true;
            expect(result.translation).to.equal('');
            expect(result.skipped).to.be.true;
        });

        it('should handle invalid language codes', async () => {
            const result = await translationManager.translate('Hello world', 'invalid', 'es');

            // Should fail with error
            expect(result.success).to.be.false;
            expect(result.error).to.include('language code');
        });

        it('should handle very long input text', async () => {
            // Generate a very long text (50KB)
            const longText = 'A'.repeat(50000);

            // Mock services to return truncated response
            for (const service of Object.keys(translationManager.services)) {
                sandbox.stub(translationManager.services[service], 'translate').callsFake(
                    async (text, fromLang, toLang) => {
                        // Simulate truncation
                        return {
                            translation: 'Truncated translation',
                            confidence: 0.7,
                            truncated: true
                        };
                    }
                );
            }

            const result = await translationManager.translate(longText, 'en', 'es');

            // Should succeed but indicate truncation
            expect(result.success).to.be.true;
            expect(result.truncated).to.be.true;
        });

        it('should handle unsupported language pairs', async () => {
            // Mock unsupported language detection
            sandbox.stub(translationManager, 'isLanguagePairSupported').returns(false);

            const result = await translationManager.translate('Hello', 'en', 'xx');

            // Should fail with appropriate error
            expect(result.success).to.be.false;
            expect(result.error).to.include('unsupported');
        });
    });

    describe('Network error handling', () => {
        it('should handle timeout errors', async () => {
            // Stub services to time out
            for (const service of Object.keys(translationManager.services)) {
                sandbox.stub(translationManager.services[service], 'translate').callsFake(
                    async () => {
                        // Simulate timeout
                        await new Promise(resolve => setTimeout(resolve, 100));
                        throw new Error('Request timed out');
                    }
                );
            }

            // Set a very short timeout
            const result = await translationManager.translate('Hello world', 'en', 'es', {
                timeout: 50 // 50ms timeout (shorter than simulated delay)
            });

            // Should fail with timeout error
            expect(result.success).to.be.false;
            expect(result.error).to.include('timed out');
        });

        it('should handle rate limit errors', async () => {
            // Stub services to return rate limit errors
            for (const service of Object.keys(translationManager.services)) {
                sandbox.stub(translationManager.services[service], 'translate').callsFake(
                    async () => {
                        const error = new Error('Rate limit exceeded');
                        error.code = 429; // Rate limit status code
                        throw error;
                    }
                );
            }

            const result = await translationManager.translate('Hello world', 'en', 'es');

            // Should fail with rate limit error
            expect(result.success).to.be.false;
            expect(result.error).to.include('rate limit');
            expect(result.rateLimited).to.be.true;
        });

        it('should handle network connectivity errors', async () => {
            // Stub services to return network errors
            for (const service of Object.keys(translationManager.services)) {
                sandbox.stub(translationManager.services[service], 'translate').callsFake(
                    async () => {
                        const error = new Error('Network error');
                        error.code = 'ENOTFOUND'; // DNS lookup failure
                        throw error;
                    }
                );
            }

            const result = await translationManager.translate('Hello world', 'en', 'es');

            // Should fail with network error
            expect(result.success).to.be.false;
            expect(result.error).to.include('network');
        });
    });

    describe('Error recovery', () => {
        it('should recover automatically when service becomes available again', async () => {
            // Service that fails first time but succeeds second time
            const mockService = translationManager.services.deepl;

            let callCount = 0;
            sandbox.stub(mockService, 'translate').callsFake(async (text, fromLang, toLang) => {
                callCount++;
                if (callCount === 1) {
                    throw new Error('Service temporarily unavailable');
                }

                return {
                    translation: 'Hola mundo',
                    confidence: 0.9
                };
            });

            // Force using this service
            sandbox.stub(translationManager.languagePairOptimizer, 'getBestServiceForLanguagePair')
                .returns('deepl');

            // First translation should fail
            const result1 = await translationManager.translate('Hello world', 'en', 'es', {
                retry: false // Disable retry to simulate failure
            });

            expect(result1.success).to.be.false;

            // Second translation should succeed
            const result2 = await translationManager.translate('Hello world', 'en', 'es');

            expect(result2.success).to.be.true;
            expect(result2.translation).to.equal('Hola mundo');
        });

        it('should update service health status on failures', async () => {
            // Mock service that always fails
            const mockService = translationManager.services.deepl;
            sandbox.stub(mockService, 'translate').rejects(new Error('Service error'));

            // Force using this service
            sandbox.stub(translationManager.languagePairOptimizer, 'getBestServiceForLanguagePair')
                .returns('deepl');

            // Try to translate (will fail)
            await translationManager.translate('Hello world', 'en', 'es');

            // Service health should be updated
            expect(mockService.healthy).to.be.false;
        });

        it('should restore service health on successful translation', async () => {
            // Set service as unhealthy
            const mockService = translationManager.services.deepl;
            mockService.healthy = false;

            // Now make it succeed
            sandbox.stub(mockService, 'translate').resolves({
                translation: 'Hola mundo',
                confidence: 0.9
            });

            // Force using this service
            sandbox.stub(translationManager.languagePairOptimizer, 'getBestServiceForLanguagePair')
                .returns('deepl');

            // Translate successfully
            await translationManager.translate('Hello world', 'en', 'es');

            // Service health should be restored
            expect(mockService.healthy).to.be.true;
        });
    });
});
