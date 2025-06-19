// Test utility functions
const sinon = require('sinon');
const React = require('react');

// Mock translation function for testing
const mockT = (key) => key;

// Mock audio context for testing
const createMockAudioContext = () => {
  const mock = {
    suspend: sinon.stub().resolves(undefined),
    close: sinon.stub().resolves(undefined),
    resume: sinon.stub().resolves(undefined),
    state: 'suspended',
    destination: {
      connect: sinon.stub(),
      disconnect: sinon.stub(),
    },
    createMediaStreamSource: sinon.stub().returns({
      connect: sinon.stub(),
      disconnect: sinon.stub(),
    }),
    createAnalyser: sinon.stub().returns({
      connect: sinon.stub(),
      disconnect: sinon.stub(),
    }),
    createScriptProcessor: sinon.stub().returns({
      connect: sinon.stub(),
      disconnect: sinon.stub(),
    }),
  };
  
  return mock;
};

// Mock MediaStream for testing
const createMockMediaStream = () => ({
  getTracks: sinon.stub().returns([{ stop: sinon.stub() }]),
  getAudioTracks: sinon.stub().returns([{ enabled: true, stop: sinon.stub() }]),
  getVideoTracks: sinon.stub().returns([]),
  addTrack: sinon.stub(),
  removeTrack: sinon.stub(),
});

// Mock ResizeObserver for testing
class MockResizeObserver {
  constructor(callback) {
    this.callback = callback;
    this.observe = sinon.stub();
    this.unobserve = sinon.stub();
    this.disconnect = sinon.stub();
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
  
  // Re-export commonly used testing utilities
  ...require('sinon'),
  
  // Helper to create a basic component mock
  createComponentMock: (name, implementation = {}) => {
    return {
      [name]: sinon.stub().callsFake((props) => {
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
    const clock = sinon.useFakeTimers();
    return {
      tick: (ms) => clock.tick(ms),
      restore: () => clock.restore(),
      now: () => clock.now,
    };
  },
  
  // Helper to mock fetch
  mockFetch: (response, options = {}) => {
    const { status = 200, ok = true, statusText = 'OK' } = options;
    const mockResponse = {
      ok,
      status,
      statusText,
      json: sinon.stub().resolves(response),
      text: sinon.stub().resolves(JSON.stringify(response)),
      clone: sinon.stub().returnsThis(),
      ...options.response
    };
    
    global.fetch = sinon.stub().resolves(mockResponse);
    return global.fetch;
  },
};
