import { describe, it, expect } from 'vitest';
import { execSync } from 'node:child_process';
import { join } from 'node:path';
import { HERMETIC_TEST_ROOT } from './setup.js';

const CLI = join(process.cwd(), 'node_modules', '.bin', 'tsx.cmd');

function env(): NodeJS.ProcessEnv {
  return {
    ...process.env,
    DATABASE_PATH: join(HERMETIC_TEST_ROOT, 'cli-watch.db'),
    OUTBOX_PATH: join(HERMETIC_TEST_ROOT, 'cli-watch-outbox.jsonl'),
    LOCAL_CACHE_PATH: join(HERMETIC_TEST_ROOT, 'cli-watch-cache'),
    GOOGLE_TOKEN_PATH: join(HERMETIC_TEST_ROOT, 'cli-watch-token.json'),
    SUPABASE_WRITER_ENABLED: 'false',
    SUPABASE_URL: '',
    SUPABASE_SERVICE_ROLE_KEY: '',
    SUPABASE_PROJECT_REF: '',
  };
}

function run(args: string): string {
  return execSync(`"${CLI}" src/cli.ts ${args}`, {
    cwd: process.cwd(),
    env: env(),
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
  });
}

function runAllowFailure(args: string): { stdout: string; stderr: string; code: number } {
  try {
    const out = execSync(`"${CLI}" src/cli.ts ${args}`, {
      cwd: process.cwd(),
      env: env(),
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return { stdout: out, stderr: '', code: 0 };
  } catch (e: any) {
    return {
      stdout: e.stdout?.toString() ?? '',
      stderr: e.stderr?.toString() ?? '',
      code: e.status ?? 1,
    };
  }
}

describe('CLI watch:scan-requests (hermetic, dry-run only)', () => {
  it('prints the dry-run banner when called without --confirm-*', () => {
    const out = run('watch:scan-requests --source gmail');
    expect(out).toContain('DRY-RUN');
    expect(out).toContain('done');
    // No real Gmail/Supabase calls.
    expect(out).toContain('no Gmail/Drive/Supabase calls performed');
  });

  it('reports once_empty on dry-run with no requests to claim', () => {
    const out = run('watch:scan-requests --source gmail');
    expect(out).toContain('requests_processed:   0');
    expect(out).toContain('empty_polls:          1');
  });

  it('refuses to start when --source is missing', () => {
    const result = runAllowFailure('watch:scan-requests');
    expect(result.code).toBe(1);
    // commander.js rejects the missing --source option (it is required).
    expect(`${result.stdout}\n${result.stderr}`).toMatch(/--source/);
  });

  it('rejects invalid --poll-seconds', () => {
    const result = runAllowFailure('watch:scan-requests --source gmail --poll-seconds 0');
    expect(result.code).toBe(1);
    expect(`${result.stdout}\n${result.stderr}`).toMatch(/--poll-seconds must be an integer between 1 and 3600/);
  });

  it('rejects invalid --stale-after-minutes', () => {
    const result = runAllowFailure('watch:scan-requests --source gmail --recover-stale --stale-after-minutes 0');
    expect(result.code).toBe(1);
    expect(`${result.stdout}\n${result.stderr}`).toMatch(/--stale-after-minutes must be a positive integer/);
  });

  it('emits JSON output when --json is set', () => {
    const out = run('watch:scan-requests --source gmail --json');
    const parsed = JSON.parse(out);
    expect(parsed.dry_run).toBe(true);
    expect(parsed.cycles).toBe(1);
    expect(parsed.empty_polls).toBe(1);
    expect(parsed.requests_processed).toBe(0);
    expect(Array.isArray(parsed.events)).toBe(true);
    const kinds = parsed.events.map((e: { kind: string }) => e.kind);
    expect(kinds).toContain('cycle.empty');
    expect(kinds).toContain('watch.done');
  });

  it('dry-run never references service_role in the rendered output', () => {
    const out = run('watch:scan-requests --source gmail --json');
    expect(out).not.toMatch(/SUPABASE_SERVICE_ROLE_KEY|eyJ[A-Za-z0-9_-]{10,}\.eyJ/);
    expect(out).not.toMatch(/postgres:\/\//);
  });
});
