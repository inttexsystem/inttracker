-- ============================================================
-- Fase: RAVATEX-DOCUMENTS-G28-B6-CANONICAL-DOCUMENT-LINKS-MIGRATION-PATCH
-- Persistencia canonica, tipada e versionada dos vinculos humanos
-- confirmados entre Documento, Pedido e OP.
--
-- Escopo desta fase (SQL versionado, aditivo):
--   - public.document_link_revisions      (uma revisao completa de vinculo por documento)
--   - public.document_link_revision_ops   (OPs confirmadas da revisao; 0..N)
--   - RPC public.registrar_vinculos_documento(...)          (comando idempotente de vinculo)
--   - RPC public.registrar_decisao_e_vinculos_documento(...)(composicao atomica decisao+vinculo)
--
-- Cardinalidades canonicas:
--   Documento -> Pedido : 0..1 Pedido confirmado
--   Documento -> OP     : 0..N OPs confirmadas
--
-- Fronteira de propriedade:
--   document_candidates.pedido_id / document_events.pedido_id NAO sao o vinculo
--   canonico humano confirmado. Esta migration NAO os promove, popula nem
--   reinterpreta. document_candidates.pedido_manual permanece somente sugestao
--   do Ingestor. A fonte de verdade do vinculo confirmado sao as tabelas abaixo,
--   mutadas somente pelas RPCs admin-only idempotentes.
--
-- Aplicar SOMENTE em staging ucrjtfswnfdlxwtmxnoo. Producao bhgifjrfagkzubpyqpew
-- proibida. Migration aditiva: sem backfill, sem mutacao de campos historicos de
-- candidate/event, sem migracao destrutiva, sem alteracao das RPCs de decisao B5
-- (registrar_decisao_documento, desfazer_decisao_documento) nem da legada
-- decidir_documento.
--
-- Idempotente: usa IF NOT EXISTS, CREATE OR REPLACE e reaplica revoke/grant.
-- Sem apply automatico, sem dados reais, sem secrets.
-- ============================================================


-- ============================================================
-- 1. Tabela public.document_link_revisions
-- ============================================================

CREATE TABLE IF NOT EXISTS public.document_link_revisions (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id        TEXT        NOT NULL
                       REFERENCES public.document_candidates(document_id) ON DELETE RESTRICT,
  pedido_id          UUID
                       REFERENCES public.pedidos(id) ON DELETE RESTRICT,
  version            INTEGER     NOT NULL,
  active             BOOLEAN     NOT NULL DEFAULT TRUE,
  command_id         UUID        NOT NULL,
  created_by         UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_by         UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  revoked_at         TIMESTAMPTZ,
  revocation_reason  TEXT
);

COMMENT ON TABLE public.document_link_revisions IS
  'Vinculo canonico humano-confirmado do documento. Cada linha e uma revisao completa do estado de vinculo (Documento->Pedido 0..1). Fonte de verdade do vinculo confirmado; document_candidates.pedido_id NAO e este vinculo. Escrita apenas via RPC registrar_vinculos_documento.';
COMMENT ON COLUMN public.document_link_revisions.document_id IS
  'FK tipada para public.document_candidates(document_id) (TEXT). Documento dono da revisao.';
COMMENT ON COLUMN public.document_link_revisions.pedido_id IS
  'FK tipada nullable para public.pedidos(id) (UUID). Pedido confirmado (0..1). NULL = estado de vinculo sem Pedido (avulso/explicito vazio).';
COMMENT ON COLUMN public.document_link_revisions.version IS
  'Versao monotonica por documento. Unica em (document_id, version). Preservada mesmo apos revogacao.';
COMMENT ON COLUMN public.document_link_revisions.active IS
  'TRUE para a unica revisao vigente por documento. Revisoes anteriores ficam active = FALSE e revogadas, nunca apagadas.';
COMMENT ON COLUMN public.document_link_revisions.command_id IS
  'Identificador idempotente do comando de vinculo. Unico. Um comando gera no maximo uma revisao.';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'document_link_revisions_version_check'
       AND conrelid = 'public.document_link_revisions'::regclass
  ) THEN
    ALTER TABLE public.document_link_revisions
      ADD CONSTRAINT document_link_revisions_version_check
      CHECK (version >= 1);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'document_link_revisions_document_version_key'
       AND conrelid = 'public.document_link_revisions'::regclass
  ) THEN
    ALTER TABLE public.document_link_revisions
      ADD CONSTRAINT document_link_revisions_document_version_key
      UNIQUE (document_id, version);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'document_link_revisions_command_id_key'
       AND conrelid = 'public.document_link_revisions'::regclass
  ) THEN
    ALTER TABLE public.document_link_revisions
      ADD CONSTRAINT document_link_revisions_command_id_key
      UNIQUE (command_id);
  END IF;

  -- active/revocation consistency:
  --   active   -> nenhum campo de revogacao preenchido
  --   inactive -> revogada (revoked_at obrigatorio; revoked_by pode virar NULL
  --               por ON DELETE SET NULL sem quebrar auditoria)
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'document_link_revisions_active_revocation_check'
       AND conrelid = 'public.document_link_revisions'::regclass
  ) THEN
    ALTER TABLE public.document_link_revisions
      ADD CONSTRAINT document_link_revisions_active_revocation_check
      CHECK (
        (active IS TRUE
          AND revoked_at IS NULL
          AND revoked_by IS NULL
          AND revocation_reason IS NULL)
        OR
        (active IS FALSE
          AND revoked_at IS NOT NULL)
      );
  END IF;
END;
$$;


-- ============================================================
-- 2. Tabela public.document_link_revision_ops
-- ============================================================

CREATE TABLE IF NOT EXISTS public.document_link_revision_ops (
  revision_id  UUID        NOT NULL
                 REFERENCES public.document_link_revisions(id) ON DELETE RESTRICT,
  op_id        BIGINT      NOT NULL
                 REFERENCES public.ops(id) ON DELETE RESTRICT,
  criado_em    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (revision_id, op_id)
);

COMMENT ON TABLE public.document_link_revision_ops IS
  'OPs confirmadas de uma revisao de vinculo (Documento->OP 0..N). PK (revision_id, op_id) impede OP duplicada na revisao. FK tipada para ops(id) (BIGINT) e para a revisao. ON DELETE RESTRICT preserva auditoria.';
COMMENT ON COLUMN public.document_link_revision_ops.revision_id IS
  'FK tipada para public.document_link_revisions(id). Revisao dona deste vinculo de OP.';
COMMENT ON COLUMN public.document_link_revision_ops.op_id IS
  'FK tipada para public.ops(id) (BIGINT). OP confirmada. Compatibilidade Pedido/OP validada pela RPC no momento do vinculo.';


-- ============================================================
-- 3. Indices
-- ============================================================

CREATE INDEX IF NOT EXISTS document_link_revisions_document_idx
  ON public.document_link_revisions(document_id);

CREATE UNIQUE INDEX IF NOT EXISTS document_link_revisions_active_uidx
  ON public.document_link_revisions(document_id)
  WHERE active IS TRUE;

CREATE INDEX IF NOT EXISTS document_link_revisions_pedido_idx
  ON public.document_link_revisions(pedido_id)
  WHERE pedido_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS document_link_revision_ops_op_idx
  ON public.document_link_revision_ops(op_id);


-- ============================================================
-- 4. RLS admin-only e grants (mesmo padrao das tabelas de documentos)
-- ============================================================

ALTER TABLE public.document_link_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_link_revision_ops ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS document_link_revisions_admin_all ON public.document_link_revisions;
CREATE POLICY document_link_revisions_admin_all ON public.document_link_revisions
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS document_link_revision_ops_admin_all ON public.document_link_revision_ops;
CREATE POLICY document_link_revision_ops_admin_all ON public.document_link_revision_ops
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

REVOKE ALL ON TABLE public.document_link_revisions FROM PUBLIC;
REVOKE ALL ON TABLE public.document_link_revision_ops FROM PUBLIC;
REVOKE ALL ON TABLE public.document_link_revisions FROM anon;
REVOKE ALL ON TABLE public.document_link_revision_ops FROM anon;
REVOKE ALL ON TABLE public.document_link_revisions FROM authenticated;
REVOKE ALL ON TABLE public.document_link_revision_ops FROM authenticated;

-- Leitura direta admin via RLS; escrita apenas pelas RPCs SECURITY DEFINER.
GRANT SELECT ON TABLE public.document_link_revisions TO authenticated;
GRANT SELECT ON TABLE public.document_link_revision_ops TO authenticated;


-- ============================================================
-- 5. RPC public.registrar_vinculos_documento
--    Comando idempotente de vinculo canonico. Recebe o conjunto
--    completo desejado de vinculos e o materializa como nova
--    revisao ativa, revogando (sem apagar) a anterior.
-- ============================================================

CREATE OR REPLACE FUNCTION public.registrar_vinculos_documento(
  p_document_id TEXT,
  p_pedido_id UUID,
  p_op_ids BIGINT[],
  p_command_id UUID,
  p_expected_active_revision_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_document_id TEXT := NULLIF(btrim(p_document_id), '');
  v_pedido_id UUID := p_pedido_id;
  v_command_id UUID := p_command_id;
  v_expected_active_id UUID := p_expected_active_revision_id;
  v_candidate public.document_candidates%ROWTYPE;
  v_existing public.document_link_revisions%ROWTYPE;
  v_active public.document_link_revisions%ROWTYPE;
  v_active_found BOOLEAN := FALSE;
  v_op_ids BIGINT[] := ARRAY[]::BIGINT[];
  v_op_count INTEGER := 0;
  v_distinct_count INTEGER := 0;
  v_op BIGINT;
  v_op_status TEXT;
  v_op_pedido UUID;
  v_op_found BOOLEAN;
  v_pedido_status TEXT;
  v_existing_op_ids BIGINT[] := ARRAY[]::BIGINT[];
  v_active_op_ids BIGINT[] := ARRAY[]::BIGINT[];
  v_active_id UUID;
  v_new_revision_id UUID;
  v_next_version INTEGER;
BEGIN
  -- Input validation
  IF v_document_id IS NULL THEN
    RETURN jsonb_build_object('ok', FALSE, 'outcome', 'input_error',
      'command_id', v_command_id, 'document_id', NULL::TEXT,
      'revision_id', NULL::UUID, 'active_revision_id', NULL::UUID,
      'error', 'document_id_required');
  END IF;

  IF v_command_id IS NULL THEN
    RETURN jsonb_build_object('ok', FALSE, 'outcome', 'input_error',
      'command_id', NULL::UUID, 'document_id', v_document_id,
      'revision_id', NULL::UUID, 'active_revision_id', NULL::UUID,
      'error', 'command_id_required');
  END IF;

  -- Normalize OP ids: drop NULLs, sort ascending
  IF p_op_ids IS NOT NULL THEN
    SELECT COALESCE(array_agg(x ORDER BY x), ARRAY[]::BIGINT[])
      INTO v_op_ids
      FROM unnest(p_op_ids) AS x
     WHERE x IS NOT NULL;
  END IF;
  v_op_count := COALESCE(array_length(v_op_ids, 1), 0);

  -- Reject duplicate OP ids
  SELECT COALESCE(array_length(array_agg(DISTINCT x), 1), 0)
    INTO v_distinct_count
    FROM unnest(v_op_ids) AS x;
  IF v_op_count <> v_distinct_count THEN
    RETURN jsonb_build_object('ok', FALSE, 'outcome', 'duplicate_op',
      'command_id', v_command_id, 'document_id', v_document_id,
      'revision_id', NULL::UUID, 'active_revision_id', NULL::UUID,
      'error', 'duplicate_op');
  END IF;

  -- Authorization: admin only, actor from auth.uid()
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('ok', FALSE, 'outcome', 'auth_error',
      'command_id', v_command_id, 'document_id', v_document_id,
      'revision_id', NULL::UUID, 'active_revision_id', NULL::UUID,
      'error', 'admin_required');
  END IF;

  -- Lock candidate (ownership boundary: candidate is read-only here)
  SELECT * INTO v_candidate
    FROM public.document_candidates
   WHERE document_id = v_document_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', FALSE, 'outcome', 'candidate_not_found',
      'command_id', v_command_id, 'document_id', v_document_id,
      'revision_id', NULL::UUID, 'active_revision_id', NULL::UUID,
      'error', 'candidate_not_found');
  END IF;

  -- Transaction-scoped advisory lock keyed by command_id
  PERFORM pg_advisory_xact_lock(hashtext(v_command_id::text));

  -- Idempotent command inspection after locks
  SELECT * INTO v_existing
    FROM public.document_link_revisions
   WHERE command_id = v_command_id
   FOR UPDATE;

  IF FOUND THEN
    SELECT COALESCE(array_agg(op_id ORDER BY op_id), ARRAY[]::BIGINT[])
      INTO v_existing_op_ids
      FROM public.document_link_revision_ops
     WHERE revision_id = v_existing.id;

    SELECT id INTO v_active_id
      FROM public.document_link_revisions
     WHERE document_id = v_document_id AND active IS TRUE
     LIMIT 1;

    -- Exact normalized payload -> idempotent replay
    IF v_existing.document_id = v_document_id
       AND v_existing.pedido_id IS NOT DISTINCT FROM v_pedido_id
       AND v_existing_op_ids = v_op_ids
    THEN
      RETURN jsonb_build_object('ok', TRUE, 'outcome', 'replayed',
        'command_id', v_command_id, 'document_id', v_document_id,
        'revision_id', v_existing.id, 'active_revision_id', v_active_id,
        'error', NULL::TEXT);
    END IF;

    -- Same command_id, different payload -> conflict, no mutation
    RETURN jsonb_build_object('ok', FALSE, 'outcome', 'command_conflict',
      'command_id', v_command_id, 'document_id', v_document_id,
      'revision_id', NULL::UUID, 'active_revision_id', v_active_id,
      'error', 'command_conflict');
  END IF;

  -- Validate desired targets: existence, not-cancelled, compatibility.
  -- Fail closed on any invalid target. No inference from suggestion/CNPJ/etc.
  IF v_pedido_id IS NOT NULL THEN
    SELECT status INTO v_pedido_status FROM public.pedidos WHERE id = v_pedido_id;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('ok', FALSE, 'outcome', 'pedido_not_found',
        'command_id', v_command_id, 'document_id', v_document_id,
        'revision_id', NULL::UUID, 'active_revision_id', NULL::UUID,
        'error', 'pedido_not_found');
    END IF;
    IF v_pedido_status = 'cancelado' THEN
      RETURN jsonb_build_object('ok', FALSE, 'outcome', 'pedido_not_linkable',
        'command_id', v_command_id, 'document_id', v_document_id,
        'revision_id', NULL::UUID, 'active_revision_id', NULL::UUID,
        'error', 'pedido_not_linkable');
    END IF;
  END IF;

  IF v_op_count > 0 THEN
    FOREACH v_op IN ARRAY v_op_ids LOOP
      v_op_found := FALSE;
      SELECT TRUE, o.status, l.pedido_id
        INTO v_op_found, v_op_status, v_op_pedido
        FROM public.ops o
        LEFT JOIN public.lotes l ON l.id = o.lote_id
       WHERE o.id = v_op;

      IF NOT COALESCE(v_op_found, FALSE) THEN
        RETURN jsonb_build_object('ok', FALSE, 'outcome', 'op_not_found',
          'command_id', v_command_id, 'document_id', v_document_id,
          'revision_id', NULL::UUID, 'active_revision_id', NULL::UUID,
          'op_id', v_op, 'error', 'op_not_found');
      END IF;

      IF v_op_status = 'cancelada' THEN
        RETURN jsonb_build_object('ok', FALSE, 'outcome', 'op_not_linkable',
          'command_id', v_command_id, 'document_id', v_document_id,
          'revision_id', NULL::UUID, 'active_revision_id', NULL::UUID,
          'op_id', v_op, 'error', 'op_not_linkable');
      END IF;

      IF v_pedido_id IS NOT NULL THEN
        -- Compatibility: OP must resolve, via its canonical lote, to the same Pedido.
        IF v_op_pedido IS NULL OR v_op_pedido <> v_pedido_id THEN
          RETURN jsonb_build_object('ok', FALSE, 'outcome', 'op_pedido_mismatch',
            'command_id', v_command_id, 'document_id', v_document_id,
            'revision_id', NULL::UUID, 'active_revision_id', NULL::UUID,
            'op_id', v_op, 'error', 'op_pedido_mismatch');
        END IF;
      ELSE
        -- No confirmed Pedido: every OP must be genuinely avulsa.
        IF v_op_pedido IS NOT NULL THEN
          RETURN jsonb_build_object('ok', FALSE, 'outcome', 'op_not_avulsa',
            'command_id', v_command_id, 'document_id', v_document_id,
            'revision_id', NULL::UUID, 'active_revision_id', NULL::UUID,
            'op_id', v_op, 'error', 'op_not_avulsa');
        END IF;
      END IF;
    END LOOP;
  END IF;

  -- Inspect current active revision
  SELECT * INTO v_active
    FROM public.document_link_revisions
   WHERE document_id = v_document_id
     AND active IS TRUE
   FOR UPDATE;
  v_active_found := FOUND;

  IF v_active_found THEN
    SELECT COALESCE(array_agg(op_id ORDER BY op_id), ARRAY[]::BIGINT[])
      INTO v_active_op_ids
      FROM public.document_link_revision_ops
     WHERE revision_id = v_active.id;

    -- Optimistic concurrency: mutation requires matching expected id.
    IF v_expected_active_id IS NULL THEN
      IF v_active.pedido_id IS NOT DISTINCT FROM v_pedido_id
         AND v_active_op_ids = v_op_ids THEN
        RETURN jsonb_build_object('ok', TRUE, 'outcome', 'no_change',
          'command_id', v_command_id, 'document_id', v_document_id,
          'revision_id', v_active.id, 'active_revision_id', v_active.id,
          'error', NULL::TEXT);
      END IF;
      RETURN jsonb_build_object('ok', FALSE, 'outcome', 'active_revision_exists',
        'command_id', v_command_id, 'document_id', v_document_id,
        'revision_id', v_active.id, 'active_revision_id', v_active.id,
        'error', 'active_revision_exists');
    END IF;

    IF v_expected_active_id IS DISTINCT FROM v_active.id THEN
      RETURN jsonb_build_object('ok', FALSE, 'outcome', 'stale_active_revision',
        'command_id', v_command_id, 'document_id', v_document_id,
        'revision_id', v_active.id, 'active_revision_id', v_active.id,
        'error', 'stale_active_revision');
    END IF;

    -- expected matches active: no-op when normalized desired == active
    IF v_active.pedido_id IS NOT DISTINCT FROM v_pedido_id
       AND v_active_op_ids = v_op_ids THEN
      RETURN jsonb_build_object('ok', TRUE, 'outcome', 'no_change',
        'command_id', v_command_id, 'document_id', v_document_id,
        'revision_id', v_active.id, 'active_revision_id', v_active.id,
        'error', NULL::TEXT);
    END IF;

    -- Replace: revoke previous active (preserved, not deleted), insert new active
    UPDATE public.document_link_revisions
       SET active = FALSE,
           revoked_by = auth.uid(),
           revoked_at = now(),
           revocation_reason = 'superseded'
     WHERE id = v_active.id;

    SELECT COALESCE(MAX(version), 0) + 1 INTO v_next_version
      FROM public.document_link_revisions
     WHERE document_id = v_document_id;

    INSERT INTO public.document_link_revisions (
      document_id, pedido_id, version, active, command_id, created_by
    ) VALUES (
      v_document_id, v_pedido_id, v_next_version, TRUE, v_command_id, auth.uid()
    )
    RETURNING id INTO v_new_revision_id;

    IF v_op_count > 0 THEN
      INSERT INTO public.document_link_revision_ops (revision_id, op_id)
        SELECT v_new_revision_id, x FROM unnest(v_op_ids) AS x;
    END IF;

    RETURN jsonb_build_object('ok', TRUE, 'outcome', 'updated',
      'command_id', v_command_id, 'document_id', v_document_id,
      'revision_id', v_new_revision_id, 'active_revision_id', v_new_revision_id,
      'previous_revision_id', v_active.id, 'error', NULL::TEXT);
  ELSE
    -- No active revision
    IF v_expected_active_id IS NOT NULL THEN
      RETURN jsonb_build_object('ok', FALSE, 'outcome', 'stale_active_revision',
        'command_id', v_command_id, 'document_id', v_document_id,
        'revision_id', NULL::UUID, 'active_revision_id', NULL::UUID,
        'error', 'stale_active_revision');
    END IF;

    -- First revision for this document (version monotonic even past revoked ones)
    SELECT COALESCE(MAX(version), 0) + 1 INTO v_next_version
      FROM public.document_link_revisions
     WHERE document_id = v_document_id;

    INSERT INTO public.document_link_revisions (
      document_id, pedido_id, version, active, command_id, created_by
    ) VALUES (
      v_document_id, v_pedido_id, v_next_version, TRUE, v_command_id, auth.uid()
    )
    RETURNING id INTO v_new_revision_id;

    IF v_op_count > 0 THEN
      INSERT INTO public.document_link_revision_ops (revision_id, op_id)
        SELECT v_new_revision_id, x FROM unnest(v_op_ids) AS x;
    END IF;

    RETURN jsonb_build_object('ok', TRUE, 'outcome', 'created',
      'command_id', v_command_id, 'document_id', v_document_id,
      'revision_id', v_new_revision_id, 'active_revision_id', v_new_revision_id,
      'previous_revision_id', NULL::UUID, 'error', NULL::TEXT);
  END IF;
END;
$$;

COMMENT ON FUNCTION public.registrar_vinculos_documento(TEXT, UUID, BIGINT[], UUID, UUID) IS
  'Admin-only: comando idempotente de vinculo canonico Documento->Pedido(0..1)/OP(0..N). Locks por candidate FOR UPDATE + advisory lock por command_id. Valida existencia, alvo nao-cancelado e compatibilidade Pedido/OP (via lotes.pedido_id) fail-closed. Outcomes: created, updated, no_change, replayed, active_revision_exists, stale_active_revision, command_conflict, candidate_not_found, duplicate_op, pedido_not_found, pedido_not_linkable, op_not_found, op_not_linkable, op_pedido_mismatch, op_not_avulsa, input_error, auth_error. Revoga a revisao anterior sem apagar; nunca infere vinculo; nenhum efeito operacional.';


-- ============================================================
-- 6. RPC public.registrar_decisao_e_vinculos_documento
--    Composicao atomica da acao aceita "Validar e vincular":
--    registrar_vinculos_documento + registrar_decisao_documento.
--    Ambas as funcoes canonicas permanecem donas independentes; esta
--    RPC nao duplica nem enfraquece suas regras. Rollback total se
--    qualquer uma falhar; command_ids idempotentes independentes.
-- ============================================================

CREATE OR REPLACE FUNCTION public.registrar_decisao_e_vinculos_documento(
  p_document_id TEXT,
  p_pedido_id UUID,
  p_op_ids BIGINT[],
  p_link_command_id UUID,
  p_expected_active_revision_id UUID,
  p_decision TEXT,
  p_motivo TEXT,
  p_decision_command_id UUID,
  p_expected_active_decision_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_link JSONB;
  v_decision JSONB;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('ok', FALSE, 'outcome', 'auth_error',
      'stage', 'auth', 'links', NULL::JSONB, 'decision', NULL::JSONB,
      'error', 'admin_required');
  END IF;

  BEGIN
    -- Links first. On business-rule failure it returns ok=FALSE WITHOUT writing.
    v_link := public.registrar_vinculos_documento(
      p_document_id, p_pedido_id, p_op_ids, p_link_command_id, p_expected_active_revision_id
    );

    IF NOT COALESCE((v_link->>'ok')::boolean, FALSE) THEN
      RETURN jsonb_build_object('ok', FALSE, 'outcome', 'link_failed',
        'stage', 'links', 'links', v_link, 'decision', NULL::JSONB,
        'error', COALESCE(v_link->>'outcome', 'link_error'));
    END IF;

    -- Decision second. Failure rolls back the link write via the block savepoint.
    v_decision := public.registrar_decisao_documento(
      p_document_id, p_decision, p_motivo, p_decision_command_id, p_expected_active_decision_id
    );

    IF NOT COALESCE((v_decision->>'ok')::boolean, FALSE) THEN
      RAISE EXCEPTION 'ravatex_decision_failed'
        USING ERRCODE = 'P0001',
              DETAIL = COALESCE(v_decision->>'outcome', 'decision_error');
    END IF;

    RETURN jsonb_build_object('ok', TRUE, 'outcome', 'applied',
      'stage', 'complete', 'links', v_link, 'decision', v_decision,
      'error', NULL::TEXT);
  EXCEPTION WHEN OTHERS THEN
    -- Atomic rollback: the link revision write (if any) is undone with the
    -- block savepoint. Return the structured decision failure when available.
    RETURN jsonb_build_object('ok', FALSE, 'outcome', 'decision_failed',
      'stage', 'decision', 'links', v_link, 'decision', v_decision,
      'error', COALESCE(v_decision->>'outcome', SQLERRM));
  END;
END;
$$;

COMMENT ON FUNCTION public.registrar_decisao_e_vinculos_documento(TEXT, UUID, BIGINT[], UUID, UUID, TEXT, TEXT, UUID, UUID) IS
  'Admin-only: composicao atomica da acao "Validar e vincular". Chama registrar_vinculos_documento e registrar_decisao_documento como donos independentes, com command_ids idempotentes distintos; rollback total se qualquer uma falhar. Permite estado de vinculo explicito vazio. Nao funde dados de vinculo em document_decisions; nao altera as regras B5; nenhum efeito operacional.';


-- ============================================================
-- 7. Grants das RPCs e reload do schema cache
-- ============================================================

REVOKE ALL ON FUNCTION public.registrar_vinculos_documento(TEXT, UUID, BIGINT[], UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.registrar_vinculos_documento(TEXT, UUID, BIGINT[], UUID, UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.registrar_vinculos_documento(TEXT, UUID, BIGINT[], UUID, UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.registrar_decisao_e_vinculos_documento(TEXT, UUID, BIGINT[], UUID, UUID, TEXT, TEXT, UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.registrar_decisao_e_vinculos_documento(TEXT, UUID, BIGINT[], UUID, UUID, TEXT, TEXT, UUID, UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.registrar_decisao_e_vinculos_documento(TEXT, UUID, BIGINT[], UUID, UUID, TEXT, TEXT, UUID, UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';
