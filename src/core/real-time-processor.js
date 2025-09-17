/**
 * Real-Time Processor
 * Complete real-time processing engine that orchestrates audio capture,
 * speech recognition, translation, and text-to-speech in real-time.
 */

const TranslationPipeline = require('./translation-pipeline');
const AudioManager = require('../audio/AudioManager');
const EventEmitter = require('events');
const { v4: uuidv4 } = require('uuid');

class RealTimeProcessor extends EventEmitter {
  constructor(config = {}) {
    super();

    // Configuration
    this.config = {
      autoStart: false,
      bufferSize: 4096,
      sampleRate: 44100,
      channels: 1,
      useContinuousRecognition: true,
      maxLatency: 3000, // Maximum acceptable latency in ms
      adaptiveBuffering: true,
      qualityMode: 'balanced', // 'speed', 'balanced', 'quality'
      vadEnabled: true, // Voice Activity Detection
      ...config,
    };

    // Core components
    this.translationPipeline = new TranslationPipeline();
    this.audioManager = new AudioManager();

    // Processing state
    this.isActive = false;
    this.isInitialized = false;
    this.processingSession = null;
    this.audioBuffer = [];
    this.isListening = false;
    this.isSpeaking = false;
    this.languagePairs = [];

    // Metrics
    this.metrics = {
      totalSessions: 0,
      totalProcessingTime: 0,
      averageLatency: 0,
      bufferUnderflows: 0,
      bufferOverflows: 0,
      vadTriggersCount: 0,
      processingErrors: 0,
    };
  }

  /**
   * Initialize the real-time processor
   *
   * @returns {Promise<object>} Initialization result
   */
  async initialize() {
    try {
      console.log('Initializing real-time processor...');

      // Initialize components
      const audioInitResult = await this.audioManager.initialize();
      const pipelineInitResult = await this.translationPipeline.initialize();

      // Set up event handlers
      this.setupEventHandlers();

      // Get supported language pairs
      this.languagePairs = await this.translationPipeline.getSupportedLanguagePairs();

      this.isInitialized = true;

      // Auto-start if configured
      if (this.config.autoStart) {
        await this.start();
      }

      return {
        success: true,
        audio: audioInitResult,
        pipeline: pipelineInitResult,
        supportedLanguagePairs: this.languagePairs.length,
      };
    } catch (error) {
      console.error('Real-time processor initialization failed:', error);
      throw error;
    }
  }

  /**
   * Set up event handlers for components
   */
  setupEventHandlers() {
    // Audio events
    this.audioManager.on('audioData', this.handleAudioData.bind(this));
    this.audioManager.on('voiceActivityStart', this.handleVoiceActivityStart.bind(this));
    this.audioManager.on('voiceActivityEnd', this.handleVoiceActivityEnd.bind(this));
    this.audioManager.on('error', this.handleAudioError.bind(this));

    // Pipeline events
    this.translationPipeline.on('pipelineResult', this.handlePipelineResult.bind(this));
    this.translationPipeline.on('pipelineError', this.handlePipelineError.bind(this));
    this.translationPipeline.on('languagesChanged', this.handleLanguagesChanged.bind(this));
  }

  /**
   * Start real-time processing
   *
   * @param {object} options - Start options
   * @returns {Promise<object>} Start result
   */
  async start(options = {}) {
    try {
      if (!this.isInitialized) {
        throw new Error('Real-time processor not initialized');
      }

      // Create new processing session
      this.processingSession = {
        id: uuidv4(),
        startTime: Date.now(),
        sourceLanguage: options.sourceLanguage || this.translationPipeline.sourceLanguage,
        targetLanguage: options.targetLanguage || this.translationPipeline.targetLanguage,
        metrics: {
          segments: 0,
          totalDuration: 0,
          averageLatency: 0,
        },
      };

      // Set languages in pipeline
      this.translationPipeline.setLanguages(
        this.processingSession.sourceLanguage,
        this.processingSession.targetLanguage
      );

      // Activate pipeline
      await this.translationPipeline.activate();

      // Start audio capture
      await this.audioManager.startCapture({
        bufferSize: this.config.bufferSize,
        sampleRate: this.config.sampleRate,
        channels: this.config.channels,
        vadEnabled: this.config.vadEnabled,
      });

      this.isActive = true;
      this.isListening = true;
      this.metrics.totalSessions++;

      this.emit('processorStarted', {
        sessionId: this.processingSession.id,
        sourceLanguage: this.processingSession.sourceLanguage,
        targetLanguage: this.processingSession.targetLanguage,
        timestamp: Date.now(),
      });

      return {
        success: true,
        sessionId: this.processingSession.id,
      };
    } catch (error) {
      console.error('Failed to start real-time processor:', error);
      this.emit('processorError', {
        stage: 'start',
        error: error.message,
        timestamp: Date.now(),
      });

      throw error;
    }
  }

  /**
   * Stop real-time processing
   *
   * @returns {Promise<object>} Stop result
   */
  async stop() {
    try {
      if (!this.isActive) {
        return { success: true, alreadyStopped: true };
      }

      // Stop audio capture
      await this.audioManager.stopCapture();

      // Process any remaining audio
      if (this.audioBuffer.length > 0) {
        await this.processAudioBuffer();
      }

      // Deactivate pipeline
      await this.translationPipeline.deactivate();

      // Finalize session
      if (this.processingSession) {
        this.processingSession.endTime = Date.now();
        this.processingSession.duration =
          this.processingSession.endTime - this.processingSession.startTime;

        this.emit('processorStopped', {
          sessionId: this.processingSession.id,
          duration: this.processingSession.duration,
          segments: this.processingSession.metrics.segments,
          averageLatency: this.processingSession.metrics.averageLatency,
          timestamp: Date.now(),
        });
      }

      this.isActive = false;
      this.isListening = false;
      this.audioBuffer = [];

      return {
        success: true,
        sessionId: this.processingSession?.id,
        duration: this.processingSession?.duration,
      };
    } catch (error) {
      console.error('Failed to stop real-time processor:', error);
      this.emit('processorError', {
        stage: 'stop',
        error: error.message,
        timestamp: Date.now(),
      });

      // Force reset state
      this.isActive = false;
      this.isListening = false;
      this.audioBuffer = [];

      throw error;
    }
  }

  /**
   * Pause real-time processing
   *
   * @returns {Promise<object>} Pause result
   */
  async pause() {
    try {
      if (!this.isActive) {
        throw new Error('Processor not active');
      }

      await this.audioManager.pauseCapture();
      this.isListening = false;

      this.emit('processorPaused', {
        sessionId: this.processingSession?.id,
        timestamp: Date.now(),
      });

      return { success: true };
    } catch (error) {
      console.error('Failed to pause processor:', error);
      throw error;
    }
  }

  /**
   * Resume real-time processing
   *
   * @returns {Promise<object>} Resume result
   */
  async resume() {
    try {
      if (!this.isActive) {
        throw new Error('Processor not active');
      }

      await this.audioManager.resumeCapture();
      this.isListening = true;

      this.emit('processorResumed', {
        sessionId: this.processingSession?.id,
        timestamp: Date.now(),
      });

      return { success: true };
    } catch (error) {
      console.error('Failed to resume processor:', error);
      throw error;
    }
  }

  /**
   * Switch source and target languages
   *
   * @returns {Promise<object>} Switch result
   */
  async switchLanguages() {
    try {
      this.translationPipeline.swapLanguages();

      // Update session languages
      if (this.processingSession) {
        const temp = this.processingSession.sourceLanguage;
        this.processingSession.sourceLanguage = this.processingSession.targetLanguage;
        this.processingSession.targetLanguage = temp;
      }

      return {
        success: true,
        sourceLanguage: this.translationPipeline.sourceLanguage,
        targetLanguage: this.translationPipeline.targetLanguage,
      };
    } catch (error) {
      console.error('Failed to switch languages:', error);
      throw error;
    }
  }

  /**
   * Set source and target languages
   *
   * @param {string} sourceLanguage - Source language code
   * @param {string} targetLanguage - Target language code
   * @returns {Promise<object>} Set language result
   */
  async setLanguages(sourceLanguage, targetLanguage) {
    try {
      // Check if language pair is supported
      const isPairSupported = this.isLanguagePairSupported(sourceLanguage, targetLanguage);

      if (!isPairSupported) {
        console.warn(
          `Language pair ${sourceLanguage}-${targetLanguage} may not be fully supported`
        );
      }

      this.translationPipeline.setLanguages(sourceLanguage, targetLanguage);

      // Update session languages
      if (this.processingSession) {
        this.processingSession.sourceLanguage = sourceLanguage;
        this.processingSession.targetLanguage = targetLanguage;
      }

      return {
        success: true,
        sourceLanguage,
        targetLanguage,
        fullySupported: isPairSupported,
      };
    } catch (error) {
      console.error('Failed to set languages:', error);
      throw error;
    }
  }

  /**
   * Check if language pair is supported
   *
   * @param {string} sourceLanguage - Source language code
   * @param {string} targetLanguage - Target language code
   * @returns {boolean} Whether pair is supported
   */
  isLanguagePairSupported(sourceLanguage, targetLanguage) {
    const pair = `${sourceLanguage}-${targetLanguage}`;
    return this.languagePairs.includes(pair);
  }

  /**
   * Process text directly (bypass STT)
   *
   * @param {string} text - Text to translate
   * @param {object} options - Processing options
   * @returns {Promise<object>} Processing result
   */
  async processText(text, options = {}) {
    try {
      if (!this.isInitialized) {
        throw new Error('Processor not initialized');
      }

      const sourceLanguage = options.sourceLanguage || this.translationPipeline.sourceLanguage;
      const targetLanguage = options.targetLanguage || this.translationPipeline.targetLanguage;

      const result = await this.translationPipeline.processTextDirect(
        text,
        sourceLanguage,
        targetLanguage,
        options
      );

      return result;
    } catch (error) {
      console.error('Text processing failed:', error);
      this.emit('processorError', {
        stage: 'text-processing',
        error: error.message,
        timestamp: Date.now(),
      });

      throw error;
    }
  }

  /**
   * Handle incoming audio data
   *
   * @param {object} data - Audio data event
   */
  handleAudioData(data) {
    if (!this.isActive || !this.isListening) return;

    // Add to buffer
    this.audioBuffer.push(data.buffer);

    // Process buffer if VAD is disabled or if buffer is large enough
    if (!this.config.vadEnabled || this.audioBuffer.length >= 5) {
      this.processAudioBuffer().catch((error) => {
        console.error('Error processing audio buffer:', error);
      });
    }
  }

  /**
   * Process the current audio buffer
   *
   * @returns {Promise<void>}
   */
  async processAudioBuffer() {
    if (this.audioBuffer.length === 0) return;

    try {
      // Combine buffers
      const combinedBuffer = Buffer.concat(this.audioBuffer);
      this.audioBuffer = [];

      // Process through pipeline
      await this.translationPipeline.startPipeline(combinedBuffer, {
        source: 'real-time',
        sourceLanguage: this.processingSession.sourceLanguage,
        targetLanguage: this.processingSession.targetLanguage,
        continuousMode: this.config.useContinuousRecognition,
      });

      // Update session metrics
      if (this.processingSession) {
        this.processingSession.metrics.segments++;
      }
    } catch (error) {
      console.error('Failed to process audio buffer:', error);
      this.metrics.processingErrors++;

      this.emit('processorError', {
        stage: 'audio-processing',
        error: error.message,
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Handle voice activity start event
   */
  handleVoiceActivityStart() {
    if (!this.isActive) return;

    this.emit('voiceActivityStart', {
      sessionId: this.processingSession?.id,
      timestamp: Date.now(),
    });

    this.metrics.vadTriggersCount++;
  }

  /**
   * Handle voice activity end event
   */
  handleVoiceActivityEnd(data) {
    if (!this.isActive) return;

    this.emit('voiceActivityEnd', {
      sessionId: this.processingSession?.id,
      duration: data.duration,
      timestamp: Date.now(),
    });

    // Process the collected audio
    this.processAudioBuffer().catch((error) => {
      console.error('Error processing audio after voice activity:', error);
    });
  }

  /**
   * Handle audio error
   *
   * @param {object} error - Audio error
   */
  handleAudioError(error) {
    this.emit('processorError', {
      stage: 'audio',
      error: error.message,
      timestamp: Date.now(),
    });
  }

  /**
   * Handle pipeline result
   *
   * @param {object} event - Pipeline result event
   */
  handlePipelineResult(event) {
    if (event.type === 'complete') {
      // Update latency metrics
      const latency = event.result.processingTime.total;

      if (this.metrics.averageLatency === 0) {
        this.metrics.averageLatency = latency;
      } else {
        this.metrics.averageLatency = this.metrics.averageLatency * 0.8 + latency * 0.2;
      }

      if (this.processingSession) {
        if (this.processingSession.metrics.averageLatency === 0) {
          this.processingSession.metrics.averageLatency = latency;
        } else {
          this.processingSession.metrics.averageLatency =
            this.processingSession.metrics.averageLatency * 0.8 + latency * 0.2;
        }

        this.processingSession.metrics.totalDuration += latency;
      }

      // Emit real-time result
      this.emit('realTimeResult', {
        ...event.result,
        processor: {
          sessionId: this.processingSession?.id,
          latency: latency,
          timestamp: Date.now(),
        },
      });
    }
  }

  /**
   * Handle pipeline error
   *
   * @param {object} error - Pipeline error
   */
  handlePipelineError(error) {
    this.emit('processorError', {
      ...error,
      sessionId: this.processingSession?.id,
      timestamp: Date.now(),
    });
  }

  /**
   * Handle languages changed event
   *
   * @param {object} data - Languages changed data
   */
  handleLanguagesChanged(data) {
    this.emit('languagesChanged', {
      ...data,
      sessionId: this.processingSession?.id,
      timestamp: Date.now(),
    });
  }

  /**
   * Get processor status and metrics
   *
   * @returns {object} Status and metrics
   */
  getStatus() {
    return {
      isActive: this.isActive,
      isListening: this.isListening,
      session: this.processingSession
        ? {
            id: this.processingSession.id,
            sourceLanguage: this.processingSession.sourceLanguage,
            targetLanguage: this.processingSession.targetLanguage,
            duration: this.processingSession.endTime
              ? this.processingSession.endTime - this.processingSession.startTime
              : Date.now() - this.processingSession.startTime,
            segments: this.processingSession.metrics.segments,
          }
        : null,
      components: {
        audio: this.audioManager.getStatus(),
        pipeline: this.translationPipeline.getStatus(),
      },
      metrics: this.metrics,
      config: this.config,
    };
  }

  /**
   * Export session data
   *
   * @returns {object} Session export data
   */
  exportSessionData() {
    if (!this.processingSession) {
      return { error: 'No active session' };
    }

    return {
      session: {
        id: this.processingSession.id,
        sourceLanguage: this.processingSession.sourceLanguage,
        targetLanguage: this.processingSession.targetLanguage,
        startTime: this.processingSession.startTime,
        endTime: this.processingSession.endTime || Date.now(),
        duration: this.processingSession.endTime
          ? this.processingSession.endTime - this.processingSession.startTime
          : Date.now() - this.processingSession.startTime,
        metrics: this.processingSession.metrics,
      },
      metrics: this.metrics,
      translations: this.translationPipeline.getTranslationHistory(),
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Update processor configuration
   *
   * @param {object} newConfig - New configuration
   * @returns {object} Updated configuration
   */
  updateConfig(newConfig) {
    this.config = {
      ...this.config,
      ...newConfig,
    };

    return this.config;
  }

  /**
   * Reset metrics
   */
  resetMetrics() {
    this.metrics = {
      totalSessions: 0,
      totalProcessingTime: 0,
      averageLatency: 0,
      bufferUnderflows: 0,
      bufferOverflows: 0,
      vadTriggersCount: 0,
      processingErrors: 0,
    };
  }

  /**
   * Cleanup all resources
   */
  destroy() {
    // Stop if active
    if (this.isActive) {
      this.stop().catch(console.error);
    }

    // Cleanup components
    if (this.translationPipeline) {
      this.translationPipeline.destroy();
    }

    if (this.audioManager) {
      this.audioManager.destroy();
    }

    // Reset state
    this.isActive = false;
    this.isInitialized = false;
    this.audioBuffer = [];
    this.processingSession = null;

    // Remove event listeners
    this.removeAllListeners();
  }
}

module.exports = RealTimeProcessor;
