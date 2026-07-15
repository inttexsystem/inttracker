-- ============================================================
-- Fase: RAVATEX-DOCUMENTS-G28-B8-CORRECTION-REVOCATION-RESTORATION-AUDIT
-- Correcao, revogacao explicita, restauracao e auditoria dos vinculos
-- canonicos humano-confirmados (Documento -> Pedido 0..1 / OP 0..N).
--
-- Esta fase NAO cria uma fonte de verdade concorrente. O comando canonico
-- de vinculo permanece registrar_vinculos_documento (fase B6, db/51). Esta
-- migration apenas:
--   1. adiciona a coluna aditiva document_link_revisions.restored_from_revision_id
--      (proveniencia de restauracao; NULL para vinculo/correcao/revogacao comum);
--   2. evolui registrar_vinculos_documento (mesmo escritor unico) com dois
--      parametros opcionais ao final da assinatura:
--        - p_reason: motivo humano da acao (correcao/revogacao); gravado como
--          revocation_reason da revisao anterior superseded (COALESCE 'superseded');
--        - p_restored_from_revision_id: proveniencia de restauracao, carimbada
--          na nova revisao ativa. Ambos DEFAULT NULL -> chamadas de 5 argumentos
--          (wrapper atomico B6) permanecem validas e com comportamento identico;
--   3. adiciona a RPC restaurar_vinculos_documento(...), que le uma revisao
--      historica (somente leitura), copia o conjunto normalizado Pedido/OP para
--      uma NOVA revisao ativa reutilizando o escritor unico (revalida
--      compatibilidade/validade atual, revoga sem apagar, carimba a proveniencia).
--
-- Correcao   = registrar_vinculos_documento com o conjunto completo desejado.
-- Revogacao  = registrar_vinculos_documento com estado explicito vazio
--              (p_pedido_id NULL, p_op_ids vazio); a revisao anterior e revogada
--              (preservada), a sugestao do Ingestor e a decisao NAO sao tocadas.
-- Restauracao= restaurar_vinculos_documento(p_source_revision_id) -> nova revisao.
-- Auditoria  = leitura das revisoes append-only (SELECT admin sob RLS existente);
--              nenhuma nova RPC de leitura e necessaria.
--
-- Cardinalidades canonicas preservadas:
--   Documento -> Pedido : 0..1 Pedido confirmado
--   Documento -> OP     : 0..N OPs confirmadas
--
-- Fronteira de propriedade (inalterada): document_candidates.pedido_id /
--   document_events.pedido_id NAO sao o vinculo canonico; NAO promovidos.
--   document_candidates.pedido_manual permanece somente sugestao do Ingestor.
--
-- Aplicar SOMENTE em staging ucrjtfswnfdlxwtmxnoo. Producao bhgifjrfagkzubpyqpew
-- proibida. Migration aditiva: sem backfill, sem DROP TABLE, sem migracao
-- destrutiva de dados, sem mutacao de campos historicos de candidate/event/
-- decision, sem alteracao das RPCs de decisao B5 (registrar_decisao_documento,
-- desfazer_decisao_documento) nem da legada decidir_documento. O unico DROP e
-- DROP FUNCTION sobre a assinatura antiga de 5 argumentos de
-- registrar_vinculos_documento, imediatamente recriada com a assinatura evoluida
-- (evolucao de assinatura, nao remocao de capacidade).
--
-- Idempotente: usa ADD COLUMN IF NOT EXISTS, guardas em pg_constraint,
-- CREATE INDEX IF NOT EXISTS, DROP FUNCTION IF EXISTS + CREATE OR REPLACE e
-- reaplica revoke/grant. Sem apply automatico, sem dados reais, sem secrets.
-- ============================================================


-- ============================================================
-- 1. Coluna aditiva de proveniencia de restauracao
-- ============================================================

ALTER TABLE public.document_link_revisions
  ADD COLUMN IF NOT EXISTS restored_from_revision_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'document_link_revisions_restored_from_fkey'
       AND conrelid = 'public.document_link_revisions'::regclass
  ) THEN
    ALTER TABLE public.document_link_revisions
      ADD CONSTRAINT document_link_revisions_restored_from_fkey
      FOREIGN KEY (restored_from_revision_id)
      REFERENCES public.document_link_revisions(id) ON DELETE RESTRICT;
  END IF;
END;
$$;

COMMENT ON COLUMN public.document_link_revisions.restored_from_revision_id IS
  'Proveniencia de restauracao (B8): revisao historica cujo estado normalizado Pedido/OP foi copiado para ESTA revisao. NULL para vinculo/correcao/revogacao comum. A linha historica de origem nunca e mutada nem reativada.';

CREATE INDEX IF NOT EXISTS document_link_revisions_restored_from_idx
  ON public.document_link_revisions(restored_from_revision_id)
  WHERE restored_from_revision_id IS NOT NULL;


-- ============================================================
-- 2. Evolucao do escritor unico registrar_vinculos_documento
--    (correcao/revogacao com motivo + carimbo de proveniencia).
--    A assinatura antiga de 5 argumentos e removida e recriada com dois
--    parametros DEFAULT NULL ao final; chamadas posicionais de 5 argumentos
--    continuam validas (o wrapper atomico B6 permanece inalterado e com
--    comportamento identico).
-- ============================================================

DROP FUNCTION IF EXISTS public.registrar_vinculos_documento(TEXT, UUID, BIGINT[], UUID, UUID);

CREATE OR REPLACE FUNCTION public.registrar_vinculos_documento(
  p_document_id TEXT,
  p_pedido_id UUID,
  p_op_ids BIGINT[],
  p_command_id UUID,
  p_expected_active_revision_id UUID DEFAULT NULL,
  p_reason TEXT DEFAULT NULL,
  p_restored_from_revision_id UUID DEFAULT NULL
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
  v_reason TEXT := NULLIF(btrim(p_reason), '');
  v_restored_from UUID := p_restored_from_revision_id;
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

    -- Replace: revoke previous active (preserved, not deleted), insert new active.
    -- The human action reason (correction/revocation/restoration) is recorded as
    -- the revocation_reason of the superseded revision; 'superseded' when absent.
    UPDATE public.document_link_revisions
       SET active = FALSE,
           revoked_by = auth.uid(),
           revoked_at = now(),
           revocation_reason = COALESCE(v_reason, 'superseded')
     WHERE id = v_active.id;

    SELECT COALESCE(MAX(version), 0) + 1 INTO v_next_version
      FROM public.document_link_revisions
     WHERE document_id = v_document_id;

    INSERT INTO public.document_link_revisions (
      document_id, pedido_id, version, active, command_id, created_by, restored_from_revision_id
    ) VALUES (
      v_document_id, v_pedido_id, v_next_version, TRUE, v_command_id, auth.uid(), v_restored_from
    )
    RETURNING id INTO v_new_revision_id;

    IF v_op_count > 0 THEN
      INSERT INTO public.document_link_revision_ops (revision_id, op_id)
        SELECT v_new_revision_id, x FROM unnest(v_op_ids) AS x;
    END IF;

    RETURN jsonb_build_object('ok', TRUE, 'outcome', 'updated',
      'command_id', v_command_id, 'document_id', v_document_id,
      'revision_id', v_new_revision_id, 'active_revision_id', v_new_revision_id,
      'previous_revision_id', v_active.id,
      'restored_from_revision_id', v_restored_from, 'error', NULL::TEXT);
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
      document_id, pedido_id, version, active, command_id, created_by, restored_from_revision_id
    ) VALUES (
      v_document_id, v_pedido_id, v_next_version, TRUE, v_command_id, auth.uid(), v_restored_from
    )
    RETURNING id INTO v_new_revision_id;

    IF v_op_count > 0 THEN
      INSERT INTO public.document_link_revision_ops (revision_id, op_id)
        SELECT v_new_revision_id, x FROM unnest(v_op_ids) AS x;
    END IF;

    RETURN jsonb_build_object('ok', TRUE, 'outcome', 'created',
      'command_id', v_command_id, 'document_id', v_document_id,
      'revision_id', v_new_revision_id, 'active_revision_id', v_new_revision_id,
      'previous_revision_id', NULL::UUID,
      'restored_from_revision_id', v_restored_from, 'error', NULL::TEXT);
  END IF;
END;
$$;

COMMENT ON FUNCTION public.registrar_vinculos_documento(TEXT, UUID, BIGINT[], UUID, UUID, TEXT, UUID) IS
  'Admin-only: comando idempotente de vinculo canonico Documento->Pedido(0..1)/OP(0..N). Correcao = conjunto completo desejado; revogacao = estado explicito vazio (pedido NULL, sem OPs). Locks por candidate FOR UPDATE + advisory lock por command_id. Valida existencia, alvo nao-cancelado e compatibilidade Pedido/OP (via lotes.pedido_id) fail-closed. p_reason grava revocation_reason da revisao superseded (COALESCE superseded); p_restored_from_revision_id carimba proveniencia de restauracao na nova revisao. Outcomes: created, updated, no_change, replayed, active_revision_exists, stale_active_revision, command_conflict, candidate_not_found, duplicate_op, pedido_not_found, pedido_not_linkable, op_not_found, op_not_linkable, op_pedido_mismatch, op_not_avulsa, input_error, auth_error. Revoga a revisao anterior sem apagar; nunca infere vinculo; nunca muta candidate/decision; nenhum efeito operacional.';


-- ============================================================
-- 3. RPC public.restaurar_vinculos_documento
--    Restauracao de um estado historico de vinculo. NAO reativa nem muta a
--    linha historica: le a revisao de origem (somente leitura), copia seu
--    conjunto normalizado Pedido/OP e delega ao escritor unico
--    registrar_vinculos_documento, que revalida compatibilidade/validade atual,
--    revoga a revisao ativa sem apagar e carimba a proveniencia. Idempotente
--    (command_id) e com concorrencia otimista (expected active revision).
-- ============================================================

CREATE OR REPLACE FUNCTION public.restaurar_vinculos_documento(
  p_document_id TEXT,
  p_source_revision_id UUID,
  p_command_id UUID,
  p_expected_active_revision_id UUID DEFAULT NULL,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_document_id TEXT := NULLIF(btrim(p_document_id), '');
  v_reason TEXT := NULLIF(btrim(p_reason), '');
  v_source public.document_link_revisions%ROWTYPE;
  v_source_op_ids BIGINT[] := ARRAY[]::BIGINT[];
  v_result JSONB;
BEGIN
  -- Input validation
  IF v_document_id IS NULL THEN
    RETURN jsonb_build_object('ok', FALSE, 'outcome', 'input_error',
      'command_id', p_command_id, 'document_id', NULL::TEXT,
      'source_revision_id', p_source_revision_id, 'error', 'document_id_required');
  END IF;

  IF p_command_id IS NULL THEN
    RETURN jsonb_build_object('ok', FALSE, 'outcome', 'input_error',
      'command_id', NULL::UUID, 'document_id', v_document_id,
      'source_revision_id', p_source_revision_id, 'error', 'command_id_required');
  END IF;

  IF p_source_revision_id IS NULL THEN
    RETURN jsonb_build_object('ok', FALSE, 'outcome', 'input_error',
      'command_id', p_command_id, 'document_id', v_document_id,
      'source_revision_id', NULL::UUID, 'error', 'source_revision_id_required');
  END IF;

  -- Authorization: admin only (the delegated writer re-checks as well).
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('ok', FALSE, 'outcome', 'auth_error',
      'command_id', p_command_id, 'document_id', v_document_id,
      'source_revision_id', p_source_revision_id, 'error', 'admin_required');
  END IF;

  -- Read the historical source revision. Read-only: never reactivated or mutated.
  SELECT * INTO v_source
    FROM public.document_link_revisions
   WHERE id = p_source_revision_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', FALSE, 'outcome', 'restore_source_not_found',
      'command_id', p_command_id, 'document_id', v_document_id,
      'source_revision_id', p_source_revision_id, 'error', 'restore_source_not_found');
  END IF;

  -- The source revision must belong to the same document (no cross-document restore).
  IF v_source.document_id IS DISTINCT FROM v_document_id THEN
    RETURN jsonb_build_object('ok', FALSE, 'outcome', 'restore_source_mismatch',
      'command_id', p_command_id, 'document_id', v_document_id,
      'source_revision_id', p_source_revision_id, 'error', 'restore_source_mismatch');
  END IF;

  -- Copy the normalized OP set of the source revision.
  SELECT COALESCE(array_agg(op_id ORDER BY op_id), ARRAY[]::BIGINT[])
    INTO v_source_op_ids
    FROM public.document_link_revision_ops
   WHERE revision_id = v_source.id;

  -- Delegate to the single canonical writer. It revalidates current Pedido/OP
  -- validity and compatibility (fail-closed), enforces optimistic concurrency and
  -- idempotency, revokes the active revision without deleting it, and stamps the
  -- restoration provenance on the new active revision. No compatibility logic is
  -- duplicated here.
  v_result := public.registrar_vinculos_documento(
    v_document_id,
    v_source.pedido_id,
    v_source_op_ids,
    p_command_id,
    p_expected_active_revision_id,
    COALESCE(v_reason, 'restaurada revisao ' || v_source.version::text),
    v_source.id
  );

  RETURN v_result || jsonb_build_object('restored_from_revision_id', v_source.id);
END;
$$;

COMMENT ON FUNCTION public.restaurar_vinculos_documento(TEXT, UUID, UUID, UUID, TEXT) IS
  'Admin-only: restaura um estado historico de vinculo do documento. Le a revisao de origem (somente leitura; nunca reativa nem muta a linha historica), copia o conjunto normalizado Pedido/OP e delega ao escritor unico registrar_vinculos_documento, que revalida compatibilidade/validade atual (fail-closed), aplica concorrencia otimista e idempotencia, revoga a revisao ativa sem apagar e carimba restored_from_revision_id na nova revisao. Rejeita origem inexistente (restore_source_not_found) ou de outro documento (restore_source_mismatch); propaga os outcomes do escritor quando o alvo historico deixou de ser valido. Nenhum efeito operacional.';


-- ============================================================
-- 4. Grants das RPCs e reload do schema cache
-- ============================================================

REVOKE ALL ON FUNCTION public.registrar_vinculos_documento(TEXT, UUID, BIGINT[], UUID, UUID, TEXT, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.registrar_vinculos_documento(TEXT, UUID, BIGINT[], UUID, UUID, TEXT, UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.registrar_vinculos_documento(TEXT, UUID, BIGINT[], UUID, UUID, TEXT, UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.restaurar_vinculos_documento(TEXT, UUID, UUID, UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.restaurar_vinculos_documento(TEXT, UUID, UUID, UUID, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.restaurar_vinculos_documento(TEXT, UUID, UUID, UUID, TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';
