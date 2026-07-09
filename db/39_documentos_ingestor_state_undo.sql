-- ============================================================
-- Fase: RAVATEX-DOCUMENTS-G23-E-C-CANONICAL-INGESTOR-STATE-MIGRATION-PATCH
-- Separa o estado canonico recebido do Documents Ingestor do
-- status efetivo, que pode estar temporariamente sobrescrito por
-- uma decisao humana.
--
-- Nao aplicar nesta fase. Migration versionada para revisao e
-- aplicacao controlada futura em staging.
-- ============================================================


-- ============================================================
-- 1. Base canonica do ingestor em document_candidates
-- ============================================================

ALTER TABLE public.document_candidates
  ADD COLUMN IF NOT EXISTS ingestor_status TEXT,
  ADD COLUMN IF NOT EXISTS ingestor_state_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ingestor_event_id TEXT,
  ADD COLUMN IF NOT EXISTS ingestor_rejected_reason TEXT;

COMMENT ON COLUMN public.document_candidates.ingestor_status IS
  'Ultimo status canonico confirmado pelo Documents Ingestor. status permanece o estado efetivo.';
COMMENT ON COLUMN public.document_candidates.ingestor_state_at IS
  'Timestamp do evento canonico que produziu ingestor_status.';
COMMENT ON COLUMN public.document_candidates.ingestor_event_id IS
  'ingestion_event_id canonico correspondente a ingestor_status.';
COMMENT ON COLUMN public.document_candidates.ingestor_rejected_reason IS
  'Motivo canonico do ingestor quando ingestor_status = rejected.';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'document_candidates_ingestor_status_check'
       AND conrelid = 'public.document_candidates'::regclass
  ) THEN
    ALTER TABLE public.document_candidates
      ADD CONSTRAINT document_candidates_ingestor_status_check
      CHECK (ingestor_status IS NULL OR ingestor_status IN ('pending','assigned','accepted','rejected'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'document_candidates_ingestor_base_complete_check'
       AND conrelid = 'public.document_candidates'::regclass
  ) THEN
    ALTER TABLE public.document_candidates
      ADD CONSTRAINT document_candidates_ingestor_base_complete_check
      CHECK (
        (ingestor_status IS NULL AND ingestor_state_at IS NULL AND ingestor_event_id IS NULL)
        OR
        (ingestor_status IS NOT NULL AND ingestor_state_at IS NOT NULL AND ingestor_event_id IS NOT NULL)
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'document_candidates_ingestor_rejected_reason_check'
       AND conrelid = 'public.document_candidates'::regclass
  ) THEN
    ALTER TABLE public.document_candidates
      ADD CONSTRAINT document_candidates_ingestor_rejected_reason_check
      CHECK (
        (ingestor_status = 'rejected'
          AND NULLIF(btrim(COALESCE(ingestor_rejected_reason, '')), '') IS NOT NULL)
        OR
        (ingestor_status IS DISTINCT FROM 'rejected' AND ingestor_rejected_reason IS NULL)
      );
  END IF;
END;
$$;

-- O evento mais recente e um identificador de lookup/auditoria. O
-- contrato do Ingestor o trata como UUID estavel, mas este patch usa
-- indice nao unico para nao bloquear backfill legado sem prova plena.
CREATE INDEX IF NOT EXISTS document_candidates_ingestor_event_idx
  ON public.document_candidates(ingestor_event_id)
  WHERE ingestor_event_id IS NOT NULL;


-- ============================================================
-- 2. Auditoria de revogacao em document_decisions
-- ============================================================

ALTER TABLE public.document_decisions
  ADD COLUMN IF NOT EXISTS revogada_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS revogada_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS revogada_motivo TEXT;

COMMENT ON COLUMN public.document_decisions.revogada_em IS
  'Quando a decisao ativa foi revogada por reabertura do documento.';
COMMENT ON COLUMN public.document_decisions.revogada_por IS
  'Usuario autenticado que revogou a decisao, quando ainda existir.';
COMMENT ON COLUMN public.document_decisions.revogada_motivo IS
  'Observacao opcional da reabertura; nao cria uma decisao pending.';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'document_decisions_revogada_ativa_check'
       AND conrelid = 'public.document_decisions'::regclass
  ) THEN
    ALTER TABLE public.document_decisions
      ADD CONSTRAINT document_decisions_revogada_ativa_check
      CHECK (
        (revogada_em IS NULL AND revogada_por IS NULL AND revogada_motivo IS NULL)
        OR
        (revogada_em IS NOT NULL AND ativo IS FALSE)
      );
  END IF;
END;
$$;


-- ============================================================
-- 3. RPC admin-only para desfazer decisao humana
-- ============================================================

CREATE OR REPLACE FUNCTION public.desfazer_decisao_documento(
  p_document_id TEXT,
  p_motivo TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_document_id TEXT := NULLIF(btrim(p_document_id), '');
  v_motivo TEXT := NULLIF(btrim(p_motivo), '');
  v_candidate public.document_candidates%ROWTYPE;
  v_decision_id UUID;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('ok', FALSE, 'error', 'admin_required');
  END IF;

  IF v_document_id IS NULL THEN
    RETURN jsonb_build_object('ok', FALSE, 'error', 'document_id_required');
  END IF;

  SELECT * INTO v_candidate
    FROM public.document_candidates
   WHERE document_id = v_document_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', FALSE, 'error', 'candidate_not_found');
  END IF;

  SELECT id INTO v_decision_id
    FROM public.document_decisions
   WHERE document_id = v_document_id
     AND ativo IS TRUE
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', FALSE, 'error', 'no_active_decision');
  END IF;

  IF v_candidate.ingestor_status IS NULL
     OR v_candidate.ingestor_state_at IS NULL
     OR v_candidate.ingestor_event_id IS NULL
     OR (v_candidate.ingestor_status = 'rejected'
         AND NULLIF(btrim(COALESCE(v_candidate.ingestor_rejected_reason, '')), '') IS NULL) THEN
    RETURN jsonb_build_object('ok', FALSE, 'error', 'base_status_unavailable');
  END IF;

  UPDATE public.document_decisions
     SET ativo = FALSE,
         revogada_em = now(),
         revogada_por = auth.uid(),
         revogada_motivo = v_motivo
   WHERE id = v_decision_id
     AND ativo IS TRUE;

  UPDATE public.document_candidates
     SET status = v_candidate.ingestor_status,
         accepted_at = CASE WHEN v_candidate.ingestor_status = 'accepted'
           THEN v_candidate.ingestor_state_at ELSE NULL END,
         rejected_at = CASE WHEN v_candidate.ingestor_status = 'rejected'
           THEN v_candidate.ingestor_state_at ELSE NULL END,
         rejected_reason = CASE WHEN v_candidate.ingestor_status = 'rejected'
           THEN v_candidate.ingestor_rejected_reason ELSE NULL END,
         atualizado_em = now()
   WHERE document_id = v_document_id;

  RETURN jsonb_build_object(
    'ok', TRUE,
    'document_id', v_document_id,
    'restored_status', v_candidate.ingestor_status,
    'revoked_decision_id', v_decision_id,
    'candidate_updated', TRUE
  );
END;
$$;

COMMENT ON FUNCTION public.desfazer_decisao_documento(TEXT, TEXT) IS
  'Admin-only: revoga a decisao ativa e restaura somente base canonica completa do Ingestor.';

REVOKE ALL ON FUNCTION public.desfazer_decisao_documento(TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.desfazer_decisao_documento(TEXT, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.desfazer_decisao_documento(TEXT, TEXT) TO authenticated;


-- ============================================================
-- 4. RPC atomica para o writer backend do Documents Ingestor
-- ============================================================

CREATE OR REPLACE FUNCTION public.upsert_document_candidate_ingestor_state(
  p_candidate JSONB,
  p_ingestor_status TEXT,
  p_ingestor_state_at TIMESTAMPTZ,
  p_ingestor_event_id TEXT,
  p_ingestor_rejected_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_input public.document_candidates%ROWTYPE;
  v_document_id TEXT;
  v_status TEXT := lower(NULLIF(btrim(p_ingestor_status), ''));
  v_event_id TEXT := NULLIF(btrim(p_ingestor_event_id), '');
  v_reason TEXT := NULLIF(btrim(p_ingestor_rejected_reason), '');
  v_existing public.document_candidates%ROWTYPE;
  v_existing_found BOOLEAN := FALSE;
  v_active_decision_id UUID;
  v_active_status TEXT;
  v_active_motivo TEXT;
  v_active_decidido_em TIMESTAMPTZ;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RETURN jsonb_build_object('ok', FALSE, 'error', 'writer_required');
  END IF;

  IF jsonb_typeof(p_candidate) IS DISTINCT FROM 'object' THEN
    RETURN jsonb_build_object('ok', FALSE, 'error', 'candidate_required');
  END IF;

  v_document_id := NULLIF(btrim(p_candidate ->> 'document_id'), '');
  IF v_document_id IS NULL THEN
    RETURN jsonb_build_object('ok', FALSE, 'error', 'document_id_required');
  END IF;

  IF v_status NOT IN ('pending','assigned','accepted','rejected')
     OR p_ingestor_state_at IS NULL
     OR v_event_id IS NULL THEN
    RETURN jsonb_build_object('ok', FALSE, 'error', 'invalid_ingestor_state');
  END IF;

  IF v_status = 'rejected' AND v_reason IS NULL THEN
    RETURN jsonb_build_object('ok', FALSE, 'error', 'ingestor_rejected_reason_required');
  END IF;

  IF v_status <> 'rejected' THEN
    v_reason := NULL;
  END IF;

  SELECT * INTO v_input
    FROM jsonb_populate_record(NULL::public.document_candidates, p_candidate);

  SELECT * INTO v_existing
    FROM public.document_candidates
   WHERE document_id = v_document_id
   FOR UPDATE;
  v_existing_found := FOUND;

  SELECT id, status, motivo, decidido_em
    INTO v_active_decision_id, v_active_status, v_active_motivo, v_active_decidido_em
    FROM public.document_decisions
   WHERE document_id = v_document_id
     AND ativo IS TRUE
   FOR UPDATE;

  IF v_existing_found THEN
    UPDATE public.document_candidates
       SET gmail_message_id = v_input.gmail_message_id,
           attachment_id = v_input.attachment_id,
           sha256 = v_input.sha256,
           filename_original = v_input.filename_original,
           tipo_documento = v_input.tipo_documento,
           formato = v_input.formato,
           direcao_nf = v_input.direcao_nf,
           drive_file_id = v_input.drive_file_id,
           drive_web_view_link = v_input.drive_web_view_link,
           pedido_manual = v_input.pedido_manual,
           pedido_id = CASE WHEN v_active_decision_id IS NULL THEN v_input.pedido_id ELSE pedido_id END,
           fornecedor_id = CASE WHEN v_active_decision_id IS NULL THEN v_input.fornecedor_id ELSE fornecedor_id END,
           schema_version = COALESCE(v_input.schema_version, 1),
           raw_payload = COALESCE(v_input.raw_payload, '{}'::jsonb),
           received_at = v_input.received_at,
           detected_at = v_input.detected_at,
           linked_at = v_input.linked_at,
           ingestor_status = v_status,
           ingestor_state_at = p_ingestor_state_at,
           ingestor_event_id = v_event_id,
           ingestor_rejected_reason = v_reason,
           status = CASE WHEN v_active_decision_id IS NULL THEN v_status ELSE status END,
           accepted_at = CASE
             WHEN v_active_decision_id IS NOT NULL THEN accepted_at
             WHEN v_status = 'accepted' THEN p_ingestor_state_at
             ELSE NULL
           END,
           rejected_at = CASE
             WHEN v_active_decision_id IS NOT NULL THEN rejected_at
             WHEN v_status = 'rejected' THEN p_ingestor_state_at
             ELSE NULL
           END,
           rejected_reason = CASE
             WHEN v_active_decision_id IS NOT NULL THEN rejected_reason
             WHEN v_status = 'rejected' THEN v_reason
             ELSE NULL
           END,
           atualizado_em = now()
     WHERE document_id = v_document_id;
  ELSE
    INSERT INTO public.document_candidates (
      document_id, gmail_message_id, attachment_id, sha256, filename_original,
      tipo_documento, formato, direcao_nf, drive_file_id, drive_web_view_link,
      status, pedido_manual, pedido_id, fornecedor_id, schema_version, raw_payload,
      received_at, detected_at, linked_at, accepted_at, rejected_at, rejected_reason,
      atualizado_em, ingestor_status, ingestor_state_at, ingestor_event_id,
      ingestor_rejected_reason
    ) VALUES (
      v_document_id, v_input.gmail_message_id, v_input.attachment_id, v_input.sha256,
      v_input.filename_original, v_input.tipo_documento, v_input.formato,
      v_input.direcao_nf, v_input.drive_file_id, v_input.drive_web_view_link,
      COALESCE(v_active_status, v_status), v_input.pedido_manual, v_input.pedido_id,
      v_input.fornecedor_id, COALESCE(v_input.schema_version, 1),
      COALESCE(v_input.raw_payload, '{}'::jsonb), v_input.received_at,
      v_input.detected_at, v_input.linked_at,
      CASE WHEN v_active_status = 'accepted' THEN v_active_decidido_em
        WHEN v_status = 'accepted' THEN p_ingestor_state_at ELSE NULL END,
      CASE WHEN v_active_status = 'rejected' THEN v_active_decidido_em
        WHEN v_status = 'rejected' THEN p_ingestor_state_at ELSE NULL END,
      CASE WHEN v_active_status = 'rejected' THEN v_active_motivo
        WHEN v_status = 'rejected' THEN v_reason ELSE NULL END,
      now(), v_status, p_ingestor_state_at, v_event_id, v_reason
    );
  END IF;

  RETURN jsonb_build_object(
    'ok', TRUE,
    'document_id', v_document_id,
    'ingestor_status', v_status,
    'decision_active', v_active_decision_id IS NOT NULL
  );
END;
$$;

COMMENT ON FUNCTION public.upsert_document_candidate_ingestor_state(JSONB, TEXT, TIMESTAMPTZ, TEXT, TEXT) IS
  'Backend-only: atualiza base canonica e preserva o status efetivo durante decisao humana ativa.';

REVOKE ALL ON FUNCTION public.upsert_document_candidate_ingestor_state(JSONB, TEXT, TIMESTAMPTZ, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.upsert_document_candidate_ingestor_state(JSONB, TEXT, TIMESTAMPTZ, TEXT, TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.upsert_document_candidate_ingestor_state(JSONB, TEXT, TIMESTAMPTZ, TEXT, TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_document_candidate_ingestor_state(JSONB, TEXT, TIMESTAMPTZ, TEXT, TEXT) TO service_role;


-- ============================================================
-- 5. Backfill conservador - diagnostico somente
-- ============================================================

-- Nao ha backfill automatico. raw_payload nao e contrato de runtime.
-- Antes de qualquer backfill manual, confirmar para cada candidate que:
--   1. raw_payload.latest_ingestion_event_id e nao nulo;
--   2. document_events.ingestion_event_id e igual ao ID acima;
--   3. document_events.document_id e document_candidates.document_id;
--   4. o status e coerente; e
--   5. payload.created_at do evento e timestamp ISO confiavel.
-- Sem essas cinco provas, os campos ingestor_* permanecem NULL e undo
-- responde base_status_unavailable. Este patch nao cria uma decisao
-- pending falsa e nao usa raw_payload para leitura operacional.


NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';
