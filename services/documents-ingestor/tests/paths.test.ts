import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  tipoSubfolder,
  pendenteDrivePath,
  pedidoDocumentDrivePath,
  pedidoSubfolderDrivePath,
  manifestDrivePath,
  taxonomiaDatePath,
  recebidoDrivePath,
  pedidoTaxonomiaDocumentDrivePath,
  pedidoTaxonomiaFolderDrivePath,
} from '../src/core/paths.js';

describe('tipoSubfolder', () => {
  it('nf + entrada → nf/entrada', () => {
    expect(tipoSubfolder('nf', 'entrada')).toBe('nf/entrada');
  });

  it('nf + saida → nf/saida', () => {
    expect(tipoSubfolder('nf', 'saida')).toBe('nf/saida');
  });

  it('nf + desconhecida → nf/desconhecida', () => {
    expect(tipoSubfolder('nf', 'desconhecida')).toBe('nf/desconhecida');
  });

  it('nf + null → nf/desconhecida', () => {
    expect(tipoSubfolder('nf', null)).toBe('nf/desconhecida');
  });

  it('nf + undefined → nf/desconhecida', () => {
    expect(tipoSubfolder('nf')).toBe('nf/desconhecida');
  });

  it('romaneio → romaneio', () => {
    expect(tipoSubfolder('romaneio')).toBe('romaneio');
  });

  it('desconhecido → desconhecido', () => {
    expect(tipoSubfolder('desconhecido')).toBe('desconhecido');
  });
});

describe('pendenteDrivePath (G3)', () => {
  it('uses pendentes/YYYY-MM-DD/{tipo}/{direcao} format', () => {
    const p = pendenteDrivePath({
      date: '2026-07-06',
      tipoDocumento: 'nf',
      direcaoNf: 'entrada',
    });
    expect(p.backend).toBe('google_drive');
    expect(p.logicalPath).toBe('Ravatex Documents Ingestor/pendentes/2026-07-06/nf/entrada');
  });

  it('does NOT contain email-<id>', () => {
    const p = pendenteDrivePath({
      tipoDocumento: 'romaneio',
    });
    expect(p.logicalPath).not.toContain('email-');
  });

  it('nf saida produces correct path', () => {
    const p = pendenteDrivePath({
      date: '2026-01-15',
      tipoDocumento: 'nf',
      direcaoNf: 'saida',
    });
    expect(p.logicalPath).toContain('/nf/saida');
  });

  it('nf desconhecida produces correct path', () => {
    const p = pendenteDrivePath({
      tipoDocumento: 'nf',
      direcaoNf: 'desconhecida',
    });
    expect(p.logicalPath).toContain('/nf/desconhecida');
  });

  it('romaneio produces correct path', () => {
    const p = pendenteDrivePath({
      tipoDocumento: 'romaneio',
    });
    expect(p.logicalPath).toContain('/romaneio');
  });

  it('desconhecido produces correct path', () => {
    const p = pendenteDrivePath({
      tipoDocumento: 'desconhecido',
    });
    expect(p.logicalPath).toContain('/desconhecido');
  });

  it('includes filename when provided', () => {
    const p = pendenteDrivePath({
      tipoDocumento: 'nf',
      direcaoNf: 'entrada',
      filename: 'nfe.xml',
    });
    expect(p.logicalPath).toContain('/nfe.xml');
  });
});

describe('pedidoDocumentDrivePath (G3)', () => {
  it('uses pedidos/PED/YYYY-MM-DD/{tipo}/{direcao}/filename', () => {
    const p = pedidoDocumentDrivePath({
      pedidoManual: 'PED-25-2026',
      date: '2026-07-06',
      tipoDocumento: 'nf',
      direcaoNf: 'saida',
      filename: 'nfe.xml',
    });
    expect(p.logicalPath).toBe(
      'Ravatex Documents Ingestor/pedidos/PED-25-2026/2026-07-06/nf/saida/nfe.xml'
    );
  });

  it('romaneio has no direcao subfolder', () => {
    const p = pedidoDocumentDrivePath({
      pedidoManual: 'PED-01-2026',
      tipoDocumento: 'romaneio',
      filename: 'r.pdf',
    });
    expect(p.logicalPath).toContain('/romaneio/r.pdf');
    expect(p.logicalPath).not.toContain('/romaneio/entrada');
    expect(p.logicalPath).not.toContain('/romaneio/saida');
    expect(p.logicalPath).not.toContain('/romaneio/desconhecida');
  });

  it('contains pedido prefix', () => {
    const p = pedidoDocumentDrivePath({
      pedidoManual: 'PED-50-2026',
      tipoDocumento: 'nf',
      direcaoNf: 'entrada',
      filename: 'n.pdf',
    });
    expect(p.logicalPath).toContain('PED-50-2026');
  });
});

describe('pedidoSubfolderDrivePath (G3)', () => {
  it('is a folder, no filename', () => {
    const p = pedidoSubfolderDrivePath({
      pedidoManual: 'PED-25-2026',
      tipoDocumento: 'nf',
      direcaoNf: 'entrada',
    });
    expect(p.logicalPath).toMatch(/\/nf\/entrada$/);
    expect(p.logicalPath).toContain('PED-25-2026');
  });

  it('romaneio subfolder is flat', () => {
    const p = pedidoSubfolderDrivePath({
      pedidoManual: 'PED-01-2026',
      tipoDocumento: 'romaneio',
    });
    expect(p.logicalPath).toMatch(/\/romaneio$/);
  });
});

describe('manifestDrivePath (unchanged)', () => {
  it('ends with manifest.json under Pedido folder', () => {
    const p = manifestDrivePath('PED-25-2026');
    expect(p.backend).toBe('google_drive');
    expect(p.logicalPath).toMatch(/pedidos\/PED-25-2026\/manifest\.json$/);
  });
});

describe('paths are NOT absolute disk paths', () => {
  it('logicalPath does not contain drive letters', () => {
    const p = pedidoDocumentDrivePath({
      pedidoManual: 'PED-25-2026',
      tipoDocumento: 'nf',
      direcaoNf: 'entrada',
      filename: 'n.pdf',
    });
    expect(p.logicalPath.includes(':\\')).toBe(false);
    expect(p.logicalPath.startsWith('/')).toBe(false);
  });
});

describe('taxonomiaDatePath (G12-B)', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('produces YYYY/MM/DD with slashes, not hyphens', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-08T12:00:00Z'));
    const result = taxonomiaDatePath();
    expect(result).toBe('2026/07/08');
    expect(result).not.toContain('-');
  });

  it('accepts YYYY-MM-DD input and converts to YYYY/MM/DD', () => {
    const result = taxonomiaDatePath('2026-07-08');
    expect(result).toBe('2026/07/08');
  });

  it('accepts YYYY/MM/DD input as-is', () => {
    const result = taxonomiaDatePath('2026/07/08');
    expect(result).toBe('2026/07/08');
  });

  it('handles single-digit month/day without padding in input', () => {
    const result = taxonomiaDatePath('2026-7-8');
    expect(result).toBe('2026/7/8');
  });
});

describe('recebidoDrivePath (G12-B)', () => {
  it('uses Recebidos/YYYY/MM/DD/tipo/direcao format', () => {
    const p = recebidoDrivePath({
      date: '2026-07-08',
      tipoDocumento: 'nf',
      direcaoNf: 'entrada',
    });
    expect(p.backend).toBe('google_drive');
    expect(p.logicalPath).toBe('Ravatex Documents Ingestor/Recebidos/2026/07/08/nf/entrada');
  });

  it('nf saida produces correct path', () => {
    const p = recebidoDrivePath({
      date: '2026-01-15',
      tipoDocumento: 'nf',
      direcaoNf: 'saida',
    });
    expect(p.logicalPath).toContain('Recebidos');
    expect(p.logicalPath).toContain('/2026/01/15/nf/saida');
  });

  it('nf desconhecida produces correct path', () => {
    const p = recebidoDrivePath({
      tipoDocumento: 'nf',
      direcaoNf: 'desconhecida',
    });
    expect(p.logicalPath).toContain('/nf/desconhecida');
  });

  it('romaneio produces flat romaneio subfolder', () => {
    const p = recebidoDrivePath({
      tipoDocumento: 'romaneio',
    });
    expect(p.logicalPath).toContain('/romaneio');
    expect(p.logicalPath).not.toContain('/romaneio/entrada');
    expect(p.logicalPath).not.toContain('/romaneio/saida');
  });

  it('desconhecido produces correct path', () => {
    const p = recebidoDrivePath({
      tipoDocumento: 'desconhecido',
    });
    expect(p.logicalPath).toContain('/desconhecido');
  });

  it('uses Recebidos (capitalized), not recebidos', () => {
    const p = recebidoDrivePath({
      tipoDocumento: 'nf',
      direcaoNf: 'entrada',
    });
    expect(p.logicalPath).toContain('/Recebidos/');
    expect(p.logicalPath).not.toContain('/recebidos/');
  });

  it('date uses slashes, not hyphens', () => {
    const p = recebidoDrivePath({
      date: '2026-07-08',
      tipoDocumento: 'nf',
      direcaoNf: 'entrada',
    });
    expect(p.logicalPath).toContain('2026/07/08');
    expect(p.logicalPath).not.toContain('2026-07-08');
  });

  it('includes filename when provided', () => {
    const p = recebidoDrivePath({
      tipoDocumento: 'nf',
      direcaoNf: 'entrada',
      filename: 'nfe.xml',
    });
    expect(p.logicalPath).toContain('/nfe.xml');
  });

  it('does NOT use pendentes', () => {
    const p = recebidoDrivePath({
      tipoDocumento: 'nf',
      direcaoNf: 'entrada',
    });
    expect(p.logicalPath).not.toContain('pendentes');
  });
});

describe('pedidoTaxonomiaDocumentDrivePath (G12-B)', () => {
  it('uses Pedidos/PED/YYYY/MM/DD/tipo/direcao/filename', () => {
    const p = pedidoTaxonomiaDocumentDrivePath({
      pedidoManual: 'PED-25-2026',
      date: '2026-07-08',
      tipoDocumento: 'nf',
      direcaoNf: 'saida',
      filename: 'nfe.xml',
    });
    expect(p.backend).toBe('google_drive');
    expect(p.logicalPath).toBe(
      'Ravatex Documents Ingestor/Pedidos/PED-25-2026/2026/07/08/nf/saida/nfe.xml'
    );
  });

  it('uses Pedidos (capitalized), not pedidos', () => {
    const p = pedidoTaxonomiaDocumentDrivePath({
      pedidoManual: 'PED-01-2026',
      tipoDocumento: 'nf',
      direcaoNf: 'entrada',
      filename: 'n.pdf',
    });
    expect(p.logicalPath).toContain('/Pedidos/');
    expect(p.logicalPath).not.toContain('/pedidos/');
  });

  it('date uses slashes, not hyphens', () => {
    const p = pedidoTaxonomiaDocumentDrivePath({
      pedidoManual: 'PED-50-2026',
      date: '2026-12-25',
      tipoDocumento: 'romaneio',
      filename: 'r.pdf',
    });
    expect(p.logicalPath).toContain('2026/12/25');
    expect(p.logicalPath).not.toContain('2026-12-25');
  });

  it('romaneio has no direcao subfolder', () => {
    const p = pedidoTaxonomiaDocumentDrivePath({
      pedidoManual: 'PED-01-2026',
      tipoDocumento: 'romaneio',
      filename: 'r.pdf',
    });
    expect(p.logicalPath).toContain('/romaneio/r.pdf');
    expect(p.logicalPath).not.toContain('/romaneio/entrada');
    expect(p.logicalPath).not.toContain('/romaneio/saida');
  });
});

describe('pedidoTaxonomiaFolderDrivePath (G12-B)', () => {
  it('is a folder path with nested date, no filename', () => {
    const p = pedidoTaxonomiaFolderDrivePath({
      pedidoManual: 'PED-25-2026',
      date: '2026-07-08',
      tipoDocumento: 'nf',
      direcaoNf: 'entrada',
    });
    expect(p.logicalPath).toMatch(/\/nf\/entrada$/);
    expect(p.logicalPath).toContain('Pedidos/PED-25-2026');
    expect(p.logicalPath).toContain('2026/07/08');
  });

  it('romaneio subfolder is flat (no direcao)', () => {
    const p = pedidoTaxonomiaFolderDrivePath({
      pedidoManual: 'PED-01-2026',
      tipoDocumento: 'romaneio',
    });
    expect(p.logicalPath).toMatch(/\/romaneio$/);
  });

  it('uses Pedidos (capitalized)', () => {
    const p = pedidoTaxonomiaFolderDrivePath({
      pedidoManual: 'PED-99-2026',
      tipoDocumento: 'nf',
      direcaoNf: 'desconhecida',
    });
    expect(p.logicalPath).toContain('/Pedidos/');
  });
});

describe('G12-B paths are NOT absolute disk paths', () => {
  it('recebidoDrivePath does not contain drive letters', () => {
    const p = recebidoDrivePath({
      tipoDocumento: 'nf',
      direcaoNf: 'entrada',
    });
    expect(p.logicalPath.includes(':\\')).toBe(false);
    expect(p.logicalPath.startsWith('/')).toBe(false);
  });

  it('pedidoTaxonomiaDocumentDrivePath does not contain drive letters', () => {
    const p = pedidoTaxonomiaDocumentDrivePath({
      pedidoManual: 'PED-25-2026',
      tipoDocumento: 'nf',
      direcaoNf: 'entrada',
      filename: 'n.pdf',
    });
    expect(p.logicalPath.includes(':\\')).toBe(false);
    expect(p.logicalPath.startsWith('/')).toBe(false);
  });
});

describe('legacy builders unchanged (G12-B regression)', () => {
  it('pendenteDrivePath still uses pendentes with YYYY-MM-DD', () => {
    const p = pendenteDrivePath({
      date: '2026-07-06',
      tipoDocumento: 'nf',
      direcaoNf: 'entrada',
    });
    expect(p.logicalPath).toContain('pendentes');
    expect(p.logicalPath).toContain('2026-07-06');
    expect(p.logicalPath).not.toContain('2026/07/06');
  });

  it('pedidoDocumentDrivePath still uses pedidos (lowercase) with YYYY-MM-DD', () => {
    const p = pedidoDocumentDrivePath({
      pedidoManual: 'PED-25-2026',
      date: '2026-07-06',
      tipoDocumento: 'nf',
      direcaoNf: 'entrada',
      filename: 'nfe.xml',
    });
    expect(p.logicalPath).toContain('pedidos/PED-25-2026');
    expect(p.logicalPath).toContain('/2026-07-06/');
  });

  it('pedidoSubfolderDrivePath still uses pedidos (lowercase) with YYYY-MM-DD', () => {
    const p = pedidoSubfolderDrivePath({
      pedidoManual: 'PED-99-2026',
      tipoDocumento: 'nf',
      direcaoNf: 'desconhecida',
    });
    expect(p.logicalPath).toContain('/pedidos/PED-99-2026');
    expect(p.logicalPath).not.toContain('/Pedidos/');
  });

  it('manifestDrivePath unchanged', () => {
    const p = manifestDrivePath('PED-25-2026');
    expect(p.logicalPath).toContain('/pedidos/PED-25-2026/manifest.json');
  });
});
