// Simple debug test to check mock hoisting

console.log('=== Test file loading ===');

// Mock STT Manager
jest.mock('../services/stt/STTManager', () => {
  console.log('=== STTManager mock factory called ===');
  const mockSTTManager = {
    initialize: jest.fn().mockImplementation(() => {
      console.log('=== STT initialize called ===');
      mockSTTManager.isInitialized = true;
      return Promise.resolve({ success: true });
    }),
    destroy: jest.fn(),
    on: jest.fn(),
    emit: jest.fn(),
    isInitialized: false,
  };

  return function STTManagerMock() {
    console.log('=== STTManager constructor called ===');
    return mockSTTManager;
  };
});

// Mock Translation Manager
jest.mock('../services/translation/translation-manager', () => {
  console.log('=== TranslationManager mock factory called ===');
  const mockTranslationManager = {
    initialize: jest.fn().mockImplementation(() => {
      console.log('=== Translation initialize called ===');
      mockTranslationManager.isInitialized = true;
      return Promise.resolve({ success: true });
    }),
    destroy: jest.fn(),
    on: jest.fn(),
    emit: jest.fn(),
    getSupportedLanguagePairs: jest.fn().mockResolvedValue([]),
    isInitialized: false,
  };

  return function TranslationManagerMock() {
    console.log('=== TranslationManager constructor called ===');
    return mockTranslationManager;
  };
});

console.log('=== About to import TranslationPipeline ===');
const TranslationPipeline = require('../core/translation-pipeline');
console.log('=== TranslationPipeline imported ===');

describe('Simple Mock Test', () => {
  test('should create pipeline and check mocks', () => {
    console.log('=== Creating pipeline ===');
    const pipeline = new TranslationPipeline({
      enableSTT: true,
      enableTranslation: true,
      enableTTS: false,
    });

    console.log('=== Pipeline created ===');
    console.log('STT Manager type:', typeof pipeline.sttManager);
    console.log('Translation Manager type:', typeof pipeline.translationManager);
    console.log('STT Manager initialize type:', typeof pipeline.sttManager.initialize);
    console.log(
      'Translation Manager initialize type:',
      typeof pipeline.translationManager.initialize
    );

    expect(pipeline.sttManager).toBeDefined();
    expect(pipeline.translationManager).toBeDefined();
    expect(typeof pipeline.sttManager.initialize).toBe('function');
    expect(typeof pipeline.translationManager.initialize).toBe('function');
  });
});
