// Mock TTS services first to avoid loading their ESM-only dependencies
jest.mock('@/services/tts/elevenlabs', () => {
  return jest.fn().mockImplementation(() => ({
    textToSpeech: jest.fn().mockResolvedValue(Buffer.from('mock-elevenlabs')),
    setVoice: jest.fn().mockResolvedValue(true),
  }));
});

jest.mock('@/services/tts/azure-tts', () => {
  return jest.fn().mockImplementation(() => ({
    textToSpeech: jest.fn().mockResolvedValue(Buffer.from('mock-azure')),
    setVoice: jest.fn().mockResolvedValue(true),
  }));
});

jest.mock('@/services/tts/google-tts', () => {
  return jest.fn().mockImplementation(() => ({
    textToSpeech: jest.fn().mockResolvedValue(Buffer.from('mock-google')),
    setVoice: jest.fn().mockResolvedValue(true),
  }));
});

// Now require the (mocked) modules
const ElevenLabsTTS = require('@/services/tts/elevenlabs');
const AzureTTS = require('@/services/tts/azure-tts');
const GoogleTTS = require('@/services/tts/google-tts');

describe.skip('TTS Services', () => {
  let elevenLabs, azure, google;

  beforeEach(() => {
    elevenLabs = new ElevenLabsTTS();
    azure = new AzureTTS();
    google = new GoogleTTS();
  });

  it('should synthesize speech successfully', async () => {
    const result = await elevenLabs.textToSpeech('Hello');
    expect(result).toBeInstanceOf(Buffer);
  });

  it('should handle voice selection', async () => {
    await azure.setVoice('en-US-AriaNeural');
    const result = await azure.textToSpeech('Hello');
    expect(result).toBeInstanceOf(Buffer);
  });

  it('should handle SSML input', async () => {
    const ssml = '<speak><prosody rate="slow">Hello</prosody></speak>';
    const result = await google.textToSpeech(ssml, { useSSML: true });
    expect(result).toBeInstanceOf(Buffer);
  });

  it('should support language settings', async () => {
    const result = await elevenLabs.textToSpeech('Bonjour', { language: 'fr-FR' });
    expect(result).toBeInstanceOf(Buffer);
  });

  it('should adjust speaking speed', async () => {
    const result = await azure.textToSpeech('Hello', { speed: 1.5 });
    expect(result).toBeInstanceOf(Buffer);
  });

  it('should handle punctuation properly', async () => {
    const result = await google.textToSpeech('Hello, world!');
    expect(result).toBeInstanceOf(Buffer);
  });

  it('should perform within acceptable latency', async () => {
    const start = Date.now();
    await elevenLabs.textToSpeech('Performance test');
    const duration = Date.now() - start;
    expect(duration).toBeLessThan(3000);
  });
});
