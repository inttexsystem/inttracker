-- =====================================================================
-- db/106a — THE BOUNDED CANONICAL WRITERS AND THE RECOVERY BASELINE
--
-- NATIVE-RECEIPT-COORDINATED-RELEASE-P4-AUTHORITY-SWITCH-R1, phase P4.
-- Implements PEDIDO_DERIVED_LIFECYCLE_RECOVERY_PLAN.md manifest row 21b
-- (section 9.9.N) and captures the 9.9.P recovery boundary.
--
-- WHY db/106 IS APPLIED IN TWO STEPS. The accepted design names ONE
-- containment migration, db/106, and this pair IS that migration: no
-- content was added, removed or reinterpreted, only ordered. The split is
-- a DEPLOYMENT-SAFETY ordering, not a phase boundary.
--
-- The reason is concrete. db/106b revokes the direct DML that the
-- CURRENTLY DEPLOYED frontend still performs, and the repointed frontend
-- cannot be deployed before the writers it calls exist. Applying one
-- migration containing both halves would therefore break live Pedido and
-- OP writes for the whole interval between the migration and the asset
-- deployment. Split, the release has no such window:
--
--   1. db/106a  — purely ADDITIVE. The old frontend keeps working
--                 untouched; the new writers simply become available.
--   2. publish  — the repointed assets deploy and start using them.
--   3. db/106b  — the narrowing lands only once nothing depends on the
--                 direct authority any more.
--
-- Nothing here narrows any authority. Every object is new, every grant is
-- additive, and the pre-P4 privilege matrix is captured verbatim so the
-- containment that follows has a proved way back.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. Safe-default assertions (TD2.1, the six protected creation facts)
--
-- Asserted BEFORE any grant is narrowed. If a protected field did not
-- actually carry a safe default, narrowing the grant would silently move
-- the decision to whatever the row happened to contain.
-- ---------------------------------------------------------------------
DO $defaults$
DECLARE
  v_def TEXT;
BEGIN
  -- 1. pedidos.status defaults to the canonical initial state (db/13).
  SELECT column_default INTO v_def FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'pedidos' AND column_name = 'status';
  IF v_def IS DISTINCT FROM '''rascunho''::text' THEN
    RAISE EXCEPTION 'db/106 TD2.1: pedidos.status default is %, expected ''rascunho''', COALESCE(v_def, 'NULL');
  END IF;

  -- 2. pedidos.revisao begins at 1 (db/92).
  SELECT column_default INTO v_def FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'pedidos' AND column_name = 'revisao';
  IF v_def IS NULL OR v_def NOT LIKE '1%' THEN
    RAISE EXCEPTION 'db/106 TD2.1: pedidos.revisao default is %, expected 1', COALESCE(v_def, 'NULL');
  END IF;

  -- 3. ops.status begins simulada (db/01).
  SELECT column_default INTO v_def FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'ops' AND column_name = 'status';
  IF v_def IS DISTINCT FROM '''simulada''::text' THEN
    RAISE EXCEPTION 'db/106 TD2.1: ops.status default is %, expected ''simulada''', COALESCE(v_def, 'NULL');
  END IF;

  -- 4. ops.ajuste_revisao begins at 0 (db/102).
  SELECT column_default INTO v_def FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'ops' AND column_name = 'ajuste_revisao';
  IF v_def IS NULL OR v_def NOT LIKE '0%' THEN
    RAISE EXCEPTION 'db/106 TD2.1: ops.ajuste_revisao default is %, expected 0', COALESCE(v_def, 'NULL');
  END IF;

  -- 5. Completion timestamps are not client-supplied: no default exists.
  SELECT column_default INTO v_def FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'ops' AND column_name = 'finalizada_em';
  IF v_def IS NOT NULL THEN
    RAISE EXCEPTION 'db/106 TD2.1: ops.finalizada_em acquired a default (%)', v_def;
  END IF;

  -- 6. op_itens.metros_ajustados begins NULL (db/01).
  SELECT column_default INTO v_def FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'op_itens' AND column_name = 'metros_ajustados';
  IF v_def IS NOT NULL THEN
    RAISE EXCEPTION 'db/106 TD2.1: op_itens.metros_ajustados acquired a default (%)', v_def;
  END IF;
END
$defaults$;

-- ---------------------------------------------------------------------
-- 3. Bounded canonical writers (TD2.1 21b)
-- ---------------------------------------------------------------------

-- 3.1 Administrative Pedido creation.
--
-- The Pedido, its items and its production priority are ONE transaction.
-- pedidos.status is NOT a parameter: administrative creation always
-- produces the canonical initial state, so the protected fact is owned by
-- the server and cannot be supplied by a caller.
--
-- A duplicate pedidos.numero is deliberately NOT caught. The unique
-- violation propagates with SQLSTATE 23505 and the constraint name, which
-- is exactly the error shape js/screens/pedido-numero-sugestao.js
-- isNumeroDuplicado() already recognises, so the accepted
-- suggestion-renewal and typed-value-preservation behaviour is preserved
-- without changing that owner.
CREATE OR REPLACE FUNCTION public.criar_pedido_admin(
  p_pedido     JSONB,
  p_itens      JSONB,
  p_prioridade JSONB DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
SET lock_timeout = '5s'
AS $$
DECLARE
  v_pedido_id UUID;
  v_row       public.pedidos%ROWTYPE;
  v_itens     JSONB;
  v_ids       UUID[];
  v_prio      JSONB;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'sem_permissao',
      'erro', 'Somente administrador autenticado pode criar um Pedido');
  END IF;

  IF p_itens IS NULL OR jsonb_typeof(p_itens) <> 'array' OR jsonb_array_length(p_itens) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'sem_itens',
      'erro', 'Um Pedido precisa de ao menos um item');
  END IF;

  -- pedidos.data_pedido is NOT NULL. Refusing explicitly gives the caller
  -- a stable code instead of a raw not-null violation.
  IF NULLIF(p_pedido->>'data_pedido', '') IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'data_pedido_obrigatoria',
      'erro', 'A data do Pedido e obrigatoria');
  END IF;

  -- pedidos.numero is an IDENTITY column. Omitting it lets the identity
  -- allocate, which is the accepted "leave it blank" behaviour; passing an
  -- explicit NULL would instead violate NOT NULL. The two cases are
  -- therefore separate statements, never one statement with a NULL.
  IF NULLIF(p_pedido->>'numero', '') IS NULL THEN
    INSERT INTO public.pedidos
      (cliente_id, data_pedido, prazo_entrega, observacao)
    VALUES (
      (p_pedido->>'cliente_id')::BIGINT,
      NULLIF(p_pedido->>'data_pedido', '')::DATE,
      NULLIF(p_pedido->>'prazo_entrega', '')::DATE,
      NULLIF(p_pedido->>'observacao', '')
    )
    RETURNING id INTO v_pedido_id;
  ELSE
    INSERT INTO public.pedidos
      (cliente_id, numero, data_pedido, prazo_entrega, observacao)
    VALUES (
      (p_pedido->>'cliente_id')::BIGINT,
      (p_pedido->>'numero')::INTEGER,
      NULLIF(p_pedido->>'data_pedido', '')::DATE,
      NULLIF(p_pedido->>'prazo_entrega', '')::DATE,
      NULLIF(p_pedido->>'observacao', '')
    )
    RETURNING id INTO v_pedido_id;
  END IF;

  INSERT INTO public.pedido_itens (pedido_id, modelo_id, metros, ordem, observacao)
  SELECT v_pedido_id,
         (e->>'modelo_id')::BIGINT,
         (e->>'metros')::NUMERIC,
         (e->>'ordem')::INTEGER,
         NULLIF(e->>'observacao', '')
    FROM jsonb_array_elements(p_itens) e;

  SELECT jsonb_agg(jsonb_build_object('id', i.id, 'ordem', i.ordem) ORDER BY i.ordem),
         array_agg(i.id ORDER BY i.ordem)
    INTO v_itens, v_ids
    FROM public.pedido_itens i
   WHERE i.pedido_id = v_pedido_id;

  -- Priority is part of the same transaction, so a Pedido is never
  -- persisted without the sequence its operator selected. That is what
  -- the retired client-side compensating DELETE existed to approximate.
  IF p_prioridade IS NOT NULL AND COALESCE((p_prioridade->>'habilitada')::BOOLEAN, FALSE) THEN
    v_prio := public.definir_prioridade_pedido(
      v_pedido_id, v_ids, TRUE, NULLIF(p_prioridade->>'observacao', ''), FALSE);
    IF COALESCE((v_prio->>'ok')::BOOLEAN, FALSE) IS NOT TRUE THEN
      RAISE EXCEPTION 'prioridade_recusada'
        USING ERRCODE = '22023',
              DETAIL  = COALESCE(v_prio->>'erro', v_prio::text);
    END IF;
  END IF;

  SELECT * INTO v_row FROM public.pedidos WHERE id = v_pedido_id;

  RETURN jsonb_build_object(
    'ok', true, 'codigo', 'ok',
    'pedido', jsonb_build_object('id', v_row.id, 'numero', v_row.numero,
                                 'status', v_row.status, 'data_pedido', v_row.data_pedido),
    'itens', COALESCE(v_itens, '[]'::jsonb));
END;
$$;

ALTER FUNCTION public.criar_pedido_admin(JSONB, JSONB, JSONB) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.criar_pedido_admin(JSONB, JSONB, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.criar_pedido_admin(JSONB, JSONB, JSONB) FROM anon;
REVOKE ALL ON FUNCTION public.criar_pedido_admin(JSONB, JSONB, JSONB) FROM service_role;
GRANT EXECUTE ON FUNCTION public.criar_pedido_admin(JSONB, JSONB, JSONB) TO authenticated;

-- 3.2 Client Pedido creation.
--
-- The ownership predicate of the retired pedidos_cliente_insert RLS
-- policy is reproduced explicitly, because a SECURITY DEFINER writer runs
-- as the owner and would otherwise bypass it: the caller may only create
-- a Pedido for its OWN cliente. The status is server-owned ('recebido'),
-- never supplied by the caller.
CREATE OR REPLACE FUNCTION public.criar_pedido_cliente(
  p_pedido     JSONB,
  p_itens      JSONB,
  p_prioridade JSONB DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
SET lock_timeout = '5s'
AS $$
DECLARE
  v_meu       BIGINT;
  v_cliente   BIGINT;
  v_pedido_id UUID;
  v_row       public.pedidos%ROWTYPE;
  v_itens     JSONB;
  v_ids       UUID[];
  v_prio      JSONB;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'sem_permissao',
      'erro', 'Autenticacao obrigatoria');
  END IF;

  v_meu := public.meu_cliente_id();
  v_cliente := (p_pedido->>'cliente_id')::BIGINT;
  IF v_meu IS NULL OR v_cliente IS NULL OR v_cliente <> v_meu THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'sem_permissao',
      'erro', 'Um cliente so pode criar Pedido para si mesmo');
  END IF;

  IF p_itens IS NULL OR jsonb_typeof(p_itens) <> 'array' OR jsonb_array_length(p_itens) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'sem_itens',
      'erro', 'Um Pedido precisa de ao menos um item');
  END IF;

  IF NULLIF(p_pedido->>'data_pedido', '') IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'data_pedido_obrigatoria',
      'erro', 'A data do Pedido e obrigatoria');
  END IF;

  INSERT INTO public.pedidos
    (cliente_id, status, data_pedido, prazo_entrega, observacao)
  VALUES (
    v_cliente,
    'recebido',
    NULLIF(p_pedido->>'data_pedido', '')::DATE,
    NULLIF(p_pedido->>'prazo_entrega', '')::DATE,
    NULLIF(p_pedido->>'observacao', '')
  )
  RETURNING id INTO v_pedido_id;

  INSERT INTO public.pedido_itens (pedido_id, modelo_id, metros, ordem, observacao)
  SELECT v_pedido_id,
         (e->>'modelo_id')::BIGINT,
         (e->>'metros')::NUMERIC,
         (e->>'ordem')::INTEGER,
         NULLIF(e->>'observacao', '')
    FROM jsonb_array_elements(p_itens) e;

  SELECT jsonb_agg(jsonb_build_object('id', i.id, 'ordem', i.ordem) ORDER BY i.ordem),
         array_agg(i.id ORDER BY i.ordem)
    INTO v_itens, v_ids
    FROM public.pedido_itens i
   WHERE i.pedido_id = v_pedido_id;

  IF p_prioridade IS NOT NULL AND COALESCE((p_prioridade->>'habilitada')::BOOLEAN, FALSE) THEN
    v_prio := public.definir_prioridade_pedido(
      v_pedido_id, v_ids, TRUE, NULLIF(p_prioridade->>'observacao', ''), FALSE);
    IF COALESCE((v_prio->>'ok')::BOOLEAN, FALSE) IS NOT TRUE THEN
      RAISE EXCEPTION 'prioridade_recusada'
        USING ERRCODE = '22023',
              DETAIL  = COALESCE(v_prio->>'erro', v_prio::text);
    END IF;
  END IF;

  SELECT * INTO v_row FROM public.pedidos WHERE id = v_pedido_id;

  RETURN jsonb_build_object(
    'ok', true, 'codigo', 'ok',
    'pedido', jsonb_build_object('id', v_row.id, 'numero', v_row.numero, 'status', v_row.status),
    'itens', COALESCE(v_itens, '[]'::jsonb));
END;
$$;

ALTER FUNCTION public.criar_pedido_cliente(JSONB, JSONB, JSONB) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.criar_pedido_cliente(JSONB, JSONB, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.criar_pedido_cliente(JSONB, JSONB, JSONB) FROM anon;
REVOKE ALL ON FUNCTION public.criar_pedido_cliente(JSONB, JSONB, JSONB) FROM service_role;
GRANT EXECUTE ON FUNCTION public.criar_pedido_cliente(JSONB, JSONB, JSONB) TO authenticated;

-- 3.3 Atomic replacement of an OP's item set.
--
-- Replaces the client's delete-then-insert pair, which loses its DELETE
-- privilege under TD2.2. The whole set is replaced in one transaction, so
-- an OP is never left with a partial item set.
CREATE OR REPLACE FUNCTION public.substituir_itens_op(
  p_op_id BIGINT,
  p_itens JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
SET lock_timeout = '5s'
AS $$
DECLARE
  v_status TEXT;
  v_n      INTEGER;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'sem_permissao',
      'erro', 'Somente administrador autenticado pode alterar os itens de uma OP');
  END IF;

  IF p_itens IS NULL OR jsonb_typeof(p_itens) <> 'array' THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'payload_invalido',
      'erro', 'p_itens deve ser um array');
  END IF;

  PERFORM public._p4_lock_dominio_pedido(public._p4_pedido_de_op(p_op_id));

  SELECT status INTO v_status FROM public.ops WHERE id = p_op_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'nao_encontrada', 'erro', 'OP nao encontrada');
  END IF;

  -- The item set is editable only while the OP has not started producing.
  IF v_status NOT IN ('simulada', 'aberta') THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'estado_invalido',
      'erro', 'Os itens so podem ser alterados enquanto a OP esta simulada ou aberta',
      'status', v_status);
  END IF;

  DELETE FROM public.op_itens WHERE op_id = p_op_id;

  INSERT INTO public.op_itens (op_id, modelo_id, metros_pedidos, pedido_item_id)
  SELECT p_op_id,
         (e->>'modelo_id')::BIGINT,
         (e->>'metros_pedidos')::NUMERIC,
         NULLIF(e->>'pedido_item_id', '')::UUID
    FROM jsonb_array_elements(p_itens) e;

  GET DIAGNOSTICS v_n = ROW_COUNT;

  RETURN jsonb_build_object('ok', true, 'codigo', 'ok', 'op_id', p_op_id, 'itens', v_n);
EXCEPTION
  WHEN lock_not_available THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'concorrencia_ocupada',
      'erro', 'Outra operacao esta alterando este Pedido. Tente novamente.');
END;
$$;

ALTER FUNCTION public.substituir_itens_op(BIGINT, JSONB) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.substituir_itens_op(BIGINT, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.substituir_itens_op(BIGINT, JSONB) FROM anon;
REVOKE ALL ON FUNCTION public.substituir_itens_op(BIGINT, JSONB) FROM service_role;
GRANT EXECUTE ON FUNCTION public.substituir_itens_op(BIGINT, JSONB) TO authenticated;

-- 3.4 Opening a weaving OP — transition AND needs synchronisation, atomic.
--
-- See the header: the synchronisation only sees an OP that is already
-- 'aberta', and the db/21 matrix has no aberta -> simulada edge, so these
-- two steps cannot be separated by a client. Either the OP ends up open
-- with its purchasing needs synchronised, or nothing happened at all.
--
-- The legacy purchasing regime has no writer on this path and fails
-- honestly. Fabricating flat ordens_compra_fio rows is prohibited, even
-- as a temporary compatibility measure.
CREATE OR REPLACE FUNCTION public.abrir_op_tecelagem(p_op_id BIGINT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
SET lock_timeout = '5s'
AS $$
DECLARE
  v_status    TEXT;
  v_pedido    UUID;
  v_transicao JSONB;
  v_regime    JSONB;
  v_sync      JSONB;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'sem_permissao',
      'erro', 'Somente administrador autenticado pode abrir uma OP');
  END IF;

  v_pedido := public._p4_pedido_de_op(p_op_id);
  PERFORM public._p4_lock_dominio_pedido(v_pedido);

  SELECT status INTO v_status FROM public.ops WHERE id = p_op_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'nao_encontrada', 'erro', 'OP nao encontrada');
  END IF;
  IF v_pedido IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'pedido_required',
      'erro', 'Nao e possivel abrir OP sem Pedido vinculado');
  END IF;

  -- Already open is a success, not an error: the caller may be retrying
  -- after a transport failure, and the synchronisation below is itself
  -- idempotent.
  IF v_status = 'simulada' THEN
    v_transicao := public.alterar_status_op(p_op_id, 'aberta', NULL);
    IF COALESCE((v_transicao->>'ok')::BOOLEAN, FALSE) IS NOT TRUE THEN
      RETURN jsonb_build_object('ok', false, 'codigo', 'transicao_recusada',
        'erro', COALESCE(v_transicao->>'erro', 'Nao foi possivel abrir a OP'));
    END IF;
  ELSIF v_status <> 'aberta' THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'estado_invalido',
      'erro', 'Somente uma OP simulada ou aberta pode ser aberta', 'status', v_status);
  END IF;

  v_regime := public.resolver_regime_compra_fio_pedido(v_pedido);
  IF COALESCE((v_regime->>'ok')::BOOLEAN, FALSE) IS NOT TRUE THEN
    RAISE EXCEPTION 'regime_resolve'
      USING ERRCODE = '22023',
            DETAIL  = COALESCE(v_regime->>'erro', v_regime::text);
  END IF;

  IF COALESCE(v_regime->>'modelo', '') <> 'native' THEN
    RAISE EXCEPTION 'regime_legado_sem_escritor'
      USING ERRCODE = '22023',
            DETAIL  = 'Este Pedido esta no regime de compra legado, que nao tem escritor de ordens de fio.';
  END IF;

  v_sync := public.sincronizar_necessidades_compra_fio(v_pedido);
  IF COALESCE((v_sync->>'ok')::BOOLEAN, FALSE) IS NOT TRUE THEN
    RAISE EXCEPTION 'necessidades_sync'
      USING ERRCODE = '22023',
            DETAIL  = COALESCE(v_sync->>'erro', v_sync::text);
  END IF;

  RETURN jsonb_build_object('ok', true, 'codigo', 'ok',
    'op_id', p_op_id, 'modelo', 'native',
    'status', (SELECT status FROM public.ops WHERE id = p_op_id));
EXCEPTION
  WHEN lock_not_available THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'concorrencia_ocupada',
      'erro', 'Outra operacao esta alterando este Pedido. Tente novamente.');
END;
$$;

ALTER FUNCTION public.abrir_op_tecelagem(BIGINT) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.abrir_op_tecelagem(BIGINT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.abrir_op_tecelagem(BIGINT) FROM anon;
REVOKE ALL ON FUNCTION public.abrir_op_tecelagem(BIGINT) FROM service_role;
GRANT EXECUTE ON FUNCTION public.abrir_op_tecelagem(BIGINT) TO authenticated;

-- 3.5 The client-visible tracking fields.
--
-- pedidos.status_cliente_* is excluded from the re-issued UPDATE grant by
-- L.2, and no canonical writer owned it. Rather than silently disabling a
-- working administrative capability, P4 gives it a bounded server-owned
-- owner. The behaviour is unchanged: same operator, same three fields,
-- same result; only the authority moved to the server.
CREATE OR REPLACE FUNCTION public.salvar_situacao_visivel_pedido(
  p_pedido_id     UUID,
  p_status_visual TEXT,
  p_excecao       TEXT DEFAULT NULL,
  p_mensagem      TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
SET lock_timeout = '5s'
AS $$
DECLARE
  v_existe BOOLEAN;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'sem_permissao',
      'erro', 'Somente administrador autenticado pode alterar a situacao visivel');
  END IF;

  IF COALESCE(p_status_visual, '') = '' THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'payload_invalido',
      'erro', 'A etapa visivel e obrigatoria');
  END IF;

  SELECT TRUE INTO v_existe FROM public.pedidos WHERE id = p_pedido_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'nao_encontrado', 'erro', 'Pedido nao encontrado');
  END IF;

  -- The CHECK constraints on these columns remain the authority on which
  -- values are admissible; this writer does not restate them.
  UPDATE public.pedidos
     SET status_cliente_visual   = p_status_visual,
         status_cliente_excecao  = NULLIF(p_excecao, ''),
         status_cliente_mensagem = NULLIF(p_mensagem, '')
   WHERE id = p_pedido_id;

  RETURN jsonb_build_object('ok', true, 'codigo', 'ok', 'pedido_id', p_pedido_id);
EXCEPTION
  WHEN lock_not_available THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'concorrencia_ocupada',
      'erro', 'Outra operacao esta alterando este Pedido. Tente novamente.');
END;
$$;

ALTER FUNCTION public.salvar_situacao_visivel_pedido(UUID, TEXT, TEXT, TEXT) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.salvar_situacao_visivel_pedido(UUID, TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.salvar_situacao_visivel_pedido(UUID, TEXT, TEXT, TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.salvar_situacao_visivel_pedido(UUID, TEXT, TEXT, TEXT) FROM service_role;
GRANT EXECUTE ON FUNCTION public.salvar_situacao_visivel_pedido(UUID, TEXT, TEXT, TEXT) TO authenticated;

-- ---------------------------------------------------------------------
-- ---------------------------------------------------------------------
-- 4.0 The recovery baseline, captured BEFORE the first narrowing.
--
-- 9.9.P names the P4 recovery as "re-apply db/106 rollback block restoring
-- the prior grant". A blanket re-GRANT cannot do that honestly: it would
-- restore whatever this migration happens to name rather than what the
-- environment actually had, and the two differ between the production
-- project and any reconstructed cluster, because part of the pre-P4 matrix
-- comes from Supabase platform defaults rather than from db/**. Measured on
-- the disposable rehearsal: a blanket rollback over-granted 20 privileges
-- that the cluster never held.
--
-- So the prior matrix is CAPTURED, exactly as measured, and the rollback
-- replays it row for row. Same principle as the cutover ACL manifest of
-- 9.9.G.2.1: restoration replays what was recorded, never what was assumed.
--
-- Captured only when empty, so re-applying db/106 never overwrites the true
-- pre-P4 baseline with the already-narrowed state.
CREATE TABLE IF NOT EXISTS public.p4_contencao_acl_baseline (
  id            BIGSERIAL PRIMARY KEY,
  objeto_tabela TEXT NOT NULL,
  grantee       TEXT NOT NULL,
  privilegio    TEXT NOT NULL,
  capturado_em  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (objeto_tabela, grantee, privilegio)
);

ALTER TABLE public.p4_contencao_acl_baseline OWNER TO postgres;
REVOKE ALL ON TABLE public.p4_contencao_acl_baseline FROM PUBLIC;
REVOKE ALL ON TABLE public.p4_contencao_acl_baseline FROM anon;
REVOKE ALL ON TABLE public.p4_contencao_acl_baseline FROM authenticated;
REVOKE ALL ON TABLE public.p4_contencao_acl_baseline FROM service_role;

COMMENT ON TABLE public.p4_contencao_acl_baseline IS
  'db/106 (9.9.P): the EXACT pre-P4 table-grant matrix of pedidos, ops, op_itens and saldo_fios_op for anon, authenticated and service_role, captured immediately before the containment narrowing. It is the executable recovery boundary of the P4 authority switch: the rollback block replays these rows verbatim. Owner-only.';

INSERT INTO public.p4_contencao_acl_baseline (objeto_tabela, grantee, privilegio)
SELECT g.table_name, g.grantee, g.privilege_type
  FROM information_schema.role_table_grants g
 WHERE g.table_schema = 'public'
   AND g.table_name IN ('pedidos', 'ops', 'op_itens', 'saldo_fios_op')
   AND g.grantee IN ('anon', 'authenticated', 'service_role')
   AND NOT EXISTS (SELECT 1 FROM public.p4_contencao_acl_baseline)
ON CONFLICT (objeto_tabela, grantee, privilegio) DO NOTHING;


-- ---------------------------------------------------------------------
-- 5. Self-verification — fail closed inside the same transaction
-- ---------------------------------------------------------------------
DO $db106a$
DECLARE
  v_role TEXT;
  v_fn   TEXT;
BEGIN
  -- The five bounded writers are reachable by authenticated and nobody else.
  FOREACH v_fn IN ARRAY ARRAY[
    'public.criar_pedido_admin(jsonb,jsonb,jsonb)',
    'public.criar_pedido_cliente(jsonb,jsonb,jsonb)',
    'public.substituir_itens_op(bigint,jsonb)',
    'public.abrir_op_tecelagem(bigint)',
    'public.salvar_situacao_visivel_pedido(uuid,text,text,text)'
  ] LOOP
    IF NOT has_function_privilege('authenticated', v_fn, 'EXECUTE') THEN
      RAISE EXCEPTION 'db/106a: authenticated cannot reach the bounded writer %', v_fn;
    END IF;
    FOREACH v_role IN ARRAY ARRAY['anon', 'service_role'] LOOP
      IF has_function_privilege(v_role, v_fn, 'EXECUTE') THEN
        RAISE EXCEPTION 'db/106a: % still holds EXECUTE on %', v_role, v_fn;
      END IF;
    END LOOP;
  END LOOP;

  -- The recovery boundary was captured BEFORE anything was narrowed.
  IF NOT EXISTS (SELECT 1 FROM public.p4_contencao_acl_baseline) THEN
    RAISE EXCEPTION 'db/106a 9.9.P: the recovery baseline was not captured';
  END IF;

  -- db/106a is ADDITIVE and deliberately asserts NOTHING about whether the
  -- containment has already run. Ordering is enforced from the other side:
  -- db/106b refuses to start unless these five writers and the recovery
  -- baseline already exist. Asserting it here as well would make db/106a
  -- non-re-appliable once db/106b had landed, breaking the 9.9.O property
  -- that every migration is a byte-identical no-op on re-apply.

  -- The cutover is untouched and the PONR is uncrossed.
  PERFORM 1 FROM public.ordem_compra_cutover
   WHERE id = 1 AND status = 'legacy_active' AND read_authority = 'flat'
     AND productive_receipt_started_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'db/106a: ordem_compra_cutover is not legacy_active/flat with an uncrossed PONR';
  END IF;
END
$db106a$;

COMMIT;
