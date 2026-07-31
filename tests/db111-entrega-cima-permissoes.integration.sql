-- tests/db111-entrega-cima-permissoes.integration.sql
--
-- db/111 (TD3) — the permission matrix of the server-owned delivery
-- command, measured at RUNTIME under SET LOCAL ROLE rather than inferred
-- from the catalogue, plus the direct-mutation posture of the command
-- store.

\set ON_ERROR_STOP on

SET session_replication_role = replica;
INSERT INTO public.fornecedores (id, nome, tipo)
VALUES (940000403, 'P1-FORN-TECELAGEM', 'tecelagem'),
       (940000404, 'P1-FORN-LATEX', 'latex')
  ON CONFLICT (id) DO NOTHING;

INSERT INTO public.ops (id, numero, ano, lote_id, status, tipo) VALUES
  (940111006, 941106, 2099, 940000701, 'aberta', 'tecelagem')
  ON CONFLICT (id) DO NOTHING;

INSERT INTO public.op_itens (id, op_id, modelo_id, metros_pedidos) VALUES
  (940111107, 940111006, 940000301, 100.00)
  ON CONFLICT (id) DO NOTHING;
-- The finishing writer takes its OP number from a ROW in op_numeros, so a
-- rolled-back creation attempt reverts that counter while committed OPs
-- keep their numbers. Earlier finishing suites in this same disposable
-- cluster can therefore leave the ('latex', <year>) high-water mark BEHIND
-- the real maximum, and the next allocation would collide with
-- ops_identidade_operacional_uidx. Reconcile it here (db/27's own
-- high-water idiom) so this suite measures the writer, not the numbering
-- residue of a previous suite.
INSERT INTO public.op_numeros (tipo, ano, ultimo_numero)
SELECT 'latex', EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER, COALESCE(MAX(o.numero), 0)
  FROM public.ops o
 WHERE o.tipo = 'latex' AND o.ano = EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER
ON CONFLICT (tipo, ano) DO UPDATE
   SET ultimo_numero = GREATEST(public.op_numeros.ultimo_numero, EXCLUDED.ultimo_numero);

-- The canonical OP identity OP-{T|A}{pedido}-{seq}-{yy} draws its seq from
-- public.pedido_identidade_numeros through proximo_seq_identidade, which is a
-- ROW counter with exactly the same revert-on-rollback behaviour. db/95 ships
-- a post-invariant asserting this high-water mark is never behind
-- MAX(identidade_seq), so reconciling it is the sanctioned repair shape.
INSERT INTO public.pedido_identidade_numeros (pedido_id, escopo, ultimo_seq)
SELECT o.identidade_pedido_id, o.identidade_tipo_letra, MAX(o.identidade_seq)
  FROM public.ops o
 WHERE o.identidade_seq IS NOT NULL
   AND o.identidade_pedido_id IS NOT NULL
 GROUP BY 1, 2
ON CONFLICT (pedido_id, escopo) DO UPDATE
   SET ultimo_seq = GREATEST(public.pedido_identidade_numeros.ultimo_seq, EXCLUDED.ultimo_seq);

SET session_replication_role = origin;

-- =====================================================================
-- A. CATALOGUE POSTURE
-- =====================================================================
DO $t$
DECLARE
  v_sig CONSTANT TEXT :=
    'public.registrar_entrega_cima_com_acabamento(bigint,bigint,date,text,bigint,jsonb,text,text)';
  v_n INTEGER;
BEGIN
  IF NOT has_function_privilege('authenticated', v_sig, 'EXECUTE') THEN
    RAISE EXCEPTION 'not ok - A1: authenticated must reach the public writer';
  END IF;
  IF has_function_privilege('anon', v_sig, 'EXECUTE')
     OR has_function_privilege('service_role', v_sig, 'EXECUTE') THEN
    RAISE EXCEPTION 'not ok - A2: anon or service_role reaches the public writer';
  END IF;

  -- Exactly ONE overload: no alternative entry point may exist.
  SELECT count(*) INTO v_n FROM pg_proc p
   WHERE p.pronamespace = 'public'::regnamespace
     AND p.proname = 'registrar_entrega_cima_com_acabamento';
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'not ok - A3: expected exactly one overload, found %', v_n;
  END IF;

  -- The command store: SELECT for authenticated only, never mutation.
  IF NOT has_table_privilege('authenticated', 'public.entrega_cima_comandos', 'SELECT') THEN
    RAISE EXCEPTION 'not ok - A4: authenticated must be able to read the command store';
  END IF;
  IF has_table_privilege('authenticated', 'public.entrega_cima_comandos', 'INSERT')
     OR has_table_privilege('authenticated', 'public.entrega_cima_comandos', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.entrega_cima_comandos', 'DELETE') THEN
    RAISE EXCEPTION 'not ok - A5: authenticated holds a direct mutation privilege on the command store';
  END IF;
  IF has_table_privilege('anon', 'public.entrega_cima_comandos', 'SELECT')
     OR has_table_privilege('service_role', 'public.entrega_cima_comandos', 'SELECT') THEN
    RAISE EXCEPTION 'not ok - A6: anon or service_role can read the command store';
  END IF;

  RAISE NOTICE 'ok - A: the catalogue posture of the writer and its command store is exact';
END
$t$;

-- =====================================================================
-- B. RUNTIME REFUSALS, under real roles
-- =====================================================================
DO $t$
DECLARE v_denied BOOLEAN := FALSE;
BEGIN
  -- anon holds no EXECUTE at all.
  SET LOCAL ROLE anon;
  BEGIN
    PERFORM public.registrar_entrega_cima_com_acabamento(
      940000403, 940111006, CURRENT_DATE, NULL, 940000404,
      '[{"op_item_id":940111107,"metros_entregues":5.00,"defeito":false,"observacao":null}]'::jsonb,
      'db111-perm-anon');
  EXCEPTION WHEN insufficient_privilege THEN
    v_denied := TRUE;
  END;
  RESET ROLE;
  IF NOT v_denied THEN
    RAISE EXCEPTION 'not ok - B1: anon executed the delivery command';
  END IF;
  RAISE NOTICE 'ok - B1: anon is refused permission on the delivery command';
END
$t$;

DO $t$
DECLARE v_denied BOOLEAN := FALSE;
BEGIN
  -- An authenticated NON-admin reaches the function but fails its
  -- explicit authorization check.
  PERFORM set_config('request.jwt.claim.sub', '9d1f0000-0000-4000-8000-00000000ad03', true);
  SET LOCAL ROLE authenticated;
  BEGIN
    PERFORM public.registrar_entrega_cima_com_acabamento(
      940000403, 940111006, CURRENT_DATE, NULL, 940000404,
      '[{"op_item_id":940111107,"metros_entregues":5.00,"defeito":false,"observacao":null}]'::jsonb,
      'db111-perm-nonadmin');
  EXCEPTION WHEN insufficient_privilege THEN
    v_denied := TRUE;
  END;
  RESET ROLE;
  IF NOT v_denied THEN
    RAISE EXCEPTION 'not ok - B2: an authenticated NON-admin registered a delivery';
  END IF;
  RAISE NOTICE 'ok - B2: an authenticated NON-admin is refused by the explicit authorization check';
END
$t$;

DO $t$
DECLARE
  v_res JSONB;
  v_n   INTEGER;
BEGIN
  -- Nothing was written by either refusal.
  SELECT count(*) INTO v_n FROM public.entrega_cima_comandos
   WHERE idempotency_key IN ('db111-perm-anon', 'db111-perm-nonadmin');
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'not ok - B3: a refused caller wrote a command row (n=%)', v_n;
  END IF;

  -- An authenticated ADMIN succeeds through the same role.
  PERFORM set_config('request.jwt.claim.sub', '9d1f0000-0000-4000-8000-00000000ad01', true);
  SET LOCAL ROLE authenticated;
  v_res := public.registrar_entrega_cima_com_acabamento(
    940000403, 940111006, CURRENT_DATE, 'P1 db111 admin', 940000404,
    '[{"op_item_id":940111107,"metros_entregues":7.25,"defeito":false,"observacao":null}]'::jsonb,
    'db111-perm-admin');
  RESET ROLE;

  IF NOT COALESCE((v_res ->> 'ok')::BOOLEAN, FALSE)
     OR NOT COALESCE((v_res -> 'acabamento' ->> 'ok')::BOOLEAN, FALSE) THEN
    RAISE EXCEPTION 'not ok - B4: an authenticated ADMIN could not register the delivery (%)', v_res;
  END IF;
  RAISE NOTICE 'ok - B4: an authenticated ADMIN registers the delivery and its finishing OP';
END
$t$;

-- =====================================================================
-- C. THE COMMAND STORE CANNOT BE MUTATED BY A CLIENT ROLE
-- =====================================================================
DO $t$
DECLARE v_denied BOOLEAN := FALSE;
BEGIN
  PERFORM set_config('request.jwt.claim.sub', '9d1f0000-0000-4000-8000-00000000ad01', true);
  SET LOCAL ROLE authenticated;
  BEGIN
    INSERT INTO public.entrega_cima_comandos
      (idempotency_namespace, ator_id, idempotency_key, entrega_id,
       comando_payload, comando_hash, resultado)
    VALUES ('entrega_cima_v1', '9d1f0000-0000-4000-8000-00000000ad01',
            'db111-forged', 1, '{}'::jsonb,
            '00000000000000000000000000000000', '{}'::jsonb);
  EXCEPTION WHEN insufficient_privilege THEN
    v_denied := TRUE;
  END;
  RESET ROLE;
  IF NOT v_denied THEN
    RAISE EXCEPTION 'not ok - C1: an authenticated admin forged a command row directly';
  END IF;
  RAISE NOTICE 'ok - C1: no client role can INSERT into the command store';
END
$t$;

DO $t$
DECLARE v_denied BOOLEAN := FALSE;
BEGIN
  PERFORM set_config('request.jwt.claim.sub', '9d1f0000-0000-4000-8000-00000000ad01', true);
  SET LOCAL ROLE authenticated;
  BEGIN
    DELETE FROM public.entrega_cima_comandos WHERE idempotency_key = 'db111-perm-admin';
  EXCEPTION WHEN insufficient_privilege THEN
    v_denied := TRUE;
  END;
  RESET ROLE;
  IF NOT v_denied THEN
    RAISE EXCEPTION 'not ok - C2: an authenticated admin deleted a command row directly';
  END IF;
  RAISE NOTICE 'ok - C2: no client role can DELETE from the command store';
END
$t$;

-- =====================================================================
-- D. db/108 REGRESSION — the composed writers and the wrapper ACL are
--    exactly what db/108 declared. db/111 replaces none of them.
-- =====================================================================
DO $t$
DECLARE
  v_n   INTEGER;
  v_acl TEXT;
BEGIN
  SELECT count(*) INTO v_n FROM pg_proc p
   WHERE p.pronamespace = 'public'::regnamespace
     AND p.proname IN ('_op_acabamento_criar', 'gerar_op_acabamento',
                       'pode_recuperar_op_acabamento', 'gerar_op_latex_split');
  IF v_n <> 4 THEN
    RAISE EXCEPTION 'not ok - D1: a db/108 finishing object is missing (n=%)', v_n;
  END IF;

  -- The owner-only inner unit stays unreachable by every client role.
  IF has_function_privilege('authenticated', 'public._op_acabamento_criar(bigint,smallint,text)', 'EXECUTE')
     OR has_function_privilege('anon', 'public._op_acabamento_criar(bigint,smallint,text)', 'EXECUTE')
     OR has_function_privilege('service_role', 'public._op_acabamento_criar(bigint,smallint,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'not ok - D2: db/111 widened the inner creation unit';
  END IF;

  -- The 9.9.J compatibility wrapper keeps its full pre-P1 ACL.
  SELECT coalesce(p.proacl::TEXT, '<absent-or-default>') INTO v_acl
    FROM pg_proc p
   WHERE p.pronamespace = 'public'::regnamespace
     AND p.proname = 'gerar_op_latex_split'
     AND pg_get_function_identity_arguments(p.oid) = 'p_entrega_id bigint, p_motivo text';
  IF v_acl IS NULL THEN
    RAISE EXCEPTION 'not ok - D3: the compatibility wrapper disappeared';
  END IF;
  IF NOT (has_function_privilege('anon', 'public.gerar_op_latex_split(bigint,text)', 'EXECUTE')
          AND has_function_privilege('authenticated', 'public.gerar_op_latex_split(bigint,text)', 'EXECUTE')
          AND has_function_privilege('service_role', 'public.gerar_op_latex_split(bigint,text)', 'EXECUTE')) THEN
    RAISE EXCEPTION 'not ok - D4: the wrapper ACL narrowed under db/111 (%)', v_acl;
  END IF;

  -- The accepted Manta weaving writer is untouched.
  IF NOT EXISTS (SELECT 1 FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace
                   AND p.proname = 'registrar_entrega_cima_manta') THEN
    RAISE EXCEPTION 'not ok - D5: the accepted Manta weaving writer disappeared';
  END IF;

  RAISE NOTICE 'ok - D: db/108 is composed, not replaced, and the wrapper ACL is unchanged';
END
$t$;

SELECT 'DB111_PERMISSOES_PASS' AS marker;
