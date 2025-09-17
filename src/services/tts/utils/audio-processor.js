/**
 * Audio Processor - Processes and formats audio for optimal playback
 * Handles format conversion, sampling rate adjustment, and normalization
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const { promisify } = require('util');
const { createHash } = require('crypto');
const AudioBuffer = require('audio-buffer');
const AudioBufferUtils = require('audio-buffer-utils');
const logger = require('../../../utils/logger');

// Set FFmpeg path
ffmpeg.setFfmpegPath(ffmpegPath);

class AudioProcessor {
  constructor(config = {}) {
    this.config = {
      sampleRate: 24000,
      channels: 1,
      bitDepth: 16,
      format: 'mp3',
      normalization: true,
      cacheEnabled: true,
      cacheDir: path.join(os.tmpdir(), 'tts-cache'),
      ...config,
    };

    // Create cache directory if it doesn't exist
    if (this.config.cacheEnabled) {
      if (!fs.existsSync(this.config.cacheDir)) {
        fs.mkdirSync(this.config.cacheDir, { recursive: true });
      }
    }
  }

  /**
   * Process audio data for optimal playback
   * @param {Buffer} audioData - The raw audio data
   * @param {string} inputFormat - The format of the input audio (mp3, wav, etc)
   * @param {Object} options - Processing options
   * @returns {Promise<Buffer>} Processed audio data
   */
  async processAudio(audioData, inputFormat = 'mp3', options = {}) {
    const opts = { ...this.config, ...options };

    // Generate a cache key for this audio
    const cacheKey = this.generateCacheKey(audioData, opts);
    const cachePath = path.join(this.config.cacheDir, `${cacheKey}.${opts.format}`);

    // Check cache if enabled
    if (opts.cacheEnabled && fs.existsSync(cachePath)) {
      return fs.promises.readFile(cachePath);
    }

    // Save the input to a temp file
    const inputPath = path.join(os.tmpdir(), `input-${Date.now()}.${inputFormat}`);
    const outputPath = path.join(os.tmpdir(), `output-${Date.now()}.${opts.format}`);

    try {
      await fs.promises.writeFile(inputPath, audioData);

      // Process with FFmpeg
      await this.processWithFFmpeg(inputPath, outputPath, opts);

      // Read the processed file
      const processedData = await fs.promises.readFile(outputPath);

      // Cache the result if enabled
      if (opts.cacheEnabled) {
        await fs.promises.writeFile(cachePath, processedData);
      }

      // Clean up temp files
      await this.cleanupTempFiles([inputPath, outputPath]);

      return processedData;
    } catch (error) {
      logger.error('Error processing audio:', error);
      await this.cleanupTempFiles([inputPath, outputPath]);
      return audioData; // Return original on error
    }
  }

  /**
   * Process audio file with FFmpeg
   * @param {string} inputPath - Path to input file
   * @param {string} outputPath - Path to output file
   * @param {Object} options - Processing options
   * @returns {Promise<void>}
   */
  processWithFFmpeg(inputPath, outputPath, options) {
    return new Promise((resolve, reject) => {
      let command = ffmpeg(inputPath)
        .audioChannels(options.channels)
        .audioFrequency(options.sampleRate)
        .audioBitrate(options.bitDepth * options.sampleRate * options.channels);

      // Apply normalization if enabled
      if (options.normalization) {
        command = command.audioFilters('dynaudnorm=f=150:g=15:p=0.7');
      }

      // Apply additional filters if specified
      if (options.speed && options.speed !== 1.0) {
        command = command.audioFilters(`atempo=${options.speed}`);
      }

      if (options.pitch && options.pitch !== 0) {
        // FFmpeg uses semitones for pitch shift
        command = command.audioFilters(
          `asetrate=${options.sampleRate}*${Math.pow(2, options.pitch / 12)}`
        );
      }

      command
        .output(outputPath)
        .on('error', (err) => {
          logger.error('FFmpeg processing error:', err);
          reject(err);
        })
        .on('end', () => {
          resolve();
        })
        .run();
    });
  }

  /**
   * Converts audio buffer to a different format
   * @param {Buffer} audioData - The audio data to convert
   * @param {string} inputFormat - Input format (mp3, wav, etc)
   * @param {string} outputFormat - Target format
   * @returns {Promise<Buffer>} Converted audio data
   */
  async convertFormat(audioData, inputFormat, outputFormat) {
    return this.processAudio(audioData, inputFormat, { format: outputFormat });
  }

  /**
   * Normalize audio volume levels
   * @param {Buffer} audioData - The audio data to normalize
   * @param {string} format - Audio format (mp3, wav, etc)
   * @returns {Promise<Buffer>} Normalized audio data
   */
  async normalizeVolume(audioData, format) {
    return this.processAudio(audioData, format, { normalization: true });
  }

  /**
   * Adjust audio speed
   * @param {Buffer} audioData - The audio data to adjust
   * @param {string} format - Audio format (mp3, wav, etc)
   * @param {number} speed - Speed factor (0.5 = half speed, 2.0 = double speed)
   * @returns {Promise<Buffer>} Adjusted audio data
   */
  async adjustSpeed(audioData, format, speed) {
    return this.processAudio(audioData, format, { speed });
  }

  /**
   * Adjust audio pitch
   * @param {Buffer} audioData - The audio data to adjust
   * @param {string} format - Audio format (mp3, wav, etc)
   * @param {number} pitch - Pitch adjustment in semitones
   * @returns {Promise<Buffer>} Adjusted audio data
   */
  async adjustPitch(audioData, format, pitch) {
    return this.processAudio(audioData, format, { pitch });
  }

  /**
   * Generate a cache key based on audio data and options
   * @param {Buffer} audioData - The audio data
   * @param {Object} options - Processing options
   * @returns {string} Cache key
   */
  generateCacheKey(audioData, options) {
    const hash = createHash('md5');
    hash.update(audioData);

    // Include relevant options in the hash
    const optionsString = JSON.stringify({
      sampleRate: options.sampleRate,
      channels: options.channels,
      bitDepth: options.bitDepth,
      format: options.format,
      normalization: options.normalization,
      speed: options.speed,
      pitch: options.pitch,
    });

    hash.update(optionsString);
    return hash.digest('hex');
  }

  /**
   * Clean up temporary files
   * @param {Array<string>} filePaths - Paths to files to delete
   * @returns {Promise<void>}
   */
  async cleanupTempFiles(filePaths) {
    for (const filePath of filePaths) {
      try {
        if (fs.existsSync(filePath)) {
          await fs.promises.unlink(filePath);
        }
      } catch (error) {
        logger.warn(`Error cleaning up temp file ${filePath}:`, error);
      }
    }
  }

  /**
   * Create an audio buffer from audio data
   * @param {Buffer} audioData - The audio data
   * @param {Object} options - Audio buffer options
   * @returns {AudioBuffer} Audio buffer
   */
  createAudioBuffer(audioData, options = {}) {
    const opts = { ...this.config, ...options };

    // For advanced audio processing, convert to AudioBuffer
    const buffer = new AudioBuffer({
      numberOfChannels: opts.channels,
      length: audioData.length / (opts.bitDepth / 8),
      sampleRate: opts.sampleRate,
    });

    // Copy data to the buffer
    const channelData = buffer.getChannelData(0);
    for (let i = 0; i < channelData.length; i++) {
      channelData[i] = audioData.readFloatLE(i * 4);
    }

    return buffer;
  }
}

module.exports = AudioProcessor;
