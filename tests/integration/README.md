# Echo RTC Integration Tests

Comprehensive integration test suite for the Echo RTC platform, covering WebRTC functionality, real-time communication, audio processing, API endpoints, security, performance, and cross-platform compatibility.

## Overview

This test suite provides end-to-end testing of the Echo RTC platform using Playwright for browser automation and various testing utilities. The tests are designed to validate the complete functionality of the platform across different browsers, devices, and network conditions.

## Test Categories

### Core Tests (Priority 1-2)

- **WebRTC Integration Tests** - Peer-to-peer connections, audio streaming, connection handling
- **Real-time Communication Tests** - WebSocket connections, room management, message broadcasting
- **Audio Processing Tests** - Noise suppression, echo cancellation, audio analysis
- **API Integration Tests** - Authentication, room management, message handling
- **Security Tests** - Input validation, authorization, data protection

### Extended Tests (Priority 3-4)

- **Cross-platform Compatibility Tests** - Browser compatibility, mobile support, device handling
- **Performance Tests** - Load testing, concurrent users, memory usage, scalability

## Prerequisites

### System Requirements

- Node.js 16.0.0 or higher
- npm 8.0.0 or higher
- At least 4GB RAM for running tests
- Internet connection for downloading browser binaries

### Dependencies

- `@playwright/test` - Browser automation framework
- `axios` - HTTP client for API testing
- `ws` - WebSocket client for real-time testing
- `uuid` - UUID generation for test data
- `jsonwebtoken` - JWT token handling for authentication tests

## Setup

### 1. Install Dependencies

```bash
cd tests/integration
npm install
```

### 2. Install Playwright Browsers

```bash
npx playwright install
```

### 3. Set Up Environment Variables (Optional)

```bash
# Test configuration
export TEST_BASE_URL="http://localhost:8080"  # Default: http://localhost:8080
export TEST_TIMEOUT="300000"                  # Default: 300000 (5 minutes)
export TEST_RETRIES="2"                       # Default: 2
export TEST_HEADLESS="true"                   # Default: true
export TEST_PARALLEL="true"                   # Default: true
export TEST_SLOW_MO="0"                       # Default: 0 (no slow motion)
export TEST_OUTPUT_DIR="./test-results"       # Default: ./test-results
export TEST_REPORT_FORMAT="html"              # Default: html
```

## Running Tests

### Quick Start

```bash
# Run all integration tests
npm test

# Run with setup (install dependencies and browsers)
npm run setup && npm test
```

### Test Categories

```bash
# Run core functionality tests
npm run test:core

# Run API tests
npm run test:api

# Run security tests
npm run test:security

# Run performance tests
npm run test:performance

# Run cross-platform compatibility tests
npm run test:compatibility
```

### Specific Test Suites

```bash
# Run WebRTC tests only
npm run test:webrtc

# Run real-time communication tests
npm run test:realtime

# Run audio processing tests
npm run test:audio
```

### Test Modes

```bash
# Run tests in headed mode (visible browser)
npm run test:headed

# Run tests in headless mode (default)
npm run test:headless

# Run tests sequentially (not in parallel)
npm run test:sequential

# Run tests with debug mode (slow motion, headed)
npm run test:debug

# Run tests in CI mode (optimized for CI/CD)
npm run test:ci
```

### Custom Test Execution

```bash
# Run specific test file
node run-tests.js "WebRTC Integration Tests"

# Run multiple categories
node run-tests.js core api security

# Run with custom environment
TEST_HEADLESS=false TEST_TIMEOUT=600000 node run-tests.js
```

## Test Structure

### Test Files

```
tests/integration/
├── run-tests.js              # Main test runner
├── package.json              # Dependencies and scripts
├── webrtc.test.js           # WebRTC functionality tests
├── realtime.test.js         # Real-time communication tests
├── audio.test.js            # Audio processing tests
├── api.test.js              # API endpoint tests
├── security.test.js         # Security and validation tests
├── cross-platform.test.js   # Cross-platform compatibility tests
├── performance.test.js      # Performance and load tests
└── test-results/            # Generated test reports and artifacts
```

### Test Runner Features

- **Automatic server management** - Starts and stops test server as needed
- **Parallel execution** - Runs compatible tests in parallel for faster execution
- **Comprehensive reporting** - Generates HTML and JSON reports
- **Error handling** - Graceful error handling and cleanup
- **Environment validation** - Checks prerequisites before running tests
- **Flexible configuration** - Environment variable and command-line configuration

## Test Reports

After running tests, reports are generated in the `test-results/` directory:

### Report Files

- `integration-test-report.html` - Comprehensive HTML report with visual summaries
- `integration-test-report.json` - Detailed JSON report for programmatic analysis
- `playwright-report/` - Individual Playwright HTML reports for each test suite
- `*.json` - Individual JSON results for each test suite

### Viewing Reports

```bash
# Open HTML report in browser
npm run report

# Or manually open
open test-results/integration-test-report.html
```

### Report Contents

- **Test Summary** - Overall pass/fail status, execution time, success rate
- **Suite Details** - Individual test suite results with timing and error details
- **Error Analysis** - Detailed error messages and stack traces
- **Performance Metrics** - Execution times and resource usage
- **Screenshots/Videos** - Visual artifacts for failed tests (when available)

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `TEST_BASE_URL` | `http://localhost:8080` | Base URL for the Echo RTC server |
| `TEST_TIMEOUT` | `300000` | Global test timeout in milliseconds |
| `TEST_RETRIES` | `2` | Number of retries for failed tests |
| `TEST_HEADLESS` | `true` | Run browsers in headless mode |
| `TEST_PARALLEL` | `true` | Run compatible tests in parallel |
| `TEST_SLOW_MO` | `0` | Slow motion delay in milliseconds |
| `TEST_OUTPUT_DIR` | `./test-results` | Directory for test outputs |
| `TEST_REPORT_FORMAT` | `html` | Report format (html/json) |

### Playwright Configuration

The test suite supports multiple browser configurations:

- **Desktop Browsers**: Chromium, Firefox, WebKit
- **Mobile Browsers**: Mobile Chrome (Pixel 5), Mobile Safari (iPhone 12)
- **Custom Viewports**: Configurable screen sizes and user agents

## Troubleshooting

### Common Issues

#### Server Connection Issues

```bash
# Check if server is running
curl http://localhost:8080/health

# Start server manually
cd ../../backend
npm start
```

#### Browser Installation Issues

```bash
# Reinstall Playwright browsers
npx playwright install --force

# Install system dependencies (Linux)
npx playwright install-deps
```

#### Permission Issues

```bash
# Make test runner executable
chmod +x run-tests.js

# Fix npm permissions
npm config set prefix ~/.npm-global
```

#### Memory Issues

```bash
# Run tests sequentially to reduce memory usage
TEST_PARALLEL=false npm test

# Increase Node.js memory limit
node --max-old-space-size=4096 run-tests.js
```

### Debug Mode

For debugging test failures:

```bash
# Run in debug mode with visible browser and slow motion
npm run test:debug

# Run specific test with debugging
TEST_HEADLESS=false TEST_SLOW_MO=1000 node run-tests.js webrtc

# Enable verbose logging
DEBUG=* npm test
```

### Test Data Cleanup

The test runner automatically cleans up test data, but you can manually clean:

```bash
# Clean test results
npm run clean

# Remove all generated files
rm -rf test-results node_modules
npm install
```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Integration Tests

on: [push, pull_request]

jobs:
  integration-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: |
          cd tests/integration
          npm install
          npx playwright install --with-deps
      
      - name: Start server
        run: |
          cd backend
          npm install
          npm start &
          sleep 10
      
      - name: Run integration tests
        run: |
          cd tests/integration
          npm run test:ci
      
      - name: Upload test results
        uses: actions/upload-artifact@v3
        if: always()
        with:
          name: integration-test-results
          path: tests/integration/test-results/
```

### Docker Integration

```dockerfile
# Dockerfile for running tests in container
FROM mcr.microsoft.com/playwright:v1.40.0-focal

WORKDIR /app
COPY tests/integration/package*.json ./
RUN npm install

COPY tests/integration/ ./
COPY backend/ ../backend/

EXPOSE 8080
CMD ["npm", "run", "test:ci"]
```

## Performance Considerations

### Resource Usage

- **Memory**: Each browser instance uses ~100-200MB RAM
- **CPU**: Parallel execution can use multiple CPU cores
- **Disk**: Test artifacts and videos can consume significant disk space
- **Network**: Tests may generate substantial network traffic

### Optimization Tips

- Use `TEST_PARALLEL=false` for resource-constrained environments
- Set `TEST_HEADLESS=true` to reduce memory usage
- Limit concurrent test suites in CI environments
- Clean up test results regularly to save disk space

## Contributing

### Adding New Tests

1. Create test file following existing patterns
2. Add test suite configuration to `run-tests.js`
3. Update package.json scripts if needed
4. Document new test categories in this README

### Test Guidelines

- Use descriptive test names and descriptions
- Include proper setup and teardown
- Handle async operations correctly
- Add appropriate timeouts for long-running operations
- Include error handling and cleanup
- Follow existing code style and patterns

### Code Style

- Use async/await for asynchronous operations
- Include comprehensive error messages
- Add comments for complex test logic
- Use consistent naming conventions
- Follow ESLint configuration

## Support

For issues with the integration tests:

1. Check the troubleshooting section above
2. Review test logs and error messages
3. Check GitHub issues for known problems
4. Create a new issue with detailed reproduction steps

## License

This test suite is part of the Echo RTC project and follows the same license terms.
