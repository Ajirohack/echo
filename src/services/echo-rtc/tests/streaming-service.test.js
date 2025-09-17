import { expect } from 'chai';
import sinon from 'sinon';
import { EventEmitter } from 'events';
import { StreamingService } from '../streaming-service.js';
import { testConfig, TestUtils } from './test-config.js';

describe('StreamingService Integration Tests', () => {
  let streamingService;
  let mockConfig;
  let mockWebRTCService;
  let mockAudioProcessor;
  let sandbox;

  beforeEach(async () => {
    sandbox = sinon.createSandbox();

    // Create test configuration
    mockConfig = TestUtils.createTestConfig({
      streaming: {
        bufferSize: 4096,
        maxBufferSize: 16384,
        chunkSize: 1024,
        sampleRate: 16000,
        channels: 1,
        enableAdaptiveBuffering: true,
        qualityThreshold: 0.8,
        latencyTarget: 100,
      },
      audio: {
        sampleRate: 16000,
        channels: 1,
        bitDepth: 16,
        enablePreprocessing: true,
      },
      network: {
        maxBandwidth: 1000,
        adaptiveBitrate: true,
        enableCompression: true,
        compressionLevel: 6,
      },
    });

    // Mock WebRTC service
    mockWebRTCService = new EventEmitter();
    Object.assign(mockWebRTCService, {
      isConnected: true,
      sendAudioChunk: sandbox.stub().resolves(),
      getConnectionStats: sandbox.stub().resolves({
        latency: 50,
        bandwidth: 1000,
        packetLoss: 0.01,
        jitter: 5,
      }),
      on: sandbox.stub(),
      emit: sandbox.stub(),
    });

    // Mock audio processor
    mockAudioProcessor = new EventEmitter();
    Object.assign(mockAudioProcessor, {
      isProcessing: false,
      processChunk: sandbox.stub().resolves({
        processedAudio: new Float32Array(1024),
        quality: 0.9,
        features: {
          volume: 0.7,
          frequency: 440,
          clarity: 0.85,
        },
      }),
      on: sandbox.stub(),
      emit: sandbox.stub(),
    });

    // Create streaming service instance
    streamingService = new StreamingService(mockConfig);
  });

  afterEach(async () => {
    if (streamingService) {
      await streamingService.cleanup();
    }
    sandbox.restore();
  });

  describe('Initialization', () => {
    it('should initialize streaming service successfully', async () => {
      const initPromise = streamingService.initialize();

      await expect(initPromise).to.be.fulfilled;
      expect(streamingService.isInitialized).to.be.true;
      expect(streamingService.getStatus().status).to.equal('ready');
    });

    it('should setup streaming components', async () => {
      await streamingService.initialize();

      const status = streamingService.getStatus();
      expect(status.bufferManager).to.exist;
      expect(status.qualityController).to.exist;
      expect(status.adaptiveAlgorithm).to.exist;
      expect(status.performanceMonitor).to.exist;
    });

    it('should configure streaming parameters', async () => {
      await streamingService.initialize();

      const config = streamingService.getConfiguration();
      expect(config.bufferSize).to.equal(4096);
      expect(config.chunkSize).to.equal(1024);
      expect(config.sampleRate).to.equal(16000);
      expect(config.enableAdaptiveBuffering).to.be.true;
    });

    it('should handle initialization errors gracefully', async () => {
      // Mock initialization failure
      const originalInitializeBuffers = streamingService._initializeBuffers;
      streamingService._initializeBuffers = sandbox
        .stub()
        .throws(new Error('Buffer initialization failed'));

      await expect(streamingService.initialize()).to.be.rejectedWith(
        'Buffer initialization failed'
      );
      expect(streamingService.isInitialized).to.be.false;

      // Restore original method
      streamingService._initializeBuffers = originalInitializeBuffers;
    });
  });

  describe('Streaming Operations', () => {
    beforeEach(async () => {
      await streamingService.initialize();
      streamingService.setWebRTCService(mockWebRTCService);
      streamingService.setAudioProcessor(mockAudioProcessor);
    });

    it('should start streaming successfully', async () => {
      const streamingConfig = {
        targetLatency: 100,
        qualityLevel: 'high',
        enableAdaptive: true,
        bufferSize: 4096,
      };

      await streamingService.startStreaming(streamingConfig);

      expect(streamingService.isStreaming).to.be.true;
      expect(streamingService.getStatus().status).to.equal('streaming');
    });

    it('should process and stream audio chunks', async () => {
      await streamingService.startStreaming({ enableRealTime: true });

      // Create mock audio data
      const audioData = new Float32Array(1024);
      for (let i = 0; i < audioData.length; i++) {
        audioData[i] = Math.sin((2 * Math.PI * 440 * i) / 16000);
      }

      const result = await streamingService.processAudioChunk(audioData);

      expect(result.success).to.be.true;
      expect(result.chunkProcessed).to.be.true;
      expect(result.streamingLatency).to.be.greaterThan(0);
      expect(mockAudioProcessor.processChunk.calledOnce).to.be.true;
      expect(mockWebRTCService.sendAudioChunk.calledOnce).to.be.true;
    });

    it('should handle continuous audio streaming', async () => {
      await streamingService.startStreaming({ enableContinuous: true });

      let chunksProcessed = 0;
      streamingService.on('chunkProcessed', () => {
        chunksProcessed++;
      });

      // Stream multiple chunks
      const chunks = [];
      for (let i = 0; i < 10; i++) {
        const chunk = new Float32Array(1024);
        for (let j = 0; j < chunk.length; j++) {
          chunk[j] = Math.sin((2 * Math.PI * (200 + i * 50) * j) / 16000);
        }
        chunks.push(chunk);
      }

      // Process all chunks
      for (const chunk of chunks) {
        await streamingService.processAudioChunk(chunk);
      }

      expect(chunksProcessed).to.equal(10);

      const stats = streamingService.getStatistics();
      expect(stats.totalChunksProcessed).to.equal(10);
      expect(stats.averageProcessingTime).to.be.greaterThan(0);
    });

    it('should stop streaming cleanly', async () => {
      await streamingService.startStreaming({ enableRealTime: true });
      expect(streamingService.isStreaming).to.be.true;

      await streamingService.stopStreaming();

      expect(streamingService.isStreaming).to.be.false;
      expect(streamingService.getStatus().status).to.equal('ready');
    });
  });

  describe('Buffer Management', () => {
    beforeEach(async () => {
      await streamingService.initialize();
      await streamingService.startStreaming({ enableBuffering: true });
    });

    it('should manage audio buffers efficiently', async () => {
      const bufferManager = streamingService.getBufferManager();

      // Add audio data to buffer
      const audioData = new Float32Array(2048);
      audioData.fill(0.5);

      await streamingService.processAudioChunk(audioData);

      const bufferStats = bufferManager.getStatistics();
      expect(bufferStats.currentSize).to.be.greaterThan(0);
      expect(bufferStats.utilizationRate).to.be.greaterThan(0);
      expect(bufferStats.overflowCount).to.equal(0);
    });

    it('should handle buffer overflow gracefully', async () => {
      // Fill buffer beyond capacity
      const largeAudioData = new Float32Array(20000); // Larger than max buffer
      largeAudioData.fill(0.7);

      let overflowDetected = false;
      streamingService.on('bufferOverflow', () => {
        overflowDetected = true;
      });

      await streamingService.processAudioChunk(largeAudioData);

      expect(overflowDetected).to.be.true;

      const bufferStats = streamingService.getBufferStatistics();
      expect(bufferStats.overflowCount).to.be.greaterThan(0);
      expect(bufferStats.droppedSamples).to.be.greaterThan(0);
    });

    it('should implement adaptive buffering', async () => {
      // Simulate varying network conditions
      mockWebRTCService.getConnectionStats
        .onFirstCall()
        .resolves({ latency: 50, bandwidth: 1000, packetLoss: 0.01 })
        .onSecondCall()
        .resolves({ latency: 200, bandwidth: 500, packetLoss: 0.05 })
        .onThirdCall()
        .resolves({ latency: 100, bandwidth: 800, packetLoss: 0.02 });

      // Process chunks under different conditions
      for (let i = 0; i < 3; i++) {
        const chunk = new Float32Array(1024);
        chunk.fill(i * 0.1);
        await streamingService.processAudioChunk(chunk);
      }

      const adaptiveStats = streamingService.getAdaptiveStatistics();
      expect(adaptiveStats.bufferAdjustments).to.be.greaterThan(0);
      expect(adaptiveStats.qualityAdjustments).to.be.greaterThan(0);
    });

    it('should optimize buffer size based on performance', async () => {
      const initialBufferSize = streamingService.getConfiguration().bufferSize;

      // Process audio with performance monitoring
      for (let i = 0; i < 20; i++) {
        const chunk = new Float32Array(1024);
        await streamingService.processAudioChunk(chunk);
      }

      const optimizedBufferSize = streamingService.getConfiguration().bufferSize;
      const optimizationStats = streamingService.getOptimizationStatistics();

      expect(optimizationStats.bufferOptimizations).to.be.greaterThan(0);
      // Buffer size may have been adjusted based on performance
      expect(optimizedBufferSize).to.be.greaterThan(0);
    });
  });

  describe('Quality Control', () => {
    beforeEach(async () => {
      await streamingService.initialize();
      streamingService.setWebRTCService(mockWebRTCService);
      await streamingService.startStreaming({ enableQualityControl: true });
    });

    it('should monitor streaming quality', async () => {
      const audioData = new Float32Array(1024);
      await streamingService.processAudioChunk(audioData);

      const qualityMetrics = streamingService.getQualityMetrics();
      expect(qualityMetrics.overallQuality).to.be.greaterThan(0);
      expect(qualityMetrics.audioQuality).to.be.greaterThan(0);
      expect(qualityMetrics.networkQuality).to.be.greaterThan(0);
      expect(qualityMetrics.streamingEfficiency).to.be.greaterThan(0);
    });

    it('should adapt quality based on network conditions', async () => {
      // Simulate poor network conditions
      mockWebRTCService.getConnectionStats.resolves({
        latency: 300,
        bandwidth: 200,
        packetLoss: 0.1,
        jitter: 50,
      });

      const audioData = new Float32Array(1024);
      const result = await streamingService.processAudioChunk(audioData);

      expect(result.qualityAdjusted).to.be.true;
      expect(result.adaptiveChanges).to.exist;
      expect(result.adaptiveChanges.length).to.be.greaterThan(0);
    });

    it('should detect quality degradation', async () => {
      let qualityAlertTriggered = false;
      streamingService.on('qualityAlert', () => {
        qualityAlertTriggered = true;
      });

      // Simulate poor audio quality
      mockAudioProcessor.processChunk.resolves({
        processedAudio: new Float32Array(1024),
        quality: 0.3, // Low quality
        features: {
          volume: 0.1,
          clarity: 0.2,
        },
      });

      const audioData = new Float32Array(1024);
      await streamingService.processAudioChunk(audioData);

      // Wait for quality analysis
      await TestUtils.wait(100);

      expect(qualityAlertTriggered).to.be.true;

      const qualityReport = streamingService.getQualityReport();
      expect(qualityReport.degradationDetected).to.be.true;
      expect(qualityReport.affectedMetrics).to.include('audioQuality');
    });

    it('should provide quality improvement recommendations', async () => {
      // Process with suboptimal conditions
      const audioData = new Float32Array(1024);
      await streamingService.processAudioChunk(audioData);

      const recommendations = streamingService.getQualityRecommendations();
      expect(recommendations).to.be.an('array');

      if (recommendations.length > 0) {
        expect(recommendations[0]).to.have.property('category');
        expect(recommendations[0]).to.have.property('suggestion');
        expect(recommendations[0]).to.have.property('priority');
        expect(recommendations[0]).to.have.property('expectedImprovement');
      }
    });
  });

  describe('Performance Monitoring', () => {
    beforeEach(async () => {
      await streamingService.initialize();
      streamingService.setAudioProcessor(mockAudioProcessor);
      streamingService.setWebRTCService(mockWebRTCService);
      await streamingService.startStreaming({ enablePerformanceMonitoring: true });
    });

    it('should track performance metrics', async () => {
      // Process multiple chunks
      for (let i = 0; i < 10; i++) {
        const chunk = new Float32Array(1024);
        chunk.fill(Math.random());
        await streamingService.processAudioChunk(chunk);
      }

      const performanceMetrics = streamingService.getPerformanceMetrics();
      expect(performanceMetrics.averageLatency).to.be.greaterThan(0);
      expect(performanceMetrics.throughput).to.be.greaterThan(0);
      expect(performanceMetrics.cpuUsage).to.be.greaterThan(0);
      expect(performanceMetrics.memoryUsage).to.be.greaterThan(0);
    });

    it('should detect performance bottlenecks', async () => {
      // Simulate slow processing
      mockAudioProcessor.processChunk.callsFake(async () => {
        await TestUtils.wait(200); // Slow processing
        return {
          processedAudio: new Float32Array(1024),
          quality: 0.9,
        };
      });

      const audioData = new Float32Array(1024);
      const startTime = Date.now();

      await streamingService.processAudioChunk(audioData);

      const processingTime = Date.now() - startTime;
      expect(processingTime).to.be.greaterThan(150);

      const bottlenecks = streamingService.getPerformanceBottlenecks();
      expect(bottlenecks).to.be.an('array');
      expect(bottlenecks.length).to.be.greaterThan(0);
      expect(bottlenecks[0].component).to.equal('audioProcessor');
    });

    it('should optimize performance automatically', async () => {
      const performanceMonitor = streamingService.getPerformanceMonitor();

      // Process audio to trigger optimization analysis
      for (let i = 0; i < 15; i++) {
        const chunk = new Float32Array(1024);
        await streamingService.processAudioChunk(chunk);
      }

      const optimizations = performanceMonitor.getAppliedOptimizations();
      expect(optimizations).to.be.an('array');

      if (optimizations.length > 0) {
        expect(optimizations[0]).to.have.property('type');
        expect(optimizations[0]).to.have.property('impact');
        expect(optimizations[0]).to.have.property('appliedAt');
      }
    });

    it('should provide real-time performance dashboard', async () => {
      // Process some chunks
      for (let i = 0; i < 5; i++) {
        const chunk = new Float32Array(1024);
        await streamingService.processAudioChunk(chunk);
      }

      const dashboard = streamingService.getPerformanceDashboard();
      expect(dashboard.realTimeMetrics).to.exist;
      expect(dashboard.historicalData).to.exist;
      expect(dashboard.alerts).to.be.an('array');
      expect(dashboard.recommendations).to.be.an('array');
    });
  });

  describe('Adaptive Algorithms', () => {
    beforeEach(async () => {
      await streamingService.initialize();
      streamingService.setWebRTCService(mockWebRTCService);
      await streamingService.startStreaming({ enableAdaptiveAlgorithms: true });
    });

    it('should adapt to changing network conditions', async () => {
      const adaptiveAlgorithm = streamingService.getAdaptiveAlgorithm();

      // Simulate changing network conditions
      const networkConditions = [
        { latency: 50, bandwidth: 1000, packetLoss: 0.01 },
        { latency: 150, bandwidth: 500, packetLoss: 0.03 },
        { latency: 300, bandwidth: 200, packetLoss: 0.08 },
        { latency: 100, bandwidth: 800, packetLoss: 0.02 },
      ];

      for (let i = 0; i < networkConditions.length; i++) {
        mockWebRTCService.getConnectionStats.resolves(networkConditions[i]);

        const chunk = new Float32Array(1024);
        const result = await streamingService.processAudioChunk(chunk);

        if (i > 0) {
          expect(result.adaptiveAdjustments).to.exist;
        }
      }

      const adaptationStats = adaptiveAlgorithm.getStatistics();
      expect(adaptationStats.totalAdaptations).to.be.greaterThan(0);
      expect(adaptationStats.networkAdaptations).to.be.greaterThan(0);
    });

    it('should optimize buffer size dynamically', async () => {
      const initialBufferSize = streamingService.getConfiguration().bufferSize;

      // Simulate varying processing loads
      for (let i = 0; i < 20; i++) {
        const chunk = new Float32Array(1024);

        // Vary processing complexity
        if (i % 5 === 0) {
          mockAudioProcessor.processChunk.callsFake(async () => {
            await TestUtils.wait(100); // Simulate heavy processing
            return { processedAudio: new Float32Array(1024), quality: 0.9 };
          });
        } else {
          mockAudioProcessor.processChunk.resolves({
            processedAudio: new Float32Array(1024),
            quality: 0.9,
          });
        }

        await streamingService.processAudioChunk(chunk);
      }

      const finalBufferSize = streamingService.getConfiguration().bufferSize;
      const adaptationStats = streamingService.getAdaptationStatistics();

      expect(adaptationStats.bufferSizeChanges).to.be.greaterThan(0);
      // Buffer size should have been optimized
      expect(Math.abs(finalBufferSize - initialBufferSize)).to.be.greaterThan(0);
    });

    it('should balance latency and quality', async () => {
      // Set conflicting requirements
      streamingService.updateConfiguration({
        streaming: {
          targetLatency: 50, // Low latency
          qualityThreshold: 0.9, // High quality
        },
      });

      const audioData = new Float32Array(1024);
      const result = await streamingService.processAudioChunk(audioData);

      expect(result.latencyQualityBalance).to.exist;
      expect(result.tradeoffDecisions).to.be.an('array');

      const balanceStats = streamingService.getLatencyQualityBalance();
      expect(balanceStats.currentLatency).to.be.greaterThan(0);
      expect(balanceStats.currentQuality).to.be.greaterThan(0);
      expect(balanceStats.balanceScore).to.be.greaterThan(0);
    });

    it('should learn from historical performance', async () => {
      const adaptiveAlgorithm = streamingService.getAdaptiveAlgorithm();

      // Process multiple chunks to build history
      for (let i = 0; i < 30; i++) {
        const chunk = new Float32Array(1024);
        await streamingService.processAudioChunk(chunk);
      }

      const learningStats = adaptiveAlgorithm.getLearningStatistics();
      expect(learningStats.historicalDataPoints).to.be.greaterThan(20);
      expect(learningStats.patternRecognition).to.exist;
      expect(learningStats.predictionAccuracy).to.be.greaterThan(0);
    });
  });

  describe('Error Handling and Recovery', () => {
    beforeEach(async () => {
      await streamingService.initialize();
      streamingService.setAudioProcessor(mockAudioProcessor);
      streamingService.setWebRTCService(mockWebRTCService);
    });

    it('should handle streaming errors gracefully', async () => {
      await streamingService.startStreaming({ enableErrorRecovery: true });

      // Simulate WebRTC transmission failure
      mockWebRTCService.sendAudioChunk.rejects(new Error('Network transmission failed'));

      const audioData = new Float32Array(1024);
      const result = await streamingService.processAudioChunk(audioData);

      expect(result.error).to.be.true;
      expect(result.componentFailure).to.equal('webrtcService');
      expect(result.recoveryAttempted).to.be.true;
    });

    it('should implement fallback streaming modes', async () => {
      await streamingService.startStreaming({ enableFallback: true });

      // Simulate audio processor failure
      mockAudioProcessor.processChunk.rejects(new Error('Audio processing failed'));

      const audioData = new Float32Array(1024);
      const result = await streamingService.processAudioChunk(audioData);

      expect(result.fallbackMode).to.be.true;
      expect(result.fallbackType).to.exist;
      expect(result.rawAudioStreamed).to.be.true;
    });

    it('should recover from temporary network issues', async () => {
      await streamingService.startStreaming({ enableErrorRecovery: true });

      // Simulate temporary network failure followed by recovery
      mockWebRTCService.sendAudioChunk
        .onFirstCall()
        .rejects(new Error('Network timeout'))
        .onSecondCall()
        .resolves();

      const audioData = new Float32Array(1024);

      // First call should fail and trigger recovery
      const result1 = await streamingService.processAudioChunk(audioData);
      expect(result1.error).to.be.true;

      // Second call should succeed
      const result2 = await streamingService.processAudioChunk(audioData);
      expect(result2.success).to.be.true;
      expect(result2.recoveredFromError).to.be.true;
    });

    it('should maintain streaming continuity during errors', async () => {
      await streamingService.startStreaming({ enableContinuity: true });

      let continuityMaintained = true;
      streamingService.on('streamingInterrupted', () => {
        continuityMaintained = false;
      });

      // Simulate intermittent errors
      mockWebRTCService.sendAudioChunk
        .onCall(0)
        .resolves()
        .onCall(1)
        .rejects(new Error('Temporary error'))
        .onCall(2)
        .resolves()
        .onCall(3)
        .resolves();

      // Process multiple chunks
      for (let i = 0; i < 4; i++) {
        const chunk = new Float32Array(1024);
        await streamingService.processAudioChunk(chunk);
      }

      expect(continuityMaintained).to.be.true;

      const continuityStats = streamingService.getContinuityStatistics();
      expect(continuityStats.uptime).to.be.greaterThan(0.8);
    });
  });

  describe('Configuration Management', () => {
    beforeEach(async () => {
      await streamingService.initialize();
    });

    it('should update streaming configuration dynamically', async () => {
      await streamingService.startStreaming();

      const newConfig = {
        streaming: {
          bufferSize: 8192,
          chunkSize: 2048,
          qualityThreshold: 0.9,
        },
        network: {
          maxBandwidth: 2000,
          enableCompression: false,
        },
      };

      streamingService.updateConfiguration(newConfig);

      const currentConfig = streamingService.getConfiguration();
      expect(currentConfig.streaming.bufferSize).to.equal(8192);
      expect(currentConfig.streaming.chunkSize).to.equal(2048);
      expect(currentConfig.network.maxBandwidth).to.equal(2000);
      expect(currentConfig.network.enableCompression).to.be.false;
    });

    it('should validate configuration changes', async () => {
      const invalidConfig = {
        streaming: {
          bufferSize: -1,
          chunkSize: 0,
          sampleRate: -16000,
        },
      };

      expect(() => {
        streamingService.updateConfiguration(invalidConfig);
      }).to.throw('Invalid streaming configuration');
    });

    it('should apply configuration changes to active streaming', async () => {
      await streamingService.startStreaming();

      // Change configuration during streaming
      streamingService.updateConfiguration({
        streaming: { chunkSize: 2048 },
      });

      const audioData = new Float32Array(4096); // Larger than new chunk size
      const result = await streamingService.processAudioChunk(audioData);

      expect(result.configurationApplied).to.be.true;
      expect(result.chunksCreated).to.equal(2); // Should be split into 2 chunks
    });
  });

  describe('Statistics and Reporting', () => {
    beforeEach(async () => {
      await streamingService.initialize();
      streamingService.setAudioProcessor(mockAudioProcessor);
      streamingService.setWebRTCService(mockWebRTCService);
      await streamingService.startStreaming({ enableStatistics: true });
    });

    it('should track comprehensive streaming statistics', async () => {
      // Process multiple chunks
      for (let i = 0; i < 15; i++) {
        const chunk = new Float32Array(1024);
        chunk.fill(Math.random());
        await streamingService.processAudioChunk(chunk);
      }

      const stats = streamingService.getStatistics();
      expect(stats.totalChunksProcessed).to.equal(15);
      expect(stats.totalDataStreamed).to.be.greaterThan(0);
      expect(stats.averageLatency).to.be.greaterThan(0);
      expect(stats.throughput).to.be.greaterThan(0);
      expect(stats.errorRate).to.be.lessThan(1);
    });

    it('should provide detailed performance breakdown', async () => {
      const audioData = new Float32Array(1024);
      await streamingService.processAudioChunk(audioData);

      const breakdown = streamingService.getPerformanceBreakdown();
      expect(breakdown.audioProcessing).to.be.greaterThan(0);
      expect(breakdown.buffering).to.be.greaterThan(0);
      expect(breakdown.networkTransmission).to.be.greaterThan(0);
      expect(breakdown.qualityControl).to.be.greaterThanOrEqual(0);
    });

    it('should generate streaming reports', async () => {
      // Process some data
      for (let i = 0; i < 10; i++) {
        const chunk = new Float32Array(1024);
        await streamingService.processAudioChunk(chunk);
      }

      const report = streamingService.generateStreamingReport();
      expect(report.summary).to.exist;
      expect(report.performanceMetrics).to.exist;
      expect(report.qualityMetrics).to.exist;
      expect(report.recommendations).to.be.an('array');
      expect(report.generatedAt).to.be.a('date');
    });

    it('should monitor resource usage', async () => {
      // Process some data
      for (let i = 0; i < 8; i++) {
        const chunk = new Float32Array(1024);
        await streamingService.processAudioChunk(chunk);
      }

      const resourceUsage = streamingService.getResourceUsage();
      expect(resourceUsage.memoryUsage).to.be.greaterThan(0);
      expect(resourceUsage.cpuUsage).to.be.greaterThan(0);
      expect(resourceUsage.networkUsage).to.be.greaterThan(0);
      expect(resourceUsage.bufferUtilization).to.be.greaterThan(0);
    });
  });

  describe('Cleanup and Resource Management', () => {
    it('should cleanup streaming resources properly', async () => {
      await streamingService.initialize();
      await streamingService.startStreaming();

      // Process some data
      const chunk = new Float32Array(1024);
      await streamingService.processAudioChunk(chunk);

      // Cleanup
      await streamingService.cleanup();

      expect(streamingService.isInitialized).to.be.false;
      expect(streamingService.isStreaming).to.be.false;

      const status = streamingService.getStatus();
      expect(status.status).to.equal('cleaned');
    });

    it('should handle cleanup during active streaming', async () => {
      await streamingService.initialize();
      await streamingService.startStreaming();

      // Start streaming and cleanup immediately
      const streamingPromise = streamingService.processAudioChunk(new Float32Array(1024));
      const cleanupPromise = streamingService.cleanup();

      await Promise.all([streamingPromise, cleanupPromise]);

      expect(streamingService.isStreaming).to.be.false;
    });

    it('should release all allocated resources', async () => {
      await streamingService.initialize();
      await streamingService.startStreaming();

      const initialStats = streamingService.getResourceUsage();
      expect(initialStats.memoryUsage).to.be.greaterThan(0);

      await streamingService.cleanup();

      const finalStats = streamingService.getResourceUsage();
      expect(finalStats.memoryUsage).to.equal(0);
      expect(finalStats.activeBuffers).to.equal(0);
      expect(finalStats.activeConnections).to.equal(0);
    });

    it('should stop all background processes', async () => {
      await streamingService.initialize();
      await streamingService.startStreaming({ enableBackgroundProcessing: true });

      const backgroundProcesses = streamingService.getBackgroundProcesses();
      expect(backgroundProcesses.length).to.be.greaterThan(0);

      await streamingService.cleanup();

      const remainingProcesses = streamingService.getBackgroundProcesses();
      expect(remainingProcesses.length).to.equal(0);
    });
  });
});
