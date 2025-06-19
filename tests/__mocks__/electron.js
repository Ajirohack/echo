// Mock for electron module
const EventEmitter = require('events');

// Mock app
const app = {
  getPath: jest.fn((name) => `/mock/path/${name}`),
  whenReady: jest.fn(() => Promise.resolve())
};

// Mock dialog
const dialog = {
  showOpenDialog: jest.fn(() => Promise.resolve({ filePaths: ['/mock/file/path'] })),
  showSaveDialog: jest.fn(() => Promise.resolve({ filePath: '/mock/save/path' })),
  showErrorBox: jest.fn(),
  showMessageBox: jest.fn(() => Promise.resolve({ response: 0 }))
};

// Mock ipcMain
class IpcMain extends EventEmitter {}
const ipcMain = new IpcMain();
ipcMain.handle = jest.fn();
ipcMain.removeHandler = jest.fn();

// Mock BrowserWindow
class BrowserWindow {
  constructor(options) {
    this.options = options;
    this.webContents = {
      send: jest.fn(),
      on: jest.fn(),
      session: {
        defaultSession: {
          webRequest: {
            onHeadersReceived: jest.fn(),
            onBeforeRequest: jest.fn()
          }
        }
      }
    };
    this.loadURL = jest.fn();
    this.on = jest.fn((event, callback) => {
      if (event === 'ready-to-show') {
        callback();
      }
    });
    this.show = jest.fn();
    this.focus = jest.fn();
    this.isDestroyed = jest.fn(() => false);
    this.destroy = jest.fn();
    this.close = jest.fn();
  }
}

module.exports = {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  ipcRenderer: {
    send: jest.fn(),
    on: jest.fn(),
    invoke: jest.fn(),
    removeListener: jest.fn()
  },
  shell: {
    openExternal: jest.fn()
  },
  session: {
    defaultSession: {
      webRequest: {
        onHeadersReceived: jest.fn(),
        onBeforeRequest: jest.fn()
      }
    }
  }
};
