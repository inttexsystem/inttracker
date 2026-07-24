-- =====================================================================
-- db/88_manta_measured_output_identity_and_fk_lock_correction.sql
-- PHASE-MANTA-B2A — forward correction: measured-output model identity,
-- op_item identity freeze, and the foreign-key row-lock order.
--
-- Order: PHASE-MANTA-B2A-MEASURED-OUTPUT-IDENTITY-AND-FK-LOCK-CORRECTION-R1.
-- Governing contract: docs/architecture/MANTA_DIRECT_ROUTE_ACTIVATION_CONTRACT.md
-- (§3, §4, §9, §15); schema shapes docs/architecture/PEDIDO_OP_SCHEMA_CONTRACT.md.
-- Forward-only; db/01..db/87 are untouched. The migration terminal guard advances
-- 87 -> 88 in the same commit (tests/ordem-compra-c3d-deploy.smoke.js).
--
-- WHAT IS CORRECTED
--   A. Delivery-item identity alignment. db/85's route guard treated
--      entrega_itens.modelo_id as irrelevant, so a `cima` item could carry a
--      model that contradicts its own op_item, and a modelo_id-only UPDATE
--      escaped through the early return entirely.
--   B. Measured Manta output froze nothing on the op_item side. Once measured
--      Manta output referenced an op_item, that op_item could still silently
--      change op_id / modelo_id / pedido_item_id, retro-actively rewriting what
--      the recorded output means.
--   C. Foreign-key row-lock order. db/85-87 acquired the source `ops` row FIRST
--      and only then wrote entrega_itens / expedicao_itens, whose FOREIGN KEYS
--      (`entrega_itens.op_item_id -> op_itens.id` and
--      `expedicao_itens.op_item_id -> op_itens.id`) take an IMPLICIT
--      `FOR KEY SHARE` row lock on the referenced op_item. Meanwhile every
--      pre-existing op_itens guard (db/80 route homogeneity, db/81 expedition
--      reference, db/82 source non-emptiness) runs as a BEFORE-ROW trigger on
--      `public.op_itens`, i.e. AFTER the statement already owns that op_item's
--      target-row lock, and then requests the OP `FOR UPDATE`.
--        => Manta paths had  OP -> op_item   while op_itens writers had
--           op_item -> OP. That is a real cycle and a real 40P01 risk.
--
-- ---------------------------------------------------------------------
-- CORRECTED GLOBAL DETERMINISTIC LOCK ORDER
-- ---------------------------------------------------------------------
--   1. pg_advisory_xact_lock (idempotency identity), when a key is supplied —
--      always before ANY table row lock;
--   2. public.op_itens rows, ascending id, FOR KEY SHARE;
--   3. source public.ops row(s), ascending id, FOR UPDATE;
--   4. source public.lotes FOR SHARE, then source public.pedidos FOR SHARE;
--   5. public.modelos rows, ascending id, FOR SHARE (always a LEAF);
--   6. public.entregas / public.entrega_itens;
--   7. public.expedicoes;
--   8. public.expedicao_itens, ascending id.
--   (public.pedidos FOR UPDATE remains completion-only; that path acquires
--    nothing else — db/87.)
--
-- WHY op_item BEFORE OP, AND WHY EXACTLY `FOR KEY SHARE`.
--   A DELETE or UPDATE of an op_item already owns that row's target lock before
--   its BEFORE-ROW triggers request the OP, so `op_item -> OP` is fixed by
--   PostgreSQL and cannot be reversed. Every Manta path therefore adopts the
--   same direction and pre-locks the op_items it will reference.
--   `FOR KEY SHARE` is the exact mode required:
--     * it CONFLICTS with `FOR UPDATE`, so a concurrent DELETE of the op_item
--       blocks (and is then refused by the FK's ON DELETE RESTRICT);
--     * it does NOT conflict with `FOR NO KEY UPDATE`, so a non-key identity
--       UPDATE (op_id / modelo_id / pedido_item_id) is free to continue to the
--       shared serialization point — the source `ops` row — instead of
--       deadlocking against the writer;
--     * the winner is then decided by the post-OP-lock re-read: whoever commits
--       first is observed by the other, which re-validates against committed
--       state and fails closed;
--     * it is the SAME lock the foreign key itself would take moments later, so
--       taking it explicitly and earlier adds no new edge — it only makes the
--       acquisition deterministic and puts validation under the lock.
--
-- RESIDUAL, EXPLICITLY RECORDED (not introduced here, not in scope).
--   A direct `UPDATE public.entrega_itens SET op_item_id = …` (or the same on
--   `expedicao_itens`) inherently holds its own row lock (step 6/8) and then
--   takes the FK's `FOR KEY SHARE` on the op_item (step 2) — a descending
--   acquisition that PostgreSQL performs with or without this migration. It
--   cannot cycle with the Manta writers, because those hold the op_item only in
--   `FOR KEY SHARE`, which is compatible with the FK's own `FOR KEY SHARE`
--   request, so neither ever waits on the other for that resource. No product
--   writer re-points `op_item_id`; the RPCs only ever INSERT.
--   Separately, the pre-existing TAPETE finishing writer `db/32`
--   (`liberar_expedicao_latex_parcial`) takes `ops FOR UPDATE` and only then
--   `op_itens … FOR UPDATE`, i.e. OP -> op_item. That is db/32's own accepted
--   behavior, it is not a Manta path, and db/01..db/87 are frozen by this order,
--   so it is left exactly as it is. This migration does not add any edge to it:
--   the corrected `expedicao_itens_membership_guard_fn` re-enters locks that
--   db/32 already holds.
--
-- BOUNDED INTERPRETATION OF THE modelo_id RULE (recorded because it is a real
-- decision, not an omission).
--   `public.entrega_itens.modelo_id` is NULLABLE, with
--   `CHECK (op_item_id IS NOT NULL OR modelo_id IS NOT NULL)`: it is an
--   ALTERNATIVE identifier for legacy rows that carry no op_item, not a
--   mandatory mirror. The live Tapete writer (`salvarEntregaCima` via
--   `js/screens/entrega-form.js` `getPayload`) sends only
--   `{op_item_id, metros_entregues, defeito, observacao}` and NEVER sends
--   `modelo_id`, so every `cima` row it creates has `modelo_id IS NULL`.
--   Requiring a non-null exact match unconditionally would therefore reject
--   every Tapete delivery written by the product — a Tapete behavior change this
--   order forbids. The rule is consequently ROUTE-CONDITIONAL, which loses
--   nothing:
--     * MANTA `cima` item  -> `modelo_id` is MANDATORY and must equal
--       `op_itens.modelo_id` exactly. The only Manta writer
--       (`registrar_entrega_cima_manta`) always copies it from the op_item, so
--       objective 1 ("every Manta measured-output row has the exact model
--       identity of its op_item") is met with no gap, including against a direct
--       table write.
--     * TAPETE `cima` item -> a SUPPLIED `modelo_id` must equal
--       `op_itens.modelo_id` exactly (divergence rejected, never rewritten); a
--       NULL `modelo_id` remains valid, because identity is already fully
--       determined by the `op_item_id` that db/85 makes mandatory on `cima`.
--   No payload is ever silently rewritten and no name is ever inferred.
--
-- Forward-only. Idempotent: CREATE OR REPLACE FUNCTION + DROP/CREATE TRIGGER
-- only; the data gate is a pure validation DO block. No table, column,
-- constraint, index, RLS policy or data change. No db/81-87 guard is weakened;
-- no `app.retificacao_autorizada` is granted to any writer; no existing RPC
-- signature, grant, authorization, return shape or event semantics changes; the
-- Tapete and Latex writers are untouched.
--
-- Depende de db/79, db/80, db/81, db/82, db/83, db/84, db/85, db/86, db/87.
-- Aplicar SOMENTE em ambiente local/descartavel. NAO aplicar em shared
-- development, staging ou producao sem ordem explicita.
-- =====================================================================

BEGIN;

-- ============================================================
-- 0. PRE-EXISTING DATA GATE (Blocker A).
--    Fail closed (abort the whole migration) if any ITEM-BEARING
--    entregas.etapa='cima' row already violates what this migration makes
--    authoritative. No repair, no reinterpretation. The item-less `cima` header
--    remains the explicitly accepted residual (ACTIVATION_CONTRACT §3 R-4).
-- ============================================================
DO $gate$
DECLARE
  v_bad_count INTEGER;
  v_bad_ids   BIGINT[];
BEGIN
  WITH item_route AS (
    SELECT
      e.id                                     AS entrega_id,
      e.destino_fornecedor_id,
      ei.op_id                                 AS declared_op_id,
      ei.op_item_id,
      ei.modelo_id                             AS declared_modelo_id,
      oi.op_id                                 AS owning_op_id,
      oi.modelo_id                             AS owning_modelo_id,
      m.tipo_produto
      FROM public.entregas e
      JOIN public.entrega_itens ei ON ei.entrega_id = e.id
      LEFT JOIN public.op_itens oi ON oi.id = ei.op_item_id
      LEFT JOIN public.modelos  m  ON m.id = oi.modelo_id
     WHERE e.etapa = 'cima'
  ),
  per_entrega AS (
    SELECT
      entrega_id,
      destino_fornecedor_id,
      count(*)                                                              AS item_ct,
      count(*) FILTER (WHERE op_item_id IS NULL
                          OR owning_op_id IS NULL
                          OR owning_modelo_id IS NULL
                          OR tipo_produto IS NULL)                          AS unresolved_ct,
      count(*) FILTER (WHERE owning_op_id IS DISTINCT FROM declared_op_id)  AS foreign_op_ct,
      count(*) FILTER (WHERE declared_modelo_id IS NOT NULL
                          AND declared_modelo_id IS DISTINCT FROM owning_modelo_id)
                                                                            AS modelo_divergente_ct,
      count(*) FILTER (WHERE tipo_produto = 'manta'
                          AND declared_modelo_id IS NULL)                   AS manta_sem_modelo_ct,
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
        OR foreign_op_ct > 0
        OR modelo_divergente_ct > 0
        OR manta_sem_modelo_ct > 0
        OR route_ct <> 1
        OR (route = 'tapete' AND destino_fornecedor_id IS NULL)
        OR (route = 'manta'  AND destino_fornecedor_id IS NOT NULL) );

  IF v_bad_count > 0 THEN
    RAISE EXCEPTION
      'PHASE-MANTA-B2A db/88 pre-existing data gate: % entrega(s) etapa=cima com itens violam a identidade de origem/modelo ou a regra de rota/destino (ids=%). Migracao abortada; nenhuma linha foi reparada ou reinterpretada.',
      v_bad_count, v_bad_ids;
  END IF;
END
$gate$;

-- ============================================================
-- 1. BLOCKER A + C — delivery-item route, exact model identity, and the
--    op_item-before-OP lock order.
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
  v_owning_modelo    BIGINT;
  v_tipo             TEXT;
  v_item_ct          INTEGER;
  v_route_ct         INTEGER;
BEGIN
  -- ---- Scope ------------------------------------------------------------
  -- db/88 BLOCKER A widens the trigger-relevant identity set from
  -- entrega_id/op_id/op_item_id to ALSO include modelo_id, so a modelo_id-only
  -- UPDATE can no longer escape through the early return. A pure
  -- metros_entregues / defeito / observacao UPDATE still takes NO lock and
  -- re-runs NO validation, preserving the delivery-correction behavior exactly
  -- (and keeping this guard off the lock path db/86's release writer depends on).
  IF TG_OP = 'UPDATE' THEN
    v_parent_changed   := NEW.entrega_id IS DISTINCT FROM OLD.entrega_id;
    v_identity_changed := v_parent_changed
                          OR NEW.op_id      IS DISTINCT FROM OLD.op_id
                          OR NEW.op_item_id IS DISTINCT FROM OLD.op_item_id
                          OR NEW.modelo_id  IS DISTINCT FROM OLD.modelo_id;
    IF NOT v_identity_changed THEN
      RETURN NEW;
    END IF;
  ELSE
    v_parent_changed := TRUE;
  END IF;

  -- ---- Locks (db/88 step 2, then db/85 R-I) -----------------------------
  -- Step 2: the referenced op_item FOR KEY SHARE, BEFORE anything else. This is
  -- the same lock the foreign key would take after this trigger, so it adds no
  -- edge; taking it here makes the acquisition deterministic, blocks a
  -- concurrent DELETE of the op_item, and lets a concurrent non-key identity
  -- UPDATE proceed to the shared `ops` serialization point instead of
  -- deadlocking.
  IF NEW.op_item_id IS NOT NULL THEN
    PERFORM 1 FROM public.op_itens WHERE id = NEW.op_item_id FOR KEY SHARE;
  END IF;

  IF TG_OP = 'INSERT' THEN
    -- Step 3. Only the INSERT path may take the OP row: it holds no
    -- pre-existing entrega_itens row lock, so this is a clean ascending
    -- acquisition. db/85 R-I stands: no path holds an entrega_itens row lock
    -- and then requests an ops row lock, so the UPDATE path below takes none.
    IF NEW.op_id IS NOT NULL THEN
      PERFORM 1 FROM public.ops WHERE id = NEW.op_id FOR UPDATE;
    END IF;
  END IF;

  IF v_parent_changed THEN
    -- Step 6. FOR SHARE conflicts with the FOR NO KEY UPDATE a header
    -- route/destination UPDATE holds, so the two strictly serialize; the FK's
    -- implicit FOR KEY SHARE on entregas would not.
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

  -- ---- Source identity, read STRICTLY AFTER the locks above -------------
  -- No model-name inference anywhere; no app.retificacao_autorizada bypass.
  IF NEW.op_item_id IS NULL THEN
    RAISE EXCEPTION
      'Entrega % etapa=cima: item de entrega exige op_item_id (rota indeterminavel sem o item da OP).',
      NEW.entrega_id;
  END IF;

  SELECT oi.op_id, oi.modelo_id, m.tipo_produto
    INTO v_owning_op, v_owning_modelo, v_tipo
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

  IF v_owning_modelo IS NULL OR v_tipo IS NULL THEN
    RAISE EXCEPTION
      'Entrega % etapa=cima: modelo do op_item % ausente ou sem tipo_produto; rota indeterminavel.',
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

  -- ---- db/88 BLOCKER A: exact model identity ----------------------------
  -- A supplied modelo_id must mirror the authoritative op_item model exactly;
  -- it is never silently rewritten. For the MANTA route it is additionally
  -- MANDATORY, so measured Manta output can never exist without the exact model
  -- identity of its op_item. For TAPETE a NULL remains valid: the column is
  -- nullable by design (the alternative identifier for legacy item-less-op rows)
  -- and identity is already fully determined by the op_item_id that db/85 makes
  -- mandatory on `cima`.
  IF NEW.modelo_id IS NOT NULL AND NEW.modelo_id IS DISTINCT FROM v_owning_modelo THEN
    RAISE EXCEPTION
      'Entrega % etapa=cima: modelo_id % nao corresponde ao modelo % do op_item % (identidade divergente rejeitada, sem reescrita).',
      NEW.entrega_id, NEW.modelo_id, v_owning_modelo, NEW.op_item_id;
  END IF;

  IF v_tipo = 'manta' AND NEW.modelo_id IS NULL THEN
    RAISE EXCEPTION
      'Entrega % etapa=cima de rota Manta: modelo_id e obrigatorio e deve ser exatamente o modelo % do op_item %.',
      NEW.entrega_id, v_owning_modelo, NEW.op_item_id;
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

COMMENT ON FUNCTION public.entrega_itens_cima_route_destino_guard_fn() IS
  'db/88: como db/85 (invariante de rota da entrega etapa=cima aplicada na escrita do item) e adicionalmente (BLOCKER A) trata modelo_id como campo de identidade relevante ao gatilho — um UPDATE somente de modelo_id nao escapa mais pelo early return — exigindo NEW.modelo_id = op_itens.modelo_id quando informado e tornando-o obrigatorio na rota Manta, sem reescrita silenciosa. (BLOCKER C) trava o op_item referenciado com FOR KEY SHARE ANTES de qualquer outra trava — a mesma trava que a FK tomaria em seguida, agora deterministica e com a validacao sob ela — mantendo ops FOR UPDATE apenas no INSERT (db/85 R-I) e entregas FOR SHARE apenas quando o pai muda. Sem inferencia por nome; sem bypass por app.retificacao_autorizada; BEFORE trigger, sem escrita parcial.';

-- ============================================================
-- 2. BLOCKER B — measured Manta output freezes the op_item's identity.
--    Once an op_item is referenced by Manta measured output
--    (entrega_itens whose parent has etapa='cima' and whose route is Manta),
--    its op_id / modelo_id / pedido_item_id are immutable: otherwise a later
--    identity change would retro-actively rewrite what the recorded output
--    means. Correcting measured output requires removing or correcting the
--    delivery reference first; after positive expedition consumption db/81 is
--    the stronger guard and refuses even that.
--
--    Lock discipline: the OP row is taken FOR UPDATE (ascending) BEFORE the
--    reference is inspected — the canonical `op_item -> OP` direction that
--    db/80 and db/82 already establish for op_itens triggers, so no new edge is
--    introduced. It is also REQUIRED for correctness: trigger functions on
--    public.op_itens fire alphabetically, so this guard runs BEFORE
--    op_itens_route_homogeneity_guard would take that lock; without taking it
--    here the reference check would read a pre-serialization snapshot and a
--    concurrent output writer could commit its delivery row unseen.
--
--    DELETE is deliberately NOT covered: entrega_itens.op_item_id ->
--    op_itens.id is ON DELETE RESTRICT, which already refuses it, and adding a
--    DELETE policy here would put an extra acquisition on the cascade path.
-- ============================================================
CREATE OR REPLACE FUNCTION public.op_itens_manta_output_reference_guard_fn()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lock_id BIGINT;
BEGIN
  -- Only a change to one of the three identity fields is relevant. Same-value
  -- updates, and quantity updates such as metros_pedidos / metros_ajustados,
  -- remain governed by the pre-existing rules and take no lock here.
  IF NEW.op_id          IS NOT DISTINCT FROM OLD.op_id
     AND NEW.modelo_id      IS NOT DISTINCT FROM OLD.modelo_id
     AND NEW.pedido_item_id IS NOT DISTINCT FROM OLD.pedido_item_id THEN
    RETURN NEW;
  END IF;

  -- Lock order step 3: affected OP rows, ascending op_id, FOR UPDATE. This is
  -- the serialization point every Manta output/release writer also takes, so
  -- the EXISTS below observes committed state.
  FOR v_lock_id IN
    SELECT DISTINCT oid
      FROM unnest(ARRAY[OLD.op_id, NEW.op_id]) AS t(oid)
     WHERE oid IS NOT NULL
     ORDER BY oid
  LOOP
    PERFORM 1 FROM public.ops WHERE id = v_lock_id FOR UPDATE;
  END LOOP;

  -- Manta measured output referencing this op_item. The route is derived from
  -- the op_item's OWN current model (modelos.tipo_produto), never a name.
  IF EXISTS (
    SELECT 1
      FROM public.entrega_itens ei
      JOIN public.entregas e ON e.id = ei.entrega_id
      JOIN public.modelos  m ON m.id = OLD.modelo_id
     WHERE ei.op_item_id = OLD.id
       AND e.etapa = 'cima'
       AND m.tipo_produto = 'manta'
  ) THEN
    RAISE EXCEPTION
      'op_item %: possui saida medida de tecelagem (Manta) registrada; op_id, modelo_id e pedido_item_id sao imutaveis (tentativa op_id %->%, modelo_id %->%, pedido_item_id %->%). Corrija ou remova a entrega de origem primeiro. Sem bypass por app.retificacao_autorizada.',
      OLD.id, OLD.op_id, NEW.op_id, OLD.modelo_id, NEW.modelo_id, OLD.pedido_item_id, NEW.pedido_item_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS op_itens_manta_output_reference_guard ON public.op_itens;
CREATE TRIGGER op_itens_manta_output_reference_guard
  BEFORE UPDATE ON public.op_itens
  FOR EACH ROW EXECUTE FUNCTION public.op_itens_manta_output_reference_guard_fn();

COMMENT ON FUNCTION public.op_itens_manta_output_reference_guard_fn() IS
  'db/88 BLOCKER B: enquanto o op_item e referenciado por saida medida de tecelagem de rota Manta (entrega_itens cujo cabecalho tem etapa=cima e cujo modelo do op_item e manta), rejeita alteracao de op_id, modelo_id e pedido_item_id — a identidade da saida medida nao pode ser reescrita retroativamente. Atualizacao de mesmo valor e alteracoes de quantidade (metros_pedidos/metros_ajustados) permanecem permitidas e regidas pelas regras existentes; op_itens nao relacionados nao sao afetados; comportamento Tapete inalterado. Trava as OPs afetadas FOR UPDATE (ordem crescente) antes de inspecionar, porque os gatilhos de op_itens disparam em ordem alfabetica e este roda antes do guard de homogeneidade que tomaria essa trava. Sem bypass por app.retificacao_autorizada; DELETE permanece barrado pela FK ON DELETE RESTRICT. Apos consumo positivo de expedicao, db/81 e o guard mais forte.';

-- ============================================================
-- 3. BLOCKER C — expedition-item membership guard: op_item FOR KEY SHARE
--    before the source OP. Protects DIRECT expedicao_itens writes as well as
--    the RPC path; re-enters locks the existing writers already hold.
--    Every db/82 membership check and db/83 identity check is preserved.
-- ============================================================
CREATE OR REPLACE FUNCTION public.expedicao_itens_membership_guard_fn()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_latex       BIGINT;
  v_tecelagem   BIGINT;
  v_src_op      BIGINT;
  v_src_op2     BIGINT;
  v_item_op     BIGINT;
  v_item_modelo BIGINT;
  v_item_pedido UUID;
BEGIN
  -- Delivery-only UPDATE (quantities/timestamps): none of the four identity
  -- fields changed, no lock, no re-validation (db/83).
  IF TG_OP = 'UPDATE'
     AND NEW.op_item_id     IS NOT DISTINCT FROM OLD.op_item_id
     AND NEW.expedicao_id   IS NOT DISTINCT FROM OLD.expedicao_id
     AND NEW.modelo_id      IS NOT DISTINCT FROM OLD.modelo_id
     AND NEW.pedido_item_id IS NOT DISTINCT FROM OLD.pedido_item_id THEN
    RETURN NEW;
  END IF;

  -- db/88 BLOCKER C, lock order step 2: the referenced op_item FOR KEY SHARE
  -- BEFORE the source OP. Same lock the FK would take afterwards; taking it
  -- first keeps every Manta path on the canonical op_item -> OP direction.
  IF NEW.op_item_id IS NOT NULL THEN
    PERFORM 1 FROM public.op_itens WHERE id = NEW.op_item_id FOR KEY SHARE;
  END IF;

  -- (1) Preliminary candidate: which OP is the expedition's selected source
  -- (db/82).
  SELECT ex.op_latex_id, ex.op_tecelagem_id
    INTO v_latex, v_tecelagem
    FROM public.expedicoes ex WHERE ex.id = NEW.expedicao_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item de expedicao: expedicao % inexistente.', NEW.expedicao_id;
  END IF;
  v_src_op := COALESCE(v_latex, v_tecelagem);
  IF v_src_op IS NULL THEN
    RAISE EXCEPTION 'Item de expedicao: expedicao % sem fonte definida.', NEW.expedicao_id;
  END IF;

  -- (2) Lock order step 3: the selected source OP FOR UPDATE (db/82). The
  -- source is immutable (db/82 A), so no expedicoes row lock is needed.
  PERFORM 1 FROM public.ops WHERE id = v_src_op FOR UPDATE;

  -- (3) Post-lock re-reads: the (immutable) source and the CURRENT op_item
  -- identity (db/82 source; db/83 BLOCKER C widened to modelo_id/pedido_item_id).
  SELECT ex.op_latex_id, ex.op_tecelagem_id
    INTO v_latex, v_tecelagem
    FROM public.expedicoes ex WHERE ex.id = NEW.expedicao_id;
  v_src_op2 := COALESCE(v_latex, v_tecelagem);
  IF v_src_op2 IS DISTINCT FROM v_src_op THEN
    RAISE EXCEPTION 'Item de expedicao: fonte da expedicao % mudou durante a validacao.', NEW.expedicao_id;
  END IF;

  SELECT oi.op_id, oi.modelo_id, oi.pedido_item_id
    INTO v_item_op, v_item_modelo, v_item_pedido
    FROM public.op_itens oi WHERE oi.id = NEW.op_item_id;
  IF v_item_op IS NULL THEN
    RAISE EXCEPTION 'Item de expedicao: op_item_id % inexistente.', NEW.op_item_id;
  END IF;

  -- (4) OP membership using ONLY post-lock values (db/82).
  IF v_item_op <> v_src_op2 THEN
    RAISE EXCEPTION
      'Item de expedicao: op_item % (OP %) nao pertence a OP fonte % da expedicao % (injecao cross-OP rejeitada).',
      NEW.op_item_id, v_item_op, v_src_op2, NEW.expedicao_id;
  END IF;

  -- (5) db/83 BLOCKER C: model identity must mirror the op_item exactly.
  IF NEW.modelo_id IS DISTINCT FROM v_item_modelo THEN
    RAISE EXCEPTION
      'Item de expedicao: modelo_id % nao corresponde ao modelo % do op_item % (identidade divergente rejeitada).',
      NEW.modelo_id, v_item_modelo, NEW.op_item_id;
  END IF;

  -- (6) db/83 BLOCKER C: Pedido origin must mirror the op_item exactly.
  IF NEW.pedido_item_id IS DISTINCT FROM v_item_pedido THEN
    RAISE EXCEPTION
      'Item de expedicao: pedido_item_id % nao corresponde a origem % do op_item % (identidade divergente rejeitada).',
      NEW.pedido_item_id, v_item_pedido, NEW.op_item_id;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.expedicao_itens_membership_guard_fn() IS
  'db/88: como db/83 (op_item deve pertencer a OP fonte selecionada e NEW.modelo_id/NEW.pedido_item_id devem espelhar exatamente o op_item, tudo validado pos-lock; early-return de UPDATE somente-entrega exige as quatro colunas de identidade inalteradas) e adicionalmente (BLOCKER C) trava o op_item referenciado com FOR KEY SHARE ANTES da OP fonte, mantendo todo caminho Manta na direcao canonica op_item -> OP e protegendo tambem escritas diretas em expedicao_itens. Nenhuma verificacao de db/82/db/83 foi enfraquecida.';

-- ============================================================
-- 4. BLOCKER C — Manta output RPC: op_items FOR KEY SHARE ascending, then the
--    source OP, then a post-lock re-read of every requested op_item.
--    Signature, grants, authorization, return shape and event semantics are
--    preserved exactly; no finishing writer is ever called.
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
  v_lock_id           BIGINT;
  v_req               RECORD;
  v_op_item           RECORD;
  v_entrega_id        BIGINT;
  v_rows              INTEGER := 0;
  v_itens_result      JSONB := '[]'::jsonb;
  v_total             NUMERIC(10,2) := 0;
  v_total_valido      NUMERIC(10,2) := 0;
  v_total_defeito     NUMERIC(10,2) := 0;
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

  -- (1) Parse and normalize the payload WITHOUT mutating anything, so the set
  --     of op_items to pre-lock is known before any lock is taken.
  -- (2) Lock order step 2: every DISTINCT requested op_item FOR KEY SHARE, in
  --     ascending id. Deterministic order; blocks a concurrent DELETE; lets a
  --     concurrent non-key identity UPDATE continue to the OP serialization
  --     point instead of deadlocking against this writer.
  FOR v_lock_id IN
    SELECT DISTINCT x.op_item_id
      FROM jsonb_to_recordset(p_itens)
             AS x(op_item_id BIGINT, metros_entregues NUMERIC, defeito BOOLEAN)
     WHERE x.op_item_id IS NOT NULL
     ORDER BY 1
  LOOP
    PERFORM 1 FROM public.op_itens WHERE id = v_lock_id FOR KEY SHARE;
  END LOOP;

  -- (3) Lock order step 3: the source OP FOR UPDATE, before any balance or
  --     identity read, so concurrent writers for the same production unit
  --     serialize and the re-reads below observe committed identity.
  SELECT * INTO v_op FROM public.ops WHERE id = p_op_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'op_inexistente', 'erro', 'OP de tecelagem nao encontrada');
  END IF;

  IF COALESCE(v_op.tipo, '') <> 'tecelagem' THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'op_tipo_invalido',
      'erro', 'Somente OP de tecelagem registra saida medida de Manta', 'tipo', v_op.tipo);
  END IF;

  -- Route: non-empty and homogeneously Manta, derived strictly from
  -- modelos.tipo_produto. Never a model name. Read post-OP-lock.
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

  -- (4)(5) Deterministic payload normalization plus a POST-LOCK re-read of every
  -- requested op_item, proving its exact current op_id, modelo_id,
  -- pedido_item_id and Manta route. Duplicate entries are aggregated per
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

    SELECT oi.id, oi.op_id, oi.modelo_id, oi.pedido_item_id, m.tipo_produto
      INTO v_op_item
      FROM public.op_itens oi
      LEFT JOIN public.modelos m ON m.id = oi.modelo_id
     WHERE oi.id = v_req.op_item_id;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('ok', false, 'codigo', 'item_fora_da_op',
        'erro', 'Item nao pertence a OP de tecelagem informada', 'op_item_id', v_req.op_item_id);
    END IF;
    IF v_op_item.op_id IS DISTINCT FROM p_op_id THEN
      RETURN jsonb_build_object('ok', false, 'codigo', 'item_fora_da_op',
        'erro', 'Item nao pertence a OP de tecelagem informada', 'op_item_id', v_req.op_item_id);
    END IF;
    IF v_op_item.modelo_id IS NULL OR v_op_item.tipo_produto IS DISTINCT FROM 'manta' THEN
      RETURN jsonb_build_object('ok', false, 'codigo', 'item_nao_manta',
        'erro', 'Item da OP nao resolve para um modelo Manta', 'op_item_id', v_req.op_item_id);
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

  -- (6) Lock order step 6: header then items. destino_fornecedor_id is NULL by
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
    );
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

COMMENT ON FUNCTION public.registrar_entrega_cima_manta(BIGINT, BIGINT, DATE, JSONB, TEXT) IS
  'db/88: como db/85 (unico escritor da saida medida de tecelagem de rota MANTA; admin-only, SECURITY DEFINER, search_path=public; cabecalho etapa=cima com destino_fornecedor_id NULL, itens com modelo_id copiado do op_item, evento manta_saida_registrada, tudo atomico; nunca chama gerar_op_latex/_split) e adicionalmente (db/88 BLOCKER C) normaliza o payload sem mutacao, trava cada op_item requisitado com FOR KEY SHARE em ordem crescente ANTES da OP fonte, e reprova pos-lock o op_id, o modelo_id, o pedido_item_id e a rota Manta exatos de cada op_item requisitado. Assinatura, grants, autorizacao, formato de retorno e semantica de evento preservados.';

REVOKE EXECUTE ON FUNCTION public.registrar_entrega_cima_manta(BIGINT, BIGINT, DATE, JSONB, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.registrar_entrega_cima_manta(BIGINT, BIGINT, DATE, JSONB, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.registrar_entrega_cima_manta(BIGINT, BIGINT, DATE, JSONB, TEXT) TO authenticated;

-- ============================================================
-- 5. BLOCKER C — Manta release RPC: advisory lock, then op_items FOR KEY SHARE
--    ascending, then the source OP, then the existing lineage/output/expedition
--    locks, with a post-OP-lock membership and identity re-read.
--    Balance formula, op_item_id-exact measurement, idempotency behavior,
--    return shape, event, grants and the Tapete writers are unchanged.
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

    -- Lock order step 1: taken BEFORE any table row lock.
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

  -- Lock order step 2 (db/88 BLOCKER C): every DISTINCT requested op_item
  -- FOR KEY SHARE, ascending id, BEFORE the source OP.
  FOR v_lock_id IN
    SELECT DISTINCT x.op_item_id
      FROM jsonb_to_recordset(p_itens) AS x(op_item_id BIGINT, metros NUMERIC)
     WHERE x.op_item_id IS NOT NULL
     ORDER BY 1
  LOOP
    PERFORM 1 FROM public.op_itens WHERE id = v_lock_id FOR KEY SHARE;
  END LOOP;

  -- Lock order step 3: source OP FOR UPDATE, before any balance/identity read.
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

  -- Lock order step 4: source lineage under db/84-compatible locks. Pedido,
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

  -- Lock order step 6: the measured-output rows that compose `recebido`,
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

  -- Lock order step 7: the (at most one) expedition sourced by this OP.
  SELECT ex.id INTO v_expedicao_id
    FROM public.expedicoes ex WHERE ex.op_tecelagem_id = p_op_tecelagem_id FOR UPDATE;

  -- Lock order step 8: its items, ascending id.
  IF v_expedicao_id IS NOT NULL THEN
    FOR v_lock_id IN
      SELECT xi.id FROM public.expedicao_itens xi WHERE xi.expedicao_id = v_expedicao_id ORDER BY xi.id
    LOOP
      PERFORM 1 FROM public.expedicao_itens WHERE id = v_lock_id FOR UPDATE;
    END LOOP;
  END IF;

  -- Plan every requested item against post-lock committed membership, identity
  -- and balances. Duplicate entries are aggregated per op_item_id; nothing is
  -- written in this pass.
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
      oi.id AS op_item_id, oi.op_id, oi.pedido_item_id, oi.modelo_id, m.tipo_produto,
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
    LEFT JOIN public.modelos m ON m.id = oi.modelo_id
   WHERE oi.id = v_req.op_item_id;

    IF NOT FOUND OR v_item.op_id IS DISTINCT FROM p_op_tecelagem_id THEN
      RETURN jsonb_build_object('ok', false, 'codigo', 'item_fora_da_op',
        'erro', 'Item nao pertence a OP de tecelagem informada', 'op_item_id', v_req.op_item_id);
    END IF;
    IF v_item.modelo_id IS NULL OR v_item.tipo_produto IS DISTINCT FROM 'manta' THEN
      RETURN jsonb_build_object('ok', false, 'codigo', 'item_nao_manta',
        'erro', 'Item da OP nao resolve para um modelo Manta', 'op_item_id', v_req.op_item_id);
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
  -- returns a stable identifier BEFORE any write.
  RETURN jsonb_build_object('ok', false, 'codigo', 'erro_inesperado', 'erro', SQLERRM);
END;
$$;

COMMENT ON FUNCTION public.liberar_expedicao_manta_parcial(BIGINT, JSONB, TEXT, TEXT) IS
  'db/88: como db/86 (escritor autoritativo de liberacao parcial/aditiva de expedicao Manta; disponivel = ROUND(GREATEST(recebido-liberado,0),2) com recebido medido sem defeito por juncao op_item_id-EXATA; planejado nunca e autoridade; upsert aditivo copiando modelo_id/pedido_item_id do op_item; evento expedicao_manta_liberada; replay byte a byte e idempotencia_conflitante) e adicionalmente (BLOCKER C) trava cada op_item requisitado com FOR KEY SHARE em ordem crescente ANTES da OP fonte, e reprova pos-lock a pertinencia (op_id) e a rota Manta de cada op_item. Ordem: advisory -> op_itens (id asc, FOR KEY SHARE) -> ops FOR UPDATE -> lote/pedido FOR SHARE -> entrega_itens (id asc) -> expedicoes -> expedicao_itens (id asc). Formula de saldo, idempotencia, formato de retorno, evento e grants preservados; escritores Tapete inalterados.';

REVOKE EXECUTE ON FUNCTION public.liberar_expedicao_manta_parcial(BIGINT, JSONB, TEXT, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.liberar_expedicao_manta_parcial(BIGINT, JSONB, TEXT, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.liberar_expedicao_manta_parcial(BIGINT, JSONB, TEXT, TEXT) TO authenticated;

-- ============================================================
-- 6. Reload PostgREST
-- ============================================================
NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';

COMMIT;
