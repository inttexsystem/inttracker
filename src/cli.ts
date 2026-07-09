#!/usr/bin/env node
import { Command } from 'commander';
import { createInterface } from 'node:readline/promises';
import { scanGmail, listPending, assignPedido, exportPendingEvents, queryAndExportEvents } from './index.js';
import { config } from './config.js';
import { assertSafeScopes, exchangeCodeForToken, generateAuthUrl, loadOAuthConfig } from './connectors/oauth.js';
import { listPendingDocuments, inspectByDocumentOrEmail, generateReport, planReprocess } from './core/queries.js';
import { maskId, maskIdStrict, maskEmail, maskSubject, maskLink } from './core/mask.js';
import { fromLegacyTipo } from './types/document.js';
import type { TipoDocumentoLegado } from './types/document.js';
import { linkDocumentToPedido } from './core/link.js';
import { acceptDocument, rejectDocument } from './core/acceptance.js';
import { normalizePedido } from './core/pedido.js';
import { exportManifest, syncManifest } from './core/syncManifest.js';
import { exportPackage, exportReceivedDocuments, exportMappedDocuments } from './core/exportPackage.js';
import { closeDb, getDb } from './storage/sqlite.js';
import { runSyncMapped, validateSyncMappedOptions } from './core/syncMapped.js';
import { writeLatestManifest } from './core/latestManifest.js';
import { runSyncSupabase } from './core/syncSupabase.js';
import { createServiceRoleWriterClient, loadServiceRoleConfig } from './supabase/serviceRoleClient.js';

const program = new Command();

program
  .name('ravatex-ingestor')
  .description('Ravatex Documents Ingestor CLI')
  .version('0.1.0');

program
  .command('scan')
  .description('Scan Gmail for new document attachments')
  .option('-d, --days <number>', 'Number of days back to scan (1-30; >7 requires --wide-scan)', String(config.scanDaysBack))
  .option('--max-attachments <number>', 'Hard cap on attachments processed per run (1-200)', '25')
  .option('--wide-scan', 'Acknowledge scanning more than 7 days back (required for --days > 7)')
  .option('--confirm-real-google', 'Process real Gmail/Drive (otherwise dry-run)')
  .option('--dry-run', 'Force dry-run even if --confirm-real-google is set')
  .option('--query <gmail_query>', 'Additional Gmail search query (refines base filter, does not replace)')
  .option('--retry-message <gmail_message_id>', 'Retry processing a specific Gmail message (bypasses skip for this message)')
  .action(async (opts) => {
    const days = parseInt(opts.days, 10);
    if (!Number.isFinite(days) || days < 1 || days > 30) {
      console.error('[scan] --days must be between 1 and 30. Got:', opts.days);
      process.exit(1);
    }
    if (days > 7 && !opts.wideScan) {
      console.error(`[scan] --days=${days} requires --wide-scan. Refusing to run a wide scan without explicit opt-in.`);
      process.exit(1);
    }

    const maxAttachments = parseInt(opts.maxAttachments, 10);
    if (!Number.isFinite(maxAttachments) || maxAttachments < 1 || maxAttachments > 200) {
      console.error('[scan] --max-attachments must be between 1 and 200. Got:', opts.maxAttachments);
      process.exit(1);
    }

    const confirmReal = Boolean(opts.confirmRealGoogle) && !opts.dryRun;
    const gmailQuery = opts.query ? String(opts.query).trim() : undefined;
    const retryMessageId = opts.retryMessage ? String(opts.retryMessage).trim() : undefined;

    if (confirmReal && maxAttachments > 5 && !gmailQuery) {
      console.error('[scan] REAL mode with --max-attachments > 5 requires --query for safety. Use --query to narrow the scan or reduce --max-attachments.');
      process.exit(1);
    }
    if (days > 7) {
      console.warn(`[scan] WIDE-SCAN: processing up to ${days} days of inbox. Cap: ${maxAttachments} attachments.`);
    }
    const result = await scanGmail({
      daysBack: days,
      confirmReal,
      maxAttachments,
      query: gmailQuery,
      retryMessageId,
    });
    if (result.mode === 'dry-run') {
      console.log('[scan] DRY-RUN — no real Gmail/Drive calls performed.');
      console.log('[scan] Pass --confirm-real-google to perform real processing.');
    } else {
      console.log('[scan] REAL mode:');
      console.log(`  emailsScanned:    ${result.emailsScanned}`);
      console.log(`  attachmentsFound: ${result.attachmentsFound}`);
      console.log(`  newDocuments:     ${result.newDocuments}`);
      console.log(`  duplicates:       ${result.duplicates}`);
      console.log(`  crossMsgDuplicates: ${result.crossMessageDuplicates ?? 0}`);
      console.log(`  skippedByCap:     ${result.skippedByCap ?? 0}`);
      if (result.runLogPath) {
        console.log(`  runLog:           ${result.runLogPath}`);
      }
      if (result.errors.length) {
        console.log(`  errors:           ${result.errors.length}`);
        for (const e of result.errors) console.log(`    - ${e}`);
      }
    }
  });

program
  .command('list-pending')
  .description('List documents with safe (masked) text output or full JSON')
  .option('--limit <n>', 'Max rows to return (default 20, cap 200)', '20')
  .option('--status <status>', 'Filter by status: pending|assigned|accepted|rejected')
  .option('--tipo <tipo>', 'Filter by tipo: nf|romaneio|desconhecido (also accepts legacy nf_pdf|nf_xml)')
  .option('--formato <formato>', 'Filter by formato: pdf|xml|desconhecido')
  .option('--direcao <direcao>', 'Filter by direcao NF: entrada|saida|desconhecida')
  .option('--pedido <pedido>', 'Filter by pedido (e.g. 25/2026 or PED-25-2026)')
  .option('--json', 'Print full JSON (no token/secret by design)', false)
  .action((opts) => {
    let limit = parseInt(opts.limit, 10);
    if (!Number.isFinite(limit) || limit < 1) limit = 20;
    if (limit > 200) {
      console.error(`[list-pending] --limit capped at 200 (was ${limit})`);
      limit = 200;
    }
    const validStatuses = ['pending', 'assigned', 'accepted', 'rejected'] as const;
    const validTipos = ['nf', 'romaneio', 'desconhecido', 'nf_pdf', 'nf_xml'] as const;
    const validFormatos = ['pdf', 'xml', 'desconhecido'] as const;
    const validDirecoes = ['entrada', 'saida', 'desconhecida'] as const;
    const status = (validStatuses as readonly string[]).includes(opts.status) ? opts.status as any : undefined;
    const tipo = (validTipos as readonly string[]).includes(opts.tipo) ? opts.tipo as any : undefined;
    const formato = (validFormatos as readonly string[]).includes(opts.formato) ? opts.formato as any : undefined;
    const direcaoNf = (validDirecoes as readonly string[]).includes(opts.direcao) ? opts.direcao as any : undefined;
    let pedido: string | undefined;
    if (opts.pedido) {
      const n = normalizePedido(opts.pedido);
      pedido = n ?? undefined;
      if (!n) console.error(`[list-pending] Invalid pedido format: ${opts.pedido} — filter ignored`);
    }

    const rows = listPendingDocuments({ limit, status, tipo, formato, direcaoNf, pedido });
    if (rows.length === 0) {
      console.log('No documents matched.');
      closeDb();
      return;
    }

    if (opts.json) {
      const safe = rows.map(r => ({
        ...r,
        id: maskIdStrict(r.id),
        gmail_message_id: maskIdStrict(r.gmail_message_id),
        drive_file_id: r.drive_file_id ? maskIdStrict(r.drive_file_id) : null,
        email_subject: r.email_subject ? maskSubject(r.email_subject) : null,
      }));
      console.log(JSON.stringify({ count: safe.length, documents: safe }, null, 2));
    } else {
      console.log('doc_id              | email_id       | date       | subject                    | filename           | tipo       | fmt | dir         | status    | pedido        | drive_id');
      console.log('-'.repeat(202));
      for (const r of rows) {
        const line = [
          maskIdStrict(r.id).padEnd(18),
          maskIdStrict(r.gmail_message_id).padEnd(14),
          (r.email_date ?? '').slice(0, 10).padEnd(10),
          maskSubject(r.email_subject, 28).padEnd(28),
          (r.filename_original ?? '').slice(0, 18).padEnd(18),
          (r.tipo_documento ?? '').padEnd(10),
          (r.formato ?? '').padEnd(4),
          (r.direcao_nf ?? '-').padEnd(12),
          (r.status ?? '').padEnd(9),
          (r.pedido_manual ?? '-').padEnd(14),
          r.drive_file_id ? maskIdStrict(r.drive_file_id) : 'no-drive',
        ].join(' | ');
        console.log(line);
      }
    }
    closeDb();
  });

program
  .command('assign')
  .description('Assign a document to a Pedido')
  .requiredOption('--id <id>', 'Document ID or Gmail message ID')
  .requiredOption('--pedido <pedido>', 'Pedido number (e.g. 25/2026)')
  .option('--confirm-real-google', 'Move/copy in real Drive (otherwise dry-run)')
  .action(async (opts) => {
    const result = await assignPedido(opts.id, opts.pedido, {
      confirmReal: Boolean(opts.confirmRealGoogle),
    });
    if (result) {
      console.log('Assigned: document=%s pedido=%s event=%s storage=%s', result.documentId, result.pedidoManual, result.eventId, result.storageUri);
    } else {
      console.log('Assign did not produce a result. Use --confirm-real-google to perform real Drive move.');
      process.exit(1);
    }
  });

program
  .command('link')
  .description('Link a pending document to a Pedido (local-only, no Google Drive calls)')
  .requiredOption('--id <id>', 'Document ID or Gmail message ID')
  .requiredOption('--pedido <pedido>', 'Pedido number (e.g. 25/2026)')
  .action((opts) => {
    try {
      const result = linkDocumentToPedido(opts.id, opts.pedido);
      console.log('[link] Linked: document=%s pedido=%s event=%s', result.documentId, result.pedidoManual, result.eventId);
      if (result.warnedDirection) {
        console.log('[link] Warning: document NF direction is unknown — linked without direction guard. Verify manually.');
      }
      console.log('[link] Local-only — no Google Drive calls performed.');
    } catch (e: any) {
      console.error('[link]', e.message);
      process.exit(1);
    }
    closeDb();
  });

program
  .command('accept')
  .description('Accept a linked document (local-only, no Google Drive calls)')
  .requiredOption('--id <id>', 'Document ID or Gmail message ID')
  .action((opts) => {
    try {
      const result = acceptDocument(opts.id);
      console.log('[accept] Accepted: document=%s pedido=%s event=%s', result.documentId, result.pedidoManual, result.eventId);
      console.log('[accept] Local-only — no Google Drive calls performed.');
    } catch (e: any) {
      console.error('[accept]', e.message);
      process.exit(1);
    }
    closeDb();
  });

program
  .command('reject')
  .description('Reject a linked document (local-only, no Google Drive calls)')
  .requiredOption('--id <id>', 'Document ID or Gmail message ID')
  .option('--reason <reason>', 'Reason for rejection')
  .action((opts) => {
    try {
      const result = rejectDocument(opts.id, opts.reason);
      console.log('[reject] Rejected: document=%s pedido=%s event=%s', result.documentId, result.pedidoManual, result.eventId);
      if (opts.reason) console.log('[reject] Reason: %s', opts.reason);
      console.log('[reject] Local-only — no Google Drive calls performed.');
    } catch (e: any) {
      console.error('[reject]', e.message);
      process.exit(1);
    }
    closeDb();
  });

program
  .command('inspect')
  .description('Show safe details for a document or gmail message (no real Google calls)')
  .requiredOption('--id <id>', 'Document ID or Gmail message ID')
  .option('--json', 'Print full JSON (no token/secret by design)', false)
  .action((opts) => {
    const result = inspectByDocumentOrEmail(opts.id);
    if (!result) {
      console.error(`[inspect] No document or email found for id: ${opts.id}`);
      process.exit(1);
    }
    if (opts.json) {
      const safe = {
        document: {
          ...result.document,
          id: maskIdStrict(result.document.id),
          gmail_message_id: maskIdStrict(result.document.gmail_message_id),
          thread_id: maskIdStrict(result.document.thread_id),
          attachment_id: maskIdStrict(result.document.attachment_id),
          drive_file_id: result.document.drive_file_id ? maskIdStrict(result.document.drive_file_id) : null,
          drive_folder_id: result.document.drive_folder_id ? maskIdStrict(result.document.drive_folder_id) : null,
          drive_web_view_link: result.document.drive_web_view_link ? maskLink(result.document.drive_web_view_link) : null,
        },
        email: result.email ? {
          gmail_message_id: maskIdStrict(result.email.gmail_message_id),
          thread_id: maskIdStrict(result.email.thread_id),
          subject: maskSubject(result.email.subject),
        } : null,
        events: result.events.map((e: any) => ({
          ...e,
          id: maskIdStrict(e.id),
          drive_file_id: e.drive_file_id ? maskIdStrict(e.drive_file_id) : null,
          drive_web_view_link: e.drive_web_view_link ? maskLink(e.drive_web_view_link) : null,
          manifest_storage_uri: e.manifest_storage_uri,
          manifest_drive_file_id: e.manifest_drive_file_id ? maskIdStrict(e.manifest_drive_file_id) : null,
        })),
        manifest_ref: result.manifest_ref,
      };
      console.log(JSON.stringify(safe, null, 2));
    } else {
      const d = result.document;
      const tipoRaw: string = d.tipo_documento ?? 'desconhecido';
      const isLegacy = tipoRaw === 'nf_xml' || tipoRaw === 'nf_pdf';
      const tax = isLegacy ? fromLegacyTipo(tipoRaw as TipoDocumentoLegado) : null;
      console.log('--- document ---');
      console.log(`  id:               ${maskIdStrict(d.id)}`);
      console.log(`  gmail_message_id: ${maskIdStrict(d.gmail_message_id)}`);
      console.log(`  filename:         ${d.filename_original}`);
      console.log(`  tipo_documento:   ${tax ? tax.tipoDocumento : d.tipo_documento}${isLegacy ? ` (original: ${tipoRaw})` : ''}`);
      console.log(`  formato:          ${tax ? tax.formato : (d.formato ?? '(none)')}`);
      console.log(`  direcao_nf:       ${tax ? (tax.direcaoNf ?? '(none)') : (d.direcao_nf ?? '(none)')}`);
      console.log(`  status:           ${d.status}`);
      console.log(`  pedido_manual:    ${d.pedido_manual ?? '(none)'}`);
      console.log(`  storage_backend:  ${d.storage_backend}`);
      console.log(`  created_at:       ${d.created_at}`);
      console.log(`  updated_at:       ${d.updated_at}`);
      if (d.drive_file_id) {
        console.log('--- drive links ---');
        console.log(`  drive_file_id:         ${d.drive_file_id}`);
        console.log(`  drive_web_view_link:   ${d.drive_web_view_link ?? '(none)'}`);
        console.log(`  drive_web_content_link: ${d.drive_web_content_link ?? '(none)'}`);
        console.log(`  drive_folder_id:       ${d.drive_folder_id ?? '(none)'}`);
        console.log(`  storage_uri:           ${d.storage_uri ?? '(none)'}`);
      }
      if (result.email) {
        console.log('--- email ---');
        console.log(`  gmail_message_id: ${maskIdStrict(result.email.gmail_message_id)}`);
        console.log(`  subject:          ${maskSubject(result.email.subject)}`);
        console.log(`  processed_at:     ${result.email.processed_at}`);
      }
      if (result.events.length > 0) {
        console.log('--- outbox events ---');
        for (const e of result.events) {
          console.log(`  ${maskIdStrict(e.id)} | pedido=${e.pedido_manual} | status=${e.status} | exported_at=${e.exported_at ?? 'pending'}`);
        }
      }
    }
    closeDb();
  });

program
  .command('report')
  .description('Local import report (read-only, no Google calls)')
  .option('--days <n>', 'Window for recent errors (default 7)', '7')
  .option('--pedido <pedido>', 'Filter by pedido (e.g. PED-01-2026 or 1/2026)')
  .option('--json', 'Print full JSON (no token/secret by design)', false)
  .action((opts) => {
    const days = parseInt(opts.days, 10) || 7;
    const pedido = opts.pedido ? (opts.pedido.startsWith('PED-') ? opts.pedido : `PED-${opts.pedido.replace(/\//g, '-')}`) : undefined;
    const report = generateReport({ daysBack: days, pedido });
    if (opts.json) {
      console.log(JSON.stringify(report, null, 2));
    } else {
      console.log('--- import report ---');
      console.log(`  totalEmailsProcessed:  ${report.totalEmailsProcessed}`);
      console.log(`  totalDocuments:        ${report.totalDocuments}`);
      console.log(`  recentErrors (${days}d):   ${report.recentErrors}`);
      console.log('');
      console.log('--- funnel ---');
      console.log(`  pendingWithoutPedido:  ${report.pendingWithoutPedido}`);
      console.log(`  documentsAccepted:     ${report.documentsAccepted}`);
      console.log(`  documentsRejected:     ${report.documentsRejected}`);
      console.log('  by status:');
      for (const [k, v] of Object.entries(report.documentsByStatus)) {
        console.log(`    ${k}: ${v}`);
      }
      if (Object.keys(report.assignedByPedido).length > 0) {
        console.log('  by pedido:');
        for (const [k, v] of Object.entries(report.assignedByPedido)) {
          console.log(`    ${k}: ${v}`);
        }
      }
      console.log('');
      console.log('--- taxonomy ---');
      console.log('  by tipo:');
      for (const [k, v] of Object.entries(report.documentsByTipo)) {
        console.log(`    ${k}: ${v}`);
      }
      console.log('  by formato:');
      for (const [k, v] of Object.entries(report.documentsByFormato)) {
        console.log(`    ${k}: ${v}`);
      }
      console.log('  by direcao NF:');
      for (const [k, v] of Object.entries(report.documentsByDirecao)) {
        console.log(`    ${k}: ${v}`);
      }
      console.log('  NF by direcao:');
      for (const [k, v] of Object.entries(report.nfByDirecao)) {
        console.log(`    ${k}: ${v}`);
      }
      console.log('  pending NF by direcao:');
      for (const [k, v] of Object.entries(report.pendingByDirecao)) {
        console.log(`    ${k}: ${v}`);
      }
      console.log('');
      console.log('--- outbox ---');
      console.log(`  pendingAppAcceptance:  ${report.pendingAppAcceptance}`);
      console.log(`  outbox:                ${report.outboxPath}`);
    }
    closeDb();
  });

program
  .command('reprocess')
  .description('Plan and apply local-only reprocessing (no real Google calls unless --confirm-real-google)')
  .requiredOption('--id <id>', 'Document ID or Gmail message ID')
  .option('--confirm', 'Apply local actions (otherwise dry-run)', false)
  .option('--confirm-real-google', 'Allow Drive touch (still requires explicit --confirm)', false)
  .action((opts) => {
    const plan = planReprocess(opts.id);
    if (!plan) {
      console.error(`[reprocess] No document or email found for id: ${opts.id}`);
      process.exit(1);
    }
    if (plan.blocked) {
      console.log('[reprocess] BLOCKED:', plan.blockReason);
      console.log('[reprocess] No actions taken.');
      closeDb();
      return;
    }
    if (!opts.confirm) {
      console.log('[reprocess] DRY-RUN (pass --confirm to apply):');
      for (const a of plan.actions) console.log(`  - ${a}`);
      console.log(`  existing event: ${plan.existingEventId ?? '(none)'}`);
      closeDb();
      return;
    }
    console.log('[reprocess] APPLY:');
    const db = getDb();
    const applied: string[] = [];
    for (const action of plan.actions) {
      if (action === 'reclassify-local') {
        applied.push('reclassify-local (no-op: re-classification is deterministic on filename+mime)');
      } else if (action === 'regenerate-manifest-reference') {
        applied.push('manifest-ref refreshed in document row (updated_at)');
        db.prepare(`UPDATE documentos SET updated_at = datetime('now') WHERE id = ?`).run(plan.documentId);
      } else if (action === 'create-outbox-event-if-absent') {
        if (!plan.existingEventId) {
          applied.push('skip: no Drive ref / cannot generate outbox event without Drive context');
        }
      } else if (action === 'skip-outbox-event-already-exists') {
        applied.push('skip: outbox event already exists — no duplicate created');
      } else {
        applied.push(`unknown: ${action}`);
      }
    }
    for (const a of applied) console.log(`  ✓ ${a}`);
    closeDb();
  });

program
  .command('login')
  .description('Interactive Google OAuth login — saves token to data/google-token.json')
  .action(async () => {
    const cfg = loadOAuthConfig();
    assertSafeScopes(cfg);

    const url = generateAuthUrl(cfg);
    console.log('\nOpen the following URL in your browser:');
    console.log('\n  ' + url + '\n');
    console.log('Grant access, then paste the authorization code from the redirect URL (the "code" query parameter).\n');

    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const code = await rl.question('Paste the authorization code here: ');
    rl.close();

    if (!code.trim()) {
      console.error('No code provided. Aborting.');
      process.exit(1);
    }

    console.log('Exchanging code for token...');
    const tokens = await exchangeCodeForToken(code.trim(), cfg);
    console.log('Token saved to ' + cfg.tokenPath);
    console.log('Email authenticated successfully.');
  });

program
  .command('export-events')
  .description('Export events to JSONL (read-only with filters; use --mark-exported to mark as sent)')
  .option('--event-type <type>', 'Filter by event_type: document.detected|document.linked|document.accepted|document.rejected')
  .option('--pedido <pedido>', 'Filter by pedido (e.g. 25/2026 or PED-25-2026)')
  .option('--mark-exported', 'Mark events as exported (updates exported_at)', false)
  .option('--json', 'Print as JSON instead of lines', false)
  .action((opts) => {
    const validTypes = ['document.detected', 'document.linked', 'document.accepted', 'document.rejected'] as const;
    const eventType = (validTypes as readonly string[]).includes(opts.eventType) ? opts.eventType : undefined;

    let pedido: string | undefined;
    if (opts.pedido) {
      const n = normalizePedido(opts.pedido);
      if (n) pedido = n;
      else console.error(`[export-events] Invalid pedido format: ${opts.pedido} — filter ignored`);
    }

    if (opts.markExported && !eventType && !pedido) {
      const events = exportPendingEvents();
      console.log('Exported %d events.', events.length);
      return;
    }

    if (opts.markExported) {
      const events = exportPendingEvents();
      const filtered = events.filter(e => {
        if (eventType && e.event_type !== eventType) return false;
        if (pedido && e.pedido_manual !== pedido) return false;
        return true;
      });
      console.log('Exported %d events (filtered from %d total).', filtered.length, events.length);
      return;
    }

    const events = queryAndExportEvents({ eventType, pedido });
    if (opts.json) {
      console.log(JSON.stringify({ count: events.length, events }, null, 2));
    } else {
      for (const e of events) {
        console.log(JSON.stringify(e));
      }
    }
    console.log('Exported %d events.', events.length);
  });

program
  .command('export-manifest')
  .description('Export local manifest snapshot for a pedido (read-only, no Google Drive)')
  .requiredOption('--pedido <pedido>', 'Pedido (e.g. 25/2026 or PED-25-2026)')
  .action((opts) => {
    const n = normalizePedido(opts.pedido);
    if (!n) {
      console.error('[export-manifest] Invalid pedido format:', opts.pedido);
      process.exit(1);
    }
    const manifest = exportManifest(n);
    console.log(JSON.stringify(manifest, null, 2));
    closeDb();
  });

program
  .command('sync-manifest')
  .description('Sync manifest to Google Drive for a pedido (dry-run by default)')
  .requiredOption('--pedido <pedido>', 'Pedido (e.g. 25/2026 or PED-25-2026)')
  .option('--confirm-real-google', 'Perform real Drive sync (otherwise dry-run)')
  .action(async (opts) => {
    const n = normalizePedido(opts.pedido);
    if (!n) {
      console.error('[sync-manifest] Invalid pedido format:', opts.pedido);
      process.exit(1);
    }
    const result = await syncManifest(n, { confirmRealGoogle: Boolean(opts.confirmRealGoogle) });
    if (result.dryRun) {
      console.log('[sync-manifest] DRY-RUN — no Google Drive calls performed.');
      console.log('[sync-manifest] Would sync %d documents for pedido %s.', result.documentCount, n);
      console.log('[sync-manifest] Preview:');
      const manifest = exportManifest(n);
      console.log(JSON.stringify(manifest, null, 2));
    } else {
      console.log('[sync-manifest] Synced %d documents for pedido %s.', result.documentCount, n);
      console.log('[sync-manifest] Drive file: %s', result.driveFileId ?? '(none)');
      console.log('[sync-manifest] Storage URI: %s', result.storageUri ?? '(none)');
    }
    closeDb();
  });

program
  .command('export-package')
  .description('Generate integration package for Controle de Tapetes (local-only, no Google Drive)')
  .requiredOption('--pedido <pedido>', 'Pedido (e.g. 25/2026 or PED-25-2026)')
  .option('--output <dir>', 'Output directory (default: data/exports/packages/<PEDIDO>)')
  .action((opts) => {
    const n = normalizePedido(opts.pedido);
    if (!n) {
      console.error('[export-package] Invalid pedido format:', opts.pedido);
      process.exit(1);
    }
    const result = exportPackage(n, { outputDir: opts.output });
    console.log('[export-package] Package generated for pedido %s', result.pedido);
    console.log('[export-package] Output: %s', result.outputDir);
    console.log('[export-package] Total events: %d', result.totalEvents);
    console.log('[export-package] Total documents: %d', result.totalDocuments);
    console.log('[export-package] Event types: linked=%d accepted=%d rejected=%d detected=%d',
      result.linkedCount, result.acceptedCount, result.rejectedCount, result.detectedCount);
    console.log('[export-package] Files: %s', result.files.map(f => f.split(/[\\/]/).pop()).join(', '));
    console.log('[export-package] Local-only — no Google Drive calls performed.');
    closeDb();
  });

program
  .command('export-received')
  .description('Export received documents (pending, no pedido) to JSONL (read-only, no Google Drive)')
  .option('--output <path>', 'Output file path (default: data/exports/documentos-recebidos.jsonl)')
  .option('--days <n>', 'Filter documents created in the last N days')
  .option('--limit <n>', 'Max documents to export (cap 5000)', '5000')
  .action((opts) => {
    let daysBack: number | undefined;
    if (opts.days !== undefined) {
      const n = parseInt(opts.days, 10);
      if (!Number.isFinite(n) || n < 1) {
        console.error('[export-received] --days must be a positive integer. Got:', opts.days);
        process.exit(1);
      }
      daysBack = n;
    }

    let limit: number | undefined;
    if (opts.limit !== undefined) {
      const n = parseInt(opts.limit, 10);
      if (!Number.isFinite(n) || n < 1) {
        console.error('[export-received] --limit must be a positive integer. Got:', opts.limit);
        process.exit(1);
      }
      if (n > 5000) {
        console.error(`[export-received] --limit capped at 5000 (was ${n})`);
        limit = 5000;
      } else {
        limit = n;
      }
    }

    const result = exportReceivedDocuments({
      outputPath: opts.output,
      daysBack,
      limit,
    });
    console.log('[export-received] Exported %d received document(s).', result.totalDocuments);
    console.log('[export-received] Output: %s', result.outputPath);
    console.log('[export-received] Local-only — no Google Drive calls performed.');
    closeDb();
  });

program
  .command('export-mapped')
  .description('Export mapped documents (all statuses) to JSONL (read-only, no Google Drive)')
  .option('--output <path>', 'Output file path (default: data/exports/documentos-mapeados.jsonl)')
  .option('--status <status>', 'Filter by status: pending|assigned|accepted|rejected')
  .option('--days <n>', 'Filter documents created in the last N days')
  .option('--limit <n>', 'Max documents to export (cap 5000)', '5000')
  .action((opts) => {
    const validStatuses = ['pending', 'assigned', 'accepted', 'rejected'] as const;
    let status: 'pending' | 'assigned' | 'accepted' | 'rejected' | undefined;
    if (opts.status) {
      if (!(validStatuses as readonly string[]).includes(opts.status)) {
        console.error('[export-mapped] --status must be one of: pending, assigned, accepted, rejected. Got:', opts.status);
        process.exit(1);
      }
      status = opts.status as 'pending' | 'assigned' | 'accepted' | 'rejected';
    }

    let daysBack: number | undefined;
    if (opts.days !== undefined) {
      const n = parseInt(opts.days, 10);
      if (!Number.isFinite(n) || n < 1) {
        console.error('[export-mapped] --days must be a positive integer. Got:', opts.days);
        process.exit(1);
      }
      daysBack = n;
    }

    let limit: number | undefined;
    if (opts.limit !== undefined) {
      const n = parseInt(opts.limit, 10);
      if (!Number.isFinite(n) || n < 1) {
        console.error('[export-mapped] --limit must be a positive integer. Got:', opts.limit);
        process.exit(1);
      }
      if (n > 5000) {
        console.error(`[export-mapped] --limit capped at 5000 (was ${n})`);
        limit = 5000;
      } else {
        limit = n;
      }
    }

    const result = exportMappedDocuments({
      outputPath: opts.output,
      status,
      daysBack,
      limit,
    });
    console.log('[export-mapped] Exported %d mapped document(s).', result.totalDocuments);
    console.log('[export-mapped] Output: %s', result.outputPath);
    console.log('[export-mapped] Local-only — no Google Drive calls performed.');
    closeDb();
  });

program
  .command('write-latest')
  .description('Write latest.json manifest for the mapped documents JSONL export (local-only, no Google Drive)')
  .option('--jsonl <path>', 'Path to the mapped JSONL file (default: data/exports/documentos-mapeados.jsonl)')
  .option('--output <path>', 'Output path for latest.json (default: data/exports/latest.json)')
  .action((opts) => {
    const jsonlPath = opts.jsonl ?? 'data/exports/documentos-mapeados.jsonl';
    const manifestPath = opts.output ?? 'data/exports/latest.json';

    const result = writeLatestManifest({ jsonlPath, manifestPath });

    if (!result.ok) {
      console.error(`[write-latest] ${result.error}`);
      process.exit(1);
    }

    const m = result.manifest!;
    console.log(`[write-latest] Wrote latest manifest: ${result.manifestPath}`);
    console.log(`[write-latest] count=${m.count} hash=${m.hash} bytes=${m.bytes}`);
    console.log('[write-latest] Local-only — no Gmail/Drive calls performed.');
  });

program
  .command('sync-supabase')
  .description('Sync local mapped JSONL and optional event JSONL to Supabase document tables')
  .requiredOption('--mapped <path>', 'Path to export:mapped JSONL')
  .option('--events <path>', 'Path to outbox/export events JSONL')
  .option('--confirm-supabase-write', 'Allow service-role writes (otherwise dry-run)')
  .option('--dry-run', 'Force dry-run even if --confirm-supabase-write is set')
  .option('--source <source>', 'Logical scan source', 'documents_ingestor')
  .action(async (opts) => {
    const confirmWrite = Boolean(opts.confirmSupabaseWrite) && !Boolean(opts.dryRun);
    let client;
    let projectRef: string | null = null;

    if (confirmWrite) {
      try {
        const serviceRoleConfig = loadServiceRoleConfig();
        client = createServiceRoleWriterClient(serviceRoleConfig);
        projectRef = serviceRoleConfig.projectRef;
      } catch (error: any) {
        console.error(error?.message ?? String(error));
        process.exitCode = 1;
        return;
      }
    }

    try {
      const result = await runSyncSupabase({
        mappedPath: opts.mapped,
        eventsPath: opts.events,
        confirmWrite,
        dryRun: Boolean(opts.dryRun),
        source: opts.source,
      }, client);
      console.log(JSON.stringify({ ...result, project_ref: projectRef }, null, 2));
      if (!result.ok) process.exitCode = 1;
    } catch (error: any) {
      console.error(`[sync:supabase] ${error?.message ?? String(error)}`);
      process.exitCode = 1;
    }
  });

program
  .command('sync-mapped')
  .description('Run scan → export mapped → report in a single local command (dry-run by default)')
  .option('-d, --days <number>', 'Days back for scan (1-30; >7 requires --wide-scan)', String(config.scanDaysBack))
  .option('--max-attachments <number>', 'Hard cap on attachments processed per scan run (1-200)', '25')
  .option('--wide-scan', 'Acknowledge scanning more than 7 days back (required for --days > 7)')
  .option('--confirm-real-google', 'Process real Gmail/Drive (otherwise dry-run)')
  .option('--query <gmail_query>', 'Additional Gmail search query (refines base filter)')
  .option('--retry-message <gmail_message_id>', 'Retry processing a specific Gmail message (single-message, narrow)')
  .option('--status <status>', 'Filter export by status: pending|assigned|accepted|rejected')
  .option('--export-days <n>', 'Filter export by documents created in the last N days')
  .option('--limit <n>', 'Max documents to export (cap 5000)', '5000')
  .option('--output <path>', 'Output file path (default: data/exports/documentos-mapeados.jsonl)')
  .option('--json-report', 'Print report as JSON instead of human-readable text', false)
  .option('--write-latest', 'Write latest.json manifest after export (default: data/exports/latest.json)', false)
  .action(async (opts) => {
    const days = parseInt(opts.days, 10);
    if (!Number.isFinite(days) || days < 1 || days > 30) {
      console.error('[sync-mapped] --days must be between 1 and 30. Got:', opts.days);
      process.exit(1);
    }
    if (days > 7 && !opts.wideScan) {
      console.error(`[sync-mapped] --days=${days} requires --wide-scan. Refusing to run a wide scan without explicit opt-in.`);
      process.exit(1);
    }

    const maxAttachments = parseInt(opts.maxAttachments, 10);
    if (!Number.isFinite(maxAttachments) || maxAttachments < 1 || maxAttachments > 200) {
      console.error('[sync-mapped] --max-attachments must be between 1 and 200. Got:', opts.maxAttachments);
      process.exit(1);
    }

    const confirmReal = Boolean(opts.confirmRealGoogle);
    const gmailQuery = opts.query ? String(opts.query).trim() : undefined;
    const retryMessageId = opts.retryMessage ? String(opts.retryMessage).trim() : undefined;
    const daysExplicitlyProvided = process.argv.includes('--days') || process.argv.includes('-d');

    if (confirmReal && maxAttachments > 5 && !gmailQuery && !retryMessageId) {
      console.error('[sync-mapped] REAL mode with --max-attachments > 5 requires --query (or --retry-message) for safety.');
      process.exit(1);
    }

    const validation = validateSyncMappedOptions({
      daysBack: daysExplicitlyProvided ? days : undefined,
      wideScan: Boolean(opts.wideScan),
      query: gmailQuery,
      retryMessageId,
    });
    if (!validation.ok) {
      console.error(`[sync-mapped] ${validation.reason}`);
      process.exit(1);
    }
    const effectiveDays = validation.resolvedDaysBack ?? days;

    let status: 'pending' | 'assigned' | 'accepted' | 'rejected' | undefined;
    if (opts.status) {
      const validStatuses = ['pending', 'assigned', 'accepted', 'rejected'] as const;
      if (!(validStatuses as readonly string[]).includes(opts.status)) {
        console.error('[sync-mapped] --status must be one of: pending, assigned, accepted, rejected. Got:', opts.status);
        process.exit(1);
      }
      status = opts.status as 'pending' | 'assigned' | 'accepted' | 'rejected';
    }

    let exportDays: number | undefined;
    if (opts.exportDays !== undefined) {
      const n = parseInt(opts.exportDays, 10);
      if (!Number.isFinite(n) || n < 1) {
        console.error('[sync-mapped] --export-days must be a positive integer. Got:', opts.exportDays);
        process.exit(1);
      }
      exportDays = n;
    }

    let limit: number | undefined;
    if (opts.limit !== undefined) {
      const n = parseInt(opts.limit, 10);
      if (!Number.isFinite(n) || n < 1) {
        console.error('[sync-mapped] --limit must be a positive integer. Got:', opts.limit);
        process.exit(1);
      }
      if (n > 5000) {
        console.error(`[sync-mapped] --limit capped at 5000 (was ${n})`);
        limit = 5000;
      } else {
        limit = n;
      }
    }

    if (retryMessageId) {
      console.log(`[sync-mapped] --retry-message detected: forcing effective days=${effectiveDays}, narrow mode.`);
    }
    if (days > 7) {
      console.warn(`[sync-mapped] WIDE-SCAN: processing up to ${days} days of inbox. Cap: ${maxAttachments} attachments.`);
    }
    if (!confirmReal) {
      console.log('[sync-mapped] DRY-RUN — no real Gmail/Drive calls performed.');
      console.log('[sync-mapped] Pass --confirm-real-google to perform real processing.');
    } else {
      console.log('[sync-mapped] REAL mode (Gmail/Drive calls will be made).');
    }

    const startedAt = Date.now();
    console.log('[sync-mapped] Step 1/3: scan');
    const result = await runSyncMapped({
      daysBack: effectiveDays,
      confirmReal,
      maxAttachments,
      query: gmailQuery,
      retryMessageId,
      status,
      days: exportDays,
      limit,
      outputPath: opts.output,
    });
    const elapsedMs = Date.now() - startedAt;

    if (result.scan.mode === 'real') {
      console.log(`[sync-mapped] scan: emailsScanned=${result.scan.emailsScanned} new=${result.scan.newDocuments} duplicates=${result.scan.duplicates} crossMessageDuplicates=${result.scan.crossMessageDuplicates} skippedByCap=${result.scan.skippedByCap ?? 0} errors=${result.scan.errors.length}`);
    } else {
      console.log('[sync-mapped] scan: dry-run (no Gmail calls).');
    }
    if (result.scan.runLogPath) {
      console.log(`[sync-mapped] scan runLog: ${result.scan.runLogPath}`);
    }

    console.log('[sync-mapped] Step 2/3: export mapped documents');
    console.log(`[sync-mapped] exported ${result.export.totalDocuments} mapped document(s) → ${result.export.outputPath}`);

    if (opts.writeLatest) {
      const latestJsonlPath = opts.output ?? 'data/exports/documentos-mapeados.jsonl';
      const latestManifestPath = 'data/exports/latest.json';
      const latestResult = writeLatestManifest({ jsonlPath: latestJsonlPath, manifestPath: latestManifestPath });
      if (!latestResult.ok) {
        console.log(`[sync-mapped] write-latest: WARNING — ${latestResult.error}`);
      } else {
        const lm = latestResult.manifest!;
        console.log(`[sync-mapped] write-latest: wrote ${latestManifestPath} (count=${lm.count} hash=${lm.hash} bytes=${lm.bytes})`);
      }
    }

    console.log('[sync-mapped] Step 3/3: report');
    const r = result.report;
    if (opts.jsonReport) {
      console.log(JSON.stringify(r, null, 2));
    } else {
      console.log('--- import report ---');
      console.log(`  totalEmailsProcessed:  ${r.totalEmailsProcessed}`);
      console.log(`  totalDocuments:        ${r.totalDocuments}`);
      console.log(`  recentErrors (7d):     ${r.recentErrors}`);
      console.log('  by status:');
      for (const [k, v] of Object.entries(r.documentsByStatus)) {
        console.log(`    ${k}: ${v}`);
      }
      console.log(`  pendingWithoutPedido:  ${r.pendingWithoutPedido}`);
      console.log(`  documentsAccepted:     ${r.documentsAccepted}`);
      console.log(`  documentsRejected:     ${r.documentsRejected}`);
      console.log(`  pendingAppAcceptance:  ${r.pendingAppAcceptance}`);
    }

    console.log(`[sync-mapped] DONE in ${elapsedMs}ms — sequence: ${result.sequence.join(' → ')}.`);
    console.log('[sync-mapped] Local-only — no Google Drive calls were made by this command unless --confirm-real-google was used.');

    closeDb();
  });

program.parse(process.argv);
