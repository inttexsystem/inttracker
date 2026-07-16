# Supervision Protocol — Ravatex Controle de Tapetes

> Recorded on 2026-07-15 (phase `CAMADA2-USUARIOS-A3-2-CLOSEOUT`), from
> the governance reconciliation of `G28-RECONCILIATION-DECISIONS-A`
> (see `PROJECT_STATE.md`), which had already transferred progress
> tracking to Claude (chat) + Claude Code (resident) and reduced
> ChatGPT to a consultant without state custody.
> This document formalizes the roles and the order format for any
> reviewer (human or AI) that participates in the supervision of the project.
> **It is not a source of state.** Operational state lives in `PROJECT_STATE.md`;
> continuity in `AGENT_HANDOFF.md`; history in per-front ledgers.

---

## 1. Roles

### ARCHITECT

- The only one who **decides, authorizes, validates and accepts**.
- Issues orders with explicit authorization per subphase.
- Executes manual visual validation when new UI is involved.
- Decides micro-decisions blocked by HARD STOP (e.g.: need for a
  migration).

### REVIEWER

- Reviews reports, drafts orders, helps formulate decisions.
- **Replaceable** — any reviewer (ChatGPT, another chat, another
  model) can occupy this role.
- **Never holds state custody.** A statement by the reviewer about the
  project does not become fact until it is verified and recorded by the resident
  executor in the canonical files.
- In case of doubt about the real state, must request verification in the
  code/repository from the resident executor — never infer from conversation
  memory or from unconfirmed documentation.

### RESIDENT EXECUTOR

- (Claude Code, Codex or equivalent with direct access to the repository.)
- Executes what was authorized, within the exact scope of the order.
- Runs tests, validates syntax, confirms the file manifest before
  committing.
- Updates the canonical documents (`PROJECT_STATE.md`,
  `AGENT_HANDOFF.md`, ledgers) at the closeout of each phase.
- Reports technical quality, repository inspection and test result — the reviewer
  does not assume this information without such
  verification.

## 2. Onboarding of a new reviewer

Before opining on state, backlog or next action, a new reviewer
(or a new session of an existing reviewer) must read, in this
order:

1. `AGENT_HANDOFF.md` — continuity and mandatory paths.
2. `PROJECT_STATE.md` — current operational state per front.
3. The plan/spec of the active front (e.g.: `docs/architecture/CAMADA2_USUARIOS_SPEC_PROPOSED.md`
   for `G28-CAMADA-2`).
4. The front ledger (e.g.: `docs/ledgers/G28_LEDGER.md`).

Nothing a reviewer says about the state of the project becomes state
until it passes through the canonical documents, updated by the resident
executor after real verification.

## 3. Order format

Every order issued to the resident executor must contain:

- **Configuration block:** model, effort, reason for the choice (and
  criterion for when to escalate effort/model).
- **Phase:** identifier of the subphase, type (pure refactor / additive
  feature / docs-only / read-only diagnostic).
- **Scope:** what to do, item by item.
- **Allowed files:** explicit list — nothing outside it without stopping
  and reporting.
- **Prohibitions:** what not to do (e.g.: no new write, no Auth, no
  push).
- **Tests:** minimum gate required before the report.
- **Hard stops:** conditions that require stopping and reporting instead of
  deciding alone (e.g.: need for a migration, coupling that
  requires touching a file outside the manifest, ambiguity between spec and
  real code).
- **Mandatory report:** expected format of the response. Every
  implementation phase (not docs-only) includes its own section `STRUCTURAL POLICY
  COMPLIANCE`: applicable rules of `docs/architecture/CODE_HEALTH_RULES.md`
  cited by number, evidence of conformance item by item and size in
  lines of each touched file (new or modified).
- **Language:** architect orders may be issued in Portuguese; once recorded in
  canonical documents they are recorded in English, with the original wording
  preserved in the ledger or archive.

**Authorization is explicit per subphase — phases do not chain
automatically.** An order covers exclusively what it authorizes.

## 4. Gates

- **Architect visual validation** is mandatory for any new or altered
  UI — the executor's report stops at
  `IMPLEMENTAÇÃO VALIDADA / AGUARDANDO VALIDAÇÃO VISUAL DO ARQUITETO`
  and only closes after the explicit OK.
- **Approved mockup** is a prerequisite before implementing a new visual
  element (not merely a data adjustment over an already existing element).
- **Migration is its own gate.** The need for new schema interrupts
  the current subphase; the migration itself requires separate authorization,
  even if the subphase that revealed it is already authorized.
- **Auth is a separate risk.** Any change that touches
  new `auth.admin.*` or Auth configuration of the Supabase project is
  classified and reported separately from ordinary schema/RPC/Edge
  (see `docs/architecture/CAMADA2_USUARIOS_SPEC_PROPOSED.md`, Auth risk
  table).

---

> In conflict with any canonical document listed in
> `docs/DOCUMENTATION_INDEX.md` §1, the canonical prevails — this
> protocol governs the supervision process, not the state of the project.

---

## Appendix — Supervision handoff — standard block

Generic block, without immediate context, to open any new session of
reviewer/supervisor (human or AI). Recorded by the architect on 2026-07-15;
translated to English in `DOC-LANGUAGE-MIGRATION-L2` (the original Portuguese is
preserved in `docs/archive/pt-BR/`).

```text
SUPERVISION HANDOFF — RAVATEX CONTROLE DE TAPETES

DESIGNATED ROLE: REVIEWER/SUPERVISOR per
docs/governance/SUPERVISION_PROTOCOL.md. You are NOT the executor
in this session. You do NOT hold state custody: everything you
propose exists only once recorded in the canonical documents by an
executed order.

GET UP TO SPEED NOW, IN THIS ORDER:
  1. PROJECT_STATE.md — current state (sole owner of the
     operational state)
  2. AGENT_HANDOFF.md — continuity and last accepted phase
  3. docs/governance/SUPERVISION_PROTOCOL.md — roles, order
     format, gates
  4. The other canonical documents listed in CLAUDE.md, as needed

SUPERVISION RULES:
  - Orders you draft follow the protocol format
    (model/effort configuration, scope, allowed
    files, hard stops, report)
  - No phase chains; each subphase requires explicit
    authorization from the architect (me)
  - Do not claim reading/execution/verification you did not actually do
  - Divergence between your conclusion and the canonical documents:
    the canonical documents win; cite and ask, never correct silently

MANDATORY FIRST RESPONSE: active phase, last accepted phase,
next authorizable action and pending architect decisions —
extracted from the canonical documents, with the path cited. No
recommendation before that.
```
