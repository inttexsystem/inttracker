-- tests/planejamento-compra-db99.integration.sql
--
-- PURCHASE-PLANNING-REFOUNDATION-R1 — SQL assertion suite for db/99.
--
-- Driven by tests/planejamento-compra-db99.integration.mjs against a
-- disposable cluster carrying preamble + db/01..db/99 + the C3D corpus + the
-- native planning fixture. Every mutation below goes through a real RPC as a
-- real `authenticated` administrator; nothing is planted behind the triggers.
--
-- Success marker: DB99_PLANEJAMENTO_INTEGRATION_PASS
-- Any failed proof raises and ON_ERROR_STOP aborts before the marker.

\set ON_ERROR_STOP on

\set ADMIN     '9d1f0000-0000-4000-8000-00000000ad01'
\set PEDIDO    '9d1f0000-0000-4000-8000-00000000ed01'
\set NEED_A    930000501
\set NEED_B    930000502
\set NEED_C    930000503
\set FORN_P_A  930000401
\set FORN_P_B  930000402
\set FORN_ALGO 930000301

-- Become the real authenticated administrator.
SELECT set_config('request.jwt.claim.sub', :'ADMIN', false);
SET ROLE authenticated;

\echo '--- A. is_admin() resolves for the synthetic actor'
DO $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'PROOF FAILED A: is_admin() false for the planted admin actor';
  END IF;
  RAISE NOTICE 'ok A: authenticated administrator resolved';
END $$;

-- =====================================================================
-- B. PLANNING CREATES NO PURCHASE ORDER
-- =====================================================================
\echo '--- B. planning creates no ordem_compra / item / alocacao / sequence'
DO $$
DECLARE
  v_oc0 BIGINT; v_it0 BIGINT; v_al0 BIGINT; v_seq0 BIGINT;
  v_oc1 BIGINT; v_it1 BIGINT; v_al1 BIGINT; v_seq1 BIGINT;
  v_r JSONB;
BEGIN
  SELECT count(*) INTO v_oc0 FROM public.ordem_compra WHERE NOT legado;
  SELECT count(*) INTO v_it0 FROM public.ordem_compra_item;
  SELECT count(*) INTO v_al0 FROM public.ordem_compra_item_alocacao;
  SELECT count(*) INTO v_seq0 FROM public.pedido_identidade_numeros
   WHERE pedido_id = '9d1f0000-0000-4000-8000-00000000ed01' AND escopo = 'OC';

  v_r := public.definir_planejamento_compra(930000501, 930000401, 60.000, 'db99-b-1');
  IF (v_r->>'ok')::boolean IS NOT TRUE OR v_r->>'discriminador' <> 'criado' THEN
    RAISE EXCEPTION 'PROOF FAILED B: planning writer refused: %', v_r;
  END IF;
  IF (v_r->>'ordem_compra_criada')::boolean IS NOT FALSE THEN
    RAISE EXCEPTION 'PROOF FAILED B: writer reported creating a purchase order';
  END IF;

  SELECT count(*) INTO v_oc1 FROM public.ordem_compra WHERE NOT legado;
  SELECT count(*) INTO v_it1 FROM public.ordem_compra_item;
  SELECT count(*) INTO v_al1 FROM public.ordem_compra_item_alocacao;
  SELECT count(*) INTO v_seq1 FROM public.pedido_identidade_numeros
   WHERE pedido_id = '9d1f0000-0000-4000-8000-00000000ed01' AND escopo = 'OC';

  IF v_oc1 <> v_oc0 THEN RAISE EXCEPTION 'PROOF FAILED B: ordem_compra changed % -> %', v_oc0, v_oc1; END IF;
  IF v_it1 <> v_it0 THEN RAISE EXCEPTION 'PROOF FAILED B: ordem_compra_item changed % -> %', v_it0, v_it1; END IF;
  IF v_al1 <> v_al0 THEN RAISE EXCEPTION 'PROOF FAILED B: alocacao changed % -> %', v_al0, v_al1; END IF;
  IF v_seq1 <> v_seq0 THEN RAISE EXCEPTION 'PROOF FAILED B: OC sequence was reserved by planning'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.necessidade_compra_planejamento
                  WHERE necessidade_id = 930000501 AND fornecedor_id = 930000401
                    AND kg_planejado = 60.000 AND gerado_em IS NULL) THEN
    RAISE EXCEPTION 'PROOF FAILED B: planning row absent or wrong';
  END IF;
  RAISE NOTICE 'ok B: 60,000 kg planned; zero documents, zero numbering';
END $$;

-- =====================================================================
-- C. ONE NEED SPLIT ACROSS COMPATIBLE SUPPLIERS
-- =====================================================================
\echo '--- C. one need split across two compatible suppliers'
DO $$
DECLARE v_r JSONB; v_total NUMERIC(12,3);
BEGIN
  v_r := public.definir_planejamento_compra(930000501, 930000402, 40.000, 'db99-c-1');
  IF (v_r->>'ok')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'PROOF FAILED C: second supplier refused: %', v_r;
  END IF;
  SELECT sum(kg_planejado) INTO v_total
    FROM public.necessidade_compra_planejamento WHERE necessidade_id = 930000501;
  IF v_total <> 100.000 THEN
    RAISE EXCEPTION 'PROOF FAILED C: split total is % (expected 100.000)', v_total;
  END IF;
  IF (v_r->>'necessidade_kg_restante')::NUMERIC <> 0 THEN
    RAISE EXCEPTION 'PROOF FAILED C: remaining is % (expected 0)', v_r->>'necessidade_kg_restante';
  END IF;
  RAISE NOTICE 'ok C: 60,000 + 40,000 = 100,000 kg across two suppliers, remaining 0';
END $$;

-- =====================================================================
-- D. OVER-ALLOCATION AND INCOMPATIBLE SUPPLIER ARE REFUSED
-- =====================================================================
\echo '--- D. over-allocation and incompatible supplier refused'
DO $$
DECLARE v_r JSONB; v_before NUMERIC(12,3); v_after NUMERIC(12,3);
BEGIN
  SELECT sum(kg_planejado) INTO v_before
    FROM public.necessidade_compra_planejamento WHERE necessidade_id = 930000501;

  v_r := public.definir_planejamento_compra(930000501, 930000401, 61.000, 'db99-d-1');
  IF (v_r->>'ok')::boolean IS NOT FALSE OR v_r->>'codigo' <> 'excede_saldo' THEN
    RAISE EXCEPTION 'PROOF FAILED D: over-allocation accepted: %', v_r;
  END IF;

  v_r := public.definir_planejamento_compra(930000502, 930000301, 10.000, 'db99-d-2');
  IF (v_r->>'ok')::boolean IS NOT FALSE OR v_r->>'codigo' <> 'fornecedor_incompativel' THEN
    RAISE EXCEPTION 'PROOF FAILED D: incompatible supplier accepted: %', v_r;
  END IF;

  SELECT sum(kg_planejado) INTO v_after
    FROM public.necessidade_compra_planejamento WHERE necessidade_id = 930000501;
  IF v_after IS DISTINCT FROM v_before THEN
    RAISE EXCEPTION 'PROOF FAILED D: a refused command still mutated state (% -> %)', v_before, v_after;
  END IF;
  RAISE NOTICE 'ok D: excede_saldo and fornecedor_incompativel refused, state untouched';
END $$;

-- =====================================================================
-- E. AN UNGENERATED ROW IS EDITABLE AND REMOVABLE
-- =====================================================================
\echo '--- E. ungenerated planning row edited and removed'
DO $$
DECLARE v_r JSONB;
BEGIN
  v_r := public.definir_planejamento_compra(930000502, 930000401, 30.000, 'db99-e-1');
  IF v_r->>'discriminador' <> 'criado' THEN
    RAISE EXCEPTION 'PROOF FAILED E: expected criado, got %', v_r;
  END IF;
  v_r := public.definir_planejamento_compra(930000502, 930000401, 20.000, 'db99-e-2');
  IF v_r->>'discriminador' <> 'reduzido' THEN
    RAISE EXCEPTION 'PROOF FAILED E: expected reduzido, got %', v_r;
  END IF;
  v_r := public.definir_planejamento_compra(930000502, 930000401, 45.000, 'db99-e-3');
  IF v_r->>'discriminador' <> 'aumentado' THEN
    RAISE EXCEPTION 'PROOF FAILED E: expected aumentado, got %', v_r;
  END IF;
  v_r := public.definir_planejamento_compra(930000502, 930000401, 0, 'db99-e-4');
  IF v_r->>'discriminador' <> 'removido' THEN
    RAISE EXCEPTION 'PROOF FAILED E: expected removido, got %', v_r;
  END IF;
  IF EXISTS (SELECT 1 FROM public.necessidade_compra_planejamento
              WHERE necessidade_id = 930000502 AND fornecedor_id = 930000401) THEN
    RAISE EXCEPTION 'PROOF FAILED E: row survived removal';
  END IF;
  RAISE NOTICE 'ok E: criado -> reduzido -> aumentado -> removido';
END $$;

-- =====================================================================
-- F. IDEMPOTENT RETRY DOES NOT DUPLICATE
-- =====================================================================
\echo '--- F. idempotent retry returns the same result and duplicates nothing'
DO $$
DECLARE v_first JSONB; v_again JSONB; v_rows BIGINT;
BEGIN
  v_first := public.definir_planejamento_compra(930000502, 930000402, 25.000, 'db99-f-1');
  v_again := public.definir_planejamento_compra(930000502, 930000402, 25.000, 'db99-f-1');
  IF v_first IS DISTINCT FROM v_again THEN
    RAISE EXCEPTION 'PROOF FAILED F: retry returned a different result';
  END IF;
  SELECT count(*) INTO v_rows FROM public.necessidade_compra_planejamento
   WHERE necessidade_id = 930000502 AND fornecedor_id = 930000402;
  IF v_rows <> 1 THEN
    RAISE EXCEPTION 'PROOF FAILED F: % rows after retry (expected 1)', v_rows;
  END IF;

  -- Same key, materially different command: refused, never silently applied.
  v_again := public.definir_planejamento_compra(930000502, 930000402, 26.000, 'db99-f-1');
  IF (v_again->>'ok')::boolean IS NOT FALSE OR v_again->>'codigo' <> 'idempotencia_conflitante' THEN
    RAISE EXCEPTION 'PROOF FAILED F: key reuse with a different command was accepted: %', v_again;
  END IF;
  RAISE NOTICE 'ok F: retry idempotent, conflicting reuse refused';
END $$;

-- =====================================================================
-- G. QUICK PLANNING — EXACT-PENDING FILL AND ATOMICITY
-- =====================================================================
\echo '--- G. quick planning fills exact pending and is atomic'
DO $$
DECLARE v_r JSONB; v_kg NUMERIC(12,3); v_before BIGINT; v_after BIGINT;
BEGIN
  -- No `kg` key: fill each selected need with its exact pending balance.
  -- Need C is the OP-origin cotton need, so its compatible supplier is a
  -- fio_algodao one — the grouping owner is the material, not the colour.
  v_r := public.aplicar_planejamento_rapido(
    '9d1f0000-0000-4000-8000-00000000ed01', 930000301,
    '[{"necessidade_id": 930000503}]'::jsonb, 'db99-g-1');
  IF (v_r->>'ok')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'PROOF FAILED G: quick planning refused: %', v_r;
  END IF;
  SELECT kg_planejado INTO v_kg FROM public.necessidade_compra_planejamento
   WHERE necessidade_id = 930000503 AND fornecedor_id = 930000301;
  IF v_kg <> 40.000 THEN
    RAISE EXCEPTION 'PROOF FAILED G: exact-pending fill produced % (expected 40.000)', v_kg;
  END IF;
  IF (v_r->>'ordem_compra_criada')::boolean IS NOT FALSE THEN
    RAISE EXCEPTION 'PROOF FAILED G: quick planning reported creating a purchase order';
  END IF;

  -- Atomicity: a batch whose SECOND item is incompatible applies nothing.
  SELECT count(*) INTO v_before FROM public.necessidade_compra_planejamento;
  v_r := public.aplicar_planejamento_rapido(
    '9d1f0000-0000-4000-8000-00000000ed01', 930000401,
    '[{"necessidade_id": 930000502, "kg": 5.000}, {"necessidade_id": 999999999}]'::jsonb,
    'db99-g-2');
  IF (v_r->>'ok')::boolean IS NOT FALSE THEN
    RAISE EXCEPTION 'PROOF FAILED G: a batch with an invalid item succeeded: %', v_r;
  END IF;
  SELECT count(*) INTO v_after FROM public.necessidade_compra_planejamento;
  IF v_after <> v_before THEN
    RAISE EXCEPTION 'PROOF FAILED G: partial batch applied (% -> %)', v_before, v_after;
  END IF;
  RAISE NOTICE 'ok G: exact-pending fill = 40,000 kg; failed batch applied nothing';
END $$;

-- =====================================================================
-- H. THE NUMBER SUGGESTION IS NON-MUTATING
-- =====================================================================
\echo '--- H. number suggestion reserves nothing'
DO $$
DECLARE v_a JSONB; v_b JSONB; v_rows BIGINT;
BEGIN
  SELECT count(*) INTO v_rows FROM public.pedido_identidade_numeros
   WHERE pedido_id = '9d1f0000-0000-4000-8000-00000000ed01' AND escopo = 'OC';

  v_a := public.sugerir_codigo_ordem_compra('9d1f0000-0000-4000-8000-00000000ed01');
  v_b := public.sugerir_codigo_ordem_compra('9d1f0000-0000-4000-8000-00000000ed01');

  IF (v_a->>'ok')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'PROOF FAILED H: suggestion failed: %', v_a;
  END IF;
  IF v_a->>'codigo_sugerido' IS DISTINCT FROM v_b->>'codigo_sugerido' THEN
    RAISE EXCEPTION 'PROOF FAILED H: two reads produced different suggestions (% vs %)',
      v_a->>'codigo_sugerido', v_b->>'codigo_sugerido';
  END IF;
  IF (v_a->>'sequencia_sugerida')::INTEGER <> 1 THEN
    RAISE EXCEPTION 'PROOF FAILED H: first suggestion is seq % (expected 1)', v_a->>'sequencia_sugerida';
  END IF;
  IF v_a->>'codigo_sugerido' <> 'OC-007-1-26' THEN
    RAISE EXCEPTION 'PROOF FAILED H: suggested code is % (expected OC-007-1-26)', v_a->>'codigo_sugerido';
  END IF;
  IF (SELECT count(*) FROM public.pedido_identidade_numeros
       WHERE pedido_id = '9d1f0000-0000-4000-8000-00000000ed01' AND escopo = 'OC') <> v_rows THEN
    RAISE EXCEPTION 'PROOF FAILED H: reading the suggestion reserved a sequence';
  END IF;
  RAISE NOTICE 'ok H: OC-007-1-26 suggested twice, zero rows reserved';
END $$;

-- =====================================================================
-- I. CROSS-SUPPLIER SELECTION IS REFUSED BY THE SERVER
-- =====================================================================
\echo '--- I. cross-supplier generation refused'
DO $$
DECLARE v_ids BIGINT[]; v_r JSONB;
BEGIN
  SELECT array_agg(id ORDER BY id) INTO v_ids
    FROM public.necessidade_compra_planejamento WHERE necessidade_id = 930000501;
  IF array_length(v_ids, 1) <> 2 THEN
    RAISE EXCEPTION 'PROOF FAILED I: expected 2 planning rows on need A, got %', array_length(v_ids, 1);
  END IF;
  v_r := public.gerar_ordem_compra_do_planejamento(v_ids, 'OC-007-1-26', 1, 'db99-i-1');
  IF (v_r->>'ok')::boolean IS NOT FALSE OR v_r->>'codigo' <> 'fornecedor_misturado' THEN
    RAISE EXCEPTION 'PROOF FAILED I: mixed-supplier selection accepted: %', v_r;
  END IF;
  IF EXISTS (SELECT 1 FROM public.ordem_compra WHERE NOT legado) THEN
    RAISE EXCEPTION 'PROOF FAILED I: a purchase order was created by a refused generation';
  END IF;
  RAISE NOTICE 'ok I: fornecedor_misturado refused, no document created';
END $$;

-- =====================================================================
-- J. A STALE SUGGESTION FAILS CLOSED
-- =====================================================================
\echo '--- J. stale suggestion fails closed with a refreshed suggestion'
DO $$
DECLARE v_ids BIGINT[]; v_r JSONB;
BEGIN
  SELECT array_agg(p.id) INTO v_ids
    FROM public.necessidade_compra_planejamento p
   WHERE p.fornecedor_id = 930000401 AND p.gerado_em IS NULL;
  v_r := public.gerar_ordem_compra_do_planejamento(v_ids, 'OC-007-9-26', 9, 'db99-j-1');
  IF (v_r->>'ok')::boolean IS NOT FALSE OR v_r->>'codigo' <> 'sugestao_desatualizada' THEN
    RAISE EXCEPTION 'PROOF FAILED J: a stale suggestion was accepted: %', v_r;
  END IF;
  IF (v_r->>'sequencia_sugerida')::INTEGER <> 1 THEN
    RAISE EXCEPTION 'PROOF FAILED J: refreshed suggestion is % (expected 1)', v_r->>'sequencia_sugerida';
  END IF;
  IF EXISTS (SELECT 1 FROM public.ordem_compra WHERE NOT legado) THEN
    RAISE EXCEPTION 'PROOF FAILED J: a stale confirmation still created a document';
  END IF;
  RAISE NOTICE 'ok J: sugestao_desatualizada, refreshed to seq 1, nothing created';
END $$;

-- =====================================================================
-- K. GENERATION IS ATOMIC AND RESERVES EXACTLY ONE SEQUENCE
-- =====================================================================
\echo '--- K. generation creates the document atomically'
DO $$
DECLARE
  v_ids BIGINT[]; v_r JSONB; v_ordem BIGINT;
  v_itens BIGINT; v_alocacoes BIGINT; v_seq INTEGER;
BEGIN
  SELECT array_agg(p.id) INTO v_ids
    FROM public.necessidade_compra_planejamento p
   WHERE p.fornecedor_id = 930000401 AND p.gerado_em IS NULL;

  v_r := public.gerar_ordem_compra_do_planejamento(v_ids, 'OC-007-1-26', 1, 'db99-k-1');
  IF (v_r->>'ok')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'PROOF FAILED K: generation refused: %', v_r;
  END IF;
  v_ordem := (v_r->>'ordem_compra_id')::BIGINT;

  SELECT count(*) INTO v_itens FROM public.ordem_compra_item WHERE ordem_id = v_ordem;
  SELECT count(*) INTO v_alocacoes FROM public.ordem_compra_item_alocacao a
    JOIN public.ordem_compra_item i ON i.id = a.item_id WHERE i.ordem_id = v_ordem;
  IF v_itens < 1 OR v_alocacoes < 1 THEN
    RAISE EXCEPTION 'PROOF FAILED K: document created without items/allocations (%/%)', v_itens, v_alocacoes;
  END IF;

  -- Exactly one canonical sequence reserved.
  SELECT ultimo_seq INTO v_seq FROM public.pedido_identidade_numeros
   WHERE pedido_id = '9d1f0000-0000-4000-8000-00000000ed01' AND escopo = 'OC';
  IF v_seq <> 1 THEN
    RAISE EXCEPTION 'PROOF FAILED K: reserved sequence high-water is % (expected 1)', v_seq;
  END IF;

  -- Every selected planning row is now generated and linked 1:1.
  IF EXISTS (SELECT 1 FROM public.necessidade_compra_planejamento
              WHERE id = ANY(v_ids) AND (gerado_em IS NULL OR alocacao_id IS NULL
                                      OR ordem_compra_id IS DISTINCT FROM v_ordem)) THEN
    RAISE EXCEPTION 'PROOF FAILED K: a selected planning row was not linked to the document';
  END IF;

  -- The item quantity equals the sum of its allocations (db/67 deferred guard).
  IF EXISTS (
    SELECT 1 FROM public.ordem_compra_item i
     WHERE i.ordem_id = v_ordem
       AND i.kg_pedido <> (SELECT coalesce(sum(a.kg_alocado), 0)
                             FROM public.ordem_compra_item_alocacao a WHERE a.item_id = i.id)) THEN
    RAISE EXCEPTION 'PROOF FAILED K: item quantity does not equal its allocations';
  END IF;

  RAISE NOTICE 'ok K: document % created with % item(s), % allocation(s), sequence high-water 1',
    v_ordem, v_itens, v_alocacoes;
END $$;

-- =====================================================================
-- L. A GENERATED ROW CANNOT BE REUSED OR EDITED AS PLANNING
-- =====================================================================
\echo '--- L. generated planning rows are frozen against the planning writers'
DO $$
DECLARE
  v_ids BIGINT[]; v_r JSONB;
  v_kg_antes NUMERIC(12,3); v_kg_depois NUMERIC(12,3);
  v_ordem_antes BIGINT; v_ordem_depois BIGINT;
BEGIN
  SELECT array_agg(id) INTO v_ids FROM public.necessidade_compra_planejamento
   WHERE gerado_em IS NOT NULL;

  v_r := public.gerar_ordem_compra_do_planejamento(v_ids, 'OC-DUPLICADA', 2, 'db99-l-1');
  IF (v_r->>'ok')::boolean IS NOT FALSE OR v_r->>'codigo' <> 'planejamento_ja_gerado' THEN
    RAISE EXCEPTION 'PROOF FAILED L: an already generated row was generated again: %', v_r;
  END IF;

  -- C1 CONTRACT CHANGE. A generated row no longer BLOCKS a later live row for
  -- the same (need, supplier) — that block was withdrawn precisely so the same
  -- supplier can be purchased again (proved in W). What must still hold is
  -- that no planning writer can ever MUTATE the generated row itself.
  SELECT kg_planejado, ordem_compra_id INTO v_kg_antes, v_ordem_antes
    FROM public.necessidade_compra_planejamento
   WHERE necessidade_id = 930000501 AND fornecedor_id = 930000401
     AND gerado_em IS NOT NULL;

  -- Need 930000501 is fully planned (60 generated + 40 live = 100 of 100), so
  -- the attempt is refused by the QUANTITY cap, not by a generated-row rule.
  v_r := public.definir_planejamento_compra(930000501, 930000401, 10.000, 'db99-l-2');
  IF (v_r->>'ok')::boolean IS NOT FALSE OR v_r->>'codigo' <> 'excede_saldo' THEN
    RAISE EXCEPTION 'PROOF FAILED L: expected excede_saldo on a full need, got %', v_r;
  END IF;

  SELECT kg_planejado, ordem_compra_id INTO v_kg_depois, v_ordem_depois
    FROM public.necessidade_compra_planejamento
   WHERE necessidade_id = 930000501 AND fornecedor_id = 930000401
     AND gerado_em IS NOT NULL;
  IF v_kg_depois IS DISTINCT FROM v_kg_antes
     OR v_ordem_depois IS DISTINCT FROM v_ordem_antes THEN
    RAISE EXCEPTION 'PROOF FAILED L: the generated row was mutated (% kg / oc % -> % kg / oc %)',
      v_kg_antes, v_ordem_antes, v_kg_depois, v_ordem_depois;
  END IF;

  -- The atomic card writer must not touch it either: submitting an empty set
  -- removes every LIVE row and leaves the generated one exactly as it was.
  v_r := public.substituir_planejamento_compra_necessidade(930000501, '[]'::jsonb, 'db99-l-3');
  IF (v_r->>'ok')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'PROOF FAILED L: clearing the live rows was refused: %', v_r;
  END IF;
  SELECT kg_planejado, ordem_compra_id INTO v_kg_depois, v_ordem_depois
    FROM public.necessidade_compra_planejamento
   WHERE necessidade_id = 930000501 AND fornecedor_id = 930000401
     AND gerado_em IS NOT NULL;
  IF v_kg_depois IS DISTINCT FROM v_kg_antes
     OR v_ordem_depois IS DISTINCT FROM v_ordem_antes THEN
    RAISE EXCEPTION 'PROOF FAILED L: the atomic card writer mutated a generated row';
  END IF;
  IF EXISTS (SELECT 1 FROM public.necessidade_compra_planejamento
              WHERE necessidade_id = 930000501 AND gerado_em IS NULL) THEN
    RAISE EXCEPTION 'PROOF FAILED L: a live row survived an empty replacement';
  END IF;

  -- Restore the live row the later assertions (N/O) expect.
  v_r := public.substituir_planejamento_compra_necessidade(930000501,
    '[{"fornecedor_id":930000402,"kg":40.000}]'::jsonb, 'db99-l-4');
  IF (v_r->>'ok')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'PROOF FAILED L: could not restore the live row: %', v_r;
  END IF;

  RAISE NOTICE 'ok L: re-generation refused; generated row never mutated by either writer';
END $$;

-- =====================================================================
-- M. THE FIVE-ARGUMENT COMPATIBILITY PATH NEVER CREATES A DOCUMENT
-- =====================================================================
\echo '--- M. the legacy five-argument writer creates no purchase order'
DO $$
DECLARE v_r JSONB; v_oc0 BIGINT; v_oc1 BIGINT; v_seq0 INTEGER; v_seq1 INTEGER;
BEGIN
  SELECT count(*) INTO v_oc0 FROM public.ordem_compra WHERE NOT legado;
  SELECT ultimo_seq INTO v_seq0 FROM public.pedido_identidade_numeros
   WHERE pedido_id = '9d1f0000-0000-4000-8000-00000000ed01' AND escopo = 'OC';

  -- A stale client still sends the withdrawn code argument.
  v_r := public.definir_alocacao_necessidade_compra_fio(
    930000503, 930000301, 15.000, 'db99-m-1', 'PC 2026/0099');

  IF (v_r->>'ok')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'PROOF FAILED M: compatibility path refused a valid command: %', v_r;
  END IF;
  IF v_r->>'discriminador' <> 'compatibilidade_planejamento' THEN
    RAISE EXCEPTION 'PROOF FAILED M: compatibility discriminator missing: %', v_r;
  END IF;
  IF (v_r->>'codigo_ordem_ignorado')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'PROOF FAILED M: the obsolete code argument was not reported as ignored';
  END IF;
  IF v_r->>'ordem_compra_id' IS NOT NULL THEN
    RAISE EXCEPTION 'PROOF FAILED M: compatibility path returned a purchase-order id';
  END IF;

  SELECT count(*) INTO v_oc1 FROM public.ordem_compra WHERE NOT legado;
  SELECT ultimo_seq INTO v_seq1 FROM public.pedido_identidade_numeros
   WHERE pedido_id = '9d1f0000-0000-4000-8000-00000000ed01' AND escopo = 'OC';
  IF v_oc1 <> v_oc0 THEN
    RAISE EXCEPTION 'PROOF FAILED M: the compatibility path created a document (% -> %)', v_oc0, v_oc1;
  END IF;
  IF v_seq1 IS DISTINCT FROM v_seq0 THEN
    RAISE EXCEPTION 'PROOF FAILED M: the compatibility path consumed numbering';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.necessidade_compra_planejamento
                  WHERE necessidade_id = 930000503 AND fornecedor_id = 930000301
                    AND kg_planejado = 15.000 AND gerado_em IS NULL) THEN
    RAISE EXCEPTION 'PROOF FAILED M: the compatibility path did not persist planning';
  END IF;
  IF EXISTS (SELECT 1 FROM public.ordem_compra WHERE codigo = 'PC 2026/0099') THEN
    RAISE EXCEPTION 'PROOF FAILED M: the obsolete code was persisted';
  END IF;
  RAISE NOTICE 'ok M: stale client planned 15,000 kg; zero documents, zero numbering, code ignored';
END $$;

-- =====================================================================
-- N. CANCELLING PRESERVES THE PLANNING LINKAGE
-- =====================================================================
-- db/100 AMENDMENT. db/99 proved only that the linkage SURVIVES cancellation.
-- The decided lifecycle adds the other half: cancellation must ALSO stop that
-- coverage from consuming purchasing balance, immediately. Both are asserted
-- here, because they are two halves of one rule — history is kept, balance is
-- freed.
\echo '--- N. cancelling preserves the planning linkage and frees the balance'
DO $$
DECLARE
  v_ordem BIGINT; v_r JSONB; v_linked BIGINT;
  v_ativo NUMERIC(12,3); v_cache NUMERIC(12,3);
BEGIN
  SELECT id INTO v_ordem FROM public.ordem_compra WHERE NOT legado ORDER BY id LIMIT 1;
  v_r := public.cancelar_ordem_compra(v_ordem);
  IF (v_r->>'ok')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'PROOF FAILED N: cancel refused: %', v_r;
  END IF;
  SELECT count(*) INTO v_linked FROM public.necessidade_compra_planejamento
   WHERE ordem_compra_id = v_ordem AND gerado_em IS NOT NULL;
  IF v_linked < 1 THEN
    RAISE EXCEPTION 'PROOF FAILED N: cancelling dropped the planning linkage';
  END IF;

  -- Need 930000501 carried 60 kg generated into that document plus a 40 kg
  -- live row. Cancelling must leave exactly the 40 kg live row counting.
  --
  -- The active total is restated here in plain SQL rather than read from
  -- db/100's own helper: the helper is owner-only (proved in the db/100 ACL
  -- section) and, more importantly, a proof that calls the implementation to
  -- check the implementation proves nothing.
  SELECT coalesce(sum(p.kg_planejado), 0)::NUMERIC(12,3) INTO v_ativo
    FROM public.necessidade_compra_planejamento p
    LEFT JOIN public.ordem_compra o ON o.id = p.ordem_compra_id
   WHERE p.necessidade_id = 930000501
     AND (p.ordem_compra_id IS NULL OR o.status_administrativo <> 'cancelada');
  IF v_ativo <> 40.000 THEN
    RAISE EXCEPTION 'PROOF FAILED N: active planned total is % (expected 40.000 after cancellation)', v_ativo;
  END IF;
  SELECT kg_alocado INTO v_cache FROM public.necessidade_compra_fio WHERE id = 930000501;
  IF v_cache <> 0.000 THEN
    RAISE EXCEPTION 'PROOF FAILED N: the need cache still carries % kg of cancelled allocation', v_cache;
  END IF;

  RAISE NOTICE 'ok N: % planning row(s) still linked to the cancelled document; 60,000 kg freed', v_linked;
END $$;

-- =====================================================================
-- O. DELETING AN ALREADY-CANCELLED ORDER DOES NOT RELEASE TWICE
-- =====================================================================
-- db/100 AMENDMENT, and a DELIBERATE REVERSAL of what db/99 asserted here.
-- db/99 cancelled without releasing anything, so deletion was the only moment
-- the quantity could come back and this proof demanded exactly that. Under the
-- decided lifecycle the cancellation in N already returned it. Repeating the
-- release here would ADD the quantity a second time — a silent inflation of
-- planned kg. The rule under test is therefore the opposite one: the cancelled
-- document's historical rows are REMOVED with it and no balance moves.
\echo '--- O. deleting a cancelled document removes its history without a second release'
DO $$
DECLARE
  v_ordem BIGINT; v_r JSONB;
  v_kg_before NUMERIC(12,3);
  v_ativo_antes NUMERIC(12,3); v_ativo_depois NUMERIC(12,3);
  v_removed BIGINT; v_still BIGINT;
BEGIN
  SELECT id INTO v_ordem FROM public.ordem_compra
   WHERE NOT legado AND status_administrativo = 'cancelada' ORDER BY id LIMIT 1;

  SELECT coalesce(sum(kg_planejado), 0) INTO v_kg_before
    FROM public.necessidade_compra_planejamento WHERE ordem_compra_id = v_ordem;
  IF v_kg_before <= 0 THEN
    RAISE EXCEPTION 'PROOF FAILED O: the cancelled document carries no planning history to test';
  END IF;
  SELECT coalesce(sum(p.kg_planejado), 0)::NUMERIC(12,3) INTO v_ativo_antes
    FROM public.necessidade_compra_planejamento p
    LEFT JOIN public.ordem_compra o ON o.id = p.ordem_compra_id
   WHERE p.necessidade_id = 930000501
     AND (p.ordem_compra_id IS NULL OR o.status_administrativo <> 'cancelada');

  v_r := public.excluir_ordem_compra(v_ordem);
  IF (v_r->>'ok')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'PROOF FAILED O: eligible deletion refused: %', v_r;
  END IF;
  IF (v_r->>'origem_cancelada')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'PROOF FAILED O: the writer did not take the cancelada branch: %', v_r;
  END IF;
  v_removed := (v_r->>'planejamentos_removidos')::BIGINT;
  IF v_removed < 1 THEN
    RAISE EXCEPTION 'PROOF FAILED O: deletion removed % historical planning rows', v_removed;
  END IF;
  IF (v_r->>'planejamentos_liberados')::BIGINT <> 0 THEN
    RAISE EXCEPTION 'PROOF FAILED O: deletion released % row(s) a second time', v_r->>'planejamentos_liberados';
  END IF;

  IF EXISTS (SELECT 1 FROM public.ordem_compra WHERE id = v_ordem) THEN
    RAISE EXCEPTION 'PROOF FAILED O: the document survived deletion';
  END IF;
  SELECT count(*) INTO v_still FROM public.necessidade_compra_planejamento
   WHERE ordem_compra_id = v_ordem;
  IF v_still <> 0 THEN
    RAISE EXCEPTION 'PROOF FAILED O: % planning row(s) still reference the deleted document', v_still;
  END IF;

  -- THE POINT OF THE PROOF: the deletion moved no balance at all, because the
  -- cancellation already had.
  SELECT coalesce(sum(p.kg_planejado), 0)::NUMERIC(12,3) INTO v_ativo_depois
    FROM public.necessidade_compra_planejamento p
    LEFT JOIN public.ordem_compra o ON o.id = p.ordem_compra_id
   WHERE p.necessidade_id = 930000501
     AND (p.ordem_compra_id IS NULL OR o.status_administrativo <> 'cancelada');
  IF v_ativo_depois IS DISTINCT FROM v_ativo_antes THEN
    RAISE EXCEPTION 'PROOF FAILED O: deletion changed the active planned total (% -> %) — released twice',
      v_ativo_antes, v_ativo_depois;
  END IF;
  IF EXISTS (SELECT 1 FROM public.necessidade_compra_planejamento
              WHERE necessidade_id = 930000501 AND fornecedor_id = 930000401) THEN
    RAISE EXCEPTION 'PROOF FAILED O: the cancelled decision was resurrected as live planning';
  END IF;

  RAISE NOTICE 'ok O: % historical row(s) removed with the document, % kg released exactly once (at cancellation)',
    v_removed, v_kg_before;
END $$;

-- =====================================================================
-- P. THE PRE-EXISTING IRREVERSIBLE-HISTORY REFUSALS STILL WORK
-- =====================================================================
\echo '--- P. legacy/ineligible deletion refusals survive db/99'
DO $$
DECLARE v_legado BIGINT; v_r JSONB;
BEGIN
  SELECT id INTO v_legado FROM public.ordem_compra WHERE legado ORDER BY id LIMIT 1;
  v_r := public.excluir_ordem_compra(v_legado);
  IF (v_r->>'ok')::boolean IS NOT FALSE OR v_r->>'codigo' <> 'ordem_legado' THEN
    RAISE EXCEPTION 'PROOF FAILED P: a legacy document was deletable: %', v_r;
  END IF;
  v_r := public.excluir_ordem_compra(-1);
  IF (v_r->>'ok')::boolean IS NOT FALSE OR v_r->>'codigo' <> 'nao_encontrada' THEN
    RAISE EXCEPTION 'PROOF FAILED P: an absent document did not report nao_encontrada: %', v_r;
  END IF;
  RAISE NOTICE 'ok P: ordem_legado and nao_encontrada refusals intact';
END $$;

-- =====================================================================
-- Q. NO CLIENT ROLE HOLDS DIRECT DML ON THE PLANNING TABLE
-- =====================================================================
\echo '--- Q. authenticated has no direct DML; anon reads nothing'
DO $$
DECLARE v_denied BOOLEAN := FALSE;
BEGIN
  BEGIN
    INSERT INTO public.necessidade_compra_planejamento(necessidade_id, fornecedor_id, kg_planejado)
    VALUES (930000502, 930000401, 1.000);
  EXCEPTION
    WHEN insufficient_privilege THEN v_denied := TRUE;
  END;
  IF NOT v_denied THEN
    RAISE EXCEPTION 'PROOF FAILED Q: authenticated inserted directly into the planning table';
  END IF;

  IF has_table_privilege('authenticated', 'public.necessidade_compra_planejamento', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.necessidade_compra_planejamento', 'DELETE')
     OR has_table_privilege('anon', 'public.necessidade_compra_planejamento', 'SELECT') THEN
    RAISE EXCEPTION 'PROOF FAILED Q: an unexpected direct privilege exists';
  END IF;
  RAISE NOTICE 'ok Q: RPCs are the only write surface';
END $$;

-- =====================================================================
-- R. ZERO ORPHANS ACROSS THE WHOLE DOMAIN
-- =====================================================================
\echo '--- R. zero orphan planning, item or allocation rows'
DO $$
DECLARE v_bad BIGINT;
BEGIN
  SELECT count(*) INTO v_bad FROM public.necessidade_compra_planejamento p
   WHERE p.gerado_em IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.ordem_compra_item_alocacao a WHERE a.id = p.alocacao_id);
  IF v_bad <> 0 THEN RAISE EXCEPTION 'PROOF FAILED R: % generated planning row(s) without an allocation', v_bad; END IF;

  SELECT count(*) INTO v_bad FROM public.necessidade_compra_planejamento p
   WHERE p.gerado_em IS NULL AND (p.alocacao_id IS NOT NULL OR p.ordem_compra_id IS NOT NULL);
  IF v_bad <> 0 THEN RAISE EXCEPTION 'PROOF FAILED R: % ungenerated planning row(s) still carry linkage', v_bad; END IF;

  SELECT count(*) INTO v_bad FROM public.ordem_compra_item i
   WHERE NOT EXISTS (SELECT 1 FROM public.ordem_compra o WHERE o.id = i.ordem_id);
  IF v_bad <> 0 THEN RAISE EXCEPTION 'PROOF FAILED R: % orphan item(s)', v_bad; END IF;

  SELECT count(*) INTO v_bad FROM public.ordem_compra_item_alocacao a
   WHERE NOT EXISTS (SELECT 1 FROM public.ordem_compra_item i WHERE i.id = a.item_id);
  IF v_bad <> 0 THEN RAISE EXCEPTION 'PROOF FAILED R: % orphan allocation(s)', v_bad; END IF;

  -- Planning never exceeds its need.
  SELECT count(*) INTO v_bad FROM (
    SELECT p.necessidade_id, sum(p.kg_planejado) AS total, n.kg_necessario
      FROM public.necessidade_compra_planejamento p
      JOIN public.necessidade_compra_fio n ON n.id = p.necessidade_id
     GROUP BY p.necessidade_id, n.kg_necessario
    HAVING sum(p.kg_planejado) > n.kg_necessario) s;
  IF v_bad <> 0 THEN RAISE EXCEPTION 'PROOF FAILED R: % need(s) over-planned', v_bad; END IF;

  RAISE NOTICE 'ok R: zero orphans, zero over-planned needs';
END $$;

-- =====================================================================
-- S. THE READ MODEL ORDERS PENDING FIRST AND REPORTS THE THREE FIGURES
-- =====================================================================
\echo '--- S. read model situacao, ordering and figures'
DO $$
DECLARE v_r JSONB; v_first TEXT; v_n JSONB;
BEGIN
  v_r := public.obter_planejamento_compra_pedido('9d1f0000-0000-4000-8000-00000000ed01');
  IF (v_r->>'ok')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'PROOF FAILED S: read model refused: %', v_r;
  END IF;
  -- Five needs since C1: the three original ones, plus 930000504 for the
  -- atomic-replacement / repeat-supplier proofs and 930000505 for the
  -- deletion release/merge proof.
  IF jsonb_array_length(v_r->'necessidades') <> 5 THEN
    RAISE EXCEPTION 'PROOF FAILED S: read model projected % needs (expected 5)',
      jsonb_array_length(v_r->'necessidades');
  END IF;

  -- Pending-first ordering: the ordering key never decreases down the list.
  IF EXISTS (
    SELECT 1 FROM (
      SELECT (value->>'ordenacao') AS k, ordinality
        FROM jsonb_array_elements(v_r->'necessidades') WITH ORDINALITY
    ) t
    JOIN (
      SELECT (value->>'ordenacao') AS k, ordinality
        FROM jsonb_array_elements(v_r->'necessidades') WITH ORDINALITY
    ) u ON u.ordinality = t.ordinality + 1
    WHERE u.k < t.k) THEN
    RAISE EXCEPTION 'PROOF FAILED S: needs are not ordered pending-first';
  END IF;

  -- Every projected need carries required / planned / remaining.
  FOR v_n IN SELECT value FROM jsonb_array_elements(v_r->'necessidades')
  LOOP
    IF v_n->>'kg_necessario' IS NULL OR v_n->>'kg_planejado' IS NULL
       OR v_n->>'kg_restante' IS NULL OR v_n->>'situacao' IS NULL THEN
      RAISE EXCEPTION 'PROOF FAILED S: a projected need is missing a figure: %', v_n;
    END IF;
    IF (v_n->>'kg_restante')::NUMERIC
       <> (v_n->>'kg_necessario')::NUMERIC - (v_n->>'kg_planejado')::NUMERIC THEN
      RAISE EXCEPTION 'PROOF FAILED S: remaining does not reconcile: %', v_n;
    END IF;
  END LOOP;
  RAISE NOTICE 'ok S: 5 needs projected, pending-first, figures reconcile';
END $$;

-- =====================================================================
-- T. THE VISIBLE CODE IS FROZEN AT CREATION
-- =====================================================================
RESET ROLE;

\echo '--- T. the confirmed code is immutable after generation'
DO $$
DECLARE v_ids BIGINT[]; v_r JSONB; v_ordem BIGINT; v_blocked BOOLEAN := FALSE; v_codigo TEXT;
BEGIN
  PERFORM set_config('request.jwt.claim.sub', '9d1f0000-0000-4000-8000-00000000ad01', false);

  SELECT array_agg(p.id) INTO v_ids FROM public.necessidade_compra_planejamento p
   WHERE p.fornecedor_id = 930000402 AND p.gerado_em IS NULL;

  -- The operator replaces the suggestion with a code of their own. The
  -- canonical sequence is still reserved, so the lineage keeps advancing.
  v_r := public.gerar_ordem_compra_do_planejamento(v_ids, 'PC PROPRIO 4242', 2, 'db99-t-1');
  IF (v_r->>'ok')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'PROOF FAILED T: generation with a custom code refused: %', v_r;
  END IF;
  v_ordem := (v_r->>'ordem_compra_id')::BIGINT;
  IF (v_r->>'sequencia_reservada')::INTEGER <> 2 THEN
    RAISE EXCEPTION 'PROOF FAILED T: custom code did not reserve sequence 2 (got %)',
      v_r->>'sequencia_reservada';
  END IF;

  SELECT identidade_operacional INTO v_codigo FROM public.ordem_compra WHERE id = v_ordem;
  IF v_codigo <> 'PC PROPRIO 4242' THEN
    RAISE EXCEPTION 'PROOF FAILED T: the visible identity is % (expected the custom code)', v_codigo;
  END IF;

  BEGIN
    UPDATE public.ordem_compra SET codigo = 'OUTRO' WHERE id = v_ordem;
  EXCEPTION
    WHEN OTHERS THEN v_blocked := TRUE;
  END;
  IF NOT v_blocked THEN
    RAISE EXCEPTION 'PROOF FAILED T: the confirmed code was rewritten after generation';
  END IF;
  RAISE NOTICE 'ok T: custom code kept, sequence 2 still reserved, later rewrite refused';
END $$;

-- =====================================================================
-- U. THE SUGGESTION ADVANCES AFTER A REAL GENERATION
-- =====================================================================
\echo '--- U. the next suggestion advances past the reserved lineage'
DO $$
DECLARE v_r JSONB;
BEGIN
  PERFORM set_config('request.jwt.claim.sub', '9d1f0000-0000-4000-8000-00000000ad01', false);
  v_r := public.sugerir_codigo_ordem_compra('9d1f0000-0000-4000-8000-00000000ed01');
  IF (v_r->>'sequencia_sugerida')::INTEGER <> 3 THEN
    RAISE EXCEPTION 'PROOF FAILED U: next suggestion is seq % (expected 3)', v_r->>'sequencia_sugerida';
  END IF;
  IF v_r->>'codigo_sugerido' <> 'OC-007-3-26' THEN
    RAISE EXCEPTION 'PROOF FAILED U: next suggestion is % (expected OC-007-3-26)', v_r->>'codigo_sugerido';
  END IF;
  RAISE NOTICE 'ok U: next suggestion OC-007-3-26';
END $$;

-- =====================================================================
-- C1 CORRECTIONS. Need 930000504 (cotton, 1,000 kg) is reserved for these,
-- so they do not depend on the state left by A-U above.
-- Suppliers: 930000301 (AA) and 930000302 (AB), both fio_algodao.
-- =====================================================================

SET ROLE authenticated;

\echo '--- V. one card save is ONE atomic operation'
DO $$
DECLARE v_r JSONB; v_aa NUMERIC(12,3); v_ab NUMERIC(12,3); v_n INTEGER;
BEGIN
  -- Baseline: A=500, B=500.
  v_r := public.substituir_planejamento_compra_necessidade(930000504,
    '[{"fornecedor_id":930000301,"kg":500.000},{"fornecedor_id":930000302,"kg":500.000}]'::jsonb,
    'db99-v-1');
  IF (v_r->>'ok')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'PROOF FAILED V: baseline replacement refused: %', v_r;
  END IF;

  -- Replace atomically with A=600, B=400 — and submit them in the OPPOSITE
  -- order, so the result cannot depend on submission order.
  v_r := public.substituir_planejamento_compra_necessidade(930000504,
    '[{"fornecedor_id":930000302,"kg":400.000},{"fornecedor_id":930000301,"kg":600.000}]'::jsonb,
    'db99-v-2');
  IF (v_r->>'ok')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'PROOF FAILED V: reordered replacement refused: %', v_r;
  END IF;
  SELECT kg_planejado INTO v_aa FROM public.necessidade_compra_planejamento
   WHERE necessidade_id = 930000504 AND fornecedor_id = 930000301 AND gerado_em IS NULL;
  SELECT kg_planejado INTO v_ab FROM public.necessidade_compra_planejamento
   WHERE necessidade_id = 930000504 AND fornecedor_id = 930000302 AND gerado_em IS NULL;
  IF v_aa <> 600.000 OR v_ab <> 400.000 THEN
    RAISE EXCEPTION 'PROOF FAILED V: expected 600/400, got %/%', v_aa, v_ab;
  END IF;

  -- A refusal caused by the SECOND submitted row must leave BOTH rows as they
  -- were. This is the exact defect the per-row writer had.
  v_r := public.substituir_planejamento_compra_necessidade(930000504,
    '[{"fornecedor_id":930000301,"kg":100.000},{"fornecedor_id":930000401,"kg":100.000}]'::jsonb,
    'db99-v-3');
  IF (v_r->>'ok')::boolean IS NOT FALSE OR v_r->>'codigo' <> 'fornecedor_incompativel' THEN
    RAISE EXCEPTION 'PROOF FAILED V: incompatible second row accepted: %', v_r;
  END IF;
  SELECT kg_planejado INTO v_aa FROM public.necessidade_compra_planejamento
   WHERE necessidade_id = 930000504 AND fornecedor_id = 930000301 AND gerado_em IS NULL;
  SELECT kg_planejado INTO v_ab FROM public.necessidade_compra_planejamento
   WHERE necessidade_id = 930000504 AND fornecedor_id = 930000302 AND gerado_em IS NULL;
  IF v_aa <> 600.000 OR v_ab <> 400.000 THEN
    RAISE EXCEPTION 'PROOF FAILED V: partial save survived a refusal (%/%)', v_aa, v_ab;
  END IF;

  -- Over-total and duplicate-supplier refusals, also leaving state intact.
  v_r := public.substituir_planejamento_compra_necessidade(930000504,
    '[{"fornecedor_id":930000301,"kg":600.000},{"fornecedor_id":930000302,"kg":600.000}]'::jsonb,
    'db99-v-4');
  IF v_r->>'codigo' <> 'excede_saldo' THEN
    RAISE EXCEPTION 'PROOF FAILED V: 1200 kg over a 1000 kg need accepted: %', v_r;
  END IF;
  v_r := public.substituir_planejamento_compra_necessidade(930000504,
    '[{"fornecedor_id":930000301,"kg":100.000},{"fornecedor_id":930000301,"kg":200.000}]'::jsonb,
    'db99-v-5');
  IF v_r->>'codigo' <> 'fornecedor_duplicado' THEN
    RAISE EXCEPTION 'PROOF FAILED V: duplicate supplier in one card accepted: %', v_r;
  END IF;

  SELECT count(*) INTO v_n FROM public.necessidade_compra_planejamento
   WHERE necessidade_id = 930000504 AND gerado_em IS NULL;
  SELECT sum(kg_planejado) INTO v_aa FROM public.necessidade_compra_planejamento
   WHERE necessidade_id = 930000504;
  IF v_n <> 2 OR v_aa <> 1000.000 THEN
    RAISE EXCEPTION 'PROOF FAILED V: final state drifted (% rows, % kg)', v_n, v_aa;
  END IF;

  -- Omitting a supplier removes its live row, in the same atomic call.
  v_r := public.substituir_planejamento_compra_necessidade(930000504,
    '[{"fornecedor_id":930000301,"kg":500.000}]'::jsonb, 'db99-v-6');
  IF (v_r->>'ok')::boolean IS NOT TRUE OR (v_r->>'linhas_removidas')::INT <> 1 THEN
    RAISE EXCEPTION 'PROOF FAILED V: omitted supplier was not removed: %', v_r;
  END IF;
  RAISE NOTICE 'ok V: atomic replacement, order-independent, no partial save on refusal';
END $$;

\echo '--- W. the same supplier may be purchased again after generation'
DO $$
DECLARE
  v_r JSONB; v_ids BIGINT[]; v_oc1 BIGINT; v_oc2 BIGINT;
  v_seq INTEGER; v_total NUMERIC(12,3); v_ger INTEGER;
BEGIN
  -- State from V: exactly one live row, supplier AA, 500 kg on a 1,000 kg need.
  SELECT array_agg(id) INTO v_ids FROM public.necessidade_compra_planejamento
   WHERE necessidade_id = 930000504 AND fornecedor_id = 930000301 AND gerado_em IS NULL;

  SELECT sequencia_sugerida INTO v_seq FROM
    jsonb_to_record(public.sugerir_codigo_ordem_compra('9d1f0000-0000-4000-8000-00000000ed01'))
    AS x(sequencia_sugerida INTEGER);
  v_r := public.gerar_ordem_compra_do_planejamento(v_ids, 'PC-REPEAT-1', v_seq, 'db99-w-1');
  IF (v_r->>'ok')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'PROOF FAILED W: first generation refused: %', v_r;
  END IF;
  v_oc1 := (v_r->>'ordem_compra_id')::BIGINT;

  -- THE POINT: a second live row for the SAME supplier and the SAME need.
  -- Under the previous all-history UNIQUE this was impossible forever.
  v_r := public.substituir_planejamento_compra_necessidade(930000504,
    '[{"fornecedor_id":930000301,"kg":500.000}]'::jsonb, 'db99-w-2');
  IF (v_r->>'ok')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'PROOF FAILED W: repeat purchase from the same supplier refused: %', v_r;
  END IF;

  SELECT array_agg(id) INTO v_ids FROM public.necessidade_compra_planejamento
   WHERE necessidade_id = 930000504 AND fornecedor_id = 930000301 AND gerado_em IS NULL;

  -- While the first document is still an open draft, db/67's
  -- ordem_compra_um_rascunho_ativo forbids a second one for the same
  -- (Pedido, fornecedor). That must surface as its OWN honest refusal, not as
  -- a bogus "duplicate number".
  SELECT sequencia_sugerida INTO v_seq FROM
    jsonb_to_record(public.sugerir_codigo_ordem_compra('9d1f0000-0000-4000-8000-00000000ed01'))
    AS x(sequencia_sugerida INTEGER);
  v_r := public.gerar_ordem_compra_do_planejamento(v_ids, 'PC-REPEAT-EARLY', v_seq, 'db99-w-2b');
  IF (v_r->>'ok')::boolean IS NOT FALSE OR v_r->>'codigo' <> 'rascunho_em_aberto' THEN
    RAISE EXCEPTION 'PROOF FAILED W: expected rascunho_em_aberto while the first draft is open, got %', v_r;
  END IF;
  IF (v_r->>'ordem_compra_id')::BIGINT <> v_oc1 THEN
    RAISE EXCEPTION 'PROOF FAILED W: the refusal did not name the open draft';
  END IF;

  -- Issuing the first document releases the (Pedido, fornecedor) draft slot.
  v_r := public.emitir_ordem_compra(v_oc1);
  IF (v_r->>'ok')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'PROOF FAILED W: could not issue the first document: %', v_r;
  END IF;
  SELECT sequencia_sugerida INTO v_seq FROM
    jsonb_to_record(public.sugerir_codigo_ordem_compra('9d1f0000-0000-4000-8000-00000000ed01'))
    AS x(sequencia_sugerida INTEGER);
  v_r := public.gerar_ordem_compra_do_planejamento(v_ids, 'PC-REPEAT-2', v_seq, 'db99-w-3');
  IF (v_r->>'ok')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'PROOF FAILED W: second generation refused: %', v_r;
  END IF;
  v_oc2 := (v_r->>'ordem_compra_id')::BIGINT;

  IF v_oc1 = v_oc2 THEN
    RAISE EXCEPTION 'PROOF FAILED W: both generations produced the same document';
  END IF;

  SELECT count(*) INTO v_ger FROM public.necessidade_compra_planejamento
   WHERE necessidade_id = 930000504 AND fornecedor_id = 930000301 AND gerado_em IS NOT NULL;
  IF v_ger <> 2 THEN
    RAISE EXCEPTION 'PROOF FAILED W: expected 2 generated rows for the supplier, got %', v_ger;
  END IF;
  IF (SELECT count(DISTINCT ordem_compra_id) FROM public.necessidade_compra_planejamento
       WHERE necessidade_id = 930000504 AND gerado_em IS NOT NULL) <> 2 THEN
    RAISE EXCEPTION 'PROOF FAILED W: the two generated rows are not linked to two documents';
  END IF;

  SELECT sum(kg_planejado) INTO v_total FROM public.necessidade_compra_planejamento
   WHERE necessidade_id = 930000504;
  IF v_total <> 1000.000 THEN
    RAISE EXCEPTION 'PROOF FAILED W: total is % (expected exactly the 1000 kg need)', v_total;
  END IF;
  RAISE NOTICE 'ok W: supplier % purchased twice, documents % and %, total 1000 kg', 930000301, v_oc1, v_oc2;
END $$;

\echo '--- X. permanent deletion releases, and merges into an existing live row'
DO $$
DECLARE
  v_r JSONB; v_seq INTEGER; v_oc_a BIGINT; v_oc_b BIGINT;
  v_ids BIGINT[]; v_live INTEGER; v_kg NUMERIC(12,3);
  v_total_antes NUMERIC(12,3); v_total_depois NUMERIC(12,3); v_bad BIGINT;
BEGIN
  -- Need 930000505 is reserved for this proof. Two pieces of housekeeping
  -- first, both of them real lifecycle actions rather than fixture surgery:
  --   (i) W's second document is still an OPEN DRAFT for supplier 930000301,
  --       and db/67 admits one active draft per (Pedido, fornecedor) — which
  --       is per PEDIDO, not per need, so it would block this proof too.
  --       Issuing it frees the slot exactly as an operator would.
  FOR v_ids IN
    SELECT ARRAY[id] FROM public.ordem_compra
     WHERE pedido_id = '9d1f0000-0000-4000-8000-00000000ed01'
       AND legado = FALSE AND status_administrativo = 'rascunho'
  LOOP
    v_r := public.emitir_ordem_compra(v_ids[1]);
    IF (v_r->>'ok')::boolean IS NOT TRUE THEN
      RAISE EXCEPTION 'PROOF FAILED X: could not free the draft slot on %: %', v_ids[1], v_r;
    END IF;
  END LOOP;

  v_r := public.substituir_planejamento_compra_necessidade(930000505,
    '[{"fornecedor_id":930000301,"kg":400.000},{"fornecedor_id":930000302,"kg":200.000}]'::jsonb,
    'db99-x-1');
  IF (v_r->>'ok')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'PROOF FAILED X: setup replacement refused: %', v_r;
  END IF;

  SELECT array_agg(id) INTO v_ids FROM public.necessidade_compra_planejamento
   WHERE necessidade_id = 930000505 AND fornecedor_id = 930000301 AND gerado_em IS NULL;
  SELECT sequencia_sugerida INTO v_seq FROM
    jsonb_to_record(public.sugerir_codigo_ordem_compra('9d1f0000-0000-4000-8000-00000000ed01'))
    AS x(sequencia_sugerida INTEGER);
  v_r := public.gerar_ordem_compra_do_planejamento(v_ids, 'PC-DEL-A', v_seq, 'db99-x-2');
  IF (v_r->>'ok')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'PROOF FAILED X: could not generate document A: %', v_r;
  END IF;
  v_oc_a := (v_r->>'ordem_compra_id')::BIGINT;

  SELECT array_agg(id) INTO v_ids FROM public.necessidade_compra_planejamento
   WHERE necessidade_id = 930000505 AND fornecedor_id = 930000302 AND gerado_em IS NULL;
  SELECT sequencia_sugerida INTO v_seq FROM
    jsonb_to_record(public.sugerir_codigo_ordem_compra('9d1f0000-0000-4000-8000-00000000ed01'))
    AS x(sequencia_sugerida INTEGER);
  v_r := public.gerar_ordem_compra_do_planejamento(v_ids, 'PC-DEL-B', v_seq, 'db99-x-3');
  IF (v_r->>'ok')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'PROOF FAILED X: could not generate document B: %', v_r;
  END IF;
  v_oc_b := (v_r->>'ordem_compra_id')::BIGINT;

  -- A NEW live row for supplier AA, alongside its already generated history.
  v_r := public.substituir_planejamento_compra_necessidade(930000505,
    '[{"fornecedor_id":930000301,"kg":300.000}]'::jsonb, 'db99-x-4');
  IF (v_r->>'ok')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'PROOF FAILED X: could not add a live row beside history: %', v_r;
  END IF;

  SELECT sum(kg_planejado) INTO v_total_antes
    FROM public.necessidade_compra_planejamento WHERE necessidade_id = 930000505;
  IF v_total_antes <> 900.000 THEN
    RAISE EXCEPTION 'PROOF FAILED X: setup total is % (expected 900.000)', v_total_antes;
  END IF;

  -- BRANCH (a) MERGE: a live row for (need, supplier) already exists, so the
  -- released 400 kg must be ADDED to it and the historical row removed.
  v_r := public.excluir_ordem_compra(v_oc_a);
  IF (v_r->>'ok')::boolean IS NOT TRUE OR (v_r->>'planejamentos_liberados')::INT <> 1 THEN
    RAISE EXCEPTION 'PROOF FAILED X: deletion of A did not release one row: %', v_r;
  END IF;
  SELECT count(*), coalesce(sum(kg_planejado), 0) INTO v_live, v_kg
    FROM public.necessidade_compra_planejamento
   WHERE necessidade_id = 930000505 AND fornecedor_id = 930000301 AND gerado_em IS NULL;
  IF v_live <> 1 THEN
    RAISE EXCEPTION 'PROOF FAILED X: merge produced % live rows for AA (expected 1)', v_live;
  END IF;
  IF v_kg <> 700.000 THEN
    RAISE EXCEPTION 'PROOF FAILED X: merged AA quantity is % (expected 300+400=700.000)', v_kg;
  END IF;
  IF EXISTS (SELECT 1 FROM public.necessidade_compra_planejamento
              WHERE necessidade_id = 930000505 AND fornecedor_id = 930000301
                AND gerado_em IS NOT NULL) THEN
    RAISE EXCEPTION 'PROOF FAILED X: the obsolete historical AA row survived the merge';
  END IF;

  -- BRANCH (b) REVIVE IN PLACE: no live row exists for supplier AB, so its
  -- released row simply becomes live again, keeping its own quantity.
  v_r := public.excluir_ordem_compra(v_oc_b);
  IF (v_r->>'ok')::boolean IS NOT TRUE OR (v_r->>'planejamentos_liberados')::INT <> 1 THEN
    RAISE EXCEPTION 'PROOF FAILED X: deletion of B did not release one row: %', v_r;
  END IF;
  SELECT count(*), coalesce(sum(kg_planejado), 0) INTO v_live, v_kg
    FROM public.necessidade_compra_planejamento
   WHERE necessidade_id = 930000505 AND fornecedor_id = 930000302 AND gerado_em IS NULL;
  IF v_live <> 1 OR v_kg <> 200.000 THEN
    RAISE EXCEPTION 'PROOF FAILED X: revive-in-place produced % row(s) at % kg', v_live, v_kg;
  END IF;

  -- The total planned quantity is EXACTLY what it was before both deletions.
  SELECT sum(kg_planejado) INTO v_total_depois
    FROM public.necessidade_compra_planejamento WHERE necessidade_id = 930000505;
  IF v_total_depois IS DISTINCT FROM v_total_antes THEN
    RAISE EXCEPTION 'PROOF FAILED X: total drifted % -> %', v_total_antes, v_total_depois;
  END IF;

  IF EXISTS (SELECT 1 FROM public.ordem_compra WHERE id IN (v_oc_a, v_oc_b)) THEN
    RAISE EXCEPTION 'PROOF FAILED X: a deleted document survived';
  END IF;

  SELECT count(*) INTO v_bad FROM public.necessidade_compra_planejamento p
   WHERE (p.gerado_em IS NULL AND (p.alocacao_id IS NOT NULL OR p.ordem_compra_id IS NOT NULL))
      OR (p.gerado_em IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM public.ordem_compra_item_alocacao a WHERE a.id = p.alocacao_id));
  IF v_bad <> 0 THEN
    RAISE EXCEPTION 'PROOF FAILED X: % orphan planning row(s)', v_bad;
  END IF;

  RAISE NOTICE 'ok X: merge 300+400=700,000 kg and revive-in-place 200,000 kg; total 900,000 kg unchanged; zero orphans';
END $$;

\echo '--- Y. quick planning offers BOTH exact-pending and adjusted quantity'
DO $$
DECLARE v_r JSONB; v_kg NUMERIC(12,3); v_before BIGINT; v_after BIGINT;
BEGIN
  -- Need 930000505 is used here because X left all of its rows LIVE (both
  -- documents were deleted), so clearing them frees the whole 1,000 kg.
  -- Need 930000504 is NOT usable: W's two generated rows still hold its
  -- full quantity, and clearing live rows correctly does not touch history.
  v_r := public.substituir_planejamento_compra_necessidade(930000505,
    '[]'::jsonb, 'db99-y-0');
  IF (v_r->>'ok')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'PROOF FAILED Y: could not clear the need: %', v_r;
  END IF;

  -- MODE 1 — adjusted quantity: the operator states the kg explicitly.
  v_r := public.aplicar_planejamento_rapido(
    '9d1f0000-0000-4000-8000-00000000ed01', 930000301,
    '[{"necessidade_id": 930000505, "kg": 250.000}]'::jsonb, 'db99-y-1');
  IF (v_r->>'ok')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'PROOF FAILED Y: adjusted-quantity mode refused: %', v_r;
  END IF;
  SELECT kg_planejado INTO v_kg FROM public.necessidade_compra_planejamento
   WHERE necessidade_id = 930000505 AND fornecedor_id = 930000301 AND gerado_em IS NULL;
  IF v_kg <> 250.000 THEN
    RAISE EXCEPTION 'PROOF FAILED Y: adjusted mode wrote % (expected 250.000)', v_kg;
  END IF;

  -- MODE 2 — exact pending: no `kg` key, so the server fills the balance.
  v_r := public.aplicar_planejamento_rapido(
    '9d1f0000-0000-4000-8000-00000000ed01', 930000302,
    '[{"necessidade_id": 930000505}]'::jsonb, 'db99-y-2');
  IF (v_r->>'ok')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'PROOF FAILED Y: exact-pending mode refused: %', v_r;
  END IF;
  SELECT kg_planejado INTO v_kg FROM public.necessidade_compra_planejamento
   WHERE necessidade_id = 930000505 AND fornecedor_id = 930000302 AND gerado_em IS NULL;
  IF v_kg <> 750.000 THEN
    RAISE EXCEPTION 'PROOF FAILED Y: exact-pending wrote % (expected the 750.000 balance)', v_kg;
  END IF;

  -- Both modes refuse atomically: an over-balance second item writes nothing.
  SELECT count(*) INTO v_before FROM public.necessidade_compra_planejamento;
  v_r := public.aplicar_planejamento_rapido(
    '9d1f0000-0000-4000-8000-00000000ed01', 930000301,
    '[{"necessidade_id": 930000503, "kg": 5.000}, {"necessidade_id": 930000505, "kg": 9999.000}]'::jsonb,
    'db99-y-3');
  IF (v_r->>'ok')::boolean IS NOT FALSE OR v_r->>'codigo' <> 'excede_saldo' THEN
    RAISE EXCEPTION 'PROOF FAILED Y: an over-balance adjusted batch succeeded: %', v_r;
  END IF;
  SELECT count(*) INTO v_after FROM public.necessidade_compra_planejamento;
  IF v_after <> v_before THEN
    RAISE EXCEPTION 'PROOF FAILED Y: refused batch still wrote (% -> %)', v_before, v_after;
  END IF;
  RAISE NOTICE 'ok Y: adjusted 250,000 kg and exact-pending 750,000 kg; both refuse atomically';
END $$;

RESET ROLE;

\echo ''
\echo 'DB99_PLANEJAMENTO_INTEGRATION_PASS'
