/**
 * Playwright configuration for Echo RTC integration tests
 * @see https://playwright.dev/docs/test-configuration
 */

const { defineConfig, devices } = require('@playwright/test');

/**
 * Read environment variables with defaults
 */
const config = {
  baseURL: process.env.TEST_BASE_URL || 'http://localhost:8080',
  timeout: parseInt(process.env.TEST_TIMEOUT) || 300000, // 5 minutes
  retries: parseInt(process.env.TEST_RETRIES) || 2,
  headless: process.env.TEST_HEADLESS !== 'false',
  parallel: process.env.TEST_PARALLEL !== 'false',
  slowMo: parseInt(process.env.TEST_SLOW_MO) || 0,
  outputDir: process.env.TEST_OUTPUT_DIR || './test-results',
  workers: process.env.CI ? 2 : undefined, // Limit workers in CI
};

module.exports = defineConfig({
  testDir: '.',

  /* Run tests in files in parallel */
  fullyParallel: config.parallel,

  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,

  /* Retry on CI only */
  retries: process.env.CI ? config.retries : 0,

  /* Opt out of parallel tests on CI. */
  workers: config.workers,

  /* Global test timeout */
  timeout: config.timeout,

  /* Expect timeout for assertions */
  expect: {
    timeout: 30000, // 30 seconds for assertions
  },

  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: [
    ['html', {
      outputFolder: `${config.outputDir}/playwright-report`,
      open: process.env.CI ? 'never' : 'on-failure'
    }],
    ['json', {
      outputFile: `${config.outputDir}/playwright-results.json`
    }],
    ['junit', {
      outputFile: `${config.outputDir}/junit-results.xml`
    }],
    // Add line reporter for better CI output
    process.env.CI ? ['github'] : ['list']
  ],

  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: config.baseURL,

    /* Run browsers in headless mode */
    headless: config.headless,

    /* Slow down operations by specified milliseconds */
    slowMo: config.slowMo,

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',

    /* Take screenshot on failure */
    screenshot: 'only-on-failure',

    /* Record video on failure */
    video: 'retain-on-failure',

    /* Ignore HTTPS errors */
    ignoreHTTPSErrors: true,

    /* Default viewport */
    viewport: { width: 1280, height: 720 },

    /* Default timeout for actions */
    actionTimeout: 30000,

    /* Default timeout for navigation */
    navigationTimeout: 60000,

    /* Permissions for WebRTC tests */
    permissions: ['microphone', 'camera'],

    /* Extra HTTP headers */
    extraHTTPHeaders: {
      'Accept-Language': 'en-US,en;q=0.9'
    }
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Enable WebRTC features
        launchOptions: {
          args: [
            '--use-fake-ui-for-media-stream',
            '--use-fake-device-for-media-stream',
            '--allow-running-insecure-content',
            '--disable-web-security',
            '--disable-features=VizDisplayCompositor',
            '--enable-experimental-web-platform-features'
          ]
        }
      },
    },

    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
        // Firefox-specific WebRTC configuration
        launchOptions: {
          firefoxUserPrefs: {
            'media.navigator.streams.fake': true,
            'media.navigator.permission.disabled': true,
            'media.autoplay.default': 0,
            'media.autoplay.blocking_policy': 0
          }
        }
      },
    },

    {
      name: 'webkit',
      use: {
        ...devices['Desktop Safari'],
        // WebKit-specific configuration
        launchOptions: {
          args: [
            '--enable-experimental-web-platform-features'
          ]
        }
      },
    },

    /* Test against mobile viewports. */
    {
      name: 'Mobile Chrome',
      use: {
        ...devices['Pixel 5'],
        // Mobile Chrome WebRTC configuration
        launchOptions: {
          args: [
            '--use-fake-ui-for-media-stream',
            '--use-fake-device-for-media-stream',
            '--allow-running-insecure-content',
            '--disable-web-security'
          ]
        }
      },
    },

    {
      name: 'Mobile Safari',
      use: {
        ...devices['iPhone 12'],
        // Mobile Safari configuration
        launchOptions: {
          args: [
            '--enable-experimental-web-platform-features'
          ]
        }
      },
    },

    /* Additional browser configurations for comprehensive testing */
    {
      name: 'Microsoft Edge',
      use: {
        ...devices['Desktop Edge'],
        channel: 'msedge',
        launchOptions: {
          args: [
            '--use-fake-ui-for-media-stream',
            '--use-fake-device-for-media-stream',
            '--allow-running-insecure-content',
            '--disable-web-security'
          ]
        }
      },
    },

    /* Tablet testing */
    {
      name: 'iPad',
      use: {
        ...devices['iPad Pro'],
        launchOptions: {
          args: [
            '--enable-experimental-web-platform-features'
          ]
        }
      },
    },

    /* High DPI testing */
    {
      name: 'High DPI',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1920, height: 1080 },
        deviceScaleFactor: 2,
        launchOptions: {
          args: [
            '--use-fake-ui-for-media-stream',
            '--use-fake-device-for-media-stream',
            '--force-device-scale-factor=2'
          ]
        }
      },
    }
  ],

  /* Global setup and teardown */
  globalSetup: require.resolve('./global-setup.js'),
  globalTeardown: require.resolve('./global-teardown.js'),

  /* Output directory for test artifacts */
  outputDir: `${config.outputDir}/test-artifacts`,

  /* Test match patterns */
  testMatch: [
    '**/*.test.js',
    '**/*.spec.js'
  ],

  /* Test ignore patterns */
  testIgnore: [
    '**/node_modules/**',
    '**/test-results/**',
    '**/playwright-report/**'
  ],

  /* Web server configuration for local development */
  webServer: process.env.CI ? undefined : {
    command: 'cd ../../backend && npm start',
    port: 8080,
    timeout: 120000, // 2 minutes to start server
    reuseExistingServer: !process.env.CI,
    env: {
      NODE_ENV: 'test',
      LOG_LEVEL: 'warn'
    }
  },

  /* Maximum number of test failures before stopping */
  maxFailures: process.env.CI ? 10 : undefined,

  /* Metadata for test runs */
  metadata: {
    testType: 'integration',
    platform: process.platform,
    nodeVersion: process.version,
    timestamp: new Date().toISOString()
  }
});