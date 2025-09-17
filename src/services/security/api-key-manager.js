/**
 * API Key Manager
 * Manages secure storage, retrieval, and validation of API keys
 * for various translation services.
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

class ApiKeyManager {
  constructor(config = {}) {
    this.config = {
      storagePath: config.storagePath || path.join(process.cwd(), 'config', 'api-keys.json'),
      encryptionKey: this._getSecureEncryptionKey(config.encryptionKey),
      keyValidationPatterns: {
        azure: /^[a-zA-Z0-9]{32}$/,
        google: /^[A-Za-z0-9_-]{39}$/,
        deepl: /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/,
        openai: /^sk-[a-zA-Z0-9]{48,}$/,
        elevenlabs: /^[a-f0-9]{32}$/,
        microsoft: /^[a-zA-Z0-9]{32}$/,
      },
    };

    this.storedKeys = {};
    this.loadStoredKeys();
  }

  /**
   * Get secure encryption key from environment or generate one
   * @private
   */
  _getSecureEncryptionKey(providedKey) {
    // Priority: provided key > environment variable > generated key
    if (providedKey && providedKey.length >= 32) {
      return providedKey;
    }

    if (process.env.ENCRYPTION_KEY && process.env.ENCRYPTION_KEY.length >= 32) {
      return process.env.ENCRYPTION_KEY;
    }

    // Generate a secure key if none provided
    const generatedKey = crypto.randomBytes(32).toString('hex');
    console.warn(
      'WARNING: Using generated encryption key. Set ENCRYPTION_KEY environment variable for production.'
    );
    return generatedKey;
  }

  /**
   * Encrypt API key before storage
   *
   * @param {string} apiKey - Plain text API key
   * @returns {string} - Encrypted API key
   */
  encryptApiKey(apiKey) {
    const algorithm = 'aes-256-cbc';
    const key = crypto.scryptSync(this.config.encryptionKey, 'salt', 32);
    const iv = crypto.randomBytes(16);

    const cipher = crypto.createCipher(algorithm, key);
    let encrypted = cipher.update(apiKey, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    return iv.toString('hex') + ':' + encrypted;
  }

  /**
   * Decrypt API key after retrieval
   *
   * @param {string} encryptedKey - Encrypted API key
   * @returns {string} - Plain text API key
   */
  decryptApiKey(encryptedKey) {
    try {
      const algorithm = 'aes-256-cbc';
      const key = crypto.scryptSync(this.config.encryptionKey, 'salt', 32);

      const parts = encryptedKey.split(':');
      const iv = Buffer.from(parts[0], 'hex');
      const encrypted = parts[1];

      const decipher = crypto.createDecipher(algorithm, key);
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      throw new Error('Failed to decrypt API key');
    }
  }

  /**
   * Store API key securely
   *
   * @param {string} service - Service name (azure, google, deepl, etc.)
   * @param {string} apiKey - API key to store
   * @returns {boolean} - Success status
   */
  storeApiKey(service, apiKey) {
    try {
      // Validate API key format
      if (!this.isValidApiKeyFormat(service, apiKey)) {
        throw new Error(`Invalid API key format for ${service}`);
      }

      // Encrypt the API key
      const encryptedKey = this.encryptApiKey(apiKey);

      // Store in memory
      this.storedKeys[service] = {
        encrypted: encryptedKey,
        storedAt: Date.now(),
        lastUsed: null,
      };

      // Save to disk
      this.saveStoredKeys();

      return true;
    } catch (error) {
      console.error(`Failed to store API key for ${service}:`, error.message);
      return false;
    }
  }

  /**
   * Retrieve API key
   *
   * @param {string} service - Service name
   * @returns {string|null} - Decrypted API key or null if not found
   */
  getApiKey(service) {
    try {
      const storedKey = this.storedKeys[service];

      if (!storedKey) {
        return null;
      }

      // Update last used timestamp
      storedKey.lastUsed = Date.now();

      // Decrypt and return the API key
      return this.decryptApiKey(storedKey.encrypted);
    } catch (error) {
      console.error(`Failed to retrieve API key for ${service}:`, error.message);
      return null;
    }
  }

  /**
   * Check if API key exists for a service
   *
   * @param {string} service - Service name
   * @returns {boolean} - Whether API key exists
   */
  hasApiKey(service) {
    return !!this.storedKeys[service];
  }

  /**
   * Validate API key format
   *
   * @param {string} service - Service name
   * @param {string} apiKey - API key to validate
   * @returns {boolean} - Whether API key format is valid
   */
  isValidApiKeyFormat(service, apiKey) {
    if (!apiKey || typeof apiKey !== 'string') {
      return false;
    }

    const pattern = this.config.keyValidationPatterns[service];
    if (!pattern) {
      // If no pattern is defined, accept any non-empty string
      return apiKey.length > 0;
    }

    return pattern.test(apiKey);
  }

  /**
   * Check if API key might be compromised
   *
   * @param {string} service - Service name
   * @param {string} apiKey - API key to check
   * @returns {boolean} - Whether API key might be compromised
   */
  isCompromisedApiKey(service, apiKey) {
    // Check for common compromised patterns
    const compromisedPatterns = [
      /^sk-test/, // Test keys
      /^test/, // Test keys
      /^demo/, // Demo keys
      /^example/, // Example keys
      /^placeholder/, // Placeholder keys
      /^[a]{32}$/, // Repeated characters
      /^[0]{32}$/, // All zeros
      /^[1]{32}$/, // All ones
    ];

    return compromisedPatterns.some((pattern) => pattern.test(apiKey));
  }

  /**
   * Rotate API key for a service
   *
   * @param {string} service - Service name
   * @param {string} newApiKey - New API key
   * @returns {boolean} - Success status
   */
  rotateApiKey(service, newApiKey) {
    try {
      // Validate new API key
      if (!this.isValidApiKeyFormat(service, newApiKey)) {
        throw new Error(`Invalid API key format for ${service}`);
      }

      // Store the new key
      const success = this.storeApiKey(service, newApiKey);

      if (success) {
        console.log(`Successfully rotated API key for ${service}`);
      }

      return success;
    } catch (error) {
      console.error(`Failed to rotate API key for ${service}:`, error.message);
      return false;
    }
  }

  /**
   * Remove API key for a service
   *
   * @param {string} service - Service name
   * @returns {boolean} - Success status
   */
  removeApiKey(service) {
    try {
      delete this.storedKeys[service];
      this.saveStoredKeys();
      return true;
    } catch (error) {
      console.error(`Failed to remove API key for ${service}:`, error.message);
      return false;
    }
  }

  /**
   * Get list of services with stored API keys
   *
   * @returns {string[]} - Array of service names
   */
  getStoredServices() {
    return Object.keys(this.storedKeys);
  }

  /**
   * Load stored keys from disk
   */
  loadStoredKeys() {
    try {
      if (fs.existsSync(this.config.storagePath)) {
        const data = fs.readFileSync(this.config.storagePath, 'utf8');
        this.storedKeys = JSON.parse(data);
      }
    } catch (error) {
      console.error('Failed to load stored API keys:', error.message);
      this.storedKeys = {};
    }
  }

  /**
   * Save stored keys to disk
   */
  saveStoredKeys() {
    try {
      // Ensure directory exists
      const dir = path.dirname(this.config.storagePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(this.config.storagePath, JSON.stringify(this.storedKeys, null, 2), 'utf8');
    } catch (error) {
      console.error('Failed to save API keys:', error.message);
    }
  }

  /**
   * Clear all stored API keys
   */
  clearAllKeys() {
    this.storedKeys = {};
    this.saveStoredKeys();
  }
}

module.exports = ApiKeyManager;
