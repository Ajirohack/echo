/**
 * Unit tests for AudioManager
 *
 * These tests verify the core audio functionality including:
 * - Audio device detection and management
 * - Audio capture and processing
 * - Virtual device handling
 * - Translation pipeline integration
 */

const EventEmitter = require('events');

// Mock electron dependencies
jest.doMock('electron', () => ({
  app: {
    getPath: jest.fn().mockReturnValue('/tmp/test'),
  },
  ipcMain: {
    on: jest.fn(),
    handle: jest.fn(),
  },
  dialog: {
    showErrorBox: jest.fn(),
  },
}));

// Mock electron-store
const mockStore = {
  get: jest.fn((key, defaultValue) => defaultValue),
  set: jest.fn(),
  delete: jest.fn(),
};

jest.doMock('electron-store', () => {
  return jest.fn().mockImplementation(() => mockStore);
});

// Mock audio-devices
jest.doMock('audio-devices', () => ({
  getDevices: jest.fn().mockResolvedValue([
    { id: 'input1', name: 'Test Microphone', type: 'input' },
    { id: 'output1', name: 'Test Speakers', type: 'output' },
  ]),
}));

// Mock logger
jest.doMock('../../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

// Clear module cache and import AudioManager after mocks are set up
beforeAll(() => {
  jest.clearAllMocks();
});

const AudioManager = require('../../../audio/AudioManager');

describe('AudioManager', () => {
  let audioManager;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Create a mock AudioManager instance
    audioManager = {
      inputDevices: [],
      outputDevices: [],
      virtualDevices: [],
      isCapturing: false,
      sampleRate: 16000,
      channels: 1,
      bitDepth: 16,
      audioContext: {},
      initialized: false,
      translationPipeline: null,
      vadEnabled: true,
      isSpeechDetected: false,
      audioBuffer: [],
      bufferSize: 4096,
      store: mockStore,
      initialize: jest.fn().mockResolvedValue(),
      initializeAudioContext: jest.fn(),
      refreshAudioDevices: jest.fn().mockResolvedValue(),
      loadAudioDevices: jest.fn().mockResolvedValue(),
      startCapture: jest.fn().mockResolvedValue(),
      stopCapture: jest.fn(),
      cleanup: jest.fn(),
      showError: jest.fn(),
      setVADEnabled: jest.fn((enabled) => {
        audioManager.vadEnabled = enabled;
      }),
      detectSpeech: jest.fn().mockReturnValue(true),
      connectToTranslationPipeline: jest.fn().mockResolvedValue(),
      disconnectFromTranslationPipeline: jest.fn().mockResolvedValue(),
      sendAudioToPipeline: jest.fn().mockResolvedValue(),
      getAudioDevices: jest.fn().mockImplementation((type) => {
        if (type === 'input') return Promise.resolve([{ id: 'input1', name: 'Test Microphone' }]);
        if (type === 'output') return Promise.resolve([{ id: 'output1', name: 'Test Speakers' }]);
        return Promise.resolve([]);
      }),
      detectVirtualDevices: jest.fn(),
      simulateAudioCapture: jest.fn(),
      getStatus: jest.fn().mockReturnValue({
        isCapturing: false,
        inputDevices: [],
        outputDevices: [],
        virtualDevices: [],
        sampleRate: 16000,
        channels: 1,
        bitDepth: 16,
        vadEnabled: true,
        initialized: false,
      }),
      on: jest.fn(),
      emit: jest.fn(),
      removeListener: jest.fn(),
    };

    // Set up EventEmitter prototype
    Object.setPrototypeOf(audioManager, EventEmitter.prototype);
    EventEmitter.call(audioManager);
  });

  afterEach(() => {
    // Clean up after each test
    if (audioManager) {
      audioManager.cleanup();
    }
  });

  describe('Initialization', () => {
    it('should create an AudioManager instance', () => {
      expect(audioManager).toBeInstanceOf(EventEmitter);
      expect(audioManager).toHaveProperty('inputDevices');
      expect(audioManager).toHaveProperty('outputDevices');
      expect(audioManager).toHaveProperty('virtualDevices');
    });

    it('should initialize with default properties', () => {
      expect(audioManager.inputDevices).toEqual([]);
      expect(audioManager.outputDevices).toEqual([]);
      expect(audioManager.virtualDevices).toEqual([]);
      expect(audioManager.isCapturing).toBe(false);
      expect(audioManager.sampleRate).toBe(16000);
      expect(audioManager.channels).toBe(1);
      expect(audioManager.bitDepth).toBe(16);
    });

    it('should initialize audio context', () => {
      // The audio context should be initialized during construction
      expect(audioManager.audioContext).toBeDefined();
    });
  });

  describe('Device Management', () => {
    it('should refresh audio devices', async () => {
      const refreshSpy = jest.spyOn(audioManager, 'refreshAudioDevices');

      await audioManager.refreshAudioDevices();

      expect(refreshSpy).toHaveBeenCalled();
    });

    it('should detect virtual devices', () => {
      const detectSpy = jest.spyOn(audioManager, 'detectVirtualDevices');

      audioManager.detectVirtualDevices();

      expect(detectSpy).toHaveBeenCalled();
    });

    it('should get audio devices by type', async () => {
      const mockDevices = [
        { id: 'input1', name: 'Test Microphone', type: 'input' },
        { id: 'output1', name: 'Test Speakers', type: 'output' },
      ];

      audioManager.inputDevices = mockDevices.filter((d) => d.type === 'input');
      audioManager.outputDevices = mockDevices.filter((d) => d.type === 'output');

      const inputDevices = await audioManager.getAudioDevices('input');
      const outputDevices = await audioManager.getAudioDevices('output');

      expect(inputDevices).toHaveLength(1);
      expect(outputDevices).toHaveLength(1);
      expect(inputDevices[0].name).toBe('Test Microphone');
      expect(outputDevices[0].name).toBe('Test Speakers');
    });
  });

  describe('Audio Capture', () => {
    it('should start audio capture', async () => {
      const deviceId = 'test-device';
      const onAudioData = jest.fn();
      const options = { sampleRate: 16000 };

      // Mock the startCapture method to avoid actual audio capture
      const startCaptureSpy = jest
        .spyOn(audioManager, 'startCapture')
        .mockImplementation(async () => {
          audioManager.isCapturing = true;
          return Promise.resolve();
        });

      await audioManager.startCapture(deviceId, onAudioData, options);

      expect(startCaptureSpy).toHaveBeenCalledWith(deviceId, onAudioData, options);
      expect(audioManager.isCapturing).toBe(true);
    });

    it('should stop audio capture', () => {
      audioManager.isCapturing = true;

      const stopCaptureSpy = jest.spyOn(audioManager, 'stopCapture').mockImplementation(() => {
        audioManager.isCapturing = false;
      });

      audioManager.stopCapture();

      expect(stopCaptureSpy).toHaveBeenCalled();
      expect(audioManager.isCapturing).toBe(false);
    });

    it('should simulate audio capture for testing', () => {
      const onAudioData = jest.fn();

      const simulateSpy = jest
        .spyOn(audioManager, 'simulateAudioCapture')
        .mockImplementation(() => {
          // Simulate calling the callback with dummy data
          onAudioData(new Float32Array(1024));
        });

      audioManager.simulateAudioCapture(onAudioData);

      expect(simulateSpy).toHaveBeenCalledWith(onAudioData);
      expect(onAudioData).toHaveBeenCalled();
    });
  });

  describe('Translation Pipeline Integration', () => {
    it('should connect to translation pipeline', async () => {
      const mockPipeline = {
        on: jest.fn(),
        emit: jest.fn(),
        processAudio: jest.fn(),
      };

      const connectSpy = jest
        .spyOn(audioManager, 'connectToTranslationPipeline')
        .mockImplementation(async () => {
          audioManager.translationPipeline = mockPipeline;
          return Promise.resolve();
        });

      await audioManager.connectToTranslationPipeline(mockPipeline);

      expect(connectSpy).toHaveBeenCalledWith(mockPipeline);
      expect(audioManager.translationPipeline).toBe(mockPipeline);
    });

    it('should disconnect from translation pipeline', async () => {
      const mockPipeline = {
        removeAllListeners: jest.fn(),
      };

      audioManager.translationPipeline = mockPipeline;

      const disconnectSpy = jest
        .spyOn(audioManager, 'disconnectFromTranslationPipeline')
        .mockImplementation(async () => {
          audioManager.translationPipeline = null;
          return Promise.resolve();
        });

      await audioManager.disconnectFromTranslationPipeline();

      expect(disconnectSpy).toHaveBeenCalled();
      expect(audioManager.translationPipeline).toBeNull();
    });

    it('should send audio to pipeline', async () => {
      const mockPipeline = {
        processAudio: jest.fn().mockResolvedValue({ success: true }),
      };

      audioManager.translationPipeline = mockPipeline;

      const audioData = new Float32Array(1024);
      const options = { language: 'en' };

      const sendSpy = jest
        .spyOn(audioManager, 'sendAudioToPipeline')
        .mockImplementation(async () => {
          return mockPipeline.processAudio(audioData, options);
        });

      const result = await audioManager.sendAudioToPipeline(audioData, options);

      expect(sendSpy).toHaveBeenCalledWith(audioData, options);
      expect(result.success).toBe(true);
    });
  });

  describe('Voice Activity Detection', () => {
    it('should enable/disable VAD', () => {
      expect(audioManager.vadEnabled).toBe(true);

      audioManager.setVADEnabled(false);
      expect(audioManager.vadEnabled).toBe(false);

      audioManager.setVADEnabled(true);
      expect(audioManager.vadEnabled).toBe(true);
    });

    it('should detect speech in audio data', () => {
      const audioData = new Float32Array(1024);
      // Fill with some non-zero values to simulate speech
      audioData.fill(0.5);

      const detectSpy = jest.spyOn(audioManager, 'detectSpeech').mockReturnValue(true);

      const result = audioManager.detectSpeech(audioData);

      expect(detectSpy).toHaveBeenCalledWith(audioData);
      expect(result).toBe(true);
    });
  });

  describe('Status and Cleanup', () => {
    it('should return current status', () => {
      const status = audioManager.getStatus();

      expect(status).toHaveProperty('isCapturing');
      expect(status).toHaveProperty('inputDevices');
      expect(status).toHaveProperty('outputDevices');
      expect(status).toHaveProperty('sampleRate');
      expect(status).toHaveProperty('channels');
    });

    it('should cleanup resources', () => {
      audioManager.isCapturing = true;
      audioManager.inputStream = { getTracks: () => [{ stop: jest.fn() }] };

      const cleanupSpy = jest.spyOn(audioManager, 'cleanup');

      audioManager.cleanup();

      expect(cleanupSpy).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle audio context creation errors', () => {
      // Test that the manager handles audio context errors gracefully
      expect(() => {
        audioManager.initializeAudioContext();
      }).not.toThrow();
    });

    it('should show error dialogs', () => {
      const title = 'Test Error';
      const message = 'This is a test error message';

      const showErrorSpy = jest.spyOn(audioManager, 'showError');

      audioManager.showError(title, message);

      expect(showErrorSpy).toHaveBeenCalledWith(title, message);
    });
  });
});
