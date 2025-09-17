/**
 * Test Configuration for Echo RTC Integration Tests
 * Provides mock configurations and utilities for testing
 */

const sinon = require('sinon');

/**
 * Default test configuration
 */
const defaultTestConfig = {
  server: {
    url: 'ws://localhost:8080/echo-rtc',
    reconnectInterval: 100, // Faster for tests
    maxReconnectAttempts: 2, // Fewer attempts for tests
    heartbeatInterval: 1000,
    connectionTimeout: 2000,
  },
  webrtc: {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      {
        urls: 'turn:test-turn.example.com:3478',
        username: 'testuser',
        credential: 'testpass',
      },
    ],
    iceTransportPolicy: 'all',
    bundlePolicy: 'balanced',
    rtcpMuxPolicy: 'require',
    iceCandidatePoolSize: 10,
  },
  audio: {
    sampleRate: 16000,
    channels: 1,
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
    bufferSize: 4096,
  },
  room: {
    defaultMaxParticipants: 10,
    allowPrivateRooms: true,
    requirePassword: false,
    autoCleanupInterval: 5000, // 5 seconds for tests
    participantTimeout: 10000,
  },
  translation: {
    enabled: true,
    supportedLanguages: ['en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'zh', 'ja', 'ko'],
    defaultSourceLanguage: 'en',
    autoDetectLanguage: true,
    translationQuality: 'standard',
    maxTranslationLength: 1000,
  },
  dataChannel: {
    ordered: true,
    maxRetransmits: 3,
    maxPacketLifeTime: null,
    protocol: 'echo-rtc-v1',
  },
  security: {
    enableEncryption: true,
    keyRotationInterval: 300000, // 5 minutes
    maxSessionDuration: 3600000, // 1 hour
    allowedOrigins: ['http://localhost:3000', 'https://echo-app.example.com'],
  },
  performance: {
    enableStats: true,
    statsInterval: 1000,
    maxConcurrentConnections: 100,
    bandwidthLimit: 1000000, // 1 Mbps
    latencyThreshold: 200, // 200ms
  },
  logging: {
    level: 'debug',
    enableConsole: true,
    enableFile: false,
  },
};

/**
 * Mock WebSocket for testing
 */
class MockWebSocket {
  constructor(url) {
    this.url = url;
    this.readyState = MockWebSocket.CONNECTING;
    this.protocol = '';
    this.extensions = '';
    this.binaryType = 'blob';

    this.onopen = null;
    this.onclose = null;
    this.onmessage = null;
    this.onerror = null;

    this.send = sinon.stub();
    this.close = sinon.stub();

    // Simulate async connection
    setTimeout(() => {
      this.readyState = MockWebSocket.OPEN;
      if (this.onopen) this.onopen();
    }, 10);
  }

  // Simulate receiving a message
  simulateMessage(data) {
    if (this.onmessage) {
      this.onmessage({ data: typeof data === 'string' ? data : JSON.stringify(data) });
    }
  }

  // Simulate connection close
  simulateClose(code = 1000, reason = 'Normal closure') {
    this.readyState = MockWebSocket.CLOSED;
    if (this.onclose) {
      this.onclose({ code, reason, wasClean: code === 1000 });
    }
  }

  // Simulate error
  simulateError(error) {
    if (this.onerror) {
      this.onerror(error);
    }
  }
}

// WebSocket constants
MockWebSocket.CONNECTING = 0;
MockWebSocket.OPEN = 1;
MockWebSocket.CLOSING = 2;
MockWebSocket.CLOSED = 3;

/**
 * Mock Translation Manager for testing
 */
class MockTranslationManager {
  constructor() {
    this.translateAudio = sinon.stub();
    this.translateText = sinon.stub();
    this.detectLanguage = sinon.stub();
    this.getSupportedLanguages = sinon.stub();
    this.processAudioStream = sinon.stub();

    // Default responses
    this.translateAudio.resolves({
      translatedText: 'Translated audio text',
      confidence: 0.95,
      sourceLanguage: 'en',
      targetLanguage: 'es',
      processingTime: 150,
    });

    this.translateText.resolves({
      translatedText: 'Translated text',
      confidence: 0.98,
      sourceLanguage: 'en',
      targetLanguage: 'es',
      processingTime: 50,
    });

    this.detectLanguage.resolves({
      language: 'en',
      confidence: 0.92,
    });

    this.getSupportedLanguages.returns(defaultTestConfig.translation.supportedLanguages);
  }

  // Simulate translation error
  simulateTranslationError(error = new Error('Translation service unavailable')) {
    this.translateAudio.rejects(error);
    this.translateText.rejects(error);
  }

  // Reset all stubs
  reset() {
    sinon.resetHistory();
  }
}

/**
 * Mock RTCPeerConnection for testing
 */
class MockRTCPeerConnection {
  constructor(config) {
    this.config = config;
    this.localDescription = null;
    this.remoteDescription = null;
    this.iceConnectionState = 'new';
    this.connectionState = 'new';
    this.signalingState = 'stable';
    this.iceGatheringState = 'new';

    this.onicecandidate = null;
    this.oniceconnectionstatechange = null;
    this.onconnectionstatechange = null;
    this.onsignalingstatechange = null;
    this.ontrack = null;
    this.ondatachannel = null;

    this.createOffer = sinon.stub();
    this.createAnswer = sinon.stub();
    this.setLocalDescription = sinon.stub();
    this.setRemoteDescription = sinon.stub();
    this.addIceCandidate = sinon.stub();
    this.createDataChannel = sinon.stub();
    this.addTransceiver = sinon.stub();
    this.getStats = sinon.stub();
    this.close = sinon.stub();

    // Default responses
    this.createOffer.resolves({ type: 'offer', sdp: 'mock-offer-sdp' });
    this.createAnswer.resolves({ type: 'answer', sdp: 'mock-answer-sdp' });
    this.setLocalDescription.resolves();
    this.setRemoteDescription.resolves();
    this.addIceCandidate.resolves();
    this.getStats.resolves(new Map());

    this.createDataChannel.callsFake((label, options) => {
      return new MockRTCDataChannel(label, options);
    });
  }

  // Simulate ICE candidate
  simulateIceCandidate(candidate = null) {
    if (this.onicecandidate) {
      this.onicecandidate({
        candidate: candidate || {
          candidate: 'candidate:1 1 UDP 2130706431 192.168.1.100 54400 typ host',
          sdpMLineIndex: 0,
          sdpMid: '0',
        },
      });
    }
  }

  // Simulate connection state change
  simulateConnectionStateChange(state) {
    this.connectionState = state;
    if (this.onconnectionstatechange) {
      this.onconnectionstatechange();
    }
  }

  // Simulate ICE connection state change
  simulateIceConnectionStateChange(state) {
    this.iceConnectionState = state;
    if (this.oniceconnectionstatechange) {
      this.oniceconnectionstatechange();
    }
  }

  // Simulate remote track
  simulateRemoteTrack(track, streams = []) {
    if (this.ontrack) {
      this.ontrack({ track, streams });
    }
  }
}

/**
 * Mock RTCDataChannel for testing
 */
class MockRTCDataChannel {
  constructor(label, options = {}) {
    this.label = label;
    this.readyState = 'connecting';
    this.bufferedAmount = 0;
    this.maxPacketLifeTime = options.maxPacketLifeTime || null;
    this.maxRetransmits = options.maxRetransmits || null;
    this.ordered = options.ordered !== false;

    this.onopen = null;
    this.onclose = null;
    this.onmessage = null;
    this.onerror = null;

    this.send = sinon.stub();
    this.close = sinon.stub();

    // Simulate opening
    setTimeout(() => {
      this.readyState = 'open';
      if (this.onopen) this.onopen();
    }, 20);
  }

  // Simulate receiving message
  simulateMessage(data) {
    if (this.onmessage) {
      this.onmessage({ data });
    }
  }

  // Simulate close
  simulateClose() {
    this.readyState = 'closed';
    if (this.onclose) this.onclose();
  }

  // Simulate error
  simulateError(error) {
    if (this.onerror) this.onerror(error);
  }
}

/**
 * Mock MediaStream for testing
 */
class MockMediaStream {
  constructor(tracks = []) {
    this.id = `stream-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.active = true;
    this.tracks = tracks;

    this.onaddtrack = null;
    this.onremovetrack = null;

    this.getTracks = sinon.stub().returns(this.tracks);
    this.getAudioTracks = sinon.stub().returns(this.tracks.filter((t) => t.kind === 'audio'));
    this.getVideoTracks = sinon.stub().returns(this.tracks.filter((t) => t.kind === 'video'));
    this.addTrack = sinon.stub();
    this.removeTrack = sinon.stub();
    this.clone = sinon.stub().returns(new MockMediaStream([...this.tracks]));
  }
}

/**
 * Mock MediaStreamTrack for testing
 */
class MockMediaStreamTrack {
  constructor(kind = 'audio') {
    this.id = `track-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.kind = kind;
    this.label = `Mock ${kind} track`;
    this.enabled = true;
    this.muted = false;
    this.readyState = 'live';

    this.onended = null;
    this.onmute = null;
    this.onunmute = null;

    this.stop = sinon.stub();
    this.clone = sinon.stub().returns(new MockMediaStreamTrack(kind));
    this.getConstraints = sinon.stub().returns({});
    this.getSettings = sinon.stub().returns({ deviceId: 'mock-device' });
    this.getCapabilities = sinon.stub().returns({ deviceId: 'mock-device' });
    this.applyConstraints = sinon.stub().resolves();
  }
}

/**
 * Test utilities
 */
const testUtils = {
  /**
   * Create a test configuration with overrides
   * @param {Object} overrides - Configuration overrides
   * @returns {Object} Test configuration
   */
  createTestConfig(overrides = {}) {
    return {
      ...defaultTestConfig,
      ...overrides,
    };
  },

  /**
   * Set up global mocks for WebRTC APIs
   */
  setupWebRTCMocks() {
    global.RTCPeerConnection = MockRTCPeerConnection;
    global.RTCDataChannel = MockRTCDataChannel;
    global.MediaStream = MockMediaStream;
    global.MediaStreamTrack = MockMediaStreamTrack;
    global.WebSocket = MockWebSocket;

    global.navigator = {
      mediaDevices: {
        getUserMedia: sinon
          .stub()
          .resolves(new MockMediaStream([new MockMediaStreamTrack('audio')])),
        enumerateDevices: sinon.stub().resolves([
          {
            deviceId: 'mock-audio-input',
            kind: 'audioinput',
            label: 'Mock Microphone',
            groupId: 'mock-group',
          },
        ]),
      },
    };
  },

  /**
   * Clean up global mocks
   */
  cleanupMocks() {
    delete global.RTCPeerConnection;
    delete global.RTCDataChannel;
    delete global.MediaStream;
    delete global.MediaStreamTrack;
    delete global.WebSocket;
    delete global.navigator;
  },

  /**
   * Create a mock participant
   * @param {Object} overrides - Participant overrides
   * @returns {Object} Mock participant
   */
  createMockParticipant(overrides = {}) {
    return {
      id: `participant-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: 'Test User',
      language: 'en',
      isHost: false,
      joinedAt: Date.now(),
      ...overrides,
    };
  },

  /**
   * Create a mock room configuration
   * @param {Object} overrides - Room configuration overrides
   * @returns {Object} Mock room configuration
   */
  createMockRoomConfig(overrides = {}) {
    return {
      name: `test-room-${Date.now()}`,
      maxParticipants: 10,
      isPrivate: false,
      password: null,
      translationEnabled: true,
      supportedLanguages: ['en', 'es', 'fr'],
      autoCleanup: true,
      ...overrides,
    };
  },

  /**
   * Wait for a specified amount of time
   * @param {number} ms - Milliseconds to wait
   * @returns {Promise} Promise that resolves after the specified time
   */
  wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  },

  /**
   * Wait for an event to be emitted
   * @param {EventEmitter} emitter - Event emitter
   * @param {string} event - Event name
   * @param {number} timeout - Timeout in milliseconds
   * @returns {Promise} Promise that resolves with the event data
   */
  waitForEvent(emitter, event, timeout = 5000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Timeout waiting for event: ${event}`));
      }, timeout);

      emitter.once(event, (data) => {
        clearTimeout(timer);
        resolve(data);
      });
    });
  },
};

// Export everything
module.exports = {
  defaultTestConfig,
  MockWebSocket,
  MockTranslationManager,
  MockRTCPeerConnection,
  MockRTCDataChannel,
  MockMediaStream,
  MockMediaStreamTrack,
  testUtils,
};
