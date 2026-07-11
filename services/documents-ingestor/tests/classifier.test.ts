import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { classifyAttachment, lerDirecaoNFe, extrairPartesNFe } from '../src/core/classifier.js';
import type { DocumentEntityMatchInput } from '../src/types/documentEntityMatch.js';
import type { EntityCnpjRegistry, RegisteredEntityCnpj } from '../src/types/entityCnpj.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = resolve(__dirname, 'fixtures');

function loadFixture(name: string): string {
  return readFileSync(resolve(fixturesDir, name), 'utf-8');
}

const RAVATEX_CNPJ_1 = '59418365146803';
const RAVATEX_CNPJ_2 = '55832866852408';

function makeNFeXml(destCnpj?: string | null, emitCnpj?: string | null, useNsPrefix = false): string {
  const ns = useNsPrefix ? 'nfe:' : '';
  const destBlock = destCnpj
    ? `<${ns}dest><${ns}CNPJ>${destCnpj}</${ns}CNPJ></${ns}dest>`
    : `<${ns}dest><${ns}xNome>Cliente</${ns}xNome></${ns}dest>`;
  const emitBlock = emitCnpj
    ? `<${ns}emit><${ns}CNPJ>${emitCnpj}</${ns}CNPJ></${ns}emit>`
    : `<${ns}emit><${ns}xNome>Fornecedor</${ns}xNome></${ns}emit>`;
  return `<${ns}nfeProc xmlns${ns ? ':' + ns.replace(':', '') + '=' : ''}"http://www.portalfiscal.inf.br/nfe"><${ns}NFe><${ns}infNFe>${destBlock}${emitBlock}</${ns}infNFe></${ns}NFe></${ns}nfeProc>`;
}

function fornecedor(id: number, nome: string, cnpj: string, tipo?: string): RegisteredEntityCnpj {
  return { entityType: 'fornecedor', entityId: id, entityName: nome, cnpj, supplierType: tipo };
}

function cliente(id: number, nome: string, cnpj: string): RegisteredEntityCnpj {
  return { entityType: 'cliente', entityId: id, entityName: nome, cnpj };
}

function registry(entries: RegisteredEntityCnpj[]): EntityCnpjRegistry {
  return { loaded: true, loadedAt: new Date().toISOString(), entries, error: null };
}

function unavailableRegistry(): EntityCnpjRegistry {
  return { loaded: false, loadedAt: null, entries: [], error: 'connection failed' };
}

const CNPJ_FORN = '11444777000161';
const CNPJ_CLI = '11222333000181';
const CNPJ_SHARED = '02194703529779';

describe('classifier', () => {
  it('classifies XML with NF-e structure as nf + formato xml', () => {
    const result = classifyAttachment({
      filename: 'nota.xml',
      mimeType: 'text/xml',
      contentSample: '<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe"><NFe>...</NFe></nfeProc>',
    });
    expect(result.tipoDocumento).toBe('nf');
    expect(result.formato).toBe('xml');
  });

  it('classifies PDF with nf in name as nf + formato pdf', () => {
    const result = classifyAttachment({
      filename: 'NF-12345.pdf',
      mimeType: 'application/pdf',
    });
    expect(result.tipoDocumento).toBe('nf');
    expect(result.formato).toBe('pdf');
    expect(result.direcaoNf).toBeNull();
  });

  it('classifies PDF with nota in subject as nf + formato pdf', () => {
    const result = classifyAttachment({
      filename: 'documento.pdf',
      mimeType: 'application/pdf',
      subject: 'Nota Fiscal 123',
    });
    expect(result.tipoDocumento).toBe('nf');
    expect(result.formato).toBe('pdf');
  });

  it('classifies PDF with romaneio in filename as romaneio', () => {
    const result = classifyAttachment({
      filename: 'romaneio_carga.pdf',
      mimeType: 'application/pdf',
    });
    expect(result.tipoDocumento).toBe('romaneio');
    expect(result.formato).toBe('pdf');
    expect(result.direcaoNf).toBeNull();
  });

  it('classifies PDF with romaneio in subject as romaneio', () => {
    const result = classifyAttachment({
      filename: 'anexo.pdf',
      mimeType: 'application/pdf',
      subject: 'Romaneio de entrega',
    });
    expect(result.tipoDocumento).toBe('romaneio');
    expect(result.formato).toBe('pdf');
  });

  it('classifies plain PDF without keywords as desconhecido', () => {
    const result = classifyAttachment({
      filename: 'contrato.pdf',
      mimeType: 'application/pdf',
    });
    expect(result.tipoDocumento).toBe('desconhecido');
    expect(result.formato).toBe('pdf');
  });

  it('classifies XML without NF-e structure as desconhecido', () => {
    const result = classifyAttachment({
      filename: 'dados.xml',
      mimeType: 'text/xml',
      contentSample: '<root><item>teste</item></root>',
    });
    expect(result.tipoDocumento).toBe('desconhecido');
    expect(result.formato).toBe('xml');
  });

  it('classifies unknown mime type as desconhecido with formato desconhecido', () => {
    const result = classifyAttachment({
      filename: 'file.bin',
      mimeType: 'application/octet-stream',
    });
    expect(result.tipoDocumento).toBe('desconhecido');
    expect(result.formato).toBe('desconhecido');
  });
});

describe('NF direction (XML)', () => {
  const cnpjs = [RAVATEX_CNPJ_1, RAVATEX_CNPJ_2];

  it('XML with dest/CNPJ matching Ravatex CNPJ → entrada', () => {
    const xml = makeNFeXml(RAVATEX_CNPJ_1, CNPJ_CLI);
    const result = classifyAttachment({
      filename: 'nfe.xml',
      mimeType: 'text/xml',
      contentSample: xml,
      ravatexCnpjs: cnpjs,
    });
    expect(result.tipoDocumento).toBe('nf');
    expect(result.formato).toBe('xml');
    expect(result.direcaoNf).toBe('entrada');
  });

  it('XML with emit/CNPJ matching Ravatex CNPJ → saida', () => {
    const xml = makeNFeXml(CNPJ_CLI, RAVATEX_CNPJ_2);
    const result = classifyAttachment({
      filename: 'nfe.xml',
      mimeType: 'text/xml',
      contentSample: xml,
      ravatexCnpjs: cnpjs,
    });
    expect(result.tipoDocumento).toBe('nf');
    expect(result.formato).toBe('xml');
    expect(result.direcaoNf).toBe('saida');
  });

  it('XML without CNPJ matching Ravatex → desconhecida', () => {
    const xml = makeNFeXml(CNPJ_CLI, CNPJ_FORN);
    const result = classifyAttachment({
      filename: 'nfe.xml',
      mimeType: 'text/xml',
      contentSample: xml,
      ravatexCnpjs: cnpjs,
    });
    expect(result.tipoDocumento).toBe('nf');
    expect(result.formato).toBe('xml');
    expect(result.direcaoNf).toBe('desconhecida');
  });

  it('XML with formatted CNPJ (dots/slashes) works', () => {
    const punctuatedRavatex = `${RAVATEX_CNPJ_1.slice(0,2)}.${RAVATEX_CNPJ_1.slice(2,5)}.${RAVATEX_CNPJ_1.slice(5,8)}/${RAVATEX_CNPJ_1.slice(8,12)}-${RAVATEX_CNPJ_1.slice(12,14)}`;
    const punctuatedOther = `${CNPJ_CLI.slice(0,2)}.${CNPJ_CLI.slice(2,5)}.${CNPJ_CLI.slice(5,8)}/${CNPJ_CLI.slice(8,12)}-${CNPJ_CLI.slice(12,14)}`;
    const xml = makeNFeXml(punctuatedRavatex, punctuatedOther);
    const result = classifyAttachment({
      filename: 'nfe.xml',
      mimeType: 'text/xml',
      contentSample: xml,
      ravatexCnpjs: [RAVATEX_CNPJ_1],
    });
    expect(result.direcaoNf).toBe('entrada');
  });

  it('XML with namespace prefix works', () => {
    const xml = makeNFeXml(RAVATEX_CNPJ_2, CNPJ_CLI, true);
    const result = classifyAttachment({
      filename: 'nfe.xml',
      mimeType: 'text/xml',
      contentSample: xml,
      ravatexCnpjs: cnpjs,
    });
    expect(result.direcaoNf).toBe('entrada');
  });

  it('XML without dest/emit CNPJ elements → desconhecida', () => {
    const xml = '<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe"><NFe><infNFe><dest><xNome>Cliente</xNome></dest><emit><xNome>Fornecedor</xNome></emit></infNFe></NFe></nfeProc>';
    const result = classifyAttachment({
      filename: 'nfe.xml',
      mimeType: 'text/xml',
      contentSample: xml,
      ravatexCnpjs: cnpjs,
    });
    expect(result.direcaoNf).toBe('desconhecida');
  });

  it('no RAVATEX_CNPJS config → desconhecida', () => {
    const xml = makeNFeXml(RAVATEX_CNPJ_1, CNPJ_CLI);
    const result = classifyAttachment({
      filename: 'nfe.xml',
      mimeType: 'text/xml',
      contentSample: xml,
      ravatexCnpjs: [],
    });
    expect(result.direcaoNf).toBe('desconhecida');
  });

  it('dest prioritário: ambos batem → entrada', () => {
    const xml = makeNFeXml(RAVATEX_CNPJ_1, RAVATEX_CNPJ_2);
    const result = classifyAttachment({
      filename: 'nfe.xml',
      mimeType: 'text/xml',
      contentSample: xml,
      ravatexCnpjs: cnpjs,
    });
    expect(result.direcaoNf).toBe('entrada');
  });

  it('XML inválido não quebra — cai para desconhecido', () => {
    const result = classifyAttachment({
      filename: 'corrupt.xml',
      mimeType: 'text/xml',
      contentSample: 'not even valid <<<xml>>>',
    });
    expect(result.tipoDocumento).toBe('desconhecido');
  });
});

describe('lerDirecaoNFe (unit — via extracted parties)', () => {
  const cnpjs = [RAVATEX_CNPJ_1];

  function partiesFromXml(destCnpj?: string | null, emitCnpj?: string | null) {
    return extrairPartesNFe(makeNFeXml(destCnpj, emitCnpj));
  }

  it('returns entrada when dest matches', () => {
    expect(lerDirecaoNFe(partiesFromXml(RAVATEX_CNPJ_1), cnpjs)).toBe('entrada');
  });

  it('returns saida when emit matches', () => {
    expect(lerDirecaoNFe(partiesFromXml(null, RAVATEX_CNPJ_1), cnpjs)).toBe('saida');
  });

  it('returns desconhecida when neither matches', () => {
    expect(lerDirecaoNFe(partiesFromXml(null, '99999999000199'), cnpjs)).toBe('desconhecida');
  });

  it('empty CNPJ list returns desconhecida', () => {
    expect(lerDirecaoNFe(partiesFromXml(RAVATEX_CNPJ_1), [])).toBe('desconhecida');
  });
});

describe('entity match integration', () => {
  const CNPJ_EMIT = '11444777000161';
  const CNPJ_DEST = '11222333000181';

  it('XML returns cnpjEmitente normalized', () => {
    const xml = makeNFeXml(null, CNPJ_EMIT);
    const result = classifyAttachment({
      filename: 'nfe.xml', mimeType: 'text/xml', contentSample: xml,
    });
    expect(result.cnpjEmitente).toBe(CNPJ_EMIT);
    expect(result.cnpjDestinatario).toBeNull();
  });

  it('XML returns cnpjDestinatario normalized', () => {
    const xml = makeNFeXml(CNPJ_DEST, null);
    const result = classifyAttachment({
      filename: 'nfe.xml', mimeType: 'text/xml', contentSample: xml,
    });
    expect(result.cnpjEmitente).toBeNull();
    expect(result.cnpjDestinatario).toBe(CNPJ_DEST);
  });

  it('values returned are normalized (no punctuation)', () => {
    const xml = makeNFeXml('11.222.333/0001-81', '11.444.777/0001-61');
    const result = classifyAttachment({
      filename: 'nfe.xml', mimeType: 'text/xml', contentSample: xml,
    });
    expect(result.cnpjDestinatario).toBe('11222333000181');
    expect(result.cnpjEmitente).toBe('11444777000161');
  });

  it('namespace prefix is accepted for extraction', () => {
    const xml = makeNFeXml(CNPJ_DEST, CNPJ_EMIT, true);
    const result = classifyAttachment({
      filename: 'nfe.xml', mimeType: 'text/xml', contentSample: xml,
    });
    expect(result.cnpjDestinatario).toBe(CNPJ_DEST);
    expect(result.cnpjEmitente).toBe(CNPJ_EMIT);
  });

  it('missing emitente returns null', () => {
    const xml = makeNFeXml(CNPJ_DEST, null);
    const result = classifyAttachment({
      filename: 'nfe.xml', mimeType: 'text/xml', contentSample: xml,
    });
    expect(result.cnpjEmitente).toBeNull();
  });

  it('missing destinatario returns null', () => {
    const xml = makeNFeXml(null, CNPJ_EMIT);
    const result = classifyAttachment({
      filename: 'nfe.xml', mimeType: 'text/xml', contentSample: xml,
    });
    expect(result.cnpjDestinatario).toBeNull();
  });

  it('non-XML document returns both CNPJs as null', () => {
    const result = classifyAttachment({
      filename: 'NF-12345.pdf', mimeType: 'application/pdf',
    });
    expect(result.cnpjEmitente).toBeNull();
    expect(result.cnpjDestinatario).toBeNull();
  });

  it('registry omitted returns entityMatch null', () => {
    const xml = makeNFeXml(CNPJ_DEST, CNPJ_EMIT);
    const result = classifyAttachment({
      filename: 'nfe.xml', mimeType: 'text/xml', contentSample: xml,
    });
    expect(result.entityMatch).toBeNull();
  });

  it('registry with fornecedor in emitente matches', () => {
    const xml = makeNFeXml(null, CNPJ_FORN);
    const reg = registry([fornecedor(1, 'Conitex', CNPJ_FORN)]);
    const result = classifyAttachment({
      filename: 'nfe.xml', mimeType: 'text/xml', contentSample: xml, entityRegistry: reg,
    });
    expect(result.entityMatch).not.toBeNull();
    expect(result.entityMatch!.state).toBe('matched');
    expect(result.entityMatch!.emitente.matches).toHaveLength(1);
    expect(result.entityMatch!.emitente.matches[0].entityType).toBe('fornecedor');
    expect(result.entityMatch!.emitente.matches[0].entityName).toBe('Conitex');
  });

  it('registry with cliente in destinatario matches', () => {
    const xml = makeNFeXml(CNPJ_CLI, null);
    const reg = registry([cliente(1, 'Encanta Lar', CNPJ_CLI)]);
    const result = classifyAttachment({
      filename: 'nfe.xml', mimeType: 'text/xml', contentSample: xml, entityRegistry: reg,
    });
    expect(result.entityMatch).not.toBeNull();
    expect(result.entityMatch!.state).toBe('matched');
    expect(result.entityMatch!.destinatario.matches).toHaveLength(1);
    expect(result.entityMatch!.destinatario.matches[0].entityType).toBe('cliente');
  });

  it('same CNPJ in cliente and fornecedor returns ambiguous', () => {
    const xml = makeNFeXml(null, CNPJ_SHARED);
    const reg = registry([cliente(1, 'Dual C', CNPJ_SHARED), fornecedor(2, 'Dual F', CNPJ_SHARED)]);
    const result = classifyAttachment({
      filename: 'nfe.xml', mimeType: 'text/xml', contentSample: xml, entityRegistry: reg,
    });
    expect(result.entityMatch).not.toBeNull();
    expect(result.entityMatch!.state).toBe('ambiguous');
    expect(result.entityMatch!.emitente.matches).toHaveLength(2);
  });

  it('empty registry returns unmatched', () => {
    const xml = makeNFeXml(null, CNPJ_FORN);
    const reg = registry([]);
    const result = classifyAttachment({
      filename: 'nfe.xml', mimeType: 'text/xml', contentSample: xml, entityRegistry: reg,
    });
    expect(result.entityMatch).not.toBeNull();
    expect(result.entityMatch!.state).toBe('unmatched');
    expect(result.entityMatch!.emitente.state).toBe('unmatched');
  });

  it('unavailable registry returns registry_unavailable', () => {
    const xml = makeNFeXml(null, CNPJ_FORN);
    const reg = unavailableRegistry();
    const result = classifyAttachment({
      filename: 'nfe.xml', mimeType: 'text/xml', contentSample: xml, entityRegistry: reg,
    });
    expect(result.entityMatch).not.toBeNull();
    expect(result.entityMatch!.state).toBe('registry_unavailable');
  });

  it('no association by name', () => {
    const xml = makeNFeXml(CNPJ_CLI, null);
    const reg = registry([cliente(1, 'Encanta Lar', CNPJ_CLI)]);
    const result = classifyAttachment({
      filename: 'nfe.xml', mimeType: 'text/xml', contentSample: xml, entityRegistry: reg,
    });
    expect(result.entityMatch!.destinatario.matches[0].entityName).toBe('Encanta Lar');
  });

  it('matcher preserves found entities', () => {
    const xml = makeNFeXml(null, CNPJ_FORN);
    const reg = registry([fornecedor(2, 'Conitex', CNPJ_FORN, 'latex')]);
    const result = classifyAttachment({
      filename: 'nfe.xml', mimeType: 'text/xml', contentSample: xml, entityRegistry: reg,
    });
    const match = result.entityMatch!.emitente.matches[0];
    expect(match.entityId).toBe(2);
    expect(match.entityName).toBe('Conitex');
    expect(match.supplierType).toBe('latex');
  });

  it('registry does not change direction', () => {
    const xml = makeNFeXml(RAVATEX_CNPJ_1, CNPJ_FORN);
    const reg = registry([fornecedor(1, 'Conitex', CNPJ_FORN)]);
    const resultWithReg = classifyAttachment({
      filename: 'nfe.xml', mimeType: 'text/xml', contentSample: xml,
      ravatexCnpjs: [RAVATEX_CNPJ_1], entityRegistry: reg,
    });
    const resultWithoutReg = classifyAttachment({
      filename: 'nfe.xml', mimeType: 'text/xml', contentSample: xml,
      ravatexCnpjs: [RAVATEX_CNPJ_1],
    });
    expect(resultWithReg.direcaoNf).toBe('entrada');
    expect(resultWithReg.direcaoNf).toBe(resultWithoutReg.direcaoNf);
  });

  it('fornecedor in emitente does NOT imply entrada', () => {
    const xml = makeNFeXml(null, CNPJ_FORN);
    const reg = registry([fornecedor(1, 'Conitex', CNPJ_FORN)]);
    const result = classifyAttachment({
      filename: 'nfe.xml', mimeType: 'text/xml', contentSample: xml,
      entityRegistry: reg,
    });
    expect(result.direcaoNf).not.toBe('entrada');
    expect(result.direcaoNf).toBe('desconhecida');
  });

  it('cliente in destinatario does NOT imply saida', () => {
    const xml = makeNFeXml(CNPJ_CLI, null);
    const reg = registry([cliente(1, 'Encanta Lar', CNPJ_CLI)]);
    const result = classifyAttachment({
      filename: 'nfe.xml', mimeType: 'text/xml', contentSample: xml,
      entityRegistry: reg,
    });
    expect(result.direcaoNf).not.toBe('saida');
    expect(result.direcaoNf).toBe('desconhecida');
  });

  it('historical RAVATEX_CNPJS behavior is preserved', () => {
    const xml = makeNFeXml(RAVATEX_CNPJ_1, CNPJ_CLI);
    const reg = registry([fornecedor(1, 'Conitex', CNPJ_CLI)]);
    const result = classifyAttachment({
      filename: 'nfe.xml', mimeType: 'text/xml', contentSample: xml,
      ravatexCnpjs: [RAVATEX_CNPJ_1], entityRegistry: reg,
    });
    expect(result.direcaoNf).toBe('entrada');
  });

  it('extraction occurs from a single source', () => {
    const xml = makeNFeXml(CNPJ_DEST, CNPJ_EMIT);
    const parties = extrairPartesNFe(xml);
    const result = classifyAttachment({
      filename: 'nfe.xml', mimeType: 'text/xml', contentSample: xml,
    });
    expect(result.cnpjEmitente).toBe(parties.emitenteCnpj);
    expect(result.cnpjDestinatario).toBe(parties.destinatarioCnpj);
  });

  it('output does not contain relevance', () => {
    const xml = makeNFeXml(CNPJ_DEST, CNPJ_EMIT);
    const result = classifyAttachment({
      filename: 'nfe.xml', mimeType: 'text/xml', contentSample: xml,
    });
    const keys = Object.keys(result);
    expect(keys).not.toContain('relevant');
    expect(keys).not.toContain('relevance');
    expect(keys).not.toContain('relevancia');
  });

  it('inputs and registry are not mutated', () => {
    const entries = [cliente(1, 'Encanta Lar', CNPJ_CLI)];
    const reg = registry(entries);
    const frozenEntries = [...entries];
    const xml = makeNFeXml(CNPJ_CLI, null);
    const emitenteCnpj = CNPJ_CLI;

    classifyAttachment({
      filename: 'nfe.xml', mimeType: 'text/xml', contentSample: xml,
      entityRegistry: reg,
    });

    expect(reg.loaded).toBe(true);
    expect(reg.entries).toEqual(frozenEntries);
    expect(emitenteCnpj).toBe(CNPJ_CLI);
  });
});

describe('structural NF-e party extraction (G25-B2-A-R4-B7-R1)', () => {
  const EMIT_CNPJ = '11444777000161';
  const DEST_CNPJ = '11222333000181';

  function multilineXml(overrides?: { emitBlock?: string; destBlock?: string; extra?: string }): string {
    const emitBlock = overrides?.emitBlock ?? `<emit><CNPJ>${EMIT_CNPJ}</CNPJ><xNome>Emit</xNome></emit>`;
    const destBlock = overrides?.destBlock ?? `<dest><CNPJ>${DEST_CNPJ}</CNPJ><xNome>Dest</xNome></dest>`;
    const extra = overrides?.extra ?? '';
    return [
      '<?xml version="1.0"?>',
      '<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe">',
      '  <NFe>',
      '    <infNFe>',
      `      ${emitBlock}`,
      `      ${destBlock}`,
      `      ${extra}`,
      '    </infNFe>',
      '  </NFe>',
      '</nfeProc>',
    ].join('\n');
  }

  function multilineWithAddresses(): string {
    return loadFixture('nfe-multiline-ender-dest.xml');
  }

  it('extracts emit/CNPJ from multiline NF-e', () => {
    const xml = multilineXml();
    const r = extrairPartesNFe(xml);
    expect(r.emitenteCnpj).toBe(EMIT_CNPJ);
    expect(r.destinatarioCnpj).toBe(DEST_CNPJ);
  });

  it('extracts dest/CNPJ when enderDest is present multiline', () => {
    const xml = multilineWithAddresses();
    const r = extrairPartesNFe(xml);
    expect(r.destinatarioCnpj).toBeNull();
  });

  it('</enderDest> does not end nor replace dest element', () => {
    const xml = multilineWithAddresses();
    const r = extrairPartesNFe(xml);
    expect(r.destinatarioCnpj).toBeNull();
    expect(r.emitenteCnpj).toBeNull();
  });

  it('<enderEmit> does not interfere with emit extraction', () => {
    const xml = multilineWithAddresses();
    const r = extrairPartesNFe(xml);
    expect(r.emitenteCnpj).toBeNull();
  });

  it('does not confuse multiline enderDest with the dest element', () => {
    const xml = multilineWithAddresses();
    const r = extrairPartesNFe(xml);
    expect(r.destinatarioCnpj).toBeNull();
    expect(r.emitenteCnpj).toBeNull();
  });

  it('accepts nfeProc envelope', () => {
    const xml = multilineXml();
    const r = extrairPartesNFe(xml);
    expect(r.emitenteCnpj).not.toBeNull();
    expect(r.destinatarioCnpj).not.toBeNull();
  });

  it('accepts XML starting directly with NFe (no nfeProc)', () => {
    const xml = [
      '<NFe xmlns="http://www.portalfiscal.inf.br/nfe">',
      '  <infNFe>',
      `    <emit><CNPJ>${EMIT_CNPJ}</CNPJ></emit>`,
      `    <dest><CNPJ>${DEST_CNPJ}</CNPJ></dest>`,
      '  </infNFe>',
      '</NFe>',
    ].join('\n');
    const r = extrairPartesNFe(xml);
    expect(r.emitenteCnpj).toBe(EMIT_CNPJ);
    expect(r.destinatarioCnpj).toBe(DEST_CNPJ);
  });

  it('accepts namespace-prefixed elements', () => {
    const xml = loadFixture('nfe-namespace-prefix.xml');
    const r = extrairPartesNFe(xml);
    expect(r.emitenteCnpj).toBeNull();
    expect(r.destinatarioCnpj).toBeNull();
  });

  it('accepts default namespace (no prefix)', () => {
    const xml = multilineXml();
    const r = extrairPartesNFe(xml);
    expect(r.emitenteCnpj).toBe(EMIT_CNPJ);
    expect(r.destinatarioCnpj).toBe(DEST_CNPJ);
  });

  it('ignores transportadora CNPJ', () => {
    const xml = multilineWithAddresses();
    const r = extrairPartesNFe(xml);
    expect(r.emitenteCnpj).toBeNull();
    expect(r.destinatarioCnpj).toBeNull();
  });

  it('ignores entrega CNPJ block', () => {
    const xml = multilineXml({
      extra: '<entrega><CNPJ>99999999000199</CNPJ></entrega>',
    });
    const r = extrairPartesNFe(xml);
    expect(r.emitenteCnpj).toBe(EMIT_CNPJ);
    expect(r.destinatarioCnpj).toBe(DEST_CNPJ);
  });

  it('ignores retirada CNPJ block', () => {
    const xml = multilineXml({
      extra: '<retirada><CNPJ>99999999000199</CNPJ></retirada>',
    });
    const r = extrairPartesNFe(xml);
    expect(r.emitenteCnpj).toBe(EMIT_CNPJ);
    expect(r.destinatarioCnpj).toBe(DEST_CNPJ);
  });

  it('returns null for destinatario with CPF instead of CNPJ', () => {
    const xml = multilineXml({
      destBlock: '<dest><CPF>12345678901</CPF><xNome>Dest</xNome></dest>',
    });
    const r = extrairPartesNFe(xml);
    expect(r.destinatarioCnpj).toBeNull();
  });

  it('returns null when emitente is absent', () => {
    const xml = multilineXml({ emitBlock: '<emit><xNome>NoCNPJ</xNome></emit>' });
    const r = extrairPartesNFe(xml);
    expect(r.emitenteCnpj).toBeNull();
  });

  it('returns null when destinatario is absent', () => {
    const xml = multilineXml({ destBlock: '<dest><xNome>NoCNPJ</xNome></dest>' });
    const r = extrairPartesNFe(xml);
    expect(r.destinatarioCnpj).toBeNull();
  });

  it('malformed XML does not crash the classifier', () => {
    const r = extrairPartesNFe('not even valid <<<xml>>>');
    expect(r.emitenteCnpj).toBeNull();
    expect(r.destinatarioCnpj).toBeNull();
  });

  it('malformed XML returns null parts safely', () => {
    const xml = '<nfeProc><dest><CNPJ>12</dest></emit>';
    const r = extrairPartesNFe(xml);
    expect(r.emitenteCnpj).toBeNull();
    expect(r.destinatarioCnpj).toBeNull();
  });

  it('short CNPJ value returns null', () => {
    const xml = multilineXml({
      destBlock: '<dest><CNPJ>12345</CNPJ></dest>',
    });
    const r = extrairPartesNFe(xml);
    expect(r.destinatarioCnpj).toBeNull();
  });

  it('punctuated CNPJ is normalized', () => {
    const xml = multilineXml({
      destBlock: `<dest><CNPJ>${DEST_CNPJ.slice(0,2)}.${DEST_CNPJ.slice(2,5)}.${DEST_CNPJ.slice(5,8)}/${DEST_CNPJ.slice(8,12)}-${DEST_CNPJ.slice(12,14)}</CNPJ></dest>`,
      emitBlock: `<emit><CNPJ>${EMIT_CNPJ.slice(0,2)}.${EMIT_CNPJ.slice(2,5)}.${EMIT_CNPJ.slice(5,8)}/${EMIT_CNPJ.slice(8,12)}-${EMIT_CNPJ.slice(12,14)}</CNPJ></emit>`,
    });
    const r = extrairPartesNFe(xml);
    expect(r.emitenteCnpj).toBe(EMIT_CNPJ);
    expect(r.destinatarioCnpj).toBe(DEST_CNPJ);
  });

  it('historical direction behavior is preserved', () => {
    const RAVATEX_CNPJ_1 = '59418365146803';
    const xml = multilineXml({
      destBlock: `<dest><CNPJ>${RAVATEX_CNPJ_1}</CNPJ></dest>`,
      emitBlock: `<emit><CNPJ>${EMIT_CNPJ}</CNPJ></emit>`,
    });
    const cnpjs = [RAVATEX_CNPJ_1];
    const result = classifyAttachment({
      filename: 'nfe.xml', mimeType: 'text/xml', contentSample: xml,
      ravatexCnpjs: cnpjs,
    });
    expect(result.direcaoNf).toBe('entrada');
  });

  it('entityMatch finds fornecedor in emitente structurally', () => {
    const reg = {
      loaded: true, loadedAt: new Date().toISOString(), entries: [
        { entityType: 'fornecedor' as const, entityId: 1, entityName: 'Fornecedor X', cnpj: EMIT_CNPJ },
      ], error: null,
    };
    const xml = multilineXml();
    const result = classifyAttachment({
      filename: 'nfe.xml', mimeType: 'text/xml', contentSample: xml,
      entityRegistry: reg,
    });
    expect(result.entityMatch!.emitente.state).toBe('matched');
    expect(result.entityMatch!.emitente.matches[0].entityType).toBe('fornecedor');
  });

  it('entityMatch finds cliente in destinatario structurally', () => {
    const reg = {
      loaded: true, loadedAt: new Date().toISOString(), entries: [
        { entityType: 'cliente' as const, entityId: 2, entityName: 'Cliente Y', cnpj: DEST_CNPJ },
      ], error: null,
    };
    const xml = multilineXml();
    const result = classifyAttachment({
      filename: 'nfe.xml', mimeType: 'text/xml', contentSample: xml,
      entityRegistry: reg,
    });
    expect(result.entityMatch!.destinatario.state).toBe('matched');
    expect(result.entityMatch!.destinatario.matches[0].entityType).toBe('cliente');
  });

  it('consolidated result is matched when both are unambiguous', () => {
    const reg = {
      loaded: true, loadedAt: new Date().toISOString(), entries: [
        { entityType: 'fornecedor' as const, entityId: 1, entityName: 'Fornecedor X', cnpj: EMIT_CNPJ },
        { entityType: 'cliente' as const, entityId: 2, entityName: 'Cliente Y', cnpj: DEST_CNPJ },
      ], error: null,
    };
    const xml = multilineXml();
    const result = classifyAttachment({
      filename: 'nfe.xml', mimeType: 'text/xml', contentSample: xml,
      entityRegistry: reg,
    });
    expect(result.entityMatch!.state).toBe('matched');
  });

  it('does not pick the first global CNPJ', () => {
    const xml = multilineWithAddresses();
    const r = extrairPartesNFe(xml);
    expect(r.emitenteCnpj).toBeNull();
    expect(r.destinatarioCnpj).toBeNull();
  });

  it('no external access during extraction', () => {
    const xml = multilineXml();
    const r = extrairPartesNFe(xml);
    expect(r.emitenteCnpj).toBeDefined();
    expect(r.destinatarioCnpj).toBeDefined();
  });

  it('inputs and registry remain immutable after structural extraction', () => {
    const entries = [
      { entityType: 'fornecedor' as const, entityId: 1, entityName: 'F', cnpj: EMIT_CNPJ },
      { entityType: 'cliente' as const, entityId: 2, entityName: 'C', cnpj: DEST_CNPJ },
    ];
    const reg = { loaded: true, loadedAt: new Date().toISOString(), entries, error: null };
    const frozen = [...entries];
    const xml = multilineWithAddresses();
    classifyAttachment({
      filename: 'nfe.xml', mimeType: 'text/xml', contentSample: xml,
      entityRegistry: reg,
    });
    expect(reg.entries).toEqual(frozen);
  });

  it('valid emitente with invalid destinatario (letters) extracts emitente only', () => {
    const xml = multilineXml({
      destBlock: '<dest><CNPJ>abc</CNPJ></dest>',
    });
    const r = extrairPartesNFe(xml);
    expect(r.emitenteCnpj).toBe(EMIT_CNPJ);
    expect(r.destinatarioCnpj).toBeNull();
  });

  it('invalid emitente (letters) with valid destinatario extracts destinatario only', () => {
    const xml = multilineXml({
      emitBlock: '<emit><CNPJ>xyz</CNPJ></emit>',
    });
    const r = extrairPartesNFe(xml);
    expect(r.emitenteCnpj).toBeNull();
    expect(r.destinatarioCnpj).toBe(DEST_CNPJ);
  });

  it('valid emitente with invalid destinatario (bad checksum) extracts emitente only', () => {
    const xml = multilineXml({
      destBlock: '<dest><CNPJ>22222333000172</CNPJ></dest>',
    });
    const r = extrairPartesNFe(xml);
    expect(r.emitenteCnpj).toBe(EMIT_CNPJ);
    expect(r.destinatarioCnpj).toBeNull();
  });

  it('invalid emitente (bad checksum) with valid destinatario extracts destinatario only', () => {
    const xml = multilineXml({
      emitBlock: '<emit><CNPJ>11222333000180</CNPJ></emit>',
    });
    const r = extrairPartesNFe(xml);
    expect(r.emitenteCnpj).toBeNull();
    expect(r.destinatarioCnpj).toBe(DEST_CNPJ);
  });

  it('valid emitente with repeated-sequence destinatario extracts emitente only', () => {
    const xml = multilineXml({
      destBlock: '<dest><CNPJ>00000000000000</CNPJ></dest>',
    });
    const r = extrairPartesNFe(xml);
    expect(r.emitenteCnpj).toBe(EMIT_CNPJ);
    expect(r.destinatarioCnpj).toBeNull();
  });

  it('repeated-sequence emitente with valid destinatario extracts destinatario only', () => {
    const xml = multilineXml({
      emitBlock: '<emit><CNPJ>11111111111111</CNPJ></emit>',
    });
    const r = extrairPartesNFe(xml);
    expect(r.emitenteCnpj).toBeNull();
    expect(r.destinatarioCnpj).toBe(DEST_CNPJ);
  });
});
