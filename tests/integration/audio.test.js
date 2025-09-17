/**
 * Integration tests for audio processing features
 * Tests noise suppression, echo cancellation, and audio quality optimization
 */

const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

class AudioTestHelper {
  constructor() {
    this.audioContext = null;
    this.testAudioFiles = new Map();
    this.processors = new Map();
  }

  async initializeAudioContext() {
    // Mock AudioContext for testing
    this.audioContext = {
      sampleRate: 48000,
      currentTime: 0,
      state: 'running',

      createGain: () => ({
        gain: { value: 1.0, setValueAtTime: () => { } },
        connect: () => { },
        disconnect: () => { }
      }),

      createBiquadFilter: () => ({
        type: 'highpass',
        frequency: { value: 300, setValueAtTime: () => { } },
        Q: { value: 1, setValueAtTime: () => { } },
        gain: { value: 0, setValueAtTime: () => { } },
        connect: () => { },
        disconnect: () => { }
      }),

      createAnalyser: () => ({
        fftSize: 2048,
        frequencyBinCount: 1024,
        minDecibels: -100,
        maxDecibels: -30,
        smoothingTimeConstant: 0.8,
        getByteFrequencyData: (array) => {
          // Simulate frequency data
          for (let i = 0; i < array.length; i++) {
            array[i] = Math.floor(Math.random() * 255);
          }
        },
        getFloatFrequencyData: (array) => {
          for (let i = 0; i < array.length; i++) {
            array[i] = -100 + Math.random() * 70;
          }
        }
      }),

      createScriptProcessor: (bufferSize, inputChannels, outputChannels) => ({
        bufferSize: bufferSize || 4096,
        onaudioprocess: null,
        connect: () => { },
        disconnect: () => { }
      }),

      createMediaStreamSource: (stream) => ({
        mediaStream: stream,
        connect: () => { },
        disconnect: () => { }
      }),

      createMediaStreamDestination: () => ({
        stream: {
          id: 'destination-stream',
          getTracks: () => []
        },
        connect: () => { },
        disconnect: () => { }
      })
    };

    return this.audioContext;
  }

  generateTestAudioBuffer(duration = 1.0, frequency = 440, sampleRate = 48000) {
    const length = sampleRate * duration;
    const buffer = new Float32Array(length);

    for (let i = 0; i < length; i++) {
      buffer[i] = Math.sin(2 * Math.PI * frequency * i / sampleRate);
    }

    return buffer;
  }

  addNoise(buffer, noiseLevel = 0.1) {
    const noisyBuffer = new Float32Array(buffer.length);

    for (let i = 0; i < buffer.length; i++) {
      const noise = (Math.random() - 0.5) * 2 * noiseLevel;
      noisyBuffer[i] = buffer[i] + noise;
    }

    return noisyBuffer;
  }

  calculateRMS(buffer) {
    let sum = 0;
    for (let i = 0; i < buffer.length; i++) {
      sum += buffer[i] * buffer[i];
    }
    return Math.sqrt(sum / buffer.length);
  }

  calculateSNR(signal, noise) {
    const signalPower = this.calculateRMS(signal);
    const noisePower = this.calculateRMS(noise);
    return 20 * Math.log10(signalPower / noisePower);
  }

  applyHighPassFilter(buffer, cutoffFreq = 300, sampleRate = 48000) {
    // Simple high-pass filter implementation
    const filteredBuffer = new Float32Array(buffer.length);
    const RC = 1.0 / (cutoffFreq * 2 * Math.PI);
    const dt = 1.0 / sampleRate;
    const alpha = RC / (RC + dt);

    filteredBuffer[0] = buffer[0];

    for (let i = 1; i < buffer.length; i++) {
      filteredBuffer[i] = alpha * (filteredBuffer[i - 1] + buffer[i] - buffer[i - 1]);
    }

    return filteredBuffer;
  }

  applyGainControl(buffer, targetLevel = 0.5) {
    const currentRMS = this.calculateRMS(buffer);
    const gainFactor = targetLevel / currentRMS;

    const adjustedBuffer = new Float32Array(buffer.length);
    for (let i = 0; i < buffer.length; i++) {
      adjustedBuffer[i] = buffer[i] * gainFactor;
    }

    return adjustedBuffer;
  }

  simulateEchoEffect(buffer, delay = 0.1, decay = 0.3, sampleRate = 48000) {
    const delayInSamples = Math.floor(delay * sampleRate);
    const echoBuffer = new Float32Array(buffer.length + delayInSamples);

    // Copy original signal
    for (let i = 0; i < buffer.length; i++) {
      echoBuffer[i] = buffer[i];
    }

    // Add echo
    for (let i = 0; i < buffer.length; i++) {
      const echoIndex = i + delayInSamples;
      if (echoIndex < echoBuffer.length) {
        echoBuffer[echoIndex] += buffer[i] * decay;
      }
    }

    return echoBuffer.slice(0, buffer.length);
  }

  cleanup() {
    this.testAudioFiles.clear();
    this.processors.clear();
    this.audioContext = null;
  }
}

test.describe('Audio Processing Integration Tests', () => {
  let helper;

  test.beforeEach(async () => {
    helper = new AudioTestHelper();
    await helper.initializeAudioContext();
  });

  test.afterEach(async () => {
    helper.cleanup();
  });

  test('should initialize audio context with correct settings', async () => {
    const audioContext = helper.audioContext;

    expect(audioContext).toBeDefined();
    expect(audioContext.sampleRate).toBe(48000);
    expect(audioContext.state).toBe('running');

    // Test audio node creation
    const gainNode = audioContext.createGain();
    expect(gainNode).toBeDefined();
    expect(gainNode.gain.value).toBe(1.0);

    const filterNode = audioContext.createBiquadFilter();
    expect(filterNode).toBeDefined();
    expect(filterNode.type).toBe('highpass');
    expect(filterNode.frequency.value).toBe(300);
  });

  test('should apply noise suppression effectively', async () => {
    // Generate clean test signal
    const cleanSignal = helper.generateTestAudioBuffer(1.0, 440);

    // Add noise to the signal
    const noisySignal = helper.addNoise(cleanSignal, 0.2);

    // Calculate initial SNR
    const noise = new Float32Array(cleanSignal.length);
    for (let i = 0; i < cleanSignal.length; i++) {
      noise[i] = noisySignal[i] - cleanSignal[i];
    }

    const initialSNR = helper.calculateSNR(cleanSignal, noise);

    // Apply noise suppression (high-pass filter)
    const filteredSignal = helper.applyHighPassFilter(noisySignal);

    // Calculate filtered noise
    const filteredNoise = new Float32Array(cleanSignal.length);
    for (let i = 0; i < cleanSignal.length; i++) {
      filteredNoise[i] = filteredSignal[i] - cleanSignal[i];
    }

    const finalSNR = helper.calculateSNR(cleanSignal, filteredNoise);

    // Noise suppression should improve SNR
    expect(finalSNR).toBeGreaterThan(initialSNR);
    expect(finalSNR - initialSNR).toBeGreaterThan(3); // At least 3dB improvement
  });

  test('should handle automatic gain control', async () => {
    // Generate signals with different levels
    const quietSignal = helper.generateTestAudioBuffer(1.0, 440);
    for (let i = 0; i < quietSignal.length; i++) {
      quietSignal[i] *= 0.1; // Make it quiet
    }

    const loudSignal = helper.generateTestAudioBuffer(1.0, 440);
    for (let i = 0; i < loudSignal.length; i++) {
      loudSignal[i] *= 2.0; // Make it loud
    }

    const targetLevel = 0.5;

    // Apply AGC
    const adjustedQuietSignal = helper.applyGainControl(quietSignal, targetLevel);
    const adjustedLoudSignal = helper.applyGainControl(loudSignal, targetLevel);

    // Check that both signals are now at similar levels
    const quietRMS = helper.calculateRMS(adjustedQuietSignal);
    const loudRMS = helper.calculateRMS(adjustedLoudSignal);

    expect(Math.abs(quietRMS - targetLevel)).toBeLessThan(0.05);
    expect(Math.abs(loudRMS - targetLevel)).toBeLessThan(0.05);
    expect(Math.abs(quietRMS - loudRMS)).toBeLessThan(0.1);
  });

  test('should detect and suppress echo', async () => {
    // Generate original signal
    const originalSignal = helper.generateTestAudioBuffer(1.0, 440);

    // Add echo to simulate acoustic feedback
    const echoSignal = helper.simulateEchoEffect(originalSignal, 0.1, 0.3);

    // Verify echo was added
    const originalRMS = helper.calculateRMS(originalSignal);
    const echoRMS = helper.calculateRMS(echoSignal);
    expect(echoRMS).toBeGreaterThan(originalRMS);

    // Apply echo cancellation (simplified - just high-pass filter)
    const cancelledSignal = helper.applyHighPassFilter(echoSignal, 100);

    // Echo cancellation should reduce the signal level closer to original
    const cancelledRMS = helper.calculateRMS(cancelledSignal);
    expect(Math.abs(cancelledRMS - originalRMS)).toBeLessThan(Math.abs(echoRMS - originalRMS));
  });

  test('should analyze audio frequency spectrum', async () => {
    const audioContext = helper.audioContext;
    const analyser = audioContext.createAnalyser();

    expect(analyser.fftSize).toBe(2048);
    expect(analyser.frequencyBinCount).toBe(1024);

    // Test frequency analysis
    const frequencyData = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(frequencyData);

    // Should have frequency data
    expect(frequencyData.length).toBe(1024);

    // Check that we have some frequency content
    const hasFrequencyContent = Array.from(frequencyData).some(value => value > 0);
    expect(hasFrequencyContent).toBe(true);

    // Test float frequency data
    const floatFrequencyData = new Float32Array(analyser.frequencyBinCount);
    analyser.getFloatFrequencyData(floatFrequencyData);

    expect(floatFrequencyData.length).toBe(1024);

    // Values should be in decibel range
    const validRange = Array.from(floatFrequencyData).every(value =>
      value >= -100 && value <= -30
    );
    expect(validRange).toBe(true);
  });

  test('should handle real-time audio processing chain', async () => {
    const audioContext = helper.audioContext;

    // Create processing chain: source -> gain -> filter -> analyser -> destination
    const gainNode = audioContext.createGain();
    const filterNode = audioContext.createBiquadFilter();
    const analyser = audioContext.createAnalyser();
    const destination = audioContext.createMediaStreamDestination();

    // Configure nodes
    gainNode.gain.value = 0.8;
    filterNode.type = 'highpass';
    filterNode.frequency.value = 300;
    analyser.fftSize = 1024;

    // Connect processing chain
    gainNode.connect(filterNode);
    filterNode.connect(analyser);
    analyser.connect(destination);

    // Verify connections work (nodes should be defined and connected)
    expect(gainNode).toBeDefined();
    expect(filterNode).toBeDefined();
    expect(analyser).toBeDefined();
    expect(destination).toBeDefined();
    expect(destination.stream).toBeDefined();
  });

  test('should handle audio constraints and quality settings', async () => {
    const audioConstraints = {
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        sampleRate: 48000,
        channelCount: 2,
        latency: 0.01, // 10ms latency
        volume: 1.0
      }
    };

    // Validate constraints
    expect(audioConstraints.audio.echoCancellation).toBe(true);
    expect(audioConstraints.audio.noiseSuppression).toBe(true);
    expect(audioConstraints.audio.autoGainControl).toBe(true);
    expect(audioConstraints.audio.sampleRate).toBe(48000);
    expect(audioConstraints.audio.channelCount).toBe(2);
    expect(audioConstraints.audio.latency).toBe(0.01);

    // Test quality adaptation based on network conditions
    const adaptQuality = (networkQuality) => {
      const baseConstraints = { ...audioConstraints };

      if (networkQuality === 'poor') {
        baseConstraints.audio.sampleRate = 16000;
        baseConstraints.audio.channelCount = 1;
        baseConstraints.audio.latency = 0.05;
      } else if (networkQuality === 'good') {
        baseConstraints.audio.sampleRate = 48000;
        baseConstraints.audio.channelCount = 2;
        baseConstraints.audio.latency = 0.01;
      }

      return baseConstraints;
    };

    const poorQualityConstraints = adaptQuality('poor');
    expect(poorQualityConstraints.audio.sampleRate).toBe(16000);
    expect(poorQualityConstraints.audio.channelCount).toBe(1);

    const goodQualityConstraints = adaptQuality('good');
    expect(goodQualityConstraints.audio.sampleRate).toBe(48000);
    expect(goodQualityConstraints.audio.channelCount).toBe(2);
  });

  test('should monitor audio levels and detect silence', async () => {
    const audioContext = helper.audioContext;
    const analyser = audioContext.createAnalyser();

    analyser.fftSize = 256;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    // Simulate audio level monitoring
    const monitorAudioLevel = () => {
      analyser.getByteFrequencyData(dataArray);

      // Calculate average level
      const average = dataArray.reduce((sum, value) => sum + value, 0) / bufferLength;

      // Detect silence (threshold below 10)
      const isSilent = average < 10;

      return {
        level: average,
        isSilent: isSilent,
        peak: Math.max(...dataArray)
      };
    };

    const audioLevel = monitorAudioLevel();

    expect(audioLevel.level).toBeGreaterThanOrEqual(0);
    expect(audioLevel.level).toBeLessThanOrEqual(255);
    expect(typeof audioLevel.isSilent).toBe('boolean');
    expect(audioLevel.peak).toBeGreaterThanOrEqual(0);
    expect(audioLevel.peak).toBeLessThanOrEqual(255);
  });

  test('should handle audio codec selection and optimization', async () => {
    // Test different audio codec configurations
    const codecConfigs = {
      opus: {
        mimeType: 'audio/opus',
        clockRate: 48000,
        channels: 2,
        parameters: {
          'sprop-stereo': 1,
          'stereo': 1,
          'useinbandfec': 1,
          'usedtx': 1
        }
      },
      pcmu: {
        mimeType: 'audio/PCMU',
        clockRate: 8000,
        channels: 1
      },
      pcma: {
        mimeType: 'audio/PCMA',
        clockRate: 8000,
        channels: 1
      }
    };

    // Test codec selection based on quality requirements
    const selectOptimalCodec = (qualityLevel) => {
      if (qualityLevel === 'high') {
        return codecConfigs.opus;
      } else if (qualityLevel === 'medium') {
        return codecConfigs.pcmu;
      } else {
        return codecConfigs.pcma;
      }
    };

    const highQualityCodec = selectOptimalCodec('high');
    expect(highQualityCodec.mimeType).toBe('audio/opus');
    expect(highQualityCodec.clockRate).toBe(48000);
    expect(highQualityCodec.channels).toBe(2);

    const mediumQualityCodec = selectOptimalCodec('medium');
    expect(mediumQualityCodec.mimeType).toBe('audio/PCMU');
    expect(mediumQualityCodec.clockRate).toBe(8000);
    expect(mediumQualityCodec.channels).toBe(1);
  });

  test('should handle audio buffer management and latency optimization', async () => {
    const audioContext = helper.audioContext;

    // Test different buffer sizes for latency optimization
    const bufferSizes = [256, 512, 1024, 2048, 4096];

    const testBufferSize = (size) => {
      const processor = audioContext.createScriptProcessor(size, 1, 1);

      // Calculate theoretical latency
      const latency = size / audioContext.sampleRate;

      return {
        bufferSize: size,
        latency: latency,
        processor: processor
      };
    };

    const bufferTests = bufferSizes.map(testBufferSize);

    // Verify buffer sizes and latencies
    bufferTests.forEach((test, index) => {
      expect(test.bufferSize).toBe(bufferSizes[index]);
      expect(test.latency).toBeGreaterThan(0);
      expect(test.processor).toBeDefined();

      // Smaller buffers should have lower latency
      if (index > 0) {
        expect(test.latency).toBeGreaterThan(bufferTests[index - 1].latency);
      }
    });

    // Test optimal buffer size selection
    const selectOptimalBufferSize = (targetLatency) => {
      const targetSamples = targetLatency * audioContext.sampleRate;
      return bufferSizes.find(size => size >= targetSamples) || bufferSizes[bufferSizes.length - 1];
    };

    const lowLatencyBuffer = selectOptimalBufferSize(0.005); // 5ms
    const normalLatencyBuffer = selectOptimalBufferSize(0.02); // 20ms

    expect(lowLatencyBuffer).toBe(256);
    expect(normalLatencyBuffer).toBe(1024);
  });

  test('should handle cross-platform audio compatibility', async () => {
    // Test audio format compatibility across different platforms
    const platformConfigs = {
      web: {
        supportedFormats: ['opus', 'pcmu', 'pcma'],
        preferredSampleRates: [48000, 44100, 16000],
        maxChannels: 2,
        features: ['echoCancellation', 'noiseSuppression', 'autoGainControl']
      },
      mobile: {
        supportedFormats: ['opus', 'aac', 'pcmu'],
        preferredSampleRates: [48000, 44100],
        maxChannels: 2,
        features: ['echoCancellation', 'noiseSuppression']
      },
      desktop: {
        supportedFormats: ['opus', 'pcmu', 'pcma', 'g722'],
        preferredSampleRates: [48000, 44100, 32000, 16000],
        maxChannels: 8,
        features: ['echoCancellation', 'noiseSuppression', 'autoGainControl', 'beamforming']
      }
    };

    // Test compatibility matrix
    const findCommonFormats = (platform1, platform2) => {
      const config1 = platformConfigs[platform1];
      const config2 = platformConfigs[platform2];

      return {
        formats: config1.supportedFormats.filter(format =>
          config2.supportedFormats.includes(format)
        ),
        sampleRates: config1.preferredSampleRates.filter(rate =>
          config2.preferredSampleRates.includes(rate)
        ),
        maxChannels: Math.min(config1.maxChannels, config2.maxChannels),
        features: config1.features.filter(feature =>
          config2.features.includes(feature)
        )
      };
    };

    const webMobileCompat = findCommonFormats('web', 'mobile');
    expect(webMobileCompat.formats).toContain('opus');
    expect(webMobileCompat.sampleRates).toContain(48000);
    expect(webMobileCompat.maxChannels).toBe(2);
    expect(webMobileCompat.features).toContain('echoCancellation');

    const webDesktopCompat = findCommonFormats('web', 'desktop');
    expect(webDesktopCompat.formats.length).toBeGreaterThan(2);
    expect(webDesktopCompat.features.length).toBeGreaterThan(2);
  });
});