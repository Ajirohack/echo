const EventEmitter = require('events');
const TranslationService = require('./translation-service');
const logger = require('../../utils/logger');

/**
 * TranslationPipeline handles the complete translation flow from audio input to translated text
 */
class TranslationPipeline extends EventEmitter {
  /**
   * Create a new TranslationPipeline
   * @param {Object} options - Configuration options
   * @param {string} [options.sourceLanguage='en'] - Default source language
   * @param {string} [options.targetLanguage='es'] - Default target language
   * @param {Object} [options.translationService] - Optional translation service instance
   * @param {Object} [options.sttService] - Optional speech-to-text service instance
   */
  constructor({
    sourceLanguage = 'en',
    targetLanguage = 'es',
    translationService = null,
    sttService = null,
  } = {}) {
    super();

    this.sourceLanguage = sourceLanguage;
    this.targetLanguage = targetLanguage;
    this.isProcessing = false;
    this.audioContext = null;
    this.mediaRecorder = null;
    this.audioChunks = [];

    // Initialize services
    this.translationService = translationService || new TranslationService();
    this.sttService = sttService || this.createDefaultSTTService();

    // Bind methods
    this.start = this.start.bind(this);
    this.stop = this.stop.bind(this);
    this.reset = this.reset.bind(this);
    this.updateLanguages = this.updateLanguages.bind(this);
    this.handleDataAvailable = this.handleDataAvailable.bind(this);
    this.handleStop = this.handleStop.bind(this);
  }

  /**
   * Create a default STT service if none provided
   * @private
   */
  createDefaultSTTService() {
    try {
      const WhisperSTT = require('../stt/whisper');
      const config = require('../../../config/services.json');
      const openaiApiKey = process.env.OPENAI_API_KEY || config?.openai?.apiKey;

      if (!openaiApiKey) {
        logger.warn('No OpenAI API key found for default STT service');
        return {
          transcribe: async (audioBlob) => {
            throw new Error('OpenAI API key required for default STT service');
          },
        };
      }

      const whisperService = new WhisperSTT(openaiApiKey);

      // Initialize the service
      whisperService.initialize().catch((error) => {
        logger.error('Failed to initialize default STT service:', error);
      });

      return {
        transcribe: async (audioBlob, options = {}) => {
          try {
            if (!whisperService.initialized) {
              await whisperService.initialize();
            }

            const result = await whisperService.transcribe(audioBlob, options);
            return result;
          } catch (error) {
            logger.error('Error in default STT service transcription:', error);
            throw error;
          }
        },
      };
    } catch (error) {
      logger.error('Failed to create default STT service:', error);
      return {
        transcribe: async (audioBlob) => {
          throw new Error(`STT service initialization failed: ${error.message}`);
        },
      };
    }
  }

  /**
   * Start the translation pipeline with audio recording
   * @returns {Promise<void>}
   */
  async start() {
    if (this.isProcessing) {
      throw new Error('Translation pipeline is already running');
    }

    try {
      this.isProcessing = true;
      this.audioChunks = [];

      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Set up audio context
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();

      // Set up media recorder
      this.mediaRecorder = new MediaRecorder(stream);
      this.mediaRecorder.ondataavailable = this.handleDataAvailable;
      this.mediaRecorder.onstop = this.handleStop;

      // Start recording
      this.mediaRecorder.start();

      this.emit('start');
      return true;
    } catch (error) {
      this.isProcessing = false;
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Stop the translation pipeline
   */
  async stop() {
    if (!this.isProcessing || !this.mediaRecorder) {
      return;
    }

    try {
      // Remove event listeners first
      if (this.mediaRecorder.removeEventListener) {
        this.mediaRecorder.removeEventListener('dataavailable', this.handleDataAvailable);
        this.mediaRecorder.removeEventListener('stop', this.handleStop);
      }

      // Stop recording if not already inactive
      if (this.mediaRecorder.state !== 'inactive') {
        this.mediaRecorder.stop();
      }

      // Stop all tracks in the stream
      if (this.mediaRecorder.stream) {
        this.mediaRecorder.stream.getTracks().forEach((track) => track.stop());
      }

      // Close audio context
      if (this.audioContext && this.audioContext.state !== 'closed') {
        await this.audioContext.close();
      }

      this.emit('stop');
    } catch (error) {
      this.emit('error', error);
      throw error;
    } finally {
      this.isProcessing = false;
      this.mediaRecorder = null;
      this.audioContext = null;
    }
  }

  /**
   * Reset the pipeline to its initial state
   */
  reset() {
    if (this.isProcessing) {
      this.stop().catch(console.error);
    }
    this.audioChunks = [];
    this.emit('reset');
  }

  /**
   * Update source and target languages
   * @param {Object} options - Language options
   * @param {string} [options.sourceLanguage] - New source language
   * @param {string} [options.targetLanguage] - New target language
   */
  updateLanguages({ sourceLanguage, targetLanguage }) {
    if (sourceLanguage) this.sourceLanguage = sourceLanguage;
    if (targetLanguage) this.targetLanguage = targetLanguage;
    this.emit('languagesUpdated', {
      sourceLanguage: this.sourceLanguage,
      targetLanguage: this.targetLanguage,
    });
  }

  /**
   * Handle data available event from MediaRecorder
   * @private
   */
  handleDataAvailable(event) {
    if (event.data.size > 0) {
      this.audioChunks.push(event.data);
    }
  }

  /**
   * Translate text from source to target language
   * @param {string} text - The text to translate
   * @param {string} sourceLanguage - Source language code
   * @param {string} targetLanguage - Target language code
   * @returns {Promise<string>} The translated text
   */
  async translateText(text, sourceLanguage, targetLanguage) {
    if (!text) {
      throw new Error('No text provided for translation');
    }

    try {
      this.emit('translationStarted');
      const translatedText = await this.translationService.translate(
        text,
        sourceLanguage || this.sourceLanguage,
        targetLanguage || this.targetLanguage
      );

      this.emit('translation', {
        originalText: text,
        translatedText,
        sourceLanguage: sourceLanguage || this.sourceLanguage,
        targetLanguage: targetLanguage || this.targetLanguage,
      });

      return translatedText;
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Handle stop event from MediaRecorder
   * @private
   */
  async handleStop() {
    if (this.audioChunks.length === 0) {
      this.emit('error', new Error('No audio data recorded'));
      return;
    }

    try {
      // Create audio blob
      const audioBlob = new Blob(this.audioChunks, { type: 'audio/wav' });

      // Emit audio data
      this.emit('audioData', audioBlob);

      // Transcribe audio
      this.emit('transcriptionStarted');
      const transcription = await this.sttService.transcribe(audioBlob, this.sourceLanguage);
      this.emit('transcription', transcription);

      // Handle empty transcription
      if (!transcription || !transcription.text) {
        throw new Error('No transcription returned from STT service');
      }

      // Translate text
      this.emit('translationStarted');
      const translatedText = await this.translationService.translate(
        transcription.text,
        this.sourceLanguage,
        this.targetLanguage
      );

      // Emit complete result
      const result = {
        originalText: transcription.text,
        translatedText,
        sourceLanguage: this.sourceLanguage,
        targetLanguage: this.targetLanguage,
        timestamp: new Date().toISOString(),
        audioBlob,
      };

      this.emit('translationComplete', result);
    } catch (error) {
      this.emit('error', error);
    } finally {
      this.audioChunks = [];
    }
  }
}

module.exports = TranslationPipeline;
