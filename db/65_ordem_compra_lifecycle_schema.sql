-- ============================================================
-- Phase: ORDEM-COMPRA-LIFECYCLE Phase A — schema + config
-- Spec:  docs/architecture/ORDEM_COMPRA_LIFECYCLE_SPEC_PROPOSED.md
--        (RATIFIED, ORDEM-COMPRA-LIFECYCLE-SPEC-RATIFICATION-R1)
-- Order: ORDEM-COMPRA-PHASE-A (schema + config), Phase A only.
--
-- Scope (spec §3.1-§3.6, §8's Phase A row):
--   1. Three new dimension columns + supporting audit columns on
--      public.ordens_compra_fio (administrative cycle / acceptance /
--      receipt, all additive, all defaulted/nullable) — §3.1.
--   2. public.ordem_compra_fio_lancamentos — new physical-receipt
--      ledger table. Created empty/unused in this phase: no trigger,
--      no RPC writes it yet (trigger wiring is Phase C's job, §3.2/
--      §3.3) — shipped now so Phase C does not also need to create
--      the base table while wiring its trigger (§8 Phase A row).
--   3. public.ordem_compra_eventos — new transition-audit table,
--      op_eventos (db/21) / usuarios_eventos (db/60) pattern:
--      admin-only read, no client writes.
--   4. public.ordem_compra_config — new singleton config table,
--      seeded exige_aceite=false (§3.5).
--   5. One-time legacy-marking backfill (§3.6): every pre-existing
--      row is recognized as already emitida/nao_aplicavel.
--
-- BINDING (ratified 2026-07-18, gap 1): the ALTER TABLE and the §3.6
-- backfill UPDATE execute in this single migration file inside one
-- explicit transaction (BEGIN/COMMIT below) — no window may exist for
-- a live draft row (inserted between the two statements) to be
-- mislabeled emitida/legacy by the backfill's own WHERE clause.
--
-- Explicitly OUT of scope for Phase A (per the order's FORBIDDEN list
-- and spec §8's Phase B/C rows): no RPC, no UI, no JS change, no
-- trigger on ordem_compra_fio_lancamentos, and no REVOKE of direct
-- UPDATE on ordens_compra_fio's dimension columns from authenticated
-- (that is binding gap 2, explicitly scoped to Phase B/C — enforcing
-- it here would be scope creep beyond this order).
--
-- Idempotent: ADD COLUMN IF NOT EXISTS / CREATE TABLE IF NOT EXISTS /
-- CREATE INDEX IF NOT EXISTS / DROP POLICY IF EXISTS throughout; the
-- backfill UPDATE's own WHERE clause (status_administrativo =
-- 'rascunho') naturally excludes already-migrated rows on rerun, so a
-- second run touches zero rows. No destructive DELETE, no real data
-- rewritten (kg_recebido untouched), no secrets.
-- ============================================================

BEGIN;

-- ============================================================
-- 1. public.ordens_compra_fio — new dimension + audit columns (§3.1)
-- ============================================================

ALTER TABLE public.ordens_compra_fio
  ADD COLUMN IF NOT EXISTS status_administrativo TEXT NOT NULL DEFAULT 'rascunho'
    CHECK (status_administrativo IN ('rascunho', 'emitida', 'cancelada')),
  ADD COLUMN IF NOT EXISTS status_aceite TEXT NOT NULL DEFAULT 'nao_aplicavel'
    CHECK (status_aceite IN ('nao_aplicavel', 'pendente', 'aceita', 'rejeitada')),
  ADD COLUMN IF NOT EXISTS aceite_exigido_na_emissao BOOLEAN,
  ADD COLUMN IF NOT EXISTS emitida_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS emitida_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cancelada_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancelada_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS aceite_decidida_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS aceite_decidida_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS aceite_motivo TEXT,
  ADD COLUMN IF NOT EXISTS status_recebimento TEXT NOT NULL DEFAULT 'nao_recebido'
    CHECK (status_recebimento IN ('nao_recebido', 'parcial', 'recebido')),
  ADD COLUMN IF NOT EXISTS legado_recebimento_automatico BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.ordens_compra_fio.status_administrativo IS
  'Administrative cycle (spec §2.1): rascunho -> emitida -> cancelada. Set only by the emitir_ordem_compra_fio / cancelar_ordem_compra_fio RPCs (Phase B) — direct client UPDATE is a Phase B/C ACL concern, not enforced by this migration.';
COMMENT ON COLUMN public.ordens_compra_fio.status_aceite IS
  'Acceptance dimension (spec §2.2): nao_aplicavel/pendente/aceita/rejeitada. nao_aplicavel is permanent when aceite_exigido_na_emissao is false or null (not yet emitted).';
COMMENT ON COLUMN public.ordens_compra_fio.aceite_exigido_na_emissao IS
  'Frozen snapshot of ordem_compra_config.exige_aceite taken at the instant of emissao (spec §2.3 freeze rule). NULL until emitida. Never re-read from the live config after emission.';
COMMENT ON COLUMN public.ordens_compra_fio.status_recebimento IS
  'Receipt dimension (spec §2.4), replacement vocabulary for the legacy status column. Derived only — never written directly outside this migration''s one-time backfill; from Phase C onward it is trigger-maintained from ordem_compra_fio_lancamentos.';
COMMENT ON COLUMN public.ordens_compra_fio.legado_recebimento_automatico IS
  'TRUE for every row that predates this migration (spec §3.6 backfill). Its kg_recebido/status_recebimento is a frozen legacy snapshot, not backed by ordem_compra_fio_lancamentos rows, unless/until a new physical entry is registered against it (spec §3.3).';


-- ============================================================
-- 2. public.ordem_compra_fio_lancamentos — physical receipt ledger (§3.2)
-- Created empty/unused: no trigger, no RPC in this phase (Phase C).
-- ============================================================

CREATE TABLE IF NOT EXISTS public.ordem_compra_fio_lancamentos (
  id                   BIGSERIAL PRIMARY KEY,
  ordem_compra_fio_id  BIGINT NOT NULL REFERENCES public.ordens_compra_fio(id) ON DELETE CASCADE,
  kg_recebido          NUMERIC(10,3) NOT NULL CHECK (kg_recebido > 0),
  data_recebimento     DATE NOT NULL DEFAULT CURRENT_DATE,
  observacao           TEXT,
  criado_por           UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  criado_em            TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.ordem_compra_fio_lancamentos IS
  'Append-only physical receipt ledger for ordens_compra_fio (spec §3.2). Phase A: table shape only, no trigger, no writer RPC — Phase C wires the AFTER INSERT trigger that recomputes the parent''s kg_recebido/status_recebimento and swaps registrar_recebimento_ordem_compra_fio to write here. Legacy rows (legado_recebimento_automatico=true) get no fabricated opening-balance row (spec §3.3).';

CREATE INDEX IF NOT EXISTS ordem_compra_fio_lancamentos_ordem_idx
  ON public.ordem_compra_fio_lancamentos(ordem_compra_fio_id);

ALTER TABLE public.ordem_compra_fio_lancamentos ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.ordem_compra_fio_lancamentos FROM PUBLIC;
REVOKE ALL ON TABLE public.ordem_compra_fio_lancamentos FROM anon;
REVOKE ALL ON TABLE public.ordem_compra_fio_lancamentos FROM authenticated;

GRANT SELECT ON TABLE public.ordem_compra_fio_lancamentos TO authenticated;

DROP POLICY IF EXISTS ordem_compra_fio_lancamentos_admin_select ON public.ordem_compra_fio_lancamentos;
CREATE POLICY ordem_compra_fio_lancamentos_admin_select ON public.ordem_compra_fio_lancamentos FOR SELECT
  USING (is_admin());

-- No INSERT/UPDATE/DELETE policy for any client role by design — this
-- phase ships no writer. Phase C's SECURITY DEFINER RPC will write via
-- its owner's privileges (bypasses RLS), same model as
-- usuarios_eventos/trg_usuario_evento (db/60).


-- ============================================================
-- 3. public.ordem_compra_eventos — transition audit (§3.4)
-- op_eventos (db/21) / usuarios_eventos (db/60) pattern: admin-only
-- read, no client writes. No writer exists yet in this phase — every
-- write path in spec §4 is Phase B/C.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.ordem_compra_eventos (
  id                   BIGSERIAL PRIMARY KEY,
  ordem_compra_fio_id  BIGINT NOT NULL REFERENCES public.ordens_compra_fio(id) ON DELETE CASCADE,
  dimensao             TEXT NOT NULL CHECK (dimensao IN ('administrativo', 'aceite', 'recebimento')),
  tipo_evento          TEXT NOT NULL,
  valor_anterior       TEXT,
  valor_novo           TEXT,
  payload              JSONB NOT NULL DEFAULT '{}'::jsonb,
  criado_por           UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  criado_em            TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.ordem_compra_eventos IS
  'Append-only transition audit for ordens_compra_fio (spec §3.4), op_eventos/usuarios_eventos pattern. Every Phase B/C write path (emitir/cancelar/decidir_aceite/registrar_recebimento) inserts exactly one row here (one per lancamento for the recebimento dimension). No writer exists yet in Phase A.';
COMMENT ON COLUMN public.ordem_compra_eventos.dimensao IS
  'Which of the three orthogonal axes (spec §1) this event belongs to: administrativo/aceite/recebimento.';
COMMENT ON COLUMN public.ordem_compra_eventos.tipo_evento IS
  'e.g. emitida, cancelada, aceite_solicitado, aceite_aceito, aceite_rejeitado, aceite_override_admin, recebimento_registrado (spec §3.4). Extensible.';
COMMENT ON COLUMN public.ordem_compra_eventos.payload IS
  'Event metadata, incl. policy-in-force snapshot at emission. Not a substitute for typed columns.';

CREATE INDEX IF NOT EXISTS ordem_compra_eventos_ordem_idx
  ON public.ordem_compra_eventos(ordem_compra_fio_id);

ALTER TABLE public.ordem_compra_eventos ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.ordem_compra_eventos FROM PUBLIC;
REVOKE ALL ON TABLE public.ordem_compra_eventos FROM anon;
REVOKE ALL ON TABLE public.ordem_compra_eventos FROM authenticated;

GRANT SELECT ON TABLE public.ordem_compra_eventos TO authenticated;

DROP POLICY IF EXISTS ordem_compra_eventos_admin_select ON public.ordem_compra_eventos;
CREATE POLICY ordem_compra_eventos_admin_select ON public.ordem_compra_eventos FOR SELECT
  USING (is_admin());

-- No INSERT/UPDATE/DELETE policy for any client role by design — the
-- write path is exclusively the future Phase B/C SECURITY DEFINER RPCs
-- (bypass RLS via ownership, same model as op_eventos/usuarios_eventos).


-- ============================================================
-- 4. public.ordem_compra_config — singleton config (§3.5)
-- Dedicated one-row table, not a generic key-value store (Rule 7).
-- ============================================================

CREATE TABLE IF NOT EXISTS public.ordem_compra_config (
  id             SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  exige_aceite   BOOLEAN NOT NULL DEFAULT FALSE,
  atualizado_em  TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

COMMENT ON TABLE public.ordem_compra_config IS
  'Singleton config for the purchase-order lifecycle (spec §3.5). Exactly one row (id=1). exige_aceite gates whether emitir_ordem_compra_fio (Phase B) requires acceptance before receipt — read and snapshotted at emission time only (spec §2.3 freeze rule), never read retroactively for already-emitted orders. UI label: "Exigir aceite antes do recebimento da ordem de compra".';

INSERT INTO public.ordem_compra_config (id, exige_aceite)
VALUES (1, FALSE)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.ordem_compra_config ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.ordem_compra_config FROM PUBLIC;
REVOKE ALL ON TABLE public.ordem_compra_config FROM anon;
REVOKE ALL ON TABLE public.ordem_compra_config FROM authenticated;

GRANT SELECT ON TABLE public.ordem_compra_config TO authenticated;

DROP POLICY IF EXISTS ordem_compra_config_admin_select ON public.ordem_compra_config;
CREATE POLICY ordem_compra_config_admin_select ON public.ordem_compra_config FOR SELECT
  USING (is_admin());

-- No INSERT/UPDATE/DELETE policy for any client role by design — this
-- phase ships no admin toggle RPC/UI (Phase B concern). The seed row
-- above is inserted by the migration role, which is not subject to
-- its own just-created RLS policies.


-- ============================================================
-- 5. Legacy marking backfill (§3.6, one-time)
-- Every pre-existing row (status_administrativo still at its default
-- 'rascunho', i.e. every row that existed before this migration) is
-- recognized as already emitida/nao_aplicavel — the historical flow
-- had no draft/acceptance concept, every row was born immediately
-- actionable. No kg_recebido rewrite; only the new status_recebimento
-- vocabulary is derived from the old status column, once.
-- ============================================================

UPDATE public.ordens_compra_fio
SET status_administrativo         = 'emitida',
    status_aceite                 = 'nao_aplicavel',
    status_recebimento            = CASE status
                                       WHEN 'pendente'         THEN 'nao_recebido'
                                       WHEN 'recebido_parcial' THEN 'parcial'
                                       WHEN 'recebido_total'   THEN 'recebido'
                                     END,
    legado_recebimento_automatico  = TRUE
WHERE status_administrativo = 'rascunho';

COMMIT;

-- ============================================================
-- Schema cache reload (PostgREST)
-- ============================================================
NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';
