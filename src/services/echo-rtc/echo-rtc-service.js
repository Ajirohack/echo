/**
 * Echo RTC Service
 * Core service for managing WebRTC connections and real-time communication
 * Integrates with echo's proprietary WebRTC infrastructure
 */

const EventEmitter = require('events');
const { logger } = require('../../utils/logger');

class EchoRTCService extends EventEmitter {
  constructor(config = {}) {
    super();

    this.config = {
      server: {
        url: config.server?.url || 'wss://echo-rtc.whytehoux.ai',
        apiKey: config.server?.apiKey || process.env.ECHO_RTC_API_KEY,
        apiSecret: config.server?.apiSecret || process.env.ECHO_RTC_API_SECRET,
      },
      rtc: {
        iceServers: config.rtc?.iceServers || [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
        ],
        sdpSemantics: 'unified-plan',
        bundlePolicy: 'balanced',
        rtcpMuxPolicy: 'require',
      },
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        sampleRate: 16000,
        channelCount: 1,
      },
      ...config,
    };

    // Connection state
    this.isConnected = false;
    this.isInitialized = false;
    this.websocket = null;
    this.localStream = null;

    // Room and peer management
    this.activeRooms = new Map();
    this.peerConnections = new Map();
    this.dataChannels = new Map();

    // Translation integration
    this.translationManager = null;

    // Metrics
    this.metrics = {
      totalRooms: 0,
      totalConnections: 0,
      totalDataTransferred: 0,
      connectionErrors: 0,
      lastConnectionTime: null,
    };
  }

  /**
   * Initialize the Echo RTC service
   * @param {Object} translationManager - Translation manager instance
   * @returns {Promise<void>}
   */
  async initialize(translationManager) {
    try {
      logger.info('Initializing Echo RTC Service...');

      this.translationManager = translationManager;

      // Validate configuration
      this.validateConfig();

      // Initialize WebSocket connection to echo RTC server
      await this.connectToServer();

      // Set up event listeners
      this.setupEventListeners();

      this.isInitialized = true;
      logger.info('Echo RTC Service initialized successfully');

      this.emit('initialized');
    } catch (error) {
      logger.error('Failed to initialize Echo RTC Service:', error);
      throw error;
    }
  }

  /**
   * Validate service configuration
   * @private
   */
  validateConfig() {
    if (!this.config.server.apiKey || !this.config.server.apiSecret) {
      throw new Error('Echo RTC API credentials are required');
    }

    if (!this.config.server.url) {
      throw new Error('Echo RTC server URL is required');
    }
  }

  /**
   * Connect to Echo RTC server via WebSocket
   * @private
   * @returns {Promise<void>}
   */
  async connectToServer() {
    return new Promise((resolve, reject) => {
      try {
        const wsUrl = `${this.config.server.url}?apiKey=${this.config.server.apiKey}`;
        this.websocket = new WebSocket(wsUrl);

        this.websocket.onopen = () => {
          this.isConnected = true;
          this.metrics.lastConnectionTime = Date.now();
          logger.info('Connected to Echo RTC server');
          resolve();
        };

        this.websocket.onclose = (event) => {
          this.isConnected = false;
          logger.warn('Disconnected from Echo RTC server:', event.reason);
          this.emit('disconnected', event);
        };

        this.websocket.onerror = (error) => {
          this.metrics.connectionErrors++;
          logger.error('Echo RTC WebSocket error:', error);
          reject(error);
        };

        this.websocket.onmessage = (event) => {
          this.handleServerMessage(JSON.parse(event.data));
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Set up event listeners
   * @private
   */
  setupEventListeners() {
    // Handle translation events
    if (this.translationManager) {
      this.translationManager.on('translation', (result) => {
        this.broadcastTranslation(result);
      });
    }
  }

  /**
   * Handle messages from Echo RTC server
   * @private
   * @param {Object} message - Server message
   */
  async handleServerMessage(message) {
    try {
      switch (message.type) {
        case 'room-created':
          this.handleRoomCreated(message.data);
          break;
        case 'participant-joined':
          await this.handleParticipantJoined(message.data);
          break;
        case 'participant-left':
          this.handleParticipantLeft(message.data);
          break;
        case 'offer':
          await this.handleOffer(message.data);
          break;
        case 'answer':
          await this.handleAnswer(message.data);
          break;
        case 'ice-candidate':
          await this.handleIceCandidate(message.data);
          break;
        case 'translation-data':
          this.handleTranslationData(message.data);
          break;
        default:
          logger.warn('Unknown message type:', message.type);
      }
    } catch (error) {
      logger.error('Error handling server message:', error);
    }
  }

  /**
   * Create a new room
   * @param {string} roomName - Room name
   * @param {Object} options - Room options
   * @returns {Promise<Object>} Room information
   */
  async createRoom(roomName, options = {}) {
    if (!this.isInitialized || !this.isConnected) {
      throw new Error('Echo RTC Service not initialized or connected');
    }

    try {
      const roomConfig = {
        name: roomName,
        maxParticipants: options.maxParticipants || 10,
        enableTranslation: options.enableTranslation !== false,
        sourceLanguage: options.sourceLanguage || 'auto',
        targetLanguages: options.targetLanguages || ['en'],
        audioConfig: {
          ...this.config.audio,
          ...options.audioConfig,
        },
        createdAt: Date.now(),
      };

      // Send room creation request to server
      await this.sendToServer({
        type: 'create-room',
        data: roomConfig,
      });

      // Store room locally
      this.activeRooms.set(roomName, {
        ...roomConfig,
        participants: new Map(),
        isActive: true,
      });

      this.metrics.totalRooms++;
      logger.info(`Room created: ${roomName}`);

      return roomConfig;
    } catch (error) {
      logger.error(`Failed to create room ${roomName}:`, error);
      throw error;
    }
  }

  /**
   * Join a room
   * @param {string} roomName - Room name
   * @param {Object} participant - Participant information
   * @returns {Promise<Object>} Join result
   */
  async joinRoom(roomName, participant = {}) {
    if (!this.isInitialized || !this.isConnected) {
      throw new Error('Echo RTC Service not initialized or connected');
    }

    try {
      const participantInfo = {
        id:
          participant.id || `participant_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: participant.name || 'Anonymous',
        language: participant.language || 'en',
        joinedAt: Date.now(),
      };

      // Get user media for audio
      await this.getUserMedia();

      // Send join request to server
      await this.sendToServer({
        type: 'join-room',
        data: {
          roomName,
          participant: participantInfo,
        },
      });

      // Update local room state
      const room = this.activeRooms.get(roomName);
      if (room) {
        room.participants.set(participantInfo.id, participantInfo);
      }

      this.metrics.totalConnections++;
      logger.info(`Joined room ${roomName} as ${participantInfo.name}`);

      return {
        success: true,
        participant: participantInfo,
        room: room,
      };
    } catch (error) {
      logger.error(`Failed to join room ${roomName}:`, error);
      throw error;
    }
  }

  /**
   * Get user media (audio)
   * @private
   * @returns {Promise<MediaStream>}
   */
  async getUserMedia() {
    if (this.localStream) {
      return this.localStream;
    }

    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: this.config.audio,
        video: false,
      });

      logger.info('Local audio stream acquired');
      return this.localStream;
    } catch (error) {
      logger.error('Failed to get user media:', error);
      throw error;
    }
  }

  /**
   * Create peer connection
   * @private
   * @param {string} participantId - Participant ID
   * @returns {RTCPeerConnection}
   */
  createPeerConnection(participantId) {
    const peerConnection = new RTCPeerConnection({
      iceServers: this.config.rtc.iceServers,
      sdpSemantics: this.config.rtc.sdpSemantics,
      bundlePolicy: this.config.rtc.bundlePolicy,
      rtcpMuxPolicy: this.config.rtc.rtcpMuxPolicy,
    });

    // Add local stream
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        peerConnection.addTrack(track, this.localStream);
      });
    }

    // Handle ICE candidates
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendToServer({
          type: 'ice-candidate',
          data: {
            candidate: event.candidate,
            participantId,
          },
        });
      }
    };

    // Handle remote stream
    peerConnection.ontrack = (event) => {
      logger.info(`Received remote stream from ${participantId}`);
      this.handleRemoteStream(event.streams[0], participantId);
    };

    // Create data channel for translation data
    const dataChannel = peerConnection.createDataChannel('translation', {
      ordered: true,
    });

    dataChannel.onopen = () => {
      logger.info(`Data channel opened with ${participantId}`);
    };

    dataChannel.onmessage = (event) => {
      this.handleDataChannelMessage(JSON.parse(event.data), participantId);
    };

    this.dataChannels.set(participantId, dataChannel);
    this.peerConnections.set(participantId, peerConnection);

    return peerConnection;
  }

  /**
   * Handle remote audio stream
   * @private
   * @param {MediaStream} stream - Remote stream
   * @param {string} participantId - Participant ID
   */
  async handleRemoteStream(stream, participantId) {
    try {
      // Process audio for translation if enabled
      if (this.translationManager) {
        const audioTrack = stream.getAudioTracks()[0];
        if (audioTrack) {
          // Create audio context for processing
          const audioContext = new AudioContext({ sampleRate: this.config.audio.sampleRate });
          const source = audioContext.createMediaStreamSource(stream);

          // Process audio through translation pipeline
          this.processAudioForTranslation(source, participantId);
        }
      }

      this.emit('remoteStream', { stream, participantId });
    } catch (error) {
      logger.error('Error handling remote stream:', error);
    }
  }

  /**
   * Process audio for translation
   * @private
   * @param {AudioNode} audioSource - Audio source
   * @param {string} participantId - Participant ID
   */
  async processAudioForTranslation(audioSource, participantId) {
    // This will be integrated with the existing translation pipeline
    // For now, we'll emit an event that can be handled by the translation manager
    this.emit('audioForTranslation', { audioSource, participantId });
  }

  /**
   * Broadcast translation to all participants
   * @private
   * @param {Object} translation - Translation result
   */
  broadcastTranslation(translation) {
    const translationData = {
      type: 'translation',
      data: translation,
      timestamp: Date.now(),
    };

    // Send via data channels
    this.dataChannels.forEach((channel, participantId) => {
      if (channel.readyState === 'open') {
        try {
          channel.send(JSON.stringify(translationData));
          this.metrics.totalDataTransferred += JSON.stringify(translationData).length;
        } catch (error) {
          logger.error(`Failed to send translation to ${participantId}:`, error);
        }
      }
    });
  }

  /**
   * Send message to Echo RTC server
   * @private
   * @param {Object} message - Message to send
   * @returns {Promise<void>}
   */
  async sendToServer(message) {
    if (!this.websocket || this.websocket.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket connection not available');
    }

    return new Promise((resolve, reject) => {
      try {
        this.websocket.send(JSON.stringify(message));
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Handle room created event
   * @private
   * @param {Object} data - Room data
   */
  handleRoomCreated(data) {
    logger.info(`Room created on server: ${data.roomName}`);
    this.emit('roomCreated', data);
  }

  /**
   * Handle participant joined event
   * @private
   * @param {Object} data - Participant data
   */
  async handleParticipantJoined(data) {
    try {
      const { participantId, roomName } = data;
      logger.info(`Participant ${participantId} joined room ${roomName}`);

      // Create peer connection for new participant
      const peerConnection = this.createPeerConnection(participantId);

      // Create offer
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);

      // Send offer to server
      await this.sendToServer({
        type: 'offer',
        data: {
          offer,
          participantId,
          roomName,
        },
      });

      this.emit('participantJoined', data);
    } catch (error) {
      logger.error('Error handling participant joined:', error);
    }
  }

  /**
   * Handle participant left event
   * @private
   * @param {Object} data - Participant data
   */
  handleParticipantLeft(data) {
    const { participantId, roomName } = data;
    logger.info(`Participant ${participantId} left room ${roomName}`);

    // Clean up peer connection
    const peerConnection = this.peerConnections.get(participantId);
    if (peerConnection) {
      peerConnection.close();
      this.peerConnections.delete(participantId);
    }

    // Clean up data channel
    const dataChannel = this.dataChannels.get(participantId);
    if (dataChannel) {
      dataChannel.close();
      this.dataChannels.delete(participantId);
    }

    // Update room state
    const room = this.activeRooms.get(roomName);
    if (room) {
      room.participants.delete(participantId);
    }

    this.emit('participantLeft', data);
  }

  /**
   * Handle WebRTC offer
   * @private
   * @param {Object} data - Offer data
   */
  async handleOffer(data) {
    try {
      const { offer, participantId, roomName } = data;

      const peerConnection = this.createPeerConnection(participantId);
      await peerConnection.setRemoteDescription(offer);

      // Create answer
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);

      // Send answer to server
      await this.sendToServer({
        type: 'answer',
        data: {
          answer,
          participantId,
          roomName,
        },
      });
    } catch (error) {
      logger.error('Error handling offer:', error);
    }
  }

  /**
   * Handle WebRTC answer
   * @private
   * @param {Object} data - Answer data
   */
  async handleAnswer(data) {
    try {
      const { answer, participantId } = data;
      const peerConnection = this.peerConnections.get(participantId);

      if (peerConnection) {
        await peerConnection.setRemoteDescription(answer);
      }
    } catch (error) {
      logger.error('Error handling answer:', error);
    }
  }

  /**
   * Handle ICE candidate
   * @private
   * @param {Object} data - ICE candidate data
   */
  async handleIceCandidate(data) {
    try {
      const { candidate, participantId } = data;
      const peerConnection = this.peerConnections.get(participantId);

      if (peerConnection) {
        await peerConnection.addIceCandidate(candidate);
      }
    } catch (error) {
      logger.error('Error handling ICE candidate:', error);
    }
  }

  /**
   * Handle translation data from data channel
   * @private
   * @param {Object} data - Translation data
   * @param {string} participantId - Participant ID
   */
  handleTranslationData(data, participantId) {
    logger.info(`Received translation from ${participantId}:`, data);
    this.emit('translationReceived', { data, participantId });
  }

  /**
   * Handle data channel message
   * @private
   * @param {Object} message - Data channel message
   * @param {string} participantId - Participant ID
   */
  handleDataChannelMessage(message, participantId) {
    switch (message.type) {
      case 'translation':
        this.handleTranslationData(message.data, participantId);
        break;
      default:
        logger.warn('Unknown data channel message type:', message.type);
    }
  }

  /**
   * Leave a room
   * @param {string} roomName - Room name
   * @param {string} participantId - Participant ID
   * @returns {Promise<void>}
   */
  async leaveRoom(roomName, participantId) {
    try {
      // Send leave request to server
      await this.sendToServer({
        type: 'leave-room',
        data: { roomName, participantId },
      });

      // Clean up local state
      const room = this.activeRooms.get(roomName);
      if (room) {
        room.participants.delete(participantId);
      }

      logger.info(`Left room ${roomName}`);
    } catch (error) {
      logger.error(`Failed to leave room ${roomName}:`, error);
      throw error;
    }
  }

  /**
   * Destroy a room
   * @param {string} roomName - Room name
   * @returns {Promise<void>}
   */
  async destroyRoom(roomName) {
    try {
      // Send destroy request to server
      await this.sendToServer({
        type: 'destroy-room',
        data: { roomName },
      });

      // Clean up local state
      this.activeRooms.delete(roomName);

      logger.info(`Room destroyed: ${roomName}`);
    } catch (error) {
      logger.error(`Failed to destroy room ${roomName}:`, error);
      throw error;
    }
  }

  /**
   * Get room information
   * @param {string} roomName - Room name
   * @returns {Object|null} Room information
   */
  getRoomInfo(roomName) {
    return this.activeRooms.get(roomName) || null;
  }

  /**
   * Get active connections count
   * @returns {number} Number of active connections
   */
  getActiveConnections() {
    return this.peerConnections.size;
  }

  /**
   * Get service metrics
   * @returns {Object} Service metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      activeRooms: this.activeRooms.size,
      activePeerConnections: this.peerConnections.size,
      activeDataChannels: this.dataChannels.size,
    };
  }

  /**
   * Disconnect from Echo RTC service
   * @returns {Promise<void>}
   */
  async disconnect() {
    try {
      // Close all peer connections
      this.peerConnections.forEach((pc, participantId) => {
        pc.close();
      });
      this.peerConnections.clear();

      // Close all data channels
      this.dataChannels.forEach((dc, participantId) => {
        dc.close();
      });
      this.dataChannels.clear();

      // Stop local stream
      if (this.localStream) {
        this.localStream.getTracks().forEach((track) => track.stop());
        this.localStream = null;
      }

      // Close WebSocket connection
      if (this.websocket) {
        this.websocket.close();
        this.websocket = null;
      }

      this.isConnected = false;
      this.isInitialized = false;
      this.activeRooms.clear();

      logger.info('Disconnected from Echo RTC service');
      this.emit('disconnected');
    } catch (error) {
      logger.error('Error during disconnect:', error);
      throw error;
    }
  }
}

module.exports = EchoRTCService;
