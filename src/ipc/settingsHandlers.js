const { ipcMain } = require('electron');
const SettingsManager = require('../services/SettingsManager');
const logger = require('../utils/logger');

// Initialize settings manager
let settingsManager = null;

/**
 * Initialize settings handlers
 */
function initializeSettingsHandlers() {
  try {
    // Create settings manager instance
    settingsManager = new SettingsManager();

    // Set up event listeners
    settingsManager.on('settingsChanged', (data) => {
      // Broadcast settings changes to all renderer processes
      const { webContents } = require('electron');
      webContents.getAllWebContents().forEach((contents) => {
        if (!contents.isDestroyed()) {
          contents.send('settings:changed', data);
        }
      });
    });

    settingsManager.on('settingsReset', (data) => {
      // Broadcast settings reset to all renderer processes
      const { webContents } = require('electron');
      webContents.getAllWebContents().forEach((contents) => {
        if (!contents.isDestroyed()) {
          contents.send('settings:reset', data);
        }
      });
    });

    logger.info('Settings handlers initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize settings handlers:', error);
    throw error;
  }
}

/**
 * Get all settings
 */
ipcMain.handle('settings:getAll', async () => {
  try {
    if (!settingsManager) {
      throw new Error('Settings manager not initialized');
    }

    const settings = settingsManager.getSettings();
    logger.debug('Retrieved all settings');
    return { success: true, data: settings };
  } catch (error) {
    logger.error('Error getting all settings:', error);
    return { success: false, error: error.message };
  }
});

/**
 * Get a specific setting by path
 */
ipcMain.handle('settings:get', async (event, path) => {
  try {
    if (!settingsManager) {
      throw new Error('Settings manager not initialized');
    }

    if (!path || typeof path !== 'string') {
      throw new Error('Invalid setting path provided');
    }

    const value = settingsManager.getSetting(path);
    logger.debug(`Retrieved setting: ${path}`);
    return { success: true, data: value };
  } catch (error) {
    logger.error(`Error getting setting ${path}:`, error);
    return { success: false, error: error.message };
  }
});

/**
 * Update settings
 */
ipcMain.handle('settings:update', async (event, updates) => {
  try {
    if (!settingsManager) {
      throw new Error('Settings manager not initialized');
    }

    if (!updates || typeof updates !== 'object') {
      throw new Error('Invalid settings updates provided');
    }

    const success = settingsManager.updateSettings(updates);

    if (success) {
      logger.info('Settings updated successfully');
      return { success: true, message: 'Settings updated successfully' };
    } else {
      throw new Error('Failed to update settings');
    }
  } catch (error) {
    logger.error('Error updating settings:', error);
    return { success: false, error: error.message };
  }
});

/**
 * Update a specific setting by path
 */
ipcMain.handle('settings:updateSetting', async (event, path, value) => {
  try {
    if (!settingsManager) {
      throw new Error('Settings manager not initialized');
    }

    if (!path || typeof path !== 'string') {
      throw new Error('Invalid setting path provided');
    }

    const success = settingsManager.updateSetting(path, value);

    if (success) {
      logger.info(`Setting ${path} updated successfully`);
      return { success: true, message: `Setting ${path} updated successfully` };
    } else {
      throw new Error(`Failed to update setting ${path}`);
    }
  } catch (error) {
    logger.error(`Error updating setting ${path}:`, error);
    return { success: false, error: error.message };
  }
});

/**
 * Reset settings to defaults
 */
ipcMain.handle('settings:reset', async () => {
  try {
    if (!settingsManager) {
      throw new Error('Settings manager not initialized');
    }

    const success = settingsManager.resetSettings();

    if (success) {
      logger.info('Settings reset to defaults successfully');
      return { success: true, message: 'Settings reset to defaults successfully' };
    } else {
      throw new Error('Failed to reset settings');
    }
  } catch (error) {
    logger.error('Error resetting settings:', error);
    return { success: false, error: error.message };
  }
});

/**
 * Export settings (without sensitive data)
 */
ipcMain.handle('settings:export', async () => {
  try {
    if (!settingsManager) {
      throw new Error('Settings manager not initialized');
    }

    const exportableSettings = settingsManager.exportSettings();
    logger.info('Settings exported successfully');
    return { success: true, data: exportableSettings };
  } catch (error) {
    logger.error('Error exporting settings:', error);
    return { success: false, error: error.message };
  }
});

/**
 * Import settings
 */
ipcMain.handle('settings:import', async (event, importedSettings) => {
  try {
    if (!settingsManager) {
      throw new Error('Settings manager not initialized');
    }

    if (!importedSettings || typeof importedSettings !== 'object') {
      throw new Error('Invalid settings data provided for import');
    }

    const success = settingsManager.importSettings(importedSettings);

    if (success) {
      logger.info('Settings imported successfully');
      return { success: true, message: 'Settings imported successfully' };
    } else {
      throw new Error('Failed to import settings');
    }
  } catch (error) {
    logger.error('Error importing settings:', error);
    return { success: false, error: error.message };
  }
});

/**
 * Get settings validation status
 */
ipcMain.handle('settings:validate', async () => {
  try {
    if (!settingsManager) {
      throw new Error('Settings manager not initialized');
    }

    const settings = settingsManager.getSettings();
    const validation = {
      isValid: true,
      issues: [],
      warnings: [],
    };

    // Check for missing API keys
    const services = settings.services || {};
    Object.keys(services).forEach((serviceName) => {
      const service = services[serviceName];
      if (service.enabled && (!service.apiKey || service.apiKey.trim() === '')) {
        validation.warnings.push(`${serviceName} service is enabled but missing API key`);
      }
    });

    // Check audio device settings
    if (!settings.audio || !settings.audio.inputDevice) {
      validation.issues.push('Input audio device not configured');
      validation.isValid = false;
    }

    // Check translation settings
    if (!settings.translation || !settings.translation.defaultService) {
      validation.issues.push('Default translation service not configured');
      validation.isValid = false;
    }

    logger.debug('Settings validation completed');
    return { success: true, data: validation };
  } catch (error) {
    logger.error('Error validating settings:', error);
    return { success: false, error: error.message };
  }
});

/**
 * Cleanup settings handlers
 */
function cleanupSettingsHandlers() {
  try {
    // Remove all settings-related IPC handlers
    const handlers = [
      'settings:getAll',
      'settings:get',
      'settings:update',
      'settings:updateSetting',
      'settings:reset',
      'settings:export',
      'settings:import',
      'settings:validate',
    ];

    handlers.forEach((handler) => {
      if (ipcMain.removeHandler) {
        ipcMain.removeHandler(handler);
      }
    });

    // Clean up event listeners
    if (settingsManager) {
      settingsManager.removeAllListeners();
      settingsManager = null;
    }

    logger.info('Settings handlers cleaned up successfully');
  } catch (error) {
    logger.error('Error cleaning up settings handlers:', error);
  }
}

module.exports = {
  initializeSettingsHandlers,
  cleanupSettingsHandlers,
};
