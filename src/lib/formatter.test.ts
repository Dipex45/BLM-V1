import { formatCurrency, truncateId } from './formatter';

describe('Formatter Utilities', () => {
  test('formatCurrency should format NGN correctly', () => {
    expect(formatCurrency(123456, 'NGN', '₦')).toBe('₦ 123,456.00');
  });

  test('formatCurrency should format USD correctly', () => {
    expect(formatCurrency(1234.56, 'USD', '$')).toBe('$ 1,234.56');
  });

  test('truncateId should slice the end of string and uppercase it', () => {
    expect(truncateId('abcdef123456')).toBe('123456');
    expect(truncateId('abc', 2)).toBe('BC');
  });

  test('truncateId should handle empty string', () => {
    expect(truncateId('')).toBe('');
  });
});
