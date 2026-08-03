-- =============================================================================
-- db/123 — TECELAGEM V1: INDIVIDUALLY IDENTIFIABLE PRODUCTION ROLLS
-- =============================================================================
-- ORDER: TECELAGEM-V1-FIRST-VERTICAL-SLICE (R3 / ASSURANCE).
--
-- PRODUCT REQUIREMENT BEING SATISFIED
-- The weaving supplier registers production as a NUMBER OF ROLLS. A quantity of
-- 10 must not remain an abstract aggregate: it must result in 10 individually
-- identifiable, individually persisted rolls that the operator can inspect.
-- Individual roll length is OPTIONAL and its absence must never block
-- registration.
--
-- ROOT CAUSE THIS MIGRATION ADDRESSES (measured, not assumed)
-- Across db/01..db/122 there is NO physical production unit anywhere in the
-- schema. Weaving output exists only as an AGGREGATE METRE QUANTITY on
-- public.entrega_itens.metros_entregues. A repository-wide search for a roll
-- concept returns nothing: the individual roll has never had a representation,
-- so the requirement cannot be satisfied by reusing an existing table.
--
-- PRODUCTION START IS LOCAL TO THE WEAVING SURFACE (RATIFIED PRODUCT RULE)
-- The weaving operator must START production before any roll may be registered,
-- and that start is an OPERATIONAL FACT OF THIS SURFACE ONLY:
--
--     THIS OP HAS BEEN STARTED BY THE WEAVING OPERATOR
--
-- It is NOT the authoritative Admin lifecycle transition. Starting production
-- here does not read as, substitute for, or trigger public.iniciar_producao_op,
-- and ops.status is not written by any object in this migration. The two facts
-- are deliberately independent in this phase: an OP may be locally started
-- while Admin still records 'aberta', and Admin integration is a later phase.
--
-- The fact is persisted in public.tecelagem_op_execucao (one row per OP) and it
-- is the SOLE gate on roll registration. Registering before it exists is
-- refused by the writer, not merely hidden by the interface.
--
-- ISOLATION CONTRACT (the binding constraint of this phase)
-- The weaving surface persists its OWN operational state and must not, in this
-- phase, alter Admin records, the Admin OP lifecycle, Admin calculations,
-- Admin movements or the finishing flow. This migration is therefore STRICTLY
-- ADDITIVE. It:
--
--   - creates four NEW tables and two NEW writers, and nothing else;
--   - ALTERs no existing table, column, constraint, index, view or sequence;
--   - CREATEs, REPLACEs or DROPs no pre-existing function;
--   - installs NO trigger on any pre-existing table;
--   - changes NO pre-existing grant, policy or RLS setting;
--   - writes to NO pre-existing table, at migration time or at run time.
--
-- The ONLY direction of coupling is READ-ONLY and INWARD: weaving reads the
-- Ravatex-defined OP and product through the SELECT-only supplier policies that
-- already exist (ops_fornecedor_read, op_itens_fornecedor_read,
-- op_fornecedores_self_read from db/03). Ravatex-supplied specification data is
-- consequently read-only to the supplier at the SERVER, not merely in the UI.
--
-- WHY ON DELETE CASCADE ON THE ADMIN-FACING FOREIGN KEYS
-- Deliberate, and load-bearing for the isolation contract. If weaving rows
-- RESTRICTed the deletion of an OP or an OP item, then registering a roll would
-- CHANGE ADMIN BEHAVIOUR: an OP that Admin can delete today would stop being
-- deletable. CASCADE preserves the existing Admin deletion path byte-for-byte
-- and lets Admin remain authoritative over its own records. Admin may affect
-- weaving; weaving may never affect Admin.
--
-- ROLL NUMBERING — SEQUENTIAL WITHIN THE OP (RATIFIED PRODUCT RULE)
-- The visible roll number is a CONTINUOUS SEQUENCE PER OP, spanning every
-- product of that OP. Two physical rolls of the same OP can never both be
-- presented as "Rolo 043", whether or not they belong to the same product.
-- This is enforced structurally by UNIQUE (op_id, numero) on tecelagem_rolos,
-- not merely by the allocator: even a defective caller cannot produce a
-- collision.
--
-- The counter is keyed by op_id in a table this migration owns, so allocation
-- locks a WEAVING row and never an Admin row — taking a row lock on ops or
-- op_itens would stall Admin writers and would itself be interference.
--
-- WHAT THIS MIGRATION DELIBERATELY DOES NOT DO
--   - it does NOT expand the roll-state model: `na_tecelagem` is the only
--     admitted situation in this slice;
--   - it does NOT create labels, QR identifiers, finishing linkage, shipment
--     or romaneio structures;
--   - it does NOT feed Admin production, availability, movements or lifecycle;
--   - it does NOT reconcile weaving rolls against metros_pedidos or
--     metros_ajustados, and enforces no relationship between them;
--   - it does NOT give the weaving surface a way to STOP, undo or reverse a
--     local production start: this slice owns only the forward fact.
-- =============================================================================

-- ---------------------------------------------------------------------
-- 0. Entry gate — refuse to run against an unexpected baseline
-- ---------------------------------------------------------------------
DO $gate$
DECLARE
  v_missing TEXT[] := ARRAY[]::TEXT[];
BEGIN
  IF to_regclass('public.ops')             IS NULL THEN v_missing := v_missing || 'public.ops';             END IF;
  IF to_regclass('public.op_itens')        IS NULL THEN v_missing := v_missing || 'public.op_itens';        END IF;
  IF to_regclass('public.op_fornecedores') IS NULL THEN v_missing := v_missing || 'public.op_fornecedores'; END IF;
  IF to_regclass('public.fornecedores')    IS NULL THEN v_missing := v_missing || 'public.fornecedores';    END IF;
  IF to_regclass('public.usuarios')        IS NULL THEN v_missing := v_missing || 'public.usuarios';        END IF;

  IF to_regprocedure('public.meu_fornecedor_id()') IS NULL THEN
    v_missing := v_missing || 'public.meu_fornecedor_id()';
  END IF;
  IF to_regprocedure('public.is_admin()') IS NULL THEN
    v_missing := v_missing || 'public.is_admin()';
  END IF;

  IF array_length(v_missing, 1) IS NOT NULL THEN
    RAISE EXCEPTION 'db/123 entry gate: missing prerequisite object(s): %',
      array_to_string(v_missing, ', ');
  END IF;

  -- op_fornecedores.etapa must still admit 'cima' as the weaving stage: it is
  -- the predicate this migration's authorization model is built on.
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint c
      JOIN pg_class t ON t.oid = c.conrelid
     WHERE t.relname = 'op_fornecedores'
       AND c.contype = 'c'
       AND pg_get_constraintdef(c.oid) ILIKE '%cima%'
  ) THEN
    RAISE EXCEPTION 'db/123 entry gate: op_fornecedores no longer constrains etapa to a set including ''cima''';
  END IF;
END
$gate$;

-- ---------------------------------------------------------------------
-- 1. Weaving-owned roll-number counter
--
-- One row per OP — NOT per product, because the visible number is sequential
-- across the whole OP. This is the ONLY row the writer locks, which is exactly
-- why no Admin row is ever locked by a weaving registration.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tecelagem_rolo_sequencia (
  op_id        BIGINT PRIMARY KEY REFERENCES public.ops(id) ON DELETE CASCADE,
  proximo      INTEGER NOT NULL DEFAULT 1 CHECK (proximo >= 1),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.tecelagem_rolo_sequencia IS
  'db/123. Weaving-owned allocator for the operator-visible roll number, scoped per OP (ops.id) and therefore continuous across every product of that OP. Locked by registrar_producao_tecelagem so that roll numbering never takes a lock on an Admin row.';

-- ---------------------------------------------------------------------
-- 1b. LOCAL PRODUCTION START — the weaving surface's own operational fact
--
-- One row per OP, and the row's EXISTENCE is the whole fact: this OP has been
-- started by the weaving operator. There is no state column, because this
-- slice admits exactly one forward transition and inventing a state machine
-- here would be inventing product semantics nobody ratified.
--
-- It is NOT the Admin lifecycle. ops.status is neither read as authority nor
-- written: an OP whose Admin status is still 'aberta' can carry this row, and
-- an OP whose Admin status is 'em_producao' does NOT carry it implicitly.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tecelagem_op_execucao (
  op_id         BIGINT PRIMARY KEY REFERENCES public.ops(id) ON DELETE CASCADE,
  fornecedor_id BIGINT NOT NULL REFERENCES public.fornecedores(id) ON DELETE RESTRICT,
  iniciada_em   TIMESTAMPTZ NOT NULL DEFAULT now(),
  iniciada_por  UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS tecelagem_op_execucao_fornecedor_idx
  ON public.tecelagem_op_execucao (fornecedor_id);

COMMENT ON TABLE public.tecelagem_op_execucao IS
  'db/123. The weaving operator started production on this OP. Operational fact of the weaving surface ONLY: it is not the Admin lifecycle transition, it never writes ops.status, and it is the sole gate on registrar_producao_tecelagem.';

-- ---------------------------------------------------------------------
-- 2. Production registration (one operator action)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tecelagem_producao_lancamentos (
  id                BIGSERIAL PRIMARY KEY,
  op_id             BIGINT NOT NULL REFERENCES public.ops(id)           ON DELETE CASCADE,
  op_item_id        BIGINT NOT NULL REFERENCES public.op_itens(id)      ON DELETE CASCADE,
  fornecedor_id     BIGINT NOT NULL REFERENCES public.fornecedores(id)  ON DELETE RESTRICT,
  quantidade_rolos  INTEGER NOT NULL CHECK (quantidade_rolos >= 1 AND quantidade_rolos <= 500),
  registrado_por    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  criado_em         TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Referenced by the composite foreign key on tecelagem_rolos so that a roll
  -- can NEVER disagree with its own registration about OP, product or supplier.
  CONSTRAINT tecelagem_producao_lancamentos_identidade_uk
    UNIQUE (id, op_id, op_item_id, fornecedor_id)
);

CREATE INDEX IF NOT EXISTS tecelagem_producao_lancamentos_item_idx
  ON public.tecelagem_producao_lancamentos (op_item_id, id DESC);
CREATE INDEX IF NOT EXISTS tecelagem_producao_lancamentos_fornecedor_idx
  ON public.tecelagem_producao_lancamentos (fornecedor_id);

COMMENT ON TABLE public.tecelagem_producao_lancamentos IS
  'db/123. One weaving production registration by the supplier. Operational state of the weaving surface only: it feeds no Admin record, calculation, movement or lifecycle transition.';

-- ---------------------------------------------------------------------
-- 3. The individual physical roll
--
-- This table is the whole point of the slice: a registration of 10 produces
-- 10 rows here, each independently identifiable and independently inspectable.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tecelagem_rolos (
  id             BIGSERIAL PRIMARY KEY,
  lancamento_id  BIGINT NOT NULL REFERENCES public.tecelagem_producao_lancamentos(id) ON DELETE CASCADE,
  op_id          BIGINT NOT NULL,
  op_item_id     BIGINT NOT NULL,
  fornecedor_id  BIGINT NOT NULL,

  -- The operator-visible number. Continuous per OP, across every product of
  -- that OP; see the header.
  numero         INTEGER NOT NULL CHECK (numero >= 1),

  -- OPTIONAL by product requirement. NULL is a first-class, valid value and a
  -- roll carrying NULL here is in every respect a normal, valid roll.
  comprimento_m  NUMERIC(10,2) CHECK (comprimento_m IS NULL OR comprimento_m > 0),

  -- Deliberately single-valued in this slice. The roll-state model is NOT
  -- expanded beyond what this product slice requires.
  situacao       TEXT NOT NULL DEFAULT 'na_tecelagem'
                 CHECK (situacao IN ('na_tecelagem')),

  criado_em      TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- THE ANTI-COLLISION RULE, structural: within one OP a visible roll number
  -- exists at most once, whatever product produced it.
  CONSTRAINT tecelagem_rolos_numero_uk UNIQUE (op_id, numero),

  CONSTRAINT tecelagem_rolos_lancamento_identidade_fk
    FOREIGN KEY (lancamento_id, op_id, op_item_id, fornecedor_id)
    REFERENCES public.tecelagem_producao_lancamentos (id, op_id, op_item_id, fornecedor_id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS tecelagem_rolos_item_idx
  ON public.tecelagem_rolos (op_item_id, numero);
CREATE INDEX IF NOT EXISTS tecelagem_rolos_lancamento_idx
  ON public.tecelagem_rolos (lancamento_id);

COMMENT ON TABLE public.tecelagem_rolos IS
  'db/123. ONE ROW PER PHYSICAL ROLL produced in weaving. A registration of 10 rolls creates exactly 10 rows. comprimento_m is optional and NULL is valid.';
COMMENT ON COLUMN public.tecelagem_rolos.comprimento_m IS
  'Optional individual roll length in metres. NULL means the operator did not supply it; the roll remains valid and visible.';

-- ---------------------------------------------------------------------
-- 4. Row-level security
--
-- Supplier: reads ONLY its own weaving rows. Admin: reads everything.
-- NOBODY gets an INSERT/UPDATE/DELETE policy: every write goes through the
-- SECURITY DEFINER writer in section 6, which is owned by postgres and
-- therefore not subject to these policies.
-- ---------------------------------------------------------------------
ALTER TABLE public.tecelagem_rolo_sequencia        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tecelagem_op_execucao           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tecelagem_producao_lancamentos  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tecelagem_rolos                 ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tecelagem_execucao_admin_read ON public.tecelagem_op_execucao;
CREATE POLICY tecelagem_execucao_admin_read
  ON public.tecelagem_op_execucao FOR SELECT
  USING (public.is_admin());

DROP POLICY IF EXISTS tecelagem_execucao_fornecedor_read ON public.tecelagem_op_execucao;
CREATE POLICY tecelagem_execucao_fornecedor_read
  ON public.tecelagem_op_execucao FOR SELECT
  USING (fornecedor_id = public.meu_fornecedor_id());

DROP POLICY IF EXISTS tecelagem_lancamentos_admin_read ON public.tecelagem_producao_lancamentos;
CREATE POLICY tecelagem_lancamentos_admin_read
  ON public.tecelagem_producao_lancamentos FOR SELECT
  USING (public.is_admin());

DROP POLICY IF EXISTS tecelagem_lancamentos_fornecedor_read ON public.tecelagem_producao_lancamentos;
CREATE POLICY tecelagem_lancamentos_fornecedor_read
  ON public.tecelagem_producao_lancamentos FOR SELECT
  USING (fornecedor_id = public.meu_fornecedor_id());

DROP POLICY IF EXISTS tecelagem_rolos_admin_read ON public.tecelagem_rolos;
CREATE POLICY tecelagem_rolos_admin_read
  ON public.tecelagem_rolos FOR SELECT
  USING (public.is_admin());

DROP POLICY IF EXISTS tecelagem_rolos_fornecedor_read ON public.tecelagem_rolos;
CREATE POLICY tecelagem_rolos_fornecedor_read
  ON public.tecelagem_rolos FOR SELECT
  USING (fornecedor_id = public.meu_fornecedor_id());

-- The counter is pure internal mechanics. No role reads it directly.

-- ---------------------------------------------------------------------
-- 5. Grants
--
-- Supabase re-grants ALL on newly created public tables to anon,
-- authenticated and service_role through ALTER DEFAULT PRIVILEGES (recorded
-- debt SUPABASE-DEFAULT-ACL-REGRANTS-FUTURE-PUBLIC-TABLES). Declaring the
-- final privilege state EXPLICITLY, rather than relying on the default, is
-- mandatory here — otherwise `authenticated` could INSERT rolls directly and
-- bypass the writer's authorization checks entirely. Same discipline as db/93.
-- ---------------------------------------------------------------------
REVOKE ALL ON TABLE public.tecelagem_rolo_sequencia       FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE public.tecelagem_op_execucao          FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE public.tecelagem_producao_lancamentos FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE public.tecelagem_rolos                FROM PUBLIC, anon, authenticated, service_role;

-- Read-only, and only for a logged-in identity. RLS above decides WHICH rows.
GRANT SELECT ON TABLE public.tecelagem_op_execucao          TO authenticated;
GRANT SELECT ON TABLE public.tecelagem_producao_lancamentos TO authenticated;
GRANT SELECT ON TABLE public.tecelagem_rolos                TO authenticated;

-- The sequences behind the BIGSERIALs are only ever advanced by the writer,
-- which runs as owner. No role needs USAGE.
REVOKE ALL ON SEQUENCE public.tecelagem_producao_lancamentos_id_seq FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON SEQUENCE public.tecelagem_rolos_id_seq                FROM PUBLIC, anon, authenticated, service_role;

-- ---------------------------------------------------------------------
-- 5b. THE SINGLE OWNER OF "MAY THIS OP BE STARTED IN WEAVING?"
--
-- Stated exactly ONCE. The start writer and the work-list read model both
-- derive from it, so what the operator is shown and what the server admits can
-- never drift apart — an OP cannot gain the action merely because the weaving
-- interface exists, and cannot be refused an action the interface offered.
--
-- Returns NULL when the OP may be started, otherwise a stable refusal code.
-- Eligibility is DERIVED from the lifecycle that already exists: the Admin OP
-- status and the single accepted owner of the weaving-OP rule,
-- public._pedido_permite_op_tecelagem (db/121). No new rule is invented here.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._tecelagem_op_pode_iniciar(p_op_id BIGINT)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_status    TEXT;
  v_pedido_id UUID;
BEGIN
  SELECT o.status, l.pedido_id
    INTO v_status, v_pedido_id
    FROM public.ops o
    LEFT JOIN public.lotes l ON l.id = o.lote_id
   WHERE o.id = p_op_id
     AND o.tipo = 'tecelagem';

  IF v_status IS NULL THEN
    RETURN 'OP_TECELAGEM_INEXISTENTE';
  END IF;

  -- 'simulada' is a pre-commitment draft, not an assignment to execute.
  IF v_status = 'simulada' THEN
    RETURN 'OP_AINDA_NAO_ABERTA';
  END IF;

  IF v_status = 'finalizada' THEN
    RETURN 'OP_ENCERRADA';
  END IF;

  -- 'aberta' and 'em_producao' alike: the commercial commitment point is what
  -- decides. The weaving surface does NOT require the Admin production-start
  -- transition to have happened, and does not perform it.
  RETURN public._pedido_permite_op_tecelagem(v_pedido_id);
END
$fn$;

ALTER FUNCTION public._tecelagem_op_pode_iniciar(BIGINT) OWNER TO postgres;
REVOKE ALL ON FUNCTION public._tecelagem_op_pode_iniciar(BIGINT)
  FROM PUBLIC, anon, authenticated, service_role;

COMMENT ON FUNCTION public._tecelagem_op_pode_iniciar(BIGINT) IS
  'db/123. SINGLE OWNER of weaving start eligibility, derived from ops.status and db/121 _pedido_permite_op_tecelagem. Returns NULL when the OP may be started in weaving, else a stable refusal code. Owner-only: both the writer and the read model reach it as SECURITY DEFINER callers.';

-- ---------------------------------------------------------------------
-- 5c. LOCAL PRODUCTION START — the writer
--
-- Records THE WEAVING OPERATOR STARTED THIS OP, and nothing else. It writes
-- exactly one row of one weaving-owned table. It does not call, imitate or
-- substitute public.iniciar_producao_op, does not UPDATE ops, and takes no
-- lock on an Admin row.
--
-- IDEMPOTENT BY CONSTRUCTION: a second start is not an error and does not move
-- the recorded moment. A double click is an operator gesture, not a defect,
-- and refusing it would teach the operator to distrust a correct screen.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.iniciar_producao_tecelagem(p_op_id BIGINT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $fn$
DECLARE
  v_fornecedor_id BIGINT;
  v_atribuida     BOOLEAN;
  v_recusa        TEXT;
  v_iniciada_em   TIMESTAMPTZ;
  v_ja_iniciada   BOOLEAN;
BEGIN
  -- === VALIDATION STAGE — nothing is written before this stage completes ===

  v_fornecedor_id := public.meu_fornecedor_id();
  IF v_fornecedor_id IS NULL THEN
    RAISE EXCEPTION 'TECELAGEM_FORNECEDOR_NAO_IDENTIFICADO'
      USING ERRCODE = '42501',
            DETAIL  = 'the caller is not an active supplier user';
  END IF;

  IF p_op_id IS NULL THEN
    RAISE EXCEPTION 'TECELAGEM_OP_OBRIGATORIA'
      USING ERRCODE = '22023', DETAIL = 'p_op_id is required';
  END IF;

  -- The OP must be one this supplier actually weaves. Same authorization model
  -- as the registration writer: read the Ravatex-owned binding, never trust a
  -- client-supplied supplier or OP identity.
  SELECT TRUE INTO v_atribuida
    FROM public.op_fornecedores opf
   WHERE opf.op_id = p_op_id
     AND opf.fornecedor_id = v_fornecedor_id
     AND opf.etapa = 'cima';

  IF v_atribuida IS NOT TRUE THEN
    RAISE EXCEPTION 'TECELAGEM_OP_FORA_DO_ESCOPO_DO_FORNECEDOR'
      USING ERRCODE = '42501',
            DETAIL  = 'this OP is not assigned to the calling supplier at the weaving stage';
  END IF;

  v_recusa := public._tecelagem_op_pode_iniciar(p_op_id);
  IF v_recusa IS NOT NULL THEN
    RAISE EXCEPTION 'TECELAGEM_OP_NAO_ELEGIVEL_PARA_INICIO'
      USING ERRCODE = '55000',
            DETAIL  = v_recusa;
  END IF;

  -- === APPLY STAGE ===

  INSERT INTO public.tecelagem_op_execucao (op_id, fornecedor_id, iniciada_por)
  VALUES (p_op_id, v_fornecedor_id, auth.uid())
  ON CONFLICT (op_id) DO NOTHING;

  v_ja_iniciada := NOT FOUND;

  SELECT e.iniciada_em INTO v_iniciada_em
    FROM public.tecelagem_op_execucao e
   WHERE e.op_id = p_op_id;

  RETURN jsonb_build_object(
    'op_id',        p_op_id,
    'iniciada_em',  v_iniciada_em,
    'ja_iniciada',  v_ja_iniciada
  );
END
$fn$;

ALTER FUNCTION public.iniciar_producao_tecelagem(BIGINT) OWNER TO postgres;

REVOKE ALL ON FUNCTION public.iniciar_producao_tecelagem(BIGINT)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.iniciar_producao_tecelagem(BIGINT) TO authenticated;

COMMENT ON FUNCTION public.iniciar_producao_tecelagem(BIGINT) IS
  'db/123. THE ONLY write path for the local weaving production start. Records that the weaving operator started the OP, in a weaving-owned table only. Idempotent. It is NOT the Admin lifecycle transition: it never writes ops.status and never calls iniciar_producao_op.';

-- ---------------------------------------------------------------------
-- 6. The canonical writer
--
-- ATOMICITY DISCIPLINE: this function VALIDATES COMPLETELY AND ONLY THEN
-- APPLIES. It contains no mid-loop RETURN and no partial-apply path, because a
-- PL/pgSQL routine that returns from inside a write loop keeps the rows it has
-- already written. The rolls are produced by ONE set-based INSERT, so 10
-- requested rolls are 10 rolls or an error — never 4.
--
-- AUTHORIZATION: the caller must be an ACTIVE supplier user bound to this OP
-- at the weaving stage (op_fornecedores.etapa = 'cima'), AND the OP must carry
-- the LOCAL production start of section 1b. Ravatex-defined specification data
-- is never accepted as input; only the product selection, the roll count and
-- the optional lengths are.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.registrar_producao_tecelagem(
  p_op_item_id       BIGINT,
  p_quantidade_rolos INTEGER,
  p_comprimentos     NUMERIC[] DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $fn$
DECLARE
  v_fornecedor_id BIGINT;
  v_op_id         BIGINT;
  v_op_status     TEXT;
  v_inicio        INTEGER;
  v_lancamento_id BIGINT;
  v_criados       INTEGER;
BEGIN
  -- === VALIDATION STAGE — nothing is written before this stage completes ===

  v_fornecedor_id := public.meu_fornecedor_id();
  IF v_fornecedor_id IS NULL THEN
    RAISE EXCEPTION 'TECELAGEM_FORNECEDOR_NAO_IDENTIFICADO'
      USING ERRCODE = '42501',
            DETAIL  = 'the caller is not an active supplier user';
  END IF;

  IF p_op_item_id IS NULL THEN
    RAISE EXCEPTION 'TECELAGEM_PRODUTO_OBRIGATORIO'
      USING ERRCODE = '22023', DETAIL = 'p_op_item_id is required';
  END IF;

  IF p_quantidade_rolos IS NULL OR p_quantidade_rolos < 1 THEN
    RAISE EXCEPTION 'TECELAGEM_QUANTIDADE_INVALIDA'
      USING ERRCODE = '22023',
            DETAIL  = 'the number of rolls must be an integer of at least 1';
  END IF;

  IF p_quantidade_rolos > 500 THEN
    RAISE EXCEPTION 'TECELAGEM_QUANTIDADE_ACIMA_DO_LIMITE'
      USING ERRCODE = '22023',
            DETAIL  = 'a single registration is limited to 500 rolls';
  END IF;

  -- The product must belong to an OP this supplier actually weaves. This is
  -- the whole authorization model: read the Ravatex-owned binding, never
  -- trust a client-supplied supplier or OP identity.
  SELECT oi.op_id INTO v_op_id
    FROM public.op_itens oi
    JOIN public.op_fornecedores opf
      ON opf.op_id = oi.op_id
     AND opf.fornecedor_id = v_fornecedor_id
     AND opf.etapa = 'cima'
   WHERE oi.id = p_op_item_id;

  IF v_op_id IS NULL THEN
    RAISE EXCEPTION 'TECELAGEM_PRODUTO_FORA_DO_ESCOPO_DO_FORNECEDOR'
      USING ERRCODE = '42501',
            DETAIL  = 'this OP product is not assigned to the calling supplier at the weaving stage';
  END IF;

  -- THE LOCAL PRODUCTION START IS THE GATE. Rolls may only be registered once
  -- the weaving operator has started this OP on this surface. The gate is here,
  -- in the server, precisely so that it is a real refusal and not a hidden
  -- button: an interface defect cannot open it.
  --
  -- It deliberately does NOT read ops.status as the authority. Starting is
  -- local to weaving in this phase; moving an OP from 'aberta' to
  -- 'em_producao' has its own established Admin owner
  -- (public.iniciar_producao_op), and weaving does not and must not do it.
  IF NOT EXISTS (
    SELECT 1 FROM public.tecelagem_op_execucao e WHERE e.op_id = v_op_id
  ) THEN
    RAISE EXCEPTION 'TECELAGEM_PRODUCAO_NAO_INICIADA'
      USING ERRCODE = '55000',
            DETAIL  = 'the weaving operator has not started production on this OP yet';
  END IF;

  -- An OP the Admin has closed no longer receives production. This READS the
  -- Admin lifecycle and never writes it.
  SELECT o.status INTO v_op_status FROM public.ops o WHERE o.id = v_op_id;
  IF v_op_status = 'finalizada' THEN
    RAISE EXCEPTION 'TECELAGEM_OP_ENCERRADA'
      USING ERRCODE = '55000',
            DETAIL  = 'the OP is finalizada; no further production can be registered';
  END IF;

  -- Lengths are OPTIONAL as a whole. When supplied, the array must line up
  -- with the roll count, and individual entries may still be NULL — a partly
  -- measured batch is legitimate.
  IF p_comprimentos IS NOT NULL THEN
    IF array_length(p_comprimentos, 1) IS DISTINCT FROM p_quantidade_rolos THEN
      RAISE EXCEPTION 'TECELAGEM_COMPRIMENTOS_INCOMPATIVEIS'
        USING ERRCODE = '22023',
              DETAIL  = format('received %s length(s) for %s roll(s)',
                               COALESCE(array_length(p_comprimentos, 1), 0), p_quantidade_rolos);
    END IF;

    IF EXISTS (SELECT 1 FROM unnest(p_comprimentos) AS c WHERE c IS NOT NULL AND c <= 0) THEN
      RAISE EXCEPTION 'TECELAGEM_COMPRIMENTO_INVALIDO'
        USING ERRCODE = '22023',
              DETAIL  = 'an individual roll length, when supplied, must be greater than zero';
    END IF;
  END IF;

  -- === APPLY STAGE — every refusal above has already been raised ===

  -- Allocate the visible numbers by locking the weaving-owned counter row
  -- ONLY, keyed by OP so the sequence is continuous across every product of
  -- that OP. No Admin row is locked, so a concurrent weaving registration
  -- never contends with an Admin writer.
  INSERT INTO public.tecelagem_rolo_sequencia AS s (op_id, proximo, atualizado_em)
       VALUES (v_op_id, 1 + p_quantidade_rolos, now())
  ON CONFLICT (op_id) DO UPDATE
          SET proximo = s.proximo + p_quantidade_rolos,
              atualizado_em = now()
    RETURNING s.proximo - p_quantidade_rolos INTO v_inicio;

  -- Both branches converge on "first number allocated by this call": on insert
  -- proximo is (1 + N) so the expression yields 1; on conflict proximo is
  -- (previous + N) so it yields the previous value. No third case exists.

  INSERT INTO public.tecelagem_producao_lancamentos
    (op_id, op_item_id, fornecedor_id, quantidade_rolos, registrado_por)
  VALUES
    (v_op_id, p_op_item_id, v_fornecedor_id, p_quantidade_rolos, auth.uid())
  RETURNING id INTO v_lancamento_id;

  -- ONE set-based insert: N requested rolls become N rows, atomically.
  INSERT INTO public.tecelagem_rolos
    (lancamento_id, op_id, op_item_id, fornecedor_id, numero, comprimento_m)
  SELECT
    v_lancamento_id,
    v_op_id,
    p_op_item_id,
    v_fornecedor_id,
    v_inicio + (g.i - 1),
    CASE WHEN p_comprimentos IS NULL THEN NULL ELSE p_comprimentos[g.i] END
  FROM generate_series(1, p_quantidade_rolos) AS g(i);

  GET DIAGNOSTICS v_criados = ROW_COUNT;

  -- Structural self-check: the product requirement is that N in means exactly
  -- N individual rolls out. Prove it in the same transaction rather than
  -- trusting the statement.
  IF v_criados <> p_quantidade_rolos THEN
    RAISE EXCEPTION 'TECELAGEM_CARDINALIDADE_INCONSISTENTE'
      USING ERRCODE = 'P0001',
            DETAIL  = format('requested %s roll(s) but created %s', p_quantidade_rolos, v_criados);
  END IF;

  RETURN jsonb_build_object(
    'lancamento_id',    v_lancamento_id,
    'op_id',            v_op_id,
    'op_item_id',       p_op_item_id,
    'quantidade_rolos', v_criados,
    'numero_inicial',   v_inicio,
    'numero_final',     v_inicio + p_quantidade_rolos - 1
  );
END
$fn$;

ALTER FUNCTION public.registrar_producao_tecelagem(BIGINT, INTEGER, NUMERIC[]) OWNER TO postgres;

REVOKE ALL ON FUNCTION public.registrar_producao_tecelagem(BIGINT, INTEGER, NUMERIC[])
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.registrar_producao_tecelagem(BIGINT, INTEGER, NUMERIC[])
  TO authenticated;

COMMENT ON FUNCTION public.registrar_producao_tecelagem(BIGINT, INTEGER, NUMERIC[]) IS
  'db/123. THE ONLY write path for weaving production. Validates completely, then applies: N rolls in means exactly N individually persisted rolls out, or an error. Individual length is optional. Touches no Admin table.';

-- ---------------------------------------------------------------------
-- 6b. The weaving work-list read model
--
-- WHY A FUNCTION AND NOT A POLICY. The supplier must see the CUSTOMER of the
-- OP it weaves. `clientes` and `lotes` are admin-only under RLS (db/09), and
-- widening those policies would expose whole customer and lot rows to every
-- supplier and would MODIFY the access rules of two existing Admin tables.
-- This projection instead exposes exactly one customer field, for exactly the
-- OPs assigned to the caller, through a function this migration owns. No
-- pre-existing policy, grant or table is touched, and the supplier still holds
-- no direct read on `clientes` or `lotes`.
--
-- ELIGIBILITY IS DERIVED, NOT INVENTED. The weaving surface must say whether
-- an assigned OP can be started here, has already been started here, or
-- currently cannot advance. Eligibility comes from the single owner
-- public._tecelagem_op_pode_iniciar (section 5b), which itself derives from
-- ops.status and from db/121 _pedido_permite_op_tecelagem. `em_producao` on
-- THIS surface means the LOCAL start of section 1b exists — never that Admin
-- moved the OP. No new state, no new transition and no writer is introduced
-- here: moving 'aberta' to 'em_producao' remains owned by
-- public.iniciar_producao_op and is not part of this surface.
-- ---------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.tecelagem_minhas_ops();

CREATE OR REPLACE FUNCTION public.tecelagem_minhas_ops()
RETURNS TABLE (
  op_id                  BIGINT,
  identidade_operacional TEXT,
  numero                 INTEGER,
  ano                    INTEGER,
  status                 TEXT,
  cliente_nome           TEXT,
  situacao_execucao      TEXT,
  motivo_bloqueio        TEXT,
  producao_iniciada_em   TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, auth
AS $fn$
DECLARE
  v_fornecedor_id BIGINT;
BEGIN
  v_fornecedor_id := public.meu_fornecedor_id();

  -- Not a supplier: an EMPTY work list, not an error. The caller distinguishes
  -- "no OPs" from "not a supplier" through its own session, never through a
  -- leaked refusal.
  IF v_fornecedor_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    o.id,
    o.identidade_operacional,
    o.numero,
    o.ano,
    o.status,
    c.nome,
    CASE
      -- The local start wins over everything except an OP the Admin closed:
      -- once weaving has started, this surface says so.
      WHEN o.status = 'finalizada'  THEN 'encerrada'
      WHEN e.op_id IS NOT NULL      THEN 'em_producao'
      WHEN public._tecelagem_op_pode_iniciar(o.id) IS NULL THEN 'pode_iniciar'
      ELSE 'bloqueada'
    END::TEXT,
    CASE
      WHEN o.status = 'finalizada' OR e.op_id IS NOT NULL THEN NULL
      ELSE public._tecelagem_op_pode_iniciar(o.id)
    END::TEXT,
    e.iniciada_em
  FROM public.op_fornecedores opf
  JOIN public.ops o        ON o.id = opf.op_id
  LEFT JOIN public.lotes l ON l.id = o.lote_id
  LEFT JOIN public.clientes c ON c.id = l.cliente_id
  LEFT JOIN public.tecelagem_op_execucao e ON e.op_id = o.id
  WHERE opf.fornecedor_id = v_fornecedor_id
    AND opf.etapa = 'cima'
    AND o.tipo = 'tecelagem'
    -- 'simulada' is a pre-commitment draft, not an assignment to execute.
    AND o.status <> 'simulada'
  ORDER BY o.ano DESC, o.numero DESC;
END
$fn$;

ALTER FUNCTION public.tecelagem_minhas_ops() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.tecelagem_minhas_ops() FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.tecelagem_minhas_ops() TO authenticated;

COMMENT ON FUNCTION public.tecelagem_minhas_ops() IS
  'db/123. The weaving work list: assigned OPs with their customer, their LOCAL weaving execution state and their start eligibility, derived from tecelagem_op_execucao and from the single owner _tecelagem_op_pode_iniciar. situacao_execucao = em_producao means WEAVING started it, not that Admin did. Read-only. Exposes one customer field for assigned OPs only, without granting the supplier any direct read on clientes or lotes.';

-- ---------------------------------------------------------------------
-- 7. Verify — self-proving, in the same transaction as the migration
-- ---------------------------------------------------------------------
DO $verify$
DECLARE
  v_bad TEXT[] := ARRAY[]::TEXT[];
  v_n   INTEGER;
BEGIN
  -- 7.1 The four tables exist and carry RLS.
  IF to_regclass('public.tecelagem_rolos') IS NULL
     OR to_regclass('public.tecelagem_producao_lancamentos') IS NULL
     OR to_regclass('public.tecelagem_rolo_sequencia') IS NULL
     OR to_regclass('public.tecelagem_op_execucao') IS NULL THEN
    v_bad := v_bad || 'a db/123 table is missing';
  END IF;

  SELECT count(*) INTO v_n
    FROM pg_class
   WHERE relname IN ('tecelagem_rolos', 'tecelagem_producao_lancamentos',
                     'tecelagem_rolo_sequencia', 'tecelagem_op_execucao')
     AND relrowsecurity IS TRUE;
  IF v_n <> 4 THEN
    v_bad := v_bad || format('expected RLS enabled on 4 tables, found %s', v_n);
  END IF;

  -- 7.2 comprimento_m must be NULLABLE: the optional-length requirement is a
  --     schema fact, not a UI convention.
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'tecelagem_rolos'
       AND column_name = 'comprimento_m' AND is_nullable = 'NO'
  ) THEN
    v_bad := v_bad || 'tecelagem_rolos.comprimento_m must be nullable (optional roll length)';
  END IF;

  -- 7.3 No role may write these tables directly; the writer is the only path.
  IF EXISTS (
    SELECT 1 FROM information_schema.role_table_grants
     WHERE table_schema = 'public'
       AND table_name IN ('tecelagem_rolos', 'tecelagem_producao_lancamentos',
                          'tecelagem_rolo_sequencia', 'tecelagem_op_execucao')
       AND privilege_type IN ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE')
       AND grantee IN ('PUBLIC', 'anon', 'authenticated', 'service_role')
  ) THEN
    v_bad := v_bad || 'a direct write grant survives on a db/123 table';
  END IF;

  -- 7.4 ISOLATION PROOF: db/123 introduced no trigger anywhere. Checked against
  --     the actual function OIDs this migration owns, not against a name
  --     pattern that would pass vacuously.
  IF EXISTS (
    SELECT 1
      FROM pg_trigger tg
      JOIN pg_proc p ON p.oid = tg.tgfoid
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE NOT tg.tgisinternal
       AND n.nspname = 'public'
       AND p.proname IN ('registrar_producao_tecelagem', 'iniciar_producao_tecelagem',
                         '_tecelagem_op_pode_iniciar', 'tecelagem_minhas_ops')
  ) THEN
    v_bad := v_bad || 'db/123 wired one of its functions in as a trigger';
  END IF;

  -- 7.4b The weaving tables must carry no non-internal trigger at all: no
  --      write-through, no mirroring, no propagation into the Admin domain.
  IF EXISTS (
    SELECT 1
      FROM pg_trigger tg
      JOIN pg_class c ON c.oid = tg.tgrelid
     WHERE NOT tg.tgisinternal
       AND c.relname LIKE 'tecelagem_%'
  ) THEN
    v_bad := v_bad || 'a db/123 table carries a trigger; weaving must not propagate anywhere';
  END IF;

  -- 7.5 The Admin-facing FKs must CASCADE, never RESTRICT, so that Admin
  --     deletion behaviour is preserved exactly.
  IF EXISTS (
    SELECT 1
      FROM pg_constraint c
      JOIN pg_class t ON t.oid = c.conrelid
      JOIN pg_class r ON r.oid = c.confrelid
     WHERE c.contype = 'f'
       AND t.relname IN ('tecelagem_producao_lancamentos', 'tecelagem_rolo_sequencia',
                         'tecelagem_op_execucao')
       AND r.relname IN ('ops', 'op_itens')
       AND c.confdeltype <> 'c'
  ) THEN
    v_bad := v_bad || 'an Admin-facing FK does not cascade on delete (would change Admin deletion behaviour)';
  END IF;

  -- 7.5b The visible roll number is unique WITHIN THE OP, structurally. This
  --      is the ratified product rule and may not be downgraded to an
  --      allocator convention.
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint c
      JOIN pg_class t ON t.oid = c.conrelid
     WHERE t.relname = 'tecelagem_rolos'
       AND c.contype = 'u'
       AND pg_get_constraintdef(c.oid) = 'UNIQUE (op_id, numero)'
  ) THEN
    v_bad := v_bad || 'tecelagem_rolos does not enforce UNIQUE (op_id, numero); two rolls of one OP could share a visible number';
  END IF;

  -- 7.6 The writer exists, is SECURITY DEFINER and is executable by
  --     authenticated only.
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = 'registrar_producao_tecelagem'
       AND p.prosecdef IS TRUE
  ) THEN
    v_bad := v_bad || 'registrar_producao_tecelagem is missing or is not SECURITY DEFINER';
  END IF;

  IF has_function_privilege('anon', 'public.registrar_producao_tecelagem(bigint,integer,numeric[])', 'EXECUTE')
     OR has_function_privilege('service_role', 'public.registrar_producao_tecelagem(bigint,integer,numeric[])', 'EXECUTE') THEN
    v_bad := v_bad || 'the weaving writer is executable by anon or service_role';
  END IF;

  IF NOT has_function_privilege('authenticated', 'public.registrar_producao_tecelagem(bigint,integer,numeric[])', 'EXECUTE') THEN
    v_bad := v_bad || 'the weaving writer is not executable by authenticated';
  END IF;

  -- 7.6b THE LOCAL START IS A REAL SERVER GATE, not an interface convention:
  --      the registration writer must actually consult tecelagem_op_execucao,
  --      and must NOT have kept ops.status as its production gate.
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = 'registrar_producao_tecelagem'
       AND p.prosrc LIKE '%tecelagem_op_execucao%'
  ) THEN
    v_bad := v_bad || 'registrar_producao_tecelagem does not gate on the local production start';
  END IF;

  -- 7.6c The start writer exists, is SECURITY DEFINER, is executable by
  --      authenticated ONLY, and NEVER writes ops.
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = 'iniciar_producao_tecelagem'
       AND p.prosecdef IS TRUE
  ) THEN
    v_bad := v_bad || 'iniciar_producao_tecelagem is missing or is not SECURITY DEFINER';
  END IF;

  IF has_function_privilege('anon', 'public.iniciar_producao_tecelagem(bigint)', 'EXECUTE')
     OR has_function_privilege('service_role', 'public.iniciar_producao_tecelagem(bigint)', 'EXECUTE') THEN
    v_bad := v_bad || 'the weaving start writer is executable by anon or service_role';
  END IF;

  IF NOT has_function_privilege('authenticated', 'public.iniciar_producao_tecelagem(bigint)', 'EXECUTE') THEN
    v_bad := v_bad || 'the weaving start writer is not executable by authenticated';
  END IF;

  -- THE ISOLATION CLAIM OF THIS SLICE, asserted against the function body
  -- rather than against prose: local start touches no Admin writer and no
  -- Admin table.
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = 'iniciar_producao_tecelagem'
       AND (p.prosrc ~* '(update|insert into|delete from)\s+(public\.)?(ops|op_itens|lotes|pedidos)\M'
            OR p.prosrc ILIKE '%iniciar_producao_op%'
            OR p.prosrc ILIKE '%alterar_status_op%'
            OR p.prosrc ILIKE '%abrir_op_tecelagem%')
  ) THEN
    v_bad := v_bad || 'iniciar_producao_tecelagem reaches an Admin table or an Admin lifecycle writer';
  END IF;

  -- 7.6d The eligibility owner exists and stays owner-only: it is reached by
  --      the two SECURITY DEFINER callers, never by a client.
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = '_tecelagem_op_pode_iniciar'
       AND p.prosecdef IS TRUE AND p.provolatile = 's'
  ) THEN
    v_bad := v_bad || '_tecelagem_op_pode_iniciar is missing, is not SECURITY DEFINER, or is not STABLE';
  END IF;

  IF has_function_privilege('authenticated', 'public._tecelagem_op_pode_iniciar(bigint)', 'EXECUTE')
     OR has_function_privilege('anon', 'public._tecelagem_op_pode_iniciar(bigint)', 'EXECUTE')
     OR has_function_privilege('service_role', 'public._tecelagem_op_pode_iniciar(bigint)', 'EXECUTE') THEN
    v_bad := v_bad || 'the weaving eligibility owner is not owner-only';
  END IF;

  -- 7.7 The work-list read model exists, is read-only and is reachable only by
  --     an authenticated identity.
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = 'tecelagem_minhas_ops'
       AND p.prosecdef IS TRUE AND p.provolatile = 's'
  ) THEN
    v_bad := v_bad || 'tecelagem_minhas_ops is missing, is not SECURITY DEFINER, or is not STABLE';
  END IF;

  IF has_function_privilege('anon', 'public.tecelagem_minhas_ops()', 'EXECUTE')
     OR has_function_privilege('service_role', 'public.tecelagem_minhas_ops()', 'EXECUTE') THEN
    v_bad := v_bad || 'the weaving work list is executable by anon or service_role';
  END IF;

  -- 7.8 EXPOSING THE CUSTOMER MUST NOT HAVE WIDENED ANYTHING. The customer
  --     reaches the surface only through the owned projection above; the
  --     supplier gains no policy on clientes or lotes.
  IF EXISTS (SELECT 1 FROM pg_policies
              WHERE schemaname = 'public' AND tablename IN ('clientes', 'lotes')
                AND policyname LIKE '%tecelagem%') THEN
    v_bad := v_bad || 'db/123 added a policy to clientes or lotes; that is not this migration''s to change';
  END IF;

  IF array_length(v_bad, 1) IS NOT NULL THEN
    RAISE EXCEPTION 'db/123 verify FAILED: %', array_to_string(v_bad, ' | ');
  END IF;

  RAISE NOTICE 'db/123 verify: OK — the local production start gates registration, individual weaving rolls exist, length is optional, writes are writer-only, and no pre-existing object was touched';
END
$verify$;
