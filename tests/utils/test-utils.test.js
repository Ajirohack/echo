const { expect } = require('chai');
const sinon = require('sinon');
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

describe('Test Utilities', function() {
  describe('mockT', function() {
    it('should return the key as the translation', function() {
      expect(mockT('test.key')).to.equal('test.key');
    });
  });

  describe('createMockAudioContext', function() {
    it('should create a mock AudioContext with expected methods', function() {
      const mock = createMockAudioContext();
      
      expect(mock).to.have.property('suspend').that.is.a('function');
      expect(mock).to.have.property('resume').that.is.a('function');
      expect(mock).to.have.property('close').that.is.a('function');
      expect(mock).to.have.property('destination');
      expect(mock).to.have.property('createMediaStreamSource').that.is.a('function');
    });

    it('should allow calling mocked methods', async function() {
      const mock = createMockAudioContext();
      await mock.suspend();
      
      expect(mock.suspend).to.have.been.calledOnce;
    });
  });

  describe('createMockMediaStream', function() {
    it('should create a mock MediaStream with expected methods', function() {
      const mock = createMockMediaStream();
      
      expect(mock).to.have.property('getTracks').that.is.a('function');
      expect(mock).to.have.property('getAudioTracks').that.is.a('function');
      expect(mock).to.have.property('getVideoTracks').that.is.a('function');
      expect(mock).to.have.property('addTrack').that.is.a('function');
      expect(mock).to.have.property('removeTrack').that.is.a('function');
    });
  });

  describe('MockResizeObserver', function() {
    it('should create a mock ResizeObserver with expected methods', function() {
      const callback = () => {};
      const observer = new MockResizeObserver(callback);
      
      expect(observer).to.have.property('observe').that.is.a('function');
      expect(observer).to.have.property('unobserve').that.is.a('function');
      expect(observer).to.have.property('disconnect').that.is.a('function');
    });
  });

  describe('createComponentMock', function() {
    it('should create a mock React component', function() {
      const MockComponent = createComponentMock('TestComponent');
      const element = MockComponent.TestComponent({ children: 'test' });
      
      expect(element.type).to.equal('TestComponent');
      expect(element.props.children).to.equal('test');
    });
  });

  describe('createControllablePromise', function() {
    it('should create a promise with resolve and reject controls', async function() {
      const { promise, resolve } = createControllablePromise();
      const testValue = 'test value';
      
      setTimeout(() => resolve(testValue), 100);
      
      const result = await promise;
      expect(result).to.equal(testValue);
    });
  });

  describe('waitFor', function() {
    it('should wait for a condition to be true', async function() {
      let value = false;
      setTimeout(() => { value = true; }, 50);
      
      await waitFor(() => value === true, 200);
      expect(value).to.be.true;
    });

    it('should timeout if condition is not met', async function() {
      try {
        await waitFor(() => false, 50);
        throw new Error('Should have timed out');
      } catch (error) {
        expect(error.message).to.include('Timeout');
      }
    });
  });

  describe('useFakeTimers', function() {
    it('should mock timers', function() {
      const clock = useFakeTimers();
      const callback = sinon.stub();
      
      setTimeout(callback, 1000);
      clock.tick(1000);
      
      expect(callback).to.have.been.calledOnce;
      clock.restore();
    });
  });

  describe('mockFetch', function() {
    afterEach(function() {
      if (global.fetch && global.fetch.restore) {
        global.fetch.restore();
      } else {
        delete global.fetch;
      }
    });

    it('should mock fetch with a successful response', async function() {
      const testData = { id: 1, name: 'Test' };
      const mock = mockFetch(testData);
      
      const response = await fetch('https://api.example.com/test');
      const data = await response.json();
      
      expect(mock).to.have.been.calledWith('https://api.example.com/test');
      expect(response.ok).to.be.true;
      expect(data).to.deep.equal(testData);
    });

    it('should mock fetch with an error response', async function() {
      const mock = mockFetch(null, { status: 404, ok: false, statusText: 'Not Found' });
      
      const response = await fetch('https://api.example.com/not-found');
      
      expect(mock).to.have.been.calledWith('https://api.example.com/not-found');
      expect(response.ok).to.be.false;
      expect(response.status).to.equal(404);
    });
  });
});
