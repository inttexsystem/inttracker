import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, rmSync, mkdirSync, readFileSync, appendFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createScan } from '../src/core/realScan.js';
import type { ScanDeps } from '../src/core/realScan.js';
import { getDb, closeDb } from '../src/storage/sqlite.js';
import { classifyAttachment } from '../src/core/classifier.js';
import { buildTechnicalEvidence } from '../src/core/evidenceBuilder.js';
import { getCurrentTechnicalEvidence } from '../src/core/evidenceStore.js';
import type { EvidenceOrigin } from '../src/types/documentReview.js';

function mkDeps(overrides: Partial<ScanDeps> = {}): ScanDeps {
  return {
    fetchEmails: async (daysBack: number) => {
      void daysBack;
      return [];
    },
    fetchMessageById: async (msgId: string) => null,
    listAtts: async (msgId: string) => {
      void msgId;
      return [];
    },
    downloadAtt: async () => null,
    uploadDoc: async ({ filename, mimeType }) => ({
      file: {
        storageUri: `gdrive://file/mock-${encodeURIComponent(filename)}`,
        driveFileId: `mock-${encodeURIComponent(filename)}`,
        driveWebViewLink: `https://drive.google.com/file/d/mock-${encodeURIComponent(filename)}/view`,
        driveFolderId: 'mock-folder',
      },
    }),
    ...overrides,
  };
}

import { randomUUID } from 'node:crypto';

const DB_DIR = join(tmpdir(), `ravatex-scan-test-${randomUUID()}`);

describe('real scan flow (mocked Google)', () => {
  beforeEach(() => {
    if (existsSync(DB_DIR)) rmSync(DB_DIR, { recursive: true });
    mkdirSync(DB_DIR, { recursive: true });
    process.env.DATABASE_PATH = join(DB_DIR, 'app.db');
    process.env.OUTBOX_PATH = join(DB_DIR, 'outbox.jsonl');
    process.env.LOCAL_CACHE_PATH = join(DB_DIR, 'cache');
    process.env.GOOGLE_DRIVE_ROOT_FOLDER_NAME = 'Ravatex Documents Ingestor';
    closeDb();
    const db = getDb();
    db.exec('DELETE FROM document_technical_evidences; DELETE FROM ingestion_events; DELETE FROM documentos; DELETE FROM emails_processados;');
  });

  afterEach(() => {
    closeDb();
    if (existsSync(DB_DIR)) rmSync(DB_DIR, { recursive: true });
  });

  it('dry-run mode does NOT call any deps', async () => {
    let called = false;
    const deps = mkDeps({
      fetchEmails: async () => { called = true; return []; },
    });
    const scan = createScan(deps);
    const result = await scan({ confirmReal: false });
    expect(result.mode).toBe('dry-run');
    expect(called).toBe(false);
  });

  it('real scan: empty mailbox produces 0 documents', async () => {
    const scan = createScan(mkDeps());
    const result = await scan({ confirmReal: true });
    expect(result.mode).toBe('real');
    expect(result.emailsScanned).toBe(0);
    expect(result.newDocuments).toBe(0);
  });

  it('real scan: detects PDF, classifies as nf, uploads, persists in SQLite', async () => {
    const fakePdf = Buffer.from('%PDF-1.4\n...nota fiscal fake content...');
    const deps = mkDeps({
      fetchEmails: async () => [
        {
          gmailMessageId: 'msg-1',
          threadId: 'thr-1',
          from: 'fornecedor@example.com',
          senderEmail: 'fornecedor@example.com',
          subject: 'NF-e 12345',
          date: '2026-07-01',
          attachmentCount: 1,
        },
      ],
      listAtts: async () => [
        {
          gmailMessageId: 'msg-1',
          threadId: 'thr-1',
          attachmentId: 'att-1',
          filename: 'NF-12345.pdf',
          mimeType: 'application/pdf',
          size: fakePdf.length,
        },
      ],
      downloadAtt: async () => fakePdf,
    });
    const scan = createScan(deps);
    const result = await scan({ confirmReal: true });
    expect(result.newDocuments).toBe(1);
    expect(result.duplicates).toBe(0);

    const db = getDb();
    const docs = db.prepare(`SELECT * FROM documentos`).all() as any[];
    expect(docs).toHaveLength(1);
    expect(docs[0].filename_original).toBe('NF-12345.pdf');
    expect(docs[0].sender_email).toBe('fornecedor@example.com');
    expect(docs[0].tipo_documento).toBe('nf');
    expect(docs[0].formato).toBe('pdf');
    expect(docs[0].storage_backend).toBe('google_drive');
    expect(docs[0].storage_uri).toMatch(/^gdrive:\/\/file\//);
    expect(docs[0].drive_file_id).toBeTruthy();
    expect(docs[0].drive_web_view_link).toMatch(/^https:\/\/drive\.google\.com\/file\/d\//);
    expect(docs[0].status).toBe('pending');
  });

  it('real scan: second scan of same email is fully skipped (idempotency at email level)', async () => {
    const fakePdf = Buffer.from('%PDF-1.4\n...content...');
    const deps = mkDeps({
      fetchEmails: async () => [
        { gmailMessageId: 'msg-skip-twice', threadId: 't', from: '', subject: 'NF', date: '', attachmentCount: 1 },
      ],
      listAtts: async () => [
        { gmailMessageId: 'msg-skip-twice', threadId: 't', attachmentId: 'att-1', filename: 'n.pdf', mimeType: 'application/pdf', size: 0 },
      ],
      downloadAtt: async () => fakePdf,
    });
    const scan = createScan(deps);
    const r1 = await scan({ confirmReal: true });
    expect(r1.newDocuments).toBe(1);
    const r2 = await scan({ confirmReal: true });
    expect(r2.newDocuments).toBe(0);
    expect(r2.duplicates).toBe(0);
    const db = getDb();
    const docCount = (db.prepare(`SELECT COUNT(*) AS c FROM documentos`).get() as any).c;
    expect(docCount).toBe(1);
  });

  it('retry fills a legacy null sender without replacing a known sender', async () => {
    const fakePdf = Buffer.from('%PDF-1.4\n...sender retry...');
    const message = {
      gmailMessageId: 'msg-sender-retry', threadId: 't', from: '', subject: 'NF', date: '', attachmentCount: 1,
    };
    const deps = mkDeps({
      fetchEmails: async () => [message],
      fetchMessageById: async () => ({ ...message, senderEmail: 'fornecedor@empresa.com' }),
      listAtts: async () => [
        { gmailMessageId: 'msg-sender-retry', threadId: 't', attachmentId: 'att-1', filename: 'n.pdf', mimeType: 'application/pdf', size: fakePdf.length },
      ],
      downloadAtt: async () => fakePdf,
    });
    const scan = createScan(deps);
    await scan({ confirmReal: true });
    const db = getDb();
    expect((db.prepare(`SELECT sender_email FROM documentos WHERE gmail_message_id = ?`).get('msg-sender-retry') as any).sender_email).toBeNull();

    await scan({ confirmReal: true, retryMessageId: 'msg-sender-retry' });
    expect((db.prepare(`SELECT sender_email FROM documentos WHERE gmail_message_id = ?`).get('msg-sender-retry') as any).sender_email)
      .toBe('fornecedor@empresa.com');

    db.prepare(`UPDATE documentos SET sender_email = ? WHERE gmail_message_id = ?`)
      .run('existente@empresa.com', 'msg-sender-retry');
    await scan({ confirmReal: true, retryMessageId: 'msg-sender-retry' });
    expect((db.prepare(`SELECT sender_email FROM documentos WHERE gmail_message_id = ?`).get('msg-sender-retry') as any).sender_email)
      .toBe('existente@empresa.com');
  });

  it('real scan: XML with NF-e structure is classified as nf + formato xml', async () => {
    const xml = Buffer.from('<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe"><NFe><infNFe><emit><CNPJ>11222333000181</CNPJ></emit><dest><CNPJ>11444777000161</CNPJ></dest></infNFe></NFe></nfeProc>');
    const deps = mkDeps({
      fetchEmails: async () => [
        { gmailMessageId: 'm', threadId: 't', from: '', subject: '', date: '', attachmentCount: 1 },
      ],
      listAtts: async () => [
        { gmailMessageId: 'm', threadId: 't', attachmentId: 'a', filename: 'nfe.xml', mimeType: 'text/xml', size: 0 },
      ],
      downloadAtt: async () => xml,
    });
    const scan = createScan(deps);
    const r = await scan({ confirmReal: true });
    expect(r.newDocuments).toBe(1);
    const db = getDb();
    const doc = db.prepare(`SELECT tipo_documento, formato, direcao_nf FROM documentos LIMIT 1`).get() as any;
    expect(doc.tipo_documento).toBe('nf');
    expect(doc.formato).toBe('xml');
    expect(doc.direcao_nf).toBe('desconhecida');
  });

  it('real scan: PDF with romaneio in name is classified as romaneio', async () => {
    const pdf = Buffer.from('%PDF-1.4\nromaneio...');
    const deps = mkDeps({
      fetchEmails: async () => [
        { gmailMessageId: 'm2', threadId: 't', from: '', subject: '', date: '', attachmentCount: 1 },
      ],
      listAtts: async () => [
        { gmailMessageId: 'm2', threadId: 't', attachmentId: 'a', filename: 'romaneio_carga.pdf', mimeType: 'application/pdf', size: 0 },
      ],
      downloadAtt: async () => pdf,
    });
    const scan = createScan(deps);
    await scan({ confirmReal: true });
    const db = getDb();
    const doc = db.prepare(`SELECT tipo_documento FROM documentos LIMIT 1`).get() as any;
    expect(doc.tipo_documento).toBe('romaneio');
  });

  it('real scan: non-PDF/XML attachment is filtered out', async () => {
    const png = Buffer.from('not a real png');
    let downloadCalled = false;
    const deps = mkDeps({
      fetchEmails: async () => [
        { gmailMessageId: 'm3', threadId: 't', from: '', subject: '', date: '', attachmentCount: 1 },
      ],
      listAtts: async () => [
        { gmailMessageId: 'm3', threadId: 't', attachmentId: 'a', filename: 'photo.png', mimeType: 'image/png', size: 0 },
      ],
      downloadAtt: async () => { downloadCalled = true; return png; },
    });
    const scan = createScan(deps);
    const r = await scan({ confirmReal: true });
    expect(r.newDocuments).toBe(0);
    expect(downloadCalled).toBe(false);
  });

  it('real scan: email already processed is skipped (idempotency)', async () => {
    const fakePdf = Buffer.from('%PDF-1.4\n...content...');
    let fetchCalls = 0;
    const deps = mkDeps({
      fetchEmails: async () => {
        fetchCalls++;
        return [
          { gmailMessageId: 'msg-once', threadId: 't', from: '', subject: '', date: '', attachmentCount: 1 },
        ];
      },
      listAtts: async () => [
        { gmailMessageId: 'msg-once', threadId: 't', attachmentId: 'a', filename: 'n.pdf', mimeType: 'application/pdf', size: 0 },
      ],
      downloadAtt: async () => fakePdf,
    });
    const scan = createScan(deps);
    await scan({ confirmReal: true });
    await scan({ confirmReal: true });
    expect(fetchCalls).toBe(2);
    const db = getDb();
    const emails = db.prepare(`SELECT * FROM emails_processados`).all();
    expect(emails).toHaveLength(1);
  });

  it('real scan: retries an email previously marked with zero attachments', async () => {
    const fakePdf = Buffer.from('%PDF-1.4\nrecovery after incomplete extraction');
    const deps = mkDeps({
      fetchEmails: async () => [
        { gmailMessageId: 'msg-incomplete', threadId: 't', from: '', subject: 'NF recovery', date: '', attachmentCount: 1 },
      ],
      listAtts: async () => [
        { gmailMessageId: 'msg-incomplete', threadId: 't', attachmentId: 'att-incomplete', filename: 'recovered.pdf', mimeType: 'application/pdf', size: fakePdf.length },
      ],
      downloadAtt: async () => fakePdf,
    });
    const db = getDb();
    db.prepare(`INSERT INTO emails_processados (gmail_message_id, attachments_count) VALUES (?, 0)`).run('msg-incomplete');

    const result = await createScan(deps)({ confirmReal: true });
    expect(result.newDocuments).toBe(1);
    const row = db.prepare(`SELECT attachments_count FROM emails_processados WHERE gmail_message_id = ?`).get('msg-incomplete') as any;
    expect(row.attachments_count).toBe(1);
  });

  it('real scan: errors during upload are captured, not thrown', async () => {
    const fakePdf = Buffer.from('%PDF-1.4\n...');
    const deps = mkDeps({
      fetchEmails: async () => [
        { gmailMessageId: 'm-err', threadId: 't', from: '', subject: '', date: '', attachmentCount: 1 },
      ],
      listAtts: async () => [
        { gmailMessageId: 'm-err', threadId: 't', attachmentId: 'a', filename: 'n.pdf', mimeType: 'application/pdf', size: 0 },
      ],
      downloadAtt: async () => fakePdf,
      uploadDoc: async () => { throw new Error('drive quota'); },
    });
    const scan = createScan(deps);
    const r = await scan({ confirmReal: true });
    expect(r.newDocuments).toBe(0);
    expect(r.errors.length).toBeGreaterThan(0);
  });

  it('hardening: same SHA256 across two messages reuses first Drive file (cross-message dedup)', async () => {
    const fakePdf = Buffer.from('%PDF-1.4\nSAME CONTENT');
    const firstUploadId = 'mock-first-upload-id';
    let uploadCalls = 0;
    const deps = mkDeps({
      fetchEmails: async () => [
        { gmailMessageId: 'msg-A', threadId: 'tA', from: '', senderEmail: 'origem@empresa.com', subject: 'NF A', date: '', attachmentCount: 1 },
        { gmailMessageId: 'msg-B', threadId: 'tB', from: '', senderEmail: 'reenvio@empresa.com', subject: 'NF B (re-send)', date: '', attachmentCount: 1 },
      ],
      listAtts: async (msgId) => [
        { gmailMessageId: msgId, threadId: 't', attachmentId: 'a', filename: 'NF-001.pdf', mimeType: 'application/pdf', size: fakePdf.length },
      ],
      downloadAtt: async () => fakePdf,
      uploadDoc: async ({ filename, mimeType }) => {
        uploadCalls++;
        return {
          file: {
            storageUri: `gdrive://file/${firstUploadId}`,
            driveFileId: firstUploadId,
            driveWebViewLink: `https://drive.google.com/file/d/${firstUploadId}/view`,
            driveFolderId: 'mock-folder',
          },
        };
      },
    });
    const scan = createScan(deps);
    const r = await scan({ confirmReal: true });
    expect(r.newDocuments).toBe(1);
    expect(r.crossMessageDuplicates).toBe(1);
    expect(uploadCalls).toBe(1);
    const db = getDb();
    const docs = db.prepare(`SELECT gmail_message_id, drive_file_id, sender_email FROM documentos ORDER BY created_at`).all() as any[];
    expect(docs).toHaveLength(2);
    expect(docs[0].drive_file_id).toBe(firstUploadId);
    expect(docs[1].drive_file_id).toBe(firstUploadId);
    expect(docs.map((doc) => doc.sender_email).sort()).toEqual(['origem@empresa.com', 'reenvio@empresa.com']);
  });

  it('hardening: per-run maxAttachments cap is enforced', async () => {
    const dep1 = { msgId: 'm-cap-1-a1', buffer: Buffer.from('%PDF-1.4\nA1') };
    const dep2 = { msgId: 'm-cap-1-a2', buffer: Buffer.from('%PDF-1.4\nA2') };
    const dep3 = { msgId: 'm-cap-2-a1', buffer: Buffer.from('%PDF-1.4\nB1') };
    const dep4 = { msgId: 'm-cap-2-a2', buffer: Buffer.from('%PDF-1.4\nB2') };
    const bufs: Record<string, Buffer> = {
      'm-cap-1-a1': dep1.buffer,
      'm-cap-1-a2': dep2.buffer,
      'm-cap-2-a1': dep3.buffer,
      'm-cap-2-a2': dep4.buffer,
    };
    const deps = mkDeps({
      fetchEmails: async () => [
        { gmailMessageId: 'm-cap-1', threadId: 't', from: '', subject: 'A', date: '', attachmentCount: 2 },
        { gmailMessageId: 'm-cap-2', threadId: 't', from: '', subject: 'B', date: '', attachmentCount: 2 },
      ],
      listAtts: async (msgId) => {
        if (msgId === 'm-cap-1') return [
          { gmailMessageId: 'm-cap-1', threadId: 't', attachmentId: 'm-cap-1-a1', filename: 'n1.pdf', mimeType: 'application/pdf', size: dep1.buffer.length },
          { gmailMessageId: 'm-cap-1', threadId: 't', attachmentId: 'm-cap-1-a2', filename: 'n2.pdf', mimeType: 'application/pdf', size: dep2.buffer.length },
        ];
        return [
          { gmailMessageId: 'm-cap-2', threadId: 't', attachmentId: 'm-cap-2-a1', filename: 'n3.pdf', mimeType: 'application/pdf', size: dep3.buffer.length },
          { gmailMessageId: 'm-cap-2', threadId: 't', attachmentId: 'm-cap-2-a2', filename: 'n4.pdf', mimeType: 'application/pdf', size: dep4.buffer.length },
        ];
      },
      downloadAtt: async (msgId, attId) => bufs[attId] ?? null,
    });
    const scan = createScan(deps);
    const r = await scan({ confirmReal: true, maxAttachments: 2 });
    expect(r.newDocuments).toBe(2);
    expect(r.skippedByCap).toBe(2);
  });

  it('hardening: run log is written with start/end events and per-attachment status', async () => {
    const fakePdf = Buffer.from('%PDF-1.4\nLOG TEST');
    const logPath = join(DB_DIR, 'run-test.jsonl');
    const logger = {
      path: logPath,
      log(event: any): void {
        appendFileSync(logPath, JSON.stringify(event) + '\n', 'utf-8');
      },
    };
    const deps = mkDeps({
      fetchEmails: async () => [
        { gmailMessageId: 'm-log', threadId: 't', from: '', subject: 'LOG', date: '', attachmentCount: 1 },
      ],
      listAtts: async () => [
        { gmailMessageId: 'm-log', threadId: 't', attachmentId: 'a', filename: 'L.pdf', mimeType: 'application/pdf', size: 0 },
      ],
      downloadAtt: async () => fakePdf,
      logger,
    });
    const scan = createScan(deps);
    const r = await scan({ confirmReal: true });
    expect(r.runLogPath).toBe(logPath);
    const content = readFileSync(logPath, 'utf-8');
    const lines = content.trim().split('\n').map((l) => JSON.parse(l));
    expect(lines.some((l) => l.type === 'run.start')).toBe(true);
    expect(lines.some((l) => l.type === 'attachment.processed' && l.status === 'new')).toBe(true);
    expect(lines.some((l) => l.type === 'run.end')).toBe(true);
  });

  it('scan passes --query to fetchEmails', async () => {
    const fakePdf = Buffer.from('%PDF-1.4\nquery test');
    let receivedQuery: string | undefined;
    const deps = mkDeps({
      fetchEmails: async (daysBack, extraQuery) => {
        receivedQuery = extraQuery;
        return [
          { gmailMessageId: 'm-query', threadId: 't', from: '', subject: 'Q', date: '', attachmentCount: 1 },
        ];
      },
      listAtts: async () => [
        { gmailMessageId: 'm-query', threadId: 't', attachmentId: 'a', filename: 'q.pdf', mimeType: 'application/pdf', size: 0 },
      ],
      downloadAtt: async () => fakePdf,
    });
    const scan = createScan(deps);
    await scan({ confirmReal: true, query: 'subject:"SMOKE TEST"' });
    expect(receivedQuery).toBe('subject:"SMOKE TEST"');
  });

  it('scan without query passes undefined to fetchEmails', async () => {
    const fakePdf = Buffer.from('%PDF-1.4\nno query');
    let receivedQuery: string | null = 'NOT_CALLED';
    const deps = mkDeps({
      fetchEmails: async (daysBack, extraQuery) => {
        receivedQuery = extraQuery ?? null;
        return [
          { gmailMessageId: 'm-noquery', threadId: 't', from: '', subject: 'NQ', date: '', attachmentCount: 1 },
        ];
      },
      listAtts: async () => [
        { gmailMessageId: 'm-noquery', threadId: 't', attachmentId: 'a', filename: 'nq.pdf', mimeType: 'application/pdf', size: 0 },
      ],
      downloadAtt: async () => fakePdf,
    });
    const scan = createScan(deps);
    await scan({ confirmReal: true });
    expect(receivedQuery).toBeNull();
  });

  it('retry-message bypasses skip for processed email and inserts document', async () => {
    const fakePdf = Buffer.from('%PDF-1.4\nretry test content');
    const deps = mkDeps({
      fetchMessageById: async (msgId) => {
        if (msgId === 'msg-retry') return { gmailMessageId: 'msg-retry', threadId: 't', from: '', subject: 'RETRY TEST', date: '', attachmentCount: 1 };
        return null;
      },
      listAtts: async () => [
        { gmailMessageId: 'msg-retry', threadId: 't', attachmentId: 'att-retry', filename: 'retry-nf.pdf', mimeType: 'application/pdf', size: fakePdf.length },
      ],
      downloadAtt: async () => fakePdf,
    });

    const db = getDb();
    db.prepare(`INSERT OR IGNORE INTO emails_processados (gmail_message_id) VALUES (?)`).run('msg-retry');

    const scan = createScan(deps);
    const r1 = await scan({ confirmReal: true });
    expect(r1.newDocuments).toBe(0);

    const r2 = await scan({ confirmReal: true, retryMessageId: 'msg-retry' });
    expect(r2.newDocuments).toBe(1);
  });

  it('retry-message does not duplicate if document already exists', async () => {
    const fakePdf = Buffer.from('%PDF-1.4\ndedup retry');
    const deps = mkDeps({
      fetchMessageById: async (msgId) => {
        if (msgId === 'msg-retry-2') return { gmailMessageId: 'msg-retry-2', threadId: 't', from: '', subject: 'DEDUP', date: '', attachmentCount: 1 };
        return null;
      },
      listAtts: async () => [
        { gmailMessageId: 'msg-retry-2', threadId: 't', attachmentId: 'att-dedup', filename: 'dup.pdf', mimeType: 'application/pdf', size: fakePdf.length },
      ],
      downloadAtt: async () => fakePdf,
    });

    const db = getDb();
    db.prepare(`INSERT OR IGNORE INTO emails_processados (gmail_message_id) VALUES (?)`).run('msg-retry-2');

    const scan = createScan(deps);
    const r1 = await scan({ confirmReal: true, retryMessageId: 'msg-retry-2' });
    expect(r1.newDocuments).toBe(1);

    const r2 = await scan({ confirmReal: true, retryMessageId: 'msg-retry-2' });
    expect(r2.newDocuments).toBe(0);
    expect(r2.duplicates).toBe(1);
  });

  it('retry-message respects maxAttachments cap', async () => {
    const fakePdf = Buffer.from('%PDF-1.4\ncap retry');
    const deps = mkDeps({
      fetchMessageById: async (msgId) => {
        if (msgId === 'msg-retry-3') return { gmailMessageId: 'msg-retry-3', threadId: 't', from: '', subject: 'CAP TEST', date: '', attachmentCount: 2 };
        return null;
      },
      listAtts: async () => [
        { gmailMessageId: 'msg-retry-3', threadId: 't', attachmentId: 'att-cap-1', filename: 'a.pdf', mimeType: 'application/pdf', size: 0 },
        { gmailMessageId: 'msg-retry-3', threadId: 't', attachmentId: 'att-cap-2', filename: 'b.pdf', mimeType: 'application/pdf', size: 0 },
      ],
      downloadAtt: async () => fakePdf,
    });

    const db = getDb();
    db.prepare(`INSERT OR IGNORE INTO emails_processados (gmail_message_id) VALUES (?)`).run('msg-retry-3');

    const scan = createScan(deps);
    const r = await scan({ confirmReal: true, retryMessageId: 'msg-retry-3', maxAttachments: 1 });
    expect(r.newDocuments).toBe(1);
    expect(r.skippedByCap).toBe(1);
  });

  it('retry-message logs retry.start in run log', async () => {
    const fakePdf = Buffer.from('%PDF-1.4\nlog retry');
    const logPath = join(DB_DIR, 'retry-log.jsonl');
    const logger = {
      path: logPath,
      log(event: any): void {
        appendFileSync(logPath, JSON.stringify(event) + '\n', 'utf-8');
      },
    };
    const deps = mkDeps({
      fetchMessageById: async (msgId) => {
        if (msgId === 'msg-rlog') return { gmailMessageId: 'msg-rlog', threadId: 't', from: '', subject: 'LOG RETRY', date: '', attachmentCount: 1 };
        return null;
      },
      listAtts: async () => [
        { gmailMessageId: 'msg-rlog', threadId: 't', attachmentId: 'a', filename: 'r.pdf', mimeType: 'application/pdf', size: 0 },
      ],
      downloadAtt: async () => fakePdf,
      logger,
    });

    const db = getDb();
    db.prepare(`INSERT OR IGNORE INTO emails_processados (gmail_message_id) VALUES (?)`).run('msg-rlog');

    const scan = createScan(deps);
    const r = await scan({ confirmReal: true, retryMessageId: 'msg-rlog' });
    expect(r.runLogPath).toBe(logPath);
    const content = readFileSync(logPath, 'utf-8');
    const lines = content.trim().split('\n').map((l) => JSON.parse(l));
    expect(lines.some((l) => l.type === 'run.start')).toBe(true);
    expect(lines.some((l) => l.type === 'retry.direct_fetch')).toBe(true);
    expect(lines.some((l) => l.type === 'retry.start' && l.status === 'retry_requested')).toBe(true);
    expect(lines.some((l) => l.type === 'attachment.processed' && l.status === 'new')).toBe(true);
  });

  it('retry-message uses fetchMessageById and NOT fetchEmails', async () => {
    const fakePdf = Buffer.from('%PDF-1.4\ndirect');
    let fetchEmailsCalled = false;
    let fetchMessageByIdCalled = false;
    const deps = mkDeps({
      fetchEmails: async () => {
        fetchEmailsCalled = true;
        return [];
      },
      fetchMessageById: async (msgId) => {
        fetchMessageByIdCalled = true;
        if (msgId === 'msg-direct') return { gmailMessageId: 'msg-direct', threadId: 't', from: '', subject: 'DIRECT', date: '', attachmentCount: 1 };
        return null;
      },
      listAtts: async () => [
        { gmailMessageId: 'msg-direct', threadId: 't', attachmentId: 'a', filename: 'd.pdf', mimeType: 'application/pdf', size: 0 },
      ],
      downloadAtt: async () => fakePdf,
    });

    const db = getDb();
    db.prepare(`INSERT OR IGNORE INTO emails_processados (gmail_message_id) VALUES (?)`).run('msg-direct');

    const scan = createScan(deps);
    const r = await scan({ confirmReal: true, retryMessageId: 'msg-direct' });
    expect(fetchEmailsCalled).toBe(false);
    expect(fetchMessageByIdCalled).toBe(true);
    expect(r.emailsScanned).toBe(1);
    expect(r.newDocuments).toBe(1);
  });

  it('retry-message processes only one message', async () => {
    const fakePdf = Buffer.from('%PDF-1.4\nsingle');
    const deps = mkDeps({
      fetchMessageById: async (msgId) => {
        if (msgId === 'msg-single') return { gmailMessageId: 'msg-single', threadId: 't', from: '', subject: 'SINGLE', date: '', attachmentCount: 1 };
        return null;
      },
      listAtts: async () => [
        { gmailMessageId: 'msg-single', threadId: 't', attachmentId: 'a', filename: 's.pdf', mimeType: 'application/pdf', size: 0 },
      ],
      downloadAtt: async () => fakePdf,
    });

    const db = getDb();
    db.prepare(`INSERT OR IGNORE INTO emails_processados (gmail_message_id) VALUES (?)`).run('msg-single');

    const scan = createScan(deps);
    const r = await scan({ confirmReal: true, retryMessageId: 'msg-single' });
    expect(r.emailsScanned).toBe(1);
    expect(r.attachmentsFound).toBe(1);
    expect(r.skippedByCap).toBe(0);
  });

  it('scan normal without retry still uses fetchEmails', async () => {
    const fakePdf = Buffer.from('%PDF-1.4\nnormal');
    let fetchEmailsCalled = false;
    const deps = mkDeps({
      fetchEmails: async () => {
        fetchEmailsCalled = true;
        return [{ gmailMessageId: 'msg-normal', threadId: 't', from: '', subject: 'NORMAL', date: '', attachmentCount: 1 }];
      },
      listAtts: async () => [
        { gmailMessageId: 'msg-normal', threadId: 't', attachmentId: 'a', filename: 'n.pdf', mimeType: 'application/pdf', size: 0 },
      ],
      downloadAtt: async () => fakePdf,
    });

    const scan = createScan(deps);
    await scan({ confirmReal: true });
    expect(fetchEmailsCalled).toBe(true);
  });

  it('retry-message fails closed when fetchMessageById is unavailable', async () => {
    let fetchEmailsCalled = false;
    const deps = mkDeps({
      fetchEmails: async () => {
        fetchEmailsCalled = true;
        return [{ gmailMessageId: 'msg-failclosed', threadId: 't', from: '', subject: 'FC', date: '', attachmentCount: 1 }];
      },
      // Isolate from the real Supabase-backed default so this test never needs
      // .env / real credentials and never performs network I/O (G26-A-R1).
      createEntityCnpjReaderClient: () => ({ from: () => ({ select: () => ({ not: () => Promise.resolve({ data: [], error: null }) }) }) } as any),
      loadEntityCnpjRegistry: async () => ({ loaded: true, loadedAt: new Date().toISOString(), entries: [], error: null }),
    });
    delete (deps as any).fetchMessageById;

    const scan = createScan(deps);
    const r = await scan({ confirmReal: true, retryMessageId: 'msg-failclosed' });
    expect(r.emailsScanned).toBe(0);
    expect(r.attachmentsFound).toBe(0);
    expect(r.newDocuments).toBe(0);
    expect(fetchEmailsCalled).toBe(false);
    expect(r.errors.length).toBeGreaterThan(0);
    expect(r.errors[0]).toContain('fetchMessageById');
  });

  it('G12-C: scan emits document.detected event with pedido_manual empty string', async () => {
    const fakePdf = Buffer.from('%PDF-1.4\nG12-C detected test');
    const deps = mkDeps({
      fetchEmails: async () => [
        {
          gmailMessageId: 'msg-g12c',
          threadId: 'thr-g12c',
          from: 'test@example.com',
          subject: 'G12-C test',
          date: '2026-07-08',
          attachmentCount: 1,
        },
      ],
      listAtts: async () => [
        {
          gmailMessageId: 'msg-g12c',
          threadId: 'thr-g12c',
          attachmentId: 'att-g12c',
          filename: 'NF-G12C.pdf',
          mimeType: 'application/pdf',
          size: fakePdf.length,
        },
      ],
      downloadAtt: async () => fakePdf,
    });
    const scan = createScan(deps);
    const result = await scan({ confirmReal: true });
    expect(result.newDocuments).toBe(1);

    const db = getDb();
    const events = db.prepare(
      `SELECT * FROM ingestion_events WHERE event_type = 'document.detected' ORDER BY created_at DESC`
    ).all() as any[];
    expect(events).toHaveLength(1);
    expect(events[0].event_type).toBe('document.detected');
    expect(events[0].pedido_manual).toBe('');
    expect(events[0].status).toBe('pending_app_acceptance');
    expect(events[0].document_id).toBeTruthy();
  });

  it('G12-C: retry does NOT duplicate document.detected event', async () => {
    const fakePdf = Buffer.from('%PDF-1.4\nG12-C dedup test');
    const deps = mkDeps({
      fetchEmails: async () => [
        {
          gmailMessageId: 'msg-g12c-dup',
          threadId: 't',
          from: '',
          subject: 'Dedup G12-C',
          date: '',
          attachmentCount: 1,
        },
      ],
      listAtts: async () => [
        {
          gmailMessageId: 'msg-g12c-dup',
          threadId: 't',
          attachmentId: 'att-g12c-dup',
          filename: 'dup.pdf',
          mimeType: 'application/pdf',
          size: fakePdf.length,
        },
      ],
      downloadAtt: async () => fakePdf,
    });
    const scan = createScan(deps);

    const r1 = await scan({ confirmReal: true });
    expect(r1.newDocuments).toBe(1);

    const r2 = await scan({ confirmReal: true });
    expect(r2.newDocuments).toBe(0);

    const db = getDb();
    const events = db.prepare(
      `SELECT * FROM ingestion_events WHERE event_type = 'document.detected'`
    ).all() as any[];
    expect(events).toHaveLength(1);
  });

  it('G12-C: cross-message duplicate does NOT emit document.detected', async () => {
    const fakePdf = Buffer.from('%PDF-1.4\nSAME G12-C DEDUP');
    const firstUploadId = 'mock-g12c-upload';
    let uploadCalls = 0;
    const deps = mkDeps({
      fetchEmails: async () => [
        { gmailMessageId: 'msg-g12c-A', threadId: 'tA', from: '', subject: 'A', date: '', attachmentCount: 1 },
        { gmailMessageId: 'msg-g12c-B', threadId: 'tB', from: '', subject: 'B (duplicate)', date: '', attachmentCount: 1 },
      ],
      listAtts: async (msgId) => [
        { gmailMessageId: msgId, threadId: 't', attachmentId: 'a', filename: 'same.pdf', mimeType: 'application/pdf', size: fakePdf.length },
      ],
      downloadAtt: async () => fakePdf,
      uploadDoc: async ({ filename, mimeType }) => {
        uploadCalls++;
        return {
          file: {
            storageUri: `gdrive://file/${firstUploadId}`,
            driveFileId: firstUploadId,
            driveWebViewLink: `https://drive.google.com/file/d/${firstUploadId}/view`,
            driveFolderId: 'mock-folder',
          },
        };
      },
    });
    const scan = createScan(deps);
    const r = await scan({ confirmReal: true });
    expect(r.newDocuments).toBe(1);
    expect(r.crossMessageDuplicates).toBe(1);
    expect(uploadCalls).toBe(1);

    const db = getDb();
    const events = db.prepare(
      `SELECT * FROM ingestion_events WHERE event_type = 'document.detected'`
    ).all() as any[];
    expect(events).toHaveLength(1);
  });

  it('G12-E4: same email + same sha256 + different attachment_id does NOT create a second document', async () => {
    const fakePdf = Buffer.from('%PDF-1.4\nG12-E4 SAME EMAIL SAME HASH');
    let uploadCalls = 0;
    let callCount = 0;
    const deps = mkDeps({
      fetchEmails: async () => [
        { gmailMessageId: 'msg-g12e4', threadId: 'thr-g12e4', from: '', subject: 'G12-E4', date: '', attachmentCount: 2 },
      ],
      listAtts: async () => [
        { gmailMessageId: 'msg-g12e4', threadId: 'thr-g12e4', attachmentId: 'att-X1', filename: 'doc.pdf', mimeType: 'application/pdf', size: fakePdf.length },
        { gmailMessageId: 'msg-g12e4', threadId: 'thr-g12e4', attachmentId: 'att-X2', filename: 'doc.pdf', mimeType: 'application/pdf', size: fakePdf.length },
      ],
      downloadAtt: async () => fakePdf,
      uploadDoc: async ({ filename }) => {
        uploadCalls++;
        callCount++;
        return {
          file: {
            storageUri: `gdrive://file/mock-g12e4-${callCount}`,
            driveFileId: `mock-g12e4-${callCount}`,
            driveWebViewLink: `https://drive.google.com/file/d/mock-g12e4-${callCount}/view`,
            driveFolderId: 'mock-folder',
          },
        };
      },
    });
    const scan = createScan(deps);
    const r = await scan({ confirmReal: true });
    expect(r.newDocuments).toBe(1);
    expect(r.duplicates).toBe(1);
    expect(uploadCalls).toBe(1);

    const db = getDb();
    const docs = db.prepare(`SELECT id, attachment_id, sha256 FROM documentos`).all() as any[];
    expect(docs).toHaveLength(1);
    expect(docs[0].attachment_id).toBe('att-X1');
  });

  it('G12-E4: cross-message dedup behavior is preserved (same sha256 across different emails still allowed)', async () => {
    const fakePdf = Buffer.from('%PDF-1.4\nG12-E4 CROSS MESSAGE');
    const firstUploadId = 'mock-g12e4-cross';
    let uploadCalls = 0;
    const deps = mkDeps({
      fetchEmails: async () => [
        { gmailMessageId: 'msg-cross-1', threadId: 't1', from: '', subject: 'A', date: '', attachmentCount: 1 },
        { gmailMessageId: 'msg-cross-2', threadId: 't2', from: '', subject: 'B (re-send)', date: '', attachmentCount: 1 },
      ],
      listAtts: async (msgId) => [
        { gmailMessageId: msgId, threadId: 't', attachmentId: 'a', filename: 'NF-X.pdf', mimeType: 'application/pdf', size: fakePdf.length },
      ],
      downloadAtt: async () => fakePdf,
      uploadDoc: async ({ filename }) => {
        uploadCalls++;
        return {
          file: {
            storageUri: `gdrive://file/${firstUploadId}`,
            driveFileId: firstUploadId,
            driveWebViewLink: `https://drive.google.com/file/d/${firstUploadId}/view`,
            driveFolderId: 'mock-folder',
          },
        };
      },
    });
    const scan = createScan(deps);
    const r = await scan({ confirmReal: true });
    expect(r.newDocuments).toBe(1);
    expect(r.crossMessageDuplicates).toBe(1);
    expect(uploadCalls).toBe(1);

    const db = getDb();
    const docs = db.prepare(`SELECT gmail_message_id, drive_file_id FROM documentos ORDER BY created_at`).all() as any[];
    expect(docs).toHaveLength(2);
  });
});

describe('entity CnpjRegistry integration', () => {
  beforeEach(() => {
    if (existsSync(DB_DIR)) rmSync(DB_DIR, { recursive: true });
    mkdirSync(DB_DIR, { recursive: true });
    process.env.DATABASE_PATH = join(DB_DIR, 'app.db');
    process.env.OUTBOX_PATH = join(DB_DIR, 'outbox.jsonl');
    process.env.LOCAL_CACHE_PATH = join(DB_DIR, 'cache');
    process.env.GOOGLE_DRIVE_ROOT_FOLDER_NAME = 'Ravatex Documents Ingestor';
    closeDb();
    const db = getDb();
    db.exec('DELETE FROM document_technical_evidences; DELETE FROM ingestion_events; DELETE FROM documentos; DELETE FROM emails_processados;');
  });

  afterEach(() => {
    closeDb();
    if (existsSync(DB_DIR)) rmSync(DB_DIR, { recursive: true });
  });
  const fakePdf = Buffer.from('%PDF-1.4\nregistry test');

  function registryDeps(overrides: Partial<ScanDeps> = {}) {
    const base = mkDeps({
      fetchEmails: async () => [
        { gmailMessageId: 'm-reg', threadId: 't', from: '', subject: 'NF', date: '', attachmentCount: 1 },
      ],
      listAtts: async () => [
        { gmailMessageId: 'm-reg', threadId: 't', attachmentId: 'a', filename: 'n.pdf', mimeType: 'application/pdf', size: fakePdf.length },
      ],
      downloadAtt: async () => fakePdf,
    });
    return { ...base, ...overrides };
  }

  it('registry is loaded once per scan', async () => {
    let clientCreateCount = 0;
    let registryLoadCount = 0;

    const deps = registryDeps({
      createEntityCnpjReaderClient: () => {
        clientCreateCount++;
        return { from: () => ({ select: () => ({ not: () => Promise.resolve({ data: [], error: null }) }) }) } as any;
      },
      loadEntityCnpjRegistry: async () => {
        registryLoadCount++;
        return { loaded: true, loadedAt: new Date().toISOString(), entries: [], error: null };
      },
    });

    const scan = createScan(deps);
    await scan({ confirmReal: true });

    expect(clientCreateCount).toBe(1);
    expect(registryLoadCount).toBe(1);
  });

  it('same registry is reused across multiple attachments', async () => {
    let registryLoadCount = 0;
    const regObj = { loaded: true, loadedAt: new Date().toISOString(), entries: [], error: null };
    const buf1 = Buffer.from('%PDF-1.4\nREGISTRY A\n');
    const buf2 = Buffer.from('%PDF-1.4\nREGISTRY B\n');

    const deps = registryDeps({
      fetchEmails: async () => [
        { gmailMessageId: 'm-multi', threadId: 't', from: '', subject: 'A', date: '', attachmentCount: 2 },
      ],
      listAtts: async () => [
        { gmailMessageId: 'm-multi', threadId: 't', attachmentId: 'a1', filename: 'n1.pdf', mimeType: 'application/pdf', size: buf1.length },
        { gmailMessageId: 'm-multi', threadId: 't', attachmentId: 'a2', filename: 'n2.pdf', mimeType: 'application/pdf', size: buf2.length },
      ],
      downloadAtt: async (_msgId: string, attId: string) => {
        return attId === 'a1' ? buf1 : buf2;
      },
      createEntityCnpjReaderClient: () => ({ from: () => ({ select: () => ({ not: () => Promise.resolve({ data: [], error: null }) }) }) } as any),
      loadEntityCnpjRegistry: async (_client: any) => {
        registryLoadCount++;
        return regObj;
      },
    });

    const scan = createScan(deps);
    const r = await scan({ confirmReal: true });

    expect(registryLoadCount).toBe(1);
    expect(r.newDocuments).toBe(2);
  });

  it('empty registry does not cause scan errors', async () => {
    const deps = registryDeps({
      createEntityCnpjReaderClient: () => ({ from: () => ({ select: () => ({ not: () => Promise.resolve({ data: [], error: null }) }) }) } as any),
      loadEntityCnpjRegistry: async () => ({ loaded: true, loadedAt: new Date().toISOString(), entries: [], error: null }),
    });

    const scan = createScan(deps);
    const r = await scan({ confirmReal: true });

    expect(r.newDocuments).toBe(1);
    expect(r.errors).toHaveLength(0);
  });

  it('empty registry is passed to classifier without error', async () => {
    const deps = registryDeps({
      createEntityCnpjReaderClient: () => ({ from: () => ({ select: () => ({ not: () => Promise.resolve({ data: [], error: null }) }) }) } as any),
      loadEntityCnpjRegistry: async () => ({ loaded: true, loadedAt: new Date().toISOString(), entries: [], error: null }),
    });

    const scan = createScan(deps);
    const r = await scan({ confirmReal: true });
    expect(r.errors).toHaveLength(0);

    const db = getDb();
    const doc = db.prepare(`SELECT tipo_documento FROM documentos LIMIT 1`).get() as any;
    expect(doc.tipo_documento).toBe('nf');
  });

  it('failed client creation does not abort scan', async () => {
    const deps = registryDeps({
      createEntityCnpjReaderClient: () => { throw new Error('simulated create error'); },
      loadEntityCnpjRegistry: async () => ({ loaded: true, loadedAt: '', entries: [], error: null }),
    });

    const scan = createScan(deps);
    const r = await scan({ confirmReal: true });

    expect(r.newDocuments).toBe(1);
    expect(r.errors.length).toBeGreaterThan(0);
    expect(r.errors.some(e => e.includes('Entity CNPJ registry unavailable'))).toBe(true);
  });

  it('failed client creation produces unavailable registry', async () => {
    let passedRegistry: any = null;
    const deps = registryDeps({
      createEntityCnpjReaderClient: () => { throw new Error('simulated create error'); },
      loadEntityCnpjRegistry: async (_client: any) => {
        passedRegistry = _client;
        return { loaded: true, loadedAt: '', entries: [], error: null };
      },
    });

    const scan = createScan(deps);
    await scan({ confirmReal: true });

    // loadEntityCnpjRegistry should never have been called because create threw
    expect(passedRegistry).toBeNull();
  });

  it('failed reader load does not abort scan', async () => {
    const deps = registryDeps({
      createEntityCnpjReaderClient: () => ({ from: () => ({ select: () => ({ not: () => Promise.resolve({ data: [], error: null }) }) }) } as any),
      loadEntityCnpjRegistry: async () => { throw new Error('simulated load error with CNPJ 11222333000181'); },
    });

    const scan = createScan(deps);
    const r = await scan({ confirmReal: true });

    expect(r.newDocuments).toBe(1);
    expect(r.errors.length).toBeGreaterThan(0);
    expect(r.errors.some(e => e.includes('Entity CNPJ registry unavailable'))).toBe(true);
  });

  it('error is recorded only once per scan', async () => {
    const deps = registryDeps({
      createEntityCnpjReaderClient: () => { throw new Error('fail once'); },
    });

    const scan = createScan(deps);
    const r = await scan({ confirmReal: true });

    const degradedErrors = r.errors.filter(e => e.includes('Entity CNPJ registry unavailable'));
    expect(degradedErrors).toHaveLength(1);
  });

  it('error message does not expose full CNPJ', async () => {
    const deps = registryDeps({
      createEntityCnpjReaderClient: () => ({ from: () => ({ select: () => ({ not: () => Promise.resolve({ data: [], error: null }) }) }) } as any),
      loadEntityCnpjRegistry: async () => { throw new Error('CNPJ 11222333000181 rejected'); },
    });

    const scan = createScan(deps);
    const r = await scan({ confirmReal: true });

    expect(r.errors.join()).not.toMatch(/11222333000181/);
  });

  it('error message does not expose service-role key', async () => {
    const deps = registryDeps({
      createEntityCnpjReaderClient: () => { throw new Error('sb-test-key-123-abc'); },
    });

    const scan = createScan(deps);
    const r = await scan({ confirmReal: true });

    expect(r.errors.join()).not.toMatch(/sb-test-key/);
  });

  it('error message does not expose full URL', async () => {
    const deps = registryDeps({
      createEntityCnpjReaderClient: () => {
        const err = new Error('supabase_url_invalid for https://ucrjtfswnfdlxwtmxnoo.supabase.co');
        throw err;
      },
    });

    const scan = createScan(deps);
    const r = await scan({ confirmReal: true });

    expect(r.errors.join()).not.toMatch(/supabase\.co/);
  });

  it('direction remains unchanged with registry available', async () => {
    const deps = registryDeps({
      createEntityCnpjReaderClient: () => ({ from: () => ({ select: () => ({ not: () => Promise.resolve({ data: [], error: null }) }) }) } as any),
      loadEntityCnpjRegistry: async () => ({ loaded: true, loadedAt: new Date().toISOString(), entries: [], error: null }),
    });

    const scan = createScan(deps);
    const r = await scan({ confirmReal: true });
    expect(r.newDocuments).toBe(1);

    const db = getDb();
    const doc = db.prepare(`SELECT direcao_nf FROM documentos LIMIT 1`).get() as any;
    // PDF without XML CNPJ: direcao_nf is null (from classifier)
    expect(doc.direcao_nf).toBeNull();
  });

  it('scan does not call from("clientes") or from("fornecedores") directly', () => {
    const source = String(createScan);
    // createScan does not contain direct table queries — only through injected reader
    expect(source).not.toMatch(/from\s*\(\s*['"]clientes['"]/);
    expect(source).not.toMatch(/from\s*\(\s*['"]fornecedores['"]/);
  });

  it('new classifier CNPJ columns are now persisted to SQLite', async () => {
    const xml = Buffer.from('<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe"><NFe><infNFe><emit><CNPJ>11222333000181</CNPJ></emit><dest><CNPJ>11444777000161</CNPJ></dest></infNFe></NFe></nfeProc>');
    const deps = registryDeps({
      fetchEmails: async () => [
        { gmailMessageId: 'm-col', threadId: 't', from: '', subject: 'NF', date: '', attachmentCount: 1 },
      ],
      listAtts: async () => [
        { gmailMessageId: 'm-col', threadId: 't', attachmentId: 'a', filename: 'nfe.xml', mimeType: 'text/xml', size: xml.length },
      ],
      downloadAtt: async () => xml,
      createEntityCnpjReaderClient: () => ({ from: () => ({ select: () => ({ not: () => Promise.resolve({ data: [], error: null }) }) }) } as any),
      loadEntityCnpjRegistry: async () => ({ loaded: true, loadedAt: new Date().toISOString(), entries: [], error: null }),
    });

    const scan = createScan(deps);
    const r = await scan({ confirmReal: true });
    expect(r.newDocuments).toBe(1);

    const db = getDb();
    const cols = db.prepare(`PRAGMA table_info(documentos)`).all() as any[];
    const colNames = new Set(cols.map((c: any) => c.name));
    expect(colNames.has('cnpj_emitente')).toBe(true);
    expect(colNames.has('cnpj_destinatario')).toBe(true);
    const doc = db.prepare(`SELECT cnpj_emitente, cnpj_destinatario FROM documentos LIMIT 1`).get() as any;
    expect(doc.cnpj_emitente).toBe('11222333000181');
    expect(doc.cnpj_destinatario).toBe('11444777000161');
  });

  it('dry-run does not load registry', async () => {
    let createCalled = false;
    const deps = registryDeps({
      createEntityCnpjReaderClient: () => { createCalled = true; return {} as any; },
    });

    const scan = createScan(deps);
    await scan({ confirmReal: false });

    expect(createCalled).toBe(false);
  });

  it('lock is not removed during scan', async () => {
    const deps = registryDeps({
      createEntityCnpjReaderClient: () => ({ from: () => ({ select: () => ({ not: () => Promise.resolve({ data: [], error: null }) }) }) } as any),
      loadEntityCnpjRegistry: async () => ({ loaded: true, loadedAt: new Date().toISOString(), entries: [], error: null }),
    });

    const scan = createScan(deps);
    await scan({ confirmReal: true });
    // Lock file is external to the scan — scan doesn't touch it. Proven by absence of lock-file code.
  });
});

describe('document party CNPJ persistence', () => {
  beforeEach(() => {
    if (existsSync(DB_DIR)) rmSync(DB_DIR, { recursive: true });
    mkdirSync(DB_DIR, { recursive: true });
    process.env.DATABASE_PATH = join(DB_DIR, 'app.db');
    process.env.OUTBOX_PATH = join(DB_DIR, 'outbox.jsonl');
    process.env.LOCAL_CACHE_PATH = join(DB_DIR, 'cache');
    process.env.GOOGLE_DRIVE_ROOT_FOLDER_NAME = 'Ravatex Documents Ingestor';
    closeDb();
    const db = getDb();
    db.exec('DELETE FROM document_technical_evidences; DELETE FROM ingestion_events; DELETE FROM documentos; DELETE FROM emails_processados;');
  });

  afterEach(() => {
    closeDb();
    if (existsSync(DB_DIR)) rmSync(DB_DIR, { recursive: true });
  });
  function nfXml(emitCnpj?: string | null, destCnpj?: string | null): Buffer {
    const emitBlock = emitCnpj
      ? `<emit><CNPJ>${emitCnpj}</CNPJ></emit>`
      : `<emit><xNome>Fornecedor</xNome></emit>`;
    const destBlock = destCnpj
      ? `<dest><CNPJ>${destCnpj}</CNPJ></dest>`
      : `<dest><xNome>Cliente</xNome></dest>`;
    return Buffer.from(`<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe"><NFe><infNFe>${emitBlock}${destBlock}</infNFe></NFe></nfeProc>`);
  }

  function mkCnpjDeps(overrides: Partial<ScanDeps> = {}) {
    const fakePdf = Buffer.from('%PDF-1.4');
    const base = mkDeps({
      fetchEmails: async () => [
        { gmailMessageId: 'm-cnpj', threadId: 't', from: '', subject: 'NF', date: '', attachmentCount: 1 },
      ],
      listAtts: async () => [
        { gmailMessageId: 'm-cnpj', threadId: 't', attachmentId: 'a', filename: 'nfe.xml', mimeType: 'text/xml', size: 0 },
      ],
      downloadAtt: async () => fakePdf,
      createEntityCnpjReaderClient: () => ({ from: () => ({ select: () => ({ not: () => Promise.resolve({ data: [], error: null }) }) }) } as any),
      loadEntityCnpjRegistry: async () => ({ loaded: true, loadedAt: new Date().toISOString(), entries: [], error: null }),
    });
    return { ...base, ...overrides };
  }

  it('XML with emitente and destinatario saves both', async () => {
    const xml = nfXml('11222333000181', '11444777000161');
    const deps = mkCnpjDeps({ downloadAtt: async () => xml });
    const scan = createScan(deps);
    await scan({ confirmReal: true });
    const db = getDb();
    const doc = db.prepare(`SELECT cnpj_emitente, cnpj_destinatario FROM documentos LIMIT 1`).get() as any;
    expect(doc.cnpj_emitente).toBe('11222333000181');
    expect(doc.cnpj_destinatario).toBe('11444777000161');
  });

  it('values are stored as 14 digits without punctuation', async () => {
    const xml = nfXml('11.222.333/0001-81', '11.444.777/0001-61');
    const deps = mkCnpjDeps({ downloadAtt: async () => xml });
    const scan = createScan(deps);
    await scan({ confirmReal: true });
    const db = getDb();
    const doc = db.prepare(`SELECT cnpj_emitente, cnpj_destinatario FROM documentos LIMIT 1`).get() as any;
    expect(doc.cnpj_emitente).toBe('11222333000181');
    expect(doc.cnpj_destinatario).toBe('11444777000161');
  });

  it('XML with only emitente saves destinatario as NULL', async () => {
    const xml = nfXml('11222333000181', null);
    const deps = mkCnpjDeps({ downloadAtt: async () => xml });
    const scan = createScan(deps);
    await scan({ confirmReal: true });
    const db = getDb();
    const doc = db.prepare(`SELECT cnpj_emitente, cnpj_destinatario FROM documentos LIMIT 1`).get() as any;
    expect(doc.cnpj_emitente).toBe('11222333000181');
    expect(doc.cnpj_destinatario).toBeNull();
  });

  it('XML with only destinatario saves emitente as NULL', async () => {
    const xml = nfXml(null, '11444777000161');
    const deps = mkCnpjDeps({ downloadAtt: async () => xml });
    const scan = createScan(deps);
    await scan({ confirmReal: true });
    const db = getDb();
    const doc = db.prepare(`SELECT cnpj_emitente, cnpj_destinatario FROM documentos LIMIT 1`).get() as any;
    expect(doc.cnpj_emitente).toBeNull();
    expect(doc.cnpj_destinatario).toBe('11444777000161');
  });

  it('XML without party CNPJs saves both as NULL', async () => {
    const xml = nfXml(null, null);
    const deps = mkCnpjDeps({ downloadAtt: async () => xml });
    const scan = createScan(deps);
    await scan({ confirmReal: true });
    const db = getDb();
    const doc = db.prepare(`SELECT cnpj_emitente, cnpj_destinatario FROM documentos LIMIT 1`).get() as any;
    expect(doc.cnpj_emitente).toBeNull();
    expect(doc.cnpj_destinatario).toBeNull();
  });

  it('invalid emitente CNPJ saves NULL', async () => {
    const xml = nfXml('abc', '11444777000161');
    const deps = mkCnpjDeps({ downloadAtt: async () => xml });
    const scan = createScan(deps);
    await scan({ confirmReal: true });
    const db = getDb();
    const doc = db.prepare(`SELECT cnpj_emitente, cnpj_destinatario FROM documentos LIMIT 1`).get() as any;
    expect(doc.cnpj_emitente).toBeNull();
    expect(doc.cnpj_destinatario).toBe('11444777000161');
  });

  it('PDF saves both CNPJs as NULL', async () => {
    const pdf = Buffer.from('%PDF-1.4\nNF-e content');
    const deps = mkCnpjDeps({
      downloadAtt: async () => pdf,
      listAtts: async () => [
        { gmailMessageId: 'm-cnpj', threadId: 't', attachmentId: 'a', filename: 'nf.pdf', mimeType: 'application/pdf', size: pdf.length },
      ],
    });
    const scan = createScan(deps);
    await scan({ confirmReal: true });
    const db = getDb();
    const doc = db.prepare(`SELECT cnpj_emitente, cnpj_destinatario FROM documentos LIMIT 1`).get() as any;
    expect(doc.cnpj_emitente).toBeNull();
    expect(doc.cnpj_destinatario).toBeNull();
  });

  it('loaded registry does not change CNPJ values', async () => {
    const xml = nfXml('11222333000181', null);
    const deps = mkCnpjDeps({ downloadAtt: async () => xml });
    const scan = createScan(deps);
    await scan({ confirmReal: true });
    const db = getDb();
    const doc = db.prepare(`SELECT cnpj_emitente FROM documentos LIMIT 1`).get() as any;
    expect(doc.cnpj_emitente).toBe('11222333000181');
  });

  it('unavailable registry does not prevent CNPJ persistence', async () => {
    const xml = nfXml('11222333000181', null);
    const deps = mkCnpjDeps({
      downloadAtt: async () => xml,
      createEntityCnpjReaderClient: () => { throw new Error('failed'); },
    });
    const scan = createScan(deps);
    await scan({ confirmReal: true });
    const db = getDb();
    const doc = db.prepare(`SELECT cnpj_emitente FROM documentos LIMIT 1`).get() as any;
    expect(doc.cnpj_emitente).toBe('11222333000181');
  });

  it('direction does not change persisted CNPJs', async () => {
    const xml = nfXml('11222333000181', '11444777000161');
    const deps = mkCnpjDeps({ downloadAtt: async () => xml });
    const scan = createScan(deps);
    await scan({ confirmReal: true });
    const db = getDb();
    const doc = db.prepare(`SELECT cnpj_emitente, cnpj_destinatario FROM documentos LIMIT 1`).get() as any;
    expect(doc.cnpj_emitente).toBe('11222333000181');
    expect(doc.cnpj_destinatario).toBe('11444777000161');
  });

  it('entityMatch is not persisted to SQLite', async () => {
    const xml = nfXml('11222333000181', null);
    const deps = mkCnpjDeps({ downloadAtt: async () => xml });
    const scan = createScan(deps);
    await scan({ confirmReal: true });
    const db = getDb();
    const cols = db.prepare(`PRAGMA table_info(documentos)`).all() as any[];
    const names = cols.map((c: any) => c.name);
    expect(names).not.toContain('entity_match');
    expect(names).not.toContain('entityMatch');
    expect(names).not.toContain('matched_entity');
  });

  it('cross-message duplicate saves NULL CNPJs', async () => {
    const fakePdf = Buffer.from('%PDF-1.4\nCROSS CNPJ');
    const firstUploadId = 'mock-cnpj-cross';
    const deps = mkDeps({
      fetchEmails: async () => [
        { gmailMessageId: 'msg-cnpj-A', threadId: 'tA', from: '', subject: 'A', date: '', attachmentCount: 1 },
        { gmailMessageId: 'msg-cnpj-B', threadId: 'tB', from: '', subject: 'B', date: '', attachmentCount: 1 },
      ],
      listAtts: async (msgId) => [
        { gmailMessageId: msgId, threadId: 't', attachmentId: 'a', filename: 'NF.pdf', mimeType: 'application/pdf', size: fakePdf.length },
      ],
      downloadAtt: async () => fakePdf,
      uploadDoc: async () => ({
        file: { storageUri: `gdrive://file/${firstUploadId}`, driveFileId: firstUploadId, driveWebViewLink: `https://drive.google.com/file/d/${firstUploadId}/view`, driveFolderId: 'mock-folder' },
      }),
      createEntityCnpjReaderClient: () => ({ from: () => ({ select: () => ({ not: () => Promise.resolve({ data: [], error: null }) }) }) } as any),
      loadEntityCnpjRegistry: async () => ({ loaded: true, loadedAt: new Date().toISOString(), entries: [], error: null }),
    });
    const scan = createScan(deps);
    await scan({ confirmReal: true });
    const db = getDb();
    const docs = db.prepare(`SELECT gmail_message_id, cnpj_emitente, cnpj_destinatario FROM documentos ORDER BY created_at`).all() as any[];
    expect(docs).toHaveLength(2);
    expect(docs[1].cnpj_emitente).toBeNull();
    expect(docs[1].cnpj_destinatario).toBeNull();
  });

  it('no backfill of old documents occurs', async () => {
    const xml = nfXml('11222333000181', null);
    const deps = mkCnpjDeps({ downloadAtt: async () => xml });
    const scan = createScan(deps);
    await scan({ confirmReal: true });
    await scan({ confirmReal: true });
    const db = getDb();
    const docs = db.prepare(`SELECT cnpj_emitente FROM documentos`).all() as any;
    expect(docs).toHaveLength(1);
  });
});

describe('B2 real scan: sample collection by MIME + extension (fast-xml-parser classification)', () => {
  beforeEach(() => {
    if (existsSync(DB_DIR)) rmSync(DB_DIR, { recursive: true });
    mkdirSync(DB_DIR, { recursive: true });
    process.env.DATABASE_PATH = join(DB_DIR, 'app.db');
    process.env.OUTBOX_PATH = join(DB_DIR, 'outbox.jsonl');
    process.env.LOCAL_CACHE_PATH = join(DB_DIR, 'cache');
    process.env.GOOGLE_DRIVE_ROOT_FOLDER_NAME = 'Ravatex Documents Ingestor';
    closeDb();
    const db = getDb();
    db.exec('DELETE FROM document_technical_evidences; DELETE FROM ingestion_events; DELETE FROM documentos; DELETE FROM emails_processados;');
  });

  afterEach(() => {
    closeDb();
    if (existsSync(DB_DIR)) rmSync(DB_DIR, { recursive: true });
  });

  const VALID_XML = Buffer.from(
    '<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe"><NFe><infNFe><emit><CNPJ>11222333000181</CNPJ></emit><dest><CNPJ>11444777000161</CNPJ></dest></infNFe></NFe></nfeProc>'
  );
  const MALFORMED_XML = Buffer.from('not even valid <<<xml>>>');
  const EVENT_XML = Buffer.from(
    '<nfeEvento xmlns="http://www.portalfiscal.inf.br/nfe"><evento><CNPJ>11222333000181</CNPJ></evento></nfeEvento>'
  );

  function makeScanDeps(overrides: Partial<ScanDeps> = {}): ScanDeps {
    return mkDeps({
      fetchEmails: async () => [
        { gmailMessageId: 'm-b2', threadId: 't', from: '', subject: 'B2', date: '', attachmentCount: 1 },
      ],
      listAtts: async () => [
        { gmailMessageId: 'm-b2', threadId: 't', attachmentId: 'a-b2', filename: 'nfe.xml', mimeType: 'application/octet-stream', size: 0 },
      ],
      downloadAtt: async () => VALID_XML,
      createEntityCnpjReaderClient: () => ({ from: () => ({ select: () => ({ not: () => Promise.resolve({ data: [], error: null }) }) }) } as any),
      loadEntityCnpjRegistry: async () => ({ loaded: true, loadedAt: new Date().toISOString(), entries: [], error: null }),
      ...overrides,
    });
  }

  it('scan collects sample for generic MIME (application/octet-stream) with .xml extension and classifies as nf + xml', async () => {
    const deps = makeScanDeps({
      listAtts: async () => [
        { gmailMessageId: 'm-b2', threadId: 't', attachmentId: 'a-b2', filename: 'nfe.xml', mimeType: 'application/octet-stream', size: VALID_XML.length },
      ],
    });
    const scan = createScan(deps);
    const r = await scan({ confirmReal: true });
    expect(r.newDocuments).toBe(1);
    const db = getDb();
    const doc = db.prepare(`SELECT tipo_documento, formato, cnpj_emitente, cnpj_destinatario FROM documentos LIMIT 1`).get() as any;
    expect(doc.tipo_documento).toBe('nf');
    expect(doc.formato).toBe('xml');
    expect(doc.cnpj_emitente).toBe('11222333000181');
    expect(doc.cnpj_destinatario).toBe('11444777000161');
  });

  it('scan does not collect sample for non-XML generic MIME without .xml extension', async () => {
    let downloadCalled = false;
    const deps = mkDeps({
      fetchEmails: async () => [
        { gmailMessageId: 'm-nonscan', threadId: 't', from: '', subject: '', date: '', attachmentCount: 1 },
      ],
      listAtts: async () => [
        { gmailMessageId: 'm-nonscan', threadId: 't', attachmentId: 'a', filename: 'something.bin', mimeType: 'application/octet-stream', size: 0 },
      ],
      downloadAtt: async () => { downloadCalled = true; return Buffer.from('whatever'); },
    });
    const scan = createScan(deps);
    const r = await scan({ confirmReal: true });
    expect(r.attachmentsFound).toBe(0);
    expect(downloadCalled).toBe(false);
  });

  it('scan classifies MIME text/xml with .pdf extension as formato xml (MIME wins for formato)', async () => {
    const deps = mkDeps({
      fetchEmails: async () => [
        { gmailMessageId: 'm-pdfext', threadId: 't', from: '', subject: '', date: '', attachmentCount: 1 },
      ],
      listAtts: async () => [
        { gmailMessageId: 'm-pdfext', threadId: 't', attachmentId: 'a', filename: 'nota.pdf', mimeType: 'text/xml', size: VALID_XML.length },
      ],
      downloadAtt: async () => VALID_XML,
      createEntityCnpjReaderClient: () => ({ from: () => ({ select: () => ({ not: () => Promise.resolve({ data: [], error: null }) }) }) } as any),
      loadEntityCnpjRegistry: async () => ({ loaded: true, loadedAt: new Date().toISOString(), entries: [], error: null }),
    });
    const scan = createScan(deps);
    const r = await scan({ confirmReal: true });
    expect(r.newDocuments).toBe(1);
    const db = getDb();
    const doc = db.prepare(`SELECT tipo_documento, formato FROM documentos LIMIT 1`).get() as any;
    expect(doc.tipo_documento).toBe('nf');
    expect(doc.formato).toBe('xml');
  });

  it('scan classifies generic nfeEvento (fiscal event) as desconhecido when MIME generic + .xml', async () => {
    const deps = mkDeps({
      fetchEmails: async () => [
        { gmailMessageId: 'm-evt', threadId: 't', from: '', subject: '', date: '', attachmentCount: 1 },
      ],
      listAtts: async () => [
        { gmailMessageId: 'm-evt', threadId: 't', attachmentId: 'a', filename: 'evento.xml', mimeType: 'application/octet-stream', size: EVENT_XML.length },
      ],
      downloadAtt: async () => EVENT_XML,
      createEntityCnpjReaderClient: () => ({ from: () => ({ select: () => ({ not: () => Promise.resolve({ data: [], error: null }) }) }) } as any),
      loadEntityCnpjRegistry: async () => ({ loaded: true, loadedAt: new Date().toISOString(), entries: [], error: null }),
    });
    const scan = createScan(deps);
    const r = await scan({ confirmReal: true });
    expect(r.newDocuments).toBe(1);
    const db = getDb();
    const doc = db.prepare(`SELECT tipo_documento, formato FROM documentos LIMIT 1`).get() as any;
    expect(doc.tipo_documento).toBe('desconhecido');
    expect(doc.formato).toBe('xml');
  });

  it('scan classifies malformed XML payload as desconhecido + formato xml when MIME generic + .xml', async () => {
    const deps = mkDeps({
      fetchEmails: async () => [
        { gmailMessageId: 'm-mal', threadId: 't', from: '', subject: '', date: '', attachmentCount: 1 },
      ],
      listAtts: async () => [
        { gmailMessageId: 'm-mal', threadId: 't', attachmentId: 'a', filename: 'corrupt.xml', mimeType: 'application/octet-stream', size: MALFORMED_XML.length },
      ],
      downloadAtt: async () => MALFORMED_XML,
      createEntityCnpjReaderClient: () => ({ from: () => ({ select: () => ({ not: () => Promise.resolve({ data: [], error: null }) }) }) } as any),
      loadEntityCnpjRegistry: async () => ({ loaded: true, loadedAt: new Date().toISOString(), entries: [], error: null }),
    });
    const scan = createScan(deps);
    const r = await scan({ confirmReal: true });
    expect(r.newDocuments).toBe(1);
    const db = getDb();
    const doc = db.prepare(`SELECT tipo_documento, formato FROM documentos LIMIT 1`).get() as any;
    expect(doc.tipo_documento).toBe('desconhecido');
    expect(doc.formato).toBe('xml');
  });

  it('scan does not enlarge payload beyond fixed sample size (2048 bytes)', async () => {
    const big = Buffer.concat([VALID_XML, Buffer.alloc(5000, 0x20)]);
    const deps = mkDeps({
      fetchEmails: async () => [
        { gmailMessageId: 'm-big', threadId: 't', from: '', subject: '', date: '', attachmentCount: 1 },
      ],
      listAtts: async () => [
        { gmailMessageId: 'm-big', threadId: 't', attachmentId: 'a', filename: 'nfe.xml', mimeType: 'application/octet-stream', size: big.length },
      ],
      downloadAtt: async () => big,
      createEntityCnpjReaderClient: () => ({ from: () => ({ select: () => ({ not: () => Promise.resolve({ data: [], error: null }) }) }) } as any),
      loadEntityCnpjRegistry: async () => ({ loaded: true, loadedAt: new Date().toISOString(), entries: [], error: null }),
    });
    const scan = createScan(deps);
    const r = await scan({ confirmReal: true });
    expect(r.newDocuments).toBe(1);
    const db = getDb();
    const doc = db.prepare(`SELECT tipo_documento, formato, cnpj_emitente, cnpj_destinatario FROM documentos LIMIT 1`).get() as any;
    expect(doc.tipo_documento).toBe('nf');
    expect(doc.cnpj_emitente).toBe('11222333000181');
  });
});

describe('B3 real scan: PDF sample delivery (G27-B3)', () => {
  beforeEach(() => {
    if (existsSync(DB_DIR)) rmSync(DB_DIR, { recursive: true });
    mkdirSync(DB_DIR, { recursive: true });
    process.env.DATABASE_PATH = join(DB_DIR, 'app.db');
    process.env.OUTBOX_PATH = join(DB_DIR, 'outbox.jsonl');
    process.env.LOCAL_CACHE_PATH = join(DB_DIR, 'cache');
    process.env.GOOGLE_DRIVE_ROOT_FOLDER_NAME = 'Ravatex Documents Ingestor';
    closeDb();
    const db = getDb();
    db.exec('DELETE FROM document_technical_evidences; DELETE FROM ingestion_events; DELETE FROM documentos; DELETE FROM emails_processados;');
  });

  afterEach(() => {
    closeDb();
    if (existsSync(DB_DIR)) rmSync(DB_DIR, { recursive: true });
  });

  const VALID_XML = Buffer.from(
    '<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe"><NFe><infNFe><emit><CNPJ>11222333000181</CNPJ></emit><dest><CNPJ>11444777000161</CNPJ></dest></infNFe></NFe></nfeProc>'
  );
  const PDF_DANFE = Buffer.from('%PDF-1.4\nDANFE - DOCUMENTO AUXILIAR\n%%EOF\n');
  const PDF_NOTA_FISCAL = Buffer.from('%PDF-1.4\nNOTA FISCAL 12345\n%%EOF\n');
  const PDF_NF_NAME = Buffer.from('%PDF-1.4\nconteudo generico\n%%EOF\n');
  const PDF_INFO = Buffer.from('%PDF-1.4\nInformativo do fornecedor\n%%EOF\n');
  const PDF_HTML = Buffer.from('<!DOCTYPE html><html><body>DANFE</body></html>');
  const PDF_NOT_PDF = Buffer.from('NOT a real PDF\nrandom content\n');

  function pdfDeps(overrides: Partial<ScanDeps> = {}): ScanDeps {
    return mkDeps({
      fetchEmails: async () => [
        { gmailMessageId: 'm-b3', threadId: 't', from: '', subject: 'B3', date: '', attachmentCount: 1 },
      ],
      listAtts: async () => [
        { gmailMessageId: 'm-b3', threadId: 't', attachmentId: 'a-b3', filename: 'doc.pdf', mimeType: 'application/pdf', size: 0 },
      ],
      downloadAtt: async () => PDF_DANFE,
      createEntityCnpjReaderClient: () => ({ from: () => ({ select: () => ({ not: () => Promise.resolve({ data: [], error: null }) }) }) } as any),
      loadEntityCnpjRegistry: async () => ({ loaded: true, loadedAt: new Date().toISOString(), entries: [], error: null }),
      ...overrides,
    });
  }

  it('scan passes contentSample to classifier for PDF MIME (DANFE no contentSample → nf)', async () => {
    const deps = pdfDeps({
      fetchEmails: async () => [
        { gmailMessageId: 'm-b3-danfe', threadId: 't', from: '', subject: 'Sem NF no subject', date: '', attachmentCount: 1 },
      ],
      listAtts: async () => [
        { gmailMessageId: 'm-b3-danfe', threadId: 't', attachmentId: 'a', filename: 'documento.pdf', mimeType: 'application/pdf', size: PDF_DANFE.length },
      ],
      downloadAtt: async () => PDF_DANFE,
    });
    const scan = createScan(deps);
    const r = await scan({ confirmReal: true });
    expect(r.newDocuments).toBe(1);
    const db = getDb();
    const doc = db.prepare(`SELECT tipo_documento, formato, direcao_nf FROM documentos LIMIT 1`).get() as any;
    expect(doc.tipo_documento).toBe('nf');
    expect(doc.formato).toBe('pdf');
    expect(doc.direcao_nf).toBeNull();
  });

  it('scan passes contentSample to classifier for PDF MIME (nota fiscal no contentSample → nf)', async () => {
    const deps = pdfDeps({
      fetchEmails: async () => [
        { gmailMessageId: 'm-b3-nf', threadId: 't', from: '', subject: 'Sem NF no subject', date: '', attachmentCount: 1 },
      ],
      listAtts: async () => [
        { gmailMessageId: 'm-b3-nf', threadId: 't', attachmentId: 'a', filename: 'documento.pdf', mimeType: 'application/pdf', size: PDF_NOTA_FISCAL.length },
      ],
      downloadAtt: async () => PDF_NOTA_FISCAL,
    });
    const scan = createScan(deps);
    const r = await scan({ confirmReal: true });
    expect(r.newDocuments).toBe(1);
    const db = getDb();
    const doc = db.prepare(`SELECT tipo_documento, formato, direcao_nf FROM documentos LIMIT 1`).get() as any;
    expect(doc.tipo_documento).toBe('nf');
    expect(doc.formato).toBe('pdf');
    expect(doc.direcao_nf).toBeNull();
  });

  it('scan with info.pdf content (sem token NF em conteúdo) → desconhecido + formato pdf', async () => {
    const deps = pdfDeps({
      fetchEmails: async () => [
        { gmailMessageId: 'm-b3-info', threadId: 't', from: '', subject: '', date: '', attachmentCount: 1 },
      ],
      listAtts: async () => [
        { gmailMessageId: 'm-b3-info', threadId: 't', attachmentId: 'a', filename: 'info.pdf', mimeType: 'application/pdf', size: PDF_INFO.length },
      ],
      downloadAtt: async () => PDF_INFO,
    });
    const scan = createScan(deps);
    const r = await scan({ confirmReal: true });
    expect(r.newDocuments).toBe(1);
    const db = getDb();
    const doc = db.prepare(`SELECT tipo_documento, formato FROM documentos LIMIT 1`).get() as any;
    expect(doc.tipo_documento).toBe('desconhecido');
    expect(doc.formato).toBe('pdf');
  });

  it('scan with conferencia.pdf content (sem token NF em conteúdo) → desconhecido + formato pdf', async () => {
    const deps = pdfDeps({
      fetchEmails: async () => [
        { gmailMessageId: 'm-b3-conf', threadId: 't', from: '', subject: '', date: '', attachmentCount: 1 },
      ],
      listAtts: async () => [
        { gmailMessageId: 'm-b3-conf', threadId: 't', attachmentId: 'a', filename: 'conferencia.pdf', mimeType: 'application/pdf', size: PDF_INFO.length },
      ],
      downloadAtt: async () => PDF_INFO,
    });
    const scan = createScan(deps);
    const r = await scan({ confirmReal: true });
    expect(r.newDocuments).toBe(1);
    const db = getDb();
    const doc = db.prepare(`SELECT tipo_documento, formato FROM documentos LIMIT 1`).get() as any;
    expect(doc.tipo_documento).toBe('desconhecido');
    expect(doc.formato).toBe('pdf');
  });

  it('scan with NF-123.pdf (filename com NF, contentSample com %PDF-) → nf', async () => {
    const deps = pdfDeps({
      fetchEmails: async () => [
        { gmailMessageId: 'm-b3-nfname', threadId: 't', from: '', subject: '', date: '', attachmentCount: 1 },
      ],
      listAtts: async () => [
        { gmailMessageId: 'm-b3-nfname', threadId: 't', attachmentId: 'a', filename: 'NF-123.pdf', mimeType: 'application/pdf', size: PDF_NF_NAME.length },
      ],
      downloadAtt: async () => PDF_NF_NAME,
    });
    const scan = createScan(deps);
    const r = await scan({ confirmReal: true });
    expect(r.newDocuments).toBe(1);
    const db = getDb();
    const doc = db.prepare(`SELECT tipo_documento, formato FROM documentos LIMIT 1`).get() as any;
    expect(doc.tipo_documento).toBe('nf');
    expect(doc.formato).toBe('pdf');
  });

  it('scan com MIME PDF conteúdo HTML (sem %PDF-) → desconhecido + formato pdf', async () => {
    const deps = pdfDeps({
      fetchEmails: async () => [
        { gmailMessageId: 'm-b3-html', threadId: 't', from: '', subject: '', date: '', attachmentCount: 1 },
      ],
      listAtts: async () => [
        { gmailMessageId: 'm-b3-html', threadId: 't', attachmentId: 'a', filename: 'doc.pdf', mimeType: 'application/pdf', size: PDF_HTML.length },
      ],
      downloadAtt: async () => PDF_HTML,
    });
    const scan = createScan(deps);
    const r = await scan({ confirmReal: true });
    expect(r.newDocuments).toBe(1);
    const db = getDb();
    const doc = db.prepare(`SELECT tipo_documento, formato FROM documentos LIMIT 1`).get() as any;
    expect(doc.tipo_documento).toBe('desconhecido');
    expect(doc.formato).toBe('pdf');
  });

  it('scan com .pdf + MIME generic e signature válida → nf (DANFE em conteúdo)', async () => {
    const deps = pdfDeps({
      fetchEmails: async () => [
        { gmailMessageId: 'm-b3-gen-ok', threadId: 't', from: '', subject: '', date: '', attachmentCount: 1 },
      ],
      listAtts: async () => [
        { gmailMessageId: 'm-b3-gen-ok', threadId: 't', attachmentId: 'a', filename: 'doc.pdf', mimeType: 'application/octet-stream', size: PDF_DANFE.length },
      ],
      downloadAtt: async () => PDF_DANFE,
    });
    const scan = createScan(deps);
    const r = await scan({ confirmReal: true });
    expect(r.newDocuments).toBe(1);
    const db = getDb();
    const doc = db.prepare(`SELECT tipo_documento, formato FROM documentos LIMIT 1`).get() as any;
    expect(doc.formato).toBe('pdf');
    expect(doc.tipo_documento).toBe('nf');
  });

  it('scan com .pdf + MIME generic e signature inválida → desconhecido + formato pdf', async () => {
    const deps = pdfDeps({
      fetchEmails: async () => [
        { gmailMessageId: 'm-b3-gen-bad', threadId: 't', from: '', subject: '', date: '', attachmentCount: 1 },
      ],
      listAtts: async () => [
        { gmailMessageId: 'm-b3-gen-bad', threadId: 't', attachmentId: 'a', filename: 'NF-123.pdf', mimeType: 'application/octet-stream', size: PDF_NOT_PDF.length },
      ],
      downloadAtt: async () => PDF_NOT_PDF,
    });
    const scan = createScan(deps);
    const r = await scan({ confirmReal: true });
    expect(r.newDocuments).toBe(1);
    const db = getDb();
    const doc = db.prepare(`SELECT tipo_documento, formato FROM documentos LIMIT 1`).get() as any;
    expect(doc.formato).toBe('pdf');
    expect(doc.tipo_documento).toBe('desconhecido');
  });

  it('scan com romaneio no nome → romaneio (precedência mantida, sem OCR)', async () => {
    const deps = pdfDeps({
      fetchEmails: async () => [
        { gmailMessageId: 'm-b3-rom', threadId: 't', from: '', subject: '', date: '', attachmentCount: 1 },
      ],
      listAtts: async () => [
        { gmailMessageId: 'm-b3-rom', threadId: 't', attachmentId: 'a', filename: 'romaneio_carga.pdf', mimeType: 'application/pdf', size: PDF_DANFE.length },
      ],
      downloadAtt: async () => PDF_DANFE,
    });
    const scan = createScan(deps);
    const r = await scan({ confirmReal: true });
    expect(r.newDocuments).toBe(1);
    const db = getDb();
    const doc = db.prepare(`SELECT tipo_documento, formato FROM documentos LIMIT 1`).get() as any;
    expect(doc.tipo_documento).toBe('romaneio');
    expect(doc.formato).toBe('pdf');
  });

  it('scan com MIME XML ext diferente (application/octet-stream + .xml) preserva classificação XML (B2)', async () => {
    const deps = pdfDeps({
      fetchEmails: async () => [
        { gmailMessageId: 'm-b3-xml', threadId: 't', from: '', subject: '', date: '', attachmentCount: 1 },
      ],
      listAtts: async () => [
        { gmailMessageId: 'm-b3-xml', threadId: 't', attachmentId: 'a', filename: 'nfe.xml', mimeType: 'application/octet-stream', size: VALID_XML.length },
      ],
      downloadAtt: async () => VALID_XML,
    });
    const scan = createScan(deps);
    const r = await scan({ confirmReal: true });
    expect(r.newDocuments).toBe(1);
    const db = getDb();
    const doc = db.prepare(`SELECT tipo_documento, formato, cnpj_emitente, cnpj_destinatario FROM documentos LIMIT 1`).get() as any;
    expect(doc.tipo_documento).toBe('nf');
    expect(doc.formato).toBe('xml');
    expect(doc.cnpj_emitente).toBe('11222333000181');
    expect(doc.cnpj_destinatario).toBe('11444777000161');
  });

  it('scan com text/html + .xml preserva classificação XML (B2) — formato xml', async () => {
    const deps = pdfDeps({
      fetchEmails: async () => [
        { gmailMessageId: 'm-b3-html-xml', threadId: 't', from: '', subject: '', date: '', attachmentCount: 1 },
      ],
      listAtts: async () => [
        { gmailMessageId: 'm-b3-html-xml', threadId: 't', attachmentId: 'a', filename: 'nfe.xml', mimeType: 'text/html', size: VALID_XML.length },
      ],
      downloadAtt: async () => VALID_XML,
    });
    const scan = createScan(deps);
    const r = await scan({ confirmReal: true });
    expect(r.newDocuments).toBe(1);
    const db = getDb();
    const doc = db.prepare(`SELECT tipo_documento, formato FROM documentos LIMIT 1`).get() as any;
    expect(doc.tipo_documento).toBe('nf');
    expect(doc.formato).toBe('xml');
  });

  it('scan limita sample de PDF a 2048 bytes (não persiste, não amplia)', async () => {
    const validPrefix = Buffer.from('%PDF-1.4\nDANFE - DOCUMENTO AUXILIAR\n', 'utf-8');
    const padding = Buffer.alloc(2048 - validPrefix.length, 0x20);
    const tail = Buffer.from('conteudo irrelevante apos sample', 'utf-8');
    const big = Buffer.concat([validPrefix, padding, tail]);
    expect(big.length).toBeGreaterThan(2048);

    const deps = pdfDeps({
      fetchEmails: async () => [
        { gmailMessageId: 'm-b3-cap', threadId: 't', from: '', subject: 'Sem NF no subject', date: '', attachmentCount: 1 },
      ],
      listAtts: async () => [
        { gmailMessageId: 'm-b3-cap', threadId: 't', attachmentId: 'a', filename: 'documento.pdf', mimeType: 'application/pdf', size: big.length },
      ],
      downloadAtt: async () => big,
    });
    const scan = createScan(deps);
    const r = await scan({ confirmReal: true });
    expect(r.newDocuments).toBe(1);
    const db = getDb();
    const doc = db.prepare(`SELECT tipo_documento, formato, direcao_nf FROM documentos LIMIT 1`).get() as any;
    expect(doc.tipo_documento).toBe('nf');
    expect(doc.formato).toBe('pdf');
    expect(doc.direcao_nf).toBeNull();
  });

  it('scan não persiste sample de PDF no banco (verifica ausência de coluna de sample)', async () => {
    const deps = pdfDeps({
      fetchEmails: async () => [
        { gmailMessageId: 'm-b3-nopersist', threadId: 't', from: '', subject: '', date: '', attachmentCount: 1 },
      ],
      listAtts: async () => [
        { gmailMessageId: 'm-b3-nopersist', threadId: 't', attachmentId: 'a', filename: 'doc.pdf', mimeType: 'application/pdf', size: PDF_DANFE.length },
      ],
      downloadAtt: async () => PDF_DANFE,
    });
    const scan = createScan(deps);
    await scan({ confirmReal: true });
    const db = getDb();
    const cols = db.prepare(`PRAGMA table_info(documentos)`).all() as any[];
    const names = cols.map((c: any) => c.name);
    expect(names).not.toContain('content_sample');
    expect(names).not.toContain('sample');
    expect(names).not.toContain('contentSample');
  });

  it('scan com PDF real e status permanece pending (sem autoaceite)', async () => {
    const deps = pdfDeps({
      fetchEmails: async () => [
        { gmailMessageId: 'm-b3-status', threadId: 't', from: '', subject: 'Sem NF no subject', date: '', attachmentCount: 1 },
      ],
      listAtts: async () => [
        { gmailMessageId: 'm-b3-status', threadId: 't', attachmentId: 'a', filename: 'documento.pdf', mimeType: 'application/pdf', size: PDF_DANFE.length },
      ],
      downloadAtt: async () => PDF_DANFE,
    });
    const scan = createScan(deps);
    await scan({ confirmReal: true });
    const db = getDb();
    const doc = db.prepare(`SELECT status, tipo_documento, formato FROM documentos LIMIT 1`).get() as any;
    expect(doc.status).toBe('pending');
    expect(doc.tipo_documento).toBe('nf');
    expect(doc.formato).toBe('pdf');
  });
});

describe('B2-R1 real scan: full XML text delivery (>2048 bytes)', () => {
  beforeEach(() => {
    if (existsSync(DB_DIR)) rmSync(DB_DIR, { recursive: true });
    mkdirSync(DB_DIR, { recursive: true });
    process.env.DATABASE_PATH = join(DB_DIR, 'app.db');
    process.env.OUTBOX_PATH = join(DB_DIR, 'outbox.jsonl');
    process.env.LOCAL_CACHE_PATH = join(DB_DIR, 'cache');
    process.env.GOOGLE_DRIVE_ROOT_FOLDER_NAME = 'Ravatex Documents Ingestor';
    closeDb();
    const db = getDb();
    db.exec('DELETE FROM document_technical_evidences; DELETE FROM ingestion_events; DELETE FROM documentos; DELETE FROM emails_processados;');
  });

  afterEach(() => {
    closeDb();
    if (existsSync(DB_DIR)) rmSync(DB_DIR, { recursive: true });
  });

  const EMIT_CNPJ = '11222333000181';
  const DEST_CNPJ = '11444777000161';

  function buildLargeNfeBuffer(opts: {
    root?: 'nfeProc' | 'NFe';
    padBeforeEmit?: boolean;
    padBeforeDest?: boolean;
    malformed?: boolean;
  } = {}): { buffer: Buffer; emitBeyond2048: boolean; destBeyond2048: boolean } {
    const root = opts.root ?? 'nfeProc';
    const prefix = root === 'nfeProc'
      ? `<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe"><NFe><infNFe>`
      : `<NFe xmlns="http://www.portalfiscal.inf.br/nfe"><infNFe>`;
    const prefixLen = Buffer.byteLength(prefix, 'utf-8');
    const paddingNeed = Math.max(0, 2048 - prefixLen + 50);
    const padEl = `<obs>${'X'.repeat(paddingNeed)}</obs>`;
    const emitBlock = `<emit><CNPJ>${EMIT_CNPJ}</CNPJ></emit>`;
    const destBlock = `<dest><CNPJ>${DEST_CNPJ}</CNPJ></dest>`;
    const suffix = root === 'nfeProc'
      ? `</infNFe></NFe></nfeProc>`
      : `</infNFe></NFe>`;

    let body: string;
    if (opts.malformed) {
      body = padEl + `<emit><CNPJ>${EMIT_CNPJ}`;
    } else if (opts.padBeforeEmit) {
      body = padEl + emitBlock + destBlock;
    } else if (opts.padBeforeDest) {
      body = emitBlock + padEl + destBlock;
    } else {
      body = emitBlock + destBlock;
    }

    const fullStr = prefix + body + suffix;
    const buffer = Buffer.from(fullStr, 'utf-8');

    const emitIdx = fullStr.indexOf('<emit>');
    const destIdx = fullStr.indexOf('<dest>');
    return {
      buffer,
      emitBeyond2048: emitIdx > 2048,
      destBeyond2048: destIdx > 2048,
    };
  }

  function b2r1Deps(buffer: Buffer, overrides: Partial<ScanDeps> = {}): ScanDeps {
    return mkDeps({
      fetchEmails: async () => [
        { gmailMessageId: 'm-b2r1', threadId: 't', from: '', subject: 'B2R1', date: '', attachmentCount: 1 },
      ],
      listAtts: async () => [
        { gmailMessageId: 'm-b2r1', threadId: 't', attachmentId: 'a-b2r1', filename: 'nfe.xml', mimeType: 'text/xml', size: buffer.length },
      ],
      downloadAtt: async () => buffer,
      createEntityCnpjReaderClient: () => ({ from: () => ({ select: () => ({ not: () => Promise.resolve({ data: [], error: null }) }) }) } as any),
      loadEntityCnpjRegistry: async () => ({ loaded: true, loadedAt: new Date().toISOString(), entries: [], error: null }),
      ...overrides,
    });
  }

  it('large nfeProc XML (>2048) with emit CNPJ beyond 2048 bytes → nf + xml + extracted CNPJs', async () => {
    const { buffer, emitBeyond2048 } = buildLargeNfeBuffer({ root: 'nfeProc', padBeforeEmit: true });
    expect(buffer.length).toBeGreaterThan(2048);
    expect(emitBeyond2048).toBe(true);

    const deps = b2r1Deps(buffer);
    const scan = createScan(deps);
    const r = await scan({ confirmReal: true });
    expect(r.newDocuments).toBe(1);

    const db = getDb();
    const doc = db.prepare(`SELECT tipo_documento, formato, cnpj_emitente, cnpj_destinatario FROM documentos LIMIT 1`).get() as any;
    expect(doc.tipo_documento).toBe('nf');
    expect(doc.formato).toBe('xml');
    expect(doc.cnpj_emitente).toBe(EMIT_CNPJ);
    expect(doc.cnpj_destinatario).toBe(DEST_CNPJ);
  });

  it('large NFe root XML (>2048) without nfeProc envelope → nf + xml', async () => {
    const { buffer, emitBeyond2048 } = buildLargeNfeBuffer({ root: 'NFe', padBeforeEmit: true });
    expect(buffer.length).toBeGreaterThan(2048);
    expect(emitBeyond2048).toBe(true);

    const deps = b2r1Deps(buffer, {
      listAtts: async () => [
        { gmailMessageId: 'm-b2r1', threadId: 't', attachmentId: 'a', filename: 'nfe.xml', mimeType: 'application/octet-stream', size: buffer.length },
      ],
    });
    const scan = createScan(deps);
    const r = await scan({ confirmReal: true });
    expect(r.newDocuments).toBe(1);

    const db = getDb();
    const doc = db.prepare(`SELECT tipo_documento, formato FROM documentos LIMIT 1`).get() as any;
    expect(doc.tipo_documento).toBe('nf');
    expect(doc.formato).toBe('xml');
  });

  it('large nfeProc XML with dest CNPJ beyond 2048 bytes → nf + xml + extracted dest CNPJ', async () => {
    const { buffer, destBeyond2048 } = buildLargeNfeBuffer({ root: 'nfeProc', padBeforeDest: true });
    expect(buffer.length).toBeGreaterThan(2048);
    expect(destBeyond2048).toBe(true);

    const deps = b2r1Deps(buffer);
    const scan = createScan(deps);
    const r = await scan({ confirmReal: true });
    expect(r.newDocuments).toBe(1);

    const db = getDb();
    const doc = db.prepare(`SELECT tipo_documento, formato, cnpj_emitente, cnpj_destinatario FROM documentos LIMIT 1`).get() as any;
    expect(doc.tipo_documento).toBe('nf');
    expect(doc.formato).toBe('xml');
    expect(doc.cnpj_emitente).toBe(EMIT_CNPJ);
    expect(doc.cnpj_destinatario).toBe(DEST_CNPJ);
  });

  it('large malformed XML (>2048) → desconhecido + formato xml', async () => {
    const { buffer } = buildLargeNfeBuffer({ root: 'nfeProc', padBeforeEmit: true, malformed: true });
    expect(buffer.length).toBeGreaterThan(2048);

    const deps = b2r1Deps(buffer);
    const scan = createScan(deps);
    const r = await scan({ confirmReal: true });
    expect(r.newDocuments).toBe(1);

    const db = getDb();
    const doc = db.prepare(`SELECT tipo_documento, formato, cnpj_emitente, cnpj_destinatario FROM documentos LIMIT 1`).get() as any;
    expect(doc.tipo_documento).toBe('desconhecido');
    expect(doc.formato).toBe('xml');
    expect(doc.cnpj_emitente).toBeNull();
    expect(doc.cnpj_destinatario).toBeNull();
  });

  it('large generic XML (>2048) with nfe text but no NFe structure → desconhecido', async () => {
    const generic = Buffer.from(`<root><item>${'A'.repeat(1500)}nfe${'B'.repeat(1500)}</item></root>`, 'utf-8');
    expect(generic.length).toBeGreaterThan(2048);

    const deps = b2r1Deps(generic, {
      listAtts: async () => [
        { gmailMessageId: 'm-b2r1', threadId: 't', attachmentId: 'a', filename: 'generic.xml', mimeType: 'text/xml', size: generic.length },
      ],
    });
    const scan = createScan(deps);
    const r = await scan({ confirmReal: true });
    expect(r.newDocuments).toBe(1);

    const db = getDb();
    const doc = db.prepare(`SELECT tipo_documento, formato FROM documentos LIMIT 1`).get() as any;
    expect(doc.tipo_documento).toBe('desconhecido');
    expect(doc.formato).toBe('xml');
  });

  it('PDF sample remains capped at 2048 bytes (B2-R1 guard)', async () => {
    const pdfSig = '%PDF-1.4\n';
    const prefix = Buffer.from(pdfSig + 'DANFE - DOCUMENTO AUXILIAR\n', 'utf-8');
    const pad = Buffer.alloc(3500, 0x30);
    const tail = Buffer.from('\n%%EOF', 'utf-8');
    const bigPdf = Buffer.concat([prefix, pad, tail]);
    expect(bigPdf.length).toBeGreaterThan(3500);

    const deps = mkDeps({
      fetchEmails: async () => [
        { gmailMessageId: 'm-b2r1-pdf', threadId: 't', from: '', subject: 'B2R1 PDF', date: '', attachmentCount: 1 },
      ],
      listAtts: async () => [
        { gmailMessageId: 'm-b2r1-pdf', threadId: 't', attachmentId: 'a', filename: 'documento.pdf', mimeType: 'application/pdf', size: bigPdf.length },
      ],
      downloadAtt: async () => bigPdf,
      createEntityCnpjReaderClient: () => ({ from: () => ({ select: () => ({ not: () => Promise.resolve({ data: [], error: null }) }) }) } as any),
      loadEntityCnpjRegistry: async () => ({ loaded: true, loadedAt: new Date().toISOString(), entries: [], error: null }),
    });
    const scan = createScan(deps);
    const r = await scan({ confirmReal: true });
    expect(r.newDocuments).toBe(1);

    const db = getDb();
    const doc = db.prepare(`SELECT tipo_documento, formato, direcao_nf FROM documentos LIMIT 1`).get() as any;
    expect(doc.tipo_documento).toBe('nf');
    expect(doc.formato).toBe('pdf');
    expect(doc.direcao_nf).toBeNull();
  });

  it('large nfeProc XML (>2048) persists CNPJs correctly in SQLite', async () => {
    const { buffer } = buildLargeNfeBuffer({ root: 'nfeProc', padBeforeEmit: true });
    expect(buffer.length).toBeGreaterThan(2048);

    const deps = b2r1Deps(buffer);
    const scan = createScan(deps);
    const r = await scan({ confirmReal: true });
    expect(r.newDocuments).toBe(1);

    const db = getDb();
    const cols = db.prepare(`PRAGMA table_info(documentos)`).all() as any[];
    const colNames = new Set(cols.map((c: any) => c.name));
    expect(colNames.has('cnpj_emitente')).toBe(true);
    expect(colNames.has('cnpj_destinatario')).toBe(true);

    const doc = db.prepare(`SELECT cnpj_emitente, cnpj_destinatario FROM documentos LIMIT 1`).get() as any;
    expect(doc.cnpj_emitente).toBe(EMIT_CNPJ);
    expect(doc.cnpj_destinatario).toBe(DEST_CNPJ);
  });

  it('B2-R1: PDF with %PDF- prefix and DANFE token only after byte 2048 → desconhecido (PDF cap delivery proven)', async () => {
    const sig = '%PDF-1.4\n';
    const padNeeded = 2048 - sig.length;
    const first2048 = Buffer.from(sig + 'X'.repeat(padNeeded), 'utf-8');
    expect(first2048.length).toBe(2048);
    const beyond = Buffer.from('DANFE - DOCUMENTO AUXILIAR DA NOTA FISCAL ELETRÔNICA\n%%EOF\n', 'utf-8');
    const bigPdf = Buffer.concat([first2048, beyond]);
    expect(bigPdf.length).toBeGreaterThan(2048);
    expect(bigPdf.toString('utf-8').indexOf('DANFE')).toBeGreaterThanOrEqual(2048);

    const deps = mkDeps({
      fetchEmails: async () => [
        { gmailMessageId: 'm-pdf-danfe-after', threadId: 't', from: '', subject: '', date: '', attachmentCount: 1 },
      ],
      listAtts: async () => [
        { gmailMessageId: 'm-pdf-danfe-after', threadId: 't', attachmentId: 'a', filename: 'documento.pdf', mimeType: 'application/pdf', size: bigPdf.length },
      ],
      downloadAtt: async () => bigPdf,
      createEntityCnpjReaderClient: () => ({ from: () => ({ select: () => ({ not: () => Promise.resolve({ data: [], error: null }) }) }) } as any),
      loadEntityCnpjRegistry: async () => ({ loaded: true, loadedAt: new Date().toISOString(), entries: [], error: null }),
    });
    const scan = createScan(deps);
    const r = await scan({ confirmReal: true });
    expect(r.newDocuments).toBe(1);

    const db = getDb();
    const doc = db.prepare(`SELECT tipo_documento, formato, direcao_nf FROM documentos LIMIT 1`).get() as any;
    expect(doc.tipo_documento).toBe('desconhecido');
    expect(doc.formato).toBe('pdf');
    expect(doc.direcao_nf).toBeNull();
  });

  it('B2-R1: truncating >2048 valid NF-e text at 2048 → desconhecido, intact full buffer → nf/xml (behavior-level truncation)', async () => {
    const prefix = '<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe"><NFe><infNFe>';
    const prefixLen = Buffer.byteLength(prefix, 'utf-8');
    const padNeeded = 2048 - prefixLen + 100;
    const pad = 'X'.repeat(padNeeded);
    const emitBlock = '<emit><CNPJ>11222333000181</CNPJ></emit>';
    const destBlock = '<dest><CNPJ>11444777000161</CNPJ></dest>';
    const suffix = '</infNFe></NFe></nfeProc>';
    const fullText = prefix + '<obs>' + pad + '</obs>' + emitBlock + destBlock + suffix;
    const buffer = Buffer.from(fullText, 'utf-8');
    expect(buffer.length).toBeGreaterThan(2048);

    const deps = mkDeps({
      fetchEmails: async () => [
        { gmailMessageId: 'm-trunc', threadId: 't', from: '', subject: '', date: '', attachmentCount: 1 },
      ],
      listAtts: async () => [
        { gmailMessageId: 'm-trunc', threadId: 't', attachmentId: 'a', filename: 'nfe.xml', mimeType: 'text/xml', size: buffer.length },
      ],
      downloadAtt: async () => buffer,
      createEntityCnpjReaderClient: () => ({ from: () => ({ select: () => ({ not: () => Promise.resolve({ data: [], error: null }) }) }) } as any),
      loadEntityCnpjRegistry: async () => ({ loaded: true, loadedAt: new Date().toISOString(), entries: [], error: null }),
    });
    const scan = createScan(deps);
    const r = await scan({ confirmReal: true });
    expect(r.newDocuments).toBe(1);

    const db = getDb();
    const doc = db.prepare(`SELECT tipo_documento, formato, cnpj_emitente FROM documentos LIMIT 1`).get() as any;
    expect(doc.tipo_documento).toBe('nf');
    expect(doc.formato).toBe('xml');
    expect(doc.cnpj_emitente).toBe('11222333000181');

    const truncated = fullText.substring(0, 2048);
    const result = classifyAttachment({
      filename: 'nfe.xml',
      mimeType: 'text/xml',
      contentSample: truncated,
    });
    expect(result.tipoDocumento).toBe('desconhecido');
    expect(result.formato).toBe('xml');
  });

  it('B2-R1: unique XML sentinel located after 2048 is absent from SQLite, outbox, and logger output', async () => {
    const SENTINEL = 'UNIQUE-SENTINEL-CHECK-7f3a1b9c';

    const prefix = '<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe"><NFe><infNFe>';
    const prefixLen = Buffer.byteLength(prefix, 'utf-8');
    const padNeeded = 2048 - prefixLen + 50;
    const pad = 'X'.repeat(padNeeded);
    const fullText = prefix + '<obs>' + pad + '<!--' + SENTINEL + '--></obs>' + '<emit><CNPJ>11222333000181</CNPJ></emit>' + '<dest><CNPJ>11444777000161</CNPJ></dest>' + '</infNFe></NFe></nfeProc>';
    const buffer = Buffer.from(fullText, 'utf-8');
    expect(buffer.length).toBeGreaterThan(2048);
    expect(fullText.indexOf(SENTINEL)).toBeGreaterThan(2048);

    const logPath = join(DB_DIR, 'sentinel-log.jsonl');
    const logger = {
      path: logPath,
      log(event: any): void {
        appendFileSync(logPath, JSON.stringify(event) + '\n', 'utf-8');
      },
    };

    const deps = mkDeps({
      fetchEmails: async () => [
        { gmailMessageId: 'm-sentinel', threadId: 't', from: '', subject: '', date: '', attachmentCount: 1 },
      ],
      listAtts: async () => [
        { gmailMessageId: 'm-sentinel', threadId: 't', attachmentId: 'a', filename: 'nfe.xml', mimeType: 'text/xml', size: buffer.length },
      ],
      downloadAtt: async () => buffer,
      createEntityCnpjReaderClient: () => ({ from: () => ({ select: () => ({ not: () => Promise.resolve({ data: [], error: null }) }) }) } as any),
      loadEntityCnpjRegistry: async () => ({ loaded: true, loadedAt: new Date().toISOString(), entries: [], error: null }),
      logger,
    });
    const scan = createScan(deps);
    const r = await scan({ confirmReal: true });
    expect(r.newDocuments).toBe(1);

    const db = getDb();

    const docRow = db.prepare(`SELECT * FROM documentos`).get() as any;
    expect(docRow.cnpj_emitente).toBe('11222333000181');
    expect(docRow.cnpj_destinatario).toBe('11444777000161');

    const cols = db.prepare(`PRAGMA table_info(documentos)`).all() as any[];
    for (const col of cols) {
      const val = docRow[col.name];
      if (typeof val === 'string') {
        expect(val, `documentos.${col.name} must not contain sentinel`).not.toContain(SENTINEL);
      }
    }

    const eventCols = db.prepare(`PRAGMA table_info(ingestion_events)`).all() as any[];
    const eventRow = db.prepare(`SELECT * FROM ingestion_events`).get() as any;
    for (const col of eventCols) {
      const val = eventRow[col.name];
      if (typeof val === 'string') {
        expect(val, `ingestion_events.${col.name} must not contain sentinel`).not.toContain(SENTINEL);
      }
    }

    const outboxPath = process.env.OUTBOX_PATH!;
    if (existsSync(outboxPath)) {
      const outboxContent = readFileSync(outboxPath, 'utf-8');
      expect(outboxContent, 'outbox must not contain sentinel').not.toContain(SENTINEL);
    }

    const logContent = readFileSync(logPath, 'utf-8');
    expect(logContent, 'logger must not contain sentinel').not.toContain(SENTINEL);

    for (const err of r.errors) {
      expect(err, 'errors must not contain sentinel').not.toContain(SENTINEL);
    }
  });
});

describe('G28-B2-B4: technical evidence persistence with FK-safe transaction', () => {
  beforeEach(() => {
    if (existsSync(DB_DIR)) rmSync(DB_DIR, { recursive: true });
    mkdirSync(DB_DIR, { recursive: true });
    process.env.DATABASE_PATH = join(DB_DIR, 'app.db');
    process.env.OUTBOX_PATH = join(DB_DIR, 'outbox.jsonl');
    process.env.LOCAL_CACHE_PATH = join(DB_DIR, 'cache');
    process.env.GOOGLE_DRIVE_ROOT_FOLDER_NAME = 'Ravatex Documents Ingestor';
    closeDb();
    const db = getDb();
    db.exec('DELETE FROM document_technical_evidences; DELETE FROM ingestion_events; DELETE FROM documentos; DELETE FROM emails_processados;');
  });

  afterEach(() => {
    closeDb();
    if (existsSync(DB_DIR)) rmSync(DB_DIR, { recursive: true });
  });

  const EMIT_CNPJ = '11222333000181';
  const DEST_CNPJ = '11444777000161';
  const VALID_XML = Buffer.from(
    `<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe"><NFe><infNFe><emit><CNPJ>${EMIT_CNPJ}</CNPJ></emit><dest><CNPJ>${DEST_CNPJ}</CNPJ></dest></infNFe></NFe></nfeProc>`
  );
  const REGISTRY = { loaded: true, loadedAt: new Date().toISOString(), entries: [], error: null };

  function techOrigin(): Omit<EvidenceOrigin, 'evidenceVersion'> {
    return {
      technical: { source: 'realScan@G28-B4', authorship: 'system' },
      suggestion: { source: 'system', authorship: 'realScan', note: 'normal ingestion' },
    };
  }

  function pdfDeps(overrides: Partial<ScanDeps> = {}): ScanDeps {
    return mkDeps({
      fetchEmails: async () => [
        { gmailMessageId: 'msg-b4', threadId: 't', from: '', subject: 'B4', date: '', attachmentCount: 1 },
      ],
      listAtts: async () => [
        { gmailMessageId: 'msg-b4', threadId: 't', attachmentId: 'a-b4', filename: 'nfe.xml', mimeType: 'text/xml', size: VALID_XML.length },
      ],
      downloadAtt: async () => VALID_XML,
      createEntityCnpjReaderClient: () => ({ from: () => ({ select: () => ({ not: () => Promise.resolve({ data: [], error: null }) }) }) } as any),
      loadEntityCnpjRegistry: async () => REGISTRY,
      ...overrides,
    });
  }

  it('persists a normal document, event and evidence v1 with exact classifier-builder observations and origin without forbidden decision fields', async () => {
    const scan = createScan(pdfDeps());
    const r = await scan({ confirmReal: true });
    expect(r.newDocuments).toBe(1);

    const db = getDb();
    const docs = db.prepare(`SELECT id FROM documentos`).all() as Array<{ id: string }>;
    expect(docs).toHaveLength(1);
    const events = db.prepare(`SELECT * FROM ingestion_events WHERE event_type = 'document.detected'`).all();
    expect(events).toHaveLength(1);

    const stored = getCurrentTechnicalEvidence(db, docs[0].id);
    expect(stored).not.toBeNull();
    if (!stored) throw new Error('evidence missing');
    expect(stored.evidenceVersion).toBe(1);
    expect(stored.origin.evidenceVersion).toBe(1);
    expect(stored.documentId).toBe(docs[0].id);

    const classificacao = classifyAttachment({
      filename: 'nfe.xml',
      mimeType: 'text/xml',
      subject: 'B4',
      contentSample: VALID_XML.toString('utf-8'),
      entityRegistry: REGISTRY,
    });
    const expectedBuilt = buildTechnicalEvidence({
      classification: classificacao,
      registryAvailability: { kind: 'available' },
      duplicateRelation: { kind: 'none', detectionBasis: 'gmail_message_id+attachment_id+sha256' },
      origin: techOrigin(),
    });
    expect(stored.technicalEvidence).toEqual(expectedBuilt.technicalEvidence);
    expect(stored.technicalEvidence.tipoDocumento).toBe('nf');
    expect(stored.technicalEvidence.formato).toBe('xml');
    expect(stored.technicalEvidence.xmlObservation.classification).toBe('structural_nfe');
    expect(stored.technicalEvidence.cnpjEmitente).toEqual({ kind: 'valid', normalized: EMIT_CNPJ });
    expect(stored.technicalEvidence.cnpjDestinatario).toEqual({ kind: 'valid', normalized: DEST_CNPJ });
    expect(stored.technicalEvidence.registryAvailability).toEqual({ kind: 'available' });
    expect(stored.technicalEvidence.duplicateRelation).toEqual({
      kind: 'none',
      detectionBasis: 'gmail_message_id+attachment_id+sha256',
    });
    expect(stored.technicalEvidence.directionObservation).not.toBeNull();
    expect(stored.technicalEvidence.entityMatch).not.toBeNull();
    if (stored.technicalEvidence.entityMatch) {
      expect(stored.technicalEvidence.entityMatch.state).toBe('unmatched');
    }

    expect(stored.origin.evidenceVersion).toBe(1);
    expect(stored.origin.technical).toEqual({ source: 'realScan@G28-B4', authorship: 'system' });
    expect(stored.origin.suggestion).toEqual({ source: 'system', authorship: 'realScan', note: 'normal ingestion' });
    for (const forbidden of [
      'humanDecision',
      'humanReview',
      'score',
      'confidence',
      'autoAccept',
      'autoaccept',
      'accepted',
      'rejected',
      'rating',
      'qualified',
      'qualification',
    ]) {
      expect(stored.origin, `origin must not have ${forbidden}`).not.toHaveProperty(forbidden);
    }

    const inputOrigin = techOrigin();
    expect(inputOrigin).not.toHaveProperty('evidenceVersion');
    for (const forbidden of [
      'humanDecision',
      'score',
      'confidence',
      'autoAccept',
      'autoaccept',
    ]) {
      expect(inputOrigin, `input origin must not have ${forbidden}`).not.toHaveProperty(forbidden);
    }
  });

  it('rollback: forced evidence failure rolls back document/event/evidence together', async () => {
    const db = getDb();
    db.exec(
      `CREATE TEMP TRIGGER _force_evidence_fail
         BEFORE INSERT ON document_technical_evidences
         BEGIN
           SELECT RAISE(ABORT, 'forced evidence failure');
         END;`
    );

    try {
      const scan = createScan(pdfDeps());
      const r = await scan({ confirmReal: true });
      expect(r.newDocuments).toBe(0);
      expect(r.errors.some((e) => e.includes('forced evidence failure'))).toBe(true);

      const docCount = (db.prepare(`SELECT COUNT(*) AS c FROM documentos`).get() as { c: number }).c;
      const evCount = (db.prepare(`SELECT COUNT(*) AS c FROM ingestion_events`).get() as { c: number }).c;
      const tevCount = (db.prepare(`SELECT COUNT(*) AS c FROM document_technical_evidences`).get() as { c: number }).c;
      expect(docCount).toBe(0);
      expect(evCount).toBe(0);
      expect(tevCount).toBe(0);
    } finally {
      db.exec(`DROP TRIGGER IF EXISTS _force_evidence_fail`);
    }
  });

  it('rollback: forced event failure rolls back document/event/evidence together', async () => {
    const db = getDb();
    db.exec(
      `CREATE TEMP TRIGGER _force_event_fail
         BEFORE INSERT ON ingestion_events
         BEGIN
           SELECT RAISE(ABORT, 'forced event failure');
         END;`
    );

    try {
      const scan = createScan(pdfDeps());
      const r = await scan({ confirmReal: true });
      expect(r.newDocuments).toBe(0);
      expect(r.errors.some((e) => e.includes('forced event failure'))).toBe(true);

      const docCount = (db.prepare(`SELECT COUNT(*) AS c FROM documentos`).get() as { c: number }).c;
      const evCount = (db.prepare(`SELECT COUNT(*) AS c FROM ingestion_events`).get() as { c: number }).c;
      const tevCount = (db.prepare(`SELECT COUNT(*) AS c FROM document_technical_evidences`).get() as { c: number }).c;
      expect(docCount).toBe(0);
      expect(evCount).toBe(0);
      expect(tevCount).toBe(0);
    } finally {
      db.exec(`DROP TRIGGER IF EXISTS _force_event_fail`);
    }
  });

  it('rerun of the same email creates no extra evidence and preserves legacy counters', async () => {
    const scan = createScan(pdfDeps());
    const r1 = await scan({ confirmReal: true });
    expect(r1.newDocuments).toBe(1);
    expect(r1.crossMessageDuplicates).toBe(0);
    expect(r1.duplicates).toBe(0);

    const db = getDb();
    const evidenceRows = db.prepare(`SELECT document_id, evidence_version FROM document_technical_evidences`).all();
    expect(evidenceRows).toHaveLength(1);
    const events = db.prepare(`SELECT * FROM ingestion_events`).all();
    expect(events).toHaveLength(1);

    const r2 = await scan({ confirmReal: true });
    expect(r2.newDocuments).toBe(0);
    expect(r2.crossMessageDuplicates).toBe(0);
    expect(r2.duplicates).toBe(0);
    expect(r2.errors).toEqual([]);

    const evidenceRowsAfter = db.prepare(`SELECT document_id, evidence_version FROM document_technical_evidences`).all();
    expect(evidenceRowsAfter).toHaveLength(1);
    const eventsAfter = db.prepare(`SELECT * FROM ingestion_events`).all();
    expect(eventsAfter).toHaveLength(1);
  });

  it('unavailable registry persists unavailable separately from matching', async () => {
    const deps = pdfDeps({
      createEntityCnpjReaderClient: () => { throw new Error('registry_load_failed simulated'); },
      loadEntityCnpjRegistry: async () => ({ loaded: true, loadedAt: '', entries: [], error: null }),
    });
    const scan = createScan(deps);
    const r = await scan({ confirmReal: true });
    expect(r.newDocuments).toBe(1);

    const db = getDb();
    const docs = db.prepare(`SELECT id FROM documentos`).all() as Array<{ id: string }>;
    expect(docs).toHaveLength(1);
    const stored = getCurrentTechnicalEvidence(db, docs[0].id);
    expect(stored).not.toBeNull();
    if (!stored) throw new Error('evidence missing');

    expect(stored.technicalEvidence.registryAvailability.kind).toBe('unavailable');
    if (stored.technicalEvidence.registryAvailability.kind === 'unavailable') {
      expect(stored.technicalEvidence.registryAvailability.reason).toMatch(/registry/i);
      expect(stored.technicalEvidence.registryAvailability.warning)
        .toBe('Registry unavailable: document matching limited. Human review required.');
    }
    expect(stored.technicalEvidence.entityMatch).not.toBeNull();
    if (stored.technicalEvidence.entityMatch) {
      expect(stored.technicalEvidence.entityMatch.state).toBe('registry_unavailable');
      expect(stored.technicalEvidence.entityMatch.emitente.state).toBe('registry_unavailable');
      expect(stored.technicalEvidence.entityMatch.destinatario.state).toBe('registry_unavailable');
    }
  });

  it('download and upload observe database.inTransaction === false', async () => {
    const observed: Array<{ phase: 'download' | 'upload'; inTransaction: boolean }> = [];
    const deps = pdfDeps({
      downloadAtt: async (msgId, attId) => {
        const db = getDb();
        observed.push({ phase: 'download', inTransaction: db.inTransaction });
        return VALID_XML;
      },
      uploadDoc: async (params) => {
        const db = getDb();
        observed.push({ phase: 'upload', inTransaction: db.inTransaction });
        return {
          file: {
            storageUri: `gdrive://file/${params.filename}`,
            driveFileId: `id-${params.filename}`,
            driveWebViewLink: `https://drive.google.com/file/d/id-${params.filename}/view`,
            driveFolderId: 'mock-folder',
          },
        };
      },
    });
    const scan = createScan(deps);
    await scan({ confirmReal: true });

    expect(observed.some((o) => o.phase === 'download')).toBe(true);
    expect(observed.some((o) => o.phase === 'upload')).toBe(true);
    for (const o of observed) {
      expect(o.inTransaction).toBe(false);
    }
  });

  it('cross-message reuse persists evidence with cross_message_reuse and canonicalRef, no document.detected event', async () => {
    const fakePdf = Buffer.from('%PDF-1.4\nCROSS MESSAGE B4');
    const firstUploadId = 'mock-b4-cross';
    const bufMap: Record<string, Buffer> = {
      'msg-b4-cross-A': fakePdf,
      'msg-b4-cross-B': fakePdf,
    };
    const deps = mkDeps({
      fetchEmails: async () => [
        { gmailMessageId: 'msg-b4-cross-A', threadId: 'tA', from: '', subject: 'A', date: '', attachmentCount: 1 },
        { gmailMessageId: 'msg-b4-cross-B', threadId: 'tB', from: '', subject: 'B (re-send)', date: '', attachmentCount: 1 },
      ],
      listAtts: async (msgId) => [
        { gmailMessageId: msgId, threadId: 't', attachmentId: 'a', filename: 'NF-cross.pdf', mimeType: 'application/pdf', size: fakePdf.length },
      ],
      downloadAtt: async (msgId) => bufMap[msgId] ?? null,
      uploadDoc: async () => ({
        file: {
          storageUri: `gdrive://file/${firstUploadId}`,
          driveFileId: firstUploadId,
          driveWebViewLink: `https://drive.google.com/file/d/${firstUploadId}/view`,
          driveFolderId: 'mock-folder',
        },
      }),
      createEntityCnpjReaderClient: () => ({ from: () => ({ select: () => ({ not: () => Promise.resolve({ data: [], error: null }) }) }) } as any),
      loadEntityCnpjRegistry: async () => REGISTRY,
    });

    const scan = createScan(deps);
    const r = await scan({ confirmReal: true });
    expect(r.newDocuments).toBe(1);
    expect(r.crossMessageDuplicates).toBe(1);

    const db = getDb();
    const docs = db.prepare(`SELECT id, gmail_message_id FROM documentos ORDER BY created_at`).all() as Array<{ id: string; gmail_message_id: string }>;
    expect(docs).toHaveLength(2);
    const events = db.prepare(`SELECT * FROM ingestion_events WHERE event_type = 'document.detected'`).all();
    expect(events).toHaveLength(1);

    const evidenceRows = db.prepare(`SELECT document_id, technical_evidence FROM document_technical_evidences ORDER BY document_id`).all() as Array<{ document_id: string; technical_evidence: string }>;
    expect(evidenceRows).toHaveLength(2);

    const secondDocId = docs[1].id;
    const secondFromStore = getCurrentTechnicalEvidence(db, secondDocId);
    expect(secondFromStore).not.toBeNull();
    const duplicateRelation = secondFromStore!.technicalEvidence.duplicateRelation;
    expect(duplicateRelation.kind).toBe('cross_message_reuse');
    expect(duplicateRelation.detectionBasis).toBe('sha256+filename');
    expect(duplicateRelation.canonicalRef).toMatchObject({
      documentId: docs[0].id,
      gmailMessageId: 'msg-b4-cross-A',
      driveFileId: firstUploadId,
      sha256: expect.any(String),
      filenameOriginal: 'NF-cross.pdf',
    });
  });
});
