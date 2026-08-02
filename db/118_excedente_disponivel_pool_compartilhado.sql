-- =====================================================================
-- db/118 — RECEIVED SURPLUS IS PRODUCTION MATERIAL (forward correction)
--
-- RESTORE-ORIGINAL-RECEIVED-MATERIAL-SLIDER-SEMANTICS-R1.
-- Forward correction of PEDIDO_DERIVED_LIFECYCLE_RECOVERY_PLAN.md
-- section 9.9.A.1 / 9.9.A.4 and ORDEM_COMPRA_LIFECYCLE_SPEC_PROPOSED.md
-- section R.33.3.
--
-- THE WITHDRAWN RULE
-- ------------------
-- The native-receipt architecture introduced
--
--     "Surplus is selected separately and never enters an OP ceiling"
--
-- and db/101 implemented it: kg_excedente was reported and then dropped
-- from every ceiling. That rule changed PRODUCT behaviour without a
-- product decision. In the legacy product the production recalculation
-- consumed the FULL actual received quantity — the bottleneck factor was
-- (actual received / originally required) and was explicitly allowed to
-- exceed 1, so a larger receipt increased feasible production metres.
-- The rule is WITHDRAWN by architect decision.
--
-- THE RESTORED PRODUCT SEMANTIC
-- -----------------------------
-- ACTUAL RECEIVED MATERIAL IS THE PRODUCTION INPUT. Per material/colour:
-- shortage reduces production availability, excess receipt increases it,
-- and the whole real received quantity stays economically usable.
-- Classifying part of a receipt as "excesso" preserves PROVENANCE only;
-- it must not make physically received yarn unusable.
--
-- WHAT THIS MIGRATION DOES NOT DO
-- -------------------------------
-- * It does NOT touch receipt provenance. A surplus line keeps
--   ordem_compra_item_alocacao_id IS NULL and op_id IS NULL, exactly as
--   ordem_compra_fio_lancamentos_native_shape requires. No allocation and
--   no OP is fabricated for surplus, and no ledger row is written,
--   rewritten or reclassified here.
-- * It does NOT make public.saldo_fios an availability authority. TD1 and
--   R.33.2 are UNCHANGED and still binding: the surplus term is read from
--   public.ordem_compra_fio_lancamentos.kg_excesso, the native receipt
--   ledger, never from saldo_fios. The db/101 structural assertion that
--   no availability object references saldo_fios is re-asserted below and
--   extended to the three new functions.
-- * It creates no table, no column, no trigger, no policy and no grant on
--   any table. It writes no business row.
--
-- THE SIBLING-OP PROBLEM AND ITS INVARIANT
-- ----------------------------------------
-- The legacy app had ONE OP per recalculation and therefore no sharing
-- problem. A Pedido may now carry several OPs. Unallocated receipt
-- surplus is a SHARED MATERIAL POOL within its real (Pedido, material,
-- colour) identity — that is already how db/101 attributed the reported
-- kg_excedente, because a surplus line carries no allocation to scope it
-- more narrowly.
--
--     ONE PHYSICAL KG MAY INCREASE PRODUCTION CAPACITY ONLY ONCE.
--
-- Enforced through the EXISTING canonical reservation mechanic
-- (_oc_reserva_ativa, D2), not through a new reservation store:
--
--   Pedido-origin axis (today poliester). The productive net is already
--   ONE shared pool and the ceiling already subtracts every OTHER OP's
--   active reservation. Adding the surplus to that pool is therefore
--   sufficient by itself:
--
--     teto = pool + excedente − reserva_ativa(OUTRAS OPs)
--
--   OP-origin axis (today algodao). The productive net belongs to ONE OP
--   by its own need and a sibling reservation must never reduce it — that
--   9.9.A.2 rule is preserved untouched. Only the SHARED surplus can be
--   contended, so only the part of a sibling's reservation that its OWN
--   productive net cannot cover is a draw on the shared pool:
--
--     draw(j)  = GREATEST(0, reserva_ativa(j) − liquido_produtivo(j))
--     teto     = liquido_produtivo(OP)
--              + GREATEST(0, excedente − SUM(draw(j)) for every j <> OP)
--
--   Summing that bound over all OPs of the axis gives
--   SUM(reserva) <= SUM(liquido) + excedente: total productive
--   commitments can never exceed the real received quantity.
--
-- The TARGET OP's own reservation is still never subtracted, so a
-- replacement adjustment payload still validates against the raw ceiling
-- (9.9.A.2). Unchanged.
--
-- STRICT SUPERSET, NOT A REWRITE
-- ------------------------------
-- With excedente = 0 every ceiling below reduces ALGEBRAICALLY to the
-- db/101 expression it replaces, on both origins. Allocated-receipt
-- behaviour and Pedido-origin shared-pool behaviour are therefore
-- preserved exactly, and the change is visible only where real surplus
-- was actually received.
--
-- SIGN CORRECTNESS ON REVERSAL
-- ----------------------------
-- estornar_recebimento_ordem_compra (db/70) writes a reversal of a
-- surplus line with kg_excesso = -kg. SUM(kg_excesso) therefore nets the
-- reversal out with the correct sign and leaves no phantom surplus
-- availability; no special case is needed, exactly as for the productive
-- net (9.9.A.1).
--
-- ONE CEILING OWNER
-- -----------------
-- db/101 and db/102 carried the same ceiling expression in FOUR places
-- (oc_disponibilidade_op, salvar_ajuste_producao_op, and twice inside
-- iniciar_producao_op). This migration makes public._oc_teto_disponivel
-- the SINGLE executable owner and repoints all four call sites at it, so
-- the client projection, the adjustment writer and the production-start
-- revalidation cannot drift apart. Nothing else in those two writers
-- changes: authorization, lock protocol, revision model, payload
-- validation, refusal codes and every write stay byte-for-byte the
-- behaviour db/102 shipped.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 0. ENTRY GATE
--
-- This is a pre-PONR forward correction of an availability semantic. It
-- refuses to apply once a productive native receipt exists, because the
-- ceiling semantics an accepted receipt was taken under must not change
-- underneath it without a new order.
-- ---------------------------------------------------------------------
DO $db118_gate$
DECLARE
  v_ponr TIMESTAMPTZ;
BEGIN
  SELECT c.productive_receipt_started_at INTO v_ponr
    FROM public.ordem_compra_cutover c WHERE c.id = 1;

  IF v_ponr IS NOT NULL THEN
    RAISE EXCEPTION 'db/118: refused — the PONR is crossed (productive_receipt_started_at = %); an availability semantic may not be changed after it without a new order', v_ponr;
  END IF;

  -- The four functions this migration replaces must already exist, in
  -- the exact identities db/101 and db/102 declared.
  IF to_regprocedure('public.oc_disponibilidade_op(bigint)') IS NULL
     OR to_regprocedure('public.salvar_ajuste_producao_op(bigint,integer,jsonb)') IS NULL
     OR to_regprocedure('public.iniciar_producao_op(bigint,integer)') IS NULL
     OR to_regprocedure('public._oc_material_recebido_liquido(uuid,bigint,text,text,bigint,text)') IS NULL
     OR to_regprocedure('public._oc_reserva_ativa(uuid,text,bigint,text,bigint,bigint)') IS NULL THEN
    RAISE EXCEPTION 'db/118: refused — a db/101 or db/102 availability owner is absent';
  END IF;
END
$db118_gate$;

-- ---------------------------------------------------------------------
-- 1. _oc_excedente_pool — the shared surplus pool (restored semantic)
--
-- EXTRACTED, NOT INVENTED. This is byte-for-byte the predicate db/101
-- already used inline to report kg_excedente: receipt/reversal lines of
-- the orders of THIS Pedido, on this material/colour axis. A surplus
-- line carries NO allocation by construction, so it is attributed by
-- (Pedido, material, colour) — through an allocation that cannot exist
-- would be impossible, and fabricating one is forbidden.
--
-- An ordem_compra whose pedido_id is NULL contributes nothing: the pool
-- fails CLOSED, never open (see NATIVE-OC-PEDIDO-ID-NULLABILITY-
-- ENFORCEMENT-GAP, which this migration neither repairs nor worsens).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._oc_excedente_pool(
  p_pedido_id     UUID,
  p_material      TEXT,
  p_cor_id        BIGINT,
  p_cor_poliester TEXT
) RETURNS NUMERIC(12,3)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT coalesce(sum(l.kg_excesso), 0)::NUMERIC(12,3)
    FROM public.ordem_compra_fio_lancamentos l
    JOIN public.ordem_compra oc ON oc.id = l.ordem_compra_id
   WHERE l.recebimento_id IS NOT NULL
     AND l.kg_excesso <> 0
     AND oc.pedido_id = p_pedido_id
     AND l.material = p_material
     AND l.cor_id IS NOT DISTINCT FROM p_cor_id
     AND l.cor_poliester IS NOT DISTINCT FROM p_cor_poliester;
$$;

COMMENT ON FUNCTION public._oc_excedente_pool(UUID, TEXT, BIGINT, TEXT) IS
  'db/118: the SHARED surplus pool of one (Pedido, material, colour) axis, read from the native receipt ledger kg_excesso. OWNER-ONLY. Reversal lines carry a negative kg_excesso, so the sum nets out and leaves no phantom surplus. Never reads saldo_fios (TD1 / R.33.2). Surplus keeps no allocation and no OP.';

-- ---------------------------------------------------------------------
-- 2. _oc_excedente_consumido — the shared pool already drawn by OTHERS
--
-- Only meaningful on an OP-origin axis, where each OP owns its own
-- productive net. A sibling OP draws on the SHARED pool exactly for the
-- part of its active reservation its own productive net cannot cover.
--
-- Every non-cancelled OP of the Pedido is considered, including one that
-- holds NO need on this axis: such an OP has a productive net of 0, so
-- every kilogram it reserves is by definition drawn from the shared
-- pool. The reservation authority is the existing D2 owner
-- _oc_reserva_ativa; no reservation is invented and none is persisted.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._oc_excedente_consumido(
  p_pedido_id     UUID,
  p_material      TEXT,
  p_cor_id        BIGINT,
  p_cor_poliester TEXT,
  p_excluir_op_id BIGINT DEFAULT NULL
) RETURNS NUMERIC(12,3)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT coalesce(sum(
           GREATEST(
             0,
             r.kg_reservado + r.kg_comprometido
             - public._oc_material_recebido_liquido(
                 p_pedido_id, o.id, 'op', p_material, p_cor_id, p_cor_poliester)
           )), 0)::NUMERIC(12,3)
    FROM public.ops o
    JOIN public.lotes lt ON lt.id = o.lote_id
    CROSS JOIN LATERAL public._oc_reserva_ativa(
      p_pedido_id, p_material, p_cor_id, p_cor_poliester, NULL, o.id) AS r
   WHERE lt.pedido_id = p_pedido_id
     AND o.status <> 'cancelada'
     AND (p_excluir_op_id IS NULL OR o.id <> p_excluir_op_id);
$$;

-- db/101's own comment on the productive-net helper still claimed that
-- "surplus and TD1 saldo_fios can never raise a ceiling". Half of that is
-- withdrawn: TD1 still holds, the surplus half does not. The helper's
-- BEHAVIOUR is unchanged — it still selects allocation-destined lines
-- only — so only the description is corrected here, forward.
COMMENT ON FUNCTION public._oc_material_recebido_liquido(UUID, BIGINT, TEXT, TEXT, BIGINT, TEXT) IS
  'db/101 (9.9.A.1), description corrected by db/118: productive net for one origin-scoped material/colour axis. OWNER-ONLY. Selects allocation-destined ledger lines only; real received SURPLUS reaches the ceiling through the separate shared pool _oc_excedente_pool, and TD1 saldo_fios can never raise a ceiling at all.';

COMMENT ON FUNCTION public._oc_excedente_consumido(UUID, TEXT, BIGINT, TEXT, BIGINT) IS
  'db/118: kilograms of the SHARED surplus pool already drawn by the OTHER OPs of one Pedido on an OP-origin axis, derived as GREATEST(0, active reservation - own productive net) per OP. OWNER-ONLY. This is what stops the same physical kilogram raising two sibling ceilings.';

-- ---------------------------------------------------------------------
-- 3. _oc_teto_disponivel — THE SINGLE CEILING OWNER
--
-- The one executable owner of "how much material may this OP still turn
-- into production on this axis". The client projection, the adjustment
-- writer and the production-start revalidation all call THIS, so they
-- cannot diverge.
--
--   OP-origin      teto = liquido(OP)
--                       + GREATEST(0, excedente - drawn_by_others)
--   Pedido-origin  teto = pool + excedente - reserva(OUTRAS OPs)
--
-- With excedente = 0 both branches are algebraically the db/101
-- expression, which is why allocated-receipt behaviour is unchanged.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._oc_teto_disponivel(
  p_pedido_id     UUID,
  p_op_id         BIGINT,
  p_origem_tipo   TEXT,
  p_material      TEXT,
  p_cor_id        BIGINT,
  p_cor_poliester TEXT
) RETURNS NUMERIC(12,3)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT GREATEST(
           0,
           CASE
             WHEN p_origem_tipo = 'op' THEN
               -- The OP's own committed material, never reduced by a
               -- sibling (9.9.A.2), PLUS whatever is left of the shared
               -- surplus after the other OPs' draws.
               public._oc_material_recebido_liquido(
                 p_pedido_id, p_op_id, p_origem_tipo, p_material, p_cor_id, p_cor_poliester)
               + GREATEST(
                   0,
                   public._oc_excedente_pool(p_pedido_id, p_material, p_cor_id, p_cor_poliester)
                   - public._oc_excedente_consumido(
                       p_pedido_id, p_material, p_cor_id, p_cor_poliester, p_op_id))
             ELSE
               -- One shared pool: allocated net plus surplus, reduced by
               -- every OTHER active OP of the same Pedido (9.9.A.3).
               public._oc_material_recebido_liquido(
                 p_pedido_id, p_op_id, p_origem_tipo, p_material, p_cor_id, p_cor_poliester)
               + public._oc_excedente_pool(p_pedido_id, p_material, p_cor_id, p_cor_poliester)
               - (SELECT r.kg_reservado + r.kg_comprometido
                    FROM public._oc_reserva_ativa(
                      p_pedido_id, p_material, p_cor_id, p_cor_poliester, p_op_id, NULL) r)
           END
         )::NUMERIC(12,3);
$$;

COMMENT ON FUNCTION public._oc_teto_disponivel(UUID, BIGINT, TEXT, TEXT, BIGINT, TEXT) IS
  'db/118: the SINGLE owner of the productive ceiling of one OP on one material/colour axis. Actual received material is the production input: shortage lowers it, real surplus raises it, and the shared surplus pool can raise only one OP ceiling at a time. The target OP''s own reservation is never subtracted. Never reads saldo_fios (TD1 / R.33.2).';

-- ---------------------------------------------------------------------
-- 4. oc_disponibilidade_op — repointed at the single ceiling owner
--
-- Replaces db/101's body. The nine reported quantities, the row shape,
-- the authorization check, the Pedido resolution and the empty-return
-- for an OP with no Pedido lineage are all unchanged. kg_excedente now
-- comes from _oc_excedente_pool (same predicate, extracted) and
-- kg_disponivel from _oc_teto_disponivel.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.oc_disponibilidade_op(p_op_id BIGINT)
RETURNS TABLE (
  necessidade_id              BIGINT,
  origem_tipo                 TEXT,
  material                    TEXT,
  cor_id                      BIGINT,
  cor_poliester               TEXT,
  kg_necessario               NUMERIC(12,3),
  kg_planejado                NUMERIC(12,3),
  kg_comprado_cobertura_ativa NUMERIC(12,3),
  kg_recebido_liquido         NUMERIC(12,3),
  kg_estornado                NUMERIC(12,3),
  kg_excedente                NUMERIC(12,3),
  kg_alocado_op               NUMERIC(12,3),
  kg_reservado_propria_op     NUMERIC(12,3),
  kg_reservado_outras_ops     NUMERIC(12,3),
  kg_comprometido_outras_ops  NUMERIC(12,3),
  kg_disponivel               NUMERIC(12,3)
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_pedido_id UUID;
BEGIN
  -- FIRST executable statement: explicit authorization (9.9.A.5).
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'sem_permissao' USING ERRCODE = '42501';
  END IF;

  SELECT lt.pedido_id INTO v_pedido_id
    FROM public.ops o
    JOIN public.lotes lt ON lt.id = o.lote_id
   WHERE o.id = p_op_id;

  IF v_pedido_id IS NULL THEN
    RETURN;  -- an OP with no Pedido lineage has no native availability
  END IF;

  RETURN QUERY
  SELECT
    d.necessidade_id,
    d.origem_tipo,
    d.material,
    d.cor_id,
    d.cor_poliester,
    d.kg_necessario,
    -- planned: live planning only
    coalesce((SELECT sum(p.kg_planejado)
                FROM public.necessidade_compra_planejamento p
               WHERE p.necessidade_id = d.necessidade_id
                 AND p.gerado_em IS NULL), 0)::NUMERIC(12,3),
    -- purchased under ACTIVE coverage (db/100 oc_cobertura_ativa, reused)
    coalesce((SELECT sum(a.kg_alocado)
                FROM public.ordem_compra_item_alocacao a
                JOIN public.ordem_compra_item it ON it.id = a.item_id
               WHERE a.necessidade_id = d.necessidade_id
                 AND public.oc_cobertura_ativa(it.ordem_id)), 0)::NUMERIC(12,3),
    -- net received (productive), origin-scoped
    public._oc_material_recebido_liquido(
      v_pedido_id, p_op_id, d.origem_tipo, d.material, d.cor_id, d.cor_poliester),
    -- reversed: reported only, never a ceiling term
    coalesce((SELECT -sum(l.kg_recebido)
                FROM public.ordem_compra_fio_lancamentos l
                JOIN public.ordem_compra_item_alocacao a2
                  ON a2.id = l.ordem_compra_item_alocacao_id
               WHERE a2.necessidade_id = d.necessidade_id
                 AND l.tipo = 'estorno'), 0)::NUMERIC(12,3),
    -- surplus: the SHARED pool of this (Pedido, material, colour) axis.
    -- It is reported here AND it is a term of the ceiling below (db/118):
    -- physically received yarn stays economically usable. It carries no
    -- allocation and no OP, so it is attributed by material/colour across
    -- the Pedido's orders rather than through an allocation that cannot
    -- exist.
    public._oc_excedente_pool(v_pedido_id, d.material, d.cor_id, d.cor_poliester),
    -- allocated to this OP = the origin-scoped productive net
    public._oc_material_recebido_liquido(
      v_pedido_id, p_op_id, d.origem_tipo, d.material, d.cor_id, d.cor_poliester),
    own.kg_reservado,
    others.kg_reservado,
    others.kg_comprometido,
    -- THE CEILING — one owner (db/118), shared with the two writers.
    public._oc_teto_disponivel(
      v_pedido_id, p_op_id, d.origem_tipo, d.material, d.cor_id, d.cor_poliester)
  FROM public._oc_disponibilidade_linhas(p_op_id) d
  CROSS JOIN LATERAL public._oc_reserva_ativa(
    v_pedido_id, d.material, d.cor_id, d.cor_poliester, NULL, p_op_id) AS own
  CROSS JOIN LATERAL public._oc_reserva_ativa(
    v_pedido_id, d.material, d.cor_id, d.cor_poliester, p_op_id, NULL) AS others;
END;
$$;

COMMENT ON FUNCTION public.oc_disponibilidade_op(BIGINT) IS
  'db/101 (9.9.A), ceiling corrected by db/118: the ONE client-facing native availability read. Guarded SECURITY DEFINER; admin only. Actual received material is the production input — the real surplus of the Pedido/material/colour axis raises the ceiling, bounded so one physical kilogram raises only one OP. OP-origin ceilings still ignore sibling reservations on their OWN allocated net; Pedido-origin ceilings still subtract other active OPs. The target OP''s OWN reservation is never subtracted. TD1: saldo_fios is not a term.';

-- ---------------------------------------------------------------------
-- 5. salvar_ajuste_producao_op — repointed at the single ceiling owner
--
-- The ONLY change against db/102 is step 9: the four statements that
-- recomputed the ceiling inline are replaced by one call to
-- _oc_teto_disponivel. Authorization, payload validation, the 9.9.B lock
-- protocol, the revision check, the refusal codes, the absolute-payload
-- rule, the write set and the event are unchanged.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.salvar_ajuste_producao_op(
  p_op_id           BIGINT,
  p_base_ajuste_rev INTEGER,
  p_itens           JSONB
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_pedido_id  UUID;
  v_status     TEXT;
  v_rev        INTEGER;
  v_total_op   INTEGER;
  v_total_pay  INTEGER;
  v_eixo       RECORD;
  v_teto       NUMERIC(12,3);
  v_proposto   NUMERIC(12,3);
  v_aplicados  INTEGER := 0;
BEGIN
  -- 1. AUTHORIZE
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'sem_permissao' USING ERRCODE = '42501';
  END IF;

  -- 2. VALIDATE PAYLOAD SHAPE
  IF p_itens IS NULL OR jsonb_typeof(p_itens) <> 'array' THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'AJUSTE_PAYLOAD_INCOMPLETO',
                              'detalhe', 'p_itens deve ser um array absoluto e completo');
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_itens) AS e(item)
     WHERE (e.item ->> 'op_item_id') IS NULL
        OR (e.item ->> 'op_item_id') !~ '^[0-9]+$'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'AJUSTE_PAYLOAD_INCOMPLETO',
                              'detalhe', 'op_item_id ausente ou nao numerico');
  END IF;

  -- 3. RESOLVE THE PEDIDO FROM THE OP
  SELECT lt.pedido_id INTO v_pedido_id
    FROM public.ops o
    JOIN public.lotes lt ON lt.id = o.lote_id
   WHERE o.id = p_op_id;
  IF v_pedido_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'AJUSTE_OP_SEM_PEDIDO');
  END IF;

  -- 4. ACQUIRE LOCKS IN THE GLOBAL ORDER, bounded (9.9.B)
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

  -- 5. RELOAD INSIDE THE LOCK
  SELECT o.status, o.ajuste_revisao INTO v_status, v_rev
    FROM public.ops o WHERE o.id = p_op_id;

  -- 6. VALIDATE CURRENT STATE
  IF v_status NOT IN ('simulada', 'aberta') THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'AJUSTE_OP_ESTADO_INVALIDO',
                              'status', v_status);
  END IF;

  -- 6b. A cancelled Pedido blocks the adjustment writer (9.9.M).
  IF EXISTS (SELECT 1 FROM public.pedidos WHERE id = v_pedido_id AND status = 'cancelado') THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'PEDIDO_CANCELADO');
  END IF;

  -- 7. VALIDATE THE REVISION, only after the locks and the reload
  IF p_base_ajuste_rev IS DISTINCT FROM v_rev THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'AJUSTE_REVISAO_DESATUALIZADA',
                              'ajuste_revisao_atual', v_rev);
  END IF;

  -- 8. THE PAYLOAD IS ABSOLUTE AND COMPLETE: exactly the OP's items, once each.
  SELECT count(*) INTO v_total_op FROM public.op_itens WHERE op_id = p_op_id;
  SELECT count(DISTINCT (e.item ->> 'op_item_id')::BIGINT) INTO v_total_pay
    FROM jsonb_array_elements(p_itens) AS e(item);
  IF v_total_pay <> v_total_op
     OR EXISTS (
          SELECT 1 FROM jsonb_array_elements(p_itens) AS e(item)
           WHERE NOT EXISTS (
             SELECT 1 FROM public.op_itens oi
              WHERE oi.id = (e.item ->> 'op_item_id')::BIGINT AND oi.op_id = p_op_id))
     OR jsonb_array_length(p_itens) <> v_total_op THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'AJUSTE_PAYLOAD_INCOMPLETO',
                              'itens_op', v_total_op, 'itens_payload', v_total_pay);
  END IF;

  -- 9. VALIDATE EVERY AXIS AGAINST ITS CEILING, BEFORE ANY WRITE (9.9.A)
  --
  -- The ceiling has ONE owner, _oc_teto_disponivel (db/118): actual
  -- received material — allocated net plus the OP's remaining share of
  -- the real surplus — is what may be turned into production. Bypassing
  -- the client slider therefore cannot authorize more than the true
  -- remaining availability, because this is the same function the slider
  -- projection consumes.
  FOR v_eixo IN
    SELECT DISTINCT d.origem_tipo, d.material, d.cor_id, d.cor_poliester
      FROM public._oc_disponibilidade_linhas(p_op_id) d
  LOOP
    v_teto := public._oc_teto_disponivel(
      v_pedido_id, p_op_id, v_eixo.origem_tipo, v_eixo.material,
      v_eixo.cor_id, v_eixo.cor_poliester);

    v_proposto := public._op_reserva_proposta(
      p_op_id, p_itens, v_eixo.material, v_eixo.cor_id, v_eixo.cor_poliester);

    IF v_proposto > v_teto THEN
      RETURN jsonb_build_object(
        'ok', false, 'codigo', 'AJUSTE_EXCEDE_DISPONIVEL',
        'material', v_eixo.material, 'cor_id', v_eixo.cor_id,
        'cor_poliester', v_eixo.cor_poliester,
        'kg_proposto', v_proposto, 'kg_disponivel', v_teto);
    END IF;
  END LOOP;

  -- 10. APPLY. Every refusal path is already behind us.
  UPDATE public.op_itens oi
     SET metros_ajustados = j.metros
    FROM (
      SELECT (e.item ->> 'op_item_id')::BIGINT AS op_item_id,
             NULLIF(e.item ->> 'metros_ajustados', '')::NUMERIC(10,2) AS metros
        FROM jsonb_array_elements(p_itens) AS e(item)
    ) AS j
   WHERE oi.id = j.op_item_id AND oi.op_id = p_op_id;
  GET DIAGNOSTICS v_aplicados = ROW_COUNT;

  UPDATE public.ops SET ajuste_revisao = ajuste_revisao + 1 WHERE id = p_op_id;
  v_rev := v_rev + 1;

  -- Adjustment history belongs to op_eventos (F7), never to
  -- ordem_compra_eventos.
  INSERT INTO public.op_eventos (op_id, tipo_evento, observacao, payload, criado_por)
  VALUES (p_op_id, 'ajuste_producao_salvo',
          'Ajuste de producao salvo (' || v_aplicados || ' itens).',
          jsonb_build_object('itens', p_itens, 'ajuste_revisao', v_rev,
                             'pedido_id', v_pedido_id),
          auth.uid());

  RETURN jsonb_build_object('ok', true, 'op_id', p_op_id,
                            'ajuste_revisao', v_rev, 'itens_aplicados', v_aplicados);
END;
$$;

COMMENT ON FUNCTION public.salvar_ajuste_producao_op(BIGINT, INTEGER, JSONB) IS
  'db/102 (9.9.C), ceiling corrected by db/118: atomic production adjustment. Locks in the global order, reloads, then checks the revision; validates the COMPLETE absolute payload against public._oc_teto_disponivel — the SAME ceiling owner the client projection reads — before any write. Writes op_itens, ops.ajuste_revisao and op_eventos only.';

-- ---------------------------------------------------------------------
-- 6. iniciar_producao_op — repointed at the single ceiling owner
--
-- The ONLY change against db/102 is that both ceiling computations (the
-- revalidation and the start snapshot) now call _oc_teto_disponivel.
-- Authorization, the lock protocol, the entry-state rule, the revision
-- check, the complete-adjustment rule, the snapshot write, the status
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
  v_pedido_id UUID;
  v_status    TEXT;
  v_rev       INTEGER;
  v_pendentes INTEGER;
  v_eixo      RECORD;
  v_teto      NUMERIC(12,3);
  v_propria   NUMERIC(12,3);
  v_transicao JSONB;
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
  'db/102 (9.9.D), ceiling corrected by db/118: server-owned production start. Locks in the global order, proves every item carries an adjustment, REVALIDATES availability against public._oc_teto_disponivel, writes the authoritative saldo_fios_op start snapshot (sole writer), transitions the OP through _op_status_aplicar and recomputes the Pedido through _pedido_status_recalcular — all in one transaction.';

-- ---------------------------------------------------------------------
-- 7. Explicit ownership and privileges
--
-- The three new functions are OWNER-ONLY, exactly like the db/101
-- helpers they join. Nothing is granted back, and the ACL of the two
-- public writers and of the client-facing read is restated identically
-- to db/101 and db/102 so a replacement can never silently widen it.
-- ---------------------------------------------------------------------
ALTER FUNCTION public._oc_excedente_pool(UUID, TEXT, BIGINT, TEXT)                   OWNER TO postgres;
ALTER FUNCTION public._oc_excedente_consumido(UUID, TEXT, BIGINT, TEXT, BIGINT)      OWNER TO postgres;
ALTER FUNCTION public._oc_teto_disponivel(UUID, BIGINT, TEXT, TEXT, BIGINT, TEXT)    OWNER TO postgres;
ALTER FUNCTION public.oc_disponibilidade_op(BIGINT)                                  OWNER TO postgres;
ALTER FUNCTION public.salvar_ajuste_producao_op(BIGINT, INTEGER, JSONB)              OWNER TO postgres;
ALTER FUNCTION public.iniciar_producao_op(BIGINT, INTEGER)                           OWNER TO postgres;

REVOKE ALL ON FUNCTION public._oc_excedente_pool(UUID, TEXT, BIGINT, TEXT)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public._oc_excedente_consumido(UUID, TEXT, BIGINT, TEXT, BIGINT)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public._oc_teto_disponivel(UUID, BIGINT, TEXT, TEXT, BIGINT, TEXT)
  FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.oc_disponibilidade_op(BIGINT)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.oc_disponibilidade_op(BIGINT) TO authenticated;

REVOKE ALL ON FUNCTION public.salvar_ajuste_producao_op(BIGINT, INTEGER, JSONB)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.salvar_ajuste_producao_op(BIGINT, INTEGER, JSONB) TO authenticated;

REVOKE ALL ON FUNCTION public.iniciar_producao_op(BIGINT, INTEGER)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.iniciar_producao_op(BIGINT, INTEGER) TO authenticated;

-- ---------------------------------------------------------------------
-- 8. Migration-time invariants
-- ---------------------------------------------------------------------
DO $db118$
DECLARE
  v_bad TEXT;
BEGIN
  -- 8.1 The three new helpers must be unreachable by every client role.
  SELECT string_agg(fn || '/' || role_name, ', ') INTO v_bad
    FROM (
      SELECT f.fn, r.role_name
        FROM (VALUES
          ('public._oc_excedente_pool(uuid,text,bigint,text)'),
          ('public._oc_excedente_consumido(uuid,text,bigint,text,bigint)'),
          ('public._oc_teto_disponivel(uuid,bigint,text,text,bigint,text)')
        ) AS f(fn)
        CROSS JOIN (VALUES ('anon'), ('authenticated'), ('service_role')) AS r(role_name)
       WHERE has_function_privilege(r.role_name, f.fn, 'EXECUTE')
    ) s;
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'db/118: owner-only helper is reachable by a client role: %', v_bad;
  END IF;

  -- 8.2 The db/101 owner-only helpers must STILL be unreachable: a
  --     replacement must not have widened anything.
  SELECT string_agg(fn || '/' || role_name, ', ') INTO v_bad
    FROM (
      SELECT f.fn, r.role_name
        FROM (VALUES
          ('public._oc_material_recebido_liquido(uuid,bigint,text,text,bigint,text)'),
          ('public._oc_reserva_ativa(uuid,text,bigint,text,bigint,bigint)'),
          ('public._oc_disponibilidade_linhas(bigint)'),
          ('public._op_reserva_proposta(bigint,jsonb,text,bigint,text)'),
          ('public._op_status_aplicar(bigint,text,text)')
        ) AS f(fn)
        CROSS JOIN (VALUES ('anon'), ('authenticated'), ('service_role')) AS r(role_name)
       WHERE has_function_privilege(r.role_name, f.fn, 'EXECUTE')
    ) s;
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'db/118: a pre-existing owner-only helper became reachable: %', v_bad;
  END IF;

  -- 8.3 The three public entry points keep EXACTLY their declared ACL.
  IF NOT has_function_privilege('authenticated', 'public.oc_disponibilidade_op(bigint)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.salvar_ajuste_producao_op(bigint,integer,jsonb)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.iniciar_producao_op(bigint,integer)', 'EXECUTE') THEN
    RAISE EXCEPTION 'db/118: a public entry point is no longer executable by authenticated';
  END IF;
  IF has_function_privilege('anon',         'public.oc_disponibilidade_op(bigint)', 'EXECUTE')
     OR has_function_privilege('service_role', 'public.oc_disponibilidade_op(bigint)', 'EXECUTE')
     OR has_function_privilege('anon',         'public.salvar_ajuste_producao_op(bigint,integer,jsonb)', 'EXECUTE')
     OR has_function_privilege('service_role', 'public.salvar_ajuste_producao_op(bigint,integer,jsonb)', 'EXECUTE')
     OR has_function_privilege('anon',         'public.iniciar_producao_op(bigint,integer)', 'EXECUTE')
     OR has_function_privilege('service_role', 'public.iniciar_producao_op(bigint,integer)', 'EXECUTE') THEN
    RAISE EXCEPTION 'db/118: a public entry point became reachable by anon or service_role';
  END IF;

  -- 8.4 TD1 / R.33.2 STRUCTURAL ASSERTION, EXTENDED. No availability
  --     object may reference public.saldo_fios. The restored surplus term
  --     is read from the native receipt ledger, never from the balance
  --     cache. iniciar_producao_op is excluded because writing the
  --     saldo_fios_op START SNAPSHOT is its accepted db/102 duty and is
  --     not an availability read.
  IF EXISTS (
    SELECT 1 FROM pg_proc p
     WHERE p.pronamespace = 'public'::regnamespace
       AND p.proname IN ('_oc_material_recebido_liquido', '_oc_reserva_ativa',
                         '_oc_disponibilidade_linhas', 'oc_disponibilidade_op',
                         '_oc_excedente_pool', '_oc_excedente_consumido',
                         '_oc_teto_disponivel', 'salvar_ajuste_producao_op')
       AND p.prosrc ~ 'saldo_fios'
  ) THEN
    RAISE EXCEPTION 'db/118: TD1 / R.33.2 violation — an availability object references saldo_fios';
  END IF;

  -- 8.5 THE SINGLE CEILING OWNER. Neither writer may carry its own copy
  --     of the ceiling arithmetic: both must reach _oc_teto_disponivel,
  --     which is what keeps the server authority and the client slider
  --     projection on one semantic.
  IF EXISTS (
    SELECT 1 FROM pg_proc p
     WHERE p.pronamespace = 'public'::regnamespace
       AND p.proname IN ('oc_disponibilidade_op', 'salvar_ajuste_producao_op',
                         'iniciar_producao_op')
       AND p.prosrc !~ '_oc_teto_disponivel'
  ) THEN
    RAISE EXCEPTION 'db/118: a ceiling consumer does not reach the single ceiling owner _oc_teto_disponivel';
  END IF;

  -- 8.6 NO FABRICATED PROVENANCE. The native shape constraint that makes
  --     a surplus line allocation-free and OP-free must still be in
  --     force: this migration makes surplus SPENDABLE, never ALLOCATED.
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.ordem_compra_fio_lancamentos'::regclass
       AND conname = 'ordem_compra_fio_lancamentos_native_shape'
  ) THEN
    RAISE EXCEPTION 'db/118: ordem_compra_fio_lancamentos_native_shape is absent — surplus provenance is no longer structurally protected';
  END IF;

  -- 8.7 No view may participate in the availability read path (9.9.A.5).
  IF EXISTS (
    SELECT 1 FROM pg_views v
     WHERE v.schemaname = 'public'
       AND v.definition ~ '_oc_disponibilidade_linhas|_oc_material_recebido_liquido|_oc_reserva_ativa|_oc_teto_disponivel|_oc_excedente_pool|_oc_excedente_consumido'
  ) THEN
    RAISE EXCEPTION 'db/118: a view reaches an owner-only availability helper';
  END IF;

  -- 8.8 No business row was written by this migration.
  IF EXISTS (
    SELECT 1 FROM public.ordem_compra_fio_lancamentos
     WHERE idempotency_key LIKE 'db118%'
  ) THEN
    RAISE EXCEPTION 'db/118: this migration must write no ledger row';
  END IF;
END
$db118$;

COMMIT;
