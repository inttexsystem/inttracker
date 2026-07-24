-- =====================================================================
-- db/87_manta_expedition_reversal_and_route_completion.sql
-- PHASE-MANTA-B2A — balance-preserving Manta expedition reversal and
-- route-symmetric Pedido completion.
--
-- Governing contract: docs/architecture/MANTA_DIRECT_ROUTE_ACTIVATION_CONTRACT.md
-- §5 (B2-3, design A), §6 (B2-4 completion correction), §8 (B2-6) and §9 (B2-7);
-- schema shapes docs/architecture/PEDIDO_OP_SCHEMA_CONTRACT.md (2026-07-24, db/87
-- table). Forward-only; db/01..db/86 are untouched. The migration terminal guard
-- advances 86 -> 87 in the same commit (tests/ordem-compra-c3d-deploy.smoke.js).
--
-- WHY DESIGN A NEEDS NO GUARD RELAXATION. Every db/81 consumption guard is
-- conditioned on a Manta-sourced expedition with metros_liberados > 0 referencing
-- the op_item. They are INERT AT ZERO CONSUMPTION BY THEIR OWN EXISTING
-- CONDITION. So once a release is fully reversed (the expedicao_itens row reaches
-- zero and is deleted, because the pre-existing CHECK (metros_liberados > 0)
-- forbids a zero row), the pre-existing delivery-correction path and
-- alterar_status_op reopening become legal again with NO guard relaxation, NO
-- schema change to db/81-84, and NO `app.retificacao_autorizada` granted to any
-- authenticated writer. The controlled technical escape stays exactly where
-- PHASE-MANTA-B1 left it.
--
-- ---------------------------------------------------------------------
-- LOCK ORDER (continues db/85 and db/86; nothing is taken in reverse).
-- ---------------------------------------------------------------------
-- Reversal (estornar_expedicao_manta_parcial):
--   0. pg_advisory_xact_lock('manta_reversal_v1|<actor>|<key>') -- FIRST, before
--      any table row lock, only when a key is supplied (same discipline as
--      db/86, so a duplicate submission blocks BEFORE performing any work);
--   1. source public.ops row                     FOR UPDATE;
--   2. public.expedicoes row                     FOR UPDATE;
--   3. affected public.expedicao_itens rows, ascending id, FOR UPDATE.
-- This is the db/81 §4 order 2 -> 5 -> 6 restricted to the expedition side, so
-- release and reversal strictly serialize on the source `ops` row, and reversal
-- vs. the client-delivery writer (registrar_entrega_expedicao, which locks the
-- same expedicao_itens rows) serialize on those rows -- with the pre-existing
-- CHECK (metros_entregues <= metros_liberados) as the storage backstop.
--
-- Pedido completion (concluir_pedido_se_pronto):
--   1. public.pedidos row FOR UPDATE -- and NOTHING else. Every chain read is
--      unlocked, so completion holds exactly one resource and requests no
--      second one; no cycle can form with any OP/expedition writer (those
--      acquire `pedidos` only FOR SHARE at db/84 step 3, after `ops`, and this
--      function never requests an `ops` row).
--
-- ---------------------------------------------------------------------
-- Forward-only. Idempotent: CREATE OR REPLACE FUNCTION + REVOKE/GRANT only. No
-- table, constraint, trigger, index, RLS policy or data change at all. No db/81-86
-- guard is relaxed; no `app.retificacao_autorizada` is granted to any writer; no
-- existing RPC other than the contractually mandated concluir_pedido_se_pronto
-- correction is modified, and that correction preserves its signature,
-- authorization, grants and every Tapete pendency message verbatim.
--
-- Depende de db/21, db/23, db/81, db/84, db/85, db/86. Aplicar SOMENTE em
-- ambiente local/descartavel. NAO aplicar em shared development, staging ou
-- producao sem ordem explicita.
-- =====================================================================

BEGIN;

-- ============================================================
-- 1. Reversal RPC — balance-preserving, atomic, mandatory reason.
-- ============================================================
CREATE OR REPLACE FUNCTION public.estornar_expedicao_manta_parcial(
  p_expedicao_id    BIGINT,
  p_itens           JSONB,
  p_motivo          TEXT,
  p_idempotency_key TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ator             UUID;
  v_key              TEXT;
  v_motivo           TEXT;
  v_payload          JSONB;
  v_hash             TEXT;
  v_cmd              RECORD;
  v_exp              RECORD;
  v_op_id            BIGINT;
  v_lock_id          BIGINT;
  v_req              RECORD;
  v_item             RECORD;
  v_rows             INTEGER := 0;
  v_itens_plan       JSONB := '[]'::jsonb;
  v_itens_written    JSONB := '[]'::jsonb;
  v_plan_item        JSONB;
  v_estornado_total  NUMERIC(10,2) := 0;
  v_depois           NUMERIC(10,2);
  v_removido         BOOLEAN;
  v_status           TEXT;
  v_resultado        JSONB;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'sem_permissao', 'erro', 'Sem permissao');
  END IF;

  IF p_itens IS NULL OR jsonb_typeof(p_itens) <> 'array' OR jsonb_array_length(p_itens) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'payload_vazio', 'erro', 'Informe ao menos um item para estornar');
  END IF;

  -- Mandatory reason (db/70 estornar_recebimento_ordem_compra precedent).
  v_motivo := NULLIF(btrim(COALESCE(p_motivo, '')), '');
  IF v_motivo IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'motivo_obrigatorio',
      'erro', 'Informe o motivo do estorno');
  END IF;

  v_ator := auth.uid();
  v_key  := NULLIF(btrim(COALESCE(p_idempotency_key, '')), '');

  IF v_key IS NOT NULL THEN
    IF v_ator IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'codigo', 'ator_indeterminado',
        'erro', 'Chave de idempotencia exige um ator autenticado');
    END IF;
    IF length(v_key) > 200 THEN
      RETURN jsonb_build_object('ok', false, 'codigo', 'idempotency_key_invalida',
        'erro', 'Chave de idempotencia deve ter entre 1 e 200 caracteres');
    END IF;

    SELECT jsonb_build_object(
             'namespace', 'manta_reversal_v1',
             'expedicao_id', p_expedicao_id,
             'motivo', v_motivo,
             'itens', COALESCE(jsonb_agg(jsonb_build_object(
                        'op_item_id', op_item_id,
                        'metros', ROUND(metros, 2)::TEXT
                      ) ORDER BY op_item_id), '[]'::jsonb))
      INTO v_payload
      FROM (
        SELECT x.op_item_id, SUM(x.metros) AS metros
          FROM jsonb_to_recordset(p_itens) AS x(op_item_id BIGINT, metros NUMERIC)
         GROUP BY x.op_item_id
      ) n;
    v_hash := md5(v_payload::TEXT);

    -- Lock order step 0: before ANY table row lock.
    PERFORM pg_advisory_xact_lock(hashtextextended(
      'manta_reversal_v1|' || v_ator::TEXT || '|' || v_key, 0));

    SELECT * INTO v_cmd
      FROM public.expedicao_comandos c
     WHERE c.idempotency_namespace = 'manta_reversal_v1'
       AND c.ator_id = v_ator
       AND c.idempotency_key = v_key;

    IF FOUND THEN
      IF v_cmd.comando_payload = v_payload AND v_cmd.comando_hash = v_hash THEN
        RETURN v_cmd.resultado;                  -- byte-for-byte, zero mutation
      END IF;
      RETURN jsonb_build_object('ok', false, 'codigo', 'idempotencia_conflitante',
        'erro', 'Chave reutilizada com comando diferente');
    END IF;
  END IF;

  -- The expedition must exist and be Manta-sourced. Read the source unlocked
  -- first, only to know WHICH ops row to lock first (db/81 idiom).
  SELECT ex.id, ex.op_tecelagem_id, ex.op_latex_id, ex.pedido_id, ex.lote_id, ex.cliente_id
    INTO v_exp
    FROM public.expedicoes ex WHERE ex.id = p_expedicao_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'expedicao_inexistente', 'erro', 'Expedicao nao encontrada');
  END IF;
  IF v_exp.op_tecelagem_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'expedicao_nao_manta',
      'erro', 'Somente uma expedicao de origem Manta (op_tecelagem_id) pode ser estornada por esta rota');
  END IF;
  v_op_id := v_exp.op_tecelagem_id;

  -- Lock order step 1: source OP FOR UPDATE (serializes with release).
  PERFORM 1 FROM public.ops WHERE id = v_op_id FOR UPDATE;

  -- Lock order step 2: the expedition; re-read the source under lock.
  SELECT ex.id, ex.op_tecelagem_id, ex.op_latex_id, ex.pedido_id, ex.lote_id, ex.cliente_id
    INTO v_exp
    FROM public.expedicoes ex WHERE ex.id = p_expedicao_id FOR UPDATE;
  IF NOT FOUND OR v_exp.op_tecelagem_id IS DISTINCT FROM v_op_id THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'expedicao_nao_manta',
      'erro', 'A fonte da expedicao mudou; estorno rejeitado');
  END IF;

  -- Lock order step 3: the expedition's items, ascending id.
  FOR v_lock_id IN
    SELECT xi.id FROM public.expedicao_itens xi WHERE xi.expedicao_id = p_expedicao_id ORDER BY xi.id
  LOOP
    PERFORM 1 FROM public.expedicao_itens WHERE id = v_lock_id FOR UPDATE;
  END LOOP;

  -- Plan every requested reversal against post-lock committed balances.
  FOR v_req IN
    SELECT x.op_item_id::BIGINT AS op_item_id, ROUND(SUM(x.metros)::NUMERIC, 2) AS metros
      FROM jsonb_to_recordset(p_itens) AS x(op_item_id BIGINT, metros NUMERIC)
     GROUP BY x.op_item_id
     ORDER BY x.op_item_id
  LOOP
    v_rows := v_rows + 1;

    IF v_req.op_item_id IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'codigo', 'item_invalido', 'erro', 'Item sem op_item_id');
    END IF;
    IF v_req.metros IS NULL OR v_req.metros <= 0 THEN
      RETURN jsonb_build_object('ok', false, 'codigo', 'metros_invalidos',
        'erro', 'Quantidade a estornar deve ser maior que zero', 'op_item_id', v_req.op_item_id);
    END IF;

    SELECT xi.id, xi.op_item_id, xi.modelo_id, xi.pedido_item_id,
           xi.metros_liberados, xi.metros_entregues
      INTO v_item
      FROM public.expedicao_itens xi
     WHERE xi.expedicao_id = p_expedicao_id AND xi.op_item_id = v_req.op_item_id;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('ok', false, 'codigo', 'item_fora_da_expedicao',
        'erro', 'Item nao pertence a expedicao informada', 'op_item_id', v_req.op_item_id);
    END IF;

    -- Cannot produce a negative balance.
    IF v_req.metros > v_item.metros_liberados THEN
      RETURN jsonb_build_object('ok', false, 'codigo', 'excede_liberado',
        'erro', 'Estorno excede a quantidade liberada',
        'op_item_id', v_req.op_item_id,
        'liberado', v_item.metros_liberados,
        'solicitado', v_req.metros);
    END IF;

    -- Cannot reverse below what has already been delivered to the client. The
    -- pre-existing CHECK (metros_entregues <= metros_liberados) is the storage
    -- backstop, so the rule also fails closed against a direct writer.
    IF v_item.metros_liberados - v_req.metros < v_item.metros_entregues THEN
      RETURN jsonb_build_object('ok', false, 'codigo', 'abaixo_do_entregue',
        'erro', 'Estorno reduziria o liberado abaixo do ja entregue ao cliente',
        'op_item_id', v_req.op_item_id,
        'liberado', v_item.metros_liberados,
        'entregue', v_item.metros_entregues,
        'solicitado', v_req.metros,
        'estornavel', ROUND((v_item.metros_liberados - v_item.metros_entregues)::NUMERIC, 2));
    END IF;

    v_estornado_total := ROUND((v_estornado_total + v_req.metros)::NUMERIC, 2);

    v_itens_plan := v_itens_plan || jsonb_build_array(jsonb_build_object(
      'expedicao_item_id', v_item.id,
      'op_item_id',        v_item.op_item_id,
      'modelo_id',         v_item.modelo_id,
      'pedido_item_id',    v_item.pedido_item_id,
      'liberado_antes',    v_item.metros_liberados,
      'entregue',          v_item.metros_entregues,
      'estornar',          v_req.metros,
      'liberado_depois',   ROUND((v_item.metros_liberados - v_req.metros)::NUMERIC, 2)));
  END LOOP;

  IF v_rows = 0 OR v_estornado_total <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'payload_vazio', 'erro', 'Informe quantidade maior que zero');
  END IF;

  -- Apply. An item reaching exactly zero is DELETED (the pre-existing
  -- CHECK (metros_liberados > 0) forbids a zero row); the expedition HEADER is
  -- always retained -- its identity, source and lineage are immutable and
  -- one-per-OP, so it must survive for future additive releases.
  -- expedicao_movimentos / expedicao_movimento_itens are NEVER touched: delivery
  -- history is append-only and is exactly what makes metros_entregues the floor.
  FOR v_plan_item IN SELECT value FROM jsonb_array_elements(v_itens_plan)
  LOOP
    v_depois := (v_plan_item->>'liberado_depois')::NUMERIC(10,2);
    IF v_depois = 0 THEN
      DELETE FROM public.expedicao_itens WHERE id = (v_plan_item->>'expedicao_item_id')::BIGINT;
      v_removido := TRUE;
    ELSE
      UPDATE public.expedicao_itens
         SET metros_liberados = v_depois,
             atualizado_em = now()
       WHERE id = (v_plan_item->>'expedicao_item_id')::BIGINT;
      v_removido := FALSE;
    END IF;

    v_itens_written := v_itens_written || jsonb_build_array(
      v_plan_item || jsonb_build_object('item_removido', v_removido));
  END LOOP;

  v_status := public.recalcular_status_expedicao(p_expedicao_id);

  v_resultado := jsonb_build_object(
    'ok',               true,
    'expedicao_id',     p_expedicao_id,
    'expedicao_status', v_status,
    'op_tecelagem_id',  v_op_id,
    'pedido_id',        v_exp.pedido_id,
    'lote_id',          v_exp.lote_id,
    'cliente_id',       v_exp.cliente_id,
    'estornado_total',  v_estornado_total,
    'motivo',           v_motivo,
    'idempotency_key',  v_key,
    'itens',            v_itens_written);

  INSERT INTO public.op_eventos (op_id, tipo_evento, observacao, payload, criado_por)
  VALUES (
    v_op_id,
    'expedicao_manta_estornada',
    v_motivo,
    jsonb_build_object(
      'expedicao_id',     p_expedicao_id,
      'expedicao_status', v_status,
      'itens',            v_itens_written,
      'estornado_total',  v_estornado_total,
      'motivo',           v_motivo,
      'idempotency_key',  v_key),
    v_ator);

  IF v_key IS NOT NULL THEN
    INSERT INTO public.expedicao_comandos
      (idempotency_namespace, ator_id, idempotency_key, comando_payload, comando_hash, resultado)
    VALUES ('manta_reversal_v1', v_ator, v_key, v_payload, v_hash, v_resultado);
  END IF;

  RETURN v_resultado;
EXCEPTION WHEN OTHERS THEN
  -- Only unexpected failures reach here: every expected validation branch above
  -- returns a stable identifier BEFORE any write. The subtransaction rollback
  -- makes quantity reduction, zero-row deletion, status recalculation, event and
  -- command row a single all-or-nothing unit -- no partial graph correction.
  RETURN jsonb_build_object('ok', false, 'codigo', 'erro_inesperado', 'erro', SQLERRM);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.estornar_expedicao_manta_parcial(BIGINT, JSONB, TEXT, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.estornar_expedicao_manta_parcial(BIGINT, JSONB, TEXT, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.estornar_expedicao_manta_parcial(BIGINT, JSONB, TEXT, TEXT) TO authenticated;

COMMENT ON FUNCTION public.estornar_expedicao_manta_parcial(BIGINT, JSONB, TEXT, TEXT) IS
  'db/87: estorno atomico e preservador de saldo de uma expedicao de origem Manta. Admin-only, SECURITY DEFINER, search_path=public, p_motivo obrigatorio (rejeita nulo/branco, persiste btrim). Ordem de travas: advisory de idempotencia (manta_reversal_v1, antes de qualquer trava de linha) -> ops fonte FOR UPDATE -> expedicoes FOR UPDATE -> expedicao_itens (id asc) FOR UPDATE. Rejeita estorno maior que o liberado e estorno que reduza o liberado abaixo do ja entregue (CHECK metros_entregues <= metros_liberados como backstop de armazenamento); apaga o item que chega exatamente a zero (CHECK metros_liberados > 0 proibe linha zerada) e SEMPRE preserva o cabecalho da expedicao; recalcula o status; nunca apaga expedicao_movimentos/expedicao_movimento_itens. Grava op_eventos expedicao_manta_estornada e, quando ha chave, a linha imutavel em expedicao_comandos. Nenhum guard db/81-86 e relaxado e nenhum app.retificacao_autorizada e concedido.';

-- ============================================================
-- 2. Forward correction of public.concluir_pedido_se_pronto(UUID).
--
--    PRE-EXISTING DEFECT (ACTIVATION_CONTRACT §12 R-2). The `v_latex_sem_exp`
--    check joins only o.tipo='latex' on e.op_latex_id, so a Manta-only Pedido
--    whose weaving OP is terminal and which has NO expedition at all satisfies
--    every pendency and would be marked `entregue`. Activating the Manta route
--    without this correction would ship a silent completion bug.
--
--    CORRECTED RULE (route-symmetric). The product route is derived ONLY from
--    modelos.tipo_produto through op_itens; ops.tipo identifies the production
--    STAGE and is never product identity:
--      * every terminal Tapete source OP requiring expedition must have an
--        expedition through op_latex_id  (existing check, preserved verbatim);
--      * every terminal Manta weaving source OP must have an expedition through
--        op_tecelagem_id                                              (NEW);
--      * a Manta weaving OP whose measured non-defect `cima` output exceeds what
--        has been released is a pendency                              (NEW);
--      * every expedition of the Pedido must be `concluida`  (existing check --
--        Manta expeditions carry the same pedido_id, so they are already
--        covered; proved explicitly by the B2A tests).
--
--    PRESERVED VERBATIM: signature, SECURITY DEFINER, search_path, is_admin()
--    gate, grants, the `cancelado` short-circuit, the four existing pendency
--    counters and their exact Portuguese messages, the pendency return shape,
--    the `entregue` UPDATE and the pedido_eventos row. Tapete-only behavior is
--    therefore bit-identical.
--
--    LOCKING: the Pedido row is taken FOR UPDATE and NOTHING else is locked; all
--    chain reads stay unlocked, so completion holds exactly one resource and
--    requests no second one and cannot create a reverse path into any OP or
--    expedition writer.
-- ============================================================
CREATE OR REPLACE FUNCTION public.concluir_pedido_se_pronto(p_pedido_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pedido             RECORD;
  v_pendencias         TEXT[] := ARRAY[]::TEXT[];
  v_total_ops          INTEGER;
  v_ops_abertas        INTEGER;
  v_latex_pendente     INTEGER;
  v_exp_pendente       INTEGER;
  v_latex_sem_exp      INTEGER;
  v_manta_sem_exp      INTEGER;
  v_manta_nao_liberado INTEGER;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Sem permissao');
  END IF;

  -- Lock order step 1: the Pedido row, and nothing else, for the mutation.
  SELECT * INTO v_pedido
  FROM public.pedidos
  WHERE id = p_pedido_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Pedido nao encontrado');
  END IF;

  IF v_pedido.status = 'cancelado' THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Pedido cancelado nao pode ser concluido');
  END IF;

  SELECT COUNT(*) INTO v_total_ops
  FROM public.ops o
  JOIN public.lotes l ON l.id = o.lote_id
  WHERE l.pedido_id = p_pedido_id;

  IF v_total_ops = 0 THEN
    v_pendencias := array_append(v_pendencias, 'Pedido sem OP vinculada');
  END IF;

  SELECT COUNT(*) INTO v_ops_abertas
  FROM public.ops o
  JOIN public.lotes l ON l.id = o.lote_id
  WHERE l.pedido_id = p_pedido_id
    AND o.status NOT IN ('concluida','finalizada','cancelada');

  IF v_ops_abertas > 0 THEN
    v_pendencias := array_append(v_pendencias, 'Ha OP vinculada aberta ou em producao');
  END IF;

  SELECT COUNT(*) INTO v_latex_pendente
  FROM public.ops o
  JOIN public.lotes l ON l.id = o.lote_id
  WHERE l.pedido_id = p_pedido_id
    AND o.tipo = 'latex'
    AND o.status NOT IN ('concluida','finalizada','cancelada');

  IF v_latex_pendente > 0 THEN
    v_pendencias := array_append(v_pendencias, 'Ha OP de acabamento pendente');
  END IF;

  -- TAPETE route (unchanged): a terminal finishing OP must have an expedition
  -- through its own source column.
  SELECT COUNT(*) INTO v_latex_sem_exp
  FROM public.ops o
  JOIN public.lotes l ON l.id = o.lote_id
  LEFT JOIN public.expedicoes e ON e.op_latex_id = o.id
  WHERE l.pedido_id = p_pedido_id
    AND o.tipo = 'latex'
    AND o.status IN ('concluida','finalizada')
    AND e.id IS NULL;

  IF v_latex_sem_exp > 0 THEN
    v_pendencias := array_append(v_pendencias, 'Ha acabamento finalizado sem expedicao');
  END IF;

  -- MANTA route (new, symmetric): a terminal Manta WEAVING OP is itself the
  -- expedition source, so it must have an expedition through op_tecelagem_id.
  -- The route is derived strictly from modelos.tipo_produto (non-empty and
  -- homogeneously Manta), never from ops.tipo, which only says the OP is a
  -- weaving stage -- a Tapete weaving OP feeds a finishing OP and is correctly
  -- NOT required to have an expedition of its own.
  SELECT COUNT(*) INTO v_manta_sem_exp
  FROM public.ops o
  JOIN public.lotes l ON l.id = o.lote_id
  LEFT JOIN public.expedicoes e ON e.op_tecelagem_id = o.id
  WHERE l.pedido_id = p_pedido_id
    AND o.tipo = 'tecelagem'
    AND o.status IN ('concluida','finalizada')
    AND EXISTS (
      SELECT 1 FROM public.op_itens oi
      JOIN public.modelos m ON m.id = oi.modelo_id
      WHERE oi.op_id = o.id AND m.tipo_produto = 'manta')
    AND NOT EXISTS (
      SELECT 1 FROM public.op_itens oi
      JOIN public.modelos m ON m.id = oi.modelo_id
      WHERE oi.op_id = o.id AND m.tipo_produto IS DISTINCT FROM 'manta')
    AND e.id IS NULL;

  IF v_manta_sem_exp > 0 THEN
    v_pendencias := array_append(v_pendencias, 'Ha tecelagem Manta finalizada sem expedicao');
  END IF;

  -- MANTA route (new): measured non-defect output that has not been released is
  -- a pendency. Measured output is the sole Manta expedition authority; the OP
  -- plan is never used here.
  SELECT COUNT(*) INTO v_manta_nao_liberado
  FROM public.ops o
  JOIN public.lotes l ON l.id = o.lote_id
  WHERE l.pedido_id = p_pedido_id
    AND o.tipo = 'tecelagem'
    AND o.status IN ('concluida','finalizada')
    AND EXISTS (
      SELECT 1 FROM public.op_itens oi
      JOIN public.modelos m ON m.id = oi.modelo_id
      WHERE oi.op_id = o.id AND m.tipo_produto = 'manta')
    AND NOT EXISTS (
      SELECT 1 FROM public.op_itens oi
      JOIN public.modelos m ON m.id = oi.modelo_id
      WHERE oi.op_id = o.id AND m.tipo_produto IS DISTINCT FROM 'manta')
    AND COALESCE((
      SELECT SUM(ei.metros_entregues)
      FROM public.entrega_itens ei
      JOIN public.entregas en ON en.id = ei.entrega_id
      WHERE en.etapa = 'cima'
        AND ei.op_id = o.id
        AND COALESCE(ei.defeito, FALSE) = FALSE
    ), 0) > COALESCE((
      SELECT SUM(xi.metros_liberados)
      FROM public.expedicao_itens xi
      JOIN public.expedicoes ex ON ex.id = xi.expedicao_id
      WHERE ex.op_tecelagem_id = o.id
    ), 0);

  IF v_manta_nao_liberado > 0 THEN
    v_pendencias := array_append(v_pendencias, 'Ha saida de tecelagem Manta medida sem liberacao para expedicao');
  END IF;

  -- Every applicable expedition of the Pedido -- Latex-sourced or Manta-sourced,
  -- both carrying this pedido_id -- must be concluida.
  SELECT COUNT(*) INTO v_exp_pendente
  FROM public.expedicoes e
  WHERE e.pedido_id = p_pedido_id
    AND e.status <> 'concluida';

  IF v_exp_pendente > 0 THEN
    v_pendencias := array_append(v_pendencias, 'Ha expedicao com saldo pendente');
  END IF;

  IF array_length(v_pendencias, 1) IS NOT NULL THEN
    RETURN jsonb_build_object(
      'ok', false,
      'erro', 'Pedido ainda possui pendencias',
      'pendencias', to_jsonb(v_pendencias)
    );
  END IF;

  UPDATE public.pedidos
  SET status = 'entregue',
      status_cliente_visual = 'concluido',
      status_cliente_mensagem = COALESCE(status_cliente_mensagem, 'Pedido entregue/coletado e concluido.'),
      status_cliente_atualizado_em = now(),
      atualizado_em = now()
  WHERE id = p_pedido_id;

  INSERT INTO public.pedido_eventos (pedido_id, status_anterior, status_novo, criado_por, observacao)
  VALUES (p_pedido_id, v_pedido.status, 'entregue', auth.uid(), 'Pedido concluido apos expedicao finalizada');

  RETURN jsonb_build_object('ok', true, 'pedido_id', p_pedido_id, 'status', 'entregue');
END;
$$;

COMMENT ON FUNCTION public.concluir_pedido_se_pronto(UUID) IS
  'db/87 (correcao progressiva de db/23): conclui o pedido usando o status operacional existente entregue, somente quando a cadeia vinculada esta pronta em TODAS as rotas aplicaveis. Regra simetrica de rota derivada de modelos.tipo_produto (nunca de ops.tipo): toda OP de acabamento terminal exige expedicao por op_latex_id (comportamento e mensagens Tapete preservados textualmente) e toda OP de tecelagem Manta terminal exige expedicao por op_tecelagem_id; saida Manta medida sem defeito ainda nao liberada e pendencia; toda expedicao do pedido deve estar concluida. Assinatura, autorizacao, grants e retorno preservados; trava apenas a linha do pedido (FOR UPDATE) e nao cria caminho reverso para escritores de OP/expedicao.';

-- ============================================================
-- 3. Reload PostgREST
-- ============================================================
NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';

COMMIT;
