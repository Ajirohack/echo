// Mock the translation service implementation first
const mockTranslate = jest.fn().mockImplementation((text, sourceLang, targetLang) => {
  return Promise.resolve(`Translated from ${sourceLang} to ${targetLang}: ${text}`);
});

const mockDetectLanguage = jest.fn().mockResolvedValue({
  language: 'en',
  score: 0.95
});

const mockGetSupportedLanguages = jest.fn().mockResolvedValue([
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Spanish' },
  { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' }
]);

// Mock the TranslationService class
class MockTranslationService {
  constructor() {
    this.translate = mockTranslate;
    this.detectLanguage = mockDetectLanguage;
    this.getSupportedLanguages = mockGetSupportedLanguages;
  }
}

// Replace the actual TranslationService with our mock
jest.mock('../../../src/services/translation/translation-service.js', () => MockTranslationService);

// Now import the module we're testing after setting up the mock
const TranslationPipeline = require('../../../src/services/translation/TranslationPipeline');
const { generateAudioBuffer, createMockMediaStream, createMockAudioContext } = require('../../utils/audio-test-utils');

describe('TranslationPipeline', () => {
  let pipeline;
  let mockAudioContext;
  let mockMediaStream;
  let mockTranslationService;
  let mockSTTService;
  
  const mockTranscription = 'Hello world';
  const mockTranslation = 'Hola mundo';
  
  beforeEach(() => {
    // Create fresh mocks for each test
    mockAudioContext = createMockAudioContext();
    mockMediaStream = createMockMediaStream();
    
    // Create mock services
    mockTranslationService = new MockTranslationService();
    mockSTTService = {
      transcribe: jest.fn().mockResolvedValue({
        text: mockTranscription,
        language: 'en'
      })
    };
    
    // Initialize the pipeline with mock services
    pipeline = new TranslationPipeline({
      sourceLanguage: 'en',
      targetLanguage: 'es',
      translationService: mockTranslationService,
      sttService: mockSTTService,
      audioContext: mockAudioContext,
    });
    
    // Mock the MediaRecorder
    global.MediaRecorder = jest.fn().mockImplementation(() => ({
      start: jest.fn(),
      stop: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      state: 'inactive',
      stream: mockMediaStream,
    }));
    
    // Mock the browser APIs
    global.navigator.mediaDevices = {
      getUserMedia: jest.fn().mockResolvedValue(mockMediaStream),
    };
    
    // Mock the AudioContext
    global.AudioContext = jest.fn().mockImplementation(() => mockAudioContext);
  });
  
  afterEach(() => {
    jest.clearAllMocks();
    delete global.MediaRecorder;
    delete global.navigator.mediaDevices;
    delete global.AudioContext;
  });
  
  test('should initialize with default settings', () => {
    expect(pipeline.sourceLanguage).toBe('en');
    expect(pipeline.targetLanguage).toBe('es');
    expect(pipeline.isProcessing).toBe(false);
  });
  
  test('should start and stop recording', async () => {
    // Create a mock MediaRecorder with proper event handling
    const mockTracks = [{ stop: jest.fn() }];
    const mockStream = { getTracks: () => mockTracks };
    
    // Track if stop was called
    let stopCalled = false;
    
    // Create a mock MediaRecorder instance
    const mockRecorder = {
      start: jest.fn().mockImplementation(function() {
        this.state = 'recording';
      }),
      stop: jest.fn().mockImplementation(function() {
        if (this.state !== 'inactive') {
          this.state = 'inactive';
          stopCalled = true;
          // Call the onstop handler if it exists
          if (typeof this.onstop === 'function') {
            this.onstop();
          }
        }
      }),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      state: 'inactive',
      stream: mockStream,
      onstop: null,
      requestData: jest.fn()
    };
    
    // Mock the MediaRecorder constructor
    global.MediaRecorder = jest.fn().mockImplementation(() => mockRecorder);
    
    // Mock the audio context
    const mockAudioContext = {
      close: jest.fn().mockResolvedValue(undefined),
      state: 'running',
      suspend: jest.fn().mockResolvedValue(undefined),
      resume: jest.fn().mockResolvedValue(undefined),
      createMediaStreamSource: jest.fn().mockReturnValue({
        connect: jest.fn(),
        disconnect: jest.fn()
      }),
      destination: {
        connect: jest.fn(),
        disconnect: jest.fn()
      }
    };
    global.AudioContext = jest.fn().mockImplementation(() => mockAudioContext);
    
    // Create a new pipeline with our mocks
    const pipeline = new TranslationPipeline({
      sourceLanguage: 'en',
      targetLanguage: 'es',
      translationService: mockTranslationService,
      sttService: mockSTTService
    });
    
    // Mock getUserMedia
    global.navigator.mediaDevices = {
      getUserMedia: jest.fn().mockResolvedValue(mockStream)
    };
    
    // Start recording
    await pipeline.start();
    expect(pipeline.isProcessing).toBe(true);
    expect(mockRecorder.start).toHaveBeenCalled();
    
    // Verify the MediaRecorder was set up with the stream
    expect(MediaRecorder).toHaveBeenCalledWith(expect.any(Object));
    
    // Simulate some audio data being recorded
    const mockAudioBlob = new Blob(['audio data'], { type: 'audio/wav' });
    pipeline.audioChunks = [mockAudioBlob];
    
    // Stop recording
    await pipeline.stop();
    
    // Verify recording was stopped and cleaned up
    expect(pipeline.isProcessing).toBe(false);
    expect(mockRecorder.stop).toHaveBeenCalled();
    expect(mockTracks[0].stop).toHaveBeenCalled();
    expect(mockAudioContext.close).toHaveBeenCalled();
    
    // Verify event listeners were cleaned up
    expect(mockRecorder.removeEventListener).toHaveBeenCalled();
  });
  
  test('should process audio and emit transcription', async () => {
    // Mock the audio data
    const mockAudioBlob = new Blob(['audio data'], { type: 'audio/wav' });
    
    // Setup mock STT service
    const mockTranscription = {
      text: 'This is a test transcription',
      language: 'en',
      confidence: 0.9
    };
    
    mockSTTService.transcribe.mockResolvedValue(mockTranscription);
    
    // Listen for transcription event
    const transcriptionPromise = new Promise((resolve) => {
      pipeline.on('transcription', resolve);
    });
    
    // Simulate audio data available
    const dataAvailableEvent = { data: mockAudioBlob };
    
    // Set audio chunks
    pipeline.audioChunks = [mockAudioBlob];
    
    // Trigger the event handlers
    pipeline.handleDataAvailable(dataAvailableEvent);
    await pipeline.handleStop();
    
    // Wait for the transcription
    const result = await transcriptionPromise;
    
    // Verify the transcription
    expect(mockSTTService.transcribe).toHaveBeenCalled();
    expect(mockSTTService.transcribe.mock.calls[0][0]).toBeInstanceOf(Blob);
    expect(result).toEqual(mockTranscription);
  });
  
  test('should translate text and emit translation', async () => {
    const sourceText = 'Hello';
    const translatedText = 'Hola';
    
    // Mock the translation service
    mockTranslationService.translate.mockResolvedValue(translatedText);
    
    // Listen for translation event
    const translationPromise = new Promise((resolve) => {
      pipeline.on('translation', resolve);
    });
    
    // Process translation
    await pipeline.translateText(sourceText, 'en', 'es');
    
    // Wait for async operations and verify the translation
    const result = await translationPromise;
    expect(mockTranslationService.translate).toHaveBeenCalledWith(sourceText, 'en', 'es');
    // Check that the result contains the expected translation
    expect(result.translatedText).toBe(translatedText);
    expect(result.originalText).toBe(sourceText);
    expect(result.sourceLanguage).toBe('en');
    expect(result.targetLanguage).toBe('es');
  });
  
  test('should handle audio processing errors', async () => {
    const error = new Error('Audio processing failed');
    
    // Mock the STT service to throw an error
    mockSTTService.transcribe.mockRejectedValueOnce(error);
    
    // Listen for errors
    const errorPromise = new Promise((resolve) => {
      pipeline.on('error', resolve);
    });
    
    // Simulate audio processing
    const mockAudioBlob = new Blob(['audio data'], { type: 'audio/wav' });
    const dataAvailableEvent = { data: mockAudioBlob };
    
    pipeline.handleDataAvailable(dataAvailableEvent);
    pipeline.handleStop();
    
    // Verify the error was emitted
    const emittedError = await errorPromise;
    expect(emittedError).toBe(error);
  });
  
  test('should handle translation errors', async () => {
    const error = new Error('Translation failed');
    
    // Mock the translation service to throw an error
    mockTranslationService.translate.mockRejectedValueOnce(error);
    
    // Listen for errors
    const errorPromise = new Promise((resolve) => {
      pipeline.on('error', resolve);
    });
    
    // Attempt translation and verify it rejects
    await expect(pipeline.translateText('Hello', 'en', 'es')).rejects.toThrow(error);
    
    // Verify the error was emitted
    const emittedError = await errorPromise;
    expect(emittedError).toBe(error);
  });
  
  test('should update source and target languages', () => {
    // Change languages using the updateLanguages method
    pipeline.updateLanguages({ sourceLanguage: 'fr', targetLanguage: 'de' });
    
    // Verify updates
    expect(pipeline.sourceLanguage).toBe('fr');
    expect(pipeline.targetLanguage).toBe('de');
  });
  
  test('should get available languages', async () => {
    // Mock the supported languages
    const mockLanguages = [
      { code: 'en', name: 'English' },
      { code: 'es', name: 'Spanish' },
      { code: 'fr', name: 'French' },
      { code: 'de', name: 'German' }
    ];
    
    mockTranslationService.getSupportedLanguages.mockResolvedValue(mockLanguages);
    
    // Get available languages through the translation service
    const languages = await mockTranslationService.getSupportedLanguages();
    
    // Verify we got an array of languages
    expect(Array.isArray(languages)).toBe(true);
    expect(languages.length).toBeGreaterThan(0);
    expect(languages[0]).toHaveProperty('code');
    expect(languages[0]).toHaveProperty('name');
  });
});
