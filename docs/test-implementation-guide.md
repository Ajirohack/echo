# Test Implementation Guide

## Overview

This document provides detailed implementation guidelines for the testing strategy outlined in `testing-strategy.md`. It includes specific test patterns, examples, and practical implementation advice for creating unit, integration, API, and end-to-end tests for the Real-Time Multi-Platform Translation App.

## Test Structure

Tests are organized in the following directory structure:

```text
tests/
├── unit/
│   ├── audio/
│   ├── services/
│   │   ├── stt/
│   │   ├── translation/
│   │   └── tts/
│   └── utils/
├── integration/
│   ├── stt-translation.test.js
│   ├── translation-tts.test.js
│   └── complete-pipeline.test.js
├── api/
│   ├── openai-api.test.js
│   ├── deepl-api.test.js
│   ├── azure-api.test.js
│   └── google-api.test.js
├── e2e/
│   └── app.e2e.test.js
├── fixtures/
│   ├── audio-samples/
│   ├── mock-responses/
│   └── test-data/
├── mocks/
│   └── translation-mocks.js
└── utils/
    └── translation-test-utils.js
```

## Unit Test Implementation

### Translation Service Tests

Each translation service should be tested for:

1. **Initialization**: Successful connection to API
2. **Basic Translation**: Core translation functionality
3. **Error Handling**: API errors, network issues, rate limits
4. **Language Support**: Correct language code handling

Example pattern for translation service tests:

```javascript
describe('TranslationService', () => {
  let service;
  let sandbox;
  
  beforeEach(() => {
    sandbox = sinon.createSandbox();
    service = new TranslationService(mockConfig);
  });
  
  afterEach(() => {
    sandbox.restore();
  });
  
  describe('initialization', () => {
    it('should initialize successfully with valid credentials', async () => {
      // Test initialization
    });
    
    it('should handle missing API key', async () => {
      // Test initialization failure
    });
  });
  
  describe('translate', () => {
    beforeEach(() => {
      service.isInitialized = true;
    });
    
    it('should translate text successfully', async () => {
      // Test basic translation
    });
    
    it('should handle API errors gracefully', async () => {
      // Test error handling
    });
  });
});
```

### Translation Manager Tests

The TranslationManager orchestrates multiple services and requires testing for:

1. **Service Selection**: Correct service selection based on language pair
2. **Fallback Mechanism**: Handling service failures
3. **Caching**: Proper caching of translations
4. **Context Management**: Using conversation context correctly

Example test for service selection and fallback:

```javascript
describe('TranslationManager', () => {
  // Setup code...
  
  describe('translate', () => {
    it('should select the best service for a language pair', async () => {
      // Mock language pair optimizer
      sandbox.stub(translationManager.languagePairOptimizer, 'getBestServiceForLanguagePair')
        .returns('deepl');
      
      // Mock successful translation
      sandbox.stub(translationManager, 'attemptTranslation').resolves({
        success: true,
        translation: 'Hola mundo',
        service: 'deepl'
      });
      
      const result = await translationManager.translate('Hello world', 'en', 'es');
      
      expect(result.success).to.be.true;
      expect(result.service).to.equal('deepl');
    });
    
    it('should try fallback services when primary service fails', async () => {
      // Mock primary service failure
      sandbox.stub(translationManager, 'attemptTranslation')
        .withArgs('deepl', sinon.match.any, sinon.match.any, sinon.match.any)
        .resolves({
          success: false,
          error: 'Service unavailable'
        });
      
      // Mock fallback service success
      sandbox.stub(translationManager, 'fallbackTranslation').resolves({
        success: true,
        translation: 'Hola mundo',
        service: 'google'
      });
      
      const result = await translationManager.translate('Hello world', 'en', 'es');
      
      expect(result.success).to.be.true;
      expect(result.service).to.equal('google');
    });
  });
});
```

## Integration Test Implementation

Integration tests should verify the interaction between components and the correct flow of data through the system.

### STT → Translation Pipeline

Test the flow from speech recognition to translation:

```javascript
describe('STT to Translation Integration', () => {
  let sttManager;
  let translationManager;
  
  beforeEach(async () => {
    // Initialize with mock services
    sttManager = new STTManager();
    translationManager = new TranslationManager();
    
    // Replace real services with mocks
    // Initialize managers
  });
  
  it('should process text from STT through translation', async () => {
    // Mock STT result
    sandbox.stub(sttManager, 'transcribeAudio').resolves({
      text: 'Hello world',
      language: 'en',
      confidence: 0.95
    });
    
    // Process through pipeline
    const audioFile = 'path/to/mock/audio.wav';
    const targetLanguage = 'es';
    
    const sttResult = await sttManager.transcribeAudio(audioFile);
    const translationResult = await translationManager.translate(
      sttResult.text,
      sttResult.language,
      targetLanguage
    );
    
    expect(translationResult.success).to.be.true;
    expect(translationResult.translation).to.be.a('string');
  });
});
```

### Complete Pipeline Test

Test the entire flow from audio input to audio output:

```javascript
describe('Complete Pipeline Integration', () => {
  // Setup code...
  
  it('should process audio through the complete pipeline', async function() {
    // This test might take longer
    this.timeout(10000);
    
    // Mock STT transcription
    sandbox.stub(sttManager, 'transcribeAudio').resolves({
      text: 'Hello, this is a test',
      language: 'en'
    });
    
    // Mock translation
    sandbox.stub(translationManager, 'translate').resolves({
      success: true,
      translation: 'Hola, esto es una prueba',
      language: 'es'
    });
    
    // Mock TTS synthesis
    sandbox.stub(ttsManager, 'synthesizeSpeech').resolves({
      audioFile: '/path/to/output.wav'
    });
    
    // Execute complete pipeline
    const result = await pipeline.process(
      '/path/to/input.wav',
      'en',
      'es'
    );
    
    expect(result.success).to.be.true;
    expect(result.outputAudioPath).to.be.a('string');
  });
});
```

## API Test Implementation

API tests verify the correct interaction with external services, focusing on request formatting, authentication, and response handling.

Example for testing the Azure Translator API:

```javascript
describe('Azure Translator API Tests', () => {
  beforeEach(() => {
    // Disable real HTTP requests
    nock.disableNetConnect();
  });
  
  afterEach(() => {
    nock.cleanAll();
    nock.enableNetConnect();
  });
  
  it('should make correct API calls to translate text', async () => {
    // Set up mock API response
    nock('https://api.cognitive.microsofttranslator.com')
      .post('/translate')
      .query(q => q.to === 'es')
      .reply(200, [
        {
          detectedLanguage: {
            language: 'en',
            score: 0.91
          },
          translations: [
            {
              text: 'Hola mundo',
              to: 'es'
            }
          ]
        }
      ]);
    
    // Call translation method
    const result = await azureTranslator.translate('Hello world', 'en', 'es');
    
    expect(result.translation).to.equal('Hola mundo');
    expect(nock.isDone()).to.be.true; // Verify all mocks were called
  });
  
  it('should handle API errors correctly', async () => {
    // Set up mock API error response
    nock('https://api.cognitive.microsofttranslator.com')
      .post('/translate')
      .reply(401, {
        error: {
          code: 401000,
          message: 'The request is not authorized'
        }
      });
    
    try {
      await azureTranslator.translate('Hello world', 'en', 'es');
      expect.fail('Should have thrown an error');
    } catch (error) {
      expect(error.message).to.include('not authorized');
    }
  });
});
```

## Mock Implementation

Mocks should simulate the behavior of real services without requiring actual API access.

Example mock translation service:

```javascript
class MockTranslationService {
  constructor(options = {}) {
    this.name = options.name || 'mock-service';
    this.delay = options.delay || 50;
    this.failureRate = options.failureRate || 0;
    this.translations = options.translations || {
      'en': {
        'es': {
          'Hello': 'Hola',
          'Hello world': 'Hola mundo'
          // More sample translations...
        }
      }
    };
  }

  async translate(text, fromLanguage, toLanguage) {
    // Simulate delay
    await new Promise(resolve => setTimeout(resolve, this.delay));
    
    // Simulate random failure
    if (Math.random() < this.failureRate) {
      throw new Error('Service temporarily unavailable');
    }
    
    // Try to find translation or generate mock
    const translation = this.translations[fromLanguage]?.[toLanguage]?.[text] || 
      `[${toLanguage}] ${text}`;
    
    return {
      translation,
      confidence: 0.85 + (Math.random() * 0.1)
    };
  }
}
```

## Test Fixtures

Test fixtures provide consistent test data:

1. **Translation data**: Sample texts and expected translations
2. **API responses**: JSON templates for API responses
3. **Test cases**: Structured test scenarios

Example translation test data:

```json
{
  "sampleTranslations": {
    "en": {
      "es": {
        "Hello": "Hola",
        "Hello world": "Hola mundo",
        "How are you?": "¿Cómo estás?"
      }
    }
  },
  "testCases": [
    {
      "text": "Hello, how are you today?",
      "fromLanguage": "en",
      "toLanguage": "es",
      "options": { "priority": "quality" }
    }
  ]
}
```

## Best Practices

1. **Isolate Tests**: Each test should be independent and not rely on other tests
2. **Clear Descriptions**: Use descriptive test names that explain the expected behavior
3. **Test One Thing**: Each test should verify one specific behavior
4. **Clean Up**: Restore any mocks or stubs after tests
5. **Avoid Flakiness**: Minimize dependence on timing or external state
6. **Keep Tests Fast**: Optimize tests to run quickly for developer feedback

## Continuous Integration

In the CI pipeline, tests should run in the following order:

1. **Lint & Static Analysis**: Catch syntax and style issues
2. **Unit Tests**: Verify individual components
3. **Integration Tests**: Verify component interactions
4. **API Tests**: Verify external service interactions
5. **E2E Tests**: Verify complete application workflows

## Monitoring Test Health

Track the following metrics to ensure test quality:

1. **Test Coverage**: Percentage of code covered by tests
2. **Test Duration**: How long tests take to run
3. **Flaky Tests**: Tests that sometimes pass and sometimes fail
4. **Test Maintenance Cost**: Time spent updating tests

## Conclusion

Following these implementation guidelines will help create a robust, maintainable test suite that ensures the quality and reliability of the Multi-Platform Translation App. By systematically testing each component, their interactions, and the complete system, we can deliver a high-quality translation experience that meets user expectations.
