import { config } from '../config.js';

export interface GmailAuthResult {
  authenticated: boolean;
  message: string;
}

export async function authenticateGmail(): Promise<GmailAuthResult> {
  if (!config.googleClientId || !config.googleClientSecret) {
    return {
      authenticated: false,
      message: 'GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set in .env',
    };
  }

  console.log('[gmail] Gmail connector prepared — OAuth flow not yet wired.');
  console.log('[gmail] Would authenticate with client_id=%s...', config.googleClientId.slice(0, 20));

  return {
    authenticated: false,
    message: 'OAuth flow not yet implemented in scaffold phase',
  };
}

export async function fetchRecentEmails(daysBack: number): Promise<any[]> {
  console.log('[gmail] Would fetch emails from last %d days', daysBack);
  return [];
}

export async function downloadAttachment(gmailMessageId: string, attachmentId: string): Promise<Buffer | null> {
  console.log('[gmail] Would download attachment %s from message %s', attachmentId, gmailMessageId);
  return null;
}
