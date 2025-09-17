/**
 * Text-to-Speech Manager
 * Manages multiple TTS services with failover
 */

const EventEmitter = require('events');
const ElevenLabsTTS = require('./elevenlabs');
const logger = require('../../utils/logger');

class TTSManager extends EventEmitter {
  constructor(config = {}) {
    super();
    this.config = {
      preferredService: 'elevenlabs',
      timeout: 30000,
      ...config,
    };

    // Initialize services
    this.services = {};
    this.isInitialized = false;
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
    };
  }

  /**
   * Initialize all TTS services
   *
   * @returns {Promise<object>} Initialization results
   */
  async initialize() {
    try {
      logger.info('Initializing TTS manager');

      // Initialize ElevenLabs service if API key is provided
      if (this.config.elevenLabsApiKey) {
        this.services.elevenlabs = new ElevenLabsTTS(this.config.elevenLabsApiKey);
        await this.services.elevenlabs.initialize();
        logger.info('ElevenLabs TTS service initialized');
      }

      // Check if at least one service is available
      if (Object.keys(this.services).length === 0) {
        throw new Error('No TTS services configured. Please provide API keys.');
      }

      this.isInitialized = true;
      logger.info('TTS Manager initialized successfully');
      return {
        success: true,
        services: Object.keys(this.services),
      };
    } catch (error) {
      logger.error('Failed to initialize TTS Manager:', error);
      throw error;
    }
  }

  /**
   * Synthesize speech from text
   *
   * @param {string} text - Text to synthesize
   * @param {string} language - Language code
   * @param {object} options - Synthesis options
   * @returns {Promise<object>} Synthesis result
   */
  async synthesizeSpeech(text, language, options = {}) {
    if (!this.isInitialized) {
      throw new Error('TTS Manager not initialized');
    }

    if (!text || text.trim().length === 0) {
      throw new Error('No text provided for speech synthesis');
    }

    this.metrics.totalRequests++;

    try {
      // Determine which service to use
      const serviceName = options.service || this.config.preferredService;
      const service = this.services[serviceName];

      if (!service) {
        throw new Error(`TTS service '${serviceName}' not available`);
      }

      logger.info(`Synthesizing speech using ${serviceName}`);

      let result;
      if (serviceName === 'elevenlabs') {
        result = await service.textToSpeech(text, {
          voiceId: options.voiceId,
          model: options.model,
          stability: options.stability,
          similarityBoost: options.similarityBoost,
        });
      }

      this.metrics.successfulRequests++;
      this.emit('synthesis_complete', {
        text: text.substring(0, 50) + (text.length > 50 ? '...' : ''),
        service: serviceName,
        duration: result.duration || 0,
      });

      return {
        ...result,
        language: language,
        service: serviceName,
      };
    } catch (error) {
      this.metrics.failedRequests++;
      logger.error('Speech synthesis failed:', error);
      this.emit('synthesis_error', {
        text: text.substring(0, 50) + (text.length > 50 ? '...' : ''),
        error: error.message,
      });
      throw new Error(`Speech synthesis failed: ${error.message}`);
    }
  }

  /**
   * Get available voices for a service
   *
   * @param {string} serviceName - Name of the TTS service
   * @returns {Promise<Array>} Available voices
   */
  async getVoices(serviceName = null) {
    if (!this.isInitialized) {
      throw new Error('TTS Manager not initialized');
    }

    const service = serviceName || this.config.preferredService;
    const ttsService = this.services[service];

    if (!ttsService) {
      throw new Error(`TTS service '${service}' not available`);
    }

    if (ttsService.getVoices) {
      return await ttsService.getVoices();
    }

    return [];
  }

  /**
   * Get service status
   *
   * @returns {object} Service status
   */
  getServiceStatus() {
    const serviceStatus = {};

    for (const [name, service] of Object.entries(this.services)) {
      serviceStatus[name] = {
        initialized: service.initialized || false,
        available: true,
      };
    }

    return {
      services: serviceStatus,
      metrics: {
        ...this.metrics,
        successRate:
          this.metrics.totalRequests > 0
            ? this.metrics.successfulRequests / this.metrics.totalRequests
            : 1.0,
      },
    };
  }

  /**
   * Clean up resources
   */
  destroy() {
    logger.info('Destroying TTS Manager');

    // Clean up services
    for (const service of Object.values(this.services)) {
      if (service.destroy) {
        service.destroy();
      }
    }

    this.services = {};
    this.isInitialized = false;
    this.removeAllListeners();
  }
}

module.exports = TTSManager;
