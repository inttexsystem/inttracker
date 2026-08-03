-- =====================================================================
-- db/122 — A CORREÇÃO ADMINISTRATIVA PASSA A EXISTIR NA HISTÓRIA DO PRODUTO
-- BACKLOG-7 PHASE 4 COMPLETION
-- =====================================================================
--
-- DEFEITO CORRIGIDO.
--
-- db/119 criou public.ordem_compra_recebimento_metadados_correcoes e grava lá,
-- a cada correção administrativa de metadados de recebimento, a IMAGEM
-- COMPLETA antes/depois dos quatro campos corrigíveis (ocorrido_em,
-- documento_ref, origem_tipo, origem_ref), mais o ator e o instante.
--
-- Mas db/119 NÃO redefiniu o read model. public.obter_historico_recebimento_
-- ordem_compra é de db/100, portanto ANTERIOR a db/119, e nunca soube dessa
-- tabela. E a tabela é, deliberadamente, inalcançável por qualquer cliente:
-- tem RLS activo e TODOS os privilégios revogados de PUBLIC, anon,
-- authenticated E service_role (db/119 §166-174).
--
-- O resultado é uma LACUNA DE AUDITORIA: uma correção administrativa pode
-- existir no sistema — e a data de negócio de um recebimento real pode ter sido
-- alterada — sem que nada disso seja visível na história do produto. Foi
-- exactamente o que aconteceu em OC-001-4-26, cuja data foi corrigida de
-- 02/08/2026 para 04/06/2026 sem deixar rasto visível na tela.
--
-- FORMA DA CORREÇÃO, E PORQUÊ ESTA.
--
-- NENHUM PRIVILÉGIO NOVO É CONCEDIDO SOBRE A TABELA. Ela continua com RLS
-- activo e continua revogada de PUBLIC, anon, authenticated e service_role.
-- Expor a história NÃO pode ser feito enfraquecendo o contentor: seria trocar
-- uma lacuna de auditoria por uma superfície de acesso directo.
--
-- Em vez disso o READ MODEL passa a projectá-la. public.obter_historico_
-- recebimento_ordem_compra já é SECURITY DEFINER, já é propriedade de postgres,
-- já tem `SET search_path = ''` e — o ponto decisivo — JÁ FAZ A AUTORIZAÇÃO:
-- recusa com `sem_permissao` quem não for administrador activo ou o fornecedor
-- correspondente àquela ordem. Acrescentar uma projecção a uma função que já
-- decide quem pode ler não move a fronteira de segurança um milímetro: o
-- mesmo chamador que já podia ler os comandos e os lançamentos daquela ordem
-- passa a poder ler as correcções DA MESMA ORDEM, e mais ninguém.
--
-- O ATOR NÃO VIAJA COMO UUID. A tabela guarda ator_id (auth.users). Devolver
-- esse UUID seria publicar um identificador de autenticação numa superfície
-- operacional e, pior, torná-lo a narrativa. É resolvido para o TIPO do ator
-- (`admin` / `fornecedor`) por public.usuarios — exactamente as colunas que
-- esta mesma função já lê para decidir a permissão — e é esse vocabulário, já
-- aceite, que a tela traduz para "Administrador" / "Fornecedor". Nenhum UUID,
-- nenhum nome pessoal, nenhuma chave primária de auth atravessa a fronteira.
--
-- `criado_em` PASSA A VIAJAR EM CADA COMANDO. A linha do tempo precisa de
-- intercalar dois fluxos — comandos e correcções — numa só ordem cronológica.
-- Os comandos já são devolvidos por `ORDER BY h.criado_em, h.id`, mas o cliente
-- não recebia esse relógio e só via `ocorrido_em`, que é a data DE NEGÓCIO e
-- que uma correcção pode justamente alterar. Sem o relógio de registo, uma
-- correcção que recua a data de negócio faria a narrativa saltar para trás.
-- `criado_em` é imutável e monotónico, e é por ele que a intercalação é feita.
--
-- ADITIVO, NUNCA SUBTRACTIVO. Nenhuma chave existente do JSON muda de nome, de
-- tipo ou de semântica; nenhuma é removida. Um cliente que não conheça
-- `correcoes` nem `criado_em` continua a funcionar exactamente como antes.
--
-- SEM DDL, SEM DML, SEM DADOS TOCADOS. Esta migração substitui UMA função de
-- leitura. Não cria, altera ou apaga tabela, coluna, índice, política, trigger
-- ou linha nenhuma, e não altera a contabilidade de recebimento: kg_pedido,
-- kg_recebido, kg_restante, kg_excesso, kg_reversivel e o sinal de cada
-- lançamento continuam a ser calculados exactamente como db/100 os calculava.
--
-- REVERSÃO. Reaplicar o corpo de db/100 sobre esta função restaura o estado
-- anterior; não há estado persistido para desfazer.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.obter_historico_recebimento_ordem_compra(p_ordem_id BIGINT)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_order public.ordem_compra%ROWTYPE;
  v_user RECORD;
  v_is_admin BOOLEAN;
  v_is_supplier BOOLEAN;
  v_cutover RECORD;
  v_canonico BOOLEAN;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'sem_permissao');
  END IF;
  SELECT * INTO v_order FROM public.ordem_compra WHERE id = p_ordem_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'ordem_nao_encontrada');
  END IF;
  SELECT u.tipo, u.ativo, u.fornecedor_id INTO v_user
  FROM public.usuarios u WHERE u.id = auth.uid();
  v_is_admin := COALESCE(v_user.ativo IS TRUE AND v_user.tipo = 'admin' AND public.is_admin(), FALSE);
  v_is_supplier := COALESCE(v_user.ativo IS TRUE AND v_user.tipo = 'fornecedor'
    AND v_user.fornecedor_id IS NOT NULL
    AND v_user.fornecedor_id = v_order.fornecedor_id, FALSE);
  IF NOT v_is_admin AND NOT v_is_supplier THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'sem_permissao');
  END IF;

  -- Estado do cutover, fail closed: ausente ou ilegivel significa INATIVO.
  SELECT c.status, c.read_authority INTO v_cutover
  FROM public.ordem_compra_cutover c WHERE c.id = 1;
  v_canonico := COALESCE(v_cutover.status = 'canonical_active'
                     AND v_cutover.read_authority = 'canonical', FALSE);

  RETURN jsonb_build_object(
    'ok', true,
    'codigo', 'ok',
    'ordem_compra_id', v_order.id,
    'status_administrativo', v_order.status_administrativo,
    'status_aceite', v_order.status_aceite,
    'status_recebimento', v_order.status_recebimento,
    'ator_tipo', CASE WHEN v_is_admin THEN 'admin' ELSE 'fornecedor' END,
    'recebimento_canonico_ativo', v_canonico,
    'bloqueio_recebimento', CASE WHEN v_canonico THEN NULL ELSE 'recebimento_canonico_inativo' END,
    'acoes', jsonb_build_object(
      'receber', (v_canonico AND NOT v_order.legado AND v_order.status_administrativo = 'emitida'
        AND v_order.status_aceite IN ('nao_aplicavel', 'aceita')),
      'estornar', (v_is_admin AND EXISTS (
        SELECT 1
        FROM public.ordem_compra_fio_lancamentos p
        WHERE p.ordem_compra_id = v_order.id AND p.tipo = 'recebimento'
          AND p.recebimento_id IS NOT NULL
          AND p.kg_recebido + COALESCE((
            SELECT SUM(r.kg_recebido)
            FROM public.ordem_compra_fio_lancamentos r
            WHERE r.estorno_de_id = p.id
          ), 0) > 0
      ))
    ),
    'itens', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'item_id', i.id,
        'material', i.material,
        'cor_id', i.cor_id,
        'cor_poliester', i.cor_poliester,
        'kg_pedido', i.kg_pedido,
        'kg_recebido', i.kg_recebido,
        'kg_restante', GREATEST(i.kg_pedido - i.kg_recebido, 0),
        'kg_excesso', COALESCE((
          SELECT SUM(l.kg_excesso)
          FROM public.ordem_compra_fio_lancamentos l
          WHERE l.ordem_compra_item_id = i.id AND l.recebimento_id IS NOT NULL
        ), 0),
        'alocacoes', COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'alocacao_id', a.id,
            'op_id', a.op_id,
            'kg_alocado', a.kg_alocado,
            'kg_recebido', COALESCE((
              SELECT SUM(l.kg_recebido)
              FROM public.ordem_compra_fio_lancamentos l
              WHERE l.ordem_compra_item_alocacao_id = a.id
            ), 0),
            'kg_restante', a.kg_alocado - COALESCE((
              SELECT SUM(l.kg_recebido)
              FROM public.ordem_compra_fio_lancamentos l
              WHERE l.ordem_compra_item_alocacao_id = a.id
            ), 0)
          ) ORDER BY a.id)
          FROM public.ordem_compra_item_alocacao a WHERE a.item_id = i.id
        ), '[]'::jsonb)
      ) ORDER BY i.id)
      FROM public.ordem_compra_item i WHERE i.ordem_id = v_order.id
    ), '[]'::jsonb),
    'comandos', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', h.id,
        'comando_tipo', h.comando_tipo,
        'ator_tipo', h.ator_tipo,
        'ocorrido_em', h.ocorrido_em,
        -- db/122: o relogio de REGISTO, imutavel, ao lado da data de NEGOCIO.
        -- E por ele que a linha do tempo intercala comandos e correcoes; nunca
        -- substitui `ocorrido_em`, que continua a ser o que a tela mostra.
        'criado_em', h.criado_em,
        'documento_ref', h.documento_ref,
        'origem_tipo', h.origem_tipo,
        'origem_ref', h.origem_ref,
        'lancamentos', COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'id', l.id,
            'linha_indice', l.linha_indice,
            'item_id', l.ordem_compra_item_id,
            'alocacao_id', l.ordem_compra_item_alocacao_id,
            'op_id', l.op_id,
            'material', l.material,
            'cor_id', l.cor_id,
            'cor_poliester', l.cor_poliester,
            'kg', l.kg_recebido,
            'kg_excesso', l.kg_excesso,
            'estorno_de_id', l.estorno_de_id,
            'kg_reversivel', CASE WHEN l.tipo = 'recebimento' THEN
              l.kg_recebido + COALESCE((
                SELECT SUM(r.kg_recebido) FROM public.ordem_compra_fio_lancamentos r
                WHERE r.estorno_de_id = l.id
              ), 0) ELSE 0 END,
            'movimento_estoque', CASE WHEN m.id IS NULL THEN NULL ELSE jsonb_build_object(
              'id', m.id,
              'kg_excedente_delta', m.kg_excedente_delta,
              'excesso_antes', m.excesso_antes,
              'excesso_depois', m.excesso_depois
            ) END
          ) ORDER BY l.linha_indice)
          FROM public.ordem_compra_fio_lancamentos l
          LEFT JOIN public.ordem_compra_fio_movimentos_estoque m ON m.lancamento_id = l.id
          WHERE l.recebimento_id = h.id
        ), '[]'::jsonb)
      ) ORDER BY h.criado_em, h.id)
      FROM public.ordem_compra_recebimentos h WHERE h.ordem_compra_id = v_order.id
    ), '[]'::jsonb),
    -- db/122: AS CORRECOES ADMINISTRATIVAS, finalmente alcancaveis.
    --
    -- A tabela permanece revogada de todos os papeis e com RLS activo; e ESTA
    -- funcao, SECURITY DEFINER e ja portadora da decisao de permissao acima,
    -- que a le em nome do chamador autorizado. O ator viaja como TIPO, nunca
    -- como o UUID de auth.users que a tabela guarda.
    'correcoes', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', k.id,
        'recebimento_id', k.recebimento_id,
        'corrigido_em', k.corrigido_em,
        'ator_tipo', (SELECT au.tipo FROM public.usuarios au WHERE au.id = k.ator_id),
        'ocorrido_em_antes', k.ocorrido_em_antes,
        'ocorrido_em_depois', k.ocorrido_em_depois,
        'documento_ref_antes', k.documento_ref_antes,
        'documento_ref_depois', k.documento_ref_depois,
        'origem_tipo_antes', k.origem_tipo_antes,
        'origem_tipo_depois', k.origem_tipo_depois,
        'origem_ref_antes', k.origem_ref_antes,
        'origem_ref_depois', k.origem_ref_depois
      ) ORDER BY k.corrigido_em, k.id)
      FROM public.ordem_compra_recebimento_metadados_correcoes k
      WHERE k.ordem_compra_id = v_order.id
    ), '[]'::jsonb)
  );
END;
$$;

COMMENT ON FUNCTION public.obter_historico_recebimento_ordem_compra(BIGINT) IS
  'PHASE-C2 + db/100 + db/122: read model de verificacao de recebimento para administrador ativo ou fornecedor correspondente. db/100 subordina acoes.receber ao cutover canonico (ordem_compra_cutover status=canonical_active E read_authority=canonical) e devolve o bloqueador servidor recebimento_canonico_inativo enquanto ele nao vale. O fence do escritor (db/75/db/76) e independente e permanece inalterado. db/122 acrescenta, de forma puramente aditiva, o relogio de registo criado_em em cada comando e o array correcoes com a imagem antes/depois de cada correcao administrativa de metadados (db/119), lida por esta funcao SECURITY DEFINER sem conceder nenhum privilegio novo sobre public.ordem_compra_recebimento_metadados_correcoes, que permanece com RLS activo e revogada de PUBLIC, anon, authenticated e service_role. O ator da correcao viaja como TIPO resolvido por public.usuarios, nunca como o UUID de auth.users.';

-- Estado de privilegio DECLARADO EXPLICITAMENTE, nunca herdado do default
-- `authenticated` do Supabase — o mesmo criterio que db/93 tornou obrigatorio.
-- CREATE OR REPLACE preserva a ACL existente; estas linhas tornam o estado
-- final verificavel em vez de presumido, e sao identicas as de db/100.
ALTER FUNCTION public.obter_historico_recebimento_ordem_compra(BIGINT) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.obter_historico_recebimento_ordem_compra(BIGINT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.obter_historico_recebimento_ordem_compra(BIGINT) FROM anon;
REVOKE ALL ON FUNCTION public.obter_historico_recebimento_ordem_compra(BIGINT) FROM service_role;
GRANT EXECUTE ON FUNCTION public.obter_historico_recebimento_ordem_compra(BIGINT) TO authenticated;
