// tests/db111-entrega-cima-concorrencia.integration.mjs
//
// db/111 (TD3) — REAL two-session concurrency proof for the top-level
// delivery command.
//
// A sequential SQL block cannot prove this: the defect it guards against
// is precisely two transactions that are BOTH past the replay lookup at
// the same time. Before the correction, both would miss the lookup, both
// would build a delivery, and the loser would die on the
// (namespace, ator_id, idempotency_key) unique constraint with a raw
// 23505 instead of the stored result.
//
// Two scenarios, each with two concurrent psql sessions using the SAME
// authenticated administrator and the SAME idempotency key:
//   1. IDENTICAL payloads  -> exactly one of everything, both sessions
//      receive the SAME stored result.
//   2. CONFLICTING payloads -> one wins, the other returns
//      comando_conflitante and creates nothing.
//
// Out of scope by design: no remote host, no hosted backend, no
// credential, no production contact. Every identifier is synthetic.
//
// Run: node tests/db111-entrega-cima-concorrencia.integration.mjs

import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { bootstrapCluster } from '../scripts/c3d/bootstrap-disposable-cluster.mjs';
import {
  reconstructBaseline, resolveManifest, p1Files, applyFile, scalar,
  openSession, waitFor, delay, writeTemp, log, ADMIN_UUID,
} from '../scripts/c3d/p1-harness.mjs';
import { FIXTURE_SQL } from '../scripts/c3d/p1-fixture.mjs';

// Dedicated id band, disjoint from every other P1 suite.
const OP_A = 940111301;
const OP_B = 940111302;
const IT_A = 940111401;
const IT_B = 940111402;
const FORN_TEC = 940000403;
const FORN_LTX = 940000404;

const SUITE_FIXTURE = `
SET session_replication_role = replica;
INSERT INTO public.fornecedores (id, nome, tipo)
VALUES (${FORN_TEC}, 'P1-FORN-TECELAGEM', 'tecelagem'),
       (${FORN_LTX}, 'P1-FORN-LATEX', 'latex')
  ON CONFLICT (id) DO NOTHING;

INSERT INTO public.ops (id, numero, ano, lote_id, status, tipo) VALUES
  (${OP_A}, 941301, 2099, 940000701, 'aberta', 'tecelagem'),
  (${OP_B}, 941302, 2099, 940000701, 'aberta', 'tecelagem')
  ON CONFLICT (id) DO NOTHING;

INSERT INTO public.op_itens (id, op_id, modelo_id, metros_pedidos) VALUES
  (${IT_A}, ${OP_A}, 940000301, 100.00),
  (${IT_B}, ${OP_B}, 940000301, 100.00)
  ON CONFLICT (id) DO NOTHING;
SET session_replication_role = origin;
`;

const call = (opId, itemId, metros, key) => `
SELECT public.registrar_entrega_cima_com_acabamento(
  ${FORN_TEC}, ${opId}, CURRENT_DATE, 'db111 concorrencia', ${FORN_LTX},
  '[{"op_item_id":${itemId},"metros_entregues":${metros},"defeito":false,"observacao":null}]'::jsonb,
  '${key}') AS r;`;

function resultJson(sessionText) {
  // psql prints the JSONB result; capture the last {...} block.
  const matches = sessionText.match(/\{"ok".*\}/g);
  return matches ? matches[matches.length - 1] : null;
}

async function main() {
  let failures = 0;
  const fail = (step, extra) => { failures += 1; log('CONC_FAIL', { step, ...(extra || {}) }); };

  const handle = await bootstrapCluster({});
  log('CLUSTER_UP', {
    host: handle.host, port: handle.port, pg: handle.pgVersion,
    pid: handle.postmasterPid, dataDir: handle.dataDir,
  });

  let scratch = null;
  try {
    scratch = await mkdtemp(path.join(tmpdir(), 'db111-conc-'));

    const base = await reconstructBaseline(handle, scratch, { applyP1: false });
    log('BASELINE', { migrations: base.baseline.length, shape: base.shape });

    const manifest = await resolveManifest();
    for (const { n, file } of p1Files(manifest)) applyFile(handle, file, `db/${n}`);
    log('P1_APPLIED', { migrations: p1Files(manifest).map((m) => m.n).join(',') });

    applyFile(handle, await writeTemp(scratch, 'fixture.sql', FIXTURE_SQL(ADMIN_UUID)), 'fixture');
    applyFile(handle, await writeTemp(scratch, 'suite.sql', SUITE_FIXTURE), 'suite fixture');

    const T = 30000;

    // =================================================================
    // 1. CONCURRENT IDENTICAL REPLAY
    // =================================================================
    {
      const A = openSession(handle);
      const B = openSession(handle);
      try {
        for (const S of [A, B]) {
          S.send(`SELECT set_config('request.jwt.claim.sub','${ADMIN_UUID}',false);`);
        }
        await delay(400);

        // Both open a transaction and issue the SAME command before
        // either commits, so both are genuinely in flight together.
        A.send('BEGIN;');
        B.send('BEGIN;');
        await delay(200);

        A.send(call(OP_A, IT_A, '40.00', 'conc-same-1') + " SELECT 'A_DONE';");
        // Give A time to take the advisory lock, then start B against it.
        await delay(1200);
        B.send(call(OP_A, IT_A, '40.00', 'conc-same-1') + " SELECT 'B_DONE';");
        await delay(1500);

        const bBlocked = !B.all().includes('B_DONE');
        log('CONC_IDENTICAL', { step: 'B waits on the command advisory lock while A holds it', blocked: bBlocked });
        if (!bBlocked) {
          fail('B did not serialize on the actor/key advisory lock');
        }

        A.send("COMMIT; SELECT 'A_COMMITTED';");
        if (!(await waitFor(() => A.all().includes('A_COMMITTED'), T))) fail('A never committed');
        if (!(await waitFor(() => B.all().includes('B_DONE'), T))) fail('B never settled after A committed');
        B.send("COMMIT; SELECT 'B_COMMITTED';");
        await waitFor(() => B.all().includes('B_COMMITTED'), T);

        const both = A.all() + B.all();
        if (/deadlock detected|impasse detectado|40P01/i.test(both)) fail('SQLSTATE 40P01 observed');
        if (/duplicar valor da chave|duplicate key value|23505/i.test(both)) {
          fail('a unique-constraint error escaped to the caller');
        }

        const rA = resultJson(A.all());
        const rB = resultJson(B.all());
        if (!rA || !rB) {
          fail('a session returned no domain result', { rA: !!rA, rB: !!rB });
        } else if (rA !== rB) {
          fail('the two sessions received different results');
          console.log('  A: ' + rA);
          console.log('  B: ' + rB);
        } else {
          log('CONC_IDENTICAL', { step: 'both sessions received the SAME stored result' });
          console.log('    ' + rA);
        }

        // Exactly one of everything.
        const ent = scalar(handle, `SELECT count(*) FROM public.entregas e
           JOIN public.entrega_itens ei ON ei.entrega_id = e.id WHERE ei.op_id = ${OP_A};`);
        const itens = scalar(handle, `SELECT count(*) FROM public.entrega_itens WHERE op_id = ${OP_A};`);
        const cmd = scalar(handle,
          `SELECT count(*) FROM public.entrega_cima_comandos WHERE idempotency_key = 'conc-same-1';`);
        const entId = scalar(handle,
          `SELECT entrega_id FROM public.entrega_cima_comandos WHERE idempotency_key = 'conc-same-1';`);
        const ops = scalar(handle,
          `SELECT count(*) FROM public.ops WHERE origem_entrega_id = ${entId} AND tipo IN ('latex','acabamento');`);
        const tent = scalar(handle,
          `SELECT count(*) FROM public.op_acabamento_tentativas WHERE origem_entrega_id = ${entId};`);

        const okCounts = ent === '1' && itens === '1' && cmd === '1' && ops === '1' && tent === '1';
        if (!okCounts) fail('concurrent identical replay did not collapse to one of everything',
          { entregas: ent, itens, comandos: cmd, finishing_ops: ops, tentativas: tent });
        else log('CONC_IDENTICAL', {
          result: 'EXACTLY_ONE', entregas: ent, itens, finishing_ops: ops, tentativas: tent, comandos: cmd,
        });
      } finally {
        A.close(); B.close(); await delay(300); A.kill(); B.kill();
      }
    }

    // =================================================================
    // 2. CONCURRENT CONFLICTING REPLAY
    // =================================================================
    {
      const ent0 = scalar(handle, 'SELECT count(*) FROM public.entregas;');
      const it0 = scalar(handle, 'SELECT count(*) FROM public.entrega_itens;');
      const op0 = scalar(handle, "SELECT count(*) FROM public.ops WHERE tipo IN ('latex','acabamento');");
      const te0 = scalar(handle, 'SELECT count(*) FROM public.op_acabamento_tentativas;');
      const cm0 = scalar(handle, 'SELECT count(*) FROM public.entrega_cima_comandos;');

      const A = openSession(handle);
      const B = openSession(handle);
      try {
        for (const S of [A, B]) {
          S.send(`SELECT set_config('request.jwt.claim.sub','${ADMIN_UUID}',false);`);
        }
        await delay(400);

        A.send('BEGIN;');
        B.send('BEGIN;');
        await delay(200);

        // SAME key, MATERIALLY DIFFERENT payloads.
        A.send(call(OP_B, IT_B, '31.00', 'conc-diff-1') + " SELECT 'A_DONE';");
        await delay(1200);
        B.send(call(OP_B, IT_B, '77.00', 'conc-diff-1') + " SELECT 'B_DONE';");
        await delay(1500);

        A.send("COMMIT; SELECT 'A_COMMITTED';");
        if (!(await waitFor(() => A.all().includes('A_COMMITTED'), T))) fail('A never committed (conflict)');
        if (!(await waitFor(() => B.all().includes('B_DONE'), T))) fail('B never settled (conflict)');
        B.send("COMMIT; SELECT 'B_COMMITTED';");
        await waitFor(() => B.all().includes('B_COMMITTED'), T);

        const both = A.all() + B.all();
        if (/deadlock detected|impasse detectado|40P01/i.test(both)) fail('SQLSTATE 40P01 observed (conflict)');
        if (/duplicar valor da chave|duplicate key value|23505/i.test(both)) {
          fail('a unique-constraint error escaped on the conflicting path');
        }

        const conflitos = (both.match(/comando_conflitante/g) || []).length;
        if (conflitos !== 1) {
          fail('exactly one session must be refused as comando_conflitante', { refusals: conflitos });
        } else {
          log('CONC_CONFLICT', { step: 'one command won, the other returned comando_conflitante' });
        }

        // The loser created NOTHING: exactly one new delivery/item/OP/
        // attempt/command in total across both sessions.
        const d = (now, before) => Number(now) - Number(before);
        const dEnt = d(scalar(handle, 'SELECT count(*) FROM public.entregas;'), ent0);
        const dIt = d(scalar(handle, 'SELECT count(*) FROM public.entrega_itens;'), it0);
        const dOp = d(scalar(handle, "SELECT count(*) FROM public.ops WHERE tipo IN ('latex','acabamento');"), op0);
        const dTe = d(scalar(handle, 'SELECT count(*) FROM public.op_acabamento_tentativas;'), te0);
        const dCm = d(scalar(handle, 'SELECT count(*) FROM public.entrega_cima_comandos;'), cm0);

        if (dEnt !== 1 || dIt !== 1 || dOp !== 1 || dTe !== 1 || dCm !== 1) {
          fail('the refused session left rows behind',
            { d_entregas: dEnt, d_itens: dIt, d_ops: dOp, d_tentativas: dTe, d_comandos: dCm });
        } else {
          log('CONC_CONFLICT', {
            result: 'LOSER_WROTE_NOTHING',
            d_entregas: dEnt, d_itens: dIt, d_finishing_ops: dOp, d_tentativas: dTe, d_comandos: dCm,
          });
        }
      } finally {
        A.close(); B.close(); await delay(300); A.kill(); B.kill();
      }
    }
  } catch (err) {
    failures += 1;
    console.error(err.stack || String(err));
  } finally {
    if (scratch) await rm(scratch, { recursive: true, force: true }).catch(() => {});
    const proof = await handle.stop();
    log('TEARDOWN', {
      port: handle.port, pid: handle.postmasterPid,
      stop_ok: proof.stopResult?.ok, port_closed: proof.portClosed,
      pid_absent: proof.pidAbsent, dir_absent: proof.dirAbsent,
    });
  }

  if (failures) {
    console.error(`DB111_CONCURRENCY_FAILURES=${failures}`);
    process.exitCode = 1;
  } else {
    console.log('DB111_CONCURRENCY_PASS');
  }
}

main().catch((err) => { console.error(err.stack || String(err)); process.exitCode = 1; });
