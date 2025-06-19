// Mock implementation of TranslationCache
const mockGetCachedTranslation = jest.fn();
const mockCacheTranslation = jest.fn();

class MockTranslationCache {
  static getCachedTranslation = mockGetCachedTranslation;
  static cacheTranslation = mockCacheTranslation;
}

// Export the mock functions for direct access in tests
export {
  mockGetCachedTranslation,
  mockCacheTranslation
};

export default MockTranslationCache;
