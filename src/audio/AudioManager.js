const { app, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger');
const Store = require('electron-store');
const EventEmitter = require('events');

// Platform-specific imports
let audioDevices;
try {
  audioDevices = require('audio-devices');
} catch (error) {
  logger.warn('audio-devices module not available, using fallback');
}

class AudioManager extends EventEmitter {
  constructor() {
    super();
    this.store = new Store();
    this.inputDevices = [];
    this.outputDevices = [];
    this.virtualDevices = [];
    this.audioContext = null;
    this.inputStream = null;
    this.outputStream = null;
    this.isCapturing = false;
    this.audioProcessor = null;
    this.sampleRate = 16000; // Standard for speech recognition
    this.channels = 1; // Mono audio
    this.bitDepth = 16; // 16-bit audio
    this.initialized = false;
    this.translationPipeline = null;
    this.vadEnabled = true;
    this.isSpeechDetected = false;
    this.audioBuffer = [];
    this.bufferSize = 4096;

    // Initialize audio context and devices
    this.initialize();
  }

  /**
   * Initialize the audio manager
   */
  async initialize() {
    try {
      // Initialize audio context
      this.initializeAudioContext();

      // Load saved audio devices
      await this.loadAudioDevices();

      // Refresh device list
      await this.refreshAudioDevices();

      this.initialized = true;
      logger.info('AudioManager initialized');
    } catch (error) {
      logger.error('Error initializing AudioManager:', error);
      throw error;
    }
  }

  /**
   * Initialize the Web Audio API context
   */
  initializeAudioContext() {
    try {
      // We can't use Web Audio API in the main process
      // This should only be called in the renderer process
      if (typeof window === 'undefined') {
        logger.info('Skipping audio context initialization in main process');
        return;
      }

      const audioContext = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: this.sampleRate,
      });
      this.audioContext = audioContext;
      logger.info('Audio context initialized');
    } catch (error) {
      logger.error('Failed to initialize audio context:', error);
      this.showError(
        'Audio Initialization Error',
        'Failed to initialize audio system. Please check your audio devices and try again.'
      );
    }
  }

  /**
   * Load saved audio devices from store
   */
  async loadAudioDevices() {
    try {
      this.inputDevices = this.store.get('audio.inputDevices', []);
      this.outputDevices = this.store.get('audio.outputDevices', []);
      this.virtualDevices = this.store.get('audio.virtualDevices', []);

      logger.info(
        `Loaded ${this.inputDevices.length} input devices, ${this.outputDevices.length} output devices, ${this.virtualDevices.length} virtual devices`
      );

      // If no devices in store, refresh the list
      if (this.inputDevices.length === 0 || this.outputDevices.length === 0) {
        await this.refreshAudioDevices();
      }
    } catch (error) {
      logger.error('Error loading audio devices:', error);
      throw error;
    }
  }

  /**
   * Refresh the list of available audio devices
   */
  async refreshAudioDevices() {
    try {
      if (audioDevices) {
        // Use audio-devices module if available
        const devices = audioDevices.getDevices();
        this.inputDevices = devices.input || [];
        this.outputDevices = devices.output || [];

        // Try to detect virtual audio devices
        this.detectVirtualDevices();

        // Save to store
        this.store.set('audio.inputDevices', this.inputDevices);
        this.store.set('audio.outputDevices', this.outputDevices);
        this.store.set('audio.virtualDevices', this.virtualDevices);

        logger.info('Audio devices refreshed');
        return {
          inputDevices: this.inputDevices,
          outputDevices: this.outputDevices,
          virtualDevices: this.virtualDevices,
        };
      } else {
        // Fallback to system commands
        return await this.detectDevicesFallback();
      }
    } catch (error) {
      logger.error('Error refreshing audio devices:', error);
      return await this.detectDevicesFallback();
    }
  }

  /**
   * Refresh the list of available audio devices
   * @returns {Promise<Object>} A promise that resolves to the refreshed device lists
   */
  async refreshDevices() {
    try {
      logger.info('Refreshing audio devices');

      // In a full implementation, this would use the appropriate APIs
      // to get the latest list of audio devices
      this.inputDevices = await this.getAudioDevices('input');
      this.outputDevices = await this.getAudioDevices('output');
      this.detectVirtualDevices();

      logger.info(
        `Refreshed devices: ${this.inputDevices.length} inputs, ${this.outputDevices.length} outputs, ${this.virtualDevices.length} virtual`
      );

      return {
        inputDevices: this.inputDevices,
        outputDevices: this.outputDevices,
        virtualDevices: this.virtualDevices,
      };
    } catch (error) {
      logger.error('Error refreshing audio devices:', error);
      return {
        inputDevices: this.inputDevices || [],
        outputDevices: this.outputDevices || [],
        virtualDevices: this.virtualDevices || [],
      };
    }
  }

  /**
   * Fallback method to detect audio devices
   */
  async detectDevicesFallback() {
    logger.info('Using fallback method to detect audio devices');

    // This is a basic fallback - in a real app, you'd want to implement
    // platform-specific detection using node-mac, node-windows, or node-linux

    // For now, just return the devices we already have
    return {
      inputDevices: this.inputDevices,
      outputDevices: this.outputDevices,
      virtualDevices: this.virtualDevices,
    };
  }

  /**
   * Detect virtual audio devices
   */
  detectVirtualDevices() {
    // This would be platform-specific
    const platform = process.platform;

    // Common virtual audio device names
    const virtualDevicePatterns = [
      /vb-audio/i,
      /virtual audio/i,
      /blackhole/i,
      /soundflower/i,
      /loopback/i,
      /virtual cable/i,
    ];

    // Check both input and output devices for virtual devices
    const allDevices = [...(this.inputDevices || []), ...(this.outputDevices || [])];
    const virtualDevices = [];

    allDevices.forEach((device) => {
      if (virtualDevicePatterns.some((pattern) => pattern.test(device.name))) {
        if (!virtualDevices.some((vd) => vd.id === device.id)) {
          virtualDevices.push({
            ...device,
            isVirtual: true,
          });
        }
      }
    });

    this.virtualDevices = virtualDevices;
    return virtualDevices;
  }

  /**
   * Start capturing audio from the selected input device
   * @param {string} deviceId - The ID of the input device to use
   * @param {Function} onAudioData - Callback when audio data is available
   * @param {Object} options - Additional capture options
   */
  async startCapture(deviceId, onAudioData, options = {}) {
    if (this.isCapturing) {
      logger.warn('Audio capture already in progress');
      return { success: false, error: 'Audio capture already in progress' };
    }

    try {
      // Set options
      if (options.bufferSize) this.bufferSize = options.bufferSize;
      if (options.sampleRate) this.sampleRate = options.sampleRate;
      if (options.channels) this.channels = options.channels;
      if (options.vadEnabled !== undefined) this.vadEnabled = options.vadEnabled;

      logger.info(`Starting audio capture from device: ${deviceId || 'default'} with options:`, {
        bufferSize: this.bufferSize,
        sampleRate: this.sampleRate,
        channels: this.channels,
        vadEnabled: this.vadEnabled,
      });

      // In a real implementation, we would:
      // 1. Get the audio stream from the selected device
      // 2. Set up audio processing nodes
      // 3. Start processing audio data

      this.isCapturing = true;
      this.audioBuffer = [];

      // Emit capture started event
      this.emit('captureStarted', {
        deviceId: deviceId || 'default',
        timestamp: Date.now(),
        options,
      });

      // Simulate audio capture for demo purposes
      this.simulateAudioCapture(onAudioData);

      return { success: true };
    } catch (error) {
      logger.error('Error starting audio capture:', error);
      this.isCapturing = false;
      this.showError(
        'Audio Capture Error',
        'Failed to start audio capture. Please check your audio settings.'
      );
      return { success: false, error: error.message };
    }
  }

  /**
   * Stop capturing audio
   */
  stopCapture() {
    if (!this.isCapturing) {
      return { success: true };
    }

    try {
      logger.info('Stopping audio capture');

      // In a real implementation, we would:
      // 1. Stop the audio stream
      // 2. Clean up audio nodes
      // 3. Close the audio context if no longer needed

      this.isCapturing = false;

      // Clear any simulation intervals
      if (this.simulationInterval) {
        clearInterval(this.simulationInterval);
        this.simulationInterval = null;
      }

      return { success: true };
    } catch (error) {
      logger.error('Error stopping audio capture:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Simulate audio capture for demo purposes
   * In a real app, this would be replaced with actual audio capture
   * @param {Function} onAudioData - Callback when audio data is available
   */
  simulateAudioCapture(onAudioData) {
    // Generate some dummy audio data
    const generateDummyAudio = () => {
      const samples = this.bufferSize / 2; // Number of samples per chunk (16-bit = 2 bytes per sample)
      const buffer = Buffer.alloc(samples * 2); // 16-bit audio = 2 bytes per sample

      // Generate a simple sine wave
      for (let i = 0; i < samples; i++) {
        const value = Math.sin(i * 0.01) * 0x7fff; // Generate a sine wave scaled to 16-bit range
        buffer.writeInt16LE(Math.floor(value), i * 2);
      }

      // Simulate voice activity detection
      if (this.vadEnabled) {
        const isSpeaking = Math.random() > 0.7; // 30% chance of "speech detected"

        if (isSpeaking && !this.isSpeechDetected) {
          this.isSpeechDetected = true;
          this.emit('voiceActivityStart', { timestamp: Date.now() });
        } else if (!isSpeaking && this.isSpeechDetected) {
          this.isSpeechDetected = false;
          this.emit('voiceActivityEnd', {
            timestamp: Date.now(),
            duration: Math.floor(Math.random() * 3000) + 1000, // Random duration between 1-4s
          });
        }
      }

      // Add to buffer
      this.audioBuffer.push(buffer);

      // Process if buffer reaches threshold or VAD ended speech
      if (this.audioBuffer.length >= 5 || (!this.isSpeechDetected && this.audioBuffer.length > 0)) {
        this.processAudioBuffer();
      }

      // Call the callback if provided
      if (typeof onAudioData === 'function') {
        onAudioData({
          buffer,
          format: {
            sampleRate: this.sampleRate,
            channels: this.channels,
            bitDepth: 16,
          },
          isSpeech: this.isSpeechDetected,
        });
      }

      // Emit the audio data event
      this.emit('audioData', {
        buffer,
        format: {
          sampleRate: this.sampleRate,
          channels: this.channels,
          bitDepth: 16,
        },
        isSpeech: this.isSpeechDetected,
        timestamp: Date.now(),
      });
    };

    // Simulate audio capture at regular intervals (roughly 50ms for real-time feel)
    this.simulationInterval = setInterval(generateDummyAudio, 50);
  }

  /**
   * Process accumulated audio buffer
   * @private
   */
  async processAudioBuffer() {
    if (this.audioBuffer.length === 0) return;

    // Combine all buffers
    const combinedBuffer = Buffer.concat(this.audioBuffer);

    // Clear the buffer
    this.audioBuffer = [];

    // Send to translation pipeline if connected
    if (this.translationPipeline) {
      await this.sendAudioToPipeline(combinedBuffer, {
        isSpeech: this.isSpeechDetected,
        format: {
          sampleRate: this.sampleRate,
          channels: this.channels,
          bitDepth: 16,
        },
      });
    }

    // Emit processed buffer event
    this.emit('audioProcessed', {
      buffer: combinedBuffer,
      duration: (combinedBuffer.length / 2 / this.sampleRate) * 1000, // Duration in ms
      timestamp: Date.now(),
    });
  }
  // Generate some dummy audio data
  generateDummyAudio(samples) {
    const audioBuffer = new Float32Array(samples);

    // Generate some noise
    for (let i = 0; i < samples; i++) {
      audioBuffer[i] = Math.random() * 2 - 1; // Random values between -1 and 1
    }

    return audioBuffer;
  }

  // Simulate audio capture for demo purposes
  // In a real app, this would be replaced with actual audio capture
  // @param {Function} onAudioData - Callback when audio data is available
  simulateAudioCapture(onAudioData) {
    // Send audio data at regular intervals
    this.simulationInterval = setInterval(() => {
      if (this.isCapturing) {
        const audioData = this.generateDummyAudio(4096);
        onAudioData(audioData);
      }
    }, 100); // 10 updates per second for demo
  }

  /**
   * Route audio to the specified output device
   * @param {string} deviceId - The ID of the output device to use
   * @param {Buffer|Float32Array} audioData - The audio data to play
   */
  async routeAudio(deviceId, audioData) {
    try {
      logger.debug(`Routing audio to device: ${deviceId}`);

      // In a real implementation, we would:
      // 1. Convert the audio data to the correct format
      // 2. Send it to the specified output device
      // 3. Handle any necessary audio processing

      return { success: true };
    } catch (error) {
      logger.error('Error routing audio:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Show an error dialog to the user
   */
  showError(title, message) {
    dialog.showErrorBox(title, message);
  }

  /**
   * Clean up resources
   */
  cleanup() {
    this.stopCapture();

    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
    }

    // Disconnect from translation pipeline if connected
    if (this.translationPipeline) {
      this.disconnectFromTranslationPipeline();
    }

    // Remove all event listeners
    this.removeAllListeners();

    logger.info('Audio manager cleaned up');
  }

  /**
   * Connect to the translation pipeline
   * @param {Object} pipeline - Translation pipeline instance
   * @returns {Promise<boolean>} - Success status
   */
  async connectToTranslationPipeline(pipeline) {
    try {
      if (!pipeline) {
        throw new Error('Invalid translation pipeline provided');
      }

      this.translationPipeline = pipeline;

      // Set up audio processing callback
      this.translationPipeline.on('pipelineActivated', this.handlePipelineActivated.bind(this));
      this.translationPipeline.on('pipelineDeactivated', this.handlePipelineDeactivated.bind(this));

      logger.info('Connected to translation pipeline');
      this.emit('translationPipelineConnected', { timestamp: Date.now() });

      return true;
    } catch (error) {
      logger.error('Failed to connect to translation pipeline:', error);
      this.emit('error', {
        type: 'pipelineConnection',
        message: error.message,
        error,
      });

      return false;
    }
  }

  /**
   * Disconnect from the translation pipeline
   * @returns {Promise<boolean>} - Success status
   */
  async disconnectFromTranslationPipeline() {
    try {
      if (!this.translationPipeline) {
        return true; // Already disconnected
      }

      // Remove event listeners
      this.translationPipeline.removeListener(
        'pipelineActivated',
        this.handlePipelineActivated.bind(this)
      );
      this.translationPipeline.removeListener(
        'pipelineDeactivated',
        this.handlePipelineDeactivated.bind(this)
      );

      this.translationPipeline = null;

      logger.info('Disconnected from translation pipeline');
      this.emit('translationPipelineDisconnected', { timestamp: Date.now() });

      return true;
    } catch (error) {
      logger.error('Failed to disconnect from translation pipeline:', error);
      this.emit('error', {
        type: 'pipelineDisconnection',
        message: error.message,
        error,
      });

      return false;
    }
  }

  /**
   * Send audio data to translation pipeline
   * @param {Buffer} audioData - Audio buffer
   * @param {Object} options - Additional options
   * @returns {Promise<Boolean>} Success status
   */
  async sendAudioToPipeline(audioData, options = {}) {
    if (!this.translationPipeline) {
      logger.error('Cannot send audio: Not connected to translation pipeline');
      return false;
    }

    try {
      const result = await this.translationPipeline.startPipeline(audioData, {
        source: 'audio-manager',
        format: {
          sampleRate: this.sampleRate,
          channels: this.channels,
          bitDepth: this.bitDepth,
        },
        ...options,
      });

      logger.debug('Audio sent to translation pipeline', { success: !!result });
      return !!result;
    } catch (error) {
      logger.error('Error sending audio to translation pipeline', error);
      this.emit('error', {
        type: 'translation-pipeline',
        message: error.message,
        error,
      });
      return false;
    }
  }

  /**
   * Handle pipeline activation event
   * @param {Object} data - Activation event data
   */
  handlePipelineActivated(data) {
    logger.info('Translation pipeline activated');

    // Start audio capture if not already capturing
    if (!this.isCapturing) {
      this.startCapture().catch((error) => {
        logger.error('Failed to start capture after pipeline activation:', error);
      });
    }
  }

  /**
   * Handle pipeline deactivation event
   * @param {Object} data - Deactivation event data
   */
  handlePipelineDeactivated(data) {
    logger.info('Translation pipeline deactivated');

    // Stop audio capture if it was started by the pipeline
    if (this.isCapturing) {
      this.stopCapture().catch((error) => {
        logger.error('Failed to stop capture after pipeline deactivation:', error);
      });
    }
  }

  /**
   * Process audio data for translation
   * @param {ArrayBuffer} audioData - Raw audio data
   */
  processAudioForTranslation(audioData) {
    if (!this.translationPipeline) return;

    try {
      // Emit the audio data event for anyone listening
      this.emit('audioData', {
        buffer: audioData,
        sampleRate: this.sampleRate,
        channels: this.channels,
        bitDepth: this.bitDepth,
        timestamp: Date.now(),
      });

      // If VAD is enabled, check for speech
      if (this.vadEnabled) {
        const hasSpeech = this.detectSpeech(audioData);

        if (hasSpeech && !this.isSpeechDetected) {
          // Speech just started
          this.isSpeechDetected = true;
          this.speechStartTime = Date.now();
          this.audioBuffer = [audioData];

          this.emit('voiceActivityStart', {
            timestamp: this.speechStartTime,
          });
        } else if (hasSpeech && this.isSpeechDetected) {
          // Ongoing speech, add to buffer
          this.audioBuffer.push(audioData);
        } else if (!hasSpeech && this.isSpeechDetected) {
          // Speech just ended
          const speechEndTime = Date.now();
          const speechDuration = speechEndTime - this.speechStartTime;

          // Only process if we have enough audio data (avoid processing very short noises)
          if (speechDuration > 300 && this.audioBuffer.length > 0) {
            // Combine all buffers
            const combinedBuffer = Buffer.concat(this.audioBuffer);

            // Send to translation pipeline
            if (this.translationPipeline && this.translationPipeline.processAudio) {
              this.translationPipeline.processAudio(combinedBuffer, {
                sampleRate: this.sampleRate,
                channels: this.channels,
                bitDepth: this.bitDepth,
              });
            }

            this.emit('voiceActivityEnd', {
              duration: speechDuration,
              timestamp: speechEndTime,
            });
          }

          // Reset speech detection
          this.isSpeechDetected = false;
          this.audioBuffer = [];
        }
      } else {
        // No VAD, send audio directly to pipeline
        // Add to buffer and process when buffer is full
        this.audioBuffer.push(audioData);

        if (this.audioBuffer.length >= 5) {
          // Process every ~1 second (5 chunks of ~200ms)
          const combinedBuffer = Buffer.concat(this.audioBuffer);
          this.audioBuffer = [];

          if (this.translationPipeline && this.translationPipeline.processAudio) {
            this.translationPipeline.processAudio(combinedBuffer, {
              sampleRate: this.sampleRate,
              channels: this.channels,
              bitDepth: this.bitDepth,
            });
          }
        }
      }
    } catch (error) {
      logger.error('Error processing audio for translation:', error);
      this.emit('error', {
        type: 'audioProcessing',
        message: error.message,
        error,
      });
    }
  }

  /**
   * Simple voice activity detection (VAD) implementation
   * @param {ArrayBuffer} audioData - Raw audio data
   * @returns {boolean} - Whether speech was detected
   */
  detectSpeech(audioData) {
    try {
      // Convert buffer to int16 samples
      const samples = new Int16Array(audioData.buffer);

      // Calculate energy (sum of squared samples)
      let energy = 0;
      for (let i = 0; i < samples.length; i++) {
        energy += samples[i] * samples[i];
      }

      // Normalize by buffer length
      energy /= samples.length;

      // Apply threshold (this is a simplistic approach; real VAD is more complex)
      const threshold = 1000; // Adjust based on testing
      return energy > threshold;
    } catch (error) {
      logger.error('Error in speech detection:', error);
      return false;
    }
  }

  /**
   * Set Voice Activity Detection (VAD) enabled state
   * @param {boolean} enabled - Whether VAD should be enabled
   */
  setVADEnabled(enabled) {
    this.vadEnabled = enabled;
    logger.info(`VAD ${enabled ? 'enabled' : 'disabled'}`);

    // Reset speech detection state
    this.isSpeechDetected = false;
    this.audioBuffer = [];
  }

  /**
   * Get current audio processing status
   * @returns {Object} - Status information
   */
  getStatus() {
    return {
      initialized: this.initialized,
      isCapturing: this.isCapturing,
      connectedToPipeline: !!this.translationPipeline,
      vadEnabled: this.vadEnabled,
      isSpeechDetected: this.isSpeechDetected,
      sampleRate: this.sampleRate,
      channels: this.channels,
      bitDepth: this.bitDepth,
      inputDevice: this.selectedInputDevice,
      outputDevice: this.selectedOutputDevice,
    };
  }

  /**
   * Get audio devices of a specific type
   * @param {string} type - Device type: 'input' or 'output'
   * @returns {Promise<Array>} List of audio devices
   */
  async getAudioDevices(type = 'input') {
    try {
      const os = require('os');
      const { exec } = require('child_process');
      const platform = os.platform();
      const AudioRecorder = require('node-audiorecorder');

      return new Promise((resolve) => {
        if (platform === 'darwin') {
          // macOS implementation
          exec('system_profiler SPAudioDataType', (error, stdout) => {
            if (error) {
              logger.error('Error detecting macOS audio devices:', error);
              resolve([]);
              return;
            }

            const devices = [];
            const lines = stdout.split('\n');
            let currentDevice = null;
            let isInput = false;
            let isOutput = false;

            for (const line of lines) {
              if (
                line.includes(':') &&
                !line.includes('Audio:') &&
                !line.trim().startsWith('Location:')
              ) {
                if (
                  currentDevice &&
                  ((type === 'input' && isInput) || (type === 'output' && isOutput))
                ) {
                  devices.push(currentDevice);
                }

                currentDevice = {
                  name: line.split(':')[0].trim(),
                  id: line.split(':')[0].trim().toLowerCase().replace(/\s+/g, '-'),
                  isDefault: false,
                };
                isInput = false;
                isOutput = false;
              } else if (
                line.includes('Input Channels:') &&
                parseInt(line.split(':')[1].trim()) > 0
              ) {
                isInput = true;
              } else if (
                line.includes('Output Channels:') &&
                parseInt(line.split(':')[1].trim()) > 0
              ) {
                isOutput = true;
              } else if (line.includes('Default Input:') && line.includes('Yes')) {
                if (currentDevice) currentDevice.isDefault = true;
              } else if (line.includes('Default Output:') && line.includes('Yes')) {
                if (currentDevice) currentDevice.isDefault = true;
              }
            }

            if (
              currentDevice &&
              ((type === 'input' && isInput) || (type === 'output' && isOutput))
            ) {
              devices.push(currentDevice);
            }

            logger.info(`Detected ${devices.length} ${type} audio devices on macOS`);
            resolve(devices);
          });
        } else if (platform === 'win32') {
          // Windows implementation
          const command =
            type === 'input'
              ? 'powershell "Get-WmiObject Win32_SoundDevice | Where-Object { $_.StatusInfo -eq 1 } | Select-Object Name, DeviceID | ConvertTo-Json"'
              : 'powershell "Get-WmiObject Win32_SoundDevice | Where-Object { $_.StatusInfo -eq 1 } | Select-Object Name, DeviceID | ConvertTo-Json"';

          exec(command, (error, stdout) => {
            if (error) {
              logger.error('Error detecting Windows audio devices:', error);
              resolve([]);
              return;
            }

            try {
              let devices = [];
              const parsed = JSON.parse(stdout.trim());
              const deviceList = Array.isArray(parsed) ? parsed : [parsed];

              devices = deviceList.map((device) => ({
                name: device.Name,
                id: device.DeviceID,
                isDefault: false, // Windows doesn't easily expose default device info in this command
              }));

              logger.info(`Detected ${devices.length} ${type} audio devices on Windows`);
              resolve(devices);
            } catch (parseError) {
              logger.error('Error parsing Windows audio devices:', parseError);
              resolve([]);
            }
          });
        } else if (platform === 'linux') {
          // Linux implementation
          const command = 'arecord -l && aplay -l';

          exec(command, (error, stdout) => {
            if (error) {
              logger.error('Error detecting Linux audio devices:', error);
              resolve([]);
              return;
            }

            const devices = [];
            const lines = stdout.split('\n');
            const regex =
              type === 'input' ? /card\s+(\d+).*?\[(.+?)\]/ : /card\s+(\d+).*?\[(.+?)\]/;

            for (const line of lines) {
              const match = line.match(regex);
              if (
                match &&
                ((type === 'input' && line.includes('arecord')) ||
                  (type === 'output' && line.includes('aplay')))
              ) {
                devices.push({
                  name: match[2].trim(),
                  id: `card:${match[1]}`,
                  isDefault: false,
                });
              }
            }

            logger.info(`Detected ${devices.length} ${type} audio devices on Linux`);
            resolve(devices);
          });
        } else {
          // Fallback for unsupported platforms
          logger.warn(`Audio device detection not implemented for ${platform} platform`);
          resolve([]);
        }
      });
    } catch (error) {
      logger.error(`Error getting ${type} audio devices:`, error);
      return [];
    }
  }
}

module.exports = AudioManager;
