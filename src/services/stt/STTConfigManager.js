const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const logger = require('../../utils/logger');

/**
 * STTConfigManager handles loading, validating, and managing configurations
 * for all STT services.
 */
class STTConfigManager {
  constructor(configPath = null) {
    this.configPath = configPath || this._getDefaultConfigPath();
    this.config = this._loadConfig();
    this.defaultServices = ['whisper', 'azure', 'google', 'gpt4o'];
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

    return path.join(configDir, 'stt-config.json');
  }

  /**
   * Load configuration from file or create a default one
   * @private
   */
  _loadConfig() {
    try {
      // If config file exists, load it
      if (fs.existsSync(this.configPath)) {
        const fileContent = fs.readFileSync(this.configPath, 'utf-8');
        const config = JSON.parse(fileContent);

        // Validate and migrate config if needed
        return this._validateAndMigrateConfig(config);
      }

      // Create default config if it doesn't exist
      const defaultConfig = this._getDefaultConfig();
      this._saveConfig(defaultConfig);
      return defaultConfig;
    } catch (error) {
      logger.error('Error loading STT config:', error);

      // Return default config on error
      const defaultConfig = this._getDefaultConfig();
      this._saveConfig(defaultConfig);
      return defaultConfig;
    }
  }

  /**
   * Save configuration to file
   * @private
   */
  _saveConfig(config) {
    try {
      const configDir = path.dirname(this.configPath);

      // Ensure config directory exists
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }

      // Write config file with pretty print
      fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2), 'utf-8');

      return true;
    } catch (error) {
      logger.error('Error saving STT config:', error);
      return false;
    }
  }

  /**
   * Get default configuration
   * @private
   */
  _getDefaultConfig() {
    return {
      version: '1.0.0',
      defaultService: 'whisper',
      fallbackOrder: ['whisper', 'azure', 'google', 'gpt4o'],
      autoDetectLanguage: true,
      defaultLanguage: 'en-US',
      confidenceThreshold: 0.7,
      maxRetries: 3,
      services: {
        whisper: {
          enabled: true,
          useLocal: false,
          localModel: 'base',
          localModelPath: null,
          apiKey: process.env.OPENAI_API_KEY || '',
          model: 'whisper-1',
          temperature: 0,
          responseFormat: 'json',
          timeout: 30000,
        },
        azure: {
          enabled: false,
          apiKey: process.env.AZURE_SPEECH_KEY || '',
          region: 'eastus',
          language: 'en-US',
          profanity: 'Masked',
          speechRecognitionMode: 'conversation',
          endpointId: null,
        },
        google: {
          enabled: false,
          credentials: process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON
            ? JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON)
            : null,
          keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS || '',
          projectId: process.env.GOOGLE_CLOUD_PROJECT || '',
          languageCode: 'en-US',
          model: 'default',
          useEnhanced: true,
          enableAutomaticPunctuation: true,
        },
        gpt4o: {
          enabled: false,
          apiKey: process.env.OPENAI_API_KEY || '',
          model: 'gpt-4o',
          temperature: 0,
          responseFormat: 'text',
          timeout: 30000,
        },
      },
      audio: {
        sampleRate: 16000,
        channels: 1,
        bitDepth: 16,
        format: 'wav',
        codec: 'pcm_s16le',
        silenceThreshold: -50,
        silenceDuration: 0.5,
      },
      cache: {
        enabled: true,
        ttl: 86400, // 24 hours in seconds
        maxSize: 1073741824, // 1GB in bytes
      },
      logging: {
        level: 'info',
        maxFiles: 10,
        maxSize: 10485760, // 10MB
      },
      advanced: {
        enableProfiling: false,
        enableDebugLogs: false,
        enablePerformanceMetrics: true,
      },
    };
  }

  /**
   * Validate and migrate configuration if needed
   * @private
   */
  _validateAndMigrateConfig(config) {
    if (!config) {
      return this._getDefaultConfig();
    }

    const defaultConfig = this._getDefaultConfig();

    // Migrate from older versions if needed
    if (!config.version) {
      // Migration from version < 1.0.0
      config = this._migrateToV1(config);
    }

    // Ensure all top-level properties exist
    for (const [key, value] of Object.entries(defaultConfig)) {
      if (config[key] === undefined) {
        config[key] = value;
      }
    }

    // Ensure all services exist and have required properties
    for (const service of Object.keys(defaultConfig.services)) {
      if (!config.services[service]) {
        config.services[service] = defaultConfig.services[service];
      } else {
        // Ensure all service properties exist
        for (const [key, value] of Object.entries(defaultConfig.services[service])) {
          if (config.services[service][key] === undefined) {
            config.services[service][key] = value;
          }
        }
      }
    }

    // Save the migrated config
    if (config.version !== defaultConfig.version) {
      config.version = defaultConfig.version;
      this._saveConfig(config);
    }

    return config;
  }

  /**
   * Migrate config from version < 1.0.0 to 1.0.0
   * @private
   */
  _migrateToV1(oldConfig) {
    const newConfig = this._getDefaultConfig();

    // Simple property migration
    const propertyMap = {
      defaultService: 'defaultService',
      autoDetectLanguage: 'autoDetectLanguage',
      defaultLanguage: 'defaultLanguage',
      confidenceThreshold: 'confidenceThreshold',
      maxRetries: 'maxRetries',
    };

    for (const [oldKey, newKey] of Object.entries(propertyMap)) {
      if (oldConfig[oldKey] !== undefined) {
        newConfig[newKey] = oldConfig[oldKey];
      }
    }

    // Service configurations
    if (oldConfig.services) {
      for (const [service, serviceConfig] of Object.entries(oldConfig.services)) {
        if (newConfig.services[service] && serviceConfig) {
          newConfig.services[service] = {
            ...newConfig.services[service],
            ...serviceConfig,
          };
        }
      }
    }

    // Audio settings
    if (oldConfig.audio) {
      newConfig.audio = {
        ...newConfig.audio,
        ...oldConfig.audio,
      };
    }

    return newConfig;
  }

  /**
   * Get the current configuration
   * @returns {Object} The current configuration
   */
  getConfig() {
    return JSON.parse(JSON.stringify(this.config)); // Return a deep copy
  }

  /**
   * Update the configuration
   * @param {Object} updates - Configuration updates to apply
   * @returns {boolean} True if the update was successful
   */
  updateConfig(updates) {
    try {
      // Create a deep merge of the current config and updates
      const newConfig = this._deepMerge(this.config, updates);

      // Validate the new config
      const validatedConfig = this._validateAndMigrateConfig(newConfig);

      // Save the updated config
      this.config = validatedConfig;
      this._saveConfig(validatedConfig);

      return true;
    } catch (error) {
      logger.error('Error updating STT config:', error);
      return false;
    }
  }

  /**
   * Get configuration for a specific service
   * @param {string} serviceName - Name of the service (whisper, azure, google, gpt4o)
   * @returns {Object} Service configuration
   */
  getServiceConfig(serviceName) {
    if (!this.config.services[serviceName]) {
      throw new Error(`Unknown service: ${serviceName}`);
    }

    return { ...this.config.services[serviceName] }; // Return a copy
  }

  /**
   * Update configuration for a specific service
   * @param {string} serviceName - Name of the service
   * @param {Object} updates - Configuration updates
   * @returns {boolean} True if the update was successful
   */
  updateServiceConfig(serviceName, updates) {
    if (!this.config.services[serviceName]) {
      throw new Error(`Unknown service: ${serviceName}`);
    }

    return this.updateConfig({
      services: {
        [serviceName]: {
          ...this.config.services[serviceName],
          ...updates,
        },
      },
    });
  }

  /**
   * Get the list of enabled services in the configured fallback order
   * @returns {Array} List of enabled service names in fallback order
   */
  getEnabledServices() {
    const { services, fallbackOrder } = this.config;
    return fallbackOrder.filter(
      (service) => services[service] && services[service].enabled !== false
    );
  }

  /**
   * Helper function for deep merging objects
   * @private
   */
  _deepMerge(target, source) {
    const output = { ...target };

    if (this._isObject(target) && this._isObject(source)) {
      Object.keys(source).forEach((key) => {
        if (this._isObject(source[key])) {
          if (!(key in target)) {
            Object.assign(output, { [key]: source[key] });
          } else {
            output[key] = this._deepMerge(target[key], source[key]);
          }
        } else {
          Object.assign(output, { [key]: source[key] });
        }
      });
    }

    return output;
  }

  /**
   * Check if a value is an object
   * @private
   */
  _isObject(item) {
    return item && typeof item === 'object' && !Array.isArray(item);
  }
}

module.exports = STTConfigManager;
