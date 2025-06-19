const { OpenAI } = require('openai');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { Readable } = require('stream');
const BaseSTTService = require('../BaseSTTService');
const logger = require('../../../utils/logger');

class GPT4oSTT extends BaseSTTService {
  constructor(config = {}) {
    super({
      name: 'gpt4o',
      supportedLanguages: [
        'en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'zh', 'ja', 'ko',
        'ar', 'hi', 'bn', 'pa', 'ta', 'te', 'mr', 'gu', 'kn', 'ml',
        'th', 'vi', 'id', 'ms', 'fil', 'tr', 'fa', 'ur', 'sw', 'yo',
        'ig', 'ha', 'am', 'om', 'so', 'sw', 'yo', 'zu', 'xh', 'st',
        'sn', 'nso', 'tn', 'ts', 'ss', 've', 'nr', 'xh', 'rw', 'rn',
        'ny', 'mg', 'sg', 'lg', 'sw', 'yo', 'ig', 'ha', 'am', 'om',
        'so', 'sw', 'yo', 'zu', 'xh', 'st', 'sn', 'nso', 'tn', 'ts',
        'ss', 've', 'nr', 'xh', 'rw', 'rn', 'ny', 'mg', 'sg', 'lg'
      ],
      requiresApiKey: true,
      model: 'gpt-4o',
      temperature: 0,
      responseFormat: 'text',
      timeout: 30000, // 30 seconds
      maxRetries: 3,
      ...config
    });

    this.openai = this.config.apiKey ? new OpenAI({
      apiKey: this.config.apiKey,
      timeout: this.config.timeout,
      maxRetries: this.config.maxRetries
    }) : null;
  }

  async _initialize() {
    if (!this.config.apiKey) {
      throw new Error('API key is required for GPT-4o Audio');
    }

    // Test the API key by making a simple request
    try {
      await this.openai.models.retrieve('gpt-4o');
      logger.info('GPT-4o Audio service initialized successfully');
      return true;
    } catch (error) {
      logger.error('Failed to initialize GPT-4o Audio service:', error);
      throw new Error(`GPT-4o Audio initialization failed: ${error.message}`);
    }
  }

  async _transcribe(audioData, options = {}) {
    const {
      language = 'en',
      prompt = '',
      temperature = this.config.temperature,
      responseFormat = this.config.responseFormat,
      requestId = uuidv4()
    } = options;

    try {
      // Prepare audio data
      let audioBuffer;
      let audioPath;
      
      if (Buffer.isBuffer(audioData)) {
        audioBuffer = audioData;
      } else if (typeof audioData === 'string' && fs.existsSync(audioData)) {
        audioPath = audioData;
        audioBuffer = fs.readFileSync(audioPath);
      } else {
        throw new Error('Invalid audio data format');
      }

      // Create a file-like object for the API
      const file = {
        name: path.basename(audioPath || 'audio.wav'),
        data: audioBuffer
      };

      logger.debug(`Sending request to GPT-4o Audio (${requestId})`);
      
      // Make the API request
      const response = await this.openai.audio.transcriptions.create({
        file: file,
        model: this.config.model,
        language: language === 'auto' ? undefined : language,
        prompt: prompt,
        temperature: temperature,
        response_format: responseFormat
      });

      // Extract the transcription text
      const text = response.text || '';
      
      return {
        text,
        language: language,
        confidence: this._calculateConfidence(text),
        isFinal: true,
        service: 'gpt4o',
        requestId,
        raw: response
      };
    } catch (error) {
      logger.error('GPT-4o Audio transcription failed:', error);
      throw new Error(`GPT-4o Audio error: ${error.message}`);
    }
  }

  async _startStreaming(audioStream, options = {}) {
    const { onData, onError, onEnd } = options;
    const streamId = options.streamId || uuidv4();
    
    try {
      // For GPT-4o Audio, we'll buffer the stream and send it in chunks
      // since the API doesn't support true streaming for audio input
      const chunks = [];
      
      // Create a transform stream to buffer the audio
      const transformStream = new Transform({
        transform(chunk, encoding, callback) {
          chunks.push(chunk);
          this.push(chunk);
          callback();
        },
        flush(callback) {
          this.push(null);
          callback();
        }
      });
      
      // Pipe the audio stream through the transform stream
      audioStream.pipe(transformStream);
      
      // Store the stream for cleanup
      this.activeStreams.set(streamId, transformStream);
      
      // Handle the end of the stream
      transformStream.on('end', async () => {
        try {
          // Combine all chunks into a single buffer
          const audioBuffer = Buffer.concat(chunks);
          
          // Transcribe the audio
          const result = await this.transcribe(audioBuffer, {
            ...options,
            streamId
          });
          
          // Emit the final result
          onData({
            text: result.text,
            confidence: result.confidence,
            isFinal: true,
            language: options.language || 'en',
            service: 'gpt4o',
            requestId: options.requestId
          });
          
          // Signal the end of transcription
          onEnd();
        } catch (error) {
          logger.error('Error in GPT-4o Audio streaming:', error);
          onError(error);
        } finally {
          // Clean up
          this.activeStreams.delete(streamId);
        }
      });
      
      // Handle stream errors
      transformStream.on('error', (error) => {
        logger.error('Transform stream error:', error);
        onError(error);
        this.activeStreams.delete(streamId);
      });
      
      return streamId;
    } catch (error) {
      logger.error('Error starting GPT-4o Audio streaming:', error);
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
        logger.error('Error stopping GPT-4o Audio stream:', error);
      } finally {
        this.activeStreams.delete(streamId);
      }
    }
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
      '[inaudible]', '[laughter]', '[music]', '[applause]',
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
    
    // Clean up any open streams
    for (const [streamId, stream] of this.activeStreams.entries()) {
      try {
        if (stream.destroy) {
          stream.destroy();
        } else if (stream.end) {
          stream.end();
        }
      } catch (error) {
        logger.error(`Error cleaning up stream ${streamId}:`, error);
      }
    }
    
    this.activeStreams.clear();
  }
}

module.exports = GPT4oSTT;
