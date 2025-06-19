const { expect } = require('chai');
const { formatTextForDisplay } = require('../../../src/utils/format-text');

describe('formatTextForDisplay', function() {
  it('should trim whitespace from text', function() {
    expect(formatTextForDisplay('  hello  ')).to.equal('hello');
  });

  it('should return empty string for non-string input', function() {
    expect(formatTextForDisplay(null)).to.equal('');
    expect(formatTextForDisplay(undefined)).to.equal('');
    expect(formatTextForDisplay(123)).to.equal('');
    expect(formatTextForDisplay({})).to.equal('');
  });

  it('should truncate long text with ellipsis', function() {
    const longText = 'a'.repeat(150);
    const result = formatTextForDisplay(longText, 100);
    expect(result).to.have.lengthOf(103); // 100 + '...'
    expect(result).to.match(/\.\.\.$/);
  });

  it('should not truncate text shorter than max length', function() {
    const text = 'Hello, world!';
    expect(formatTextForDisplay(text, 50)).to.equal(text);
  });
});
