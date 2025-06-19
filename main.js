const { app, BrowserWindow, ipcMain, dialog, session, Menu } = require('electron');
const path = require('path');
const logger = require('./src/utils/logger');
const { initializeAudioHandlers, cleanupAudioHandlers } = require('./src/ipc/audioHandlers');
const autoUpdater = require('./src/services/auto-updater');

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  app.quit();
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
});

// Log application events
app.on('will-quit', () => {
  logger.info('Application is quitting');
});

// Initialize audio handlers
let audioHandlersInitialized = false;

// Handle audio recording and device management via IPC
const initializeAppHandlers = () => {
  if (audioHandlersInitialized) return;

  // Initialize audio handlers
  initializeAudioHandlers();
  audioHandlersInitialized = true;

  logger.info('App IPC handlers initialized');
};

// Create application menu
const createMenu = () => {
  const template = [
    {
      label: 'Universal Translator',
      submenu: [
        {
          label: 'About Universal Translator',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'About Universal Translator',
              message: 'Universal Translator',
              detail: `Version ${app.getVersion()}\n\nReal-time multi-platform translation application\n\nCopyright © 2025 Universal Translator Team`
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
          label: 'Toggle Microphone',
          accelerator: 'CmdOrCtrl+Shift+M',
          click: () => {
            mainWindow.webContents.send('toggle-microphone');
          }
        },
        {
          label: 'Switch Language',
          accelerator: 'CmdOrCtrl+Shift+L',
          click: () => {
            mainWindow.webContents.send('switch-language');
          }
        }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'User Guide',
          click: () => {
            require('electron').shell.openExternal('https://docs.universaltranslator.app');
          }
        },
        {
          label: 'API Setup Guide',
          click: () => {
            require('electron').shell.openExternal('https://docs.universaltranslator.app/api-setup');
          }
        },
        {
          label: 'Troubleshooting',
          click: () => {
            require('electron').shell.openExternal('https://docs.universaltranslator.app/troubleshooting');
          }
        },
        { type: 'separator' },
        {
          label: 'Report Issue',
          click: () => {
            require('electron').shell.openExternal('https://github.com/your-repo/universal-translator/issues');
          }
        },
        {
          label: 'Join Community',
          click: () => {
            require('electron').shell.openExternal('https://discord.gg/universaltranslator');
          }
        }
      ]
    }
  ];

  // macOS menu adjustments
  if (process.platform === 'darwin') {
    template.unshift({
      label: app.getName(),
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

    // Window menu
    template.push({
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'close' }
      ]
    });
  }

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
};

// Initialize auto-updater IPC handlers
const initializeAutoUpdaterHandlers = () => {
  // Check for updates
  ipcMain.handle('check-for-updates', async () => {
    return await autoUpdater.checkForUpdates(true);
  });

  // Download update
  ipcMain.handle('download-update', async () => {
    return await autoUpdater.downloadAndInstall();
  });

  // Install update
  ipcMain.handle('install-update', () => {
    autoUpdater.quitAndInstall();
  });

  // Get update status
  ipcMain.handle('get-update-status', () => {
    return autoUpdater.getStatus();
  });

  // Set auto-update enabled
  ipcMain.handle('set-auto-update-enabled', (event, enabled) => {
    autoUpdater.setAutoUpdateEnabled(enabled);
  });

  // Get auto-update enabled
  ipcMain.handle('get-auto-update-enabled', () => {
    return autoUpdater.isAutoUpdateEnabled();
  });
};

// Clean up resources before quitting
app.on('will-quit', () => {
  logger.info('Cleaning up resources before quit');
  cleanupAudioHandlers();
});

// Log application events
app.on('will-quit', () => {
  logger.info('Application is quitting');
});

// Initialize audio handlers
let audioHandlersInitialized = false;

// Handle audio recording and device management via IPC
const initializeAppHandlers = () => {
  if (audioHandlersInitialized) return;

  // Initialize audio handlers
  initializeAudioHandlers();
  audioHandlersInitialized = true;

  logger.info('App IPC handlers initialized');
};

// Handle errors
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  dialog.showErrorBox('An error occurred', error.message || 'Unknown error');
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  dialog.showErrorBox('An error occurred', 'An unhandled promise rejection occurred');
});
