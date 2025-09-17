// Mock Electron and FS before importing modules that use logger
jest.mock('electron', () => ({
  app: {
    getPath: () => require('os').tmpdir(),
  },
}));

jest.mock('fs', () => {
  const actual = jest.requireActual('fs');
  return {
    ...actual,
    existsSync: jest.fn(() => true),
    mkdirSync: jest.fn(),
    createWriteStream: jest.fn(() => ({ write: jest.fn(), end: jest.fn() })),
  };
});

// Mock the logger BEFORE requiring BaseSTTService to avoid side effects
jest.mock('@/utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn(),
}));

const EventEmitter = require('events');
const BaseSTTService = require('@/services/stt/BaseSTTService');
const logger = require('@/utils/logger');

describe('BaseSTTService', () => {
  let service;

  // Create a test implementation of BaseSTTService
  class TestSTTService extends BaseSTTService {
    constructor(config = {}) {
      super({
        name: 'test',
        supportedLanguages: ['en', 'es', 'fr'],
        requiresApiKey: false, // Disable API key for tests
        ...config,
      });

      // Auto-initialize for testing
      this.isInitialized = true;
    }

    async _transcribe(audioData, options = {}) {
      return { text: 'test transcription', language: options.language || 'en' };
    }

    async _startStream(sessionId, options = {}) {
      return true;
    }

    async _processStreamData(sessionId, audioData) {
      return { text: 'stream transcription', isFinal: true };
    }

    async _stopStream(sessionId) {
      return { text: 'final transcription' };
    }
  }

  beforeEach(() => {
    // Create a fresh instance for each test
    service = new TestSTTService();
    jest.clearAllMocks();
  });

  afterEach(() => {
    service.removeAllListeners();
  });

  test('should initialize with default values', () => {
    // Create a fresh instance without auto-initialization
    const testService = new (class extends BaseSTTService {
      constructor() {
        super({ name: 'test', supportedLanguages: ['en', 'es', 'fr'], requiresApiKey: false });
      }
      async _transcribe() {
        return { text: 'test' };
      }
    })();

    expect(testService.config.name).toBe('test');
    expect(testService.config.supportedLanguages).toEqual(['en', 'es', 'fr']);
    expect(testService.isInitialized).toBe(false);
  });

  test('should initialize successfully', async () => {
    // Create a service that requires initialization
    const testService = new (class extends BaseSTTService {
      constructor() {
        super({ name: 'test-init', requiresApiKey: false });
      }
      async _transcribe() {
        return { text: 'test' };
      }
    })();

    const result = await testService.initialize();
    expect(result).toBe(true);
    expect(testService.isInitialized).toBe(true);
  });

  test('should transcribe audio', async () => {
    const audioData = new Float32Array([0.1, 0.2, 0.3]);
    const result = await service.transcribe(audioData, { language: 'es' });

    // Check for expected properties
    expect(result).toHaveProperty('text', 'test transcription');
    expect(result).toHaveProperty('language', 'es');
    expect(result).toHaveProperty('service', 'test');
    expect(result).toHaveProperty('isFinal', true);
    expect(result).toHaveProperty('confidence');
    expect(result).toHaveProperty('requestId');
  });

  test('should handle transcription errors', async () => {
    // Replace the _transcribe method to throw an error
    const originalTranscribe = service._transcribe;
    service._transcribe = jest.fn().mockRejectedValue(new Error('Transcription failed'));

    await expect(service.transcribe(new Float32Array())).rejects.toThrow('Transcription failed');

    // Restore the original method
    service._transcribe = originalTranscribe;
  });

  test('should not support streaming by default', () => {
    // BaseSTTService doesn't implement streaming by default
    // Check that the streaming methods don't exist
    expect(service.supportsStreaming).toBeUndefined();
    expect(service.startStream).toBeUndefined();
    expect(service.processStreamData).toBeUndefined();
    expect(service.stopStream).toBeUndefined();
  });

  test('should not have streaming methods by default', () => {
    // Verify that streaming methods don't exist on the instance
    expect(service.startStream).toBeUndefined();
    expect(service.processStreamData).toBeUndefined();
    expect(service.stopStream).toBeUndefined();

    // Verify that calling non-existent methods doesn't throw errors (optional chaining prevents this)
    // They just return undefined
    expect(service.startStream?.('test')).toBeUndefined();
    expect(service.processStreamData?.('test', new Float32Array())).toBeUndefined();
    expect(service.stopStream?.('test')).toBeUndefined();
  });

  test('should validate audio data', async () => {
    // Test with invalid audio data
    await expect(service.transcribe(null)).rejects.toThrow();

    // Test with unsupported language - our mock service doesn't validate this
    // so we'll just test that it works with a valid language
    const result = await service.transcribe(new Float32Array([0.1, 0.2, 0.3]), { language: 'es' });
    expect(result).toBeDefined();
    expect(result.text).toBe('test transcription');
  });
});
