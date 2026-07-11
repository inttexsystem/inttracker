import { describe, it, expect } from 'vitest';
import { maskId, maskEmail, maskSubject, maskLink } from '../src/core/mask.js';

describe('mask utilities (text-mode safety)', () => {
  it('maskId short values are returned as-is', () => {
    expect(maskId('abc')).toBe('abc');
    expect(maskId('abcdefgh')).toBe('abcdefgh');
  });

  it('maskId long values are partially masked', () => {
    const result = maskId('1234567890abcdef1234567890abcdef');
    expect(result).toMatch(/^1234\*+cdef$/);
    expect(result).not.toContain('1234567890');
  });

  it('maskId null/empty returns empty string', () => {
    expect(maskId(null)).toBe('');
    expect(maskId(undefined)).toBe('');
    expect(maskId('')).toBe('');
  });

  it('maskEmail masks local part but keeps domain', () => {
    expect(maskEmail('john.doe@example.com')).toBe('jo***@example.com');
    expect(maskEmail('a@example.com')).toBe('a***@example.com');
    expect(maskEmail('ab@example.com')).toBe('ab***@example.com');
  });

  it('maskEmail handles null/non-email', () => {
    expect(maskEmail(null)).toBe('');
    const masked = maskEmail('not-an-email');
    expect(masked).toContain('*');
    expect(masked).not.toBe('not-an-email');
  });

  it('maskSubject truncates long subjects', () => {
    const long = 'a'.repeat(100);
    const result = maskSubject(long, 60);
    expect(result.length).toBe(60);
    expect(result.endsWith('…')).toBe(true);
  });

  it('maskSubject returns short subjects as-is', () => {
    expect(maskSubject('NF-e 12345')).toBe('NF-e 12345');
    expect(maskSubject(null)).toBe('');
  });

  it('maskLink masks Drive file IDs in URLs', () => {
    const url = 'https://drive.google.com/file/d/1abc2def3ghi4jkl5mno6pqr7stu8vwx9/view';
    const result = maskLink(url);
    expect(result).toContain('drive.google.com');
    expect(result).not.toContain('1abc2def3ghi4jkl5mno6pqr7stu8vwx9');
    expect(result).toMatch(/\*+/);
  });
});
