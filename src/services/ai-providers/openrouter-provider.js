/**
 * OpenRouter AI Provider
 * Unified API for multiple AI models from different providers
 */

const BaseAIProvider = require('./base-provider');

class OpenRouterProvider extends BaseAIProvider {
  constructor(config = {}) {
    super({
      name: 'openrouter',
      baseUrl: 'https://openrouter.ai/api/v1',
      apiKey: config.apiKey || process.env.OPENROUTER_API_KEY,
      defaultModel: config.defaultModel || 'openai/gpt-3.5-turbo',
      appName: config.appName || process.env.OPENROUTER_APP_NAME || 'Translation App',
      appUrl:
        config.appUrl || process.env.OPENROUTER_APP_URL || 'https://github.com/translation-app',
      ...config,
    });
  }

  /**
   * Validate OpenRouter configuration
   */
  async validateConfig() {
    if (!this.config.apiKey) {
      throw new Error('OpenRouter API key is required');
    }

    // Validate API key format using centralized validation
    const ApiKeyManager = require('../security/api-key-manager');
    const keyManager = new ApiKeyManager();
    if (!keyManager.isValidApiKeyFormat('openai', this.config.apiKey)) {
      throw new Error('Invalid OpenRouter API key format');
    }

    if (!this.config.appName || !this.config.appUrl) {
      throw new Error('OpenRouter app name and URL are required');
    }

    // Test API connection
    try {
      const response = await fetch(`${this.config.baseUrl}/models`, {
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        throw new Error(`OpenRouter API test failed: ${response.status}`);
      }
    } catch (error) {
      throw new Error(`OpenRouter configuration validation failed: ${error.message}`);
    }
  }

  /**
   * Get request headers for OpenRouter API
   */
  getHeaders() {
    return {
      Authorization: `Bearer ${this.config.apiKey}`,
      'HTTP-Referer': this.config.appUrl,
      'X-Title': this.config.appName,
      'Content-Type': 'application/json',
    };
  }

  /**
   * Load available models from OpenRouter
   */
  async loadAvailableModels() {
    try {
      const response = await fetch(`${this.config.baseUrl}/models`, {
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch models: ${response.status}`);
      }

      const data = await response.json();
      this.availableModels = data.data || [];

      // Store model information with pricing and capabilities
      this.availableModels.forEach((model) => {
        this.modelInfo[model.id] = {
          id: model.id,
          name: model.name,
          description: model.description,
          pricing: model.pricing,
          context_length: model.context_length,
          architecture: model.architecture,
          top_provider: model.top_provider,
          per_request_limits: model.per_request_limits,
          tags: model.tags || [],
          is_free: model.pricing?.prompt === '0' && model.pricing?.completion === '0',
        };
      });

      console.log(`Loaded ${this.availableModels.length} OpenRouter models`);
    } catch (error) {
      console.error('Failed to load OpenRouter models:', error);
      this.availableModels = [];
    }
  }

  /**
   * Get models by provider
   * @param {string} provider - Provider name (e.g., 'openai', 'anthropic')
   */
  getModelsByProvider(provider) {
    return this.availableModels.filter((model) => model.id.startsWith(provider + '/'));
  }

  /**
   * Get free models
   */
  getFreeModels() {
    return this.availableModels.filter((model) => this.modelInfo[model.id]?.is_free);
  }

  /**
   * Get paid models
   */
  getPaidModels() {
    return this.availableModels.filter((model) => !this.modelInfo[model.id]?.is_free);
  }

  /**
   * Generate text completion using OpenRouter
   * @param {string} prompt - Input prompt
   * @param {object} options - Generation options
   */
  async generateText(prompt, options = {}) {
    const model = options.model || this.config.defaultModel;

    try {
      const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          model: model,
          messages: [{ role: 'user', content: prompt }],
          temperature: options.temperature || 0.7,
          max_tokens: options.max_tokens || 1024,
          stream: false,
          ...options,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          `OpenRouter API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`
        );
      }

      const data = await response.json();
      return {
        text: data.choices[0]?.message?.content || '',
        model: model,
        usage: data.usage,
        finish_reason: data.choices[0]?.finish_reason || 'stop',
      };
    } catch (error) {
      console.error('OpenRouter text generation error:', error);
      throw error;
    }
  }

  /**
   * Generate chat completion using OpenRouter
   * @param {Array} messages - Array of message objects
   * @param {object} options - Generation options
   */
  async generateChat(messages, options = {}) {
    const model = options.model || this.config.defaultModel;

    try {
      const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          model: model,
          messages: messages,
          temperature: options.temperature || 0.7,
          max_tokens: options.max_tokens || 1024,
          stream: false,
          ...options,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          `OpenRouter API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`
        );
      }

      const data = await response.json();
      return {
        message: data.choices[0]?.message,
        model: model,
        usage: data.usage,
        finish_reason: data.choices[0]?.finish_reason || 'stop',
      };
    } catch (error) {
      console.error('OpenRouter chat generation error:', error);
      throw error;
    }
  }

  /**
   * Stream chat completion
   * @param {Array} messages - Array of message objects
   * @param {object} options - Generation options
   * @param {Function} onChunk - Callback for each chunk
   */
  async streamChat(messages, options = {}, onChunk) {
    const model = options.model || this.config.defaultModel;

    try {
      const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          model: model,
          messages: messages,
          temperature: options.temperature || 0.7,
          max_tokens: options.max_tokens || 1024,
          stream: true,
          ...options,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          `OpenRouter API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`
        );
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter((line) => line.trim());

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
              if (onChunk) onChunk({ done: true });
              break;
            }

            try {
              const parsed = JSON.parse(data);
              if (onChunk) onChunk(parsed);
            } catch (e) {
              // Skip invalid JSON
            }
          }
        }
      }
    } catch (error) {
      console.error('OpenRouter streaming error:', error);
      throw error;
    }
  }

  /**
   * Get user information and usage
   */
  async getUserInfo() {
    try {
      const response = await fetch(`${this.config.baseUrl}/auth/key`, {
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        throw new Error(`Failed to get user info: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to get OpenRouter user info:', error);
      throw error;
    }
  }

  /**
   * Health check for OpenRouter
   */
  async healthCheck() {
    try {
      const response = await fetch(`${this.config.baseUrl}/models`, {
        headers: this.getHeaders(),
      });
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get provider status with model information
   */
  getStatus() {
    const status = super.getStatus();
    return {
      ...status,
      freeModels: this.getFreeModels().length,
      paidModels: this.getPaidModels().length,
      providers: [...new Set(this.availableModels.map((m) => m.id.split('/')[0]))],
    };
  }
}

module.exports = OpenRouterProvider;
