/**
 * Integration tests for Translation Pipeline
 *
 * These tests verify the end-to-end translation pipeline functionality including:
 * - STT → Translation → TTS flow
 * - Pipeline activation and deactivation
 * - Language switching
 * - Error handling and recovery
 * - Performance metrics
 */

// Mock STT Manager
jest.mock('../../services/stt/STTManager', () => {
  return function STTManagerMock() {
    const mockSTTManager = {
      initialize: jest.fn().mockImplementation(() => {
        mockSTTManager.isInitialized = true;
        return Promise.resolve({ success: true });
      }),
      processAudio: jest.fn().mockResolvedValue({
        text: 'Hello world',
        confidence: 0.95,
        language: 'en',
        timestamp: Date.now(),
      }),
      destroy: jest.fn(),
      on: jest.fn(),
      emit: jest.fn(),
      isInitialized: false,
    };
    return mockSTTManager;
  };
});

// Mock Translation Manager
jest.mock('../../services/translation/translation-manager', () => {
  return function TranslationManagerMock() {
    const mockTranslationManager = {
      initialize: jest.fn().mockImplementation(() => {
        mockTranslationManager.isInitialized = true;
        return Promise.resolve({ success: true });
      }),
      translate: jest.fn().mockResolvedValue({
        translatedText: 'Hola mundo',
        confidence: 0.92,
        sourceLanguage: 'en',
        targetLanguage: 'es',
        provider: 'google',
        timestamp: Date.now(),
      }),
      getSupportedLanguagePairs: jest.fn().mockResolvedValue([
        { source: 'en', target: 'es' },
        { source: 'es', target: 'en' },
        { source: 'en', target: 'fr' },
      ]),
      destroy: jest.fn(),
      on: jest.fn(),
      emit: jest.fn(),
      isInitialized: false,
    };
    return mockTranslationManager;
  };
});

// Import after mocks are set up
const TranslationPipeline = require('../../core/translation-pipeline');
const EventEmitter = require('events');

describe('TranslationPipeline Integration', () => {
  let pipeline;

  beforeEach(async () => {
    jest.clearAllMocks();

    pipeline = new TranslationPipeline({
      enableSTT: true,
      enableTranslation: true,
      enableTTS: false,
      confidenceThreshold: 0.7,
    });

    await pipeline.initialize();
  });

  afterEach(() => {
    if (pipeline) {
      pipeline.destroy();
    }
  });

  describe('Pipeline Initialization', () => {
    it('should initialize the pipeline successfully', () => {
      expect(pipeline.isInitialized).toBe(true);
      expect(pipeline.sttManager).toBeDefined();
      expect(pipeline.translationManager).toBeDefined();
    });

    it('should set up event handlers', () => {
      expect(pipeline.sttManager.on).toHaveBeenCalled();
      expect(pipeline.translationManager.on).toHaveBeenCalled();
    });

    it('should initialize with default configuration', () => {
      expect(pipeline.config.enableSTT).toBe(true);
      expect(pipeline.config.enableTranslation).toBe(true);
      expect(pipeline.config.confidenceThreshold).toBe(0.7);
    });
  });

  describe('Pipeline Activation/Deactivation', () => {
    it('should activate the pipeline', async () => {
      await pipeline.activate();

      expect(pipeline.isActive).toBe(true);
      expect(pipeline.currentConversationId).toBeDefined();
    });

    it('should deactivate the pipeline', async () => {
      await pipeline.activate();
      expect(pipeline.isActive).toBe(true);

      await pipeline.deactivate();
      expect(pipeline.isActive).toBe(false);
    });

    it('should emit activation events', async () => {
      const activatedSpy = jest.fn();
      const deactivatedSpy = jest.fn();

      pipeline.on('pipeline:activated', activatedSpy);
      pipeline.on('pipeline:deactivated', deactivatedSpy);

      await pipeline.activate();
      expect(activatedSpy).toHaveBeenCalled();

      await pipeline.deactivate();
      expect(deactivatedSpy).toHaveBeenCalled();
    });
  });

  describe('End-to-End Translation Flow', () => {
    it('should process audio through the complete pipeline', async () => {
      await pipeline.activate();

      const audioData = new Float32Array(1024);
      const options = {
        sourceLanguage: 'en',
        targetLanguage: 'es',
      };

      const result = await pipeline.startPipeline(audioData, options);

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(pipeline.sttManager.processAudio).toHaveBeenCalledWith(audioData, expect.any(Object));
      expect(pipeline.translationManager.translate).toHaveBeenCalled();
    });

    it('should process direct text translation', async () => {
      await pipeline.activate();

      const text = 'Hello world';
      const fromLanguage = 'en';
      const toLanguage = 'es';

      const result = await pipeline.processTextDirect(text, fromLanguage, toLanguage);

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.translatedText).toBe('Hola mundo');
      expect(pipeline.translationManager.translate).toHaveBeenCalledWith(
        text,
        fromLanguage,
        toLanguage,
        expect.any(Object)
      );
    });

    it('should emit translation events', async () => {
      await pipeline.activate();

      const translationSpy = jest.fn();
      pipeline.on('translation:completed', translationSpy);

      const text = 'Hello world';
      await pipeline.processTextDirect(text, 'en', 'es');

      expect(translationSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          originalText: text,
          translatedText: 'Hola mundo',
          sourceLanguage: 'en',
          targetLanguage: 'es',
        })
      );
    });

    it('should handle STT confidence threshold', async () => {
      // Mock low confidence STT result
      pipeline.sttManager.processAudio.mockResolvedValueOnce({
        text: 'unclear speech',
        confidence: 0.5, // Below threshold
        language: 'en',
        timestamp: Date.now(),
      });

      const audioData = new Float32Array(1024);
      const result = await pipeline.startPipeline(audioData);

      // Should not proceed to translation due to low confidence
      expect(result.success).toBe(false);
      expect(result.reason).toContain('confidence');
    });
  });

  describe('Language Management', () => {
    it('should set source and target languages', () => {
      pipeline.setLanguages('fr', 'en');

      expect(pipeline.sourceLanguage).toBe('fr');
      expect(pipeline.targetLanguage).toBe('en');
    });

    it('should swap languages', () => {
      pipeline.setLanguages('en', 'es');

      const result = pipeline.swapLanguages();

      expect(pipeline.sourceLanguage).toBe('es');
      expect(pipeline.targetLanguage).toBe('en');
      expect(result.sourceLanguage).toBe('es');
      expect(result.targetLanguage).toBe('en');
    });

    it('should get supported language pairs', async () => {
      const pairs = await pipeline.getSupportedLanguagePairs();

      expect(Array.isArray(pairs)).toBe(true);
      expect(pairs.length).toBeGreaterThan(0);
      expect(pairs[0]).toHaveProperty('source');
      expect(pairs[0]).toHaveProperty('target');
    });

    it('should normalize language codes', () => {
      expect(pipeline.normalizeLanguageCode('EN')).toBe('en');
      expect(pipeline.normalizeLanguageCode('es-ES')).toBe('es');
      expect(pipeline.normalizeLanguageCode('zh-CN')).toBe('zh');
    });
  });

  describe('Error Handling', () => {
    it('should handle STT errors gracefully', async () => {
      await pipeline.activate();

      pipeline.sttManager.processAudio.mockRejectedValueOnce(new Error('STT service unavailable'));

      const audioData = new Float32Array(1024);
      const result = await pipeline.startPipeline(audioData);

      expect(result.success).toBe(false);
      expect(result.error).toContain('STT service unavailable');
    });

    it('should handle translation errors gracefully', async () => {
      await pipeline.activate();

      pipeline.translationManager.translate.mockRejectedValueOnce(
        new Error('Translation service unavailable')
      );

      const text = 'Hello world';
      const result = await pipeline.processTextDirect(text, 'en', 'es');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Translation service unavailable');
    });

    it('should emit error events', async () => {
      const errorSpy = jest.fn();
      pipeline.on('pipeline:error', errorSpy);

      pipeline.sttManager.processAudio.mockRejectedValueOnce(new Error('Test error'));

      const audioData = new Float32Array(1024);
      await pipeline.startPipeline(audioData);

      expect(errorSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          stage: 'stt',
          error: expect.any(Error),
        })
      );
    });

    it('should recover from transient errors', async () => {
      // First call fails, second succeeds
      pipeline.sttManager.processAudio
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockResolvedValueOnce({
          text: 'Hello world',
          confidence: 0.95,
          language: 'en',
          timestamp: Date.now(),
        });

      const audioData = new Float32Array(1024);

      // First attempt should fail
      const result1 = await pipeline.startPipeline(audioData);
      expect(result1.success).toBe(false);

      // Second attempt should succeed
      const result2 = await pipeline.startPipeline(audioData);
      expect(result2.success).toBe(true);
    });
  });

  describe('Performance Metrics', () => {
    it('should track translation metrics', async () => {
      await pipeline.activate();

      const text = 'Hello world';
      await pipeline.processTextDirect(text, 'en', 'es');

      const metrics = pipeline.getMetrics();

      expect(metrics.totalTranslations).toBe(1);
      expect(metrics.lastProcessingTime).toBeGreaterThan(0);
      expect(metrics.successRate).toBe(1.0);
    });

    it('should update success rate on failures', async () => {
      await pipeline.activate();

      pipeline.translationManager.translate.mockRejectedValueOnce(new Error('Test error'));

      const text = 'Hello world';

      // One failure
      await pipeline.processTextDirect(text, 'en', 'es');

      // One success
      pipeline.translationManager.translate.mockResolvedValueOnce({
        translatedText: 'Hola mundo',
        confidence: 0.92,
        sourceLanguage: 'en',
        targetLanguage: 'es',
      });
      await pipeline.processTextDirect(text, 'en', 'es');

      const metrics = pipeline.getMetrics();
      expect(metrics.successRate).toBe(0.5); // 1 success out of 2 attempts
    });

    it('should reset metrics', () => {
      pipeline.metrics.totalTranslations = 5;
      pipeline.metrics.successRate = 0.8;

      pipeline.resetMetrics();

      const metrics = pipeline.getMetrics();
      expect(metrics.totalTranslations).toBe(0);
      expect(metrics.successRate).toBe(1.0);
    });
  });

  describe('Configuration Management', () => {
    it('should update configuration', () => {
      const newConfig = {
        confidenceThreshold: 0.8,
        contextWindowSize: 15,
      };

      pipeline.updateConfig(newConfig);

      expect(pipeline.config.confidenceThreshold).toBe(0.8);
      expect(pipeline.config.contextWindowSize).toBe(15);
    });

    it('should get current status', () => {
      const status = pipeline.getStatus();

      expect(status).toHaveProperty('active');
      expect(status).toHaveProperty('initialized');
      expect(status).toHaveProperty('sourceLanguage');
      expect(status).toHaveProperty('targetLanguage');
      expect(status).toHaveProperty('conversationId');
    });

    it('should export pipeline data', () => {
      const data = pipeline.exportData();

      expect(data).toHaveProperty('metrics');
      expect(data).toHaveProperty('status');
      expect(data).toHaveProperty('timestamp');
      expect(data).toHaveProperty('languages');
      expect(data).toHaveProperty('conversationId');
    });
  });

  describe('Resource Management', () => {
    it('should cleanup resources on destroy', () => {
      const destroySpy = jest.spyOn(pipeline, 'destroy');

      pipeline.destroy();

      expect(destroySpy).toHaveBeenCalled();
      expect(pipeline.sttManager.destroy).toHaveBeenCalled();
      expect(pipeline.translationManager.destroy).toHaveBeenCalled();
    });

    it('should handle multiple destroy calls safely', () => {
      expect(() => {
        pipeline.destroy();
        pipeline.destroy(); // Second call should not throw
      }).not.toThrow();
    });
  });
});
