// Jest functionality for mocking
const TranslationManager = require('../../../../src/services/translation/translation-manager');
const DeepLService = require('../../../../src/services/translation/deepl-service');
const GPT4oTranslator = require('../../../../src/services/translation/gpt4o-translator');
const GoogleTranslate = require('../../../../src/services/translation/google-translate');
const AzureTranslator = require('../../../../src/services/translation/azure-translator');

describe('TranslationManager', () => {
    let translationManager;

    beforeEach(() => {
        jest.clearAllMocks();
        translationManager = new TranslationManager();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('initialization', () => {
        it('should initialize successfully with all services', async () => {
            // Mock all service initializations
            const mockDeeplInit = jest.spyOn(translationManager.services.deepl, 'initialize').mockResolvedValue({ success: true });
            const mockGpt4oInit = jest.spyOn(translationManager.services.gpt4o, 'initialize').mockResolvedValue({ success: true });
            const mockGoogleInit = jest.spyOn(translationManager.services.google, 'initialize').mockResolvedValue({ success: true });
            const mockAzureInit = jest.spyOn(translationManager.services.azure, 'initialize').mockResolvedValue({ success: true });

            // Supporting components don't need initialization mocking as they don't have initialize methods

            const result = await translationManager.initialize();

            expect(result.success).toBe(true);
            expect(mockDeeplInit).toHaveBeenCalledTimes(1);
            expect(mockGpt4oInit).toHaveBeenCalledTimes(1);
            expect(mockGoogleInit).toHaveBeenCalledTimes(1);
            expect(mockAzureInit).toHaveBeenCalledTimes(1);
            expect(translationManager.isInitialized).toBe(true);
        });

        it('should handle service initialization failures gracefully', async () => {
            // Mock one service failing
            jest.spyOn(translationManager.services.deepl, 'initialize').mockResolvedValue({ success: true });
            jest.spyOn(translationManager.services.gpt4o, 'initialize').mockRejectedValue(new Error('API key not found'));
            jest.spyOn(translationManager.services.google, 'initialize').mockResolvedValue({ success: true });
            jest.spyOn(translationManager.services.azure, 'initialize').mockResolvedValue({ success: true });

            // Supporting components don't need initialization mocking as they don't have initialize methods

            const result = await translationManager.initialize();

            expect(result.success).toBe(true); // Still succeeds with some services available
            expect(translationManager.serviceHealth.gpt4o.healthy).toBe(false);
            expect(translationManager.isInitialized).toBe(true);
        });
    });

    describe('translate', () => {
        beforeEach(async () => {
            // Setup initialized translation manager
            translationManager.isInitialized = true;

            // Mock the supporting components
            jest.spyOn(translationManager.languagePairOptimizer, 'getBestServiceForLanguagePair').mockReturnValue('deepl');
            jest.spyOn(translationManager.translationCache, 'get').mockResolvedValue(null);
            jest.spyOn(translationManager.contextManager, 'getConversationContext').mockResolvedValue('');
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

            jest.spyOn(translationManager, 'attemptTranslation').mockResolvedValue(mockTranslation);
            jest.spyOn(translationManager.qualityAssessment, 'assessTranslation').mockResolvedValue({
                score: 0.92,
                metrics: {
                    accuracy: 0.95,
                    fluency: 0.90,
                    cultural: 0.88
                }
            });

            const result = await translationManager.translate('Hello, world', 'en', 'es');

            expect(result.success).toBe(true);
            expect(result.translation).toBe('Hola, mundo');
            expect(result.service).toBe('deepl');
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

            jest.spyOn(translationManager.translationCache, 'get').mockResolvedValue(cachedTranslation);

            // The attemptTranslation should not be called because of cache hit
            const attemptStub = jest.spyOn(translationManager, 'attemptTranslation');

            const result = await translationManager.translate('Hello, world', 'en', 'es', { useCache: true });

            expect(result.success).toBe(true);
            expect(result.translation).toBe('Hola, mundo');
            expect(result.cached).toBe(true);
            expect(attemptStub).not.toHaveBeenCalled();
        });

        it('should try fallback services when primary service fails', async () => {
            // Primary service fails
            jest.spyOn(translationManager, 'attemptTranslation')
                .mockResolvedValue({
                    success: false,
                    error: 'Service unavailable',
                    service: 'deepl'
                });

            // Fallback succeeds
            jest.spyOn(translationManager, 'fallbackTranslation').mockResolvedValue({
                success: true,
                translation: 'Hola, mundo',
                confidence: 0.85,
                service: 'google',
                processingTime: 180,
                fromLanguage: 'en',
                toLanguage: 'es'
            });

            jest.spyOn(translationManager.qualityAssessment, 'assessTranslation').mockResolvedValue({
                score: 0.85,
                metrics: {
                    accuracy: 0.87,
                    fluency: 0.82,
                    cultural: 0.80
                }
            });

            const result = await translationManager.translate('Hello, world', 'en', 'es');

            expect(result.success).toBe(true);
            expect(result.translation).toBe('Hola, mundo');
            expect(result.service).toBe('google');
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

            jest.spyOn(translationManager.services.deepl, 'translate').mockResolvedValue(mockResult);

            const result = await translationManager.attemptTranslation(
                'deepl',
                'Hello, world',
                'en',
                'es'
            );

            expect(result.success).toBe(true);
            expect(result.translation).toBe('Hola, mundo');
            expect(result.service).toBe('deepl');
            expect(translationManager.serviceHealth.deepl.healthy).toBe(true);
        });

        it('should handle service errors gracefully', async () => {
            // Mock service error
            jest.spyOn(translationManager.services.deepl, 'translate')
                .mockRejectedValue(new Error('API rate limit exceeded'));

            const result = await translationManager.attemptTranslation(
                'deepl',
                'Hello, world',
                'en',
                'es'
            );

            expect(result.success).toBe(false);
            expect(result.error).toContain('API rate limit exceeded');
            expect(result.service).toBe('deepl');
            expect(translationManager.serviceHealth.deepl.healthy).toBe(false);
        });
    });

    describe('fallbackTranslation', () => {
        it('should try alternative services when primary fails', async () => {
            translationManager.isInitialized = true;

            // Mock successful translation with Google after DeepL fails
            jest.spyOn(translationManager, 'attemptTranslation')
                .mockImplementation((service) => {
                    if (service === 'google') {
                        return Promise.resolve({
                            success: true,
                            translation: 'Hola, mundo',
                            confidence: 0.85,
                            service: 'google',
                            processingTime: 150
                        });
                    } else {
                        return Promise.resolve({
                            success: false,
                            error: 'Service unavailable',
                            service: service
                        });
                    }
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

            expect(result.success).toBe(true);
            expect(result.translation).toBe('Hola, mundo');
            expect(result.service).toBe('google');
        });

        it('should return error when all services fail', async () => {
            translationManager.isInitialized = true;

            // Mock all services failing
            jest.spyOn(translationManager, 'attemptTranslation').mockResolvedValue({
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

            expect(result.success).toBe(false);
            expect(result.error).toContain('All translation services failed');
        });
    });
});
