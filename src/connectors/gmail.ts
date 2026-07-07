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
  subject: string;
  date: string;
  attachmentCount: number;
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
  const auth = client ? null : await getAuthenticatedClient();
  const gmail = client ?? (auth ? buildGmailClient(auth) : null);
  if (!gmail) {
    return [];
  }

  const query = buildQuery(daysBack, extraQuery);
  const list = await gmail.users.messages.list({ userId: 'me', q: query, maxResults: 50 });
  const messages = list.data.messages ?? [];
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
    const subject = headers.find(h => h.name === 'Subject')?.value ?? '';
    const date = headers.find(h => h.name === 'Date')?.value ?? '';
    const attachmentCount = countAttachments(meta.data.payload);

    metas.push({
      gmailMessageId: m.id,
      threadId: m.threadId ?? '',
      from,
      subject,
      date,
      attachmentCount,
    });
  }

  return metas;
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
