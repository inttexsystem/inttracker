-- ============================================================
-- Fase: RAVATEX-DOCUMENTS-G24-B1-R1-DOCUMENT-SCAN-REQUEST-QUEUE-HARDENING-CLOSEOUT
-- Fila de intencoes de scan separadas da execucao real.
--
-- Problema:
--   Ate G23-F-D, o app (Controle) chama public.iniciar_document_scan_run
--   (db/38), que insere diretamente em document_scan_runs. Isso mistura
--   intencao do operador com execucao real do Ingestor e acopla o fluxo
--   de UI a um INSERT dependente do indice unico parcial
--   document_scan_runs_running_source_uidx. Alem disso, nao ha como o
--   runner puxar trabalho de forma atomica nem como o app acompanhar
--   o estado real de uma solicitacao que ja foi entregue ao Ingestor.
--
-- Solucao:
--   Cria a tabela public.document_scan_requests como fila de intencoes:
--     * status: requested | claimed | running | completed | failed | cancelled
--     * source: origem logica do scan (ex.: gmail)
--     * requested_at, claimed_at, started_at, finished_at: trilha temporal
--     * scan_run_id: UUID da execucao real criada pelo Ingestor
--                    em document_scan_runs (somente apos claim)
--     * error_message: motivo canonico quando status='failed'
--                      (NAO exigido quando status='cancelled')
--     * requested_by_user_id: auth.uid() do admin que originou a
--                             solicitacao. Renomeado em R1 para alinhar
--                             a nomenclatura com a de
--                             decided_by_user_id / synced_by_user_id
--                             ja usada em outras tabelas de auditoria.
--     * 'cancelled' foi adicionado em R1 como estado terminal para
--       sinalizar uma solicitacao que o operador desistiu de processar.
--       Exige finished_at, NAO exige error_message, NAO permanece no
--       indice de requests ativas.
--       A RPC de cancelamento NAO e criada nesta fase; o estado
--       'cancelled' fica preparado no schema e podera ser setado
--       diretamente por uma RPC futura ou por um UPDATE de is_admin().
--
--   Acrescenta quatro RPCs com contratos estritos:
--     1. public.solicitar_document_scan(p_source TEXT DEFAULT 'gmail')
--        -> RETURNS JSONB
--        Admin-only (public.is_admin()). Garante que exista no maximo
--        uma request ativa por source (UNIQUE parcial sobre os estados
--        requested/claimed/running). Se ja houver ativa, retorna a
--        existente em vez de criar nova. NAO cria document_scan_run.
--        NAO acessa Gmail/Drive. NAO usa service_role.
--
--     2. public.claim_next_document_scan_request(p_source TEXT DEFAULT NULL)
--        -> RETURNS JSONB
--        Exclusivo do runner (service_role). Usa FOR UPDATE SKIP LOCKED
--        para impedir que duas instancias peguem a mesma request. Escolhe
--        apenas status='requested', transita atomicamente para 'claimed'
--        e preenche claimed_at. Quando a fila esta vazia, devolve
--        contrato explicito { ok: true, empty: true }.
--
--     3. public.mark_document_scan_request_running(
--            p_request_id UUID,
--            p_scan_run_id UUID)
--        -> RETURNS JSONB
--        Exclusivo do runner (service_role). Transicao SOMENTE de
--        'claimed' para 'running'. Associa o scan_run_id real criado
--        pelo Ingestor e preenche started_at. NAO cria document_scan_run.
--
--     4. public.finish_document_scan_request(
--            p_request_id UUID,
--            p_status TEXT,
--            p_error_message TEXT DEFAULT NULL)
--        -> RETURNS JSONB
--        Exclusivo do runner (service_role). Aceita apenas 'completed'
--        ou 'failed' (cancelled NAO entra nesta RPC nesta fase).
--        Transicao SOMENTE a partir de 'claimed' ou 'running' para
--        estado terminal. Preenche finished_at e grava error_message
--        quando status='failed'. Idempotente: chamada repetida em
--        estado terminal devolve { ok: true, idempotent: true } sem
--        corromper finished_at/error_message existentes.
--
-- Concorrencia:
--   - Unicidade ativa: UNIQUE INDEX PARCIAL sobre (source) restrito
--     a status IN ('requested','claimed','running'). Impede duas
--     requests ativas para a mesma source, sem depender de SELECT
--     previo + INSERT (que sofreria TOCTOU em chamadas paralelas).
--   - Claim atomico: FOR UPDATE SKIP LOCKED + UPDATE WHERE status =
--     'requested' RETURNING e a composicao canonica das migracoes 38
--     e 40. Reconfirmacao de status='requested' no WHERE do UPDATE
--     garante compare-and-swap estavel.
--   - Sem FK em scan_run_id: a tabela document_scan_runs continua
--     sendo o registro de execucao real; manter FK acoplada criaria
--     dependencia circular entre a fila de intencoes e o run. O runner
--     mantem a integridade via WHERE status='claimed' no update.
--
-- Autorizacao:
--   - Tabela: RLS admin-only (public.is_admin() com USING e WITH CHECK).
--   - Grants: REVOKE ALL de PUBLIC, anon, authenticated. GRANT SELECT
--     para authenticated para que admins possam acompanhar.
--   - RPCs:
--       solicitar_document_scan:    authenticated (gate is_admin()).
--       claim_next_document_scan_request:    service_role.
--       mark_document_scan_request_running:  service_role.
--       finish_document_scan_request:        service_role.
--   - Nenhuma credencial, service_role no frontend, FK fora de escopo,
--     Gmail/Drive, scheduler ou alteracao em db/38, db/39 ou db/40.
--
-- Nao aplicar nesta fase. Migration versionada para revisao e apply
-- controlado futuro em staging. CREATE OR REPLACE garante idempotencia
-- no apply. Sem apply, sem dados reais, sem secrets.
-- ============================================================


-- ============================================================
-- 1. Tabela public.document_scan_requests
-- ============================================================

CREATE TABLE IF NOT EXISTS public.document_scan_requests (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  source                TEXT        NOT NULL DEFAULT 'gmail',
  status                TEXT        NOT NULL DEFAULT 'requested',
  requested_by_user_id  UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  requested_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  claimed_at            TIMESTAMPTZ,
  started_at            TIMESTAMPTZ,
  finished_at           TIMESTAMPTZ,
  scan_run_id           UUID,
  error_message         TEXT,
  criado_em             TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.document_scan_requests IS
  'Fila de intencoes de scan criadas pelo app. Separada da execucao real em document_scan_runs.';
COMMENT ON COLUMN public.document_scan_requests.source IS
  'Origem logica do scan solicitado. Hoje apenas "gmail" e usado.';
COMMENT ON COLUMN public.document_scan_requests.status IS
  'requested|claimed|running|completed|failed|cancelled. Apenas uma request ativa (requested/claimed/running) por source. cancelled e estado terminal sem error_message.';
COMMENT ON COLUMN public.document_scan_requests.requested_by_user_id IS
  'auth.uid() do admin que originou a solicitacao. Nullable para permitir solicitacoes de sistema. Renomeado em R1 (era requested_by) para alinhar com a convencao de outras tabelas de auditoria.';
COMMENT ON COLUMN public.document_scan_requests.claimed_at IS
  'Preenchido quando o runner (service_role) faz claim atomico via claim_next_document_scan_request.';
COMMENT ON COLUMN public.document_scan_requests.started_at IS
  'Preenchido quando o runner associa a execucao real via mark_document_scan_request_running.';
COMMENT ON COLUMN public.document_scan_requests.finished_at IS
  'Preenchido em finish_document_scan_request quando o run termina como completed ou failed. Tambem exigido quando status=cancelled.';
COMMENT ON COLUMN public.document_scan_requests.scan_run_id IS
  'UUID do registro criado em public.document_scan_runs pelo Ingestor. Sem FK para evitar acoplamento.';
-- Sem foreign key intencionalmente:
-- a request e a execucao possuem ciclos de vida desacoplados,
-- e a auditoria da request deve sobreviver a cleanup manual de runs.
COMMENT ON COLUMN public.document_scan_requests.error_message IS
  'Motivo canonico registrado quando status=failed. Nao exigido quando status=cancelled. Preservado em re-finish idempotente.';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'document_scan_requests_status_check'
       AND conrelid = 'public.document_scan_requests'::regclass
  ) THEN
    ALTER TABLE public.document_scan_requests
      ADD CONSTRAINT document_scan_requests_status_check
      CHECK (status IN ('requested','claimed','running','completed','failed','cancelled'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'document_scan_requests_terminal_times_check'
       AND conrelid = 'public.document_scan_requests'::regclass
  ) THEN
    ALTER TABLE public.document_scan_requests
      ADD CONSTRAINT document_scan_requests_terminal_times_check
      CHECK (
        (status IN ('completed','failed','cancelled') AND finished_at IS NOT NULL)
        OR
        (status NOT IN ('completed','failed','cancelled') AND finished_at IS NULL)
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'document_scan_requests_running_started_check'
       AND conrelid = 'public.document_scan_requests'::regclass
  ) THEN
    ALTER TABLE public.document_scan_requests
      ADD CONSTRAINT document_scan_requests_running_started_check
      CHECK (
        (status = 'running' AND started_at IS NOT NULL)
        OR
        (status <> 'running')
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'document_scan_requests_claimed_consistency_check'
       AND conrelid = 'public.document_scan_requests'::regclass
  ) THEN
    ALTER TABLE public.document_scan_requests
      ADD CONSTRAINT document_scan_requests_claimed_consistency_check
      CHECK (
        (status IN ('claimed','running','completed','failed','cancelled') AND claimed_at IS NOT NULL)
        OR
        (status = 'requested' AND claimed_at IS NULL)
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'document_scan_requests_failed_reason_check'
       AND conrelid = 'public.document_scan_requests'::regclass
  ) THEN
    ALTER TABLE public.document_scan_requests
      ADD CONSTRAINT document_scan_requests_failed_reason_check
      CHECK (
        (status = 'failed'
          AND NULLIF(btrim(COALESCE(error_message, '')), '') IS NOT NULL)
        OR
        (status IS DISTINCT FROM 'failed' AND error_message IS NULL)
      );
  END IF;
END;
$$;


-- ============================================================
-- 2. Indices
-- ============================================================

-- Watcher do runner: encontra a proxima request pendente por source.
CREATE INDEX IF NOT EXISTS document_scan_requests_status_requested_idx
  ON public.document_scan_requests(status, requested_at)
  WHERE status = 'requested';

-- Acompanhamento administrativo: lista por source/requested_at.
CREATE INDEX IF NOT EXISTS document_scan_requests_source_requested_idx
  ON public.document_scan_requests(source, requested_at DESC);

-- Unicidade ativa por source: no maximo uma request em
-- requested/claimed/running. Impede duplicacao sem depender de
-- SELECT previo + INSERT (que sofreria TOCTOU em chamadas paralelas).
CREATE UNIQUE INDEX IF NOT EXISTS document_scan_requests_active_source_uidx
  ON public.document_scan_requests(source)
  WHERE status IN ('requested','claimed','running');


-- ============================================================
-- 3. RLS admin-only
-- ============================================================

ALTER TABLE public.document_scan_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS document_scan_requests_admin_all ON public.document_scan_requests;
CREATE POLICY document_scan_requests_admin_all ON public.document_scan_requests
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

REVOKE ALL ON TABLE public.document_scan_requests FROM PUBLIC;
REVOKE ALL ON TABLE public.document_scan_requests FROM anon;
REVOKE ALL ON TABLE public.document_scan_requests FROM authenticated;

-- Admin autenticado pode ler (a policy ainda exige is_admin()).
-- Escrita no nivel de tabela continua bloqueada: a UI passa pelas
-- RPCs SECURITY DEFINER abaixo. Nenhum grant de INSERT/UPDATE/DELETE
-- para authenticated ou anon, para nao permitir escrita direta.
GRANT SELECT ON TABLE public.document_scan_requests TO authenticated;


-- ============================================================
-- 4. RPC public.solicitar_document_scan
--    Admin-only. Cria ou reutiliza uma request ativa por source.
-- ============================================================

CREATE OR REPLACE FUNCTION public.solicitar_document_scan(
  p_source TEXT DEFAULT 'gmail'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_source     TEXT := COALESCE(NULLIF(btrim(p_source), ''), 'gmail');
  v_request_id UUID;
  v_status     TEXT;
  v_existing_id UUID;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('ok', FALSE, 'error', 'admin_required');
  END IF;

  -- 1) Caminho barato: ja existe request ativa? Devolve-a sem inserir.
  SELECT id, status
    INTO v_existing_id, v_status
    FROM public.document_scan_requests
   WHERE source = v_source
     AND status IN ('requested','claimed','running')
   ORDER BY requested_at DESC
   LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'ok', TRUE,
      'reused', TRUE,
      'request_id', v_existing_id,
      'source', v_source,
      'status', v_status
    );
  END IF;

  -- 2) Caminho de criacao. UNIQUE parcial ativo protege contra
  --    corrida com outra sessao admin que ja tenha inserido.
  INSERT INTO public.document_scan_requests (
    source, status, requested_by_user_id, requested_at
  )
  VALUES (
    v_source, 'requested', auth.uid(), now()
  )
  RETURNING id, status
    INTO v_request_id, v_status;

  RETURN jsonb_build_object(
    'ok', TRUE,
    'reused', FALSE,
    'request_id', v_request_id,
    'source', v_source,
    'status', v_status
  );
EXCEPTION
  WHEN unique_violation THEN
    -- Corrida: outra sessao admin acabou de criar. Recupera a ativa.
    SELECT id, status
      INTO v_existing_id, v_status
      FROM public.document_scan_requests
     WHERE source = v_source
       AND status IN ('requested','claimed','running')
     ORDER BY requested_at DESC
     LIMIT 1;

    IF v_existing_id IS NULL THEN
      RETURN jsonb_build_object('ok', FALSE, 'error', 'request_lookup_failed');
    END IF;

    RETURN jsonb_build_object(
      'ok', TRUE,
      'reused', TRUE,
      'request_id', v_existing_id,
      'source', v_source,
      'status', v_status
    );
END;
$$;

COMMENT ON FUNCTION public.solicitar_document_scan(TEXT) IS
  'Admin-only: cria ou reutiliza uma request ativa por source. Nao cria document_scan_run. Nao acessa Gmail/Drive. Nao usa service_role.';


-- ============================================================
-- 5. RPC public.claim_next_document_scan_request
--    service_role. Claim atomico via FOR UPDATE SKIP LOCKED.
-- ============================================================

CREATE OR REPLACE FUNCTION public.claim_next_document_scan_request(
  p_source TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_source     TEXT := NULLIF(btrim(p_source), '');
  v_request_id UUID;
  v_source_pick TEXT;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RETURN jsonb_build_object('ok', FALSE, 'error', 'service_role_required');
  END IF;

  -- Compare-and-swap: travar a linha candidata, revalidar status,
  -- promover para 'claimed' e devolver. FOR UPDATE SKIP LOCKED
  -- impede que duas instâncias peguem a mesma request.
  WITH picked AS (
    SELECT id, source
      FROM public.document_scan_requests
     WHERE status = 'requested'
       AND (v_source IS NULL OR source = v_source)
     ORDER BY requested_at ASC
     LIMIT 1
     FOR UPDATE SKIP LOCKED
  ),
  updated AS (
    UPDATE public.document_scan_requests r
       SET status     = 'claimed',
           claimed_at = now()
      FROM picked
     WHERE r.id = picked.id
       AND r.status = 'requested'
    RETURNING r.id, r.source
  )
  SELECT id, source
    INTO v_request_id, v_source_pick
    FROM updated;

  IF v_request_id IS NULL THEN
    RETURN jsonb_build_object(
      'ok', TRUE,
      'empty', TRUE,
      'source', v_source,
      'request_id', NULL,
      'status', NULL
    );
  END IF;

  RETURN jsonb_build_object(
    'ok', TRUE,
    'empty', FALSE,
    'request_id', v_request_id,
    'source', v_source_pick,
    'status', 'claimed'
  );
END;
$$;

COMMENT ON FUNCTION public.claim_next_document_scan_request(TEXT) IS
  'service_role-only: claim atomico da proxima request requested. FOR UPDATE SKIP LOCKED impede duplicidade entre runners. Fila vazia devolve empty=true.';


-- ============================================================
-- 6. RPC public.mark_document_scan_request_running
--    service_role. claimed -> running + associa scan_run_id.
-- ============================================================

CREATE OR REPLACE FUNCTION public.mark_document_scan_request_running(
  p_request_id UUID,
  p_scan_run_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_status TEXT;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RETURN jsonb_build_object('ok', FALSE, 'error', 'service_role_required');
  END IF;

  IF p_request_id IS NULL THEN
    RETURN jsonb_build_object('ok', FALSE, 'error', 'request_id_required');
  END IF;

  IF p_scan_run_id IS NULL THEN
    RETURN jsonb_build_object('ok', FALSE, 'error', 'scan_run_id_required');
  END IF;

  -- Transicao SOMENTE claimed -> running, preenchendo started_at e
  -- scan_run_id. Nao cria document_scan_run (responsabilidade do runner).
  UPDATE public.document_scan_requests
     SET status      = 'running',
         started_at  = now(),
         scan_run_id = p_scan_run_id
   WHERE id = p_request_id
     AND status = 'claimed'
  RETURNING status INTO v_status;

  IF v_status IS NULL THEN
    -- Diagnostico: linha nao existe OU nao esta em 'claimed'.
    SELECT status INTO v_status
      FROM public.document_scan_requests
     WHERE id = p_request_id;

    IF v_status IS NULL THEN
      RETURN jsonb_build_object('ok', FALSE, 'error', 'request_not_found');
    END IF;

    RETURN jsonb_build_object(
      'ok', FALSE,
      'error', 'invalid_transition',
      'request_id', p_request_id,
      'current_status', v_status
    );
  END IF;

  RETURN jsonb_build_object(
    'ok', TRUE,
    'request_id', p_request_id,
    'scan_run_id', p_scan_run_id,
    'status', v_status
  );
END;
$$;

COMMENT ON FUNCTION public.mark_document_scan_request_running(UUID, UUID) IS
  'service_role-only: claimed -> running, associa scan_run_id real criado pelo ingestor. Nao cria document_scan_run.';


-- ============================================================
-- 7. RPC public.finish_document_scan_request
--    service_role. claimed|running -> completed|failed.
--    Idempotente em estado terminal.
-- ============================================================

CREATE OR REPLACE FUNCTION public.finish_document_scan_request(
  p_request_id   UUID,
  p_status       TEXT,
  p_error_message TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_status_in   TEXT := lower(NULLIF(btrim(p_status), ''));
  v_error_in    TEXT := NULLIF(btrim(p_error_message), '');
  v_current     TEXT;
  v_new_id      UUID;
  v_new_status  TEXT;
  v_new_finished_at TIMESTAMPTZ;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RETURN jsonb_build_object('ok', FALSE, 'error', 'service_role_required');
  END IF;

  IF p_request_id IS NULL THEN
    RETURN jsonb_build_object('ok', FALSE, 'error', 'request_id_required');
  END IF;

  IF v_status_in NOT IN ('completed','failed') THEN
    RETURN jsonb_build_object('ok', FALSE, 'error', 'invalid_status');
  END IF;

  IF v_status_in = 'failed' AND v_error_in IS NULL THEN
    RETURN jsonb_build_object('ok', FALSE, 'error', 'error_message_required');
  END IF;

  -- Idempotencia: se ja esta no estado terminal alvo, devolve sem
  -- sobrescrever finished_at nem error_message.
  SELECT status INTO v_current
    FROM public.document_scan_requests
   WHERE id = p_request_id
   FOR UPDATE;

  IF v_current IS NULL THEN
    RETURN jsonb_build_object('ok', FALSE, 'error', 'request_not_found');
  END IF;

  IF v_current IN ('completed','failed') THEN
    RETURN jsonb_build_object(
      'ok', TRUE,
      'idempotent', TRUE,
      'request_id', p_request_id,
      'status', v_current
    );
  END IF;

  IF v_current NOT IN ('claimed','running') THEN
    RETURN jsonb_build_object(
      'ok', FALSE,
      'error', 'invalid_transition',
      'request_id', p_request_id,
      'current_status', v_current
    );
  END IF;

  UPDATE public.document_scan_requests
     SET status        = v_status_in,
         finished_at   = now(),
         error_message = CASE WHEN v_status_in = 'failed' THEN v_error_in ELSE NULL END
   WHERE id = p_request_id
     AND status IN ('claimed','running')
  RETURNING id, status, finished_at
    INTO v_new_id, v_new_status, v_new_finished_at;

  IF v_new_id IS NULL THEN
    -- Corrida improvavel (status mudou entre SELECT e UPDATE). Sinaliza
    -- para o runner tentar novamente no proximo ciclo.
    RETURN jsonb_build_object(
      'ok', FALSE,
      'error', 'concurrent_state_change',
      'request_id', p_request_id
    );
  END IF;

  RETURN jsonb_build_object(
    'ok', TRUE,
    'idempotent', FALSE,
    'request_id', v_new_id,
    'status', v_new_status,
    'finished_at', v_new_finished_at
  );
END;
$$;

COMMENT ON FUNCTION public.finish_document_scan_request(UUID, TEXT, TEXT) IS
  'service_role-only: claimed/running -> completed|failed, com finished_at e error_message quando failed. Idempotente em estado terminal.';


-- ============================================================
-- 8. Grants das RPCs e reload do schema cache
-- ============================================================

REVOKE ALL ON FUNCTION public.solicitar_document_scan(TEXT)                  FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_next_document_scan_request(TEXT)         FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mark_document_scan_request_running(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.finish_document_scan_request(UUID, TEXT, TEXT) FROM PUBLIC;

REVOKE ALL ON FUNCTION public.solicitar_document_scan(TEXT)                  FROM anon;
REVOKE ALL ON FUNCTION public.claim_next_document_scan_request(TEXT)         FROM anon;
REVOKE ALL ON FUNCTION public.mark_document_scan_request_running(UUID, UUID) FROM anon;
REVOKE ALL ON FUNCTION public.finish_document_scan_request(UUID, TEXT, TEXT) FROM anon;

-- Frontend admin chama solicitar_document_scan (gate is_admin()).
GRANT EXECUTE ON FUNCTION public.solicitar_document_scan(TEXT) TO authenticated;

-- Runner (service_role) chama as outras tres. Nao expose para authenticated.
GRANT EXECUTE ON FUNCTION public.claim_next_document_scan_request(TEXT)         TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_document_scan_request_running(UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.finish_document_scan_request(UUID, TEXT, TEXT) TO service_role;

NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';
