-- =============================================================================
-- db/120 — RESTORATION OF THE CANONICAL WRITER OF public.saldo_fios_op
-- =============================================================================
-- ORDER: START-PRODUCTION-CANONICAL-WRITER-RESTORATION-R1 (R4 / ASSURANCE).
--
-- PROBLEM (root cause, measured on the production catalogue, not inferred).
-- db/75 installed public.trg_c3c_protected_mutation_guard as a BEFORE INSERT
-- OR UPDATE OR DELETE ... FOR EACH ROW fence on eight tables, two of which are
-- public.saldo_fios and public.saldo_fios_op. For that pair the fence admits a
-- write only when
--
--     pg_trigger_depth() > 1 AND v_state = 'canonical_active'
--
-- and refuses everything else with 'legacy_receipt_fenced' (SQLSTATE 55000).
--
-- pg_trigger_depth() > 1 means "this DML was issued from INSIDE another
-- trigger". That predicate is exactly right for public.saldo_fios, whose only
-- writer is public.trg_native_lancamento_derive_state — an AFTER INSERT trigger
-- on public.ordem_compra_fio_lancamentos. Its writes run at depth 2 and pass.
--
-- It is STRUCTURALLY UNSATISFIABLE for public.saldo_fios_op. The only writer of
-- that table is public.iniciar_producao_op (db/102 section 9.9.D, ceiling
-- corrected by db/118), which is a plain SECURITY DEFINER FUNCTION, not a
-- trigger. Its DELETE and INSERT therefore always reach the fence at depth 1
-- and are always refused. The allowance was written for the trigger-driven
-- table and applied mechanically to the function-driven one, where no caller
-- can ever satisfy it.
--
-- While ordem_compra_cutover.status was 'legacy_active' the fence returned
-- early and the defect was latent. It became live at canonical_activated_at.
-- Measured consequence on production ucrjtfswnfdlxwtmxnoo: saldo_fios_op holds
-- 0 rows, no OP is in 'em_producao' and op_eventos holds 0 'producao_iniciada'
-- events — public.iniciar_producao_op has never once completed.
--
-- OBSERVED SYMPTOM. The refusal is SQLSTATE 55000. js/screens/op-recalculo.js
-- maps only 42501 to a business code, so the client resolves codigo = null and
-- js/screens/op-distribuicao-ui.js falls through to its generic fallback
-- 'Erro ao iniciar produção'. The exception aborts the whole transaction, so
-- the OP stays in 'aberta' and the saved distribution is left intact.
--
-- WHAT THIS MIGRATION DOES, AND NOTHING WIDER:
--   1. gives public.trg_c3c_protected_mutation_guard one additional allowance
--      that is keyed to public.saldo_fios_op ALONE: a transaction-local
--      capability GUC set by the canonical writer around its own snapshot
--      writes;
--   2. makes public.iniciar_producao_op declare that capability immediately
--      before its DELETE + INSERT snapshot block and clear it immediately
--      after.
--
-- WHAT IT DELIBERATELY DOES NOT DO:
--   - public.saldo_fios behaviour is BYTE-FOR-BYTE UNCHANGED. The new allowance
--     is guarded by TG_TABLE_NAME = 'saldo_fios_op', so the saldo_fios
--     predicate remains exactly pg_trigger_depth() > 1 AND canonical_active;
--   - the ordem_compra and ordem_compra_item branches are unchanged;
--   - the 'legacy_active' / NULL early return is unchanged;
--   - NO grant is added, widened or restated differently. CREATE OR REPLACE
--     preserves the existing ACL and section 4 proves it;
--   - NO table, column, constraint, trigger attachment or index changes;
--   - NO business row is written, reclassified or repriced;
--   - the db/106b fence trg_fato_protegido_fence and the db/106b/db/116/db/117
--     revoked client grants on saldo_fios_op are untouched and remain the
--     actual client-facing security boundary.
--
-- WHY A CAPABILITY GUC AND NOT current_user (measured trap, not preference).
-- public.trg_c3c_protected_mutation_guard is SECURITY DEFINER owned by
-- postgres, so current_user inside it is ALWAYS 'postgres'. A
-- current_user = 'postgres' allowance would make the fence permanently INERT
-- for both saldo tables. That is the identical trap db/106b section 2 already
-- measured and corrected in its sibling fence by declaring it SECURITY INVOKER.
-- This migration does not re-declare a cutover fence post-PONR; it adds one
-- narrowly keyed, transaction-scoped capability instead.
--
-- WHY THE CAPABILITY IS NOT A NEW ATTACK SURFACE. The GUC is a DISAMBIGUATOR
-- behind an already sound boundary, never the boundary itself:
--   - INSERT, UPDATE and DELETE on public.saldo_fios_op are revoked from
--     authenticated, anon and service_role (db/106b section 4.4), and TRUNCATE
--     and MAINTAIN likewise (db/117);
--   - public.trg_fato_protegido_fence is attached to public.saldo_fios_op as a
--     SECURITY INVOKER trigger that refuses whenever current_user <> 'postgres',
--     so direct client DML fails even if a client set the GUC;
--   - set_config(..., true) is transaction-local, and because
--     public.iniciar_producao_op carries its own SET clause the value is
--     additionally unwound at function exit. It cannot outlive the call.
--
-- The capability pattern itself is the one already accepted in this schema:
-- public.ops_manta_reopen_guard_fn reads app.retificacao_autorizada the same way.
-- =============================================================================

-- ---------------------------------------------------------------------
-- 0. Entry gate — refuse to run against anything but the expected state
-- ---------------------------------------------------------------------
DO $gate$
DECLARE
  v_missing TEXT[] := ARRAY[]::TEXT[];
  v_nome    TEXT;
BEGIN
  IF to_regprocedure('public.trg_c3c_protected_mutation_guard()') IS NULL THEN
    v_missing := array_append(v_missing, 'function public.trg_c3c_protected_mutation_guard() (db/75)');
  END IF;
  IF to_regprocedure('public.iniciar_producao_op(bigint,integer)') IS NULL THEN
    v_missing := array_append(v_missing, 'function public.iniciar_producao_op(bigint,integer) (db/102, db/118)');
  END IF;
  IF to_regprocedure('public._oc_teto_disponivel(uuid,bigint,text,text,bigint,text)') IS NULL THEN
    v_missing := array_append(v_missing, 'function public._oc_teto_disponivel (db/118 ceiling owner)');
  END IF;
  IF to_regclass('public.saldo_fios_op') IS NULL THEN
    v_missing := array_append(v_missing, 'table public.saldo_fios_op (db/01)');
  END IF;

  -- The two fences this migration relies on must BOTH already be in force on
  -- saldo_fios_op: the one being narrowed, and the one that carries the real
  -- client-facing boundary. Narrowing without the second in place would be a
  -- genuine widening.
  -- Matched by TRIGGER FUNCTION, not by trigger name: db/106b attaches
  -- public.trg_fato_protegido_fence() under the per-table name
  -- saldo_fios_op_fato_protegido_fence, so a name match would fail closed
  -- against a database that is in fact correct.
  FOREACH v_nome IN ARRAY ARRAY['public.trg_c3c_protected_mutation_guard()',
                                'public.trg_fato_protegido_fence()'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_catalog.pg_trigger t
        JOIN pg_catalog.pg_class c ON c.oid = t.tgrelid
       WHERE c.relnamespace = 'public'::regnamespace
         AND c.relname = 'saldo_fios_op'
         AND t.tgfoid = v_nome::regprocedure
         AND t.tgenabled = 'O'
         AND NOT t.tgisinternal
    ) THEN
      v_missing := array_append(v_missing,
        format('no enabled trigger on public.saldo_fios_op executes %s', v_nome));
    END IF;
  END LOOP;

  -- The client-facing revocations of db/106b section 4.4 must still hold.
  IF EXISTS (
    SELECT 1 FROM information_schema.role_table_grants
     WHERE table_schema = 'public' AND table_name = 'saldo_fios_op'
       AND grantee IN ('authenticated', 'anon', 'service_role')
       AND privilege_type IN ('INSERT', 'UPDATE', 'DELETE')
  ) THEN
    v_missing := array_append(v_missing,
      'public.saldo_fios_op still carries a client mutation grant (db/106b section 4.4 not in force)');
  END IF;

  IF array_length(v_missing, 1) IS NOT NULL THEN
    RAISE EXCEPTION 'db/120 gate: %', array_to_string(v_missing, '; ');
  END IF;
END
$gate$;

-- ---------------------------------------------------------------------
-- 1. The fence, with one allowance keyed to saldo_fios_op alone
--
-- Reproduced from the db/75 body. The ONLY textual change is inside the
-- saldo branch. The legacy_active early return, the ordem_compra_item
-- branch, the ordem_compra branch, the saldo_fios predicate and the final
-- catch-all refusal are unchanged, as is the error contract
-- ('legacy_receipt_fenced', SQLSTATE 55000).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_c3c_protected_mutation_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_state TEXT;
BEGIN
  SELECT status INTO v_state FROM public.ordem_compra_cutover WHERE id = 1;
  IF v_state IS NULL OR v_state = 'legacy_active' THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;

  IF TG_TABLE_NAME = 'ordem_compra_item' THEN
    IF TG_OP = 'UPDATE'
       AND pg_trigger_depth() > 1
       AND NEW.id IS NOT DISTINCT FROM OLD.id
       AND NEW.ordem_id IS NOT DISTINCT FROM OLD.ordem_id
       AND NEW.material IS NOT DISTINCT FROM OLD.material
       AND NEW.cor_id IS NOT DISTINCT FROM OLD.cor_id
       AND NEW.cor_poliester IS NOT DISTINCT FROM OLD.cor_poliester
       AND NEW.kg_pedido IS NOT DISTINCT FROM OLD.kg_pedido THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'legacy_receipt_fenced' USING ERRCODE = '55000';
  END IF;

  IF TG_TABLE_NAME = 'ordem_compra' THEN
    IF TG_OP = 'UPDATE'
       AND pg_trigger_depth() > 1
       AND NEW.id IS NOT DISTINCT FROM OLD.id
       AND NEW.pedido_id IS NOT DISTINCT FROM OLD.pedido_id
       AND NEW.fornecedor_id IS NOT DISTINCT FROM OLD.fornecedor_id
       AND NEW.status_administrativo IS NOT DISTINCT FROM OLD.status_administrativo
       AND NEW.status_aceite IS NOT DISTINCT FROM OLD.status_aceite
       AND NEW.legado IS NOT DISTINCT FROM OLD.legado THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'legacy_receipt_fenced' USING ERRCODE = '55000';
  END IF;

  IF TG_TABLE_NAME IN ('saldo_fios', 'saldo_fios_op') THEN
    -- saldo_fios keeps EXACTLY the db/75 predicate: its writer
    -- trg_native_lancamento_derive_state is a trigger and reaches depth 2.
    -- saldo_fios_op additionally admits its canonical SECURITY DEFINER writer,
    -- which is a plain function and can never reach depth 2. The capability is
    -- transaction-local and is declared only by public.iniciar_producao_op.
    IF v_state = 'canonical_active'
       AND (pg_trigger_depth() > 1
            OR (TG_TABLE_NAME = 'saldo_fios_op'
                AND current_setting('app.saldo_fios_op_writer', true) = 'on')) THEN
      RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
    END IF;
    RAISE EXCEPTION 'legacy_receipt_fenced' USING ERRCODE = '55000';
  END IF;

  RAISE EXCEPTION 'legacy_receipt_fenced' USING ERRCODE = '55000';
END;
$$;

COMMENT ON FUNCTION public.trg_c3c_protected_mutation_guard() IS
  'db/75, corrected by db/120: C3C protected-mutation fence. Unchanged for ordem_compra, ordem_compra_item and saldo_fios. For saldo_fios_op it additionally admits the transaction-local capability app.saldo_fios_op_writer declared by the canonical writer public.iniciar_producao_op, because that writer is a plain SECURITY DEFINER function and can never satisfy pg_trigger_depth() > 1. The client-facing boundary remains the revoked grants of db/106b section 4.4 and the SECURITY INVOKER fence trg_fato_protegido_fence.';

-- ---------------------------------------------------------------------
-- 2. The canonical writer, declaring its capability around its own writes
--
-- Reproduced from the db/118 body. The ONLY textual changes are the two
-- set_config calls that bracket the DELETE + INSERT snapshot block.
-- Authorization, the lock protocol, the entry-state rule, the revision
-- check, the complete-adjustment rule, the ceiling revalidation, the
-- snapshot arithmetic, the status transition and the Pedido recomputation
-- are unchanged.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.iniciar_producao_op(
  p_op_id           BIGINT,
  p_base_ajuste_rev INTEGER
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_pedido_id UUID;
  v_status    TEXT;
  v_rev       INTEGER;
  v_pendentes INTEGER;
  v_eixo      RECORD;
  v_teto      NUMERIC(12,3);
  v_propria   NUMERIC(12,3);
  v_transicao JSONB;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'sem_permissao' USING ERRCODE = '42501';
  END IF;

  SELECT lt.pedido_id INTO v_pedido_id
    FROM public.ops o
    JOIN public.lotes lt ON lt.id = o.lote_id
   WHERE o.id = p_op_id;
  IF v_pedido_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'INICIO_OP_SEM_PEDIDO');
  END IF;

  BEGIN
    SET LOCAL lock_timeout = '5s';
    PERFORM 1 FROM public.pedidos WHERE id = v_pedido_id FOR UPDATE;
    PERFORM 1 FROM public.ops o
      JOIN public.lotes lt ON lt.id = o.lote_id
     WHERE lt.pedido_id = v_pedido_id
     ORDER BY o.id
       FOR UPDATE OF o;
    PERFORM 1 FROM public.op_itens oi
     WHERE oi.op_id = p_op_id
     ORDER BY oi.id
       FOR UPDATE;
  EXCEPTION WHEN lock_not_available THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'concorrencia_ocupada');
  END;

  SELECT o.status, o.ajuste_revisao INTO v_status, v_rev
    FROM public.ops o WHERE o.id = p_op_id;

  IF EXISTS (SELECT 1 FROM public.pedidos WHERE id = v_pedido_id AND status = 'cancelado') THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'PEDIDO_CANCELADO');
  END IF;

  -- The transition matrix owns the entry state: production starts from an
  -- OPEN OP. Opening a simulated OP stays an explicit operator action
  -- through the existing alterar_status_op; this release does not widen it.
  IF v_status <> 'aberta' THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'INICIO_OP_ESTADO_INVALIDO',
                              'status', v_status);
  END IF;

  IF p_base_ajuste_rev IS DISTINCT FROM v_rev THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'AJUSTE_REVISAO_DESATUALIZADA',
                              'ajuste_revisao_atual', v_rev);
  END IF;

  -- Every item must carry a saved adjustment.
  SELECT count(*) INTO v_pendentes
    FROM public.op_itens WHERE op_id = p_op_id AND metros_ajustados IS NULL;
  IF v_pendentes > 0 THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'INICIO_AJUSTE_INCOMPLETO',
                              'itens_sem_ajuste', v_pendentes);
  END IF;

  -- REVALIDATE AVAILABILITY: a receipt reversal may have lowered a
  -- ceiling since the adjustment was saved (9.9.D). A reversal of a
  -- SURPLUS line lowers it too, with the correct sign, because the
  -- reversal carries a negative kg_excesso (db/118).
  FOR v_eixo IN
    SELECT DISTINCT d.origem_tipo, d.material, d.cor_id, d.cor_poliester
      FROM public._oc_disponibilidade_linhas(p_op_id) d
  LOOP
    v_teto := public._oc_teto_disponivel(
      v_pedido_id, p_op_id, v_eixo.origem_tipo, v_eixo.material,
      v_eixo.cor_id, v_eixo.cor_poliester);

    SELECT r.kg_reservado + r.kg_comprometido INTO v_propria
      FROM public._oc_reserva_ativa(v_pedido_id, v_eixo.material, v_eixo.cor_id,
                                    v_eixo.cor_poliester, NULL, p_op_id) r;

    IF v_propria > v_teto THEN
      RETURN jsonb_build_object(
        'ok', false, 'codigo', 'AJUSTE_EXCEDE_DISPONIVEL',
        'material', v_eixo.material, 'cor_id', v_eixo.cor_id,
        'cor_poliester', v_eixo.cor_poliester,
        'kg_reservado', v_propria, 'kg_disponivel', v_teto);
    END IF;
  END LOOP;

  -- THE AUTHORITATIVE START SNAPSHOT. One writer only, this function.
  --
  -- db/120: declare the transaction-local capability the db/75 fence reads.
  -- It is set immediately before the snapshot block and cleared immediately
  -- after, so no other statement in this function — and no statement in any
  -- caller's transaction — ever runs while it is on.
  PERFORM set_config('app.saldo_fios_op_writer', 'on', true);

  DELETE FROM public.saldo_fios_op WHERE op_id = p_op_id;
  FOR v_eixo IN
    SELECT DISTINCT d.origem_tipo, d.material, d.cor_id, d.cor_poliester
      FROM public._oc_disponibilidade_linhas(p_op_id) d
  LOOP
    v_teto := public._oc_teto_disponivel(
      v_pedido_id, p_op_id, v_eixo.origem_tipo, v_eixo.material,
      v_eixo.cor_id, v_eixo.cor_poliester);
    SELECT r.kg_reservado + r.kg_comprometido INTO v_propria
      FROM public._oc_reserva_ativa(v_pedido_id, v_eixo.material, v_eixo.cor_id,
                                    v_eixo.cor_poliester, NULL, p_op_id) r;

    INSERT INTO public.saldo_fios_op (op_id, cor_id, cor_poliester, tipo, kg_sobra)
    VALUES (p_op_id, v_eixo.cor_id, v_eixo.cor_poliester, v_eixo.material,
            GREATEST(0, v_teto - v_propria)::NUMERIC(10,3));
  END LOOP;

  PERFORM set_config('app.saldo_fios_op_writer', 'off', true);

  -- TRANSITION THE OP AND RECOMPUTE THE PEDIDO, ATOMICALLY.
  v_transicao := public._op_status_aplicar(p_op_id, 'em_producao',
                                           'Producao iniciada pelo writer canonico.');
  IF NOT COALESCE((v_transicao ->> 'ok')::BOOLEAN, FALSE) THEN
    RETURN jsonb_build_object('ok', false, 'codigo',
                              COALESCE(v_transicao ->> 'codigo', 'OP_TRANSICAO_INVALIDA'));
  END IF;

  UPDATE public.ops SET ajuste_revisao = ajuste_revisao + 1 WHERE id = p_op_id;
  v_rev := v_rev + 1;

  INSERT INTO public.op_eventos (op_id, tipo_evento, observacao, payload, criado_por)
  VALUES (p_op_id, 'producao_iniciada',
          'Producao iniciada; snapshot de saldo registrado.',
          jsonb_build_object('ajuste_revisao', v_rev, 'pedido_id', v_pedido_id),
          auth.uid());

  -- Derived Pedido transition. _pedido_status_recalcular is the OWNER-ONLY
  -- authority declared by db/105 (9.9.L).
  PERFORM public._pedido_status_recalcular(v_pedido_id, 'inicio_producao_op');

  RETURN jsonb_build_object(
    'ok', true, 'op_id', p_op_id, 'ajuste_revisao', v_rev,
    'proxima_acao', jsonb_build_object(
      'rota', '#/ops/' || p_op_id,
      'rotulo', 'Acompanhar producao'));
END;
$$;

COMMENT ON FUNCTION public.iniciar_producao_op(BIGINT, INTEGER) IS
  'db/102 (9.9.D), ceiling corrected by db/118, fence capability added by db/120: server-owned production start. Locks in the global order, proves every item carries an adjustment, REVALIDATES availability against public._oc_teto_disponivel, declares the transaction-local capability app.saldo_fios_op_writer around the authoritative saldo_fios_op start snapshot (sole writer), transitions the OP through _op_status_aplicar and recomputes the Pedido through _pedido_status_recalcular — all in one transaction.';

-- ---------------------------------------------------------------------
-- 3. Ownership and privileges — RESTATED IDENTICALLY, never widened
--
-- CREATE OR REPLACE preserves the existing ACL; these statements restate
-- the db/75, db/102 and db/118 posture so a replacement can never silently
-- inherit Supabase's authenticated-by-default grant.
-- ---------------------------------------------------------------------
ALTER FUNCTION public.trg_c3c_protected_mutation_guard()          OWNER TO postgres;
ALTER FUNCTION public.iniciar_producao_op(BIGINT, INTEGER)        OWNER TO postgres;

REVOKE ALL ON FUNCTION public.trg_c3c_protected_mutation_guard()
  FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.iniciar_producao_op(BIGINT, INTEGER)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.iniciar_producao_op(BIGINT, INTEGER) TO authenticated;

-- ---------------------------------------------------------------------
-- 4. Verification — behavioural, not textual
--
-- Every probe below runs inside a nested block whose own RAISE unwinds the
-- subtransaction, so NO row is added to, changed in or removed from any
-- business table by this section.
-- ---------------------------------------------------------------------
DO $verify$
DECLARE
  v_bad     TEXT[] := ARRAY[]::TEXT[];
  v_op      BIGINT;
  v_cor     BIGINT;
  v_ss      TEXT;
  v_state   TEXT;
  v_rows_before BIGINT;
  v_rows_after  BIGINT;
BEGIN
  SELECT status INTO v_state FROM public.ordem_compra_cutover WHERE id = 1;
  SELECT count(*) INTO v_rows_before FROM public.saldo_fios_op;

  SELECT o.id INTO v_op FROM public.ops o ORDER BY o.id LIMIT 1;
  SELECT c.id INTO v_cor FROM public.cores c ORDER BY c.id LIMIT 1;

  IF v_op IS NULL OR v_cor IS NULL THEN
    RAISE NOTICE 'db/120: no ops/cores row available; behavioural probes skipped';
  ELSIF v_state IS NULL OR v_state = 'legacy_active' THEN
    RAISE NOTICE 'db/120: cutover is not canonical_active; fence is inert by design, probes skipped';
  ELSE
    -- 4.1 WITHOUT the capability the fence must still refuse (55000).
    BEGIN
      PERFORM set_config('app.saldo_fios_op_writer', 'off', true);
      INSERT INTO public.saldo_fios_op (op_id, cor_id, cor_poliester, tipo, kg_sobra)
      VALUES (v_op, v_cor, NULL, 'algodao', 0);
      v_ss := 'NO_REFUSAL';
      RAISE EXCEPTION 'db120_unwind' USING ERRCODE = '22000';
    EXCEPTION
      WHEN SQLSTATE '22000' THEN NULL;
      WHEN SQLSTATE '55000' THEN v_ss := '55000';
    END;
    IF v_ss IS DISTINCT FROM '55000' THEN
      v_bad := array_append(v_bad,
        'saldo_fios_op accepted a write WITHOUT the capability; the fence was widened');
    END IF;

    -- 4.2 WITH the capability the canonical writer must be admitted.
    v_ss := NULL;
    BEGIN
      PERFORM set_config('app.saldo_fios_op_writer', 'on', true);
      INSERT INTO public.saldo_fios_op (op_id, cor_id, cor_poliester, tipo, kg_sobra)
      VALUES (v_op, v_cor, NULL, 'algodao', 0);
      v_ss := 'ADMITTED';
      RAISE EXCEPTION 'db120_unwind' USING ERRCODE = '22000';
    EXCEPTION
      WHEN SQLSTATE '22000' THEN NULL;
      WHEN SQLSTATE '55000' THEN v_ss := '55000';
    END;
    PERFORM set_config('app.saldo_fios_op_writer', 'off', true);
    IF v_ss IS DISTINCT FROM 'ADMITTED' THEN
      v_bad := array_append(v_bad,
        format('saldo_fios_op still refuses the canonical writer WITH the capability (got %s)',
               COALESCE(v_ss, 'null')));
    END IF;

    -- 4.3 saldo_fios must NOT have gained the capability allowance. The exact
    -- SQLSTATE is required: any other error would mask a real widening.
    v_ss := NULL;
    BEGIN
      PERFORM set_config('app.saldo_fios_op_writer', 'on', true);
      INSERT INTO public.saldo_fios (cor_id, cor_poliester, tipo, kg_total)
      VALUES (v_cor, NULL, 'algodao', 0);
      v_ss := 'NO_REFUSAL';
      RAISE EXCEPTION 'db120_unwind' USING ERRCODE = '22000';
    EXCEPTION
      WHEN SQLSTATE '22000' THEN NULL;
      WHEN OTHERS THEN GET STACKED DIAGNOSTICS v_ss = RETURNED_SQLSTATE;
    END;
    PERFORM set_config('app.saldo_fios_op_writer', 'off', true);
    IF v_ss IS DISTINCT FROM '55000' THEN
      v_bad := array_append(v_bad,
        'saldo_fios accepted a write with the saldo_fios_op capability; the allowance leaked');
    END IF;
  END IF;

  -- 4.4 ACL must be exactly the db/102/db/118 posture.
  IF NOT has_function_privilege('authenticated', 'public.iniciar_producao_op(bigint,integer)', 'EXECUTE') THEN
    v_bad := array_append(v_bad, 'iniciar_producao_op lost EXECUTE for authenticated');
  END IF;
  IF has_function_privilege('anon',         'public.iniciar_producao_op(bigint,integer)', 'EXECUTE')
     OR has_function_privilege('service_role', 'public.iniciar_producao_op(bigint,integer)', 'EXECUTE') THEN
    v_bad := array_append(v_bad, 'iniciar_producao_op became reachable by anon or service_role');
  END IF;
  IF has_function_privilege('anon',          'public.trg_c3c_protected_mutation_guard()', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.trg_c3c_protected_mutation_guard()', 'EXECUTE')
     OR has_function_privilege('service_role',  'public.trg_c3c_protected_mutation_guard()', 'EXECUTE') THEN
    v_bad := array_append(v_bad, 'the C3C fence became reachable by a client role');
  END IF;

  -- 4.5 The client mutation revocations of db/106b section 4.4 still hold.
  IF EXISTS (
    SELECT 1 FROM information_schema.role_table_grants
     WHERE table_schema = 'public' AND table_name = 'saldo_fios_op'
       AND grantee IN ('authenticated', 'anon', 'service_role')
       AND privilege_type IN ('INSERT', 'UPDATE', 'DELETE')
  ) THEN
    v_bad := array_append(v_bad, 'public.saldo_fios_op regained a client mutation grant');
  END IF;

  -- 4.6 Nothing was persisted by this migration.
  SELECT count(*) INTO v_rows_after FROM public.saldo_fios_op;
  IF v_rows_after <> v_rows_before THEN
    v_bad := array_append(v_bad,
      format('saldo_fios_op row count changed: before=%s after=%s', v_rows_before, v_rows_after));
  END IF;

  IF array_length(v_bad, 1) IS NOT NULL THEN
    RAISE EXCEPTION 'db/120 verification failed: %', array_to_string(v_bad, '; ');
  END IF;

  RAISE NOTICE 'db/120 verified: fence refuses without the capability, admits the canonical writer with it, saldo_fios unchanged, ACL unchanged, % row(s) in saldo_fios_op', v_rows_after;
END
$verify$;
