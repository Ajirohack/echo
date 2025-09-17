/**
 * Echo Mobile App - Storage Utility
 * Handles local data persistence using AsyncStorage with encryption and caching
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import Logger from './Logger';

/**
 * Storage keys used throughout the app
 */
export const STORAGE_KEYS = {
  // User preferences
  USER_PREFERENCES: '@echo_user_preferences',
  LANGUAGE_SETTINGS: '@echo_language_settings',
  AUDIO_SETTINGS: '@echo_audio_settings',
  THEME_SETTINGS: '@echo_theme_settings',

  // App state
  APP_STATE: '@echo_app_state',
  LAST_SESSION: '@echo_last_session',

  // Audio data
  AUDIO_RECORDINGS: '@echo_audio_recordings',
  TRANSLATION_CACHE: '@echo_translation_cache',

  // RTC data
  RTC_SETTINGS: '@echo_rtc_settings',
  CONNECTION_HISTORY: '@echo_connection_history',

  // Cache
  API_CACHE: '@echo_api_cache',
  IMAGE_CACHE: '@echo_image_cache',

  // Security
  DEVICE_ID: '@echo_device_id',
  SESSION_TOKEN: '@echo_session_token',
};

/**
 * Storage utility class with caching and error handling
 */
class StorageManager {
  constructor() {
    this.logger = Logger;
    this.cache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
    this.initialized = false;
  }

  /**
   * Initialize the storage manager
   */
  async initialize() {
    if (this.initialized) return;

    try {
      // Test AsyncStorage availability
      await AsyncStorage.setItem('@echo_test', 'test');
      await AsyncStorage.removeItem('@echo_test');

      this.initialized = true;
      this.logger.info('StorageManager', 'Storage initialized successfully');
    } catch (error) {
      this.logger.error('StorageManager', 'Failed to initialize storage:', error);
      throw new Error('Storage not available');
    }
  }

  /**
   * Store data with optional expiration
   * @param {string} key - Storage key
   * @param {any} value - Value to store
   * @param {Object} options - Storage options
   * @returns {Promise<boolean>} Success status
   */
  async setItem(key, value, options = {}) {
    try {
      await this.initialize();

      const {
        encrypt = false,
        compress = false,
        expiresIn = null, // milliseconds
        cache = true,
      } = options;

      let dataToStore = {
        value,
        timestamp: Date.now(),
        platform: Platform.OS,
        version: '1.0.0',
      };

      // Add expiration if specified
      if (expiresIn) {
        dataToStore.expiresAt = Date.now() + expiresIn;
      }

      // Encrypt if requested (basic implementation)
      if (encrypt) {
        dataToStore = await this._encrypt(dataToStore);
      }

      // Compress if requested
      if (compress) {
        dataToStore = await this._compress(dataToStore);
      }

      const serialized = JSON.stringify(dataToStore);
      await AsyncStorage.setItem(key, serialized);

      // Update cache
      if (cache) {
        this.cache.set(key, {
          value,
          timestamp: Date.now(),
          expiresAt: dataToStore.expiresAt,
        });
      }

      this.logger.debug('StorageManager', `Stored item with key: ${key}`);
      return true;
    } catch (error) {
      this.logger.error('StorageManager', `Error storing item ${key}:`, error);
      return false;
    }
  }

  /**
   * Retrieve data from storage
   * @param {string} key - Storage key
   * @param {any} defaultValue - Default value if not found
   * @param {Object} options - Retrieval options
   * @returns {Promise<any>} Retrieved value or default
   */
  async getItem(key, defaultValue = null, options = {}) {
    try {
      await this.initialize();

      const {
        useCache = true,
        decrypt = false,
        decompress = false,
      } = options;

      // Check cache first
      if (useCache && this.cache.has(key)) {
        const cached = this.cache.get(key);
        const now = Date.now();

        // Check if cache is still valid
        if (now - cached.timestamp < this.cacheTimeout) {
          // Check expiration
          if (!cached.expiresAt || now < cached.expiresAt) {
            this.logger.debug('StorageManager', `Retrieved from cache: ${key}`);
            return cached.value;
          } else {
            // Expired, remove from cache and storage
            this.cache.delete(key);
            await this.removeItem(key);
            return defaultValue;
          }
        } else {
          // Cache expired, remove it
          this.cache.delete(key);
        }
      }

      const serialized = await AsyncStorage.getItem(key);
      if (serialized === null) {
        return defaultValue;
      }

      let data = JSON.parse(serialized);

      // Check expiration
      if (data.expiresAt && Date.now() > data.expiresAt) {
        await this.removeItem(key);
        return defaultValue;
      }

      // Decompress if needed
      if (decompress) {
        data = await this._decompress(data);
      }

      // Decrypt if needed
      if (decrypt) {
        data = await this._decrypt(data);
      }

      const value = data.value;

      // Update cache
      if (useCache) {
        this.cache.set(key, {
          value,
          timestamp: Date.now(),
          expiresAt: data.expiresAt,
        });
      }

      this.logger.debug('StorageManager', `Retrieved item with key: ${key}`);
      return value;
    } catch (error) {
      this.logger.error('StorageManager', `Error retrieving item ${key}:`, error);
      return defaultValue;
    }
  }

  /**
   * Remove item from storage
   * @param {string} key - Storage key
   * @returns {Promise<boolean>} Success status
   */
  async removeItem(key) {
    try {
      await this.initialize();

      await AsyncStorage.removeItem(key);
      this.cache.delete(key);

      this.logger.debug('StorageManager', `Removed item with key: ${key}`);
      return true;
    } catch (error) {
      this.logger.error('StorageManager', `Error removing item ${key}:`, error);
      return false;
    }
  }

  /**
   * Clear all storage data
   * @param {string[]} keysToKeep - Keys to preserve during clear
   * @returns {Promise<boolean>} Success status
   */
  async clear(keysToKeep = []) {
    try {
      await this.initialize();

      if (keysToKeep.length === 0) {
        await AsyncStorage.clear();
        this.cache.clear();
      } else {
        // Get all keys
        const allKeys = await AsyncStorage.getAllKeys();
        const keysToRemove = allKeys.filter(key => !keysToKeep.includes(key));

        if (keysToRemove.length > 0) {
          await AsyncStorage.multiRemove(keysToRemove);
          keysToRemove.forEach(key => this.cache.delete(key));
        }
      }

      this.logger.info('StorageManager', 'Storage cleared successfully');
      return true;
    } catch (error) {
      this.logger.error('StorageManager', 'Error clearing storage:', error);
      return false;
    }
  }

  /**
   * Get all keys in storage
   * @returns {Promise<string[]>} Array of keys
   */
  async getAllKeys() {
    try {
      await this.initialize();
      return await AsyncStorage.getAllKeys();
    } catch (error) {
      this.logger.error('StorageManager', 'Error getting all keys:', error);
      return [];
    }
  }

  /**
   * Get multiple items at once
   * @param {string[]} keys - Array of keys to retrieve
   * @returns {Promise<Object>} Object with key-value pairs
   */
  async getMultiple(keys) {
    try {
      await this.initialize();

      const result = {};
      const keyValuePairs = await AsyncStorage.multiGet(keys);

      keyValuePairs.forEach(([key, value]) => {
        if (value !== null) {
          try {
            const data = JSON.parse(value);
            // Check expiration
            if (!data.expiresAt || Date.now() < data.expiresAt) {
              result[key] = data.value;
            }
          } catch (error) {
            this.logger.warn('StorageManager', `Error parsing value for key ${key}:`, error);
          }
        }
      });

      return result;
    } catch (error) {
      this.logger.error('StorageManager', 'Error getting multiple items:', error);
      return {};
    }
  }

  /**
   * Set multiple items at once
   * @param {Object} keyValuePairs - Object with key-value pairs
   * @param {Object} options - Storage options
   * @returns {Promise<boolean>} Success status
   */
  async setMultiple(keyValuePairs, options = {}) {
    try {
      await this.initialize();

      const pairs = [];
      const now = Date.now();

      for (const [key, value] of Object.entries(keyValuePairs)) {
        let dataToStore = {
          value,
          timestamp: now,
          platform: Platform.OS,
          version: '1.0.0',
        };

        if (options.expiresIn) {
          dataToStore.expiresAt = now + options.expiresIn;
        }

        pairs.push([key, JSON.stringify(dataToStore)]);

        // Update cache
        if (options.cache !== false) {
          this.cache.set(key, {
            value,
            timestamp: now,
            expiresAt: dataToStore.expiresAt,
          });
        }
      }

      await AsyncStorage.multiSet(pairs);
      this.logger.debug('StorageManager', `Set ${pairs.length} items`);
      return true;
    } catch (error) {
      this.logger.error('StorageManager', 'Error setting multiple items:', error);
      return false;
    }
  }

  /**
   * Get storage usage information
   * @returns {Promise<Object>} Storage usage info
   */
  async getStorageInfo() {
    try {
      await this.initialize();

      const keys = await AsyncStorage.getAllKeys();
      const keyValuePairs = await AsyncStorage.multiGet(keys);

      let totalSize = 0;
      let itemCount = 0;
      let expiredCount = 0;
      const now = Date.now();

      keyValuePairs.forEach(([key, value]) => {
        if (value !== null) {
          totalSize += value.length;
          itemCount++;

          try {
            const data = JSON.parse(value);
            if (data.expiresAt && now > data.expiresAt) {
              expiredCount++;
            }
          } catch (error) {
            // Ignore parsing errors for size calculation
          }
        }
      });

      return {
        totalItems: itemCount,
        totalSize,
        expiredItems: expiredCount,
        cacheSize: this.cache.size,
        platform: Platform.OS,
      };
    } catch (error) {
      this.logger.error('StorageManager', 'Error getting storage info:', error);
      return {
        totalItems: 0,
        totalSize: 0,
        expiredItems: 0,
        cacheSize: this.cache.size,
        platform: Platform.OS,
      };
    }
  }

  /**
   * Clean up expired items
   * @returns {Promise<number>} Number of items cleaned up
   */
  async cleanupExpired() {
    try {
      await this.initialize();

      const keys = await AsyncStorage.getAllKeys();
      const keyValuePairs = await AsyncStorage.multiGet(keys);
      const now = Date.now();
      const expiredKeys = [];

      keyValuePairs.forEach(([key, value]) => {
        if (value !== null) {
          try {
            const data = JSON.parse(value);
            if (data.expiresAt && now > data.expiresAt) {
              expiredKeys.push(key);
            }
          } catch (error) {
            // If we can't parse it, consider it expired
            expiredKeys.push(key);
          }
        }
      });

      if (expiredKeys.length > 0) {
        await AsyncStorage.multiRemove(expiredKeys);
        expiredKeys.forEach(key => this.cache.delete(key));
      }

      this.logger.info('StorageManager', `Cleaned up ${expiredKeys.length} expired items`);
      return expiredKeys.length;
    } catch (error) {
      this.logger.error('StorageManager', 'Error cleaning up expired items:', error);
      return 0;
    }
  }

  /**
   * Clear memory cache
   */
  clearCache() {
    this.cache.clear();
    this.logger.debug('StorageManager', 'Memory cache cleared');
  }

  // Private helper methods

  /**
   * Basic encryption (for demonstration - use proper encryption in production)
   * @param {any} data - Data to encrypt
   * @returns {Promise<any>} Encrypted data
   */
  async _encrypt(data) {
    // This is a placeholder - implement proper encryption
    return {
      ...data,
      encrypted: true,
    };
  }

  /**
   * Basic decryption
   * @param {any} data - Data to decrypt
   * @returns {Promise<any>} Decrypted data
   */
  async _decrypt(data) {
    // This is a placeholder - implement proper decryption
    if (data.encrypted) {
      const { encrypted, ...decryptedData } = data;
      return decryptedData;
    }
    return data;
  }

  /**
   * Basic compression
   * @param {any} data - Data to compress
   * @returns {Promise<any>} Compressed data
   */
  async _compress(data) {
    // This is a placeholder - implement proper compression
    return {
      ...data,
      compressed: true,
    };
  }

  /**
   * Basic decompression
   * @param {any} data - Data to decompress
   * @returns {Promise<any>} Decompressed data
   */
  async _decompress(data) {
    // This is a placeholder - implement proper decompression
    if (data.compressed) {
      const { compressed, ...decompressedData } = data;
      return decompressedData;
    }
    return data;
  }
}

// Create singleton instance
const storageManager = new StorageManager();

// Export convenience functions
export const setStorageItem = (key, value, options) => storageManager.setItem(key, value, options);
export const getStorageItem = (key, defaultValue, options) => storageManager.getItem(key, defaultValue, options);
export const removeStorageItem = (key) => storageManager.removeItem(key);
export const clearStorage = (keysToKeep) => storageManager.clear(keysToKeep);
export const getStorageKeys = () => storageManager.getAllKeys();
export const getMultipleItems = (keys) => storageManager.getMultiple(keys);
export const setMultipleItems = (keyValuePairs, options) => storageManager.setMultiple(keyValuePairs, options);
export const getStorageInfo = () => storageManager.getStorageInfo();
export const cleanupExpiredItems = () => storageManager.cleanupExpired();
export const clearStorageCache = () => storageManager.clearCache();

// Export the manager instance
export default storageManager;