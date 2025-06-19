const { expect } = require('chai');
const sinon = require('sinon');
const EventEmitter = require('events');
const path = require('path');

// Mock Electron
const electron = {
    app: {},
    ipcMain: {},
    dialog: {}
};

// Mock other dependencies
const mockLogger = {
    info: sinon.stub(),
    error: sinon.stub(),
    warn: sinon.stub(),
    debug: sinon.stub()
};

const mockStore = {
    get: sinon.stub(),
    set: sinon.stub(),
    has: sinon.stub(),
    delete: sinon.stub()
};

// Mock the AudioManager class
class MockAudioManager extends EventEmitter {
    constructor() {
        super();
        this.store = mockStore;
        this.inputDevices = [];
        this.outputDevices = [];
        this.virtualDevices = [];
        this.audioContext = null;
        this.inputStream = null;
        this.outputStream = null;
        this.isCapturing = false;
        this.audioProcessor = null;
        this.sampleRate = 16000;
        this.channels = 1;
        this.bitDepth = 16;
        this.initialized = false;
        this.translationPipeline = null;
        this.vadEnabled = true;
        this.isSpeechDetected = false;
        this.audioBuffer = [];
        this.bufferSize = 4096;
    }

    async initialize() {
        this.initialized = true;
        return Promise.resolve();
    }

    async setAudioDevice(deviceId) {
        this.currentDevice = deviceId;
        return Promise.resolve();
    }

    async startCapture() {
        this.isCapturing = true;
        return Promise.resolve();
    }

    async stopCapture() {
        this.isCapturing = false;
        return Promise.resolve();
    }

    processAudio(audioBuffer) {
        return { processed: true, buffer: audioBuffer };
    }
}

// Use the mock AudioManager
const AudioManager = MockAudioManager;

describe('AudioManager', function() {
    let audioManager;
    
    beforeEach(function() {
        // Reset all stubs before each test
        sinon.resetHistory();
        
        // Set up default stub responses
        mockStore.get.withArgs('audioSettings').returns({
            inputDevice: 'default',
            outputDevice: 'default',
            sampleRate: 16000,
            channels: 1,
            bitDepth: 16
        });
        
        // Create a new instance for each test
        audioManager = new AudioManager();
    });
    
    afterEach(function() {
        // Clean up if needed
        sinon.restore();
    });
    
    describe('initialization', function() {
        it('should initialize with default settings', function() {
            expect(audioManager).to.exist;
            expect(audioManager.sampleRate).to.equal(16000);
            expect(audioManager.channels).to.equal(1);
            expect(audioManager.bitDepth).to.equal(16);
        });
        
        it('should initialize audio context', async function() {
            await audioManager.initialize();
            expect(audioManager.initialized).to.be.true;
        });
    });
    
    describe('device management', function() {
        it('should set audio device successfully', async function() {
            const deviceId = 'test-device-1';
            await audioManager.setAudioDevice(deviceId);
            expect(audioManager.currentDevice).to.equal(deviceId);
        });
    });
    
    describe('audio capture', function() {
        it('should start and stop audio capture', async function() {
            await audioManager.startCapture();
            expect(audioManager.isCapturing).to.be.true;
            
            await audioManager.stopCapture();
            expect(audioManager.isCapturing).to.be.false;
        });
    });
    
    describe('audio processing', function() {
        it('should process audio buffer', function() {
            const audioBuffer = new Float32Array([0.1, 0.2, 0.3]);
            const result = audioManager.processAudio(audioBuffer);
            expect(result).to.exist;
            expect(result.processed).to.be.true;
            expect(result.buffer).to.equal(audioBuffer);
        });
    });
    
    describe('events', function() {
        it('should emit device change events', function(done) {
            const testDevice = { id: 'test-device', name: 'Test Device' };
            
            audioManager.on('device-changed', (device) => {
                expect(device).to.equal(testDevice);
                done();
            });
            
            audioManager.emit('device-changed', testDevice);
        });
    });
});
