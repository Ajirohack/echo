module.exports = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: [
    '<rootDir>/src/setupTests.js',
    '@testing-library/jest-dom'
  ],
  testPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/dist/'
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    // Map logger to mock to avoid fs side effects in tests (match both alias and relative imports)
    '^@/utils/logger$': '<rootDir>/tests/__mocks__/logger.js',
    '^(.*/)?utils/logger$': '<rootDir>/tests/__mocks__/logger.js',
    '\\.(css|less)$': 'identity-obj-proxy',
    '\\.(jpg|jpeg|png|gif|eot|otf|webp|svg|ttf|woff|woff2|mp4|webm|wav|mp3|m4a|aac|oga)$': 
      '<rootDir>/__mocks__/fileMock.js'
  },
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'src/**/*.{js,jsx,ts,tsx}',
    '!src/**/*.d.ts',
    '!src/index.js',
    '!src/serviceWorker.js',
  ],
  coverageReporters: ['text', 'lcov'],
  testMatch: [
    '<rootDir>/tests/**/*.test.js',
    '<rootDir>/tests/**/*.test.jsx',
    '<rootDir>/src/__tests__/**/*.test.js',
    '<rootDir>/src/__tests__/**/*.test.jsx'
  ],
  transform: {
    // Include mjs/cjs for ESM packages
    '^.+\\.(mjs|cjs|js|jsx|ts|tsx)$': 'babel-jest',
  },
  moduleFileExtensions: ['js', 'jsx', 'json', 'node'],
  transformIgnorePatterns: [
    // Allow transforming specific ESM packages in node_modules if needed
    'node_modules/(?!(openai|elevenlabs|undici|node-fetch|whatwg-url)/)',
    '^.+\\.module\\.(css|sass|scss)$',
  ],
  resetMocks: true,
};
