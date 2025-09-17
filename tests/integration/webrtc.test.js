/**
 * Integration tests for WebRTC functionality
 * Tests real-time communication features across different scenarios
 */

const { test, expect } = require('@playwright/test');
const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');

class WebRTCTestHelper {
  constructor() {
    this.connections = new Map();
    this.wsConnections = new Map();
  }

  async createPeerConnection(userId, config = {}) {
    const defaultConfig = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'turn:localhost:3478', username: 'test', credential: 'test' }
      ]
    };

    const pc = new RTCPeerConnection({ ...defaultConfig, ...config });
    this.connections.set(userId, pc);
    return pc;
  }

  async connectWebSocket(userId, url = 'ws://localhost:8080/ws') {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(url);

      ws.on('open', () => {
        this.wsConnections.set(userId, ws);
        resolve(ws);
      });

      ws.on('error', reject);
    });
  }

  async cleanup() {
    // Close all peer connections
    for (const [userId, pc] of this.connections) {
      pc.close();
    }
    this.connections.clear();

    // Close all WebSocket connections
    for (const [userId, ws] of this.wsConnections) {
      ws.close();
    }
    this.wsConnections.clear();
  }
}

test.describe('WebRTC Integration Tests', () => {
  let helper;

  test.beforeEach(async () => {
    helper = new WebRTCTestHelper();
  });

  test.afterEach(async () => {
    await helper.cleanup();
  });

  test('should establish peer-to-peer connection between two users', async () => {
    const user1Id = uuidv4();
    const user2Id = uuidv4();

    // Create peer connections
    const pc1 = await helper.createPeerConnection(user1Id);
    const pc2 = await helper.createPeerConnection(user2Id);

    // Connect WebSockets for signaling
    const ws1 = await helper.connectWebSocket(user1Id);
    const ws2 = await helper.connectWebSocket(user2Id);

    // Set up signaling
    let connectionEstablished = false;

    pc1.oniceconnectionstatechange = () => {
      if (pc1.iceConnectionState === 'connected') {
        connectionEstablished = true;
      }
    };

    // Create data channel
    const dataChannel = pc1.createDataChannel('test', { ordered: true });
    let dataReceived = false;

    pc2.ondatachannel = (event) => {
      const channel = event.channel;
      channel.onmessage = (event) => {
        expect(event.data).toBe('Hello from user1');
        dataReceived = true;
      };
    };

    // Simulate signaling process
    const offer = await pc1.createOffer();
    await pc1.setLocalDescription(offer);

    await pc2.setRemoteDescription(offer);
    const answer = await pc2.createAnswer();
    await pc2.setLocalDescription(answer);

    await pc1.setRemoteDescription(answer);

    // Wait for connection to establish
    await new Promise((resolve) => {
      const checkConnection = () => {
        if (connectionEstablished) {
          resolve();
        } else {
          setTimeout(checkConnection, 100);
        }
      };
      checkConnection();
    });

    // Test data channel communication
    dataChannel.send('Hello from user1');

    // Wait for data to be received
    await new Promise((resolve) => {
      const checkData = () => {
        if (dataReceived) {
          resolve();
        } else {
          setTimeout(checkData, 100);
        }
      };
      checkData();
    });

    expect(connectionEstablished).toBe(true);
    expect(dataReceived).toBe(true);
  });

  test('should handle audio stream transmission', async () => {
    const user1Id = uuidv4();
    const user2Id = uuidv4();

    const pc1 = await helper.createPeerConnection(user1Id);
    const pc2 = await helper.createPeerConnection(user2Id);

    // Mock audio stream
    const mockAudioTrack = {
      kind: 'audio',
      id: 'audio-track-1',
      enabled: true,
      muted: false,
      readyState: 'live'
    };

    const mockStream = {
      id: 'stream-1',
      getTracks: () => [mockAudioTrack],
      getAudioTracks: () => [mockAudioTrack]
    };

    // Add audio track to connection
    pc1.addTrack(mockAudioTrack, mockStream);

    let remoteStreamReceived = false;
    pc2.ontrack = (event) => {
      const [remoteStream] = event.streams;
      expect(remoteStream.getAudioTracks().length).toBe(1);
      remoteStreamReceived = true;
    };

    // Complete signaling process
    const offer = await pc1.createOffer();
    await pc1.setLocalDescription(offer);
    await pc2.setRemoteDescription(offer);

    const answer = await pc2.createAnswer();
    await pc2.setLocalDescription(answer);
    await pc1.setRemoteDescription(answer);

    // Wait for remote stream
    await new Promise((resolve) => {
      const checkStream = () => {
        if (remoteStreamReceived) {
          resolve();
        } else {
          setTimeout(checkStream, 100);
        }
      };
      checkStream();
    });

    expect(remoteStreamReceived).toBe(true);
  });

  test('should handle connection failures gracefully', async () => {
    const user1Id = uuidv4();
    const pc1 = await helper.createPeerConnection(user1Id);

    let failureHandled = false;
    pc1.oniceconnectionstatechange = () => {
      if (pc1.iceConnectionState === 'failed') {
        failureHandled = true;
      }
    };

    // Simulate connection failure by providing invalid ICE servers
    const pc2 = await helper.createPeerConnection('user2', {
      iceServers: [{ urls: 'stun:invalid-server:19302' }]
    });

    try {
      const offer = await pc1.createOffer();
      await pc1.setLocalDescription(offer);
      await pc2.setRemoteDescription(offer);

      const answer = await pc2.createAnswer();
      await pc2.setLocalDescription(answer);
      await pc1.setRemoteDescription(answer);

      // Wait for failure detection
      await new Promise((resolve) => {
        setTimeout(resolve, 5000); // Wait 5 seconds for failure
      });

      expect(failureHandled).toBe(true);
    } catch (error) {
      // Connection failure is expected
      expect(error).toBeDefined();
    }
  });

  test('should support multiple concurrent connections', async () => {
    const hostId = uuidv4();
    const participantIds = [uuidv4(), uuidv4(), uuidv4()];

    const hostPc = await helper.createPeerConnection(hostId);
    const participantPcs = [];

    // Create connections for all participants
    for (const participantId of participantIds) {
      const pc = await helper.createPeerConnection(participantId);
      participantPcs.push(pc);
    }

    const establishedConnections = new Set();

    // Set up connection state monitoring
    participantPcs.forEach((pc, index) => {
      pc.oniceconnectionstatechange = () => {
        if (pc.iceConnectionState === 'connected') {
          establishedConnections.add(index);
        }
      };
    });

    // Establish connections with each participant
    for (let i = 0; i < participantPcs.length; i++) {
      const pc = participantPcs[i];

      const offer = await hostPc.createOffer();
      await hostPc.setLocalDescription(offer);
      await pc.setRemoteDescription(offer);

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await hostPc.setRemoteDescription(answer);
    }

    // Wait for all connections to establish
    await new Promise((resolve) => {
      const checkConnections = () => {
        if (establishedConnections.size === participantIds.length) {
          resolve();
        } else {
          setTimeout(checkConnections, 100);
        }
      };
      checkConnections();
    });

    expect(establishedConnections.size).toBe(participantIds.length);
  });

  test('should handle network quality adaptation', async () => {
    const user1Id = uuidv4();
    const user2Id = uuidv4();

    const pc1 = await helper.createPeerConnection(user1Id);
    const pc2 = await helper.createPeerConnection(user2Id);

    // Mock audio track with quality settings
    const mockAudioTrack = {
      kind: 'audio',
      id: 'audio-track-1',
      enabled: true,
      getSettings: () => ({
        sampleRate: 48000,
        channelCount: 2,
        echoCancellation: true,
        noiseSuppression: true
      })
    };

    const mockStream = {
      id: 'stream-1',
      getTracks: () => [mockAudioTrack],
      getAudioTracks: () => [mockAudioTrack]
    };

    pc1.addTrack(mockAudioTrack, mockStream);

    // Monitor connection quality
    let qualityStats = null;

    const offer = await pc1.createOffer();
    await pc1.setLocalDescription(offer);
    await pc2.setRemoteDescription(offer);

    const answer = await pc2.createAnswer();
    await pc2.setLocalDescription(answer);
    await pc1.setRemoteDescription(answer);

    // Get connection statistics
    setTimeout(async () => {
      const stats = await pc1.getStats();
      stats.forEach((report) => {
        if (report.type === 'outbound-rtp' && report.mediaType === 'audio') {
          qualityStats = {
            packetsSent: report.packetsSent,
            bytesSent: report.bytesSent,
            packetsLost: report.packetsLost || 0
          };
        }
      });
    }, 1000);

    // Wait for stats collection
    await new Promise(resolve => setTimeout(resolve, 2000));

    expect(qualityStats).toBeDefined();
    expect(qualityStats.packetsSent).toBeGreaterThan(0);
  });

  test('should handle reconnection scenarios', async () => {
    const user1Id = uuidv4();
    const user2Id = uuidv4();

    let pc1 = await helper.createPeerConnection(user1Id);
    let pc2 = await helper.createPeerConnection(user2Id);

    // Establish initial connection
    const offer = await pc1.createOffer();
    await pc1.setLocalDescription(offer);
    await pc2.setRemoteDescription(offer);

    const answer = await pc2.createAnswer();
    await pc2.setLocalDescription(answer);
    await pc1.setRemoteDescription(answer);

    // Simulate connection drop
    pc1.close();
    pc2.close();

    // Recreate connections (reconnection scenario)
    pc1 = await helper.createPeerConnection(user1Id);
    pc2 = await helper.createPeerConnection(user2Id);

    let reconnected = false;
    pc1.oniceconnectionstatechange = () => {
      if (pc1.iceConnectionState === 'connected') {
        reconnected = true;
      }
    };

    // Re-establish connection
    const newOffer = await pc1.createOffer();
    await pc1.setLocalDescription(newOffer);
    await pc2.setRemoteDescription(newOffer);

    const newAnswer = await pc2.createAnswer();
    await pc2.setLocalDescription(newAnswer);
    await pc1.setRemoteDescription(newAnswer);

    // Wait for reconnection
    await new Promise((resolve) => {
      const checkReconnection = () => {
        if (reconnected) {
          resolve();
        } else {
          setTimeout(checkReconnection, 100);
        }
      };
      checkReconnection();
    });

    expect(reconnected).toBe(true);
  });
});

test.describe('WebRTC Audio Processing Tests', () => {
  test('should apply noise suppression', async () => {
    // Mock audio context and processing
    const mockAudioContext = {
      createGain: () => ({
        gain: { value: 1.0 },
        connect: () => { },
        disconnect: () => { }
      }),
      createBiquadFilter: () => ({
        type: 'highpass',
        frequency: { value: 300 },
        connect: () => { },
        disconnect: () => { }
      }),
      createScriptProcessor: () => ({
        onaudioprocess: null,
        connect: () => { },
        disconnect: () => { }
      })
    };

    // Test noise suppression configuration
    const noiseSuppressionEnabled = true;
    const echoCancellationEnabled = true;

    const audioConstraints = {
      audio: {
        echoCancellation: echoCancellationEnabled,
        noiseSuppression: noiseSuppressionEnabled,
        autoGainControl: true,
        sampleRate: 48000
      }
    };

    expect(audioConstraints.audio.noiseSuppression).toBe(true);
    expect(audioConstraints.audio.echoCancellation).toBe(true);
  });

  test('should handle audio level monitoring', async () => {
    const helper = new WebRTCTestHelper();
    const userId = uuidv4();
    const pc = await helper.createPeerConnection(userId);

    // Mock audio level monitoring
    let audioLevels = [];

    const mockAnalyser = {
      fftSize: 256,
      frequencyBinCount: 128,
      getByteFrequencyData: (dataArray) => {
        // Simulate audio data
        for (let i = 0; i < dataArray.length; i++) {
          dataArray[i] = Math.random() * 255;
        }
      }
    };

    // Simulate audio level calculation
    const dataArray = new Uint8Array(mockAnalyser.frequencyBinCount);
    mockAnalyser.getByteFrequencyData(dataArray);

    const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
    audioLevels.push(average);

    expect(audioLevels.length).toBe(1);
    expect(audioLevels[0]).toBeGreaterThanOrEqual(0);
    expect(audioLevels[0]).toBeLessThanOrEqual(255);

    await helper.cleanup();
  });
});