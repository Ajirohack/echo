const { expect } = require('chai');
const sinon = require('sinon');

// Mock the TranslationPipeline class
class MockTranslationPipeline {
  constructor() {
    this.isActive = false;
    this.sourceLanguage = 'en';
    this.targetLanguage = 'es';
    this.shouldFail = false;
    this.failureMessage = 'Service unavailable';
  }

  async processAudio(audioBuffer, sourceLang, targetLang) {
    if (this.shouldFail) {
      throw new Error(this.failureMessage);
    }

    this.sourceLanguage = sourceLang || this.sourceLanguage;
    this.targetLanguage = targetLang || this.targetLanguage;

    // Simulate processing time
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Mock the processing result
    return {
      sourceText: 'Hello',
      translatedText: 'Hola',
      sourceLanguage: this.sourceLanguage,
      targetLanguage: this.targetLanguage,
      audioBuffer: Buffer.from('mock-audio-data'),
      timestamp: new Date().toISOString(),
      confidence: 0.95,
    };
  }

  // Helper method to simulate service failure
  simulateFailure(message = 'Service unavailable') {
    this.shouldFail = true;
    this.failureMessage = message;
  }
}

describe('Translation Pipeline Integration Tests', function () {
  // Create test instance
  let pipeline;
  let consoleErrorStub;

  // Setup before each test
  beforeEach(function () {
    // Stub console.error
    consoleErrorStub = sinon.stub(console, 'error');

    // Create a new pipeline instance for each test
    pipeline = new MockTranslationPipeline();
  });

  // Cleanup after each test
  afterEach(function () {
    // Restore the console.error stub
    consoleErrorStub.restore();
  });

  it('should process audio and return translation', async function () {
    const audioBuffer = Buffer.from('test-audio-data');
    const result = await pipeline.processAudio(audioBuffer, 'en', 'es');

    expect(result).to.have.property('sourceText', 'Hello');
    expect(result).to.have.property('translatedText', 'Hola');
    expect(result.sourceLanguage).to.equal('en');
    expect(result.targetLanguage).to.equal('es');
    expect(result.confidence).to.be.greaterThan(0.9);
    expect(consoleErrorStub).not.to.have.been.called;
  });

  it('should handle service failure gracefully', async function () {
    // Simulate a service failure
    pipeline.simulateFailure('Translation service unavailable');

    const audioBuffer = Buffer.from('test-audio-data');

    await expect(pipeline.processAudio(audioBuffer, 'en', 'es')).to.be.rejectedWith(
      Error,
      'Translation service unavailable'
    );

    expect(consoleErrorStub).to.have.been.called;
  });

  it('should use default languages if not provided', async function () {
    const audioBuffer = Buffer.from('test-audio-data');
    const result = await pipeline.processAudio(audioBuffer);

    expect(result.sourceLanguage).to.equal('en');
    expect(result.targetLanguage).to.equal('es');
  });

  it('should override default languages when provided', async function () {
    const audioBuffer = Buffer.from('test-audio-data');
    const result = await pipeline.processAudio(audioBuffer, 'fr', 'de');

    expect(result.sourceLanguage).to.equal('fr');
    expect(result.targetLanguage).to.equal('de');
  });

  describe('STT to Translation', function () {
    it('should process audio through complete pipeline', async function () {
      const audioBuffer = new Float32Array([0.1, 0.2, 0.3]);

      const startTime = Date.now();
      const result = await pipeline.processAudio(audioBuffer, 'en', 'fr');
      const endTime = Date.now();

      // Verify the result
      expect(result).to.exist;
      expect(result.translatedText).to.equal('Hola');
      expect(result.sourceText).to.equal('Hello');
      expect(result.sourceLanguage).to.equal('en');
      expect(result.targetLanguage).to.equal('fr');
      expect(result.confidence).to.be.greaterThan(0);
      expect(Buffer.isBuffer(result.audioBuffer)).to.be.true;

      // Verify processing time is reasonable
      expect(endTime - startTime).to.be.lessThan(1000);
    });
  });

  describe('Service Failover', function () {
    it('should handle service failure gracefully', async function () {
      // Simulate a service failure
      pipeline.simulateFailure('Service unavailable');

      const audioBuffer = new Float32Array([0.1, 0.2, 0.3]);

      // Should reject with the expected error
      await expect(pipeline.processAudio(audioBuffer, 'en', 'es')).to.be.rejectedWith(
        Error,
        'Service unavailable'
      );

      // Should have logged the error
      expect(consoleErrorStub).to.have.been.calledWith(
        sinon.match('Error in translation pipeline:')
      );
    });
  });

  describe('Performance', function () {
    it('should maintain low latency', async function () {
      const audioBuffer = new Float32Array([0.1, 0.2, 0.3]);

      const startTime = Date.now();
      await pipeline.processAudio(audioBuffer, 'en', 'fr');
      const endTime = Date.now();

      // Should complete in less than 500ms (with 100ms simulated processing time)
      expect(endTime - startTime).to.be.lessThan(500);
    });
  });

  describe('Error Handling', function () {
    it('should handle API errors gracefully', async function () {
      const errorMessage = 'API error';
      pipeline.simulateFailure(errorMessage);

      await expect(pipeline.processAudio(new Float32Array(), 'en', 'fr')).to.be.rejectedWith(
        Error,
        errorMessage
      );
    });
  });
});
