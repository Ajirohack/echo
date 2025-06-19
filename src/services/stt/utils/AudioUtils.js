const fs = require('fs');
const path = require('path');
const { Readable, Writable } = require('stream');
const { exec } = require('child_process');
const { promisify } = require('util');
const { v4: uuidv4 } = require('uuid');
const ffmpeg = require('fluent-ffmpeg');
const wav = require('wav');
const logger = require('../../../utils/logger');

const execAsync = promisify(exec);

/**
 * AudioUtils provides helper functions for audio processing and format conversion
 */
class AudioUtils {
  constructor(config = {}) {
    this.config = {
      tempDir: path.join(require('os').tmpdir(), 'universal-translator', 'audio'),
      ffmpegPath: 'ffmpeg',
      ffprobePath: 'ffprobe',
      maxFileSize: 100 * 1024 * 1024, // 100MB
      ...config
    };

    // Ensure temp directory exists
    if (!fs.existsSync(this.config.tempDir)) {
      fs.mkdirSync(this.config.tempDir, { recursive: true });
    }

    // Set ffmpeg paths if provided
    if (this.config.ffmpegPath) {
      ffmpeg.setFfmpegPath(this.config.ffmpegPath);
    }
    if (this.config.ffprobePath) {
      ffmpeg.setFfprobePath(this.config.ffprobePath);
    }
  }

  /**
   * Get audio file information
   * @param {string|Buffer} input - Path to audio file or audio buffer
   * @returns {Promise<Object>} Audio metadata
   */
  async getAudioInfo(input) {
    try {
      // If input is a buffer, write it to a temporary file
      let tempFilePath;
      if (Buffer.isBuffer(input)) {
        tempFilePath = await this._bufferToTempFile(input);
        input = tempFilePath;
      }

      return new Promise((resolve, reject) => {
        ffmpeg.ffprobe(input, (err, metadata) => {
          // Clean up temp file if created
          if (tempFilePath) {
            fs.unlink(tempFilePath, () => {});
          }

          if (err) {
            return reject(new Error(`Failed to get audio info: ${err.message}`));
          }

          // Extract relevant audio stream info
          const audioStream = metadata.streams.find(s => s.codec_type === 'audio');
          if (!audioStream) {
            return reject(new Error('No audio stream found in the input'));
          }

          resolve({
            format: metadata.format.format_name,
            duration: parseFloat(metadata.format.duration) || 0,
            size: metadata.format.size || 0,
            bitRate: metadata.format.bit_rate ? parseInt(metadata.format.bit_rate) : 0,
            sampleRate: audioStream.sample_rate ? parseInt(audioStream.sample_rate) : 0,
            channels: audioStream.channels || 1,
            codec: audioStream.codec_name,
            raw: metadata
          });
        });
      });
    } catch (error) {
      logger.error('Error getting audio info:', error);
      throw error;
    }
  }

  /**
   * Convert audio to the specified format
   * @param {string|Buffer} input - Path to input file or buffer
   * @param {Object} options - Conversion options
   * @returns {Promise<Buffer>} Converted audio buffer
   */
  async convertAudio(input, options = {}) {
    const {
      format = 'wav',
      sampleRate = 16000,
      channels = 1,
      bitDepth = 16,
      codec = 'pcm_s16le',
      start,
      duration,
      volume = 1.0,
      normalize = false,
      trimSilence = false,
      silenceThreshold = -50,
      silenceDuration = 0.5
    } = options;

    let tempInputPath;
    let tempOutputPath;

    try {
      // Handle input (file path or buffer)
      if (Buffer.isBuffer(input)) {
        tempInputPath = await this._bufferToTempFile(input);
      } else if (typeof input === 'string' && fs.existsSync(input)) {
        tempInputPath = input;
      } else {
        throw new Error('Invalid input: must be a file path or buffer');
      }

      // Create output path
      tempOutputPath = path.join(
        this.config.tempDir,
        `${uuidv4()}.${format}`
      );

      // Build ffmpeg command
      const command = ffmpeg(tempInputPath);

      // Audio filters
      const filters = [];
      
      // Volume adjustment
      if (volume !== 1.0) {
        filters.push(`volume=${volume}`);
      }
      
      // Normalization (loudnorm filter)
      if (normalize) {
        filters.push('loudnorm=I=-16:TP=-1.5:LRA=11');
      }
      
      // Silence trimming
      if (trimSilence) {
        filters.push(`silenceremove=start_periods=1:start_threshold=${silenceThreshold}dB:start_silence=0.1`);
      }
      
      // Apply filters if any
      if (filters.length > 0) {
        command.audioFilters(filters.join(','));
      }
      
      // Set output options
      command
        .audioChannels(channels)
        .audioFrequency(sampleRate)
        .audioCodec(codec)
        .outputOptions(['-f', format])
        .output(tempOutputPath);
      
      // Set start time and duration if specified
      if (start !== undefined) {
        command.seekInput(start);
      }
      
      if (duration !== undefined) {
        command.duration(duration);
      }
      
      // Set bit depth for PCM formats
      if (format === 'wav' || format === 'pcm') {
        command.outputOptions(['-sample_fmt', `s${bitDepth}le`]);
      }

      // Run the conversion
      await new Promise((resolve, reject) => {
        command
          .on('start', (cmd) => {
            logger.debug(`Running FFmpeg: ${cmd}`);
          })
          .on('end', () => {
            resolve();
          })
          .on('error', (err) => {
            reject(new Error(`FFmpeg error: ${err.message}`));
          })
          .run();
      });

      // Read the output file
      const outputBuffer = await fs.promises.readFile(tempOutputPath);
      
      // Clean up
      if (tempInputPath && tempInputPath !== input) {
        await fs.promises.unlink(tempInputPath).catch(() => {});
      }
      await fs.promises.unlink(tempOutputPath).catch(() => {});
      
      return outputBuffer;
    } catch (error) {
      // Clean up temp files on error
      if (tempInputPath && tempInputPath !== input) {
        await fs.promises.unlink(tempInputPath).catch(() => {});
      }
      if (tempOutputPath) {
        await fs.promises.unlink(tempOutputPath).catch(() => {});
      }
      
      logger.error('Error converting audio:', error);
      throw error;
    }
  }

  /**
   * Split audio into chunks of specified duration
   * @param {string|Buffer} input - Path to input file or buffer
   * @param {Object} options - Options
   * @returns {Promise<Array<{buffer: Buffer, start: number, end: number}>>} Array of audio chunks
   */
  async splitAudio(input, options = {}) {
    const {
      chunkDuration = 30, // seconds
      format = 'wav',
      sampleRate = 16000,
      channels = 1,
      bitDepth = 16,
      overlap = 0.5 // seconds
    } = options;

    try {
      // Get audio info
      const info = await this.getAudioInfo(input);
      const duration = info.duration;
      
      if (!duration || duration <= 0) {
        throw new Error('Invalid audio duration');
      }

      // Calculate chunks
      const chunks = [];
      let start = 0;
      
      while (start < duration) {
        const end = Math.min(start + chunkDuration, duration);
        
        // Convert the chunk
        const chunkBuffer = await this.convertAudio(input, {
          start,
          duration: end - start,
          format,
          sampleRate,
          channels,
          bitDepth
        });
        
        chunks.push({
          buffer: chunkBuffer,
          start,
          end,
          duration: end - start
        });
        
        // Move to next chunk with overlap
        start = end - overlap;
        
        // Break if we've reached the end
        if (start >= duration - 0.1) { // Small threshold to avoid floating point issues
          break;
        }
      }
      
      return chunks;
    } catch (error) {
      logger.error('Error splitting audio:', error);
      throw error;
    }
  }

  /**
   * Merge multiple audio buffers into a single buffer
   * @param {Array<Buffer>} buffers - Array of audio buffers to merge
   * @param {Object} options - Merge options
   * @returns {Promise<Buffer>} Merged audio buffer
   */
  async mergeAudio(buffers, options = {}) {
    if (!buffers || !Array.isArray(buffers) || buffers.length === 0) {
      throw new Error('No audio buffers provided for merging');
    }

    // If only one buffer, return it directly
    if (buffers.length === 1) {
      return buffers[0];
    }

    const tempDir = path.join(this.config.tempDir, 'merge');
    const fileListPath = path.join(tempDir, 'filelist.txt');
    const outputPath = path.join(tempDir, `merged-${Date.now()}.wav`);
    
    try {
      // Create temp directory
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      // Write each buffer to a temporary file
      const tempFiles = [];
      for (let i = 0; i < buffers.length; i++) {
        const tempPath = path.join(tempDir, `temp-${i}.wav`);
        await fs.promises.writeFile(tempPath, buffers[i]);
        tempFiles.push(tempPath);
      }
      
      // Create a file list for ffmpeg concat
      const fileList = tempFiles.map(file => `file '${file}'`).join('\n');
      await fs.promises.writeFile(fileListPath, fileList);
      
      // Merge using ffmpeg concat
      await new Promise((resolve, reject) => {
        ffmpeg()
          .input(fileListPath)
          .inputOptions(['-f', 'concat', '-safe', '0'])
          .outputOptions(['-c', 'copy'])
          .save(outputPath)
          .on('start', (cmd) => {
            logger.debug(`Running FFmpeg: ${cmd}`);
          })
          .on('end', () => {
            resolve();
          })
          .on('error', (err) => {
            reject(new Error(`FFmpeg concat error: ${err.message}`));
          });
      });
      
      // Read the merged file
      const mergedBuffer = await fs.promises.readFile(outputPath);
      
      // Clean up
      await Promise.all([
        ...tempFiles.map(file => fs.promises.unlink(file).catch(() => {})),
        fs.promises.unlink(fileListPath).catch(() => {}),
        fs.promises.unlink(outputPath).catch(() => {})
      ]);
      
      return mergedBuffer;
    } catch (error) {
      logger.error('Error merging audio:', error);
      
      // Clean up any remaining files
      try {
        if (fs.existsSync(fileListPath)) {
          await fs.promises.unlink(fileListPath).catch(() => {});
        }
        if (fs.existsSync(outputPath)) {
          await fs.promises.unlink(outputPath).catch(() => {});
        }
      } catch (cleanupError) {
        logger.error('Error cleaning up after merge error:', cleanupError);
      }
      
      throw error;
    }
  }

  /**
   * Normalize audio volume
   * @param {Buffer} buffer - Input audio buffer
   * @param {Object} options - Normalization options
   * @returns {Promise<Buffer>} Normalized audio buffer
   */
  async normalizeAudio(buffer, options = {}) {
    return this.convertAudio(buffer, {
      ...options,
      normalize: true
    });
  }

  /**
   * Trim silence from the beginning and end of audio
   * @param {Buffer} buffer - Input audio buffer
   * @param {Object} options - Trim options
   * @returns {Promise<Buffer>} Trimmed audio buffer
   */
  async trimSilence(buffer, options = {}) {
    return this.convertAudio(buffer, {
      ...options,
      trimSilence: true,
      silenceThreshold: options.silenceThreshold || -50,
      silenceDuration: options.silenceDuration || 0.5
    });
  }

  /**
   * Convert buffer to a temporary file
   * @private
   */
  async _bufferToTempFile(buffer, extension = 'wav') {
    const tempPath = path.join(
      this.config.tempDir,
      `${uuidv4()}.${extension}`
    );
    
    await fs.promises.writeFile(tempPath, buffer);
    return tempPath;
  }

  /**
   * Clean up temporary files
   * @returns {Promise<boolean>} True if cleanup was successful
   */
  async cleanup() {
    try {
      if (fs.existsSync(this.config.tempDir)) {
        await fs.promises.rm(this.config.tempDir, { recursive: true, force: true });
        return true;
      }
      return true;
    } catch (error) {
      logger.error('Error cleaning up temporary files:', error);
      return false;
    }
  }
}

module.exports = AudioUtils;
