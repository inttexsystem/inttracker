-- =====================================================================
-- db/86_manta_expedition_release_writer.sql
-- PHASE-MANTA-B2A — authoritative Manta expedition balance and release writers.
--
-- Governing contract: docs/architecture/MANTA_DIRECT_ROUTE_ACTIVATION_CONTRACT.md
-- §4 (B2-2), §8 (B2-6) and §9 (B2-7); command-table canon
-- docs/architecture/PEDIDO_OP_SCHEMA_CONTRACT.md §13.2 and its 2026-07-24 db/86
-- table. Forward-only; db/01..db/85 are untouched. The migration terminal guard
-- advances 85 -> 86 in the same commit (tests/ordem-compra-c3d-deploy.smoke.js).
--
-- OBJECTIVE. Make the Manta direct route releasable: an exact per-op_item balance
-- read and a partial/additive release writer with deterministic idempotency, on
-- the dormant db/81-84 `expedicoes.op_tecelagem_id` source.
--
-- BALANCE AUTHORITY (never the plan, never modelo_id).
--   recebido(op_item)  = SUM(entrega_itens.metros_entregues)
--                        over entregas.etapa='cima'
--                        with entrega_itens.op_id = <source OP>
--                        and  entrega_itens.op_item_id = <that exact op_item>
--                        and  COALESCE(defeito, FALSE) = FALSE
--   liberado(op_item)  = SUM(expedicao_itens.metros_liberados)
--                        over the ONE expedition whose op_tecelagem_id = source OP
--   disponivel         = ROUND(GREATEST(recebido - liberado, 0), 2)
-- Unlike the Latex path (db/32), the join is op_item_id-EXACT and never falls
-- back to modelo_id, because Manta `cima` items are written against the weaving
-- OP's own items (db/85). COALESCE(metros_ajustados, metros_pedidos) is returned
-- as `previsto` for display only and is NEVER an authority.
--
-- ---------------------------------------------------------------------
-- LOCK ORDER (continues the db/85 reconciliation; nothing is taken in reverse).
-- ---------------------------------------------------------------------
--   0. pg_advisory_xact_lock('manta_release_v1|<actor>|<key>') -- FIRST, before
--      ANY table row lock, and only when an idempotency key is supplied. Because
--      no path acquires a row lock before this advisory lock, and this function
--      never acquires the advisory lock after a row lock, advisory-vs-row cycles
--      are structurally impossible. It also guarantees the order's requirement
--      that "a unique-key loser must not retain mutations performed before
--      discovering the replay row": the loser blocks here, BEFORE doing any work,
--      and on wake-up observes the winner's committed command row and replays.
--   1. source public.ops row                              FOR UPDATE
--   2. source public.lotes FOR SHARE, source public.pedidos FOR SHARE (db/84)
--   3. affected public.entrega_itens rows, ascending id   FOR UPDATE
--   4. public.expedicoes row for the source OP            FOR UPDATE
--   5. public.expedicao_itens rows, ascending id          FOR UPDATE
--
-- Step 3 is what db/85's rule R-I made safe and is what serializes RELEASE vs.
-- OUTPUT CORRECTION in both directions:
--   * db/85 guarantees no `entrega_itens` row holder ever requests an `ops` row,
--     so a correction (UPDATE of metros_entregues/defeito, or a DELETE) holds
--     only its own target row and requests nothing -- no cycle can form with a
--     release that holds `ops` and requests those rows;
--   * if the correction commits first, the release blocks on its row lock and
--     then recomputes `recebido` from the corrected committed value;
--   * if the release commits first, the correction blocks on the release's row
--     lock and db/81's entrega_itens_manta_consumo_guard -- evaluating under a
--     fresh READ COMMITTED command snapshot after the wait -- observes
--     metros_liberados > 0 and refuses the correction.
-- Step 4/5 preserve the db/81 §4 order (ops -> expedicoes -> expedicao_itens);
-- the db/84 expedicoes INSERT guard re-enters locks already held at steps 1-2.
-- `public.modelos` FOR SHARE is only ever taken as a LEAF (db/80, db/84), so its
-- position relative to steps 3-5 cannot participate in a cycle.
--
-- ---------------------------------------------------------------------
-- Forward-only. Idempotent: CREATE TABLE/INDEX/CONSTRAINT IF NOT EXISTS,
-- CREATE OR REPLACE FUNCTION, DROP+CREATE TRIGGER, REVOKE+GRANT. No data or
-- destructive DDL, no business-data creation. No existing RPC signature, body or
-- grant is changed; no table grant is broadened; no RLS policy is altered; no
-- db/81-85 guard is relaxed; no `app.retificacao_autorizada` is granted to any
-- writer. gerar_op_latex, gerar_op_latex_split, liberar_expedicao,
-- liberar_expedicao_latex_parcial, consultar_saldo_expedicao_latex and
-- registrar_entrega_expedicao are untouched.
--
-- Depende de db/23, db/31, db/32, db/70 (canon), db/81, db/84, db/85. Aplicar
-- SOMENTE em ambiente local/descartavel. NAO aplicar em shared development,
-- staging ou producao sem ordem explicita.
-- =====================================================================

BEGIN;

-- ============================================================
-- 1. public.expedicao_comandos — the accepted §13.2 replay record.
--    Permanent retention; immutable after INSERT; NO FK to any mutable
--    expedition business row (successful reversal/cleanup must never destroy or
--    block command history); RLS enabled with no client DML path.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.expedicao_comandos (
  id                    BIGSERIAL PRIMARY KEY,
  idempotency_namespace TEXT NOT NULL
                          CHECK (idempotency_namespace IN ('manta_release_v1', 'manta_reversal_v1')),
  ator_id               UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  idempotency_key       TEXT NOT NULL
                          CHECK (length(btrim(idempotency_key)) BETWEEN 1 AND 200),
  comando_payload       JSONB NOT NULL CHECK (jsonb_typeof(comando_payload) = 'object'),
  comando_hash          TEXT NOT NULL CHECK (comando_hash ~ '^[0-9a-f]{32}$'),
  resultado             JSONB NOT NULL CHECK (jsonb_typeof(resultado) = 'object'),
  criado_em             TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT expedicao_comandos_idempotencia
    UNIQUE (idempotency_namespace, ator_id, idempotency_key)
);

COMMENT ON TABLE public.expedicao_comandos IS
  'db/86: registro imutavel de comandos de expedicao Manta (release/estorno), modelado byte a byte no canon PEDIDO_OP_SCHEMA_CONTRACT.md §13.2. Uma linha por identidade (namespace, ator, chave); igualdade de comando_payload (JSONB) decide replay x conflito, nunca o hash sozinho. Retencao permanente, sem FK para linhas de negocio de expedicao, sem caminho de DML de cliente.';
COMMENT ON COLUMN public.expedicao_comandos.comando_payload IS
  'Requisicao normalizada canonica. A igualdade JSONB (nao o hash) decide replay exato x reutilizacao conflitante da chave.';
COMMENT ON COLUMN public.expedicao_comandos.resultado IS
  'Objeto de retorno bem-sucedido exato, devolvido byte a byte em um replay.';

CREATE INDEX IF NOT EXISTS expedicao_comandos_ator_idx
  ON public.expedicao_comandos (ator_id, criado_em DESC, id DESC);

ALTER TABLE public.expedicao_comandos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.expedicao_comandos FROM PUBLIC;
REVOKE ALL ON TABLE public.expedicao_comandos FROM anon;
REVOKE ALL ON TABLE public.expedicao_comandos FROM authenticated;

-- Admin-only read policy. Combined with the revoked table grants above there is
-- no client DML path at all; the writers below are SECURITY DEFINER.
DROP POLICY IF EXISTS expedicao_comandos_admin_read ON public.expedicao_comandos;
CREATE POLICY expedicao_comandos_admin_read ON public.expedicao_comandos
  FOR SELECT
  USING (public.is_admin());

CREATE OR REPLACE FUNCTION public.expedicao_comandos_immutable_guard_fn()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION 'expedicao_comandos e imutavel: % nao e permitido.', TG_OP;
END;
$$;

REVOKE ALL ON FUNCTION public.expedicao_comandos_immutable_guard_fn() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.expedicao_comandos_immutable_guard_fn() FROM anon;
REVOKE ALL ON FUNCTION public.expedicao_comandos_immutable_guard_fn() FROM authenticated;
REVOKE ALL ON FUNCTION public.expedicao_comandos_immutable_guard_fn() FROM service_role;

DROP TRIGGER IF EXISTS expedicao_comandos_immutable_guard ON public.expedicao_comandos;
CREATE TRIGGER expedicao_comandos_immutable_guard
  BEFORE UPDATE OR DELETE ON public.expedicao_comandos
  FOR EACH ROW EXECUTE FUNCTION public.expedicao_comandos_immutable_guard_fn();

COMMENT ON FUNCTION public.expedicao_comandos_immutable_guard_fn() IS
  'db/86: torna public.expedicao_comandos imutavel apos o INSERT (rejeita UPDATE e DELETE, sem excecao e sem bypass por app.retificacao_autorizada).';

-- Access path for the op_item_id-exact measured-output join.
CREATE INDEX IF NOT EXISTS entrega_itens_op_item_idx
  ON public.entrega_itens (op_item_id);
CREATE INDEX IF NOT EXISTS expedicao_itens_op_item_idx
  ON public.expedicao_itens (op_item_id);

-- ============================================================
-- 2. Read RPC — exact per-op_item Manta expedition balance. No mutation.
-- ============================================================
CREATE OR REPLACE FUNCTION public.consultar_saldo_expedicao_manta(
  p_op_tecelagem_id BIGINT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_op                RECORD;
  v_lote              RECORD;
  v_pedido_cliente    BIGINT;
  v_item_ct           INTEGER;
  v_nonmanta          INTEGER;
  v_expedicao_id      BIGINT;
  v_status            TEXT;
  v_itens             JSONB;
  v_previsto_total    NUMERIC(10,2);
  v_recebido_total    NUMERIC(10,2);
  v_liberado_total    NUMERIC(10,2);
  v_entregue_total    NUMERIC(10,2);
  v_disponivel_total  NUMERIC(10,2);
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'sem_permissao', 'erro', 'Sem permissao');
  END IF;

  SELECT * INTO v_op FROM public.ops WHERE id = p_op_tecelagem_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'op_inexistente', 'erro', 'OP de tecelagem nao encontrada');
  END IF;
  IF COALESCE(v_op.tipo, '') <> 'tecelagem' THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'op_tipo_invalido',
      'erro', 'Somente OP de tecelagem possui saldo de expedicao Manta', 'tipo', v_op.tipo);
  END IF;

  SELECT count(*), count(*) FILTER (WHERE m.tipo_produto IS DISTINCT FROM 'manta')
    INTO v_item_ct, v_nonmanta
    FROM public.op_itens oi
    JOIN public.modelos m ON m.id = oi.modelo_id
   WHERE oi.op_id = p_op_tecelagem_id;

  IF v_item_ct = 0 THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'op_vazia', 'erro', 'OP de tecelagem sem itens');
  END IF;
  IF v_nonmanta > 0 THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'op_nao_manta',
      'erro', 'OP de tecelagem nao e homogenea de Manta', 'itens_nao_manta', v_nonmanta);
  END IF;

  IF v_op.lote_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'linhagem_invalida', 'erro', 'OP sem lote vinculado');
  END IF;
  SELECT * INTO v_lote FROM public.lotes WHERE id = v_op.lote_id;
  IF NOT FOUND OR v_lote.pedido_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'linhagem_invalida', 'erro', 'Lote sem pedido vinculado');
  END IF;
  SELECT p.cliente_id INTO v_pedido_cliente FROM public.pedidos p WHERE p.id = v_lote.pedido_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'linhagem_invalida', 'erro', 'Pedido de origem inexistente');
  END IF;
  IF v_lote.cliente_id IS DISTINCT FROM v_pedido_cliente THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'linhagem_inconsistente',
      'erro', 'Linhagem inconsistente na origem: cliente do lote diverge do cliente do pedido');
  END IF;

  SELECT ex.id, ex.status INTO v_expedicao_id, v_status
    FROM public.expedicoes ex WHERE ex.op_tecelagem_id = p_op_tecelagem_id;

  WITH item_base AS (
    SELECT oi.id AS op_item_id, oi.pedido_item_id, oi.modelo_id,
           ROUND(COALESCE(oi.metros_ajustados, oi.metros_pedidos)::NUMERIC, 2) AS previsto
      FROM public.op_itens oi
     WHERE oi.op_id = p_op_tecelagem_id
  ),
  recebido AS (
    SELECT ei.op_item_id,
           ROUND(COALESCE(SUM(ei.metros_entregues), 0)::NUMERIC, 2) AS metros
      FROM public.entrega_itens ei
      JOIN public.entregas e ON e.id = ei.entrega_id
     WHERE e.etapa = 'cima'
       AND ei.op_id = p_op_tecelagem_id
       AND ei.op_item_id IS NOT NULL
       AND COALESCE(ei.defeito, FALSE) = FALSE
       AND ei.metros_entregues > 0
     GROUP BY ei.op_item_id
  ),
  liberado AS (
    SELECT xi.op_item_id,
           ROUND(COALESCE(SUM(xi.metros_liberados), 0)::NUMERIC, 2) AS metros,
           ROUND(COALESCE(SUM(xi.metros_entregues), 0)::NUMERIC, 2) AS entregue
      FROM public.expedicao_itens xi
      JOIN public.expedicoes ex ON ex.id = xi.expedicao_id
     WHERE ex.op_tecelagem_id = p_op_tecelagem_id
     GROUP BY xi.op_item_id
  ),
  saldo AS (
    SELECT ib.op_item_id, ib.pedido_item_id, ib.modelo_id, ib.previsto,
           ROUND(COALESCE(r.metros, 0)::NUMERIC, 2)   AS recebido,
           ROUND(COALESCE(l.metros, 0)::NUMERIC, 2)   AS liberado,
           ROUND(COALESCE(l.entregue, 0)::NUMERIC, 2) AS entregue,
           ROUND(GREATEST(COALESCE(r.metros, 0) - COALESCE(l.metros, 0), 0)::NUMERIC, 2) AS disponivel
      FROM item_base ib
      LEFT JOIN recebido r ON r.op_item_id = ib.op_item_id
      LEFT JOIN liberado l ON l.op_item_id = ib.op_item_id
  )
  SELECT
    COALESCE(jsonb_agg(jsonb_build_object(
      'op_item_id', op_item_id, 'pedido_item_id', pedido_item_id, 'modelo_id', modelo_id,
      'previsto', previsto, 'recebido', recebido, 'liberado', liberado,
      'entregue', entregue, 'disponivel', disponivel
    ) ORDER BY op_item_id), '[]'::jsonb),
    ROUND(COALESCE(SUM(previsto), 0)::NUMERIC, 2),
    ROUND(COALESCE(SUM(recebido), 0)::NUMERIC, 2),
    ROUND(COALESCE(SUM(liberado), 0)::NUMERIC, 2),
    ROUND(COALESCE(SUM(entregue), 0)::NUMERIC, 2),
    ROUND(COALESCE(SUM(disponivel), 0)::NUMERIC, 2)
  INTO v_itens, v_previsto_total, v_recebido_total, v_liberado_total, v_entregue_total, v_disponivel_total
  FROM saldo;

  RETURN jsonb_build_object(
    'ok', true,
    'op_tecelagem_id', p_op_tecelagem_id,
    'op_status', v_op.status,
    'pedido_id', v_lote.pedido_id,
    'lote_id', v_op.lote_id,
    'cliente_id', v_lote.cliente_id,
    'expedicao_id', v_expedicao_id,
    'expedicao_status', v_status,
    'previsto_total', COALESCE(v_previsto_total, 0),
    'recebido_total', COALESCE(v_recebido_total, 0),
    'liberado_total', COALESCE(v_liberado_total, 0),
    'entregue_total', COALESCE(v_entregue_total, 0),
    'disponivel_total', COALESCE(v_disponivel_total, 0),
    'itens', v_itens
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.consultar_saldo_expedicao_manta(BIGINT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.consultar_saldo_expedicao_manta(BIGINT) FROM anon;
GRANT EXECUTE ON FUNCTION public.consultar_saldo_expedicao_manta(BIGINT) TO authenticated;

COMMENT ON FUNCTION public.consultar_saldo_expedicao_manta(BIGINT) IS
  'db/86: saldo exato de expedicao Manta por op_item. recebido = saida medida sem defeito em entregas etapa=cima com juncao op_item_id-EXATA (nunca por modelo_id); liberado = SUM(expedicao_itens.metros_liberados) da unica expedicao com op_tecelagem_id = a OP; disponivel = ROUND(GREATEST(recebido-liberado,0),2). O planejado COALESCE(metros_ajustados, metros_pedidos) e devolvido apenas como previsto e NUNCA e autoridade. Admin-only, SECURITY DEFINER, sem mutacao, ordenacao deterministica por op_item_id.';

-- ============================================================
-- 3. Write RPC — partial/additive Manta expedition release with deterministic
--    idempotent replay.
-- ============================================================
CREATE OR REPLACE FUNCTION public.liberar_expedicao_manta_parcial(
  p_op_tecelagem_id BIGINT,
  p_itens           JSONB,
  p_observacao      TEXT DEFAULT NULL,
  p_idempotency_key TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ator                 UUID;
  v_key                  TEXT;
  v_payload              JSONB;
  v_hash                 TEXT;
  v_cmd                  RECORD;
  v_op                   RECORD;
  v_lote                 RECORD;
  v_pedido_cliente       BIGINT;
  v_item_ct              INTEGER;
  v_nonmanta             INTEGER;
  v_lock_id              BIGINT;
  v_req                  RECORD;
  v_item                 RECORD;
  v_rows                 INTEGER := 0;
  v_expedicao_id         BIGINT;
  v_expedicao_created    BOOLEAN := FALSE;
  v_itens_plan           JSONB := '[]'::jsonb;
  v_itens_written        JSONB := '[]'::jsonb;
  v_plan_item            JSONB;
  v_liberado_total       NUMERIC(10,2) := 0;
  v_saldo_restante_total NUMERIC(10,2) := 0;
  v_existing_item_id     BIGINT;
  v_upsert_id            BIGINT;
  v_liberado_depois      NUMERIC(10,2);
  v_status               TEXT;
  v_resultado            JSONB;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'sem_permissao', 'erro', 'Sem permissao');
  END IF;

  IF p_itens IS NULL OR jsonb_typeof(p_itens) <> 'array' OR jsonb_array_length(p_itens) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'payload_vazio', 'erro', 'Informe ao menos um item para liberar');
  END IF;

  v_ator := auth.uid();
  v_key  := NULLIF(btrim(COALESCE(p_idempotency_key, '')), '');

  IF v_key IS NOT NULL THEN
    IF v_ator IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'codigo', 'ator_indeterminado',
        'erro', 'Chave de idempotencia exige um ator autenticado');
    END IF;
    IF length(v_key) > 200 THEN
      RETURN jsonb_build_object('ok', false, 'codigo', 'idempotency_key_invalida',
        'erro', 'Chave de idempotencia deve ter entre 1 e 200 caracteres');
    END IF;

    -- Canonical normalized request: derived ONLY from the arguments, so it is
    -- stable regardless of database state. Quantities are rendered as fixed
    -- 2-decimal text (the §13.2 idiom) so 10 and 10.00 are the same request.
    SELECT jsonb_build_object(
             'namespace', 'manta_release_v1',
             'op_tecelagem_id', p_op_tecelagem_id,
             'observacao', NULLIF(btrim(COALESCE(p_observacao, '')), ''),
             'itens', COALESCE(jsonb_agg(jsonb_build_object(
                        'op_item_id', op_item_id,
                        'metros', ROUND(metros, 2)::TEXT
                      ) ORDER BY op_item_id), '[]'::jsonb))
      INTO v_payload
      FROM (
        SELECT x.op_item_id, SUM(x.metros) AS metros
          FROM jsonb_to_recordset(p_itens) AS x(op_item_id BIGINT, metros NUMERIC)
         GROUP BY x.op_item_id
      ) n;
    v_hash := md5(v_payload::TEXT);

    -- Lock order step 0: taken BEFORE any table row lock.
    PERFORM pg_advisory_xact_lock(hashtextextended(
      'manta_release_v1|' || v_ator::TEXT || '|' || v_key, 0));

    SELECT * INTO v_cmd
      FROM public.expedicao_comandos c
     WHERE c.idempotency_namespace = 'manta_release_v1'
       AND c.ator_id = v_ator
       AND c.idempotency_key = v_key;

    IF FOUND THEN
      IF v_cmd.comando_payload = v_payload AND v_cmd.comando_hash = v_hash THEN
        RETURN v_cmd.resultado;                  -- byte-for-byte, zero mutation
      END IF;
      RETURN jsonb_build_object('ok', false, 'codigo', 'idempotencia_conflitante',
        'erro', 'Chave reutilizada com comando diferente');
    END IF;
  END IF;

  -- Lock order step 1: source OP FOR UPDATE, before any balance/identity read.
  SELECT * INTO v_op FROM public.ops WHERE id = p_op_tecelagem_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'op_inexistente', 'erro', 'OP de tecelagem nao encontrada');
  END IF;
  IF COALESCE(v_op.tipo, '') <> 'tecelagem' THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'op_tipo_invalido',
      'erro', 'Somente OP de tecelagem pode liberar expedicao Manta', 'tipo', v_op.tipo);
  END IF;

  SELECT count(*), count(*) FILTER (WHERE m.tipo_produto IS DISTINCT FROM 'manta')
    INTO v_item_ct, v_nonmanta
    FROM public.op_itens oi
    JOIN public.modelos m ON m.id = oi.modelo_id
   WHERE oi.op_id = p_op_tecelagem_id;
  IF v_item_ct = 0 THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'op_vazia', 'erro', 'OP de tecelagem sem itens');
  END IF;
  IF v_nonmanta > 0 THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'op_nao_manta',
      'erro', 'OP de tecelagem nao e homogenea de Manta', 'itens_nao_manta', v_nonmanta);
  END IF;

  -- Lock order step 2: source lineage under db/84-compatible locks. Pedido,
  -- Lote and Cliente are DERIVED here and never accepted from the client.
  IF v_op.lote_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'linhagem_invalida', 'erro', 'OP sem lote vinculado');
  END IF;
  PERFORM 1 FROM public.lotes WHERE id = v_op.lote_id FOR SHARE;
  SELECT * INTO v_lote FROM public.lotes WHERE id = v_op.lote_id;
  IF NOT FOUND OR v_lote.pedido_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'linhagem_invalida', 'erro', 'Lote sem pedido vinculado');
  END IF;
  PERFORM 1 FROM public.pedidos WHERE id = v_lote.pedido_id FOR SHARE;
  SELECT p.cliente_id INTO v_pedido_cliente FROM public.pedidos p WHERE p.id = v_lote.pedido_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'linhagem_invalida', 'erro', 'Pedido de origem inexistente');
  END IF;
  IF v_lote.cliente_id IS DISTINCT FROM v_pedido_cliente THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'linhagem_inconsistente',
      'erro', 'Linhagem inconsistente na origem: cliente do lote diverge do cliente do pedido');
  END IF;

  -- Lock order step 3: the measured-output rows that compose `recebido`,
  -- ascending id. This is the release-vs-output-correction serialization point.
  FOR v_lock_id IN
    SELECT ei.id
      FROM public.entrega_itens ei
      JOIN public.entregas e ON e.id = ei.entrega_id
     WHERE e.etapa = 'cima' AND ei.op_id = p_op_tecelagem_id
     ORDER BY ei.id
  LOOP
    PERFORM 1 FROM public.entrega_itens WHERE id = v_lock_id FOR UPDATE;
  END LOOP;

  -- Lock order step 4: the (at most one) expedition sourced by this OP.
  SELECT ex.id INTO v_expedicao_id
    FROM public.expedicoes ex WHERE ex.op_tecelagem_id = p_op_tecelagem_id FOR UPDATE;

  -- Lock order step 5: its items, ascending id.
  IF v_expedicao_id IS NOT NULL THEN
    FOR v_lock_id IN
      SELECT xi.id FROM public.expedicao_itens xi WHERE xi.expedicao_id = v_expedicao_id ORDER BY xi.id
    LOOP
      PERFORM 1 FROM public.expedicao_itens WHERE id = v_lock_id FOR UPDATE;
    END LOOP;
  END IF;

  -- Plan every requested item against post-lock committed balances. Duplicate
  -- entries are aggregated per op_item_id; nothing is written in this pass.
  FOR v_req IN
    SELECT x.op_item_id::BIGINT AS op_item_id, ROUND(SUM(x.metros)::NUMERIC, 2) AS metros
      FROM jsonb_to_recordset(p_itens) AS x(op_item_id BIGINT, metros NUMERIC)
     GROUP BY x.op_item_id
     ORDER BY x.op_item_id
  LOOP
    v_rows := v_rows + 1;

    IF v_req.op_item_id IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'codigo', 'item_invalido', 'erro', 'Item sem op_item_id');
    END IF;
    IF v_req.metros IS NULL OR v_req.metros <= 0 THEN
      RETURN jsonb_build_object('ok', false, 'codigo', 'metros_invalidos',
        'erro', 'Quantidade a liberar deve ser maior que zero', 'op_item_id', v_req.op_item_id);
    END IF;

    SELECT
      oi.id AS op_item_id, oi.pedido_item_id, oi.modelo_id,
      ROUND(COALESCE(oi.metros_ajustados, oi.metros_pedidos)::NUMERIC, 2) AS previsto,
      ROUND(COALESCE((
        SELECT SUM(ei.metros_entregues)
          FROM public.entrega_itens ei
          JOIN public.entregas e ON e.id = ei.entrega_id
         WHERE e.etapa = 'cima'
           AND ei.op_id = p_op_tecelagem_id
           AND ei.op_item_id = oi.id
           AND COALESCE(ei.defeito, FALSE) = FALSE
           AND ei.metros_entregues > 0
      ), 0)::NUMERIC, 2) AS recebido,
      ROUND(COALESCE((
        SELECT SUM(xi.metros_liberados)
          FROM public.expedicao_itens xi
          JOIN public.expedicoes ex ON ex.id = xi.expedicao_id
         WHERE ex.op_tecelagem_id = p_op_tecelagem_id
           AND xi.op_item_id = oi.id
      ), 0)::NUMERIC, 2) AS liberado
    INTO v_item
    FROM public.op_itens oi
   WHERE oi.id = v_req.op_item_id AND oi.op_id = p_op_tecelagem_id;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('ok', false, 'codigo', 'item_fora_da_op',
        'erro', 'Item nao pertence a OP de tecelagem informada', 'op_item_id', v_req.op_item_id);
    END IF;

    IF v_req.metros > ROUND(GREATEST(v_item.recebido - v_item.liberado, 0)::NUMERIC, 2) THEN
      RETURN jsonb_build_object(
        'ok', false, 'codigo', 'excede_disponivel',
        'erro', 'Liberacao excede a saida medida disponivel',
        'op_item_id', v_req.op_item_id,
        'recebido', v_item.recebido,
        'liberado', v_item.liberado,
        'disponivel', ROUND(GREATEST(v_item.recebido - v_item.liberado, 0)::NUMERIC, 2),
        'solicitado', v_req.metros);
    END IF;

    v_liberado_total := ROUND((v_liberado_total + v_req.metros)::NUMERIC, 2);
    v_saldo_restante_total := ROUND((v_saldo_restante_total
      + GREATEST(v_item.recebido - v_item.liberado - v_req.metros, 0))::NUMERIC, 2);

    v_itens_plan := v_itens_plan || jsonb_build_array(jsonb_build_object(
      'op_item_id',     v_item.op_item_id,
      'modelo_id',      v_item.modelo_id,
      'pedido_item_id', v_item.pedido_item_id,
      'previsto',       v_item.previsto,
      'recebido',       v_item.recebido,
      'liberado_antes', v_item.liberado,
      'liberar',        v_req.metros,
      'saldo_restante', ROUND(GREATEST(v_item.recebido - v_item.liberado - v_req.metros, 0)::NUMERIC, 2)
    ));
  END LOOP;

  IF v_rows = 0 OR v_liberado_total <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'payload_vazio', 'erro', 'Informe quantidade maior que zero');
  END IF;

  -- Create or reuse the ONE expedition for this Manta weaving OP. op_latex_id
  -- stays NULL; lineage is the derived one (db/84 validates it again).
  IF v_expedicao_id IS NULL THEN
    INSERT INTO public.expedicoes (pedido_id, op_tecelagem_id, op_latex_id, lote_id, cliente_id, status)
    VALUES (v_lote.pedido_id, p_op_tecelagem_id, NULL, v_op.lote_id, v_lote.cliente_id, 'aguardando_expedicao')
    RETURNING id INTO v_expedicao_id;
    v_expedicao_created := TRUE;
  END IF;

  FOR v_plan_item IN SELECT value FROM jsonb_array_elements(v_itens_plan)
  LOOP
    v_existing_item_id := NULL;
    SELECT id INTO v_existing_item_id
      FROM public.expedicao_itens
     WHERE expedicao_id = v_expedicao_id
       AND op_item_id = (v_plan_item->>'op_item_id')::BIGINT
     FOR UPDATE;

    INSERT INTO public.expedicao_itens (expedicao_id, op_item_id, pedido_item_id, modelo_id, metros_liberados)
    VALUES (
      v_expedicao_id,
      (v_plan_item->>'op_item_id')::BIGINT,
      NULLIF(v_plan_item->>'pedido_item_id', '')::UUID,
      (v_plan_item->>'modelo_id')::BIGINT,
      (v_plan_item->>'liberar')::NUMERIC(10,2))
    ON CONFLICT (expedicao_id, op_item_id) DO UPDATE
      SET pedido_item_id  = EXCLUDED.pedido_item_id,
          modelo_id       = EXCLUDED.modelo_id,
          metros_liberados = public.expedicao_itens.metros_liberados + EXCLUDED.metros_liberados,
          atualizado_em   = now()
    RETURNING id, metros_liberados INTO v_upsert_id, v_liberado_depois;

    v_itens_written := v_itens_written || jsonb_build_array(
      v_plan_item || jsonb_build_object(
        'expedicao_item_id', v_upsert_id,
        'created',           v_existing_item_id IS NULL,
        'liberado_depois',   v_liberado_depois));
  END LOOP;

  v_status := public.recalcular_status_expedicao(v_expedicao_id);

  v_resultado := jsonb_build_object(
    'ok',               true,
    'expedicao_id',     v_expedicao_id,
    'created',          v_expedicao_created,
    'updated',          NOT v_expedicao_created,
    'expedicao_status', v_status,
    'op_tecelagem_id',  p_op_tecelagem_id,
    'pedido_id',        v_lote.pedido_id,
    'lote_id',          v_op.lote_id,
    'cliente_id',       v_lote.cliente_id,
    'liberado_total',   v_liberado_total,
    'saldo_restante',   v_saldo_restante_total,
    'observacao',       NULLIF(btrim(COALESCE(p_observacao, '')), ''),
    'idempotency_key',  v_key,
    'itens',            v_itens_written);

  INSERT INTO public.op_eventos (op_id, tipo_evento, observacao, payload, criado_por)
  VALUES (
    p_op_tecelagem_id,
    'expedicao_manta_liberada',
    NULLIF(btrim(COALESCE(p_observacao, '')), ''),
    jsonb_build_object(
      'expedicao_id',     v_expedicao_id,
      'expedicao_status', v_status,
      'itens',            v_itens_written,
      'liberado_total',   v_liberado_total,
      'saldo_restante',   v_saldo_restante_total,
      'observacao',       NULLIF(btrim(COALESCE(p_observacao, '')), ''),
      'idempotency_key',  v_key),
    v_ator);

  -- The command row is written inside the same transaction, after validation and
  -- before returning, so a committed release always has its replay record and a
  -- rolled-back one has none.
  IF v_key IS NOT NULL THEN
    INSERT INTO public.expedicao_comandos
      (idempotency_namespace, ator_id, idempotency_key, comando_payload, comando_hash, resultado)
    VALUES ('manta_release_v1', v_ator, v_key, v_payload, v_hash, v_resultado);
  END IF;

  RETURN v_resultado;
EXCEPTION WHEN OTHERS THEN
  -- Only unexpected failures reach here: every expected validation branch above
  -- returns a stable identifier BEFORE any write. The subtransaction rollback
  -- guarantees expedition, items, event and command row commit together or not
  -- at all, and leaves no command row behind for a failed attempt.
  RETURN jsonb_build_object('ok', false, 'codigo', 'erro_inesperado', 'erro', SQLERRM);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.liberar_expedicao_manta_parcial(BIGINT, JSONB, TEXT, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.liberar_expedicao_manta_parcial(BIGINT, JSONB, TEXT, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.liberar_expedicao_manta_parcial(BIGINT, JSONB, TEXT, TEXT) TO authenticated;

COMMENT ON FUNCTION public.liberar_expedicao_manta_parcial(BIGINT, JSONB, TEXT, TEXT) IS
  'db/86: escritor autoritativo de liberacao parcial/aditiva de expedicao Manta. Admin-only, SECURITY DEFINER, search_path=public. Ordem de travas: advisory de idempotencia (antes de qualquer trava de linha) -> ops FOR UPDATE -> lote/pedido FOR SHARE (db/84) -> entrega_itens da saida medida (id asc) FOR UPDATE -> expedicoes FOR UPDATE -> expedicao_itens (id asc) FOR UPDATE. Disponivel = ROUND(GREATEST(recebido-liberado,0),2) com recebido medido sem defeito por juncao op_item_id-EXATA; o planejado nunca e autoridade. Cria ou reutiliza a unica expedicao da OP (op_latex_id NULL), faz upsert aditivo por (expedicao_id, op_item_id) copiando modelo_id/pedido_item_id do op_item, recalcula o status, escreve op_eventos expedicao_manta_liberada e, quando ha chave, a linha imutavel em expedicao_comandos. Replay exato devolve o resultado armazenado byte a byte sem qualquer mutacao; chave reutilizada com comando diferente retorna idempotencia_conflitante; validacao falha nao grava comando.';

-- ============================================================
-- 4. Reload PostgREST
-- ============================================================
NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';

COMMIT;
