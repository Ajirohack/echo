/**
 * Simple test to verify Jest setup
 */

describe('Simple Test', () => {
  it('should pass a basic test', () => {
    expect(1 + 1).toBe(2);
  });

  it('should handle basic JavaScript features', () => {
    const obj = { name: 'test' };
    expect(obj.name).toBe('test');
  });
});
