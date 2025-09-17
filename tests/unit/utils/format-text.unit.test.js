const { formatTextForDisplay } = require('../../../src/utils/format-text');

describe('formatTextForDisplay', function() {
  it('should trim whitespace from text', function() {
    expect(formatTextForDisplay('  hello  ')).toBe('hello');
  });

  it('should return empty string for non-string input', function() {
    expect(formatTextForDisplay(null)).toBe('');
    expect(formatTextForDisplay(undefined)).toBe('');
    expect(formatTextForDisplay(123)).toBe('');
    expect(formatTextForDisplay({})).toBe('');
  });

  it('should truncate long text with ellipsis', function() {
    const longText = 'a'.repeat(150);
    const result = formatTextForDisplay(longText, 100);
    expect(result).toHaveLength(103); // 100 + '...'
    expect(result).toMatch(/\.\.\.$/);
  });

  it('should not truncate text shorter than max length', function() {
    const text = 'Hello, world!';
    expect(formatTextForDisplay(text, 50)).toBe(text);
  });
});
