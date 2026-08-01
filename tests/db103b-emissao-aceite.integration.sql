-- tests/db103b-emissao-aceite.integration.sql
--
-- db/103b (9.9.E, phase P4) — supplier-level emission acceptance and the
-- demotion of the global configuration singleton.
--
-- Proves POSITIVELY that emission now freezes fornecedores.exige_aceite,
-- and NEGATIVELY that the demoted global column can no longer be changed
-- and is no longer read by any emission path.

\set ON_ERROR_STOP on

DO $t$
DECLARE
  v_admin   CONSTANT UUID   := '9d1f0000-0000-4000-8000-00000000ad01';
  v_forn_a  CONSTANT BIGINT := 940000401;   -- cotton supplier of the fixture
  v_forn_b  CONSTANT BIGINT := 940000402;   -- polyester supplier of the fixture
  v_ped     CONSTANT UUID   := '94f10000-0000-4000-8000-000000000001';
  v_oc_sem  CONSTANT BIGINT := 940009901;   -- draft under a supplier NOT requiring acceptance
  v_oc_com  CONSTANT BIGINT := 940009902;   -- draft under a supplier requiring acceptance
  v_nec     CONSTANT BIGINT := 940000501;
  v_res     JSONB;
  v_row     RECORD;
  v_raised  TEXT;
  v_before  BOOLEAN;
BEGIN
  PERFORM set_config('request.jwt.claim.sub', v_admin::text, false);

  -- =================================================================
  -- 1. The demoted singleton is READ-ONLY (9.9.E.3)
  -- =================================================================
  SELECT exige_aceite INTO v_before FROM public.ordem_compra_config WHERE id = 1;

  v_raised := NULL;
  BEGIN
    UPDATE public.ordem_compra_config SET exige_aceite = TRUE WHERE id = 1;
  EXCEPTION WHEN OTHERS THEN
    v_raised := SQLERRM;
  END;
  IF v_raised IS DISTINCT FROM 'config_aceite_descontinuada' THEN
    RAISE EXCEPTION 'not ok - the demoted configuration column is still writable (got %)', COALESCE(v_raised, 'NO ERROR');
  END IF;
  RAISE NOTICE 'ok - ordem_compra_config.exige_aceite refuses with config_aceite_descontinuada';

  IF (SELECT exige_aceite FROM public.ordem_compra_config WHERE id = 1) IS DISTINCT FROM v_before THEN
    RAISE EXCEPTION 'not ok - the refused UPDATE still changed the value';
  END IF;
  RAISE NOTICE 'ok - the refused UPDATE mutated nothing';

  -- Demotion is not a table freeze: the other configuration columns stay
  -- writable, so the singleton keeps working as an ordinary config row.
  UPDATE public.ordem_compra_config SET atualizado_em = now() WHERE id = 1;
  RAISE NOTICE 'ok - non-demoted configuration columns remain writable';

  -- A no-change write of the demoted column itself is NOT an authority
  -- change and must pass; the trigger keys on an actual difference.
  UPDATE public.ordem_compra_config SET exige_aceite = v_before WHERE id = 1;
  RAISE NOTICE 'ok - an idempotent no-change write of the demoted column is allowed';

  -- =================================================================
  -- 2. Emission freezes the SUPPLIER value — supplier NOT requiring it
  -- =================================================================
  UPDATE public.fornecedores SET exige_aceite = FALSE WHERE id = v_forn_a;
  UPDATE public.fornecedores SET exige_aceite = TRUE  WHERE id = v_forn_b;

  INSERT INTO public.ordem_compra
    (id, pedido_id, fornecedor_id, status_administrativo, status_aceite,
     status_recebimento, aceite_exigido_na_emissao, legado)
  VALUES
    (v_oc_sem, v_ped, v_forn_a, 'rascunho', 'nao_aplicavel', 'nao_recebido', NULL, FALSE),
    (v_oc_com, v_ped, v_forn_b, 'rascunho', 'nao_aplicavel', 'nao_recebido', NULL, FALSE)
    ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.ordem_compra_item (id, ordem_id, material, cor_id, cor_poliester, kg_pedido, kg_recebido)
  VALUES
    (940009911, v_oc_sem, 'algodao', 940000201, NULL, 100.000, 0),
    (940009912, v_oc_com, 'algodao', 940000201, NULL, 100.000, 0)
    ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.ordem_compra_item_alocacao (id, item_id, necessidade_id, op_id, kg_alocado)
  VALUES
    (940009921, 940009911, v_nec, 940000101, 100.000),
    (940009922, 940009912, v_nec, 940000101, 100.000)
    ON CONFLICT (id) DO NOTHING;

  v_res := public.emitir_ordem_compra(v_oc_sem);
  IF (v_res->>'ok')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'not ok - emission refused for the no-acceptance supplier: %', v_res::text;
  END IF;

  SELECT aceite_exigido_na_emissao, status_aceite, status_administrativo
    INTO v_row FROM public.ordem_compra WHERE id = v_oc_sem;
  IF v_row.aceite_exigido_na_emissao IS DISTINCT FROM FALSE
     OR v_row.status_aceite <> 'nao_aplicavel'
     OR v_row.status_administrativo <> 'emitida' THEN
    RAISE EXCEPTION 'not ok - wrong freeze for a supplier not requiring acceptance: %/%/%',
      v_row.aceite_exigido_na_emissao, v_row.status_aceite, v_row.status_administrativo;
  END IF;
  RAISE NOTICE 'ok - emission froze false / nao_aplicavel from the supplier column';

  -- =================================================================
  -- 3. Emission freezes the SUPPLIER value — supplier REQUIRING it
  --
  -- The global singleton is still FALSE here. Under the db/77 behaviour
  -- this order would have been frozen as nao_aplicavel; under db/103b the
  -- SUPPLIER decides. That contrast is the authority switch itself.
  -- =================================================================
  IF (SELECT exige_aceite FROM public.ordem_compra_config WHERE id = 1) IS DISTINCT FROM FALSE THEN
    RAISE EXCEPTION 'not ok - the contrast requires the demoted global value to be FALSE';
  END IF;

  v_res := public.emitir_ordem_compra(v_oc_com);
  IF (v_res->>'ok')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'not ok - emission refused for the acceptance-requiring supplier: %', v_res::text;
  END IF;

  SELECT aceite_exigido_na_emissao, status_aceite INTO v_row
    FROM public.ordem_compra WHERE id = v_oc_com;
  IF v_row.aceite_exigido_na_emissao IS DISTINCT FROM TRUE
     OR v_row.status_aceite <> 'pendente' THEN
    RAISE EXCEPTION 'not ok - the supplier requirement was not frozen: %/%',
      v_row.aceite_exigido_na_emissao, v_row.status_aceite;
  END IF;
  IF (v_res->>'status_aceite') <> 'pendente' THEN
    RAISE EXCEPTION 'not ok - the emission envelope did not report pendente: %', v_res::text;
  END IF;
  RAISE NOTICE 'ok - emission froze true / pendente from the SUPPLIER while the global value was false';

  -- Provenance is recorded on the emission event.
  IF NOT EXISTS (
    SELECT 1 FROM public.ordem_compra_eventos
     WHERE ordem_compra_id = v_oc_com
       AND tipo_evento = 'emitida'
       AND payload->>'aceite_origem' = 'fornecedor'
       AND (payload->>'fornecedor_id')::bigint = v_forn_b
  ) THEN
    RAISE EXCEPTION 'not ok - the emission event does not record supplier provenance';
  END IF;
  RAISE NOTICE 'ok - the emission event records aceite_origem=fornecedor and the supplier id';

  -- =================================================================
  -- 4. Emission is still admin-only and still validates everything
  -- =================================================================
  PERFORM set_config('request.jwt.claim.sub', '9d1f0000-0000-4000-8000-00000000ad03', false);
  v_res := public.emitir_ordem_compra(v_oc_sem);
  IF (v_res->>'codigo') <> 'sem_permissao' THEN
    RAISE EXCEPTION 'not ok - a non-admin reached emission: %', v_res::text;
  END IF;
  RAISE NOTICE 'ok - a non-admin is refused with sem_permissao';

  PERFORM set_config('request.jwt.claim.sub', v_admin::text, false);
  v_res := public.emitir_ordem_compra(v_oc_sem);
  IF (v_res->>'codigo') <> 'estado_invalido' THEN
    RAISE EXCEPTION 'not ok - re-emitting an emitted order was not refused: %', v_res::text;
  END IF;
  RAISE NOTICE 'ok - only rascunho can be emitted';

  -- =================================================================
  -- 5. The live corpus was not reclassified
  -- =================================================================
  IF EXISTS (
    SELECT 1 FROM public.ordem_compra
     WHERE id IN (940000801, 940000802)
       AND (aceite_exigido_na_emissao, status_aceite) IS DISTINCT FROM
           (CASE WHEN id = 940000801 THEN TRUE ELSE FALSE END,
            CASE WHEN id = 940000801 THEN 'pendente' ELSE 'nao_aplicavel' END)
  ) THEN
    RAISE EXCEPTION 'not ok - a pre-existing Purchase Order was reclassified';
  END IF;
  RAISE NOTICE 'ok - pre-existing Purchase Orders keep their frozen acceptance state';

  -- =================================================================
  -- 6. No emission path reads the demoted singleton any more
  -- =================================================================
  -- Matched as a SQL REFERENCE, not as a bare name: the body's explanatory
  -- comment names the demoted table in prose.
  IF EXISTS (
    SELECT 1 FROM pg_proc p
     WHERE p.pronamespace = 'public'::regnamespace
       AND p.proname = 'emitir_ordem_compra'
       AND p.prosrc ~* '(from|join|into|update)[[:space:]]+public\.ordem_compra_config'
  ) THEN
    RAISE EXCEPTION 'not ok - emitir_ordem_compra still reads the demoted configuration';
  END IF;
  RAISE NOTICE 'ok - emitir_ordem_compra no longer reads ordem_compra_config';

  RAISE NOTICE 'DB103B_EMISSAO_ACEITE_PASS';
END
$t$;
