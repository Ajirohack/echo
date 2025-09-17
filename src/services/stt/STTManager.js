const EventEmitter = require('events');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const { promisify } = require('util');
const { v4: uuidv4 } = require('uuid');
const WhisperSTT = require('./services/WhisperSTT');
const AzureSTT = require('./services/AzureSTT');
const GoogleSTT = require('./services/GoogleSTT');
const GPT4oSTT = require('./services/GPT4oSTT');
const LanguageDetector = require('./utils/LanguageDetector');
const logger = require('../../utils/logger');

const execAsync = promisify(exec);

class STTManager extends EventEmitter {
  constructor(config = {}) {
    super();
    this.config = {
      preferredServices: ['whisper', 'azure', 'google', 'gpt4o'],
      fallbackOrder: ['whisper', 'azure', 'google', 'gpt4o'],
      language: 'auto',
      autoDetectLanguage: true,
      confidenceThreshold: 0.7,
      maxRetries: 2,
      ...config,
    };

    // Import TempFileManager
    this.tempFileManager = require('../../utils/TempFileManager');

    // Initialize services
    this.services = {
      whisper: new WhisperSTT(config.whisper || {}),
      azure: new AzureSTT(config.azure || {}),
      google: new GoogleSTT(config.google || {}),
      gpt4o: new GPT4oSTT(config.gpt4o || {}),
    };

    this.languageDetector = new LanguageDetector();
    this.activeTranscriptions = new Map();
    this.serviceStatus = {
      whisper: { available: false, lastError: null, lastCheck: 0 },
      azure: { available: false, lastError: null, lastCheck: 0 },
      google: { available: false, lastError: null, lastCheck: 0 },
      gpt4o: { available: false, lastError: null, lastCheck: 0 },
    };

    // Ensure temp directory exists
    if (!fs.existsSync(this.config.tempDir)) {
      fs.mkdirSync(this.config.tempDir, { recursive: true });
    }

    // Initialize services
    this.initializeServices();
  }

  /**
   * Initialize all STT services and check their availability
   */
  async initializeServices() {
    logger.info('Initializing STT services...');

    // Check service availability in parallel
    await Promise.all(
      Object.entries(this.services).map(async ([serviceName, service]) => {
        try {
          const isAvailable = await service.initialize();
          this.serviceStatus[serviceName] = {
            available: isAvailable,
            lastError: null,
            lastCheck: Date.now(),
            ...(isAvailable ? { lastSuccess: Date.now() } : {}),
          };

          if (isAvailable) {
            logger.info(`${serviceName.toUpperCase()} STT service initialized successfully`);
          } else {
            logger.warn(`${serviceName.toUpperCase()} STT service initialization failed`);
          }
        } catch (error) {
          this.serviceStatus[serviceName] = {
            available: false,
            lastError: error.message,
            lastCheck: Date.now(),
          };
          logger.error(`Error initializing ${serviceName} STT service:`, error);
        }
      })
    );

    // Log service status
    this.logServiceStatus();
  }

  /**
   * Log current status of all services
   */
  logServiceStatus() {
    logger.info('STT Service Status:', {
      services: Object.entries(this.serviceStatus).reduce(
        (acc, [name, status]) => ({
          ...acc,
          [name]: {
            available: status.available,
            lastCheck: new Date(status.lastCheck).toISOString(),
            ...(status.lastError && { lastError: status.lastError }),
          },
        }),
        {}
      ),
    });
  }

  /**
   * Get the best available service based on configuration and service status
   * @param {string} [preferredService] - Preferred service to use if available
   * @returns {Object} Selected service and its name
   */
  getBestAvailableService(preferredService) {
    // If a preferred service is specified and available, use it
    if (preferredService && this.serviceStatus[preferredService]?.available) {
      return {
        service: this.services[preferredService],
        serviceName: preferredService,
      };
    }

    // Otherwise, use the first available service in the fallback order
    const availableService = this.config.fallbackOrder.find(
      (service) => this.serviceStatus[service]?.available
    );

    if (!availableService) {
      throw new Error('No STT services available');
    }

    return {
      service: this.services[availableService],
      serviceName: availableService,
    };
  }

  /**
   * Transcribe audio using the best available service
   * @param {Buffer|string} audioData - Audio data or file path
   * @param {Object} options - Transcription options
   * @returns {Promise<Object>} Transcription result
   */
  async transcribe(audioData, options = {}) {
    const requestId = options.requestId || uuidv4();
    const language = options.language || this.config.language;
    const preferredService = options.service;
    const isStream = options.isStream || false;

    try {
      // Get the best available service
      const { service, serviceName } = this.getBestAvailableService(preferredService);

      logger.info(`Starting transcription with ${serviceName.toUpperCase()} service`, {
        requestId,
        language,
        isStream,
      });

      // Prepare transcription options
      const transcriptionOptions = {
        ...options,
        language,
        requestId,
        isStream,
      };

      // Start transcription
      let result;
      if (isStream && typeof service.streamingTranscribe === 'function') {
        // Use streaming transcription if available
        result = await this.handleStreamingTranscription(service, audioData, transcriptionOptions);
      } else {
        // Use batch transcription
        result = await this.handleBatchTranscription(service, audioData, transcriptionOptions);
      }

      // Update service status on success
      this.serviceStatus[serviceName] = {
        ...this.serviceStatus[serviceName],
        lastSuccess: Date.now(),
        lastError: null,
      };

      // Emit completion event
      this.emit('transcriptionComplete', {
        requestId,
        result,
        service: serviceName,
        language: result.language || language,
      });

      return result;
    } catch (error) {
      logger.error('Transcription failed:', error);

      // Update service status on error
      if (serviceName) {
        this.serviceStatus[serviceName] = {
          ...this.serviceStatus[serviceName],
          available: false,
          lastError: error.message,
          lastCheck: Date.now(),
        };
      }

      // Emit error event
      this.emit('error', {
        requestId,
        error: error.message,
        service: serviceName,
        language,
      });

      // If this was a preferred service, retry with fallback
      if (preferredService && serviceName === preferredService) {
        logger.warn(`Retrying with fallback service after ${serviceName} failed`);
        return this.transcribe(audioData, {
          ...options,
          service: null, // Remove preferred service to use fallback
          requestId, // Keep the same request ID
        });
      }

      throw error;
    }
  }

  /**
   * Handle batch transcription
   * @private
   */
  async handleBatchTranscription(service, audioData, options) {
    // Save audio data to a temporary file if it's a buffer
    const audioPath = await this.prepareAudioFile(audioData, options);

    try {
      // Perform transcription
      let result = await service.transcribe(audioPath, options);

      // If language is auto, detect it
      if (options.language === 'auto' || !result.language) {
        const detectedLang = await this.languageDetector.detect(result.text);
        result.language = detectedLang.language;
        result.languageConfidence = detectedLang.confidence;
      } else {
        result.language = options.language;
      }

      return result;
    } finally {
      // Clean up temporary file using TempFileManager
      if (audioPath && !audioPath.includes('..')) {
        this.tempFileManager.removeFile(audioPath);
      }
    }
  }

  /**
   * Handle streaming transcription
   * @private
   */
  async handleStreamingTranscription(service, audioStream, options) {
    return new Promise((resolve, reject) => {
      const requestId = options.requestId || uuidv4();
      const transcriptionId = `stream-${requestId}`;

      // Create a transcription session
      const session = {
        id: transcriptionId,
        startTime: Date.now(),
        text: '',
        isFinal: false,
        interimResults: [],
        finalResults: [],
        language: options.language,
        service: options.service,
      };

      this.activeTranscriptions.set(transcriptionId, session);

      // Handle transcription events
      const onData = (data) => {
        // Update session with new data
        if (data.text) {
          session.text = data.text;
          session.isFinal = data.isFinal || false;

          if (data.isFinal) {
            session.finalResults.push(data.text);

            // If language is auto, detect it from the final result
            if (session.language === 'auto' || !data.language) {
              this.languageDetector
                .detect(data.text)
                .then(({ language, confidence }) => {
                  session.language = language;
                  session.languageConfidence = confidence;

                  this.emit('transcriptionUpdate', {
                    ...session,
                    language,
                    languageConfidence: confidence,
                  });
                })
                .catch((error) => {
                  logger.error('Language detection failed:', error);
                });
            }
          } else {
            session.interimResults.push(data.text);
          }

          // Emit update event
          this.emit('transcriptionUpdate', {
            ...session,
            ...data,
          });
        }
      };

      const onError = (error) => {
        logger.error('Streaming transcription error:', error);
        this.emit('error', {
          requestId,
          error: error.message,
          service: options.service,
          language: options.language,
        });
        reject(error);
      };

      const onEnd = () => {
        session.endTime = Date.now();
        session.duration = session.endTime - session.startTime;
        session.isFinal = true;

        this.emit('transcriptionComplete', {
          ...session,
          isFinal: true,
        });

        this.activeTranscriptions.delete(transcriptionId);
        resolve(session);
      };

      // Start streaming transcription
      service.streamingTranscribe(audioStream, {
        ...options,
        onData,
        onError,
        onEnd,
      });
    });
  }

  /**
   * Prepare audio file for processing
   * @private
   */
  async prepareAudioFile(audioData, options) {
    // If audioData is already a file path, return it
    if (typeof audioData === 'string' && fs.existsSync(audioData)) {
      return audioData;
    }

    // If audioData is a buffer, create a temporary file using TempFileManager
    if (Buffer.isBuffer(audioData)) {
      return await this.tempFileManager.createTempFile(audioData, 'stt_audio', 'wav');
    }

    // If audioData is a stream, pipe it to a temporary file
    if (typeof audioData.pipe === 'function') {
      // Create an empty temporary file
      const tempFilePath = await this.tempFileManager.createTempFile(
        Buffer.from([]),
        'stt_stream',
        'wav'
      );
      const writeStream = fs.createWriteStream(tempFilePath);
      audioData.pipe(writeStream);

      return new Promise((resolve, reject) => {
        writeStream.on('finish', () => resolve(tempFilePath));
        writeStream.on('error', (err) => {
          this.tempFileManager.removeFile(tempFilePath);
          reject(err);
        });
      });
    }

    throw new Error('Unsupported audio data format');
  }

  /**
   * Stop all active transcriptions
   */
  async stopAll() {
    logger.info('Stopping all active transcriptions');

    // Stop all active streaming transcriptions
    for (const [id, session] of this.activeTranscriptions.entries()) {
      try {
        if (session.service && typeof session.service.stopStreaming === 'function') {
          await session.service.stopStreaming(id);
        }
      } catch (error) {
        logger.error(`Error stopping transcription ${id}:`, error);
      }

      this.activeTranscriptions.delete(id);
    }

    // Emit event for each stopped transcription
    this.emit('allStopped', {
      count: this.activeTranscriptions.size,
    });
  }

  /**
   * Get the current status of all services
   * @returns {Object} Service status information
   */
  getServiceStatus() {
    return { ...this.serviceStatus };
  }

  /**
   * Clean up resources
   */
  async destroy() {
    logger.info('Destroying STT manager');

    // Stop all active transcriptions
    await this.stopAll();

    // Clean up services
    await Promise.all(
      Object.values(this.services).map((service) =>
        service.destroy ? service.destroy() : Promise.resolve()
      )
    );

    // Clear all event listeners
    this.removeAllListeners();

    logger.info('STT manager destroyed');
  }
}

module.exports = STTManager;
