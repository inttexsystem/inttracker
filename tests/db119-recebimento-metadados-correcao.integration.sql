-- tests/db119-recebimento-metadados-correcao.integration.sql
--
-- db/119 — administrative correction of native receipt metadata.
--
-- Proves POSITIVELY that an admin corrects exactly the four authorized
-- metadata fields and that the corrected values are what the database then
-- returns; and NEGATIVELY that no other actor reaches the path, that no
-- physical or provenance fact can move through it, that the exactly-once
-- idempotency discriminator is untouched, that a direct mutation is still
-- refused outside the dedicated writer, and that the audit trail is
-- append-only.
--
-- Fixture expected (see the order's harness bootstrap): receipt header 6001
-- ('recebimento', ordem 9001, admin actor ad001), reversal header 6002
-- ('estorno'), ledger line 5001, allocation 7001, item 8001.

\set ON_ERROR_STOP on

DO $t$
DECLARE
  v_admin      CONSTANT UUID   := '9d1f0000-0000-4000-8000-0000000ad001';
  v_fornecedor CONSTANT UUID   := '9d1f0000-0000-4000-8000-0000000ad002';
  v_inativo    CONSTANT UUID   := '9d1f0000-0000-4000-8000-0000000ad003';
  v_rec        CONSTANT BIGINT := 6001;
  v_estorno    CONSTANT BIGINT := 6002;
  v_res        JSONB;
  v_h          public.ordem_compra_recebimentos%ROWTYPE;
  v_payload_antes JSONB;
  v_hash_antes    TEXT;
  v_ledger_antes  TEXT;
  v_ledger_depois TEXT;
  v_n          BIGINT;
  v_role       TEXT;
BEGIN
  SELECT comando_payload, comando_hash INTO v_payload_antes, v_hash_antes
  FROM public.ordem_compra_recebimentos WHERE id = v_rec;

  SELECT md5(string_agg(l.id::TEXT || ':' || l.kg_recebido::TEXT || ':' || l.kg_excesso::TEXT
         || ':' || COALESCE(l.ordem_compra_item_alocacao_id::TEXT, '')
         || ':' || COALESCE(l.op_id::TEXT, '')
         || ':' || COALESCE(l.data_recebimento::TEXT, ''), '|' ORDER BY l.id))
  INTO v_ledger_antes FROM public.ordem_compra_fio_lancamentos l;

  -- =================================================================
  -- H. Only an active administrator reaches the correction path
  -- =================================================================
  PERFORM set_config('request.jwt.claim.sub', '', false);
  v_res := public.corrigir_metadados_recebimento_ordem_compra(
    v_rec, '2026-07-01T00:00:00Z', 'X', 'nota_fiscal', 'Y');
  IF v_res ->> 'codigo' <> 'sem_permissao' THEN
    RAISE EXCEPTION 'not ok - unauthenticated reached the correction path: %', v_res;
  END IF;

  PERFORM set_config('request.jwt.claim.sub', v_fornecedor::text, false);
  v_res := public.corrigir_metadados_recebimento_ordem_compra(
    v_rec, '2026-07-01T00:00:00Z', 'X', 'nota_fiscal', 'Y');
  IF v_res ->> 'codigo' <> 'sem_permissao' THEN
    RAISE EXCEPTION 'not ok - a fornecedor reached the correction path: %', v_res;
  END IF;

  PERFORM set_config('request.jwt.claim.sub', v_inativo::text, false);
  v_res := public.corrigir_metadados_recebimento_ordem_compra(
    v_rec, '2026-07-01T00:00:00Z', 'X', 'nota_fiscal', 'Y');
  IF v_res ->> 'codigo' <> 'sem_permissao' THEN
    RAISE EXCEPTION 'not ok - an INACTIVE admin reached the correction path: %', v_res;
  END IF;
  RAISE NOTICE 'ok - H: unauthenticated, fornecedor and inactive admin are all refused';

  -- The writer is reachable by authenticated only.
  IF NOT has_function_privilege('authenticated',
       'public.corrigir_metadados_recebimento_ordem_compra(bigint,timestamptz,text,text,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'not ok - authenticated cannot execute the correction writer';
  END IF;
  FOREACH v_role IN ARRAY ARRAY['anon', 'service_role'] LOOP
    IF has_function_privilege(v_role,
         'public.corrigir_metadados_recebimento_ordem_compra(bigint,timestamptz,text,text,text)', 'EXECUTE') THEN
      RAISE EXCEPTION 'not ok - % can execute the correction writer', v_role;
    END IF;
  END LOOP;
  RAISE NOTICE 'ok - H: EXECUTE is granted to authenticated and to nobody else';

  -- =================================================================
  -- Input validation (server-owned, not client-owned)
  -- =================================================================
  PERFORM set_config('request.jwt.claim.sub', v_admin::text, false);

  v_res := public.corrigir_metadados_recebimento_ordem_compra(v_rec, NULL, 'X', 'nota_fiscal', 'Y');
  IF v_res ->> 'codigo' <> 'comando_invalido' THEN
    RAISE EXCEPTION 'not ok - a NULL business date was accepted: %', v_res;
  END IF;
  v_res := public.corrigir_metadados_recebimento_ordem_compra(v_rec, '2026-07-01T00:00:00Z', 'X', '   ', 'Y');
  IF v_res ->> 'codigo' <> 'comando_invalido' THEN
    RAISE EXCEPTION 'not ok - a blank origin type was accepted: %', v_res;
  END IF;
  v_res := public.corrigir_metadados_recebimento_ordem_compra(999999, '2026-07-01T00:00:00Z', 'X', 'nota_fiscal', 'Y');
  IF v_res ->> 'codigo' <> 'nao_encontrado' THEN
    RAISE EXCEPTION 'not ok - an unknown receipt was accepted: %', v_res;
  END IF;
  RAISE NOTICE 'ok - required date, required origin type and unknown receipt all refused';

  -- =================================================================
  -- A reversal header is NOT correctable through this path
  -- =================================================================
  v_res := public.corrigir_metadados_recebimento_ordem_compra(
    v_estorno, '2026-07-01T00:00:00Z', 'X', 'nota_fiscal', 'Y');
  IF v_res ->> 'codigo' <> 'estado_invalido' THEN
    RAISE EXCEPTION 'not ok - a reversal header was correctable: %', v_res;
  END IF;
  RAISE NOTICE 'ok - F: a reversal header is refused (estado_invalido)';

  -- =================================================================
  -- A. The admin corrects exactly the four authorized fields
  -- =================================================================
  v_res := public.corrigir_metadados_recebimento_ordem_compra(
    v_rec, '2026-06-05T00:00:00Z', '  NF 1234  ', '  nota_fiscal  ', '  serie B  ');
  IF COALESCE((v_res ->> 'ok')::BOOLEAN, FALSE) IS NOT TRUE THEN
    RAISE EXCEPTION 'not ok - the admin correction failed: %', v_res;
  END IF;
  IF (v_res ->> 'alterado')::BOOLEAN IS NOT TRUE THEN
    RAISE EXCEPTION 'not ok - an effective correction reported alterado = false: %', v_res;
  END IF;

  SELECT * INTO v_h FROM public.ordem_compra_recebimentos WHERE id = v_rec;
  IF v_h.ocorrido_em <> '2026-06-05T00:00:00Z'::TIMESTAMPTZ THEN
    RAISE EXCEPTION 'not ok - the business date did not take: %', v_h.ocorrido_em;
  END IF;
  -- Normalization matches the db/74 writer: btrim, and '' collapses to NULL.
  IF v_h.documento_ref <> 'NF 1234' OR v_h.origem_tipo <> 'nota_fiscal' OR v_h.origem_ref <> 'serie B' THEN
    RAISE EXCEPTION 'not ok - metadata not normalized as the writer normalizes: %/%/%',
      v_h.documento_ref, v_h.origem_tipo, v_h.origem_ref;
  END IF;
  RAISE NOTICE 'ok - A/B: the four fields are corrected and are what the database returns';

  -- =================================================================
  -- Idempotency discriminator untouched (db/74 exactly-once preserved)
  -- =================================================================
  IF v_h.comando_payload IS DISTINCT FROM v_payload_antes
     OR v_h.comando_hash IS DISTINCT FROM v_hash_antes THEN
    RAISE EXCEPTION 'not ok - the correction moved comando_payload/comando_hash';
  END IF;
  RAISE NOTICE 'ok - comando_payload and comando_hash are byte-identical (replay detection intact)';

  -- =================================================================
  -- C/D/E/F/G. No physical, provenance or availability fact moved
  -- =================================================================
  SELECT md5(string_agg(l.id::TEXT || ':' || l.kg_recebido::TEXT || ':' || l.kg_excesso::TEXT
         || ':' || COALESCE(l.ordem_compra_item_alocacao_id::TEXT, '')
         || ':' || COALESCE(l.op_id::TEXT, '')
         || ':' || COALESCE(l.data_recebimento::TEXT, ''), '|' ORDER BY l.id))
  INTO v_ledger_depois FROM public.ordem_compra_fio_lancamentos l;
  IF v_ledger_depois IS DISTINCT FROM v_ledger_antes THEN
    RAISE EXCEPTION 'not ok - C: a ledger line moved (kg / allocation / excess / OP / date)';
  END IF;

  SELECT count(*) INTO v_n FROM public.ordem_compra_recebimentos;
  IF v_n <> 2 THEN RAISE EXCEPTION 'not ok - E: the receipt header count moved to %', v_n; END IF;
  SELECT count(*) INTO v_n FROM public.ordem_compra_fio_lancamentos;
  IF v_n <> 1 THEN RAISE EXCEPTION 'not ok - E/F: the ledger line count moved to %', v_n; END IF;
  SELECT count(*) INTO v_n FROM public.ordem_compra_fio_movimentos_estoque;
  IF v_n <> 0 THEN RAISE EXCEPTION 'not ok - G: an inventory movement appeared'; END IF;
  IF (SELECT kg_alocado FROM public.ordem_compra_item_alocacao WHERE id = 7001) <> 860.100 THEN
    RAISE EXCEPTION 'not ok - D: the allocation moved';
  END IF;
  IF (SELECT kg_recebido FROM public.ordem_compra_item WHERE id = 8001) <> 860.100 THEN
    RAISE EXCEPTION 'not ok - C: the item received kg moved';
  END IF;
  RAISE NOTICE 'ok - C/D/E/F/G: ledger, allocation, item kg, receipt count, reversal count and movements unchanged';

  -- =================================================================
  -- A no-op correction writes nothing at all
  -- =================================================================
  SELECT count(*) INTO v_n FROM public.ordem_compra_recebimento_metadados_correcoes;
  IF v_n <> 1 THEN RAISE EXCEPTION 'not ok - expected exactly 1 audit row, found %', v_n; END IF;

  v_res := public.corrigir_metadados_recebimento_ordem_compra(
    v_rec, '2026-06-05T00:00:00Z', 'NF 1234', 'nota_fiscal', 'serie B');
  IF (v_res ->> 'alterado')::BOOLEAN IS NOT FALSE THEN
    RAISE EXCEPTION 'not ok - an identical correction reported a change: %', v_res;
  END IF;
  SELECT count(*) INTO v_n FROM public.ordem_compra_recebimento_metadados_correcoes;
  IF v_n <> 1 THEN RAISE EXCEPTION 'not ok - a no-op correction wrote an audit row'; END IF;
  RAISE NOTICE 'ok - an identical correction is a no-op: alterado = false, no audit row';

  -- =================================================================
  -- The audit row records before/after and the actor, with no reason field
  -- =================================================================
  IF NOT EXISTS (
    SELECT 1 FROM public.ordem_compra_recebimento_metadados_correcoes
    WHERE recebimento_id = v_rec AND ator_id = v_admin
      AND origem_tipo_antes = 'historico_sem_documento'
      AND origem_tipo_depois = 'nota_fiscal'
      AND documento_ref_antes IS NULL AND documento_ref_depois = 'NF 1234'
  ) THEN
    RAISE EXCEPTION 'not ok - the audit row does not carry the real before/after';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'ordem_compra_recebimento_metadados_correcoes'
      AND column_name IN ('motivo', 'justificativa', 'razao')
  ) THEN
    RAISE EXCEPTION 'not ok - the audit table demands a correction reason';
  END IF;
  RAISE NOTICE 'ok - audit records actor and before/after, and asks for no reason';

  -- =================================================================
  -- I. Arbitrary direct mutation is still refused outside the writer
  -- =================================================================
  BEGIN
    UPDATE public.ordem_compra_recebimentos SET documento_ref = 'HACK' WHERE id = v_rec;
    RAISE EXCEPTION 'not ok - I: a direct metadata UPDATE succeeded outside the writer';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE '%is immutable%' THEN RAISE; END IF;
  END;

  BEGIN
    DELETE FROM public.ordem_compra_recebimentos WHERE id = v_rec;
    RAISE EXCEPTION 'not ok - I: a receipt header was deleted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE '%is immutable%' THEN RAISE; END IF;
  END;

  -- Even holding the guard token, a PHYSICAL/identity column cannot move.
  BEGIN
    PERFORM set_config('oc.correcao_metadados_recebimento', v_rec::TEXT, TRUE);
    UPDATE public.ordem_compra_recebimentos SET comando_hash = 'ffffffffffffffffffffffffffffffff' WHERE id = v_rec;
    RAISE EXCEPTION 'not ok - I: comando_hash was mutable while the token was held';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE '%only receipt metadata%' THEN RAISE; END IF;
  END;
  PERFORM set_config('oc.correcao_metadados_recebimento', '', TRUE);

  BEGIN
    PERFORM set_config('oc.correcao_metadados_recebimento', v_rec::TEXT, TRUE);
    UPDATE public.ordem_compra_recebimentos SET ordem_compra_id = 9001, ator_tipo = 'fornecedor' WHERE id = v_rec;
    RAISE EXCEPTION 'not ok - I: ator_tipo was mutable while the token was held';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE '%only receipt metadata%' THEN RAISE; END IF;
  END;
  PERFORM set_config('oc.correcao_metadados_recebimento', '', TRUE);

  -- A token for a DIFFERENT header does not open this one.
  BEGIN
    PERFORM set_config('oc.correcao_metadados_recebimento', v_estorno::TEXT, TRUE);
    UPDATE public.ordem_compra_recebimentos SET documento_ref = 'HACK' WHERE id = v_rec;
    RAISE EXCEPTION 'not ok - I: a foreign header token opened this header';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE '%is immutable%' THEN RAISE; END IF;
  END;
  PERFORM set_config('oc.correcao_metadados_recebimento', '', TRUE);
  RAISE NOTICE 'ok - I: direct UPDATE/DELETE refused; physical and identity columns refused even with the token; a foreign token does not open the row';

  -- No client role holds direct DML on the header or the audit table.
  FOREACH v_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF has_table_privilege(v_role, 'public.ordem_compra_recebimentos', 'UPDATE')
       OR has_table_privilege(v_role, 'public.ordem_compra_recebimentos', 'DELETE') THEN
      RAISE EXCEPTION 'not ok - I: % holds direct UPDATE/DELETE on the receipt header', v_role;
    END IF;
    IF has_table_privilege(v_role, 'public.ordem_compra_recebimento_metadados_correcoes', 'SELECT')
       OR has_table_privilege(v_role, 'public.ordem_compra_recebimento_metadados_correcoes', 'INSERT') THEN
      RAISE EXCEPTION 'not ok - % reaches the audit table directly', v_role;
    END IF;
  END LOOP;
  RAISE NOTICE 'ok - I: no client role holds direct DML on the header or the audit table';

  -- =================================================================
  -- The audit trail is itself append-only
  -- =================================================================
  BEGIN
    UPDATE public.ordem_compra_recebimento_metadados_correcoes SET origem_tipo_depois = 'x';
    RAISE EXCEPTION 'not ok - the audit trail was editable';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE '%append-only%' THEN RAISE; END IF;
  END;
  BEGIN
    DELETE FROM public.ordem_compra_recebimento_metadados_correcoes;
    RAISE EXCEPTION 'not ok - the audit trail was erasable';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE '%append-only%' THEN RAISE; END IF;
  END;
  RAISE NOTICE 'ok - the correction audit trail is append-only';

  RAISE NOTICE 'ALL DB119 ASSERTIONS PASSED';
END;
$t$;
