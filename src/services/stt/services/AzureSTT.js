const { SpeechConfig, AudioConfig, SpeechRecognizer, ResultReason, CancellationReason } = require('microsoft-cognitiveservices-speech-sdk');
const { Readable } = require('stream');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const BaseSTTService = require('../BaseSTTService');
const logger = require('../../../utils/logger');

class AzureSTT extends BaseSTTService {
  constructor(config = {}) {
    super({
      name: 'azure',
      supportedLanguages: [
        'af-ZA', 'am-ET', 'ar-AE', 'ar-BH', 'ar-DZ', 'ar-EG', 'ar-IL', 'ar-IQ', 'ar-JO', 'ar-KW',
        'ar-LB', 'ar-LY', 'ar-MA', 'ar-OM', 'ar-PS', 'ar-QA', 'ar-SA', 'ar-SY', 'ar-TN', 'ar-YE',
        'az-AZ', 'bg-BG', 'bn-BD', 'bn-IN', 'bs-BA', 'ca-ES', 'cs-CZ', 'cy-GB', 'da-DK', 'de-AT',
        'de-CH', 'de-DE', 'el-GR', 'en-AU', 'en-CA', 'en-GB', 'en-GH', 'en-HK', 'en-IE', 'en-IN',
        'en-KE', 'en-NG', 'en-NZ', 'en-PH', 'en-SG', 'en-TZ', 'en-US', 'en-ZA', 'es-AR', 'es-BO',
        'es-CL', 'es-CO', 'es-CR', 'es-CU', 'es-DO', 'es-EC', 'es-ES', 'es-GQ', 'es-GT', 'es-HN',
        'es-MX', 'es-NI', 'es-PA', 'es-PE', 'es-PR', 'es-PY', 'es-SV', 'es-US', 'es-UY', 'es-VE',
        'et-EE', 'eu-ES', 'fa-IR', 'fi-FI', 'fil-PH', 'fr-BE', 'fr-CA', 'fr-CH', 'fr-FR', 'ga-IE',
        'gl-ES', 'gu-IN', 'he-IL', 'hi-IN', 'hr-HR', 'hu-HU', 'hy-AM', 'id-ID', 'is-IS', 'it-CH',
        'it-IT', 'ja-JP', 'jv-ID', 'ka-GE', 'kk-KZ', 'km-KH', 'kn-IN', 'ko-KR', 'lo-LA', 'lt-LT',
        'lv-LV', 'mk-MK', 'ml-IN', 'mn-MN', 'mr-IN', 'ms-MY', 'mt-MT', 'my-MM', 'nb-NO', 'ne-NP',
        'nl-BE', 'nl-NL', 'pl-PL', 'ps-AF', 'pt-BR', 'pt-PT', 'ro-RO', 'ru-RU', 'si-LK', 'sk-SK',
        'sl-SI', 'so-SO', 'sq-AL', 'sr-RS', 'su-ID', 'sv-SE', 'sw-KE', 'sw-TZ', 'ta-IN', 'ta-LK',
        'ta-MY', 'ta-SG', 'te-IN', 'th-TH', 'tr-TR', 'uk-UA', 'ur-IN', 'ur-PK', 'uz-UZ', 'vi-VN',
        'wuu-CN', 'yue-CN', 'zh-CN', 'zh-HK', 'zh-TW', 'zu-ZA'
      ],
      requiresApiKey: true,
      region: 'eastus',
      language: 'en-US',
      endpointId: null, // Custom endpoint ID for custom models
      profanity: 'Masked', // or 'Removed', 'Raw'
      speechRecognitionMode: 'conversation', // 'conversation', 'dictation', or 'interactive'
      format: 'detailed', // 'simple' or 'detailed'
      ...config
    });

    this.speechConfig = null;
    this.recognizer = null;
  }

  async _initialize() {
    if (!this.config.apiKey) {
      throw new Error('API key is required for Azure Speech Service');
    }

    if (!this.config.region) {
      throw new Error('Region is required for Azure Speech Service');
    }

    // Create speech config with subscription key and region
    this.speechConfig = SpeechConfig.fromSubscription(
      this.config.apiKey,
      this.config.region
    );

    // Apply configuration
    this.speechConfig.speechRecognitionLanguage = this.config.language;
    this.speechConfig.setProfanity(this.config.profanity);
    this.speechConfig.speechRecognitionMode = this.config.speechRecognitionMode;
    this.speechConfig.outputFormat = this.config.format;

    // Set endpoint ID if provided (for custom models)
    if (this.config.endpointId) {
      this.speechConfig.endpointId = this.config.endpointId;
    }

    logger.info('Azure Speech Service initialized');
    return true;
  }

  async _transcribe(audioData, options = {}) {
    const {
      language = this.config.language,
      requestId = uuidv4(),
      format = 'detailed'
    } = options;

    // Update language if provided
    if (language && language !== this.speechConfig.speechRecognitionLanguage) {
      this.speechConfig.speechRecognitionLanguage = language;
    }

    // Create audio config from buffer or file path
    let audioConfig;
    if (Buffer.isBuffer(audioData)) {
      // Convert buffer to push audio stream
      const pushStream = this._createPushStream(audioData);
      audioConfig = AudioConfig.fromStreamInput(pushStream);
    } else if (typeof audioData === 'string' && fs.existsSync(audioData)) {
      // From file
      audioConfig = AudioConfig.fromWavFileInput(fs.readFileSync(audioData));
    } else {
      throw new Error('Invalid audio data format');
    }

    // Create recognizer
    this.recognizer = new SpeechRecognizer(this.speechConfig, audioConfig);

    return new Promise((resolve, reject) => {
      const results = {
        text: '',
        language: language,
        confidence: 0,
        segments: [],
        duration: 0,
        offset: 0
      };

      let audioDuration = 0;
      let audioStartTime = Date.now();

      // Subscribe to recognized events
      this.recognizer.recognized = (s, e) => {
        if (e.result.reason === ResultReason.RecognizedSpeech) {
          const result = e.result;
          const text = result.text;
          
          // Calculate confidence (average of all NBest items if available)
          let confidence = 0;
          if (result.json && result.json.NBest && result.json.NBest.length > 0) {
            const nbest = result.json.NBest;
            confidence = nbest.reduce((sum, item) => sum + (item.Confidence || 0), 0) / nbest.length;
            
            // Update results with detailed segments
            results.segments = nbest.map(item => ({
              text: item.Display || item.Lexical || '',
              confidence: item.Confidence || 0,
              offset: item.Offset || 0,
              duration: item.Duration || 0
            }));
            
            // Update audio duration based on the last segment
            if (results.segments.length > 0) {
              const lastSegment = results.segments[results.segments.length - 1];
              audioDuration = (lastSegment.offset + lastSegment.duration) / 10000000; // Convert to seconds
            }
          } else {
            // Fallback to simple confidence calculation
            confidence = this._calculateConfidence(text);
            results.segments.push({
              text,
              confidence,
              offset: 0,
              duration: audioDuration * 10000000 // Convert to 100-nanosecond units
            });
          }

          // Update results
          results.text = text;
          results.confidence = confidence;
          results.duration = audioDuration;
          
          logger.debug(`Azure STT recognized: ${text.substring(0, 50)}... (${(confidence * 100).toFixed(1)}% confidence)`);
        }
      };

      // Subscribe to canceled event
      this.recognizer.canceled = (s, e) => {
        if (e.reason === CancellationReason.Error) {
          const errorMsg = `Azure STT error: ${e.errorDetails}`;
          logger.error(errorMsg);
          reject(new Error(errorMsg));
        } else {
          // Session was canceled by the user
          logger.info('Azure STT recognition was canceled');
          resolve(results);
        }
        
        // Clean up
        this.recognizer.close();
      };

      // Subscribe to session events
      this.recognizer.sessionStarted = (s, e) => {
        logger.debug('Azure STT session started');
        audioStartTime = Date.now();
      };

      this.recognizer.sessionStopped = (s, e) => {
        logger.debug('Azure STT session stopped');
        audioDuration = (Date.now() - audioStartTime) / 1000; // Convert to seconds
        results.duration = audioDuration;
        
        // Resolve with final results
        resolve(results);
        
        // Clean up
        this.recognizer.close();
      };

      // Start recognition
      this.recognizer.startContinuousRecognitionAsync(
        () => {
          logger.debug('Azure STT recognition started');
          
          // For non-streaming, stop after a short delay to process the audio
          if (!options.isStream) {
            setTimeout(() => {
              this.recognizer.stopContinuousRecognitionAsync(
                () => {
                  logger.debug('Azure STT recognition stopped');
                },
                (err) => {
                  logger.error('Error stopping recognition:', err);
                  reject(err);
                }
              );
            }, 100); // Short delay to ensure audio is processed
          }
        },
        (err) => {
          logger.error('Error starting recognition:', err);
          reject(err);
        }
      );
    });
  }

  async _startStreaming(audioStream, options = {}) {
    const { onData, onError, onEnd } = options;
    const streamId = options.streamId || uuidv4();
    
    // Create audio config from stream
    const pushStream = this._createPushStream();
    const audioConfig = AudioConfig.fromStreamInput(pushStream);
    
    // Create recognizer
    const recognizer = new SpeechRecognizer(this.speechConfig, audioConfig);
    
    // Store the recognizer for cleanup
    this.activeStreams.set(streamId, recognizer);
    
    // Handle recognition events
    recognizer.recognized = (s, e) => {
      if (e.result.reason === ResultReason.RecognizedSpeech) {
        const text = e.result.text;
        
        // Calculate confidence (simplified for streaming)
        const confidence = this._calculateConfidence(text);
        
        // Emit data event
        onData({
          text,
          confidence,
          isFinal: true,
          language: this.speechConfig.speechRecognitionLanguage,
          service: 'azure',
          requestId: options.requestId
        });
      }
    };
    
    // Handle interim results
    recognizer.recognizing = (s, e) => {
      if (e.result.reason === ResultReason.RecognizingSpeech) {
        const text = e.result.text;
        
        // Emit interim result
        onData({
          text,
          confidence: 0.5, // Lower confidence for interim results
          isFinal: false,
          language: this.speechConfig.speechRecognitionLanguage,
          service: 'azure',
          requestId: options.requestId
        });
      }
    };
    
    // Handle errors
    recognizer.canceled = (s, e) => {
      if (e.reason === CancellationReason.Error) {
        const errorMsg = `Azure STT streaming error: ${e.errorDetails}`;
        logger.error(errorMsg);
        onError(new Error(errorMsg));
      }
    };
    
    // Handle session end
    recognizer.sessionStopped = (s, e) => {
      logger.debug('Azure STT streaming session stopped');
      this.activeStreams.delete(streamId);
      onEnd();
    };
    
    // Start recognition
    recognizer.startContinuousRecognitionAsync(
      () => {
        logger.debug('Azure STT streaming started');
        
        // Pipe audio data to the recognizer
        audioStream.on('data', (chunk) => {
          pushStream.write(chunk);
        });
        
        audioStream.on('end', () => {
          logger.debug('Audio stream ended, stopping recognition');
          pushStream.close();
          recognizer.stopContinuousRecognitionAsync(
            () => {
              logger.debug('Azure STT streaming stopped');
              this.activeStreams.delete(streamId);
              onEnd();
            },
            (err) => {
              logger.error('Error stopping recognition:', err);
              onError(err);
            }
          );
        });
        
        audioStream.on('error', (err) => {
          logger.error('Audio stream error:', err);
          onError(err);
        });
      },
      (err) => {
        logger.error('Error starting recognition:', err);
        onError(err);
      }
    );
    
    return streamId;
  }
  
  async _stopStreaming(streamId) {
    const recognizer = this.activeStreams.get(streamId);
    if (recognizer) {
      try {
        await recognizer.stopContinuousRecognitionAsync();
      } catch (error) {
        logger.error('Error stopping Azure STT stream:', error);
      } finally {
        recognizer.close();
        this.activeStreams.delete(streamId);
      }
    }
  }
  
  _createPushStream(initialData = null) {
    const { Readable } = require('stream');
    const { AudioStreamFormat, PushAudioInputStream } = require('microsoft-cognitiveservices-speech-sdk');
    
    // Create a push stream
    const pushStream = AudioInputStream.createPushStream(AudioStreamFormat.getWaveFormatPCM(16000, 16, 1));
    
    // Write initial data if provided
    if (initialData) {
      pushStream.write(initialData);
    }
    
    return pushStream;
  }
  
  _calculateConfidence(text) {
    // Simple confidence calculation based on text length and content
    if (!text || text.trim().length === 0) return 0;
    
    // Calculate confidence based on text length and content
    const cleanText = text.trim().toLowerCase();
    const words = cleanText.split(/\s+/).filter(Boolean);
    const wordCount = words.length;
    
    if (wordCount === 0) return 0;
    
    // Basic confidence based on word count (more words = higher confidence)
    let confidence = Math.min(wordCount / 10, 1.0);
    
    // Penalize for common transcription errors
    const errorIndicators = [
      '%HESITATION', '[inaudible]', '[laughter]', '[music]', '[applause]',
      'um', 'uh', 'ah', 'er', 'like', 'you know'
    ];
    
    const errorCount = errorIndicators.reduce((count, indicator) => {
      return count + (cleanText.includes(indicator) ? 1 : 0);
    }, 0);
    
    // Reduce confidence based on error indicators
    confidence = Math.max(0, confidence - (errorCount * 0.1));
    
    return Math.round(confidence * 100) / 100; // Round to 2 decimal places
  }
  
  async destroy() {
    await super.destroy();
    
    // Clean up any open recognizers
    for (const [streamId, recognizer] of this.activeStreams.entries()) {
      try {
        await recognizer.stopContinuousRecognitionAsync();
        recognizer.close();
      } catch (error) {
        logger.error(`Error cleaning up recognizer ${streamId}:`, error);
      }
    }
    
    this.activeStreams.clear();
    this.recognizer = null;
    this.speechConfig = null;
  }
}

module.exports = AzureSTT;
