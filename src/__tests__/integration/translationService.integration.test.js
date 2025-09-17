const TranslationService = require('../../services/translation/translation-service');
const TranslationPipeline = require('../../services/translation/TranslationPipeline');
const TranslationManager = require('../../services/translation/translation-manager');

// Import the mock functions from our manual mock
const {
  mockGetCachedTranslation,
  mockCacheTranslation,
} = require('../../__mocks__/src/services/translation/utils/translation-cache');

// Tell Jest to use our manual mock
jest.mock('../../../src/services/translation/utils/translation-cache');

// Import the module - it will be replaced with our mock
const TranslationCache = require('../../services/translation/utils/translation-cache');

describe('Translation Service Integration', () => {
  let translationService;
  let translationPipeline;
  let translationManager;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Create fresh instances for each test
    translationService = new TranslationService({
      apiKey: 'test-api-key',
      defaultSourceLanguage: 'en',
      defaultTargetLanguage: 'es',
    });

    translationPipeline = new TranslationPipeline({
      services: [translationService],
      cacheEnabled: true,
    });

    translationManager = new TranslationManager({
      pipeline: translationPipeline,
      defaultSourceLanguage: 'en',
      defaultTargetLanguage: 'es',
    });
  });

  test('should translate text through the complete pipeline', async () => {
    const testText = 'Hello, how are you?';
    const expectedTranslation = 'Hola, ¿cómo estás?';

    // Mock the cache to return null (cache miss)
    mockGetCachedTranslation.mockResolvedValueOnce(null);

    // Mock the service's translate method
    const mockTranslate = jest
      .spyOn(translationService, 'translate')
      .mockImplementation(() => Promise.resolve(expectedTranslation));

    // Execute the translation
    const result = await translationManager.translateText(testText, 'en', 'es');

    // Verify the result
    expect(result).toBe(expectedTranslation);

    // Verify the service was called with the correct parameters
    expect(mockTranslate).toHaveBeenCalledWith(testText, 'en', 'es');

    // Verify the result was cached
    expect(mockCacheTranslation).toHaveBeenCalledWith(
      testText,
      'en',
      'es',
      expectedTranslation,
      undefined
    );
  });

  test('should use cached translation when available', async () => {
    const testText = 'Hello, how are you?';
    const cachedTranslation = 'Hola, ¿cómo estás?';

    // Mock the cache to return a cached translation
    mockGetCachedTranslation.mockResolvedValueOnce(cachedTranslation);

    // Mock the service's translate method (should not be called)
    const mockTranslate = jest.spyOn(translationService, 'translate');

    // Execute the translation
    const result = await translationManager.translateText(testText, 'en', 'es');

    // Verify the result came from cache
    expect(result).toBe(cachedTranslation);

    // Verify the service was not called
    expect(mockTranslate).not.toHaveBeenCalled();
  });

  test('should handle translation errors gracefully', async () => {
    const testText = 'Hello, how are you?';
    const errorMessage = 'Translation service unavailable';

    // Mock the cache to return null (cache miss)
    mockGetCachedTranslation.mockResolvedValueOnce(null);

    // Mock the service to throw an error
    const mockTranslate = jest
      .spyOn(translationService, 'translate')
      .mockRejectedValueOnce(new Error(errorMessage));

    // Execute the translation and expect it to throw
    await expect(translationManager.translateText(testText, 'en', 'es')).rejects.toThrow(
      errorMessage
    );

    // Verify the service was called
    expect(mockTranslate).toHaveBeenCalled();

    // Verify nothing was cached
    expect(mockCacheTranslation).not.toHaveBeenCalled();
  });

  test('should handle concurrent translation requests', async () => {
    const testText1 = 'Hello';
    const testText2 = 'Goodbye';
    const expectedTranslation1 = 'Hola';
    const expectedTranslation2 = 'Adiós';

    // Mock the cache to return null for both requests
    mockGetCachedTranslation.mockResolvedValueOnce(null).mockResolvedValueOnce(null);

    // Mock the service to return different translations based on input
    const mockTranslate = jest.spyOn(translationService, 'translate').mockImplementation((text) => {
      if (text === testText1) return Promise.resolve(expectedTranslation1);
      if (text === testText2) return Promise.resolve(expectedTranslation2);
      return Promise.reject(new Error('Unexpected input'));
    });

    // Execute concurrent translations
    const [result1, result2] = await Promise.all([
      translationManager.translateText(testText1, 'en', 'es'),
      translationManager.translateText(testText2, 'en', 'es'),
    ]);

    // Verify the results
    expect(result1).toBe(expectedTranslation1);
    expect(result2).toBe(expectedTranslation2);

    // Verify the service was called twice
    expect(mockTranslate).toHaveBeenCalledTimes(2);

    // Verify both results were cached
    expect(mockCacheTranslation).toHaveBeenCalledTimes(2);
    expect(mockCacheTranslation).toHaveBeenCalledWith(
      testText1,
      'en',
      'es',
      expectedTranslation1,
      undefined
    );
    expect(mockCacheTranslation).toHaveBeenCalledWith(
      testText2,
      'en',
      'es',
      expectedTranslation2,
      undefined
    );
  });

  test('should respect the cache TTL', async () => {
    const testText = 'Hello, how are you?';
    const cachedTranslation = 'Hola, ¿cómo estás?';
    const ttl = 3600; // 1 hour in seconds

    // Configure the pipeline with cache TTL
    translationPipeline = new TranslationPipeline({
      services: [translationService],
      cacheEnabled: true,
      cacheTTL: ttl,
    });

    translationManager = new TranslationManager({
      pipeline: translationPipeline,
      defaultSourceLanguage: 'en',
      defaultTargetLanguage: 'es',
    });

    // Mock the cache to return null (cache miss)
    mockGetCachedTranslation.mockResolvedValueOnce(null);

    // Mock the service's translate method
    const mockTranslate = jest
      .spyOn(translationService, 'translate')
      .mockResolvedValueOnce(cachedTranslation);

    // Execute the translation
    await translationManager.translateText(testText, 'en', 'es');

    // Verify the result was cached with the correct TTL
    expect(mockCacheTranslation).toHaveBeenCalledWith(testText, 'en', 'es', cachedTranslation, ttl);
  });
});
