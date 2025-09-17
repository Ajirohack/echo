import { expect } from 'chai';
import sinon from 'sinon';
import { EventEmitter } from 'events';
import { QualityMonitor } from '../quality-monitor.js';
import { testConfig, TestUtils } from './test-config.js';

describe('QualityMonitor Integration Tests', () => {
  let qualityMonitor;
  let mockConfig;
  let mockAudioProcessor;
  let mockWebRTCService;
  let mockTranslationService;
  let sandbox;

  beforeEach(async () => {
    sandbox = sinon.createSandbox();

    // Create test configuration
    mockConfig = TestUtils.createTestConfig({
      quality: {
        audioThresholds: {
          signalToNoise: 15,
          clarity: 0.8,
          volume: 0.1,
        },
        networkThresholds: {
          latency: 200,
          bandwidth: 500,
          packetLoss: 0.05,
          jitter: 30,
        },
        translationThresholds: {
          confidence: 0.7,
          processingTime: 3000,
          accuracy: 0.8,
        },
        monitoringInterval: 1000,
        alertThreshold: 0.6,
        enablePredictiveAnalysis: true,
      },
      optimization: {
        enableAutoOptimization: true,
        optimizationInterval: 5000,
        maxOptimizationAttempts: 3,
        enableLearning: true,
      },
    });

    // Mock audio processor
    mockAudioProcessor = new EventEmitter();
    Object.assign(mockAudioProcessor, {
      getQualityMetrics: sandbox.stub().returns({
        signalToNoiseRatio: 18,
        clarity: 0.85,
        volume: 0.7,
        frequency: 440,
        distortion: 0.02,
        speechProbability: 0.9,
      }),
      getProcessingStats: sandbox.stub().returns({
        averageProcessingTime: 50,
        cpuUsage: 0.3,
        memoryUsage: 128,
        errorRate: 0.01,
      }),
      on: sandbox.stub(),
      emit: sandbox.stub(),
    });

    // Mock WebRTC service
    mockWebRTCService = new EventEmitter();
    Object.assign(mockWebRTCService, {
      getConnectionStats: sandbox.stub().resolves({
        latency: 80,
        bandwidth: 1200,
        packetLoss: 0.02,
        jitter: 10,
        connectionQuality: 0.9,
      }),
      getNetworkMetrics: sandbox.stub().returns({
        throughput: 950,
        stability: 0.95,
        reliability: 0.98,
      }),
      on: sandbox.stub(),
      emit: sandbox.stub(),
    });

    // Mock translation service
    mockTranslationService = new EventEmitter();
    Object.assign(mockTranslationService, {
      getQualityMetrics: sandbox.stub().returns({
        averageConfidence: 0.88,
        averageProcessingTime: 180,
        accuracy: 0.92,
        errorRate: 0.03,
        languageDetectionAccuracy: 0.96,
      }),
      getPerformanceStats: sandbox.stub().returns({
        totalTranslations: 150,
        successRate: 0.97,
        averageLatency: 200,
      }),
      on: sandbox.stub(),
      emit: sandbox.stub(),
    });

    // Create quality monitor instance
    qualityMonitor = new QualityMonitor(mockConfig);
  });

  afterEach(async () => {
    if (qualityMonitor) {
      await qualityMonitor.cleanup();
    }
    sandbox.restore();
  });

  describe('Initialization', () => {
    it('should initialize quality monitor successfully', async () => {
      const initPromise = qualityMonitor.initialize();

      await expect(initPromise).to.be.fulfilled;
      expect(qualityMonitor.isInitialized).to.be.true;
      expect(qualityMonitor.getStatus().status).to.equal('ready');
    });

    it('should setup monitoring components', async () => {
      await qualityMonitor.initialize();

      const status = qualityMonitor.getStatus();
      expect(status.audioMonitor).to.exist;
      expect(status.networkMonitor).to.exist;
      expect(status.translationMonitor).to.exist;
      expect(status.alertSystem).to.exist;
      expect(status.optimizationEngine).to.exist;
    });

    it('should configure monitoring thresholds', async () => {
      await qualityMonitor.initialize();

      const config = qualityMonitor.getConfiguration();
      expect(config.audioThresholds.signalToNoise).to.equal(15);
      expect(config.networkThresholds.latency).to.equal(200);
      expect(config.translationThresholds.confidence).to.equal(0.7);
      expect(config.monitoringInterval).to.equal(1000);
    });

    it('should handle initialization errors gracefully', async () => {
      // Mock initialization failure
      const originalInitializeMonitors = qualityMonitor._initializeMonitors;
      qualityMonitor._initializeMonitors = sandbox
        .stub()
        .throws(new Error('Monitor initialization failed'));

      await expect(qualityMonitor.initialize()).to.be.rejectedWith('Monitor initialization failed');
      expect(qualityMonitor.isInitialized).to.be.false;

      // Restore original method
      qualityMonitor._initializeMonitors = originalInitializeMonitors;
    });
  });

  describe('Monitoring Operations', () => {
    beforeEach(async () => {
      await qualityMonitor.initialize();
      qualityMonitor.setAudioProcessor(mockAudioProcessor);
      qualityMonitor.setWebRTCService(mockWebRTCService);
      qualityMonitor.setTranslationService(mockTranslationService);
    });

    it('should start monitoring successfully', async () => {
      const monitoringConfig = {
        enableAudioMonitoring: true,
        enableNetworkMonitoring: true,
        enableTranslationMonitoring: true,
        monitoringInterval: 500,
      };

      await qualityMonitor.startMonitoring(monitoringConfig);

      expect(qualityMonitor.isMonitoring).to.be.true;
      expect(qualityMonitor.getStatus().status).to.equal('monitoring');
    });

    it('should collect quality metrics from all components', async () => {
      await qualityMonitor.startMonitoring({ enableAllMonitoring: true });

      // Wait for monitoring cycle
      await TestUtils.wait(1200);

      const metrics = qualityMonitor.getCurrentMetrics();
      expect(metrics.audio).to.exist;
      expect(metrics.network).to.exist;
      expect(metrics.translation).to.exist;
      expect(metrics.overall).to.exist;

      expect(metrics.audio.signalToNoiseRatio).to.equal(18);
      expect(metrics.network.latency).to.equal(80);
      expect(metrics.translation.averageConfidence).to.equal(0.88);
    });

    it('should calculate overall quality score', async () => {
      await qualityMonitor.startMonitoring({ enableQualityScoring: true });

      // Wait for monitoring cycle
      await TestUtils.wait(1200);

      const qualityScore = qualityMonitor.getOverallQualityScore();
      expect(qualityScore).to.be.greaterThan(0);
      expect(qualityScore).to.be.lessThanOrEqual(1);

      const scoreBreakdown = qualityMonitor.getQualityScoreBreakdown();
      expect(scoreBreakdown.audioScore).to.be.greaterThan(0);
      expect(scoreBreakdown.networkScore).to.be.greaterThan(0);
      expect(scoreBreakdown.translationScore).to.be.greaterThan(0);
    });

    it('should stop monitoring cleanly', async () => {
      await qualityMonitor.startMonitoring({ enableAllMonitoring: true });
      expect(qualityMonitor.isMonitoring).to.be.true;

      await qualityMonitor.stopMonitoring();

      expect(qualityMonitor.isMonitoring).to.be.false;
      expect(qualityMonitor.getStatus().status).to.equal('ready');
    });
  });

  describe('Audio Quality Monitoring', () => {
    beforeEach(async () => {
      await qualityMonitor.initialize();
      qualityMonitor.setAudioProcessor(mockAudioProcessor);
      await qualityMonitor.startMonitoring({ enableAudioMonitoring: true });
    });

    it('should monitor audio quality metrics', async () => {
      // Wait for monitoring cycle
      await TestUtils.wait(1200);

      const audioMetrics = qualityMonitor.getAudioMetrics();
      expect(audioMetrics.signalToNoiseRatio).to.equal(18);
      expect(audioMetrics.clarity).to.equal(0.85);
      expect(audioMetrics.volume).to.equal(0.7);
      expect(audioMetrics.distortion).to.equal(0.02);
      expect(audioMetrics.speechProbability).to.equal(0.9);
    });

    it('should detect audio quality degradation', async () => {
      let audioAlertTriggered = false;
      qualityMonitor.on('audioQualityAlert', () => {
        audioAlertTriggered = true;
      });

      // Simulate poor audio quality
      mockAudioProcessor.getQualityMetrics.returns({
        signalToNoiseRatio: 8, // Below threshold
        clarity: 0.4, // Below threshold
        volume: 0.05, // Below threshold
        distortion: 0.15,
        speechProbability: 0.3,
      });

      // Wait for monitoring cycle
      await TestUtils.wait(1200);

      expect(audioAlertTriggered).to.be.true;

      const audioAlerts = qualityMonitor.getAudioAlerts();
      expect(audioAlerts.length).to.be.greaterThan(0);
      expect(audioAlerts[0].type).to.equal('audioQualityDegradation');
    });

    it('should track audio quality trends', async () => {
      // Simulate changing audio quality over time
      const qualityValues = [0.9, 0.85, 0.8, 0.75, 0.7, 0.65];

      for (let i = 0; i < qualityValues.length; i++) {
        mockAudioProcessor.getQualityMetrics.returns({
          signalToNoiseRatio: 15 + qualityValues[i] * 10,
          clarity: qualityValues[i],
          volume: 0.7,
          distortion: 0.02,
          speechProbability: qualityValues[i],
        });

        await TestUtils.wait(1200);
      }

      const trends = qualityMonitor.getAudioQualityTrends();
      expect(trends.clarityTrend).to.equal('declining');
      expect(trends.overallTrend).to.equal('declining');
      expect(trends.dataPoints).to.have.length.greaterThan(3);
    });

    it('should provide audio quality recommendations', async () => {
      // Simulate suboptimal audio conditions
      mockAudioProcessor.getQualityMetrics.returns({
        signalToNoiseRatio: 12, // Slightly below optimal
        clarity: 0.75,
        volume: 0.3,
        distortion: 0.08,
        speechProbability: 0.7,
      });

      await TestUtils.wait(1200);

      const recommendations = qualityMonitor.getAudioRecommendations();
      expect(recommendations).to.be.an('array');
      expect(recommendations.length).to.be.greaterThan(0);

      const snrRecommendation = recommendations.find((r) => r.metric === 'signalToNoiseRatio');
      expect(snrRecommendation).to.exist;
      expect(snrRecommendation.suggestion).to.include('noise');
    });
  });

  describe('Network Quality Monitoring', () => {
    beforeEach(async () => {
      await qualityMonitor.initialize();
      qualityMonitor.setWebRTCService(mockWebRTCService);
      await qualityMonitor.startMonitoring({ enableNetworkMonitoring: true });
    });

    it('should monitor network quality metrics', async () => {
      // Wait for monitoring cycle
      await TestUtils.wait(1200);

      const networkMetrics = qualityMonitor.getNetworkMetrics();
      expect(networkMetrics.latency).to.equal(80);
      expect(networkMetrics.bandwidth).to.equal(1200);
      expect(networkMetrics.packetLoss).to.equal(0.02);
      expect(networkMetrics.jitter).to.equal(10);
      expect(networkMetrics.connectionQuality).to.equal(0.9);
    });

    it('should detect network quality issues', async () => {
      let networkAlertTriggered = false;
      qualityMonitor.on('networkQualityAlert', () => {
        networkAlertTriggered = true;
      });

      // Simulate poor network conditions
      mockWebRTCService.getConnectionStats.resolves({
        latency: 350, // Above threshold
        bandwidth: 200, // Below threshold
        packetLoss: 0.08, // Above threshold
        jitter: 50, // Above threshold
        connectionQuality: 0.3,
      });

      // Wait for monitoring cycle
      await TestUtils.wait(1200);

      expect(networkAlertTriggered).to.be.true;

      const networkAlerts = qualityMonitor.getNetworkAlerts();
      expect(networkAlerts.length).to.be.greaterThan(0);
      expect(networkAlerts[0].type).to.equal('networkQualityDegradation');
    });

    it('should monitor network stability', async () => {
      // Simulate fluctuating network conditions
      const networkConditions = [
        { latency: 50, bandwidth: 1000, packetLoss: 0.01 },
        { latency: 150, bandwidth: 800, packetLoss: 0.03 },
        { latency: 300, bandwidth: 400, packetLoss: 0.07 },
        { latency: 100, bandwidth: 900, packetLoss: 0.02 },
        { latency: 80, bandwidth: 1100, packetLoss: 0.01 },
      ];

      for (const condition of networkConditions) {
        mockWebRTCService.getConnectionStats.resolves({
          ...condition,
          jitter: 10,
          connectionQuality: 0.8,
        });

        await TestUtils.wait(1200);
      }

      const stabilityMetrics = qualityMonitor.getNetworkStabilityMetrics();
      expect(stabilityMetrics.latencyVariance).to.be.greaterThan(0);
      expect(stabilityMetrics.bandwidthVariance).to.be.greaterThan(0);
      expect(stabilityMetrics.stabilityScore).to.be.lessThan(1);
    });

    it('should predict network quality issues', async () => {
      // Enable predictive analysis
      qualityMonitor.updateConfiguration({
        quality: { enablePredictiveAnalysis: true },
      });

      // Simulate degrading network trend
      const degradingConditions = [
        { latency: 50, bandwidth: 1000, packetLoss: 0.01 },
        { latency: 80, bandwidth: 900, packetLoss: 0.02 },
        { latency: 120, bandwidth: 800, packetLoss: 0.03 },
        { latency: 160, bandwidth: 700, packetLoss: 0.04 },
      ];

      for (const condition of degradingConditions) {
        mockWebRTCService.getConnectionStats.resolves({
          ...condition,
          jitter: 15,
          connectionQuality: 0.7,
        });

        await TestUtils.wait(1200);
      }

      const predictions = qualityMonitor.getNetworkPredictions();
      expect(predictions.latencyPrediction).to.exist;
      expect(predictions.bandwidthPrediction).to.exist;
      expect(predictions.qualityTrend).to.equal('declining');
    });
  });

  describe('Translation Quality Monitoring', () => {
    beforeEach(async () => {
      await qualityMonitor.initialize();
      qualityMonitor.setTranslationService(mockTranslationService);
      await qualityMonitor.startMonitoring({ enableTranslationMonitoring: true });
    });

    it('should monitor translation quality metrics', async () => {
      // Wait for monitoring cycle
      await TestUtils.wait(1200);

      const translationMetrics = qualityMonitor.getTranslationMetrics();
      expect(translationMetrics.averageConfidence).to.equal(0.88);
      expect(translationMetrics.averageProcessingTime).to.equal(180);
      expect(translationMetrics.accuracy).to.equal(0.92);
      expect(translationMetrics.errorRate).to.equal(0.03);
    });

    it('should detect translation quality issues', async () => {
      let translationAlertTriggered = false;
      qualityMonitor.on('translationQualityAlert', () => {
        translationAlertTriggered = true;
      });

      // Simulate poor translation quality
      mockTranslationService.getQualityMetrics.returns({
        averageConfidence: 0.5, // Below threshold
        averageProcessingTime: 4000, // Above threshold
        accuracy: 0.6, // Below threshold
        errorRate: 0.15,
        languageDetectionAccuracy: 0.7,
      });

      // Wait for monitoring cycle
      await TestUtils.wait(1200);

      expect(translationAlertTriggered).to.be.true;

      const translationAlerts = qualityMonitor.getTranslationAlerts();
      expect(translationAlerts.length).to.be.greaterThan(0);
      expect(translationAlerts[0].type).to.equal('translationQualityDegradation');
    });

    it('should monitor translation performance trends', async () => {
      // Simulate changing translation performance
      const performanceValues = [
        { confidence: 0.9, processingTime: 150, accuracy: 0.95 },
        { confidence: 0.85, processingTime: 180, accuracy: 0.9 },
        { confidence: 0.8, processingTime: 220, accuracy: 0.85 },
        { confidence: 0.75, processingTime: 280, accuracy: 0.8 },
      ];

      for (const values of performanceValues) {
        mockTranslationService.getQualityMetrics.returns({
          averageConfidence: values.confidence,
          averageProcessingTime: values.processingTime,
          accuracy: values.accuracy,
          errorRate: 0.03,
          languageDetectionAccuracy: 0.9,
        });

        await TestUtils.wait(1200);
      }

      const trends = qualityMonitor.getTranslationQualityTrends();
      expect(trends.confidenceTrend).to.equal('declining');
      expect(trends.processingTimeTrend).to.equal('increasing');
      expect(trends.accuracyTrend).to.equal('declining');
    });

    it('should provide translation optimization suggestions', async () => {
      // Simulate suboptimal translation performance
      mockTranslationService.getQualityMetrics.returns({
        averageConfidence: 0.72,
        averageProcessingTime: 2500,
        accuracy: 0.78,
        errorRate: 0.08,
        languageDetectionAccuracy: 0.85,
      });

      await TestUtils.wait(1200);

      const suggestions = qualityMonitor.getTranslationOptimizationSuggestions();
      expect(suggestions).to.be.an('array');
      expect(suggestions.length).to.be.greaterThan(0);

      const confidenceSuggestion = suggestions.find((s) => s.metric === 'confidence');
      expect(confidenceSuggestion).to.exist;
      expect(confidenceSuggestion.suggestion).to.include('confidence');
    });
  });

  describe('Alert System', () => {
    beforeEach(async () => {
      await qualityMonitor.initialize();
      qualityMonitor.setAudioProcessor(mockAudioProcessor);
      qualityMonitor.setWebRTCService(mockWebRTCService);
      qualityMonitor.setTranslationService(mockTranslationService);
      await qualityMonitor.startMonitoring({ enableAlerts: true });
    });

    it('should trigger alerts for quality degradation', async () => {
      const alerts = [];
      qualityMonitor.on('qualityAlert', (alert) => {
        alerts.push(alert);
      });

      // Simulate multiple quality issues
      mockAudioProcessor.getQualityMetrics.returns({
        signalToNoiseRatio: 8, // Poor
        clarity: 0.4, // Poor
        volume: 0.7,
        distortion: 0.02,
        speechProbability: 0.9,
      });

      mockWebRTCService.getConnectionStats.resolves({
        latency: 400, // Poor
        bandwidth: 150, // Poor
        packetLoss: 0.1, // Poor
        jitter: 60,
        connectionQuality: 0.3,
      });

      // Wait for monitoring cycle
      await TestUtils.wait(1200);

      expect(alerts.length).to.be.greaterThan(0);

      const audioAlert = alerts.find((a) => a.component === 'audio');
      const networkAlert = alerts.find((a) => a.component === 'network');

      expect(audioAlert).to.exist;
      expect(networkAlert).to.exist;
    });

    it('should categorize alerts by severity', async () => {
      const criticalAlerts = [];
      const warningAlerts = [];

      qualityMonitor.on('criticalAlert', (alert) => {
        criticalAlerts.push(alert);
      });

      qualityMonitor.on('warningAlert', (alert) => {
        warningAlerts.push(alert);
      });

      // Simulate critical audio issue
      mockAudioProcessor.getQualityMetrics.returns({
        signalToNoiseRatio: 3, // Critical
        clarity: 0.2, // Critical
        volume: 0.01, // Critical
        distortion: 0.3,
        speechProbability: 0.1,
      });

      // Simulate warning network issue
      mockWebRTCService.getConnectionStats.resolves({
        latency: 250, // Warning level
        bandwidth: 400,
        packetLoss: 0.06,
        jitter: 35,
        connectionQuality: 0.6,
      });

      // Wait for monitoring cycle
      await TestUtils.wait(1200);

      expect(criticalAlerts.length).to.be.greaterThan(0);
      expect(warningAlerts.length).to.be.greaterThan(0);
    });

    it('should provide alert history and statistics', async () => {
      // Trigger some alerts
      mockAudioProcessor.getQualityMetrics.returns({
        signalToNoiseRatio: 8,
        clarity: 0.4,
        volume: 0.7,
        distortion: 0.02,
        speechProbability: 0.9,
      });

      await TestUtils.wait(1200);

      const alertHistory = qualityMonitor.getAlertHistory();
      expect(alertHistory).to.be.an('array');
      expect(alertHistory.length).to.be.greaterThan(0);

      const alertStats = qualityMonitor.getAlertStatistics();
      expect(alertStats.totalAlerts).to.be.greaterThan(0);
      expect(alertStats.alertsByComponent).to.be.an('object');
      expect(alertStats.alertsBySeverity).to.be.an('object');
    });

    it('should support alert suppression and filtering', async () => {
      // Configure alert suppression
      qualityMonitor.updateConfiguration({
        alerts: {
          suppressDuplicates: true,
          suppressionWindow: 5000,
          minimumSeverity: 'warning',
        },
      });

      const alerts = [];
      qualityMonitor.on('qualityAlert', (alert) => {
        alerts.push(alert);
      });

      // Trigger same alert multiple times
      for (let i = 0; i < 3; i++) {
        mockAudioProcessor.getQualityMetrics.returns({
          signalToNoiseRatio: 8,
          clarity: 0.4,
          volume: 0.7,
          distortion: 0.02,
          speechProbability: 0.9,
        });

        await TestUtils.wait(1200);
      }

      // Should only have one alert due to suppression
      const audioAlerts = alerts.filter((a) => a.component === 'audio');
      expect(audioAlerts.length).to.equal(1);
    });
  });

  describe('Optimization Engine', () => {
    beforeEach(async () => {
      await qualityMonitor.initialize();
      qualityMonitor.setAudioProcessor(mockAudioProcessor);
      qualityMonitor.setWebRTCService(mockWebRTCService);
      qualityMonitor.setTranslationService(mockTranslationService);
      await qualityMonitor.startMonitoring({ enableOptimization: true });
    });

    it('should provide optimization recommendations', async () => {
      // Simulate suboptimal conditions
      mockAudioProcessor.getQualityMetrics.returns({
        signalToNoiseRatio: 12,
        clarity: 0.75,
        volume: 0.3,
        distortion: 0.08,
        speechProbability: 0.7,
      });

      mockWebRTCService.getConnectionStats.resolves({
        latency: 180,
        bandwidth: 600,
        packetLoss: 0.04,
        jitter: 25,
        connectionQuality: 0.7,
      });

      await TestUtils.wait(1200);

      const recommendations = qualityMonitor.getOptimizationRecommendations();
      expect(recommendations).to.be.an('array');
      expect(recommendations.length).to.be.greaterThan(0);

      const audioRecommendation = recommendations.find((r) => r.component === 'audio');
      const networkRecommendation = recommendations.find((r) => r.component === 'network');

      expect(audioRecommendation).to.exist;
      expect(networkRecommendation).to.exist;
    });

    it('should apply automatic optimizations', async () => {
      // Enable auto-optimization
      qualityMonitor.updateConfiguration({
        optimization: { enableAutoOptimization: true },
      });

      let optimizationApplied = false;
      qualityMonitor.on('optimizationApplied', () => {
        optimizationApplied = true;
      });

      // Simulate conditions that trigger optimization
      mockAudioProcessor.getQualityMetrics.returns({
        signalToNoiseRatio: 10,
        clarity: 0.6,
        volume: 0.2,
        distortion: 0.12,
        speechProbability: 0.6,
      });

      // Wait for monitoring and optimization cycle
      await TestUtils.wait(6000);

      expect(optimizationApplied).to.be.true;

      const optimizationHistory = qualityMonitor.getOptimizationHistory();
      expect(optimizationHistory.length).to.be.greaterThan(0);
    });

    it('should track optimization effectiveness', async () => {
      // Apply optimization
      const optimization = {
        component: 'audio',
        type: 'noiseReduction',
        parameters: { level: 0.8 },
        expectedImprovement: 0.2,
      };

      await qualityMonitor.applyOptimization(optimization);

      // Simulate improved metrics after optimization
      mockAudioProcessor.getQualityMetrics.returns({
        signalToNoiseRatio: 20, // Improved
        clarity: 0.9, // Improved
        volume: 0.7,
        distortion: 0.01, // Improved
        speechProbability: 0.95,
      });

      await TestUtils.wait(1200);

      const effectiveness = qualityMonitor.getOptimizationEffectiveness();
      expect(effectiveness.totalOptimizations).to.be.greaterThan(0);
      expect(effectiveness.successRate).to.be.greaterThan(0);
      expect(effectiveness.averageImprovement).to.be.greaterThan(0);
    });

    it('should learn from optimization results', async () => {
      // Enable learning
      qualityMonitor.updateConfiguration({
        optimization: { enableLearning: true },
      });

      // Apply multiple optimizations with different results
      const optimizations = [
        { component: 'audio', type: 'noiseReduction', success: true, improvement: 0.3 },
        { component: 'network', type: 'bufferAdjustment', success: false, improvement: -0.1 },
        { component: 'audio', type: 'gainControl', success: true, improvement: 0.2 },
      ];

      for (const opt of optimizations) {
        await qualityMonitor.applyOptimization(opt);
        await TestUtils.wait(1200);
      }

      const learningStats = qualityMonitor.getLearningStatistics();
      expect(learningStats.totalLearningEvents).to.be.greaterThan(0);
      expect(learningStats.optimizationPatterns).to.be.an('object');
      expect(learningStats.successPredictionAccuracy).to.be.greaterThan(0);
    });
  });

  describe('Performance Analysis', () => {
    beforeEach(async () => {
      await qualityMonitor.initialize();
      qualityMonitor.setAudioProcessor(mockAudioProcessor);
      qualityMonitor.setWebRTCService(mockWebRTCService);
      qualityMonitor.setTranslationService(mockTranslationService);
      await qualityMonitor.startMonitoring({ enablePerformanceAnalysis: true });
    });

    it('should analyze system performance', async () => {
      // Wait for monitoring cycles
      await TestUtils.wait(3000);

      const performanceAnalysis = qualityMonitor.getPerformanceAnalysis();
      expect(performanceAnalysis.overallPerformance).to.be.greaterThan(0);
      expect(performanceAnalysis.componentPerformance).to.be.an('object');
      expect(performanceAnalysis.bottlenecks).to.be.an('array');
      expect(performanceAnalysis.recommendations).to.be.an('array');
    });

    it('should identify performance bottlenecks', async () => {
      // Simulate performance bottleneck
      mockTranslationService.getQualityMetrics.returns({
        averageConfidence: 0.88,
        averageProcessingTime: 5000, // Very slow
        accuracy: 0.92,
        errorRate: 0.03,
        languageDetectionAccuracy: 0.96,
      });

      await TestUtils.wait(1200);

      const bottlenecks = qualityMonitor.getPerformanceBottlenecks();
      expect(bottlenecks.length).to.be.greaterThan(0);

      const translationBottleneck = bottlenecks.find((b) => b.component === 'translation');
      expect(translationBottleneck).to.exist;
      expect(translationBottleneck.metric).to.equal('processingTime');
    });

    it('should provide performance trends', async () => {
      // Simulate performance data over time
      const performanceData = [
        { cpu: 0.3, memory: 128, latency: 50 },
        { cpu: 0.4, memory: 140, latency: 60 },
        { cpu: 0.5, memory: 155, latency: 75 },
        { cpu: 0.6, memory: 170, latency: 90 },
      ];

      for (const data of performanceData) {
        mockAudioProcessor.getProcessingStats.returns({
          averageProcessingTime: data.latency,
          cpuUsage: data.cpu,
          memoryUsage: data.memory,
          errorRate: 0.01,
        });

        await TestUtils.wait(1200);
      }

      const trends = qualityMonitor.getPerformanceTrends();
      expect(trends.cpuTrend).to.equal('increasing');
      expect(trends.memoryTrend).to.equal('increasing');
      expect(trends.latencyTrend).to.equal('increasing');
    });

    it('should predict performance issues', async () => {
      // Enable predictive analysis
      qualityMonitor.updateConfiguration({
        quality: { enablePredictiveAnalysis: true },
      });

      // Simulate degrading performance trend
      const degradingPerformance = [
        { cpu: 0.2, memory: 100, errorRate: 0.01 },
        { cpu: 0.4, memory: 120, errorRate: 0.02 },
        { cpu: 0.6, memory: 150, errorRate: 0.04 },
        { cpu: 0.8, memory: 180, errorRate: 0.08 },
      ];

      for (const perf of degradingPerformance) {
        mockAudioProcessor.getProcessingStats.returns({
          averageProcessingTime: 50,
          cpuUsage: perf.cpu,
          memoryUsage: perf.memory,
          errorRate: perf.errorRate,
        });

        await TestUtils.wait(1200);
      }

      const predictions = qualityMonitor.getPerformancePredictions();
      expect(predictions.cpuPrediction).to.exist;
      expect(predictions.memoryPrediction).to.exist;
      expect(predictions.riskLevel).to.be.greaterThan(0);
    });
  });

  describe('Configuration Management', () => {
    beforeEach(async () => {
      await qualityMonitor.initialize();
    });

    it('should update monitoring configuration dynamically', async () => {
      await qualityMonitor.startMonitoring();

      const newConfig = {
        quality: {
          audioThresholds: {
            signalToNoise: 20,
            clarity: 0.9,
          },
          networkThresholds: {
            latency: 100,
            bandwidth: 800,
          },
          monitoringInterval: 500,
        },
      };

      qualityMonitor.updateConfiguration(newConfig);

      const currentConfig = qualityMonitor.getConfiguration();
      expect(currentConfig.quality.audioThresholds.signalToNoise).to.equal(20);
      expect(currentConfig.quality.networkThresholds.latency).to.equal(100);
      expect(currentConfig.quality.monitoringInterval).to.equal(500);
    });

    it('should validate configuration changes', async () => {
      const invalidConfig = {
        quality: {
          audioThresholds: {
            signalToNoise: -5, // Invalid
            clarity: 1.5, // Invalid
          },
          monitoringInterval: 0, // Invalid
        },
      };

      expect(() => {
        qualityMonitor.updateConfiguration(invalidConfig);
      }).to.throw('Invalid quality monitoring configuration');
    });

    it('should apply configuration changes to active monitoring', async () => {
      await qualityMonitor.startMonitoring();

      // Change monitoring interval during operation
      qualityMonitor.updateConfiguration({
        quality: { monitoringInterval: 2000 },
      });

      const startTime = Date.now();
      let monitoringCycles = 0;

      qualityMonitor.on('monitoringCycle', () => {
        monitoringCycles++;
      });

      // Wait for multiple cycles
      await TestUtils.wait(5000);

      const elapsedTime = Date.now() - startTime;
      const expectedCycles = Math.floor(elapsedTime / 2000);

      expect(monitoringCycles).to.be.closeTo(expectedCycles, 1);
    });
  });

  describe('Statistics and Reporting', () => {
    beforeEach(async () => {
      await qualityMonitor.initialize();
      qualityMonitor.setAudioProcessor(mockAudioProcessor);
      qualityMonitor.setWebRTCService(mockWebRTCService);
      qualityMonitor.setTranslationService(mockTranslationService);
      await qualityMonitor.startMonitoring({ enableStatistics: true });
    });

    it('should track comprehensive monitoring statistics', async () => {
      // Wait for monitoring cycles
      await TestUtils.wait(3000);

      const stats = qualityMonitor.getStatistics();
      expect(stats.totalMonitoringCycles).to.be.greaterThan(0);
      expect(stats.averageQualityScore).to.be.greaterThan(0);
      expect(stats.alertsTriggered).to.be.greaterThanOrEqual(0);
      expect(stats.optimizationsApplied).to.be.greaterThanOrEqual(0);
    });

    it('should generate quality reports', async () => {
      // Wait for monitoring cycles
      await TestUtils.wait(2000);

      const report = qualityMonitor.generateQualityReport();
      expect(report.summary).to.exist;
      expect(report.qualityMetrics).to.exist;
      expect(report.alerts).to.be.an('array');
      expect(report.recommendations).to.be.an('array');
      expect(report.trends).to.exist;
      expect(report.generatedAt).to.be.a('date');
    });

    it('should provide historical quality data', async () => {
      // Wait for monitoring cycles
      await TestUtils.wait(3000);

      const historicalData = qualityMonitor.getHistoricalQualityData();
      expect(historicalData.dataPoints).to.be.an('array');
      expect(historicalData.dataPoints.length).to.be.greaterThan(0);
      expect(historicalData.timeRange).to.exist;
      expect(historicalData.averageQuality).to.be.greaterThan(0);
    });

    it('should export monitoring data', async () => {
      // Wait for monitoring cycles
      await TestUtils.wait(2000);

      const exportData = qualityMonitor.exportMonitoringData();
      expect(exportData.metadata).to.exist;
      expect(exportData.qualityMetrics).to.be.an('array');
      expect(exportData.alerts).to.be.an('array');
      expect(exportData.optimizations).to.be.an('array');
      expect(exportData.exportedAt).to.be.a('date');
    });
  });

  describe('Cleanup and Resource Management', () => {
    it('should cleanup monitoring resources properly', async () => {
      await qualityMonitor.initialize();
      await qualityMonitor.startMonitoring();

      // Wait for some monitoring
      await TestUtils.wait(1500);

      // Cleanup
      await qualityMonitor.cleanup();

      expect(qualityMonitor.isInitialized).to.be.false;
      expect(qualityMonitor.isMonitoring).to.be.false;

      const status = qualityMonitor.getStatus();
      expect(status.status).to.equal('cleaned');
    });

    it('should handle cleanup during active monitoring', async () => {
      await qualityMonitor.initialize();
      await qualityMonitor.startMonitoring();

      // Start monitoring and cleanup immediately
      const monitoringPromise = TestUtils.wait(2000);
      const cleanupPromise = qualityMonitor.cleanup();

      await Promise.all([monitoringPromise, cleanupPromise]);

      expect(qualityMonitor.isMonitoring).to.be.false;
    });

    it('should release all allocated resources', async () => {
      await qualityMonitor.initialize();
      await qualityMonitor.startMonitoring();

      const initialStats = qualityMonitor.getResourceUsage();
      expect(initialStats.memoryUsage).to.be.greaterThan(0);

      await qualityMonitor.cleanup();

      const finalStats = qualityMonitor.getResourceUsage();
      expect(finalStats.memoryUsage).to.equal(0);
      expect(finalStats.activeMonitors).to.equal(0);
      expect(finalStats.activeTimers).to.equal(0);
    });

    it('should stop all monitoring timers', async () => {
      await qualityMonitor.initialize();
      await qualityMonitor.startMonitoring();

      const activeTimers = qualityMonitor.getActiveTimers();
      expect(activeTimers.length).to.be.greaterThan(0);

      await qualityMonitor.cleanup();

      const remainingTimers = qualityMonitor.getActiveTimers();
      expect(remainingTimers.length).to.equal(0);
    });
  });
});
