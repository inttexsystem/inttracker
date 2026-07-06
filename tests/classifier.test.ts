import { describe, it, expect } from 'vitest';
import { classifyAttachment } from '../src/core/classifier.js';

describe('classifier', () => {
  it('classifies XML with NF-e structure as nf_xml', () => {
    const result = classifyAttachment({
      filename: 'nota.xml',
      mimeType: 'text/xml',
      contentSample: '<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe"><NFe>...</NFe></nfeProc>',
    });
    expect(result).toBe('nf_xml');
  });

  it('classifies PDF with nf in name as nf_pdf', () => {
    const result = classifyAttachment({
      filename: 'NF-12345.pdf',
      mimeType: 'application/pdf',
    });
    expect(result).toBe('nf_pdf');
  });

  it('classifies PDF with nota in subject as nf_pdf', () => {
    const result = classifyAttachment({
      filename: 'documento.pdf',
      mimeType: 'application/pdf',
      subject: 'Nota Fiscal 123',
    });
    expect(result).toBe('nf_pdf');
  });

  it('classifies PDF with romaneio in filename as romaneio', () => {
    const result = classifyAttachment({
      filename: 'romaneio_carga.pdf',
      mimeType: 'application/pdf',
    });
    expect(result).toBe('romaneio');
  });

  it('classifies PDF with romaneio in subject as romaneio', () => {
    const result = classifyAttachment({
      filename: 'anexo.pdf',
      mimeType: 'application/pdf',
      subject: 'Romaneio de entrega',
    });
    expect(result).toBe('romaneio');
  });

  it('classifies plain PDF without keywords as desconhecido', () => {
    const result = classifyAttachment({
      filename: 'contrato.pdf',
      mimeType: 'application/pdf',
    });
    expect(result).toBe('desconhecido');
  });

  it('classifies XML without NF-e structure as desconhecido', () => {
    const result = classifyAttachment({
      filename: 'dados.xml',
      mimeType: 'text/xml',
      contentSample: '<root><item>teste</item></root>',
    });
    expect(result).toBe('desconhecido');
  });
});
