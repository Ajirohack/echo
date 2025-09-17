/**
 * Translation Pipeline
 * Connects Speech-to-Text → Translation → Text-to-Speech
 * for real-time end-to-end translation processing.
 */

const STTManager = require('../services/stt/STTManager');
const TranslationManager = require('../services/translation/translation-manager');
const EventEmitter = require('events');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');

class TranslationPipeline extends EventEmitter {
  constructor(config = {}) {
    super();

    // Configuration
    this.config = {
      enableSTT: true,
      enableTranslation: true,
      enableTTS: false, // Will be enabled in Phase 5
      autoActivate: false,
      confidenceThreshold: 0.7,
      contextWindowSize: 10,
      ...config,
    };

    // Core components
    this.sttManager = new STTManager();
    this.translationManager = new TranslationManager();
    this.ttsManager = null; // Will be added in Phase 5

    // State management
    this.isActive = false;
    this.isInitialized = false;
    this.sourceLanguage = 'en';
    this.targetLanguage = 'es';
    this.currentConversationId = null;
    this.pipelineStages = [];

    // Metrics
    this.metrics = {
      totalTranslations: 0,
      lastProcessingTime: 0,
      averageLatency: 0,
      successRate: 1.0,
      sttLatency: 0,
      translationLatency: 0,
      ttsLatency: 0,
    };
  }

  /**
   * Initialize complete pipeline
   *
   * @returns {Promise<object>} Initialization result
   */
  async initialize() {
    try {
      console.log('Initializing translation pipeline...');

      // Initialize all components
      const results = {
        stt: this.config.enableSTT
          ? await this.sttManager.initialize()
          : { success: false, disabled: true },
        translation: this.config.enableTranslation
          ? await this.translationManager.initialize()
          : { success: false, disabled: true },
        tts:
          this.config.enableTTS && this.ttsManager
            ? await this.ttsManager.initialize()
            : { success: false, disabled: true },
      };

      // Set up event handlers
      this.setupEventHandlers();

      // Create a new conversation
      this.currentConversationId = uuidv4();

      // Determine available pipeline stages
      this.pipelineStages = [];
      if (results.stt?.success) this.pipelineStages.push('stt');
      if (results.translation?.success) this.pipelineStages.push('translation');
      if (results.tts?.success) this.pipelineStages.push('tts');

      this.isInitialized = true;

      // Auto-activate if configured
      if (this.config.autoActivate) {
        await this.activate();
      }

      return {
        success: true,
        components: results,
        pipelineStages: this.pipelineStages,
        conversationId: this.currentConversationId,
      };
    } catch (error) {
      console.error('Translation pipeline initialization failed:', error);
      throw error;
    }
  }

  /**
   * Setup event handlers for the pipeline
   */
  setupEventHandlers() {
    // STT to Translation pipeline
    if (this.sttManager) {
      this.sttManager.on('transcription', async (result) => {
        if (this.isActive && result.confidence >= this.config.confidenceThreshold) {
          await this.processTranscription(result);
        }
      });

      this.sttManager.on('error', (error) => {
        this.emit('pipelineError', {
          stage: 'stt',
          error: error.message || 'Speech recognition error',
          timestamp: Date.now(),
        });
      });
    }

    // Translation events
    if (this.translationManager) {
      this.translationManager.on('translationComplete', (result) => {
        this.emit('pipelineResult', {
          type: 'translation',
          result,
          timestamp: Date.now(),
        });
      });

      this.translationManager.on('translationError', (error) => {
        this.emit('pipelineError', {
          stage: 'translation',
          error: error.message || 'Translation error',
          timestamp: Date.now(),
        });
      });
    }

    // TTS events will be added in Phase 5
  }

  /**
   * Process transcription through translation
   *
   * @param {object} sttResult - STT result
   * @returns {Promise<object>} Complete pipeline result
   */
  async processTranscription(sttResult) {
    try {
      if (!this.isActive || !this.isInitialized) {
        throw new Error('Pipeline is not active');
      }

      const startTime = Date.now();
      const sttProcessingTime = sttResult.processingTime || 0;

      // Extract detected language if available
      const detectedLanguage = sttResult.language || this.sourceLanguage;

      // Build context for translation
      const context = this.buildTranslationContext(sttResult);

      // Perform translation
      const translationResult = await this.translationManager.translate(
        sttResult.text,
        detectedLanguage,
        this.targetLanguage,
        {
          context: context,
          conversationId: this.currentConversationId,
        }
      );

      const translationProcessingTime = translationResult.processingTime || 0;
      const totalProcessingTime = Date.now() - startTime + sttProcessingTime;

      // Update metrics
      this.metrics.totalTranslations++;
      this.metrics.lastProcessingTime = totalProcessingTime;
      this.metrics.sttLatency = this.metrics.sttLatency * 0.8 + sttProcessingTime * 0.2;
      this.metrics.translationLatency =
        this.metrics.translationLatency * 0.8 + translationProcessingTime * 0.2;
      this.metrics.averageLatency = this.metrics.averageLatency * 0.8 + totalProcessingTime * 0.2;

      // Combine results
      const completeResult = {
        original: sttResult.text,
        translated: translationResult.translation,
        fromLanguage: detectedLanguage,
        toLanguage: this.targetLanguage,
        confidence: {
          stt: sttResult.confidence,
          translation: translationResult.confidence || 0.8,
        },
        services: {
          stt: sttResult.service,
          translation: translationResult.service,
        },
        processingTime: {
          stt: sttProcessingTime,
          translation: translationProcessingTime,
          total: totalProcessingTime,
        },
        source: sttResult.source || 'microphone',
        timestamp: Date.now(),
        conversationId: this.currentConversationId,
      };

      // Emit complete result
      this.emit('pipelineResult', {
        type: 'complete',
        result: completeResult,
        timestamp: Date.now(),
      });

      return completeResult;
    } catch (error) {
      console.error('Transcription processing failed:', error);

      this.emit('pipelineError', {
        stage: 'processing',
        error: error.message,
        stt: sttResult,
        timestamp: Date.now(),
      });

      return {
        success: false,
        error: error.message,
        timestamp: Date.now(),
      };
    }
  }

  /**
   * Build context for translation
   *
   * @param {object} sttResult - STT result
   * @returns {string} Context for translation
   */
  buildTranslationContext(sttResult) {
    const contextParts = [];

    // Add source of transcription (e.g., microphone, file)
    if (sttResult.source) {
      contextParts.push(`Source: ${sttResult.source}`);
    }

    // Add confidence level context
    if (sttResult.confidence) {
      const confidenceLevel =
        sttResult.confidence >= 0.9 ? 'high' : sttResult.confidence >= 0.7 ? 'medium' : 'low';
      contextParts.push(`Confidence: ${confidenceLevel}`);
    }

    // Add any metadata from STT
    if (sttResult.metadata) {
      if (sttResult.metadata.domain) {
        contextParts.push(`Domain: ${sttResult.metadata.domain}`);
      }

      if (sttResult.metadata.speaker) {
        contextParts.push(`Speaker: ${sttResult.metadata.speaker}`);
      }
    }

    return contextParts.join(', ');
  }

  /**
   * Start pipeline with audio input
   *
   * @param {Buffer|string} audioData - Audio data or file path
   * @param {object} options - Pipeline options
   * @returns {Promise<object>} Pipeline result
   */
  async startPipeline(audioData, options = {}) {
    try {
      if (!this.isInitialized) {
        throw new Error('Pipeline not initialized');
      }

      // Override languages if provided
      if (options.sourceLanguage) {
        this.sourceLanguage = options.sourceLanguage;
      }

      if (options.targetLanguage) {
        this.targetLanguage = options.targetLanguage;
      }

      // STT processing
      const sttResult = await this.sttManager.transcribe(audioData, {
        language: this.sourceLanguage === 'auto' ? 'auto' : this.sourceLanguage,
        ...options,
      });

      // If STT confidence is too low, return early
      if (sttResult.confidence < this.config.confidenceThreshold) {
        this.emit('pipelineResult', {
          type: 'lowConfidence',
          result: sttResult,
          timestamp: Date.now(),
        });

        return {
          success: false,
          stage: 'stt',
          reason: 'Low confidence',
          result: sttResult,
        };
      }

      // Continue with translation
      return await this.processTranscription(sttResult);
    } catch (error) {
      console.error('Pipeline processing failed:', error);

      this.emit('pipelineError', {
        stage: 'pipeline',
        error: error.message,
        timestamp: Date.now(),
      });

      return {
        success: false,
        error: error.message,
        timestamp: Date.now(),
      };
    }
  }

  /**
   * Process text directly (bypass STT)
   *
   * @param {string} text - Text to translate
   * @param {string} fromLanguage - Source language code
   * @param {string} toLanguage - Target language code
   * @param {object} options - Translation options
   * @returns {Promise<object>} Translation result
   */
  async processTextDirect(text, fromLanguage, toLanguage, options = {}) {
    try {
      if (!this.isInitialized) {
        throw new Error('Pipeline not initialized');
      }

      const startTime = Date.now();

      // Override target language if provided
      const sourceLanguage = fromLanguage || this.sourceLanguage;
      const targetLanguage = toLanguage || this.targetLanguage;

      // Perform translation
      const translationResult = await this.translationManager.translate(
        text,
        sourceLanguage,
        targetLanguage,
        {
          context: options.context || '',
          conversationId: this.currentConversationId,
          ...options,
        }
      );

      const totalProcessingTime = Date.now() - startTime;

      // Update metrics
      this.metrics.totalTranslations++;
      this.metrics.lastProcessingTime = totalProcessingTime;
      this.metrics.translationLatency =
        this.metrics.translationLatency * 0.8 + translationResult.processingTime * 0.2;
      this.metrics.averageLatency = this.metrics.averageLatency * 0.8 + totalProcessingTime * 0.2;

      // Create result
      const result = {
        original: text,
        translated: translationResult.translation,
        fromLanguage: sourceLanguage,
        toLanguage: targetLanguage,
        confidence: translationResult.confidence || 0.8,
        service: translationResult.service,
        processingTime: totalProcessingTime,
        alternatives: translationResult.alternatives || [],
        timestamp: Date.now(),
        conversationId: this.currentConversationId,
      };

      // Emit direct translation result
      this.emit('pipelineResult', {
        type: 'directTranslation',
        result,
        timestamp: Date.now(),
      });

      return result;
    } catch (error) {
      console.error('Direct text processing failed:', error);

      this.emit('pipelineError', {
        stage: 'directTranslation',
        error: error.message,
        timestamp: Date.now(),
      });

      return {
        success: false,
        error: error.message,
        timestamp: Date.now(),
      };
    }
  }

  /**
   * Activate pipeline
   *
   * @returns {Promise<object>} Activation result
   */
  async activate() {
    try {
      if (!this.sttManager.isInitialized || !this.translationManager.isInitialized) {
        throw new Error('Components not fully initialized');
      }

      // Create a new conversation if none exists
      if (!this.currentConversationId) {
        this.currentConversationId = uuidv4();
      }

      this.isActive = true;

      // Start listening if we have STT
      if (this.pipelineStages.includes('stt') && this.sttManager.startListening) {
        await this.sttManager.startListening();
      }

      this.emit('pipelineActivated', {
        timestamp: Date.now(),
        conversationId: this.currentConversationId,
      });

      return {
        success: true,
        conversationId: this.currentConversationId,
        timestamp: Date.now(),
      };
    } catch (error) {
      console.error('Pipeline activation failed:', error);
      throw error;
    }
  }

  /**
   * Deactivate pipeline
   *
   * @returns {Promise<object>} Deactivation result
   */
  async deactivate() {
    try {
      this.isActive = false;

      // Stop listening if we have STT
      if (this.pipelineStages.includes('stt') && this.sttManager.stopListening) {
        await this.sttManager.stopListening();
      }

      this.emit('pipelineDeactivated', {
        timestamp: Date.now(),
      });

      return { success: true };
    } catch (error) {
      console.error('Pipeline deactivation failed:', error);
      throw error;
    }
  }

  /**
   * Set languages for the pipeline
   *
   * @param {string} sourceLanguage - Source language code
   * @param {string} targetLanguage - Target language code
   */
  setLanguages(sourceLanguage, targetLanguage) {
    this.sourceLanguage = sourceLanguage;
    this.targetLanguage = targetLanguage;

    this.emit('languagesChanged', {
      sourceLanguage: sourceLanguage,
      targetLanguage: targetLanguage,
    });

    console.log(`Pipeline languages set: ${sourceLanguage} → ${targetLanguage}`);
  }

  /**
   * Swap source and target languages
   */
  swapLanguages() {
    const temp = this.sourceLanguage;
    this.sourceLanguage = this.targetLanguage;
    this.targetLanguage = temp;

    this.emit('languagesSwapped', {
      sourceLanguage: this.sourceLanguage,
      targetLanguage: this.targetLanguage,
    });

    console.log(`Languages swapped: ${this.sourceLanguage} → ${this.targetLanguage}`);
  }

  /**
   * Get supported language pairs
   *
   * @returns {Promise<string[]>} Supported language pairs
   */
  async getSupportedLanguagePairs() {
    try {
      if (this.translationManager.isInitialized) {
        return await this.translationManager.getSupportedLanguagePairs();
      }
      return [];
    } catch (error) {
      console.error('Error getting supported language pairs:', error);
      return [];
    }
  }

  /**
   * Normalize language codes
   *
   * @param {string} code - Language code to normalize
   * @returns {string} Normalized language code
   */
  normalizeLanguageCode(code) {
    if (!code) return 'en';

    const normalized = code.toLowerCase().split('-')[0];
    return normalized;
  }

  /**
   * Update performance metrics
   *
   * @param {object} result - Pipeline result
   */
  updateMetrics(result) {
    this.metrics.totalTranslations++;
    this.metrics.lastProcessingTime = result.totalProcessingTime || result.processingTime || 0;

    // Calculate rolling average latency
    if (this.metrics.averageLatency === 0) {
      this.metrics.averageLatency = this.metrics.lastProcessingTime;
    } else {
      this.metrics.averageLatency =
        this.metrics.averageLatency * 0.8 + this.metrics.lastProcessingTime * 0.2;
    }

    // Calculate success rate (simple heuristic based on confidence)
    const success = result.confidence > 0.7 ? 1 : 0;
    this.metrics.successRate = this.metrics.successRate * 0.9 + success * 0.1;
  }

  /**
   * Get pipeline status
   *
   * @returns {object} Pipeline status
   */
  getStatus() {
    return {
      active: this.isActive,
      initialized: this.isInitialized,
      pipelineStages: this.pipelineStages,
      sourceLanguage: this.sourceLanguage,
      targetLanguage: this.targetLanguage,
      conversationId: this.currentConversationId,
      components: {
        stt: this.sttManager?.isInitialized || false,
        translation: this.translationManager?.isInitialized || false,
        tts: this.ttsManager?.isInitialized || false,
      },
    };
  }

  /**
   * Update pipeline configuration
   *
   * @param {object} newConfig - Configuration updates
   */
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    console.log('Pipeline configuration updated:', this.config);
  }

  /**
   * Get performance metrics
   *
   * @returns {object} Pipeline metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      componentsStatus: this.getStatus().components,
    };
  }

  /**
   * Reset metrics
   */
  resetMetrics() {
    this.metrics = {
      totalTranslations: 0,
      lastProcessingTime: 0,
      averageLatency: 0,
      successRate: 1.0,
      sttLatency: 0,
      translationLatency: 0,
      ttsLatency: 0,
    };
  }

  /**
   * Export pipeline data
   *
   * @returns {object} Exportable pipeline data
   */
  exportData() {
    return {
      timestamp: new Date().toISOString(),
      metrics: this.metrics,
      conversationId: this.currentConversationId,
      pipelineStages: this.pipelineStages,
      languages: {
        source: this.sourceLanguage,
        target: this.targetLanguage,
      },
      status: this.getStatus(),
      supportedLanguages: this.getSupportedLanguagePairs(),
    };
  }

  /**
   * Cleanup pipeline resources
   */
  destroy() {
    // Deactivate pipeline
    this.deactivate().catch(console.error);

    // Cleanup components
    if (this.sttManager) {
      this.sttManager.destroy();
    }

    if (this.translationManager) {
      this.translationManager.destroy();
    }

    if (this.ttsManager) {
      this.ttsManager.destroy();
    }

    // Reset state
    this.isActive = false;
    this.currentConversationId = null;
    this.resetMetrics();

    this.removeAllListeners();
    console.log('Translation pipeline destroyed');
  }
}

module.exports = TranslationPipeline;
