-- ============================================================
-- Fase: RAVATEX-DOCUMENTS-G28-B5-B1-CANONICAL-IDEMPOTENT-HUMAN-DECISION-COMMAND-MIGRATION-PATCH
-- Contrato idempotente de comando de decisao humana.
--
-- Escopo desta fase (somente SQL versionado, sem apply):
--   - public.document_decisions.command_id (UUID nullable)
--   - Indice unico parcial sobre command_id nao nulo
--   - RPC public.registrar_decisao_documento(TEXT, TEXT, TEXT, UUID, UUID)
--
-- Nao aplicar nesta fase. Migration versionada para revisao e
-- aplicacao controlada futura em staging.
-- Idempotente: usa IF NOT EXISTS, CREATE OR REPLACE e
-- reaplica revoke/grant.
-- Sem apply, sem dados reais, sem secrets.
-- Sem alteracoes B6/B8/UI neste patch.
-- ============================================================


-- ============================================================
-- 1. command_id em document_decisions
-- ============================================================

ALTER TABLE public.document_decisions
  ADD COLUMN IF NOT EXISTS command_id UUID;

COMMENT ON COLUMN public.document_decisions.command_id IS
  'Identificador idempotente do comando de decisao humana. Nulo para decisoes historicas pre-B5. Unico quando nao nulo.';

CREATE UNIQUE INDEX IF NOT EXISTS document_decisions_command_id_uidx
  ON public.document_decisions(command_id)
  WHERE command_id IS NOT NULL;


-- ============================================================
-- 2. RPC public.registrar_decisao_documento
-- ============================================================

CREATE OR REPLACE FUNCTION public.registrar_decisao_documento(
  p_document_id TEXT,
  p_decision TEXT,
  p_motivo TEXT,
  p_command_id UUID,
  p_expected_active_decision_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_document_id TEXT := NULLIF(btrim(p_document_id), '');
  v_decision TEXT := lower(NULLIF(btrim(p_decision), ''));
  v_motivo TEXT := NULLIF(btrim(p_motivo), '');
  v_command_id UUID := p_command_id;
  v_expected_active_id UUID := p_expected_active_decision_id;
  v_candidate public.document_candidates%ROWTYPE;
  v_existing public.document_decisions%ROWTYPE;
  v_active_decision public.document_decisions%ROWTYPE;
  v_new_decision_id UUID;
BEGIN
  -- Input validation
  IF v_document_id IS NULL THEN
    RETURN jsonb_build_object('ok', FALSE, 'outcome', 'input_error',
      'error', 'document_id_required');
  END IF;

  IF v_decision NOT IN ('accepted', 'rejected') THEN
    RETURN jsonb_build_object('ok', FALSE, 'outcome', 'input_error',
      'error', 'invalid_decision');
  END IF;

  IF v_decision = 'rejected' AND v_motivo IS NULL THEN
    RETURN jsonb_build_object('ok', FALSE, 'outcome', 'input_error',
      'error', 'motivo_required');
  END IF;

  IF v_command_id IS NULL THEN
    RETURN jsonb_build_object('ok', FALSE, 'outcome', 'input_error',
      'error', 'command_id_required');
  END IF;

  -- accepted normalizes motivo to null
  IF v_decision = 'accepted' THEN
    v_motivo := NULL;
  END IF;

  -- Authorization: admin only, actor from auth.uid()
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('ok', FALSE, 'outcome', 'auth_error',
      'error', 'admin_required');
  END IF;

  -- Lock candidate with FOR UPDATE
  SELECT * INTO v_candidate
    FROM public.document_candidates
   WHERE document_id = v_document_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'ok', FALSE,
      'outcome', 'candidate_not_found',
      'command_id', v_command_id,
      'document_id', v_document_id,
      'decision_id', NULL::UUID,
      'active_decision_id', NULL::UUID,
      'decision_status', NULL::TEXT,
      'candidate_status', NULL::TEXT,
      'replayed', FALSE
    );
  END IF;

  -- Transaction-scoped advisory lock keyed by command_id
  -- Prevents concurrent reuse of the same command_id
  PERFORM pg_advisory_xact_lock(hashtext(v_command_id::text));

  -- Inspect existing command_id after locks
  SELECT * INTO v_existing
    FROM public.document_decisions
   WHERE command_id = v_command_id
   FOR UPDATE;

  IF FOUND THEN
    -- Exact normalized semantic payload -> idempotent replay
    IF v_existing.document_id = v_document_id
       AND v_existing.status = v_decision
       AND v_existing.motivo IS NOT DISTINCT FROM v_motivo
    THEN
      RETURN jsonb_build_object(
        'ok', TRUE,
        'outcome', 'replayed',
        'command_id', v_command_id,
        'document_id', v_document_id,
        'decision_id', v_existing.id,
        'active_decision_id', (
          SELECT id FROM public.document_decisions
           WHERE document_id = v_document_id AND ativo IS TRUE
           LIMIT 1
        ),
        'decision_status', v_existing.status,
        'candidate_status', v_candidate.status,
        'replayed', TRUE
      );
    END IF;

    -- Same command_id, different semantic payload -> conflict
    RETURN jsonb_build_object(
      'ok', FALSE,
      'outcome', 'command_conflict',
      'command_id', v_command_id,
      'document_id', v_document_id,
      'decision_id', NULL::UUID,
      'active_decision_id', NULL::UUID,
      'decision_status', NULL::TEXT,
      'candidate_status', v_candidate.status,
      'replayed', FALSE
    );
  END IF;

  -- Inspect current active decision with FOR UPDATE
  SELECT * INTO v_active_decision
    FROM public.document_decisions
   WHERE document_id = v_document_id
     AND ativo IS TRUE
   FOR UPDATE;

  IF FOUND THEN

    -- expected_active_decision_id is null but active exists
    IF v_expected_active_id IS NULL THEN
      RETURN jsonb_build_object(
        'ok', FALSE,
        'outcome', 'active_decision_exists',
        'command_id', v_command_id,
        'document_id', v_document_id,
        'decision_id', v_active_decision.id,
        'active_decision_id', v_active_decision.id,
        'decision_status', v_active_decision.status,
        'candidate_status', v_candidate.status,
        'replayed', FALSE
      );
    END IF;

    -- expected ID does not match actual active ID
    IF v_expected_active_id IS DISTINCT FROM v_active_decision.id THEN
      RETURN jsonb_build_object(
        'ok', FALSE,
        'outcome', 'stale_active_decision',
        'command_id', v_command_id,
        'document_id', v_document_id,
        'decision_id', v_active_decision.id,
        'active_decision_id', v_active_decision.id,
        'decision_status', v_active_decision.status,
        'candidate_status', v_candidate.status,
        'replayed', FALSE
      );
    END IF;

    -- expected matches actual active -> non-mutating confirmation
    RETURN jsonb_build_object(
      'ok', TRUE,
      'outcome', 'active_decision_exists',
      'command_id', v_command_id,
      'document_id', v_document_id,
      'decision_id', v_active_decision.id,
      'active_decision_id', v_active_decision.id,
      'decision_status', v_active_decision.status,
      'candidate_status', v_candidate.status,
      'replayed', FALSE
    );
  ELSE
    -- No active decision found
    -- expected_active_decision_id is nonnull but no active exists
    IF v_expected_active_id IS NOT NULL THEN
      RETURN jsonb_build_object(
        'ok', FALSE,
        'outcome', 'stale_active_decision',
        'command_id', v_command_id,
        'document_id', v_document_id,
        'decision_id', NULL::UUID,
        'active_decision_id', NULL::UUID,
        'decision_status', NULL::TEXT,
        'candidate_status', v_candidate.status,
        'replayed', FALSE
      );
    END IF;
  END IF;

  -- Safe first decision: insert one active manual decision
  INSERT INTO public.document_decisions (
    document_id, status, motivo, ativo, decidido_por, source, command_id
  ) VALUES (
    v_document_id, v_decision, v_motivo, TRUE, auth.uid(), 'manual', v_command_id
  )
  RETURNING id INTO v_new_decision_id;

  -- Update candidate effective decision fields
  UPDATE public.document_candidates
     SET status = v_decision,
         accepted_at = CASE WHEN v_decision = 'accepted' THEN now() ELSE NULL END,
         rejected_at = CASE WHEN v_decision = 'rejected' THEN now() ELSE NULL END,
         rejected_reason = CASE WHEN v_decision = 'rejected' THEN v_motivo ELSE NULL END,
         atualizado_em = now()
   WHERE document_id = v_document_id;

  RETURN jsonb_build_object(
    'ok', TRUE,
    'outcome', 'created',
    'command_id', v_command_id,
    'document_id', v_document_id,
    'decision_id', v_new_decision_id,
    'active_decision_id', v_new_decision_id,
    'decision_status', v_decision,
    'candidate_status', v_decision,
    'replayed', FALSE
  );
END;
$$;

COMMENT ON FUNCTION public.registrar_decisao_documento(TEXT, TEXT, TEXT, UUID, UUID) IS
  'Admin-only: registra comando idempotente de decisao humana com controle de concorrencia via advisory lock e FOR UPDATE. Seis outcomes: created, replayed, command_conflict, active_decision_exists, stale_active_decision, candidate_not_found. Nao revoga, nao corrige, nao desativa decisoes.';

REVOKE ALL ON FUNCTION public.registrar_decisao_documento(TEXT, TEXT, TEXT, UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.registrar_decisao_documento(TEXT, TEXT, TEXT, UUID, UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.registrar_decisao_documento(TEXT, TEXT, TEXT, UUID, UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';
