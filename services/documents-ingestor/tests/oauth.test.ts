import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, rmSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  DEFAULT_SCOPES,
  hasDriveBroadScope,
  isOAuthConfigured,
  loadOAuthConfig,
  loadSavedToken,
  saveToken,
  assertSafeScopes,
} from '../src/connectors/oauth.js';

describe('OAuth config and scopes', () => {
  it('default scopes are gmail.readonly + drive.file (no broad drive)', () => {
    expect(DEFAULT_SCOPES).toContain('https://www.googleapis.com/auth/gmail.readonly');
    expect(DEFAULT_SCOPES).toContain('https://www.googleapis.com/auth/drive.file');
    expect(DEFAULT_SCOPES).not.toContain('https://www.googleapis.com/auth/drive');
  });

  it('hasDriveBroadScope detects broad drive scope', () => {
    expect(hasDriveBroadScope({ scopes: ['https://www.googleapis.com/auth/drive'] } as any)).toBe(true);
    expect(hasDriveBroadScope({ scopes: ['https://www.googleapis.com/auth/drive.file'] } as any)).toBe(false);
    expect(hasDriveBroadScope({ scopes: ['https://www.googleapis.com/auth/gmail.readonly', 'https://www.googleapis.com/auth/drive.file'] } as any)).toBe(false);
  });

  it('assertSafeScopes throws on broad drive scope', () => {
    expect(() => assertSafeScopes({ scopes: ['https://www.googleapis.com/auth/drive'] } as any)).toThrow(/broad "drive"/);
  });

  it('assertSafeScopes does NOT throw on drive.file scope', () => {
    expect(() => assertSafeScopes({ scopes: DEFAULT_SCOPES })).not.toThrow();
  });

  it('isOAuthConfigured returns false when clientId/secret are empty', () => {
    const cfg = { clientId: '', clientSecret: '', redirectUri: '', scopes: [], tokenPath: '' };
    expect(isOAuthConfigured(cfg)).toBe(false);
  });

  it('isOAuthConfigured returns true when both are set', () => {
    const cfg = { clientId: 'abc', clientSecret: 'xyz', redirectUri: '', scopes: [], tokenPath: '' };
    expect(isOAuthConfigured(cfg)).toBe(true);
  });

  it('loadOAuthConfig returns default scopes when env unset', () => {
    const cfg = loadOAuthConfig();
    expect(cfg.scopes).toEqual(DEFAULT_SCOPES);
  });

  describe('token persistence', () => {
    const tmpDir = join(tmpdir(), 'ravatex-oauth-test');
    const tokenPath = join(tmpDir, 'token.json');

    beforeEach(() => {
      if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true });
      mkdirSync(tmpDir, { recursive: true });
    });

    afterEach(() => {
      if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true });
    });

    it('saveToken writes file, loadSavedToken reads it back', () => {
      saveToken({ access_token: 'fake-token', token_type: 'Bearer' }, { tokenPath } as any);
      expect(existsSync(tokenPath)).toBe(true);
      const loaded = loadSavedToken({ tokenPath } as any);
      expect(loaded.access_token).toBe('fake-token');
    });

    it('loadSavedToken returns null when file does not exist', () => {
      expect(loadSavedToken({ tokenPath } as any)).toBeNull();
    });

    it('saveToken creates parent dir if missing', () => {
      const deepPath = join(tmpDir, 'nested', 'deep', 'token.json');
      saveToken({ access_token: 't' }, { tokenPath: deepPath } as any);
      expect(existsSync(deepPath)).toBe(true);
    });
  });
});
