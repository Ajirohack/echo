const AudioManager = require('../../../src/audio/AudioManager');
const { EventEmitter } = require('events');

// Mock the logger
jest.mock('../../../src/utils/logger');

// Mock electron-store
const mockStore = {
  get: jest.fn((key, defaultValue) => {
    if (key === 'audio.inputDevices') return [];
    if (key === 'audio.outputDevices') return [];
    return defaultValue;
  }),
  set: jest.fn(),
  delete: jest.fn(),
  clear: jest.fn(),
  store: {}
};

jest.mock('electron-store', () => {
  return jest.fn().mockImplementation(() => mockStore);
});

describe('AudioManager', () => {
  let audioManager;
  let mockAudioDevices;

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
    
    // Create a fresh instance for each test
    audioManager = new AudioManager();
    
    // Mock audio-devices module
    mockAudioDevices = require('audio-devices');
  });

  afterEach(() => {
    // Clean up any event listeners
    if (audioManager) {
      audioManager.removeAllListeners();
    }
  });

  describe('initialization', () => {
    it('should initialize with default values', () => {
      expect(audioManager.inputDevices).toEqual([]);
      expect(audioManager.outputDevices).toEqual([]);
      expect(audioManager.virtualDevices).toEqual([]);
      expect(audioManager.isCapturing).toBe(false);
      expect(audioManager.sampleRate).toBe(16000);
      expect(audioManager.channels).toBe(1);
      expect(audioManager.bitDepth).toBe(16);
    });
  });

  describe('device management', () => {
    it('should list audio devices', async () => {
      // Mock the getDevices function
      mockAudioDevices.getDevices.mockResolvedValue([
        { name: 'Mic', type: 'input', id: 'mic1' },
        { name: 'Headphones', type: 'output', id: 'hp1' }
      ]);

      await audioManager.listDevices();
      
      expect(audioManager.inputDevices).toHaveLength(1);
      expect(audioManager.outputDevices).toHaveLength(1);
      expect(audioManager.inputDevices[0].name).toBe('Mic');
      expect(audioManager.outputDevices[0].name).toBe('Headphones');
    });

    it('should handle errors when listing devices', async () => {
      // Mock a rejection
      mockAudioDevices.getDevices.mockRejectedValue(new Error('Device error'));
      
      await expect(audioManager.listDevices()).rejects.toThrow('Device error');
    });
  });

  describe('audio capture', () => {
    it('should start and stop audio capture', async () => {
      // Mock successful device listing
      mockAudioDevices.getDevices.mockResolvedValue([
        { name: 'Mic', type: 'input', id: 'mic1' },
        { name: 'Headphones', type: 'output', id: 'hp1' }
      ]);

      // Mock the capture methods
      audioManager.capture = {
        start: jest.fn().mockResolvedValue(true),
        stop: jest.fn().mockResolvedValue(true)
      };

      // Start capture
      await audioManager.startCapture();
      expect(audioManager.isCapturing).toBe(true);
      expect(audioManager.capture.start).toHaveBeenCalled();

      // Stop capture
      await audioManager.stopCapture();
      expect(audioManager.isCapturing).toBe(false);
      expect(audioManager.capture.stop).toHaveBeenCalled();
    });
  });

  describe('event emissions', () => {
    it('should emit device-updated event when devices are listed', (done) => {
      // Mock the getDevices function
      mockAudioDevices.getDevices.mockResolvedValue([
        { name: 'Mic', type: 'input', id: 'mic1' }
      ]);

      audioManager.on('device-updated', (devices) => {
        expect(devices.input).toHaveLength(1);
        expect(devices.input[0].name).toBe('Mic');
        done();
      });

      audioManager.listDevices();
    });
  });
});
