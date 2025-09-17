const { performance } = require('perf_hooks');
const TranslationService = require('../src/services/translation/translation-service');
const TranslationPipeline = require('../src/services/translation/TranslationPipeline');

// Configuration
const CONCURRENT_REQUESTS = 10;
const TEST_ITERATIONS = 5;
const TEST_TEXTS = [
  'Hello, how are you?',
  'This is a test of the translation service.',
  'The quick brown fox jumps over the lazy dog.',
  'The five boxing wizards jump quickly.',
  'Pack my box with five dozen liquor jugs.',
];

// Mock the translation cache
jest.mock('../../src/services/translation/utils/translation-cache', () => ({
  getCachedTranslation: jest.fn().mockResolvedValue(null),
  cacheTranslation: jest.fn().mockResolvedValue(undefined),
}));

describe('Translation Service Performance Tests', () => {
  let translationService;
  let translationPipeline;
  let testStartTime;

  beforeAll(() => {
    // Initialize services
    translationService = new TranslationService({
      apiKey: 'test-api-key',
      defaultSourceLanguage: 'en',
      defaultTargetLanguage: 'es',
    });

    translationPipeline = new TranslationPipeline({
      services: [translationService],
      cacheEnabled: false, // Disable cache for consistent performance testing
    });
  });

  beforeEach(() => {
    testStartTime = performance.now();
  });

  afterEach(() => {
    const testDuration = performance.now() - testStartTime;
    console.log(`Test completed in ${testDuration.toFixed(2)}ms`);
  });

  test('should measure single translation performance', async () => {
    const testText = 'Hello, how are you?';

    // Warm-up run
    await translationPipeline.translate(testText, 'en', 'es');

    const startTime = performance.now();

    // Run the test multiple times for more accurate measurement
    for (let i = 0; i < TEST_ITERATIONS; i++) {
      await translationPipeline.translate(testText, 'en', 'es');
    }

    const endTime = performance.now();
    const avgDuration = (endTime - startTime) / TEST_ITERATIONS;

    console.log(`\nSingle Translation Performance:`);
    console.log(`- Iterations: ${TEST_ITERATIONS}`);
    console.log(`- Total time: ${(endTime - startTime).toFixed(2)}ms`);
    console.log(`- Average time per translation: ${avgDuration.toFixed(2)}ms`);

    // Add assertion for performance threshold (adjust as needed)
    expect(avgDuration).toBeLessThan(100); // 100ms threshold
  }, 30000); // Increased timeout for performance tests

  test('should measure concurrent translation performance', async () => {
    // Create an array of test texts
    const testTexts = Array(CONCURRENT_REQUESTS)
      .fill()
      .map((_, i) => TEST_TEXTS[i % TEST_TEXTS.length]);

    // Warm-up run
    await Promise.all(testTexts.map((text) => translationPipeline.translate(text, 'en', 'es')));

    const startTime = performance.now();

    // Run concurrent translations
    const results = await Promise.all(
      testTexts.map((text) => translationPipeline.translate(text, 'en', 'es'))
    );

    const endTime = performance.now();
    const totalDuration = endTime - startTime;

    console.log(`\nConcurrent Translation Performance (${CONCURRENT_REQUESTS} requests):`);
    console.log(`- Total time: ${totalDuration.toFixed(2)}ms`);
    console.log(
      `- Requests per second: ${(CONCURRENT_REQUESTS / (totalDuration / 1000)).toFixed(2)}`
    );

    // Verify all translations completed successfully
    expect(results).toHaveLength(CONCURRENT_REQUESTS);
    results.forEach((result) => {
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    // Add assertion for performance threshold
    expect(totalDuration).toBeLessThan(1000); // 1 second threshold for all requests
  }, 30000);

  test('should measure memory usage', async () => {
    const initialMemory = process.memoryUsage().heapUsed;
    const testText = 'This is a memory usage test';

    // Perform multiple translations to measure memory growth
    for (let i = 0; i < 100; i++) {
      await translationPipeline.translate(`${testText} ${i}`, 'en', 'es');
    }

    const finalMemory = process.memoryUsage().heapUsed;
    const memoryUsed = finalMemory - initialMemory;

    console.log(`\nMemory Usage:`);
    console.log(`- Initial memory: ${(initialMemory / 1024 / 1024).toFixed(2)} MB`);
    console.log(`- Final memory: ${(finalMemory / 1024 / 1024).toFixed(2)} MB`);
    console.log(`- Memory used: ${(memoryUsed / 1024 / 1024).toFixed(2)} MB`);

    // Add assertion for memory usage threshold (adjust as needed)
    expect(memoryUsed).toBeLessThan(50 * 1024 * 1024); // 50MB max memory growth
  }, 30000);

  test('should handle high load', async () => {
    const HIGH_LOAD_REQUESTS = 100;
    const testTexts = Array(HIGH_LOAD_REQUESTS)
      .fill()
      .map((_, i) => `${TEST_TEXTS[i % TEST_TEXTS.length]} (${i})`);

    const startTime = performance.now();

    // Process all translations in parallel
    const results = await Promise.all(
      testTexts.map((text, index) =>
        translationPipeline
          .translate(text, 'en', 'es')
          .then((result) => ({
            success: true,
            result,
            index,
          }))
          .catch((error) => ({
            success: false,
            error: error.message,
            index,
          }))
      )
    );

    const endTime = performance.now();
    const totalDuration = endTime - startTime;

    // Calculate success rate
    const successCount = results.filter((r) => r.success).length;
    const successRate = (successCount / HIGH_LOAD_REQUESTS) * 100;

    console.log(`\nHigh Load Test (${HIGH_LOAD_REQUESTS} requests):`);
    console.log(`- Total time: ${(totalDuration / 1000).toFixed(2)}s`);
    console.log(
      `- Requests per second: ${(HIGH_LOAD_REQUESTS / (totalDuration / 1000)).toFixed(2)}`
    );
    console.log(`- Success rate: ${successRate.toFixed(2)}%`);

    // Log any failures
    const failures = results.filter((r) => !r.success);
    if (failures.length > 0) {
      console.log(`\nFailures (${failures.length}):`);
      failures.slice(0, 5).forEach((failure, i) => {
        console.log(`  ${i + 1}. Request ${failure.index}: ${failure.error}`);
      });
      if (failures.length > 5) {
        console.log(`  ...and ${failures.length - 5} more`);
      }
    }

    // Assertions
    expect(successRate).toBeGreaterThanOrEqual(95); // At least 95% success rate
    expect(totalDuration).toBeLessThan(10000); // Should complete in under 10 seconds
  }, 15000); // Increased timeout for high load test
});
