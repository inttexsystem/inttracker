-- ============================================================
-- Fase: RAVATEX-TAPETES-PEDIDO-OP-CONTROLLED-DELETE-B
-- Exclusao fisica controlada de teste para Pedido e OP.
--
-- Politica:
-- - Diagnosticos sao read-only e retornam JSONB.
-- - Remocoes rodam dentro da transacao da propria RPC.
-- - Pedido com entrega/expedicao bloqueia.
-- - OP com entrega/expedicao bloqueia.
-- - OP mae com filha bloqueia na remocao individual.
-- - Pedido remove lotes/OPs sem movimento vinculados a ele.
-- - op_numeros nao e lida para escrita, nao e alterada e nao e resetada.
-- ============================================================

-- A db/26 instalou uma politica futura de producao para impedir delete fisico
-- de qualquer OP numerada. Nesta fase de staging/teste, a porta controlada de
-- limpeza precisa permitir OP numerada sem bloqueadores reais. O numero fica
-- como rastro interno historico e nunca e reciclado porque op_numeros nao e
-- reduzido nem reescrito aqui.
DROP TRIGGER IF EXISTS ops_numeradas_no_delete ON public.ops;
DROP FUNCTION IF EXISTS public.ops_numeradas_no_delete_fn();

CREATE OR REPLACE FUNCTION public.diagnosticar_impacto_pedido(p_pedido_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lote_ids BIGINT[] := '{}'::BIGINT[];
  v_op_ids BIGINT[] := '{}'::BIGINT[];
  v_expedicao_ids BIGINT[] := '{}'::BIGINT[];
  v_impacto JSONB;
  v_blocked BOOLEAN := FALSE;
  v_requires BOOLEAN := FALSE;
  v_reason TEXT := NULL;
  v_entregas BIGINT := 0;
  v_expedicoes BIGINT := 0;
  v_filhas_nao_tratadas BIGINT := 0;
  v_ops_total BIGINT := 0;
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

  SELECT COALESCE(array_agg(l.id), '{}'::BIGINT[])
    INTO v_lote_ids
    FROM public.lotes l
   WHERE l.pedido_id = p_pedido_id;

  SELECT COALESCE(array_agg(o.id), '{}'::BIGINT[])
    INTO v_op_ids
    FROM public.ops o
   WHERE o.lote_id = ANY(v_lote_ids);

  SELECT COALESCE(array_agg(e.id), '{}'::BIGINT[])
    INTO v_expedicao_ids
    FROM public.expedicoes e
   WHERE e.pedido_id = p_pedido_id
      OR e.op_latex_id = ANY(v_op_ids);

  v_ops_total := COALESCE(array_length(v_op_ids, 1), 0);

  SELECT COUNT(DISTINCT ei.entrega_id)
    INTO v_entregas
    FROM public.entrega_itens ei
   WHERE ei.op_id = ANY(v_op_ids);

  SELECT COUNT(*)
    INTO v_expedicoes
    FROM public.expedicoes e
   WHERE e.id = ANY(v_expedicao_ids);

  SELECT COUNT(*)
    INTO v_filhas_nao_tratadas
    FROM public.ops filha
   WHERE filha.origem_op_id = ANY(v_op_ids)
     AND NOT (filha.id = ANY(v_op_ids));

  IF v_entregas > 0 THEN
    v_blocked := TRUE;
    v_reason := 'Nao e possivel excluir: existe entrega vinculada. Exclua a entrega antes.';
  ELSIF v_expedicoes > 0 THEN
    v_blocked := TRUE;
    v_reason := 'Nao e possivel excluir: existe expedicao vinculada. Exclua a expedicao antes.';
  ELSIF v_filhas_nao_tratadas > 0 THEN
    v_blocked := TRUE;
    v_reason := 'Nao e possivel excluir esta OP: existe OP de Acabamento vinculada. Exclua a OP filha primeiro.';
  ELSIF v_ops_total > 0 THEN
    v_requires := TRUE;
  END IF;

  v_impacto := jsonb_build_object(
    'classification', CASE WHEN v_blocked THEN 'blocked' WHEN v_requires THEN 'requires_confirmation' ELSE 'safe' END,
    'blocked', v_blocked,
    'requires_confirmation', v_requires,
    'policy', 'Pedido excluido em teste remove lotes e OPs sem movimentacao vinculados; op_numeros nao e alterado.',
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
      'ops_tecelagem', (SELECT COUNT(*) FROM public.ops WHERE id = ANY(v_op_ids) AND COALESCE(tipo, 'tecelagem') = 'tecelagem'),
      'ops_latex_acabamento', (SELECT COUNT(*) FROM public.ops WHERE id = ANY(v_op_ids) AND tipo = 'latex'),
      'entregas', v_entregas,
      'entrega_itens', (SELECT COUNT(*) FROM public.entrega_itens WHERE op_id = ANY(v_op_ids)),
      'expedicoes', v_expedicoes,
      'expedicao_itens', (
        SELECT COUNT(*)
          FROM public.expedicao_itens ei
          JOIN public.expedicoes e ON e.id = ei.expedicao_id
         WHERE e.id = ANY(v_expedicao_ids)
      ),
      'expedicao_movimentos', (
        SELECT COUNT(*)
          FROM public.expedicao_movimentos em
         WHERE em.expedicao_id = ANY(v_expedicao_ids)
      ),
      'op_eventos', (SELECT COUNT(*) FROM public.op_eventos WHERE op_id = ANY(v_op_ids)),
      'op_itens', (SELECT COUNT(*) FROM public.op_itens WHERE op_id = ANY(v_op_ids)),
      'op_latex_entregas', (
        SELECT COUNT(*)
          FROM public.op_latex_entregas ole
         WHERE ole.op_latex_id = ANY(v_op_ids)
            OR ole.entrega_id IN (SELECT entrega_id FROM public.entrega_itens WHERE op_id = ANY(v_op_ids))
      ),
      'ops_filhas', (SELECT COUNT(*) FROM public.ops WHERE origem_op_id = ANY(v_op_ids)),
      'ops_filhas_nao_tratadas', v_filhas_nao_tratadas
    ),
    'ids', jsonb_build_object(
      'lote_ids', to_jsonb(v_lote_ids),
      'op_ids', to_jsonb(v_op_ids),
      'expedicao_ids', to_jsonb(v_expedicao_ids)
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

CREATE OR REPLACE FUNCTION public.diagnosticar_impacto_op(p_op_id BIGINT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_expedicao_ids BIGINT[] := '{}'::BIGINT[];
  v_op public.ops%ROWTYPE;
  v_impacto JSONB;
  v_blocked BOOLEAN := FALSE;
  v_requires BOOLEAN := FALSE;
  v_reason TEXT := NULL;
  v_entregas BIGINT := 0;
  v_expedicoes BIGINT := 0;
  v_filhas BIGINT := 0;
  v_op_itens BIGINT := 0;
  v_op_eventos BIGINT := 0;
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

  SELECT COALESCE(array_agg(e.id), '{}'::BIGINT[])
    INTO v_expedicao_ids
    FROM public.expedicoes e
   WHERE e.op_latex_id = p_op_id;

  SELECT COUNT(DISTINCT ei.entrega_id)
    INTO v_entregas
    FROM public.entrega_itens ei
   WHERE ei.op_id = p_op_id;

  SELECT COUNT(*) INTO v_expedicoes FROM public.expedicoes e WHERE e.id = ANY(v_expedicao_ids);
  SELECT COUNT(*) INTO v_filhas FROM public.ops filha WHERE filha.origem_op_id = p_op_id;
  SELECT COUNT(*) INTO v_op_itens FROM public.op_itens WHERE op_id = p_op_id;
  SELECT COUNT(*) INTO v_op_eventos FROM public.op_eventos WHERE op_id = p_op_id;

  IF v_entregas > 0 THEN
    v_blocked := TRUE;
    v_reason := 'Nao e possivel excluir: existe entrega vinculada. Exclua a entrega antes.';
  ELSIF v_expedicoes > 0 THEN
    v_blocked := TRUE;
    v_reason := 'Nao e possivel excluir: existe expedicao vinculada. Exclua a expedicao antes.';
  ELSIF v_filhas > 0 THEN
    v_blocked := TRUE;
    v_reason := 'Nao e possivel excluir esta OP: existe OP de Acabamento vinculada. Exclua a OP filha primeiro.';
  ELSIF (v_op_itens + v_op_eventos) > 0 THEN
    v_requires := TRUE;
  END IF;

  v_impacto := jsonb_build_object(
    'classification', CASE WHEN v_blocked THEN 'blocked' WHEN v_requires THEN 'requires_confirmation' ELSE 'safe' END,
    'blocked', v_blocked,
    'requires_confirmation', v_requires,
    'policy', 'OP excluida em teste remove dependencias em cascata sem alterar op_numeros.',
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
      'op_eventos', v_op_eventos,
      'fornecedores', (SELECT COUNT(*) FROM public.op_fornecedores WHERE op_id = p_op_id),
      'op_fornecedores', (SELECT COUNT(*) FROM public.op_fornecedores WHERE op_id = p_op_id),
      'ordens_compra_fio', (SELECT COUNT(*) FROM public.ordens_compra_fio WHERE op_id = p_op_id),
      'saldo_fios_op', (SELECT COUNT(*) FROM public.saldo_fios_op WHERE op_id = p_op_id),
      'entregas', v_entregas,
      'entrega_itens', (SELECT COUNT(*) FROM public.entrega_itens WHERE op_id = p_op_id),
      'expedicoes', v_expedicoes,
      'expedicao_itens', (
        SELECT COUNT(*)
          FROM public.expedicao_itens ei
          JOIN public.expedicoes e ON e.id = ei.expedicao_id
         WHERE e.id = ANY(v_expedicao_ids)
      ),
      'ops_filhas', v_filhas,
      'op_mae', CASE WHEN v_op.origem_op_id IS NULL THEN 0 ELSE 1 END,
      'op_latex_entregas', (SELECT COUNT(*) FROM public.op_latex_entregas WHERE op_latex_id = p_op_id)
    ),
    'ids', jsonb_build_object('expedicao_ids', to_jsonb(v_expedicao_ids))
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

CREATE OR REPLACE FUNCTION public.remover_op(p_op_id BIGINT, p_confirmacao TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_diag JSONB;
  v_class TEXT;
  v_deleted_ops BIGINT := 0;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('ok', FALSE, 'blocked', TRUE, 'reason', 'Apenas admin pode excluir OP em modo teste.', 'impacto', NULL, 'deleted', jsonb_build_object(), 'entity', 'op', 'id', p_op_id);
  END IF;

  v_diag := public.diagnosticar_impacto_op(p_op_id);
  IF COALESCE((v_diag->>'blocked')::BOOLEAN, FALSE) THEN
    RETURN jsonb_set(v_diag, '{ok}', 'false'::jsonb, TRUE);
  END IF;

  v_class := v_diag #>> '{impacto,classification}';
  IF v_class = 'requires_confirmation' AND COALESCE(p_confirmacao, '') <> 'EXCLUIR' THEN
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

  DELETE FROM public.ops WHERE id = p_op_id;
  GET DIAGNOSTICS v_deleted_ops = ROW_COUNT;

  RETURN jsonb_build_object(
    'ok', TRUE,
    'blocked', FALSE,
    'reason', NULL,
    'impacto', v_diag->'impacto',
    'deleted', jsonb_build_object('ops', v_deleted_ops),
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
  v_op_ids BIGINT[] := '{}'::BIGINT[];
  v_deleted_latex BIGINT := 0;
  v_deleted_tec BIGINT := 0;
  v_deleted_lotes BIGINT := 0;
  v_deleted_pedidos BIGINT := 0;
  v_row_count BIGINT := 0;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('ok', FALSE, 'blocked', TRUE, 'reason', 'Apenas admin pode excluir Pedido em modo teste.', 'impacto', NULL, 'deleted', jsonb_build_object(), 'entity', 'pedido', 'id', p_pedido_id);
  END IF;

  v_diag := public.diagnosticar_impacto_pedido(p_pedido_id);
  IF COALESCE((v_diag->>'blocked')::BOOLEAN, FALSE) THEN
    RETURN jsonb_set(v_diag, '{ok}', 'false'::jsonb, TRUE);
  END IF;

  v_class := v_diag #>> '{impacto,classification}';
  IF v_class = 'requires_confirmation' AND COALESCE(p_confirmacao, '') <> 'EXCLUIR' THEN
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

  SELECT COALESCE(array_agg(l.id), '{}'::BIGINT[])
    INTO v_lote_ids
    FROM public.lotes l
   WHERE l.pedido_id = p_pedido_id;

  SELECT COALESCE(array_agg(o.id), '{}'::BIGINT[])
    INTO v_op_ids
    FROM public.ops o
   WHERE o.lote_id = ANY(v_lote_ids);

  DELETE FROM public.ops
   WHERE id = ANY(v_op_ids)
     AND tipo = 'latex';
  GET DIAGNOSTICS v_deleted_latex = ROW_COUNT;

  DELETE FROM public.ops
   WHERE id = ANY(v_op_ids);
  GET DIAGNOSTICS v_deleted_tec = ROW_COUNT;

  DELETE FROM public.lotes
   WHERE id = ANY(v_lote_ids);
  GET DIAGNOSTICS v_deleted_lotes = ROW_COUNT;

  DELETE FROM public.pedidos
   WHERE id = p_pedido_id;
  GET DIAGNOSTICS v_deleted_pedidos = ROW_COUNT;

  v_row_count := v_deleted_latex + v_deleted_tec;

  RETURN jsonb_build_object(
    'ok', TRUE,
    'blocked', FALSE,
    'reason', NULL,
    'impacto', v_diag->'impacto',
    'deleted', jsonb_build_object(
      'pedidos', v_deleted_pedidos,
      'lotes', v_deleted_lotes,
      'ops', v_row_count,
      'ops_latex_acabamento', v_deleted_latex,
      'ops_tecelagem', v_deleted_tec
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
  'Diagnostico read-only do impacto de exclusao fisica temporaria de Pedido em ambiente de testes.';
COMMENT ON FUNCTION public.diagnosticar_impacto_op(BIGINT) IS
  'Diagnostico read-only do impacto de exclusao fisica temporaria de OP em ambiente de testes.';
COMMENT ON FUNCTION public.remover_pedido(UUID, TEXT) IS
  'Remove Pedido de teste sem entrega/expedicao, com confirmacao forte quando ha OP. Nao altera op_numeros.';
COMMENT ON FUNCTION public.remover_op(BIGINT, TEXT) IS
  'Remove OP de teste sem entrega/expedicao/filha, com confirmacao forte quando ha dependencias nao bloqueadoras. Nao altera op_numeros.';
