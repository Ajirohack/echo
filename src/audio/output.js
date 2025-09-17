const { EventEmitter } = require('events');
const { spawn } = require('child_process');
const { exec } = require('child_process');
const { promisify } = require('util');
const os = require('os');
const path = require('path');
const fs = require('fs');
const execAsync = promisify(exec);

class AudioOutput extends EventEmitter {
  constructor() {
    super();
    this.platform = os.platform();
    this.outputProcess = null;
    this.isPlaying = false;
    this.volume = 100;
    this.sampleRate = 16000;
    this.channels = 1;
    this.bitDepth = 16;
  }

  /**
   * Play audio data
   * @param {Buffer} audioData - Raw audio data to play
   * @param {Object} [options] - Playback options
   * @param {string} [options.deviceId] - Output device ID
   * @param {number} [options.volume] - Volume level (0-100)
   * @returns {Promise<void>}
   */
  async play(audioData, options = {}) {
    if (!audioData || !Buffer.isBuffer(audioData) || audioData.length === 0) {
      throw new Error('Invalid audio data');
    }

    await this.stop();

    const { deviceId, volume = this.volume } = options;
    this.volume = Math.max(0, Math.min(100, volume));
    this.isPlaying = true;

    return new Promise((resolve, reject) => {
      try {
        const args = [
          '-f',
          's16le',
          '-ar',
          this.sampleRate,
          '-ac',
          this.channels,
          '-i',
          'pipe:0',
          '-f',
          this.getOutputFormat(),
        ];

        // Add volume adjustment if needed
        if (this.volume !== 100) {
          const volumeFactor = (this.volume / 100).toFixed(2);
          args.push('-filter:a', `volume=${volumeFactor}`);
        }

        // Add device selection if specified
        if (deviceId) {
          if (this.platform === 'win32') {
            args.push('-f', 'dshow', '-audio_device_output', deviceId);
          } else if (this.platform === 'darwin') {
            args.push('-audio_device_index', deviceId);
          } else if (this.platform === 'linux') {
            args.push('-f', 'pulse', '-device', deviceId);
          }
        } else if (this.platform === 'win32') {
          // On Windows, we need to specify an output format
          args.push('NUL');
        } else {
          // On other platforms, use the default audio output
          args.push('-autoexit', '-nodisp');
        }

        this.outputProcess = spawn('ffplay', args, { stdio: ['pipe', 'ignore', 'inherit'] });

        this.outputProcess.on('error', (error) => {
          this.emit('error', new Error(`Audio playback error: ${error.message}`));
          this.isPlaying = false;
          reject(error);
        });

        this.outputProcess.on('close', (code) => {
          this.isPlaying = false;
          if (code !== 0) {
            const error = new Error(`Audio playback process exited with code ${code}`);
            this.emit('error', error);
            reject(error);
          } else {
            this.emit('end');
            resolve();
          }
        });

        // Write audio data to the process
        this.outputProcess.stdin.write(audioData);
        this.outputProcess.stdin.end();
      } catch (error) {
        this.isPlaying = false;
        this.emit('error', new Error(`Failed to start audio playback: ${error.message}`));
        reject(error);
      }
    });
  }

  /**
   * Route audio to a virtual device
   * @param {Buffer} audioData - Audio data to route
   * @param {Object} [options] - Routing options
   * @param {string} [options.deviceId] - Target device ID
   * @param {number} [options.volume] - Volume level (0-100)
   * @returns {Promise<void>}
   */
  async routeToVirtual(audioData, options = {}) {
    const { deviceId, volume = this.volume } = options;

    // If no device ID is provided, use the default virtual device for the platform
    const targetDevice = deviceId || this.getDefaultVirtualDevice();

    try {
      await this.play(audioData, { deviceId: targetDevice, volume });
      this.emit('routed', { device: targetDevice });
    } catch (error) {
      this.emit('error', new Error(`Failed to route audio: ${error.message}`));
      throw error;
    }
  }

  /**
   * Get the default virtual device for the current platform
   * @returns {string}
   */
  getDefaultVirtualDevice() {
    switch (this.platform) {
      case 'win32':
        return 'CABLE Input (VB-Audio Virtual Cable)';
      case 'darwin':
        return 'BlackHole 2ch';
      case 'linux':
        return 'VirtualSink';
      default:
        return 'default';
    }
  }

  /**
   * Get the appropriate output format for the current platform
   * @returns {string}
   */
  getOutputFormat() {
    switch (this.platform) {
      case 'win32':
        return 'dshow';
      case 'darwin':
        return 'avfoundation';
      case 'linux':
        return 'pulse';
      default:
        return 'wav';
    }
  }

  /**
   * Stop audio playback
   * @returns {Promise<void>}
   */
  async stop() {
    if (this.outputProcess) {
      return new Promise((resolve) => {
        this.outputProcess.once('exit', () => {
          this.outputProcess = null;
          this.isPlaying = false;
          resolve();
        });

        // Try to gracefully terminate first
        this.outputProcess.kill('SIGTERM');

        // Force kill if it doesn't exit quickly
        setTimeout(() => {
          if (this.outputProcess) {
            this.outputProcess.kill('SIGKILL');
          }
        }, 1000);
      });
    }
    return Promise.resolve();
  }

  /**
   * Set the volume level
   * @param {number} volume - Volume level (0-100)
   */
  setVolume(volume) {
    this.volume = Math.max(0, Math.min(100, volume));

    // If we're currently playing, update the volume
    if (this.isPlaying && this.outputProcess && this.platform === 'win32') {
      // On Windows, we can use nircmd to adjust the volume
      try {
        exec(`nircmd setsysvolume ${Math.round((this.volume / 100) * 65535)}`);
      } catch (error) {
        this.emit('error', new Error(`Failed to set volume: ${error.message}`));
      }
    }

    this.emit('volumeChanged', this.volume);
  }

  /**
   * Get the current volume level
   * @returns {number} Current volume (0-100)
   */
  getVolume() {
    return this.volume;
  }

  /**
   * Check if audio is currently playing
   * @returns {boolean}
   */
  isAudioPlaying() {
    return this.isPlaying;
  }

  /**
   * Clean up resources
   */
  async destroy() {
    await this.stop();
    this.removeAllListeners();
  }
}

module.exports = AudioOutput;
