/**
 * Integration tests for real-time communication features
 * Tests WebSocket connections, room management, and user presence
 */

const { test, expect } = require('@playwright/test');
const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');

class RealtimeTestHelper {
  constructor(baseUrl = 'http://localhost:8080') {
    this.baseUrl = baseUrl;
    this.wsUrl = baseUrl.replace('http', 'ws') + '/ws';
    this.connections = new Map();
    this.messageHandlers = new Map();
  }

  async connectUser(userId, token = null) {
    return new Promise((resolve, reject) => {
      const wsUrl = token ? `${this.wsUrl}?token=${token}` : this.wsUrl;
      const ws = new WebSocket(wsUrl);

      ws.on('open', () => {
        this.connections.set(userId, ws);
        this.messageHandlers.set(userId, []);

        // Send user identification
        ws.send(JSON.stringify({
          type: 'user_connect',
          userId: userId,
          timestamp: Date.now()
        }));

        resolve(ws);
      });

      ws.on('message', (data) => {
        const handlers = this.messageHandlers.get(userId) || [];
        const message = JSON.parse(data.toString());
        handlers.forEach(handler => handler(message));
      });

      ws.on('error', reject);
    });
  }

  addMessageHandler(userId, handler) {
    const handlers = this.messageHandlers.get(userId) || [];
    handlers.push(handler);
    this.messageHandlers.set(userId, handlers);
  }

  sendMessage(userId, message) {
    const ws = this.connections.get(userId);
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
      return true;
    }
    return false;
  }

  async createRoom(roomName, creatorId) {
    const response = await axios.post(`${this.baseUrl}/api/rooms`, {
      name: roomName,
      creatorId: creatorId,
      maxParticipants: 10,
      isPrivate: false
    });
    return response.data;
  }

  async joinRoom(roomId, userId) {
    const response = await axios.post(`${this.baseUrl}/api/rooms/${roomId}/join`, {
      userId: userId
    });
    return response.data;
  }

  async leaveRoom(roomId, userId) {
    const response = await axios.post(`${this.baseUrl}/api/rooms/${roomId}/leave`, {
      userId: userId
    });
    return response.data;
  }

  async getRoomInfo(roomId) {
    const response = await axios.get(`${this.baseUrl}/api/rooms/${roomId}`);
    return response.data;
  }

  async cleanup() {
    for (const [userId, ws] of this.connections) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    }
    this.connections.clear();
    this.messageHandlers.clear();
  }
}

test.describe('Real-time Communication Integration Tests', () => {
  let helper;

  test.beforeEach(async () => {
    helper = new RealtimeTestHelper();
  });

  test.afterEach(async () => {
    await helper.cleanup();
  });

  test('should establish WebSocket connection and handle user presence', async () => {
    const userId = uuidv4();
    let userConnectedReceived = false;
    let presenceUpdateReceived = false;

    // Connect user
    const ws = await helper.connectUser(userId);

    helper.addMessageHandler(userId, (message) => {
      if (message.type === 'user_connected') {
        userConnectedReceived = true;
        expect(message.userId).toBe(userId);
      }
      if (message.type === 'presence_update') {
        presenceUpdateReceived = true;
      }
    });

    // Send presence update
    helper.sendMessage(userId, {
      type: 'presence_update',
      status: 'online',
      timestamp: Date.now()
    });

    // Wait for responses
    await new Promise(resolve => setTimeout(resolve, 1000));

    expect(ws.readyState).toBe(WebSocket.OPEN);
    expect(userConnectedReceived).toBe(true);
  });

  test('should handle room creation and joining', async () => {
    const creatorId = uuidv4();
    const participantId = uuidv4();
    const roomName = `test-room-${Date.now()}`;

    // Connect both users
    await helper.connectUser(creatorId);
    await helper.connectUser(participantId);

    let roomCreatedReceived = false;
    let userJoinedReceived = false;

    helper.addMessageHandler(creatorId, (message) => {
      if (message.type === 'room_created') {
        roomCreatedReceived = true;
        expect(message.room.name).toBe(roomName);
      }
      if (message.type === 'user_joined_room') {
        userJoinedReceived = true;
        expect(message.userId).toBe(participantId);
      }
    });

    // Create room via API
    const room = await helper.createRoom(roomName, creatorId);
    expect(room.id).toBeDefined();
    expect(room.name).toBe(roomName);

    // Join room via WebSocket
    helper.sendMessage(creatorId, {
      type: 'join_room',
      roomId: room.id,
      timestamp: Date.now()
    });

    helper.sendMessage(participantId, {
      type: 'join_room',
      roomId: room.id,
      timestamp: Date.now()
    });

    // Wait for room events
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Verify room state via API
    const roomInfo = await helper.getRoomInfo(room.id);
    expect(roomInfo.participants.length).toBe(2);
    expect(roomInfo.participants).toContain(creatorId);
    expect(roomInfo.participants).toContain(participantId);
  });

  test('should broadcast messages to room participants', async () => {
    const user1Id = uuidv4();
    const user2Id = uuidv4();
    const user3Id = uuidv4();
    const roomName = `broadcast-room-${Date.now()}`;

    // Connect all users
    await helper.connectUser(user1Id);
    await helper.connectUser(user2Id);
    await helper.connectUser(user3Id);

    const receivedMessages = new Map();
    receivedMessages.set(user1Id, []);
    receivedMessages.set(user2Id, []);
    receivedMessages.set(user3Id, []);

    // Set up message handlers
    [user1Id, user2Id, user3Id].forEach(userId => {
      helper.addMessageHandler(userId, (message) => {
        if (message.type === 'room_message') {
          receivedMessages.get(userId).push(message);
        }
      });
    });

    // Create and join room
    const room = await helper.createRoom(roomName, user1Id);

    // All users join the room
    helper.sendMessage(user1Id, {
      type: 'join_room',
      roomId: room.id,
      timestamp: Date.now()
    });

    helper.sendMessage(user2Id, {
      type: 'join_room',
      roomId: room.id,
      timestamp: Date.now()
    });

    helper.sendMessage(user3Id, {
      type: 'join_room',
      roomId: room.id,
      timestamp: Date.now()
    });

    // Wait for joins to complete
    await new Promise(resolve => setTimeout(resolve, 1000));

    // User1 sends a message
    const testMessage = {
      type: 'room_message',
      roomId: room.id,
      content: 'Hello everyone!',
      senderId: user1Id,
      timestamp: Date.now()
    };

    helper.sendMessage(user1Id, testMessage);

    // Wait for message broadcast
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Verify message received by other participants (not sender)
    expect(receivedMessages.get(user1Id).length).toBe(0); // Sender doesn't receive own message
    expect(receivedMessages.get(user2Id).length).toBe(1);
    expect(receivedMessages.get(user3Id).length).toBe(1);

    const user2Message = receivedMessages.get(user2Id)[0];
    expect(user2Message.content).toBe('Hello everyone!');
    expect(user2Message.senderId).toBe(user1Id);
  });

  test('should handle user disconnection and cleanup', async () => {
    const user1Id = uuidv4();
    const user2Id = uuidv4();
    const roomName = `disconnect-room-${Date.now()}`;

    // Connect users
    const ws1 = await helper.connectUser(user1Id);
    await helper.connectUser(user2Id);

    let userDisconnectedReceived = false;
    helper.addMessageHandler(user2Id, (message) => {
      if (message.type === 'user_disconnected') {
        userDisconnectedReceived = true;
        expect(message.userId).toBe(user1Id);
      }
    });

    // Create room and join both users
    const room = await helper.createRoom(roomName, user1Id);

    helper.sendMessage(user1Id, {
      type: 'join_room',
      roomId: room.id,
      timestamp: Date.now()
    });

    helper.sendMessage(user2Id, {
      type: 'join_room',
      roomId: room.id,
      timestamp: Date.now()
    });

    await new Promise(resolve => setTimeout(resolve, 1000));

    // Verify both users in room
    let roomInfo = await helper.getRoomInfo(room.id);
    expect(roomInfo.participants.length).toBe(2);

    // Disconnect user1
    ws1.close();

    // Wait for disconnection processing
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Verify user1 removed from room
    roomInfo = await helper.getRoomInfo(room.id);
    expect(roomInfo.participants.length).toBe(1);
    expect(roomInfo.participants).toContain(user2Id);
    expect(roomInfo.participants).not.toContain(user1Id);
  });

  test('should handle WebRTC signaling through WebSocket', async () => {
    const user1Id = uuidv4();
    const user2Id = uuidv4();
    const roomName = `webrtc-room-${Date.now()}`;

    await helper.connectUser(user1Id);
    await helper.connectUser(user2Id);

    const signalingMessages = new Map();
    signalingMessages.set(user1Id, []);
    signalingMessages.set(user2Id, []);

    // Set up signaling message handlers
    [user1Id, user2Id].forEach(userId => {
      helper.addMessageHandler(userId, (message) => {
        if (['webrtc_offer', 'webrtc_answer', 'webrtc_ice_candidate'].includes(message.type)) {
          signalingMessages.get(userId).push(message);
        }
      });
    });

    // Create room and join users
    const room = await helper.createRoom(roomName, user1Id);

    helper.sendMessage(user1Id, {
      type: 'join_room',
      roomId: room.id,
      timestamp: Date.now()
    });

    helper.sendMessage(user2Id, {
      type: 'join_room',
      roomId: room.id,
      timestamp: Date.now()
    });

    await new Promise(resolve => setTimeout(resolve, 1000));

    // User1 sends WebRTC offer
    const offer = {
      type: 'webrtc_offer',
      roomId: room.id,
      targetUserId: user2Id,
      senderId: user1Id,
      offer: {
        type: 'offer',
        sdp: 'mock-sdp-offer-data'
      },
      timestamp: Date.now()
    };

    helper.sendMessage(user1Id, offer);

    // Wait for signaling
    await new Promise(resolve => setTimeout(resolve, 500));

    // User2 should receive the offer
    expect(signalingMessages.get(user2Id).length).toBe(1);
    const receivedOffer = signalingMessages.get(user2Id)[0];
    expect(receivedOffer.type).toBe('webrtc_offer');
    expect(receivedOffer.senderId).toBe(user1Id);

    // User2 sends answer
    const answer = {
      type: 'webrtc_answer',
      roomId: room.id,
      targetUserId: user1Id,
      senderId: user2Id,
      answer: {
        type: 'answer',
        sdp: 'mock-sdp-answer-data'
      },
      timestamp: Date.now()
    };

    helper.sendMessage(user2Id, answer);

    await new Promise(resolve => setTimeout(resolve, 500));

    // User1 should receive the answer
    expect(signalingMessages.get(user1Id).length).toBe(1);
    const receivedAnswer = signalingMessages.get(user1Id)[0];
    expect(receivedAnswer.type).toBe('webrtc_answer');
    expect(receivedAnswer.senderId).toBe(user2Id);
  });

  test('should handle room capacity limits', async () => {
    const creatorId = uuidv4();
    const roomName = `capacity-room-${Date.now()}`;

    await helper.connectUser(creatorId);

    // Create room with limited capacity
    const response = await axios.post(`${helper.baseUrl}/api/rooms`, {
      name: roomName,
      creatorId: creatorId,
      maxParticipants: 2,
      isPrivate: false
    });

    const room = response.data;
    expect(room.maxParticipants).toBe(2);

    // Connect additional users
    const user2Id = uuidv4();
    const user3Id = uuidv4();

    await helper.connectUser(user2Id);
    await helper.connectUser(user3Id);

    // Join room up to capacity
    await helper.joinRoom(room.id, creatorId);
    await helper.joinRoom(room.id, user2Id);

    // Verify room is at capacity
    let roomInfo = await helper.getRoomInfo(room.id);
    expect(roomInfo.participants.length).toBe(2);

    // Try to join when at capacity (should fail)
    try {
      await helper.joinRoom(room.id, user3Id);
      expect(true).toBe(false); // Should not reach here
    } catch (error) {
      expect(error.response.status).toBe(400);
      expect(error.response.data.error).toContain('capacity');
    }

    // Verify room still has only 2 participants
    roomInfo = await helper.getRoomInfo(room.id);
    expect(roomInfo.participants.length).toBe(2);
  });

  test('should handle private room access control', async () => {
    const creatorId = uuidv4();
    const authorizedUserId = uuidv4();
    const unauthorizedUserId = uuidv4();
    const roomName = `private-room-${Date.now()}`;

    await helper.connectUser(creatorId);
    await helper.connectUser(authorizedUserId);
    await helper.connectUser(unauthorizedUserId);

    // Create private room
    const response = await axios.post(`${helper.baseUrl}/api/rooms`, {
      name: roomName,
      creatorId: creatorId,
      maxParticipants: 10,
      isPrivate: true,
      allowedUsers: [creatorId, authorizedUserId]
    });

    const room = response.data;
    expect(room.isPrivate).toBe(true);

    // Creator should be able to join
    await helper.joinRoom(room.id, creatorId);

    // Authorized user should be able to join
    await helper.joinRoom(room.id, authorizedUserId);

    // Verify both users joined
    let roomInfo = await helper.getRoomInfo(room.id);
    expect(roomInfo.participants.length).toBe(2);

    // Unauthorized user should not be able to join
    try {
      await helper.joinRoom(room.id, unauthorizedUserId);
      expect(true).toBe(false); // Should not reach here
    } catch (error) {
      expect(error.response.status).toBe(403);
      expect(error.response.data.error).toContain('access');
    }

    // Verify unauthorized user was not added
    roomInfo = await helper.getRoomInfo(room.id);
    expect(roomInfo.participants.length).toBe(2);
    expect(roomInfo.participants).not.toContain(unauthorizedUserId);
  });

  test('should handle message history and persistence', async () => {
    const user1Id = uuidv4();
    const user2Id = uuidv4();
    const roomName = `history-room-${Date.now()}`;

    await helper.connectUser(user1Id);
    await helper.connectUser(user2Id);

    // Create room
    const room = await helper.createRoom(roomName, user1Id);

    // Join room
    helper.sendMessage(user1Id, {
      type: 'join_room',
      roomId: room.id,
      timestamp: Date.now()
    });

    helper.sendMessage(user2Id, {
      type: 'join_room',
      roomId: room.id,
      timestamp: Date.now()
    });

    await new Promise(resolve => setTimeout(resolve, 1000));

    // Send multiple messages
    const messages = [
      'First message',
      'Second message',
      'Third message'
    ];

    for (let i = 0; i < messages.length; i++) {
      helper.sendMessage(user1Id, {
        type: 'room_message',
        roomId: room.id,
        content: messages[i],
        senderId: user1Id,
        timestamp: Date.now() + i
      });

      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Wait for message processing
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Get message history via API
    const historyResponse = await axios.get(`${helper.baseUrl}/api/rooms/${room.id}/messages`);
    const messageHistory = historyResponse.data;

    expect(messageHistory.length).toBe(3);
    expect(messageHistory[0].content).toBe('First message');
    expect(messageHistory[1].content).toBe('Second message');
    expect(messageHistory[2].content).toBe('Third message');

    // Verify messages are ordered by timestamp
    for (let i = 1; i < messageHistory.length; i++) {
      expect(messageHistory[i].timestamp).toBeGreaterThan(messageHistory[i - 1].timestamp);
    }
  });
});

test.describe('Real-time Performance Tests', () => {
  let helper;

  test.beforeEach(async () => {
    helper = new RealtimeTestHelper();
  });

  test.afterEach(async () => {
    await helper.cleanup();
  });

  test('should handle high-frequency message sending', async () => {
    const userId = uuidv4();
    const roomName = `perf-room-${Date.now()}`;

    await helper.connectUser(userId);
    const room = await helper.createRoom(roomName, userId);

    helper.sendMessage(userId, {
      type: 'join_room',
      roomId: room.id,
      timestamp: Date.now()
    });

    await new Promise(resolve => setTimeout(resolve, 500));

    // Send 100 messages rapidly
    const messageCount = 100;
    const startTime = Date.now();

    for (let i = 0; i < messageCount; i++) {
      helper.sendMessage(userId, {
        type: 'room_message',
        roomId: room.id,
        content: `Message ${i}`,
        senderId: userId,
        timestamp: Date.now()
      });
    }

    const endTime = Date.now();
    const duration = endTime - startTime;

    // Should complete within reasonable time (less than 5 seconds)
    expect(duration).toBeLessThan(5000);

    // Wait for processing
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Verify messages were processed
    const historyResponse = await axios.get(`${helper.baseUrl}/api/rooms/${room.id}/messages`);
    expect(historyResponse.data.length).toBe(messageCount);
  });

  test('should maintain connection stability under load', async () => {
    const userCount = 20;
    const userIds = Array.from({ length: userCount }, () => uuidv4());
    const roomName = `load-room-${Date.now()}`;

    // Connect all users
    const connections = [];
    for (const userId of userIds) {
      const ws = await helper.connectUser(userId);
      connections.push(ws);
    }

    // Create room
    const room = await helper.createRoom(roomName, userIds[0]);

    // All users join the room
    for (const userId of userIds) {
      helper.sendMessage(userId, {
        type: 'join_room',
        roomId: room.id,
        timestamp: Date.now()
      });
    }

    // Wait for all joins
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Verify all connections are still open
    const openConnections = connections.filter(ws => ws.readyState === WebSocket.OPEN);
    expect(openConnections.length).toBe(userCount);

    // Verify all users in room
    const roomInfo = await helper.getRoomInfo(room.id);
    expect(roomInfo.participants.length).toBe(userCount);
  });
});