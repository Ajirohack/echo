/**
 * Echo RTC Service Integration Tests
 * Tests the core functionality of EchoRTCService
 */

const { expect } = require('chai');
const sinon = require('sinon');
const EventEmitter = require('events');
const EchoRTCService = require('../echo-rtc-service');
const echoRTCConfig = require('../config');

describe('EchoRTCService Integration Tests', () => {
  let echoRTCService;
  let mockTranslationManager;
  let mockWebSocket;
  let config;

  beforeEach(() => {
    // Mock translation manager
    mockTranslationManager = {
      translateAudio: sinon.stub().resolves({
        translatedText: 'Hello world',
        confidence: 0.95,
        language: 'en',
      }),
      processAudioStream: sinon.stub(),
      on: sinon.stub(),
      emit: sinon.stub(),
    };

    // Mock WebSocket
    mockWebSocket = new EventEmitter();
    mockWebSocket.send = sinon.stub();
    mockWebSocket.close = sinon.stub();
    mockWebSocket.readyState = 1; // OPEN

    // Test configuration
    config = {
      server: {
        url: 'ws://localhost:8080',
        reconnectInterval: 1000,
        maxReconnectAttempts: 3,
      },
      webrtc: {
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
      },
      audio: {
        sampleRate: 16000,
        channels: 1,
      },
    };

    echoRTCService = new EchoRTCService(config);

    // Mock WebSocket constructor
    global.WebSocket = sinon.stub().returns(mockWebSocket);
  });

  afterEach(() => {
    sinon.restore();
    if (echoRTCService) {
      echoRTCService.removeAllListeners();
    }
  });

  describe('Initialization', () => {
    it('should initialize with translation manager', async () => {
      await echoRTCService.initialize(mockTranslationManager);

      expect(echoRTCService.isInitialized).to.be.true;
      expect(echoRTCService.translationManager).to.equal(mockTranslationManager);
    });

    it('should throw error when initializing without translation manager', async () => {
      try {
        await echoRTCService.initialize(null);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('Translation manager is required');
      }
    });

    it('should not initialize twice', async () => {
      await echoRTCService.initialize(mockTranslationManager);

      try {
        await echoRTCService.initialize(mockTranslationManager);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('already initialized');
      }
    });
  });

  describe('Server Connection', () => {
    beforeEach(async () => {
      await echoRTCService.initialize(mockTranslationManager);
    });

    it('should connect to echo RTC server', async () => {
      const connectPromise = echoRTCService.connect();

      // Simulate WebSocket open event
      setTimeout(() => {
        mockWebSocket.emit('open');
      }, 10);

      await connectPromise;

      expect(echoRTCService.isConnected).to.be.true;
      expect(global.WebSocket).to.have.been.calledWith(config.server.url);
    });

    it('should handle connection errors', async () => {
      const connectPromise = echoRTCService.connect();

      // Simulate WebSocket error
      setTimeout(() => {
        mockWebSocket.emit('error', new Error('Connection failed'));
      }, 10);

      try {
        await connectPromise;
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('Connection failed');
      }
    });

    it('should handle server messages', async () => {
      const messageHandler = sinon.stub();
      echoRTCService.on('serverMessage', messageHandler);

      const connectPromise = echoRTCService.connect();

      setTimeout(() => {
        mockWebSocket.emit('open');
        mockWebSocket.emit('message', { data: JSON.stringify({ type: 'test', data: 'hello' }) });
      }, 10);

      await connectPromise;

      expect(messageHandler).to.have.been.calledWith({ type: 'test', data: 'hello' });
    });

    it('should disconnect from server', async () => {
      const connectPromise = echoRTCService.connect();

      setTimeout(() => {
        mockWebSocket.emit('open');
      }, 10);

      await connectPromise;
      await echoRTCService.disconnect();

      expect(echoRTCService.isConnected).to.be.false;
      expect(mockWebSocket.close).to.have.been.called;
    });
  });

  describe('Audio Processing', () => {
    beforeEach(async () => {
      await echoRTCService.initialize(mockTranslationManager);

      const connectPromise = echoRTCService.connect();
      setTimeout(() => mockWebSocket.emit('open'), 10);
      await connectPromise;
    });

    it('should process audio for translation', async () => {
      const audioData = new ArrayBuffer(1024);
      const participantId = 'participant-123';

      const translationPromise = new Promise((resolve) => {
        echoRTCService.on('translationResult', resolve);
      });

      await echoRTCService.processAudioForTranslation(audioData, participantId);

      expect(mockTranslationManager.translateAudio).to.have.been.calledWith(audioData);

      const result = await translationPromise;
      expect(result).to.deep.include({
        participantId,
        translatedText: 'Hello world',
        confidence: 0.95,
      });
    });

    it('should handle translation errors', async () => {
      mockTranslationManager.translateAudio.rejects(new Error('Translation failed'));

      const audioData = new ArrayBuffer(1024);
      const participantId = 'participant-123';

      const errorPromise = new Promise((resolve) => {
        echoRTCService.on('translationError', resolve);
      });

      await echoRTCService.processAudioForTranslation(audioData, participantId);

      const error = await errorPromise;
      expect(error.message).to.include('Translation failed');
    });
  });

  describe('Room Management Integration', () => {
    beforeEach(async () => {
      await echoRTCService.initialize(mockTranslationManager);

      const connectPromise = echoRTCService.connect();
      setTimeout(() => mockWebSocket.emit('open'), 10);
      await connectPromise;
    });

    it('should create room through server', async () => {
      const roomConfig = {
        name: 'test-room',
        maxParticipants: 10,
        isPrivate: false,
      };

      const createPromise = echoRTCService.createRoom(roomConfig);

      // Simulate server response
      setTimeout(() => {
        mockWebSocket.emit('message', {
          data: JSON.stringify({
            type: 'roomCreated',
            data: {
              roomId: 'room-123',
              ...roomConfig,
            },
          }),
        });
      }, 10);

      const result = await createPromise;

      expect(mockWebSocket.send).to.have.been.calledWith(
        JSON.stringify({
          type: 'createRoom',
          data: roomConfig,
        })
      );

      expect(result).to.deep.include({
        roomId: 'room-123',
        name: 'test-room',
      });
    });

    it('should join room through server', async () => {
      const joinData = {
        roomId: 'room-123',
        participant: {
          id: 'participant-456',
          name: 'Test User',
          language: 'en',
        },
      };

      const joinPromise = echoRTCService.joinRoom(joinData);

      // Simulate server response
      setTimeout(() => {
        mockWebSocket.emit('message', {
          data: JSON.stringify({
            type: 'roomJoined',
            data: {
              success: true,
              ...joinData,
            },
          }),
        });
      }, 10);

      const result = await joinPromise;

      expect(mockWebSocket.send).to.have.been.calledWith(
        JSON.stringify({
          type: 'joinRoom',
          data: joinData,
        })
      );

      expect(result.success).to.be.true;
    });
  });

  describe('Event Handling', () => {
    beforeEach(async () => {
      await echoRTCService.initialize(mockTranslationManager);
    });

    it('should emit connection events', (done) => {
      echoRTCService.on('connected', () => {
        expect(echoRTCService.isConnected).to.be.true;
        done();
      });

      const connectPromise = echoRTCService.connect();
      setTimeout(() => mockWebSocket.emit('open'), 10);
    });

    it('should emit disconnection events', (done) => {
      echoRTCService.on('disconnected', () => {
        expect(echoRTCService.isConnected).to.be.false;
        done();
      });

      const connectPromise = echoRTCService.connect();
      setTimeout(() => {
        mockWebSocket.emit('open');
        setTimeout(() => mockWebSocket.emit('close'), 10);
      }, 10);
    });

    it('should emit error events', (done) => {
      echoRTCService.on('error', (error) => {
        expect(error.message).to.include('Test error');
        done();
      });

      const connectPromise = echoRTCService.connect();
      setTimeout(() => mockWebSocket.emit('error', new Error('Test error')), 10);
    });
  });

  describe('Statistics and Monitoring', () => {
    beforeEach(async () => {
      await echoRTCService.initialize(mockTranslationManager);

      const connectPromise = echoRTCService.connect();
      setTimeout(() => mockWebSocket.emit('open'), 10);
      await connectPromise;
    });

    it('should provide connection statistics', () => {
      const stats = echoRTCService.getStatistics();

      expect(stats).to.have.property('isConnected', true);
      expect(stats).to.have.property('isInitialized', true);
      expect(stats).to.have.property('uptime');
      expect(stats).to.have.property('messagesSent', 0);
      expect(stats).to.have.property('messagesReceived', 0);
    });

    it('should track message statistics', async () => {
      // Send a message
      await echoRTCService.createRoom({ name: 'test' });

      // Simulate receiving a message
      mockWebSocket.emit('message', {
        data: JSON.stringify({ type: 'test', data: 'hello' }),
      });

      const stats = echoRTCService.getStatistics();
      expect(stats.messagesSent).to.be.greaterThan(0);
      expect(stats.messagesReceived).to.be.greaterThan(0);
    });
  });

  describe('Error Recovery', () => {
    beforeEach(async () => {
      await echoRTCService.initialize(mockTranslationManager);
    });

    it('should attempt reconnection on connection loss', (done) => {
      let reconnectAttempts = 0;

      echoRTCService.on('reconnecting', () => {
        reconnectAttempts++;
        if (reconnectAttempts === 1) {
          expect(echoRTCService.isConnected).to.be.false;
          done();
        }
      });

      const connectPromise = echoRTCService.connect();
      setTimeout(() => {
        mockWebSocket.emit('open');
        setTimeout(() => {
          mockWebSocket.emit('close', { code: 1006, reason: 'Connection lost' });
        }, 10);
      }, 10);
    });

    it('should stop reconnecting after max attempts', (done) => {
      let reconnectAttempts = 0;

      echoRTCService.on('reconnecting', () => {
        reconnectAttempts++;
      });

      echoRTCService.on('maxReconnectAttemptsReached', () => {
        expect(reconnectAttempts).to.equal(config.server.maxReconnectAttempts);
        done();
      });

      const connectPromise = echoRTCService.connect();
      setTimeout(() => {
        mockWebSocket.emit('open');
        setTimeout(() => {
          mockWebSocket.emit('close', { code: 1006, reason: 'Connection lost' });
        }, 10);
      }, 10);
    });
  });
});
