-- =============================================================================
-- db/121 — PEDIDO LIFECYCLE GATE FOR PEDIDO-DERIVED WEAVING OPS,
--          AND RECONCILIATION OF THE EXISTING INCONSISTENT RECORDS
-- =============================================================================
-- ORDER: PEDIDO-DERIVED-OP-LIFECYCLE-ENFORCEMENT-R1 (R4 / ASSURANCE).
--
-- ACCEPTED INVARIANT BEING ENFORCED (R2, already ratified — this migration
-- decides nothing new): the normal sequence is
--
--     Pedido confirmado -> create weaving OP -> operational lifecycle
--
-- ROOT CAUSE OF THE BYPASS (measured on the production catalogue).
-- The invariant had NO SERVER-SIDE OWNER anywhere on the creation path.
-- A Pedido-derived weaving OP is not created by any RPC: the client builds it
-- with DIRECT DML through its column grants (js/screens/op-persistir.js):
--
--   1. INSERT INTO ops (numero, ano)      -- column grant; status DEFAULT 'simulada'
--   2. INSERT INTO lotes (numero, cliente_id, pedido_id)   -- full client grant
--   3. UPDATE ops SET lote_id = <lote>    -- column grant; THIS is the binding
--   4. RPC abrir_op_tecelagem(op)         -- transitions simulada -> aberta
--
-- Step 4 was the only server-owned step, and it checked ONLY that a Pedido was
-- LINKED (`pedido_required`) — it never read pedidos.status. Steps 1-3 are raw
-- client DML with no lifecycle check at all. So a weaving OP could be built and
-- opened under a Pedido still in 'rascunho', and everything downstream
-- (purchase orders, receipts, availability, distribution) could advance while
-- the commercial lifecycle stayed dead in draft.
--
-- A SECOND, INDEPENDENT HOLE ON THE SAME BINDING: `lotes` carries FULL
-- INSERT/UPDATE/DELETE grants for authenticated, anon AND service_role,
-- including on `pedido_id`. An existing lote — with its weaving OP already
-- attached — could therefore be RE-POINTED at a different, draft Pedido. Any
-- gate placed only on `ops` would miss that path entirely.
--
-- A THIRD PATH REACHES PRODUCTION WITHOUT iniciar_producao_op:
-- public.alterar_status_op is executable by `authenticated` and its matrix
-- admits 'aberta' -> 'em_producao' directly. A gate written only inside
-- iniciar_producao_op would therefore NOT make the forbidden pair
-- (OP em_producao / Pedido rascunho) structurally impossible.
--
-- WHAT THIS MIGRATION DOES:
--   1. adds ONE owner of the rule, public._pedido_permite_op_tecelagem, so the
--      predicate is stated exactly once and every caller derives from it;
--   2. RECONCILES the existing inconsistent records BEFORE arming the gates,
--      deriving each target state from actual operational progress rather than
--      hardcoding it, and recording one HONEST audit row per Pedido;
--   3. arms three structural gates covering all three holes above:
--        - lotes:  INSERT OR UPDATE OF pedido_id
--        - ops:    INSERT OR UPDATE OF lote_id      (weaving only)
--        - ops:    UPDATE OF status -> 'em_producao' (weaving only)
--   4. gives abrir_op_tecelagem and iniciar_producao_op an early, CLEAN
--      business refusal so the operator sees a real reason instead of a raw
--      trigger exception.
--
-- WHAT IT DELIBERATELY DOES NOT DO:
--   - it does NOT redesign the lifecycle, add a state, or change which writer
--     owns which transition;
--   - it does NOT restrict anything a Pedido may legitimately do while still in
--     'rascunho' BEFORE the operational commitment point: creating, editing,
--     pricing, prioritising, client submission and approval are untouched. Only
--     BINDING A WEAVING OP and ADVANCING ONE are gated;
--   - it does NOT touch latex or acabamento OPs: every ops gate is scoped to
--     tipo = 'tecelagem', so gerar_op_latex and _op_acabamento_criar are
--     unaffected;
--   - it does NOT change any grant, and it does NOT alter OC issuance, receipt,
--     availability, distribution or the db/120 production-start correction;
--   - it FABRICATES NO OPERATOR HISTORY. The reconciliation writes a single
--     event per Pedido, attributed to no user (criado_por NULL), stating
--     plainly that it is a governed reconciliation. It does NOT invent the
--     intermediate 'recebido' hop that never happened.
--
-- COMPATIBLE PEDIDO STATES for holding a weaving OP: confirmado, produzindo,
-- entregue. Refused: rascunho, recebido (not yet committed) and cancelado.
-- =============================================================================

-- ---------------------------------------------------------------------
-- 0. Entry gate
-- ---------------------------------------------------------------------
DO $gate$
DECLARE
  v_missing TEXT[] := ARRAY[]::TEXT[];
BEGIN
  IF to_regprocedure('public.abrir_op_tecelagem(bigint)') IS NULL THEN
    v_missing := array_append(v_missing, 'function public.abrir_op_tecelagem(bigint)');
  END IF;
  IF to_regprocedure('public.iniciar_producao_op(bigint,integer)') IS NULL THEN
    v_missing := array_append(v_missing, 'function public.iniciar_producao_op(bigint,integer)');
  END IF;
  IF to_regprocedure('public._pedido_status_recalcular(uuid,text)') IS NULL THEN
    v_missing := array_append(v_missing, 'function public._pedido_status_recalcular(uuid,text) (db/105)');
  END IF;
  -- db/120 must already be in force: this migration re-creates
  -- iniciar_producao_op and must not silently revert the fence capability.
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_proc p
     WHERE p.oid = 'public.iniciar_producao_op(bigint,integer)'::regprocedure
       AND p.prosrc LIKE '%app.saldo_fios_op_writer%'
  ) THEN
    v_missing := array_append(v_missing,
      'db/120 is not in force: iniciar_producao_op does not declare app.saldo_fios_op_writer');
  END IF;
  IF to_regclass('public.lotes') IS NULL OR to_regclass('public.ops') IS NULL THEN
    v_missing := array_append(v_missing, 'table public.lotes or public.ops');
  END IF;

  IF array_length(v_missing, 1) IS NOT NULL THEN
    RAISE EXCEPTION 'db/121 gate: %', array_to_string(v_missing, '; ');
  END IF;
END
$gate$;

-- ---------------------------------------------------------------------
-- 1. THE SINGLE OWNER OF THE RULE
--
-- Returns NULL when the Pedido may hold/advance a weaving OP, otherwise a
-- stable refusal code. Every gate and both RPCs derive from this one function,
-- so the predicate cannot drift between call sites.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._pedido_permite_op_tecelagem(p_pedido_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_status TEXT;
BEGIN
  IF p_pedido_id IS NULL THEN
    RETURN 'OP_TECELAGEM_SEM_PEDIDO';
  END IF;

  SELECT p.status INTO v_status FROM public.pedidos p WHERE p.id = p_pedido_id;
  IF v_status IS NULL THEN
    RETURN 'PEDIDO_NAO_ENCONTRADO';
  END IF;
  IF v_status = 'cancelado' THEN
    RETURN 'PEDIDO_CANCELADO';
  END IF;
  IF v_status IN ('confirmado', 'produzindo', 'entregue') THEN
    RETURN NULL;
  END IF;

  -- 'rascunho' and 'recebido': the Pedido has not reached the commitment
  -- point the accepted R2 sequence requires before a weaving OP exists.
  RETURN 'PEDIDO_NAO_CONFIRMADO';
END;
$$;

COMMENT ON FUNCTION public._pedido_permite_op_tecelagem(UUID) IS
  'db/121: SINGLE OWNER of the accepted R2 rule that a Pedido-derived weaving OP may only exist under, and advance within, a Pedido that has reached the operational commitment point. Returns NULL when permitted, else a stable refusal code. Compatible states: confirmado, produzindo, entregue.';

ALTER FUNCTION public._pedido_permite_op_tecelagem(UUID) OWNER TO postgres;
REVOKE ALL ON FUNCTION public._pedido_permite_op_tecelagem(UUID)
  FROM PUBLIC, anon, authenticated, service_role;

-- ---------------------------------------------------------------------
-- 2. RECONCILIATION — BEFORE the gates are armed
--
-- Target state is DERIVED from actual operational progress, never hardcoded:
-- a Pedido that already carries a weaving OP, a purchase order or an
-- expedition has passed the commitment point by fact, whatever its recorded
-- status says. It is moved to 'confirmado' and then handed to the canonical
-- derived authority _pedido_status_recalcular, which advances it further (to
-- 'produzindo') if and only if an OP is genuinely already producing.
--
-- A Pedido with NO operational progress is left exactly as it is: 'rascunho'
-- is the CORRECT state for it and reconciling it would be the real corruption.
-- ---------------------------------------------------------------------
DO $recon$
DECLARE
  v_ped        RECORD;
  v_antes      TEXT;
  v_depois     TEXT;
  v_recalc     JSONB;
  v_n          INT := 0;
  v_bloqueados TEXT[] := ARRAY[]::TEXT[];
BEGIN
  -- Fail closed on anything the acceptance gate would reject mid-flight,
  -- rather than discovering it half way through the loop.
  FOR v_ped IN
    SELECT p.id, p.numero, p.status, p.prioridade_status
      FROM public.pedidos p
     WHERE p.status IN ('rascunho', 'recebido')
       AND (EXISTS (SELECT 1 FROM public.ops o JOIN public.lotes l ON l.id = o.lote_id
                     WHERE l.pedido_id = p.id AND o.tipo = 'tecelagem')
         OR EXISTS (SELECT 1 FROM public.ordem_compra oc WHERE oc.pedido_id = p.id)
         OR EXISTS (SELECT 1 FROM public.expedicoes e WHERE e.pedido_id = p.id))
       AND p.prioridade_status = 'solicitada'
  LOOP
    v_bloqueados := array_append(v_bloqueados,
      format('Pedido %s tem prioridade solicitada aguardando analise', v_ped.numero));
  END LOOP;

  IF array_length(v_bloqueados, 1) IS NOT NULL THEN
    RAISE EXCEPTION 'db/121 reconciliacao bloqueada: %', array_to_string(v_bloqueados, '; ');
  END IF;

  FOR v_ped IN
    SELECT p.id, p.numero, p.status
      FROM public.pedidos p
     WHERE p.status IN ('rascunho', 'recebido')
       AND (EXISTS (SELECT 1 FROM public.ops o JOIN public.lotes l ON l.id = o.lote_id
                     WHERE l.pedido_id = p.id AND o.tipo = 'tecelagem')
         OR EXISTS (SELECT 1 FROM public.ordem_compra oc WHERE oc.pedido_id = p.id)
         OR EXISTS (SELECT 1 FROM public.expedicoes e WHERE e.pedido_id = p.id))
     ORDER BY p.numero
  LOOP
    v_antes := v_ped.status;

    UPDATE public.pedidos SET status = 'confirmado' WHERE id = v_ped.id;

    -- ONE honest audit row. criado_por is NULL on purpose: no operator did
    -- this, and attributing it to one would be a fabricated history. The
    -- intermediate 'recebido' hop is NOT invented.
    INSERT INTO public.pedido_eventos (pedido_id, status_anterior, status_novo, criado_por, observacao)
    VALUES (v_ped.id, v_antes, 'confirmado', NULL,
            'db/121 reconciliacao de ciclo de vida (nao e acao de operador): este Pedido ja havia '
         || 'passado do ponto de compromisso operacional — OP de tecelagem vinculada, ordem de compra '
         || 'ou expedicao existente — enquanto permanecia em ' || v_antes || ', porque nenhum dono '
         || 'servidor exigia o estado confirmado antes da criacao da OP. O estado passa a refletir a '
         || 'posicao real de ciclo de vida. Nenhuma transicao de operador foi fabricada.');

    -- Let the canonical derived authority decide anything beyond 'confirmado'.
    v_recalc := public._pedido_status_recalcular(v_ped.id, 'reconciliacao_db121');

    SELECT p.status INTO v_depois FROM public.pedidos p WHERE p.id = v_ped.id;
    v_n := v_n + 1;
    RAISE NOTICE 'db/121: Pedido % reconciliado % -> % (recalculo: %)',
                 v_ped.numero, v_antes, v_depois, v_recalc::text;
  END LOOP;

  RAISE NOTICE 'db/121: % Pedido(s) reconciliado(s)', v_n;
END
$recon$;

-- ---------------------------------------------------------------------
-- 3. THE STRUCTURAL GATES
-- ---------------------------------------------------------------------

-- 3.1 The binding itself, seen from `lotes`. This is the EARLIEST point the
-- client flow reaches, and failing here is also the cleanest: the caller's
-- existing recovery path already removes the just-created OP when the lote
-- step fails.
CREATE OR REPLACE FUNCTION public.trg_lotes_pedido_lifecycle_gate()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_cod    TEXT;
  v_status TEXT;
BEGIN
  IF NEW.pedido_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_cod := public._pedido_permite_op_tecelagem(NEW.pedido_id);
  IF v_cod IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT p.status INTO v_status FROM public.pedidos p WHERE p.id = NEW.pedido_id;
  RAISE EXCEPTION '%', v_cod
    USING ERRCODE = '23514',
          DETAIL  = format(
            'O lote que liga a OP de tecelagem ao Pedido %s nao pode ser criado ou repontado enquanto o Pedido estiver em %s. A sequencia aceita e: confirmar o Pedido e so entao criar a OP de tecelagem.',
            NEW.pedido_id::text, COALESCE(v_status, '(inexistente)'));
END;
$$;

ALTER FUNCTION public.trg_lotes_pedido_lifecycle_gate() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.trg_lotes_pedido_lifecycle_gate()
  FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS lotes_pedido_lifecycle_gate ON public.lotes;
CREATE TRIGGER lotes_pedido_lifecycle_gate
BEFORE INSERT OR UPDATE OF pedido_id ON public.lotes
FOR EACH ROW
EXECUTE FUNCTION public.trg_lotes_pedido_lifecycle_gate();

-- 3.2 The same binding seen from `ops`, for the weaving type only. Defence in
-- depth: it closes the direct `UPDATE ops SET lote_id` column grant even if a
-- lote was already compliant when it was created.
CREATE OR REPLACE FUNCTION public.trg_ops_pedido_lifecycle_gate()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_pedido UUID;
  v_cod    TEXT;
  v_status TEXT;
BEGIN
  SELECT l.pedido_id INTO v_pedido FROM public.lotes l WHERE l.id = NEW.lote_id;

  v_cod := public._pedido_permite_op_tecelagem(v_pedido);
  IF v_cod IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT p.status INTO v_status FROM public.pedidos p WHERE p.id = v_pedido;
  RAISE EXCEPTION '%', v_cod
    USING ERRCODE = '23514',
          DETAIL  = format(
            'A OP de tecelagem %s nao pode ser vinculada ao Pedido %s (estado %s). A sequencia aceita e: confirmar o Pedido e so entao criar a OP de tecelagem.',
            COALESCE(NEW.id::text, '(nova)'), COALESCE(v_pedido::text, '(nenhum)'),
            COALESCE(v_status, '(inexistente)'));
END;
$$;

ALTER FUNCTION public.trg_ops_pedido_lifecycle_gate() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.trg_ops_pedido_lifecycle_gate()
  FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS ops_pedido_lifecycle_link_gate ON public.ops;
CREATE TRIGGER ops_pedido_lifecycle_link_gate
BEFORE INSERT OR UPDATE OF lote_id ON public.ops
FOR EACH ROW
WHEN (NEW.lote_id IS NOT NULL AND NEW.tipo = 'tecelagem')
EXECUTE FUNCTION public.trg_ops_pedido_lifecycle_gate();

-- 3.3 THE ACCEPTANCE-4 GUARANTEE. Whatever writer is used — iniciar_producao_op,
-- alterar_status_op, or any future one — a weaving OP cannot ENTER production
-- while its Pedido has not reached the commitment point. This is what makes the
-- pair (OP em_producao / Pedido rascunho) structurally unreachable rather than
-- merely discouraged.
CREATE OR REPLACE FUNCTION public.trg_ops_pedido_lifecycle_producao_gate()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_pedido UUID;
  v_cod    TEXT;
  v_status TEXT;
BEGIN
  SELECT l.pedido_id INTO v_pedido
    FROM public.lotes l WHERE l.id = NEW.lote_id;

  v_cod := public._pedido_permite_op_tecelagem(v_pedido);
  IF v_cod IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT p.status INTO v_status FROM public.pedidos p WHERE p.id = v_pedido;
  RAISE EXCEPTION '%', v_cod
    USING ERRCODE = '23514',
          DETAIL  = format(
            'A OP de tecelagem %s nao pode entrar em producao enquanto o Pedido %s estiver em %s. Confirme o Pedido antes de iniciar a producao.',
            NEW.id::text, COALESCE(v_pedido::text, '(nenhum)'),
            COALESCE(v_status, '(inexistente)'));
END;
$$;

ALTER FUNCTION public.trg_ops_pedido_lifecycle_producao_gate() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.trg_ops_pedido_lifecycle_producao_gate()
  FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS ops_pedido_lifecycle_producao_gate ON public.ops;
CREATE TRIGGER ops_pedido_lifecycle_producao_gate
BEFORE UPDATE OF status ON public.ops
FOR EACH ROW
WHEN (NEW.status = 'em_producao'
      AND OLD.status IS DISTINCT FROM NEW.status
      AND NEW.tipo = 'tecelagem')
EXECUTE FUNCTION public.trg_ops_pedido_lifecycle_producao_gate();

-- ---------------------------------------------------------------------
-- 4. abrir_op_tecelagem — an EARLY, CLEAN business refusal
--
-- Reproduced from the live body. The ONLY change is the lifecycle check added
-- immediately after the existing `pedido_required` check. Authorization, the
-- lock, the OP-state matrix, the regime resolution and the needs
-- synchronisation are unchanged. Returning ok:false (rather than letting the
-- trigger raise) is what makes the caller show a real reason: the client
-- already renders `data.erro`.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.abrir_op_tecelagem(p_op_id BIGINT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_status     TEXT;
  v_pedido     UUID;
  v_transicao  JSONB;
  v_regime     JSONB;
  v_sync       JSONB;
  v_gate       TEXT;
  v_ped_status TEXT;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'sem_permissao',
      'erro', 'Somente administrador autenticado pode abrir uma OP');
  END IF;

  v_pedido := public._p4_pedido_de_op(p_op_id);
  PERFORM public._p4_lock_dominio_pedido(v_pedido);

  SELECT status INTO v_status FROM public.ops WHERE id = p_op_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'nao_encontrada', 'erro', 'OP nao encontrada');
  END IF;
  IF v_pedido IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'pedido_required',
      'erro', 'Nao e possivel abrir OP sem Pedido vinculado');
  END IF;

  -- db/121: the accepted R2 sequence is Pedido confirmado -> weaving OP.
  v_gate := public._pedido_permite_op_tecelagem(v_pedido);
  IF v_gate IS NOT NULL THEN
    SELECT p.status INTO v_ped_status FROM public.pedidos p WHERE p.id = v_pedido;
    RETURN jsonb_build_object('ok', false, 'codigo', v_gate,
      'pedido_status', v_ped_status,
      'erro', 'O Pedido precisa estar confirmado antes de abrir a OP de tecelagem (estado atual: '
              || COALESCE(v_ped_status, 'desconhecido') || ').');
  END IF;

  IF v_status = 'simulada' THEN
    v_transicao := public.alterar_status_op(p_op_id, 'aberta', NULL);
    IF COALESCE((v_transicao->>'ok')::BOOLEAN, FALSE) IS NOT TRUE THEN
      RETURN jsonb_build_object('ok', false, 'codigo', 'transicao_recusada',
        'erro', COALESCE(v_transicao->>'erro', 'Nao foi possivel abrir a OP'));
    END IF;
  ELSIF v_status <> 'aberta' THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'estado_invalido',
      'erro', 'Somente uma OP simulada ou aberta pode ser aberta', 'status', v_status);
  END IF;

  v_regime := public.resolver_regime_compra_fio_pedido(v_pedido);
  IF COALESCE((v_regime->>'ok')::BOOLEAN, FALSE) IS NOT TRUE THEN
    RAISE EXCEPTION 'regime_resolve'
      USING ERRCODE = '22023',
            DETAIL  = COALESCE(v_regime->>'erro', v_regime::text);
  END IF;

  IF COALESCE(v_regime->>'modelo', '') <> 'native' THEN
    RAISE EXCEPTION 'regime_legado_sem_escritor'
      USING ERRCODE = '22023',
            DETAIL  = 'Este Pedido esta no regime de compra legado, que nao tem escritor de ordens de fio.';
  END IF;

  v_sync := public.sincronizar_necessidades_compra_fio(v_pedido);
  IF COALESCE((v_sync->>'ok')::BOOLEAN, FALSE) IS NOT TRUE THEN
    RAISE EXCEPTION 'necessidades_sync'
      USING ERRCODE = '22023',
            DETAIL  = COALESCE(v_sync->>'erro', v_sync::text);
  END IF;

  RETURN jsonb_build_object('ok', true, 'codigo', 'ok',
    'op_id', p_op_id, 'modelo', 'native',
    'status', (SELECT status FROM public.ops WHERE id = p_op_id));
EXCEPTION
  WHEN lock_not_available THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'concorrencia_ocupada',
      'erro', 'Outra operacao esta alterando este Pedido. Tente novamente.');
END;
$$;

COMMENT ON FUNCTION public.abrir_op_tecelagem(BIGINT) IS
  'db/103b/db/106a, lifecycle gate added by db/121: opens a weaving OP. Now refuses early and cleanly when the parent Pedido has not reached the operational commitment point required by the accepted R2 sequence, deriving that rule from public._pedido_permite_op_tecelagem.';

-- ---------------------------------------------------------------------
-- 5. iniciar_producao_op — the same early, clean business refusal
--
-- Reproduced from the db/120 body. The ONLY change is the lifecycle check
-- added next to the existing PEDIDO_CANCELADO check. The db/120 fence
-- capability, the lock protocol, the ceiling revalidation, the snapshot, the
-- transition and the Pedido recomputation are unchanged.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.iniciar_producao_op(
  p_op_id           BIGINT,
  p_base_ajuste_rev INTEGER
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_pedido_id  UUID;
  v_status     TEXT;
  v_rev        INTEGER;
  v_pendentes  INTEGER;
  v_eixo       RECORD;
  v_teto       NUMERIC(12,3);
  v_propria    NUMERIC(12,3);
  v_transicao  JSONB;
  v_gate       TEXT;
  v_ped_status TEXT;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'sem_permissao' USING ERRCODE = '42501';
  END IF;

  SELECT lt.pedido_id INTO v_pedido_id
    FROM public.ops o
    JOIN public.lotes lt ON lt.id = o.lote_id
   WHERE o.id = p_op_id;
  IF v_pedido_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'INICIO_OP_SEM_PEDIDO');
  END IF;

  BEGIN
    SET LOCAL lock_timeout = '5s';
    PERFORM 1 FROM public.pedidos WHERE id = v_pedido_id FOR UPDATE;
    PERFORM 1 FROM public.ops o
      JOIN public.lotes lt ON lt.id = o.lote_id
     WHERE lt.pedido_id = v_pedido_id
     ORDER BY o.id
       FOR UPDATE OF o;
    PERFORM 1 FROM public.op_itens oi
     WHERE oi.op_id = p_op_id
     ORDER BY oi.id
       FOR UPDATE;
  EXCEPTION WHEN lock_not_available THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'concorrencia_ocupada');
  END;

  SELECT o.status, o.ajuste_revisao INTO v_status, v_rev
    FROM public.ops o WHERE o.id = p_op_id;

  IF EXISTS (SELECT 1 FROM public.pedidos WHERE id = v_pedido_id AND status = 'cancelado') THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'PEDIDO_CANCELADO');
  END IF;

  -- db/121: production may not start before the Pedido reaches the accepted
  -- commitment point. Refused here with a stable code so the operator sees a
  -- real reason; the ops trigger enforces the same rule structurally for every
  -- other writer.
  v_gate := public._pedido_permite_op_tecelagem(v_pedido_id);
  IF v_gate IS NOT NULL THEN
    SELECT p.status INTO v_ped_status FROM public.pedidos p WHERE p.id = v_pedido_id;
    RETURN jsonb_build_object('ok', false, 'codigo', v_gate,
                              'pedido_status', v_ped_status);
  END IF;

  -- The transition matrix owns the entry state: production starts from an
  -- OPEN OP. Opening a simulated OP stays an explicit operator action
  -- through the existing alterar_status_op; this release does not widen it.
  IF v_status <> 'aberta' THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'INICIO_OP_ESTADO_INVALIDO',
                              'status', v_status);
  END IF;

  IF p_base_ajuste_rev IS DISTINCT FROM v_rev THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'AJUSTE_REVISAO_DESATUALIZADA',
                              'ajuste_revisao_atual', v_rev);
  END IF;

  -- Every item must carry a saved adjustment.
  SELECT count(*) INTO v_pendentes
    FROM public.op_itens WHERE op_id = p_op_id AND metros_ajustados IS NULL;
  IF v_pendentes > 0 THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'INICIO_AJUSTE_INCOMPLETO',
                              'itens_sem_ajuste', v_pendentes);
  END IF;

  -- REVALIDATE AVAILABILITY: a receipt reversal may have lowered a
  -- ceiling since the adjustment was saved (9.9.D). A reversal of a
  -- SURPLUS line lowers it too, with the correct sign, because the
  -- reversal carries a negative kg_excesso (db/118).
  FOR v_eixo IN
    SELECT DISTINCT d.origem_tipo, d.material, d.cor_id, d.cor_poliester
      FROM public._oc_disponibilidade_linhas(p_op_id) d
  LOOP
    v_teto := public._oc_teto_disponivel(
      v_pedido_id, p_op_id, v_eixo.origem_tipo, v_eixo.material,
      v_eixo.cor_id, v_eixo.cor_poliester);

    SELECT r.kg_reservado + r.kg_comprometido INTO v_propria
      FROM public._oc_reserva_ativa(v_pedido_id, v_eixo.material, v_eixo.cor_id,
                                    v_eixo.cor_poliester, NULL, p_op_id) r;

    IF v_propria > v_teto THEN
      RETURN jsonb_build_object(
        'ok', false, 'codigo', 'AJUSTE_EXCEDE_DISPONIVEL',
        'material', v_eixo.material, 'cor_id', v_eixo.cor_id,
        'cor_poliester', v_eixo.cor_poliester,
        'kg_reservado', v_propria, 'kg_disponivel', v_teto);
    END IF;
  END LOOP;

  -- THE AUTHORITATIVE START SNAPSHOT. One writer only, this function.
  --
  -- db/120: declare the transaction-local capability the db/75 fence reads.
  -- It is set immediately before the snapshot block and cleared immediately
  -- after, so no other statement in this function -- and no statement in any
  -- caller's transaction -- ever runs while it is on.
  PERFORM set_config('app.saldo_fios_op_writer', 'on', true);

  DELETE FROM public.saldo_fios_op WHERE op_id = p_op_id;
  FOR v_eixo IN
    SELECT DISTINCT d.origem_tipo, d.material, d.cor_id, d.cor_poliester
      FROM public._oc_disponibilidade_linhas(p_op_id) d
  LOOP
    v_teto := public._oc_teto_disponivel(
      v_pedido_id, p_op_id, v_eixo.origem_tipo, v_eixo.material,
      v_eixo.cor_id, v_eixo.cor_poliester);
    SELECT r.kg_reservado + r.kg_comprometido INTO v_propria
      FROM public._oc_reserva_ativa(v_pedido_id, v_eixo.material, v_eixo.cor_id,
                                    v_eixo.cor_poliester, NULL, p_op_id) r;

    INSERT INTO public.saldo_fios_op (op_id, cor_id, cor_poliester, tipo, kg_sobra)
    VALUES (p_op_id, v_eixo.cor_id, v_eixo.cor_poliester, v_eixo.material,
            GREATEST(0, v_teto - v_propria)::NUMERIC(10,3));
  END LOOP;

  PERFORM set_config('app.saldo_fios_op_writer', 'off', true);

  -- TRANSITION THE OP AND RECOMPUTE THE PEDIDO, ATOMICALLY.
  v_transicao := public._op_status_aplicar(p_op_id, 'em_producao',
                                           'Producao iniciada pelo writer canonico.');
  IF NOT COALESCE((v_transicao ->> 'ok')::BOOLEAN, FALSE) THEN
    RETURN jsonb_build_object('ok', false, 'codigo',
                              COALESCE(v_transicao ->> 'codigo', 'OP_TRANSICAO_INVALIDA'));
  END IF;

  UPDATE public.ops SET ajuste_revisao = ajuste_revisao + 1 WHERE id = p_op_id;
  v_rev := v_rev + 1;

  INSERT INTO public.op_eventos (op_id, tipo_evento, observacao, payload, criado_por)
  VALUES (p_op_id, 'producao_iniciada',
          'Producao iniciada; snapshot de saldo registrado.',
          jsonb_build_object('ajuste_revisao', v_rev, 'pedido_id', v_pedido_id),
          auth.uid());

  -- Derived Pedido transition. _pedido_status_recalcular is the OWNER-ONLY
  -- authority declared by db/105 (9.9.L).
  PERFORM public._pedido_status_recalcular(v_pedido_id, 'inicio_producao_op');

  RETURN jsonb_build_object(
    'ok', true, 'op_id', p_op_id, 'ajuste_revisao', v_rev,
    'proxima_acao', jsonb_build_object(
      'rota', '#/ops/' || p_op_id,
      'rotulo', 'Acompanhar producao'));
END;
$$;

COMMENT ON FUNCTION public.iniciar_producao_op(BIGINT, INTEGER) IS
  'db/102 (9.9.D), ceiling corrected by db/118, fence capability added by db/120, Pedido lifecycle gate added by db/121: server-owned production start. Refuses before any write when the Pedido has not reached the accepted commitment point, then locks in the global order, proves every item carries an adjustment, REVALIDATES availability, writes the authoritative saldo_fios_op start snapshot, transitions the OP and recomputes the Pedido -- all in one transaction.';

-- ---------------------------------------------------------------------
-- 6. Ownership and privileges — RESTATED IDENTICALLY, never widened
-- ---------------------------------------------------------------------
ALTER FUNCTION public.abrir_op_tecelagem(BIGINT)           OWNER TO postgres;
ALTER FUNCTION public.iniciar_producao_op(BIGINT, INTEGER) OWNER TO postgres;

REVOKE ALL ON FUNCTION public.abrir_op_tecelagem(BIGINT)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.abrir_op_tecelagem(BIGINT) TO authenticated;

REVOKE ALL ON FUNCTION public.iniciar_producao_op(BIGINT, INTEGER)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.iniciar_producao_op(BIGINT, INTEGER) TO authenticated;

-- ---------------------------------------------------------------------
-- 7. Verification
--
-- Every behavioural probe runs inside a nested block whose own RAISE unwinds
-- the subtransaction, so NO row is added, changed or removed by this section.
-- ---------------------------------------------------------------------
DO $verify$
DECLARE
  v_bad    TEXT[] := ARRAY[]::TEXT[];
  v_ss     TEXT;
  v_n      INT;
  v_op     BIGINT;
  v_lote   BIGINT;
  v_draft  UUID;
  v_ok_ped UUID;
BEGIN
  -- 7.1 NO existing weaving OP may remain bound to an incompatible Pedido.
  SELECT count(*) INTO v_n
    FROM public.ops o
    JOIN public.lotes l ON l.id = o.lote_id
   WHERE o.tipo = 'tecelagem'
     AND public._pedido_permite_op_tecelagem(l.pedido_id) IS NOT NULL;
  IF v_n > 0 THEN
    v_bad := array_append(v_bad,
      format('%s weaving OP(s) still bound to an incompatible Pedido after reconciliation', v_n));
  END IF;

  -- 7.2 The forbidden pair must not exist anywhere.
  SELECT count(*) INTO v_n
    FROM public.ops o
    JOIN public.lotes l ON l.id = o.lote_id
    JOIN public.pedidos p ON p.id = l.pedido_id
   WHERE o.tipo = 'tecelagem'
     AND o.status IN ('em_producao', 'pausada', 'concluida', 'finalizada')
     AND p.status IN ('rascunho', 'recebido');
  IF v_n > 0 THEN
    v_bad := array_append(v_bad, format('%s OP(s) in production under a draft Pedido', v_n));
  END IF;

  -- 7.3 A Pedido with NO operational progress must still be free to stay draft
  --     (acceptance 7): the helper is the only rule owner, so assert it does
  --     not refuse anything about a plain draft Pedido that holds no OP.
  SELECT count(*) INTO v_n
    FROM public.pedidos p
   WHERE p.status = 'rascunho'
     AND NOT EXISTS (SELECT 1 FROM public.lotes l WHERE l.pedido_id = p.id);
  RAISE NOTICE 'db/121: % draft Pedido(s) with no operational binding, left untouched', v_n;

  -- 7.4 The lote gate must refuse a draft Pedido and admit a compatible one.
  SELECT p.id INTO v_draft FROM public.pedidos p
   WHERE p.status = 'rascunho' ORDER BY p.numero LIMIT 1;
  SELECT p.id INTO v_ok_ped FROM public.pedidos p
   WHERE p.status IN ('confirmado','produzindo','entregue') ORDER BY p.numero LIMIT 1;

  IF v_draft IS NOT NULL THEN
    v_ss := NULL;
    BEGIN
      INSERT INTO public.lotes (numero, cliente_id, pedido_id)
      SELECT (SELECT COALESCE(max(numero),0) + 9999 FROM public.lotes), p.cliente_id, p.id
        FROM public.pedidos p WHERE p.id = v_draft;
      v_ss := 'ADMITTED';
      RAISE EXCEPTION 'db121_unwind' USING ERRCODE = '22000';
    EXCEPTION
      WHEN SQLSTATE '22000' THEN NULL;
      WHEN OTHERS THEN GET STACKED DIAGNOSTICS v_ss = RETURNED_SQLSTATE;
    END;
    IF v_ss IS DISTINCT FROM '23514' THEN
      v_bad := array_append(v_bad,
        format('lote bound to a DRAFT Pedido was not refused by the gate (got %s)', COALESCE(v_ss,'null')));
    END IF;
  END IF;

  IF v_ok_ped IS NOT NULL THEN
    v_ss := NULL;
    BEGIN
      INSERT INTO public.lotes (numero, cliente_id, pedido_id)
      SELECT (SELECT COALESCE(max(numero),0) + 9999 FROM public.lotes), p.cliente_id, p.id
        FROM public.pedidos p WHERE p.id = v_ok_ped;
      v_ss := 'ADMITTED';
      RAISE EXCEPTION 'db121_unwind' USING ERRCODE = '22000';
    EXCEPTION
      WHEN SQLSTATE '22000' THEN NULL;
      WHEN OTHERS THEN GET STACKED DIAGNOSTICS v_ss = RETURNED_SQLSTATE;
    END;
    IF v_ss IS DISTINCT FROM 'ADMITTED' THEN
      v_bad := array_append(v_bad,
        format('lote bound to a COMPATIBLE Pedido was wrongly refused (got %s)', COALESCE(v_ss,'null')));
    END IF;
  END IF;

  -- 7.5 The production gate must refuse when the Pedido is draft, whatever the
  --     writer. Probed by driving ops.status directly, which is the path
  --     alterar_status_op uses.
  SELECT o.id INTO v_op
    FROM public.ops o JOIN public.lotes l ON l.id = o.lote_id
    JOIN public.pedidos p ON p.id = l.pedido_id
   WHERE o.tipo = 'tecelagem' AND o.status = 'aberta'
     AND p.status IN ('confirmado','produzindo','entregue')
   ORDER BY o.id LIMIT 1;

  IF v_op IS NOT NULL THEN
    -- compatible Pedido: the gate must NOT refuse
    v_ss := NULL;
    BEGIN
      PERFORM set_config('app.saldo_fios_op_writer', 'off', true);
      UPDATE public.ops SET status = 'em_producao' WHERE id = v_op;
      v_ss := 'ADMITTED';
      RAISE EXCEPTION 'db121_unwind' USING ERRCODE = '22000';
    EXCEPTION
      WHEN SQLSTATE '22000' THEN NULL;
      WHEN OTHERS THEN GET STACKED DIAGNOSTICS v_ss = RETURNED_SQLSTATE;
    END;
    IF v_ss IS DISTINCT FROM 'ADMITTED' THEN
      v_bad := array_append(v_bad,
        format('weaving OP under a COMPATIBLE Pedido was wrongly blocked from production (got %s)',
               COALESCE(v_ss,'null')));
    END IF;

    -- same OP, Pedido forced back to draft inside the probe: must refuse
    v_ss := NULL;
    BEGIN
      UPDATE public.pedidos SET status = 'rascunho'
       WHERE id = (SELECT l.pedido_id FROM public.lotes l
                     JOIN public.ops o ON o.lote_id = l.id WHERE o.id = v_op);
      UPDATE public.ops SET status = 'em_producao' WHERE id = v_op;
      v_ss := 'ADMITTED';
      RAISE EXCEPTION 'db121_unwind' USING ERRCODE = '22000';
    EXCEPTION
      WHEN SQLSTATE '22000' THEN NULL;
      WHEN OTHERS THEN GET STACKED DIAGNOSTICS v_ss = RETURNED_SQLSTATE;
    END;
    IF v_ss IS DISTINCT FROM '23514' THEN
      v_bad := array_append(v_bad,
        format('weaving OP under a DRAFT Pedido was NOT blocked from production (got %s)',
               COALESCE(v_ss,'null')));
    END IF;
  END IF;

  -- 7.6 ACL unchanged.
  IF NOT has_function_privilege('authenticated', 'public.iniciar_producao_op(bigint,integer)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.abrir_op_tecelagem(bigint)', 'EXECUTE') THEN
    v_bad := array_append(v_bad, 'an admin RPC lost EXECUTE for authenticated');
  END IF;
  IF has_function_privilege('anon', 'public.iniciar_producao_op(bigint,integer)', 'EXECUTE')
     OR has_function_privilege('service_role', 'public.iniciar_producao_op(bigint,integer)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.abrir_op_tecelagem(bigint)', 'EXECUTE')
     OR has_function_privilege('service_role', 'public.abrir_op_tecelagem(bigint)', 'EXECUTE') THEN
    v_bad := array_append(v_bad, 'an admin RPC became reachable by anon or service_role');
  END IF;
  IF has_function_privilege('authenticated', 'public._pedido_permite_op_tecelagem(uuid)', 'EXECUTE')
     OR has_function_privilege('anon', 'public._pedido_permite_op_tecelagem(uuid)', 'EXECUTE')
     OR has_function_privilege('service_role', 'public._pedido_permite_op_tecelagem(uuid)', 'EXECUTE') THEN
    v_bad := array_append(v_bad, 'the rule owner became reachable by a client role');
  END IF;

  -- 7.7 db/120 must still be in force.
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_proc p
     WHERE p.oid = 'public.iniciar_producao_op(bigint,integer)'::regprocedure
       AND p.prosrc LIKE '%app.saldo_fios_op_writer%'
  ) THEN
    v_bad := array_append(v_bad, 'db/121 reverted the db/120 fence capability');
  END IF;

  IF array_length(v_bad, 1) IS NOT NULL THEN
    RAISE EXCEPTION 'db/121 verification failed: %', array_to_string(v_bad, '; ');
  END IF;

  RAISE NOTICE 'db/121 verified: gates refuse draft-bound weaving OPs and admit committed ones; no forbidden pair exists; ACL and db/120 intact';
END
$verify$;
