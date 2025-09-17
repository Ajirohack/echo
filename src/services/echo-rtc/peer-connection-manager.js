/**
 * Echo RTC Peer Connection Manager
 * Manages WebRTC peer connections, ICE handling, and media streams
 */

const EventEmitter = require('events');
const { logger } = require('../../utils/logger');

class PeerConnectionManager extends EventEmitter {
  constructor(config = {}) {
    super();

    this.config = config;
    this.peerConnections = new Map();
    this.dataChannels = new Map();
    this.localStream = null;
    this.remoteStreams = new Map();

    // Connection state tracking
    this.connectionStates = new Map();
    this.iceGatheringStates = new Map();
    this.signalingStates = new Map();

    // Statistics
    this.stats = {
      totalConnections: 0,
      activeConnections: 0,
      failedConnections: 0,
      totalDataTransferred: 0,
      averageLatency: 0,
    };

    // ICE candidate queue for early candidates
    this.iceCandidateQueue = new Map();

    // Connection timeout handling
    this.connectionTimeouts = new Map();
    this.connectionTimeout = config.connectionTimeout || 30000; // 30 seconds
  }

  /**
   * Create a new peer connection
   * @param {string} participantId - Participant ID
   * @param {Object} options - Connection options
   * @returns {RTCPeerConnection} Peer connection
   */
  createPeerConnection(participantId, options = {}) {
    try {
      if (this.peerConnections.has(participantId)) {
        logger.warn(`Peer connection already exists for ${participantId}`);
        return this.peerConnections.get(participantId);
      }

      const pcConfig = {
        iceServers: this.config.rtc?.iceServers || [{ urls: 'stun:stun.l.google.com:19302' }],
        sdpSemantics: this.config.rtc?.sdpSemantics || 'unified-plan',
        bundlePolicy: this.config.rtc?.bundlePolicy || 'balanced',
        rtcpMuxPolicy: this.config.rtc?.rtcpMuxPolicy || 'require',
        iceCandidatePoolSize: this.config.rtc?.iceCandidatePoolSize || 10,
        iceTransportPolicy: this.config.rtc?.iceTransportPolicy || 'all',
      };

      const peerConnection = new RTCPeerConnection(pcConfig);

      // Set up event listeners
      this.setupPeerConnectionListeners(peerConnection, participantId);

      // Add local stream if available
      if (this.localStream) {
        this.addLocalStreamToPeerConnection(peerConnection, this.localStream);
      }

      // Create data channel for translation and control messages
      const dataChannel = this.createDataChannel(peerConnection, participantId, options);

      // Store connections
      this.peerConnections.set(participantId, peerConnection);
      this.dataChannels.set(participantId, dataChannel);

      // Initialize state tracking
      this.connectionStates.set(participantId, 'new');
      this.iceGatheringStates.set(participantId, 'new');
      this.signalingStates.set(participantId, 'stable');
      this.iceCandidateQueue.set(participantId, []);

      // Set connection timeout
      this.setConnectionTimeout(participantId);

      this.stats.totalConnections++;
      this.stats.activeConnections++;

      logger.info(`Created peer connection for ${participantId}`);
      this.emit('peerConnectionCreated', { participantId, peerConnection });

      return peerConnection;
    } catch (error) {
      logger.error(`Failed to create peer connection for ${participantId}:`, error);
      this.stats.failedConnections++;
      throw error;
    }
  }

  /**
   * Set up peer connection event listeners
   * @private
   * @param {RTCPeerConnection} peerConnection - Peer connection
   * @param {string} participantId - Participant ID
   */
  setupPeerConnectionListeners(peerConnection, participantId) {
    // ICE candidate handling
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        logger.debug(`ICE candidate for ${participantId}:`, event.candidate);
        this.emit('iceCandidate', {
          participantId,
          candidate: event.candidate,
        });
      } else {
        logger.debug(`ICE gathering complete for ${participantId}`);
        this.emit('iceGatheringComplete', { participantId });
      }
    };

    // Connection state changes
    peerConnection.onconnectionstatechange = () => {
      const state = peerConnection.connectionState;
      this.connectionStates.set(participantId, state);

      logger.info(`Connection state changed for ${participantId}: ${state}`);
      this.emit('connectionStateChange', { participantId, state });

      switch (state) {
        case 'connected':
          this.handleConnectionEstablished(participantId);
          break;
        case 'disconnected':
          this.handleConnectionDisconnected(participantId);
          break;
        case 'failed':
          this.handleConnectionFailed(participantId);
          break;
        case 'closed':
          this.handleConnectionClosed(participantId);
          break;
      }
    };

    // ICE connection state changes
    peerConnection.oniceconnectionstatechange = () => {
      const state = peerConnection.iceConnectionState;
      logger.debug(`ICE connection state for ${participantId}: ${state}`);
      this.emit('iceConnectionStateChange', { participantId, state });
    };

    // ICE gathering state changes
    peerConnection.onicegatheringstatechange = () => {
      const state = peerConnection.iceGatheringState;
      this.iceGatheringStates.set(participantId, state);
      logger.debug(`ICE gathering state for ${participantId}: ${state}`);
      this.emit('iceGatheringStateChange', { participantId, state });
    };

    // Signaling state changes
    peerConnection.onsignalingstatechange = () => {
      const state = peerConnection.signalingState;
      this.signalingStates.set(participantId, state);
      logger.debug(`Signaling state for ${participantId}: ${state}`);
      this.emit('signalingStateChange', { participantId, state });
    };

    // Remote stream handling
    peerConnection.ontrack = (event) => {
      logger.info(`Received remote track from ${participantId}`);
      this.handleRemoteTrack(event, participantId);
    };

    // Data channel handling
    peerConnection.ondatachannel = (event) => {
      logger.info(`Received data channel from ${participantId}`);
      this.handleIncomingDataChannel(event.channel, participantId);
    };
  }

  /**
   * Create data channel
   * @private
   * @param {RTCPeerConnection} peerConnection - Peer connection
   * @param {string} participantId - Participant ID
   * @param {Object} options - Data channel options
   * @returns {RTCDataChannel} Data channel
   */
  createDataChannel(peerConnection, participantId, options = {}) {
    const dataChannelOptions = {
      ordered: options.ordered !== false,
      maxRetransmits: options.maxRetransmits || 3,
      maxPacketLifeTime: options.maxPacketLifeTime || null,
      protocol: options.protocol || 'echo-rtc',
      negotiated: options.negotiated || false,
      id: options.id || null,
    };

    const dataChannel = peerConnection.createDataChannel('echo-rtc', dataChannelOptions);

    this.setupDataChannelListeners(dataChannel, participantId);

    return dataChannel;
  }

  /**
   * Set up data channel event listeners
   * @private
   * @param {RTCDataChannel} dataChannel - Data channel
   * @param {string} participantId - Participant ID
   */
  setupDataChannelListeners(dataChannel, participantId) {
    dataChannel.onopen = () => {
      logger.info(`Data channel opened with ${participantId}`);
      this.emit('dataChannelOpen', { participantId, dataChannel });
    };

    dataChannel.onclose = () => {
      logger.info(`Data channel closed with ${participantId}`);
      this.emit('dataChannelClose', { participantId });
    };

    dataChannel.onerror = (error) => {
      logger.error(`Data channel error with ${participantId}:`, error);
      this.emit('dataChannelError', { participantId, error });
    };

    dataChannel.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        this.handleDataChannelMessage(message, participantId);
      } catch (error) {
        logger.error(`Failed to parse data channel message from ${participantId}:`, error);
      }
    };
  }

  /**
   * Handle incoming data channel
   * @private
   * @param {RTCDataChannel} dataChannel - Incoming data channel
   * @param {string} participantId - Participant ID
   */
  handleIncomingDataChannel(dataChannel, participantId) {
    this.setupDataChannelListeners(dataChannel, participantId);

    // Replace existing data channel if any
    const existingChannel = this.dataChannels.get(participantId);
    if (existingChannel && existingChannel.readyState !== 'closed') {
      existingChannel.close();
    }

    this.dataChannels.set(participantId, dataChannel);
  }

  /**
   * Add local stream to peer connection
   * @private
   * @param {RTCPeerConnection} peerConnection - Peer connection
   * @param {MediaStream} stream - Local stream
   */
  addLocalStreamToPeerConnection(peerConnection, stream) {
    stream.getTracks().forEach((track) => {
      peerConnection.addTrack(track, stream);
      logger.debug(`Added local track to peer connection: ${track.kind}`);
    });
  }

  /**
   * Handle remote track
   * @private
   * @param {RTCTrackEvent} event - Track event
   * @param {string} participantId - Participant ID
   */
  handleRemoteTrack(event, participantId) {
    const [remoteStream] = event.streams;

    if (remoteStream) {
      this.remoteStreams.set(participantId, remoteStream);
      logger.info(`Stored remote stream for ${participantId}`);

      this.emit('remoteStream', {
        participantId,
        stream: remoteStream,
        track: event.track,
      });
    }
  }

  /**
   * Handle data channel message
   * @private
   * @param {Object} message - Data channel message
   * @param {string} participantId - Participant ID
   */
  handleDataChannelMessage(message, participantId) {
    this.stats.totalDataTransferred += JSON.stringify(message).length;

    logger.debug(`Data channel message from ${participantId}:`, message.type);

    switch (message.type) {
      case 'translation':
        this.emit('translationReceived', {
          participantId,
          translation: message.data,
        });
        break;

      case 'ping':
        this.sendDataChannelMessage(participantId, {
          type: 'pong',
          timestamp: Date.now(),
          originalTimestamp: message.timestamp,
        });
        break;

      case 'pong':
        this.handlePongMessage(message, participantId);
        break;

      case 'control':
        this.emit('controlMessage', {
          participantId,
          control: message.data,
        });
        break;

      default:
        this.emit('dataChannelMessage', {
          participantId,
          message,
        });
    }
  }

  /**
   * Handle pong message for latency calculation
   * @private
   * @param {Object} message - Pong message
   * @param {string} participantId - Participant ID
   */
  handlePongMessage(message, participantId) {
    if (message.originalTimestamp) {
      const latency = Date.now() - message.originalTimestamp;
      logger.debug(`Latency to ${participantId}: ${latency}ms`);

      this.emit('latencyMeasured', {
        participantId,
        latency,
      });
    }
  }

  /**
   * Set local stream
   * @param {MediaStream} stream - Local media stream
   */
  setLocalStream(stream) {
    this.localStream = stream;

    // Add to all existing peer connections
    this.peerConnections.forEach((peerConnection, participantId) => {
      this.addLocalStreamToPeerConnection(peerConnection, stream);
    });

    logger.info('Local stream set and added to all peer connections');
    this.emit('localStreamSet', { stream });
  }

  /**
   * Create offer
   * @param {string} participantId - Participant ID
   * @param {Object} options - Offer options
   * @returns {Promise<RTCSessionDescriptionInit>} Offer
   */
  async createOffer(participantId, options = {}) {
    try {
      const peerConnection = this.peerConnections.get(participantId);
      if (!peerConnection) {
        throw new Error(`No peer connection found for ${participantId}`);
      }

      const offer = await peerConnection.createOffer(options);
      await peerConnection.setLocalDescription(offer);

      logger.info(`Created offer for ${participantId}`);
      this.emit('offerCreated', { participantId, offer });

      return offer;
    } catch (error) {
      logger.error(`Failed to create offer for ${participantId}:`, error);
      throw error;
    }
  }

  /**
   * Create answer
   * @param {string} participantId - Participant ID
   * @param {Object} options - Answer options
   * @returns {Promise<RTCSessionDescriptionInit>} Answer
   */
  async createAnswer(participantId, options = {}) {
    try {
      const peerConnection = this.peerConnections.get(participantId);
      if (!peerConnection) {
        throw new Error(`No peer connection found for ${participantId}`);
      }

      const answer = await peerConnection.createAnswer(options);
      await peerConnection.setLocalDescription(answer);

      logger.info(`Created answer for ${participantId}`);
      this.emit('answerCreated', { participantId, answer });

      return answer;
    } catch (error) {
      logger.error(`Failed to create answer for ${participantId}:`, error);
      throw error;
    }
  }

  /**
   * Set remote description
   * @param {string} participantId - Participant ID
   * @param {RTCSessionDescriptionInit} description - Remote description
   * @returns {Promise<void>}
   */
  async setRemoteDescription(participantId, description) {
    try {
      const peerConnection = this.peerConnections.get(participantId);
      if (!peerConnection) {
        throw new Error(`No peer connection found for ${participantId}`);
      }

      await peerConnection.setRemoteDescription(description);

      // Process queued ICE candidates
      await this.processQueuedIceCandidates(participantId);

      logger.info(`Set remote description for ${participantId}`);
      this.emit('remoteDescriptionSet', { participantId, description });
    } catch (error) {
      logger.error(`Failed to set remote description for ${participantId}:`, error);
      throw error;
    }
  }

  /**
   * Add ICE candidate
   * @param {string} participantId - Participant ID
   * @param {RTCIceCandidateInit} candidate - ICE candidate
   * @returns {Promise<void>}
   */
  async addIceCandidate(participantId, candidate) {
    try {
      const peerConnection = this.peerConnections.get(participantId);
      if (!peerConnection) {
        throw new Error(`No peer connection found for ${participantId}`);
      }

      // Queue candidate if remote description is not set yet
      if (peerConnection.remoteDescription === null) {
        const queue = this.iceCandidateQueue.get(participantId) || [];
        queue.push(candidate);
        this.iceCandidateQueue.set(participantId, queue);
        logger.debug(`Queued ICE candidate for ${participantId}`);
        return;
      }

      await peerConnection.addIceCandidate(candidate);
      logger.debug(`Added ICE candidate for ${participantId}`);
    } catch (error) {
      logger.error(`Failed to add ICE candidate for ${participantId}:`, error);
      // Don't throw error for ICE candidate failures
    }
  }

  /**
   * Process queued ICE candidates
   * @private
   * @param {string} participantId - Participant ID
   * @returns {Promise<void>}
   */
  async processQueuedIceCandidates(participantId) {
    const queue = this.iceCandidateQueue.get(participantId) || [];

    for (const candidate of queue) {
      try {
        await this.addIceCandidate(participantId, candidate);
      } catch (error) {
        logger.error(`Failed to process queued ICE candidate for ${participantId}:`, error);
      }
    }

    // Clear the queue
    this.iceCandidateQueue.set(participantId, []);

    if (queue.length > 0) {
      logger.info(`Processed ${queue.length} queued ICE candidates for ${participantId}`);
    }
  }

  /**
   * Send data channel message
   * @param {string} participantId - Participant ID
   * @param {Object} message - Message to send
   * @returns {boolean} Success status
   */
  sendDataChannelMessage(participantId, message) {
    try {
      const dataChannel = this.dataChannels.get(participantId);
      if (!dataChannel || dataChannel.readyState !== 'open') {
        logger.warn(`Data channel not available for ${participantId}`);
        return false;
      }

      const messageStr = JSON.stringify(message);
      dataChannel.send(messageStr);

      this.stats.totalDataTransferred += messageStr.length;
      logger.debug(`Sent data channel message to ${participantId}: ${message.type}`);

      return true;
    } catch (error) {
      logger.error(`Failed to send data channel message to ${participantId}:`, error);
      return false;
    }
  }

  /**
   * Send translation to participant
   * @param {string} participantId - Participant ID
   * @param {Object} translation - Translation data
   * @returns {boolean} Success status
   */
  sendTranslation(participantId, translation) {
    return this.sendDataChannelMessage(participantId, {
      type: 'translation',
      data: translation,
      timestamp: Date.now(),
    });
  }

  /**
   * Broadcast translation to all participants
   * @param {Object} translation - Translation data
   * @param {string} excludeParticipant - Participant to exclude
   * @returns {number} Number of successful sends
   */
  broadcastTranslation(translation, excludeParticipant = null) {
    let successCount = 0;

    this.dataChannels.forEach((dataChannel, participantId) => {
      if (participantId !== excludeParticipant) {
        if (this.sendTranslation(participantId, translation)) {
          successCount++;
        }
      }
    });

    logger.info(`Broadcasted translation to ${successCount} participants`);
    return successCount;
  }

  /**
   * Measure latency to participant
   * @param {string} participantId - Participant ID
   */
  measureLatency(participantId) {
    this.sendDataChannelMessage(participantId, {
      type: 'ping',
      timestamp: Date.now(),
    });
  }

  /**
   * Get peer connection
   * @param {string} participantId - Participant ID
   * @returns {RTCPeerConnection|null} Peer connection
   */
  getPeerConnection(participantId) {
    return this.peerConnections.get(participantId) || null;
  }

  /**
   * Get data channel
   * @param {string} participantId - Participant ID
   * @returns {RTCDataChannel|null} Data channel
   */
  getDataChannel(participantId) {
    return this.dataChannels.get(participantId) || null;
  }

  /**
   * Get remote stream
   * @param {string} participantId - Participant ID
   * @returns {MediaStream|null} Remote stream
   */
  getRemoteStream(participantId) {
    return this.remoteStreams.get(participantId) || null;
  }

  /**
   * Get connection state
   * @param {string} participantId - Participant ID
   * @returns {string|null} Connection state
   */
  getConnectionState(participantId) {
    return this.connectionStates.get(participantId) || null;
  }

  /**
   * Set connection timeout
   * @private
   * @param {string} participantId - Participant ID
   */
  setConnectionTimeout(participantId) {
    const timeout = setTimeout(() => {
      const state = this.getConnectionState(participantId);
      if (state !== 'connected') {
        logger.warn(`Connection timeout for ${participantId}`);
        this.handleConnectionTimeout(participantId);
      }
    }, this.connectionTimeout);

    this.connectionTimeouts.set(participantId, timeout);
  }

  /**
   * Clear connection timeout
   * @private
   * @param {string} participantId - Participant ID
   */
  clearConnectionTimeout(participantId) {
    const timeout = this.connectionTimeouts.get(participantId);
    if (timeout) {
      clearTimeout(timeout);
      this.connectionTimeouts.delete(participantId);
    }
  }

  /**
   * Handle connection established
   * @private
   * @param {string} participantId - Participant ID
   */
  handleConnectionEstablished(participantId) {
    this.clearConnectionTimeout(participantId);
    logger.info(`Connection established with ${participantId}`);
    this.emit('connectionEstablished', { participantId });
  }

  /**
   * Handle connection disconnected
   * @private
   * @param {string} participantId - Participant ID
   */
  handleConnectionDisconnected(participantId) {
    logger.warn(`Connection disconnected with ${participantId}`);
    this.emit('connectionDisconnected', { participantId });
  }

  /**
   * Handle connection failed
   * @private
   * @param {string} participantId - Participant ID
   */
  handleConnectionFailed(participantId) {
    this.stats.failedConnections++;
    logger.error(`Connection failed with ${participantId}`);
    this.emit('connectionFailed', { participantId });

    // Clean up failed connection
    this.closePeerConnection(participantId);
  }

  /**
   * Handle connection closed
   * @private
   * @param {string} participantId - Participant ID
   */
  handleConnectionClosed(participantId) {
    logger.info(`Connection closed with ${participantId}`);
    this.emit('connectionClosed', { participantId });
  }

  /**
   * Handle connection timeout
   * @private
   * @param {string} participantId - Participant ID
   */
  handleConnectionTimeout(participantId) {
    logger.error(`Connection timeout with ${participantId}`);
    this.emit('connectionTimeout', { participantId });

    // Clean up timed out connection
    this.closePeerConnection(participantId);
  }

  /**
   * Close peer connection
   * @param {string} participantId - Participant ID
   */
  closePeerConnection(participantId) {
    try {
      // Clear timeout
      this.clearConnectionTimeout(participantId);

      // Close data channel
      const dataChannel = this.dataChannels.get(participantId);
      if (dataChannel && dataChannel.readyState !== 'closed') {
        dataChannel.close();
      }

      // Close peer connection
      const peerConnection = this.peerConnections.get(participantId);
      if (peerConnection && peerConnection.connectionState !== 'closed') {
        peerConnection.close();
      }

      // Clean up state
      this.peerConnections.delete(participantId);
      this.dataChannels.delete(participantId);
      this.remoteStreams.delete(participantId);
      this.connectionStates.delete(participantId);
      this.iceGatheringStates.delete(participantId);
      this.signalingStates.delete(participantId);
      this.iceCandidateQueue.delete(participantId);

      this.stats.activeConnections = Math.max(0, this.stats.activeConnections - 1);

      logger.info(`Closed peer connection for ${participantId}`);
      this.emit('peerConnectionClosed', { participantId });
    } catch (error) {
      logger.error(`Error closing peer connection for ${participantId}:`, error);
    }
  }

  /**
   * Close all peer connections
   */
  closeAllConnections() {
    const participantIds = Array.from(this.peerConnections.keys());

    participantIds.forEach((participantId) => {
      this.closePeerConnection(participantId);
    });

    // Stop local stream
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = null;
    }

    logger.info('Closed all peer connections');
    this.emit('allConnectionsClosed');
  }

  /**
   * Get statistics
   * @returns {Object} Connection statistics
   */
  getStatistics() {
    return {
      ...this.stats,
      activeConnections: this.peerConnections.size,
      totalDataChannels: this.dataChannels.size,
      totalRemoteStreams: this.remoteStreams.size,
    };
  }

  /**
   * Get detailed connection info
   * @returns {Array} Connection information
   */
  getConnectionInfo() {
    const connections = [];

    this.peerConnections.forEach((peerConnection, participantId) => {
      connections.push({
        participantId,
        connectionState: this.connectionStates.get(participantId),
        iceConnectionState: peerConnection.iceConnectionState,
        iceGatheringState: this.iceGatheringStates.get(participantId),
        signalingState: this.signalingStates.get(participantId),
        hasDataChannel: this.dataChannels.has(participantId),
        dataChannelState: this.dataChannels.get(participantId)?.readyState,
        hasRemoteStream: this.remoteStreams.has(participantId),
      });
    });

    return connections;
  }
}

module.exports = PeerConnectionManager;
