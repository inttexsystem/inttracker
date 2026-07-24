-- =====================================================================
-- db/84_manta_expedition_source_lineage_correction.sql
-- PHASE-MANTA-B1 — forward correction: symmetric Latex route + source lineage.
--
-- Completes PHASE-MANTA-B1 by forward-correcting db/81/db/82/db/83 without
-- editing db/78..db/83 (forward-only migration policy;
-- PEDIDO_OP_SCHEMA_CONTRACT.md §12). The migration terminal guard advances
-- 83 -> 84 in the same commit (tests/ordem-compra-c3d-deploy.smoke.js).
-- Governing contract: docs/architecture/MANTA_DIRECT_ROUTE_PHASE_CONTRACT.md.
--
--   0. PRE-EXISTING DATA GATE. Before installing the corrected guards, scan
--      every existing public.expedicoes row against the widened invariants
--      (source OP existence/type, non-emptiness, required product type,
--      source OP->Lote->Pedido->Cliente lineage existence/consistency, and
--      expedition header lineage match). Fails closed (aborts the whole
--      migration) on any violation; no repair, no reinterpretation. Trivially
--      compatible with an empty operational corpus (zero rows -> zero
--      violations) and requires a valid populated Latex expedition history to
--      already satisfy every invariant this migration makes authoritative.
--
--   A. SYMMETRIC LATEX SOURCE VALIDATION. db/81/db/82's
--      expedicoes_source_validation_guard_fn validated the Manta
--      (op_tecelagem_id) branch for non-emptiness and homogeneous
--      modelos.tipo_produto='manta', but the Latex (op_latex_id) branch only
--      checked ops.tipo='latex' -- never non-emptiness nor homogeneous
--      tipo_produto='tapete'. This correction makes both branches symmetric:
--      the Latex branch now also requires a non-empty, homogeneously-Tapete
--      source (a homogeneous-Manta or mixed Latex-typed OP is rejected),
--      derived strictly from modelos.tipo_produto, never a name.
--
--   B. AUTHORITATIVE SOURCE LINEAGE. For either source type, the lineage
--      source OP -> ops.lote_id -> lotes.pedido_id / lotes.cliente_id ->
--      pedidos.cliente_id must exist and be internally consistent
--      (lotes.cliente_id = pedidos.cliente_id), and the expedition payload
--      (lote_id, pedido_id, cliente_id) must match it exactly. NULL or
--      divergent lineage is rejected; the payload is never silently
--      rewritten. Existing canonical writers (db/23 liberar_expedicao,
--      db/31/db/32) already derive these fields from the source OP/Lote, so
--      they remain compatible unchanged.
--
--   C. EXPEDITION LINEAGE IMMUTABILITY. The db/82-immutable source columns
--      (op_latex_id/op_tecelagem_id) are joined by pedido_id/lote_id/
--      cliente_id: any UPDATE changing any of the five is rejected BEFORE any
--      lock, with no app.retificacao_autorizada bypass -- the same
--      fail-closed-before-any-lock design db/82 established for the source
--      columns. Status/timestamp/delivery-progress UPDATEs are unaffected and
--      take no lock.
--
--   D. SOURCE OP LINEAGE IMMUTABILITY. db/83's
--      ops_source_type_immutability_guard_fn (ops.tipo only) now also
--      protects ops.lote_id while the OP is a selected expedition source.
--      Same-value updates permitted; ops.status transitions untouched
--      (db/21/db/81 preserved); no retificacao bypass.
--
--   E. LOTE LINEAGE IMMUTABILITY. New lotes_source_lineage_immutability_guard
--      (BEFORE UPDATE on public.lotes): while the Lote is referenced by an OP
--      selected as an expedition source, pedido_id/cliente_id are immutable.
--      Inspects references with a plain unlocked EXISTS -- no source-OP lock
--      is requested (the OP's own lote_id is separately protected by D, and
--      the lote row itself is already the UPDATE's own target-row lock, so no
--      race exists to close by additionally locking ops). No retificacao
--      bypass. Unrelated Lotes are unaffected.
--
--   F. PEDIDO CLIENT IMMUTABILITY. New
--      pedidos_source_lineage_immutability_guard (BEFORE UPDATE on
--      public.pedidos): while the Pedido participates (via a Lote) in the
--      lineage of an OP selected as an expedition source, cliente_id is
--      immutable. Same unlocked-EXISTS design as E; no retificacao bypass;
--      unrelated Pedidos/fields are unaffected.
--
--   DELETE / FK EVIDENCE (no FK semantics changed). ops.lote_id and
--   expedicoes.lote_id are `ON DELETE SET NULL` from lotes (db/09, db/23);
--   lotes.pedido_id is `ON DELETE SET NULL` from pedidos (db/13). Postgres
--   implements ON DELETE SET NULL as a real UPDATE against the referencing
--   table, which fires that table's own BEFORE UPDATE row triggers. So:
--     * deleting a source Lote's parent is not applicable (lotes has no
--       ON-DELETE-SET-NULL parent that matters here beyond pedidos, covered
--       next); deleting a source Lote itself is still blocked wherever an OP
--       (RESTRICT-free FK, but D's guard fires on the resulting
--       ops.lote_id-nulling UPDATE) or an expedicao (C's guard fires on the
--       resulting expedicoes.lote_id-nulling UPDATE) references it as a
--       selected source -- the DELETE fails closed, lote_id is never
--       silently nulled on a live source;
--     * deleting a source Pedido triggers lotes.pedido_id SET NULL, which is
--       an UPDATE that E rejects whenever that Lote belongs to a selected
--       source OP -- the DELETE fails closed, pedido_id is never silently
--       nulled;
--     * deleting the source client remains blocked outright by the existing
--       `lotes.cliente_id` / `pedidos.cliente_id` `ON DELETE RESTRICT` FKs
--       (db/09, db/13) -- unchanged.
--   The established controlled-delete cascade (db/34-37 remover_op/
--   remover_pedido) is unaffected: it always DELETEs expedicao_itens/
--   expedicoes and the owning ops rows BEFORE it ever deletes the Lote or
--   Pedido row, so by the time those deletes run, no OP is a selected source
--   through them and none of the new guards fire. No FK delete action is
--   changed by this migration.
--
-- RECONCILED LOCK ORDER (INSERT validation path; no path takes these in
-- reverse; composes with db/79-83 and the db/31/db/32 expedition/delivery
-- functions):
--   1. source public.ops row                       (FOR UPDATE);
--   2. source public.lotes row                     (FOR SHARE -- conflicts
--      with a concurrent lineage-changing UPDATE, db/80 FOR SHARE idiom);
--   3. source public.pedidos row                   (FOR SHARE -- conflicts
--      with a concurrent cliente_id-changing UPDATE);
--   4. affected public.modelos rows, ascending modelo_id (FOR SHARE, when
--      product type is inspected);
--   5. final post-lock lineage + route reads;
--   6. insert the expedition row.
-- No path acquires an expedicoes row before an ops row; Lote/Pedido locks are
-- never acquired before the source OP; model rows are never acquired before
-- the source OP. The new Lote/Pedido UPDATE guards (E/F) request no
-- source-OP lock at all (plain unlocked EXISTS), so they introduce no reverse
-- path. Blocker D's ops UPDATE touches only its own (already-locked-by-the-
-- UPDATE-itself) row. Because every multi-resource acquisition (the INSERT
-- path) always follows the SAME fixed order, and every single-resource guard
-- (D/E/F) never chains to a second resource, no cross-guard wait cycle -- and
-- therefore no deadlock -- is structurally possible.
--
-- Forward-only. Idempotent (CREATE OR REPLACE FUNCTION + DROP/CREATE
-- TRIGGER; the data gate is a pure validation DO block, no data mutation).
-- No data or destructive DDL; no business-data creation. Grants, SECURITY
-- DEFINER mode and search_path preserved. entregas.etapa='cima',
-- entregas_destino_cima_chk, salvarEntregaCima, the Latex expedition/delivery
-- RPCs, and every db/81/db/82/db/83 guard not named above are unchanged. No
-- Manta route writer is activated. No product UI change.
--
-- Depende de db/83. Aplicar SOMENTE em ambiente local/descartavel ou em
-- staging autorizado. Producao proibida sem ordem explicita. NAO aplicar em
-- shared development.
-- =====================================================================

BEGIN;

-- ============================================================
-- 0. Pre-existing data gate.
-- ============================================================
DO $gate$
DECLARE
  v_bad_count INTEGER;
  v_bad_ids   BIGINT[];
BEGIN
  WITH src AS (
    SELECT
      ex.id                                          AS expedicao_id,
      COALESCE(ex.op_latex_id, ex.op_tecelagem_id)    AS op_id,
      (ex.op_latex_id IS NOT NULL)                    AS is_latex,
      ex.pedido_id, ex.lote_id, ex.cliente_id
    FROM public.expedicoes ex
  ),
  op_check AS (
    SELECT s.*, o.tipo AS op_tipo, o.lote_id AS op_lote_id
      FROM src s
      LEFT JOIN public.ops o ON o.id = s.op_id
  ),
  item_check AS (
    SELECT oc.expedicao_id, oc.op_id, oc.is_latex, oc.pedido_id, oc.lote_id,
           oc.cliente_id, oc.op_tipo, oc.op_lote_id,
           COUNT(oi.id) AS item_ct,
           COUNT(oi.id) FILTER (
             WHERE m.tipo_produto IS DISTINCT FROM (CASE WHEN oc.is_latex THEN 'tapete' ELSE 'manta' END)
           ) AS wrong_ct
      FROM op_check oc
      LEFT JOIN public.op_itens oi ON oi.op_id = oc.op_id
      LEFT JOIN public.modelos m   ON m.id = oi.modelo_id
     GROUP BY oc.expedicao_id, oc.op_id, oc.is_latex, oc.pedido_id, oc.lote_id,
              oc.cliente_id, oc.op_tipo, oc.op_lote_id
  ),
  lineage_check AS (
    SELECT ic.*, l.pedido_id AS lote_pedido_id, l.cliente_id AS lote_cliente_id,
           p.cliente_id AS pedido_cliente_id
      FROM item_check ic
      LEFT JOIN public.lotes l   ON l.id = ic.op_lote_id
      LEFT JOIN public.pedidos p ON p.id = l.pedido_id
  )
  SELECT count(*), array_agg(expedicao_id ORDER BY expedicao_id)
    INTO v_bad_count, v_bad_ids
    FROM lineage_check
   WHERE op_tipo IS NULL
      OR op_tipo <> (CASE WHEN is_latex THEN 'latex' ELSE 'tecelagem' END)
      OR item_ct = 0
      OR wrong_ct > 0
      OR op_lote_id IS NULL
      OR lote_pedido_id IS NULL
      OR lote_cliente_id IS DISTINCT FROM pedido_cliente_id
      OR lote_id    IS DISTINCT FROM op_lote_id
      OR pedido_id  IS DISTINCT FROM lote_pedido_id
      OR cliente_id IS DISTINCT FROM lote_cliente_id;

  IF v_bad_count > 0 THEN
    RAISE EXCEPTION
      'PHASE-MANTA-B1 db/84 pre-existing data gate: % expedicao(oes) violam a rota/linhagem exigida (ids=%). Migracao abortada; nenhuma linha foi reparada ou reinterpretada.',
      v_bad_count, v_bad_ids;
  END IF;
END
$gate$;

-- ============================================================
-- A + B + C. Symmetric source-route validation, authoritative lineage
--    derivation/match (INSERT), and source + lineage immutability (UPDATE).
-- ============================================================
CREATE OR REPLACE FUNCTION public.expedicoes_source_validation_guard_fn()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_latex          BOOLEAN;
  v_source_op         BIGINT;
  v_required_tipo     TEXT;
  v_tipo              TEXT;
  v_lote_id           BIGINT;
  v_lote_pedido_id    UUID;
  v_lote_cliente_id   BIGINT;
  v_pedido_cliente_id BIGINT;
  v_item_ct           INTEGER;
  v_wrong_ct          INTEGER;
  v_lock_id           BIGINT;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    -- db/82 A (unchanged): the selected source is immutable for the life of
    -- the expedition. Reject BEFORE acquiring any source-OP lock.
    IF NEW.op_latex_id     IS DISTINCT FROM OLD.op_latex_id
       OR NEW.op_tecelagem_id IS DISTINCT FROM OLD.op_tecelagem_id THEN
      RAISE EXCEPTION
        'Fonte da expedicao % e imutavel apos a criacao; troca de fonte (op_latex_id/op_tecelagem_id) nao e permitida. Use um fluxo de correcao atomico dedicado.',
        OLD.id;
    END IF;
    -- db/84 BLOCKER C: the derived lineage is joined to that same immutable
    -- identity. Reject BEFORE acquiring any OP/Lote/Pedido lock, no
    -- retificacao bypass.
    IF NEW.pedido_id  IS DISTINCT FROM OLD.pedido_id
       OR NEW.lote_id    IS DISTINCT FROM OLD.lote_id
       OR NEW.cliente_id IS DISTINCT FROM OLD.cliente_id THEN
      RAISE EXCEPTION
        'Linhagem da expedicao % (pedido_id/lote_id/cliente_id) e imutavel apos a criacao. Use um fluxo de correcao atomico dedicado.',
        OLD.id;
    END IF;
    -- Ordinary status / timestamps / delivery-progress UPDATE: unaffected, no lock.
    RETURN NEW;
  END IF;

  -- INSERT: exactly-one-source (also a CHECK; validated defensively).
  IF (NEW.op_latex_id IS NOT NULL) = (NEW.op_tecelagem_id IS NOT NULL) THEN
    RAISE EXCEPTION
      'Expedicao % exige exatamente uma fonte (op_latex_id XOR op_tecelagem_id).',
      COALESCE(NEW.id::text, '(nova)');
  END IF;

  v_is_latex      := (NEW.op_latex_id IS NOT NULL);
  v_source_op     := COALESCE(NEW.op_latex_id, NEW.op_tecelagem_id);
  v_required_tipo := CASE WHEN v_is_latex THEN 'latex' ELSE 'tecelagem' END;

  -- Lock order step 1: source OP FOR UPDATE.
  PERFORM 1 FROM public.ops WHERE id = v_source_op FOR UPDATE;

  SELECT o.tipo, o.lote_id INTO v_tipo, v_lote_id FROM public.ops o WHERE o.id = v_source_op;
  IF v_tipo IS NULL THEN
    RAISE EXCEPTION 'Expedicao: OP % (fonte) inexistente.', v_source_op;
  END IF;
  IF v_tipo <> v_required_tipo THEN
    IF v_is_latex THEN
      RAISE EXCEPTION 'Expedicao: op_latex_id % deve ser OP de acabamento (tipo=latex), nao %.', v_source_op, v_tipo;
    ELSE
      RAISE EXCEPTION 'Expedicao: op_tecelagem_id % deve ser OP de tecelagem (tipo=tecelagem), nao %.', v_source_op, v_tipo;
    END IF;
  END IF;

  -- db/84 BLOCKER B: source OP must carry a Lote.
  IF v_lote_id IS NULL THEN
    RAISE EXCEPTION 'Expedicao: OP % (fonte) nao possui lote vinculado; linhagem indisponivel.', v_source_op;
  END IF;

  -- Lock order step 2: source Lote FOR SHARE (conflicts with a concurrent
  -- lineage-changing UPDATE on that Lote, BLOCKER E).
  PERFORM 1 FROM public.lotes WHERE id = v_lote_id FOR SHARE;

  SELECT l.pedido_id, l.cliente_id INTO v_lote_pedido_id, v_lote_cliente_id
    FROM public.lotes l WHERE l.id = v_lote_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Expedicao: lote % (fonte da OP %) inexistente.', v_lote_id, v_source_op;
  END IF;
  IF v_lote_pedido_id IS NULL THEN
    RAISE EXCEPTION 'Expedicao: lote % (fonte) nao possui pedido vinculado; linhagem indisponivel.', v_lote_id;
  END IF;

  -- Lock order step 3: source Pedido FOR SHARE (conflicts with a concurrent
  -- cliente_id-changing UPDATE on that Pedido, BLOCKER F).
  PERFORM 1 FROM public.pedidos WHERE id = v_lote_pedido_id FOR SHARE;

  SELECT p.cliente_id INTO v_pedido_cliente_id FROM public.pedidos p WHERE p.id = v_lote_pedido_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Expedicao: pedido % (fonte, via lote %) inexistente.', v_lote_pedido_id, v_lote_id;
  END IF;
  IF v_lote_cliente_id IS DISTINCT FROM v_pedido_cliente_id THEN
    RAISE EXCEPTION
      'Expedicao: linhagem inconsistente na origem -- lote % cliente % diverge do pedido % cliente %.',
      v_lote_id, v_lote_cliente_id, v_lote_pedido_id, v_pedido_cliente_id;
  END IF;

  -- Require the expedition payload to match the derived lineage exactly. NULL
  -- payload columns are rejected by IS DISTINCT FROM against a non-null
  -- required value; the payload is never rewritten.
  IF NEW.lote_id IS DISTINCT FROM v_lote_id THEN
    RAISE EXCEPTION 'Expedicao: lote_id % nao corresponde ao lote % da OP fonte %.', NEW.lote_id, v_lote_id, v_source_op;
  END IF;
  IF NEW.pedido_id IS DISTINCT FROM v_lote_pedido_id THEN
    RAISE EXCEPTION 'Expedicao: pedido_id % nao corresponde ao pedido % do lote fonte %.', NEW.pedido_id, v_lote_pedido_id, v_lote_id;
  END IF;
  IF NEW.cliente_id IS DISTINCT FROM v_lote_cliente_id THEN
    RAISE EXCEPTION 'Expedicao: cliente_id % nao corresponde ao cliente % do lote/pedido fonte.', NEW.cliente_id, v_lote_cliente_id;
  END IF;

  -- Lock order step 4: affected modelos rows, ascending modelo_id, FOR SHARE.
  FOR v_lock_id IN
    SELECT DISTINCT oi.modelo_id
      FROM public.op_itens oi
     WHERE oi.op_id = v_source_op
     ORDER BY oi.modelo_id
  LOOP
    PERFORM 1 FROM public.modelos WHERE id = v_lock_id FOR SHARE;
  END LOOP;

  -- db/84 BLOCKER A: symmetric non-emptiness + homogeneous required product
  -- type for BOTH branches. Derived strictly from modelos.tipo_produto.
  SELECT count(*),
         count(*) FILTER (
           WHERE m.tipo_produto IS DISTINCT FROM (CASE WHEN v_is_latex THEN 'tapete' ELSE 'manta' END)
         )
    INTO v_item_ct, v_wrong_ct
    FROM public.op_itens oi
    JOIN public.modelos m ON m.id = oi.modelo_id
   WHERE oi.op_id = v_source_op;

  IF v_item_ct = 0 THEN
    RAISE EXCEPTION 'Expedicao: OP % (fonte) nao possui itens; fonte invalida.', v_source_op;
  END IF;
  IF v_wrong_ct > 0 THEN
    IF v_is_latex THEN
      RAISE EXCEPTION 'Expedicao: OP % nao e homogenea de Tapete (% item(ns) Manta/outro); fonte de expedicao Latex rejeitada.', v_source_op, v_wrong_ct;
    ELSE
      RAISE EXCEPTION 'Expedicao: OP % nao e homogenea de Manta (% item(ns) nao-Manta); fonte de expedicao Manta rejeitada.', v_source_op, v_wrong_ct;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.expedicoes_source_validation_guard_fn() IS
  'db/84: como db/82 (fonte imutavel apos INSERT) e adicionalmente (BLOCKER A) simetrico entre Latex/Tapete e Manta (nao-vazia, homogenea pelo tipo_produto exigido) e (BLOCKER B/C) deriva e exige a linhagem OP->lote->pedido->cliente exata no INSERT, tornando pedido_id/lote_id/cliente_id da expedicao tambem imutaveis no UPDATE (sem bypass por retificacao). Trava OP FOR UPDATE, lote FOR SHARE, pedido FOR SHARE, modelos FOR SHARE (ordem ascendente) antes de validar.';

-- ============================================================
-- D. Source OP lineage immutability: tipo AND lote_id.
-- ============================================================
CREATE OR REPLACE FUNCTION public.ops_source_type_immutability_guard_fn()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.tipo IS NOT DISTINCT FROM OLD.tipo
     AND NEW.lote_id IS NOT DISTINCT FROM OLD.lote_id THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.expedicoes
     WHERE op_latex_id = OLD.id OR op_tecelagem_id = OLD.id
  ) THEN
    RAISE EXCEPTION
      'OP %: tipo e lote_id sao imutaveis enquanto referenciada como fonte de expedicao (op_latex_id/op_tecelagem_id); alteracao tipo %->% / lote_id %->% rejeitada. Sem bypass por app.retificacao_autorizada.',
      OLD.id, OLD.tipo, NEW.tipo, OLD.lote_id, NEW.lote_id;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.ops_source_type_immutability_guard_fn() IS
  'db/84: como db/83 (tipo imutavel enquanto referenciada como fonte de expedicao) e adicionalmente protege lote_id pelo mesmo motivo (linhagem da OP fonte). Atualizacao de mesmo valor permanece permitida. Sem bypass por app.retificacao_autorizada; nao altera o comportamento de status (db/21/db/81 preservados).';

-- ============================================================
-- E. Lote lineage immutability.
-- ============================================================
CREATE OR REPLACE FUNCTION public.lotes_source_lineage_immutability_guard_fn()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.pedido_id IS NOT DISTINCT FROM OLD.pedido_id
     AND NEW.cliente_id IS NOT DISTINCT FROM OLD.cliente_id THEN
    RETURN NEW;
  END IF;

  -- Inspects references with a plain unlocked EXISTS -- no source-OP lock is
  -- requested (BLOCKER D separately protects ops.lote_id; the Lote row
  -- itself already carries the UPDATE's own target-row lock, so there is no
  -- race left to close by additionally locking ops here).
  IF EXISTS (
    SELECT 1
      FROM public.ops o
      JOIN public.expedicoes ex ON ex.op_latex_id = o.id OR ex.op_tecelagem_id = o.id
     WHERE o.lote_id = OLD.id
  ) THEN
    RAISE EXCEPTION
      'Lote %: referenciado por uma OP selecionada como fonte de expedicao; pedido_id/cliente_id sao imutaveis. Sem bypass por app.retificacao_autorizada.',
      OLD.id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS lotes_source_lineage_immutability_guard ON public.lotes;
CREATE TRIGGER lotes_source_lineage_immutability_guard
  BEFORE UPDATE ON public.lotes
  FOR EACH ROW EXECUTE FUNCTION public.lotes_source_lineage_immutability_guard_fn();

COMMENT ON FUNCTION public.lotes_source_lineage_immutability_guard_fn() IS
  'db/84 BLOCKER E: enquanto o lote e referenciado por uma OP selecionada como fonte de expedicao, rejeita alteracao de pedido_id/cliente_id (atualizacao de mesmo valor permanece permitida). Inspeciona referencias sem travar a OP fonte. Sem bypass por app.retificacao_autorizada. Lotes nao relacionados nao sao afetados.';

-- ============================================================
-- F. Pedido client immutability.
-- ============================================================
CREATE OR REPLACE FUNCTION public.pedidos_source_lineage_immutability_guard_fn()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.cliente_id IS NOT DISTINCT FROM OLD.cliente_id THEN
    RETURN NEW;
  END IF;

  -- Same unlocked-EXISTS design as E; no source-OP or Lote lock requested.
  IF EXISTS (
    SELECT 1
      FROM public.lotes l
      JOIN public.ops o ON o.lote_id = l.id
      JOIN public.expedicoes ex ON ex.op_latex_id = o.id OR ex.op_tecelagem_id = o.id
     WHERE l.pedido_id = OLD.id
  ) THEN
    RAISE EXCEPTION
      'Pedido %: participa (via lote) da linhagem de uma OP selecionada como fonte de expedicao; cliente_id e imutavel. Sem bypass por app.retificacao_autorizada.',
      OLD.id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS pedidos_source_lineage_immutability_guard ON public.pedidos;
CREATE TRIGGER pedidos_source_lineage_immutability_guard
  BEFORE UPDATE ON public.pedidos
  FOR EACH ROW EXECUTE FUNCTION public.pedidos_source_lineage_immutability_guard_fn();

COMMENT ON FUNCTION public.pedidos_source_lineage_immutability_guard_fn() IS
  'db/84 BLOCKER F: enquanto o pedido participa (via lote) da linhagem de uma OP selecionada como fonte de expedicao, rejeita alteracao de cliente_id (atualizacao de mesmo valor e demais campos permanecem permitidos). Sem bypass por app.retificacao_autorizada. Pedidos nao relacionados nao sao afetados.';

-- ============================================================
-- Reload PostgREST
-- ============================================================
NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';

COMMIT;
