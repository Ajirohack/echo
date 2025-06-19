const { formatTextForDisplay } = require('../../../src/utils/format-text');

describe('formatTextForDisplay', () => {
  test('trims whitespace from text', () => {
    expect(formatTextForDisplay('  hello  ')).toBe('hello');
  });

  test('returns empty string for non-string input', () => {
    expect(formatTextForDisplay(null)).toBe('');
    expect(formatTextForDisplay(undefined)).toBe('');
    expect(formatTextForDisplay(123)).toBe('');
    expect(formatTextForDisplay({})).toBe('');
  });

  test('truncates long text with ellipsis', () => {
    const longText = 'a'.repeat(150);
    const result = formatTextForDisplay(longText, 100);
    expect(result.length).toBe(103); // 100 + '...'
    expect(result.endsWith('...')).toBe(true);
  });

  test('does not truncate text shorter than max length', () => {
    const text = 'Hello, world!';
    expect(formatTextForDisplay(text, 50)).toBe(text);
  });
});
