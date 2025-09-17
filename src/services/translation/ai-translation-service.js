/**
 * AI Translation Service
 * Uses AI models for enhanced translation capabilities
 */

const AIProviderManager = require('../ai-providers/provider-manager');
const fs = require('fs').promises;
const path = require('path');

class AITranslationService {
  constructor(config = {}) {
    this.config = {
      providersConfig: config.providersConfig || {},
      defaultProvider: config.defaultProvider || 'ollama',
      fallbackProvider: config.fallbackProvider || 'huggingface',
      translationPrompt: config.translationPrompt || this.getDefaultPrompt(),
      contextWindow: config.contextWindow || 4000,
      maxRetries: config.maxRetries || 3,
      ...config,
    };

    this.providerManager = new AIProviderManager(this.config.providersConfig);
    this.initialized = false;
    this.translationHistory = [];
  }

  /**
   * Get default translation prompt
   */
  getDefaultPrompt() {
    return `You are a professional translator. Translate the following text from {sourceLanguage} to {targetLanguage}. 

Guidelines:
- Maintain the original meaning and tone
- Preserve formatting and structure
- Keep proper nouns and technical terms unchanged unless there's a standard translation
- Ensure natural, fluent output in the target language
- If the text contains code or technical content, preserve it exactly

Text to translate:
{text}

Translation:`;
  }

  /**
   * Initialize the AI translation service
   */
  async initialize() {
    try {
      console.log('Initializing AI Translation Service...');

      const result = await this.providerManager.initialize();

      if (result.success) {
        this.initialized = true;
        console.log('AI Translation Service initialized successfully');
        return true;
      } else {
        console.error('Failed to initialize AI providers:', result.failed);
        return false;
      }
    } catch (error) {
      console.error('Failed to initialize AI Translation Service:', error);
      return false;
    }
  }

  /**
   * Translate text using AI
   * @param {string} text - Text to translate
   * @param {string} sourceLanguage - Source language code
   * @param {string} targetLanguage - Target language code
   * @param {object} options - Translation options
   */
  async translate(text, sourceLanguage, targetLanguage, options = {}) {
    if (!this.initialized) {
      throw new Error('AI Translation Service not initialized');
    }

    const {
      provider = this.config.defaultProvider,
      model = null,
      context = '',
      preserveFormatting = true,
      technicalContent = false,
      retryCount = 0,
    } = options;

    try {
      // Build translation prompt
      const prompt = this.buildTranslationPrompt(text, sourceLanguage, targetLanguage, {
        context,
        preserveFormatting,
        technicalContent,
      });

      // Prepare messages for chat completion
      const messages = [
        {
          role: 'system',
          content:
            'You are a professional translator. Provide only the translation without any explanations or additional text.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ];

      // Generate translation
      const result = await this.providerManager.generateChatWithProvider(provider, messages, {
        model,
        temperature: 0.3, // Lower temperature for more consistent translations
        max_tokens: Math.min(this.config.contextWindow, text.length * 3),
        ...options,
      });

      const translation = result.message.content.trim();

      // Store in history
      this.translationHistory.push({
        timestamp: new Date(),
        sourceLanguage,
        targetLanguage,
        sourceText: text,
        translatedText: translation,
        provider,
        model: model || 'default',
        context,
        options,
      });

      return {
        translatedText: translation,
        sourceLanguage,
        targetLanguage,
        provider,
        model: model || 'default',
        confidence: this.calculateConfidence(text, translation),
        metadata: {
          provider,
          model: model || 'default',
          contextLength: text.length,
          translationLength: translation.length,
        },
      };
    } catch (error) {
      console.error(`Translation failed with provider ${provider}:`, error);

      // Retry with fallback provider if available
      if (retryCount < this.config.maxRetries && provider !== this.config.fallbackProvider) {
        console.log(`Retrying with fallback provider: ${this.config.fallbackProvider}`);
        return await this.translate(text, sourceLanguage, targetLanguage, {
          ...options,
          provider: this.config.fallbackProvider,
          retryCount: retryCount + 1,
        });
      }

      throw new Error(`Translation failed: ${error.message}`);
    }
  }

  /**
   * Build translation prompt
   * @param {string} text - Text to translate
   * @param {string} sourceLanguage - Source language
   * @param {string} targetLanguage - Target language
   * @param {object} options - Prompt options
   */
  buildTranslationPrompt(text, sourceLanguage, targetLanguage, options = {}) {
    let prompt = this.config.translationPrompt
      .replace('{sourceLanguage}', sourceLanguage)
      .replace('{targetLanguage}', targetLanguage)
      .replace('{text}', text);

    // Add context if provided
    if (options.context) {
      prompt = `Context: ${options.context}\n\n${prompt}`;
    }

    // Add technical content instructions
    if (options.technicalContent) {
      prompt +=
        '\n\nNote: This text contains technical content. Preserve code blocks, technical terms, and formatting exactly as they appear.';
    }

    // Add formatting preservation instructions
    if (options.preserveFormatting) {
      prompt +=
        '\n\nNote: Preserve all formatting, line breaks, and structure of the original text.';
    }

    return prompt;
  }

  /**
   * Calculate translation confidence (simple heuristic)
   * @param {string} sourceText - Source text
   * @param {string} translatedText - Translated text
   */
  calculateConfidence(sourceText, translatedText) {
    // Simple confidence calculation based on length ratio
    const sourceLength = sourceText.length;
    const translationLength = translatedText.length;

    if (sourceLength === 0) return 0;

    const ratio = translationLength / sourceLength;

    // Reasonable translation length ratio is between 0.5 and 2.0
    if (ratio >= 0.5 && ratio <= 2.0) {
      return Math.min(0.9, 0.7 + 0.2 * (1 - Math.abs(1 - ratio)));
    }

    return 0.5; // Lower confidence for unusual length ratios
  }

  /**
   * Batch translate multiple texts
   * @param {Array} texts - Array of texts to translate
   * @param {string} sourceLanguage - Source language
   * @param {string} targetLanguage - Target language
   * @param {object} options - Translation options
   */
  async batchTranslate(texts, sourceLanguage, targetLanguage, options = {}) {
    const results = [];
    const batchSize = options.batchSize || 5;

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      const batchPromises = batch.map((text) =>
        this.translate(text, sourceLanguage, targetLanguage, options)
      );

      const batchResults = await Promise.allSettled(batchPromises);

      batchResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          results.push({
            error: result.reason.message,
            sourceText: batch[index],
            sourceLanguage,
            targetLanguage,
          });
        }
      });

      // Add delay between batches to avoid rate limiting
      if (i + batchSize < texts.length) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    return results;
  }

  /**
   * Get translation history
   * @param {object} filters - Filter options
   */
  getTranslationHistory(filters = {}) {
    let history = [...this.translationHistory];

    if (filters.provider) {
      history = history.filter((item) => item.provider === filters.provider);
    }

    if (filters.sourceLanguage) {
      history = history.filter((item) => item.sourceLanguage === filters.sourceLanguage);
    }

    if (filters.targetLanguage) {
      history = history.filter((item) => item.targetLanguage === filters.targetLanguage);
    }

    if (filters.startDate) {
      history = history.filter((item) => item.timestamp >= new Date(filters.startDate));
    }

    if (filters.endDate) {
      history = history.filter((item) => item.timestamp <= new Date(filters.endDate));
    }

    return history.sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Get available providers
   */
  async getAvailableProviders() {
    return await this.providerManager.getAvailableProviders();
  }

  /**
   * Get all available models
   */
  async getAllAvailableModels() {
    return await this.providerManager.getAllAvailableModels();
  }

  /**
   * Set active provider
   * @param {string} providerName - Provider name
   */
  setActiveProvider(providerName) {
    this.providerManager.setActiveProvider(providerName);
  }

  /**
   * Health check
   */
  async healthCheck() {
    if (!this.initialized) {
      return { healthy: false, error: 'Service not initialized' };
    }

    try {
      const healthStatus = await this.providerManager.healthCheck();
      const healthyProviders = Object.values(healthStatus).filter((p) => p.healthy);

      return {
        healthy: healthyProviders.length > 0,
        providers: healthStatus,
        activeProvider: this.providerManager.getActiveProvider()?.config.name,
      };
    } catch (error) {
      return { healthy: false, error: error.message };
    }
  }

  /**
   * Get service status
   */
  getStatus() {
    return {
      initialized: this.initialized,
      providerStatus: this.providerManager.getStatus(),
      translationHistoryCount: this.translationHistory.length,
      config: {
        defaultProvider: this.config.defaultProvider,
        fallbackProvider: this.config.fallbackProvider,
        contextWindow: this.config.contextWindow,
      },
    };
  }

  /**
   * Save translation history to file
   * @param {string} filePath - File path to save to
   */
  async saveHistory(filePath) {
    try {
      const historyData = {
        timestamp: new Date(),
        history: this.translationHistory,
      };

      await fs.writeFile(filePath, JSON.stringify(historyData, null, 2));
      console.log(`Translation history saved to: ${filePath}`);
    } catch (error) {
      console.error('Failed to save translation history:', error);
      throw error;
    }
  }

  /**
   * Load translation history from file
   * @param {string} filePath - File path to load from
   */
  async loadHistory(filePath) {
    try {
      const data = await fs.readFile(filePath, 'utf8');
      const historyData = JSON.parse(data);

      if (historyData.history && Array.isArray(historyData.history)) {
        this.translationHistory = historyData.history.map((item) => ({
          ...item,
          timestamp: new Date(item.timestamp),
        }));
        console.log(`Loaded ${this.translationHistory.length} translation history entries`);
      }
    } catch (error) {
      console.error('Failed to load translation history:', error);
      throw error;
    }
  }

  /**
   * Clear translation history
   */
  clearHistory() {
    this.translationHistory = [];
    console.log('Translation history cleared');
  }

  /**
   * Destroy the service
   */
  destroy() {
    this.providerManager.destroy();
    this.initialized = false;
    this.translationHistory = [];
  }
}

module.exports = AITranslationService;
