// Import required testing libraries
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const sinon = require('sinon');
const sinonChai = require('sinon-chai');
const path = require('path');
const fs = require('fs');

// Configure Chai
const { expect, assert } = chai;

// Add plugins
chai.use(chaiAsPromised);
chai.use(sinonChai);

// Make Chai plugins available globally
global.expect = expect;
global.assert = assert;

// Configure test environment
process.env.NODE_ENV = 'test';

// Set up test environment variables
process.env.NODE_ENV = 'test';
process.env.TEST_ENV = 'unit';

// Create a logger mock for tests
const loggerMock = {
  error: sinon.stub(),
  warn: sinon.stub(),
  info: sinon.stub(),
  debug: sinon.stub(),
  log: sinon.stub()
};

// Setup mocks for external services
const setupMocks = () => {
  // Mock external dependencies
  const mockDependencies = {
    '@google-cloud/speech': {
      SpeechClient: class MockSpeechClient {
        constructor() { this.initialize = sinon.stub().resolves(); }
        recognize() { return Promise.resolve([{ results: [] }]); }
      }
    },
    '@google-cloud/translate': {
      TranslationServiceClient: class MockTranslationClient {
        constructor() { this.initialize = sinon.stub().resolves(); }
        translateText() { return Promise.resolve([{ translations: [] }]); }
        detectLanguage() { return Promise.resolve([{ languages: [] }]); }
      }
    },
    '@azure/ai-speech-speech': {
      SpeechConfig: class MockSpeechConfig {
        static fromSubscription() { return new MockSpeechConfig(); }
      },
      AudioConfig: class MockAudioConfig {
        static fromWavFileInput() { return new MockAudioConfig(); }
      },
      SpeechRecognizer: class MockSpeechRecognizer {
        constructor() { }
        recognizeOnceAsync() { return Promise.resolve({ text: 'mock text' }); }
      }
    },
    'openai': {
      OpenAI: class MockOpenAI {
        constructor() { }
        audio = {
          transcriptions: {
            create: () => Promise.resolve({ text: 'mock transcription' })
          }
        }
        chat = {
          completions: {
            create: () => Promise.resolve({ choices: [{ message: { content: 'mock translation' } }] })
          }
        }
      }
    }
  };

  // Add mocks to require cache
  Object.entries(mockDependencies).forEach(([moduleName, mockImplementation]) => {
    try {
      require.cache[require.resolve(moduleName)] = {
        id: require.resolve(moduleName),
        filename: require.resolve(moduleName),
        loaded: true,
        exports: mockImplementation
      };
    } catch (err) {
      // Module not found, which is fine in test context
    }
  });

  // Add logger mock to require cache
  try {
    require.cache[require.resolve('../src/utils/logger')] = {
      id: require.resolve('../src/utils/logger'),
      filename: require.resolve('../src/utils/logger'),
      loaded: true,
      exports: loggerMock
    };
  } catch (err) {
    // Module not found, which is fine in test context
  }
};

// Setup mocks
setupMocks();

// Create config directory if it doesn't exist
const configDir = path.join(__dirname, '../src/config');
if (!fs.existsSync(configDir)) {
  fs.mkdirSync(configDir, { recursive: true });
}

// Create language-pairs.json if it doesn't exist
const langPairsPath = path.join(configDir, 'language-pairs.json');
if (!fs.existsSync(langPairsPath)) {
  const defaultConfig = {
    "languagePairs": [
      {
        "source": "en",
        "target": "es",
        "services": {
          "deepl": { "quality": 0.95, "speed": 0.85, "cost": 0.7 },
          "gpt4o": { "quality": 0.93, "speed": 0.6, "cost": 0.4 },
          "google": { "quality": 0.85, "speed": 0.9, "cost": 0.8 },
          "azure": { "quality": 0.87, "speed": 0.8, "cost": 0.75 }
        }
      }
    ],
    "defaultServiceRanking": {
      "quality": ["deepl", "gpt4o", "azure", "google"],
      "speed": ["google", "azure", "deepl", "gpt4o"],
      "cost": ["google", "azure", "deepl", "gpt4o"],
      "context": ["gpt4o", "deepl", "azure", "google"]
    },
    "europeanLanguages": ["en", "fr", "de", "es", "it"],
    "asianLanguages": ["ja", "zh", "ko"],
    "adaptationLanguages": ["ja", "zh", "ko", "ar", "ru"]
  };
  fs.writeFileSync(langPairsPath, JSON.stringify(defaultConfig, null, 2));
}

// Configure test timeouts
const TEST_TIMEOUT = process.env.CI ? 30000 : 10000;

// Make sure we have the global mocha functions available
const mochaHooks = {
  before() {
    // Set global test timeout
    this.timeout(process.env.CI ? 30000 : 10000);
  },
  beforeEach() {
    // Initialize sinon sandbox for each test
    this.sandbox = sinon.createSandbox();

    // Make sandbox available globally for tests that need it
    global.sandbox = this.sandbox;
  },

  afterEach() {
    // Clean up sandbox after each test
    if (this.sandbox) {
      this.sandbox.restore();
    }

    // Clean up global sandbox reference
    if (global.sandbox) {
      delete global.sandbox;
    }
  }
};

// Export the hooks
exports.mochaHooks = mochaHooks;

// Helper function for testing async/await errors
const expectRejection = async (promise, errorType = Error, message = '') => {
  try {
    await promise;
    throw new Error('Expected promise to reject but it resolved');
  } catch (error) {
    if (error.message === 'Expected promise to reject but it resolved') {
      throw error;
    }
    expect(error).to.be.an.instanceOf(errorType);
    if (message) {
      expect(error.message).to.include(message);
    }
    return error;
  }
};

// Make helper available globally
global.expectRejection = expectRejection;
