import { expect } from 'chai';
import sinon from 'sinon';
import { EventEmitter } from 'events';
import { TranslationIntegration } from '../translation-integration.js';
import { testConfig, TestUtils } from './test-config.js';

describe('TranslationIntegration Integration Tests', () => {
  let integration;
  let mockConfig;
  let mockAudioProcessor;
  let mockTranslationService;
  let mockWebRTCService;
  let sandbox;

  beforeEach(async () => {
    sandbox = sinon.createSandbox();

    // Create test configuration
    mockConfig = TestUtils.createTestConfig({
      translation: {
        enableRealTime: true,
        bufferSize: 2048,
        processingTimeout: 3000,
        cacheSize: 100,
        enableOptimization: true,
      },
      audio: {
        sampleRate: 16000,
        channels: 1,
        enablePreprocessing: true,
      },
      integration: {
        maxConcurrentProcessing: 3,
        enableBatching: true,
        batchSize: 5,
        enableCaching: true,
        cacheTimeout: 300000,
      },
    });

    // Mock audio processor
    mockAudioProcessor = new EventEmitter();
    Object.assign(mockAudioProcessor, {
      isProcessing: false,
      processAudio: sandbox.stub().resolves({
        processedAudio: new Float32Array(1024),
        quality: 0.9,
        speechDetected: true,
        features: {
          mfcc: new Float32Array(13),
          spectralCentroid: 1500,
          zeroCrossingRate: 0.1,
        },
      }),
      getQualityMetrics: sandbox.stub().returns({
        signalToNoiseRatio: 15,
        clarity: 0.85,
        speechProbability: 0.9,
      }),
      on: sandbox.stub(),
      emit: sandbox.stub(),
    });

    // Mock translation service
    mockTranslationService = new EventEmitter();
    Object.assign(mockTranslationService, {
      isReady: true,
      translateAudio: sandbox.stub().resolves({
        originalText: 'Hello, how are you?',
        translatedText: 'Hola, ¿cómo estás?',
        sourceLanguage: 'en',
        targetLanguage: 'es',
        confidence: 0.92,
        processingTime: 150,
      }),
      translateText: sandbox.stub().resolves({
        translatedText: 'Hola, ¿cómo estás?',
        confidence: 0.92,
      }),
      detectLanguage: sandbox.stub().resolves({
        language: 'en',
        confidence: 0.98,
      }),
      on: sandbox.stub(),
      emit: sandbox.stub(),
    });

    // Mock WebRTC service
    mockWebRTCService = new EventEmitter();
    Object.assign(mockWebRTCService, {
      isConnected: true,
      sendTranslationResult: sandbox.stub().resolves(),
      getConnectionStats: sandbox.stub().resolves({
        latency: 50,
        bandwidth: 1000,
        quality: 0.9,
      }),
      on: sandbox.stub(),
      emit: sandbox.stub(),
    });

    // Create integration instance
    integration = new TranslationIntegration(mockConfig);
  });

  afterEach(async () => {
    if (integration) {
      await integration.cleanup();
    }
    sandbox.restore();
  });

  describe('Initialization', () => {
    it('should initialize integration successfully', async () => {
      const initPromise = integration.initialize();

      await expect(initPromise).to.be.fulfilled;
      expect(integration.isInitialized).to.be.true;
      expect(integration.getStatus().status).to.equal('ready');
    });

    it('should setup integration components', async () => {
      await integration.initialize();

      const status = integration.getStatus();
      expect(status.cacheManager).to.exist;
      expect(status.optimizationEngine).to.exist;
      expect(status.performanceMonitor).to.exist;
      expect(status.batchProcessor).to.exist;
    });

    it('should configure integration parameters', async () => {
      await integration.initialize();

      const config = integration.getConfiguration();
      expect(config.enableRealTime).to.be.true;
      expect(config.bufferSize).to.equal(2048);
      expect(config.maxConcurrentProcessing).to.equal(3);
      expect(config.enableCaching).to.be.true;
    });

    it('should handle initialization errors gracefully', async () => {
      // Mock initialization failure
      const originalInitializeComponents = integration._initializeComponents;
      integration._initializeComponents = sandbox
        .stub()
        .throws(new Error('Component initialization failed'));

      await expect(integration.initialize()).to.be.rejectedWith('Component initialization failed');
      expect(integration.isInitialized).to.be.false;

      // Restore original method
      integration._initializeComponents = originalInitializeComponents;
    });
  });

  describe('Service Integration', () => {
    beforeEach(async () => {
      await integration.initialize();
      integration.setAudioProcessor(mockAudioProcessor);
      integration.setTranslationService(mockTranslationService);
      integration.setWebRTCService(mockWebRTCService);
    });

    it('should start integration successfully', async () => {
      const integrationConfig = {
        sourceLanguage: 'en',
        targetLanguage: 'es',
        enableRealTime: true,
        enableOptimization: true,
      };

      await integration.startIntegration(integrationConfig);

      expect(integration.isRunning).to.be.true;
      expect(integration.getStatus().status).to.equal('running');
    });

    it('should process audio with translation integration', async () => {
      await integration.startIntegration({
        sourceLanguage: 'en',
        targetLanguage: 'es',
        enableRealTime: true,
      });

      // Create mock audio data
      const audioData = new Float32Array(1024);
      for (let i = 0; i < audioData.length; i++) {
        audioData[i] = Math.sin((2 * Math.PI * 440 * i) / 16000);
      }

      const result = await integration.processAudioWithTranslation(audioData);

      expect(result.success).to.be.true;
      expect(result.originalText).to.equal('Hello, how are you?');
      expect(result.translatedText).to.equal('Hola, ¿cómo estás?');
      expect(result.processingTime).to.be.greaterThan(0);
      expect(mockAudioProcessor.processAudio.calledOnce).to.be.true;
      expect(mockTranslationService.translateAudio.calledOnce).to.be.true;
    });

    it('should handle concurrent processing requests', async () => {
      await integration.startIntegration({
        maxConcurrentProcessing: 3,
        enableConcurrency: true,
      });

      // Create multiple audio chunks
      const audioChunks = [];
      for (let i = 0; i < 5; i++) {
        const chunk = new Float32Array(1024);
        chunk.fill(Math.sin((2 * Math.PI * (200 + i * 50) * i) / 16000));
        audioChunks.push(chunk);
      }

      // Process all chunks concurrently
      const promises = audioChunks.map((chunk) => integration.processAudioWithTranslation(chunk));

      const results = await Promise.all(promises);

      expect(results.length).to.equal(5);
      results.forEach((result) => {
        expect(result.success).to.be.true;
      });

      const stats = integration.getStatistics();
      expect(stats.concurrentProcessing.maxConcurrent).to.be.lessThanOrEqual(3);
    });

    it('should stop integration cleanly', async () => {
      await integration.startIntegration({ enableRealTime: true });
      expect(integration.isRunning).to.be.true;

      await integration.stopIntegration();

      expect(integration.isRunning).to.be.false;
      expect(integration.getStatus().status).to.equal('ready');
    });
  });

  describe('Caching System', () => {
    beforeEach(async () => {
      await integration.initialize();
      integration.setTranslationService(mockTranslationService);
      await integration.startIntegration({ enableCaching: true });
    });

    it('should cache translation results', async () => {
      const audioData = new Float32Array(1024);
      audioData.fill(0.5); // Consistent data for caching

      // First processing - should call translation service
      const result1 = await integration.processAudioWithTranslation(audioData);
      expect(mockTranslationService.translateAudio.calledOnce).to.be.true;
      expect(result1.fromCache).to.be.false;

      // Second processing with same input - should use cache
      const result2 = await integration.processAudioWithTranslation(audioData);
      expect(mockTranslationService.translateAudio.calledOnce).to.be.true; // Still only called once
      expect(result2.fromCache).to.be.true;
      expect(result2.translatedText).to.equal(result1.translatedText);
    });

    it('should manage cache size and expiration', async () => {
      const cacheManager = integration.getCacheManager();

      // Fill cache beyond capacity
      for (let i = 0; i < 150; i++) {
        const audioData = new Float32Array(1024);
        audioData.fill(i * 0.01); // Different data for each entry
        await integration.processAudioWithTranslation(audioData);
      }

      const cacheStats = cacheManager.getStatistics();
      expect(cacheStats.totalEntries).to.be.lessThanOrEqual(100); // Should respect cache size limit
      expect(cacheStats.evictions).to.be.greaterThan(0);
    });

    it('should invalidate expired cache entries', async () => {
      // Mock short cache timeout
      integration.updateConfiguration({
        integration: { cacheTimeout: 100 },
      });

      const audioData = new Float32Array(1024);
      audioData.fill(0.5);

      // First processing
      await integration.processAudioWithTranslation(audioData);
      expect(mockTranslationService.translateAudio.calledOnce).to.be.true;

      // Wait for cache expiration
      await TestUtils.wait(150);

      // Second processing - should call service again due to expiration
      await integration.processAudioWithTranslation(audioData);
      expect(mockTranslationService.translateAudio.calledTwice).to.be.true;
    });

    it('should provide cache statistics', async () => {
      const audioData = new Float32Array(1024);

      // Process same data multiple times
      for (let i = 0; i < 5; i++) {
        await integration.processAudioWithTranslation(audioData);
      }

      const cacheStats = integration.getCacheStatistics();
      expect(cacheStats.hitRate).to.be.greaterThan(0.5);
      expect(cacheStats.totalHits).to.equal(4); // First miss, then 4 hits
      expect(cacheStats.totalMisses).to.equal(1);
    });
  });

  describe('Batch Processing', () => {
    beforeEach(async () => {
      await integration.initialize();
      integration.setTranslationService(mockTranslationService);
      await integration.startIntegration({ enableBatching: true, batchSize: 3 });
    });

    it('should batch multiple audio processing requests', async () => {
      const batchProcessor = integration.getBatchProcessor();
      let batchProcessed = false;

      integration.on('batchProcessed', () => {
        batchProcessed = true;
      });

      // Add multiple items to batch
      const audioChunks = [];
      for (let i = 0; i < 3; i++) {
        const chunk = new Float32Array(1024);
        chunk.fill(i * 0.1);
        audioChunks.push(chunk);
      }

      // Process chunks - should trigger batch processing
      const promises = audioChunks.map((chunk) => integration.processAudioWithTranslation(chunk));

      await Promise.all(promises);

      // Wait for batch processing
      await TestUtils.wait(100);

      expect(batchProcessed).to.be.true;

      const batchStats = batchProcessor.getStatistics();
      expect(batchStats.totalBatches).to.be.greaterThan(0);
    });

    it('should optimize batch processing for efficiency', async () => {
      // Process multiple similar requests
      const similarAudioChunks = [];
      for (let i = 0; i < 6; i++) {
        const chunk = new Float32Array(1024);
        // Create similar audio patterns
        for (let j = 0; j < chunk.length; j++) {
          chunk[j] = Math.sin((2 * Math.PI * 440 * j) / 16000) + i * 0.01;
        }
        similarAudioChunks.push(chunk);
      }

      const startTime = Date.now();

      const promises = similarAudioChunks.map((chunk) =>
        integration.processAudioWithTranslation(chunk)
      );

      await Promise.all(promises);

      const processingTime = Date.now() - startTime;

      const optimizationStats = integration.getOptimizationStatistics();
      expect(optimizationStats.batchOptimizations).to.be.greaterThan(0);
    });

    it('should handle batch processing errors gracefully', async () => {
      // Simulate batch processing error
      mockTranslationService.translateAudio
        .onFirstCall()
        .resolves({ translatedText: 'Success 1', confidence: 0.9 })
        .onSecondCall()
        .rejects(new Error('Translation failed'))
        .onThirdCall()
        .resolves({ translatedText: 'Success 3', confidence: 0.9 });

      const audioChunks = [];
      for (let i = 0; i < 3; i++) {
        const chunk = new Float32Array(1024);
        chunk.fill(i * 0.1);
        audioChunks.push(chunk);
      }

      const promises = audioChunks.map((chunk) => integration.processAudioWithTranslation(chunk));

      const results = await Promise.all(promises);

      // Should have 2 successes and 1 error
      const successes = results.filter((r) => r.success);
      const errors = results.filter((r) => r.error);

      expect(successes.length).to.equal(2);
      expect(errors.length).to.equal(1);
    });
  });

  describe('Performance Optimization', () => {
    beforeEach(async () => {
      await integration.initialize();
      integration.setAudioProcessor(mockAudioProcessor);
      integration.setTranslationService(mockTranslationService);
      await integration.startIntegration({ enableOptimization: true });
    });

    it('should monitor performance metrics', async () => {
      // Process multiple audio chunks
      for (let i = 0; i < 10; i++) {
        const chunk = new Float32Array(1024);
        chunk.fill(Math.random());
        await integration.processAudioWithTranslation(chunk);
      }

      const performanceMetrics = integration.getPerformanceMetrics();
      expect(performanceMetrics.averageProcessingTime).to.be.greaterThan(0);
      expect(performanceMetrics.throughput).to.be.greaterThan(0);
      expect(performanceMetrics.totalProcessed).to.equal(10);
      expect(performanceMetrics.errorRate).to.be.lessThan(1);
    });

    it('should detect performance bottlenecks', async () => {
      // Simulate slow translation service
      mockTranslationService.translateAudio.callsFake(async () => {
        await TestUtils.wait(500); // Slow response
        return {
          translatedText: 'Slow translation',
          confidence: 0.9,
        };
      });

      const audioData = new Float32Array(1024);
      const startTime = Date.now();

      await integration.processAudioWithTranslation(audioData);

      const processingTime = Date.now() - startTime;
      expect(processingTime).to.be.greaterThan(400);

      const bottlenecks = integration.getPerformanceBottlenecks();
      expect(bottlenecks).to.be.an('array');
      expect(bottlenecks.length).to.be.greaterThan(0);
      expect(bottlenecks[0].component).to.equal('translationService');
    });

    it('should apply performance optimizations', async () => {
      const optimizationEngine = integration.getOptimizationEngine();

      // Process audio to trigger optimization analysis
      for (let i = 0; i < 5; i++) {
        const chunk = new Float32Array(1024);
        await integration.processAudioWithTranslation(chunk);
      }

      const optimizations = optimizationEngine.getAppliedOptimizations();
      expect(optimizations).to.be.an('array');

      if (optimizations.length > 0) {
        expect(optimizations[0]).to.have.property('type');
        expect(optimizations[0]).to.have.property('impact');
        expect(optimizations[0]).to.have.property('appliedAt');
      }
    });

    it('should adapt processing based on system load', async () => {
      // Simulate high system load
      integration.updateConfiguration({
        integration: {
          adaptiveProcessing: true,
          loadThreshold: 0.7,
        },
      });

      // Mock high CPU usage
      const originalGetSystemLoad = integration._getSystemLoad;
      integration._getSystemLoad = sandbox.stub().returns(0.8);

      const audioData = new Float32Array(1024);
      const result = await integration.processAudioWithTranslation(audioData);

      expect(result.adaptiveAdjustments).to.be.true;
      expect(result.loadOptimized).to.be.true;

      // Restore original method
      integration._getSystemLoad = originalGetSystemLoad;
    });
  });

  describe('Quality Monitoring', () => {
    beforeEach(async () => {
      await integration.initialize();
      integration.setAudioProcessor(mockAudioProcessor);
      integration.setTranslationService(mockTranslationService);
      await integration.startIntegration({ enableQualityMonitoring: true });
    });

    it('should monitor integration quality metrics', async () => {
      const audioData = new Float32Array(1024);
      await integration.processAudioWithTranslation(audioData);

      const qualityMetrics = integration.getQualityMetrics();
      expect(qualityMetrics.overallScore).to.be.greaterThan(0);
      expect(qualityMetrics.audioQuality).to.be.greaterThan(0);
      expect(qualityMetrics.translationQuality).to.be.greaterThan(0);
      expect(qualityMetrics.integrationEfficiency).to.be.greaterThan(0);
    });

    it('should detect quality degradation', async () => {
      let qualityAlertTriggered = false;
      integration.on('qualityAlert', () => {
        qualityAlertTriggered = true;
      });

      // Simulate poor quality translation
      mockTranslationService.translateAudio.resolves({
        translatedText: 'poor translation',
        confidence: 0.3, // Low confidence
        processingTime: 5000, // Slow processing
      });

      const audioData = new Float32Array(1024);
      await integration.processAudioWithTranslation(audioData);

      // Wait for quality analysis
      await TestUtils.wait(100);

      expect(qualityAlertTriggered).to.be.true;

      const qualityMetrics = integration.getQualityMetrics();
      expect(qualityMetrics.overallScore).to.be.lessThan(0.5);
    });

    it('should provide quality improvement recommendations', async () => {
      // Process with suboptimal settings
      const audioData = new Float32Array(1024);
      await integration.processAudioWithTranslation(audioData);

      const recommendations = integration.getQualityRecommendations();
      expect(recommendations).to.be.an('array');

      if (recommendations.length > 0) {
        expect(recommendations[0]).to.have.property('category');
        expect(recommendations[0]).to.have.property('suggestion');
        expect(recommendations[0]).to.have.property('priority');
        expect(recommendations[0]).to.have.property('expectedImprovement');
      }
    });
  });

  describe('WebRTC Integration', () => {
    beforeEach(async () => {
      await integration.initialize();
      integration.setWebRTCService(mockWebRTCService);
      await integration.startIntegration({ enableWebRTCIntegration: true });
    });

    it('should integrate with WebRTC for result transmission', async () => {
      const audioData = new Float32Array(1024);
      const result = await integration.processAudioWithTranslation(audioData);

      expect(mockWebRTCService.sendTranslationResult.calledOnce).to.be.true;
      const sentResult = mockWebRTCService.sendTranslationResult.getCall(0).args[0];
      expect(sentResult.translatedText).to.equal('Hola, ¿cómo estás?');
    });

    it('should adapt to WebRTC connection quality', async () => {
      // Simulate poor connection
      mockWebRTCService.getConnectionStats.resolves({
        latency: 300,
        bandwidth: 100,
        quality: 0.3,
      });

      const audioData = new Float32Array(1024);
      const result = await integration.processAudioWithTranslation(audioData);

      expect(result.networkAdaptations).to.be.true;
      expect(result.qualityAdjusted).to.be.true;
    });

    it('should handle WebRTC disconnections gracefully', async () => {
      // Simulate connection loss
      mockWebRTCService.isConnected = false;
      mockWebRTCService.sendTranslationResult.rejects(new Error('Connection lost'));

      const audioData = new Float32Array(1024);
      const result = await integration.processAudioWithTranslation(audioData);

      expect(result.webrtcError).to.be.true;
      expect(result.fallbackMode).to.be.true;
      expect(result.translatedText).to.exist; // Should still have translation
    });
  });

  describe('Error Handling and Recovery', () => {
    beforeEach(async () => {
      await integration.initialize();
      integration.setAudioProcessor(mockAudioProcessor);
      integration.setTranslationService(mockTranslationService);
    });

    it('should handle service failures gracefully', async () => {
      await integration.startIntegration({ enableErrorRecovery: true });

      // Simulate audio processor failure
      mockAudioProcessor.processAudio.rejects(new Error('Audio processing failed'));

      const audioData = new Float32Array(1024);
      const result = await integration.processAudioWithTranslation(audioData);

      expect(result.error).to.be.true;
      expect(result.componentFailure).to.equal('audioProcessor');
      expect(result.recoveryAttempted).to.be.true;
    });

    it('should provide fallback processing modes', async () => {
      await integration.startIntegration({ enableFallback: true });

      // Simulate translation service failure
      mockTranslationService.translateAudio.rejects(new Error('Translation service unavailable'));

      const audioData = new Float32Array(1024);
      const result = await integration.processAudioWithTranslation(audioData);

      expect(result.fallbackMode).to.be.true;
      expect(result.fallbackType).to.exist;
    });

    it('should recover from temporary failures', async () => {
      await integration.startIntegration({ enableErrorRecovery: true });

      // Simulate temporary failure followed by recovery
      mockTranslationService.translateAudio
        .onFirstCall()
        .rejects(new Error('Temporary failure'))
        .onSecondCall()
        .resolves({
          translatedText: 'Recovered translation',
          confidence: 0.9,
        });

      const audioData = new Float32Array(1024);

      // First call should fail and trigger recovery
      const result1 = await integration.processAudioWithTranslation(audioData);
      expect(result1.error).to.be.true;

      // Second call should succeed
      const result2 = await integration.processAudioWithTranslation(audioData);
      expect(result2.success).to.be.true;
      expect(result2.translatedText).to.equal('Recovered translation');
    });

    it('should provide comprehensive error reporting', async () => {
      await integration.startIntegration({ enableErrorReporting: true });

      // Trigger various error conditions
      mockAudioProcessor.processAudio.rejects(new Error('Audio error'));

      const audioData = new Float32Array(1024);
      await integration.processAudioWithTranslation(audioData);

      const errorReport = integration.getErrorReport();
      expect(errorReport.totalErrors).to.be.greaterThan(0);
      expect(errorReport.errorsByComponent).to.be.an('object');
      expect(errorReport.recoveryActions).to.be.an('array');
    });
  });

  describe('Configuration Management', () => {
    beforeEach(async () => {
      await integration.initialize();
    });

    it('should update configuration dynamically', async () => {
      await integration.startIntegration();

      const newConfig = {
        translation: {
          bufferSize: 4096,
          processingTimeout: 5000,
        },
        integration: {
          maxConcurrentProcessing: 5,
          enableBatching: false,
        },
      };

      integration.updateConfiguration(newConfig);

      const currentConfig = integration.getConfiguration();
      expect(currentConfig.translation.bufferSize).to.equal(4096);
      expect(currentConfig.translation.processingTimeout).to.equal(5000);
      expect(currentConfig.integration.maxConcurrentProcessing).to.equal(5);
      expect(currentConfig.integration.enableBatching).to.be.false;
    });

    it('should validate configuration changes', async () => {
      const invalidConfig = {
        translation: {
          bufferSize: -1,
          processingTimeout: 0,
        },
        integration: {
          maxConcurrentProcessing: 0,
        },
      };

      expect(() => {
        integration.updateConfiguration(invalidConfig);
      }).to.throw('Invalid configuration');
    });

    it('should apply configuration changes to active integration', async () => {
      await integration.startIntegration();

      // Change configuration during processing
      integration.updateConfiguration({
        integration: { maxConcurrentProcessing: 2 },
      });

      const audioData = new Float32Array(1024);
      const result = await integration.processAudioWithTranslation(audioData);

      expect(result.configurationApplied).to.be.true;
      expect(result.maxConcurrentProcessing).to.equal(2);
    });
  });

  describe('Statistics and Monitoring', () => {
    beforeEach(async () => {
      await integration.initialize();
      integration.setAudioProcessor(mockAudioProcessor);
      integration.setTranslationService(mockTranslationService);
      await integration.startIntegration({ enableStatistics: true });
    });

    it('should track comprehensive statistics', async () => {
      // Process multiple audio chunks
      for (let i = 0; i < 10; i++) {
        const chunk = new Float32Array(1024);
        chunk.fill(Math.random());
        await integration.processAudioWithTranslation(chunk);
      }

      const stats = integration.getStatistics();
      expect(stats.totalProcessed).to.equal(10);
      expect(stats.successRate).to.be.greaterThan(0.8);
      expect(stats.averageProcessingTime).to.be.greaterThan(0);
      expect(stats.throughput).to.be.greaterThan(0);
      expect(stats.cacheHitRate).to.be.greaterThanOrEqual(0);
    });

    it('should provide detailed performance breakdown', async () => {
      const audioData = new Float32Array(1024);
      await integration.processAudioWithTranslation(audioData);

      const breakdown = integration.getPerformanceBreakdown();
      expect(breakdown.audioProcessing).to.be.greaterThan(0);
      expect(breakdown.translation).to.be.greaterThan(0);
      expect(breakdown.caching).to.be.greaterThanOrEqual(0);
      expect(breakdown.webrtcTransmission).to.be.greaterThanOrEqual(0);
    });

    it('should monitor resource usage', async () => {
      // Process some data
      for (let i = 0; i < 5; i++) {
        const chunk = new Float32Array(1024);
        await integration.processAudioWithTranslation(chunk);
      }

      const resourceUsage = integration.getResourceUsage();
      expect(resourceUsage.memoryUsage).to.be.greaterThan(0);
      expect(resourceUsage.cpuUsage).to.be.greaterThan(0);
      expect(resourceUsage.activeConnections).to.be.greaterThanOrEqual(0);
    });
  });

  describe('Cleanup and Resource Management', () => {
    it('should cleanup resources properly', async () => {
      await integration.initialize();
      await integration.startIntegration();

      // Process some data
      const chunk = new Float32Array(1024);
      await integration.processAudioWithTranslation(chunk);

      // Cleanup
      await integration.cleanup();

      expect(integration.isInitialized).to.be.false;
      expect(integration.isRunning).to.be.false;

      const status = integration.getStatus();
      expect(status.status).to.equal('cleaned');
    });

    it('should handle cleanup during active processing', async () => {
      await integration.initialize();
      await integration.startIntegration();

      // Start processing and cleanup immediately
      const processingPromise = integration.processAudioWithTranslation(new Float32Array(1024));
      const cleanupPromise = integration.cleanup();

      await Promise.all([processingPromise, cleanupPromise]);

      expect(integration.isRunning).to.be.false;
    });

    it('should release all allocated resources', async () => {
      await integration.initialize();
      await integration.startIntegration();

      const initialStats = integration.getResourceUsage();
      expect(initialStats.memoryUsage).to.be.greaterThan(0);

      await integration.cleanup();

      const finalStats = integration.getResourceUsage();
      expect(finalStats.memoryUsage).to.equal(0);
      expect(finalStats.activeConnections).to.equal(0);
      expect(finalStats.cacheEntries).to.equal(0);
    });
  });
});
