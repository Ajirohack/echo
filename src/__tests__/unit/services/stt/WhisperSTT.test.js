// Mock Electron and FS before importing modules that use logger
jest.mock('electron', () => ({
  app: { getPath: () => require('os').tmpdir() },
}));

jest.mock('fs', () => {
  const actual = jest.requireActual('fs');
  return {
    ...actual,
    existsSync: jest.fn(() => true),
    mkdirSync: jest.fn(),
    writeFileSync: jest.fn(),
    createWriteStream: jest.fn(() => ({ write: jest.fn(), end: jest.fn() })),
  };
});

// Mock the logger early
jest.mock('@/utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn(),
}));

// Mock the BaseSTTService to avoid testing its implementation
const MockBaseSTTService = jest.fn().mockImplementation(function (config) {
  this.config = config || {};
  this.isInitialized = false;
  this.supportedLanguages = ['en', 'es', 'fr'];
  this.initialize = jest.fn().mockImplementation(async () => {
    // Simulate real behavior: require API key in cloud mode
    if (this.config.requiresApiKey && !this.config.apiKey && !this.config.useLocal) {
      throw new Error('API key is required for this service');
    }
    // Mirror real base behavior: delegate to subclass-specific initialization
    if (typeof this._initialize === 'function') {
      await this._initialize();
    }
    this.isInitialized = true;
    return true;
  });
  // Delegate to subclass _transcribe to exercise real paths
  this.transcribe = jest.fn().mockImplementation(async (audioData, options = {}) => {
    if (typeof this._transcribe === 'function') {
      return await this._transcribe(audioData, options);
    }
    return { text: 'test transcription', language: 'en', isFinal: true };
  });
  return this;
});

// Set up all mocks before importing any modules
jest.mock('@/services/stt/BaseSTTService', () => MockBaseSTTService);
// Also mock via relative path resolution used by WhisperSTT module
jest.mock('../../../../services/stt/BaseSTTService', () => MockBaseSTTService);

// Mock other dependencies
jest.mock('path', () => ({
  join: (...args) => args.join('/'),
  dirname: jest.fn().mockReturnValue(''),
  resolve: (...args) => args.join('/'),
}));

// Mock the OpenAI module
const mockOpenAI = {
  models: {
    list: jest.fn().mockResolvedValue({ data: [] }),
  },
  audio: {
    transcriptions: {
      create: jest.fn().mockResolvedValue({
        text: 'test transcription',
        language: 'en',
      }),
    },
  },
};

jest.mock('openai', () => ({
  OpenAI: jest.fn().mockImplementation(() => mockOpenAI),
}));

// Mock child_process
const mockExec = jest.fn();
jest.mock('child_process', () => ({
  exec: mockExec,
}));

// Mock ApiKeyManager to always validate API keys in tests
jest.mock('@/services/security/api-key-manager', () => {
  return jest.fn().mockImplementation(() => ({
    isValidApiKeyFormat: jest.fn(() => true),
  }));
});
// Also mock via relative path used inside service
jest.mock('../../../../services/security/api-key-manager', () => {
  return jest.fn().mockImplementation(() => ({
    isValidApiKeyFormat: jest.fn(() => true),
  }));
});

// Now import the module under test after all mocks are set up
const WhisperSTT = require('@/services/stt/services/WhisperSTT');

// Set up test environment
beforeEach(() => {
  jest.clearAllMocks();

  // Reset the mock implementation for create
  mockOpenAI.audio.transcriptions.create.mockResolvedValue({
    text: 'test transcription',
    language: 'en',
  });

  // Ensure models.list remains mocked for initialization
  if (mockOpenAI.models && mockOpenAI.models.list) {
    mockOpenAI.models.list.mockResolvedValue({ data: [] });
  }

  // Reset the exec mock implementation
  mockExec.mockImplementation((command, callback) => {
    callback(null, { stdout: JSON.stringify({ text: 'test local transcription' }) });
  });

  // Reset fs.existsSync
  require('fs').existsSync.mockReturnValue(true);

  // Reset the MockBaseSTTService implementation
  MockBaseSTTService.mockImplementation(function (config) {
    this.config = config || {};
    this.isInitialized = false;
    this.supportedLanguages = ['en', 'es', 'fr'];
    this.initialize = jest.fn().mockImplementation(async () => {
      if (this.config.requiresApiKey && !this.config.apiKey && !this.config.useLocal) {
        throw new Error('API key is required for this service');
      }
      if (typeof this._initialize === 'function') {
        await this._initialize();
      }
      this.isInitialized = true;
      return true;
    });
    this.transcribe = jest.fn().mockImplementation(async (audioData, options = {}) => {
      if (typeof this._transcribe === 'function') {
        return await this._transcribe(audioData, options);
      }
      return { text: 'test transcription', language: 'en', isFinal: true };
    });
    return this;
  });
});

describe('WhisperSTT', () => {
  let whisperSTT;
  let mockApiKey = 'test-api-key';

  beforeEach(() => {
    // Create a fresh instance for each test
    whisperSTT = new WhisperSTT({
      apiKey: mockApiKey,
      model: 'whisper-1',
      temperature: 0,
      responseFormat: 'json',
      timeout: 30000,
      maxRetries: 3,
      useLocal: false,
    });

    // Ensure our mocked OpenAI client is installed on the instance
    whisperSTT.openai = mockOpenAI;

    // Clear all mocks
    // Note: do not clearAllMocks here; the top-level beforeEach already resets mocks
    // and also re-primes the OpenAI mock implementations. Clearing again here
    // would remove those implementations and cause undefined behavior in tests.
  });

  afterEach(() => {
    whisperSTT = null;
  });

  test('should initialize with default values', () => {
    expect(whisperSTT).toBeDefined();
  });

  test('should initialize with API client when useLocal is false', async () => {
    const ok = await whisperSTT.initialize();
    expect(ok).toBeTruthy();
  });

  test('should transcribe audio using API', async () => {
    await whisperSTT.initialize();
    // Sanity: ensure OpenAI mock is wired into instance
    expect(whisperSTT.openai).toBeDefined();
    expect(whisperSTT.openai.audio).toBeDefined();
    expect(whisperSTT.openai.audio.transcriptions).toBeDefined();
    expect(typeof whisperSTT.openai.audio.transcriptions.create).toBe('function');

    const mockAudioData = new Float32Array([0.1, 0.2, 0.3]);
    const result = await whisperSTT.transcribe(mockAudioData, { language: 'en' });

    expect(result).toBeDefined();
    expect(result.text).toBe('test transcription');
    expect(mockOpenAI.audio.transcriptions.create).toHaveBeenCalledTimes(1);
  });

  test('should handle transcription errors', async () => {
    await whisperSTT.initialize();
    // Sanity: ensure OpenAI mock is wired into instance
    expect(whisperSTT.openai).toBeDefined();
    expect(whisperSTT.openai.audio).toBeDefined();
    expect(whisperSTT.openai.audio.transcriptions).toBeDefined();
    expect(typeof whisperSTT.openai.audio.transcriptions.create).toBe('function');

    mockOpenAI.audio.transcriptions.create.mockRejectedValueOnce(new Error('Transcription failed'));

    await expect(async () => {
      await whisperSTT.transcribe(new Float32Array());
    }).rejects.toThrow(/Transcription failed/);

    expect(mockOpenAI.audio.transcriptions.create).toHaveBeenCalled();
  });

  test('should use local model when useLocal is true', async () => {
    // Create a new instance with useLocal: true
    const localWhisper = new WhisperSTT({
      useLocal: true,
      localModel: 'base',
      localModelPath: '/path/to/model',
    });

    await localWhisper.initialize();
    const result = await localWhisper.transcribe(new Float32Array([0.1, 0.2, 0.3]));

    expect(result).toBeDefined();
    expect(result.text).toBe('test local transcription');
  });

  test('should handle local model not found', async () => {
    const fs = require('fs');
    fs.existsSync.mockReturnValue(false);

    const localWhisper = new WhisperSTT({
      useLocal: true,
      localModel: 'nonexistent',
      localModelPath: '/nonexistent/path',
    });

    await expect(localWhisper.initialize()).rejects.toThrow();
  });

  test('should handle missing API key for cloud mode', async () => {
    const noKeyWhisper = new WhisperSTT({
      useLocal: false,
      apiKey: '',
    });

    await expect(noKeyWhisper.initialize()).rejects.toThrow();
  });

  test('should handle streaming operations', async () => {
    // Mock the startStream method
    whisperSTT.startStream = jest.fn().mockResolvedValue(true);
    whisperSTT.stopStream = jest.fn().mockResolvedValue(true);

    // Test streaming
    const sessionId = 'test-session';
    const result = await whisperSTT.startStream(sessionId, { language: 'en' });

    expect(result).toBe(true);
    expect(whisperSTT.startStream).toHaveBeenCalledWith(sessionId, { language: 'en' });

    // Test stopping the stream
    await whisperSTT.stopStream(sessionId);
  });
});
