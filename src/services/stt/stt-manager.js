/**
 * STT Manager Service
 * Manages multiple Speech-to-Text services with fallback logic and quality optimization
 */

const { EventEmitter } = require('events');
const logger = require('../../utils/logger');
const LanguageDetector = require('./utils/LanguageDetector');
const AudioUtils = require('./utils/AudioUtils');
const STTCache = require('./utils/STTCache');

class STTManager extends EventEmitter {
  constructor(config = {}) {
    super();
    this.config = {
      defaultService: 'whisper',
      fallbackServices: ['azure', 'google'],
      maxRetries: 3,
      timeout: 30000,
      enableCache: true,
      cacheExpiry: 3600000, // 1 hour
      qualityThreshold: 0.7,
      enableLanguageDetection: true,
      ...config,
    };

    this.services = new Map();
    this.activeService = null;
    this.languageDetector = new LanguageDetector();
    this.audioUtils = new AudioUtils();
    this.cache = this.config.enableCache
      ? new STTCache({
          maxSize: 1000,
          expiryMs: this.config.cacheExpiry,
        })
      : null;

    this.stats = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      cacheHits: 0,
      averageResponseTime: 0,
      serviceUsage: {},
    };
  }

  /**
   * Initialize STT services
   * @param {Object} serviceConfigs - Service configurations
   * @returns {Promise<void>}
   */
  async initialize(serviceConfigs = {}) {
    try {
      logger.info('Initializing STT Manager...');

      // Initialize language detector
      if (this.config.enableLanguageDetection) {
        await this.languageDetector.detect('test', { minLength: 1 });
      }

      // Initialize cache
      if (this.cache) {
        await this.cache.initialize();
      }

      // Initialize services
      for (const [serviceName, config] of Object.entries(serviceConfigs)) {
        await this._initializeService(serviceName, config);
      }

      // Set default active service
      if (this.services.has(this.config.defaultService)) {
        this.activeService = this.services.get(this.config.defaultService);
      } else if (this.services.size > 0) {
        this.activeService = Array.from(this.services.values())[0];
      }

      logger.info(`STT Manager initialized with ${this.services.size} services`);
      this.emit('initialized', { serviceCount: this.services.size });
    } catch (error) {
      logger.error('Failed to initialize STT Manager:', error);
      this.emit('initializationError', error);
      throw error;
    }
  }

  /**
   * Transcribe audio to text
   * @param {Buffer|string} audioData - Audio data or file path
   * @param {Object} options - Transcription options
   * @returns {Promise<Object>} Transcription result
   */
  async transcribe(audioData, options = {}) {
    const requestId = this._generateRequestId();
    const startTime = Date.now();

    try {
      this.stats.totalRequests++;

      // Prepare options
      const transcriptionOptions = {
        language: options.language || 'auto',
        quality: options.quality || 'high',
        enablePunctuation: options.enablePunctuation !== false,
        enableSpeakerDiarization: options.enableSpeakerDiarization || false,
        ...options,
      };

      // Check cache first
      if (this.cache) {
        const cacheKey = this._generateCacheKey(audioData, transcriptionOptions);
        const cachedResult = await this.cache.get(cacheKey);
        if (cachedResult) {
          this.stats.cacheHits++;
          logger.info('STT cache hit', { requestId, cacheKey });
          return {
            ...cachedResult,
            cached: true,
            requestId,
          };
        }
      }

      // Process audio data
      const processedAudio = await this.audioUtils.processAudio(audioData, transcriptionOptions);

      // Attempt transcription with primary service
      let result = await this._transcribeWithService(
        this.activeService,
        processedAudio,
        transcriptionOptions,
        requestId
      );

      // If primary service fails, try fallback services
      if (!result.success && this.config.fallbackServices.length > 0) {
        result = await this._transcribeWithFallbacks(
          processedAudio,
          transcriptionOptions,
          requestId
        );
      }

      // Update statistics
      const duration = Date.now() - startTime;
      this._updateStats(result.success, duration, result.service);

      // Cache successful result
      if (result.success && this.cache) {
        const cacheKey = this._generateCacheKey(audioData, transcriptionOptions);
        await this.cache.set(cacheKey, {
          text: result.text,
          confidence: result.confidence,
          language: result.language,
          service: result.service,
          timestamp: Date.now(),
        });
      }

      // Emit events
      if (result.success) {
        this.emit('transcriptionSuccess', {
          requestId,
          text: result.text,
          confidence: result.confidence,
          service: result.service,
          duration,
        });
      } else {
        this.emit('transcriptionError', {
          requestId,
          error: result.error,
          duration,
        });
      }

      return {
        ...result,
        requestId,
        duration,
      };
    } catch (error) {
      this.stats.failedRequests++;
      const duration = Date.now() - startTime;

      logger.error('STT transcription failed:', error);
      this.emit('transcriptionError', {
        requestId,
        error: error.message,
        duration,
      });

      throw error;
    }
  }

  /**
   * Detect language from audio
   * @param {Buffer|string} audioData - Audio data or file path
   * @param {Object} options - Detection options
   * @returns {Promise<Object>} Language detection result
   */
  async detectLanguage(audioData, options = {}) {
    try {
      // First try to transcribe a small portion for language detection
      const sampleAudio = await this.audioUtils.extractSample(audioData, 5000); // 5 seconds

      const transcriptionResult = await this.transcribe(sampleAudio, {
        ...options,
        language: 'auto',
      });

      if (transcriptionResult.success && transcriptionResult.text) {
        // Use language detector on transcribed text
        const detectionResult = await this.languageDetector.detect(
          transcriptionResult.text,
          options
        );

        return {
          language: detectionResult.language,
          confidence: detectionResult.confidence,
          isReliable: detectionResult.isReliable,
          method: 'transcription-based',
        };
      }

      return {
        language: 'unknown',
        confidence: 0,
        isReliable: false,
        method: 'failed',
      };
    } catch (error) {
      logger.error('Language detection failed:', error);
      return {
        language: 'unknown',
        confidence: 0,
        isReliable: false,
        method: 'error',
        error: error.message,
      };
    }
  }

  /**
   * Get available services
   * @returns {Array} List of service names
   */
  getAvailableServices() {
    return Array.from(this.services.keys());
  }

  /**
   * Get service status
   * @param {string} serviceName - Service name
   * @returns {Object} Service status
   */
  getServiceStatus(serviceName) {
    const service = this.services.get(serviceName);
    if (!service) {
      return { available: false, error: 'Service not found' };
    }

    return {
      available: service.isAvailable(),
      health: service.getHealth(),
      lastUsed: service.lastUsed,
      errorCount: service.errorCount,
    };
  }

  /**
   * Switch active service
   * @param {string} serviceName - Service name
   * @returns {boolean} Success status
   */
  switchService(serviceName) {
    const service = this.services.get(serviceName);
    if (!service) {
      logger.warn(`Service not found: ${serviceName}`);
      return false;
    }

    if (!service.isAvailable()) {
      logger.warn(`Service not available: ${serviceName}`);
      return false;
    }

    this.activeService = service;
    logger.info(`Switched to STT service: ${serviceName}`);
    this.emit('serviceSwitched', { serviceName });
    return true;
  }

  /**
   * Get statistics
   * @returns {Object} Statistics
   */
  getStats() {
    return {
      ...this.stats,
      cacheStats: this.cache ? this.cache.getStats() : null,
      services: Array.from(this.services.entries()).map(([name, service]) => ({
        name,
        status: this.getServiceStatus(name),
      })),
    };
  }

  /**
   * Initialize a specific service
   * @param {string} serviceName - Service name
   * @param {Object} config - Service configuration
   * @returns {Promise<void>}
   */
  async _initializeService(serviceName, config) {
    try {
      let service;

      switch (serviceName.toLowerCase()) {
        case 'whisper':
          service = require('./services/WhisperSTT');
          break;
        case 'azure':
          service = require('./services/AzureSTT');
          break;
        case 'google':
          service = require('./services/GoogleSTT');
          break;
        case 'gpt4o':
          service = require('./services/GPT4oSTT');
          break;
        default:
          logger.warn(`Unknown STT service: ${serviceName}`);
          return;
      }

      const serviceInstance = new service(config);
      await serviceInstance.initialize();

      this.services.set(serviceName, serviceInstance);
      this.stats.serviceUsage[serviceName] = 0;

      logger.info(`Initialized STT service: ${serviceName}`);
    } catch (error) {
      logger.error(`Failed to initialize STT service ${serviceName}:`, error);
    }
  }

  /**
   * Transcribe with a specific service
   * @param {Object} service - STT service instance
   * @param {Buffer} audioData - Processed audio data
   * @param {Object} options - Transcription options
   * @param {string} requestId - Request ID
   * @returns {Promise<Object>} Transcription result
   */
  async _transcribeWithService(service, audioData, options, requestId) {
    if (!service || !service.isAvailable()) {
      return {
        success: false,
        error: 'Service not available',
        service: service?.constructor?.name || 'unknown',
      };
    }

    try {
      const result = await service.transcribe(audioData, options);

      // Update service usage statistics
      const serviceName = service.constructor.name;
      this.stats.serviceUsage[serviceName] = (this.stats.serviceUsage[serviceName] || 0) + 1;
      service.lastUsed = Date.now();

      return {
        success: true,
        text: result.text,
        confidence: result.confidence,
        language: result.language,
        service: serviceName,
        ...result,
      };
    } catch (error) {
      service.errorCount = (service.errorCount || 0) + 1;
      logger.error(`STT service ${service.constructor.name} failed:`, error);

      return {
        success: false,
        error: error.message,
        service: service.constructor.name,
      };
    }
  }

  /**
   * Transcribe with fallback services
   * @param {Buffer} audioData - Processed audio data
   * @param {Object} options - Transcription options
   * @param {string} requestId - Request ID
   * @returns {Promise<Object>} Transcription result
   */
  async _transcribeWithFallbacks(audioData, options, requestId) {
    for (const serviceName of this.config.fallbackServices) {
      const service = this.services.get(serviceName);
      if (service) {
        const result = await this._transcribeWithService(service, audioData, options, requestId);
        if (result.success) {
          logger.info(`STT fallback successful with ${serviceName}`);
          return result;
        }
      }
    }

    return {
      success: false,
      error: 'All services failed',
      service: 'fallback',
    };
  }

  /**
   * Generate cache key
   * @param {Buffer|string} audioData - Audio data
   * @param {Object} options - Options
   * @returns {string} Cache key
   */
  _generateCacheKey(audioData, options) {
    const crypto = require('crypto');
    const data = typeof audioData === 'string' ? audioData : audioData.toString('base64');
    const optionsStr = JSON.stringify(options);
    return crypto
      .createHash('md5')
      .update(data + optionsStr)
      .digest('hex');
  }

  /**
   * Generate request ID
   * @returns {string} Request ID
   */
  _generateRequestId() {
    return `stt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Update statistics
   * @param {boolean} success - Success status
   * @param {number} duration - Request duration
   * @param {string} service - Service name
   */
  _updateStats(success, duration, service) {
    if (success) {
      this.stats.successfulRequests++;
    } else {
      this.stats.failedRequests++;
    }

    // Update average response time
    const totalRequests = this.stats.successfulRequests + this.stats.failedRequests;
    this.stats.averageResponseTime =
      (this.stats.averageResponseTime * (totalRequests - 1) + duration) / totalRequests;
  }
}

module.exports = STTManager;
