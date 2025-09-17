/**
 * TTS Manager - Main text-to-speech coordination service
 * Manages multiple TTS providers and selects the optimal service for each language
 */
const path = require('path');
const fs = require('fs');
const EventEmitter = require('events');
const ElevenLabsService = require('./elevenlabs-service');
const AzureTTS = require('./azure-tts');
const GoogleTTS = require('./google-tts');
const VoiceOptimizer = require('./voice-optimizer');
const VoiceMapper = require('./utils/voice-mapper');
const AudioProcessor = require('./utils/audio-processor');
const OutputRouter = require('./utils/output-router');
const logger = require('../../utils/logger');

class TTSManager extends EventEmitter {
  constructor(config = {}) {
    super();

    // Load configuration
    this.loadConfig(config);

    // Initialize service providers
    this.services = {
      elevenlabs: this.config.providers.elevenlabs.enabled
        ? new ElevenLabsService(this.config.providers.elevenlabs)
        : null,
      azure: this.config.providers.azure.enabled ? new AzureTTS(this.config.providers.azure) : null,
      google: this.config.providers.google.enabled
        ? new GoogleTTS(this.config.providers.google)
        : null,
    };

    // Initialize utility components
    this.voiceOptimizer = new VoiceOptimizer(this.config.voicePreferences);
    this.voiceMapper = new VoiceMapper();
    this.audioProcessor = new AudioProcessor(this.config.output.format);
    this.outputRouter = new OutputRouter(this.config.output.routing);

    // Register services with the optimizer
    this.registerServices();

    // Cache for voices and results
    this.voiceCache = new Map();
    this.synthesisCache = new Map();
    this.activeVoices = new Map();

    // Performance metrics
    this.metrics = {
      totalSynthesized: 0,
      totalAudioLength: 0,
      averageSynthesisTime: 0,
      providerUsage: {
        elevenlabs: 0,
        azure: 0,
        google: 0,
      },
      errors: {
        elevenlabs: 0,
        azure: 0,
        google: 0,
      },
    };

    // Register event listeners
    this.registerEventListeners();

    logger.info('TTS Manager initialized');
  }

  /**
   * Load configuration from file and merge with provided config
   * @param {Object} config - Configuration object
   */
  loadConfig(config = {}) {
    // Default configuration
    this.config = {
      enabled: true,
      defaultProvider: 'elevenlabs',
      providers: {
        elevenlabs: {
          enabled: true,
          apiKey: process.env.ELEVENLABS_API_KEY || '',
          model: 'eleven_multilingual_v2',
        },
        azure: {
          enabled: true,
          apiKey: process.env.AZURE_SPEECH_KEY || '',
          region: process.env.AZURE_REGION || 'eastus',
        },
        google: {
          enabled: true,
          apiKey: process.env.GOOGLE_TTS_KEY || '',
        },
      },
      output: {
        routing: {
          useVirtualDevice: true,
          deviceName: 'VirtualCable',
          useSystemSpeaker: true,
        },
        format: {
          sampleRate: 24000,
          channels: 1,
          bitDepth: 16,
        },
      },
      voicePreferences: {
        defaultVoiceGender: 'auto',
        speakingRate: 1.0,
        pitch: 0,
        volume: 1.0,
        emotion: 'neutral',
      },
      performance: {
        caching: true,
        maxCacheSize: 200,
        maxConcurrentRequests: 5,
      },
    };

    try {
      // Try to load config file
      const configPath = path.join(process.cwd(), 'config', 'tts-config.json');
      if (fs.existsSync(configPath)) {
        const fileConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        this.config = this.mergeConfigs(this.config, fileConfig);
      }
    } catch (error) {
      logger.warn('Error loading TTS config file:', error);
    }

    // Merge with provided config
    this.config = this.mergeConfigs(this.config, config);
  }

  /**
   * Deep merge of configuration objects
   * @param {Object} target - Target object
   * @param {Object} source - Source object
   * @returns {Object} Merged object
   */
  mergeConfigs(target, source) {
    const merged = { ...target };

    for (const key in source) {
      if (source[key] === null || source[key] === undefined) {
        continue;
      }

      if (typeof source[key] === 'object' && !Array.isArray(source[key])) {
        merged[key] = this.mergeConfigs(target[key] || {}, source[key]);
      } else {
        merged[key] = source[key];
      }
    }

    return merged;
  }

  /**
   * Register TTS service providers with voice optimizer
   */
  registerServices() {
    const activeServices = Object.values(this.services).filter((service) => service !== null);
    this.voiceOptimizer.registerProviders(activeServices);
  }

  /**
   * Register event listeners for service providers
   */
  registerEventListeners() {
    // Register listeners for each service
    for (const [providerName, service] of Object.entries(this.services)) {
      if (!service) continue;

      service.on('synthesisComplete', (data) => {
        this.metrics.providerUsage[providerName]++;
        this.updateMetrics(data);
        this.emit('synthesisComplete', { ...data, provider: providerName });
      });
    }

    // Listen for voice optimizer events
    this.voiceOptimizer.on('synthesisComplete', (data) => {
      this.emit('synthesisComplete', data);
    });
  }

  /**
   * Synthesize speech from text
   * @param {string} text - Text to synthesize
   * @param {Object} options - Synthesis options
   * @returns {Promise<Object>} Synthesis result with audio data
   */
  async synthesize(text, options = {}) {
    if (!this.config.enabled) {
      logger.warn('TTS Manager is disabled');
      throw new Error('TTS Manager is disabled');
    }

    if (!text || text.trim() === '') {
      logger.warn('Empty text provided for synthesis');
      throw new Error('Empty text provided for synthesis');
    }

    const startTime = Date.now();

    try {
      // Normalize options
      const opts = {
        language: options.language || 'en',
        voice: options.voice || 'auto',
        provider: options.provider || this.config.defaultProvider,
        gender: options.gender || this.config.voicePreferences.defaultVoiceGender,
        rate: options.rate || this.config.voicePreferences.speakingRate,
        pitch: options.pitch || this.config.voicePreferences.pitch,
        volume: options.volume || this.config.voicePreferences.volume,
        emotion: options.emotion || this.config.voicePreferences.emotion,
        cache: options.cache !== false && this.config.performance.caching,
        ...options,
      };

      // Check cache if enabled
      if (opts.cache) {
        const cacheKey = this.generateCacheKey(text, opts);
        if (this.synthesisCache.has(cacheKey)) {
          logger.info('Using cached TTS result');
          const cachedResult = this.synthesisCache.get(cacheKey);

          // Emit event for cached result
          this.emit('synthesisComplete', {
            provider: cachedResult.provider,
            voice: cachedResult.voice,
            language: cachedResult.language,
            textLength: text.length,
            duration: 0,
            audioSize: cachedResult.audioData.length,
            cached: true,
          });

          return cachedResult;
        }
      }

      // Get voice to use
      const voiceInfo = await this.getVoice(opts.language, opts);

      // Optimize voice parameters based on text content
      const voiceParams = this.voiceOptimizer.optimizeVoiceParams(text, {
        rate: opts.rate,
        pitch: opts.pitch,
        volume: opts.volume,
        emotion: opts.emotion,
      });

      // Synthesize speech using the selected provider
      const provider = voiceInfo.providerInstance;
      const audioData = await provider.synthesize(text, voiceInfo.id, voiceParams);

      // Track current active voice
      this.activeVoices.set(opts.language, voiceInfo);

      // Process audio for optimal playback
      const processedAudio = await this.audioProcessor.processAudio(audioData, 'mp3', {
        normalization: true,
        ...voiceParams,
      });

      const duration = Date.now() - startTime;

      // Prepare result
      const result = {
        audioData: processedAudio,
        provider: voiceInfo.provider,
        voice: voiceInfo.id,
        voiceName: voiceInfo.name,
        language: opts.language,
        duration: duration,
        params: voiceParams,
      };

      // Cache the result if caching is enabled
      if (opts.cache) {
        const cacheKey = this.generateCacheKey(text, opts);
        this.synthesisCache.set(cacheKey, result);

        // Manage cache size
        if (this.synthesisCache.size > this.config.performance.maxCacheSize) {
          const firstKey = this.synthesisCache.keys().next().value;
          this.synthesisCache.delete(firstKey);
        }
      }

      // Update metrics
      this.metrics.totalSynthesized++;
      this.updateAverageSynthesisTime(duration);

      // Emit result event
      this.emit('synthesisComplete', {
        provider: voiceInfo.provider,
        voice: voiceInfo.id,
        language: opts.language,
        textLength: text.length,
        duration: duration,
        audioSize: processedAudio.length,
      });

      return result;
    } catch (error) {
      // Track error for the provider
      if (options.provider) {
        this.metrics.errors[options.provider] = (this.metrics.errors[options.provider] || 0) + 1;
      }

      logger.error('Error synthesizing speech:', error);

      // Attempt fallback if provider was specified
      if (options.provider && options.provider !== this.config.defaultProvider) {
        logger.info(`Attempting fallback to ${this.config.defaultProvider} provider`);
        return this.synthesize(text, {
          ...options,
          provider: this.config.defaultProvider,
        });
      }

      throw error;
    }
  }

  /**
   * Route synthesized audio to output devices
   * @param {Buffer} audioData - Audio data to route
   * @param {Object} options - Routing options
   * @returns {Promise<boolean>} Success status
   */
  async routeAudio(audioData, options = {}) {
    return this.outputRouter.routeAudio(audioData, 'mp3', options);
  }

  /**
   * Synthesize and route in one step
   * @param {string} text - Text to synthesize
   * @param {Object} options - Synthesis and routing options
   * @returns {Promise<Object>} Synthesis result
   */
  async speakText(text, options = {}) {
    const result = await this.synthesize(text, options);
    await this.routeAudio(result.audioData, options);
    return result;
  }

  /**
   * Get voice for language
   * @param {string} language - Language code
   * @param {Object} options - Voice selection options
   * @returns {Promise<Object>} Voice information
   */
  async getVoice(language, options = {}) {
    // If a specific voice ID is provided, use it
    if (options.voice && options.voice !== 'auto') {
      const provider = options.provider || this.config.defaultProvider;
      const providerInstance = this.services[provider];

      if (!providerInstance) {
        throw new Error(`Provider ${provider} is not available`);
      }

      return {
        id: options.voice,
        name: options.voice,
        provider: provider,
        language: language,
        providerInstance: providerInstance,
      };
    }

    // Otherwise, get optimal voice from optimizer
    return this.voiceOptimizer.getOptimalVoice(language, {
      provider: options.provider,
      gender: options.gender,
      style: options.style,
    });
  }

  /**
   * Get available voices for a language
   * @param {string} language - Language code
   * @returns {Promise<Object>} Available voices by provider
   */
  async getAvailableVoices(language) {
    return this.voiceOptimizer.getAvailableVoices(language);
  }

  /**
   * Get all available voices across all providers
   * @returns {Promise<Object>} All available voices
   */
  async getAllVoices() {
    const voices = {};

    for (const [providerName, service] of Object.entries(this.services)) {
      if (!service) continue;

      try {
        const providerVoices = await service.getVoices();
        voices[providerName] = providerVoices;
      } catch (error) {
        logger.error(`Error getting voices from ${providerName}:`, error);
        voices[providerName] = [];
      }
    }

    return voices;
  }

  /**
   * Get supported languages
   * @returns {Array} Supported language codes
   */
  getSupportedLanguages() {
    return this.voiceOptimizer.getSupportedLanguages();
  }

  /**
   * Generate cache key for synthesis
   * @param {string} text - Text to synthesize
   * @param {Object} options - Synthesis options
   * @returns {string} Cache key
   */
  generateCacheKey(text, options) {
    const keyParts = [
      text,
      options.language,
      options.voice,
      options.provider,
      options.rate,
      options.pitch,
      options.volume,
      options.emotion,
    ];

    return keyParts.join('|');
  }

  /**
   * Update metrics with synthesis data
   * @param {Object} data - Synthesis data
   */
  updateMetrics(data) {
    // Update average synthesis time
    this.updateAverageSynthesisTime(data.duration);

    // Update total audio length (approximate)
    const audioLengthSeconds = data.textLength / 20; // Rough estimate: 20 chars per second
    this.metrics.totalAudioLength += audioLengthSeconds;
  }

  /**
   * Update average synthesis time
   * @param {number} duration - Synthesis duration in ms
   */
  updateAverageSynthesisTime(duration) {
    if (this.metrics.totalSynthesized === 1) {
      this.metrics.averageSynthesisTime = duration;
    } else {
      this.metrics.averageSynthesisTime =
        (this.metrics.averageSynthesisTime * (this.metrics.totalSynthesized - 1) + duration) /
        this.metrics.totalSynthesized;
    }
  }

  /**
   * Get performance metrics
   * @returns {Object} Current metrics
   */
  getMetrics() {
    return { ...this.metrics };
  }

  /**
   * Check if a provider is available
   * @param {string} providerName - Provider name
   * @returns {Promise<boolean>} Availability status
   */
  async isProviderAvailable(providerName) {
    const service = this.services[providerName];
    if (!service) return false;

    return service.isAvailable();
  }

  /**
   * Check which providers are available
   * @returns {Promise<Object>} Provider availability status
   */
  async getAvailableProviders() {
    const availability = {};

    for (const [providerName, service] of Object.entries(this.services)) {
      if (!service) {
        availability[providerName] = false;
        continue;
      }

      try {
        availability[providerName] = await service.isAvailable();
      } catch (error) {
        logger.error(`Error checking availability of ${providerName}:`, error);
        availability[providerName] = false;
      }
    }

    return availability;
  }

  /**
   * Get currently active voice for a language
   * @param {string} language - Language code
   * @returns {Object} Active voice info
   */
  getActiveVoice(language) {
    return this.activeVoices.get(language) || null;
  }

  /**
   * Set default voice for a language
   * @param {string} language - Language code
   * @param {string} voiceId - Voice ID
   * @param {string} provider - Provider name
   */
  setDefaultVoice(language, voiceId, provider) {
    const voice = {
      id: voiceId,
      provider: provider,
      language: language,
    };

    this.voiceCache.set(language, voice);
    this.emit('voiceChanged', voice);
  }

  /**
   * Update configuration
   * @param {Object} newConfig - New configuration
   */
  updateConfig(newConfig) {
    this.config = this.mergeConfigs(this.config, newConfig);

    // Update service configurations
    for (const [providerName, config] of Object.entries(newConfig.providers || {})) {
      const service = this.services[providerName];
      if (service) {
        service.updateConfig(config);
      }
    }

    // Update utility components
    if (newConfig.voicePreferences) {
      this.voiceOptimizer.updateConfig(newConfig.voicePreferences);
    }

    if (newConfig.output && newConfig.output.format) {
      this.audioProcessor.updateConfig(newConfig.output.format);
    }

    if (newConfig.output && newConfig.output.routing) {
      this.outputRouter.updateConfig(newConfig.output.routing);
    }

    // Clear caches if configuration changed significantly
    if (newConfig.providers || newConfig.voicePreferences) {
      this.voiceCache.clear();
      this.synthesisCache.clear();
    }

    logger.info('TTS Manager configuration updated');
  }

  /**
   * Reset metrics
   */
  resetMetrics() {
    this.metrics = {
      totalSynthesized: 0,
      totalAudioLength: 0,
      averageSynthesisTime: 0,
      providerUsage: {
        elevenlabs: 0,
        azure: 0,
        google: 0,
      },
      errors: {
        elevenlabs: 0,
        azure: 0,
        google: 0,
      },
    };
  }
}

module.exports = TTSManager;
