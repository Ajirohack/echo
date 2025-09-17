import { EventEmitter } from 'events';
import { logger } from '../../utils/logger.js';

/**
 * AIAgentIntegration - Server-side AI processing and integration service
 * Handles AI agent coordination, service orchestration, and enterprise features
 */
export class AIAgentIntegration extends EventEmitter {
  constructor(config = {}) {
    super();

    this.config = {
      // Integration Configuration
      integration: {
        name: 'Echo AI Agent Integration',
        version: '1.0.0',
        enableDistributedProcessing: true,
        enableLoadBalancing: true,
        enableFailover: true,
        enableScaling: true,
      },

      // Server Configuration
      server: {
        port: 8080,
        host: '0.0.0.0',
        enableHTTPS: false,
        enableCORS: true,
        enableCompression: true,
        maxConnections: 1000,
        requestTimeout: 30000,
        keepAliveTimeout: 5000,
      },

      // AI Processing Configuration
      processing: {
        maxConcurrentAgents: 10,
        agentPoolSize: 5,
        processingTimeout: 60000,
        enableBatching: true,
        batchSize: 5,
        batchTimeout: 2000,
        enablePrioritization: true,
        enableQueueing: true,
        maxQueueSize: 100,
      },

      // Load Balancing Configuration
      loadBalancing: {
        strategy: 'round-robin', // round-robin, least-connections, weighted
        enableHealthChecks: true,
        healthCheckInterval: 30000,
        unhealthyThreshold: 3,
        recoveryThreshold: 2,
        enableCircuitBreaker: true,
      },

      // Scaling Configuration
      scaling: {
        enableAutoScaling: true,
        minAgents: 2,
        maxAgents: 20,
        scaleUpThreshold: 0.8,
        scaleDownThreshold: 0.3,
        scaleUpCooldown: 300000, // 5 minutes
        scaleDownCooldown: 600000, // 10 minutes
        enablePredictiveScaling: true,
      },

      // Caching Configuration
      caching: {
        enableResponseCaching: true,
        enableContextCaching: true,
        cacheSize: 10000,
        cacheTTL: 3600000, // 1 hour
        enableDistributedCache: true,
        cacheStrategy: 'lru',
      },

      // Monitoring Configuration
      monitoring: {
        enableMetrics: true,
        enableTracing: true,
        enableLogging: true,
        metricsInterval: 60000,
        enableAlerts: true,
        enableDashboard: true,
      },

      // Security Configuration
      security: {
        enableAuthentication: true,
        enableAuthorization: true,
        enableRateLimiting: true,
        rateLimit: 1000, // requests per minute
        enableEncryption: true,
        enableAuditLogging: true,
        enableInputValidation: true,
      },

      ...config,
    };

    // Internal state
    this.isInitialized = false;
    this.isRunning = false;
    this.agentPool = [];
    this.activeAgents = new Map();
    this.requestQueue = [];
    this.processingQueue = [];
    this.cache = new Map();
    this.distributedCache = null;

    // Service references
    this.httpServer = null;
    this.websocketServer = null;
    this.loadBalancer = null;
    this.circuitBreaker = null;
    this.autoScaler = null;
    this.metricsCollector = null;
    this.healthMonitor = null;

    // Integration services
    this.translationService = null;
    this.audioProcessor = null;
    this.rtcService = null;
    this.qualityMonitor = null;
    this.databaseService = null;

    // Statistics and metrics
    this.statistics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      totalProcessingTime: 0,
      activeConnections: 0,
      queuedRequests: 0,
      cacheHits: 0,
      cacheMisses: 0,
      agentUtilization: 0,
      throughput: 0,
    };

    // Timers and intervals
    this.processingInterval = null;
    this.metricsInterval = null;
    this.healthCheckInterval = null;
    this.scalingInterval = null;
    this.cleanupInterval = null;

    this._setupEventHandlers();
  }

  /**
   * Initialize the AI agent integration service
   */
  async initialize() {
    try {
      logger.info('Initializing AIAgentIntegration service...');

      // Initialize core components
      await this._initializeComponents();

      // Initialize agent pool
      await this._initializeAgentPool();

      // Initialize server infrastructure
      await this._initializeServerInfrastructure();

      // Initialize service integrations
      await this._initializeServiceIntegrations();

      // Initialize monitoring and metrics
      await this._initializeMonitoring();

      // Start background processes
      this._startBackgroundProcesses();

      this.isInitialized = true;
      this.emit('initialized');

      logger.info('AIAgentIntegration service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize AIAgentIntegration service:', error);
      throw error;
    }
  }

  /**
   * Start the AI agent integration service
   */
  async start() {
    if (!this.isInitialized) {
      throw new Error('AI agent integration service must be initialized before starting');
    }

    try {
      logger.info('Starting AIAgentIntegration service...');

      // Start HTTP server
      await this._startHTTPServer();

      // Start WebSocket server
      await this._startWebSocketServer();

      // Start agent pool
      await this._startAgentPool();

      // Start load balancer
      if (this.loadBalancer) {
        await this.loadBalancer.start();
      }

      // Start auto scaler
      if (this.autoScaler) {
        await this.autoScaler.start();
      }

      // Start health monitor
      if (this.healthMonitor) {
        await this.healthMonitor.start();
      }

      this.isRunning = true;
      this.emit('started');

      logger.info(
        `AIAgentIntegration service started on ${this.config.server.host}:${this.config.server.port}`
      );
    } catch (error) {
      logger.error('Failed to start AIAgentIntegration service:', error);
      throw error;
    }
  }

  /**
   * Stop the AI agent integration service
   */
  async stop() {
    try {
      logger.info('Stopping AIAgentIntegration service...');

      this.isRunning = false;

      // Stop accepting new requests
      await this._stopAcceptingRequests();

      // Wait for active requests to complete
      await this._waitForActiveRequests();

      // Stop agent pool
      await this._stopAgentPool();

      // Stop servers
      await this._stopServers();

      // Stop background processes
      this._stopBackgroundProcesses();

      // Stop monitoring
      await this._stopMonitoring();

      this.emit('stopped');
      logger.info('AIAgentIntegration service stopped successfully');
    } catch (error) {
      logger.error('Failed to stop AIAgentIntegration service:', error);
      throw error;
    }
  }

  /**
   * Process AI agent request
   */
  async processRequest(request) {
    const requestId = this._generateRequestId();
    const startTime = Date.now();

    try {
      // Validate request
      this._validateRequest(request);

      // Check rate limiting
      if (!this._checkRateLimit(request)) {
        throw new Error('Rate limit exceeded');
      }

      // Add request to queue if needed
      if (this._shouldQueueRequest()) {
        return await this._queueRequest(requestId, request);
      }

      // Get available agent
      const agent = await this._getAvailableAgent();

      if (!agent) {
        throw new Error('No available agents');
      }

      // Process request with agent
      const response = await this._processWithAgent(requestId, request, agent);

      // Update statistics
      this._updateStatistics(requestId, startTime, true);

      // Cache response if enabled
      if (this.config.caching.enableResponseCaching) {
        await this._cacheResponse(request, response);
      }

      this.emit('requestProcessed', {
        requestId,
        request,
        response,
        processingTime: Date.now() - startTime,
      });

      return response;
    } catch (error) {
      logger.error(`Failed to process request ${requestId}:`, error);

      // Update statistics
      this._updateStatistics(requestId, startTime, false);

      this.emit('requestError', {
        requestId,
        request,
        error,
        processingTime: Date.now() - startTime,
      });

      throw error;
    }
  }

  /**
   * Process batch of requests
   */
  async processBatch(requests) {
    try {
      const batchId = this._generateBatchId();
      const startTime = Date.now();

      logger.info(`Processing batch ${batchId} with ${requests.length} requests`);

      // Validate batch
      this._validateBatch(requests);

      // Process requests in parallel
      const promises = requests.map((request) => this.processRequest(request));
      const results = await Promise.allSettled(promises);

      // Collect results
      const responses = [];
      const errors = [];

      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          responses.push({
            index,
            request: requests[index],
            response: result.value,
          });
        } else {
          errors.push({
            index,
            request: requests[index],
            error: result.reason,
          });
        }
      });

      const batchResult = {
        batchId,
        totalRequests: requests.length,
        successfulRequests: responses.length,
        failedRequests: errors.length,
        responses,
        errors,
        processingTime: Date.now() - startTime,
      };

      this.emit('batchProcessed', batchResult);

      return batchResult;
    } catch (error) {
      logger.error('Failed to process batch:', error);
      throw error;
    }
  }

  /**
   * Get agent pool status
   */
  getAgentPoolStatus() {
    return {
      totalAgents: this.agentPool.length,
      activeAgents: this.activeAgents.size,
      availableAgents: this.agentPool.filter((agent) => agent.isAvailable).length,
      queuedRequests: this.requestQueue.length,
      processingRequests: this.processingQueue.length,
      utilization: this.statistics.agentUtilization,
    };
  }

  /**
   * Scale agent pool
   */
  async scaleAgentPool(targetSize) {
    try {
      const currentSize = this.agentPool.length;

      if (targetSize > currentSize) {
        // Scale up
        const agentsToAdd = targetSize - currentSize;
        await this._addAgents(agentsToAdd);
        logger.info(`Scaled up agent pool by ${agentsToAdd} agents`);
      } else if (targetSize < currentSize) {
        // Scale down
        const agentsToRemove = currentSize - targetSize;
        await this._removeAgents(agentsToRemove);
        logger.info(`Scaled down agent pool by ${agentsToRemove} agents`);
      }

      this.emit('agentPoolScaled', {
        previousSize: currentSize,
        newSize: targetSize,
        change: targetSize - currentSize,
      });
    } catch (error) {
      logger.error('Failed to scale agent pool:', error);
      throw error;
    }
  }

  /**
   * Get service statistics
   */
  getStatistics() {
    return {
      ...this.statistics,
      agentPool: this.getAgentPoolStatus(),
      uptime: this.isInitialized ? Date.now() - this.initializationTime : 0,
      memoryUsage: process.memoryUsage(),
      cpuUsage: process.cpuUsage(),
    };
  }

  /**
   * Get service health status
   */
  getHealthStatus() {
    const agentPoolStatus = this.getAgentPoolStatus();
    const stats = this.getStatistics();

    return {
      status: this._calculateHealthStatus(),
      isInitialized: this.isInitialized,
      isRunning: this.isRunning,
      agentPool: agentPoolStatus,
      performance: {
        averageResponseTime: stats.averageResponseTime,
        throughput: stats.throughput,
        errorRate: stats.totalRequests > 0 ? stats.failedRequests / stats.totalRequests : 0,
        utilization: stats.agentUtilization,
      },
      resources: {
        memoryUsage: stats.memoryUsage,
        cpuUsage: stats.cpuUsage,
      },
      integrations: {
        translationService: !!this.translationService,
        audioProcessor: !!this.audioProcessor,
        rtcService: !!this.rtcService,
        qualityMonitor: !!this.qualityMonitor,
        databaseService: !!this.databaseService,
      },
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
      logger.info('AI agent integration configuration updated successfully');
    } catch (error) {
      logger.error('Failed to update AI agent integration configuration:', error);
      throw error;
    }
  }

  /**
   * Set service integrations
   */
  setTranslationService(translationService) {
    this.translationService = translationService;
    this.emit('translationServiceSet', translationService);
  }

  setAudioProcessor(audioProcessor) {
    this.audioProcessor = audioProcessor;
    this.emit('audioProcessorSet', audioProcessor);
  }

  setRTCService(rtcService) {
    this.rtcService = rtcService;
    this.emit('rtcServiceSet', rtcService);
  }

  setQualityMonitor(qualityMonitor) {
    this.qualityMonitor = qualityMonitor;
    this.emit('qualityMonitorSet', qualityMonitor);
  }

  setDatabaseService(databaseService) {
    this.databaseService = databaseService;
    this.emit('databaseServiceSet', databaseService);
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    try {
      logger.info('Cleaning up AIAgentIntegration service...');

      // Stop the service if running
      if (this.isRunning) {
        await this.stop();
      }

      // Cleanup agent pool
      await this._cleanupAgentPool();

      // Clear caches and queues
      this.cache.clear();
      this.requestQueue.length = 0;
      this.processingQueue.length = 0;
      this.activeAgents.clear();

      // Cleanup components
      await this._cleanupComponents();

      // Reset state
      this.isInitialized = false;
      this.isRunning = false;

      this.emit('cleanup');
      logger.info('AIAgentIntegration service cleaned up successfully');
    } catch (error) {
      logger.error('Failed to cleanup AIAgentIntegration service:', error);
      throw error;
    }
  }

  // Private methods

  _setupEventHandlers() {
    this.on('error', (error) => {
      logger.error('AIAgentIntegration error:', error);
    });
  }

  async _initializeComponents() {
    // Initialize load balancer
    if (this.config.integration.enableLoadBalancing) {
      this.loadBalancer = new LoadBalancer(this.config.loadBalancing);
      await this.loadBalancer.initialize();
    }

    // Initialize circuit breaker
    if (this.config.loadBalancing.enableCircuitBreaker) {
      this.circuitBreaker = new CircuitBreaker(this.config.loadBalancing);
      await this.circuitBreaker.initialize();
    }

    // Initialize auto scaler
    if (this.config.scaling.enableAutoScaling) {
      this.autoScaler = new AutoScaler(this.config.scaling);
      await this.autoScaler.initialize();
    }

    // Initialize distributed cache
    if (this.config.caching.enableDistributedCache) {
      this.distributedCache = new DistributedCache(this.config.caching);
      await this.distributedCache.initialize();
    }
  }

  async _initializeAgentPool() {
    const initialSize = this.config.processing.agentPoolSize;

    for (let i = 0; i < initialSize; i++) {
      const agent = await this._createAgent(`agent_${i}`);
      this.agentPool.push(agent);
    }

    logger.info(`Initialized agent pool with ${initialSize} agents`);
  }

  async _initializeServerInfrastructure() {
    // Initialize HTTP server
    this.httpServer = new HTTPServer(this.config.server);
    await this.httpServer.initialize();

    // Initialize WebSocket server
    this.websocketServer = new WebSocketServer(this.config.server);
    await this.websocketServer.initialize();
  }

  async _initializeServiceIntegrations() {
    // Setup integration event handlers
    if (this.translationService) {
      await this._setupTranslationIntegration();
    }

    if (this.audioProcessor) {
      await this._setupAudioProcessingIntegration();
    }

    if (this.rtcService) {
      await this._setupRTCIntegration();
    }

    if (this.qualityMonitor) {
      await this._setupQualityMonitoringIntegration();
    }
  }

  async _initializeMonitoring() {
    if (this.config.monitoring.enableMetrics) {
      this.metricsCollector = new MetricsCollector(this.config.monitoring);
      await this.metricsCollector.initialize();
    }

    if (this.config.loadBalancing.enableHealthChecks) {
      this.healthMonitor = new HealthMonitor(this.config.loadBalancing);
      await this.healthMonitor.initialize();
    }
  }

  _startBackgroundProcesses() {
    // Start request processing interval
    this.processingInterval = setInterval(() => {
      this._processRequestQueue();
    }, 1000);

    // Start metrics collection interval
    if (this.config.monitoring.enableMetrics) {
      this.metricsInterval = setInterval(() => {
        this._collectMetrics();
      }, this.config.monitoring.metricsInterval);
    }

    // Start health check interval
    if (this.config.loadBalancing.enableHealthChecks) {
      this.healthCheckInterval = setInterval(() => {
        this._performHealthChecks();
      }, this.config.loadBalancing.healthCheckInterval);
    }

    // Start scaling interval
    if (this.config.scaling.enableAutoScaling) {
      this.scalingInterval = setInterval(() => {
        this._performAutoScaling();
      }, 60000); // Check every minute
    }

    // Start cleanup interval
    this.cleanupInterval = setInterval(() => {
      this._performPeriodicCleanup();
    }, 300000); // 5 minutes
  }

  _stopBackgroundProcesses() {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }

    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = null;
    }

    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    if (this.scalingInterval) {
      clearInterval(this.scalingInterval);
      this.scalingInterval = null;
    }

    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  async _createAgent(agentId) {
    const { EchoAIAgent } = await import('./echo-ai-agent.js');

    const agent = new EchoAIAgent({
      agent: {
        ...this.config.processing,
        id: agentId,
      },
    });

    await agent.initialize();

    // Set up agent event handlers
    agent.on('conversationProcessed', (data) => {
      this.emit('agentConversationProcessed', { agentId, ...data });
    });

    agent.on('conversationError', (data) => {
      this.emit('agentConversationError', { agentId, ...data });
    });

    return {
      id: agentId,
      instance: agent,
      isAvailable: true,
      isHealthy: true,
      activeRequests: 0,
      totalRequests: 0,
      lastActivity: Date.now(),
      createdAt: Date.now(),
    };
  }

  async _getAvailableAgent() {
    // Find available agent using load balancing strategy
    if (this.loadBalancer) {
      return await this.loadBalancer.getAvailableAgent(this.agentPool);
    }

    // Fallback to simple round-robin
    const availableAgents = this.agentPool.filter((agent) => agent.isAvailable && agent.isHealthy);

    if (availableAgents.length === 0) {
      return null;
    }

    // Simple round-robin selection
    const selectedAgent = availableAgents[this.statistics.totalRequests % availableAgents.length];
    return selectedAgent;
  }

  async _processWithAgent(requestId, request, agent) {
    try {
      // Mark agent as busy
      agent.isAvailable = false;
      agent.activeRequests++;
      agent.lastActivity = Date.now();

      this.activeAgents.set(requestId, agent);

      // Process request with agent
      const response = await agent.instance.processConversation(request);

      // Update agent statistics
      agent.totalRequests++;

      return response;
    } finally {
      // Mark agent as available
      agent.isAvailable = true;
      agent.activeRequests--;

      this.activeAgents.delete(requestId);
    }
  }

  _shouldQueueRequest() {
    const availableAgents = this.agentPool.filter(
      (agent) => agent.isAvailable && agent.isHealthy
    ).length;
    const activeRequests = this.activeAgents.size;

    return availableAgents === 0 || activeRequests >= this.config.processing.maxConcurrentAgents;
  }

  async _queueRequest(requestId, request) {
    if (this.requestQueue.length >= this.config.processing.maxQueueSize) {
      throw new Error('Request queue is full');
    }

    return new Promise((resolve, reject) => {
      this.requestQueue.push({
        requestId,
        request,
        resolve,
        reject,
        queuedAt: Date.now(),
      });

      this.statistics.queuedRequests++;
    });
  }

  _processRequestQueue() {
    while (this.requestQueue.length > 0) {
      const availableAgents = this.agentPool.filter(
        (agent) => agent.isAvailable && agent.isHealthy
      ).length;

      if (
        availableAgents === 0 ||
        this.activeAgents.size >= this.config.processing.maxConcurrentAgents
      ) {
        break;
      }

      const queuedRequest = this.requestQueue.shift();
      this.statistics.queuedRequests--;

      // Process the queued request
      this.processRequest(queuedRequest.request)
        .then(queuedRequest.resolve)
        .catch(queuedRequest.reject);
    }
  }

  _validateRequest(request) {
    if (!request) {
      throw new Error('Request is required');
    }

    if (!request.message) {
      throw new Error('Request message is required');
    }

    if (!request.userId) {
      throw new Error('User ID is required');
    }
  }

  _validateBatch(requests) {
    if (!Array.isArray(requests)) {
      throw new Error('Requests must be an array');
    }

    if (requests.length === 0) {
      throw new Error('Batch cannot be empty');
    }

    if (requests.length > this.config.processing.batchSize) {
      throw new Error('Batch size exceeds maximum allowed');
    }

    requests.forEach((request, index) => {
      try {
        this._validateRequest(request);
      } catch (error) {
        throw new Error(`Invalid request at index ${index}: ${error.message}`);
      }
    });
  }

  _checkRateLimit(request) {
    // Simple rate limiting implementation
    const now = Date.now();
    const windowStart = now - 60000; // 1 minute window

    if (!this.rateLimitData) {
      this.rateLimitData = new Map();
    }

    const userId = request.userId || 'anonymous';
    const userRequests = this.rateLimitData.get(userId) || [];
    const recentRequests = userRequests.filter((timestamp) => timestamp > windowStart);

    if (recentRequests.length >= this.config.security.rateLimit) {
      return false;
    }

    recentRequests.push(now);
    this.rateLimitData.set(userId, recentRequests);

    return true;
  }

  async _cacheResponse(request, response) {
    const cacheKey = this._generateCacheKey(request);
    const cacheEntry = {
      response,
      timestamp: Date.now(),
      ttl: this.config.caching.cacheTTL,
    };

    if (this.distributedCache) {
      await this.distributedCache.set(cacheKey, cacheEntry);
    } else {
      this.cache.set(cacheKey, cacheEntry);
    }
  }

  _generateCacheKey(request) {
    const keyData = {
      message: request.message,
      userId: request.userId,
      language: request.language || 'en',
    };

    return `cache_${Buffer.from(JSON.stringify(keyData)).toString('base64')}`;
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

    // Calculate agent utilization
    const totalAgents = this.agentPool.length;
    const activeAgents = this.activeAgents.size;
    this.statistics.agentUtilization = totalAgents > 0 ? activeAgents / totalAgents : 0;

    // Calculate throughput (requests per minute)
    const now = Date.now();
    if (!this.throughputWindow) {
      this.throughputWindow = [];
    }

    this.throughputWindow.push(now);
    this.throughputWindow = this.throughputWindow.filter((timestamp) => now - timestamp < 60000);
    this.statistics.throughput = this.throughputWindow.length;
  }

  _calculateHealthStatus() {
    const stats = this.getStatistics();
    const agentPoolStatus = this.getAgentPoolStatus();

    // Calculate health score based on various factors
    let healthScore = 1.0;

    // Factor in error rate
    const errorRate = stats.totalRequests > 0 ? stats.failedRequests / stats.totalRequests : 0;
    healthScore *= 1 - errorRate;

    // Factor in response time
    const maxAcceptableResponseTime = 5000; // 5 seconds
    if (stats.averageResponseTime > maxAcceptableResponseTime) {
      healthScore *= 0.5;
    }

    // Factor in agent availability
    const agentAvailability =
      agentPoolStatus.totalAgents > 0
        ? agentPoolStatus.availableAgents / agentPoolStatus.totalAgents
        : 0;
    healthScore *= agentAvailability;

    // Determine status based on health score
    if (healthScore >= 0.8) {
      return 'healthy';
    } else if (healthScore >= 0.5) {
      return 'degraded';
    } else {
      return 'unhealthy';
    }
  }

  _generateRequestId() {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  _generateBatchId() {
    return `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async _addAgents(count) {
    const promises = [];

    for (let i = 0; i < count; i++) {
      const agentId = `agent_${this.agentPool.length + i}`;
      promises.push(this._createAgent(agentId));
    }

    const newAgents = await Promise.all(promises);
    this.agentPool.push(...newAgents);

    // Start new agents
    for (const agent of newAgents) {
      await agent.instance.start();
    }
  }

  async _removeAgents(count) {
    const agentsToRemove = [];

    // Select agents to remove (prefer idle agents)
    for (let i = 0; i < count && this.agentPool.length > 0; i++) {
      const idleAgents = this.agentPool.filter(
        (agent) => agent.isAvailable && agent.activeRequests === 0
      );

      if (idleAgents.length > 0) {
        agentsToRemove.push(idleAgents[0]);
      } else {
        // If no idle agents, remove the least active one
        const leastActiveAgent = this.agentPool.reduce((min, agent) =>
          agent.activeRequests < min.activeRequests ? agent : min
        );
        agentsToRemove.push(leastActiveAgent);
      }
    }

    // Remove selected agents
    for (const agent of agentsToRemove) {
      const index = this.agentPool.indexOf(agent);
      if (index > -1) {
        this.agentPool.splice(index, 1);
        await agent.instance.stop();
        await agent.instance.cleanup();
      }
    }
  }

  async _performAutoScaling() {
    if (!this.config.scaling.enableAutoScaling) {
      return;
    }

    const currentSize = this.agentPool.length;
    const utilization = this.statistics.agentUtilization;
    const queueLength = this.requestQueue.length;

    let targetSize = currentSize;

    // Scale up if utilization is high or queue is building up
    if (utilization > this.config.scaling.scaleUpThreshold || queueLength > 5) {
      targetSize = Math.min(currentSize + 1, this.config.scaling.maxAgents);
    }
    // Scale down if utilization is low
    else if (utilization < this.config.scaling.scaleDownThreshold && queueLength === 0) {
      targetSize = Math.max(currentSize - 1, this.config.scaling.minAgents);
    }

    if (targetSize !== currentSize) {
      await this.scaleAgentPool(targetSize);
    }
  }

  _performHealthChecks() {
    // Check health of all agents
    for (const agent of this.agentPool) {
      const isHealthy = this._checkAgentHealth(agent);

      if (agent.isHealthy !== isHealthy) {
        agent.isHealthy = isHealthy;

        this.emit('agentHealthChanged', {
          agentId: agent.id,
          isHealthy,
          previousHealth: !isHealthy,
        });
      }
    }
  }

  _checkAgentHealth(agent) {
    const now = Date.now();
    const maxIdleTime = 300000; // 5 minutes

    // Check if agent has been idle too long
    if (now - agent.lastActivity > maxIdleTime) {
      return false;
    }

    // Check if agent instance is responsive
    try {
      const status = agent.instance.getStatus();
      return status.isInitialized && status.isActive;
    } catch (error) {
      return false;
    }
  }

  _collectMetrics() {
    if (this.metricsCollector) {
      const metrics = {
        timestamp: Date.now(),
        statistics: this.getStatistics(),
        agentPool: this.getAgentPoolStatus(),
        health: this.getHealthStatus(),
      };

      this.metricsCollector.collect(metrics);
    }
  }

  _performPeriodicCleanup() {
    // Clean up expired cache entries
    const now = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
      }
    }

    // Clean up expired rate limit data
    if (this.rateLimitData) {
      const windowStart = now - 60000;

      for (const [userId, requests] of this.rateLimitData.entries()) {
        const recentRequests = requests.filter((timestamp) => timestamp > windowStart);
        if (recentRequests.length === 0) {
          this.rateLimitData.delete(userId);
        } else {
          this.rateLimitData.set(userId, recentRequests);
        }
      }
    }

    // Clean up old queued requests
    const maxQueueAge = 300000; // 5 minutes
    this.requestQueue = this.requestQueue.filter((item) => now - item.queuedAt < maxQueueAge);
  }

  _validateConfiguration(config) {
    // Basic configuration validation
    if (
      config.processing &&
      config.processing.maxConcurrentAgents &&
      config.processing.maxConcurrentAgents < 1
    ) {
      throw new Error('Invalid configuration: maxConcurrentAgents must be at least 1');
    }

    if (
      config.scaling &&
      config.scaling.minAgents &&
      config.scaling.maxAgents &&
      config.scaling.minAgents > config.scaling.maxAgents
    ) {
      throw new Error('Invalid configuration: minAgents cannot be greater than maxAgents');
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
    if (newConfig.processing) {
      // Update agent pool configuration
      for (const agent of this.agentPool) {
        agent.instance.updateConfiguration({ processing: newConfig.processing });
      }
    }

    if (newConfig.loadBalancing && this.loadBalancer) {
      this.loadBalancer.updateConfiguration(newConfig.loadBalancing);
    }

    if (newConfig.scaling && this.autoScaler) {
      this.autoScaler.updateConfiguration(newConfig.scaling);
    }
  }

  async _startHTTPServer() {
    if (this.httpServer) {
      await this.httpServer.start();
      this._setupHTTPRoutes();
    }
  }

  async _startWebSocketServer() {
    if (this.websocketServer) {
      await this.websocketServer.start();
      this._setupWebSocketHandlers();
    }
  }

  async _startAgentPool() {
    for (const agent of this.agentPool) {
      await agent.instance.start();
    }
  }

  async _stopAcceptingRequests() {
    // Stop accepting new HTTP requests
    if (this.httpServer) {
      await this.httpServer.stopAcceptingRequests();
    }

    // Stop accepting new WebSocket connections
    if (this.websocketServer) {
      await this.websocketServer.stopAcceptingConnections();
    }
  }

  async _waitForActiveRequests() {
    const maxWaitTime = 30000; // 30 seconds
    const startTime = Date.now();

    while (this.activeAgents.size > 0 && Date.now() - startTime < maxWaitTime) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    if (this.activeAgents.size > 0) {
      logger.warn(`Forcing termination of ${this.activeAgents.size} active requests`);
      this.activeAgents.clear();
    }
  }

  async _stopAgentPool() {
    for (const agent of this.agentPool) {
      await agent.instance.stop();
    }
  }

  async _stopServers() {
    if (this.httpServer) {
      await this.httpServer.stop();
    }

    if (this.websocketServer) {
      await this.websocketServer.stop();
    }
  }

  async _stopMonitoring() {
    if (this.metricsCollector) {
      await this.metricsCollector.stop();
    }

    if (this.healthMonitor) {
      await this.healthMonitor.stop();
    }
  }

  async _cleanupAgentPool() {
    for (const agent of this.agentPool) {
      await agent.instance.cleanup();
    }

    this.agentPool.length = 0;
  }

  async _cleanupComponents() {
    if (this.loadBalancer) {
      await this.loadBalancer.cleanup();
    }

    if (this.circuitBreaker) {
      await this.circuitBreaker.cleanup();
    }

    if (this.autoScaler) {
      await this.autoScaler.cleanup();
    }

    if (this.distributedCache) {
      await this.distributedCache.cleanup();
    }
  }

  _setupHTTPRoutes() {
    // Setup HTTP API routes for AI agent integration
    this.httpServer.addRoute('POST', '/api/ai/process', async (req, res) => {
      try {
        const response = await this.processRequest(req.body);
        res.json(response);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    this.httpServer.addRoute('POST', '/api/ai/batch', async (req, res) => {
      try {
        const response = await this.processBatch(req.body.requests);
        res.json(response);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    this.httpServer.addRoute('GET', '/api/ai/status', (req, res) => {
      res.json(this.getHealthStatus());
    });

    this.httpServer.addRoute('GET', '/api/ai/statistics', (req, res) => {
      res.json(this.getStatistics());
    });
  }

  _setupWebSocketHandlers() {
    // Setup WebSocket handlers for real-time AI processing
    this.websocketServer.on('connection', (socket) => {
      socket.on('ai:process', async (data) => {
        try {
          const response = await this.processRequest(data);
          socket.emit('ai:response', response);
        } catch (error) {
          socket.emit('ai:error', { error: error.message });
        }
      });

      socket.on('ai:status', () => {
        socket.emit('ai:status', this.getHealthStatus());
      });
    });
  }

  async _setupTranslationIntegration() {
    // Setup translation service integration
    this.translationService.on('translationComplete', (result) => {
      this.emit('translationComplete', result);
    });
  }

  async _setupAudioProcessingIntegration() {
    // Setup audio processing integration
    this.audioProcessor.on('audioProcessed', (result) => {
      this.emit('audioProcessed', result);
    });
  }

  async _setupRTCIntegration() {
    // Setup RTC service integration
    this.rtcService.on('connectionEstablished', (connection) => {
      this.emit('rtcConnectionEstablished', connection);
    });
  }

  async _setupQualityMonitoringIntegration() {
    // Setup quality monitoring integration
    this.qualityMonitor.on('qualityAlert', (alert) => {
      this.emit('qualityAlert', alert);
    });
  }
}

// Mock component classes for demonstration
class LoadBalancer {
  constructor(config) {
    this.config = config;
    this.currentIndex = 0;
  }

  async initialize() {
    // Initialize load balancer
  }

  async start() {
    // Start load balancer
  }

  async getAvailableAgent(agentPool) {
    const availableAgents = agentPool.filter((agent) => agent.isAvailable && agent.isHealthy);

    if (availableAgents.length === 0) {
      return null;
    }

    // Round-robin selection
    const selectedAgent = availableAgents[this.currentIndex % availableAgents.length];
    this.currentIndex++;

    return selectedAgent;
  }

  updateConfiguration(config) {
    this.config = { ...this.config, ...config };
  }

  async cleanup() {
    // Cleanup load balancer
  }
}

class CircuitBreaker {
  constructor(config) {
    this.config = config;
    this.state = 'closed'; // closed, open, half-open
    this.failures = 0;
  }

  async initialize() {
    // Initialize circuit breaker
  }

  async cleanup() {
    // Cleanup circuit breaker
  }
}

class AutoScaler {
  constructor(config) {
    this.config = config;
  }

  async initialize() {
    // Initialize auto scaler
  }

  async start() {
    // Start auto scaler
  }

  updateConfiguration(config) {
    this.config = { ...this.config, ...config };
  }

  async cleanup() {
    // Cleanup auto scaler
  }
}

class DistributedCache {
  constructor(config) {
    this.config = config;
    this.cache = new Map();
  }

  async initialize() {
    // Initialize distributed cache
  }

  async set(key, value) {
    this.cache.set(key, value);
  }

  async get(key) {
    return this.cache.get(key);
  }

  async cleanup() {
    this.cache.clear();
  }
}

class MetricsCollector {
  constructor(config) {
    this.config = config;
    this.metrics = [];
  }

  async initialize() {
    // Initialize metrics collector
  }

  collect(metrics) {
    this.metrics.push(metrics);

    // Keep only recent metrics
    const maxAge = 3600000; // 1 hour
    const now = Date.now();
    this.metrics = this.metrics.filter((metric) => now - metric.timestamp < maxAge);
  }

  async stop() {
    // Stop metrics collector
  }
}

class HealthMonitor {
  constructor(config) {
    this.config = config;
  }

  async initialize() {
    // Initialize health monitor
  }

  async start() {
    // Start health monitor
  }

  async stop() {
    // Stop health monitor
  }
}

class HTTPServer {
  constructor(config) {
    this.config = config;
    this.routes = new Map();
  }

  async initialize() {
    // Initialize HTTP server
  }

  async start() {
    // Start HTTP server
  }

  addRoute(method, path, handler) {
    this.routes.set(`${method}:${path}`, handler);
  }

  async stopAcceptingRequests() {
    // Stop accepting new requests
  }

  async stop() {
    // Stop HTTP server
  }
}

class WebSocketServer extends EventEmitter {
  constructor(config) {
    super();
    this.config = config;
  }

  async initialize() {
    // Initialize WebSocket server
  }

  async start() {
    // Start WebSocket server
  }

  async stopAcceptingConnections() {
    // Stop accepting new connections
  }

  async stop() {
    // Stop WebSocket server
  }
}

export default AIAgentIntegration;
