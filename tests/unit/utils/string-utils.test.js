const { capitalize, truncate, safeJsonParse } = require('../../../src/utils/string-utils');

describe('String Utils', function() {
  describe('capitalize', function() {
    it('should capitalize the first letter of a string', function() {
      expect(capitalize('hello')).toBe('Hello');
      expect(capitalize('world')).toBe('World');
    });

    it('should handle empty string', function() {
      expect(capitalize('')).toBe('');
    });

    it('should handle non-string inputs', function() {
      expect(capitalize(null)).toBe('');
      expect(capitalize(undefined)).toBe('');
      expect(capitalize(123)).toBe('');
    });
  });

  describe('truncate', function() {
    it('should truncate strings longer than maxLength', function() {
      expect(truncate('Hello, world!', 5)).toBe('Hello...');
      expect(truncate('Testing', 4, '***')).toBe('Test***');
    });

    it('should not truncate strings shorter than maxLength', function() {
      expect(truncate('Hi', 5)).toBe('Hi');
    });

    it('should handle custom ellipsis', function() {
      expect(truncate('Hello', 3, '...')).toBe('Hel...');
      expect(truncate('Hello', 3, '')).toBe('Hel');
    });
  });

  describe('safeJsonParse', function() {
    it('should parse valid JSON strings', function() {
      expect(safeJsonParse('{"key": "value"}')).toEqual({ key: 'value' });
      expect(safeJsonParse('[1, 2, 3]')).toEqual([1, 2, 3]);
    });

    it('should return default value for invalid JSON', function() {
      expect(safeJsonParse('not json', { default: 'value' }))
        .toEqual({ default: 'value' });
      expect(safeJsonParse('', 'fallback')).toBe('fallback');
    });

    it('should return empty object by default when parsing fails', function() {
      expect(safeJsonParse('invalid')).toEqual({});
    });
  });
});
