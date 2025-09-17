/**
 * Global setup for Echo RTC integration tests
 * Runs once before all tests to prepare the test environment
 */

const { chromium } = require('@playwright/test');
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

class GlobalSetup {
  constructor() {
    this.config = {
      baseURL: process.env.TEST_BASE_URL || 'http://localhost:8080',
      outputDir: process.env.TEST_OUTPUT_DIR || './test-results',
      maxRetries: 30,
      retryDelay: 2000
    };
  }

  async log(message, level = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [SETUP] [${level.toUpperCase()}]`;

    switch (level) {
      case 'error':
        console.error(`\x1b[31m${prefix} ${message}\x1b[0m`);
        break;
      case 'warn':
        console.warn(`\x1b[33m${prefix} ${message}\x1b[0m`);
        break;
      case 'success':
        console.log(`\x1b[32m${prefix} ${message}\x1b[0m`);
        break;
      case 'info':
      default:
        console.log(`\x1b[36m${prefix} ${message}\x1b[0m`);
        break;
    }
  }

  async createOutputDirectories() {
    this.log('Creating output directories...');

    const directories = [
      this.config.outputDir,
      path.join(this.config.outputDir, 'screenshots'),
      path.join(this.config.outputDir, 'videos'),
      path.join(this.config.outputDir, 'traces'),
      path.join(this.config.outputDir, 'test-artifacts'),
      path.join(this.config.outputDir, 'playwright-report')
    ];

    for (const dir of directories) {
      try {
        await fs.mkdir(dir, { recursive: true });
      } catch (error) {
        this.log(`Failed to create directory ${dir}: ${error.message}`, 'warn');
      }
    }

    this.log('Output directories created successfully', 'success');
  }

  async waitForServer() {
    this.log(`Waiting for server at ${this.config.baseURL}...`);

    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        const response = await axios.get(`${this.config.baseURL}/health`, {
          timeout: 5000,
          validateStatus: () => true // Accept any status code
        });

        if (response.status === 200) {
          this.log('Server is ready and responding', 'success');
          return;
        } else {
          this.log(`Server responded with status ${response.status}, retrying...`, 'warn');
        }
      } catch (error) {
        if (attempt === this.config.maxRetries) {
          throw new Error(`Server not ready after ${this.config.maxRetries} attempts: ${error.message}`);
        }

        this.log(`Attempt ${attempt}/${this.config.maxRetries} failed: ${error.message}`, 'warn');
        await new Promise(resolve => setTimeout(resolve, this.config.retryDelay));
      }
    }
  }

  async validateServerEndpoints() {
    this.log('Validating server endpoints...');

    const endpoints = [
      { path: '/health', method: 'GET', expectedStatus: 200 },
      { path: '/api/auth/register', method: 'POST', expectedStatus: [400, 422] }, // Should fail without data
      { path: '/api/rooms', method: 'GET', expectedStatus: [200, 401] }, // May require auth
      { path: '/socket.io/', method: 'GET', expectedStatus: [200, 400] } // Socket.IO endpoint
    ];

    for (const endpoint of endpoints) {
      try {
        const response = await axios({
          method: endpoint.method,
          url: `${this.config.baseURL}${endpoint.path}`,
          timeout: 10000,
          validateStatus: () => true
        });

        const expectedStatuses = Array.isArray(endpoint.expectedStatus)
          ? endpoint.expectedStatus
          : [endpoint.expectedStatus];

        if (expectedStatuses.includes(response.status)) {
          this.log(`✓ ${endpoint.method} ${endpoint.path} - Status: ${response.status}`, 'success');
        } else {
          this.log(`⚠ ${endpoint.method} ${endpoint.path} - Unexpected status: ${response.status}`, 'warn');
        }
      } catch (error) {
        this.log(`✗ ${endpoint.method} ${endpoint.path} - Error: ${error.message}`, 'error');
      }
    }
  }

  async setupTestData() {
    this.log('Setting up test data...');

    // Create test users and rooms for integration tests
    const testData = {
      users: [
        {
          username: 'testuser1',
          email: 'testuser1@example.com',
          password: 'TestPassword123!'
        },
        {
          username: 'testuser2',
          email: 'testuser2@example.com',
          password: 'TestPassword123!'
        },
        {
          username: 'testadmin',
          email: 'testadmin@example.com',
          password: 'AdminPassword123!'
        }
      ],
      rooms: [
        {
          name: 'Test Room 1',
          description: 'Integration test room 1',
          isPrivate: false,
          maxParticipants: 10
        },
        {
          name: 'Private Test Room',
          description: 'Private integration test room',
          isPrivate: true,
          maxParticipants: 5
        }
      ]
    };

    // Save test data for use in tests
    const testDataPath = path.join(this.config.outputDir, 'test-data.json');
    await fs.writeFile(testDataPath, JSON.stringify(testData, null, 2));

    this.log('Test data setup complete', 'success');
  }

  async validateBrowserCapabilities() {
    this.log('Validating browser capabilities...');

    try {
      const browser = await chromium.launch({ headless: true });
      const context = await browser.newContext({
        permissions: ['microphone', 'camera']
      });
      const page = await context.newPage();

      // Test WebRTC support
      const webrtcSupport = await page.evaluate(() => {
        return {
          RTCPeerConnection: typeof RTCPeerConnection !== 'undefined',
          getUserMedia: typeof navigator.mediaDevices?.getUserMedia === 'function',
          WebSocket: typeof WebSocket !== 'undefined',
          AudioContext: typeof (window.AudioContext || window.webkitAudioContext) !== 'undefined'
        };
      });

      this.log(`WebRTC Support: ${JSON.stringify(webrtcSupport)}`);

      if (!webrtcSupport.RTCPeerConnection) {
        throw new Error('RTCPeerConnection not supported');
      }

      if (!webrtcSupport.getUserMedia) {
        throw new Error('getUserMedia not supported');
      }

      await browser.close();
      this.log('Browser capabilities validated successfully', 'success');

    } catch (error) {
      this.log(`Browser validation failed: ${error.message}`, 'error');
      throw error;
    }
  }

  async setupEnvironmentVariables() {
    this.log('Setting up environment variables...');

    // Set test-specific environment variables
    process.env.NODE_ENV = 'test';
    process.env.PLAYWRIGHT_TEST_BASE_URL = this.config.baseURL;
    process.env.PLAYWRIGHT_HEADLESS = process.env.TEST_HEADLESS || 'true';

    // Disable some features that might interfere with testing
    process.env.DISABLE_ANALYTICS = 'true';
    process.env.DISABLE_TELEMETRY = 'true';

    this.log('Environment variables configured', 'success');
  }

  async createTestReport() {
    this.log('Creating initial test report...');

    const report = {
      setup: {
        timestamp: new Date().toISOString(),
        baseURL: this.config.baseURL,
        outputDir: this.config.outputDir,
        nodeVersion: process.version,
        platform: process.platform,
        environment: process.env.NODE_ENV
      },
      status: 'setup_complete'
    };

    const reportPath = path.join(this.config.outputDir, 'setup-report.json');
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));

    this.log('Initial test report created', 'success');
  }

  async run() {
    try {
      this.log('Starting global setup for Echo RTC integration tests');

      await this.createOutputDirectories();
      await this.setupEnvironmentVariables();
      await this.waitForServer();
      await this.validateServerEndpoints();
      await this.validateBrowserCapabilities();
      await this.setupTestData();
      await this.createTestReport();

      this.log('Global setup completed successfully', 'success');

    } catch (error) {
      this.log(`Global setup failed: ${error.message}`, 'error');
      throw error;
    }
  }
}

// Export the setup function for Playwright
module.exports = async () => {
  const setup = new GlobalSetup();
  await setup.run();
};

// Allow running setup independently
if (require.main === module) {
  const setup = new GlobalSetup();
  setup.run().catch(error => {
    console.error('Setup failed:', error);
    process.exit(1);
  });
}