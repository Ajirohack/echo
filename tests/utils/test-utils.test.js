// Jest is available globally, no need to import
const {
  mockT,
  createMockAudioContext,
  createMockMediaStream,
  MockResizeObserver,
  createComponentMock,
  createControllablePromise,
  waitFor,
  useFakeTimers,
  mockFetch
} = require('./test-utils');

describe('Test Utilities', () => {
  describe('mockT', () => {
    it('should return the key as the translation', () => {
      expect(mockT('test.key')).toBe('test.key');
    });
  });

  describe('createMockAudioContext', () => {
    it('should create a mock AudioContext with expected methods', () => {
      const mock = createMockAudioContext();
      
      expect(mock).toHaveProperty('suspend');
      expect(typeof mock.suspend).toBe('function');
      expect(mock).toHaveProperty('resume');
      expect(typeof mock.resume).toBe('function');
      expect(mock).toHaveProperty('close');
      expect(typeof mock.close).toBe('function');
      expect(mock).toHaveProperty('destination');
      expect(mock).toHaveProperty('createMediaStreamSource');
      expect(typeof mock.createMediaStreamSource).toBe('function');
    });

    it('should allow calling mocked methods', async () => {
      const mock = createMockAudioContext();
      await mock.suspend();
      
      expect(mock.suspend).toHaveBeenCalledTimes(1);
    });
  });

  describe('createMockMediaStream', () => {
    it('should create a mock MediaStream with expected methods', () => {
      const mock = createMockMediaStream();
      
      expect(mock).toHaveProperty('getTracks');
      expect(typeof mock.getTracks).toBe('function');
      expect(mock).toHaveProperty('getAudioTracks');
      expect(typeof mock.getAudioTracks).toBe('function');
      expect(mock).toHaveProperty('getVideoTracks');
      expect(typeof mock.getVideoTracks).toBe('function');
      expect(mock).toHaveProperty('addTrack');
      expect(typeof mock.addTrack).toBe('function');
      expect(mock).toHaveProperty('removeTrack');
      expect(typeof mock.removeTrack).toBe('function');
    });
  });

  describe('MockResizeObserver', () => {
    it('should create a mock ResizeObserver with expected methods', () => {
      const callback = () => {};
      const observer = new MockResizeObserver(callback);
      
      expect(observer).toHaveProperty('observe');
      expect(typeof observer.observe).toBe('function');
      expect(observer).toHaveProperty('unobserve');
      expect(typeof observer.unobserve).toBe('function');
      expect(observer).toHaveProperty('disconnect');
      expect(typeof observer.disconnect).toBe('function');
    });
  });

  describe('createComponentMock', () => {
    it('should create a mock React component', () => {
      const MockComponent = createComponentMock('TestComponent');
      const element = MockComponent.TestComponent({ children: 'test' });
      
      expect(element.type).toBe('TestComponent');
      expect(element.props.children).toBe('test');
    });
  });

  describe('createControllablePromise', () => {
    it('should create a promise with resolve and reject controls', async () => {
      const { promise, resolve } = createControllablePromise();
      const testValue = 'test value';
      
      setTimeout(() => resolve(testValue), 100);
      
      const result = await promise;
      expect(result).toBe(testValue);
    });
  });

  describe('waitFor', () => {
    it('should wait for a condition to be true', async () => {
      let value = false;
      setTimeout(() => { value = true; }, 50);
      
      await waitFor(() => value === true, 200);
      expect(value).toBe(true);
    });

    it('should timeout if condition is not met', async () => {
      try {
        await waitFor(() => false, 50);
        throw new Error('Should have timed out');
      } catch (error) {
        expect(error.message).toContain('Timeout');
      }
    });
  });

  describe('useFakeTimers', () => {
    it('should mock timers', () => {
      const clock = useFakeTimers();
      const callback = jest.fn();
      
      setTimeout(callback, 1000);
      clock.tick(1000);
      
      expect(callback).toHaveBeenCalledTimes(1);
      clock.restore();
    });
  });

  describe('mockFetch', () => {
    afterEach(() => {
      if (global.fetch && global.fetch.mockRestore) {
        global.fetch.mockRestore();
      } else {
        delete global.fetch;
      }
    });

    it('should mock fetch with a successful response', async () => {
      const testData = { id: 1, name: 'Test' };
      const mock = mockFetch(testData);
      
      const response = await fetch('https://api.example.com/test');
      const data = await response.json();
      
      expect(mock).toHaveBeenCalledWith('https://api.example.com/test');
      expect(response.ok).toBe(true);
      expect(data).toEqual(testData);
    });

    it('should mock fetch with an error response', async () => {
      const mock = mockFetch(null, { status: 404, ok: false, statusText: 'Not Found' });
      
      const response = await fetch('https://api.example.com/not-found');
      
      expect(mock).toHaveBeenCalledWith('https://api.example.com/not-found');
      expect(response.ok).toBe(false);
      expect(response.status).toBe(404);
    });
  });
});
