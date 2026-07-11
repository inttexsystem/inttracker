-- ============================================================
-- Verificacao transacional de 46_remove_legacy_partner_cnpj.sql.
-- Executar somente em STAGING apos aplicar a migration.
-- Todos os registros sinteticos sao removidos e a transacao e revertida.
-- ============================================================

BEGIN;

DO $$
DECLARE
  v_clientes_antes INTEGER;
  v_fornecedores_antes INTEGER;
  v_clientes_cnpj_antes INTEGER;
  v_fornecedores_cnpj_antes INTEGER;
  v_cliente_sem_cnpj BIGINT;
  v_cliente_valido BIGINT;
  v_fornecedor_sem_cnpj BIGINT;
  v_fornecedor_valido BIGINT;
  v_tag TEXT := '__verify_remove_legacy_b3_' || txid_current()::TEXT;
  v_tipo TEXT := 'tecelagem';
BEGIN
  SELECT COUNT(*) INTO v_clientes_antes FROM public.clientes;
  SELECT COUNT(*) INTO v_fornecedores_antes FROM public.fornecedores;
  SELECT COUNT(*) INTO v_clientes_cnpj_antes FROM public.clientes WHERE cnpj IS NOT NULL;
  SELECT COUNT(*) INTO v_fornecedores_cnpj_antes FROM public.fornecedores WHERE cnpj IS NOT NULL;

  -- ===========================================================
  -- AUSENCIA dos objetos do modelo Parceiros (migration 44)
  -- ===========================================================

  -- Tabelas
  ASSERT NOT EXISTS (
    SELECT 1 FROM pg_class WHERE relname = 'parceiros' AND relnamespace = 'public'::regnamespace AND relkind = 'r'
  ), 'FAIL: tabela parceiros ainda existe';

  ASSERT NOT EXISTS (
    SELECT 1 FROM pg_class WHERE relname = 'parceiro_cnpjs' AND relnamespace = 'public'::regnamespace AND relkind = 'r'
  ), 'FAIL: tabela parceiro_cnpjs ainda existe';

  -- Colunas parceiro_id
  ASSERT NOT EXISTS (
    SELECT 1 FROM pg_attribute a
    WHERE a.attrelid = 'public.clientes'::regclass AND a.attname = 'parceiro_id' AND a.attnum > 0 AND NOT a.attisdropped
  ), 'FAIL: clientes.parceiro_id ainda existe';

  ASSERT NOT EXISTS (
    SELECT 1 FROM pg_attribute a
    WHERE a.attrelid = 'public.fornecedores'::regclass AND a.attname = 'parceiro_id' AND a.attnum > 0 AND NOT a.attisdropped
  ), 'FAIL: fornecedores.parceiro_id ainda existe';

  -- Funcao is_valid_cnpj (migration 44)
  ASSERT NOT EXISTS (
    SELECT 1 FROM pg_proc WHERE pronamespace = 'public'::regnamespace AND proname = 'is_valid_cnpj'
  ), 'FAIL: funcao is_valid_cnpj ainda existe';

  -- Trigger functions
  ASSERT NOT EXISTS (
    SELECT 1 FROM pg_proc WHERE pronamespace = 'public'::regnamespace AND proname = 'touch_parceiros_updated_at'
  ), 'FAIL: funcao touch_parceiros_updated_at ainda existe';

  ASSERT NOT EXISTS (
    SELECT 1 FROM pg_proc WHERE pronamespace = 'public'::regnamespace AND proname = 'touch_parceiro_cnpjs_updated_at'
  ), 'FAIL: funcao touch_parceiro_cnpjs_updated_at ainda existe';

  -- Triggers
  ASSERT NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'parceiros_touch_updated_at' AND tgisinternal = false
  ), 'FAIL: trigger parceiros_touch_updated_at ainda existe';

  ASSERT NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'parceiro_cnpjs_touch_updated_at' AND tgisinternal = false
  ), 'FAIL: trigger parceiro_cnpjs_touch_updated_at ainda existe';

  -- RLS policies
  ASSERT NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND policyname = 'parceiros_admin'
  ), 'FAIL: policy parceiros_admin ainda existe';

  ASSERT NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND policyname = 'parceiro_cnpjs_admin'
  ), 'FAIL: policy parceiro_cnpjs_admin ainda existe';

  -- FK constraints
  ASSERT NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'clientes_parceiro_id_fkey'
  ), 'FAIL: FK clientes_parceiro_id_fkey ainda existe';

  ASSERT NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fornecedores_parceiro_id_fkey'
  ), 'FAIL: FK fornecedores_parceiro_id_fkey ainda existe';

  ASSERT NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'parceiro_cnpjs_parceiro_id_fkey'
  ), 'FAIL: FK parceiro_cnpjs_parceiro_id_fkey ainda existe';

  -- CHECK constraint parceiro_cnpjs_cnpj_valido
  ASSERT NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'parceiro_cnpjs_cnpj_valido'
  ), 'FAIL: constraint parceiro_cnpjs_cnpj_valido ainda existe';

  -- Indices do modelo antigo
  ASSERT NOT EXISTS (
    SELECT 1 FROM pg_class WHERE relname = 'fornecedores_parceiro_id_idx' AND relnamespace = 'public'::regnamespace
  ), 'FAIL: indice fornecedores_parceiro_id_idx ainda existe';

  ASSERT NOT EXISTS (
    SELECT 1 FROM pg_class WHERE relname = 'clientes_parceiro_id_idx' AND relnamespace = 'public'::regnamespace
  ), 'FAIL: indice clientes_parceiro_id_idx ainda existe';

  ASSERT NOT EXISTS (
    SELECT 1 FROM pg_class WHERE relname = 'parceiro_cnpjs_cnpj_uidx' AND relnamespace = 'public'::regnamespace
  ), 'FAIL: indice parceiro_cnpjs_cnpj_uidx ainda existe';

  ASSERT NOT EXISTS (
    SELECT 1 FROM pg_class WHERE relname = 'parceiro_cnpjs_um_principal_ativo_uidx' AND relnamespace = 'public'::regnamespace
  ), 'FAIL: indice parceiro_cnpjs_um_principal_ativo_uidx ainda existe';

  ASSERT NOT EXISTS (
    SELECT 1 FROM pg_class WHERE relname = 'parceiro_cnpjs_parceiro_id_idx' AND relnamespace = 'public'::regnamespace
  ), 'FAIL: indice parceiro_cnpjs_parceiro_id_idx ainda existe';

  -- ===========================================================
  -- PRESERVACAO dos objetos diretos (migration 45)
  -- ===========================================================

  -- Funcao is_valid_entity_cnpj
  ASSERT EXISTS (
    SELECT 1 FROM pg_proc WHERE pronamespace = 'public'::regnamespace AND proname = 'is_valid_entity_cnpj'
  ), 'FAIL: funcao is_valid_entity_cnpj foi removida indevidamente';

  -- Colunas cnpj diretas
  ASSERT EXISTS (
    SELECT 1 FROM pg_attribute a
    WHERE a.attrelid = 'public.clientes'::regclass AND a.attname = 'cnpj' AND a.attnum > 0 AND NOT a.attisdropped
  ), 'FAIL: clientes.cnpj foi removido indevidamente';

  ASSERT EXISTS (
    SELECT 1 FROM pg_attribute a
    WHERE a.attrelid = 'public.fornecedores'::regclass AND a.attname = 'cnpj' AND a.attnum > 0 AND NOT a.attisdropped
  ), 'FAIL: fornecedores.cnpj foi removido indevidamente';

  -- CHECK constraints diretos
  ASSERT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'clientes_cnpj_valido' AND contype = 'c'
  ), 'FAIL: constraint clientes_cnpj_valido foi removida indevidamente';

  ASSERT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fornecedores_cnpj_valido' AND contype = 'c'
  ), 'FAIL: constraint fornecedores_cnpj_valido foi removida indevidamente';

  -- Indices unicos parciais diretos
  ASSERT EXISTS (
    SELECT 1 FROM pg_class WHERE relname = 'clientes_cnpj_uidx' AND relnamespace = 'public'::regnamespace
  ), 'FAIL: indice clientes_cnpj_uidx foi removido indevidamente';

  ASSERT EXISTS (
    SELECT 1 FROM pg_class WHERE relname = 'fornecedores_cnpj_uidx' AND relnamespace = 'public'::regnamespace
  ), 'FAIL: indice fornecedores_cnpj_uidx foi removido indevidamente';

  -- ===========================================================
  -- COMPORTAMENTO DIRETO (transacional, revertido ao final)
  -- ===========================================================

  -- Cliente sem CNPJ
  INSERT INTO public.clientes (nome)
  VALUES (v_tag || '_cliente_sem_cnpj')
  RETURNING id INTO v_cliente_sem_cnpj;
  ASSERT (SELECT cnpj IS NULL FROM public.clientes WHERE id = v_cliente_sem_cnpj),
    'FAIL: cadastro de Cliente sem CNPJ nao permitido';

  -- Fornecedor sem CNPJ
  INSERT INTO public.fornecedores (nome, tipo)
  VALUES (v_tag || '_fornecedor_sem_cnpj', v_tipo)
  RETURNING id INTO v_fornecedor_sem_cnpj;
  ASSERT (SELECT cnpj IS NULL FROM public.fornecedores WHERE id = v_fornecedor_sem_cnpj),
    'FAIL: cadastro de Fornecedor sem CNPJ nao permitido';

  -- CNPJ valido em Cliente
  INSERT INTO public.clientes (nome, cnpj)
  VALUES (v_tag || '_cliente_valido', '11222333000181')
  RETURNING id INTO v_cliente_valido;
  ASSERT (SELECT cnpj = '11222333000181' FROM public.clientes WHERE id = v_cliente_valido),
    'FAIL: CNPJ valido rejeitado em Cliente';

  -- CNPJ valido em Fornecedor (mesmo CNPJ, categoria diferente)
  INSERT INTO public.fornecedores (nome, tipo, cnpj)
  VALUES (v_tag || '_fornecedor_valido', v_tipo, '11222333000181')
  RETURNING id INTO v_fornecedor_valido;
  ASSERT (SELECT cnpj = '11222333000181' FROM public.fornecedores WHERE id = v_fornecedor_valido),
    'FAIL: mesmo CNPJ em categoria diferente nao permitido';

  -- Duplicidade rejeitada dentro de Clientes
  BEGIN
    INSERT INTO public.clientes (nome, cnpj)
    VALUES (v_tag || '_cliente_duplicado', '11222333000181');
    RAISE EXCEPTION 'FAIL: CNPJ duplicado em Clientes foi aceito';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;

  -- Duplicidade rejeitada dentro de Fornecedores
  BEGIN
    INSERT INTO public.fornecedores (nome, tipo, cnpj)
    VALUES (v_tag || '_fornecedor_duplicado', 'latex', '11222333000181');
    RAISE EXCEPTION 'FAIL: CNPJ duplicado em Fornecedores foi aceito';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;

  -- CNPJ invalido rejeitado (DV errado)
  BEGIN
    INSERT INTO public.clientes (nome, cnpj)
    VALUES (v_tag || '_cliente_dv_errado', '11222333000180');
    RAISE EXCEPTION 'FAIL: CNPJ com DV invalido foi aceito';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  BEGIN
    INSERT INTO public.fornecedores (nome, tipo, cnpj)
    VALUES (v_tag || '_fornecedor_dv_errado', 'fio_algodao', '11222333000180');
    RAISE EXCEPTION 'FAIL: CNPJ com DV invalido foi aceito';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  -- CNPJ pontuado rejeitado
  BEGIN
    INSERT INTO public.clientes (nome, cnpj)
    VALUES (v_tag || '_cliente_pontuado', '11.222.333/0001-81');
    RAISE EXCEPTION 'FAIL: CNPJ pontuado foi aceito';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  -- ------------------------------------------------------------
  -- Limpeza sintetica
  -- ------------------------------------------------------------
  DELETE FROM public.clientes WHERE id IN (v_cliente_sem_cnpj, v_cliente_valido);
  DELETE FROM public.fornecedores WHERE id IN (v_fornecedor_sem_cnpj, v_fornecedor_valido);

  -- ------------------------------------------------------------
  -- Contagens preservadas
  -- ------------------------------------------------------------
  ASSERT (SELECT COUNT(*) FROM public.clientes) = v_clientes_antes,
    'FAIL: contagem de Clientes alterada apos limpeza';
  ASSERT (SELECT COUNT(*) FROM public.fornecedores) = v_fornecedores_antes,
    'FAIL: contagem de Fornecedores alterada apos limpeza';
  ASSERT (SELECT COUNT(*) FROM public.clientes WHERE cnpj IS NOT NULL) = v_clientes_cnpj_antes,
    'FAIL: contagem de CNPJs diretos em Clientes alterada';
  ASSERT (SELECT COUNT(*) FROM public.fornecedores WHERE cnpj IS NOT NULL) = v_fornecedores_cnpj_antes,
    'FAIL: contagem de CNPJs diretos em Fornecedores alterada';

  RAISE NOTICE 'ALL REMOVE LEGACY PARTNER CNPJ VERIFY ASSERTIONS PASSED';
END;
$$;

ROLLBACK;
