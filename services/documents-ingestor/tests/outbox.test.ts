import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, rmSync, readFileSync } from 'node:fs';
import { appendEvent, isEventDuplicate } from '../src/core/outbox.js';
import { config } from '../src/config.js';
import { createDocumentEvent } from '../src/types/event.js';
import type { DocumentEvent } from '../src/types/event.js';

describe('outbox', () => {
  const outboxPath = config.outboxPath;

  beforeEach(() => {
    if (existsSync(outboxPath)) rmSync(outboxPath);
  });

  afterEach(() => {
    if (existsSync(outboxPath)) rmSync(outboxPath);
  });

  it('appends event with Drive references to JSONL', () => {
    const event = createDocumentEvent({
      eventId: 'evt-001',
      pedidoManual: 'PED-25-2026',
      gmailMessageId: 'msg-001',
      threadId: 'thread-001',
      documentId: 'doc-001',
      tipoDocumento: 'nf',
      filenameOriginal: 'nota.pdf',
      sha256: 'a'.repeat(64),
      driveFileId: 'file-abc',
      driveFolderId: 'folder-xyz',
      driveWebViewLink: 'https://drive.google.com/file/d/file-abc/view',
      driveWebContentLink: 'https://drive.google.com/uc?export=download&id=file-abc',
      localCachePath: './data/cache/pedidos/PED-25-2026/2026-07-06/nf/nota.pdf',
      manifestStorageUri: 'gdrive://file/manifest-1',
    });

    appendEvent(event);

    const content = readFileSync(outboxPath, 'utf-8').trim();
    const parsed: DocumentEvent = JSON.parse(content);

    expect(parsed.event_id).toBe('evt-001');
    expect(parsed.status).toBe('pending_app_acceptance');
    expect(parsed.document.storage_backend).toBe('google_drive');
    expect(parsed.document.storage_uri).toBe('gdrive://file/file-abc');
    expect(parsed.document.drive_file_id).toBe('file-abc');
    expect(parsed.document.manifest_storage_uri).toBe('gdrive://file/manifest-1');
  });

  it('event storage_uri is gdrive://file/<drive_file_id>', () => {
    const event = createDocumentEvent({
      eventId: 'evt-002',
      pedidoManual: 'PED-01-2026',
      gmailMessageId: 'msg-002',
      threadId: 'thread-002',
      documentId: 'doc-002',
      tipoDocumento: 'nf',
      filenameOriginal: 'nf.xml',
      sha256: 'c'.repeat(64),
      driveFileId: 'XYZ-FILE-ID-99',
    });

    expect(event.document.storage_uri).toBe('gdrive://file/XYZ-FILE-ID-99');
    expect(event.document.storage_backend).toBe('google_drive');
  });

  it('isEventDuplicate is a function', () => {
    expect(typeof isEventDuplicate).toBe('function');
  });

  it('G12-C: accepts pedidoManual empty string for unlinked documents', () => {
    const event = createDocumentEvent({
      eventId: 'evt-g12c-001',
      pedidoManual: '',
      gmailMessageId: 'msg-g12c',
      threadId: 'thread-g12c',
      documentId: 'doc-g12c',
      tipoDocumento: 'nf',
      filenameOriginal: 'NF-recebida.pdf',
      sha256: 'd'.repeat(64),
      driveFileId: 'file-g12c',
      driveFolderId: 'folder-g12c',
      driveWebViewLink: 'https://drive.google.com/file/d/file-g12c/view',
      formato: 'pdf',
      direcaoNf: 'entrada',
    });

    appendEvent(event);

    const content = readFileSync(outboxPath, 'utf-8').trim();
    const parsed: DocumentEvent = JSON.parse(content);

    expect(parsed.event_type).toBe('document.detected');
    expect(parsed.pedido_manual).toBe('');
    expect(parsed.status).toBe('pending_app_acceptance');
    expect(parsed.document.drive_file_id).toBe('file-g12c');
    expect(parsed.document.formato).toBe('pdf');
    expect(parsed.document.direcao_nf).toBe('entrada');
  });

  it('G12-C: createDocumentEvent accepts eventType parameter for document.linked', () => {
    const event = createDocumentEvent({
      eventId: 'evt-g12c-linked',
      pedidoManual: 'PED-25-2026',
      gmailMessageId: 'msg-linked',
      threadId: 'thread-linked',
      documentId: 'doc-linked',
      tipoDocumento: 'nf',
      filenameOriginal: 'NF-linked.pdf',
      sha256: 'e'.repeat(64),
      driveFileId: 'file-linked',
      eventType: 'document.linked',
    });

    expect(event.event_type).toBe('document.linked');
    expect(event.pedido_manual).toBe('PED-25-2026');
  });
});
