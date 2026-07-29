-- =====================================================================
-- db/94_cliente_pedido_structural_capability.sql
-- PEDIDO-CLIENT-EDITOR-REQUEST-SUBMISSION-R1-C1-SCHEMA — correcao de
-- CAPACIDADE de banco FORWARD-ONLY sobre db/92 e db/93: expoe ao Cliente
-- UMA capacidade estrutural EXATA e sanitizada, calculada pelo gate
-- autoritativo, sem devolver nenhum dado interno de producao.
--
-- Order: PEDIDO-CLIENT-EDITOR-REQUEST-SUBMISSION-R1-C1-SCHEMA.
-- Contract shapes: docs/architecture/PEDIDO_OP_SCHEMA_CONTRACT.md,
--   subsecao "### U16. Client structural capability (db/94)".
-- Forward-only; db/01..db/93 sao INTOCADOS. O guard terminal de migracao
-- avanca 93 -> 94 no mesmo commit (tests/ordem-compra-c3d-deploy.smoke.js).
--
-- O DEFEITO QUE ESTA MIGRACAO FECHA
--   O gate autoritativo de mudanca ESTRUTURAL de item e
--   `public.pedido_tem_op_relacionada(uuid)`. db/93 o deixou OWNER-ONLY: nem
--   `authenticated`, nem `anon`, nem `service_role` executam. Correto e
--   mantido — mas isso deixou o editor do Cliente SEM nenhuma leitura
--   client-safe do gate real.
--
--   Sem esta migracao o Cliente so dispoe de sinais APROXIMADOS. O sinal
--   `chain_state.isOperationalOverride` de `cliente_pedido_summary()` (db/30)
--   NAO e o dono desta capacidade: cobre OP-via-lote e expedicao-via-pedido,
--   e NAO cobre um `op_itens`/`expedicao_itens` vinculado a um item do Pedido
--   sem que a OP ou a expedicao proprietaria identifique o Pedido por si. Uma
--   leitura aproximada que ainda falha ABERTA quando a propria leitura falha
--   nao e uma capacidade: e um palpite.
--
--   A autoridade de recusa sempre foi e continua sendo o servidor
--   (PEDIDO_ALTERACAO_ESTRUTURA_BLOQUEADA_APOS_OP). O que faltava era o
--   Cliente poder DECIDIR, sem aproximacao, se os controles estruturais devem
--   nascer somente-leitura.
--
-- O QUE ESTA MIGRACAO FAZ
--   Substitui o CORPO de `public.cliente_alteracao_resumo(uuid)` — a RPC
--   publica JA sanitizada e JA aceita — acrescentando EXATAMENTE um campo:
--
--     "capacidades": { "estrutura_itens_bloqueada": <boolean> }
--
--   cujo valor e EXATAMENTE `public.pedido_tem_op_relacionada(p_pedido_id)`.
--
--   A RPC e SECURITY DEFINER e executa como o dono, portanto pode chamar o
--   helper owner-only internamente. O helper NAO e aberto a ninguem.
--
-- O QUE ESTA MIGRACAO NAO FAZ
--   * NAO cria uma nona RPC publica. O inventario publico permanece 8.
--   * NAO muda a assinatura: `(p_pedido_id UUID) RETURNS JSONB`.
--   * NAO altera `ok`, `pedido_id`, `pendente`, `historico` nem os objetos de
--     erro existentes.
--   * NAO devolve motivo, tabela de origem, contagem, ID, status, fornecedor,
--     ordem de compra, documento fiscal, custo ou qualquer metadado interno.
--     APENAS um booleano.
--   * NAO expoe a capacidade nas respostas de erro: `PEDIDO_NOT_FOUND` e
--     `FORBIDDEN` mantem a forma existente, sem vazamento.
--   * NAO abre o helper owner-only; NAO muda grant de tabela, politica RLS,
--     Auth, gatilho, indice, nem o corpo de qualquer outra funcao.
--   * NAO cria, altera ou remove nenhuma linha de negocio.
--
-- Idempotente: CREATE OR REPLACE, REVOKE e GRANT nao acumulam objeto nem
-- produzem drift; um replay nao toca dado algum.
-- Depende de db/92 e db/93.
-- =====================================================================

BEGIN;

-- ============================================================
-- 0. GATE DE PRE-REQUISITOS. Falha fechada. NAO repara nada.
-- ============================================================
DO $gate$
DECLARE
  v_missing TEXT[] := ARRAY[]::TEXT[];
  v_role    TEXT;
  v_rpc     OID;
  v_helper  OID;
BEGIN
  -- 0.1 Estrutura de db/92.
  IF to_regclass('public.pedido_alteracao_solicitacoes') IS NULL
    THEN v_missing := array_append(v_missing, 'table public.pedido_alteracao_solicitacoes (db/92)'); END IF;
  IF to_regclass('public.pedido_alteracao_solicitacao_itens') IS NULL
    THEN v_missing := array_append(v_missing, 'table public.pedido_alteracao_solicitacao_itens (db/92)'); END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_schema='public' AND table_name='pedidos' AND column_name='revisao')
    THEN v_missing := array_append(v_missing, 'column public.pedidos.revisao (db/92)'); END IF;

  -- 0.2 A RPC que esta migracao substitui, na assinatura EXATA.
  v_rpc := to_regprocedure('public.cliente_alteracao_resumo(uuid)');
  IF v_rpc IS NULL
    THEN v_missing := array_append(v_missing, 'rpc public.cliente_alteracao_resumo(uuid) (db/92)'); END IF;

  -- 0.3 O gate autoritativo que esta migracao passa a expor.
  v_helper := to_regprocedure('public.pedido_tem_op_relacionada(uuid)');
  IF v_helper IS NULL
    THEN v_missing := array_append(v_missing, 'helper public.pedido_tem_op_relacionada(uuid) (db/92)'); END IF;

  -- 0.4 As duas funcoes de autorizacao que o corpo preservado usa.
  IF to_regprocedure('public.meu_cliente_id()') IS NULL
    THEN v_missing := array_append(v_missing, 'public.meu_cliente_id()'); END IF;
  IF to_regprocedure('public.is_admin()') IS NULL
    THEN v_missing := array_append(v_missing, 'public.is_admin()'); END IF;

  IF array_length(v_missing, 1) > 0 THEN
    RAISE EXCEPTION 'db/94 gate: pre-requisito(s) ausente(s): %. db/92 e db/93 devem estar aplicados; esta migracao NAO repara.',
      array_to_string(v_missing, '; ');
  END IF;

  -- 0.5 ESTADO FINAL DE PRIVILEGIO DE db/93. Esta migracao PRESSUPOE que o
  --     helper e owner-only: e exatamente por isso que a capacidade tem de
  --     viajar pela RPC SECURITY DEFINER. Se o helper estiver aberto, db/93
  --     nao esta aplicado e este nao e o estado que esta correcao assume.
  FOREACH v_role IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
    IF has_function_privilege(v_role, v_helper, 'EXECUTE') THEN
      v_missing := array_append(v_missing,
        'public.pedido_tem_op_relacionada(uuid) executavel por ' || v_role || ' (db/93 ausente)');
    END IF;
  END LOOP;
  IF NOT has_function_privilege('postgres', v_helper, 'EXECUTE') THEN
    v_missing := array_append(v_missing,
      'o dono perdeu EXECUTE em public.pedido_tem_op_relacionada(uuid); a RPC nao poderia chama-lo');
  END IF;

  -- 0.6 A RPC tem de estar no estado publico declarado por db/93.
  IF NOT has_function_privilege('authenticated', v_rpc, 'EXECUTE') THEN
    v_missing := array_append(v_missing,
      'public.cliente_alteracao_resumo(uuid) nao executavel por authenticated (db/93 ausente)');
  END IF;
  IF has_function_privilege('anon', v_rpc, 'EXECUTE') THEN
    v_missing := array_append(v_missing,
      'public.cliente_alteracao_resumo(uuid) executavel por anon (db/93 ausente)');
  END IF;

  IF array_length(v_missing, 1) > 0 THEN
    RAISE EXCEPTION 'db/94 gate: estado de privilegio de db/93 ausente ou divergente: %.',
      array_to_string(v_missing, '; ');
  END IF;
END;
$gate$;

-- ============================================================
-- 1. cliente_alteracao_resumo — MESMA assinatura, MESMOS campos,
--    mais EXATAMENTE `capacidades.estrutura_itens_bloqueada`
-- ============================================================
-- Whitelist EXPLICITA, inalterada: nao devolve OP, lote, fornecedor, ordem de
-- compra, documento fiscal, custo, metadado interno nem `pedidos.numero`.
--
-- `capacidades.estrutura_itens_bloqueada` e o gate autoritativo de db/92,
-- reduzido a UM booleano:
--   false -> nao existe OP relacionada, expedicao relacionada nem vinculo de
--            item de producao. Mudanca estrutural (modelo_id, metros, insercao,
--            remocao) pode ser proposta.
--   true  -> existe ao menos UM vinculo autoritativo. O editor do Cliente tem
--            de renderizar os controles estruturais como somente-leitura.
-- Nenhum motivo, tabela de origem, contagem, ID ou status acompanha o valor.
CREATE OR REPLACE FUNCTION public.cliente_alteracao_resumo(p_pedido_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cliente BIGINT := public.meu_cliente_id();
  v_dono    BIGINT;
  v_admin   BOOLEAN := public.is_admin();
BEGIN
  SELECT cliente_id INTO v_dono FROM public.pedidos WHERE id = p_pedido_id;
  IF v_dono IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'PEDIDO_ALTERACAO_PEDIDO_NOT_FOUND');
  END IF;
  IF NOT v_admin AND (v_cliente IS NULL OR v_dono IS DISTINCT FROM v_cliente) THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'PEDIDO_ALTERACAO_FORBIDDEN');
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'pedido_id', p_pedido_id,
    'pendente', (
      SELECT jsonb_build_object(
               'solicitacao_id', s.id, 'status', s.status,
               'campos_alterados', to_jsonb(s.campos_alterados),
               'itens_propostos', s.itens_propostos,
               'prioridade_proposta', s.proposto_prioridade_habilitada,
               'mensagem', s.mensagem_cliente, 'criado_em', s.criado_em)
        FROM public.pedido_alteracao_solicitacoes s
       WHERE s.pedido_id = p_pedido_id AND s.status = 'pendente'),
    'historico', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'solicitacao_id', s.id, 'status', s.status,
               'criado_em', s.criado_em, 'decidido_em', s.decidido_em,
               'motivo', s.decisao_motivo) ORDER BY s.criado_em DESC)
        FROM public.pedido_alteracao_solicitacoes s
       WHERE s.pedido_id = p_pedido_id AND s.status <> 'pendente'), '[]'::jsonb),
    'capacidades', jsonb_build_object(
      'estrutura_itens_bloqueada', public.pedido_tem_op_relacionada(p_pedido_id)));
END;
$$;

COMMENT ON FUNCTION public.cliente_alteracao_resumo(UUID) IS
  'db/92, estendida por db/94: leitura sanitizada do estado de solicitacao para o Cliente. Whitelist explicita; nenhum dado operacional interno e exposto. `capacidades.estrutura_itens_bloqueada` e o gate autoritativo public.pedido_tem_op_relacionada reduzido a um booleano, sem motivo, origem, contagem, ID nem status.';

-- ============================================================
-- 2. ACL FINAL DECLARADA. Nao herdada, nao presumida.
-- ============================================================
-- CREATE OR REPLACE preserva a ACL existente, mas o estado final e DECLARADO
-- aqui de forma explicita, exatamente como db/93 exige: o projeto Supabase
-- carrega ALTER DEFAULT PRIVILEGES concedendo EXECUTE em funcao nova de
-- `public` a `authenticated` e a `service_role`, e nenhuma migracao desta
-- familia depende disso.
REVOKE EXECUTE ON FUNCTION public.cliente_alteracao_resumo(UUID) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.cliente_alteracao_resumo(UUID) TO authenticated, service_role;

-- O gate autoritativo permanece OWNER-ONLY. Reafirmado explicitamente: a
-- capacidade viaja pela RPC SECURITY DEFINER, NUNCA por execucao direta.
REVOKE EXECUTE ON FUNCTION public.pedido_tem_op_relacionada(UUID) FROM PUBLIC, anon, authenticated, service_role;

-- ============================================================
-- 3. VERIFICACAO FINAL. A migracao prova o proprio resultado.
-- ============================================================
DO $verify$
DECLARE
  v_bad     TEXT[] := ARRAY[]::TEXT[];
  v_role    TEXT;
  v_rpc     OID := to_regprocedure('public.cliente_alteracao_resumo(uuid)');
  v_helper  OID := to_regprocedure('public.pedido_tem_op_relacionada(uuid)');
  v_token   TEXT;
  v_def     TEXT;
  v_proc    pg_proc%ROWTYPE;
  v_publicas INTEGER;
BEGIN
  IF v_rpc IS NULL THEN
    RAISE EXCEPTION 'db/94 verify: a assinatura public.cliente_alteracao_resumo(uuid) desapareceu';
  END IF;

  SELECT * INTO v_proc FROM pg_proc WHERE oid = v_rpc;

  -- 3.1 A assinatura e o contorno de seguranca sao EXATAMENTE os aceitos.
  IF pg_get_function_identity_arguments(v_rpc) <> 'p_pedido_id uuid' THEN
    v_bad := array_append(v_bad, 'argumentos mudaram: ' || pg_get_function_identity_arguments(v_rpc));
  END IF;
  IF pg_get_function_result(v_rpc) <> 'jsonb' THEN
    v_bad := array_append(v_bad, 'tipo de retorno mudou: ' || pg_get_function_result(v_rpc));
  END IF;
  IF NOT v_proc.prosecdef THEN
    v_bad := array_append(v_bad, 'a RPC deixou de ser SECURITY DEFINER');
  END IF;
  IF v_proc.provolatile <> 's' THEN
    v_bad := array_append(v_bad, 'a RPC deixou de ser STABLE');
  END IF;
  IF NOT (COALESCE(v_proc.proconfig, ARRAY[]::TEXT[]) @> ARRAY['search_path=public']) THEN
    v_bad := array_append(v_bad, 'a RPC nao fixa search_path=public');
  END IF;

  -- 3.2 O campo de capacidade EXISTE e e calculado pelo gate autoritativo.
  v_def := pg_get_functiondef(v_rpc);
  IF position('''capacidades''' IN v_def) = 0 THEN
    v_bad := array_append(v_bad, 'o corpo nao declara a chave capacidades');
  END IF;
  IF position('''estrutura_itens_bloqueada''' IN v_def) = 0 THEN
    v_bad := array_append(v_bad, 'o corpo nao declara estrutura_itens_bloqueada');
  END IF;
  IF position('public.pedido_tem_op_relacionada(p_pedido_id)' IN v_def) = 0 THEN
    v_bad := array_append(v_bad, 'a capacidade nao e calculada por public.pedido_tem_op_relacionada(p_pedido_id)');
  END IF;

  -- 3.3 Os campos preexistentes continuam presentes no corpo.
  FOREACH v_token IN ARRAY ARRAY['''ok''', '''pedido_id''', '''pendente''', '''historico''',
                                 '''PEDIDO_ALTERACAO_PEDIDO_NOT_FOUND''', '''PEDIDO_ALTERACAO_FORBIDDEN'''] LOOP
    IF position(v_token IN v_def) = 0 THEN
      v_bad := array_append(v_bad, 'campo/erro preexistente ausente do corpo: ' || v_token);
    END IF;
  END LOOP;

  -- 3.4 A capacidade NAO pode acompanhar uma resposta de erro. Os dois ramos de
  --     erro tem de continuar sendo EXATAMENTE {ok:false, erro:<id>}: a forma
  --     literal e verificada, nao inferida.
  FOREACH v_token IN ARRAY ARRAY['PEDIDO_ALTERACAO_PEDIDO_NOT_FOUND',
                                 'PEDIDO_ALTERACAO_FORBIDDEN'] LOOP
    IF position('jsonb_build_object(''ok'', false, ''erro'', ''' || v_token || ''')' IN v_def) = 0 THEN
      v_bad := array_append(v_bad,
        'o ramo de erro ' || v_token || ' deve permanecer exatamente {ok:false, erro:<id>}');
    END IF;
  END LOOP;

  -- 3.5 ACL da RPC.
  IF NOT has_function_privilege('authenticated', v_rpc, 'EXECUTE') THEN
    v_bad := array_append(v_bad, 'RPC sem authenticated');
  END IF;
  IF NOT has_function_privilege('service_role', v_rpc, 'EXECUTE') THEN
    v_bad := array_append(v_bad, 'RPC sem service_role');
  END IF;
  IF has_function_privilege('anon', v_rpc, 'EXECUTE') THEN
    v_bad := array_append(v_bad, 'RPC com anon');
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc p, aclexplode(p.proacl) a
              WHERE p.oid = v_rpc AND a.grantee = 0 AND a.privilege_type = 'EXECUTE') THEN
    v_bad := array_append(v_bad, 'RPC com EXECUTE para PUBLIC');
  END IF;

  -- 3.6 O gate autoritativo permanece OWNER-ONLY.
  FOREACH v_role IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
    IF has_function_privilege(v_role, v_helper, 'EXECUTE') THEN
      v_bad := array_append(v_bad, 'helper executavel por ' || v_role);
    END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM pg_proc p, aclexplode(p.proacl) a
              WHERE p.oid = v_helper AND a.grantee = 0 AND a.privilege_type = 'EXECUTE') THEN
    v_bad := array_append(v_bad, 'helper com EXECUTE para PUBLIC');
  END IF;
  IF NOT has_function_privilege('postgres', v_helper, 'EXECUTE') THEN
    v_bad := array_append(v_bad, 'dono perdeu EXECUTE no helper');
  END IF;

  -- 3.7 NAO existe uma nona RPC publica. O inventario permanece 8.
  SELECT count(*) INTO v_publicas
    FROM pg_proc p
   WHERE p.pronamespace = 'public'::regnamespace
     AND p.proname IN ('salvar_pedido_cliente','salvar_pedido_admin',
                       'solicitar_alteracao_pedido','retirar_alteracao_pedido',
                       'aprovar_alteracao_pedido','rejeitar_alteracao_pedido',
                       'cliente_alteracao_resumo','admin_alteracao_comparacao');
  IF v_publicas <> 8 THEN
    v_bad := array_append(v_bad, 'o inventario publico deve permanecer 8 (got ' || v_publicas || ')');
  END IF;

  IF array_length(v_bad, 1) > 0 THEN
    RAISE EXCEPTION 'db/94 verify: resultado incorreto: %', array_to_string(v_bad, '; ');
  END IF;
END;
$verify$;

-- ============================================================
-- 4. Reload PostgREST
-- ============================================================
NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';

COMMIT;
