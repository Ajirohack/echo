/**
 * Integration tests for API endpoints
 * Tests authentication, room management, user management, and error handling
 */

const { test, expect } = require('@playwright/test');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

class APITestHelper {
  constructor(baseUrl = 'http://localhost:8080') {
    this.baseUrl = baseUrl;
    this.apiUrl = `${baseUrl}/api`;
    this.tokens = new Map();
    this.users = new Map();
    this.rooms = new Map();
    this.defaultHeaders = {
      'Content-Type': 'application/json'
    };
  }

  async createTestUser(userData = {}) {
    const defaultUser = {
      username: `testuser_${uuidv4().slice(0, 8)}`,
      email: `test_${uuidv4().slice(0, 8)}@example.com`,
      password: 'TestPassword123!',
      displayName: 'Test User'
    };

    const user = { ...defaultUser, ...userData };

    try {
      const response = await axios.post(`${this.apiUrl}/auth/register`, user);
      const userId = response.data.user.id;
      this.users.set(userId, { ...user, id: userId });

      if (response.data.token) {
        this.tokens.set(userId, response.data.token);
      }

      return response.data;
    } catch (error) {
      throw new Error(`Failed to create test user: ${error.response?.data?.message || error.message}`);
    }
  }

  async loginUser(email, password) {
    try {
      const response = await axios.post(`${this.apiUrl}/auth/login`, {
        email,
        password
      });

      const userId = response.data.user.id;
      this.tokens.set(userId, response.data.token);

      return response.data;
    } catch (error) {
      throw new Error(`Failed to login user: ${error.response?.data?.message || error.message}`);
    }
  }

  getAuthHeaders(userId) {
    const token = this.tokens.get(userId);
    if (!token) {
      throw new Error(`No token found for user ${userId}`);
    }

    return {
      ...this.defaultHeaders,
      'Authorization': `Bearer ${token}`
    };
  }

  async createRoom(creatorId, roomData = {}) {
    const defaultRoom = {
      name: `Test Room ${uuidv4().slice(0, 8)}`,
      description: 'Test room description',
      maxParticipants: 10,
      isPrivate: false
    };

    const room = { ...defaultRoom, ...roomData };

    try {
      const response = await axios.post(
        `${this.apiUrl}/rooms`,
        room,
        { headers: this.getAuthHeaders(creatorId) }
      );

      const roomId = response.data.id;
      this.rooms.set(roomId, { ...response.data, creatorId });

      return response.data;
    } catch (error) {
      throw new Error(`Failed to create room: ${error.response?.data?.message || error.message}`);
    }
  }

  async makeRequest(method, endpoint, data = null, userId = null, additionalHeaders = {}) {
    const headers = userId ? this.getAuthHeaders(userId) : this.defaultHeaders;
    const config = {
      method,
      url: `${this.apiUrl}${endpoint}`,
      headers: { ...headers, ...additionalHeaders },
      ...(data && { data })
    };

    try {
      const response = await axios(config);
      return {
        success: true,
        status: response.status,
        data: response.data,
        headers: response.headers
      };
    } catch (error) {
      return {
        success: false,
        status: error.response?.status || 0,
        data: error.response?.data || null,
        error: error.message
      };
    }
  }

  async cleanup() {
    // Clean up created rooms
    for (const [roomId, room] of this.rooms) {
      try {
        await this.makeRequest('DELETE', `/rooms/${roomId}`, null, room.creatorId);
      } catch (error) {
        console.warn(`Failed to cleanup room ${roomId}:`, error.message);
      }
    }

    // Clean up created users
    for (const [userId, user] of this.users) {
      try {
        await this.makeRequest('DELETE', `/users/${userId}`, null, userId);
      } catch (error) {
        console.warn(`Failed to cleanup user ${userId}:`, error.message);
      }
    }

    this.tokens.clear();
    this.users.clear();
    this.rooms.clear();
  }
}

test.describe('API Authentication Tests', () => {
  let helper;

  test.beforeEach(async () => {
    helper = new APITestHelper();
  });

  test.afterEach(async () => {
    await helper.cleanup();
  });

  test('should register a new user successfully', async () => {
    const userData = {
      username: 'newuser123',
      email: 'newuser@example.com',
      password: 'SecurePassword123!',
      displayName: 'New User'
    };

    const result = await helper.createTestUser(userData);

    expect(result.user).toBeDefined();
    expect(result.user.username).toBe(userData.username);
    expect(result.user.email).toBe(userData.email);
    expect(result.user.displayName).toBe(userData.displayName);
    expect(result.user.password).toBeUndefined(); // Password should not be returned
    expect(result.token).toBeDefined();

    // Verify JWT token structure
    const decoded = jwt.decode(result.token);
    expect(decoded.userId).toBe(result.user.id);
    expect(decoded.email).toBe(userData.email);
  });

  test('should reject registration with invalid data', async () => {
    const invalidUsers = [
      {
        username: '', // Empty username
        email: 'test@example.com',
        password: 'Password123!'
      },
      {
        username: 'testuser',
        email: 'invalid-email', // Invalid email format
        password: 'Password123!'
      },
      {
        username: 'testuser',
        email: 'test@example.com',
        password: '123' // Weak password
      }
    ];

    for (const userData of invalidUsers) {
      const response = await helper.makeRequest('POST', '/auth/register', userData);
      expect(response.success).toBe(false);
      expect(response.status).toBe(400);
      expect(response.data.message).toBeDefined();
    }
  });

  test('should login with valid credentials', async () => {
    const userData = await helper.createTestUser();
    const user = helper.users.get(userData.user.id);

    const loginResult = await helper.loginUser(user.email, user.password);

    expect(loginResult.user).toBeDefined();
    expect(loginResult.user.id).toBe(userData.user.id);
    expect(loginResult.token).toBeDefined();

    // New token should be different from registration token
    expect(loginResult.token).not.toBe(userData.token);
  });

  test('should reject login with invalid credentials', async () => {
    const userData = await helper.createTestUser();
    const user = helper.users.get(userData.user.id);

    // Test wrong password
    const wrongPasswordResponse = await helper.makeRequest('POST', '/auth/login', {
      email: user.email,
      password: 'WrongPassword123!'
    });

    expect(wrongPasswordResponse.success).toBe(false);
    expect(wrongPasswordResponse.status).toBe(401);

    // Test non-existent email
    const wrongEmailResponse = await helper.makeRequest('POST', '/auth/login', {
      email: 'nonexistent@example.com',
      password: user.password
    });

    expect(wrongEmailResponse.success).toBe(false);
    expect(wrongEmailResponse.status).toBe(401);
  });

  test('should validate JWT tokens', async () => {
    const userData = await helper.createTestUser();
    const userId = userData.user.id;

    // Test with valid token
    const validResponse = await helper.makeRequest('GET', '/auth/me', null, userId);
    expect(validResponse.success).toBe(true);
    expect(validResponse.data.id).toBe(userId);

    // Test with invalid token
    const invalidResponse = await helper.makeRequest('GET', '/auth/me', null, null, {
      'Authorization': 'Bearer invalid-token'
    });
    expect(invalidResponse.success).toBe(false);
    expect(invalidResponse.status).toBe(401);

    // Test without token
    const noTokenResponse = await helper.makeRequest('GET', '/auth/me');
    expect(noTokenResponse.success).toBe(false);
    expect(noTokenResponse.status).toBe(401);
  });

  test('should handle token refresh', async () => {
    const userData = await helper.createTestUser();
    const userId = userData.user.id;

    const refreshResponse = await helper.makeRequest('POST', '/auth/refresh', null, userId);

    if (refreshResponse.success) {
      expect(refreshResponse.data.token).toBeDefined();
      expect(refreshResponse.data.token).not.toBe(helper.tokens.get(userId));

      // Update stored token
      helper.tokens.set(userId, refreshResponse.data.token);

      // Verify new token works
      const meResponse = await helper.makeRequest('GET', '/auth/me', null, userId);
      expect(meResponse.success).toBe(true);
    }
  });
});

test.describe('API Room Management Tests', () => {
  let helper;
  let testUser;

  test.beforeEach(async () => {
    helper = new APITestHelper();
    testUser = await helper.createTestUser();
  });

  test.afterEach(async () => {
    await helper.cleanup();
  });

  test('should create a room successfully', async () => {
    const roomData = {
      name: 'Test Conference Room',
      description: 'A room for testing',
      maxParticipants: 5,
      isPrivate: false
    };

    const room = await helper.createRoom(testUser.user.id, roomData);

    expect(room.id).toBeDefined();
    expect(room.name).toBe(roomData.name);
    expect(room.description).toBe(roomData.description);
    expect(room.maxParticipants).toBe(roomData.maxParticipants);
    expect(room.isPrivate).toBe(roomData.isPrivate);
    expect(room.creatorId).toBe(testUser.user.id);
    expect(room.participants).toEqual([]);
    expect(room.createdAt).toBeDefined();
  });

  test('should list rooms with pagination', async () => {
    // Create multiple rooms
    const roomCount = 5;
    for (let i = 0; i < roomCount; i++) {
      await helper.createRoom(testUser.user.id, {
        name: `Test Room ${i + 1}`
      });
    }

    // Test pagination
    const page1Response = await helper.makeRequest('GET', '/rooms?page=1&limit=3', null, testUser.user.id);
    expect(page1Response.success).toBe(true);
    expect(page1Response.data.rooms.length).toBe(3);
    expect(page1Response.data.pagination.page).toBe(1);
    expect(page1Response.data.pagination.limit).toBe(3);
    expect(page1Response.data.pagination.total).toBeGreaterThanOrEqual(roomCount);

    const page2Response = await helper.makeRequest('GET', '/rooms?page=2&limit=3', null, testUser.user.id);
    expect(page2Response.success).toBe(true);
    expect(page2Response.data.rooms.length).toBeGreaterThan(0);
  });

  test('should join and leave rooms', async () => {
    const room = await helper.createRoom(testUser.user.id);
    const participant = await helper.createTestUser();

    // Join room
    const joinResponse = await helper.makeRequest(
      'POST',
      `/rooms/${room.id}/join`,
      null,
      participant.user.id
    );

    expect(joinResponse.success).toBe(true);
    expect(joinResponse.data.participants).toContain(participant.user.id);

    // Verify room state
    const roomResponse = await helper.makeRequest('GET', `/rooms/${room.id}`, null, testUser.user.id);
    expect(roomResponse.success).toBe(true);
    expect(roomResponse.data.participants).toContain(participant.user.id);

    // Leave room
    const leaveResponse = await helper.makeRequest(
      'POST',
      `/rooms/${room.id}/leave`,
      null,
      participant.user.id
    );

    expect(leaveResponse.success).toBe(true);
    expect(leaveResponse.data.participants).not.toContain(participant.user.id);
  });

  test('should enforce room capacity limits', async () => {
    const room = await helper.createRoom(testUser.user.id, {
      maxParticipants: 2
    });

    // Create participants
    const participant1 = await helper.createTestUser();
    const participant2 = await helper.createTestUser();
    const participant3 = await helper.createTestUser();

    // Join up to capacity
    const join1 = await helper.makeRequest('POST', `/rooms/${room.id}/join`, null, participant1.user.id);
    expect(join1.success).toBe(true);

    const join2 = await helper.makeRequest('POST', `/rooms/${room.id}/join`, null, participant2.user.id);
    expect(join2.success).toBe(true);

    // Try to exceed capacity
    const join3 = await helper.makeRequest('POST', `/rooms/${room.id}/join`, null, participant3.user.id);
    expect(join3.success).toBe(false);
    expect(join3.status).toBe(400);
    expect(join3.data.message).toContain('capacity');
  });

  test('should handle private room access', async () => {
    const privateRoom = await helper.createRoom(testUser.user.id, {
      isPrivate: true,
      allowedUsers: [testUser.user.id]
    });

    const unauthorizedUser = await helper.createTestUser();

    // Unauthorized user should not be able to join
    const joinResponse = await helper.makeRequest(
      'POST',
      `/rooms/${privateRoom.id}/join`,
      null,
      unauthorizedUser.user.id
    );

    expect(joinResponse.success).toBe(false);
    expect(joinResponse.status).toBe(403);

    // Authorized user should be able to join
    const authorizedJoin = await helper.makeRequest(
      'POST',
      `/rooms/${privateRoom.id}/join`,
      null,
      testUser.user.id
    );

    expect(authorizedJoin.success).toBe(true);
  });

  test('should update room settings', async () => {
    const room = await helper.createRoom(testUser.user.id);

    const updateData = {
      name: 'Updated Room Name',
      description: 'Updated description',
      maxParticipants: 15
    };

    const updateResponse = await helper.makeRequest(
      'PUT',
      `/rooms/${room.id}`,
      updateData,
      testUser.user.id
    );

    expect(updateResponse.success).toBe(true);
    expect(updateResponse.data.name).toBe(updateData.name);
    expect(updateResponse.data.description).toBe(updateData.description);
    expect(updateResponse.data.maxParticipants).toBe(updateData.maxParticipants);

    // Non-creator should not be able to update
    const otherUser = await helper.createTestUser();
    const unauthorizedUpdate = await helper.makeRequest(
      'PUT',
      `/rooms/${room.id}`,
      updateData,
      otherUser.user.id
    );

    expect(unauthorizedUpdate.success).toBe(false);
    expect(unauthorizedUpdate.status).toBe(403);
  });

  test('should delete rooms', async () => {
    const room = await helper.createRoom(testUser.user.id);

    // Delete room
    const deleteResponse = await helper.makeRequest(
      'DELETE',
      `/rooms/${room.id}`,
      null,
      testUser.user.id
    );

    expect(deleteResponse.success).toBe(true);

    // Verify room is deleted
    const getResponse = await helper.makeRequest('GET', `/rooms/${room.id}`, null, testUser.user.id);
    expect(getResponse.success).toBe(false);
    expect(getResponse.status).toBe(404);

    // Remove from helper tracking to avoid cleanup errors
    helper.rooms.delete(room.id);
  });
});

test.describe('API Message Management Tests', () => {
  let helper;
  let testUser;
  let testRoom;

  test.beforeEach(async () => {
    helper = new APITestHelper();
    testUser = await helper.createTestUser();
    testRoom = await helper.createRoom(testUser.user.id);
  });

  test.afterEach(async () => {
    await helper.cleanup();
  });

  test('should send and retrieve messages', async () => {
    // Join room first
    await helper.makeRequest('POST', `/rooms/${testRoom.id}/join`, null, testUser.user.id);

    const messageData = {
      content: 'Hello, this is a test message!',
      type: 'text'
    };

    // Send message
    const sendResponse = await helper.makeRequest(
      'POST',
      `/rooms/${testRoom.id}/messages`,
      messageData,
      testUser.user.id
    );

    expect(sendResponse.success).toBe(true);
    expect(sendResponse.data.content).toBe(messageData.content);
    expect(sendResponse.data.type).toBe(messageData.type);
    expect(sendResponse.data.senderId).toBe(testUser.user.id);
    expect(sendResponse.data.roomId).toBe(testRoom.id);
    expect(sendResponse.data.timestamp).toBeDefined();

    // Retrieve messages
    const messagesResponse = await helper.makeRequest(
      'GET',
      `/rooms/${testRoom.id}/messages`,
      null,
      testUser.user.id
    );

    expect(messagesResponse.success).toBe(true);
    expect(messagesResponse.data.length).toBe(1);
    expect(messagesResponse.data[0].content).toBe(messageData.content);
  });

  test('should handle message pagination and filtering', async () => {
    await helper.makeRequest('POST', `/rooms/${testRoom.id}/join`, null, testUser.user.id);

    // Send multiple messages
    const messageCount = 10;
    for (let i = 0; i < messageCount; i++) {
      await helper.makeRequest(
        'POST',
        `/rooms/${testRoom.id}/messages`,
        {
          content: `Test message ${i + 1}`,
          type: 'text'
        },
        testUser.user.id
      );
    }

    // Test pagination
    const page1Response = await helper.makeRequest(
      'GET',
      `/rooms/${testRoom.id}/messages?page=1&limit=5`,
      null,
      testUser.user.id
    );

    expect(page1Response.success).toBe(true);
    expect(page1Response.data.messages.length).toBe(5);
    expect(page1Response.data.pagination.total).toBe(messageCount);

    // Test date filtering
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    const filteredResponse = await helper.makeRequest(
      'GET',
      `/rooms/${testRoom.id}/messages?since=${oneHourAgo.toISOString()}`,
      null,
      testUser.user.id
    );

    expect(filteredResponse.success).toBe(true);
    expect(filteredResponse.data.length).toBe(messageCount);
  });

  test('should handle different message types', async () => {
    await helper.makeRequest('POST', `/rooms/${testRoom.id}/join`, null, testUser.user.id);

    const messageTypes = [
      { content: 'Text message', type: 'text' },
      { content: 'System notification', type: 'system' },
      { content: JSON.stringify({ action: 'user_joined' }), type: 'event' }
    ];

    for (const messageData of messageTypes) {
      const response = await helper.makeRequest(
        'POST',
        `/rooms/${testRoom.id}/messages`,
        messageData,
        testUser.user.id
      );

      expect(response.success).toBe(true);
      expect(response.data.type).toBe(messageData.type);
    }

    // Retrieve and verify all message types
    const messagesResponse = await helper.makeRequest(
      'GET',
      `/rooms/${testRoom.id}/messages`,
      null,
      testUser.user.id
    );

    expect(messagesResponse.success).toBe(true);
    expect(messagesResponse.data.length).toBe(messageTypes.length);

    const types = messagesResponse.data.map(msg => msg.type);
    expect(types).toContain('text');
    expect(types).toContain('system');
    expect(types).toContain('event');
  });
});

test.describe('API Error Handling Tests', () => {
  let helper;

  test.beforeEach(async () => {
    helper = new APITestHelper();
  });

  test.afterEach(async () => {
    await helper.cleanup();
  });

  test('should handle 404 errors for non-existent resources', async () => {
    const testUser = await helper.createTestUser();
    const nonExistentId = uuidv4();

    const responses = [
      await helper.makeRequest('GET', `/rooms/${nonExistentId}`, null, testUser.user.id),
      await helper.makeRequest('GET', `/users/${nonExistentId}`, null, testUser.user.id),
      await helper.makeRequest('GET', `/rooms/${nonExistentId}/messages`, null, testUser.user.id)
    ];

    responses.forEach(response => {
      expect(response.success).toBe(false);
      expect(response.status).toBe(404);
      expect(response.data.message).toBeDefined();
    });
  });

  test('should handle rate limiting', async () => {
    const testUser = await helper.createTestUser();

    // Make rapid requests to trigger rate limiting
    const requests = [];
    for (let i = 0; i < 100; i++) {
      requests.push(
        helper.makeRequest('GET', '/rooms', null, testUser.user.id)
      );
    }

    const responses = await Promise.all(requests);

    // Some requests should be rate limited
    const rateLimitedResponses = responses.filter(r => r.status === 429);
    expect(rateLimitedResponses.length).toBeGreaterThan(0);

    // Rate limited responses should have appropriate headers
    rateLimitedResponses.forEach(response => {
      expect(response.data.message).toContain('rate limit');
    });
  });

  test('should handle malformed JSON requests', async () => {
    const testUser = await helper.createTestUser();

    const malformedResponse = await helper.makeRequest(
      'POST',
      '/rooms',
      'invalid-json-string',
      testUser.user.id,
      { 'Content-Type': 'application/json' }
    );

    expect(malformedResponse.success).toBe(false);
    expect(malformedResponse.status).toBe(400);
    expect(malformedResponse.data.message).toContain('JSON');
  });

  test('should handle server errors gracefully', async () => {
    // Test endpoint that might cause server error
    const errorResponse = await helper.makeRequest(
      'POST',
      '/test/server-error',
      { trigger: 'error' }
    );

    if (errorResponse.status === 500) {
      expect(errorResponse.success).toBe(false);
      expect(errorResponse.data.message).toBeDefined();
      expect(errorResponse.data.error).not.toContain('stack'); // Stack traces should not be exposed
    }
  });

  test('should validate request parameters', async () => {
    const testUser = await helper.createTestUser();

    const invalidRequests = [
      {
        endpoint: '/rooms',
        method: 'POST',
        data: { name: '' }, // Empty name
        expectedStatus: 400
      },
      {
        endpoint: '/rooms',
        method: 'GET',
        params: '?page=-1', // Invalid page number
        expectedStatus: 400
      },
      {
        endpoint: '/rooms',
        method: 'GET',
        params: '?limit=1000', // Excessive limit
        expectedStatus: 400
      }
    ];

    for (const request of invalidRequests) {
      const endpoint = request.endpoint + (request.params || '');
      const response = await helper.makeRequest(
        request.method,
        endpoint,
        request.data,
        testUser.user.id
      );

      expect(response.success).toBe(false);
      expect(response.status).toBe(request.expectedStatus);
      expect(response.data.message).toBeDefined();
    }
  });

  test('should handle CORS preflight requests', async () => {
    const corsResponse = await helper.makeRequest(
      'OPTIONS',
      '/rooms',
      null,
      null,
      {
        'Origin': 'http://localhost:3000',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type, Authorization'
      }
    );

    if (corsResponse.success) {
      expect(corsResponse.headers['access-control-allow-origin']).toBeDefined();
      expect(corsResponse.headers['access-control-allow-methods']).toBeDefined();
      expect(corsResponse.headers['access-control-allow-headers']).toBeDefined();
    }
  });
});

test.describe('API Performance Tests', () => {
  let helper;

  test.beforeEach(async () => {
    helper = new APITestHelper();
  });

  test.afterEach(async () => {
    await helper.cleanup();
  });

  test('should handle concurrent requests efficiently', async () => {
    const testUser = await helper.createTestUser();
    const concurrentRequests = 50;

    const startTime = Date.now();

    // Make concurrent room creation requests
    const requests = Array.from({ length: concurrentRequests }, (_, i) =>
      helper.createRoom(testUser.user.id, { name: `Concurrent Room ${i + 1}` })
    );

    const results = await Promise.allSettled(requests);
    const endTime = Date.now();

    const successfulRequests = results.filter(r => r.status === 'fulfilled').length;
    const duration = endTime - startTime;

    expect(successfulRequests).toBeGreaterThan(concurrentRequests * 0.8); // At least 80% success
    expect(duration).toBeLessThan(10000); // Should complete within 10 seconds

    // Calculate average response time
    const avgResponseTime = duration / concurrentRequests;
    expect(avgResponseTime).toBeLessThan(500); // Average response time under 500ms
  });

  test('should handle large payload requests', async () => {
    const testUser = await helper.createTestUser();
    const room = await helper.createRoom(testUser.user.id);

    await helper.makeRequest('POST', `/rooms/${room.id}/join`, null, testUser.user.id);

    // Send large message (but within reasonable limits)
    const largeContent = 'A'.repeat(10000); // 10KB message

    const startTime = Date.now();
    const response = await helper.makeRequest(
      'POST',
      `/rooms/${room.id}/messages`,
      {
        content: largeContent,
        type: 'text'
      },
      testUser.user.id
    );
    const endTime = Date.now();

    expect(response.success).toBe(true);
    expect(response.data.content).toBe(largeContent);
    expect(endTime - startTime).toBeLessThan(2000); // Should handle within 2 seconds
  });

  test('should maintain performance with many rooms', async () => {
    const testUser = await helper.createTestUser();
    const roomCount = 100;

    // Create many rooms
    const createPromises = Array.from({ length: roomCount }, (_, i) =>
      helper.createRoom(testUser.user.id, { name: `Performance Room ${i + 1}` })
    );

    await Promise.all(createPromises);

    // Test room listing performance
    const startTime = Date.now();
    const listResponse = await helper.makeRequest('GET', '/rooms?limit=50', null, testUser.user.id);
    const endTime = Date.now();

    expect(listResponse.success).toBe(true);
    expect(listResponse.data.rooms.length).toBe(50);
    expect(endTime - startTime).toBeLessThan(1000); // Should respond within 1 second
  });
});