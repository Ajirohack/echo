import EventEmitter from 'events';
import { EchoRTCConfig } from './config.js';

/**
 * QualityMonitor - Monitors audio quality and performance for echo RTC
 * Provides real-time quality metrics, optimization recommendations, and adaptive adjustments
 */
export class QualityMonitor extends EventEmitter {
  constructor(config = null) {
    super();

    this.config = config || EchoRTCConfig.getInstance();
    this.monitoringConfig = this.config.get('performance');

    // Monitoring state
    this.isMonitoring = false;
    this.monitoringSessions = new Map();

    // Quality metrics
    this.qualityMetrics = {
      audio: {
        level: 0,
        noise: 0,
        signalToNoise: 0,
        clarity: 0,
        distortion: 0,
      },
      network: {
        latency: 0,
        jitter: 0,
        packetLoss: 0,
        bandwidth: 0,
        stability: 0,
      },
      processing: {
        cpuUsage: 0,
        memoryUsage: 0,
        processingTime: 0,
        queueLength: 0,
        throughput: 0,
      },
      translation: {
        accuracy: 0,
        speed: 0,
        confidence: 0,
        errorRate: 0,
        completionRate: 0,
      },
    };

    // Quality thresholds
    this.qualityThresholds = {
      excellent: { min: 90, color: '#4CAF50' },
      good: { min: 75, color: '#8BC34A' },
      fair: { min: 60, color: '#FFC107' },
      poor: { min: 40, color: '#FF9800' },
      critical: { min: 0, color: '#F44336' },
    };

    // Performance history
    this.performanceHistory = {
      maxEntries: this.monitoringConfig.historySize || 1000,
      entries: [],
      aggregated: {
        hourly: [],
        daily: [],
      },
    };

    // Optimization engine
    this.optimizationEngine = {
      recommendations: [],
      autoOptimize: this.monitoringConfig.autoOptimize || false,
      optimizationHistory: [],
      learningEnabled: this.monitoringConfig.learningEnabled || true,
    };

    // Alert system
    this.alertSystem = {
      alerts: [],
      thresholds: {
        latency: this.monitoringConfig.latencyThreshold || 200,
        packetLoss: this.monitoringConfig.packetLossThreshold || 5,
        cpuUsage: this.monitoringConfig.cpuThreshold || 80,
        memoryUsage: this.monitoringConfig.memoryThreshold || 85,
      },
      cooldownPeriod: this.monitoringConfig.alertCooldown || 30000,
    };

    // Statistics
    this.stats = {
      totalSessions: 0,
      activeSessions: 0,
      totalAlerts: 0,
      totalOptimizations: 0,
      averageQualityScore: 0,
      startTime: null,
    };

    this._setupEventHandlers();
  }

  /**
   * Initialize the quality monitor
   */
  async initialize() {
    try {
      console.log('Initializing QualityMonitor...');

      // Initialize monitoring components
      this._initializeMetricsCollection();
      this._initializeOptimizationEngine();
      this._initializeAlertSystem();

      // Setup performance tracking
      this._setupPerformanceTracking();

      // Initialize machine learning components
      if (this.optimizationEngine.learningEnabled) {
        this._initializeLearningEngine();
      }

      this.stats.startTime = Date.now();

      this.emit('initialized');
      console.log('QualityMonitor initialized successfully');
    } catch (error) {
      console.error('Failed to initialize quality monitor:', error);
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Start monitoring for a session
   */
  async startMonitoring(sessionConfig) {
    try {
      console.log('Starting quality monitoring...', sessionConfig);

      const sessionId = sessionConfig.sessionId || this._generateSessionId();

      // Create monitoring session
      const session = {
        id: sessionId,
        config: sessionConfig,
        startTime: Date.now(),
        status: 'active',
        metrics: this._createEmptyMetrics(),
        history: [],
        alerts: [],
        optimizations: [],
      };

      this.monitoringSessions.set(sessionId, session);

      // Start metrics collection for this session
      this._startSessionMonitoring(session);

      // Start optimization monitoring
      this._startOptimizationMonitoring(session);

      this.stats.totalSessions++;
      this.stats.activeSessions++;
      this.isMonitoring = true;

      this.emit('monitoringStarted', { sessionId, config: sessionConfig });
      console.log('Quality monitoring started for session:', sessionId);

      return sessionId;
    } catch (error) {
      console.error('Failed to start quality monitoring:', error);
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Stop monitoring for a session
   */
  async stopMonitoring(sessionId) {
    try {
      console.log('Stopping quality monitoring...', sessionId);

      const session = this.monitoringSessions.get(sessionId);
      if (!session) {
        console.warn('Monitoring session not found:', sessionId);
        return;
      }

      session.status = 'stopped';
      session.endTime = Date.now();

      // Stop session monitoring
      this._stopSessionMonitoring(session);

      // Generate session report
      const report = this._generateSessionReport(session);

      // Archive session data
      this._archiveSessionData(session);

      // Remove from active sessions
      this.monitoringSessions.delete(sessionId);
      this.stats.activeSessions--;

      // Stop monitoring if no active sessions
      if (this.monitoringSessions.size === 0) {
        this.isMonitoring = false;
      }

      this.emit('monitoringStopped', { sessionId, report });
      console.log('Quality monitoring stopped for session:', sessionId);

      return report;
    } catch (error) {
      console.error('Failed to stop quality monitoring:', error);
      this.emit('error', error);
    }
  }

  /**
   * Update quality metrics
   */
  updateMetrics(sessionId, metricsUpdate) {
    try {
      const session = this.monitoringSessions.get(sessionId);
      if (!session) {
        console.warn('Session not found for metrics update:', sessionId);
        return;
      }

      // Update session metrics
      this._updateSessionMetrics(session, metricsUpdate);

      // Update global metrics
      this._updateGlobalMetrics(metricsUpdate);

      // Check for quality issues
      this._checkQualityThresholds(session);

      // Generate optimization recommendations
      this._generateOptimizationRecommendations(session);

      // Record metrics in history
      this._recordMetricsHistory(session, metricsUpdate);

      this.emit('metricsUpdated', {
        sessionId,
        metrics: session.metrics,
        timestamp: Date.now(),
      });
    } catch (error) {
      console.error('Failed to update metrics:', error);
      this.emit('error', error);
    }
  }

  /**
   * Get quality score for a session
   */
  getQualityScore(sessionId) {
    const session = this.monitoringSessions.get(sessionId);
    if (!session) {
      return null;
    }

    return this._calculateQualityScore(session.metrics);
  }

  /**
   * Get optimization recommendations
   */
  getOptimizationRecommendations(sessionId = null) {
    if (sessionId) {
      const session = this.monitoringSessions.get(sessionId);
      return session ? session.optimizations : [];
    }

    return this.optimizationEngine.recommendations;
  }

  /**
   * Get performance statistics
   */
  getStatistics() {
    const runtime = this.stats.startTime ? Date.now() - this.stats.startTime : 0;

    return {
      ...this.stats,
      runtime,
      qualityMetrics: this.qualityMetrics,
      activeSessions: Array.from(this.monitoringSessions.values()).map((session) => ({
        id: session.id,
        status: session.status,
        qualityScore: this._calculateQualityScore(session.metrics),
        alerts: session.alerts.length,
        optimizations: session.optimizations.length,
      })),
      performanceHistory: {
        totalEntries: this.performanceHistory.entries.length,
        latestEntry: this.performanceHistory.entries[this.performanceHistory.entries.length - 1],
      },
    };
  }

  /**
   * Get performance history
   */
  getPerformanceHistory(timeRange = '1h') {
    const now = Date.now();
    const timeRanges = {
      '5m': 5 * 60 * 1000,
      '15m': 15 * 60 * 1000,
      '1h': 60 * 60 * 1000,
      '6h': 6 * 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
    };

    const rangeMs = timeRanges[timeRange] || timeRanges['1h'];
    const cutoffTime = now - rangeMs;

    return this.performanceHistory.entries.filter((entry) => entry.timestamp >= cutoffTime);
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
   * Initialize metrics collection
   */
  _initializeMetricsCollection() {
    this.metricsCollector = {
      interval: this.monitoringConfig.metricsInterval || 1000,
      collectors: {
        audio: this._createAudioMetricsCollector(),
        network: this._createNetworkMetricsCollector(),
        processing: this._createProcessingMetricsCollector(),
        translation: this._createTranslationMetricsCollector(),
      },
    };
  }

  /**
   * Initialize optimization engine
   */
  _initializeOptimizationEngine() {
    this.optimizationEngine.rules = [
      {
        name: 'High Latency Optimization',
        condition: (metrics) => metrics.network.latency > 150,
        recommendation: 'Consider reducing buffer size or switching to lower quality',
        action: 'reduceLatency',
        priority: 'high',
      },
      {
        name: 'Packet Loss Mitigation',
        condition: (metrics) => metrics.network.packetLoss > 3,
        recommendation: 'Enable error correction or reduce bitrate',
        action: 'mitigatePacketLoss',
        priority: 'high',
      },
      {
        name: 'CPU Usage Optimization',
        condition: (metrics) => metrics.processing.cpuUsage > 75,
        recommendation: 'Reduce processing complexity or enable hardware acceleration',
        action: 'optimizeCPU',
        priority: 'medium',
      },
      {
        name: 'Audio Quality Enhancement',
        condition: (metrics) => metrics.audio.signalToNoise < 10,
        recommendation: 'Enable noise reduction or adjust microphone settings',
        action: 'enhanceAudio',
        priority: 'medium',
      },
    ];
  }

  /**
   * Initialize alert system
   */
  _initializeAlertSystem() {
    this.alertSystem.lastAlerts = new Map();

    this.alertSystem.checkThresholds = (metrics) => {
      const alerts = [];

      // Check latency
      if (metrics.network.latency > this.alertSystem.thresholds.latency) {
        alerts.push({
          type: 'latency',
          severity: 'warning',
          message: `High latency detected: ${metrics.network.latency}ms`,
          value: metrics.network.latency,
          threshold: this.alertSystem.thresholds.latency,
        });
      }

      // Check packet loss
      if (metrics.network.packetLoss > this.alertSystem.thresholds.packetLoss) {
        alerts.push({
          type: 'packetLoss',
          severity: 'error',
          message: `High packet loss: ${metrics.network.packetLoss}%`,
          value: metrics.network.packetLoss,
          threshold: this.alertSystem.thresholds.packetLoss,
        });
      }

      // Check CPU usage
      if (metrics.processing.cpuUsage > this.alertSystem.thresholds.cpuUsage) {
        alerts.push({
          type: 'cpu',
          severity: 'warning',
          message: `High CPU usage: ${metrics.processing.cpuUsage}%`,
          value: metrics.processing.cpuUsage,
          threshold: this.alertSystem.thresholds.cpuUsage,
        });
      }

      return alerts;
    };
  }

  /**
   * Setup performance tracking
   */
  _setupPerformanceTracking() {
    this.performanceTracker = setInterval(() => {
      this._collectGlobalMetrics();
      this._updatePerformanceHistory();
    }, this.metricsCollector.interval);
  }

  /**
   * Initialize learning engine
   */
  _initializeLearningEngine() {
    this.learningEngine = {
      patterns: new Map(),
      predictions: new Map(),

      learnFromSession: (session) => {
        // Simple pattern recognition for demo
        const pattern = this._extractPattern(session);
        const patternKey = this._generatePatternKey(pattern);

        if (!this.learningEngine.patterns.has(patternKey)) {
          this.learningEngine.patterns.set(patternKey, []);
        }

        this.learningEngine.patterns.get(patternKey).push({
          session: session.id,
          outcome: this._calculateSessionOutcome(session),
          timestamp: Date.now(),
        });
      },

      predictOptimization: (currentMetrics) => {
        // Simple prediction based on historical patterns
        const pattern = this._extractPattern({ metrics: currentMetrics });
        const patternKey = this._generatePatternKey(pattern);

        const historicalData = this.learningEngine.patterns.get(patternKey);
        if (historicalData && historicalData.length > 0) {
          const avgOutcome =
            historicalData.reduce((sum, data) => sum + data.outcome, 0) / historicalData.length;
          return {
            predictedQuality: avgOutcome,
            confidence: Math.min(historicalData.length / 10, 1),
            recommendations: this._generatePredictiveRecommendations(avgOutcome),
          };
        }

        return null;
      },
    };
  }

  /**
   * Start session monitoring
   */
  _startSessionMonitoring(session) {
    session.monitoringInterval = setInterval(() => {
      this._collectSessionMetrics(session);
    }, this.metricsCollector.interval);
  }

  /**
   * Stop session monitoring
   */
  _stopSessionMonitoring(session) {
    if (session.monitoringInterval) {
      clearInterval(session.monitoringInterval);
      session.monitoringInterval = null;
    }
  }

  /**
   * Start optimization monitoring
   */
  _startOptimizationMonitoring(session) {
    session.optimizationInterval = setInterval(() => {
      this._checkOptimizationOpportunities(session);
    }, this.monitoringConfig.optimizationCheckInterval || 5000);
  }

  /**
   * Create empty metrics structure
   */
  _createEmptyMetrics() {
    return {
      audio: { level: 0, noise: 0, signalToNoise: 0, clarity: 0, distortion: 0 },
      network: { latency: 0, jitter: 0, packetLoss: 0, bandwidth: 0, stability: 0 },
      processing: { cpuUsage: 0, memoryUsage: 0, processingTime: 0, queueLength: 0, throughput: 0 },
      translation: { accuracy: 0, speed: 0, confidence: 0, errorRate: 0, completionRate: 0 },
    };
  }

  /**
   * Update session metrics
   */
  _updateSessionMetrics(session, metricsUpdate) {
    // Deep merge metrics update
    Object.keys(metricsUpdate).forEach((category) => {
      if (session.metrics[category]) {
        Object.assign(session.metrics[category], metricsUpdate[category]);
      }
    });

    session.lastUpdated = Date.now();
  }

  /**
   * Update global metrics
   */
  _updateGlobalMetrics(metricsUpdate) {
    // Update global metrics with weighted average
    const weight = 0.1; // Smoothing factor

    Object.keys(metricsUpdate).forEach((category) => {
      if (this.qualityMetrics[category]) {
        Object.keys(metricsUpdate[category]).forEach((metric) => {
          const currentValue = this.qualityMetrics[category][metric];
          const newValue = metricsUpdate[category][metric];
          this.qualityMetrics[category][metric] = currentValue * (1 - weight) + newValue * weight;
        });
      }
    });
  }

  /**
   * Check quality thresholds
   */
  _checkQualityThresholds(session) {
    const alerts = this.alertSystem.checkThresholds(session.metrics);

    alerts.forEach((alert) => {
      const alertKey = `${session.id}_${alert.type}`;
      const lastAlert = this.alertSystem.lastAlerts.get(alertKey);

      // Check cooldown period
      if (!lastAlert || Date.now() - lastAlert > this.alertSystem.cooldownPeriod) {
        this._triggerAlert(session, alert);
        this.alertSystem.lastAlerts.set(alertKey, Date.now());
      }
    });
  }

  /**
   * Generate optimization recommendations
   */
  _generateOptimizationRecommendations(session) {
    const recommendations = [];

    this.optimizationEngine.rules.forEach((rule) => {
      if (rule.condition(session.metrics)) {
        const recommendation = {
          ...rule,
          sessionId: session.id,
          timestamp: Date.now(),
          metrics: { ...session.metrics },
        };

        recommendations.push(recommendation);
        session.optimizations.push(recommendation);
      }
    });

    if (recommendations.length > 0) {
      this.emit('optimizationRecommendations', {
        sessionId: session.id,
        recommendations,
      });
    }
  }

  /**
   * Record metrics history
   */
  _recordMetricsHistory(session, metricsUpdate) {
    const historyEntry = {
      sessionId: session.id,
      timestamp: Date.now(),
      metrics: { ...session.metrics },
      qualityScore: this._calculateQualityScore(session.metrics),
    };

    // Add to session history
    session.history.push(historyEntry);

    // Add to global history
    this.performanceHistory.entries.push(historyEntry);

    // Maintain history size limit
    if (this.performanceHistory.entries.length > this.performanceHistory.maxEntries) {
      this.performanceHistory.entries.shift();
    }
  }

  /**
   * Calculate quality score
   */
  _calculateQualityScore(metrics) {
    const weights = {
      audio: 0.3,
      network: 0.3,
      processing: 0.2,
      translation: 0.2,
    };

    const audioScore = this._calculateAudioScore(metrics.audio);
    const networkScore = this._calculateNetworkScore(metrics.network);
    const processingScore = this._calculateProcessingScore(metrics.processing);
    const translationScore = this._calculateTranslationScore(metrics.translation);

    return Math.round(
      audioScore * weights.audio +
        networkScore * weights.network +
        processingScore * weights.processing +
        translationScore * weights.translation
    );
  }

  /**
   * Calculate audio score
   */
  _calculateAudioScore(audioMetrics) {
    const snrScore = Math.min(audioMetrics.signalToNoise * 5, 100);
    const clarityScore = audioMetrics.clarity;
    const distortionScore = Math.max(100 - audioMetrics.distortion * 10, 0);

    return (snrScore + clarityScore + distortionScore) / 3;
  }

  /**
   * Calculate network score
   */
  _calculateNetworkScore(networkMetrics) {
    const latencyScore = Math.max(100 - networkMetrics.latency / 5, 0);
    const jitterScore = Math.max(100 - networkMetrics.jitter * 2, 0);
    const packetLossScore = Math.max(100 - networkMetrics.packetLoss * 10, 0);
    const stabilityScore = networkMetrics.stability;

    return (latencyScore + jitterScore + packetLossScore + stabilityScore) / 4;
  }

  /**
   * Calculate processing score
   */
  _calculateProcessingScore(processingMetrics) {
    const cpuScore = Math.max(100 - processingMetrics.cpuUsage, 0);
    const memoryScore = Math.max(100 - processingMetrics.memoryUsage, 0);
    const throughputScore = Math.min(processingMetrics.throughput / 10, 100);

    return (cpuScore + memoryScore + throughputScore) / 3;
  }

  /**
   * Calculate translation score
   */
  _calculateTranslationScore(translationMetrics) {
    const accuracyScore = translationMetrics.accuracy;
    const speedScore = Math.min(translationMetrics.speed * 2, 100);
    const confidenceScore = translationMetrics.confidence;
    const errorScore = Math.max(100 - translationMetrics.errorRate * 10, 0);

    return (accuracyScore + speedScore + confidenceScore + errorScore) / 4;
  }

  /**
   * Trigger alert
   */
  _triggerAlert(session, alert) {
    const alertWithContext = {
      ...alert,
      sessionId: session.id,
      timestamp: Date.now(),
    };

    session.alerts.push(alertWithContext);
    this.alertSystem.alerts.push(alertWithContext);
    this.stats.totalAlerts++;

    this.emit('alert', alertWithContext);
  }

  /**
   * Collect global metrics
   */
  _collectGlobalMetrics() {
    // Simulate metrics collection
    const mockMetrics = {
      audio: {
        level: 50 + Math.random() * 30,
        noise: Math.random() * 20,
        signalToNoise: 15 + Math.random() * 10,
        clarity: 70 + Math.random() * 25,
        distortion: Math.random() * 5,
      },
      network: {
        latency: 50 + Math.random() * 100,
        jitter: Math.random() * 20,
        packetLoss: Math.random() * 3,
        bandwidth: 1000 + Math.random() * 500,
        stability: 80 + Math.random() * 20,
      },
      processing: {
        cpuUsage: 30 + Math.random() * 40,
        memoryUsage: 40 + Math.random() * 30,
        processingTime: 10 + Math.random() * 20,
        queueLength: Math.floor(Math.random() * 10),
        throughput: 50 + Math.random() * 30,
      },
      translation: {
        accuracy: 80 + Math.random() * 15,
        speed: 40 + Math.random() * 30,
        confidence: 75 + Math.random() * 20,
        errorRate: Math.random() * 5,
        completionRate: 90 + Math.random() * 10,
      },
    };

    this._updateGlobalMetrics(mockMetrics);
  }

  /**
   * Create audio metrics collector
   */
  _createAudioMetricsCollector() {
    return {
      collect: () => {
        // Mock audio metrics collection
        return {
          level: 50 + Math.random() * 30,
          noise: Math.random() * 20,
          signalToNoise: 15 + Math.random() * 10,
          clarity: 70 + Math.random() * 25,
          distortion: Math.random() * 5,
        };
      },
    };
  }

  /**
   * Create network metrics collector
   */
  _createNetworkMetricsCollector() {
    return {
      collect: () => {
        // Mock network metrics collection
        return {
          latency: 50 + Math.random() * 100,
          jitter: Math.random() * 20,
          packetLoss: Math.random() * 3,
          bandwidth: 1000 + Math.random() * 500,
          stability: 80 + Math.random() * 20,
        };
      },
    };
  }

  /**
   * Create processing metrics collector
   */
  _createProcessingMetricsCollector() {
    return {
      collect: () => {
        // Mock processing metrics collection
        return {
          cpuUsage: 30 + Math.random() * 40,
          memoryUsage: 40 + Math.random() * 30,
          processingTime: 10 + Math.random() * 20,
          queueLength: Math.floor(Math.random() * 10),
          throughput: 50 + Math.random() * 30,
        };
      },
    };
  }

  /**
   * Create translation metrics collector
   */
  _createTranslationMetricsCollector() {
    return {
      collect: () => {
        // Mock translation metrics collection
        return {
          accuracy: 80 + Math.random() * 15,
          speed: 40 + Math.random() * 30,
          confidence: 75 + Math.random() * 20,
          errorRate: Math.random() * 5,
          completionRate: 90 + Math.random() * 10,
        };
      },
    };
  }

  /**
   * Generate session ID
   */
  _generateSessionId() {
    return `monitor_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    try {
      console.log('Cleaning up QualityMonitor...');

      // Stop all monitoring sessions
      const sessionIds = Array.from(this.monitoringSessions.keys());
      for (const id of sessionIds) {
        await this.stopMonitoring(id);
      }

      // Stop performance tracking
      if (this.performanceTracker) {
        clearInterval(this.performanceTracker);
        this.performanceTracker = null;
      }

      // Clear all data
      this.monitoringSessions.clear();
      this.performanceHistory.entries = [];
      this.alertSystem.alerts = [];
      this.optimizationEngine.recommendations = [];

      this.isMonitoring = false;

      this.emit('cleanup');
      console.log('QualityMonitor cleanup completed');
    } catch (error) {
      console.error('Error during cleanup:', error);
      this.emit('error', error);
    }
  }
}

export default QualityMonitor;
