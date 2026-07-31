-- tests/planejamento-compra-db100.integration.sql
--
-- PURCHASE-ORDER-POST-GENERATION-STABILIZATION-R1 — SQL assertion suite for
-- db/100.
--
-- Driven by tests/planejamento-compra-db99.integration.mjs against the same
-- disposable cluster, AFTER the db/99 suite and its db/100 fixture. Every
-- lifecycle mutation below goes through a real RPC as a real `authenticated`
-- administrator; only the irreversible-history rows and the canonical-active
-- cutover state are planted behind the triggers, because their own writers
-- are deliberately fenced and are NOT under test here.
--
-- Success marker: DB100_LIFECYCLE_INTEGRATION_PASS
-- Any failed proof raises and ON_ERROR_STOP aborts before the marker.

\set ON_ERROR_STOP on

-- Become the real authenticated administrator.
SELECT set_config('request.jwt.claim.sub', '9d1f0000-0000-4000-8000-00000000ad01', false);
SET ROLE authenticated;

-- =====================================================================
-- AA. THE CANONICAL COVERAGE OWNER
-- =====================================================================
\echo '--- AA. one server-owned definition of active purchasing coverage'
DO $$
DECLARE v_n INTEGER;
BEGIN
  IF to_regprocedure('public.oc_cobertura_ativa(bigint)') IS NULL THEN
    RAISE EXCEPTION 'PROOF FAILED AA: oc_cobertura_ativa absent';
  END IF;

  -- Every proof below restates the coverage predicate in plain SQL instead of
  -- calling that helper. Two reasons: it is owner-only by design (section AI),
  -- and a proof that asks the implementation whether the implementation is
  -- right proves nothing.

  -- There is exactly ONE lifecycle authority: no second status column and no
  -- competing marker was introduced on either coverage-bearing table.
  SELECT count(*) INTO v_n FROM information_schema.columns
   WHERE table_schema = 'public'
     AND table_name IN ('necessidade_compra_planejamento', 'ordem_compra_item_alocacao')
     AND (column_name ILIKE '%cancel%' OR column_name ILIKE '%ativo%'
          OR column_name ILIKE '%status%');
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'PROOF FAILED AA: a second lifecycle authority was introduced (% column(s))', v_n;
  END IF;
  RAISE NOTICE 'ok AA: coverage derives from ordem_compra.status_administrativo alone';
END $$;

-- =====================================================================
-- AB. rascunho -> cancelada, and what cancellation releases
--     Proofs 1, 3, 4, 5, 6, 7, 11.
-- =====================================================================
\echo '--- AB. rascunho cancellation preserves history and releases coverage'
DO $$
DECLARE
  v_r JSONB; v_plan BIGINT; v_oc BIGINT; v_seq INTEGER;
  v_codigo TEXT; v_ident TEXT;
  v_itens INTEGER; v_aloc INTEGER; v_planl INTEGER; v_ev INTEGER;
  v_kg NUMERIC(12,3); v_restante NUMERIC(12,3); v_ativo NUMERIC(12,3);
  v_cancel_em TIMESTAMPTZ; v_cancel_por UUID;
  v_before JSONB;
BEGIN
  v_r := public.substituir_planejamento_compra_necessidade(930000901,
    '[{"fornecedor_id":930000303,"kg":400.000}]'::jsonb, 'db100-ab-plan');
  IF (v_r->>'ok')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'PROOF FAILED AB: planning refused: %', v_r;
  END IF;

  SELECT id INTO v_plan FROM public.necessidade_compra_planejamento
   WHERE necessidade_id = 930000901 AND gerado_em IS NULL;
  SELECT coalesce(max(ultimo_seq),0)+1 INTO v_seq FROM public.pedido_identidade_numeros
   WHERE pedido_id = '9d1f0000-0000-4000-8000-00000000ed01' AND escopo = 'OC';

  v_r := public.gerar_ordem_compra_do_planejamento(
    ARRAY[v_plan]::bigint[], 'PC100-AB', v_seq, 'db100-ab-gen');
  IF (v_r->>'ok')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'PROOF FAILED AB: generation refused: %', v_r;
  END IF;
  v_oc := (v_r->>'ordem_compra_id')::BIGINT;

  -- Before cancellation the coverage is real and counted.
  SELECT kg_alocado INTO v_kg FROM public.necessidade_compra_fio WHERE id = 930000901;
  IF v_kg <> 400.000 THEN
    RAISE EXCEPTION 'PROOF FAILED AB: kg_alocado is % before cancellation (expected 400.000)', v_kg;
  END IF;

  SELECT count(*) INTO v_itens FROM public.ordem_compra_item WHERE ordem_id = v_oc;
  SELECT count(*) INTO v_aloc FROM public.ordem_compra_item_alocacao a
    JOIN public.ordem_compra_item i ON i.id = a.item_id WHERE i.ordem_id = v_oc;
  SELECT count(*) INTO v_planl FROM public.necessidade_compra_planejamento
   WHERE ordem_compra_id = v_oc;
  SELECT codigo, identidade_operacional INTO v_codigo, v_ident
    FROM public.ordem_compra WHERE id = v_oc;
  v_before := jsonb_build_object('itens', v_itens, 'aloc', v_aloc, 'plan', v_planl,
                                 'codigo', v_codigo, 'ident', v_ident);

  -- ---- CANCEL (proof 1) ----
  v_r := public.cancelar_ordem_compra(v_oc);
  IF (v_r->>'ok')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'PROOF FAILED AB(1): rascunho cancellation refused: %', v_r;
  END IF;
  IF v_r->>'status_anterior' <> 'rascunho' OR v_r->>'status_administrativo' <> 'cancelada' THEN
    RAISE EXCEPTION 'PROOF FAILED AB(1): unexpected transition envelope: %', v_r;
  END IF;
  IF (v_r->>'kg_liberado_total')::NUMERIC <> 400.000 THEN
    RAISE EXCEPTION 'PROOF FAILED AB(1): released % (expected 400.000)', v_r->>'kg_liberado_total';
  END IF;

  SELECT cancelada_em, cancelada_por INTO v_cancel_em, v_cancel_por
    FROM public.ordem_compra WHERE id = v_oc;
  IF v_cancel_em IS NULL OR v_cancel_por IS NULL THEN
    RAISE EXCEPTION 'PROOF FAILED AB(1): cancelada_em/cancelada_por not set';
  END IF;

  -- ---- proof 3: the whole historical graph survives ----
  SELECT count(*) INTO v_itens FROM public.ordem_compra_item WHERE ordem_id = v_oc;
  SELECT count(*) INTO v_aloc FROM public.ordem_compra_item_alocacao a
    JOIN public.ordem_compra_item i ON i.id = a.item_id WHERE i.ordem_id = v_oc;
  SELECT count(*) INTO v_planl FROM public.necessidade_compra_planejamento
   WHERE ordem_compra_id = v_oc;
  SELECT codigo, identidade_operacional INTO v_codigo, v_ident
    FROM public.ordem_compra WHERE id = v_oc;
  IF v_itens <> (v_before->>'itens')::INTEGER
     OR v_aloc <> (v_before->>'aloc')::INTEGER
     OR v_planl <> (v_before->>'plan')::INTEGER
     OR v_codigo IS DISTINCT FROM v_before->>'codigo'
     OR v_ident IS DISTINCT FROM v_before->>'ident' THEN
    RAISE EXCEPTION 'PROOF FAILED AB(3): the historical graph changed: % -> itens=%, aloc=%, plan=%, codigo=%, ident=%',
      v_before, v_itens, v_aloc, v_planl, v_codigo, v_ident;
  END IF;

  -- ---- proof 4: exactly one cancellation event ----
  SELECT count(*) INTO v_ev FROM public.ordem_compra_eventos
   WHERE ordem_compra_id = v_oc AND tipo_evento = 'cancelada';
  IF v_ev <> 1 THEN
    RAISE EXCEPTION 'PROOF FAILED AB(4): % cancellation events (expected exactly 1)', v_ev;
  END IF;

  -- ---- proof 5: the need cache stops counting the cancelled coverage ----
  SELECT kg_alocado INTO v_kg FROM public.necessidade_compra_fio WHERE id = 930000901;
  IF v_kg <> 0.000 THEN
    RAISE EXCEPTION 'PROOF FAILED AB(5): kg_alocado is % after cancellation (expected 0.000)', v_kg;
  END IF;

  -- ---- proof 6: kg_restante rose by exactly the cancelled amount ----
  SELECT (linha->>'kg_restante')::NUMERIC INTO v_restante
    FROM jsonb_array_elements(
      public.obter_planejamento_compra_pedido('9d1f0000-0000-4000-8000-00000000ed01')->'necessidades'
    ) AS linha
   WHERE (linha->>'necessidade_id')::BIGINT = 930000901;
  IF v_restante <> 1000.000 THEN
    RAISE EXCEPTION 'PROOF FAILED AB(6): kg_restante is % (expected the full 1000.000 back)', v_restante;
  END IF;

  -- ---- proof 7: active planning totals exclude the cancelled order ----
  SELECT coalesce(sum(p.kg_planejado), 0)::NUMERIC(12,3) INTO v_ativo
    FROM public.necessidade_compra_planejamento p
    LEFT JOIN public.ordem_compra o ON o.id = p.ordem_compra_id
   WHERE p.necessidade_id = 930000901
     AND (p.ordem_compra_id IS NULL OR o.status_administrativo <> 'cancelada');
  IF v_ativo <> 0.000 THEN
    RAISE EXCEPTION 'PROOF FAILED AB(7): active planning total is % (expected 0.000)', v_ativo;
  END IF;

  -- ---- proof 11: repeated cancellation releases nothing twice ----
  v_r := public.cancelar_ordem_compra(v_oc);
  IF (v_r->>'ok')::boolean IS NOT FALSE OR v_r->>'codigo' <> 'ja_cancelada' THEN
    RAISE EXCEPTION 'PROOF FAILED AB(11): a second cancellation was accepted: %', v_r;
  END IF;
  SELECT count(*) INTO v_ev FROM public.ordem_compra_eventos
   WHERE ordem_compra_id = v_oc AND tipo_evento = 'cancelada';
  IF v_ev <> 1 THEN
    RAISE EXCEPTION 'PROOF FAILED AB(11): the refused retry wrote a second event (% total)', v_ev;
  END IF;
  SELECT kg_alocado INTO v_kg FROM public.necessidade_compra_fio WHERE id = 930000901;
  SELECT coalesce(sum(p.kg_planejado), 0)::NUMERIC(12,3) INTO v_ativo
    FROM public.necessidade_compra_planejamento p
    LEFT JOIN public.ordem_compra o ON o.id = p.ordem_compra_id
   WHERE p.necessidade_id = 930000901
     AND (p.ordem_compra_id IS NULL OR o.status_administrativo <> 'cancelada');
  IF v_kg <> 0.000 OR v_ativo <> 0.000 THEN
    RAISE EXCEPTION 'PROOF FAILED AB(11): the refused retry moved balance (kg_alocado=%, ativo=%)', v_kg, v_ativo;
  END IF;

  RAISE NOTICE 'ok AB: cancelled OC % keeps its whole graph and releases exactly 400,000 kg once', v_oc;
END $$;

-- =====================================================================
-- AC. The released balance is genuinely reusable
--     Proofs 8, 9, 10.
-- =====================================================================
\echo '--- AC. released balance replans, regenerates, and the original stays intact'
DO $$
DECLARE
  v_r JSONB; v_plan BIGINT; v_seq INTEGER;
  v_oc_cancelada BIGINT; v_oc_nova BIGINT;
  v_itens INTEGER; v_aloc INTEGER; v_kg NUMERIC(12,3);
BEGIN
  SELECT id INTO v_oc_cancelada FROM public.ordem_compra
   WHERE codigo = 'PC100-AB';

  -- proof 8: a new planning row uses the released balance — and does so for
  -- the SAME supplier, which is exactly what the live-row uniqueness of db/99
  -- was designed to keep possible.
  v_r := public.substituir_planejamento_compra_necessidade(930000901,
    '[{"fornecedor_id":930000303,"kg":1000.000}]'::jsonb, 'db100-ac-plan');
  IF (v_r->>'ok')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'PROOF FAILED AC(8): the released balance was not replannable: %', v_r;
  END IF;
  IF (v_r->>'necessidade_kg_planejado')::NUMERIC <> 1000.000 THEN
    RAISE EXCEPTION 'PROOF FAILED AC(8): active planned total is % (expected 1000.000)',
      v_r->>'necessidade_kg_planejado';
  END IF;

  -- proof 9: a replacement Purchase Order can be generated.
  SELECT id INTO v_plan FROM public.necessidade_compra_planejamento
   WHERE necessidade_id = 930000901 AND gerado_em IS NULL;
  SELECT coalesce(max(ultimo_seq),0)+1 INTO v_seq FROM public.pedido_identidade_numeros
   WHERE pedido_id = '9d1f0000-0000-4000-8000-00000000ed01' AND escopo = 'OC';
  v_r := public.gerar_ordem_compra_do_planejamento(
    ARRAY[v_plan]::bigint[], 'PC100-AC', v_seq, 'db100-ac-gen');
  IF (v_r->>'ok')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'PROOF FAILED AC(9): the replacement order could not be generated: %', v_r;
  END IF;
  v_oc_nova := (v_r->>'ordem_compra_id')::BIGINT;

  SELECT kg_alocado INTO v_kg FROM public.necessidade_compra_fio WHERE id = 930000901;
  IF v_kg <> 1000.000 THEN
    RAISE EXCEPTION 'PROOF FAILED AC(9): the replacement did not take the coverage (kg_alocado=%)', v_kg;
  END IF;

  -- proof 10: the cancelled original is still there, whole, and still named.
  SELECT count(*) INTO v_itens FROM public.ordem_compra_item WHERE ordem_id = v_oc_cancelada;
  SELECT count(*) INTO v_aloc FROM public.ordem_compra_item_alocacao a
    JOIN public.ordem_compra_item i ON i.id = a.item_id WHERE i.ordem_id = v_oc_cancelada;
  IF v_itens = 0 OR v_aloc = 0 THEN
    RAISE EXCEPTION 'PROOF FAILED AC(10): the cancelled original lost its items/allocations';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.ordem_compra
                  WHERE id = v_oc_cancelada AND codigo = 'PC100-AB'
                    AND status_administrativo = 'cancelada') THEN
    RAISE EXCEPTION 'PROOF FAILED AC(10): the cancelled original lost its identity or state';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.necessidade_compra_planejamento
                  WHERE ordem_compra_id = v_oc_cancelada) THEN
    RAISE EXCEPTION 'PROOF FAILED AC(10): the cancelled original lost its planning provenance';
  END IF;

  RAISE NOTICE 'ok AC: replacement OC % generated from the released balance; original % intact',
    v_oc_nova, v_oc_cancelada;
END $$;

-- =====================================================================
-- AD. emitida -> cancelada -> excluida
--     Proofs 2, 13, 14, 15.
-- =====================================================================
\echo '--- AD. an emitted order cancels, then a cancelled one deletes without a second release'
DO $$
DECLARE
  v_r JSONB; v_plan BIGINT; v_seq INTEGER; v_oc BIGINT;
  v_kg NUMERIC(12,3); v_ativo NUMERIC(12,3); v_rows INTEGER; v_acoes JSONB;
BEGIN
  v_r := public.substituir_planejamento_compra_necessidade(930000903,
    '[{"fornecedor_id":930000304,"kg":500.000}]'::jsonb, 'db100-ad-plan');
  IF (v_r->>'ok')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'PROOF FAILED AD: planning refused: %', v_r;
  END IF;
  SELECT id INTO v_plan FROM public.necessidade_compra_planejamento
   WHERE necessidade_id = 930000903 AND gerado_em IS NULL;
  SELECT coalesce(max(ultimo_seq),0)+1 INTO v_seq FROM public.pedido_identidade_numeros
   WHERE pedido_id = '9d1f0000-0000-4000-8000-00000000ed01' AND escopo = 'OC';
  v_r := public.gerar_ordem_compra_do_planejamento(
    ARRAY[v_plan]::bigint[], 'PC100-AD', v_seq, 'db100-ad-gen');
  IF (v_r->>'ok')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'PROOF FAILED AD: generation refused: %', v_r;
  END IF;
  v_oc := (v_r->>'ordem_compra_id')::BIGINT;

  v_r := public.emitir_ordem_compra(v_oc);
  IF (v_r->>'ok')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'PROOF FAILED AD: emission refused: %', v_r;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.ordem_compra
                  WHERE id = v_oc AND status_administrativo = 'emitida'
                    AND emitida_em IS NOT NULL) THEN
    RAISE EXCEPTION 'PROOF FAILED AD: the order is not emitida';
  END IF;

  -- ---- proof 13: an emitted order cannot be deleted directly ----
  -- Read through the AUTHORITATIVE PROJECTION the screen itself obeys, not
  -- through the internal owner: this is the same signal the Excluir control
  -- derives from.
  v_acoes := public.obter_ordem_compra_admin(v_oc)->'ordem';
  IF (v_acoes->'acoes'->>'excluir')::boolean IS NOT FALSE THEN
    RAISE EXCEPTION 'PROOF FAILED AD(13): the read model offers Excluir on an emitted order';
  END IF;
  IF v_acoes->>'bloqueio_exclusao' <> 'estado_invalido' THEN
    RAISE EXCEPTION 'PROOF FAILED AD(13): unexpected projected blocker %',
      v_acoes->>'bloqueio_exclusao';
  END IF;
  v_r := public.excluir_ordem_compra(v_oc);
  IF (v_r->>'ok')::boolean IS NOT FALSE OR v_r->>'codigo' <> 'estado_invalido' THEN
    RAISE EXCEPTION 'PROOF FAILED AD(13): the writer deleted an emitted order: %', v_r;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.ordem_compra WHERE id = v_oc) THEN
    RAISE EXCEPTION 'PROOF FAILED AD(13): the emitted order disappeared';
  END IF;

  -- ---- proof 2: an emitted order with no irreversible history cancels ----
  -- The Cancelar action on an EMITTED order must come from the server. Under
  -- db/97 this projection was hardcoded false outside rascunho, which is
  -- exactly why the control could never appear.
  v_acoes := public.obter_ordem_compra_admin(v_oc)->'ordem';
  IF (v_acoes->'acoes'->>'cancelar')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'PROOF FAILED AD(2): the read model hides Cancelar on an emitted order';
  END IF;
  IF v_acoes->>'bloqueio_cancelamento' IS NOT NULL THEN
    RAISE EXCEPTION 'PROOF FAILED AD(2): a cancellation blocker survived: %',
      v_acoes->>'bloqueio_cancelamento';
  END IF;
  v_r := public.cancelar_ordem_compra(v_oc);
  IF (v_r->>'ok')::boolean IS NOT TRUE OR v_r->>'status_anterior' <> 'emitida' THEN
    RAISE EXCEPTION 'PROOF FAILED AD(2): emitted-order cancellation refused: %', v_r;
  END IF;
  SELECT kg_alocado INTO v_kg FROM public.necessidade_compra_fio WHERE id = 930000903;
  SELECT coalesce(sum(p.kg_planejado), 0)::NUMERIC(12,3) INTO v_ativo
    FROM public.necessidade_compra_planejamento p
    LEFT JOIN public.ordem_compra o ON o.id = p.ordem_compra_id
   WHERE p.necessidade_id = 930000903
     AND (p.ordem_compra_id IS NULL OR o.status_administrativo <> 'cancelada');
  IF v_kg <> 0.000 OR v_ativo <> 0.000 THEN
    RAISE EXCEPTION 'PROOF FAILED AD(2): coverage survived cancellation (kg_alocado=%, ativo=%)', v_kg, v_ativo;
  END IF;

  -- ---- proof 14: a cancelled, previously emitted order IS deletable ----
  -- This is precisely what db/97's absolute `emitida_em IS NOT NULL` rule
  -- forbade forever.
  v_acoes := public.obter_ordem_compra_admin(v_oc)->'ordem';
  IF (v_acoes->'acoes'->>'excluir')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'PROOF FAILED AD(14): a cancelled previously-emitted order is still blocked: %',
      v_acoes->>'bloqueio_exclusao';
  END IF;
  IF (v_acoes->'acoes'->>'cancelar')::boolean IS NOT FALSE THEN
    RAISE EXCEPTION 'PROOF FAILED AD(14): the read model still offers Cancelar on a cancelled order';
  END IF;

  v_r := public.excluir_ordem_compra(v_oc);
  IF (v_r->>'ok')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'PROOF FAILED AD(14): deletion of the cancelled order refused: %', v_r;
  END IF;
  IF (v_r->>'origem_cancelada')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'PROOF FAILED AD(14): the writer did not take the cancelada branch: %', v_r;
  END IF;
  IF (v_r->>'planejamentos_removidos')::INTEGER <> 1
     OR (v_r->>'planejamentos_liberados')::INTEGER <> 0 THEN
    RAISE EXCEPTION 'PROOF FAILED AD(14): wrong planning disposition: %', v_r;
  END IF;

  -- ---- proof 15: no second release ----
  -- The cancellation already returned the 500 kg. Deletion must NOT revive the
  -- historical rows: the need must still read exactly 0 planned, never 500.
  SELECT count(*) INTO v_rows FROM public.necessidade_compra_planejamento
   WHERE necessidade_id = 930000903;
  IF v_rows <> 0 THEN
    RAISE EXCEPTION 'PROOF FAILED AD(15): deletion revived % planning row(s) — the quantity was released twice', v_rows;
  END IF;
  SELECT coalesce(sum(p.kg_planejado), 0)::NUMERIC(12,3) INTO v_ativo
    FROM public.necessidade_compra_planejamento p
    LEFT JOIN public.ordem_compra o ON o.id = p.ordem_compra_id
   WHERE p.necessidade_id = 930000903
     AND (p.ordem_compra_id IS NULL OR o.status_administrativo <> 'cancelada');
  SELECT kg_alocado INTO v_kg FROM public.necessidade_compra_fio WHERE id = 930000903;
  IF v_ativo <> 0.000 OR v_kg <> 0.000 THEN
    RAISE EXCEPTION 'PROOF FAILED AD(15): double release detected (ativo=%, kg_alocado=%)', v_ativo, v_kg;
  END IF;

  RAISE NOTICE 'ok AD: emitida -> cancelada -> excluida, released exactly once';
END $$;

-- =====================================================================
-- AE1. Irreversible history blocks CANCELLATION (proof 12)
-- =====================================================================
\echo '--- AE1. receipt history blocks cancellation'
DO $$
DECLARE v_r JSONB; v_plan BIGINT; v_seq INTEGER; v_oc BIGINT;
BEGIN
  v_r := public.substituir_planejamento_compra_necessidade(930000902,
    '[{"fornecedor_id":930000305,"kg":300.000}]'::jsonb, 'db100-ae1-plan');
  IF (v_r->>'ok')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'PROOF FAILED AE1: planning refused: %', v_r;
  END IF;
  SELECT id INTO v_plan FROM public.necessidade_compra_planejamento
   WHERE necessidade_id = 930000902 AND gerado_em IS NULL;
  SELECT coalesce(max(ultimo_seq),0)+1 INTO v_seq FROM public.pedido_identidade_numeros
   WHERE pedido_id = '9d1f0000-0000-4000-8000-00000000ed01' AND escopo = 'OC';
  v_r := public.gerar_ordem_compra_do_planejamento(
    ARRAY[v_plan]::bigint[], 'PC100-AE1', v_seq, 'db100-ae1-gen');
  IF (v_r->>'ok')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'PROOF FAILED AE1: generation refused: %', v_r;
  END IF;
  v_oc := (v_r->>'ordem_compra_id')::BIGINT;
  v_r := public.emitir_ordem_compra(v_oc);
  IF (v_r->>'ok')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'PROOF FAILED AE1: emission refused: %', v_r;
  END IF;
  RAISE NOTICE 'ok AE1 setup: emitted OC % awaits its planted receipt', v_oc;
END $$;

-- The native receipt writer is deliberately fenced while the cutover is
-- inactive, so the irreversible row is planted behind the triggers. What is
-- under test is the ELIGIBILITY OWNER's reaction to it, not the writer.
RESET ROLE;
SET session_replication_role = replica;
INSERT INTO public.ordem_compra_recebimentos
  (ordem_compra_id, comando_tipo, idempotency_namespace, idempotency_key,
   ator_id, ator_tipo, ocorrido_em, documento_ref, origem_tipo, origem_ref,
   comando_payload, comando_hash, resultado_metadata)
SELECT oc.id, 'recebimento', 'native_receipt_v1', 'db100-ae1-receipt',
       '9d1f0000-0000-4000-8000-00000000ad01', 'admin', now(), 'NF-DB100-AE1',
       'nota_fiscal', 'AE1', '{}'::jsonb, md5('db100-ae1'), '{}'::jsonb
  FROM public.ordem_compra oc WHERE oc.codigo = 'PC100-AE1';
SET session_replication_role = origin;
SET ROLE authenticated;

DO $$
DECLARE v_oc BIGINT; v_r JSONB; v_status TEXT; v_acoes JSONB;
BEGIN
  SELECT id INTO v_oc FROM public.ordem_compra WHERE codigo = 'PC100-AE1';

  v_acoes := public.obter_ordem_compra_admin(v_oc)->'ordem';
  IF (v_acoes->'acoes'->>'cancelar')::boolean IS NOT FALSE
     OR v_acoes->>'bloqueio_cancelamento' <> 'historico_irreversivel' THEN
    RAISE EXCEPTION 'PROOF FAILED AE1(12): receipt history did not block cancellation: %', v_acoes;
  END IF;

  v_r := public.cancelar_ordem_compra(v_oc);
  IF (v_r->>'ok')::boolean IS NOT FALSE OR v_r->>'codigo' <> 'historico_irreversivel' THEN
    RAISE EXCEPTION 'PROOF FAILED AE1(12): the writer cancelled an order with receipt history: %', v_r;
  END IF;
  SELECT status_administrativo INTO v_status FROM public.ordem_compra WHERE id = v_oc;
  IF v_status <> 'emitida' THEN
    RAISE EXCEPTION 'PROOF FAILED AE1(12): the refused cancellation still mutated the status (%)', v_status;
  END IF;
  RAISE NOTICE 'ok AE1: receipt history blocks cancellation and mutates nothing';
END $$;

-- =====================================================================
-- AE2. Irreversible history blocks PERMANENT DELETION (proof 17)
-- =====================================================================
\echo '--- AE2. receipt history blocks permanent deletion of a draft'
DO $$
DECLARE v_r JSONB; v_plan BIGINT; v_seq INTEGER; v_oc BIGINT;
BEGIN
  v_r := public.substituir_planejamento_compra_necessidade(930000907,
    '[{"fornecedor_id":930000306,"kg":120.000}]'::jsonb, 'db100-ae2-plan');
  IF (v_r->>'ok')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'PROOF FAILED AE2: planning refused: %', v_r;
  END IF;
  SELECT id INTO v_plan FROM public.necessidade_compra_planejamento
   WHERE necessidade_id = 930000907 AND gerado_em IS NULL;
  SELECT coalesce(max(ultimo_seq),0)+1 INTO v_seq FROM public.pedido_identidade_numeros
   WHERE pedido_id = '9d1f0000-0000-4000-8000-00000000ed01' AND escopo = 'OC';
  v_r := public.gerar_ordem_compra_do_planejamento(
    ARRAY[v_plan]::bigint[], 'PC100-AE2', v_seq, 'db100-ae2-gen');
  IF (v_r->>'ok')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'PROOF FAILED AE2: generation refused: %', v_r;
  END IF;
  v_oc := (v_r->>'ordem_compra_id')::BIGINT;
  -- Deliberately left in rascunho, so the ONLY thing that can refuse the
  -- deletion below is the irreversible history.
  IF (public.obter_ordem_compra_admin(v_oc)->'ordem'->'acoes'->>'excluir')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'PROOF FAILED AE2: the clean draft was not deletable to begin with';
  END IF;
END $$;

RESET ROLE;
SET session_replication_role = replica;
INSERT INTO public.ordem_compra_recebimentos
  (ordem_compra_id, comando_tipo, idempotency_namespace, idempotency_key,
   ator_id, ator_tipo, ocorrido_em, documento_ref, origem_tipo, origem_ref,
   comando_payload, comando_hash, resultado_metadata)
SELECT oc.id, 'recebimento', 'native_receipt_v1', 'db100-ae2-receipt',
       '9d1f0000-0000-4000-8000-00000000ad01', 'admin', now(), 'NF-DB100-AE2',
       'nota_fiscal', 'AE2', '{}'::jsonb, md5('db100-ae2'), '{}'::jsonb
  FROM public.ordem_compra oc WHERE oc.codigo = 'PC100-AE2';
SET session_replication_role = origin;
SET ROLE authenticated;

DO $$
DECLARE v_oc BIGINT; v_r JSONB; v_n INTEGER;
BEGIN
  SELECT id INTO v_oc FROM public.ordem_compra WHERE codigo = 'PC100-AE2';

  IF public.obter_ordem_compra_admin(v_oc)->'ordem'->>'bloqueio_exclusao'
       <> 'historico_irreversivel' THEN
    RAISE EXCEPTION 'PROOF FAILED AE2(17): receipt history did not block deletion: %',
      public.obter_ordem_compra_admin(v_oc)->'ordem'->>'bloqueio_exclusao';
  END IF;
  v_r := public.excluir_ordem_compra(v_oc);
  IF (v_r->>'ok')::boolean IS NOT FALSE OR v_r->>'codigo' <> 'historico_irreversivel' THEN
    RAISE EXCEPTION 'PROOF FAILED AE2(17): the writer deleted an order with receipt history: %', v_r;
  END IF;
  SELECT count(*) INTO v_n FROM public.ordem_compra WHERE id = v_oc;
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'PROOF FAILED AE2(17): the order disappeared anyway';
  END IF;
  RAISE NOTICE 'ok AE2: receipt history blocks permanent deletion';
END $$;

-- =====================================================================
-- AF. A never-cancelled draft still deletes with db/99's release/merge
--     Proof 16.
-- =====================================================================
\echo '--- AF. draft deletion retains the db/99 release/merge semantics'
DO $$
DECLARE
  v_r JSONB; v_plan BIGINT; v_seq INTEGER; v_oc BIGINT;
  v_live INTEGER; v_kg NUMERIC(12,3); v_cache NUMERIC(12,3);
BEGIN
  v_r := public.substituir_planejamento_compra_necessidade(930000904,
    '[{"fornecedor_id":930000307,"kg":300.000}]'::jsonb, 'db100-af-plan');
  IF (v_r->>'ok')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'PROOF FAILED AF: planning refused: %', v_r;
  END IF;
  SELECT id INTO v_plan FROM public.necessidade_compra_planejamento
   WHERE necessidade_id = 930000904 AND gerado_em IS NULL;
  SELECT coalesce(max(ultimo_seq),0)+1 INTO v_seq FROM public.pedido_identidade_numeros
   WHERE pedido_id = '9d1f0000-0000-4000-8000-00000000ed01' AND escopo = 'OC';
  v_r := public.gerar_ordem_compra_do_planejamento(
    ARRAY[v_plan]::bigint[], 'PC100-AF', v_seq, 'db100-af-gen');
  IF (v_r->>'ok')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'PROOF FAILED AF: generation refused: %', v_r;
  END IF;
  v_oc := (v_r->>'ordem_compra_id')::BIGINT;

  -- A LIVE row for the SAME supplier, so deletion must MERGE rather than
  -- resurrect a duplicate — the exact db/99 C1 case.
  v_r := public.substituir_planejamento_compra_necessidade(930000904,
    '[{"fornecedor_id":930000307,"kg":200.000}]'::jsonb, 'db100-af-live');
  IF (v_r->>'ok')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'PROOF FAILED AF: the live row could not be added: %', v_r;
  END IF;

  v_r := public.excluir_ordem_compra(v_oc);
  IF (v_r->>'ok')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'PROOF FAILED AF(16): draft deletion refused: %', v_r;
  END IF;
  IF (v_r->>'origem_cancelada')::boolean IS NOT FALSE THEN
    RAISE EXCEPTION 'PROOF FAILED AF(16): the writer took the cancelada branch for a draft: %', v_r;
  END IF;
  IF (v_r->>'planejamentos_liberados')::INTEGER <> 1
     OR (v_r->>'planejamentos_removidos')::INTEGER <> 0 THEN
    RAISE EXCEPTION 'PROOF FAILED AF(16): wrong planning disposition: %', v_r;
  END IF;

  SELECT count(*), coalesce(sum(kg_planejado), 0)::NUMERIC(12,3) INTO v_live, v_kg
    FROM public.necessidade_compra_planejamento
   WHERE necessidade_id = 930000904 AND gerado_em IS NULL;
  IF v_live <> 1 OR v_kg <> 500.000 THEN
    RAISE EXCEPTION 'PROOF FAILED AF(16): expected 1 merged live row at 500.000 kg, got % row(s) at % kg', v_live, v_kg;
  END IF;
  IF EXISTS (SELECT 1 FROM public.necessidade_compra_planejamento
              WHERE necessidade_id = 930000904
                AND (gerado_em IS NOT NULL OR alocacao_id IS NOT NULL OR ordem_compra_id IS NOT NULL)) THEN
    RAISE EXCEPTION 'PROOF FAILED AF(16): residual generation linkage after draft deletion';
  END IF;
  SELECT kg_alocado INTO v_cache FROM public.necessidade_compra_fio WHERE id = 930000904;
  IF v_cache <> 0.000 THEN
    RAISE EXCEPTION 'PROOF FAILED AF(16): the need cache still carries % kg', v_cache;
  END IF;
  RAISE NOTICE 'ok AF: draft deletion merged 300,000 back into the live row (500,000 kg total)';
END $$;

-- =====================================================================
-- AG. Zero orphans after every deletion in this suite (proof 18)
-- =====================================================================
\echo '--- AG. deleted orders leave zero orphans'
DO $$
DECLARE v_n BIGINT;
BEGIN
  -- No planning row points at a Purchase Order that no longer exists.
  SELECT count(*) INTO v_n FROM public.necessidade_compra_planejamento p
   WHERE p.ordem_compra_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.ordem_compra o WHERE o.id = p.ordem_compra_id);
  IF v_n <> 0 THEN RAISE EXCEPTION 'PROOF FAILED AG: % orphan planning row(s)', v_n; END IF;

  -- No planning row points at an allocation that no longer exists.
  SELECT count(*) INTO v_n FROM public.necessidade_compra_planejamento p
   WHERE p.alocacao_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.ordem_compra_item_alocacao a WHERE a.id = p.alocacao_id);
  IF v_n <> 0 THEN RAISE EXCEPTION 'PROOF FAILED AG: % orphan allocation link(s)', v_n; END IF;

  -- No half-linked planning row survived either branch.
  SELECT count(*) INTO v_n FROM public.necessidade_compra_planejamento
   WHERE (gerado_em IS NULL AND (alocacao_id IS NOT NULL OR ordem_compra_id IS NOT NULL))
      OR (gerado_em IS NOT NULL AND (alocacao_id IS NULL OR ordem_compra_id IS NULL));
  IF v_n <> 0 THEN RAISE EXCEPTION 'PROOF FAILED AG: % half-linked planning row(s)', v_n; END IF;

  -- No item, allocation or event survives its deleted order.
  SELECT count(*) INTO v_n FROM public.ordem_compra_item i
   WHERE NOT EXISTS (SELECT 1 FROM public.ordem_compra o WHERE o.id = i.ordem_id);
  IF v_n <> 0 THEN RAISE EXCEPTION 'PROOF FAILED AG: % orphan item(s)', v_n; END IF;
  SELECT count(*) INTO v_n FROM public.ordem_compra_item_alocacao a
   WHERE NOT EXISTS (SELECT 1 FROM public.ordem_compra_item i WHERE i.id = a.item_id);
  IF v_n <> 0 THEN RAISE EXCEPTION 'PROOF FAILED AG: % orphan allocation(s)', v_n; END IF;
  SELECT count(*) INTO v_n FROM public.ordem_compra_eventos e
   WHERE NOT EXISTS (SELECT 1 FROM public.ordem_compra o WHERE o.id = e.ordem_compra_id);
  IF v_n <> 0 THEN RAISE EXCEPTION 'PROOF FAILED AG: % orphan event(s)', v_n; END IF;

  -- Every need cache agrees with the canonical coverage definition, restated
  -- here independently of db/100's own helper.
  SELECT count(*) INTO v_n FROM public.necessidade_compra_fio n
   WHERE n.kg_alocado IS DISTINCT FROM (
     SELECT coalesce(sum(a.kg_alocado), 0)::NUMERIC(12,3)
       FROM public.ordem_compra_item_alocacao a
       JOIN public.ordem_compra_item i ON i.id = a.item_id
       JOIN public.ordem_compra o ON o.id = i.ordem_id
      WHERE a.necessidade_id = n.id AND o.status_administrativo <> 'cancelada');
  IF v_n <> 0 THEN RAISE EXCEPTION 'PROOF FAILED AG: % need cache(s) diverge from active coverage', v_n; END IF;

  -- No need is over its cap under the active definition.
  SELECT count(*) INTO v_n FROM public.necessidade_compra_fio n
   WHERE (SELECT coalesce(sum(p.kg_planejado), 0)::NUMERIC(12,3)
            FROM public.necessidade_compra_planejamento p
            LEFT JOIN public.ordem_compra o ON o.id = p.ordem_compra_id
           WHERE p.necessidade_id = n.id
             AND (p.ordem_compra_id IS NULL OR o.status_administrativo <> 'cancelada'))
         > n.kg_necessario;
  IF v_n <> 0 THEN RAISE EXCEPTION 'PROOF FAILED AG: % need(s) over the active cap', v_n; END IF;

  RAISE NOTICE 'ok AG: zero orphans, zero cache drift, zero cap violations';
END $$;

-- =====================================================================
-- AH. The receipt action obeys the cutover (proofs 19, 20)
-- =====================================================================
\echo '--- AH. acoes.receber follows ordem_compra_cutover'

-- The cutover table is unreadable to every client role by design (db/71/db/75
-- revoke it outright), so the FIXTURE state is asserted as the cluster owner
-- and only the PROJECTION is read as the administrator. That split is the
-- point: the screen may never reconstruct this state for itself.
RESET ROLE;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.ordem_compra_cutover
                  WHERE id = 1 AND status = 'legacy_active' AND read_authority = 'flat') THEN
    RAISE EXCEPTION 'PROOF FAILED AH(19): the fixture is not in legacy_active/flat';
  END IF;
END $$;
SET ROLE authenticated;

DO $$
DECLARE v_r JSONB; v_plan BIGINT; v_seq INTEGER; v_oc BIGINT; v_hist JSONB;
BEGIN
  v_r := public.substituir_planejamento_compra_necessidade(930000905,
    '[{"fornecedor_id":930000308,"kg":80.000}]'::jsonb, 'db100-ah-plan');
  IF (v_r->>'ok')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'PROOF FAILED AH: planning refused: %', v_r;
  END IF;
  SELECT id INTO v_plan FROM public.necessidade_compra_planejamento
   WHERE necessidade_id = 930000905 AND gerado_em IS NULL;
  SELECT coalesce(max(ultimo_seq),0)+1 INTO v_seq FROM public.pedido_identidade_numeros
   WHERE pedido_id = '9d1f0000-0000-4000-8000-00000000ed01' AND escopo = 'OC';
  v_r := public.gerar_ordem_compra_do_planejamento(
    ARRAY[v_plan]::bigint[], 'PC100-AH', v_seq, 'db100-ah-gen');
  IF (v_r->>'ok')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'PROOF FAILED AH: generation refused: %', v_r;
  END IF;
  v_oc := (v_r->>'ordem_compra_id')::BIGINT;
  v_r := public.emitir_ordem_compra(v_oc);
  IF (v_r->>'ok')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'PROOF FAILED AH: emission refused: %', v_r;
  END IF;

  -- ---- proof 19: inactive cutover -> receber=false + stable blocker ----
  v_hist := public.obter_historico_recebimento_ordem_compra(v_oc);
  IF (v_hist->>'ok')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'PROOF FAILED AH(19): the receipt read model refused: %', v_hist;
  END IF;
  IF (v_hist->'acoes'->>'receber')::boolean IS NOT FALSE THEN
    RAISE EXCEPTION 'PROOF FAILED AH(19): acoes.receber is true while the cutover is inactive';
  END IF;
  IF v_hist->>'bloqueio_recebimento' <> 'recebimento_canonico_inativo' THEN
    RAISE EXCEPTION 'PROOF FAILED AH(19): missing/incorrect blocker: %', v_hist->>'bloqueio_recebimento';
  END IF;
  RAISE NOTICE 'ok AH(19): inactive cutover exposes no actionable receipt';
END $$;

-- Disposable canonical-active fixture. Planted directly because the real
-- activation path is a separately authorized cutover operation that this
-- order explicitly must not perform. It is reverted immediately below, so the
-- cluster ends where production is: legacy_active / flat.
RESET ROLE;
UPDATE public.ordem_compra_cutover
   SET read_authority = 'canonical',
       reconciliation_status = 'reconciled',
       final_acl_closed_at = now(),
       canonical_activated_at = now(),
       status = 'canonical_active'
 WHERE id = 1;
SET ROLE authenticated;

DO $$
DECLARE v_oc BIGINT; v_hist JSONB;
BEGIN
  SELECT id INTO v_oc FROM public.ordem_compra WHERE codigo = 'PC100-AH';
  v_hist := public.obter_historico_recebimento_ordem_compra(v_oc);
  IF (v_hist->>'ok')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'PROOF FAILED AH(20): the receipt read model refused: %', v_hist;
  END IF;
  IF (v_hist->>'recebimento_canonico_ativo')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'PROOF FAILED AH(20): the canonical flag did not follow the cutover';
  END IF;
  IF (v_hist->'acoes'->>'receber')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'PROOF FAILED AH(20): acoes.receber is false under canonical_active';
  END IF;
  IF v_hist->>'bloqueio_recebimento' IS NOT NULL THEN
    RAISE EXCEPTION 'PROOF FAILED AH(20): a blocker survived activation: %', v_hist->>'bloqueio_recebimento';
  END IF;
  RAISE NOTICE 'ok AH(20): canonical_active exposes the receipt action';
END $$;

RESET ROLE;
UPDATE public.ordem_compra_cutover
   SET status = 'legacy_active',
       read_authority = 'flat',
       reconciliation_status = 'not_started',
       final_acl_closed_at = NULL,
       canonical_activated_at = NULL
 WHERE id = 1;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.ordem_compra_cutover
                  WHERE id = 1 AND status = 'legacy_active' AND read_authority = 'flat') THEN
    RAISE EXCEPTION 'PROOF FAILED AH: the disposable fixture did not return to legacy_active/flat';
  END IF;
  RAISE NOTICE 'ok AH: cutover restored to legacy_active/flat';
END $$;
SET ROLE authenticated;

-- =====================================================================
-- AI. ACL and direct-DML posture (proof 21)
-- =====================================================================
\echo '--- AI. no ACL regression and no direct client DML'
RESET ROLE;
DO $$
DECLARE v_f TEXT; v_bad TEXT;
BEGIN
  -- Internal helpers stay owner-only.
  SELECT string_agg(f, ', ') INTO v_bad FROM (
    SELECT f FROM (VALUES
      ('public.oc_cobertura_ativa(bigint)'),
      ('public.necessidade_kg_planejado_ativo(bigint)'),
      ('public.necessidade_kg_planejado_ativo_gerado(bigint)'),
      ('public.necessidade_kg_alocado_ativo(bigint)'),
      ('public.oc_recalcular_cache_necessidade(bigint)'),
      ('public.oc_elegivel_cancelamento(bigint)'),
      ('public.oc_elegivel_exclusao(bigint)'),
      ('public.trg_alocacao_kg_alocado_cache()'),
      ('public.trg_planejamento_saldo_guard()')
    ) AS t(f)
    WHERE has_function_privilege('authenticated', to_regprocedure(f), 'EXECUTE')
       OR has_function_privilege('anon', to_regprocedure(f), 'EXECUTE')
       OR has_function_privilege('service_role', to_regprocedure(f), 'EXECUTE')
  ) s;
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'PROOF FAILED AI: internal helper reachable by a client role: %', v_bad;
  END IF;

  -- Public RPCs reachable by `authenticated` and by nobody else.
  FOREACH v_f IN ARRAY ARRAY[
    'public.cancelar_ordem_compra(bigint)',
    'public.excluir_ordem_compra(bigint)',
    'public.obter_ordem_compra_admin(bigint)',
    'public.obter_historico_recebimento_ordem_compra(bigint)',
    'public.obter_planejamento_compra_pedido(uuid)',
    'public.definir_planejamento_compra(bigint,bigint,numeric,text)',
    'public.substituir_planejamento_compra_necessidade(bigint,jsonb,text)',
    'public.aplicar_planejamento_rapido(uuid,bigint,jsonb,text)',
    'public.gerar_ordem_compra_do_planejamento(bigint[],text,integer,text)'
  ] LOOP
    IF NOT has_function_privilege('authenticated', to_regprocedure(v_f), 'EXECUTE') THEN
      RAISE EXCEPTION 'PROOF FAILED AI: % is not executable by authenticated', v_f;
    END IF;
    IF has_function_privilege('anon', to_regprocedure(v_f), 'EXECUTE')
       OR has_function_privilege('service_role', to_regprocedure(v_f), 'EXECUTE') THEN
      RAISE EXCEPTION 'PROOF FAILED AI: % is reachable by an unintended role', v_f;
    END IF;
  END LOOP;

  -- No direct client DML anywhere in the lifecycle surface.
  FOREACH v_f IN ARRAY ARRAY[
    'public.ordem_compra', 'public.ordem_compra_item',
    'public.ordem_compra_item_alocacao', 'public.necessidade_compra_planejamento',
    'public.necessidade_compra_fio', 'public.ordem_compra_eventos'
  ] LOOP
    IF has_table_privilege('authenticated', v_f, 'INSERT')
       OR has_table_privilege('authenticated', v_f, 'UPDATE')
       OR has_table_privilege('authenticated', v_f, 'DELETE') THEN
      RAISE EXCEPTION 'PROOF FAILED AI: authenticated holds direct DML on %', v_f;
    END IF;
    IF has_table_privilege('anon', v_f, 'SELECT') THEN
      RAISE EXCEPTION 'PROOF FAILED AI: anon can read %', v_f;
    END IF;
  END LOOP;

  RAISE NOTICE 'ok AI: ACL posture unchanged and no direct client DML';
END $$;

\echo ''
\echo 'DB100_LIFECYCLE_INTEGRATION_PASS'
