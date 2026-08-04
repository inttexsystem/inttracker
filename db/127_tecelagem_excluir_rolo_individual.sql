-- =============================================================================
-- db/127 — TECELAGEM V1: EXCLUIR UM ROLO INDIVIDUAL
-- =============================================================================
-- ORDER: TECELAGEM-V1-INDIVIDUAL-ROLL-DELETION (R3 / ASSURANCE).
--
-- PRODUCT REQUIREMENT BEING SATISFIED
-- db/126 gave the operator a way to reverse a whole production registration.
-- That is the right tool for a mistyped BATCH, and the wrong one for a single
-- roll registered by mistake: undoing five rolls to correct one is not a
-- correction, it is a second mistake. This migration adds the missing
-- granularity.
--
-- THE PRODUCT NOW HAS TWO DISTINCT, INDEPENDENT CORRECTIONS
--
--   EXCLUIR ROLO         removes ONE erroneous physical roll.
--   DESFAZER LANÇAMENTO  reverses the COMPLETE batch (db/126, unchanged).
--
-- Neither is expressed in terms of the other, and this migration changes
-- nothing about db/126's writer, its eligibility owner or its read model.
--
-- THE ONE RATIFIED SAFETY RULE (identical in shape to db/126)
-- A roll may be deleted only while it is still safely reversible. Once it has
-- left weaving for finishing it is refused, and NO finishing movement is
-- reversed automatically in this phase. As in db/126 the predicate is written
-- `situacao <> 'na_tecelagem'` rather than `= 'enviado_acabamento'`, so a
-- FUTURE roll situation is refused by default instead of being silently
-- assumed reversible. The refusal lives in the SERVER: the row action the
-- screen omits is a convenience, never the defense.
--
-- NUMBERING IS IDENTITY — THE COUNTER IS DELIBERATELY NOT REWOUND
-- This is the load-bearing difference from db/126 and it is a ratified product
-- rule, not an implementation shortcut:
--
--     001 002 003 004 005   -- delete 003
--     001 002 _   004 005   -- the survivors keep their own numbers
--
-- Surviving rolls are NEVER renumbered, because the number is printed on a
-- physical label already attached to a physical roll: renumbering would make
-- the database disagree with the warehouse. For the same reason the per-OP
-- allocator (tecelagem_rolo_sequencia) is left strictly monotonic and is NOT
-- rewound here. Rewinding it would be actively harmful in one specific case —
-- deleting the HIGHEST roll of an OP would free that number for reuse, and a
-- later registration would mint a second "Rolo 005" for a different physical
-- roll whose label already exists. A permanent gap is the correct outcome.
--
-- db/126 rewinds and this does not, and the two are consistent: undoing a
-- whole batch asserts the batch NEVER HAPPENED, so its numbers were never
-- issued; deleting one roll asserts a real batch contained one wrong roll, so
-- every other number it issued stands.
--
-- KEEPING THE BATCH RECORD HONEST
-- tecelagem_producao_lancamentos.quantidade_rolos is a DECLARED count. Leaving
-- it at 5 while only 4 rolls exist would be exactly the phantom count the
-- order forbids, and it would also break db/126's undo, whose cardinality
-- self-check compares the declared count against the rolls actually found.
-- The declared count is therefore decremented in the same transaction.
--
-- DELETING THE LAST SURVIVING ROLL REMOVES THE BATCH ROW TOO. The column is
-- constrained `quantidade_rolos >= 1`, so a zero-roll registration cannot even
-- be represented — and a batch event that describes no roll at all is precisely
-- an orphan reference. This does not weaken the rule that deleting one roll
-- must not delete the others: in that case there are no others.
--
-- LOCK ORDER (deadlock-free by construction)
-- Counter row, then registration row, then the roll — the SAME order db/126
-- takes, so the batch undo and an individual deletion serialize instead of
-- deadlocking. registrar_producao_tecelagem (db/123) takes the counter first
-- and then only INSERTs; enviar_rolos_acabamento (db/125) takes only roll
-- rows. No cycle exists. Locking the roll BEFORE the eligibility check is what
-- makes the safety rule hold under concurrency rather than only in a quiet
-- database.
--
-- ISOLATION CONTRACT (unchanged from db/123, db/125 and db/126)
-- Strictly weaving-owned. ALTERs no table, installs no trigger, changes no RLS
-- policy, grants nothing new to anon or service_role, and writes no Admin
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
  IF to_regclass('public.tecelagem_producao_lancamentos') IS NULL THEN
    v_missing := array_append(v_missing, 'public.tecelagem_producao_lancamentos');
  END IF;
  IF to_regprocedure('public.meu_fornecedor_id()') IS NULL THEN
    v_missing := array_append(v_missing, 'public.meu_fornecedor_id()');
  END IF;
  -- db/126 must already be in place: this migration is the SECOND correction
  -- of a pair and must never land in a database that lacks the first.
  IF to_regprocedure('public.desfazer_lancamento_tecelagem(bigint)') IS NULL THEN
    v_missing := array_append(v_missing, 'public.desfazer_lancamento_tecelagem(bigint)');
  END IF;

  IF array_length(v_missing, 1) IS NOT NULL THEN
    RAISE EXCEPTION 'db/127 entry gate: missing prerequisite object(s): %',
      array_to_string(v_missing, ', ');
  END IF;
END
$gate$;

-- ---------------------------------------------------------------------
-- 1. THE SINGLE OWNER OF "MAY THIS ROLL STILL BE DELETED?"
--
-- Same shape as db/123's _tecelagem_op_pode_iniciar and db/126's
-- _tecelagem_lancamento_pode_desfazer: stated once, derived by everything that
-- needs it, so the screen and the server cannot drift apart.
--
-- Returns NULL when the roll may be deleted, otherwise a stable refusal code.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._tecelagem_rolo_pode_excluir(
  p_rolo_id       BIGINT,
  p_fornecedor_id BIGINT
)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_fornecedor_id BIGINT;
  v_situacao      TEXT;
BEGIN
  IF p_rolo_id IS NULL OR p_fornecedor_id IS NULL THEN
    RETURN 'ROLO_INEXISTENTE';
  END IF;

  SELECT r.fornecedor_id, r.situacao
    INTO v_fornecedor_id, v_situacao
    FROM public.tecelagem_rolos r
   WHERE r.id = p_rolo_id;

  IF v_fornecedor_id IS NULL THEN
    RETURN 'ROLO_INEXISTENTE';
  END IF;

  IF v_fornecedor_id <> p_fornecedor_id THEN
    RETURN 'ROLO_FORA_DO_ESCOPO_DO_FORNECEDOR';
  END IF;

  -- THE RATIFIED SAFETY RULE, fail-closed: any situation this phase does not
  -- know about refuses the deletion rather than being assumed reversible.
  IF v_situacao <> 'na_tecelagem' THEN
    RETURN 'ROLO_JA_ENVIADO_AO_ACABAMENTO';
  END IF;

  RETURN NULL;
END
$fn$;

ALTER FUNCTION public._tecelagem_rolo_pode_excluir(BIGINT, BIGINT) OWNER TO postgres;
REVOKE ALL ON FUNCTION public._tecelagem_rolo_pode_excluir(BIGINT, BIGINT)
  FROM PUBLIC, anon, authenticated, service_role;

COMMENT ON FUNCTION public._tecelagem_rolo_pode_excluir(BIGINT, BIGINT) IS
  'db/127. SINGLE OWNER of individual roll-deletion eligibility. Returns NULL when the roll may be deleted, else a stable refusal code (ROLO_INEXISTENTE, ROLO_FORA_DO_ESCOPO_DO_FORNECEDOR, ROLO_JA_ENVIADO_AO_ACABAMENTO). Owner-only.';

-- ---------------------------------------------------------------------
-- 2. THE WRITER — validates completely, then applies.
--
-- Symmetric with every other weaving writer: no role holds a direct DELETE
-- grant, and there is no partial-apply path.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.excluir_rolo_tecelagem(p_rolo_id BIGINT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $fn$
DECLARE
  v_fornecedor_id     BIGINT;
  v_op_id             BIGINT;
  v_op_item_id        BIGINT;
  v_lancamento_id     BIGINT;
  v_numero            INTEGER;
  v_recusa            TEXT;
  v_removidos         INTEGER;
  v_restantes         INTEGER;
  v_lancamento_removido BOOLEAN := FALSE;
BEGIN
  -- === VALIDATION STAGE — nothing is written before this stage completes ===

  v_fornecedor_id := public.meu_fornecedor_id();
  IF v_fornecedor_id IS NULL THEN
    RAISE EXCEPTION 'TECELAGEM_FORNECEDOR_NAO_IDENTIFICADO'
      USING ERRCODE = '42501',
            DETAIL  = 'the caller is not an active supplier user';
  END IF;

  IF p_rolo_id IS NULL THEN
    RAISE EXCEPTION 'TECELAGEM_ROLO_OBRIGATORIO'
      USING ERRCODE = '22023', DETAIL = 'p_rolo_id is required';
  END IF;

  -- Unlocked read, only to learn WHICH counter row to lock first. Every fact
  -- it produces is re-read under lock below; nothing is trusted from here.
  SELECT r.op_id INTO v_op_id
    FROM public.tecelagem_rolos r
   WHERE r.id = p_rolo_id;

  IF v_op_id IS NULL THEN
    RAISE EXCEPTION 'TECELAGEM_ROLO_NAO_ENCONTRADO'
      USING ERRCODE = '55000',
            DETAIL  = 'ROLO_INEXISTENTE';
  END IF;

  -- LOCK 1 — the per-OP counter. Taken first, exactly as db/123 and db/126
  -- take it, so an individual deletion, a batch undo and a new registration
  -- serialize instead of interleaving. The row is locked but NOT modified:
  -- see the header on why numbering is never rewound here.
  PERFORM 1 FROM public.tecelagem_rolo_sequencia s
    WHERE s.op_id = v_op_id FOR UPDATE;

  -- LOCK 2 — the roll's own registration, so a concurrent batch undo cannot
  -- remove it from under this call.
  SELECT l.id INTO v_lancamento_id
    FROM public.tecelagem_producao_lancamentos l
    JOIN public.tecelagem_rolos r ON r.lancamento_id = l.id
   WHERE r.id = p_rolo_id
     FOR UPDATE OF l;

  -- LOCK 3 — the roll itself, re-read under lock and BEFORE the eligibility
  -- check, so a finishing output racing this deletion cannot slip between the
  -- check and the delete.
  SELECT r.op_id, r.op_item_id, r.lancamento_id, r.numero
    INTO v_op_id, v_op_item_id, v_lancamento_id, v_numero
    FROM public.tecelagem_rolos r
   WHERE r.id = p_rolo_id
     FOR UPDATE;

  IF v_op_id IS NULL THEN
    RAISE EXCEPTION 'TECELAGEM_ROLO_NAO_ENCONTRADO'
      USING ERRCODE = '55000',
            DETAIL  = 'ROLO_INEXISTENTE';
  END IF;

  v_recusa := public._tecelagem_rolo_pode_excluir(p_rolo_id, v_fornecedor_id);

  IF v_recusa = 'ROLO_FORA_DO_ESCOPO_DO_FORNECEDOR' THEN
    RAISE EXCEPTION 'TECELAGEM_ROLO_FORA_DO_ESCOPO_DO_FORNECEDOR'
      USING ERRCODE = '42501',
            DETAIL  = 'this roll does not belong to the calling supplier';
  END IF;

  IF v_recusa = 'ROLO_JA_ENVIADO_AO_ACABAMENTO' THEN
    RAISE EXCEPTION 'TECELAGEM_ROLO_JA_ENVIADO'
      USING ERRCODE = '55000',
            DETAIL  = 'this roll already left weaving for finishing and cannot be deleted by this action';
  END IF;

  IF v_recusa IS NOT NULL THEN
    RAISE EXCEPTION 'TECELAGEM_ROLO_NAO_ENCONTRADO'
      USING ERRCODE = '55000',
            DETAIL  = v_recusa;
  END IF;

  -- === APPLY STAGE — every refusal above has already been raised ===

  DELETE FROM public.tecelagem_rolos r WHERE r.id = p_rolo_id;
  GET DIAGNOSTICS v_removidos = ROW_COUNT;

  -- EXACTLY ONE roll, or nothing. A deletion that touched a different number
  -- of rows than the single one validated is a defect, not a partial success.
  IF v_removidos <> 1 THEN
    RAISE EXCEPTION 'TECELAGEM_EXCLUSAO_CARDINALIDADE_INCONSISTENTE'
      USING ERRCODE = 'P0001',
            DETAIL  = format('expected to delete exactly 1 roll, deleted %s', v_removidos);
  END IF;

  -- The declared batch count must keep agreeing with the rolls that actually
  -- exist; otherwise the registration becomes a phantom count and db/126's
  -- undo would refuse the batch forever.
  SELECT count(*) INTO v_restantes
    FROM public.tecelagem_rolos r
   WHERE r.lancamento_id = v_lancamento_id;

  IF v_restantes = 0 THEN
    -- A batch event describing no roll at all is an orphan reference, and
    -- quantidade_rolos >= 1 makes it unrepresentable anyway.
    DELETE FROM public.tecelagem_producao_lancamentos l WHERE l.id = v_lancamento_id;
    v_lancamento_removido := TRUE;
  ELSE
    UPDATE public.tecelagem_producao_lancamentos l
       SET quantidade_rolos = v_restantes
     WHERE l.id = v_lancamento_id;
  END IF;

  -- tecelagem_rolo_sequencia is deliberately NOT touched. See the header: the
  -- surviving rolls keep their printed identities and the freed number is
  -- never reissued.

  RETURN jsonb_build_object(
    'rolo_id',             p_rolo_id,
    'numero',              v_numero,
    'op_id',               v_op_id,
    'op_item_id',          v_op_item_id,
    'lancamento_id',       v_lancamento_id,
    'rolos_restantes',     v_restantes,
    'lancamento_removido', v_lancamento_removido
  );
END
$fn$;

ALTER FUNCTION public.excluir_rolo_tecelagem(BIGINT) OWNER TO postgres;

REVOKE ALL ON FUNCTION public.excluir_rolo_tecelagem(BIGINT)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.excluir_rolo_tecelagem(BIGINT) TO authenticated;

COMMENT ON FUNCTION public.excluir_rolo_tecelagem(BIGINT) IS
  'db/127. THE ONLY write path for deleting ONE individual weaving roll. Validates completely (ownership, still na_tecelagem), then applies: exactly one roll goes, or nothing does. Surviving rolls are NEVER renumbered and the per-OP allocator is never rewound, so a printed roll number is never reissued. Keeps the batch declared count equal to the rolls that remain, and removes the batch row when its last roll goes. Touches no Admin table.';

-- ---------------------------------------------------------------------
-- 3. Verify — self-proving, in the same transaction as the migration
-- ---------------------------------------------------------------------
DO $verify$
DECLARE
  v_bad TEXT[] := ARRAY[]::TEXT[];
BEGIN
  -- 3.1 The eligibility owner exists, is STABLE and stays owner-only.
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = '_tecelagem_rolo_pode_excluir'
       AND p.prosecdef IS TRUE AND p.provolatile = 's'
  ) THEN
    v_bad := array_append(v_bad, '_tecelagem_rolo_pode_excluir is missing, is not SECURITY DEFINER, or is not STABLE');
  END IF;

  IF has_function_privilege('authenticated', 'public._tecelagem_rolo_pode_excluir(bigint,bigint)', 'EXECUTE')
     OR has_function_privilege('anon', 'public._tecelagem_rolo_pode_excluir(bigint,bigint)', 'EXECUTE')
     OR has_function_privilege('service_role', 'public._tecelagem_rolo_pode_excluir(bigint,bigint)', 'EXECUTE') THEN
    v_bad := array_append(v_bad, 'the roll-deletion eligibility owner is not owner-only');
  END IF;

  -- 3.2 The safety rule is the fail-closed predicate, not an equality against
  --     the one situation this phase happens to know.
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = '_tecelagem_rolo_pode_excluir'
       AND p.prosrc LIKE '%<> ''na_tecelagem''%'
  ) THEN
    v_bad := array_append(v_bad, 'the roll-deletion eligibility owner does not fail closed on an unknown roll situation');
  END IF;

  -- 3.3 The writer exists, is SECURITY DEFINER and reaches only authenticated.
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = 'excluir_rolo_tecelagem' AND p.prosecdef IS TRUE
  ) THEN
    v_bad := array_append(v_bad, 'excluir_rolo_tecelagem is missing or is not SECURITY DEFINER');
  END IF;

  IF has_function_privilege('anon', 'public.excluir_rolo_tecelagem(bigint)', 'EXECUTE')
     OR has_function_privilege('service_role', 'public.excluir_rolo_tecelagem(bigint)', 'EXECUTE') THEN
    v_bad := array_append(v_bad, 'the roll-deletion writer is executable by anon or service_role');
  END IF;

  IF NOT has_function_privilege('authenticated', 'public.excluir_rolo_tecelagem(bigint)', 'EXECUTE') THEN
    v_bad := array_append(v_bad, 'the roll-deletion writer is not executable by authenticated');
  END IF;

  -- 3.4 The writer derives from the single eligibility owner instead of
  --     restating the safety rule as a second, driftable copy.
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = 'excluir_rolo_tecelagem'
       AND p.prosrc LIKE '%_tecelagem_rolo_pode_excluir%'
  ) THEN
    v_bad := array_append(v_bad, 'excluir_rolo_tecelagem does not derive from the single roll-deletion eligibility owner');
  END IF;

  -- 3.5 NUMBERING IS IDENTITY. The writer must never UPDATE tecelagem_rolos
  --     (that is how a renumbering would have to be expressed) and must never
  --     rewind the allocator.
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = 'excluir_rolo_tecelagem'
       AND p.prosrc ~* 'update\s+(public\.)?tecelagem_rolos\M'
  ) THEN
    v_bad := array_append(v_bad, 'excluir_rolo_tecelagem updates tecelagem_rolos; surviving rolls must never be renumbered');
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = 'excluir_rolo_tecelagem'
       AND p.prosrc ~* '(update|insert into)\s+(public\.)?tecelagem_rolo_sequencia\M'
  ) THEN
    v_bad := array_append(v_bad, 'excluir_rolo_tecelagem rewinds the roll allocator; a printed roll number must never be reissued');
  END IF;

  -- 3.6 db/126's batch undo is PRESERVED, not replaced.
  IF to_regprocedure('public.desfazer_lancamento_tecelagem(bigint)') IS NULL
     OR NOT has_function_privilege('authenticated', 'public.desfazer_lancamento_tecelagem(bigint)', 'EXECUTE') THEN
    v_bad := array_append(v_bad, 'the db/126 batch undo no longer exists or is no longer reachable by authenticated');
  END IF;

  IF to_regprocedure('public.tecelagem_lancamentos_recentes(bigint)') IS NULL THEN
    v_bad := array_append(v_bad, 'the db/126 recovery read model no longer exists');
  END IF;

  -- 3.7 The db/125 finishing output is PRESERVED and unchanged.
  IF to_regprocedure('public.enviar_rolos_acabamento(bigint[])') IS NULL
     OR NOT has_function_privilege('authenticated', 'public.enviar_rolos_acabamento(bigint[])', 'EXECUTE') THEN
    v_bad := array_append(v_bad, 'the db/125 finishing-output writer no longer exists or is no longer reachable');
  END IF;

  -- 3.8 ISOLATION PROOF, asserted against the function body rather than prose.
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = 'excluir_rolo_tecelagem'
       AND (p.prosrc ~* '(update|insert into|delete from)\s+(public\.)?(ops|op_itens|lotes|pedidos|expedicoes|romaneios|entrega_itens)\M'
            OR p.prosrc ILIKE '%iniciar_producao_op%'
            OR p.prosrc ILIKE '%alterar_status_op%'
            OR p.prosrc ILIKE '%abrir_op_tecelagem%'
            OR p.prosrc ILIKE '%gerar_op_latex%')
  ) THEN
    v_bad := array_append(v_bad, 'excluir_rolo_tecelagem reaches an Admin table or an Admin lifecycle writer');
  END IF;

  -- 3.9 No direct write grant was opened on any weaving table, and no trigger
  --     was introduced.
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
    RAISE EXCEPTION 'db/127 verify FAILED: %', array_to_string(v_bad, ' | ');
  END IF;

  RAISE NOTICE 'db/127 verify: OK — one roll can be deleted while it is still na_tecelagem, the refusal is server-owned, survivors keep their printed numbers, the batch count stays honest, and db/125/db/126 are preserved';
END
$verify$;
