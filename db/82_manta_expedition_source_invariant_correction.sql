-- =====================================================================
-- db/82_manta_expedition_source_invariant_correction.sql
-- PHASE-MANTA-B1 — forward correction of db/81 expedition-source invariants.
--
-- Corrects three defects in db/81 WITHOUT editing the published, byte-stable
-- db/78..db/81 (forward-only migration policy; PEDIDO_OP_SCHEMA_CONTRACT.md
-- §12). The migration terminal guard advances 81 -> 82 in the same commit
-- (tests/ordem-compra-c3d-deploy.smoke.js). Governing contract:
-- docs/architecture/MANTA_DIRECT_ROUTE_PHASE_CONTRACT.md.
--
--   A. SOURCE IDENTITY IMMUTABILITY (lock-inversion removal).
--      db/81's expedicoes_source_validation_guard permitted a source-changing
--      UPDATE (rejecting only an orphaning one, and only outside the
--      retificacao escape). A source-changing UPDATE has PostgreSQL take the
--      expedicoes target-row lock BEFORE the BEFORE-UPDATE trigger, which then
--      acquired source-OP row locks — an expedicoes-row -> ops-row inversion of
--      the canonical ops -> ... -> expedicoes order. This correction makes the
--      selected source IMMUTABLE after INSERT: any UPDATE that changes
--      op_latex_id or op_tecelagem_id fails closed BEFORE any source-OP lock is
--      acquired, with NO app.retificacao_autorizada bypass. A future
--      source-correction is a separately designed atomic RPC + migration, never
--      a direct UPDATE. No normal source-changing UPDATE exists after db/82, so
--      the inversion is structurally impossible. Ordinary status/timestamp/
--      delivery-progress UPDATEs are unaffected and take no lock here.
--
--   B. MEMBERSHIP VALIDATION AFTER LOCK ACQUISITION (stale-read removal).
--      db/81's expedicao_itens_membership_guard read op_itens.op_id for
--      NEW.op_item_id BEFORE waiting on the OP lock, so a concurrent op_item
--      move that committed while the guard waited was validated against the
--      STALE ownership (an item moved away from the source could be accepted).
--      This correction: resolves the expedition's selected source as a
--      preliminary candidate, locks that source OP FOR UPDATE, and only AFTER
--      the lock re-reads both the (now immutable, per A) source and the CURRENT
--      op_itens.op_id for NEW.op_item_id, validating with post-lock values only.
--      An item that moved while the guard waited is rejected against its newly
--      committed OP. Because the source is immutable (A), the guard no longer
--      locks the expedicoes row (it cannot change), removing that row lock from
--      the membership path entirely. A delivery-quantity-only UPDATE changes no
--      membership and takes no lock.
--
--   C. SOURCE OP MUST REMAIN NON-EMPTY.
--      db/81 protected an op_item directly referenced by expedicao_itens
--      (op_itens_expedicao_reference_guard + the FK ON DELETE RESTRICT) but did
--      not stop the LAST unreferenced item of a source OP from being deleted or
--      moved away, which would leave an expedition sourced through an empty OP.
--      This correction adds op_itens_source_nonempty_guard (BEFORE DELETE, and
--      BEFORE UPDATE that changes op_id): it locks the affected OP row(s) FOR
--      UPDATE ascending FIRST (serialising concurrent removals and concurrent
--      expedition creation on the same OP), then, if OLD.op_id is a selected
--      expedition source (op_latex_id OR op_tecelagem_id — uniform for Latex and
--      Manta), rejects the operation when it would leave that OP with zero
--      items (counted under the lock, excluding the row being moved/deleted).
--      No app.retificacao_autorizada bypass for emptying a source. The stronger
--      db/81 rule (a referenced op_item cannot move/delete) is retained.
--
-- EFFECTIVE LOCK ORDER for normal operations after db/82:
--   1. affected source OP rows, ascending op_id (FOR UPDATE);
--   2. immutable expedition source read (no expedicoes row lock taken by the
--      membership guard);
--   3. expedition-item write.
-- This reconciles the implicit PostgreSQL target-row lock a BEFORE UPDATE takes:
-- no source-changing expedicoes UPDATE survives (A), so no expedicoes-row ->
-- ops-row path exists; op_itens guards (db/79/db/80/db/81/db/82) all lock ops
-- rows ascending; the db/31/db/32 expedition functions still lock the owning ops
-- row first. No path acquires these in reverse.
--
-- Forward-only. Idempotent (CREATE OR REPLACE FUNCTION + DROP/CREATE TRIGGER;
-- no data or destructive DDL). Grants, SECURITY DEFINER mode and search_path
-- preserved. No business-data creation. entregas.etapa='cima',
-- entregas_destino_cima_chk, salvarEntregaCima, the Latex expedition/delivery
-- RPCs, and the db/81 source/consumed-output/reopening guards not changed here
-- are all preserved. No Manta route writer is activated.
--
-- Depende de db/81. Aplicar SOMENTE em ambiente local/descartavel ou em staging
-- autorizado. Producao proibida sem ordem explicita. NAO aplicar em shared
-- development.
-- =====================================================================

BEGIN;

-- ============================================================
-- A. Expedition source immutable after INSERT (reject before any lock).
-- ============================================================
CREATE OR REPLACE FUNCTION public.expedicoes_source_validation_guard_fn()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tipo      TEXT;
  v_item_ct   INTEGER;
  v_nonmanta  INTEGER;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    -- BLOCKER A (db/82): the selected source is immutable for the life of the
    -- expedition. Reject a source-changing UPDATE BEFORE acquiring any source-OP
    -- lock (no expedicoes-row -> ops-row inversion). No retificacao bypass; a
    -- future source correction is a dedicated atomic RPC, not a direct UPDATE.
    IF NEW.op_latex_id     IS DISTINCT FROM OLD.op_latex_id
       OR NEW.op_tecelagem_id IS DISTINCT FROM OLD.op_tecelagem_id THEN
      RAISE EXCEPTION
        'Fonte da expedicao % e imutavel apos a criacao; troca de fonte (op_latex_id/op_tecelagem_id) nao e permitida. Use um fluxo de correcao atomico dedicado.',
        OLD.id;
    END IF;
    -- Ordinary status / timestamps / delivery-progress UPDATE: unaffected, no lock.
    RETURN NEW;
  END IF;

  -- INSERT: validate and fix the selected source. Exactly-one-source is also a
  -- CHECK; validate defensively, then lock the single source OP FOR UPDATE (this
  -- serialises concurrent creations for the same Manta OP with the partial
  -- unique index) before inspecting its composition.
  IF (NEW.op_latex_id IS NOT NULL) = (NEW.op_tecelagem_id IS NOT NULL) THEN
    RAISE EXCEPTION
      'Expedicao % exige exatamente uma fonte (op_latex_id XOR op_tecelagem_id).',
      COALESCE(NEW.id::text, '(nova)');
  END IF;

  IF NEW.op_latex_id IS NOT NULL THEN
    PERFORM 1 FROM public.ops WHERE id = NEW.op_latex_id FOR UPDATE;
    SELECT o.tipo INTO v_tipo FROM public.ops o WHERE o.id = NEW.op_latex_id;
    IF v_tipo IS NULL THEN
      RAISE EXCEPTION 'Expedicao: OP latex % inexistente.', NEW.op_latex_id;
    END IF;
    IF v_tipo <> 'latex' THEN
      RAISE EXCEPTION 'Expedicao: op_latex_id % deve ser OP de acabamento (tipo=latex), nao %.', NEW.op_latex_id, v_tipo;
    END IF;
  ELSE
    PERFORM 1 FROM public.ops WHERE id = NEW.op_tecelagem_id FOR UPDATE;
    SELECT o.tipo INTO v_tipo FROM public.ops o WHERE o.id = NEW.op_tecelagem_id;
    IF v_tipo IS NULL THEN
      RAISE EXCEPTION 'Expedicao: OP tecelagem % inexistente.', NEW.op_tecelagem_id;
    END IF;
    IF v_tipo <> 'tecelagem' THEN
      RAISE EXCEPTION 'Expedicao: op_tecelagem_id % deve ser OP de tecelagem (tipo=tecelagem), nao %.', NEW.op_tecelagem_id, v_tipo;
    END IF;

    SELECT count(*),
           count(*) FILTER (WHERE m.tipo_produto IS DISTINCT FROM 'manta')
      INTO v_item_ct, v_nonmanta
      FROM public.op_itens oi
      JOIN public.modelos m ON m.id = oi.modelo_id
     WHERE oi.op_id = NEW.op_tecelagem_id;

    IF v_item_ct = 0 THEN
      RAISE EXCEPTION 'Expedicao: OP tecelagem % nao possui itens; fonte Manta invalida.', NEW.op_tecelagem_id;
    END IF;
    IF v_nonmanta > 0 THEN
      RAISE EXCEPTION 'Expedicao: OP tecelagem % nao e homogenea de Manta (% item(ns) nao-Manta); fonte de expedicao Manta rejeitada.', NEW.op_tecelagem_id, v_nonmanta;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.expedicoes_source_validation_guard_fn() IS
  'db/82: como db/81 na validacao de INSERT (op_latex_id=latex XOR op_tecelagem_id=tecelagem homogenea de Manta nao vazia; trava a OP fonte FOR UPDATE) e adicionalmente torna a fonte IMUTAVEL: qualquer UPDATE que altere op_latex_id/op_tecelagem_id e rejeitado ANTES de travar qualquer OP (sem inversao expedicoes->ops), sem bypass por app.retificacao_autorizada. UPDATE de status/timestamps nao trava nada.';

-- ============================================================
-- B. Membership validated with POST-LOCK ownership (no stale read).
-- ============================================================
CREATE OR REPLACE FUNCTION public.expedicao_itens_membership_guard_fn()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_latex     BIGINT;
  v_tecelagem BIGINT;
  v_src_op    BIGINT;
  v_src_op2   BIGINT;
  v_item_op   BIGINT;
BEGIN
  -- Delivery-only UPDATE (registrar_entrega_expedicao): no membership change,
  -- no lock, no re-validation.
  IF TG_OP = 'UPDATE'
     AND NEW.op_item_id   IS NOT DISTINCT FROM OLD.op_item_id
     AND NEW.expedicao_id IS NOT DISTINCT FROM OLD.expedicao_id THEN
    RETURN NEW;
  END IF;

  -- (1) Preliminary candidate: which OP is the expedition's selected source.
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

  -- (2) Lock the selected source OP FOR UPDATE (single OP => trivially
  -- ascending). The source is immutable (db/82 A), so no expedicoes row lock is
  -- needed to protect it. A concurrent op_item move involving this source blocks
  -- through the db/79/db/80/db/81/db/82 op_itens guards (which lock this OP).
  PERFORM 1 FROM public.ops WHERE id = v_src_op FOR UPDATE;

  -- (3) Post-lock re-reads: the (immutable) source and the CURRENT op_item owner.
  SELECT ex.op_latex_id, ex.op_tecelagem_id
    INTO v_latex, v_tecelagem
    FROM public.expedicoes ex WHERE ex.id = NEW.expedicao_id;
  v_src_op2 := COALESCE(v_latex, v_tecelagem);
  IF v_src_op2 IS DISTINCT FROM v_src_op THEN
    -- Cannot happen while the source is immutable; deterministic fail-closed.
    RAISE EXCEPTION 'Item de expedicao: fonte da expedicao % mudou durante a validacao.', NEW.expedicao_id;
  END IF;

  SELECT oi.op_id INTO v_item_op FROM public.op_itens oi WHERE oi.id = NEW.op_item_id;
  IF v_item_op IS NULL THEN
    RAISE EXCEPTION 'Item de expedicao: op_item_id % inexistente.', NEW.op_item_id;
  END IF;

  -- (4)(5) Validate using ONLY post-lock values; a move that committed while the
  -- guard waited is rejected against the op_item's newly committed OP.
  IF v_item_op <> v_src_op2 THEN
    RAISE EXCEPTION
      'Item de expedicao: op_item % (OP %) nao pertence a OP fonte % da expedicao % (injecao cross-OP rejeitada).',
      NEW.op_item_id, v_item_op, v_src_op2, NEW.expedicao_id;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.expedicao_itens_membership_guard_fn() IS
  'db/82: como db/81 (op_item deve pertencer a OP fonte selecionada; injecao cross-OP rejeitada) mas valida a posse do op_item APOS travar a OP fonte: resolve a fonte como candidato, trava public.ops(fonte) FOR UPDATE, e so entao re-le fonte (imutavel, db/82 A) e op_itens.op_id atual, validando somente com valores pos-lock. Nao trava a linha expedicoes. UPDATE apenas de metros_entregues nao dispara validacao.';

-- ============================================================
-- C. A selected expedition-source OP must retain at least one item.
-- ============================================================
CREATE OR REPLACE FUNCTION public.op_itens_source_nonempty_guard_fn()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lock_id   BIGINT;
  v_remaining INTEGER;
BEGIN
  -- Only a DELETE, or an UPDATE that changes op_id, can reduce OLD.op_id's items.
  IF TG_OP = 'UPDATE' AND NEW.op_id IS NOT DISTINCT FROM OLD.op_id THEN
    RETURN NEW;
  END IF;

  -- (1) Lock the affected OP row(s) FOR UPDATE, ascending op_id, BEFORE evaluating
  -- source status and item count. Serialises concurrent removals from the same
  -- source OP and concurrent expedition creation on that OP (the source-validation
  -- INSERT guard also locks the source OP), so the check below is race-free.
  FOR v_lock_id IN
    SELECT DISTINCT oid
      FROM unnest(ARRAY[OLD.op_id,
             CASE WHEN TG_OP = 'UPDATE' THEN NEW.op_id END]) AS t(oid)
     WHERE oid IS NOT NULL
     ORDER BY oid
  LOOP
    PERFORM 1 FROM public.ops WHERE id = v_lock_id FOR UPDATE;
  END LOOP;

  -- (2) Enforce non-emptiness only when OLD.op_id is a selected expedition source
  -- (Latex or Manta — uniform). No retificacao bypass for emptying a source.
  IF EXISTS (
    SELECT 1 FROM public.expedicoes ex
     WHERE ex.op_latex_id = OLD.op_id OR ex.op_tecelagem_id = OLD.op_id
  ) THEN
    SELECT count(*) INTO v_remaining
      FROM public.op_itens oi
     WHERE oi.op_id = OLD.op_id
       AND oi.id <> OLD.id;

    IF v_remaining = 0 THEN
      RAISE EXCEPTION
        'OP % e fonte de expedicao e nao pode ficar sem itens: remocao/movimentacao do ultimo item bloqueada.',
        OLD.op_id;
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS op_itens_source_nonempty_guard ON public.op_itens;
CREATE TRIGGER op_itens_source_nonempty_guard
  BEFORE DELETE OR UPDATE ON public.op_itens
  FOR EACH ROW EXECUTE FUNCTION public.op_itens_source_nonempty_guard_fn();

COMMENT ON FUNCTION public.op_itens_source_nonempty_guard_fn() IS
  'db/82: uma OP selecionada como fonte de expedicao (op_latex_id ou op_tecelagem_id) nao pode ficar sem itens. BEFORE DELETE / UPDATE(op_id): trava a(s) OP afetada(s) FOR UPDATE em ordem crescente, depois (se OLD.op_id e fonte) conta itens restantes excluindo a linha e rejeita se zero. Sem bypass por app.retificacao_autorizada. A regra mais forte de db/81 (op_item referenciado por expedicao nao pode mover/excluir) permanece.';

-- ============================================================
-- Reload PostgREST
-- ============================================================
NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';

COMMIT;
