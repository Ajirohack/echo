const { EventEmitter } = require('events');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

class AudioCapture extends EventEmitter {
  constructor() {
    super();
    this.micStream = null;
    this.systemStream = null;
    this.isCapturing = false;
    this.audioChunks = [];
    this.sampleRate = 16000;
    this.channels = 1;
    this.bitDepth = 16;
    this.platform = os.platform();
  }

  /**
   * Start capturing audio from the specified source
   * @param {Object} options - Capture options
   * @param {string} [options.deviceId] - Audio device ID
   * @param {'mic'|'system'|'both'} [options.source='mic'] - Audio source to capture
   * @returns {Promise<void>}
   */
  async startCapture(options = {}) {
    if (this.isCapturing) {
      await this.stopCapture();
    }

    const { deviceId, source = 'mic' } = options;
    this.isCapturing = true;

    try {
      if (source === 'mic' || source === 'both') {
        await this.startMicCapture(deviceId);
      }

      if (source === 'system' || source === 'both') {
        await this.startSystemCapture(deviceId);
      }

      this.emit('start');
    } catch (error) {
      this.emit('error', error);
      this.isCapturing = false;
      throw error;
    }
  }

  /**
   * Start capturing from microphone
   * @private
   */
  async startMicCapture(deviceId) {
    return new Promise((resolve, reject) => {
      try {
        const args = [
          '-f',
          's16le',
          '-ar',
          this.sampleRate,
          '-ac',
          this.channels,
          '-t',
          'wav',
          'pipe:1',
        ];

        if (deviceId) {
          if (this.platform === 'darwin') {
            args.unshift('-i', `:${deviceId}`);
          } else if (this.platform === 'win32') {
            args.unshift('-f', 'dshow', '-i', `audio=${deviceId}`);
          } else if (this.platform === 'linux') {
            args.unshift('-f', 'pulse', '-i', deviceId);
          }
        } else {
          args.unshift('-f', 'avfoundation', '-i', ':0');
        }

        this.micStream = spawn('ffmpeg', args, { stdio: ['ignore', 'pipe', 'inherit'] });

        this.micStream.stdout.on('data', (chunk) => {
          this.audioChunks.push(chunk);
          this.emit('data', { source: 'mic', data: chunk });
        });

        this.micStream.on('error', (error) => {
          this.emit('error', new Error(`Microphone capture error: ${error.message}`));
          reject(error);
        });

        this.micStream.on('close', () => {
          if (this.isCapturing) {
            this.emit('error', new Error('Microphone capture process ended unexpectedly'));
          }
        });

        resolve();
      } catch (error) {
        reject(new Error(`Failed to start microphone capture: ${error.message}`));
      }
    });
  }

  /**
   * Start capturing system audio
   * @private
   */
  async startSystemCapture(deviceId) {
    if (this.platform === 'darwin') {
      return this.startSystemCaptureMac(deviceId);
    } else if (this.platform === 'win32') {
      return this.startSystemCaptureWindows(deviceId);
    } else if (this.platform === 'linux') {
      return this.startSystemCaptureLinux(deviceId);
    }
    throw new Error('System audio capture not supported on this platform');
  }

  async startSystemCaptureMac(deviceId) {
    // On macOS, we can use Soundflower or BlackHole for system audio capture
    // This requires the virtual audio device to be set as the system output
    const virtualDevice = deviceId || 'BlackHole 2ch';

    return new Promise((resolve, reject) => {
      try {
        const args = [
          '-f',
          'avfoundation',
          '-i',
          virtualDevice,
          '-f',
          's16le',
          '-ar',
          this.sampleRate,
          '-ac',
          this.channels,
          'pipe:1',
        ];

        this.systemStream = spawn('ffmpeg', args, { stdio: ['ignore', 'pipe', 'inherit'] });

        this.systemStream.stdout.on('data', (chunk) => {
          this.audioChunks.push(chunk);
          this.emit('data', { source: 'system', data: chunk });
        });

        this.systemStream.on('error', (error) => {
          this.emit('error', new Error(`System audio capture error: ${error.message}`));
          reject(error);
        });

        this.systemStream.on('close', () => {
          if (this.isCapturing) {
            this.emit('error', new Error('System audio capture process ended unexpectedly'));
          }
        });

        resolve();
      } catch (error) {
        reject(new Error(`Failed to start system audio capture: ${error.message}`));
      }
    });
  }

  async startSystemCaptureWindows(deviceId) {
    // On Windows, we can use VB-Cable or similar virtual audio devices
    const virtualDevice = deviceId || 'CABLE Input (VB-Audio Virtual Cable)';

    return new Promise((resolve, reject) => {
      try {
        const args = [
          '-f',
          'dshow',
          '-i',
          `audio=${virtualDevice}`,
          '-f',
          's16le',
          '-ar',
          this.sampleRate,
          '-ac',
          this.channels,
          'pipe:1',
        ];

        this.systemStream = spawn('ffmpeg', args, { stdio: ['ignore', 'pipe', 'inherit'] });

        this.systemStream.stdout.on('data', (chunk) => {
          this.audioChunks.push(chunk);
          this.emit('data', { source: 'system', data: chunk });
        });

        this.systemStream.on('error', (error) => {
          this.emit('error', new Error(`System audio capture error: ${error.message}`));
          reject(error);
        });

        this.systemStream.on('close', () => {
          if (this.isCapturing) {
            this.emit('error', new Error('System audio capture process ended unexpectedly'));
          }
        });

        resolve();
      } catch (error) {
        reject(new Error(`Failed to start system audio capture: ${error.message}`));
      }
    });
  }

  async startSystemCaptureLinux(deviceId) {
    // On Linux, we can use PulseAudio's monitor sources
    const virtualDevice = deviceId || 'alsa_output.pci-0000_00_1f.3.analog-stereo.monitor';

    return new Promise((resolve, reject) => {
      try {
        const args = [
          '-f',
          'pulse',
          '-i',
          virtualDevice,
          '-f',
          's16le',
          '-ar',
          this.sampleRate,
          '-ac',
          this.channels,
          'pipe:1',
        ];

        this.systemStream = spawn('ffmpeg', args, { stdio: ['ignore', 'pipe', 'inherit'] });

        this.systemStream.stdout.on('data', (chunk) => {
          this.audioChunks.push(chunk);
          this.emit('data', { source: 'system', data: chunk });
        });

        this.systemStream.on('error', (error) => {
          this.emit('error', new Error(`System audio capture error: ${error.message}`));
          reject(error);
        });

        this.systemStream.on('close', () => {
          if (this.isCapturing) {
            this.emit('error', new Error('System audio capture process ended unexpectedly'));
          }
        });

        resolve();
      } catch (error) {
        reject(new Error(`Failed to start system audio capture: ${error.message}`));
      }
    });
  }

  /**
   * Stop capturing audio
   * @returns {Promise<void>}
   */
  async stopCapture() {
    this.isCapturing = false;

    const stopPromises = [];

    if (this.micStream) {
      stopPromises.push(
        new Promise((resolve) => {
          this.micStream.once('exit', resolve);
          this.micStream.kill();
          this.micStream = null;
        })
      );
    }

    if (this.systemStream) {
      stopPromises.push(
        new Promise((resolve) => {
          this.systemStream.once('exit', resolve);
          this.systemStream.kill();
          this.systemStream = null;
        })
      );
    }

    await Promise.all(stopPromises);
    this.emit('stop');
  }

  /**
   * Get the captured audio data as a buffer
   * @returns {Buffer}
   */
  getAudioData() {
    return Buffer.concat(this.audioChunks);
  }

  /**
   * Clear the captured audio data
   */
  clearAudioData() {
    this.audioChunks = [];
  }

  /**
   * Clean up resources
   */
  async destroy() {
    await this.stopCapture();
    this.removeAllListeners();
  }
}

module.exports = AudioCapture;
