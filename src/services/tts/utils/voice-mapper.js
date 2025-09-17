/**
 * Voice Mapper - Maps languages to optimal voices across services
 * Maps language codes to the most natural-sounding voices
 */
const fs = require('fs');
const path = require('path');
const logger = require('../../../utils/logger');

class VoiceMapper {
  constructor() {
    this.voiceProfiles = {};
    this.defaultVoices = {};
    this.initialized = false;
    this.init();
  }

  init() {
    try {
      const configPath = path.join(process.cwd(), 'config', 'voice-profiles.json');
      if (fs.existsSync(configPath)) {
        const profiles = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        this.voiceProfiles = profiles.languages || {};
        this.defaultSelections = profiles.defaultSelections || {
          provider: 'elevenlabs',
          gender: 'auto',
        };
        this.initialized = true;
      } else {
        logger.warn('Voice profiles not found. Using fallback voices.');
        this.initializeFallbackVoices();
      }
    } catch (error) {
      logger.error('Error initializing voice mapper:', error);
      this.initializeFallbackVoices();
    }
  }

  initializeFallbackVoices() {
    // Fallback voices if config file is not available
    this.voiceProfiles = {
      en: {
        name: 'English',
        voices: {
          elevenlabs: {
            female: [{ id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel' }],
            male: [{ id: 'GBv7mTt0atIp3Br8iCZE', name: 'Thomas' }],
          },
          azure: {
            female: [{ id: 'en-US-JennyNeural', name: 'Jenny' }],
            male: [{ id: 'en-US-GuyNeural', name: 'Guy' }],
          },
          google: {
            female: [{ id: 'en-US-Wavenet-F', name: 'Wavenet F' }],
            male: [{ id: 'en-US-Wavenet-D', name: 'Wavenet D' }],
          },
        },
      },
    };
    this.defaultSelections = {
      provider: 'elevenlabs',
      gender: 'auto',
    };
    this.initialized = true;
  }

  /**
   * Gets the optimal voice for a language and provider
   * @param {string} languageCode - The ISO language code (e.g., 'en', 'es')
   * @param {string} provider - The TTS provider (elevenlabs, azure, google)
   * @param {string} gender - Preferred gender (female, male, auto)
   * @param {string} style - Voice style (neutral, professional, etc)
   * @returns {Object} The selected voice with id and name
   */
  getVoiceForLanguage(languageCode, provider = null, gender = null, style = null) {
    if (!this.initialized) {
      this.init();
    }

    const normalizedLang = this.normalizeLanguageCode(languageCode);
    provider = provider || this.defaultSelections.provider;
    gender = gender || this.defaultSelections.gender;
    style = style || 'neutral';

    // If language not found, fall back to English
    const langProfile = this.voiceProfiles[normalizedLang] || this.voiceProfiles['en'];

    if (!langProfile) {
      logger.warn(`No voice profile found for language: ${normalizedLang}, using English`);
      return this.getFallbackVoice(provider);
    }

    const providerVoices = langProfile.voices[provider];

    if (!providerVoices) {
      logger.warn(`No ${provider} voices found for ${normalizedLang}, trying another provider`);
      // Try to find voices from any available provider
      const availableProviders = Object.keys(langProfile.voices);
      if (availableProviders.length > 0) {
        return this.getVoiceForLanguage(languageCode, availableProviders[0], gender, style);
      }
      return this.getFallbackVoice(provider);
    }

    // Determine gender to use
    let genderToUse = gender;
    if (gender === 'auto' || !providerVoices[gender] || providerVoices[gender].length === 0) {
      // Prioritize female voices as they tend to be clearer for TTS
      genderToUse = providerVoices.female && providerVoices.female.length > 0 ? 'female' : 'male';
    }

    // Get voices for the selected gender
    const voices = providerVoices[genderToUse] || [];

    if (voices.length === 0) {
      logger.warn(`No ${genderToUse} voices found for ${normalizedLang} with ${provider}`);
      return this.getFallbackVoice(provider);
    }

    // Find voice with matching style or get the first one
    const matchingVoice = voices.find((v) => v.style === style) || voices[0];

    return {
      id: matchingVoice.id,
      name: matchingVoice.name,
      provider: provider,
      gender: genderToUse,
      language: normalizedLang,
      style: matchingVoice.style || 'neutral',
      quality: matchingVoice.quality || 'standard',
    };
  }

  /**
   * Gets all available voices for a language
   * @param {string} languageCode - The ISO language code
   * @returns {Object} Object containing all available voices grouped by provider and gender
   */
  getAllVoicesForLanguage(languageCode) {
    if (!this.initialized) {
      this.init();
    }

    const normalizedLang = this.normalizeLanguageCode(languageCode);
    const langProfile = this.voiceProfiles[normalizedLang] || this.voiceProfiles['en'];

    if (!langProfile) {
      return { elevenlabs: {}, azure: {}, google: {} };
    }

    return langProfile.voices;
  }

  /**
   * Normalizes language code to a standard format
   * @param {string} code - The language code to normalize
   * @returns {string} Normalized language code
   */
  normalizeLanguageCode(code) {
    if (!code) return 'en';

    // Extract the main language part (e.g., 'en-US' -> 'en')
    const primaryCode = code.toLowerCase().split('-')[0];

    // Handle special cases and mappings
    const mappings = {
      cmn: 'zh', // Mandarin -> Chinese
      yue: 'zh', // Cantonese -> Chinese
      zho: 'zh', // Chinese (ISO 639-2) -> Chinese
    };

    return mappings[primaryCode] || primaryCode;
  }

  /**
   * Gets a fallback voice when the requested voice is not available
   * @param {string} provider - The TTS provider
   * @returns {Object} A fallback voice
   */
  getFallbackVoice(provider = 'elevenlabs') {
    const fallbackVoices = {
      elevenlabs: { id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel', gender: 'female', language: 'en' },
      azure: { id: 'en-US-JennyNeural', name: 'Jenny', gender: 'female', language: 'en' },
      google: { id: 'en-US-Wavenet-F', name: 'Wavenet F', gender: 'female', language: 'en' },
    };

    return {
      ...(fallbackVoices[provider] || fallbackVoices.elevenlabs),
      provider: provider,
      style: 'neutral',
      quality: 'standard',
    };
  }

  /**
   * Gets supported languages across all providers
   * @returns {Array} Array of supported language codes
   */
  getSupportedLanguages() {
    if (!this.initialized) {
      this.init();
    }

    return Object.keys(this.voiceProfiles);
  }
}

module.exports = VoiceMapper;
