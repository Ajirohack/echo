/**
 * Base AI Provider
 * Abstract base class for all AI model providers
 */

class BaseAIProvider {
  constructor(config = {}) {
    this.config = {
      name: config.name || 'base',
      baseUrl: config.baseUrl || '',
      apiKey: config.apiKey || '',
      defaultModel: config.defaultModel || '',
      timeout: config.timeout || 30000,
      maxRetries: config.maxRetries || 3,
      ...config,
    };

    this.isInitialized = false;
    this.availableModels = [];
    this.modelInfo = {};
  }

  /**
   * Initialize the provider
   * @returns {Promise<boolean>} Success status
   */
  async initialize() {
    try {
      await this.validateConfig();
      await this.loadAvailableModels();
      this.isInitialized = true;
      return true;
    } catch (error) {
      console.error(`Failed to initialize ${this.config.name} provider:`, error);
      return false;
    }
  }

  /**
   * Validate provider configuration
   * @returns {Promise<void>}
   */
  async validateConfig() {
    // Override in subclasses
    throw new Error('validateConfig must be implemented by subclass');
  }

  /**
   * Load available models
   * @returns {Promise<void>}
   */
  async loadAvailableModels() {
    // Override in subclasses
    this.availableModels = [];
  }

  /**
   * Generate text completion
   * @param {string} prompt - Input prompt
   * @param {object} options - Generation options
   * @returns {Promise<object>} Generation result
   */
  async generateText(prompt, options = {}) {
    throw new Error('generateText must be implemented by subclass');
  }

  /**
   * Generate chat completion
   * @param {Array} messages - Array of message objects
   * @param {object} options - Generation options
   * @returns {Promise<object>} Chat completion result
   */
  async generateChat(messages, options = {}) {
    throw new Error('generateChat must be implemented by subclass');
  }

  /**
   * Get available models
   * @returns {Array} Array of available models
   */
  getAvailableModels() {
    return this.availableModels;
  }

  /**
   * Get model information
   * @param {string} modelId - Model identifier
   * @returns {object} Model information
   */
  getModelInfo(modelId) {
    return this.modelInfo[modelId] || null;
  }

  /**
   * Check if provider is healthy
   * @returns {Promise<boolean>} Health status
   */
  async healthCheck() {
    try {
      // Basic health check - override in subclasses for specific checks
      return this.isInitialized;
    } catch (error) {
      console.error(`Health check failed for ${this.config.name}:`, error);
      return false;
    }
  }

  /**
   * Get provider status
   * @returns {object} Provider status information
   */
  getStatus() {
    return {
      name: this.config.name,
      initialized: this.isInitialized,
      availableModels: this.availableModels.length,
      baseUrl: this.config.baseUrl,
      hasApiKey: !!this.config.apiKey,
    };
  }

  /**
   * Clean up resources
   */
  destroy() {
    this.isInitialized = false;
    this.availableModels = [];
    this.modelInfo = {};
  }
}

module.exports = BaseAIProvider;
