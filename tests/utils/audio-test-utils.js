/**
 * Generates a mock audio buffer with the specified properties
 * @param {number} duration - Duration in seconds
 * @param {number} sampleRate - Sample rate in Hz (default: 44100)
 * @param {number} frequency - Frequency in Hz (default: 440)
 * @returns {Float32Array} Generated audio buffer
 */
function generateAudioBuffer(duration = 1.0, sampleRate = 44100, frequency = 440) {
  const length = Math.floor(duration * sampleRate);
  const buffer = new Float32Array(length);
  
  // Generate a simple sine wave
  for (let i = 0; i < length; i++) {
    buffer[i] = Math.sin(2 * Math.PI * frequency * (i / sampleRate));
  }
  
  return buffer;
}

/**
 * Creates a mock MediaStream with audio tracks
 * @returns {MediaStream} Mock MediaStream
 */
function createMockMediaStream() {
  const stream = new EventTarget();
  const tracks = [];
  
  // Add audio track
  const audioTrack = {
    kind: 'audio',
    enabled: true,
    stop: jest.fn(),
    getSettings: () => ({
      sampleRate: 44100,
      channelCount: 1,
      sampleSize: 32,
    }),
  };
  
  tracks.push(audioTrack);
  
  // Add stream methods
  stream.getTracks = () => [...tracks];
  stream.getAudioTracks = () => tracks.filter(t => t.kind === 'audio');
  stream.getVideoTracks = () => [];
  stream.addTrack = (track) => tracks.push(track);
  stream.removeTrack = (track) => {
    const index = tracks.indexOf(track);
    if (index > -1) {
      tracks.splice(index, 1);
    }
  };
  
  return stream;
}

/**
 * Creates a mock AudioContext with basic methods
 * @returns {Object} Mock AudioContext
 */
function createMockAudioContext() {
  const audioContext = {
    state: 'suspended',
    sampleRate: 44100,
    destination: {
      connect: jest.fn(),
      disconnect: jest.fn(),
    },
    suspend: jest.fn().mockResolvedValue(undefined),
    resume: jest.fn().mockResolvedValue(undefined),
    close: jest.fn().mockResolvedValue(undefined),
    createMediaStreamSource: jest.fn().mockReturnValue({
      connect: jest.fn(),
      disconnect: jest.fn(),
    }),
    createAnalyser: jest.fn().mockReturnValue({
      connect: jest.fn(),
      disconnect: jest.fn(),
      fftSize: 2048,
      frequencyBinCount: 1024,
      getByteFrequencyData: jest.fn(),
      getFloatFrequencyData: jest.fn(),
    }),
    createScriptProcessor: jest.fn().mockReturnValue({
      connect: jest.fn(),
      disconnect: jest.fn(),
    }),
    createMediaStreamDestination: jest.fn().mockReturnValue({
      stream: createMockMediaStream(),
      connect: jest.fn(),
      disconnect: jest.fn(),
    }),
  };
  
  return audioContext;
}

/**
 * Creates a mock MediaRecorder instance
 * @param {Object} options - MediaRecorder options
 * @returns {Object} Mock MediaRecorder
 */
function createMockMediaRecorder(options = {}) {
  const recorder = new EventTarget();
  let isRecording = false;
  
  // Mock methods
  recorder.start = jest.fn(() => {
    isRecording = true;
    recorder.dispatchEvent(new Event('start'));
  });
  
  recorder.stop = jest.fn(() => {
    if (isRecording) {
      isRecording = false;
      
      // Create mock data available event
      const event = new Event('dataavailable');
      event.data = new Blob([generateAudioBuffer(0.1)], { type: 'audio/wav' });
      recorder.dispatchEvent(event);
      
      recorder.dispatchEvent(new Event('stop'));
    }
  });
  
  recorder.pause = jest.fn(() => {
    isRecording = false;
    recorder.dispatchEvent(new Event('pause'));
  });
  
  recorder.resume = jest.fn(() => {
    isRecording = true;
    recorder.dispatchEvent(new Event('resume'));
  });
  
  // Mock properties
  recorder.state = isRecording ? 'recording' : 'inactive';
  recorder.mimeType = options.mimeType || 'audio/wav';
  recorder.stream = options.stream || createMockMediaStream();
  
  // Add getter for state
  Object.defineProperty(recorder, 'state', {
    get: () => isRecording ? 'recording' : 'inactive',
  });
  
  return recorder;
}

module.exports = {
  generateAudioBuffer,
  createMockMediaStream,
  createMockAudioContext,
  createMockMediaRecorder,
};
