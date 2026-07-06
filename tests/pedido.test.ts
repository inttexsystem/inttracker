import { describe, it, expect } from 'vitest';
import { normalizePedido } from '../src/core/pedido.js';

describe('normalizePedido', () => {
  it('normalizes PED-25-2026', () => {
    expect(normalizePedido('PED-25-2026')).toBe('PED-25-2026');
  });

  it('normalizes 25/2026', () => {
    expect(normalizePedido('25/2026')).toBe('PED-25-2026');
  });

  it('normalizes pedido 25/2026', () => {
    expect(normalizePedido('pedido 25/2026')).toBe('PED-25-2026');
  });

  it('normalizes PED 25/2026', () => {
    expect(normalizePedido('PED 25/2026')).toBe('PED-25-2026');
  });

  it('normalizes lowercase ped 25/2026', () => {
    expect(normalizePedido('ped 25/2026')).toBe('PED-25-2026');
  });

  it('normalizes 5/2026 with single digit', () => {
    expect(normalizePedido('5/2026')).toBe('PED-05-2026');
  });

  it('returns null for invalid input', () => {
    expect(normalizePedido('')).toBeNull();
    expect(normalizePedido('abc')).toBeNull();
    expect(normalizePedido('123')).toBeNull();
  });
});
