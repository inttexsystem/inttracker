-- tests/db103-aceite.integration.sql
--
-- db/103 (9.9.E) — supplier queue and acceptance, ADDITIVE ONLY.
--
-- Also proves NEGATIVELY that the P4 work is absent: emitir_ordem_compra
-- is unchanged, the ordem_compra_config demotion trigger is not
-- installed, and no live Purchase Order was reclassified.

\set ON_ERROR_STOP on

-- A supplier user bound to the fixture's cotton supplier, plus a second
-- supplier used as the negative actor.
SET session_replication_role = replica;
INSERT INTO auth.users(id, email) VALUES
  ('94f10000-0000-4000-8000-0000000000f1', 'p1-forn-a@example.invalid'),
  ('94f10000-0000-4000-8000-0000000000f2', 'p1-forn-b@example.invalid')
  ON CONFLICT (id) DO NOTHING;
INSERT INTO public.usuarios(id, email, nome, tipo, fornecedor_id, ativo, nivel_acesso) VALUES
  ('94f10000-0000-4000-8000-0000000000f1', 'p1-forn-a@example.invalid', 'P1 Forn A', 'fornecedor', 940000401, TRUE, 'completo'),
  ('94f10000-0000-4000-8000-0000000000f2', 'p1-forn-b@example.invalid', 'P1 Forn B', 'fornecedor', 940000402, TRUE, 'completo')
  ON CONFLICT (id) DO NOTHING;
SET session_replication_role = origin;

DO $t$
DECLARE
  v_fa   CONSTANT UUID := '94f10000-0000-4000-8000-0000000000f1';
  v_fb   CONSTANT UUID := '94f10000-0000-4000-8000-0000000000f2';
  v_oc   CONSTANT BIGINT := 940000801;
  v_res  JSONB;
  v_n    INTEGER;
  v_cfg  BOOLEAN;
  v_denied BOOLEAN;
BEGIN
  -- =================================================================
  -- A. DETERMINISTIC SEED FROM THE GLOBAL CONFIGURATION (9.9.E.2)
  -- =================================================================
  SELECT exige_aceite INTO v_cfg FROM public.ordem_compra_config WHERE id = 1;
  SELECT count(*) INTO v_n FROM public.fornecedores WHERE exige_aceite IS DISTINCT FROM v_cfg;
  IF v_n > 0 THEN
    RAISE EXCEPTION 'not ok - A1: % supplier row(s) diverge from the seeded global value %', v_n, v_cfg;
  END IF;
  SELECT count(*) INTO v_n FROM public.fornecedores WHERE exige_aceite IS NULL;
  IF v_n > 0 THEN
    RAISE EXCEPTION 'not ok - A2: NOT NULL DEFAULT false must make a NULL impossible';
  END IF;
  RAISE NOTICE 'ok - A: every supplier carries the deterministically seeded value %', v_cfg;

  -- =================================================================
  -- B. THE WRONG SUPPLIER IS REFUSED
  -- =================================================================
  PERFORM set_config('request.jwt.claim.sub', v_fb::TEXT, true);
  v_denied := FALSE;
  BEGIN
    v_res := public.aceitar_ordem_compra(v_oc, 'k-wrong-supplier');
  EXCEPTION WHEN insufficient_privilege THEN
    v_denied := TRUE;
  END;
  IF NOT v_denied THEN
    RAISE EXCEPTION 'not ok - B: a supplier accepted another supplier''s order';
  END IF;
  RAISE NOTICE 'ok - B: a supplier cannot decide another supplier''s order';

  -- =================================================================
  -- C. THE SUPPLIER QUEUE SHOWS ONLY THE CALLER'S OWN ORDERS
  -- =================================================================
  PERFORM set_config('request.jwt.claim.sub', v_fb::TEXT, true);
  SELECT count(*) INTO v_n FROM public.listar_fila_aceite_fornecedor();
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'not ok - C1: the wrong supplier sees % queued order(s)', v_n;
  END IF;

  PERFORM set_config('request.jwt.claim.sub', v_fa::TEXT, true);
  SELECT count(*) INTO v_n FROM public.listar_fila_aceite_fornecedor()
   WHERE ordem_compra_id = v_oc;
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'not ok - C2: the owning supplier does not see its pending order';
  END IF;
  RAISE NOTICE 'ok - C: the queue is scoped to the calling supplier';

  -- =================================================================
  -- D. REJECTION REQUIRES A MOTIVE
  -- =================================================================
  v_res := public.rejeitar_ordem_compra(v_oc, 'k-reject-no-motive', NULL);
  IF v_res ->> 'codigo' <> 'ACEITE_MOTIVO_OBRIGATORIO' THEN
    RAISE EXCEPTION 'not ok - D: a motiveless rejection was accepted (%)', v_res;
  END IF;
  RAISE NOTICE 'ok - D: rejection without a motive is refused';

  -- =================================================================
  -- E. ACCEPTANCE APPLIES AND IS RECORDED
  -- =================================================================
  v_res := public.aceitar_ordem_compra(v_oc, 'k-accept-1');
  IF NOT COALESCE((v_res ->> 'ok')::BOOLEAN, FALSE) THEN
    RAISE EXCEPTION 'not ok - E1: acceptance was refused (%)', v_res;
  END IF;
  IF (SELECT status_aceite FROM public.ordem_compra WHERE id = v_oc) <> 'aceita' THEN
    RAISE EXCEPTION 'not ok - E2: status_aceite was not applied';
  END IF;
  IF (SELECT aceite_decidida_por FROM public.ordem_compra WHERE id = v_oc) <> v_fa THEN
    RAISE EXCEPTION 'not ok - E3: the deciding actor was not recorded';
  END IF;
  SELECT count(*) INTO v_n FROM public.ordem_compra_eventos
   WHERE ordem_compra_id = v_oc AND dimensao = 'aceite' AND tipo_evento = 'aceite_registrado';
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'not ok - E4: the acceptance event was not recorded once';
  END IF;
  RAISE NOTICE 'ok - E: acceptance applies, records the actor and writes one aceite event';

  -- =================================================================
  -- F. IDEMPOTENCY — same key + identical payload replays
  -- =================================================================
  SELECT count(*) INTO v_n FROM public.ordem_compra_aceite_comandos;
  v_res := public.aceitar_ordem_compra(v_oc, 'k-accept-1');
  IF NOT COALESCE((v_res ->> 'ok')::BOOLEAN, FALSE) THEN
    RAISE EXCEPTION 'not ok - F1: the replay did not return the stored result (%)', v_res;
  END IF;
  IF (SELECT count(*) FROM public.ordem_compra_aceite_comandos) <> v_n THEN
    RAISE EXCEPTION 'not ok - F2: the replay wrote a second command row';
  END IF;
  SELECT count(*) INTO v_n FROM public.ordem_compra_eventos
   WHERE ordem_compra_id = v_oc AND dimensao = 'aceite';
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'not ok - F3: the replay duplicated the acceptance event';
  END IF;
  RAISE NOTICE 'ok - F: a replayed command returns the stored result and writes nothing';

  -- =================================================================
  -- G. CONFLICTING REUSE OF THE SAME KEY IS REFUSED
  -- =================================================================
  v_res := public.rejeitar_ordem_compra(v_oc, 'k-accept-1', 'motivo diferente');
  IF v_res ->> 'codigo' <> 'comando_conflitante' THEN
    RAISE EXCEPTION 'not ok - G: a conflicting payload reused the same key (%)', v_res;
  END IF;
  RAISE NOTICE 'ok - G: the same key with a different payload is refused as comando_conflitante';

  -- =================================================================
  -- H. A DECIDED ORDER CANNOT BE DECIDED AGAIN
  -- =================================================================
  v_res := public.rejeitar_ordem_compra(v_oc, 'k-reject-late', 'tarde demais');
  IF v_res ->> 'codigo' <> 'ACEITE_JA_DECIDIDO' THEN
    RAISE EXCEPTION 'not ok - H: a decided order was decided again (%)', v_res;
  END IF;
  RAISE NOTICE 'ok - H: a decided order refuses a second decision with ACEITE_JA_DECIDIDO';

  -- =================================================================
  -- I. THE COMMAND STORE IS APPEND-ONLY
  -- =================================================================
  v_denied := FALSE;
  BEGIN
    UPDATE public.ordem_compra_aceite_comandos SET decisao = 'rejeitada' WHERE ordem_compra_id = v_oc;
  EXCEPTION WHEN OTHERS THEN
    v_denied := TRUE;
  END;
  IF NOT v_denied THEN
    RAISE EXCEPTION 'not ok - I: the acceptance command store is mutable';
  END IF;
  RAISE NOTICE 'ok - I: the acceptance command store is append-only';

  -- =================================================================
  -- J. THE P4 WORK IS ABSENT (the additivity contract)
  -- =================================================================
  IF EXISTS (
    SELECT 1 FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
     WHERE NOT t.tgisinternal AND c.relname = 'ordem_compra_config'
  ) THEN
    RAISE EXCEPTION 'not ok - J1: the ordem_compra_config demotion trigger belongs to P4';
  END IF;

  -- The global configuration is still freely updatable: P1 does not fence it.
  UPDATE public.ordem_compra_config SET exige_aceite = exige_aceite WHERE id = 1;

  IF EXISTS (
    SELECT 1 FROM pg_proc p
     WHERE p.pronamespace = 'public'::regnamespace
       AND p.proname = 'emitir_ordem_compra'
       AND p.prosrc ~ 'fornecedores'
  ) THEN
    RAISE EXCEPTION 'not ok - J2: emitir_ordem_compra reads the supplier column in P1';
  END IF;

  -- The two live corpus orders keep false / nao_aplicavel (F6).
  SELECT count(*) INTO v_n FROM public.ordem_compra
   WHERE legado = FALSE AND id <> 940000801
     AND (aceite_exigido_na_emissao IS DISTINCT FROM FALSE
          OR status_aceite <> 'nao_aplicavel');
  IF v_n > 0 THEN
    RAISE EXCEPTION 'not ok - J3: % pre-existing Purchase Order(s) were reclassified', v_n;
  END IF;
  RAISE NOTICE 'ok - J: no demotion trigger, emitir_ordem_compra unchanged, no order reclassified';
END
$t$;

SELECT 'DB103_ACEITE_PASS' AS marker;
