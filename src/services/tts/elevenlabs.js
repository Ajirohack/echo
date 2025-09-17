const fetch = require('node-fetch');
const { Readable } = require('stream');

/**
 * Custom error class for ElevenLabs TTS errors
 */
class TTSError extends Error {
  constructor(message, originalError = null) {
    super(message);
    this.name = 'TTSError';
    this.originalError = originalError;
  }
}

class ElevenLabsTTS {
  constructor(config = {}) {
    this.apiKey = config.apiKey || process.env.ELEVENLABS_API_KEY;
    this.initialized = false;

    // Configuration with defaults
    this.config = {
      defaultVoice: config.defaultVoice || 'Rachel',
      defaultModel: config.defaultModel || 'eleven_monolingual_v1',
      stability: config.stability || 0.5,
      similarityBoost: config.similarityBoost || 0.75,
      style: config.style || 0,
      speakerBoost: config.speakerBoost || true,
      baseUrl: config.baseUrl || 'https://api.elevenlabs.io/v1',
      maxRetries: config.maxRetries || 3,
      retryDelay: config.retryDelay || 1000,
      timeout: config.timeout || 30000,
      useCaching: config.useCaching !== undefined ? config.useCaching : true,
      cacheDir: config.cacheDir || './cache/tts',
    };

    // Voice cache
    this.voiceCache = null;

    // Model cache
    this.modelCache = null;

    // Audio cache for repeated phrases
    this.audioCache = new Map();

    this.voices = [
      {
        voice_id: '21m00Tcm4TlvDq8ikWAM',
        name: 'Rachel',
        description: 'Calm and clear female voice',
      },
      {
        voice_id: 'AZnzlk1XvdvUeBnXmlld',
        name: 'Domi',
        description: 'Strong and expressive male voice',
      },
      {
        voice_id: 'EXAVITQu4vr4xnSDxMaL',
        name: 'Bella',
        description: 'Soft and gentle female voice',
      },
      {
        voice_id: 'ErXwobaYiN019PkySvjV',
        name: 'Antoni',
        description: 'Warm and engaging male voice',
      },
      {
        voice_id: 'MF3mGyEYCl7XYWbV9V6O',
        name: 'Elli',
        description: 'Friendly and approachable female voice',
      },
    ];
  }

  /**
   * Initialize the ElevenLabs TTS service
   * @returns {Promise<Object>} Initialization result
   */
  async initialize() {
    if (!this.apiKey) {
      throw new TTSError('ElevenLabs API key is required');
    }

    // Validate API key format using centralized validation
    const ApiKeyManager = require('../security/api-key-manager');
    const keyManager = new ApiKeyManager();
    if (!keyManager.isValidApiKeyFormat('elevenlabs', this.apiKey)) {
      throw new TTSError('Invalid ElevenLabs API key format');
    }

    try {
      // Verify the API key by fetching available voices
      await this.fetchVoices();

      // Fetch available models
      await this.fetchModels();

      this.initialized = true;
      return { success: true };
    } catch (error) {
      console.error('ElevenLabs initialization error:', error);
      throw new TTSError(`ElevenLabs initialization failed: ${error.message}`, error);
    }
  }

  /**
   * Convert text to speech using ElevenLabs API
   * @param {string} text - Text to convert to speech
   * @param {Object} options - TTS options
   * @param {string} options.voice - Voice name to use
   * @param {string} options.voiceId - Voice ID to use (overrides voice name)
   * @param {string} options.model - Model ID to use
   * @param {number} options.stability - Voice stability (0.0-1.0)
   * @param {number} options.similarityBoost - Voice similarity boost (0.0-1.0)
   * @param {number} options.style - Speaking style (0.0-1.0)
   * @param {boolean} options.speakerBoost - Enable speaker boost
   * @returns {Promise<Buffer>} Audio buffer
   */
  async textToSpeech(text, options = {}) {
    if (!this.initialized) {
      throw new TTSError('ElevenLabs TTS not initialized');
    }

    if (!text || typeof text !== 'string') {
      throw new TTSError('No valid text provided for text-to-speech');
    }

    // Check for cached audio if caching is enabled
    const cacheKey = this._generateCacheKey(text, options);
    if (this.config.useCaching && this.audioCache.has(cacheKey)) {
      console.log('Using cached audio for text');
      return this.audioCache.get(cacheKey);
    }

    // Process options with defaults
    const processedOptions = this._processOptions(options);

    let retryCount = 0;
    const maxRetries = this.config.maxRetries;
    const retryDelay = this.config.retryDelay;

    while (retryCount <= maxRetries) {
      try {
        if (retryCount > 0) {
          console.log(`Retrying ElevenLabs TTS (attempt ${retryCount} of ${maxRetries})...`);
          await new Promise((resolve) => setTimeout(resolve, retryDelay * retryCount));
        }

        const url = `${this.config.baseUrl}/text-to-speech/${processedOptions.voiceId}`;
        const headers = {
          Accept: 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': this.apiKey,
        };

        const body = JSON.stringify({
          text,
          model_id: processedOptions.model,
          voice_settings: {
            stability: processedOptions.stability,
            similarity_boost: processedOptions.similarityBoost,
            style: processedOptions.style,
            use_speaker_boost: processedOptions.speakerBoost,
          },
        });

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

        try {
          const response = await fetch(url, {
            method: 'POST',
            headers,
            body,
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          if (!response.ok) {
            const errorData = await response.text();

            // Handle rate limiting
            if (response.status === 429) {
              if (retryCount < maxRetries) {
                retryCount++;
                const retryAfter = response.headers.get('retry-after');
                const waitTime = retryAfter
                  ? parseInt(retryAfter, 10) * 1000
                  : retryDelay * retryCount;
                console.warn(`ElevenLabs rate limit exceeded. Retrying after ${waitTime}ms...`);
                await new Promise((resolve) => setTimeout(resolve, waitTime));
                continue;
              }
            }

            throw new Error(
              `ElevenLabs API error: ${response.status} ${response.statusText} ${errorData}`
            );
          }

          const audioBuffer = await response.arrayBuffer();
          const buffer = Buffer.from(audioBuffer);

          // Cache the result if caching is enabled
          if (this.config.useCaching) {
            this.audioCache.set(cacheKey, buffer);
          }

          return buffer;
        } finally {
          clearTimeout(timeoutId);
        }
      } catch (error) {
        // Handle timeout errors
        if (error.name === 'AbortError') {
          if (retryCount < maxRetries) {
            retryCount++;
            console.warn(`ElevenLabs request timed out. Retrying (${retryCount}/${maxRetries})...`);
            continue;
          }
          throw new TTSError('ElevenLabs TTS request timed out');
        }

        // Handle other retryable errors
        if (this._isRetryableError(error) && retryCount < maxRetries) {
          retryCount++;
          continue;
        }

        // Not retryable or max retries reached
        console.error('ElevenLabs TTS error:', error);
        throw new TTSError(`ElevenLabs TTS failed: ${error.message}`, error);
      }
    }
  }

  /**
   * Get available voices
   * @returns {Promise<Array>} List of available voices
   */
  async getVoices() {
    if (!this.initialized) {
      throw new TTSError('ElevenLabs TTS not initialized');
    }

    if (!this.voiceCache) {
      await this.fetchVoices();
    }

    return this.voiceCache;
  }

  /**
   * Fetch voices from ElevenLabs API
   * @private
   */
  async fetchVoices() {
    try {
      const url = `${this.config.baseUrl}/voices`;
      const headers = {
        'xi-api-key': this.apiKey,
      };

      const response = await fetch(url, { headers });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(
          `ElevenLabs API error: ${response.status} ${response.statusText} ${errorData}`
        );
      }

      const data = await response.json();

      if (!data.voices || !Array.isArray(data.voices)) {
        throw new Error('Invalid response format from ElevenLabs API');
      }

      this.voiceCache = data.voices.map((voice) => ({
        id: voice.voice_id,
        name: voice.name,
        description: voice.description || '',
        previewUrl: voice.preview_url || null,
        category: voice.category || 'premade',
        labels: voice.labels || {},
      }));

      return this.voiceCache;
    } catch (error) {
      console.error('Error fetching ElevenLabs voices:', error);
      throw new TTSError(`Failed to fetch voices: ${error.message}`, error);
    }
  }

  /**
   * Get available models
   * @returns {Promise<Array>} List of available models
   */
  async getModels() {
    if (!this.initialized) {
      throw new TTSError('ElevenLabs TTS not initialized');
    }

    if (!this.modelCache) {
      await this.fetchModels();
    }

    return this.modelCache;
  }

  /**
   * Fetch models from ElevenLabs API
   * @private
   */
  async fetchModels() {
    try {
      const url = `${this.config.baseUrl}/models`;
      const headers = {
        'xi-api-key': this.apiKey,
      };

      const response = await fetch(url, { headers });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(
          `ElevenLabs API error: ${response.status} ${response.statusText} ${errorData}`
        );
      }

      const data = await response.json();

      this.modelCache = data.map((model) => ({
        id: model.model_id,
        name: model.name,
        description: model.description || '',
        languages: model.languages || [],
        canDoTextToSpeech: model.can_do_text_to_speech || false,
        canDoVoiceConversion: model.can_do_voice_conversion || false,
      }));

      return this.modelCache;
    } catch (error) {
      console.error('Error fetching ElevenLabs models:', error);
      throw new TTSError(`Failed to fetch models: ${error.message}`, error);
    }
  }

  /**
   * Create a custom voice
   * @param {string} name - Voice name
   * @param {string} description - Voice description
   * @param {Array<Buffer>} samples - Voice sample audio buffers
   * @returns {Promise<Object>} Created voice
   */
  async createVoice(name, description, samples) {
    if (!this.initialized) {
      throw new TTSError('ElevenLabs TTS not initialized');
    }

    if (!name || typeof name !== 'string') {
      throw new TTSError('Voice name is required');
    }

    if (!samples || !Array.isArray(samples) || samples.length === 0) {
      throw new TTSError('At least one voice sample is required');
    }

    try {
      const url = `${this.config.baseUrl}/voices/add`;
      const headers = {
        'xi-api-key': this.apiKey,
      };

      const formData = new FormData();
      formData.append('name', name);

      if (description) {
        formData.append('description', description);
      }

      // Add each sample to the form data
      samples.forEach((sample, index) => {
        const blob = new Blob([sample], { type: 'audio/mpeg' });
        formData.append(`files`, blob, `sample_${index}.mp3`);
      });

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(
          `ElevenLabs API error: ${response.status} ${response.statusText} ${errorData}`
        );
      }

      const data = await response.json();

      // Refresh voice cache
      await this.fetchVoices();

      return {
        id: data.voice_id,
        name: data.name,
        description: data.description || '',
      };
    } catch (error) {
      console.error('Error creating ElevenLabs voice:', error);
      throw new TTSError(`Failed to create voice: ${error.message}`, error);
    }
  }

  /**
   * Delete a custom voice
   * @param {string} voiceId - Voice ID to delete
   * @returns {Promise<boolean>} Success status
   */
  async deleteVoice(voiceId) {
    if (!this.initialized) {
      throw new TTSError('ElevenLabs TTS not initialized');
    }

    if (!voiceId) {
      throw new TTSError('Voice ID is required');
    }

    try {
      const url = `${this.config.baseUrl}/voices/${voiceId}`;
      const headers = {
        'xi-api-key': this.apiKey,
      };

      const response = await fetch(url, {
        method: 'DELETE',
        headers,
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(
          `ElevenLabs API error: ${response.status} ${response.statusText} ${errorData}`
        );
      }

      // Refresh voice cache
      await this.fetchVoices();

      return true;
    } catch (error) {
      console.error('Error deleting ElevenLabs voice:', error);
      throw new TTSError(`Failed to delete voice: ${error.message}`, error);
    }
  }

  /**
   * Generate a cache key for audio caching
   * @param {string} text - Text to convert
   * @param {Object} options - TTS options
   * @returns {string} Cache key
   * @private
   */
  _generateCacheKey(text, options) {
    const processedOptions = this._processOptions(options);
    return `${text}_${processedOptions.voiceId}_${processedOptions.model}_${processedOptions.stability}_${processedOptions.similarityBoost}`;
  }

  /**
   * Process TTS options with defaults
   * @param {Object} options - TTS options
   * @returns {Object} Processed options
   * @private
   */
  _processOptions(options) {
    // Find voice ID from name or use provided ID
    let voiceId;
    if (options.voiceId) {
      voiceId = options.voiceId;
    } else if (options.voice) {
      const voice = this.voiceCache?.find(
        (v) => v.name.toLowerCase() === options.voice.toLowerCase()
      );
      voiceId = voice?.id;
    }

    // If no voice found, use default
    if (!voiceId) {
      const defaultVoice = this.voiceCache?.find(
        (v) => v.name.toLowerCase() === this.config.defaultVoice.toLowerCase()
      );
      voiceId = defaultVoice?.id || this.voiceCache?.[0]?.id;

      // Fallback to predefined voices if API fetch failed
      if (!voiceId) {
        const fallbackVoice = this.voices.find(
          (v) => v.name.toLowerCase() === this.config.defaultVoice.toLowerCase()
        );
        voiceId = fallbackVoice?.voice_id || this.voices[0].voice_id;
      }
    }

    // Find model or use default
    let model = options.model;
    if (!model) {
      const defaultModel = this.modelCache?.find((m) => m.id === this.config.defaultModel);
      model = defaultModel?.id || this.config.defaultModel;
    }

    return {
      voiceId,
      model,
      stability: options.stability !== undefined ? options.stability : this.config.stability,
      similarityBoost:
        options.similarityBoost !== undefined
          ? options.similarityBoost
          : this.config.similarityBoost,
      style: options.style !== undefined ? options.style : this.config.style,
      speakerBoost:
        options.speakerBoost !== undefined ? options.speakerBoost : this.config.speakerBoost,
    };
  }

  /**
   * Check if an error is retryable
   * @param {Error} error - Error to check
   * @returns {boolean} True if the error is retryable
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
    if (error.message && error.message.includes('429')) {
      return true;
    }

    // Check for server errors (5xx)
    if (error.message && /5\d\d/.test(error.message)) {
      return true;
    }

    return false;
  }
}

module.exports = ElevenLabsTTS;
