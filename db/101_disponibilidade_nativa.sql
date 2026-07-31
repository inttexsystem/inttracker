-- =====================================================================
-- db/101 — NATIVE AVAILABILITY (origin-scope aware)
--
-- NATIVE-RECEIPT-COORDINATED-RELEASE-P1-ADDITIVE-BACKEND-R1, phase P1.
-- Implements PEDIDO_DERIVED_LIFECYCLE_RECOVERY_PLAN.md section 9.9.A
-- (availability authority) under binding supervisor ruling TD1 (9.9.H).
--
-- ADDITIVE ONLY. This migration creates four new functions under new
-- names and grants. It replaces no existing function body, revokes no
-- existing business grant, creates no table, and changes no reachable
-- behaviour. The native receipt cutover is untouched and remains
-- legacy_active / flat.
--
-- THE TWO AUTHORITIES (9.9.A):
--   * OP-origin material (today cotton) is committed to ONE OP by its own
--     need. Its ceiling is that OP's own productive net. A sibling OP's
--     reservation NEVER reduces it, even for the same colour.
--   * Pedido-origin material (today polyester) is a SHARED Pedido pool.
--     Its ceiling is the pool minus the active reservation of the OTHER
--     OPs of the same Pedido. No representative OP is created and the
--     pool is never pre-split.
--
-- In both cases the TARGET OP's own reservation is NOT subtracted: a
-- replacement adjustment is validated against the raw ceiling, which is
-- exactly what "returns its own reservation first" means (9.9.A.2).
--
-- TD1: public.saldo_fios is NOT a term in either ceiling. The productive
-- predicate reaches only public.ordem_compra_fio_lancamentos, and a
-- saldo_fios row is not a ledger row at all.
--
-- NO VIEW. vw_disponibilidade_op is withdrawn by 9.9.A.5: a
-- security_invoker view would execute as a caller who deliberately holds
-- no EXECUTE on the owner-only helpers, so it could only ever fail with
-- permission denied. The sole client-facing read is one guarded
-- SECURITY DEFINER wrapper.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. _oc_material_recebido_liquido — the productive net (9.9.A.1)
--
-- A ledger line is PRODUCTIVE (allocation-destined) exactly when:
--     recebimento_id IS NOT NULL              -- a real receipt/reversal line
--     AND ordem_compra_item_alocacao_id IS NOT NULL
--     AND kg_excesso = 0                      -- surplus lines carry kg_excesso <> 0
--
-- SUM(kg_recebido - kg_excesso) is deliberately NOT used: it would be
-- arithmetically equal only while the invariant kg_excesso IN (0,
-- kg_recebido) holds, and no constraint enforces that invariant.
--
-- Reversal rows need no special case: tipo='estorno' rows carry a
-- negative kg_recebido and kg_excesso = 0 when their source was
-- allocation-destined, so they are included with the correct sign.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._oc_material_recebido_liquido(
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
  SELECT coalesce(sum(l.kg_recebido), 0)::NUMERIC(12,3)
    FROM public.ordem_compra_fio_lancamentos l
    JOIN public.ordem_compra_item_alocacao a
      ON a.id = l.ordem_compra_item_alocacao_id
    JOIN public.necessidade_compra_fio n
      ON n.id = a.necessidade_id
   WHERE l.recebimento_id IS NOT NULL
     AND l.ordem_compra_item_alocacao_id IS NOT NULL
     AND l.kg_excesso = 0
     AND n.origem_tipo = p_origem_tipo
     AND n.material    = p_material
     AND n.cor_id IS NOT DISTINCT FROM p_cor_id
     AND n.cor_poliester IS NOT DISTINCT FROM p_cor_poliester
     -- OP-origin needs are scoped to the target OP; Pedido-origin needs
     -- are scoped to the Pedido and form one shared pool.
     AND (
           (p_origem_tipo = 'op'     AND n.op_id = p_op_id)
        OR (p_origem_tipo = 'pedido' AND n.pedido_id = p_pedido_id)
         );
$$;

COMMENT ON FUNCTION public._oc_material_recebido_liquido(UUID, BIGINT, TEXT, TEXT, BIGINT, TEXT) IS
  'db/101 (9.9.A.1): productive net for one origin-scoped material/colour axis. OWNER-ONLY. Selects allocation-destined ledger lines only; surplus and TD1 saldo_fios can never raise a ceiling.';

-- ---------------------------------------------------------------------
-- 2. _oc_reserva_ativa — the reservation authority (D2)
--
-- Reservation is DERIVED, never persisted. Its authority is
-- op_itens.metros_ajustados where NOT NULL, converted through
-- parametros_largura keyed by modelos.largura, using exactly the recipe
-- js/calculo-op.js::calcularFiosOP already applies:
--     kg_algodao   = metros * algodao_por_ml   * valor_x, credited to
--                    BOTH modelos.cor_1_id and modelos.cor_2_id
--     kg_poliester = metros * poliester_por_ml * valor_x, credited to
--                    BOTH PRETO and BRANCO
-- A model whose cor_1_id = cor_2_id therefore reserves twice, which is
-- what the shipped recipe does and what the needs were sized from.
--
-- metros_pedidos NEVER reserves (D2). Measured physical consumption is
-- not claimed.
--
-- Status split (D2): simulada/aberta -> reserved;
-- em_producao/pausada/concluida/finalizada -> committed/consumed;
-- cancelada -> nothing.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._oc_reserva_ativa(
  p_pedido_id      UUID,
  p_material       TEXT,
  p_cor_id         BIGINT,
  p_cor_poliester  TEXT,
  p_excluir_op_id  BIGINT DEFAULT NULL,
  p_apenas_op_id   BIGINT DEFAULT NULL
) RETURNS TABLE (
  kg_reservado    NUMERIC(12,3),
  kg_comprometido NUMERIC(12,3)
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH linha AS (
    SELECT
      o.status AS op_status,
      CASE
        WHEN p_material = 'algodao' THEN
          oi.metros_ajustados * pl.algodao_por_ml * pl.valor_x
          * ( (CASE WHEN m.cor_1_id = p_cor_id THEN 1 ELSE 0 END)
            + (CASE WHEN m.cor_2_id = p_cor_id THEN 1 ELSE 0 END) )
        WHEN p_material = 'poliester' THEN
          oi.metros_ajustados * pl.poliester_por_ml * pl.valor_x
        ELSE 0
      END AS kg
    FROM public.op_itens oi
    JOIN public.ops o        ON o.id = oi.op_id
    JOIN public.lotes lt     ON lt.id = o.lote_id
    JOIN public.modelos m    ON m.id = oi.modelo_id
    JOIN public.parametros_largura pl ON pl.largura = m.largura
   WHERE lt.pedido_id = p_pedido_id
     AND oi.metros_ajustados IS NOT NULL
     AND o.status <> 'cancelada'
     AND (p_excluir_op_id IS NULL OR o.id <> p_excluir_op_id)
     AND (p_apenas_op_id  IS NULL OR o.id  = p_apenas_op_id)
  )
  SELECT
    coalesce(sum(kg) FILTER (WHERE op_status IN ('simulada','aberta')), 0)::NUMERIC(12,3),
    coalesce(sum(kg) FILTER (WHERE op_status IN ('em_producao','pausada','concluida','finalizada')), 0)::NUMERIC(12,3)
    FROM linha;
$$;

COMMENT ON FUNCTION public._oc_reserva_ativa(UUID, TEXT, BIGINT, TEXT, BIGINT, BIGINT) IS
  'db/101 (D2): derived active reservation in kg for one Pedido/material/colour axis, split reserved vs committed by OP status. OWNER-ONLY. Authority is op_itens.metros_ajustados only; metros_pedidos never reserves.';

-- ---------------------------------------------------------------------
-- 3. _oc_disponibilidade_linhas — the axis set of one OP
--
-- The material/colour axes an OP depends on are exactly:
--   * its OWN OP-origin needs (cotton), and
--   * the Pedido-origin needs (polyester) of the Pedido that owns it.
-- Legacy needs are excluded: they carry no native allocation lineage and
-- are not part of the native availability authority.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._oc_disponibilidade_linhas(p_op_id BIGINT)
RETURNS TABLE (
  necessidade_id BIGINT,
  pedido_id      UUID,
  origem_tipo    TEXT,
  material       TEXT,
  cor_id         BIGINT,
  cor_poliester  TEXT,
  kg_necessario  NUMERIC(12,3)
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT n.id, n.pedido_id, n.origem_tipo, n.material, n.cor_id, n.cor_poliester, n.kg_necessario
    FROM public.necessidade_compra_fio n
   WHERE n.legado = FALSE
     AND (
           (n.origem_tipo = 'op' AND n.op_id = p_op_id)
        OR (n.origem_tipo = 'pedido'
            AND n.pedido_id = (
              SELECT lt.pedido_id
                FROM public.ops o
                JOIN public.lotes lt ON lt.id = o.lote_id
               WHERE o.id = p_op_id))
         );
$$;

COMMENT ON FUNCTION public._oc_disponibilidade_linhas(BIGINT) IS
  'db/101 (9.9.A): the native need axes one OP depends on — its own OP-origin needs plus the Pedido-origin needs of its Pedido. OWNER-ONLY.';

-- ---------------------------------------------------------------------
-- 4. oc_disponibilidade_op — the ONLY client-facing read (9.9.A.4/A.5)
--
-- Guarded SECURITY DEFINER wrapper. Its first executable statement is
-- the explicit authorization check; every owner-only helper is reached
-- only from here, after that check has passed.
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
    -- surplus: reported only, NEVER raises an OP ceiling (9.9.A.1).
    -- A surplus line carries NO allocation by construction
    -- (ordem_compra_fio_lancamentos_native_shape requires
    -- ordem_compra_item_alocacao_id IS NULL AND kg_excesso = kg_recebido),
    -- so it is attributed by material/colour across the Pedido's orders
    -- rather than through an allocation that cannot exist.
    coalesce((SELECT sum(l.kg_excesso)
                FROM public.ordem_compra_fio_lancamentos l
                JOIN public.ordem_compra oc ON oc.id = l.ordem_compra_id
               WHERE l.recebimento_id IS NOT NULL
                 AND l.kg_excesso <> 0
                 AND oc.pedido_id = v_pedido_id
                 AND l.material = d.material
                 AND l.cor_id IS NOT DISTINCT FROM d.cor_id
                 AND l.cor_poliester IS NOT DISTINCT FROM d.cor_poliester), 0)::NUMERIC(12,3),
    -- allocated to this OP = the origin-scoped productive net
    public._oc_material_recebido_liquido(
      v_pedido_id, p_op_id, d.origem_tipo, d.material, d.cor_id, d.cor_poliester),
    own.kg_reservado,
    others.kg_reservado,
    others.kg_comprometido,
    -- THE CEILING (9.9.A.2 / 9.9.A.3)
    GREATEST(
      0,
      public._oc_material_recebido_liquido(
        v_pedido_id, p_op_id, d.origem_tipo, d.material, d.cor_id, d.cor_poliester)
      - CASE
          -- OP-origin: sibling reservations do NOT reduce this quantity.
          WHEN d.origem_tipo = 'op' THEN 0
          -- Pedido-origin: the shared pool is reduced by the active
          -- reservation of every OTHER OP of the same Pedido.
          ELSE others.kg_reservado + others.kg_comprometido
        END
    )::NUMERIC(12,3)
  FROM public._oc_disponibilidade_linhas(p_op_id) d
  CROSS JOIN LATERAL public._oc_reserva_ativa(
    v_pedido_id, d.material, d.cor_id, d.cor_poliester, NULL, p_op_id) AS own
  CROSS JOIN LATERAL public._oc_reserva_ativa(
    v_pedido_id, d.material, d.cor_id, d.cor_poliester, p_op_id, NULL) AS others;
END;
$$;

COMMENT ON FUNCTION public.oc_disponibilidade_op(BIGINT) IS
  'db/101 (9.9.A): the ONE client-facing native availability read. Guarded SECURITY DEFINER; admin only. OP-origin ceilings ignore sibling reservations; Pedido-origin ceilings subtract other active OPs. The target OP''s OWN reservation is never subtracted, so a replacement adjustment validates against the raw ceiling. TD1: saldo_fios is not a term.';

-- ---------------------------------------------------------------------
-- 5. Explicit ownership and privileges (9.9.A.5)
--
-- Declared explicitly and never left to Supabase's authenticated-by-
-- default grant. The three helpers are OWNER-ONLY: PUBLIC, anon,
-- authenticated and service_role are all revoked and none is granted
-- back. Only the guarded wrapper is executable by authenticated.
-- ---------------------------------------------------------------------
ALTER FUNCTION public._oc_material_recebido_liquido(UUID, BIGINT, TEXT, TEXT, BIGINT, TEXT) OWNER TO postgres;
ALTER FUNCTION public._oc_reserva_ativa(UUID, TEXT, BIGINT, TEXT, BIGINT, BIGINT)          OWNER TO postgres;
ALTER FUNCTION public._oc_disponibilidade_linhas(BIGINT)                                   OWNER TO postgres;
ALTER FUNCTION public.oc_disponibilidade_op(BIGINT)                                        OWNER TO postgres;

REVOKE ALL ON FUNCTION public._oc_material_recebido_liquido(UUID, BIGINT, TEXT, TEXT, BIGINT, TEXT)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public._oc_reserva_ativa(UUID, TEXT, BIGINT, TEXT, BIGINT, BIGINT)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public._oc_disponibilidade_linhas(BIGINT)
  FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.oc_disponibilidade_op(BIGINT)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.oc_disponibilidade_op(BIGINT) TO authenticated;

-- ---------------------------------------------------------------------
-- 6. Migration-time invariants
-- ---------------------------------------------------------------------
DO $db101$
DECLARE
  v_bad TEXT;
BEGIN
  -- 6.1 The three helpers must be unreachable by every client role.
  SELECT string_agg(fn || '/' || role_name, ', ') INTO v_bad
    FROM (
      SELECT f.fn, r.role_name
        FROM (VALUES
          ('public._oc_material_recebido_liquido(uuid,bigint,text,text,bigint,text)'),
          ('public._oc_reserva_ativa(uuid,text,bigint,text,bigint,bigint)'),
          ('public._oc_disponibilidade_linhas(bigint)')
        ) AS f(fn)
        CROSS JOIN (VALUES ('anon'), ('authenticated'), ('service_role')) AS r(role_name)
       WHERE has_function_privilege(r.role_name, f.fn, 'EXECUTE')
    ) s;
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'db/101: owner-only helper is reachable by a client role: %', v_bad;
  END IF;

  -- 6.2 The guarded wrapper must be executable by authenticated and by
  --     nobody else among the client roles.
  IF NOT has_function_privilege('authenticated', 'public.oc_disponibilidade_op(bigint)', 'EXECUTE') THEN
    RAISE EXCEPTION 'db/101: oc_disponibilidade_op must be executable by authenticated';
  END IF;
  IF has_function_privilege('anon', 'public.oc_disponibilidade_op(bigint)', 'EXECUTE')
     OR has_function_privilege('service_role', 'public.oc_disponibilidade_op(bigint)', 'EXECUTE') THEN
    RAISE EXCEPTION 'db/101: oc_disponibilidade_op must not be executable by anon or service_role';
  END IF;

  -- 6.3 TD1 structural assertion: no availability object may reference
  --     public.saldo_fios. The five preserved rows are historical global
  --     stock and can never raise a productive OP ceiling.
  IF EXISTS (
    SELECT 1 FROM pg_proc p
     WHERE p.pronamespace = 'public'::regnamespace
       AND p.proname IN ('_oc_material_recebido_liquido', '_oc_reserva_ativa',
                         '_oc_disponibilidade_linhas', 'oc_disponibilidade_op')
       AND p.prosrc ~ 'saldo_fios'
  ) THEN
    RAISE EXCEPTION 'db/101: TD1 violation — an availability object references saldo_fios';
  END IF;

  -- 6.4 No view may participate in the availability read path (9.9.A.5).
  IF EXISTS (
    SELECT 1 FROM pg_views v
     WHERE v.schemaname = 'public'
       AND v.definition ~ '_oc_disponibilidade_linhas|_oc_material_recebido_liquido|_oc_reserva_ativa'
  ) THEN
    RAISE EXCEPTION 'db/101: a view reaches an owner-only availability helper';
  END IF;

  -- 6.5 The cutover must remain untouched by this additive migration.
  PERFORM 1 FROM public.ordem_compra_cutover
   WHERE id = 1 AND status = 'legacy_active' AND read_authority = 'flat';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'db/101: ordem_compra_cutover is not legacy_active/flat';
  END IF;
END
$db101$;

COMMIT;
