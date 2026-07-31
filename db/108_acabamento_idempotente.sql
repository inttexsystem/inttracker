-- =====================================================================
-- db/108 — IDEMPOTENT FINISHING OP (transaction and replay identity)
--
-- NATIVE-RECEIPT-COORDINATED-RELEASE-P1-ADDITIVE-BACKEND-R1, phase P1.
-- Implements PEDIDO_DERIVED_LIFECYCLE_RECOVERY_PLAN.md section 9.9.J.
--
-- NO AUTONOMOUS TRANSACTION IS USED ANYWHERE. The exact structure is:
--
--   BEGIN (outer, the delivery writer)
--     INSERT entregas; INSERT entrega_itens;        -- persisted
--     <inner PL/pgSQL BEGIN ... EXCEPTION WHEN OTHERS>
--         attempt finishing-OP creation              -- own subtransaction
--     EXCEPTION WHEN OTHERS THEN
--         capture SQLSTATE/MESSAGE;                  -- inner rolled back
--     END;
--     INSERT op_acabamento_tentativas (sucesso | falha, captured code);
--   COMMIT                                           -- delivery + evidence
--
-- On failure the finishing OP does not exist, the DELIVERY SURVIVES, and
-- the failure row commits with it. On success both commit.
--
-- REPLAY-STABLE split_seq. MAX(split_seq)+1 alone is rejected as
-- non-deterministic under replay. The command table
-- op_acabamento_comandos persists the split identity: split_seq is
-- assigned ONCE, inside a FOR UPDATE lock on the entregas row, as the
-- next value for that delivery, and STORED in the command row. A replay
-- of the same idempotency key returns the stored split_seq and creates
-- nothing.
--
-- ADDITIVE, with one authorized exception: gerar_op_latex_split(BIGINT,
-- TEXT) is RETAINED WITH ITS EXACT SIGNATURE as a compatibility wrapper
-- delegating to the new canonical writer with a derived idempotency key
-- (9.9.J). It is not dropped in this release and its external contract —
-- signature, success payload and RAISE-on-refusal behaviour — is
-- preserved exactly.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. Server-owned finishing identity on ops
--
-- ops.origem_entrega_id already exists (db/28); it is declared here with
-- IF NOT EXISTS so the contract is stated in one place and the statement
-- is a no-op on the live schema.
-- ---------------------------------------------------------------------
ALTER TABLE public.ops
  ADD COLUMN IF NOT EXISTS origem_entrega_id BIGINT REFERENCES public.entregas(id);

ALTER TABLE public.ops
  ADD COLUMN IF NOT EXISTS split_seq SMALLINT NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.ops.split_seq IS
  'db/108 (9.9.J): replay-stable finishing-split ordinal for one origin delivery. SERVER-OWNED and never client-supplied; assigned once under a FOR UPDATE lock on the entregas row and persisted in op_acabamento_comandos.';

-- A second attempt collides here and returns the existing OP.
CREATE UNIQUE INDEX IF NOT EXISTS ops_acabamento_origem_uidx
  ON public.ops (origem_entrega_id, split_seq)
  WHERE tipo IN ('latex', 'acabamento') AND origem_entrega_id IS NOT NULL;

-- ---------------------------------------------------------------------
-- 2. op_acabamento_comandos — the split identity store
--    Same shape as the proven public.expedicao_comandos.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.op_acabamento_comandos (
  id                    BIGSERIAL PRIMARY KEY,
  idempotency_namespace TEXT NOT NULL CHECK (idempotency_namespace = 'op_acabamento_v1'),
  ator_id               UUID NOT NULL,
  idempotency_key       TEXT NOT NULL
                          CHECK (length(btrim(idempotency_key)) BETWEEN 1 AND 200),
  origem_entrega_id     BIGINT NOT NULL REFERENCES public.entregas(id) ON DELETE CASCADE,
  split_seq             SMALLINT NOT NULL,
  comando_payload       JSONB NOT NULL CHECK (jsonb_typeof(comando_payload) = 'object'),
  comando_hash          TEXT NOT NULL CHECK (comando_hash ~ '^[0-9a-f]{32}$'),
  resultado             JSONB NOT NULL CHECK (jsonb_typeof(resultado) = 'object'),
  criado_em             TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT op_acabamento_comandos_idempotencia
    UNIQUE (idempotency_namespace, ator_id, idempotency_key)
);

COMMENT ON TABLE public.op_acabamento_comandos IS
  'db/108 (9.9.J): persists the finishing-split identity so a replay of the same idempotency key returns the SAME split_seq and creates nothing.';

CREATE INDEX IF NOT EXISTS op_acabamento_comandos_entrega_idx
  ON public.op_acabamento_comandos (origem_entrega_id, criado_em DESC, id DESC);

-- ---------------------------------------------------------------------
-- 3. op_acabamento_tentativas — append-only attempt evidence
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.op_acabamento_tentativas (
  id                BIGSERIAL PRIMARY KEY,
  origem_entrega_id BIGINT NOT NULL REFERENCES public.entregas(id) ON DELETE CASCADE,
  split_seq         SMALLINT NOT NULL,
  resultado         TEXT NOT NULL CHECK (resultado IN ('sucesso', 'falha')),
  codigo_falha      TEXT,
  mensagem          TEXT,
  ator_id           UUID,
  processo          TEXT,
  tentativa_seq     INTEGER NOT NULL,
  op_id             BIGINT REFERENCES public.ops(id) ON DELETE SET NULL,
  ocorrido_em       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT op_acabamento_tentativas_coerencia CHECK (
    (resultado = 'sucesso' AND op_id IS NOT NULL AND codigo_falha IS NULL)
    OR (resultado = 'falha' AND op_id IS NULL AND codigo_falha IS NOT NULL))
);

COMMENT ON TABLE public.op_acabamento_tentativas IS
  'db/108 (9.9.J): append-only finishing-OP attempt evidence. A falha row commits together with the surviving delivery and is the ONLY thing that unlocks a retry.';

CREATE INDEX IF NOT EXISTS op_acabamento_tentativas_entrega_idx
  ON public.op_acabamento_tentativas (origem_entrega_id, ocorrido_em DESC, id DESC);

-- ---------------------------------------------------------------------
-- 4. RLS and privileges for the two new tables
-- ---------------------------------------------------------------------
ALTER TABLE public.op_acabamento_comandos   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.op_acabamento_tentativas ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.op_acabamento_comandos   FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE public.op_acabamento_tentativas FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON SEQUENCE public.op_acabamento_comandos_id_seq   FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON SEQUENCE public.op_acabamento_tentativas_id_seq FROM PUBLIC, anon, authenticated, service_role;

GRANT SELECT ON TABLE public.op_acabamento_comandos   TO authenticated;
GRANT SELECT ON TABLE public.op_acabamento_tentativas TO authenticated;

DROP POLICY IF EXISTS op_acabamento_comandos_admin_select ON public.op_acabamento_comandos;
CREATE POLICY op_acabamento_comandos_admin_select
  ON public.op_acabamento_comandos FOR SELECT USING (public.is_admin());

DROP POLICY IF EXISTS op_acabamento_tentativas_admin_select ON public.op_acabamento_tentativas;
CREATE POLICY op_acabamento_tentativas_admin_select
  ON public.op_acabamento_tentativas FOR SELECT USING (public.is_admin());

CREATE OR REPLACE FUNCTION public.trg_op_acabamento_append_only_guard()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION 'op_acabamento_evidencia_imutavel' USING ERRCODE = '55000';
END;
$$;

DROP TRIGGER IF EXISTS op_acabamento_comandos_append_only ON public.op_acabamento_comandos;
CREATE TRIGGER op_acabamento_comandos_append_only
  BEFORE UPDATE OR DELETE ON public.op_acabamento_comandos
  FOR EACH ROW EXECUTE FUNCTION public.trg_op_acabamento_append_only_guard();

DROP TRIGGER IF EXISTS op_acabamento_tentativas_append_only ON public.op_acabamento_tentativas;
CREATE TRIGGER op_acabamento_tentativas_append_only
  BEFORE UPDATE OR DELETE ON public.op_acabamento_tentativas
  FOR EACH ROW EXECUTE FUNCTION public.trg_op_acabamento_append_only_guard();

-- ---------------------------------------------------------------------
-- 5. _op_acabamento_criar — the inner creation unit
--
-- OWNER-ONLY. Everything that can fail during creation lives here, so
-- the canonical writer can wrap exactly this call in the inner
-- subtransaction of 9.9.J and keep the delivery when it rolls back.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._op_acabamento_criar(
  p_entrega_id BIGINT,
  p_split_seq  SMALLINT,
  p_motivo     TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_entrega  public.entregas%ROWTYPE;
  v_op_id    BIGINT;
  v_lote_id  BIGINT;
  v_pedido   UUID;
  v_destino  BIGINT;
  v_ano      INTEGER;
  v_numero   INTEGER;
  v_nova     BIGINT;
  v_payload  JSONB;
  ei         RECORD;
BEGIN
  SELECT * INTO v_entrega FROM public.entregas WHERE id = p_entrega_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Entrega % nao encontrada', p_entrega_id;
  END IF;
  IF v_entrega.etapa <> 'cima' THEN
    RAISE EXCEPTION 'Entrega % nao e de tecelagem (etapa=%)', p_entrega_id, v_entrega.etapa;
  END IF;

  v_destino := v_entrega.destino_fornecedor_id;
  IF v_destino IS NULL THEN
    RAISE EXCEPTION 'Entrega % sem destino de latex', p_entrega_id;
  END IF;

  SELECT oi.op_id INTO v_op_id
    FROM public.entrega_itens e
    JOIN public.op_itens oi ON oi.id = e.op_item_id
   WHERE e.entrega_id = p_entrega_id
   LIMIT 1;
  IF v_op_id IS NULL THEN
    RAISE EXCEPTION 'Entrega % sem itens vinculados a OP de origem', p_entrega_id;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.entrega_itens
     WHERE entrega_id = p_entrega_id AND defeito = FALSE AND metros_entregues > 0
  ) THEN
    RAISE EXCEPTION 'Entrega % sem metros validos (sem defeito) para acabamento', p_entrega_id;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.entrega_itens e
      JOIN public.op_itens oi ON oi.id = e.op_item_id
     WHERE e.entrega_id = p_entrega_id AND e.defeito = FALSE
       AND e.metros_entregues > 0 AND oi.op_id IS DISTINCT FROM v_op_id
  ) THEN
    RAISE EXCEPTION 'Entrega % possui itens validos de mais de uma OP origem; acabamento exige origem unica', p_entrega_id;
  END IF;

  -- A Manta weaving OP never creates or enters Acabamento/Latex.
  IF EXISTS (
    SELECT 1 FROM public.op_itens oi JOIN public.modelos m ON m.id = oi.modelo_id
     WHERE oi.op_id = v_op_id AND m.tipo_produto = 'manta'
  ) THEN
    RAISE EXCEPTION 'OP % e de Manta (rota tecelagem-direta): nao gera Acabamento/Latex.', v_op_id;
  END IF;

  IF (SELECT count(DISTINCT m.tipo_produto)
        FROM public.op_itens oi JOIN public.modelos m ON m.id = oi.modelo_id
       WHERE oi.op_id = v_op_id) > 1 THEN
    RAISE EXCEPTION 'OP % nao e homogenea; geracao de Acabamento/Latex bloqueada.', v_op_id;
  END IF;

  SELECT o.lote_id, l.pedido_id INTO v_lote_id, v_pedido
    FROM public.ops o LEFT JOIN public.lotes l ON l.id = o.lote_id
   WHERE o.id = v_op_id;
  IF v_lote_id IS NULL OR v_pedido IS NULL THEN
    RAISE EXCEPTION 'Nao e possivel gerar OP de Acabamento/Latex: OP origem nao possui Pedido vinculado.';
  END IF;

  v_ano := EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER;
  v_numero := public.proximo_numero_op('latex', v_ano);

  INSERT INTO public.ops
    (numero, ano, status, tipo, origem_op_id, origem_entrega_id, split_seq, lote_id,
     destino_fornecedor_id, motivo_separacao, observacao)
  VALUES (
    v_numero, v_ano, 'aberta', 'latex', v_op_id, p_entrega_id, p_split_seq, v_lote_id,
    v_destino, p_motivo,
    CASE WHEN p_motivo IS NULL
         THEN 'OP de Acabamento/Latex gerada a partir da entrega ' || p_entrega_id || '.'
         ELSE 'Split excepcional da OP '
              || (SELECT numero || '/' || ano FROM public.ops WHERE id = v_op_id)
              || ' (tecelagem). Motivo: ' || p_motivo
              || '. Entrega origem: ' || p_entrega_id || '.'
    END)
  RETURNING id INTO v_nova;

  INSERT INTO public.op_fornecedores (op_id, fornecedor_id, etapa)
  VALUES (v_nova, v_destino, 'latex')
  ON CONFLICT (op_id, fornecedor_id, etapa) DO NOTHING;

  -- The existing N:1 link keeps its UNIQUE(entrega_id) meaning: one
  -- finishing OP per delivery. A duplicate attempt fails here and the
  -- caller's inner subtransaction rolls the creation back.
  INSERT INTO public.op_latex_entregas (op_latex_id, entrega_id)
  VALUES (v_nova, p_entrega_id);

  FOR ei IN
    SELECT oi.modelo_id AS modelo_id, SUM(e.metros_entregues) AS metros
      FROM public.entrega_itens e
      JOIN public.op_itens oi ON oi.id = e.op_item_id
     WHERE e.entrega_id = p_entrega_id AND e.defeito = FALSE AND e.metros_entregues > 0
     GROUP BY oi.modelo_id
  LOOP
    INSERT INTO public.op_itens (op_id, modelo_id, metros_pedidos)
    VALUES (v_nova, ei.modelo_id, ei.metros);
  END LOOP;

  v_payload := jsonb_build_object(
    'origem_op_id', v_op_id, 'entrega_id', p_entrega_id, 'nova_op_id', v_nova,
    'destino_fornecedor_id', v_destino, 'split_seq', p_split_seq, 'motivo', p_motivo);

  INSERT INTO public.op_eventos (op_id, tipo_evento, observacao, payload, criado_por)
  VALUES (v_nova, 'criacao_split',
          'OP de Acabamento/Latex criada a partir da entrega ' || p_entrega_id || '.',
          v_payload, auth.uid());

  INSERT INTO public.op_eventos (op_id, tipo_evento, observacao, payload, criado_por)
  VALUES (v_op_id, 'split_derivado',
          'Entrega ' || p_entrega_id || ' encaminhada para a OP de Acabamento/Latex '
            || v_numero || '/' || v_ano || '.',
          v_payload, auth.uid());

  RETURN jsonb_build_object(
    'op_latex_id', v_nova, 'numero', v_numero, 'ano', v_ano,
    'created', TRUE, 'split', p_motivo IS NOT NULL, 'split_seq', p_split_seq,
    'motivo', p_motivo);
END;
$$;

COMMENT ON FUNCTION public._op_acabamento_criar(BIGINT, SMALLINT, TEXT) IS
  'db/108 (9.9.J): OWNER-ONLY inner creation unit for a finishing OP. Everything that can fail lives here so the canonical writer can wrap exactly this call in its inner subtransaction and keep the delivery when it rolls back.';

-- ---------------------------------------------------------------------
-- 6. gerar_op_acabamento — THE single canonical writer (9.9.J)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.gerar_op_acabamento(
  p_entrega_id      BIGINT,
  p_idempotency_key TEXT,
  p_motivo          TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_ator      UUID := auth.uid();
  v_existente RECORD;
  v_payload   JSONB;
  v_hash      TEXT;
  v_seq       SMALLINT;
  v_tent      INTEGER;
  v_res       JSONB;
  v_code      TEXT;
  v_msg       TEXT;
BEGIN
  IF v_ator IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'sem_permissao' USING ERRCODE = '42501';
  END IF;
  IF p_idempotency_key IS NULL OR btrim(p_idempotency_key) = '' THEN
    RAISE EXCEPTION 'ACABAMENTO_CHAVE_OBRIGATORIA' USING ERRCODE = '22023';
  END IF;

  v_payload := jsonb_build_object(
    'entrega_id', p_entrega_id,
    'motivo', COALESCE(btrim(p_motivo), ''));
  v_hash := md5(v_payload::TEXT);

  -- REPLAY: same key + identical payload returns the stored result and
  -- the stored split identity, and creates nothing.
  SELECT * INTO v_existente
    FROM public.op_acabamento_comandos
   WHERE idempotency_namespace = 'op_acabamento_v1'
     AND ator_id = v_ator
     AND idempotency_key = btrim(p_idempotency_key);
  IF FOUND THEN
    IF v_existente.comando_hash = v_hash THEN
      RETURN v_existente.resultado;
    END IF;
    RETURN jsonb_build_object('ok', false, 'codigo', 'comando_conflitante');
  END IF;

  -- The split identity is assigned ONCE, under a FOR UPDATE lock on the
  -- delivery, as the next value for that delivery.
  BEGIN
    SET LOCAL lock_timeout = '5s';
    PERFORM 1 FROM public.entregas WHERE id = p_entrega_id FOR UPDATE;
  EXCEPTION WHEN lock_not_available THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'concorrencia_ocupada');
  END;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Entrega % nao encontrada', p_entrega_id;
  END IF;

  SELECT COALESCE(MAX(o.split_seq), -1)::SMALLINT + 1 INTO v_seq
    FROM public.ops o
   WHERE o.origem_entrega_id = p_entrega_id
     AND o.tipo IN ('latex', 'acabamento');

  SELECT COALESCE(MAX(t.tentativa_seq), 0) + 1 INTO v_tent
    FROM public.op_acabamento_tentativas t
   WHERE t.origem_entrega_id = p_entrega_id;

  -- THE INNER SUBTRANSACTION (9.9.J). No autonomous transaction: on
  -- failure only the creation is rolled back; the caller's delivery and
  -- the attempt evidence below commit together.
  BEGIN
    v_res := public._op_acabamento_criar(p_entrega_id, v_seq, NULLIF(btrim(COALESCE(p_motivo, '')), ''));
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_code = RETURNED_SQLSTATE, v_msg = MESSAGE_TEXT;

    INSERT INTO public.op_acabamento_tentativas
      (origem_entrega_id, split_seq, resultado, codigo_falha, mensagem,
       ator_id, processo, tentativa_seq, op_id)
    VALUES (p_entrega_id, v_seq, 'falha', v_code, v_msg,
            v_ator, 'gerar_op_acabamento', v_tent, NULL);

    v_res := jsonb_build_object(
      'ok', false, 'codigo', 'ACABAMENTO_CRIACAO_FALHOU',
      'sqlstate', v_code, 'mensagem', v_msg,
      'entrega_id', p_entrega_id, 'split_seq', v_seq,
      'recuperavel', TRUE);

    INSERT INTO public.op_acabamento_comandos
      (idempotency_namespace, ator_id, idempotency_key, origem_entrega_id,
       split_seq, comando_payload, comando_hash, resultado)
    VALUES ('op_acabamento_v1', v_ator, btrim(p_idempotency_key), p_entrega_id,
            v_seq, v_payload, v_hash, v_res);

    RETURN v_res;
  END;

  INSERT INTO public.op_acabamento_tentativas
    (origem_entrega_id, split_seq, resultado, codigo_falha, mensagem,
     ator_id, processo, tentativa_seq, op_id)
  VALUES (p_entrega_id, v_seq, 'sucesso', NULL, NULL,
          v_ator, 'gerar_op_acabamento', v_tent, (v_res ->> 'op_latex_id')::BIGINT);

  v_res := v_res || jsonb_build_object('ok', TRUE);

  INSERT INTO public.op_acabamento_comandos
    (idempotency_namespace, ator_id, idempotency_key, origem_entrega_id,
     split_seq, comando_payload, comando_hash, resultado)
  VALUES ('op_acabamento_v1', v_ator, btrim(p_idempotency_key), p_entrega_id,
          v_seq, v_payload, v_hash, v_res);

  RETURN v_res;
END;
$$;

COMMENT ON FUNCTION public.gerar_op_acabamento(BIGINT, TEXT, TEXT) IS
  'db/108 (9.9.J): THE single canonical finishing-OP writer. No autonomous transaction; the creation runs in an inner subtransaction so a failure preserves the delivery and commits a falha attempt row with it. Same idempotency key returns the same result and the same split identity. The normal path passes no motive.';

-- ---------------------------------------------------------------------
-- 7. pode_recuperar_op_acabamento (9.9.J)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pode_recuperar_op_acabamento(p_entrega_id BIGINT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (SELECT 1 FROM public.entregas e WHERE e.id = p_entrega_id)
     AND NOT EXISTS (SELECT 1 FROM public.ops o
                      WHERE o.origem_entrega_id = p_entrega_id
                        AND o.tipo IN ('latex', 'acabamento'))
     AND EXISTS (SELECT 1 FROM public.op_acabamento_tentativas t
                  WHERE t.origem_entrega_id = p_entrega_id
                    AND t.resultado = 'falha');
$$;

COMMENT ON FUNCTION public.pode_recuperar_op_acabamento(BIGINT) IS
  'db/108 (9.9.J): true only when the delivery is committed, NO canonical finishing OP exists for the identity, and a PROVED falha attempt row exists. Retry is permitted only after proved failure.';

-- ---------------------------------------------------------------------
-- 8. gerar_op_latex_split — retained compatibility wrapper (9.9.J)
--
-- EXACT signature retained. It derives a stable idempotency key from the
-- delivery and the motive, delegates to the canonical writer, and
-- re-raises refusals so its existing callers keep the contract they have
-- today. It is NOT dropped in this release and no free-form manual
-- finishing-OP creation path exists beside it.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.gerar_op_latex_split(
  p_entrega_id BIGINT,
  p_motivo     TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_motivo   TEXT;
  v_res      JSONB;
  v_existing BIGINT;
  v_num      INTEGER;
  v_ano      INTEGER;
BEGIN
  IF p_motivo IS NULL OR btrim(p_motivo) = '' THEN
    RAISE EXCEPTION 'Motivo de separacao e obrigatorio para split. Use gerar_op_latex para consolidacao default.';
  END IF;
  v_motivo := btrim(p_motivo);

  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Apenas administradores podem criar split de OP latex.';
  END IF;

  -- Preserved pre-existing behaviour: a delivery already linked to a
  -- finishing OP reports that fact instead of creating a second one.
  SELECT ole.op_latex_id, o.numero, o.ano
    INTO v_existing, v_num, v_ano
    FROM public.op_latex_entregas ole
    JOIN public.ops o ON o.id = ole.op_latex_id
   WHERE ole.entrega_id = p_entrega_id;
  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object(
      'op_latex_id', v_existing, 'numero', v_num, 'ano', v_ano,
      'created', false, 'split', false, 'already_linked', true,
      'erro', 'Entrega ja vinculada a OP ' || v_num || '/' || v_ano || '. Nao foi criado split.');
  END IF;

  v_res := public.gerar_op_acabamento(
             p_entrega_id,
             'legacy_split|entrega=' || p_entrega_id::TEXT || '|motivo=' || md5(v_motivo),
             v_motivo);

  -- Re-raise a creation refusal so the historical RAISE contract holds.
  IF COALESCE((v_res ->> 'ok')::BOOLEAN, FALSE) IS NOT TRUE
     AND (v_res ? 'codigo') THEN
    RAISE EXCEPTION '%', COALESCE(v_res ->> 'mensagem', v_res ->> 'codigo');
  END IF;

  RETURN v_res - 'ok';
END;
$$;

COMMENT ON FUNCTION public.gerar_op_latex_split(BIGINT, TEXT) IS
  'db/108 (9.9.J): RETAINED compatibility wrapper with its exact original signature. Delegates to gerar_op_acabamento with a derived idempotency key and preserves the original success payload and RAISE-on-refusal contract. Not dropped in this release.';

-- ---------------------------------------------------------------------
-- 9. Explicit ownership and privileges
-- ---------------------------------------------------------------------
ALTER FUNCTION public.trg_op_acabamento_append_only_guard()        OWNER TO postgres;
ALTER FUNCTION public._op_acabamento_criar(BIGINT, SMALLINT, TEXT) OWNER TO postgres;
ALTER FUNCTION public.gerar_op_acabamento(BIGINT, TEXT, TEXT)      OWNER TO postgres;
ALTER FUNCTION public.pode_recuperar_op_acabamento(BIGINT)         OWNER TO postgres;
ALTER FUNCTION public.gerar_op_latex_split(BIGINT, TEXT)           OWNER TO postgres;

REVOKE ALL ON FUNCTION public.trg_op_acabamento_append_only_guard()
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public._op_acabamento_criar(BIGINT, SMALLINT, TEXT)
  FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.gerar_op_acabamento(BIGINT, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.gerar_op_acabamento(BIGINT, TEXT, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.pode_recuperar_op_acabamento(BIGINT)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.pode_recuperar_op_acabamento(BIGINT) TO authenticated;

-- The wrapper keeps EXACTLY the privileges it holds today.
REVOKE ALL ON FUNCTION public.gerar_op_latex_split(BIGINT, TEXT)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.gerar_op_latex_split(BIGINT, TEXT) TO authenticated;

-- ---------------------------------------------------------------------
-- 10. Migration-time invariants
-- ---------------------------------------------------------------------
DO $db108$
BEGIN
  -- 10.1 Server-owned identity columns with safe defaults.
  PERFORM 1 FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'ops'
     AND column_name = 'split_seq' AND is_nullable = 'NO' AND column_default = '0';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'db/108: ops.split_seq is missing its NOT NULL DEFAULT 0 contract';
  END IF;

  -- 10.2 The unique finishing identity exists.
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = 'public'
      AND indexname = 'ops_acabamento_origem_uidx'
  ) THEN
    RAISE EXCEPTION 'db/108: the unique finishing identity index is missing';
  END IF;

  -- 10.3 NO autonomous-transaction claim anywhere in this migration.
  IF EXISTS (
    SELECT 1 FROM pg_proc p
     WHERE p.pronamespace = 'public'::regnamespace
       AND p.proname IN ('gerar_op_acabamento', '_op_acabamento_criar',
                         'pode_recuperar_op_acabamento', 'gerar_op_latex_split')
       -- Real mechanisms only: the words "autonomous transaction" appear
       -- in this migration's own explanatory comments.
       AND (p.prosrc ILIKE '%dblink%' OR p.prosrc ILIKE '%pg_background%'
            OR p.prosrc ILIKE '%pragma autonomous%')
  ) THEN
    RAISE EXCEPTION 'db/108: no autonomous-transaction mechanism may be used (9.9.J)';
  END IF;

  -- 10.4 The compatibility wrapper kept its exact signature.
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
     WHERE p.pronamespace = 'public'::regnamespace
       AND p.proname = 'gerar_op_latex_split'
       AND pg_get_function_identity_arguments(p.oid) = 'p_entrega_id bigint, p_motivo text'
  ) THEN
    RAISE EXCEPTION 'db/108: gerar_op_latex_split must retain its exact signature';
  END IF;
  IF NOT has_function_privilege('authenticated', 'public.gerar_op_latex_split(bigint,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'db/108: the compatibility wrapper lost its authenticated grant';
  END IF;

  -- 10.5 Owner-only inner unit is unreachable by every client role.
  IF has_function_privilege('authenticated', 'public._op_acabamento_criar(bigint,smallint,text)', 'EXECUTE')
     OR has_function_privilege('anon', 'public._op_acabamento_criar(bigint,smallint,text)', 'EXECUTE')
     OR has_function_privilege('service_role', 'public._op_acabamento_criar(bigint,smallint,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'db/108: the inner creation unit is reachable by a client role';
  END IF;

  -- 10.6 Evidence tables carry no client mutation privilege.
  IF has_table_privilege('authenticated', 'public.op_acabamento_comandos', 'INSERT')
     OR has_table_privilege('authenticated', 'public.op_acabamento_tentativas', 'INSERT')
     OR has_table_privilege('anon', 'public.op_acabamento_tentativas', 'SELECT') THEN
    RAISE EXCEPTION 'db/108: finishing evidence privileges are too wide';
  END IF;

  -- 10.7 The cutover remains untouched.
  PERFORM 1 FROM public.ordem_compra_cutover
   WHERE id = 1 AND status = 'legacy_active' AND read_authority = 'flat';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'db/108: ordem_compra_cutover is not legacy_active/flat';
  END IF;
END
$db108$;

COMMIT;
