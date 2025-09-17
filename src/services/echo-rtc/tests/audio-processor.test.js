import { expect } from 'chai';
import sinon from 'sinon';
import { EventEmitter } from 'events';
import { EchoRTCAudioProcessor } from '../audio-processor.js';
import { testConfig, TestUtils } from './test-config.js';

describe('EchoRTCAudioProcessor Integration Tests', () => {
  let audioProcessor;
  let mockConfig;
  let mockWebRTCService;
  let mockTranslationService;
  let sandbox;

  beforeEach(async () => {
    sandbox = sinon.createSandbox();

    // Create test configuration
    mockConfig = TestUtils.createTestConfig({
      audio: {
        sampleRate: 16000,
        channels: 1,
        bitDepth: 16,
        bufferSize: 1024,
        enableNoiseReduction: true,
        enableEchoCancellation: true,
        enableAutoGainControl: true,
        qualityThreshold: 0.8,
      },
      processing: {
        chunkSize: 1024,
        maxBufferSize: 8192,
        processingTimeout: 5000,
        enableRealTimeProcessing: true,
      },
    });

    // Mock WebRTC service
    mockWebRTCService = {
      isConnected: true,
      sendAudioData: sandbox.stub().resolves(),
      getConnectionStats: sandbox.stub().resolves({
        latency: 50,
        jitter: 5,
        packetLoss: 0.1,
      }),
      on: sandbox.stub(),
      emit: sandbox.stub(),
    };

    // Mock translation service
    mockTranslationService = {
      processAudio: sandbox.stub().resolves({
        text: 'Hello world',
        confidence: 0.95,
        language: 'en',
      }),
      isReady: true,
      on: sandbox.stub(),
      emit: sandbox.stub(),
    };

    // Create audio processor instance
    audioProcessor = new EchoRTCAudioProcessor(mockConfig);

    // Setup WebRTC mock
    TestUtils.setupWebRTCMocks();
  });

  afterEach(async () => {
    if (audioProcessor) {
      await audioProcessor.cleanup();
    }
    TestUtils.cleanupWebRTCMocks();
    sandbox.restore();
  });

  describe('Initialization', () => {
    it('should initialize audio processor successfully', async () => {
      const initPromise = audioProcessor.initialize();

      await expect(initPromise).to.be.fulfilled;
      expect(audioProcessor.isInitialized).to.be.true;
      expect(audioProcessor.getStatus().status).to.equal('ready');
    });

    it('should setup audio context and processing pipeline', async () => {
      await audioProcessor.initialize();

      const status = audioProcessor.getStatus();
      expect(status.audioContext).to.exist;
      expect(status.processingPipeline).to.exist;
      expect(status.bufferManager).to.exist;
    });

    it('should configure audio processing parameters', async () => {
      await audioProcessor.initialize();

      const config = audioProcessor.getConfiguration();
      expect(config.sampleRate).to.equal(16000);
      expect(config.channels).to.equal(1);
      expect(config.bufferSize).to.equal(1024);
      expect(config.enableNoiseReduction).to.be.true;
    });

    it('should handle initialization errors gracefully', async () => {
      // Mock initialization failure
      const originalCreateAudioContext = audioProcessor._createAudioContext;
      audioProcessor._createAudioContext = sandbox
        .stub()
        .throws(new Error('AudioContext creation failed'));

      await expect(audioProcessor.initialize()).to.be.rejectedWith('AudioContext creation failed');
      expect(audioProcessor.isInitialized).to.be.false;

      // Restore original method
      audioProcessor._createAudioContext = originalCreateAudioContext;
    });
  });

  describe('Audio Processing', () => {
    beforeEach(async () => {
      await audioProcessor.initialize();
    });

    it('should start audio processing successfully', async () => {
      const processingConfig = {
        inputSource: 'microphone',
        enableRealTime: true,
        qualityMonitoring: true,
      };

      await audioProcessor.startProcessing(processingConfig);

      expect(audioProcessor.isProcessing).to.be.true;
      expect(audioProcessor.getStatus().status).to.equal('processing');
    });

    it('should process audio chunks correctly', async () => {
      await audioProcessor.startProcessing({ enableRealTime: true });

      // Create mock audio data
      const audioData = new Float32Array(1024);
      for (let i = 0; i < audioData.length; i++) {
        audioData[i] = Math.sin((2 * Math.PI * 440 * i) / 16000); // 440Hz sine wave
      }

      const processPromise = audioProcessor.processAudioChunk(audioData);
      await expect(processPromise).to.be.fulfilled;

      const stats = audioProcessor.getStatistics();
      expect(stats.chunksProcessed).to.be.greaterThan(0);
      expect(stats.totalProcessingTime).to.be.greaterThan(0);
    });

    it('should handle real-time audio streaming', async () => {
      const streamingConfig = {
        enableRealTime: true,
        streamingMode: 'continuous',
        bufferSize: 2048,
      };

      await audioProcessor.startProcessing(streamingConfig);

      // Simulate continuous audio chunks
      const chunks = [];
      for (let i = 0; i < 5; i++) {
        const chunk = new Float32Array(1024);
        chunk.fill(Math.random() * 0.1); // Random audio data
        chunks.push(chunk);
      }

      // Process chunks in sequence
      for (const chunk of chunks) {
        await audioProcessor.processAudioChunk(chunk);
      }

      const stats = audioProcessor.getStatistics();
      expect(stats.chunksProcessed).to.equal(5);
      expect(stats.streamingStats.continuousChunks).to.equal(5);
    });

    it('should apply audio enhancements correctly', async () => {
      const enhancementConfig = {
        enableNoiseReduction: true,
        enableEchoCancellation: true,
        enableAutoGainControl: true,
        gainLevel: 1.5,
      };

      await audioProcessor.startProcessing(enhancementConfig);

      // Create noisy audio data
      const noisyAudio = new Float32Array(1024);
      for (let i = 0; i < noisyAudio.length; i++) {
        noisyAudio[i] = Math.sin((2 * Math.PI * 440 * i) / 16000) + Math.random() * 0.1;
      }

      const result = await audioProcessor.processAudioChunk(noisyAudio);

      expect(result.enhanced).to.be.true;
      expect(result.noiseReduced).to.be.true;
      expect(result.echoCancelled).to.be.true;
      expect(result.gainAdjusted).to.be.true;
    });

    it('should stop audio processing cleanly', async () => {
      await audioProcessor.startProcessing({ enableRealTime: true });
      expect(audioProcessor.isProcessing).to.be.true;

      await audioProcessor.stopProcessing();

      expect(audioProcessor.isProcessing).to.be.false;
      expect(audioProcessor.getStatus().status).to.equal('ready');
    });
  });

  describe('Buffer Management', () => {
    beforeEach(async () => {
      await audioProcessor.initialize();
      await audioProcessor.startProcessing({ enableBuffering: true });
    });

    it('should manage audio buffers efficiently', async () => {
      const bufferManager = audioProcessor.getBufferManager();

      // Add audio chunks to buffer
      for (let i = 0; i < 10; i++) {
        const chunk = new Float32Array(1024);
        chunk.fill(i * 0.1);
        await audioProcessor.processAudioChunk(chunk);
      }

      const bufferStats = bufferManager.getStatistics();
      expect(bufferStats.totalBuffers).to.be.greaterThan(0);
      expect(bufferStats.bufferUtilization).to.be.lessThan(1.0);
    });

    it('should handle buffer overflow gracefully', async () => {
      const bufferManager = audioProcessor.getBufferManager();

      // Fill buffer beyond capacity
      const largeChunk = new Float32Array(16384); // Larger than max buffer size
      largeChunk.fill(0.5);

      const result = await audioProcessor.processAudioChunk(largeChunk);

      expect(result.bufferOverflow).to.be.true;
      expect(result.handled).to.be.true;

      const stats = bufferManager.getStatistics();
      expect(stats.overflowEvents).to.be.greaterThan(0);
    });

    it('should optimize buffer usage based on performance', async () => {
      const bufferManager = audioProcessor.getBufferManager();

      // Simulate high-performance scenario
      audioProcessor.updateConfiguration({
        processing: {
          adaptiveBuffering: true,
          performanceMode: 'high',
        },
      });

      // Process several chunks
      for (let i = 0; i < 5; i++) {
        const chunk = new Float32Array(1024);
        await audioProcessor.processAudioChunk(chunk);
      }

      const optimization = bufferManager.getOptimizationStats();
      expect(optimization.adaptiveAdjustments).to.be.greaterThan(0);
    });
  });

  describe('Quality Monitoring', () => {
    beforeEach(async () => {
      await audioProcessor.initialize();
      await audioProcessor.startProcessing({ qualityMonitoring: true });
    });

    it('should monitor audio quality metrics', async () => {
      // Process audio with varying quality
      const highQualityAudio = new Float32Array(1024);
      for (let i = 0; i < highQualityAudio.length; i++) {
        highQualityAudio[i] = Math.sin((2 * Math.PI * 440 * i) / 16000);
      }

      await audioProcessor.processAudioChunk(highQualityAudio);

      const qualityMetrics = audioProcessor.getQualityMetrics();
      expect(qualityMetrics.signalToNoiseRatio).to.be.greaterThan(10);
      expect(qualityMetrics.clarity).to.be.greaterThan(0.7);
      expect(qualityMetrics.distortion).to.be.lessThan(0.1);
    });

    it('should detect quality degradation', async () => {
      let qualityAlertTriggered = false;
      audioProcessor.on('qualityAlert', () => {
        qualityAlertTriggered = true;
      });

      // Process low-quality audio
      const lowQualityAudio = new Float32Array(1024);
      for (let i = 0; i < lowQualityAudio.length; i++) {
        lowQualityAudio[i] = Math.random() * 2 - 1; // Random noise
      }

      await audioProcessor.processAudioChunk(lowQualityAudio);

      // Wait for quality analysis
      await TestUtils.wait(100);

      expect(qualityAlertTriggered).to.be.true;

      const qualityMetrics = audioProcessor.getQualityMetrics();
      expect(qualityMetrics.overallScore).to.be.lessThan(0.5);
    });

    it('should provide quality optimization recommendations', async () => {
      // Process suboptimal audio
      const suboptimalAudio = new Float32Array(1024);
      for (let i = 0; i < suboptimalAudio.length; i++) {
        suboptimalAudio[i] = Math.sin((2 * Math.PI * 440 * i) / 16000) * 0.1; // Low amplitude
      }

      await audioProcessor.processAudioChunk(suboptimalAudio);

      const recommendations = audioProcessor.getQualityRecommendations();
      expect(recommendations).to.be.an('array');
      expect(recommendations.length).to.be.greaterThan(0);
      expect(recommendations[0]).to.have.property('type');
      expect(recommendations[0]).to.have.property('suggestion');
    });
  });

  describe('WebRTC Integration', () => {
    beforeEach(async () => {
      await audioProcessor.initialize();
      audioProcessor.setWebRTCService(mockWebRTCService);
    });

    it('should integrate with WebRTC service for audio transmission', async () => {
      await audioProcessor.startProcessing({ webrtcIntegration: true });

      const audioData = new Float32Array(1024);
      audioData.fill(0.5);

      await audioProcessor.processAudioChunk(audioData);

      expect(mockWebRTCService.sendAudioData.calledOnce).to.be.true;
      const sentData = mockWebRTCService.sendAudioData.getCall(0).args[0];
      expect(sentData).to.be.instanceOf(ArrayBuffer);
    });

    it('should handle WebRTC connection status changes', async () => {
      let connectionStatusChanged = false;
      audioProcessor.on('webrtcStatusChanged', () => {
        connectionStatusChanged = true;
      });

      // Simulate connection loss
      mockWebRTCService.isConnected = false;
      audioProcessor._handleWebRTCStatusChange('disconnected');

      expect(connectionStatusChanged).to.be.true;
      expect(audioProcessor.getStatus().webrtcConnected).to.be.false;
    });

    it('should adapt processing based on network conditions', async () => {
      // Simulate poor network conditions
      mockWebRTCService.getConnectionStats.resolves({
        latency: 200,
        jitter: 50,
        packetLoss: 5.0,
      });

      await audioProcessor.startProcessing({ adaptiveProcessing: true });

      // Process audio chunk
      const audioData = new Float32Array(1024);
      await audioProcessor.processAudioChunk(audioData);

      const adaptations = audioProcessor.getNetworkAdaptations();
      expect(adaptations.qualityReduced).to.be.true;
      expect(adaptations.bufferSizeAdjusted).to.be.true;
    });
  });

  describe('Translation Service Integration', () => {
    beforeEach(async () => {
      await audioProcessor.initialize();
      audioProcessor.setTranslationService(mockTranslationService);
    });

    it('should integrate with translation service for audio processing', async () => {
      await audioProcessor.startProcessing({ translationIntegration: true });

      const audioData = new Float32Array(1024);
      for (let i = 0; i < audioData.length; i++) {
        audioData[i] = Math.sin((2 * Math.PI * 440 * i) / 16000);
      }

      const result = await audioProcessor.processAudioChunk(audioData);

      expect(mockTranslationService.processAudio.calledOnce).to.be.true;
      expect(result.translationResult).to.exist;
      expect(result.translationResult.text).to.equal('Hello world');
    });

    it('should handle translation service errors gracefully', async () => {
      mockTranslationService.processAudio.rejects(new Error('Translation service unavailable'));

      await audioProcessor.startProcessing({ translationIntegration: true });

      const audioData = new Float32Array(1024);
      const result = await audioProcessor.processAudioChunk(audioData);

      expect(result.translationError).to.be.true;
      expect(result.fallbackProcessing).to.be.true;
    });

    it('should optimize audio for translation accuracy', async () => {
      await audioProcessor.startProcessing({
        translationIntegration: true,
        optimizeForTranslation: true,
      });

      const speechAudio = new Float32Array(1024);
      // Simulate speech-like audio pattern
      for (let i = 0; i < speechAudio.length; i++) {
        speechAudio[i] = Math.sin((2 * Math.PI * 200 * i) / 16000) * Math.exp(-i / 500);
      }

      const result = await audioProcessor.processAudioChunk(speechAudio);

      expect(result.optimizedForSpeech).to.be.true;
      expect(result.speechEnhanced).to.be.true;
    });
  });

  describe('Performance and Statistics', () => {
    beforeEach(async () => {
      await audioProcessor.initialize();
      await audioProcessor.startProcessing({ enableStatistics: true });
    });

    it('should track processing performance metrics', async () => {
      // Process multiple chunks
      for (let i = 0; i < 10; i++) {
        const chunk = new Float32Array(1024);
        chunk.fill(Math.random());
        await audioProcessor.processAudioChunk(chunk);
      }

      const stats = audioProcessor.getStatistics();
      expect(stats.chunksProcessed).to.equal(10);
      expect(stats.averageProcessingTime).to.be.greaterThan(0);
      expect(stats.throughput).to.be.greaterThan(0);
      expect(stats.cpuUsage).to.be.greaterThan(0);
    });

    it('should provide detailed performance breakdown', async () => {
      const chunk = new Float32Array(1024);
      await audioProcessor.processAudioChunk(chunk);

      const breakdown = audioProcessor.getPerformanceBreakdown();
      expect(breakdown.preprocessing).to.be.greaterThan(0);
      expect(breakdown.enhancement).to.be.greaterThan(0);
      expect(breakdown.analysis).to.be.greaterThan(0);
      expect(breakdown.postprocessing).to.be.greaterThan(0);
    });

    it('should detect performance bottlenecks', async () => {
      // Simulate heavy processing load
      const heavyProcessingConfig = {
        enableAllEnhancements: true,
        qualityAnalysisDepth: 'detailed',
        bufferSize: 4096,
      };

      audioProcessor.updateConfiguration(heavyProcessingConfig);

      const largeChunk = new Float32Array(4096);
      largeChunk.fill(Math.random());

      const startTime = Date.now();
      await audioProcessor.processAudioChunk(largeChunk);
      const processingTime = Date.now() - startTime;

      const bottlenecks = audioProcessor.getPerformanceBottlenecks();
      expect(bottlenecks).to.be.an('array');

      if (processingTime > 100) {
        expect(bottlenecks.length).to.be.greaterThan(0);
      }
    });
  });

  describe('Error Handling and Recovery', () => {
    beforeEach(async () => {
      await audioProcessor.initialize();
    });

    it('should handle processing errors gracefully', async () => {
      await audioProcessor.startProcessing({ enableErrorRecovery: true });

      // Simulate processing error by passing invalid data
      const invalidData = null;

      const result = await audioProcessor.processAudioChunk(invalidData);

      expect(result.error).to.be.true;
      expect(result.recovered).to.be.true;
      expect(audioProcessor.isProcessing).to.be.true; // Should still be processing
    });

    it('should recover from buffer overflow conditions', async () => {
      await audioProcessor.startProcessing({ enableErrorRecovery: true });

      // Simulate buffer overflow
      const oversizedChunk = new Float32Array(32768); // Much larger than buffer
      oversizedChunk.fill(0.5);

      const result = await audioProcessor.processAudioChunk(oversizedChunk);

      expect(result.bufferOverflow).to.be.true;
      expect(result.recoveryAction).to.exist;
      expect(audioProcessor.getStatus().status).to.equal('processing');
    });

    it('should handle service disconnections', async () => {
      audioProcessor.setWebRTCService(mockWebRTCService);
      await audioProcessor.startProcessing({ webrtcIntegration: true });

      // Simulate service disconnection
      mockWebRTCService.isConnected = false;
      mockWebRTCService.sendAudioData.rejects(new Error('Connection lost'));

      const audioData = new Float32Array(1024);
      const result = await audioProcessor.processAudioChunk(audioData);

      expect(result.serviceDisconnected).to.be.true;
      expect(result.fallbackMode).to.be.true;
    });

    it('should provide comprehensive error reporting', async () => {
      await audioProcessor.startProcessing({ enableErrorReporting: true });

      // Trigger various error conditions
      await audioProcessor.processAudioChunk(null); // Invalid data
      await audioProcessor.processAudioChunk(new Float32Array(0)); // Empty data

      const errorReport = audioProcessor.getErrorReport();
      expect(errorReport.totalErrors).to.be.greaterThan(0);
      expect(errorReport.errorTypes).to.be.an('array');
      expect(errorReport.recoveryActions).to.be.an('array');
    });
  });

  describe('Configuration Management', () => {
    beforeEach(async () => {
      await audioProcessor.initialize();
    });

    it('should update configuration dynamically', async () => {
      await audioProcessor.startProcessing();

      const newConfig = {
        audio: {
          sampleRate: 22050,
          enableNoiseReduction: false,
        },
        processing: {
          chunkSize: 2048,
        },
      };

      audioProcessor.updateConfiguration(newConfig);

      const currentConfig = audioProcessor.getConfiguration();
      expect(currentConfig.audio.sampleRate).to.equal(22050);
      expect(currentConfig.audio.enableNoiseReduction).to.be.false;
      expect(currentConfig.processing.chunkSize).to.equal(2048);
    });

    it('should validate configuration changes', async () => {
      const invalidConfig = {
        audio: {
          sampleRate: -1, // Invalid sample rate
          channels: 0, // Invalid channel count
        },
      };

      expect(() => {
        audioProcessor.updateConfiguration(invalidConfig);
      }).to.throw('Invalid configuration');
    });

    it('should apply configuration changes to active processing', async () => {
      await audioProcessor.startProcessing();

      // Change buffer size during processing
      audioProcessor.updateConfiguration({
        processing: { chunkSize: 2048 },
      });

      const chunk = new Float32Array(2048);
      const result = await audioProcessor.processAudioChunk(chunk);

      expect(result.configurationApplied).to.be.true;
      expect(result.chunkSize).to.equal(2048);
    });
  });

  describe('Cleanup and Resource Management', () => {
    it('should cleanup resources properly', async () => {
      await audioProcessor.initialize();
      await audioProcessor.startProcessing();

      // Process some data
      const chunk = new Float32Array(1024);
      await audioProcessor.processAudioChunk(chunk);

      // Cleanup
      await audioProcessor.cleanup();

      expect(audioProcessor.isInitialized).to.be.false;
      expect(audioProcessor.isProcessing).to.be.false;

      const status = audioProcessor.getStatus();
      expect(status.status).to.equal('cleaned');
    });

    it('should handle cleanup during active processing', async () => {
      await audioProcessor.initialize();
      await audioProcessor.startProcessing();

      // Start processing and cleanup immediately
      const processingPromise = audioProcessor.processAudioChunk(new Float32Array(1024));
      const cleanupPromise = audioProcessor.cleanup();

      await Promise.all([processingPromise, cleanupPromise]);

      expect(audioProcessor.isProcessing).to.be.false;
    });

    it('should release all allocated resources', async () => {
      await audioProcessor.initialize();
      await audioProcessor.startProcessing();

      const initialStats = audioProcessor.getResourceUsage();
      expect(initialStats.memoryUsage).to.be.greaterThan(0);

      await audioProcessor.cleanup();

      const finalStats = audioProcessor.getResourceUsage();
      expect(finalStats.memoryUsage).to.equal(0);
      expect(finalStats.activeBuffers).to.equal(0);
    });
  });
});
