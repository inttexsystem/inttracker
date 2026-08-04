-- =============================================================================
-- db/129 — TECELAGEM V1: ESTADO DE IMPRESSÃO DA ETIQUETA DO ROLO
-- =============================================================================
-- ORDER: TECELAGEM-V1-CONSOLIDATED-UI-FIXES (R3 / ASSURANCE).
--
-- PRODUCT REQUIREMENT BEING SATISFIED
-- The operator must be able to tell, at a glance on the compact roll view,
-- whether a roll's OWN IDENTIFICATION LABEL has already been printed. That is
-- a fact about the physical world — a piece of paper exists and is attached to
-- a roll — so it cannot be inferred and cannot live in the browser: it is
-- persisted here and survives a reload and a later session.
--
-- WHAT THIS IS NOT
--   - it is NOT the FINISHING label (etiqueta de acabamento). That label
--     belongs to the OP product, not to a roll, and printing it must leave
--     this state untouched. The two are separate product concepts and this
--     migration deliberately gives only the roll label a state;
--   - it is NOT inferred from the roll existing, from its situation, or from
--     any registration event. A roll that was never printed reads as never
--     printed, forever, until someone actually prints it;
--   - it is NOT a lifecycle state. It never gates production, output,
--     deletion or undo, and no writer anywhere reads it to decide anything.
--
-- WHY A TIMESTAMP AND NOT A BOOLEAN
-- Same shape as db/125's enviado_acabamento_em: WHEN a label was first printed
-- is recoverable evidence that nothing else in the schema records, and a
-- boolean throws it away for no saving. NULL means never printed, and that is
-- the only meaning it carries.
--
-- FIRST PRINT WINS. Reprinting is a normal, frequent operator act — a label
-- tears, smudges or is lost — and it must not rewrite history to say the label
-- is newer than it is. The writer therefore sets the moment ONLY when it is
-- still NULL, which also makes it idempotent: printing the same roll ten times
-- produces one moment and nine no-ops.
--
-- THE STATE IS VISIBLE FOR EVERY ROLL, WHATEVER ITS SITUATION. A roll already
-- sent to finishing may perfectly well have had its identification label
-- printed while it was still in weaving, so this writer deliberately does NOT
-- gate on `na_tecelagem`. It is the only weaving writer with no situation
-- gate, and that is intentional: printing a label is not a state transition.
--
-- ISOLATION CONTRACT unchanged: this ALTERs only public.tecelagem_rolos (one
-- new nullable column), creates one writer, installs no trigger, changes no
-- RLS policy, grants nothing to anon or service_role, and writes no Admin
-- table, Pedido, expedition, romaneio or finishing record.
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

  IF array_length(v_missing, 1) IS NOT NULL THEN
    RAISE EXCEPTION 'db/129 entry gate: missing prerequisite object(s): %',
      array_to_string(v_missing, ', ');
  END IF;
END
$gate$;

-- ---------------------------------------------------------------------
-- 1. The state. NULL until a label is actually printed — never backfilled,
--    because there is no evidence about rolls printed before this column
--    existed and inventing some would be inventing a fact about paper.
-- ---------------------------------------------------------------------
ALTER TABLE public.tecelagem_rolos
  ADD COLUMN IF NOT EXISTS etiqueta_impressa_em  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS etiqueta_impressa_por UUID REFERENCES auth.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.tecelagem_rolos.etiqueta_impressa_em IS
  'db/129. Moment the roll''s OWN identification label was FIRST printed. NULL means never printed. Set only by marcar_etiquetas_rolo_impressas, never backfilled, never reset, and never inferred from the roll existing. Unrelated to the finishing label, which belongs to the OP product and has no roll-level state.';
COMMENT ON COLUMN public.tecelagem_rolos.etiqueta_impressa_por IS
  'db/129. auth.uid() of the operator who FIRST printed this roll''s label, or NULL if never printed or if that identity was later removed.';

-- ---------------------------------------------------------------------
-- 2. THE WRITER — validates completely, then applies.
--
-- Takes an ARRAY because the operator prints a SELECTION: the compact roll
-- view prints the rolls currently selected, and the post-registration label
-- sheet prints the whole batch that was just created.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.marcar_etiquetas_rolo_impressas(p_rolo_ids BIGINT[])
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $fn$
DECLARE
  v_fornecedor_id BIGINT;
  v_ids           BIGINT[];
  v_quantidade    INTEGER;
  v_encontrados   INTEGER;
  v_marcados      INTEGER;
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

  v_ids := ARRAY(SELECT DISTINCT x FROM unnest(p_rolo_ids) AS x ORDER BY x);
  v_quantidade := array_length(v_ids, 1);

  -- Every id must exist AND belong to this supplier, exactly as db/125 and
  -- db/128 require. A roll that is not this supplier's refuses the whole call.
  SELECT count(*) INTO v_encontrados
    FROM public.tecelagem_rolos r
   WHERE r.id = ANY(v_ids) AND r.fornecedor_id = v_fornecedor_id;

  IF v_encontrados <> v_quantidade THEN
    RAISE EXCEPTION 'TECELAGEM_ROLO_FORA_DO_ESCOPO_DO_FORNECEDOR'
      USING ERRCODE = '42501',
            DETAIL  = 'one or more rolls do not belong to the calling supplier';
  END IF;

  -- DELIBERATELY NO SITUATION GATE. Printing an identification label is not a
  -- state transition, and a roll already sent to finishing may legitimately
  -- have had its label printed. See the header.

  -- === APPLY STAGE ===

  -- FIRST PRINT WINS: the moment is set only where it is still NULL, so a
  -- reprint is a no-op rather than a rewrite of when the label came into
  -- existence. This is what makes the writer idempotent.
  UPDATE public.tecelagem_rolos r
     SET etiqueta_impressa_em = now(),
         etiqueta_impressa_por = auth.uid()
   WHERE r.id = ANY(v_ids)
     AND r.fornecedor_id = v_fornecedor_id
     AND r.etiqueta_impressa_em IS NULL;

  GET DIAGNOSTICS v_marcados = ROW_COUNT;

  RETURN jsonb_build_object(
    'rolo_ids',   v_ids,
    'solicitados', v_quantidade,
    -- Rolls newly marked by THIS call. Lower than `solicitados` whenever some
    -- were already printed, which is a normal reprint, not a failure.
    'marcados',   v_marcados
  );
END
$fn$;

ALTER FUNCTION public.marcar_etiquetas_rolo_impressas(BIGINT[]) OWNER TO postgres;

REVOKE ALL ON FUNCTION public.marcar_etiquetas_rolo_impressas(BIGINT[])
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.marcar_etiquetas_rolo_impressas(BIGINT[]) TO authenticated;

COMMENT ON FUNCTION public.marcar_etiquetas_rolo_impressas(BIGINT[]) IS
  'db/129. THE ONLY write path for the roll-label print state. Idempotent: sets the moment only where it is still NULL, so a reprint keeps the first-print moment. No situation gate — printing a label is not a state transition. Creates no roll, mutates no production, and touches no Admin table.';

-- ---------------------------------------------------------------------
-- 3. Verify — self-proving, in the same transaction as the migration
-- ---------------------------------------------------------------------
DO $verify$
DECLARE
  v_bad TEXT[] := ARRAY[]::TEXT[];
BEGIN
  -- 3.1 The column exists and is NULLABLE: never printed is a first-class,
  --     permanent state, not a default that quietly reads as printed.
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'tecelagem_rolos'
       AND column_name = 'etiqueta_impressa_em' AND is_nullable = 'YES'
  ) THEN
    v_bad := array_append(v_bad, 'tecelagem_rolos.etiqueta_impressa_em is missing or is not nullable');
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'tecelagem_rolos'
       AND column_name = 'etiqueta_impressa_em' AND column_default IS NOT NULL
  ) THEN
    v_bad := array_append(v_bad, 'etiqueta_impressa_em carries a default; print state must never be inferred');
  END IF;

  -- 3.2 The writer exists, is SECURITY DEFINER and reaches only authenticated.
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = 'marcar_etiquetas_rolo_impressas' AND p.prosecdef IS TRUE
  ) THEN
    v_bad := array_append(v_bad, 'marcar_etiquetas_rolo_impressas is missing or is not SECURITY DEFINER');
  END IF;

  IF has_function_privilege('anon', 'public.marcar_etiquetas_rolo_impressas(bigint[])', 'EXECUTE')
     OR has_function_privilege('service_role', 'public.marcar_etiquetas_rolo_impressas(bigint[])', 'EXECUTE') THEN
    v_bad := array_append(v_bad, 'the label-print writer is executable by anon or service_role');
  END IF;

  IF NOT has_function_privilege('authenticated', 'public.marcar_etiquetas_rolo_impressas(bigint[])', 'EXECUTE') THEN
    v_bad := array_append(v_bad, 'the label-print writer is not executable by authenticated');
  END IF;

  -- 3.3 FIRST PRINT WINS is in the body, not only in the prose.
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = 'marcar_etiquetas_rolo_impressas'
       AND p.prosrc LIKE '%etiqueta_impressa_em IS NULL%'
  ) THEN
    v_bad := array_append(v_bad, 'the label-print writer does not preserve the FIRST print moment on reprint');
  END IF;

  -- 3.4 IT IS NOT A LIFECYCLE STATE. No other weaving writer may read it to
  --     decide anything — that is what keeps it a pure annotation.
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.proname IN ('registrar_producao_tecelagem', 'enviar_rolos_acabamento',
                         'excluir_rolo_tecelagem', 'excluir_rolos_tecelagem',
                         'desfazer_lancamento_tecelagem', '_tecelagem_rolo_pode_excluir',
                         '_tecelagem_lancamento_pode_desfazer')
       AND p.prosrc ILIKE '%etiqueta_impressa%'
  ) THEN
    v_bad := array_append(v_bad, 'a production/output/deletion writer reads the label-print state; it must gate nothing');
  END IF;

  -- 3.5 The writer creates no roll and mutates no production.
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = 'marcar_etiquetas_rolo_impressas'
       AND (p.prosrc ~* 'insert\s+into\s+(public\.)?tecelagem_rolos\M'
            OR p.prosrc ~* 'delete\s+from\s+(public\.)?tecelagem'
            OR p.prosrc ~* '(update|insert into|delete from)\s+(public\.)?(ops|op_itens|lotes|pedidos|expedicoes|romaneios|entrega_itens)\M')
  ) THEN
    v_bad := array_append(v_bad, 'marcar_etiquetas_rolo_impressas creates a roll or reaches an Admin table');
  END IF;

  -- 3.6 It must NOT touch situacao: printing a label is not a transition.
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = 'marcar_etiquetas_rolo_impressas'
       AND p.prosrc ~* 'set[^;]*\msituacao\s*='
  ) THEN
    v_bad := array_append(v_bad, 'the label-print writer changes situacao; printing a label is not a state transition');
  END IF;

  -- 3.7 Every accepted neighbour survives, and no direct write grant appeared.
  IF to_regprocedure('public.excluir_rolos_tecelagem(bigint[])') IS NULL
     OR to_regprocedure('public.desfazer_lancamento_tecelagem(bigint)') IS NULL
     OR to_regprocedure('public.enviar_rolos_acabamento(bigint[])') IS NULL THEN
    v_bad := array_append(v_bad, 'an accepted weaving writer disappeared');
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.role_table_grants
     WHERE table_schema = 'public' AND table_name = 'tecelagem_rolos'
       AND privilege_type IN ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE')
       AND grantee IN ('PUBLIC', 'anon', 'authenticated', 'service_role')
  ) THEN
    v_bad := array_append(v_bad, 'a direct write grant survives on tecelagem_rolos');
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_trigger tg JOIN pg_class c ON c.oid = tg.tgrelid
     WHERE NOT tg.tgisinternal AND c.relname LIKE 'tecelagem_%'
  ) THEN
    v_bad := array_append(v_bad, 'a weaving table carries a trigger');
  END IF;

  IF array_length(v_bad, 1) IS NOT NULL THEN
    RAISE EXCEPTION 'db/129 verify FAILED: %', array_to_string(v_bad, ' | ');
  END IF;

  RAISE NOTICE 'db/129 verify: OK — the roll label carries a persisted first-print moment, reprinting preserves it, it gates nothing, and no production writer reads it';
END
$verify$;
