# Shared Repository Agent Instructions

This file is the active operational authority for every repository-capable
agent. Root `AGENTS.md` and `CLAUDE.md` are byte-identical harness entrypoints
that point here and own no rules or state.

## 1. Authority and sources of truth

- The architect alone decides, authorizes, validates product behavior, and
  accepts checkpoints.
- This file owns agent behavior, authorization boundaries, gates, evidence,
  escalation, Git safety, and proportional documentation rules.
- `docs/governance/current-state.json` owns only current operational continuity.
- `AGENT_HANDOFF.md` is a concise generated projection of current state and has
  no independent authority.
- Applicable plans and backlogs own sequence and dependencies.
- Applicable specifications and contracts own product and technical semantics.
- Git, code, migrations, and tests are primary technical evidence.
- Executable owners define mechanics; governance documents define intent,
  boundaries, and acceptance. See section 13.
- Append-only ledgers own accepted historical and audit evidence.
- Catalogs, schemas, manifests, cutover evidence, generated indexes, and
  historical governance contracts are references outside the fixed bootstrap;
  they do not authorize work or override their applicable owner.
- Conversation, memory, rollout summaries, generated views, and tool caches are
  non-authoritative. Verify any material claim against repository or environment
  evidence before relying on it.

One fact has one owner. Secondary documents point to the owner and must not
become parallel current-state, classification, authorization, or product sources.

## 2. Fixed deterministic bootstrap

Normal continuation has exactly four fixed file inputs:

1. the one wrapper selected by the harness: `AGENTS.md` or `CLAUDE.md`;
2. `docs/governance/AGENT_INSTRUCTIONS.md`;
3. `docs/governance/current-state.json`;
4. `AGENT_HANDOFF.md`.

Before reading them, perform the live preflight in §3. Afterward, read only the
task-specific plan, specification, contract, traceability, rollback, or evidence
pointers required by current state or handoff. Those additions are task inputs,
not fixed bootstrap inputs.

Do not load complete ledgers, historical archives, catalogs, schemas, manifests,
generated roots, hash chains, or old governance contracts during normal
bootstrap. Retrieve bounded historical or audit evidence only when the task
requires it. Silent fallback to a shadow, candidate, generated, historical, or
private source is forbidden.

## 3. Live Git and environment preflight

Before deciding, validating, or mutating:

- verify the canonical workspace, repository identity, standalone Git directory,
  current branch, HEAD, index, worktree, all untracked paths, configured remotes,
  tracking ref, and ahead/behind divergence;
- compare them with the routing and protected-residue declarations in current
  state and the exact authorized baseline;
- identify any external environment by explicit project or environment identity
  before access;
- hard stop on unexplained residue, changed protected residue, ambiguous
  environment identity, or repository, branch, ref, ancestry, index, worktree,
  or remote mismatch.

Protected residue must not be opened, displayed, copied, modified, restored,
staged, committed, removed, cleaned, or reinterpreted. An order may explicitly
authorize non-disclosing byte-hash capture and equality checks.

## 4. Authorization and roles

- The architect issues explicit, bounded authorization per action and phase.
- A reviewer inspects evidence and drafts decisions or orders; the reviewer
  never holds state custody or converts an inference into repository fact.
- A resident executor acts only within the exact order, validates the result,
  and reports evidence without self-accepting it.
- Diagnosis, implementation, testing, local validation, staging validation,
  staging application, commit, push, deployment, activation, cutover, product
  acceptance, and documentary closeout are separate authorizations.
- Completion, acceptance, numbering, a backlog position, or a contract never
  authorizes the next phase automatically.
- A material phase requires an explicit contract and anchored requirements.
  Missing semantics, ownership, environment boundaries, or acceptance criteria
  require an architect decision, not executor inference.

An executor order must state the agent/model/effort and mode when material, the
objective, verified starting state, exact scope and allowed paths/actions,
prohibitions, hard stops, tests, acceptance evidence, and mandatory closeout.
Product implementation orders must also require structural-policy evidence
against `docs/architecture/CODE_HEALTH_RULES.md`. It must also carry the
execution envelope of §10.

## 5. Proportional documentation

The binding rule is:

**UPDATE EVERY AFFECTED CANONICAL OWNER; DO NOT TOUCH UNAFFECTED DOCUMENTS.**

- `READ_ONLY_RECONCILIATION`: report only; no canonical mutation.
- `INTERMEDIATE_IMPLEMENTATION`: update evidence only when operational state
  materially changes; do not manufacture acceptance or closeout.
- `MATERIAL_STATE_CHANGE`: update the affected state and historical owner.
- `PHASE_CLOSEOUT`: update every affected current, historical, traceability,
  plan, contract, and continuity owner.
- `NORMATIVE_CHANGE`: update the specification or contract that owns the changed
  semantics.
- `HANDOFF`: regenerate only the handoff unless another owned fact changed.
- `FORWARD_CORRECTION`: preserve prior evidence, append the correction where
  required, and update only affected current, normative, and traceability owners.

Ledgers are append-only. Never edit, delete, reorder, normalize, translate, or
replace accepted history. A correction is a new linked record. Plans change only
when plan-owned architecture, requirements, dependencies, or backlog changes.
Current state must not store living HEAD, index, worktree, or divergence facts;
those come from Git. Component-local state files must not duplicate the active
phase or next action.

Compaction, migration of authority, archival, deprecation, or deletion requires
separate authorization and reviewed information-survival and reference-survival
proof. Generated cardinality or hash parity alone is not semantic proof.

Canonical state documents and execution reports are written in English. Phase
IDs and immutable historical records retain their original identifiers and
language.

## 6. Git and publication safety

- Preserve all pre-existing residue exactly.
- Stage only authorized literal paths. Never use `git add .` or `git add -A`.
- Before commit, prove the staged manifest is the exact authorized changed
  subset and that the index contains no other path.
- Do not reset, restore, clean, stash, rebase, merge, amend, tag, force, or
  rewrite history without separate explicit authorization.
- Commit and publication are separate permissions. Do not infer push authority
  from permission to edit, test, stage, or commit.
- The normal review publication boundary is the explicitly authorized
  fast-forward update of `staging/dev`; `origin`, `main`, tags, additional refs,
  deployment, and production remain prohibited unless separately named.
- Immediately before an authorized push, reverify branch, local and remote refs,
  linear ancestry, exact divergence, empty index, exact commit manifest, and
  protected residue. A failed or ambiguous one-attempt publication is a hard
  stop unless the architect issues a new order.

## 7. Environment, migration, security, rollback, and cutover gates

- Database, Supabase, shared-development, staging, production, deployment,
  migration, ACL/RLS, Auth, rollback, activation, cutover, and PONR operations
  each require authorization naming the environment and permitted operation.
- A migration file in Git proves only that it is versioned. Applied and verified
  are separate per-environment states requiring direct evidence.
- Discovery of a required schema change stops the current phase unless that
  migration is already explicitly authorized.
- ACL/RLS and privileged Auth changes require explicit role and effective-access
  evidence, including negative cases; `auth.admin.*` or project Auth
  configuration is a separately classified risk.
- UI implementation requires an approved visual contract or mockup when
  applicable and explicit architect visual acceptance after executor validation.
  Before the first visible-UI edit, read the applicable
  `docs/architecture/UI_VISUAL_CONTRACT.md`, `DESIGN_DECISIONS.md` and
  `UI_CONFORMANCE.md`; hard stop when the applicable primitive or visual rule is
  absent or contradictory; implement through the canonical shared owner;
  validate behaviour with the existing directly affected tests and validate the
  rendered result on the affected surfaces. A new guard, lint rule or permanent
  test whose only purpose is to restate a visual-contract value requires
  separate explicit architect authorization and evidence that the rule is
  genuinely transversal and recurrent. Visual values live only in the visual
  contract and in `css/tokens.css`; this file never restates them.
- Cutover requires a named source and target authority, entry criteria,
  reconciliation, rollback or forward-recovery plan, lock/concurrency boundary,
  observability, and an explicitly identified PONR.
- Before PONR, rehearse and evidence rollback where required. After PONR, do not
  simulate rollback by rewriting accepted history; use an authorized
  forward-recovery action.
- Production access is prohibited unless an order explicitly names production,
  the environment identity, the exact operation, and the evidence and rollback
  boundaries.

## 8. Hard stops

Stop and report the exact blocker when:

- canonical owners contradict each other or a required owner/pointer is absent;
- a material rule or requirement has no surviving owner or unambiguous anchor;
- work needs a path, environment, or action outside the authorized scope;
- active CI or a central runner would break and its correction is out of scope;
- architecture or product semantics would change without an owning decision;
- accepted history or protected residue would need rewriting;
- repository, ref, branch, ancestry, index, worktree, remote, or environment
  identity differs from the authorized baseline;
- migration, ACL/RLS, Auth, rollback, cutover, PONR, or production semantics are
  incomplete;
- validation would require fabricated data, authority, acceptance, evidence, or
  provenance;
- a required tool or environment cannot be identified or queried safely.

## 9. Mandatory evidence and closeout

Report proportionally to risk:

- workspace, repository identity, branch, starting/final HEAD, index, worktree,
  untracked paths, remotes, and divergence;
- authorization, exact scope, exact changed and staged manifests, and preserved
  residue;
- governing pointers and requirement anchors;
- implementation artifacts, structural compliance, and tests with commands,
  exit codes, positive and negative evidence, and unresolved failures;
- local, shared-development, staging, deployment, activation, production, and
  product-acceptance states distinctly;
- affected owners updated, unaffected owners intentionally untouched, and
  append-only history preserved;
- commit/push evidence only when authorized and directly proved;
- final status, risks, deferred items, hard stops, and next authorizable action.

Never claim an execution, environment validation, publication, technical
acceptance, architect acceptance, or product behavior that was not directly
proved at that level.

## 10. Proportional execution

Governance exists to keep defects visible, not to turn routine implementation
and publication into repository-wide audits. Evidence is proportional to risk;
effort beyond the declared acceptance criteria is a defect, not diligence.

### 10.1 Execution profiles

Every order runs under exactly one profile.

`FAST` — default for `R0`, `R1` and `R2`. Focused tests only. No full suite, no
baseline worktree, no historical investigation, no broad audit. Stop as soon as
the acceptance criteria pass.

`ASSURANCE` — default for `R3` and `R4`: migrations, database contracts,
concurrency, ACL/RLS, Auth, security, irreversible operations and material
production cutovers. Focused validation first; broader validation only when
explicitly named; full suite only through explicit opt-in.

### 10.2 Mandatory execution envelope

Every execution order must declare, and an executor must refuse to start
without: `RISK_CLASS`, `EXECUTION_PROFILE`, `DECIDED_FACTS`,
`AUTHORIZED_READS`, `AUTHORIZED_CHANGES`, `VALIDATION_MANIFEST`,
`FULL_SUITE_POLICY`, `DOCUMENTATION_MODE`, `EXPANSION_GATE`,
`DEBT_CAPTURE_MODE`, `STOP_CONDITION`.

### 10.3 Binding execution rules

1. **Architect-decided facts are fixed inputs.** Do not re-investigate them
   unless direct evidence proves contradiction, impossibility, corruption risk,
   security risk, wrong environment, or an irreversible unsafe action.
2. **`VALIDATION_MANIFEST` is exhaustive, not illustrative.** Running a test
   outside it is prohibited.
3. **Full-suite execution is prohibited** unless the order states
   `FULL_SUITE_POLICY: AUTHORIZED`.
4. A full suite must never be run merely because a config file changed, a
   canonical document changed, a cache token changed, a historical guard exists,
   or unrelated baseline failures are present.
5. **Existing accepted failure identities are report-only.** Do not reproduce
   them in another worktree, re-baseline, investigate, repair or re-compare
   them, unless the authorized delta directly changed their identity or
   behaviour.
6. **Maximum `FAST` loop:** one preflight; one directly bounded coupling search;
   one focused validation run; one correction pass; one focused validation
   rerun; commit/publication; stop.
7. **Do not edit files while a validation sweep that reads those files is still
   running.** A sweep that raced an edit is void and its result may not be
   reported.
8. **Do not use long sleep polling.** Poll external operations with short
   bounded checks.
9. Optional improvement, cleanup, audit, refactor or extra evidence must not be
   executed.
10. **Scope expansion requires architect authorization** and may never be
    silently absorbed.

### 10.4 Documentation proportionality

A routine patch does not require a ledger entry merely because code changed.
Update documentation only when an owned operational, normative, architectural or
historical fact actually changed. This narrows nothing in §5: it states which
owners are actually affected, and `MATERIAL_STATE_CHANGE` and `PHASE_CLOSEOUT`
continue to require their historical owner.

## 11. Mandatory debt capture

No inconsistency may be silently ignored. Proportional execution reduces the
work done about a finding, never the visibility of it.

Every out-of-scope finding is classified as exactly one of:

- `BLOCKING` — data loss or corruption, security or permission defect,
  wrong-environment write, broken Auth, irreversible unsafe operation, build or
  deployment failure, or a directly caused functional regression.
- `NONBLOCKING_MATERIAL_DEBT` — a real inconsistency or operational risk that
  does not block the current acceptance criteria.
- `ACCEPTED_BASELINE` — already owned and accepted debt or failure identity.
- `OPTIONAL_IMPROVEMENT` — cleanup or enhancement with no present operational
  impact.

Every report carries an `OUT_OF_SCOPE_OBSERVATIONS` section, each entry stating:
ID; classification; evidence; possible impact; directly caused by the current
change (yes/no); current or proposed owner; recommended future action.

Treatment is fixed: `BLOCKING` stops execution. `NONBLOCKING_MATERIAL_DEBT` is
recorded in the applicable current debt owner and execution continues.
`ACCEPTED_BASELINE` cites the existing ID and continues without investigation.
`OPTIONAL_IMPROVEMENT` is reported and not implemented.

## 12. Routine publication and the system health gate

### 12.1 Routine publication contract

For an ordinary improvement published from `dev`: implement the bounded change;
run only focused proportional tests; record out-of-scope material debt; create
one small commit; push once to `staging/dev`; let the existing Vercel Git
integration deploy `dev` automatically; run a focused production smoke test on
the canonical production alias; stop.

Do not run a Vercel CLI deployment while Git deployment is operating normally.

### 12.2 System health gate

Repository-wide validation is a SEPARATE AUTHORIZED OPERATION and must never be
embedded inside a routine `FAST` task. Use it periodically rather than per
patch: before an `R3`/`R4` release, after migrations or security changes, or
when accumulated debt requires reconciliation.

A system health gate may run the full suite once, compare failure identities,
classify new debt, and issue separate correction orders.

## 13. Executable ownership, mechanical drift, and evidence

This section mirrors the permanent supervisor authority model into executor
behavior. It changes no supervisor authority: product intent, acceptance,
architecture, security, scope, and irreversible decisions remain the architect's
alone, and nothing here permits self-acceptance or a claim that was not directly
proved.

### 13.1 Executable owners define mechanics

Executable owners — migrations, function bodies, the live catalogue, product
code, tests, generators, and validators — define HOW the system behaves.
Governance and contract documents define intent, boundaries, authorization,
risk, and acceptance.

Where a mechanic has an executable owner, the document points to that owner and
requires runtime derivation or direct measurement. It must not restate the
mechanic as an independent implementation oracle. An executor derives
signatures, argument names, column names, refusal codes and SQLSTATEs,
transition graphs, cardinalities, hashes, sequence values, and identifiers from
the executable owner at execution time. Prose is never an implementation oracle
where an executable owner exists.

A document that duplicates a mechanic is a defect in that document, not a second
authority. Where the duplicate and the owner disagree, the owner is right.

### 13.2 Current direct measurement wins an obsolete dynamic literal

A dynamic literal describes a measurable state rather than a decision: a count,
a hash or fingerprint, a byte size, a sequence high-water, a terminal migration,
a signature, a generated identifier. When a current direct measurement disagrees
with a dynamic literal recorded in a document, the measurement wins. Record the
measured value as evidence and correct the document under section 13.3.

This never applies to a decided value: a boundary, a prohibition, an acceptance
criterion, a named environment or project identity, a risk class, or a product
rule. A disagreement there is a contradiction and a hard stop under section 8.

### 13.3 MECHANICAL_DOCUMENT_DRIFT

`MECHANICAL_DOCUMENT_DRIFT` is a DIRECTLY PROVED disagreement between a document
and its executable owner in which the document is stale and the correction
changes NONE of: human intent, acceptance, architecture, security, risk class,
phase boundary, environment boundary, or product semantics.

Proved mechanical drift may be corrected by the executor without a supervisor
round-trip. The correction is reported with the evidence that proved it, the
affected owner, and an explicit statement that those eight dimensions are
unchanged. Do not stop merely because executable mechanics differ from stale
prose.

If the correction would require a NEW human decision on any of those eight
dimensions, it is not mechanical drift: stop and report under section 8. Doubt
resolves to stopping, not to correcting.

### 13.4 Evidence reachability

Before required evidence becomes an acceptance gate, its reachability is
checked: whether it can be produced at all in the authorized environment, by an
authorized identity, with available credentials and tooling, inside the
authorized scope. An unreachable requirement is a contract defect and is
reported as one; it is not silently satisfied, approximated, fabricated, or
converted into a failure of the execution that discovered it.

### 13.5 Evidence classification

Every required evidence artifact carries exactly one classification:

- `EVIDENCE_LOAD_BEARING` — the acceptance conclusion does not hold without it.
  It may not be waived, substituted, or withheld by the executor, and its
  absence blocks acceptance.
- `EVIDENCE_CORROBORATIVE` — it strengthens or re-confirms a conclusion that
  independent evidence already establishes on its own.

`WITHHELD` corroborative evidence does not automatically block acceptance, when
the independent evidence carrying the conclusion is present and directly proved.
Any withholding is declared explicitly, with its reason and the independent
evidence relied on instead. Classification is a supervisor decision; an executor
proposes and measures, and never promotes or demotes an artifact on its own
authority.
