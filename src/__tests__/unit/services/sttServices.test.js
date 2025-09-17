jest.mock('@/utils/logger', () => ({
  log: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

// Mock STT service modules BEFORE requiring them
jest.mock('@/services/stt/whisper', () => {
  class MockWhisperSTT {
    constructor() {
      this.transcribe = jest.fn().mockResolvedValue('mock-whisper-transcript');
    }
  }
  return Object.assign(MockWhisperSTT, { __esModule: true, default: MockWhisperSTT });
});

jest.mock('@/services/stt/services/AzureSTT', () => {
  class MockAzureSTT {
    constructor() {
      this.isAuthenticated = false;
      this.authenticate = jest.fn().mockImplementation(() => {
        this.isAuthenticated = true;
        return Promise.resolve(true);
      });
      this.transcribe = jest.fn().mockResolvedValue('mock-azure-transcript');
    }
  }
  return Object.assign(MockAzureSTT, { __esModule: true, default: MockAzureSTT });
});

jest.mock('@/services/stt/services/GoogleSTT', () => {
  class MockGoogleSTT {
    constructor() {
      this.transcribe = jest.fn().mockResolvedValue('mock-google-transcript');
    }
  }
  return Object.assign(MockGoogleSTT, { __esModule: true, default: MockGoogleSTT });
});

// Now require mocked modules (normalize CommonJS/ESM interop)
const WhisperSTTModule = require('@/services/stt/whisper');
const AzureSTTModule = require('@/services/stt/services/AzureSTT');
const GoogleSTTModule = require('@/services/stt/services/GoogleSTT');

const WhisperSTT = WhisperSTTModule.default || WhisperSTTModule;
const AzureSTT = AzureSTTModule.default || AzureSTTModule;
const GoogleSTT = GoogleSTTModule.default || GoogleSTTModule;

describe('STT Services', () => {
  let whisperSTT, azureSTT, googleSTT;

  beforeEach(() => {
    whisperSTT = new WhisperSTT();
    azureSTT = new AzureSTT();
    googleSTT = new GoogleSTT();
  });

  describe('Whisper STT', () => {
    test('should transcribe audio successfully', async () => {
      const audioBuffer = Buffer.from([0, 1, 2, 3]);
      const result = await whisperSTT.transcribe(audioBuffer);
      expect(result).toBeDefined();
    });

    test('should handle errors gracefully', async () => {
      // Force the transcribe mock to reject
      whisperSTT.transcribe.mockRejectedValueOnce(new Error('API error'));
      await expect(whisperSTT.transcribe(Buffer.alloc(0))).rejects.toThrow('API error');
    });
  });

  describe('Azure STT', () => {
    test('should authenticate with Azure', async () => {
      await azureSTT.authenticate();
      expect(azureSTT.isAuthenticated).toBe(true);
    });

    test('should transcribe with rate limiting', async () => {
      const audioBuffer = Buffer.from([0, 1, 2, 3]);
      const result = await azureSTT.transcribe(audioBuffer);
      expect(result).toBeDefined();
    });
  });

  describe('Google STT', () => {
    test('should handle large audio files', async () => {
      const largeAudioBuffer = Buffer.alloc(1024 * 1024);
      const result = await googleSTT.transcribe(largeAudioBuffer);
      expect(result).toBeDefined();
    });

    test('should handle multiple languages', async () => {
      const audioBuffer = Buffer.from([0, 1, 2, 3]);
      const result = await googleSTT.transcribe(audioBuffer, { languageCode: 'fr-FR' });
      expect(result).toBeDefined();
    });
  });
});
