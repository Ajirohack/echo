import { expect } from 'chai';
import sinon from 'sinon';
import { EventEmitter } from 'events';
import { RealTimeTranslationPipeline } from '../realtime-translation-pipeline.js';
import { testConfig, TestUtils } from './test-config.js';

describe('RealTimeTranslationPipeline Integration Tests', () => {
  let pipeline;
  let mockConfig;
  let mockAudioProcessor;
  let mockSpeechRecognition;
  let mockTranslationService;
  let mockSpeechSynthesis;
  let sandbox;

  beforeEach(async () => {
    sandbox = sinon.createSandbox();

    // Create test configuration
    mockConfig = TestUtils.createTestConfig({
      translation: {
        sourceLanguage: 'en',
        targetLanguage: 'es',
        enableRealTime: true,
        bufferSize: 2048,
        processingTimeout: 3000,
        qualityThreshold: 0.8,
      },
      audio: {
        sampleRate: 16000,
        channels: 1,
        enableVAD: true,
      },
      pipeline: {
        enableCaching: true,
        enableOptimization: true,
        maxConcurrentProcessing: 3,
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
      }),
      getQualityMetrics: sandbox.stub().returns({
        signalToNoiseRatio: 15,
        clarity: 0.85,
        speechProbability: 0.9,
      }),
      startProcessing: sandbox.stub().resolves(),
      stopProcessing: sandbox.stub().resolves(),
    });

    // Mock speech recognition service
    mockSpeechRecognition = new EventEmitter();
    Object.assign(mockSpeechRecognition, {
      isReady: true,
      recognize: sandbox.stub().resolves({
        text: 'Hello, how are you today?',
        confidence: 0.95,
        language: 'en',
        alternatives: [
          { text: 'Hello, how are you today?', confidence: 0.95 },
          { text: 'Hello, how are you doing?', confidence: 0.87 },
        ],
      }),
      startContinuousRecognition: sandbox.stub().resolves(),
      stopContinuousRecognition: sandbox.stub().resolves(),
    });

    // Mock translation service
    mockTranslationService = new EventEmitter();
    Object.assign(mockTranslationService, {
      isReady: true,
      translate: sandbox.stub().resolves({
        translatedText: 'Hola, ¿cómo estás hoy?',
        confidence: 0.92,
        sourceLanguage: 'en',
        targetLanguage: 'es',
        alternatives: [
          { text: 'Hola, ¿cómo estás hoy?', confidence: 0.92 },
          { text: 'Hola, ¿cómo te encuentras hoy?', confidence: 0.88 },
        ],
      }),
      detectLanguage: sandbox.stub().resolves({
        language: 'en',
        confidence: 0.98,
      }),
    });

    // Mock speech synthesis service
    mockSpeechSynthesis = new EventEmitter();
    Object.assign(mockSpeechSynthesis, {
      isReady: true,
      synthesize: sandbox.stub().resolves({
        audioData: new ArrayBuffer(8192),
        duration: 2.5,
        quality: 0.9,
        format: 'wav',
      }),
      getVoices: sandbox.stub().returns([
        { id: 'es-female-1', language: 'es', gender: 'female', quality: 'high' },
        { id: 'es-male-1', language: 'es', gender: 'male', quality: 'high' },
      ]),
    });

    // Create pipeline instance
    pipeline = new RealTimeTranslationPipeline(mockConfig);
  });

  afterEach(async () => {
    if (pipeline) {
      await pipeline.cleanup();
    }
    sandbox.restore();
  });

  describe('Initialization', () => {
    it('should initialize pipeline successfully', async () => {
      const initPromise = pipeline.initialize();

      await expect(initPromise).to.be.fulfilled;
      expect(pipeline.isInitialized).to.be.true;
      expect(pipeline.getStatus().status).to.equal('ready');
    });

    it('should setup all pipeline components', async () => {
      await pipeline.initialize();

      const status = pipeline.getStatus();
      expect(status.audioProcessor).to.exist;
      expect(status.speechRecognition).to.exist;
      expect(status.translationService).to.exist;
      expect(status.speechSynthesis).to.exist;
    });

    it('should configure pipeline parameters', async () => {
      await pipeline.initialize();

      const config = pipeline.getConfiguration();
      expect(config.sourceLanguage).to.equal('en');
      expect(config.targetLanguage).to.equal('es');
      expect(config.enableRealTime).to.be.true;
      expect(config.bufferSize).to.equal(2048);
    });

    it('should handle initialization errors gracefully', async () => {
      // Mock component initialization failure
      const originalInitializeComponents = pipeline._initializeComponents;
      pipeline._initializeComponents = sandbox
        .stub()
        .throws(new Error('Component initialization failed'));

      await expect(pipeline.initialize()).to.be.rejectedWith('Component initialization failed');
      expect(pipeline.isInitialized).to.be.false;

      // Restore original method
      pipeline._initializeComponents = originalInitializeComponents;
    });
  });

  describe('Pipeline Processing', () => {
    beforeEach(async () => {
      await pipeline.initialize();
      pipeline.setAudioProcessor(mockAudioProcessor);
      pipeline.setSpeechRecognition(mockSpeechRecognition);
      pipeline.setTranslationService(mockTranslationService);
      pipeline.setSpeechSynthesis(mockSpeechSynthesis);
    });

    it('should start pipeline processing successfully', async () => {
      const pipelineConfig = {
        sourceLanguage: 'en',
        targetLanguage: 'es',
        enableRealTime: true,
        enableContinuous: true,
      };

      await pipeline.startPipeline(pipelineConfig);

      expect(pipeline.isProcessing).to.be.true;
      expect(pipeline.getStatus().status).to.equal('processing');
      expect(mockAudioProcessor.startProcessing.calledOnce).to.be.true;
      expect(mockSpeechRecognition.startContinuousRecognition.calledOnce).to.be.true;
    });

    it('should process complete translation pipeline', async () => {
      await pipeline.startPipeline({
        sourceLanguage: 'en',
        targetLanguage: 'es',
        enableRealTime: true,
      });

      // Create mock audio data
      const audioData = new Float32Array(1024);
      for (let i = 0; i < audioData.length; i++) {
        audioData[i] = Math.sin((2 * Math.PI * 440 * i) / 16000);
      }

      const result = await pipeline.processAudio(audioData);

      expect(result.success).to.be.true;
      expect(result.originalText).to.equal('Hello, how are you today?');
      expect(result.translatedText).to.equal('Hola, ¿cómo estás hoy?');
      expect(result.synthesizedAudio).to.be.instanceOf(ArrayBuffer);
      expect(result.processingTime).to.be.greaterThan(0);
    });

    it('should handle real-time streaming translation', async () => {
      await pipeline.startPipeline({
        sourceLanguage: 'en',
        targetLanguage: 'es',
        enableRealTime: true,
        streamingMode: 'continuous',
      });

      const translationResults = [];
      pipeline.on('translationResult', (result) => {
        translationResults.push(result);
      });

      // Simulate continuous audio chunks
      const chunks = [];
      for (let i = 0; i < 5; i++) {
        const chunk = new Float32Array(1024);
        chunk.fill(Math.sin((2 * Math.PI * (200 + i * 50) * i) / 16000));
        chunks.push(chunk);
      }

      // Process chunks in sequence
      for (const chunk of chunks) {
        await pipeline.processAudio(chunk);
      }

      // Wait for processing to complete
      await TestUtils.wait(100);

      expect(translationResults.length).to.be.greaterThan(0);
      expect(pipeline.getStatistics().chunksProcessed).to.equal(5);
    });

    it('should stop pipeline processing cleanly', async () => {
      await pipeline.startPipeline({ enableRealTime: true });
      expect(pipeline.isProcessing).to.be.true;

      await pipeline.stopPipeline();

      expect(pipeline.isProcessing).to.be.false;
      expect(pipeline.getStatus().status).to.equal('ready');
      expect(mockAudioProcessor.stopProcessing.calledOnce).to.be.true;
      expect(mockSpeechRecognition.stopContinuousRecognition.calledOnce).to.be.true;
    });
  });

  describe('Speech Recognition Integration', () => {
    beforeEach(async () => {
      await pipeline.initialize();
      pipeline.setSpeechRecognition(mockSpeechRecognition);
    });

    it('should recognize speech from audio input', async () => {
      await pipeline.startPipeline({ enableRealTime: true });

      const speechAudio = new Float32Array(2048);
      // Simulate speech-like audio pattern
      for (let i = 0; i < speechAudio.length; i++) {
        speechAudio[i] = Math.sin((2 * Math.PI * 200 * i) / 16000) * Math.exp(-i / 1000);
      }

      const result = await pipeline.processAudio(speechAudio);

      expect(mockSpeechRecognition.recognize.calledOnce).to.be.true;
      expect(result.originalText).to.equal('Hello, how are you today?');
      expect(result.recognitionConfidence).to.equal(0.95);
    });

    it('should handle speech recognition errors gracefully', async () => {
      mockSpeechRecognition.recognize.rejects(new Error('Recognition service unavailable'));

      await pipeline.startPipeline({ enableRealTime: true });

      const audioData = new Float32Array(1024);
      const result = await pipeline.processAudio(audioData);

      expect(result.recognitionError).to.be.true;
      expect(result.fallbackProcessing).to.be.true;
    });

    it('should provide recognition alternatives', async () => {
      await pipeline.startPipeline({ enableAlternatives: true });

      const audioData = new Float32Array(1024);
      const result = await pipeline.processAudio(audioData);

      expect(result.recognitionAlternatives).to.be.an('array');
      expect(result.recognitionAlternatives.length).to.equal(2);
      expect(result.recognitionAlternatives[0].confidence).to.equal(0.95);
    });

    it('should detect voice activity', async () => {
      await pipeline.startPipeline({ enableVAD: true });

      // Test with speech audio
      const speechAudio = new Float32Array(1024);
      speechAudio.fill(0.5); // Simulate speech

      const speechResult = await pipeline.processAudio(speechAudio);
      expect(speechResult.voiceActivityDetected).to.be.true;

      // Test with silence
      const silenceAudio = new Float32Array(1024);
      silenceAudio.fill(0.01); // Simulate silence

      mockAudioProcessor.processAudio.resolves({
        processedAudio: silenceAudio,
        quality: 0.9,
        speechDetected: false,
      });

      const silenceResult = await pipeline.processAudio(silenceAudio);
      expect(silenceResult.voiceActivityDetected).to.be.false;
    });
  });

  describe('Translation Service Integration', () => {
    beforeEach(async () => {
      await pipeline.initialize();
      pipeline.setTranslationService(mockTranslationService);
    });

    it('should translate recognized text', async () => {
      await pipeline.startPipeline({
        sourceLanguage: 'en',
        targetLanguage: 'es',
      });

      const audioData = new Float32Array(1024);
      const result = await pipeline.processAudio(audioData);

      expect(mockTranslationService.translate.calledOnce).to.be.true;
      const translateCall = mockTranslationService.translate.getCall(0);
      expect(translateCall.args[0]).to.equal('Hello, how are you today?');
      expect(translateCall.args[1]).to.equal('en');
      expect(translateCall.args[2]).to.equal('es');

      expect(result.translatedText).to.equal('Hola, ¿cómo estás hoy?');
      expect(result.translationConfidence).to.equal(0.92);
    });

    it('should handle translation errors gracefully', async () => {
      mockTranslationService.translate.rejects(new Error('Translation service error'));

      await pipeline.startPipeline({ enableErrorRecovery: true });

      const audioData = new Float32Array(1024);
      const result = await pipeline.processAudio(audioData);

      expect(result.translationError).to.be.true;
      expect(result.originalText).to.exist; // Should still have original text
    });

    it('should provide translation alternatives', async () => {
      await pipeline.startPipeline({ enableAlternatives: true });

      const audioData = new Float32Array(1024);
      const result = await pipeline.processAudio(audioData);

      expect(result.translationAlternatives).to.be.an('array');
      expect(result.translationAlternatives.length).to.equal(2);
      expect(result.translationAlternatives[0].confidence).to.equal(0.92);
    });

    it('should auto-detect source language', async () => {
      await pipeline.startPipeline({
        sourceLanguage: 'auto',
        targetLanguage: 'es',
        enableLanguageDetection: true,
      });

      const audioData = new Float32Array(1024);
      const result = await pipeline.processAudio(audioData);

      expect(mockTranslationService.detectLanguage.calledOnce).to.be.true;
      expect(result.detectedLanguage).to.equal('en');
      expect(result.languageConfidence).to.equal(0.98);
    });
  });

  describe('Speech Synthesis Integration', () => {
    beforeEach(async () => {
      await pipeline.initialize();
      pipeline.setSpeechSynthesis(mockSpeechSynthesis);
    });

    it('should synthesize translated text to speech', async () => {
      await pipeline.startPipeline({
        targetLanguage: 'es',
        enableSynthesis: true,
      });

      const audioData = new Float32Array(1024);
      const result = await pipeline.processAudio(audioData);

      expect(mockSpeechSynthesis.synthesize.calledOnce).to.be.true;
      const synthesizeCall = mockSpeechSynthesis.synthesize.getCall(0);
      expect(synthesizeCall.args[0]).to.equal('Hola, ¿cómo estás hoy?');
      expect(synthesizeCall.args[1]).to.equal('es');

      expect(result.synthesizedAudio).to.be.instanceOf(ArrayBuffer);
      expect(result.synthesisQuality).to.equal(0.9);
      expect(result.audioDuration).to.equal(2.5);
    });

    it('should handle synthesis errors gracefully', async () => {
      mockSpeechSynthesis.synthesize.rejects(new Error('Synthesis service error'));

      await pipeline.startPipeline({ enableSynthesis: true, enableErrorRecovery: true });

      const audioData = new Float32Array(1024);
      const result = await pipeline.processAudio(audioData);

      expect(result.synthesisError).to.be.true;
      expect(result.translatedText).to.exist; // Should still have translated text
    });

    it('should select appropriate voice for target language', async () => {
      await pipeline.startPipeline({
        targetLanguage: 'es',
        enableSynthesis: true,
        voicePreference: 'female',
      });

      const audioData = new Float32Array(1024);
      await pipeline.processAudio(audioData);

      const synthesizeCall = mockSpeechSynthesis.synthesize.getCall(0);
      const voiceOptions = synthesizeCall.args[2];
      expect(voiceOptions.gender).to.equal('female');
      expect(voiceOptions.language).to.equal('es');
    });

    it('should adjust synthesis parameters for quality', async () => {
      await pipeline.startPipeline({
        enableSynthesis: true,
        synthesisQuality: 'high',
        speechRate: 1.2,
        pitch: 1.1,
      });

      const audioData = new Float32Array(1024);
      await pipeline.processAudio(audioData);

      const synthesizeCall = mockSpeechSynthesis.synthesize.getCall(0);
      const options = synthesizeCall.args[2];
      expect(options.quality).to.equal('high');
      expect(options.rate).to.equal(1.2);
      expect(options.pitch).to.equal(1.1);
    });
  });

  describe('Quality Monitoring and Optimization', () => {
    beforeEach(async () => {
      await pipeline.initialize();
      await pipeline.startPipeline({ enableQualityMonitoring: true });
    });

    it('should monitor pipeline quality metrics', async () => {
      const audioData = new Float32Array(1024);
      await pipeline.processAudio(audioData);

      const qualityMetrics = pipeline.getQualityMetrics();
      expect(qualityMetrics.overallScore).to.be.greaterThan(0);
      expect(qualityMetrics.recognitionQuality).to.be.greaterThan(0);
      expect(qualityMetrics.translationQuality).to.be.greaterThan(0);
      expect(qualityMetrics.synthesisQuality).to.be.greaterThan(0);
    });

    it('should detect quality degradation', async () => {
      let qualityAlertTriggered = false;
      pipeline.on('qualityAlert', () => {
        qualityAlertTriggered = true;
      });

      // Simulate low-quality recognition
      mockSpeechRecognition.recognize.resolves({
        text: 'unclear speech',
        confidence: 0.3, // Low confidence
        language: 'en',
      });

      const audioData = new Float32Array(1024);
      await pipeline.processAudio(audioData);

      // Wait for quality analysis
      await TestUtils.wait(100);

      expect(qualityAlertTriggered).to.be.true;

      const qualityMetrics = pipeline.getQualityMetrics();
      expect(qualityMetrics.overallScore).to.be.lessThan(0.5);
    });

    it('should provide optimization recommendations', async () => {
      // Process with suboptimal settings
      const audioData = new Float32Array(1024);
      await pipeline.processAudio(audioData);

      const recommendations = pipeline.getOptimizationRecommendations();
      expect(recommendations).to.be.an('array');

      if (recommendations.length > 0) {
        expect(recommendations[0]).to.have.property('type');
        expect(recommendations[0]).to.have.property('suggestion');
        expect(recommendations[0]).to.have.property('priority');
      }
    });

    it('should adapt processing based on quality feedback', async () => {
      await pipeline.startPipeline({
        enableAdaptiveProcessing: true,
        qualityThreshold: 0.8,
      });

      // Simulate poor quality input
      mockAudioProcessor.getQualityMetrics.returns({
        signalToNoiseRatio: 5, // Poor SNR
        clarity: 0.4,
        speechProbability: 0.6,
      });

      const audioData = new Float32Array(1024);
      const result = await pipeline.processAudio(audioData);

      expect(result.adaptiveAdjustments).to.be.true;
      expect(result.qualityEnhanced).to.be.true;
    });
  });

  describe('Caching and Performance', () => {
    beforeEach(async () => {
      await pipeline.initialize();
      await pipeline.startPipeline({ enableCaching: true });
    });

    it('should cache translation results', async () => {
      const audioData = new Float32Array(1024);

      // First processing - should call translation service
      const result1 = await pipeline.processAudio(audioData);
      expect(mockTranslationService.translate.calledOnce).to.be.true;

      // Second processing with same input - should use cache
      const result2 = await pipeline.processAudio(audioData);
      expect(mockTranslationService.translate.calledOnce).to.be.true; // Still only called once
      expect(result2.fromCache).to.be.true;
      expect(result2.translatedText).to.equal(result1.translatedText);
    });

    it('should track performance metrics', async () => {
      // Process multiple chunks
      for (let i = 0; i < 5; i++) {
        const chunk = new Float32Array(1024);
        chunk.fill(Math.random());
        await pipeline.processAudio(chunk);
      }

      const stats = pipeline.getStatistics();
      expect(stats.totalProcessed).to.equal(5);
      expect(stats.averageProcessingTime).to.be.greaterThan(0);
      expect(stats.throughput).to.be.greaterThan(0);
      expect(stats.cacheHitRate).to.be.greaterThanOrEqual(0);
    });

    it('should optimize processing pipeline', async () => {
      await pipeline.startPipeline({ enableOptimization: true });

      // Process several chunks to trigger optimization
      for (let i = 0; i < 10; i++) {
        const chunk = new Float32Array(1024);
        await pipeline.processAudio(chunk);
      }

      const optimizations = pipeline.getOptimizationStats();
      expect(optimizations.optimizationsApplied).to.be.greaterThan(0);
    });
  });

  describe('Error Handling and Recovery', () => {
    beforeEach(async () => {
      await pipeline.initialize();
    });

    it('should handle component failures gracefully', async () => {
      await pipeline.startPipeline({ enableErrorRecovery: true });

      // Simulate speech recognition failure
      mockSpeechRecognition.recognize.rejects(new Error('Service unavailable'));

      const audioData = new Float32Array(1024);
      const result = await pipeline.processAudio(audioData);

      expect(result.error).to.be.true;
      expect(result.componentFailure).to.equal('speechRecognition');
      expect(result.recoveryAction).to.exist;
    });

    it('should provide fallback processing modes', async () => {
      await pipeline.startPipeline({ enableFallback: true });

      // Simulate translation service failure
      mockTranslationService.translate.rejects(new Error('Translation failed'));

      const audioData = new Float32Array(1024);
      const result = await pipeline.processAudio(audioData);

      expect(result.fallbackMode).to.be.true;
      expect(result.originalText).to.exist; // Should still have recognition result
    });

    it('should recover from temporary service interruptions', async () => {
      await pipeline.startPipeline({ enableErrorRecovery: true });

      // Simulate temporary failure followed by recovery
      mockTranslationService.translate
        .onFirstCall()
        .rejects(new Error('Temporary failure'))
        .onSecondCall()
        .resolves({
          translatedText: 'Recovered translation',
          confidence: 0.9,
          sourceLanguage: 'en',
          targetLanguage: 'es',
        });

      const audioData = new Float32Array(1024);

      // First call should fail and trigger recovery
      const result1 = await pipeline.processAudio(audioData);
      expect(result1.error).to.be.true;

      // Second call should succeed
      const result2 = await pipeline.processAudio(audioData);
      expect(result2.success).to.be.true;
      expect(result2.translatedText).to.equal('Recovered translation');
    });
  });

  describe('Configuration Management', () => {
    beforeEach(async () => {
      await pipeline.initialize();
    });

    it('should update configuration dynamically', async () => {
      await pipeline.startPipeline();

      const newConfig = {
        sourceLanguage: 'fr',
        targetLanguage: 'de',
        enableRealTime: false,
        bufferSize: 4096,
      };

      pipeline.updateConfiguration(newConfig);

      const currentConfig = pipeline.getConfiguration();
      expect(currentConfig.sourceLanguage).to.equal('fr');
      expect(currentConfig.targetLanguage).to.equal('de');
      expect(currentConfig.enableRealTime).to.be.false;
      expect(currentConfig.bufferSize).to.equal(4096);
    });

    it('should validate configuration changes', async () => {
      const invalidConfig = {
        sourceLanguage: 'invalid-lang',
        bufferSize: -1,
      };

      expect(() => {
        pipeline.updateConfiguration(invalidConfig);
      }).to.throw('Invalid configuration');
    });

    it('should apply configuration changes to active pipeline', async () => {
      await pipeline.startPipeline();

      // Change target language during processing
      pipeline.updateConfiguration({
        targetLanguage: 'fr',
      });

      const audioData = new Float32Array(1024);
      const result = await pipeline.processAudio(audioData);

      expect(result.configurationApplied).to.be.true;
      expect(result.targetLanguage).to.equal('fr');
    });
  });

  describe('Cleanup and Resource Management', () => {
    it('should cleanup resources properly', async () => {
      await pipeline.initialize();
      await pipeline.startPipeline();

      // Process some data
      const chunk = new Float32Array(1024);
      await pipeline.processAudio(chunk);

      // Cleanup
      await pipeline.cleanup();

      expect(pipeline.isInitialized).to.be.false;
      expect(pipeline.isProcessing).to.be.false;

      const status = pipeline.getStatus();
      expect(status.status).to.equal('cleaned');
    });

    it('should handle cleanup during active processing', async () => {
      await pipeline.initialize();
      await pipeline.startPipeline();

      // Start processing and cleanup immediately
      const processingPromise = pipeline.processAudio(new Float32Array(1024));
      const cleanupPromise = pipeline.cleanup();

      await Promise.all([processingPromise, cleanupPromise]);

      expect(pipeline.isProcessing).to.be.false;
    });

    it('should release all allocated resources', async () => {
      await pipeline.initialize();
      await pipeline.startPipeline();

      const initialStats = pipeline.getResourceUsage();
      expect(initialStats.memoryUsage).to.be.greaterThan(0);

      await pipeline.cleanup();

      const finalStats = pipeline.getResourceUsage();
      expect(finalStats.memoryUsage).to.equal(0);
      expect(finalStats.activeConnections).to.equal(0);
    });
  });
});
