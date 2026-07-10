import { createHash } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { getDb } from '../storage/sqlite.js';
import {
  fetchEmailsByQuery,
  listAttachments,
  downloadAttachment,
  isAttachmentCandidate,
  type GmailAttachmentRef,
  type GmailMessageMeta,
} from '../connectors/gmail.js';
import { loadServiceRoleConfig } from '../supabase/serviceRoleClient.js';
import { createScan } from './realScan.js';
import { uploadDocument } from '../connectors/drive.js';

export type ReceivedAtSource = 'gmail_internal_date' | 'header_date' | null;
export type MatchKind = 'canonical_message_id' | 'legacy_message_id' | 'hash' | 'drive_id' | 'ambiguous' | 'missing';

export interface ReconcileOptions {
  since: string;
  dryRun?: boolean;
  confirmRealGoogle?: boolean;
  confirmLocalWrite?: boolean;
  confirmSupabaseWrite?: boolean;
}

export interface ReconcileLocalDocument {
  id: string;
  gmailMessageId: string | null;
  emailMessageId: string | null;
  attachmentId: string | null;
  sha256: string | null;
  filename: string;
  senderEmail: string | null;
  emailReceivedAt: string | null;
  emailReceivedAtSource: ReceivedAtSource;
  emailReceivedAtEstimated: boolean;
  driveFileId: string | null;
  status: string;
  pedidoManual: string | null;
  createdAt: string;
}

export interface ReconcileRemoteDocument {
  documentId: string;
  senderEmail: string | null;
  emailMessageId: string | null;
  emailReceivedAt: string | null;
  emailReceivedAtSource: ReceivedAtSource;
  emailReceivedAtEstimated: boolean;
  status: string | null;
  pedidoId: string | null;
}

export interface AttachmentMatch {
  kind: MatchKind;
  document: ReconcileLocalDocument | null;
  candidates: ReconcileLocalDocument[];
}

export interface MetadataPlan {
  senderEmail?: string;
  emailMessageId?: string;
  emailReceivedAt?: string;
  emailReceivedAtSource?: Exclude<ReceivedAtSource, null>;
  emailReceivedAtEstimated?: boolean;
}

export interface TestCandidate {
  documentId: string;
  filename: string;
  gmailMessageId: string;
  reason: string;
  status: string;
  pedidoManual: string | null;
  knownE2e: boolean;
}

export interface ReconciliationReport {
  windowStart: string;
  windowEnd: string;
  gmailQuery: string;
  gmailMessagesScanned: number;
  gmailMessagesInWindow: number;
  attachmentsFound: number;
  pdfXmlCandidates: number;
  existingMatched: number;
  matchedByCanonicalMessageId: number;
  matchedByLegacyMessageId: number;
  matchedByHash: number;
  matchedByDriveId: number;
  ambiguousMatches: number;
  missingDocumentCandidates: number;
  wouldCreateDocuments: number;
  missingSenderEmail: number;
  wouldFillSenderEmail: number;
  missingEmailReceivedAt: number;
  wouldFillEmailReceivedAt: number;
  missingCanonicalEmailMessageId: number;
  wouldFillEmailMessageId: number;
  alreadyComplete: number;
  messageNotFound: number;
  invalidFrom: number;
  invalidDate: number;
  testCandidates: TestCandidate[];
  wouldUpdateSqlite: number;
  wouldUpdateSupabase: number;
  localWrites: number;
  supabaseWrites: number;
  localDocumentsBefore: number;
  supabaseDocumentsBefore: number;
  protectedFieldChanges: number;
  errors: string[];
}

export interface ReconcileDeps {
  fetchMessages(query: string): Promise<GmailMessageMeta[]>;
  listAttachments(messageId: string): Promise<GmailAttachmentRef[]>;
  downloadAttachment(messageId: string, attachmentId: string): Promise<Buffer | null>;
  loadLocalDocuments(): ReconcileLocalDocument[];
  loadRemoteDocuments(documentIds: string[]): Promise<ReconcileRemoteDocument[]>;
  updateRemoteMetadata?(documentId: string, plan: MetadataPlan): Promise<void>;
  syncNewDocuments?(documentIds: string[]): Promise<number>;
  now(): Date;
}

const TEST_PATTERN = /\b(teste|test|dummy|sample)\b/i;
const KNOWN_TEST_FILENAMES = new Set([
  'teste-g25-b1-20260710-1536.pdf',
  'teste-nfe-entrada.xml',
]);

function parseSinceToUtc(since: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(since)) {
    throw new Error('reconcile_since_must_be_yyyy_mm_dd');
  }
  // America/Sao_Paulo is UTC-03:00 for the configured 2026 cutoff.
  const value = new Date(`${since}T03:00:00.000Z`);
  if (Number.isNaN(value.getTime())) throw new Error('reconcile_since_invalid');
  return value;
}

export function buildReconciliationGmailQuery(since: string): string {
  const cutoff = parseSinceToUtc(since);
  const dayBefore = new Date(cutoff.getTime() - 24 * 60 * 60 * 1000);
  const y = dayBefore.getUTCFullYear();
  const m = String(dayBefore.getUTCMonth() + 1).padStart(2, '0');
  const d = String(dayBefore.getUTCDate()).padStart(2, '0');
  return `after:${y}/${m}/${d} has:attachment (filename:pdf OR filename:xml)`;
}

export function isMessageInWindow(message: GmailMessageMeta, cutoff: Date): boolean {
  if (!message.emailReceivedAt) return false;
  const received = new Date(message.emailReceivedAt);
  return !Number.isNaN(received.getTime()) && received.getTime() >= cutoff.getTime();
}

function uniqueDocuments(documents: ReconcileLocalDocument[]): ReconcileLocalDocument[] {
  return [...new Map(documents.map((document) => [document.id, document])).values()];
}

function selectMatch(kind: MatchKind, candidates: ReconcileLocalDocument[]): AttachmentMatch | null {
  const unique = uniqueDocuments(candidates);
  if (unique.length === 0) return null;
  if (unique.length === 1) return { kind, document: unique[0], candidates: unique };
  return { kind: 'ambiguous', document: null, candidates: unique };
}

export function matchGmailAttachment(
  documents: ReconcileLocalDocument[],
  message: GmailMessageMeta,
  attachment: GmailAttachmentRef,
  sha256: string,
): AttachmentMatch {
  const canonicalByHash = selectMatch('canonical_message_id', documents.filter((document) =>
    document.emailMessageId === message.gmailMessageId && document.sha256 === sha256));
  if (canonicalByHash) return canonicalByHash;

  const legacyByHash = selectMatch('legacy_message_id', documents.filter((document) =>
    document.gmailMessageId === message.gmailMessageId && document.sha256 === sha256));
  if (legacyByHash) return legacyByHash;

  const canonicalByAttachment = selectMatch('canonical_message_id', documents.filter((document) =>
    document.emailMessageId === message.gmailMessageId && document.attachmentId === attachment.attachmentId));
  if (canonicalByAttachment) return canonicalByAttachment;

  const legacyByAttachment = selectMatch('legacy_message_id', documents.filter((document) =>
    document.gmailMessageId === message.gmailMessageId && document.attachmentId === attachment.attachmentId));
  if (legacyByAttachment) return legacyByAttachment;

  const byHash = selectMatch('hash', documents.filter((document) => document.sha256 === sha256));
  if (byHash) return byHash;

  return { kind: 'missing', document: null, candidates: [] };
}

function timestampQuality(source: ReceivedAtSource): number {
  if (source === 'gmail_internal_date') return 2;
  if (source === 'header_date') return 1;
  return 0;
}

export function planMetadataReconciliation(
  document: ReconcileLocalDocument,
  message: GmailMessageMeta,
): MetadataPlan {
  const plan: MetadataPlan = {};
  if (!document.senderEmail && message.senderEmail) plan.senderEmail = message.senderEmail;
  if (!document.emailMessageId && message.gmailMessageId) plan.emailMessageId = message.gmailMessageId;

  const incomingQuality = timestampQuality(message.emailReceivedAtSource);
  const existingQuality = timestampQuality(document.emailReceivedAtSource);
  if (message.emailReceivedAt && incomingQuality > existingQuality) {
    plan.emailReceivedAt = message.emailReceivedAt;
    plan.emailReceivedAtSource = message.emailReceivedAtSource!;
    plan.emailReceivedAtEstimated = message.emailReceivedAtEstimated;
  }
  return plan;
}

export function classifyTestCandidate(
  document: ReconcileLocalDocument,
  message: GmailMessageMeta,
): TestCandidate | null {
  const normalizedName = document.filename.toLowerCase();
  const knownE2e = KNOWN_TEST_FILENAMES.has(normalizedName);
  const byFilename = TEST_PATTERN.test(document.filename);
  const bySubject = TEST_PATTERN.test(message.subject);
  if (!knownE2e && !byFilename && !bySubject) return null;
  const reason = knownE2e ? 'known_e2e_filename' : byFilename ? 'filename_signal' : 'subject_signal';
  return {
    documentId: document.id,
    filename: document.filename,
    gmailMessageId: message.gmailMessageId,
    reason,
    status: document.status,
    pedidoManual: document.pedidoManual,
    knownE2e,
  };
}

function hasMetadataPlan(plan: MetadataPlan): boolean {
  return Object.keys(plan).length > 0;
}

function emptyReport(cutoff: Date, now: Date, query: string, localDocumentsBefore: number, supabaseDocumentsBefore: number): ReconciliationReport {
  return {
    windowStart: cutoff.toISOString(), windowEnd: now.toISOString(), gmailQuery: query,
    gmailMessagesScanned: 0, gmailMessagesInWindow: 0, attachmentsFound: 0, pdfXmlCandidates: 0,
    existingMatched: 0, matchedByCanonicalMessageId: 0, matchedByLegacyMessageId: 0, matchedByHash: 0, matchedByDriveId: 0,
    ambiguousMatches: 0, missingDocumentCandidates: 0, wouldCreateDocuments: 0,
    missingSenderEmail: 0, wouldFillSenderEmail: 0, missingEmailReceivedAt: 0, wouldFillEmailReceivedAt: 0,
    missingCanonicalEmailMessageId: 0, wouldFillEmailMessageId: 0, alreadyComplete: 0,
    messageNotFound: 0, invalidFrom: 0, invalidDate: 0, testCandidates: [],
    wouldUpdateSqlite: 0, wouldUpdateSupabase: 0, localWrites: 0, supabaseWrites: 0,
    localDocumentsBefore, supabaseDocumentsBefore, protectedFieldChanges: 0, errors: [],
  };
}

function loadLocalDocumentsFromDb(): ReconcileLocalDocument[] {
  const db = getDb();
  return db.prepare(`
    SELECT id, gmail_message_id, email_message_id, attachment_id, sha256, filename_original,
           sender_email, email_received_at, email_received_at_source, email_received_at_estimated,
           drive_file_id, status, pedido_manual, created_at
      FROM documentos
  `).all().map((row: any) => ({
    id: row.id, gmailMessageId: row.gmail_message_id ?? null, emailMessageId: row.email_message_id ?? null,
    attachmentId: row.attachment_id ?? null, sha256: row.sha256 ?? null, filename: row.filename_original,
    senderEmail: row.sender_email ?? null, emailReceivedAt: row.email_received_at ?? null,
    emailReceivedAtSource: row.email_received_at_source ?? null,
    emailReceivedAtEstimated: Boolean(row.email_received_at_estimated), driveFileId: row.drive_file_id ?? null,
    status: row.status, pedidoManual: row.pedido_manual ?? null, createdAt: row.created_at,
  }));
}

function createDefaultDeps(): ReconcileDeps {
  const service = loadServiceRoleConfig();
  const supabase = createClient(service.url, service.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return {
    fetchMessages: (query) => fetchEmailsByQuery(query),
    listAttachments: (messageId) => listAttachments(messageId),
    downloadAttachment: (messageId, attachmentId) => downloadAttachment(messageId, attachmentId),
    loadLocalDocuments: loadLocalDocumentsFromDb,
    async loadRemoteDocuments(documentIds) {
      if (documentIds.length === 0) return [];
      const { data, error } = await supabase.from('document_candidates')
        .select('document_id,sender_email,email_message_id,email_received_at,email_received_at_source,email_received_at_estimated,status,pedido_id')
        .in('document_id', documentIds);
      if (error) throw new Error(`reconcile_supabase_read_failed: ${error.message}`);
      return (data ?? []).map((row: any) => ({
        documentId: row.document_id, senderEmail: row.sender_email ?? null, emailMessageId: row.email_message_id ?? null,
        emailReceivedAt: row.email_received_at ?? null, emailReceivedAtSource: row.email_received_at_source ?? null,
        emailReceivedAtEstimated: Boolean(row.email_received_at_estimated), status: row.status ?? null, pedidoId: row.pedido_id ?? null,
      }));
    },
    async updateRemoteMetadata(documentId, plan) {
      const update: Record<string, unknown> = { atualizado_em: new Date().toISOString() };
      if (plan.senderEmail) update.sender_email = plan.senderEmail;
      if (plan.emailMessageId) update.email_message_id = plan.emailMessageId;
      if (plan.emailReceivedAt) {
        update.email_received_at = plan.emailReceivedAt;
        update.email_received_at_source = plan.emailReceivedAtSource;
        update.email_received_at_estimated = plan.emailReceivedAtEstimated ?? false;
      }
      const { error } = await supabase.from('document_candidates').update(update).eq('document_id', documentId);
      if (error) throw new Error(`reconcile_supabase_write_failed: ${error.message}`);
    },
    async syncNewDocuments(documentIds) {
      if (documentIds.length === 0) return 0;
      const db = getDb();
      const rows = db.prepare(`
        SELECT d.*,
          (SELECT e.id FROM ingestion_events e WHERE e.document_id = d.id ORDER BY e.created_at DESC, e.id DESC LIMIT 1) AS latest_event_id,
          (SELECT e.created_at FROM ingestion_events e WHERE e.document_id = d.id ORDER BY e.created_at DESC, e.id DESC LIMIT 1) AS latest_event_at,
          (SELECT e.reason FROM ingestion_events e WHERE e.document_id = d.id AND e.event_type = 'document.rejected' ORDER BY e.created_at DESC, e.id DESC LIMIT 1) AS latest_rejected_reason
        FROM documentos d WHERE d.id IN (${documentIds.map(() => '?').join(',')})
      `).all(...documentIds) as any[];
      let writes = 0;
      for (const row of rows) {
        if (!row.latest_event_id || !row.latest_event_at) throw new Error(`reconcile_missing_canonical_event:${row.id}`);
        const candidate = {
          document_id: row.id, gmail_message_id: row.gmail_message_id ?? null, attachment_id: row.attachment_id ?? null,
          sha256: row.sha256 ?? null, filename_original: row.filename_original ?? null, tipo_documento: row.tipo_documento ?? null,
          formato: row.formato ?? null, direcao_nf: row.direcao_nf ?? null, drive_file_id: row.drive_file_id ?? null,
          drive_web_view_link: row.drive_web_view_link ?? null, status: row.status, pedido_manual: row.pedido_manual ?? null,
          pedido_id: null, fornecedor_id: null, schema_version: 1,
          raw_payload: {
            document_id: row.id, gmail_message_id: row.gmail_message_id ?? null, attachment_id: row.attachment_id ?? null,
            sha256: row.sha256 ?? null, filename_original: row.filename_original ?? null, sender_email: row.sender_email ?? null,
            email_message_id: row.email_message_id ?? null, email_received_at: row.email_received_at ?? null,
            email_received_at_source: row.email_received_at_source ?? null,
          },
          sender_email: row.sender_email ?? null, email_message_id: row.email_message_id ?? null,
          email_received_at: row.email_received_at ?? null, email_received_at_source: row.email_received_at_source ?? null,
          email_received_at_estimated: Boolean(row.email_received_at_estimated), received_at: null,
          detected_at: row.created_at ?? null, linked_at: null, accepted_at: null, rejected_at: null,
          rejected_reason: row.status === 'rejected' ? row.latest_rejected_reason ?? null : null,
          atualizado_em: new Date().toISOString(),
        };
        const { data, error } = await supabase.rpc('upsert_document_candidate_ingestor_state', {
          p_candidate: candidate,
          p_ingestor_status: row.status,
          p_ingestor_state_at: new Date(String(row.latest_event_at).replace(' ', 'T') + (String(row.latest_event_at).endsWith('Z') ? '' : 'Z')).toISOString(),
          p_ingestor_event_id: row.latest_event_id,
          p_ingestor_rejected_reason: row.status === 'rejected' ? row.latest_rejected_reason ?? null : null,
        });
        if (error || !data || typeof data !== 'object' || (data as any).ok !== true) {
          throw new Error(`reconcile_supabase_new_document_failed:${error?.message ?? (data as any)?.error ?? row.id}`);
        }
        writes++;
      }
      return writes;
    },
    now: () => new Date(),
  };
}

function applyLocalPlans(plans: Array<{ document: ReconcileLocalDocument; plan: MetadataPlan }>): number {
  if (plans.length === 0) return 0;
  const db = getDb();
  const update = db.prepare(`
    UPDATE documentos
       SET sender_email = COALESCE(sender_email, @sender_email),
           email_message_id = COALESCE(email_message_id, @email_message_id),
           email_received_at = CASE WHEN @email_received_at IS NOT NULL THEN @email_received_at ELSE email_received_at END,
           email_received_at_source = CASE WHEN @email_received_at_source IS NOT NULL THEN @email_received_at_source ELSE email_received_at_source END,
           email_received_at_estimated = CASE WHEN @email_received_at IS NOT NULL THEN @email_received_at_estimated ELSE email_received_at_estimated END,
           updated_at = datetime('now')
     WHERE id = @id
  `);
  const transaction = db.transaction(() => {
    for (const { document, plan } of plans) {
      update.run({
        id: document.id,
        sender_email: plan.senderEmail ?? null,
        email_message_id: plan.emailMessageId ?? null,
        email_received_at: plan.emailReceivedAt ?? null,
        email_received_at_source: plan.emailReceivedAtSource ?? null,
        email_received_at_estimated: plan.emailReceivedAtEstimated ? 1 : 0,
      });
    }
  });
  transaction();
  return plans.length;
}

async function ingestMissingDocumentsCanonically(
  messageIds: string[],
  messages: Map<string, GmailMessageMeta>,
  attachments: Map<string, GmailAttachmentRef[]>,
  buffers: Map<string, Buffer>,
): Promise<number> {
  if (messageIds.length === 0) return 0;
  const before = new Set(loadLocalDocumentsFromDb().map((document) => document.id));
  const scan = createScan({
    fetchEmails: async () => [],
    fetchMessageById: async (messageId) => messages.get(messageId) ?? null,
    listAtts: async (messageId) => attachments.get(messageId) ?? [],
    downloadAtt: async (messageId, attachmentId) => buffers.get(`${messageId}:${attachmentId}`) ?? null,
    uploadDoc: async (params) => {
      const result = await uploadDocument(params);
      return { file: result.file };
    },
  });
  for (const messageId of messageIds) {
    await scan({ confirmReal: true, retryMessageId: messageId, maxAttachments: 200 });
  }
  return loadLocalDocumentsFromDb().filter((document) => !before.has(document.id)).length;
}

export async function reconcileGmailDocuments(
  options: ReconcileOptions,
  suppliedDeps?: ReconcileDeps,
): Promise<ReconciliationReport> {
  const deps = suppliedDeps ?? createDefaultDeps();
  const cutoff = parseSinceToUtc(options.since);
  const now = deps.now();
  const query = buildReconciliationGmailQuery(options.since);
  const localDocuments = deps.loadLocalDocuments();
  const remoteDocuments = await deps.loadRemoteDocuments(localDocuments.map((document) => document.id));
  const remoteByDocumentId = new Map(remoteDocuments.map((document) => [document.documentId, document]));
  const report = emptyReport(cutoff, now, query, localDocuments.length, remoteDocuments.length);
  const localPlans = new Map<string, { document: ReconcileLocalDocument; plan: MetadataPlan }>();
  const remotePlans = new Map<string, MetadataPlan>();
  const testCandidates = new Map<string, TestCandidate>();
  const attachmentHashes = new Map<string, string>();
  const messageCache = new Map<string, GmailMessageMeta>();
  const attachmentCache = new Map<string, GmailAttachmentRef[]>();
  const attachmentBuffers = new Map<string, Buffer>();
  const missingMessageIds = new Set<string>();
  const messages = await deps.fetchMessages(query);
  report.gmailMessagesScanned = messages.length;

  for (const message of messages) {
    if (!message.emailReceivedAt) {
      report.invalidDate++;
      continue;
    }
    if (!isMessageInWindow(message, cutoff)) continue;
    report.gmailMessagesInWindow++;
    messageCache.set(message.gmailMessageId, message);
    if (!message.senderEmail) report.invalidFrom++;

    const attachments = await deps.listAttachments(message.gmailMessageId);
    attachmentCache.set(message.gmailMessageId, attachments);
    report.attachmentsFound += attachments.length;
    for (const attachment of attachments) {
      if (!isAttachmentCandidate(attachment.filename, attachment.mimeType)) continue;
      report.pdfXmlCandidates++;
      const cacheKey = `${message.gmailMessageId}:${attachment.attachmentId}`;
      let sha256 = attachmentHashes.get(cacheKey);
      if (!sha256) {
        const data = await deps.downloadAttachment(message.gmailMessageId, attachment.attachmentId);
        if (!data) {
          report.messageNotFound++;
          continue;
        }
        sha256 = createHash('sha256').update(data).digest('hex');
        attachmentHashes.set(cacheKey, sha256);
        attachmentBuffers.set(cacheKey, data);
      }

      const match = matchGmailAttachment(localDocuments, message, attachment, sha256);
      if (match.kind === 'missing') {
        report.missingDocumentCandidates++;
        report.wouldCreateDocuments++;
        missingMessageIds.add(message.gmailMessageId);
        continue;
      }
      if (match.kind === 'ambiguous') {
        report.ambiguousMatches++;
        continue;
      }
      const document = match.document!;
      report.existingMatched++;
      if (match.kind === 'canonical_message_id') report.matchedByCanonicalMessageId++;
      if (match.kind === 'legacy_message_id') report.matchedByLegacyMessageId++;
      if (match.kind === 'hash') report.matchedByHash++;
      if (match.kind === 'drive_id') report.matchedByDriveId++;

      const testCandidate = classifyTestCandidate(document, message);
      if (testCandidate) testCandidates.set(document.id, testCandidate);
      if (!document.senderEmail) report.missingSenderEmail++;
      if (!document.emailReceivedAt) report.missingEmailReceivedAt++;
      if (!document.emailMessageId) report.missingCanonicalEmailMessageId++;

      const plan = planMetadataReconciliation(document, message);
      if (!hasMetadataPlan(plan)) {
        report.alreadyComplete++;
        continue;
      }
      if (plan.senderEmail) report.wouldFillSenderEmail++;
      if (plan.emailReceivedAt) report.wouldFillEmailReceivedAt++;
      if (plan.emailMessageId) report.wouldFillEmailMessageId++;
      localPlans.set(document.id, { document, plan });

      const remote = remoteByDocumentId.get(document.id);
      if (remote) {
        const remotePlan: MetadataPlan = {};
        if (!remote.senderEmail && (plan.senderEmail || document.senderEmail)) remotePlan.senderEmail = plan.senderEmail ?? document.senderEmail!;
        if (!remote.emailMessageId && (plan.emailMessageId || document.emailMessageId)) remotePlan.emailMessageId = plan.emailMessageId ?? document.emailMessageId!;
        const remoteQuality = timestampQuality(remote.emailReceivedAtSource);
        const localQuality = timestampQuality(plan.emailReceivedAtSource ?? document.emailReceivedAtSource);
        if ((plan.emailReceivedAt ?? document.emailReceivedAt) && localQuality > remoteQuality) {
          remotePlan.emailReceivedAt = plan.emailReceivedAt ?? document.emailReceivedAt!;
          remotePlan.emailReceivedAtSource = plan.emailReceivedAtSource ?? document.emailReceivedAtSource!;
          remotePlan.emailReceivedAtEstimated = plan.emailReceivedAtEstimated ?? document.emailReceivedAtEstimated;
        }
        if (hasMetadataPlan(remotePlan)) remotePlans.set(document.id, remotePlan);
      }
    }
  }

  report.testCandidates = [...testCandidates.values()];
  report.wouldUpdateSqlite = localPlans.size;
  report.wouldUpdateSupabase = remotePlans.size;

  const writeRequested = Boolean(options.confirmRealGoogle && options.confirmLocalWrite && options.confirmSupabaseWrite && !options.dryRun);
  if (!writeRequested) return report;
  if (report.ambiguousMatches > 0) throw new Error('reconcile_ambiguous_matches_block_writes');
  if (!deps.updateRemoteMetadata) throw new Error('reconcile_remote_writer_unavailable');

  for (const [documentId, plan] of remotePlans) {
    await deps.updateRemoteMetadata(documentId, plan);
    report.supabaseWrites++;
  }
  report.localWrites = applyLocalPlans([...localPlans.values()]);
  const newDocuments = suppliedDeps
    ? (report.wouldCreateDocuments > 0 ? (() => { throw new Error('reconcile_missing_documents_require_canonical_pipeline'); })() : 0)
    : await ingestMissingDocumentsCanonically([...missingMessageIds], messageCache, attachmentCache, attachmentBuffers);
  if (newDocuments > 0) {
    if (!deps.syncNewDocuments) throw new Error('reconcile_new_document_sync_unavailable');
    report.supabaseWrites += await deps.syncNewDocuments(
      loadLocalDocumentsFromDb().filter((document) => !localDocuments.some((before) => before.id === document.id)).map((document) => document.id),
    );
    report.localWrites += newDocuments;
  }
  return report;
}
