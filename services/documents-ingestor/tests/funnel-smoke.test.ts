import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, rmSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { getDb, closeDb } from '../src/storage/sqlite.js';
import { linkDocumentToPedido } from '../src/core/link.js';
import { acceptDocument, rejectDocument } from '../src/core/acceptance.js';
import { exportPendingEvents } from '../src/core/outbox.js';
import { generateReport } from '../src/core/queries.js';
import { HERMETIC_TEST_ROOT } from './setup.js';

const SCENARIO_DIR = join(HERMETIC_TEST_ROOT, `funnel-smoke-${randomUUID()}`);

function seedDoc(database: any, overrides: any = {}): string {
  const gmailMessageId = overrides.gmailMessageId ?? `msg-smoke-${randomUUID().slice(0, 8)}`;
  database.prepare(
    `INSERT OR IGNORE INTO emails_processados (gmail_message_id, thread_id, subject) VALUES (?, ?, ?)`
  ).run(gmailMessageId, 'thr-smoke', overrides.subject ?? 'NF-e synthetic');

  const id = overrides.id ?? randomUUID();
  database.prepare(
    `INSERT INTO documentos (
       id, gmail_message_id, thread_id, attachment_id, filename_original,
       sha256, tipo_documento, formato, direcao_nf,
       storage_backend, storage_uri, drive_file_id,
       drive_web_view_link, status, pedido_manual
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', NULL)`
  ).run(
    id,
    gmailMessageId,
    'thr-smoke',
    `att-${randomUUID().slice(0, 8)}`,
    overrides.filename ?? `NF-${randomUUID().slice(0, 6)}.xml`,
    overrides.sha256 ?? randomUUID().replace(/-/g, ''),
    overrides.tipo ?? 'nf',
    overrides.formato ?? 'xml',
    overrides.direcao ?? 'entrada',
    'google_drive',
    overrides.storageUri ?? `gdrive://file/smoke-${randomUUID().slice(0, 8)}`,
    overrides.driveFileId ?? `smoke-${randomUUID().slice(0, 8)}`,
    overrides.driveWebViewLink ?? `https://drive.google.com/file/d/smoke/view`,
  );
  return id;
}

describe('local document funnel smoke', () => {
  beforeEach(() => {
    if (existsSync(SCENARIO_DIR)) rmSync(SCENARIO_DIR, { recursive: true });
    mkdirSync(SCENARIO_DIR, { recursive: true });
    process.env.DATABASE_PATH = join(SCENARIO_DIR, 'app.db');
    process.env.OUTBOX_PATH = join(SCENARIO_DIR, 'outbox.jsonl');
    process.env.LOCAL_CACHE_PATH = join(SCENARIO_DIR, 'cache');
    closeDb();
    const db = getDb();
    db.exec('DELETE FROM ingestion_events; DELETE FROM documentos; DELETE FROM emails_processados;');
  });

  afterEach(() => {
    closeDb();
    if (existsSync(SCENARIO_DIR)) rmSync(SCENARIO_DIR, { recursive: true });
  });

  it('1. document.detected → link → document.linked → accept → document.accepted', () => {
    const db = getDb();
    const docId = seedDoc(db, {
      tipo: 'nf', formato: 'xml', direcao: 'entrada',
      filename: 'NF-2026-001.xml',
    });

    const docRow = db.prepare(`SELECT status, tipo_documento, formato, direcao_nf FROM documentos WHERE id = ?`).get(docId) as any;
    expect(docRow.status).toBe('pending');
    expect(docRow.tipo_documento).toBe('nf');
    expect(docRow.formato).toBe('xml');
    expect(docRow.direcao_nf).toBe('entrada');

    const linkResult = linkDocumentToPedido(docId, '25/2026');
    expect(linkResult.warnedDirection).toBe(false);
    expect(linkResult.pedidoManual).toBe('PED-25-2026');

    const linked = db.prepare(`SELECT status, pedido_manual FROM documentos WHERE id = ?`).get(docId) as any;
    expect(linked.status).toBe('assigned');
    expect(linked.pedido_manual).toBe('PED-25-2026');

    db.prepare(`UPDATE ingestion_events SET exported_at = NULL WHERE document_id = ?`).run(docId);
    const outboxFile = join(SCENARIO_DIR, 'outbox.jsonl');
    if (existsSync(outboxFile)) rmSync(outboxFile);
    const linkedExport = exportPendingEvents();
    expect(linkedExport).toHaveLength(1);
    expect(linkedExport[0].event_type).toBe('document.linked');
    expect(linkedExport[0].event_id).toBe(docId);
    expect(linkedExport[0].ingestion_event_id).toBeTruthy();
    expect(linkedExport[0].ingestion_event_id).toMatch(/^[a-f0-9-]{36}$/);
    expect(linkedExport[0].document.document_id).toBe(docId);

    const acceptResult = acceptDocument(docId);
    expect(acceptResult.status).toBe('accepted');
    expect(acceptResult.pedidoManual).toBe('PED-25-2026');

    const accepted = db.prepare(`SELECT status FROM documentos WHERE id = ?`).get(docId) as any;
    expect(accepted.status).toBe('accepted');

    db.prepare(`UPDATE ingestion_events SET exported_at = NULL WHERE document_id = ?`).run(docId);
    if (existsSync(outboxFile)) rmSync(outboxFile);
    const acceptExport = exportPendingEvents();
    const acceptedEvent = acceptExport.find(e => e.event_type === 'document.accepted');
    expect(acceptedEvent).toBeTruthy();
    expect(acceptedEvent!.status).toBe('accepted');
    expect(acceptedEvent!.ingestion_event_id).toBeTruthy();
    expect(acceptedEvent!.ingestion_event_id).not.toBe(linkedExport[0].ingestion_event_id);

    const evts = db.prepare(`SELECT event_type, status, id FROM ingestion_events WHERE document_id = ? ORDER BY created_at`).all(docId) as any[];
    expect(evts).toHaveLength(2);
    expect(evts[0].event_type).toBe('document.linked');
    expect(evts[1].event_type).toBe('document.accepted');
    expect(evts[0].id).not.toBe(evts[1].id);
  });

  it('2. document.detected → link → reject with reason → document.rejected', () => {
    const db = getDb();
    const docId = seedDoc(db, {
      tipo: 'nf', formato: 'pdf', direcao: 'desconhecida',
      filename: 'NF-reject.pdf',
    });

    const linkResult = linkDocumentToPedido(docId, '50/2026');
    expect(linkResult.warnedDirection).toBe(true);
    expect(linkResult.pedidoManual).toBe('PED-50-2026');

    const rejectResult = rejectDocument(docId, 'Documento duplicado');
    expect(rejectResult.status).toBe('rejected');
    expect(rejectResult.pedidoManual).toBe('PED-50-2026');

    const rejected = db.prepare(`SELECT status FROM documentos WHERE id = ?`).get(docId) as any;
    expect(rejected.status).toBe('rejected');

    const outboxFile = join(SCENARIO_DIR, 'outbox.jsonl');
    const initialLines = readFileSync(outboxFile, 'utf-8').trim().split('\n').filter(Boolean);
    const initialReject = initialLines.map(l => JSON.parse(l)).find((e: any) => e.event_type === 'document.rejected');
    expect(initialReject).toBeTruthy();
    expect(initialReject.document.reason).toBe('Documento duplicado');

    db.prepare(`UPDATE ingestion_events SET exported_at = NULL WHERE document_id = ?`).run(docId);
    if (existsSync(outboxFile)) rmSync(outboxFile);
    const exported = exportPendingEvents();
    const rejectEvent = exported.find(e => e.event_type === 'document.rejected');
    expect(rejectEvent).toBeTruthy();
    expect(rejectEvent!.status).toBe('rejected');
    expect(rejectEvent!.document.reason).toBe('Documento duplicado');
    expect(rejectEvent!.event_id).toBe(docId);
    expect(rejectEvent!.ingestion_event_id).toBeTruthy();
  });

  it('3. direction warning does not block link for unknown direction', () => {
    const db = getDb();
    const docId = seedDoc(db, { direcao: 'desconhecida' });
    const result = linkDocumentToPedido(docId, '25/2026');
    expect(result.warnedDirection).toBe(true);
    expect(result.documentId).toBe(docId);

    const linked = db.prepare(`SELECT status, pedido_manual FROM documentos WHERE id = ?`).get(docId) as any;
    expect(linked.status).toBe('assigned');
    expect(linked.pedido_manual).toBe('PED-25-2026');

    const outboxFile = join(SCENARIO_DIR, 'outbox.jsonl');
    const lines = readFileSync(outboxFile, 'utf-8').trim().split('\n').filter(Boolean);
    const linkedEvents = lines.map(l => JSON.parse(l)).filter((e: any) => e.event_type === 'document.linked');
    expect(linkedEvents).toHaveLength(1);

    db.prepare(`UPDATE ingestion_events SET exported_at = NULL WHERE document_id = ?`).run(docId);
    if (existsSync(outboxFile)) rmSync(outboxFile);
    const exported = exportPendingEvents();
    expect(exported).toHaveLength(1);
    expect(exported[0].event_type).toBe('document.linked');
  });

  it('4. report shows funnel sections and correct counters', () => {
    const db = getDb();
    const doc1 = seedDoc(db, { gmailMessageId: 'smoke-report-1' });
    const doc2 = seedDoc(db, { gmailMessageId: 'smoke-report-2' });

    linkDocumentToPedido(doc1, '25/2026');
    linkDocumentToPedido(doc2, '50/2026');
    acceptDocument(doc1);
    rejectDocument(doc2, 'Inválido');

    const report = generateReport();

    expect(report.totalDocuments).toBe(2);
    expect(report.documentsAccepted).toBe(1);
    expect(report.documentsRejected).toBe(1);
    expect(report.documentsByStatus.accepted).toBe(1);
    expect(report.documentsByStatus.rejected).toBe(1);
    expect(report.documentsByTipo.nf).toBe(2);
    expect(report.documentsByFormato.xml).toBe(2);
    expect(report.documentsByDirecao.entrada).toBe(2);
    expect(report.nfByDirecao.entrada).toBe(2);
    expect(report.pendingAppAcceptance).toBe(2);
  });
});
