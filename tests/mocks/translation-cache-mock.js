/**
 * Mock Translation Cache for testing
 */

class MockTranslationCache {
    constructor() {
        this.isInitialized = false;
        this.cache = new Map();
        this.stats = {
            hits: 0,
            misses: 0,
            totalRequests: 0
        };
        this.config = {
            maxCacheSize: 1000,
            defaultExpirySeconds: 3600 // 1 hour
        };
    }

    /**
     * Initialize cache
     * 
     * @returns {Promise<void>}
     */
    async initialize() {
        this.isInitialized = true;
        return Promise.resolve();
    }

    /**
     * Generate cache key from parameters
     * 
     * @param {string} text - Original text
     * @param {string} fromLang - Source language
     * @param {string} toLang - Target language
     * @param {string} service - Service name (or 'any')
     * @param {object} options - Additional options
     * @returns {string} Cache key
     */
    generateKey(text, fromLang, toLang, service = 'any', options = {}) {
        const { formality = 'neutral', preserveFormatting = true } = options;
        return `${service}:${fromLang}:${toLang}:${formality}:${preserveFormatting}:${text}`;
    }

    /**
     * Store translation in cache
     * 
     * @param {string} text - Original text
     * @param {string} fromLang - Source language
     * @param {string} toLang - Target language
     * @param {string} service - Service name
     * @param {object} result - Translation result
     * @param {object} options - Additional options
     * @param {number} expirySeconds - Cache expiry in seconds
     * @returns {Promise<void>}
     */
    async set(text, fromLang, toLang, service, result, options = {}, expirySeconds = null) {
        const key = this.generateKey(text, fromLang, toLang, service, options);
        const expiry = Date.now() + ((expirySeconds || this.config.defaultExpirySeconds) * 1000);

        this.cache.set(key, {
            result,
            expiry
        });

        // Also store with service='any' for service-agnostic lookups
        if (service !== 'any') {
            const anyKey = this.generateKey(text, fromLang, toLang, 'any', options);
            this.cache.set(anyKey, {
                result,
                expiry
            });
        }

        // Prune cache if it exceeds maximum size
        if (this.cache.size > this.config.maxCacheSize) {
            this.pruneCache();
        }
    }

    /**
     * Get translation from cache
     * 
     * @param {string} text - Original text
     * @param {string} fromLang - Source language
     * @param {string} toLang - Target language
     * @param {string} service - Service name (or 'any')
     * @param {object} options - Additional options
     * @returns {Promise<object>} Translation result or null
     */
    async get(text, fromLang, toLang, service = 'any', options = {}) {
        this.stats.totalRequests++;

        const key = this.generateKey(text, fromLang, toLang, service, options);

        if (!this.cache.has(key)) {
            this.stats.misses++;
            return null;
        }

        const cached = this.cache.get(key);

        // Check if cache entry has expired
        if (cached.expiry < Date.now()) {
            this.cache.delete(key);
            this.stats.misses++;
            return null;
        }

        this.stats.hits++;
        return cached.result;
    }

    /**
     * Prune expired cache entries
     */
    pruneCache() {
        const now = Date.now();
        let pruned = 0;

        // Remove expired entries
        for (const [key, value] of this.cache.entries()) {
            if (value.expiry < now) {
                this.cache.delete(key);
                pruned++;
            }
        }

        // If still too large, remove oldest entries
        if (this.cache.size > this.config.maxCacheSize) {
            const entriesToDelete = this.cache.size - this.config.maxCacheSize;
            const entries = [...this.cache.entries()];

            // Sort by expiry (oldest first)
            entries.sort((a, b) => a[1].expiry - b[1].expiry);

            // Delete oldest entries
            for (let i = 0; i < entriesToDelete; i++) {
                this.cache.delete(entries[i][0]);
                pruned++;
            }
        }
    }

    /**
     * Get cache statistics
     * 
     * @returns {object} Cache statistics
     */
    getStats() {
        return {
            ...this.stats,
            size: this.cache.size,
            hitRate: this.stats.totalRequests > 0
                ? this.stats.hits / this.stats.totalRequests
                : 0
        };
    }

    /**
     * Clear cache
     * 
     * @returns {Promise<void>}
     */
    async clear() {
        this.cache.clear();
        return Promise.resolve();
    }
}

module.exports = MockTranslationCache;
