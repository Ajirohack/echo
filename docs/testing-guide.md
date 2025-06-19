# Testing Guide

This document provides a comprehensive guide to running and extending the tests for the Multi-Platform Translation App.

## Quick Start

Run all tests:

```bash
npm test
```

Run specific test categories:

```bash
npm run test:unit           # Unit tests only
npm run test:integration    # Integration tests only
npm run test:api            # API tests only
npm run test:performance    # Performance tests only
npm run test:e2e            # End-to-end tests only
npm run test:security       # Security tests only
```

Generate coverage report:

```bash
npm run test:coverage
npm run test:coverage:report  # Generate HTML report
```

## Test Structure

The tests are organized into the following structure:

```text
tests/
├── unit/                   # Unit tests
│   ├── services/           # Service-specific tests
│   │   ├── translation/    # Translation services
│   │   ├── stt/            # Speech-to-text services
│   │   ├── tts/            # Text-to-speech services
│   │   └── error-handling/ # Error handling tests
│   ├── components/         # UI component tests
│   └── utils/              # Utility function tests
├── integration/            # Integration tests
│   ├── stt-translation.test.js
│   ├── translation-tts.test.js
│   └── complete-pipeline.test.js
├── api/                    # API tests
│   ├── openai-api.test.js
│   ├── deepl-api.test.js
│   └── ...
├── performance/            # Performance tests
│   └── translation-performance.test.js
├── e2e/                    # End-to-end tests
│   └── app.e2e.test.js
├── security/               # Security tests
│   └── api-key-security.test.js
├── fixtures/               # Test fixtures
│   ├── audio-samples/      # Audio samples for STT/TTS testing
│   ├── mock-responses/     # Mock API responses
│   └── test-data/          # Test data for translations
├── mocks/                  # Mock implementations
└── utils/                  # Test utilities
```

## Adding New Tests

### Unit Tests

1. Create a new test file in the appropriate directory under `tests/unit/`
2. Import the module to test and any test utilities
3. Follow the pattern:

```javascript
describe('ModuleName', () => {
  // Setup code
  
  describe('functionName', () => {
    it('should do something specific', () => {
      // Test implementation
    });
  });
});
```

### Integration Tests

1. Create a new test file in `tests/integration/`
2. Focus on testing how components work together
3. Use mocks for external services

### API Tests

1. Create a new test file in `tests/api/`
2. Use `nock` to mock external API responses
3. Test both success and error responses

### Performance Tests

1. Create a new test file in `tests/performance/`
2. Set appropriate timeouts for longer-running tests
3. Measure and assert performance metrics

## Test Fixtures

### Adding Mock API Responses

1. Create a new JSON file in `tests/fixtures/mock-responses/`
2. Use the format `{service}-{from}-{to}.json`
3. Structure the response to match the actual API response

### Adding Audio Samples

1. Run the audio sample generator:

   ```bash
   node scripts/generate-audio-samples.js
   ```

2. Add metadata JSON files with transcripts

## Mock Services

To create a mock service:

1. Create a new file in `tests/mocks/`
2. Implement the same interface as the real service
3. Add simulation for delays, errors, etc.

Example:

```javascript
class MockTranslationService {
  constructor(options = {}) {
    this.name = options.name || 'mock-service';
    this.delay = options.delay || 50;
    this.failureRate = options.failureRate || 0;
  }

  async translate(text, fromLang, toLang) {
    // Simulate delay
    await new Promise(resolve => setTimeout(resolve, this.delay));
    
    // Simulate random failure
    if (Math.random() < this.failureRate) {
      throw new Error('Service temporarily unavailable');
    }
    
    return {
      translation: `[${toLang}] ${text}`,
      confidence: 0.9
    };
  }
}
```

## Continuous Integration

The tests are automatically run in CI using GitHub Actions:

- Unit and integration tests run on every PR
- Performance tests run on merges to main
- Security tests run on scheduled basis

The CI workflow is defined in `.github/workflows/ci.yml`.

## Code Coverage

We aim for the following code coverage targets:

- Core translation services: 90%+
- Integration points: 80%+
- UI components: 70%+
- Error handling paths: 85%+

View current coverage:

```bash
npm run test:coverage
```

## Performance Benchmarks

Performance tests verify:

- STT processing completes within 1 second
- Translation processing completes within 500ms
- TTS synthesis completes within 1.5 seconds
- Complete pipeline finishes within 4 seconds
- System handles 10 concurrent translations

## Security Testing

Security tests verify:

- API keys are stored securely
- Input is sanitized to prevent injection
- Network requests use proper security
- Content security policy is enforced

## Troubleshooting

### Tests are failing with timeout errors

Increase the timeout in the test command:

```bash
mocha --timeout 20000 'tests/**/*.test.js'
```

### Mock services aren't being used

Make sure the `USE_MOCKS` environment variable is set:

```bash
cross-env USE_MOCKS=true npm test
```

### Tests work locally but fail in CI

Check for environment differences:

- Node.js version
- Operating system differences
- Missing environment variables

## Accessibility Testing

Accessibility tests verify that the application is usable by people with disabilities:

1. Install dependencies:

   ```bash
   npm install @axe-core/puppeteer puppeteer
   ```

2. Run the tests:

   ```bash
   npm run test:accessibility
   ```

The accessibility tests check:

- WCAG 2.1 compliance
- Proper ARIA attributes
- Keyboard navigation
- Color contrast
- Screen reader compatibility
- Mobile touch target sizes

## Visual Regression Testing

Visual regression tests ensure the UI appears correctly and changes don't break the design:

1. Install dependencies:

   ```bash
   npm install puppeteer pixelmatch pngjs
   ```

2. Run the tests:

   ```bash
   npm run test:visual
   ```

Visual regression tests capture screenshots and compare them to baseline images, checking:

- UI components
- Responsive layouts
- Themes (light/dark/high-contrast)
- Loading states
- Error states

The first time tests run, baseline images are created. Subsequent runs compare against these baselines.

### Managing Screenshot Baselines

To update baseline screenshots:

```bash
npm run test:visual:update
```

Screenshots are stored in `tests/fixtures/screenshots/` in three folders:

- `baseline/`: Reference images
- `current/`: Latest test run images
- `diff/`: Difference images showing changes

## Adding New Test Types

To add a new category of tests:

1. Create a new directory under `tests/`
2. Add a new script to `package.json`
3. Update the CI workflow in `.github/workflows/ci.yml`
4. Document the new test type in this guide
