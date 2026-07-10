-- G25-B1-UX-A: canonical Gmail sender email.
ALTER TABLE public.document_candidates
  ADD COLUMN IF NOT EXISTS sender_email TEXT;

COMMENT ON COLUMN public.document_candidates.sender_email IS
  'Normalized email extracted exclusively from the Gmail From header.';

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
  v_email_received_at TIMESTAMPTZ;
  v_email_received_at_source TEXT;
  v_email_received_at_estimated BOOLEAN;
  v_email_message_id TEXT;
  v_sender_email TEXT;
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
     OR p_ingestor_state_at IS NULL OR v_event_id IS NULL THEN
    RETURN jsonb_build_object('ok', FALSE, 'error', 'invalid_ingestor_state');
  END IF;
  IF v_status = 'rejected' AND v_reason IS NULL THEN
    RETURN jsonb_build_object('ok', FALSE, 'error', 'ingestor_rejected_reason_required');
  END IF;
  IF v_status <> 'rejected' THEN v_reason := NULL; END IF;

  SELECT * INTO v_input FROM jsonb_populate_record(NULL::public.document_candidates, p_candidate);
  v_sender_email := lower(NULLIF(btrim(v_input.sender_email), ''));
  IF v_sender_email !~ '^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$' THEN
    v_sender_email := NULL;
  END IF;
  SELECT * INTO v_existing FROM public.document_candidates WHERE document_id = v_document_id FOR UPDATE;
  v_existing_found := FOUND;
  SELECT id, status, motivo, decidido_em
    INTO v_active_decision_id, v_active_status, v_active_motivo, v_active_decidido_em
    FROM public.document_decisions WHERE document_id = v_document_id AND ativo IS TRUE FOR UPDATE;

  IF v_existing_found THEN
    -- Existing Gmail internalDate is never degraded by a header or null. On
    -- equal quality, retain the existing value for idempotent reprocessing.
    IF v_input.email_received_at IS NULL OR v_input.email_received_at_source IS NULL
       OR (v_existing.email_received_at_source = 'gmail_internal_date'
           AND v_input.email_received_at_source IN ('gmail_internal_date', 'header_date'))
       OR (v_existing.email_received_at_source = 'header_date'
           AND v_input.email_received_at_source = 'header_date') THEN
      v_email_received_at := v_existing.email_received_at;
      v_email_received_at_source := v_existing.email_received_at_source;
      v_email_received_at_estimated := v_existing.email_received_at_estimated;
    ELSE
      v_email_received_at := v_input.email_received_at;
      v_email_received_at_source := v_input.email_received_at_source;
      v_email_received_at_estimated := COALESCE(v_input.email_received_at_estimated, FALSE);
    END IF;
    v_email_message_id := COALESCE(NULLIF(btrim(v_input.email_message_id), ''), v_existing.email_message_id);

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
           sender_email = COALESCE(v_existing.sender_email, v_sender_email),
           email_message_id = v_email_message_id,
           email_received_at = v_email_received_at,
           email_received_at_source = v_email_received_at_source,
           email_received_at_estimated = COALESCE(v_email_received_at_estimated, FALSE),
           received_at = COALESCE(v_input.received_at, received_at),
           detected_at = v_input.detected_at,
           linked_at = v_input.linked_at,
           ingestor_status = v_status,
           ingestor_state_at = p_ingestor_state_at,
           ingestor_event_id = v_event_id,
           ingestor_rejected_reason = v_reason,
           status = CASE WHEN v_active_decision_id IS NULL THEN v_status ELSE status END,
           accepted_at = CASE WHEN v_active_decision_id IS NOT NULL THEN accepted_at
             WHEN v_status = 'accepted' THEN p_ingestor_state_at ELSE NULL END,
           rejected_at = CASE WHEN v_active_decision_id IS NOT NULL THEN rejected_at
             WHEN v_status = 'rejected' THEN p_ingestor_state_at ELSE NULL END,
           rejected_reason = CASE WHEN v_active_decision_id IS NOT NULL THEN rejected_reason
             WHEN v_status = 'rejected' THEN v_reason ELSE NULL END,
           atualizado_em = now()
     WHERE document_id = v_document_id;
  ELSE
    INSERT INTO public.document_candidates (
      document_id, gmail_message_id, attachment_id, sha256, filename_original,
      tipo_documento, formato, direcao_nf, drive_file_id, drive_web_view_link,
      status, pedido_manual, pedido_id, fornecedor_id, schema_version, raw_payload, sender_email,
      email_message_id, email_received_at, email_received_at_source, email_received_at_estimated,
      received_at, detected_at, linked_at, accepted_at, rejected_at, rejected_reason,
      atualizado_em, ingestor_status, ingestor_state_at, ingestor_event_id, ingestor_rejected_reason
    ) VALUES (
      v_document_id, v_input.gmail_message_id, v_input.attachment_id, v_input.sha256,
      v_input.filename_original, v_input.tipo_documento, v_input.formato, v_input.direcao_nf,
      v_input.drive_file_id, v_input.drive_web_view_link, COALESCE(v_active_status, v_status),
      v_input.pedido_manual, v_input.pedido_id, v_input.fornecedor_id,
      COALESCE(v_input.schema_version, 1), COALESCE(v_input.raw_payload, '{}'::jsonb), v_sender_email,
      v_input.email_message_id, v_input.email_received_at, v_input.email_received_at_source,
      COALESCE(v_input.email_received_at_estimated, FALSE), v_input.received_at,
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
  RETURN jsonb_build_object('ok', TRUE, 'document_id', v_document_id,
    'ingestor_status', v_status, 'decision_active', v_active_decision_id IS NOT NULL);
END;
$$;

COMMENT ON FUNCTION public.upsert_document_candidate_ingestor_state(JSONB, TEXT, TIMESTAMPTZ, TEXT, TEXT) IS
  'Backend-only canonical writer; preserves the strongest known Gmail received timestamp and sender email.';
