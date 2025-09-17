/**
 * Echo RTC Room Manager Integration Tests
 * Tests room management functionality
 */

const { expect } = require('chai');
const sinon = require('sinon');
const EventEmitter = require('events');
const EchoRTCRoomManager = require('../room-manager');
const EchoRTCService = require('../echo-rtc-service');

describe('EchoRTCRoomManager Integration Tests', () => {
  let roomManager;
  let mockEchoRTCService;
  let mockTranslationManager;

  beforeEach(() => {
    // Mock Echo RTC Service
    mockEchoRTCService = new EventEmitter();
    mockEchoRTCService.isConnected = true;
    mockEchoRTCService.isInitialized = true;
    mockEchoRTCService.createRoom = sinon.stub();
    mockEchoRTCService.joinRoom = sinon.stub();
    mockEchoRTCService.leaveRoom = sinon.stub();
    mockEchoRTCService.sendMessage = sinon.stub();
    mockEchoRTCService.getStatistics = sinon.stub().returns({
      isConnected: true,
      activeRooms: 0,
    });

    // Mock Translation Manager
    mockTranslationManager = {
      translateText: sinon.stub().resolves({
        translatedText: 'Translated text',
        confidence: 0.95,
        targetLanguage: 'es',
      }),
      getSupportedLanguages: sinon.stub().returns(['en', 'es', 'fr', 'de']),
    };

    roomManager = new EchoRTCRoomManager(mockEchoRTCService);
  });

  afterEach(() => {
    sinon.restore();
    roomManager.removeAllListeners();
  });

  describe('Room Creation', () => {
    it('should create a new room successfully', async () => {
      const roomConfig = {
        name: 'test-room',
        maxParticipants: 10,
        isPrivate: false,
        password: null,
        translationEnabled: true,
        supportedLanguages: ['en', 'es'],
      };

      mockEchoRTCService.createRoom.resolves({
        success: true,
        roomId: 'room-123',
        ...roomConfig,
      });

      const result = await roomManager.createRoom('test-room', roomConfig);

      expect(result.success).to.be.true;
      expect(result.roomId).to.equal('room-123');
      expect(mockEchoRTCService.createRoom).to.have.been.calledWith({
        name: 'test-room',
        ...roomConfig,
      });

      // Check if room is stored locally
      const activeRooms = roomManager.getActiveRooms();
      expect(activeRooms).to.have.length(1);
      expect(activeRooms[0].name).to.equal('test-room');
    });

    it('should handle room creation errors', async () => {
      mockEchoRTCService.createRoom.rejects(new Error('Room creation failed'));

      try {
        await roomManager.createRoom('test-room');
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('Room creation failed');
      }
    });

    it('should validate room configuration', async () => {
      const invalidConfig = {
        maxParticipants: -1, // Invalid
        supportedLanguages: [], // Invalid
      };

      try {
        await roomManager.createRoom('test-room', invalidConfig);
        expect.fail('Should have thrown validation error');
      } catch (error) {
        expect(error.message).to.include('Invalid room configuration');
      }
    });

    it('should prevent duplicate room names', async () => {
      const roomConfig = { name: 'test-room' };

      mockEchoRTCService.createRoom.resolves({
        success: true,
        roomId: 'room-123',
        ...roomConfig,
      });

      // Create first room
      await roomManager.createRoom('test-room', roomConfig);

      // Try to create duplicate
      try {
        await roomManager.createRoom('test-room', roomConfig);
        expect.fail('Should have thrown duplicate error');
      } catch (error) {
        expect(error.message).to.include('Room with name "test-room" already exists');
      }
    });
  });

  describe('Participant Management', () => {
    let roomId;

    beforeEach(async () => {
      mockEchoRTCService.createRoom.resolves({
        success: true,
        roomId: 'room-123',
        name: 'test-room',
      });

      const result = await roomManager.createRoom('test-room');
      roomId = result.roomId;
    });

    it('should add participant to room', async () => {
      const participant = {
        id: 'participant-456',
        name: 'Test User',
        language: 'en',
        isHost: false,
      };

      mockEchoRTCService.joinRoom.resolves({
        success: true,
        participant,
      });

      const result = await roomManager.joinRoom('test-room', participant);

      expect(result.success).to.be.true;
      expect(mockEchoRTCService.joinRoom).to.have.been.calledWith({
        roomId,
        participant,
      });

      // Check if participant is stored
      const room = roomManager.getRoom('test-room');
      expect(room.participants).to.have.length(1);
      expect(room.participants[0].id).to.equal('participant-456');
    });

    it('should remove participant from room', async () => {
      const participant = {
        id: 'participant-456',
        name: 'Test User',
        language: 'en',
      };

      // Add participant first
      mockEchoRTCService.joinRoom.resolves({ success: true, participant });
      await roomManager.joinRoom('test-room', participant);

      // Remove participant
      mockEchoRTCService.leaveRoom.resolves({ success: true });
      const result = await roomManager.leaveRoom('test-room', 'participant-456');

      expect(result.success).to.be.true;
      expect(mockEchoRTCService.leaveRoom).to.have.been.calledWith({
        roomId,
        participantId: 'participant-456',
      });

      // Check if participant is removed
      const room = roomManager.getRoom('test-room');
      expect(room.participants).to.have.length(0);
    });

    it('should handle maximum participants limit', async () => {
      // Create room with max 2 participants
      const limitedRoomConfig = { maxParticipants: 2 };
      mockEchoRTCService.createRoom.resolves({
        success: true,
        roomId: 'limited-room-123',
        name: 'limited-room',
        ...limitedRoomConfig,
      });

      await roomManager.createRoom('limited-room', limitedRoomConfig);

      // Add 2 participants successfully
      for (let i = 1; i <= 2; i++) {
        const participant = {
          id: `participant-${i}`,
          name: `User ${i}`,
          language: 'en',
        };
        mockEchoRTCService.joinRoom.resolves({ success: true, participant });
        await roomManager.joinRoom('limited-room', participant);
      }

      // Try to add 3rd participant
      const thirdParticipant = {
        id: 'participant-3',
        name: 'User 3',
        language: 'en',
      };

      try {
        await roomManager.joinRoom('limited-room', thirdParticipant);
        expect.fail('Should have thrown max participants error');
      } catch (error) {
        expect(error.message).to.include('Room has reached maximum participants');
      }
    });

    it('should validate participant data', async () => {
      const invalidParticipant = {
        // Missing required fields
        name: 'Test User',
      };

      try {
        await roomManager.joinRoom('test-room', invalidParticipant);
        expect.fail('Should have thrown validation error');
      } catch (error) {
        expect(error.message).to.include('Invalid participant data');
      }
    });
  });

  describe('Translation Management', () => {
    let roomId;

    beforeEach(async () => {
      mockEchoRTCService.createRoom.resolves({
        success: true,
        roomId: 'room-123',
        name: 'test-room',
        translationEnabled: true,
        supportedLanguages: ['en', 'es', 'fr'],
      });

      const result = await roomManager.createRoom('test-room', {
        translationEnabled: true,
        supportedLanguages: ['en', 'es', 'fr'],
      });
      roomId = result.roomId;
    });

    it('should update translation settings', async () => {
      const newSettings = {
        translationEnabled: true,
        supportedLanguages: ['en', 'es', 'fr', 'de'],
        autoTranslate: true,
        translationQuality: 'high',
      };

      const result = await roomManager.updateTranslationSettings('test-room', newSettings);

      expect(result.success).to.be.true;

      const room = roomManager.getRoom('test-room');
      expect(room.translationSettings).to.deep.include(newSettings);
    });

    it('should handle translation requests', async () => {
      const translationRequest = {
        text: 'Hello world',
        sourceLanguage: 'en',
        targetLanguage: 'es',
        participantId: 'participant-456',
      };

      roomManager.translationManager = mockTranslationManager;

      const translationPromise = new Promise((resolve) => {
        roomManager.on('translationResult', resolve);
      });

      await roomManager.requestTranslation('test-room', translationRequest);

      const result = await translationPromise;

      expect(mockTranslationManager.translateText).to.have.been.calledWith(
        'Hello world',
        'en',
        'es'
      );

      expect(result).to.deep.include({
        roomName: 'test-room',
        translatedText: 'Translated text',
        targetLanguage: 'es',
      });
    });

    it('should validate translation languages', async () => {
      const invalidRequest = {
        text: 'Hello world',
        sourceLanguage: 'en',
        targetLanguage: 'unsupported', // Not in supported languages
        participantId: 'participant-456',
      };

      try {
        await roomManager.requestTranslation('test-room', invalidRequest);
        expect.fail('Should have thrown language validation error');
      } catch (error) {
        expect(error.message).to.include('Unsupported target language');
      }
    });
  });

  describe('Room Cleanup', () => {
    it('should clean up empty rooms', async () => {
      // Create room
      mockEchoRTCService.createRoom.resolves({
        success: true,
        roomId: 'room-123',
        name: 'test-room',
      });

      await roomManager.createRoom('test-room');
      expect(roomManager.getActiveRooms()).to.have.length(1);

      // Clean up empty rooms
      await roomManager.cleanupEmptyRooms();

      expect(roomManager.getActiveRooms()).to.have.length(0);
    });

    it('should not clean up rooms with participants', async () => {
      // Create room and add participant
      mockEchoRTCService.createRoom.resolves({
        success: true,
        roomId: 'room-123',
        name: 'test-room',
      });

      await roomManager.createRoom('test-room');

      const participant = {
        id: 'participant-456',
        name: 'Test User',
        language: 'en',
      };

      mockEchoRTCService.joinRoom.resolves({ success: true, participant });
      await roomManager.joinRoom('test-room', participant);

      // Try to clean up
      await roomManager.cleanupEmptyRooms();

      expect(roomManager.getActiveRooms()).to.have.length(1);
    });

    it('should destroy room completely', async () => {
      // Create room with participant
      mockEchoRTCService.createRoom.resolves({
        success: true,
        roomId: 'room-123',
        name: 'test-room',
      });

      await roomManager.createRoom('test-room');

      const participant = {
        id: 'participant-456',
        name: 'Test User',
        language: 'en',
      };

      mockEchoRTCService.joinRoom.resolves({ success: true, participant });
      await roomManager.joinRoom('test-room', participant);

      // Destroy room
      const result = await roomManager.destroyRoom('test-room');

      expect(result.success).to.be.true;
      expect(roomManager.getActiveRooms()).to.have.length(0);
    });
  });

  describe('Event Handling', () => {
    it('should emit room events', (done) => {
      let eventsReceived = 0;
      const expectedEvents = ['roomCreated', 'participantJoined', 'participantLeft'];

      expectedEvents.forEach((eventName) => {
        roomManager.on(eventName, (data) => {
          eventsReceived++;
          if (eventsReceived === expectedEvents.length) {
            done();
          }
        });
      });

      // Simulate events
      roomManager.emit('roomCreated', { roomName: 'test-room' });
      roomManager.emit('participantJoined', { participantId: 'participant-456' });
      roomManager.emit('participantLeft', { participantId: 'participant-456' });
    });

    it('should handle service events', async () => {
      const eventHandler = sinon.stub();
      roomManager.on('serviceEvent', eventHandler);

      // Simulate service event
      mockEchoRTCService.emit('serverMessage', {
        type: 'roomUpdate',
        data: { roomId: 'room-123', status: 'active' },
      });

      expect(eventHandler).to.have.been.called;
    });
  });

  describe('Statistics and Monitoring', () => {
    beforeEach(async () => {
      mockEchoRTCService.createRoom.resolves({
        success: true,
        roomId: 'room-123',
        name: 'test-room',
      });

      await roomManager.createRoom('test-room');
    });

    it('should provide room statistics', () => {
      const stats = roomManager.getStatistics();

      expect(stats).to.have.property('totalRooms', 1);
      expect(stats).to.have.property('totalParticipants', 0);
      expect(stats).to.have.property('averageParticipantsPerRoom', 0);
      expect(stats).to.have.property('roomsWithTranslation');
    });

    it('should track room activity', async () => {
      const participant = {
        id: 'participant-456',
        name: 'Test User',
        language: 'en',
      };

      mockEchoRTCService.joinRoom.resolves({ success: true, participant });
      await roomManager.joinRoom('test-room', participant);

      const stats = roomManager.getStatistics();
      expect(stats.totalParticipants).to.equal(1);
      expect(stats.averageParticipantsPerRoom).to.equal(1);
    });
  });
});
