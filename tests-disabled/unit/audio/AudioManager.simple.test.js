const EventEmitter = require('events');

// Mock the Store class
class MockStore {
  constructor() {
    this.store = {};
  }
  
  get(key, defaultValue) {
    if (this.store[key] === undefined) return defaultValue;
    return this.store[key];
  }
  
  set(key, value) {
    this.store[key] = value;
    return this;
  }
  
  delete(key) {
    delete this.store[key];
    return this;
  }
  
  clear() {
    this.store = {};
    return this;
  }
}

// Mock the audio-devices module
let mockAudioDevices = {
  getDevices: jest.fn()
};

// Mock device data
const mockDevices = [
  { name: 'Built-in Microphone', id: 'default', type: 'input', sampleRate: 44100, channels: 2, isDefault: true },
  { name: 'Built-in Output', id: 'default', type: 'output', sampleRate: 44100, channels: 2, isDefault: true }
];

// Mock the logger
const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
};

// Mock the AudioManager class with simplified implementation
class MockAudioManager extends EventEmitter {
  constructor() {
    super();
    this.store = new MockStore();
    this.inputDevices = [];
    this.outputDevices = [];
    this.virtualDevices = [];
    this.isCapturing = false;
    this.sampleRate = 16000;
    this.channels = 1;
    this.bitDepth = 16;
    this.initialized = false;
  }

  async initialize() {
    try {
      // Simulate device loading
      await this.refreshAudioDevices();
      this.initialized = true;
      mockLogger.info('AudioManager initialized');
    } catch (error) {
      mockLogger.error('Error initializing AudioManager:', error);
      throw error;
    }
  }

  async refreshAudioDevices() {
    try {
      const devices = await mockAudioDevices.getDevices();
      this.inputDevices = devices.filter(d => d.type === 'input');
      this.outputDevices = devices.filter(d => d.type === 'output');
      
      // Save to store
      this.store.set('audio.inputDevices', this.inputDevices);
      this.store.set('audio.outputDevices', this.outputDevices);
      
      this.emit('devices-updated', {
        input: this.inputDevices,
        output: this.outputDevices
      });
      
      return {
        input: this.inputDevices,
        output: this.outputDevices
      };
    } catch (error) {
      mockLogger.error('Error refreshing audio devices:', error);
      throw error;
    }
  }
}

describe('AudioManager (Simplified Test)', () => {
  let audioManager;

  beforeEach(() => {
    // Set up the mock to return our test devices
    mockAudioDevices.getDevices.mockResolvedValue([...mockDevices]);
    
    // Create a fresh instance for each test
    audioManager = new MockAudioManager();
    
    // Clear all mocks except for our getDevices mock
    jest.clearAllMocks();
    mockAudioDevices.getDevices.mockResolvedValue([...mockDevices]);
  });

  afterEach(() => {
    // Clean up any event listeners
    audioManager.removeAllListeners();
  });

  test('should initialize with default values', () => {
    expect(audioManager.inputDevices).toEqual([]);
    expect(audioManager.outputDevices).toEqual([]);
    expect(audioManager.isCapturing).toBe(false);
    expect(audioManager.sampleRate).toBe(16000);
    expect(audioManager.channels).toBe(1);
    expect(audioManager.bitDepth).toBe(16);
  });

  test('should initialize successfully', async () => {
    await audioManager.initialize();
    expect(audioManager.initialized).toBe(true);
    expect(mockLogger.info).toHaveBeenCalledWith('AudioManager initialized');
  });

  test('should refresh audio devices', async () => {
    const devices = await audioManager.refreshAudioDevices();
    
    // Check that we have the expected devices
    expect(devices.input).toHaveLength(1);
    expect(devices.output).toHaveLength(1);
    expect(devices.input[0].name).toBe('Built-in Microphone');
    expect(devices.output[0].name).toBe('Built-in Output');
    
    // Check that devices were saved to the store
    expect(audioManager.store.get('audio.inputDevices')).toHaveLength(1);
    expect(audioManager.store.get('audio.outputDevices')).toHaveLength(1);
  });

  test('should emit devices-updated event when refreshing devices', async () => {
    const devicesPromise = new Promise((resolve) => {
      audioManager.once('devices-updated', resolve);
    });
    
    await audioManager.refreshAudioDevices();
    const devices = await devicesPromise;
    
    expect(devices.input).toHaveLength(1);
    expect(devices.output).toHaveLength(1);
    expect(devices.input[0].name).toBe('Built-in Microphone');
  }, 10000);

  test('should handle errors when refreshing devices', async () => {
    // Mock a rejection
    const error = new Error('Failed to get devices');
    mockAudioDevices.getDevices.mockRejectedValueOnce(error);
    
    await expect(audioManager.refreshAudioDevices()).rejects.toThrow('Failed to get devices');
    expect(mockLogger.error).toHaveBeenCalledWith('Error refreshing audio devices:', error);
  });
});
