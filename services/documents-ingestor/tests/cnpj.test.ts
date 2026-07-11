import { describe, it, expect } from 'vitest';
import {
  normalizeCnpj,
  isValidCnpj,
  extractValidCnpj,
} from '../src/core/cnpj.js';

const CNPJ_CANONICAL_A = '11222333000181';
const CNPJ_CANONICAL_B = '11444777000161';

describe('normalizeCnpj', () => {
  it('strips punctuation only', () => {
    expect(normalizeCnpj('11.222.333/0001-81')).toBe('11222333000181');
  });

  it('returns digits-only string unchanged', () => {
    expect(normalizeCnpj('11222333000181')).toBe('11222333000181');
  });

  it('returns empty string for null', () => {
    expect(normalizeCnpj(null)).toBe('');
  });

  it('returns empty string for undefined', () => {
    expect(normalizeCnpj(undefined)).toBe('');
  });

  it('returns empty string for non-string numeric input', () => {
    expect(normalizeCnpj(123456)).toBe('');
  });

  it('returns empty string for empty string', () => {
    expect(normalizeCnpj('')).toBe('');
  });

  it('returns empty for letters (validation must reject, not normalize)', () => {
    expect(normalizeCnpj('abc')).toBe('');
  });

  it('does not alter internal structure (no trimming, no replacement)', () => {
    expect(normalizeCnpj('  11 222 333 0001 81  ')).toBe('11222333000181');
  });

  it('returns empty for letters mixed with punctuation', () => {
    expect(normalizeCnpj('CNPJ11.222.333/0001-81')).toBe('');
  });

  it('returns empty for non-traditional special characters', () => {
    expect(normalizeCnpj('11#222')).toBe('');
    expect(normalizeCnpj('11_222')).toBe('');
    expect(normalizeCnpj('11*222')).toBe('');
  });

  it('returns empty for digits with trailing letter', () => {
    expect(normalizeCnpj('1122233300018A')).toBe('');
  });
});

describe('isValidCnpj', () => {
  it('accepts canonical valid CNPJ A', () => {
    expect(isValidCnpj(CNPJ_CANONICAL_A)).toBe(true);
  });

  it('accepts canonical valid CNPJ B', () => {
    expect(isValidCnpj(CNPJ_CANONICAL_B)).toBe(true);
  });

  it('rejects null', () => {
    expect(isValidCnpj(null)).toBe(false);
  });

  it('rejects undefined', () => {
    expect(isValidCnpj(undefined)).toBe(false);
  });

  it('rejects empty string', () => {
    expect(isValidCnpj('')).toBe(false);
  });

  it('rejects CNPJ with fewer than 14 digits', () => {
    expect(isValidCnpj('12345')).toBe(false);
  });

  it('rejects CNPJ with more than 14 digits', () => {
    expect(isValidCnpj('123456789012345')).toBe(false);
  });

  it('rejects CNPJ with punctuation', () => {
    expect(isValidCnpj('11.222.333/0001-81')).toBe(false);
  });

  it('rejects alphanumeric CNPJ', () => {
    expect(isValidCnpj('A1222333000181')).toBe(false);
    expect(isValidCnpj('1122233300018A')).toBe(false);
  });

  it('rejects CNPJ with invalid DV1 (preserved base, broken DV1)', () => {
    expect(isValidCnpj('22222333000172')).toBe(false);
  });

  it('rejects CNPJ with invalid DV2 (preserved base, broken DV2)', () => {
    expect(isValidCnpj('11222333000180')).toBe(false);
  });

  it('rejects all-zero repeated sequence', () => {
    expect(isValidCnpj('00000000000000')).toBe(false);
  });

  it('rejects all-one repeated sequence', () => {
    expect(isValidCnpj('11111111111111')).toBe(false);
  });

  it('rejects all-nine repeated sequence', () => {
    expect(isValidCnpj('99999999999999')).toBe(false);
  });

  it('rejects non-string input', () => {
    expect(isValidCnpj(11222333000181 as unknown as string)).toBe(false);
    expect(isValidCnpj({} as unknown as string)).toBe(false);
  });

  it('rejects another previously-pseudo-valid sample', () => {
    expect(isValidCnpj('12345678000190')).toBe(false);
    expect(isValidCnpj('98765432000110')).toBe(false);
  });
});

describe('extractValidCnpj', () => {
  it('returns digits-only valid CNPJ for punctuated valid input', () => {
    expect(extractValidCnpj('11.222.333/0001-81')).toBe('11222333000181');
  });

  it('returns valid CNPJ for already-clean input', () => {
    expect(extractValidCnpj('11444777000161')).toBe('11444777000161');
  });

  it('returns null for null', () => {
    expect(extractValidCnpj(null)).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(extractValidCnpj('')).toBeNull();
  });

  it('returns null for whitespace-only string', () => {
    expect(extractValidCnpj('   ')).toBeNull();
  });

  it('returns null for alphanumeric input', () => {
    expect(extractValidCnpj('abc')).toBeNull();
    expect(extractValidCnpj('CNPJ11.222.333/0001-81')).toBeNull();
  });

  it('returns null for short CNPJ', () => {
    expect(extractValidCnpj('12345')).toBeNull();
  });

  it('returns null for long CNPJ', () => {
    expect(extractValidCnpj('123456789012345')).toBeNull();
  });

  it('returns null for repeated sequence', () => {
    expect(extractValidCnpj('00000000000000')).toBeNull();
    expect(extractValidCnpj('11111111111111')).toBeNull();
  });

  it('returns null for invalid DV (broken checksum)', () => {
    expect(extractValidCnpj('22222333000172')).toBeNull();
    expect(extractValidCnpj('11222333000180')).toBeNull();
  });

  it('returns null for non-string input', () => {
    expect(extractValidCnpj(11222333000181)).toBeNull();
    expect(extractValidCnpj({})).toBeNull();
  });

  it('does not duplicate checksum calculation per call (idempotent)', () => {
    const result = extractValidCnpj('11.222.333/0001-81');
    expect(result).toBe('11222333000181');
    expect(extractValidCnpj(result)).toBe('11222333000181');
  });
});

describe('cnpj helper integration contract', () => {
  it('emits same DV weights as db/44 is_valid_cnpj', () => {
    expect(isValidCnpj('11222333000181')).toBe(true);
    expect(isValidCnpj('11444777000161')).toBe(true);
  });

  it('preserves canonical digits after punctuation normalization', () => {
    const a = extractValidCnpj('11.222.333/0001-81');
    const b = extractValidCnpj('11222333000181');
    expect(a).toBe(b);
  });

  it('treats all input kinds (string/null/undefined/number) defensively', () => {
    expect(() => isValidCnpj(null as unknown as string)).not.toThrow();
    expect(() => isValidCnpj(undefined as unknown as string)).not.toThrow();
    expect(() => extractValidCnpj(null)).not.toThrow();
    expect(() => extractValidCnpj(undefined)).not.toThrow();
    expect(() => normalizeCnpj(undefined)).not.toThrow();
  });
});
