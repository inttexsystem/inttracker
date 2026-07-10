import { describe, expect, it } from 'vitest';
import {
  buildReconciliationGmailQuery,
  classifyTestCandidate,
  isMessageInWindow,
  matchGmailAttachment,
  planMetadataReconciliation,
  reconcileGmailDocuments,
  type ReconcileDeps,
  type ReconcileLocalDocument,
} from '../src/core/reconcileGmailDocuments.js';
import type { GmailAttachmentRef, GmailMessageMeta } from '../src/connectors/gmail.js';

const cutoff = new Date('2026-06-19T03:00:00.000Z');

function message(overrides: Partial<GmailMessageMeta> = {}): GmailMessageMeta {
  return {
    gmailMessageId: 'msg-001', threadId: 'thread-001', from: 'Fornecedor <fornecedor@empresa.com>',
    senderEmail: 'fornecedor@empresa.com', subject: 'NF teste', date: 'Fri, 19 Jun 2026 00:00:00 -0300',
    emailReceivedAt: '2026-06-19T03:00:00.000Z', emailReceivedAtSource: 'gmail_internal_date',
    emailReceivedAtEstimated: false, attachmentCount: 1, ...overrides,
  };
}

function attachment(overrides: Partial<GmailAttachmentRef> = {}): GmailAttachmentRef {
  return {
    gmailMessageId: 'msg-001', threadId: 'thread-001', attachmentId: 'att-001', filename: 'nota.xml',
    mimeType: 'application/xml', size: 10, ...overrides,
  };
}

function document(overrides: Partial<ReconcileLocalDocument> = {}): ReconcileLocalDocument {
  return {
    id: 'doc-001', gmailMessageId: 'msg-001', emailMessageId: null, attachmentId: 'att-001', sha256: 'hash-001',
    filename: 'nota.xml', senderEmail: null, emailReceivedAt: null, emailReceivedAtSource: null,
    emailReceivedAtEstimated: false, driveFileId: 'drive-001', status: 'accepted', pedidoManual: 'PED-25-2026',
    createdAt: '2026-06-19 03:00:00', ...overrides,
  };
}

describe('G25-B1-UX-B-C Gmail reconciliation', () => {
  it('starts Gmail one day before the cutoff and filters inclusively in UTC', () => {
    expect(buildReconciliationGmailQuery('2026-06-19')).toBe('after:2026/06/18 has:attachment (filename:pdf OR filename:xml)');
    expect(isMessageInWindow(message(), cutoff)).toBe(true);
    expect(isMessageInWindow(message({ emailReceivedAt: '2026-06-19T02:59:59.999Z' }), cutoff)).toBe(false);
  });

  it('matches canonical message ID plus hash before legacy and hash fallbacks', () => {
    const docs = [
      document({ id: 'legacy', emailMessageId: null }),
      document({ id: 'canonical', emailMessageId: 'msg-001' }),
    ];
    const result = matchGmailAttachment(docs, message(), attachment(), 'hash-001');
    expect(result.kind).toBe('canonical_message_id');
    expect(result.document?.id).toBe('canonical');
  });

  it('falls back to legacy message ID, then exact hash, but never filename alone', () => {
    expect(matchGmailAttachment([document()], message(), attachment(), 'hash-001').kind).toBe('legacy_message_id');
    expect(matchGmailAttachment([document({ gmailMessageId: 'other' })], message(), attachment(), 'hash-001').kind).toBe('hash');
    expect(matchGmailAttachment([document({ gmailMessageId: 'other', sha256: 'other-hash' })], message(), attachment(), 'hash-001').kind).toBe('missing');
  });

  it('does not select an ambiguous match', () => {
    const result = matchGmailAttachment([document({ id: 'a' }), document({ id: 'b' })], message(), attachment(), 'hash-001');
    expect(result.kind).toBe('ambiguous');
    expect(result.document).toBeNull();
  });

  it('only fills missing sender, canonical message ID and weaker timestamps', () => {
    const plan = planMetadataReconciliation(document(), message());
    expect(plan).toMatchObject({
      senderEmail: 'fornecedor@empresa.com', emailMessageId: 'msg-001',
      emailReceivedAt: '2026-06-19T03:00:00.000Z', emailReceivedAtSource: 'gmail_internal_date',
    });
    const complete = document({
      senderEmail: 'existente@empresa.com', emailMessageId: 'msg-001', emailReceivedAt: '2026-06-19T03:00:00.000Z',
      emailReceivedAtSource: 'gmail_internal_date',
    });
    expect(planMetadataReconciliation(complete, message())).toEqual({});
  });

  it('reports test candidates without changing status or pedido', () => {
    const candidate = classifyTestCandidate(document({ filename: 'TESTE-G25-B1-20260710-1536.pdf' }), message());
    expect(candidate).toMatchObject({ knownE2e: true, status: 'accepted', pedidoManual: 'PED-25-2026' });
  });

  it('dry-run has zero writes and reports the safe metadata plan', async () => {
    let remoteWrites = 0;
    const deps: ReconcileDeps = {
      fetchMessages: async () => [message()],
      listAttachments: async () => [attachment()],
      downloadAttachment: async () => Buffer.from('hash me'),
      loadLocalDocuments: () => [document({ sha256: 'eb201af5a0d6b0787e8c9f0991d4a2f6d0e4c7ca0a0e4e8b87e9dd1d6896b28d' })],
      loadRemoteDocuments: async () => [{
        documentId: 'doc-001', senderEmail: null, emailMessageId: null, emailReceivedAt: null,
        emailReceivedAtSource: null, emailReceivedAtEstimated: false, status: 'accepted', pedidoId: null,
      }],
      updateRemoteMetadata: async () => { remoteWrites++; },
      now: () => new Date('2026-07-10T20:00:00.000Z'),
    };
    // Use the actual SHA-256 of this deterministic buffer.
    const crypto = await import('node:crypto');
    const actualHash = crypto.createHash('sha256').update('hash me').digest('hex');
    deps.loadLocalDocuments = () => [document({ sha256: actualHash })];
    const report = await reconcileGmailDocuments({ since: '2026-06-19', dryRun: true }, deps);
    expect(report.wouldUpdateSqlite).toBe(1);
    expect(report.wouldUpdateSupabase).toBe(1);
    expect(report.localWrites).toBe(0);
    expect(report.supabaseWrites).toBe(0);
    expect(remoteWrites).toBe(0);
    expect(report.protectedFieldChanges).toBe(0);
  });

  it('counts missing attachments as candidates only and never creates them in dry-run', async () => {
    const deps: ReconcileDeps = {
      fetchMessages: async () => [message()], listAttachments: async () => [attachment()],
      downloadAttachment: async () => Buffer.from('unmatched'), loadLocalDocuments: () => [],
      loadRemoteDocuments: async () => [], now: () => new Date('2026-07-10T20:00:00.000Z'),
    };
    const report = await reconcileGmailDocuments({ since: '2026-06-19', dryRun: true }, deps);
    expect(report.missingDocumentCandidates).toBe(1);
    expect(report.wouldCreateDocuments).toBe(1);
    expect(report.localWrites).toBe(0);
  });
});
