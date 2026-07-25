-- =====================================================================
-- db/90_pedido_proximo_numero_suggestion_rpc.sql
-- KLEBER-APP-OPERATIONAL-STABILIZATION — prefill of the next Pedido
-- number on the admin creation screen.
--
-- Schema shapes: docs/architecture/PEDIDO_OP_SCHEMA_CONTRACT.md.
-- Forward-only; db/01..db/89 are untouched. The migration terminal guard
-- advances 89 -> 90 in the same commit (tests/ordem-compra-c3d-deploy.smoke.js).
--
-- WHAT THIS MIGRATION OWNS
--   Exactly one read-only RPC:
--     public.consultar_proximo_numero_pedido() RETURNS BIGINT
--   It answers ONE question: "if the next Pedido were numbered
--   automatically right now, which number would it get?" — so the admin
--   creation form can OPEN with that number already visible and editable
--   instead of an empty `Automático` placeholder.
--
-- WHY THE IDENTITY SEQUENCE AND NOT MAX(numero)+1
--   `public.pedidos_numero_seq` is the ONLY authoritative source for the
--   next automatic number. MAX(numero)+1 is wrong on three real paths that
--   this system deliberately allows:
--     1. an explicit HIGH manual number advances the sequence (db/89
--        pedidos_numero_sequence_sync), so the sequence can already be far
--        ahead of any surviving row;
--     2. a rolled-back or compensated creation CONSUMES a sequence value
--        that no row will ever carry, so MAX(numero) lags permanently;
--     3. numbering gaps are ACCEPTED by design (db/89) — gapless numbering
--        is not attempted — and MAX(numero)+1 would silently try to refill
--        a gap the sequence has already moved past, colliding with nothing
--        today and with a real Pedido tomorrow.
--   Reading the sequence is therefore the only answer that matches what the
--   database would actually do on the next automatic INSERT.
--
-- WHY IT CANNOT CALL nextval
--   Merely OPENING the form must not consume a number. Every abandoned form
--   would otherwise burn a Pedido number. This function reads the sequence
--   STATE (pg_sequence_last_value + the catalog increment) and never calls
--   nextval, setval or currval, so it is observation-only: N calls leave the
--   sequence exactly where 0 calls would.
--
-- THE RESULT IS ADVISORY, NOT A RESERVATION
--   Nothing is locked and nothing is reserved. Between the suggestion and
--   the INSERT another Pedido may legitimately take the number. That race is
--   resolved where it has always been resolved: UNIQUE(pedidos.numero) is
--   the authority and returns 23505 to the loser. The caller must surface
--   that conflict and ask for a fresh suggestion — it must NEVER silently
--   allocate a different number behind the operator's back.
--
-- SECURITY
--   SECURITY DEFINER (the sequence state is not readable by the calling
--   role), SET search_path = public, gated on public.is_admin(), EXECUTE
--   revoked from PUBLIC and anon and granted only to authenticated. A
--   non-admin authenticated caller gets 42501, which PostgREST surfaces as
--   403 — the client-facing Pedido form must never learn this number.
--
-- No table, column, constraint, trigger, policy, existing function, grant or
-- Manta/OP/expedition behavior is changed. No data is read, written or
-- reinterpreted: this migration touches no row of any table.
--
-- Idempotente: pode rodar varias vezes sem efeito cumulativo e sem drift.
-- Depende de db/12 (public.is_admin) e db/89 (numbering controls).
-- Aplicar SOMENTE em ambiente local/descartavel. NAO aplicar em shared
-- development, staging ou producao sem ordem explicita.
-- =====================================================================

BEGIN;

-- ============================================================
-- 0. PRE-REQUISITE GATE.
--    Fail closed if the objects this RPC reasons about are absent.
--    No repair, no creation, no reinterpretation.
-- ============================================================
DO $gate$
BEGIN
  IF to_regprocedure('public.is_admin()') IS NULL THEN
    RAISE EXCEPTION 'db/90 gate: public.is_admin() ausente; aplique db/12 antes.';
  END IF;

  IF pg_get_serial_sequence('public.pedidos', 'numero') IS NULL THEN
    RAISE EXCEPTION 'db/90 gate: public.pedidos.numero nao possui sequencia de identidade; aplique db/13 antes.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conrelid = 'public.pedidos'::regclass
       AND conname  = 'pedidos_numero_positivo_chk'
  ) THEN
    RAISE EXCEPTION 'db/90 gate: pedidos_numero_positivo_chk ausente; aplique db/89 antes.';
  END IF;
END;
$gate$;

-- ============================================================
-- 1. public.consultar_proximo_numero_pedido()
--    Candidato ADVISORY para o proximo numero automatico de Pedido.
--    SOMENTE LEITURA de estado: nao chama nextval/setval/currval e
--    portanto NAO consome nem avanca a sequencia.
-- ============================================================
CREATE OR REPLACE FUNCTION public.consultar_proximo_numero_pedido()
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_seq   regclass;
  v_last  BIGINT;
  v_inc   BIGINT;
  v_start BIGINT;
BEGIN
  -- Gate administrativo. O numero do Pedido e interno: nenhuma superficie
  -- de cliente pode obte-lo, nem mesmo autenticada.
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'acesso negado: consultar_proximo_numero_pedido() exige admin'
      USING ERRCODE = '42501';
  END IF;

  v_seq := pg_get_serial_sequence('public.pedidos', 'numero')::regclass;
  IF v_seq IS NULL THEN
    RAISE EXCEPTION 'public.pedidos.numero nao possui sequencia de identidade'
      USING ERRCODE = '55000';
  END IF;

  -- pg_catalog.pg_sequence (e nao a view pg_sequences) porque a view filtra
  -- por privilegio do chamador; o catalogo devolve a definicao real.
  SELECT s.seqincrement, s.seqstart
    INTO v_inc, v_start
    FROM pg_catalog.pg_sequence s
   WHERE s.seqrelid = v_seq;

  -- Devolve NULL enquanto a sequencia nunca foi lida (is_called = false).
  -- Observacao pura: nao move a sequencia.
  v_last := pg_sequence_last_value(v_seq);

  IF v_last IS NULL THEN
    -- Sequencia virgem: o proximo nextval devolveria o start_value.
    RETURN v_start;
  END IF;

  -- Sequencia ja usada: o proximo nextval devolveria last_value + increment.
  RETURN v_last + v_inc;
END;
$$;

COMMENT ON FUNCTION public.consultar_proximo_numero_pedido() IS
  'db/90: candidato ADVISORY para o proximo numero automatico de Pedido, lido do estado de pedidos_numero_seq. NAO chama nextval/setval/currval e portanto nao consome nem avanca a sequencia. NAO usa MAX(numero)+1: a sequencia e a autoridade e lacunas sao aceitas por projeto (db/89). O valor nao e reserva: UNIQUE(pedidos.numero) continua sendo a autoridade final e o chamador deve tratar 23505 pedindo nova sugestao, nunca trocando o numero em silencio. Exige public.is_admin().';

REVOKE ALL     ON FUNCTION public.consultar_proximo_numero_pedido() FROM PUBLIC;
REVOKE ALL     ON FUNCTION public.consultar_proximo_numero_pedido() FROM anon;
GRANT  EXECUTE ON FUNCTION public.consultar_proximo_numero_pedido() TO   authenticated;

-- ============================================================
-- 2. Reload PostgREST
-- ============================================================
NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';

COMMIT;
