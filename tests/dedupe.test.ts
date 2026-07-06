import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildDedupeKey } from '../src/core/dedupe.js';

describe('dedupe', () => {
  it('builds correct dedupe key', () => {
    const key = buildDedupeKey('msg123', 'att456', 'abc123def456');
    expect(key).toBe('msg123:att456:abc123def456');
  });

  it('produces different keys for different message ids', () => {
    const k1 = buildDedupeKey('msg1', 'att1', 'hash1');
    const k2 = buildDedupeKey('msg2', 'att1', 'hash1');
    expect(k1).not.toBe(k2);
  });

  it('produces different keys for different attachment ids', () => {
    const k1 = buildDedupeKey('msg1', 'att1', 'hash1');
    const k2 = buildDedupeKey('msg1', 'att2', 'hash1');
    expect(k1).not.toBe(k2);
  });

  it('produces different keys for different hashes', () => {
    const k1 = buildDedupeKey('msg1', 'att1', 'hash1');
    const k2 = buildDedupeKey('msg1', 'att1', 'hash2');
    expect(k1).not.toBe(k2);
  });

  it('produces same key for same inputs', () => {
    const k1 = buildDedupeKey('msg1', 'att1', 'hash1');
    const k2 = buildDedupeKey('msg1', 'att1', 'hash1');
    expect(k1).toBe(k2);
  });
});
