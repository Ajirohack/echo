const path = require('path');
const proxyquire = require('proxyquire').noPreserveCache();

// Mock Electron to avoid logger side effects related to app.getPath
jest.mock('electron', () => ({
  app: { getPath: () => require('os').tmpdir() },
}));

// We'll define mocks in the beforeAll/beforeEach hooks to ensure fresh instances for each test
let mockLogger, mockOpenAIClient, mockOpenAI, mockExec, mockFs, mockPath, mockChildProcess;

describe('WhisperSTT', function () {
  let WhisperSTT;

  beforeAll(() => {
    // Mock logger
    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
    };

    // Mock OpenAI client with models.list for API initialization
    mockOpenAIClient = {
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

    // Mock OpenAI constructor
    mockOpenAI = {
      OpenAI: jest.fn(() => mockOpenAIClient),
    };

    // Mock child_process.exec
    mockExec = jest.fn((cmd, cb) => {
      cb(null, { stdout: JSON.stringify({ text: 'test local transcription' }) });
    });

    // Mock fs module
    mockFs = {
      existsSync: jest.fn(() => true),
      mkdirSync: jest.fn(),
      writeFileSync: jest.fn(),
      readFileSync: jest.fn(() => Buffer.from([0x00])),
      promises: {
        stat: jest.fn().mockResolvedValue({ isFile: () => true, size: 1024 }),
      },
    };

    // Mock path module
    mockPath = {
      join: path.join,
      dirname: path.dirname,
      resolve: path.resolve,
      basename: path.basename,
    };

    // Mock child_process module
    mockChildProcess = { exec: mockExec };

    // Load BaseSTTService with the same stubs so its internal fs/path references are mocked
    const PatchedBaseSTTService = proxyquire('../../../../services/stt/BaseSTTService', {
      fs: mockFs,
      path: mockPath,
      '../../utils/logger': mockLogger,
    });

    // Use proxyquire to mock the dependencies
    WhisperSTT = proxyquire('../../../../services/stt/services/WhisperSTT', {
      '../../../utils/logger': mockLogger,
      '../BaseSTTService': PatchedBaseSTTService,
      openai: mockOpenAI,
      fs: mockFs,
      path: mockPath,
      child_process: mockChildProcess,
      util: {
        promisify: (fn) => fn, // We will not hit local initialize in tests that require promisify behavior
      },
      uuid: { v4: () => 'test-uuid' },
    });
  });

  beforeEach(function () {
    // Reset all mocks before each test
    jest.clearAllMocks();

    if (mockOpenAIClient?.audio?.transcriptions?.create) {
      mockOpenAIClient.audio.transcriptions.create.mockClear();
      mockOpenAIClient.audio.transcriptions.create.mockResolvedValue({
        text: 'test transcription',
        language: 'en',
      });
    }

    if (mockOpenAIClient?.models?.list) {
      mockOpenAIClient.models.list.mockClear();
      mockOpenAIClient.models.list.mockResolvedValue({ data: [] });
    }

    if (mockExec) {
      mockExec.mockClear();
      mockExec.mockImplementation((cmd, cb) =>
        cb(null, { stdout: JSON.stringify({ text: 'test local transcription' }) })
      );
    }

    if (mockFs?.existsSync) {
      mockFs.existsSync.mockClear();
      mockFs.existsSync.mockReturnValue(true);
    }
    if (mockFs?.readFileSync) {
      mockFs.readFileSync.mockClear();
      mockFs.readFileSync.mockReturnValue(Buffer.from([0x00]));
    }
    if (mockFs?.promises?.stat) {
      mockFs.promises.stat.mockClear();
      mockFs.promises.stat.mockResolvedValue({ isFile: () => true, size: 1024 });
    }
  });

  describe('Initialization', function () {
    it('should initialize with API client when useLocal is false', async function () {
      const service = new WhisperSTT({
        apiKey: 'test-api-key',
        useLocal: false,
      });

      // Avoid making real calls inside _initializeAPI by spying and resolving
      const spy = jest.spyOn(service, '_initializeAPI').mockResolvedValue(true);

      await service.initialize();
      expect(spy).toHaveBeenCalled();
      expect(service.isInitialized).toBe(true);
    });

    it('should initialize with local model when useLocal is true', async function () {
      const service = new WhisperSTT({
        useLocal: true,
        localModel: 'base',
        localModelPath: '/path/to/model',
      });

      // Avoid hitting real local init workflow
      const spy = jest.spyOn(service, '_initializeLocal').mockResolvedValue(true);
      // Disable API key requirement for local-only initialization
      service.config.requiresApiKey = false;

      await service.initialize();
      expect(spy).toHaveBeenCalled();
      expect(service.isInitialized).toBe(true);
    });
  });

  describe('Transcription', function () {
    it('should transcribe audio using API', async function () {
      const service = new WhisperSTT({
        apiKey: 'test-api-key',
        useLocal: false,
      });

      // Manually mark initialized to focus on transcribe behavior
      service.isInitialized = true;
      jest.spyOn(service, '_validateInput').mockResolvedValue(true);
      jest
        .spyOn(service, '_transcribeAPI')
        .mockResolvedValue({ text: 'test transcription', language: 'en' });

      const audioPath = '/tmp/audio.wav';
      const result = await service.transcribe(audioPath, { language: 'en' });

      expect(result).toHaveProperty('text', 'test transcription');
    });

    it('should transcribe audio using local model', async function () {
      const service = new WhisperSTT({
        useLocal: true,
        localModel: 'base',
        localModelPath: '/path/to/model',
      });

      // Manually mark initialized to focus on transcribe behavior
      service.isInitialized = true;
      jest.spyOn(service, '_validateInput').mockResolvedValue(true);
      jest
        .spyOn(service, '_transcribeLocal')
        .mockResolvedValue({ text: 'test local transcription', language: 'en' });

      const result = await service.transcribe('/tmp/audio.wav');

      expect(result).toHaveProperty('text', 'test local transcription');
    });

    it('should handle transcription errors', async function () {
      const service = new WhisperSTT({
        apiKey: 'test-api-key',
        useLocal: false,
      });

      // Manually mark initialized to avoid initialize path
      service.isInitialized = true;
      jest.spyOn(service, '_validateInput').mockResolvedValue(true);
      jest
        .spyOn(service, '_transcribeAPI')
        .mockRejectedValue(new Error('Whisper API error: API error'));

      await expect(service.transcribe('/tmp/audio.wav')).rejects.toThrow(/\[whisper\]/i);
    });
  });
});
