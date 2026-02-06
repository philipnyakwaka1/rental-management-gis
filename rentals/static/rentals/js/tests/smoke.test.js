// Simple smoke test to verify Jest is working
describe('Jest is working', () => {
  test('basic math', () => {
    expect(1 + 1).toBe(2);
  });

  test('string concatenation', () => {
    expect('hello' + ' world').toBe('hello world');
  });
});
