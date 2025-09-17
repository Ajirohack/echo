const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { Transform } = require('stream');
const logger = require('../../utils/logger');

// Custom error class for transcription errors
class TranscriptionError extends Error {
  constructor(message, originalError) {
    super(message);
    this.name = 'TranscriptionError';
    this.originalError = originalError;
  }
}

class WhisperSTT {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.initialized = false;
    this.openai = null;
    this.activeStreams = new Map();
    this.config = {
      model: 'whisper-1',
      temperature: 0,
      responseFormat: 'json',
      timeout: 30000, // 30 seconds
      maxRetries: 3,
      retryDelay: 1000, // 1 second
    };
  }

  async initialize() {
    try {
      if (!this.apiKey) {
        throw new Error('OpenAI API key is required for Whisper STT');
      }

      this.openai = new OpenAI({
        apiKey: this.apiKey,
        timeout: this.config.timeout,
        maxRetries: this.config.maxRetries,
      });

      // Test the API key by making a simple request
      try {
        // Use a lightweight model list request to test the API key
        await this.openai.models.list();
        logger.info('Whisper API initialized successfully');
      } catch (error) {
        logger.error('Failed to test OpenAI API key:', error);
        throw new Error(`OpenAI API key validation failed: ${error.message}`);
      }

      this.initialized = true;
      logger.info('Whisper STT service initialized successfully');
      return { success: true };
    } catch (error) {
      logger.error('Failed to initialize Whisper STT:', error);
      throw error;
    }
  }

  async transcribe(audioData, options = {}) {
    if (!this.initialized) {
      throw new Error('Whisper STT not initialized');
    }

    if (!this.openai) {
      throw new Error('OpenAI client not initialized');
    }

    let tempFilePath = null;
    let retryCount = 0;
    const maxRetries = options.maxRetries || this.config.maxRetries;
    const retryDelay = options.retryDelay || this.config.retryDelay;

    try {
      // Handle different audio data formats
      let audioFile;

      // Import TempFileManager
      const tempFileManager = require('../../utils/TempFileManager');

      if (Buffer.isBuffer(audioData)) {
        // Create temporary file from buffer using TempFileManager
        tempFilePath = tempFileManager.createTempFileWithContentSync(
          'whisper_audio',
          'wav',
          audioData
        );
        audioFile = fs.createReadStream(tempFilePath);
      } else if (typeof audioData === 'string') {
        // Assume it's a file path
        if (!fs.existsSync(audioData)) {
          throw new Error(`Audio file not found: ${audioData}`);
        }
        audioFile = fs.createReadStream(audioData);
      } else {
        throw new Error('Unsupported audio data format. Expected Buffer or file path.');
      }

      const transcriptionOptions = {
        file: audioFile,
        model: options.model || this.config.model,
        language: options.language || undefined,
        prompt: options.prompt || undefined,
        response_format: options.response_format || this.config.responseFormat,
        temperature:
          options.temperature !== undefined ? options.temperature : this.config.temperature,
      };

      logger.info('Starting Whisper transcription...');

      // Implement retry logic
      let transcription;
      let lastError;

      while (retryCount <= maxRetries) {
        try {
          if (retryCount > 0) {
            logger.info(`Retrying transcription (attempt ${retryCount} of ${maxRetries})...`);
            // Re-create the file stream for retry
            if (tempFilePath) {
              audioFile = fs.createReadStream(tempFilePath);
              transcriptionOptions.file = audioFile;
            } else if (typeof audioData === 'string') {
              audioFile = fs.createReadStream(audioData);
              transcriptionOptions.file = audioFile;
            }
          }

          transcription = await this.openai.audio.transcriptions.create(transcriptionOptions);
          break; // Success, exit the retry loop
        } catch (error) {
          lastError = error;

          // Check if the error is retryable
          if (this._isRetryableError(error) && retryCount < maxRetries) {
            retryCount++;
            logger.warn(
              `Transcription failed with retryable error: ${error.message}. Retrying in ${retryDelay}ms...`
            );
            await new Promise((resolve) => setTimeout(resolve, retryDelay));
          } else {
            // Not retryable or max retries reached
            throw error;
          }
        }
      }

      if (!transcription) {
        throw lastError || new Error('Failed to transcribe after retries');
      }

      logger.info('Whisper transcription completed successfully');

      return {
        text: transcription.text,
        language: transcription.language || options.language,
        confidence: this._calculateConfidence(transcription),
        provider: 'whisper',
        duration: transcription.duration,
        segments: transcription.segments,
      };
    } catch (error) {
      logger.error('Whisper transcription failed:', error);
      throw new TranscriptionError(`Whisper transcription failed: ${error.message}`, error);
    } finally {
      // Clean up temp file using TempFileManager
      if (tempFilePath) {
        try {
          tempFileManager.removeFile(tempFilePath);
        } catch (cleanupError) {
          logger.warn('Failed to cleanup temp audio file:', cleanupError);
        }
      }
    }
  }

  async getSupportedLanguages() {
    // Whisper supports many languages - returning common ones
    return [
      { code: 'en', name: 'English' },
      { code: 'es', name: 'Spanish' },
      { code: 'fr', name: 'French' },
      { code: 'de', name: 'German' },
      { code: 'it', name: 'Italian' },
      { code: 'pt', name: 'Portuguese' },
      { code: 'ru', name: 'Russian' },
      { code: 'zh', name: 'Chinese' },
      { code: 'ja', name: 'Japanese' },
      { code: 'ko', name: 'Korean' },
      { code: 'ar', name: 'Arabic' },
      { code: 'hi', name: 'Hindi' },
    ];
  }

  /**
   * Start a streaming transcription
   * @param {ReadableStream} audioStream - Audio stream to transcribe
   * @param {Object} options - Streaming options
   * @returns {string} Stream ID
   */
  async streamingTranscribe(audioStream, options = {}) {
    if (!this.initialized) {
      throw new Error('Whisper STT not initialized');
    }

    if (!this.openai) {
      throw new Error('OpenAI client not initialized');
    }

    const streamId = options.streamId || uuidv4();
    const { onData, onError, onEnd } = options;

    if (!onData || !onError || !onEnd) {
      throw new Error('Callbacks (onData, onError, onEnd) are required for streaming');
    }

    try {
      // Create a transform stream to buffer audio chunks
      const chunks = [];
      const transformStream = new Transform({
        transform(chunk, encoding, callback) {
          chunks.push(chunk);
          callback(null, chunk);
        },
      });

      // Pipe the audio stream through the transform stream
      audioStream.pipe(transformStream);

      // Store the stream for later cleanup
      this.activeStreams.set(streamId, {
        stream: transformStream,
        chunks,
      });

      // Set up event handlers
      audioStream.on('end', async () => {
        try {
          // Combine all chunks into a single buffer
          const audioBuffer = Buffer.concat(chunks);

          // Import TempFileManager if not already imported
          const tempFileManager = require('../../utils/TempFileManager');

          // Transcribe the complete audio
          const result = await this.transcribe(audioBuffer, {
            ...options,
            model: options.model || this.config.model,
            language: options.language || undefined,
            response_format: 'verbose_json',
          });

          // Send the final result
          onData({
            text: result.text,
            language: result.language,
            confidence: result.confidence,
            isFinal: true,
            service: 'whisper',
            requestId: options.requestId || streamId,
          });

          // Signal the end of transcription
          onEnd({
            service: 'whisper',
            requestId: options.requestId || streamId,
          });

          // Clean up
          this.activeStreams.delete(streamId);
        } catch (error) {
          logger.error('Whisper streaming transcription error:', error);
          onError(error);
          this.activeStreams.delete(streamId);
        }
      });

      audioStream.on('error', (error) => {
        logger.error('Audio stream error:', error);
        onError(error);
        this.activeStreams.delete(streamId);
      });

      return streamId;
    } catch (error) {
      logger.error('Failed to start Whisper streaming:', error);
      throw new Error(`Failed to start Whisper streaming: ${error.message}`);
    }
  }

  /**
   * Stop a streaming transcription
   * @param {string} streamId - Stream ID to stop
   * @returns {Promise<boolean>} True if stopped successfully
   */
  async stopStreaming(streamId) {
    try {
      if (this.activeStreams.has(streamId)) {
        const { stream } = this.activeStreams.get(streamId);
        if (stream && typeof stream.destroy === 'function') {
          stream.destroy();
        }
        this.activeStreams.delete(streamId);
        return true;
      }
      return false;
    } catch (error) {
      logger.error(`Error stopping stream ${streamId}:`, error);
      return false;
    }
  }

  /**
   * Calculate confidence score from transcription result
   * @private
   */
  _calculateConfidence(transcription) {
    // Whisper doesn't provide confidence scores directly
    // We could implement a heuristic based on segment confidence if available
    if (transcription.segments && transcription.segments.length > 0) {
      // If segments with confidence are available, average them
      const confidences = transcription.segments
        .filter((segment) => segment.confidence !== undefined)
        .map((segment) => segment.confidence);

      if (confidences.length > 0) {
        return confidences.reduce((sum, conf) => sum + conf, 0) / confidences.length;
      }
    }

    // Default confidence
    return 1.0;
  }

  /**
   * Check if an error is retryable
   * @private
   */
  _isRetryableError(error) {
    // Network errors, rate limits, and server errors are retryable
    if (!error) return false;

    // Check for network errors
    if (
      error.code === 'ECONNRESET' ||
      error.code === 'ETIMEDOUT' ||
      error.code === 'ESOCKETTIMEDOUT' ||
      error.code === 'ECONNREFUSED'
    ) {
      return true;
    }

    // Check for rate limits
    if (error.status === 429) {
      return true;
    }

    // Check for server errors (5xx)
    if (error.status >= 500 && error.status < 600) {
      return true;
    }

    return false;
  }
}

module.exports = WhisperSTT;
