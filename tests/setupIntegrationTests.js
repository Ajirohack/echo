const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

// Set up the DOM environment
const html = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf8');
const dom = new JSDOM(html, {
  url: 'http://localhost',
  runScripts: 'dangerously',
  resources: 'usable',
});

global.window = dom.window;
global.document = dom.window.document;
global.navigator = dom.window.navigator;

// Mock Electron
const electron = {
  ipcRenderer: {
    on: jest.fn(),
    send: jest.fn(),
    invoke: jest.fn(),
    removeListener: jest.fn(),
    removeAllListeners: jest.fn(),
  },
};

// Mock Web Audio API
class AudioContext {
  constructor() {
    this.suspend = jest.fn().mockResolvedValue(undefined);
    this.close = jest.fn().mockResolvedValue(undefined);
    this.resume = jest.fn().mockResolvedValue(undefined);
    this.state = 'suspended';
    this.destination = {};
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

// Mock complete pipeline
const mockCompletePipeline = {
  start: jest.fn().mockResolvedValue(true),
  stop: jest.fn().mockResolvedValue(true),
  setLanguages: jest.fn().mockResolvedValue(true),
  setVoice: jest.fn().mockResolvedValue(true),
  testVoice: jest.fn().mockResolvedValue(true),
};

// Set up global mocks
global.window.require = (module) => {
  if (module === 'electron') {
    return electron;
  }
  return require(module);
};

global.window.AudioContext = AudioContext;
global.window.navigator.mediaDevices = mockMediaDevices;
global.window.localStorage = localStorageMock;
global.completePipeline = mockCompletePipeline;

// Load the renderer script
const rendererPath = path.resolve(__dirname, '../renderer.js');
const rendererScript = fs.readFileSync(rendererPath, 'utf8');
const scriptElement = document.createElement('script');
scriptElement.textContent = rendererScript;
document.body.appendChild(scriptElement);

// Initialize the app
window.initApp();
