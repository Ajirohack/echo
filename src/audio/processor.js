const { Transform } = require('stream');
const { spawn } = require('child_process');
const { exec } = require('child_process');
const { promisify } = require('util');
const os = require('os');
const path = require('path');
const fs = require('fs');
const execAsync = promisify(exec);

class AudioProcessor {
  constructor() {
    this.platform = os.platform();
    this.sampleRate = 16000;
    this.channels = 1;
    this.bitDepth = 16;
  }

  /**
   * Convert audio data to the target format
   * @param {Buffer} audioData - Input audio data
   * @param {Object} [options] - Conversion options
   * @param {number} [options.sampleRate] - Target sample rate (Hz)
   * @param {number} [options.channels] - Number of channels
   * @param {number} [options.bitDepth] - Bit depth (16 or 32)
   * @returns {Promise<Buffer>} - Converted audio data
   */
  async convertFormat(audioData, options = {}) {
    const {
      sampleRate = this.sampleRate,
      channels = this.channels,
      bitDepth = this.bitDepth
    } = options;

    if (!audioData || !Buffer.isBuffer(audioData) || audioData.length === 0) {
      throw new Error('Invalid audio data');
    }

    return new Promise((resolve, reject) => {
      try {
        const args = [
          '-f', 's16le',
          '-ar', '44100',  // Assume input is 44.1kHz if not specified
          '-ac', '2',      // Assume stereo input if not specified
          '-i', 'pipe:0',
          '-f', 's16le',
          '-ar', sampleRate,
          '-ac', channels,
          '-sample_fmt', `s${bitDepth}`,
          '-acodec', 'pcm_s16le',
          'pipe:1'
        ];

        const ffmpeg = spawn('ffmpeg', args, { stdio: ['pipe', 'pipe', 'inherit'] });
        const chunks = [];

        ffmpeg.stdout.on('data', (chunk) => {
          chunks.push(chunk);
        });

        ffmpeg.on('error', (error) => {
          reject(new Error(`Audio conversion error: ${error.message}`));
        });

        ffmpeg.on('close', (code) => {
          if (code !== 0) {
            reject(new Error(`Audio conversion process exited with code ${code}`));
          } else {
            resolve(Buffer.concat(chunks));
          }
        });

        // Write the input audio data
        ffmpeg.stdin.write(audioData);
        ffmpeg.stdin.end();
      } catch (error) {
        reject(new Error(`Failed to convert audio format: ${error.message}`));
      }
    });
  }

  /**
   * Normalize audio levels
   * @param {Buffer} audioData - Input audio data
   * @param {Object} [options] - Normalization options
   * @param {number} [options.targetLevel] - Target level in dB (default: -3dB)
   * @returns {Promise<Buffer>} - Normalized audio data
   */
  async normalize(audioData, options = {}) {
    const { targetLevel = -3 } = options;

    return new Promise((resolve, reject) => {
      try {
        const args = [
          '-f', 's16le',
          '-ar', this.sampleRate,
          '-ac', this.channels,
          '-i', 'pipe:0',
          '-af', `volume=${targetLevel}dB:precision=fixed`,
          '-f', 's16le',
          'pipe:1'
        ];

        const ffmpeg = spawn('ffmpeg', args, { stdio: ['pipe', 'pipe', 'inherit'] });
        const chunks = [];

        ffmpeg.stdout.on('data', (chunk) => {
          chunks.push(chunk);
        });

        ffmpeg.on('error', (error) => {
          reject(new Error(`Audio normalization error: ${error.message}`));
        });

        ffmpeg.on('close', (code) => {
          if (code !== 0) {
            reject(new Error(`Audio normalization process exited with code ${code}`));
          } else {
            resolve(Buffer.concat(chunks));
          }
        });

        // Write the input audio data
        ffmpeg.stdin.write(audioData);
        ffmpeg.stdin.end();
      } catch (error) {
        reject(new Error(`Failed to normalize audio: ${error.message}`));
      }
    });
  }

  /**
   * Trim silence from the beginning and end of audio
   * @param {Buffer} audioData - Input audio data
   * @param {Object} [options] - Trimming options
   * @param {number} [options.silenceThreshold] - Silence threshold in dB (default: -50dB)
   * @param {number} [options.silenceDuration] - Minimum silence duration in seconds (default: 0.5s)
   * @returns {Promise<Buffer>} - Trimmed audio data
   */
  async trimSilence(audioData, options = {}) {
    const { silenceThreshold = -50, silenceDuration = 0.5 } = options;

    return new Promise((resolve, reject) => {
      try {
        const args = [
          '-f', 's16le',
          '-ar', this.sampleRate,
          '-ac', this.channels,
          '-i', 'pipe:0',
          '-af', `silenceremove=start_periods=1:start_silence=${silenceDuration}:start_threshold=${silenceThreshold}dB:detection=peak`,
          '-f', 's16le',
          'pipe:1'
        ];

        const ffmpeg = spawn('ffmpeg', args, { stdio: ['pipe', 'pipe', 'inherit'] });
        const chunks = [];

        ffmpeg.stdout.on('data', (chunk) => {
          chunks.push(chunk);
        });

        ffmpeg.on('error', (error) => {
          reject(new Error(`Audio trimming error: ${error.message}`));
        });

        ffmpeg.on('close', (code) => {
          if (code !== 0) {
            reject(new Error(`Audio trimming process exited with code ${code}`));
          } else {
            resolve(Buffer.concat(chunks));
          }
        });

        // Write the input audio data
        ffmpeg.stdin.write(audioData);
        ffmpeg.stdin.end();
      } catch (error) {
        reject(new Error(`Failed to trim audio: ${error.message}`));
      }
    });
  }

  /**
   * Create a transform stream for real-time audio processing
   * @param {Object} [options] - Processing options
   * @returns {Transform} - Transform stream for audio processing
   */
  createProcessingStream(options = {}) {
    const transform = new Transform({
      transform(chunk, encoding, callback) {
        try {
          // Process the audio chunk here
          // This is a simple pass-through for now
          this.push(chunk);
          callback();
        } catch (error) {
          callback(error);
        }
      },
      ...options
    });

    return transform;
  }

  /**
   * Get audio duration in seconds
   * @param {Buffer} audioData - Input audio data
   * @returns {Promise<number>} - Duration in seconds
   */
  async getDuration(audioData) {
    return new Promise((resolve, reject) => {
      try {
        const tempFile = path.join(os.tmpdir(), `temp_audio_${Date.now()}.wav`);
        
        // Write the audio data to a temporary file
        fs.writeFileSync(tempFile, audioData);
        
        // Use ffprobe to get the duration
        const ffprobe = spawn('ffprobe', [
          '-v', 'error',
          '-show_entries', 'format=duration',
          '-of', 'default=noprint_wrappers=1:nokey=1',
          tempFile
        ], { stdio: ['ignore', 'pipe', 'inherit'] });

        let duration = 0;
        let output = '';

        ffprobe.stdout.on('data', (data) => {
          output += data.toString();
        });

        ffprobe.on('close', (code) => {
          // Clean up the temporary file
          fs.unlink(tempFile, () => {});
          
          if (code !== 0) {
            reject(new Error(`Failed to get audio duration: process exited with code ${code}`));
            return;
          }
          
          const match = output.match(/\d+\.\d+/);
          if (match) {
            duration = parseFloat(match[0]);
          }
          
          resolve(duration);
        });
        
        ffprobe.on('error', (error) => {
          fs.unlink(tempFile, () => {});
          reject(new Error(`Failed to get audio duration: ${error.message}`));
        });
      } catch (error) {
        reject(new Error(`Failed to process audio duration: ${error.message}`));
      }
    });
  }
}

module.exports = AudioProcessor;
