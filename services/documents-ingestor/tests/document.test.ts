import { describe, it, expect } from 'vitest';
import { buildStorageUri, fromLegacyTipo, toLegacyTipo, formatoFromMimeType } from '../src/types/document.js';
import type { TipoDocumentoLegado } from '../src/types/document.js';

describe('document types', () => {
  it('buildStorageUri produces gdrive://file/<id>', () => {
    expect(buildStorageUri('abc123')).toBe('gdrive://file/abc123');
  });

  describe('fromLegacyTipo', () => {
    it('converts nf_xml to nf + xml + desconhecida', () => {
      const r = fromLegacyTipo('nf_xml');
      expect(r.tipoDocumento).toBe('nf');
      expect(r.formato).toBe('xml');
      expect(r.direcaoNf).toBe('desconhecida');
    });

    it('converts nf_pdf to nf + pdf + desconhecida', () => {
      const r = fromLegacyTipo('nf_pdf');
      expect(r.tipoDocumento).toBe('nf');
      expect(r.formato).toBe('pdf');
      expect(r.direcaoNf).toBe('desconhecida');
    });

    it('converts romaneio to romaneio + pdf + null', () => {
      const r = fromLegacyTipo('romaneio');
      expect(r.tipoDocumento).toBe('romaneio');
      expect(r.formato).toBe('pdf');
      expect(r.direcaoNf).toBeNull();
    });

    it('converts desconhecido to desconhecido + desconhecido + null', () => {
      const r = fromLegacyTipo('desconhecido');
      expect(r.tipoDocumento).toBe('desconhecido');
      expect(r.formato).toBe('desconhecido');
      expect(r.direcaoNf).toBeNull();
    });
  });

  describe('toLegacyTipo', () => {
    it('converts nf + xml to nf_xml', () => {
      expect(toLegacyTipo({ tipoDocumento: 'nf', formato: 'xml' })).toBe('nf_xml');
    });

    it('converts nf + pdf to nf_pdf', () => {
      expect(toLegacyTipo({ tipoDocumento: 'nf', formato: 'pdf' })).toBe('nf_pdf');
    });

    it('converts nf + desconhecido to nf_pdf (default)', () => {
      expect(toLegacyTipo({ tipoDocumento: 'nf', formato: 'desconhecido' })).toBe('nf_pdf');
    });

    it('passes through romaneio', () => {
      expect(toLegacyTipo({ tipoDocumento: 'romaneio', formato: 'pdf' })).toBe('romaneio');
    });

    it('passes through desconhecido', () => {
      expect(toLegacyTipo({ tipoDocumento: 'desconhecido', formato: 'desconhecido' })).toBe('desconhecido');
    });
  });

  describe('formatoFromMimeType', () => {
    it('returns xml for text/xml', () => {
      expect(formatoFromMimeType('text/xml')).toBe('xml');
    });

    it('returns xml for application/xml', () => {
      expect(formatoFromMimeType('application/xml')).toBe('xml');
    });

    it('returns pdf for application/pdf', () => {
      expect(formatoFromMimeType('application/pdf')).toBe('pdf');
    });

    it('returns desconhecido for unknown mime types', () => {
      expect(formatoFromMimeType('image/png')).toBe('desconhecido');
      expect(formatoFromMimeType('application/octet-stream')).toBe('desconhecido');
    });
  });

  describe('fromLegacyTipo round-trip', () => {
    it('all legacy values survive round-trip', () => {
      const legacyValues: readonly TipoDocumentoLegado[] = ['nf_xml', 'nf_pdf', 'romaneio', 'desconhecido'] as const;
      for (const legacy of legacyValues) {
        const tax = fromLegacyTipo(legacy);
        const back = toLegacyTipo({ tipoDocumento: tax.tipoDocumento, formato: tax.formato });
        expect(back).toBe(legacy);
      }
    });
  });
});
