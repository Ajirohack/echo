// Manual mock for translation-cache
const mockGetCachedTranslation = jest.fn();
const mockCacheTranslation = jest.fn();

class MockTranslationCache {
  static getCachedTranslation = mockGetCachedTranslation;
  static cacheTranslation = mockCacheTranslation;
}

// Export the mock functions for direct access in tests
module.exports = {
  __esModule: true,
  default: MockTranslationCache,
  getCachedTranslation: mockGetCachedTranslation,
  cacheTranslation: mockCacheTranslation
};

// Also export the mock functions for direct access in tests
module.exports.mockGetCachedTranslation = mockGetCachedTranslation;
module.exports.mockCacheTranslation = mockCacheTranslation;
