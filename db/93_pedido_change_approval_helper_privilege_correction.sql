-- =====================================================================
-- db/93_pedido_change_approval_helper_privilege_correction.sql
-- PEDIDO-UNIFIED-EDIT-CHANGE-APPROVAL-SCHEMA-R1-C1 — correcao de seguranca
-- FORWARD-ONLY sobre db/92: remove a execucao direta das funcoes internas
-- por qualquer papel de aplicacao.
--
-- Order: PEDIDO-UNIFIED-EDIT-CHANGE-APPROVAL-SCHEMA-R1-C1.
-- Contract shapes: docs/architecture/PEDIDO_OP_SCHEMA_CONTRACT.md,
--   subsecao "### U15. Security correction C1".
-- Forward-only; db/01..db/92 sao INTOCADOS. O guard terminal de migracao
-- avanca 92 -> 93 no mesmo commit (tests/ordem-compra-c3d-deploy.smoke.js).
--
-- O DEFEITO QUE ESTA MIGRACAO FECHA
--   db/92 chamou 14 funcoes de "helpers internos" mas nao removeu o privilegio
--   de execucao de `authenticated`. O projeto Supabase carrega
--   ALTER DEFAULT PRIVILEGES concedendo EXECUTE em TODA funcao nova de `public`
--   a `authenticated` e a `service_role`. db/92 revogou apenas de PUBLIC e de
--   anon — e em tres casos AINDA concedeu explicitamente a `authenticated`.
--   Resultado medido em producao antes desta correcao: as 22 funcoes de db/92
--   tinham `authenticated=X/postgres` na ACL, ou seja, TODAS as 14 internas
--   eram diretamente invocaveis por qualquer usuario autenticado.
--
--   Como quase todas sao SECURITY DEFINER e NENHUMA delas faz verificacao de
--   chamador — a autorizacao vive nas oito RPC publicas —, a exposicao nao era
--   apenas de leitura:
--
--     LEITURA ENTRE INQUILINOS
--       pedido_snapshot(uuid)                   -> Pedido completo + itens
--       pedido_tem_op_relacionada(uuid)         -> existencia de producao
--       pedido_item_tem_vinculo_producao(uuid)  -> vinculo de item
--       pedido_itens_sequencia(uuid)            -> ids de itens
--       pedido_itens_payload_normalizar(...)    -> validacao contra itens alheios
--       pedido_itens_payload_e_estrutural(...)  -> comparacao com itens alheios
--
--     ESCRITA ENTRE INQUILINOS (severidade maior)
--       pedido_header_aplicar(uuid, jsonb)      -> UPDATE do cabecalho de
--                                                  QUALQUER Pedido
--       pedido_itens_reconciliar(uuid, jsonb)   -> INSERT/UPDATE/DELETE da
--                                                  colecao de itens de QUALQUER
--                                                  Pedido
--       pedido_prioridade_aplicar(...)          -> prioridade de QUALQUER Pedido
--
--   A RLS de `pedidos` e `pedido_itens` NAO protegia nada disso, porque
--   SECURITY DEFINER executa como o dono `postgres` e ignora a politica.
--
-- O QUE ESTA MIGRACAO FAZ
--   Declara EXPLICITAMENTE o estado final de privilegio das 22 funcoes de
--   db/92. Nao depende de default privileges para nada.
--     * 8 RPC publicas: PUBLIC e anon revogados; authenticated concedido;
--       service_role concedido explicitamente como infraestrutura.
--     * 14 funcoes internas: PUBLIC, anon, authenticated e service_role
--       revogados. Nenhum papel de aplicacao executa diretamente.
--   O DONO (`postgres`) mantem execucao, entao as RPC SECURITY DEFINER
--   continuam chamando os helpers normalmente, e os gatilhos continuam
--   disparando: o PostgreSQL verifica EXECUTE de funcao de gatilho na CRIACAO
--   do gatilho, nao a cada disparo.
--
-- O QUE ESTA MIGRACAO NAO FAZ
--   Nenhuma tabela, coluna, politica, gatilho, indice ou CORPO de funcao muda.
--   Nenhum GRANT de tabela muda. Nenhuma linha de negocio, de solicitacao, de
--   OP, de Pedido ou de evento e criada, alterada ou removida.
--
-- Idempotente: REVOKE e GRANT sao idempotentes por natureza; um replay nao
-- produz efeito cumulativo nem drift.
-- Depende de db/92.
-- =====================================================================

BEGIN;

-- ============================================================
-- 0. GATE DE PRE-REQUISITOS. Falha fechada. NAO repara nada.
-- ============================================================
DO $gate$
DECLARE
  v_missing TEXT[] := ARRAY[]::TEXT[];
  v_sig     TEXT;
  v_publicas TEXT[] := ARRAY[
    'public.salvar_pedido_cliente(uuid,bigint,jsonb,jsonb,boolean)',
    'public.salvar_pedido_admin(uuid,bigint,jsonb,jsonb,boolean,boolean)',
    'public.solicitar_alteracao_pedido(uuid,jsonb,jsonb,boolean,text)',
    'public.retirar_alteracao_pedido(uuid)',
    'public.aprovar_alteracao_pedido(uuid,boolean,text)',
    'public.rejeitar_alteracao_pedido(uuid,text)',
    'public.cliente_alteracao_resumo(uuid)',
    'public.admin_alteracao_comparacao(uuid)'
  ];
  v_internas TEXT[] := ARRAY[
    'public.pedidos_revisao_normalize_fn()',
    'public.pedido_itens_revisao_bump_fn()',
    'public.pedido_tem_op_relacionada(uuid)',
    'public.pedido_item_tem_vinculo_producao(uuid)',
    'public.pedido_alteracao_imutabilidade_guard_fn()',
    'public.pedido_alteracao_itens_imutabilidade_guard_fn()',
    'public.pedido_snapshot(uuid)',
    'public.pedido_itens_payload_normalizar(uuid,jsonb)',
    'public.pedido_itens_payload_e_estrutural(uuid,jsonb)',
    'public.pedido_itens_reconciliar(uuid,jsonb)',
    'public.pedido_itens_sequencia(uuid)',
    'public.pedido_header_validar(jsonb,text)',
    'public.pedido_header_aplicar(uuid,jsonb)',
    'public.pedido_prioridade_aplicar(uuid,boolean,boolean)'
  ];
  v_total INTEGER;
BEGIN
  -- Objetos estruturais de db/92.
  IF to_regclass('public.pedido_alteracao_solicitacoes') IS NULL
    THEN v_missing := array_append(v_missing, 'table public.pedido_alteracao_solicitacoes (db/92)'); END IF;
  IF to_regclass('public.pedido_alteracao_solicitacao_itens') IS NULL
    THEN v_missing := array_append(v_missing, 'table public.pedido_alteracao_solicitacao_itens (db/92)'); END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_schema='public' AND table_name='pedidos' AND column_name='revisao')
    THEN v_missing := array_append(v_missing, 'column public.pedidos.revisao (db/92)'); END IF;

  -- As oito RPC publicas.
  FOREACH v_sig IN ARRAY v_publicas LOOP
    IF to_regprocedure(v_sig) IS NULL THEN
      v_missing := array_append(v_missing, 'rpc ' || v_sig);
    END IF;
  END LOOP;

  -- As catorze funcoes internas.
  FOREACH v_sig IN ARRAY v_internas LOOP
    IF to_regprocedure(v_sig) IS NULL THEN
      v_missing := array_append(v_missing, 'helper ' || v_sig);
    END IF;
  END LOOP;

  -- pedido_snapshot tem de ser SECURITY DEFINER: e o que torna a exposicao
  -- real e o que esta correcao pressupoe.
  IF to_regprocedure('public.pedido_snapshot(uuid)') IS NOT NULL
     AND NOT (SELECT prosecdef FROM pg_proc WHERE oid = to_regprocedure('public.pedido_snapshot(uuid)')) THEN
    v_missing := array_append(v_missing, 'public.pedido_snapshot(uuid) deveria ser SECURITY DEFINER');
  END IF;

  IF array_length(v_missing, 1) > 0 THEN
    RAISE EXCEPTION 'db/93 gate: pre-requisito(s) ausente(s): %. db/92 deve estar aplicado; esta migracao NAO repara.',
      array_to_string(v_missing, '; ');
  END IF;

  -- O inventario de db/92 e EXATAMENTE 22 funcoes. Uma funcao de apoio nova e
  -- desconhecida invalidaria a lista de negacao desta correcao.
  SELECT count(*) INTO v_total
    FROM pg_proc p
   WHERE p.pronamespace='public'::regnamespace
     AND (p.oid = ANY (SELECT to_regprocedure(s)::oid FROM unnest(v_publicas) s)
       OR p.oid = ANY (SELECT to_regprocedure(s)::oid FROM unnest(v_internas) s));
  IF v_total <> 22 THEN
    RAISE EXCEPTION 'db/93 gate: o inventario de db/92 deve resolver exatamente 22 funcoes (got %)', v_total;
  END IF;
END;
$gate$;

-- ============================================================
-- 1. AS OITO RPC PUBLICAS — estado final DECLARADO, nao herdado
-- ============================================================
-- Nenhuma depende de default privileges. `service_role` e concedido
-- explicitamente como infraestrutura privilegiada; o corpo de cada funcao
-- continua exigindo um JWT real de admin ou de cliente.

REVOKE EXECUTE ON FUNCTION public.salvar_pedido_cliente(UUID, BIGINT, JSONB, JSONB, BOOLEAN) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.salvar_pedido_cliente(UUID, BIGINT, JSONB, JSONB, BOOLEAN) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.salvar_pedido_admin(UUID, BIGINT, JSONB, JSONB, BOOLEAN, BOOLEAN) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.salvar_pedido_admin(UUID, BIGINT, JSONB, JSONB, BOOLEAN, BOOLEAN) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.solicitar_alteracao_pedido(UUID, JSONB, JSONB, BOOLEAN, TEXT) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.solicitar_alteracao_pedido(UUID, JSONB, JSONB, BOOLEAN, TEXT) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.retirar_alteracao_pedido(UUID) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.retirar_alteracao_pedido(UUID) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.aprovar_alteracao_pedido(UUID, BOOLEAN, TEXT) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.aprovar_alteracao_pedido(UUID, BOOLEAN, TEXT) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.rejeitar_alteracao_pedido(UUID, TEXT) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.rejeitar_alteracao_pedido(UUID, TEXT) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.cliente_alteracao_resumo(UUID) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.cliente_alteracao_resumo(UUID) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.admin_alteracao_comparacao(UUID) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.admin_alteracao_comparacao(UUID) TO authenticated, service_role;

-- ============================================================
-- 2. AS CATORZE FUNCOES INTERNAS — SOMENTE O DONO
-- ============================================================
-- `authenticated` e `service_role` sao revogados EXPLICITAMENTE: o default
-- privilege do projeto os concede, e revogar apenas PUBLIC e anon — o que
-- db/92 fez — deixa a funcao aberta. O dono `postgres` mantem execucao, entao
-- as RPC SECURITY DEFINER e os gatilhos continuam funcionando.

-- 2.1 Funcoes de gatilho.
REVOKE EXECUTE ON FUNCTION public.pedidos_revisao_normalize_fn() FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.pedido_itens_revisao_bump_fn() FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.pedido_alteracao_imutabilidade_guard_fn() FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.pedido_alteracao_itens_imutabilidade_guard_fn() FROM PUBLIC, anon, authenticated, service_role;

-- 2.2 Leitura de impacto e de estado. Vazavam existencia e composicao de
--     Pedido alheio a qualquer autenticado.
REVOKE EXECUTE ON FUNCTION public.pedido_tem_op_relacionada(UUID) FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.pedido_item_tem_vinculo_producao(UUID) FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.pedido_snapshot(UUID) FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.pedido_itens_sequencia(UUID) FROM PUBLIC, anon, authenticated, service_role;

-- 2.3 Validacao de payload. Leem itens do Pedido informado.
REVOKE EXECUTE ON FUNCTION public.pedido_itens_payload_normalizar(UUID, JSONB) FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.pedido_itens_payload_e_estrutural(UUID, JSONB) FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.pedido_header_validar(JSONB, TEXT) FROM PUBLIC, anon, authenticated, service_role;

-- 2.4 PRIMITIVAS DE MUTACAO. Estas eram a exposicao grave: escrita direta em
--     cabecalho, colecao de itens e prioridade de QUALQUER Pedido, sem
--     nenhuma verificacao de chamador e ignorando RLS.
REVOKE EXECUTE ON FUNCTION public.pedido_header_aplicar(UUID, JSONB) FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.pedido_itens_reconciliar(UUID, JSONB) FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.pedido_prioridade_aplicar(UUID, BOOLEAN, BOOLEAN) FROM PUBLIC, anon, authenticated, service_role;

COMMENT ON FUNCTION public.pedido_snapshot(UUID) IS
  'db/92, restrito por db/93: helper INTERNO. SECURITY DEFINER e sem verificacao de chamador; a autorizacao pertence as RPC publicas. NENHUM papel de aplicacao tem EXECUTE. Nao conceder.';
COMMENT ON FUNCTION public.pedido_header_aplicar(UUID, JSONB) IS
  'db/92, restrito por db/93: helper INTERNO de MUTACAO. Sem verificacao de chamador. NENHUM papel de aplicacao tem EXECUTE. Nao conceder.';
COMMENT ON FUNCTION public.pedido_itens_reconciliar(UUID, JSONB) IS
  'db/92, restrito por db/93: helper INTERNO de MUTACAO. Sem verificacao de chamador. NENHUM papel de aplicacao tem EXECUTE. Nao conceder.';

-- ============================================================
-- 3. VERIFICACAO FINAL. A migracao prova o proprio resultado.
-- ============================================================
DO $verify$
DECLARE
  v_sig  TEXT;
  v_role TEXT;
  v_bad  TEXT[] := ARRAY[]::TEXT[];
  v_publicas TEXT[] := ARRAY[
    'public.salvar_pedido_cliente(uuid,bigint,jsonb,jsonb,boolean)',
    'public.salvar_pedido_admin(uuid,bigint,jsonb,jsonb,boolean,boolean)',
    'public.solicitar_alteracao_pedido(uuid,jsonb,jsonb,boolean,text)',
    'public.retirar_alteracao_pedido(uuid)',
    'public.aprovar_alteracao_pedido(uuid,boolean,text)',
    'public.rejeitar_alteracao_pedido(uuid,text)',
    'public.cliente_alteracao_resumo(uuid)',
    'public.admin_alteracao_comparacao(uuid)'
  ];
  v_internas TEXT[] := ARRAY[
    'public.pedidos_revisao_normalize_fn()',
    'public.pedido_itens_revisao_bump_fn()',
    'public.pedido_tem_op_relacionada(uuid)',
    'public.pedido_item_tem_vinculo_producao(uuid)',
    'public.pedido_alteracao_imutabilidade_guard_fn()',
    'public.pedido_alteracao_itens_imutabilidade_guard_fn()',
    'public.pedido_snapshot(uuid)',
    'public.pedido_itens_payload_normalizar(uuid,jsonb)',
    'public.pedido_itens_payload_e_estrutural(uuid,jsonb)',
    'public.pedido_itens_reconciliar(uuid,jsonb)',
    'public.pedido_itens_sequencia(uuid)',
    'public.pedido_header_validar(jsonb,text)',
    'public.pedido_header_aplicar(uuid,jsonb)',
    'public.pedido_prioridade_aplicar(uuid,boolean,boolean)'
  ];
BEGIN
  -- Publicas: authenticated PODE; PUBLIC e anon NAO.
  FOREACH v_sig IN ARRAY v_publicas LOOP
    IF NOT has_function_privilege('authenticated', to_regprocedure(v_sig)::oid, 'EXECUTE') THEN
      v_bad := array_append(v_bad, 'RPC sem authenticated: ' || v_sig);
    END IF;
    IF has_function_privilege('anon', to_regprocedure(v_sig)::oid, 'EXECUTE') THEN
      v_bad := array_append(v_bad, 'RPC com anon: ' || v_sig);
    END IF;
  END LOOP;

  -- Internas: NENHUM papel de aplicacao pode.
  FOREACH v_sig IN ARRAY v_internas LOOP
    FOREACH v_role IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
      IF has_function_privilege(v_role, to_regprocedure(v_sig)::oid, 'EXECUTE') THEN
        v_bad := array_append(v_bad, 'helper executavel por ' || v_role || ': ' || v_sig);
      END IF;
    END LOOP;
    -- O dono TEM de continuar executando, senao as RPC e os gatilhos quebram.
    IF NOT has_function_privilege('postgres', to_regprocedure(v_sig)::oid, 'EXECUTE') THEN
      v_bad := array_append(v_bad, 'dono perdeu EXECUTE: ' || v_sig);
    END IF;
  END LOOP;

  IF array_length(v_bad, 1) > 0 THEN
    RAISE EXCEPTION 'db/93 verify: estado de privilegio incorreto: %', array_to_string(v_bad, '; ');
  END IF;
END;
$verify$;

-- ============================================================
-- 4. Reload PostgREST
-- ============================================================
NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';

COMMIT;
