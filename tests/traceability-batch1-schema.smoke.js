const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const applicability = fs.readFileSync(
  path.join(root, 'db', '130_pedido_item_finishing_applicability.sql'), 'utf8');
const externalIds = fs.readFileSync(
  path.join(root, 'db', '131_pedido_external_identifiers.sql'), 'utf8');

test('db/130 owns nullable explicit applicability on canonical pedido_itens', () => {
  assert.match(applicability, /ALTER TABLE public\.pedido_itens[\s\S]*ADD COLUMN IF NOT EXISTS requires_finishing BOOLEAN/u);
  assert.doesNotMatch(applicability, /requires_finishing BOOLEAN NOT NULL/u);
  assert.doesNotMatch(applicability, /UPDATE public\.pedido_itens[\s\S]{0,300}tipo_produto/u);
  assert.match(applicability, /MODEL_DEFAULT[\s\S]*EXPLICIT_HUMAN[\s\S]*CORRECTION/u);
});
test('db/130 distinguishes NOT APPLICABLE from numeric completion', () => {
  assert.match(applicability, /FALSE=ACABADO NOT APPLICABLE/u);
  assert.match(applicability, /FALSE is never numeric completion/u);
  assert.doesNotMatch(applicability, /requires_finishing[^\n]*(?:numeric|integer|percent)/iu);
});

test('db/130 preserves old payloads and model changes without silent rewrite', () => {
  assert.match(applicability, /v_explicit := v_row \? 'requires_finishing'/u);
  assert.match(applicability, /ELSIF v_item_id IS NULL THEN[\s\S]*pedido_item_requires_finishing_default/u);
  assert.match(applicability, /ELSE[\s\S]*v_requires := v_current_requires;[\s\S]*v_origin := v_current_origin;/u);
  assert.match(applicability, /NEW\.requires_finishing IS NOT DISTINCT FROM OLD\.requires_finishing/u);
  assert.match(applicability, /PEDIDO_ITEM_REQUIRES_FINISHING_DEDICATED_COMMAND_REQUIRED/u);
  assert.match(applicability, /PEDIDO_ITEM_REQUIRES_FINISHING_PRODUCTION_EVIDENCE_DEDICATED_COMMAND_REQUIRED/u);
});

test('db/130 provides one governed caller-identified applicability correction command', () => {
  assert.match(applicability, /CREATE OR REPLACE FUNCTION public\.definir_requires_finishing_pedido_item\(\s*p_pedido_item_id UUID,\s*p_requires_finishing BOOLEAN,\s*p_expected_revision BIGINT,\s*p_command_id UUID,\s*p_reason TEXT\)/u);
  assert.match(applicability, /PEDIDO_ITEM_REQUIRES_FINISHING_COMMAND_CONFLICT/u);
  assert.match(applicability, /PEDIDO_ITEM_REQUIRES_FINISHING_STALE_REVISION/u);
  assert.match(applicability, /PEDIDO_ITEM_REQUIRES_FINISHING_DOWNSTREAM_FINISHING_EVIDENCE_CONFLICT/u);
  assert.match(applicability, /pedido_item_applicability_events_command_uidx[\s\S]*WHERE command_hash IS NOT NULL/u);
  assert.match(applicability, /SET search_path = ''[\s\S]*SET lock_timeout = '5s'/u);
  assert.match(applicability, /REVOKE ALL ON FUNCTION public\.definir_requires_finishing_pedido_item[\s\S]*PUBLIC, anon, service_role/u);
});

test('db/130 reuses all canonical Pedido writers and snapshots', () => {
  for (const name of [
    'criar_pedido_admin', 'criar_pedido_cliente',
    'pedido_itens_payload_normalizar', 'pedido_itens_reconciliar',
    'pedido_snapshot', 'solicitar_alteracao_pedido', 'aprovar_alteracao_pedido',
  ]) {
    assert.match(applicability, new RegExp(`CREATE OR REPLACE FUNCTION public\\.${name}\\(`, 'u'));
  }
  assert.doesNotMatch(applicability, /(?:INSERT INTO|UPDATE|DELETE FROM) public\.(?:ops|op_itens)\b/iu);
});

test('db/130 audit is append-only, revisioned and direct-write contained', () => {
  assert.match(applicability, /CREATE TABLE IF NOT EXISTS public\.pedido_item_applicability_events/u);
  for (const field of ['previous_value', 'new_value', 'new_origin', 'actor_id', 'process', 'reason', 'command_id', 'created_at']) {
    assert.match(applicability, new RegExp(`\\b${field}\\b`, 'u'));
  }
  assert.match(applicability, /BEFORE UPDATE OR DELETE ON public\.pedido_item_applicability_events/u);
  assert.match(applicability, /PEDIDO_ITEM_APPLICABILITY_DIRECT_WRITE_FORBIDDEN/u);
  assert.match(applicability, /REVOKE ALL ON public\.pedido_item_applicability_events[\s\S]*authenticated/u);
});

test('db/130 derives applicability authority from effective role, never caller session state', () => {
  const prepareStart = applicability.indexOf(
    'CREATE OR REPLACE FUNCTION public.pedido_item_applicability_prepare_fn()');
  const prepareEnd = applicability.indexOf(
    'ALTER FUNCTION public.pedido_item_applicability_prepare_fn()', prepareStart);
  const prepareBody = applicability.slice(prepareStart, prepareEnd);
  assert.match(prepareBody, /SECURITY INVOKER/u);
  assert.match(prepareBody, /CURRENT_USER = 'postgres'/u);
  assert.doesNotMatch(applicability, /traceability_applicability_writer/u);
  assert.match(applicability, /CREATE OR REPLACE FUNCTION public\.pedido_itens_reconciliar[\s\S]*SECURITY DEFINER/u);
  assert.match(applicability, /CREATE OR REPLACE FUNCTION public\.definir_requires_finishing_pedido_item[\s\S]*SECURITY DEFINER/u);
});

test('db/131 stores typed exact literals and one current target', () => {
  assert.match(externalIds, /CREATE TABLE IF NOT EXISTS public\.pedido_external_identifiers/u);
  assert.match(externalIds, /namespace\s+TEXT NOT NULL/u);
  assert.match(externalIds, /literal_value\s+TEXT NOT NULL/u);
  assert.match(externalIds, /UNIQUE \(namespace, literal_value\)/u);
  assert.match(externalIds, /active AND pedido_id IS NOT NULL/u);
  assert.match(externalIds, /namespace IN \('legacy', 't_series'\)/u);
  assert.match(externalIds, /WHEN 'legacy' THEN COALESCE\(p_literal_value ~ '\^\[0-9\]\{5\}\$'/u);
  assert.match(externalIds, /WHEN 't_series' THEN COALESCE\(p_literal_value ~ '\^T\[0-9\]\{3\}-\[0-9\]\{2\}\$'/u);
  assert.match(externalIds, /PEDIDO_EXTERNAL_IDENTIFIER_LITERAL_INVALID_FOR_NAMESPACE/u);
});

test('db/131 exposes only explicit exact-equality mapping and lookup', () => {
  assert.match(externalIds, /e\.namespace = p_namespace[\s\S]*e\.literal_value = p_literal_value/u);
  assert.doesNotMatch(externalIds, /regexp_replace|substring\s*\(|lpad\s*\(|replace\s*\(|split_part\s*\(/iu);
  assert.doesNotMatch(externalIds, /UPDATE public\.(?:pedidos|ops)\b/iu);
  assert.doesNotMatch(externalIds, /INSERT INTO public\.(?:pedidos|ops)\b/iu);
});

test('db/131 mapping history is append-only, corrected/revoked and idempotent', () => {
  assert.match(externalIds, /action\s+TEXT NOT NULL CHECK \(action IN \('MAP', 'CORRECTION', 'REVOKE'\)\)/u);
  assert.match(externalIds, /previous_pedido_id/u);
  assert.match(externalIds, /new_pedido_id/u);
  assert.match(externalIds, /command_id\s+UUID NOT NULL UNIQUE/u);
  assert.match(externalIds, /command_hash/u);
  assert.match(externalIds, /PEDIDO_EXTERNAL_IDENTIFIER_COMMAND_CONFLICT/u);
  assert.match(externalIds, /BEFORE UPDATE OR DELETE ON public\.pedido_external_identifier_events/u);
  const mapBody = externalIds.slice(
    externalIds.indexOf('CREATE OR REPLACE FUNCTION public.mapear_identificador_externo_pedido('),
    externalIds.indexOf('ALTER FUNCTION public.mapear_identificador_externo_pedido('));
  const revokeBody = externalIds.slice(
    externalIds.indexOf('CREATE OR REPLACE FUNCTION public.revogar_identificador_externo_pedido('),
    externalIds.indexOf('ALTER FUNCTION public.revogar_identificador_externo_pedido('));
  assert.ok((mapBody.match(/WHERE command_id = p_command_id/g) || []).length >= 2,
    'map/correction must recheck command receipt after the stable identifier lock');
  assert.ok((revokeBody.match(/WHERE command_id = p_command_id/g) || []).length >= 2,
    'revocation must recheck command receipt after the stable identifier lock');
});

test('db/131 applies RLS, table-grant containment and secure definer hygiene', () => {
  for (const table of ['pedido_external_identifiers', 'pedido_external_identifier_events']) {
    assert.match(externalIds, new RegExp(`ALTER TABLE public\\.${table} ENABLE ROW LEVEL SECURITY`, 'u'));
    assert.match(externalIds, new RegExp(`REVOKE ALL ON public\\.${table}[\\s\\S]*authenticated`, 'u'));
  }
  for (const fn of [
    'mapear_identificador_externo_pedido', 'revogar_identificador_externo_pedido',
    'listar_identificadores_externos_pedido', 'buscar_pedido_por_identificador_externo',
  ]) {
    const start = externalIds.indexOf(`CREATE OR REPLACE FUNCTION public.${fn}(`);
    assert.ok(start >= 0, `${fn} must exist`);
    const body = externalIds.slice(start, externalIds.indexOf('$$;', start) + 3);
    assert.match(body, /SECURITY DEFINER/u);
    assert.match(body, /SET search_path = ''/u);
    assert.match(body, /auth\.uid\(\) IS NULL/u);
  }
});
