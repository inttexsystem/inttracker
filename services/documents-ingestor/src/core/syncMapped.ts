import { scanGmail, type ScanGmailOptions, type ScanResult } from './ingest.js';
import { exportMappedDocuments, type ExportMappedOptions, type ExportMappedResult } from './exportPackage.js';
import { generateReport, type ReportSummary } from './queries.js';

export interface SyncMappedOptions {
  daysBack?: number;
  confirmReal?: boolean;
  maxAttachments?: number;
  query?: string;
  retryMessageId?: string;
  wideScan?: boolean;
  status?: 'pending' | 'assigned' | 'accepted' | 'rejected';
  days?: number;
  limit?: number;
  outputPath?: string;
}

export interface SyncMappedResult {
  scan: ScanResult;
  export: ExportMappedResult;
  report: ReportSummary;
  sequence: ['scan', 'export', 'report'];
}

export interface SyncMappedDeps {
  scan: (opts: ScanGmailOptions) => Promise<ScanResult>;
  exportMapped: (opts: ExportMappedOptions) => ExportMappedResult;
  report: (opts: { daysBack?: number; pedido?: string }) => ReportSummary;
}

const defaultDeps: SyncMappedDeps = {
  scan: (opts) => scanGmail(opts),
  exportMapped: (opts) => exportMappedDocuments(opts),
  report: (opts) => generateReport(opts),
};

export interface SyncMappedValidation {
  ok: boolean;
  reason?: string;
  resolvedDaysBack?: number;
}

export function validateSyncMappedOptions(opts: SyncMappedOptions): SyncMappedValidation {
  if (opts.retryMessageId) {
    if (opts.wideScan) {
      return {
        ok: false,
        reason: '--retry-message cannot be combined with --wide-scan. retry by message is a narrow operation.',
      };
    }
    if (opts.query) {
      return {
        ok: false,
        reason: '--retry-message cannot be combined with --query. retry by message is a single-message operation.',
      };
    }
    if (opts.daysBack !== undefined && opts.daysBack > 1) {
      return {
        ok: false,
        reason: `--retry-message requires --days <= 1 (got ${opts.daysBack}). Use retry without --days, or pass --days 1.`,
      };
    }
    return { ok: true, resolvedDaysBack: 1 };
  }
  return { ok: true, resolvedDaysBack: opts.daysBack };
}

export function buildScanOptions(opts: SyncMappedOptions): ScanGmailOptions {
  const validation = validateSyncMappedOptions(opts);
  const daysBack = validation.resolvedDaysBack ?? opts.daysBack;
  return {
    daysBack,
    confirmReal: Boolean(opts.confirmReal),
    maxAttachments: opts.maxAttachments,
    query: opts.query,
    retryMessageId: opts.retryMessageId,
  };
}

export function buildExportOptions(opts: SyncMappedOptions): ExportMappedOptions {
  return {
    outputPath: opts.outputPath,
    status: opts.status,
    daysBack: opts.days,
    limit: opts.limit,
  };
}

export async function runSyncMapped(
  opts: SyncMappedOptions = {},
  deps: SyncMappedDeps = defaultDeps,
): Promise<SyncMappedResult> {
  const validation = validateSyncMappedOptions(opts);
  if (!validation.ok) {
    throw new Error(`[sync:mapped] ${validation.reason}`);
  }

  const scanOpts = buildScanOptions(opts);
  const scanResult = await deps.scan(scanOpts);

  const exportOpts = buildExportOptions(opts);
  const exportResult = deps.exportMapped(exportOpts);

  const reportResult = deps.report({});

  return {
    scan: scanResult,
    export: exportResult,
    report: reportResult,
    sequence: ['scan', 'export', 'report'],
  };
}
