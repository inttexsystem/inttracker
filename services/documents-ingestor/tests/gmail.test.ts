import { describe, it, expect } from 'vitest';
import { isAttachmentCandidate, buildQuery, normalizeEmailReceivedAt, normalizeSenderEmail } from '../src/connectors/gmail.js';

describe('gmail attachment filter', () => {
  it('accepts PDF by mime', () => {
    expect(isAttachmentCandidate('nota.pdf', 'application/pdf')).toBe(true);
  });

  it('accepts XML by mime', () => {
    expect(isAttachmentCandidate('nota.xml', 'application/xml')).toBe(true);
  });

  it('accepts XML by mime text/xml', () => {
    expect(isAttachmentCandidate('a.xml', 'text/xml')).toBe(true);
  });

  it('accepts PDF by extension even with unknown mime', () => {
    expect(isAttachmentCandidate('a.pdf', 'application/octet-stream')).toBe(true);
  });

  it('accepts XML by extension even with unknown mime', () => {
    expect(isAttachmentCandidate('a.xml', 'application/octet-stream')).toBe(true);
  });

  it('rejects non-PDF/XML', () => {
    expect(isAttachmentCandidate('image.png', 'image/png')).toBe(false);
    expect(isAttachmentCandidate('doc.docx', 'application/msword')).toBe(false);
    expect(isAttachmentCandidate('data.json', 'application/json')).toBe(false);
  });

  it('is case-insensitive on extension', () => {
    expect(isAttachmentCandidate('NOTA.PDF', 'application/octet-stream')).toBe(true);
    expect(isAttachmentCandidate('NOTA.XML', 'application/octet-stream')).toBe(true);
  });
});

describe('buildQuery', () => {
  it('composes base query with has:attachment, filename filters and after date', () => {
    const q = buildQuery(7);
    expect(q).toContain('has:attachment');
    expect(q).toContain('(filename:pdf OR filename:xml)');
    expect(q).toMatch(/after:\d{4}\/\d{2}\/\d{2}/);
  });

  it('appends extra query to base', () => {
    const q = buildQuery(7, 'subject:"SMOKE TEST"');
    expect(q).toContain('has:attachment');
    expect(q).toContain('subject:"SMOKE TEST"');
    expect(q).toMatch(/after:\d{4}\/\d{2}\/\d{2}/);
  });

  it('does NOT remove base filters when extra query is present', () => {
    const q = buildQuery(7, 'subject:"SMOKE TEST"');
    expect(q).toContain('has:attachment');
    expect(q).toContain('(filename:pdf OR filename:xml)');
  });

  it('ignores empty/whitespace extra query', () => {
    const q1 = buildQuery(7, '');
    const q2 = buildQuery(7, '   ');
    expect(q1).not.toContain('  ');
    expect(q2).not.toContain('  ');
  });

  it('extra query is appended to the end of the base query', () => {
    const q = buildQuery(7, 'subject:"SMOKE TEST"');
    expect(q.endsWith('subject:"SMOKE TEST"')).toBe(true);
  });
});

describe('Gmail received timestamp normalization', () => {
  it('uses internalDate epoch milliseconds as the authoritative UTC value', () => {
    expect(normalizeEmailReceivedAt('1783708245123', 'Mon, 01 Jan 2024 00:00:00 +0000')).toEqual({
      emailReceivedAt: '2026-07-10T18:30:45.123Z',
      emailReceivedAtSource: 'gmail_internal_date',
      emailReceivedAtEstimated: false,
    });
  });

  it('uses Date header only when internalDate is absent or invalid', () => {
    expect(normalizeEmailReceivedAt('invalid', 'Thu, 09 Jul 2026 10:00:00 -0300')).toEqual({
      emailReceivedAt: '2026-07-09T13:00:00.000Z',
      emailReceivedAtSource: 'header_date',
      emailReceivedAtEstimated: true,
    });
  });

  it('returns null rather than an ingestion-time fallback when neither source is usable', () => {
    expect(normalizeEmailReceivedAt(undefined, 'not a date')).toEqual({
      emailReceivedAt: null,
      emailReceivedAtSource: null,
      emailReceivedAtEstimated: false,
    });
  });
});

describe('Gmail sender email normalization', () => {
  it.each([
    ['Fornecedor <FORNECEDOR@Empresa.com.br>', 'fornecedor@empresa.com.br'],
    ['fornecedor@empresa.com.br', 'fornecedor@empresa.com.br'],
    ['"Fornecedor Ltda" <fornecedor@empresa.com.br>', 'fornecedor@empresa.com.br'],
    ['  FORNECEDOR@EMPRESA.COM.BR  ', 'fornecedor@empresa.com.br'],
    ['Fornecedor sem email', null],
  ])('normalizes %s', (value, expected) => {
    expect(normalizeSenderEmail(value)).toBe(expected);
  });
});
