const { expect } = require('chai');
const { capitalize, truncate, safeJsonParse } = require('../../../src/utils/string-utils');

describe('String Utils', function() {
  describe('capitalize', function() {
    it('should capitalize the first letter of a string', function() {
      expect(capitalize('hello')).to.equal('Hello');
      expect(capitalize('world')).to.equal('World');
    });

    it('should handle empty string', function() {
      expect(capitalize('')).to.equal('');
    });

    it('should handle non-string inputs', function() {
      expect(capitalize(null)).to.equal('');
      expect(capitalize(undefined)).to.equal('');
      expect(capitalize(123)).to.equal('');
    });
  });

  describe('truncate', function() {
    it('should truncate strings longer than maxLength', function() {
      expect(truncate('Hello, world!', 5)).to.equal('Hello...');
      expect(truncate('Testing', 4, '***')).to.equal('Test***');
    });

    it('should not truncate strings shorter than maxLength', function() {
      expect(truncate('Hi', 5)).to.equal('Hi');
    });

    it('should handle custom ellipsis', function() {
      expect(truncate('Hello', 3, '...')).to.equal('Hel...');
      expect(truncate('Hello', 3, '')).to.equal('Hel');
    });
  });

  describe('safeJsonParse', function() {
    it('should parse valid JSON strings', function() {
      expect(safeJsonParse('{"key": "value"}')).to.deep.equal({ key: 'value' });
      expect(safeJsonParse('[1, 2, 3]')).to.deep.equal([1, 2, 3]);
    });

    it('should return default value for invalid JSON', function() {
      expect(safeJsonParse('not json', { default: 'value' }))
        .to.deep.equal({ default: 'value' });
      expect(safeJsonParse('', 'fallback')).to.equal('fallback');
    });

    it('should return empty object by default when parsing fails', function() {
      expect(safeJsonParse('invalid')).to.deep.equal({});
    });
  });
});
