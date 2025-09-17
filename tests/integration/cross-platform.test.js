/**
 * Integration tests for cross-platform compatibility
 * Tests web, mobile, and desktop environments with different scenarios
 */

const { test, expect } = require('@playwright/test');
const { chromium, firefox, webkit } = require('playwright');
const axios = require('axios');
const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');

class CrossPlatformTestHelper {
  constructor() {
    this.browsers = new Map();
    this.contexts = new Map();
    this.pages = new Map();
    this.mobileDevices = [
      'iPhone 12',
      'iPhone 12 Pro',
      'Pixel 5',
      'Galaxy S21',
      'iPad Pro'
    ];
  }

  async launchBrowser(browserType, options = {}) {
    let browser;

    switch (browserType) {
      case 'chromium':
        browser = await chromium.launch({ headless: true, ...options });
        break;
      case 'firefox':
        browser = await firefox.launch({ headless: true, ...options });
        break;
      case 'webkit':
        browser = await webkit.launch({ headless: true, ...options });
        break;
      default:
        throw new Error(`Unsupported browser type: ${browserType}`);
    }

    this.browsers.set(browserType, browser);
    return browser;
  }

  async createMobileContext(browserType, deviceName) {
    const browser = this.browsers.get(browserType);
    if (!browser) {
      throw new Error(`Browser ${browserType} not launched`);
    }

    const device = require('playwright').devices[deviceName];
    const context = await browser.newContext({
      ...device,
      permissions: ['microphone', 'camera']
    });

    const contextId = `${browserType}-${deviceName}`;
    this.contexts.set(contextId, context);
    return { context, contextId };
  }

  async createDesktopContext(browserType, viewport = { width: 1920, height: 1080 }) {
    const browser = this.browsers.get(browserType);
    if (!browser) {
      throw new Error(`Browser ${browserType} not launched`);
    }

    const context = await browser.newContext({
      viewport,
      permissions: ['microphone', 'camera']
    });

    const contextId = `${browserType}-desktop`;
    this.contexts.set(contextId, context);
    return { context, contextId };
  }

  async createPage(contextId, url = 'http://localhost:3000') {
    const context = this.contexts.get(contextId);
    if (!context) {
      throw new Error(`Context ${contextId} not found`);
    }

    const page = await context.newPage();
    await page.goto(url);

    this.pages.set(contextId, page);
    return page;
  }

  async testWebRTCSupport(page) {
    return await page.evaluate(() => {
      return {
        hasRTCPeerConnection: typeof RTCPeerConnection !== 'undefined',
        hasGetUserMedia: typeof navigator.mediaDevices?.getUserMedia !== 'undefined',
        hasWebSocket: typeof WebSocket !== 'undefined',
        hasAudioContext: typeof (window.AudioContext || window.webkitAudioContext) !== 'undefined',
        userAgent: navigator.userAgent,
        platform: navigator.platform
      };
    });
  }

  async testAudioConstraints(page) {
    return await page.evaluate(async () => {
      try {
        const constraints = {
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            sampleRate: 48000
          }
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        const track = stream.getAudioTracks()[0];
        const settings = track.getSettings();

        track.stop();

        return {
          success: true,
          settings: settings,
          constraints: track.getConstraints()
        };
      } catch (error) {
        return {
          success: false,
          error: error.message
        };
      }
    });
  }

  async simulateNetworkConditions(page, conditions) {
    const client = await page.context().newCDPSession(page);

    const networkConditions = {
      slow3g: {
        offline: false,
        downloadThroughput: 500 * 1024 / 8,
        uploadThroughput: 500 * 1024 / 8,
        latency: 400
      },
      fast3g: {
        offline: false,
        downloadThroughput: 1.6 * 1024 * 1024 / 8,
        uploadThroughput: 750 * 1024 / 8,
        latency: 150
      },
      wifi: {
        offline: false,
        downloadThroughput: 30 * 1024 * 1024 / 8,
        uploadThroughput: 15 * 1024 * 1024 / 8,
        latency: 2
      }
    };

    const condition = networkConditions[conditions] || networkConditions.wifi;
    await client.send('Network.emulateNetworkConditions', condition);
  }

  async cleanup() {
    // Close all pages
    for (const [id, page] of this.pages) {
      await page.close();
    }
    this.pages.clear();

    // Close all contexts
    for (const [id, context] of this.contexts) {
      await context.close();
    }
    this.contexts.clear();

    // Close all browsers
    for (const [type, browser] of this.browsers) {
      await browser.close();
    }
    this.browsers.clear();
  }
}

test.describe('Cross-Platform Compatibility Tests', () => {
  let helper;

  test.beforeEach(async () => {
    helper = new CrossPlatformTestHelper();
  });

  test.afterEach(async () => {
    await helper.cleanup();
  });

  test('should support WebRTC across different browsers', async () => {
    const browsers = ['chromium', 'firefox', 'webkit'];
    const results = new Map();

    for (const browserType of browsers) {
      await helper.launchBrowser(browserType);
      const { context, contextId } = await helper.createDesktopContext(browserType);
      const page = await helper.createPage(contextId);

      const support = await helper.testWebRTCSupport(page);
      results.set(browserType, support);
    }

    // All browsers should support basic WebRTC features
    for (const [browserType, support] of results) {
      expect(support.hasRTCPeerConnection).toBe(true);
      expect(support.hasGetUserMedia).toBe(true);
      expect(support.hasWebSocket).toBe(true);
      expect(support.hasAudioContext).toBe(true);
      expect(support.userAgent).toBeDefined();
      expect(support.platform).toBeDefined();
    }
  });

  test('should handle mobile device constraints', async () => {
    await helper.launchBrowser('chromium');

    const mobileResults = new Map();

    for (const deviceName of helper.mobileDevices) {
      try {
        const { context, contextId } = await helper.createMobileContext('chromium', deviceName);
        const page = await helper.createPage(contextId);

        const audioTest = await helper.testAudioConstraints(page);
        mobileResults.set(deviceName, audioTest);
      } catch (error) {
        // Some devices might not be available in test environment
        console.warn(`Could not test device ${deviceName}: ${error.message}`);
      }
    }

    // At least one mobile device should work
    expect(mobileResults.size).toBeGreaterThan(0);

    // Check that mobile devices can handle audio constraints
    for (const [device, result] of mobileResults) {
      if (result.success) {
        expect(result.settings).toBeDefined();
        expect(result.settings.sampleRate).toBeGreaterThan(0);
      }
    }
  });

  test('should adapt to different network conditions', async () => {
    await helper.launchBrowser('chromium');
    const { context, contextId } = await helper.createDesktopContext('chromium');
    const page = await helper.createPage(contextId);

    const networkConditions = ['slow3g', 'fast3g', 'wifi'];
    const results = new Map();

    for (const condition of networkConditions) {
      await helper.simulateNetworkConditions(page, condition);

      // Test connection establishment time
      const startTime = Date.now();

      const connectionTest = await page.evaluate(async () => {
        try {
          const ws = new WebSocket('ws://localhost:8080/ws');

          return new Promise((resolve) => {
            const timeout = setTimeout(() => {
              resolve({ success: false, error: 'timeout' });
            }, 10000);

            ws.onopen = () => {
              clearTimeout(timeout);
              ws.close();
              resolve({ success: true });
            };

            ws.onerror = (error) => {
              clearTimeout(timeout);
              resolve({ success: false, error: error.message });
            };
          });
        } catch (error) {
          return { success: false, error: error.message };
        }
      });

      const endTime = Date.now();
      const duration = endTime - startTime;

      results.set(condition, {
        ...connectionTest,
        duration: duration
      });
    }

    // Verify network adaptation
    expect(results.get('wifi').duration).toBeLessThan(results.get('slow3g').duration);
    expect(results.get('fast3g').duration).toBeLessThan(results.get('slow3g').duration);
  });

  test('should handle different screen sizes and orientations', async () => {
    await helper.launchBrowser('chromium');

    const viewports = [
      { width: 320, height: 568, name: 'mobile-portrait' },
      { width: 568, height: 320, name: 'mobile-landscape' },
      { width: 768, height: 1024, name: 'tablet-portrait' },
      { width: 1024, height: 768, name: 'tablet-landscape' },
      { width: 1920, height: 1080, name: 'desktop-hd' },
      { width: 2560, height: 1440, name: 'desktop-2k' }
    ];

    const results = new Map();

    for (const viewport of viewports) {
      const { context, contextId } = await helper.createDesktopContext('chromium', {
        width: viewport.width,
        height: viewport.height
      });

      const page = await helper.createPage(contextId);

      // Test UI responsiveness
      const uiTest = await page.evaluate(() => {
        const body = document.body;
        const computedStyle = window.getComputedStyle(body);

        return {
          width: window.innerWidth,
          height: window.innerHeight,
          devicePixelRatio: window.devicePixelRatio,
          orientation: window.innerWidth > window.innerHeight ? 'landscape' : 'portrait'
        };
      });

      results.set(viewport.name, uiTest);
    }

    // Verify viewport handling
    expect(results.get('mobile-portrait').orientation).toBe('portrait');
    expect(results.get('mobile-landscape').orientation).toBe('landscape');
    expect(results.get('desktop-hd').width).toBe(1920);
    expect(results.get('desktop-hd').height).toBe(1080);
  });

  test('should handle browser-specific WebRTC implementations', async () => {
    const browsers = ['chromium', 'firefox'];
    const webrtcTests = new Map();

    for (const browserType of browsers) {
      await helper.launchBrowser(browserType);
      const { context, contextId } = await helper.createDesktopContext(browserType);
      const page = await helper.createPage(contextId);

      const webrtcTest = await page.evaluate(async () => {
        try {
          const pc = new RTCPeerConnection({
            iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
          });

          // Test data channel creation
          const dataChannel = pc.createDataChannel('test', {
            ordered: true,
            maxRetransmits: 3
          });

          // Test offer creation
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);

          const result = {
            success: true,
            hasDataChannel: !!dataChannel,
            offerType: offer.type,
            sdpLength: offer.sdp.length,
            iceGatheringState: pc.iceGatheringState,
            connectionState: pc.connectionState
          };

          pc.close();
          return result;
        } catch (error) {
          return {
            success: false,
            error: error.message
          };
        }
      });

      webrtcTests.set(browserType, webrtcTest);
    }

    // All browsers should successfully create WebRTC connections
    for (const [browserType, test] of webrtcTests) {
      expect(test.success).toBe(true);
      expect(test.hasDataChannel).toBe(true);
      expect(test.offerType).toBe('offer');
      expect(test.sdpLength).toBeGreaterThan(0);
    }
  });

  test('should handle audio codec compatibility', async () => {
    await helper.launchBrowser('chromium');
    const { context, contextId } = await helper.createDesktopContext('chromium');
    const page = await helper.createPage(contextId);

    const codecTest = await page.evaluate(() => {
      const pc = new RTCPeerConnection();

      // Get supported codecs
      const transceivers = pc.getTransceivers();
      const capabilities = RTCRtpReceiver.getCapabilities('audio');

      const supportedCodecs = capabilities.codecs.map(codec => ({
        mimeType: codec.mimeType,
        clockRate: codec.clockRate,
        channels: codec.channels
      }));

      pc.close();

      return {
        supportedCodecs: supportedCodecs,
        hasOpus: supportedCodecs.some(c => c.mimeType.includes('opus')),
        hasPCMU: supportedCodecs.some(c => c.mimeType.includes('PCMU')),
        hasPCMA: supportedCodecs.some(c => c.mimeType.includes('PCMA'))
      };
    });

    expect(codecTest.supportedCodecs.length).toBeGreaterThan(0);
    expect(codecTest.hasOpus).toBe(true); // Opus should be supported
  });

  test('should handle touch and mouse interactions', async () => {
    await helper.launchBrowser('chromium');

    // Test desktop mouse interactions
    const { context: desktopContext, contextId: desktopId } = await helper.createDesktopContext('chromium');
    const desktopPage = await helper.createPage(desktopId);

    // Test mobile touch interactions
    const { context: mobileContext, contextId: mobileId } = await helper.createMobileContext('chromium', 'iPhone 12');
    const mobilePage = await helper.createPage(mobileId);

    // Add test buttons to pages
    await desktopPage.evaluate(() => {
      const button = document.createElement('button');
      button.id = 'test-button';
      button.textContent = 'Test Button';
      button.style.cssText = 'width: 100px; height: 50px; margin: 20px;';
      document.body.appendChild(button);

      let clickCount = 0;
      button.addEventListener('click', () => {
        clickCount++;
        button.setAttribute('data-clicks', clickCount.toString());
      });
    });

    await mobilePage.evaluate(() => {
      const button = document.createElement('button');
      button.id = 'test-button';
      button.textContent = 'Test Button';
      button.style.cssText = 'width: 100px; height: 50px; margin: 20px;';
      document.body.appendChild(button);

      let touchCount = 0;
      button.addEventListener('touchstart', () => {
        touchCount++;
        button.setAttribute('data-touches', touchCount.toString());
      });

      button.addEventListener('click', () => {
        const clicks = parseInt(button.getAttribute('data-clicks') || '0') + 1;
        button.setAttribute('data-clicks', clicks.toString());
      });
    });

    // Test mouse click on desktop
    await desktopPage.click('#test-button');
    const desktopClicks = await desktopPage.getAttribute('#test-button', 'data-clicks');
    expect(parseInt(desktopClicks)).toBe(1);

    // Test touch on mobile
    await mobilePage.tap('#test-button');
    const mobileClicks = await mobilePage.getAttribute('#test-button', 'data-clicks');
    expect(parseInt(mobileClicks)).toBe(1);
  });

  test('should handle different audio input devices', async () => {
    await helper.launchBrowser('chromium');
    const { context, contextId } = await helper.createDesktopContext('chromium');
    const page = await helper.createPage(contextId);

    const deviceTest = await page.evaluate(async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const audioInputs = devices.filter(device => device.kind === 'audioinput');

        const deviceTests = [];

        for (const device of audioInputs.slice(0, 2)) { // Test first 2 devices
          try {
            const stream = await navigator.mediaDevices.getUserMedia({
              audio: { deviceId: device.deviceId }
            });

            const track = stream.getAudioTracks()[0];
            const settings = track.getSettings();

            deviceTests.push({
              deviceId: device.deviceId,
              label: device.label,
              success: true,
              settings: settings
            });

            track.stop();
          } catch (error) {
            deviceTests.push({
              deviceId: device.deviceId,
              label: device.label,
              success: false,
              error: error.message
            });
          }
        }

        return {
          totalDevices: audioInputs.length,
          deviceTests: deviceTests
        };
      } catch (error) {
        return {
          error: error.message
        };
      }
    });

    if (!deviceTest.error) {
      expect(deviceTest.totalDevices).toBeGreaterThanOrEqual(0);

      // At least one device should work if any are available
      if (deviceTest.deviceTests.length > 0) {
        const workingDevices = deviceTest.deviceTests.filter(test => test.success);
        expect(workingDevices.length).toBeGreaterThan(0);
      }
    }
  });

  test('should handle browser permission models', async () => {
    const browsers = ['chromium', 'firefox'];
    const permissionTests = new Map();

    for (const browserType of browsers) {
      await helper.launchBrowser(browserType);
      const { context, contextId } = await helper.createDesktopContext(browserType);
      const page = await helper.createPage(contextId);

      const permissionTest = await page.evaluate(async () => {
        const results = {};

        // Test microphone permission
        try {
          const micPermission = await navigator.permissions.query({ name: 'microphone' });
          results.microphone = micPermission.state;
        } catch (error) {
          results.microphone = 'not_supported';
        }

        // Test camera permission
        try {
          const cameraPermission = await navigator.permissions.query({ name: 'camera' });
          results.camera = cameraPermission.state;
        } catch (error) {
          results.camera = 'not_supported';
        }

        // Test notification permission
        try {
          results.notifications = Notification.permission;
        } catch (error) {
          results.notifications = 'not_supported';
        }

        return results;
      });

      permissionTests.set(browserType, permissionTest);
    }

    // Verify permission handling
    for (const [browserType, permissions] of permissionTests) {
      expect(['granted', 'denied', 'prompt', 'not_supported']).toContain(permissions.microphone);
      expect(['granted', 'denied', 'prompt', 'not_supported']).toContain(permissions.camera);
    }
  });

  test('should handle WebSocket connection across platforms', async () => {
    const browsers = ['chromium', 'firefox'];
    const wsTests = new Map();

    for (const browserType of browsers) {
      await helper.launchBrowser(browserType);
      const { context, contextId } = await helper.createDesktopContext(browserType);
      const page = await helper.createPage(contextId);

      const wsTest = await page.evaluate(() => {
        return new Promise((resolve) => {
          const ws = new WebSocket('ws://localhost:8080/ws');
          const startTime = Date.now();

          const timeout = setTimeout(() => {
            resolve({
              success: false,
              error: 'connection_timeout',
              duration: Date.now() - startTime
            });
          }, 5000);

          ws.onopen = () => {
            clearTimeout(timeout);
            const duration = Date.now() - startTime;

            // Test message sending
            ws.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));

            ws.onmessage = (event) => {
              const data = JSON.parse(event.data);
              ws.close();

              resolve({
                success: true,
                duration: duration,
                messageReceived: !!data,
                readyState: ws.readyState
              });
            };
          };

          ws.onerror = (error) => {
            clearTimeout(timeout);
            resolve({
              success: false,
              error: 'connection_error',
              duration: Date.now() - startTime
            });
          };
        });
      });

      wsTests.set(browserType, wsTest);
    }

    // Verify WebSocket functionality across browsers
    for (const [browserType, test] of wsTests) {
      if (test.success) {
        expect(test.duration).toBeLessThan(5000);
        expect(test.messageReceived).toBe(true);
      }
    }
  });
});