class WhisperSTT {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.initialized = false;
  }

  async initialize() {
    this.initialized = true;
    return { success: true };
  }

  async transcribe(audioData, options = {}) {
    if (!this.initialized) {
      throw new Error('Whisper STT not initialized');
    }
    
    // Mock transcription - in a real scenario, this would call the Whisper API
    return {
      text: 'This is a test transcription',
      language: options.language || 'en',
      duration: audioData.duration || 0,
    };
  }
}

// For testing purposes, export a singleton instance
const whisperSTT = new WhisperSTT(process.env.WHISPER_API_KEY);
module.exports = whisperSTT;
