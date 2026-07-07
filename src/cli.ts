#!/usr/bin/env node
import { Command } from 'commander';
import { createInterface } from 'node:readline/promises';
import { scanGmail, listPending, assignPedido, exportPendingEvents } from './index.js';
import { config } from './config.js';
import { assertSafeScopes, exchangeCodeForToken, generateAuthUrl, loadOAuthConfig } from './connectors/oauth.js';
import { listPendingDocuments, inspectByDocumentOrEmail, generateReport, planReprocess } from './core/queries.js';
import { maskId, maskIdStrict, maskEmail, maskSubject, maskLink } from './core/mask.js';
import { fromLegacyTipo } from './types/document.js';
import type { TipoDocumentoLegado } from './types/document.js';
import { closeDb, getDb } from './storage/sqlite.js';

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

    const rows = listPendingDocuments({ limit, status, tipo, formato, direcaoNf });
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
      console.log(`  drive_file_id:    ${d.drive_file_id ? maskIdStrict(d.drive_file_id) : '(none)'}`);
      console.log(`  drive_link:       ${d.drive_web_view_link ? maskLink(d.drive_web_view_link) : '(none)'}`);
      console.log(`  created_at:       ${d.created_at}`);
      console.log(`  updated_at:       ${d.updated_at}`);
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
      console.log(`  pendingWithoutPedido:  ${report.pendingWithoutPedido}`);
      console.log(`  pendingAppAcceptance:  ${report.pendingAppAcceptance}`);
      console.log(`  recentErrors (${days}d):   ${report.recentErrors}`);
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
  .description('Export pending events to JSONL outbox')
  .action(() => {
    const events = exportPendingEvents();
    console.log('Exported %d events.', events.length);
  });

program.parse(process.argv);
