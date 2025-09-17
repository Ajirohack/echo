import EventEmitter from 'events';
import { EchoRTCConfig } from './config.js';
import { EchoRTCAudioProcessor } from './audio-processor.js';

/**
 * RealTimeTranslationPipeline - Handles real-time translation processing for echo RTC
 * Integrates audio processing, speech recognition, translation, and synthesis
 */
export class RealTimeTranslationPipeline extends EventEmitter {
  constructor(config = null) {
    super();

    this.config = config || EchoRTCConfig.getInstance();
    this.translationConfig = this.config.get('translation');

    // Pipeline components
    this.audioProcessor = null;
    this.speechRecognizer = null;
    this.translator = null;
    this.speechSynthesizer = null;

    // Pipeline state
    this.isActive = false;
    this.currentLanguage = 'auto';
    this.targetLanguages = [];
    this.processingMode = 'realtime'; // 'realtime' | 'batch' | 'hybrid'

    // Processing queues
    this.audioQueue = [];
    this.recognitionQueue = [];
    this.translationQueue = [];
    this.synthesisQueue = [];

    // Pipeline statistics
    this.stats = {
      totalProcessed: 0,
      successfulTranslations: 0,
      failedTranslations: 0,
      averageLatency: 0,
      totalLatency: 0,
      startTime: null,
      lastProcessedAt: null,
    };

    // Active sessions and contexts
    this.activeSessions = new Map();
    this.translationContexts = new Map();

    // Quality and performance monitoring
    this.qualityMetrics = {
      recognitionAccuracy: 0,
      translationQuality: 0,
      synthesisQuality: 0,
      endToEndLatency: 0,
      throughput: 0,
    };

    this._setupEventHandlers();
  }

  /**
   * Initialize the translation pipeline
   */
  async initialize(options = {}) {
    try {
      console.log('Initializing RealTimeTranslationPipeline...');

      // Initialize audio processor
      this.audioProcessor = new EchoRTCAudioProcessor(this.config);
      await this.audioProcessor.initialize();

      // Initialize speech recognition
      await this._initializeSpeechRecognition(options.recognition);

      // Initialize translator
      await this._initializeTranslator(options.translation);

      // Initialize speech synthesis
      await this._initializeSpeechSynthesis(options.synthesis);

      // Setup pipeline connections
      this._setupPipelineConnections();

      // Initialize quality monitoring
      this._initializeQualityMonitoring();

      this.emit('initialized');
      console.log('RealTimeTranslationPipeline initialized successfully');
    } catch (error) {
      console.error('Failed to initialize translation pipeline:', error);
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Start the translation pipeline
   */
  async startPipeline(sessionConfig) {
    try {
      if (this.isActive) {
        console.warn('Translation pipeline already active');
        return;
      }

      console.log('Starting translation pipeline...', sessionConfig);

      this.isActive = true;
      this.stats.startTime = Date.now();

      // Configure session
      const sessionId = sessionConfig.sessionId || this._generateSessionId();
      this.activeSessions.set(sessionId, {
        ...sessionConfig,
        startTime: Date.now(),
        status: 'active',
      });

      // Set languages
      this.currentLanguage = sessionConfig.sourceLanguage || 'auto';
      this.targetLanguages = sessionConfig.targetLanguages || [];
      this.processingMode = sessionConfig.mode || 'realtime';

      // Start audio processing
      if (sessionConfig.mediaStream) {
        await this.audioProcessor.startProcessing(sessionConfig.mediaStream);
      }

      // Start pipeline processing
      this._startPipelineProcessing();

      // Start quality monitoring
      this._startQualityMonitoring();

      this.emit('pipelineStarted', { sessionId, config: sessionConfig });
      console.log('Translation pipeline started successfully');

      return sessionId;
    } catch (error) {
      console.error('Failed to start translation pipeline:', error);
      this.isActive = false;
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Stop the translation pipeline
   */
  async stopPipeline(sessionId = null) {
    try {
      console.log('Stopping translation pipeline...', sessionId);

      if (sessionId) {
        // Stop specific session
        const session = this.activeSessions.get(sessionId);
        if (session) {
          session.status = 'stopped';
          session.endTime = Date.now();
          this.activeSessions.delete(sessionId);
        }
      } else {
        // Stop all sessions
        this.activeSessions.clear();
      }

      // Stop if no active sessions
      if (this.activeSessions.size === 0) {
        this.isActive = false;

        // Stop audio processing
        if (this.audioProcessor) {
          await this.audioProcessor.stopProcessing();
        }

        // Clear processing queues
        this._clearProcessingQueues();

        // Stop quality monitoring
        this._stopQualityMonitoring();
      }

      this.emit('pipelineStopped', { sessionId });
      console.log('Translation pipeline stopped');
    } catch (error) {
      console.error('Failed to stop translation pipeline:', error);
      this.emit('error', error);
    }
  }

  /**
   * Process audio for translation
   */
  async processAudio(audioData, options = {}) {
    try {
      if (!this.isActive) {
        throw new Error('Translation pipeline not active');
      }

      const startTime = performance.now();
      const sessionId = options.sessionId || this._getDefaultSessionId();

      // Create processing context
      const context = {
        id: Date.now() + Math.random(),
        sessionId,
        audioData,
        timestamp: Date.now(),
        startTime,
        options: {
          sourceLanguage: options.sourceLanguage || this.currentLanguage,
          targetLanguages: options.targetLanguages || this.targetLanguages,
          priority: options.priority || 'normal',
          ...options,
        },
      };

      // Add to processing queue
      this.audioQueue.push(context);

      // Process through pipeline
      const result = await this._processThroughPipeline(context);

      // Update statistics
      const totalLatency = performance.now() - startTime;
      this._updateStatistics(totalLatency, true);

      this.emit('audioProcessed', {
        context,
        result,
        latency: totalLatency,
      });

      return result;
    } catch (error) {
      console.error('Failed to process audio:', error);
      this._updateStatistics(0, false);
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Update pipeline configuration
   */
  updateConfiguration(newConfig) {
    try {
      console.log('Updating pipeline configuration...', newConfig);

      // Update languages
      if (newConfig.sourceLanguage) {
        this.currentLanguage = newConfig.sourceLanguage;
      }

      if (newConfig.targetLanguages) {
        this.targetLanguages = newConfig.targetLanguages;
      }

      if (newConfig.mode) {
        this.processingMode = newConfig.mode;
      }

      // Update component configurations
      if (newConfig.audio && this.audioProcessor) {
        this.audioProcessor.updateConfig(newConfig.audio);
      }

      // Update translation config
      if (newConfig.translation) {
        Object.assign(this.translationConfig, newConfig.translation);
      }

      this.emit('configurationUpdated', newConfig);
    } catch (error) {
      console.error('Failed to update configuration:', error);
      this.emit('error', error);
    }
  }

  /**
   * Get pipeline statistics
   */
  getStatistics() {
    const runtime = this.stats.startTime ? Date.now() - this.stats.startTime : 0;

    return {
      ...this.stats,
      runtime,
      successRate:
        this.stats.totalProcessed > 0
          ? (this.stats.successfulTranslations / this.stats.totalProcessed) * 100
          : 0,
      throughput: runtime > 0 ? (this.stats.totalProcessed / runtime) * 1000 : 0,
      activeSessions: this.activeSessions.size,
      queueSizes: {
        audio: this.audioQueue.length,
        recognition: this.recognitionQueue.length,
        translation: this.translationQueue.length,
        synthesis: this.synthesisQueue.length,
      },
    };
  }

  /**
   * Get quality metrics
   */
  getQualityMetrics() {
    return {
      ...this.qualityMetrics,
      audioQuality: this.audioProcessor ? this.audioProcessor.getQualityMetrics() : null,
    };
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
   * Initialize speech recognition
   */
  async _initializeSpeechRecognition(options = {}) {
    try {
      // Mock speech recognition for demo
      this.speechRecognizer = {
        recognize: async (audioData, language = 'auto') => {
          // Simulate speech recognition processing
          await new Promise((resolve) => setTimeout(resolve, 50));

          return {
            text: `[Recognized speech from ${language}]`,
            confidence: 0.85 + Math.random() * 0.15,
            language: language === 'auto' ? 'en-US' : language,
            timestamp: Date.now(),
          };
        },
      };

      console.log('Speech recognition initialized (mock)');
    } catch (error) {
      console.error('Failed to initialize speech recognition:', error);
      throw error;
    }
  }

  /**
   * Initialize translator
   */
  async _initializeTranslator(options = {}) {
    try {
      // Mock translator for demo
      this.translator = {
        translate: async (text, sourceLanguage, targetLanguage) => {
          // Simulate translation processing
          await new Promise((resolve) => setTimeout(resolve, 100));

          return {
            translatedText: `[Translated: ${text} (${sourceLanguage} -> ${targetLanguage})]`,
            confidence: 0.8 + Math.random() * 0.2,
            sourceLanguage,
            targetLanguage,
            timestamp: Date.now(),
          };
        },
      };

      console.log('Translator initialized (mock)');
    } catch (error) {
      console.error('Failed to initialize translator:', error);
      throw error;
    }
  }

  /**
   * Initialize speech synthesis
   */
  async _initializeSpeechSynthesis(options = {}) {
    try {
      // Mock speech synthesis for demo
      this.speechSynthesizer = {
        synthesize: async (text, language, voice = null) => {
          // Simulate speech synthesis processing
          await new Promise((resolve) => setTimeout(resolve, 75));

          return {
            audioData: new Float32Array(1024), // Mock audio data
            duration: 2000, // Mock duration in ms
            language,
            voice: voice || 'default',
            timestamp: Date.now(),
          };
        },
      };

      console.log('Speech synthesis initialized (mock)');
    } catch (error) {
      console.error('Failed to initialize speech synthesis:', error);
      throw error;
    }
  }

  /**
   * Setup pipeline connections
   */
  _setupPipelineConnections() {
    // Connect audio processor events
    if (this.audioProcessor) {
      this.audioProcessor.on('chunkProcessed', (data) => {
        this._handleAudioChunk(data.chunk);
      });

      this.audioProcessor.on('qualityUpdated', (metrics) => {
        this.qualityMetrics = { ...this.qualityMetrics, ...metrics };
      });
    }
  }

  /**
   * Initialize quality monitoring
   */
  _initializeQualityMonitoring() {
    this.qualityMonitoringInterval = null;
  }

  /**
   * Start quality monitoring
   */
  _startQualityMonitoring() {
    this.qualityMonitoringInterval = setInterval(() => {
      this._updateQualityMetrics();
    }, this.translationConfig.qualityCheckInterval || 2000);
  }

  /**
   * Stop quality monitoring
   */
  _stopQualityMonitoring() {
    if (this.qualityMonitoringInterval) {
      clearInterval(this.qualityMonitoringInterval);
      this.qualityMonitoringInterval = null;
    }
  }

  /**
   * Start pipeline processing
   */
  _startPipelineProcessing() {
    const processLoop = async () => {
      if (!this.isActive) return;

      try {
        // Process audio queue
        while (this.audioQueue.length > 0) {
          const context = this.audioQueue.shift();
          await this._processAudioContext(context);
        }

        // Process recognition queue
        while (this.recognitionQueue.length > 0) {
          const context = this.recognitionQueue.shift();
          await this._processRecognitionContext(context);
        }

        // Process translation queue
        while (this.translationQueue.length > 0) {
          const context = this.translationQueue.shift();
          await this._processTranslationContext(context);
        }

        // Process synthesis queue
        while (this.synthesisQueue.length > 0) {
          const context = this.synthesisQueue.shift();
          await this._processSynthesisContext(context);
        }

        // Schedule next iteration
        setTimeout(processLoop, 10);
      } catch (error) {
        console.error('Error in pipeline processing loop:', error);
        this.emit('error', error);
      }
    };

    processLoop();
  }

  /**
   * Process through entire pipeline
   */
  async _processThroughPipeline(context) {
    try {
      // Step 1: Audio processing (already done by audio processor)
      const audioResult = context.audioData;

      // Step 2: Speech recognition
      const recognitionResult = await this.speechRecognizer.recognize(
        audioResult,
        context.options.sourceLanguage
      );

      // Step 3: Translation
      const translations = [];
      for (const targetLang of context.options.targetLanguages) {
        const translation = await this.translator.translate(
          recognitionResult.text,
          recognitionResult.language,
          targetLang
        );
        translations.push(translation);
      }

      // Step 4: Speech synthesis (optional)
      const syntheses = [];
      if (context.options.synthesize) {
        for (const translation of translations) {
          const synthesis = await this.speechSynthesizer.synthesize(
            translation.translatedText,
            translation.targetLanguage
          );
          syntheses.push(synthesis);
        }
      }

      return {
        recognition: recognitionResult,
        translations,
        syntheses,
        processingTime: Date.now() - context.timestamp,
      };
    } catch (error) {
      console.error('Error processing through pipeline:', error);
      throw error;
    }
  }

  /**
   * Handle audio chunk from processor
   */
  _handleAudioChunk(chunk) {
    // Add to recognition queue for processing
    this.recognitionQueue.push({
      ...chunk,
      type: 'recognition',
    });
  }

  /**
   * Process audio context
   */
  async _processAudioContext(context) {
    // Audio processing is handled by EchoRTCAudioProcessor
    // Move to recognition queue
    this.recognitionQueue.push({
      ...context,
      type: 'recognition',
    });
  }

  /**
   * Process recognition context
   */
  async _processRecognitionContext(context) {
    try {
      const result = await this.speechRecognizer.recognize(
        context.audioData,
        context.options.sourceLanguage
      );

      // Move to translation queue
      this.translationQueue.push({
        ...context,
        recognition: result,
        type: 'translation',
      });
    } catch (error) {
      console.error('Recognition processing error:', error);
      this.emit('recognitionError', { context, error });
    }
  }

  /**
   * Process translation context
   */
  async _processTranslationContext(context) {
    try {
      const translations = [];

      for (const targetLang of context.options.targetLanguages) {
        const translation = await this.translator.translate(
          context.recognition.text,
          context.recognition.language,
          targetLang
        );
        translations.push(translation);
      }

      // Emit translation result
      this.emit('translationComplete', {
        context,
        translations,
        latency: Date.now() - context.timestamp,
      });

      // Move to synthesis queue if needed
      if (context.options.synthesize) {
        this.synthesisQueue.push({
          ...context,
          translations,
          type: 'synthesis',
        });
      }
    } catch (error) {
      console.error('Translation processing error:', error);
      this.emit('translationError', { context, error });
    }
  }

  /**
   * Process synthesis context
   */
  async _processSynthesisContext(context) {
    try {
      const syntheses = [];

      for (const translation of context.translations) {
        const synthesis = await this.speechSynthesizer.synthesize(
          translation.translatedText,
          translation.targetLanguage
        );
        syntheses.push(synthesis);
      }

      // Emit synthesis result
      this.emit('synthesisComplete', {
        context,
        syntheses,
        latency: Date.now() - context.timestamp,
      });
    } catch (error) {
      console.error('Synthesis processing error:', error);
      this.emit('synthesisError', { context, error });
    }
  }

  /**
   * Update quality metrics
   */
  _updateQualityMetrics() {
    try {
      // Update end-to-end latency
      this.qualityMetrics.endToEndLatency = this.stats.averageLatency;

      // Update throughput
      const runtime = this.stats.startTime ? Date.now() - this.stats.startTime : 0;
      this.qualityMetrics.throughput =
        runtime > 0 ? (this.stats.totalProcessed / runtime) * 1000 : 0;

      // Emit quality update
      this.emit('qualityMetricsUpdated', this.qualityMetrics);
    } catch (error) {
      console.error('Error updating quality metrics:', error);
    }
  }

  /**
   * Update statistics
   */
  _updateStatistics(latency, success) {
    this.stats.totalProcessed++;
    this.stats.lastProcessedAt = Date.now();

    if (success) {
      this.stats.successfulTranslations++;
      this.stats.totalLatency += latency;
      this.stats.averageLatency = this.stats.totalLatency / this.stats.successfulTranslations;
    } else {
      this.stats.failedTranslations++;
    }
  }

  /**
   * Clear processing queues
   */
  _clearProcessingQueues() {
    this.audioQueue = [];
    this.recognitionQueue = [];
    this.translationQueue = [];
    this.synthesisQueue = [];
  }

  /**
   * Generate session ID
   */
  _generateSessionId() {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get default session ID
   */
  _getDefaultSessionId() {
    const sessions = Array.from(this.activeSessions.keys());
    return sessions.length > 0 ? sessions[0] : this._generateSessionId();
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    try {
      console.log('Cleaning up RealTimeTranslationPipeline...');

      // Stop pipeline
      await this.stopPipeline();

      // Cleanup audio processor
      if (this.audioProcessor) {
        await this.audioProcessor.cleanup();
        this.audioProcessor = null;
      }

      // Clear all data
      this.activeSessions.clear();
      this.translationContexts.clear();
      this._clearProcessingQueues();

      // Stop quality monitoring
      this._stopQualityMonitoring();

      this.emit('cleanup');
      console.log('RealTimeTranslationPipeline cleanup completed');
    } catch (error) {
      console.error('Error during cleanup:', error);
      this.emit('error', error);
    }
  }
}

export default RealTimeTranslationPipeline;
