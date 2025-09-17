jest.mock('@/services/translation/translation-service.js');
const TranslationPipeline = require('@/services/translation/TranslationPipeline');

const {
  createMockMediaStream,
  createMockAudioContext,
} = require('../../../../tests/utils/audio-test-utils');

// Provide minimal browser APIs used by the pipeline
beforeAll(() => {
  global.navigator = global.navigator || {};
  global.navigator.mediaDevices = {
    getUserMedia: jest.fn().mockResolvedValue(createMockMediaStream()),
  };

  global.MediaRecorder = class {
    constructor(stream) {
      this.stream = stream;
      this.ondataavailable = null;
      this.onstop = null;
      this._state = 'inactive';
    }
    get state() {
      return this._state;
    }
    start() {
      this._state = 'recording';
    }
    stop() {
      if (this._state !== 'inactive') {
        this._state = 'inactive';
        if (this.ondataavailable) {
          const blob = new Blob([new Uint8Array([1, 2, 3])], { type: 'audio/wav' });
          this.ondataavailable({ data: blob });
        }
        if (this.onstop) this.onstop();
      }
    }
  };

  global.window = global.window || {};
  global.window.AudioContext = class {
    constructor() {
      this.state = 'running';
    }
    close() {
      return Promise.resolve();
    }
  };
  global.window.webkitAudioContext = global.window.AudioContext;
});

describe('TranslationPipeline', () => {
  let pipeline;
  let mockTranslationService;

  beforeEach(() => {
    mockTranslationService = {
      translate: jest.fn().mockResolvedValue('translated: hello'),
    };

    pipeline = new TranslationPipeline({
      translationService: mockTranslationService,
      sttService: { transcribe: jest.fn().mockResolvedValue({ text: 'hello' }) },
    });
  });

  test('should handle start/stop recording sequence', async () => {
    const audioContext = createMockAudioContext();
    const mediaStream = createMockMediaStream();

    await pipeline.start();
    await pipeline.stop();

    expect(pipeline.isProcessing).toBe(false);
  });

  test('should process recorded audio and translate text end-to-end', async () => {
    const events = [];
    pipeline.on('translation', (payload) => events.push(['translation', payload]));

    await pipeline.start();
    await pipeline.stop();

    // The stt mock returns 'hello', so translation should be invoked with it
    expect(mockTranslationService.translate).toHaveBeenCalledWith('hello', 'en', 'es');
  });
});
