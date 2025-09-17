const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { EventEmitter } = require('events');
const logger = require('../utils/logger');

/**
 * SettingsManager handles loading, validating, and securely storing user settings
 * for the Echo translation application.
 */
class SettingsManager extends EventEmitter {
  constructor(configPath = null) {
    super();
    this.configPath = configPath || this._getDefaultConfigPath();
    this.encryptionKey = this._getOrCreateEncryptionKey();
    this.settings = this._loadSettings();
  }

  /**
   * Get the default configuration path
   * @private
   */
  _getDefaultConfigPath() {
    const configDir = path.join(process.cwd(), 'config');

    // Ensure config directory exists
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }

    return path.join(configDir, 'user-settings.json');
  }

  /**
   * Get or create encryption key for sensitive data
   * @private
   */
  _getOrCreateEncryptionKey() {
    const keyPath = path.join(path.dirname(this.configPath), '.settings-key');

    try {
      if (fs.existsSync(keyPath)) {
        return fs.readFileSync(keyPath, 'utf8');
      } else {
        const key = crypto.randomBytes(32).toString('hex');
        fs.writeFileSync(keyPath, key, { mode: 0o600 }); // Restrict file permissions
        return key;
      }
    } catch (error) {
      logger.error('Error handling encryption key:', error);
      // Fallback to a session-only key
      return crypto.randomBytes(32).toString('hex');
    }
  }

  /**
   * Encrypt sensitive data
   * @private
   */
  _encrypt(text) {
    try {
      const algorithm = 'aes-256-cbc';
      const key = Buffer.from(this.encryptionKey, 'hex');
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipher(algorithm, key);

      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      return iv.toString('hex') + ':' + encrypted;
    } catch (error) {
      logger.error('Encryption error:', error);
      return text; // Fallback to plain text
    }
  }

  /**
   * Decrypt sensitive data
   * @private
   */
  _decrypt(encryptedText) {
    try {
      if (!encryptedText.includes(':')) {
        return encryptedText; // Not encrypted
      }

      const algorithm = 'aes-256-cbc';
      const key = Buffer.from(this.encryptionKey, 'hex');
      const [ivHex, encrypted] = encryptedText.split(':');
      const iv = Buffer.from(ivHex, 'hex');
      const decipher = crypto.createDecipher(algorithm, key);

      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      logger.error('Decryption error:', error);
      return encryptedText; // Return as-is if decryption fails
    }
  }

  /**
   * Load settings from file or create default ones
   * @private
   */
  _loadSettings() {
    try {
      // If settings file exists, load it
      if (fs.existsSync(this.configPath)) {
        const fileContent = fs.readFileSync(this.configPath, 'utf-8');
        const settings = JSON.parse(fileContent);

        // Decrypt sensitive fields
        const decryptedSettings = this._decryptSensitiveFields(settings);

        // Override with environment variables if available
        const settingsWithEnv = this._loadFromEnvironment(decryptedSettings);

        // Validate and migrate settings if needed
        return this._validateAndMigrateSettings(settingsWithEnv);
      }

      // Create default settings if file doesn't exist
      const defaultSettings = this._getDefaultSettings();

      // Override with environment variables if available
      const settingsWithEnv = this._loadFromEnvironment(defaultSettings);

      this._saveSettings(settingsWithEnv);
      return settingsWithEnv;
    } catch (error) {
      logger.error('Error loading settings:', error);

      // Return default settings on error
      const defaultSettings = this._getDefaultSettings();

      // Still try to load from environment variables
      const settingsWithEnv = this._loadFromEnvironment(defaultSettings);

      this._saveSettings(settingsWithEnv);
      return settingsWithEnv;
    }
  }

  /**
   * Save settings to file
   * @private
   */
  _saveSettings(settings) {
    try {
      const configDir = path.dirname(this.configPath);

      // Ensure config directory exists
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }

      // Encrypt sensitive fields before saving
      const encryptedSettings = this._encryptSensitiveFields(settings);

      // Write settings file with pretty print
      fs.writeFileSync(this.configPath, JSON.stringify(encryptedSettings, null, 2), 'utf-8');

      return true;
    } catch (error) {
      logger.error('Error saving settings:', error);
      return false;
    }
  }

  /**
   * Get default settings
   * @private
   */
  _getDefaultSettings() {
    return {
      version: '1.0.0',
      audio: {
        inputDevice: 'default',
        outputDevice: 'default',
        sampleRate: 44100,
        channels: 1,
        noiseSuppressionEnabled: true,
        echoCancellationEnabled: true,
      },
      translation: {
        defaultService: 'google',
        sourceLanguage: 'auto',
        targetLanguage: 'en',
        autoDetectLanguage: true,
        confidenceThreshold: 0.7,
      },
      services: {
        google: {
          enabled: true,
          apiKey: '',
          model: 'default',
        },
        deepl: {
          enabled: false,
          apiKey: '',
          formality: 'default',
        },
        azure: {
          enabled: false,
          apiKey: '',
          region: 'eastus',
        },
        openai: {
          enabled: false,
          apiKey: '',
          model: 'gpt-3.5-turbo',
        },
      },
      ui: {
        theme: 'light',
        fontSize: 'medium',
        language: 'en',
        showNotifications: true,
        minimizeToTray: false,
      },
      privacy: {
        saveTranslationHistory: true,
        logLevel: 'info',
        shareUsageData: false,
        autoDeleteOldLogs: true,
      },
      performance: {
        enableCache: true,
        cacheSize: 100,
        maxConcurrentRequests: 3,
        requestTimeout: 30000,
      },
    };
  }

  /**
   * Encrypt sensitive fields in settings
   * @private
   */
  _encryptSensitiveFields(settings) {
    const sensitiveFields = [
      'services.google.apiKey',
      'services.deepl.apiKey',
      'services.azure.apiKey',
      'services.openai.apiKey',
    ];

    const encrypted = JSON.parse(JSON.stringify(settings)); // Deep clone

    sensitiveFields.forEach((fieldPath) => {
      const value = this._getNestedValue(encrypted, fieldPath);
      if (value && typeof value === 'string' && value.trim() !== '') {
        this._setNestedValue(encrypted, fieldPath, this._encrypt(value));
      }
    });

    return encrypted;
  }

  /**
   * Decrypt sensitive fields in settings
   * @private
   */
  _decryptSensitiveFields(settings) {
    const sensitiveFields = [
      'services.google.apiKey',
      'services.deepl.apiKey',
      'services.azure.apiKey',
      'services.openai.apiKey',
    ];

    const decrypted = JSON.parse(JSON.stringify(settings)); // Deep clone

    sensitiveFields.forEach((fieldPath) => {
      const value = this._getNestedValue(decrypted, fieldPath);
      if (value && typeof value === 'string' && value.includes(':')) {
        this._setNestedValue(decrypted, fieldPath, this._decrypt(value));
      }
    });

    return decrypted;
  }

  /**
   * Get nested object value by dot notation path
   * @private
   */
  _getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => current && current[key], obj);
  }

  /**
   * Set nested object value by dot notation path
   * @private
   */
  _setNestedValue(obj, path, value) {
    const keys = path.split('.');
    const lastKey = keys.pop();
    const target = keys.reduce((current, key) => {
      if (!current[key]) current[key] = {};
      return current[key];
    }, obj);
    target[lastKey] = value;
  }

  /**
   * Validate and migrate settings if needed
   * @private
   */
  _validateAndMigrateSettings(settings) {
    if (!settings) {
      return this._getDefaultSettings();
    }

    const defaultSettings = this._getDefaultSettings();

    // Migrate from older versions if needed
    if (!settings.version) {
      settings = this._migrateToV1(settings);
    }

    // Deep merge with defaults to ensure all properties exist
    const merged = this._deepMerge(defaultSettings, settings);

    // Save the migrated settings
    if (merged.version !== defaultSettings.version) {
      merged.version = defaultSettings.version;
      this._saveSettings(merged);
    }

    return merged;
  }

  /**
   * Deep merge two objects
   * @private
   */
  _deepMerge(target, source) {
    const result = { ...target };

    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = this._deepMerge(target[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }

    return result;
  }

  /**
   * Migrate settings from version < 1.0.0 to 1.0.0
   * @private
   */
  _migrateToV1(oldSettings) {
    const newSettings = this._getDefaultSettings();

    // Map old settings to new structure
    if (oldSettings.inputDevice) {
      newSettings.audio.inputDevice = oldSettings.inputDevice;
    }
    if (oldSettings.outputDevice) {
      newSettings.audio.outputDevice = oldSettings.outputDevice;
    }
    if (oldSettings.translationService) {
      newSettings.translation.defaultService = oldSettings.translationService;
    }
    if (oldSettings.googleApiKey) {
      newSettings.services.google.apiKey = oldSettings.googleApiKey;
    }
    if (oldSettings.deeplApiKey) {
      newSettings.services.deepl.apiKey = oldSettings.deeplApiKey;
    }
    if (oldSettings.azureKey) {
      newSettings.services.azure.apiKey = oldSettings.azureKey;
    }
    if (oldSettings.azureRegion) {
      newSettings.services.azure.region = oldSettings.azureRegion;
    }

    return newSettings;
  }

  /**
   * Get all settings
   * @returns {Object} Current settings
   */
  getSettings() {
    return JSON.parse(JSON.stringify(this.settings)); // Return deep copy
  }

  /**
   * Get a specific setting by path
   * @param {string} path - Dot notation path (e.g., 'audio.inputDevice')
   * @returns {*} Setting value
   */
  getSetting(path) {
    return this._getNestedValue(this.settings, path);
  }

  /**
   * Update settings
   * @param {Object} updates - Settings updates to apply
   * @returns {boolean} Success status
   */
  updateSettings(updates) {
    try {
      // Create a deep merge of current settings and updates
      const newSettings = this._deepMerge(this.settings, updates);

      // Validate the new settings
      const validatedSettings = this._validateAndMigrateSettings(newSettings);

      // Save the updated settings
      const saved = this._saveSettings(validatedSettings);

      if (saved) {
        const oldSettings = this.settings;
        this.settings = validatedSettings;

        // Emit settings changed event
        this.emit('settingsChanged', {
          oldSettings,
          newSettings: validatedSettings,
          updates,
        });

        logger.info('Settings updated successfully');
        return true;
      }

      return false;
    } catch (error) {
      logger.error('Error updating settings:', error);
      return false;
    }
  }

  /**
   * Update a specific setting by path
   * @param {string} path - Dot notation path
   * @param {*} value - New value
   * @returns {boolean} Success status
   */
  updateSetting(path, value) {
    const updates = {};
    this._setNestedValue(updates, path, value);
    return this.updateSettings(updates);
  }

  /**
   * Reset settings to defaults
   * @returns {boolean} Success status
   */
  resetSettings() {
    try {
      const defaultSettings = this._getDefaultSettings();
      const saved = this._saveSettings(defaultSettings);

      if (saved) {
        const oldSettings = this.settings;
        this.settings = defaultSettings;

        this.emit('settingsReset', {
          oldSettings,
          newSettings: defaultSettings,
        });

        logger.info('Settings reset to defaults');
        return true;
      }

      return false;
    } catch (error) {
      logger.error('Error resetting settings:', error);
      return false;
    }
  }

  /**
   * Export settings (without sensitive data)
   * @returns {Object} Exportable settings
   */
  exportSettings() {
    const settings = this.getSettings();

    // Remove sensitive data
    const exportable = JSON.parse(JSON.stringify(settings));

    // Clear API keys
    if (exportable.services) {
      Object.keys(exportable.services).forEach((service) => {
        if (exportable.services[service].apiKey) {
          exportable.services[service].apiKey = '';
        }
      });
    }

    return exportable;
  }

  /**
   * Import settings (merge with current settings)
   * @param {Object} importedSettings - Settings to import
   * @returns {boolean} Success status
   */
  importSettings(importedSettings) {
    try {
      // Validate imported settings
      const validated = this._validateAndMigrateSettings(importedSettings);

      // Merge with current settings (preserving API keys if not provided)
      const merged = this._deepMerge(this.settings, validated);

      return this.updateSettings(merged);
    } catch (error) {
      logger.error('Error importing settings:', error);
      return false;
    }
  }

  /**
   * Load settings from environment variables
   * @param {Object} settings - Current settings to override
   * @returns {Object} Settings with environment variable overrides
   * @private
   */
  _loadFromEnvironment(settings) {
    const result = JSON.parse(JSON.stringify(settings)); // Deep clone

    // Map of environment variables to settings paths
    const envMappings = {
      // API Keys
      DEEPL_API_KEY: 'services.deepl.apiKey',
      GOOGLE_TRANSLATE_API_KEY: 'services.google.apiKey',
      AZURE_TRANSLATOR_API_KEY: 'services.azure.apiKey',
      OPENAI_API_KEY: 'services.openai.apiKey',
      ELEVENLABS_API_KEY: 'services.elevenlabs.apiKey',

      // Service configurations
      AZURE_REGION: 'services.azure.region',
      OPENAI_MODEL: 'services.openai.model',

      // Translation settings
      DEFAULT_SOURCE_LANGUAGE: 'translation.sourceLanguage',
      DEFAULT_TARGET_LANGUAGE: 'translation.targetLanguage',
      DEFAULT_TRANSLATION_SERVICE: 'translation.defaultService',
      TRANSLATION_CONFIDENCE_THRESHOLD: 'translation.confidenceThreshold',

      // Audio settings
      AUDIO_SAMPLE_RATE: 'audio.sampleRate',
      AUDIO_CHANNELS: 'audio.channels',

      // Performance settings
      ENABLE_CACHE: 'performance.enableCache',
      CACHE_SIZE: 'performance.cacheSize',
      REQUEST_TIMEOUT: 'performance.requestTimeout',
      MAX_CONCURRENT_REQUESTS: 'performance.maxConcurrentRequests',

      // Privacy settings
      LOG_LEVEL: 'privacy.logLevel',
      SAVE_TRANSLATION_HISTORY: 'privacy.saveTranslationHistory',
      SHARE_USAGE_DATA: 'privacy.shareUsageData',
    };

    // Apply environment variables to settings
    Object.entries(envMappings).forEach(([envVar, settingPath]) => {
      const value = process.env[envVar];
      if (value !== undefined) {
        // Convert value to appropriate type based on existing setting
        const currentValue = this._getNestedValue(result, settingPath);
        let typedValue = value;

        if (typeof currentValue === 'number') {
          typedValue = Number(value);
        } else if (typeof currentValue === 'boolean') {
          typedValue = value.toLowerCase() === 'true';
        }

        // Set the value in settings
        this._setNestedValue(result, settingPath, typedValue);
        logger.debug(`Loaded setting from environment: ${settingPath}`);
      }
    });

    // Enable services that have API keys
    if (result.services) {
      Object.keys(result.services).forEach((service) => {
        if (result.services[service].apiKey && result.services[service].apiKey.trim() !== '') {
          result.services[service].enabled = true;
        }
      });
    }

    return result;
  }
}

module.exports = SettingsManager;
