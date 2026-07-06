import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, rmSync, readFileSync } from 'node:fs';
import { appendEvent, isEventDuplicate } from '../src/core/outbox.js';
import { config } from '../src/config.js';
import type { DocumentEvent } from '../src/types/event.js';

describe('outbox', () => {
  const outboxPath = config.outboxPath;

  beforeEach(() => {
    if (existsSync(outboxPath)) rmSync(outboxPath);
  });

  afterEach(() => {
    if (existsSync(outboxPath)) rmSync(outboxPath);
  });

  it('appends event to JSONL', () => {
    const event: DocumentEvent = {
      schema_version: 1,
      event_type: 'document.detected',
      event_id: 'evt-001',
      created_at: new Date().toISOString(),
      pedido_manual: 'PED-25-2026',
      source: 'gmail',
      gmail_message_id: 'msg-001',
      thread_id: 'thread-001',
      document: {
        document_id: 'doc-001',
        tipo_documento: 'nf_pdf',
        filename_original: 'nota.pdf',
        sha256: 'a'.repeat(64),
        local_path: 'pedidos/PED-25-2026/2026-01-01/nf/nota.pdf',
        manifest_path: 'pedidos/PED-25-2026/manifest.json',
      },
      status: 'pending_app_acceptance',
    };

    appendEvent(event);

    const content = readFileSync(outboxPath, 'utf-8').trim();
    const parsed = JSON.parse(content);
    expect(parsed.event_id).toBe('evt-001');
    expect(parsed.status).toBe('pending_app_acceptance');
  });
});
