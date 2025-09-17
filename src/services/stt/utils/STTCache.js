const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { promisify } = require('util');
const logger = require('../../../utils/logger');

const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);
const unlink = promisify(fs.unlink);
const stat = promisify(fs.stat);
const readdir = promisify(fs.readdir);

/**
 * STTCache provides a disk-based cache for STT results to improve performance
 * and reduce API calls to STT services.
 */
class STTCache {
  constructor(config = {}) {
    this.config = {
      cacheDir: path.join(require('os').tmpdir(), 'universal-translator', 'stt-cache'),
      ttl: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
      maxSize: 100 * 1024 * 1024, // 100MB
      cleanupInterval: 60 * 60 * 1000, // 1 hour in milliseconds
      ...config,
    };

    this.cache = new Map(); // In-memory cache for quick lookups
    this.cleanupTimer = null;
    this.currentSize = 0;
    this.isInitialized = false;
  }

  /**
   * Initialize the cache
   */
  async init() {
    if (this.isInitialized) return;

    try {
      // Create cache directory if it doesn't exist
      if (!fs.existsSync(this.config.cacheDir)) {
        fs.mkdirSync(this.config.cacheDir, { recursive: true });
      }

      // Load cache metadata
      await this._loadCacheMetadata();

      // Start cleanup timer
      this.cleanupTimer = setInterval(() => this.cleanup(), this.config.cleanupInterval);

      this.isInitialized = true;
      logger.info('STT cache initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize STT cache:', error);
      throw error;
    }
  }

  /**
   * Load cache metadata from disk
   * @private
   */
  async _loadCacheMetadata() {
    try {
      const files = await readdir(this.config.cacheDir);
      let totalSize = 0;

      // Process each file in the cache directory
      for (const file of files) {
        if (!file.endsWith('.json')) continue;

        try {
          const filePath = path.join(this.config.cacheDir, file);
          const fileStat = await stat(filePath);

          // Skip if file is empty or invalid
          if (fileStat.size === 0) {
            await unlink(filePath);
            continue;
          }

          // Read the cache entry
          const data = await readFile(filePath, 'utf8');
          const entry = JSON.parse(data);

          // Validate entry
          if (!entry || !entry.key || !entry.expiresAt) {
            await unlink(filePath);
            continue;
          }

          // Skip if expired
          if (Date.now() > entry.expiresAt) {
            await unlink(filePath);
            continue;
          }

          // Add to in-memory cache
          this.cache.set(entry.key, {
            ...entry,
            filePath,
          });

          totalSize += fileStat.size;
        } catch (error) {
          logger.warn(`Error loading cache file ${file}:`, error);
          // Try to clean up the corrupted file
          try {
            await unlink(path.join(this.config.cacheDir, file));
          } catch (e) {
            // Ignore cleanup errors
          }
        }
      }

      this.currentSize = totalSize;
      logger.debug(`Loaded ${this.cache.size} cache entries (${this._formatBytes(totalSize)})`);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        // Ignore if directory doesn't exist
        logger.error('Error loading cache metadata:', error);
        throw error;
      }
    }
  }

  /**
   * Generate a cache key from audio data and options
   * @private
   */
  _generateKey(audioData, options = {}) {
    const { language, service, ...otherOptions } = options;

    // Create a hash of the audio data and options
    const hash = crypto.createHash('sha256');

    // Add audio data to hash
    if (Buffer.isBuffer(audioData)) {
      hash.update(audioData);
    } else if (typeof audioData === 'string') {
      hash.update(fs.readFileSync(audioData));
    } else {
      throw new Error('Invalid audio data format');
    }

    // Add options to hash
    const optionsString = JSON.stringify({
      language,
      service,
      ...otherOptions,
    });
    hash.update(optionsString);

    return hash.digest('hex');
  }

  /**
   * Get a cached STT result
   * @param {Buffer|string} audioData - Audio data or path to audio file
   * @param {Object} options - STT options
   * @returns {Promise<Object|null>} Cached result or null if not found
   */
  async get(audioData, options = {}) {
    if (!this.isInitialized) {
      await this.init();
    }

    try {
      const key = this._generateKey(audioData, options);
      const entry = this.cache.get(key);

      // Check if entry exists and is not expired
      if (entry) {
        if (Date.now() > entry.expiresAt) {
          // Entry expired, remove it
          await this._removeEntry(entry);
          return null;
        }

        try {
          // Read the cached result
          const data = await readFile(entry.filePath, 'utf8');
          const result = JSON.parse(data);

          // Update last accessed time
          entry.lastAccessed = Date.now();
          await this._updateEntry(entry);

          logger.debug(`Cache hit for key: ${key}`);
          return result.result;
        } catch (error) {
          logger.warn('Error reading cached result:', error);
          await this._removeEntry(entry);
          return null;
        }
      }

      return null;
    } catch (error) {
      logger.error('Cache get error:', error);
      return null;
    }
  }

  /**
   * Store an STT result in the cache
   * @param {Buffer|string} audioData - Audio data or path to audio file
   * @param {Object} result - STT result to cache
   * @param {Object} options - STT options
   * @returns {Promise<boolean>} True if successfully cached
   */
  async set(audioData, result, options = {}) {
    if (!this.isInitialized) {
      await this.init();
    }

    try {
      const key = this._generateKey(audioData, options);
      const now = Date.now();

      // Create cache entry
      const entry = {
        key,
        service: options.service || 'unknown',
        language: options.language || 'unknown',
        createdAt: now,
        lastAccessed: now,
        expiresAt: now + (options.ttl || this.config.ttl),
        size: 0,
        filePath: path.join(this.config.cacheDir, `${key}.json`),
      };

      // Prepare result for storage
      const cacheData = {
        metadata: {
          key: entry.key,
          service: entry.service,
          language: entry.language,
          createdAt: entry.createdAt,
          expiresAt: entry.expiresAt,
        },
        result: result,
      };

      // Serialize the result
      const data = JSON.stringify(cacheData, null, 2);
      entry.size = Buffer.byteLength(data, 'utf8');

      // Check if we have enough space
      await this._ensureSpace(entry.size);

      // Write to disk
      await writeFile(entry.filePath, data, 'utf8');

      // Update in-memory cache
      this.cache.set(key, entry);
      this.currentSize += entry.size;

      logger.debug(`Cached result for key: ${key} (${this._formatBytes(entry.size)})`);
      return true;
    } catch (error) {
      logger.error('Cache set error:', error);
      return false;
    }
  }

  /**
   * Remove an entry from the cache
   * @private
   */
  async _removeEntry(entry) {
    try {
      if (entry && entry.filePath) {
        // Remove file
        await unlink(entry.filePath).catch(() => {});

        // Update size and in-memory cache
        this.currentSize = Math.max(0, this.currentSize - (entry.size || 0));
        this.cache.delete(entry.key);

        logger.debug(`Removed cache entry: ${entry.key}`);
      }
    } catch (error) {
      logger.error('Error removing cache entry:', error);
    }
  }

  /**
   * Update an existing cache entry
   * @private
   */
  async _updateEntry(entry) {
    try {
      if (entry && entry.filePath) {
        const data = await readFile(entry.filePath, 'utf8');
        const cacheData = JSON.parse(data);

        // Update metadata
        cacheData.metadata.lastAccessed = entry.lastAccessed;

        // Write back to disk
        await writeFile(entry.filePath, JSON.stringify(cacheData, null, 2), 'utf8');

        // Update in-memory cache
        this.cache.set(entry.key, entry);
      }
    } catch (error) {
      logger.error('Error updating cache entry:', error);
    }
  }

  /**
   * Ensure there's enough space in the cache
   * @private
   */
  async _ensureSpace(requiredSize) {
    if (this.currentSize + requiredSize <= this.config.maxSize) {
      return true; // Enough space available
    }

    logger.debug(
      `Cache full (${this._formatBytes(this.currentSize)}/${this._formatBytes(this.config.maxSize)}), cleaning up...`
    );

    // Sort entries by last accessed time (oldest first)
    const entries = Array.from(this.cache.values()).sort((a, b) => a.lastAccessed - b.lastAccessed);

    // Remove oldest entries until we have enough space
    for (const entry of entries) {
      if (this.currentSize + requiredSize <= this.config.maxSize) {
        break; // Enough space freed
      }

      await this._removeEntry(entry);
    }

    // If still not enough space, clear the cache
    if (this.currentSize + requiredSize > this.config.maxSize) {
      logger.warn('Cache still full after cleanup, clearing all entries');
      await this.clear();
    }

    return true;
  }

  /**
   * Clean up expired cache entries
   */
  async cleanup() {
    if (!this.isInitialized) return;

    logger.debug('Running cache cleanup...');

    try {
      const now = Date.now();
      const entries = Array.from(this.cache.values());
      let removed = 0;

      for (const entry of entries) {
        if (now > entry.expiresAt) {
          await this._removeEntry(entry);
          removed++;
        }
      }

      if (removed > 0) {
        logger.info(`Cleaned up ${removed} expired cache entries`);
      }

      // Also check total size
      await this._ensureSpace(0);
    } catch (error) {
      logger.error('Error during cache cleanup:', error);
    }
  }

  /**
   * Clear the entire cache
   */
  async clear() {
    try {
      const entries = Array.from(this.cache.values());

      for (const entry of entries) {
        await this._removeEntry(entry);
      }

      this.cache.clear();
      this.currentSize = 0;

      logger.info('Cache cleared');
      return true;
    } catch (error) {
      logger.error('Error clearing cache:', error);
      return false;
    }
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const entries = Array.from(this.cache.values());
    const now = Date.now();

    const stats = {
      totalEntries: entries.length,
      totalSize: this.currentSize,
      maxSize: this.config.maxSize,
      utilization: (this.currentSize / this.config.maxSize) * 100,
      expiredEntries: entries.filter((e) => now > e.expiresAt).length,
      byService: {},
      byLanguage: {},
    };

    // Group by service and language
    for (const entry of entries) {
      // By service
      if (!stats.byService[entry.service]) {
        stats.byService[entry.service] = { count: 0, size: 0 };
      }
      stats.byService[entry.service].count++;
      stats.byService[entry.service].size += entry.size || 0;

      // By language
      if (!stats.byLanguage[entry.language]) {
        stats.byLanguage[entry.language] = { count: 0, size: 0 };
      }
      stats.byLanguage[entry.language].count++;
      stats.byLanguage[entry.language].size += entry.size || 0;
    }

    return stats;
  }

  /**
   * Format bytes to human-readable string
   * @private
   */
  _formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];

    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }

  /**
   * Close the cache and clean up resources
   */
  async close() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }

    // Run a final cleanup
    await this.cleanup();

    this.isInitialized = false;
    logger.info('STT cache closed');
  }
}

module.exports = STTCache;
