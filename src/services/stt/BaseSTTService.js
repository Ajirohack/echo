const EventEmitter = require('events');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const logger = require('../../utils/logger');

/**
 * Base class for all STT services
 */
class BaseSTTService extends EventEmitter {
  constructor(config = {}) {
    super();
    this.config = {
      name: 'base',
      supportedLanguages: [],
      requiresApiKey: true,
      maxAudioLength: 60 * 60 * 4, // 4 hours in seconds
      maxFileSize: 100 * 1024 * 1024, // 100MB
      streaming: false,
      ...config
    };
    
    this.isInitialized = false;
    this.activeStreams = new Map();
  }

  /**
   * Initialize the service
   * @returns {Promise<boolean>} True if initialization was successful
   */
  async initialize() {
    try {
      // Validate configuration
      if (this.config.requiresApiKey && !this.config.apiKey) {
        throw new Error('API key is required for this service');
      }
      
      // Perform service-specific initialization
      await this._initialize();
      
      this.isInitialized = true;
      logger.info(`${this.config.name.toUpperCase()} STT service initialized`);
      return true;
    } catch (error) {
      logger.error(`Failed to initialize ${this.config.name} STT service:`, error);
      this.isInitialized = false;
      throw error;
    }
  }

  /**
   * Service-specific initialization
   * @protected
   */
  async _initialize() {
    // To be implemented by subclasses
  }

  /**
   * Check if the service supports a specific language
   * @param {string} language - Language code (e.g., 'en-US')
   * @returns {boolean} True if the language is supported
   */
  supportsLanguage(language) {
    if (!language || language === 'auto') return true;
    return this.config.supportedLanguages.includes(language);
  }

  /**
   * Transcribe audio from a file or buffer
   * @param {string|Buffer} audioData - Path to audio file or audio buffer
   * @param {Object} options - Transcription options
   * @returns {Promise<Object>} Transcription result
   */
  async transcribe(audioData, options = {}) {
    if (!this.isInitialized) {
      throw new Error('Service not initialized');
    }

    const requestId = options.requestId || uuidv4();
    const language = options.language || 'en-US';
    
    try {
      // Validate input
      await this._validateInput(audioData);
      
      // Convert audio to the required format if needed
      const processedAudio = await this._preprocessAudio(audioData, options);
      
      // Perform the transcription
      const result = await this._transcribe(processedAudio, {
        ...options,
        requestId,
        language
      });
      
      return {
        text: result.text || '',
        language: result.language || language,
        confidence: result.confidence || 1.0,
        isFinal: true,
        service: this.config.name,
        requestId,
        ...result
      };
    } catch (error) {
      logger.error(`Transcription failed (${this.config.name}):`, error);
      throw new Error(`[${this.config.name}] ${error.message}`);
    }
  }

  /**
   * Start a streaming transcription
   * @param {ReadableStream} audioStream - Audio stream to transcribe
   * @param {Object} options - Streaming options
   * @param {Function} options.onData - Callback for transcription results
   * @param {Function} options.onError - Callback for errors
   * @param {Function} options.onEnd - Callback when transcription ends
   * @returns {Promise<string>} Stream ID
   */
  async streamingTranscribe(audioStream, options = {}) {
    if (!this.isInitialized) {
      throw new Error('Service not initialized');
    }
    
    if (!this.config.streaming) {
      throw new Error('Streaming not supported by this service');
    }
    
    const streamId = options.streamId || uuidv4();
    
    try {
      await this._startStreaming(audioStream, {
        ...options,
        streamId
      });
      
      return streamId;
    } catch (error) {
      logger.error(`Streaming transcription failed (${this.config.name}):`, error);
      throw new Error(`[${this.config.name}] ${error.message}`);
    }
  }

  /**
   * Stop a streaming transcription
   * @param {string} streamId - Stream ID to stop
   * @returns {Promise<boolean>} True if stopped successfully
   */
  async stopStreaming(streamId) {
    if (!this.isInitialized) {
      return false;
    }
    
    try {
      if (this.activeStreams.has(streamId)) {
        const stream = this.activeStreams.get(streamId);
        if (stream && typeof stream.destroy === 'function') {
          stream.destroy();
        }
        this.activeStreams.delete(streamId);
      }
      
      await this._stopStreaming(streamId);
      return true;
    } catch (error) {
      logger.error(`Error stopping stream ${streamId}:`, error);
      return false;
    }
  }

  /**
   * Validate input audio data
   * @private
   */
  async _validateInput(audioData) {
    // Check if audio data is provided
    if (!audioData) {
      throw new Error('No audio data provided');
    }
    
    // Check file size if it's a file path
    if (typeof audioData === 'string') {
      const stats = await fs.promises.stat(audioData).catch(() => null);
      if (!stats || !stats.isFile()) {
        throw new Error('Invalid audio file');
      }
      
      if (stats.size > this.config.maxFileSize) {
        throw new Error(`Audio file too large (max ${this.config.maxFileSize / (1024 * 1024)}MB)`);
      }
    }
    
    // Check buffer size if it's a buffer
    if (Buffer.isBuffer(audioData) && audioData.length > this.config.maxFileSize) {
      throw new Error(`Audio buffer too large (max ${this.config.maxFileSize / (1024 * 1024)}MB)`);
    }
    
    // Additional format validation can be added here
  }

  /**
   * Preprocess audio data if needed
   * @private
   */
  async _preprocessAudio(audioData, options) {
    // Default implementation just returns the input
    // Subclasses can override this to perform format conversion, resampling, etc.
    return audioData;
  }

  /**
   * Service-specific transcription implementation
   * @private
   */
  async _transcribe(audioData, options) {
    throw new Error('Not implemented');
  }
  
  /**
   * Service-specific streaming implementation
   * @private
   */
  async _startStreaming(audioStream, options) {
    throw new Error('Streaming not implemented');
  }
  
  /**
   * Service-specific stream stopping implementation
   * @private
   */
  async _stopStreaming(streamId) {
    // Default implementation does nothing
  }

  /**
   * Clean up resources
   */
  async destroy() {
    // Stop all active streams
    await Promise.all(
      Array.from(this.activeStreams.keys()).map(streamId => 
        this.stopStreaming(streamId)
      )
    );
    
    // Clear all event listeners
    this.removeAllListeners();
    
    this.isInitialized = false;
  }
}

module.exports = BaseSTTService;
