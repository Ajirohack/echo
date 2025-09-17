// Jest setup file
import '@testing-library/jest-dom';

// Set up test environment
process.env.NODE_ENV = 'test';
process.env.TEST_ENV = 'unit';

// Global test timeout
jest.setTimeout(10000);

// Mock external services
jest.mock('@google-cloud/speech', () => ({
  SpeechClient: jest.fn().mockImplementation(() => ({
    initialize: jest.fn().mockResolvedValue(undefined),
    recognize: jest.fn().mockResolvedValue([{ results: [] }]),
  })),
}));

jest.mock('@google-cloud/translate', () => ({
  TranslationServiceClient: jest.fn().mockImplementation(() => ({
    initialize: jest.fn().mockResolvedValue(undefined),
    translateText: jest.fn().mockResolvedValue([{ translations: [] }]),
    detectLanguage: jest.fn().mockResolvedValue([{ languages: [] }]),
  })),
}));

jest.mock('@google-cloud/text-to-speech', () => ({
  TextToSpeechClient: jest.fn().mockImplementation(() => ({
    initialize: jest.fn().mockResolvedValue(undefined),
    synthesizeSpeech: jest.fn().mockResolvedValue([{ audioContent: Buffer.alloc(0) }]),
  })),
}));

jest.mock('openai', () => ({
  OpenAI: jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn().mockResolvedValue({
          choices: [{ message: { content: 'Mocked translation' } }],
        }),
      },
    },
  })),
}));

jest.mock('deepl-node', () => ({
  Translator: jest.fn().mockImplementation(() => ({
    translateText: jest.fn().mockResolvedValue({ text: 'Mocked translation' }),
    getUsage: jest.fn().mockResolvedValue({ character: { count: 0, limit: 500000 } }),
  })),
}));

jest.mock('elevenlabs', () => ({
  ElevenLabsApi: jest.fn().mockImplementation(() => ({
    textToSpeech: jest.fn().mockResolvedValue(Buffer.alloc(0)),
  })),
}));

// Mock Electron APIs
global.window = {
  electronAPI: {
    getAudioDevices: jest.fn().mockResolvedValue({ input: [], output: [] }),
    startRecording: jest.fn().mockResolvedValue(undefined),
    stopRecording: jest.fn().mockResolvedValue(undefined),
    playAudio: jest.fn().mockResolvedValue(undefined),
    stopAudio: jest.fn().mockResolvedValue(undefined),
  },
};

// Globally mock the app logger to avoid filesystem/electron access in tests
const fs = require('fs');
const path = require('path');
const loggerPath = path.resolve(__dirname, 'utils/logger.js');
jest.mock(loggerPath, () => ({
  log: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

// Create config directory and files if they don't exist

const configDir = path.join(__dirname, 'config');
if (!fs.existsSync(configDir)) {
  fs.mkdirSync(configDir, { recursive: true });
}

const langPairsPath = path.join(configDir, 'language-pairs.json');
if (!fs.existsSync(langPairsPath)) {
  const defaultConfig = {
    languagePairs: [
      {
        source: 'en',
        target: 'es',
        services: {
          deepl: { quality: 0.95, speed: 0.85, cost: 0.7 },
          gpt4o: { quality: 0.93, speed: 0.6, cost: 0.4 },
          google: { quality: 0.85, speed: 0.9, cost: 0.8 },
          azure: { quality: 0.87, speed: 0.8, cost: 0.75 },
        },
      },
    ],
    defaultServiceRanking: {
      quality: ['deepl', 'gpt4o', 'azure', 'google'],
      speed: ['google', 'azure', 'deepl', 'gpt4o'],
      cost: ['google', 'azure', 'deepl', 'gpt4o'],
      context: ['gpt4o', 'deepl', 'azure', 'google'],
    },
    europeanLanguages: ['en', 'fr', 'de', 'es', 'it'],
    asianLanguages: ['ja', 'zh', 'ko'],
    adaptationLanguages: ['ja', 'zh', 'ko', 'ar', 'ru'],
  };
  fs.writeFileSync(langPairsPath, JSON.stringify(defaultConfig, null, 2));
}

// Global test utilities
global.expectRejection = async (promise, errorType = Error, message = '') => {
  try {
    await promise;
    throw new Error(
      `Expected promise to reject with ${errorType.name}${message ? `: ${message}` : ''}`
    );
  } catch (error) {
    if (!(error instanceof errorType)) {
      throw new Error(
        `Expected error to be instance of ${errorType.name}, got ${error.constructor.name}`
      );
    }
    if (message && !error.message.includes(message)) {
      throw new Error(`Expected error message to contain "${message}", got "${error.message}"`);
    }
    return error;
  }
};

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
});
