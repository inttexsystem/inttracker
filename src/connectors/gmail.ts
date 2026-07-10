import { google, gmail_v1 } from 'googleapis';
import type { OAuth2Client } from 'google-auth-library';
import { getAuthenticatedClient, assertSafeScopes, loadOAuthConfig } from './oauth.js';
import { config } from '../config.js';

export interface GmailAuthResult {
  authenticated: boolean;
  message: string;
  scopes?: string[];
}

export interface GmailMessageMeta {
  gmailMessageId: string;
  threadId: string;
  from: string;
  senderEmail?: string | null;
  subject: string;
  date: string;
  emailReceivedAt: string | null;
  emailReceivedAtSource: 'gmail_internal_date' | 'header_date' | null;
  emailReceivedAtEstimated: boolean;
  attachmentCount: number;
}

export function normalizeSenderEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  const match = trimmed.match(/(?:<\s*)?([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})(?:\s*>)?$/i);
  if (!match) return null;
  const email = match[1].toLowerCase();
  return /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(email) ? email : null;
}

export interface NormalizedEmailReceivedAt {
  emailReceivedAt: string | null;
  emailReceivedAtSource: 'gmail_internal_date' | 'header_date' | null;
  emailReceivedAtEstimated: boolean;
}

/**
 * Normalizes Gmail's authoritative internalDate (epoch milliseconds) to UTC.
 * The Date header is deliberately only a marked fallback; ingestion time is
 * never used as a substitute for the email's received time.
 */
export function normalizeEmailReceivedAt(internalDate: unknown, headerDate: unknown): NormalizedEmailReceivedAt {
  const internalMs = typeof internalDate === 'string' && /^\d+$/.test(internalDate.trim())
    ? Number(internalDate)
    : typeof internalDate === 'number' ? internalDate : NaN;
  if (Number.isFinite(internalMs) && internalMs >= 0) {
    const date = new Date(internalMs);
    if (!Number.isNaN(date.getTime())) {
      return {
        emailReceivedAt: date.toISOString(),
        emailReceivedAtSource: 'gmail_internal_date',
        emailReceivedAtEstimated: false,
      };
    }
  }

  if (typeof headerDate === 'string' && headerDate.trim()) {
    const date = new Date(headerDate.trim());
    if (!Number.isNaN(date.getTime())) {
      return {
        emailReceivedAt: date.toISOString(),
        emailReceivedAtSource: 'header_date',
        emailReceivedAtEstimated: true,
      };
    }
  }

  return { emailReceivedAt: null, emailReceivedAtSource: null, emailReceivedAtEstimated: false };
}

export interface GmailAttachmentRef {
  gmailMessageId: string;
  threadId: string;
  attachmentId: string;
  filename: string;
  mimeType: string;
  size: number;
}

export interface RawAttachment {
  gmailMessageId: string;
  threadId: string;
  attachmentId: string;
  filename: string;
  mimeType: string;
  data: Buffer;
}

const PDF_XML_MIMES = new Set([
  'application/pdf',
  'application/xml',
  'text/xml',
]);

const PDF_XML_EXT = ['.pdf', '.xml'];

export function isAttachmentCandidate(filename: string, mimeType: string): boolean {
  const lower = filename.toLowerCase();
  if (PDF_XML_MIMES.has(mimeType)) return true;
  return PDF_XML_EXT.some(ext => lower.endsWith(ext));
}

export async function authenticateGmail(): Promise<GmailAuthResult> {
  const cfg = loadOAuthConfig();
  if (!cfg.clientId || !cfg.clientSecret) {
    return {
      authenticated: false,
      message: 'GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set in .env',
    };
  }
  assertSafeScopes(cfg);
  const client = await getAuthenticatedClient(cfg);
  if (!client) {
    return {
      authenticated: false,
      message: 'No saved token. Run OAuth flow first (not implemented in this phase).',
      scopes: cfg.scopes,
    };
  }
  return {
    authenticated: true,
    message: 'Authenticated with saved token.',
    scopes: cfg.scopes,
  };
}

function buildGmailClient(auth: OAuth2Client): gmail_v1.Gmail {
  return google.gmail({ version: 'v1', auth });
}

export function buildQuery(daysBack: number, extraQuery?: string): string {
  const sinceDate = new Date();
  sinceDate.setDate(sinceDate.getDate() - daysBack);
  const y = sinceDate.getFullYear();
  const m = String(sinceDate.getMonth() + 1).padStart(2, '0');
  const d = String(sinceDate.getDate()).padStart(2, '0');
  const base = `has:attachment (filename:pdf OR filename:xml) after:${y}/${m}/${d}`;
  if (extraQuery && extraQuery.trim()) {
    return `${base} ${extraQuery.trim()}`;
  }
  return base;
}

export async function fetchRecentEmails(
  daysBack: number = config.scanDaysBack,
  client: gmail_v1.Gmail | null = null,
  extraQuery?: string,
): Promise<GmailMessageMeta[]> {
  const query = buildQuery(daysBack, extraQuery);
  return fetchEmailsByQuery(query, client);
}

/**
 * Lists every Gmail message matching an explicit query. This is used by
 * historical reconciliation flows that must not rely on a relative day count.
 */
export async function fetchEmailsByQuery(
  query: string,
  client: gmail_v1.Gmail | null = null,
): Promise<GmailMessageMeta[]> {
  const auth = client ? null : await getAuthenticatedClient();
  const gmail = client ?? (auth ? buildGmailClient(auth) : null);
  if (!gmail) return [];

  const messages: gmail_v1.Schema$Message[] = [];
  let pageToken: string | undefined;
  do {
    const list = await gmail.users.messages.list({
      userId: 'me',
      q: query,
      maxResults: 500,
      pageToken,
    });
    messages.push(...(list.data.messages ?? []));
    pageToken = list.data.nextPageToken ?? undefined;
  } while (pageToken);

  const metas: GmailMessageMeta[] = [];

  for (const m of messages) {
    if (!m.id) continue;
    const meta = await gmail.users.messages.get({
      userId: 'me',
      id: m.id,
      format: 'metadata',
      metadataHeaders: ['From', 'Subject', 'Date'],
    });
    const headers = meta.data.payload?.headers ?? [];
    const from = headers.find(h => h.name === 'From')?.value ?? '';
    const senderEmail = normalizeSenderEmail(from);
    const subject = headers.find(h => h.name === 'Subject')?.value ?? '';
    const date = headers.find(h => h.name === 'Date')?.value ?? '';
    const emailReceived = normalizeEmailReceivedAt(meta.data.internalDate, date);
    const attachmentCount = countAttachments(meta.data.payload);

    metas.push({
      gmailMessageId: m.id,
      threadId: m.threadId ?? '',
      from,
      senderEmail,
      subject,
      date,
      ...emailReceived,
      attachmentCount,
    });
  }

  return metas;
}

export async function fetchMessageById(
  gmailMessageId: string,
  client: gmail_v1.Gmail | null = null,
): Promise<GmailMessageMeta | null> {
  const auth = client ? null : await getAuthenticatedClient();
  const gmail = client ?? (auth ? buildGmailClient(auth) : null);
  if (!gmail) {
    return null;
  }

  const meta = await gmail.users.messages.get({
    userId: 'me',
    id: gmailMessageId,
    format: 'metadata',
    metadataHeaders: ['From', 'Subject', 'Date'],
  });
  const headers = meta.data.payload?.headers ?? [];
  const from = headers.find(h => h.name === 'From')?.value ?? '';
  const senderEmail = normalizeSenderEmail(from);
  const subject = headers.find(h => h.name === 'Subject')?.value ?? '';
  const date = headers.find(h => h.name === 'Date')?.value ?? '';
  const emailReceived = normalizeEmailReceivedAt(meta.data.internalDate, date);
  const attachmentCount = countAttachments(meta.data.payload);

  return {
    gmailMessageId: meta.data.id ?? gmailMessageId,
    threadId: meta.data.threadId ?? '',
    from,
    senderEmail,
    subject,
    date,
    ...emailReceived,
    attachmentCount,
  };
}

function countAttachments(payload: any): number {
  if (!payload) return 0;
  let count = 0;
  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.filename && part.body?.attachmentId) count++;
      count += countAttachments(part);
    }
  }
  return count;
}

export async function listAttachments(
  gmailMessageId: string,
  client: gmail_v1.Gmail | null = null,
): Promise<GmailAttachmentRef[]> {
  const auth = client ? null : await getAuthenticatedClient();
  const gmail = client ?? (auth ? buildGmailClient(auth) : null);
  if (!gmail) return [];

  const msg = await gmail.users.messages.get({
    userId: 'me',
    id: gmailMessageId,
    format: 'full',
  });
  const refs: GmailAttachmentRef[] = [];
  collectAttachments(msg.data.payload, gmailMessageId, msg.data.threadId ?? '', refs);
  return refs;
}

function collectAttachments(
  payload: any,
  gmailMessageId: string,
  threadId: string,
  out: GmailAttachmentRef[],
): void {
  if (!payload) return;
  if (payload.filename && payload.body?.attachmentId) {
    if (isAttachmentCandidate(payload.filename, payload.mimeType ?? '')) {
      out.push({
        gmailMessageId,
        threadId,
        attachmentId: payload.body.attachmentId,
        filename: payload.filename,
        mimeType: payload.mimeType ?? '',
        size: payload.body.size ?? 0,
      });
    }
  }
  if (payload.parts) {
    for (const part of payload.parts) {
      collectAttachments(part, gmailMessageId, threadId, out);
    }
  }
}

export async function downloadAttachment(
  gmailMessageId: string,
  attachmentId: string,
  client: gmail_v1.Gmail | null = null,
): Promise<Buffer | null> {
  const auth = client ? null : await getAuthenticatedClient();
  const gmail = client ?? (auth ? buildGmailClient(auth) : null);
  if (!gmail) return null;
  const res = await gmail.users.messages.attachments.get({
    userId: 'me',
    messageId: gmailMessageId,
    id: attachmentId,
  });
  const data = res.data.data;
  if (!data) return null;
  return Buffer.from(data, 'base64url');
}
