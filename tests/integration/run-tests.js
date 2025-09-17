#!/usr/bin/env node

/**
 * Comprehensive integration test runner for Echo RTC
 * Orchestrates all integration tests with proper setup, teardown, and reporting
 */

const { spawn, exec } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');
const { performance } = require('perf_hooks');

class IntegrationTestRunner {
  constructor() {
    this.config = {
      baseUrl: process.env.TEST_BASE_URL || 'http://localhost:8080',
      timeout: parseInt(process.env.TEST_TIMEOUT) || 300000, // 5 minutes
      retries: parseInt(process.env.TEST_RETRIES) || 2,
      parallel: process.env.TEST_PARALLEL !== 'false',
      headless: process.env.TEST_HEADLESS !== 'false',
      slowMo: parseInt(process.env.TEST_SLOW_MO) || 0,
      outputDir: process.env.TEST_OUTPUT_DIR || './test-results',
      reportFormat: process.env.TEST_REPORT_FORMAT || 'html'
    };

    this.testSuites = [
      {
        name: 'WebRTC Integration Tests',
        file: 'webrtc.test.js',
        category: 'core',
        timeout: 120000,
        priority: 1
      },
      {
        name: 'Real-time Communication Tests',
        file: 'realtime.test.js',
        category: 'core',
        timeout: 90000,
        priority: 1
      },
      {
        name: 'Audio Processing Tests',
        file: 'audio.test.js',
        category: 'core',
        timeout: 60000,
        priority: 2
      },
      {
        name: 'API Integration Tests',
        file: 'api.test.js',
        category: 'api',
        timeout: 120000,
        priority: 2
      },
      {
        name: 'Cross-platform Compatibility Tests',
        file: 'cross-platform.test.js',
        category: 'compatibility',
        timeout: 180000,
        priority: 3
      },
      {
        name: 'Security Tests',
        file: 'security.test.js',
        category: 'security',
        timeout: 150000,
        priority: 2
      },
      {
        name: 'Performance Tests',
        file: 'performance.test.js',
        category: 'performance',
        timeout: 300000,
        priority: 4
      }
    ];

    this.results = {
      startTime: null,
      endTime: null,
      totalTests: 0,
      passedTests: 0,
      failedTests: 0,
      skippedTests: 0,
      suiteResults: [],
      errors: [],
      warnings: []
    };

    this.serverProcess = null;
    this.cleanup = [];
  }

  async log(message, level = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level.toUpperCase()}]`;

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

  async checkPrerequisites() {
    this.log('Checking prerequisites...');

    // Check if Node.js version is compatible
    const nodeVersion = process.version;
    const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
    if (majorVersion < 16) {
      throw new Error(`Node.js version ${nodeVersion} is not supported. Please use Node.js 16 or higher.`);
    }

    // Check if required packages are installed
    const requiredPackages = ['@playwright/test', 'axios', 'ws', 'uuid', 'jsonwebtoken'];
    for (const pkg of requiredPackages) {
      try {
        require.resolve(pkg);
      } catch (error) {
        throw new Error(`Required package '${pkg}' is not installed. Run 'npm install' first.`);
      }
    }

    // Check if test files exist
    for (const suite of this.testSuites) {
      const testFile = path.join(__dirname, suite.file);
      try {
        await fs.access(testFile);
      } catch (error) {
        throw new Error(`Test file '${suite.file}' not found at ${testFile}`);
      }
    }

    this.log('Prerequisites check passed', 'success');
  }

  async setupEnvironment() {
    this.log('Setting up test environment...');

    // Create output directory
    try {
      await fs.mkdir(this.config.outputDir, { recursive: true });
    } catch (error) {
      this.log(`Failed to create output directory: ${error.message}`, 'warn');
    }

    // Set environment variables for tests
    process.env.TEST_BASE_URL = this.config.baseUrl;
    process.env.NODE_ENV = 'test';
    process.env.PLAYWRIGHT_HEADLESS = this.config.headless.toString();

    this.log('Test environment setup complete', 'success');
  }

  async startTestServer() {
    this.log('Starting test server...');

    // Check if server is already running
    try {
      const response = await axios.get(`${this.config.baseUrl}/health`, { timeout: 5000 });
      if (response.status === 200) {
        this.log('Test server is already running', 'success');
        return;
      }
    } catch (error) {
      // Server is not running, we need to start it
    }

    // Start the server
    return new Promise((resolve, reject) => {
      const serverScript = path.join(__dirname, '../../backend/server.js');

      this.serverProcess = spawn('node', [serverScript], {
        env: {
          ...process.env,
          NODE_ENV: 'test',
          PORT: '8080',
          LOG_LEVEL: 'warn'
        },
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let serverOutput = '';

      this.serverProcess.stdout.on('data', (data) => {
        serverOutput += data.toString();
        if (serverOutput.includes('Server listening') || serverOutput.includes('started')) {
          this.log('Test server started successfully', 'success');
          resolve();
        }
      });

      this.serverProcess.stderr.on('data', (data) => {
        const error = data.toString();
        if (!error.includes('warning') && !error.includes('deprecated')) {
          this.log(`Server error: ${error}`, 'warn');
        }
      });

      this.serverProcess.on('error', (error) => {
        this.log(`Failed to start server: ${error.message}`, 'error');
        reject(error);
      });

      this.serverProcess.on('exit', (code) => {
        if (code !== 0) {
          this.log(`Server exited with code ${code}`, 'error');
          reject(new Error(`Server process exited with code ${code}`));
        }
      });

      // Timeout after 30 seconds
      setTimeout(() => {
        if (this.serverProcess && !this.serverProcess.killed) {
          this.log('Server startup timeout', 'error');
          this.serverProcess.kill();
          reject(new Error('Server startup timeout'));
        }
      }, 30000);
    });
  }

  async waitForServer() {
    this.log('Waiting for server to be ready...');

    const maxAttempts = 30;
    const delay = 1000;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const response = await axios.get(`${this.config.baseUrl}/health`, { timeout: 5000 });
        if (response.status === 200) {
          this.log('Server is ready', 'success');
          return;
        }
      } catch (error) {
        if (attempt === maxAttempts) {
          throw new Error(`Server not ready after ${maxAttempts} attempts`);
        }
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  async runTestSuite(suite) {
    this.log(`Running ${suite.name}...`);

    const startTime = performance.now();
    const result = {
      name: suite.name,
      file: suite.file,
      category: suite.category,
      startTime,
      endTime: null,
      duration: 0,
      status: 'running',
      tests: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      errors: [],
      output: ''
    };

    try {
      const playwrightConfig = {
        testDir: __dirname,
        testMatch: suite.file,
        timeout: suite.timeout || this.config.timeout,
        retries: this.config.retries,
        use: {
          baseURL: this.config.baseUrl,
          headless: this.config.headless,
          slowMo: this.config.slowMo
        },
        reporter: [
          ['json', { outputFile: path.join(this.config.outputDir, `${suite.file}.json`) }],
          ['html', { outputFolder: path.join(this.config.outputDir, `${suite.file}-report`) }]
        ]
      };

      // Write temporary Playwright config
      const configPath = path.join(this.config.outputDir, `playwright.config.${suite.file}.js`);
      await fs.writeFile(configPath, `module.exports = ${JSON.stringify(playwrightConfig, null, 2)};`);

      // Run the test suite
      const testProcess = spawn('npx', ['playwright', 'test', '--config', configPath], {
        cwd: __dirname,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      testProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      testProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      const exitCode = await new Promise((resolve) => {
        testProcess.on('exit', resolve);
      });

      result.output = stdout + stderr;

      // Parse test results
      try {
        const resultsFile = path.join(this.config.outputDir, `${suite.file}.json`);
        const resultsData = await fs.readFile(resultsFile, 'utf8');
        const testResults = JSON.parse(resultsData);

        result.tests = testResults.stats?.total || 0;
        result.passed = testResults.stats?.passed || 0;
        result.failed = testResults.stats?.failed || 0;
        result.skipped = testResults.stats?.skipped || 0;

        if (testResults.errors) {
          result.errors = testResults.errors;
        }
      } catch (parseError) {
        this.log(`Failed to parse test results for ${suite.name}: ${parseError.message}`, 'warn');
      }

      result.status = exitCode === 0 ? 'passed' : 'failed';

      if (result.status === 'passed') {
        this.log(`${suite.name} completed successfully (${result.passed}/${result.tests} tests passed)`, 'success');
      } else {
        this.log(`${suite.name} failed (${result.failed}/${result.tests} tests failed)`, 'error');
      }

    } catch (error) {
      result.status = 'error';
      result.errors.push(error.message);
      this.log(`Error running ${suite.name}: ${error.message}`, 'error');
    }

    result.endTime = performance.now();
    result.duration = result.endTime - result.startTime;

    return result;
  }

  async runTests() {
    this.results.startTime = performance.now();

    try {
      // Filter test suites based on command line arguments
      let suitesToRun = this.testSuites;

      const args = process.argv.slice(2);
      if (args.length > 0) {
        const categories = args.filter(arg => !arg.startsWith('--'));
        if (categories.length > 0) {
          suitesToRun = this.testSuites.filter(suite =>
            categories.includes(suite.category) || categories.includes(suite.name)
          );
        }
      }

      // Sort by priority
      suitesToRun.sort((a, b) => a.priority - b.priority);

      this.log(`Running ${suitesToRun.length} test suites...`);

      if (this.config.parallel && suitesToRun.length > 1) {
        // Run tests in parallel (with some limitations)
        const coreTests = suitesToRun.filter(s => s.category === 'core');
        const otherTests = suitesToRun.filter(s => s.category !== 'core');

        // Run core tests first (sequentially)
        for (const suite of coreTests) {
          const result = await this.runTestSuite(suite);
          this.results.suiteResults.push(result);
        }

        // Run other tests in parallel (max 3 at a time)
        const batchSize = 3;
        for (let i = 0; i < otherTests.length; i += batchSize) {
          const batch = otherTests.slice(i, i + batchSize);
          const batchResults = await Promise.all(
            batch.map(suite => this.runTestSuite(suite))
          );
          this.results.suiteResults.push(...batchResults);
        }
      } else {
        // Run tests sequentially
        for (const suite of suitesToRun) {
          const result = await this.runTestSuite(suite);
          this.results.suiteResults.push(result);
        }
      }

    } catch (error) {
      this.log(`Test execution failed: ${error.message}`, 'error');
      this.results.errors.push(error.message);
    }

    this.results.endTime = performance.now();

    // Calculate totals
    this.results.totalTests = this.results.suiteResults.reduce((sum, r) => sum + r.tests, 0);
    this.results.passedTests = this.results.suiteResults.reduce((sum, r) => sum + r.passed, 0);
    this.results.failedTests = this.results.suiteResults.reduce((sum, r) => sum + r.failed, 0);
    this.results.skippedTests = this.results.suiteResults.reduce((sum, r) => sum + r.skipped, 0);
  }

  async generateReport() {
    this.log('Generating test report...');

    const duration = (this.results.endTime - this.results.startTime) / 1000;
    const successRate = this.results.totalTests > 0
      ? (this.results.passedTests / this.results.totalTests * 100).toFixed(2)
      : 0;

    const report = {
      summary: {
        startTime: new Date(Date.now() - duration * 1000).toISOString(),
        endTime: new Date().toISOString(),
        duration: `${duration.toFixed(2)}s`,
        totalTests: this.results.totalTests,
        passedTests: this.results.passedTests,
        failedTests: this.results.failedTests,
        skippedTests: this.results.skippedTests,
        successRate: `${successRate}%`,
        status: this.results.failedTests === 0 ? 'PASSED' : 'FAILED'
      },
      suites: this.results.suiteResults.map(suite => ({
        name: suite.name,
        category: suite.category,
        status: suite.status,
        duration: `${(suite.duration / 1000).toFixed(2)}s`,
        tests: suite.tests,
        passed: suite.passed,
        failed: suite.failed,
        skipped: suite.skipped,
        errors: suite.errors
      })),
      errors: this.results.errors,
      warnings: this.results.warnings
    };

    // Save JSON report
    const jsonReportPath = path.join(this.config.outputDir, 'integration-test-report.json');
    await fs.writeFile(jsonReportPath, JSON.stringify(report, null, 2));

    // Generate HTML report
    if (this.config.reportFormat === 'html') {
      const htmlReport = this.generateHtmlReport(report);
      const htmlReportPath = path.join(this.config.outputDir, 'integration-test-report.html');
      await fs.writeFile(htmlReportPath, htmlReport);
      this.log(`HTML report generated: ${htmlReportPath}`, 'success');
    }

    this.log(`JSON report generated: ${jsonReportPath}`, 'success');

    return report;
  }

  generateHtmlReport(report) {
    const statusColor = report.summary.status === 'PASSED' ? '#28a745' : '#dc3545';

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Echo RTC Integration Test Report</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f8f9fa; }
        .container { max-width: 1200px; margin: 0 auto; background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; }
        .header h1 { margin: 0; font-size: 2.5em; }
        .header p { margin: 10px 0 0 0; opacity: 0.9; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; padding: 30px; }
        .metric { text-align: center; padding: 20px; border-radius: 8px; background: #f8f9fa; }
        .metric h3 { margin: 0 0 10px 0; color: #6c757d; font-size: 0.9em; text-transform: uppercase; }
        .metric .value { font-size: 2em; font-weight: bold; margin: 0; }
        .status-passed { color: #28a745; }
        .status-failed { color: #dc3545; }
        .suites { padding: 0 30px 30px 30px; }
        .suite { border: 1px solid #dee2e6; border-radius: 8px; margin-bottom: 20px; overflow: hidden; }
        .suite-header { padding: 15px 20px; background: #f8f9fa; border-bottom: 1px solid #dee2e6; display: flex; justify-content: space-between; align-items: center; }
        .suite-name { font-weight: bold; font-size: 1.1em; }
        .suite-status { padding: 4px 12px; border-radius: 20px; font-size: 0.8em; font-weight: bold; text-transform: uppercase; }
        .suite-status.passed { background: #d4edda; color: #155724; }
        .suite-status.failed { background: #f8d7da; color: #721c24; }
        .suite-status.error { background: #f8d7da; color: #721c24; }
        .suite-details { padding: 20px; }
        .suite-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(100px, 1fr)); gap: 15px; margin-bottom: 15px; }
        .suite-stat { text-align: center; }
        .suite-stat .label { font-size: 0.8em; color: #6c757d; text-transform: uppercase; }
        .suite-stat .value { font-size: 1.5em; font-weight: bold; }
        .errors { margin-top: 15px; }
        .error { background: #f8d7da; color: #721c24; padding: 10px; border-radius: 4px; margin-bottom: 10px; font-family: monospace; font-size: 0.9em; }
        .footer { text-align: center; padding: 20px; color: #6c757d; border-top: 1px solid #dee2e6; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Echo RTC Integration Test Report</h1>
            <p>Generated on ${new Date().toLocaleString()}</p>
        </div>
        
        <div class="summary">
            <div class="metric">
                <h3>Status</h3>
                <p class="value ${report.summary.status === 'PASSED' ? 'status-passed' : 'status-failed'}">
                    ${report.summary.status}
                </p>
            </div>
            <div class="metric">
                <h3>Total Tests</h3>
                <p class="value">${report.summary.totalTests}</p>
            </div>
            <div class="metric">
                <h3>Passed</h3>
                <p class="value status-passed">${report.summary.passedTests}</p>
            </div>
            <div class="metric">
                <h3>Failed</h3>
                <p class="value status-failed">${report.summary.failedTests}</p>
            </div>
            <div class="metric">
                <h3>Success Rate</h3>
                <p class="value">${report.summary.successRate}</p>
            </div>
            <div class="metric">
                <h3>Duration</h3>
                <p class="value">${report.summary.duration}</p>
            </div>
        </div>
        
        <div class="suites">
            <h2>Test Suites</h2>
            ${report.suites.map(suite => `
                <div class="suite">
                    <div class="suite-header">
                        <div>
                            <div class="suite-name">${suite.name}</div>
                            <div style="font-size: 0.9em; color: #6c757d; margin-top: 5px;">
                                ${suite.category} • ${suite.duration}
                            </div>
                        </div>
                        <div class="suite-status ${suite.status}">${suite.status}</div>
                    </div>
                    <div class="suite-details">
                        <div class="suite-stats">
                            <div class="suite-stat">
                                <div class="label">Total</div>
                                <div class="value">${suite.tests}</div>
                            </div>
                            <div class="suite-stat">
                                <div class="label">Passed</div>
                                <div class="value status-passed">${suite.passed}</div>
                            </div>
                            <div class="suite-stat">
                                <div class="label">Failed</div>
                                <div class="value status-failed">${suite.failed}</div>
                            </div>
                            <div class="suite-stat">
                                <div class="label">Skipped</div>
                                <div class="value">${suite.skipped}</div>
                            </div>
                        </div>
                        ${suite.errors.length > 0 ? `
                            <div class="errors">
                                <h4>Errors:</h4>
                                ${suite.errors.map(error => `<div class="error">${error}</div>`).join('')}
                            </div>
                        ` : ''}
                    </div>
                </div>
            `).join('')}
        </div>
        
        <div class="footer">
            <p>Echo RTC Integration Test Suite • Generated by test runner</p>
        </div>
    </div>
</body>
</html>
    `;
  }

  async cleanup() {
    this.log('Cleaning up test environment...');

    // Stop server if we started it
    if (this.serverProcess && !this.serverProcess.killed) {
      this.log('Stopping test server...');
      this.serverProcess.kill('SIGTERM');

      // Wait for graceful shutdown
      await new Promise(resolve => {
        this.serverProcess.on('exit', resolve);
        setTimeout(() => {
          if (!this.serverProcess.killed) {
            this.serverProcess.kill('SIGKILL');
            resolve();
          }
        }, 5000);
      });
    }

    // Run any additional cleanup tasks
    for (const cleanupTask of this.cleanup) {
      try {
        await cleanupTask();
      } catch (error) {
        this.log(`Cleanup task failed: ${error.message}`, 'warn');
      }
    }

    this.log('Cleanup complete', 'success');
  }

  async run() {
    try {
      this.log('Starting Echo RTC Integration Test Suite', 'info');

      await this.checkPrerequisites();
      await this.setupEnvironment();
      await this.startTestServer();
      await this.waitForServer();
      await this.runTests();

      const report = await this.generateReport();

      // Print summary
      this.log('\n' + '='.repeat(60));
      this.log('TEST SUMMARY', 'info');
      this.log('='.repeat(60));
      this.log(`Status: ${report.summary.status}`);
      this.log(`Total Tests: ${report.summary.totalTests}`);
      this.log(`Passed: ${report.summary.passedTests}`);
      this.log(`Failed: ${report.summary.failedTests}`);
      this.log(`Skipped: ${report.summary.skippedTests}`);
      this.log(`Success Rate: ${report.summary.successRate}`);
      this.log(`Duration: ${report.summary.duration}`);
      this.log('='.repeat(60));

      if (report.summary.status === 'PASSED') {
        this.log('All tests passed! 🎉', 'success');
        process.exit(0);
      } else {
        this.log('Some tests failed. Check the report for details.', 'error');
        process.exit(1);
      }

    } catch (error) {
      this.log(`Test runner failed: ${error.message}`, 'error');
      process.exit(1);
    } finally {
      await this.cleanup();
    }
  }
}

// Handle process signals
process.on('SIGINT', async () => {
  console.log('\nReceived SIGINT, cleaning up...');
  process.exit(1);
});

process.on('SIGTERM', async () => {
  console.log('\nReceived SIGTERM, cleaning up...');
  process.exit(1);
});

// Run the test suite if this file is executed directly
if (require.main === module) {
  const runner = new IntegrationTestRunner();
  runner.run().catch(error => {
    console.error('Test runner crashed:', error);
    process.exit(1);
  });
}

module.exports = IntegrationTestRunner;