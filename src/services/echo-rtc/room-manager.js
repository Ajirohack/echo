/**
 * Echo RTC Room Manager
 * Manages room operations, participants, and room-specific configurations
 */

const EventEmitter = require('events');
const { logger } = require('../../utils/logger');

class EchoRTCRoomManager extends EventEmitter {
  constructor(echoRTCService) {
    super();

    this.echoRTCService = echoRTCService;
    this.rooms = new Map();
    this.roomParticipants = new Map();
    this.roomConfigurations = new Map();

    // Room state tracking
    this.roomStates = new Map();

    // Translation settings per room
    this.roomTranslationSettings = new Map();

    // Audio processing per room
    this.roomAudioProcessors = new Map();

    this.setupEventListeners();
  }

  /**
   * Set up event listeners for Echo RTC service
   * @private
   */
  setupEventListeners() {
    if (this.echoRTCService) {
      this.echoRTCService.on('roomCreated', (data) => {
        this.handleRoomCreated(data);
      });

      this.echoRTCService.on('participantJoined', (data) => {
        this.handleParticipantJoined(data);
      });

      this.echoRTCService.on('participantLeft', (data) => {
        this.handleParticipantLeft(data);
      });

      this.echoRTCService.on('translationReceived', (data) => {
        this.handleTranslationReceived(data);
      });
    }
  }

  /**
   * Create a new room with advanced configuration
   * @param {string} roomName - Room name
   * @param {Object} config - Room configuration
   * @returns {Promise<Object>} Room creation result
   */
  async createRoom(roomName, config = {}) {
    try {
      if (this.rooms.has(roomName)) {
        throw new Error(`Room ${roomName} already exists`);
      }

      const roomConfig = {
        name: roomName,
        maxParticipants: config.maxParticipants || 10,
        isPrivate: config.isPrivate || false,
        requiresPassword: config.requiresPassword || false,
        password: config.password || null,

        // Translation settings
        translation: {
          enabled: config.translation?.enabled !== false,
          sourceLanguage: config.translation?.sourceLanguage || 'auto',
          targetLanguages: config.translation?.targetLanguages || ['en'],
          realTimeTranslation: config.translation?.realTimeTranslation !== false,
          translationProvider: config.translation?.provider || 'azure',
        },

        // Audio settings
        audio: {
          quality: config.audio?.quality || 'high',
          echoCancellation: config.audio?.echoCancellation !== false,
          noiseSuppression: config.audio?.noiseSuppression !== false,
          autoGainControl: config.audio?.autoGainControl !== false,
          sampleRate: config.audio?.sampleRate || 16000,
          bitrate: config.audio?.bitrate || 64000,
        },

        // Room behavior
        behavior: {
          autoRecord: config.behavior?.autoRecord || false,
          allowScreenShare: config.behavior?.allowScreenShare || false,
          moderationEnabled: config.behavior?.moderationEnabled || false,
          maxDuration: config.behavior?.maxDuration || null, // in minutes
        },

        // Metadata
        createdAt: Date.now(),
        createdBy: config.createdBy || 'system',
        description: config.description || '',
        tags: config.tags || [],
      };

      // Create room via Echo RTC service
      const serviceResult = await this.echoRTCService.createRoom(roomName, roomConfig);

      // Store room configuration locally
      this.rooms.set(roomName, roomConfig);
      this.roomParticipants.set(roomName, new Map());
      this.roomConfigurations.set(roomName, roomConfig);
      this.roomTranslationSettings.set(roomName, roomConfig.translation);

      // Initialize room state
      this.roomStates.set(roomName, {
        status: 'active',
        participantCount: 0,
        createdAt: roomConfig.createdAt,
        lastActivity: Date.now(),
        totalMessages: 0,
        totalTranslations: 0,
      });

      logger.info(`Room manager: Created room ${roomName}`);
      this.emit('roomCreated', { roomName, config: roomConfig });

      return {
        success: true,
        roomName,
        config: roomConfig,
        serviceResult,
      };
    } catch (error) {
      logger.error(`Failed to create room ${roomName}:`, error);
      throw error;
    }
  }

  /**
   * Join a room with participant validation
   * @param {string} roomName - Room name
   * @param {Object} participant - Participant information
   * @param {string} password - Room password (if required)
   * @returns {Promise<Object>} Join result
   */
  async joinRoom(roomName, participant, password = null) {
    try {
      const room = this.rooms.get(roomName);
      if (!room) {
        throw new Error(`Room ${roomName} does not exist`);
      }

      // Validate room access
      await this.validateRoomAccess(roomName, participant, password);

      // Check participant limit
      const currentParticipants = this.roomParticipants.get(roomName);
      if (currentParticipants.size >= room.maxParticipants) {
        throw new Error(`Room ${roomName} is full`);
      }

      // Prepare participant data
      const participantData = {
        id:
          participant.id || `participant_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: participant.name || 'Anonymous',
        language: participant.language || 'en',
        role: participant.role || 'participant',
        joinedAt: Date.now(),
        isActive: true,
        audioEnabled: participant.audioEnabled !== false,
        translationEnabled: participant.translationEnabled !== false,
      };

      // Join via Echo RTC service
      const serviceResult = await this.echoRTCService.joinRoom(roomName, participantData);

      // Update local state
      currentParticipants.set(participantData.id, participantData);

      // Update room state
      const roomState = this.roomStates.get(roomName);
      if (roomState) {
        roomState.participantCount = currentParticipants.size;
        roomState.lastActivity = Date.now();
      }

      logger.info(`Participant ${participantData.name} joined room ${roomName}`);
      this.emit('participantJoined', { roomName, participant: participantData });

      return {
        success: true,
        participant: participantData,
        room: room,
        serviceResult,
      };
    } catch (error) {
      logger.error(`Failed to join room ${roomName}:`, error);
      throw error;
    }
  }

  /**
   * Validate room access
   * @private
   * @param {string} roomName - Room name
   * @param {Object} participant - Participant information
   * @param {string} password - Room password
   * @returns {Promise<void>}
   */
  async validateRoomAccess(roomName, participant, password) {
    const room = this.rooms.get(roomName);

    if (room.requiresPassword && room.password !== password) {
      throw new Error('Invalid room password');
    }

    if (room.isPrivate && !participant.invited) {
      throw new Error('Room is private and participant is not invited');
    }

    // Additional validation logic can be added here
    return true;
  }

  /**
   * Leave a room
   * @param {string} roomName - Room name
   * @param {string} participantId - Participant ID
   * @returns {Promise<Object>} Leave result
   */
  async leaveRoom(roomName, participantId) {
    try {
      const participants = this.roomParticipants.get(roomName);
      if (!participants || !participants.has(participantId)) {
        throw new Error(`Participant ${participantId} not found in room ${roomName}`);
      }

      const participant = participants.get(participantId);

      // Leave via Echo RTC service
      await this.echoRTCService.leaveRoom(roomName, participantId);

      // Update local state
      participants.delete(participantId);

      // Update room state
      const roomState = this.roomStates.get(roomName);
      if (roomState) {
        roomState.participantCount = participants.size;
        roomState.lastActivity = Date.now();
      }

      logger.info(`Participant ${participant.name} left room ${roomName}`);
      this.emit('participantLeft', { roomName, participantId, participant });

      // Auto-destroy room if empty and configured to do so
      if (participants.size === 0) {
        await this.handleEmptyRoom(roomName);
      }

      return {
        success: true,
        participantId,
        remainingParticipants: participants.size,
      };
    } catch (error) {
      logger.error(`Failed to leave room ${roomName}:`, error);
      throw error;
    }
  }

  /**
   * Handle empty room logic
   * @private
   * @param {string} roomName - Room name
   */
  async handleEmptyRoom(roomName) {
    const room = this.rooms.get(roomName);
    if (!room) return;

    // For now, we'll keep the room active for potential rejoins
    // In production, you might want to implement auto-cleanup after a timeout
    const roomState = this.roomStates.get(roomName);
    if (roomState) {
      roomState.status = 'empty';
      roomState.lastActivity = Date.now();
    }

    this.emit('roomEmpty', { roomName });
  }

  /**
   * Update room translation settings
   * @param {string} roomName - Room name
   * @param {Object} translationSettings - New translation settings
   * @returns {Promise<Object>} Update result
   */
  async updateRoomTranslationSettings(roomName, translationSettings) {
    try {
      const room = this.rooms.get(roomName);
      if (!room) {
        throw new Error(`Room ${roomName} does not exist`);
      }

      // Update room configuration
      room.translation = {
        ...room.translation,
        ...translationSettings,
      };

      // Update local translation settings
      this.roomTranslationSettings.set(roomName, room.translation);

      logger.info(`Updated translation settings for room ${roomName}`);
      this.emit('translationSettingsUpdated', { roomName, settings: room.translation });

      return {
        success: true,
        roomName,
        translationSettings: room.translation,
      };
    } catch (error) {
      logger.error(`Failed to update translation settings for room ${roomName}:`, error);
      throw error;
    }
  }

  /**
   * Get room information
   * @param {string} roomName - Room name
   * @returns {Object|null} Room information
   */
  getRoomInfo(roomName) {
    const room = this.rooms.get(roomName);
    if (!room) return null;

    const participants = this.roomParticipants.get(roomName);
    const state = this.roomStates.get(roomName);

    return {
      ...room,
      participants: Array.from(participants.values()),
      state: state,
      participantCount: participants.size,
    };
  }

  /**
   * Get all active rooms
   * @returns {Array} List of active rooms
   */
  getActiveRooms() {
    const activeRooms = [];

    this.rooms.forEach((room, roomName) => {
      const state = this.roomStates.get(roomName);
      if (state && state.status === 'active') {
        activeRooms.push({
          name: roomName,
          ...room,
          participantCount: this.roomParticipants.get(roomName).size,
          state: state,
        });
      }
    });

    return activeRooms;
  }

  /**
   * Get room participants
   * @param {string} roomName - Room name
   * @returns {Array} List of participants
   */
  getRoomParticipants(roomName) {
    const participants = this.roomParticipants.get(roomName);
    return participants ? Array.from(participants.values()) : [];
  }

  /**
   * Update participant status
   * @param {string} roomName - Room name
   * @param {string} participantId - Participant ID
   * @param {Object} updates - Status updates
   * @returns {Object} Update result
   */
  updateParticipantStatus(roomName, participantId, updates) {
    try {
      const participants = this.roomParticipants.get(roomName);
      if (!participants || !participants.has(participantId)) {
        throw new Error(`Participant ${participantId} not found in room ${roomName}`);
      }

      const participant = participants.get(participantId);
      const updatedParticipant = {
        ...participant,
        ...updates,
        lastUpdated: Date.now(),
      };

      participants.set(participantId, updatedParticipant);

      logger.info(`Updated participant ${participantId} status in room ${roomName}`);
      this.emit('participantStatusUpdated', {
        roomName,
        participantId,
        participant: updatedParticipant,
      });

      return {
        success: true,
        participant: updatedParticipant,
      };
    } catch (error) {
      logger.error(`Failed to update participant status:`, error);
      throw error;
    }
  }

  /**
   * Destroy a room
   * @param {string} roomName - Room name
   * @returns {Promise<Object>} Destroy result
   */
  async destroyRoom(roomName) {
    try {
      const room = this.rooms.get(roomName);
      if (!room) {
        throw new Error(`Room ${roomName} does not exist`);
      }

      // Notify all participants
      const participants = this.roomParticipants.get(roomName);
      if (participants) {
        participants.forEach((participant, participantId) => {
          this.emit('roomDestroyed', { roomName, participantId });
        });
      }

      // Destroy via Echo RTC service
      await this.echoRTCService.destroyRoom(roomName);

      // Clean up local state
      this.rooms.delete(roomName);
      this.roomParticipants.delete(roomName);
      this.roomConfigurations.delete(roomName);
      this.roomTranslationSettings.delete(roomName);
      this.roomStates.delete(roomName);
      this.roomAudioProcessors.delete(roomName);

      logger.info(`Room ${roomName} destroyed`);
      this.emit('roomDestroyed', { roomName });

      return {
        success: true,
        roomName,
      };
    } catch (error) {
      logger.error(`Failed to destroy room ${roomName}:`, error);
      throw error;
    }
  }

  /**
   * Handle room created event from Echo RTC service
   * @private
   * @param {Object} data - Room data
   */
  handleRoomCreated(data) {
    logger.info(`Room manager: Received room created event for ${data.roomName}`);
    // Additional room creation handling can be added here
  }

  /**
   * Handle participant joined event from Echo RTC service
   * @private
   * @param {Object} data - Participant data
   */
  handleParticipantJoined(data) {
    const { roomName, participantId } = data;

    // Update room state
    const roomState = this.roomStates.get(roomName);
    if (roomState) {
      roomState.lastActivity = Date.now();
      if (roomState.status === 'empty') {
        roomState.status = 'active';
      }
    }

    logger.info(`Room manager: Participant ${participantId} joined ${roomName}`);
  }

  /**
   * Handle participant left event from Echo RTC service
   * @private
   * @param {Object} data - Participant data
   */
  handleParticipantLeft(data) {
    const { roomName, participantId } = data;

    // Update room state
    const roomState = this.roomStates.get(roomName);
    if (roomState) {
      roomState.lastActivity = Date.now();
    }

    logger.info(`Room manager: Participant ${participantId} left ${roomName}`);
  }

  /**
   * Handle translation received event
   * @private
   * @param {Object} data - Translation data
   */
  handleTranslationReceived(data) {
    const { participantId } = data;

    // Find which room this participant belongs to
    let roomName = null;
    this.roomParticipants.forEach((participants, rName) => {
      if (participants.has(participantId)) {
        roomName = rName;
      }
    });

    if (roomName) {
      // Update room state
      const roomState = this.roomStates.get(roomName);
      if (roomState) {
        roomState.totalTranslations++;
        roomState.lastActivity = Date.now();
      }

      this.emit('roomTranslationReceived', { roomName, ...data });
    }
  }

  /**
   * Get room statistics
   * @param {string} roomName - Room name
   * @returns {Object|null} Room statistics
   */
  getRoomStatistics(roomName) {
    const room = this.rooms.get(roomName);
    const state = this.roomStates.get(roomName);
    const participants = this.roomParticipants.get(roomName);

    if (!room || !state) return null;

    return {
      roomName,
      status: state.status,
      participantCount: participants ? participants.size : 0,
      maxParticipants: room.maxParticipants,
      createdAt: state.createdAt,
      lastActivity: state.lastActivity,
      totalMessages: state.totalMessages,
      totalTranslations: state.totalTranslations,
      uptime: Date.now() - state.createdAt,
      translationEnabled: room.translation.enabled,
    };
  }

  /**
   * Get overall manager statistics
   * @returns {Object} Manager statistics
   */
  getManagerStatistics() {
    const totalRooms = this.rooms.size;
    let totalParticipants = 0;
    let activeRooms = 0;
    let totalTranslations = 0;

    this.roomStates.forEach((state, roomName) => {
      if (state.status === 'active') {
        activeRooms++;
      }
      totalTranslations += state.totalTranslations;

      const participants = this.roomParticipants.get(roomName);
      if (participants) {
        totalParticipants += participants.size;
      }
    });

    return {
      totalRooms,
      activeRooms,
      totalParticipants,
      totalTranslations,
      averageParticipantsPerRoom: totalRooms > 0 ? totalParticipants / totalRooms : 0,
    };
  }

  /**
   * Clean up inactive rooms
   * @param {number} inactiveThreshold - Threshold in milliseconds
   * @returns {Promise<Array>} List of cleaned up rooms
   */
  async cleanupInactiveRooms(inactiveThreshold = 30 * 60 * 1000) {
    // 30 minutes default
    const cleanedRooms = [];
    const now = Date.now();

    for (const [roomName, state] of this.roomStates.entries()) {
      if (state.status === 'empty' && now - state.lastActivity > inactiveThreshold) {
        try {
          await this.destroyRoom(roomName);
          cleanedRooms.push(roomName);
          logger.info(`Cleaned up inactive room: ${roomName}`);
        } catch (error) {
          logger.error(`Failed to cleanup room ${roomName}:`, error);
        }
      }
    }

    return cleanedRooms;
  }
}

module.exports = EchoRTCRoomManager;
