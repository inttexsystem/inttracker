-- =====================================================================
-- db/114_pedido_alteracao_client_direct_select_column_acl.sql
-- PEDIDO-ALTERACAO-CLIENT-DIRECT-SELECT-INTERNAL-COLUMNS-R1 — correcao de
-- ACL FORWARD-ONLY sobre db/92: troca o SELECT DE TABELA de `authenticated`
-- nas duas tabelas de solicitacao de alteracao por privilegio DE COLUNA
-- restrito ao minimo que os consumidores diretos legitimos realmente usam.
--
-- Order: PEDIDO-ALTERACAO-CLIENT-DIRECT-SELECT-INTERNAL-COLUMNS-R1.
-- Contract shapes: docs/architecture/PEDIDO_OP_SCHEMA_CONTRACT.md,
--   subsecao "### U17. Column-level ACL correction of the request tables".
-- Forward-only; db/01..db/113 sao INTOCADOS. db/92 NAO e reescrito.
--
-- O DEFEITO QUE ESTA MIGRACAO FECHA
--   db/92 revogou toda escrita direta e concedeu SELECT DE TABELA — ou seja,
--   todas as colunas — a `authenticated` nas duas tabelas de solicitacao.
--   Combinado com a politica RLS `pedido_alteracao_cliente_select`, que admite
--   as linhas dos Pedidos do proprio Cliente, um Cliente autenticado podia
--   montar uma consulta PostgREST a mao e ler colunas INTERNAS da propria
--   solicitacao: `base_snapshot` (imagem-anterior completa do Pedido),
--   `base_revisao`, `solicitante_id`, `solicitante_papel`,
--   `falha_identificador`, `decidido_por`, `atualizado_em` e os campos
--   `proposto_*` operacionais — alem da colecao proposta inteira.
--
--   O leitor sancionado do Cliente, `public.cliente_alteracao_resumo(uuid)`
--   (db/92, estendido por db/94), expoe DELIBERADAMENTE um payload sanitizado
--   mais estreito e omite exatamente essas colunas. A ACL contradizia o
--   contorno de informacao aceito na Fase 4: o Cliente nao deve ganhar
--   visibilidade sobre dados internos apenas por ser dono da linha.
--
--   Registrado como divida material em docs/governance/current-state.json sob
--   PEDIDO-ALTERACAO-CLIENT-DIRECT-SELECT-INTERNAL-COLUMNS.
--
-- REGRA DO POSTGRESQL QUE DETERMINA A FORMA DA CORRECAO
--   Um GRANT de tabela NAO pode coexistir com restricao efetiva por coluna: se
--   o papel tem SELECT de tabela, ele le qualquer coluna e um GRANT de coluna
--   nao restringe nada. Por isso a correcao e obrigatoriamente
--   REVOKE do SELECT de tabela e, so entao, GRANT das colunas aprovadas.
--
-- CONJUNTO MINIMO DERIVADO DO GRAFO DE CHAMADAS ATIVO (nao arbitrado aqui)
--   Existe UM unico consumidor direto de tabela no runtime do navegador:
--     js/screens/pedido-detail-data.js — descoberta ADMINISTRATIVA limitada da
--     solicitacao pendente no hub de detalhe do Pedido:
--       .from('pedido_alteracao_solicitacoes')
--       .select('id, status, criado_em')
--       .eq('pedido_id', <uuid>).eq('status', 'pendente').limit(1)
--   Projecao: id, status, criado_em. Filtros: pedido_id, status. O PostgreSQL
--   exige SELECT tambem sobre coluna referenciada em WHERE, entao `pedido_id`
--   entra no conjunto minimo. Resultado:
--       public.pedido_alteracao_solicitacoes -> (id, pedido_id, status, criado_em)
--
--   Nenhum outro consumidor direto existe. As telas do Cliente
--   (cliente-pedido-detail.js, cliente-pedido-edit.js) leem SOMENTE por
--   cliente_alteracao_resumo(); a tela administrativa de revisao
--   (pedido-alteracao-review.js) le SOMENTE por admin_alteracao_comparacao();
--   js/delete-helpers.js apenas ROTULA contagens devolvidas por
--   diagnosticar_impacto_pedido() e nao consulta tabela alguma.
--
--   public.pedido_alteracao_solicitacao_itens NAO tem consumidor direto de
--   navegador algum — nem administrativo nem do Cliente. Seu conjunto minimo e
--   VAZIO, entao `authenticated` fica sem SELECT nenhum nela. Isto NAO e
--   analogia com a tabela de cabecalho: e o resultado da mesma medicao,
--   aplicada de forma independente.
--
--   As quatro colunas concedidas sao um SUBCONJUNTO do que o leitor sancionado
--   ja entrega ao Cliente (`solicitacao_id`/`id`, `status`, `criado_em`) mais
--   `pedido_id`, que e o proprio identificador que o Cliente informa na
--   chamada. Nenhuma coluna interna sobrevive ao corte.
--
--   O administrador tambem entra por `authenticated`: nao existe desvio
--   administrativo de navegador. A RLS continua dona do escopo de LINHA; a ACL
--   passa a ser dona do escopo de COLUNA.
--
-- O QUE ESTA MIGRACAO NAO FAZ
--   Nenhuma politica RLS e criada, alterada ou removida. Nenhum corpo de
--   funcao, gatilho, indice, constraint, tabela ou coluna muda. Nenhum
--   privilegio de escrita e introduzido. `anon` nao ganha nada. `service_role`
--   e o dono `postgres` ficam intactos, entao as RPC SECURITY DEFINER — que
--   executam como `postgres` — nao dependem em nada do privilegio que o
--   chamador acabou de perder. Nenhuma linha de negocio, de solicitacao, de
--   Pedido, de OP ou de evento e criada, alterada ou removida.
--
-- MEDICAO DE PRIVILEGIO
--   Este arquivo mede privilegio pelas funcoes de consulta documentadas do
--   PostgreSQL e nao por plumbing de aclitem:
--     has_table_privilege(...)       -> privilegio de TABELA, so ele;
--     has_any_column_privilege(...)  -> uniao de tabela e coluna;
--     has_column_privilege(...)      -> coluna especifica (verdadeiro tambem
--                                       quando o privilegio de tabela existe).
--   Um GRANT a PUBLIC torna has_*_privilege verdadeiro para QUALQUER papel,
--   entao checar `anon` tambem cobre PUBLIC. A presenca de qualquer GRANT de
--   coluna e detectada por `pg_attribute.attacl IS NOT NULL`, que e seguro a
--   NULL — `aclexplode` NAO e usado, porque recusa uma ACL vazia.
--
-- Idempotente: REVOKE e GRANT nao sao cumulativos, o gate aceita tanto o
-- estado PRE quanto o estado POS, e o replay converge no mesmo estado final.
-- Depende de db/92 (tabelas, RLS, RPCs) e de db/94 (cliente_alteracao_resumo).
-- =====================================================================

BEGIN;

-- ============================================================
-- 0. GATE DE PRE-REQUISITOS. Falha fechada. NAO repara nada.
-- ============================================================
-- Este gate NAO conserta drift alheio: ele RECUSA aplicar quando a topologia
-- de seguranca medida diverge materialmente da que a correcao pressupoe.
DO $gate$
DECLARE
  v_missing    TEXT[] := ARRAY[]::TEXT[];
  v_sol        OID;
  v_itens      OID;
  v_cols_min   TEXT[] := ARRAY['id','pedido_id','status','criado_em'];
  v_escrita    TEXT[] := ARRAY['INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'];
  v_col_escr   TEXT[] := ARRAY['INSERT','UPDATE','REFERENCES'];
  v_todos      TEXT[] := ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'];
  v_col_todos  TEXT[] := ARRAY['SELECT','INSERT','UPDATE','REFERENCES'];
  v_col        TEXT;
  v_p          TEXT;
  v_fn         TEXT;
  v_cmd        TEXT;
  v_oid        OID;
  v_sol_tbl    BOOLEAN;
  v_it_tbl     BOOLEAN;
  v_sol_cols   TEXT[];
  v_it_cols    TEXT[];
  v_sol_attacl INTEGER;
  v_it_attacl  INTEGER;
  v_pre        BOOLEAN;
  v_pos        BOOLEAN;
BEGIN
  -- 0.1 As duas tabelas de db/92 existem.
  v_sol   := to_regclass('public.pedido_alteracao_solicitacoes');
  v_itens := to_regclass('public.pedido_alteracao_solicitacao_itens');
  IF v_sol IS NULL THEN
    v_missing := array_append(v_missing, 'table public.pedido_alteracao_solicitacoes (db/92)');
  END IF;
  IF v_itens IS NULL THEN
    v_missing := array_append(v_missing, 'table public.pedido_alteracao_solicitacao_itens (db/92)');
  END IF;
  IF array_length(v_missing, 1) IS NOT NULL THEN
    RAISE EXCEPTION 'db/114 gate: pre-requisito(s) ausente(s): %', array_to_string(v_missing, '; ');
  END IF;

  -- 0.2 Os papeis de aplicacao existem. Sem eles a correcao nao tem alvo.
  FOREACH v_p IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = v_p) THEN
      v_missing := array_append(v_missing, format('role %s', v_p));
    END IF;
  END LOOP;
  IF array_length(v_missing, 1) IS NOT NULL THEN
    RAISE EXCEPTION 'db/114 gate: papel de aplicacao ausente: %', array_to_string(v_missing, '; ');
  END IF;

  -- 0.3 As colunas exigidas pelo consumidor direto legitimo existem, com o
  --     nome exato. Um rename silencioso invalidaria o GRANT de coluna.
  FOREACH v_col IN ARRAY v_cols_min LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_attribute
                    WHERE attrelid = v_sol AND attname = v_col
                      AND attnum > 0 AND NOT attisdropped) THEN
      v_missing := array_append(v_missing,
        format('column public.pedido_alteracao_solicitacoes.%s', v_col));
    END IF;
  END LOOP;
  IF array_length(v_missing, 1) IS NOT NULL THEN
    RAISE EXCEPTION 'db/114 gate: coluna(s) do consumidor direto ausente(s): %',
      array_to_string(v_missing, '; ');
  END IF;

  -- 0.4 O dono das duas tabelas continua sendo `postgres`. As RPC
  --     SECURITY DEFINER executam como ele; se o dono mudou, a premissa de
  --     que a correcao nao as afeta deixa de valer.
  IF EXISTS (SELECT 1 FROM pg_class
              WHERE oid = ANY (ARRAY[v_sol, v_itens])
                AND relowner <> 'postgres'::regrole) THEN
    RAISE EXCEPTION 'db/114 gate: o dono das tabelas de solicitacao deixou de ser postgres';
  END IF;

  -- 0.5 A RLS continua HABILITADA nas duas tabelas. A ACL passa a ser dona do
  --     escopo de coluna PRESSUPONDO que a RLS continua dona do de linha.
  IF EXISTS (SELECT 1 FROM pg_class
              WHERE oid = ANY (ARRAY[v_sol, v_itens]) AND NOT relrowsecurity) THEN
    RAISE EXCEPTION 'db/114 gate: ROW LEVEL SECURITY deixou de estar habilitada nas tabelas de solicitacao';
  END IF;

  -- 0.6 As quatro politicas aceitas de db/92 continuam existindo, com nome e
  --     comando exatos. Esta migracao NAO altera politica alguma; ela apenas
  --     recusa operar sobre uma topologia de RLS diferente da aceita.
  FOR v_fn, v_cmd IN
    SELECT * FROM (VALUES
      ('pedido_alteracao_admin_all',            '*'),
      ('pedido_alteracao_cliente_select',       'r'),
      ('pedido_alteracao_itens_admin_all',      '*'),
      ('pedido_alteracao_itens_cliente_select', 'r')
    ) AS t(nome, cmd)
  LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_policy
                    WHERE polrelid = ANY (ARRAY[v_sol, v_itens])
                      AND polname = v_fn AND polcmd::text = v_cmd) THEN
      v_missing := array_append(v_missing, format('policy %s (%s)', v_fn, v_cmd));
    END IF;
  END LOOP;
  IF array_length(v_missing, 1) IS NOT NULL THEN
    RAISE EXCEPTION 'db/114 gate: politica(s) RLS de db/92 ausente(s) ou divergente(s): %',
      array_to_string(v_missing, '; ');
  END IF;

  -- 0.7 As funcoes canonicas de leitura segura e de escrita servidora existem,
  --     sao SECURITY DEFINER e pertencem a `postgres`. E o que garante que
  --     estreitar o privilegio do CHAMADOR nao as quebra.
  FOREACH v_fn IN ARRAY ARRAY[
    'public.cliente_alteracao_resumo(uuid)',
    'public.admin_alteracao_comparacao(uuid)',
    'public.solicitar_alteracao_pedido(uuid,jsonb,jsonb,boolean,text)',
    'public.retirar_alteracao_pedido(uuid)',
    'public.aprovar_alteracao_pedido(uuid,boolean,text)',
    'public.rejeitar_alteracao_pedido(uuid,text)'
  ] LOOP
    v_oid := to_regprocedure(v_fn);
    IF v_oid IS NULL THEN
      v_missing := array_append(v_missing, format('function %s', v_fn));
    ELSIF NOT EXISTS (SELECT 1 FROM pg_proc
                       WHERE oid = v_oid AND prosecdef
                         AND proowner = 'postgres'::regrole) THEN
      v_missing := array_append(v_missing,
        format('function %s deixou de ser SECURITY DEFINER de postgres', v_fn));
    END IF;
  END LOOP;
  IF array_length(v_missing, 1) IS NOT NULL THEN
    RAISE EXCEPTION 'db/114 gate: dono servidor ausente ou divergente: %',
      array_to_string(v_missing, '; ');
  END IF;

  -- 0.8 `authenticated` NAO pode ter privilegio de escrita direto hoje. Se
  --     tiver, a divida medida nao e a que esta correcao fecha e o cenario
  --     mudou materialmente: pare.
  FOREACH v_p IN ARRAY v_escrita LOOP
    IF has_table_privilege('authenticated', v_sol, v_p)
       OR has_table_privilege('authenticated', v_itens, v_p) THEN
      v_missing := array_append(v_missing, format('table %s', v_p));
    END IF;
  END LOOP;
  FOREACH v_p IN ARRAY v_col_escr LOOP
    IF has_any_column_privilege('authenticated', v_sol, v_p)
       OR has_any_column_privilege('authenticated', v_itens, v_p) THEN
      v_missing := array_append(v_missing, format('column %s', v_p));
    END IF;
  END LOOP;
  IF array_length(v_missing, 1) IS NOT NULL THEN
    RAISE EXCEPTION 'db/114 gate: authenticated tem privilegio nao-SELECT nas tabelas de solicitacao: %',
      array_to_string(v_missing, ', ');
  END IF;

  -- 0.9 `anon` nao pode ter nada, de tabela nem de coluna. Um GRANT a PUBLIC
  --     tornaria estas mesmas consultas verdadeiras, entao PUBLIC esta coberto.
  FOREACH v_p IN ARRAY v_todos LOOP
    IF has_table_privilege('anon', v_sol, v_p) OR has_table_privilege('anon', v_itens, v_p) THEN
      v_missing := array_append(v_missing, format('table %s', v_p));
    END IF;
  END LOOP;
  FOREACH v_p IN ARRAY v_col_todos LOOP
    IF has_any_column_privilege('anon', v_sol, v_p)
       OR has_any_column_privilege('anon', v_itens, v_p) THEN
      v_missing := array_append(v_missing, format('column %s', v_p));
    END IF;
  END LOOP;
  IF array_length(v_missing, 1) IS NOT NULL THEN
    RAISE EXCEPTION 'db/114 gate: anon ou PUBLIC ja possui privilegio nas tabelas de solicitacao: %',
      array_to_string(v_missing, ', ');
  END IF;

  -- 0.10 `service_role` mantem ALL nas duas tabelas (infraestrutura de db/92).
  IF NOT (has_table_privilege('service_role', v_sol,   'SELECT,INSERT,UPDATE,DELETE')
      AND has_table_privilege('service_role', v_itens, 'SELECT,INSERT,UPDATE,DELETE')) THEN
    RAISE EXCEPTION 'db/114 gate: service_role perdeu o acesso declarado por db/92';
  END IF;

  -- 0.11 A FORMA exata que esta sendo corrigida. Exatamente dois estados sao
  --      aceitos; qualquer outro e drift e para a migracao.
  v_sol_tbl := has_table_privilege('authenticated', v_sol,   'SELECT');
  v_it_tbl  := has_table_privilege('authenticated', v_itens, 'SELECT');

  SELECT coalesce(array_agg(attname ORDER BY attname), ARRAY[]::TEXT[]) INTO v_sol_cols
    FROM pg_attribute
   WHERE attrelid = v_sol AND attnum > 0 AND NOT attisdropped
     AND has_column_privilege('authenticated', v_sol, attname, 'SELECT');
  SELECT coalesce(array_agg(attname ORDER BY attname), ARRAY[]::TEXT[]) INTO v_it_cols
    FROM pg_attribute
   WHERE attrelid = v_itens AND attnum > 0 AND NOT attisdropped
     AND has_column_privilege('authenticated', v_itens, attname, 'SELECT');

  -- Existencia de QUALQUER grant de coluna, seguro a NULL e sem aclexplode.
  SELECT count(*) INTO v_sol_attacl FROM pg_attribute
   WHERE attrelid = v_sol   AND attnum > 0 AND NOT attisdropped AND attacl IS NOT NULL;
  SELECT count(*) INTO v_it_attacl  FROM pg_attribute
   WHERE attrelid = v_itens AND attnum > 0 AND NOT attisdropped AND attacl IS NOT NULL;

  -- PRE: exatamente a divida medida — SELECT de TABELA nas duas, zero coluna.
  v_pre := v_sol_tbl AND v_it_tbl AND v_sol_attacl = 0 AND v_it_attacl = 0;
  -- POS: correcao ja aplicada — nenhum SELECT de tabela, exatamente as quatro
  --      colunas aprovadas no cabecalho, nada nos itens.
  v_pos := (NOT v_sol_tbl) AND (NOT v_it_tbl)
       AND v_sol_cols = ARRAY['criado_em','id','pedido_id','status']::TEXT[]
       AND v_it_cols = ARRAY[]::TEXT[]
       AND v_sol_attacl = 4 AND v_it_attacl = 0;

  IF NOT (v_pre OR v_pos) THEN
    RAISE EXCEPTION 'db/114 gate: forma de ACL inesperada — solicitacoes(tabela=%, colunas=[%], attacl=%), itens(tabela=%, colunas=[%], attacl=%). Esperado o estado PRE de db/92 ou o estado POS de db/114.',
      v_sol_tbl, array_to_string(v_sol_cols, ','), v_sol_attacl,
      v_it_tbl,  array_to_string(v_it_cols, ','),  v_it_attacl;
  END IF;

  RAISE NOTICE 'db/114 gate: OK (estado de entrada = %)', CASE WHEN v_pre THEN 'PRE' ELSE 'POS' END;
END;
$gate$;

-- ============================================================
-- 1. CORRECAO. Primeiro o REVOKE de tabela, depois o GRANT de coluna.
-- ============================================================
-- A ordem importa e torna o replay seguro qualquer que seja a semantica de
-- cascata do REVOKE de tabela sobre privilegio de coluna: se o REVOKE tambem
-- limpar as colunas, o GRANT seguinte as restabelece; se nao limpar, o GRANT e
-- um no-op. O estado final e o mesmo nas duas leituras.

-- 1.1 Cabecalho da solicitacao: sai o SELECT de TABELA.
REVOKE SELECT ON public.pedido_alteracao_solicitacoes      FROM authenticated;

-- 1.2 Colecao de itens propostos: sai o SELECT de TABELA e NADA volta.
--     Nenhum consumidor direto de navegador le esta tabela; o conjunto minimo
--     e vazio e nao ha GRANT de coluna correspondente.
REVOKE SELECT ON public.pedido_alteracao_solicitacao_itens FROM authenticated;

-- 1.3 Entram apenas as quatro colunas do consumidor direto legitimo.
--     id, status, criado_em -> projecao; pedido_id -> filtro do WHERE.
GRANT SELECT (id, pedido_id, status, criado_em)
  ON public.pedido_alteracao_solicitacoes TO authenticated;

-- ============================================================
-- 2. VERIFICACAO. A migracao prova o proprio resultado.
-- ============================================================
DO $verify$
DECLARE
  v_bad        TEXT[] := ARRAY[]::TEXT[];
  v_sol        OID := to_regclass('public.pedido_alteracao_solicitacoes');
  v_itens      OID := to_regclass('public.pedido_alteracao_solicitacao_itens');
  v_sol_cols   TEXT[];
  v_it_cols    TEXT[];
  v_sol_attacl INTEGER;
  v_it_attacl  INTEGER;
  v_escrita    TEXT[] := ARRAY['INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'];
  v_col_escr   TEXT[] := ARRAY['INSERT','UPDATE','REFERENCES'];
  v_todos      TEXT[] := ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'];
  v_internas   TEXT[] := ARRAY[
    'base_snapshot','base_revisao','solicitante_id','solicitante_papel',
    'falha_identificador','decidido_por','decisao_motivo','decidido_em',
    'atualizado_em','mensagem_cliente','campos_alterados','itens_propostos',
    'proposto_prazo_entrega','proposto_referencia_cliente',
    'proposto_tipo_recebimento','proposto_observacao',
    'proposto_prioridade_habilitada'
  ];
  v_col        TEXT;
  v_p          TEXT;
BEGIN
  -- 2.1 Nenhum SELECT de TABELA sobrevive para `authenticated`.
  IF has_table_privilege('authenticated', v_sol, 'SELECT') THEN
    v_bad := array_append(v_bad, 'authenticated ainda tem SELECT de TABELA no cabecalho');
  END IF;
  IF has_table_privilege('authenticated', v_itens, 'SELECT') THEN
    v_bad := array_append(v_bad, 'authenticated ainda tem SELECT de TABELA nos itens');
  END IF;

  -- 2.2 Exatamente as quatro colunas aprovadas no cabecalho.
  SELECT coalesce(array_agg(attname ORDER BY attname), ARRAY[]::TEXT[]) INTO v_sol_cols
    FROM pg_attribute
   WHERE attrelid = v_sol AND attnum > 0 AND NOT attisdropped
     AND has_column_privilege('authenticated', v_sol, attname, 'SELECT');
  IF v_sol_cols <> ARRAY['criado_em','id','pedido_id','status']::TEXT[] THEN
    v_bad := array_append(v_bad,
      'colunas legiveis divergentes: [' || array_to_string(v_sol_cols, ',') || ']');
  END IF;
  SELECT count(*) INTO v_sol_attacl FROM pg_attribute
   WHERE attrelid = v_sol AND attnum > 0 AND NOT attisdropped AND attacl IS NOT NULL;
  IF v_sol_attacl <> 4 THEN
    v_bad := array_append(v_bad, format('esperados 4 GRANT de coluna, ha %s', v_sol_attacl));
  END IF;

  -- 2.3 Nenhuma coluna da colecao de itens propostos.
  SELECT coalesce(array_agg(attname ORDER BY attname), ARRAY[]::TEXT[]) INTO v_it_cols
    FROM pg_attribute
   WHERE attrelid = v_itens AND attnum > 0 AND NOT attisdropped
     AND has_column_privilege('authenticated', v_itens, attname, 'SELECT');
  IF v_it_cols <> ARRAY[]::TEXT[] THEN
    v_bad := array_append(v_bad,
      'itens propostos ainda legiveis: [' || array_to_string(v_it_cols, ',') || ']');
  END IF;
  SELECT count(*) INTO v_it_attacl FROM pg_attribute
   WHERE attrelid = v_itens AND attnum > 0 AND NOT attisdropped AND attacl IS NOT NULL;
  IF v_it_attacl <> 0 THEN
    v_bad := array_append(v_bad, format('itens propostos tem %s GRANT de coluna', v_it_attacl));
  END IF;

  -- 2.4 NEGATIVO explicito: cada coluna interna nomeada esta efetivamente
  --     negada a `authenticated`. Medido coluna a coluna, nao por deducao.
  FOREACH v_col IN ARRAY v_internas LOOP
    IF has_column_privilege('authenticated', v_sol, v_col, 'SELECT') THEN
      v_bad := array_append(v_bad, format('coluna interna ainda legivel: %s', v_col));
    END IF;
  END LOOP;

  -- 2.5 POSITIVO explicito: o consumidor direto legitimo continua completo.
  FOREACH v_col IN ARRAY ARRAY['id','pedido_id','status','criado_em'] LOOP
    IF NOT has_column_privilege('authenticated', v_sol, v_col, 'SELECT') THEN
      v_bad := array_append(v_bad, format('coluna do consumidor direto perdida: %s', v_col));
    END IF;
  END LOOP;

  -- 2.6 Nenhum privilegio de escrita foi introduzido, em nenhuma das duas.
  FOREACH v_p IN ARRAY v_escrita LOOP
    IF has_table_privilege('authenticated', v_sol, v_p)
       OR has_table_privilege('authenticated', v_itens, v_p) THEN
      v_bad := array_append(v_bad, format('privilegio de escrita de tabela apareceu: %s', v_p));
    END IF;
  END LOOP;
  FOREACH v_p IN ARRAY v_col_escr LOOP
    IF has_any_column_privilege('authenticated', v_sol, v_p)
       OR has_any_column_privilege('authenticated', v_itens, v_p) THEN
      v_bad := array_append(v_bad, format('privilegio de escrita de coluna apareceu: %s', v_p));
    END IF;
  END LOOP;

  -- 2.7 `anon` continua sem nada — e, por consequencia, PUBLIC tambem.
  FOREACH v_p IN ARRAY v_todos LOOP
    IF has_table_privilege('anon', v_sol, v_p) OR has_table_privilege('anon', v_itens, v_p) THEN
      v_bad := array_append(v_bad, format('anon ou PUBLIC ganhou %s', v_p));
    END IF;
  END LOOP;
  IF has_any_column_privilege('anon', v_sol, 'SELECT')
     OR has_any_column_privilege('anon', v_itens, 'SELECT') THEN
    v_bad := array_append(v_bad, 'anon ou PUBLIC ganhou SELECT de coluna');
  END IF;

  -- 2.8 O dono servidor continua intacto: `service_role` e `postgres` mantem
  --     o acesso completo do qual as RPC SECURITY DEFINER dependem.
  IF NOT (has_table_privilege('service_role', v_sol,   'SELECT,INSERT,UPDATE,DELETE')
      AND has_table_privilege('service_role', v_itens, 'SELECT,INSERT,UPDATE,DELETE')
      AND has_table_privilege('postgres',     v_sol,   'SELECT,INSERT,UPDATE,DELETE')
      AND has_table_privilege('postgres',     v_itens, 'SELECT,INSERT,UPDATE,DELETE')) THEN
    v_bad := array_append(v_bad, 'service_role ou postgres perdeu acesso');
  END IF;

  -- 2.9 A RLS e as quatro politicas continuam exatamente como estavam.
  IF EXISTS (SELECT 1 FROM pg_class
              WHERE oid = ANY (ARRAY[v_sol, v_itens]) AND NOT relrowsecurity) THEN
    v_bad := array_append(v_bad, 'ROW LEVEL SECURITY foi desabilitada');
  END IF;
  IF (SELECT count(*) FROM pg_policy WHERE polrelid = ANY (ARRAY[v_sol, v_itens])) <> 4 THEN
    v_bad := array_append(v_bad, 'o numero de politicas RLS mudou');
  END IF;

  IF array_length(v_bad, 1) IS NOT NULL THEN
    RAISE EXCEPTION 'db/114 verify: %', array_to_string(v_bad, '; ');
  END IF;

  RAISE NOTICE 'db/114 verify: OK — authenticated le somente (id, pedido_id, status, criado_em) de pedido_alteracao_solicitacoes e nada de pedido_alteracao_solicitacao_itens';
END;
$verify$;

COMMIT;
