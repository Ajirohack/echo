describe('Example Test Suite', () => {
  it('should pass a simple test', () => {
    expect(true).toBe(true);
  });

  it('should demonstrate jest mock', () => {
    const mockFn = jest.fn().mockReturnValue(42);
    expect(mockFn()).toBe(42);
  });
});
