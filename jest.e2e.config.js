const config = require('./jest.config');

module.exports = {
  ...config,
  testMatch: ['<rootDir>/tests/e2e/**/*.test.js'],
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/tests/setupE2E.js'],
  testTimeout: 30000, // 30 seconds timeout for E2E tests
  globalSetup: '<rootDir>/tests/e2e/setup.js',
  globalTeardown: '<rootDir>/tests/e2e/teardown.js',
  testEnvironmentOptions: {
    url: 'http://localhost:3000',
  },
};
