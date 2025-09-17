const os = require('os');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

class PlatformDetector {
  constructor() {
    this.supportedApps = [
      'Telegram',
      'Telegram Desktop',
      'WhatsApp',
      'WhatsApp Desktop',
      'Facebook Messenger',
      'Messenger',
      'Instagram',
      'Chrome',
      'Firefox',
      'Edge',
      'Discord',
      'Skype',
      'Zoom',
      'Teams',
    ];
    this.platform = os.platform();
  }

  /**
   * Detect the currently active communication app by scanning running processes
   * @returns {Promise<string|null>} Name of the detected app or null
   */
  async detectActiveApp() {
    let processList = '';
    try {
      if (this.platform === 'win32') {
        const { stdout } = await execAsync('tasklist');
        processList = stdout;
      } else if (this.platform === 'darwin') {
        const { stdout } = await execAsync('ps -A -o comm');
        processList = stdout;
      } else if (this.platform === 'linux') {
        const { stdout } = await execAsync('ps -A -o comm');
        processList = stdout;
      } else {
        return null;
      }
      for (const app of this.supportedApps) {
        if (processList.toLowerCase().includes(app.toLowerCase())) {
          return app;
        }
      }
      return null;
    } catch (err) {
      return null;
    }
  }

  /**
   * Configure audio routing for a specific app
   * @param {string} appName
   * @returns {Promise<void>}
   */
  async configureAudioRouting(appName) {
    try {
      const appConfig = this.getAppConfig(appName);

      if (!appConfig) {
        console.log(`No specific configuration found for ${appName}`);
        return;
      }

      // Apply platform-specific audio routing
      await this.applyAudioRouting(appConfig);

      console.log(`Audio routing configured for ${appName}`);
    } catch (error) {
      console.error(`Error configuring audio routing for ${appName}:`, error);
    }
  }

  /**
   * Get app-specific configuration
   * @param {string} appName
   * @returns {Object|null} App configuration
   */
  getAppConfig(appName) {
    const appConfigs = {
      Discord: {
        inputDevice: 'CABLE Input',
        outputDevice: 'CABLE Output',
        sampleRate: 48000,
        channels: 2,
        priority: 'high',
      },
      Zoom: {
        inputDevice: 'CABLE Input',
        outputDevice: 'CABLE Output',
        sampleRate: 16000,
        channels: 1,
        priority: 'high',
      },
      Teams: {
        inputDevice: 'CABLE Input',
        outputDevice: 'CABLE Output',
        sampleRate: 16000,
        channels: 1,
        priority: 'high',
      },
      Skype: {
        inputDevice: 'CABLE Input',
        outputDevice: 'CABLE Output',
        sampleRate: 16000,
        channels: 1,
        priority: 'medium',
      },
      Telegram: {
        inputDevice: 'CABLE Input',
        outputDevice: 'CABLE Output',
        sampleRate: 44100,
        channels: 2,
        priority: 'medium',
      },
      WhatsApp: {
        inputDevice: 'CABLE Input',
        outputDevice: 'CABLE Output',
        sampleRate: 44100,
        channels: 2,
        priority: 'medium',
      },
    };

    return appConfigs[appName] || null;
  }

  /**
   * Apply audio routing configuration
   * @param {Object} config
   * @returns {Promise<void>}
   */
  async applyAudioRouting(config) {
    try {
      if (this.platform === 'win32') {
        await this.applyWindowsAudioRouting(config);
      } else if (this.platform === 'darwin') {
        await this.applyMacAudioRouting(config);
      } else if (this.platform === 'linux') {
        await this.applyLinuxAudioRouting(config);
      }
    } catch (error) {
      console.error('Error applying audio routing:', error);
    }
  }

  /**
   * Apply audio routing on Windows
   * @param {Object} config
   * @returns {Promise<void>}
   */
  async applyWindowsAudioRouting(config) {
    try {
      // Set default audio devices using PowerShell
      const setInputCmd = `powershell -Command "Set-AudioDevice -ID '${config.inputDevice}'"`;
      const setOutputCmd = `powershell -Command "Set-AudioDevice -ID '${config.outputDevice}'"`;

      await execAsync(setInputCmd);
      await execAsync(setOutputCmd);

      console.log('Windows audio routing applied');
    } catch (error) {
      console.error('Error applying Windows audio routing:', error);
    }
  }

  /**
   * Apply audio routing on macOS
   * @param {Object} config
   * @returns {Promise<void>}
   */
  async applyMacAudioRouting(config) {
    try {
      // macOS audio routing would typically use Core Audio APIs
      // For now, we'll log the configuration
      console.log('macOS audio routing configuration:', config);
      console.log('Note: Full macOS audio routing requires Core Audio integration');
    } catch (error) {
      console.error('Error applying macOS audio routing:', error);
    }
  }

  /**
   * Apply audio routing on Linux
   * @param {Object} config
   * @returns {Promise<void>}
   */
  async applyLinuxAudioRouting(config) {
    try {
      // Set default sink and source using pactl
      const setSinkCmd = `pactl set-default-sink "${config.outputDevice}"`;
      const setSourceCmd = `pactl set-default-source "${config.inputDevice}"`;

      await execAsync(setSinkCmd);
      await execAsync(setSourceCmd);

      console.log('Linux audio routing applied');
    } catch (error) {
      console.error('Error applying Linux audio routing:', error);
    }
  }
}

module.exports = PlatformDetector;
