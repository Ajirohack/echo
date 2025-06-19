# Translation Services Testing Guide

This document provides guidelines for testing the translation services within the Real-Time Multi-Platform Translation App.

## Available Tests

### Unit Tests

- **Translation Service Base Class**: Tests the abstract base class functionality
- **Azure Translator**: Tests Azure Translator integration
- **DeepL Service**: Tests DeepL API integration
- **Google Translate**: Tests Google Translate API integration
- **GPT-4o Translator**: Tests OpenAI GPT-4o for translation tasks
- **Translation Manager**: Tests service orchestration

### Integration Tests

- **STT-Translation Pipeline**: Tests speech-to-text to translation pipeline
- **Complete Pipeline**: Tests full STT → Translation → TTS pipeline
- **Mock Translation Test**: Simple test of mock translation services

## Running Tests

### Running All Tests

```bash
npm test
```

### Running Specific Tests

```bash
# Run a specific test suite
npm test -- tests/unit/services/translation/azure-translator.test.js

# Run tests with extended timeout
npm test -- --timeout 15000 tests/integration/complete-pipeline.test.js

# Run tests with specific pattern matching
npm test -- --grep "Azure"
```

### Mock Testing (No API Keys Required)

For testing without real API keys:

```bash
npm run test:translation-mock
```

## Mock Implementations

The application includes comprehensive mock implementations for all external services:

- `tests/mocks/translation-services-mock.js`: Mock translation services
- `tests/mocks/context-manager-mock.js`: Mock conversation context manager
- `tests/mocks/language-optimizer-mock.js`: Mock language pair optimizer
- `tests/mocks/translation-cache-mock.js`: Mock translation cache
- `tests/mocks/translation-quality-mock.js`: Mock quality assessment

## Test Fixtures

Test fixtures provide consistent test data:

- `tests/fixtures/test-data/translation-test-data.json`: Sample translations
- `tests/fixtures/mock-responses/translation-api-responses.json`: Mock API responses

## Testing Utilities

Helper functions are available in:

- `tests/utils/translation-test-utils.js`: Translation test utilities
- `tests/utils/audio-test-utils.js`: Audio processing test utilities
- `tests/utils/test-utils.js`: General test utilities

## Debugging Tests

For troubleshooting test failures:

1. Run with `--debug` flag for detailed output
2. Check test logs in `tests/logs` directory
3. Validate mock configurations match real service behavior
4. Ensure correct environment variables are set

## Adding New Tests

When adding new tests:

1. Create test file in appropriate directory
2. Import required mocks and utilities
3. Follow existing test patterns
4. Add appropriate assertions
5. Document the test in this guide

## Test Coverage

To generate coverage reports:

```bash
npm run test:coverage
```

Coverage reports are available in `coverage/lcov-report/index.html`
