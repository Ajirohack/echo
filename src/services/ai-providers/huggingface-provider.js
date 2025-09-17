/**
 * Hugging Face AI Provider
 * Access to thousands of AI models through Inference API
 */

const BaseAIProvider = require('./base-provider');

class HuggingFaceProvider extends BaseAIProvider {
  constructor(config = {}) {
    super({
      name: 'huggingface',
      baseUrl: 'https://api-inference.huggingface.co/models',
      apiKey: config.apiKey || process.env.HUGGINGFACE_API_KEY,
      defaultModel: config.defaultModel || 'google/gemma-7b-it',
      ...config,
    });
  }

  /**
   * Validate Hugging Face configuration
   */
  async validateConfig() {
    // API key is optional for public models
    if (!this.config.apiKey) {
      console.warn(
        'Hugging Face API key not provided. Using public models with limited rate limits.'
      );
    }

    // Test API connection with a simple model
    try {
      const testModel = 'gpt2';
      const response = await fetch(`${this.config.baseUrl}/${testModel}`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          inputs: 'Hello',
          parameters: {
            max_new_tokens: 1,
            return_full_text: false,
          },
        }),
      });

      // 503 is expected for model loading, 401 for auth issues
      if (response.status === 401) {
        throw new Error('Invalid Hugging Face API key');
      }
    } catch (error) {
      if (error.message.includes('Invalid Hugging Face API key')) {
        throw error;
      }
      // Other errors are acceptable for validation
      console.warn('Hugging Face validation warning:', error.message);
    }
  }

  /**
   * Get request headers for Hugging Face API
   */
  getHeaders() {
    const headers = {
      'Content-Type': 'application/json',
    };

    if (this.config.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    }

    return headers;
  }

  /**
   * Load available models from Hugging Face
   */
  async loadAvailableModels() {
    try {
      // Note: Hugging Face doesn't provide a simple API to list all available models
      // We'll use a curated list of popular models
      this.availableModels = [
        { id: 'google/gemma-7b-it', name: 'Gemma 7B Instruct', type: 'text-generation' },
        {
          id: 'mistralai/Mistral-7B-Instruct-v0.2',
          name: 'Mistral 7B Instruct',
          type: 'text-generation',
        },
        { id: 'microsoft/DialoGPT-large', name: 'DialoGPT Large', type: 'text-generation' },
        { id: 'meta-llama/Llama-2-7b-chat-hf', name: 'Llama 2 7B Chat', type: 'text-generation' },
        {
          id: 'NousResearch/Nous-Hermes-2-Mixtral-8x7B-DPO',
          name: 'Nous Hermes 2 Mixtral',
          type: 'text-generation',
        },
        { id: 'bigcode/starcoder', name: 'StarCoder', type: 'text-generation' },
        { id: 'WizardLM/WizardCoder-15B-V1.0', name: 'WizardCoder 15B', type: 'text-generation' },
        { id: 'gpt2', name: 'GPT-2', type: 'text-generation' },
        { id: 'distilgpt2', name: 'DistilGPT-2', type: 'text-generation' },
      ];

      // Store model information
      this.availableModels.forEach((model) => {
        this.modelInfo[model.id] = {
          id: model.id,
          name: model.name,
          type: model.type,
          context_length: this.getModelContextLength(model.id),
          requires_auth: this.requiresAuthentication(model.id),
        };
      });

      console.log(`Loaded ${this.availableModels.length} Hugging Face models`);
    } catch (error) {
      console.error('Failed to load Hugging Face models:', error);
      this.availableModels = [];
    }
  }

  /**
   * Get context length for a model
   * @param {string} modelId - Model identifier
   */
  getModelContextLength(modelId) {
    const contextLengths = {
      'google/gemma-7b-it': 8192,
      'mistralai/Mistral-7B-Instruct-v0.2': 8192,
      'microsoft/DialoGPT-large': 1024,
      'meta-llama/Llama-2-7b-chat-hf': 4096,
      'NousResearch/Nous-Hermes-2-Mixtral-8x7B-DPO': 32768,
      'bigcode/starcoder': 8192,
      'WizardLM/WizardCoder-15B-V1.0': 8192,
      gpt2: 1024,
      distilgpt2: 1024,
    };
    return contextLengths[modelId] || 2048;
  }

  /**
   * Check if model requires authentication
   * @param {string} modelId - Model identifier
   */
  requiresAuthentication(modelId) {
    const gatedModels = [
      'meta-llama/Llama-2-7b-chat-hf',
      'NousResearch/Nous-Hermes-2-Mixtral-8x7B-DPO',
    ];
    return gatedModels.includes(modelId);
  }

  /**
   * Generate text completion using Hugging Face
   * @param {string} prompt - Input prompt
   * @param {object} options - Generation options
   */
  async generateText(prompt, options = {}) {
    const model = options.model || this.config.defaultModel;

    try {
      const response = await fetch(`${this.config.baseUrl}/${model}`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          inputs: prompt,
          parameters: {
            temperature: options.temperature || 0.7,
            max_new_tokens: options.max_tokens || 100,
            do_sample: options.do_sample !== false,
            return_full_text: options.return_full_text || false,
            ...options,
          },
        }),
      });

      if (!response.ok) {
        if (response.status === 503) {
          throw new Error(
            `Model ${model} is currently loading. Please try again in a few moments.`
          );
        }
        if (response.status === 401) {
          throw new Error(
            `Model ${model} requires authentication. Please provide a valid API key.`
          );
        }
        throw new Error(`Hugging Face API error: ${response.status}`);
      }

      const data = await response.json();

      // Handle different response formats
      let generatedText = '';
      if (Array.isArray(data)) {
        generatedText = data[0]?.generated_text || data[0] || '';
      } else if (typeof data === 'string') {
        generatedText = data;
      } else {
        generatedText = data.generated_text || data.text || '';
      }

      return {
        text: generatedText,
        model: model,
        usage: {
          prompt_tokens: prompt.length,
          completion_tokens: generatedText.length,
          total_tokens: prompt.length + generatedText.length,
        },
        finish_reason: 'stop',
      };
    } catch (error) {
      console.error('Hugging Face text generation error:', error);
      throw error;
    }
  }

  /**
   * Generate chat completion using Hugging Face
   * @param {Array} messages - Array of message objects
   * @param {object} options - Generation options
   */
  async generateChat(messages, options = {}) {
    const model = options.model || this.config.defaultModel;

    // Convert messages to prompt format
    const prompt = this.formatMessagesToPrompt(messages);

    try {
      const result = await this.generateText(prompt, options);

      return {
        message: {
          role: 'assistant',
          content: result.text,
        },
        model: model,
        usage: result.usage,
        finish_reason: result.finish_reason,
      };
    } catch (error) {
      console.error('Hugging Face chat generation error:', error);
      throw error;
    }
  }

  /**
   * Format messages to prompt for text generation models
   * @param {Array} messages - Array of message objects
   */
  formatMessagesToPrompt(messages) {
    let prompt = '';

    for (const message of messages) {
      if (message.role === 'system') {
        prompt += `System: ${message.content}\n\n`;
      } else if (message.role === 'user') {
        prompt += `User: ${message.content}\n`;
      } else if (message.role === 'assistant') {
        prompt += `Assistant: ${message.content}\n`;
      }
    }

    prompt += 'Assistant: ';
    return prompt;
  }

  /**
   * Stream chat completion (not supported by all HF models)
   * @param {Array} messages - Array of message objects
   * @param {object} options - Generation options
   * @param {Function} onChunk - Callback for each chunk
   */
  async streamChat(messages, options = {}, onChunk) {
    // Hugging Face doesn't support streaming for most models
    // We'll fall back to non-streaming
    const result = await this.generateChat(messages, options);
    if (onChunk) {
      onChunk({
        choices: [
          {
            delta: { content: result.message.content },
            finish_reason: result.finish_reason,
          },
        ],
      });
      onChunk({ done: true });
    }
    return result;
  }

  /**
   * Get models by type
   * @param {string} type - Model type (e.g., 'text-generation')
   */
  getModelsByType(type) {
    return this.availableModels.filter((model) => model.type === type);
  }

  /**
   * Get public models (no auth required)
   */
  getPublicModels() {
    return this.availableModels.filter((model) => !this.requiresAuthentication(model.id));
  }

  /**
   * Get gated models (auth required)
   */
  getGatedModels() {
    return this.availableModels.filter((model) => this.requiresAuthentication(model.id));
  }

  /**
   * Health check for Hugging Face
   */
  async healthCheck() {
    try {
      const response = await fetch(`${this.config.baseUrl}/gpt2`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          inputs: 'test',
          parameters: { max_new_tokens: 1 },
        }),
      });

      // 503 is acceptable (model loading), 401 is acceptable (no auth)
      return response.status === 200 || response.status === 503 || response.status === 401;
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
      publicModels: this.getPublicModels().length,
      gatedModels: this.getGatedModels().length,
      modelTypes: [...new Set(this.availableModels.map((m) => m.type))],
    };
  }
}

module.exports = HuggingFaceProvider;
