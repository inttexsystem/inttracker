-- =====================================================================
-- db/109 — TAPETE EXPEDITION REVERSAL AND DELIVERY CORRECTION
--
-- NATIVE-RECEIPT-COORDINATED-RELEASE-P1-ADDITIVE-BACKEND-R1, phase P1.
-- Implements PEDIDO_DERIVED_LIFECYCLE_RECOVERY_PLAN.md section 9.9.K.
--
-- ADDITIVE. One shared owner-only primitive, two guarded public writers
-- under new names, and a widened idempotency-namespace CHECK on the
-- EXISTING public.expedicao_comandos (F10) so the two new namespaces are
-- admissible. The Manta route writers of db/86 and db/87 are untouched.
--
-- MEASURED FINISHING OUTPUT REMAINS THE AUTHORITY. Finished availability
-- is measured output minus the metres currently released; this migration
-- only ever moves expedicao_itens.metros_liberados and
-- expedicao_itens.metros_entregues. NO standalone stock balance is
-- edited anywhere below.
--
-- LOCK ORDER (9.9.B), identical to the reversal writer, the correction
-- writer and cancellation, so the three serialize on the same pedidos
-- row: pedidos -> expedicoes -> expedicao_itens (ASC id).
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. Admit the two new command namespaces on the existing store
-- ---------------------------------------------------------------------
ALTER TABLE public.expedicao_comandos
  DROP CONSTRAINT IF EXISTS expedicao_comandos_idempotency_namespace_check;

ALTER TABLE public.expedicao_comandos
  ADD CONSTRAINT expedicao_comandos_idempotency_namespace_check
  CHECK (idempotency_namespace = ANY (ARRAY[
    'manta_release_v1',
    'manta_reversal_v1',
    'expedicao_estorno_tapete_v1',
    'expedicao_entrega_correcao_v1'
  ]));

COMMENT ON CONSTRAINT expedicao_comandos_idempotency_namespace_check ON public.expedicao_comandos IS
  'db/109 (9.9.K): widened additively to admit the Tapete reversal and delivery-correction namespaces. The two pre-existing Manta namespaces are unchanged.';

-- ---------------------------------------------------------------------
-- 2. _expedicao_estorno_aplicar — the shared internal primitive (9.9.K)
--
-- OWNER-ONLY. Carries the invariants for BOTH routes. Validates the
-- COMPLETE payload before any write, so a mid-loop refusal can never
-- leave rows already written — the PL/pgSQL batch-RETURN hazard.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._expedicao_estorno_aplicar(
  p_expedicao_id BIGINT,
  p_linhas       JSONB,
  p_motivo       TEXT,
  p_rota         TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_linha    RECORD;
  v_item     RECORD;
  v_afetados INTEGER := 0;
  v_removidos INTEGER := 0;
  v_ops      BIGINT[];
  v_op       BIGINT;
BEGIN
  IF p_linhas IS NULL OR jsonb_typeof(p_linhas) <> 'array'
     OR jsonb_array_length(p_linhas) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'ESTORNO_PAYLOAD_INVALIDO');
  END IF;

  -- ---- VALIDATE EVERYTHING FIRST. No write happens in this loop. ----
  FOR v_linha IN
    SELECT (e.item ->> 'op_item_id')::BIGINT AS op_item_id,
           (e.item ->> 'metros')::NUMERIC(10,2) AS metros
      FROM jsonb_array_elements(p_linhas) AS e(item)
  LOOP
    IF v_linha.op_item_id IS NULL OR v_linha.metros IS NULL OR v_linha.metros <= 0 THEN
      RETURN jsonb_build_object('ok', false, 'codigo', 'ESTORNO_PAYLOAD_INVALIDO',
                                'op_item_id', v_linha.op_item_id);
    END IF;

    SELECT ei.* INTO v_item
      FROM public.expedicao_itens ei
     WHERE ei.expedicao_id = p_expedicao_id AND ei.op_item_id = v_linha.op_item_id;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('ok', false, 'codigo', 'ESTORNO_ITEM_NAO_ENCONTRADO',
                                'op_item_id', v_linha.op_item_id);
    END IF;

    -- Released guard (9.9.K).
    IF v_linha.metros > v_item.metros_liberados THEN
      RETURN jsonb_build_object('ok', false, 'codigo', 'ESTORNO_ACIMA_DO_LIBERADO',
                                'op_item_id', v_linha.op_item_id,
                                'metros', v_linha.metros,
                                'metros_liberados', v_item.metros_liberados);
    END IF;

    -- Delivered guard (9.9.K): never reverse below what is delivered.
    IF v_item.metros_liberados - v_linha.metros < v_item.metros_entregues THEN
      RETURN jsonb_build_object('ok', false, 'codigo', 'ESTORNO_ABAIXO_DO_ENTREGUE',
                                'op_item_id', v_linha.op_item_id,
                                'metros', v_linha.metros,
                                'metros_entregues', v_item.metros_entregues);
    END IF;
  END LOOP;

  -- ---- APPLY. Every refusal path is already behind us. ----
  SELECT array_agg(DISTINCT oi.op_id) INTO v_ops
    FROM jsonb_array_elements(p_linhas) AS e(item)
    JOIN public.op_itens oi ON oi.id = (e.item ->> 'op_item_id')::BIGINT;

  FOR v_linha IN
    SELECT (e.item ->> 'op_item_id')::BIGINT AS op_item_id,
           (e.item ->> 'metros')::NUMERIC(10,2) AS metros
      FROM jsonb_array_elements(p_linhas) AS e(item)
      ORDER BY 1
  LOOP
    SELECT ei.* INTO v_item
      FROM public.expedicao_itens ei
     WHERE ei.expedicao_id = p_expedicao_id AND ei.op_item_id = v_linha.op_item_id;

    IF v_item.metros_liberados - v_linha.metros = 0 THEN
      -- expedicao_itens requires metros_liberados > 0, so a FULL reversal
      -- removes the release line. It is only reachable when nothing of it
      -- was delivered, which the delivered guard above already proved.
      DELETE FROM public.expedicao_itens ei
       WHERE ei.expedicao_id = p_expedicao_id AND ei.op_item_id = v_linha.op_item_id;
      v_removidos := v_removidos + 1;
    ELSE
      UPDATE public.expedicao_itens ei
         SET metros_liberados = ei.metros_liberados - v_linha.metros,
             atualizado_em    = now()
       WHERE ei.expedicao_id = p_expedicao_id AND ei.op_item_id = v_linha.op_item_id;
      v_afetados := v_afetados + 1;
    END IF;
  END LOOP;

  -- One op_eventos row per affected OP (9.9.K).
  IF v_ops IS NOT NULL THEN
    FOREACH v_op IN ARRAY v_ops LOOP
      INSERT INTO public.op_eventos (op_id, tipo_evento, observacao, payload, criado_por)
      VALUES (v_op, 'expedicao_estornada',
              'Estorno de expedicao (' || p_rota || '). Motivo: ' || COALESCE(p_motivo, '-'),
              jsonb_build_object('expedicao_id', p_expedicao_id, 'rota', p_rota,
                                 'linhas', p_linhas, 'motivo', p_motivo),
              auth.uid());
    END LOOP;
  END IF;

  PERFORM public.recalcular_status_expedicao(p_expedicao_id);

  RETURN jsonb_build_object('ok', true, 'expedicao_id', p_expedicao_id, 'rota', p_rota,
                            'itens_ajustados', v_afetados, 'itens_removidos', v_removidos);
END;
$$;

COMMENT ON FUNCTION public._expedicao_estorno_aplicar(BIGINT, JSONB, TEXT, TEXT) IS
  'db/109 (9.9.K): OWNER-ONLY shared expedition-reversal primitive carrying the released and delivered invariants for both routes. Validates the COMPLETE payload before any write. Edits no standalone stock balance.';

-- ---------------------------------------------------------------------
-- 3. estornar_expedicao_tapete_parcial (9.9.K)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.estornar_expedicao_tapete_parcial(
  p_expedicao_id    BIGINT,
  p_itens           JSONB,
  p_motivo          TEXT,
  p_idempotency_key TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_ator      UUID := auth.uid();
  v_pedido    UUID;
  v_latex     BIGINT;
  v_payload   JSONB;
  v_hash      TEXT;
  v_existente RECORD;
  v_res       JSONB;
BEGIN
  IF v_ator IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'sem_permissao' USING ERRCODE = '42501';
  END IF;

  v_payload := jsonb_build_object('expedicao_id', p_expedicao_id, 'itens', p_itens,
                                  'motivo', COALESCE(btrim(p_motivo), ''));
  v_hash := md5(v_payload::TEXT);

  IF p_idempotency_key IS NOT NULL AND btrim(p_idempotency_key) <> '' THEN
    SELECT * INTO v_existente FROM public.expedicao_comandos
     WHERE idempotency_namespace = 'expedicao_estorno_tapete_v1'
       AND ator_id = v_ator AND idempotency_key = btrim(p_idempotency_key);
    IF FOUND THEN
      IF v_existente.comando_hash = v_hash THEN
        RETURN v_existente.resultado;      -- duplicate: stored result, no write
      END IF;
      RETURN jsonb_build_object('ok', false, 'codigo', 'comando_conflitante');
    END IF;
  END IF;

  SELECT e.pedido_id, e.op_latex_id INTO v_pedido, v_latex
    FROM public.expedicoes e WHERE e.id = p_expedicao_id;
  IF v_pedido IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'EXPEDICAO_NAO_ENCONTRADA');
  END IF;

  -- The Tapete route is the finishing (latex) source; the Manta route
  -- keeps its own accepted writer (db/87) and is not reachable here.
  IF v_latex IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'EXPEDICAO_ROTA_INVALIDA',
                              'detalhe', 'rota Tapete exige origem de acabamento');
  END IF;

  BEGIN
    SET LOCAL lock_timeout = '5s';
    PERFORM 1 FROM public.pedidos WHERE id = v_pedido FOR UPDATE;
    PERFORM 1 FROM public.expedicoes WHERE id = p_expedicao_id FOR UPDATE;
    PERFORM 1 FROM public.expedicao_itens
     WHERE expedicao_id = p_expedicao_id ORDER BY id FOR UPDATE;
  EXCEPTION WHEN lock_not_available THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'concorrencia_ocupada');
  END;

  v_res := public._expedicao_estorno_aplicar(p_expedicao_id, p_itens, p_motivo, 'tapete');

  IF COALESCE((v_res ->> 'ok')::BOOLEAN, FALSE) THEN
    PERFORM public._pedido_status_recalcular(v_pedido, 'estorno_expedicao_tapete');

    IF p_idempotency_key IS NOT NULL AND btrim(p_idempotency_key) <> '' THEN
      INSERT INTO public.expedicao_comandos
        (idempotency_namespace, ator_id, idempotency_key, comando_payload, comando_hash, resultado)
      VALUES ('expedicao_estorno_tapete_v1', v_ator, btrim(p_idempotency_key),
              v_payload, v_hash, v_res);
    END IF;
  END IF;

  RETURN v_res;
END;
$$;

COMMENT ON FUNCTION public.estornar_expedicao_tapete_parcial(BIGINT, JSONB, TEXT, TEXT) IS
  'db/109 (9.9.K): partial Tapete expedition reversal. Refuses above the released quantity and below the delivered quantity. Duplicate command with an identical payload returns the stored result; a conflicting payload is refused as comando_conflitante.';

-- ---------------------------------------------------------------------
-- 4. corrigir_entrega_expedicao (9.9.K)
--
-- expedicao_itens.metros_entregues REMAINS the delivered projection and
-- is rewritten by this writer only; the Pedido completion condition is
-- then recomputed from the full item set. The PRIOR per-item value is
-- stored in comando_payload so the history is preserved.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.corrigir_entrega_expedicao(
  p_expedicao_id    BIGINT,
  p_itens           JSONB,
  p_motivo          TEXT,
  p_idempotency_key TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_ator      UUID := auth.uid();
  v_pedido    UUID;
  v_payload   JSONB;
  v_hash      TEXT;
  v_existente RECORD;
  v_linha     RECORD;
  v_item      RECORD;
  v_anterior  JSONB := '[]'::JSONB;
  v_aplicados INTEGER := 0;
  v_status    JSONB;
  v_res       JSONB;
BEGIN
  IF v_ator IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'sem_permissao' USING ERRCODE = '42501';
  END IF;

  IF p_itens IS NULL OR jsonb_typeof(p_itens) <> 'array'
     OR jsonb_array_length(p_itens) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'CORRECAO_PAYLOAD_INVALIDO');
  END IF;

  SELECT e.pedido_id INTO v_pedido FROM public.expedicoes e WHERE e.id = p_expedicao_id;
  IF v_pedido IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'EXPEDICAO_NAO_ENCONTRADA');
  END IF;

  BEGIN
    SET LOCAL lock_timeout = '5s';
    PERFORM 1 FROM public.pedidos WHERE id = v_pedido FOR UPDATE;
    PERFORM 1 FROM public.expedicoes WHERE id = p_expedicao_id FOR UPDATE;
    PERFORM 1 FROM public.expedicao_itens
     WHERE expedicao_id = p_expedicao_id ORDER BY id FOR UPDATE;
  EXCEPTION WHEN lock_not_available THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'concorrencia_ocupada');
  END;

  -- The prior delivered values become part of the command payload, so
  -- the correction preserves the history it overwrites.
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'op_item_id', ei.op_item_id, 'metros_entregues', ei.metros_entregues)
           ORDER BY ei.op_item_id), '[]'::JSONB)
    INTO v_anterior
    FROM public.expedicao_itens ei
   WHERE ei.expedicao_id = p_expedicao_id;

  v_payload := jsonb_build_object(
    'expedicao_id', p_expedicao_id, 'itens', p_itens,
    'motivo', COALESCE(btrim(p_motivo), ''), 'anterior', v_anterior);
  v_hash := md5(v_payload::TEXT);

  IF p_idempotency_key IS NOT NULL AND btrim(p_idempotency_key) <> '' THEN
    SELECT * INTO v_existente FROM public.expedicao_comandos
     WHERE idempotency_namespace = 'expedicao_entrega_correcao_v1'
       AND ator_id = v_ator AND idempotency_key = btrim(p_idempotency_key);
    IF FOUND THEN
      IF v_existente.comando_hash = v_hash THEN
        RETURN v_existente.resultado;
      END IF;
      RETURN jsonb_build_object('ok', false, 'codigo', 'comando_conflitante');
    END IF;
  END IF;

  -- VALIDATE THE WHOLE PAYLOAD BEFORE ANY WRITE.
  FOR v_linha IN
    SELECT (e.item ->> 'op_item_id')::BIGINT AS op_item_id,
           (e.item ->> 'metros_entregues')::NUMERIC(10,2) AS metros
      FROM jsonb_array_elements(p_itens) AS e(item)
  LOOP
    SELECT ei.* INTO v_item
      FROM public.expedicao_itens ei
     WHERE ei.expedicao_id = p_expedicao_id AND ei.op_item_id = v_linha.op_item_id;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('ok', false, 'codigo', 'CORRECAO_ITEM_NAO_ENCONTRADO',
                                'op_item_id', v_linha.op_item_id);
    END IF;
    IF v_linha.metros IS NULL OR v_linha.metros < 0
       OR v_linha.metros > v_item.metros_liberados THEN
      RETURN jsonb_build_object('ok', false, 'codigo', 'CORRECAO_QUANTIDADE_INVALIDA',
                                'op_item_id', v_linha.op_item_id,
                                'metros_entregues', v_linha.metros,
                                'metros_liberados', v_item.metros_liberados);
    END IF;
  END LOOP;

  FOR v_linha IN
    SELECT (e.item ->> 'op_item_id')::BIGINT AS op_item_id,
           (e.item ->> 'metros_entregues')::NUMERIC(10,2) AS metros
      FROM jsonb_array_elements(p_itens) AS e(item)
      ORDER BY 1
  LOOP
    UPDATE public.expedicao_itens ei
       SET metros_entregues = v_linha.metros, atualizado_em = now()
     WHERE ei.expedicao_id = p_expedicao_id AND ei.op_item_id = v_linha.op_item_id;
    v_aplicados := v_aplicados + 1;
  END LOOP;

  PERFORM public.recalcular_status_expedicao(p_expedicao_id);

  -- D1 recomputation: cancelled stays cancelled; complete -> entregue;
  -- incomplete non-cancelled -> produzindo; never confirmado.
  v_status := public._pedido_status_recalcular(v_pedido, 'correcao_entrega_expedicao');

  v_res := jsonb_build_object(
    'ok', true, 'expedicao_id', p_expedicao_id, 'itens_corrigidos', v_aplicados,
    'pedido_id', v_pedido, 'pedido_status', v_status ->> 'status',
    'anterior', v_anterior);

  IF p_idempotency_key IS NOT NULL AND btrim(p_idempotency_key) <> '' THEN
    INSERT INTO public.expedicao_comandos
      (idempotency_namespace, ator_id, idempotency_key, comando_payload, comando_hash, resultado)
    VALUES ('expedicao_entrega_correcao_v1', v_ator, btrim(p_idempotency_key),
            v_payload, v_hash, v_res);
  END IF;

  RETURN v_res;
END;
$$;

COMMENT ON FUNCTION public.corrigir_entrega_expedicao(BIGINT, JSONB, TEXT, TEXT) IS
  'db/109 (9.9.K): delivery correction. Rewrites the metros_entregues projection under exact guards and recomputes the Pedido through _pedido_status_recalcular, so an incomplete non-cancelled Pedido returns from entregue to produzindo. The prior values are preserved in the command payload.';

-- ---------------------------------------------------------------------
-- 5. Explicit ownership and privileges
-- ---------------------------------------------------------------------
ALTER FUNCTION public._expedicao_estorno_aplicar(BIGINT, JSONB, TEXT, TEXT)          OWNER TO postgres;
ALTER FUNCTION public.estornar_expedicao_tapete_parcial(BIGINT, JSONB, TEXT, TEXT)   OWNER TO postgres;
ALTER FUNCTION public.corrigir_entrega_expedicao(BIGINT, JSONB, TEXT, TEXT)          OWNER TO postgres;

REVOKE ALL ON FUNCTION public._expedicao_estorno_aplicar(BIGINT, JSONB, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.estornar_expedicao_tapete_parcial(BIGINT, JSONB, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.estornar_expedicao_tapete_parcial(BIGINT, JSONB, TEXT, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.corrigir_entrega_expedicao(BIGINT, JSONB, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.corrigir_entrega_expedicao(BIGINT, JSONB, TEXT, TEXT) TO authenticated;

-- ---------------------------------------------------------------------
-- 6. Migration-time invariants
-- ---------------------------------------------------------------------
DO $db109$
BEGIN
  -- 6.1 The widened namespace CHECK keeps both Manta namespaces.
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.expedicao_comandos'::regclass
       AND conname = 'expedicao_comandos_idempotency_namespace_check'
       AND pg_get_constraintdef(oid) LIKE '%manta_release_v1%'
       AND pg_get_constraintdef(oid) LIKE '%manta_reversal_v1%'
       AND pg_get_constraintdef(oid) LIKE '%expedicao_estorno_tapete_v1%'
       AND pg_get_constraintdef(oid) LIKE '%expedicao_entrega_correcao_v1%'
  ) THEN
    RAISE EXCEPTION 'db/109: the expedicao_comandos namespace CHECK was not widened additively';
  END IF;

  -- 6.2 The owner-only primitive is unreachable by every client role.
  IF has_function_privilege('authenticated', 'public._expedicao_estorno_aplicar(bigint,jsonb,text,text)', 'EXECUTE')
     OR has_function_privilege('anon', 'public._expedicao_estorno_aplicar(bigint,jsonb,text,text)', 'EXECUTE')
     OR has_function_privilege('service_role', 'public._expedicao_estorno_aplicar(bigint,jsonb,text,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'db/109: the shared reversal primitive is reachable by a client role';
  END IF;

  -- 6.3 The two public writers are executable by authenticated only.
  IF NOT has_function_privilege('authenticated', 'public.estornar_expedicao_tapete_parcial(bigint,jsonb,text,text)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.corrigir_entrega_expedicao(bigint,jsonb,text,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'db/109: a public expedition writer is not executable by authenticated';
  END IF;
  IF has_function_privilege('anon', 'public.corrigir_entrega_expedicao(bigint,jsonb,text,text)', 'EXECUTE')
     OR has_function_privilege('service_role', 'public.corrigir_entrega_expedicao(bigint,jsonb,text,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'db/109: corrigir_entrega_expedicao must not be reachable by anon or service_role';
  END IF;

  -- 6.4 The accepted Manta writers are NOT replaced by this migration.
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace
      AND p.proname = 'estornar_expedicao_manta_parcial'
  ) THEN
    RAISE EXCEPTION 'db/109: the accepted Manta reversal writer disappeared';
  END IF;

  -- 6.5 No standalone stock balance is edited by the new objects.
  IF EXISTS (
    SELECT 1 FROM pg_proc p
     WHERE p.pronamespace = 'public'::regnamespace
       AND p.proname IN ('_expedicao_estorno_aplicar', 'estornar_expedicao_tapete_parcial',
                         'corrigir_entrega_expedicao')
       AND p.prosrc ~ 'saldo_fios'
  ) THEN
    RAISE EXCEPTION 'db/109: an expedition writer references a standalone stock balance';
  END IF;

  -- 6.6 The cutover remains untouched.
  PERFORM 1 FROM public.ordem_compra_cutover
   WHERE id = 1 AND status = 'legacy_active' AND read_authority = 'flat';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'db/109: ordem_compra_cutover is not legacy_active/flat';
  END IF;
END
$db109$;

COMMIT;
