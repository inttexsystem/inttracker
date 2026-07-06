-- ============================================================
-- Fase: RAVATEX-TAPETES-PEDIDO-OP-CONTROLLED-DELETE-FK-ORDER-FIX-E
-- Correcao critica da ordem transacional da exclusao controlada.
--
-- Politica:
-- - Sem producao.
-- - Expedic permanece bloqueador nesta fase.
-- - Entrega/OP filha de teste sem expedicao pode ser removida em cascata.
-- - Cascata exige confirmacao textual EXCLUIR TUDO.
-- - op_numeros nao e escrita, nao e resetada e numeros nao sao reciclados.
-- - OPs restantes nao sao renumeradas.
-- ============================================================

-- Os guards de entrega foram criados como BEFORE DELETE e precisam retornar
-- OLD quando o DELETE e permitido. Retornar NEW em DELETE equivale a NULL e
-- cancela a remocao da linha, deixando FKs presas para o DELETE FROM ops.
CREATE OR REPLACE FUNCTION public.entrega_cima_latex_guard_fn()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.etapa = 'cima'
     AND EXISTS (
       SELECT 1
         FROM public.ops o
        WHERE o.tipo = 'latex'
          AND o.origem_entrega_id = OLD.id
     )
     AND current_setting('app.retificacao_autorizada', true) IS DISTINCT FROM 'on'
  THEN
    RAISE EXCEPTION 'Entrega de tecelagem vinculada a OP de acabamento nao pode ser alterada/excluida sem retificacao autorizada.';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.entrega_itens_cima_latex_guard_fn()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_entrega_id BIGINT;
BEGIN
  v_entrega_id := COALESCE(NEW.entrega_id, OLD.entrega_id);

  IF v_entrega_id IS NOT NULL
     AND EXISTS (
       SELECT 1
         FROM public.ops o
        WHERE o.tipo = 'latex'
          AND o.origem_entrega_id = v_entrega_id
     )
     AND current_setting('app.retificacao_autorizada', true) IS DISTINCT FROM 'on'
  THEN
    RAISE EXCEPTION 'Itens de entrega de tecelagem vinculada a OP de acabamento nao podem ser alterados sem retificacao autorizada.';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.diagnosticar_impacto_op(p_op_id BIGINT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_op public.ops%ROWTYPE;
  v_target_ops BIGINT[] := '{}'::BIGINT[];
  v_target_child_ops BIGINT[] := '{}'::BIGINT[];
  v_target_op_itens BIGINT[] := '{}'::BIGINT[];
  v_target_child_op_itens BIGINT[] := '{}'::BIGINT[];
  v_target_entregas BIGINT[] := '{}'::BIGINT[];
  v_target_op_latex_links BIGINT[] := '{}'::BIGINT[];
  v_expedicao_ids BIGINT[] := '{}'::BIGINT[];
  v_expedicao_item_ids BIGINT[] := '{}'::BIGINT[];
  v_impacto JSONB;
  v_blocked BOOLEAN := FALSE;
  v_requires BOOLEAN := FALSE;
  v_cascade BOOLEAN := FALSE;
  v_reason TEXT := NULL;
  v_cascade_reason TEXT := NULL;
  v_entrega_itens_por_op_id BIGINT := 0;
  v_entrega_itens_por_op_item_id BIGINT := 0;
  v_entregas BIGINT := 0;
  v_expedicoes BIGINT := 0;
  v_expedicao_itens BIGINT := 0;
  v_filhas BIGINT := 0;
  v_op_itens BIGINT := 0;
  v_child_op_itens BIGINT := 0;
  v_op_eventos BIGINT := 0;
  v_op_fornecedores BIGINT := 0;
  v_ordens BIGINT := 0;
  v_saldo BIGINT := 0;
  v_op_latex_entregas BIGINT := 0;
BEGIN
  SELECT * INTO v_op FROM public.ops WHERE id = p_op_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'ok', FALSE,
      'blocked', TRUE,
      'reason', 'OP nao encontrada.',
      'impacto', jsonb_build_object('classification', 'blocked', 'blocked', TRUE),
      'deleted', jsonb_build_object(),
      'entity', 'op',
      'id', p_op_id
    );
  END IF;

  WITH RECURSIVE op_tree(id, depth) AS (
    SELECT id, 0 FROM public.ops WHERE id = p_op_id
    UNION ALL
    SELECT filha.id, pai.depth + 1
      FROM public.ops filha
      JOIN op_tree pai ON pai.id = filha.origem_op_id
  )
  SELECT
    COALESCE(array_agg(id ORDER BY depth DESC, id), '{}'::BIGINT[]),
    COALESCE(array_agg(id ORDER BY depth DESC, id) FILTER (WHERE depth > 0), '{}'::BIGINT[])
    INTO v_target_ops, v_target_child_ops
    FROM op_tree;

  SELECT COALESCE(array_agg(oi.id ORDER BY oi.id), '{}'::BIGINT[])
    INTO v_target_op_itens
    FROM public.op_itens oi
   WHERE oi.op_id = ANY(v_target_ops);

  SELECT COALESCE(array_agg(oi.id ORDER BY oi.id), '{}'::BIGINT[])
    INTO v_target_child_op_itens
    FROM public.op_itens oi
   WHERE oi.op_id = ANY(v_target_child_ops);

  SELECT COALESCE(array_agg(DISTINCT entrega_id), '{}'::BIGINT[])
    INTO v_target_entregas
    FROM (
      SELECT ei.entrega_id
        FROM public.entrega_itens ei
       WHERE ei.op_id = ANY(v_target_ops)
          OR ei.op_item_id = ANY(v_target_op_itens)
      UNION
      SELECT ole.entrega_id
        FROM public.op_latex_entregas ole
       WHERE ole.op_latex_id = ANY(v_target_ops)
      UNION
      SELECT o.origem_entrega_id
        FROM public.ops o
       WHERE o.id = ANY(v_target_ops)
         AND o.origem_entrega_id IS NOT NULL
    ) s
   WHERE entrega_id IS NOT NULL;

  SELECT COALESCE(array_agg(ole.id ORDER BY ole.id), '{}'::BIGINT[])
    INTO v_target_op_latex_links
    FROM public.op_latex_entregas ole
   WHERE ole.op_latex_id = ANY(v_target_ops)
      OR ole.entrega_id = ANY(v_target_entregas);

  SELECT COALESCE(array_agg(DISTINCT e.id ORDER BY e.id), '{}'::BIGINT[])
    INTO v_expedicao_ids
    FROM (
      SELECT e.id
        FROM public.expedicoes e
       WHERE e.op_latex_id = ANY(v_target_ops)
      UNION
      SELECT ei.expedicao_id
        FROM public.expedicao_itens ei
       WHERE ei.op_item_id = ANY(v_target_op_itens)
    ) e
   WHERE e.id IS NOT NULL;

  SELECT COALESCE(array_agg(ei.id ORDER BY ei.id), '{}'::BIGINT[])
    INTO v_expedicao_item_ids
    FROM public.expedicao_itens ei
   WHERE ei.expedicao_id = ANY(v_expedicao_ids)
      OR ei.op_item_id = ANY(v_target_op_itens);

  v_entregas := COALESCE(array_length(v_target_entregas, 1), 0);
  v_expedicoes := COALESCE(array_length(v_expedicao_ids, 1), 0);
  v_expedicao_itens := COALESCE(array_length(v_expedicao_item_ids, 1), 0);
  v_filhas := COALESCE(array_length(v_target_child_ops, 1), 0);
  v_op_itens := COALESCE(array_length(v_target_op_itens, 1), 0);
  v_child_op_itens := COALESCE(array_length(v_target_child_op_itens, 1), 0);
  v_op_latex_entregas := COALESCE(array_length(v_target_op_latex_links, 1), 0);

  SELECT COUNT(*) INTO v_entrega_itens_por_op_id
    FROM public.entrega_itens ei
   WHERE ei.op_id = ANY(v_target_ops);

  SELECT COUNT(*) INTO v_entrega_itens_por_op_item_id
    FROM public.entrega_itens ei
   WHERE ei.op_item_id = ANY(v_target_op_itens);

  SELECT COUNT(*) INTO v_op_eventos FROM public.op_eventos WHERE op_id = ANY(v_target_ops);
  SELECT COUNT(*) INTO v_op_fornecedores FROM public.op_fornecedores WHERE op_id = ANY(v_target_ops);
  SELECT COUNT(*) INTO v_ordens FROM public.ordens_compra_fio WHERE op_id = ANY(v_target_ops);
  SELECT COUNT(*) INTO v_saldo FROM public.saldo_fios_op WHERE op_id = ANY(v_target_ops);

  IF v_expedicoes > 0 OR v_expedicao_itens > 0 THEN
    v_blocked := TRUE;
    v_reason := 'Nao e possivel excluir: existe expedicao vinculada. Exclua a expedicao antes.';
  ELSIF v_entregas > 0
     OR v_entrega_itens_por_op_id > 0
     OR v_entrega_itens_por_op_item_id > 0
     OR v_op_latex_entregas > 0
     OR v_filhas > 0 THEN
    v_cascade := TRUE;
    v_cascade_reason := 'Esta exclusao remove cadeia produtiva de teste: OPs, entregas, itens e vinculos. Digite EXCLUIR TUDO para confirmar.';
  ELSIF (v_op_itens + v_op_eventos + v_op_fornecedores + v_ordens + v_saldo) > 0 THEN
    v_requires := TRUE;
  END IF;

  v_impacto := jsonb_build_object(
    'classification', CASE
      WHEN v_blocked THEN 'blocked'
      WHEN v_cascade THEN 'requires_cascade_confirmation'
      WHEN v_requires THEN 'requires_confirmation'
      ELSE 'safe'
    END,
    'blocked', v_blocked,
    'requires_confirmation', v_requires OR v_cascade,
    'cascade_required', v_cascade,
    'cascade_reason', v_cascade_reason,
    'confirmation_required', CASE WHEN v_cascade THEN 'EXCLUIR TUDO' WHEN v_requires THEN 'EXCLUIR' ELSE NULL END,
    'policy', 'OP excluida em teste pode remover cadeia produtiva sem expedicao. op_numeros nao e alterado.',
    'op', jsonb_build_object(
      'id', v_op.id,
      'numero', v_op.numero,
      'ano', v_op.ano,
      'tipo', v_op.tipo,
      'status', v_op.status,
      'origem_op_id', v_op.origem_op_id
    ),
    'counts', jsonb_build_object(
      'op_itens', v_op_itens,
      'op_itens_filhas', v_child_op_itens,
      'op_eventos', v_op_eventos,
      'fornecedores', v_op_fornecedores,
      'op_fornecedores', v_op_fornecedores,
      'ordens_compra_fio', v_ordens,
      'saldo_fios_op', v_saldo,
      'entregas', v_entregas,
      'entrega_itens', v_entrega_itens_por_op_id + v_entrega_itens_por_op_item_id,
      'entrega_itens_por_op_id', v_entrega_itens_por_op_id,
      'entrega_itens_por_op_item_id', v_entrega_itens_por_op_item_id,
      'expedicoes', v_expedicoes,
      'expedicao_itens', v_expedicao_itens,
      'ops_filhas', v_filhas,
      'op_mae', CASE WHEN v_op.origem_op_id IS NULL THEN 0 ELSE 1 END,
      'op_latex_entregas', v_op_latex_entregas,
      'cascade_can_zero_entrega_itens_before_ops', (v_expedicoes = 0 AND v_expedicao_itens = 0)
    ),
    'ids', jsonb_build_object(
      'op_ids', to_jsonb(v_target_ops),
      'target_ops', to_jsonb(v_target_ops),
      'target_child_ops', to_jsonb(v_target_child_ops),
      'target_op_itens', to_jsonb(v_target_op_itens),
      'target_child_op_itens', to_jsonb(v_target_child_op_itens),
      'entrega_ids', to_jsonb(v_target_entregas),
      'target_entregas', to_jsonb(v_target_entregas),
      'target_op_latex_links', to_jsonb(v_target_op_latex_links),
      'expedicao_ids', to_jsonb(v_expedicao_ids),
      'expedicao_item_ids', to_jsonb(v_expedicao_item_ids)
    )
  );

  RETURN jsonb_build_object(
    'ok', TRUE,
    'blocked', v_blocked,
    'reason', v_reason,
    'impacto', v_impacto,
    'deleted', jsonb_build_object(),
    'entity', 'op',
    'id', p_op_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.diagnosticar_impacto_pedido(p_pedido_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lote_ids BIGINT[] := '{}'::BIGINT[];
  v_root_ops BIGINT[] := '{}'::BIGINT[];
  v_target_ops BIGINT[] := '{}'::BIGINT[];
  v_target_child_ops BIGINT[] := '{}'::BIGINT[];
  v_target_op_itens BIGINT[] := '{}'::BIGINT[];
  v_target_child_op_itens BIGINT[] := '{}'::BIGINT[];
  v_target_entregas BIGINT[] := '{}'::BIGINT[];
  v_target_op_latex_links BIGINT[] := '{}'::BIGINT[];
  v_expedicao_ids BIGINT[] := '{}'::BIGINT[];
  v_expedicao_item_ids BIGINT[] := '{}'::BIGINT[];
  v_impacto JSONB;
  v_blocked BOOLEAN := FALSE;
  v_requires BOOLEAN := FALSE;
  v_cascade BOOLEAN := FALSE;
  v_reason TEXT := NULL;
  v_cascade_reason TEXT := NULL;
  v_entrega_itens_por_op_id BIGINT := 0;
  v_entrega_itens_por_op_item_id BIGINT := 0;
  v_entregas BIGINT := 0;
  v_expedicoes BIGINT := 0;
  v_expedicao_itens BIGINT := 0;
  v_ops_total BIGINT := 0;
  v_filhas BIGINT := 0;
  v_op_latex_entregas BIGINT := 0;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.pedidos WHERE id = p_pedido_id) THEN
    RETURN jsonb_build_object(
      'ok', FALSE,
      'blocked', TRUE,
      'reason', 'Pedido nao encontrado.',
      'impacto', jsonb_build_object('classification', 'blocked', 'blocked', TRUE),
      'deleted', jsonb_build_object(),
      'entity', 'pedido',
      'id', p_pedido_id
    );
  END IF;

  SELECT COALESCE(array_agg(l.id ORDER BY l.id), '{}'::BIGINT[])
    INTO v_lote_ids
    FROM public.lotes l
   WHERE l.pedido_id = p_pedido_id;

  SELECT COALESCE(array_agg(o.id ORDER BY o.id), '{}'::BIGINT[])
    INTO v_root_ops
    FROM public.ops o
   WHERE o.lote_id = ANY(v_lote_ids);

  WITH RECURSIVE op_tree(id, depth) AS (
    SELECT o.id, 0
      FROM public.ops o
     WHERE o.lote_id = ANY(v_lote_ids)
    UNION ALL
    SELECT filha.id, pai.depth + 1
      FROM public.ops filha
      JOIN op_tree pai ON pai.id = filha.origem_op_id
  )
  SELECT
    COALESCE(array_agg(id ORDER BY depth DESC, id), '{}'::BIGINT[]),
    COALESCE(array_agg(id ORDER BY depth DESC, id) FILTER (WHERE depth > 0), '{}'::BIGINT[])
    INTO v_target_ops, v_target_child_ops
    FROM op_tree;

  SELECT COALESCE(array_agg(oi.id ORDER BY oi.id), '{}'::BIGINT[])
    INTO v_target_op_itens
    FROM public.op_itens oi
   WHERE oi.op_id = ANY(v_target_ops);

  SELECT COALESCE(array_agg(oi.id ORDER BY oi.id), '{}'::BIGINT[])
    INTO v_target_child_op_itens
    FROM public.op_itens oi
   WHERE oi.op_id = ANY(v_target_child_ops);

  SELECT COALESCE(array_agg(DISTINCT entrega_id), '{}'::BIGINT[])
    INTO v_target_entregas
    FROM (
      SELECT ei.entrega_id
        FROM public.entrega_itens ei
       WHERE ei.op_id = ANY(v_target_ops)
          OR ei.op_item_id = ANY(v_target_op_itens)
      UNION
      SELECT ole.entrega_id
        FROM public.op_latex_entregas ole
       WHERE ole.op_latex_id = ANY(v_target_ops)
      UNION
      SELECT o.origem_entrega_id
        FROM public.ops o
       WHERE o.id = ANY(v_target_ops)
         AND o.origem_entrega_id IS NOT NULL
    ) s
   WHERE entrega_id IS NOT NULL;

  SELECT COALESCE(array_agg(ole.id ORDER BY ole.id), '{}'::BIGINT[])
    INTO v_target_op_latex_links
    FROM public.op_latex_entregas ole
   WHERE ole.op_latex_id = ANY(v_target_ops)
      OR ole.entrega_id = ANY(v_target_entregas);

  SELECT COALESCE(array_agg(DISTINCT e.id ORDER BY e.id), '{}'::BIGINT[])
    INTO v_expedicao_ids
    FROM (
      SELECT e.id
        FROM public.expedicoes e
       WHERE e.pedido_id = p_pedido_id
          OR e.op_latex_id = ANY(v_target_ops)
      UNION
      SELECT ei.expedicao_id
        FROM public.expedicao_itens ei
       WHERE ei.op_item_id = ANY(v_target_op_itens)
    ) e
   WHERE e.id IS NOT NULL;

  SELECT COALESCE(array_agg(ei.id ORDER BY ei.id), '{}'::BIGINT[])
    INTO v_expedicao_item_ids
    FROM public.expedicao_itens ei
   WHERE ei.expedicao_id = ANY(v_expedicao_ids)
      OR ei.op_item_id = ANY(v_target_op_itens);

  v_ops_total := COALESCE(array_length(v_target_ops, 1), 0);
  v_entregas := COALESCE(array_length(v_target_entregas, 1), 0);
  v_expedicoes := COALESCE(array_length(v_expedicao_ids, 1), 0);
  v_expedicao_itens := COALESCE(array_length(v_expedicao_item_ids, 1), 0);
  v_filhas := COALESCE(array_length(v_target_child_ops, 1), 0);
  v_op_latex_entregas := COALESCE(array_length(v_target_op_latex_links, 1), 0);

  SELECT COUNT(*) INTO v_entrega_itens_por_op_id
    FROM public.entrega_itens ei
   WHERE ei.op_id = ANY(v_target_ops);

  SELECT COUNT(*) INTO v_entrega_itens_por_op_item_id
    FROM public.entrega_itens ei
   WHERE ei.op_item_id = ANY(v_target_op_itens);

  IF v_expedicoes > 0 OR v_expedicao_itens > 0 THEN
    v_blocked := TRUE;
    v_reason := 'Nao e possivel excluir: existe expedicao vinculada. Exclua a expedicao antes.';
  ELSIF v_entregas > 0
     OR v_entrega_itens_por_op_id > 0
     OR v_entrega_itens_por_op_item_id > 0
     OR v_op_latex_entregas > 0
     OR v_filhas > 0 THEN
    v_cascade := TRUE;
    v_cascade_reason := 'Esta exclusao remove cadeia produtiva de teste: OPs, entregas, itens e vinculos. Digite EXCLUIR TUDO para confirmar.';
  ELSIF v_ops_total > 0 THEN
    v_requires := TRUE;
  END IF;

  v_impacto := jsonb_build_object(
    'classification', CASE
      WHEN v_blocked THEN 'blocked'
      WHEN v_cascade THEN 'requires_cascade_confirmation'
      WHEN v_requires THEN 'requires_confirmation'
      ELSE 'safe'
    END,
    'blocked', v_blocked,
    'requires_confirmation', v_requires OR v_cascade,
    'cascade_required', v_cascade,
    'cascade_reason', v_cascade_reason,
    'confirmation_required', CASE WHEN v_cascade THEN 'EXCLUIR TUDO' WHEN v_requires THEN 'EXCLUIR' ELSE NULL END,
    'policy', 'Pedido excluido em teste pode remover cadeia produtiva sem expedicao. op_numeros nao e alterado.',
    'counts', jsonb_build_object(
      'pedido_itens', (SELECT COUNT(*) FROM public.pedido_itens WHERE pedido_id = p_pedido_id),
      'pedido_eventos', (SELECT COUNT(*) FROM public.pedido_eventos WHERE pedido_id = p_pedido_id),
      'pedido_cliente_eventos', (SELECT COUNT(*) FROM public.pedido_cliente_eventos WHERE pedido_id = p_pedido_id),
      'pedido_parciais', (SELECT COUNT(*) FROM public.pedido_parciais WHERE pedido_id = p_pedido_id),
      'pedido_parcial_itens', (
        SELECT COUNT(*)
          FROM public.pedido_parcial_itens ppi
          JOIN public.pedido_parciais pp ON pp.id = ppi.parcial_id
         WHERE pp.pedido_id = p_pedido_id
      ),
      'lotes', COALESCE(array_length(v_lote_ids, 1), 0),
      'ops_vinculadas', v_ops_total,
      'ops_tecelagem', (SELECT COUNT(*) FROM public.ops WHERE id = ANY(v_target_ops) AND COALESCE(tipo, 'tecelagem') = 'tecelagem'),
      'ops_latex_acabamento', (SELECT COUNT(*) FROM public.ops WHERE id = ANY(v_target_ops) AND tipo = 'latex'),
      'entregas', v_entregas,
      'entrega_itens', v_entrega_itens_por_op_id + v_entrega_itens_por_op_item_id,
      'entrega_itens_por_op_id', v_entrega_itens_por_op_id,
      'entrega_itens_por_op_item_id', v_entrega_itens_por_op_item_id,
      'expedicoes', v_expedicoes,
      'expedicao_itens', v_expedicao_itens,
      'expedicao_movimentos', (
        SELECT COUNT(*)
          FROM public.expedicao_movimentos em
         WHERE em.expedicao_id = ANY(v_expedicao_ids)
      ),
      'op_eventos', (SELECT COUNT(*) FROM public.op_eventos WHERE op_id = ANY(v_target_ops)),
      'op_itens', (SELECT COUNT(*) FROM public.op_itens WHERE op_id = ANY(v_target_ops)),
      'op_itens_filhas', COALESCE(array_length(v_target_child_op_itens, 1), 0),
      'op_latex_entregas', v_op_latex_entregas,
      'ops_filhas', v_filhas,
      'ops_filhas_nao_tratadas', 0,
      'cascade_can_zero_entrega_itens_before_ops', (v_expedicoes = 0 AND v_expedicao_itens = 0)
    ),
    'ids', jsonb_build_object(
      'lote_ids', to_jsonb(v_lote_ids),
      'root_op_ids', to_jsonb(v_root_ops),
      'op_ids', to_jsonb(v_target_ops),
      'target_ops', to_jsonb(v_target_ops),
      'target_child_ops', to_jsonb(v_target_child_ops),
      'target_op_itens', to_jsonb(v_target_op_itens),
      'target_child_op_itens', to_jsonb(v_target_child_op_itens),
      'entrega_ids', to_jsonb(v_target_entregas),
      'target_entregas', to_jsonb(v_target_entregas),
      'target_op_latex_links', to_jsonb(v_target_op_latex_links),
      'expedicao_ids', to_jsonb(v_expedicao_ids),
      'expedicao_item_ids', to_jsonb(v_expedicao_item_ids)
    )
  );

  RETURN jsonb_build_object(
    'ok', TRUE,
    'blocked', v_blocked,
    'reason', v_reason,
    'impacto', v_impacto,
    'deleted', jsonb_build_object(),
    'entity', 'pedido',
    'id', p_pedido_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.remover_op(p_op_id BIGINT, p_confirmacao TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_diag JSONB;
  v_class TEXT;
  v_target_ops BIGINT[] := '{}'::BIGINT[];
  v_target_child_ops BIGINT[] := '{}'::BIGINT[];
  v_target_op_itens BIGINT[] := '{}'::BIGINT[];
  v_target_entregas BIGINT[] := '{}'::BIGINT[];
  v_remaining_entrega_item_ids BIGINT[] := '{}'::BIGINT[];
  v_remaining_op_ids BIGINT[] := '{}'::BIGINT[];
  v_remaining_op_item_ids BIGINT[] := '{}'::BIGINT[];
  v_op_id BIGINT;
  v_deleted_op_latex_entregas BIGINT := 0;
  v_deleted_entrega_itens BIGINT := 0;
  v_deleted_entregas BIGINT := 0;
  v_deleted_children BIGINT := 0;
  v_deleted_parent BIGINT := 0;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('ok', FALSE, 'blocked', TRUE, 'reason', 'Apenas admin pode excluir OP em modo teste.', 'impacto', NULL, 'deleted', jsonb_build_object(), 'entity', 'op', 'id', p_op_id);
  END IF;

  v_diag := public.diagnosticar_impacto_op(p_op_id);
  IF COALESCE((v_diag->>'blocked')::BOOLEAN, FALSE) THEN
    RETURN jsonb_set(v_diag, '{ok}', 'false'::jsonb, TRUE);
  END IF;

  v_class := v_diag #>> '{impacto,classification}';
  IF v_class = 'requires_cascade_confirmation' AND COALESCE(p_confirmacao, '') <> 'EXCLUIR TUDO' THEN
    RETURN jsonb_build_object(
      'ok', FALSE,
      'blocked', FALSE,
      'reason', 'Esta exclusao remove cadeia produtiva de teste: OPs, entregas, itens e vinculos. Digite EXCLUIR TUDO para confirmar.',
      'impacto', v_diag->'impacto',
      'deleted', jsonb_build_object(),
      'entity', 'op',
      'id', p_op_id
    );
  ELSIF v_class = 'requires_confirmation' AND COALESCE(p_confirmacao, '') <> 'EXCLUIR' THEN
    RETURN jsonb_build_object(
      'ok', FALSE,
      'blocked', FALSE,
      'reason', 'Digite EXCLUIR para confirmar.',
      'impacto', v_diag->'impacto',
      'deleted', jsonb_build_object(),
      'entity', 'op',
      'id', p_op_id
    );
  END IF;

  SELECT ARRAY(SELECT jsonb_array_elements_text(v_diag #> '{impacto,ids,target_ops}')::BIGINT) INTO v_target_ops;
  SELECT ARRAY(SELECT jsonb_array_elements_text(v_diag #> '{impacto,ids,target_child_ops}')::BIGINT) INTO v_target_child_ops;
  SELECT ARRAY(SELECT jsonb_array_elements_text(v_diag #> '{impacto,ids,target_op_itens}')::BIGINT) INTO v_target_op_itens;
  SELECT ARRAY(SELECT jsonb_array_elements_text(v_diag #> '{impacto,ids,target_entregas}')::BIGINT) INTO v_target_entregas;

  PERFORM set_config('app.retificacao_autorizada', 'on', true);

  DELETE FROM public.op_latex_entregas
   WHERE op_latex_id = ANY(v_target_ops)
      OR entrega_id = ANY(v_target_entregas);
  GET DIAGNOSTICS v_deleted_op_latex_entregas = ROW_COUNT;

  DELETE FROM public.entrega_itens
   WHERE op_id = ANY(v_target_ops)
      OR op_item_id = ANY(v_target_op_itens);
  GET DIAGNOSTICS v_deleted_entrega_itens = ROW_COUNT;

  DELETE FROM public.entregas e
   WHERE e.id = ANY(v_target_entregas)
     AND NOT EXISTS (SELECT 1 FROM public.entrega_itens ei WHERE ei.entrega_id = e.id);
  GET DIAGNOSTICS v_deleted_entregas = ROW_COUNT;

  SELECT
    COALESCE(array_agg(ei.id ORDER BY ei.id), '{}'::BIGINT[]),
    COALESCE(array_agg(DISTINCT ei.op_id ORDER BY ei.op_id), '{}'::BIGINT[]),
    COALESCE(array_agg(DISTINCT ei.op_item_id ORDER BY ei.op_item_id) FILTER (WHERE ei.op_item_id IS NOT NULL), '{}'::BIGINT[])
    INTO v_remaining_entrega_item_ids, v_remaining_op_ids, v_remaining_op_item_ids
    FROM public.entrega_itens ei
   WHERE ei.op_id = ANY(v_target_ops)
      OR ei.op_item_id = ANY(v_target_op_itens);

  IF COALESCE(array_length(v_remaining_entrega_item_ids, 1), 0) > 0 THEN
    RAISE EXCEPTION USING
      MESSAGE = 'Exclusao interrompida: ainda existem itens de entrega vinculados a OPs alvo.',
      DETAIL = format(
        'entrega_item_ids=%s; op_ids=%s; op_item_ids=%s',
        v_remaining_entrega_item_ids,
        v_remaining_op_ids,
        v_remaining_op_item_ids
      );
  END IF;

  FOR v_op_id IN
    SELECT id
      FROM unnest(v_target_child_ops) AS t(id)
     ORDER BY array_position(v_target_child_ops, id)
  LOOP
    DELETE FROM public.ops WHERE id = v_op_id;
    v_deleted_children := v_deleted_children + 1;
  END LOOP;

  DELETE FROM public.ops WHERE id = p_op_id;
  GET DIAGNOSTICS v_deleted_parent = ROW_COUNT;

  RETURN jsonb_build_object(
    'ok', TRUE,
    'blocked', FALSE,
    'reason', NULL,
    'impacto', v_diag->'impacto',
    'deleted', jsonb_build_object(
      'ops', v_deleted_children + v_deleted_parent,
      'ops_filhas', v_deleted_children,
      'entregas', v_deleted_entregas,
      'entrega_itens', v_deleted_entrega_itens,
      'op_latex_entregas', v_deleted_op_latex_entregas
    ),
    'entity', 'op',
    'id', p_op_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.remover_pedido(p_pedido_id UUID, p_confirmacao TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_diag JSONB;
  v_class TEXT;
  v_lote_ids BIGINT[] := '{}'::BIGINT[];
  v_root_ops BIGINT[] := '{}'::BIGINT[];
  v_target_ops BIGINT[] := '{}'::BIGINT[];
  v_target_child_ops BIGINT[] := '{}'::BIGINT[];
  v_target_op_itens BIGINT[] := '{}'::BIGINT[];
  v_target_entregas BIGINT[] := '{}'::BIGINT[];
  v_remaining_entrega_item_ids BIGINT[] := '{}'::BIGINT[];
  v_remaining_op_ids BIGINT[] := '{}'::BIGINT[];
  v_remaining_op_item_ids BIGINT[] := '{}'::BIGINT[];
  v_op_id BIGINT;
  v_deleted_op_latex_entregas BIGINT := 0;
  v_deleted_entrega_itens BIGINT := 0;
  v_deleted_entregas BIGINT := 0;
  v_deleted_children BIGINT := 0;
  v_deleted_root_ops BIGINT := 0;
  v_deleted_lotes BIGINT := 0;
  v_deleted_pedidos BIGINT := 0;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('ok', FALSE, 'blocked', TRUE, 'reason', 'Apenas admin pode excluir Pedido em modo teste.', 'impacto', NULL, 'deleted', jsonb_build_object(), 'entity', 'pedido', 'id', p_pedido_id);
  END IF;

  v_diag := public.diagnosticar_impacto_pedido(p_pedido_id);
  IF COALESCE((v_diag->>'blocked')::BOOLEAN, FALSE) THEN
    RETURN jsonb_set(v_diag, '{ok}', 'false'::jsonb, TRUE);
  END IF;

  v_class := v_diag #>> '{impacto,classification}';
  IF v_class = 'requires_cascade_confirmation' AND COALESCE(p_confirmacao, '') <> 'EXCLUIR TUDO' THEN
    RETURN jsonb_build_object(
      'ok', FALSE,
      'blocked', FALSE,
      'reason', 'Esta exclusao remove cadeia produtiva de teste: OPs, entregas, itens e vinculos. Digite EXCLUIR TUDO para confirmar.',
      'impacto', v_diag->'impacto',
      'deleted', jsonb_build_object(),
      'entity', 'pedido',
      'id', p_pedido_id
    );
  ELSIF v_class = 'requires_confirmation' AND COALESCE(p_confirmacao, '') <> 'EXCLUIR' THEN
    RETURN jsonb_build_object(
      'ok', FALSE,
      'blocked', FALSE,
      'reason', 'Digite EXCLUIR para confirmar.',
      'impacto', v_diag->'impacto',
      'deleted', jsonb_build_object(),
      'entity', 'pedido',
      'id', p_pedido_id
    );
  END IF;

  SELECT ARRAY(SELECT jsonb_array_elements_text(v_diag #> '{impacto,ids,lote_ids}')::BIGINT) INTO v_lote_ids;
  SELECT ARRAY(SELECT jsonb_array_elements_text(v_diag #> '{impacto,ids,root_op_ids}')::BIGINT) INTO v_root_ops;
  SELECT ARRAY(SELECT jsonb_array_elements_text(v_diag #> '{impacto,ids,target_ops}')::BIGINT) INTO v_target_ops;
  SELECT ARRAY(SELECT jsonb_array_elements_text(v_diag #> '{impacto,ids,target_child_ops}')::BIGINT) INTO v_target_child_ops;
  SELECT ARRAY(SELECT jsonb_array_elements_text(v_diag #> '{impacto,ids,target_op_itens}')::BIGINT) INTO v_target_op_itens;
  SELECT ARRAY(SELECT jsonb_array_elements_text(v_diag #> '{impacto,ids,target_entregas}')::BIGINT) INTO v_target_entregas;

  PERFORM set_config('app.retificacao_autorizada', 'on', true);

  DELETE FROM public.op_latex_entregas
   WHERE op_latex_id = ANY(v_target_ops)
      OR entrega_id = ANY(v_target_entregas);
  GET DIAGNOSTICS v_deleted_op_latex_entregas = ROW_COUNT;

  DELETE FROM public.entrega_itens
   WHERE op_id = ANY(v_target_ops)
      OR op_item_id = ANY(v_target_op_itens);
  GET DIAGNOSTICS v_deleted_entrega_itens = ROW_COUNT;

  DELETE FROM public.entregas e
   WHERE e.id = ANY(v_target_entregas)
     AND NOT EXISTS (SELECT 1 FROM public.entrega_itens ei WHERE ei.entrega_id = e.id);
  GET DIAGNOSTICS v_deleted_entregas = ROW_COUNT;

  SELECT
    COALESCE(array_agg(ei.id ORDER BY ei.id), '{}'::BIGINT[]),
    COALESCE(array_agg(DISTINCT ei.op_id ORDER BY ei.op_id), '{}'::BIGINT[]),
    COALESCE(array_agg(DISTINCT ei.op_item_id ORDER BY ei.op_item_id) FILTER (WHERE ei.op_item_id IS NOT NULL), '{}'::BIGINT[])
    INTO v_remaining_entrega_item_ids, v_remaining_op_ids, v_remaining_op_item_ids
    FROM public.entrega_itens ei
   WHERE ei.op_id = ANY(v_target_ops)
      OR ei.op_item_id = ANY(v_target_op_itens);

  IF COALESCE(array_length(v_remaining_entrega_item_ids, 1), 0) > 0 THEN
    RAISE EXCEPTION USING
      MESSAGE = 'Exclusao interrompida: ainda existem itens de entrega vinculados a OPs alvo.',
      DETAIL = format(
        'entrega_item_ids=%s; op_ids=%s; op_item_ids=%s',
        v_remaining_entrega_item_ids,
        v_remaining_op_ids,
        v_remaining_op_item_ids
      );
  END IF;

  FOR v_op_id IN
    SELECT id
      FROM unnest(v_target_child_ops) AS t(id)
     ORDER BY array_position(v_target_child_ops, id)
  LOOP
    DELETE FROM public.ops WHERE id = v_op_id;
    v_deleted_children := v_deleted_children + 1;
  END LOOP;

  FOR v_op_id IN
    SELECT id
      FROM unnest(v_root_ops) AS t(id)
     ORDER BY id
  LOOP
    DELETE FROM public.ops WHERE id = v_op_id;
    v_deleted_root_ops := v_deleted_root_ops + 1;
  END LOOP;

  DELETE FROM public.lotes l
   WHERE l.id = ANY(v_lote_ids)
     AND NOT EXISTS (SELECT 1 FROM public.ops o WHERE o.lote_id = l.id);
  GET DIAGNOSTICS v_deleted_lotes = ROW_COUNT;

  DELETE FROM public.pedidos
   WHERE id = p_pedido_id;
  GET DIAGNOSTICS v_deleted_pedidos = ROW_COUNT;

  RETURN jsonb_build_object(
    'ok', TRUE,
    'blocked', FALSE,
    'reason', NULL,
    'impacto', v_diag->'impacto',
    'deleted', jsonb_build_object(
      'pedidos', v_deleted_pedidos,
      'lotes', v_deleted_lotes,
      'ops', v_deleted_children + v_deleted_root_ops,
      'ops_filhas', v_deleted_children,
      'ops_raiz', v_deleted_root_ops,
      'entregas', v_deleted_entregas,
      'entrega_itens', v_deleted_entrega_itens,
      'op_latex_entregas', v_deleted_op_latex_entregas
    ),
    'entity', 'pedido',
    'id', p_pedido_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.diagnosticar_impacto_pedido(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.diagnosticar_impacto_op(BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remover_pedido(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remover_op(BIGINT, TEXT) TO authenticated;

COMMENT ON FUNCTION public.diagnosticar_impacto_pedido(UUID) IS
  'Diagnostico read-only do impacto de exclusao fisica em cascata temporaria de Pedido em ambiente de testes, com alvos FK explicitos.';
COMMENT ON FUNCTION public.diagnosticar_impacto_op(BIGINT) IS
  'Diagnostico read-only do impacto de exclusao fisica em cascata temporaria de OP em ambiente de testes, com alvos FK explicitos.';
COMMENT ON FUNCTION public.remover_pedido(UUID, TEXT) IS
  'Remove Pedido de teste sem expedicao, limpando entrega_itens por op_id/op_item_id antes de ops. Nao altera op_numeros.';
COMMENT ON FUNCTION public.remover_op(BIGINT, TEXT) IS
  'Remove OP de teste sem expedicao, limpando entrega_itens por op_id/op_item_id antes de ops. Nao altera op_numeros.';

NOTIFY pgrst, 'reload schema';
