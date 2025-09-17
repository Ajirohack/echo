const { app, BrowserWindow, ipcMain, dialog, session, Menu, shell, systemPreferences } = require('electron');
const path = require('path');

// Load environment variables only in development
if (process.env.NODE_ENV !== 'production') {
  try {
    require('dotenv').config();
  } catch (_) {
    // dotenv is optional in production builds; ignore if not present
  }
}

const logger = require('./src/utils/logger');
const { initializeAudioHandlers, cleanupAudioHandlers } = require('./src/ipc/audioHandlers');
const { initializeSettingsHandlers, cleanupSettingsHandlers } = require('./src/ipc/settingsHandlers');
const { initializeTTSHandlers, cleanupTTSHandlers } = require('./src/ipc/ttsHandlers');
const autoUpdater = require('./src/services/auto-updater');
const SetupAutomation = require('./src/services/setup-automation');

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
try {
  if (require('electron-squirrel-startup')) {
    app.quit();
  }
} catch (error) {
  logger.warn('electron-squirrel-startup not available, skipping Windows installer check');
}

// Keep a global reference of the window object
let mainWindow;

const createWindow = () => {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true
    },
    icon: path.join(__dirname, 'assets/icons/icon.png')
  });

  // Load the index.html file
  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  // Open the DevTools in development mode
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }

  // Emitted when the window is closed
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Log window creation
  logger.info('Main window created');
};

// This method will be called when Electron has finished initialization
app.whenReady().then(() => {
  // Set up session permissions for microphone access
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    const allowedPermissions = ['media', 'audioCapture', 'videoCapture'];
    callback(allowedPermissions.includes(permission));
  });

  // Initialize app handlers
  initializeAppHandlers();

  // Create the main window
  createWindow();

  // Initialize auto-updater after window is created
  autoUpdater.init(mainWindow);

  // Create application menu
  createMenu();

  app.on('activate', () => {
    // On macOS it's common to re-create a window when the dock icon is clicked
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed, except on macOS
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Clean up resources before quitting
app.on('will-quit', () => {
  logger.info('Cleaning up resources before quit');
  cleanupAudioHandlers();
  cleanupSettingsHandlers();
  cleanupTTSHandlers();
});

// Log application events
app.on('will-quit', () => {
  logger.info('Application is quitting');
});

// Initialize handlers
let handlersInitialized = false;

// Handle IPC communication
const initializeAppHandlers = () => {
  if (handlersInitialized) return;

  // Initialize all IPC handlers
  initializeAudioHandlers();
  initializeSettingsHandlers();
  initializeTTSHandlers();
  handlersInitialized = true;

  logger.info('All IPC handlers initialized');
};

// Create application menu
const createMenu = () => {
  const template = [
    {
      label: 'echo',
      submenu: [
        {
          label: 'About echo',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'About echo',
              message: 'echo',
              detail: `Version ${app.getVersion()}\n\nReal-time multi-platform translation application\n\nCopyright © 2025 WhyteHoux.ai`
            });
          }
        },
        {
          label: 'Check for Updates...',
          click: () => {
            autoUpdater.checkForUpdates(true);
          }
        },
        { type: 'separator' },
        {
          label: 'Preferences...',
          accelerator: 'CmdOrCtrl+,',
          click: () => {
            mainWindow.webContents.send('open-preferences');
          }
        },
        { type: 'separator' },
        {
          label: 'Quit',
          accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
          click: () => {
            app.quit();
          }
        }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectall' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Translation',
      submenu: [
        {
          label: 'Start Translation',
          accelerator: 'CmdOrCtrl+Shift+T',
          click: () => {
            mainWindow.webContents.send('start-translation');
          }
        },
        {
          label: 'Stop Translation',
          accelerator: 'CmdOrCtrl+Shift+S',
          click: () => {
            mainWindow.webContents.send('stop-translation');
          }
        },
        { type: 'separator' },
        {
          label: 'Open Troubleshooting Guide',
          click: async () => {
            const url = await SetupAutomation.openTroubleshootingGuide();
            shell.openExternal(url);
          }
        }
      ]
    }
  ];

  if (process.platform === 'darwin') {
    template.unshift({
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    });
  }

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
};

// Initialize auto-updater IPC handlers
const initializeAutoUpdaterHandlers = () => {
  ipcMain.on('updater:check', () => {
    autoUpdater.checkForUpdates(true);
  });

  ipcMain.on('updater:download', () => {
    autoUpdater.downloadUpdate();
  });

  ipcMain.on('updater:install', () => {
    autoUpdater.quitAndInstall();
  });
};

initializeAutoUpdaterHandlers();

// Permissions IPC (macOS microphone preflight)
ipcMain.handle('permissions:checkMicrophone', async () => {
  try {
    if (process.platform === 'darwin' && systemPreferences && typeof systemPreferences.getMediaAccessStatus === 'function') {
      const status = systemPreferences.getMediaAccessStatus('microphone');
      return { platform: 'darwin', status };
    }
    // For non-macOS, rely on getUserMedia/session handler; assume granted
    return { platform: process.platform, status: 'granted' };
  } catch (error) {
    logger.error('permissions:checkMicrophone failed', error);
    return { status: 'unknown', error: error.message };
  }
});

ipcMain.handle('permissions:requestMicrophone', async () => {
  try {
    if (process.platform === 'darwin' && systemPreferences && typeof systemPreferences.askForMediaAccess === 'function') {
      const granted = await systemPreferences.askForMediaAccess('microphone');
      return { platform: 'darwin', granted };
    }
    return { platform: process.platform, granted: true };
  } catch (error) {
    logger.error('permissions:requestMicrophone failed', error);
    return { granted: false, error: error.message };
  }
});

ipcMain.handle('permissions:openSystemSettings', async () => {
  try {
    if (process.platform === 'darwin') {
      await shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone');
      return { success: true };
    }
    return { success: false, error: 'Not supported on this platform' };
  } catch (error) {
    logger.error('permissions:openSystemSettings failed', error);
    return { success: false, error: error.message };
  }
});

// Setup automation IPC handlers
ipcMain.handle('setup:performOneClick', async () => {
  try {
    const result = await SetupAutomation.runCompleteSetup();
    return result;
  } catch (error) {
    logger.error('Failed to perform one-click setup', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('setup:getStatus', async () => {
  try {
    const status = await SetupAutomation.getSetupStatus();
    return status;
  } catch (error) {
    logger.error('Failed to get setup status', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('setup:openTroubleshootingGuide', async () => {
  try {
    const url = await SetupAutomation.openTroubleshootingGuide();
    return url;
  } catch (error) {
    logger.error('Failed to open troubleshooting guide', error);
    return { success: false, error: error.message };
  }
});

// Handle app shutdown
app.on('will-quit', () => {
  cleanupAudioHandlers();
  cleanupSettingsHandlers();
  cleanupTTSHandlers();
});

// Error handling
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection:', reason);
});
