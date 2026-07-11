-- ============================================================
-- Verify transacional de 47_document_candidate_cnpj.sql.
-- Executar somente em staging apos aplicar a migration.
-- ============================================================

BEGIN;

DO $$
DECLARE
  v_count_before INTEGER;
  v_versions_before JSONB;
  v_null_id UUID;
  v_emitente_id UUID;
  v_destinatario_id UUID;
  v_ambos_id UUID;
  v_tag TEXT := '__verify_document_candidate_cnpj_' || txid_current()::TEXT;
  v_emitente_attnum SMALLINT;
  v_destinatario_attnum SMALLINT;
  v_tipo TEXT;
  v_not_null BOOLEAN;
BEGIN
  SELECT COUNT(*) INTO v_count_before FROM public.document_candidates;
  SELECT COALESCE(jsonb_agg(jsonb_build_object('value', schema_version, 'count', quantidade) ORDER BY schema_version), '[]'::jsonb)
    INTO v_versions_before
  FROM (
    SELECT schema_version, COUNT(*)::INTEGER AS quantidade
    FROM public.document_candidates
    GROUP BY schema_version
  ) versions;

  SELECT pg_catalog.format_type(a.atttypid, a.atttypmod), a.attnotnull, a.attnum
    INTO v_tipo, v_not_null, v_emitente_attnum
  FROM pg_attribute a
  WHERE a.attrelid = 'public.document_candidates'::regclass
    AND a.attname = 'cnpj_emitente'
    AND a.attnum > 0
    AND NOT a.attisdropped;
  ASSERT v_tipo = 'text', 'cnpj_emitente deve existir como TEXT';
  ASSERT NOT v_not_null, 'cnpj_emitente deve aceitar NULL';

  SELECT pg_catalog.format_type(a.atttypid, a.atttypmod), a.attnotnull, a.attnum
    INTO v_tipo, v_not_null, v_destinatario_attnum
  FROM pg_attribute a
  WHERE a.attrelid = 'public.document_candidates'::regclass
    AND a.attname = 'cnpj_destinatario'
    AND a.attnum > 0
    AND NOT a.attisdropped;
  ASSERT v_tipo = 'text', 'cnpj_destinatario deve existir como TEXT';
  ASSERT NOT v_not_null, 'cnpj_destinatario deve aceitar NULL';

  ASSERT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'document_candidates_cnpj_emitente_format_chk'
      AND conrelid = 'public.document_candidates'::regclass
      AND contype = 'c'
  ), 'CHECK de cnpj_emitente ausente';
  ASSERT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'document_candidates_cnpj_destinatario_format_chk'
      AND conrelid = 'public.document_candidates'::regclass
      AND contype = 'c'
  ), 'CHECK de cnpj_destinatario ausente';

  ASSERT NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.document_candidates'::regclass
      AND contype = 'f'
      AND (v_emitente_attnum = ANY(conkey) OR v_destinatario_attnum = ANY(conkey))
  ), 'CNPJs documentais nao podem ter FK';
  ASSERT NOT EXISTS (
    SELECT 1 FROM pg_index
    WHERE indrelid = 'public.document_candidates'::regclass
      AND indisunique
      AND (v_emitente_attnum = ANY(indkey) OR v_destinatario_attnum = ANY(indkey))
  ), 'CNPJs documentais nao podem ter unicidade';

  ASSERT (SELECT COUNT(*) FROM public.document_candidates WHERE cnpj_emitente IS NOT NULL OR cnpj_destinatario IS NOT NULL) = 0,
    'registros existentes devem permanecer sem CNPJ documental';

  INSERT INTO public.document_candidates (document_id)
  VALUES (v_tag || '_null')
  RETURNING id INTO v_null_id;
  ASSERT (SELECT cnpj_emitente IS NULL AND cnpj_destinatario IS NULL FROM public.document_candidates WHERE id = v_null_id),
    'NULL deve ser aceito nos dois campos';

  INSERT INTO public.document_candidates (document_id, cnpj_emitente)
  VALUES (v_tag || '_emitente', '11222333000181')
  RETURNING id INTO v_emitente_id;

  INSERT INTO public.document_candidates (document_id, cnpj_destinatario)
  VALUES (v_tag || '_destinatario', '11222333000181')
  RETURNING id INTO v_destinatario_id;

  INSERT INTO public.document_candidates (document_id, cnpj_emitente, cnpj_destinatario)
  VALUES (v_tag || '_ambos', '11222333000181', '11222333000181')
  RETURNING id INTO v_ambos_id;

  BEGIN
    INSERT INTO public.document_candidates (document_id, cnpj_emitente)
    VALUES (v_tag || '_pontuado', '11.222.333/0001-81');
    RAISE EXCEPTION 'FAIL: CNPJ pontuado foi aceito';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    INSERT INTO public.document_candidates (document_id, cnpj_emitente)
    VALUES (v_tag || '_curto', '1122233300018');
    RAISE EXCEPTION 'FAIL: CNPJ curto foi aceito';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    INSERT INTO public.document_candidates (document_id, cnpj_destinatario)
    VALUES (v_tag || '_longo', '112223330001810');
    RAISE EXCEPTION 'FAIL: CNPJ longo foi aceito';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    INSERT INTO public.document_candidates (document_id, cnpj_destinatario)
    VALUES (v_tag || '_letras', 'ABCDEFGHIJKLMN');
    RAISE EXCEPTION 'FAIL: CNPJ com letras foi aceito';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  DELETE FROM public.document_candidates
  WHERE id IN (v_null_id, v_emitente_id, v_destinatario_id, v_ambos_id);

  ASSERT (SELECT COUNT(*) FROM public.document_candidates) = v_count_before,
    'contagem de candidates nao voltou ao estado anterior';
  ASSERT (SELECT COUNT(*) FROM public.document_candidates WHERE cnpj_emitente IS NOT NULL OR cnpj_destinatario IS NOT NULL) = 0,
    'CNPJs documentais nao podem permanecer apos cleanup';
  ASSERT (
    SELECT COALESCE(jsonb_agg(jsonb_build_object('value', schema_version, 'count', quantidade) ORDER BY schema_version), '[]'::jsonb)
    FROM (SELECT schema_version, COUNT(*)::INTEGER AS quantidade FROM public.document_candidates GROUP BY schema_version) versions
  ) = v_versions_before, 'schema_version dos registros existentes foi alterado';

  RAISE NOTICE 'ALL DOCUMENT CANDIDATE CNPJ VERIFY ASSERTIONS PASSED';
END;
$$;

ROLLBACK;
