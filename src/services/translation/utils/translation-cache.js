/**
 * Translation Cache
 * Caches translation results to avoid redundant API calls,
 * improves performance, and reduces API usage costs.
 */

const NodeCache = require('node-cache');
const crypto = require('crypto');

class TranslationCache {
  constructor(options = {}) {
    const {
      ttl = 3600, // Default TTL: 1 hour
      checkperiod = 600, // Check for expired entries every 10 minutes
      maxKeys = 1000, // Maximum number of cache entries
      priorityTTL = 86400, // Priority cache TTL: 24 hours
    } = options;

    this.config = {
      maxCacheSize: options.maxCacheSize || maxKeys,
      defaultExpirySeconds: options.defaultExpirySeconds || ttl,
    };

    this._cache = new NodeCache({
      stdTTL: ttl,
      checkperiod,
      maxKeys: this.config.maxCacheSize,
    });

    // Create a separate priority cache for frequently used translations
    this.priorityCache = new NodeCache({
      stdTTL: priorityTTL,
      checkperiod,
      maxKeys: Math.floor(maxKeys / 5), // 20% of max keys for priority
    });

    this.stats = {
      hits: 0,
      misses: 0,
      totalRequests: 0,
      keys: 0,
      priorityHits: 0,
      hitRate: 0,
    };

    // Track usage frequency for cache items
    this.usageFrequency = {};

    // Usage threshold for promoting to priority cache
    this.priorityThreshold = 3;
  }

  /**
   * Generate a cache key from translation parameters
   *
   * @param {string} text - Text to translate
   * @param {string} sourceLanguage - Source language code
   * @param {string} targetLanguage - Target language code
   * @param {string} service - Translation service name
   * @param {object} options - Additional translation options
   * @returns {string} - Cache key
   */
  generateKey(text, sourceLanguage, targetLanguage, service, options = {}) {
    // Extract relevant options that affect translation output
    const { formality, preserveFormatting, model, glossary } = options;

    // Create key components
    const keyComponents = [
      text,
      sourceLanguage,
      targetLanguage,
      service,
      formality || 'default',
      preserveFormatting ? 'formatted' : 'plain',
      model || 'default',
      glossary || 'none',
    ];

    // Use MD5 hash for long texts to keep keys manageable
    if (text.length > 100) {
      const textHash = crypto.createHash('md5').update(text).digest('hex');
      keyComponents[0] = textHash;
    }

    // Join with a separator unlikely to appear in the text
    return keyComponents.join('|||');
  }

  /**
   * Get a cached translation
   *
   * @param {string} text - Text to translate
   * @param {string} sourceLanguage - Source language code
   * @param {string} targetLanguage - Target language code
   * @param {string} service - Translation service name
   * @param {object} options - Additional translation options
   * @returns {object|null} - Cached translation result or null if not found
   */
  async get(text, sourceLanguage, targetLanguage, service, options = {}) {
    this.stats.totalRequests++;

    // Try service-specific key first
    let cacheKey = this.generateKey(text, sourceLanguage, targetLanguage, service, options);
    let cachedResult = this.priorityCache.get(cacheKey) || this._cache.get(cacheKey);

    // If not found and service is not 'any', try service-agnostic key
    if (!cachedResult && service !== 'any') {
      const anyServiceKey = this.generateKey(text, sourceLanguage, targetLanguage, 'any', options);
      cachedResult = this.priorityCache.get(anyServiceKey) || this._cache.get(anyServiceKey);
    }

    // Check if result is expired
    if (cachedResult && cachedResult._expiry && Date.now() > cachedResult._expiry) {
      // Remove expired entries
      this._cache.del(cacheKey);
      this.priorityCache.del(cacheKey);
      if (service !== 'any') {
        const anyServiceKey = this.generateKey(
          text,
          sourceLanguage,
          targetLanguage,
          'any',
          options
        );
        this._cache.del(anyServiceKey);
        this.priorityCache.del(anyServiceKey);
      }
      cachedResult = null;
    }

    if (cachedResult) {
      this.stats.hits++;
      return cachedResult;
    }

    this.stats.misses++;
    return null;
  }

  /**
   * Store a translation in the cache
   *
   * @param {string} text - Text that was translated
   * @param {string} sourceLanguage - Source language code
   * @param {string} targetLanguage - Target language code
   * @param {string} service - Translation service name
   * @param {object} result - Translation result
   * @param {object} options - Additional translation options
   * @param {number} ttl - Time to live in seconds (optional)
   * @returns {boolean} - Success status
   */
  async set(text, sourceLanguage, targetLanguage, service, result, options = {}, ttl = null) {
    const cacheKey = this.generateKey(text, sourceLanguage, targetLanguage, service, options);

    // Add expiry timestamp if TTL is provided
    const resultWithExpiry = ttl ? { ...result, _expiry: Date.now() + ttl * 1000 } : result;

    // Store in regular cache
    const success = this._cache.set(cacheKey, resultWithExpiry, ttl);

    // Also store service-agnostic entry
    const anyServiceKey = this.generateKey(text, sourceLanguage, targetLanguage, 'any', options);
    this._cache.set(anyServiceKey, resultWithExpiry, ttl);

    this.stats.keys = this._cache.keys().length + this.priorityCache.keys().length;
    this.stats.hitRate = this.stats.hits / (this.stats.hits + this.stats.misses) || 0;

    return success;
  }

  /**
   * Check if a translation is cached
   *
   * @param {string} text - Text to translate
   * @param {string} sourceLanguage - Source language code
   * @param {string} targetLanguage - Target language code
   * @param {string} service - Translation service name
   * @param {object} options - Additional translation options
   * @returns {boolean} - Whether the translation is cached
   */
  has(text, sourceLanguage, targetLanguage, service, options = {}) {
    const cacheKey = this.generateKey(text, sourceLanguage, targetLanguage, service, options);
    return this.priorityCache.has(cacheKey) || this.cache.has(cacheKey);
  }

  /**
   * Remove a cached translation
   *
   * @param {string} text - Text to translate
   * @param {string} sourceLanguage - Source language code
   * @param {string} targetLanguage - Target language code
   * @param {string} service - Translation service name
   * @param {object} options - Additional translation options
   * @returns {number} - Number of deleted entries (0, 1, or 2)
   */
  delete(text, sourceLanguage, targetLanguage, service, options = {}) {
    const cacheKey = this.generateKey(text, sourceLanguage, targetLanguage, service, options);

    let deleted = 0;
    deleted += this.cache.del(cacheKey) ? 1 : 0;
    deleted += this.priorityCache.del(cacheKey) ? 1 : 0;

    if (this.usageFrequency[cacheKey]) {
      delete this.usageFrequency[cacheKey];
    }

    this.stats.keys = this.cache.keys().length + this.priorityCache.keys().length;
    return deleted;
  }

  /**
   * Flush the entire cache
   */
  flush() {
    this.cache.flushAll();
    this.priorityCache.flushAll();
    this.usageFrequency = {};
    this.stats.keys = 0;
  }

  /**
   * Clear the entire cache
   */
  async clear() {
    this._cache.flushAll();
    this.priorityCache.flushAll();
    this.usageFrequency = {};
    this.stats.keys = 0;
    this.stats.hits = 0;
    this.stats.misses = 0;
    this.stats.totalRequests = 0;
  }

  /**
   * Prune expired entries from cache
   */
  pruneCache() {
    // NodeCache automatically handles expiry, but we can force a cleanup
    this._cache.flushAll();
    this.priorityCache.flushAll();
  }

  /**
   * Get cache size
   */
  get size() {
    return this._cache.keys().length + this.priorityCache.keys().length;
  }

  /**
   * Get cache property for test compatibility
   */
  get cache() {
    return {
      size: this._cache.keys().length + this.priorityCache.keys().length,
    };
  }

  /**
   * Get cache statistics
   *
   * @returns {object} - Cache statistics
   */
  getStats() {
    // Update keys count
    this.stats.keys = this._cache.keys().length + this.priorityCache.keys().length;
    this.stats.hitRate = this.stats.hits / (this.stats.hits + this.stats.misses) || 0;

    return {
      ...this.stats,
      size: this.stats.keys,
      regularCacheSize: this._cache.keys().length,
      priorityCacheSize: this.priorityCache.keys().length,
      priorityRatio: this.stats.priorityHits / this.stats.hits || 0,
      cachedTextsCount: Object.keys(this.usageFrequency).length,
    };
  }

  /**
   * Reset cache statistics
   */
  resetStats() {
    this.stats = {
      hits: 0,
      misses: 0,
      keys: this.cache.keys().length + this.priorityCache.keys().length,
      priorityHits: 0,
      hitRate: 0,
    };
  }

  /**
   * Cleanup resources
   */
  destroy() {
    this._cache.close();
    this.priorityCache.close();
    this.usageFrequency = {};
  }
}

module.exports = TranslationCache;
