const { EventEmitter } = require('events');

class MockTranslationPipeline extends EventEmitter {
  constructor() {
    super();
    this.isActive = false;
    this.sourceLanguage = 'en';
    this.targetLanguage = 'es';
    this.audioQueue = [];
    this.processing = false;
  }

  async processAudio(audioBuffer, sourceLang, targetLang) {
    try {
      this.sourceLanguage = sourceLang || this.sourceLanguage;
      this.targetLanguage = targetLang || this.targetLanguage;
      
      // Simulate processing time
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Mock the processing result
      const result = {
        sourceText: 'Hello',
        translatedText: 'Hola',
        sourceLanguage: this.sourceLanguage,
        targetLanguage: this.targetLanguage,
        audioBuffer: Buffer.from('mock-audio-data'),
        timestamp: new Date().toISOString(),
        confidence: 0.95,
      };
      
      this.emit('translation', result);
      return result;
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  start() {
    this.isActive = true;
    this.emit('start');
  }

  stop() {
    this.isActive = false;
    this.emit('stop');
  }

  setSourceLanguage(lang) {
    this.sourceLanguage = lang;
  }

  setTargetLanguage(lang) {
    this.targetLanguage = lang;
  }
}

module.exports = MockTranslationPipeline;
