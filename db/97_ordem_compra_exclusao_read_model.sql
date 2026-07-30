-- =====================================================================
-- db/97_ordem_compra_exclusao_read_model.sql
-- OC-OPERATOR-CODE-AND-DELETION-R1 (continuacao) — a elegibilidade para
-- exclusao passa a ter UM dono, lido pelo servidor e projetado no read model.
--
-- POR QUE
--   db/96 criou `excluir_ordem_compra` com a regra de elegibilidade escrita
--   inline no proprio escritor. A tela precisa da MESMA regra para decidir se
--   mostra a acao — e reimplementa-la no cliente seria reconstruir autoridade
--   (§R.23.8) e abrir espaco para divergencia silenciosa: um botao oferecido
--   para uma ordem que o servidor recusaria, ou escondido para uma que ele
--   aceitaria.
--
--   `public.oc_elegivel_exclusao` passa a ser esse dono unico. O escritor
--   delega a decisao a ela e o read model `obter_ordem_compra_admin` projeta
--   o resultado em `acoes.excluir`. A tela apenas obedece.
--
-- Forward-only; db/01..db/96 sao intocados. O guard terminal avanca 96 -> 97
-- no mesmo commit (tests/ordem-compra-c3d-deploy.smoke.js).
-- =====================================================================

BEGIN;

-- ============================================================
-- 1. Dono unico da elegibilidade
-- ============================================================
CREATE OR REPLACE FUNCTION public.oc_elegivel_exclusao(p_ordem_id BIGINT)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v public.ordem_compra%ROWTYPE;
BEGIN
  SELECT * INTO v FROM public.ordem_compra WHERE id = p_ordem_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('elegivel', false, 'codigo', 'nao_encontrada',
      'erro', 'Ordem de compra nao encontrada');
  END IF;

  IF v.legado THEN
    RETURN jsonb_build_object('elegivel', false, 'codigo', 'ordem_legado',
      'erro', 'Ordem legada nao pode ser excluida por esta via');
  END IF;

  IF v.status_administrativo NOT IN ('rascunho', 'cancelada') THEN
    RETURN jsonb_build_object('elegivel', false, 'codigo', 'estado_invalido',
      'erro', 'Somente uma ordem em rascunho ou cancelada pode ser excluida');
  END IF;

  IF v.emitida_em IS NOT NULL THEN
    RETURN jsonb_build_object('elegivel', false, 'codigo', 'ordem_emitida',
      'erro', 'Uma ordem que ja foi emitida nao pode ser excluida');
  END IF;

  IF v.status_aceite IN ('aceita', 'rejeitada') THEN
    RETURN jsonb_build_object('elegivel', false, 'codigo', 'aceite_decidido',
      'erro', 'Uma ordem com aceite decidido pelo fornecedor nao pode ser excluida');
  END IF;

  -- Os tres filhos ON DELETE RESTRICT sao exatamente o historico irreversivel.
  IF EXISTS (SELECT 1 FROM public.ordem_compra_recebimentos WHERE ordem_compra_id = p_ordem_id)
     OR EXISTS (SELECT 1 FROM public.ordem_compra_fio_lancamentos WHERE ordem_compra_id = p_ordem_id)
     OR EXISTS (SELECT 1 FROM public.ordem_compra_fio_movimentos_estoque WHERE ordem_compra_id = p_ordem_id) THEN
    RETURN jsonb_build_object('elegivel', false, 'codigo', 'historico_irreversivel',
      'erro', 'A ordem possui recebimento, lancamento de fio ou movimento de estoque e nao pode ser excluida');
  END IF;

  RETURN jsonb_build_object('elegivel', true, 'codigo', 'ok', 'erro', NULL);
END;
$$;

COMMENT ON FUNCTION public.oc_elegivel_exclusao(BIGINT) IS
  'db/97: UNICO dono da elegibilidade de exclusao de uma Ordem de Compra. Lido pelo escritor public.excluir_ordem_compra e projetado em obter_ordem_compra_admin.acoes.excluir, para que a tela nunca reimplemente a regra.';

ALTER FUNCTION public.oc_elegivel_exclusao(BIGINT) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.oc_elegivel_exclusao(BIGINT)
  FROM PUBLIC, anon, authenticated, service_role;

-- ============================================================
-- 2. O escritor delega a decisao ao dono unico
-- ============================================================
CREATE OR REPLACE FUNCTION public.excluir_ordem_compra(p_ordem_id BIGINT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_ordem        public.ordem_compra%ROWTYPE;
  v_elegivel     JSONB;
  v_necessidades JSONB;
  v_itens        BIGINT;
  v_alocacoes    BIGINT;
  v_eventos      BIGINT;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'sem_permissao',
      'erro', 'Somente administrador autenticado pode excluir uma ordem de compra');
  END IF;

  SELECT * INTO v_ordem FROM public.ordem_compra WHERE id = p_ordem_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'nao_encontrada',
      'erro', 'Ordem de compra nao encontrada');
  END IF;

  -- A decisao e do dono unico; a trava FOR UPDATE acima garante que o estado
  -- lido por ele nao muda entre a verificacao e a exclusao.
  v_elegivel := public.oc_elegivel_exclusao(p_ordem_id);
  IF (v_elegivel->>'elegivel')::boolean IS NOT TRUE THEN
    RETURN jsonb_build_object('ok', false,
      'codigo', v_elegivel->>'codigo', 'erro', v_elegivel->>'erro');
  END IF;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'necessidade_id', n.id, 'material', n.material,
           'kg_necessario', n.kg_necessario, 'kg_alocado_antes', n.kg_alocado,
           'kg_devolvido', s.kg) ORDER BY n.id), '[]'::jsonb)
    INTO v_necessidades
    FROM (SELECT a.necessidade_id AS nid, sum(a.kg_alocado) AS kg
          FROM public.ordem_compra_item_alocacao a
          JOIN public.ordem_compra_item i ON i.id = a.item_id
          WHERE i.ordem_id = p_ordem_id GROUP BY a.necessidade_id) s
    JOIN public.necessidade_compra_fio n ON n.id = s.nid;

  PERFORM set_config('app.oc_exclusao_id', p_ordem_id::text, true);

  WITH alvo AS (
    DELETE FROM public.ordem_compra_item_alocacao a USING public.ordem_compra_item i
    WHERE i.id = a.item_id AND i.ordem_id = p_ordem_id RETURNING a.id
  ) SELECT count(*) INTO v_alocacoes FROM alvo;
  WITH alvo AS (
    DELETE FROM public.ordem_compra_item WHERE ordem_id = p_ordem_id RETURNING id
  ) SELECT count(*) INTO v_itens FROM alvo;
  WITH alvo AS (
    DELETE FROM public.ordem_compra_eventos WHERE ordem_compra_id = p_ordem_id RETURNING id
  ) SELECT count(*) INTO v_eventos FROM alvo;
  DELETE FROM public.ordem_compra WHERE id = p_ordem_id;

  PERFORM set_config('app.oc_exclusao_id', '', true);

  RETURN jsonb_build_object('ok', true, 'codigo', 'ok',
    'ordem_compra_id', p_ordem_id,
    'identidade_operacional', v_ordem.identidade_operacional,
    'codigo_liberado', v_ordem.codigo,
    'status_anterior', v_ordem.status_administrativo,
    'itens_removidos', v_itens, 'alocacoes_liberadas', v_alocacoes,
    'eventos_removidos', v_eventos, 'necessidades_liberadas', v_necessidades);
END;
$$;

ALTER FUNCTION public.excluir_ordem_compra(BIGINT) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.excluir_ordem_compra(BIGINT)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.excluir_ordem_compra(BIGINT) TO authenticated;

-- ============================================================
-- 3. O read model projeta a elegibilidade e a identidade
-- ============================================================
-- Alem de `acoes.excluir`, a projecao passa a carregar `codigo` e
-- `identidade_operacional`: db/77 e anterior a db/95 e nunca expos o nome de
-- negocio da ordem, obrigando a tela a resolve-lo por leitura direta. A tela
-- continua funcionando com o resolvedor atual; esta projecao e o caminho
-- autoritativo para o qual ela pode migrar sem outra migracao.
CREATE OR REPLACE FUNCTION public.obter_ordem_compra_admin(p_ordem_id bigint)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_ordem JSONB; v_eventos JSONB; v_completa BOOLEAN; v_legado BOOLEAN;
  v_status TEXT; v_exige_aceite BOOLEAN; v_excluir BOOLEAN;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'sem_permissao', 'erro', 'Sem permissao');
  END IF;

  SELECT oc.legado, oc.status_administrativo INTO v_legado, v_status
  FROM public.ordem_compra oc WHERE oc.id = p_ordem_id;
  IF v_status IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'nao_encontrada', 'erro', 'Ordem nao encontrada');
  END IF;
  v_completa := public._distribuicao_completa_ordem(p_ordem_id);
  SELECT exige_aceite INTO v_exige_aceite FROM public.ordem_compra_config WHERE id = 1;
  v_exige_aceite := COALESCE(v_exige_aceite, FALSE);
  v_excluir := (public.oc_elegivel_exclusao(p_ordem_id)->>'elegivel')::boolean;

  SELECT jsonb_build_object(
    'ordem_id',              oc.id,
    'codigo',                oc.codigo,
    'identidade_operacional', oc.identidade_operacional,
    'modelo',                CASE WHEN oc.legado THEN 'legado' ELSE 'nativo' END,
    'pedido_id',             oc.pedido_id,
    'fornecedor_id',         oc.fornecedor_id,
    'fornecedor_nome',       f.nome,
    'status_administrativo', oc.status_administrativo,
    'status_aceite',         oc.status_aceite,
    'status_recebimento',    oc.status_recebimento,
    'legado',                oc.legado,
    'legado_provenance',     oc.legado_provenance,
    'emitida_em',            oc.emitida_em,
    'cancelada_em',          oc.cancelada_em,
    'itens_total',           (SELECT count(*) FROM public.ordem_compra_item i WHERE i.ordem_id = oc.id),
    'itens',                 COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'item_id',       i.id,
          'material',      i.material,
          'cor_id',        i.cor_id,
          'cor_poliester', i.cor_poliester,
          'cor_nome',      c.nome,
          'kg_pedido',     i.kg_pedido,
          'kg_recebido',   i.kg_recebido,
          'alocacoes',     (SELECT count(*) FROM public.ordem_compra_item_alocacao a WHERE a.item_id = i.id),
          'kg_alocado',    COALESCE((SELECT SUM(a.kg_alocado) FROM public.ordem_compra_item_alocacao a WHERE a.item_id = i.id), 0)
        ) ORDER BY i.id)
        FROM public.ordem_compra_item i
        LEFT JOIN public.cores c ON c.id = i.cor_id
        WHERE i.ordem_id = oc.id
      ), '[]'::jsonb),
    'acoes',                 CASE
        WHEN oc.legado THEN jsonb_build_object('editar_itens', false, 'remover_itens', false, 'cancelar', false, 'distribuir', false, 'emitir', false, 'receber', false, 'excluir', false)
        WHEN oc.status_administrativo = 'rascunho' THEN jsonb_build_object('editar_itens', true, 'remover_itens', true, 'cancelar', true, 'distribuir', true, 'emitir', (v_completa AND NOT v_exige_aceite), 'receber', false, 'excluir', COALESCE(v_excluir, false))
        ELSE jsonb_build_object('editar_itens', false, 'remover_itens', false, 'cancelar', false, 'distribuir', false, 'emitir', false, 'receber', false, 'excluir', COALESCE(v_excluir, false))
      END,
    'distribuicao_completa', v_completa,
    'pronta_para_emissao',   v_completa,
    'pode_emitir',           (v_completa AND NOT v_exige_aceite),
    'bloqueio_emissao',      CASE WHEN (NOT oc.legado) AND oc.status_administrativo = 'rascunho'
                                  THEN CASE WHEN NOT v_completa THEN 'distribuicao_necessidades_pendente'
                                            WHEN v_exige_aceite THEN 'emissao_bloqueada_exige_aceite'
                                            ELSE NULL END
                                  ELSE NULL END
  )
  INTO v_ordem
  FROM public.ordem_compra oc
  LEFT JOIN public.fornecedores f ON f.id = oc.fornecedor_id
  WHERE oc.id = p_ordem_id;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'id', e.id, 'dimensao', e.dimensao, 'tipo_evento', e.tipo_evento,
      'valor_anterior', e.valor_anterior, 'valor_novo', e.valor_novo, 'criado_em', e.criado_em
    ) ORDER BY e.id), '[]'::jsonb)
  INTO v_eventos
  FROM public.ordem_compra_eventos e
  WHERE e.ordem_compra_id = p_ordem_id;

  RETURN jsonb_build_object('ok', true, 'ordem', v_ordem, 'eventos', v_eventos);
END;
$$;

ALTER FUNCTION public.obter_ordem_compra_admin(BIGINT) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.obter_ordem_compra_admin(BIGINT)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.obter_ordem_compra_admin(BIGINT) TO authenticated;

DO $inv$
BEGIN
  IF to_regprocedure('public.oc_elegivel_exclusao(bigint)') IS NULL THEN
    RAISE EXCEPTION 'db/97 abortada: oc_elegivel_exclusao ausente';
  END IF;
  IF NOT has_function_privilege('authenticated', 'public.obter_ordem_compra_admin(bigint)', 'EXECUTE') THEN
    RAISE EXCEPTION 'db/97 abortada: read model inacessivel ao papel authenticated';
  END IF;
  IF has_function_privilege('anon', 'public.excluir_ordem_compra(bigint)', 'EXECUTE') THEN
    RAISE EXCEPTION 'db/97 abortada: anon nao pode executar o escritor de exclusao';
  END IF;
END
$inv$;

NOTIFY pgrst, 'reload schema';

COMMIT;
