-- ============================================================
-- Fase: RAVATEX-TAPETES-CLIENTE-ORDER-SUMMARY-READMODEL-A-B
-- Read model publico do detalhe do pedido no portal cliente.
--
-- Objetivo:
--   - Fornecer um DTO publico e simplificado para a tela cliente.
--   - Manter consultas operacionais atras de uma RPC dedicada.
--   - Nao retornar identificadores ou detalhes internos de producao.
--
-- Status:
--   - Versionada no repo.
--   - Nao aplicada em staging/producao nesta fase.
--   - Producao nao deve ser tocada por esta migration nesta fase.
-- ============================================================

CREATE OR REPLACE FUNCTION public.cliente_pedido_summary(p_pedido_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_pedido                 RECORD;
  v_is_admin               BOOLEAN := public.is_admin();
  v_cliente_id             BIGINT := public.meu_cliente_id();
  v_itens                  JSONB := '[]'::jsonb;
  v_parciais               JSONB := '[]'::jsonb;
  v_timeline               JSONB := '[]'::jsonb;
  v_entregas               JSONB := '[]'::jsonb;
  v_etapas                 JSONB := '[]'::jsonb;
  v_total_ops              INTEGER := 0;
  v_has_tec                BOOLEAN := FALSE;
  v_has_acab               BOOLEAN := FALSE;
  v_tec_target             NUMERIC := 0;
  v_tec_done               NUMERIC := 0;
  v_acab_target            NUMERIC := 0;
  v_acab_done              NUMERIC := 0;
  v_tec_terminal           BOOLEAN := FALSE;
  v_acab_terminal          BOOLEAN := FALSE;
  v_tec_production         BOOLEAN := FALSE;
  v_acab_production        BOOLEAN := FALSE;
  v_insumo_pedido          NUMERIC := 0;
  v_insumo_recebido        NUMERIC := 0;
  v_expedicao_count        INTEGER := 0;
  v_expedicao_liberado     NUMERIC := 0;
  v_expedicao_entregue     NUMERIC := 0;
  v_operational_override   BOOLEAN := FALSE;
  v_visual_key             TEXT;
  v_exception_key          TEXT;
  v_current_key            TEXT := 'recebido';
  v_status_key             TEXT := 'recebido';
  v_status_label           TEXT := 'Recebido';
  v_status_message         TEXT;
  v_current_index          INTEGER := 0;
  v_progress_percent       NUMERIC := 12.5;
  v_pending                JSONB := '[]'::jsonb;
BEGIN
  SELECT
    p.id,
    p.numero,
    p.status,
    p.status_cliente_visual,
    p.status_cliente_excecao,
    p.status_cliente_mensagem,
    p.status_cliente_atualizado_em,
    p.prazo_entrega,
    p.prazo_desejado,
    p.tipo_recebimento,
    p.observacao,
    p.criado_em,
    p.atualizado_em,
    p.parcial_habilitado,
    p.parcial_atualizado_em,
    p.metros_total
  INTO v_pedido
  FROM public.pedidos p
  WHERE p.id = p_pedido_id
    AND (
      v_is_admin
      OR p.cliente_id = v_cliente_id
    );

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'ok', false,
      'erro', 'Pedido nao encontrado ou sem permissao'
    );
  END IF;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'modelo', COALESCE(m.nome, 'Modelo'),
      'largura', COALESCE(pi.largura, m.largura),
      'cor_1', c1.nome,
      'cor_2', c2.nome,
      'metros', pi.metros,
      'observacao', pi.observacao,
      'ordem', pi.ordem
    )
    ORDER BY pi.ordem, pi.criado_em
  ), '[]'::jsonb)
  INTO v_itens
  FROM public.pedido_itens pi
  LEFT JOIN public.modelos m ON m.id = pi.modelo_id
  LEFT JOIN public.cores c1 ON c1.id = COALESCE(pi.cor_1_id, m.cor_1_id)
  LEFT JOIN public.cores c2 ON c2.id = COALESCE(pi.cor_2_id, m.cor_2_id)
  WHERE pi.pedido_id = p_pedido_id;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'sequencia', pp.sequencia,
      'situacao', pp.situacao,
      'metros', pp.metros,
      'data_referencia', pp.data_referencia,
      'titulo', pp.titulo,
      'mensagem_cliente', pp.mensagem_cliente,
      'visivel_cliente', true,
      'criado_em', pp.criado_em,
      'atualizado_em', pp.atualizado_em
    )
    ORDER BY pp.sequencia, pp.criado_em
  ), '[]'::jsonb)
  INTO v_parciais
  FROM public.pedido_parciais pp
  WHERE pp.pedido_id = p_pedido_id
    AND pp.visivel_cliente IS TRUE;

  WITH pedido_ops AS (
    SELECT o.id, o.tipo, o.status
    FROM public.ops o
    JOIN public.lotes l ON l.id = o.lote_id
    WHERE l.pedido_id = p_pedido_id
  ),
  targets AS (
    SELECT
      po.id,
      po.tipo,
      po.status,
      COALESCE(SUM(COALESCE(oi.metros_ajustados, oi.metros_pedidos)), 0) AS target
    FROM pedido_ops po
    LEFT JOIN public.op_itens oi ON oi.op_id = po.id
    GROUP BY po.id, po.tipo, po.status
  ),
  delivered AS (
    SELECT
      t.id,
      COALESCE(SUM(
        CASE
          WHEN ei.defeito IS TRUE THEN 0
          WHEN e.etapa = CASE WHEN t.tipo = 'latex' THEN 'latex' ELSE 'cima' END
            THEN ei.metros_entregues
          ELSE 0
        END
      ), 0) AS done
    FROM targets t
    LEFT JOIN public.entrega_itens ei ON ei.op_id = t.id
    LEFT JOIN public.entregas e ON e.id = ei.entrega_id
    GROUP BY t.id
  )
  SELECT
    COUNT(*)::INTEGER,
    (COUNT(*) FILTER (WHERE t.tipo <> 'latex')) > 0,
    (COUNT(*) FILTER (WHERE t.tipo = 'latex')) > 0,
    COALESCE(SUM(t.target) FILTER (WHERE t.tipo <> 'latex'), 0),
    COALESCE(SUM(d.done) FILTER (WHERE t.tipo <> 'latex'), 0),
    COALESCE(SUM(t.target) FILTER (WHERE t.tipo = 'latex'), 0),
    COALESCE(SUM(d.done) FILTER (WHERE t.tipo = 'latex'), 0),
    BOOL_OR(t.tipo <> 'latex' AND t.status IN ('concluida', 'finalizada')),
    BOOL_OR(t.tipo = 'latex' AND t.status IN ('concluida', 'finalizada')),
    BOOL_OR(t.tipo <> 'latex' AND t.status = 'em_producao'),
    BOOL_OR(t.tipo = 'latex' AND t.status = 'em_producao')
  INTO
    v_total_ops,
    v_has_tec,
    v_has_acab,
    v_tec_target,
    v_tec_done,
    v_acab_target,
    v_acab_done,
    v_tec_terminal,
    v_acab_terminal,
    v_tec_production,
    v_acab_production
  FROM targets t
  LEFT JOIN delivered d ON d.id = t.id;

  WITH pedido_ops AS (
    SELECT o.id
    FROM public.ops o
    JOIN public.lotes l ON l.id = o.lote_id
    WHERE l.pedido_id = p_pedido_id
  )
  SELECT
    COALESCE(SUM(ocf.kg_pedido), 0),
    COALESCE(SUM(ocf.kg_recebido), 0)
  INTO v_insumo_pedido, v_insumo_recebido
  FROM public.ordens_compra_fio ocf
  WHERE ocf.op_id IN (SELECT id FROM pedido_ops);

  SELECT
    COUNT(DISTINCT e.id)::INTEGER,
    COALESCE(SUM(ei.metros_liberados), 0),
    COALESCE(SUM(ei.metros_entregues), 0)
  INTO v_expedicao_count, v_expedicao_liberado, v_expedicao_entregue
  FROM public.expedicoes e
  LEFT JOIN public.expedicao_itens ei ON ei.expedicao_id = e.id
  WHERE e.pedido_id = p_pedido_id;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'data', m.data,
      'descricao', CASE
        WHEN m.tipo = 'coleta' THEN 'Coleta registrada'
        ELSE 'Entrega registrada'
      END,
      'quantidade', m.quantidade
    )
    ORDER BY m.data DESC, m.ordem DESC
  ), '[]'::jsonb)
  INTO v_entregas
  FROM (
    SELECT
      em.id AS ordem,
      em.data,
      em.tipo,
      COALESCE(SUM(emi.metros), 0) AS quantidade
    FROM public.expedicao_movimentos em
    JOIN public.expedicoes e ON e.id = em.expedicao_id
    LEFT JOIN public.expedicao_movimento_itens emi ON emi.movimento_id = em.id
    WHERE e.pedido_id = p_pedido_id
    GROUP BY em.id, em.data, em.tipo
  ) m;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'data', pce.criado_em,
      'titulo', pce.titulo,
      'descricao', pce.mensagem,
      'status', pce.status
    )
    ORDER BY pce.criado_em DESC
  ), '[]'::jsonb)
  INTO v_timeline
  FROM public.pedido_cliente_eventos pce
  WHERE pce.pedido_id = p_pedido_id
    AND pce.visivel_cliente IS TRUE;

  v_visual_key := NULLIF(v_pedido.status_cliente_visual, '');
  v_exception_key := NULLIF(v_pedido.status_cliente_excecao, '');
  v_operational_override :=
    v_total_ops > 0
    OR v_expedicao_count > 0
    OR v_pedido.status = 'entregue';

  v_current_key := CASE
    WHEN v_pedido.status = 'entregue' THEN 'concluido'
    WHEN v_expedicao_count > 0 AND v_expedicao_entregue > 0 THEN 'transporte'
    WHEN v_expedicao_count > 0 THEN 'expedicao'
    WHEN v_acab_terminal THEN 'expedicao'
    WHEN v_has_acab OR v_acab_production OR v_acab_done > 0 THEN 'acabamento'
    WHEN v_tec_terminal OR v_tec_production OR v_tec_done > 0 THEN 'tecelagem'
    WHEN v_has_tec OR v_insumo_pedido > 0 THEN 'insumos'
    WHEN v_visual_key IN ('recebido','confirmado','insumos','tecelagem','acabamento','expedicao','transporte','concluido') THEN v_visual_key
    WHEN v_pedido.status = 'confirmado' THEN 'confirmado'
    ELSE 'recebido'
  END;

  v_status_key := COALESCE(v_exception_key, v_current_key);
  v_status_label := CASE v_status_key
    WHEN 'confirmado' THEN 'Confirmado'
    WHEN 'insumos' THEN 'Insumos'
    WHEN 'tecelagem' THEN 'Tecelagem em andamento'
    WHEN 'acabamento' THEN 'Acabamento em andamento'
    WHEN 'expedicao' THEN 'Expedicao'
    WHEN 'transporte' THEN 'Transporte'
    WHEN 'concluido' THEN 'Concluido'
    WHEN 'aguardando_definicao' THEN 'Aguardando definicao'
    WHEN 'aguardando_insumo' THEN 'Aguardando insumo'
    WHEN 'pausado' THEN 'Pausado'
    WHEN 'cancelado' THEN 'Cancelado'
    ELSE 'Recebido'
  END;

  v_status_message := COALESCE(NULLIF(v_pedido.status_cliente_mensagem, ''), CASE v_current_key
    WHEN 'confirmado' THEN 'Seu pedido foi confirmado para atendimento.'
    WHEN 'insumos' THEN 'Estamos preparando os materiais do seu pedido.'
    WHEN 'tecelagem' THEN 'Seu pedido esta em producao.'
    WHEN 'acabamento' THEN 'Seu pedido esta em acabamento.'
    WHEN 'expedicao' THEN 'Seu pedido esta em preparacao para entrega.'
    WHEN 'transporte' THEN 'Seu pedido esta em transporte.'
    WHEN 'concluido' THEN 'Seu pedido foi concluido.'
    ELSE 'Seu pedido foi recebido.'
  END);

  v_current_index := CASE v_current_key
    WHEN 'recebido' THEN 0
    WHEN 'confirmado' THEN 1
    WHEN 'insumos' THEN 2
    WHEN 'tecelagem' THEN 3
    WHEN 'acabamento' THEN 4
    WHEN 'expedicao' THEN 5
    WHEN 'transporte' THEN 6
    WHEN 'concluido' THEN 7
    ELSE 0
  END;

  v_progress_percent := ROUND(((v_current_index + 1)::NUMERIC / 8) * 100, 1);

  IF v_current_key IN ('recebido', 'confirmado') THEN
    v_pending := v_pending || jsonb_build_array('Aguardando programacao do pedido.');
  ELSIF v_current_key = 'insumos' THEN
    v_pending := v_pending || jsonb_build_array('Aguardando preparacao dos materiais.');
  ELSIF v_current_key = 'expedicao' AND v_expedicao_count = 0 THEN
    v_pending := v_pending || jsonb_build_array('Aguardando liberacao para entrega.');
  END IF;

  WITH steps(chave, label, idx, descricao_atual, descricao_futura) AS (
    VALUES
      ('recebido', 'Recebido', 0, 'Seu pedido foi recebido.', 'Aguardando recebimento.'),
      ('confirmado', 'Confirmado', 1, 'Seu pedido foi confirmado.', 'Aguardando confirmacao.'),
      ('insumos', 'Insumos', 2, 'Materiais em preparacao.', 'Aguardando preparacao.'),
      ('tecelagem', 'Tecelagem', 3, 'Seu pedido esta em producao.', 'Aguardando producao.'),
      ('acabamento', 'Acabamento', 4, 'Seu pedido esta em acabamento.', 'Aguardando acabamento.'),
      ('expedicao', 'Expedicao', 5, 'Seu pedido esta em preparacao para entrega.', 'Aguardando preparacao para entrega.'),
      ('transporte', 'Transporte', 6, 'Entrega em andamento.', 'Aguardando transporte.'),
      ('concluido', 'Concluido', 7, 'Pedido concluido.', 'Aguardando conclusao.')
  )
  SELECT jsonb_agg(
    jsonb_build_object(
      'chave', chave,
      'key', chave,
      'label', label,
      'status', CASE
        WHEN idx < v_current_index THEN 'done'
        WHEN idx = v_current_index THEN 'current'
        ELSE 'future'
      END,
      'state', CASE
        WHEN idx < v_current_index THEN 'concluido'
        WHEN idx = v_current_index THEN 'atual'
        ELSE 'futuro'
      END,
      'percentual', CASE
        WHEN idx <= v_current_index THEN 100
        ELSE 0
      END,
      'descricao', CASE
        WHEN idx <= v_current_index THEN descricao_atual
        ELSE descricao_futura
      END
    )
    ORDER BY idx
  )
  INTO v_etapas
  FROM steps;

  RETURN jsonb_build_object(
    'ok', true,
    'pedido_id', v_pedido.id,
    'numero', v_pedido.numero,
    'status', v_status_key,
    'status_label', v_status_label,
    'mensagem', v_status_message,
    'progresso_percentual', v_progress_percent,
    'etapas', COALESCE(v_etapas, '[]'::jsonb),
    'entregas', COALESCE(v_entregas, '[]'::jsonb),
    'timeline', COALESCE(v_timeline, '[]'::jsonb),
    'pendencias', v_pending,
    'pedido', jsonb_build_object(
      'id', v_pedido.id,
      'numero', v_pedido.numero,
      'status', v_pedido.status,
      'status_cliente_visual', v_current_key,
      'status_cliente_excecao', v_exception_key,
      'status_cliente_mensagem', v_status_message,
      'status_cliente_atualizado_em', COALESCE(v_pedido.status_cliente_atualizado_em, v_pedido.atualizado_em),
      'prazo_entrega', v_pedido.prazo_entrega,
      'prazo_desejado', v_pedido.prazo_desejado,
      'tipo_recebimento', v_pedido.tipo_recebimento,
      'observacao', v_pedido.observacao,
      'criado_em', v_pedido.criado_em,
      'atualizado_em', v_pedido.atualizado_em,
      'parcial_habilitado', v_pedido.parcial_habilitado,
      'parcial_atualizado_em', v_pedido.parcial_atualizado_em,
      'metros_total', v_pedido.metros_total
    ),
    'itens', COALESCE(v_itens, '[]'::jsonb),
    'parciais', COALESCE(v_parciais, '[]'::jsonb),
    'chain_state', jsonb_build_object(
      'stage', v_current_key,
      'displayStatus', v_status_label,
      'mensagem', v_status_message,
      'clientStep', v_current_key,
      'isOperationalOverride', v_operational_override,
      'progressPercent', v_progress_percent,
      'clientSteps', COALESCE(v_etapas, '[]'::jsonb)
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.cliente_pedido_summary(UUID) TO authenticated;

COMMENT ON FUNCTION public.cliente_pedido_summary(UUID) IS
  'Read model publico do detalhe do pedido para cliente autenticado/admin. Retorna somente DTO sanitizado.';

NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';
