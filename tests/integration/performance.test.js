/**
 * Integration tests for performance and load testing
 * Tests response times, concurrent users, memory usage, and scalability
 */

const { test, expect } = require('@playwright/test');
const axios = require('axios');
const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');
const { performance } = require('perf_hooks');

class PerformanceTestHelper {
  constructor(baseUrl = 'http://localhost:8080') {
    this.baseUrl = baseUrl;
    this.apiUrl = `${baseUrl}/api`;
    this.wsUrl = baseUrl.replace('http', 'ws');
    this.metrics = {
      responseTimes: [],
      throughput: [],
      errors: [],
      memoryUsage: [],
      connections: []
    };
    this.activeConnections = new Set();
    this.users = new Map();
    this.tokens = new Map();
  }

  async createTestUser(userData = {}) {
    const defaultUser = {
      username: `perftest_${uuidv4().slice(0, 8)}`,
      email: `perftest_${uuidv4().slice(0, 8)}@example.com`,
      password: 'TestPassword123!',
      displayName: 'Performance Test User'
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

  async measureResponseTime(requestFn) {
    const startTime = performance.now();
    try {
      const result = await requestFn();
      const endTime = performance.now();
      const responseTime = endTime - startTime;

      this.metrics.responseTimes.push({
        time: responseTime,
        success: true,
        timestamp: Date.now()
      });

      return { result, responseTime, success: true };
    } catch (error) {
      const endTime = performance.now();
      const responseTime = endTime - startTime;

      this.metrics.responseTimes.push({
        time: responseTime,
        success: false,
        error: error.message,
        timestamp: Date.now()
      });

      return { error, responseTime, success: false };
    }
  }

  async makeRequest(method, endpoint, data = null, token = null) {
    const headers = {
      'Content-Type': 'application/json'
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const config = {
      method,
      url: `${this.apiUrl}${endpoint}`,
      headers,
      ...(data && { data }),
      timeout: 30000 // 30 second timeout
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

  async createWebSocketConnection(token, roomId = null) {
    return new Promise((resolve, reject) => {
      const wsUrl = `${this.wsUrl}/ws${roomId ? `?room=${roomId}` : ''}`;
      const ws = new WebSocket(wsUrl, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const connectionId = uuidv4();
      const connectionData = {
        id: connectionId,
        ws,
        connected: false,
        messages: [],
        errors: []
      };

      ws.on('open', () => {
        connectionData.connected = true;
        this.activeConnections.add(connectionData);
        resolve(connectionData);
      });

      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          connectionData.messages.push({
            ...message,
            timestamp: Date.now()
          });
        } catch (error) {
          connectionData.errors.push({
            error: 'Failed to parse message',
            data: data.toString(),
            timestamp: Date.now()
          });
        }
      });

      ws.on('error', (error) => {
        connectionData.errors.push({
          error: error.message,
          timestamp: Date.now()
        });
        reject(error);
      });

      ws.on('close', () => {
        connectionData.connected = false;
        this.activeConnections.delete(connectionData);
      });

      // Timeout after 10 seconds
      setTimeout(() => {
        if (!connectionData.connected) {
          ws.close();
          reject(new Error('WebSocket connection timeout'));
        }
      }, 10000);
    });
  }

  calculateStatistics(values) {
    if (values.length === 0) return null;

    const sorted = [...values].sort((a, b) => a - b);
    const sum = values.reduce((a, b) => a + b, 0);

    return {
      min: Math.min(...values),
      max: Math.max(...values),
      mean: sum / values.length,
      median: sorted[Math.floor(sorted.length / 2)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)],
      count: values.length
    };
  }

  getMetricsSummary() {
    const successfulResponses = this.metrics.responseTimes.filter(r => r.success);
    const failedResponses = this.metrics.responseTimes.filter(r => !r.success);

    return {
      responseTimes: this.calculateStatistics(successfulResponses.map(r => r.time)),
      errorRate: failedResponses.length / this.metrics.responseTimes.length,
      totalRequests: this.metrics.responseTimes.length,
      successfulRequests: successfulResponses.length,
      failedRequests: failedResponses.length,
      activeConnections: this.activeConnections.size
    };
  }

  async cleanup() {
    // Close all WebSocket connections
    for (const connection of this.activeConnections) {
      if (connection.ws && connection.connected) {
        connection.ws.close();
      }
    }
    this.activeConnections.clear();

    // Clean up users
    for (const [userId, user] of this.users) {
      try {
        const token = this.tokens.get(userId);
        if (token) {
          await this.makeRequest('DELETE', `/users/${userId}`, null, token);
        }
      } catch (error) {
        console.warn(`Failed to cleanup user ${userId}:`, error.message);
      }
    }

    this.users.clear();
    this.tokens.clear();
    this.metrics = {
      responseTimes: [],
      throughput: [],
      errors: [],
      memoryUsage: [],
      connections: []
    };
  }
}

test.describe('API Response Time Tests', () => {
  let helper;
  let testUser;

  test.beforeEach(async () => {
    helper = new PerformanceTestHelper();
    testUser = await helper.createTestUser();
  });

  test.afterEach(async () => {
    await helper.cleanup();
  });

  test('should have acceptable response times for basic operations', async () => {
    const token = helper.tokens.get(testUser.user.id);
    const operations = [
      () => helper.makeRequest('GET', '/health'),
      () => helper.makeRequest('GET', '/auth/me', null, token),
      () => helper.makeRequest('GET', '/rooms', null, token),
      () => helper.makeRequest('POST', '/rooms', {
        name: 'Performance Test Room',
        description: 'Testing response times'
      }, token)
    ];

    const results = [];
    for (const operation of operations) {
      const result = await helper.measureResponseTime(operation);
      results.push(result);
      expect(result.success).toBe(true);
    }

    const responseTimes = results.map(r => r.responseTime);
    const stats = helper.calculateStatistics(responseTimes);

    // Response time expectations
    expect(stats.mean).toBeLessThan(500); // Average under 500ms
    expect(stats.p95).toBeLessThan(1000); // 95th percentile under 1s
    expect(stats.max).toBeLessThan(2000); // Maximum under 2s
  });

  test('should maintain performance under sequential load', async () => {
    const token = helper.tokens.get(testUser.user.id);
    const requestCount = 100;

    const startTime = performance.now();

    for (let i = 0; i < requestCount; i++) {
      await helper.measureResponseTime(() =>
        helper.makeRequest('GET', '/rooms', null, token)
      );
    }

    const endTime = performance.now();
    const totalTime = endTime - startTime;
    const throughput = requestCount / (totalTime / 1000); // requests per second

    const stats = helper.getMetricsSummary();

    expect(stats.errorRate).toBeLessThan(0.05); // Less than 5% error rate
    expect(stats.responseTimes.mean).toBeLessThan(1000); // Average under 1s
    expect(throughput).toBeGreaterThan(10); // At least 10 requests per second
  });

  test('should handle database-intensive operations efficiently', async () => {
    const token = helper.tokens.get(testUser.user.id);

    // Create multiple rooms first
    const roomCreationPromises = Array.from({ length: 20 }, (_, i) =>
      helper.makeRequest('POST', '/rooms', {
        name: `DB Test Room ${i + 1}`,
        description: `Room for database performance testing ${i + 1}`
      }, token)
    );

    await Promise.all(roomCreationPromises);

    // Test search operations (database-intensive)
    const searchOperations = [
      () => helper.makeRequest('GET', '/rooms/search?q=DB Test', null, token),
      () => helper.makeRequest('GET', '/rooms?page=1&limit=10&sort=createdAt', null, token),
      () => helper.makeRequest('GET', '/users/search?q=perftest', null, token)
    ];

    const results = [];
    for (const operation of searchOperations) {
      const result = await helper.measureResponseTime(operation);
      results.push(result);
    }

    const responseTimes = results.map(r => r.responseTime);
    const stats = helper.calculateStatistics(responseTimes);

    expect(stats.mean).toBeLessThan(2000); // Database operations under 2s average
    expect(stats.max).toBeLessThan(5000); // Maximum under 5s
  });
});

test.describe('Concurrent User Tests', () => {
  let helper;

  test.beforeEach(async () => {
    helper = new PerformanceTestHelper();
  });

  test.afterEach(async () => {
    await helper.cleanup();
  });

  test('should handle concurrent user registrations', async () => {
    const concurrentUsers = 20;
    const registrationPromises = [];

    const startTime = performance.now();

    for (let i = 0; i < concurrentUsers; i++) {
      registrationPromises.push(
        helper.measureResponseTime(() => helper.createTestUser({
          username: `concurrent_user_${i}`,
          email: `concurrent_${i}@example.com`
        }))
      );
    }

    const results = await Promise.allSettled(registrationPromises);
    const endTime = performance.now();

    const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
    const failed = results.length - successful;

    expect(successful).toBeGreaterThan(concurrentUsers * 0.8); // At least 80% success
    expect(failed).toBeLessThan(concurrentUsers * 0.2); // Less than 20% failure

    const totalTime = endTime - startTime;
    expect(totalTime).toBeLessThan(30000); // Complete within 30 seconds
  });

  test('should handle concurrent room operations', async () => {
    const userCount = 10;
    const users = [];

    // Create test users
    for (let i = 0; i < userCount; i++) {
      const user = await helper.createTestUser({
        username: `room_test_user_${i}`,
        email: `room_test_${i}@example.com`
      });
      users.push(user);
    }

    // Each user creates a room concurrently
    const roomCreationPromises = users.map((user, i) =>
      helper.measureResponseTime(() =>
        helper.makeRequest('POST', '/rooms', {
          name: `Concurrent Room ${i + 1}`,
          description: `Room created by user ${i + 1}`
        }, helper.tokens.get(user.user.id))
      )
    );

    const roomResults = await Promise.all(roomCreationPromises);
    const successfulRooms = roomResults.filter(r => r.success);

    expect(successfulRooms.length).toBe(userCount);

    // All users join the first room concurrently
    const firstRoomId = successfulRooms[0].result.data.id;
    const joinPromises = users.map(user =>
      helper.measureResponseTime(() =>
        helper.makeRequest('POST', `/rooms/${firstRoomId}/join`, null,
          helper.tokens.get(user.user.id))
      )
    );

    const joinResults = await Promise.all(joinPromises);
    const successfulJoins = joinResults.filter(r => r.success);

    expect(successfulJoins.length).toBeGreaterThan(userCount * 0.8); // At least 80% success

    const stats = helper.getMetricsSummary();
    expect(stats.responseTimes.mean).toBeLessThan(2000); // Average under 2s
  });

  test('should handle concurrent WebSocket connections', async () => {
    const connectionCount = 25;
    const users = [];

    // Create test users
    for (let i = 0; i < connectionCount; i++) {
      const user = await helper.createTestUser({
        username: `ws_test_user_${i}`,
        email: `ws_test_${i}@example.com`
      });
      users.push(user);
    }

    // Create a test room
    const roomResponse = await helper.makeRequest('POST', '/rooms', {
      name: 'WebSocket Test Room',
      maxParticipants: connectionCount + 5
    }, helper.tokens.get(users[0].user.id));

    expect(roomResponse.success).toBe(true);
    const roomId = roomResponse.data.id;

    // Create concurrent WebSocket connections
    const connectionPromises = users.map(user =>
      helper.createWebSocketConnection(
        helper.tokens.get(user.user.id),
        roomId
      )
    );

    const startTime = performance.now();
    const connections = await Promise.allSettled(connectionPromises);
    const endTime = performance.now();

    const successful = connections.filter(c => c.status === 'fulfilled').length;
    const connectionTime = endTime - startTime;

    expect(successful).toBeGreaterThan(connectionCount * 0.8); // At least 80% success
    expect(connectionTime).toBeLessThan(15000); // All connections within 15 seconds
    expect(helper.activeConnections.size).toBe(successful);

    // Test message broadcasting
    const testMessage = {
      type: 'chat',
      content: 'Performance test message',
      timestamp: Date.now()
    };

    // Send message from first connection
    const firstConnection = connections.find(c => c.status === 'fulfilled')?.value;
    if (firstConnection) {
      firstConnection.ws.send(JSON.stringify(testMessage));

      // Wait for message propagation
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Check if other connections received the message
      let messagesReceived = 0;
      for (const connection of helper.activeConnections) {
        if (connection.messages.some(msg => msg.content === testMessage.content)) {
          messagesReceived++;
        }
      }

      expect(messagesReceived).toBeGreaterThan(successful * 0.8); // At least 80% received
    }
  });
});

test.describe('Load Testing', () => {
  let helper;

  test.beforeEach(async () => {
    helper = new PerformanceTestHelper();
  });

  test.afterEach(async () => {
    await helper.cleanup();
  });

  test('should handle high-frequency API requests', async () => {
    const testUser = await helper.createTestUser();
    const token = helper.tokens.get(testUser.user.id);

    const requestsPerSecond = 50;
    const durationSeconds = 10;
    const totalRequests = requestsPerSecond * durationSeconds;

    const startTime = performance.now();
    const promises = [];

    // Generate requests at specified rate
    for (let i = 0; i < totalRequests; i++) {
      const delay = (i / requestsPerSecond) * 1000; // Spread requests evenly

      promises.push(
        new Promise(resolve => {
          setTimeout(async () => {
            const result = await helper.measureResponseTime(() =>
              helper.makeRequest('GET', '/rooms', null, token)
            );
            resolve(result);
          }, delay);
        })
      );
    }

    const results = await Promise.all(promises);
    const endTime = performance.now();

    const actualDuration = (endTime - startTime) / 1000;
    const actualThroughput = results.length / actualDuration;

    const successful = results.filter(r => r.success).length;
    const errorRate = (results.length - successful) / results.length;

    expect(errorRate).toBeLessThan(0.1); // Less than 10% error rate
    expect(actualThroughput).toBeGreaterThan(requestsPerSecond * 0.8); // At least 80% of target throughput

    const stats = helper.getMetricsSummary();
    expect(stats.responseTimes.p95).toBeLessThan(2000); // 95th percentile under 2s
  });

  test('should handle burst traffic patterns', async () => {
    const testUser = await helper.createTestUser();
    const token = helper.tokens.get(testUser.user.id);

    const burstSize = 100;
    const burstCount = 3;
    const burstInterval = 5000; // 5 seconds between bursts

    for (let burst = 0; burst < burstCount; burst++) {
      console.log(`Starting burst ${burst + 1}/${burstCount}`);

      const burstPromises = Array.from({ length: burstSize }, () =>
        helper.measureResponseTime(() =>
          helper.makeRequest('GET', '/health')
        )
      );

      const burstStartTime = performance.now();
      const burstResults = await Promise.all(burstPromises);
      const burstEndTime = performance.now();

      const burstDuration = burstEndTime - burstStartTime;
      const burstThroughput = burstSize / (burstDuration / 1000);

      const successful = burstResults.filter(r => r.success).length;
      const burstErrorRate = (burstSize - successful) / burstSize;

      expect(burstErrorRate).toBeLessThan(0.15); // Less than 15% error rate per burst
      expect(burstThroughput).toBeGreaterThan(20); // At least 20 requests per second

      // Wait between bursts (except for the last one)
      if (burst < burstCount - 1) {
        await new Promise(resolve => setTimeout(resolve, burstInterval));
      }
    }

    const overallStats = helper.getMetricsSummary();
    expect(overallStats.errorRate).toBeLessThan(0.1); // Overall error rate under 10%
  });

  test('should maintain performance with large datasets', async () => {
    const testUser = await helper.createTestUser();
    const token = helper.tokens.get(testUser.user.id);

    // Create a large number of rooms
    const roomCount = 200;
    console.log(`Creating ${roomCount} rooms for dataset testing...`);

    const roomCreationBatches = [];
    const batchSize = 20;

    for (let i = 0; i < roomCount; i += batchSize) {
      const batch = [];
      for (let j = 0; j < batchSize && (i + j) < roomCount; j++) {
        batch.push(
          helper.makeRequest('POST', '/rooms', {
            name: `Dataset Room ${i + j + 1}`,
            description: `Room ${i + j + 1} for large dataset testing`,
            tags: [`tag${(i + j) % 10}`, `category${(i + j) % 5}`]
          }, token)
        );
      }
      roomCreationBatches.push(Promise.all(batch));
    }

    // Create rooms in batches to avoid overwhelming the server
    for (const batch of roomCreationBatches) {
      await batch;
      await new Promise(resolve => setTimeout(resolve, 100)); // Small delay between batches
    }

    console.log('Rooms created, testing query performance...');

    // Test query performance with large dataset
    const queryOperations = [
      () => helper.makeRequest('GET', '/rooms?page=1&limit=50', null, token),
      () => helper.makeRequest('GET', '/rooms?page=2&limit=50', null, token),
      () => helper.makeRequest('GET', '/rooms/search?q=Dataset', null, token),
      () => helper.makeRequest('GET', '/rooms?sort=createdAt&order=desc&limit=25', null, token)
    ];

    const queryResults = [];
    for (const operation of queryOperations) {
      const result = await helper.measureResponseTime(operation);
      queryResults.push(result);
      expect(result.success).toBe(true);
    }

    const queryTimes = queryResults.map(r => r.responseTime);
    const queryStats = helper.calculateStatistics(queryTimes);

    // Performance should not degrade significantly with large datasets
    expect(queryStats.mean).toBeLessThan(3000); // Average under 3s
    expect(queryStats.max).toBeLessThan(8000); // Maximum under 8s
  });
});

test.describe('Memory and Resource Tests', () => {
  let helper;

  test.beforeEach(async () => {
    helper = new PerformanceTestHelper();
  });

  test.afterEach(async () => {
    await helper.cleanup();
  });

  test('should handle WebSocket connection lifecycle efficiently', async () => {
    const connectionCycles = 10;
    const connectionsPerCycle = 20;

    for (let cycle = 0; cycle < connectionCycles; cycle++) {
      console.log(`Connection cycle ${cycle + 1}/${connectionCycles}`);

      // Create users for this cycle
      const users = [];
      for (let i = 0; i < connectionsPerCycle; i++) {
        const user = await helper.createTestUser({
          username: `cycle_${cycle}_user_${i}`,
          email: `cycle_${cycle}_user_${i}@example.com`
        });
        users.push(user);
      }

      // Create WebSocket connections
      const connections = [];
      for (const user of users) {
        try {
          const connection = await helper.createWebSocketConnection(
            helper.tokens.get(user.user.id)
          );
          connections.push(connection);
        } catch (error) {
          console.warn(`Failed to create connection for user ${user.user.id}:`, error.message);
        }
      }

      expect(connections.length).toBeGreaterThan(connectionsPerCycle * 0.8);

      // Send some messages
      for (let i = 0; i < Math.min(5, connections.length); i++) {
        const connection = connections[i];
        if (connection.connected) {
          connection.ws.send(JSON.stringify({
            type: 'test',
            content: `Test message from cycle ${cycle}`,
            timestamp: Date.now()
          }));
        }
      }

      // Wait a bit for message processing
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Close all connections
      for (const connection of connections) {
        if (connection.ws && connection.connected) {
          connection.ws.close();
        }
      }

      // Wait for cleanup
      await new Promise(resolve => setTimeout(resolve, 500));

      // Verify connections are cleaned up
      expect(helper.activeConnections.size).toBe(0);
    }
  });

  test('should handle large message payloads efficiently', async () => {
    const testUser = await helper.createTestUser();
    const token = helper.tokens.get(testUser.user.id);

    // Create a room
    const roomResponse = await helper.makeRequest('POST', '/rooms', {
      name: 'Large Message Test Room'
    }, token);

    expect(roomResponse.success).toBe(true);
    const roomId = roomResponse.data.id;

    // Join the room
    await helper.makeRequest('POST', `/rooms/${roomId}/join`, null, token);

    // Test different message sizes
    const messageSizes = [1000, 5000, 10000, 50000]; // bytes

    for (const size of messageSizes) {
      const largeContent = 'A'.repeat(size);

      const result = await helper.measureResponseTime(() =>
        helper.makeRequest('POST', `/rooms/${roomId}/messages`, {
          content: largeContent,
          type: 'text'
        }, token)
      );

      if (result.success) {
        expect(result.result.data.content).toBe(largeContent);
        expect(result.responseTime).toBeLessThan(5000); // Under 5 seconds
      } else {
        // If the message is too large, it should be rejected gracefully
        expect(result.result.status).toBe(413); // Payload Too Large
      }
    }
  });

  test('should handle rapid connection/disconnection cycles', async () => {
    const testUser = await helper.createTestUser();
    const token = helper.tokens.get(testUser.user.id);
    const cycles = 50;

    for (let i = 0; i < cycles; i++) {
      try {
        // Create connection
        const connection = await helper.createWebSocketConnection(token);
        expect(connection.connected).toBe(true);

        // Send a quick message
        connection.ws.send(JSON.stringify({
          type: 'ping',
          timestamp: Date.now()
        }));

        // Wait briefly
        await new Promise(resolve => setTimeout(resolve, 50));

        // Close connection
        connection.ws.close();

        // Wait for cleanup
        await new Promise(resolve => setTimeout(resolve, 50));

      } catch (error) {
        console.warn(`Connection cycle ${i + 1} failed:`, error.message);
      }
    }

    // Verify no connections are left hanging
    expect(helper.activeConnections.size).toBe(0);
  });
});