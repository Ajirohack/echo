/**
 * Google TTS Service - Broad language coverage speech synthesis
 * Google Cloud Text-to-Speech provides broad language support
 */
const textToSpeech = require('@google-cloud/text-to-speech');
const EventEmitter = require('events');
const fs = require('fs');
const path = require('path');
const os = require('os');
const AudioProcessor = require('./utils/audio-processor');
const SpeechSynthesis = require('./utils/speech-synthesis');
const logger = require('../../utils/logger');

class GoogleTTS extends EventEmitter {
  constructor(config = {}) {
    super();
    this.config = {
      keyFilePath: process.env.GOOGLE_APPLICATION_CREDENTIALS || '',
      useWavenet: true,
      audioEncoding: 'MP3',
      ...config,
    };

    this.client = null;
    this.audioProcessor = new AudioProcessor();
    this.speechSynthesis = new SpeechSynthesis();
    this.availableVoices = [];
    this.voiceCache = new Map();

    this.initializeClient();
  }

  /**
   * Initialize Google Cloud TTS client
   */
  initializeClient() {
    try {
      // Create client with credentials
      this.client = new textToSpeech.TextToSpeechClient({
        keyFilename: this.config.keyFilePath,
      });

      // Fetch available voices
      this.fetchAvailableVoices();
    } catch (error) {
      logger.error('Error initializing Google TTS client:', error);
      this.client = null;
    }
  }

  /**
   * Fetch available voices from Google
   */
  async fetchAvailableVoices() {
    if (!this.client) {
      logger.warn('Google TTS client not initialized');
      return [];
    }

    try {
      const [response] = await this.client.listVoices({});
      const voices = response.voices || [];

      // Process and store voices
      this.availableVoices = voices.map((voice) => {
        // Get language code (e.g., 'en-US' -> 'en')
        const languageCode = voice.languageCodes[0];
        const langCode = languageCode.toLowerCase().split('-')[0];

        // Determine voice type and gender
        const isWavenet = voice.name.includes('Wavenet');
        const isNeural = voice.name.includes('Neural');
        const isStandard = !isWavenet && !isNeural;

        // Determine gender
        const gender =
          voice.ssmlGender === 'FEMALE'
            ? 'female'
            : voice.ssmlGender === 'MALE'
              ? 'male'
              : 'neutral';

        return {
          id: voice.name,
          name: voice.name,
          gender: gender,
          languageCode: languageCode,
          language: langCode,
          isWavenet: isWavenet,
          isNeural: isNeural,
          isStandard: isStandard,
          naturalSampleRateHertz: voice.naturalSampleRateHertz,
        };
      });

      // Filter to Wavenet or Neural voices if configured
      if (this.config.useWavenet) {
        const wavenetVoices = this.availableVoices.filter((voice) => voice.isWavenet);
        const neuralVoices = this.availableVoices.filter((voice) => voice.isNeural);

        // Prefer Wavenet, then Neural, then fall back to all voices
        if (wavenetVoices.length > 0) {
          this.availableVoices = wavenetVoices;
        } else if (neuralVoices.length > 0) {
          this.availableVoices = neuralVoices;
        }
      }

      logger.info(`Fetched ${this.availableVoices.length} voices from Google TTS`);
      return this.availableVoices;
    } catch (error) {
      logger.error('Error fetching Google voices:', error);
      return [];
    }
  }

  /**
   * Generate speech from text using Google TTS
   * @param {string} text - Text to synthesize
   * @param {string} voice - Voice ID to use
   * @param {Object} options - Synthesis options
   * @returns {Promise<Buffer>} Audio data
   */
  async synthesize(text, voice, options = {}) {
    if (!this.client) {
      logger.error('Google TTS client not initialized');
      throw new Error('Google TTS client not initialized');
    }

    if (!text || text.trim() === '') {
      logger.warn('Empty text provided for synthesis');
      throw new Error('Empty text provided for synthesis');
    }

    const opts = {
      pitch: options.pitch || 0,
      speakingRate: options.rate || 1.0,
      volumeGainDb: options.volume ? Math.log10(options.volume) * 20 : 0,
      useSSML: options.useSSML !== false,
      ...options,
    };

    try {
      const startTime = Date.now();

      // Check if result is in cache
      const cacheKey = `${voice}:${text}:${JSON.stringify(opts)}`;
      if (this.voiceCache.has(cacheKey)) {
        logger.info('Using cached Google TTS audio');
        return this.voiceCache.get(cacheKey);
      }

      // Resolve voice details
      const voiceDetails = await this.resolveVoiceDetails(voice);

      // Prepare input
      let input;
      if (opts.useSSML) {
        // Generate SSML with voice control parameters
        const ssmlText = this.speechSynthesis.textToSSML(
          text,
          {
            rate: opts.speakingRate,
            pitch: opts.pitch,
            volume: opts.volume,
          },
          'google'
        );

        input = { ssml: ssmlText };
      } else {
        input = { text };
      }

      // Prepare voice configuration
      const voiceConfig = {
        languageCode: voiceDetails.languageCode,
        name: voiceDetails.id,
        ssmlGender: voiceDetails.gender.toUpperCase(),
      };

      // Prepare audio configuration
      const audioConfig = {
        audioEncoding: this.config.audioEncoding,
        pitch: opts.pitch,
        speakingRate: opts.speakingRate,
        volumeGainDb: opts.volumeGainDb,
      };

      // Make the API request
      const [response] = await this.client.synthesizeSpeech({
        input,
        voice: voiceConfig,
        audioConfig,
      });

      // Process audio for optimal playback
      const audioData = response.audioContent;
      const processedAudio = await this.audioProcessor.processAudio(audioData, 'mp3', {
        normalization: true,
        speed: opts.speed,
        pitch: opts.pitch,
      });

      const duration = Date.now() - startTime;
      logger.info(`Google TTS synthesis completed in ${duration}ms for ${text.length} chars`);

      // Cache the result
      this.voiceCache.set(cacheKey, processedAudio);

      // Emit synthesis complete event
      this.emit('synthesisComplete', {
        provider: 'google',
        voice: voice,
        textLength: text.length,
        duration: duration,
        audioSize: processedAudio.length,
      });

      return processedAudio;
    } catch (error) {
      logger.error('Error generating speech with Google TTS:', error);
      throw error;
    }
  }

  /**
   * Resolve voice details from ID or name
   * @param {string} voice - Voice ID or name
   * @returns {Promise<Object>} Voice details
   */
  async resolveVoiceDetails(voice) {
    if (this.availableVoices.length === 0) {
      await this.fetchAvailableVoices();
    }

    // Check if voice is already a full voice ID
    let voiceDetails = this.availableVoices.find((v) => v.id === voice);

    // If not found, try to match by partial name
    if (!voiceDetails) {
      voiceDetails = this.availableVoices.find((v) => v.id.includes(voice));
    }

    // If still not found, use a default voice
    if (!voiceDetails && this.availableVoices.length > 0) {
      // Prefer Wavenet English voice
      voiceDetails =
        this.availableVoices.find((v) => v.isWavenet && v.languageCode.startsWith('en')) ||
        this.availableVoices[0];

      logger.warn(`Voice "${voice}" not found, using ${voiceDetails.id} instead`);
    }

    if (!voiceDetails) {
      throw new Error(`No voices available for Google TTS`);
    }

    return voiceDetails;
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

    // First try to find a Wavenet voice with matching language and gender
    let voice = this.availableVoices.find(
      (v) => v.language === normalizedLang && v.gender === gender && v.isWavenet
    );

    // If not found, try a Neural voice
    if (!voice) {
      voice = this.availableVoices.find(
        (v) => v.language === normalizedLang && v.gender === gender && v.isNeural
      );
    }

    // If still not found, try any voice for the language and gender
    if (!voice) {
      voice = this.availableVoices.find(
        (v) => v.language === normalizedLang && v.gender === gender
      );
    }

    // If no gender match, try any voice for the language
    if (!voice) {
      voice = this.availableVoices.find((v) => v.language === normalizedLang);
    }

    // Last resort, use English
    if (!voice) {
      voice =
        this.availableVoices.find(
          (v) => v.language === 'en' && v.gender === gender && v.isWavenet
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
    if (!this.client) {
      return false;
    }

    try {
      const [response] = await this.client.listVoices({});
      return response.voices && response.voices.length > 0;
    } catch (error) {
      logger.error('Google TTS service unavailable:', error);
      return false;
    }
  }

  /**
   * Update configuration
   * @param {Object} newConfig - New configuration
   */
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };

    // Reinitialize client if key file path changed
    if (newConfig.keyFilePath) {
      this.initializeClient();
    }

    // Update audio processor if needed
    if (newConfig.audioProcessor) {
      this.audioProcessor = new AudioProcessor(newConfig.audioProcessor);
    }
  }
}

module.exports = GoogleTTS;
