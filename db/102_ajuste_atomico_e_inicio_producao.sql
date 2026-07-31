-- =====================================================================
-- db/102 — ATOMIC PRODUCTION ADJUSTMENT AND SERVER-OWNED PRODUCTION START
--
-- NATIVE-RECEIPT-COORDINATED-RELEASE-P1-ADDITIVE-BACKEND-R1, phase P1.
-- Implements PEDIDO_DERIVED_LIFECYCLE_RECOVERY_PLAN.md sections 9.9.B
-- (one concurrency domain), 9.9.C (atomic adjustment RPC) and 9.9.D
-- (server-owned production start).
--
-- ADDITIVE ONLY. Everything here is new: one column with a safe default
-- and three functions under NEW names. No existing function body is
-- replaced, no existing grant is revoked, and no reachable behaviour
-- changes. In particular alterar_status_op, the receipt and reversal
-- writers, emitir_ordem_compra, cancelar_ordem_compra and
-- excluir_ordem_compra are untouched: their lock-protocol correction is
-- db/104, which belongs to P4 and is NOT part of this release.
--
-- LOCK PROTOCOL (9.9.B). Global order, shared by every writer that can
-- reduce or release productive availability:
--     pedidos -> ops (ASC id) -> op_itens (ASC id)
--        -> ordem_compra (ASC id) -> ordem_compra_item_alocacao (ASC id)
-- with SET LOCAL lock_timeout = '5s' in every one. The Pedido row is the
-- serialization point wherever the shared polyester pool can be touched.
--
-- REVISION MODEL (9.9.C). A NARROWLY NAMED adjustment revision,
-- ops.ajuste_revisao, owned ONLY by salvar_ajuste_producao_op and
-- iniciar_producao_op. A general ops.revisao is rejected: unrelated
-- writers (alterar_status_op, latex creation, lote linking) would
-- silently bypass it and produce false confidence. alterar_status_op
-- does NOT increment it; under db/104 it will take the same locks, so it
-- cannot interleave dangerously.
--
-- FULL VALIDATION PRECEDES ANY WRITE, so the known non-atomic-RETURN
-- hazard of a mid-loop RETURN cannot occur.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. The adjustment revision column (safe default, additive)
-- ---------------------------------------------------------------------
ALTER TABLE public.ops
  ADD COLUMN IF NOT EXISTS ajuste_revisao INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.ops.ajuste_revisao IS
  'db/102 (9.9.C): optimistic-concurrency token for the production adjustment, owned ONLY by salvar_ajuste_producao_op and iniciar_producao_op. NOT a general ops.revisao: alterar_status_op and every other writer deliberately leave it untouched.';

-- ---------------------------------------------------------------------
-- 2. _op_status_aplicar — the internal OP lifecycle helper
--
-- OWNER-ONLY. Carries the same transition matrix alterar_status_op
-- enforces, but performs NO authorization and acquires NO locks: it is
-- called only from a guarded SECURITY DEFINER writer that has already
-- authorized the actor and taken the global lock order.
--
-- The existing AFTER UPDATE OF status trigger trg_op_evento already
-- writes the canonical op_eventos row, so this helper never duplicates
-- it; it only attaches the motive to the row that transition produced.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._op_status_aplicar(
  p_op_id        BIGINT,
  p_novo_status  TEXT,
  p_motivo       TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_atual TEXT;
  v_ok    BOOLEAN;
BEGIN
  SELECT o.status INTO v_atual FROM public.ops o WHERE o.id = p_op_id;
  IF v_atual IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'OP_NAO_ENCONTRADA');
  END IF;

  IF v_atual = p_novo_status THEN
    RETURN jsonb_build_object('ok', true, 'codigo', 'SEM_MUDANCA',
                              'status_anterior', v_atual, 'status_novo', v_atual);
  END IF;

  v_ok := CASE v_atual
            WHEN 'simulada'    THEN p_novo_status IN ('aberta', 'cancelada')
            WHEN 'aberta'      THEN p_novo_status IN ('em_producao', 'cancelada')
            WHEN 'em_producao' THEN p_novo_status IN ('pausada', 'concluida', 'cancelada')
            WHEN 'pausada'     THEN p_novo_status IN ('em_producao', 'cancelada')
            ELSE FALSE
          END;

  IF NOT v_ok THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'OP_TRANSICAO_INVALIDA',
                              'status_anterior', v_atual, 'status_novo', p_novo_status);
  END IF;

  -- No writer is added for ops.finalizada (9.9.L): it is not reachable
  -- from this helper's matrix and this release does not introduce one.
  IF p_novo_status = 'concluida' THEN
    UPDATE public.ops
       SET status = p_novo_status, finalizada_em = COALESCE(finalizada_em, now())
     WHERE id = p_op_id;
  ELSE
    UPDATE public.ops SET status = p_novo_status WHERE id = p_op_id;
  END IF;

  IF p_motivo IS NOT NULL THEN
    UPDATE public.op_eventos
       SET observacao = p_motivo
     WHERE id = (SELECT e.id FROM public.op_eventos e
                  WHERE e.op_id = p_op_id
                    AND e.tipo_evento = 'status_alterado'
                    AND e.status_novo = p_novo_status
                  ORDER BY e.criado_em DESC, e.id DESC
                  LIMIT 1);
  END IF;

  RETURN jsonb_build_object('ok', true, 'status_anterior', v_atual,
                            'status_novo', p_novo_status, 'op_id', p_op_id);
END;
$$;

COMMENT ON FUNCTION public._op_status_aplicar(BIGINT, TEXT, TEXT) IS
  'db/102: OWNER-ONLY internal OP lifecycle transition. Authorization and the global lock order belong to the calling guarded writer. Never writes ops.finalizada.';

-- ---------------------------------------------------------------------
-- 3. _op_reserva_proposta — kg the payload would reserve, per axis
--
-- OWNER-ONLY. Applies exactly the shipped recipe of
-- js/calculo-op.js::calcularFiosOP to a PROPOSED metres payload, so the
-- client never supplies kilograms and the server is the sole authority
-- on how metres become material.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._op_reserva_proposta(
  p_op_id         BIGINT,
  p_itens         JSONB,
  p_material      TEXT,
  p_cor_id        BIGINT,
  p_cor_poliester TEXT
) RETURNS NUMERIC(12,3)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT coalesce(sum(
           CASE
             WHEN p_material = 'algodao' THEN
               j.metros * pl.algodao_por_ml * pl.valor_x
               * ( (CASE WHEN m.cor_1_id = p_cor_id THEN 1 ELSE 0 END)
                 + (CASE WHEN m.cor_2_id = p_cor_id THEN 1 ELSE 0 END) )
             WHEN p_material = 'poliester' THEN
               j.metros * pl.poliester_por_ml * pl.valor_x
             ELSE 0
           END), 0)::NUMERIC(12,3)
    FROM jsonb_array_elements(p_itens) AS e(item)
    CROSS JOIN LATERAL (
      SELECT (e.item ->> 'op_item_id')::BIGINT AS op_item_id,
             NULLIF(e.item ->> 'metros_ajustados', '')::NUMERIC(10,2) AS metros
    ) AS j
    JOIN public.op_itens oi ON oi.id = j.op_item_id AND oi.op_id = p_op_id
    JOIN public.modelos m   ON m.id = oi.modelo_id
    JOIN public.parametros_largura pl ON pl.largura = m.largura
   WHERE j.metros IS NOT NULL;
$$;

COMMENT ON FUNCTION public._op_reserva_proposta(BIGINT, JSONB, TEXT, BIGINT, TEXT) IS
  'db/102 (9.9.C): kilograms a PROPOSED metres payload would reserve on one material/colour axis, derived server-side by the shipped recipe. OWNER-ONLY. The client never supplies kilograms.';

-- ---------------------------------------------------------------------
-- 4. salvar_ajuste_producao_op — the atomic adjustment RPC (9.9.C)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.salvar_ajuste_producao_op(
  p_op_id           BIGINT,
  p_base_ajuste_rev INTEGER,
  p_itens           JSONB
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_pedido_id  UUID;
  v_status     TEXT;
  v_rev        INTEGER;
  v_total_op   INTEGER;
  v_total_pay  INTEGER;
  v_eixo       RECORD;
  v_teto       NUMERIC(12,3);
  v_proposto   NUMERIC(12,3);
  v_liquido    NUMERIC(12,3);
  v_outras_r   NUMERIC(12,3);
  v_outras_c   NUMERIC(12,3);
  v_aplicados  INTEGER := 0;
BEGIN
  -- 1. AUTHORIZE
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'sem_permissao' USING ERRCODE = '42501';
  END IF;

  -- 2. VALIDATE PAYLOAD SHAPE
  IF p_itens IS NULL OR jsonb_typeof(p_itens) <> 'array' THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'AJUSTE_PAYLOAD_INCOMPLETO',
                              'detalhe', 'p_itens deve ser um array absoluto e completo');
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_itens) AS e(item)
     WHERE (e.item ->> 'op_item_id') IS NULL
        OR (e.item ->> 'op_item_id') !~ '^[0-9]+$'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'AJUSTE_PAYLOAD_INCOMPLETO',
                              'detalhe', 'op_item_id ausente ou nao numerico');
  END IF;

  -- 3. RESOLVE THE PEDIDO FROM THE OP
  SELECT lt.pedido_id INTO v_pedido_id
    FROM public.ops o
    JOIN public.lotes lt ON lt.id = o.lote_id
   WHERE o.id = p_op_id;
  IF v_pedido_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'AJUSTE_OP_SEM_PEDIDO');
  END IF;

  -- 4. ACQUIRE LOCKS IN THE GLOBAL ORDER, bounded (9.9.B)
  BEGIN
    SET LOCAL lock_timeout = '5s';
    PERFORM 1 FROM public.pedidos WHERE id = v_pedido_id FOR UPDATE;
    PERFORM 1 FROM public.ops o
      JOIN public.lotes lt ON lt.id = o.lote_id
     WHERE lt.pedido_id = v_pedido_id
     ORDER BY o.id
       FOR UPDATE OF o;
    PERFORM 1 FROM public.op_itens oi
     WHERE oi.op_id = p_op_id
     ORDER BY oi.id
       FOR UPDATE;
  EXCEPTION WHEN lock_not_available THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'concorrencia_ocupada');
  END;

  -- 5. RELOAD INSIDE THE LOCK
  SELECT o.status, o.ajuste_revisao INTO v_status, v_rev
    FROM public.ops o WHERE o.id = p_op_id;

  -- 6. VALIDATE CURRENT STATE
  IF v_status NOT IN ('simulada', 'aberta') THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'AJUSTE_OP_ESTADO_INVALIDO',
                              'status', v_status);
  END IF;

  -- 6b. A cancelled Pedido blocks the adjustment writer (9.9.M).
  IF EXISTS (SELECT 1 FROM public.pedidos WHERE id = v_pedido_id AND status = 'cancelado') THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'PEDIDO_CANCELADO');
  END IF;

  -- 7. VALIDATE THE REVISION, only after the locks and the reload
  IF p_base_ajuste_rev IS DISTINCT FROM v_rev THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'AJUSTE_REVISAO_DESATUALIZADA',
                              'ajuste_revisao_atual', v_rev);
  END IF;

  -- 8. THE PAYLOAD IS ABSOLUTE AND COMPLETE: exactly the OP's items, once each.
  SELECT count(*) INTO v_total_op FROM public.op_itens WHERE op_id = p_op_id;
  SELECT count(DISTINCT (e.item ->> 'op_item_id')::BIGINT) INTO v_total_pay
    FROM jsonb_array_elements(p_itens) AS e(item);
  IF v_total_pay <> v_total_op
     OR EXISTS (
          SELECT 1 FROM jsonb_array_elements(p_itens) AS e(item)
           WHERE NOT EXISTS (
             SELECT 1 FROM public.op_itens oi
              WHERE oi.id = (e.item ->> 'op_item_id')::BIGINT AND oi.op_id = p_op_id))
     OR jsonb_array_length(p_itens) <> v_total_op THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'AJUSTE_PAYLOAD_INCOMPLETO',
                              'itens_op', v_total_op, 'itens_payload', v_total_pay);
  END IF;

  -- 9. VALIDATE EVERY AXIS AGAINST ITS CEILING, BEFORE ANY WRITE (9.9.A)
  FOR v_eixo IN
    SELECT DISTINCT d.origem_tipo, d.material, d.cor_id, d.cor_poliester
      FROM public._oc_disponibilidade_linhas(p_op_id) d
  LOOP
    v_liquido := public._oc_material_recebido_liquido(
      v_pedido_id, p_op_id, v_eixo.origem_tipo, v_eixo.material,
      v_eixo.cor_id, v_eixo.cor_poliester);

    SELECT r.kg_reservado, r.kg_comprometido INTO v_outras_r, v_outras_c
      FROM public._oc_reserva_ativa(v_pedido_id, v_eixo.material, v_eixo.cor_id,
                                    v_eixo.cor_poliester, p_op_id, NULL) r;

    -- OP-origin: sibling reservations do NOT reduce the ceiling.
    -- Pedido-origin: the shared pool is reduced by every OTHER active OP.
    -- The target OP's OWN reservation is never subtracted, so a
    -- replacement payload validates against the raw ceiling (9.9.A.2).
    v_teto := GREATEST(0, v_liquido
                - CASE WHEN v_eixo.origem_tipo = 'op' THEN 0
                       ELSE v_outras_r + v_outras_c END)::NUMERIC(12,3);

    v_proposto := public._op_reserva_proposta(
      p_op_id, p_itens, v_eixo.material, v_eixo.cor_id, v_eixo.cor_poliester);

    IF v_proposto > v_teto THEN
      RETURN jsonb_build_object(
        'ok', false, 'codigo', 'AJUSTE_EXCEDE_DISPONIVEL',
        'material', v_eixo.material, 'cor_id', v_eixo.cor_id,
        'cor_poliester', v_eixo.cor_poliester,
        'kg_proposto', v_proposto, 'kg_disponivel', v_teto);
    END IF;
  END LOOP;

  -- 10. APPLY. Every refusal path is already behind us.
  UPDATE public.op_itens oi
     SET metros_ajustados = j.metros
    FROM (
      SELECT (e.item ->> 'op_item_id')::BIGINT AS op_item_id,
             NULLIF(e.item ->> 'metros_ajustados', '')::NUMERIC(10,2) AS metros
        FROM jsonb_array_elements(p_itens) AS e(item)
    ) AS j
   WHERE oi.id = j.op_item_id AND oi.op_id = p_op_id;
  GET DIAGNOSTICS v_aplicados = ROW_COUNT;

  UPDATE public.ops SET ajuste_revisao = ajuste_revisao + 1 WHERE id = p_op_id;
  v_rev := v_rev + 1;

  -- Adjustment history belongs to op_eventos (F7), never to
  -- ordem_compra_eventos.
  INSERT INTO public.op_eventos (op_id, tipo_evento, observacao, payload, criado_por)
  VALUES (p_op_id, 'ajuste_producao_salvo',
          'Ajuste de producao salvo (' || v_aplicados || ' itens).',
          jsonb_build_object('itens', p_itens, 'ajuste_revisao', v_rev,
                             'pedido_id', v_pedido_id),
          auth.uid());

  RETURN jsonb_build_object('ok', true, 'op_id', p_op_id,
                            'ajuste_revisao', v_rev, 'itens_aplicados', v_aplicados);
END;
$$;

COMMENT ON FUNCTION public.salvar_ajuste_producao_op(BIGINT, INTEGER, JSONB) IS
  'db/102 (9.9.C): atomic production adjustment. Locks in the global order, reloads, then checks the revision; validates the COMPLETE absolute payload against origin-aware ceilings before any write. Writes op_itens, ops.ajuste_revisao and op_eventos only — never saldo_fios, saldo_fios_op or ordem_compra_eventos.';

-- ---------------------------------------------------------------------
-- 5. iniciar_producao_op — server-owned production start (9.9.D)
--
-- Production start ALONE writes the authoritative saldo_fios_op start
-- snapshot: it is the historical record of what was available when
-- production began, and it has exactly one writer, this function.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.iniciar_producao_op(
  p_op_id           BIGINT,
  p_base_ajuste_rev INTEGER
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_pedido_id UUID;
  v_status    TEXT;
  v_rev       INTEGER;
  v_pendentes INTEGER;
  v_eixo      RECORD;
  v_teto      NUMERIC(12,3);
  v_propria   NUMERIC(12,3);
  v_liquido   NUMERIC(12,3);
  v_outras_r  NUMERIC(12,3);
  v_outras_c  NUMERIC(12,3);
  v_transicao JSONB;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'sem_permissao' USING ERRCODE = '42501';
  END IF;

  SELECT lt.pedido_id INTO v_pedido_id
    FROM public.ops o
    JOIN public.lotes lt ON lt.id = o.lote_id
   WHERE o.id = p_op_id;
  IF v_pedido_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'INICIO_OP_SEM_PEDIDO');
  END IF;

  BEGIN
    SET LOCAL lock_timeout = '5s';
    PERFORM 1 FROM public.pedidos WHERE id = v_pedido_id FOR UPDATE;
    PERFORM 1 FROM public.ops o
      JOIN public.lotes lt ON lt.id = o.lote_id
     WHERE lt.pedido_id = v_pedido_id
     ORDER BY o.id
       FOR UPDATE OF o;
    PERFORM 1 FROM public.op_itens oi
     WHERE oi.op_id = p_op_id
     ORDER BY oi.id
       FOR UPDATE;
  EXCEPTION WHEN lock_not_available THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'concorrencia_ocupada');
  END;

  SELECT o.status, o.ajuste_revisao INTO v_status, v_rev
    FROM public.ops o WHERE o.id = p_op_id;

  IF EXISTS (SELECT 1 FROM public.pedidos WHERE id = v_pedido_id AND status = 'cancelado') THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'PEDIDO_CANCELADO');
  END IF;

  -- The transition matrix owns the entry state: production starts from an
  -- OPEN OP. Opening a simulated OP stays an explicit operator action
  -- through the existing alterar_status_op; this release does not widen it.
  IF v_status <> 'aberta' THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'INICIO_OP_ESTADO_INVALIDO',
                              'status', v_status);
  END IF;

  IF p_base_ajuste_rev IS DISTINCT FROM v_rev THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'AJUSTE_REVISAO_DESATUALIZADA',
                              'ajuste_revisao_atual', v_rev);
  END IF;

  -- Every item must carry a saved adjustment.
  SELECT count(*) INTO v_pendentes
    FROM public.op_itens WHERE op_id = p_op_id AND metros_ajustados IS NULL;
  IF v_pendentes > 0 THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'INICIO_AJUSTE_INCOMPLETO',
                              'itens_sem_ajuste', v_pendentes);
  END IF;

  -- REVALIDATE AVAILABILITY: a receipt reversal may have lowered a
  -- ceiling since the adjustment was saved (9.9.D).
  FOR v_eixo IN
    SELECT DISTINCT d.origem_tipo, d.material, d.cor_id, d.cor_poliester
      FROM public._oc_disponibilidade_linhas(p_op_id) d
  LOOP
    v_liquido := public._oc_material_recebido_liquido(
      v_pedido_id, p_op_id, v_eixo.origem_tipo, v_eixo.material,
      v_eixo.cor_id, v_eixo.cor_poliester);
    SELECT r.kg_reservado, r.kg_comprometido INTO v_outras_r, v_outras_c
      FROM public._oc_reserva_ativa(v_pedido_id, v_eixo.material, v_eixo.cor_id,
                                    v_eixo.cor_poliester, p_op_id, NULL) r;
    v_teto := GREATEST(0, v_liquido
                - CASE WHEN v_eixo.origem_tipo = 'op' THEN 0
                       ELSE v_outras_r + v_outras_c END)::NUMERIC(12,3);

    SELECT r.kg_reservado + r.kg_comprometido INTO v_propria
      FROM public._oc_reserva_ativa(v_pedido_id, v_eixo.material, v_eixo.cor_id,
                                    v_eixo.cor_poliester, NULL, p_op_id) r;

    IF v_propria > v_teto THEN
      RETURN jsonb_build_object(
        'ok', false, 'codigo', 'AJUSTE_EXCEDE_DISPONIVEL',
        'material', v_eixo.material, 'cor_id', v_eixo.cor_id,
        'cor_poliester', v_eixo.cor_poliester,
        'kg_reservado', v_propria, 'kg_disponivel', v_teto);
    END IF;
  END LOOP;

  -- THE AUTHORITATIVE START SNAPSHOT. One writer only, this function.
  DELETE FROM public.saldo_fios_op WHERE op_id = p_op_id;
  FOR v_eixo IN
    SELECT DISTINCT d.origem_tipo, d.material, d.cor_id, d.cor_poliester
      FROM public._oc_disponibilidade_linhas(p_op_id) d
  LOOP
    v_liquido := public._oc_material_recebido_liquido(
      v_pedido_id, p_op_id, v_eixo.origem_tipo, v_eixo.material,
      v_eixo.cor_id, v_eixo.cor_poliester);
    SELECT r.kg_reservado, r.kg_comprometido INTO v_outras_r, v_outras_c
      FROM public._oc_reserva_ativa(v_pedido_id, v_eixo.material, v_eixo.cor_id,
                                    v_eixo.cor_poliester, p_op_id, NULL) r;
    v_teto := GREATEST(0, v_liquido
                - CASE WHEN v_eixo.origem_tipo = 'op' THEN 0
                       ELSE v_outras_r + v_outras_c END)::NUMERIC(12,3);
    SELECT r.kg_reservado + r.kg_comprometido INTO v_propria
      FROM public._oc_reserva_ativa(v_pedido_id, v_eixo.material, v_eixo.cor_id,
                                    v_eixo.cor_poliester, NULL, p_op_id) r;

    INSERT INTO public.saldo_fios_op (op_id, cor_id, cor_poliester, tipo, kg_sobra)
    VALUES (p_op_id, v_eixo.cor_id, v_eixo.cor_poliester, v_eixo.material,
            GREATEST(0, v_teto - v_propria)::NUMERIC(10,3));
  END LOOP;

  -- TRANSITION THE OP AND RECOMPUTE THE PEDIDO, ATOMICALLY.
  v_transicao := public._op_status_aplicar(p_op_id, 'em_producao',
                                           'Producao iniciada pelo writer canonico.');
  IF NOT COALESCE((v_transicao ->> 'ok')::BOOLEAN, FALSE) THEN
    RETURN jsonb_build_object('ok', false, 'codigo',
                              COALESCE(v_transicao ->> 'codigo', 'OP_TRANSICAO_INVALIDA'));
  END IF;

  UPDATE public.ops SET ajuste_revisao = ajuste_revisao + 1 WHERE id = p_op_id;
  v_rev := v_rev + 1;

  INSERT INTO public.op_eventos (op_id, tipo_evento, observacao, payload, criado_por)
  VALUES (p_op_id, 'producao_iniciada',
          'Producao iniciada; snapshot de saldo registrado.',
          jsonb_build_object('ajuste_revisao', v_rev, 'pedido_id', v_pedido_id),
          auth.uid());

  -- Derived Pedido transition. _pedido_status_recalcular is the OWNER-ONLY
  -- authority declared by db/105 (9.9.L); PL/pgSQL resolves it at call
  -- time and db/105 lands later in the same P1 sequence.
  PERFORM public._pedido_status_recalcular(v_pedido_id, 'inicio_producao_op');

  RETURN jsonb_build_object(
    'ok', true, 'op_id', p_op_id, 'ajuste_revisao', v_rev,
    'proxima_acao', jsonb_build_object(
      'rota', '#/ops/' || p_op_id,
      'rotulo', 'Acompanhar producao'));
END;
$$;

COMMENT ON FUNCTION public.iniciar_producao_op(BIGINT, INTEGER) IS
  'db/102 (9.9.D): server-owned production start. Locks in the global order, proves every item carries an adjustment, REVALIDATES availability, writes the authoritative saldo_fios_op start snapshot (sole writer), transitions the OP through _op_status_aplicar and recomputes the Pedido through _pedido_status_recalcular — all in one transaction.';

-- ---------------------------------------------------------------------
-- 6. Explicit ownership and privileges
-- ---------------------------------------------------------------------
ALTER FUNCTION public._op_status_aplicar(BIGINT, TEXT, TEXT)                    OWNER TO postgres;
ALTER FUNCTION public._op_reserva_proposta(BIGINT, JSONB, TEXT, BIGINT, TEXT)   OWNER TO postgres;
ALTER FUNCTION public.salvar_ajuste_producao_op(BIGINT, INTEGER, JSONB)         OWNER TO postgres;
ALTER FUNCTION public.iniciar_producao_op(BIGINT, INTEGER)                      OWNER TO postgres;

REVOKE ALL ON FUNCTION public._op_status_aplicar(BIGINT, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public._op_reserva_proposta(BIGINT, JSONB, TEXT, BIGINT, TEXT)
  FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.salvar_ajuste_producao_op(BIGINT, INTEGER, JSONB)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.salvar_ajuste_producao_op(BIGINT, INTEGER, JSONB) TO authenticated;

REVOKE ALL ON FUNCTION public.iniciar_producao_op(BIGINT, INTEGER)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.iniciar_producao_op(BIGINT, INTEGER) TO authenticated;

-- ---------------------------------------------------------------------
-- 7. Migration-time invariants
-- ---------------------------------------------------------------------
DO $db102$
BEGIN
  -- 7.1 The new column exists with the declared safe default and no drift.
  PERFORM 1 FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'ops'
     AND column_name = 'ajuste_revisao' AND is_nullable = 'NO'
     AND column_default = '0';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'db/102: ops.ajuste_revisao is missing its NOT NULL DEFAULT 0 contract';
  END IF;
  IF EXISTS (SELECT 1 FROM public.ops WHERE ajuste_revisao IS DISTINCT FROM 0) THEN
    RAISE EXCEPTION 'db/102: pre-existing OPs must start at ajuste_revisao = 0';
  END IF;

  -- 7.2 Owner-only helpers unreachable by every client role.
  IF has_function_privilege('anon',          'public._op_status_aplicar(bigint,text,text)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public._op_status_aplicar(bigint,text,text)', 'EXECUTE')
     OR has_function_privilege('service_role',  'public._op_status_aplicar(bigint,text,text)', 'EXECUTE')
     OR has_function_privilege('anon',          'public._op_reserva_proposta(bigint,jsonb,text,bigint,text)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public._op_reserva_proposta(bigint,jsonb,text,bigint,text)', 'EXECUTE')
     OR has_function_privilege('service_role',  'public._op_reserva_proposta(bigint,jsonb,text,bigint,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'db/102: an owner-only helper is reachable by a client role';
  END IF;

  -- 7.3 Public writers executable by authenticated only.
  IF NOT has_function_privilege('authenticated', 'public.salvar_ajuste_producao_op(bigint,integer,jsonb)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.iniciar_producao_op(bigint,integer)', 'EXECUTE') THEN
    RAISE EXCEPTION 'db/102: the public writers must be executable by authenticated';
  END IF;
  IF has_function_privilege('anon',         'public.salvar_ajuste_producao_op(bigint,integer,jsonb)', 'EXECUTE')
     OR has_function_privilege('service_role', 'public.salvar_ajuste_producao_op(bigint,integer,jsonb)', 'EXECUTE')
     OR has_function_privilege('anon',         'public.iniciar_producao_op(bigint,integer)', 'EXECUTE')
     OR has_function_privilege('service_role', 'public.iniciar_producao_op(bigint,integer)', 'EXECUTE') THEN
    RAISE EXCEPTION 'db/102: the public writers must not be reachable by anon or service_role';
  END IF;

  -- 7.4 NO writer is added for ops.finalizada (9.9.L).
  IF EXISTS (
    SELECT 1 FROM pg_proc p
     WHERE p.pronamespace = 'public'::regnamespace
       AND p.proname IN ('_op_status_aplicar', 'salvar_ajuste_producao_op', 'iniciar_producao_op')
       AND p.prosrc ~ '''finalizada'''
  ) THEN
    RAISE EXCEPTION 'db/102: no writer may target ops.finalizada';
  END IF;

  -- 7.5 The cutover remains untouched.
  PERFORM 1 FROM public.ordem_compra_cutover
   WHERE id = 1 AND status = 'legacy_active' AND read_authority = 'flat';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'db/102: ordem_compra_cutover is not legacy_active/flat';
  END IF;
END
$db102$;

COMMIT;
