# Testing Guide

This document outlines the testing approach for the echo application, including unit, integration, and end-to-end testing strategies.

## Test Types

### 1. Unit Tests
- **Location**: `tests/unit/`
- **Purpose**: Test individual functions and components in isolation
- **Frameworks**: Jest, React Testing Library
- **Coverage**: 80% minimum
- **Examples**:
  - Utility functions
  - Pure functions
  - Component rendering
  - State management

### 2. Integration Tests
- **Location**: `tests/integration/`
- **Purpose**: Test interactions between components and services
- **Frameworks**: Jest, React Testing Library
- **Examples**:
  - Component interactions
  - Service integrations
  - API client operations
  - State management integration

### 3. E2E Tests
- **Location**: `tests/e2e/`
- **Purpose**: Test complete user flows
- **Frameworks**: Playwright
- **Examples**:
  - User registration/login
  - Audio recording flow
  - Translation workflow
  - Settings management

## Running Tests

```bash
# Install dependencies
npm install

# Run all tests
npm test

# Run unit tests only
npm run test:unit

# Run integration tests only
npm run test:integration

# Run E2E tests (requires app to be running)
npm run test:e2e

# Run tests with coverage
npm run test:coverage

# Update snapshots
npm run test:update

# Run in watch mode
npm run test:watch
```

## Test Data Management
- **Factory Functions**: Use factory functions to create test data
- **Fixtures**: Store complex test data in fixture files
- **Faker/Chance**: Use libraries for generating realistic test data
- **Cleanup**: Always clean up test data after tests

## Mocking Strategy

### 1. Module Mocks
- Use `jest.mock()` for module-level mocks
- Place manual mocks in `__mocks__` directories

### 2. API Mocks
- Use MSW (Mock Service Worker) for API mocking
- Define API handlers in `tests/mocks/handlers.js`

### 3. Browser APIs
- Mock browser-specific APIs (MediaRecorder, AudioContext, etc.)
- Use `global` object to mock globals

## Best Practices

### Writing Tests
1. **Descriptive Test Names**: Use `describe` and `it` blocks effectively
2. **AAA Pattern**: Arrange, Act, Assert
3. **Test Isolation**: Each test should be independent
4. **Avoid Implementation Details**: Test behavior, not implementation
5. **Meaningful Assertions**: One assertion per test case

### Test Structure
```
tests/
  unit/               # Unit tests
    components/       # Component tests
    utils/           # Utility function tests
    __mocks__/       # Manual mocks
    
  integration/      # Integration tests
    components/      # Component integration tests
    services/        # Service integration tests
    __mocks__/       # Manual mocks
    
  e2e/             # End-to-end tests
    fixtures/        # Test data fixtures
    pages/           # Page object models
    
  utils/           # Test utilities
  setupTests.js      # Test setup
  setupE2E.js        # E2E test setup
```

### Performance
- Keep tests fast (under 5s for unit tests)
- Use `jest.setTimeout()` for long-running tests
- Mock expensive operations

### Debugging
- Use `--runInBand` to run tests sequentially
- Use `--detectOpenHandles` to find async issues
- Use `--verbose` for more detailed output

## Continuous Integration
- Run tests on every push/PR
- Enforce code coverage thresholds
- Cache node_modules for faster CI runs

## Code Coverage
- Aim for 80%+ coverage
- Focus on critical paths
- Use `.nycrc` for coverage configuration

## Resources
- [Jest Documentation](https://jestjs.io/)
- [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
- [Playwright](https://playwright.dev/)
- [MSW](https://mswjs.io/)
- Follow AAA pattern (Arrange-Act-Assert)
- Write deterministic tests
- Keep tests independent
- Test edge cases and error conditions
