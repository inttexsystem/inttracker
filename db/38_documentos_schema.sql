-- ============================================================
-- Fase: RAVATEX-DOCUMENTS-G23-B-B-DOCUMENTS-SCHEMA-MIGRATION-PATCH
-- Documentos produtivos - schema inicial admin-only.
--
-- Escopo:
--   - public.document_candidates
--   - public.document_events
--   - public.document_decisions
--   - public.document_scan_runs
--   - RPCs minimas para decisao manual e controle de scan.
--
-- Nao aplicar nesta fase. Este arquivo e apenas o patch versionado
-- para revisao local antes de qualquer apply no Supabase.
--
-- Compatibilidade confirmada em G23-B-A:
--   - public.pedidos.id e UUID.
--   - public.fornecedores.id e BIGINT/BIGSERIAL.
--   - usuarios operacionais vivem em public.usuarios, ligados a auth.users.
--   - public.is_admin() e o helper RLS admin-only existente.
--
-- Fora de escopo nesta fase:
--   - policies fornecedor/cliente;
--   - FKs para OP/entrega/expedicao/movimento/pedido_item;
--   - Gmail/Drive/Edge Function/scheduler/UI/Documents Ingestor.
--
-- Idempotente: usa IF NOT EXISTS, CREATE OR REPLACE e recria policies.
-- Sem apply, sem dados reais, sem secrets.
-- ============================================================


-- ============================================================
-- 1. Tabela public.document_candidates
-- ============================================================

CREATE TABLE IF NOT EXISTS public.document_candidates (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id          TEXT        NOT NULL,
  gmail_message_id     TEXT,
  attachment_id        TEXT,
  sha256               TEXT,
  filename_original    TEXT,
  tipo_documento       TEXT,
  formato              TEXT,
  direcao_nf           TEXT,
  drive_file_id        TEXT,
  drive_web_view_link  TEXT,
  status               TEXT        NOT NULL DEFAULT 'pending',
  pedido_manual        TEXT,
  pedido_id            UUID        REFERENCES public.pedidos(id) ON DELETE SET NULL,
  fornecedor_id        BIGINT      REFERENCES public.fornecedores(id) ON DELETE SET NULL,
  schema_version       INTEGER     NOT NULL DEFAULT 1,
  raw_payload          JSONB       NOT NULL DEFAULT '{}'::jsonb,
  received_at          TIMESTAMPTZ,
  detected_at          TIMESTAMPTZ,
  linked_at            TIMESTAMPTZ,
  accepted_at          TIMESTAMPTZ,
  rejected_at          TIMESTAMPTZ,
  rejected_reason      TEXT,
  criado_em            TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em        TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.document_candidates IS
  'Documento candidato detectado pelo fluxo de ingestao. Primeira versao admin-only.';
COMMENT ON COLUMN public.document_candidates.document_id IS
  'Identificador estavel do documento vindo do ingestor. Deve ser preservado.';
COMMENT ON COLUMN public.document_candidates.pedido_manual IS
  'Texto de pedido detectado antes do vinculo seguro em pedido_id.';
COMMENT ON COLUMN public.document_candidates.pedido_id IS
  'FK nullable para public.pedidos(id), tipo UUID. Nao depende apenas de pedido_manual.';
COMMENT ON COLUMN public.document_candidates.fornecedor_id IS
  'FK nullable para public.fornecedores(id), tipo BIGINT. Pode ser preenchida depois.';
COMMENT ON COLUMN public.document_candidates.raw_payload IS
  'Payload bruto normalizado para auditoria e reprocessamento.';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'document_candidates_document_id_key'
       AND conrelid = 'public.document_candidates'::regclass
  ) THEN
    ALTER TABLE public.document_candidates
      ADD CONSTRAINT document_candidates_document_id_key UNIQUE (document_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'document_candidates_status_check'
       AND conrelid = 'public.document_candidates'::regclass
  ) THEN
    ALTER TABLE public.document_candidates
      ADD CONSTRAINT document_candidates_status_check
      CHECK (status IN ('pending','assigned','accepted','rejected'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'document_candidates_rejected_reason_check'
       AND conrelid = 'public.document_candidates'::regclass
  ) THEN
    ALTER TABLE public.document_candidates
      ADD CONSTRAINT document_candidates_rejected_reason_check
      CHECK (
        status <> 'rejected'
        OR NULLIF(btrim(COALESCE(rejected_reason, '')), '') IS NOT NULL
      );
  END IF;
END;
$$;


-- ============================================================
-- 2. Tabela public.document_events
-- ============================================================

CREATE TABLE IF NOT EXISTS public.document_events (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id          TEXT        NOT NULL,
  ingestion_event_id   TEXT        NOT NULL,
  event_type           TEXT        NOT NULL,
  status               TEXT,
  pedido_manual        TEXT,
  pedido_id            UUID        REFERENCES public.pedidos(id) ON DELETE SET NULL,
  payload              JSONB       NOT NULL DEFAULT '{}'::jsonb,
  criado_em            TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.document_events IS
  'Eventos idempotentes do ciclo de vida de documentos ingeridos.';
COMMENT ON COLUMN public.document_events.ingestion_event_id IS
  'Identificador idempotente do evento gerado no ingestor. Deve ser preservado.';
COMMENT ON COLUMN public.document_events.pedido_id IS
  'FK nullable para public.pedidos(id), tipo UUID, quando o vinculo seguro existir.';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'document_events_ingestion_event_id_key'
       AND conrelid = 'public.document_events'::regclass
  ) THEN
    ALTER TABLE public.document_events
      ADD CONSTRAINT document_events_ingestion_event_id_key UNIQUE (ingestion_event_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'document_events_event_type_check'
       AND conrelid = 'public.document_events'::regclass
  ) THEN
    ALTER TABLE public.document_events
      ADD CONSTRAINT document_events_event_type_check
      CHECK (event_type IN (
        'document.detected',
        'document.linked',
        'document.accepted',
        'document.rejected'
      ));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'document_events_status_check'
       AND conrelid = 'public.document_events'::regclass
  ) THEN
    ALTER TABLE public.document_events
      ADD CONSTRAINT document_events_status_check
      CHECK (status IS NULL OR status IN ('pending','assigned','accepted','rejected'));
  END IF;
END;
$$;


-- ============================================================
-- 3. Tabela public.document_decisions
-- ============================================================

CREATE TABLE IF NOT EXISTS public.document_decisions (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id      TEXT        NOT NULL,
  status           TEXT        NOT NULL,
  motivo           TEXT,
  ativo            BOOLEAN     NOT NULL DEFAULT TRUE,
  decidido_por     UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  decidido_em      TIMESTAMPTZ NOT NULL DEFAULT now(),
  source           TEXT        NOT NULL DEFAULT 'manual',
  criado_em        TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.document_decisions IS
  'Historico de decisoes sobre documentos, com uma decisao ativa por document_id.';
COMMENT ON COLUMN public.document_decisions.ativo IS
  'TRUE para a decisao operacional vigente. Historico anterior fica ativo = FALSE.';
COMMENT ON COLUMN public.document_decisions.decidido_por IS
  'Usuario auth.users que decidiu, quando a decisao veio de sessao autenticada.';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'document_decisions_status_check'
       AND conrelid = 'public.document_decisions'::regclass
  ) THEN
    ALTER TABLE public.document_decisions
      ADD CONSTRAINT document_decisions_status_check
      CHECK (status IN ('accepted','rejected'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'document_decisions_source_check'
       AND conrelid = 'public.document_decisions'::regclass
  ) THEN
    ALTER TABLE public.document_decisions
      ADD CONSTRAINT document_decisions_source_check
      CHECK (source IN ('manual','auto','migration'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'document_decisions_rejected_motivo_check'
       AND conrelid = 'public.document_decisions'::regclass
  ) THEN
    ALTER TABLE public.document_decisions
      ADD CONSTRAINT document_decisions_rejected_motivo_check
      CHECK (
        status <> 'rejected'
        OR NULLIF(btrim(COALESCE(motivo, '')), '') IS NOT NULL
      );
  END IF;
END;
$$;


-- ============================================================
-- 4. Tabela public.document_scan_runs
-- ============================================================

CREATE TABLE IF NOT EXISTS public.document_scan_runs (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  source                TEXT        NOT NULL DEFAULT 'gmail',
  started_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at           TIMESTAMPTZ,
  status                TEXT        NOT NULL DEFAULT 'running',
  documents_processed   INTEGER     NOT NULL DEFAULT 0,
  documents_new         INTEGER     NOT NULL DEFAULT 0,
  error_message         TEXT,
  triggered_by          TEXT        NOT NULL DEFAULT 'manual',
  criado_em             TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.document_scan_runs IS
  'Controle de execucoes de scan de documentos. Impede concorrencia por source.';
COMMENT ON COLUMN public.document_scan_runs.source IS
  'Origem logica do scan, por exemplo gmail.';
COMMENT ON COLUMN public.document_scan_runs.status IS
  'running|completed|failed';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'document_scan_runs_status_check'
       AND conrelid = 'public.document_scan_runs'::regclass
  ) THEN
    ALTER TABLE public.document_scan_runs
      ADD CONSTRAINT document_scan_runs_status_check
      CHECK (status IN ('running','completed','failed'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'document_scan_runs_documents_processed_check'
       AND conrelid = 'public.document_scan_runs'::regclass
  ) THEN
    ALTER TABLE public.document_scan_runs
      ADD CONSTRAINT document_scan_runs_documents_processed_check
      CHECK (documents_processed >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'document_scan_runs_documents_new_check'
       AND conrelid = 'public.document_scan_runs'::regclass
  ) THEN
    ALTER TABLE public.document_scan_runs
      ADD CONSTRAINT document_scan_runs_documents_new_check
      CHECK (documents_new >= 0);
  END IF;
END;
$$;


-- ============================================================
-- 5. Indices
-- ============================================================

CREATE INDEX IF NOT EXISTS document_candidates_pedido_idx
  ON public.document_candidates(pedido_id);
CREATE INDEX IF NOT EXISTS document_candidates_fornecedor_idx
  ON public.document_candidates(fornecedor_id);
CREATE INDEX IF NOT EXISTS document_candidates_status_idx
  ON public.document_candidates(status);
CREATE INDEX IF NOT EXISTS document_candidates_sha256_idx
  ON public.document_candidates(sha256)
  WHERE sha256 IS NOT NULL;
CREATE INDEX IF NOT EXISTS document_candidates_gmail_message_idx
  ON public.document_candidates(gmail_message_id)
  WHERE gmail_message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS document_events_document_criado_idx
  ON public.document_events(document_id, criado_em DESC);
CREATE INDEX IF NOT EXISTS document_events_pedido_idx
  ON public.document_events(pedido_id);

CREATE INDEX IF NOT EXISTS document_decisions_document_idx
  ON public.document_decisions(document_id);
CREATE UNIQUE INDEX IF NOT EXISTS document_decisions_active_uidx
  ON public.document_decisions(document_id)
  WHERE ativo IS TRUE;

CREATE INDEX IF NOT EXISTS document_scan_runs_source_started_idx
  ON public.document_scan_runs(source, started_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS document_scan_runs_running_source_uidx
  ON public.document_scan_runs(source)
  WHERE status = 'running';


-- ============================================================
-- 6. RLS admin-only
-- ============================================================

ALTER TABLE public.document_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_scan_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS document_candidates_admin_all ON public.document_candidates;
CREATE POLICY document_candidates_admin_all ON public.document_candidates
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS document_events_admin_all ON public.document_events;
CREATE POLICY document_events_admin_all ON public.document_events
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS document_decisions_admin_all ON public.document_decisions;
CREATE POLICY document_decisions_admin_all ON public.document_decisions
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS document_scan_runs_admin_all ON public.document_scan_runs;
CREATE POLICY document_scan_runs_admin_all ON public.document_scan_runs
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

REVOKE ALL ON TABLE public.document_candidates FROM PUBLIC;
REVOKE ALL ON TABLE public.document_events FROM PUBLIC;
REVOKE ALL ON TABLE public.document_decisions FROM PUBLIC;
REVOKE ALL ON TABLE public.document_scan_runs FROM PUBLIC;
REVOKE ALL ON TABLE public.document_candidates FROM anon;
REVOKE ALL ON TABLE public.document_events FROM anon;
REVOKE ALL ON TABLE public.document_decisions FROM anon;
REVOKE ALL ON TABLE public.document_scan_runs FROM anon;
REVOKE ALL ON TABLE public.document_candidates FROM authenticated;
REVOKE ALL ON TABLE public.document_events FROM authenticated;
REVOKE ALL ON TABLE public.document_decisions FROM authenticated;
REVOKE ALL ON TABLE public.document_scan_runs FROM authenticated;

-- Primeira versao admin-only: leitura direta para admins autenticados
-- via RLS; escrita de UI passa pelas RPCs SECURITY DEFINER abaixo.
GRANT SELECT ON TABLE public.document_candidates TO authenticated;
GRANT SELECT ON TABLE public.document_events TO authenticated;
GRANT SELECT ON TABLE public.document_decisions TO authenticated;
GRANT SELECT ON TABLE public.document_scan_runs TO authenticated;


-- ============================================================
-- 7. RPC public.decidir_documento
-- ============================================================

CREATE OR REPLACE FUNCTION public.decidir_documento(
  p_document_id TEXT,
  p_status TEXT,
  p_motivo TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_document_id TEXT := NULLIF(btrim(p_document_id), '');
  v_status TEXT := lower(NULLIF(btrim(p_status), ''));
  v_motivo TEXT := NULLIF(btrim(p_motivo), '');
  v_decision_id UUID;
  v_candidate_updated BOOLEAN := FALSE;
  v_row_count INTEGER := 0;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('ok', FALSE, 'error', 'admin_required');
  END IF;

  IF v_document_id IS NULL THEN
    RETURN jsonb_build_object('ok', FALSE, 'error', 'document_id_required');
  END IF;

  IF v_status NOT IN ('accepted','rejected') THEN
    RETURN jsonb_build_object('ok', FALSE, 'error', 'invalid_status');
  END IF;

  IF v_status = 'rejected' AND v_motivo IS NULL THEN
    RETURN jsonb_build_object('ok', FALSE, 'error', 'motivo_required');
  END IF;

  UPDATE public.document_decisions
     SET ativo = FALSE
   WHERE document_id = v_document_id
     AND ativo IS TRUE;

  INSERT INTO public.document_decisions (
    document_id,
    status,
    motivo,
    ativo,
    decidido_por,
    source
  )
  VALUES (
    v_document_id,
    v_status,
    v_motivo,
    TRUE,
    auth.uid(),
    'manual'
  )
  RETURNING id INTO v_decision_id;

  UPDATE public.document_candidates
     SET status = v_status,
         accepted_at = CASE WHEN v_status = 'accepted' THEN now() ELSE NULL END,
         rejected_at = CASE WHEN v_status = 'rejected' THEN now() ELSE NULL END,
         rejected_reason = CASE WHEN v_status = 'rejected' THEN v_motivo ELSE NULL END,
         atualizado_em = now()
   WHERE document_id = v_document_id;

  GET DIAGNOSTICS v_row_count = ROW_COUNT;
  v_candidate_updated := v_row_count > 0;

  RETURN jsonb_build_object(
    'ok', TRUE,
    'document_id', v_document_id,
    'status', v_status,
    'decision_id', v_decision_id,
    'candidate_updated', v_candidate_updated
  );
END;
$$;

COMMENT ON FUNCTION public.decidir_documento(TEXT, TEXT, TEXT) IS
  'Admin-only: registra decisao ativa do documento e atualiza document_candidates quando existir.';


-- ============================================================
-- 8. RPC public.iniciar_document_scan_run
-- ============================================================

CREATE OR REPLACE FUNCTION public.iniciar_document_scan_run(
  p_source TEXT DEFAULT 'gmail',
  p_triggered_by TEXT DEFAULT 'manual'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_source TEXT := COALESCE(NULLIF(btrim(p_source), ''), 'gmail');
  v_triggered_by TEXT := COALESCE(NULLIF(btrim(p_triggered_by), ''), 'manual');
  v_run_id UUID;
  v_existing_id UUID;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('ok', FALSE, 'error', 'admin_required');
  END IF;

  SELECT id INTO v_existing_id
    FROM public.document_scan_runs
   WHERE source = v_source
     AND status = 'running'
   ORDER BY started_at DESC
   LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'ok', FALSE,
      'error', 'scan_already_running',
      'scan_run_id', v_existing_id,
      'source', v_source
    );
  END IF;

  INSERT INTO public.document_scan_runs (source, triggered_by)
  VALUES (v_source, v_triggered_by)
  RETURNING id INTO v_run_id;

  RETURN jsonb_build_object(
    'ok', TRUE,
    'scan_run_id', v_run_id,
    'source', v_source
  );
EXCEPTION
  WHEN unique_violation THEN
    SELECT id INTO v_existing_id
      FROM public.document_scan_runs
     WHERE source = v_source
       AND status = 'running'
     ORDER BY started_at DESC
     LIMIT 1;

    RETURN jsonb_build_object(
      'ok', FALSE,
      'error', 'scan_already_running',
      'scan_run_id', v_existing_id,
      'source', v_source
    );
END;
$$;

COMMENT ON FUNCTION public.iniciar_document_scan_run(TEXT, TEXT) IS
  'Admin-only: inicia scan de documentos se nao houver execucao running para a mesma source.';


-- ============================================================
-- 9. RPC public.finalizar_document_scan_run
-- ============================================================

CREATE OR REPLACE FUNCTION public.finalizar_document_scan_run(
  p_scan_run_id UUID,
  p_status TEXT,
  p_documents_processed INTEGER DEFAULT 0,
  p_documents_new INTEGER DEFAULT 0,
  p_error_message TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_status TEXT := lower(NULLIF(btrim(p_status), ''));
  v_documents_processed INTEGER := COALESCE(p_documents_processed, 0);
  v_documents_new INTEGER := COALESCE(p_documents_new, 0);
  v_error_message TEXT := NULLIF(btrim(p_error_message), '');
  v_run_id UUID;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('ok', FALSE, 'error', 'admin_required');
  END IF;

  IF p_scan_run_id IS NULL THEN
    RETURN jsonb_build_object('ok', FALSE, 'error', 'scan_run_id_required');
  END IF;

  IF v_status NOT IN ('completed','failed') THEN
    RETURN jsonb_build_object('ok', FALSE, 'error', 'invalid_status');
  END IF;

  IF v_documents_processed < 0 OR v_documents_new < 0 THEN
    RETURN jsonb_build_object('ok', FALSE, 'error', 'invalid_counts');
  END IF;

  UPDATE public.document_scan_runs
     SET status = v_status,
         documents_processed = v_documents_processed,
         documents_new = v_documents_new,
         error_message = CASE WHEN v_status = 'failed' THEN v_error_message ELSE NULL END,
         finished_at = now()
   WHERE id = p_scan_run_id
     AND status = 'running'
  RETURNING id INTO v_run_id;

  IF v_run_id IS NULL THEN
    RETURN jsonb_build_object(
      'ok', FALSE,
      'error', 'scan_run_not_running_or_not_found',
      'scan_run_id', p_scan_run_id
    );
  END IF;

  RETURN jsonb_build_object(
    'ok', TRUE,
    'scan_run_id', v_run_id,
    'status', v_status,
    'documents_processed', v_documents_processed,
    'documents_new', v_documents_new
  );
END;
$$;

COMMENT ON FUNCTION public.finalizar_document_scan_run(UUID, TEXT, INTEGER, INTEGER, TEXT) IS
  'Admin-only: finaliza scan running como completed ou failed, com contadores validados.';


-- ============================================================
-- 10. Grants das RPCs e reload do schema cache
-- ============================================================

REVOKE ALL ON FUNCTION public.decidir_documento(TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.iniciar_document_scan_run(TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.finalizar_document_scan_run(UUID, TEXT, INTEGER, INTEGER, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.decidir_documento(TEXT, TEXT, TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.iniciar_document_scan_run(TEXT, TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.finalizar_document_scan_run(UUID, TEXT, INTEGER, INTEGER, TEXT) FROM anon;

GRANT EXECUTE ON FUNCTION public.decidir_documento(TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.iniciar_document_scan_run(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finalizar_document_scan_run(UUID, TEXT, INTEGER, INTEGER, TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';
