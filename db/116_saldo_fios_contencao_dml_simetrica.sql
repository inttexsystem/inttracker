-- =====================================================================
-- db/116_saldo_fios_contencao_dml_simetrica.sql
-- NATIVE-RECEIPT-SALDO-FIOS-DIRECT-GRANT-DEFENSE-IN-DEPTH-GAP — correcao
-- de ACL FORWARD-ONLY: remove de `anon`, `authenticated` e `service_role`
-- a autoridade DIRETA de INSERT / UPDATE / DELETE sobre
-- public.saldo_fios, estendendo a esta tabela a MESMA postura de
-- contencao que db/106b secao 4.4 ja aplicou a public.saldo_fios_op.
--
-- Order: NATIVE-RECEIPT-SALDO-FIOS-DIRECT-GRANT-DEFENSE-IN-DEPTH-GAP.
-- Divida registrada em docs/governance/current-state.json e em
--   docs/architecture/ORDEM_COMPRA_LIFECYCLE_SPEC_PROPOSED.md secao R.33.6.
-- Forward-only; db/01..db/115 sao INTOCADOS. db/106b NAO e reescrito.
-- db/110 permanece AUSENTE e NAO AUTORIZADA e nao e referenciada aqui.
--
-- O DEFEITO QUE ESTA MIGRACAO FECHA
--   public.saldo_fios ainda carrega o GRANT DE TABELA de INSERT, UPDATE e
--   DELETE para os tres papeis de aplicacao. A origem e o GRANT amplo de
--   esquema herdado de db/05 secao 2 mais os grants de projeto padrao do
--   Supabase; nunca foi uma concessao derivada de um chamador.
--
--   db/106b secao 4.4 ja removeu exatamente esses tres privilegios de
--   saldo_fios_op para os mesmos tres papeis, com a justificativa de que o
--   escritor canonico e SECURITY DEFINER e nao depende do privilegio do
--   chamador. saldo_fios ficou de fora daquela passagem, e db/107
--   (ordem_compra_c3c_close_final_acl) tambem nao a estreitou: aquela
--   funcao revoga saldo_fios apenas no nivel de POLITICA, nao de GRANT.
--   O resultado e uma ASSIMETRIA de defesa em profundidade entre duas
--   tabelas do mesmo dominio de contencao.
--
-- ISTO NAO E UM CAMINHO DE ESCRITA EFETIVO ABERTO, E A MIGRACAO NAO FINGE
-- QUE E. A escrita direta ja e recusada hoje, em duas camadas
-- independentes:
--   1. ROW LEVEL SECURITY habilitada com ZERO politicas, o que fecha
--      `anon` e `authenticated` — mas NAO `service_role`, que e
--      rolbypassrls, nem o dono;
--   2. o gatilho db/75 trg_c3c_protected_mutation_guard, que exige
--      pg_trigger_depth() > 1 e recusa qualquer DML de topo com
--      legacy_receipt_fenced (SQLSTATE 55000), para QUALQUER papel.
--   Para `service_role` a camada 1 nao existe, entao hoje sobra uma
--   unica camada. Esta migracao devolve a segunda camada, no lugar certo:
--   o privilegio.
--
-- NENHUM CHAMADOR LEGITIMO PERDE NADA — MEDIDO, NAO PRESUMIDO
--   O UNICO objeto que escreve public.saldo_fios e
--   public.trg_native_lancamento_derive_state (db/70), gatilho
--   SECURITY DEFINER pertencente a `postgres`, sem EXECUTE para nenhum
--   dos tres papeis. Ele escreve aninhado sob o lancamento nativo, que e
--   precisamente a condicao pg_trigger_depth() > 1 exigida pelo gatilho
--   C3C. Privilegio de papel-cliente nao participa desse caminho.
--   Nenhuma superficie de navegador executa DML direto em saldo_fios; os
--   guardas aceitos em tests/op-ajuste-atomico.smoke.js,
--   tests/op-nova.smoke.js e tests/op-nova-nativo.smoke.js ja asseguram
--   isso no repositorio.
--
-- O QUE ESTA MIGRACAO NAO FAZ
--   Nao cria, altera nem remove politica RLS alguma, e nao mexe no estado
--   habilitado da RLS. Nao cria, altera nem remove tabela, coluna,
--   constraint, indice, gatilho, sequencia ou corpo de funcao. Nao
--   introduz privilegio novo para ninguem. Nao toca SELECT, REFERENCES,
--   TRIGGER, TRUNCATE nem MAINTAIN — a leitura e as capacidades nao
--   mutantes permanecem exatamente como estao. `postgres` fica intacto.
--   Nao escreve, altera nem apaga LINHA DE NEGOCIO alguma: as cinco
--   linhas historicas de saldo_fios sao preservadas e a propria migracao
--   PROVA essa invariancia. Nao altera a semantica de disponibilidade de
--   saldo_fios (TD1: continua NAO sendo autoridade de disponibilidade),
--   nem a semantica de alocacao/excedente do recebimento nativo. Nao
--   cruza nem aproxima o PONR: recusa aplicar se
--   productive_receipt_started_at deixou de ser NULL.
--
-- POR QUE O REVOKE E DE TABELA, E POR QUE O GATE EXIGE ZERO ACL DE COLUNA
--   O PostgreSQL toma a UNIAO de privilegio de tabela e de coluna. Um
--   REVOKE de tabela nao remove um GRANT de coluna independente, entao a
--   correcao so e completa enquanto NAO existir ACL de coluna propria em
--   saldo_fios. O gate mede isso por `pg_attribute.attacl IS NOT NULL`,
--   que e seguro a NULL — `aclexplode` NAO e usado, porque recusa uma ACL
--   vazia — e RECUSA aplicar se encontrar qualquer uma, em vez de deixar
--   um buraco silencioso.
--
-- MEDICAO DE PRIVILEGIO
--   Por has_table_privilege / has_any_column_privilege, e nao por
--   plumbing de aclitem. Um GRANT a PUBLIC torna has_*_privilege
--   verdadeiro para QUALQUER papel, entao checar `anon` tambem cobre
--   PUBLIC.
--
-- IDEMPOTENTE E REPLAY-SAFE. REVOKE nao e cumulativo. O gate afere
-- pre-requisitos ESTRUTURAIS, nao a presenca do privilegio que remove,
-- entao a reaplicacao converge no mesmo estado final e uma sequencia de
-- migracoes limpa — em que `anon` nunca recebeu escrita — tambem passa.
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
  v_p        TEXT;
  v_cmd      TEXT;
  v_attacl   INTEGER;
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
    v_missing := array_append(v_missing, 'table public.saldo_fios_op (postura de referencia de db/106b)');
  END IF;
  IF array_length(v_missing, 1) IS NOT NULL THEN
    RAISE EXCEPTION 'db/116 gate: pre-requisito(s) ausente(s): %', array_to_string(v_missing, '; ');
  END IF;

  -- 0.2 Os papeis de aplicacao existem. Sem eles a correcao nao tem alvo.
  FOREACH v_p IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = v_p) THEN
      v_missing := array_append(v_missing, format('role %s', v_p));
    END IF;
  END LOOP;
  IF array_length(v_missing, 1) IS NOT NULL THEN
    RAISE EXCEPTION 'db/116 gate: papel de aplicacao ausente: %', array_to_string(v_missing, '; ');
  END IF;

  -- 0.3 O dono de saldo_fios continua sendo `postgres`. O escritor canonico
  --     e SECURITY DEFINER dele; se o dono mudou, a premissa de que
  --     estreitar o chamador nao o afeta deixa de valer.
  IF EXISTS (SELECT 1 FROM pg_class WHERE oid = v_sf AND relowner <> 'postgres'::regrole) THEN
    RAISE EXCEPTION 'db/116 gate: o dono de public.saldo_fios deixou de ser postgres';
  END IF;

  -- 0.4 ROW LEVEL SECURITY continua HABILITADA em saldo_fios. Esta correcao
  --     assume a RLS como dona do escopo de LINHA e nao a substitui.
  IF EXISTS (SELECT 1 FROM pg_class WHERE oid = v_sf AND NOT relrowsecurity) THEN
    RAISE EXCEPTION 'db/116 gate: ROW LEVEL SECURITY deixou de estar habilitada em public.saldo_fios';
  END IF;

  -- 0.5 A guarda de mutacao C3C (db/75) continua instalada e HABILITADA em
  --     saldo_fios. Ela e a camada que hoje recusa a escrita de fato; a
  --     correcao a complementa e nunca a substitui.
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t
     WHERE t.tgrelid = v_sf
       AND NOT t.tgisinternal
       AND t.tgname = 'trg_c3c_protected_mutation_guard'
       AND t.tgenabled = 'O'
  ) THEN
    RAISE EXCEPTION 'db/116 gate: trg_c3c_protected_mutation_guard ausente ou desabilitado em public.saldo_fios';
  END IF;

  -- 0.6 O UNICO escritor canonico de saldo_fios continua sendo o gatilho
  --     SECURITY DEFINER de `postgres`, inalcancavel pelos papeis-cliente.
  --     E isto que prova que o REVOKE abaixo nao tem chamador legitimo.
  v_fn := to_regprocedure('public.trg_native_lancamento_derive_state()');
  IF v_fn IS NULL THEN
    RAISE EXCEPTION 'db/116 gate: escritor canonico public.trg_native_lancamento_derive_state() ausente (db/70)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid = v_fn AND prosecdef AND proowner = 'postgres'::regrole) THEN
    RAISE EXCEPTION 'db/116 gate: o escritor canonico deixou de ser SECURITY DEFINER de postgres';
  END IF;
  FOREACH v_p IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
    IF has_function_privilege(v_p, v_fn, 'EXECUTE') THEN
      v_missing := array_append(v_missing, v_p);
    END IF;
  END LOOP;
  IF array_length(v_missing, 1) IS NOT NULL THEN
    RAISE EXCEPTION 'db/116 gate: papel-cliente alcanca o escritor canonico: %',
      array_to_string(v_missing, ', ');
  END IF;

  -- 0.7 A POSTURA DE REFERENCIA existe de fato. saldo_fios_op — corrigida por
  --     db/106b secao 4.4 — nao pode ter INSERT, UPDATE nem DELETE para
  --     papel-cliente algum. Esta migracao ESPELHA um estado aceito medido;
  --     ela nao inventa uma postura nova.
  FOREACH v_p IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
    FOREACH v_cmd IN ARRAY ARRAY['INSERT','UPDATE','DELETE'] LOOP
      IF has_table_privilege(v_p, v_sfop, v_cmd) THEN
        v_missing := array_append(v_missing, format('%s/%s', v_p, v_cmd));
      END IF;
    END LOOP;
  END LOOP;
  IF array_length(v_missing, 1) IS NOT NULL THEN
    RAISE EXCEPTION 'db/116 gate: a postura de referencia de db/106b nao esta em vigor em saldo_fios_op: %',
      array_to_string(v_missing, ', ');
  END IF;

  -- 0.8 FORMA DA CORRECAO: nenhuma ACL de coluna propria em saldo_fios. Se
  --     existir, um REVOKE de tabela nao basta (o PostgreSQL une tabela e
  --     coluna) e a forma correta seria outra: RECUSAR, nao meio-corrigir.
  SELECT count(*) INTO v_attacl FROM pg_attribute
   WHERE attrelid = v_sf AND attnum > 0 AND NOT attisdropped AND attacl IS NOT NULL;
  IF v_attacl <> 0 THEN
    RAISE EXCEPTION 'db/116 gate: public.saldo_fios tem % GRANT(s) de coluna proprios; o REVOKE de tabela nao seria suficiente', v_attacl;
  END IF;

  -- 0.9 O PONR continua NAO CRUZADO. Esta e uma correcao pre-PONR e recusa
  --     aplicar depois do primeiro recebimento produtivo nativo.
  SELECT productive_receipt_started_at INTO v_ponr
    FROM public.ordem_compra_cutover WHERE id = 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'db/116 gate: public.ordem_compra_cutover id=1 ausente (db/71)';
  END IF;
  IF v_ponr IS NOT NULL THEN
    RAISE EXCEPTION 'db/116 gate: productive_receipt_started_at nao e NULL (%); o PONR ja foi cruzado', v_ponr;
  END IF;

  RAISE NOTICE 'db/116 gate: OK';
END;
$gate$;

-- ============================================================
-- 1. CORRECAO. Somente REVOKE, somente no nivel de TABELA, somente os
--    tres comandos de mutacao direta. Nada e concedido de volta.
-- ============================================================
-- Espelha db/106b secao 4.4 verbatim na forma, trocando a tabela alvo.
-- SELECT, REFERENCES, TRIGGER, TRUNCATE e MAINTAIN NAO sao tocados: o
-- estado final de saldo_fios passa a ser identico ao de saldo_fios_op.
REVOKE INSERT, UPDATE, DELETE ON TABLE public.saldo_fios FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.saldo_fios FROM anon;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.saldo_fios FROM service_role;

-- ============================================================
-- 2. VERIFICACAO. A migracao prova o proprio resultado, positiva e
--    negativamente, e prova que NAO tocou dado de negocio.
-- ============================================================
DO $verify$
DECLARE
  v_bad        TEXT[] := ARRAY[]::TEXT[];
  v_sf         OID := to_regclass('public.saldo_fios');
  v_sfop       OID := to_regclass('public.saldo_fios_op');
  v_p          TEXT;
  v_cmd        TEXT;
  v_mutacao    TEXT[] := ARRAY['INSERT','UPDATE','DELETE'];
  v_preservar  TEXT[] := ARRAY['SELECT','REFERENCES','TRIGGER','TRUNCATE'];
  v_attacl     INTEGER;
  v_ponr       TIMESTAMPTZ;
BEGIN
  -- 2.1 NEGATIVO: nenhum INSERT / UPDATE / DELETE de TABELA sobrevive para
  --     nenhum dos tres papeis. Medido papel a papel e comando a comando.
  FOREACH v_p IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
    FOREACH v_cmd IN ARRAY v_mutacao LOOP
      IF has_table_privilege(v_p, v_sf, v_cmd) THEN
        v_bad := array_append(v_bad, format('%s ainda tem %s de TABELA', v_p, v_cmd));
      END IF;
    END LOOP;
  END LOOP;

  -- 2.2 NEGATIVO: nem por coluna. has_any_column_privilege cobre a UNIAO de
  --     tabela e coluna, entao isto fecha a regra de uniao do PostgreSQL.
  --     Checar `anon` tambem cobre um eventual GRANT a PUBLIC.
  FOREACH v_p IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
    FOREACH v_cmd IN ARRAY ARRAY['INSERT','UPDATE'] LOOP
      IF has_any_column_privilege(v_p, v_sf, v_cmd) THEN
        v_bad := array_append(v_bad, format('%s ainda tem %s de COLUNA', v_p, v_cmd));
      END IF;
    END LOOP;
  END LOOP;
  SELECT count(*) INTO v_attacl FROM pg_attribute
   WHERE attrelid = v_sf AND attnum > 0 AND NOT attisdropped AND attacl IS NOT NULL;
  IF v_attacl <> 0 THEN
    v_bad := array_append(v_bad, format('apareceram %s GRANT(s) de coluna', v_attacl));
  END IF;

  -- 2.3 POSITIVO: o acesso NAO-MUTANTE nao foi removido por acidente.
  --     Contencao que fecha tambem o caminho legitimo e defeito, nao acerto.
  FOREACH v_p IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
    FOREACH v_cmd IN ARRAY v_preservar LOOP
      IF has_table_privilege(v_p, v_sfop, v_cmd) AND NOT has_table_privilege(v_p, v_sf, v_cmd) THEN
        v_bad := array_append(v_bad,
          format('%s perdeu %s em saldo_fios, que saldo_fios_op preserva', v_p, v_cmd));
      END IF;
    END LOOP;
  END LOOP;

  -- 2.4 POSITIVO: o dono continua com acesso total. As RPC e o gatilho
  --     SECURITY DEFINER executam como ele.
  IF NOT has_table_privilege('postgres', v_sf, 'SELECT,INSERT,UPDATE,DELETE') THEN
    v_bad := array_append(v_bad, 'postgres perdeu acesso a saldo_fios');
  END IF;

  -- 2.5 SIMETRIA: para cada papel-cliente, o conjunto efetivo de privilegios
  --     de saldo_fios passa a ser IGUAL ao de saldo_fios_op. E este o
  --     fechamento da assimetria que a divida nomeia.
  FOREACH v_p IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
    FOREACH v_cmd IN ARRAY ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'] LOOP
      IF has_table_privilege(v_p, v_sf, v_cmd) <> has_table_privilege(v_p, v_sfop, v_cmd) THEN
        v_bad := array_append(v_bad,
          format('assimetria remanescente: %s/%s difere entre saldo_fios e saldo_fios_op', v_p, v_cmd));
      END IF;
    END LOOP;
  END LOOP;

  -- 2.6 A RLS e a guarda C3C continuam exatamente como estavam. Esta
  --     migracao complementa as duas camadas e nao mexe em nenhuma.
  IF EXISTS (SELECT 1 FROM pg_class WHERE oid = v_sf AND NOT relrowsecurity) THEN
    v_bad := array_append(v_bad, 'ROW LEVEL SECURITY foi desabilitada em saldo_fios');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t
     WHERE t.tgrelid = v_sf AND NOT t.tgisinternal
       AND t.tgname = 'trg_c3c_protected_mutation_guard' AND t.tgenabled = 'O'
  ) THEN
    v_bad := array_append(v_bad, 'trg_c3c_protected_mutation_guard ausente ou desabilitado');
  END IF;

  -- 2.7 O escritor canonico continua intacto e continua inalcancavel.
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

  -- 2.8 O PONR continua NAO CRUZADO.
  SELECT productive_receipt_started_at INTO v_ponr
    FROM public.ordem_compra_cutover WHERE id = 1;
  IF v_ponr IS NOT NULL THEN
    v_bad := array_append(v_bad, 'productive_receipt_started_at deixou de ser NULL');
  END IF;

  IF array_length(v_bad, 1) IS NOT NULL THEN
    RAISE EXCEPTION 'db/116 verify: %', array_to_string(v_bad, '; ');
  END IF;

  -- A mensagem e deliberadamente curta: o resultado legivel desta migracao e a
  -- ACL medida, nao o texto do NOTICE. Manter esta linha curta e o que mantem o
  -- SQL executavel deste arquivo byte-equivalente ao aplicado em producao.
  RAISE NOTICE 'db/116 verify: OK';
END;
$verify$;

-- ============================================================
-- 3. BLOCO DE RECUPERACAO — o caminho de volta autorizado
-- ============================================================
-- Delta EXATO desta migracao: tres privilegios, tres papeis, uma tabela.
-- Estado medido em ucrjtfswnfdlxwtmxnoo IMEDIATAMENTE ANTES da aplicacao,
-- por pg_class.relacl:
--   saldo_fios    anon=arwdDxtm  authenticated=arwdDxtm  service_role=arwdDxtm
--   saldo_fios_op anon=rDxtm     authenticated=rDxtm     service_role=rDxtm
-- Estado alvo: saldo_fios passa a `rDxtm` para os tres, identico a
-- saldo_fios_op. A restauracao literal do estado anterior e:
--
--   BEGIN;
--   GRANT INSERT, UPDATE, DELETE ON TABLE public.saldo_fios
--     TO anon, authenticated, service_role;
--   COMMIT;
--
-- O bloco e INTENCIONALMENTE INERTE aqui. Executa-lo dentro desta
-- migracao anularia a contencao que ela existe para instalar, e a
-- recuperacao e uma operacao separada e autorizada.
--
-- NOTA DE INTERACAO COM O MANIFESTO C3C. O manifesto de ACL da geracao
-- 20260801 (public.ordem_compra_cutover_acl_manifest, capturado por
-- db/107) registra o estado ANTERIOR ao fechamento do cutover e portanto
-- ainda contem as nove linhas de INSERT/UPDATE/DELETE de saldo_fios. Uma
-- execucao futura de public.ordem_compra_c3c_restore_acl_manifest()
-- restauraria esses grants junto com todo o mundo de ACL pre-cutover.
-- Isso e o comportamento declarado daquele caminho de rollback total e
-- NAO e alterado aqui; o manifesto e evidencia historica aceita e nao e
-- editado por esta migracao.
-- =====================================================================

COMMIT;
