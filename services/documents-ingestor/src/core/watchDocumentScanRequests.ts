import {
  type ClaimedDocumentScanRequest,
  type SupabaseWriterClient,
} from '../supabase/serviceRoleClient.js';

export interface WatchDocumentScanRequestsOptions {
  source: string;
  confirmRealGoogle: boolean;
  confirmSupabaseWrite: boolean;
  once?: boolean;
  pollSeconds?: number;
  recoverStale?: boolean;
  staleAfterMinutes?: number;
}

export interface WatchScanCycleResult {
  documentsProcessed: number;
  documentsNew: number;
  error?: string;
}

export interface WatchDocumentScanRequestsDeps {
  client: SupabaseWriterClient;
  runScanCycle: (params: {
    request: ClaimedDocumentScanRequest;
    scanRunId: string;
    confirmReal: boolean;
  }) => Promise<WatchScanCycleResult>;
  sleep: (seconds: number) => Promise<void>;
  /**
   * Hook for tests/diagnostics. Receives a structured event for each step
   * the watcher takes. The watcher never throws on listener errors.
   */
  onEvent?: (event: WatchEvent) => void;
}

export type WatchEvent =
  | { kind: 'cycle.start'; requestId: string; source: string }
  | { kind: 'cycle.recover_stale'; recoveredCount: number }
  | { kind: 'cycle.start_run'; scanRunId: string }
  | { kind: 'cycle.mark_running'; requestId: string; scanRunId: string }
  | { kind: 'cycle.scan'; mode: 'real' | 'dry-run'; documentsProcessed: number; documentsNew: number }
  | { kind: 'cycle.sync'; eventsInserted: number; eventsSkipped: number; candidatesUpserted: number }
  | { kind: 'cycle.finish_request'; requestId: string; status: 'completed' | 'failed'; errorMessage: string | null }
  | { kind: 'cycle.finish_run'; scanRunId: string; status: 'completed' | 'failed'; errorMessage: string | null }
  | { kind: 'cycle.empty' }
  | { kind: 'cycle.idle' }
  | { kind: 'cycle.error'; requestId: string; error: string }
  | { kind: 'watch.done'; reason: 'once_empty' | 'once_completed' | 'once_failed' };

export interface WatchDocumentScanRequestsResult {
  ok: boolean;
  dry_run: boolean;
  source: string;
  cycles: number;
  requests_processed: number;
  requests_completed: number;
  requests_failed: number;
  empty_polls: number;
  errors: string[];
}

const DEFAULT_POLL_SECONDS = 30;
const MAX_ERROR_LENGTH = 1000;
const MIN_POLL_SECONDS = 1;
const MAX_POLL_SECONDS = 3600;
const DEFAULT_STALE_AFTER_MINUTES = 30;
const MIN_STALE_AFTER_MINUTES = 5;
const MAX_STALE_AFTER_MINUTES = 24 * 60;

export class WatchDocumentScanRequestsConfigError extends Error {}

function validateOptions(options: WatchDocumentScanRequestsOptions): void {
  if (!options.source || !options.source.trim()) {
    throw new WatchDocumentScanRequestsConfigError('source is required.');
  }
  if (options.once !== undefined && typeof options.once !== 'boolean') {
    throw new WatchDocumentScanRequestsConfigError('once must be a boolean.');
  }
  if (options.pollSeconds !== undefined) {
    if (!Number.isInteger(options.pollSeconds) || options.pollSeconds < MIN_POLL_SECONDS || options.pollSeconds > MAX_POLL_SECONDS) {
      throw new WatchDocumentScanRequestsConfigError(
        `pollSeconds must be an integer between ${MIN_POLL_SECONDS} and ${MAX_POLL_SECONDS}.`,
      );
    }
  }
  if (options.staleAfterMinutes !== undefined) {
    if (!Number.isInteger(options.staleAfterMinutes) || options.staleAfterMinutes < 1) {
      throw new WatchDocumentScanRequestsConfigError('staleAfterMinutes must be a positive integer (minutes).');
    }
  }
  if (options.recoverStale !== undefined && typeof options.recoverStale !== 'boolean') {
    throw new WatchDocumentScanRequestsConfigError('recoverStale must be a boolean.');
  }
}

function isFullyConfirmed(opts: WatchDocumentScanRequestsOptions): boolean {
  return Boolean(opts.confirmRealGoogle) && Boolean(opts.confirmSupabaseWrite);
}

function sanitizeError(raw: unknown): string {
  const message = raw instanceof Error ? raw.message : String(raw);
  return message.slice(0, MAX_ERROR_LENGTH);
}

function emit(onEvent: WatchDocumentScanRequestsDeps['onEvent'], event: WatchEvent): void {
  if (!onEvent) return;
  try {
    onEvent(event);
  } catch {
    // listeners are best-effort diagnostics; never break the watcher
  }
}

export function runOneWatchDocumentScanRequest(
  options: WatchDocumentScanRequestsOptions,
  deps: WatchDocumentScanRequestsDeps,
): Promise<WatchScanCycleResult> {
  // (Reserved for future use: single-request entrypoint.)
  // Today runWatchDocumentScanRequests drives everything; this thin
  // wrapper exists so the contract is discoverable from a single import.
  return deps.runScanCycle({
    request: { requestId: '__direct__', source: options.source },
    scanRunId: '__direct_run__',
    confirmReal: isFullyConfirmed(options),
  });
}

export async function runWatchDocumentScanRequests(
  options: WatchDocumentScanRequestsOptions,
  deps: WatchDocumentScanRequestsDeps,
): Promise<WatchDocumentScanRequestsResult> {
  validateOptions(options);

  const pollSeconds = options.pollSeconds ?? DEFAULT_POLL_SECONDS;
  const source = options.source.trim();
  const dryRun = !isFullyConfirmed(options);
  const staleAfterMinutes = Math.max(
    options.staleAfterMinutes ?? DEFAULT_STALE_AFTER_MINUTES,
    MIN_STALE_AFTER_MINUTES,
  );
  const recoverStale = Boolean(options.recoverStale) && !dryRun;
  const once = options.once !== false;

  const result: WatchDocumentScanRequestsResult = {
    ok: true,
    dry_run: dryRun,
    source,
    cycles: 0,
    requests_processed: 0,
    requests_completed: 0,
    requests_failed: 0,
    empty_polls: 0,
    errors: [],
  };

  if (dryRun) {
    // In dry-run we never touch the client. We only simulate one cycle
    // so the operator can see the watcher is wired up without sending
    // any real request to the queue or any real call to Gmail/Supabase.
    result.cycles = 1;
    result.empty_polls = once ? 1 : 0;
    if (once) {
      emit(deps.onEvent, { kind: 'cycle.empty' });
      emit(deps.onEvent, { kind: 'watch.done', reason: 'once_empty' });
    } else {
      emit(deps.onEvent, { kind: 'watch.done', reason: 'once_empty' });
    }
    return result;
  }

  while (true) {
    if (recoverStale) {
      try {
        const recovered = await deps.client.recoverStaleRuns({ source, staleAfterMinutes });
        emit(deps.onEvent, { kind: 'cycle.recover_stale', recoveredCount: recovered.recoveredCount });
      } catch (error) {
        // Recovery failures are propagated; the watcher must not continue
        // a real cycle with an unknown source state. Idempotent: the next
        // cycle can retry the recovery safely.
        const message = sanitizeError(error);
        result.ok = false;
        result.errors.push(`recover_stale: ${message}`);
        return result;
      }
    }

    let claimed: { empty: boolean; request: ClaimedDocumentScanRequest | null };
    try {
      claimed = await deps.client.claimNextDocumentScanRequest({ source });
    } catch (error) {
      const message = sanitizeError(error);
      result.ok = false;
      result.errors.push(`claim: ${message}`);
      return result;
    }

    result.cycles++;
    if (claimed.empty || !claimed.request) {
      result.empty_polls++;
      emit(deps.onEvent, { kind: 'cycle.empty' });
      if (once) {
        emit(deps.onEvent, { kind: 'watch.done', reason: 'once_empty' });
        return result;
      }
      await deps.sleep(pollSeconds);
      continue;
    }

    const request = claimed.request;
    emit(deps.onEvent, { kind: 'cycle.start', requestId: request.requestId, source: request.source });

    let scanRunId: string | null = null;
    let scanFailed = false;
    let sanitizedError: string | null = null;

    try {
      const started = await deps.client.startScanRun({ source: request.source, triggered_by: 'service_role_cli' });
      if (started.kind === 'already_running') {
        // Another watcher already owns a run for this source. Mark the
        // request as failed with a sanitized reason and let the next
        // cycle try again. We do NOT create a run.
        const reason = 'scan_already_running';
        sanitizedError = reason;
        scanFailed = true;
        result.errors.push(`start_run (already_running) for request=${request.requestId}: ${reason}`);
        try {
          await deps.client.finishDocumentScanRequest({
            requestId: request.requestId,
            status: 'failed',
            errorMessage: reason,
          });
          emit(deps.onEvent, { kind: 'cycle.finish_request', requestId: request.requestId, status: 'failed', errorMessage: reason });
        } catch (finishRequestError) {
          result.errors.push(`finish_request after already_running: ${sanitizeError(finishRequestError)}`);
        }
        emit(deps.onEvent, { kind: 'cycle.error', requestId: request.requestId, error: reason });
      } else {
        scanRunId = started.id;
        emit(deps.onEvent, { kind: 'cycle.start_run', scanRunId });

        let markRunningOk = true;
        try {
          await deps.client.markDocumentScanRequestRunning({
            requestId: request.requestId,
            scanRunId,
          });
          emit(deps.onEvent, { kind: 'cycle.mark_running', requestId: request.requestId, scanRunId });
        } catch (markError) {
          // If we cannot transition claimed -> running, the run is now
          // orphaned. Mark the run as failed and the request as failed.
          markRunningOk = false;
          sanitizedError = sanitizeError(markError);
          scanFailed = true;
          result.errors.push(`mark_running for request=${request.requestId}: ${sanitizedError}`);
          try {
            await deps.client.finishScanRun({
              id: scanRunId,
              status: 'failed',
              documentsProcessed: 0,
              documentsNew: 0,
              errorMessage: sanitizedError,
            });
            emit(deps.onEvent, { kind: 'cycle.finish_run', scanRunId, status: 'failed', errorMessage: sanitizedError });
          } catch (finishRunError) {
            result.errors.push(`finish_run after mark_running failure: ${sanitizeError(finishRunError)}`);
          }
          try {
            await deps.client.finishDocumentScanRequest({
              requestId: request.requestId,
              status: 'failed',
              errorMessage: sanitizedError,
            });
            emit(deps.onEvent, { kind: 'cycle.finish_request', requestId: request.requestId, status: 'failed', errorMessage: sanitizedError });
          } catch (finishRequestError) {
            result.errors.push(`finish_request after mark_running failure: ${sanitizeError(finishRequestError)}`);
          }
        }

        if (markRunningOk) {
          let cycleResult: WatchScanCycleResult;
          try {
            cycleResult = await deps.runScanCycle({
              request,
              scanRunId,
              confirmReal: isFullyConfirmed(options),
            });
          } catch (scanError) {
            sanitizedError = sanitizeError(scanError);
            scanFailed = true;
            result.errors.push(`run_scan_cycle for request=${request.requestId}: ${sanitizedError}`);
            cycleResult = { documentsProcessed: 0, documentsNew: 0, error: sanitizedError };
          }

          emit(deps.onEvent, {
            kind: 'cycle.scan',
            mode: isFullyConfirmed(options) ? 'real' : 'dry-run',
            documentsProcessed: cycleResult.documentsProcessed,
            documentsNew: cycleResult.documentsNew,
          });

          try {
            await deps.client.finishScanRun({
              id: scanRunId,
              status: scanFailed ? 'failed' : 'completed',
              documentsProcessed: cycleResult.documentsProcessed,
              documentsNew: cycleResult.documentsNew,
              errorMessage: scanFailed ? sanitizedError : null,
            });
            emit(deps.onEvent, {
              kind: 'cycle.finish_run',
              scanRunId,
              status: scanFailed ? 'failed' : 'completed',
              errorMessage: scanFailed ? sanitizedError : null,
            });
          } catch (finishRunError) {
            result.errors.push(`finish_run after scan: ${sanitizeError(finishRunError)}`);
          }

          try {
            await deps.client.finishDocumentScanRequest({
              requestId: request.requestId,
              status: scanFailed ? 'failed' : 'completed',
              errorMessage: scanFailed ? sanitizedError : null,
            });
            emit(deps.onEvent, {
              kind: 'cycle.finish_request',
              requestId: request.requestId,
              status: scanFailed ? 'failed' : 'completed',
              errorMessage: scanFailed ? sanitizedError : null,
            });
          } catch (finishRequestError) {
            result.errors.push(`finish_request: ${sanitizeError(finishRequestError)}`);
          }
        }
      }
    } catch (cycleError) {
      // Catch-all: any unexpected error inside a cycle. We try to
      // finalize the request with a sanitized message and continue.
      const message = sanitizeError(cycleError);
      result.ok = false;
      scanFailed = true;
      sanitizedError = message;
      result.errors.push(`cycle (request=${request.requestId}): ${message}`);
      try {
        await deps.client.finishDocumentScanRequest({
          requestId: request.requestId,
          status: 'failed',
          errorMessage: message,
        });
      } catch (finishRequestError) {
        result.errors.push(`finish_request after cycle error: ${sanitizeError(finishRequestError)}`);
      }
      if (scanRunId) {
        try {
          await deps.client.finishScanRun({
            id: scanRunId,
            status: 'failed',
            documentsProcessed: 0,
            documentsNew: 0,
            errorMessage: message,
          });
        } catch (finishRunError) {
          result.errors.push(`finish_run after cycle error: ${sanitizeError(finishRunError)}`);
        }
      }
      emit(deps.onEvent, { kind: 'cycle.error', requestId: request.requestId, error: message });
    }

    result.requests_processed++;
    if (scanFailed) {
      result.requests_failed++;
    } else {
      result.requests_completed++;
    }

    if (once) {
      emit(deps.onEvent, {
        kind: 'watch.done',
        reason: scanFailed ? 'once_failed' : 'once_completed',
      });
      return result;
    }

    emit(deps.onEvent, { kind: 'cycle.idle' });
    await deps.sleep(pollSeconds);
  }
}

export const _internal = {
  DEFAULT_POLL_SECONDS,
  MIN_POLL_SECONDS,
  MAX_POLL_SECONDS,
  DEFAULT_STALE_AFTER_MINUTES,
  MIN_STALE_AFTER_MINUTES,
  MAX_STALE_AFTER_MINUTES,
  isFullyConfirmed,
  sanitizeError,
};
