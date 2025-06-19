const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const { exec } = require('child_process');
const { v4: uuidv4 } = require('uuid');
const { OpenAI } = require('openai');
const { Transform } = require('stream');
const BaseSTTService = require('../BaseSTTService');
const logger = require('../../../utils/logger');

const execAsync = promisify(exec);

class WhisperSTT extends BaseSTTService {
  constructor(config = {}) {
    super({
      name: 'whisper',
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
      model: 'whisper-1',
      temperature: 0,
      responseFormat: 'json',
      timeout: 30000, // 30 seconds
      maxRetries: 3,
      useLocal: false,
      localModelPath: null,
      localModel: 'base',
      ...config
    });

    this.openai = this.config.apiKey ? new OpenAI({
      apiKey: this.config.apiKey,
      timeout: this.config.timeout,
      maxRetries: this.config.maxRetries
    }) : null;
  }

  async _initialize() {
    if (this.config.useLocal) {
      return this._initializeLocal();
    }
    return this._initializeAPI();
  }

  async _initializeAPI() {
    if (!this.config.apiKey) {
      throw new Error('API key is required for Whisper API');
    }

    // Test the API key by making a simple request
    try {
      // Use a lightweight model list request to test the API key
      await this.openai.models.list();
      logger.info('Whisper API initialized successfully');
      return true;
    } catch (error) {
      logger.error('Failed to initialize Whisper API:', error);
      throw new Error(`Whisper API initialization failed: ${error.message}`);
    }
  }

  async _initializeLocal() {
    // Check if local model exists
    if (!this.config.localModelPath) {
      throw new Error('Local model path is required for local Whisper');
    }

    // Check if whisper.cpp is available
    try {
      const { stdout } = await execAsync('which whisper');
      if (!stdout || !stdout.trim()) {
        throw new Error('Whisper executable not found in PATH');
      }
      
      // Verify whisper version
      const { stdout: version } = await execAsync('whisper --version');
      logger.info(`Using local Whisper version: ${version.trim()}`);
      
      return true;
    } catch (error) {
      logger.error('Failed to initialize local Whisper:', error);
      throw new Error(`Local Whisper initialization failed: ${error.message}`);
    }
  }

  async _transcribe(audioData, options = {}) {
    if (this.config.useLocal) {
      return this._transcribeLocal(audioData, options);
    }
    return this._transcribeAPI(audioData, options);
  }

  async _transcribeAPI(audioData, options = {}) {
    const {
      language = 'en',
      prompt = '',
      temperature = this.config.temperature,
      responseFormat = this.config.responseFormat
    } = options;

    try {
      // If audioData is a file path, read it as a buffer
      const audioBuffer = typeof audioData === 'string' 
        ? fs.readFileSync(audioData) 
        : audioData;

      // Create a file-like object for the API
      const file = {
        name: path.basename(audioData) || 'audio.wav',
        data: audioBuffer
      };

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
        language: response.language || language,
        duration: response.duration,
        segments: response.segments,
        confidence: this._calculateConfidence(text)
      };
    } catch (error) {
      logger.error('Whisper API transcription failed:', error);
      throw new Error(`Whisper API error: ${error.message}`);
    }
  }

  async _transcribeLocal(audioPath, options = {}) {
    const {
      language = 'en',
      prompt = '',
      temperature = this.config.temperature,
      outputDir = path.dirname(audioPath),
      outputFormat = 'txt'
    } = options;

    try {
      // Ensure output directory exists
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      // Generate output file path
      const outputFile = path.join(
        outputDir,
        `${path.basename(audioPath, path.extname(audioPath))}.${outputFormat}`
      );

      // Build the whisper command
      const command = [
        'whisper',
        `"${audioPath}"`,
        `--model ${this.config.localModel}`,
        `--output_dir "${outputDir}"`,
        `--output_format ${outputFormat}`,
        language === 'auto' ? '' : `--language ${language}`,
        prompt ? `--initial_prompt "${prompt}"` : '',
        `--temperature ${temperature}`,
        '--fp16 False' // Disable FP16 for better compatibility
      ].filter(Boolean).join(' ');

      logger.debug(`Executing Whisper command: ${command}`);
      
      // Execute the command
      const { stdout, stderr } = await execAsync(command);
      
      if (stderr) {
        logger.warn('Whisper stderr:', stderr);
      }

      // Read the output file
      let text = '';
      if (fs.existsSync(outputFile)) {
        text = fs.readFileSync(outputFile, 'utf-8');
        
        // Clean up the output file if needed
        if (this.config.cleanup) {
          fs.unlinkSync(outputFile);
        }
      }

      return {
        text: text.trim(),
        language,
        confidence: this._calculateConfidence(text)
      };
    } catch (error) {
      logger.error('Local Whisper transcription failed:', error);
      throw new Error(`Local Whisper error: ${error.message}`);
    }
  }

  async _startStreaming(audioStream, options = {}) {
    const { onData, onError, onEnd } = options;
    const streamId = options.streamId || uuidv4();
    
    // For streaming, we'll use the API as local streaming is not supported
    if (this.config.useLocal) {
      throw new Error('Streaming is only supported with Whisper API');
    }
    
    try {
      // Create a transform stream to convert audio chunks
      const transformStream = new Transform({
        transform(chunk, encoding, callback) {
          // Process the chunk
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
      
      // Store the stream for later cleanup
      this.activeStreams.set(streamId, transformStream);
      
      // Start the transcription
      const transcription = await this.openai.audio.transcriptions.create({
        file: transformStream,
        model: this.config.model,
        language: options.language || 'en',
        response_format: 'verbose_json',
        stream: true
      });
      
      // Handle the streaming response
      for await (const chunk of transcription) {
        if (chunk.choices && chunk.choices[0].delta.content) {
          const text = chunk.choices[0].delta.content;
          
          onData({
            text,
            isFinal: false,
            service: 'whisper',
            requestId: options.requestId
          });
        }
      }
      
      // Signal the end of transcription
      onEnd({
        text: '',
        isFinal: true,
        service: 'whisper',
        requestId: options.requestId
      });
      
      // Clean up
      this.activeStreams.delete(streamId);
      
    } catch (error) {
      logger.error('Whisper streaming error:', error);
      onError(error);
    }
  }
  
  async _stopStreaming(streamId) {
    const stream = this.activeStreams.get(streamId);
    if (stream) {
      if (typeof stream.destroy === 'function') {
        stream.destroy();
      }
      this.activeStreams.delete(streamId);
    }
  }
  
  _calculateConfidence(text) {
    // Simple confidence calculation based on text length and content
    // This is a placeholder - a real implementation would be more sophisticated
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
    
    // Clean up any temporary files or resources
    if (this.openai) {
      // Close any open connections
      // Note: The OpenAI client doesn't have a close/destroy method in the current version
    }
  }
}

module.exports = WhisperSTT;
