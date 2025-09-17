/**
 * AI Providers Integration Tests
 */

const AIProviderManager = require('../../src/services/ai-providers/provider-manager');
const AITranslationService = require('../../src/services/translation/ai-translation-service');

describe('AI Providers Integration', () => {
    let providerManager;
    let aiTranslationService;

    beforeEach(() => {
        // Mock configuration for testing
        const config = {
            ollama: {
                enabled: true,
                baseUrl: 'http://localhost:11434',
                defaultModel: 'llama2'
            },
            openrouter: {
                enabled: false,
                apiKey: 'test-key',
                defaultModel: 'openai/gpt-3.5-turbo'
            },
            groq: {
                enabled: false,
                apiKey: 'test-key',
                defaultModel: 'mixtral-8x7b-32768'
            },
            huggingface: {
                enabled: false,
                apiKey: 'test-key',
                defaultModel: 'google/gemma-7b-it'
            }
        };

        providerManager = new AIProviderManager(config);
        aiTranslationService = new AITranslationService({
            providersConfig: config,
            defaultProvider: 'ollama',
            fallbackProvider: 'huggingface'
        });
    });

    afterEach(async () => {
        if (providerManager) {
            providerManager.destroy();
        }
        if (aiTranslationService) {
            aiTranslationService.destroy();
        }
    });

    describe('Provider Manager', () => {
        it('should initialize with configuration', () => {
            expect(providerManager).toBeDefined();
            expect(providerManager.config).toBeDefined();
            expect(providerManager.providers).toBeInstanceOf(Map);
        });

        it('should handle provider initialization', async () => {
            // Mock fetch for testing
            global.fetch = jest.fn();

            // Mock successful API response
            global.fetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ models: [] })
            });

            const result = await providerManager.initialize();
            
            expect(result).toBeDefined();
            expect(result.success).toBeDefined();
        });

        it('should handle provider health checks', async () => {
            // Mock fetch for health check
            global.fetch = jest.fn();
            global.fetch.mockResolvedValue({
                ok: true,
                json: async () => ({ models: [] })
            });

            await providerManager.initialize();
            const healthStatus = await providerManager.healthCheck();
            
            expect(healthStatus).toBeDefined();
            expect(typeof healthStatus).toBe('object');
        });

        it('should get provider status', () => {
            const status = providerManager.getStatus();
            
            expect(status).toBeDefined();
            expect(status.initialized).toBe(false);
            expect(status.activeProvider).toBeNull();
            expect(status.providers).toBeDefined();
        });
    });

    describe('AI Translation Service', () => {
        it('should initialize with configuration', () => {
            expect(aiTranslationService).toBeDefined();
            expect(aiTranslationService.config).toBeDefined();
            expect(aiTranslationService.providerManager).toBeDefined();
        });

        it('should handle service initialization', async () => {
            // Mock provider manager initialization
            aiTranslationService.providerManager.initialize = jest.fn().mockResolvedValue({
                success: true,
                providers: ['ollama'],
                failed: []
            });

            const result = await aiTranslationService.initialize();
            
            expect(result).toBe(true);
            expect(aiTranslationService.initialized).toBe(true);
        });

        it('should build translation prompts correctly', () => {
            const prompt = aiTranslationService.buildTranslationPrompt(
                'Hello world',
                'en',
                'es',
                { context: 'Test context' }
            );

            expect(prompt).toContain('Hello world');
            expect(prompt).toContain('en');
            expect(prompt).toContain('es');
            expect(prompt).toContain('Test context');
        });

        it('should calculate confidence scores', () => {
            const confidence = aiTranslationService.calculateConfidence(
                'Hello world',
                'Hola mundo'
            );

            expect(confidence).toBeGreaterThan(0);
            expect(confidence).toBeLessThanOrEqual(1);
        });

        it('should handle translation history', () => {
            const history = aiTranslationService.getTranslationHistory();
            expect(Array.isArray(history)).toBe(true);

            const filteredHistory = aiTranslationService.getTranslationHistory({
                provider: 'ollama'
            });
            expect(Array.isArray(filteredHistory)).toBe(true);
        });

        it('should get service status', () => {
            const status = aiTranslationService.getStatus();
            
            expect(status).toBeDefined();
            expect(status.initialized).toBe(false);
            expect(status.providerStatus).toBeDefined();
            expect(status.translationHistoryCount).toBe(0);
        });
    });

    describe('Provider Integration', () => {
        it('should handle multiple providers', async () => {
            // Mock successful initialization for multiple providers
            global.fetch = jest.fn();
            global.fetch.mockResolvedValue({
                ok: true,
                json: async () => ({ models: [] })
            });

            const config = {
                ollama: { enabled: true },
                openrouter: { enabled: true, apiKey: 'test' },
                groq: { enabled: true, apiKey: 'test' },
                huggingface: { enabled: true, apiKey: 'test' }
            };

            const multiProviderManager = new AIProviderManager(config);
            const result = await multiProviderManager.initialize();

            expect(result).toBeDefined();
            expect(result.success).toBeDefined();

            multiProviderManager.destroy();
        });

        it('should handle provider switching', async () => {
            // Mock successful initialization
            global.fetch = jest.fn();
            global.fetch.mockResolvedValue({
                ok: true,
                json: async () => ({ models: [] })
            });

            await providerManager.initialize();
            
            // Test setting active provider
            expect(() => {
                providerManager.setActiveProvider('ollama');
            }).not.toThrow();
        });

        it('should handle model discovery', async () => {
            // Mock successful initialization
            global.fetch = jest.fn();
            global.fetch.mockResolvedValue({
                ok: true,
                json: async () => ({ models: [] })
            });

            await providerManager.initialize();
            
            const allModels = await providerManager.getAllAvailableModels();
            expect(Array.isArray(allModels)).toBe(true);
        });
    });

    describe('Error Handling', () => {
        it('should handle provider initialization failures', async () => {
            // Mock failed API response for Ollama endpoint
            global.fetch = jest.fn();
            global.fetch.mockRejectedValue(new Error('Network error'));
            
            // Mock spawn to fail immediately using jest.spyOn
            const childProcess = require('child_process');
            const spawnSpy = jest.spyOn(childProcess, 'spawn').mockImplementation(() => {
                throw new Error('Spawn failed');
            });
            
            // Create a new provider manager with Ollama enabled to test failure
            const failConfig = {
                ollama: {
                    enabled: true,
                    baseUrl: 'http://localhost:11434',
                    defaultModel: 'llama2'
                }
            };
            const failProviderManager = new AIProviderManager(failConfig);

            const result = await failProviderManager.initialize();
            
            expect(result.success).toBe(false);
            expect(result.failed).toBeDefined();
            expect(result.failed.length).toBeGreaterThan(0);
            
            // Restore original spawn
            spawnSpy.mockRestore();
        });

        it('should handle service initialization failures', async () => {
            // Mock provider manager failure
            aiTranslationService.providerManager.initialize = jest.fn().mockResolvedValue({
                success: false,
                providers: [],
                failed: ['ollama']
            });

            const result = await aiTranslationService.initialize();
            
            expect(result).toBe(false);
            expect(aiTranslationService.initialized).toBe(false);
        });

        it('should handle health check failures', async () => {
            // Mock failed health check
            global.fetch = jest.fn();
            global.fetch.mockRejectedValue(new Error('Health check failed'));

            await providerManager.initialize();
            const healthStatus = await providerManager.healthCheck();
            
            expect(healthStatus).toBeDefined();
            // Should have at least one unhealthy provider
            const hasUnhealthy = Object.values(healthStatus).some(p => !p.healthy);
            expect(hasUnhealthy).toBe(true);
        });
    });

    describe('Configuration Management', () => {
        it('should handle environment variable configuration', () => {
            // Test environment variable loading
            process.env.OLLAMA_BASE_URL = 'http://test:11434';
            process.env.OPENROUTER_API_KEY = 'test-key';

            const config = {
                ollama: { enabled: true },
                openrouter: { enabled: true }
            };

            const manager = new AIProviderManager(config);
            expect(manager).toBeDefined();

            // Clean up
            delete process.env.OLLAMA_BASE_URL;
            delete process.env.OPENROUTER_API_KEY;
            manager.destroy();
        });

        it('should validate provider configurations', () => {
            const invalidConfig = {
                ollama: { enabled: true, baseUrl: '' },
                openrouter: { enabled: true, apiKey: '' }
            };

            const manager = new AIProviderManager(invalidConfig);
            expect(manager).toBeDefined();

            manager.destroy();
        });
    });
});