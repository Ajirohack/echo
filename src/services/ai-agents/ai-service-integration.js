import { EventEmitter } from 'events';
import { logger } from '../../utils/logger.js';

/**
 * AIServiceIntegration - Integration layer for AI agents with existing Echo services
 * Provides seamless integration between AI agents and translation, audio, RTC services
 */
export class AIServiceIntegration extends EventEmitter {
  constructor(config = {}) {
    super();

    this.config = {
      // Integration Configuration
      integration: {
        name: 'Echo AI Service Integration',
        version: '1.0.0',
        enableAutoDiscovery: true,
        enableServiceMesh: true,
        enableCircuitBreaker: true,
        enableRetry: true,
        maxRetries: 3,
        retryDelay: 1000,
      },

      // Service Discovery Configuration
      discovery: {
        enableHealthChecks: true,
        healthCheckInterval: 30000,
        serviceTimeout: 10000,
        enableLoadBalancing: true,
        loadBalancingStrategy: 'round-robin',
      },

      // Translation Integration
      translation: {
        enableRealTimeTranslation: true,
        enableBatchTranslation: true,
        enableCaching: true,
        cacheSize: 1000,
        cacheTTL: 3600000, // 1 hour
        supportedLanguages: ['en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'ja', 'ko', 'zh'],
        defaultSourceLanguage: 'auto',
        defaultTargetLanguage: 'en',
      },

      // Audio Processing Integration
      audio: {
        enableSpeechToText: true,
        enableTextToSpeech: true,
        enableAudioProcessing: true,
        enableRealTimeProcessing: true,
        sampleRate: 44100,
        channels: 2,
        bitDepth: 16,
        enableNoiseReduction: true,
        enableEchoCancellation: true,
      },

      // RTC Integration
      rtc: {
        enableRealTimeProcessing: true,
        enableStreamProcessing: true,
        enableQualityAdaptation: true,
        enableBandwidthOptimization: true,
        maxConnections: 100,
        connectionTimeout: 30000,
      },

      // Quality Monitoring Integration
      quality: {
        enableQualityMonitoring: true,
        enablePerformanceTracking: true,
        enableAlerts: true,
        qualityThreshold: 0.8,
        performanceThreshold: 2000, // 2 seconds
        enableOptimization: true,
      },

      // Database Integration
      database: {
        enableConversationStorage: true,
        enableContextStorage: true,
        enableAnalytics: true,
        enableBackup: true,
        retentionPeriod: 2592000000, // 30 days
        enableEncryption: true,
      },

      ...config,
    };

    // Service references
    this.aiAgent = null;
    this.aiAgentIntegration = null;
    this.translationService = null;
    this.audioProcessor = null;
    this.rtcService = null;
    this.qualityMonitor = null;
    this.databaseService = null;

    // Integration components
    this.serviceRegistry = new Map();
    this.serviceHealthStatus = new Map();
    this.circuitBreakers = new Map();
    this.loadBalancers = new Map();
    this.cache = new Map();

    // Internal state
    this.isInitialized = false;
    this.isRunning = false;
    this.activeIntegrations = new Set();

    // Statistics
    this.statistics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      totalProcessingTime: 0,
      serviceCallsCount: {
        translation: 0,
        audio: 0,
        rtc: 0,
        quality: 0,
        database: 0,
      },
      cacheHits: 0,
      cacheMisses: 0,
    };

    // Timers
    this.healthCheckInterval = null;
    this.metricsInterval = null;
    this.cleanupInterval = null;

    this._setupEventHandlers();
  }

  /**
   * Initialize the AI service integration
   */
  async initialize() {
    try {
      logger.info('Initializing AIServiceIntegration...');

      // Initialize service registry
      await this._initializeServiceRegistry();

      // Initialize circuit breakers
      await this._initializeCircuitBreakers();

      // Initialize load balancers
      await this._initializeLoadBalancers();

      // Initialize integration components
      await this._initializeIntegrationComponents();

      // Start background processes
      this._startBackgroundProcesses();

      this.isInitialized = true;
      this.emit('initialized');

      logger.info('AIServiceIntegration initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize AIServiceIntegration:', error);
      throw error;
    }
  }

  /**
   * Start the AI service integration
   */
  async start() {
    if (!this.isInitialized) {
      throw new Error('AI service integration must be initialized before starting');
    }

    try {
      logger.info('Starting AIServiceIntegration...');

      // Discover and register services
      await this._discoverServices();

      // Setup service integrations
      await this._setupServiceIntegrations();

      // Start health monitoring
      await this._startHealthMonitoring();

      this.isRunning = true;
      this.emit('started');

      logger.info('AIServiceIntegration started successfully');
    } catch (error) {
      logger.error('Failed to start AIServiceIntegration:', error);
      throw error;
    }
  }

  /**
   * Stop the AI service integration
   */
  async stop() {
    try {
      logger.info('Stopping AIServiceIntegration...');

      this.isRunning = false;

      // Stop background processes
      this._stopBackgroundProcesses();

      // Cleanup integrations
      await this._cleanupIntegrations();

      this.emit('stopped');
      logger.info('AIServiceIntegration stopped successfully');
    } catch (error) {
      logger.error('Failed to stop AIServiceIntegration:', error);
      throw error;
    }
  }

  /**
   * Register AI agent service
   */
  registerAIAgent(aiAgent) {
    this.aiAgent = aiAgent;
    this._registerService('aiAgent', aiAgent);
    this._setupAIAgentIntegration();
    this.emit('aiAgentRegistered', aiAgent);
  }

  /**
   * Register AI agent integration service
   */
  registerAIAgentIntegration(aiAgentIntegration) {
    this.aiAgentIntegration = aiAgentIntegration;
    this._registerService('aiAgentIntegration', aiAgentIntegration);
    this._setupAIAgentIntegrationHandlers();
    this.emit('aiAgentIntegrationRegistered', aiAgentIntegration);
  }

  /**
   * Register translation service
   */
  registerTranslationService(translationService) {
    this.translationService = translationService;
    this._registerService('translation', translationService);
    this._setupTranslationIntegration();
    this.emit('translationServiceRegistered', translationService);
  }

  /**
   * Register audio processor
   */
  registerAudioProcessor(audioProcessor) {
    this.audioProcessor = audioProcessor;
    this._registerService('audio', audioProcessor);
    this._setupAudioProcessingIntegration();
    this.emit('audioProcessorRegistered', audioProcessor);
  }

  /**
   * Register RTC service
   */
  registerRTCService(rtcService) {
    this.rtcService = rtcService;
    this._registerService('rtc', rtcService);
    this._setupRTCIntegration();
    this.emit('rtcServiceRegistered', rtcService);
  }

  /**
   * Register quality monitor
   */
  registerQualityMonitor(qualityMonitor) {
    this.qualityMonitor = qualityMonitor;
    this._registerService('quality', qualityMonitor);
    this._setupQualityMonitoringIntegration();
    this.emit('qualityMonitorRegistered', qualityMonitor);
  }

  /**
   * Register database service
   */
  registerDatabaseService(databaseService) {
    this.databaseService = databaseService;
    this._registerService('database', databaseService);
    this._setupDatabaseIntegration();
    this.emit('databaseServiceRegistered', databaseService);
  }

  /**
   * Process conversation with integrated services
   */
  async processConversationWithServices(request) {
    const requestId = this._generateRequestId();
    const startTime = Date.now();

    try {
      logger.debug(`Processing conversation ${requestId} with integrated services`);

      // Validate request
      this._validateConversationRequest(request);

      // Create processing context
      const context = {
        requestId,
        request,
        startTime,
        services: {},
        results: {},
        metadata: {},
      };

      // Process through integration pipeline
      await this._processIntegrationPipeline(context);

      // Update statistics
      this._updateStatistics(requestId, startTime, true);

      const response = {
        requestId,
        conversation: context.results.conversation,
        translation: context.results.translation,
        audio: context.results.audio,
        quality: context.results.quality,
        metadata: {
          ...context.metadata,
          processingTime: Date.now() - startTime,
          servicesUsed: Object.keys(context.services),
        },
      };

      this.emit('conversationProcessed', response);

      return response;
    } catch (error) {
      logger.error(`Failed to process conversation ${requestId}:`, error);

      // Update statistics
      this._updateStatistics(requestId, startTime, false);

      this.emit('conversationError', {
        requestId,
        request,
        error,
        processingTime: Date.now() - startTime,
      });

      throw error;
    }
  }

  /**
   * Process audio with integrated services
   */
  async processAudioWithServices(audioData, options = {}) {
    const requestId = this._generateRequestId();
    const startTime = Date.now();

    try {
      logger.debug(`Processing audio ${requestId} with integrated services`);

      // Create processing context
      const context = {
        requestId,
        audioData,
        options,
        startTime,
        services: {},
        results: {},
        metadata: {},
      };

      // Process audio through services
      await this._processAudioPipeline(context);

      // Update statistics
      this._updateStatistics(requestId, startTime, true);

      const response = {
        requestId,
        processedAudio: context.results.processedAudio,
        speechText: context.results.speechText,
        translation: context.results.translation,
        conversation: context.results.conversation,
        quality: context.results.quality,
        metadata: {
          ...context.metadata,
          processingTime: Date.now() - startTime,
          servicesUsed: Object.keys(context.services),
        },
      };

      this.emit('audioProcessed', response);

      return response;
    } catch (error) {
      logger.error(`Failed to process audio ${requestId}:`, error);

      // Update statistics
      this._updateStatistics(requestId, startTime, false);

      this.emit('audioError', {
        requestId,
        audioData,
        options,
        error,
        processingTime: Date.now() - startTime,
      });

      throw error;
    }
  }

  /**
   * Process RTC stream with integrated services
   */
  async processRTCStreamWithServices(streamData, connectionInfo) {
    const requestId = this._generateRequestId();
    const startTime = Date.now();

    try {
      logger.debug(`Processing RTC stream ${requestId} with integrated services`);

      // Create processing context
      const context = {
        requestId,
        streamData,
        connectionInfo,
        startTime,
        services: {},
        results: {},
        metadata: {},
      };

      // Process stream through services
      await this._processRTCPipeline(context);

      // Update statistics
      this._updateStatistics(requestId, startTime, true);

      const response = {
        requestId,
        processedStream: context.results.processedStream,
        audioProcessing: context.results.audioProcessing,
        translation: context.results.translation,
        conversation: context.results.conversation,
        quality: context.results.quality,
        metadata: {
          ...context.metadata,
          processingTime: Date.now() - startTime,
          servicesUsed: Object.keys(context.services),
        },
      };

      this.emit('rtcStreamProcessed', response);

      return response;
    } catch (error) {
      logger.error(`Failed to process RTC stream ${requestId}:`, error);

      // Update statistics
      this._updateStatistics(requestId, startTime, false);

      this.emit('rtcStreamError', {
        requestId,
        streamData,
        connectionInfo,
        error,
        processingTime: Date.now() - startTime,
      });

      throw error;
    }
  }

  /**
   * Get service health status
   */
  getServiceHealthStatus() {
    const healthStatus = {};

    for (const [serviceName, status] of this.serviceHealthStatus.entries()) {
      healthStatus[serviceName] = {
        isHealthy: status.isHealthy,
        lastCheck: status.lastCheck,
        responseTime: status.responseTime,
        errorCount: status.errorCount,
        uptime: status.uptime,
      };
    }

    return healthStatus;
  }

  /**
   * Get integration statistics
   */
  getStatistics() {
    return {
      ...this.statistics,
      serviceHealth: this.getServiceHealthStatus(),
      registeredServices: Array.from(this.serviceRegistry.keys()),
      activeIntegrations: Array.from(this.activeIntegrations),
      cacheSize: this.cache.size,
      uptime: this.isInitialized ? Date.now() - this.initializationTime : 0,
    };
  }

  /**
   * Update configuration
   */
  updateConfiguration(newConfig) {
    try {
      // Validate configuration
      this._validateConfiguration(newConfig);

      // Merge with existing configuration
      this.config = this._mergeConfiguration(this.config, newConfig);

      // Apply configuration changes
      this._applyConfigurationChanges(newConfig);

      this.emit('configurationUpdated', newConfig);
      logger.info('AI service integration configuration updated successfully');
    } catch (error) {
      logger.error('Failed to update AI service integration configuration:', error);
      throw error;
    }
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    try {
      logger.info('Cleaning up AIServiceIntegration...');

      // Stop the service if running
      if (this.isRunning) {
        await this.stop();
      }

      // Clear service registry
      this.serviceRegistry.clear();
      this.serviceHealthStatus.clear();
      this.circuitBreakers.clear();
      this.loadBalancers.clear();
      this.cache.clear();
      this.activeIntegrations.clear();

      // Reset state
      this.isInitialized = false;
      this.isRunning = false;

      this.emit('cleanup');
      logger.info('AIServiceIntegration cleaned up successfully');
    } catch (error) {
      logger.error('Failed to cleanup AIServiceIntegration:', error);
      throw error;
    }
  }

  // Private methods

  _setupEventHandlers() {
    this.on('error', (error) => {
      logger.error('AIServiceIntegration error:', error);
    });
  }

  async _initializeServiceRegistry() {
    // Initialize service registry for tracking registered services
    this.serviceRegistry.clear();
    this.serviceHealthStatus.clear();
  }

  async _initializeCircuitBreakers() {
    // Initialize circuit breakers for each service type
    const serviceTypes = [
      'aiAgent',
      'aiAgentIntegration',
      'translation',
      'audio',
      'rtc',
      'quality',
      'database',
    ];

    for (const serviceType of serviceTypes) {
      this.circuitBreakers.set(
        serviceType,
        new ServiceCircuitBreaker({
          failureThreshold: 5,
          recoveryTimeout: 30000,
          monitoringPeriod: 60000,
        })
      );
    }
  }

  async _initializeLoadBalancers() {
    // Initialize load balancers for service distribution
    const serviceTypes = [
      'aiAgent',
      'aiAgentIntegration',
      'translation',
      'audio',
      'rtc',
      'quality',
      'database',
    ];

    for (const serviceType of serviceTypes) {
      this.loadBalancers.set(
        serviceType,
        new ServiceLoadBalancer({
          strategy: this.config.discovery.loadBalancingStrategy,
          healthCheckEnabled: this.config.discovery.enableHealthChecks,
        })
      );
    }
  }

  async _initializeIntegrationComponents() {
    // Initialize integration-specific components
    this.initializationTime = Date.now();
  }

  _startBackgroundProcesses() {
    // Start health check interval
    if (this.config.discovery.enableHealthChecks) {
      this.healthCheckInterval = setInterval(() => {
        this._performHealthChecks();
      }, this.config.discovery.healthCheckInterval);
    }

    // Start metrics collection interval
    this.metricsInterval = setInterval(() => {
      this._collectMetrics();
    }, 60000); // 1 minute

    // Start cleanup interval
    this.cleanupInterval = setInterval(() => {
      this._performCleanup();
    }, 300000); // 5 minutes
  }

  _stopBackgroundProcesses() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = null;
    }

    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  async _discoverServices() {
    // Auto-discover available services if enabled
    if (this.config.integration.enableAutoDiscovery) {
      logger.info('Auto-discovering services...');

      // Discovery logic would go here
      // For now, we rely on manual registration
    }
  }

  async _setupServiceIntegrations() {
    // Setup integrations for all registered services
    for (const [serviceName, service] of this.serviceRegistry.entries()) {
      await this._setupServiceIntegration(serviceName, service);
    }
  }

  async _setupServiceIntegration(serviceName, service) {
    try {
      // Setup service-specific integration
      switch (serviceName) {
        case 'aiAgent':
          await this._setupAIAgentIntegration();
          break;
        case 'aiAgentIntegration':
          await this._setupAIAgentIntegrationHandlers();
          break;
        case 'translation':
          await this._setupTranslationIntegration();
          break;
        case 'audio':
          await this._setupAudioProcessingIntegration();
          break;
        case 'rtc':
          await this._setupRTCIntegration();
          break;
        case 'quality':
          await this._setupQualityMonitoringIntegration();
          break;
        case 'database':
          await this._setupDatabaseIntegration();
          break;
      }

      this.activeIntegrations.add(serviceName);
      logger.info(`Setup integration for service: ${serviceName}`);
    } catch (error) {
      logger.error(`Failed to setup integration for service ${serviceName}:`, error);
    }
  }

  async _startHealthMonitoring() {
    // Start monitoring health of all registered services
    for (const serviceName of this.serviceRegistry.keys()) {
      this._initializeServiceHealth(serviceName);
    }
  }

  _registerService(serviceName, service) {
    this.serviceRegistry.set(serviceName, service);
    this._initializeServiceHealth(serviceName);
    logger.info(`Registered service: ${serviceName}`);
  }

  _initializeServiceHealth(serviceName) {
    this.serviceHealthStatus.set(serviceName, {
      isHealthy: true,
      lastCheck: Date.now(),
      responseTime: 0,
      errorCount: 0,
      uptime: Date.now(),
    });
  }

  async _setupAIAgentIntegration() {
    if (!this.aiAgent) return;

    // Setup AI agent event handlers
    this.aiAgent.on('conversationProcessed', (data) => {
      this.emit('aiAgentConversationProcessed', data);
    });

    this.aiAgent.on('conversationError', (data) => {
      this.emit('aiAgentConversationError', data);
    });

    this.aiAgent.on('configurationUpdated', (config) => {
      this.emit('aiAgentConfigurationUpdated', config);
    });
  }

  async _setupAIAgentIntegrationHandlers() {
    if (!this.aiAgentIntegration) return;

    // Setup AI agent integration event handlers
    this.aiAgentIntegration.on('requestProcessed', (data) => {
      this.emit('aiAgentIntegrationRequestProcessed', data);
    });

    this.aiAgentIntegration.on('requestError', (data) => {
      this.emit('aiAgentIntegrationRequestError', data);
    });

    this.aiAgentIntegration.on('agentPoolScaled', (data) => {
      this.emit('aiAgentPoolScaled', data);
    });
  }

  async _setupTranslationIntegration() {
    if (!this.translationService) return;

    // Setup translation service event handlers
    this.translationService.on('translationComplete', (data) => {
      this.emit('translationComplete', data);
    });

    this.translationService.on('translationError', (data) => {
      this.emit('translationError', data);
    });
  }

  async _setupAudioProcessingIntegration() {
    if (!this.audioProcessor) return;

    // Setup audio processor event handlers
    this.audioProcessor.on('audioProcessed', (data) => {
      this.emit('audioProcessed', data);
    });

    this.audioProcessor.on('audioError', (data) => {
      this.emit('audioError', data);
    });
  }

  async _setupRTCIntegration() {
    if (!this.rtcService) return;

    // Setup RTC service event handlers
    this.rtcService.on('connectionEstablished', (data) => {
      this.emit('rtcConnectionEstablished', data);
    });

    this.rtcService.on('connectionClosed', (data) => {
      this.emit('rtcConnectionClosed', data);
    });

    this.rtcService.on('streamProcessed', (data) => {
      this.emit('rtcStreamProcessed', data);
    });
  }

  async _setupQualityMonitoringIntegration() {
    if (!this.qualityMonitor) return;

    // Setup quality monitor event handlers
    this.qualityMonitor.on('qualityAlert', (data) => {
      this.emit('qualityAlert', data);
    });

    this.qualityMonitor.on('optimizationApplied', (data) => {
      this.emit('optimizationApplied', data);
    });
  }

  async _setupDatabaseIntegration() {
    if (!this.databaseService) return;

    // Setup database service event handlers
    this.databaseService.on('conversationStored', (data) => {
      this.emit('conversationStored', data);
    });

    this.databaseService.on('contextStored', (data) => {
      this.emit('contextStored', data);
    });
  }

  async _processIntegrationPipeline(context) {
    // Process conversation through AI agent
    if (this.aiAgent) {
      context.services.aiAgent = this.aiAgent;
      context.results.conversation = await this._callServiceWithCircuitBreaker('aiAgent', () =>
        this.aiAgent.processConversation(context.request)
      );
    }

    // Process translation if needed
    if (this.translationService && context.request.targetLanguage) {
      context.services.translation = this.translationService;
      context.results.translation = await this._callServiceWithCircuitBreaker('translation', () =>
        this.translationService.translate(
          context.results.conversation.message,
          context.request.sourceLanguage || 'auto',
          context.request.targetLanguage
        )
      );
    }

    // Process audio if needed
    if (this.audioProcessor && context.request.enableAudioResponse) {
      context.services.audio = this.audioProcessor;
      const textToConvert =
        context.results.translation?.translatedText || context.results.conversation.message;
      context.results.audio = await this._callServiceWithCircuitBreaker('audio', () =>
        this.audioProcessor.textToSpeech(textToConvert, context.request.targetLanguage)
      );
    }

    // Monitor quality
    if (this.qualityMonitor) {
      context.services.quality = this.qualityMonitor;
      context.results.quality = await this._callServiceWithCircuitBreaker('quality', () =>
        this.qualityMonitor.analyzeQuality({
          conversation: context.results.conversation,
          translation: context.results.translation,
          audio: context.results.audio,
        })
      );
    }

    // Store conversation if enabled
    if (this.databaseService && this.config.database.enableConversationStorage) {
      context.services.database = this.databaseService;
      await this._callServiceWithCircuitBreaker('database', () =>
        this.databaseService.storeConversation({
          requestId: context.requestId,
          conversation: context.results.conversation,
          translation: context.results.translation,
          quality: context.results.quality,
          timestamp: context.startTime,
        })
      );
    }
  }

  async _processAudioPipeline(context) {
    // Process audio through audio processor
    if (this.audioProcessor) {
      context.services.audio = this.audioProcessor;
      context.results.processedAudio = await this._callServiceWithCircuitBreaker('audio', () =>
        this.audioProcessor.processAudio(context.audioData)
      );

      // Extract speech text if available
      if (context.results.processedAudio.speechText) {
        context.results.speechText = context.results.processedAudio.speechText;

        // Process conversation with AI agent
        if (this.aiAgent) {
          const conversationRequest = {
            userId: context.options.userId || 'anonymous',
            sessionId: context.options.sessionId || this._generateSessionId(),
            message: context.results.speechText,
            type: 'audio',
            metadata: {
              audioQuality: context.results.processedAudio.quality,
              confidence: context.results.processedAudio.confidence,
            },
          };

          context.services.aiAgent = this.aiAgent;
          context.results.conversation = await this._callServiceWithCircuitBreaker('aiAgent', () =>
            this.aiAgent.processConversation(conversationRequest)
          );
        }
      }
    }

    // Process translation if needed
    if (this.translationService && context.options.targetLanguage && context.results.speechText) {
      context.services.translation = this.translationService;
      context.results.translation = await this._callServiceWithCircuitBreaker('translation', () =>
        this.translationService.translate(
          context.results.speechText,
          context.options.sourceLanguage || 'auto',
          context.options.targetLanguage
        )
      );
    }

    // Monitor quality
    if (this.qualityMonitor) {
      context.services.quality = this.qualityMonitor;
      context.results.quality = await this._callServiceWithCircuitBreaker('quality', () =>
        this.qualityMonitor.analyzeAudioQuality({
          originalAudio: context.audioData,
          processedAudio: context.results.processedAudio,
          speechText: context.results.speechText,
          translation: context.results.translation,
        })
      );
    }
  }

  async _processRTCPipeline(context) {
    // Process RTC stream
    if (this.rtcService) {
      context.services.rtc = this.rtcService;
      context.results.processedStream = await this._callServiceWithCircuitBreaker('rtc', () =>
        this.rtcService.processStream(context.streamData, context.connectionInfo)
      );
    }

    // Process audio from stream
    if (this.audioProcessor && context.results.processedStream?.audioData) {
      context.services.audio = this.audioProcessor;
      context.results.audioProcessing = await this._callServiceWithCircuitBreaker('audio', () =>
        this.audioProcessor.processAudio(context.results.processedStream.audioData)
      );

      // Process conversation if speech detected
      if (context.results.audioProcessing.speechText && this.aiAgent) {
        const conversationRequest = {
          userId: context.connectionInfo.userId || 'anonymous',
          sessionId: context.connectionInfo.sessionId || this._generateSessionId(),
          message: context.results.audioProcessing.speechText,
          type: 'rtc',
          metadata: {
            connectionId: context.connectionInfo.connectionId,
            audioQuality: context.results.audioProcessing.quality,
          },
        };

        context.services.aiAgent = this.aiAgent;
        context.results.conversation = await this._callServiceWithCircuitBreaker('aiAgent', () =>
          this.aiAgent.processConversation(conversationRequest)
        );
      }
    }

    // Process translation if needed
    if (
      this.translationService &&
      context.results.audioProcessing?.speechText &&
      context.connectionInfo.targetLanguage
    ) {
      context.services.translation = this.translationService;
      context.results.translation = await this._callServiceWithCircuitBreaker('translation', () =>
        this.translationService.translate(
          context.results.audioProcessing.speechText,
          context.connectionInfo.sourceLanguage || 'auto',
          context.connectionInfo.targetLanguage
        )
      );
    }

    // Monitor quality
    if (this.qualityMonitor) {
      context.services.quality = this.qualityMonitor;
      context.results.quality = await this._callServiceWithCircuitBreaker('quality', () =>
        this.qualityMonitor.analyzeRTCQuality({
          streamData: context.streamData,
          processedStream: context.results.processedStream,
          audioProcessing: context.results.audioProcessing,
          conversation: context.results.conversation,
          translation: context.results.translation,
        })
      );
    }
  }

  async _callServiceWithCircuitBreaker(serviceName, serviceCall) {
    const circuitBreaker = this.circuitBreakers.get(serviceName);

    if (circuitBreaker && !circuitBreaker.canExecute()) {
      throw new Error(`Circuit breaker is open for service: ${serviceName}`);
    }

    const startTime = Date.now();

    try {
      const result = await serviceCall();

      // Update service health
      this._updateServiceHealth(serviceName, Date.now() - startTime, true);

      // Update circuit breaker
      if (circuitBreaker) {
        circuitBreaker.recordSuccess();
      }

      // Update statistics
      this.statistics.serviceCallsCount[serviceName] =
        (this.statistics.serviceCallsCount[serviceName] || 0) + 1;

      return result;
    } catch (error) {
      // Update service health
      this._updateServiceHealth(serviceName, Date.now() - startTime, false);

      // Update circuit breaker
      if (circuitBreaker) {
        circuitBreaker.recordFailure();
      }

      throw error;
    }
  }

  _updateServiceHealth(serviceName, responseTime, success) {
    const health = this.serviceHealthStatus.get(serviceName);

    if (health) {
      health.lastCheck = Date.now();
      health.responseTime = responseTime;

      if (success) {
        health.isHealthy = true;
        health.errorCount = Math.max(0, health.errorCount - 1);
      } else {
        health.errorCount++;

        // Mark as unhealthy if too many errors
        if (health.errorCount >= 5) {
          health.isHealthy = false;
        }
      }
    }
  }

  _performHealthChecks() {
    // Perform health checks on all registered services
    for (const [serviceName, service] of this.serviceRegistry.entries()) {
      this._checkServiceHealth(serviceName, service);
    }
  }

  async _checkServiceHealth(serviceName, service) {
    try {
      const startTime = Date.now();

      // Perform health check based on service type
      let isHealthy = false;

      if (service && typeof service.getStatus === 'function') {
        const status = service.getStatus();
        isHealthy = status.isInitialized && (status.isActive || status.isRunning);
      } else if (service && typeof service.getHealthStatus === 'function') {
        const healthStatus = service.getHealthStatus();
        isHealthy = healthStatus.status === 'healthy';
      } else {
        // Fallback health check
        isHealthy = !!service;
      }

      this._updateServiceHealth(serviceName, Date.now() - startTime, isHealthy);
    } catch (error) {
      logger.error(`Health check failed for service ${serviceName}:`, error);
      this._updateServiceHealth(serviceName, 0, false);
    }
  }

  _collectMetrics() {
    // Collect and emit metrics
    const metrics = {
      timestamp: Date.now(),
      statistics: this.getStatistics(),
      serviceHealth: this.getServiceHealthStatus(),
    };

    this.emit('metricsCollected', metrics);
  }

  _performCleanup() {
    // Clean up expired cache entries
    const now = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      if (entry.ttl && now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
      }
    }
  }

  async _cleanupIntegrations() {
    // Cleanup all active integrations
    for (const serviceName of this.activeIntegrations) {
      try {
        await this._cleanupServiceIntegration(serviceName);
      } catch (error) {
        logger.error(`Failed to cleanup integration for service ${serviceName}:`, error);
      }
    }

    this.activeIntegrations.clear();
  }

  async _cleanupServiceIntegration(serviceName) {
    // Cleanup service-specific integration
    const service = this.serviceRegistry.get(serviceName);

    if (service && typeof service.removeAllListeners === 'function') {
      service.removeAllListeners();
    }
  }

  _validateConversationRequest(request) {
    if (!request) {
      throw new Error('Conversation request is required');
    }

    if (!request.message) {
      throw new Error('Request message is required');
    }

    if (!request.userId) {
      throw new Error('User ID is required');
    }
  }

  _validateConfiguration(config) {
    // Basic configuration validation
    if (
      config.discovery &&
      config.discovery.healthCheckInterval &&
      config.discovery.healthCheckInterval < 1000
    ) {
      throw new Error('Invalid configuration: healthCheckInterval must be at least 1000ms');
    }
  }

  _mergeConfiguration(existing, newConfig) {
    // Deep merge configuration objects
    const merged = JSON.parse(JSON.stringify(existing));

    const mergeObjects = (target, source) => {
      for (const key in source) {
        if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
          target[key] = target[key] || {};
          mergeObjects(target[key], source[key]);
        } else {
          target[key] = source[key];
        }
      }
    };

    mergeObjects(merged, newConfig);
    return merged;
  }

  _applyConfigurationChanges(newConfig) {
    // Apply configuration changes to running components
    if (newConfig.discovery) {
      // Update health check interval
      if (this.healthCheckInterval && newConfig.discovery.healthCheckInterval) {
        clearInterval(this.healthCheckInterval);
        this.healthCheckInterval = setInterval(() => {
          this._performHealthChecks();
        }, newConfig.discovery.healthCheckInterval);
      }
    }
  }

  _updateStatistics(requestId, startTime, success) {
    const processingTime = Date.now() - startTime;

    this.statistics.totalRequests++;
    this.statistics.totalProcessingTime += processingTime;
    this.statistics.averageResponseTime =
      this.statistics.totalProcessingTime / this.statistics.totalRequests;

    if (success) {
      this.statistics.successfulRequests++;
    } else {
      this.statistics.failedRequests++;
    }
  }

  _generateRequestId() {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  _generateSessionId() {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Helper classes
class ServiceCircuitBreaker {
  constructor(config) {
    this.config = config;
    this.state = 'closed'; // closed, open, half-open
    this.failures = 0;
    this.lastFailureTime = null;
    this.nextAttemptTime = null;
  }

  canExecute() {
    const now = Date.now();

    switch (this.state) {
      case 'closed':
        return true;
      case 'open':
        if (now >= this.nextAttemptTime) {
          this.state = 'half-open';
          return true;
        }
        return false;
      case 'half-open':
        return true;
      default:
        return false;
    }
  }

  recordSuccess() {
    this.failures = 0;
    this.state = 'closed';
  }

  recordFailure() {
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.failures >= this.config.failureThreshold) {
      this.state = 'open';
      this.nextAttemptTime = Date.now() + this.config.recoveryTimeout;
    }
  }
}

class ServiceLoadBalancer {
  constructor(config) {
    this.config = config;
    this.currentIndex = 0;
  }

  selectService(services) {
    if (!services || services.length === 0) {
      return null;
    }

    // Simple round-robin for now
    const selectedService = services[this.currentIndex % services.length];
    this.currentIndex++;

    return selectedService;
  }
}

export default AIServiceIntegration;
