/**
 * Audio Manager
 * Handles microphone capture, system audio, and virtual device routing
 */

const { EventEmitter } = require('events');
const VirtualAudioManager = require('./virtual-audio-manager');

class AudioManager extends EventEmitter {
  constructor() {
    super();
    this.virtualAudioManager = new VirtualAudioManager();
    this.inputStream = null;
    this.outputStream = null;
    this.audioContext = null;
    this.isCapturing = false;
    this.audioBuffer = [];
    this.sampleRate = 16000; // Standard for STT
    this.channels = 1; // Mono
    this.bitDepth = 16;
  }

  /**
   * Initialize audio system
   */
  async initialize() {
    try {
      console.log('Initializing audio system...');

      // Check virtual audio device
      const virtualAvailable = await this.virtualAudioManager.isVirtualDeviceAvailable();
      if (!virtualAvailable) {
        console.log('Virtual audio device not found, attempting installation...');
        await this.virtualAudioManager.installVirtualDevice();
      }

      // Configure virtual device
      await this.virtualAudioManager.configureVirtualDevice();

      // Initialize Web Audio API
      await this.initializeWebAudio();

      console.log('Audio system initialized successfully');
      return true;
    } catch (error) {
      console.error('Failed to initialize audio system:', error);
      throw error;
    }
  }

  /**
   * Initialize Web Audio API
   */
  async initializeWebAudio() {
    // Check if running in browser environment
    if (typeof window !== 'undefined' && window.AudioContext) {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: this.sampleRate,
      });
    } else {
      // For Node.js environment, we'll use a different approach
      console.log('Running in Node.js environment, using alternative audio handling');
    }
  }

  /**
   * Get available audio devices
   */
  async getAudioDevices() {
    try {
      const devices = await this.virtualAudioManager.getAudioDevices();

      // Add browser-based devices if available
      if (typeof navigator !== 'undefined' && navigator.mediaDevices) {
        const browserDevices = await navigator.mediaDevices.enumerateDevices();

        browserDevices.forEach((device) => {
          const deviceInfo = {
            id: device.deviceId,
            name: device.label || `${device.kind} ${device.deviceId.slice(0, 8)}`,
            type: device.kind === 'audioinput' ? 'input' : 'output',
          };

          if (device.kind === 'audioinput') {
            devices.input.push(deviceInfo);
          } else if (device.kind === 'audiooutput') {
            devices.output.push(deviceInfo);
          }
        });
      }

      return devices;
    } catch (error) {
      console.error('Error getting audio devices:', error);
      return { input: [], output: [] };
    }
  }

  /**
   * Start microphone capture
   */
  async startMicrophoneCapture(deviceId = null) {
    try {
      if (typeof navigator === 'undefined' || !navigator.mediaDevices) {
        throw new Error('Media devices not available');
      }

      const constraints = {
        audio: {
          deviceId: deviceId ? { exact: deviceId } : undefined,
          sampleRate: this.sampleRate,
          channelCount: this.channels,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      };

      this.inputStream = await navigator.mediaDevices.getUserMedia(constraints);

      // Process audio stream
      await this.processInputStream(this.inputStream);

      this.isCapturing = true;
      this.emit('captureStarted', { type: 'microphone' });

      console.log('Microphone capture started');
      return true;
    } catch (error) {
      console.error('Failed to start microphone capture:', error);
      throw error;
    }
  }

  /**
   * Start system audio capture (requires virtual audio device)
   */
  async startSystemAudioCapture() {
    try {
      const status = this.virtualAudioManager.getStatus();
      if (!status.installed) {
        throw new Error('Virtual audio device not installed');
      }

      // For system audio capture, we need to route system audio through virtual device
      console.log('System audio capture requires manual routing to virtual device');
      console.log('Please set your system audio output to the virtual device:');
      console.log(`- Windows: CABLE Input (VB-Audio Virtual Cable)`);
      console.log(`- macOS: BlackHole 2ch`);
      console.log(`- Linux: virtual_translation_sink`);

      // In a real implementation, this would involve more complex routing
      // For now, we'll emit a setup instruction event
      this.emit('systemAudioSetupRequired', {
        platform: status.platform,
        virtualDevice: status.virtualDeviceId,
      });

      return true;
    } catch (error) {
      console.error('Failed to start system audio capture:', error);
      throw error;
    }
  }

  /**
   * Process input stream
   */
  async processInputStream(stream) {
    if (!this.audioContext) {
      console.warn('Audio context not available, using alternative processing');
      return;
    }

    try {
      const source = this.audioContext.createMediaStreamSource(stream);
      const processor = this.audioContext.createScriptProcessor(4096, this.channels, this.channels);

      processor.onaudioprocess = (event) => {
        const inputBuffer = event.inputBuffer;
        const audioData = inputBuffer.getChannelData(0);

        // Convert to the format needed for STT
        const processedData = this.convertAudioFormat(audioData);

        // Add to buffer
        this.audioBuffer.push(...processedData);

        // Emit audio data for processing
        this.emit('audioData', {
          data: processedData,
          sampleRate: this.sampleRate,
          channels: this.channels,
        });

        // Keep buffer size manageable (max 10 seconds)
        const maxBufferSize = this.sampleRate * 10;
        if (this.audioBuffer.length > maxBufferSize) {
          this.audioBuffer = this.audioBuffer.slice(-maxBufferSize);
        }
      };

      source.connect(processor);
      processor.connect(this.audioContext.destination);
    } catch (error) {
      console.error('Error processing input stream:', error);
    }
  }

  /**
   * Convert audio format for STT processing
   */
  convertAudioFormat(audioData) {
    // Convert Float32Array to 16-bit PCM
    const pcmData = new Int16Array(audioData.length);

    for (let i = 0; i < audioData.length; i++) {
      // Convert from [-1, 1] to [-32768, 32767]
      const sample = Math.max(-1, Math.min(1, audioData[i]));
      pcmData[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
    }

    return pcmData;
  }

  /**
   * Route processed audio to virtual device
   */
  async routeToVirtualDevice(audioData) {
    try {
      const status = this.virtualAudioManager.getStatus();
      if (!status.installed) {
        console.warn('Virtual device not available for routing');
        return false;
      }

      // In a real implementation, this would route audio to the virtual device
      // For now, we'll simulate the routing
      this.emit('audioRouted', {
        virtualDevice: status.virtualDeviceId,
        dataSize: audioData.length,
      });

      return true;
    } catch (error) {
      console.error('Error routing audio to virtual device:', error);
      return false;
    }
  }

  /**
   * Get current audio buffer
   */
  getAudioBuffer(durationMs = 5000) {
    const samplesNeeded = Math.floor((durationMs / 1000) * this.sampleRate);
    const startIndex = Math.max(0, this.audioBuffer.length - samplesNeeded);

    return this.audioBuffer.slice(startIndex);
  }

  /**
   * Stop audio capture
   */
  async stopCapture() {
    try {
      if (this.inputStream) {
        this.inputStream.getTracks().forEach((track) => track.stop());
        this.inputStream = null;
      }

      if (this.outputStream) {
        this.outputStream.getTracks().forEach((track) => track.stop());
        this.outputStream = null;
      }

      this.isCapturing = false;
      this.audioBuffer = [];

      this.emit('captureStopped');
      console.log('Audio capture stopped');

      return true;
    } catch (error) {
      console.error('Error stopping audio capture:', error);
      throw error;
    }
  }

  /**
   * Get audio system status
   */
  getStatus() {
    return {
      initialized: this.audioContext !== null,
      capturing: this.isCapturing,
      bufferSize: this.audioBuffer.length,
      virtualDevice: this.virtualAudioManager.getStatus(),
      sampleRate: this.sampleRate,
      channels: this.channels,
    };
  }

  /**
   * Test audio input
   */
  async testAudioInput(deviceId = null, durationMs = 3000) {
    try {
      console.log(`Testing audio input for ${durationMs}ms...`);

      await this.startMicrophoneCapture(deviceId);

      return new Promise((resolve) => {
        const startTime = Date.now();
        let maxVolume = 0;
        let totalSamples = 0;

        const dataHandler = (event) => {
          const { data } = event;

          // Calculate volume level
          let sum = 0;
          for (let i = 0; i < data.length; i++) {
            sum += Math.abs(data[i]);
          }
          const avgVolume = sum / data.length;
          maxVolume = Math.max(maxVolume, avgVolume);
          totalSamples += data.length;
        };

        this.on('audioData', dataHandler);

        setTimeout(async () => {
          this.off('audioData', dataHandler);
          await this.stopCapture();

          resolve({
            success: true,
            duration: Date.now() - startTime,
            maxVolume,
            totalSamples,
            avgSampleRate: totalSamples / (durationMs / 1000),
          });
        }, durationMs);
      });
    } catch (error) {
      console.error('Audio input test failed:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    try {
      await this.stopCapture();

      if (this.audioContext && this.audioContext.state !== 'closed') {
        await this.audioContext.close();
      }

      this.removeAllListeners();
      console.log('Audio manager cleaned up');
    } catch (error) {
      console.error('Error during audio manager cleanup:', error);
    }
  }
}

module.exports = AudioManager;
