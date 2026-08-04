-- =============================================================================
-- db/126 — TECELAGEM V1: DESFAZER UM LANÇAMENTO DE PRODUÇÃO
-- =============================================================================
-- ORDER: TECELAGEM-V1-PRODUCTION-ENTRY-RECOVERY (R3 / ASSURANCE).
--
-- PRODUCT REQUIREMENT BEING SATISFIED
-- A weaving production registration is a BATCH EVENT: one operator action that
-- materializes N individually persisted rolls (db/123). Until this migration
-- the batch had a forward path and no reverse one, so the ONLY way to recover
-- from a mistyped batch was to delete N rolls one by one — and no such
-- per-roll delete exists either, which means there was NO recovery path at all.
--
-- A REAL OPERATOR MISTAKE PROVED THIS IS NOT THEORETICAL. On 2026-08-04 an
-- operator intending to declare roughly 75 METRES typed 75 into the roll-count
-- field and the surface faithfully created 75 persistent rolls. The entry unit
-- was not explicit enough and the batch was irreversible. This migration owns
-- the reversal half of that correction; the unit clarity and the
-- high-quantity confirmation are owned by the screen.
--
-- THE OPERATOR ACTION THIS ENABLES
--     DESFAZER LANÇAMENTO — undo the registration and its rolls, as one act.
--
-- THE ONE RATIFIED SAFETY RULE
-- A registration may be undone only while every roll it created is still in
-- the reversible weaving state. The moment ANY of its rolls has progressed
-- beyond `na_tecelagem` — in this phase, sent to finishing by db/125 — the
-- simple batch undo is REFUSED. It is not silently narrowed to the rolls that
-- are still reversible, and no automatic rollback of the finishing movement is
-- invented here: a partially progressed batch is a situation a human must
-- resolve, not one this action may quietly paper over.
--
-- The predicate is deliberately written as `situacao <> 'na_tecelagem'` rather
-- than `= 'enviado_acabamento'`, so that any FUTURE roll situation is refused
-- by default instead of being silently treated as reversible.
--
-- WHAT UNDO REMOVES, AND WHAT IT DELIBERATELY DOES NOT TOUCH
-- It removes exactly two things: the rolls of that registration, and the
-- registration row itself. It does NOT remove:
--
--   - public.tecelagem_op_execucao — the LOCAL production start is a separate
--     operational fact of the OP, not part of the batch. The operator undoes a
--     mistyped batch precisely in order to register the correct one, and
--     revoking the start would block that immediately;
--   - any other registration of the same OP or product;
--   - anything at all in the Admin domain.
--
-- WHY THE PER-OP COUNTER IS REWOUND
-- db/123 allocates the operator-visible roll number from a per-OP counter. If
-- undo removed 75 rolls and left the counter at 76, the operator's CORRECTED
-- registration would start at "Rolo 076" while only a handful of rolls exist —
-- a phantom count, and exactly the kind of hidden damage a recovery action
-- must not leave behind. The counter is therefore reset to
--
--     max(numero) over the OP's SURVIVING rolls, + 1
--
-- which gives the numbers back when the undone batch was the most recent one,
-- and otherwise stays above every surviving number. It can never collide with
-- UNIQUE (op_id, numero), and a genuine historical gap left by an earlier undo
-- is preserved as a gap rather than silently reused.
--
-- LOCK ORDER (deadlock-free by construction)
-- The writer takes, in this order: the per-OP counter row, the registration
-- row, then every roll of that registration. registrar_producao_tecelagem
-- (db/123) takes the counter row first and then only ever INSERTs new rows;
-- enviar_rolos_acabamento (db/125) takes only roll rows. No cycle exists.
-- Locking the rolls before the eligibility check is what makes the safety rule
-- real under concurrency: a finishing output racing an undo either blocks and
-- then finds its rolls gone (its own cardinality self-check refuses the whole
-- call), or wins and makes this undo refuse.
--
-- ISOLATION CONTRACT (unchanged from db/123 and db/125)
-- Strictly weaving-owned. This migration ALTERs no table, installs no trigger,
-- changes no RLS policy, creates no new grant for anon or service_role, and
-- writes no Admin table, Pedido, expedition, romaneio or finishing record.
-- Admin lifecycle, Admin production quantities and Pedido state are untouched
-- by undo, by construction and by the verify block below.
-- =============================================================================

-- ---------------------------------------------------------------------
-- 0. Entry gate — refuse to run against an unexpected baseline
-- ---------------------------------------------------------------------
DO $gate$
DECLARE
  v_missing TEXT[] := ARRAY[]::TEXT[];
BEGIN
  IF to_regclass('public.tecelagem_producao_lancamentos') IS NULL THEN
    v_missing := array_append(v_missing, 'public.tecelagem_producao_lancamentos');
  END IF;
  IF to_regclass('public.tecelagem_rolos') IS NULL THEN
    v_missing := array_append(v_missing, 'public.tecelagem_rolos');
  END IF;
  IF to_regclass('public.tecelagem_rolo_sequencia') IS NULL THEN
    v_missing := array_append(v_missing, 'public.tecelagem_rolo_sequencia');
  END IF;
  IF to_regprocedure('public.registrar_producao_tecelagem(bigint,integer,numeric[])') IS NULL THEN
    v_missing := array_append(v_missing, 'public.registrar_producao_tecelagem(bigint,integer,numeric[])');
  END IF;
  IF to_regprocedure('public.meu_fornecedor_id()') IS NULL THEN
    v_missing := array_append(v_missing, 'public.meu_fornecedor_id()');
  END IF;

  IF array_length(v_missing, 1) IS NOT NULL THEN
    RAISE EXCEPTION 'db/126 entry gate: missing prerequisite object(s): %',
      array_to_string(v_missing, ', ');
  END IF;
END
$gate$;

-- ---------------------------------------------------------------------
-- 1. THE SINGLE OWNER OF "MAY THIS REGISTRATION STILL BE UNDONE?"
--
-- Stated exactly ONCE, in the same shape as db/123's _tecelagem_op_pode_iniciar:
-- the writer and the read model both derive from it, so what the operator is
-- offered and what the server admits can never drift apart. An interface
-- defect cannot open a batch the server would refuse, and the interface cannot
-- withhold an undo the server would accept.
--
-- Returns NULL when the registration may be undone, otherwise a stable refusal
-- code.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._tecelagem_lancamento_pode_desfazer(
  p_lancamento_id BIGINT,
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
  v_progrediram   INTEGER;
BEGIN
  IF p_lancamento_id IS NULL OR p_fornecedor_id IS NULL THEN
    RETURN 'LANCAMENTO_INEXISTENTE';
  END IF;

  SELECT l.fornecedor_id INTO v_fornecedor_id
    FROM public.tecelagem_producao_lancamentos l
   WHERE l.id = p_lancamento_id;

  IF v_fornecedor_id IS NULL THEN
    RETURN 'LANCAMENTO_INEXISTENTE';
  END IF;

  IF v_fornecedor_id <> p_fornecedor_id THEN
    RETURN 'LANCAMENTO_FORA_DO_ESCOPO_DO_FORNECEDOR';
  END IF;

  -- THE RATIFIED SAFETY RULE. `<> 'na_tecelagem'` and not
  -- `= 'enviado_acabamento'`: a roll situation this phase does not know about
  -- must refuse the undo, never be assumed reversible.
  SELECT count(*) INTO v_progrediram
    FROM public.tecelagem_rolos r
   WHERE r.lancamento_id = p_lancamento_id
     AND r.situacao <> 'na_tecelagem';

  IF v_progrediram > 0 THEN
    RETURN 'LANCAMENTO_COM_ROLOS_JA_ENVIADOS';
  END IF;

  RETURN NULL;
END
$fn$;

ALTER FUNCTION public._tecelagem_lancamento_pode_desfazer(BIGINT, BIGINT) OWNER TO postgres;
REVOKE ALL ON FUNCTION public._tecelagem_lancamento_pode_desfazer(BIGINT, BIGINT)
  FROM PUBLIC, anon, authenticated, service_role;

COMMENT ON FUNCTION public._tecelagem_lancamento_pode_desfazer(BIGINT, BIGINT) IS
  'db/126. SINGLE OWNER of weaving batch-undo eligibility. Returns NULL when the registration may still be undone, else a stable refusal code (LANCAMENTO_INEXISTENTE, LANCAMENTO_FORA_DO_ESCOPO_DO_FORNECEDOR, LANCAMENTO_COM_ROLOS_JA_ENVIADOS). Owner-only: reached by the writer and the read model as SECURITY DEFINER callers.';

-- ---------------------------------------------------------------------
-- 2. THE RECOVERY READ MODEL
--
-- The operator must be able to RECOGNISE the registration they just made a
-- mistake in, from business facts alone. This projection therefore carries the
-- roll count, the moment, the resulting roll-number range and the eligibility
-- verdict of section 1. The surrogate id travels because the writer needs an
-- argument; the screen never renders it, and it is not an operator-facing
-- identifier.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.tecelagem_lancamentos_recentes(p_op_item_id BIGINT)
RETURNS TABLE (
  lancamento_id     BIGINT,
  op_id             BIGINT,
  op_item_id        BIGINT,
  quantidade_rolos  INTEGER,
  criado_em         TIMESTAMPTZ,
  rolos_atuais      INTEGER,
  rolos_progredidos INTEGER,
  numero_inicial    INTEGER,
  numero_final      INTEGER,
  pode_desfazer     BOOLEAN,
  motivo_bloqueio   TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $fn$
DECLARE
  v_fornecedor_id BIGINT;
BEGIN
  v_fornecedor_id := public.meu_fornecedor_id();

  -- Not a supplier: an EMPTY list, not an error — same discipline as
  -- tecelagem_minhas_ops (db/123). The caller distinguishes "no registrations"
  -- from "not a supplier" through its own session, never through a leaked
  -- refusal.
  IF v_fornecedor_id IS NULL OR p_op_item_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    l.id,
    l.op_id,
    l.op_item_id,
    l.quantidade_rolos,
    l.criado_em,
    COALESCE(a.total, 0),
    COALESCE(a.progredidos, 0),
    a.numero_inicial,
    a.numero_final,
    (public._tecelagem_lancamento_pode_desfazer(l.id, v_fornecedor_id) IS NULL),
    public._tecelagem_lancamento_pode_desfazer(l.id, v_fornecedor_id)
  FROM public.tecelagem_producao_lancamentos l
  LEFT JOIN LATERAL (
    SELECT
      count(*)::INTEGER AS total,
      (count(*) FILTER (WHERE r.situacao <> 'na_tecelagem'))::INTEGER AS progredidos,
      min(r.numero)::INTEGER AS numero_inicial,
      max(r.numero)::INTEGER AS numero_final
    FROM public.tecelagem_rolos r
    WHERE r.lancamento_id = l.id
  ) a ON TRUE
  WHERE l.op_item_id = p_op_item_id
    AND l.fornecedor_id = v_fornecedor_id
  ORDER BY l.id DESC;
END
$fn$;

ALTER FUNCTION public.tecelagem_lancamentos_recentes(BIGINT) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.tecelagem_lancamentos_recentes(BIGINT)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.tecelagem_lancamentos_recentes(BIGINT) TO authenticated;

COMMENT ON FUNCTION public.tecelagem_lancamentos_recentes(BIGINT) IS
  'db/126. The weaving recovery read model: the supplier''s own production registrations for one OP product, each with its roll count, moment, roll-number range and undo eligibility derived from the single owner _tecelagem_lancamento_pode_desfazer. Read-only.';

-- ---------------------------------------------------------------------
-- 3. THE WRITER — validates completely, then applies.
--
-- Symmetric with registrar_producao_tecelagem (db/123) and
-- enviar_rolos_acabamento (db/125): no role ever holds a direct DELETE grant
-- on a weaving table, and there is no partial-apply path. Either the whole
-- registration and all of its rolls go, or nothing does.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.desfazer_lancamento_tecelagem(p_lancamento_id BIGINT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $fn$
DECLARE
  v_fornecedor_id  BIGINT;
  v_op_id          BIGINT;
  v_op_item_id     BIGINT;
  v_quantidade     INTEGER;
  v_recusa         TEXT;
  v_numero_inicial INTEGER;
  v_numero_final   INTEGER;
  v_removidos      INTEGER;
  v_proximo        INTEGER;
BEGIN
  -- === VALIDATION STAGE — nothing is written before this stage completes ===

  v_fornecedor_id := public.meu_fornecedor_id();
  IF v_fornecedor_id IS NULL THEN
    RAISE EXCEPTION 'TECELAGEM_FORNECEDOR_NAO_IDENTIFICADO'
      USING ERRCODE = '42501',
            DETAIL  = 'the caller is not an active supplier user';
  END IF;

  IF p_lancamento_id IS NULL THEN
    RAISE EXCEPTION 'TECELAGEM_LANCAMENTO_OBRIGATORIO'
      USING ERRCODE = '22023', DETAIL = 'p_lancamento_id is required';
  END IF;

  -- Unlocked read, only to learn WHICH counter row to lock first. Every fact
  -- it produces is re-read under lock below; nothing is trusted from here.
  SELECT l.op_id INTO v_op_id
    FROM public.tecelagem_producao_lancamentos l
   WHERE l.id = p_lancamento_id;

  IF v_op_id IS NULL THEN
    RAISE EXCEPTION 'TECELAGEM_LANCAMENTO_NAO_ENCONTRADO'
      USING ERRCODE = '55000',
            DETAIL  = 'LANCAMENTO_INEXISTENTE';
  END IF;

  -- LOCK 1 — the per-OP counter. Taken first, exactly as
  -- registrar_producao_tecelagem takes it, so a concurrent registration and a
  -- concurrent undo on the same OP serialize instead of interleaving.
  PERFORM 1 FROM public.tecelagem_rolo_sequencia s
    WHERE s.op_id = v_op_id FOR UPDATE;

  -- LOCK 2 — the registration itself, re-read under lock: a concurrent undo
  -- may have removed it while this call waited on the counter.
  SELECT l.op_id, l.op_item_id, l.quantidade_rolos
    INTO v_op_id, v_op_item_id, v_quantidade
    FROM public.tecelagem_producao_lancamentos l
   WHERE l.id = p_lancamento_id
     FOR UPDATE;

  IF v_op_id IS NULL THEN
    RAISE EXCEPTION 'TECELAGEM_LANCAMENTO_NAO_ENCONTRADO'
      USING ERRCODE = '55000',
            DETAIL  = 'LANCAMENTO_INEXISTENTE';
  END IF;

  -- LOCK 3 — every roll of this registration, BEFORE the eligibility check.
  -- This is what makes the safety rule hold under concurrency rather than only
  -- in a quiet database: a finishing output racing this undo cannot slip
  -- between the check and the delete.
  PERFORM 1 FROM public.tecelagem_rolos r
    WHERE r.lancamento_id = p_lancamento_id FOR UPDATE;

  v_recusa := public._tecelagem_lancamento_pode_desfazer(p_lancamento_id, v_fornecedor_id);

  IF v_recusa = 'LANCAMENTO_FORA_DO_ESCOPO_DO_FORNECEDOR' THEN
    RAISE EXCEPTION 'TECELAGEM_LANCAMENTO_FORA_DO_ESCOPO_DO_FORNECEDOR'
      USING ERRCODE = '42501',
            DETAIL  = 'this production registration does not belong to the calling supplier';
  END IF;

  IF v_recusa = 'LANCAMENTO_COM_ROLOS_JA_ENVIADOS' THEN
    RAISE EXCEPTION 'TECELAGEM_LANCAMENTO_JA_PROGREDIU'
      USING ERRCODE = '55000',
            DETAIL  = 'one or more rolls of this registration already left weaving; the batch can no longer be undone by this action';
  END IF;

  IF v_recusa IS NOT NULL THEN
    RAISE EXCEPTION 'TECELAGEM_LANCAMENTO_NAO_ENCONTRADO'
      USING ERRCODE = '55000',
            DETAIL  = v_recusa;
  END IF;

  -- === APPLY STAGE — every refusal above has already been raised ===

  -- Captured before the delete: the operator's confirmation names the exact
  -- roll range that was undone, and nowhere else records it afterwards.
  SELECT min(r.numero), max(r.numero)
    INTO v_numero_inicial, v_numero_final
    FROM public.tecelagem_rolos r
   WHERE r.lancamento_id = p_lancamento_id;

  -- The rolls are deleted EXPLICITLY rather than left to the FK cascade, so
  -- the number actually removed is measured and proved below instead of
  -- assumed.
  DELETE FROM public.tecelagem_rolos r WHERE r.lancamento_id = p_lancamento_id;
  GET DIAGNOSTICS v_removidos = ROW_COUNT;

  -- The batch event says it created N rolls. If the database does not agree,
  -- this is a pre-existing inconsistency and the honest response is to refuse
  -- and surface it, never to delete a batch whose contents we cannot account
  -- for. The whole transaction rolls back.
  IF v_removidos <> v_quantidade THEN
    RAISE EXCEPTION 'TECELAGEM_DESFAZER_CARDINALIDADE_INCONSISTENTE'
      USING ERRCODE = 'P0001',
            DETAIL  = format('the registration declares %s roll(s) but %s were found', v_quantidade, v_removidos);
  END IF;

  DELETE FROM public.tecelagem_producao_lancamentos l WHERE l.id = p_lancamento_id;

  -- Rewind the operator-visible numbering to the OP's surviving high-water
  -- mark, so the corrected registration does not start at a phantom number.
  -- Strictly greater than every surviving number, so UNIQUE (op_id, numero)
  -- can never be violated by the next allocation.
  SELECT COALESCE(max(r.numero), 0) + 1 INTO v_proximo
    FROM public.tecelagem_rolos r
   WHERE r.op_id = v_op_id;

  UPDATE public.tecelagem_rolo_sequencia s
     SET proximo = v_proximo,
         atualizado_em = now()
   WHERE s.op_id = v_op_id;

  RETURN jsonb_build_object(
    'lancamento_id',    p_lancamento_id,
    'op_id',            v_op_id,
    'op_item_id',       v_op_item_id,
    'quantidade_rolos', v_quantidade,
    'rolos_removidos',  v_removidos,
    'numero_inicial',   v_numero_inicial,
    'numero_final',     v_numero_final,
    'proximo_numero',   v_proximo
  );
END
$fn$;

ALTER FUNCTION public.desfazer_lancamento_tecelagem(BIGINT) OWNER TO postgres;

REVOKE ALL ON FUNCTION public.desfazer_lancamento_tecelagem(BIGINT)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.desfazer_lancamento_tecelagem(BIGINT) TO authenticated;

COMMENT ON FUNCTION public.desfazer_lancamento_tecelagem(BIGINT) IS
  'db/126. THE ONLY write path for undoing a weaving production registration. Validates completely (ownership, and every roll still na_tecelagem), then applies: the registration and all of its rolls go, or nothing does. Rewinds the per-OP roll-number counter to the surviving high-water mark. Never removes the local production start (tecelagem_op_execucao) and touches no Admin table.';

-- ---------------------------------------------------------------------
-- 4. Verify — self-proving, in the same transaction as the migration
-- ---------------------------------------------------------------------
DO $verify$
DECLARE
  v_bad TEXT[] := ARRAY[]::TEXT[];
BEGIN
  -- 4.1 The eligibility owner exists, is STABLE and stays owner-only.
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = '_tecelagem_lancamento_pode_desfazer'
       AND p.prosecdef IS TRUE AND p.provolatile = 's'
  ) THEN
    v_bad := array_append(v_bad, '_tecelagem_lancamento_pode_desfazer is missing, is not SECURITY DEFINER, or is not STABLE');
  END IF;

  IF has_function_privilege('authenticated', 'public._tecelagem_lancamento_pode_desfazer(bigint,bigint)', 'EXECUTE')
     OR has_function_privilege('anon', 'public._tecelagem_lancamento_pode_desfazer(bigint,bigint)', 'EXECUTE')
     OR has_function_privilege('service_role', 'public._tecelagem_lancamento_pode_desfazer(bigint,bigint)', 'EXECUTE') THEN
    v_bad := array_append(v_bad, 'the undo eligibility owner is not owner-only');
  END IF;

  -- 4.2 The safety rule is written as the fail-closed predicate, not as an
  --     equality against the one situation this phase happens to know.
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = '_tecelagem_lancamento_pode_desfazer'
       AND p.prosrc LIKE '%<> ''na_tecelagem''%'
  ) THEN
    v_bad := array_append(v_bad, 'the undo eligibility owner does not fail closed on an unknown roll situation');
  END IF;

  -- 4.3 The read model exists, is read-only and reaches only authenticated.
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = 'tecelagem_lancamentos_recentes'
       AND p.prosecdef IS TRUE AND p.provolatile = 's'
  ) THEN
    v_bad := array_append(v_bad, 'tecelagem_lancamentos_recentes is missing, is not SECURITY DEFINER, or is not STABLE');
  END IF;

  IF has_function_privilege('anon', 'public.tecelagem_lancamentos_recentes(bigint)', 'EXECUTE')
     OR has_function_privilege('service_role', 'public.tecelagem_lancamentos_recentes(bigint)', 'EXECUTE') THEN
    v_bad := array_append(v_bad, 'the recovery read model is executable by anon or service_role');
  END IF;

  IF NOT has_function_privilege('authenticated', 'public.tecelagem_lancamentos_recentes(bigint)', 'EXECUTE') THEN
    v_bad := array_append(v_bad, 'the recovery read model is not executable by authenticated');
  END IF;

  -- 4.4 The writer exists, is SECURITY DEFINER and reaches only authenticated.
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = 'desfazer_lancamento_tecelagem' AND p.prosecdef IS TRUE
  ) THEN
    v_bad := array_append(v_bad, 'desfazer_lancamento_tecelagem is missing or is not SECURITY DEFINER');
  END IF;

  IF has_function_privilege('anon', 'public.desfazer_lancamento_tecelagem(bigint)', 'EXECUTE')
     OR has_function_privilege('service_role', 'public.desfazer_lancamento_tecelagem(bigint)', 'EXECUTE') THEN
    v_bad := array_append(v_bad, 'the undo writer is executable by anon or service_role');
  END IF;

  IF NOT has_function_privilege('authenticated', 'public.desfazer_lancamento_tecelagem(bigint)', 'EXECUTE') THEN
    v_bad := array_append(v_bad, 'the undo writer is not executable by authenticated');
  END IF;

  -- 4.5 The writer actually consults the single eligibility owner rather than
  --     restating the safety rule as a second, driftable copy.
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = 'desfazer_lancamento_tecelagem'
       AND p.prosrc LIKE '%_tecelagem_lancamento_pode_desfazer%'
  ) THEN
    v_bad := array_append(v_bad, 'desfazer_lancamento_tecelagem does not derive from the single undo eligibility owner');
  END IF;

  -- 4.6 UNDO MUST NOT REVOKE THE LOCAL PRODUCTION START. The operator undoes a
  --     mistyped batch in order to register the correct one immediately.
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = 'desfazer_lancamento_tecelagem'
       AND p.prosrc ~* 'delete\s+from\s+(public\.)?tecelagem_op_execucao'
  ) THEN
    v_bad := array_append(v_bad, 'desfazer_lancamento_tecelagem removes the local production start; the batch undo must not revoke it');
  END IF;

  -- 4.7 ISOLATION PROOF, asserted against the function body rather than prose:
  --     the writer reaches no Admin table and no Admin lifecycle writer.
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = 'desfazer_lancamento_tecelagem'
       AND (p.prosrc ~* '(update|insert into|delete from)\s+(public\.)?(ops|op_itens|lotes|pedidos|expedicoes|romaneios|entrega_itens)\M'
            OR p.prosrc ILIKE '%iniciar_producao_op%'
            OR p.prosrc ILIKE '%alterar_status_op%'
            OR p.prosrc ILIKE '%abrir_op_tecelagem%'
            OR p.prosrc ILIKE '%gerar_op_latex%')
  ) THEN
    v_bad := array_append(v_bad, 'desfazer_lancamento_tecelagem reaches an Admin table or an Admin lifecycle writer');
  END IF;

  -- 4.8 No direct write grant was opened on any weaving table: the writer
  --     remains the only path, exactly as db/123 established.
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

  -- 4.9 No trigger was introduced anywhere on the weaving tables.
  IF EXISTS (
    SELECT 1 FROM pg_trigger tg JOIN pg_class c ON c.oid = tg.tgrelid
     WHERE NOT tg.tgisinternal AND c.relname LIKE 'tecelagem_%'
  ) THEN
    v_bad := array_append(v_bad, 'a weaving table carries a trigger; weaving must not propagate anywhere');
  END IF;

  IF array_length(v_bad, 1) IS NOT NULL THEN
    RAISE EXCEPTION 'db/126 verify FAILED: %', array_to_string(v_bad, ' | ');
  END IF;

  RAISE NOTICE 'db/126 verify: OK — a weaving production registration can be undone as one batch while every roll is still na_tecelagem, the refusal is server-owned, the roll counter is rewound, the local production start survives, and no pre-existing object was touched';
END
$verify$;
