import { describe, it, expect } from 'vitest';
import { pdfSubfolder, manifestPath } from '../src/core/paths.js';

describe('paths', () => {
  it('maps nf_pdf to nf/', () => {
    expect(pdfSubfolder('nf_pdf')).toBe('nf');
  });

  it('maps nf_xml to nf/', () => {
    expect(pdfSubfolder('nf_xml')).toBe('nf');
  });

  it('maps romaneio to romaneio/', () => {
    expect(pdfSubfolder('romaneio')).toBe('romaneio');
  });

  it('maps desconhecido to desconhecido/', () => {
    expect(pdfSubfolder('desconhecido')).toBe('desconhecido');
  });

  it('manifestPath ends with manifest.json', () => {
    const p = manifestPath('PED-25-2026');
    expect(p.endsWith('manifest.json')).toBe(true);
    expect(p).toContain('PED-25-2026');
  });
});
