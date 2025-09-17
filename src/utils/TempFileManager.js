const fs = require('fs');
const path = require('path');
const os = require('os');
const { v4: uuidv4 } = require('uuid');
const logger = require('./logger');

/**
 * TempFileManager provides centralized management of temporary files
 * with automatic cleanup and tracking.
 */
class TempFileManager {
  constructor(options = {}) {
    this.config = {
      tempDir: path.join(os.tmpdir(), 'echo-translation-app'),
      maxAge: options.maxAge || 3600000, // 1 hour in milliseconds
      cleanupInterval: options.cleanupInterval || 300000, // 5 minutes
      ...options,
    };

    this.files = new Map();
    this.ensureTempDir();
    this.startCleanupInterval();

    // Register process exit handler for cleanup
    process.on('exit', () => this.cleanupAllFiles());

    logger.debug(`TempFileManager initialized with temp directory: ${this.config.tempDir}`);
  }

  /**
   * Ensure the temporary directory exists
   */
  ensureTempDir() {
    if (!fs.existsSync(this.config.tempDir)) {
      fs.mkdirSync(this.config.tempDir, { recursive: true });
      logger.debug(`Created temporary directory: ${this.config.tempDir}`);
    }
  }

  /**
   * Create a temporary file with the given content
   * @param {Buffer|string} content - Content to write to the file
   * @param {string} prefix - Prefix for the filename
   * @param {string} extension - File extension (without dot)
   * @returns {Promise<string>} Path to the created temporary file
   */
  async createTempFile(content, prefix = 'temp', extension = 'tmp') {
    const filename = `${prefix}-${Date.now()}-${uuidv4()}.${extension}`;
    const filePath = path.join(this.config.tempDir, filename);

    try {
      await fs.promises.writeFile(filePath, content);
      this.registerFile(filePath);
      logger.debug(`Created temporary file: ${filePath}`);
      return filePath;
    } catch (error) {
      logger.error(`Failed to create temporary file: ${error.message}`);
      throw new Error(`Failed to create temporary file: ${error.message}`);
    }
  }

  /**
   * Register an existing file for tracking and cleanup
   * @param {string} filePath - Path to the file
   */
  registerFile(filePath) {
    this.files.set(filePath, Date.now());
    logger.debug(`Registered file for tracking: ${filePath}`);
  }

  /**
   * Remove a temporary file
   * @param {string} filePath - Path to the file to remove
   * @returns {Promise<boolean>} Whether the file was successfully removed
   */
  async removeFile(filePath) {
    try {
      if (fs.existsSync(filePath)) {
        await fs.promises.unlink(filePath);
        logger.debug(`Removed temporary file: ${filePath}`);
      }
      this.files.delete(filePath);
      return true;
    } catch (error) {
      logger.error(`Failed to remove temporary file ${filePath}: ${error.message}`);
      return false;
    }
  }

  /**
   * Clean up old files based on maxAge
   */
  async cleanupOldFiles() {
    const now = Date.now();
    const expiredFiles = [];

    // Identify expired files
    for (const [filePath, timestamp] of this.files.entries()) {
      if (now - timestamp > this.config.maxAge) {
        expiredFiles.push(filePath);
      }
    }

    // Remove expired files
    if (expiredFiles.length > 0) {
      logger.debug(`Cleaning up ${expiredFiles.length} expired temporary files`);

      for (const filePath of expiredFiles) {
        await this.removeFile(filePath);
      }
    }
  }

  /**
   * Clean up all tracked files
   */
  async cleanupAllFiles() {
    logger.debug(`Cleaning up all ${this.files.size} tracked temporary files`);

    const filePaths = Array.from(this.files.keys());
    for (const filePath of filePaths) {
      await this.removeFile(filePath);
    }
  }

  /**
   * Start the cleanup interval
   */
  startCleanupInterval() {
    this.cleanupIntervalId = setInterval(() => this.cleanupOldFiles(), this.config.cleanupInterval);
    logger.debug(`Started cleanup interval: ${this.config.cleanupInterval}ms`);
  }

  /**
   * Stop the cleanup interval
   */
  stopCleanupInterval() {
    if (this.cleanupIntervalId) {
      clearInterval(this.cleanupIntervalId);
      this.cleanupIntervalId = null;
      logger.debug('Stopped cleanup interval');
    }
  }

  /**
   * Destroy the manager and clean up all files
   */
  async destroy() {
    this.stopCleanupInterval();
    await this.cleanupAllFiles();
    logger.debug('TempFileManager destroyed');
  }
}

// Export singleton instance
const tempFileManager = new TempFileManager();
module.exports = tempFileManager;
