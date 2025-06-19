const speech = require('@google-cloud/speech').v1p1beta1;
const { Readable } = require('stream');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const BaseSTTService = require('../BaseSTTService');
const logger = require('../../../utils/logger');

class GoogleSTT extends BaseSTTService {
  constructor(config = {}) {
    super({
      name: 'google',
      supportedLanguages: [
        'af-ZA', 'am-ET', 'hy-AM', 'az-AZ', 'id-ID', 'ms-MY', 'bn-BD', 'bn-IN', 'ca-ES', 'cs-CZ',
        'da-DK', 'de-DE', 'en-AU', 'en-CA', 'en-GH', 'en-GB', 'en-IN', 'en-IE', 'en-KE', 'en-NZ',
        'en-NG', 'en-PH', 'en-ZA', 'en-TZ', 'en-US', 'es-AR', 'es-BO', 'es-CL', 'es-CO', 'es-CR',
        'es-EC', 'es-SV', 'es-ES', 'es-US', 'es-GT', 'es-HN', 'es-MX', 'es-NI', 'es-PA', 'es-PY',
        'es-PE', 'es-PR', 'es-DO', 'es-UY', 'es-VE', 'eu-ES', 'fil-PH', 'fr-CA', 'fr-FR', 'gl-ES',
        'ka-GE', 'gu-IN', 'hr-HR', 'zu-ZA', 'is-IS', 'it-IT', 'jv-ID', 'kn-IN', 'km-KH', 'lo-LA',
        'lv-LV', 'lt-LT', 'hu-HU', 'ml-IN', 'mr-IN', 'nl-NL', 'ne-NP', 'nb-NO', 'pl-PL', 'pt-BR',
        'pt-PT', 'ro-RO', 'si-LK', 'sk-SK', 'sl-SI', 'su-ID', 'sw-TZ', 'sw-KE', 'fi-FI', 'sv-SE',
        'ta-IN', 'ta-SG', 'ta-LK', 'ta-MY', 'te-IN', 'vi-VN', 'tr-TR', 'ur-PK', 'ur-IN', 'el-GR',
        'bg-BG', 'ru-RU', 'sr-RS', 'uk-UA', 'he-IL', 'ar-IL', 'ar-JO', 'ar-AE', 'ar-BH', 'ar-DZ',
        'ar-SA', 'ar-KW', 'ar-MA', 'ar-TN', 'ar-OM', 'ar-PS', 'ar-QA', 'ar-LB', 'ar-EG', 'fa-IR',
        'hi-IN', 'th-TH', 'ko-KR', 'cmn-Hans-CN', 'cmn-Hans-HK', 'cmn-Hant-TW', 'yue-Hant-HK', 'ja-JP'
      ],
      requiresApiKey: true,
      languageCode: 'en-US',
      sampleRateHertz: 16000,
      encoding: 'LINEAR16',
      audioChannelCount: 1,
      enableAutomaticPunctuation: true,
      model: 'default',
      useEnhanced: true,
      ...config
    });

    this.client = null;
  }

  async _initialize() {
    try {
      // Create a client with the provided credentials
      const credentials = this.config.credentials || {
        keyFilename: this.config.keyFilename,
        projectId: this.config.projectId
      };

      if (!credentials.keyFilename && !credentials.projectId && !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        throw new Error('Google Cloud credentials are required. Set GOOGLE_APPLICATION_CREDENTIALS or provide credentials in config.');
      }

      this.client = new speech.SpeechClient(credentials);
      
      // Test the connection with a simple request
      await this.client.listRecognizers({
        parent: `projects/${this.client.projectId}/locations/global`
      });
      
      logger.info('Google Cloud Speech-to-Text client initialized successfully');
      return true;
    } catch (error) {
      logger.error('Failed to initialize Google Cloud Speech-to-Text:', error);
      throw new Error(`Google Cloud Speech-to-Text initialization failed: ${error.message}`);
    }
  }

  async _transcribe(audioData, options = {}) {
    const {
      languageCode = this.config.languageCode,
      sampleRateHertz = this.config.sampleRateHertz,
      encoding = this.config.encoding,
      audioChannelCount = this.config.audioChannelCount,
      enableAutomaticPunctuation = this.config.enableAutomaticPunctuation,
      model = this.config.model,
      useEnhanced = this.config.useEnhanced,
      requestId = uuidv4()
    } = options;

    try {
      // Prepare audio data
      let audioContent;
      if (Buffer.isBuffer(audioData)) {
        audioContent = audioData;
      } else if (typeof audioData === 'string' && fs.existsSync(audioData)) {
        audioContent = fs.readFileSync(audioData);
      } else {
        throw new Error('Invalid audio data format');
      }

      // Configure the request
      const request = {
        audio: {
          content: audioContent.toString('base64'),
        },
        config: {
          encoding: encoding,
          sampleRateHertz: sampleRateHertz,
          languageCode: languageCode,
          audioChannelCount: audioChannelCount,
          enableAutomaticPunctuation: enableAutomaticPunctuation,
          model: model,
          useEnhanced: useEnhanced,
          enableWordTimeOffsets: true,
          enableWordConfidence: true,
          metadata: {
            interactionType: 'DICTATION',
            microphoneDistance: 'NEARFIELD',
            recordingDeviceType: 'SMARTPHONE',
            recordingDeviceName: 'Universal Translator',
            industryNaicsCodeOfAudio: 512290 // Software publishing
          }
        },
      };

      logger.debug(`Sending request to Google Cloud Speech-to-Text (${requestId})`);
      
      // Detect the operation type (long-running or streaming)
      const isLongRunning = audioContent.length > 60000; // 1 minute threshold
      
      let response;
      if (isLongRunning) {
        // For long audio, use long-running recognition
        const [operation] = await this.client.longRunningRecognize(request);
        logger.debug(`Long-running operation started: ${operation.name}`);
        response = await operation.promise();
      } else {
        // For short audio, use synchronous recognition
        [response] = await this.client.recognize(request);
      }

      // Process the response
      return this._processResponse(response, {
        languageCode,
        requestId,
        isLongRunning
      });
    } catch (error) {
      logger.error('Google Cloud Speech-to-Text error:', error);
      throw new Error(`Google Cloud Speech-to-Text error: ${error.message}`);
    }
  }

  async _startStreaming(audioStream, options = {}) {
    const { onData, onError, onEnd } = options;
    const streamId = options.streamId || uuidv4();
    
    try {
      // Configure the streaming request
      const request = {
        config: {
          encoding: this.config.encoding,
          sampleRateHertz: this.config.sampleRateHertz,
          languageCode: options.languageCode || this.config.languageCode,
          enableAutomaticPunctuation: this.config.enableAutomaticPunctuation,
          model: this.config.model,
          useEnhanced: this.config.useEnhanced,
          enableWordTimeOffsets: true,
          enableWordConfidence: true,
          metadata: {
            interactionType: 'DICTATION',
            microphoneDistance: 'NEARFIELD',
            recordingDeviceType: 'SMARTPHONE',
            recordingDeviceName: 'Universal Translator',
            industryNaicsCodeOfAudio: 512290 // Software publishing
          }
        },
        interimResults: true, // Get interim results
        singleUtterance: false
      };

      // Create a recognize stream
      const recognizeStream = this.client
        .streamingRecognize(request)
        .on('error', (error) => {
          logger.error('Google Cloud Speech-to-Text streaming error:', error);
          onError(error);
        })
        .on('data', (data) => {
          if (data.error) {
            logger.error('Google Cloud Speech-to-Text API error:', data.error);
            onError(new Error(data.error.message));
            return;
          }

          // Process the transcription result
          const isFinal = data.results[0]?.isFinal || false;
          const transcript = data.results[0]?.alternatives[0]?.transcript || '';
          const confidence = data.results[0]?.alternatives[0]?.confidence || 0;
          const languageCode = data.languageCode || request.config.languageCode;

          if (transcript) {
            onData({
              text: transcript,
              confidence,
              isFinal,
              language: languageCode,
              service: 'google',
              requestId: options.requestId,
              raw: data
            });
          }

          // If this is the final result and the stream should end
          if (isFinal && data.speechEventType === 'END_OF_SINGLE_UTTERANCE') {
            onEnd();
          }
        });

      // Store the stream for cleanup
      this.activeStreams.set(streamId, recognizeStream);

      // Pipe the audio stream to the recognizer
      audioStream.pipe(recognizeStream);
      
      // Handle stream end
      audioStream.on('end', () => {
        logger.debug('Audio stream ended, finishing recognition');
        recognizeStream.end();
        this.activeStreams.delete(streamId);
        onEnd();
      });

      // Handle stream errors
      audioStream.on('error', (error) => {
        logger.error('Audio stream error:', error);
        recognizeStream.destroy();
        this.activeStreams.delete(streamId);
        onError(error);
      });

      return streamId;
    } catch (error) {
      logger.error('Error starting Google Cloud Speech-to-Text streaming:', error);
      onError(error);
      throw error;
    }
  }

  async _stopStreaming(streamId) {
    const stream = this.activeStreams.get(streamId);
    if (stream) {
      try {
        if (stream.destroy) {
          stream.destroy();
        } else if (stream.end) {
          stream.end();
        }
      } catch (error) {
        logger.error('Error stopping Google Cloud Speech-to-Text stream:', error);
      } finally {
        this.activeStreams.delete(streamId);
      }
    }
  }

  _processResponse(response, options = {}) {
    const { languageCode, requestId, isLongRunning = false } = options;
    
    // Handle empty response
    if (!response || !response.results || response.results.length === 0) {
      return {
        text: '',
        language: languageCode,
        confidence: 0,
        isFinal: true,
        service: 'google',
        requestId,
        segments: [],
        duration: 0,
        raw: response
      };
    }

    // Combine all results
    const fullText = response.results
      .map(result => result.alternatives[0].transcript)
      .join(' ')
      .trim();

    // Calculate average confidence
    const totalConfidence = response.results.reduce((sum, result) => {
      return sum + (result.alternatives[0].confidence || 0);
    }, 0);
    const averageConfidence = response.results.length > 0 
      ? totalConfidence / response.results.length 
      : 0;

    // Extract word-level timestamps and confidence
    const segments = [];
    let currentSegment = '';
    let currentStartTime = 0;
    let currentEndTime = 0;
    let currentWords = [];

    response.results.forEach((result, resultIndex) => {
      const alternatives = result.alternatives[0];
      
      if (!alternatives || !alternatives.words || alternatives.words.length === 0) {
        return;
      }

      // Process each word in the result
      alternatives.words.forEach((wordInfo) => {
        const word = wordInfo.word;
        const startTime = this._parseDuration(wordInfo.startTime);
        const endTime = this._parseDuration(wordInfo.endTime);
        const confidence = wordInfo.confidence || 0;

        // Add word to current segment
        currentSegment += (currentSegment ? ' ' : '') + word;
        currentWords.push({
          word,
          startTime,
          endTime,
          confidence
        });

        // Update current end time
        currentEndTime = endTime;
      });

      // If this is the last word in the result, finalize the segment
      if (result.isFinal || resultIndex === response.results.length - 1) {
        if (currentSegment) {
          // Calculate segment confidence
          const segmentConfidence = currentWords.length > 0
            ? currentWords.reduce((sum, w) => sum + w.confidence, 0) / currentWords.length
            : 0;
          
          // Add the segment
          segments.push({
            text: currentSegment,
            startTime: currentStartTime,
            endTime: currentEndTime,
            duration: currentEndTime - currentStartTime,
            confidence: segmentConfidence,
            words: [...currentWords],
            isFinal: result.isFinal
          });
          
          // Reset for next segment
          currentSegment = '';
          currentStartTime = currentEndTime;
          currentWords = [];
        }
      }
    });

    return {
      text: fullText,
      language: languageCode,
      confidence: averageConfidence,
      isFinal: true,
      service: 'google',
      requestId,
      segments,
      duration: segments.length > 0 ? segments[segments.length - 1].endTime : 0,
      isLongRunning,
      raw: response
    };
  }

  _parseDuration(duration) {
    if (!duration) return 0;
    
    // Parse duration string (e.g., "3.5s", "500ms")
    if (typeof duration === 'string') {
      if (duration.endsWith('s')) {
        return parseFloat(duration.slice(0, -1));
      } else if (duration.endsWith('ms')) {
        return parseFloat(duration.slice(0, -2)) / 1000;
      } else if (duration.endsWith('us')) {
        return parseFloat(duration.slice(0, -2)) / 1000000;
      } else if (duration.endsWith('ns')) {
        return parseFloat(duration.slice(0, -2)) / 1000000000;
      }
      return parseFloat(duration) || 0;
    }
    
    // If it's an object with seconds/nanos (from gRPC)
    if (typeof duration === 'object' && (duration.seconds !== undefined || duration.nanos !== undefined)) {
      const seconds = Number(duration.seconds) || 0;
      const nanos = Number(duration.nanos) || 0;
      return seconds + (nanos / 1000000000);
    }
    
    // If it's already a number, assume it's in seconds
    return Number(duration) || 0;
  }

  async destroy() {
    await super.destroy();
    
    // Close the client if it exists
    if (this.client) {
      try {
        await this.client.close();
      } catch (error) {
        logger.error('Error closing Google Cloud Speech-to-Text client:', error);
      }
      this.client = null;
    }
  }
}

module.exports = GoogleSTT;
