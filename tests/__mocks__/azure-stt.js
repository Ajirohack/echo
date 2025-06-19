class AzureSTT {
  constructor(apiKey, region = 'eastus') {
    this.apiKey = apiKey;
    this.region = region;
    this.initialized = false;
  }

  async initialize() {
    this.initialized = true;
    return { success: true };
  }

  async transcribe(audioData, options = {}) {
    if (!this.initialized) {
      throw new Error('Azure STT not initialized');
    }
    
    // Mock transcription - in a real scenario, this would call the Azure STT API
    return {
      text: 'Hello from Azure STT',
      language: options.language || 'en-US',
      duration: audioData.length || 0,
      confidence: 0.95,
    };
  }
}

// For testing purposes, export a class that can be instantiated
module.exports = AzureSTT;
