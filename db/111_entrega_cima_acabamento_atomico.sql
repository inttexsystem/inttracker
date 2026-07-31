-- =====================================================================
-- db/111 — SERVER-OWNED ATOMIC WEAVING DELIVERY + FINISHING OP
--
-- NATIVE-RECEIPT-COORDINATED-RELEASE-P1-FINISHING-TRANSACTION-CORRECTION-R1.
-- Implements binding ruling TD3 and completes the §9.9.J transaction
-- contract, which db/108 could not satisfy alone.
--
-- THE DEFECT THIS CORRECTS. db/108 made finishing-OP creation idempotent
-- and replay-stable, but it does not own DELIVERY creation. The shipped
-- caller (js/screens/entrega-writes.js::salvarEntregaCima) performs
--     INSERT entregas -> INSERT entrega_itens -> RPC gerar_op_latex*
-- as three separate statements from the browser, with a manual
-- compensating DELETE. That is not one transaction: a crash, a lost
-- connection or a compensation failure between the steps leaves a
-- delivery with no finishing OP and no failure evidence, and the
-- "best-effort" RPC call is explicitly documented there as not undoing
-- the delivery.
--
-- TD3 — DELIVERY-TO-FINISHING ATOMICITY IS SERVER-OWNED.
-- The frontend may submit ONE command. It may not insert entregas or
-- entrega_itens and then call the finishing RPC. JavaScript does not own
-- transactionality.
--
-- THE STRUCTURE (9.9.J), all inside the ONE transaction the RPC runs in:
--   INSERT entregas (etapa='cima')
--   INSERT entrega_itens (complete set)
--   gerar_op_acabamento(...)        -- its own inner subtransaction
--   INSERT entrega_cima_comandos    -- top-level command evidence
-- A finishing failure rolls back ONLY the finishing creation: the
-- delivery, its items, the falha attempt row written by db/108 and this
-- command row all commit together. A header/item validation failure
-- happens BEFORE the first INSERT and creates nothing.
--
-- ADDITIVE AND COMPOSING. This migration creates one table and one
-- public writer under new names. It does NOT replace, modify or re-grant
-- _op_acabamento_criar, gerar_op_acabamento, pode_recuperar_op_acabamento
-- or gerar_op_latex_split: the new writer COMPOSES the existing canonical
-- writer. Already-applied db/108 is not rewritten and not reapplied.
--
-- ROUTE. Tapete only. The Manta weaving route has its own accepted
-- server-owned writer (registrar_entrega_cima_manta, db/85 corrected by
-- db/88) which deliberately never calls a finishing writer. Route is
-- derived strictly from modelos.tipo_produto through op_itens, never
-- from a model name, exactly as the db/85 item guard derives it.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. entrega_cima_comandos — the top-level command store
--    Same proven shape as expedicao_comandos (F10) and
--    op_acabamento_comandos (db/108).
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.entrega_cima_comandos (
  id                    BIGSERIAL PRIMARY KEY,
  idempotency_namespace TEXT NOT NULL
                          CHECK (idempotency_namespace = 'entrega_cima_v1'),
  ator_id               UUID NOT NULL,
  idempotency_key       TEXT NOT NULL
                          CHECK (length(btrim(idempotency_key)) BETWEEN 1 AND 200),
  entrega_id            BIGINT NOT NULL REFERENCES public.entregas(id) ON DELETE CASCADE,
  comando_payload       JSONB NOT NULL CHECK (jsonb_typeof(comando_payload) = 'object'),
  comando_hash          TEXT NOT NULL CHECK (comando_hash ~ '^[0-9a-f]{32}$'),
  resultado             JSONB NOT NULL CHECK (jsonb_typeof(resultado) = 'object'),
  criado_em             TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT entrega_cima_comandos_idempotencia
    UNIQUE (idempotency_namespace, ator_id, idempotency_key)
);

COMMENT ON TABLE public.entrega_cima_comandos IS
  'db/111 (TD3, 9.9.J): append-only idempotency store for the ONE server-owned weaving-delivery command. Same key + identical canonical payload returns the stored resultado and creates nothing; same key + different payload is refused as comando_conflitante.';

CREATE INDEX IF NOT EXISTS entrega_cima_comandos_entrega_idx
  ON public.entrega_cima_comandos (entrega_id, criado_em DESC, id DESC);

ALTER TABLE public.entrega_cima_comandos ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.entrega_cima_comandos FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON SEQUENCE public.entrega_cima_comandos_id_seq FROM PUBLIC, anon, authenticated, service_role;

GRANT SELECT ON TABLE public.entrega_cima_comandos TO authenticated;

DROP POLICY IF EXISTS entrega_cima_comandos_admin_select ON public.entrega_cima_comandos;
CREATE POLICY entrega_cima_comandos_admin_select
  ON public.entrega_cima_comandos FOR SELECT USING (public.is_admin());

-- Append-only: a recorded command is evidence and never mutates. A NEW
-- guard function is declared here; db/108's guard is not touched.
CREATE OR REPLACE FUNCTION public.trg_entrega_cima_comando_append_only_guard()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION 'entrega_cima_comando_imutavel' USING ERRCODE = '55000';
END;
$$;

DROP TRIGGER IF EXISTS entrega_cima_comandos_append_only ON public.entrega_cima_comandos;
CREATE TRIGGER entrega_cima_comandos_append_only
  BEFORE UPDATE ON public.entrega_cima_comandos
  FOR EACH ROW EXECUTE FUNCTION public.trg_entrega_cima_comando_append_only_guard();

-- ---------------------------------------------------------------------
-- 2. registrar_entrega_cima_com_acabamento — THE single public command
--
-- Exactly one overload is declared. The frontend submits this and
-- nothing else.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.registrar_entrega_cima_com_acabamento(
  p_fornecedor_id           BIGINT,
  p_op_id                   BIGINT,
  p_data                    DATE,
  p_observacao              TEXT,
  p_destino_fornecedor_id   BIGINT,
  p_linhas                  JSONB,
  p_idempotency_key         TEXT,
  p_motivo_split            TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_ator       UUID := auth.uid();
  v_key        TEXT;
  v_canon      JSONB;
  v_payload    JSONB;
  v_hash       TEXT;
  v_existente  RECORD;
  v_pedido_id  UUID;
  v_op         RECORD;
  v_lock_id    BIGINT;
  v_item_ct    INTEGER;
  v_nao_tapete INTEGER;
  v_linhas_ct  INTEGER;
  v_distintos  INTEGER;
  v_req        RECORD;
  v_op_item    RECORD;
  v_entrega_id BIGINT;
  v_motivo     TEXT;
  v_sub_key    TEXT;
  v_acab       JSONB;
  v_res        JSONB;
BEGIN
  -- 1. AUTHORIZE. Authenticated administrator, explicitly.
  IF v_ator IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'sem_permissao' USING ERRCODE = '42501';
  END IF;

  -- 2. THE IDEMPOTENCY KEY IS VALIDATED BEFORE ANY MUTATION.
  v_key := btrim(COALESCE(p_idempotency_key, ''));
  IF v_key = '' OR length(v_key) > 200 THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'ENTREGA_CHAVE_OBRIGATORIA');
  END IF;

  -- 3. PAYLOAD SHAPE.
  IF p_linhas IS NULL OR jsonb_typeof(p_linhas) <> 'array'
     OR jsonb_array_length(p_linhas) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'ENTREGA_PAYLOAD_VAZIO');
  END IF;

  -- 4. DETERMINISTIC CANONICALIZATION BEFORE HASHING. The wire order of
  --    p_linhas must never change the identity of the command, so the
  --    lines are re-emitted in a total order with normalized numeric
  --    scale. Duplicates are NOT aggregated here: an op_item repeated in
  --    one delivery is a payload error and is refused in step 9.
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'op_item_id',       x.op_item_id,
           'metros_entregues', to_char(round(x.metros_entregues, 2), 'FM9999999990.00'),
           'defeito',          x.defeito,
           'observacao',       NULLIF(btrim(COALESCE(x.observacao, '')), '')
         ) ORDER BY x.op_item_id, x.defeito), '[]'::jsonb)
    INTO v_canon
    FROM jsonb_to_recordset(p_linhas)
           AS x(op_item_id BIGINT, metros_entregues NUMERIC, defeito BOOLEAN, observacao TEXT);

  v_payload := jsonb_build_object(
    'namespace',             'entrega_cima_v1',
    'fornecedor_id',         p_fornecedor_id,
    'op_id',                 p_op_id,
    'data',                  COALESCE(p_data, CURRENT_DATE)::TEXT,
    'observacao',            NULLIF(btrim(COALESCE(p_observacao, '')), ''),
    'destino_fornecedor_id', p_destino_fornecedor_id,
    'motivo_split',          NULLIF(btrim(COALESCE(p_motivo_split, '')), ''),
    'linhas',                v_canon);
  v_hash := md5(v_payload::TEXT);

  -- 5. REPLAY, before any state change.
  SELECT * INTO v_existente
    FROM public.entrega_cima_comandos
   WHERE idempotency_namespace = 'entrega_cima_v1'
     AND ator_id = v_ator
     AND idempotency_key = v_key;
  IF FOUND THEN
    IF v_existente.comando_hash = v_hash THEN
      RETURN v_existente.resultado;          -- identical replay: no write
    END IF;
    RETURN jsonb_build_object('ok', false, 'codigo', 'comando_conflitante');
  END IF;

  -- 6. RESOLVE THE PEDIDO FROM THE ORIGIN OP. An OP with no Pedido
  --    lineage cannot produce a weaving delivery.
  SELECT lt.pedido_id INTO v_pedido_id
    FROM public.ops o
    JOIN public.lotes lt ON lt.id = o.lote_id
   WHERE o.id = p_op_id;
  IF v_pedido_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'ENTREGA_OP_SEM_PEDIDO');
  END IF;

  -- 7. LOCKS, in the accepted global order (9.9.B):
  --    pedidos -> ops (ASC id) -> op_itens (ASC id).
  BEGIN
    SET LOCAL lock_timeout = '5s';
    PERFORM 1 FROM public.pedidos WHERE id = v_pedido_id FOR UPDATE;
    PERFORM 1 FROM public.ops o
      JOIN public.lotes lt ON lt.id = o.lote_id
     WHERE lt.pedido_id = v_pedido_id
     ORDER BY o.id
       FOR UPDATE OF o;
    FOR v_lock_id IN
      SELECT oi.id FROM public.op_itens oi WHERE oi.op_id = p_op_id ORDER BY oi.id
    LOOP
      PERFORM 1 FROM public.op_itens WHERE id = v_lock_id FOR UPDATE;
    END LOOP;
  EXCEPTION WHEN lock_not_available THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'concorrencia_ocupada');
  END;

  -- 8. THE ORIGIN OP, RE-READ UNDER THE LOCK.
  SELECT * INTO v_op FROM public.ops WHERE id = p_op_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'ENTREGA_OP_INEXISTENTE');
  END IF;
  IF COALESCE(v_op.tipo, '') <> 'tecelagem' THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'ENTREGA_OP_TIPO_INVALIDO',
                              'tipo', v_op.tipo);
  END IF;

  -- ROUTE: non-empty and homogeneously Tapete, derived strictly from
  -- modelos.tipo_produto. A Manta OP belongs to registrar_entrega_cima_manta.
  SELECT count(*), count(*) FILTER (WHERE m.tipo_produto IS DISTINCT FROM 'tapete')
    INTO v_item_ct, v_nao_tapete
    FROM public.op_itens oi
    JOIN public.modelos m ON m.id = oi.modelo_id
   WHERE oi.op_id = p_op_id;

  IF v_item_ct = 0 THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'ENTREGA_OP_VAZIA');
  END IF;
  IF v_nao_tapete > 0 THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'ENTREGA_ROTA_NAO_TAPETE',
                              'itens_nao_tapete', v_nao_tapete);
  END IF;

  -- 9. THE SUBMITTED LINES. Every op_item_id must exist, belong to
  --    p_op_id and appear EXACTLY ONCE.
  SELECT count(*), count(DISTINCT x.op_item_id)
    INTO v_linhas_ct, v_distintos
    FROM jsonb_to_recordset(p_linhas)
           AS x(op_item_id BIGINT, metros_entregues NUMERIC, defeito BOOLEAN, observacao TEXT);
  IF v_distintos IS DISTINCT FROM v_linhas_ct THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'ENTREGA_ITEM_DUPLICADO');
  END IF;

  FOR v_req IN
    SELECT x.op_item_id, x.metros_entregues, x.defeito, x.observacao
      FROM jsonb_to_recordset(p_linhas)
             AS x(op_item_id BIGINT, metros_entregues NUMERIC, defeito BOOLEAN, observacao TEXT)
     ORDER BY x.op_item_id
  LOOP
    IF v_req.op_item_id IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'codigo', 'ENTREGA_ITEM_INVALIDO');
    END IF;
    IF v_req.metros_entregues IS NULL OR v_req.metros_entregues <= 0
       OR round(v_req.metros_entregues, 2) IS DISTINCT FROM v_req.metros_entregues THEN
      RETURN jsonb_build_object('ok', false, 'codigo', 'ENTREGA_METROS_INVALIDOS',
                                'op_item_id', v_req.op_item_id);
    END IF;

    SELECT oi.id, oi.op_id, oi.modelo_id INTO v_op_item
      FROM public.op_itens oi WHERE oi.id = v_req.op_item_id;
    IF NOT FOUND OR v_op_item.op_id IS DISTINCT FROM p_op_id THEN
      RETURN jsonb_build_object('ok', false, 'codigo', 'ENTREGA_ITEM_FORA_DA_OP',
                                'op_item_id', v_req.op_item_id);
    END IF;
  END LOOP;

  -- 10. HEADER PRECONDITIONS. The Tapete route REQUIRES a finishing
  --     destination; the db/85 item guard enforces the same rule and
  --     would otherwise raise inside the item INSERT.
  IF p_fornecedor_id IS NULL
     OR NOT EXISTS (SELECT 1 FROM public.fornecedores f WHERE f.id = p_fornecedor_id) THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'ENTREGA_FORNECEDOR_INVALIDO');
  END IF;
  IF p_destino_fornecedor_id IS NULL
     OR NOT EXISTS (SELECT 1 FROM public.fornecedores f WHERE f.id = p_destino_fornecedor_id) THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'ENTREGA_DESTINO_OBRIGATORIO');
  END IF;

  v_motivo := NULLIF(btrim(COALESCE(p_motivo_split, '')), '');

  -- ===== EVERY REFUSAL PATH IS NOW BEHIND US. NOTHING ABOVE WROTE. =====

  -- 11. THE DELIVERY HEADER.
  INSERT INTO public.entregas (fornecedor_id, etapa, data, observacao, destino_fornecedor_id)
  VALUES (p_fornecedor_id, 'cima', COALESCE(p_data, CURRENT_DATE),
          NULLIF(btrim(COALESCE(p_observacao, '')), ''), p_destino_fornecedor_id)
  RETURNING id INTO v_entrega_id;

  -- 12. THE COMPLETE ITEM SET. The current valid line fields and their
  --     NUMERIC(10,2) precision are preserved exactly; modelo_id stays
  --     NULL as the shipped Tapete path leaves it, and the CHECK
  --     (op_item_id IS NOT NULL OR modelo_id IS NOT NULL) is satisfied
  --     by op_item_id.
  FOR v_req IN
    SELECT x.op_item_id, x.metros_entregues, x.defeito, x.observacao
      FROM jsonb_to_recordset(p_linhas)
             AS x(op_item_id BIGINT, metros_entregues NUMERIC, defeito BOOLEAN, observacao TEXT)
     ORDER BY x.op_item_id
  LOOP
    INSERT INTO public.entrega_itens
      (entrega_id, op_id, op_item_id, metros_entregues, defeito, observacao)
    VALUES (v_entrega_id, p_op_id, v_req.op_item_id,
            round(v_req.metros_entregues, 2)::NUMERIC(10,2),
            COALESCE(v_req.defeito, FALSE),
            NULLIF(btrim(COALESCE(v_req.observacao, '')), ''));
  END LOOP;

  -- 13. THE FINISHING OP, IN THIS SAME TRANSACTION.
  --     gerar_op_acabamento (db/108) owns creation, replay identity and
  --     its own inner subtransaction: on failure it rolls back ONLY the
  --     creation and commits a falha attempt row with our delivery.
  --     The subordinate key is DERIVED from the top-level command key, so
  --     a replay of one command replays exactly one finishing identity.
  v_sub_key := 'entrega_cima_v1|' || v_key || '|acabamento';
  v_acab := public.gerar_op_acabamento(v_entrega_id, v_sub_key, v_motivo);

  -- 14. THE RESULT. A finishing failure NEVER converts a valid committed
  --     delivery into a failed delivery result.
  IF COALESCE((v_acab ->> 'ok')::BOOLEAN, FALSE) THEN
    v_res := jsonb_build_object(
      'ok', true,
      'entrega_registrada', true,
      'entrega_id', v_entrega_id,
      'acabamento', jsonb_build_object(
        'ok', true,
        'op_latex_id', (v_acab ->> 'op_latex_id')::BIGINT,
        'split_seq', (v_acab ->> 'split_seq')::SMALLINT));
  ELSE
    v_res := jsonb_build_object(
      'ok', true,
      'entrega_registrada', true,
      'entrega_id', v_entrega_id,
      'acabamento', jsonb_build_object(
        'ok', false,
        'codigo', COALESCE(v_acab ->> 'codigo', 'ACABAMENTO_CRIACAO_FALHOU'),
        'recuperavel', COALESCE((v_acab ->> 'recuperavel')::BOOLEAN, TRUE)),
      'proxima_acao', 'RECUPERAR_OP_ACABAMENTO');
  END IF;

  -- 15. THE TOP-LEVEL COMMAND EVIDENCE, committed with everything else.
  INSERT INTO public.entrega_cima_comandos
    (idempotency_namespace, ator_id, idempotency_key, entrega_id,
     comando_payload, comando_hash, resultado)
  VALUES ('entrega_cima_v1', v_ator, v_key, v_entrega_id,
          v_payload, v_hash, v_res);

  RETURN v_res;
END;
$$;

COMMENT ON FUNCTION public.registrar_entrega_cima_com_acabamento(BIGINT, BIGINT, DATE, TEXT, BIGINT, JSONB, TEXT, TEXT) IS
  'db/111 (TD3, 9.9.J): THE single server-owned command that registers a Tapete weaving delivery and its finishing OP in ONE transaction. Validates and canonicalizes before any write, locks pedidos -> ops -> op_itens, inserts entregas + the complete entrega_itens set, then COMPOSES the existing canonical writer gerar_op_acabamento with a subordinate key derived from the top-level key. A finishing failure preserves the committed delivery and returns proxima_acao=RECUPERAR_OP_ACABAMENTO; a validation failure creates nothing. The frontend submits this and never inserts entregas or entrega_itens itself.';

-- ---------------------------------------------------------------------
-- 3. Explicit ownership and privileges
-- ---------------------------------------------------------------------
ALTER FUNCTION public.trg_entrega_cima_comando_append_only_guard() OWNER TO postgres;
ALTER FUNCTION public.registrar_entrega_cima_com_acabamento(BIGINT, BIGINT, DATE, TEXT, BIGINT, JSONB, TEXT, TEXT) OWNER TO postgres;

REVOKE ALL ON FUNCTION public.trg_entrega_cima_comando_append_only_guard()
  FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.registrar_entrega_cima_com_acabamento(BIGINT, BIGINT, DATE, TEXT, BIGINT, JSONB, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.registrar_entrega_cima_com_acabamento(BIGINT, BIGINT, DATE, TEXT, BIGINT, JSONB, TEXT, TEXT) TO authenticated;

-- ---------------------------------------------------------------------
-- 4. Migration-time invariants
-- ---------------------------------------------------------------------
DO $db111$
DECLARE
  v_n INTEGER;
BEGIN
  -- 4.1 EXACTLY ONE overload of the public command exists.
  SELECT count(*) INTO v_n FROM pg_proc p
   WHERE p.pronamespace = 'public'::regnamespace
     AND p.proname = 'registrar_entrega_cima_com_acabamento';
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'db/111: expected exactly one registrar_entrega_cima_com_acabamento overload, found %', v_n;
  END IF;

  -- 4.2 The public writer is executable by authenticated ONLY.
  IF NOT has_function_privilege('authenticated',
        'public.registrar_entrega_cima_com_acabamento(bigint,bigint,date,text,bigint,jsonb,text,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'db/111: the public writer must be executable by authenticated';
  END IF;
  IF has_function_privilege('anon',
        'public.registrar_entrega_cima_com_acabamento(bigint,bigint,date,text,bigint,jsonb,text,text)', 'EXECUTE')
     OR has_function_privilege('service_role',
        'public.registrar_entrega_cima_com_acabamento(bigint,bigint,date,text,bigint,jsonb,text,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'db/111: the public writer must not be reachable by anon or service_role';
  END IF;

  -- 4.3 The command store carries no client mutation privilege.
  IF has_table_privilege('authenticated', 'public.entrega_cima_comandos', 'INSERT')
     OR has_table_privilege('authenticated', 'public.entrega_cima_comandos', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.entrega_cima_comandos', 'DELETE')
     OR has_table_privilege('anon', 'public.entrega_cima_comandos', 'SELECT')
     OR has_table_privilege('service_role', 'public.entrega_cima_comandos', 'SELECT') THEN
    RAISE EXCEPTION 'db/111: entrega_cima_comandos privileges are too wide';
  END IF;

  -- 4.4 db/108 IS COMPOSED, NOT REPLACED. All four accepted finishing
  --     objects must still exist, and the new writer must call the
  --     canonical one rather than reimplementing creation.
  IF (SELECT count(*) FROM pg_proc p
       WHERE p.pronamespace = 'public'::regnamespace
         AND p.proname IN ('_op_acabamento_criar', 'gerar_op_acabamento',
                           'pode_recuperar_op_acabamento', 'gerar_op_latex_split')) <> 4 THEN
    RAISE EXCEPTION 'db/111: a db/108 finishing object is missing';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
     WHERE p.pronamespace = 'public'::regnamespace
       AND p.proname = 'registrar_entrega_cima_com_acabamento'
       AND p.prosrc LIKE '%gerar_op_acabamento%'
  ) THEN
    RAISE EXCEPTION 'db/111: the new writer must compose gerar_op_acabamento';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_proc p
     WHERE p.pronamespace = 'public'::regnamespace
       AND p.proname = 'registrar_entrega_cima_com_acabamento'
       AND (p.prosrc LIKE '%INSERT INTO public.ops%' OR p.prosrc LIKE '%op_latex_entregas%')
  ) THEN
    RAISE EXCEPTION 'db/111: the new writer must not reimplement finishing-OP creation';
  END IF;

  -- 4.5 The accepted Manta weaving writer is untouched and still exists.
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace
      AND p.proname = 'registrar_entrega_cima_manta'
  ) THEN
    RAISE EXCEPTION 'db/111: the accepted Manta weaving writer disappeared';
  END IF;

  -- 4.6 P1 remains additive: the cutover is untouched.
  PERFORM 1 FROM public.ordem_compra_cutover
   WHERE id = 1 AND status = 'legacy_active' AND read_authority = 'flat';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'db/111: ordem_compra_cutover is not legacy_active/flat';
  END IF;
END
$db111$;

COMMIT;
