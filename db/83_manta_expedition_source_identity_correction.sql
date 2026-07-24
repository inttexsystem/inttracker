-- =====================================================================
-- db/83_manta_expedition_source_identity_correction.sql
-- PHASE-MANTA-B1 — forward correction: source route + item identity.
--
-- Completes the dormant B1 database foundation by making the selected
-- source OP's route identity and each expedition item's redundant identity
-- authoritative and stable. Forward-only correction; does NOT edit
-- db/78..db/82 (forward-only migration policy; PEDIDO_OP_SCHEMA_CONTRACT.md
-- §12). The migration terminal guard advances 82 -> 83 in the same commit
-- (tests/ordem-compra-c3d-deploy.smoke.js). Governing contract:
-- docs/architecture/MANTA_DIRECT_ROUTE_PHASE_CONTRACT.md.
--
-- Final invariants after this migration:
--   1. a selected Manta weaving source remains a Manta weaving source;
--   2. a selected Latex source remains a Latex/Tapete finishing source;
--   3. an expedition item identifies exactly the same model and Pedido item
--      as its referenced op_item;
--   4. an op_item already referenced by an expedition cannot silently change
--      that identity.
--
--   A. SOURCE OP TYPE IMMUTABILITY.
--      New BEFORE UPDATE guard on public.ops: while an OP is referenced by
--      expedicoes.op_latex_id or expedicoes.op_tecelagem_id (either column,
--      any expedition), changing ops.tipo is rejected. Same-value updates
--      remain permitted; ops.status transitions are untouched (preserves
--      db/21 alterar_status_op and the db/81 ops_manta_reopen_guard). No
--      app.retificacao_autorizada bypass: a source-type conversion is a
--      separate atomic design, not a direct UPDATE. Because
--      expedicoes_source_validation_guard_fn already requires op_latex_id to
--      reference tipo='latex' and op_tecelagem_id to reference
--      tipo='tecelagem' at INSERT (db/81) and the source itself is immutable
--      post-INSERT (db/82 A), this single any-column check is sufficient:
--      ops.tipo only ever takes two values (db/08 ops_tipo_chk), so a
--      referenced OP can never need to change type in place.
--
--   B. SOURCE PRODUCT ROUTE IMMUTABILITY.
--      Forward-corrects op_itens_route_homogeneity_guard_fn (db/78/79/80).
--      db/79/80 only reject MIXING two product types within one OP — a
--      single-item OP has no "other" item to compare against, so changing
--      that sole item's model to the opposite product type was NOT caught
--      when the OP is already a selected expedition source (mandatory tests
--      6 and 8). This correction adds, immediately after the existing
--      ops-ascending/modelos-ascending locks and the incoming item's
--      tipo_produto read: if the destination op_id (NEW.op_id) is currently
--      selected as an expedicoes.op_tecelagem_id source, every item must
--      resolve to tipo_produto='manta' (a Tapete item is rejected, inserted
--      or via UPDATE); if selected as an expedicoes.op_latex_id source,
--      every item must resolve to tipo_produto='tapete' (a Manta item is
--      rejected). Product type is still derived only through
--      modelos.tipo_produto, never a name. The existing db/79/80 mixing
--      check is preserved unchanged and still fires for a non-selected OP.
--      This read is race-free: the ops row for NEW.op_id is already locked
--      FOR UPDATE by this same guard (db/79 step 1) before the read, and the
--      only way an OP becomes NEWLY selected as a source is
--      expedicoes_source_validation_guard_fn's INSERT path, which itself
--      locks that same ops row FOR UPDATE before validating — so a
--      concurrent source selection and a concurrent item write always
--      serialize on the ops row, never race.
--
--   C. EXPEDITION ITEM IDENTITY ALIGNMENT.
--      Forward-corrects expedicao_itens_membership_guard_fn (db/81/82). The
--      db/82 early-return only inspected op_item_id/expedicao_id, so a
--      delivery-path-shaped UPDATE that also changed modelo_id or
--      pedido_item_id would skip validation entirely. This correction widens
--      the early-return to require op_item_id, expedicao_id, modelo_id AND
--      pedido_item_id all unchanged before skipping (a genuine
--      quantity/timestamp-only UPDATE is still untouched). When validation
--      runs (INSERT, or an UPDATE changing any of the four), after the
--      db/82 post-lock OP-membership re-read, the guard now also re-reads
--      the current op_item's modelo_id and pedido_item_id and requires
--      NEW.modelo_id = op_itens.modelo_id and NEW.pedido_item_id IS NOT
--      DISTINCT FROM op_itens.pedido_item_id (exact mirror, including
--      NULL=NULL). Repository evidence
--      (db/23 liberar_expedicao, db/31 liberar_expedicao_latex_parcial,
--      db/32 registrar_movimentacao_direta_expedicao) shows every existing
--      writer already sources both fields directly from the op_item's own
--      row (oi.modelo_id, oi.pedido_item_id) with no divergent case, so
--      strict equality is the proven canonical compatibility rule -- no
--      legacy NULL-when-non-NULL exception exists or is created. The guard
--      rejects inconsistent input; it does not rewrite the payload.
--
--   D. REFERENCED OP ITEM IDENTITY IMMUTABILITY.
--      Forward-corrects op_itens_expedicao_reference_guard_fn (db/81), which
--      only protected op_id. This correction widens the protected fields to
--      op_id, modelo_id and pedido_item_id: while an op_item is referenced
--      by any expedicao_itens row, normal writes reject a change to any of
--      the three (same-value updates remain permitted; any other column,
--      e.g. metros_pedidos/metros_ajustados, is untouched). Protects both
--      Latex- and Manta-sourced expeditions uniformly. No
--      app.retificacao_autorizada bypass for these identity fields in B1 (a
--      future correction must update the complete expedition/source graph
--      atomically). The existing controlled-delete cascade (db/37
--      remover_op/remover_pedido) is unaffected: it DELETEs the owning
--      expedicao_itens rows before the op_itens row is ever touched, and
--      op_itens itself is only ever removed by the ops ON DELETE CASCADE
--      (db/01), never a direct UPDATE of a still-referenced row -- so this
--      guard's EXISTS check is already false by the time (if ever) that path
--      would reach it.
--
-- RECONCILED LOCK ORDER (global, no path takes these in reverse; composes
-- with db/79/db/80/db/81/db/82 and the db/31/db/32 expedition/delivery
-- functions):
--   1. affected public.ops rows, ascending op_id           (FOR UPDATE);
--   2. affected public.modelos rows, ascending modelo_id   (FOR SHARE, db/80);
--   3. inspect selected expedition-source references (public.expedicoes;
--      unlocked -- race-free per B above, and per db/82 the source itself
--      never changes after INSERT);
--   4. validate source route (B) and expedition-item identity (C/D);
--   5. continue the row write.
-- Trigger firing order on public.op_itens (BEFORE, alphabetical by name,
-- unchanged by this migration): op_itens_expedicao_reference_guard (D) then
-- op_itens_route_homogeneity_guard (B) then op_itens_source_nonempty_guard
-- (db/82 C) -- D rejects an identity change on a referenced item before B's
-- route check ever runs for that row. public.ops_manta_reopen_guard (db/81)
-- then public.ops_source_type_immutability_guard (A) fire in that order on
-- public.ops (alphabetical; independent columns, no interaction). Blocker A
-- takes no lock beyond the implicit target-row lock UPDATE already holds on
-- the ops row being changed; Blocker D takes the same ops-ascending lock as
-- db/79/80/82 (collapsing to the single unchanged op_id when only
-- modelo_id/pedido_item_id changes) so a concurrent Blocker-C membership
-- insert and a concurrent Blocker-A/D identity write always serialize on
-- that single ops row -- no second resource is ever acquired by either side,
-- so no cross-guard deadlock is possible.
--
-- Forward-only. Idempotent (CREATE OR REPLACE FUNCTION + DROP/CREATE
-- TRIGGER only; no data or destructive DDL). Grants, SECURITY DEFINER mode
-- and search_path preserved. No business-data creation. entregas.etapa=
-- 'cima', entregas_destino_cima_chk, salvarEntregaCima, the Latex
-- expedition/delivery RPCs, and every db/81/db/82 guard not named above are
-- unchanged. No Manta route writer is activated. No product UI change.
--
-- Depende de db/82. Aplicar SOMENTE em ambiente local/descartavel ou em
-- staging autorizado. Producao proibida sem ordem explicita. NAO aplicar em
-- shared development.
-- =====================================================================

BEGIN;

-- ============================================================
-- A. Source OP type immutability while referenced by an expedition.
-- ============================================================
CREATE OR REPLACE FUNCTION public.ops_source_type_immutability_guard_fn()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.tipo IS NOT DISTINCT FROM OLD.tipo THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.expedicoes
     WHERE op_latex_id = OLD.id OR op_tecelagem_id = OLD.id
  ) THEN
    RAISE EXCEPTION
      'OP %: tipo e imutavel enquanto referenciada como fonte de expedicao (op_latex_id/op_tecelagem_id); alteracao % -> % rejeitada. Sem bypass por app.retificacao_autorizada; conversao de rota exige um desenho atomico separado.',
      OLD.id, OLD.tipo, NEW.tipo;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ops_source_type_immutability_guard ON public.ops;
CREATE TRIGGER ops_source_type_immutability_guard
  BEFORE UPDATE ON public.ops
  FOR EACH ROW EXECUTE FUNCTION public.ops_source_type_immutability_guard_fn();

COMMENT ON FUNCTION public.ops_source_type_immutability_guard_fn() IS
  'db/83 BLOCKER A: enquanto a OP e referenciada por expedicoes.op_latex_id ou op_tecelagem_id, rejeita alteracao de ops.tipo (atualizacao de mesmo valor permanece permitida). Sem bypass por app.retificacao_autorizada; nao altera o comportamento de status (db/21/db/81 preservados).';

-- ============================================================
-- B. Source product route immutability (single-item and multi-item).
-- ============================================================
CREATE OR REPLACE FUNCTION public.op_itens_route_homogeneity_guard_fn()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_tipo  TEXT;
  v_other     TEXT;
  v_lock_id   BIGINT;
  v_src_latex BOOLEAN;
  v_src_tec   BOOLEAN;
BEGIN
  -- Lock order step 1: affected OP rows, ascending op_id (db/79).
  FOR v_lock_id IN
    SELECT DISTINCT oid
      FROM unnest(
             CASE WHEN TG_OP = 'UPDATE' THEN ARRAY[NEW.op_id, OLD.op_id]
                  ELSE ARRAY[NEW.op_id] END
           ) AS t(oid)
     WHERE oid IS NOT NULL
     ORDER BY oid
  LOOP
    PERFORM 1 FROM public.ops WHERE id = v_lock_id FOR UPDATE;
  END LOOP;

  -- Lock order step 2: affected model rows, ascending modelo_id, FOR SHARE
  -- (db/80).
  FOR v_lock_id IN
    SELECT DISTINCT mid
      FROM unnest(
             CASE WHEN TG_OP = 'UPDATE' THEN ARRAY[NEW.modelo_id, OLD.modelo_id]
                  ELSE ARRAY[NEW.modelo_id] END
           ) AS t(mid)
     WHERE mid IS NOT NULL
     ORDER BY mid
  LOOP
    PERFORM 1 FROM public.modelos WHERE id = v_lock_id FOR SHARE;
  END LOOP;

  -- Incoming item's product type, now under the held FOR SHARE lock.
  SELECT m.tipo_produto INTO v_new_tipo FROM public.modelos m WHERE m.id = NEW.modelo_id;
  IF v_new_tipo IS NULL THEN
    RAISE EXCEPTION 'Modelo % sem tipo_produto ao inserir/atualizar item de OP.', NEW.modelo_id;
  END IF;

  -- Lock order step 3: inspect whether the destination OP is a selected
  -- expedition source. Unlocked read is race-free: the ops row for
  -- NEW.op_id is already held FOR UPDATE above, and only
  -- expedicoes_source_validation_guard_fn's INSERT path can newly select an
  -- OP as a source, which itself locks that same ops row FOR UPDATE first
  -- (db/81/82); the source itself never changes after INSERT (db/82 A).
  SELECT EXISTS (SELECT 1 FROM public.expedicoes WHERE op_latex_id = NEW.op_id),
         EXISTS (SELECT 1 FROM public.expedicoes WHERE op_tecelagem_id = NEW.op_id)
    INTO v_src_latex, v_src_tec;

  -- Lock order step 4a (db/83 BLOCKER B): source product route. Derived
  -- strictly from modelos.tipo_produto, never a name. Catches the
  -- single-item case the mixing check below cannot (no "other" item to
  -- compare against).
  IF v_src_latex AND v_new_tipo <> 'tapete' THEN
    RAISE EXCEPTION
      'OP % e fonte de expedicao Latex/Tapete (op_latex_id): todo item deve ser Tapete (modelo % e %).',
      NEW.op_id, NEW.modelo_id, v_new_tipo;
  END IF;
  IF v_src_tec AND v_new_tipo <> 'manta' THEN
    RAISE EXCEPTION
      'OP % e fonte de expedicao Manta (op_tecelagem_id): todo item deve ser Manta (modelo % e %).',
      NEW.op_id, NEW.modelo_id, v_new_tipo;
  END IF;

  -- Lock order step 4b (db/78-80): reject if the destination OP already
  -- holds any item of a different type.
  SELECT m.tipo_produto INTO v_other
    FROM public.op_itens oi
    JOIN public.modelos m ON m.id = oi.modelo_id
   WHERE oi.op_id = NEW.op_id
     AND oi.id IS DISTINCT FROM NEW.id
     AND m.tipo_produto <> v_new_tipo
   LIMIT 1;

  IF v_other IS NOT NULL THEN
    RAISE EXCEPTION
      'OP % nao pode misturar produtos (% x %): a rota da OP deve ser homogenea (apenas Tapete ou apenas Manta).',
      NEW.op_id, v_new_tipo, v_other;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS op_itens_route_homogeneity_guard ON public.op_itens;
CREATE TRIGGER op_itens_route_homogeneity_guard
  BEFORE INSERT OR UPDATE ON public.op_itens
  FOR EACH ROW EXECUTE FUNCTION public.op_itens_route_homogeneity_guard_fn();

COMMENT ON FUNCTION public.op_itens_route_homogeneity_guard_fn() IS
  'db/83: como db/79/db/80 (rota homogenea por OP; trava ops asc FOR UPDATE depois modelos asc FOR SHARE) e adicionalmente (BLOCKER B) exige que todo item de uma OP selecionada como fonte de expedicao resolva ao tipo_produto exigido pela fonte (op_latex_id=tapete, op_tecelagem_id=manta), inclusive quando a OP tem um unico item (caso que a checagem de mistura sozinha nao cobre). Leitura de expedicoes sem lock e livre de corrida: a linha ops de NEW.op_id ja esta travada FOR UPDATE, e selecionar uma nova fonte exige o mesmo lock primeiro.';

-- ============================================================
-- C. Expedition item identity alignment (model + Pedido origin).
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
  -- fields changed, no lock, no re-validation. db/83 BLOCKER C widens this
  -- from db/82's op_item_id/expedicao_id-only check to include
  -- modelo_id/pedido_item_id, so a delivery-path-shaped UPDATE can no
  -- longer silently carry an identity change past this guard.
  IF TG_OP = 'UPDATE'
     AND NEW.op_item_id     IS NOT DISTINCT FROM OLD.op_item_id
     AND NEW.expedicao_id   IS NOT DISTINCT FROM OLD.expedicao_id
     AND NEW.modelo_id      IS NOT DISTINCT FROM OLD.modelo_id
     AND NEW.pedido_item_id IS NOT DISTINCT FROM OLD.pedido_item_id THEN
    RETURN NEW;
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

  -- (2) Lock the selected source OP FOR UPDATE (db/82). The source is
  -- immutable (db/82 A), so no expedicoes row lock is needed.
  PERFORM 1 FROM public.ops WHERE id = v_src_op FOR UPDATE;

  -- (3) Post-lock re-reads: the (immutable) source and the CURRENT op_item
  -- identity (db/82 source; db/83 BLOCKER C widens the re-read to
  -- modelo_id/pedido_item_id).
  SELECT ex.op_latex_id, ex.op_tecelagem_id
    INTO v_latex, v_tecelagem
    FROM public.expedicoes ex WHERE ex.id = NEW.expedicao_id;
  v_src_op2 := COALESCE(v_latex, v_tecelagem);
  IF v_src_op2 IS DISTINCT FROM v_src_op THEN
    -- Cannot happen while the source is immutable; deterministic fail-closed.
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

  -- (5) db/83 BLOCKER C: model identity must mirror the op_item's own model
  -- exactly. No silent rewrite; inconsistent input is rejected.
  IF NEW.modelo_id IS DISTINCT FROM v_item_modelo THEN
    RAISE EXCEPTION
      'Item de expedicao: modelo_id % nao corresponde ao modelo % do op_item % (identidade divergente rejeitada).',
      NEW.modelo_id, v_item_modelo, NEW.op_item_id;
  END IF;

  -- (6) db/83 BLOCKER C: Pedido origin must mirror the op_item's own
  -- pedido_item_id exactly, including NULL=NULL (proven canonical
  -- compatibility rule; see migration header).
  IF NEW.pedido_item_id IS DISTINCT FROM v_item_pedido THEN
    RAISE EXCEPTION
      'Item de expedicao: pedido_item_id % nao corresponde a origem % do op_item % (identidade divergente rejeitada).',
      NEW.pedido_item_id, v_item_pedido, NEW.op_item_id;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.expedicao_itens_membership_guard_fn() IS
  'db/83: como db/82 (op_item deve pertencer a OP fonte selecionada, validado pos-lock) e adicionalmente (BLOCKER C) exige NEW.modelo_id = op_itens.modelo_id e NEW.pedido_item_id IS NOT DISTINCT FROM op_itens.pedido_item_id do op_item referenciado (identidade redundante alinhada, sem reescrita silenciosa). O early-return de UPDATE somente-entrega agora exige as quatro colunas de identidade inalteradas (op_item_id, expedicao_id, modelo_id, pedido_item_id).';

-- ============================================================
-- D. Referenced op_item identity immutability (op_id + modelo_id +
--    pedido_item_id).
-- ============================================================
CREATE OR REPLACE FUNCTION public.op_itens_expedicao_reference_guard_fn()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lock_id BIGINT;
BEGIN
  -- db/83 BLOCKER D: only a change to a protected identity field (op_id,
  -- modelo_id, pedido_item_id) is relevant; same-value updates and any other
  -- column (metros_pedidos, metros_ajustados, etc.) are untouched.
  IF NEW.op_id          IS NOT DISTINCT FROM OLD.op_id
     AND NEW.modelo_id      IS NOT DISTINCT FROM OLD.modelo_id
     AND NEW.pedido_item_id IS NOT DISTINCT FROM OLD.pedido_item_id THEN
    RETURN NEW;
  END IF;

  -- Lock order step 1: both OPs, ascending, FOR UPDATE (collapses to the
  -- single unchanged op_id when only modelo_id/pedido_item_id changes;
  -- composes with the db/79/db/80/db/83-B homogeneity guard which locks the
  -- same rows ascending, and with a concurrent db/83-C membership insert
  -- which locks the same source-OP row -- single-resource serialization,
  -- no second lock on either side, so no deadlock is possible).
  FOR v_lock_id IN
    SELECT DISTINCT oid FROM unnest(ARRAY[NEW.op_id, OLD.op_id]) AS t(oid)
     WHERE oid IS NOT NULL ORDER BY oid
  LOOP
    PERFORM 1 FROM public.ops WHERE id = v_lock_id FOR UPDATE;
  END LOOP;

  -- db/83 BLOCKER D: no app.retificacao_autorizada bypass for these identity
  -- fields. A referenced op_item's OP/model/Pedido-origin identity is
  -- authoritative for every linked expedicao_itens row; a future correction
  -- must update the complete expedition/source graph atomically instead of a
  -- direct write. The db/37 controlled-delete cascade is unaffected: it
  -- DELETEs the owning expedicao_itens rows before op_itens is ever
  -- touched, and op_itens is only ever removed via the ops ON DELETE
  -- CASCADE (db/01), never a direct UPDATE of a still-referenced row.
  IF EXISTS (SELECT 1 FROM public.expedicao_itens xi WHERE xi.op_item_id = OLD.id) THEN
    RAISE EXCEPTION
      'op_item %: referenciado por expedicao_itens; op_id/modelo_id/pedido_item_id sao imutaveis (identidade da expedicao). Sem bypass por app.retificacao_autorizada; use um fluxo de correcao atomico dedicado.',
      OLD.id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS op_itens_expedicao_reference_guard ON public.op_itens;
CREATE TRIGGER op_itens_expedicao_reference_guard
  BEFORE UPDATE ON public.op_itens
  FOR EACH ROW EXECUTE FUNCTION public.op_itens_expedicao_reference_guard_fn();

COMMENT ON FUNCTION public.op_itens_expedicao_reference_guard_fn() IS
  'db/83: como db/81 (rejeita mover um op_item referenciado por expedicao_itens) e adicionalmente (BLOCKER D) protege modelo_id e pedido_item_id, nao somente op_id; SEM bypass por app.retificacao_autorizada para estes tres campos (removido nesta correcao). Trava as OPs afetadas (FOR UPDATE, op_id asc). Exclusao ja e barrada por FK ON DELETE RESTRICT; o cascade de exclusao controlada (db/37) remove expedicao_itens antes de tocar op_itens.';

-- ============================================================
-- Reload PostgREST
-- ============================================================
NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';

COMMIT;
