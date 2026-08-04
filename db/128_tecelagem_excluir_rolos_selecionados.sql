-- =============================================================================
-- db/128 — TECELAGEM V1: EXCLUIR OS ROLOS SELECIONADOS (LOTE DE SELEÇÃO)
-- =============================================================================
-- ORDER: TECELAGEM-V1-DENSITY-AND-SELECTION-UX (R3 / ASSURANCE).
--
-- PRODUCT REQUIREMENT BEING SATISFIED
-- The compact roll view lets the operator select several physical rolls at once,
-- so the accepted single-roll deletion (db/127) is expanded to one operator
-- action over a SELECTION. This is the deletion counterpart of db/125's
-- enviar_rolos_acabamento, which already takes a roll-id array.
--
-- WHY A NEW WRITER AND NOT N CALLS FROM THE SCREEN
-- Calling excluir_rolo_tecelagem once per selected roll would create exactly
-- the partial-apply path every writer in this domain refuses: three of five
-- deletions succeeding and the fourth failing would leave the operator with a
-- half-applied action and no way to know which half. This writer VALIDATES THE
-- WHOLE SELECTION AND ONLY THEN APPLIES — five selected rolls are five deleted
-- rolls or an error, never two.
--
-- db/127's single-roll writer is PRESERVED, unchanged and still granted: it
-- remains the owner of the one-roll case and is what this migration's own
-- verify block asserts still exists.
--
-- EVERY RATIFIED RULE IS UNCHANGED — this migration adds cardinality, not
-- semantics:
--   - only a roll still `na_tecelagem` may go, via the SAME single owner
--     _tecelagem_rolo_pode_excluir (db/127). The rule is not restated here;
--   - surviving rolls are NEVER renumbered and the per-OP allocator is NEVER
--     rewound, so a number freed by deletion is never reissued (db/127);
--   - a batch's declared quantidade_rolos keeps matching the rolls that remain,
--     and a batch whose last roll goes is removed rather than left orphaned;
--   - no finishing movement is reversed, and an already-sent roll is refused.
--
-- REFUSAL IS ALL-OR-NOTHING, NEVER A SILENT NARROWING. Same discipline as
-- db/125: a selection containing one ineligible roll refuses the WHOLE call
-- rather than quietly deleting the eligible remainder. Silently narrowing would
-- let the operator believe rolls went that did not, or that rolls survived that
-- did not.
--
-- LOCK ORDER is db/127's, applied over the whole selection in a DETERMINISTIC
-- order: counter rows, then registration rows, then roll rows, each ordered by
-- id. Two concurrent multi-roll deletions with overlapping selections therefore
-- take their locks in the same sequence and cannot deadlock each other.
--
-- ISOLATION CONTRACT unchanged: no ALTER, no trigger, no RLS change, nothing
-- new for anon or service_role, and no Admin table, Pedido, expedition,
-- romaneio or finishing record is written.
-- =============================================================================

-- ---------------------------------------------------------------------
-- 0. Entry gate — refuse to run against an unexpected baseline
-- ---------------------------------------------------------------------
DO $gate$
DECLARE
  v_missing TEXT[] := ARRAY[]::TEXT[];
BEGIN
  IF to_regclass('public.tecelagem_rolos') IS NULL THEN
    v_missing := array_append(v_missing, 'public.tecelagem_rolos');
  END IF;
  IF to_regprocedure('public.meu_fornecedor_id()') IS NULL THEN
    v_missing := array_append(v_missing, 'public.meu_fornecedor_id()');
  END IF;
  -- The single owner of deletion eligibility must already exist: this
  -- migration adds cardinality over it and must never restate the rule.
  IF to_regprocedure('public._tecelagem_rolo_pode_excluir(bigint,bigint)') IS NULL THEN
    v_missing := array_append(v_missing, 'public._tecelagem_rolo_pode_excluir(bigint,bigint)');
  END IF;
  IF to_regprocedure('public.excluir_rolo_tecelagem(bigint)') IS NULL THEN
    v_missing := array_append(v_missing, 'public.excluir_rolo_tecelagem(bigint)');
  END IF;

  IF array_length(v_missing, 1) IS NOT NULL THEN
    RAISE EXCEPTION 'db/128 entry gate: missing prerequisite object(s): %',
      array_to_string(v_missing, ', ');
  END IF;
END
$gate$;

-- ---------------------------------------------------------------------
-- 1. THE WRITER — validates the whole selection, then applies.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.excluir_rolos_tecelagem(p_rolo_ids BIGINT[])
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $fn$
DECLARE
  v_fornecedor_id BIGINT;
  v_ids           BIGINT[];
  v_quantidade    INTEGER;
  v_recusa        TEXT;
  v_numeros       INTEGER[];
  v_removidos     INTEGER;
  v_lancamentos   BIGINT[];
  v_lotes_removidos INTEGER := 0;
BEGIN
  -- === VALIDATION STAGE — nothing is written before this stage completes ===

  v_fornecedor_id := public.meu_fornecedor_id();
  IF v_fornecedor_id IS NULL THEN
    RAISE EXCEPTION 'TECELAGEM_FORNECEDOR_NAO_IDENTIFICADO'
      USING ERRCODE = '42501',
            DETAIL  = 'the caller is not an active supplier user';
  END IF;

  IF p_rolo_ids IS NULL OR array_length(p_rolo_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'TECELAGEM_ROLOS_OBRIGATORIOS'
      USING ERRCODE = '22023',
            DETAIL  = 'at least one roll id is required';
  END IF;

  -- Defensive de-duplication, exactly as db/125 does: a repeated id in the
  -- input must not be counted twice against itself in the proofs below.
  v_ids := ARRAY(SELECT DISTINCT x FROM unnest(p_rolo_ids) AS x ORDER BY x);
  v_quantidade := array_length(v_ids, 1);

  -- LOCK 1 — every counter row of every OP touched by the selection, in id
  -- order. Locked, never modified: numbering is not rewound (db/127).
  PERFORM 1
    FROM public.tecelagem_rolo_sequencia s
   WHERE s.op_id IN (SELECT DISTINCT r.op_id FROM public.tecelagem_rolos r WHERE r.id = ANY(v_ids))
   ORDER BY s.op_id
     FOR UPDATE;

  -- LOCK 2 — every registration the selection touches, in id order.
  PERFORM 1
    FROM public.tecelagem_producao_lancamentos l
   WHERE l.id IN (SELECT DISTINCT r.lancamento_id FROM public.tecelagem_rolos r WHERE r.id = ANY(v_ids))
   ORDER BY l.id
     FOR UPDATE;

  -- LOCK 3 — the rolls themselves, in id order and BEFORE the eligibility
  -- check, so a finishing output racing this deletion cannot slip between the
  -- check and the delete.
  PERFORM 1
    FROM public.tecelagem_rolos r
   WHERE r.id = ANY(v_ids)
   ORDER BY r.id
     FOR UPDATE;

  -- EVERY selected roll must pass the SINGLE eligibility owner. The rule is
  -- not restated here: db/127 owns it, and a second copy would be free to
  -- drift from the first.
  SELECT public._tecelagem_rolo_pode_excluir(x, v_fornecedor_id)
    INTO v_recusa
    FROM unnest(v_ids) AS x
   WHERE public._tecelagem_rolo_pode_excluir(x, v_fornecedor_id) IS NOT NULL
   LIMIT 1;

  IF v_recusa = 'ROLO_FORA_DO_ESCOPO_DO_FORNECEDOR' THEN
    RAISE EXCEPTION 'TECELAGEM_ROLO_FORA_DO_ESCOPO_DO_FORNECEDOR'
      USING ERRCODE = '42501',
            DETAIL  = 'one or more selected rolls do not belong to the calling supplier';
  END IF;

  IF v_recusa = 'ROLO_JA_ENVIADO_AO_ACABAMENTO' THEN
    RAISE EXCEPTION 'TECELAGEM_ROLO_JA_ENVIADO'
      USING ERRCODE = '55000',
            DETAIL  = 'one or more selected rolls already left weaving for finishing; the whole selection was refused';
  END IF;

  IF v_recusa IS NOT NULL THEN
    RAISE EXCEPTION 'TECELAGEM_ROLO_NAO_ENCONTRADO'
      USING ERRCODE = '55000',
            DETAIL  = v_recusa;
  END IF;

  -- === APPLY STAGE — every refusal above has already been raised ===

  -- Captured before the delete: the operator's confirmation names the rolls
  -- that went, and nowhere else records them afterwards.
  SELECT array_agg(r.numero ORDER BY r.numero), array_agg(DISTINCT r.lancamento_id)
    INTO v_numeros, v_lancamentos
    FROM public.tecelagem_rolos r
   WHERE r.id = ANY(v_ids);

  DELETE FROM public.tecelagem_rolos r WHERE r.id = ANY(v_ids);
  GET DIAGNOSTICS v_removidos = ROW_COUNT;

  -- N validated rolls means exactly N deleted rows, or an error — never a
  -- silently partial deletion. Same proof db/125 and db/127 carry.
  IF v_removidos <> v_quantidade THEN
    RAISE EXCEPTION 'TECELAGEM_EXCLUSAO_CARDINALIDADE_INCONSISTENTE'
      USING ERRCODE = 'P0001',
            DETAIL  = format('validated %s roll(s) but deleted %s', v_quantidade, v_removidos);
  END IF;

  -- Each touched registration keeps its declared count equal to the rolls that
  -- actually remain; a registration left with none is removed rather than kept
  -- as an orphan (quantidade_rolos >= 1 makes it unrepresentable anyway).
  UPDATE public.tecelagem_producao_lancamentos l
     SET quantidade_rolos = sub.restantes
    FROM (
      SELECT l2.id, count(r.id)::INTEGER AS restantes
        FROM public.tecelagem_producao_lancamentos l2
        LEFT JOIN public.tecelagem_rolos r ON r.lancamento_id = l2.id
       WHERE l2.id = ANY(v_lancamentos)
       GROUP BY l2.id
    ) sub
   WHERE l.id = sub.id
     AND sub.restantes > 0
     AND l.quantidade_rolos <> sub.restantes;

  DELETE FROM public.tecelagem_producao_lancamentos l
   WHERE l.id = ANY(v_lancamentos)
     AND NOT EXISTS (SELECT 1 FROM public.tecelagem_rolos r WHERE r.lancamento_id = l.id);
  GET DIAGNOSTICS v_lotes_removidos = ROW_COUNT;

  -- tecelagem_rolo_sequencia is deliberately NOT touched (db/127): survivors
  -- keep their printed identities and a freed number is never reissued.

  RETURN jsonb_build_object(
    'rolo_ids',            v_ids,
    'numeros',             v_numeros,
    'rolos_removidos',     v_removidos,
    'lancamentos_removidos', v_lotes_removidos
  );
END
$fn$;

ALTER FUNCTION public.excluir_rolos_tecelagem(BIGINT[]) OWNER TO postgres;

REVOKE ALL ON FUNCTION public.excluir_rolos_tecelagem(BIGINT[])
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.excluir_rolos_tecelagem(BIGINT[]) TO authenticated;

COMMENT ON FUNCTION public.excluir_rolos_tecelagem(BIGINT[]) IS
  'db/128. THE ONLY write path for deleting a SELECTION of weaving rolls. Validates the whole selection through the db/127 eligibility owner, then applies: N selected rolls are N deleted rolls or an error, never a partial deletion. Surviving rolls are never renumbered and the per-OP allocator is never rewound. Keeps each touched batch count equal to its remaining rolls and removes a batch left with none. Touches no Admin table.';

-- ---------------------------------------------------------------------
-- 2. Verify — self-proving, in the same transaction as the migration
-- ---------------------------------------------------------------------
DO $verify$
DECLARE
  v_bad TEXT[] := ARRAY[]::TEXT[];
BEGIN
  -- 2.1 The writer exists, is SECURITY DEFINER and reaches only authenticated.
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = 'excluir_rolos_tecelagem' AND p.prosecdef IS TRUE
  ) THEN
    v_bad := array_append(v_bad, 'excluir_rolos_tecelagem is missing or is not SECURITY DEFINER');
  END IF;

  IF has_function_privilege('anon', 'public.excluir_rolos_tecelagem(bigint[])', 'EXECUTE')
     OR has_function_privilege('service_role', 'public.excluir_rolos_tecelagem(bigint[])', 'EXECUTE') THEN
    v_bad := array_append(v_bad, 'the selection-deletion writer is executable by anon or service_role');
  END IF;

  IF NOT has_function_privilege('authenticated', 'public.excluir_rolos_tecelagem(bigint[])', 'EXECUTE') THEN
    v_bad := array_append(v_bad, 'the selection-deletion writer is not executable by authenticated');
  END IF;

  -- 2.2 It DERIVES from the single eligibility owner instead of restating the
  --     safety rule as a second, driftable copy.
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = 'excluir_rolos_tecelagem'
       AND p.prosrc LIKE '%_tecelagem_rolo_pode_excluir%'
  ) THEN
    v_bad := array_append(v_bad, 'excluir_rolos_tecelagem does not derive from the single deletion eligibility owner');
  END IF;

  -- 2.3 NUMBERING IS IDENTITY: it must never UPDATE tecelagem_rolos (how a
  --     renumbering would have to be expressed) and never rewind the allocator.
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = 'excluir_rolos_tecelagem'
       AND p.prosrc ~* 'update\s+(public\.)?tecelagem_rolos\M'
  ) THEN
    v_bad := array_append(v_bad, 'excluir_rolos_tecelagem updates tecelagem_rolos; surviving rolls must never be renumbered');
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = 'excluir_rolos_tecelagem'
       AND p.prosrc ~* '(update|insert into)\s+(public\.)?tecelagem_rolo_sequencia\M'
  ) THEN
    v_bad := array_append(v_bad, 'excluir_rolos_tecelagem rewinds the roll allocator; a freed number must never be reissued');
  END IF;

  -- 2.4 Every accepted neighbour is PRESERVED, not replaced.
  IF to_regprocedure('public.excluir_rolo_tecelagem(bigint)') IS NULL
     OR NOT has_function_privilege('authenticated', 'public.excluir_rolo_tecelagem(bigint)', 'EXECUTE') THEN
    v_bad := array_append(v_bad, 'the db/127 single-roll deletion no longer exists or is no longer reachable');
  END IF;

  IF to_regprocedure('public.desfazer_lancamento_tecelagem(bigint)') IS NULL
     OR NOT has_function_privilege('authenticated', 'public.desfazer_lancamento_tecelagem(bigint)', 'EXECUTE') THEN
    v_bad := array_append(v_bad, 'the db/126 batch undo no longer exists or is no longer reachable');
  END IF;

  IF to_regprocedure('public.enviar_rolos_acabamento(bigint[])') IS NULL
     OR NOT has_function_privilege('authenticated', 'public.enviar_rolos_acabamento(bigint[])', 'EXECUTE') THEN
    v_bad := array_append(v_bad, 'the db/125 finishing-output writer no longer exists or is no longer reachable');
  END IF;

  -- 2.5 ISOLATION PROOF, asserted against the function body rather than prose.
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = 'excluir_rolos_tecelagem'
       AND (p.prosrc ~* '(update|insert into|delete from)\s+(public\.)?(ops|op_itens|lotes|pedidos|expedicoes|romaneios|entrega_itens)\M'
            OR p.prosrc ILIKE '%iniciar_producao_op%'
            OR p.prosrc ILIKE '%alterar_status_op%'
            OR p.prosrc ILIKE '%abrir_op_tecelagem%'
            OR p.prosrc ILIKE '%gerar_op_latex%')
  ) THEN
    v_bad := array_append(v_bad, 'excluir_rolos_tecelagem reaches an Admin table or an Admin lifecycle writer');
  END IF;

  -- 2.6 No direct write grant and no trigger on the weaving tables.
  IF EXISTS (
    SELECT 1 FROM information_schema.role_table_grants
     WHERE table_schema = 'public'
       AND table_name IN ('tecelagem_rolos', 'tecelagem_producao_lancamentos',
                          'tecelagem_rolo_sequencia', 'tecelagem_op_execucao')
       AND privilege_type IN ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE')
       AND grantee IN ('PUBLIC', 'anon', 'authenticated', 'service_role')
  ) THEN
    v_bad := array_append(v_bad, 'a direct write grant survives on a weaving table');
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_trigger tg JOIN pg_class c ON c.oid = tg.tgrelid
     WHERE NOT tg.tgisinternal AND c.relname LIKE 'tecelagem_%'
  ) THEN
    v_bad := array_append(v_bad, 'a weaving table carries a trigger; weaving must not propagate anywhere');
  END IF;

  IF array_length(v_bad, 1) IS NOT NULL THEN
    RAISE EXCEPTION 'db/128 verify FAILED: %', array_to_string(v_bad, ' | ');
  END IF;

  RAISE NOTICE 'db/128 verify: OK — a selection of rolls is deleted as one all-or-nothing action through the db/127 eligibility owner, survivors keep their printed numbers, batch counts stay honest, and db/125/db/126/db/127 are preserved';
END
$verify$;
