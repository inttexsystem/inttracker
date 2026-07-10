-- ============================================================
-- Fase: RAVATEX-DOCUMENTS-G23-F-D-SCAN-RUN-STALE-LOCK-RECOVERY-PATCH
-- Recupera execucoes de scan abandonadas em document_scan_runs.
--
-- Problema:
--   O writer (service_role) cria uma linha status='running' e depende
--   do indice unico parcial document_scan_runs_running_source_uidx
--   (db/38) para impedir concorrencia por source. Se o processo cair
--   entre o INSERT e a finalizacao, a linha fica 'running' para sempre
--   e bloqueia todo scan futuro dessa source.
--
-- Solucao:
--   RPC atomica que faz compare-and-swap 'running' -> 'failed' apenas
--   para runs mais velhos que um timeout (stale). Preserva started_at,
--   source, triggered_by e demais dados; preenche finished_at; grava
--   sentinela auditavel em error_message. Nunca apaga a linha.
--
-- Concorrencia segura:
--   FOR UPDATE SKIP LOCKED + reconfirmacao status='running' garantem
--   que duas execucoes nao recuperem o mesmo lock. O indice unico
--   parcial de db/38 continua garantindo um unico run 'running' ativo.
--
-- Auditoria preservada:
--   Reusa status='failed' (nenhuma mudanca no CHECK de db/38) com
--   error_message sentinela 'stale_recovered: ...'. Nao introduz
--   status 'abandoned' para evitar tocar readers/CHECK existentes.
--
-- Autorizacao:
--   service_role (self-heal do writer) OU public.is_admin()
--   (destrave manual pela UI). Igual ao padrao de db/38 e db/39.
--
-- Nao aplicar nesta fase. Migration versionada para revisao e apply
-- controlado futuro em staging. Idempotente (CREATE OR REPLACE).
-- Sem apply, sem dados reais, sem secrets.
-- ============================================================


-- ============================================================
-- 1. RPC public.recuperar_document_scan_runs_travados
-- ============================================================

CREATE OR REPLACE FUNCTION public.recuperar_document_scan_runs_travados(
  p_source      TEXT      DEFAULT NULL,               -- NULL = todas as sources
  p_stale_after INTERVAL  DEFAULT INTERVAL '30 minutes'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_source      TEXT     := NULLIF(btrim(p_source), '');
  -- Piso rigido de 5 minutos: nunca recupera um run que possa estar vivo.
  v_stale_after INTERVAL := GREATEST(
                              COALESCE(p_stale_after, INTERVAL '30 minutes'),
                              INTERVAL '5 minutes');
  v_recovered   JSONB;
BEGIN
  -- writer (service_role) OU admin autenticado
  IF NOT (auth.role() = 'service_role' OR public.is_admin()) THEN
    RETURN jsonb_build_object('ok', FALSE, 'error', 'not_authorized');
  END IF;

  WITH stale AS (
    SELECT id
      FROM public.document_scan_runs
     WHERE status = 'running'
       AND (v_source IS NULL OR source = v_source)
       AND started_at < now() - v_stale_after
     FOR UPDATE SKIP LOCKED                 -- impede dupla recuperacao concorrente
  ),
  updated AS (
    UPDATE public.document_scan_runs r
       SET status        = 'failed',
           finished_at   = now(),
           error_message = 'stale_recovered: exceeded ' || v_stale_after::text
                           || ', started_at='
                           || to_char(r.started_at AT TIME ZONE 'UTC',
                                      'YYYY-MM-DD"T"HH24:MI:SS"Z"')
      FROM stale
     WHERE r.id = stale.id
       AND r.status = 'running'             -- compare-and-swap: reconfirma o estado
    RETURNING r.id, r.source, r.started_at, r.finished_at
  )
  SELECT jsonb_agg(jsonb_build_object(
           'scan_run_id', id,
           'source',      source,
           'started_at',  started_at,
           'recovered_at', finished_at))
    INTO v_recovered
    FROM updated;

  RETURN jsonb_build_object(
    'ok', TRUE,
    'source', v_source,
    'stale_after', v_stale_after::text,
    'recovered_count', COALESCE(jsonb_array_length(v_recovered), 0),
    'recovered', COALESCE(v_recovered, '[]'::jsonb)
  );
END;
$$;

COMMENT ON FUNCTION public.recuperar_document_scan_runs_travados(TEXT, INTERVAL) IS
  'Recupera scans running abandonados via CAS running->failed (>= timeout com piso 5min), preservando auditoria. service_role ou admin.';


-- ============================================================
-- 2. Grants e reload do schema cache
-- ============================================================

REVOKE ALL ON FUNCTION public.recuperar_document_scan_runs_travados(TEXT, INTERVAL) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.recuperar_document_scan_runs_travados(TEXT, INTERVAL) FROM anon;
GRANT EXECUTE ON FUNCTION public.recuperar_document_scan_runs_travados(TEXT, INTERVAL) TO service_role;
GRANT EXECUTE ON FUNCTION public.recuperar_document_scan_runs_travados(TEXT, INTERVAL) TO authenticated;

NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';
