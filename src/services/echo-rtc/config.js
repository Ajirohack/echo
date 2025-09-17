/**
 * Echo RTC Configuration
 * Configuration management for Echo RTC service
 */

const path = require('path');
const fs = require('fs');
const { logger } = require('../../utils/logger');

class EchoRTCConfig {
  constructor() {
    this.configPath = path.join(__dirname, 'echo-rtc.config.json');
    this.defaultConfig = this.getDefaultConfig();
    this.config = null;

    this.loadConfig();
  }

  /**
   * Get default configuration
   * @private
   * @returns {Object} Default configuration
   */
  getDefaultConfig() {
    return {
      // Server configuration
      server: {
        url: process.env.ECHO_RTC_SERVER_URL || 'wss://echo-rtc.whytehoux.ai',
        apiKey: process.env.ECHO_RTC_API_KEY || '',
        apiSecret: process.env.ECHO_RTC_API_SECRET || '',
        timeout: 30000,
        reconnectAttempts: 5,
        reconnectDelay: 2000,
        heartbeatInterval: 30000,
      },

      // WebRTC configuration
      rtc: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' },
          {
            urls: 'turn:turn.whytehoux.ai:3478',
            username: process.env.TURN_USERNAME || 'echo-user',
            credential: process.env.TURN_PASSWORD || 'echo-pass',
          },
        ],
        sdpSemantics: 'unified-plan',
        bundlePolicy: 'balanced',
        rtcpMuxPolicy: 'require',
        iceCandidatePoolSize: 10,
        iceTransportPolicy: 'all',
      },

      // Audio configuration
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        sampleRate: 16000,
        channelCount: 1,
        bitrate: 64000,
        codec: 'opus',
        dtx: true, // Discontinuous transmission
        fec: true, // Forward error correction
      },

      // Room defaults
      room: {
        maxParticipants: 10,
        defaultLanguage: 'en',
        autoRecord: false,
        recordingFormat: 'webm',
        maxDuration: 120, // minutes
        inactivityTimeout: 30, // minutes
        allowAnonymous: true,
        requirePassword: false,
      },

      // Translation configuration
      translation: {
        enabled: true,
        realTime: true,
        provider: 'azure', // 'azure', 'google', 'openai'
        sourceLanguage: 'auto',
        targetLanguages: ['en', 'es', 'fr', 'de', 'zh', 'ja'],
        confidence: 0.7,
        maxRetries: 3,
        timeout: 5000,
      },

      // Security configuration
      security: {
        enableEncryption: true,
        encryptionAlgorithm: 'AES-256-GCM',
        tokenExpiration: 3600, // seconds
        rateLimiting: {
          enabled: true,
          maxRequests: 100,
          windowMs: 60000, // 1 minute
        },
        allowedOrigins: ['http://localhost:3000', 'https://echo.whytehoux.ai'],
      },

      // Performance configuration
      performance: {
        maxConcurrentRooms: 100,
        maxConcurrentConnections: 1000,
        connectionPoolSize: 50,
        bufferSize: 4096,
        compressionEnabled: true,
        compressionLevel: 6,
      },

      // Logging configuration
      logging: {
        level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
        enableMetrics: true,
        metricsInterval: 60000, // 1 minute
        enableAuditLog: true,
        auditLogPath: './logs/echo-rtc-audit.log',
      },

      // Development configuration
      development: {
        enableDebugMode: process.env.NODE_ENV !== 'production',
        mockMode: false,
        simulateLatency: false,
        latencyMs: 100,
        enableTestEndpoints: process.env.NODE_ENV !== 'production',
      },

      // Feature flags
      features: {
        enableScreenShare: false,
        enableFileTransfer: false,
        enableWhiteboard: false,
        enableRecording: true,
        enableTranscription: true,
        enableSentimentAnalysis: false,
        enableLanguageDetection: true,
      },
    };
  }

  /**
   * Load configuration from file or use defaults
   * @private
   */
  loadConfig() {
    try {
      if (fs.existsSync(this.configPath)) {
        const fileConfig = JSON.parse(fs.readFileSync(this.configPath, 'utf8'));
        this.config = this.mergeConfig(this.defaultConfig, fileConfig);
        logger.info('Echo RTC configuration loaded from file');
      } else {
        this.config = { ...this.defaultConfig };
        logger.info('Using default Echo RTC configuration');
      }
    } catch (error) {
      logger.error('Failed to load Echo RTC configuration:', error);
      this.config = { ...this.defaultConfig };
    }
  }

  /**
   * Merge configuration objects recursively
   * @private
   * @param {Object} defaultConfig - Default configuration
   * @param {Object} userConfig - User configuration
   * @returns {Object} Merged configuration
   */
  mergeConfig(defaultConfig, userConfig) {
    const merged = { ...defaultConfig };

    for (const key in userConfig) {
      if (userConfig.hasOwnProperty(key)) {
        if (
          typeof userConfig[key] === 'object' &&
          userConfig[key] !== null &&
          !Array.isArray(userConfig[key])
        ) {
          merged[key] = this.mergeConfig(defaultConfig[key] || {}, userConfig[key]);
        } else {
          merged[key] = userConfig[key];
        }
      }
    }

    return merged;
  }

  /**
   * Save configuration to file
   * @param {Object} config - Configuration to save
   * @returns {Promise<void>}
   */
  async saveConfig(config = null) {
    try {
      const configToSave = config || this.config;
      await fs.promises.writeFile(this.configPath, JSON.stringify(configToSave, null, 2));
      logger.info('Echo RTC configuration saved to file');
    } catch (error) {
      logger.error('Failed to save Echo RTC configuration:', error);
      throw error;
    }
  }

  /**
   * Get configuration value
   * @param {string} path - Configuration path (e.g., 'server.url')
   * @param {*} defaultValue - Default value if path not found
   * @returns {*} Configuration value
   */
  get(path, defaultValue = null) {
    const keys = path.split('.');
    let current = this.config;

    for (const key of keys) {
      if (current && typeof current === 'object' && key in current) {
        current = current[key];
      } else {
        return defaultValue;
      }
    }

    return current;
  }

  /**
   * Set configuration value
   * @param {string} path - Configuration path (e.g., 'server.url')
   * @param {*} value - Value to set
   */
  set(path, value) {
    const keys = path.split('.');
    let current = this.config;

    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!(key in current) || typeof current[key] !== 'object') {
        current[key] = {};
      }
      current = current[key];
    }

    current[keys[keys.length - 1]] = value;
  }

  /**
   * Update configuration
   * @param {Object} updates - Configuration updates
   * @param {boolean} save - Whether to save to file
   * @returns {Promise<void>}
   */
  async update(updates, save = true) {
    try {
      this.config = this.mergeConfig(this.config, updates);

      if (save) {
        await this.saveConfig();
      }

      logger.info('Echo RTC configuration updated');
    } catch (error) {
      logger.error('Failed to update Echo RTC configuration:', error);
      throw error;
    }
  }

  /**
   * Reset configuration to defaults
   * @param {boolean} save - Whether to save to file
   * @returns {Promise<void>}
   */
  async reset(save = true) {
    try {
      this.config = { ...this.defaultConfig };

      if (save) {
        await this.saveConfig();
      }

      logger.info('Echo RTC configuration reset to defaults');
    } catch (error) {
      logger.error('Failed to reset Echo RTC configuration:', error);
      throw error;
    }
  }

  /**
   * Validate configuration
   * @returns {Object} Validation result
   */
  validate() {
    const errors = [];
    const warnings = [];

    // Validate server configuration
    if (!this.config.server.url) {
      errors.push('Server URL is required');
    }

    if (!this.config.server.apiKey) {
      warnings.push('API key is not set');
    }

    if (!this.config.server.apiSecret) {
      warnings.push('API secret is not set');
    }

    // Validate WebRTC configuration
    if (!Array.isArray(this.config.rtc.iceServers) || this.config.rtc.iceServers.length === 0) {
      errors.push('At least one ICE server is required');
    }

    // Validate audio configuration
    if (this.config.audio.sampleRate < 8000 || this.config.audio.sampleRate > 48000) {
      warnings.push('Audio sample rate should be between 8000 and 48000 Hz');
    }

    // Validate room configuration
    if (this.config.room.maxParticipants < 1 || this.config.room.maxParticipants > 100) {
      warnings.push('Max participants should be between 1 and 100');
    }

    // Validate translation configuration
    if (this.config.translation.enabled && !this.config.translation.provider) {
      errors.push('Translation provider is required when translation is enabled');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Get environment-specific configuration
   * @param {string} environment - Environment name
   * @returns {Object} Environment configuration
   */
  getEnvironmentConfig(environment = process.env.NODE_ENV || 'development') {
    const envConfig = { ...this.config };

    switch (environment) {
      case 'production':
        envConfig.logging.level = 'info';
        envConfig.development.enableDebugMode = false;
        envConfig.development.enableTestEndpoints = false;
        envConfig.security.rateLimiting.enabled = true;
        break;

      case 'staging':
        envConfig.logging.level = 'debug';
        envConfig.development.enableDebugMode = true;
        envConfig.development.enableTestEndpoints = true;
        envConfig.security.rateLimiting.maxRequests = 200;
        break;

      case 'development':
        envConfig.logging.level = 'debug';
        envConfig.development.enableDebugMode = true;
        envConfig.development.enableTestEndpoints = true;
        envConfig.security.rateLimiting.enabled = false;
        envConfig.server.url = 'ws://localhost:8080';
        break;

      case 'test':
        envConfig.development.mockMode = true;
        envConfig.logging.level = 'error';
        envConfig.server.url = 'ws://localhost:8081';
        break;
    }

    return envConfig;
  }

  /**
   * Get full configuration
   * @returns {Object} Full configuration
   */
  getAll() {
    return { ...this.config };
  }

  /**
   * Get configuration for specific component
   * @param {string} component - Component name
   * @returns {Object} Component configuration
   */
  getComponentConfig(component) {
    const componentConfigs = {
      server: ['server', 'security', 'logging'],
      rtc: ['rtc', 'audio', 'performance'],
      room: ['room', 'translation', 'features'],
      translation: ['translation', 'audio'],
      security: ['security', 'server'],
    };

    const configKeys = componentConfigs[component] || [component];
    const componentConfig = {};

    configKeys.forEach((key) => {
      if (this.config[key]) {
        componentConfig[key] = this.config[key];
      }
    });

    return componentConfig;
  }

  /**
   * Check if feature is enabled
   * @param {string} feature - Feature name
   * @returns {boolean} Whether feature is enabled
   */
  isFeatureEnabled(feature) {
    return this.get(`features.${feature}`, false);
  }

  /**
   * Enable or disable feature
   * @param {string} feature - Feature name
   * @param {boolean} enabled - Whether to enable feature
   * @param {boolean} save - Whether to save to file
   * @returns {Promise<void>}
   */
  async setFeature(feature, enabled, save = true) {
    this.set(`features.${feature}`, enabled);

    if (save) {
      await this.saveConfig();
    }

    logger.info(`Feature ${feature} ${enabled ? 'enabled' : 'disabled'}`);
  }
}

// Create singleton instance
const echoRTCConfig = new EchoRTCConfig();

module.exports = echoRTCConfig;
