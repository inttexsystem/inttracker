<!-- LIVE-STATE OWNERSHIP BANNER (GOVERNANCE-STATE-HANDOFF-COMPACTION-R1, 2026-07-20) -->
> **This document is the production-flow sequence/backlog authority. It is NOT a
> current-state owner.** Every dated `# Update …` closeout block below is a
> **historical record** of what was true when it was written. All
> `Status:` / `NEXT_AUTHORIZABLE_ACTION:` / "next authorizable action" / "current
> state" statements inside those blocks are **historical and superseded** — the
> sole owner of the live current phase, next authorizable action, and debts is
> `docs/governance/current-state.json`. Phase sequence, dependencies, backlog items, and accepted
> architecture in this file remain authoritative; live operational status does not.

# Update 2026-07-22 - CLEAN-SLATE-TRANSACTIONAL-RESET-EXECUTION-ACCEPTANCE-CLOSEOUT-R1 (direct supervisor acceptance of the executed clean-slate shared-development reset; checkpoint 770772548baf04c52e9ef020ff94f8bdabf77f03 ACCEPTED / DIRECTLY VERIFIED; phase CLOSED; documentation-only closeout commit)

Phase: documentation-only supervisor-acceptance recording (direct supervisor
acceptance of the executed shared-development clean-slate reset at checkpoint
`770772548baf04c52e9ef020ff94f8bdabf77f03`) and phase closeout.

**Sequence effect.** The `CLEAN-SLATE-TRANSACTIONAL-RESET` sequence item is now
**closed**. The executed, transactionally-verified reset against
`ucrjtfswnfdlxwtmxnoo` (canonical authorization checkpoint
`9706ec75c10bf811abf67e4cfcabb19aa64cbeeb`) — which purged 64 legacy orders, 64
needs, 51 native purchase orders, 16 Pedidos, 20 OPs, 25 lotes, and the exact
synthetic B6-VERIFY fixture, with post-state proven zero and master/reference
data, `saldo_fios`, `saldo_fios_op`, `op_numeros`, the documents front excluding
B6, the `legacy_active` cutover, migration history, sequences, and triggers
preserved unchanged — was reviewed and **ACCEPTED** by the supervisor. The
`CLEAN-SLATE-TRANSACTIONAL-RESET` sequence item's disposition becomes `CLOSED /
ACCEPTED / DIRECTLY VERIFIED`.

**Next sequenced action.** The read-only `GOVERNANCE-EFFICIENCY-REFOUNDATION-DIAGNOSIS-R1`
— a read-only inventory and classification of all current governance
documents (line counts and file sizes, current authority and ownership,
unique information held by each document, duplicated facts and duplicated
narratives, documents required during normal bootstrap vs. only for
historical audit, manual versus generated documents, consumers and inbound
references, ledger partitioning and rollover options, archive and compaction
candidates, safe deprecation candidates, documents that must remain
normative, documents that may become generated views, information-loss risks,
and link/reference migration requirements); the diagnosis must not delete,
archive, split, compact, or generate replacement files. This supersedes the
prior `REAL-BUSINESS-FLOW-RECREATION-DIAGNOSIS-R1` framing of the next
sequenced action; real business-flow recreation stays a separate,
still-unauthorized track. The previously emitted but unexecuted order
`CLEAN-SLATE-CLOSEOUT-AND-GOVERNANCE-EFFICIENCY-REFOUNDATION-SHADOW-R1` is
superseded and must not be executed. Not defined or guessed by this closeout.
`REAL_CUTOVER` (`NOT
AUTHORIZED / NOT EXECUTED`), `PHASE-C5B-ACCEPTANCE-DECISION` (`IDENTIFIED / NOT
AUTHORIZED / NOT IMPLEMENTED`), real business-flow recreation (`NOT YET
AUTHORIZED`), any shared-database apply beyond `db/77`, staging
validation/application, deployment, activation, production access, the
forbidden project, governance-efficiency refoundation implementation (`NOT YET
AUTHORIZED`), document cleanup/compaction (`NOT YET AUTHORIZED`), and branch
creation remain **unauthorized**; the accepted
product checkpoint stays `3405fdab8e05ec0f81cbfe07c63c489e551fee92` and no
phase chains automatically.

**Non-mutation of the repository / product.** This pass performed **no database
access**. Documentation-only closeout commit: only the seven authorized
canonical documents change; no product/test/script/migration/config change;
the external archive and execution evidence remain outside the repository,
unchanged; the protected residue is untouched. Commit `docs: accept clean-slate
shared-dev reset`, published through one authorized `staging/dev` fast-forward
push. Full record: contract §26, `PROJECT_STATE.md`, and
`docs/ledgers/G28_LEDGER.md`.

# Update 2026-07-22 - CLEAN-SLATE-TRANSACTIONAL-RESET-SHARED-DEV-EXECUTION-R1 (governed destructive execution of the accepted clean-slate reset; EXECUTED / TRANSACTIONALLY VERIFIED against ucrjtfswnfdlxwtmxnoo / awaiting direct supervisor review; documentation-only closeout commit)

Phase: governed destructive execution of the accepted, validation-gate-closed
clean-slate reset (the separate order authorized at the readiness acceptance).

**Sequence effect.** The `CLEAN-SLATE-TRANSACTIONAL-RESET` sequence item's
destructive execution — the action that was `AUTHORIZED AS THE NEXT SEPARATE
GOVERNED DESTRUCTIVE ORDER / NOT EXECUTED` at the readiness acceptance — has now
**executed exactly once** and is **TRANSACTIONALLY VERIFIED**. Under canonical
authorization checkpoint `9706ec75c10bf811abf67e4cfcabb19aa64cbeeb` (accepted
readiness checkpoint `62bdcc75c335e3881adb1af6350de801675aa788`; authoritative
archive `20260722T183846Z`, aggregate SHA-256 `5221cd47…`, `verify-archive`
395/395), one serialized `BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE` against
the authorized non-production shared-development project `ucrjtfswnfdlxwtmxnoo`
(PostgreSQL 17.6, terminal migration `20260722055832`) executed the exact contract
§7 deletion order with per-statement affected-row assertions (Boundary A
`0,0,0,0,0,51,51,51,64,51,64`, B6 `0,0,10,8,0,1`, Boundary B
`27,16,4,18,0,0,0,0,0,0,20,16,25`), purging **64 legacy orders, 64 needs, 51
native purchase orders, 16 Pedidos, 20 OPs, 25 lotes, and the exact synthetic
B6-VERIFY fixture**, then re-enabled the four temporarily-disabled business guards
and committed.

**Post-state (proven read-only).** Every purge table zero; the B6 fixture absent;
**preserved unchanged** — master/reference data, `saldo_fios`, `saldo_fios_op`
empty state, `op_numeros` (latex/2026/18, tecelagem/2026/41), the documents front
excluding B6 (39/1/24/30), the `legacy_active`/`flat`/`not_started` cutover with
all markers NULL, terminal migration, all 35 sequences (state hash `c210b65d…`,
no reset), and all 35 user triggers (state hash `7060ba455…`; the four guards
re-enabled with byte-identical definitions; C3C fence enabled). The 13 unmapped
`ordens_compra_fio` rows (ids 153–165) were removed as part of the
`ordens_compra_fio` purge — the contract §16 `SUPERSEDED_BY_CLEAN_SLATE_RESET`
disposition is now realised.

**Evidence / non-repo.** The external one-time execution artifact
(`shared-development-reset.sql`, sha256 `73c08150…`; canonical-to-execution diff
with the DELETE/DISABLE/ENABLE/SET-CONSTRAINTS core byte-identical), preflight /
trigger-catalog / sequence-baseline captures, and the post-state / post-trigger /
sequence-after / execution-result proofs are stored **outside the repository** at
`…/controle-tapetes-g28-artifacts/clean-slate-reset/execution/20260722T202717Z/`.
The authoritative archive `20260722T183846Z` is unchanged.

**Next sequenced action.** `DIRECT SUPERVISOR REVIEW` of the executed
shared-development reset. The reset is **not self-accepted** and the phase is
**not CLOSED**; `REAL_CUTOVER` (`NOT AUTHORIZED / NOT EXECUTED`),
`PHASE-C5B-ACCEPTANCE-DECISION` (`IDENTIFIED / NOT AUTHORIZED / NOT IMPLEMENTED`),
real business-flow recreation (`NOT YET AUTHORIZED`), any shared-database apply
beyond `db/77`, staging validation/application, deployment, activation, production
access, forbidden-project access, and branch creation remain **unauthorized**; the
accepted product checkpoint stays `3405fdab8e05ec0f81cbfe07c63c489e551fee92` and no
phase chains automatically.

**Non-mutation of the repository / product.** Documentation-only closeout commit:
only the seven authorized canonical documents change; no product/test/script/
migration/config change; the external SQL and evidence remain outside the
repository; the protected residue is untouched. Commit
`docs: record clean-slate shared-dev reset`, published through one authorized
`staging/dev` fast-forward push. Full record: contract §25, `PROJECT_STATE.md`,
and `docs/ledgers/G28_LEDGER.md`.

# Update 2026-07-22 - CLEAN-SLATE-TRANSACTIONAL-RESET-READINESS-ACCEPTANCE-CLOSEOUT-R1 (direct supervisor acceptance of the validation-gate-closed clean-slate reset readiness; checkpoint 62bdcc75 ACCEPTED / DIRECTLY VERIFIED; shared-development reset authorized as the next separate governed destructive order, not executed; documentation-only)

Phase: documentation-only supervisor-acceptance recording (direct supervisor
acceptance of the clean-slate reset readiness at checkpoint
`62bdcc75c335e3881adb1af6350de801675aa788`).

**Sequence effect.** The `CLEAN-SLATE-TRANSACTIONAL-RESET` sequence item's
mandatory archive-and-restore-drill HARD STOP and its validation gates are closed
and the readiness is **accepted**. The architect performed the direct supervisor
review and **ACCEPTED** the accepted clean-slate contract, the implemented +
hardened reset tooling, the retained authoritative archive `20260722T183846Z`
(aggregate SHA-256 `5221cd4753157ba426cee978b43d8b0107a42a5f08f6e23c96503ee92d7399dc`;
`verify-archive` 395/395), the passed disposable restore/reset drill (96/96), the
closed validation gates (`--self-test` 54/54; fixture suite 61/61), and the
ratified contract §21.4 trigger-handling mechanism (reset/restore SQL
byte-identical) — all `ACCEPTED / DIRECTLY VERIFIED` at checkpoint
`62bdcc75c335e3881adb1af6350de801675aa788`.

**Superseded checkpoint.** `f165302c1c542aa26e9ae78464d260c81eda6415` remains
**NOT ACCEPTED**; its retained technical corrections are incorporated into and
superseded by `62bdcc75…`.

**Next sequenced action.** The destructive shared-development reset is now
`AUTHORIZED AS THE NEXT SEPARATE GOVERNED DESTRUCTIVE ORDER`
(`CLEAN-SLATE-TRANSACTIONAL-RESET-SHARED-DEV-EXECUTION-R1`) and has **not** been
executed. `REAL_CUTOVER` (`NOT AUTHORIZED`), `PHASE-C5B-ACCEPTANCE-DECISION`
(`IDENTIFIED / NOT AUTHORIZED`), real business-flow recreation (`NOT AUTHORIZED
UNTIL RESET EXECUTION IS ACCEPTED`), any shared-database apply beyond `db/77`,
staging validation/application, deployment, activation, production access, and
branch creation remain **unauthorized**. The phase is not CLOSED and no phase
chains automatically; the accepted product checkpoint stays
`3405fdab8e05ec0f81cbfe07c63c489e551fee92`.

**Non-mutation.** Documentation-only: no database access, SQL, reset execution,
archive change, migration, product/test/script change, or protected-residue change
occurred. Commit `docs: accept clean-slate reset readiness`, published through one
authorized `staging/dev` fast-forward push. Full record: contract §24,
`PROJECT_STATE.md`, and `docs/ledgers/G28_LEDGER.md`.

# Update 2026-07-22 - CLEAN-SLATE-TRANSACTIONAL-RESET-FINAL-VALIDATION-GATES-CORRECTION-R1 (checkpoint f165302c NOT ACCEPTED — mandatory self-test failed; 2 blocking validation-gate defects fixed; archive-safety technical patch retained; authoritative archive revalidated, not regenerated)

Phase: localized forward correction + existing-archive revalidation (direct
supervisor review of `f165302c1c542aa26e9ae78464d260c81eda6415`).

**Checkpoint disposition.** `f165302c1c542aa26e9ae78464d260c81eda6415` is **NOT
ACCEPTED** — the mandatory `node scripts/validate-spec-custody.mjs --self-test`
failed at that commit with an **uncaught crash** (exit 1, zero PASS lines
printed), not a graceful per-case failure. The prior §22 archive-safety
technical patch itself was reviewed and is **RETAINED** (no change required to
it).

**Root cause A — active contract omitted from the self-test fixture.**
`scripts/spec-custody/self-tests.mjs`'s `createFixture()` never copied
`ACTIVE_PHASE_CONTRACT` into its synthetic temporary repository. This was
invisible while `ACTIVE_PHASE` was `NONE`; once this contract became active
(via `CLEAN-SLATE-TRANSACTIONAL-RESET-TOOLING-AND-DRILL-R2`), the self-test's
own baseline fixture began failing R2 as an uncaught exception. Fixed
generically: `createFixture()` now reads the source `PROJECT_STATE.md`
bootstrap directly, copies and tracks whatever file `ACTIVE_PHASE_CONTRACT`
currently points to when `ACTIVE_PHASE != NONE` (never hardcoding a specific
phase or contract path), requires the `NONE`/`NONE` combination otherwise, and
throws if the source's own bootstrap combination is itself invalid. Two
pre-existing tests that hardcoded a literal `'ACTIVE_PHASE: NONE'` string
replace (silently no-op once the baseline stopped being `NONE`/`NONE`) were
corrected to use a generic line-setting helper. 7 new test cases added;
`node scripts/validate-spec-custody.mjs --self-test` now exits **0** with
**54/54 PASS** and no uncaught baseline-fixture error.

**Root cause B — op_numeros preserved-gate was a loose map, not an exact set.**
`verifyPreservedBaseline()`'s `op_numeros` check built a `tipo -> ultimo_numero`
map, ignoring `ano` (year) entirely, silently collapsing a duplicate `tipo` to
whichever row appeared last, and never checking row count. Fixed:
`EXPECTED_OP_NUMEROS` is now the exact canonical two-row identity set
(`latex`/2026/18, `tecelagem`/2026/41), rejecting missing/extra/duplicate/
wrong-tipo/wrong-year/wrong-value/`NULL` rows, with an exact row-count
requirement. Remains the single shared source imported by the archive verifier
(no divergent copy). 6 new archive-tooling tests added; fixture suite **61/61**.

**Existing authoritative archive — retained, revalidated, not regenerated.**
Per this order's explicit instruction, `20260722T183846Z` was not modified,
rewritten, regenerated, or deleted: aggregate SHA-256
`5221cd4753157ba426cee978b43d8b0107a42a5f08f6e23c96503ee92d7399dc` unchanged
before and after this pass; the corrected `verify-archive` passed **395/395**;
the full disposable restore/reset drill was re-run against this **same**
archive (**96/96**), with `clean-slate-transactional-reset.sql`/`-restore.sql`
byte-identical throughout and the ratified contract §21.4 trigger-handling
mechanism unchanged. **No shared-development access of any kind occurred** in
this pass; the shared-development reset remains **not authorized**.

**Scope / disposition.** The phase is not CLOSED; `REAL_CUTOVER` and
`PHASE-C5B-ACCEPTANCE-DECISION` stay unauthorized; no phase chains
automatically. Commit `fix: close clean-slate validation gates`, published
through one authorized `staging/dev` fast-forward push. Full record: contract
§23, `PROJECT_STATE.md`, and `docs/ledgers/G28_LEDGER.md`.

# Update 2026-07-22 - CLEAN-SLATE-TRANSACTIONAL-RESET-ARCHIVE-SAFETY-CORRECTION-R1 (trigger-handling ratified by direct supervisor review; 4 blocking archive-tooling safety gaps fixed; replacement authoritative archive generated read-only; disposable drill re-passed; no shared-development execution)

Phase: localized safety patch + read-only archive regeneration + full disposable
revalidation (direct supervisor review of `6d1c647de9b43088feced6a0632df8123afb1e07`).

**Trigger-handling ratification.** The emitted-order trigger-handling mechanism
implemented in `clean-slate-transactional-reset.sql` (temporarily disabling
`item_quantidade_rascunho_guard` / `alocacao_rascunho_guard` /
`trg_alocacao_kg_alocado_cache` / `pedido_itens_sync_parciais_after_change_trigger`
inside the same transaction as the `DELETE`, with FK enforcement and the C3C
cutover fence kept active throughout) is **RATIFIED BY DIRECT SUPERVISOR REVIEW**
as an accepted architectural mechanism (contract §21.4) — no longer merely
proposed. The future real-reset order must revalidate (not re-decide) it.

**Archive-tooling safety corrections (contract §22.1).** Four blocking gaps found
and fixed in `scripts/reset/clean-slate-transactional-{export,verify}.mjs`
(`clean-slate-transactional-{reset,restore}.sql` stay byte-identical, unchanged):
(A) the pre-write validation gate now completes fully — including the preserved
baseline via one shared `verifyPreservedBaseline()` — before any filesystem
write; (B) the repository-boundary guard is now derived from this module's own
file location, never `process.cwd()`; (C) `verifyArchive` now recursively
enumerates the complete archive and strictly parses `checksums.sha256`,
rejecting unexpected content and malformed/duplicate/extra/missing entries;
(D) `capture.identity.project_ref` is now cross-checked against the real
`--target` argument. 16 new tests added; fixture suite 49/49, zero regressions.

**Replacement authoritative archive.** Regenerated read-only from
`ucrjtfswnfdlxwtmxnoo` at
`D:/Programação/controle-tapetes-g28-artifacts/clean-slate-reset/20260722T183846Z`
(aggregate SHA-256 `5221cd4753157ba426cee978b43d8b0107a42a5f08f6e23c96503ee92d7399dc`;
`verify-archive` 395/395); all 30 `tables/*.ndjson` hashes are **identical** to the
prior (superseded, retained) archive `20260722T173607Z` — no corpus drift. The
disposable restore/reset drill re-passed against the replacement archive (84/84,
cluster destroyed with proof).

**No execution / no mutation.** The shared-development database was **not
mutated** (re-confirmed post-drill); its clean-slate reset was **not executed or
authorized**. The phase is not CLOSED; `REAL_CUTOVER` and
`PHASE-C5B-ACCEPTANCE-DECISION` stay unauthorized; no phase chains automatically.
Commit `fix: harden clean-slate archive safety gates`, published through one
authorized `staging/dev` fast-forward push. Full record: contract §22,
`PROJECT_STATE.md`, and `docs/ledgers/G28_LEDGER.md`.

# Update 2026-07-22 - CLEAN-SLATE-TRANSACTIONAL-RESET-TOOLING-AND-DRILL-R2 (reset tooling implemented; real archive generated read-only; disposable restore/reset drill passed; no shared-development execution)

Phase: controlled tooling implementation + read-only shared-development export +
destructive disposable-PostgreSQL drill. Entry checkpoint
`21fe32bc4b37773d93cabeac3e7e09aca9079037`; accepted checkpoint stays
`3405fdab8e05ec0f81cbfe07c63c489e551fee92`.

**Sequence effect.** The `CLEAN-SLATE-TRANSACTIONAL-RESET` sequence item's mandatory
pre-execution HARD STOP (contract §8.3 — a verified archive-and-restore disposable
drill) is now **satisfied by proven tooling**. This pass implemented the five §10
tooling files (`scripts/reset/clean-slate-transactional-export.mjs`,
`clean-slate-transactional-reset.sql`, `clean-slate-transactional-restore.sql`,
`clean-slate-transactional-verify.mjs`,
`tests/clean-slate-transactional-reset.smoke.mjs`), generated a real deterministic
archive **READ-ONLY** from `ucrjtfswnfdlxwtmxnoo` (rolled-back
`REPEATABLE READ READ ONLY` transaction, zero mutation; aggregate SHA-256
`337d23cd6426287053dcffe02512253c0e9e96874c6362d2823186b52094f593`; `verify-archive`
330/330; B6 `document_link_revision_ops = 10` across OPs 55/57/61/63; 16 Pedidos /
20 OPs / 25 lotes) stored **outside the repository**, and proved the drill on a
fresh PostgreSQL 18.4 cluster (`db/01..77`, terminal `20260722055832`,
restore→reset→restore→reset with the exact contract affected-row sequences, all
counts/identities/B6/FK proven, cluster destroyed with proof; smoke + drill 56/56).

**No execution / no mutation.** The shared-development database was **not mutated**
and its clean-slate reset was **not executed or authorized** — the destructive reset
remains a **separate future order**. `OC-CUTOVER-001` stays `PLANNED`; `REAL_CUTOVER`
and `PHASE-C5B-ACCEPTANCE-DECISION` stay unauthorized; the phase is not CLOSED; no
phase chains automatically. The `13`-row gate stays
`STILL_APPLICABLE_UNTIL_RESET_EXECUTION_COMPLETES` then
`SUPERSEDED_BY_CLEAN_SLATE_RESET`. Recorded implementation note: the reset
transactionally disables the emitted-order `*_rascunho_guard` business triggers (FK
+ cutover fence stay ACTIVE) — the future real-reset order must ratify this. Commit
`feat: add clean-slate reset tooling and restore drill`, published through one
authorized `staging/dev` fast-forward push. Full record: contract §21,
`PROJECT_STATE.md`, and `docs/ledgers/G28_LEDGER.md`.

# Update 2026-07-22 - CLEAN-SLATE-TRANSACTIONAL-RESET-CONTRACT-CORRECTION-R1 (residual-boundary diagnosis accepted; reset contract corrected to one exact target; no execution)

Phase: read-only continuation diagnosis
(`CLEAN-SLATE-DOCUMENT-HISTORY-AND-RESIDUAL-BOUNDARY-DIAGNOSIS-R1`) followed by a
documentation-only correction of
`docs/architecture/CLEAN_SLATE_TRANSACTIONAL_RESET_PHASE_CONTRACT.md`. Type:
docs-only; database access strictly READ-ONLY (no
`INSERT`/`UPDATE`/`DELETE`/`TRUNCATE`/DDL/writer-RPC); no product, test, script,
migration, or configuration change. Entry checkpoint HEAD
`9eeff7d5a97e25cf676d54afcd4510816a8648fb`. Historical record — live state belongs
to `PROJECT_STATE.md`.

**Diagnosis outcome.** The only transaction-linked document in `ucrjtfswnfdlxwtmxnoo`
is a **proven synthetic `G28-B6-VERIFY` verification fixture**
(`G28-B6-VERIFY-c63b6c2c8aff4da58e87d1e75f7a9236-DOCUMENT`) linking Pedido #34
(`7fa51e02`), OPs 55/57/61/63, and lotes 33/37 — no Drive object, no SHA-256, no
fiscal/sender metadata, 0 operational descendants. The other 39 of 40 ingestor
`document_candidates` are unlinked and preserved as a separate front. The
Controlled-Delete × document-history rule is RESTRICT-FK + `db/53` application guard
with no immutability trigger. Residual tables dispositioned: `saldo_fios` (5
physical-inventory rows predating `db/67`) = preserve; `op_numeros` = preserve (no
restart); `op_fornecedores` (16, 0 orphans) = purge with OPs; empty aux/shipping
tables = no-op. Readiness: `READY_FOR_CONTRACT_CORRECTION`.

**Correction outcome — one exact clean-slate reset target (binding).** The reset
contract is now `STATUS: CORRECTED / AWAITING DIRECT SUPERVISOR REVIEW / DESTRUCTIVE
EXECUTION NOT AUTHORIZED`. Every prior optional/`UNPROVEN` decision is binding:
purge **all 16 Pedidos, all 20 OPs, all 25 lotes** (incl. orphan lotes 3,4,5,6,7,8,13)
+ `op_fornecedores` + the complete yarn-purchasing transaction corpus; **Option D3**
removal of **only** the exact synthetic B6-VERIFY fixture (4 `document_link_revision_ops`
+ 8 `document_link_revisions` + 1 `document_candidates`) with the rest of the
documents front preserved (broad documents-front deletion prohibited); preserve
`saldo_fios` (physical inventory), `saldo_fios_op` empty state, `op_numeros`
high-water (no restart), and all master/reference data; **cutover Option C** (stay
`legacy_active`/`flat`/`not_started`, markers NULL); a **mandatory archive package +
restore runbook + disposable restore drill** as a pre-execution HARD STOP the
executor may not waive; and a **one-time governed administrative DELETE transaction**
(not a `db/NN` migration, not the dashboard, not an RPC/UI writer). The contract now
carries the exact Boundary-A order (11 tables → 0,0,0,0,0,51,51,51,64,51,64), the
exact synthetic-document order (6 steps → 0,0,4,8,0,1, exact fixture id), the exact
Boundary-B order (13 tables → 27,16,4,18,0,0,0,0,0,0,20,16,25), the exact 16 Pedido /
20 OP / 25 lote ids, and a proposed (not created) implementation manifest
(`scripts/reset/clean-slate-transactional-export.mjs`/`-reset.sql`/`-restore.sql`/
`-verify.mjs`, `tests/clean-slate-transactional-reset.smoke.mjs`).

**Sequence impact.** No existing sequence dependency or accepted architecture in this
file changes. The `CLEAN-SLATE-TRANSACTIONAL-RESET` sequence item remains proposed
and separately-authorizable; the former 13-row `REAL_CUTOVER` completeness gate stays
`STILL_APPLICABLE_UNTIL_RESET_EXECUTION_COMPLETES` then `SUPERSEDED_BY_CLEAN_SLATE_RESET`;
`OC-CUTOVER-001` stays `PLANNED`; `REAL_CUTOVER` remains a separate, `NOT AUTHORIZED`
gate (any later cutover needs a re-baselined terminal migration since `db/75`'s
constants are superseded once the reset completes).

`NEXT_AUTHORIZABLE_ACTION`: direct supervisor review of the corrected
`CLEAN-SLATE-TRANSACTIONAL-RESET` contract — no deletion, database mutation, archive
creation, reset implementation, phase activation, or continuation is authorized; no
phase chains automatically. `ACTIVE_PHASE`/`ACTIVE_PHASE_CONTRACT` remain `NONE`;
`LAST_ACCEPTED_PHASE` stays `PHASE-C5`. One local documentation-only commit
`docs: correct clean-slate reset contract`, published through one authorized
fast-forward push to `staging/dev`. Full record: the reset contract and
`docs/ledgers/G28_LEDGER.md`.

# Update 2026-07-22 - CLEAN-SLATE-TRANSACTIONAL-RESET-CONTRACT-R1 (business-owner clean-slate ruling recorded; proposed reset contract authored; no execution)

Phase: read-only diagnosis of the operational transaction domain in the
non-production shared development database `ucrjtfswnfdlxwtmxnoo` +
documentation-only authoring of a **proposed** material phase contract. Type:
docs-only; no product, test, database, migration, environment, deployment, or
configuration change; database access was strictly READ-ONLY (no
`INSERT`/`UPDATE`/`DELETE`/`TRUNCATE`/DDL/writer-RPC). Entry checkpoint HEAD
`56f749812c693cea3c81518a139d174e958fbbbf`. Historical record — live state belongs
to `PROJECT_STATE.md`.

**Binding business-owner ruling recorded — `CLEAN_SLATE_OPERATIONAL_REBUILD`
APPROVED AS TARGET STRATEGY.** The current operational transaction corpus does
**not** need to survive as live business data; the **approximately two** real
business flows will be recreated manually through the new application in the
canonical order **Pedido → purchasing needs → purchase orders → OPs → subsequent
operational updates**. The previous application registered OPs without the new
canonical Pedido-first workflow, so existing operational records must not be
promoted merely to preserve their identifiers or historical shape. The prior
legacy-data preservation/mapping strategy (incl. the 51-row
`ordem_compra_item_compat_fio` bridge and the deferred 13-row mapping/backfill
options for ids `153`–`165`) is **SUPERSEDED as the target strategy** — not
deleted or rewritten. Master/reference data (auth/app users and roles, clients,
suppliers, materials, `cores`, `modelos`, `parametros_largura`,
`precos_terceirizada`, `ordem_compra_config`, schema/migration history) is
**preserved by default**.

**Sequence impact.** This ruling supersedes the *target* for the yarn-purchasing
corpus but changes **no existing sequence dependency or accepted architecture** in
this file. It introduces one **proposed, separately-authorizable** sequence item —
`CLEAN-SLATE-TRANSACTIONAL-RESET` — governed by
`docs/architecture/CLEAN_SLATE_TRANSACTIONAL_RESET_PHASE_CONTRACT.md` (`STATUS:
PROPOSED / AWAITING SUPERVISOR REVIEW / DESTRUCTIVE EXECUTION NOT AUTHORIZED`). The
proposed sequence is: (1) supervisor accepts the reset contract and its scope;
(2) archive the purged tables outside the repository; (3) execute the one-time
governed administrative reset (Boundary A = the self-contained yarn-purchasing
corpus; Boundary B = `pedidos`/`ops`/`lotes` only if separately authorized and the
binding Controlled-Delete × document-history entanglement — 1 Pedido + 4 OPs — is
resolved); (4) recreate the two real Pedidos → needs → purchase orders → OPs
through the application; (5) update subsequent operational states. The former
13-row `REAL_CUTOVER` completeness gate becomes
`STILL_APPLICABLE_UNTIL_RESET_EXECUTION_COMPLETES` then
`SUPERSEDED_BY_CLEAN_SLATE_RESET`; `REAL_CUTOVER` (and any re-baselined cutover
migration it would then require, since `db/75`'s 51/39/44/20221.280/405.980
constants are superseded) remains a **separate, `NOT AUTHORIZED`** gate.

`NEXT_AUTHORIZABLE_ACTION`: direct supervisor review of the proposed
`CLEAN-SLATE-TRANSACTIONAL-RESET` contract — no deletion, database mutation, reset
execution, phase activation, or continuation is authorized; no phase chains
automatically. `ACTIVE_PHASE`/`ACTIVE_PHASE_CONTRACT` remain `NONE`;
`LAST_ACCEPTED_PHASE` stays `PHASE-C5`. One local documentation-only commit
`docs: define clean-slate transactional reset contract`, published through one
authorized fast-forward push to `staging/dev`. Full record: the reset contract and
`docs/ledgers/G28_LEDGER.md`.

# Update 2026-07-22 - C5-DOCUMENTATION-CLOSEOUT-R1 (PHASE-C5 supervisor acceptance and closeout; OC-C5-EMISSION-001 SATISFIED)

Phase: documentation-only supervisor closeout of `PHASE-C5` / `OC-C5-EMISSION-001`
after direct supervisor acceptance of the targeted-correction commit
`3405fdab8e05ec0f81cbfe07c63c489e551fee92`
(`fix: preserve uncertainty after unresolved emission reload`). Type: docs-only;
no product, test, database, migration, environment, deployment, or configuration
change; no database or shared-environment access. Historical closeout note — live
state belongs to `PROJECT_STATE.md`.

The supervisor **ACCEPTED** the targeted-correction commit
(`ACCEPTED_WITH_NONBLOCKING_DOCUMENTARY_DEBT`) and **CLOSED** `PHASE-C5`:
`CLOSED / ACCEPTED_WITH_NONBLOCKING_DEBT / DIRECTLY VERIFIED / ARCHITECT VISUAL
VALIDATION PASSED`, accepted PHASE-C5 technical checkpoint
`3405fdab8e05ec0f81cbfe07c63c489e551fee92`. The blocking defect
`C5_AMBIGUOUS_EMISSION_RELOAD_FALSE_DRAFT_ASSERTION` is resolved:
`PHASE-C5 FUNCTIONAL GATE = PASS`; `PHASE-C5 VISUAL REVIEW =
PASS_WITH_NONBLOCKING_COSMETIC_DEBT`. `OC-C5-EMISSION-001` advances to
**`SATISFIED`**.

`LAST_ACCEPTED_PHASE` becomes `PHASE-C5`; `ACTIVE_PHASE`/`ACTIVE_PHASE_CONTRACT`
return to `NONE`. `PHASE-C5B-ACCEPTANCE-DECISION` remains `IDENTIFIED / NOT
AUTHORIZED` (orders with `exige_aceite=TRUE` are still not lifecycle-complete
until it ships); `REAL_CUTOVER` remains a **separate**, `NOT AUTHORIZED` gate,
additionally hard-gated behind the mandatory read-only completeness disposition
of the 13 unmapped `ordens_compra_fio` rows ids 153–165 (each dispositioned by
exactly one of authorized mapping/backfill + re-baseline, documented exclusion
with business-owner approval, or cancellation/removal). This closeout selects
neither continuation and creates no new phase contract; every existing sequence
constraint and dependency in this file is unchanged. Six nonblocking debts are
preserved unchanged (`PROJECT_STATE.md` POST-LAUNCH DEBT REGISTER items 15–20).

`NEXT_AUTHORIZABLE_ACTION`: a supervisor read-only sequencing decision between
the remaining separately governed continuations (`PHASE-C5B-ACCEPTANCE-DECISION`
and the `REAL_CUTOVER` 13-row completeness disposition) — no implementation
authorized; no phase chains automatically. One local documentation-only commit
`docs: close C5 purchase-order emission phase`, published through one authorized
fast-forward push to `staging/dev`. Sequence/architecture in this file are
unchanged. Full evidence: contract §25 and `docs/ledgers/G28_LEDGER.md`.

# Update 2026-07-22 - C5-PURCHASE-ORDER-EMISSION-UI-IMPLEMENTATION-R1 (PHASE-C5 native purchase-order emission UI implemented, locally verified, awaiting supervisor review)

Phase: local UI implementation of `PHASE-C5` / `OC-C5-EMISSION-001` under the
accepted material contract `docs/architecture/ORDEM_COMPRA_C5_PHASE_CONTRACT.md`
(§22). Type: product + tests + docs; no migration, no database, no environment,
no push. Entry checkpoint HEAD `538f4ba7b7aae5d6e9e0efbe29a57e1ef7bbc776`.
Historical closeout note — live state belongs to `PROJECT_STATE.md`.

Wired the previously disabled `oc-emitir` control to native
`public.emitir_ordem_compra(BIGINT)`, driven exclusively by the server
`acoes.emitir` signal (never recomputed client-side); added the ratified
`CONTROLLED_IRREVERSIBLE_TRANSITION` confirmation modal (explicit confirmation,
primary/neutral not destructive-red, in-flight duplicate-submit guard,
authoritative reload after a deterministic success, reload-first resolution of an
ambiguous transport with no auto-retry and no fallback writer, fixed pt-BR message
per deterministic writer `codigo`); surfaced `status_aceite`
(`nao_aplicavel`/`pendente`/`aceita`/`rejeitada`) with the honest
not-lifecycle-complete notice for a pending acceptance. No acceptance/rejection
capability (`PHASE-C5B` untouched).

Manifest exactly contract §12 (additive
`js/screens/ordem-compra-data.js`/`-render.js`/`-events.js`; no new product file;
`index.html`, `js/router.js`, `js/boot.js`, `js/screens/common.js`, `js/ui.js`,
the receipt/distribuicao/cutover/op-nova surfaces and all `db/*.sql`
byte-unchanged; `ORDEM_COMPRA_CANCEL_HANDLER_STALE_ORDER_CAPTURE` untouched).
Tests exactly contract §14 (new `tests/ordem-compra-emitir.smoke.js`; updated
`tests/ordem-compra.smoke.js` tests 4–5).

Evidence: emitir + ordem-compra suites 48/48 and the four C4 receipt suites
38/38; full Node-suite added-failing-identity differential vs a detached baseline
worktree at `538f4ba` = empty (baseline 142 / worktree 122; the 20 baseline-only
identities are pre-existing non-determinism); `node
scripts/validate-spec-custody.mjs` PASS (`--self-test` fails only on the
pre-existing active-contract fixture-harness limitation, byte-identical to the
`538f4ba` baseline); deterministic offline 7-PNG Playwright visual evidence +
computed styles (`%TEMP%\ravatex-c5-visual-review\`), browser console/page errors
empty.

`OC-C5-EMISSION-001` advances `PLANNED` → `PARTIALLY_SATISFIED`; not
self-accepted / not closed. `PHASE-C5B-ACCEPTANCE-DECISION`, `REAL_CUTOVER`, any
shared-database apply beyond `db/77`, staging validation/application of
`db/76`/`db/77`, deployment, activation, production access, branch creation, and
any push remain unauthorized. One local commit `feat: implement C5 purchase-order
emission UI`; no push.

# Update 2026-07-22 - C5A-CLOSEOUT-AND-C5-AUTHORIZATION-R1 (PHASE-C5A supervisor closeout; PHASE-C5 implementation authorized locally)

Phase: documentation-only supervisor closeout of `PHASE-C5A-DB-EMISSION-READINESS`
plus local-implementation authorization of `PHASE-C5`. Type: docs-only; no
product, test, script, migration, database, environment, deployment, or
configuration change; no database or shared-environment access; no push.
Historical closeout note — live state belongs to `PROJECT_STATE.md`.

The supervisor **CLOSED** `docs/architecture/ORDEM_COMPRA_C5A_DB_EMISSION_READINESS_PHASE_CONTRACT.md`
as final and binding: `STATUS: CLOSED / ACCEPTED / LOCALLY VERIFIED /
SHARED-DEVELOPMENT VERIFIED` (contract §25), ratifying every disposition
recorded at §22/§23/§24 (terminal grant matrix; read-model readiness
derivation; unchanged writer bodies; `EMISSION_ALLOWED_ONLY_WHEN_EXIGE_ACEITE_FALSE`;
unmodified C3C protected-mutation guard) as final. Accepted commits:
`a476df3191b914d62acd6718c06771cd1753ac6b` (proposed contract),
`27464520af2afa3c46d547ffaf76328df70b1889` (contract acceptance),
`e7a8b76152f986c83e4ecfe9827346a4efa5ef08` (`db/77` local implementation),
`d17b353ed3eca04225a7decb55f84ccd5817d085` (shared-development validation
evidence). The §14 shared-development transport adaptation (`SET ROLE` +
custom-GUC capture in place of unavailable `psql` meta-commands/
`session_replication_role`) is ratified as sufficient, non-blocking evidence.
Post-C5A debts (`PHASE-C5B` gap, `REAL_CUTOVER` mutation-fence question,
active-contract self-test fixture limitation, the 13 unmapped legacy rows,
the shared UI-radius debt, the cancel-handler stale-capture debt) are
recorded as nonblocking and separately owned.

With that database prerequisite resolved, the same pass **authorized**
`docs/architecture/ORDEM_COMPRA_C5_PHASE_CONTRACT.md` for local
implementation: `STATUS: ACCEPTED / IMPLEMENTATION AUTHORIZED LOCALLY`
(contract §22). Every ratified §21 decision (functional scope, actor/state/
action matrix, API ownership, the `CONTROLLED_IRREVERSIBLE_TRANSITION`
confirmation classification, the closed purely-additive three-file manifest,
idempotency/error contract, test/evidence contract, and hard stops) remains
binding and unchanged; `PHASE-C5B-ACCEPTANCE-DECISION` remains
`IDENTIFIED / NOT AUTHORIZED`. `LAST_ACCEPTED_PHASE` becomes
`PHASE-C5A-DB-EMISSION-READINESS`; `ACTIVE_PHASE`/`ACTIVE_PHASE_CONTRACT`
become `PHASE-C5` / `docs/architecture/ORDEM_COMPRA_C5_PHASE_CONTRACT.md`.
`OC-C5-EMISSION-001` becomes `PLANNED / AUTHORIZED_FOR_IMPLEMENTATION` — not
`SATISFIED`, not `ACTIVE`, not `IMPLEMENTED`; `PHASE-C5` UI implementation
itself remains **NOT YET IMPLEMENTED**, requiring a fresh Claude Code session
that re-verifies the Git baseline first
(`docs/governance/AGENT_INSTRUCTIONS.md` §2/§3) and stays within the
contract's §12 manifest, §15 entry/exit gates, and §16 hard stops.
`PHASE-C5B`, `REAL_CUTOVER`, any shared-database apply beyond `db/77`,
staging validation/application, deployment, activation, production access,
and any push remain unauthorized. Sequence/architecture in this file are
unchanged. One local documentation-only commit `docs: close C5A and
authorize C5 implementation`; no push.

# Update 2026-07-22 - C5A-DB77-SHARED-DEV-VALIDATION-R1 (PHASE-C5A shared development database apply + §14 evidence, shared-development verified)

Phase: authorized apply of the locally accepted `db/77` to the **shared development**
database `ucrjtfswnfdlxwtmxnoo` (non-production) plus the complete contract §14
shared-environment evidence. Type: database apply/validation + one docs-only evidence
commit; no staging, deployment, activation, `REAL_CUTOVER`, production access,
`PHASE-C5` UI, `PHASE-C5B`, or push. Historical closeout note — live state belongs to
`PROJECT_STATE.md`.

Status: `IMPLEMENTED / LOCALLY VERIFIED / SHARED-DEVELOPMENT VERIFIED / AWAITING
SUPERVISOR CLOSEOUT` (contract §24).

`db/77` was applied byte-identical to `e7a8b761` (SHA-256 `9628a947…`; terminal
migration `20260722055832`) to `ucrjtfswnfdlxwtmxnoo` (PostgreSQL 17.6) via the
project-scoped `supabase-dev-g28` MCP, then reapplied idempotently (deterministic
convergence; exactly one migration row). Identity was proven read-only by the
canonical migration/cutover/grant fingerprint; production `gqmpsxkxynrjvidfmojk` and
the forbidden project were never accessed. Post-apply: `emitir_ordem_compra` body
byte-unchanged (grant-only; `is_admin()` gate intact; EXECUTE granted to
`authenticated` only, PUBLIC/anon/service_role revoked); the two terminal read models
corrected to derive `pode_emitir`/`acoes.emitir`/`bloqueio_emissao` from
`_distribuicao_completa_ordem` + `exige_aceite=FALSE`;
`definir_alocacao_necessidade_compra_fio` still granted; the superseded
`alocar_necessidade_compra_fio` still revoked; the C3C protected-mutation guard
untouched. The complete §14 behavioral evidence passed on PG 17.6 in two atomic
self-planting `ROLLBACK`'d transactions (allocation writer; authorized authenticated
emission; non-admin/anon denials; wrong-state/incomplete/missing-supplier/zero-item/
over-allocation denials; duplicate allocation/emission idempotency; one audit event;
`nao_aplicavel` acceptance with no fabricated decision; detail+list read-model
readiness; `exige_aceite` gate; inert states; atomic invariance; and the
`legacy_active`-permit / `maintenance_fenced`+`canonical_active`-deny cutover fence
proved non-persistently). Zero validation-fixture residue; business data intact
(`ordens_compra_fio`=64 incl. the 13 unmapped ids 153–165); cutover unchanged
`legacy_active` — `REAL_CUTOVER` not activated. `OC-C5-EMISSION-001` stays
`PLANNED / BLOCKED_BY_C5A_DB_PREREQUISITE`; `PHASE-C5` UI, `PHASE-C5B`, and
`REAL_CUTOVER` remain unauthorized. Sequence/architecture in this file are unchanged.
Not self-accepted / not closed. One local docs-only commit
`docs: record C5A shared development validation`; no push.

# Update 2026-07-22 - C5A-DB-EMISSION-READINESS-IMPLEMENTATION-R1 Part 2 (PHASE-C5A local DB implementation, locally verified)

Phase: local disposable-environment implementation of `PHASE-C5A-DB-EMISSION-READINESS`.
Type: one migration + one integration test + docs; no shared-database, Supabase,
staging, production, deployment, activation, or `REAL_CUTOVER` access. Historical
closeout note — live state belongs to `PROJECT_STATE.md`.

Status: `IMPLEMENTED / LOCALLY VERIFIED / AWAITING SUPERVISOR REVIEW` (contract §23).

Created `db/77_ordem_compra_c5a_emission_readiness.sql` (forward-only, idempotent):
(1) `REVOKE ALL … FROM PUBLIC, anon, authenticated, service_role` then
`GRANT EXECUTE … TO authenticated` on `emitir_ordem_compra(BIGINT)` — the writer
body is **not** redefined (grant-only; the internal `is_admin()` gate stays
authoritative); (2) `CREATE OR REPLACE` of the two terminal read models
`obter_ordem_compra_admin(BIGINT)` / `listar_ordens_compra_admin(UUID)`,
byte-preserving every field except `pode_emitir`/`acoes.emitir`/`bloqueio_emissao`,
which now derive from `_distribuicao_completa_ordem` AND
`ordem_compra_config.exige_aceite = FALSE` (new UI-enablement blocker
`emissao_bloqueada_exige_aceite`). No allocation-writer DDL/grant
(`definir_alocacao_necessidade_compra_fio` stays granted, the superseded
`alocar_necessidade_compra_fio` stays revoked); the C3C protected-mutation guard
(`db/75`) is untouched.

Created `tests/ordem-compra-c5a-emission-readiness.integration.sql` (single
transaction, self-planted Pedido-origin polyester fixtures, `ROLLBACK`) proving
the order's 35 points on a disposable local PostgreSQL **18.4** cluster: terminal
grant matrix, unchanged emitir body, allocation create/over-alloc/idempotency,
read-model readiness true only for an eligible `exige_aceite=FALSE` native draft
(detail + list), the `exige_aceite=TRUE` gate, deterministic denials + atomic
failure invariance, authenticated-non-admin and anon denials, authorized emission
(`status_aceite='nao_aplicavel'`, one audit event, deterministic duplicate replay,
no fabricated acceptance), inert read models for legacy/emitted/cancelled/incomplete,
receipt writers unchanged, audit preserved, and the cutover fence permits/denies
matrix. Environment: Supabase-platform preamble + ordered `db/01…db/77` (64-row
corpus after `db/66` before `db/67`, reconciliation `64/51/51/51/51`); `db/77`
clean apply + idempotent reapply; test PASS.

**Forced migration-manifest fixture update (deviation recorded, flagged for
supervisor review):** the authorized `db/77` advanced the migration terminal 76→77,
deterministically invalidating the frozen `PHASE-C3D-A` deployment-manifest guard
`tests/ordem-compra-c3d-deploy.smoke.js` (`EXPECTED_TERMINAL = 76`). That guard —
a repo-wide migration-count bookkeeping test, not a UI/product/protected file and
not a test of `db/77`'s behavior — was updated minimally (terminal 76→77, terminal
two `db/76`/`db/77`, a `db/77` checkpoint-hash + byte-stability check), keeping its
fail-closed mechanism unchanged. This is one file beyond the order's literal Part 2
manifest; it is a necessary, non-weakening consequence of the authorized migration.
No optional concurrency file was created (`db/77` changes no writer body/locking;
the accepted `PHASE-C3D-E` allocation-concurrency evidence + this test's idempotency
proofs cover the unchanged allocation writer).

`OC-C5-EMISSION-001` stays `PLANNED / BLOCKED_BY_C5A_DB_PREREQUISITE`;
`ACTIVE_PHASE`/`ACTIVE_PHASE_CONTRACT` stay `PHASE-C5A-DB-EMISSION-READINESS` / the
contract. `PHASE-C5` UI implementation, `PHASE-C5B-ACCEPTANCE-DECISION`, any
shared-database apply of `db/77`, staging validation/application of `db/76`/`db/77`,
activation, deployment, `REAL_CUTOVER`, and any push remain unauthorized.
Sequence/architecture in this file are unchanged. Full evidence: contract §23 and
`docs/ledgers/G28_LEDGER.md`.

# Update 2026-07-21 - C5A-DB-EMISSION-READINESS-IMPLEMENTATION-R1 Part 1 (PHASE-C5A material contract, accepted; local implementation authorized)

Phase: documentation-only supervisor-acceptance closeout of the `PHASE-C5A`
material contract, with local implementation authorization. Type: docs-only; no
product, test, script, migration, database, environment, deployment, or
configuration change. Historical closeout note — live state belongs to
`PROJECT_STATE.md`.

The supervisor **ACCEPTED**
`docs/architecture/ORDEM_COMPRA_C5A_DB_EMISSION_READINESS_PHASE_CONTRACT.md` as
final and binding and **AUTHORIZED local implementation**
(`STATUS: PROPOSED / AWAITING SUPERVISOR REVIEW / IMPLEMENTATION NOT AUTHORIZED`
→ `STATUS: ACCEPTED / IMPLEMENTATION AUTHORIZED LOCALLY`, contract §22; entry
checkpoint / accepted proposal commit
`a476df3191b914d62acd6718c06771cd1753ac6b`). Ratified §19 decisions:

1. The contract is accepted as a whole.
2. Prerequisite classification `READ_MODEL_FUNCTION_AND_GRANT_PREREQUISITE` is
   ratified — one forward-only idempotent migration (`db/77`) grants
   `EXECUTE ON emitir_ordem_compra(BIGINT) TO authenticated` (keeping the
   internal `is_admin()` gate authoritative and `PUBLIC`/`anon`/`service_role`
   revoked), preserves the `emitir_ordem_compra` terminal body byte-equivalent,
   makes **no** allocation-writer migration, and corrects the two terminal read
   models so the server-derived emission action can become true. The active
   canonical allocation writer is `definir_alocacao_necessidade_compra_fio`
   (already granted to `authenticated`, admin-gated —
   `ALLOCATION_PATH_READY_AFTER_GRANT`); the legacy
   `alocar_necessidade_compra_fio` is `SUPERSEDED / REVOKED` and must remain
   ungranted (not re-granted, called, modified, or rehabilitated).
3. Acceptance-required-order disposition
   `EMISSION_ALLOWED_ONLY_WHEN_EXIGE_ACEITE_FALSE` is ratified — no acceptance
   or rejection is implemented; the read models never expose `acoes.emitir=true`
   when `exige_aceite=TRUE`; the emission writer body is unchanged. Residual
   limitation recorded: a privileged direct RPC may still follow the writer
   contract for `exige_aceite=TRUE`, but the canonical application path must not
   expose that action before `PHASE-C5B`. `PHASE-C5B-ACCEPTANCE-DECISION`
   remains `IDENTIFIED / NOT AUTHORIZED`.
4. The C3C protected-mutation guard is **not** modified — `legacy_active`
   permits the local writer path; `maintenance_fenced`/`canonical_active`
   denial is a `REAL_CUTOVER` concern. **C5A local readiness ≠ `REAL_CUTOVER`
   readiness.**

`ACTIVE_PHASE`/`ACTIVE_PHASE_CONTRACT` become `PHASE-C5A-DB-EMISSION-READINESS`
/ the contract file; `PHASE-C5A IMPLEMENTATION = NOT YET IMPLEMENTED`;
`LAST_ACCEPTED_PHASE` stays `PHASE-C4`. `OC-C5-EMISSION-001` stays
`PLANNED / BLOCKED_BY_C5A_DB_PREREQUISITE`. `NEXT_AUTHORIZABLE_ACTION` becomes
the local, disposable local PostgreSQL implementation of `db/77` and its
integration test under the same order (Part 2). `PHASE-C5` UI implementation,
`PHASE-C5B-ACCEPTANCE-DECISION`, any shared-database apply of `db/77`, staging
validation/application of `db/76`/`db/77`, activation, deployment,
`REAL_CUTOVER`, and any push remain unauthorized. Sequence/architecture in this
file are unchanged. Full evidence: contract §22 and `docs/ledgers/G28_LEDGER.md`.

# Update 2026-07-21 - C5A-DB-EMISSION-READINESS-CONTRACT-R1 (PHASE-C5A material contract, proposed)

Phase: read-only database reconciliation + documentation-only
`PHASE-C5A-DB-EMISSION-READINESS` material-contract authoring. Type: docs-only;
no product, test, script, migration, database, environment, deployment, or
configuration change; **no database, Supabase, or shared-environment access**
(every database fact derived from the tracked migration files). Historical
closeout note — live state belongs to `PROJECT_STATE.md`.

Authored `docs/architecture/ORDEM_COMPRA_C5A_DB_EMISSION_READINESS_PHASE_CONTRACT.md`
(`PHASE_ID: PHASE-C5A-DB-EMISSION-READINESS`, `STATUS: PROPOSED / AWAITING
SUPERVISOR REVIEW / IMPLEMENTATION NOT AUTHORIZED`), specifying the database,
ACL, writer-readiness, read-model, testing, rollback, and shared-environment
evidence required before `PHASE-C5` emission UI may be authorized — the database
prerequisite of the existing `OC-C5-EMISSION-001` (**no new requirement ID**).

**Overall classification: `READ_MODEL_FUNCTION_AND_GRANT_PREREQUISITE`.** Direct
migration-chain reconciliation (`db/65`–`db/76`) confirmed `emitir_ordem_compra`
(`db/68:247`) terminally `REVOKE ALL` from every role with **no `GRANT` anywhere**
(`db/68:347-350`, restated `db/70:1203-1206`, terminal `db/74:1192-1193`); its
body is complete and byte-equivalent-preservable (`SECURITY DEFINER`, internal
`is_admin()` gate). One future migration (`db/77`, not created) must grant
`EXECUTE ON emitir_ordem_compra(BIGINT) TO authenticated` **and** correct the
terminal read models `obter_ordem_compra_admin` (`db/69:987`) /
`listar_ordens_compra_admin` (`db/69:913`) — which hard-code
`pode_emitir=false`/`acoes.emitir=false` ("pode_emitir stays false; emission
awaits Phase C native receipt," `db/69:1073-1075`) — so they derive true for a
fully-distributed native rascunho with `exige_aceite=FALSE`, routing the existing
`_distribuicao_completa_ordem` (`db/69:889`) signal. Grant and read-model
correction are interdependent (one migration, not two).

**Two material refinements to the accepted C5 §5(b)/§21 premise** (the exact
question C5 §5(b) deferred to C5A — resolved, grounded in §R.23.8/§R.23.9, not a
normative contradiction, and the accepted C5 contract is not modified): (1) the
live, already-granted (`authenticated`, `db/74:1177`) canonical allocation writer
is `definir_alocacao_necessidade_compra_fio` (`db/74:330`) — need-first, atomic
draft-order/item/allocation create-or-reuse, wired at
`js/screens/pedido-insumos-distribuicao.js:135` — so allocation is
`ALLOCATION_PATH_READY_AFTER_GRANT` and the older `alocar_necessidade_compra_fio`
(revoked `db/74:1182`) is `SUPERSEDED / INTERNAL_FUNCTION_ONLY`, needing no
grant; (2) the read-model prerequisite (above) was not surfaced by C5 §5.

Actor ownership: `emitir_ordem_compra = AUTHENTICATED_ADMIN_ONLY`.
Acceptance-required-order disposition: `EMISSION_ALLOWED_ONLY_WHEN_EXIGE_ACEITE_FALSE`
— already structurally server-enforced (`ordem_compra_config.exige_aceite`
`DEFAULT FALSE`, seeded FALSE, `SELECT`-only with no client UPDATE path,
`db/65:174,182,192`; and no RPC anywhere transitions `status_aceite`
`pendente`→`aceita`/`rejeitada`, the `PHASE-C5B` gap). Cutover: both writer
bodies never check cutover; the `db/75` fence (`trg_c3c_protected_mutation_guard`,
8 tables) permits their DML under `legacy_active` (current) and denies it under
`maintenance_fenced`/`canonical_active` (a `REAL_CUTOVER` question, out of C5A
scope). Recorded supervisor decisions (contract §19): accept/reject the contract;
ratify the classification and the allocation-ready finding; ratify the
`exige_aceite=FALSE` disposition; rule on the `canonical_active` fence question
(for `REAL_CUTOVER`).

`OC-C5-EMISSION-001` stays `PLANNED / BLOCKED_BY_C5A_DB_PREREQUISITE`; `PHASE-C5A`
and `PHASE-C5` implementation remain unauthorized;
`ACTIVE_PHASE`/`ACTIVE_PHASE_CONTRACT` remain `NONE`. Sequence/architecture in
this file are unchanged. Full evidence: contract (all sections) and
`docs/ledgers/G28_LEDGER.md`.

# Update 2026-07-21 - C5-CONTRACT-ACCEPTANCE-CLOSEOUT-R1 (PHASE-C5 material contract, accepted)

Phase: documentation-only supervisor-acceptance closeout of the `PHASE-C5`
material contract. Type: docs-only; no product, test, script, migration,
database, environment, deployment, or configuration change. Historical
closeout note — live state belongs to `PROJECT_STATE.md`.

The supervisor **ACCEPTED**
`docs/architecture/ORDEM_COMPRA_C5_PHASE_CONTRACT.md` as final and binding
(`STATUS: ACCEPTED / IMPLEMENTATION BLOCKED BY DATABASE PREREQUISITE`,
contract §21; accepted contract commit
`f9fa97703d2724d62a0d916cca7b9637d54a1e08`). This acceptance does **not**
authorize `PHASE-C5` implementation. Resolved the contract's four §18
decisions:

1. The contract is accepted as a whole.
2. The `BLOCKING_DATABASE_PREREQUISITE` classification is ratified and
   assigned to a new, separately authorized **`PHASE-C5A-DB-EMISSION-READINESS`**
   — not authored by this closeout; requires its own read-only diagnosis and
   documentation-only contract-authoring pass in a fresh session.
3. The missing acceptance-decision RPC gap (no schema object anywhere
   transitions `status_aceite` from `pendente` to `aceita`/`rejeitada`) is
   ratified as a new, separately identified **`PHASE-C5B-ACCEPTANCE-DECISION`**
   (`IDENTIFIED / NOT AUTHORIZED`) — owns actor ownership for acceptance
   decisions, the canonical accept/reject RPCs, state-transition rules,
   audit/history, UI ownership, the supplier-versus-administrator permission
   split, and rejection/override semantics. `PHASE-C5A` must not implement
   or invent any acceptance-decision capability. Orders with
   `exige_aceite=TRUE` must not be treated as lifecycle-complete until
   `PHASE-C5B` is implemented and accepted.
4. Emission's confirmation UX is ratified as
   **`CONTROLLED_IRREVERSIBLE_TRANSITION`** — explicit confirmation, no
   single-click emission, a clear explanation of the resulting state,
   primary-or-neutral (not destructive-red) confirmation styling, and an
   authoritative reload after deterministic success.

`OC-C5-EMISSION-001` disposition becomes
`PLANNED / BLOCKED_BY_C5A_DB_PREREQUISITE`. `LAST_ACCEPTED_PHASE` stays
`PHASE-C4`; `ACTIVE_PHASE`/`ACTIVE_PHASE_CONTRACT` stay `NONE`.
`NEXT_AUTHORIZABLE_ACTION` becomes a fresh Claude Code session's read-only
diagnosis and documentation-only authoring of
`PHASE-C5A-DB-EMISSION-READINESS` — not issued or executed by this closeout.
`PHASE-C5` implementation, `PHASE-C5B-ACCEPTANCE-DECISION`, and
`REAL_CUTOVER` remain unauthorized. Sequence/architecture in this file are
unchanged. Full evidence: contract §21 and `docs/ledgers/G28_LEDGER.md`.

# Update 2026-07-21 - C4-CLOSEOUT-AND-C5-CONTRACT-R1 Part 2 (PHASE-C5 material contract, proposed)

Phase: read-only repository reconciliation + documentation-only `PHASE-C5`
material contract authoring, continuing immediately (same execution) after
the `PHASE-C4` closeout in Part 1 of the same order. Type: docs-only; no
product, test, script, migration, database, environment, deployment, or
configuration change. Historical closeout note — live state belongs to
`PROJECT_STATE.md`.

Authored `docs/architecture/ORDEM_COMPRA_C5_PHASE_CONTRACT.md`
(`PHASE_ID: PHASE-C5`, `STATUS: PROPOSED / AWAITING SUPERVISOR REVIEW /
IMPLEMENTATION NOT AUTHORIZED`), binding `OC-C5-EMISSION-001` to an exact
functional scope — wire the already-existing disabled `oc-emitir` button
(`js/screens/ordem-compra-render.js:165-177`) to native
`emitir_ordem_compra` plus a confirmation modal plus a new `status_aceite`
display (currently unrendered anywhere on the order-detail screen) — an
actor/state/action matrix keyed to the real `pode_emitir`/
`bloqueio_emissao`/`acoes.emitir` server model, an API ownership matrix
(native `emitir_ordem_compra` only, excluding the superseded legacy flat
`emitir_ordem_compra_fio`), and a closed **purely-additive** three-file
manifest (`ordem-compra-data.js`/`-render.js`/`-events.js`; no new product
file, per `docs/architecture/CODE_HEALTH_RULES.md` §7 size headroom).

**Database-prerequisite classification: `BLOCKING_DATABASE_PREREQUISITE`.**
Direct migration-chain inspection found `emitir_ordem_compra` and
`alocar_necessidade_compra_fio` both terminally `REVOKE ALL` from every
role including `service_role`, per `db/74_ordem_compra_hybrid_origin_forward_correction.sql`'s
own "exact final execution ACL matrix" (§6, lines 1171-1207) — reaffirmed
absent from `db/75`/`db/76`. No migration is proposed or bundled; the
prerequisite is named exactly and assigned to a separate, later-authorized
prerequisite phase (name/scope an open supervisor decision).

A separate, pre-existing normative/product gap was discovered (not
introduced by this pass, C4, or any prior pass): no migration in `db/01`
through `db/76` ever creates an RPC that transitions `status_aceite` from
`pendente` to `aceita`/`rejeitada` — so any order emitted while
`exige_aceite=TRUE` becomes permanently unreceivable. This is recorded as
an open supervisor decision (contract §5c/§18.3), not dispositioned by this
contract, and is not part of `OC-C5-EMISSION-001`'s own scope.

Four supervisor decisions are recorded as required (contract §18):
accept/reject the contract as a whole; scope the database-prerequisite
phase; decide ownership of the acceptance-decision-RPC gap; decide whether
emission requires `confirmDialog`-style destructive confirmation (no clause
in `docs/architecture/UI_VISUAL_CONTRACT.md` currently classifies emission
either way).

`OC-C5-EMISSION-001` remains `PLANNED`; `PHASE-C5` implementation remains
unauthorized; `ACTIVE_PHASE`/`ACTIVE_PHASE_CONTRACT` remain `NONE`.
Sequence/architecture in this file are unchanged. Full evidence: contract
(all sections) and `docs/ledgers/G28_LEDGER.md`.

# Update 2026-07-21 - C4-CLOSEOUT-AND-C5-CONTRACT-R1 (PHASE-C4 supervisor acceptance/closeout)

Phase: `PHASE-C4` supervisor acceptance and documentary closeout. Type:
docs-only; no product, test, script, migration, database, environment,
deployment, or configuration change. Historical closeout note — live state
belongs to `PROJECT_STATE.md`.

The supervisor performed the mandatory architect visual validation
(`SUPERVISION_PROTOCOL.md` §4) of the six-PNG evidence packet produced by
`C4-ADMIN-RECEIPT-UI-VISUAL-GATE-R1` and **ACCEPTED** `PHASE-C4` as final and
binding: `CLOSED / ACCEPTED / LOCALLY VERIFIED / ARCHITECT VISUAL VALIDATION
PASSED` (`docs/architecture/ORDEM_COMPRA_C4_PHASE_CONTRACT.md` §0d).
`OC-C4-ADMIN-001` is now `SATISFIED`. Accepted implementation commits:
`bdd4c7d2bc43bd054d7cbb2b0bd70e6234160c24` (implementation),
`25cbdd6f6128744a8668b034c192c7d012e58171` (visual correction),
`289b0cca66e9c057330a882f69da3476adf90469` (accepted technical checkpoint).
Ratified visual scope (card 6px radius, no shadow, canonical hairline border;
4px primary controls; 30×30px/4px reversal action; right-aligned tabular
numerals; horizontal overflow protection; canonical `--rv-*` tokens; sticky
registration-modal total) and the factual correction that `css/tokens.css` is
linked globally through `index.html` are both ratified final;
`UI_VISUAL_CONTRACT.md` itself was not modified (it does not contain the
incorrect claim). Two nonblocking debts: `ORDEM_COMPRA_CANCEL_HANDLER_STALE_ORDER_CAPTURE`
(unchanged) and new `SHARED_UI_MODAL_CONTROL_RADIUS_TOKEN_ALIGNMENT` (shared
`js/ui.js` primitives, ≈8px, outside the C4 manifest, needs a separately
authorized global UI pass).

`LAST_ACCEPTED_PHASE` becomes `PHASE-C4`; `ACTIVE_PHASE`/`ACTIVE_PHASE_CONTRACT`
become `NONE`. `OC-C4-SUPPLIER-001` stays `DEFERRED`. This same pass continued
immediately into read-only diagnosis and documentation-only authoring of the
`PHASE-C5` material contract (`OC-C5-EMISSION-001`, purchase-order emission) —
see the following, separately dated ledger/backlog entry for that authoring
pass; `PHASE-C5` implementation remains unauthorized. Sequence/architecture in
this file are unchanged. Full evidence: contract §0d and
`docs/ledgers/G28_LEDGER.md`.

# Update 2026-07-21 - C4-ADMIN-RECEIPT-UI-VISUAL-GATE-R1 (Admin Receipt UI visual-contract correction + evidence)

Phase: `PHASE-C4` / `OC-C4-ADMIN-001` mandatory visual-validation preparation —
audit + objective visual-contract correction (render/events modules + their
two smoke suites only) + deterministic screenshots. Status unchanged:
`IMPLEMENTED / LOCALLY VERIFIED / AWAITING ARCHITECT VISUAL VALIDATION`.
Historical closeout note — live state belongs to `PROJECT_STATE.md`.

Corrected a factual error in contract §13.1/§4.6: `css/tokens.css` IS linked
globally at `index.html:11` and defines the `--rv-*` tokens on `:root`, so they
are resolvable on the ordem-compra screen. The render/events modules were
re-tokenized accordingly — the section card now uses `--rv-radius-card`
(computed 6px, correcting `rounded-lg`=8px), a flat `--rv-color-line-200`
hairline border and no shadow; the section icon chip uses the neutral
`--rv-color-chip-bg`/`--rv-color-chip-glyph` (§6); tables/text/dividers/accent/
control radius use the canonical tokens; the reversal `motivo` textarea uses
`--rv-radius-control`; and the live Alocado/Excesso/Total summary is sticky
above the modal footer. No ratified design decision was reopened and no
receipt data behavior changed; the shared `js/ui.js` `modal()`/`textInput()`
primitives (8px) are outside the C4 manifest and left unchanged. Six
deterministic Playwright screenshots (real system Chrome, offline, no
Supabase/auth/network at render) + computed-style evidence were produced;
browser console empty. Tests 38/38; full-suite added-failing-identity
differential vs `25cbdd6` = empty; validator PASS. `OC-C4-ADMIN-001` remains
`PARTIALLY_SATISFIED` (not advanced). Full evidence:
`docs/ledgers/G28_LEDGER.md` (`C4-ADMIN-RECEIPT-UI-VISUAL-GATE-R1`) and contract
§0c.

# Update 2026-07-21 - C4-ADMIN-RECEIPT-UI-IMPLEMENTATION-R1 (Admin Receipt UI implementation)

Phase: `PHASE-C4` / `OC-C4-ADMIN-001` local implementation —
`IMPLEMENTED / LOCALLY VERIFIED / AWAITING SUPERVISOR REVIEW`. Type: product +
tests + proportional docs; no migration, database write, environment,
deployment, staging, activation, cutover, branch, or push. Historical closeout
note — live state belongs to `PROJECT_STATE.md`.

Implemented the admin receipt UI at `#/ordens-compra/:id` strictly within the
accepted contract §10 manifest: new `js/screens/ordem-compra-receipt-data.js`
(native read-model loader + `registrar`/`estornar` writers + independent
idempotency/attempt-tracker/transport-ambiguity primitives + pure payload
builders), `js/screens/ordem-compra-receipt-render.js` (persistent
Recebimentos section — item/allocation saldos, receipt/estorno command history,
server-gated `Registrar recebimento`, ratified compact icon-only row-level
reversal button §8.1), `js/screens/ordem-compra-receipt-events.js`
(registration + reversal action modals, two independent attempt trackers);
additive `js/screens/ordem-compra.js` and `index.html`. Native RPCs only
(`obter_historico_recebimento_ordem_compra` / `registrar_recebimento_ordem_compra`
/ `estornar_recebimento_ordem_compra`); no `*_fio_compat` RPC and no flat
fallback in the C4 call graph; action availability rendered from the server
`acoes` model (never recomputed); excess is explicit; NULL-op / Pedido-origin
allocations render as `Pedido (compartilhada)` with no fabricated OP. Four new
smoke suites `tests/ordem-compra-receipt-{data,render,events,routing}.smoke.js`
(37/37 pass); full-suite added-failing-identity differential vs `bdd4c7d` =
empty; `node scripts/validate-spec-custody.mjs` PASS. Every §11
unchanged/prohibited surface (the legacy adapter, `router.js`, `boot.js`,
`common.js`, supplier/Pedido surfaces, all `db/*.sql`) is byte-unchanged; the
`ORDEM_COMPRA_CANCEL_HANDLER_STALE_ORDER_CAPTURE` debt was not touched.

`OC-C4-ADMIN-001` advances `PLANNED` → `PARTIALLY_SATISFIED`; **not**
`SATISFIED` (pending supervisor acceptance and the mandatory architect visual
validation, `SUPERVISION_PROTOCOL.md` §4). `OC-C4-SUPPLIER-001` remains
`DEFERRED`; `OC-C5-EMISSION-001` `PLANNED`. Sequence/architecture in this file
are unchanged. Full evidence:
`docs/architecture/ORDEM_COMPRA_C4_PHASE_CONTRACT.md` §0c and
`docs/ledgers/G28_LEDGER.md`.

# Update 2026-07-21 - C4-MATERIAL-PHASE-CONTRACT-R1 (Admin Receipt UI contract, proposed)

Phase: read-only repository reconciliation + documentation-only PHASE-C4
material contract authoring. Type: docs-only; no product, test, script,
migration, database, environment, deployment, or configuration change.
Historical closeout note — live state belongs to `PROJECT_STATE.md`.

Authored `docs/architecture/ORDEM_COMPRA_C4_PHASE_CONTRACT.md`
(`PHASE_ID: PHASE-C4`, `STATUS: PROPOSED / AWAITING SUPERVISOR REVIEW /
IMPLEMENTATION NOT AUTHORIZED`), binding `OC-C4-ADMIN-001` to an exact
functional scope, actor/state/action matrix, API ownership matrix, a closed
three-new-file product manifest
(`js/screens/ordem-compra-receipt-data.js`/`-render.js`/`-events.js`, plus
additive `js/screens/ordem-compra.js`/`index.html` touches), an explicit
unchanged-file list (`js/router.js`, `js/boot.js`, `js/screens/common.js`,
all legacy/compat surfaces, all `db/*.sql`), an idempotency/error contract,
and a visual contract authored against the tracked
`docs/architecture/UI_VISUAL_CONTRACT.md`. Administrator reversal was
determined in-scope for `OC-C4-ADMIN-001` from explicit lifecycle-spec
anchors (`§R.24.9`/`§R.24.10`/`§R.25.4`/`§R.29.6`/`§R.31`), not left
`UNPROVEN`; supplier reversal/UI remains separately deferred
(`OC-C4-SUPPLIER-001`). No database prerequisite was found necessary — the
existing `db/70`/`db/75`/`db/76`-installed RPCs and read model are already
sufficient for a correct UI; the writer RPCs remain inert under the live
`legacy_active` cutover state (documented as a risk, not a blocker).

`OC-C4-ADMIN-001` remains `PLANNED`; `PHASE-C4` implementation remains
unauthorized; `ACTIVE_PHASE`/`ACTIVE_PHASE_CONTRACT` remain `NONE`. Sequence/
architecture in this file are unchanged. Full evidence:
`docs/architecture/ORDEM_COMPRA_C4_PHASE_CONTRACT.md` and
`docs/ledgers/G28_LEDGER.md`.

# Update 2026-07-21 - PHASE-C3D Aggregate Closeout (PHASE-C3D-F) & PHASE-C3D-E Acceptance

Phase: `PHASE-C3D-F` (the sixth and final `PHASE-C3D` sublot — aggregate closeout
& readiness disposition). Type: documentation-only closeout; no product, test,
script, migration, database, environment, deployment, or configuration change.
Historical closeout note — live state belongs to `PROJECT_STATE.md`.

This pass first recorded the supervisor's acceptance of `PHASE-C3D-E` (session
advisory lock, deterministic resource-lock order, Component B concurrency,
idempotency, deterministic LIFO reversal, imported-balance immutable floor, with
exactly one synthetic PONR crossing per disposable cluster followed by mandatory
destruction) as `CLOSED / TECHNICALLY ACCEPTED / LOCALLY VERIFIED` at accepted
checkpoint `429aa3980c7027b9d872a1902e2f31f1a4a85a2a` (contract §Z), advancing
`OC-C3D-LOCK-001` to `SATISFIED`. A non-blocking documentary precision correction
records that **independent observer connections confirmed the T1/T2 blocking
relationship** (the captured *observer* marker session is closed before the
`pg_blocking_pids`/`pg_stat_activity` observations, which run through independent
transient queries); `saldo_fios`'s excess branch was not empirically executed
(`kg_alocado` 15.500 > max total 15.000, no excess line — proven structurally and
by the depth-1 denial) and `saldo_fios_op` is `NOT_APPLICABLE` to the installed
receipt/reversal/import topology — neither an `OC-C3D-LOCK-001` §M exit criterion;
the accepted technical artifact is unchanged.

It then executed `PHASE-C3D-F`, closing the aggregate `PHASE-C3D` material phase.
All five material sublots are `CLOSED / TECHNICALLY ACCEPTED / LOCALLY VERIFIED` —
`PHASE-C3D-A` `096cd60`, `PHASE-C3D-B` `5441321`, `PHASE-C3D-C` `6fd63a5`,
`PHASE-C3D-D` `5a2be05`, `PHASE-C3D-E` `429aa39`; `PHASE-C3D-F` is `CLOSED /
ACCEPTED / DOCUMENTATION-ONLY`; and `PHASE-C3D` is `CLOSED /
ACCEPTED_WITH_NONBLOCKING_DEBT / LOCALLY VERIFIED` at accepted technical
checkpoint `429aa3980c7027b9d872a1902e2f31f1a4a85a2a`. All four `OC-C3D-*`
requirements are `SATISFIED`. The final `PHASE-C3D-F` documentation commit is the
closeout-documentation checkpoint, **not** a new technical evidence checkpoint;
`PHASE-C3D` performed **no real cutover** and this closeout advances no
real-cutover / C4 / C5 requirement (`OC-CUTOVER-001` `PLANNED`,
`OC-CUTOVER-PONR-001` `PARTIALLY_SATISFIED`, `OC-C4-ADMIN-001` `PLANNED`,
`OC-C4-SUPPLIER-001` `DEFERRED`, `OC-C5-EMISSION-001` `PLANNED`).

**13-row `REAL_CUTOVER` completeness gate (supervisor decision).** The development
database's `ordens_compra_fio` holds 64 rows = 51 mapped (frozen REFUND-A corpus)
+ **13 unmapped, exact ids `153`–`165`**, all `rascunho`/`pendente`/`nao_recebido`,
`kg_recebido` NULL. Component A cannot project them; Component B must fail
`mapeamento_compat_ausente` if invoked; `PHASE-C3D` created no
mapping/bridge/migration/backfill/exclusion record for them. They are **DEFERRED
to the `REAL_CUTOVER` readiness gate** and did not block `PHASE-C3D` closeout.
Before `REAL_CUTOVER` may be authorized, a separate read-only completeness
diagnosis must disposition **every one** of the 13 by exactly one of: (1)
authorized mapping/backfill and re-baseline; (2) documented exclusion with
business-owner approval; or (3) cancellation/removal through a separately
authorized business-data action. `REAL_CUTOVER` stays **BLOCKED from
authorization** until that disposition is recorded (`OC-CUTOVER-001` remains
`PLANNED` — the gate is a residual-debt authorization prerequisite, not a
requirement-disposition change).

`ACTIVE_PHASE`/`ACTIVE_PHASE_CONTRACT` are now `NONE`; the next authorizable
action is the **architect authorization decision for `PHASE-C4` — ADMIN RECEIPT
UI** (`OC-C4-ADMIN-001`); `PHASE-C4`, `PHASE-C5`, and `REAL_CUTOVER` remain
unauthorized. `validate-spec-custody` PASS; `git diff --check` clean; the
mandatory-suite failing-identity differential vs.
`429aa3980c7027b9d872a1902e2f31f1a4a85a2a` = empty added. Sequence/architecture in
this file are unchanged. Full evidence: contract §Z and
`docs/ledgers/G28_LEDGER.md` (2026-07-21, this pass's own entry).

# Update 2026-07-21 - PHASE-C3D-E Session Lock, Resource Lock and Component B Concurrency Rehearsal

Phase: `PHASE-C3D-E` (the fifth `PHASE-C3D` sublot). Historical closeout note —
live state belongs to `PROJECT_STATE.md`.

This pass first recorded the supervisor's acceptance of `PHASE-C3D-D` (effective
ACL and role-matrix rehearsal, contract §V corrected §W) as `CLOSED /
TECHNICALLY ACCEPTED / LOCALLY VERIFIED` at accepted checkpoint
`5a2be05c19a62346b906f7b3cbb0b89d07b3a571` (contract §X), advancing
`OC-C3D-ACL-001` to `SATISFIED`. It then executed `PHASE-C3D-E` (primary
requirement `OC-C3D-LOCK-001`, §R.29.5), adding one authorized new file
`tests/ordem-compra-c3d-lock-concurrency.mjs` (contract §Y). Validated across two
independently bootstrapped fresh disposable local PostgreSQL 18.4 clusters
(`C3D_E_LOCK_CONCURRENCY_PASS` both), each applying the exact ordered
`db/01`…`db/76` over an ephemeral uncommitted Supabase preamble + the
classification-faithful synthetic 64-row corpus (`db/67` self-check
64/27/12/13/12; reconciliation 64/51/51/51/51): the full session advisory-lock
matrix (deterministic key, same-generation exclusion, different-generation
independence, release/reacquire, backend-disconnect auto-release, owner-only
boundary, no leak); the installed Component B resource-lock order (order → item →
idempotency advisory → header lookup → allocations asc → ledger asc → inventory
advisory) proven by empirical `pg_get_functiondef` and a real staged blocker
(rolled back pre-PONR, zero mutation); real session lock + real
`fence_and_snapshot` + the accepted synthetic equivalent of
`import_and_reconcile` establishing a 5.000 kg immutable imported opening balance
under a manual TEST-ONLY `canonical_active` state (`close_final_acl`/`activate`
never invoked); a two-session Component B sequence crossing exactly one synthetic
PONR per cluster (T1 → 10.000; T2 waits then re-evaluates a fresh +5.000 to
15.000, no stale 20.000, no deadlock); same-key idempotency replay +
`idempotencia_conflitante`; the legitimate nested canonical-active
`ordem_compra_item`/movement path at `pg_trigger_depth()>1` with depth-1 denial
`55000` (`saldo_fios` exception structural-only — no excess in this fixture;
`saldo_fios_op` `NOT_APPLICABLE`); deterministic LIFO reversal 15.000 → 8.000
(T2 5.000 then T1 2.000, T1 3.000 remaining, imported line untouched);
imported-balance floor rejection at 4.000 (`reducao_abaixo_saldo_importado`);
post-PONR prohibition compliance; and mandatory full cluster destruction. Deploy
smoke and receipt-cutover smoke PASS; `validate-spec-custody` PASS; full-suite
failing-identity differential vs. `5a2be05c19a62346b906f7b3cbb0b89d07b3a571` =
empty added (the new artifact is a `.mjs`, never executed by the Node suite);
validator self-test the identical pre-existing fixture-harness failure only;
read-only `ucrjtfswnfdlxwtmxnoo` inspection byte-identical before/after.
`PHASE-C3D-E` is `IMPLEMENTED / LOCALLY VERIFIED / AWAITING SUPERVISOR
ACCEPTANCE` — not self-accepted; `OC-C3D-LOCK-001` remains
`PARTIALLY_SATISFIED`; `OC-C3D-ACL-001` is now `SATISFIED` (via §X);
`OC-C3D-DEPLOY-001`/`OC-C3D-FENCE-001` `SATISFIED`. `PHASE-C3D-F` remains
unauthorized. Sequence/architecture in this file are unchanged. Full evidence:
contract §X/§Y and `docs/ledgers/G28_LEDGER.md` (2026-07-21, this pass's own
entries).

# Update 2026-07-21 - PHASE-C3D-D Targeted Evidence Correction (bind runtime role matrix to the simulated ACL closure)

Phase: `PHASE-C3D-D` (targeted correction). Historical closeout note — live
state belongs to `PROJECT_STATE.md`.

A read-only supervisor review of the `PHASE-C3D-D` evidence at checkpoint
`b808a5ea832b5038495afe80e492de724835cae6` returned `CHANGES_REQUIRED` on one
BLOCKING evidence defect: the catalog post-closure matrix and the Component A/B
runtime role matrix were each individually proven, but they executed in
**separate transactions**, so the runtime role matrix ran *after* the simulated
ACL closure had already been rolled back — it therefore never ran while the
revokes and PUBLIC-policy drops were in force. The correction (contract §W)
rebuilds the single authorized file
`tests/ordem-compra-c3d-acl.integration.sql` into **one outer
closure-simulation transaction** carrying the manual db/75 ACL revokes +
PUBLIC-policy drops and the already-passing catalog matrices, with the TEST-ONLY
`canonical_active` fixture and the complete Component A/B runtime role matrix now
inside **one nested savepoint (`c3dd_runtime_fixture`)** of that same
transaction; the matrix executes while the simulated closure remains active
(added pre-runtime, mid-runtime, no-drift, post-savepoint-rollback, and
post-outer-rollback proofs). `ROLLBACK TO SAVEPOINT` restores the synthetic
canonical_active markers (proven NULL again) while the simulated ACL stays
active; the outer `ROLLBACK` restores the original catalog byte-for-byte.
`ordem_compra_c3c_close_final_acl` and `_activate` are still never invoked;
`db/75`/`db/76` and every other file are byte-unchanged (only the one test file
changed). Re-validated across two fresh disposable local PostgreSQL 18.4
clusters (`C3D_D_ACL_INTEGRATION_PASS` both), full process/port/directory
cleanup and separate-connection backend absence proven; deploy smoke 24/24 and
receipt-cutover smoke 43/43 PASS; `validate-spec-custody` PASS; full-suite
failing-identity differential vs. `b808a5e` = empty added; validator self-test
the identical pre-existing fixture-harness failure only. `PHASE-C3D-D` is
`IMPLEMENTED / LOCALLY VERIFIED / CHANGES_REQUIRED RESOLVED / AWAITING SUPERVISOR
ACCEPTANCE` — not self-accepted; `OC-C3D-ACL-001` remains
`PARTIALLY_SATISFIED`. Sequence/architecture in this file are unchanged. Full
evidence: contract §W and `docs/ledgers/G28_LEDGER.md` (2026-07-21, this
correction's own entry).

# Update 2026-07-21 - PHASE-C3D-D Effective ACL and Role-Matrix Rehearsal

Phase: `PHASE-C3D-D` (the fourth `PHASE-C3D` sublot). Historical closeout
note — live state belongs to `PROJECT_STATE.md`.

This pass first recorded the supervisor's acceptance of `PHASE-C3D-C` (fence
and pre-PONR rollback rehearsal) — `CLOSED / TECHNICALLY ACCEPTED / LOCALLY
VERIFIED` at accepted checkpoint `6fd63a56a123d6d006353c6ae629611cbc7c01e9`
(contract §U), advancing `OC-C3D-FENCE-001` to `SATISFIED`. It then executed
`PHASE-C3D-D` (primary requirement `OC-C3D-ACL-001`, §13.15.2), adding one
authorized file `tests/ordem-compra-c3d-acl.integration.sql` validated across
two fresh disposable local PostgreSQL 18.4 clusters (entry checkpoint
`6fd63a56a123d6d006353c6ae629611cbc7c01e9`): the exact 14-table / 7-sequence /
11-column / function inventories; an empirical `pg_get_functiondef` proof that
the installed `ordem_compra_c3c_close_final_acl(bigint)` embeds the exact db/75
table/column/sequence revokes and the `0::oid = ANY (p.polroles)` PUBLIC-policy
drop loop; a simulated closure reproducing those ACL effects in one rolled-back
transaction WITHOUT invoking `close_final_acl`, with `final_acl_closed_at`
proven NULL throughout; post-simulation table (7 grant-revoked → zero for
public/anon/authenticated/service_role; 7 retained canonical tables' grants
byte-identical), column, sequence, RLS-policy (zero PUBLIC / non-PUBLIC
byte-identical), and function (owner-only no-EXECUTE vs Component A/B
authenticated-only) matrices; four-actor direct-table `42501` probes; a
Component A/B eight-actor runtime matrix under a TEST-ONLY canonical_active
fixture with `productive_receipt_started_at` NULL and no productive receipt;
and byte-identical catalog/business rollback. A reported DOCUMENTARY deviation
(§V.3): the db/75 `canonical_active` CHECK requires `final_acl_closed_at IS NOT
NULL`, so the TEST-ONLY runtime fixture sets synthetic markers (rolled back)
while the closure simulation keeps it NULL and never invokes the real closure.
Both runs proved full process/port/directory cleanup and separate-connection
backend absence; the read-only `ucrjtfswnfdlxwtmxnoo` inspection was
byte-identical before/after; full-suite differential against the entry
checkpoint empty; validator self-test the identical pre-existing failure only.
`PHASE-C3D-D` is `IMPLEMENTED / LOCALLY VERIFIED / AWAITING SUPERVISOR
ACCEPTANCE` — not self-accepted; `OC-C3D-ACL-001` remains
`PARTIALLY_SATISFIED`; `OC-C3D-FENCE-001` is `SATISFIED` (via §U);
`OC-C3D-LOCK-001` unchanged. `PHASE-C3D-E` and `C3D-F` remain unauthorized.
Sequence/architecture in this file are unchanged. Full evidence: contract
§U/§V and `docs/ledgers/G28_LEDGER.md` (2026-07-21, this pass's own entries).

# Update 2026-07-21 - PHASE-C3D-C Targeted Evidence Correction

Phase: `PHASE-C3D-C` targeted evidence correction. Historical closeout
note — live state belongs to `PROJECT_STATE.md`.

Corrected four incomplete-evidence findings in the already-implemented
`tests/ordem-compra-c3d-fence.integration.sql` at entry checkpoint
`a4b2e13bf0d9fb19b0ee69196f21d86f4904961e`, without redesigning the
already-passing actor-context, 24-probe, fence, or rollback behavior: (1)
exact live-versus-frozen hash evidence — four
`ordem_compra_c3c_assert_snapshot_and_live` invocations plus a
byte-compared snapshot/inventory evidence anchor and full-content business
fingerprints (row-cast hashes, not counts) through Evidence 5A, the
24-probe matrix, and the rollback; (2) an empirical
`pg_get_functiondef`-based catalog proof that the installed
`saldo_fios`/`saldo_fios_op` trigger-depth exception is exactly one
`pg_trigger_depth()>1 AND v_state='canonical_active'` gate with no broader
pass-through (nested-path runtime still correctly deferred, not
fabricated, to `PHASE-C3D-E`); (3) replaced an overstated in-session
"idle" claim with a captured test-backend PID proven absent from
`pg_stat_activity` (zero advisory locks) via a separate connection opened
after the test's `psql` process exited, before cluster teardown; (4)
corrected `OC-C3D-FENCE-001`'s residual-debt language — Option 2
(disposable local PostgreSQL + read-only shared-DB inspection) is the
selected and sole environment strategy, no real/staging fence rehearsal is
required or authorized by C3D-C, only supervisor acceptance remains
pending. Re-validated across two fresh disposable local PostgreSQL 18.4
clusters (both green, full cleanup proven); full-suite differential
against the entry checkpoint still empty; validator self-test still the
identical pre-existing active-contract fixture-harness failure only.
`PHASE-C3D-C` is `IMPLEMENTED / LOCALLY VERIFIED / CHANGES_REQUIRED
RESOLVED / AWAITING SUPERVISOR ACCEPTANCE` — not self-accepted;
`OC-C3D-FENCE-001` remains `PARTIALLY_SATISFIED`. Sequence/architecture in
this file are unchanged. Full evidence: contract §T and
`docs/ledgers/G28_LEDGER.md` (2026-07-21, this pass's own entry).

# Update 2026-07-21 - PHASE-C3D-C Fence and Pre-PONR Rollback Rehearsal

Phase: `PHASE-C3D-C` (the third `PHASE-C3D` sublot). Historical closeout
note — live state belongs to `PROJECT_STATE.md`.

Executed from a fresh Claude session at entry checkpoint
`7f73b4d8210da249ddd5b085c7c3b59244afd72b`. `PHASE-C3D-C` added one
authorized file, `tests/ordem-compra-c3d-fence.integration.sql`, validated
across two fresh disposable local PostgreSQL 18.4 clusters: pre-fence
admin/matching-supplier authorization controls; fence entry to
`maintenance_fenced/flat/previewed`; a database-faithful authenticated
actor-context fence-denial proof (Evidence 5A — exact
`legacy_receipt_fenced`/`55000` for both actors, zero mutation, no
JavaScript/browser/PostgREST execution); the eight-table × three-operation
structural fence matrix (Evidence 5B — 24/24 probes, exact
`legacy_receipt_fenced`/`55000`, with the `saldo_fios`/`saldo_fios_op`
internal trigger-depth exception's nested-path runtime correctly deferred,
not fabricated, to `PHASE-C3D-E`); and a pre-PONR rollback rehearsal
(test-only fixture, `ordem_compra_c3c_pre_ponr_rollback` restoring `flat`
reads while `status` stays `maintenance_fenced`, byte-identical
grants/policies, no `legacy_active` regression). Both runs proved full
process/port/directory cleanup; a read-only `ucrjtfswnfdlxwtmxnoo`
inspection was byte-identical before/after. Full-suite differential
(detached temporary worktree at the entry checkpoint): 141 baseline / 122
here, added = 0. `PHASE-C3D-C` is `IMPLEMENTED / LOCALLY VERIFIED /
AWAITING SUPERVISOR ACCEPTANCE` — not self-accepted; `OC-C3D-FENCE-001`
remains `PARTIALLY_SATISFIED` pending supervisor review; `OC-C3D-ACL-001`/
`OC-C3D-LOCK-001` unchanged. Sequence/architecture in this file are
unchanged. Full evidence: contract §S and `docs/ledgers/G28_LEDGER.md`
(2026-07-21, this pass's own entry).

# Update 2026-07-21 - PHASE-C3D-B Supervisor Acceptance & Documentary Reconciliation

Phase: `PHASE-C3D-B` supervisor acceptance (documentation-only). Historical
closeout note — live state belongs to `PROJECT_STATE.md`.

The supervisor accepted `PHASE-C3D-A` (checkpoint
`096cd60325e4987010d328c856ee6a3a51ca66bf`) and `PHASE-C3D-B` (checkpoint
`5441321014883c4e8149dc8b20da9d053a193699`), both `CLOSED / TECHNICALLY ACCEPTED
/ LOCALLY VERIFIED` (contract §R). The combined accepted evidence advanced
`OC-C3D-DEPLOY-001` to `SATISFIED` (traceability matrix updated); the stale
traceability header (`ACTIVE_PHASE: NONE`, C3D described as `PROPOSED`) was
reconciled to `ACTIVE_PHASE: PHASE-C3D`. The §G item 9 pre-PONR rollback wording
was corrected (§R.2): pre-PONR rollback restores `flat` read authority only,
keeps `status = maintenance_fenced` (does **not** return to `legacy_active`),
and does not restore flat grants/policies (grounded in spec §R.29.6 and
`db/75 ordem_compra_c3c_pre_ponr_rollback`; neither modified). `PHASE-C3D-C` is
`AUTHORIZED / NOT STARTED` and must begin only in a fresh Claude session using
this documentation-only checkpoint as the exact Git baseline; `PHASE-C3D-D`
through `C3D-F` remain unauthorized. Sequence/architecture in this file are
unchanged. Full evidence: contract §R and `docs/ledgers/G28_LEDGER.md`
(2026-07-21, acceptance entry).

# Update 2026-07-21 - PHASE-C3D-B Inactive Migration & Application-Presence Validation

Phase: `PHASE-C3D-B` (the second `PHASE-C3D` sublot; sequence per the C3D
contract §C). Historical closeout note — live state belongs to `PROJECT_STATE.md`.

The material-contract identity was restored to `PHASE-C3D` (the §P change to
`PHASE-C3D-A` was a documentary identity error; §Q.1), and `PHASE-C3D-A` was
recorded `CLOSED / TECHNICALLY ACCEPTED / LOCALLY VERIFIED` at the accepted
checkpoint `096cd60325e4987010d328c856ee6a3a51ca66bf`. `PHASE-C3D-B` added one
authorized file — `tests/ordem-compra-c3d-deploy.integration.sql` — and
validated, across two fresh disposable local PostgreSQL 18.4 clusters (no
real/copied business data), that the exact ordered `db/01`…`db/76` applies
cleanly (a classification-shape-only synthetic 64-row corpus loaded before
`db/67`; reconciliation `64/51/51/51/51`), that `db/75`/`db/76` are terminal,
that the cutover singleton is `legacy_active`/`flat`/`not_started`/all-null,
that Component A raises `listar_compat_inativo`/`55000` and Component B returns
`recebimento_compat_inativo` with zero mutation, PONR NULL, and no leaked
advisory lock, that `db/76` reapplies idempotently while `db/75` is a
single-application ordered migration, and that each disposable cluster was
proven destroyed. Application fallback was proven by the unmodified accepted
adapter (`22bfb192`) and existing tests; `ucrjtfswnfdlxwtmxnoo` was re-confirmed
inert by read-only inspection only. Sequence/architecture in this file are
unchanged; no `OC-C3D-*` disposition changed; `PHASE-C3D-B` is
`IMPLEMENTED / LOCALLY VERIFIED / AWAITING SUPERVISOR ACCEPTANCE`, and
`PHASE-C3D-C`…`C3D-F` remain separately unauthorized. Full evidence: contract
§Q and `docs/ledgers/G28_LEDGER.md` (2026-07-21, this pass's entry).

# Update 2026-07-21 - PHASE-C3D Material Contract Final Forward Correction (R2)

Phase: `PHASE-C3D` material phase contract correction (second).
Type: documentation-only; no product, test, script, migration, database,
environment, deployment, or configuration change.

A second read-only supervisor review of the R1-corrected `PHASE-C3D` contract
(commit `6b7d48a238a5008e02168557b27bc27def3946d1`) returned `CHANGES_REQUIRED`
for two remaining operational contradictions plus one wording correction, all
corrected in place (new §0b in
`docs/architecture/ORDEM_COMPRA_C3D_PHASE_CONTRACT.md`):

1. **Common documentary manifest for C3D-A…E (Finding 5, §C/§I).** The R1
   contract allowed canonical documentation writes only in C3D-F. Corrected:
   §I now defines an exact common documentary manifest (`PROJECT_STATE.md`,
   `AGENT_HANDOFF.md`, the C3D contract, the C3_TRACEABILITY matrix, this
   backlog, `docs/ledgers/G28_LEDGER.md`, and `docs/DOCUMENTATION_INDEX.md`
   only if materially required) applicable to each of C3D-A, C3D-B, C3D-C,
   C3D-D, and C3D-E. Each such sublot's future authorization comprises its
   exact technical artifact manifest plus that common documentary manifest, so
   it records its own technical checkpoint, evidence, affected requirement
   rows, current/next state, handoff, and hard stop — never self-accepting or
   authorizing the next sublot. C3D-F remains the final aggregate closeout but
   is no longer the first time canonical evidence may be recorded. No wildcard
   or directory-level path added.
2. **C3D-C reclassified as a database-faithful authenticated actor-context
   proof (Finding 6, §C/§E/§G.5A/§I/§M).** §G.5A had labeled the C3D-C fence
   proof "application/browser end-to-end," but the exact C3D-C manifest
   authorizes only `tests/ordem-compra-c3d-fence.integration.sql` (no
   JavaScript/browser/PostgREST harness). Corrected: C3D-C is a SQL-only
   `DATABASE-FAITHFUL AUTHENTICATED ACTOR-CONTEXT PROOF` in the disposable
   cluster — synthetic authenticated admin and matching-supplier contexts
   (same role + `auth.uid()` claim mechanism as the repo's DB-backed auth
   tests) reproducing the exact application flat-`UPDATE public.ordens_compra_fio
   SET kg_recebido=…, data_recebimento=…, status=… WHERE id=…` shapes (admin
   `js/screens/op-writes.js` L92–99; matching-supplier `js/screens/fornecedor.js`
   L523–525), both denied `legacy_receipt_fenced`/`SQLSTATE 55000`, zero
   mutation, fingerprints unchanged, no client-grant widening. The JS files
   remain read-only evidence of the mutation shape; no browser/app/PostgREST/UI
   execution is claimed. §G.5B remains the separate owner-level structural
   eight-table probe; the C3D-C technical manifest is unchanged.
3. **Wildcard-wording correction.** Absolute "no wildcard anywhere" claims
   replaced by `NO WILDCARD OR DIRECTORY-LEVEL WRITE AUTHORIZATION EXISTS`;
   wildcard notation is retained only in read-only/reference and
   prohibited-path descriptions (`any db/*.sql`, `any js/**`, `.codex/*`).

`STATUS` remains `PROPOSED / AWAITING SUPERVISOR ACCEPTANCE / IMPLEMENTATION
NOT AUTHORIZED` (unchanged); `ACTIVE_PHASE`/`ACTIVE_PHASE_CONTRACT` remain
`NONE`; no `OC-C3D-*` disposition changed; `PHASE-C3C-B`'s accepted §36
closeout is untouched. `validate-spec-custody` PASS; `git diff --check` clean.
Next authorizable action: read-only supervisor review of the final corrected
`PHASE-C3D` contract.

# Update 2026-07-21 - PHASE-C3D Material Contract Forward Correction

Phase: `PHASE-C3D` material phase contract correction.
Type: documentation-only; no product, test, script, migration, database,
environment, deployment, or configuration change.

A read-only supervisor review of the `PHASE-C3D` material phase contract
proposed at commit `fc53f9d43bbd28e47c3e84e3893082cc41c41fcf` returned
`CHANGES_REQUIRED` for four material contradictions. All four were corrected
in place, appended as a new §0 in
`docs/architecture/ORDEM_COMPRA_C3D_PHASE_CONTRACT.md`:

1. **Requirement disposition.** The proposal incorrectly implied no
   `OC-C3D-*` requirement could become `SATISFIED` before real cutover.
   Corrected (§M): each of `OC-C3D-DEPLOY-001`, `OC-C3D-FENCE-001`,
   `OC-C3D-ACL-001`, `OC-C3D-LOCK-001` is owned by `PHASE-C3D` and may become
   `SATISFIED` by its own isolated-rehearsal evidence, independent of
   `OC-CUTOVER-001`/`OC-CUTOVER-PONR-001`. No disposition changed by this
   correction itself.
2. **Fence proof scope.** The proposal required the real admin/supplier
   application paths to write directly to all eight protected tables.
   Verified read-only against `js/screens/op-writes.js` and
   `js/screens/fornecedor.js`: both real paths write only
   `ordens_compra_fio`. Corrected (§C, §E, §G, §I) into two evidence classes
   — a real actor-path proof confined to the flat receipt surface, and a
   separate owner-level structural probe of all eight tables in the
   disposable cluster only.
3. **PONR semantics.** The proposal required a concurrent Component B proof
   whose successful commit sets `productive_receipt_started_at` (the PONR)
   while simultaneously claiming an unqualified "PONR = NONE" everywhere in
   C3D. Corrected (§A, §B, §H, §L): a synthetic PONR crossing is permitted
   only inside a disposable rehearsal cluster, exclusively for the C3D-E
   concurrency proof, followed by mandatory full cluster destruction;
   forbidden on `ucrjtfswnfdlxwtmxnoo`, `gqmpsxkxynrjvidfmojk`,
   `bhgifjrfagkzubpyqpew`, and any other shared/persistent environment.
4. **Exact future manifests.** The proposal authorized the open directory
   `scripts/c3d/`, violating the no-wildcard rule. Corrected (§I): replaced
   with the exact file `scripts/c3d/bootstrap-disposable-cluster.mjs`; no
   directory-level or wildcard authorization remains anywhere in the
   contract.

`STATUS` remains `PROPOSED / AWAITING SUPERVISOR ACCEPTANCE / IMPLEMENTATION
NOT AUTHORIZED` (unchanged); `ACTIVE_PHASE`/`ACTIVE_PHASE_CONTRACT` remain
`NONE`; no `OC-C3D-*` disposition changed; `PHASE-C3C-B`'s accepted §36
closeout is untouched. `validate-spec-custody` PASS; `git diff --check`
clean. Next authorizable action: read-only supervisor review of the
corrected `PHASE-C3D` contract.

# Update 2026-07-21 - PHASE-C3C-B Supervisor Acceptance + PHASE-C3D Contract Authored

Phase: `PHASE-C3C-B` acceptance closeout + `PHASE-C3D` material phase contract
authoring.
Type: documentation-only + read-only diagnosis; no product, test, migration,
database, environment, deployment, or configuration change.

The supervisor **ACCEPTED** `PHASE-C3C-B` (application compatibility/adaptation)
as `CLOSED / ACCEPTED_WITH_NONBLOCKING_DEBT / LOCALLY VERIFIED` at checkpoint
`22bfb192c6c2ad10ccd2b2883d54c3a17e40cc9f`
(`docs/architecture/ORDEM_COMPRA_C3C_B_PHASE_CONTRACT.md` §36), over the initial
implementation (`ee5e87c`) and the two corrections (`f9b1a54` then `22bfb192`):
the exact finite RPC-error classifier, real call-site idempotency retention, the
`pedido-detail-events.js` runtime proof, UI-inertness, and the empty full-suite
failing-name differential (122 = 122). The four `OC-C3-*` requirements stay
`PARTIALLY_SATISFIED` (not `SATISFIED`): real `canonical_active` proof and the
real cutover boundary are owned by `PHASE-C3D` / real cutover, and `db/76`
remains unapplied to any staging database.

The `PHASE-C3D` material phase contract was authored at
`docs/architecture/ORDEM_COMPRA_C3D_PHASE_CONTRACT.md`
(`STATUS: PROPOSED / AWAITING SUPERVISOR ACCEPTANCE / IMPLEMENTATION NOT
AUTHORIZED`). It binds the four already-ratified `OC-C3D-*` requirements to an
isolated-rehearsal scope — six proposed sublots (C3D-A environment/deploy
manifest, C3D-B inactive presence, C3D-C fence & rollback, C3D-D ACL/role
matrix, C3D-E concurrency/locks, C3D-F closeout) — an environment strategy
(disposable local PostgreSQL + read-only shared-DB inspection recommended; an
isolated Supabase branch is UNPROVEN and not created; no state-changing
rehearsal against the shared `ucrjtfswnfdlxwtmxnoo`), entry/exit gates, a test
matrix, the recovery/PONR model, exact future manifests, and the mandatory
supervisor decisions. It creates no requirement, changes no anchor, and
authorizes no implementation, migration, branch creation, deployment, or
environment action; no `OC-C3D-*` disposition changes.

A read-only Supabase premise audit against `ucrjtfswnfdlxwtmxnoo` empirically
re-confirmed the inert state (`legacy_active`/`flat`/`not_started`, all markers
null), migration history `74 → 75 → 76`, 64 flat rows = 51 mapped + 13 unmapped
(ids 153–165), 0 receipt rows, and both `db/76` functions present. Branch
availability is `UNPROVEN` (no authorized read-only MCP path could enumerate
branches; none assumed or created).

This entry changes no backlog sequence, dependency, or accepted architecture
(the live-state owner is `PROJECT_STATE.md`): `PHASE-C3C-B` accepted; `PHASE-C3D`
`PROPOSED`. Next authorizable action: read-only supervisor review of the
`PHASE-C3D` contract. `validate-spec-custody` PASS; `git diff --check` clean.

# Update 2026-07-20 - PHASE-C3C-B Final Targeted Correction (Finite RPC-Error Classification + Runtime Idempotency Proof)

Phase: `PHASE-C3C-B` (application compatibility/adaptation).
Type: local JS correction, no database/environment/migration-file change.

A further supervisor order, issued against local commit
`f9b1a54cc7b185a5e72f50209322d1473e93e850`, required two additional gates,
corrected in commit `fix: complete C3C-B retry classification proof`
(`docs/architecture/ORDEM_COMPRA_C3C_B_PHASE_CONTRACT.md` §35):

1. **Finite RPC-error classification.** §34's "any RPC-call-level error
   except exact `42883` ⇒ `ambiguous_failure`" rule was overbroad. Replaced
   with a finite predicate grounded in the real `@supabase/postgrest-js`
   response shape (the vendored copy in
   `services/documents-ingestor/node_modules/` was inspected directly):
   `status === 0` is the only signal produced when the `fetch()` call itself
   never receives an HTTP response (network failure, DNS failure, timeout,
   abort, CORS); every deterministic server response — success or error —
   carries a real HTTP status. `isTransportAmbiguous(res)` now checks
   `!!res.error && res.status === 0` exactly; every other error (permission
   `42501`, data `22P02`, PGRST-prefixed, or any other received response) is
   `hard_failure` and closes the attempt, never retains it.
2. **Runtime idempotency proof for `pedido-detail-events.js`.** The prior
   proof for this call-site's `buildInsumosTransferForm` was static-only
   (source-pattern regex assertions). `tests/pedido-detail.smoke.js`'s
   existing `makeHubRuntime()` harness was extended to also load the real
   adapter and `js/screens/op-writes.js`; two new tests now drive the real
   `handlers.openMovementModal(...)`'s "Registrar recebimento" button
   through real DOM clicks against a stateful mocked `window.supa`, proving
   token retention/renewal across ambiguous/deterministic/success outcomes
   and exactly-one-flat-write on the inactive signal, at runtime. No
   product-code extraction was needed.

Only `js/screens/ordem-compra-receipt-cutover.js` (product) and five test
files changed. Full mandatory Node suite (3993 tests, +8 from this
correction's own tests) has the same 122-failure set as the `f9b1a54`
baseline — byte-for-byte identical failing-name set, zero regressions
attributable to this correction; `validate-spec-custody` PASS; `git diff
--check` clean.
`STATUS: IMPLEMENTED / LOCALLY VERIFIED / AWAITING SUPERVISOR ACCEPTANCE`
(contract §35) — unchanged; this correction does not record supervisor
acceptance. No dependent `OC-C3-*` requirement is `SATISFIED`. Next
authorizable action: supervisor review/acceptance of this corrected
implementation.

# Update 2026-07-20 - PHASE-C3C-B Supervisor-Review Correction (Idempotency Retention + Exact 42883)

Phase: `PHASE-C3C-B` (application compatibility/adaptation).
Type: local JS correction, no database/environment/migration-file change.

A supervisor review of the implementation at commit `ee5e87cd90f9e418925a99d6d51ad43cd38bedf0`
returned `CHANGES_REQUIRED` for two blocking defects, corrected in commit
`fix: preserve C3C-B receipt idempotency attempts`
(`docs/architecture/ORDEM_COMPRA_C3C_B_PHASE_CONTRACT.md` §34):

1. Real receipt UI closures created a new idempotency attempt on every
   invocation instead of retaining one across a retry of unchanged intent.
   `js/screens/ordem-compra-receipt-cutover.js` gained `createAttemptTracker()`
   (intent-aware retention: same intent + a prior ambiguous transport failure
   reuses the token; a changed field or any deterministic outcome mints a new
   one); `js/screens/op-writes.js`'s `registrarRecebimentoOrdemFio` now
   accepts a caller-owned `attempt` and reports `ambiguous` so the caller
   knows whether to retain or close its tracker; the real call-sites
   (`js/screens/op-writes.js`'s own internal fallback creation,
   `js/screens/fornecedor.js`'s independent writer, `js/screens/op-nova.js`'s
   `buildOrdemPendenteRow`, `js/screens/pedido-detail-events.js`'s
   per-line `buildInsumosTransferForm`) now each own and pass their tracker.
2. `isMissingCompatFunction` accepted a message-text alternative
   (`/function .* does not exist/i`) beyond the contracted exact `42883`
   SQLSTATE; the alternative was removed — only `error.code === '42883'`
   now classifies as the bounded missing-function fallback.

Full mandatory Node suite (3985 tests, +25 from this correction's own
tests) has a 122-failure set — 2 fewer than the 124-failure baseline (both
incidental fixes of pre-existing CRLF-unaware regex assertions in
`tests/pedido-detail.smoke.js` sharing a string this correction's test edit
also touched, not an intentional scope change); every other failure is the
same pre-existing, unrelated set — zero regressions attributable to this
correction; `validate-spec-custody` PASS; `git diff --check` clean.
`STATUS: IMPLEMENTED / LOCALLY VERIFIED / AWAITING SUPERVISOR ACCEPTANCE`
(contract §34) — unchanged; this correction does not record supervisor
acceptance. No dependent `OC-C3-*` requirement is `SATISFIED`. Next
authorizable action: supervisor review/acceptance of this corrected
implementation.

# Update 2026-07-20 - PHASE-C3C-B Application-Adapter Implementation

Phase: `PHASE-C3C-B` (application compatibility/adaptation).
Type: local JS application-adapter implementation, no database/environment/
migration-file change.

Activated by `docs/architecture/ORDEM_COMPRA_C3C_B_PHASE_CONTRACT.md` §32
(forward correction closing the §25/§26 database blockers, once
`docs/architecture/ORDEM_COMPRA_C3C_B_DB_PREREQUISITES_PHASE_CONTRACT.md` §39
recorded supervisor acceptance of the applied `db/75`+`db/76`
development-database stack). Implemented the shared adapter
`js/screens/ordem-compra-receipt-cutover.js` (pure, no DOM; knows only
`listar_ordens_compra_fio_compat`/`registrar_recebimento_ordem_compra_fio_compat`,
their inactive signals, the bounded `42883` interval, and the fail-closed
error set) and adapted the nine other authorized product paths
(`js/screens/op-writes.js`, `js/screens/fornecedor.js`,
`js/screens/pedido-detail-data.js`, `js/screens/op-nova.js`,
`js/screens/op-persistir.js`, `js/screens/op-recalculo.js`, `index.html`;
`pedido-detail-events.js`/`delete-helpers.js` required no change).
Full mandatory Node suite (3960 tests) has the identical 124-failure set as
the pre-phase baseline (`git stash` comparison, byte-identical failing-test
list) — zero regressions; `validate-spec-custody` PASS; `git diff --check`
clean. `STATUS: IMPLEMENTED / LOCALLY VERIFIED / AWAITING SUPERVISOR
ACCEPTANCE` (contract §33). No dependent `OC-C3-*` requirement is
`SATISFIED`. This entry changes no backlog sequence, dependency, or accepted
architecture — the earlier "C3C-B remains the next product implementation
lot but is not authorized" framing further below in this file is superseded
by this entry per the live-state banner above (`PROJECT_STATE.md` remains the
sole live-state owner). Next authorizable action: supervisor review/
acceptance of this implementation.

# Update 2026-07-20 - db/75+db/76 Applied to Development Database (Inert)

Phase: development/legacy-database application of the accepted inactive C3C stack
(descriptive environment action; no existing canonical phase ID).
Type: controlled environment action, DEVELOPMENT DB (`ucrjtfswnfdlxwtmxnoo`), no
product/normative/migration-file change.

The separately authorized development/legacy-database application applied the
byte-exact accepted migrations `db/75_ordem_compra_c3c_inactive_cutover.sql`
(Supabase version `20260720234958`) then
`db/76_ordem_compra_c3c_b_db_prerequisites.sql` (version `20260720235820`) to
`ucrjtfswnfdlxwtmxnoo` via Supabase MCP `apply_migration`. Both installed
**inert**: the cutover singleton stays `legacy_active`/`flat` with every
snapshot/import/ACL/activation/`productive_receipt_started_at` field null;
`db/76`'s two functions return only their inactive signals
(`listar_compat_inativo` / `recebimento_compat_inativo`); `comando_tipo` is
unchanged (no `recebimento_compat`); no bridge trigger, no backfill, no new
compat mapping (`ordem_compra_item_compat_fio` = 51); seven business-table
fingerprints are byte-for-byte unchanged. No fence, snapshot, import, ACL
closure, activation, read switch, cutover, productive receipt, deployment, or
product adaptation occurred; production / `main` / `origin` were not accessed.
Static validation clean (`validate-spec-custody` PASS, static smoke 49/49,
`git diff --check` clean); the four DB-backed tests were **NOT RUN** against the
shared dev DB because they exercise the prohibited fence/import/activation
machinery (accepted local PASS in contract §36 stands). 13 unmapped
post-REFUND-A legacy flat rows (`ordens_compra_fio` ids 153–165, all
draft/pending/never-received) are recorded as a DOCUMENTARY real-cutover/C3D
completeness finding, not a blocker. `STATUS: APPLIED / DEVELOPMENT DB VERIFIED /
AWAITING SUPERVISOR ACCEPTANCE` (contract §38). No dependent `OC-C3-*`
requirement is `SATISFIED`. This entry changes no backlog sequence, dependency,
or accepted architecture. Live state, next authorizable action (supervisor
review/acceptance of this environment application), and debts remain solely
owned by `PROJECT_STATE.md`.

# Update 2026-07-20 - PHASE-C3C-B-DB-PREREQ DB-Backed Validation Completion

Phase: `PHASE-C3C-B-DB-PREREQ` (validation continuation)
Type: DB-backed validation, `LOCAL_ONLY`, isolated disposable Postgres cluster.

The prior entry reported the two new DB-backed tests as authored but not
executed (host PostgreSQL crash-looping). This pass stood up a disposable,
isolated local PostgreSQL 18.4 cluster (initdb/pg_ctl, distinct port, outside
the repository and the host's broken cluster), applied the full `db/01`…`db/76`
sequence, reapplied `db/76` alone (idempotent), ran both new DB-backed tests
(`…integration.sql`, `…concurrency.mjs` — both PASS), rehearsed a real persisted
rollback (drop both functions, restore both prior constraints, confirm zero
bridge/backfill/compat rows required reversal) and reapplied, then reran both
tests again (PASS). One genuine `db/76` defect (a PL/pgSQL column/OUT-parameter
naming ambiguity in Component A) was found and corrected in-scope; several
test-file-only defects were also corrected, confined to the three C3C-B test
files. The two C3C-A DB-backed regressions remain genuinely unexecutable
against any synthetic corpus (they assert exact real historical aggregate
values, a pre-existing characteristic unrelated to `db/76`). `STATUS:
IMPLEMENTED / LOCAL DB VERIFIED / AWAITING SUPERVISOR ACCEPTANCE`. This entry
changes no backlog sequence, dependency, or accepted architecture. Current live
state, next authorizable action (`PHASE-C3C-B-DB-PREREQ-SUPERVISOR-REVIEW`),
and debts remain solely owned by `PROJECT_STATE.md`.

# Update 2026-07-20 - PHASE-C3C-B-DB-PREREQ Implemented / Locally Verified

Phase: `PHASE-C3C-B-DB-PREREQ`
Type: implementation (database prerequisites), `LOCAL_ONLY`.

The architect authorized and this pass implemented the two blocking database
prerequisites as `db/76_ordem_compra_c3c_b_db_prerequisites.sql`: Component A
(`listar_ordens_compra_fio_compat`) and Component B
(`registrar_recebimento_ordem_compra_fio_compat`), both installed inert and
active only under `canonical_active`, plus one additive `idempotency_namespace`
`CHECK` extension (no bridge, no backfill, no `db/67`/`db/75` change). The
corrected `§R.29.7`/`§13.18` normative deltas (contract §34.2/§34.3) were applied.
An implementation-time material finding — the installed
`trg_native_lancamento_shape_guard` couples `comando_tipo` to each ledger line's
`tipo` — was resolved by an architect ruling (contract §35): legacy-compat
receipts reuse the native command types (`recebimento`/`estorno`) and carry compat
identity solely in `idempotency_namespace='legacy_compat_receipt_v1'`; no
`recebimento_compat` type is introduced. Local verification: the new static smoke
suite plus the static-smoke regressions PASS; the two DB-backed tests are authored
to §34.4 but not executed (local Postgres unstable). `STATUS: IMPLEMENTED /
LOCALLY VERIFIED / AWAITING SUPERVISOR ACCEPTANCE`. This entry changes no backlog
sequence, dependency, or accepted architecture. Current live state, next
authorizable action (`PHASE-C3C-B-DB-PREREQ-SUPERVISOR-REVIEW`), and debts remain
solely owned by `PROJECT_STATE.md`.

# Update 2026-07-20 - C3C-B Contract Accepted With Blocking Database Prerequisites

Phase: `C3C-B-DB-COMPATIBILITY-PREREQUISITES-CONTRACT-R1`
Type: docs-only, read-only-repository-inspection documentation patch.

Supervisor review of `C3C-B-MATERIAL-PHASE-CONTRACT-R1` returned
`CHANGES_REQUIRED`; the resulting forward correction (two database hard stops)
was accepted as `ACCEPTED_WITH_BLOCKING_DATABASE_PREREQUISITES / IMPLEMENTATION
NOT AUTHORIZED`. The two database prerequisites (canonical order-catalog
projection; atomic legacy receipt-intent adapter) are now bound to an exact
design at `docs/architecture/ORDEM_COMPRA_C3C_B_DB_PREREQUISITES_PHASE_CONTRACT.md`
(`PHASE_ID: PHASE-C3C-B-DB-PREREQ`, `PROPOSED / AWAITING SUPERVISOR ACCEPTANCE
/ IMPLEMENTATION NOT AUTHORIZED`). Implementation of neither contract is
authorized. This entry changes no backlog sequence, dependency, or accepted
architecture. Current live state, next authorizable action, and debts remain
solely owned by `PROJECT_STATE.md`.

# Update 2026-07-20 - C3C-B Material Phase Contract Authored

Phase: `C3C-B-MATERIAL-PHASE-CONTRACT-R1`
Type: docs-only, read-only-repository-inspection documentation patch.

The C3C-B material phase contract has been authored at
`docs/architecture/ORDEM_COMPRA_C3C_B_PHASE_CONTRACT.md` (governing requirement
IDs `OC-C3-READ-001`, `OC-C3-WRITE-001`, `OC-C3-COMPAT-001`, `OC-C3-NOUI-001`).
Implementation remains unauthorized; supervisor acceptance of the contract is
required before any `PHASE-C3C-B` implementation order. This entry changes no
backlog sequence, dependency, or accepted architecture. Current live state,
next authorizable action, and debts remain solely owned by `PROJECT_STATE.md`.

# Update 2026-07-06 - OP Create Requires Pedido Guard B

Phase: `RAVATEX-TAPETES-OP-CREATE-REQUIRES-PEDIDO-GUARD-B`
Status: **TECHNICAL PATCH READY - AWAITING USER VISUAL VALIDATION**

Gap closed in frontend/persistence JS: creating an OP without a Pedido via the
`Nova OP` button, via direct URL `#/ops/nova`, or via `persistirOP` without
`pedidoId` is no longer allowed. The user must start from the Pedido and use
the `#/ops/nova?pedido_id=<uuid>` route.

Result:

| Item | State |
|---|---|
| Standalone `Nova OP` button | Guides with a toast and sends to `#/pedidos`. |
| Direct URL `#/ops/nova` | Renders a block with CTA `Ir para Pedidos`. |
| `persistirOP` without Pedido | Returns `pedido_required` before `op_numeros` or writes. |
| OP with Pedido | Remains allowed and writes `lotes.pedido_id`. |
| Staging diagnostic | New read-only script returns ALERT for orphaned historical data. |

New P1 technical backlog item:

| Field | Value |
|---|---|
| **Item** | `OP-LATEX-RPC-REQUIRES-PEDIDO-GUARD-C` |
| **Priority** | P1 |
| **Symptom** | Even with the UI blocked, RPCs such as `gerar_op_latex` still need an explicit backend guard to prevent a child OP from being created from an OP/lote without a Pedido. |
| **Likely files** | migrations/RPCs `gerar_op_latex`, `gerar_op_latex_split`, and related diagnostics. |
| **Acceptance criterion** | RPC rejects an origin without `lotes.pedido_id` with a controlled error; diagnostic proves there is no new path for orphan creation; does not affect valid OPs with a Pedido. |
| **Dependencies** | Explicit authorization for SQL/migration in a separate phase. |

Historical staging data remains without cleanup: `OPs com lote_id NULL: 0`,
`OPs cujo lote.pedido_id IS NULL: 11`, `Lotes com pedido_id IS NULL vinculados
a OPs: 9`. Any real backfill/fix must be its own phase, with a reviewed
script and explicit authorization.

# Update 2026-07-06 - OP Create Requires Pedido RPC Guard C

Phase: `RAVATEX-TAPETES-OP-CREATE-REQUIRES-PEDIDO-RPC-GUARD-C`
Status: **STAGING APPLY OK — VERIFIED / CLOSEOUT**

P1 item `OP-LATEX-RPC-REQUIRES-PEDIDO-GUARD-C` prepared in
`db/33_op_latex_requires_pedido_guard.sql`.

| Item | State |
|---|---|
| `gerar_op_latex` | Guards `ops.lote_id -> lotes.pedido_id` before numbering/creating the OP. |
| `gerar_op_latex_split` | Same guard before numbering/creating the split. |
| Origin OP without lote/Pedido | Controlled error; no child OP created. |
| Origin OP with Pedido | Flow from `db/29` preserved. |
| Orphan diagnostic | Lists individual context and A/B/C/D classification, read-only. |
| Staging | Migration ready; application still pending. |

Historical data remains only diagnosed: `0` OPs with `lote_id NULL`,
`11` OPs whose `lote.pedido_id IS NULL`, `9` lotes without a Pedido linked
to OPs. This round's classification: A=6 (`op_id` 1,2,3,4,9,15), B=4 (`op_id`
5,6,7,8), C=0, D=1 (`op_id` 10). No cleanup/backfill, no global constraint,
no production.

# Update 2026-07-06 - OP Operational Code Closeout C

# Update 2026-07-06 - OP Operational Code Admin Wide Expand D

Phase: `RAVATEX-TAPETES-OP-OPERATIONAL-CODE-ADMIN-WIDE-EXPAND-D`
Status: **TECHNICAL PATCH READY - AWAITING USER VISUAL VALIDATION**

Expansion applied to the operational Admin screens with a resolvable Pedido:
`painel.js`, `ops-list.js`, `op-nova.js`, `op-tecelagem-producao-admin.js`,
`op-latex-admin.js`, and `expedicao-admin.js`.

| Screen | OP -> Pedido | Siblings |
|---|---|---|
| `painel.js` | `lote_id -> lotes.pedido_id -> pedidos` already loaded | `opsByPedido` in memory, zero new query |
| `ops-list.js` | additive SELECT `lote.pedido_id` + `pedido:pedido_id(id,numero,criado_em)` | full list of OPs loaded on the screen |
| `op-nova.js` / `op-tecelagem-producao-admin.js` | `pedidoCtx` (`criadoEm` normalized) | light query `lotes do pedido -> ops desses lotes` |
| `op-latex-admin.js` | `op.lote.pedido_id`; without pedido falls back to legacy | light query for Pedido + siblings when there is a `pedido_id` |
| `expedicao-admin.js` | `pedido:pedido_id(...,criado_em)` | light query by lotes of the Pedido |

Guarantees: the T/A/seq rule remains only in `js/op-display.js`; legacy appears
as `Nº interno {numero}/{ano}` when there is an operational code and as a
fallback when there is no context; no new SQL/migration/real data; does not
change `ops.numero`, `ops.ano`, `op_numeros`, RPCs, PDFs, or fornecedor/RLS.

Required tests and read-only staging diagnostics green. User visual
validation pending.

Phase: `RAVATEX-TAPETES-OP-OPERATIONAL-CODE-CLOSEOUT-C`
Status: **OK VISUAL IN SCOPE WITH PEDIDO CONTEXT** (documentary closeout)

User visual acceptance: the operational identification
`OP {pedido}/{ano}-{tipo}{seq}` appeared in the main places and worked.
Appearing "in a few places" is expected: the code only appears where there is
reliable Pedido context; without context, the legacy `OP {numero}/{ano}` is
kept. There is no global display goal for now.

Consolidated rule: `OP {pedido_numero}/{year(pedido.criado_em)}-{tipo}{seq}`
(`OP 25/2026-T01`); `T=Tecelagem`, `A=Acabamento/Latex`; `seq` per Pedido+Tipo
by `ops.criado_em`/`ops.id`; fallback `OP {numero}/{ano}`; single formatting
in `js/op-display.js`.

Validated scope: Pedido Detail Admin (linked OPs, related OPs, arrow modals,
hub, `tecPendingAcceptance`, `relatedOpsLabel`, docs/expedicao). Legacy by
decision: PDFs, fornecedor/RLS, toasts, logs, diagnostics, screens without
context (`ops-list`, `op-latex-admin`, `op-tecelagem-producao-admin`,
`op-nova`, `expedicao-admin`, `painel`).

Controlled pending item: expand to other screens only when (1) reliable
Pedido context; (2) clear visual need; (3) no migration; (4) no heavy query;
(5) no duplication of formatting outside `js/op-display.js`. Candidates:
`painel.js`, `expedicao-admin.js`. No new functional expansion in this phase.

Documentary closeout: functional test suite already green on commit `d7f57c4`
(op-display 20/20, pedido-detail 163/163, mandatory 337/337); minimal
revalidation for this phase in `op-display.smoke.js` + `pedido-detail.smoke.js`.

# Update 2026-07-06 - OP Operational Code Helper B

Phase: `RAVATEX-TAPETES-OP-OPERATIONAL-CODE-HELPER-B`
Status: **TECHNICAL PATCH READY - AWAITING USER VISUAL VALIDATION**

Scope: central helper for OP operational identification and use of that
display on screens with Pedido context. No SQL, no migration, no changes to
data/RPC/`op_numeros`/`ops.id/numero/ano`.

Contract: `OP {pedido_numero}/{pedido_ano}-{tipo}{seq}` (e.g., `OP 21/2026-T01`,
`OP 21/2026-A02`). `pedido_ano = year(pedido.criado_em)`; `T=tecelagem`,
`A=latex/acabamento`; `seq` = 2 digits per Pedido+Tipo, ordered by
`ops.criado_em` asc, tiebreak `ops.id` asc. Mandatory fallback to legacy
`OP {numero}/{ano}` without reliable Pedido context.

| Item | Result |
|---|---|
| Central helper | `js/op-display.js` -> `window.RAVATEX_OP_DISPLAY`; pure; loaded after `js/badges.js`. |
| Pedido Detail | Operational display on linked OPs, related OPs, arrow modals, hub, `tecPendingAcceptance`, `relatedOpsLabel`, and document/expedicao labels. Legacy number/year as secondary reference. |
| Data | `pedido-detail-data.js` selects `ops.criado_em` (additive SELECT). |
| Legacy kept | PDFs, fornecedor/RLS, global toasts, `ops-list`, `op-latex-admin`, `op-tecelagem-producao-admin`, `op-nova`, `expedicao-admin`, `painel`. |
| Next increment | `painel.js` + `expedicao-admin.js` (has context; only needs OP->Pedido resolution, no new query). |

Tests: new `tests/op-display.smoke.js` (20/20) and 2 integration cases in
`tests/pedido-detail.smoke.js` (now 163/163). Mandatory set 337/337.
Read-only staging diagnostics OK (0 violations/collisions).

Guarantees: no SQL, no migration, no new real data, no changes to
`op_numeros`/RPC/`ops`, no touching production, no writes to `origin`.

# Update 2026-07-06 - Pedido Flow UI Audit Fix R1

Phase: `RAVATEX-TAPETES-PEDIDO-FLOW-UI-AUDIT-FIX-R1`
Status: **TECHNICAL PATCH READY - AWAITING USER VISUAL VALIDATION**

Scope of this fix: address the medium misalignments from the read-only audit
of the Pedido flow range without reworking UX or changing product rules.

Result by item:

| Item | Result |
|---|---|
| B2-label | Fixed. Active arrows now use specific, short labels: `Iniciar`, `Receber`, `Transferir`, `Movimentar`, `Entregar`. Modals/CTAs use the contract's explanatory texts. |
| E2-E5 | Proven/covered. Arrow modal writes remain canonical and success re-renders the modal itself via `refreshPedidoTransitionModal(...)`. |
| C3-done | No functional conflict; recorded as safe overlap. `adminStepper` and `applyFormalPendingStage` preserve the rule: `concluido` only without relevant operational balance and without relevant pending OP. Centralization refactor remains a P2 technical item if it resurfaces. |
| D1/D3 | Kept as P2 polish, outside the main patch. |

Final labels of the range:

- `Insumos -> Tecelagem` without OP: arrow `Iniciar`; modal/CTA `Gerar primeira OP`.
- `Insumos -> Tecelagem` with OP: arrow `Receber`; modal
  `Registrar recebimento de insumos`.
- `Tecelagem -> Acabamento`: arrow `Transferir`; modal/CTA
  `Transferir para Acabamento`.
- `Acabamento -> Expedicao`: arrow `Movimentar`; modal/CTA
  `Movimentar para Expedicao`.
- `Expedicao -> Entrega`: arrow `Entregar`; modal `Registrar entrega`.

Guarantees preserved: no SQL, no migration, no new real data, no parallel
write on the Pedido, no direct update to `ops.status`, no touching
production, and no writes to `origin`.

Required tests OK: `pedido-detail` 161/161, `pedido-detail-linked-ops`
7/7, `tec-to-acabamento-flow` 39/39, `expedicao-partial-flow` 12/12,
`expedicao-flow` 8/8, `op-latex-admin` 55/55,
`production-flow-invariants` 11/11. Read-only staging diagnostics OK:
flow invariants, Latex consolidation, and partial expedicao.

# Update 2026-07-05 - Pedido Insumos Tecelagem Modal Parity And Refresh R1

Phase: `RAVATEX-TAPETES-PEDIDO-INSUMOS-TECELAGEM-MODAL-PARITY-AND-REFRESH-R1`
Status: **TECHNICAL PATCH READY - AWAITING USER VISUAL VALIDATION**

Reopening: visual validation showed that the `Insumos -> Tecelagem` arrow
still did not respect the "no OP, no material" contract, and that actions
executed inside the arrow modal could leave the content stale or close
before the next operational state.

Parity contract applied:

| Axis | Required reference | Decision applied |
|---|---|---|
| Transition operational modal | Tecelagem -> Acabamento | The arrow modal remains the place for the next action, with a form when there is a real operation and auxiliary context afterward. |
| No OP | Product rule "no OP, no material" | Insumos -> Tecelagem without OP shows no receiving, shows no empty history, and offers `Gerar primeira OP`. |
| Acceptance/proposal | OP Tecelagem screen | Open OP with received insumos shows a real proposal with slider and `Aceitar proposta`, using `aplicarRecalculoOP`. |
| Post-action | Continuous flow in the same modal | Receiving and acceptance call refresh/re-render of the modal itself, without requiring close/reopen. |

Diagnostic matrix:

| Case | Before | After |
|---|---|---|
| Insumos -> Tecelagem without OP | `pedido-detail-progress.js` kept the title `Registrar recebimento de insumos` even without an OP; the modal fell into a context/history state and could induce a nonexistent operation. | Title/detail without OP become creation of the first OP; `openMovementModal` renders a clear block, `Nao e possivel registrar material sem OP vinculada.`, and CTA `Gerar primeira OP`; `buildInsumosTransferForm` has a defensive guard without OP. |
| OP Tecelagem pending acceptance | `buildRelatedOpsSection` already resolved the related OP and `buildTecAcceptanceProposalBlock` already rendered the slider/proposal, but acceptance success did not update the arrow modal. | The proposal receives `onAfterSuccess` and uses `refreshPedidoTransitionModal`, keeping the canonical handler/RPC and removing the stale slider/button after success. |
| After registering receipt | `registrarRecebimentoOrdemFio` was canonical, but the modal closed after success. | Success calls `refreshPedidoTransitionModal`, reloads Pedido/OPs/chain-state, and shows the next state in the same modal. |
| Parity Tecelagem -> Acabamento | Validated flow already had form first, auxiliary related OPs, `Transferir restante`, and `salvarEntregaCima`. | Pattern preserved; technical difference: without an initial OP there is no form because there is neither a source OP nor receivable orders yet. |

Functional files: `js/screens/pedido-detail-events.js`,
`js/screens/pedido-detail-progress.js`. Tests: `tests/pedido-detail.smoke.js`
gained runtime coverage for no OP, open OP with slider/proposal, acceptance
with modal refresh, and receipt with refresh to proposal.

Results: required tests OK (`pedido-detail` 160/160,
`pedido-detail-linked-ops` 7/7, `tec-to-acabamento-flow` 39/39,
`expedicao-partial-flow` 12/12, `expedicao-flow` 8/8,
`op-latex-admin` 55/55, `production-flow-invariants` 11/11). Read-only
staging diagnostics OK: flow invariants, Latex consolidation, and partial
expedicao.

Confirmations: no parallel write on the Pedido, no direct update to
`ops.status`, no SQL, no migration, no new real data, no accepting a real OP,
no registering a real receipt, no finalizing a real OP, no completing a
pedido, production/origin untouched, and `supabase/.temp/` outside the
commit. User visual validation remains pending; do not declare the backlog
zeroed by this phase.

# Update 2026-07-05 - Acabamento Expedicao Modal UX Parity R2

Phase: `RAVATEX-TAPETES-ACABAMENTO-EXPEDICAO-MODAL-UX-PARITY-R2`
Status: **TECHNICAL PATCH READY - AWAITING USER VISUAL VALIDATION**

Reopening: visual validation showed the operational gate was correct, but the
`Acabamento -> Expedicao` modal experience did not follow the pattern already
validated for `Tecelagem -> Acabamento`.

Parity diagnostic:

| Item | Validated Tecelagem -> Acabamento | Acabamento -> Expedicao before | Decision |
|---|---|---|---|
| Main form | `buildEntregaInlineForm` in `layout: 'stacked'` | own form below context/history | align visual order |
| Products | `Produtos a transferir` card + `Preencher restante` | compact grid without the same visual weight | align by parity |
| Related OPs | auxiliary context | standalone `Movimentar` button | replace with selection/loading |
| Canonical write | `salvarEntregaCima` | `liberar_expedicao_latex_parcial` | justified difference, keep |
| Lifecycle | separate finalization | separate finalization | keep |

Fix: the operational form now appears as the center of the modal and before
related OPs, items, history, and documents. Related OP with balance uses
`Carregar nesta movimentacao`, updates the source OP/balance/products in the
modal itself, and does not call the RPC automatically. The movement continues
via the main `Movimentar para Expedicao` button, using
`liberar_expedicao_latex_parcial`.

Remaining differences and justification: the helper/form is not the same as
Tecelagem because the data contract is different (`salvarEntregaCima` creates
a top-side entry and a possible Latex OP; Acabamento -> Expedicao releases
balance to expedicao via a partial RPC). The technical difference was
documented and preserved; the purely visual divergences were aligned.

Tests: `pedido-detail.smoke.js` 156/156 and mandatory complementary suite
132/132. Read-only staging diagnostics OK: flow invariants, Latex
consolidation, and partial expedicao. No SQL, no migration, no new real data,
no parallel write on the Pedido, no requirement to finalize the Latex OP, and
no use of `origin`.

# Update 2026-07-05 - Acabamento Expedicao Modal Move R1

Phase: `RAVATEX-TAPETES-PEDIDO-ACABAMENTO-EXPEDICAO-MODAL-MOVE-R1`
Status: **COMPLETED - PATCH VALIDATED LOCALLY, READ-ONLY STAGING DIAGNOSTICS OK, AND STAGING PUSH DONE**

Reopened item: the `Acabamento -> Expedicao` arrow in Pedido Detail Admin must
allow moving an Acabamento/Latex OP with received balance directly in the
arrow modal, including when the Latex OP is `aberta`. Finalizing the Latex OP
remains a separate action and is not a prerequisite for releasing balance to
Expedicao.

Staging push done on `work/app-next`: `76195b1..fce09b1`.

Root cause: `openMovementModal` only entered transfer mode when
`chainState.actions.releaseExpedicao.mode` was `enabled`. That gate did not
consider a Latex OP `aberta` as movable, even with received balance; because
of this the modal fell back to history/read-only. The related OPs list had a
similar filter and could show "Nenhuma acao contextual..." on the loaded OP.

Scope delivered:

- `js/screens/pedido-chain-state.js`: a Latex OP `aberta` passes the movement
  gate when there is a received/releasable balance.
- `js/screens/pedido-detail-progress.js`: the Acabamento transfer uses the OP
  selected by `releaseExpedicao`, not necessarily the first OP in the list.
- `js/screens/pedido-detail-events.js`: the modal shows the source OP,
  balance, pending products, per-product inputs, the `Transferir restante`
  button, and the effective action `Movimentar para Expedicao`; related OPs
  with balance receive `Movimentar`; the already-loaded OP no longer falls
  into the generic no-action text.
- `tests/pedido-detail.smoke.js`: covers Latex OP `aberta` with balance,
  triggering via the arrow modal, partial payload for
  `liberar_expedicao_latex_parcial`, reload/render after success, and
  blocking of a `simulada` OP.

Preserved contract:

- Movement writes only via the canonical RPC
  `liberar_expedicao_latex_parcial`.
- No parallel write on the Pedido, no requiring `concluida`/`finalizada`, no
  implicitly finalizing the Latex OP, and no creating an OP/Expedicao outside
  the canonical flow.
- The canonical read-only reading of the OP Latex screen remains in
  `consultar_saldo_expedicao_latex`; the Pedido uses its consolidated state to
  render the modal and reloads after saving.

Tests and diagnostics:

- `node --test tests\pedido-detail.smoke.js` = 155/155
- `node --test tests\pedido-detail-linked-ops.smoke.js tests\expedicao-partial-flow.smoke.js tests\expedicao-flow.smoke.js tests\op-latex-admin.smoke.js tests\tec-to-acabamento-flow.smoke.js tests\production-flow-invariants.smoke.js` = 132/132
- Read-only staging OK: `production-flow-invariants-diag`,
  `latex-consolidation-diag`, `expedicao-partial-flow-diag`

Confirmations: no SQL, no migration, no new real data, no accepting a real
OP, no finalizing a real OP, no real transfer in staging, no completing a
pedido, no changing OP lifecycle, no `git add .`, `supabase/.temp/` outside
the commit, production/origin untouched. Admin/Pedido backlog should still
not be declared zeroed without user visual validation.

# Update 2026-07-05 - Transition Modal Related Ops Actions R2

Phase: `RAVATEX-TAPETES-PEDIDO-TRANSITION-MODAL-RELATED-OPS-ACTIONS-R2`
Status: **TECHNICAL PATCH READY - AWAITING USER VISUAL VALIDATION**

Reopened item: the correct behavior of the Pedido Detail Admin arrows is to
open the transition/movement modal. The stage dot opens the stage hub. The
previous failure diverted the `Aguardar` arrow to the hub
(`openStageDetailModal`), copying the dot's behavior and breaking the
original requirement to keep the transition experience in the arrow modal.

Scope delivered:

- `js/screens/pedido-detail-render.js`: rendered arrows/connectors call
  `openMovementModal(stage.transfer)`; dots continue calling
  `openStageDetailModal(stage, view)`.
- `js/screens/pedido-detail-events.js`: `openMovementModal` received the
  `OPs relacionadas` section, with Tecelagem, Acabamento/Latex, and Expedicao
  OPs related to the current transition.
- Contextual actions in the arrow modal: `Abrir OP`, `Movimentar` when there
  is applicable balance, `Finalizar OP` via the canonical handler, and an
  acceptance proposal for an open (`aberta`) OP Tecelagem.
- Tecelagem acceptance: not implemented as a simple button. The real
  acceptance/proposal UI lives in `js/screens/op-nova.js` (`buildProposta`)
  and the canonical write in `js/screens/op-recalculo.js`
  (`aplicarRecalculoOP`). The Pedido reuses the global proposal, slider, and
  recalculation helpers, without creating a parallel `.from('ops').update`.

Tests and diagnostics:

- `node --check js\screens\pedido-detail-events.js`
- `node --check js\screens\pedido-detail-render.js`
- `node --test tests\pedido-detail.smoke.js` = 150/150
- `node --test tests\pedido-detail-linked-ops.smoke.js` = 7/7
- `node --test tests\tec-to-acabamento-flow.smoke.js` = 37/37
- `node --test tests\op-latex-admin.smoke.js` = 55/55
- `node --test tests\expedicao-partial-flow.smoke.js` = 12/12
- `node --test tests\expedicao-flow.smoke.js` = 8/8
- `node --test tests\production-flow-invariants.smoke.js` = 11/11
- Read-only staging OK: `production-flow-invariants-diag`,
  `latex-consolidation-diag`, `expedicao-partial-flow-diag`

Confirmations: no SQL, no migration, no new real data, no accepting a real
OP, no finalizing a real OP, no transfer, no completing a pedido, no changing
OP lifecycle, no changing Acabamento -> Expedicao, no parallel write on the
Pedido, no `git add .`, `supabase/.temp/` outside the commit,
production/origin untouched.

Pending visual criterion: Pedido #13 should show the `Aguardar` arrow opening
the transition modal with `OPs relacionadas` and a real acceptance proposal
when the OP Tecelagem is open (`aberta`); the Tecelagem dot should continue
opening the hub. Pedido #14 should validate Tecelagem -> Acabamento;
Pedido #21 can be used as a general capable flow. Do not declare the
Admin/Pedido backlog zeroed before this visual validation.

# Functional/Architectural Backlog of the Production Flow — Pedido

Phase: `RAVATEX-TAPETES-PRODUCTION-BACKLOG-REGISTER-A`
Date: 2026-07-04
Base: branch `work/app-next`, HEAD `26bf4a14e60c33ce905ebf9b37ff21486ddd87bc`
Previous closed phase: `RAVATEX-TAPETES-PRODUCTION-FLOW-UI-MAP-A`

---

## 1. Proven current operational state

### 1.1 Real path to complete a Pedido

The full production flow of the Pedido is operational. The stepper's 5 stages
(`recebido → confirmado → insumos → tecelagem → acabamento → expedicao → transporte → concluido`,
with `insumos` and `transporte` skippable) are covered by real transitions:

1. **Insumos** — `registrarRecebimentoOrdemFio` (`js/screens/op-writes.js:29`):
   registers kg received in the fio order linked to the Tecelagem OP. Also
   accessible via the canonical call through the Pedido Detail modal
   (`js/screens/pedido-detail-events.js:647`).

2. **Tecelagem → Acabamento** — `salvarEntregaCima` (`js/screens/entrega-writes.js:212`):
   writes an `etapa='cima'` entry + items + calls the `gerar_op_latex` RPC (find-or-accumulate).
   The canonical form is `buildEntregaInlineForm` (`js/screens/entrega-form.js:61`).
   Pedido Detail calls the modal via `openMovementModal` (`js/screens/pedido-detail-events.js:814`).

3. **Acabamento → Expedição** — `liberar_expedicao` (Supabase RPC):
   called in `js/screens/op-latex-admin.js:236`. Creates an expedição linked
   to the finalized latex OP.

4. **Expedição → Entrega** — `registrar_entrega_expedicao` (Supabase RPC):
   called in `js/screens/expedicao-admin.js:272` and
   `js/screens/pedido-detail-events.js:787`. Registers a partial or total
   delivery/pickup; `concluir_pedido_se_pronto` persists the completion when
   there is no balance.

**Phase C receipt-authority correction (C1 accepted 2026-07-19).** Item 1 describes
the current legacy consumer, not the future physical authority. Phase C must evolve
`ordem_compra_fio_lancamentos` into the sole canonical receipt ledger and migrate
both current consumers through one native multi-line RPC. Cotton receipts follow
their concrete real-OP allocation; shared polyester receipts follow each actual
allocation OP without a representative/fake OP; excess stays on the receipt/item
with only a narrow transactional inventory movement. The future admin surface is
`#/ordens-compra/:id` → **Recebimentos**; it does not belong in Pedido/OP/transition
or supplier-assignment modals. Supplier UI is deferred. Delivery sequence is C2
foundation/writers, C3 cutover/import/readers/ACL, C4 admin UI (supplier later), then
C5 separate emission activation. Native emission remains inactive until C1-C4 are
accepted. C1 authorizes no implementation or C2 work; see lifecycle spec §R.24.

**Phase C2 implementation boundary (authorized 2026-07-19).** C2 installs only the
inactive native receipt foundation and verification read model: immutable command
headers, the canonical multi-line admin/matching-supplier receipt RPC, admin-only
reversal, ledger-derived caches, and source-linked surplus movement. The receipt line
is explicitly allocated or excess; allocation supplies the derived real OP for
OP-origin or NULL for shared Pedido-origin, while excess has
no fabricated allocation/OP. Existing Pedido/OP receipt consumers and INSUMOS readers
stay on the flat path in C2. No Pedido, OP, transition, order-detail, or supplier UI is
changed. C3 owns both-consumer cutover/readers/flat ACL; C4 owns the admin receipt UI;
C5 owns emission activation. See lifecycle spec §R.25.

**Phase C2 acceptance closeout (2026-07-19).** Migration
`20260719160518 / 70_ordem_compra_native_receipt_foundation` is implemented and
verified on staging. Focused tests passed 48/48; functional, authorization,
idempotency, immutable-history, derived-cache, source-linked inventory, five-scenario
true-concurrency, cleanup, and rolled-back dependency-safe removal evidence passed.
The legacy corpus, flat consumers/ACL, and native emission gate are unchanged. The
reproducible full-suite baseline is 3,864 tests / 3,731 pass / 133 identified
pre-existing failures: PRE-PROD-A `47b8e6a`, C2 baseline `3395f83`, and checkpoint
`14ca5c7` have the same normalized set (SHA-256
`af9246c162a514f1162d845bb129980f9a1e4505c46323966d8def262a48a192`), so the former
132 aggregate is superseded and C2 has zero regression. Status: `CLOSED / ACCEPTED`.
Flat receipt remains productive authority until C3 cutover; no opening-balance seed or
productive-reader switch occurred. C3/C4/C5 remain unimplemented. The next
authorizable action is a fresh read-only C3 pre-cutover reconciliation and
implementation-boundary diagnosis; no implementation chains from this result.

### 1.2 Main routes/screens

| Route | Screen | Function |
|---|---|---|
| `#/pedidos` | Admin — Pedidos List | `pedidos-list.js` |
| `#/pedidos/<uuid>` | Admin — Pedido Detail | `pedido-detail.js` |
| `#/ops` | Admin — OPs List | `ops-list.js` |
| `#/ops/nova?pedido_id=<id>` | Admin — New OP via Pedido | `op-nova.js` |
| `#/ops/<id>` | Admin — OP Detail | `op-nova.js` / `op-latex-admin.js` |
| `#/expedicoes/<id>` | Admin — Expedição | `expedicao-admin.js` |

### 1.3 Stages that allow partial

- **Tecelagem**: partial deliveries via `salvarEntregaCima` (multiple
  deliveries for the same Tecelagem OP), each accumulating into the
  consolidated Acabamento OP.
- **Expedição**: `registrar_entrega_expedicao` accepts a partial delivery
  with balance tracking.

### 1.4 Manual finalization/completion actions

- **Acabamento finalized**: "Finalizar" button on the OP Látex screen
  (`js/screens/op-latex-admin.js`).
- **Release Expedição**: "Liberar expedição" button on the OP Látex screen.
- **Complete Pedido**: `concluir_pedido_se_pronto` (RPC) — called when
  registering an expedição delivery when there is no pending balance.

### 1.5 Gaps proven by the UI map (phase `PRODUCTION-FLOW-UI-MAP-A`)

| Gap | Detail |
|---|---|
| Ambiguous "Movimentar" buttons | On the OP Látex and Tecelagem screens, "Movimentar" is an anchor/shortcut to the deliveries card, not a real transition action. |
| Arrow modals do not show pending items | The modals opened by the Pedido stepper's arrows do not show what remains to complete between stages. |
| "Transferir restante" does not exist | There is no dedicated action/button to transfer the remaining balance of a stage. |
| Acceptance/adjustment of the OP Tecelagem via the Pedido does not exist | The Pedido offers no interface to review/accept the Tecelagem OP before it enters production. |
| Stepper is not clickable | The Pedido Detail stepper dots are not clickable — only the arrows between stages have handlers. |
| Explicit Tecelagem finalization does not exist | There is no dedicated action to mark Tecelagem as complete. |
| Partial OP↔Pedido visual correlation | The lineage strip exists (production chain in the Tecelagem OP), but the Pedido's visualization of OP links is limited. |
| New requirement: partial split | Exceptionally allow creating a separate OP for a partial, via a select, keeping accumulation as the default. |

---

## 2. Ordered backlog

### A. ACTION-BUTTONS-R1
**Fix ambiguous "Movimentar" buttons/anchors**

- **Problem**: "Movimentar" buttons on the OP Em Produção Tecelagem and OP
  Látex screens work as visual anchors to the deliveries/movement card, not
  as transition actions. This is confusing: the user clicks expecting to
  open a movement modal and instead is scrolled to another card.
- **Scope**: `js/screens/op-tecelagem-producao-admin.js`,
  `js/screens/op-latex-admin.js`.
- **Proposal**: Rename the anchors to an explicit label (e.g., "Ir para
  movimentação") or replace them with a CTA that opens the canonical
  transition modal (`openMovementModal`) directly, without scrolling.
- **Risk**: Low — local label/behavior change, no new writes.
- **Acceptance criterion**: The "Movimentar" button on the OP Tecelagem and
  OP Látex screens is no longer an anchor; it opens the transition modal or
  has a label that makes clear it is internal navigation.

### B. PEDIDO-TRANSITION-MODAL-GAPS-B
**Arrow modals must show the full picture of pending items between steppers**

- **Problem**: The arrows between stages of the Pedido Detail stepper open
  transition modals (`openMovementModal`), but these modals do not show the
  full picture of pending items — totals per product, already moved,
  missing, related OPs, blockers, and next action.
- **Scope**: `js/screens/pedido-detail-events.js` (transition modal render),
  possibly `pedido-detail-render.js`.
- **Proposal**: Enrich each modal with a summary of pending items calculated
  from the same canonical source (`derivePedidoChainState` in
  `pedido-chain-state.js`), not duplicated.
- **See §4** for the detailed requirement.
- **Risk**: Medium — requires new UI in each modal, but no new writes.
- **Acceptance criterion**: Each arrow modal shows: totals per product,
  already moved, missing, related OPs, blockers (if any), and the next
  action's CTA.

### C. PEDIDO-TRANSFER-REMAINING-B
**"Transferir restante" button/action**

- **Problem**: When a partial transfer has already been made, there is no
  explicit action to transfer the remaining balance at once. The user must
  create another delivery manually.
- **Scope**: `js/screens/pedido-detail-events.js` (new handler in the
  transition modal), possibly reusing `salvarEntregaCima` with a payload
  calculated from the balance.
- **Proposal**: Add a "Transferir restante" CTA to the transition modal that
  pre-fills the form with each item's pending balance.
- **Risk**: Medium — real write, but reuses an existing canonical operation.
- **Acceptance criterion**: "Transferir restante" button visible when there
  is a pending balance; clicking it pre-fills the form with the balance and
  executes the canonical operation.

### D. PEDIDO-TEC-ACCEPTANCE-B
**Acceptance/adjustment of the OP Tecelagem via the Pedido**

- **Problem**: The Tecelagem OP, when created from the Pedido, does not go
  through a review/acceptance stage in the Pedido's context. The admin must
  navigate to the OP screen to adjust it.
- **Scope**: New component/modal in `pedido-detail.js` that allows reviewing
  the items of the linked Tecelagem OP, adjusting quantities (within the
  pedido's balance), and confirming the start of production.
- **Risk**: High — involves Pedido↔OP consistency validation and a possible
  write to `op_itens`.
- **Acceptance criterion**: The admin can review and adjust the linked
  Tecelagem OP directly from the Pedido detail, without navigating to the OP
  screen.

### E. LATEX-SPLIT-PARTIAL-POLICY-A
**Diagnostic/architecture for the partial-split select**

- **Problem**: The current rule is to always accumulate into the existing
  latex OP (`gerar_op_latex` with find-or-accumulate). The new requirement
  demands exceptionally allowing the creation of a separate OP for a
  specific partial.
- **Scope**: Schema diagnostic, indexes, `gerar_op_latex` RPC, `ops`,
  `entregas`, `entrega_itens` tables.
- **See §3** for the detailed requirement.
- **Risk**: High — changes the consolidation rule; requires a new grouping
  key, trail/history, and must not reintroduce automatic "one OP per
  partial".
- **Acceptance criterion**: Documented diagnostic with: affected tables,
  existing indexes, current RPC signature, proposed new grouping key, RLS
  impact, and UI contract for the select.

### F. PEDIDO-STEPPER-STAGE-MODALS-B
**Clickable stepper dots and per-stage modals**

- **Problem**: The Pedido Detail stepper dots (8 stages:
  recebido/confirmado/insumos/tecelagem/acabamento/expedicao/transporte/
  concluido) are not clickable. Only the arrows between stages open
  transition modals.
- **Scope**: `js/screens/pedido-detail-render.js` (stepper render),
  `js/screens/pedido-detail-progress.js` (state logic).
- **Proposal**: Make each dot clickable, opening an informational modal with
  that stage's state: aggregated data, linked OPs, progress,
  events/history.
- **Risk**: Low — read-only, no new writes.
- **Acceptance criterion**: Each stepper dot is clickable and opens a modal
  with information for the corresponding stage.

### G. TEC-STAGE-FINALIZATION-A
**Decision/implementation of explicit Tecelagem finalization**

- **Problem**: There is no explicit action to mark the Tecelagem stage as
  complete. The transition to Acabamento happens via delivery
  (`salvarEntregaCima`), but the Tecelagem OP itself has no explicit
  terminal state ("completed") separate from the last delivery.
- **Scope**: Architectural decision first: is Tecelagem completed
  automatically when the entire balance has been transferred, or does it
  require an explicit action? Then, UI implementation (OP Tecelagem and/or
  Pedido Detail).
- **Risk**: Medium — involves an OP lifecycle decision and possible use of
  `alterar_status_op`.
- **Acceptance criterion**: Decision documented; if an explicit action, a
  "Concluir Tecelagem" button visible and functional; if automatic, a clear
  indicator that the stage was completed.

### H. OP-PEDIDO-LINEAGE-UX-B
**Standardize Pedido↔OP visual correlation**

- **Problem**: The visual correlation between the Pedido and its linked OPs
  is partial. The lineage strip exists on the Tecelagem OP (shows the
  consolidated Acabamento OP), but on the Pedido Detail the listing of
  linked OPs is basic and does not show the full chain.
- **Scope**: `js/screens/pedido-detail-render.js` (linked OPs block),
  `pedido-detail-progress.js` (aggregated data).
- **Proposal**: Create a lineage visualization in the Pedido Detail:
  cards/timeline showing OP Tecelagem → OP Acabamento → Expedição, with
  status, progress, and quick actions.
- **Risk**: Medium — read-only, but requires new UI with already-loaded
  data.
- **Acceptance criterion**: In the Pedido detail, the OPs section shows the
  full production chain with status, progress, and navigation to each OP.

---
## 3. New partial-split requirement (LATEX-SPLIT-PARTIAL-POLICY-A)

### 3.1 Default rule (do not change)

- **Accumulate in the same OP** when the following coincide: same origin
  weaving OP (`origem_op_id`) + same latex supplier
  (`destino_fornecedor_id`).
- The `gerar_op_latex` RPC implements find-or-accumulate: if a latex OP with
  status `aberta` or `em_producao` already exists for this combination, it
  accumulates the new delivery's items into it; otherwise, it creates a new
  one.
- This behavior is the default and **must not be changed**.

### 3.2 Exception (new requirement)

- Allow, **explicitly and via select**, creating a **new, separate latex OP**
  for a specific partial delivery, even when a consolidated latex OP already
  exists for the same origin+supplier combination.
- The exception **must not be the default** — the default remains
  accumulation.
- The exception **must be explicit** via a select/binary control in the
  delivery form (`buildEntregaInlineForm`) or at the moment of calling
  `salvarEntregaCima`.
- The exception **must require a trail/history**: the new OP must record the
  specific `origem_entrega_id` and the reason for the separation.

### 3.3 Absolute restrictions

- **DO NOT** reintroduce "one OP per partial" as automatic behavior.
- **DO NOT** break the idempotency of `gerar_op_latex` for the default case.
- **DO NOT** create a migration or alter the schema in this diagnostic phase
  (`LATEX-SPLIT-PARTIAL-POLICY-A` is diagnostic/architecture, not
  implementation).

### 3.4 Required diagnosis (before implementing)

1. **Map `gerar_op_latex`**: current signature, parameters,
   find-or-accumulate logic, return value.
2. **Map affected tables**: `ops`, `op_itens`, `entregas`,
   `entrega_itens`, `lotes`.
3. **Map existing indexes**: `ops.origem_op_id`, `ops.origem_entrega_id`,
   `ops.tipo`, `ops.status`.
4. **Define new grouping key**: how does the RPC decide whether to
   accumulate or create? The current key is
   `(origem_op_id, destino_fornecedor_id, tipo='latex')`. The exception needs
   a new discriminator (e.g., a `forcar_nova_op` flag passed as a parameter).
5. **Define UI contract**: where and how the select/binary control appears
   in the delivery form.
6. **Assess RLS impact**: the new OP inherits the same policies as `ops`
   with `tipo='latex'`.

---

## 4. Transition modal requirement (PEDIDO-TRANSITION-MODAL-GAPS-B)

### 4.1 Mandatory content of each modal

Each modal opened by the stepper arrows in the Pedido Detail must display:

| Information | Source |
|---|---|
| Totals per product (order meters) | `pedido_itens` |
| Already moved in the current stage | `entrega_itens` aggregated by `op_item_id` |
| Missing to complete the transition | `total - movimentado` |
| OPs related to the stage | `ops` linked to the pedido (via `lotes.pedido_id`) |
| Blockers (if any) | E.g.: destination OP not confirmed, pending supplier |
| Next action (CTA) | "Transferir", "Transferir restante", "Liberar expedição", etc. |

### 4.2 Canonical calculation source

- The calculation source **must be shared**, not duplicated per modal.
- The `derivePedidoChainState` matrix (`js/screens/pedido-chain-state.js:146`)
  already computes each stage's state with gates and actions.
- The modals must consume this same matrix, complemented with granular
  (per-item) data when needed.
- **Forbidden**: each modal recalculating totals independently with its own
  logic.

### 4.3 Visual states

- **Active (blue)**: label "Transferir", clickable arrow → opens transition
  modal.
- **Completed (green/neutral)**: label "Concluído", clickable arrow → opens
  transition history with partials.
- **Waiting (gray/muted)**: label "Aguardar", non-clickable arrow.
- **View/Edit**: short integrated label, opens context when allowed.

---

## 5. General implementation criteria

1. **One phase per problem group**: each backlog item (A-H) is an
   independent phase. Do not group multiple items into a single phase.
2. **No large patch without diagnosis**: items marked "diagnosis/architecture
   first" (E, G) require a design document before code.
3. **No closeout without tests/evidence**: each phase must have a dedicated
   smoke test or documented visual evidence.
4. **Keep production untouched**: `bhgifjrfagkzubpyqpew` and `origin/main`
   are never a push target.
5. **Selective staging**: `git add` only the phase's files; never
   `git add .`.
6. **Update canonical structured state when operational facts change**, then
   regenerate `AGENT_HANDOFF.md` through canonical tooling; never edit the
   generated handoff as an independent owner.
7. **Push only to `staging`**: `git push staging work/app-next`.
8. **Branch**: always `work/app-next`.
9. **Allowed residual**: `?? supabase/.temp/` — never committed.

---

## 6. Technical implementation order

| # | Item | Dependencies | Risk | Type |
|---|---|---|---|---|
| 1 | A. ACTION-BUTTONS-R1 | None | Low | UI |
| 2 | B. PEDIDO-TRANSITION-MODAL-GAPS-B | None | Medium | UI |
| 3 | C. PEDIDO-TRANSFER-REMAINING-B | B (reuses modal) | Medium | UI + Write |
| 4 | F. PEDIDO-STEPPER-STAGE-MODALS-B | None | Low | UI |
| 5 | H. OP-PEDIDO-LINEAGE-UX-B | None | Medium | UI |
| 6 | D. PEDIDO-TEC-ACCEPTANCE-B | H (lineage) | High | UI + Write |
| 7 | E. LATEX-SPLIT-PARTIAL-POLICY-A | None (diagnosis) | High | Architecture |
| 8 | G. TEC-STAGE-FINALIZATION-A | D, E (lifecycle decisions) | Medium | Architecture + UI |

### Rationale for the order

1. **A** first: simple fix, low risk, removes immediate confusion.
2. **B** next: enriches the existing modals without changing writes.
3. **C** depends on B: the "Transferir restante" button lives in the
   enriched modal.
4. **F** is independent and low-risk: read-only UI only.
5. **H** is independent and improves the navigation experience.
6. **D** depends on H for the visual lineage context; it is the first item
   that involves new writes.
7. **E** is pure diagnosis: it does not change code, it only documents the
   path to implementing the partial split.
8. **G** is last: it depends on the decisions from D (Tecelagem lifecycle)
   and E (split policy) to define whether finalization is automatic or
   explicit.

---

## 7. Mapped risks

| Risk | Affected items | Mitigation |
|---|---|---|
| Latex consolidation rule broken | E | Diagnosis before code; do not change `gerar_op_latex` without a regression test. |
| Inconsistent write between Pedido and OP | C, D | Reuse canonical operations (`salvarEntregaCima`, `alterar_status_op`); never write directly. |
| Divergence of totals between modals | B | Single source: `derivePedidoChainState` + `entrega_itens`. |
| Stepper out of sync | F, G | Consume `chainState` from the canonical matrix, do not recompute. |
| "One OP per partial" reintroduced | E | Absolute restriction documented; review mandatory. |

---

## 8. References

- `js/screens/pedido-chain-state.js` — Canonical state matrix (`derivePedidoChainState`)
- `js/screens/pedido-detail-progress.js` — Render of the `Progresso produtivo` block
- `js/screens/pedido-detail-render.js` — Render of the stepper and connectors
- `js/screens/pedido-detail-events.js` — Transition modal handlers (`openMovementModal`)
- `js/screens/entrega-writes.js` — `salvarEntregaCima` (canonical Tecelagem→Acabamento write)
- `js/screens/entrega-form.js` — `buildEntregaInlineForm` (canonical delivery form)
- `js/screens/op-tecelagem-producao-admin.js` — OP Em Produção Tecelagem screen
- `js/screens/op-latex-admin.js` — OP Látex/Acabamento screen
- `js/screens/expedicao-admin.js` — Expedição screen
- `tests/production-flow-invariants.smoke.js` — Production flow invariants
- `docs/architecture/PEDIDO_OP_MOVIMENTACAO_DOCUMENTOS_PLANO.md` — Architectural plan
- `docs/architecture/PEDIDO_OP_SCHEMA_CONTRACT.md` — Schema contract
- `docs/governance/current-state.json` — **Sole owner of live current operational state** (phase, next action, debts, accepted-checkpoint index)
- `AGENT_HANDOFF.md` — Deterministic generated compatibility view sourced from canonical structured state; no independent continuity or current-state facts
- `docs/governance/catalog/documents.json` — Documentation-classification and canonical-path owner
## 9. Admin Backlog — Operational Validation

Phase: `RAVATEX-TAPETES-ADMIN-FLOW-BACKLOG-SYNC-A`
Date: 2026-07-05
Type: docs-only, read-only documentation patch. Consolidates observations
from validation of the Admin flow without implementing UI, JS, SQL, or migration.

### 9.1 Registered items (recommended order)

#### 1. PEDIDO-CONCLUIR-ACTION-R1

| Campo | Valor |
|---|---|
| **Priority** | P1 |
| **Symptom** | The action to complete/conclude the Pedido via `concluir_pedido_se_pronto` has no explicit CTA visible in the Pedido Detail Admin header when all completion conditions are satisfied. The user depends on the side effect of an expedicao delivery to trigger completion. |
| **Affected flow** | Pedido Detail Admin — Pedido completion |
| **Likely cause** | The completion CTA became coupled to the Expedição → Entrega flow (`registrar_entrega_expedicao`). When there is no pending expedicao but the Pedido is ready by other criteria, there is no visible CTA. |
| **Likely files** | `js/screens/pedido-detail.js`, `js/screens/pedido-detail-events.js`, `js/screens/pedido-detail-render.js` |
| **Acceptance criteria** | "Concluir Pedido" button visible in the Pedido Detail header/actions when `concluir_pedido_se_pronto` is eligible; confirmation before the write; success/error feedback. |
| **Dependencies** | None (the RPC `concluir_pedido_se_pronto` already exists in db/23). |
| **Recommended phase** | `ADMIN-PEDIDO-CONCLUIR-CTA-R1` |
| **Order** | 1 |

#### 2. PEDIDO-STAGE-ACTION-HUB-B

| Campo | Valor |
|---|---|
| **Priority** | P1 |
| **Symptom** | The stepper arrows are the only transition-action point in the Pedido Detail. There is no unified hub/center that aggregates all pending actions per stage, with blocker explanations and links to related OPs. |
| **Affected flow** | Pedido Detail Admin — all stage transitions |
| **Likely cause** | The arrow modals were enriched incrementally (phases B/C), but each one is still isolated. A panel/hub is missing that consolidates: what is blocked at each stage, why, which OPs are involved, and what to do. |
| **Likely files** | `js/screens/pedido-detail-events.js`, `js/screens/pedido-detail-render.js`, `js/screens/pedido-chain-state.js`, `js/screens/pedido-detail-progress.js` |
| **Acceptance criteria** | Action hub/center in the Pedido Detail that, for each active/blocked stage: shows status, blockers with a short explanation + expandable detail, related OPs with links, CTA for the next canonical action. Single source: `derivePedidoChainState`. |
| **Dependencies** | None (uses already-loaded data + `derivePedidoChainState`). |
| **Recommended phase** | `ADMIN-PEDIDO-STAGE-ACTION-HUB-B` |
| **Order** | 2 |

**Items absorbed by PEDIDO-STAGE-ACTION-HUB-B:**

| Item absorvido | Como é absorvido |
|---|---|
| `PEDIDO-STAGE-BLOCKER-EXPLANATION-R1` | The textual explanation of each blocker now lives in the hub, with short visible text and detail in a tooltip/expansion. The arrow keeps a short label; the hub concentrates the explanation. |
| `PEDIDO-STAGE-RELATED-OPS-LINKS-R1` | The links to OPs related to each stage are now displayed in the hub, not as inline text on the arrows. |
| Part of `TEC-ACCEPTANCE-IN-PEDIDO-MODAL-B` | The hub shows whether the linked Tecelagem OP still needs acceptance/adjustment, with a CTA to the acceptance modal. The acceptance modal itself is implemented separately (item 3). |
| Part of `PEDIDO-STAGE-MODAL-WIDTH-R1` | The hub uses an expanded width by default (not a narrow modal), resolving the truncation problem for dense information. |

#### 3. TEC-ACCEPTANCE-IN-PEDIDO-MODAL-B

| Campo | Valor |
|---|---|
| **Priority** | P1 |
| **Symptom** | Accepting/adjusting the Tecelagem OP requires navigating to the OP screen (`#/ops/<id>`). The Pedido Detail offers no inline interface to review and accept the linked tecelagem OP. |
| **Affected flow** | Pedido Detail Admin — Insumos → Tecelagem or Tecelagem → Acabamento transition |
| **Likely cause** | Creating a Tecelagem OP from the Pedido (Phase C) populated `lotes.pedido_id` and `op_itens.pedido_item_id`, but the acceptance/adjustment cycle still has no screen in the Pedido context. The current transition modal only knows how to open the OP. |
| **Likely files** | `js/screens/pedido-detail-events.js`, `js/screens/pedido-detail-render.js`, `js/screens/pedido-chain-state.js` |
| **Acceptance criteria** | Inline modal in the Pedido Detail that: lists Tecelagem OP items with adjusted vs. ordered quantities, allows adjustments within the Pedido's balance, shows width parameters, displays the OP status, and has a "Confirmar e iniciar produção" CTA that calls `alterar_status_op(..., 'em_producao')`. |
| **Dependencies** | `PEDIDO-STAGE-ACTION-HUB-B` (the hub exposes the CTA for this modal). |
| **Recommended phase** | `ADMIN-TEC-ACCEPTANCE-IN-PEDIDO-MODAL-B` |
| **Order** | 3 |

#### 4. OP-NOVA-METRAGEM-INPUT-FOCUS-R1

| Campo | Valor |
|---|---|
| **Priority** | P2 |
| **Symptom** | When adding items on the New OP screen (Tecelagem or Acabamento), focus does not move automatically to the metragem field after selecting the model, forcing a manual click or Tab. |
| **Affected flow** | Admin — New OP (`#/ops/nova`) |
| **Likely cause** | The model select fires `onchange`, which updates the item state (colors, derived width), but there is no programmatic `focus()` on the metragem input after the selection. |
| **Likely files** | `js/screens/op-nova.js` |
| **Acceptance criteria** | When a model is selected in the New OP item select, focus moves automatically to the corresponding metragem field. |
| **Dependencies** | None. |
| **Recommended phase** | `ADMIN-OP-NOVA-METRAGEM-FOCUS-R1` |
| **Order** | 4 |

#### 5. PEDIDO-FIRST-OP-CTA-PLACEMENT-R1

| Campo | Valor |
|---|---|
| **Priority** | P1 |
| **Symptom** | When a Pedido has no linked OP, the "Criar OP" / "Lançar produção" CTA is absent or positioned without prominence in the Pedido Detail. The user must know to navigate manually to `#/ops/nova?pedido_id=<id>`. |
| **Affected flow** | Pedido Detail Admin — Pedido without OP |
| **Likely cause** | The linked-OPs block in the Pedido Detail only appears when there are OPs. The "no OP" state has no visible contextual CTA to create the first OP from the Pedido. |
| **Likely files** | `js/screens/pedido-detail-render.js`, `js/screens/pedido-detail.js` |
| **Acceptance criteria** | In the Pedido Detail without OPs, a visible block with a prominent "Criar OP de produção" CTA that navigates to `#/ops/nova?pedido_id=<id>` with the Pedido's items pre-filled. |
| **Dependencies** | None (the `#/ops/nova?pedido_id=` route has existed since Phase C). |
| **Recommended phase** | `ADMIN-PEDIDO-FIRST-OP-CTA-R1` |
| **Order** | 5 |

#### 6. TEC-TO-ACABAMENTO-MODAL-LAYOUT-R1

| Campo | Valor |
|---|---|
| **Priority** | P2 |
| **Symptom** | The Tecelagem → Acabamento transition modal (`openMovementModal`) displays the delivery form (`buildEntregaInlineForm`) with a layout that can become compressed at smaller resolutions, especially the split select and the reason field. |
| **Affected flow** | Pedido Detail Admin — Tecelagem → Acabamento arrow |
| **Likely cause** | `buildEntregaInlineForm` was designed for the OP screen (full width), but in the Pedido Detail modal the available width is smaller (~520px), compressing fields, the split select, and the amber warning. |
| **Likely files** | `js/screens/pedido-detail-events.js`, `js/screens/entrega-form.js` |
| **Acceptance criteria** | Tecelagem → Acabamento modal with responsive layout: fields in a flexible grid, split select and reason field with adequate width, legible amber warning, and pending-items table without horizontal truncation. |
| **Dependencies** | `PEDIDO-STAGE-MODAL-WIDTH-R1` (the standardized base modal width also benefits this item). |
| **Recommended phase** | `ADMIN-TEC-TO-ACABAMENTO-MODAL-LAYOUT-R1` |
| **Order** | 6 |

#### 7. PEDIDO-STAGE-MODAL-WIDTH-R1

| Campo | Valor |
|---|---|
| **Priority** | P2 |
| **Symptom** | The stage-transition modals use a narrow fixed width (~520px), truncating totals information, pending-items tables, and related-OPs lists. |
| **Affected flow** | Pedido Detail Admin — all arrow modals |
| **Likely cause** | Fixed width inherited from simple modals; the modals were enriched with more data across phases, but the base width was not adjusted. |
| **Likely files** | `js/screens/pedido-detail-events.js` |
| **Acceptance criteria** | Transition modals with a minimum width of 640px (or responsive `min(90vw, 720px)`); internal tables without forced horizontal scroll; totals and related-OPs information fully visible. |
| **Dependencies** | None. Partially absorbed by `PEDIDO-STAGE-ACTION-HUB-B` (the hub uses an expanded panel, not a narrow modal). |
| **Recommended phase** | `ADMIN-PEDIDO-STAGE-MODAL-WIDTH-R1` |
| **Order** | 7 |

#### 8. LATEX-ADMIN-COMPACT-BUTTONS-R1

| Campo | Valor |
|---|---|
| **Priority** | P2 |
| **Symptom** | On the OP Latex Admin screen (`op-latex-admin.js`), the action buttons (Movimentar para Expedição, Finalizar OP) and the summary cards occupy excessive vertical space, forcing frequent scrolling on OPs with many items. |
| **Affected flow** | Admin — OP Latex/Acabamento (`#/ops/<id>` with tipo=latex) |
| **Likely cause** | Layout inherited from the standalone screen with generously sized cards and buttons; with the new canonical summary cards (Recebido/Movimentado/Disponível/Entregue/Saldo) and the items table, vertical density increased but the buttons were not compacted proportionally. |
| **Likely files** | `js/screens/op-latex-admin.js` |
| **Acceptance criteria** | Action buttons and summary cards with reduced height (compact padding/margin); "Movimentar para Expedição" and "Finalizar OP" CTAs visible without scrolling on most OPs; items table preserved. |
| **Dependencies** | None. |
| **Recommended phase** | `ADMIN-LATEX-COMPACT-BUTTONS-R1` |
| **Order** | 8 |

### 9.2 Absorbed items (do not implement in isolation)

These items are resolved as part of `PEDIDO-STAGE-ACTION-HUB-B` (item 2 above):

#### PEDIDO-STAGE-BLOCKER-EXPLANATION-R1

| Campo | Valor |
|---|---|
| **Priority** | P2 (absorbed) |
| **Symptom** | The stepper arrows in the Pedido Detail show only a short label ("Aguardar", "Transferir", "Concluído") without explaining the reason for the blocker when a stage is in "Aguardar". |
| **Affected flow** | Pedido Detail Admin — stepper between stages |
| **Likely cause** | Product decision: short labels on the arrows to avoid visual clutter. The blocker explanation needs a separate location. |
| **Acceptance criteria** | Blockers explained in the action hub (`PEDIDO-STAGE-ACTION-HUB-B`), with short visible text + expandable detail. Arrows keep short labels. |
| **Dependencies** | `PEDIDO-STAGE-ACTION-HUB-B`. |
| **Recommended phase** | Absorbed by `ADMIN-PEDIDO-STAGE-ACTION-HUB-B`. |

#### PEDIDO-STAGE-RELATED-OPS-LINKS-R1

| Campo | Valor |
|---|---|
| **Priority** | P2 (absorbed) |
| **Symptom** | The transition modals do not display direct links to the OPs related to the stage. The user must leave the modal, find the linked-OPs block, and click there. |
| **Affected flow** | Pedido Detail Admin — transition modals |
| **Likely cause** | The modals evolved to show totals and pending items, but not navigation links to the OPs. |
| **Acceptance criteria** | The action hub (`PEDIDO-STAGE-ACTION-HUB-B`) displays, for each stage, clickable links to the related OPs (`#/ops/<id>`). |
| **Dependencies** | `PEDIDO-STAGE-ACTION-HUB-B`. |
| **Recommended phase** | Absorbed by `ADMIN-PEDIDO-STAGE-ACTION-HUB-B`. |

### 9.3 Recommended implementation sequence

| # | Item | Absorbs | Risk |
|---|---|---|---|
| 1 | PEDIDO-CONCLUIR-ACTION-R1 | — | Low |
| 2 | PEDIDO-STAGE-ACTION-HUB-B | BLOCKER-EXPLANATION-R1, RELATED-OPS-LINKS-R1, part of TEC-ACCEPTANCE, part of MODAL-WIDTH | Medium |
| 3 | TEC-ACCEPTANCE-IN-PEDIDO-MODAL-B | — | Medium |
| 4 | OP-NOVA-METRAGEM-INPUT-FOCUS-R1 | — | Low |
| 5 | PEDIDO-FIRST-OP-CTA-PLACEMENT-R1 | — | Low |
| 6 | TEC-TO-ACABAMENTO-MODAL-LAYOUT-R1 | — | Low |
| 7 | PEDIDO-STAGE-MODAL-WIDTH-R1 | — | Low |
| 8 | LATEX-ADMIN-COMPACT-BUTTONS-R1 | — | Low |

### 9.4 Relationship with the production backlog (§2)

The Admin backlog (§9) is complementary to the production-flow backlog (§2).
The items in §2 (A-H) cover transition mechanics and the production chain;
the items in §9 cover usability, clarity of actions, and visual
organization of the already-existing Admin interface.

Resolved overlaps:
- §2 item D (`PEDIDO-TEC-ACCEPTANCE-B`) ≈ §9 item 3 (`TEC-ACCEPTANCE-IN-PEDIDO-MODAL-B`): item §9.3 details inline acceptance in the Pedido. Both converge on the same implementation.
- §2 item B (`PEDIDO-TRANSITION-MODAL-GAPS-B`) ≈ §9 item 2 (`PEDIDO-STAGE-ACTION-HUB-B`): the action hub is the natural evolution of the enriched arrow modals.
- §9 items 6 and 7 (`TEC-TO-ACABAMENTO-MODAL-LAYOUT-R1`, `PEDIDO-STAGE-MODAL-WIDTH-R1`) are layout adjustments that benefit the §2.B modals.

Items from §2 already implemented and outside the Admin backlog: C, F, H, A, G, E (all resolved in earlier phases per `PROJECT_STATE.md`).

### 9.5 Binding rules

1. **Do not implement absorbed items in isolation.** `BLOCKER-EXPLANATION-R1`
   and `RELATED-OPS-LINKS-R1` only make sense inside the hub.
2. **Canonical calculation source:** `derivePedidoChainState` for any
   stage, blocker, or progress data. Do not duplicate logic.
3. **Writes only via existing canonical operations:** `alterar_status_op`,
   `salvarEntregaCima`, `liberar_expedicao_latex_parcial`,
   `concluir_pedido_se_pronto`. Never write directly to tables.
4. **One phase per item.** Do not group multiple items into a single phase.
5. **Selective staging.** `git add` only the files of the phase.
6. **Production untouched.** `bhgifjrfagkzubpyqpew` and `origin/main` are
   never a push target.

### 9.6 Admin/Pedido visual closeout - 2026-07-05

Phase: `RAVATEX-TAPETES-ADMIN-BACKLOG-VISUAL-CLOSEOUT-A`

Status: **BLOCKED**. The Admin/Pedido backlog **is not zeroed out** in real
staging.

Binding premise: a technical report and local tests are not enough to close
a UX/flow backlog. Each item must be classified by real behavior in
staging: Visual OK, Partial, Failed, Reopen R2, or Not validatable without
manual action.

Audited environment:

| Campo | Valor |
|---|---|
| Branch | `work/app-next` |
| Initial HEAD | `57719298dcbd370cb7b1a0ca3ff1365c30ca8fb9` |
| Remote staging | `staging/work/app-next` at the same commit |
| Visual frontend | `http://localhost:8765/` with `APP_ENV=staging` |
| Supabase staging | `ucrjtfswnfdlxwtmxnoo` |
| Production | `bhgifjrfagkzubpyqpew` untouched |
| Cache/assets | cache mitigated with `?audit=...`; the served `pedido-detail-render.js` matches the local SHA-256 |

Closeout table:

| Item | Previously reported status | Real visual status | Evidence | Decision | Next phase |
|---|---|---|---|---|---|
| `PEDIDO-CONCLUIR-ACTION-R1/R2` | OK per R2/tests | Visual OK | Pedido #20 shows `Concluido` / `Comercial: Entregue`, `Pedido concluido` button with `disabled="disabled"`; eligible Pedido #21 shows `Concluir pedido` enabled, without `disabled`; no `disabled="null"` on the Pedido Detail buttons. | Closed for the Pedido Detail. | None for the Pedido Detail; assess the static residue in `expedicao-admin.js` if it enters scope. |
| `PEDIDO-STAGE-ACTION-HUB-B` | OK per test/harness | Failed | Pedido #21 opens the Entrega hub, but Pedido #13 with an open Tecelagem OP crashes when clicking the stage/arrow: `TypeError: Failed to execute 'appendChild' on 'Node'` at `pedido-detail-events.js:1726`. | Reopen R2. | Fix the hub and revalidate in a real browser. |
| `PEDIDO-STAGE-BLOCKER-EXPLANATION-R1` | OK/absorbed by the hub | Failed | Arrows keep the short `Aguardar` text, but the click on Pedido #13 does not open the explanation because of the hub crash. | Reopen R2. | Same R2 as the hub. |
| `PEDIDO-FIRST-OP-CTA-PLACEMENT-R1` | OK | Visual OK | Pedido #1 without an OP shows `Gerar primeira OP` highlighted on the right of the `OPs vinculadas` block; empty and explanatory card. | Closed. | None. |
| `OP-NOVA-METRAGEM-INPUT-FOCUS-R1` | OK | Visual OK | New OP opened from Pedido #1; the empty `metros` field kept accepting `1000` continuously and retained focus; no OP was saved. | Closed. | None. |
| `TEC-TO-ACABAMENTO-MODAL-LAYOUT-R1` | OK | Visual OK | Pedido #14 opened the Tecelagem -> Acabamento modal; visual order: item name, Data/Destino/Metros, Observacao; `Itens envolvidos` legible; no transfer saved. | Closed. | None. |
| `LATEX-ADMIN-COMPACT-BUTTONS-R1` | OK | Visual OK | OP Latex #27 / OP 9/2026 in production shows short, separate `Finalizar OP` and `Movimentar` buttons; does not show `Confirmar entrada / iniciar acabamento`. | Closed. | None. |
| `TEC-ACCEPTANCE-IN-PEDIDO-MODAL-B` | OK per test/harness | Failed | Pedido #13 has an open Tecelagem OP (OP 10/2026), but the Tecelagem hub crashes before showing `Aceitar OP`; the main card does not expose acceptance. | Reopen R2. | Fix the hub and validate `Aceitar OP` without accepting a real OP. |
| `PEDIDO-STAGE-MODAL-WIDTH-R1` | OK/partial via hub | Partial | The Pedido #14 movement modal is legible and does not squeeze `Itens envolvidos`; the stage hub cannot be validated in Tecelagem due to the crash. | Revalidate after R2. | Visual retest of the fixed hub. |
| `PEDIDO-STAGE-RELATED-OPS-LINKS-R1` | OK/absorbed by the hub | Partial / Reopen R2 | Main cards show `Abrir OP`; expedicoes show `Abrir expedicao`; links inside the Tecelagem hub are not validatable because the hub crashes. | Reopen together with the hub. | Visual retest of the fixed hub. |

Mandatory observations:

- Pedido #20 was completed previously in staging and must now appear as
  delivered/completed. Do not use Pedido #20 as a draft/eligible Pedido.
- Pedido #21 was only inspected as an eligible Pedido; no click on
  `Concluir pedido` was executed.
- No new Pedido was created; no real OP was accepted; no transfer was
  saved; no New OP was saved.
- A static search found `disabled: ready ? null : 'disabled'` in
  `js/screens/expedicao-admin.js:361`. The served Pedido Detail, however, does
  not contain the old pattern and did not render `disabled="null"` in the
  audited cases.

Tests/diagnostics from this audit:

| Type | Result |
|---|---|
| `node --test tests\pedido-detail.smoke.js` | OK, 147/147 |
| `node --test tests\pedido-detail-linked-ops.smoke.js` | OK, 7/7 |
| `node --test tests\op-latex-admin.smoke.js` | OK, 55/55 |
| `node --test tests\tec-to-acabamento-flow.smoke.js` | OK, 37/37 |
| `node --test tests\expedicao-partial-flow.smoke.js` | OK, 12/12 |
| `node scripts/staging/production-flow-invariants-diag.mjs` | OK |
| `node scripts/staging/latex-consolidation-diag.mjs` | OK |
| `node scripts/staging/expedicao-partial-flow-diag.mjs` | OK |

### 9.7 Real R2 of the stage hub - 2026-07-05

Phase: `RAVATEX-TAPETES-PEDIDO-STAGE-HUB-R2-REAL-STAGING`

Status: **OK** for the reopened hub items.

Reason for R2: the real visual audit of `2026-07-05` reopened the hub
because Pedido #13, Tecelagem stage, broke on the dot/`Aguardar` click with:

`TypeError: Failed to execute 'appendChild' on 'Node': parameter 1 is not of type 'Node'`

Stack observed in the real browser: `js/ui.js:19` ->
`js/screens/pedido-detail-events.js:1726` -> `buildStageDetailBody` ->
`openStageDetailModal`.

Diagnosis:

| Campo | Resultado |
|---|---|
| Reproduction Pedido | Pedido #13 |
| Stage | Tecelagem |
| Related OP | OP 10/2026, type `tecelagem`, status `aberta` |
| Invalid value | Plain object `summary.docBanner` (`{ tone, text }`) |
| Root cause | The hub passed the whole object as a child of `window.el(...)`; the real DOM tried to attach the object via `appendChild`. |
| Why the earlier test did not catch it | The runtime harness accepted invalid children and flattened lists more permissively than `js/ui.js`. |

Fix applied:

- `js/screens/pedido-detail-events.js`: `docBannerRow(...)` converts the
  documentation banner into valid text/Node before calling `window.el(...)`.
- `tests/pedido-detail.smoke.js`: the runtime harness now rejects a plain
  object in `appendChild`, mimicking the real DOM, and includes a case
  equivalent to Pedido #13/Tecelagem/Aguardar.

Real post-fix validation:

| Clique | Resultado |
|---|---|
| `Ver detalhes da etapa TECELAGEM` | Hub opens without error; shows OP 10/2026, `Abrir OP`, `Aceitar OP`, reason, and `Sem movimentacao para acabamento registrada ainda`. |
| `Movimentar Tecelagem -> Acabamento` / `Aguardar` | Hub opens with the same content, no error in the console/pageerror. |

Post-R2 classification:

| Item | Status |
|---|---|
| `PEDIDO-STAGE-ACTION-HUB-B` | Closed |
| `PEDIDO-STAGE-BLOCKER-EXPLANATION-R1` | Closed |
| `TEC-ACCEPTANCE-IN-PEDIDO-MODAL-B` | Closed |
| `PEDIDO-STAGE-RELATED-OPS-LINKS-R1` | Closed |
| `PEDIDO-STAGE-MODAL-WIDTH-R1` | Closed for the validated hub |

Tests/diagnostics:

| Type | Result |
|---|---|
| `node --test tests\pedido-detail.smoke.js` | OK, 148/148 |
| `node --test tests\pedido-detail-linked-ops.smoke.js` | OK, 7/7 |
| `node --test tests\op-latex-admin.smoke.js` | OK, 55/55 |
| `node --test tests\tec-to-acabamento-flow.smoke.js` | OK, 37/37 |
| `node --test tests\expedicao-partial-flow.smoke.js` | OK, 12/12 |
| `node --test tests\expedicao-flow.smoke.js` | OK, 8/8 |
| `node scripts/staging/production-flow-invariants-diag.mjs` | OK |
| `node scripts/staging/latex-consolidation-diag.mjs` | OK |
| `node scripts/staging/expedicao-partial-flow-diag.mjs` | OK |

Confirmations: production `bhgifjrfagkzubpyqpew` untouched; no SQL, no
migration, no new real data, no real OP accepted, no real Pedido completed,
no real transfer, no parallel write on the Pedido, and no change to the
Acabamento -> Expedicao flow or OP lifecycle.

Backlog note: the reopened hub items are zeroed out in this R2. The general
Admin/Pedido backlog must not be declared zeroed out without addressing or
explicitly removing from scope the static residue `disabled: ready ? null :
'disabled'` in `js/screens/expedicao-admin.js:361`.
# Update 2026-07-06 - Pedido/OP Controlled Delete B

Phase: `RAVATEX-TAPETES-PEDIDO-OP-CONTROLLED-DELETE-B`
Status: **TECHNICAL PATCH READY - AWAITING USER VISUAL/TECHNICAL VALIDATION**

Technical patch for cleaning up validation data in the test environment:
`db/34_controlled_delete_pedido_op.sql` creates diagnostics and transactional
removal; `js/delete-helpers.js` concentrates the visual flow and prevents
direct delete in screens.

Current policy: delete Pedido/OP without entrega/expedicao; require
`EXCLUIR` when there are non-blocking OP/dependencies; block entrega,
expedicao, and child OP; do not alter `op_numeros`, do not renumber OPs, and
do not recycle numbers. Production future: strong password/admin,
soft-delete, and permanent audit trail.

Backlog residual:

| Item | Priority | Description |
|---|---|---|
| `DELETE-PROD-GUARD-A` | P1 future | Replace the temporary physical delete with a production flow using admin password, soft-delete, and permanent audit trail before releasing to production. |
| `DELETE-AUDIT-LOG-A` | P2 future | Log requester, approved impact, and final result in an auditable trail. |
## Update 2026-07-06 - Controlled Delete Policy Fix C

Phase: `RAVATEX-TAPETES-PEDIDO-OP-CONTROLLED-DELETE-POLICY-FIX-C`

- In staging/test, the controlled physical deletion needs to override the
  future policy of `db/26` that blocked any numbered OP.
- `db/34_controlled_delete_pedido_op.sql` removes the trigger/function
  `ops_numeradas_no_delete` to allow a numbered OP without real blockers.
- Future production must still return to an audited policy: soft-delete,
  permanent trail and strong authorization before any real deletion.
- `op_numeros` remains high-water; do not reduce, do not recycle and do not
  renumber OPs.

## Update 2026-07-06 - Controlled Delete Cascade Test D

Phase: `RAVATEX-TAPETES-PEDIDO-OP-CONTROLLED-DELETE-CASCADE-TEST-D`

- Staging/test now accepts controlled physical cascade for Pedido/OP with
  delivery and child OP, provided there is no Expedição.
- The confirmation becomes `EXCLUIR TUDO` for the productive cascade.
- Expedição remains a blocker at this stage.
- Production backlog remains open: replace physical cascade with soft-delete,
  permanent audit and strong authorization.

## Update 2026-07-06 - Controlled Delete FK Order Fix E

Phase: `RAVATEX-TAPETES-PEDIDO-OP-CONTROLLED-DELETE-FK-ORDER-FIX-E`

- `db/36_controlled_delete_fk_order_fix.sql` fixes the physical order of the
  test cascade: `op_latex_entregas` -> `entrega_itens` by `op_id`/`op_item_id`
  -> empty deliveries -> verification of zero `entrega_itens` -> child OPs ->
  root OPs -> lotes/pedido.
- Delivery guards return `OLD` on authorized DELETE so as not to silently
  cancel the removal.
- Real synthetic test in staging validated Pedido #29, OPs 45/46 and delivery
  21 removed by the RPC with `EXCLUIR TUDO`, without altering `op_numeros`.
- Production backlog continues: replace physical deletion with an audited
  flow, strong authorization and a permanent policy before any production use.

## Update 2026-07-15 - Controlled Delete Document Link Guard: CLOSED / ACCEPTED

Phase `RAVATEX-TAPETES-CONTROLLED-DELETE-DOCUMENT-LINK-GUARD-B` (+ `-GRANTS-54`,
`-POLICY-CAST-55`, `-DIAGNOSTICS-NULL-SAFE-56`). Technical commit
`707a37bd1d2c4728ab2a17433b6441049bd88062`.

- Original defect: physical deletion of an OP referenced by canonical
  documentation history (`document_link_revisions` / `document_link_revision_
  ops`) failed with a raw FK violation (`document_link_revision_ops_op_id_
  fkey`).
- `db/53` adds a documentation guard via wrappers that block physical
  deletion when canonical history exists, fully preserving the previous
  destructive logic (renamed `*_pre53`, no public API). `db/54`
  fixes an emergency ACL (`anon` had `EXECUTE`). `db/55` fixes a
  polymorphic cast. `db/56` fixes a diagnostic that collapsed to `NULL` on
  eligible targets.
- Validated in staging `ucrjtfswnfdlxwtmxnoo`: eligible OP/Pedido with real
  dependency (no documentation history) remain removable; OP/
  Pedido with documentation history are blocked in a controlled way, without
  FK exception and without partial mutation; documentation history preserved
  in 100% of cases; `op_numeros` unchanged; synthetic fixtures with cleanup
  zero.
- **Status: `CLOSED / ACCEPTED`** for the specific documentation guard.
  This does not close the general production backlog of this section: `DELETE-PROD-GUARD-A`
  (replace the temporary physical deletion with a production flow with admin
  password, soft-delete and permanent audit) and `DELETE-AUDIT-LOG-A` (auditable
  trail of requester/impact/result) remain `P1 future` /
  `P2 future`, not started.
- Production (`bhgifjrfagkzubpyqpew`) not accessed; no push. See
  `docs/ledgers/G28_LEDGER.md` for complete evidence.

## Update 2026-07-15 - Admin Pedido Static Residue: CLOSED / ACCEPTED

Phase `RAVATEX-TAPETES-ADMIN-PEDIDO-STATIC-RESIDUE-A`. Technical commit
`7978e0a4fe021467cc23e0aeed63ac87ba738f1b` -- `Fix admin order completion
button state`.

- Item closed: `ADMIN-PEDIDO-STATIC-RESIDUE`, identified by the visual
  audit of `2026-07-05` (SS9.6/9.7 above) and reconfirmed as the only item
  still open in the Admin/Pedido/Production backlog in the read-only
  reconciliation of `2026-07-15`.
- Original defect: `js/screens/expedicao-admin.js:405` (`buildConclusao`)
  built `disabled: ready ? null : 'disabled'`. The shared helper
  `el()` (`js/ui.js:10-22`) calls `setAttribute(k, v)` for every attribute
  without omitting `null` (unlike the handling of children, which skips
  `null`/`false`); the real DOM materialized this as `disabled="null"` --
  boolean attribute present -- disabling the "Concluir pedido" button on the
  Expedicao Admin screen even when `ready === true`.
- Single occurrence in the repository (confirmed by `git grep`); no other
  screen reproduced the same pattern.
- Fix located entirely at the call site: `buttonAttrs` came to be
  built as a variable before the `return`; the `disabled` key only enters the
  object when `!ready`, never as `null`. `onclick`, text, styles and
  button structure preserved without semantic change; the guard
  `if (!ready) return;` inside `onclick` was kept. The global helper
  `js/ui.js` was not changed.
- Regression test: `tests/expedicao-flow.smoke.js` gained a new
  static test that forbids the original pattern, forbids the inverted variant
  (`disabled: !ready ? 'disabled' : null`) and requires the correct conditional
  pattern.
- Local tests: `node --check js/screens/expedicao-admin.js` PASS;
  `tests/expedicao-flow.smoke.js` **9/9**; `tests/expedicao-partial-flow.smoke.js`
  **12/12** (no regression); `git diff --check` PASS.
- Production (`bhgifjrfagkzubpyqpew`) not accessed; staging not accessed; no
  push.
- **Status: `CLOSED / ACCEPTED`** for this specific static residue. The
  Admin/Pedido block reconciled by the `2026-07-05` audit (SS9.6/9.7)
  no longer has any known open item. This does not close the general
  production backlog, does not constitute publication, is not production
  readiness, does not accept G28-D and does not conclude
  `CLIENTE-ORDER-SUMMARY-READMODEL-APPLY-STAGING-A`,
  `DELETE-PROD-GUARD-A`, `DELETE-AUDIT-LOG-A`, `G28-CAMADA-2`, `G28-CAMADA-3`
  or `G28-CAMADA-4`, which remain unchanged.
- See `docs/ledgers/G28_LEDGER.md` for complete evidence.

# Update 2026-07-15 - Cliente Order Summary Read Model Staging Validation

Phase `CLIENTE-ORDER-SUMMARY-READMODEL-APPLY-STAGING-A`. No technical commit --
the phase did not change files (verification-only). Documentation closeout.

- Objective: apply `db/30_cliente_pedido_summary_readmodel.sql` in staging
  (`ucrjtfswnfdlxwtmxnoo`) only if not yet applied, and validate the contract
  of the public read model `public.cliente_pedido_summary(uuid)` consumed by
  `js/screens/cliente-pedido-detail.js` (~line 180).
- Central finding: `db/30` **was already applied**. The function exists with
  signature `cliente_pedido_summary(p_pedido_id uuid)`, `RETURNS jsonb`,
  `SECURITY DEFINER`, `STABLE`, `search_path=public`, owner `postgres`; the body
  (`pg_get_functiondef`) is byte-for-byte equivalent to `db/30` (they only differ
  in line endings CRLF vs LF) -- **no drift**. The 16 dependency tables exist.
  Mode changed to `VERIFICATION-ONLY`; nothing was reapplied.
- Provenance: `db/30` **not registered** in
  `supabase_migrations.schema_migrations` (object exists without a history row).
- Live ACL: `EXECUTE` granted to `PUBLIC`, `anon`, `authenticated` and
  `service_role`; `db/30` intends only `authenticated`. Divergence retained
  as hygiene debt (not normalized in this closeout).
- Empirical behavior (read-only, each RPC in `BEGIN ... ROLLBACK`, zero
  mutation): owner cliente `ok=true` (complete DTO); `anon` on the same Pedido
  `ok=false` **fail-closed** (executes, no data -- no confirmed exposure);
  cross-tenant `ok=false`; admin `ok=true`.
- Contract with the frontend: all consumed fields present and typed;
  empty collections `[]` (COALESCE); nulls (`tipo_recebimento`, `observacao`)
  handled; `loadingError` branches outside the happy path -- no dependency on
  silent fallback.
- Portal validation level: `STATIC_CONTRACT_WITH_REAL_RPC_PAYLOAD`. Authenticated
  browser smoke not executed (no test cliente password) -- non-blocking
  debt.
- Local gates: `node --check js/screens/cliente-pedido-detail.js` PASS;
  `git diff --check` clean; `git status --short` empty.
- Access: Supabase MCP not exposed in the session; authorized direct
  PostgreSQL fallback used only for verification; temporary tooling outside the repo
  removed; no secret echoed. Production (`bhgifjrfagkzubpyqpew`) not
  accessed; no push.
- **Status: `CLOSED / ACCEPTED_WITH_NONBLOCKING_DEBTS`.** Debts:
  `ACL_GRANTS_BROADER_THAN_CANONICAL_CONTRACT` (anon fail-closed, no confirmed
  exposure), `DB30_NOT_RECORDED_IN_SUPABASE_MIGRATION_HISTORY`,
  `AUTHENTICATED_BROWSER_SMOKE_NOT_EXECUTED`.
- Remediation candidate (not authorized, not started):
  `CLIENTE-ORDER-SUMMARY-READMODEL-ACL-GRANTS-R1` -- `ARCHITECT DECISION
  REQUIRED`; intended scope = grants-only migration analogous to `db/54`
  (`REVOKE EXECUTE ... FROM PUBLIC, anon`, preserving `authenticated`).
- Next authorizable action: `ARCHITECT DECISION REQUIRED AFTER BACKLOG
  RECONCILIATION`; the ACL candidate must not be auto-selected. Does not close
  the general backlog, is not publication, is not production readiness and
  does not accept G28-D.
- See `docs/ledgers/G28_LEDGER.md` for complete evidence.

# Update 2026-07-15 - Docs Canonical Consistency Backfill A: CLOSED / ACCEPTED

Phase `DOCS-CANONICAL-CONSISTENCY-BACKFILL-A`. Docs-only; no code, test,
SQL, migration, staging or production changed.

- Closes three documentation gaps confirmed in the read-only reconciliation of
  `2026-07-15`: (1) `db/37_controlled_delete_expedicao_cascade.sql` without its own
  `D-DEL` entry (now `D-DEL14` in
  `docs/architecture/PEDIDO_OP_SCHEMA_CONTRACT.md` SS10); (2) `db/34`-`db/37`
  and `db/53`-`db/56` missing from `docs/DOCUMENTATION_INDEX.md` SS4; (3) status
  of `db/30` in the same index still described as "not yet applied",
  diverging from the closeout `CLIENTE-ORDER-SUMMARY-READMODEL-APPLY-STAGING-A`
  above (applied and verified in staging since before this reconciliation).
- No historical entry of this backlog was rewritten; the gap
  remains recorded as it occurred, with the documentation correction attached
  as a new append/update section.
- Technical and environmental debts remain open and unchanged:
  `CLIENTE-ORDER-SUMMARY-READMODEL-ACL-GRANTS-R1` (`ARCHITECT DECISION
  REQUIRED`), `DB30_NOT_RECORDED_IN_SUPABASE_MIGRATION_HISTORY`, the debts
  of authenticated smoke (G28-C/D/B7/Client Portal),
  `DEPLOYMENT_MAPPING_AND_PRODUCTION_MIGRATION_PROCEDURE`, `DELETE-PROD-
  GUARD-A`, `DELETE-AUDIT-LOG-A`, G28-D and all the G28-CAMADA-2/3/4 fronts.
- Next material action follows `ARCHITECT DECISION REQUIRED`
  (`DEPLOYMENT_MAPPING_AND_PRODUCTION_MIGRATION_PROCEDURE`). This backfill
  does not authorize any subsequent technical phase.
- Production (`bhgifjrfagkzubpyqpew`) not accessed; no push. See
  `docs/ledgers/G28_LEDGER.md` for the append-only entry of this phase.

# Update 2026-07-15 - Staging-Only Execution Boundary A: ARCHITECT DECISION RECORDED

Phase `STAGING-ONLY-EXECUTION-BOUNDARY-A`. Docs-only; no code, test, SQL,
migration, Supabase, staging, production or Vercel accessed/changed.

- Binding architect decision: the current operational environment is
  exclusively staging `ucrjtfswnfdlxwtmxnoo`; the protected/other Supabase
  project is out of scope; production schema migration/promotion is
  postponed until the canonical backlog is
  complete; production publication mapping is not required for the
  current work in staging; G28-D publication remains postponed,
  not authorized and does not constitute a current blocker; publication
  provider (incl. Vercel) not selected -- future candidate only.
- `DEPLOYMENT_MAPPING_AND_PRODUCTION_MIGRATION_PROCEDURE` is no longer
  recorded as a current material blocker or a required next architect
  decision; reclassified as `DEFERRED BY ARCHITECT UNTIL
  GLOBAL BACKLOG COMPLETION / NOT A CURRENT STAGING BLOCKER / NOT
  STARTED`. It was not discovered, defined, tested or completed --
  only intentionally postponed.
- Next staging-only technical candidate (not started, not authorized
  by this record): `CLIENTE-ORDER-SUMMARY-READMODEL-ACL-GRANTS-R1` --
  `READY FOR EXPLICIT ARCHITECT AUTHORIZATION`. Reason: the documentation
  backfill is closed; the staging-vs-production scope ambiguity
  was resolved by this decision; the live ACL in staging remains
  broader than the canonical contract (`D-COS02`); anonymous behavior
  is fail-closed with no confirmed exposure; the remediation continues to be a
  separate grants-only migration (analogous to `db/54`); this record does not
  authorize nor create that migration.
- No historical entry of this backlog was rewritten; the
  previous items describing `DEPLOYMENT_MAPPING_AND_PRODUCTION_
  MIGRATION_PROCEDURE` as a material gate remain recorded as
  they occurred, with this section attached as a correction/update of
  the current state.
- Production (`bhgifjrfagkzubpyqpew`) not accessed; protected Supabase not
  accessed; Vercel not accessed; no push. See `docs/ledgers/G28_LEDGER.md`
  for the append-only entry of this decision.

# Update 2026-07-15 - Cliente Order Summary ACL Grants R1: CLOSED / ACCEPTED

Phase `CLIENTE-ORDER-SUMMARY-READMODEL-ACL-GRANTS-R1`. Technical commit
`82f5ba70ace2e74c51b7c0295d1ecf8e319954be` -- `Restrict client order summary
RPC grants`. Documentation commit: this closeout (`Close client order summary
RPC grant hardening`).

- Closes the technical candidate recorded in the previous section
  (`STAGING-ONLY-EXECUTION-BOUNDARY-A`, "Next staging-only technical
  candidate"), which listed `CLIENTE-ORDER-SUMMARY-READMODEL-ACL-GRANTS-R1`
  as `READY FOR EXPLICIT ARCHITECT AUTHORIZATION`. That entry remains
  recorded as it occurred at that moment; this section replaces the current state
  of the item, which leaves the open/ready backlog.
- Migration `db/57_cliente_pedido_summary_acl_grants.sql` --
  grants-only, forward-only, idempotent -- created, applied exactly once via
  Supabase MCP (tracked migration operation) and verified in staging
  `ucrjtfswnfdlxwtmxnoo`; record `20260715190627 /
  57_cliente_pedido_summary_acl_grants` confirmed in the catalog.
- Final ACL: `PUBLIC` without `EXECUTE`; `anon` without `EXECUTE`; `authenticated`
  with `EXECUTE`; `service_role` without explicit `EXECUTE` (no real consumer
  found in the full repository search). Owner `postgres`
  retains inherent privilege. Function contract (signature, return
  `jsonb`, `SECURITY DEFINER`, `STABLE`, `search_path=public`, owner,
  body) remains byte-for-byte unchanged.
- Empirical matrix (staging, read-only, `BEGIN ... ROLLBACK`, no
  fixtures): `anon` rejected at the ACL boundary (`42501 permission denied`)
  before execution; `authenticated` owner `ok=true`; `authenticated`
  cross-tenant `ok=false` fail-closed; `authenticated` admin `ok=true`;
  `service_role` via direct `SET ROLE` also rejected (`rolbypassrls` of
  RLS is a distinct mechanism from function `EXECUTE`).
- `js/screens/cliente-pedido-detail.js` remains the only real consumer,
  standard authenticated path; no frontend change necessary.
- Local tests: `tests/cliente-pedido-summary-acl-grants.smoke.js` (new)
  + `tests/cliente-pedido-summary-readmodel.smoke.js` (existing) --
  **21/21 PASS**; `git diff --check` clean. No data mutation.
- Debt closed: `ACL_GRANTS_BROADER_THAN_CANONICAL_CONTRACT` --
  `RESOLVED IN STAGING`.
- Debts preserved as open: `DB30_NOT_RECORDED_IN_SUPABASE_
  MIGRATION_HISTORY` (no history record fabricated or repaired
  for `db/30`); `AUTHENTICATED_BROWSER_SMOKE_NOT_EXECUTED`; production
  application of the staging-only stack (incl. `db/57`) remains postponed by
  `STAGING-ONLY-EXECUTION-BOUNDARY-A`; `DEPLOYMENT_MAPPING_AND_
  PRODUCTION_MIGRATION_PROCEDURE` remains deferred.
- Not automatically selected by this closeout: production/deployment,
  G28-D, Vercel, repair of `db/30` migration history, authenticated
  browser smoke, Controlled Delete production guard.
- Reconciliation of the remaining backlog after removing this item: no
  other single, unambiguous technical candidate was identified in this
  documentation pass.
  `NEXT_AUTHORIZABLE_ACTION: NONE`. `ARCHITECT_DECISION_REQUIRED:`
  explicit reconciliation of the remaining general backlog (production,
  authenticated smoke, `db/30` history, or a new front) requires an architect
  decision; none was auto-selected.
- Production (`bhgifjrfagkzubpyqpew`) not accessed; Vercel not accessed; no
  push. See `docs/ledgers/G28_LEDGER.md` for the append-only entry of this
  phase.

# Update 2026-07-19 - PRE-PROD-A-R1 Native Allocation Contract

Phase: `PRE-PROD-A-R1 — NATIVE NEEDS, ALLOCATION AND LIVE CONCURRENCY`
Date: 2026-07-19
Base: branch `dev`, HEAD `51f31dd`
Status: **CONTRACT CLOSED / IMPLEMENTATION AUTHORIZED (CONDITIONAL) / STAGING PENDING**

- Binding contract closed in
  `docs/architecture/ORDEM_COMPRA_LIFECYCLE_SPEC_PROPOSED.md` **§R.23** (governing
  home). This backlog note records only the **production-flow / UI-ownership
  boundary** the contract fixes, which touches this document's concerns.
- **UI surface and domain ownership boundary (corrected by the accepted hybrid-origin
  addendum).** Native yarn-need distribution/allocation belongs to **Pedido → Insumos /
  `aguardando_fios`**. The dedicated Ordem de Compra route
  `#/ordens-compra/:id` and child module
  `js/screens/ordem-compra-distribuicao.js` are an allowed focused surface, not a
  transfer of ownership. The action is not OP-owned, is not a transition-modal write,
  and does not create a new stepper stage.
- **Purchasing regime per Pedido.** `pedido_compra_fio_regime` makes the purchasing
  model explicit and immutable (`legacy` vs `native`); a `native` Pedido stops
  producing flat `ordens_compra_fio` rows at Abrir OP and instead assesses/synchronizes
  native needs server-side. No mixed legacy/native purchasing inside one Pedido.
- **Not in scope here.** Native emission stays inactive (Phase-C receipt gate); B2
  supplier-assignment relocation off the OP screen is unchanged; no receipt/bridge
  work. Open UI debt `ADMIN_SHELL_MOBILE_RESPONSIVENESS_DEBT` remains app-wide and is
  not addressed by this phase.
- Staging (`ucrjtfswnfdlxwtmxnoo`) only; production not accessed; no push. See
  `docs/ledgers/G28_LEDGER.md` for the append-only entry of this phase.

# Update 2026-07-19 - PRE-PROD-A-R1 Staging Closeout

Status: **IMPLEMENTED / VERIFIED IN STAGING / LIVE CONCURRENCY PASS / AWAITING
ARCHITECT VISUAL VALIDATION AND ACCEPTANCE**.

- `LIVE_ALLOCATION_T1_T2_TEST_PENDING` is resolved: T1 PID `2272591` locked and
  committed 60 kg before T2 PID `2272590` woke and rejected 60 kg against 40 kg
  remaining. Cache/allocation total=60 kg; no over-allocation.
- Allocation UI is enabled only on the dedicated native draft-order detail. Browser
  evidence covers native/legacy list, detail, create/absolute update/remove,
  incomplete and complete emission blocks, tablet/mobile, and the OP reader section.
  Native emission remains disabled with `recebimento_nativo_ainda_inativo`; receipt,
  bridge, PRE-PROD-B, and Phase C are not in scope.
- Rollback rehearsal passed and restored the accepted staging state; zero probe,
  advisory-lock, fixture, process, and credential residue. `ADMIN_SHELL_MOBILE_RESPONSIVENESS_DEBT`
  remains an existing, non-blocking visual debt.
- Production, `main`, and push were not accessed. The only next authorizable action is
  architect visual validation and acceptance of PRE-PROD-A.

# Update 2026-07-19 - PRE-PROD-A-R1 Architect Acceptance

## Update 2026-07-19 — PHASE-C3A contract boundary

`PHASE-C3A` is authorized only for an inactive staging foundation. Historical
opening-balance import reconstructs receipt state (39 command headers / 44 ledger
entries / 20,221.280 kg / 405.980 kg excess) without inventory posting. Current
`saldo_fios` is the authoritative opening inventory baseline; no import may alter it
or `saldo_fios_op`. The provenance debt is
`HISTORICAL_SALDO_FIOS_PROVENANCE_UNAVAILABLE`. Real import, fencing, consumer
switches, flat ACL closure, UI, emission, and C3B/C3C/C3D remain out of scope.

Implementation checkpoint: C3A is `IMPLEMENTED / VERIFIED IN STAGING / AWAITING
ARCHITECT TECHNICAL ACCEPTANCE`. Migrations `71/72/73` are applied; db/73 provides
the owner-only, semantically idempotent, advisory-locked Class A/D opening-balance
command. Exact replay and conflict, non-posting/non-reversibility, distinct-backend
concurrency, both no-CASCADE rollback rehearsals, 56 focused tests, and the stable
133-identity full-suite baseline all passed. Final staging remains `legacy_active`
with zero import rows and unchanged 39/44 preview and `saldo_fios` hash. No later C3
phase is selected or authorized.

Status: **CLOSED / ACCEPTED_WITH_NONBLOCKING_ADMIN_SHELL_MOBILE_RESPONSIVENESS_DEBT**.

- Architect acceptance covers the staging migration `20260719120036 /
  69_ordem_compra_preprod_allocation`, authenticated ACL PASS, live T1/T2 PASS,
  allocation UI activation, rollback rehearsal, and desktop/tablet visual evidence.
  `LIVE_ALLOCATION_T1_T2_TEST_PENDING` is resolved.
- Allocation controls remain active in staging for eligible native drafts. Native
  emission remains inactive and ungranted; native receipt and Phase C remain pending.
  `NATIVE_RECEIPT_COMPATIBILITY_MULTI_ORIGIN_UNRESOLVED` remains open.
- `ADMIN_SHELL_MOBILE_RESPONSIVENESS_DEBT` remains open and non-blocking. UI
  provenance / modern-visual-language audit is deferred as a separate
  post-stabilization activity and does not block this acceptance.
- A contemporaneous production diagnosis is mandatory before any production work.
  Production, `main`, push, PRE-PROD-B, and Phase C implementation remain prohibited
  unless separately authorized. The next authorizable action is a separate architect
  order selecting a reconciled backlog front.

# Update 2026-07-19 — Purchase-order hybrid-origin correction R2

Status: **CLOSED / ACCEPTED** at commit
`840dcb19b6bc6ffd8543a3f79bcae07516738bf6`.

- The accepted impact audit keeps every redo verdict at **NO**. B1, PRE-PROD, C1,
  C2, and C3A are not restarted; C3A remains technically verified but unaccepted.
- Native cotton is OP-origin. Shared polyester is Pedido-origin with NULL need and
  allocation OP provenance. No caller-selected, representative, or synthetic OP is
  allowed. Item ordered quantity is derived only from allocation totals.
- Purchase-order ownership remains Pedido + supplier. Purchasing distribution remains
  inside the existing Pedido / Insumos / `aguardando_fios` context. A dedicated route
  may host the UI, but **no new Insumos or purchasing stage is introduced**.
- Localized forward correction must supersede or restrict independent `Nova ordem`,
  item-first/manual-quantity origination, caller-controlled `p_op_id`, OP-owned
  supplier assignment, and Phase C rules that require an OP on shared allocations.
- **Future sequence (each step separately authorized):**
  1. canonical documentation correction;
  2. forward corrective implementation;
  3. focused staging validation;
  4. PRE-PROD revalidation;
  5. Phase C shared-allocation revalidation;
  6. later architect disposition of C3A;
  7. only then continuation to C3B and subsequent phases.

The Impact Audit and Hybrid Need Origin Addendum are also `CLOSED / ACCEPTED`.
REFUND-A, REFUND-B1, PRE-PROD, and Phase C redo verdicts remain **NO**; a forward
corrective migration is selected and staging-data conversion is **NO**.

The next active technical phase is `PURCHASE-ORDER HYBRID ORIGIN — FORWARD
CORRECTION F1`, `AUTHORIZED`, limited to database authority, atomic need-first writing,
NULL-safe allocation identity, allocation-derived item quantity, deterministic
removal/cleanup, obsolete database-writer restriction, and localized Phase C shared-
allocation compatibility. UI correction is outside F1. Staging writes, production,
`main`, and push remain prohibited.

# Update 2026-07-19 — F1 executable contract closure R1

Status: **CLOSED / ACCEPTED** at commit
`00897f09267fc8304b329ce46ba985d03a57faff`. The authorized F1 readiness
reconciliation returned `HARD_STOP — CONTRACT INCOMPLETE`; no implementation began.
Lifecycle §R.28 and schema contract §13 now define the exact need-first RPC,
actor-scoped immutable command idempotency, absolute-target mutation API, deletion of
zero allocations/empty items/empty never-emitted drafts, unique `(item_id,
necessidade_id)` identity, allocation-derived item quantity backstop, complete ACL
disposition, shared NULL-OP receipt/ledger shape, stable errors, lock order, and the
implementation/revalidation matrix. The architect separately authorized
`PURCHASE-ORDER HYBRID ORIGIN — F1 FORWARD CORRECTION IMPLEMENTATION R1`, limited to
the forward-only correction, isolated PostgreSQL verification, and canonical closeout.
Staging application, production, `main`, push, C3A acceptance, and F2 remain
unauthorized.

# Update 2026-07-19 — F1 forward correction implementation R1

Status: **IMPLEMENTED / VERIFIED LOCALLY / AWAITING ARCHITECT REVIEW** at technical
commits `463cafbdd4816ff1093b3086dd71d3d6e70b3479` and
`680cff136a3294ae9a345fc8f91f02e246891eef`; the follow-up preserves the existing
authenticated need-synchronization ACL while obsolete native writers remain
owner-only.

- `db/74_ordem_compra_hybrid_origin_forward_correction.sql` implements the accepted
  need-first absolute-target command, permanent actor-scoped replay journal,
  `(item_id, necessidade_id)` uniqueness, allocation-derived item quantity and
  cleanup, obsolete-writer ACL disposition, and Phase C shared NULL-OP correction.
- Existing application ownership controls are disabled/read-only until F2; no final
  Pedido/Insumos distribution UI was implemented.
- Isolated PostgreSQL 18.4 apply/reapply, rollback functional/ACL/Phase-C matrix, and
  eight distinct-session race scenarios passed. Focused tests pass 62/62. The broad
  suite retains the exact 132 baseline failure identities and hash
  `5aca571de6057bfdf2080ef945112189e6f3f4cb7795ccd827a729131642e75f`, with six new
  passing F1 tests.
- No staging, production, `main`, remote, or push activity occurred. C3A remains
  verified but unaccepted. The next authorizable action is architect review of F1;
  staging application and F2 each require a separate order.

# Update 2026-07-19 — F3 partial staging deployment checkpoint

Status: **PARTIALLY EXECUTED / HARD STOP — VERCEL AUTHENTICATION REQUIRED**.

- Readiness passed; staging migration `20260719215401 /
  74_ordem_compra_hybrid_origin_forward_correction` applied with identical
  pre/post business snapshots and the accepted ACL matrix.
- Source `8214ab7b4e7c185d6f4501a593fcaa836ad65d1b` was deployed without push to
  Vercel preview `dpl_7QGBHzW8MoE4sPVVuGdFrv9Ci7iP` (`READY`).
- Every preview alias requires Vercel Authentication and the controlled browser
  has no Vercel session. No fixture was created. Browser, PRE-PROD, Phase C, and
  broader-suite validation remain pending.
- Resume only after architect authentication in the preserved browser. Production,
  `main`, native emission, C3A activation/acceptance, and later phases remain
  prohibited.

# Update 2026-07-19 — F3R1 staging database/API validation checkpoint

Status: **PARTIALLY COMPLETED / HARD STOP — SAFE COMMITTED CONCURRENCY FIXTURE
POLICY MISSING**.

- `db/74` history, live objects, guards, accepted ACLs, and stable business-data
  snapshots match the repository and accepted contract.
- A rollback-only canonical-domain fixture passed need-first OP/shared mutation,
  replay/conflict, quantity/cleanup, freeze, receipt/reversal, PRE-PROD, and
  nullable-OP Phase C validation with zero persistent residue.
- A committed multi-session synthetic race cannot satisfy zero residue because the
  accepted immutable journal permanently retains each successful actor/key command;
  no canonical retained staging fixture exists.
- The next authorizable action is architect disposition of that exact evidence
  boundary. C3A remains inactive and unaccepted. Vercel/browser, production,
  `main`, remotes, push, native emission activation, and the prohibited project
  were untouched.

# Update 2026-07-19 — F3R1 acceptance disposition (concurrency evidence)

Status: **CLOSED / ACCEPTED_WITH_SCOPED_COMMITTED_CONCURRENCY_FIXTURE_WAIVER**.

- The architect accepted the isolated F1 eight-case distinct-session concurrency
  matrix plus the F3R1 staging runtime/rollback evidence as sufficient for this
  gate. The committed multi-session staging-fixture requirement is waived **for
  F3R1 only**.
- Immutable journal integrity and zero synthetic residue remain mandatory; the
  waiver relaxes neither and sets no precedent for later gates.
- PRE-PROD hybrid-origin and focused Phase C revalidation are accepted.
- C3A remains inactive and not accepted. The next authorizable action is the
  architect's technical-acceptance disposition for C3A only.
- Production, `main`, native emission activation, C3A execution, remotes, push,
  deployment, and the prohibited project remain unauthorized and were untouched.

# Update 2026-07-19 — PHASE-C3A technical acceptance closeout

Status: **CLOSED / TECHNICALLY ACCEPTED**.

- Acceptance evidence: staging migrations `71`-`74` present; cutover singleton
  `id=1`, `legacy_active / not_started`, all cutover markers `NULL`; zero
  import headers, import ledger rows, native headers, inventory movements, and
  baseline rows; preview 39 headers / 44 ledger entries / 20,221.280 kg
  reconstructed / 405.980 kg excess; `saldo_fios` 5 rows / 2,685.020 kg;
  `saldo_fios_op` zero; import command owner `postgres`, `SECURITY DEFINER`,
  fixed empty `search_path`, no EXECUTE for
  `PUBLIC`/`anon`/`authenticated`/`service_role`; authenticated read-only
  preview ACL intentionally retained under §R.28.5; focused suite 66/66
  passed.
- Disposition recorded by the technical supervisor acting as delegated project
  architect; not attributed to Kleber.
- Documentation-only: authorizes no real import, snapshot, fence,
  reader/writer or flat-ACL switch, native emission,
  `C3B`/`C3C`/`C3D`/`C4`/`C5`, production, `main`, remote change, push, or
  deployment. `HISTORICAL_SALDO_FIOS_PROVENANCE_UNAVAILABLE` remains
  nonblocking debt.
- No phase chains automatically from this closeout; any `C3B`+ scope requires
  a separate architect order.

# Update 2026-07-19 — PHASE-C3B executable contract closure R1

Status: **CLOSED / ACCEPTED** by the technical supervisor acting as delegated
project architect; this acceptance is not attributed to Kleber.

- C3B closes the executable Phase-C3 contract only. Lifecycle §R.29 and schema
  §13.15 govern C3C inactive implementation, C3D rehearsal/inactive staging
  deployment preparation, and the later separately authorized real cutover.
- The real cutover consists of one contiguous maintenance window with a
  session-level advisory lock, deterministic resource lock order, short database
  transactions, database-owned legacy receipt fencing, frozen 51-mapping and full
  inventory snapshots, deterministic 39-header/44-line import, reconciliation,
  canonical read activation, explicit ACL/policy closure, and no soak interval.
- The point of no return is the first successfully committed non-import canonical
  receipt after the canonical read switch. Before it, rollback may restore flat
  reads only after proving zero productive canonical receipts; legacy writers
  remain fenced and flat mutation grants remain closed. After it, recovery is
  forward-only.
- C3 creates no visual UI. C4 exclusively owns the new admin receipt UI at
  `#/ordens-compra/:id`; supplier UI remains deferred. Existing compatibility
  surfaces may receive only non-visual state adapters or be disabled at cutover.
- Documentation-only: no code, SQL, test, database, staging, deployment,
  production, `main`, remote, or push activity occurred.
- **NEXT_AUTHORIZABLE_ACTION: `PHASE-C3C` — inactive implementation only.** A
  separate architect order is required; this closeout neither authorizes nor
  executes C3C.

# Update 2026-07-20 — PHASE-C3C-A inactive implementation documentary closeout R1

`C3C_A_STATUS: CLOSED / TECHNICALLY ACCEPTED — LOCALLY VERIFIED / INACTIVE / NOT APPLIED TO STAGING`

`NEXT_AUTHORIZABLE_ACTION: READ-ONLY GOVERNANCE AND SPEC-CUSTODY AUDIT`

Status: **CLOSED / TECHNICALLY ACCEPTED — LOCALLY VERIFIED / INACTIVE / NOT
APPLIED TO STAGING**. Acceptance is recorded by the delegated technical
supervisor and is not attributed to Kleber.

- Technical chain: `d4dba671` → `4b7ee13f` → `29913e40` → `89123729`.
- Accepted locally: inactive database contract; 14-table `PUBLIC`-policy
  closure; replay idempotency; stable identity conflict; canonical snapshot/live
  SHA-256; exact 51 mappings / 39 headers / 44 scoped lines / 19,815.300 kg
  attributable / 405.980 kg excess / 20,221.280 kg reconstructed / zero import
  inventory movements; nullable Pedido-origin provenance; attributable/excess
  separation; no fabricated OP or double count; runtime session-lock exclusion,
  deterministic eight-stage resource locks, release/reacquisition, zero
  deadlocks, and idle final backend; pre-PONR rollback; post-PONR forward-only
  recovery.
- Lifecycle §R.29 and schema §13.15 are unchanged. The single later cutover
  window, database fence, short transactions, session lock, complete table/column
  ACL closure, no-visual-C3 boundary, C4 admin-UI ownership, deferred supplier UI,
  PONR, and recovery boundaries remain governing.
- This grants local technical acceptance only. Staging validation/application,
  deployment, activation, cutover, and product acceptance are not granted.
- Unauthorized: C3C-B implementation, C3D, staging application/validation,
  activation, deployment, real snapshot/import, fence transition, read switch,
  final ACL-closure invocation, cutover, C4, C5, production, `main`, remotes, and
  push.
- **NEXT_AUTHORIZABLE_ACTION: `READ-ONLY GOVERNANCE AND SPEC-CUSTODY AUDIT`.**
  C3C-B remains the next product implementation lot but is not authorized. The
  audit precedes any C3C-B implementation order; no product phase chains.

# Update 2026-07-24 — PHASE-MANTA-A (Manta product identity + route homogeneity)

A second product variation, **Manta** (`modelos.tipo_produto = 'manta'`), enters the
flow (governing contract:
`docs/architecture/MANTA_PRODUCT_VARIANT_PHASE_CONTRACT.md`; schema: `db/78`).
Sequence impact:

- A Pedido may mix Tapete and Manta items; a weaving OP must be route-homogeneous,
  so a mixed Pedido produces separate weaving OPs by product type. Enforced by the
  `op_itens` DB trigger and by `js/screens/op-persistir.js` before OP-number
  consumption; `js/screens/op-nova.js` requires an explicit product-type choice for
  a mixed Pedido.
- A Manta OP is **tecelagem-only**: it never creates or enters acabamento/látex
  (the finishing RPCs reject a Manta origin), and no finishing action is offered for
  it in the UI.
- Manta is **not operationally deliverable** in PHASE-MANTA-A. The direct
  weaving→client route (`entregas.etapa = 'tecelagem_direto'`, generalized
  expedition source, weaving-only completion and progress) is deferred to
  PHASE-MANTA-B and is not authorized here.

The canonical `insumos → tecelagem → acabamento(látex) → expedição → entrega` flow
for Tapete is unchanged.

# Update 2026-07-24 — PHASE-MANTA-A shared-dev apply and route ruling (forward correction)

Order `PHASE-MANTA-A-SHARED-DEV-APPLY-LIVE-VALIDATION-AND-CLOSEOUT-R1` applied db/78–db/80
to shared development `ucrjtfswnfdlxwtmxnoo` and live-validated the Manta product identity
(governing contract `MANTA_PRODUCT_VARIANT_PHASE_CONTRACT.md` §9). It also corrects the
earlier direct-route assumption.

**Binding product route sequences (current ruling):**

- **Tapete**: Insumos → Tecelagem → Acabamento → Expedição → Entrega.
- **Manta**: Insumos → Tecelagem → Expedição → Entrega (weaving-direct; no Acabamento).

**Superseded:** the previously stated `entregas.etapa = 'tecelagem_direto'` mechanism is no
longer represented as a selected solution. The Manta backend direct-output
(weaving→expedition) persistence mechanism is **unresolved**; no new `entregas.etapa` value
and no new database stage is assumed or canonized here. PHASE-MANTA-B must begin with a
bounded reconciliation of the existing expedition, delivery and progress mechanisms before
choosing the minimum backend change (next authorizable action
`PHASE-MANTA-B-DIRECT-ROUTE-RECONCILIATION-R1`; MANTA-B implementation unauthorized).

**Stepper/UI ruling:** the Manta stepper omits Acabamento entirely (never shown as pending
or disabled); Tapete keeps Acabamento; a mixed Pedido must represent its two applicable
routes separately (preferably by homogeneous OP or route-specific progress) — a single fixed
linear stepper must not falsely represent a mixed Pedido. The dynamic Manta stepper is a
PHASE-MANTA-B UI item, not implemented at this checkpoint; at the database level a Manta OP
already never creates or enters Acabamento/Látex.

# Update 2026-07-24 — PHASE-MANTA-B1 (expedition source foundation, db/81)

Order `PHASE-MANTA-B1-EXPEDITION-SOURCE-FOUNDATION-R1` implements the **dormant database
foundation** for the Manta direct route (governing contract
`MANTA_DIRECT_ROUTE_PHASE_CONTRACT.md`; schema shapes in `PEDIDO_OP_SCHEMA_CONTRACT.md`
"Update 2026-07-24 — PHASE-MANTA-B1"). STATUS: IMPLEMENTED / LOCALLY AND CONCURRENTLY
VERIFIED / AWAITING ARCHITECT REVIEW; PHASE-MANTA-B1 remains open.

**Selected backend persistence mechanism (resolves the B-reconciliation question for the
source):** the Manta weaving→expedition output is carried by a **second typed expedition
source** `expedicoes.op_tecelagem_id` (the Manta weaving OP), mutually exclusive with the
Tapete `op_latex_id` (`expedicoes_exactly_one_source_chk`, one expedition per Manta OP).
Eligibility derives exclusively from measured weaving output (`entregas.etapa='cima'` +
`entrega_itens`, non-defect metres — BR-1). `entregas.etapa='cima'` is reused unchanged;
**no** new `entregas.etapa` value and **no** new database stage are created;
`entregas_destino_cima_chk` and `salvarEntregaCima` are unchanged; Manta never enters
Acabamento/Látex.

**Dependencies (B1 → B2):** db/81 is dormant — no UI/RPC/writer creates a Manta expedition;
the existing `liberar_expedicao*`/`registrar_entrega_expedicao` remain Latex-only and
unchanged; Tapete expedition/delivery unchanged. PHASE-MANTA-B2 (the Manta expedition writer,
the route-conditional `cima` destination relaxation, the balance-preserving reversal writer
for consumed-output correction, and the dynamic Manta stepper / route-aware progress) is
**not authorized** and requires a separate explicit order; no phase chains automatically.

Verified on a disposable PostgreSQL 18.4 cluster (`tests/manta-expedition-source.integration.sql`,
`tests/manta-expedition-source-invariant.mjs`): full db/01..81 apply, db/81 idempotent
re-apply (zero drift), all source/membership/consumed-output/reopening guards, C5 + identity +
finishing regressions, and distinct-session concurrency (one expedition per Manta OP; item
writes cannot cross sources or overtake a source change; deterministic lock order, no
`40P01`); cluster destroyed with proof. Migration terminal advanced 80 → 81. No
shared-development apply is authorized by this order.

# Update 2026-07-24 — PHASE-MANTA-B2 activation contract (documentation-only)

Order `PHASE-MANTA-B2-ACTIVATION-CONTRACT-R1` (read-only architectural
reconciliation) produced the binding implementation contract
`docs/architecture/MANTA_DIRECT_ROUTE_ACTIVATION_CONTRACT.md` for activating the
dormant db/81–db/84 foundation. STATUS: CLOSED / ACCEPTED / DOCUMENTED. No
migration, product code or test changed; no environment was mutated; the
shared-development terminal remains `84` and the Manta route remains dormant.

**Sequence and dependencies introduced by this contract.**

- `PHASE-MANTA-B2A-BACKEND-ACTIVATION-R1` — exactly three forward-only
  migrations: `db/85` (route-conditional `cima` delivery: drop
  `entregas_destino_cima_chk`, install the route-aware `entrega_itens` /
  `entregas` destination guards, add the Manta-only `registrar_entrega_cima_manta`
  RPC; Tapete path untouched), `db/86` (`consultar_saldo_expedicao_manta`,
  `liberar_expedicao_manta_parcial`, `public.expedicao_comandos` idempotency
  table), `db/87` (`estornar_expedicao_manta_parcial` plus the mandatory
  route-symmetric correction of `concluir_pedido_se_pronto`). Local disposable
  PostgreSQL only; no `js/**`; no shared-development apply.
- `PHASE-MANTA-B2B-ROUTE-AWARE-UI-R1` — depends on B2A acceptance. Zero
  migrations. Route sections per Pedido, Manta output action, direct expedition
  navigation, dual-source expedition screen with available/released/delivered/
  remaining balances and the reversal action, route-derived client tracking.
- `PHASE-MANTA-B2C-SHARED-DEV-FLOW-AND-CLOSEOUT-R1` — depends on B2B acceptance.
  Applies db/85–87 once each to shared development `ucrjtfswnfdlxwtmxnoo`
  (terminal 84 → 87), live end-to-end validation, zero-residue cleanup,
  documentary closeout.

Each phase requires its own explicit order; no phase chains automatically.

**Blocking defect recorded for B2A.** `concluir_pedido_se_pronto` (`db/23`)
counts only `ops.tipo='latex'` OPs joined on `expedicoes.op_latex_id` when
checking for a terminal source OP without an expedition. A Manta-only Pedido
whose weaving OP is terminal and which has no expedition at all therefore
satisfies every pendency today and would be marked `entregue`. Its
route-symmetric correction is mandatory in `db/87` and is an acceptance gate of
B2A, not an optional improvement.

**Naming reconciliation.** No database object named
`registrar_movimentacao_direta_expedicao` exists. The accepted direct-movement
writer is the `db/32` redefinition of `liberar_expedicao_latex_parcial(BIGINT,
JSONB, TEXT)`; references to the former name resolve to the latter.

# Update 2026-07-24 - PHASE-MANTA-B2A-BACKEND-ACTIVATION-R1 (IMPLEMENTED / LOCALLY AND CONCURRENTLY VERIFIED / AWAITING ARCHITECT REVIEW)

PHASE-MANTA-B2A is implemented. Exactly three forward-only migrations were
created and validated on a local disposable PostgreSQL 18.4 cluster:

- `db/85_manta_cima_route_conditional_delivery.sql` — the pre-existing data gate,
  the drop of `entregas_destino_cima_chk`, the route-aware
  `entrega_itens_cima_route_destino_guard` / `entregas_cima_destino_route_guard`
  pair, and `registrar_entrega_cima_manta` as the only Manta `cima` writer;
- `db/86_manta_expedition_release_writer.sql` — `public.expedicao_comandos`,
  `consultar_saldo_expedicao_manta` and `liberar_expedicao_manta_parcial`;
- `db/87_manta_expedition_reversal_and_route_completion.sql` —
  `estornar_expedicao_manta_parcial` and the route-symmetric forward correction
  of `concluir_pedido_se_pronto`.

`db/01`–`db/84` are byte-unchanged, no fourth migration was needed, no `js/**`
file was touched, and no environment was accessed: shared development
`ucrjtfswnfdlxwtmxnoo` remains at terminal `84` with the Manta route dormant.

**The blocking defect recorded for B2A is closed.** `concluir_pedido_se_pronto`
is route-symmetric: a terminal Manta weaving OP now requires an expedition
through `op_tecelagem_id`, unreleased non-defect measured output is a pendency,
and every expedition of the Pedido must be `concluida` — while every existing
Tapete pendency message, the signature, the authorization and the grants are
preserved verbatim.

**Mandatory pre-edit lock-order reconciliation resolved as outcome A** (one
globally compatible order; no architectural conflict, so no hard stop). The
`OP → entrega` versus `entrega → OP` inversion is eliminated structurally: no
path holds a delivery row lock and then requests an `ops` row lock. Item-versus-
header races serialize on an explicit `entregas` FOR SHARE lock — the FK's
implicit FOR KEY SHARE would not conflict with a header UPDATE — and the loser
re-validates totally against committed state. Fifteen distinct-session proofs
cover every §9 requirement with `pg_stat_database.deadlocks = 0`; all three
migrations re-apply with zero drift; db/78–84, the Manta finishing rejection, the
Latex expedition/delivery flow and C5A emission are all green and unchanged.

Owner of the full implementation record:
`docs/architecture/MANTA_DIRECT_ROUTE_ACTIVATION_CONTRACT.md` §15.

**Next.** Architect review of B2A. `PHASE-MANTA-B2B-ROUTE-AWARE-UI-R1` and
`PHASE-MANTA-B2C-SHARED-DEV-FLOW-AND-CLOSEOUT-R1` remain unauthorized and each
require their own explicit order; no phase chains automatically. One consequence
is recorded and deliberately uncorrected:
`tests/manta-expedition-source-invariant.mjs` still expects terminal `84` in its
Part A and is outside this order's authorized manifest; its substantive payload
runs unchanged and green inside the B2A harness, and realigning it is a separate
authorizable action.

# Update 2026-07-24 - PHASE-MANTA-B2A-MEASURED-OUTPUT-IDENTITY-AND-FK-LOCK-CORRECTION-R1 (IMPLEMENTED AND CORRECTED / LOCALLY AND CONCURRENTLY VERIFIED / AWAITING ARCHITECT REVIEW)

One forward-only migration,
`db/88_manta_measured_output_identity_and_fk_lock_correction.sql`, corrects
three defects left by db/85–db/87 without editing them. `db/01`–`db/87` are
byte-unchanged, no `js/**` file was touched, and no environment was accessed:
shared development `ucrjtfswnfdlxwtmxnoo` remains at terminal `84`.

- **Delivery-item model identity.** `modelo_id` becomes a trigger-relevant
  identity field, so a modelo_id-only UPDATE no longer escapes the guard. The
  rule is route-conditional: mandatory and exact for Manta, exact-when-supplied
  for Tapete. That is deliberate — `entrega_itens.modelo_id` is nullable by
  design and the live Tapete writer never sends it, so an unconditional non-null
  match would have rejected every Tapete delivery, a forbidden Tapete behavior
  change. Objective coverage is unaffected: the only Manta writer always copies
  the model from the op_item, and direct Manta writes without it are now refused.
- **Measured-output identity freeze.** New `op_itens_manta_output_reference_guard`
  makes an op_item's `op_id`, `modelo_id` and `pedido_item_id` immutable while
  Manta measured output references it, so a later identity change cannot
  retro-actively rewrite what the recorded output means. Quantity and same-value
  updates stay permitted; Tapete is unaffected; there is no
  `app.retificacao_autorizada` bypass.
- **Foreign-key lock order.** The accepted analysis now includes the implicit
  `FOR KEY SHARE` lock the `op_item_id` foreign keys take. db/85–87 acquired the
  OP first and then wrote the child rows (`OP -> op_item`) while every op_itens
  guard runs after the row is already locked and then requests the OP
  (`op_item -> OP`) — a real cycle. Every Manta path now pre-locks the referenced
  op_items `FOR KEY SHARE` ascending **before** the source OP, the direction
  PostgreSQL forces and cannot be reversed.

A **pre-existing data gate** aborts the migration if any item-bearing `cima`
delivery already violates the identity or route rules; nothing is repaired or
reinterpreted.

Evidence on one fresh disposable PostgreSQL 18.4 cluster: db/01..88 clean apply;
80 sequential integration proofs; 21 distinct-session proofs — including both
winner orders against a concurrent op_item DELETE and against a concurrent
op_item identity change — with `pg_stat_database.deadlocks = 0`; re-applying
db/85..db/88 in order returns the fingerprint (columns, constraints, triggers,
indexes, function bodies, grants, RLS) exactly, and db/88 also re-applies
standalone with zero drift; db/78–84, Tapete delivery, Latex expedition,
release/reversal idempotency, the completion correction, Manta finishing
rejection and C5A emission all green and unchanged; cluster destroyed with PID,
port and directory proof.

**B1 harness realignment.** `tests/manta-expedition-source-invariant.mjs` no
longer hard-codes an eternal manifest length of 84: it applies the complete
current chain, asserts `db/01..db/84` is a contiguous prefix, keeps every B1
assertion unweakened, and passes under db/01..88. The consequence recorded in the
previous entry is therefore closed.

**Next.** Architect review of PHASE-MANTA-B2A (now including db/88).
`PHASE-MANTA-B2B-ROUTE-AWARE-UI-R1` and
`PHASE-MANTA-B2C-SHARED-DEV-FLOW-AND-CLOSEOUT-R1` remain unauthorized and each
require their own explicit order; no phase chains automatically.

# Update 2026-07-24 - PHASE-MANTA-B2B-ROUTE-AWARE-UI-AND-READ-MODELS-R1 (route activated in the product surfaces; zero migrations; awaiting architect technical and visual review)

**Scope.** `js/**`, `index.html` (script tags with cache-busting),
`tests/*.smoke.js` and the affected documentation owners. **`db/**` is
byte-unchanged; migration count 0.** No shared-development, staging or
production access; no Vercel; no real business data. One commit, one
`staging/dev` publication.

**What changed.** The Manta direct route is now represented end to end in the
product: `Insumos → Tecelagem → Expedição → Entrega` for Manta and the
unchanged `Insumos → Tecelagem → Acabamento → Expedição → Entrega` for Tapete.
A mixed Pedido renders two independent route sections; the fixed five-stage
stepper no longer exists for any Pedido. The Manta weaving OP records measured
output through `registrar_entrega_cima_manta` with no finishing supplier, no
destination selector and no Latex-OP generation; the expedition screen resolves
its single real source (`op_latex_id` **or** `op_tecelagem_id`), states it
explicitly and navigates "Ver OP" correctly instead of producing `#/ops/null`;
Manta balances and release/reversal actions come from
`consultar_saldo_expedicao_manta`, `liberar_expedicao_manta_parcial` and
`estornar_expedicao_manta_parcial`, with planned quantity shown as information
only. Client-facing progress derives which steps exist from the route while the
published position stays the curated commercial artefact.

**Route identity.** Derived exclusively from `modelos.tipo_produto` — through
`op_itens.modelo_id` on administrative surfaces and through
`pedido_itens.modelo_id` on the client surface, which cannot read `op_itens`.
Never from `ops.tipo`, a model name, width alone, a screen name or the presence
of a finishing supplier.

**Structure.** Eight new cohesive modules (route derivation, route-section view
models and arrangement, Manta writes, Manta output form, the shared Manta
movement form, the Manta expedition UI, and the client route reader).
`pedido-detail-events.js` stayed at 2709 lines and `pedido-detail-progress.js`
fell from 988 to 919 — neither protected file grew; behaviour was extracted, not
appended. `CODE-HEALTH-AUDIT-18-R1` was not enlarged.

**Evidence.** New `tests/manta-route-ui.smoke.js` (33 assertions) proves every
numbered requirement of the B2B test contract. Existing Tapete suites were
extended, never weakened; three assertions whose subject moved to an extracted
module were realigned to the new owner with identical semantics. Full suite:
4203 tests, zero new failures relative to `b266131`. Local visual validation ran
against an ephemeral in-browser fixture with an in-memory Supabase double — no
network, no environment, no fabricated session — destroyed with proof; pixel
screenshots were unavailable in the executor's session, so the visual evidence
is rendered-structure, computed-geometry and action-state evidence.

**Next.** `PHASE-MANTA-B2B-ARCHITECT-TECHNICAL-AND-VISUAL-REVIEW`.
`PHASE-MANTA-B2C-SHARED-DEV-FLOW-AND-CLOSEOUT-R1` remains unauthorized and
requires its own explicit order; no phase chains automatically.
