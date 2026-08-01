-- =====================================================================
-- db/104 — RECEIPT LOCK PROTOCOL, ACCEPTANCE GATE AND LOCK ALIGNMENT
--
-- NATIVE-RECEIPT-COORDINATED-RELEASE-P4-AUTHORITY-SWITCH-R1, phase P4.
-- Implements PEDIDO_DERIVED_LIFECYCLE_RECOVERY_PLAN.md sections 9.9.B
-- (one concurrency domain) and 9.9.F (receipt and reversal activation),
-- and manifest row 4 of section 9.9.N.
--
-- WHAT THIS MIGRATION DOES.
--   1. Installs the ONE canonical lock prologue of 9.9.B — pedidos row
--      FOR UPDATE, then the Pedido's ops ASC — as an owner-only helper.
--   2. Joins registrar_/estornar_recebimento_ordem_compra to that
--      protocol and adds the 9.9.F acceptance gate
--      'recebimento_aceite_pendente' to registration.
--   3. Joins alterar_status_op, cancelar_ordem_compra and
--      excluir_ordem_compra to the same protocol (lock correction and
--      lock alignment).
--   4. Narrows the ACL of alterar_status_op, which db/21 shipped with
--      EXECUTE granted to PUBLIC, anon and service_role.
--
-- HOW THE PROVEN BODIES ARE PRESERVED. cancelar_ordem_compra (db/100),
-- excluir_ordem_compra (db/100) and alterar_status_op (db/21) carry
-- large, accepted, separately proved bodies. This migration does NOT
-- retype them. Each is RENAMED IN PLACE to an owner-only implementation,
-- which preserves its body byte-exactly by construction, and a thin
-- public wrapper is created over it. That is the SAME wrapper/impl
-- architecture db/75 already established for receipt
-- (_c3c_registrar_recebimento_impl and _c3c_estornar_recebimento_impl),
-- so no second pattern is introduced. Section 6 asserts, by comparing
-- prosrc hashes captured before the rename, that no implementation body
-- changed at all.
--
-- WHY THE LOCK IS TAKEN IN THE WRAPPER. Every one of these writers can
-- reduce or release productive availability, so 9.9.B requires them to
-- serialize on the Pedido row before any decision is read. Taking the
-- lock in the wrapper, before delegating, means the implementation reads
-- its state already serialized, and the ordering pedidos -> ops is
-- acquired once, ahead of the ordem_compra / necessidade / planejamento
-- locks the implementations already take. lock_timeout is declared as a
-- FUNCTION-level SET on each wrapper, so it covers the wrapper AND the
-- implementation it calls, and is restored automatically on exit.
--
-- WHAT IS DELIBERATELY NOT DONE. The receipt cutover is NOT activated:
-- both receipt wrappers keep their db/75 canonical_active/canonical gate
-- and still refuse with 'recebimento_canonico_inativo' while the cutover
-- is legacy_active. No receipt is registered, no ledger row is written,
-- productive_receipt_started_at is not stamped, and the db/75/db/76
-- writer fence is unchanged. No business row is mutated.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. The canonical lock prologue (9.9.B)
--
-- Global order: pedidos -> ops (ASC id). The subsequent members of the
-- order (op_itens, ordem_compra_item, ordem_compra_item_alocacao) are
-- taken by the callers that actually touch them, in the same ascending
-- discipline; this helper owns the two shared head locks that every
-- availability-reducing writer must agree on.
--
-- Owner-only: it is a lock primitive, not a product operation.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._p4_lock_dominio_pedido(p_pedido_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_op_id BIGINT;
BEGIN
  -- A Purchase Order or OP with no resolvable Pedido cannot contend for
  -- the shared polyester pool; there is nothing to serialize on.
  IF p_pedido_id IS NULL THEN
    RETURN;
  END IF;

  PERFORM 1 FROM public.pedidos WHERE id = p_pedido_id FOR UPDATE;

  FOR v_op_id IN
    SELECT o.id
      FROM public.ops o
      JOIN public.lotes l ON l.id = o.lote_id
     WHERE l.pedido_id = p_pedido_id
     ORDER BY o.id
  LOOP
    PERFORM 1 FROM public.ops WHERE id = v_op_id FOR UPDATE;
  END LOOP;
END;
$$;

ALTER FUNCTION public._p4_lock_dominio_pedido(UUID) OWNER TO postgres;
REVOKE ALL ON FUNCTION public._p4_lock_dominio_pedido(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._p4_lock_dominio_pedido(UUID) FROM anon;
REVOKE ALL ON FUNCTION public._p4_lock_dominio_pedido(UUID) FROM authenticated;
REVOKE ALL ON FUNCTION public._p4_lock_dominio_pedido(UUID) FROM service_role;

COMMENT ON FUNCTION public._p4_lock_dominio_pedido(UUID) IS
  'db/104 (9.9.B): the ONE canonical head of the global lock order - pedidos row FOR UPDATE, then that Pedido''s ops ASC. Owner-only. Callers declare SET lock_timeout at function level and translate lock_not_available into concorrencia_ocupada.';

-- Resolves the Pedido that owns an OP, through its lote. Owner-only.
CREATE OR REPLACE FUNCTION public._p4_pedido_de_op(p_op_id BIGINT)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT l.pedido_id
    FROM public.ops o
    JOIN public.lotes l ON l.id = o.lote_id
   WHERE o.id = p_op_id;
$$;

ALTER FUNCTION public._p4_pedido_de_op(BIGINT) OWNER TO postgres;
REVOKE ALL ON FUNCTION public._p4_pedido_de_op(BIGINT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._p4_pedido_de_op(BIGINT) FROM anon;
REVOKE ALL ON FUNCTION public._p4_pedido_de_op(BIGINT) FROM authenticated;
REVOKE ALL ON FUNCTION public._p4_pedido_de_op(BIGINT) FROM service_role;

-- ---------------------------------------------------------------------
-- 2. Capture the pre-rename implementation hashes
--
-- Section 6 proves that renaming preserved each body byte-exactly. The
-- hashes are captured HERE, before any rename, into a temporary table
-- that lives only inside this transaction.
-- ---------------------------------------------------------------------
-- Captures the body that WILL BECOME each implementation: on a first
-- application that is still the public function, and on a re-application
-- it is the already-renamed implementation. Both passes therefore compare
-- like with like, so the assertion stays meaningful and the migration
-- stays a no-op when re-applied.
-- Deliberately NOT `ON COMMIT DROP`: this migration must behave identically
-- whether it is applied inside its own BEGIN/COMMIT or by a tool that wraps
-- each statement in its own implicit transaction. Under the latter,
-- ON COMMIT DROP would destroy the capture before section 6 could read it and
-- the migration would abort on a scratch-table artefact rather than on a real
-- defect. It is dropped explicitly at the end of section 6 instead.
DROP TABLE IF EXISTS _db104_pre_hash;
CREATE TEMPORARY TABLE _db104_pre_hash AS
SELECT t.alvo AS proname, md5(p.prosrc) AS src_md5, length(p.prosrc) AS src_len
  FROM (VALUES
    ('alterar_status_op',     '_op_alterar_status_impl'),
    ('cancelar_ordem_compra', '_oc_cancelar_ordem_compra_impl'),
    ('excluir_ordem_compra',  '_oc_excluir_ordem_compra_impl')
  ) AS t(publico, alvo)
  CROSS JOIN LATERAL (
    SELECT q.prosrc
      FROM pg_catalog.pg_proc q
     WHERE q.pronamespace = 'public'::regnamespace
       AND q.proname = COALESCE(
             (SELECT r.proname FROM pg_catalog.pg_proc r
               WHERE r.pronamespace = 'public'::regnamespace
                 AND r.proname = t.alvo
               LIMIT 1),
             t.publico)
     LIMIT 1
  ) p;

-- ---------------------------------------------------------------------
-- 3. Rename the three proven bodies to owner-only implementations
--
-- Idempotent: the rename happens only when the implementation name is
-- still free. Re-applying db/104 finds the implementations already in
-- place and renames nothing.
-- ---------------------------------------------------------------------
DO $rename$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_proc
     WHERE pronamespace = 'public'::regnamespace
       AND proname = '_op_alterar_status_impl'
  ) THEN
    ALTER FUNCTION public.alterar_status_op(BIGINT, TEXT, TEXT)
      RENAME TO _op_alterar_status_impl;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_proc
     WHERE pronamespace = 'public'::regnamespace
       AND proname = '_oc_cancelar_ordem_compra_impl'
  ) THEN
    ALTER FUNCTION public.cancelar_ordem_compra(BIGINT)
      RENAME TO _oc_cancelar_ordem_compra_impl;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_proc
     WHERE pronamespace = 'public'::regnamespace
       AND proname = '_oc_excluir_ordem_compra_impl'
  ) THEN
    ALTER FUNCTION public.excluir_ordem_compra(BIGINT)
      RENAME TO _oc_excluir_ordem_compra_impl;
  END IF;
END
$rename$;

-- The implementations are owner-only. A renamed function keeps the ACL it
-- carried, so these REVOKEs are what actually closes the inherited
-- authority, including the PUBLIC/anon/service_role EXECUTE that db/21
-- shipped on alterar_status_op.
REVOKE ALL ON FUNCTION public._op_alterar_status_impl(BIGINT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._op_alterar_status_impl(BIGINT, TEXT, TEXT) FROM anon;
REVOKE ALL ON FUNCTION public._op_alterar_status_impl(BIGINT, TEXT, TEXT) FROM authenticated;
REVOKE ALL ON FUNCTION public._op_alterar_status_impl(BIGINT, TEXT, TEXT) FROM service_role;

REVOKE ALL ON FUNCTION public._oc_cancelar_ordem_compra_impl(BIGINT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._oc_cancelar_ordem_compra_impl(BIGINT) FROM anon;
REVOKE ALL ON FUNCTION public._oc_cancelar_ordem_compra_impl(BIGINT) FROM authenticated;
REVOKE ALL ON FUNCTION public._oc_cancelar_ordem_compra_impl(BIGINT) FROM service_role;

REVOKE ALL ON FUNCTION public._oc_excluir_ordem_compra_impl(BIGINT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._oc_excluir_ordem_compra_impl(BIGINT) FROM anon;
REVOKE ALL ON FUNCTION public._oc_excluir_ordem_compra_impl(BIGINT) FROM authenticated;
REVOKE ALL ON FUNCTION public._oc_excluir_ordem_compra_impl(BIGINT) FROM service_role;

-- ---------------------------------------------------------------------
-- 4. The public wrappers — lock protocol, then the proven implementation
-- ---------------------------------------------------------------------

-- 4.1 OP status transition (9.9.B, F8 lock correction).
CREATE OR REPLACE FUNCTION public.alterar_status_op(
  p_op_id      BIGINT,
  p_novo_status TEXT,
  p_observacao TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
SET lock_timeout = '5s'
AS $$
BEGIN
  PERFORM public._p4_lock_dominio_pedido(public._p4_pedido_de_op(p_op_id));
  RETURN public._op_alterar_status_impl(p_op_id, p_novo_status, p_observacao);
EXCEPTION
  WHEN lock_not_available THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'concorrencia_ocupada',
      'erro', 'Outra operacao esta alterando este Pedido. Tente novamente.');
END;
$$;

ALTER FUNCTION public.alterar_status_op(BIGINT, TEXT, TEXT) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.alterar_status_op(BIGINT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.alterar_status_op(BIGINT, TEXT, TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.alterar_status_op(BIGINT, TEXT, TEXT) FROM service_role;
GRANT EXECUTE ON FUNCTION public.alterar_status_op(BIGINT, TEXT, TEXT) TO authenticated;

COMMENT ON FUNCTION public.alterar_status_op(BIGINT, TEXT, TEXT) IS
  'db/21 transition matrix, joined to the 9.9.B lock protocol by db/104 (phase P4). Locks pedidos then the Pedido''s ops ASC under lock_timeout 5s before delegating to the unchanged owner-only body _op_alterar_status_impl; a lock conflict returns concorrencia_ocupada and writes nothing. db/104 also narrowed the db/21 ACL, which had granted EXECUTE to PUBLIC, anon and service_role.';

-- 4.2 Purchase Order cancellation (9.9.B lock alignment).
CREATE OR REPLACE FUNCTION public.cancelar_ordem_compra(p_ordem_id BIGINT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
SET lock_timeout = '5s'
AS $$
BEGIN
  PERFORM public._p4_lock_dominio_pedido(
    (SELECT o.pedido_id FROM public.ordem_compra o WHERE o.id = p_ordem_id));
  RETURN public._oc_cancelar_ordem_compra_impl(p_ordem_id);
EXCEPTION
  WHEN lock_not_available THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'concorrencia_ocupada',
      'erro', 'Outra operacao esta alterando este Pedido. Tente novamente.');
END;
$$;

ALTER FUNCTION public.cancelar_ordem_compra(BIGINT) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.cancelar_ordem_compra(BIGINT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cancelar_ordem_compra(BIGINT) FROM anon;
REVOKE ALL ON FUNCTION public.cancelar_ordem_compra(BIGINT) FROM service_role;
GRANT EXECUTE ON FUNCTION public.cancelar_ordem_compra(BIGINT) TO authenticated;

COMMENT ON FUNCTION public.cancelar_ordem_compra(BIGINT) IS
  'db/100 cancellation semantics, joined to the 9.9.B lock protocol by db/104 (phase P4). The db/100 body is preserved byte-exactly as the owner-only _oc_cancelar_ordem_compra_impl; only the lock prologue is new. Cancellation eligibility, the derived coverage release and the historical graph are unchanged.';

-- 4.3 Purchase Order permanent deletion (9.9.B lock alignment).
CREATE OR REPLACE FUNCTION public.excluir_ordem_compra(p_ordem_id BIGINT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
SET lock_timeout = '5s'
AS $$
BEGIN
  PERFORM public._p4_lock_dominio_pedido(
    (SELECT o.pedido_id FROM public.ordem_compra o WHERE o.id = p_ordem_id));
  RETURN public._oc_excluir_ordem_compra_impl(p_ordem_id);
EXCEPTION
  WHEN lock_not_available THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'concorrencia_ocupada',
      'erro', 'Outra operacao esta alterando este Pedido. Tente novamente.');
END;
$$;

ALTER FUNCTION public.excluir_ordem_compra(BIGINT) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.excluir_ordem_compra(BIGINT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.excluir_ordem_compra(BIGINT) FROM anon;
REVOKE ALL ON FUNCTION public.excluir_ordem_compra(BIGINT) FROM service_role;
GRANT EXECUTE ON FUNCTION public.excluir_ordem_compra(BIGINT) TO authenticated;

COMMENT ON FUNCTION public.excluir_ordem_compra(BIGINT) IS
  'db/100 deletion semantics, joined to the 9.9.B lock protocol by db/104 (phase P4). The db/100 body is preserved byte-exactly as the owner-only _oc_excluir_ordem_compra_impl; only the lock prologue is new.';

-- 4.4 Native receipt registration — lock protocol AND the 9.9.F
--     acceptance gate. The db/75 cutover gate is preserved exactly and is
--     evaluated FIRST, so this migration cannot make receipt reachable.
CREATE OR REPLACE FUNCTION public.registrar_recebimento_ordem_compra(
  p_ordem_id       BIGINT,
  p_idempotency_key TEXT,
  p_ocorrido_em    TIMESTAMPTZ,
  p_documento_ref  TEXT,
  p_origem_tipo    TEXT,
  p_origem_ref     TEXT,
  p_linhas         JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
SET lock_timeout = '5s'
AS $$
DECLARE
  v_state  public.ordem_compra_cutover%ROWTYPE;
  v_ordem  public.ordem_compra%ROWTYPE;
  v_result JSONB;
BEGIN
  -- db/75 cutover gate, preserved exactly. While the cutover is
  -- legacy_active this is the only branch reachable, so db/104 changes
  -- nothing that is live today.
  SELECT * INTO v_state FROM public.ordem_compra_cutover WHERE id = 1 FOR UPDATE;
  IF NOT FOUND OR v_state.status <> 'canonical_active' OR v_state.read_authority <> 'canonical' THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'recebimento_canonico_inativo', 'erro', 'Canonical receipt is inactive');
  END IF;

  SELECT * INTO v_ordem FROM public.ordem_compra WHERE id = p_ordem_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'nao_encontrada', 'erro', 'Ordem de compra nao encontrada');
  END IF;

  -- 9.9.F acceptance gate: a Purchase Order emitted under a supplier that
  -- requires acceptance cannot receive material until it is accepted.
  IF v_ordem.aceite_exigido_na_emissao IS TRUE AND v_ordem.status_aceite <> 'aceita' THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'recebimento_aceite_pendente',
      'erro', 'A ordem exige aceite do fornecedor e ainda nao foi aceita',
      'status_aceite', v_ordem.status_aceite);
  END IF;

  -- 9.9.B lock protocol, ahead of every ledger and allocation write the
  -- implementation performs.
  PERFORM public._p4_lock_dominio_pedido(v_ordem.pedido_id);

  v_result := public._c3c_registrar_recebimento_impl(
    p_ordem_id, p_idempotency_key, p_ocorrido_em, p_documento_ref,
    p_origem_tipo, p_origem_ref, p_linhas
  );
  IF COALESCE((v_result ->> 'ok')::BOOLEAN, FALSE) THEN
    UPDATE public.ordem_compra_cutover
    SET productive_receipt_started_at = COALESCE(productive_receipt_started_at, clock_timestamp())
    WHERE id = 1;
  END IF;
  RETURN v_result;
EXCEPTION
  WHEN lock_not_available THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'concorrencia_ocupada',
      'erro', 'Outra operacao esta alterando este Pedido. Tente novamente.');
END;
$$;

ALTER FUNCTION public.registrar_recebimento_ordem_compra(BIGINT, TEXT, TIMESTAMPTZ, TEXT, TEXT, TEXT, JSONB) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.registrar_recebimento_ordem_compra(BIGINT, TEXT, TIMESTAMPTZ, TEXT, TEXT, TEXT, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.registrar_recebimento_ordem_compra(BIGINT, TEXT, TIMESTAMPTZ, TEXT, TEXT, TEXT, JSONB) FROM anon;
REVOKE ALL ON FUNCTION public.registrar_recebimento_ordem_compra(BIGINT, TEXT, TIMESTAMPTZ, TEXT, TEXT, TEXT, JSONB) FROM service_role;
GRANT EXECUTE ON FUNCTION public.registrar_recebimento_ordem_compra(BIGINT, TEXT, TIMESTAMPTZ, TEXT, TEXT, TEXT, JSONB) TO authenticated;

COMMENT ON FUNCTION public.registrar_recebimento_ordem_compra(BIGINT, TEXT, TIMESTAMPTZ, TEXT, TEXT, TEXT, JSONB) IS
  'db/75 cutover-gated native receipt wrapper, joined by db/104 (phase P4) to the 9.9.B lock protocol and the 9.9.F acceptance gate. The cutover gate is evaluated FIRST and is unchanged, so receipt remains inactive while ordem_compra_cutover is legacy_active. The PONR stamp is the db/75 statement, unchanged.';

-- 4.5 Native receipt reversal — lock protocol only. Reversal is
--     deliberately NOT gated on acceptance: an already-registered receipt
--     must remain reversible regardless of the acceptance axis.
CREATE OR REPLACE FUNCTION public.estornar_recebimento_ordem_compra(
  p_ordem_id       BIGINT,
  p_idempotency_key TEXT,
  p_ocorrido_em    TIMESTAMPTZ,
  p_motivo         TEXT,
  p_linhas         JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
SET lock_timeout = '5s'
AS $$
DECLARE
  v_state public.ordem_compra_cutover%ROWTYPE;
  v_pedido UUID;
BEGIN
  SELECT * INTO v_state FROM public.ordem_compra_cutover WHERE id = 1;
  IF NOT FOUND OR v_state.status <> 'canonical_active' OR v_state.read_authority <> 'canonical' THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'recebimento_canonico_inativo', 'erro', 'Canonical reversal is inactive');
  END IF;

  SELECT o.pedido_id INTO v_pedido FROM public.ordem_compra o WHERE o.id = p_ordem_id;
  PERFORM public._p4_lock_dominio_pedido(v_pedido);

  RETURN public._c3c_estornar_recebimento_impl(
    p_ordem_id, p_idempotency_key, p_ocorrido_em, p_motivo, p_linhas
  );
EXCEPTION
  WHEN lock_not_available THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'concorrencia_ocupada',
      'erro', 'Outra operacao esta alterando este Pedido. Tente novamente.');
END;
$$;

ALTER FUNCTION public.estornar_recebimento_ordem_compra(BIGINT, TEXT, TIMESTAMPTZ, TEXT, JSONB) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.estornar_recebimento_ordem_compra(BIGINT, TEXT, TIMESTAMPTZ, TEXT, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.estornar_recebimento_ordem_compra(BIGINT, TEXT, TIMESTAMPTZ, TEXT, JSONB) FROM anon;
REVOKE ALL ON FUNCTION public.estornar_recebimento_ordem_compra(BIGINT, TEXT, TIMESTAMPTZ, TEXT, JSONB) FROM service_role;
GRANT EXECUTE ON FUNCTION public.estornar_recebimento_ordem_compra(BIGINT, TEXT, TIMESTAMPTZ, TEXT, JSONB) TO authenticated;

COMMENT ON FUNCTION public.estornar_recebimento_ordem_compra(BIGINT, TEXT, TIMESTAMPTZ, TEXT, JSONB) IS
  'db/75 cutover-gated native reversal wrapper, joined by db/104 (phase P4) to the 9.9.B lock protocol. Deliberately NOT acceptance-gated: an already-registered receipt stays reversible on its own axis.';

-- ---------------------------------------------------------------------
-- 5. The implementations must be unreachable by every client role
-- ---------------------------------------------------------------------

-- ---------------------------------------------------------------------
-- 6. Self-verification — fail closed inside the same transaction
-- ---------------------------------------------------------------------
DO $db104$
DECLARE
  v_role  TEXT;
  v_fn    TEXT;
  v_drift INT;
BEGIN
  -- 6.1 Every renamed implementation body is byte-identical to what it
  --     was before the rename. This is the proof that no proven body was
  --     retyped, paraphrased or lost.
  SELECT count(*) INTO v_drift
    FROM _db104_pre_hash h
    JOIN pg_catalog.pg_proc p
      ON p.pronamespace = 'public'::regnamespace
     AND p.proname = h.proname
   WHERE md5(p.prosrc) IS DISTINCT FROM h.src_md5
      OR length(p.prosrc) IS DISTINCT FROM h.src_len;
  IF v_drift > 0 THEN
    RAISE EXCEPTION 'db/104: % renamed implementation body/bodies changed', v_drift;
  END IF;

  IF (SELECT count(*) FROM _db104_pre_hash) <> 3 THEN
    RAISE EXCEPTION 'db/104: expected 3 pre-rename bodies, found %',
      (SELECT count(*) FROM _db104_pre_hash);
  END IF;

  -- 6.2 Owner-only implementations and the lock primitives are
  --     unreachable by every client role.
  FOREACH v_fn IN ARRAY ARRAY[
    'public._p4_lock_dominio_pedido(uuid)',
    'public._p4_pedido_de_op(bigint)',
    'public._op_alterar_status_impl(bigint,text,text)',
    'public._oc_cancelar_ordem_compra_impl(bigint)',
    'public._oc_excluir_ordem_compra_impl(bigint)',
    'public._c3c_registrar_recebimento_impl(bigint,text,timestamptz,text,text,text,jsonb)',
    'public._c3c_estornar_recebimento_impl(bigint,text,timestamptz,text,jsonb)'
  ] LOOP
    FOREACH v_role IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
      IF has_function_privilege(v_role, v_fn, 'EXECUTE') THEN
        RAISE EXCEPTION 'db/104: owner-only % is reachable by %', v_fn, v_role;
      END IF;
    END LOOP;
  END LOOP;

  -- 6.3 The five public writers are reachable by authenticated and by
  --     nobody else. anon and service_role must NOT hold EXECUTE - this
  --     is the correction of the db/21 PUBLIC grant on alterar_status_op.
  FOREACH v_fn IN ARRAY ARRAY[
    'public.alterar_status_op(bigint,text,text)',
    'public.cancelar_ordem_compra(bigint)',
    'public.excluir_ordem_compra(bigint)',
    'public.registrar_recebimento_ordem_compra(bigint,text,timestamptz,text,text,text,jsonb)',
    'public.estornar_recebimento_ordem_compra(bigint,text,timestamptz,text,jsonb)'
  ] LOOP
    IF NOT has_function_privilege('authenticated', v_fn, 'EXECUTE') THEN
      RAISE EXCEPTION 'db/104: authenticated cannot reach the canonical writer %', v_fn;
    END IF;
    FOREACH v_role IN ARRAY ARRAY['anon', 'service_role'] LOOP
      IF has_function_privilege(v_role, v_fn, 'EXECUTE') THEN
        RAISE EXCEPTION 'db/104: % still holds EXECUTE on %', v_role, v_fn;
      END IF;
    END LOOP;
  END LOOP;

  -- 6.4 No wrapper lost its lock declaration.
  FOREACH v_fn IN ARRAY ARRAY[
    'alterar_status_op', 'cancelar_ordem_compra', 'excluir_ordem_compra',
    'registrar_recebimento_ordem_compra', 'estornar_recebimento_ordem_compra'
  ] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_catalog.pg_proc p
       WHERE p.pronamespace = 'public'::regnamespace
         AND p.proname = v_fn
         AND p.prosecdef
         AND EXISTS (SELECT 1 FROM unnest(COALESCE(p.proconfig, ARRAY[]::TEXT[])) e
                      WHERE e = 'lock_timeout=5s')
         AND p.prosrc LIKE '%_p4_lock_dominio_pedido%'
    ) THEN
      RAISE EXCEPTION 'db/104: wrapper % lost its lock protocol declaration', v_fn;
    END IF;
  END LOOP;

  -- 6.5 The acceptance gate exists on registration and NOT on reversal.
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_proc p
     WHERE p.pronamespace = 'public'::regnamespace
       AND p.proname = 'registrar_recebimento_ordem_compra'
       AND p.prosrc LIKE '%recebimento_aceite_pendente%'
  ) THEN
    RAISE EXCEPTION 'db/104: the acceptance gate is missing from receipt registration';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_proc p
     WHERE p.pronamespace = 'public'::regnamespace
       AND p.proname = 'estornar_recebimento_ordem_compra'
       AND p.prosrc LIKE '%recebimento_aceite_pendente%'
  ) THEN
    RAISE EXCEPTION 'db/104: reversal must not be acceptance-gated';
  END IF;

  -- 6.6 The db/75 cutover gate survived on BOTH receipt paths. db/104 is
  --     not a cutover step.
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_proc p
     WHERE p.pronamespace = 'public'::regnamespace
       AND p.proname = 'registrar_recebimento_ordem_compra'
       AND p.prosrc LIKE '%recebimento_canonico_inativo%'
       AND p.prosrc LIKE '%canonical_active%')
     OR NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_proc p
     WHERE p.pronamespace = 'public'::regnamespace
       AND p.proname = 'estornar_recebimento_ordem_compra'
       AND p.prosrc LIKE '%recebimento_canonico_inativo%'
       AND p.prosrc LIKE '%canonical_active%') THEN
    RAISE EXCEPTION 'db/104: a receipt path lost the db/75 cutover gate';
  END IF;

  -- 6.7 The cutover is untouched and the PONR is uncrossed.
  PERFORM 1 FROM public.ordem_compra_cutover
   WHERE id = 1
     AND status = 'legacy_active'
     AND read_authority = 'flat'
     AND productive_receipt_started_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'db/104: ordem_compra_cutover is not legacy_active/flat with an uncrossed PONR';
  END IF;

  -- 6.8 No receipt fact exists. db/104 fabricates nothing.
  IF (SELECT count(*) FROM public.ordem_compra_fio_lancamentos) <> 0 THEN
    RAISE EXCEPTION 'db/104: the native ledger is not empty';
  END IF;
END
$db104$;

DROP TABLE IF EXISTS _db104_pre_hash;

COMMIT;
