const { expect } = require('@testing-library/jest-dom');

// Mock electron app
jest.mock('electron', () => ({
  app: {
    getPath: jest.fn().mockReturnValue('/tmp/user-data'),
    getName: jest.fn().mockReturnValue('Translation App'),
    getVersion: jest.fn().mockReturnValue('1.0.0'),
    isPackaged: false,
  },
  ipcRenderer: {
    on: jest.fn(),
    send: jest.fn(),
    sendSync: jest.fn(),
    invoke: jest.fn(),
    removeListener: jest.fn(),
    removeAllListeners: jest.fn(),
  },
  ipcMain: {
    on: jest.fn(),
    send: jest.fn(),
    handle: jest.fn(),
    removeHandler: jest.fn(),
  },
  shell: {
    showItemInFolder: jest.fn(),
    openExternal: jest.fn(),
  },
  dialog: {
    showOpenDialog: jest.fn(),
    showSaveDialog: jest.fn(),
    showErrorBox: jest.fn(),
    showMessageBox: jest.fn(),
  },
}));

// Mock global browser and audio objects
class MockAudioContext {
  constructor() {
    this.suspend = jest.fn().mockResolvedValue(undefined);
    this.close = jest.fn().mockResolvedValue(undefined);
    this.resume = jest.fn().mockResolvedValue(undefined);
    this.state = 'suspended';
    this.destination = {
      connect: jest.fn(),
      disconnect: jest.fn(),
    };
    this.createMediaStreamSource = jest.fn().mockReturnValue({
      connect: jest.fn(),
      disconnect: jest.fn(),
    });
    this.createAnalyser = jest.fn().mockReturnValue({
      connect: jest.fn(),
      disconnect: jest.fn(),
    });
    this.createMediaStreamDestination = jest.fn().mockReturnValue({
      stream: { getTracks: () => [{ stop: jest.fn() }] },
    });
    this.createScriptProcessor = jest.fn().mockReturnValue({
      connect: jest.fn(),
      disconnect: jest.fn(),
    });
  }
}

// Mock WebRTC
const mockMediaStream = {
  getTracks: jest.fn().mockReturnValue([{ stop: jest.fn() }]),
  getAudioTracks: jest.fn().mockReturnValue([{ enabled: true, stop: jest.fn() }]),
};

// Mock navigator.mediaDevices
const mockMediaDevices = {
  getUserMedia: jest.fn().mockResolvedValue(mockMediaStream),
  enumerateDevices: jest.fn().mockResolvedValue([
    { kind: 'audioinput', deviceId: 'mic1', label: 'Microphone' },
    { kind: 'audiooutput', deviceId: 'speaker1', label: 'Speakers' },
  ]),
};

// Mock localStorage
const localStorageMock = (() => {
  let store = {};
  return {
    getItem: (key) => store[key] || null,
    setItem: (key, value) => {
      store[key] = value.toString();
    },
    clear: () => {
      store = {};
    },
    removeItem: (key) => {
      delete store[key];
    },
  };
})();

// Mock Intl API
const mockLanguageNames = new Map([
  ['en', 'English'],
  ['es', 'Spanish'],
  ['fr', 'French'],
  // Add more language codes as needed
]);

class MockDisplayNames {
  constructor(locales, options) {
    this.locales = locales;
    this.options = options;
  }
  
  of(code) {
    return mockLanguageNames.get(code) || code.toUpperCase();
  }
}

global.Intl = {
  ...global.Intl,
  DisplayNames: MockDisplayNames,
  DateTimeFormat: jest.fn().mockImplementation((locale, options) => ({
    format: jest.fn().mockImplementation(date => {
      return new Date(date).toLocaleDateString(locale, options);
    })
  }))
};

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Set up global mocks
global.window = {
  ...global.window,
  AudioContext: MockAudioContext,
  webkitAudioContext: MockAudioContext,
  navigator: {
    ...global.window?.navigator,
    mediaDevices: mockMediaDevices,
    userAgent: 'node',
    platform: 'node',
  },
  localStorage: localStorageMock,
  matchMedia: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
  requestAnimationFrame: (callback) => setTimeout(callback, 0),
  cancelAnimationFrame: (id) => clearTimeout(id),
  URL: {
    createObjectURL: jest.fn(),
    revokeObjectURL: jest.fn(),
  },
};

global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({}),
    text: () => Promise.resolve(''),
  })
);

// Mock console methods to reduce test noise
const consoleError = console.error;
const consoleWarn = console.warn;

console.error = (message, ...args) => {
  // Ignore React deprecation warnings in tests
  if (typeof message === 'string' && message.includes('ReactDOM.render is no longer supported')) {
    return;
  }
  consoleError(message, ...args);};

console.warn = (message, ...args) => {
  // Suppress specific warnings if needed
  if (typeof message === 'string' && message.includes('componentWillReceiveProps')) {
    return;
  }
  consoleWarn(message, ...args);
};

// Mock Recoil
jest.mock('recoil', () => ({
  atom: (config) => ({
    key: config.key,
    default: config.default,
  }),
  selector: (config) => ({
    key: config.key,
    get: config.get || (() => {}),
    set: config.set || (() => {}),
  }),
  useRecoilValue: (recoilValue) => {
    if (recoilValue && typeof recoilValue.key !== 'undefined') {
      return recoilValue.default;
    }
    return undefined;
  },
  useSetRecoilState: () => jest.fn(),
  useRecoilState: (recoilState) => {
    // Use a simple mock implementation without React hooks
    return [recoilState?.default || null, jest.fn()];
  },
}));
