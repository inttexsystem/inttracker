const CNPJ_LENGTH = 14;
const DV1_WEIGHTS: readonly number[] = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
const DV2_WEIGHTS: readonly number[] = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

function computeDv(base: readonly number[], weights: readonly number[]): number {
  let sum = 0;
  for (let i = 0; i < base.length; i++) {
    sum += base[i] * weights[i];
  }
  const remainder = sum % 11;
  return remainder < 2 ? 0 : 11 - remainder;
}

export function normalizeCnpj(raw: unknown): string {
  if (raw == null) return '';
  if (typeof raw !== 'string') return '';
  const stripped = raw.replace(/[.\/\- ]/g, '');
  if (/[^\d]/.test(stripped)) return '';
  return stripped;
}

export function isValidCnpj(value: string | null | undefined): boolean {
  if (value == null || typeof value !== 'string') return false;
  if (value.length !== CNPJ_LENGTH) return false;
  if (!/^\d{14}$/.test(value)) return false;
  const first = value.charAt(0);
  if (first.repeat(CNPJ_LENGTH) === value) return false;
  const digits: number[] = new Array(CNPJ_LENGTH);
  for (let i = 0; i < CNPJ_LENGTH; i++) {
    digits[i] = value.charCodeAt(i) - 48;
  }
  if (computeDv(digits.slice(0, 12), DV1_WEIGHTS) !== digits[12]) return false;
  if (computeDv(digits.slice(0, 13), DV2_WEIGHTS) !== digits[13]) return false;
  return true;
}

export function extractValidCnpj(raw: unknown): string | null {
  const normalized = normalizeCnpj(raw);
  if (normalized === '') return null;
  if (!isValidCnpj(normalized)) return null;
  return normalized;
}
