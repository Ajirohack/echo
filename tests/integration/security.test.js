/**
 * Integration tests for security features
 * Tests authentication security, authorization, input validation, and security headers
 */

const { test, expect } = require('@playwright/test');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

class SecurityTestHelper {
  constructor(baseUrl = 'http://localhost:8080') {
    this.baseUrl = baseUrl;
    this.apiUrl = `${baseUrl}/api`;
    this.tokens = new Map();
    this.users = new Map();
  }

  async createTestUser(userData = {}) {
    const defaultUser = {
      username: `sectest_${uuidv4().slice(0, 8)}`,
      email: `sectest_${uuidv4().slice(0, 8)}@example.com`,
      password: 'SecurePassword123!',
      displayName: 'Security Test User'
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

  async makeRequest(method, endpoint, data = null, token = null, additionalHeaders = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...additionalHeaders
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const config = {
      method,
      url: `${this.apiUrl}${endpoint}`,
      headers,
      ...(data && { data }),
      validateStatus: () => true // Don't throw on HTTP errors
    };

    try {
      const response = await axios(config);
      return {
        success: response.status >= 200 && response.status < 300,
        status: response.status,
        data: response.data,
        headers: response.headers
      };
    } catch (error) {
      return {
        success: false,
        status: 0,
        data: null,
        error: error.message
      };
    }
  }

  generateMaliciousPayloads() {
    return {
      xss: [
        '<script>alert("XSS")</script>',
        'javascript:alert("XSS")',
        '<img src=x onerror=alert("XSS")>',
        '"><script>alert("XSS")</script>',
        "'; DROP TABLE users; --"
      ],
      sqlInjection: [
        "'; DROP TABLE users; --",
        "' OR '1'='1",
        "1; DELETE FROM users WHERE 1=1; --",
        "' UNION SELECT * FROM users --",
        "admin'--",
        "admin' /*"
      ],
      pathTraversal: [
        '../../../etc/passwd',
        '..\\..\\..\\windows\\system32\\config\\sam',
        '%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd',
        '....//....//....//etc/passwd'
      ],
      commandInjection: [
        '; ls -la',
        '| cat /etc/passwd',
        '&& rm -rf /',
        '`whoami`',
        '$(id)'
      ],
      oversizedData: {
        largeString: 'A'.repeat(1000000), // 1MB string
        deepObject: this.createDeepObject(1000),
        largeArray: Array(10000).fill('data')
      }
    };
  }

  createDeepObject(depth) {
    let obj = { value: 'deep' };
    for (let i = 0; i < depth; i++) {
      obj = { nested: obj };
    }
    return obj;
  }

  async cleanup() {
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

    this.tokens.clear();
    this.users.clear();
  }
}

test.describe('Authentication Security Tests', () => {
  let helper;

  test.beforeEach(async () => {
    helper = new SecurityTestHelper();
  });

  test.afterEach(async () => {
    await helper.cleanup();
  });

  test('should enforce strong password requirements', async () => {
    const weakPasswords = [
      '123456',
      'password',
      'qwerty',
      'abc123',
      '12345678',
      'password123',
      'admin',
      'letmein',
      'welcome',
      'monkey'
    ];

    for (const password of weakPasswords) {
      const response = await helper.makeRequest('POST', '/auth/register', {
        username: `testuser_${Date.now()}`,
        email: `test_${Date.now()}@example.com`,
        password: password,
        displayName: 'Test User'
      });

      expect(response.success).toBe(false);
      expect(response.status).toBe(400);
      expect(response.data.message).toMatch(/password/i);
    }
  });

  test('should prevent brute force attacks', async () => {
    const userData = await helper.createTestUser();
    const user = helper.users.get(userData.user.id);

    // Attempt multiple failed logins
    const failedAttempts = [];
    for (let i = 0; i < 10; i++) {
      failedAttempts.push(
        helper.makeRequest('POST', '/auth/login', {
          email: user.email,
          password: 'WrongPassword123!'
        })
      );
    }

    const results = await Promise.all(failedAttempts);

    // Should start blocking after several attempts
    const blockedAttempts = results.filter(r => r.status === 429 || r.status === 423);
    expect(blockedAttempts.length).toBeGreaterThan(0);

    // Should include rate limiting information
    const lastBlocked = blockedAttempts[blockedAttempts.length - 1];
    expect(lastBlocked.data.message).toMatch(/rate limit|blocked|too many/i);
  });

  test('should validate JWT token integrity', async () => {
    const userData = await helper.createTestUser();
    const validToken = helper.tokens.get(userData.user.id);

    // Test with tampered token
    const tamperedToken = validToken.slice(0, -10) + 'tampered123';
    const tamperedResponse = await helper.makeRequest('GET', '/auth/me', null, tamperedToken);

    expect(tamperedResponse.success).toBe(false);
    expect(tamperedResponse.status).toBe(401);

    // Test with expired token (if possible to generate)
    const expiredPayload = {
      userId: userData.user.id,
      email: userData.user.email,
      exp: Math.floor(Date.now() / 1000) - 3600 // Expired 1 hour ago
    };

    // Note: This would require the JWT secret to create a properly signed but expired token
    // In a real test environment, you might have access to the secret for testing

    // Test with malformed token
    const malformedTokens = [
      'not.a.jwt',
      'invalid-token-format',
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid.signature',
      ''
    ];

    for (const token of malformedTokens) {
      const response = await helper.makeRequest('GET', '/auth/me', null, token);
      expect(response.success).toBe(false);
      expect(response.status).toBe(401);
    }
  });

  test('should prevent session fixation attacks', async () => {
    const userData = await helper.createTestUser();
    const user = helper.users.get(userData.user.id);

    // Get initial token
    const initialToken = helper.tokens.get(userData.user.id);

    // Login again - should get a new token
    const loginResponse = await helper.makeRequest('POST', '/auth/login', {
      email: user.email,
      password: user.password
    });

    expect(loginResponse.success).toBe(true);
    expect(loginResponse.data.token).toBeDefined();
    expect(loginResponse.data.token).not.toBe(initialToken);

    // Old token should be invalidated (if implemented)
    const oldTokenResponse = await helper.makeRequest('GET', '/auth/me', null, initialToken);
    // Note: This test assumes token invalidation is implemented
    // If not implemented, this test should be marked as pending
  });

  test('should handle concurrent login attempts', async () => {
    const userData = await helper.createTestUser();
    const user = helper.users.get(userData.user.id);

    // Make concurrent login requests
    const concurrentLogins = Array(10).fill().map(() =>
      helper.makeRequest('POST', '/auth/login', {
        email: user.email,
        password: user.password
      })
    );

    const results = await Promise.all(concurrentLogins);

    // All should succeed or be properly rate limited
    const successfulLogins = results.filter(r => r.success);
    const rateLimited = results.filter(r => r.status === 429);

    expect(successfulLogins.length + rateLimited.length).toBe(results.length);

    // Each successful login should have a unique token
    const tokens = successfulLogins.map(r => r.data.token);
    const uniqueTokens = new Set(tokens);
    expect(uniqueTokens.size).toBe(tokens.length);
  });
});

test.describe('Input Validation Security Tests', () => {
  let helper;
  let testUser;

  test.beforeEach(async () => {
    helper = new SecurityTestHelper();
    testUser = await helper.createTestUser();
  });

  test.afterEach(async () => {
    await helper.cleanup();
  });

  test('should prevent XSS attacks', async () => {
    const maliciousPayloads = helper.generateMaliciousPayloads();
    const token = helper.tokens.get(testUser.user.id);

    for (const xssPayload of maliciousPayloads.xss) {
      // Test in room creation
      const roomResponse = await helper.makeRequest('POST', '/rooms', {
        name: xssPayload,
        description: xssPayload
      }, token);

      if (roomResponse.success) {
        // If creation succeeds, ensure the payload is sanitized
        expect(roomResponse.data.name).not.toContain('<script>');
        expect(roomResponse.data.name).not.toContain('javascript:');
        expect(roomResponse.data.description).not.toContain('<script>');
      } else {
        // If creation fails, it should be due to validation
        expect(roomResponse.status).toBe(400);
      }

      // Test in user profile update
      const profileResponse = await helper.makeRequest('PUT', `/users/${testUser.user.id}`, {
        displayName: xssPayload,
        bio: xssPayload
      }, token);

      if (profileResponse.success) {
        expect(profileResponse.data.displayName).not.toContain('<script>');
        expect(profileResponse.data.bio).not.toContain('<script>');
      }
    }
  });

  test('should prevent SQL injection attacks', async () => {
    const maliciousPayloads = helper.generateMaliciousPayloads();
    const token = helper.tokens.get(testUser.user.id);

    for (const sqlPayload of maliciousPayloads.sqlInjection) {
      // Test in search endpoints
      const searchResponse = await helper.makeRequest(
        'GET',
        `/rooms/search?q=${encodeURIComponent(sqlPayload)}`,
        null,
        token
      );

      // Should not cause server errors
      expect(searchResponse.status).not.toBe(500);

      // Test in login
      const loginResponse = await helper.makeRequest('POST', '/auth/login', {
        email: sqlPayload,
        password: 'password'
      });

      expect(loginResponse.status).not.toBe(500);
      expect(loginResponse.success).toBe(false);
    }
  });

  test('should prevent path traversal attacks', async () => {
    const maliciousPayloads = helper.generateMaliciousPayloads();
    const token = helper.tokens.get(testUser.user.id);

    for (const pathPayload of maliciousPayloads.pathTraversal) {
      // Test in file-related endpoints
      const fileResponse = await helper.makeRequest(
        'GET',
        `/files/${encodeURIComponent(pathPayload)}`,
        null,
        token
      );

      // Should not expose system files
      expect(fileResponse.status).not.toBe(200);
      if (fileResponse.data) {
        expect(fileResponse.data).not.toMatch(/root:|admin:|password/i);
      }
    }
  });

  test('should handle oversized payloads', async () => {
    const maliciousPayloads = helper.generateMaliciousPayloads();
    const token = helper.tokens.get(testUser.user.id);

    // Test large string payload
    const largeStringResponse = await helper.makeRequest('POST', '/rooms', {
      name: 'Test Room',
      description: maliciousPayloads.oversizedData.largeString
    }, token);

    expect(largeStringResponse.success).toBe(false);
    expect(largeStringResponse.status).toBe(413); // Payload Too Large

    // Test deep object payload
    const deepObjectResponse = await helper.makeRequest('POST', '/rooms',
      maliciousPayloads.oversizedData.deepObject,
      token
    );

    expect(deepObjectResponse.success).toBe(false);
    expect([400, 413]).toContain(deepObjectResponse.status);

    // Test large array payload
    const largeArrayResponse = await helper.makeRequest('POST', '/rooms', {
      name: 'Test Room',
      tags: maliciousPayloads.oversizedData.largeArray
    }, token);

    expect(largeArrayResponse.success).toBe(false);
    expect([400, 413]).toContain(largeArrayResponse.status);
  });

  test('should validate content types', async () => {
    const token = helper.tokens.get(testUser.user.id);

    // Test with wrong content type
    const wrongContentTypeResponse = await helper.makeRequest(
      'POST',
      '/rooms',
      JSON.stringify({ name: 'Test Room' }),
      token,
      { 'Content-Type': 'text/plain' }
    );

    expect(wrongContentTypeResponse.success).toBe(false);
    expect(wrongContentTypeResponse.status).toBe(400);

    // Test with missing content type
    const noContentTypeResponse = await helper.makeRequest(
      'POST',
      '/rooms',
      JSON.stringify({ name: 'Test Room' }),
      token,
      { 'Content-Type': undefined }
    );

    expect(noContentTypeResponse.success).toBe(false);
  });
});

test.describe('Authorization Security Tests', () => {
  let helper;
  let user1, user2;

  test.beforeEach(async () => {
    helper = new SecurityTestHelper();
    user1 = await helper.createTestUser({ username: 'user1' });
    user2 = await helper.createTestUser({ username: 'user2' });
  });

  test.afterEach(async () => {
    await helper.cleanup();
  });

  test('should prevent unauthorized resource access', async () => {
    const token1 = helper.tokens.get(user1.user.id);
    const token2 = helper.tokens.get(user2.user.id);

    // User1 creates a private room
    const roomResponse = await helper.makeRequest('POST', '/rooms', {
      name: 'Private Room',
      isPrivate: true
    }, token1);

    expect(roomResponse.success).toBe(true);
    const roomId = roomResponse.data.id;

    // User2 should not be able to access the private room
    const accessResponse = await helper.makeRequest('GET', `/rooms/${roomId}`, null, token2);
    expect(accessResponse.success).toBe(false);
    expect(accessResponse.status).toBe(403);

    // User2 should not be able to join the private room
    const joinResponse = await helper.makeRequest('POST', `/rooms/${roomId}/join`, null, token2);
    expect(joinResponse.success).toBe(false);
    expect(joinResponse.status).toBe(403);

    // User2 should not be able to modify the room
    const updateResponse = await helper.makeRequest('PUT', `/rooms/${roomId}`, {
      name: 'Hacked Room'
    }, token2);
    expect(updateResponse.success).toBe(false);
    expect(updateResponse.status).toBe(403);
  });

  test('should prevent privilege escalation', async () => {
    const token1 = helper.tokens.get(user1.user.id);
    const token2 = helper.tokens.get(user2.user.id);

    // User2 should not be able to modify User1's profile
    const profileResponse = await helper.makeRequest('PUT', `/users/${user1.user.id}`, {
      displayName: 'Hacked User',
      role: 'admin' // Attempt to escalate privileges
    }, token2);

    expect(profileResponse.success).toBe(false);
    expect(profileResponse.status).toBe(403);

    // User2 should not be able to delete User1
    const deleteResponse = await helper.makeRequest('DELETE', `/users/${user1.user.id}`, null, token2);
    expect(deleteResponse.success).toBe(false);
    expect(deleteResponse.status).toBe(403);

    // User2 should not be able to access admin endpoints
    const adminResponse = await helper.makeRequest('GET', '/admin/users', null, token2);
    expect(adminResponse.success).toBe(false);
    expect([401, 403]).toContain(adminResponse.status);
  });

  test('should validate resource ownership', async () => {
    const token1 = helper.tokens.get(user1.user.id);
    const token2 = helper.tokens.get(user2.user.id);

    // User1 creates a room
    const roomResponse = await helper.makeRequest('POST', '/rooms', {
      name: 'User1 Room'
    }, token1);

    expect(roomResponse.success).toBe(true);
    const roomId = roomResponse.data.id;

    // User2 joins the room
    const joinResponse = await helper.makeRequest('POST', `/rooms/${roomId}/join`, null, token2);
    expect(joinResponse.success).toBe(true);

    // User2 should be able to send messages
    const messageResponse = await helper.makeRequest('POST', `/rooms/${roomId}/messages`, {
      content: 'Hello from User2',
      type: 'text'
    }, token2);
    expect(messageResponse.success).toBe(true);

    // But User2 should not be able to delete the room (only owner can)
    const deleteResponse = await helper.makeRequest('DELETE', `/rooms/${roomId}`, null, token2);
    expect(deleteResponse.success).toBe(false);
    expect(deleteResponse.status).toBe(403);

    // User1 (owner) should be able to delete the room
    const ownerDeleteResponse = await helper.makeRequest('DELETE', `/rooms/${roomId}`, null, token1);
    expect(ownerDeleteResponse.success).toBe(true);
  });

  test('should handle token reuse across different users', async () => {
    const token1 = helper.tokens.get(user1.user.id);

    // Try to use User1's token to access User2's data
    const user2DataResponse = await helper.makeRequest('GET', `/users/${user2.user.id}`, null, token1);

    if (user2DataResponse.success) {
      // If access is allowed, ensure sensitive data is not exposed
      expect(user2DataResponse.data.email).toBeUndefined();
      expect(user2DataResponse.data.password).toBeUndefined();
    } else {
      // Or access should be denied
      expect(user2DataResponse.status).toBe(403);
    }

    // Try to modify User2's data with User1's token
    const modifyResponse = await helper.makeRequest('PUT', `/users/${user2.user.id}`, {
      displayName: 'Modified by User1'
    }, token1);

    expect(modifyResponse.success).toBe(false);
    expect(modifyResponse.status).toBe(403);
  });
});

test.describe('Security Headers Tests', () => {
  let helper;

  test.beforeEach(async () => {
    helper = new SecurityTestHelper();
  });

  test.afterEach(async () => {
    await helper.cleanup();
  });

  test('should include security headers', async () => {
    const response = await helper.makeRequest('GET', '/health');

    const securityHeaders = {
      'x-content-type-options': 'nosniff',
      'x-frame-options': 'DENY',
      'x-xss-protection': '1; mode=block',
      'strict-transport-security': /max-age=\d+/,
      'content-security-policy': /.+/,
      'referrer-policy': /.+/
    };

    for (const [header, expectedValue] of Object.entries(securityHeaders)) {
      const headerValue = response.headers[header];

      if (expectedValue instanceof RegExp) {
        expect(headerValue).toMatch(expectedValue);
      } else {
        expect(headerValue).toBe(expectedValue);
      }
    }
  });

  test('should handle CORS securely', async () => {
    const corsResponse = await helper.makeRequest('OPTIONS', '/api/rooms', null, null, {
      'Origin': 'https://malicious-site.com',
      'Access-Control-Request-Method': 'POST'
    });

    if (corsResponse.success) {
      const allowedOrigins = corsResponse.headers['access-control-allow-origin'];

      // Should not allow all origins in production
      expect(allowedOrigins).not.toBe('*');

      // Should have specific allowed origins
      if (allowedOrigins) {
        expect(allowedOrigins).toMatch(/^https?:\/\/(localhost|127\.0\.0\.1|[\w.-]+\.(com|org|net))/);
      }
    }
  });

  test('should not expose sensitive information in headers', async () => {
    const response = await helper.makeRequest('GET', '/api/health');

    const sensitiveHeaders = [
      'server',
      'x-powered-by',
      'x-aspnet-version',
      'x-aspnetmvc-version'
    ];

    for (const header of sensitiveHeaders) {
      expect(response.headers[header]).toBeUndefined();
    }
  });
});

test.describe('Data Protection Tests', () => {
  let helper;

  test.beforeEach(async () => {
    helper = new SecurityTestHelper();
  });

  test.afterEach(async () => {
    await helper.cleanup();
  });

  test('should not expose sensitive data in responses', async () => {
    const userData = await helper.createTestUser();
    const token = helper.tokens.get(userData.user.id);

    // Check user profile endpoint
    const profileResponse = await helper.makeRequest('GET', '/auth/me', null, token);

    expect(profileResponse.success).toBe(true);
    expect(profileResponse.data.password).toBeUndefined();
    expect(profileResponse.data.passwordHash).toBeUndefined();
    expect(profileResponse.data.salt).toBeUndefined();

    // Check user listing endpoint
    const usersResponse = await helper.makeRequest('GET', '/users', null, token);

    if (usersResponse.success && usersResponse.data.users) {
      for (const user of usersResponse.data.users) {
        expect(user.password).toBeUndefined();
        expect(user.passwordHash).toBeUndefined();
        expect(user.email).toBeUndefined(); // Email should be private in listings
      }
    }
  });

  test('should handle password reset securely', async () => {
    const userData = await helper.createTestUser();
    const user = helper.users.get(userData.user.id);

    // Request password reset
    const resetResponse = await helper.makeRequest('POST', '/auth/forgot-password', {
      email: user.email
    });

    if (resetResponse.success) {
      // Should not reveal whether email exists
      expect(resetResponse.data.message).not.toContain('not found');
      expect(resetResponse.data.message).not.toContain('does not exist');

      // Should not return reset token in response
      expect(resetResponse.data.token).toBeUndefined();
      expect(resetResponse.data.resetToken).toBeUndefined();
    }

    // Test with non-existent email
    const nonExistentResponse = await helper.makeRequest('POST', '/auth/forgot-password', {
      email: 'nonexistent@example.com'
    });

    // Response should be the same to prevent email enumeration
    if (resetResponse.success && nonExistentResponse.success) {
      expect(resetResponse.data.message).toBe(nonExistentResponse.data.message);
    }
  });

  test('should validate file uploads securely', async () => {
    const userData = await helper.createTestUser();
    const token = helper.tokens.get(userData.user.id);

    const maliciousFiles = [
      {
        name: 'malicious.exe',
        content: 'MZ\x90\x00\x03', // PE header
        contentType: 'application/octet-stream'
      },
      {
        name: 'script.php',
        content: '<?php system($_GET["cmd"]); ?>',
        contentType: 'application/x-php'
      },
      {
        name: '../../../etc/passwd',
        content: 'root:x:0:0:root:/root:/bin/bash',
        contentType: 'text/plain'
      }
    ];

    for (const file of maliciousFiles) {
      const uploadResponse = await helper.makeRequest('POST', '/upload', {
        filename: file.name,
        content: file.content,
        contentType: file.contentType
      }, token);

      // Should reject malicious files
      expect(uploadResponse.success).toBe(false);
      expect([400, 415]).toContain(uploadResponse.status); // Bad Request or Unsupported Media Type
    }
  });

  test('should implement proper session management', async () => {
    const userData = await helper.createTestUser();
    const token = helper.tokens.get(userData.user.id);

    // Test logout functionality
    const logoutResponse = await helper.makeRequest('POST', '/auth/logout', null, token);

    if (logoutResponse.success) {
      // Token should be invalidated after logout
      const afterLogoutResponse = await helper.makeRequest('GET', '/auth/me', null, token);
      expect(afterLogoutResponse.success).toBe(false);
      expect(afterLogoutResponse.status).toBe(401);
    }
  });
});