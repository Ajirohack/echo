/**
 * AI Provider Manager
 * Manages multiple AI model providers and their selection
 */

const OllamaProvider = require('./ollama-provider');
const OpenRouterProvider = require('./openrouter-provider');
const GroqProvider = require('./groq-provider');
const HuggingFaceProvider = require('./huggingface-provider');

class AIProviderManager {
  constructor(config = {}) {
    this.providers = new Map();
    this.activeProvider = null;
    this.config = config;
    this.initialized = false;
  }

  /**
   * Initialize all configured providers
   */
  async initialize() {
    try {
      console.log('Initializing AI providers...');

      // Initialize Ollama provider
      if (this.config.ollama) {
        const ollamaProvider = new OllamaProvider(this.config.ollama);
        this.providers.set('ollama', ollamaProvider);
      }

      // Initialize OpenRouter provider
      if (this.config.openrouter) {
        const openrouterProvider = new OpenRouterProvider(this.config.openrouter);
        this.providers.set('openrouter', openrouterProvider);
      }

      // Initialize Groq provider
      if (this.config.groq) {
        const groqProvider = new GroqProvider(this.config.groq);
        this.providers.set('groq', groqProvider);
      }

      // Initialize Hugging Face provider
      if (this.config.huggingface) {
        const huggingfaceProvider = new HuggingFaceProvider(this.config.huggingface);
        this.providers.set('huggingface', huggingfaceProvider);
      }

      // Initialize all providers
      const initPromises = Array.from(this.providers.values()).map(async (provider) => {
        try {
          const success = await provider.initialize();
          if (success) {
            return { provider: provider.config.name, success: true };
          } else {
            return {
              provider: provider.config.name,
              success: false,
              error: 'Provider initialization failed',
            };
          }
        } catch (error) {
          console.error(`Failed to initialize ${provider.config.name}:`, error);
          return { provider: provider.config.name, success: false, error: error.message };
        }
      });

      const results = await Promise.allSettled(initPromises);
      const successfulProviders = results
        .filter((result) => result.status === 'fulfilled' && result.value.success)
        .map((result) => result.value.provider);

      console.log(
        `Successfully initialized ${successfulProviders.length} providers:`,
        successfulProviders
      );

      // Set default active provider
      if (successfulProviders.length > 0) {
        this.setActiveProvider(successfulProviders[0]);
      }

      this.initialized = true;
      const failedProviders = results.filter(
        (r) => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.success)
      );

      return {
        success: successfulProviders.length > 0,
        providers: successfulProviders,
        failed: failedProviders,
      };
    } catch (error) {
      console.error('Failed to initialize AI providers:', error);
      this.initialized = false;
      throw error;
    }
  }

  /**
   * Set active provider
   * @param {string} providerName - Provider name
   */
  setActiveProvider(providerName) {
    const provider = this.providers.get(providerName);
    if (!provider) {
      throw new Error(`Provider '${providerName}' not found`);
    }

    if (!provider.isInitialized) {
      throw new Error(`Provider '${providerName}' is not initialized`);
    }

    this.activeProvider = provider;
    console.log(`Active provider set to: ${providerName}`);
  }

  /**
   * Get active provider
   */
  getActiveProvider() {
    return this.activeProvider;
  }

  /**
   * Get provider by name
   * @param {string} providerName - Provider name
   */
  getProvider(providerName) {
    return this.providers.get(providerName);
  }

  /**
   * Get all providers
   */
  getAllProviders() {
    return Array.from(this.providers.values());
  }

  /**
   * Get available providers (initialized and healthy)
   */
  async getAvailableProviders() {
    const available = [];

    for (const [name, provider] of this.providers) {
      if (provider.isInitialized) {
        const healthy = await provider.healthCheck();
        if (healthy) {
          available.push({
            name,
            provider,
            status: provider.getStatus(),
          });
        }
      }
    }

    return available;
  }

  /**
   * Generate text using active provider
   * @param {string} prompt - Input prompt
   * @param {object} options - Generation options
   */
  async generateText(prompt, options = {}) {
    if (!this.activeProvider) {
      throw new Error('No active provider set');
    }

    return await this.activeProvider.generateText(prompt, options);
  }

  /**
   * Generate chat using active provider
   * @param {Array} messages - Array of message objects
   * @param {object} options - Generation options
   */
  async generateChat(messages, options = {}) {
    if (!this.activeProvider) {
      throw new Error('No active provider set');
    }

    return await this.activeProvider.generateChat(messages, options);
  }

  /**
   * Generate text using specific provider
   * @param {string} providerName - Provider name
   * @param {string} prompt - Input prompt
   * @param {object} options - Generation options
   */
  async generateTextWithProvider(providerName, prompt, options = {}) {
    const provider = this.providers.get(providerName);
    if (!provider) {
      throw new Error(`Provider '${providerName}' not found`);
    }

    return await provider.generateText(prompt, options);
  }

  /**
   * Generate chat using specific provider
   * @param {string} providerName - Provider name
   * @param {Array} messages - Array of message objects
   * @param {object} options - Generation options
   */
  async generateChatWithProvider(providerName, messages, options = {}) {
    const provider = this.providers.get(providerName);
    if (!provider) {
      throw new Error(`Provider '${providerName}' not found`);
    }

    return await provider.generateChat(messages, options);
  }

  /**
   * Get all available models from all providers
   */
  async getAllAvailableModels() {
    const allModels = [];

    for (const [providerName, provider] of this.providers) {
      if (provider.isInitialized) {
        const models = provider.getAvailableModels();
        allModels.push({
          provider: providerName,
          models: models,
          modelInfo: provider.modelInfo,
        });
      }
    }

    return allModels;
  }

  /**
   * Find model across all providers
   * @param {string} modelName - Model name to search for
   */
  async findModel(modelName) {
    for (const [providerName, provider] of this.providers) {
      if (provider.isInitialized) {
        const models = provider.getAvailableModels();
        const found = models.find((model) => model.id === modelName || model.name === modelName);

        if (found) {
          return {
            provider: providerName,
            model: found,
            info: provider.getModelInfo(found.id || found.name),
          };
        }
      }
    }

    return null;
  }

  /**
   * Get provider status
   */
  getStatus() {
    const status = {
      initialized: this.initialized,
      activeProvider: this.activeProvider?.config.name || null,
      providers: {},
    };

    for (const [name, provider] of this.providers) {
      status.providers[name] = {
        initialized: provider.isInitialized,
        availableModels: provider.getAvailableModels().length,
        status: provider.getStatus(),
      };
    }

    return status;
  }

  /**
   * Health check all providers
   */
  async healthCheck() {
    const healthStatus = {};

    for (const [name, provider] of this.providers) {
      try {
        const healthy = await provider.healthCheck();
        healthStatus[name] = {
          healthy,
          status: provider.getStatus(),
        };
      } catch (error) {
        healthStatus[name] = {
          healthy: false,
          error: error.message,
        };
      }
    }

    return healthStatus;
  }

  /**
   * Clean up all providers
   */
  destroy() {
    for (const provider of this.providers.values()) {
      provider.destroy();
    }

    this.providers.clear();
    this.activeProvider = null;
    this.initialized = false;
  }
}

module.exports = AIProviderManager;
