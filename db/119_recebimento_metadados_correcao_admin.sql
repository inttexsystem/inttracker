-- =============================================================================
-- db/119 — ADMIN CORRECTION OF NATIVE RECEIPT METADATA
-- =============================================================================
-- ORDER: RECEIPT-METADATA-ADMIN-CORRECTION-R1 (R4 / ASSURANCE).
--
-- PROBLEM (root cause). db/70 installed
-- public.trg_recebimento_header_immutable_guard as an UNCONDITIONAL
-- BEFORE UPDATE OR DELETE ... FOR EACH ROW refusal on
-- public.ordem_compra_recebimentos. That is correct for the physical receipt
-- facts, but it is TOO BROAD: it also freezes the four purely administrative
-- metadata columns (ocorrido_em, documento_ref, origem_tipo, origem_ref), so a
-- mistyped business date or document reference could only be corrected by
-- reversing and re-registering a receipt that physically happened exactly once.
--
-- WHAT THIS MIGRATION DOES, AND NOTHING WIDER:
--   1. narrows that guard so it still refuses EVERY delete and EVERY change to
--      a physical or identity column, but permits the four metadata columns to
--      change INSIDE the dedicated correction path and nowhere else;
--   2. adds the append-only audit owner
--      public.ordem_compra_recebimento_metadados_correcoes;
--   3. adds the single admin-only writer
--      public.corrigir_metadados_recebimento_ordem_compra.
--
-- WHAT IT DELIBERATELY DOES NOT DO:
--   - it does NOT make kg, lines, allocations, excess, OP provenance or
--     inventory movements mutable by any path;
--   - it does NOT touch comando_payload or comando_hash, so the exactly-once
--     idempotency discriminator of db/74 keeps comparing the command AS
--     ISSUED and replay detection is bit-for-bit unchanged;
--   - it does NOT write, reclassify or reprice any business row;
--   - it does NOT alter any existing receipt, ledger line, allocation or OP;
--   - it does NOT touch db/110, surplus semantics or the db/118 ceiling owner.
--
-- WHY NO READ MODEL IS REDEFINED HERE (requirement 6, measured not assumed).
-- Exactly TWO functions project native receipt business metadata, and BOTH
-- already read the header row directly, so both observe a correction with no
-- change of their own:
--   - public.obter_historico_recebimento_ordem_compra (db/100) selects
--     h.ocorrido_em, h.documento_ref, h.origem_tipo, h.origem_ref;
--   - public.listar_recebimentos_ordem_compra_normalizados (db/75) selects
--     h.ocorrido_em.
-- public.listar_ordens_compra_fio_compat (db/76) derives its date from the
-- denormalized line copy max(l.data_recebimento), but BOTH of its grains are
-- filtered by `oc.legado = TRUE`, so it projects ONLY legacy-compat orders and
-- can never render a native receipt. It is therefore NOT a contradictory
-- surface for this correction and is deliberately left untouched.
-- The line-level copies (ordem_compra_fio_lancamentos.data_recebimento,
-- .origem_tipo, .origem_ref) remain frozen ON PURPOSE: they are the immutable
-- record of the command as issued, they are not projected for native orders,
-- and rewriting them would mean mutating the physical ledger this order
-- forbids touching.
--
-- ROLLBACK: section 5 (inert). The delta is one function body, one table and
-- one function; no business data is involved either way.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 0. Entry gate — refuse to apply against a shape this migration did not read
-- -----------------------------------------------------------------------------
DO $gate$
DECLARE
  v_missing TEXT;
  v_cols INTEGER;
BEGIN
  IF to_regclass('public.ordem_compra_recebimentos') IS NULL THEN
    RAISE EXCEPTION 'db/119 gate: public.ordem_compra_recebimentos is absent';
  END IF;

  SELECT count(*) INTO v_cols
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'ordem_compra_recebimentos'
    AND column_name IN ('ocorrido_em', 'documento_ref', 'origem_tipo', 'origem_ref');
  IF v_cols <> 4 THEN
    RAISE EXCEPTION 'db/119 gate: expected the 4 metadata columns, found %', v_cols;
  END IF;

  -- The guard this migration narrows must be exactly the db/70 installation:
  -- one BEFORE UPDATE OR DELETE row trigger under the known name.
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'ordem_compra_recebimentos'
      AND t.tgname = 'trg_recebimento_header_immutable_guard'
      AND NOT t.tgisinternal
  ) THEN
    RAISE EXCEPTION 'db/119 gate: trg_recebimento_header_immutable_guard is not installed';
  END IF;

  -- The correction writer is meaningless while the native model is not the
  -- read authority.
  IF NOT EXISTS (
    SELECT 1 FROM public.ordem_compra_cutover
    WHERE id = 1 AND status = 'canonical_active' AND read_authority = 'canonical'
  ) THEN
    RAISE EXCEPTION 'db/119 gate: native receipt is not the canonical authority';
  END IF;

  -- Physical-fact protections this migration must NOT be able to weaken.
  FOREACH v_missing IN ARRAY ARRAY[
    'ordem_compra_fio_lancamentos',
    'ordem_compra_fio_movimentos_estoque'
  ] LOOP
    IF to_regclass('public.' || v_missing) IS NULL THEN
      RAISE EXCEPTION 'db/119 gate: public.% is absent', v_missing;
    END IF;
  END LOOP;
END;
$gate$;

-- Business-fact fingerprint captured BEFORE any change, re-compared in
-- section 6. This migration must move ZERO business rows.
CREATE TEMP TABLE _db119_before ON COMMIT DROP AS
SELECT
  (SELECT count(*) FROM public.ordem_compra_recebimentos)        AS recebimentos,
  (SELECT count(*) FROM public.ordem_compra_fio_lancamentos)     AS lancamentos,
  (SELECT count(*) FROM public.ordem_compra_fio_movimentos_estoque) AS movimentos,
  (SELECT count(*) FROM public.ordem_compra)                     AS ordens,
  (SELECT count(*) FROM public.ordem_compra_item_alocacao)       AS alocacoes,
  (SELECT count(*) FROM public.saldo_fios)                       AS saldo_fios,
  (SELECT md5(COALESCE(string_agg(t.linha, '|' ORDER BY t.linha), ''))
     FROM (
       SELECT h.id::TEXT || ':' || h.ocorrido_em::TEXT || ':' ||
              COALESCE(h.documento_ref, '') || ':' || h.origem_tipo || ':' ||
              COALESCE(h.origem_ref, '') || ':' || h.comando_hash AS linha
       FROM public.ordem_compra_recebimentos h
     ) t)                                                        AS header_fp,
  (SELECT md5(COALESCE(string_agg(t.linha, '|' ORDER BY t.linha), ''))
     FROM (
       SELECT l.id::TEXT || ':' || l.kg_recebido::TEXT || ':' || l.kg_excesso::TEXT || ':' ||
              COALESCE(l.ordem_compra_item_alocacao_id::TEXT, '') || ':' ||
              COALESCE(l.op_id::TEXT, '') AS linha
       FROM public.ordem_compra_fio_lancamentos l
     ) t)                                                        AS ledger_fp;

-- -----------------------------------------------------------------------------
-- 1. Append-only audit owner for metadata corrections
-- -----------------------------------------------------------------------------
-- Requirement: preserve auditability WITHOUT asking the administrator for a
-- correction reason. Everything recorded here is derived by the server from
-- the command itself; the admin types nothing extra.
CREATE TABLE IF NOT EXISTS public.ordem_compra_recebimento_metadados_correcoes (
  id                   BIGSERIAL PRIMARY KEY,
  recebimento_id       BIGINT NOT NULL REFERENCES public.ordem_compra_recebimentos(id) ON DELETE RESTRICT,
  ordem_compra_id      BIGINT NOT NULL REFERENCES public.ordem_compra(id) ON DELETE RESTRICT,
  ator_id              UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  corrigido_em         TIMESTAMPTZ NOT NULL DEFAULT now(),
  ocorrido_em_antes    TIMESTAMPTZ NOT NULL,
  ocorrido_em_depois   TIMESTAMPTZ NOT NULL,
  documento_ref_antes  TEXT,
  documento_ref_depois TEXT,
  origem_tipo_antes    TEXT NOT NULL,
  origem_tipo_depois   TEXT NOT NULL,
  origem_ref_antes     TEXT,
  origem_ref_depois    TEXT
);

COMMENT ON TABLE public.ordem_compra_recebimento_metadados_correcoes IS
  'db/119 append-only audit of administrative corrections to native receipt metadata. One row per effective correction (a no-op correction writes nothing). Records only the four correctable columns before/after plus who and when; the administrator is never asked for a reason.';

CREATE INDEX IF NOT EXISTS ordem_compra_recebimento_metadados_correcoes_recebimento_idx
  ON public.ordem_compra_recebimento_metadados_correcoes(recebimento_id, id);

ALTER TABLE public.ordem_compra_recebimento_metadados_correcoes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.ordem_compra_recebimento_metadados_correcoes FROM PUBLIC;
REVOKE ALL ON TABLE public.ordem_compra_recebimento_metadados_correcoes FROM anon;
REVOKE ALL ON TABLE public.ordem_compra_recebimento_metadados_correcoes FROM authenticated;
REVOKE ALL ON TABLE public.ordem_compra_recebimento_metadados_correcoes FROM service_role;
REVOKE ALL ON SEQUENCE public.ordem_compra_recebimento_metadados_correcoes_id_seq FROM PUBLIC;
REVOKE ALL ON SEQUENCE public.ordem_compra_recebimento_metadados_correcoes_id_seq FROM anon;
REVOKE ALL ON SEQUENCE public.ordem_compra_recebimento_metadados_correcoes_id_seq FROM authenticated;
REVOKE ALL ON SEQUENCE public.ordem_compra_recebimento_metadados_correcoes_id_seq FROM service_role;

-- The audit trail is itself append-only: it may never be edited or erased.
CREATE OR REPLACE FUNCTION public.trg_recebimento_metadados_correcao_immutable_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION 'ordem_compra_recebimento_metadados_correcoes is append-only: % is not permitted', TG_OP;
END;
$$;

ALTER FUNCTION public.trg_recebimento_metadados_correcao_immutable_guard() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.trg_recebimento_metadados_correcao_immutable_guard() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.trg_recebimento_metadados_correcao_immutable_guard() FROM anon;
REVOKE ALL ON FUNCTION public.trg_recebimento_metadados_correcao_immutable_guard() FROM authenticated;
REVOKE ALL ON FUNCTION public.trg_recebimento_metadados_correcao_immutable_guard() FROM service_role;

DROP TRIGGER IF EXISTS trg_recebimento_metadados_correcao_immutable_guard
  ON public.ordem_compra_recebimento_metadados_correcoes;
CREATE TRIGGER trg_recebimento_metadados_correcao_immutable_guard
  BEFORE UPDATE OR DELETE ON public.ordem_compra_recebimento_metadados_correcoes
  FOR EACH ROW EXECUTE FUNCTION public.trg_recebimento_metadados_correcao_immutable_guard();

-- -----------------------------------------------------------------------------
-- 2. Narrowed header guard — physical facts still frozen, metadata correctable
--    ONLY inside the dedicated writer
-- -----------------------------------------------------------------------------
-- The gate is a transaction-local GUC that ONLY
-- public.corrigir_metadados_recebimento_ordem_compra sets, carrying the exact
-- header id being corrected. A direct UPDATE — by any role, from any client,
-- with or without a table grant — never sets it and is refused exactly as
-- before. This is defence in depth: authenticated/anon already hold no UPDATE
-- privilege on the table at all (db/70 section 1), and the guard now also
-- stops service_role and any future accidental re-grant.
CREATE OR REPLACE FUNCTION public.trg_recebimento_header_immutable_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_token TEXT;
BEGIN
  -- A receipt header is NEVER deleted. Unchanged from db/70.
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'ordem_compra_recebimentos is immutable: % is not permitted', TG_OP;
  END IF;

  v_token := COALESCE(current_setting('oc.correcao_metadados_recebimento', TRUE), '');
  IF v_token = '' OR v_token IS DISTINCT FROM OLD.id::TEXT THEN
    RAISE EXCEPTION 'ordem_compra_recebimentos is immutable: % is not permitted', TG_OP;
  END IF;

  -- Only a physical RECEIPT carries correctable business metadata. A reversal
  -- header stays fully immutable.
  IF OLD.comando_tipo <> 'recebimento' THEN
    RAISE EXCEPTION 'ordem_compra_recebimentos: only a recebimento header may be corrected';
  END IF;

  -- Every identity, provenance and exactly-once column must be byte-identical.
  -- comando_payload and comando_hash are included ON PURPOSE: they describe the
  -- command AS ISSUED and are the idempotency discriminator of db/74, so a
  -- correction must never touch them.
  IF NEW.id                    IS DISTINCT FROM OLD.id
     OR NEW.ordem_compra_id       IS DISTINCT FROM OLD.ordem_compra_id
     OR NEW.comando_tipo          IS DISTINCT FROM OLD.comando_tipo
     OR NEW.idempotency_namespace IS DISTINCT FROM OLD.idempotency_namespace
     OR NEW.idempotency_key       IS DISTINCT FROM OLD.idempotency_key
     OR NEW.ator_id               IS DISTINCT FROM OLD.ator_id
     OR NEW.ator_tipo             IS DISTINCT FROM OLD.ator_tipo
     OR NEW.comando_payload       IS DISTINCT FROM OLD.comando_payload
     OR NEW.comando_hash          IS DISTINCT FROM OLD.comando_hash
     OR NEW.resultado_metadata    IS DISTINCT FROM OLD.resultado_metadata
     OR NEW.criado_em             IS DISTINCT FROM OLD.criado_em THEN
    RAISE EXCEPTION 'ordem_compra_recebimentos: only receipt metadata (ocorrido_em, documento_ref, origem_tipo, origem_ref) may be corrected';
  END IF;

  RETURN NEW;
END;
$$;

ALTER FUNCTION public.trg_recebimento_header_immutable_guard() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.trg_recebimento_header_immutable_guard() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.trg_recebimento_header_immutable_guard() FROM anon;
REVOKE ALL ON FUNCTION public.trg_recebimento_header_immutable_guard() FROM authenticated;
REVOKE ALL ON FUNCTION public.trg_recebimento_header_immutable_guard() FROM service_role;

COMMENT ON FUNCTION public.trg_recebimento_header_immutable_guard() IS
  'db/70 receipt-header immutability, NARROWED by db/119. DELETE is always refused. UPDATE is refused unless the transaction-local GUC oc.correcao_metadados_recebimento equals the header id (set only by corrigir_metadados_recebimento_ordem_compra), the header is a recebimento, and every identity/provenance/idempotency column is unchanged. Only ocorrido_em, documento_ref, origem_tipo and origem_ref may differ.';

-- -----------------------------------------------------------------------------
-- 3. The sole correction writer — admin only
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.corrigir_metadados_recebimento_ordem_compra(
  p_recebimento_id BIGINT,
  p_ocorrido_em    TIMESTAMPTZ,
  p_documento_ref  TEXT,
  p_origem_tipo    TEXT,
  p_origem_ref     TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
SET lock_timeout = '5s'
AS $$
DECLARE
  v_user   RECORD;
  v_header public.ordem_compra_recebimentos%ROWTYPE;
  v_doc    TEXT;
  v_tipo   TEXT;
  v_ref    TEXT;
  v_changed BOOLEAN;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'sem_permissao',
      'erro', 'Usuario nao autenticado');
  END IF;

  -- ADMIN ONLY. A supplier may register a receipt but may never correct its
  -- administrative metadata.
  SELECT u.tipo, u.ativo INTO v_user
  FROM public.usuarios u WHERE u.id = auth.uid();
  IF NOT COALESCE(v_user.ativo IS TRUE AND v_user.tipo = 'admin' AND public.is_admin(), FALSE) THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'sem_permissao',
      'erro', 'Apenas administradores podem corrigir metadados de recebimento');
  END IF;

  IF p_ocorrido_em IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'comando_invalido',
      'erro', 'A data do recebimento e obrigatoria');
  END IF;
  IF p_origem_tipo IS NULL OR length(btrim(p_origem_tipo)) NOT BETWEEN 1 AND 80 THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'comando_invalido',
      'erro', 'O tipo de origem e obrigatorio (1 a 80 caracteres)');
  END IF;

  -- Normalized exactly as the db/74 writer normalizes the same inputs, so a
  -- corrected value is indistinguishable from an originally-typed one.
  v_doc  := NULLIF(btrim(p_documento_ref), '');
  v_tipo := btrim(p_origem_tipo);
  v_ref  := NULLIF(btrim(p_origem_ref), '');

  SELECT * INTO v_header
  FROM public.ordem_compra_recebimentos
  WHERE id = p_recebimento_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'nao_encontrado',
      'erro', 'Recebimento nao encontrado');
  END IF;

  IF v_header.comando_tipo <> 'recebimento' THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'estado_invalido',
      'erro', 'Somente um recebimento pode ter os metadados corrigidos');
  END IF;

  v_changed := (v_header.ocorrido_em   IS DISTINCT FROM p_ocorrido_em)
            OR (v_header.documento_ref IS DISTINCT FROM v_doc)
            OR (v_header.origem_tipo   IS DISTINCT FROM v_tipo)
            OR (v_header.origem_ref    IS DISTINCT FROM v_ref);

  IF v_changed THEN
    -- Open the narrowed guard for THIS header only, for THIS transaction only.
    PERFORM set_config('oc.correcao_metadados_recebimento', v_header.id::TEXT, TRUE);

    UPDATE public.ordem_compra_recebimentos
    SET ocorrido_em   = p_ocorrido_em,
        documento_ref = v_doc,
        origem_tipo   = v_tipo,
        origem_ref    = v_ref
    WHERE id = v_header.id;

    -- Close it again immediately, so no later statement in this transaction
    -- can ride the same opening.
    PERFORM set_config('oc.correcao_metadados_recebimento', '', TRUE);

    INSERT INTO public.ordem_compra_recebimento_metadados_correcoes(
      recebimento_id, ordem_compra_id, ator_id,
      ocorrido_em_antes, ocorrido_em_depois,
      documento_ref_antes, documento_ref_depois,
      origem_tipo_antes, origem_tipo_depois,
      origem_ref_antes, origem_ref_depois
    ) VALUES (
      v_header.id, v_header.ordem_compra_id, auth.uid(),
      v_header.ocorrido_em, p_ocorrido_em,
      v_header.documento_ref, v_doc,
      v_header.origem_tipo, v_tipo,
      v_header.origem_ref, v_ref
    );
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'codigo', 'ok',
    'recebimento_id', v_header.id,
    'ordem_compra_id', v_header.ordem_compra_id,
    'alterado', v_changed,
    'ocorrido_em', p_ocorrido_em,
    'documento_ref', v_doc,
    'origem_tipo', v_tipo,
    'origem_ref', v_ref
  );
EXCEPTION
  WHEN lock_not_available THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'concorrencia_ocupada',
      'erro', 'Outra operacao esta alterando este recebimento. Tente novamente.');
END;
$$;

ALTER FUNCTION public.corrigir_metadados_recebimento_ordem_compra(BIGINT, TIMESTAMPTZ, TEXT, TEXT, TEXT) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.corrigir_metadados_recebimento_ordem_compra(BIGINT, TIMESTAMPTZ, TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.corrigir_metadados_recebimento_ordem_compra(BIGINT, TIMESTAMPTZ, TEXT, TEXT, TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.corrigir_metadados_recebimento_ordem_compra(BIGINT, TIMESTAMPTZ, TEXT, TEXT, TEXT) FROM service_role;
GRANT EXECUTE ON FUNCTION public.corrigir_metadados_recebimento_ordem_compra(BIGINT, TIMESTAMPTZ, TEXT, TEXT, TEXT) TO authenticated;

COMMENT ON FUNCTION public.corrigir_metadados_recebimento_ordem_compra(BIGINT, TIMESTAMPTZ, TEXT, TEXT, TEXT) IS
  'db/119 sole administrative correction path for native receipt metadata. Admin only. Corrects exactly ocorrido_em, documento_ref, origem_tipo and origem_ref on a recebimento header, records the before/after in ordem_compra_recebimento_metadados_correcoes without asking for a reason, and leaves quantities, lines, allocations, excess, OP provenance, inventory movements, comando_payload and comando_hash untouched. A correction that changes nothing writes nothing and returns alterado = false.';

-- -----------------------------------------------------------------------------
-- 4. Post-change verification — inside the same transaction
-- -----------------------------------------------------------------------------
DO $verify$
DECLARE
  v_before RECORD;
BEGIN
  SELECT * INTO v_before FROM _db119_before;

  IF (SELECT count(*) FROM public.ordem_compra_recebimentos) <> v_before.recebimentos
     OR (SELECT count(*) FROM public.ordem_compra_fio_lancamentos) <> v_before.lancamentos
     OR (SELECT count(*) FROM public.ordem_compra_fio_movimentos_estoque) <> v_before.movimentos
     OR (SELECT count(*) FROM public.ordem_compra) <> v_before.ordens
     OR (SELECT count(*) FROM public.ordem_compra_item_alocacao) <> v_before.alocacoes
     OR (SELECT count(*) FROM public.saldo_fios) <> v_before.saldo_fios THEN
    RAISE EXCEPTION 'db/119 verify: a business row count moved; refusing to commit';
  END IF;

  IF (SELECT md5(COALESCE(string_agg(t.linha, '|' ORDER BY t.linha), ''))
        FROM (
          SELECT h.id::TEXT || ':' || h.ocorrido_em::TEXT || ':' ||
                 COALESCE(h.documento_ref, '') || ':' || h.origem_tipo || ':' ||
                 COALESCE(h.origem_ref, '') || ':' || h.comando_hash AS linha
          FROM public.ordem_compra_recebimentos h
        ) t) IS DISTINCT FROM v_before.header_fp THEN
    RAISE EXCEPTION 'db/119 verify: an existing receipt header changed; refusing to commit';
  END IF;

  IF (SELECT md5(COALESCE(string_agg(t.linha, '|' ORDER BY t.linha), ''))
        FROM (
          SELECT l.id::TEXT || ':' || l.kg_recebido::TEXT || ':' || l.kg_excesso::TEXT || ':' ||
                 COALESCE(l.ordem_compra_item_alocacao_id::TEXT, '') || ':' ||
                 COALESCE(l.op_id::TEXT, '') AS linha
          FROM public.ordem_compra_fio_lancamentos l
        ) t) IS DISTINCT FROM v_before.ledger_fp THEN
    RAISE EXCEPTION 'db/119 verify: a ledger line changed; refusing to commit';
  END IF;

  -- The audit trail starts empty: applying the migration corrects nothing.
  IF (SELECT count(*) FROM public.ordem_compra_recebimento_metadados_correcoes) <> 0 THEN
    RAISE EXCEPTION 'db/119 verify: the correction audit table is not empty after apply';
  END IF;

  -- The writer must be reachable by authenticated and by nobody else.
  IF NOT has_function_privilege('authenticated',
        'public.corrigir_metadados_recebimento_ordem_compra(bigint, timestamptz, text, text, text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'db/119 verify: authenticated cannot execute the correction writer';
  END IF;
  IF has_function_privilege('anon',
        'public.corrigir_metadados_recebimento_ordem_compra(bigint, timestamptz, text, text, text)', 'EXECUTE')
     OR has_function_privilege('service_role',
        'public.corrigir_metadados_recebimento_ordem_compra(bigint, timestamptz, text, text, text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'db/119 verify: anon or service_role can execute the correction writer';
  END IF;

  -- No client role may touch the header table or the audit table directly.
  IF has_table_privilege('authenticated', 'public.ordem_compra_recebimentos', 'UPDATE')
     OR has_table_privilege('anon', 'public.ordem_compra_recebimentos', 'UPDATE') THEN
    RAISE EXCEPTION 'db/119 verify: a client role holds direct UPDATE on the receipt header';
  END IF;
  IF has_table_privilege('authenticated', 'public.ordem_compra_recebimento_metadados_correcoes', 'SELECT')
     OR has_table_privilege('anon', 'public.ordem_compra_recebimento_metadados_correcoes', 'INSERT') THEN
    RAISE EXCEPTION 'db/119 verify: a client role reaches the correction audit table directly';
  END IF;
END;
$verify$;

COMMIT;

-- -----------------------------------------------------------------------------
-- 5. ROLLBACK (inert — reference only, never executed by this file)
-- -----------------------------------------------------------------------------
-- Restores the db/70 unconditional guard and removes everything db/119 added.
-- Safe at any time: it destroys no business data, only the audit trail.
--
--   CREATE OR REPLACE FUNCTION public.trg_recebimento_header_immutable_guard()
--   RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
--   BEGIN
--     RAISE EXCEPTION 'ordem_compra_recebimentos is immutable: % is not permitted', TG_OP;
--   END;
--   $$;
--   DROP FUNCTION IF EXISTS public.corrigir_metadados_recebimento_ordem_compra(BIGINT, TIMESTAMPTZ, TEXT, TEXT, TEXT);
--   DROP TRIGGER IF EXISTS trg_recebimento_metadados_correcao_immutable_guard
--     ON public.ordem_compra_recebimento_metadados_correcoes;
--   DROP TABLE IF EXISTS public.ordem_compra_recebimento_metadados_correcoes;
--   DROP FUNCTION IF EXISTS public.trg_recebimento_metadados_correcao_immutable_guard();
