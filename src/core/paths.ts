import { config } from '../config.js';
import { join } from 'node:path';
import type { TipoDocumento } from '../types/document.js';

function todayDir(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function pendentePath(gmailMessageId: string): string {
  return join(config.documentRootPath, 'pendentes', todayDir(), `email-${gmailMessageId}`);
}

export function pdfSubfolder(tipo: TipoDocumento): string {
  const map: Record<TipoDocumento, string> = {
    nf_pdf: 'nf',
    nf_xml: 'nf',
    romaneio: 'romaneio',
    desconhecido: 'desconhecido',
  };
  return map[tipo];
}

export function pedidoPath(pedidoManual: string): string {
  return join(config.documentRootPath, 'pedidos', pedidoManual, todayDir());
}

export function pedidoDocumentPath(pedidoManual: string, tipo: TipoDocumento, filename: string): string {
  return join(pedidoPath(pedidoManual), pdfSubfolder(tipo), filename);
}

export function manifestPath(pedidoManual: string): string {
  return join(config.documentRootPath, 'pedidos', pedidoManual, 'manifest.json');
}
