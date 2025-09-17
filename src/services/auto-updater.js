/**
 * Auto-updater module for echo
 * Handles automatic updates using electron-updater
 */

const { autoUpdater } = require('electron-updater');
const { app, dialog, BrowserWindow } = require('electron');

// Create a fallback logger in case electron-log is not available
let log;
try {
  log = require('electron-log');
} catch (error) {
  log = {
    info: console.log,
    error: console.error,
    warn: console.warn,
    debug: console.debug,
  };
  console.warn('electron-log not available, using console fallback');
}

class AutoUpdater {
  constructor() {
    this.mainWindow = null;
    this.updateCheckInProgress = false;
    this.updateDownloaded = false;

    // Configure logging
    log.transports.file.level = 'info';
    autoUpdater.logger = log;

    // Configure auto-updater
    this.setupAutoUpdater();
  }

  /**
   * Initialize auto-updater
   */
  init(mainWindow) {
    this.mainWindow = mainWindow;

    // Check for updates on app startup (after 10 seconds)
    setTimeout(() => {
      this.checkForUpdates();
    }, 10000);

    // Check for updates every 6 hours
    setInterval(
      () => {
        this.checkForUpdates();
      },
      6 * 60 * 60 * 1000
    );
  }

  /**
   * Setup auto-updater event handlers
   */
  setupAutoUpdater() {
    // Update available
    autoUpdater.on('update-available', (info) => {
      log.info('Update available:', info);
      this.showUpdateAvailableDialog(info);
    });

    // Update not available
    autoUpdater.on('update-not-available', (info) => {
      log.info('Update not available:', info);

      // Only show dialog if user manually checked
      if (this.updateCheckInProgress) {
        this.showNoUpdateDialog();
      }
    });

    // Update downloaded
    autoUpdater.on('update-downloaded', (info) => {
      log.info('Update downloaded:', info);
      this.updateDownloaded = true;
      this.showUpdateReadyDialog(info);
    });

    // Download progress
    autoUpdater.on('download-progress', (progressObj) => {
      const percent = Math.round(progressObj.percent);
      log.info(`Download progress: ${percent}%`);

      if (this.mainWindow) {
        this.mainWindow.webContents.send('update-progress', {
          percent,
          transferred: progressObj.transferred,
          total: progressObj.total,
        });
      }
    });

    // Error handling
    autoUpdater.on('error', (error) => {
      log.error('Auto-updater error:', error);
      this.showUpdateErrorDialog(error);
    });

    // Before quit for update
    autoUpdater.on('before-quit-for-update', () => {
      log.info('App will quit for update');

      if (this.mainWindow) {
        this.mainWindow.webContents.send('app-will-quit-for-update');
      }
    });
  }

  /**
   * Check for updates manually
   */
  async checkForUpdates(userInitiated = false) {
    if (this.updateCheckInProgress) {
      return;
    }

    this.updateCheckInProgress = userInitiated;

    try {
      log.info('Checking for updates...');

      if (this.mainWindow && userInitiated) {
        this.mainWindow.webContents.send('update-check-started');
      }

      await autoUpdater.checkForUpdatesAndNotify();
    } catch (error) {
      log.error('Error checking for updates:', error);

      if (userInitiated) {
        this.showUpdateErrorDialog(error);
      }
    } finally {
      this.updateCheckInProgress = false;
    }
  }

  /**
   * Download and install update
   */
  async downloadAndInstall() {
    try {
      log.info('Starting update download...');

      if (this.mainWindow) {
        this.mainWindow.webContents.send('update-download-started');
      }

      await autoUpdater.downloadUpdate();
    } catch (error) {
      log.error('Error downloading update:', error);
      this.showUpdateErrorDialog(error);
    }
  }

  /**
   * Install downloaded update
   */
  quitAndInstall() {
    if (!this.updateDownloaded) {
      log.warn('No update downloaded');
      return;
    }

    log.info('Quitting and installing update...');
    autoUpdater.quitAndInstall();
  }

  /**
   * Show update available dialog
   */
  showUpdateAvailableDialog(info) {
    const options = {
      type: 'info',
      title: 'Update Available',
      message: `A new version of echo is available!`,
      detail: `Version ${info.version} is now available. You have version ${app.getVersion()}.\n\nWould you like to download and install it now?`,
      buttons: ['Download Now', 'Download Later', 'Skip This Version'],
      defaultId: 0,
      cancelId: 1,
    };

    dialog.showMessageBox(this.mainWindow, options).then((result) => {
      if (result.response === 0) {
        // Download now
        this.downloadAndInstall();
      } else if (result.response === 2) {
        // Skip this version
        this.skipVersion(info.version);
      }
      // Download later - do nothing
    });
  }

  /**
   * Show update ready dialog
   */
  showUpdateReadyDialog(info) {
    const options = {
      type: 'info',
      title: 'Update Ready',
      message: 'Update downloaded and ready to install',
      detail: `Version ${info.version} has been downloaded and is ready to install.\n\nThe application will restart to apply the update.`,
      buttons: ['Restart Now', 'Restart Later'],
      defaultId: 0,
      cancelId: 1,
    };

    dialog.showMessageBox(this.mainWindow, options).then((result) => {
      if (result.response === 0) {
        // Restart now
        this.quitAndInstall();
      }
      // Restart later - do nothing
    });
  }

  /**
   * Show no update dialog
   */
  showNoUpdateDialog() {
    const options = {
      type: 'info',
      title: 'No Updates',
      message: 'You are running the latest version',
      detail: `echo ${app.getVersion()} is the latest version available.`,
      buttons: ['OK'],
      defaultId: 0,
    };

    dialog.showMessageBox(this.mainWindow, options);
  }

  /**
   * Show update error dialog
   */
  showUpdateErrorDialog(error) {
    const options = {
      type: 'error',
      title: 'Update Error',
      message: 'Failed to check for updates',
      detail: `An error occurred while checking for updates:\n\n${error.message}\n\nPlease check your internet connection and try again later.`,
      buttons: ['OK'],
      defaultId: 0,
    };

    dialog.showMessageBox(this.mainWindow, options);
  }

  /**
   * Skip a specific version
   */
  skipVersion(version) {
    const Store = require('electron-store');
    const store = new Store();

    store.set('skippedVersion', version);
    log.info(`Skipped version: ${version}`);
  }

  /**
   * Check if version should be skipped
   */
  shouldSkipVersion(version) {
    const Store = require('electron-store');
    const store = new Store();

    const skippedVersion = store.get('skippedVersion');
    return skippedVersion === version;
  }

  /**
   * Get update status
   */
  getStatus() {
    return {
      currentVersion: app.getVersion(),
      checkInProgress: this.updateCheckInProgress,
      updateDownloaded: this.updateDownloaded,
      autoUpdaterEnabled: true,
    };
  }

  /**
   * Enable/disable auto-updater
   */
  setAutoUpdateEnabled(enabled) {
    autoUpdater.autoDownload = enabled;
    autoUpdater.autoInstallOnAppQuit = enabled;

    const Store = require('electron-store');
    const store = new Store();
    store.set('autoUpdateEnabled', enabled);

    log.info(`Auto-updater ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Check if auto-updater is enabled
   */
  isAutoUpdateEnabled() {
    const Store = require('electron-store');
    const store = new Store();

    return store.get('autoUpdateEnabled', true); // Default to enabled
  }
}

module.exports = new AutoUpdater();
