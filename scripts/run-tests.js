#!/usr/bin/env node

/**
 * Test Runner for Translation App
 * 
 * This script runs all tests for the application with proper configuration
 * and reporting. It can be used locally or in CI environments.
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// Configuration
const config = {
    testDirs: [
        'unit',
        'integration',
        'api',
        'performance',
        'e2e'
    ],
    mochaOptions: '--require tests/test-helper.js --timeout 10000',
    coverageDir: './coverage',
    reportDir: './test-reports',
    logFile: './logs/test-run.log'
};

// Ensure directories exist
[config.coverageDir, config.reportDir, path.dirname(config.logFile)].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

// Get command line arguments
const args = process.argv.slice(2);
const testType = args[0];
const specificTest = args[1];

// Log output
function log(message) {
    console.log(message);
    fs.appendFileSync(config.logFile, message + '\n');
}

// Run a specific test command
function runTest(command) {
    log(`Running: ${command}`);
    try {
        const output = execSync(command, { stdio: 'inherit' });
        return { success: true, output };
    } catch (error) {
        log(`Test failed with exit code: ${error.status}`);
        return { success: false, error };
    }
}

// Clear previous test results
function clearPreviousResults() {
    log('Clearing previous test results...');
    if (fs.existsSync(config.coverageDir)) {
        execSync(`rm -rf ${config.coverageDir}/*`);
    }
    if (fs.existsSync(config.reportDir)) {
        execSync(`rm -rf ${config.reportDir}/*`);
    }
}

// Run a specific test type
function runTestType(type, specific = null) {
    const testPath = specific ?
        `tests/${type}/${specific}` :
        `tests/${type}/**/*.test.js`;

    const command = `npx nyc --reporter=lcov --reporter=text-summary mocha ${config.mochaOptions} '${testPath}'`;

    return runTest(command);
}

// Run all tests in the right order
function runAllTests() {
    let allPassed = true;

    for (const testDir of config.testDirs) {
        log(`\n==== Running ${testDir} tests ====\n`);
        const result = runTestType(testDir);

        if (!result.success) {
            allPassed = false;
            log(`❌ ${testDir} tests failed`);
        } else {
            log(`✅ ${testDir} tests passed`);
        }
    }

    return allPassed;
}

// Main function
function main() {
    log(`\n==== Test Run: ${new Date().toISOString()} ====\n`);

    // Clear previous results
    clearPreviousResults();

    // Run tests based on arguments
    let success = false;

    if (testType) {
        if (config.testDirs.includes(testType)) {
            log(`Running ${testType} tests${specificTest ? ` (${specificTest})` : ''}...`);
            const result = runTestType(testType, specificTest);
            success = result.success;
        } else {
            log(`Unknown test type: ${testType}`);
            log(`Available test types: ${config.testDirs.join(', ')}`);
            process.exit(1);
        }
    } else {
        log('Running all tests...');
        success = runAllTests();
    }

    // Generate coverage report
    log('\n==== Generating Coverage Report ====\n');
    try {
        execSync(`npx nyc report --reporter=html --report-dir=${config.coverageDir}`, { stdio: 'inherit' });
        log(`Coverage report generated in ${config.coverageDir}`);
    } catch (error) {
        log('Failed to generate coverage report');
    }

    // Exit with proper code
    process.exit(success ? 0 : 1);
}

// Run the script
main();
