const { expect } = require('chai');
// Sinon functionality replaced with Jest mocks
const proxyquire = require('proxyquire');

describe('Complete Translation Pipeline', () => {
  let completePipeline;
  let mockAudioManager;
  let mockTranslationManager;
  let mockSTTManager;
  let mockTTSManager;
  let mockPlatformDetector;
  let mockLogger;

  beforeEach(() => {
    // Create mocks for all dependencies
    mockAudioManager = {
      startCapture: sinon.stub(),
      stopCapture: sinon.stub(),
      setInputDevice: sinon.stub(),
      setOutputDevice: sinon.stub(),
      getAudioDevices: sinon.stub(),
      isCapturing: sinon.stub().returns(false)
    };

    mockTranslationManager = {
      translate: sinon.stub(),
      setSourceLanguage: sinon.stub(),
      setTargetLanguage: sinon.stub(),
      setService: sinon.stub(),
      getSupportedLanguages: sinon.stub(),
      getAvailableServices: sinon.stub()
    };

    mockSTTManager = {
      transcribe: sinon.stub(),
      setLanguage: sinon.stub(),
      setService: sinon.stub(),
      isListening: sinon.stub().returns(false)
    };

    mockTTSManager = {
      synthesize: sinon.stub(),
      setVoice: sinon.stub(),
      setLanguage: sinon.stub(),
      setService: sinon.stub(),
      playAudio: sinon.stub()
    };

    mockPlatformDetector = {
      detectActiveApps: sinon.stub(),
      configureAudioRouting: sinon.stub(),
      getSupportedApps: sinon.stub(),
      isMonitoring: sinon.stub().returns(false)
    };

    mockLogger = {
      info: sinon.stub(),
      error: sinon.stub(),
      warn: sinon.stub(),
      debug: sinon.stub()
    };

    // Mock the complete pipeline
    completePipeline = proxyquire('../../../src/core/complete-pipeline', {
      '../audio/AudioManager': mockAudioManager,
      '../services/translation/translation-manager': mockTranslationManager,
      '../services/stt/STTManager': mockSTTManager,
      '../services/tts/TTSManager': mockTTSManager,
      '../services/platform-detector': mockPlatformDetector,
      '../utils/logger': mockLogger
    });
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('Initialization', () => {
    it('should initialize pipeline with default settings', () => {
      const pipeline = new completePipeline.CompletePipeline();
      
      expect(pipeline).to.be.an('object');
      expect(pipeline.isRunning).to.be.false;
      expect(pipeline.config).to.be.an('object');
    });

    it('should initialize with custom configuration', () => {
      const config = {
        sourceLanguage: 'en',
        targetLanguage: 'es',
        translationService: 'deepl',
        sttService: 'azure',
        ttsService: 'azure'
      };

      const pipeline = new completePipeline.CompletePipeline(config);
      
      expect(pipeline.config.sourceLanguage).to.equal('en');
      expect(pipeline.config.targetLanguage).to.equal('es');
    });

    it('should validate configuration on initialization', () => {
      const invalidConfig = {
        sourceLanguage: 'invalid',
        targetLanguage: 'invalid'
      };

      expect(() => new completePipeline.CompletePipeline(invalidConfig)).to.throw();
    });
  });

  describe('Pipeline Start/Stop', () => {
    it('should start pipeline successfully', async () => {
      const pipeline = new completePipeline.CompletePipeline();
      
      mockAudioManager.startCapture.resolves();
      mockSTTManager.transcribe.resolves('Hello world');
      mockTranslationManager.translate.resolves('Hola mundo');
      mockTTSManager.synthesize.resolves(Buffer.from('audio data'));
      mockPlatformDetector.detectActiveApps.resolves(['discord']);

      const result = await pipeline.start();
      
      expect(result.success).to.be.true;
      expect(pipeline.isRunning).to.be.true;
      expect(mockAudioManager.startCapture.called).to.be.true;
    });

    it('should stop pipeline successfully', async () => {
      const pipeline = new completePipeline.CompletePipeline();
      pipeline.isRunning = true;

      mockAudioManager.stopCapture.resolves();
      mockPlatformDetector.detectActiveApps.resolves([]);

      const result = await pipeline.stop();
      
      expect(result.success).to.be.true;
      expect(pipeline.isRunning).to.be.false;
      expect(mockAudioManager.stopCapture.called).to.be.true;
    });

    it('should handle start errors gracefully', async () => {
      const pipeline = new completePipeline.CompletePipeline();
      
      mockAudioManager.startCapture.rejects(new Error('Audio capture failed'));

      const result = await pipeline.start();
      
      expect(result.success).to.be.false;
      expect(result.error).to.include('Audio capture failed');
      expect(pipeline.isRunning).to.be.false;
    });

    it('should prevent multiple starts', async () => {
      const pipeline = new completePipeline.CompletePipeline();
      pipeline.isRunning = true;

      const result = await pipeline.start();
      
      expect(result.success).to.be.false;
      expect(result.error).to.include('already running');
    });
  });

  describe('Audio Processing', () => {
    it('should process audio input correctly', async () => {
      const pipeline = new completePipeline.CompletePipeline();
      pipeline.isRunning = true;

      const audioData = Buffer.from('test audio data');
      mockSTTManager.transcribe.resolves('Hello world');
      mockTranslationManager.translate.resolves('Hola mundo');
      mockTTSManager.synthesize.resolves(Buffer.from('translated audio'));

      const result = await pipeline.processAudio(audioData);
      
      expect(result.success).to.be.true;
      expect(result.transcription).to.equal('Hello world');
      expect(result.translation).to.equal('Hola mundo');
      expect(mockSTTManager.transcribe.calledWith(audioData)).to.be.true;
    });

    it('should handle audio processing errors', async () => {
      const pipeline = new completePipeline.CompletePipeline();
      pipeline.isRunning = true;

      const audioData = Buffer.from('test audio data');
      mockSTTManager.transcribe.rejects(new Error('STT failed'));

      const result = await pipeline.processAudio(audioData);
      
      expect(result.success).to.be.false;
      expect(result.error).to.include('STT failed');
    });

    it('should handle empty audio data', async () => {
      const pipeline = new completePipeline.CompletePipeline();
      pipeline.isRunning = true;

      const result = await pipeline.processAudio(Buffer.alloc(0));
      
      expect(result.success).to.be.false;
      expect(result.error).to.include('empty audio data');
    });
  });

  describe('Translation Pipeline', () => {
    it('should translate text correctly', async () => {
      const pipeline = new completePipeline.CompletePipeline();
      
      mockTranslationManager.translate.resolves('Hola mundo');
      mockTTSManager.synthesize.resolves(Buffer.from('audio data'));

      const result = await pipeline.translateText('Hello world');
      
      expect(result.success).to.be.true;
      expect(result.translation).to.equal('Hola mundo');
      expect(result.audio).to.be.instanceOf(Buffer);
    });

    it('should handle translation errors', async () => {
      const pipeline = new completePipeline.CompletePipeline();
      
      mockTranslationManager.translate.rejects(new Error('Translation failed'));

      const result = await pipeline.translateText('Hello world');
      
      expect(result.success).to.be.false;
      expect(result.error).to.include('Translation failed');
    });

    it('should use fallback services', async () => {
      const pipeline = new completePipeline.CompletePipeline();
      
      mockTranslationManager.translate.onFirstCall().rejects(new Error('Primary service failed'));
      mockTranslationManager.translate.onSecondCall().resolves('Hola mundo');
      mockTTSManager.synthesize.resolves(Buffer.from('audio data'));

      const result = await pipeline.translateText('Hello world');
      
      expect(result.success).to.be.true;
      expect(result.translation).to.equal('Hola mundo');
    });
  });

  describe('Platform Integration', () => {
    it('should detect active communication apps', async () => {
      const pipeline = new completePipeline.CompletePipeline();
      
      mockPlatformDetector.detectActiveApps.resolves(['discord', 'zoom']);

      const result = await pipeline.detectActiveApps();
      
      expect(result.success).to.be.true;
      expect(result.apps).to.include('discord');
      expect(result.apps).to.include('zoom');
    });

    it('should configure audio routing for detected apps', async () => {
      const pipeline = new completePipeline.CompletePipeline();
      
      mockPlatformDetector.configureAudioRouting.resolves();

      const result = await pipeline.configureAudioRouting(['discord']);
      
      expect(result.success).to.be.true;
      expect(mockPlatformDetector.configureAudioRouting.calledWith(['discord'])).to.be.true;
    });

    it('should handle platform detection errors', async () => {
      const pipeline = new completePipeline.CompletePipeline();
      
      mockPlatformDetector.detectActiveApps.rejects(new Error('Detection failed'));

      const result = await pipeline.detectActiveApps();
      
      expect(result.success).to.be.false;
      expect(result.error).to.include('Detection failed');
    });
  });

  describe('Configuration Management', () => {
    it('should update configuration', () => {
      const pipeline = new completePipeline.CompletePipeline();
      
      const newConfig = {
        sourceLanguage: 'fr',
        targetLanguage: 'de',
        translationService: 'google'
      };

      const result = pipeline.updateConfiguration(newConfig);
      
      expect(result.success).to.be.true;
      expect(pipeline.config.sourceLanguage).to.equal('fr');
      expect(pipeline.config.targetLanguage).to.equal('de');
    });

    it('should validate configuration updates', () => {
      const pipeline = new completePipeline.CompletePipeline();
      
      const invalidConfig = {
        sourceLanguage: 'invalid'
      };

      const result = pipeline.updateConfiguration(invalidConfig);
      
      expect(result.success).to.be.false;
      expect(result.error).to.include('invalid');
    });

    it('should get current configuration', () => {
      const pipeline = new completePipeline.CompletePipeline();
      
      const config = pipeline.getConfiguration();
      
      expect(config).to.be.an('object');
      expect(config).to.have.property('sourceLanguage');
      expect(config).to.have.property('targetLanguage');
    });
  });

  describe('Status and Monitoring', () => {
    it('should get pipeline status', () => {
      const pipeline = new completePipeline.CompletePipeline();
      pipeline.isRunning = true;

      const status = pipeline.getStatus();
      
      expect(status.isRunning).to.be.true;
      expect(status).to.have.property('uptime');
      expect(status).to.have.property('processedAudio');
      expect(status).to.have.property('translations');
    });

    it('should get performance metrics', () => {
      const pipeline = new completePipeline.CompletePipeline();
      
      const metrics = pipeline.getPerformanceMetrics();
      
      expect(metrics).to.be.an('object');
      expect(metrics).to.have.property('averageLatency');
      expect(metrics).to.have.property('successRate');
      expect(metrics).to.have.property('errorRate');
    });

    it('should reset metrics', () => {
      const pipeline = new completePipeline.CompletePipeline();
      
      const result = pipeline.resetMetrics();
      
      expect(result.success).to.be.true;
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle service failures gracefully', async () => {
      const pipeline = new completePipeline.CompletePipeline();
      
      mockTranslationManager.translate.rejects(new Error('Service unavailable'));
      mockTTSManager.synthesize.rejects(new Error('TTS failed'));

      const result = await pipeline.translateText('Hello world');
      
      expect(result.success).to.be.false;
      expect(result.error).to.include('Service unavailable');
    });

    it('should attempt recovery from errors', async () => {
      const pipeline = new completePipeline.CompletePipeline();
      
      mockTranslationManager.translate.onFirstCall().rejects(new Error('Temporary error'));
      mockTranslationManager.translate.onSecondCall().resolves('Hola mundo');
      mockTTSManager.synthesize.resolves(Buffer.from('audio data'));

      const result = await pipeline.translateText('Hello world');
      
      expect(result.success).to.be.true;
      expect(result.translation).to.equal('Hola mundo');
    });

    it('should log errors appropriately', async () => {
      const pipeline = new completePipeline.CompletePipeline();
      
      mockTranslationManager.translate.rejects(new Error('Test error'));

      await pipeline.translateText('Hello world');
      
      expect(mockLogger.error.called).to.be.true;
    });
  });

  describe('Resource Management', () => {
    it('should cleanup resources on stop', async () => {
      const pipeline = new completePipeline.CompletePipeline();
      pipeline.isRunning = true;

      mockAudioManager.stopCapture.resolves();
      mockPlatformDetector.detectActiveApps.resolves([]);

      const result = await pipeline.stop();
      
      expect(result.success).to.be.true;
      expect(mockAudioManager.stopCapture.called).to.be.true;
    });

    it('should handle cleanup errors', async () => {
      const pipeline = new completePipeline.CompletePipeline();
      pipeline.isRunning = true;

      mockAudioManager.stopCapture.rejects(new Error('Cleanup failed'));

      const result = await pipeline.stop();
      
      expect(result.success).to.be.false;
      expect(result.error).to.include('Cleanup failed');
    });
  });
});