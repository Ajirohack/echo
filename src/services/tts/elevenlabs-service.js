/**
 * ElevenLabs Service - Ultra-natural voice synthesis
 * ElevenLabs provides the most natural-sounding voices with emotional expression
 */
const { ElevenLabsClient } = require('elevenlabs');
const EventEmitter = require('events');
const fs = require('fs');
const path = require('path');
const os = require('os');
const AudioProcessor = require('./utils/audio-processor');
const SpeechSynthesis = require('./utils/speech-synthesis');
const logger = require('../../utils/logger');

class ElevenLabsService extends EventEmitter {
  constructor(config = {}) {
    super();
    this.config = {
      apiKey: process.env.ELEVENLABS_API_KEY || '',
      model: 'eleven_multilingual_v2',
      stability: 0.5,
      clarity: 0.75,
      useStreamingApi: true,
      rateLimit: 100000,
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
   * Initialize the ElevenLabs client
   */
  initializeClient() {
    try {
      this.client = new ElevenLabsClient({
        apiKey: this.config.apiKey,
      });

      // Fetch available voices
      this.fetchAvailableVoices();
    } catch (error) {
      logger.error('Error initializing ElevenLabs client:', error);
      this.client = null;
    }
  }

  /**
   * Fetch available voices from ElevenLabs
   */
  async fetchAvailableVoices() {
    if (!this.client) {
      logger.warn('ElevenLabs client not initialized');
      return [];
    }

    try {
      const response = await this.client.voices.getAll();
      this.availableVoices = response.voices.map((voice) => ({
        id: voice.voice_id,
        name: voice.name,
        category: voice.category,
        language: voice.labels?.language || 'multilingual',
        gender: this.detectGender(voice.name, voice.labels?.gender),
        preview_url: voice.preview_url,
        description: voice.description,
      }));

      logger.info(`Fetched ${this.availableVoices.length} voices from ElevenLabs`);
      return this.availableVoices;
    } catch (error) {
      logger.error('Error fetching ElevenLabs voices:', error);
      return [];
    }
  }

  /**
   * Detect gender from voice name or labels
   * @param {string} name - Voice name
   * @param {string} labelGender - Gender from voice label
   * @returns {string} Detected gender
   */
  detectGender(name, labelGender) {
    if (labelGender) {
      return labelGender.toLowerCase();
    }

    // Simplified gender detection from name for common cases
    const femaleNames = ['female', 'woman', 'girl', 'rachel', 'charlotte', 'matilda', 'grace'];
    const maleNames = ['male', 'man', 'boy', 'thomas', 'josh', 'ryan', 'sam', 'josh'];

    const nameLower = name.toLowerCase();

    for (const femaleName of femaleNames) {
      if (nameLower.includes(femaleName)) {
        return 'female';
      }
    }

    for (const maleName of maleNames) {
      if (nameLower.includes(maleName)) {
        return 'male';
      }
    }

    return 'unknown';
  }

  /**
   * Generate speech from text using ElevenLabs
   * @param {string} text - Text to synthesize
   * @param {string} voice - Voice ID to use
   * @param {Object} options - Synthesis options
   * @returns {Promise<Buffer>} Audio data
   */
  async synthesize(text, voice, options = {}) {
    if (!this.client) {
      logger.error('ElevenLabs client not initialized');
      throw new Error('ElevenLabs client not initialized');
    }

    if (!text || text.trim() === '') {
      logger.warn('Empty text provided for synthesis');
      throw new Error('Empty text provided for synthesis');
    }

    const opts = {
      model_id: this.config.model,
      voice_settings: {
        stability: options.stability || this.config.stability,
        similarity_boost: options.clarity || this.config.clarity,
        use_speaker_boost: true,
      },
      ...options,
    };

    try {
      const startTime = Date.now();

      // Check if result is in cache
      const cacheKey = `${voice}:${text}:${JSON.stringify(opts)}`;
      if (this.voiceCache.has(cacheKey)) {
        logger.info('Using cached ElevenLabs audio');
        return this.voiceCache.get(cacheKey);
      }

      // Get the right voice ID
      const voiceId = this.resolveVoiceId(voice);

      // Generate audio
      const audioData = await this.client.generate({
        voice: voiceId,
        text,
        model_id: opts.model_id,
        voice_settings: opts.voice_settings,
      });

      // Process audio for optimal playback
      const processedAudio = await this.audioProcessor.processAudio(audioData, 'mp3', {
        normalization: true,
        speed: options.speed,
        pitch: options.pitch,
      });

      const duration = Date.now() - startTime;
      logger.info(`ElevenLabs synthesis completed in ${duration}ms for ${text.length} chars`);

      // Cache the result
      this.voiceCache.set(cacheKey, processedAudio);

      // Emit synthesis complete event
      this.emit('synthesisComplete', {
        provider: 'elevenlabs',
        voice: voice,
        textLength: text.length,
        duration: duration,
        audioSize: processedAudio.length,
      });

      return processedAudio;
    } catch (error) {
      logger.error('Error generating speech with ElevenLabs:', error);
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

    // Default to Rachel if available
    const defaultVoice =
      this.availableVoices.find((v) => v.name === 'Rachel') || this.availableVoices[0];

    if (defaultVoice) {
      logger.warn(`Voice "${voice}" not found, using ${defaultVoice.name} instead`);
      return defaultVoice.id;
    }

    // If we have no voices, use a hardcoded ID for Rachel
    logger.warn(`No voices available, using default Rachel voice ID`);
    return '21m00Tcm4TlvDq8ikWAM'; // Rachel voice ID
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
   * Get a specific voice by ID
   * @param {string} voiceId - Voice ID
   * @returns {Promise<Object>} Voice details
   */
  async getVoice(voiceId) {
    if (!this.client) {
      throw new Error('ElevenLabs client not initialized');
    }

    try {
      const voice = await this.client.voices.getVoice(voiceId);
      return {
        id: voice.voice_id,
        name: voice.name,
        category: voice.category,
        language: voice.labels?.language || 'multilingual',
        gender: this.detectGender(voice.name, voice.labels?.gender),
        preview_url: voice.preview_url,
        description: voice.description,
      };
    } catch (error) {
      logger.error(`Error getting voice ${voiceId}:`, error);
      throw error;
    }
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

    // First try to find a voice specific to the language
    let voice = this.availableVoices.find(
      (v) => v.language && v.language.toLowerCase().includes(normalizedLang) && v.gender === gender
    );

    // If not found, try any gender
    if (!voice) {
      voice = this.availableVoices.find(
        (v) => v.language && v.language.toLowerCase().includes(normalizedLang)
      );
    }

    // If still not found, use a multilingual voice
    if (!voice) {
      voice = this.availableVoices.find(
        (v) => v.language === 'multilingual' && v.gender === gender
      );
    }

    // Last resort, just use any voice
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
    if (!this.client || !this.config.apiKey) {
      return false;
    }

    try {
      await this.client.voices.getAll();
      return true;
    } catch (error) {
      logger.error('ElevenLabs service unavailable:', error);
      return false;
    }
  }

  /**
   * Update configuration
   * @param {Object} newConfig - New configuration
   */
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };

    // Reinitialize client if API key changed
    if (newConfig.apiKey) {
      this.initializeClient();
    }

    // Update audio processor if needed
    if (newConfig.audioProcessor) {
      this.audioProcessor = new AudioProcessor(newConfig.audioProcessor);
    }
  }
}

module.exports = ElevenLabsService;
