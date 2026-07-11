-- ============================================================
-- Verificacao transacional de 45_direct_entity_cnpj_expand.sql.
-- Executar somente em STAGING apos aplicar a migration.
-- Todos os registros sinteticos sao removidos e a transacao e revertida.
-- ============================================================

BEGIN;

DO $$
DECLARE
  v_clientes_antes INTEGER;
  v_fornecedores_antes INTEGER;
  v_cliente_sem_cnpj BIGINT;
  v_cliente_valido BIGINT;
  v_fornecedor_valido BIGINT;
  v_tag TEXT := '__verify_direct_cnpj_b1_' || txid_current()::TEXT;
  v_tipo TEXT := 'tecelagem';
  v_tipo_coluna TEXT;
  v_fornecedor_tipo_coluna TEXT;
  v_cliente_not_null BOOLEAN;
  v_fornecedor_not_null BOOLEAN;
BEGIN
  SELECT COUNT(*) INTO v_clientes_antes FROM public.clientes;
  SELECT COUNT(*) INTO v_fornecedores_antes FROM public.fornecedores;

  SELECT pg_catalog.format_type(a.atttypid, a.atttypmod), a.attnotnull
    INTO v_tipo_coluna, v_cliente_not_null
  FROM pg_attribute a
  WHERE a.attrelid = 'public.clientes'::regclass
    AND a.attname = 'cnpj'
    AND a.attnum > 0
    AND NOT a.attisdropped;
  ASSERT v_tipo_coluna = 'text', 'clientes.cnpj deve existir como TEXT';
  ASSERT NOT v_cliente_not_null, 'clientes.cnpj deve aceitar NULL';

  SELECT pg_catalog.format_type(a.atttypid, a.atttypmod), a.attnotnull
    INTO v_fornecedor_tipo_coluna, v_fornecedor_not_null
  FROM pg_attribute a
  WHERE a.attrelid = 'public.fornecedores'::regclass
    AND a.attname = 'cnpj'
    AND a.attnum > 0
    AND NOT a.attisdropped;
  ASSERT v_fornecedor_tipo_coluna = 'text', 'fornecedores.cnpj deve existir como TEXT';
  ASSERT NOT v_fornecedor_not_null, 'fornecedores.cnpj deve aceitar NULL';

  ASSERT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'clientes_cnpj_valido'
      AND conrelid = 'public.clientes'::regclass
      AND contype = 'c'
  ), 'constraint de CNPJ de Cliente ausente';
  ASSERT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fornecedores_cnpj_valido'
      AND conrelid = 'public.fornecedores'::regclass
      AND contype = 'c'
  ), 'constraint de CNPJ de Fornecedor ausente';

  ASSERT EXISTS (
    SELECT 1 FROM pg_index i
    JOIN pg_class idx ON idx.oid = i.indexrelid
    WHERE idx.relname = 'clientes_cnpj_uidx'
      AND i.indrelid = 'public.clientes'::regclass
      AND i.indisunique
      AND i.indpred IS NOT NULL
  ), 'indice unico parcial de Cliente ausente';
  ASSERT EXISTS (
    SELECT 1 FROM pg_index i
    JOIN pg_class idx ON idx.oid = i.indexrelid
    WHERE idx.relname = 'fornecedores_cnpj_uidx'
      AND i.indrelid = 'public.fornecedores'::regclass
      AND i.indisunique
      AND i.indpred IS NOT NULL
  ), 'indice unico parcial de Fornecedor ausente';

  ASSERT NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE contype = 'f'
      AND (
        (conrelid = 'public.clientes'::regclass AND confrelid = 'public.fornecedores'::regclass)
        OR (conrelid = 'public.fornecedores'::regclass AND confrelid = 'public.clientes'::regclass)
      )
  ), 'nao pode existir FK entre Clientes e Fornecedores';

  INSERT INTO public.clientes (nome)
  VALUES (v_tag || '_cliente_sem_cnpj')
  RETURNING id INTO v_cliente_sem_cnpj;
  ASSERT (SELECT cnpj IS NULL FROM public.clientes WHERE id = v_cliente_sem_cnpj),
    'cadastro sem CNPJ deve ser permitido';

  INSERT INTO public.clientes (nome, cnpj)
  VALUES (v_tag || '_cliente_valido', '11222333000181')
  RETURNING id INTO v_cliente_valido;

  INSERT INTO public.fornecedores (nome, tipo, cnpj)
  VALUES (v_tag || '_fornecedor_valido', v_tipo, '11222333000181')
  RETURNING id INTO v_fornecedor_valido;

  ASSERT (SELECT cnpj = '11222333000181' FROM public.clientes WHERE id = v_cliente_valido),
    'CNPJ valido deve ser aceito em Cliente';
  ASSERT (SELECT cnpj = '11222333000181' FROM public.fornecedores WHERE id = v_fornecedor_valido),
    'mesmo CNPJ deve ser aceito em Fornecedor';

  BEGIN
    INSERT INTO public.clientes (nome, cnpj)
    VALUES (v_tag || '_cliente_duplicado', '11222333000181');
    RAISE EXCEPTION 'FAIL: duplicidade de CNPJ em Clientes foi aceita';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;

  BEGIN
    INSERT INTO public.fornecedores (nome, tipo, cnpj)
    VALUES (v_tag || '_fornecedor_duplicado', 'latex', '11222333000181');
    RAISE EXCEPTION 'FAIL: duplicidade de CNPJ em Fornecedores foi aceita';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;

  BEGIN
    INSERT INTO public.clientes (nome, cnpj)
    VALUES (v_tag || '_cliente_dv_invalido', '11222333000180');
    RAISE EXCEPTION 'FAIL: CNPJ com DV invalido foi aceito';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  BEGIN
    INSERT INTO public.fornecedores (nome, tipo, cnpj)
    VALUES (v_tag || '_fornecedor_pontuado', 'fio_algodao', '11.222.333/0001-81');
    RAISE EXCEPTION 'FAIL: CNPJ pontuado foi aceito';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  DELETE FROM public.clientes
  WHERE id IN (v_cliente_sem_cnpj, v_cliente_valido);
  DELETE FROM public.fornecedores
  WHERE id = v_fornecedor_valido;

  ASSERT (SELECT COUNT(*) FROM public.clientes) = v_clientes_antes,
    'contagem de Clientes nao voltou ao estado anterior';
  ASSERT (SELECT COUNT(*) FROM public.fornecedores) = v_fornecedores_antes,
    'contagem de Fornecedores nao voltou ao estado anterior';

  RAISE NOTICE 'ALL DIRECT CNPJ EXPAND VERIFY ASSERTIONS PASSED';
END;
$$;

ROLLBACK;
