const { ipcRenderer } = require('electron');
const EventEmitter = require('events');

class AudioService extends EventEmitter {
  constructor() {
    super();
    this.isInitialized = false;
    this.isCapturing = false;
    this.audioContext = null;
    this.analyser = null;
    this.audioLevelInterval = null;
    this.devices = {
      inputs: [],
      outputs: [],
      virtuals: [],
    };

    // Set up IPC event listeners
    this.setupListeners();
  }

  /**
   * Set up IPC event listeners
   */
  setupListeners() {
    // Handle audio data from main process
    ipcRenderer.on('audio:data', (event, data) => {
      this.emit('audioData', data);
    });

    // Handle device updates
    ipcRenderer.on('audio:devicesUpdated', (event, devices) => {
      this.devices = {
        inputs: devices.inputs || [],
        outputs: devices.outputs || [],
        virtuals: devices.virtuals || [],
      };
      this.emit('devicesUpdated', this.devices);
    });

    // Handle audio level updates
    ipcRenderer.on('audio:levels', (event, levels) => {
      this.emit('levels', levels);
    });

    // NEW: Handle audio errors from main process and re-emit
    ipcRenderer.on('audio:error', (event, error) => {
      this.emit('error', error);
    });
  }

  /**
   * Initialize the audio service
   */
  async initialize() {
    if (this.isInitialized) {
      return { success: true };
    }

    try {
      // Initialize Web Audio API
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: 16000, // Match the sample rate we're using for capture
      });

      // Create an analyser node for visualization
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;

      // Start monitoring audio levels
      this.startLevelMonitoring();

      // Initialize in main process
      await ipcRenderer.invoke('audio:initialize');

      // Refresh device list
      await this.refreshDevices();

      this.isInitialized = true;
      return { success: true };
    } catch (error) {
      console.error('Error initializing audio service:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Start monitoring audio levels
   */
  startLevelMonitoring() {
    // Clear any existing interval
    if (this.audioLevelInterval) {
      clearInterval(this.audioLevelInterval);
    }

    // Get audio levels at regular intervals
    this.audioLevelInterval = setInterval(async () => {
      try {
        const levels = await this.getAudioLevels();
        this.emit('levels', levels);
      } catch (error) {
        console.error('Error getting audio levels:', error);
      }
    }, 100); // Update 10 times per second
  }

  /**
   * Get audio levels
   */
  async getAudioLevels() {
    try {
      if (!this.isInitialized) {
        return { input: 0, output: 0 };
      }

      // Get audio levels from the main process
      const levels = await ipcRenderer.invoke('audio:getLevels');

      // If we have an analyser node, get the current level
      if (this.analyser) {
        const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
        this.analyser.getByteFrequencyData(dataArray);

        // Calculate average level
        const sum = dataArray.reduce((a, b) => a + b, 0);
        const avg = sum / dataArray.length;

        // Normalize to 0-1 range
        levels.input = Math.min(1, avg / 255);
      }

      return levels;
    } catch (error) {
      console.error('Error getting audio levels:', error);
      return { input: 0, output: 0 };
    }
  }

  /**
   * Refresh the list of available audio devices
   */
  async getDevices() {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      const devices = await ipcRenderer.invoke('audio:getDevices');
      this.devices = {
        inputs: devices.inputs || [],
        outputs: devices.outputs || [],
        virtuals: devices.virtuals || [],
      };

      return this.devices;
    } catch (error) {
      console.error('Error getting devices:', error);
      throw error;
    }
  }

  async refreshDevices() {
    try {
      const devices = await this.getDevices();
      this.emit('devicesUpdated', devices);
      return { success: true, devices };
    } catch (error) {
      console.error('Error refreshing devices:', error);
      return {
        success: false,
        error: error.message,
        devices: this.devices,
      };
    }
  }

  /**
   * Start capturing audio from the specified device
   * @param {string} deviceId - The ID of the device to capture from
   */
  async startCapture(deviceId, options = {}) {
    if (this.isCapturing) {
      console.warn('Audio capture already in progress');
      return { success: false, error: 'Audio capture already in progress' };
    }

    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      const result = await ipcRenderer.invoke('audio:startCapture', {
        deviceId,
        sampleRate: options.sampleRate || 16000,
        channels: options.channels || 1,
        bitDepth: options.bitDepth || 16,
      });

      if (result && result.success) {
        this.isCapturing = true;
        this.emit('captureStarted');
      }

      return result;
    } catch (error) {
      console.error('Error starting capture:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Stop capturing audio
   */
  async stopCapture() {
    if (!this.isCapturing) {
      return { success: true };
    }

    try {
      const result = await ipcRenderer.invoke('audio:stopCapture');

      if (result && result.success) {
        this.isCapturing = false;
        this.emit('captureStopped');
      }

      return result;
    } catch (error) {
      console.error('Error stopping capture:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Route audio to the specified output device
   * @param {string} deviceId - The ID of the output device
   * @param {ArrayBuffer} audioData - The audio data to route
   */
  async routeAudio(deviceId, audioData) {
    try {
      return await ipcRenderer.invoke('audio:routeAudio', {
        deviceId,
        audioData: ArrayBuffer.isView(audioData) ? audioData.buffer : audioData,
      });
    } catch (error) {
      console.error('Error routing audio:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Clean up resources
   */
  async cleanup() {
    try {
      // Stop any active capture
      if (this.isCapturing) {
        await this.stopCapture();
      }

      // Clear the level monitoring interval
      if (this.audioLevelInterval) {
        clearInterval(this.audioLevelInterval);
        this.audioLevelInterval = null;
      }

      // Close the audio context if it exists
      if (this.audioContext && this.audioContext.state !== 'closed') {
        await this.audioContext.close();
        this.audioContext = null;
      }

      // Clean up IPC handlers
      ipcRenderer.removeAllListeners('audio:data');
      ipcRenderer.removeAllListeners('audio:devicesUpdated');
      ipcRenderer.removeAllListeners('audio:levels');

      // Clean up in main process
      await ipcRenderer.invoke('audio:cleanup');

      this.isInitialized = false;
      console.log('Audio service cleaned up');
      return { success: true };
    } catch (error) {
      console.error('Error during audio service cleanup:', error);
    }
  }
}

const audioService = new AudioService();
module.exports = audioService;
