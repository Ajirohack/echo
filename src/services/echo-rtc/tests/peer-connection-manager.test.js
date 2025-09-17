/**
 * Peer Connection Manager Integration Tests
 * Tests WebRTC peer connection functionality
 */

const { expect } = require('chai');
const sinon = require('sinon');
const EventEmitter = require('events');
const PeerConnectionManager = require('../peer-connection-manager');

// Mock RTCPeerConnection
class MockRTCPeerConnection extends EventEmitter {
  constructor(config) {
    super();
    this.localDescription = null;
    this.remoteDescription = null;
    this.iceConnectionState = 'new';
    this.connectionState = 'new';
    this.signalingState = 'stable';
    this.iceGatheringState = 'new';
    this.config = config;
    this.dataChannels = new Map();
    this.transceivers = [];

    // Mock methods
    this.createOffer = sinon.stub().resolves({ type: 'offer', sdp: 'mock-offer-sdp' });
    this.createAnswer = sinon.stub().resolves({ type: 'answer', sdp: 'mock-answer-sdp' });
    this.setLocalDescription = sinon.stub().resolves();
    this.setRemoteDescription = sinon.stub().resolves();
    this.addIceCandidate = sinon.stub().resolves();
    this.createDataChannel = sinon.stub().callsFake((label, options) => {
      const channel = new MockRTCDataChannel(label, options);
      this.dataChannels.set(label, channel);
      return channel;
    });
    this.addTransceiver = sinon.stub().callsFake((track, init) => {
      const transceiver = { track, init, direction: init?.direction || 'sendrecv' };
      this.transceivers.push(transceiver);
      return transceiver;
    });
    this.getStats = sinon.stub().resolves(new Map());
    this.close = sinon.stub();
  }

  // Simulate ICE candidate generation
  simulateIceCandidate() {
    setTimeout(() => {
      this.emit('icecandidate', {
        candidate: {
          candidate: 'candidate:1 1 UDP 2130706431 192.168.1.100 54400 typ host',
          sdpMLineIndex: 0,
          sdpMid: '0',
        },
      });
    }, 10);
  }

  // Simulate connection state changes
  simulateConnectionEstablished() {
    setTimeout(() => {
      this.iceConnectionState = 'connected';
      this.connectionState = 'connected';
      this.emit('iceconnectionstatechange');
      this.emit('connectionstatechange');
    }, 50);
  }
}

class MockRTCDataChannel extends EventEmitter {
  constructor(label, options = {}) {
    super();
    this.label = label;
    this.readyState = 'connecting';
    this.bufferedAmount = 0;
    this.maxPacketLifeTime = options.maxPacketLifeTime || null;
    this.maxRetransmits = options.maxRetransmits || null;
    this.ordered = options.ordered !== false;

    this.send = sinon.stub();
    this.close = sinon.stub();

    // Simulate opening
    setTimeout(() => {
      this.readyState = 'open';
      this.emit('open');
    }, 20);
  }

  simulateMessage(data) {
    this.emit('message', { data });
  }
}

// Mock getUserMedia
const mockMediaStream = {
  getTracks: () => [
    {
      kind: 'audio',
      id: 'audio-track-1',
      enabled: true,
      stop: sinon.stub(),
    },
  ],
  getAudioTracks: () => [
    {
      kind: 'audio',
      id: 'audio-track-1',
      enabled: true,
      stop: sinon.stub(),
    },
  ],
  addTrack: sinon.stub(),
  removeTrack: sinon.stub(),
};

describe('PeerConnectionManager Integration Tests', () => {
  let peerManager;
  let config;

  beforeEach(() => {
    // Mock global WebRTC APIs
    global.RTCPeerConnection = MockRTCPeerConnection;
    global.navigator = {
      mediaDevices: {
        getUserMedia: sinon.stub().resolves(mockMediaStream),
      },
    };

    config = {
      webrtc: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'turn:turn.example.com', username: 'user', credential: 'pass' },
        ],
        iceTransportPolicy: 'all',
        bundlePolicy: 'balanced',
      },
      audio: {
        sampleRate: 16000,
        channels: 1,
        echoCancellation: true,
        noiseSuppression: true,
      },
      dataChannel: {
        ordered: true,
        maxRetransmits: 3,
      },
    };

    peerManager = new PeerConnectionManager(config);
  });

  afterEach(() => {
    sinon.restore();
    peerManager.removeAllListeners();
    peerManager.closeAllConnections();
  });

  describe('Peer Connection Creation', () => {
    it('should create peer connection with correct configuration', async () => {
      const peerId = 'peer-123';
      const connection = await peerManager.createPeerConnection(peerId);

      expect(connection).to.be.instanceOf(MockRTCPeerConnection);
      expect(connection.config.iceServers).to.deep.equal(config.webrtc.iceServers);

      const activeConnections = peerManager.getActiveConnections();
      expect(activeConnections).to.have.length(1);
      expect(activeConnections[0].peerId).to.equal(peerId);
    });

    it('should handle duplicate peer connection creation', async () => {
      const peerId = 'peer-123';

      await peerManager.createPeerConnection(peerId);

      try {
        await peerManager.createPeerConnection(peerId);
        expect.fail('Should have thrown duplicate error');
      } catch (error) {
        expect(error.message).to.include('already exists');
      }
    });

    it('should set up event listeners on peer connection', async () => {
      const peerId = 'peer-123';
      const connection = await peerManager.createPeerConnection(peerId);

      const eventPromise = new Promise((resolve) => {
        peerManager.on('iceCandidate', resolve);
      });

      connection.simulateIceCandidate();

      const event = await eventPromise;
      expect(event.peerId).to.equal(peerId);
      expect(event.candidate).to.exist;
    });
  });

  describe('Media Stream Handling', () => {
    let peerId;
    let connection;

    beforeEach(async () => {
      peerId = 'peer-123';
      connection = await peerManager.createPeerConnection(peerId);
    });

    it('should add local media stream', async () => {
      const streamPromise = new Promise((resolve) => {
        peerManager.on('localStreamAdded', resolve);
      });

      await peerManager.addLocalStream(peerId);

      const event = await streamPromise;
      expect(event.peerId).to.equal(peerId);
      expect(event.stream).to.exist;
      expect(global.navigator.mediaDevices.getUserMedia).to.have.been.calledWith({
        audio: {
          sampleRate: config.audio.sampleRate,
          channelCount: config.audio.channels,
          echoCancellation: config.audio.echoCancellation,
          noiseSuppression: config.audio.noiseSuppression,
        },
        video: false,
      });
    });

    it('should handle remote stream events', (done) => {
      peerManager.on('remoteStream', (event) => {
        expect(event.peerId).to.equal(peerId);
        expect(event.stream).to.exist;
        done();
      });

      // Simulate remote stream
      connection.emit('track', {
        streams: [mockMediaStream],
        track: mockMediaStream.getAudioTracks()[0],
      });
    });

    it('should remove media stream', async () => {
      await peerManager.addLocalStream(peerId);

      const removePromise = new Promise((resolve) => {
        peerManager.on('localStreamRemoved', resolve);
      });

      await peerManager.removeLocalStream(peerId);

      const event = await removePromise;
      expect(event.peerId).to.equal(peerId);
    });
  });

  describe('Data Channel Management', () => {
    let peerId;
    let connection;

    beforeEach(async () => {
      peerId = 'peer-123';
      connection = await peerManager.createPeerConnection(peerId);
    });

    it('should create data channel', async () => {
      const channelLabel = 'translation';
      const channel = await peerManager.createDataChannel(peerId, channelLabel, {
        ordered: true,
        maxRetransmits: 3,
      });

      expect(channel).to.be.instanceOf(MockRTCDataChannel);
      expect(channel.label).to.equal(channelLabel);
      expect(connection.createDataChannel).to.have.been.calledWith(channelLabel, {
        ordered: true,
        maxRetransmits: 3,
      });
    });

    it('should handle data channel messages', (done) => {
      peerManager.on('dataChannelMessage', (event) => {
        expect(event.peerId).to.equal(peerId);
        expect(event.channel).to.equal('translation');
        expect(event.data).to.equal('test message');
        done();
      });

      peerManager.createDataChannel(peerId, 'translation').then((channel) => {
        setTimeout(() => {
          channel.simulateMessage('test message');
        }, 30);
      });
    });

    it('should send data through channel', async () => {
      const channel = await peerManager.createDataChannel(peerId, 'translation');

      // Wait for channel to open
      await new Promise((resolve) => {
        if (channel.readyState === 'open') {
          resolve();
        } else {
          channel.on('open', resolve);
        }
      });

      await peerManager.sendDataChannelMessage(peerId, 'translation', 'test message');

      expect(channel.send).to.have.been.calledWith('test message');
    });

    it('should broadcast translation to all peers', async () => {
      // Create multiple peer connections
      const peerIds = ['peer-1', 'peer-2', 'peer-3'];
      const channels = [];

      for (const id of peerIds) {
        await peerManager.createPeerConnection(id);
        const channel = await peerManager.createDataChannel(id, 'translation');
        channels.push(channel);
      }

      // Wait for all channels to open
      await Promise.all(
        channels.map(
          (channel) =>
            new Promise((resolve) => {
              if (channel.readyState === 'open') resolve();
              else channel.on('open', resolve);
            })
        )
      );

      const translation = {
        text: 'Hello world',
        language: 'es',
        confidence: 0.95,
      };

      await peerManager.broadcastTranslation(translation, 'peer-1'); // Exclude peer-1

      // Check that translation was sent to peer-2 and peer-3, but not peer-1
      expect(channels[0].send).not.to.have.been.called; // peer-1 excluded
      expect(channels[1].send).to.have.been.calledWith(
        JSON.stringify({
          type: 'translation',
          data: translation,
        })
      );
      expect(channels[2].send).to.have.been.calledWith(
        JSON.stringify({
          type: 'translation',
          data: translation,
        })
      );
    });
  });

  describe('Signaling Process', () => {
    let peerId;
    let connection;

    beforeEach(async () => {
      peerId = 'peer-123';
      connection = await peerManager.createPeerConnection(peerId);
    });

    it('should create and handle offer', async () => {
      const offer = await peerManager.createOffer(peerId);

      expect(offer.type).to.equal('offer');
      expect(offer.sdp).to.equal('mock-offer-sdp');
      expect(connection.createOffer).to.have.been.called;
      expect(connection.setLocalDescription).to.have.been.calledWith(offer);
    });

    it('should create and handle answer', async () => {
      const remoteOffer = { type: 'offer', sdp: 'remote-offer-sdp' };

      await peerManager.handleOffer(peerId, remoteOffer);
      const answer = await peerManager.createAnswer(peerId);

      expect(connection.setRemoteDescription).to.have.been.calledWith(remoteOffer);
      expect(answer.type).to.equal('answer');
      expect(answer.sdp).to.equal('mock-answer-sdp');
      expect(connection.createAnswer).to.have.been.called;
      expect(connection.setLocalDescription).to.have.been.calledWith(answer);
    });

    it('should handle remote answer', async () => {
      const remoteAnswer = { type: 'answer', sdp: 'remote-answer-sdp' };

      await peerManager.handleAnswer(peerId, remoteAnswer);

      expect(connection.setRemoteDescription).to.have.been.calledWith(remoteAnswer);
    });

    it('should handle ICE candidates', async () => {
      const candidate = {
        candidate: 'candidate:1 1 UDP 2130706431 192.168.1.100 54400 typ host',
        sdpMLineIndex: 0,
        sdpMid: '0',
      };

      await peerManager.handleIceCandidate(peerId, candidate);

      expect(connection.addIceCandidate).to.have.been.calledWith(candidate);
    });
  });

  describe('Connection State Management', () => {
    let peerId;
    let connection;

    beforeEach(async () => {
      peerId = 'peer-123';
      connection = await peerManager.createPeerConnection(peerId);
    });

    it('should track connection state changes', (done) => {
      let stateChanges = 0;

      peerManager.on('connectionStateChange', (event) => {
        stateChanges++;
        if (event.state === 'connected') {
          expect(event.peerId).to.equal(peerId);
          expect(stateChanges).to.be.greaterThan(0);
          done();
        }
      });

      connection.simulateConnectionEstablished();
    });

    it('should handle connection failures', (done) => {
      peerManager.on('connectionFailed', (event) => {
        expect(event.peerId).to.equal(peerId);
        expect(event.error).to.exist;
        done();
      });

      // Simulate connection failure
      setTimeout(() => {
        connection.iceConnectionState = 'failed';
        connection.emit('iceconnectionstatechange');
      }, 10);
    });

    it('should emit connection established event', (done) => {
      peerManager.on('connectionEstablished', (event) => {
        expect(event.peerId).to.equal(peerId);
        done();
      });

      connection.simulateConnectionEstablished();
    });
  });

  describe('Statistics and Monitoring', () => {
    beforeEach(async () => {
      await peerManager.createPeerConnection('peer-1');
      await peerManager.createPeerConnection('peer-2');
    });

    it('should provide connection statistics', () => {
      const stats = peerManager.getStatistics();

      expect(stats).to.have.property('activeConnections', 2);
      expect(stats).to.have.property('totalConnectionsCreated', 2);
      expect(stats).to.have.property('connectionStates');
      expect(stats.connectionStates).to.have.property('new', 2);
    });

    it('should track data channel statistics', async () => {
      await peerManager.createDataChannel('peer-1', 'translation');
      await peerManager.createDataChannel('peer-2', 'translation');

      const stats = peerManager.getStatistics();
      expect(stats).to.have.property('dataChannels');
      expect(stats.dataChannels).to.have.property('total', 2);
      expect(stats.dataChannels).to.have.property('byLabel');
      expect(stats.dataChannels.byLabel).to.have.property('translation', 2);
    });

    it('should provide per-peer statistics', async () => {
      const peerStats = peerManager.getPeerStatistics('peer-1');

      expect(peerStats).to.have.property('peerId', 'peer-1');
      expect(peerStats).to.have.property('connectionState', 'new');
      expect(peerStats).to.have.property('iceConnectionState', 'new');
      expect(peerStats).to.have.property('dataChannels');
      expect(peerStats).to.have.property('createdAt');
    });
  });

  describe('Cleanup and Resource Management', () => {
    it('should close specific peer connection', async () => {
      const peerId = 'peer-123';
      const connection = await peerManager.createPeerConnection(peerId);

      await peerManager.closePeerConnection(peerId);

      expect(connection.close).to.have.been.called;
      expect(peerManager.getActiveConnections()).to.have.length(0);
    });

    it('should close all peer connections', async () => {
      const connections = [];

      for (let i = 1; i <= 3; i++) {
        const connection = await peerManager.createPeerConnection(`peer-${i}`);
        connections.push(connection);
      }

      peerManager.closeAllConnections();

      connections.forEach((connection) => {
        expect(connection.close).to.have.been.called;
      });

      expect(peerManager.getActiveConnections()).to.have.length(0);
    });

    it('should clean up resources on connection close', async () => {
      const peerId = 'peer-123';
      const connection = await peerManager.createPeerConnection(peerId);
      await peerManager.createDataChannel(peerId, 'translation');

      const cleanupPromise = new Promise((resolve) => {
        peerManager.on('peerDisconnected', resolve);
      });

      await peerManager.closePeerConnection(peerId);

      const event = await cleanupPromise;
      expect(event.peerId).to.equal(peerId);
    });
  });

  describe('Error Handling', () => {
    it('should handle peer connection creation errors', async () => {
      // Mock RTCPeerConnection to throw error
      global.RTCPeerConnection = sinon.stub().throws(new Error('WebRTC not supported'));

      try {
        await peerManager.createPeerConnection('peer-123');
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('WebRTC not supported');
      }
    });

    it('should handle media access errors', async () => {
      global.navigator.mediaDevices.getUserMedia.rejects(new Error('Media access denied'));

      const peerId = 'peer-123';
      await peerManager.createPeerConnection(peerId);

      try {
        await peerManager.addLocalStream(peerId);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('Media access denied');
      }
    });

    it('should handle signaling errors gracefully', async () => {
      const peerId = 'peer-123';
      const connection = await peerManager.createPeerConnection(peerId);

      connection.createOffer.rejects(new Error('Signaling failed'));

      try {
        await peerManager.createOffer(peerId);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('Signaling failed');
      }
    });
  });
});
