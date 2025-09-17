/**
 * Groq AI Provider
 * High-performance AI model provider
 */

const BaseAIProvider = require('./base-provider');

class GroqProvider extends BaseAIProvider {
  constructor(config = {}) {
    super({
      name: 'groq',
      baseUrl: 'https://api.groq.com/openai/v1',
      apiKey: config.apiKey || process.env.GROQ_API_KEY,
      defaultModel: config.defaultModel || 'mixtral-8x7b-32768',
      ...config,
    });
  }

  /**
   * Validate Groq configuration
   */
  async validateConfig() {
    if (!this.config.apiKey) {
      throw new Error('Groq API key is required');
    }

    // Validate API key format using centralized validation
    const ApiKeyManager = require('../security/api-key-manager');
    const keyManager = new ApiKeyManager();
    if (!keyManager.isValidApiKeyFormat('openai', this.config.apiKey)) {
      throw new Error('Invalid Groq API key format');
    }

    // Test API connection
    try {
      const response = await fetch(`${this.config.baseUrl}/models`, {
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        throw new Error(`Groq API test failed: ${response.status}`);
      }
    } catch (error) {
      throw new Error(`Groq configuration validation failed: ${error.message}`);
    }
  }

  /**
   * Get request headers for Groq API
   */
  getHeaders() {
    return {
      Authorization: `Bearer ${this.config.apiKey}`,
      'Content-Type': 'application/json',
    };
  }

  /**
   * Load available models from Groq
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

      // Store model information
      this.availableModels.forEach((model) => {
        this.modelInfo[model.id] = {
          id: model.id,
          object: model.object,
          created: model.created,
          owned_by: model.owned_by,
          context_length: this.getModelContextLength(model.id),
        };
      });

      console.log(`Loaded ${this.availableModels.length} Groq models`);
    } catch (error) {
      console.error('Failed to load Groq models:', error);
      // Set default models if API fails
      this.availableModels = [
        { id: 'mixtral-8x7b-32768', object: 'model' },
        { id: 'llama2-70b-4096', object: 'model' },
        { id: 'llama3-70b-8192', object: 'model' },
      ];
    }
  }

  /**
   * Get context length for a model
   * @param {string} modelId - Model identifier
   */
  getModelContextLength(modelId) {
    const contextLengths = {
      'mixtral-8x7b-32768': 32768,
      'llama2-70b-4096': 4096,
      'llama3-70b-8192': 8192,
    };
    return contextLengths[modelId] || 4096;
  }

  /**
   * Generate text completion using Groq
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
          `Groq API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`
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
      console.error('Groq text generation error:', error);
      throw error;
    }
  }

  /**
   * Generate chat completion using Groq
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
          `Groq API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`
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
      console.error('Groq chat generation error:', error);
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
          `Groq API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`
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
      console.error('Groq streaming error:', error);
      throw error;
    }
  }

  /**
   * Health check for Groq
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
   * Get provider status with performance information
   */
  getStatus() {
    const status = super.getStatus();
    return {
      ...status,
      performance: 'High-speed inference',
      contextLengths: this.availableModels.map((m) => ({
        model: m.id,
        contextLength: this.getModelContextLength(m.id),
      })),
    };
  }
}

module.exports = GroqProvider;
