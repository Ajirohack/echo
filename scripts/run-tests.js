#!/usr/bin/env node

/**
 * Comprehensive Test Runner for echo
 * Runs all test suites and generates detailed reports
 */

const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Test configuration
const TEST_CONFIG = {
  unit: {
    command: 'npm run test:unit',
    description: 'Unit Tests',
    timeout: 30000
  },
  integration: {
    command: 'npm run test:integration',
    description: 'Integration Tests',
    timeout: 45000
  },
  api: {
    command: 'npm run test:api',
    description: 'API Tests',
    timeout: 60000
  },
  performance: {
    command: 'npm run test:performance',
    description: 'Performance Tests',
    timeout: 90000
  },
  security: {
    command: 'npm run test:security',
    description: 'Security Tests',
    timeout: 45000
  },
  e2e: {
    command: 'npm run test:e2e',
    description: 'End-to-End Tests',
    timeout: 120000
  },
  accessibility: {
    command: 'npm run test:accessibility',
    description: 'Accessibility Tests',
    timeout: 30000
  },
  visual: {
    command: 'npm run test:visual',
    description: 'Visual Regression Tests',
    timeout: 30000
  }
};

// Test results storage
const testResults = {
  startTime: new Date(),
  endTime: null,
  totalTests: 0,
  passedTests: 0,
  failedTests: 0,
  skippedTests: 0,
  suites: {},
  coverage: null,
  errors: []
};

/**
 * Run a single test suite
 */
function runTestSuite(suiteName, config) {
  return new Promise((resolve, reject) => {
    console.log(`\n🚀 Running ${config.description}...`);
    console.log(`Command: ${config.command}`);
    
    const startTime = Date.now();
    const child = spawn(config.command, [], {
      shell: true,
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: config.timeout
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
      process.stdout.write(data);
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
      process.stderr.write(data);
    });

    child.on('close', (code) => {
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      const result = {
        name: suiteName,
        description: config.description,
        command: config.command,
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        duration: duration,
        exitCode: code,
        stdout: stdout,
        stderr: stderr,
        success: code === 0,
        error: code !== 0 ? `Test suite failed with exit code ${code}` : null
      };

      testResults.suites[suiteName] = result;
      
      if (code === 0) {
        console.log(`✅ ${config.description} completed successfully (${duration}ms)`);
        resolve(result);
      } else {
        console.log(`❌ ${config.description} failed (${duration}ms)`);
        testResults.errors.push(result.error);
        reject(result);
      }
    });

    child.on('error', (error) => {
      const result = {
        name: suiteName,
        description: config.description,
        command: config.command,
        error: error.message,
        success: false
      };
      
      testResults.suites[suiteName] = result;
      testResults.errors.push(error.message);
      reject(result);
    });
  });
}

/**
 * Run coverage analysis
 */
function runCoverage() {
  return new Promise((resolve, reject) => {
    console.log('\n📊 Running Coverage Analysis...');
    
    try {
      const coverageOutput = execSync('npm run test:coverage', {
        encoding: 'utf8',
        timeout: 60000
      });
      
      // Parse coverage output
      const coverageMatch = coverageOutput.match(/All files\s+\|\s+(\d+\.\d+)\s+\|\s+(\d+\.\d+)\s+\|\s+(\d+\.\d+)\s+\|\s+(\d+\.\d+)/);
      
      if (coverageMatch) {
        testResults.coverage = {
          statements: parseFloat(coverageMatch[1]),
          branches: parseFloat(coverageMatch[2]),
          functions: parseFloat(coverageMatch[3]),
          lines: parseFloat(coverageMatch[4])
        };
      }
      
      console.log('✅ Coverage analysis completed');
      resolve(testResults.coverage);
    } catch (error) {
      console.log('❌ Coverage analysis failed');
      reject(error);
    }
  });
}

/**
 * Generate test report
 */
function generateReport() {
  const report = {
    summary: {
      totalSuites: Object.keys(testResults.suites).length,
      successfulSuites: Object.values(testResults.suites).filter(s => s.success).length,
      failedSuites: Object.values(testResults.suites).filter(s => !s.success).length,
      totalDuration: testResults.endTime - testResults.startTime,
      coverage: testResults.coverage
    },
    suites: testResults.suites,
    errors: testResults.errors,
    timestamp: new Date().toISOString()
  };

  // Save detailed report
  const reportPath = path.join(__dirname, '..', 'test-reports', 'test-report.json');
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  // Generate HTML report
  generateHTMLReport(report);

  return report;
}

/**
 * Generate HTML report
 */
function generateHTMLReport(report) {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>echo - Test Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { text-align: center; margin-bottom: 30px; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .summary-card { background: #f8f9fa; padding: 20px; border-radius: 8px; text-align: center; }
        .summary-card.success { background: #d4edda; color: #155724; }
        .summary-card.failure { background: #f8d7da; color: #721c24; }
        .coverage { background: #e2e3e5; padding: 20px; border-radius: 8px; margin-bottom: 30px; }
        .suite { margin-bottom: 20px; padding: 15px; border-radius: 8px; border-left: 4px solid #ccc; }
        .suite.success { background: #d4edda; border-left-color: #28a745; }
        .suite.failure { background: #f8d7da; border-left-color: #dc3545; }
        .suite h3 { margin: 0 0 10px 0; }
        .suite-details { font-size: 14px; color: #666; }
        .error { background: #f8d7da; color: #721c24; padding: 10px; border-radius: 4px; margin: 5px 0; }
        .timestamp { text-align: center; color: #666; margin-top: 30px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>echo - Test Report</h1>
            <p>Comprehensive test results for echo application</p>
        </div>
        
        <div class="summary">
            <div class="summary-card ${report.summary.successfulSuites === report.summary.totalSuites ? 'success' : 'failure'}">
                <h3>${report.summary.successfulSuites}/${report.summary.totalSuites}</h3>
                <p>Test Suites Passed</p>
            </div>
            <div class="summary-card">
                <h3>${Math.round(report.summary.totalDuration / 1000)}s</h3>
                <p>Total Duration</p>
            </div>
            ${report.summary.coverage ? `
            <div class="summary-card">
                <h3>${report.summary.coverage.lines}%</h3>
                <p>Code Coverage</p>
            </div>
            ` : ''}
        </div>
        
        ${report.summary.coverage ? `
        <div class="coverage">
            <h3>Code Coverage</h3>
            <p><strong>Statements:</strong> ${report.summary.coverage.statements}%</p>
            <p><strong>Branches:</strong> ${report.summary.coverage.branches}%</p>
            <p><strong>Functions:</strong> ${report.summary.coverage.functions}%</p>
            <p><strong>Lines:</strong> ${report.summary.coverage.lines}%</p>
        </div>
        ` : ''}
        
        <h2>Test Suites</h2>
        ${Object.entries(report.suites).map(([name, suite]) => `
        <div class="suite ${suite.success ? 'success' : 'failure'}">
            <h3>${suite.description || name}</h3>
            <div class="suite-details">
                <p><strong>Duration:</strong> ${suite.duration ? Math.round(suite.duration / 1000) + 's' : 'N/A'}</p>
                <p><strong>Exit Code:</strong> ${suite.exitCode}</p>
                ${suite.error ? `<div class="error"><strong>Error:</strong> ${suite.error}</div>` : ''}
            </div>
        </div>
        `).join('')}
        
        ${report.errors.length > 0 ? `
        <h2>Errors</h2>
        ${report.errors.map(error => `<div class="error">${error}</div>`).join('')}
        ` : ''}
        
        <div class="timestamp">
            <p>Report generated on ${new Date(report.timestamp).toLocaleString()}</p>
        </div>
    </div>
</body>
</html>
  `;

  const htmlPath = path.join(__dirname, '..', 'test-reports', 'test-report.html');
  fs.writeFileSync(htmlPath, html);
  console.log(`📄 HTML report generated: ${htmlPath}`);
}

/**
 * Print summary to console
 */
function printSummary(report) {
  console.log('\n' + '='.repeat(60));
  console.log('📋 TEST EXECUTION SUMMARY');
  console.log('='.repeat(60));
  
  console.log(`\n🎯 Test Suites: ${report.summary.successfulSuites}/${report.summary.totalSuites} passed`);
  console.log(`⏱️  Total Duration: ${Math.round(report.summary.totalDuration / 1000)}s`);
  
  if (report.summary.coverage) {
    console.log(`📊 Code Coverage: ${report.summary.coverage.lines}% (lines)`);
  }
  
  console.log('\n📋 Suite Results:');
  Object.entries(report.suites).forEach(([name, suite]) => {
    const status = suite.success ? '✅' : '❌';
    const duration = suite.duration ? `(${Math.round(suite.duration / 1000)}s)` : '';
    console.log(`  ${status} ${suite.description || name} ${duration}`);
  });
  
  if (report.errors.length > 0) {
    console.log('\n❌ Errors:');
    report.errors.forEach(error => {
      console.log(`  - ${error}`);
    });
  }
  
  console.log('\n📄 Reports generated:');
  console.log(`  - JSON: test-reports/test-report.json`);
  console.log(`  - HTML: test-reports/test-report.html`);
  
  console.log('\n' + '='.repeat(60));
  
  // Exit with appropriate code
  const exitCode = report.summary.successfulSuites === report.summary.totalSuites ? 0 : 1;
  process.exit(exitCode);
}

/**
 * Main execution
 */
async function main() {
  console.log('🧪 echo - Comprehensive Test Runner');
  console.log('='.repeat(60));
  
  const testSuites = process.argv.slice(2);
  const suitesToRun = testSuites.length > 0 ? testSuites : Object.keys(TEST_CONFIG);
  
  try {
    // Run test suites
    for (const suiteName of suitesToRun) {
      if (TEST_CONFIG[suiteName]) {
        try {
          await runTestSuite(suiteName, TEST_CONFIG[suiteName]);
        } catch (error) {
          console.log(`⚠️  Suite ${suiteName} failed, continuing with others...`);
        }
      } else {
        console.log(`⚠️  Unknown test suite: ${suiteName}`);
      }
    }
    
    // Run coverage if all tests passed
    const allPassed = Object.values(testResults.suites).every(s => s.success);
    if (allPassed) {
      try {
        await runCoverage();
      } catch (error) {
        console.log('⚠️  Coverage analysis failed, continuing...');
      }
    }
    
    // Generate report
    testResults.endTime = new Date();
    const report = generateReport();
    printSummary(report);
    
  } catch (error) {
    console.error('❌ Test execution failed:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { runTestSuite, runCoverage, generateReport };
