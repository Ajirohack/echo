/**
 * Base AI Provider Tests
 */

const BaseAIProvider = require('../../../../src/services/ai-providers/base-provider');

describe('BaseAIProvider', () => {
    let provider;

    beforeEach(() => {
        provider = new BaseAIProvider({
            name: 'test-provider',
            baseUrl: 'https://api.test.com',
            apiKey: 'test-key',
            defaultModel: 'test-model'
        });
    });

    afterEach(() => {
        if (provider) {
            provider.destroy();
        }
    });

    describe('constructor', () => {
        it('should initialize with default values', () => {
            const defaultProvider = new BaseAIProvider();
            
            expect(defaultProvider.config.name).toBe('base');
            expect(defaultProvider.config.baseUrl).toBe('');
            expect(defaultProvider.config.apiKey).toBe('');
            expect(defaultProvider.config.defaultModel).toBe('');
            expect(defaultProvider.config.timeout).toBe(30000);
            expect(defaultProvider.config.maxRetries).toBe(3);
            expect(defaultProvider.isInitialized).toBe(false);
            expect(defaultProvider.availableModels).toEqual([]);
            expect(defaultProvider.modelInfo).toEqual({});
        });

        it('should initialize with custom config', () => {
            expect(provider.config.name).toBe('test-provider');
            expect(provider.config.baseUrl).toBe('https://api.test.com');
            expect(provider.config.apiKey).toBe('test-key');
            expect(provider.config.defaultModel).toBe('test-model');
        });
    });

    describe('initialize', () => {
        it('should throw error when validateConfig is not implemented', async () => {
            await expect(provider.initialize()).rejects.toThrow('validateConfig must be implemented by subclass');
        });

        it('should initialize successfully when methods are implemented', async () => {
            // Mock the required methods
            provider.validateConfig = jest.fn().mockResolvedValue();
            provider.loadAvailableModels = jest.fn().mockResolvedValue();

            const result = await provider.initialize();

            expect(result).toBe(true);
            expect(provider.isInitialized).toBe(true);
            expect(provider.validateConfig).toHaveBeenCalled();
            expect(provider.loadAvailableModels).toHaveBeenCalled();
        });

        it('should handle initialization errors', async () => {
            provider.validateConfig = jest.fn().mockRejectedValue(new Error('Validation failed'));

            const result = await provider.initialize();

            expect(result).toBe(false);
            expect(provider.isInitialized).toBe(false);
        });
    });

    describe('generateText', () => {
        it('should throw error when not implemented', async () => {
            await expect(provider.generateText('test')).rejects.toThrow('generateText must be implemented by subclass');
        });
    });

    describe('generateChat', () => {
        it('should throw error when not implemented', async () => {
            await expect(provider.generateChat([])).rejects.toThrow('generateChat must be implemented by subclass');
        });
    });

    describe('getAvailableModels', () => {
        it('should return available models', () => {
            provider.availableModels = ['model1', 'model2'];
            expect(provider.getAvailableModels()).toEqual(['model1', 'model2']);
        });
    });

    describe('getModelInfo', () => {
        it('should return model info when available', () => {
            provider.modelInfo = {
                'test-model': { name: 'Test Model', size: '7B' }
            };
            
            expect(provider.getModelInfo('test-model')).toEqual({
                name: 'Test Model',
                size: '7B'
            });
        });

        it('should return null when model info not available', () => {
            expect(provider.getModelInfo('non-existent')).toBeNull();
        });
    });

    describe('healthCheck', () => {
        it('should return initialization status', async () => {
            provider.isInitialized = true;
            expect(await provider.healthCheck()).toBe(true);

            provider.isInitialized = false;
            expect(await provider.healthCheck()).toBe(false);
        });

        it('should handle errors gracefully', async () => {
            provider.isInitialized = true;
            provider.healthCheck = jest.fn().mockRejectedValue(new Error('Health check failed'));

            expect(await provider.healthCheck()).toBe(false);
        });
    });

    describe('getStatus', () => {
        it('should return provider status', () => {
            provider.isInitialized = true;
            provider.availableModels = ['model1', 'model2'];

            const status = provider.getStatus();

            expect(status).toEqual({
                name: 'test-provider',
                initialized: true,
                availableModels: 2,
                baseUrl: 'https://api.test.com',
                hasApiKey: true
            });
        });
    });

    describe('destroy', () => {
        it('should clean up resources', () => {
            provider.isInitialized = true;
            provider.availableModels = ['model1'];
            provider.modelInfo = { 'model1': {} };

            provider.destroy();

            expect(provider.isInitialized).toBe(false);
            expect(provider.availableModels).toEqual([]);
            expect(provider.modelInfo).toEqual({});
        });
    });
}); 