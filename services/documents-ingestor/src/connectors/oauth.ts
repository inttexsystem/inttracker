import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { config } from '../config.js';

export const DEFAULT_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/drive.file',
];

export interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[];
  tokenPath: string;
}

export function loadOAuthConfig(): OAuthConfig {
  const scopesEnv = process.env.GOOGLE_OAUTH_SCOPES;
  const scopes = scopesEnv
    ? scopesEnv.split(',').map(s => s.trim()).filter(Boolean)
    : DEFAULT_SCOPES;

  return {
    clientId: config.googleClientId,
    clientSecret: config.googleClientSecret,
    redirectUri: config.googleRedirectUri,
    scopes,
    tokenPath: config.googleTokenPath,
  };
}

export function hasDriveBroadScope(cfg: OAuthConfig): boolean {
  return cfg.scopes.includes('https://www.googleapis.com/auth/drive') &&
         !cfg.scopes.includes('https://www.googleapis.com/auth/drive.file');
}

export function isOAuthConfigured(cfg: OAuthConfig = loadOAuthConfig()): boolean {
  return Boolean(cfg.clientId && cfg.clientSecret);
}

export function buildOAuth2Client(cfg: OAuthConfig = loadOAuthConfig()): OAuth2Client {
  return new google.auth.OAuth2(cfg.clientId, cfg.clientSecret, cfg.redirectUri);
}

export function generateAuthUrl(cfg: OAuthConfig = loadOAuthConfig()): string {
  const client = buildOAuth2Client(cfg);
  return client.generateAuthUrl({
    access_type: 'offline',
    scope: cfg.scopes,
    prompt: 'consent',
  });
}

export async function exchangeCodeForToken(
  code: string,
  cfg: OAuthConfig = loadOAuthConfig(),
): Promise<any> {
  const client = buildOAuth2Client(cfg);
  const { tokens } = await client.getToken(code);
  saveToken(tokens, cfg);
  client.setCredentials(tokens);
  return tokens;
}

export function loadSavedToken(cfg: OAuthConfig = loadOAuthConfig()): any | null {
  if (!existsSync(cfg.tokenPath)) return null;
  try {
    return JSON.parse(readFileSync(cfg.tokenPath, 'utf-8'));
  } catch {
    return null;
  }
}

export function saveToken(tokens: any, cfg: OAuthConfig = loadOAuthConfig()): void {
  const dir = dirname(cfg.tokenPath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(cfg.tokenPath, JSON.stringify(tokens, null, 2), 'utf-8');
}

export async function getAuthenticatedClient(
  cfg: OAuthConfig = loadOAuthConfig(),
): Promise<OAuth2Client | null> {
  if (!isOAuthConfigured(cfg)) return null;
  const tokens = loadSavedToken(cfg);
  if (!tokens) return null;
  const client = buildOAuth2Client(cfg);
  client.setCredentials(tokens);
  return client;
}

export function assertSafeScopes(cfg: OAuthConfig = loadOAuthConfig()): void {
  if (hasDriveBroadScope(cfg)) {
    throw new Error(
      'Refusing to start: OAuth scopes include broad "drive" scope. ' +
      'Use "drive.file" (per-file access) or justify explicitly.'
    );
  }
}
