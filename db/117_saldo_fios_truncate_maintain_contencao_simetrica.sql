-- =====================================================================
-- db/117_saldo_fios_truncate_maintain_contencao_simetrica.sql
-- SALDO-FIOS-TRUNCATE-AND-MAINTAIN-SURVIVE — correcao de ACL
-- FORWARD-ONLY: remove de `anon`, `authenticated` e `service_role` a
-- autoridade DIRETA de TRUNCATE e MAINTAIN sobre AS DUAS tabelas do
-- dominio de contencao, SIMETRICAMENTE:
--   public.saldo_fios
--   public.saldo_fios_op
--
-- Order: SALDO-FIOS-TRUNCATE-AND-MAINTAIN-CONTAINMENT-R1.
-- Divida registrada em docs/governance/current-state.json.
-- Forward-only; db/01..db/116 sao INTOCADOS. db/106b e db/116 NAO sao
-- reescritos. db/110 permanece AUSENTE e NAO AUTORIZADA e nao e
-- referenciada aqui.
--
-- O DEFEITO QUE ESTA MIGRACAO FECHA
--   db/106b secao 4.4 e db/116 removeram INSERT, UPDATE e DELETE das duas
--   tabelas para os tres papeis de aplicacao. Cada uma fechou EXATAMENTE a
--   divida que nomeava, e TRUNCATE e MAINTAIN ficaram deliberadamente fora
--   do escopo das duas. O residuo medido em pg_class.relacl e `rDxtm` para
--   os tres papeis nas duas tabelas, onde `D` e TRUNCATE e `m` e MAINTAIN.
--
--   TRUNCATE E AUTORIDADE DESTRUTIVA REAL, E NAO E ALCANCADA POR NENHUMA
--   DAS CAMADAS SOBREVIVENTES — isto foi medido, nao presumido:
--     1. os tres gatilhos das duas tabelas (trg_c3c_protected_mutation_guard
--        nas duas, saldo_fios_op_fato_protegido_fence em saldo_fios_op) sao
--        FOR EACH ROW em INSERT/UPDATE/DELETE; o bit TRUNCATE de tgtype e 0
--        em todos, entao nenhum dispara em TRUNCATE;
--     2. o PostgreSQL NAO aplica ROW LEVEL SECURITY a TRUNCATE, entao a
--        postura de RLS habilitada com ZERO politicas tambem nao o barra.
--   Nao existe verbo TRUNCATE no PostgREST, entao nao ha caminho de
--   aplicacao conhecido; a exposicao e uma sessao SQL direta atuando sob um
--   desses papeis.
--
--   MAINTAIN (PostgreSQL 17+) permite VACUUM, ANALYZE, REINDEX, CLUSTER e
--   REFRESH MATERIALIZED VIEW. NAO e autoridade destrutiva de linha de
--   negocio, e esta migracao nao finge que e: e capacidade privilegiada de
--   manutencao desnecessaria, removida por menor privilegio depois que a
--   medicao mostrou que nenhum processo depende dela.
--
-- ORIGEM EXATA DO PRIVILEGIO — MEDIDA, NAO DEDUZIDA
--   Fonte unica: entradas DIRETAS de tabela em pg_class.relacl, concedidas
--   POR `postgres` A CADA PAPEL nominalmente (`anon=rDxtm/postgres`, idem
--   para os outros dois, nas duas tabelas). A origem historica e o GRANT
--   amplo de esquema de db/05 secao 2 mais os grants de projeto padrao do
--   Supabase.
--   NAO ha nenhuma outra fonte efetiva, e o gate abaixo RECUSA aplicar se
--   alguma aparecer:
--     - PUBLIC: ZERO entradas de ACL com grantee = 0 nas duas tabelas, e
--       nenhum `GRANT ... TO PUBLIC` existe no corpo de migracoes;
--     - HERANCA DE PAPEL: nenhum dos tres papeis e MEMBRO de papel algum.
--       Os tres so aparecem como papel CONCEDIDO a `authenticator`
--       (inherit_option = false, apenas SET ROLE) e a `postgres`. Nada flui
--       para dentro deles, entao um REVOKE de tabela e COMPLETO;
--     - NENHUM dos tres e superusuario nem dono das tabelas;
--     - ACL DE COLUNA: irrelevante por construcao — TRUNCATE e MAINTAIN sao
--       privilegios de OBJETO, sem forma por coluna — e mesmo assim medido
--       em ZERO nas duas tabelas.
--   pg_default_acl continua concedendo `arwdDxtm` aos tres papeis para
--   tabelas FUTURAS do esquema public. Isso NAO restaura privilegio em
--   tabela existente e portanto nao sobrevive a este REVOKE; e a postura
--   padrao da plataforma e esta migracao deliberadamente NAO a altera.
--
-- NENHUM CHAMADOR LEGITIMO PERDE NADA — MEDIDO, NAO PRESUMIDO
--   TRUNCATE: nenhum objeto de banco executa TRUNCATE nestas tabelas. A
--   unica funcao cujo corpo casa com /truncate/ e
--   public.ordem_compra_c3c_close_final_acl, e ela casa por conter um
--   REVOKE ... TRUNCATE ..., nao um TRUNCATE; e SECURITY DEFINER,
--   exige current_user = 'postgres' e lock de sessao, e nao e executavel
--   por nenhum dos tres papeis. O UNICO TRUNCATE versionado destas duas
--   tabelas vive em db/04_seed.sql, um seed de desenvolvimento rodado no
--   SQL Editor como `postgres` — e `postgres` MANTEM TRUNCATE intacto
--   aqui. Os scripts manuais de reset db/10_reset_producao.sql e
--   db/11_reset_ops.sql apagam por DELETE FROM, nao por TRUNCATE, e
--   tambem rodam como dono.
--   MAINTAIN: ZERO ocorrencias de MAINTAIN, VACUUM, ANALYZE, REINDEX,
--   CLUSTER ou REFRESH MATERIALIZED VIEW em db/, js/, scripts/ e tests/.
--   Nao ha pg_cron nem qualquer extensao de agendamento instalada, entao
--   nao existe rotina de manutencao no banco, muito menos uma rodando sob
--   papel de aplicacao. O autovacuum do PostgreSQL e a manutencao da
--   plataforma nao dependem de MAINTAIN de papel-cliente.
--
-- O QUE ESTA MIGRACAO NAO FAZ
--   Nao cria, altera nem remove politica RLS alguma, e nao mexe no estado
--   habilitado da RLS. Nao cria, altera nem remove tabela, coluna,
--   constraint, indice, gatilho, sequencia ou corpo de funcao. Nao
--   introduz privilegio novo para ninguem. Nao toca SELECT, REFERENCES nem
--   TRIGGER, e nao toca INSERT/UPDATE/DELETE — a contencao de db/106b e
--   db/116 e PRESSUPOSTA pelo gate e RECONFERIDA pela verificacao, nunca
--   refeita. `postgres` fica intacto, TRUNCATE e MAINTAIN inclusive.
--   Nao escreve, altera nem apaga LINHA DE NEGOCIO alguma: as cinco linhas
--   historicas de saldo_fios sao preservadas e a propria migracao PROVA
--   essa invariancia comparando a impressao digital ANTES e DEPOIS.
--   Nao executa TRUNCATE em lugar nenhum. Nao altera a semantica de
--   disponibilidade de saldo_fios (TD1: continua NAO sendo autoridade de
--   disponibilidade), nem a semantica de alocacao/excedente do recebimento
--   nativo, nem a de recebimento, cutover ou proveniencia. Nao cruza nem
--   aproxima o PONR: recusa aplicar se productive_receipt_started_at
--   deixou de ser NULL.
--
-- POR QUE O REVOKE NAO NOMEIA PUBLIC
--   Porque a medicao provou que PUBLIC nao detem nada nestas duas tabelas.
--   Revogar de PUBLIC seria um no-op cosmetico; o gate 0.9 AFIRMA a
--   ausencia e RECUSA aplicar se uma entrada PUBLIC aparecer, o que e
--   evidencia mais forte do que um REVOKE que nao remove nada.
--
-- NOTA DE VERSAO. MAINTAIN existe a partir do PostgreSQL 17. O gate exige
-- server_version_num >= 170000 e recusa com mensagem explicita. Em um
-- servidor anterior o proprio parse de `REVOKE ... MAINTAIN` ja falharia:
-- de qualquer forma a migracao FALHA FECHADA, nunca aplica pela metade.
--
-- IDEMPOTENTE E REPLAY-SAFE. REVOKE nao e cumulativo. O gate afere
-- pre-requisitos ESTRUTURAIS, nao a presenca do privilegio que remove,
-- entao a reaplicacao converge no mesmo estado final e uma sequencia de
-- migracoes limpa — em que os papeis nunca receberam TRUNCATE — tambem
-- passa.
--
-- RECUPERACAO AUTORIZADA (bloco INERTE; ver secao 3).
-- =====================================================================

BEGIN;

-- ============================================================
-- 0. GATE DE PRE-REQUISITOS. Falha fechada. NAO repara nada.
-- ============================================================
DO $gate$
DECLARE
  v_missing  TEXT[] := ARRAY[]::TEXT[];
  v_sf       OID;
  v_sfop     OID;
  v_tbl      OID;
  v_nome     TEXT;
  v_p        TEXT;
  v_cmd      TEXT;
  v_n        INTEGER;
  v_ponr     TIMESTAMPTZ;
  v_fn       OID;
BEGIN
  -- 0.1 As duas tabelas do dominio de contencao existem.
  v_sf   := to_regclass('public.saldo_fios');
  v_sfop := to_regclass('public.saldo_fios_op');
  IF v_sf IS NULL THEN
    v_missing := array_append(v_missing, 'table public.saldo_fios (db/01)');
  END IF;
  IF v_sfop IS NULL THEN
    v_missing := array_append(v_missing, 'table public.saldo_fios_op (db/01)');
  END IF;
  IF array_length(v_missing, 1) IS NOT NULL THEN
    RAISE EXCEPTION 'db/117 gate: pre-requisito(s) ausente(s): %', array_to_string(v_missing, '; ');
  END IF;

  -- 0.2 Os papeis de aplicacao existem. Sem eles a correcao nao tem alvo.
  FOREACH v_p IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = v_p) THEN
      v_missing := array_append(v_missing, format('role %s', v_p));
    END IF;
  END LOOP;
  IF array_length(v_missing, 1) IS NOT NULL THEN
    RAISE EXCEPTION 'db/117 gate: papel de aplicacao ausente: %', array_to_string(v_missing, '; ');
  END IF;

  -- 0.3 MAINTAIN so existe a partir do PostgreSQL 17.
  IF current_setting('server_version_num')::INTEGER < 170000 THEN
    RAISE EXCEPTION 'db/117 gate: MAINTAIN exige PostgreSQL 17 ou superior; servidor e %',
      current_setting('server_version');
  END IF;

  -- 0.4 O dono das duas tabelas continua sendo `postgres`. O escritor
  --     canonico e SECURITY DEFINER dele; se o dono mudou, a premissa de
  --     que estreitar o chamador nao o afeta deixa de valer.
  FOREACH v_nome IN ARRAY ARRAY['saldo_fios','saldo_fios_op'] LOOP
    v_tbl := to_regclass('public.' || v_nome);
    IF EXISTS (SELECT 1 FROM pg_class WHERE oid = v_tbl AND relowner <> 'postgres'::regrole) THEN
      RAISE EXCEPTION 'db/117 gate: o dono de public.% deixou de ser postgres', v_nome;
    END IF;

    -- 0.5 ROW LEVEL SECURITY continua HABILITADA. Esta correcao assume a
    --     RLS como dona do escopo de LINHA e nao a substitui — e a propria
    --     razao de o residuo importar e que a RLS nao alcanca TRUNCATE.
    IF EXISTS (SELECT 1 FROM pg_class WHERE oid = v_tbl AND NOT relrowsecurity) THEN
      RAISE EXCEPTION 'db/117 gate: ROW LEVEL SECURITY deixou de estar habilitada em public.%', v_nome;
    END IF;

    -- 0.6 A guarda de mutacao C3C (db/75) continua instalada e HABILITADA.
    --     Ela e a camada que hoje recusa a escrita de LINHA; a correcao a
    --     complementa no unico ponto que ela nao alcanca e nunca a
    --     substitui.
    IF NOT EXISTS (
      SELECT 1 FROM pg_trigger t
       WHERE t.tgrelid = v_tbl
         AND NOT t.tgisinternal
         AND t.tgname = 'trg_c3c_protected_mutation_guard'
         AND t.tgenabled = 'O'
    ) THEN
      RAISE EXCEPTION 'db/117 gate: trg_c3c_protected_mutation_guard ausente ou desabilitado em public.%', v_nome;
    END IF;

    -- 0.9 PUBLIC nao detem nada nesta tabela. Se detivesse, um REVOKE por
    --     papel nominal NAO seria suficiente e a forma correta seria outra:
    --     RECUSAR, nao meio-corrigir.
    SELECT count(*) INTO v_n
      FROM pg_class c, LATERAL aclexplode(c.relacl) a
     WHERE c.oid = v_tbl AND c.relacl IS NOT NULL AND a.grantee = 0;
    IF v_n <> 0 THEN
      RAISE EXCEPTION 'db/117 gate: public.% tem % concessao(oes) a PUBLIC; o REVOKE por papel nao seria suficiente', v_nome, v_n;
    END IF;

    -- 0.11 Nenhuma ACL de coluna propria. TRUNCATE e MAINTAIN nao tem forma
    --      por coluna, entao isto nao pode mascarar o alvo; e medido para
    --      que a tabela nao esteja em um estado de ACL que esta migracao
    --      nao inspecionou.
    SELECT count(*) INTO v_n FROM pg_attribute
     WHERE attrelid = v_tbl AND attnum > 0 AND NOT attisdropped AND attacl IS NOT NULL;
    IF v_n <> 0 THEN
      RAISE EXCEPTION 'db/117 gate: public.% tem % GRANT(s) de coluna proprios, estado nao previsto por esta correcao', v_nome, v_n;
    END IF;
  END LOOP;

  -- 0.7 O escritor canonico de saldo_fios continua sendo o gatilho
  --     SECURITY DEFINER de `postgres`, inalcancavel pelos papeis-cliente.
  v_fn := to_regprocedure('public.trg_native_lancamento_derive_state()');
  IF v_fn IS NULL THEN
    RAISE EXCEPTION 'db/117 gate: escritor canonico public.trg_native_lancamento_derive_state() ausente (db/70)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid = v_fn AND prosecdef AND proowner = 'postgres'::regrole) THEN
    RAISE EXCEPTION 'db/117 gate: o escritor canonico deixou de ser SECURITY DEFINER de postgres';
  END IF;
  FOREACH v_p IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
    IF has_function_privilege(v_p, v_fn, 'EXECUTE') THEN
      v_missing := array_append(v_missing, v_p);
    END IF;
  END LOOP;
  IF array_length(v_missing, 1) IS NOT NULL THEN
    RAISE EXCEPTION 'db/117 gate: papel-cliente alcanca o escritor canonico: %',
      array_to_string(v_missing, ', ');
  END IF;

  -- 0.8 A CONTENCAO ANTERIOR ESTA EM VIGOR nas duas tabelas: db/106b secao
  --     4.4 em saldo_fios_op e db/116 em saldo_fios. Esta migracao CONTINUA
  --     uma postura aceita e medida; ela nao a refaz nem a substitui, e
  --     recusa aplicar sobre um estado que nao a tenha.
  FOREACH v_nome IN ARRAY ARRAY['saldo_fios','saldo_fios_op'] LOOP
    v_tbl := to_regclass('public.' || v_nome);
    FOREACH v_p IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
      FOREACH v_cmd IN ARRAY ARRAY['INSERT','UPDATE','DELETE'] LOOP
        IF has_table_privilege(v_p, v_tbl, v_cmd) THEN
          v_missing := array_append(v_missing, format('%s/%s/%s', v_nome, v_p, v_cmd));
        END IF;
      END LOOP;
    END LOOP;
  END LOOP;
  IF array_length(v_missing, 1) IS NOT NULL THEN
    RAISE EXCEPTION 'db/117 gate: a contencao de db/106b/db/116 nao esta em vigor: %',
      array_to_string(v_missing, ', ');
  END IF;

  -- 0.10 NENHUMA HERANCA DE PAPEL. Se um dos tres fosse MEMBRO de outro
  --      papel, o privilegio poderia sobreviver ao REVOKE por outra via.
  --      Nenhum dos tres pode ser superusuario nem dono das tabelas.
  SELECT count(*) INTO v_n
    FROM pg_auth_members am JOIN pg_roles m ON m.oid = am.member
   WHERE m.rolname IN ('anon','authenticated','service_role');
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'db/117 gate: papel-cliente e membro de % papel(eis); o REVOKE de tabela nao seria completo', v_n;
  END IF;
  FOREACH v_p IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = v_p AND rolsuper) THEN
      RAISE EXCEPTION 'db/117 gate: o papel % virou superusuario; privilegio de tabela deixa de ser a autoridade', v_p;
    END IF;
    IF EXISTS (
      SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public' AND c.relname IN ('saldo_fios','saldo_fios_op')
         AND c.relowner = v_p::regrole
    ) THEN
      RAISE EXCEPTION 'db/117 gate: o papel % virou dono de uma das tabelas alvo', v_p;
    END IF;
  END LOOP;

  -- 0.12 O PONR continua NAO CRUZADO. Esta e uma correcao pre-PONR e recusa
  --      aplicar depois do primeiro recebimento produtivo nativo.
  SELECT productive_receipt_started_at INTO v_ponr
    FROM public.ordem_compra_cutover WHERE id = 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'db/117 gate: public.ordem_compra_cutover id=1 ausente (db/71)';
  END IF;
  IF v_ponr IS NOT NULL THEN
    RAISE EXCEPTION 'db/117 gate: productive_receipt_started_at nao e NULL (%); o PONR ja foi cruzado', v_ponr;
  END IF;

  -- 0.13 IMPRESSAO DIGITAL DE NEGOCIO ANTES DA CORRECAO, guardada no escopo
  --      desta transacao para que a secao 2 PROVE a invariancia em vez de
  --      afirma-la. Nao cria objeto algum.
  PERFORM set_config('db117.sf_fingerprint',
    (SELECT coalesce(count(*)::TEXT, '0') FROM public.saldo_fios) || '/' ||
    (SELECT coalesce(sum(kg_total)::TEXT, '0') FROM public.saldo_fios) || '/' ||
    (SELECT coalesce(md5(string_agg(s::TEXT, '|' ORDER BY s.id)), '(vazio)') FROM public.saldo_fios s),
    true);
  PERFORM set_config('db117.sfop_fingerprint',
    (SELECT coalesce(count(*)::TEXT, '0') FROM public.saldo_fios_op) || '/' ||
    (SELECT coalesce(md5(string_agg(o::TEXT, '|' ORDER BY o.id)), '(vazio)') FROM public.saldo_fios_op o),
    true);

  RAISE NOTICE 'db/117 gate: OK';
END;
$gate$;

-- ============================================================
-- 1. CORRECAO. Somente REVOKE, somente no nivel de TABELA, somente os
--    dois privilegios nomeados pela divida, nas DUAS tabelas.
--    Nada e concedido de volta.
-- ============================================================
-- SELECT, REFERENCES e TRIGGER NAO sao tocados, e INSERT/UPDATE/DELETE ja
-- foram removidos por db/106b e db/116 — nao sao revogados de novo aqui.
-- `postgres` nao aparece em nenhum REVOKE e mantem TRUNCATE e MAINTAIN.
REVOKE TRUNCATE, MAINTAIN ON TABLE public.saldo_fios FROM authenticated;
REVOKE TRUNCATE, MAINTAIN ON TABLE public.saldo_fios FROM anon;
REVOKE TRUNCATE, MAINTAIN ON TABLE public.saldo_fios FROM service_role;

REVOKE TRUNCATE, MAINTAIN ON TABLE public.saldo_fios_op FROM authenticated;
REVOKE TRUNCATE, MAINTAIN ON TABLE public.saldo_fios_op FROM anon;
REVOKE TRUNCATE, MAINTAIN ON TABLE public.saldo_fios_op FROM service_role;

-- ============================================================
-- 2. VERIFICACAO. A migracao prova o proprio resultado, positiva e
--    negativamente, e prova que NAO tocou dado de negocio.
-- ============================================================
DO $verify$
DECLARE
  v_bad        TEXT[] := ARRAY[]::TEXT[];
  v_tbl        OID;
  v_nome       TEXT;
  v_p          TEXT;
  v_cmd        TEXT;
  v_alvo       TEXT[] := ARRAY['TRUNCATE','MAINTAIN'];
  v_preservar  TEXT[] := ARRAY['SELECT','REFERENCES','TRIGGER'];
  v_contido    TEXT[] := ARRAY['INSERT','UPDATE','DELETE'];
  v_todos      TEXT[] := ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER','MAINTAIN'];
  v_n          INTEGER;
  v_ponr       TIMESTAMPTZ;
  v_antes      TEXT;
  v_depois     TEXT;
BEGIN
  FOREACH v_nome IN ARRAY ARRAY['saldo_fios','saldo_fios_op'] LOOP
    v_tbl := to_regclass('public.' || v_nome);

    -- 2.1 NEGATIVO: nenhum TRUNCATE e nenhum MAINTAIN sobrevive para nenhum
    --     dos tres papeis, em nenhuma das duas tabelas. Medido papel a
    --     papel e privilegio a privilegio. Checar `anon` tambem cobre um
    --     eventual GRANT a PUBLIC, porque has_table_privilege e verdadeiro
    --     para QUALQUER papel quando PUBLIC detem o privilegio.
    FOREACH v_p IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
      FOREACH v_cmd IN ARRAY v_alvo LOOP
        IF has_table_privilege(v_p, v_tbl, v_cmd) THEN
          v_bad := array_append(v_bad, format('%s ainda tem %s em %s', v_p, v_cmd, v_nome));
        END IF;
      END LOOP;
    END LOOP;

    -- 2.2 POSITIVO: o acesso NAO-MUTANTE nao foi removido por acidente.
    --     Contencao que fecha tambem o caminho legitimo e defeito, nao
    --     acerto.
    FOREACH v_p IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
      FOREACH v_cmd IN ARRAY v_preservar LOOP
        IF NOT has_table_privilege(v_p, v_tbl, v_cmd) THEN
          v_bad := array_append(v_bad, format('%s perdeu %s em %s', v_p, v_cmd, v_nome));
        END IF;
      END LOOP;
    END LOOP;

    -- 2.3 NEGATIVO: a contencao de db/106b/db/116 permanece EXATAMENTE como
    --     estava. Esta migracao nao pode ter concedido nada de volta.
    FOREACH v_p IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
      FOREACH v_cmd IN ARRAY v_contido LOOP
        IF has_table_privilege(v_p, v_tbl, v_cmd) THEN
          v_bad := array_append(v_bad, format('%s reganhou %s em %s', v_p, v_cmd, v_nome));
        END IF;
      END LOOP;
    END LOOP;

    -- 2.4 POSITIVO: o dono continua com acesso TOTAL, TRUNCATE e MAINTAIN
    --     inclusive. As RPC e o gatilho SECURITY DEFINER executam como ele,
    --     e os scripts manuais de reset dependem do TRUNCATE dele.
    FOREACH v_cmd IN ARRAY v_todos LOOP
      IF NOT has_table_privilege('postgres', v_tbl, v_cmd) THEN
        v_bad := array_append(v_bad, format('postgres perdeu %s em %s', v_cmd, v_nome));
      END IF;
    END LOOP;

    -- 2.6 A RLS e a guarda C3C continuam exatamente como estavam. Esta
    --     migracao complementa as camadas e nao mexe em nenhuma.
    IF EXISTS (SELECT 1 FROM pg_class WHERE oid = v_tbl AND NOT relrowsecurity) THEN
      v_bad := array_append(v_bad, format('ROW LEVEL SECURITY foi desabilitada em %s', v_nome));
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_trigger t
       WHERE t.tgrelid = v_tbl AND NOT t.tgisinternal
         AND t.tgname = 'trg_c3c_protected_mutation_guard' AND t.tgenabled = 'O'
    ) THEN
      v_bad := array_append(v_bad, format('trg_c3c_protected_mutation_guard ausente ou desabilitado em %s', v_nome));
    END IF;

    -- 2.7 Nenhuma ACL de coluna apareceu.
    SELECT count(*) INTO v_n FROM pg_attribute
     WHERE attrelid = v_tbl AND attnum > 0 AND NOT attisdropped AND attacl IS NOT NULL;
    IF v_n <> 0 THEN
      v_bad := array_append(v_bad, format('apareceram %s GRANT(s) de coluna em %s', v_n, v_nome));
    END IF;
  END LOOP;

  -- 2.5 SIMETRIA: para cada papel-cliente, o conjunto efetivo de privilegios
  --     de saldo_fios e IGUAL ao de saldo_fios_op, privilegio a privilegio.
  --     E este o fechamento simetrico que a divida nomeia.
  FOREACH v_p IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
    FOREACH v_cmd IN ARRAY v_todos LOOP
      IF has_table_privilege(v_p, 'public.saldo_fios', v_cmd)
         <> has_table_privilege(v_p, 'public.saldo_fios_op', v_cmd) THEN
        v_bad := array_append(v_bad,
          format('assimetria remanescente: %s/%s difere entre saldo_fios e saldo_fios_op', v_p, v_cmd));
      END IF;
    END LOOP;
  END LOOP;

  -- 2.8 O escritor canonico continua intacto e continua inalcancavel.
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc
     WHERE oid = to_regprocedure('public.trg_native_lancamento_derive_state()')
       AND prosecdef AND proowner = 'postgres'::regrole
  ) THEN
    v_bad := array_append(v_bad, 'o escritor canonico deixou de ser SECURITY DEFINER de postgres');
  END IF;
  FOREACH v_p IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
    IF has_function_privilege(v_p, 'public.trg_native_lancamento_derive_state()', 'EXECUTE') THEN
      v_bad := array_append(v_bad, format('%s ganhou EXECUTE no escritor canonico', v_p));
    END IF;
  END LOOP;

  -- 2.9 O PONR continua NAO CRUZADO e o cutover nao se moveu.
  SELECT productive_receipt_started_at INTO v_ponr
    FROM public.ordem_compra_cutover WHERE id = 1;
  IF v_ponr IS NOT NULL THEN
    v_bad := array_append(v_bad, 'productive_receipt_started_at deixou de ser NULL');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.ordem_compra_cutover
     WHERE id = 1 AND status = 'canonical_active' AND read_authority = 'canonical'
       AND reconciliation_status = 'reconciled'
  ) THEN
    v_bad := array_append(v_bad, 'o estado do cutover deixou de ser canonical_active/canonical/reconciled');
  END IF;

  -- 2.10 INVARIANCIA DE DADO DE NEGOCIO, PROVADA e nao afirmada: a
  --      impressao digital capturada pelo gate ANTES do REVOKE tem de
  --      reproduzir-se byte a byte agora.
  v_antes  := current_setting('db117.sf_fingerprint', true);
  v_depois := (SELECT coalesce(count(*)::TEXT, '0') FROM public.saldo_fios) || '/' ||
              (SELECT coalesce(sum(kg_total)::TEXT, '0') FROM public.saldo_fios) || '/' ||
              (SELECT coalesce(md5(string_agg(s::TEXT, '|' ORDER BY s.id)), '(vazio)') FROM public.saldo_fios s);
  IF v_antes IS NULL OR v_antes <> v_depois THEN
    v_bad := array_append(v_bad, format('saldo_fios mudou: antes=%s depois=%s', coalesce(v_antes, '(nao capturado)'), v_depois));
  END IF;

  v_antes  := current_setting('db117.sfop_fingerprint', true);
  v_depois := (SELECT coalesce(count(*)::TEXT, '0') FROM public.saldo_fios_op) || '/' ||
              (SELECT coalesce(md5(string_agg(o::TEXT, '|' ORDER BY o.id)), '(vazio)') FROM public.saldo_fios_op o);
  IF v_antes IS NULL OR v_antes <> v_depois THEN
    v_bad := array_append(v_bad, format('saldo_fios_op mudou: antes=%s depois=%s', coalesce(v_antes, '(nao capturado)'), v_depois));
  END IF;

  IF array_length(v_bad, 1) IS NOT NULL THEN
    RAISE EXCEPTION 'db/117 verify: %', array_to_string(v_bad, '; ');
  END IF;

  -- A mensagem e deliberadamente curta: o resultado legivel desta migracao e a
  -- ACL medida, nao o texto do NOTICE.
  RAISE NOTICE 'db/117 verify: OK';
END;
$verify$;

-- ============================================================
-- 3. BLOCO DE RECUPERACAO — o caminho de volta autorizado
-- ============================================================
-- Delta EXATO desta migracao: dois privilegios, tres papeis, duas tabelas
-- — doze privilegios, e nada mais.
-- Estado medido em ucrjtfswnfdlxwtmxnoo IMEDIATAMENTE ANTES da aplicacao,
-- por pg_class.relacl:
--   saldo_fios    anon=rDxtm  authenticated=rDxtm  service_role=rDxtm
--   saldo_fios_op anon=rDxtm  authenticated=rDxtm  service_role=rDxtm
-- Estado alvo: `rxt` para os tres papeis nas DUAS tabelas, isto e, sem `D`
-- (TRUNCATE) e sem `m` (MAINTAIN). `postgres=arwdDxtm/postgres` e
-- INALTERADO nas duas. A restauracao literal do estado anterior e:
--
--   BEGIN;
--   GRANT TRUNCATE, MAINTAIN ON TABLE public.saldo_fios, public.saldo_fios_op
--     TO anon, authenticated, service_role;
--   COMMIT;
--
-- O bloco e INTENCIONALMENTE INERTE aqui. Executa-lo dentro desta
-- migracao anularia a contencao que ela existe para instalar, e a
-- recuperacao e uma operacao separada e autorizada.
--
-- NOTA DE INTERACAO COM O MANIFESTO C3C. O manifesto de ACL da geracao
-- 20260801 (public.ordem_compra_cutover_acl_manifest, capturado por
-- db/107) registra o estado ANTERIOR ao fechamento do cutover e ja continha
-- linhas de TRUNCATE e MAINTAIN para os tres papeis nas DUAS tabelas antes
-- desta migracao. Uma execucao futura de
-- public.ordem_compra_c3c_restore_acl_manifest() restauraria esses
-- privilegios junto com todo o mundo de ACL pre-cutover. Isso e o
-- comportamento declarado daquele caminho de rollback total, ja registrado
-- na divida SALDO-FIOS-C3C-MANIFEST-REOPENS-CORRECTED-GRANTS, e NAO e
-- alterado nem reparado aqui; o manifesto e evidencia historica aceita e
-- nao e editado por esta migracao.
-- =====================================================================

COMMIT;
