-- =====================================================================
-- db/105 — PEDIDO STATUS AUTHORITY, D7 CANCELLATION AND PLANNING RELEASE
--
-- NATIVE-RECEIPT-COORDINATED-RELEASE-P1-ADDITIVE-BACKEND-R1, phase P1.
-- Implements PEDIDO_DERIVED_LIFECYCLE_RECOVERY_PLAN.md sections 9.9.L
-- (Pedido status authority) and 9.9.M (D7 cancellation compensation).
--
-- ADDITIVE. New columns with safe defaults, new indexes, new owner-only
-- helpers and new public RPCs under new names. NO existing application
-- call site is changed by this migration.
--
-- DIRECT-DML CONTAINMENT IS NOT HERE. Section 9.9.L.2 (the grant
-- narrowing), ruling TD2 (INSERT/DELETE authority) and the
-- trg_fato_protegido_fence trigger all belong to db/106 and phase P4.
-- This migration revokes nothing and installs no fence: an authenticated
-- client keeps exactly the direct privileges it has today.
--
-- WHAT IS NARROWED, AND WHY IT CHANGES NO REACHABLE BEHAVIOUR.
-- D7 releases live planning balance WITHOUT physical deletion: a live
-- row gains cancelado_em / cancelado_por / cancelamento_motivo, and the
-- active-planning index and the balance readers are narrowed from
--     gerado_em IS NULL
-- to
--     gerado_em IS NULL AND cancelado_em IS NULL
-- cancelado_em is a NEW nullable column with no default, so it is NULL on
-- every row that exists before this migration and on every row any
-- existing writer creates. The narrowed predicate is therefore provably
-- equivalent to the old one for all pre-P1 data and for every writer
-- other than cancelar_pedido, which is new. The migration asserts that
-- equivalence below.
--
-- The three planning writers re-declared in section 4 are reproduced
-- from their accepted db/100 bodies with EXACTLY this one textual
-- substitution applied and no other change. aplicar_planejamento_rapido
-- MUST be re-declared: its ON CONFLICT clause names the partial index
-- predicate and would no longer match the narrowed index.
--
-- public.excluir_ordem_compra is DELIBERATELY NOT TOUCHED — the P1
-- additivity contract forbids replacing it. Its two live-row lookups
-- keep the wider predicate; the residual interaction is recorded as
-- non-blocking debt by this phase's report, and it is unreachable in
-- practice because planning writes for a cancelled Pedido are refused.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. Typed planning-release fields (D7, 9.9.M step 6)
-- ---------------------------------------------------------------------
ALTER TABLE public.necessidade_compra_planejamento
  ADD COLUMN IF NOT EXISTS cancelado_em        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancelado_por       UUID,
  ADD COLUMN IF NOT EXISTS cancelamento_motivo TEXT;

DO $db105_chk$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.necessidade_compra_planejamento'::regclass
       AND conname = 'planejamento_cancelamento_completo_chk'
  ) THEN
    ALTER TABLE public.necessidade_compra_planejamento
      ADD CONSTRAINT planejamento_cancelamento_completo_chk
      CHECK (
        (cancelado_em IS NULL AND cancelado_por IS NULL AND cancelamento_motivo IS NULL)
        OR (cancelado_em IS NOT NULL AND cancelado_por IS NOT NULL)
      );
  END IF;
END
$db105_chk$;

COMMENT ON COLUMN public.necessidade_compra_planejamento.cancelado_em IS
  'db/105 (D7): the live planning row was RELEASED by Pedido cancellation. The row is preserved — supplier assignment and quantity stay auditable — but it stops consuming the need ceiling and stops occupying the live slot.';
COMMENT ON COLUMN public.necessidade_compra_planejamento.cancelado_por IS
  'db/105 (D7): actor who cancelled the Pedido that released this planning row.';
COMMENT ON COLUMN public.necessidade_compra_planejamento.cancelamento_motivo IS
  'db/105 (D7): motive recorded on the releasing cancellation.';

-- ---------------------------------------------------------------------
-- 2. Narrowed active-planning indexes
-- ---------------------------------------------------------------------
DROP INDEX IF EXISTS public.necessidade_compra_planejamento_viva_uidx;
CREATE UNIQUE INDEX IF NOT EXISTS necessidade_compra_planejamento_viva_uidx
  ON public.necessidade_compra_planejamento (necessidade_id, fornecedor_id)
  WHERE gerado_em IS NULL AND cancelado_em IS NULL;

DROP INDEX IF EXISTS public.necessidade_compra_planejamento_pendente_idx;
CREATE INDEX IF NOT EXISTS necessidade_compra_planejamento_pendente_idx
  ON public.necessidade_compra_planejamento (fornecedor_id)
  WHERE gerado_em IS NULL AND cancelado_em IS NULL;

CREATE INDEX IF NOT EXISTS necessidade_compra_planejamento_cancelado_idx
  ON public.necessidade_compra_planejamento (necessidade_id)
  WHERE cancelado_em IS NOT NULL;

-- ---------------------------------------------------------------------
-- 3. Narrowed active-balance reader
--
-- This is what actually RELEASES the balance: a released row stops
-- counting against the need ceiling while remaining physically present.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.necessidade_kg_planejado_ativo(p_necessidade_id BIGINT)
RETURNS NUMERIC(12,3)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT coalesce(sum(p.kg_planejado), 0)::NUMERIC(12,3)
    FROM public.necessidade_compra_planejamento p
   WHERE p.necessidade_id = p_necessidade_id
     AND p.cancelado_em IS NULL
     AND public.oc_cobertura_ativa(p.ordem_compra_id);
$$;

COMMENT ON FUNCTION public.necessidade_kg_planejado_ativo(BIGINT) IS
  'db/100, narrowed by db/105 (D7): total planned quantity that still consumes the need ceiling. Rows of a CANCELLED purchase order were already excluded; rows RELEASED by Pedido cancellation are now excluded too, which is exactly how D7 returns the need to free balance without deleting history.';

-- ---------------------------------------------------------------------
-- 4. The three planning writers, re-declared with ONE substitution
--
-- Reproduced VERBATIM from their accepted db/100 bodies with exactly the
-- textual change `gerado_em IS NULL` -> `gerado_em IS NULL AND
-- cancelado_em IS NULL` applied to their live-row lookups, and nothing
-- else. aplicar_planejamento_rapido MUST be re-declared because its
-- ON CONFLICT clause restates the partial-index predicate and would
-- otherwise no longer match the narrowed index.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.definir_planejamento_compra(
  p_necessidade_id  BIGINT,
  p_fornecedor_id   BIGINT,
  p_kg_planejado    NUMERIC,
  p_idempotency_key TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor    UUID;
  v_key      TEXT;
  v_payload  JSONB;
  v_hash     TEXT;
  v_command  public.ordem_compra_distribuicao_comandos%ROWTYPE;
  v_need     public.necessidade_compra_fio%ROWTYPE;
  v_plan     public.necessidade_compra_planejamento%ROWTYPE;
  v_target   NUMERIC(12,3);
  v_previous NUMERIC(12,3) := 0;
  v_disponivel NUMERIC(12,3);
  v_total    NUMERIC(12,3);
  v_disc     TEXT;
  v_plan_id  BIGINT;
  v_result   JSONB;
BEGIN
  v_actor := auth.uid();
  IF v_actor IS NULL OR NOT public.is_admin() THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'sem_permissao',
      'erro', 'Somente administrador autenticado pode planejar compras');
  END IF;

  v_key := btrim(coalesce(p_idempotency_key, ''));
  IF v_key = '' OR length(v_key) > 200 THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'idempotencia_invalida',
      'erro', 'Chave de idempotencia invalida');
  END IF;

  v_target := p_kg_planejado;
  IF v_target IS NULL OR v_target < 0 OR round(v_target, 3) IS DISTINCT FROM v_target THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'kg_invalido',
      'erro', 'Quantidade deve usar NUMERIC(12,3), sem sinal negativo');
  END IF;

  v_payload := jsonb_build_object(
    'namespace', 'native_planning_v1',
    'necessidade_id', p_necessidade_id,
    'fornecedor_id', p_fornecedor_id,
    'kg_planejado', to_char(v_target, 'FM9999999990.000')
  );
  v_hash := md5(v_payload::TEXT);

  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'native_planning_v1|command|' || v_actor::TEXT || '|' || v_key, 0));

  SELECT * INTO v_command
    FROM public.ordem_compra_distribuicao_comandos
   WHERE idempotency_namespace = 'native_planning_v1'
     AND ator_id = v_actor
     AND idempotency_key = v_key
   FOR UPDATE;
  IF FOUND THEN
    IF v_command.comando_payload = v_payload THEN
      RETURN v_command.resultado;
    END IF;
    RETURN jsonb_build_object('ok', false, 'codigo', 'idempotencia_conflitante',
      'erro', 'Chave reutilizada com comando materialmente diferente');
  END IF;

  SELECT * INTO v_need FROM public.necessidade_compra_fio
   WHERE id = p_necessidade_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'necessidade_nao_encontrada',
      'erro', 'Necessidade nao encontrada');
  END IF;
  IF v_need.legado OR v_need.pedido_id IS NULL OR v_need.kg_necessario <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'necessidade_invalida',
      'erro', 'Necessidade nao e nativa e planejavel');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.fornecedores WHERE id = p_fornecedor_id) THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'fornecedor_invalido',
      'erro', 'Fornecedor inexistente');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.fornecedores f
     WHERE f.id = p_fornecedor_id
       AND ((v_need.material = 'algodao'   AND f.tipo = 'fio_algodao')
         OR (v_need.material = 'poliester' AND f.tipo = 'fio_poliester'))
  ) THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'fornecedor_incompativel',
      'erro', 'Fornecedor incompativel com o material');
  END IF;

  SELECT * INTO v_plan FROM public.necessidade_compra_planejamento
   WHERE necessidade_id = p_necessidade_id AND fornecedor_id = p_fornecedor_id
     AND gerado_em IS NULL AND cancelado_em IS NULL
   FOR UPDATE;
  IF FOUND THEN
    v_previous := v_plan.kg_planejado;
    v_plan_id  := v_plan.id;
  END IF;

  -- db/100: o teto considera apenas a cobertura ATIVA.
  v_total := public.necessidade_kg_planejado_ativo(p_necessidade_id);

  v_disponivel := v_need.kg_necessario - (v_total - v_previous);
  IF v_target > v_disponivel THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'excede_saldo',
      'erro', 'Planejamento excede o saldo da necessidade',
      'necessidade_id', v_need.id, 'disponivel', v_disponivel);
  END IF;

  IF v_target = 0 AND v_plan_id IS NOT NULL THEN
    DELETE FROM public.necessidade_compra_planejamento WHERE id = v_plan_id;
    v_disc := 'removido';
    v_plan_id := NULL;
  ELSIF v_target = 0 THEN
    v_disc := 'inalterado';
  ELSIF v_plan_id IS NULL THEN
    INSERT INTO public.necessidade_compra_planejamento(
      necessidade_id, fornecedor_id, kg_planejado, criado_por
    ) VALUES (p_necessidade_id, p_fornecedor_id, v_target, v_actor)
    RETURNING id INTO v_plan_id;
    v_disc := 'criado';
  ELSIF v_target <> v_previous THEN
    UPDATE public.necessidade_compra_planejamento
       SET kg_planejado = v_target, atualizado_em = now()
     WHERE id = v_plan_id;
    v_disc := CASE WHEN v_target > v_previous THEN 'aumentado' ELSE 'reduzido' END;
  ELSE
    v_disc := 'inalterado';
  END IF;

  v_total := public.necessidade_kg_planejado_ativo(p_necessidade_id);

  v_result := jsonb_build_object(
    'ok', true, 'codigo', 'ok',
    'idempotency_key', v_key,
    'discriminador', v_disc,
    'planejamento_id', v_plan_id,
    'necessidade_id', v_need.id,
    'pedido_id', v_need.pedido_id,
    'fornecedor_id', p_fornecedor_id,
    'kg_anterior', v_previous,
    'kg_final', v_target,
    'necessidade_kg_necessario', v_need.kg_necessario,
    'necessidade_kg_planejado', v_total,
    'necessidade_kg_restante', (v_need.kg_necessario - v_total)::NUMERIC(12,3),
    'ordem_compra_criada', false
  );

  INSERT INTO public.ordem_compra_distribuicao_comandos(
    idempotency_namespace, ator_id, idempotency_key, comando_payload, comando_hash, resultado
  ) VALUES ('native_planning_v1', v_actor, v_key, v_payload, v_hash, v_result);

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.substituir_planejamento_compra_necessidade(
  p_necessidade_id  BIGINT,
  p_linhas          JSONB,
  p_idempotency_key TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor    UUID;
  v_key      TEXT;
  v_payload  JSONB;
  v_hash     TEXT;
  v_command  public.ordem_compra_distribuicao_comandos%ROWTYPE;
  v_need     public.necessidade_compra_fio%ROWTYPE;
  v_linha    JSONB;
  v_forn     BIGINT;
  v_kg       NUMERIC(12,3);
  v_tipo     TEXT;
  v_gerado   NUMERIC(12,3);
  v_soma     NUMERIC(12,3) := 0;
  v_validas  JSONB := '[]'::jsonb;
  v_ids      BIGINT[] := ARRAY[]::BIGINT[];
  v_criadas  INTEGER := 0;
  v_atualizadas INTEGER := 0;
  v_removidas   INTEGER := 0;
  v_result   JSONB;
BEGIN
  v_actor := auth.uid();
  IF v_actor IS NULL OR NOT public.is_admin() THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'sem_permissao',
      'erro', 'Somente administrador autenticado pode planejar compras');
  END IF;

  v_key := btrim(coalesce(p_idempotency_key, ''));
  IF v_key = '' OR length(v_key) > 200 THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'idempotencia_invalida',
      'erro', 'Chave de idempotencia invalida');
  END IF;

  IF p_linhas IS NULL OR jsonb_typeof(p_linhas) <> 'array' THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'selecao_invalida',
      'erro', 'O conjunto de distribuicoes e invalido');
  END IF;

  v_payload := jsonb_build_object(
    'namespace', 'native_planning_v1',
    'modo', 'substituicao',
    'necessidade_id', p_necessidade_id,
    'linhas', p_linhas
  );
  v_hash := md5(v_payload::TEXT);

  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'native_planning_v1|command|' || v_actor::TEXT || '|' || v_key, 0));

  SELECT * INTO v_command
    FROM public.ordem_compra_distribuicao_comandos
   WHERE idempotency_namespace = 'native_planning_v1'
     AND ator_id = v_actor AND idempotency_key = v_key
   FOR UPDATE;
  IF FOUND THEN
    IF v_command.comando_payload = v_payload THEN
      RETURN v_command.resultado;
    END IF;
    RETURN jsonb_build_object('ok', false, 'codigo', 'idempotencia_conflitante',
      'erro', 'Chave reutilizada com comando materialmente diferente');
  END IF;

  SELECT * INTO v_need FROM public.necessidade_compra_fio
   WHERE id = p_necessidade_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'necessidade_nao_encontrada',
      'erro', 'Necessidade nao encontrada');
  END IF;
  IF v_need.legado OR v_need.pedido_id IS NULL OR v_need.kg_necessario <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'necessidade_invalida',
      'erro', 'Necessidade nao e nativa e planejavel');
  END IF;

  -- ---------- PASSO 1: VALIDAR O CONJUNTO INTEIRO, SEM ESCREVER ----------
  FOR v_linha IN SELECT * FROM jsonb_array_elements(p_linhas)
  LOOP
    v_forn := (v_linha->>'fornecedor_id')::BIGINT;
    IF v_forn IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'codigo', 'fornecedor_invalido',
        'erro', 'Informe o fornecedor de cada distribuicao');
    END IF;

    IF v_forn = ANY(v_ids) THEN
      RETURN jsonb_build_object('ok', false, 'codigo', 'fornecedor_duplicado',
        'erro', 'O mesmo fornecedor aparece mais de uma vez nesta distribuicao',
        'fornecedor_id', v_forn);
    END IF;
    v_ids := v_ids || v_forn;

    v_kg := (v_linha->>'kg')::NUMERIC(12,3);
    IF v_kg IS NULL OR v_kg <= 0 OR round(v_kg, 3) IS DISTINCT FROM v_kg THEN
      RETURN jsonb_build_object('ok', false, 'codigo', 'kg_invalido',
        'erro', 'Quantidade deve ser positiva e usar NUMERIC(12,3)',
        'fornecedor_id', v_forn);
    END IF;

    SELECT f.tipo INTO v_tipo FROM public.fornecedores f WHERE f.id = v_forn;
    IF v_tipo IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'codigo', 'fornecedor_invalido',
        'erro', 'Fornecedor inexistente', 'fornecedor_id', v_forn);
    END IF;
    IF (v_need.material = 'algodao'   AND v_tipo <> 'fio_algodao')
       OR (v_need.material = 'poliester' AND v_tipo <> 'fio_poliester') THEN
      RETURN jsonb_build_object('ok', false, 'codigo', 'fornecedor_incompativel',
        'erro', 'Fornecedor incompativel com o material', 'fornecedor_id', v_forn);
    END IF;

    v_soma := v_soma + v_kg;
    v_validas := v_validas || jsonb_build_object('fornecedor_id', v_forn, 'kg', v_kg);
  END LOOP;

  -- db/100: o teto considera a historia ATIVA. Uma linha ja gerada cujo
  -- Pedido de Compra foi cancelado nao ocupa mais saldo.
  v_gerado := public.necessidade_kg_planejado_ativo_gerado(p_necessidade_id);

  IF (v_soma + v_gerado) > v_need.kg_necessario THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'excede_saldo',
      'erro', 'A distribuicao excede a necessidade',
      'necessidade_id', v_need.id,
      'kg_necessario', v_need.kg_necessario,
      'kg_gerado', v_gerado,
      'kg_solicitado', v_soma,
      'disponivel', (v_need.kg_necessario - v_gerado)::NUMERIC(12,3));
  END IF;

  -- ---------- PASSO 2: APLICAR. Nao ha mais caminho de recusa. ----------
  WITH alvo AS (
    DELETE FROM public.necessidade_compra_planejamento
     WHERE necessidade_id = p_necessidade_id
       AND gerado_em IS NULL AND cancelado_em IS NULL
       AND NOT (fornecedor_id = ANY(v_ids))
    RETURNING id
  ) SELECT count(*) INTO v_removidas FROM alvo;

  FOR v_linha IN SELECT * FROM jsonb_array_elements(v_validas)
  LOOP
    v_forn := (v_linha->>'fornecedor_id')::BIGINT;
    v_kg   := (v_linha->>'kg')::NUMERIC(12,3);

    UPDATE public.necessidade_compra_planejamento
       SET kg_planejado = v_kg, atualizado_em = now()
     WHERE necessidade_id = p_necessidade_id
       AND fornecedor_id = v_forn
       AND gerado_em IS NULL AND cancelado_em IS NULL;
    IF FOUND THEN
      v_atualizadas := v_atualizadas + 1;
    ELSE
      INSERT INTO public.necessidade_compra_planejamento(
        necessidade_id, fornecedor_id, kg_planejado, criado_por
      ) VALUES (p_necessidade_id, v_forn, v_kg, v_actor);
      v_criadas := v_criadas + 1;
    END IF;
  END LOOP;

  v_result := jsonb_build_object(
    'ok', true, 'codigo', 'ok',
    'idempotency_key', v_key,
    'discriminador', 'substituido',
    'necessidade_id', v_need.id,
    'pedido_id', v_need.pedido_id,
    'linhas_criadas', v_criadas,
    'linhas_atualizadas', v_atualizadas,
    'linhas_removidas', v_removidas,
    'necessidade_kg_necessario', v_need.kg_necessario,
    'necessidade_kg_gerado', v_gerado,
    'necessidade_kg_planejado', (v_soma + v_gerado)::NUMERIC(12,3),
    'necessidade_kg_restante', (v_need.kg_necessario - v_soma - v_gerado)::NUMERIC(12,3),
    'ordem_compra_criada', false
  );

  INSERT INTO public.ordem_compra_distribuicao_comandos(
    idempotency_namespace, ator_id, idempotency_key, comando_payload, comando_hash, resultado
  ) VALUES ('native_planning_v1', v_actor, v_key, v_payload, v_hash, v_result);

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.aplicar_planejamento_rapido(
  p_pedido_id       UUID,
  p_fornecedor_id   BIGINT,
  p_itens           JSONB,
  p_idempotency_key TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor   UUID;
  v_key     TEXT;
  v_payload JSONB;
  v_hash    TEXT;
  v_command public.ordem_compra_distribuicao_comandos%ROWTYPE;
  v_tipo    TEXT;
  v_item    JSONB;
  v_need    public.necessidade_compra_fio%ROWTYPE;
  v_kg      NUMERIC(12,3);
  v_total   NUMERIC(12,3);
  v_prev    NUMERIC(12,3);
  v_aplicados JSONB := '[]'::jsonb;
  v_count   INTEGER := 0;
  v_necessidades_prelim BIGINT[];
  v_result  JSONB;
BEGIN
  v_actor := auth.uid();
  IF v_actor IS NULL OR NOT public.is_admin() THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'sem_permissao',
      'erro', 'Somente administrador autenticado pode planejar compras');
  END IF;

  v_key := btrim(coalesce(p_idempotency_key, ''));
  IF v_key = '' OR length(v_key) > 200 THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'idempotencia_invalida',
      'erro', 'Chave de idempotencia invalida');
  END IF;

  IF p_itens IS NULL OR jsonb_typeof(p_itens) <> 'array' OR jsonb_array_length(p_itens) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'selecao_vazia',
      'erro', 'Selecione ao menos uma necessidade');
  END IF;

  v_payload := jsonb_build_object(
    'namespace', 'native_planning_v1',
    'modo', 'rapido',
    'pedido_id', p_pedido_id,
    'fornecedor_id', p_fornecedor_id,
    'itens', p_itens
  );
  v_hash := md5(v_payload::TEXT);

  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'native_planning_v1|command|' || v_actor::TEXT || '|' || v_key, 0));

  SELECT * INTO v_command
    FROM public.ordem_compra_distribuicao_comandos
   WHERE idempotency_namespace = 'native_planning_v1'
     AND ator_id = v_actor AND idempotency_key = v_key
   FOR UPDATE;
  IF FOUND THEN
    IF v_command.comando_payload = v_payload THEN
      RETURN v_command.resultado;
    END IF;
    RETURN jsonb_build_object('ok', false, 'codigo', 'idempotencia_conflitante',
      'erro', 'Chave reutilizada com comando materialmente diferente');
  END IF;

  SELECT f.tipo INTO v_tipo FROM public.fornecedores f WHERE f.id = p_fornecedor_id;
  IF v_tipo IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'fornecedor_invalido',
      'erro', 'Fornecedor inexistente');
  END IF;

  IF (SELECT count(DISTINCT value->>'necessidade_id') FROM jsonb_array_elements(p_itens))
     <> jsonb_array_length(p_itens) THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'selecao_duplicada',
      'erro', 'A mesma necessidade aparece mais de uma vez na selecao');
  END IF;

  -- PASSO 0 — TRAVAR AS NECESSIDADES EM ORDEM CANONICA DE id.
  SELECT array_agg(DISTINCT (value->>'necessidade_id')::BIGINT
                   ORDER BY (value->>'necessidade_id')::BIGINT)
    INTO v_necessidades_prelim
    FROM jsonb_array_elements(p_itens);

  IF v_necessidades_prelim IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'selecao_vazia',
      'erro', 'Selecione ao menos uma necessidade');
  END IF;

  PERFORM 1 FROM public.necessidade_compra_fio
   WHERE id = ANY(v_necessidades_prelim) ORDER BY id FOR UPDATE;

  -- PASSO 1 — VALIDAR TUDO. Nenhuma linha e escrita nesta passagem.
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens)
  LOOP
    SELECT * INTO v_need FROM public.necessidade_compra_fio
     WHERE id = (v_item->>'necessidade_id')::BIGINT FOR UPDATE;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('ok', false, 'codigo', 'necessidade_nao_encontrada',
        'erro', 'Necessidade nao encontrada', 'necessidade_id', v_item->>'necessidade_id');
    END IF;

    IF v_need.pedido_id IS DISTINCT FROM p_pedido_id THEN
      RETURN jsonb_build_object('ok', false, 'codigo', 'pedido_incoerente',
        'erro', 'Necessidade nao pertence ao Pedido informado',
        'necessidade_id', v_need.id);
    END IF;
    IF v_need.legado OR v_need.kg_necessario <= 0 THEN
      RETURN jsonb_build_object('ok', false, 'codigo', 'necessidade_invalida',
        'erro', 'Necessidade nao e nativa e planejavel', 'necessidade_id', v_need.id);
    END IF;

    IF (v_need.material = 'algodao'   AND v_tipo <> 'fio_algodao')
       OR (v_need.material = 'poliester' AND v_tipo <> 'fio_poliester') THEN
      RETURN jsonb_build_object('ok', false, 'codigo', 'fornecedor_incompativel',
        'erro', 'Fornecedor incompativel com o material da necessidade',
        'necessidade_id', v_need.id);
    END IF;

    -- db/100: saldo medido pela cobertura ATIVA.
    v_total := public.necessidade_kg_planejado_ativo(v_need.id);
    SELECT coalesce(kg_planejado, 0)::NUMERIC(12,3) INTO v_prev
      FROM public.necessidade_compra_planejamento
     WHERE necessidade_id = v_need.id AND fornecedor_id = p_fornecedor_id
       AND gerado_em IS NULL AND cancelado_em IS NULL;
    v_prev := coalesce(v_prev, 0);

    IF v_item ? 'kg' AND (v_item->>'kg') IS NOT NULL THEN
      v_kg := (v_item->>'kg')::NUMERIC(12,3);
    ELSE
      v_kg := (v_need.kg_necessario - (v_total - v_prev))::NUMERIC(12,3);
    END IF;

    IF v_kg IS NULL OR v_kg <= 0 OR round(v_kg, 3) IS DISTINCT FROM v_kg THEN
      RETURN jsonb_build_object('ok', false, 'codigo', 'kg_invalido',
        'erro', 'Quantidade invalida para a necessidade', 'necessidade_id', v_need.id);
    END IF;

    IF v_kg > (v_need.kg_necessario - (v_total - v_prev)) THEN
      RETURN jsonb_build_object('ok', false, 'codigo', 'excede_saldo',
        'erro', 'Planejamento excede o saldo da necessidade',
        'necessidade_id', v_need.id,
        'disponivel', (v_need.kg_necessario - (v_total - v_prev))::NUMERIC(12,3));
    END IF;

    v_aplicados := v_aplicados || jsonb_build_object(
      'necessidade_id', v_need.id, 'kg_planejado', v_kg);
  END LOOP;

  -- PASSO 2 — APLICAR.
  FOR v_item IN SELECT * FROM jsonb_array_elements(v_aplicados)
  LOOP
    INSERT INTO public.necessidade_compra_planejamento(
      necessidade_id, fornecedor_id, kg_planejado, criado_por
    ) VALUES (
      (v_item->>'necessidade_id')::BIGINT, p_fornecedor_id,
      (v_item->>'kg_planejado')::NUMERIC(12,3), v_actor
    )
    ON CONFLICT (necessidade_id, fornecedor_id) WHERE gerado_em IS NULL AND cancelado_em IS NULL DO UPDATE
      SET kg_planejado = EXCLUDED.kg_planejado, atualizado_em = now();
    v_count := v_count + 1;
  END LOOP;

  v_result := jsonb_build_object(
    'ok', true, 'codigo', 'ok',
    'idempotency_key', v_key,
    'discriminador', 'rapido',
    'pedido_id', p_pedido_id,
    'fornecedor_id', p_fornecedor_id,
    'necessidades_aplicadas', v_count,
    'aplicados', v_aplicados,
    'ordem_compra_criada', false
  );

  INSERT INTO public.ordem_compra_distribuicao_comandos(
    idempotency_namespace, ator_id, idempotency_key, comando_payload, comando_hash, resultado
  ) VALUES ('native_planning_v1', v_actor, v_key, v_payload, v_hash, v_result);

  RETURN v_result;
END;
$$;

-- ---------------------------------------------------------------------
-- 5. Planning writes are refused for a cancelled Pedido (9.9.M)
--
-- Installed as an ADDITIVE trigger rather than by editing the accepted
-- planning writers, so no reachable writer body carries a new refusal
-- path. cancelar_pedido releases planning BEFORE it cancels the Pedido
-- (step 6 precedes step 12), and a release write is explicitly allowed,
-- so this guard never fires on the cancellation transaction itself.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_planejamento_pedido_cancelado_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- The D7 release itself is always permitted.
  IF TG_OP = 'UPDATE' AND NEW.cancelado_em IS NOT NULL
     AND OLD.cancelado_em IS NULL THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1
      FROM public.necessidade_compra_fio n
      JOIN public.pedidos pd ON pd.id = n.pedido_id
     WHERE n.id = NEW.necessidade_id
       AND pd.status = 'cancelado'
  ) THEN
    RAISE EXCEPTION 'PEDIDO_CANCELADO' USING ERRCODE = '55000',
      DETAIL = 'planning writes are refused for a cancelled Pedido';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS planejamento_pedido_cancelado_guard ON public.necessidade_compra_planejamento;
CREATE TRIGGER planejamento_pedido_cancelado_guard
  BEFORE INSERT OR UPDATE ON public.necessidade_compra_planejamento
  FOR EACH ROW EXECUTE FUNCTION public.trg_planejamento_pedido_cancelado_guard();

-- ---------------------------------------------------------------------
-- 6. _pedido_status_recalcular — the DERIVED transition authority (9.9.L.1)
--
-- OWNER-ONLY: not executable by any client role. Owns exactly
-- confirmado->produzindo, produzindo->entregue and entregue->produzindo
-- (D1). It never produces 'confirmado' and never leaves 'cancelado'.
--
-- Called only by iniciar_producao_op, registrar_entrega_expedicao (P2),
-- corrigir_entrega_expedicao and cancelar_pedido.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._pedido_status_recalcular(
  p_pedido_id UUID,
  p_causa     TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_status    TEXT;
  v_alvo      TEXT;
  v_producao  BOOLEAN;
  v_completo  BOOLEAN;
  v_itens     INTEGER;
BEGIN
  SELECT p.status INTO v_status FROM public.pedidos p WHERE p.id = p_pedido_id;
  IF v_status IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'PEDIDO_NAO_ENCONTRADO');
  END IF;

  -- A cancelled Pedido stays cancelled (9.9.K).
  IF v_status = 'cancelado' THEN
    RETURN jsonb_build_object('ok', true, 'status', 'cancelado', 'mudou', false);
  END IF;

  -- Derived transitions apply only from the operational band.
  IF v_status NOT IN ('confirmado', 'produzindo', 'entregue') THEN
    RETURN jsonb_build_object('ok', true, 'status', v_status, 'mudou', false);
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.ops o
      JOIN public.lotes lt ON lt.id = o.lote_id
     WHERE lt.pedido_id = p_pedido_id
       AND o.status IN ('em_producao', 'pausada', 'concluida', 'finalizada')
  ) INTO v_producao;

  -- Delivery completion is recomputed from the FULL expedition item set:
  -- at least one released item exists and none is still short of its
  -- released quantity.
  SELECT count(*) INTO v_itens
    FROM public.expedicao_itens ei
    JOIN public.expedicoes e ON e.id = ei.expedicao_id
   WHERE e.pedido_id = p_pedido_id;

  v_completo := v_itens > 0 AND NOT EXISTS (
    SELECT 1
      FROM public.expedicao_itens ei
      JOIN public.expedicoes e ON e.id = ei.expedicao_id
     WHERE e.pedido_id = p_pedido_id
       AND ei.metros_entregues < ei.metros_liberados
  );

  v_alvo := v_status;
  IF v_status = 'confirmado' AND v_producao THEN
    v_alvo := 'produzindo';
  ELSIF v_status = 'produzindo' AND v_completo THEN
    v_alvo := 'entregue';
  ELSIF v_status = 'entregue' AND NOT v_completo THEN
    v_alvo := 'produzindo';
  END IF;

  IF v_alvo = v_status THEN
    RETURN jsonb_build_object('ok', true, 'status', v_status, 'mudou', false);
  END IF;

  UPDATE public.pedidos SET status = v_alvo WHERE id = p_pedido_id;

  INSERT INTO public.pedido_eventos (pedido_id, status_anterior, status_novo, criado_por, observacao)
  VALUES (p_pedido_id, v_status, v_alvo, auth.uid(),
          'Transicao derivada (' || COALESCE(p_causa, 'indefinida') || ').');

  RETURN jsonb_build_object('ok', true, 'status', v_alvo, 'status_anterior', v_status,
                            'mudou', true, 'causa', p_causa);
END;
$$;

COMMENT ON FUNCTION public._pedido_status_recalcular(UUID, TEXT) IS
  'db/105 (9.9.L.1): OWNER-ONLY derived Pedido transition authority. Owns confirmado->produzindo, produzindo->entregue and entregue->produzindo. Never yields confirmado; a cancelled Pedido stays cancelled. Not executable by any client role.';

-- ---------------------------------------------------------------------
-- 7. pedido_elegivel_cancelamento (9.9.M)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pedido_elegivel_cancelamento(p_pedido_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_status TEXT;
  v_prio   TEXT;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'sem_permissao' USING ERRCODE = '42501';
  END IF;

  SELECT p.status, p.prioridade_status INTO v_status, v_prio
    FROM public.pedidos p WHERE p.id = p_pedido_id;
  IF v_status IS NULL THEN
    RETURN jsonb_build_object('elegivel', false, 'codigo', 'PEDIDO_NAO_ENCONTRADO');
  END IF;

  IF v_status = 'cancelado' THEN
    RETURN jsonb_build_object('elegivel', false, 'codigo', 'PEDIDO_JA_CANCELADO');
  END IF;

  IF v_status = 'entregue' THEN
    RETURN jsonb_build_object('elegivel', false, 'codigo', 'PEDIDO_CANCELAMENTO_APOS_ENTREGA');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.expedicao_itens ei
      JOIN public.expedicoes e ON e.id = ei.expedicao_id
     WHERE e.pedido_id = p_pedido_id AND ei.metros_entregues > 0
  ) THEN
    RETURN jsonb_build_object('elegivel', false, 'codigo', 'PEDIDO_COM_ENTREGA_REGISTRADA');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.pedido_alteracao_solicitacoes s
     WHERE s.pedido_id = p_pedido_id AND s.status = 'pendente'
  ) THEN
    RETURN jsonb_build_object('elegivel', false, 'codigo', 'PEDIDO_COM_SOLICITACAO_PENDENTE');
  END IF;

  IF v_prio = 'solicitada' THEN
    RETURN jsonb_build_object('elegivel', false, 'codigo', 'ADMIN_REVIEW_REQUIRED');
  END IF;

  RETURN jsonb_build_object('elegivel', true, 'codigo', 'elegivel');
END;
$$;

COMMENT ON FUNCTION public.pedido_elegivel_cancelamento(UUID) IS
  'db/105 (9.9.M): D7 cancellation gate. Returns {elegivel, codigo} with the exact refusal identities of the accepted design.';

-- ---------------------------------------------------------------------
-- 8. cancelar_pedido — D7 compensation, ONE transaction (9.9.M)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cancelar_pedido(
  p_pedido_id    UUID,
  p_base_revisao BIGINT,
  p_motivo       TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_gate      JSONB;
  v_revisao   BIGINT;
  v_op        RECORD;
  v_oc        RECORD;
  v_res       JSONB;
  v_ops_canc  INTEGER := 0;
  v_ocs_canc  INTEGER := 0;
  v_plan_lib  INTEGER := 0;
  v_motivo    TEXT;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'sem_permissao' USING ERRCODE = '42501';
  END IF;

  v_motivo := NULLIF(btrim(COALESCE(p_motivo, '')), '');
  IF v_motivo IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'CANCELAMENTO_MOTIVO_OBRIGATORIO');
  END IF;

  -- STEP 1: eligibility
  v_gate := public.pedido_elegivel_cancelamento(p_pedido_id);
  IF NOT COALESCE((v_gate ->> 'elegivel')::BOOLEAN, FALSE) THEN
    RETURN jsonb_build_object('ok', false, 'codigo', v_gate ->> 'codigo');
  END IF;

  -- STEP 2: locks, in the global order (9.9.B)
  BEGIN
    SET LOCAL lock_timeout = '5s';
    PERFORM 1 FROM public.pedidos WHERE id = p_pedido_id FOR UPDATE;
    PERFORM 1 FROM public.ops o
      JOIN public.lotes lt ON lt.id = o.lote_id
     WHERE lt.pedido_id = p_pedido_id
     ORDER BY o.id
       FOR UPDATE OF o;
    PERFORM 1 FROM public.ordem_compra oc
     WHERE oc.pedido_id = p_pedido_id
     ORDER BY oc.id
       FOR UPDATE;
  EXCEPTION WHEN lock_not_available THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'concorrencia_ocupada');
  END;

  SELECT p.revisao INTO v_revisao FROM public.pedidos p WHERE p.id = p_pedido_id;
  IF p_base_revisao IS NOT NULL AND p_base_revisao IS DISTINCT FROM v_revisao THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'PEDIDO_ALTERACAO_REVISAO_DESATUALIZADA',
                              'revisao_atual', v_revisao);
  END IF;

  -- Re-check the gate INSIDE the lock: eligibility was read before it.
  v_gate := public.pedido_elegivel_cancelamento(p_pedido_id);
  IF NOT COALESCE((v_gate ->> 'elegivel')::BOOLEAN, FALSE) THEN
    RETURN jsonb_build_object('ok', false, 'codigo', v_gate ->> 'codigo');
  END IF;

  -- STEP 3: cancel every ACTIVE OP through the internal lifecycle helper.
  -- STEP 4/5: their reservations are released IMPLICITLY (a cancelled OP
  -- contributes nothing to _oc_reserva_ativa) and the saved adjustments in
  -- op_itens.metros_ajustados are PRESERVED VERBATIM — they simply stop
  -- reserving. No row is deleted.
  FOR v_op IN
    SELECT o.id FROM public.ops o
      JOIN public.lotes lt ON lt.id = o.lote_id
     WHERE lt.pedido_id = p_pedido_id
       AND o.status IN ('simulada', 'aberta', 'em_producao', 'pausada')
     ORDER BY o.id
  LOOP
    v_res := public._op_status_aplicar(v_op.id, 'cancelada',
               'OP cancelada pelo cancelamento do Pedido. Motivo: ' || v_motivo);
    IF NOT COALESCE((v_res ->> 'ok')::BOOLEAN, FALSE) THEN
      RAISE EXCEPTION 'CANCELAMENTO_OP_FALHOU'
        USING ERRCODE = '55000',
              DETAIL = format('OP %s: %s', v_op.id, COALESCE(v_res ->> 'codigo', 'desconhecido'));
    END IF;
    v_ops_canc := v_ops_canc + 1;
  END LOOP;

  -- STEP 6: release LIVE planning balance WITHOUT physical deletion (D7).
  UPDATE public.necessidade_compra_planejamento p
     SET cancelado_em        = now(),
         cancelado_por       = auth.uid(),
         cancelamento_motivo = v_motivo,
         atualizado_em       = now()
    FROM public.necessidade_compra_fio n
   WHERE n.id = p.necessidade_id
     AND n.pedido_id = p_pedido_id
     AND p.gerado_em IS NULL
     AND p.cancelado_em IS NULL;
  GET DIAGNOSTICS v_plan_lib = ROW_COUNT;

  -- STEPS 7/8/9: cancel rascunho AND emitida Purchase Orders through the
  -- existing db/100 writer, which releases coverage. Acceptance does NOT
  -- bar cancellation, so an accepted order is cancelled as well, with its
  -- acceptance history intact. The document, its number, its items and
  -- its provenance are all preserved.
  FOR v_oc IN
    SELECT oc.id FROM public.ordem_compra oc
     WHERE oc.pedido_id = p_pedido_id
       AND oc.status_administrativo IN ('rascunho', 'emitida')
     ORDER BY oc.id
  LOOP
    v_res := public.cancelar_ordem_compra(v_oc.id);
    IF NOT COALESCE((v_res ->> 'ok')::BOOLEAN, FALSE) THEN
      RAISE EXCEPTION 'CANCELAMENTO_ORDEM_COMPRA_FALHOU'
        USING ERRCODE = '55000',
              DETAIL = format('ordem_compra %s: %s', v_oc.id,
                              COALESCE(v_res ->> 'erro', v_res ->> 'codigo', 'desconhecido'));
    END IF;
    v_ocs_canc := v_ocs_canc + 1;
  END LOOP;

  -- STEPS 10/11: receipts, expedition and delivery facts are UNTOUCHED.
  -- Received material stays received; its ledger is append-only. Coverage
  -- release does not un-receive anything. This migration contains no
  -- statement that deletes or rewrites any of them.

  -- STEP 12: the Pedido itself.
  UPDATE public.pedidos SET status = 'cancelado' WHERE id = p_pedido_id;

  INSERT INTO public.pedido_eventos (pedido_id, status_anterior, status_novo, criado_por, observacao)
  SELECT p_pedido_id, NULL, 'cancelado', auth.uid(),
         'Pedido cancelado. Motivo: ' || v_motivo
   WHERE NOT EXISTS (SELECT 1 FROM public.pedido_eventos
                      WHERE pedido_id = p_pedido_id AND status_novo = 'cancelado'
                        AND criado_em >= now());

  PERFORM public._pedido_status_recalcular(p_pedido_id, 'cancelamento');

  SELECT p.revisao INTO v_revisao FROM public.pedidos p WHERE p.id = p_pedido_id;

  RETURN jsonb_build_object(
    'ok', true, 'pedido_id', p_pedido_id, 'status', 'cancelado',
    'revisao', v_revisao,
    'ops_canceladas', v_ops_canc,
    'ordens_compra_canceladas', v_ocs_canc,
    'planejamentos_liberados', v_plan_lib);
END;
$$;

COMMENT ON FUNCTION public.cancelar_pedido(UUID, BIGINT, TEXT) IS
  'db/105 (9.9.M): D7 cancellation compensation in ONE transaction. Cancels active OPs, releases live planning WITHOUT deletion, cancels rascunho/emitida/accepted Purchase Orders through the existing db/100 writer, and leaves every receipt, expedition and delivery fact untouched.';

-- ---------------------------------------------------------------------
-- 9. alterar_status_pedido — the PUBLIC operator transition (9.9.L.1)
--
-- Accepts ONLY rascunho->recebido, recebido->confirmado, and cancellation
-- through the D7 gate. Every DERIVED transition stays owner-only.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.alterar_status_pedido(
  p_pedido_id    UUID,
  p_novo_status  TEXT,
  p_base_revisao BIGINT,
  p_motivo       TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_status  TEXT;
  v_revisao BIGINT;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'sem_permissao' USING ERRCODE = '42501';
  END IF;

  -- Cancellation has ONE owner, and it is the D7 writer.
  IF p_novo_status = 'cancelado' THEN
    RETURN public.cancelar_pedido(p_pedido_id, p_base_revisao, p_motivo);
  END IF;

  BEGIN
    SET LOCAL lock_timeout = '5s';
    PERFORM 1 FROM public.pedidos WHERE id = p_pedido_id FOR UPDATE;
    PERFORM 1 FROM public.ops o
      JOIN public.lotes lt ON lt.id = o.lote_id
     WHERE lt.pedido_id = p_pedido_id
     ORDER BY o.id
       FOR UPDATE OF o;
  EXCEPTION WHEN lock_not_available THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'concorrencia_ocupada');
  END;

  SELECT p.status, p.revisao INTO v_status, v_revisao
    FROM public.pedidos p WHERE p.id = p_pedido_id;
  IF v_status IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'PEDIDO_NAO_ENCONTRADO');
  END IF;

  IF p_base_revisao IS NOT NULL AND p_base_revisao IS DISTINCT FROM v_revisao THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'PEDIDO_ALTERACAO_REVISAO_DESATUALIZADA',
                              'revisao_atual', v_revisao);
  END IF;

  IF v_status = 'cancelado' THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'PEDIDO_CANCELADO');
  END IF;

  -- The ONLY operator-requested transitions this writer accepts.
  IF NOT ((v_status = 'rascunho' AND p_novo_status = 'recebido')
       OR (v_status = 'recebido' AND p_novo_status = 'confirmado')) THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'PEDIDO_TRANSICAO_NAO_PERMITIDA',
                              'status_atual', v_status, 'status_novo', p_novo_status);
  END IF;

  UPDATE public.pedidos SET status = p_novo_status WHERE id = p_pedido_id;

  INSERT INTO public.pedido_eventos (pedido_id, status_anterior, status_novo, criado_por, observacao)
  VALUES (p_pedido_id, v_status, p_novo_status, auth.uid(), NULLIF(btrim(COALESCE(p_motivo, '')), ''));

  SELECT p.revisao INTO v_revisao FROM public.pedidos p WHERE p.id = p_pedido_id;

  RETURN jsonb_build_object('ok', true, 'pedido_id', p_pedido_id,
                            'status_anterior', v_status, 'status', p_novo_status,
                            'revisao', v_revisao);
END;
$$;

COMMENT ON FUNCTION public.alterar_status_pedido(UUID, TEXT, BIGINT, TEXT) IS
  'db/105 (9.9.L.1): the PUBLIC operator-requested Pedido transition. Accepts only rascunho->recebido, recebido->confirmado and cancellation through the D7 gate. SECURITY DEFINER because db/106 (P4) removes the caller''s direct privilege on pedidos.status.';

-- ---------------------------------------------------------------------
-- 10. Explicit ownership and privileges
-- ---------------------------------------------------------------------
ALTER FUNCTION public.necessidade_kg_planejado_ativo(BIGINT)                  OWNER TO postgres;
ALTER FUNCTION public.trg_planejamento_pedido_cancelado_guard()               OWNER TO postgres;
ALTER FUNCTION public._pedido_status_recalcular(UUID, TEXT)                   OWNER TO postgres;
ALTER FUNCTION public.pedido_elegivel_cancelamento(UUID)                      OWNER TO postgres;
ALTER FUNCTION public.cancelar_pedido(UUID, BIGINT, TEXT)                     OWNER TO postgres;
ALTER FUNCTION public.alterar_status_pedido(UUID, TEXT, BIGINT, TEXT)         OWNER TO postgres;

REVOKE ALL ON FUNCTION public.necessidade_kg_planejado_ativo(BIGINT)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.trg_planejamento_pedido_cancelado_guard()
  FROM PUBLIC, anon, authenticated, service_role;

-- 9.9.L.1: the derived-transition authority is executable by NO client role.
REVOKE ALL ON FUNCTION public._pedido_status_recalcular(UUID, TEXT)
  FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.pedido_elegivel_cancelamento(UUID)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.pedido_elegivel_cancelamento(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.cancelar_pedido(UUID, BIGINT, TEXT)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.cancelar_pedido(UUID, BIGINT, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.alterar_status_pedido(UUID, TEXT, BIGINT, TEXT)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.alterar_status_pedido(UUID, TEXT, BIGINT, TEXT) TO authenticated;

-- The three re-declared planning writers keep EXACTLY the privileges
-- db/99 and db/100 declared for them; re-stated so a CREATE OR REPLACE
-- can never silently fall back on a default grant.
ALTER FUNCTION public.definir_planejamento_compra(BIGINT, BIGINT, NUMERIC, TEXT) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.definir_planejamento_compra(BIGINT, BIGINT, NUMERIC, TEXT)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.definir_planejamento_compra(BIGINT, BIGINT, NUMERIC, TEXT) TO authenticated;

ALTER FUNCTION public.substituir_planejamento_compra_necessidade(BIGINT, JSONB, TEXT) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.substituir_planejamento_compra_necessidade(BIGINT, JSONB, TEXT)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.substituir_planejamento_compra_necessidade(BIGINT, JSONB, TEXT) TO authenticated;

ALTER FUNCTION public.aplicar_planejamento_rapido(UUID, BIGINT, JSONB, TEXT) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.aplicar_planejamento_rapido(UUID, BIGINT, JSONB, TEXT)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.aplicar_planejamento_rapido(UUID, BIGINT, JSONB, TEXT) TO authenticated;

-- ---------------------------------------------------------------------
-- 11. Migration-time invariants
-- ---------------------------------------------------------------------
DO $db105$
DECLARE
  v_n INTEGER;
BEGIN
  -- 11.1 EQUIVALENCE PROOF for the narrowing: no pre-existing planning
  --      row carries cancelado_em, so `gerado_em IS NULL` and
  --      `gerado_em IS NULL AND cancelado_em IS NULL` select the SAME
  --      rows and no reachable behaviour changed.
  SELECT count(*) INTO v_n FROM public.necessidade_compra_planejamento
   WHERE cancelado_em IS NOT NULL;
  IF v_n > 0 THEN
    RAISE EXCEPTION 'db/105: % planning row(s) already carry cancelado_em; the narrowing would not be behaviour-preserving', v_n;
  END IF;

  -- 11.2 The narrowed indexes exist with the exact predicate.
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
     WHERE schemaname = 'public'
       AND indexname = 'necessidade_compra_planejamento_viva_uidx'
       AND indexdef LIKE '%gerado_em IS NULL%cancelado_em IS NULL%'
  ) THEN
    RAISE EXCEPTION 'db/105: the active-planning unique index was not narrowed';
  END IF;

  -- 11.3 _pedido_status_recalcular is executable by NO client role (9.9.L.1).
  IF has_function_privilege('anon',          'public._pedido_status_recalcular(uuid,text)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public._pedido_status_recalcular(uuid,text)', 'EXECUTE')
     OR has_function_privilege('service_role',  'public._pedido_status_recalcular(uuid,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'db/105: _pedido_status_recalcular must not be reachable by any client role';
  END IF;

  -- 11.4 The public writers are executable by authenticated only.
  IF NOT has_function_privilege('authenticated', 'public.alterar_status_pedido(uuid,text,bigint,text)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.cancelar_pedido(uuid,bigint,text)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.pedido_elegivel_cancelamento(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'db/105: a public Pedido writer is not executable by authenticated';
  END IF;
  IF has_function_privilege('anon',         'public.cancelar_pedido(uuid,bigint,text)', 'EXECUTE')
     OR has_function_privilege('service_role', 'public.cancelar_pedido(uuid,bigint,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'db/105: cancelar_pedido must not be reachable by anon or service_role';
  END IF;

  -- 11.5 P1 installs NO direct-DML containment. db/106 owns that, in P4.
  IF EXISTS (
    SELECT 1 FROM pg_proc p
     WHERE p.pronamespace = 'public'::regnamespace
       AND p.proname = 'trg_fato_protegido_fence'
  ) THEN
    RAISE EXCEPTION 'db/105: trg_fato_protegido_fence belongs to db/106 (P4) and must not exist in P1';
  END IF;
  IF NOT has_table_privilege('authenticated', 'public.pedidos', 'UPDATE') THEN
    RAISE EXCEPTION 'db/105: P1 must not revoke the existing authenticated UPDATE on pedidos';
  END IF;

  -- 11.6 The cutover remains untouched.
  PERFORM 1 FROM public.ordem_compra_cutover
   WHERE id = 1 AND status = 'legacy_active' AND read_authority = 'flat';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'db/105: ordem_compra_cutover is not legacy_active/flat';
  END IF;
END
$db105$;

COMMIT;
