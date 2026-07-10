-- ============================================================
-- VERIFICACAO de 44_partner_cnpj_registry.sql
-- Rodar no SQL editor do Supabase STAGING (ucrjtfswnfdlxwtmxnoo) APOS aplicar a
-- migration. Transacional: cria dados sinteticos, valida e faz ROLLBACK.
-- Nao toca registros legados; nada e persistido.
-- Sucesso = "ALL VERIFY ASSERTIONS PASSED" e nenhuma excecao FAIL.
-- ============================================================
BEGIN;

DO $$
DECLARE
  v_pid   BIGINT;
  v_pid2  BIGINT;
  v_fid   BIGINT;
  v_cid   BIGINT;
  v_forn_before INT;
  v_cli_before  INT;
BEGIN
  SELECT COUNT(*) INTO v_forn_before FROM public.fornecedores;
  SELECT COUNT(*) INTO v_cli_before  FROM public.clientes;

  -- ---- CNPJ: is_valid_cnpj ----
  ASSERT public.is_valid_cnpj('11222333000181'),        'valido rejeitado';
  ASSERT public.is_valid_cnpj('11444777000161'),        'valido #2 rejeitado';
  ASSERT NOT public.is_valid_cnpj('11222333000180'),    'DV invalido aceito';
  ASSERT NOT public.is_valid_cnpj('00000000000000'),    'sequencia repetida aceita';
  ASSERT NOT public.is_valid_cnpj('1122233300018'),     '13 digitos aceito';
  ASSERT NOT public.is_valid_cnpj('112223330001810'),   '15 digitos aceito';
  ASSERT NOT public.is_valid_cnpj('11.222.333/0001-81'),'pontuacao aceita';
  ASSERT NOT public.is_valid_cnpj(NULL),                'null aceito';

  -- ---- cardinalidade ----
  INSERT INTO public.parceiros(nome) VALUES ('__verify_partner_A') RETURNING id INTO v_pid;

  -- varios CNPJs distintos por parceiro
  INSERT INTO public.parceiro_cnpjs(parceiro_id, cnpj, principal, ativo) VALUES (v_pid,'11222333000181', TRUE,  TRUE);
  INSERT INTO public.parceiro_cnpjs(parceiro_id, cnpj, principal, ativo) VALUES (v_pid,'11444777000161', FALSE, TRUE);
  -- CNPJ inativo preservado
  INSERT INTO public.parceiro_cnpjs(parceiro_id, cnpj, principal, ativo) VALUES (v_pid,'04252011000110', FALSE, FALSE);
  ASSERT (SELECT COUNT(*) FROM public.parceiro_cnpjs WHERE parceiro_id = v_pid) = 3, 'multiplos CNPJs nao aceitos';

  -- CHECK rejeita CNPJ invalido
  BEGIN
    INSERT INTO public.parceiro_cnpjs(parceiro_id, cnpj) VALUES (v_pid,'11222333000180');
    RAISE EXCEPTION 'FAIL: CHECK aceitou CNPJ invalido';
  EXCEPTION WHEN check_violation THEN NULL; END;

  -- unicidade GLOBAL do CNPJ
  INSERT INTO public.parceiros(nome) VALUES ('__verify_partner_B') RETURNING id INTO v_pid2;
  BEGIN
    INSERT INTO public.parceiro_cnpjs(parceiro_id, cnpj) VALUES (v_pid2,'11222333000181');
    RAISE EXCEPTION 'FAIL: CNPJ duplicado global aceito';
  EXCEPTION WHEN unique_violation THEN NULL; END;

  -- apenas UM principal ativo por parceiro
  BEGIN
    INSERT INTO public.parceiro_cnpjs(parceiro_id, cnpj, principal, ativo) VALUES (v_pid,'04252011000110', TRUE, TRUE);
    RAISE EXCEPTION 'FAIL: segundo principal ativo aceito';
  EXCEPTION WHEN unique_violation THEN NULL; END;

  -- ---- dual-role: mesmo parceiro ligado a cliente e fornecedor ----
  INSERT INTO public.fornecedores(nome, tipo, parceiro_id) VALUES ('__verify_dualrole','tecelagem', v_pid) RETURNING id INTO v_fid;
  INSERT INTO public.clientes(nome, parceiro_id)          VALUES ('__verify_dualrole', v_pid)             RETURNING id INTO v_cid;
  ASSERT (SELECT parceiro_id FROM public.fornecedores WHERE id = v_fid) = v_pid, 'fornecedor nao ligou parceiro';
  ASSERT (SELECT parceiro_id FROM public.clientes     WHERE id = v_cid) = v_pid, 'cliente nao ligou parceiro';

  -- varios fornecedores (tipos diferentes) apontando pro mesmo parceiro
  INSERT INTO public.fornecedores(nome, tipo, parceiro_id) VALUES ('__verify_dualrole','latex', v_pid);
  ASSERT (SELECT COUNT(*) FROM public.fornecedores WHERE parceiro_id = v_pid) = 2, 'multiplos tipos de fornecedor nao aceitos';

  -- ---- legado intacto (dentro da transacao; sera revertido de qualquer forma) ----
  ASSERT (SELECT COUNT(*) FROM public.fornecedores WHERE parceiro_id IS NULL) = v_forn_before, 'legado fornecedor alterado';
  ASSERT (SELECT COUNT(*) FROM public.clientes     WHERE parceiro_id IS NULL) = v_cli_before,  'legado cliente alterado';

  RAISE NOTICE 'ALL VERIFY ASSERTIONS PASSED';
END $$;

ROLLBACK;
