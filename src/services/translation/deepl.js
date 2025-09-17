/**
 * Custom error class for DeepL translation errors
 */
class TranslationError extends Error {
  constructor(message, originalError = null) {
    super(message);
    this.name = 'TranslationError';
    this.originalError = originalError;
  }
}

class DeepLTranslator {
  constructor(config = {}) {
    this.apiKey = config.apiKey || process.env.DEEPL_API_KEY;
    this.initialized = false;

    // Configuration with defaults
    this.config = {
      maxRetries: config.maxRetries || 3,
      retryDelay: config.retryDelay || 1000,
      timeout: config.timeout || 30000,
      maxRequestsPerMinute: config.maxRequestsPerMinute || 60,
    };

    // Rate limiting setup
    this.rateLimiter = {
      queue: [],
      processing: false,
      requestCount: 0,
      resetTime: Date.now() + 60000, // Reset every minute
    };

    // Source languages supported by DeepL
    this.sourceLanguages = [
      { code: 'en', name: 'English' },
      { code: 'es', name: 'Spanish' },
      { code: 'fr', name: 'French' },
      { code: 'de', name: 'German' },
      { code: 'it', name: 'Italian' },
      { code: 'pt', name: 'Portuguese' },
      { code: 'ru', name: 'Russian' },
      { code: 'zh', name: 'Chinese' },
      { code: 'ja', name: 'Japanese' },
      { code: 'ko', name: 'Korean' },
      { code: 'nl', name: 'Dutch' },
      { code: 'pl', name: 'Polish' },
      { code: 'bg', name: 'Bulgarian' },
      { code: 'cs', name: 'Czech' },
      { code: 'da', name: 'Danish' },
      { code: 'et', name: 'Estonian' },
      { code: 'fi', name: 'Finnish' },
      { code: 'el', name: 'Greek' },
      { code: 'hu', name: 'Hungarian' },
      { code: 'lv', name: 'Latvian' },
      { code: 'lt', name: 'Lithuanian' },
      { code: 'ro', name: 'Romanian' },
      { code: 'sk', name: 'Slovak' },
      { code: 'sl', name: 'Slovenian' },
      { code: 'sv', name: 'Swedish' },
      { code: 'uk', name: 'Ukrainian' },
      { code: 'id', name: 'Indonesian' },
      { code: 'tr', name: 'Turkish' },
    ];

    // Target languages supported by DeepL
    this.targetLanguages = [
      { code: 'en-US', name: 'English (American)' },
      { code: 'en-GB', name: 'English (British)' },
      { code: 'es', name: 'Spanish' },
      { code: 'fr', name: 'French' },
      { code: 'de', name: 'German' },
      { code: 'it', name: 'Italian' },
      { code: 'pt-PT', name: 'Portuguese (European)' },
      { code: 'pt-BR', name: 'Portuguese (Brazilian)' },
      { code: 'ru', name: 'Russian' },
      { code: 'zh', name: 'Chinese (simplified)' },
      { code: 'ja', name: 'Japanese' },
      { code: 'ko', name: 'Korean' },
      { code: 'nl', name: 'Dutch' },
      { code: 'pl', name: 'Polish' },
      { code: 'bg', name: 'Bulgarian' },
      { code: 'cs', name: 'Czech' },
      { code: 'da', name: 'Danish' },
      { code: 'et', name: 'Estonian' },
      { code: 'fi', name: 'Finnish' },
      { code: 'el', name: 'Greek' },
      { code: 'hu', name: 'Hungarian' },
      { code: 'lv', name: 'Latvian' },
      { code: 'lt', name: 'Lithuanian' },
      { code: 'ro', name: 'Romanian' },
      { code: 'sk', name: 'Slovak' },
      { code: 'sl', name: 'Slovenian' },
      { code: 'sv', name: 'Swedish' },
      { code: 'uk', name: 'Ukrainian' },
      { code: 'id', name: 'Indonesian' },
      { code: 'tr', name: 'Turkish' },
    ];

    // For backward compatibility
    this.supportedLanguages = this.sourceLanguages;
  }

  async initialize() {
    if (!this.apiKey) {
      throw new Error('DeepL API key is required');
    }

    // Validate API key format using centralized validation
    const ApiKeyManager = require('../security/api-key-manager');
    const keyManager = new ApiKeyManager();
    if (!keyManager.isValidApiKeyFormat('deepl', this.apiKey)) {
      throw new Error('Invalid DeepL API key format');
    }

    try {
      // Verify the API key by making a simple request
      const url = 'https://api.deepl.com/v2/usage';
      const headers = {
        Authorization: `DeepL-Auth-Key ${this.apiKey}`,
      };

      const response = await fetch(url, { headers });

      if (!response.ok) {
        throw new Error(`DeepL API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      // Update rate limiting based on actual usage limits if available
      if (data.character_limit && data.character_count) {
        const remainingCharacters = data.character_limit - data.character_count;
        console.log(
          `DeepL API usage: ${data.character_count}/${data.character_limit} characters used`
        );
        console.log(`DeepL API remaining: ${remainingCharacters} characters`);
      }

      this.initialized = true;
      return { success: true };
    } catch (error) {
      console.error('DeepL initialization error:', error);
      throw new Error(`DeepL initialization failed: ${error.message}`);
    }
  }

  /**
   * Translate text using DeepL API
   * @param {string} text - Text to translate
   * @param {Object} options - Translation options
   * @param {string} options.from - Source language code (default: 'auto')
   * @param {string} options.to - Target language code (default: 'en')
   * @param {string} options.formality - Formality level (default: 'default')
   * @returns {Promise<Object>} Translation result
   */
  async translate(text, { from = 'auto', to = 'en', formality = 'default' } = {}) {
    if (!this.initialized) {
      throw new Error('DeepL Translator not initialized');
    }

    if (!text) {
      throw new Error('No text provided for translation');
    }

    // Validate language pair
    if (from !== 'auto') {
      this._validateSourceLanguage(from);
    }
    this._validateTargetLanguage(to);

    // Add to rate limiting queue
    return this._enqueueRequest(async () => {
      let retryCount = 0;
      const maxRetries = this.config.maxRetries;
      const retryDelay = this.config.retryDelay;

      while (retryCount <= maxRetries) {
        try {
          if (retryCount > 0) {
            console.log(`Retrying DeepL translation (attempt ${retryCount} of ${maxRetries})...`);
            await new Promise((resolve) => setTimeout(resolve, retryDelay * retryCount));
          }

          const url = 'https://api.deepl.com/v2/translate';
          const headers = {
            Authorization: `DeepL-Auth-Key ${this.apiKey}`,
            'Content-Type': 'application/json',
          };

          // Normalize language codes for DeepL API
          const sourceLang = from === 'auto' ? null : this._normalizeLanguageCode(from, 'source');
          const targetLang = this._normalizeLanguageCode(to, 'target');

          const body = JSON.stringify({
            text: [text],
            source_lang: sourceLang,
            target_lang: targetLang,
            formality: formality,
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
              const errorData = await response.json().catch(() => ({}));

              // Handle rate limiting
              if (response.status === 429) {
                if (retryCount < maxRetries) {
                  retryCount++;
                  const retryAfter = response.headers.get('retry-after');
                  const waitTime = retryAfter
                    ? parseInt(retryAfter, 10) * 1000
                    : retryDelay * retryCount;
                  console.warn(`DeepL rate limit exceeded. Retrying after ${waitTime}ms...`);
                  await new Promise((resolve) => setTimeout(resolve, waitTime));
                  continue;
                }
              }

              throw new Error(
                `DeepL API error: ${response.status} ${response.statusText} ${JSON.stringify(errorData)}`
              );
            }

            const data = await response.json();

            if (!data.translations || data.translations.length === 0) {
              throw new Error('DeepL returned no translations');
            }

            return {
              translatedText: data.translations[0].text,
              detectedSourceLang: data.translations[0].detected_source_language,
              provider: 'deepl',
            };
          } finally {
            clearTimeout(timeoutId);
          }
        } catch (error) {
          // Handle timeout errors
          if (error.name === 'AbortError') {
            if (retryCount < maxRetries) {
              retryCount++;
              console.warn(`DeepL request timed out. Retrying (${retryCount}/${maxRetries})...`);
              continue;
            }
            throw new Error('DeepL translation timed out');
          }

          // Handle other retryable errors
          if (this._isRetryableError(error) && retryCount < maxRetries) {
            retryCount++;
            continue;
          }

          // Not retryable or max retries reached
          console.error('DeepL translation error:', error);
          throw new TranslationError(`DeepL translation failed: ${error.message}`, error);
        }
      }
    });
  }

  /**
   * Get supported source languages
   * @returns {Promise<Array>} List of supported source languages
   */
  async getSupportedLanguages() {
    if (!this.initialized) {
      throw new Error('DeepL Translator not initialized');
    }

    return this.sourceLanguages;
  }

  /**
   * Get supported target languages
   * @returns {Promise<Array>} List of supported target languages
   */
  async getSupportedTargetLanguages() {
    if (!this.initialized) {
      throw new Error('DeepL Translator not initialized');
    }

    return this.targetLanguages;
  }

  /**
   * Check if a language pair is supported
   * @param {string} from - Source language code
   * @param {string} to - Target language code
   * @returns {boolean} True if the language pair is supported
   */
  isLanguagePairSupported(from, to) {
    if (from === 'auto') return this._isTargetLanguageSupported(to);
    return this._isSourceLanguageSupported(from) && this._isTargetLanguageSupported(to);
  }

  /**
   * Validate source language
   * @private
   */
  _validateSourceLanguage(lang) {
    if (!this._isSourceLanguageSupported(lang)) {
      throw new Error(`Source language '${lang}' is not supported by DeepL`);
    }
  }

  /**
   * Validate target language
   * @private
   */
  _validateTargetLanguage(lang) {
    if (!this._isTargetLanguageSupported(lang)) {
      throw new Error(`Target language '${lang}' is not supported by DeepL`);
    }
  }

  /**
   * Check if source language is supported
   * @private
   */
  _isSourceLanguageSupported(lang) {
    const normalizedLang = lang.toLowerCase().split('-')[0]; // Strip region code
    return this.sourceLanguages.some((l) => l.code.toLowerCase().split('-')[0] === normalizedLang);
  }

  /**
   * Check if target language is supported
   * @private
   */
  _isTargetLanguageSupported(lang) {
    const normalizedLang = lang.toLowerCase();
    const baseLang = normalizedLang.split('-')[0]; // Get base language without region

    // First try exact match including region
    const exactMatch = this.targetLanguages.some((l) => l.code.toLowerCase() === normalizedLang);
    if (exactMatch) return true;

    // Then try base language match
    return this.targetLanguages.some((l) => l.code.toLowerCase().split('-')[0] === baseLang);
  }

  /**
   * Normalize language code for DeepL API
   * @private
   */
  _normalizeLanguageCode(lang, type) {
    if (!lang) return null;

    // For source languages, DeepL expects uppercase language codes without region
    if (type === 'source') {
      return lang.split('-')[0].toUpperCase();
    }

    // For target languages, DeepL expects uppercase language codes with region if specified
    return lang.toUpperCase();
  }

  /**
   * Check if an error is retryable
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

  /**
   * Add a request to the rate limiting queue
   * @private
   */
  async _enqueueRequest(requestFn) {
    return new Promise((resolve, reject) => {
      // Add request to queue
      this.rateLimiter.queue.push({ requestFn, resolve, reject });

      // Process queue if not already processing
      if (!this.rateLimiter.processing) {
        this._processQueue();
      }
    });
  }

  /**
   * Process the rate limiting queue
   * @private
   */
  async _processQueue() {
    if (this.rateLimiter.queue.length === 0) {
      this.rateLimiter.processing = false;
      return;
    }

    this.rateLimiter.processing = true;

    // Check if we need to reset the counter
    const now = Date.now();
    if (now >= this.rateLimiter.resetTime) {
      this.rateLimiter.requestCount = 0;
      this.rateLimiter.resetTime = now + 60000; // Reset every minute
    }

    // Check if we're under the rate limit
    if (this.rateLimiter.requestCount < this.rateLimiter.maxRequestsPerMinute) {
      const { requestFn, resolve, reject } = this.rateLimiter.queue.shift();
      this.rateLimiter.requestCount++;

      try {
        const result = await requestFn();
        resolve(result);
      } catch (error) {
        reject(error);
      }

      // Continue processing queue
      setTimeout(() => this._processQueue(), 50); // Small delay between requests
    } else {
      // We've hit the rate limit, wait until reset
      const waitTime = this.rateLimiter.resetTime - now;
      setTimeout(() => this._processQueue(), waitTime);
    }
  }
}

module.exports = DeepLTranslator;
