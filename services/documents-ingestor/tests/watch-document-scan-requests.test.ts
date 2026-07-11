import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  runWatchDocumentScanRequests,
  _internal,
  type WatchDocumentScanRequestsDeps,
  type WatchScanCycleResult,
  type WatchEvent,
} from '../src/core/watchDocumentScanRequests.js';
import type {
  ClaimedDocumentScanRequest,
  SupabaseWriterClient,
} from '../src/supabase/serviceRoleClient.js';

class WatcherWriterClientMock implements SupabaseWriterClient {
  recoverStaleCalls: Array<{ source: string; staleAfterMinutes?: number }> = [];
  claimCalls: Array<{ source: string | null }> = [];
  startScanRunCalls: Array<{ source: string; triggered_by: string }> = [];
  markRunningCalls: Array<{ requestId: string; scanRunId: string }> = [];
  finishRunCalls: Array<{ id: string; status: 'completed' | 'failed'; documentsProcessed: number; documentsNew: number; errorMessage: string | null }> = [];
  finishRequestCalls: Array<{ requestId: string; status: 'completed' | 'failed'; errorMessage: string | null }> = [];

  // Behavior knobs
  claimQueue: Array<{ empty: boolean; request: ClaimedDocumentScanRequest | null }> = [];
  startScanRunResult: { kind: 'started'; id: string } | { kind: 'already_running' } = { kind: 'started', id: 'run-1' };
  recoverStaleResult = { recoveredCount: 0 };
  recoverStaleError: Error | null = null;
  markRunningError: Error | null = null;
  finishScanRunError: Error | null = null;
  finishRequestError: Error | null = null;
  claimError: Error | null = null;
  startScanRunError: Error | null = null;

  async recoverStaleRuns(params: { source: string; staleAfterMinutes?: number }): Promise<{ recoveredCount: number }> {
    this.recoverStaleCalls.push(params);
    if (this.recoverStaleError) throw this.recoverStaleError;
    return this.recoverStaleResult;
  }

  async upsertCanonicalCandidateState(): Promise<void> {
    throw new Error('upsertCanonicalCandidateState should not be called by the watcher directly');
  }

  async insertEventsIgnoreConflict(): Promise<{ inserted: number; skipped: number }> {
    return { inserted: 0, skipped: 0 };
  }

  async startScanRun(run: { source: string; triggered_by: string }): Promise<{ kind: 'started'; id: string } | { kind: 'already_running' }> {
    this.startScanRunCalls.push(run);
    if (this.startScanRunError) throw this.startScanRunError;
    return this.startScanRunResult;
  }

  async finishScanRun(params: { id: string; status: 'completed' | 'failed'; documentsProcessed: number; documentsNew: number; errorMessage: string | null }): Promise<void> {
    this.finishRunCalls.push(params);
    if (this.finishScanRunError) throw this.finishScanRunError;
  }

  async claimNextDocumentScanRequest(params: { source: string | null }): Promise<{ empty: boolean; request: ClaimedDocumentScanRequest | null }> {
    this.claimCalls.push(params);
    if (this.claimError) throw this.claimError;
    const next = this.claimQueue.shift();
    if (!next) return { empty: true, request: null };
    return next;
  }

  async markDocumentScanRequestRunning(params: { requestId: string; scanRunId: string }): Promise<void> {
    this.markRunningCalls.push(params);
    if (this.markRunningError) throw this.markRunningError;
  }

  async finishDocumentScanRequest(params: { requestId: string; status: 'completed' | 'failed'; errorMessage: string | null }): Promise<void> {
    this.finishRequestCalls.push(params);
    if (this.finishRequestError) throw this.finishRequestError;
  }
}

function makeDeps(overrides: Partial<WatchDocumentScanRequestsDeps> = {}): WatchDocumentScanRequestsDeps & { client: WatcherWriterClientMock } {
  const client = new WatcherWriterClientMock();
  const base: WatchDocumentScanRequestsDeps = {
    client,
    runScanCycle: async () => ({ documentsProcessed: 3, documentsNew: 2 }),
    sleep: vi.fn(async () => undefined),
  };
  const merged: any = { ...base, ...overrides };
  merged.client = client;
  return merged as WatchDocumentScanRequestsDeps & { client: WatcherWriterClientMock };
}

const confirmed = {
  confirmRealGoogle: true,
  confirmSupabaseWrite: true,
} as const;

describe('watchDocumentScanRequests (G24-B2)', () => {
  describe('queue empty / dry-run', () => {
    it('returns immediately on empty queue when --once is set and the cycle is confirmed', async () => {
      const deps = makeDeps();
      const events: WatchEvent[] = [];
      const result = await runWatchDocumentScanRequests(
        { source: 'gmail', once: true, ...confirmed },
        { ...deps, onEvent: (e) => events.push(e) },
      );

      expect(result.ok).toBe(true);
      expect(result.dry_run).toBe(false);
      expect(result.cycles).toBe(1);
      expect(result.empty_polls).toBe(1);
      expect(result.requests_processed).toBe(0);
      expect(deps.client.claimCalls).toHaveLength(1);
      expect(deps.client.claimCalls[0]).toEqual({ source: 'gmail' });
      // No run is started on empty queue.
      expect(deps.client.startScanRunCalls).toHaveLength(0);
      expect(deps.client.markRunningCalls).toHaveLength(0);
      expect(deps.client.finishRunCalls).toHaveLength(0);
      expect(deps.client.finishRequestCalls).toHaveLength(0);
      // No sleep in --once mode after empty.
      expect(deps.sleep).not.toHaveBeenCalled();
      expect(events.map((e) => e.kind)).toEqual(['cycle.empty', 'watch.done']);
      expect((events[events.length - 1] as { reason: string }).reason).toBe('once_empty');
    });

    it('dry-run never touches the client and never reports a real cycle', async () => {
      const deps = makeDeps();
      const result = await runWatchDocumentScanRequests(
        { source: 'gmail', once: true },
        deps,
      );

      expect(result.ok).toBe(true);
      expect(result.dry_run).toBe(true);
      expect(result.cycles).toBe(1);
      expect(result.empty_polls).toBe(1);
      expect(deps.client.claimCalls).toHaveLength(0);
      expect(deps.client.startScanRunCalls).toHaveLength(0);
      expect(deps.client.recoverStaleCalls).toHaveLength(0);
    });

    it('dry-run runs once and reports once_empty even without both confirmations', async () => {
      const deps = makeDeps();
      // Missing confirmRealGoogle and confirmSupabaseWrite -> dry-run.
      const result = await runWatchDocumentScanRequests(
        { source: 'gmail', once: true },
        deps,
      );
      expect(result.dry_run).toBe(true);
      expect(result.cycles).toBe(1);
    });
  });

  describe('happy path: claimed -> running -> completed', () => {
    it('claims a single request, marks it running, runs the cycle, and finishes both run and request', async () => {
      const deps = makeDeps();
      deps.client.claimQueue.push({
        empty: false,
        request: { requestId: 'req-1', source: 'gmail' },
      });
      deps.client.startScanRunResult = { kind: 'started', id: 'run-abc' };

      const events: WatchEvent[] = [];
      const result = await runWatchDocumentScanRequests(
        { source: 'gmail', once: true, ...confirmed },
        { ...deps, onEvent: (e) => events.push(e), runScanCycle: async () => ({ documentsProcessed: 7, documentsNew: 4 }) },
      );

      expect(result.ok).toBe(true);
      expect(result.requests_processed).toBe(1);
      expect(result.requests_completed).toBe(1);
      expect(result.requests_failed).toBe(0);
      expect(deps.client.claimCalls).toHaveLength(1);
      expect(deps.client.startScanRunCalls).toEqual([{ source: 'gmail', triggered_by: 'service_role_cli' }]);
      expect(deps.client.markRunningCalls).toEqual([{ requestId: 'req-1', scanRunId: 'run-abc' }]);
      expect(deps.client.finishRunCalls).toEqual([
        { id: 'run-abc', status: 'completed', documentsProcessed: 7, documentsNew: 4, errorMessage: null },
      ]);
      expect(deps.client.finishRequestCalls).toEqual([
        { requestId: 'req-1', status: 'completed', errorMessage: null },
      ]);
      // The watcher must sleep only in non-once mode after a real cycle.
      expect(deps.sleep).not.toHaveBeenCalled();
      // The event sequence must include start_run, mark_running, scan,
      // finish_run, finish_request, watch.done(once_completed).
      const kinds = events.map((e) => e.kind);
      expect(kinds).toEqual([
        'cycle.start',
        'cycle.start_run',
        'cycle.mark_running',
        'cycle.scan',
        'cycle.finish_run',
        'cycle.finish_request',
        'watch.done',
      ]);
      const scanEvent = events.find((e) => e.kind === 'cycle.scan');
      expect(scanEvent).toMatchObject({ kind: 'cycle.scan', mode: 'real', documentsProcessed: 7, documentsNew: 4 });
      const doneEvent = events[events.length - 1] as { kind: 'watch.done'; reason: string };
      expect(doneEvent.reason).toBe('once_completed');
    });

    it('associates the scan_run_id returned by startScanRun with the request', async () => {
      const deps = makeDeps();
      deps.client.claimQueue.push({ empty: false, request: { requestId: 'req-x', source: 'gmail' } });
      deps.client.startScanRunResult = { kind: 'started', id: 'run-xyz-789' };

      await runWatchDocumentScanRequests(
        { source: 'gmail', once: true, ...confirmed },
        deps,
      );

      expect(deps.client.markRunningCalls[0]).toEqual({ requestId: 'req-x', scanRunId: 'run-xyz-789' });
      expect(deps.client.finishRunCalls[0].id).toBe('run-xyz-789');
      expect(deps.client.finishRequestCalls[0].requestId).toBe('req-x');
    });

    it('second concurrent instance cannot claim the same request (queue mock never returns the same id)', async () => {
      // Simulates the FOR UPDATE SKIP LOCKED behavior: each claim call
      // sees a different row (or empty). The mock here models this by
      // serving the request on the first call and empty on the second.
      const depsA = makeDeps();
      depsA.client.claimQueue.push({ empty: false, request: { requestId: 'req-shared', source: 'gmail' } });
      depsA.client.claimQueue.push({ empty: true, request: null });

      const depsB = makeDeps();
      depsB.client.claimQueue.push({ empty: true, request: null });

      const [a, b] = await Promise.all([
        runWatchDocumentScanRequests({ source: 'gmail', once: true, ...confirmed }, depsA),
        runWatchDocumentScanRequests({ source: 'gmail', once: true, ...confirmed }, depsB),
      ]);

      expect(a.requests_completed).toBe(1);
      expect(b.requests_processed).toBe(0);
      expect(b.empty_polls).toBe(1);
      // Only A processes 'req-shared'.
      const idsA = depsA.client.markRunningCalls.map((c) => c.requestId);
      const idsB = depsB.client.markRunningCalls.map((c) => c.requestId);
      expect(idsA).toEqual(['req-shared']);
      expect(idsB).toEqual([]);
    });
  });

  describe('failure handling and sanitized errors', () => {
    it('finishes the run as failed and the request as failed when the scan cycle throws', async () => {
      const deps = makeDeps();
      deps.client.claimQueue.push({ empty: false, request: { requestId: 'req-fail', source: 'gmail' } });
      deps.client.startScanRunResult = { kind: 'started', id: 'run-fail' };

      const result = await runWatchDocumentScanRequests(
        { source: 'gmail', once: true, ...confirmed },
        {
          ...deps,
          runScanCycle: async () => { throw new Error('boom: gmail token expired with secret eyJabc.def'); },
        },
      );

      expect(result.ok).toBe(true); // ok at the watcher level; the request was finalized cleanly
      expect(result.requests_failed).toBe(1);
      expect(result.requests_completed).toBe(0);
      expect(deps.client.finishRunCalls).toEqual([
        { id: 'run-fail', status: 'failed', documentsProcessed: 0, documentsNew: 0, errorMessage: 'boom: gmail token expired with secret eyJabc.def' },
      ]);
      const finished = deps.client.finishRequestCalls[0];
      expect(finished.status).toBe('failed');
      expect(finished.errorMessage).toBe('boom: gmail token expired with secret eyJabc.def');
      // Sanity: error length is bounded.
      expect((finished.errorMessage ?? '').length).toBeLessThanOrEqual(_internal.sanitizeError('x'.repeat(5000)).length + 1);
    });

    it('finishes the run as failed and the request as failed when startScanRun throws (no run was created)', async () => {
      const deps = makeDeps();
      deps.client.claimQueue.push({ empty: false, request: { requestId: 'req-x', source: 'gmail' } });
      deps.client.startScanRunError = new Error('start_run_failed: rpc unavailable');

      const result = await runWatchDocumentScanRequests(
        { source: 'gmail', once: true, ...confirmed },
        deps,
      );

      expect(result.ok).toBe(false);
      expect(result.errors[0]).toMatch(/start_run_failed/);
      // startScanRun threw before any run row existed; the request
      // should still be finalized as failed so the queue does not stall.
      expect(deps.client.finishRunCalls).toEqual([]);
      expect(deps.client.finishRequestCalls).toEqual([
        { requestId: 'req-x', status: 'failed', errorMessage: 'start_run_failed: rpc unavailable' },
      ]);
    });

    it('finishes both run and request as failed when mark_running throws (run was created)', async () => {
      const deps = makeDeps();
      deps.client.claimQueue.push({ empty: false, request: { requestId: 'req-mr', source: 'gmail' } });
      deps.client.startScanRunResult = { kind: 'started', id: 'run-mr' };
      deps.client.markRunningError = new Error('invalid_transition');

      const result = await runWatchDocumentScanRequests(
        { source: 'gmail', once: true, ...confirmed },
        deps,
      );

      expect(result.requests_failed).toBe(1);
      expect(deps.client.finishRunCalls).toEqual([
        { id: 'run-mr', status: 'failed', documentsProcessed: 0, documentsNew: 0, errorMessage: 'invalid_transition' },
      ]);
      expect(deps.client.finishRequestCalls).toEqual([
        { requestId: 'req-mr', status: 'failed', errorMessage: 'invalid_transition' },
      ]);
    });

    it('finishes the request as failed with a sanitized message when startScanRun returns already_running', async () => {
      const deps = makeDeps();
      deps.client.claimQueue.push({ empty: false, request: { requestId: 'req-ar', source: 'gmail' } });
      deps.client.startScanRunResult = { kind: 'already_running' };

      const result = await runWatchDocumentScanRequests(
        { source: 'gmail', once: true, ...confirmed },
        deps,
      );

      expect(result.requests_failed).toBe(1);
      expect(deps.client.finishRunCalls).toEqual([]);
      expect(deps.client.finishRequestCalls).toEqual([
        { requestId: 'req-ar', status: 'failed', errorMessage: 'scan_already_running' },
      ]);
    });

    it('error messages are sanitized to 1000 chars and stripped of leading noise', () => {
      const big = 'x'.repeat(5000);
      const out = _internal.sanitizeError(new Error(big));
      expect(out.length).toBe(1000);
      expect(out.endsWith('x')).toBe(true);
    });
  });

  describe('recoverStale lifecycle', () => {
    it('runs stale recovery before the first claim when --recover-stale is set', async () => {
      const deps = makeDeps();
      deps.client.recoverStaleResult = { recoveredCount: 2 };
      deps.client.claimQueue.push({ empty: true, request: null });

      const events: WatchEvent[] = [];
      await runWatchDocumentScanRequests(
        { source: 'gmail', once: true, recoverStale: true, staleAfterMinutes: 30, ...confirmed },
        { ...deps, onEvent: (e) => events.push(e) },
      );

      expect(deps.client.recoverStaleCalls).toEqual([{ source: 'gmail', staleAfterMinutes: 30 }]);
      expect(events.find((e) => e.kind === 'cycle.recover_stale')).toMatchObject({ recoveredCount: 2 });
    });

    it('does not run stale recovery when --recover-stale is absent', async () => {
      const deps = makeDeps();
      deps.client.claimQueue.push({ empty: true, request: null });
      await runWatchDocumentScanRequests(
        { source: 'gmail', once: true, ...confirmed },
        deps,
      );
      expect(deps.client.recoverStaleCalls).toEqual([]);
    });

    it('aborts the cycle and does not start a run if recovery fails', async () => {
      const deps = makeDeps();
      deps.client.recoverStaleError = new Error('migration_40_required');

      const result = await runWatchDocumentScanRequests(
        { source: 'gmail', once: true, recoverStale: true, ...confirmed },
        deps,
      );

      expect(result.ok).toBe(false);
      expect(result.errors[0]).toMatch(/recover_stale: migration_40_required/);
      expect(deps.client.claimCalls).toEqual([]);
      expect(deps.client.startScanRunCalls).toEqual([]);
    });

    it('clamps staleAfterMinutes to the floor of 5 minutes', async () => {
      const deps = makeDeps();
      deps.client.claimQueue.push({ empty: true, request: null });
      await runWatchDocumentScanRequests(
        { source: 'gmail', once: true, recoverStale: true, staleAfterMinutes: 1, ...confirmed },
        deps,
      );
      expect(deps.client.recoverStaleCalls[0].staleAfterMinutes).toBe(5);
    });
  });

  describe('confirmation gates', () => {
    it('refuses to consume a real request without --confirm-supabase-write (dry-run)', async () => {
      const deps = makeDeps();
      deps.client.claimQueue.push({ empty: false, request: { requestId: 'req-real', source: 'gmail' } });
      const result = await runWatchDocumentScanRequests(
        { source: 'gmail', once: true, confirmRealGoogle: true, confirmSupabaseWrite: false },
        deps,
      );
      expect(result.dry_run).toBe(true);
      expect(deps.client.claimCalls).toEqual([]);
      expect(deps.client.startScanRunCalls).toEqual([]);
    });

    it('refuses to consume a real request without --confirm-real-google (dry-run)', async () => {
      const deps = makeDeps();
      deps.client.claimQueue.push({ empty: false, request: { requestId: 'req-real', source: 'gmail' } });
      const result = await runWatchDocumentScanRequests(
        { source: 'gmail', once: true, confirmRealGoogle: false, confirmSupabaseWrite: true },
        deps,
      );
      expect(result.dry_run).toBe(true);
      expect(deps.client.claimCalls).toEqual([]);
    });

    it('runScanCycle is never called in dry-run mode', async () => {
      const deps = makeDeps();
      const runScanCycle = vi.fn(async () => ({ documentsProcessed: 1, documentsNew: 1 }));
      await runWatchDocumentScanRequests(
        { source: 'gmail', once: true },
        { ...deps, runScanCycle },
      );
      expect(runScanCycle).not.toHaveBeenCalled();
    });
  });

  describe('--once lifecycle', () => {
    it('--once ends after the first empty cycle and never calls sleep', async () => {
      const deps = makeDeps();
      deps.client.claimQueue.push({ empty: true, request: null });
      const result = await runWatchDocumentScanRequests(
        { source: 'gmail', once: true, ...confirmed },
        deps,
      );
      expect(result.empty_polls).toBe(1);
      expect(deps.sleep).not.toHaveBeenCalled();
    });

    it('--once ends after one completed cycle without further claims', async () => {
      const deps = makeDeps();
      deps.client.claimQueue.push({ empty: false, request: { requestId: 'req-1', source: 'gmail' } });
      const result = await runWatchDocumentScanRequests(
        { source: 'gmail', once: true, ...confirmed },
        deps,
      );
      expect(result.requests_completed).toBe(1);
      expect(deps.client.claimCalls).toHaveLength(1);
      expect(deps.sleep).not.toHaveBeenCalled();
    });
  });

  describe('safety / write-surface', () => {
    it('does not call upsertCanonicalCandidateState, insertEventsIgnoreConflict, or any document_decisions path', async () => {
      const deps = makeDeps();
      deps.client.claimQueue.push({ empty: false, request: { requestId: 'req-s', source: 'gmail' } });
      const upsertSpy = vi.spyOn(deps.client, 'upsertCanonicalCandidateState');
      const insertSpy = vi.spyOn(deps.client, 'insertEventsIgnoreConflict');

      await runWatchDocumentScanRequests(
        { source: 'gmail', once: true, ...confirmed },
        deps,
      );

      expect(upsertSpy).not.toHaveBeenCalled();
      expect(insertSpy).not.toHaveBeenCalled();
      // The source file must not import or reference document_decisions.
      // This is verified separately in the static contract test below.
    });

    it('source file does not reference document_decisions or service_role secrets', async () => {
      const { readFileSync } = await import('node:fs');
      const { join } = await import('node:path');
      const src = readFileSync(join(process.cwd(), 'src/core/watchDocumentScanRequests.ts'), 'utf-8');
      expect(src).not.toMatch(/document_decisions/i);
      expect(src).not.toMatch(/SUPABASE_SERVICE_ROLE_KEY|eyJ[A-Za-z0-9_-]{10,}\.eyJ/);
      expect(src).not.toMatch(/gmail\s+api|drive\s+api/i);
    });
  });
});
