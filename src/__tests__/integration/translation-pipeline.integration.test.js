const { expect } = require('chai');
const sinon = require('sinon');
const proxyquire = require('proxyquire').noCallThru();

// Mock the required modules
const mockWhisper = {
  transcribe: sinon.stub().resolves('Hello, world!'),
};

const mockDeepL = {
  translate: sinon.stub().resolves('¡Hola, mundo!'),
};

// Create a mock for the pipeline using proxyquire
const TranslationPipeline = proxyquire('../../../src/core/translation-pipeline', {
  '../services/stt/whisper': mockWhisper,
  '../services/translation/translation-manager': {
    TranslationManager: class {
      constructor() {
        this.translate = mockDeepL.translate;
      }
    },
  },
  '../services/stt/STTManager': class {
    constructor() {
      this.transcribe = mockWhisper.transcribe;
    }
  },
});

// Import test utilities
const {
  createMockAudioContext,
  createMockMediaStream,
} = require('../../../tests/utils/audio-test-utils');

describe('TranslationPipeline Integration', function () {
  let pipeline;
  let mockAudioContext;
  let mockMediaStream;
  let sandbox;

  beforeEach(function () {
    // Create a sandbox for stubs and mocks
    sandbox = sinon.createSandbox();

    // Create fresh mocks for each test
    mockAudioContext = createMockAudioContext();
    mockMediaStream = createMockMediaStream();

    // Mock the Web Audio API
    global.AudioContext = sandbox.stub().returns(mockAudioContext);

    // Mock the MediaDevices API
    global.navigator = {
      mediaDevices: {
        getUserMedia: sandbox.stub().resolves(mockMediaStream),
      },
    };

    // Initialize the pipeline
    pipeline = new TranslationPipeline({
      sourceLanguage: 'en',
      targetLanguage: 'es',
    });

    // Reset stubs
    mockWhisper.transcribe.reset();
    mockDeepL.translate.reset();
  });

  afterEach(function () {
    // Restore the sandbox
    sandbox.restore();

    // Clean up the pipeline
    if (pipeline && typeof pipeline.stop === 'function') {
      pipeline.stop();
    }

    // Reset mocks
    mockWhisper.transcribe.reset();
    mockDeepL.translate.reset();

    // Clean up global mocks
    delete global.AudioContext;
    delete global.navigator.mediaDevices;
  });

  it('should initialize with default settings', function () {
    expect(pipeline.sourceLanguage).to.equal('en');
    expect(pipeline.targetLanguage).to.equal('es');
    expect(pipeline.isRecording).to.be.false;
  });

  it('should start and stop recording', async function () {
    await pipeline.start();
    expect(pipeline.isRecording).to.be.true;

    await pipeline.stop();
    expect(pipeline.isRecording).to.be.false;
  });

  it('should transcribe and translate audio', async function () {
    await pipeline.start();

    // Simulate audio data
    const audioData = new Float32Array(1024).fill(0);
    const audioBuffer = {
      getChannelData: () => audioData,
      length: audioData.length,
      sampleRate: 16000,
      duration: audioData.length / 16000,
    };

    // Simulate audio processing
    const result = await pipeline.processAudio(audioBuffer);

    expect(result).to.have.property('sourceText', 'Hello, world!');
    expect(result).to.have.property('translatedText', '¡Hola, mundo!');
    expect(result).to.have.property('sourceLanguage', 'en');
    expect(result).to.have.property('targetLanguage', 'es');

    // Verify the mocks were called
    expect(mockWhisper.transcribe).to.have.been.calledOnce;
    expect(mockDeepL.translate).to.have.been.calledOnce;

    await pipeline.stop();
  });

  it('should handle errors during processing', async function () {
    const error = new Error('Transcription failed');
    const consoleErrorStub = sandbox.stub(console, 'error');

    // Make the transcription fail
    mockWhisper.transcribe.rejects(error);

    await pipeline.start();

    const audioBuffer = {
      getChannelData: () => new Float32Array(1024).fill(0),
      length: 1024,
      sampleRate: 16000,
      duration: 1024 / 16000,
    };

    await expect(pipeline.processAudio(audioBuffer)).to.be.rejectedWith('Transcription failed');
    await pipeline.stop();

    // Verify error was logged
    expect(consoleErrorStub).to.have.been.calledWith(
      'Error in translation pipeline:',
      sinon.match.instanceOf(Error)
    );
  });
});
