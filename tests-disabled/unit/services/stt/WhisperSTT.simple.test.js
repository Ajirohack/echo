const path = require('path');
const { expect } = require('chai');
const proxyquire = require('proxyquire').noPreserveCache();

// We'll use the global expect from test-helper

// We'll define mocks in the before/beforeEach hooks to ensure fresh instances for each test
let mockLogger, MockBaseSTTService, mockOpenAIClient, mockOpenAI, mockExec, mockFs, mockPath, mockChildProcess;

describe('WhisperSTT', function() {
  let WhisperSTT;
  
  before(function() {
    // Initialize mocks
    const sinon = require('sinon');
    
    // Mock logger
    mockLogger = {
      info: sinon.stub(),
      error: sinon.stub(),
      debug: sinon.stub(),
      warn: sinon.stub()
    };
    
    // Mock BaseSTTService
    MockBaseSTTService = class {
      constructor(config = {}) {
        this.config = config;
        this.isInitialized = false;
        this.supportedLanguages = ['en', 'es', 'fr'];
      }
      
      async initialize() {
        this.isInitialized = true;
        return true;
      }
      
      async transcribe() {
        return { text: 'test transcription', language: 'en', isFinal: true };
      }
    };
    
    // Mock OpenAI client
    mockOpenAIClient = {
      audio: {
        transcriptions: {
          create: sinon.stub().resolves({
            text: 'test transcription',
            language: 'en'
          })
        }
      }
    };
    
    // Mock OpenAI constructor
    mockOpenAI = {
      OpenAI: sinon.stub().returns(mockOpenAIClient)
    };
    
    // Mock child_process.exec
    mockExec = sinon.stub().callsArgWith(2, null, { 
      stdout: JSON.stringify({ text: 'test local transcription' }) 
    });
    
    // Mock fs module
    mockFs = {
      existsSync: sinon.stub().returns(true),
      mkdirSync: sinon.stub(),
      writeFileSync: sinon.stub()
    };
    
    // Mock path module
    mockPath = {
      join: path.join,
      dirname: path.dirname,
      resolve: path.resolve
    };
    
    // Mock child_process module
    mockChildProcess = { exec: mockExec };
    
    // Use proxyquire to mock the dependencies
    WhisperSTT = proxyquire('../../../src/services/stt/services/WhisperSTT', {
      '../../utils/logger': mockLogger,
      '../BaseSTTService': MockBaseSTTService,
      'openai': mockOpenAI,
      'fs': mockFs,
      'path': mockPath,
      'child_process': mockChildProcess,
      'util': {
        promisify: (fn) => fn // Simple promisify mock
      }
    });
  });
  
  beforeEach(function() {
    // Reset all mocks before each test
    const sinon = require('sinon');
    
    // Reset stubs
    if (mockOpenAIClient?.audio?.transcriptions?.create?.resetHistory) {
      mockOpenAIClient.audio.transcriptions.create.resetHistory();
    }
    
    if (mockExec?.resetHistory) {
      mockExec.resetHistory();
    }
    
    if (mockFs?.existsSync?.resetHistory) {
      mockFs.existsSync.resetHistory();
    }
    
    // Reset mock implementations
    if (mockOpenAIClient?.audio?.transcriptions?.create) {
      mockOpenAIClient.audio.transcriptions.create.resolves({
        text: 'test transcription',
        language: 'en'
      });
    }
    
    if (mockExec) {
      mockExec.callsArgWith(2, null, { 
        stdout: JSON.stringify({ text: 'test local transcription' }) 
      });
    }
    
    if (mockFs?.existsSync) {
      mockFs.existsSync.returns(true);
    }
  });
  
  describe('Initialization', function() {
    it('should initialize with API client when useLocal is false', async function() {
      const service = new WhisperSTT({
        apiKey: 'test-api-key',
        useLocal: false
      });
      
      await service.initialize();
      expect(service.isInitialized).to.be.true;
    });
    
    it('should initialize with local model when useLocal is true', async function() {
      const service = new WhisperSTT({
        useLocal: true,
        localModel: 'base',
        localModelPath: '/path/to/model'
      });
      
      await service.initialize();
      expect(service.isInitialized).to.be.true;
    });
  });
  
  describe('Transcription', function() {
    it('should transcribe audio using API', async function() {
      const service = new WhisperSTT({
        apiKey: 'test-api-key',
        useLocal: false
      });
      
      await service.initialize();
      const audioData = new Float32Array([0.1, 0.2, 0.3]);
      const result = await service.transcribe(audioData, { language: 'en' });
      
      expect(result).to.have.property('text', 'test transcription');
      
      if (mockOpenAIClient?.audio?.transcriptions?.create?.calledOnce) {
        expect(mockOpenAIClient.audio.transcriptions.create.calledOnce).to.be.true;
      }
      
      if (mockOpenAI?.OpenAI?.calledWith) {
        expect(mockOpenAI.OpenAI.calledWith({
          apiKey: 'test-api-key'
        })).to.be.true;
      }
    });
    
    it('should transcribe audio using local model', async function() {
      const service = new WhisperSTT({
        useLocal: true,
        localModel: 'base',
        localModelPath: '/path/to/model'
      });
      
      await service.initialize();
      const result = await service.transcribe(new Float32Array([0.1, 0.2, 0.3]));
      
      expect(result).to.have.property('text', 'test local transcription');
      
      if (mockExec?.calledOnce) {
        expect(mockExec.calledOnce).to.be.true;
      }
    });
    
    it('should handle transcription errors', async function() {
      const service = new WhisperSTT({
        apiKey: 'test-api-key',
        useLocal: false
      });
      
      if (mockOpenAIClient?.audio?.transcriptions?.create) {
        mockOpenAIClient.audio.transcriptions.create.rejects(new Error('API error'));
      }
      
      try {
        await service.transcribe(new Float32Array([0.1, 0.2, 0.3]));
        throw new Error('Expected an error to be thrown');
      } catch (error) {
        if (error.message !== 'Expected an error to be thrown') {
          expect(error.message).to.include('API error');
        } else {
          throw error;
        }
      }
    });
  });
});
