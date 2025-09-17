import EventEmitter from 'events';
import { EchoRTCConfig } from './config.js';
import { EchoRTCAudioProcessor } from './audio-processor.js';
import { RealTimeTranslationPipeline } from './realtime-translation-pipeline.js';

/**
 * TranslationIntegration - Integrates echo RTC with existing translation services
 * Provides seamless connection between real-time audio processing and translation infrastructure
 */
export class TranslationIntegration extends EventEmitter {
  constructor(config = null) {
    super();

    this.config = config || EchoRTCConfig.getInstance();
    this.integrationConfig = this.config.get('translation');

    // Integration components
    this.audioProcessor = null;
    this.translationPipeline = null;
    this.translationManager = null; // Will be injected from existing services
    this.languageDetector = null;

    // Integration state
    this.isIntegrated = false;
    this.activeIntegrations = new Map();
    this.serviceConnections = new Map();

    // Translation cache and optimization
    this.translationCache = new Map();
    this.batchProcessor = null;
    this.optimizationEngine = null;

    // Performance monitoring
    this.performanceMetrics = {
      integrationLatency: 0,
      cacheHitRate: 0,
      serviceResponseTime: 0,
      throughput: 0,
      errorRate: 0,
    };

    // Integration statistics
    this.stats = {
      totalRequests: 0,
      cacheHits: 0,
      cacheMisses: 0,
      serviceErrors: 0,
      successfulIntegrations: 0,
      startTime: null,
    };

    this._setupEventHandlers();
  }

  /**
   * Initialize the translation integration
   */
  async initialize(services = {}) {
    try {
      console.log('Initializing TranslationIntegration...');

      // Initialize audio processor
      this.audioProcessor = new EchoRTCAudioProcessor(this.config);
      await this.audioProcessor.initialize();

      // Initialize translation pipeline
      this.translationPipeline = new RealTimeTranslationPipeline(this.config);
      await this.translationPipeline.initialize();

      // Connect to existing translation services
      await this._connectToTranslationServices(services);

      // Initialize optimization components
      this._initializeOptimization();

      // Setup integration connections
      this._setupIntegrationConnections();

      // Initialize performance monitoring
      this._initializePerformanceMonitoring();

      this.isIntegrated = true;
      this.stats.startTime = Date.now();

      this.emit('initialized');
      console.log('TranslationIntegration initialized successfully');
    } catch (error) {
      console.error('Failed to initialize translation integration:', error);
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Start integration for a session
   */
  async startIntegration(sessionConfig) {
    try {
      if (!this.isIntegrated) {
        throw new Error('Translation integration not initialized');
      }

      console.log('Starting translation integration...', sessionConfig);

      const integrationId = sessionConfig.integrationId || this._generateIntegrationId();

      // Create integration context
      const integration = {
        id: integrationId,
        sessionId: sessionConfig.sessionId,
        config: sessionConfig,
        startTime: Date.now(),
        status: 'active',
        metrics: {
          processedChunks: 0,
          translatedChunks: 0,
          errors: 0,
          averageLatency: 0,
        },
      };

      this.activeIntegrations.set(integrationId, integration);

      // Start audio processing
      if (sessionConfig.mediaStream) {
        await this.audioProcessor.startProcessing(sessionConfig.mediaStream);
      }

      // Start translation pipeline
      const pipelineSessionId = await this.translationPipeline.startPipeline({
        ...sessionConfig,
        sessionId: integrationId,
      });

      integration.pipelineSessionId = pipelineSessionId;

      // Setup integration-specific event handlers
      this._setupIntegrationEventHandlers(integration);

      this.emit('integrationStarted', { integrationId, config: sessionConfig });
      console.log('Translation integration started successfully');

      return integrationId;
    } catch (error) {
      console.error('Failed to start translation integration:', error);
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Stop integration for a session
   */
  async stopIntegration(integrationId) {
    try {
      console.log('Stopping translation integration...', integrationId);

      const integration = this.activeIntegrations.get(integrationId);
      if (!integration) {
        console.warn('Integration not found:', integrationId);
        return;
      }

      integration.status = 'stopping';
      integration.endTime = Date.now();

      // Stop translation pipeline
      if (integration.pipelineSessionId) {
        await this.translationPipeline.stopPipeline(integration.pipelineSessionId);
      }

      // Stop audio processing if no other active integrations
      const activeCount = Array.from(this.activeIntegrations.values()).filter(
        (i) => i.status === 'active'
      ).length;

      if (activeCount <= 1) {
        await this.audioProcessor.stopProcessing();
      }

      // Clean up integration
      integration.status = 'stopped';
      this.activeIntegrations.delete(integrationId);

      this.emit('integrationStopped', { integrationId });
      console.log('Translation integration stopped');
    } catch (error) {
      console.error('Failed to stop translation integration:', error);
      this.emit('error', error);
    }
  }

  /**
   * Process audio through integrated translation services
   */
  async processAudioWithTranslation(audioData, options = {}) {
    try {
      const startTime = performance.now();
      this.stats.totalRequests++;

      const integrationId = options.integrationId || this._getDefaultIntegrationId();
      const integration = this.activeIntegrations.get(integrationId);

      if (!integration) {
        throw new Error('Integration not found: ' + integrationId);
      }

      // Check cache first
      const cacheKey = this._generateCacheKey(audioData, options);
      const cachedResult = this.translationCache.get(cacheKey);

      if (cachedResult && this._isCacheValid(cachedResult)) {
        this.stats.cacheHits++;
        this._updatePerformanceMetrics(performance.now() - startTime, true, true);

        this.emit('translationFromCache', {
          integrationId,
          result: cachedResult,
          cacheKey,
        });

        return cachedResult;
      }

      this.stats.cacheMisses++;

      // Process through pipeline
      const pipelineResult = await this.translationPipeline.processAudio(audioData, {
        ...options,
        sessionId: integration.pipelineSessionId,
      });

      // Integrate with existing translation services
      const integratedResult = await this._integrateWithServices(pipelineResult, options);

      // Cache the result
      this._cacheResult(cacheKey, integratedResult);

      // Update integration metrics
      integration.metrics.processedChunks++;
      integration.metrics.translatedChunks++;

      const totalLatency = performance.now() - startTime;
      integration.metrics.averageLatency =
        (integration.metrics.averageLatency * (integration.metrics.processedChunks - 1) +
          totalLatency) /
        integration.metrics.processedChunks;

      this._updatePerformanceMetrics(totalLatency, true, false);
      this.stats.successfulIntegrations++;

      this.emit('audioProcessedWithTranslation', {
        integrationId,
        result: integratedResult,
        latency: totalLatency,
      });

      return integratedResult;
    } catch (error) {
      console.error('Failed to process audio with translation:', error);
      this.stats.serviceErrors++;
      this._updatePerformanceMetrics(0, false, false);
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Get integration statistics
   */
  getStatistics() {
    const runtime = this.stats.startTime ? Date.now() - this.stats.startTime : 0;

    return {
      ...this.stats,
      runtime,
      cacheHitRate:
        this.stats.totalRequests > 0 ? (this.stats.cacheHits / this.stats.totalRequests) * 100 : 0,
      errorRate:
        this.stats.totalRequests > 0
          ? (this.stats.serviceErrors / this.stats.totalRequests) * 100
          : 0,
      successRate:
        this.stats.totalRequests > 0
          ? (this.stats.successfulIntegrations / this.stats.totalRequests) * 100
          : 0,
      activeIntegrations: this.activeIntegrations.size,
      cacheSize: this.translationCache.size,
      performanceMetrics: this.performanceMetrics,
    };
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics() {
    return {
      ...this.performanceMetrics,
      audioProcessorMetrics: this.audioProcessor ? this.audioProcessor.getQualityMetrics() : null,
      pipelineMetrics: this.translationPipeline
        ? this.translationPipeline.getQualityMetrics()
        : null,
    };
  }

  /**
   * Update integration configuration
   */
  updateConfiguration(newConfig) {
    try {
      console.log('Updating integration configuration...', newConfig);

      // Update component configurations
      if (newConfig.audio && this.audioProcessor) {
        this.audioProcessor.updateConfig(newConfig.audio);
      }

      if (newConfig.translation && this.translationPipeline) {
        this.translationPipeline.updateConfiguration(newConfig.translation);
      }

      // Update cache settings
      if (newConfig.cache) {
        this._updateCacheConfiguration(newConfig.cache);
      }

      // Update optimization settings
      if (newConfig.optimization) {
        this._updateOptimizationConfiguration(newConfig.optimization);
      }

      this.emit('configurationUpdated', newConfig);
    } catch (error) {
      console.error('Failed to update integration configuration:', error);
      this.emit('error', error);
    }
  }

  /**
   * Setup event handlers
   */
  _setupEventHandlers() {
    // Handle cleanup on page unload
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => {
        this.cleanup();
      });
    }
  }

  /**
   * Connect to existing translation services
   */
  async _connectToTranslationServices(services) {
    try {
      console.log('Connecting to translation services...');

      // Connect to translation manager
      if (services.translationManager) {
        this.translationManager = services.translationManager;
        this.serviceConnections.set('translationManager', {
          service: services.translationManager,
          status: 'connected',
          connectedAt: Date.now(),
        });
      }

      // Connect to language detector
      if (services.languageDetector) {
        this.languageDetector = services.languageDetector;
        this.serviceConnections.set('languageDetector', {
          service: services.languageDetector,
          status: 'connected',
          connectedAt: Date.now(),
        });
      }

      // Mock services if not provided
      if (!this.translationManager) {
        this.translationManager = this._createMockTranslationManager();
      }

      if (!this.languageDetector) {
        this.languageDetector = this._createMockLanguageDetector();
      }

      console.log('Translation services connected successfully');
    } catch (error) {
      console.error('Failed to connect to translation services:', error);
      throw error;
    }
  }

  /**
   * Initialize optimization components
   */
  _initializeOptimization() {
    // Initialize batch processor for efficiency
    this.batchProcessor = {
      batch: [],
      maxBatchSize: this.integrationConfig.batchSize || 10,
      batchTimeout: this.integrationConfig.batchTimeout || 100,

      addToBatch: (item) => {
        this.batchProcessor.batch.push(item);
        if (this.batchProcessor.batch.length >= this.batchProcessor.maxBatchSize) {
          this._processBatch();
        }
      },
    };

    // Initialize optimization engine
    this.optimizationEngine = {
      optimize: (request) => {
        // Apply optimization strategies
        return this._applyOptimizations(request);
      },
    };
  }

  /**
   * Setup integration connections
   */
  _setupIntegrationConnections() {
    // Connect audio processor events
    if (this.audioProcessor) {
      this.audioProcessor.on('chunkProcessed', (data) => {
        this._handleAudioChunk(data);
      });
    }

    // Connect translation pipeline events
    if (this.translationPipeline) {
      this.translationPipeline.on('translationComplete', (data) => {
        this._handleTranslationComplete(data);
      });

      this.translationPipeline.on('error', (error) => {
        this._handlePipelineError(error);
      });
    }
  }

  /**
   * Initialize performance monitoring
   */
  _initializePerformanceMonitoring() {
    this.performanceMonitoringInterval = setInterval(() => {
      this._updatePerformanceMetrics();
    }, this.integrationConfig.performanceCheckInterval || 5000);
  }

  /**
   * Setup integration-specific event handlers
   */
  _setupIntegrationEventHandlers(integration) {
    // Handle integration-specific events
    const handleIntegrationEvent = (eventType, data) => {
      this.emit('integrationEvent', {
        integrationId: integration.id,
        eventType,
        data,
        timestamp: Date.now(),
      });
    };

    // Store event handler reference for cleanup
    integration.eventHandler = handleIntegrationEvent;
  }

  /**
   * Integrate with existing translation services
   */
  async _integrateWithServices(pipelineResult, options) {
    try {
      const integratedResult = {
        ...pipelineResult,
        serviceIntegration: {
          timestamp: Date.now(),
          services: [],
        },
      };

      // Integrate with translation manager
      if (this.translationManager && pipelineResult.recognition) {
        const translationManagerResult = await this.translationManager.translate({
          text: pipelineResult.recognition.text,
          sourceLanguage: pipelineResult.recognition.language,
          targetLanguages: options.targetLanguages || [],
        });

        integratedResult.serviceIntegration.services.push({
          name: 'translationManager',
          result: translationManagerResult,
          latency: Date.now() - integratedResult.serviceIntegration.timestamp,
        });
      }

      // Integrate with language detector
      if (this.languageDetector && pipelineResult.recognition) {
        const detectedLanguage = await this.languageDetector.detect(
          pipelineResult.recognition.text
        );

        integratedResult.serviceIntegration.services.push({
          name: 'languageDetector',
          result: detectedLanguage,
          latency: Date.now() - integratedResult.serviceIntegration.timestamp,
        });
      }

      return integratedResult;
    } catch (error) {
      console.error('Error integrating with services:', error);
      throw error;
    }
  }

  /**
   * Handle audio chunk from processor
   */
  _handleAudioChunk(data) {
    this.emit('audioChunkProcessed', data);
  }

  /**
   * Handle translation completion
   */
  _handleTranslationComplete(data) {
    this.emit('translationCompleted', data);
  }

  /**
   * Handle pipeline error
   */
  _handlePipelineError(error) {
    console.error('Pipeline error:', error);
    this.emit('pipelineError', error);
  }

  /**
   * Generate cache key
   */
  _generateCacheKey(audioData, options) {
    const hash = this._simpleHash(audioData.toString() + JSON.stringify(options));
    return `audio_${hash}`;
  }

  /**
   * Check if cache result is valid
   */
  _isCacheValid(cachedResult) {
    const maxAge = this.integrationConfig.cacheMaxAge || 300000; // 5 minutes
    return Date.now() - cachedResult.timestamp < maxAge;
  }

  /**
   * Cache translation result
   */
  _cacheResult(key, result) {
    const maxCacheSize = this.integrationConfig.maxCacheSize || 1000;

    if (this.translationCache.size >= maxCacheSize) {
      // Remove oldest entry
      const firstKey = this.translationCache.keys().next().value;
      this.translationCache.delete(firstKey);
    }

    this.translationCache.set(key, {
      ...result,
      timestamp: Date.now(),
    });
  }

  /**
   * Update performance metrics
   */
  _updatePerformanceMetrics(latency = 0, success = true, fromCache = false) {
    if (success) {
      this.performanceMetrics.integrationLatency =
        (this.performanceMetrics.integrationLatency + latency) / 2;
    }

    this.performanceMetrics.cacheHitRate =
      this.stats.totalRequests > 0 ? (this.stats.cacheHits / this.stats.totalRequests) * 100 : 0;

    this.performanceMetrics.errorRate =
      this.stats.totalRequests > 0
        ? (this.stats.serviceErrors / this.stats.totalRequests) * 100
        : 0;

    const runtime = this.stats.startTime ? Date.now() - this.stats.startTime : 0;
    this.performanceMetrics.throughput =
      runtime > 0 ? (this.stats.totalRequests / runtime) * 1000 : 0;
  }

  /**
   * Create mock translation manager
   */
  _createMockTranslationManager() {
    return {
      translate: async (request) => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        return {
          translations: request.targetLanguages.map((lang) => ({
            text: `[Mock translation to ${lang}]: ${request.text}`,
            language: lang,
            confidence: 0.85,
          })),
          sourceLanguage: request.sourceLanguage,
          timestamp: Date.now(),
        };
      },
    };
  }

  /**
   * Create mock language detector
   */
  _createMockLanguageDetector() {
    return {
      detect: async (text) => {
        await new Promise((resolve) => setTimeout(resolve, 25));
        return {
          language: 'en-US',
          confidence: 0.9,
          alternatives: [{ language: 'en-GB', confidence: 0.75 }],
        };
      },
    };
  }

  /**
   * Apply optimizations
   */
  _applyOptimizations(request) {
    // Apply various optimization strategies
    return {
      ...request,
      optimized: true,
      optimizations: ['caching', 'batching', 'compression'],
    };
  }

  /**
   * Simple hash function
   */
  _simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Generate integration ID
   */
  _generateIntegrationId() {
    return `integration_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get default integration ID
   */
  _getDefaultIntegrationId() {
    const integrations = Array.from(this.activeIntegrations.keys());
    return integrations.length > 0 ? integrations[0] : this._generateIntegrationId();
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    try {
      console.log('Cleaning up TranslationIntegration...');

      // Stop all active integrations
      const integrationIds = Array.from(this.activeIntegrations.keys());
      for (const id of integrationIds) {
        await this.stopIntegration(id);
      }

      // Cleanup components
      if (this.audioProcessor) {
        await this.audioProcessor.cleanup();
        this.audioProcessor = null;
      }

      if (this.translationPipeline) {
        await this.translationPipeline.cleanup();
        this.translationPipeline = null;
      }

      // Clear caches and connections
      this.translationCache.clear();
      this.serviceConnections.clear();
      this.activeIntegrations.clear();

      // Stop performance monitoring
      if (this.performanceMonitoringInterval) {
        clearInterval(this.performanceMonitoringInterval);
        this.performanceMonitoringInterval = null;
      }

      this.isIntegrated = false;

      this.emit('cleanup');
      console.log('TranslationIntegration cleanup completed');
    } catch (error) {
      console.error('Error during cleanup:', error);
      this.emit('error', error);
    }
  }
}

export default TranslationIntegration;
