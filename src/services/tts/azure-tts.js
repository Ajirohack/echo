/**
 * Azure TTS Service - Enterprise-grade speech synthesis
 * Azure Cognitive Services provides reliable, high-quality voices
 */
const sdk = require('microsoft-cognitiveservices-speech-sdk');
const EventEmitter = require('events');
const fs = require('fs');
const path = require('path');
const os = require('os');
const AudioProcessor = require('./utils/audio-processor');
const SpeechSynthesis = require('./utils/speech-synthesis');
const logger = require('../../utils/logger');

class AzureTTS extends EventEmitter {
  constructor(config = {}) {
    super();
    this.config = {
      apiKey: process.env.AZURE_SPEECH_KEY || '',
      region: process.env.AZURE_REGION || 'eastus',
      useNeuralVoices: true,
      outputFormat: sdk.SpeechSynthesisOutputFormat.Audio16Khz32KBitRateMonoMp3,
      ...config,
    };

    this.speechConfig = null;
    this.audioProcessor = new AudioProcessor();
    this.speechSynthesis = new SpeechSynthesis();
    this.availableVoices = [];
    this.voiceCache = new Map();

    this.initializeClient();
  }

  /**
   * Initialize Azure Speech SDK client
   */
  initializeClient() {
    try {
      if (!this.config.apiKey || !this.config.region) {
        logger.warn('Azure Speech API key or region not provided');
        return;
      }

      this.speechConfig = sdk.SpeechConfig.fromSubscription(this.config.apiKey, this.config.region);

      // Set output format
      this.speechConfig.speechSynthesisOutputFormat = this.config.outputFormat;

      // Fetch available voices
      this.fetchAvailableVoices();
    } catch (error) {
      logger.error('Error initializing Azure Speech client:', error);
      this.speechConfig = null;
    }
  }

  /**
   * Fetch available voices from Azure
   */
  async fetchAvailableVoices() {
    if (!this.speechConfig) {
      logger.warn('Azure Speech client not initialized');
      return [];
    }

    try {
      const synthesizer = new sdk.SpeechSynthesizer(this.speechConfig);

      const result = await new Promise((resolve, reject) => {
        synthesizer.getVoicesAsync(
          this.config.region,
          (result) => {
            if (result.voices && result.voices.length > 0) {
              resolve(result);
            } else {
              reject(new Error('No voices found'));
            }
          },
          (error) => {
            reject(error);
          }
        );
      });

      // Process and store voices
      this.availableVoices = result.voices.map((voice) => {
        // Extract gender from the voice ID (e.g., en-US-JennyNeural)
        const gender = this.detectGender(voice.shortName);

        // Extract language code
        const langCode = voice.locale.toLowerCase().split('-')[0];

        return {
          id: voice.shortName,
          name: voice.localName || voice.shortName.split('-')[2].replace('Neural', ''),
          gender: gender,
          locale: voice.locale,
          language: langCode,
          isNeural: voice.shortName.includes('Neural'),
          styleList: voice.styleList || [],
        };
      });

      // Filter to neural voices if configured
      if (this.config.useNeuralVoices) {
        this.availableVoices = this.availableVoices.filter((voice) => voice.isNeural);
      }

      logger.info(`Fetched ${this.availableVoices.length} voices from Azure`);
      return this.availableVoices;
    } catch (error) {
      logger.error('Error fetching Azure voices:', error);
      return [];
    }
  }

  /**
   * Detect gender from voice name
   * @param {string} voiceId - Voice ID or name
   * @returns {string} Detected gender
   */
  detectGender(voiceId) {
    // Common female names in Azure voices
    const femaleNames = [
      'jenny',
      'aria',
      'clara',
      'zira',
      'julia',
      'sarah',
      'natasha',
      'catherine',
    ];

    // Common male names in Azure voices
    const maleNames = ['guy', 'davis', 'tony', 'christopher', 'mark', 'ryan', 'andrew', 'brandon'];

    const voiceLower = voiceId.toLowerCase();

    for (const femaleName of femaleNames) {
      if (voiceLower.includes(femaleName)) {
        return 'female';
      }
    }

    for (const maleName of maleNames) {
      if (voiceLower.includes(maleName)) {
        return 'male';
      }
    }

    // If can't determine, make a guess based on common Azure naming patterns
    if (voiceLower.includes('female')) {
      return 'female';
    } else if (voiceLower.includes('male')) {
      return 'male';
    }

    return 'unknown';
  }

  /**
   * Generate speech from text using Azure
   * @param {string} text - Text to synthesize
   * @param {string} voice - Voice ID to use
   * @param {Object} options - Synthesis options
   * @returns {Promise<Buffer>} Audio data
   */
  async synthesize(text, voice, options = {}) {
    if (!this.speechConfig) {
      logger.error('Azure Speech client not initialized');
      throw new Error('Azure Speech client not initialized');
    }

    if (!text || text.trim() === '') {
      logger.warn('Empty text provided for synthesis');
      throw new Error('Empty text provided for synthesis');
    }

    const opts = {
      rate: options.rate || 1.0,
      pitch: options.pitch || 0,
      volume: options.volume || 1.0,
      emotion: options.emotion,
      useSSML: options.useSSML !== false,
      ...options,
    };

    try {
      const startTime = Date.now();

      // Check if result is in cache
      const cacheKey = `${voice}:${text}:${JSON.stringify(opts)}`;
      if (this.voiceCache.has(cacheKey)) {
        logger.info('Using cached Azure audio');
        return this.voiceCache.get(cacheKey);
      }

      // Get the right voice ID
      const voiceId = this.resolveVoiceId(voice);

      // Create a new speech config for this synthesis
      const config = sdk.SpeechConfig.fromSubscription(this.config.apiKey, this.config.region);

      config.speechSynthesisOutputFormat = this.config.outputFormat;
      config.speechSynthesisVoiceName = voiceId;

      // Create synthesizer with a push stream output
      const pushStream = sdk.AudioOutputStream.createPushStream();
      const audioConfig = sdk.AudioConfig.fromStreamOutput(pushStream);
      const synthesizer = new sdk.SpeechSynthesizer(config, audioConfig);

      // Prepare input text (SSML or plain text)
      let inputText = text;
      if (opts.useSSML) {
        // Generate SSML with voice control parameters
        inputText = this.speechSynthesis.textToSSML(
          text,
          {
            voice: voiceId,
            rate: opts.rate,
            pitch: opts.pitch,
            volume: opts.volume,
            emotion: opts.emotion,
          },
          'azure'
        );
      }

      // Collect audio data chunks
      const audioData = [];
      pushStream.on('data', (data) => {
        audioData.push(data);
      });

      // Synthesize speech
      const result = await new Promise((resolve, reject) => {
        if (opts.useSSML) {
          synthesizer.speakSsmlAsync(
            inputText,
            (result) => {
              if (result.reason === sdk.ResultReason.SynthesizingAudioCompleted) {
                resolve(result);
              } else {
                reject(new Error(`Synthesis failed: ${result.errorDetails}`));
              }
              synthesizer.close();
            },
            (error) => {
              reject(error);
              synthesizer.close();
            }
          );
        } else {
          synthesizer.speakTextAsync(
            inputText,
            (result) => {
              if (result.reason === sdk.ResultReason.SynthesizingAudioCompleted) {
                resolve(result);
              } else {
                reject(new Error(`Synthesis failed: ${result.errorDetails}`));
              }
              synthesizer.close();
            },
            (error) => {
              reject(error);
              synthesizer.close();
            }
          );
        }
      });

      // Combine audio chunks into a single buffer
      const audioBuffer = Buffer.concat(audioData);

      // Process audio for optimal playback
      const processedAudio = await this.audioProcessor.processAudio(audioBuffer, 'mp3', {
        normalization: true,
        speed: opts.speed,
        pitch: opts.pitch,
      });

      const duration = Date.now() - startTime;
      logger.info(`Azure synthesis completed in ${duration}ms for ${text.length} chars`);

      // Cache the result
      this.voiceCache.set(cacheKey, processedAudio);

      // Emit synthesis complete event
      this.emit('synthesisComplete', {
        provider: 'azure',
        voice: voice,
        textLength: text.length,
        duration: duration,
        audioSize: processedAudio.length,
      });

      return processedAudio;
    } catch (error) {
      logger.error('Error generating speech with Azure:', error);
      throw error;
    }
  }

  /**
   * Resolve voice ID from name or ID
   * @param {string} voice - Voice name or ID
   * @returns {string} Voice ID
   */
  resolveVoiceId(voice) {
    // If voice is already an ID, return it
    if (this.availableVoices.some((v) => v.id === voice)) {
      return voice;
    }

    // Try to find by name
    const voiceByName = this.availableVoices.find(
      (v) => v.name.toLowerCase() === voice.toLowerCase()
    );

    if (voiceByName) {
      return voiceByName.id;
    }

    // Default to en-US-JennyNeural if available
    const defaultVoice =
      this.availableVoices.find((v) => v.id === 'en-US-JennyNeural') || this.availableVoices[0];

    if (defaultVoice) {
      logger.warn(`Voice "${voice}" not found, using ${defaultVoice.name} instead`);
      return defaultVoice.id;
    }

    // If we have no voices, use a hardcoded ID for Jenny
    logger.warn(`No voices available, using default Jenny voice ID`);
    return 'en-US-JennyNeural';
  }

  /**
   * Get all available voices
   * @returns {Promise<Array>} Available voices
   */
  async getVoices() {
    if (this.availableVoices.length === 0) {
      await this.fetchAvailableVoices();
    }
    return this.availableVoices;
  }

  /**
   * Get voice by language
   * @param {string} language - Language code
   * @param {string} gender - Preferred gender
   * @returns {Promise<Object>} Voice details
   */
  async getVoiceByLanguage(language, gender = 'female') {
    if (this.availableVoices.length === 0) {
      await this.fetchAvailableVoices();
    }

    // Normalize language code
    const normalizedLang = language.toLowerCase().split('-')[0];

    // First try to find a neural voice specific to the language and gender
    let voice = this.availableVoices.find(
      (v) => v.language === normalizedLang && v.gender === gender && v.isNeural
    );

    // If not found, try any neural voice for the language
    if (!voice) {
      voice = this.availableVoices.find((v) => v.language === normalizedLang && v.isNeural);
    }

    // If still not found, try any voice for the language
    if (!voice) {
      voice = this.availableVoices.find((v) => v.language === normalizedLang);
    }

    // Last resort, use English
    if (!voice) {
      voice =
        this.availableVoices.find(
          (v) => v.language === 'en' && v.gender === gender && v.isNeural
        ) || this.availableVoices.find((v) => v.language === 'en');
    }

    if (!voice && this.availableVoices.length > 0) {
      voice = this.availableVoices[0];
    }

    if (!voice) {
      throw new Error(`No voice found for language ${language}`);
    }

    return voice;
  }

  /**
   * Check if the service is available
   * @returns {Promise<boolean>} Availability status
   */
  async isAvailable() {
    if (!this.speechConfig || !this.config.apiKey) {
      return false;
    }

    try {
      const synthesizer = new sdk.SpeechSynthesizer(this.speechConfig);
      const result = await new Promise((resolve) => {
        synthesizer.getVoicesAsync(
          this.config.region,
          (result) => {
            resolve(result.voices && result.voices.length > 0);
            synthesizer.close();
          },
          (error) => {
            resolve(false);
            synthesizer.close();
          }
        );
      });

      return result;
    } catch (error) {
      logger.error('Azure TTS service unavailable:', error);
      return false;
    }
  }

  /**
   * Update configuration
   * @param {Object} newConfig - New configuration
   */
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };

    // Reinitialize client if API key or region changed
    if (newConfig.apiKey || newConfig.region) {
      this.initializeClient();
    }

    // Update audio processor if needed
    if (newConfig.audioProcessor) {
      this.audioProcessor = new AudioProcessor(newConfig.audioProcessor);
    }
  }
}

module.exports = AzureTTS;
