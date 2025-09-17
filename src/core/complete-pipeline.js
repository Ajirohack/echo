/**
 * Complete Pipeline - Integration of STT, Translation, and TTS
 * Manages the complete real-time translation workflow
 */
const AudioDeviceManager = require('../audio/device-manager');
const STTManager = require('../services/stt/stt-manager');
const TranslationManager = require('../services/translation/translation-manager');
const TTSManager = require('../services/tts/tts-manager');
const PlatformDetector = require('../services/platform-detector');
const EventEmitter = require('events');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

class CompletePipeline extends EventEmitter {
  constructor(config = {}) {
    super();

    // Initialize configuration
    this.config = {
      enableSTT: true,
      enableTranslation: true,
      enableTTS: true,
      autoActivate: false,
      continuousMode: true,
      autoLanguageDetection: true,
      sourceLanguage: 'en',
      targetLanguage: 'es',
      selectedVoice: 'auto',
      confidenceThreshold: 0.7,
      ...config,
    };

    // Pipeline components
    this.audioManager = null;
    this.sttManager = null;
    this.translationManager = null;
    this.ttsManager = null;
    this.platformDetector = PlatformDetector;

    // Pipeline state
    this.active = false;
    this.conversationId = null;
    this.sourceLanguage = this.config.sourceLanguage;
    this.targetLanguage = this.config.targetLanguage;
    this.selectedVoice = this.config.selectedVoice;

    // Pipeline metrics
    this.metrics = {
      totalProcessed: 0,
      successfulTranslations: 0,
      failedTranslations: 0,
      averageLatency: 0,
      stageLatencies: {
        stt: 0,
        translation: 0,
        tts: 0,
        total: 0,
      },
      confidence: {
        stt: 0,
        translation: 0,
        overall: 0,
      },
    };

    // Initialize components
    this.initialize();
  }

  /**
   * Initialize pipeline components
   */
  async initialize() {
    try {
      // Initialize audio manager
      this.audioManager = new AudioDeviceManager();
      await this.audioManager.initialize();

      // Initialize STT manager
      if (this.config.enableSTT) {
        this.sttManager = new STTManager();
      }

      // Initialize translation manager
      if (this.config.enableTranslation) {
        this.translationManager = new TranslationManager();
      }

      // Initialize TTS manager
      if (this.config.enableTTS) {
        this.ttsManager = new TTSManager();
      }

      // Set up event listeners
      this.setupEventListeners();

      // Initialize platform detection
      await this.initializePlatformDetection();

      // Auto-activate if configured
      if (this.config.autoActivate) {
        await this.activate();
      }

      logger.info('Complete pipeline initialized');
      this.emit('initialized', {
        sourceLanguage: this.sourceLanguage,
        targetLanguage: this.targetLanguage,
      });
    } catch (error) {
      logger.error('Error initializing complete pipeline:', error);
      throw error;
    }
  }

  /**
   * Set up event listeners for pipeline components
   */
  setupEventListeners() {
    // Audio manager events
    if (this.audioManager) {
      this.audioManager.on('audioData', this.handleAudioData.bind(this));
      this.audioManager.on('error', this.handleComponentError.bind(this, 'audio'));
    }

    // STT manager events
    if (this.sttManager) {
      this.sttManager.on('transcription', this.handleTranscription.bind(this));
      this.sttManager.on('error', this.handleComponentError.bind(this, 'stt'));
    }

    // Translation manager events
    if (this.translationManager) {
      this.translationManager.on('translationComplete', this.handleTranslation.bind(this));
      this.translationManager.on('error', this.handleComponentError.bind(this, 'translation'));
    }

    // TTS manager events
    if (this.ttsManager) {
      this.ttsManager.on('synthesisComplete', this.handleSynthesis.bind(this));
      this.ttsManager.on('error', this.handleComponentError.bind(this, 'tts'));
    }
  }

  /**
   * Initialize platform detection and start monitoring
   */
  async initializePlatformDetection() {
    try {
      // Start periodic platform detection
      this.platformDetectionInterval = setInterval(async () => {
        await this.detectAndConfigurePlatform();
      }, 10000); // Check every 10 seconds

      // Initial detection
      await this.detectAndConfigurePlatform();

      logger.info('Platform detection initialized');
    } catch (error) {
      logger.error('Error initializing platform detection:', error);
    }
  }

  /**
   * Detect active platform and configure audio routing
   */
  async detectAndConfigurePlatform() {
    try {
      const activeApp = await this.platformDetector.detectActiveApp();

      if (activeApp) {
        logger.info(`Detected active communication app: ${activeApp}`);

        // Configure audio routing for the detected app
        await this.platformDetector.configureAudioRouting(activeApp);

        // Emit platform detection event
        this.emit('platformDetected', {
          app: activeApp,
          timestamp: Date.now(),
        });
      }
    } catch (error) {
      logger.error('Error in platform detection:', error);
    }
  }

  /**
   * Handle audio data from audio manager
   * @param {Object} data - Audio data object
   */
  async handleAudioData(data) {
    if (!this.active || !this.config.enableSTT) return;

    try {
      // Process audio through STT
      await this.sttManager.processAudio(data.audioData, {
        language: this.sourceLanguage,
        autoDetect: this.config.autoLanguageDetection,
      });
    } catch (error) {
      logger.error('Error processing audio:', error);
      this.handleComponentError('audio', error);
    }
  }

  /**
   * Handle transcription from STT manager
   * @param {Object} result - Transcription result
   */
  async handleTranscription(result) {
    if (!this.active || !this.config.enableTranslation) return;

    // Skip low-confidence transcriptions
    if (result.confidence < this.config.confidenceThreshold) {
      logger.debug(`Skipping low confidence transcription: ${result.confidence}`);
      return;
    }

    try {
      // Update source language if detected
      if (result.detectedLanguage && this.config.autoLanguageDetection) {
        const detectedLang = result.detectedLanguage;
        if (detectedLang !== this.sourceLanguage) {
          logger.info(`Detected language change: ${this.sourceLanguage} -> ${detectedLang}`);
          this.sourceLanguage = detectedLang;
          this.emit('languageDetected', { language: detectedLang });
        }
      }

      // Process transcription through translation
      await this.processTranscription(result);
    } catch (error) {
      logger.error('Error processing transcription:', error);
      this.handleComponentError('transcription', error);
    }
  }

  /**
   * Process transcription through translation
   * @param {Object} sttResult - STT result
   * @returns {Promise<Object>} Translation result
   */
  async processTranscription(sttResult) {
    try {
      // Start timing translation
      const startTime = Date.now();

      // Build context for translation
      const context = this.buildTranslationContext(sttResult);

      // Translate the text
      const translationResult = await this.translationManager.translate(
        sttResult.text,
        this.sourceLanguage,
        this.targetLanguage,
        {
          context,
          model: 'adaptive',
          conversationId: this.conversationId,
        }
      );

      // Calculate translation time
      const translationTime = Date.now() - startTime;

      // Combine STT and translation results
      const combinedResult = {
        ...sttResult,
        translation: translationResult.text,
        reasoning: translationResult.reasoning || '',
        sourceLanguage: this.sourceLanguage,
        targetLanguage: this.targetLanguage,
        processingTime: {
          stt: sttResult.processingTime,
          translation: translationTime,
          total: sttResult.processingTime + translationTime,
        },
        confidence: {
          stt: sttResult.confidence,
          translation: translationResult.confidence || 0.8,
        },
      };

      // Forward to TTS if enabled
      if (this.config.enableTTS && this.ttsManager) {
        await this.processTranslation(combinedResult);
      } else {
        // Emit pipeline result without TTS
        this.emitPipelineResult(combinedResult);
      }

      return combinedResult;
    } catch (error) {
      logger.error('Translation processing failed:', error);
      throw error;
    }
  }

  /**
   * Process translation through TTS
   * @param {Object} translationResult - Translation result
   * @returns {Promise<Object>} TTS result
   */
  async processTranslation(translationResult) {
    try {
      const startTime = Date.now();

      // Synthesize speech from translated text
      const ttsResult = await this.ttsManager.synthesize(
        translationResult.translation,
        this.targetLanguage,
        {
          voice: this.selectedVoice,
          emotion: this.detectEmotion(translationResult),
        }
      );

      // Route audio to output devices
      await this.processAudioOutput(ttsResult);

      // Calculate TTS time
      const ttsTime = Date.now() - startTime;

      // Combine results
      const completeResult = {
        ...translationResult,
        tts: {
          voice: ttsResult.voice,
          voiceName: ttsResult.voiceName,
          provider: ttsResult.provider,
          audioData: ttsResult.audioData,
          processingTime: ttsTime,
        },
        processingTime: {
          ...translationResult.processingTime,
          tts: ttsTime,
          total: translationResult.processingTime.total + ttsTime,
        },
      };

      // Emit pipeline result
      this.emitPipelineResult(completeResult);

      return completeResult;
    } catch (error) {
      logger.error('TTS processing failed:', error);

      // Emit pipeline result without TTS
      this.emitPipelineResult({
        ...translationResult,
        error: {
          stage: 'tts',
          message: error.message,
        },
      });

      throw error;
    }
  }

  /**
   * Process audio output routing
   * @param {Object} ttsResult - TTS result
   * @returns {Promise<boolean>} Success status
   */
  async processAudioOutput(ttsResult) {
    try {
      // Route audio to configured output devices
      const routingOptions = {
        useVirtualDevice: this.config.output?.routing?.useVirtualDevice,
        deviceName: this.config.output?.routing?.deviceName,
        useSystemSpeaker: this.config.output?.routing?.useSystemSpeaker,
      };
      return await this.ttsManager.routeAudio(ttsResult.audio, routingOptions);
    } catch (error) {
      logger.error('Audio output routing failed:', error);
      throw error;
    }
  }

  /**
   * Emit pipeline result with consistent format
   * @param {Object} data - Pipeline result data
   */
  emitPipelineResult(data) {
    // Generate unique ID for this result
    const resultId = uuidv4();

    // Create standardized result format
    const result = {
      id: resultId,
      timestamp: Date.now(),
      conversationId: this.conversationId,
      original: {
        text: data.text,
        language: data.sourceLanguage || this.sourceLanguage,
        confidence: data.confidence?.stt || 0,
      },
      translation: {
        text: data.translation,
        language: data.targetLanguage || this.targetLanguage,
        confidence: data.confidence?.translation || 0,
        reasoning: data.reasoning,
      },
      processingTime: data.processingTime || {},
      confidence: this.calculateOverallConfidence(data),
      error: data.error,
    };

    // Add TTS data if available
    if (data.tts) {
      result.tts = {
        voice: data.tts.voice?.id || data.tts.voice,
        voiceName: data.tts.voice?.name || data.tts.voiceName,
        provider: data.tts.voice?.service || data.tts.provider,
        audioAvailable: !!(data.tts.audio || data.tts.audioData),
      };
    }

    // Update metrics
    this.updatePipelineMetrics(result);

    // Emit the result
    this.emit('pipelineResult', result);

    return result;
  }

  /**
   * Build context for translation
   * @param {Object} sttResult - STT result
   * @returns {string} Context string
   */
  buildTranslationContext(sttResult) {
    const contextParts = [];

    if (sttResult.detectedLanguage) {
      contextParts.push(`Detected language: ${sttResult.detectedLanguage}`);
    }

    if (sttResult.context) {
      contextParts.push(sttResult.context);
    }

    return contextParts.join(', ');
  }

  /**
   * Detect emotion from text for TTS
   * @param {Object} result - Translation result
   * @returns {string} Detected emotion
   */
  detectEmotion(result) {
    // This is a simplified emotion detection
    // A more sophisticated version would use NLP or ML models
    const text = result.translation.toLowerCase();

    if (
      text.includes('!') ||
      text.includes('amazing') ||
      text.includes('great') ||
      text.includes('wonderful')
    ) {
      return 'excited';
    }

    if (text.includes('?')) {
      return 'uncertain';
    }

    if (text.includes('sorry') || text.includes('sad') || text.includes('unfortunately')) {
      return 'sad';
    }

    return 'neutral';
  }

  /**
   * Normalize language code
   * @param {string} code - Language code
   * @returns {string} Normalized code
   */
  normalizeLanguageCode(code) {
    if (!code) return 'en';
    return code.toLowerCase().split('-')[0];
  }

  /**
   * Update pipeline performance metrics
   * @param {Object} result - Pipeline result
   */
  updatePipelineMetrics(result) {
    this.metrics.totalProcessed++;

    if (result.error) {
      this.metrics.failedTranslations++;
    } else {
      this.metrics.successfulTranslations++;

      // Update latency metrics
      if (result.processingTime) {
        const times = result.processingTime;
        this.metrics.stageLatencies.stt = this.calculateRollingAverage(
          this.metrics.stageLatencies.stt,
          times.stt || 0,
          this.metrics.successfulTranslations
        );

        this.metrics.stageLatencies.translation = this.calculateRollingAverage(
          this.metrics.stageLatencies.translation,
          times.translation || 0,
          this.metrics.successfulTranslations
        );

        this.metrics.stageLatencies.tts = this.calculateRollingAverage(
          this.metrics.stageLatencies.tts,
          times.tts || 0,
          this.metrics.successfulTranslations
        );

        this.metrics.stageLatencies.total = this.calculateRollingAverage(
          this.metrics.stageLatencies.total,
          times.total || 0,
          this.metrics.successfulTranslations
        );

        this.metrics.averageLatency = this.metrics.stageLatencies.total;
      }

      // Update confidence metrics
      this.metrics.confidence.stt = this.calculateRollingAverage(
        this.metrics.confidence.stt,
        result.original.confidence || 0,
        this.metrics.successfulTranslations
      );

      this.metrics.confidence.translation = this.calculateRollingAverage(
        this.metrics.confidence.translation,
        result.translation.confidence || 0,
        this.metrics.successfulTranslations
      );

      this.metrics.confidence.overall = this.calculateRollingAverage(
        this.metrics.confidence.overall,
        result.confidence || 0,
        this.metrics.successfulTranslations
      );
    }
  }

  /**
   * Calculate rolling average
   * @param {number} currentAverage - Current average value
   * @param {number} newValue - New value to include
   * @param {number} count - Number of values
   * @returns {number} New rolling average
   */
  calculateRollingAverage(currentAverage, newValue, count) {
    if (count === 1) return newValue;
    return (currentAverage * (count - 1) + newValue) / count;
  }

  /**
   * Calculate overall confidence from all pipeline stages
   * @param {Object} result - Pipeline result
   * @returns {number} Overall confidence
   */
  calculateOverallConfidence(result) {
    const confidences = [];

    if (result.confidence?.stt) {
      confidences.push(result.confidence.stt);
    }

    if (result.confidence?.translation) {
      confidences.push(result.confidence.translation);
    }

    // If no confidences available, return 0
    if (confidences.length === 0) return 0;

    return confidences.reduce((sum, conf) => sum + conf, 0) / confidences.length;
  }

  /**
   * Handle component errors
   * @param {string} component - Component name
   * @param {Error} error - Error object
   */
  handleComponentError(component, error) {
    logger.error(`Error in ${component} component:`, error);

    // Emit error event
    this.emit('error', {
      component,
      message: error.message,
      timestamp: Date.now(),
      conversationId: this.conversationId,
    });
  }

  /**
   * Handle translation result
   * @param {Object} result - Translation result
   */
  handleTranslation(result) {
    // This is used for the event listener
    // Processing happens in processTranscription
  }

  /**
   * Handle TTS synthesis result
   * @param {Object} result - Synthesis result
   */
  handleSynthesis(result) {
    // This is used for the event listener
    // Processing happens in processTranslation
  }

  /**
   * Activate complete pipeline
   * @returns {Promise<boolean>} Success status
   */
  async activate() {
    try {
      if (this.active) {
        logger.warn('Pipeline is already active');
        return true;
      }

      // Generate new conversation ID
      this.conversationId = uuidv4();

      // Activate audio capture
      if (this.audioManager) {
        await this.audioManager.startCapture();
      }

      this.active = true;
      logger.info(`Complete pipeline activated (${this.conversationId})`);

      // Emit activation event
      this.emit('activated', {
        conversationId: this.conversationId,
        sourceLanguage: this.sourceLanguage,
        targetLanguage: this.targetLanguage,
      });

      return true;
    } catch (error) {
      logger.error('Error activating pipeline:', error);
      throw error;
    }
  }

  /**
   * Deactivate complete pipeline
   * @returns {Promise<boolean>} Success status
   */
  async deactivate() {
    try {
      if (!this.active) {
        logger.warn('Pipeline is not active');
        return true;
      }

      // Deactivate audio capture
      if (this.audioManager) {
        await this.audioManager.stopCapture();
      }

      this.active = false;
      logger.info('Complete pipeline deactivated');

      // Emit deactivation event
      this.emit('deactivated', {
        conversationId: this.conversationId,
      });

      return true;
    } catch (error) {
      logger.error('Error deactivating pipeline:', error);
      throw error;
    }
  }

  /**
   * Set pipeline languages
   * @param {string} sourceLanguage - Source language code
   * @param {string} targetLanguage - Target language code
   */
  setLanguages(sourceLanguage, targetLanguage) {
    this.sourceLanguage = sourceLanguage;
    this.targetLanguage = targetLanguage;

    console.log(`Pipeline languages set: ${sourceLanguage} → ${targetLanguage}`);

    // Update voice for target language
    this.getOptimalVoiceForLanguage(targetLanguage).then((voice) => {
      this.selectedVoice = voice;
      this.emit('voiceChanged', { voice, language: targetLanguage });
    });

    // Emit language change event
    this.emit('languagesChanged', {
      sourceLanguage,
      targetLanguage,
    });
  }

  /**
   * Set TTS voice
   * @param {string} voice - Voice ID
   */
  setVoice(voice) {
    this.selectedVoice = voice;
    console.log(`Pipeline voice set: ${voice} for ${this.targetLanguage}`);

    // Emit voice change event
    this.emit('voiceChanged', {
      voice,
      language: this.targetLanguage,
    });
  }

  /**
   * Swap languages and adjust voice
   */
  async swapLanguages() {
    const tempLang = this.sourceLanguage;
    this.sourceLanguage = this.targetLanguage;
    this.targetLanguage = tempLang;

    // Update voice for new target language
    this.selectedVoice = await this.getOptimalVoiceForLanguage(this.targetLanguage);

    console.log(`Languages swapped: ${this.sourceLanguage} → ${this.targetLanguage}`);

    // Emit events
    this.emit('languagesChanged', {
      sourceLanguage: this.sourceLanguage,
      targetLanguage: this.targetLanguage,
    });

    this.emit('voiceChanged', {
      voice: this.selectedVoice,
      language: this.targetLanguage,
    });
  }

  /**
   * Get optimal voice for language
   * @param {string} language - Language code
   * @returns {Promise<string>} Optimal voice ID
   */
  async getOptimalVoiceForLanguage(language) {
    if (!this.config.enableTTS || !this.ttsManager) return 'auto';

    try {
      const voiceInfo = await this.ttsManager.getVoice(language, {
        gender: this.config.voiceGender || 'auto',
      });

      return voiceInfo.id;
    } catch (error) {
      logger.error(`Error getting optimal voice for ${language}:`, error);
      return 'auto';
    }
  }

  /**
   * Process text directly (bypass audio input)
   * @param {string} text - Text to process
   * @param {string} fromLanguage - Source language
   * @param {string} toLanguage - Target language
   * @param {Object} options - Processing options
   * @returns {Promise<Object>} Processing result
   */
  async processTextDirect(text, fromLanguage, toLanguage, options = {}) {
    try {
      // Create simulated STT result
      const sttResult = {
        text,
        confidence: 1.0,
        sourceLanguage: fromLanguage,
        processingTime: 0,
        timestamp: Date.now(),
      };

      // Set languages if different
      if (fromLanguage !== this.sourceLanguage || toLanguage !== this.targetLanguage) {
        this.setLanguages(fromLanguage, toLanguage);
      }

      // Process through translation and TTS
      return await this.processTranscription(sttResult);
    } catch (error) {
      logger.error('Error processing text directly:', error);
      throw error;
    }
  }

  /**
   * Test complete pipeline
   * @param {string} testText - Test text to process
   * @param {string} testLanguage - Test language
   * @returns {Promise<Object>} Test result
   */
  async testPipeline(testText = null, testLanguage = 'en') {
    try {
      // Use provided text or get test text for language
      const text = testText || this.getTestText(testLanguage);

      // Process text through pipeline
      return await this.processTextDirect(text, testLanguage, this.targetLanguage, { test: true });
    } catch (error) {
      logger.error('Pipeline test failed:', error);
      throw error;
    }
  }

  /**
   * Get test text for language
   * @param {string} language - Language code
   * @returns {string} Test text
   */
  getTestText(language) {
    const testTexts = {
      en: 'Hello, this is a test of the real-time translation system.',
      es: 'Hola, esta es una prueba del sistema de traducción en tiempo real.',
      fr: 'Bonjour, ceci est un test du système de traduction en temps réel.',
      de: 'Hallo, dies ist ein Test des Echtzeit-Übersetzungssystems.',
      it: 'Ciao, questo è un test del sistema di traduzione in tempo reale.',
      ja: 'こんにちは、これはリアルタイム翻訳システムのテストです。',
      zh: '你好，这是实时翻译系统的测试。',
    };

    return testTexts[language] || testTexts['en'];
  }

  /**
   * Get supported languages across all components
   * @returns {Promise<Array>} Array of supported language codes
   */
  async getSupportedLanguages() {
    const languages = new Set();

    // Get languages from STT
    if (this.sttManager) {
      const sttLanguages = await this.sttManager.getSupportedLanguages();
      sttLanguages.forEach((lang) => languages.add(lang));
    }

    // Get languages from Translation
    if (this.translationManager) {
      const translationLanguages = await this.translationManager.getSupportedLanguages();
      translationLanguages.forEach((lang) => languages.add(lang));
    }

    // Get languages from TTS
    if (this.ttsManager) {
      const ttsLanguages = this.ttsManager.getSupportedLanguages();
      ttsLanguages.forEach((lang) => languages.add(lang));
    }

    return Array.from(languages).sort();
  }

  /**
   * Get pipeline status
   * @returns {Object} Pipeline status
   */
  getStatus() {
    return {
      active: this.active,
      conversationId: this.conversationId,
      sourceLanguage: this.sourceLanguage,
      targetLanguage: this.targetLanguage,
      selectedVoice: this.selectedVoice,
      metrics: this.metrics,
      components: {
        audio: !!this.audioManager,
        stt: !!this.sttManager,
        translation: !!this.translationManager,
        tts: !!this.ttsManager,
      },
      config: this.config,
    };
  }

  /**
   * Update pipeline configuration
   * @param {Object} newConfig - New configuration
   */
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    console.log('Complete pipeline configuration updated:', this.config);
  }

  /**
   * Export complete pipeline data
   * @returns {Object} Pipeline data for export
   */
  exportData() {
    return {
      config: this.config,
      metrics: this.metrics,
      languages: {
        source: this.sourceLanguage,
        target: this.targetLanguage,
      },
      voice: this.selectedVoice,
      timestamp: Date.now(),
    };
  }

  /**
   * Reset pipeline metrics
   */
  resetMetrics() {
    this.metrics = {
      totalProcessed: 0,
      successfulTranslations: 0,
      failedTranslations: 0,
      averageLatency: 0,
      stageLatencies: {
        stt: 0,
        translation: 0,
        tts: 0,
        total: 0,
      },
      confidence: {
        stt: 0,
        translation: 0,
        overall: 0,
      },
    };
  }

  /**
   * Cleanup complete pipeline
   */
  destroy() {
    // Deactivate pipeline
    if (this.active) {
      this.deactivate().catch((err) => {
        logger.error('Error deactivating pipeline during destroy:', err);
      });
    }

    // Clear platform detection interval
    if (this.platformDetectionInterval) {
      clearInterval(this.platformDetectionInterval);
      this.platformDetectionInterval = null;
    }

    // Remove event listeners
    this.removeAllListeners();

    console.log('Complete translation pipeline destroyed');
  }
}

module.exports = CompletePipeline;
