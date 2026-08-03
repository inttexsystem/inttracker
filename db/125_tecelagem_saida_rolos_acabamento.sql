-- =============================================================================
-- db/125 — TECELAGEM V1: FINISHING OUTPUT (ENVIO DE ROLOS PARA O ACABAMENTO)
-- =============================================================================
-- ORDER: TECELAGEM-V1-FINISHING-OUTPUT-SLICE (R3 / ASSURANCE).
--
-- PRODUCT REQUIREMENT BEING SATISFIED
-- The weaving operator must be able to declare that specific, individually
-- persisted rolls (db/123) physically leave weaving for finishing. The
-- movement operates on real rolls, never on an abstract quantity: selecting
-- three rolls and confirming must change exactly those three rows, never a
-- count.
--
-- ROLL SITUATION MODEL — EXACTLY ONE NEW FORWARD TRANSITION
-- db/123 admitted a single situacao value, 'na_tecelagem', by deliberate
-- design ("it does NOT expand the roll-state model"). This slice is the
-- first product rule that requires a second one. Per the order, the model
-- stays exactly two values:
--
--     na_tecelagem  ->  enviado_acabamento
--
-- No other situation is introduced (no lost/cancelled/reworked/returned
-- roll), and no return path exists in this slice.
--
-- ISOLATION CONTRACT (unchanged from db/123, restated for this migration)
-- This is STILL a weaving-owned operational fact. It:
--   - ALTERs only public.tecelagem_rolos (new columns, widened CHECK);
--   - CREATEs one new writer and nothing else;
--   - installs NO trigger, changes NO RLS policy, grants NO new privilege to
--     anon or service_role;
--   - never writes an Admin table, an Admin writer, a Pedido, a romaneio/
--     shipment record, or a finishing receipt. Admin/finishing integration
--     is explicitly a later phase.
--
-- WHY A SEPARATE WRITER AND NOT A GENERIC UPDATE
-- Symmetric with registrar_producao_tecelagem and iniciar_producao_tecelagem:
-- no role ever gets a direct UPDATE grant on tecelagem_rolos. The writer
-- VALIDATES COMPLETELY, THEN APPLIES (no partial-apply path): every requested
-- roll id must exist, belong to the calling supplier, currently be
-- 'na_tecelagem', and belong to an applicable (non-Manta) product, or the
-- whole call is refused and NOTHING is written. This is the same discipline
-- as db/123's set-based roll creation, applied to a set-based roll transition.
--
-- WHY THE MANTA GUARD LIVES IN THE SERVER, NOT ONLY IN THE SCREEN
-- The product rule is that Manta never goes through rubber-backing finishing,
-- so a Manta roll must never be offered the output action. Consistent with
-- every other refusal in this domain (db/123's local-start gate, db/121's
-- OP-eligibility gate), the UI omission is a convenience, never the defense:
-- the writer independently re-derives applicability from
-- modelos.tipo_produto (db/78, the SOLE existing tapete/manta owner) and
-- refuses outright if any selected roll's product is Manta. No new
-- classification is invented here.
--
-- WHY enviado_acabamento_em / enviado_acabamento_por
-- Mirrors the audit shape already established for the OP-level local start
-- (tecelagem_op_execucao.iniciada_em / iniciada_por, db/123): a persisted
-- one-time fact records who and when, not only what. Neither is required by
-- the current screen's rendered table (Rolo / Comprimento / Situação /
-- Ações, unchanged), but withholding them here would make the moment of
-- output unrecoverable evidence — nowhere else in the schema records it.
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
  IF to_regprocedure('public.registrar_producao_tecelagem(bigint,integer,numeric[])') IS NULL THEN
    v_missing := array_append(v_missing, 'public.registrar_producao_tecelagem(bigint,integer,numeric[])');
  END IF;
  IF to_regprocedure('public.meu_fornecedor_id()') IS NULL THEN
    v_missing := array_append(v_missing, 'public.meu_fornecedor_id()');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'tecelagem_rolos' AND column_name = 'situacao'
  ) THEN
    v_missing := array_append(v_missing, 'public.tecelagem_rolos.situacao');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'modelos' AND column_name = 'tipo_produto'
  ) THEN
    v_missing := array_append(v_missing, 'public.modelos.tipo_produto');
  END IF;

  IF array_length(v_missing, 1) IS NOT NULL THEN
    RAISE EXCEPTION 'db/125 entry gate: missing prerequisite object(s): %',
      array_to_string(v_missing, ', ');
  END IF;
END
$gate$;

-- ---------------------------------------------------------------------
-- 1. Widen the roll situation CHECK to admit the one new forward value.
--    The constraint name is Postgres' own default for an unnamed inline
--    column CHECK (<table>_<column>_check), dropped defensively with
--    IF EXISTS so a re-run is idempotent even if it were ever renamed.
-- ---------------------------------------------------------------------
ALTER TABLE public.tecelagem_rolos
  DROP CONSTRAINT IF EXISTS tecelagem_rolos_situacao_check;

ALTER TABLE public.tecelagem_rolos
  ADD CONSTRAINT tecelagem_rolos_situacao_check
  CHECK (situacao IN ('na_tecelagem', 'enviado_acabamento'));

-- ---------------------------------------------------------------------
-- 2. Audit columns for the one new transition. Both NULL until the roll is
--    actually sent; the CHECK below keeps them coherent with situacao so a
--    future writer bug cannot leave a sent roll with no recorded moment, or
--    a roll still at weaving with a stale one.
-- ---------------------------------------------------------------------
ALTER TABLE public.tecelagem_rolos
  ADD COLUMN IF NOT EXISTS enviado_acabamento_em  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS enviado_acabamento_por UUID REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.tecelagem_rolos
  DROP CONSTRAINT IF EXISTS tecelagem_rolos_enviado_coerente;

ALTER TABLE public.tecelagem_rolos
  ADD CONSTRAINT tecelagem_rolos_enviado_coerente
  CHECK ((situacao = 'enviado_acabamento') = (enviado_acabamento_em IS NOT NULL));

COMMENT ON COLUMN public.tecelagem_rolos.situacao IS
  'db/123 + db/125. na_tecelagem (initial) or enviado_acabamento (after confirmed weaving output). Exactly two values; no other roll state is admitted in this slice.';
COMMENT ON COLUMN public.tecelagem_rolos.enviado_acabamento_em IS
  'db/125. Set exactly when situacao becomes enviado_acabamento, by enviar_rolos_acabamento only. NULL while na_tecelagem.';
COMMENT ON COLUMN public.tecelagem_rolos.enviado_acabamento_por IS
  'db/125. auth.uid() of the weaving operator who confirmed the output, or NULL if that identity was later removed.';

-- ---------------------------------------------------------------------
-- 3. THE WRITER — validates completely, then applies.
--
-- AUTHORIZATION: every requested roll must already belong to the calling
-- supplier (tecelagem_rolos.fornecedor_id, set at creation time by
-- registrar_producao_tecelagem and never client-suppliable). No OP or
-- op_item id is accepted as input; trusting a client-supplied scope would
-- reopen exactly the authorization gap db/123's writers were built to avoid.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enviar_rolos_acabamento(p_rolo_ids BIGINT[])
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
  v_elegiveis     INTEGER;
  v_atualizados   INTEGER;
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

  -- Defensive de-duplication: a repeated id in the input must not be counted
  -- twice against itself in the cardinality proof below.
  v_ids := ARRAY(SELECT DISTINCT x FROM unnest(p_rolo_ids) AS x);
  v_quantidade := array_length(v_ids, 1);

  -- Every id must exist AND belong to this supplier. A roll id that is not
  -- this supplier's (or does not exist at all) is refused exactly like an
  -- out-of-scope product in registrar_producao_tecelagem: the whole call is
  -- refused, never silently narrowed to the ones that do match.
  SELECT count(*) INTO v_encontrados
    FROM public.tecelagem_rolos r
   WHERE r.id = ANY(v_ids) AND r.fornecedor_id = v_fornecedor_id;

  IF v_encontrados <> v_quantidade THEN
    RAISE EXCEPTION 'TECELAGEM_ROLO_FORA_DO_ESCOPO_DO_FORNECEDOR'
      USING ERRCODE = '42501',
            DETAIL  = 'one or more selected rolls do not belong to the calling supplier';
  END IF;

  -- Every id must currently be na_tecelagem. An already-sent roll offered a
  -- second time through this same call is refused, not silently skipped —
  -- silently skipping would let a caller believe a roll moved when it did
  -- not, or double-count a roll that was already accounted for.
  SELECT count(*) INTO v_elegiveis
    FROM public.tecelagem_rolos r
   WHERE r.id = ANY(v_ids) AND r.fornecedor_id = v_fornecedor_id AND r.situacao = 'na_tecelagem';

  IF v_elegiveis <> v_quantidade THEN
    RAISE EXCEPTION 'TECELAGEM_ROLO_NAO_ELEGIVEL_PARA_SAIDA'
      USING ERRCODE = '55000',
            DETAIL  = 'one or more selected rolls are not currently na_tecelagem';
  END IF;

  -- MANTA NEVER GOES TO FINISHING (product rule). Re-derived here from the
  -- single existing owner of the tapete/manta distinction, never a second
  -- classification and never inferred from name, colour or width.
  IF EXISTS (
    SELECT 1
      FROM public.tecelagem_rolos r
      JOIN public.op_itens oi ON oi.id = r.op_item_id
      JOIN public.modelos  m  ON m.id  = oi.modelo_id
     WHERE r.id = ANY(v_ids)
       AND lower(coalesce(m.tipo_produto, 'tapete')) = 'manta'
  ) THEN
    RAISE EXCEPTION 'TECELAGEM_MANTA_NAO_VAI_PARA_ACABAMENTO'
      USING ERRCODE = '55000',
            DETAIL  = 'a Manta roll was included; Manta never goes through finishing output';
  END IF;

  -- === APPLY STAGE — every refusal above has already been raised ===

  UPDATE public.tecelagem_rolos r
     SET situacao = 'enviado_acabamento',
         enviado_acabamento_em = now(),
         enviado_acabamento_por = auth.uid()
   WHERE r.id = ANY(v_ids)
     AND r.fornecedor_id = v_fornecedor_id
     AND r.situacao = 'na_tecelagem';

  GET DIAGNOSTICS v_atualizados = ROW_COUNT;

  -- Structural self-check, same discipline as db/123's roll-creation proof:
  -- N validated rolls means exactly N updated rows, or an error — never a
  -- silently partial output.
  IF v_atualizados <> v_quantidade THEN
    RAISE EXCEPTION 'TECELAGEM_SAIDA_CARDINALIDADE_INCONSISTENTE'
      USING ERRCODE = 'P0001',
            DETAIL  = format('validated %s roll(s) but updated %s', v_quantidade, v_atualizados);
  END IF;

  RETURN jsonb_build_object(
    'rolo_ids',   v_ids,
    'quantidade', v_atualizados
  );
END
$fn$;

ALTER FUNCTION public.enviar_rolos_acabamento(BIGINT[]) OWNER TO postgres;

REVOKE ALL ON FUNCTION public.enviar_rolos_acabamento(BIGINT[])
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.enviar_rolos_acabamento(BIGINT[]) TO authenticated;

COMMENT ON FUNCTION public.enviar_rolos_acabamento(BIGINT[]) IS
  'db/125. THE ONLY write path for weaving finishing output. Validates completely (ownership, na_tecelagem, non-Manta), then applies: N validated rolls become N updated rows, or an error. Touches no Admin table, no Pedido, no romaneio/shipment record and no finishing receipt.';

-- ---------------------------------------------------------------------
-- 4. Verify — self-proving, in the same transaction as the migration
-- ---------------------------------------------------------------------
DO $verify$
DECLARE
  v_bad TEXT[] := ARRAY[]::TEXT[];
BEGIN
  -- 4.1 The situation model admits both ratified values. Matched by
  --     substring rather than one exact rendering of pg_get_constraintdef,
  --     which Postgres is free to normalize differently (e.g.
  --     `= ANY (ARRAY[...])` instead of an OR chain) without the
  --     constraint's MEANING changing. A stray THIRD value is separately
  --     impossible by construction: nothing in this migration or db/123
  --     ever assigns situacao from anywhere other than these two literals.
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid
     WHERE t.relname = 'tecelagem_rolos' AND c.conname = 'tecelagem_rolos_situacao_check'
       AND pg_get_constraintdef(c.oid) LIKE '%na_tecelagem%'
       AND pg_get_constraintdef(c.oid) LIKE '%enviado_acabamento%'
  ) THEN
    v_bad := array_append(v_bad, 'tecelagem_rolos.situacao does not admit both na_tecelagem and enviado_acabamento');
  END IF;

  -- 4.2 The audit columns exist and are nullable (both NULL while na_tecelagem).
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'tecelagem_rolos'
       AND column_name = 'enviado_acabamento_em' AND is_nullable = 'YES'
  ) THEN
    v_bad := array_append(v_bad, 'tecelagem_rolos.enviado_acabamento_em must be nullable');
  END IF;

  -- 4.3 No direct write grant survives on tecelagem_rolos: the writer remains
  --     the only path, exactly as db/123 established.
  IF EXISTS (
    SELECT 1 FROM information_schema.role_table_grants
     WHERE table_schema = 'public' AND table_name = 'tecelagem_rolos'
       AND privilege_type IN ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE')
       AND grantee IN ('PUBLIC', 'anon', 'authenticated', 'service_role')
  ) THEN
    v_bad := array_append(v_bad, 'a direct write grant survives on tecelagem_rolos');
  END IF;

  -- 4.4 No new RLS policy and no trigger were introduced.
  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'tecelagem_rolos'
  ) AND (
    SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'tecelagem_rolos'
  ) <> 2 THEN
    v_bad := array_append(v_bad, 'tecelagem_rolos must still carry exactly its two db/123 SELECT policies, no more');
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_trigger tg JOIN pg_class c ON c.oid = tg.tgrelid
     WHERE NOT tg.tgisinternal AND c.relname = 'tecelagem_rolos'
  ) THEN
    v_bad := array_append(v_bad, 'tecelagem_rolos carries a trigger; weaving must not propagate anywhere');
  END IF;

  -- 4.5 The writer exists, is SECURITY DEFINER and reachable only by
  --     authenticated.
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = 'enviar_rolos_acabamento' AND p.prosecdef IS TRUE
  ) THEN
    v_bad := array_append(v_bad, 'enviar_rolos_acabamento is missing or is not SECURITY DEFINER');
  END IF;

  IF has_function_privilege('anon', 'public.enviar_rolos_acabamento(bigint[])', 'EXECUTE')
     OR has_function_privilege('service_role', 'public.enviar_rolos_acabamento(bigint[])', 'EXECUTE') THEN
    v_bad := array_append(v_bad, 'the finishing-output writer is executable by anon or service_role');
  END IF;

  IF NOT has_function_privilege('authenticated', 'public.enviar_rolos_acabamento(bigint[])', 'EXECUTE') THEN
    v_bad := array_append(v_bad, 'the finishing-output writer is not executable by authenticated');
  END IF;

  -- 4.6 The writer actually re-derives Manta applicability from
  --     modelos.tipo_produto rather than trusting the caller.
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = 'enviar_rolos_acabamento'
       AND p.prosrc LIKE '%tipo_produto%' AND p.prosrc LIKE '%manta%'
  ) THEN
    v_bad := array_append(v_bad, 'enviar_rolos_acabamento does not re-derive the Manta guard from modelos.tipo_produto');
  END IF;

  -- 4.7 ISOLATION PROOF, asserted against the function body rather than
  --     prose: the writer reaches no Admin table and no Admin lifecycle
  --     writer.
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = 'enviar_rolos_acabamento'
       AND (p.prosrc ~* '(update|insert into|delete from)\s+(public\.)?(ops|op_itens|lotes|pedidos|expedicoes|romaneios)\M'
            OR p.prosrc ILIKE '%iniciar_producao_op%'
            OR p.prosrc ILIKE '%alterar_status_op%'
            OR p.prosrc ILIKE '%abrir_op_tecelagem%'
            OR p.prosrc ILIKE '%gerar_op_latex%')
  ) THEN
    v_bad := array_append(v_bad, 'enviar_rolos_acabamento reaches an Admin table or an Admin lifecycle writer');
  END IF;

  IF array_length(v_bad, 1) IS NOT NULL THEN
    RAISE EXCEPTION 'db/125 verify FAILED: %', array_to_string(v_bad, ' | ');
  END IF;

  RAISE NOTICE 'db/125 verify: OK — the roll situation model admits exactly na_tecelagem/enviado_acabamento, the writer validates completely then applies, Manta is refused server-side, and no pre-existing object outside tecelagem_rolos was touched';
END
$verify$;
