/**
 * Echo Mobile App - RTC Manager Service
 * Handles WebRTC connections and real-time communication
 */

import { Platform } from 'react-native';

// Utils
import { Logger } from '../utils/Logger';
import { EventEmitter } from '../utils/EventEmitter';

// WebRTC polyfill for React Native
import {
  RTCPeerConnection,
  RTCIceCandidate,
  RTCSessionDescription,
  mediaDevices,
  MediaStream,
  MediaStreamTrack,
} from 'react-native-webrtc';

class RTCManagerService extends EventEmitter {
  constructor() {
    super();

    this.peerConnection = null;
    this.localStream = null;
    this.remoteStreams = new Map();
    this.dataChannel = null;
    this.isInitialized = false;

    // Connection state
    this.connectionState = 'disconnected';
    this.roomId = null;
    this.userId = null;
    this.sessionId = null;

    // Participants
    this.participants = new Map();

    // Configuration
    this.config = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ],
      iceCandidatePoolSize: 10,
    };

    // Media constraints
    this.mediaConstraints = {
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        sampleRate: 44100,
      },
      video: {
        width: { min: 640, ideal: 1280, max: 1920 },
        height: { min: 480, ideal: 720, max: 1080 },
        frameRate: { min: 15, ideal: 30, max: 60 },
        facingMode: 'user',
      },
    };

    // Statistics
    this.stats = {
      packetsLost: 0,
      packetsReceived: 0,
      packetsSent: 0,
      bytesReceived: 0,
      bytesSent: 0,
      jitter: 0,
      rtt: 0,
      audioLevel: 0,
    };

    // Reconnection
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
  }

  /**
   * Initialize the RTC system
   */
  async initialize() {
    try {
      Logger.info('RTCManager', 'Initializing RTC system...');

      // Check WebRTC support
      if (!RTCPeerConnection) {
        throw new Error('WebRTC is not supported on this device');
      }

      this.isInitialized = true;
      this.emit('initialized');

      Logger.info('RTCManager', 'RTC system initialized successfully');
    } catch (error) {
      Logger.error('RTCManager', 'Failed to initialize RTC system:', error);
      throw error;
    }
  }

  /**
   * Create peer connection
   */
  createPeerConnection() {
    try {
      if (this.peerConnection) {
        this.peerConnection.close();
      }

      this.peerConnection = new RTCPeerConnection(this.config);

      // Setup event listeners
      this.setupPeerConnectionListeners();

      Logger.info('RTCManager', 'Peer connection created');
      return this.peerConnection;
    } catch (error) {
      Logger.error('RTCManager', 'Failed to create peer connection:', error);
      throw error;
    }
  }

  /**
   * Setup peer connection event listeners
   */
  setupPeerConnectionListeners() {
    if (!this.peerConnection) return;

    // Connection state changes
    this.peerConnection.onconnectionstatechange = () => {
      const state = this.peerConnection.connectionState;
      this.connectionState = state;

      Logger.info('RTCManager', 'Connection state changed:', state);
      this.emit('connectionStateChange', state);

      if (state === 'failed') {
        this.handleConnectionFailure();
      }
    };

    // ICE connection state changes
    this.peerConnection.oniceconnectionstatechange = () => {
      const state = this.peerConnection.iceConnectionState;
      Logger.info('RTCManager', 'ICE connection state changed:', state);

      if (state === 'disconnected' || state === 'failed') {
        this.handleConnectionFailure();
      }
    };

    // ICE candidates
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        Logger.debug('RTCManager', 'ICE candidate generated');
        this.emit('iceCandidate', event.candidate);
      }
    };

    // Remote stream
    this.peerConnection.onaddstream = (event) => {
      Logger.info('RTCManager', 'Remote stream added');
      const stream = event.stream;
      const participantId = this.getParticipantIdFromStream(stream);

      this.remoteStreams.set(participantId, stream);
      this.emit('remoteStreamAdded', participantId, stream);
    };

    // Data channel
    this.peerConnection.ondatachannel = (event) => {
      const channel = event.channel;
      this.setupDataChannelListeners(channel);
      Logger.info('RTCManager', 'Data channel received');
    };
  }

  /**
   * Setup data channel listeners
   */
  setupDataChannelListeners(channel) {
    channel.onopen = () => {
      Logger.info('RTCManager', 'Data channel opened');
      this.emit('dataChannelOpen', channel);
    };

    channel.onclose = () => {
      Logger.info('RTCManager', 'Data channel closed');
      this.emit('dataChannelClose', channel);
    };

    channel.onmessage = (event) => {
      Logger.debug('RTCManager', 'Data channel message received');
      this.emit('dataChannelMessage', event.data);
    };

    channel.onerror = (error) => {
      Logger.error('RTCManager', 'Data channel error:', error);
      this.emit('dataChannelError', error);
    };
  }

  /**
   * Get user media stream
   */
  async getUserMedia(constraints = {}) {
    try {
      const mediaConstraints = {
        ...this.mediaConstraints,
        ...constraints,
      };

      Logger.info('RTCManager', 'Requesting user media...');

      const stream = await mediaDevices.getUserMedia(mediaConstraints);

      this.localStream = stream;
      this.emit('localStreamReady', stream);

      Logger.info('RTCManager', 'User media obtained successfully');
      return stream;
    } catch (error) {
      Logger.error('RTCManager', 'Failed to get user media:', error);
      throw error;
    }
  }

  /**
   * Join a room
   */
  async joinRoom(roomId, userId, options = {}) {
    try {
      if (!this.isInitialized) {
        throw new Error('RTCManager not initialized');
      }

      Logger.info('RTCManager', `Joining room: ${roomId} as user: ${userId}`);

      this.roomId = roomId;
      this.userId = userId;
      this.sessionId = `${userId}_${Date.now()}`;

      // Create peer connection
      this.createPeerConnection();

      // Get user media if needed
      if (options.audio || options.video) {
        const stream = await this.getUserMedia({
          audio: options.audio,
          video: options.video,
        });

        // Add stream to peer connection
        this.peerConnection.addStream(stream);
      }

      // Create data channel for messaging
      this.dataChannel = this.peerConnection.createDataChannel('messages', {
        ordered: true,
      });
      this.setupDataChannelListeners(this.dataChannel);

      // Simulate room joining (in real implementation, this would involve signaling server)
      const result = {
        room: {
          id: roomId,
          name: `Room ${roomId}`,
          isHost: true,
          maxParticipants: 10,
          participantCount: 1,
          settings: {
            audioOnly: !options.video,
            recordingEnabled: false,
            translationEnabled: true,
            qualityMode: 'auto',
          },
        },
        participants: {},
      };

      this.connectionState = 'connected';
      this.emit('roomJoined', result);

      Logger.info('RTCManager', 'Successfully joined room');
      return result;
    } catch (error) {
      Logger.error('RTCManager', 'Failed to join room:', error);
      this.connectionState = 'failed';
      throw error;
    }
  }

  /**
   * Leave the current room
   */
  async leaveRoom() {
    try {
      Logger.info('RTCManager', 'Leaving room...');

      // Close data channel
      if (this.dataChannel) {
        this.dataChannel.close();
        this.dataChannel = null;
      }

      // Stop local stream
      if (this.localStream) {
        this.localStream.getTracks().forEach(track => track.stop());
        this.localStream = null;
      }

      // Close peer connection
      if (this.peerConnection) {
        this.peerConnection.close();
        this.peerConnection = null;
      }

      // Clear state
      this.remoteStreams.clear();
      this.participants.clear();
      this.connectionState = 'disconnected';
      this.roomId = null;
      this.userId = null;
      this.sessionId = null;

      this.emit('roomLeft');
      Logger.info('RTCManager', 'Successfully left room');
    } catch (error) {
      Logger.error('RTCManager', 'Error leaving room:', error);
      throw error;
    }
  }

  /**
   * Reconnect to the room
   */
  async reconnect() {
    try {
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        throw new Error('Maximum reconnection attempts reached');
      }

      this.reconnectAttempts++;
      Logger.info('RTCManager', `Reconnection attempt ${this.reconnectAttempts}`);

      // Wait before reconnecting
      await new Promise(resolve => setTimeout(resolve, this.reconnectDelay * this.reconnectAttempts));

      // Rejoin the room
      if (this.roomId && this.userId) {
        await this.joinRoom(this.roomId, this.userId, {
          audio: this.localStream?.getAudioTracks().length > 0,
          video: this.localStream?.getVideoTracks().length > 0,
        });

        this.reconnectAttempts = 0;
        Logger.info('RTCManager', 'Reconnection successful');
      }
    } catch (error) {
      Logger.error('RTCManager', 'Reconnection failed:', error);
      throw error;
    }
  }

  /**
   * Handle connection failure
   */
  handleConnectionFailure() {
    Logger.warn('RTCManager', 'Connection failure detected');

    if (this.roomId) {
      // Attempt to reconnect after a delay
      setTimeout(() => {
        this.reconnect().catch(error => {
          Logger.error('RTCManager', 'Auto-reconnection failed:', error);
          this.emit('reconnectionFailed', error);
        });
      }, 2000);
    }
  }

  /**
   * Enable local audio
   */
  async enableLocalAudio() {
    try {
      if (!this.localStream) {
        const stream = await this.getUserMedia({ audio: true, video: false });
        if (this.peerConnection) {
          this.peerConnection.addStream(stream);
        }
      } else {
        const audioTracks = this.localStream.getAudioTracks();
        audioTracks.forEach(track => {
          track.enabled = true;
        });
      }

      Logger.info('RTCManager', 'Local audio enabled');
    } catch (error) {
      Logger.error('RTCManager', 'Failed to enable local audio:', error);
      throw error;
    }
  }

  /**
   * Disable local audio
   */
  async disableLocalAudio() {
    try {
      if (this.localStream) {
        const audioTracks = this.localStream.getAudioTracks();
        audioTracks.forEach(track => {
          track.enabled = false;
        });
      }

      Logger.info('RTCManager', 'Local audio disabled');
    } catch (error) {
      Logger.error('RTCManager', 'Failed to disable local audio:', error);
      throw error;
    }
  }

  /**
   * Mute local audio
   */
  async muteLocalAudio() {
    try {
      if (this.localStream) {
        const audioTracks = this.localStream.getAudioTracks();
        audioTracks.forEach(track => {
          track.enabled = false;
        });
      }

      Logger.info('RTCManager', 'Local audio muted');
    } catch (error) {
      Logger.error('RTCManager', 'Failed to mute local audio:', error);
      throw error;
    }
  }

  /**
   * Unmute local audio
   */
  async unmuteLocalAudio() {
    try {
      if (this.localStream) {
        const audioTracks = this.localStream.getAudioTracks();
        audioTracks.forEach(track => {
          track.enabled = true;
        });
      }

      Logger.info('RTCManager', 'Local audio unmuted');
    } catch (error) {
      Logger.error('RTCManager', 'Failed to unmute local audio:', error);
      throw error;
    }
  }

  /**
   * Enable local video
   */
  async enableLocalVideo() {
    try {
      if (!this.localStream || this.localStream.getVideoTracks().length === 0) {
        const stream = await this.getUserMedia({ audio: false, video: true });
        if (this.peerConnection) {
          this.peerConnection.addStream(stream);
        }
      } else {
        const videoTracks = this.localStream.getVideoTracks();
        videoTracks.forEach(track => {
          track.enabled = true;
        });
      }

      Logger.info('RTCManager', 'Local video enabled');
    } catch (error) {
      Logger.error('RTCManager', 'Failed to enable local video:', error);
      throw error;
    }
  }

  /**
   * Disable local video
   */
  async disableLocalVideo() {
    try {
      if (this.localStream) {
        const videoTracks = this.localStream.getVideoTracks();
        videoTracks.forEach(track => {
          track.enabled = false;
        });
      }

      Logger.info('RTCManager', 'Local video disabled');
    } catch (error) {
      Logger.error('RTCManager', 'Failed to disable local video:', error);
      throw error;
    }
  }

  /**
   * Mute local video
   */
  async muteLocalVideo() {
    try {
      if (this.localStream) {
        const videoTracks = this.localStream.getVideoTracks();
        videoTracks.forEach(track => {
          track.enabled = false;
        });
      }

      Logger.info('RTCManager', 'Local video muted');
    } catch (error) {
      Logger.error('RTCManager', 'Failed to mute local video:', error);
      throw error;
    }
  }

  /**
   * Unmute local video
   */
  async unmuteLocalVideo() {
    try {
      if (this.localStream) {
        const videoTracks = this.localStream.getVideoTracks();
        videoTracks.forEach(track => {
          track.enabled = true;
        });
      }

      Logger.info('RTCManager', 'Local video unmuted');
    } catch (error) {
      Logger.error('RTCManager', 'Failed to unmute local video:', error);
      throw error;
    }
  }

  /**
   * Send data channel message
   */
  sendMessage(message) {
    try {
      if (this.dataChannel && this.dataChannel.readyState === 'open') {
        this.dataChannel.send(JSON.stringify(message));
        Logger.debug('RTCManager', 'Message sent via data channel');
      } else {
        throw new Error('Data channel not available');
      }
    } catch (error) {
      Logger.error('RTCManager', 'Failed to send message:', error);
      throw error;
    }
  }

  /**
   * Update room settings
   */
  async updateRoomSettings(settings) {
    try {
      // Send settings update via data channel
      this.sendMessage({
        type: 'roomSettingsUpdate',
        settings,
        timestamp: Date.now(),
      });

      Logger.info('RTCManager', 'Room settings updated');
    } catch (error) {
      Logger.error('RTCManager', 'Failed to update room settings:', error);
      throw error;
    }
  }

  /**
   * Get connection statistics
   */
  async getStats() {
    try {
      if (!this.peerConnection) {
        return this.stats;
      }

      const stats = await this.peerConnection.getStats();
      const parsedStats = this.parseStats(stats);

      this.stats = { ...this.stats, ...parsedStats };
      return this.stats;
    } catch (error) {
      Logger.error('RTCManager', 'Failed to get stats:', error);
      return this.stats;
    }
  }

  /**
   * Parse WebRTC statistics
   */
  parseStats(stats) {
    const parsedStats = {};

    stats.forEach(report => {
      if (report.type === 'inbound-rtp' && report.mediaType === 'audio') {
        parsedStats.packetsReceived = report.packetsReceived || 0;
        parsedStats.bytesReceived = report.bytesReceived || 0;
        parsedStats.packetsLost = report.packetsLost || 0;
        parsedStats.jitter = report.jitter || 0;
      } else if (report.type === 'outbound-rtp' && report.mediaType === 'audio') {
        parsedStats.packetsSent = report.packetsSent || 0;
        parsedStats.bytesSent = report.bytesSent || 0;
      } else if (report.type === 'candidate-pair' && report.state === 'succeeded') {
        parsedStats.rtt = report.currentRoundTripTime || 0;
      }
    });

    return parsedStats;
  }

  /**
   * Get participant ID from stream (placeholder implementation)
   */
  getParticipantIdFromStream(stream) {
    // In a real implementation, this would extract participant ID from stream metadata
    return `participant_${Date.now()}`;
  }

  /**
   * Get current connection state
   */
  getConnectionState() {
    return this.connectionState;
  }

  /**
   * Get local stream
   */
  getLocalStream() {
    return this.localStream;
  }

  /**
   * Get remote streams
   */
  getRemoteStreams() {
    return Array.from(this.remoteStreams.values());
  }

  /**
   * Get participants
   */
  getParticipants() {
    return Array.from(this.participants.values());
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    try {
      Logger.info('RTCManager', 'Cleaning up RTC resources...');

      // Leave room if connected
      if (this.connectionState === 'connected') {
        await this.leaveRoom();
      }

      // Remove all listeners
      this.removeAllListeners();

      // Reset state
      this.isInitialized = false;
      this.reconnectAttempts = 0;

      Logger.info('RTCManager', 'RTC resources cleaned up successfully');
    } catch (error) {
      Logger.error('RTCManager', 'Error during cleanup:', error);
    }
  }
}

// Export singleton instance
export const RTCManager = RTCManagerService;
export default RTCManager;