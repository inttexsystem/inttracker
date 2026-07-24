-- =====================================================================
-- db/85_manta_cima_route_conditional_delivery.sql
-- PHASE-MANTA-B2A — route-conditional weaving delivery (`entregas.etapa='cima'`).
--
-- Governing contract: docs/architecture/MANTA_DIRECT_ROUTE_ACTIVATION_CONTRACT.md
-- §3 (B2-1) and §8/§9; schema shapes owned by
-- docs/architecture/PEDIDO_OP_SCHEMA_CONTRACT.md (Update 2026-07-24, db/85 table).
-- Forward-only; db/01..db/84 are untouched. The migration terminal guard advances
-- 84 -> 85 in the same commit (tests/ordem-compra-c3d-deploy.smoke.js).
--
-- OBJECTIVE. Allow measured Manta weaving output to be recorded atomically with
-- NO finishing destination, while the existing Tapete `cima` path (which REQUIRES
-- a destination) keeps its exact current behavior.
--
-- WHY THE ROW CHECK CANNOT SURVIVE. `entregas_destino_cima_chk` (db/07) is a row
-- CHECK on public.entregas: `CHECK (etapa <> 'cima' OR destino_fornecedor_id IS
-- NOT NULL)`. The route is only derivable through
-- `entrega_itens.op_item_id -> op_itens.modelo_id -> modelos.tipo_produto`, and at
-- header-INSERT time no item exists. No header-level CHECK or BEFORE-INSERT
-- trigger can therefore decide the route. The invariant moves to where the route
-- first becomes knowable — the item write — plus a header-side re-derivation. The
-- surviving Tapete requirement is strictly STRONGER than the dropped CHECK (it
-- must additionally reject a Manta `cima` that carries a destination), so the
-- constraint is replaced, never weakened in place.
--
-- ---------------------------------------------------------------------
-- MANDATORY LOCK-ORDER RECONCILIATION (accounts for PostgreSQL's IMPLICIT
-- target-row locks, not only explicit FOR UPDATE statements).
-- ---------------------------------------------------------------------
-- Global deterministic resource order (extends db/80 §, db/81 §4, db/84 and
-- ACTIVATION_CONTRACT §9; no path below takes any pair in reverse):
--
--   1. public.pedidos row              FOR UPDATE  (Pedido completion only; it
--                                                   acquires nothing else)
--   2. public.ops rows, asc op_id      FOR UPDATE
--   3. source public.lotes  FOR SHARE, then source public.pedidos FOR SHARE
--   4. public.modelos rows, asc id     FOR SHARE   (always a LEAF acquisition)
--   5. public.entregas / public.entrega_itens
--   6. public.expedicoes
--   7. public.expedicao_itens, asc id
--
-- THE INVERSION THIS MIGRATION HAD TO ELIMINATE. Two implicit locks make the
-- naive design cyclic:
--   (a) `UPDATE public.entregas SET destino_fornecedor_id/etapa` acquires the
--       target row lock (LockTupleNoKeyExclusive, via GetTupleForTrigger) BEFORE
--       its BEFORE-ROW trigger body runs. A header guard that then locked the
--       source `ops` row would produce  entrega -> OP.
--   (b) `UPDATE/DELETE public.entrega_itens` likewise holds that item row's own
--       target lock BEFORE its BEFORE-ROW triggers run. An item guard that then
--       locked `ops` would produce  entrega_itens -> OP, which cycles against
--       every writer that holds `ops` and then reaches delivery rows
--       (db/32 liberar_expedicao_latex_parcial; db/86
--       liberar_expedicao_manta_parcial).
-- The competing paths  OP -> entrega  and  entrega -> OP  therefore must not
-- both exist. Outcome A of the order is implemented: ONE globally compatible
-- lock order, enforced by two structural rules.
--
--   R-I  `entrega_itens_cima_route_destino_guard` requests an `ops` FOR UPDATE
--        lock ONLY on INSERT — the one path on which the statement holds no
--        pre-existing `entrega_itens` row lock, so the acquisition is a pure
--        step-2 -> step-5 move in the canonical direction. On UPDATE it takes NO
--        `ops` lock at all:
--          * `entrega_id` changed  -> lock only public.entregas(NEW.entrega_id)
--            FOR SHARE. NEW.entrega_id is by construction a DIFFERENT header from
--            the one whose ON DELETE CASCADE could be competing for this item
--            row (the item still belongs to OLD.entrega_id), so no cycle with a
--            concurrent `DELETE FROM public.entregas`.
--          * only `op_id`/`op_item_id` changed -> NO lock at all (see the
--            mutual-exclusivity proof below).
--          * nothing route-relevant changed (e.g. `metros_entregues`, `defeito`)
--            -> early return, no lock, existing behavior preserved bit for bit.
--        DELETE is deliberately NOT covered: removing an item can never create a
--        route violation (fewer items keep the route homogeneous or empty), and
--        covering it would put `entregas -> entrega_itens -> ops` on the header
--        cascade path and re-create the cycle.
--        => NO path ever holds an `entrega_itens` row lock and then requests an
--           `ops` row lock.
--
--   R-II `entregas_cima_destino_route_guard` requests NO `ops` lock and NO
--        `entrega_itens` row lock — plain unlocked committed reads, the exact
--        idiom db/84 BLOCKER E/F established. Its only lock is the UPDATE's own
--        target row on public.entregas.
--        => NO path ever holds an `entregas` row lock and then requests an `ops`
--           row lock.
--
-- CORRECTNESS OF R-I/R-II WITHOUT THE HEADER-SIDE OP LOCK (fail-closed proof):
--   * Every item write that can change a `cima` delivery's route acquires
--     public.entregas(parent) FOR SHARE (INSERT, and UPDATE moving `entrega_id`).
--     A route/destination header UPDATE holds that same row FOR NO KEY UPDATE.
--     FOR SHARE and FOR NO KEY UPDATE CONFLICT, so the two strictly serialize on
--     the parent row. (The FK's implicit FOR KEY SHARE would NOT conflict — which
--     is precisely why the guard takes an EXPLICIT FOR SHARE instead of relying
--     on referential integrity.)
--   * Whichever transaction runs second waits on that row, then re-reads
--     committed state under a fresh READ COMMITTED command snapshot and re-runs
--     its own TOTAL validation (each guard re-derives the route from every item
--     and re-reads the header destination). Neither guard can validate against
--     one state and commit against another.
--   * For an UPDATE that changes only `op_id`/`op_item_id`, the parent is
--     necessarily NON-EMPTY (it owns this very row) and no lock is needed,
--     because the two guards' accepting transitions are mutually exclusive:
--       - valid Tapete parent (destino NOT NULL, all items tapete): a header
--         change to destino NULL requires all items manta -> rejected on the
--         stale read; an item change to a manta op_item requires destino NULL ->
--         rejected on the stale read. Both reject.
--       - valid Manta parent (destino NULL, all items manta): symmetric; both
--         reject.
--       - if one of them already committed, the other reads the committed value
--         and validates against it correctly.
--     No interleaving accepts a violating pair.
--   * The item-less `cima` header (ACTIVATION_CONTRACT §3 residual R-4) is the
--     only state in which a header change is unconstrained; it is reachable only
--     through `entrega_id`-changing UPDATE / INSERT, both of which DO take the
--     FOR SHARE parent lock. Covered.
--
-- CONSEQUENT OBLIGATION ON db/86/db/87 (recorded here because it is what keeps
-- the order acyclic): the Manta expedition writers acquire the source
-- `entrega_itens` rows FOR UPDATE while holding `ops` (step 2 -> step 5), never
-- the reverse. Because R-I guarantees no `entrega_itens` holder ever requests
-- `ops`, the `release vs. output-correction` pair serializes on those item rows
-- with no cycle, in both directions.
--
-- No path acquires `modelos` (step 4) and then requests anything else: db/80's
-- op_itens guard and db/84's expedicoes INSERT guard both take it as their final
-- resource, and FOR SHARE never conflicts with FOR SHARE, so only a concurrent
-- `modelos` UPDATE (which holds nothing else) can block on it. Its position
-- relative to step 5 is therefore immaterial to cycle formation.
--
-- ---------------------------------------------------------------------
-- Forward-only. Idempotent: pure DROP CONSTRAINT IF EXISTS / CREATE OR REPLACE
-- FUNCTION / DROP+CREATE TRIGGER / REVOKE+GRANT; the data gate is a validation
-- DO block with no mutation. No data or destructive DDL, no business-data
-- creation, no table grant broadened, no RLS change, no db/81-84 guard relaxed,
-- no `app.retificacao_autorizada` granted to any writer. gerar_op_latex,
-- gerar_op_latex_split, op_latex_entregas, salvarEntregaCima and every Latex
-- expedition/delivery RPC are unchanged.
--
-- Depende de db/07, db/21, db/23, db/24, db/78, db/79, db/80, db/81, db/84.
-- Aplicar SOMENTE em ambiente local/descartavel. NAO aplicar em shared
-- development, staging ou producao sem ordem explicita.
-- =====================================================================

BEGIN;

-- ============================================================
-- 0. PRE-EXISTING DATA GATE.
--    Fail closed (abort the whole migration) if any ITEM-BEARING
--    entregas.etapa='cima' row already violates the route rule this migration
--    makes authoritative. No repair, no reinterpretation. An item-LESS `cima`
--    header is the explicitly accepted residual (ACTIVATION_CONTRACT §3 R-4)
--    and never fails the gate solely for having no item.
--
--    Violations detected:
--      * Tapete-routed `cima` delivery with NULL destino_fornecedor_id;
--      * Manta-routed `cima` delivery with non-NULL destino_fornecedor_id;
--      * mixed route inside one `cima` delivery;
--      * unresolved source: an item with NULL op_item_id, a dangling
--        op_item_id, or a model without tipo_produto;
--      * an item whose op_item does not belong to the item's declared op_id.
-- ============================================================
DO $gate$
DECLARE
  v_bad_count INTEGER;
  v_bad_ids   BIGINT[];
BEGIN
  WITH cima AS (
    SELECT e.id AS entrega_id, e.destino_fornecedor_id
      FROM public.entregas e
     WHERE e.etapa = 'cima'
  ),
  item_route AS (
    SELECT
      c.entrega_id,
      c.destino_fornecedor_id,
      ei.id                                    AS entrega_item_id,
      ei.op_id                                 AS declared_op_id,
      ei.op_item_id,
      oi.op_id                                 AS owning_op_id,
      m.tipo_produto
      FROM cima c
      JOIN public.entrega_itens ei ON ei.entrega_id = c.entrega_id
      LEFT JOIN public.op_itens oi ON oi.id = ei.op_item_id
      LEFT JOIN public.modelos  m  ON m.id = oi.modelo_id
  ),
  per_entrega AS (
    SELECT
      entrega_id,
      destino_fornecedor_id,
      count(*)                                                              AS item_ct,
      count(*) FILTER (WHERE op_item_id IS NULL
                          OR owning_op_id IS NULL
                          OR tipo_produto IS NULL)                          AS unresolved_ct,
      count(*) FILTER (WHERE owning_op_id IS DISTINCT FROM declared_op_id)  AS foreign_ct,
      count(DISTINCT tipo_produto)                                          AS route_ct,
      min(tipo_produto)                                                     AS route
      FROM item_route
     GROUP BY entrega_id, destino_fornecedor_id
  )
  SELECT count(*), array_agg(entrega_id ORDER BY entrega_id)
    INTO v_bad_count, v_bad_ids
    FROM per_entrega
   WHERE item_ct > 0
     AND ( unresolved_ct > 0
        OR foreign_ct > 0
        OR route_ct <> 1
        OR (route = 'tapete' AND destino_fornecedor_id IS NULL)
        OR (route = 'manta'  AND destino_fornecedor_id IS NOT NULL) );

  IF v_bad_count > 0 THEN
    RAISE EXCEPTION
      'PHASE-MANTA-B2A db/85 pre-existing data gate: % entrega(s) etapa=cima com itens violam a regra de rota/destino (ids=%). Migracao abortada; nenhuma linha foi reparada ou reinterpretada.',
      v_bad_count, v_bad_ids;
  END IF;
END
$gate$;

-- ============================================================
-- 1. CONSTRAINT EVOLUTION.
--    Drop exactly entregas_destino_cima_chk. It is NOT replaced by a weaker
--    unconditional CHECK; the route-aware guard pair below is the replacement
--    invariant layer.
-- ============================================================
ALTER TABLE public.entregas DROP CONSTRAINT IF EXISTS entregas_destino_cima_chk;

COMMENT ON COLUMN public.entregas.destino_fornecedor_id IS
  'Destino de acabamento (empresa de latex) da entrega de tecelagem. db/85: obrigatorio para uma entrega etapa=cima de rota TAPETE e proibido para uma de rota MANTA; a regra deixou de ser o CHECK de linha entregas_destino_cima_chk (a rota nao e derivavel de uma linha de entregas) e passou a ser o par de guards entrega_itens_cima_route_destino_guard / entregas_cima_destino_route_guard.';

-- ============================================================
-- 2. ITEM GUARD — public.entrega_itens.
--    The route first becomes knowable at the item write. See R-I above for the
--    exact lock discipline; this is the authoritative writer-agnostic invariant.
-- ============================================================
CREATE OR REPLACE FUNCTION public.entrega_itens_cima_route_destino_guard_fn()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_identity_changed BOOLEAN;
  v_parent_changed   BOOLEAN;
  v_etapa            TEXT;
  v_destino          BIGINT;
  v_owning_op        BIGINT;
  v_tipo             TEXT;
  v_item_ct          INTEGER;
  v_route_ct         INTEGER;
BEGIN
  -- ---- Scope ------------------------------------------------------------
  -- Only INSERT and an UPDATE that changes entrega_id / op_id / op_item_id can
  -- change the route context of a delivery item. A metros_entregues / defeito /
  -- observacao UPDATE takes NO lock and re-runs NO validation, preserving the
  -- pre-existing delivery-correction behavior exactly (and keeping this guard
  -- off the lock path the db/86 release writer depends on).
  IF TG_OP = 'UPDATE' THEN
    v_parent_changed   := NEW.entrega_id IS DISTINCT FROM OLD.entrega_id;
    v_identity_changed := v_parent_changed
                          OR NEW.op_id      IS DISTINCT FROM OLD.op_id
                          OR NEW.op_item_id IS DISTINCT FROM OLD.op_item_id;
    IF NOT v_identity_changed THEN
      RETURN NEW;
    END IF;
  ELSE
    v_parent_changed := TRUE;
  END IF;

  -- ---- Locks (R-I) ------------------------------------------------------
  IF TG_OP = 'INSERT' THEN
    -- Step 2. No pre-existing entrega_itens row lock is held on this path, so
    -- ops-before-entregas is acquired in the canonical direction.
    IF NEW.op_id IS NOT NULL THEN
      PERFORM 1 FROM public.ops WHERE id = NEW.op_id FOR UPDATE;
    END IF;
  END IF;

  IF v_parent_changed THEN
    -- Step 5. FOR SHARE conflicts with the FOR NO KEY UPDATE a header
    -- route/destination UPDATE holds, so the two strictly serialize; the FK's
    -- implicit FOR KEY SHARE would not. On UPDATE, NEW.entrega_id is a
    -- different header from OLD.entrega_id, so no ON DELETE CASCADE holder of
    -- this item row can be waiting on it.
    PERFORM 1 FROM public.entregas WHERE id = NEW.entrega_id FOR SHARE;
  END IF;

  -- ---- Parent (re-read under the lock / fresh committed snapshot) --------
  SELECT e.etapa, e.destino_fornecedor_id
    INTO v_etapa, v_destino
    FROM public.entregas e
   WHERE e.id = NEW.entrega_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION
      'Item de entrega: entrega % inexistente.', NEW.entrega_id;
  END IF;

  -- Non-`cima` deliveries (etapa='latex') keep their existing behavior.
  IF v_etapa IS DISTINCT FROM 'cima' THEN
    RETURN NEW;
  END IF;

  -- ---- Source identity --------------------------------------------------
  -- No model-name inference anywhere; no app.retificacao_autorizada bypass.
  IF NEW.op_item_id IS NULL THEN
    RAISE EXCEPTION
      'Entrega % etapa=cima: item de entrega exige op_item_id (rota indeterminavel sem o item da OP).',
      NEW.entrega_id;
  END IF;

  SELECT oi.op_id, m.tipo_produto
    INTO v_owning_op, v_tipo
    FROM public.op_itens oi
    LEFT JOIN public.modelos m ON m.id = oi.modelo_id
   WHERE oi.id = NEW.op_item_id;

  IF v_owning_op IS NULL THEN
    RAISE EXCEPTION
      'Entrega % etapa=cima: op_item % inexistente.', NEW.entrega_id, NEW.op_item_id;
  END IF;

  IF v_owning_op IS DISTINCT FROM NEW.op_id THEN
    RAISE EXCEPTION
      'Entrega % etapa=cima: op_item % pertence a OP % e nao a OP declarada % (injecao cross-OP rejeitada).',
      NEW.entrega_id, NEW.op_item_id, v_owning_op, NEW.op_id;
  END IF;

  IF v_tipo IS NULL THEN
    RAISE EXCEPTION
      'Entrega % etapa=cima: modelo do op_item % sem tipo_produto; rota indeterminavel.',
      NEW.entrega_id, NEW.op_item_id;
  END IF;

  -- ---- Source OP must be non-empty and route-homogeneous ----------------
  SELECT count(*), count(DISTINCT m.tipo_produto)
    INTO v_item_ct, v_route_ct
    FROM public.op_itens oi
    JOIN public.modelos m ON m.id = oi.modelo_id
   WHERE oi.op_id = NEW.op_id;

  IF v_item_ct = 0 THEN
    RAISE EXCEPTION
      'Entrega % etapa=cima: OP % nao possui itens; rota indeterminavel.',
      NEW.entrega_id, NEW.op_id;
  END IF;

  IF v_route_ct <> 1 THEN
    RAISE EXCEPTION
      'Entrega % etapa=cima: OP % nao e homogenea de rota (% tipos distintos); entrega rejeitada.',
      NEW.entrega_id, NEW.op_id, v_route_ct;
  END IF;

  -- ---- The route-conditional destination rule ---------------------------
  IF v_tipo = 'tapete' THEN
    IF v_destino IS NULL THEN
      RAISE EXCEPTION
        'Entrega % etapa=cima de rota Tapete exige destino de acabamento (destino_fornecedor_id).',
        NEW.entrega_id;
    END IF;
  ELSIF v_tipo = 'manta' THEN
    IF v_destino IS NOT NULL THEN
      RAISE EXCEPTION
        'Entrega % etapa=cima de rota Manta nao admite destino de acabamento (destino_fornecedor_id=%); Manta nunca entra em acabamento.',
        NEW.entrega_id, v_destino;
    END IF;
  ELSE
    RAISE EXCEPTION
      'Entrega % etapa=cima: tipo_produto "%" desconhecido no op_item %; rota nao resolvida.',
      NEW.entrega_id, v_tipo, NEW.op_item_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS entrega_itens_cima_route_destino_guard ON public.entrega_itens;
CREATE TRIGGER entrega_itens_cima_route_destino_guard
  BEFORE INSERT OR UPDATE ON public.entrega_itens
  FOR EACH ROW EXECUTE FUNCTION public.entrega_itens_cima_route_destino_guard_fn();

COMMENT ON FUNCTION public.entrega_itens_cima_route_destino_guard_fn() IS
  'db/85: invariante de rota da entrega de tecelagem (etapa=cima), aplicada onde a rota se torna conhecivel — a escrita do item. Cobre INSERT e UPDATE que altere entrega_id/op_id/op_item_id (UPDATE de metros_entregues/defeito nao dispara nada). Exige op_item existente, pertencente a OP declarada, com OP nao vazia e homogenea; deriva a rota exclusivamente por op_itens.modelo_id -> modelos.tipo_produto (nunca por nome); exige destino_fornecedor_id NOT NULL para Tapete e NULL para Manta. Ordem de travas (R-I): ops FOR UPDATE apenas no INSERT; entregas(NEW.entrega_id) FOR SHARE apenas quando o pai muda; nenhum caminho segura linha de entrega_itens e pede linha de ops. Sem bypass por app.retificacao_autorizada; BEFORE trigger, sem escrita parcial.';

-- ============================================================
-- 3. HEADER GUARD — public.entregas.
--    Re-derives the route from every existing item so a destination cannot be
--    added to, or removed from, an existing `cima` delivery in violation of its
--    route. See R-II: no ops lock, no entrega_itens row lock.
-- ============================================================
CREATE OR REPLACE FUNCTION public.entregas_cima_destino_route_guard_fn()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item_ct      INTEGER;
  v_unresolved   INTEGER;
  v_route_ct     INTEGER;
  v_route        TEXT;
BEGIN
  -- Only an etapa / destino_fornecedor_id change is route-relevant. Any other
  -- header UPDATE (data, observacao, fornecedor_id) is untouched and takes no
  -- extra lock, preserving existing behavior.
  IF NEW.etapa IS NOT DISTINCT FROM OLD.etapa
     AND NEW.destino_fornecedor_id IS NOT DISTINCT FROM OLD.destino_fornecedor_id THEN
    RETURN NEW;
  END IF;

  -- Non-`cima` target etapa: existing behavior preserved (no destination rule).
  IF NEW.etapa IS DISTINCT FROM 'cima' THEN
    RETURN NEW;
  END IF;

  -- R-II: plain unlocked committed reads (db/84 BLOCKER E/F idiom). The UPDATE
  -- already holds this header's own row lock FOR NO KEY UPDATE, which conflicts
  -- with the FOR SHARE every route-changing item write takes on the same row, so
  -- the two strictly serialize and the loser re-validates against committed
  -- state. Reading tipo_produto unlocked is safe: db/79/db/80 make a model's
  -- route identity immutable once referenced by an op_item.
  SELECT count(*),
         count(*) FILTER (WHERE ei.op_item_id IS NULL
                             OR oi.op_id IS NULL
                             OR m.tipo_produto IS NULL),
         count(DISTINCT m.tipo_produto),
         min(m.tipo_produto)
    INTO v_item_ct, v_unresolved, v_route_ct, v_route
    FROM public.entrega_itens ei
    LEFT JOIN public.op_itens oi ON oi.id = ei.op_item_id
    LEFT JOIN public.modelos  m  ON m.id = oi.modelo_id
   WHERE ei.entrega_id = OLD.id;

  -- Item-less `cima` header: the explicitly accepted residual
  -- (ACTIVATION_CONTRACT §3 R-4). No measured output exists, so it grants no
  -- expedition eligibility; any item later moved in or inserted is validated by
  -- entrega_itens_cima_route_destino_guard under the serializing parent lock.
  IF v_item_ct = 0 THEN
    RETURN NEW;
  END IF;

  IF v_unresolved > 0 THEN
    RAISE EXCEPTION
      'Entrega % etapa=cima: % item(ns) com origem irresolvivel (op_item/modelo/tipo_produto); rota nao derivavel, alteracao de etapa/destino rejeitada.',
      OLD.id, v_unresolved;
  END IF;

  IF v_route_ct <> 1 THEN
    RAISE EXCEPTION
      'Entrega % etapa=cima: mistura de rotas entre os itens (% tipos distintos); alteracao de etapa/destino rejeitada.',
      OLD.id, v_route_ct;
  END IF;

  IF v_route = 'tapete' THEN
    IF NEW.destino_fornecedor_id IS NULL THEN
      RAISE EXCEPTION
        'Entrega % etapa=cima de rota Tapete exige destino de acabamento (destino_fornecedor_id); remocao do destino rejeitada.',
        OLD.id;
    END IF;
  ELSIF v_route = 'manta' THEN
    IF NEW.destino_fornecedor_id IS NOT NULL THEN
      RAISE EXCEPTION
        'Entrega % etapa=cima de rota Manta nao admite destino de acabamento (destino_fornecedor_id=%); Manta nunca entra em acabamento.',
        OLD.id, NEW.destino_fornecedor_id;
    END IF;
  ELSE
    RAISE EXCEPTION
      'Entrega % etapa=cima: tipo_produto "%" desconhecido nos itens; rota nao resolvida.',
      OLD.id, v_route;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS entregas_cima_destino_route_guard ON public.entregas;
CREATE TRIGGER entregas_cima_destino_route_guard
  BEFORE UPDATE ON public.entregas
  FOR EACH ROW EXECUTE FUNCTION public.entregas_cima_destino_route_guard_fn();

COMMENT ON FUNCTION public.entregas_cima_destino_route_guard_fn() IS
  'db/85: rederiva a rota de uma entrega etapa=cima a partir de TODOS os seus itens (op_itens.modelo_id -> modelos.tipo_produto) em um UPDATE que altere etapa ou destino_fornecedor_id, rejeitando mistura de rotas, remocao do destino em rota Tapete e adicao de destino em rota Manta. Cabecalho sem itens permanece o residual aceito. Ordem de travas (R-II): nenhuma trava de ops nem de entrega_itens — apenas a trava da propria linha alvo, que conflita com o FOR SHARE tomado por toda escrita de item que altere rota, serializando os dois lados. Sem bypass por app.retificacao_autorizada.';

-- ============================================================
-- 4. MANTA OUTPUT RPC — the ONLY Manta `cima` writer.
--    Atomic header + items + event. Never calls gerar_op_latex /
--    gerar_op_latex_split / any finishing writer.
-- ============================================================
CREATE OR REPLACE FUNCTION public.registrar_entrega_cima_manta(
  p_op_id         BIGINT,
  p_fornecedor_id BIGINT,
  p_data          DATE,
  p_itens         JSONB,
  p_observacao    TEXT DEFAULT NULL
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
  v_req               RECORD;
  v_op_item           RECORD;
  v_entrega_id        BIGINT;
  v_rows              INTEGER := 0;
  v_itens_result      JSONB := '[]'::jsonb;
  v_total             NUMERIC(10,2) := 0;
  v_total_valido      NUMERIC(10,2) := 0;
  v_total_defeito     NUMERIC(10,2) := 0;
  v_entrega_item_id   BIGINT;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'sem_permissao', 'erro', 'Sem permissao');
  END IF;

  IF p_itens IS NULL OR jsonb_typeof(p_itens) <> 'array' OR jsonb_array_length(p_itens) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'payload_vazio', 'erro', 'Informe ao menos um item medido');
  END IF;

  IF p_fornecedor_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'fornecedor_invalido', 'erro', 'Informe o fornecedor de tecelagem da saida');
  END IF;

  -- Lock order step 2: the source OP FOR UPDATE, BEFORE any balance or identity
  -- read, so concurrent writers for the same production unit serialize.
  SELECT * INTO v_op FROM public.ops WHERE id = p_op_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'op_inexistente', 'erro', 'OP de tecelagem nao encontrada');
  END IF;

  IF COALESCE(v_op.tipo, '') <> 'tecelagem' THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'op_tipo_invalido',
      'erro', 'Somente OP de tecelagem registra saida medida de Manta', 'tipo', v_op.tipo);
  END IF;

  -- Route: non-empty and homogeneously Manta, derived strictly from
  -- modelos.tipo_produto. Never a model name.
  SELECT count(*), count(*) FILTER (WHERE m.tipo_produto IS DISTINCT FROM 'manta')
    INTO v_item_ct, v_nonmanta
    FROM public.op_itens oi
    JOIN public.modelos m ON m.id = oi.modelo_id
   WHERE oi.op_id = p_op_id;

  IF v_item_ct = 0 THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'op_vazia', 'erro', 'OP de tecelagem sem itens');
  END IF;
  IF v_nonmanta > 0 THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'op_nao_manta',
      'erro', 'OP de tecelagem nao e homogenea de Manta', 'itens_nao_manta', v_nonmanta);
  END IF;

  -- Commercial lineage OP -> lote -> pedido -> cliente (db/84 shape). Derived,
  -- never accepted from the client.
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

  IF NOT EXISTS (SELECT 1 FROM public.fornecedores f WHERE f.id = p_fornecedor_id) THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'fornecedor_invalido', 'erro', 'Fornecedor de tecelagem inexistente');
  END IF;

  -- Deterministic payload normalization. Duplicate entries are aggregated per
  -- (op_item_id, defeito): the defect flag is part of the measured identity (a
  -- defect metre is not the same measurement as a good metre), so collapsing
  -- across it would destroy information. Ordering is total and stable.
  FOR v_req IN
    SELECT x.op_item_id, x.defeito, ROUND(SUM(x.metros_entregues)::NUMERIC, 2) AS metros
      FROM jsonb_to_recordset(p_itens)
             AS x(op_item_id BIGINT, metros_entregues NUMERIC, defeito BOOLEAN)
     GROUP BY x.op_item_id, x.defeito
     ORDER BY x.op_item_id, x.defeito
  LOOP
    v_rows := v_rows + 1;

    IF v_req.op_item_id IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'codigo', 'item_invalido', 'erro', 'Item sem op_item_id');
    END IF;
    IF v_req.defeito IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'codigo', 'defeito_ausente',
        'erro', 'Informe explicitamente o estado de defeito do item', 'op_item_id', v_req.op_item_id);
    END IF;
    IF v_req.metros IS NULL OR v_req.metros <= 0 THEN
      RETURN jsonb_build_object('ok', false, 'codigo', 'metros_invalidos',
        'erro', 'Metragem medida deve ser maior que zero', 'op_item_id', v_req.op_item_id);
    END IF;

    SELECT oi.id, oi.modelo_id, oi.pedido_item_id
      INTO v_op_item
      FROM public.op_itens oi
     WHERE oi.id = v_req.op_item_id AND oi.op_id = p_op_id;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('ok', false, 'codigo', 'item_fora_da_op',
        'erro', 'Item nao pertence a OP de tecelagem informada', 'op_item_id', v_req.op_item_id);
    END IF;

    v_total := ROUND((v_total + v_req.metros)::NUMERIC, 2);
    IF v_req.defeito THEN
      v_total_defeito := ROUND((v_total_defeito + v_req.metros)::NUMERIC, 2);
    ELSE
      v_total_valido := ROUND((v_total_valido + v_req.metros)::NUMERIC, 2);
    END IF;

    v_itens_result := v_itens_result || jsonb_build_array(jsonb_build_object(
      'op_item_id',       v_op_item.id,
      'modelo_id',        v_op_item.modelo_id,
      'pedido_item_id',   v_op_item.pedido_item_id,
      'metros_entregues', v_req.metros,
      'defeito',          v_req.defeito
    ));
  END LOOP;

  IF v_rows = 0 OR v_total <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'payload_vazio', 'erro', 'Informe quantidade maior que zero');
  END IF;

  -- Lock order step 5: header then items. destino_fornecedor_id is NULL by
  -- construction; the source weaving supplier is carried by the existing
  -- canonical entregas.fornecedor_id field.
  INSERT INTO public.entregas (fornecedor_id, etapa, data, observacao, destino_fornecedor_id)
  VALUES (p_fornecedor_id, 'cima', COALESCE(p_data, CURRENT_DATE), p_observacao, NULL)
  RETURNING id INTO v_entrega_id;

  FOR v_req IN SELECT value AS item FROM jsonb_array_elements(v_itens_result)
  LOOP
    INSERT INTO public.entrega_itens (entrega_id, op_id, op_item_id, modelo_id, metros_entregues, defeito)
    VALUES (
      v_entrega_id,
      p_op_id,
      (v_req.item->>'op_item_id')::BIGINT,
      (v_req.item->>'modelo_id')::BIGINT,
      (v_req.item->>'metros_entregues')::NUMERIC(10,2),
      (v_req.item->>'defeito')::BOOLEAN
    )
    RETURNING id INTO v_entrega_item_id;
  END LOOP;

  INSERT INTO public.op_eventos (op_id, tipo_evento, observacao, payload, criado_por)
  VALUES (
    p_op_id,
    'manta_saida_registrada',
    p_observacao,
    jsonb_build_object(
      'entrega_id',            v_entrega_id,
      'fornecedor_id',         p_fornecedor_id,
      'data',                  COALESCE(p_data, CURRENT_DATE),
      'itens',                 v_itens_result,
      'total_medido',          v_total,
      'total_sem_defeito',     v_total_valido,
      'total_defeito',         v_total_defeito,
      'observacao',            p_observacao
    ),
    auth.uid()
  );

  RETURN jsonb_build_object(
    'ok',                true,
    'entrega_id',        v_entrega_id,
    'op_id',             p_op_id,
    'pedido_id',         v_lote.pedido_id,
    'lote_id',           v_op.lote_id,
    'cliente_id',        v_lote.cliente_id,
    'fornecedor_id',     p_fornecedor_id,
    'data',              COALESCE(p_data, CURRENT_DATE),
    'destino_fornecedor_id', NULL::BIGINT,
    'total_medido',      v_total,
    'total_sem_defeito', v_total_valido,
    'total_defeito',     v_total_defeito,
    'observacao',        p_observacao,
    'itens',             v_itens_result
  );
EXCEPTION WHEN OTHERS THEN
  -- Only unexpected failures reach here: every expected validation branch above
  -- returns a stable identifier BEFORE any write. The subtransaction rollback
  -- guarantees header, items and event commit together or not at all.
  RETURN jsonb_build_object('ok', false, 'codigo', 'erro_inesperado', 'erro', SQLERRM);
END;
$$;

-- Authorization for the NEW function only. Existing delivery/expedition RPC
-- grants are untouched; no table grant is broadened.
REVOKE EXECUTE ON FUNCTION public.registrar_entrega_cima_manta(BIGINT, BIGINT, DATE, JSONB, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.registrar_entrega_cima_manta(BIGINT, BIGINT, DATE, JSONB, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.registrar_entrega_cima_manta(BIGINT, BIGINT, DATE, JSONB, TEXT) TO authenticated;

COMMENT ON FUNCTION public.registrar_entrega_cima_manta(BIGINT, BIGINT, DATE, JSONB, TEXT) IS
  'db/85: unico escritor da saida medida de tecelagem de rota MANTA. Admin-only, SECURITY DEFINER, search_path=public. Trava a OP fonte FOR UPDATE antes de qualquer leitura de identidade/saldo; exige ops.tipo=tecelagem, OP nao vazia e homogenea de Manta e linhagem OP->lote->pedido->cliente valida (derivada, nunca aceita do cliente); normaliza o payload por (op_item_id, defeito); grava o cabecalho entregas com etapa=cima e destino_fornecedor_id=NULL (fornecedor de tecelagem no campo canonico fornecedor_id), os entrega_itens com modelo_id copiado do op_item, e um op_eventos manta_saida_registrada — tudo atomicamente. NUNCA chama gerar_op_latex/gerar_op_latex_split nem qualquer escritor de acabamento. Erros de validacao retornam identificadores estaveis, sem vazar SQLERRM.';

-- ============================================================
-- 5. Reload PostgREST
-- ============================================================
NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';

COMMIT;
