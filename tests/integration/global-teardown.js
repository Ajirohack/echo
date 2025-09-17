/**
 * Global teardown for Echo RTC integration tests
 * Runs once after all tests to clean up the test environment
 */

const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

class GlobalTeardown {
  constructor() {
    this.config = {
      baseURL: process.env.TEST_BASE_URL || 'http://localhost:8080',
      outputDir: process.env.TEST_OUTPUT_DIR || './test-results',
      cleanupTimeout: 30000 // 30 seconds
    };
  }

  async log(message, level = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [TEARDOWN] [${level.toUpperCase()}]`;

    switch (level) {
      case 'error':
        console.error(`\x1b[31m${prefix} ${message}\x1b[0m`);
        break;
      case 'warn':
        console.warn(`\x1b[33m${prefix} ${message}\x1b[0m`);
        break;
      case 'success':
        console.log(`\x1b[32m${prefix} ${message}\x1b[0m`);
        break;
      case 'info':
      default:
        console.log(`\x1b[36m${prefix} ${message}\x1b[0m`);
        break;
    }
  }

  async cleanupTestData() {
    this.log('Cleaning up test data...');

    try {
      // Load test data to know what to clean up
      const testDataPath = path.join(this.config.outputDir, 'test-data.json');

      let testData;
      try {
        const testDataContent = await fs.readFile(testDataPath, 'utf8');
        testData = JSON.parse(testDataContent);
      } catch (error) {
        this.log('No test data file found, skipping data cleanup', 'warn');
        return;
      }

      // Clean up test users (if the API supports it)
      if (testData.users) {
        for (const user of testData.users) {
          try {
            await axios.delete(`${this.config.baseURL}/api/users/${user.username}`, {
              timeout: 5000,
              validateStatus: () => true // Accept any status
            });
            this.log(`Cleaned up test user: ${user.username}`);
          } catch (error) {
            this.log(`Failed to cleanup user ${user.username}: ${error.message}`, 'warn');
          }
        }
      }

      // Clean up test rooms (if the API supports it)
      if (testData.rooms) {
        for (const room of testData.rooms) {
          try {
            await axios.delete(`${this.config.baseURL}/api/rooms/${room.name}`, {
              timeout: 5000,
              validateStatus: () => true // Accept any status
            });
            this.log(`Cleaned up test room: ${room.name}`);
          } catch (error) {
            this.log(`Failed to cleanup room ${room.name}: ${error.message}`, 'warn');
          }
        }
      }

      this.log('Test data cleanup completed', 'success');

    } catch (error) {
      this.log(`Test data cleanup failed: ${error.message}`, 'error');
    }
  }

  async generateFinalReport() {
    this.log('Generating final test report...');

    try {
      // Read setup report
      let setupReport = {};
      try {
        const setupReportPath = path.join(this.config.outputDir, 'setup-report.json');
        const setupContent = await fs.readFile(setupReportPath, 'utf8');
        setupReport = JSON.parse(setupContent);
      } catch (error) {
        this.log('No setup report found', 'warn');
      }

      // Collect test artifacts information
      const artifactsInfo = await this.collectArtifactsInfo();

      // Create final report
      const finalReport = {
        ...setupReport,
        teardown: {
          timestamp: new Date().toISOString(),
          status: 'teardown_complete'
        },
        artifacts: artifactsInfo,
        summary: {
          testRunCompleted: true,
          totalDuration: this.calculateTotalDuration(setupReport.setup?.timestamp),
          outputDirectory: this.config.outputDir
        }
      };

      const finalReportPath = path.join(this.config.outputDir, 'final-report.json');
      await fs.writeFile(finalReportPath, JSON.stringify(finalReport, null, 2));

      this.log('Final test report generated', 'success');

    } catch (error) {
      this.log(`Failed to generate final report: ${error.message}`, 'error');
    }
  }

  async collectArtifactsInfo() {
    const artifacts = {
      screenshots: [],
      videos: [],
      traces: [],
      reports: [],
      logs: []
    };

    try {
      const outputDirContents = await fs.readdir(this.config.outputDir, { withFileTypes: true });

      for (const item of outputDirContents) {
        if (item.isFile()) {
          const filePath = path.join(this.config.outputDir, item.name);
          const stats = await fs.stat(filePath);

          const fileInfo = {
            name: item.name,
            path: filePath,
            size: stats.size,
            created: stats.birthtime,
            modified: stats.mtime
          };

          if (item.name.endsWith('.png') || item.name.endsWith('.jpg')) {
            artifacts.screenshots.push(fileInfo);
          } else if (item.name.endsWith('.webm') || item.name.endsWith('.mp4')) {
            artifacts.videos.push(fileInfo);
          } else if (item.name.endsWith('.zip') && item.name.includes('trace')) {
            artifacts.traces.push(fileInfo);
          } else if (item.name.endsWith('.html') || item.name.endsWith('.json')) {
            artifacts.reports.push(fileInfo);
          } else if (item.name.endsWith('.log')) {
            artifacts.logs.push(fileInfo);
          }
        }
      }
    } catch (error) {
      this.log(`Failed to collect artifacts info: ${error.message}`, 'warn');
    }

    return artifacts;
  }

  calculateTotalDuration(startTime) {
    if (!startTime) return null;

    const start = new Date(startTime);
    const end = new Date();
    const durationMs = end.getTime() - start.getTime();

    return {
      milliseconds: durationMs,
      seconds: Math.round(durationMs / 1000),
      minutes: Math.round(durationMs / 60000),
      formatted: this.formatDuration(durationMs)
    };
  }

  formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  async cleanupTempFiles() {
    this.log('Cleaning up temporary files...');

    try {
      const tempFiles = [
        path.join(this.config.outputDir, 'test-data.json'),
        path.join(this.config.outputDir, 'setup-report.json')
      ];

      for (const tempFile of tempFiles) {
        try {
          await fs.unlink(tempFile);
          this.log(`Removed temporary file: ${path.basename(tempFile)}`);
        } catch (error) {
          if (error.code !== 'ENOENT') {
            this.log(`Failed to remove ${tempFile}: ${error.message}`, 'warn');
          }
        }
      }

      this.log('Temporary files cleanup completed', 'success');

    } catch (error) {
      this.log(`Temporary files cleanup failed: ${error.message}`, 'error');
    }
  }

  async optimizeArtifacts() {
    this.log('Optimizing test artifacts...');

    try {
      // Remove empty directories
      const subdirs = ['screenshots', 'videos', 'traces', 'test-artifacts'];

      for (const subdir of subdirs) {
        const dirPath = path.join(this.config.outputDir, subdir);
        try {
          const contents = await fs.readdir(dirPath);
          if (contents.length === 0) {
            await fs.rmdir(dirPath);
            this.log(`Removed empty directory: ${subdir}`);
          }
        } catch (error) {
          // Directory doesn't exist or not empty, ignore
        }
      }

      // Compress large log files (if needed)
      // This could be extended to compress videos, traces, etc.

      this.log('Artifacts optimization completed', 'success');

    } catch (error) {
      this.log(`Artifacts optimization failed: ${error.message}`, 'error');
    }
  }

  async printSummary() {
    this.log('\n' + '='.repeat(60));
    this.log('TEARDOWN SUMMARY', 'info');
    this.log('='.repeat(60));

    try {
      const finalReportPath = path.join(this.config.outputDir, 'final-report.json');
      const finalReportContent = await fs.readFile(finalReportPath, 'utf8');
      const finalReport = JSON.parse(finalReportContent);

      if (finalReport.summary?.totalDuration) {
        this.log(`Total test duration: ${finalReport.summary.totalDuration.formatted}`);
      }

      this.log(`Output directory: ${this.config.outputDir}`);

      if (finalReport.artifacts) {
        const { artifacts } = finalReport;
        this.log(`Screenshots: ${artifacts.screenshots?.length || 0}`);
        this.log(`Videos: ${artifacts.videos?.length || 0}`);
        this.log(`Traces: ${artifacts.traces?.length || 0}`);
        this.log(`Reports: ${artifacts.reports?.length || 0}`);
      }

    } catch (error) {
      this.log('Could not read final report for summary', 'warn');
    }

    this.log('='.repeat(60));
    this.log('Teardown completed successfully! 🧹', 'success');
  }

  async run() {
    try {
      this.log('Starting global teardown for Echo RTC integration tests');

      await this.cleanupTestData();
      await this.generateFinalReport();
      await this.optimizeArtifacts();
      await this.cleanupTempFiles();
      await this.printSummary();

      this.log('Global teardown completed successfully', 'success');

    } catch (error) {
      this.log(`Global teardown failed: ${error.message}`, 'error');
      // Don't throw error in teardown to avoid masking test failures
    }
  }
}

// Export the teardown function for Playwright
module.exports = async () => {
  const teardown = new GlobalTeardown();
  await teardown.run();
};

// Allow running teardown independently
if (require.main === module) {
  const teardown = new GlobalTeardown();
  teardown.run().catch(error => {
    console.error('Teardown failed:', error);
    process.exit(1);
  });
}