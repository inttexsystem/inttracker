// scripts/c3d/catalogue-delta.mjs
//
// NATIVE-RECEIPT-P3-R2-RECONCILIATION-R1.
//
// Canonical catalogue-delta prover for a P3-only forward patch applied to a
// disposable clone AFTER restore.
//
// WHY THIS EXISTS. P3 §10.1 requires the function, policy, table-grant and
// column-grant catalogue to stay unchanged, because P3 applies no DDL after
// restore. Contract Amendment R2 then requires db/112 to be applied to the
// preserved clone, and db/112 is two CREATE OR REPLACE FUNCTION statements —
// which IS catalogue DDL. Read naively those two rules contradict each other.
//
// They are reconciled by measuring, not by weakening: the ONLY authorized
// catalogue delta is the one db/112 itself produces, it is enumerated below as
// a closed set, and every other dimension must still be byte-identical. An
// unrelated change is still UNAUTHORIZED CATALOGUE DRIFT and still fails
// closed.
//
// The nine dimensions and their exact projections are the ones the ACCEPTED
// Phase 2 restore-fidelity evidence used (03-restore-verify.json), so a delta
// measured here is continuous with that baseline and not a new yardstick.

/** Wraps any expression into a NULL-safe, unambiguously-typed text term. */
const t = (expr) => `COALESCE((${expr})::text, '<NULL>')`;

// The per-function signature. `src=md5(prosrc)` is the term db/112 moves; every
// other term (return type, security definer, volatility, kind, parallelism,
// strictness, set-returning, language, proconfig, owner, ACL) must be stable,
// which is exactly what makes CREATE OR REPLACE provably non-widening.
const FN_SIG = `concat_ws('|',
  ${t('n.nspname')},
  ${t('p.proname')},
  ${t('pg_get_function_identity_arguments(p.oid)')},
  concat('ret=',   ${t('pg_get_function_result(p.oid)')}),
  concat('sd=',    ${t('p.prosecdef')}),
  concat('vol=',   ${t('p.provolatile')}),
  concat('kind=',  ${t('p.prokind')}),
  concat('par=',   ${t('p.proparallel')}),
  concat('strict=',${t('p.proisstrict')}),
  concat('retset=',${t('p.proretset')}),
  concat('lang=',  ${t('l.lanname')}),
  concat('cfg=',   ${t("array_to_string(p.proconfig, ',')")}),
  concat('own=',   ${t('pg_get_userbyid(p.proowner)')}),
  concat('acl=',   ${t("array_to_string(p.proacl::text[], ',')")}),
  concat('src=',   ${t('md5(p.prosrc)')})
)`;

const DIM = {
  functions: `SELECT md5(string_agg(sig, E'\\n' ORDER BY sig)) AS h, count(*)::text AS n FROM (
    SELECT ${FN_SIG} AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    JOIN pg_language l ON l.oid = p.prolang WHERE n.nspname = 'public') s`,

  policies: `SELECT md5(string_agg(sig, E'\\n' ORDER BY sig)) AS h, count(*)::text AS n FROM (
    SELECT concat_ws('|', ${t('pol.schemaname')}, ${t('pol.tablename')}, ${t('pol.policyname')},
      concat('perm=', ${t('pol.permissive')}), concat('roles=', ${t("array_to_string(pol.roles, ',')")}),
      concat('cmd=', ${t('pol.cmd')}), concat('qual=', ${t('pol.qual')}),
      concat('check=', ${t('pol.with_check')})) AS sig
    FROM pg_policies pol WHERE pol.schemaname = 'public') s`,

  table_grants: `SELECT md5(string_agg(sig, E'\\n' ORDER BY sig)) AS h, count(*)::text AS n FROM (
    SELECT concat_ws('|', ${t('g.grantee')}, ${t('g.table_schema')}, ${t('g.table_name')},
      ${t('g.privilege_type')}, concat('grantable=', ${t('g.is_grantable')})) AS sig
    FROM information_schema.role_table_grants g WHERE g.table_schema = 'public') s`,

  column_grants: `SELECT md5(string_agg(sig, E'\\n' ORDER BY sig)) AS h, count(*)::text AS n FROM (
    SELECT concat_ws('|', ${t('c.grantee')}, ${t('c.table_schema')}, ${t('c.table_name')},
      ${t('c.column_name')}, ${t('c.privilege_type')},
      concat('grantable=', ${t('c.is_grantable')})) AS sig
    FROM information_schema.column_privileges c WHERE c.table_schema = 'public') s`,

  rls_strict: `SELECT md5(string_agg(sig, E'\\n' ORDER BY sig)) AS h, count(*)::text AS n FROM (
    SELECT concat_ws('|', ${t('c.relname')}, concat('kind=', ${t('c.relkind')}),
      concat('persist=', ${t('c.relpersistence')}), concat('rls=', ${t('c.relrowsecurity')}),
      concat('force=', ${t('c.relforcerowsecurity')}),
      concat('own=', ${t('pg_get_userbyid(c.relowner)')})) AS sig
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind IN ('r','p','v','m')) s`,

  triggers: `SELECT md5(string_agg(sig, E'\\n' ORDER BY sig)) AS h, count(*)::text AS n FROM (
    SELECT concat_ws('|', ${t('c.relname')}, ${t('tg.tgname')},
      concat('enabled=', ${t('tg.tgenabled')}), concat('type=', ${t('tg.tgtype')}),
      concat('fn=', ${t('tg.tgfoid::regprocedure')})) AS sig
    FROM pg_trigger tg JOIN pg_class c ON c.oid = tg.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND NOT tg.tgisinternal) s`,

  columns: `SELECT md5(string_agg(sig, E'\\n' ORDER BY sig)) AS h, count(*)::text AS n FROM (
    SELECT concat_ws('|', ${t('x.relname')}, ${t('x.attname')}, concat('pos=', ${t('x.live_pos')}),
      concat('type=', ${t('x.coltype')}), concat('notnull=', ${t('x.attnotnull')}),
      concat('ident=', ${t('x.attidentity')}), concat('gen=', ${t('x.attgenerated')}),
      concat('default=', ${t('x.coldefault')})) AS sig
    FROM (SELECT c.relname, a.attname, a.attnotnull, a.attidentity, a.attgenerated,
        format_type(a.atttypid, a.atttypmod) AS coltype,
        pg_get_expr(d.adbin, d.adrelid) AS coldefault,
        row_number() OVER (PARTITION BY c.oid ORDER BY a.attnum) AS live_pos
      FROM pg_attribute a JOIN pg_class c ON c.oid = a.attrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
      WHERE n.nspname = 'public' AND c.relkind = 'r'
        AND a.attnum > 0 AND NOT a.attisdropped) x) s`,

  eff_table_privs: `SELECT md5(string_agg(sig, E'\\n' ORDER BY sig)) AS h, count(*)::text AS n FROM (
    SELECT concat_ws('|', c.relname::text, r.role, concat_ws(',',
      CASE WHEN has_table_privilege(r.role, c.oid, 'SELECT') THEN 'SELECT' END,
      CASE WHEN has_table_privilege(r.role, c.oid, 'INSERT') THEN 'INSERT' END,
      CASE WHEN has_table_privilege(r.role, c.oid, 'UPDATE') THEN 'UPDATE' END,
      CASE WHEN has_table_privilege(r.role, c.oid, 'DELETE') THEN 'DELETE' END,
      CASE WHEN has_table_privilege(r.role, c.oid, 'TRUNCATE') THEN 'TRUNCATE' END,
      CASE WHEN has_table_privilege(r.role, c.oid, 'REFERENCES') THEN 'REFERENCES' END)) AS sig
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    CROSS JOIN (VALUES ('anon'),('authenticated'),('service_role'),('public')) AS r(role)
    WHERE n.nspname = 'public' AND c.relkind IN ('r','p','v','m')) s`,

  eff_fn_privs: `SELECT md5(string_agg(sig, E'\\n' ORDER BY sig)) AS h, count(*)::text AS n FROM (
    SELECT concat_ws('|', p.proname::text, pg_get_function_identity_arguments(p.oid)::text,
      r.role, has_function_privilege(r.role, p.oid, 'EXECUTE')::text) AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    CROSS JOIN (VALUES ('anon'),('authenticated'),('service_role'),('public')) AS r(role)
    WHERE n.nspname = 'public') s`,
};

export const DIMENSIONS = Object.freeze(Object.keys(DIM));

/**
 * One query returning every catalogue fingerprint plus the full per-function
 * signature multiset, so a differing dimension can be attributed to the exact
 * functions responsible instead of only reported as "a hash moved".
 */
export const CATALOGUE_SNAPSHOT_SQL = `
SET TimeZone='UTC'; SET DateStyle='ISO, MDY'; SET IntervalStyle='postgres';
SET extra_float_digits=0; SET bytea_output=hex; SET client_encoding='UTF8';
SELECT jsonb_build_object(
${DIMENSIONS.map((d) => `  '${d}', (SELECT to_jsonb(x) FROM (${DIM[d]}) x)`).join(',\n')},
  'fn_sigs', (SELECT COALESCE(jsonb_object_agg(k, v), '{}'::jsonb) FROM (
      SELECT concat_ws('|', p.proname, pg_get_function_identity_arguments(p.oid)) AS k,
             ${FN_SIG} AS v
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      JOIN pg_language l ON l.oid = p.prolang WHERE n.nspname = 'public') q)
)::text;`;

/**
 * The CLOSED set of catalogue changes db/112 is allowed to cause on a clone.
 * Anything outside this set is UNAUTHORIZED CATALOGUE DRIFT.
 */
export const DB112_EXPECTED_DELTA = Object.freeze({
  /** Only this dimension may move, and only because prosrc changed. */
  changed_dimensions: ['functions'],
  /** Exactly these functions, identified by name|identity-arguments. */
  changed_functions: [
    'ordem_compra_c3c_fence_and_snapshot|p_generation bigint',
    'ordem_compra_c3c_assert_import_reconciled|p_generation bigint',
  ],
  /** Within a changed function signature, ONLY this term may differ. */
  changed_signature_terms: ['src'],
  /** Function cardinality must not move: CREATE OR REPLACE adds nothing. */
  function_count_stable: true,
});

/** Splits a `concat_ws('|', ...)` function signature into its labelled terms. */
function sigTerms(sig) {
  const parts = String(sig).split('|');
  const out = {};
  for (const part of parts) {
    const eq = part.indexOf('=');
    if (eq > 0) out[part.slice(0, eq)] = part.slice(eq + 1);
  }
  return out;
}

/**
 * Diffs two catalogue snapshots.
 * Returns { changedDimensions, countChanges, changedFunctions, addedFunctions,
 *           removedFunctions } where changedFunctions carries the exact set of
 * signature terms that moved for each function.
 */
export function diffCatalogue(before, after) {
  const changedDimensions = [];
  const countChanges = [];
  for (const d of DIMENSIONS) {
    if (before[d].h !== after[d].h) changedDimensions.push(d);
    if (before[d].n !== after[d].n) countChanges.push({ dimension: d, before: before[d].n, after: after[d].n });
  }
  const b = before.fn_sigs || {};
  const a = after.fn_sigs || {};
  const addedFunctions = Object.keys(a).filter((k) => !(k in b)).sort();
  const removedFunctions = Object.keys(b).filter((k) => !(k in a)).sort();
  const changedFunctions = [];
  for (const k of Object.keys(a)) {
    if (!(k in b) || b[k] === a[k]) continue;
    const bt = sigTerms(b[k]);
    const at = sigTerms(a[k]);
    const terms = [...new Set([...Object.keys(bt), ...Object.keys(at)])]
      .filter((term) => bt[term] !== at[term]).sort();
    changedFunctions.push({ function: k, changed_terms: terms });
  }
  changedFunctions.sort((x, y) => x.function.localeCompare(y.function));
  return { changedDimensions, countChanges, changedFunctions, addedFunctions, removedFunctions };
}

/**
 * Fail-closed verdict: is `delta` EXACTLY the authorized db/112 delta?
 * Returns { authorized: boolean, violations: string[] }.
 */
export function assertDb112Delta(delta) {
  const violations = [];
  const expected = DB112_EXPECTED_DELTA;

  const unexpectedDims = delta.changedDimensions.filter((d) => !expected.changed_dimensions.includes(d));
  if (unexpectedDims.length) violations.push(`unauthorized catalogue dimension(s) changed: ${unexpectedDims.join(', ')}`);

  if (expected.function_count_stable && delta.countChanges.length) {
    violations.push(`catalogue cardinality changed: ${delta.countChanges.map((c) => `${c.dimension} ${c.before}->${c.after}`).join(', ')}`);
  }
  if (delta.addedFunctions.length) violations.push(`functions added: ${delta.addedFunctions.join(', ')}`);
  if (delta.removedFunctions.length) violations.push(`functions removed: ${delta.removedFunctions.join(', ')}`);

  const changedNames = delta.changedFunctions.map((f) => f.function).sort();
  const expectedNames = [...expected.changed_functions].sort();
  const extra = changedNames.filter((f) => !expectedNames.includes(f));
  const missing = expectedNames.filter((f) => !changedNames.includes(f));
  if (extra.length) violations.push(`unauthorized function body change(s): ${extra.join(', ')}`);
  if (missing.length) violations.push(`expected function body change(s) absent: ${missing.join(', ')}`);

  for (const f of delta.changedFunctions) {
    const bad = f.changed_terms.filter((term) => !expected.changed_signature_terms.includes(term));
    if (bad.length) {
      violations.push(`${f.function} changed protected signature term(s): ${bad.join(', ')} (only ${expected.changed_signature_terms.join(', ')} may move)`);
    }
  }
  return { authorized: violations.length === 0, violations };
}
