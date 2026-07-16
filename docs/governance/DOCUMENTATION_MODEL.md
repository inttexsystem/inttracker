# Documentation Model — Ravatex Controle de Tapetes

> **Phase:** `G28-DOCS-B1` — permanent documentary governance contract
> (additive; no migration, no compaction, no file movement).
> **Status:** `AUTHORIZED` for reference; concrete migration of
> states/handoffs/ledgers in later slices.
> **Workspace:** `D:\OneDrive\Programação\Ravatex\controle-tapetes-g28`
> **Branch:** `work/g28-document-qualification`
> **Last update:** `2026-07-12`

This document is the **permanent contract of ownership, authority and
update** of the project's documentation. It governs **how** each
category of document must be written, who owns what, what belongs
to which file and what must be derived from another source
(Git, environment, Supabase) instead of copied as prose.

When other project documents (plans, states, handoffs, legacy
indexes) need to decide **who owns** a fact, **how** they
must be updated or **when** they become obsolete, this contract
prevails. In case of conflict, this model takes priority over
any other process description, except when explicitly
revised in an authorized phase and recorded in `docs/DOCUMENTATION_INDEX.md`.

---

## 1. Central principle

**Each fact has exactly one documentary owner. The remaining
files reference the owner; they do not copy the fact.**

Direct consequences:

- There is no "canonical snapshot" in more than one place for the same
  fact. Where duplication seems to exist, the secondary source is only
  a **reference** (link) to the primary source.
- Documents that consider themselves a "source" of something outside their scope
  lose that authority when migrated to the model. Competing
  lists of "canonical sources" existing today are treated
  as **legacy to reconcile** in future slices (see §13).
- Derived facts (HEAD, working tree, staging, divergence,
  environment status, apply evidence) **are not copied in
  Markdown** as permanent state: they are obtained from their living
  sources (Git, environment) or recorded as a historical event
  (ledger).

---

## 2. Role tree

| Role | File | Fact it owns |
|---|---|---|
| **Documentary arbiter** | `docs/DOCUMENTATION_INDEX.md` | Order of authority, document classification, canonical paths, legacy mapping, responsibility by category. |
| **Permanent state per front** | `PROJECT_STATE.md` (root) and `services/*/PROJECT_STATE.md` (when applicable) | Current operational state of each front (phase, next action, blocker, context links). |
| **Active operational handoff** | `AGENT_HANDOFF.md` (root) | Continuity of the next session: immediate objective, mandatory files, constraints, links. |
| **Historical ledger (append-only)** | `docs/refactor/ARCHITECTURE_REFACTOR_LEDGER.md` (refactor) and front-specific ledgers (to be created) | Auditable history of closed phases, accepted commits, tests, residual risk and next phase. |
| **Architectural plan** | `docs/architecture/PLANO_*.md` | Target architecture, requirements, permanent decisions, dependencies, planned phases, acceptance criteria, backlog. |
| **Domain / API contract** | `docs/architecture/*_CONTRACT.md` and `services/documents-ingestor/contracts/*` | Technical contract of an area (schema, RLS, RPCs, events, JSON schemas). |
| **Visual contract** | `docs/architecture/UI_VISUAL_CONTRACT.md` | Versioned visual rules. |
| **Architectural health / modularization contract** | `docs/architecture/CODE_HEALTH_RULES.md` | 19 binding rules covering modularization, file structure, responsibility limits per module/screen, what `index.html` can and cannot contain, and language (§19). Every new phase must respect it. |
| **Operational runbook** | `docs/operations/*` | How to execute already approved procedures. |
| **Documentary governance** | `docs/governance/DOCUMENTATION_MODEL.md` (this file) | Rules of how the documentation is organized and updated. |

These roles **do not overlap**. A single file may exercise
more than one role **only** if the boundary is explicitly
declared in the file itself and maintained in the `DOCUMENTATION_INDEX`.

---

## 3. Documentary arbiter — `docs/DOCUMENTATION_INDEX.md`

`docs/DOCUMENTATION_INDEX.md` is the **only source** for:

- order of documentary authority;
- document classification (canonical, operational, contract,
  runbook, legacy, diagnostic, governance);
- canonical paths of project files;
- mapping of legacy documents (`docs/superpowers/`,
  `docs/qa/`, `docs/DEPLOYMENT.md`, etc.);
- responsibility of each category (who owns which fact).

`docs/DOCUMENTATION_INDEX.md` is **not** a source of:

- current phase;
- next action;
- current HEAD;
- working tree;
- operational status;
- closeout history;
- chronological phase progress.

These lists of "canonical sources" present today in other files
(for example, the order of precedence enumerated in legacy files)
**are not altered in this slice** (G28-DOCS-B1). They will be
replaced by a reference to the index in future slices, per
§13.

---

## 4. Permanent state — `PROJECT_STATE.md`

`PROJECT_STATE.md` (root) will in the future be the **only source** of
current state per front of the monorepo. Each front, in its block
inside `PROJECT_STATE.md`, will contain only:

- name of the front;
- workspace;
- branch;
- allowed remote;
- last accepted phase;
- current phase;
- next action;
- blocker or debt that affects continuity;
- links to plan, ledger and component context.

`PROJECT_STATE.md` will **not** contain:

- current HEAD as prose (except as a transitory reference during
  the acceptance slice — see §9);
- working tree;
- staging;
- Git divergence;
- stacks of closeouts;
- full reports (execution logs, complete diffs,
  test history);
- extensive chronological history;
- complete execution commands;
- copies of requirements from the plans.

### 4.1 Living sources that replace what was copied

- **Accepted HEAD** of a phase → historical record in the **ledger**
  of the front (§7).
- **Current HEAD** and **working tree** → `git rev-parse HEAD`,
  `git status --short --untracked-files=all`, `git rev-parse
  --abbrev-ref HEAD`. Obtained via Git, **not** in Markdown.
- **Divergence** between local and remote → `git rev-list --left-right
  --count <local>...<remote>/<branch>`. Obtained via Git.
- **Staging** → `git diff --cached --name-status`. Obtained via Git.

### 4.2 Workspace, branch and remote

`workspace`, `branch` and `allowed remote` are **routing
metadata** and may appear in the front block in
`PROJECT_STATE.md`. They identify where the front is operated, not
the living state of the execution.

---

## 5. Local component states

Files such as `services/documents-ingestor/PROJECT_STATE.md`
**cannot** act as a second source of the canonical state of the
corresponding front. In particular, they are forbidden from repeating:

- current canonical phase;
- next phase;
- HEAD;
- working tree;
- push;
- global status of the front (e.g.: `G28-B3 IN PROGRESS`).

The future migration of these files will choose one of two forms,
in a later slice (after inventory of the exclusive content):

1. **Stable technical context of the component**, without current phase and
   next action. Only decisions, contracts, commands, dependencies
   and package structure.
2. **Pointer** reduced to the root `PROJECT_STATE.md` and to the plans
   of the component.

The concrete choice (1 or 2) will be executed in a later slice.
This slice does not migrate nor decide between the alternatives.

---

## 6. Operational handoff — `AGENT_HANDOFF.md`

`AGENT_HANDOFF.md` is the **only active operational handoff**.

It may contain:

- active front;
- immediate objective;
- required entry state (pre-conditions, environment);
- mandatory files (minimum reading for the next action);
- constraints of the next action;
- decisions still relevant (only those that affect continuity);
- links to `PROJECT_STATE.md`, plan and ledger.

`AGENT_HANDOFF.md` may **not** contain:

- stack of closeouts;
- complete commit history;
- detailed state of inactive fronts;
- full copy of plans;
- HEAD declared as canonical source;
- working tree, staging or divergence as living state;
- duplication of the front's state (the phase and the next action
  belong to `PROJECT_STATE.md`).

The handoff **does not replace** `PROJECT_STATE.md`. Mentions of the phase
ID are allowed to **guide execution**, but the canonical
status of the phase belongs only to `PROJECT_STATE.md`.

---

## 7. Closeout ledger

The future model will adopt an **append-only ledger per front**. Each
ledger entry must record, at a minimum:

- phase (ID);
- gate or final status;
- accepted commit or commits;
- main files;
- tests and result;
- residual risk;
- next phase indicated at the moment of the closeout;
- date.

### 7.1 Ledger rules

- Old entries are **not** rewritten to represent the
  current state. Later corrections enter as a **new line**
  or as a **note linked** to the original line.
- The ledger does **not** determine the current phase. The current phase is
  declared in the front's `PROJECT_STATE.md`.
- **Git remains the source of the commits and diffs**. The ledger
  is a historical and auditable index, not a mirror of the `git log`.
- The ledger does **not** replace `AGENT_HANDOFF.md` nor
  `PROJECT_STATE.md`; it complements them.

### 7.2 This slice's phase

**No new ledger must be created in this slice.** The
already existing `docs/refactor/ARCHITECTURE_REFACTOR_LEDGER.md`
remains as it is; new per-front ledgers will be opened in
later slices, when the front needs them.

---

## 8. Plans, contracts and backlogs

Architectural plans (e.g.: `docs/architecture/PLANO_*.md`,
`docs/architecture/PEDIDO_OP_*.md`) may contain:

- architecture;
- requirements;
- permanent decisions;
- dependencies;
- planned phases;
- acceptance criteria;
- backlog;
- **macro non-operational** progress (e.g.: "B2 completed;
  B3 in progress" — reference to states that live in
  `PROJECT_STATE.md`).

They must not contain as **active state**:

- current HEAD;
- working tree;
- push;
- migration applied/not applied **without environmental reference**
  (e.g.: "db/49 applied in staging `ucrjtfswnfdlxwtmxnoo`
  on 2026-MM-DD" is acceptable; "db/49 applied" without
  context is loose history);
- temporary next order;
- complete commit reports.

Detailed progress must point to `PROJECT_STATE.md` and to the
corresponding ledger.

---

## 9. Git metadata — explicit treatment

The documentation must distinguish three classes of information coming
from Git:

| Class | Nature | Where it must appear |
|---|---|---|
| **Workspace, branch, remote** | Routing metadata (stable until a new migration phase) | Front block in `PROJECT_STATE.md` and in `AGENT_HANDOFF.md` (if relevant). |
| **HEAD, working tree, staging, divergence** | Living fact | Obtained via `git` at the moment of query. **Not** copied in Markdown. |
| **Accepted commit of a phase** | Historical fact | Line of the front's **ledger**, with SHA, message and main files. |

This classification **corrects** formulations that treated branch
as if it could never appear in documentation. Branch and workspace
are routing metadata and may be persisted; HEAD, working
tree and staging are living facts and may not.

---

## 10. Migration state

The header of the SQL file **is not sole proof** that the
migration is applied in an environment. The contract distinguishes
three states:

1. **Versioned** — the `db/NN_*.sql` file exists in the repo and
   was accepted in a phase. Proof: Git history + ledger of the
   phase that introduced it.
2. **Applied per environment** — the migration was executed in
   a specific Supabase (staging `ucrjtfswnfdlxwtmxnoo` or
   production `bhgifjrfagkzubpyqpew`). Proof: **operational
   ledger** of the front, recording confirmed apply,
   environment, evidence and commit.
3. **Verified per environment** — the post-apply state was
   inspected (structural assertions, counts, RLS).
   Proof: same ledger, with verification results.

Recommended future source:

- **SQL file + Git history** → proof that the migration
  is versioned;
- **operational ledger of the front** → record of confirmed
  apply, environment, evidence and commit;
- **real Supabase** → final source when consulted in an
  authorized phase.

**Do not create a migrations ledger in this slice.** The separation between
"versioned", "applied" and "verified" is a classification
rule; the infrastructure of a dedicated migrations ledger
will be decided in a later slice.

---

## 11. Update rule per phase

The table below defines, for each phase event, which
canonical document(s) must be updated. **No technical phase
must automatically update all documents.**

| Event | Documentary update |
|---|---|
| Read-only diagnostic | none |
| Technical patch not yet accepted | none |
| Rejected gate | no canonical alteration; report remains outside the permanent state |
| Accepted technical gate | front's ledger; `PROJECT_STATE.md` only if phase or next action change |
| R1/R2 correction within the same phase | new entry or link in the ledger; without duplicating the whole state |
| Architectural change | corresponding plan or contract |
| Chat switch | `AGENT_HANDOFF.md` |
| Switch of workspace, branch or remote | front block in `PROJECT_STATE.md` |
| Migration apply | ledger with environment and evidence; state only when this changes the phase |
| Push | ledger of the phase, when operationally relevant |
| Documentary compaction | ledger records origin, destination and reduction; index is updated only if paths change |

---

## 12. Minimum documentary transaction

After an **accepted gate**, the normal update must
involve at most:

1. **1 ledger** of the front;
2. **+ 1 block of `PROJECT_STATE.md`**, only when the phase
   or the next action change;
3. **+ `AGENT_HANDOFF.md`**, only when there is relevant
   operational continuity or chat switch.

Plans are only altered when architecture, requirements or backlog
change. `docs/DOCUMENTATION_INDEX.md` is only altered when there is
a change of authority, classification or paths.

> **No technical phase must automatically update all
> documents.** The temptation of "all-in-one" is the most common
> symptom of documentary duplication; it must be actively
> combated.

---

## 13. Compaction

Compaction is a **transactional** operation over the
documentation. It must be triggered when objective signals are
observed, **not** by aesthetics or by calendar.

### 13.1 Compaction signals

`PROJECT_STATE.md` or `AGENT_HANDOFF.md` will need compaction
when **any** of the signals below is true:

- `PROJECT_STATE.md` or `AGENT_HANDOFF.md` above approximately
  **300 lines**;
- more than **one historical closeout block** within the same
  file;
- more than **one detailed front** within the handoff;
- presence of **HEAD, working tree, staging or divergence** as
  active state (instead of a reference derived from Git);
- duplication of **phase** or **next action** between two files
  of the same front.

### 13.2 Compaction procedure

The compaction must:

1. **Preserve** permanent decisions in the plans;
2. **Move** the history to the front's **ledger** (or
   existing append-only);
3. **Keep** the current state legible in `PROJECT_STATE.md` and
   `AGENT_HANDOFF.md`;
4. **Record** the operation in the ledger (origin, destination, reduction);
5. **Update** references in `docs/DOCUMENTATION_INDEX.md`
   only when paths change.

### 13.3 This slice's phase

**No compaction will be performed in this slice.** The rule is
established for use in future slices.

---

## 14. Existing competing lists — legacy to reconcile

The documents below contain today lists or orderings that
**compete** with the arbiter role of
`docs/DOCUMENTATION_INDEX.md`. None of them was altered by
G28-DOCS-B1. The reconciliation will be done in later slices
that, ideally, will replace these lists by a reference to the
index and to this model.

| Document | Competing list/ordering | Note |
|---|---|---|
| `docs/DOCUMENTATION_INDEX.md` §2 — "Precedence rule" | Enumerates 7 canonical sources by order. | Must be rewritten to reference this model. |
| `docs/architecture/CLAUDE_PROJECT_ASSET_MAP.md` §1, §3, §4, §11, §12 | Catalog of "canonical documents", "state files", "handoff files", functional precedence. | Must be rewritten to point to the index and to this model. |
| `docs/superpowers/STATUS.md`, `docs/superpowers/README.md` | Self-label as "current canonical state" or reference it. | Legacy content (Phases 1–6). Kept as history; **must not** guide execution. |
| `docs/HANDOFF.md` (root) | "Canonical snapshot" and "canonical refs". | Existing banner already indicates that the current state is in `PROJECT_STATE.md`. Will be revisited in a reconciliation slice. |
| `Guide-and-governance-rules.stxt` | General governance rules for ChatGPT, not for the internal documentary model. | Remains valid for the agent, but **is not** the arbiter of the project's internal documentation. |

These points are under the jurisdiction of their own slices. G28-DOCS-B1
only **declares them as legacy to reconcile**, without moving nor
rewriting content.

---

## 15. Mandatory checks when accepting a documentary phase

For a phase that touches this model (or its consumers)
to be accepted:

1. `git diff --check` clean.
2. Final working tree clean, final staging empty.
3. `docs/DOCUMENTATION_INDEX.md` remains as the arbiter of
   authority, **not** of operational state.
4. `PROJECT_STATE.md` (after migration) is the **only** owner
   of the current state per front.
5. Local component states (`services/*/PROJECT_STATE.md`)
   do not duplicate phase and next action.
6. `AGENT_HANDOFF.md` has an operational role, **not** a historical one.
7. Ledger (where applicable) is append-only.
8. HEAD and working tree are derived from Git; none of that lives
   as active state in Markdown.
9. Branch and workspace are treated as routing
   metadata, allowed in the front block in
   `PROJECT_STATE.md`.
10. Versioned, applied and verified migrations are
    distinguished; the proof of "applied in staging" is the ledger
    of the front, not just the SQL header.
11. The update matrix per phase (§11) was respected.
12. No current state was migrated without a dedicated slice.
13. No file was moved, renamed, archived or
    compacted without a dedicated slice.
14. No push was executed.

---

## 16. Recommended next slice

`G28-DOCS-B2` — **MIGRATION OF STATE TO OWNER FILES** (docs-only,
additive, no compaction yet). Suggested scope:

- For each front, create/revise the **front block** in
  the root `PROJECT_STATE.md`, containing only the fields of §4.
- Mark in each `services/*/PROJECT_STATE.md` which blocks
  are stable technical context and which are duplication of
  state (without removing them yet; only annotating).
- Attach to `AGENT_HANDOFF.md` only the active front, without
  closeout history.
- **Do not** create new ledgers in this slice; only map
  which ledgers will be opened in `B3`.

This proposal is a **record**, not an authorization. The actual opening
of `G28-DOCS-B2` depends on a new order from the architect.

---

> **This model is a permanent contract.** It will be revisited
> only in an authorized docs-only phase, and the revision will be
> recorded in `docs/DOCUMENTATION_INDEX.md` and, when
> applicable, in the front's ledger.

---

## 17. PHASE CHECKPOINT RECONCILIATION

A phase checkpoint reconciliation is the mandatory end-of-phase protocol. It applies after any authorized work — technical or documentary — concludes. The protocol is a closeout procedure, not a corrective phase. It does not by itself authorize the next phase.

### 17.1 Requirements

1. Verify real branch, HEAD, worktree, staging, and untracked state.

2. Read applicable master plan, PROJECT_STATE.md, AGENT_HANDOFF.md, applicable append-only ledger.

3. Compare planned objective, work actually performed, accepted evidence, remaining work, next authorizable action.

4. Update master plan status using SEPARATE labels: diagnosed, decided, implemented, tested, accepted, deferred.

5. Update PROJECT_STATE.md current operational state.

6. Update AGENT_HANDOFF.md when continuity remains.

7. Append ledger when required.

8. Include this EXACT literal section in final report (labels only, no fixed G28 values):

```
PLAN_ALIGNMENT:
MASTER_PLAN:
LAST_ACCEPTED_PHASE:
CURRENT_PHASE:
NEXT_AUTHORIZABLE_ACTION:
OPEN_ARCHITECT_DECISIONS:
DEFERRED_PHASES:
STATE_FILES_UPDATED:
MATERIAL_DIVERGENCES:
```

9. A phase cannot be accepted if PLAN_ALIGNMENT is missing or material divergence unresolved.

10. Harmless wording difference must not create a corrective phase.

11. No next phase may be inferred solely from numbering.

12. Plans define architecture/backlog; they do not authorize execution by themselves.

13. Next phase derives from reconciled checkpoint plus explicit architect authorization.

---

## 18. Language policy

- Canonical state documents and reports: English.
- Ledger entries: immutable in the original language of the entry.
- Architect orders may be issued in Portuguese; once recorded in canonical
  documents they are recorded in English, with the original wording preserved
  in the ledger or archive.
- Translated originals are archived under `docs/archive/pt-BR/` in the same
  commit as the translation.
- No retroactive translation outside the DOC-LANGUAGE-MIGRATION track.
