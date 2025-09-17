// Test utility functions
const React = require('react');

// Mock translation function for testing
const mockT = (key) => key;

// Mock audio context for testing
const createMockAudioContext = () => {
  const mock = {
    suspend: jest.fn().mockResolvedValue(undefined),
    close: jest.fn().mockResolvedValue(undefined),
    resume: jest.fn().mockResolvedValue(undefined),
    state: 'suspended',
    destination: {
      connect: jest.fn(),
      disconnect: jest.fn(),
    },
    createMediaStreamSource: jest.fn().mockReturnValue({
      connect: jest.fn(),
      disconnect: jest.fn(),
    }),
    createAnalyser: jest.fn().mockReturnValue({
      connect: jest.fn(),
      disconnect: jest.fn(),
    }),
    createScriptProcessor: jest.fn().mockReturnValue({
      connect: jest.fn(),
      disconnect: jest.fn(),
    }),
  };
  
  return mock;
};

// Mock MediaStream for testing
const createMockMediaStream = () => ({
  getTracks: jest.fn().mockReturnValue([{ stop: jest.fn() }]),
  getAudioTracks: jest.fn().mockReturnValue([{ enabled: true, stop: jest.fn() }]),
  getVideoTracks: jest.fn().mockReturnValue([]),
  addTrack: jest.fn(),
  removeTrack: jest.fn(),
});

// Mock ResizeObserver for testing
class MockResizeObserver {
  constructor(callback) {
    this.callback = callback;
    this.observe = jest.fn();
    this.unobserve = jest.fn();
    this.disconnect = jest.fn();
  }
}

// Only set global.ResizeObserver if not already defined
if (typeof global.ResizeObserver === 'undefined') {
  global.ResizeObserver = MockResizeObserver;
}

// Export all utilities
module.exports = {
  // Custom mocks and utilities
  mockT,
  createMockAudioContext,
  createMockMediaStream,
  MockResizeObserver,
  
  // Jest testing utilities
  fn: jest.fn,
  spyOn: jest.spyOn,
  mock: jest.mock,
  
  // Helper to create a basic component mock
  createComponentMock: (name, implementation = {}) => {
    return {
      [name]: jest.fn().mockImplementation((props) => {
        return React.createElement(name, props, props.children);
      }),
      [`${name}DisplayName`]: name,
      ...implementation
    };
  },
  
  // Helper to create a promise that can be resolved/rejected from the test
  createControllablePromise: () => {
    let resolve, reject;
    const promise = new Promise((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  },
  
  // Helper to wait for a condition
  waitFor: (condition, timeout = 1000, interval = 50) => {
    const startTime = Date.now();
    
    return new Promise((resolve, reject) => {
      const checkCondition = () => {
        try {
          const result = condition();
          if (result) {
            resolve(result);
          } else if (Date.now() - startTime >= timeout) {
            reject(new Error(`Timeout of ${timeout}ms exceeded waiting for condition`));
          } else {
            setTimeout(checkCondition, interval);
          }
        } catch (error) {
          reject(error);
        }
      };
      
      checkCondition();
    });
  },
  
  // Helper to mock timers
  useFakeTimers: () => {
    jest.useFakeTimers();
    return {
      tick: (ms) => jest.advanceTimersByTime(ms),
      restore: () => jest.useRealTimers(),
      now: () => Date.now(),
    };
  },
  
  // Helper to mock fetch
  mockFetch: (response, options = {}) => {
    const { status = 200, ok = true, statusText = 'OK' } = options;
    const mockResponse = {
      ok,
      status,
      statusText,
      json: jest.fn().mockResolvedValue(response),
      text: jest.fn().mockResolvedValue(JSON.stringify(response)),
      clone: jest.fn().mockReturnThis(),
      ...options.response
    };
    
    global.fetch = jest.fn().mockResolvedValue(mockResponse);
    return global.fetch;
  },
};
