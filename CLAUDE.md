# Controle de Tapetes — Ravatex

## Mandatory reading BEFORE any implementation

- `PROJECT_STATE.md` — current state; sole owner of the present operational state.
- `AGENT_HANDOFF.md` — continuity for the next session.
- `docs/architecture/CODE_HEALTH_RULES.md` — 19 binding architectural health
  rules (18 modularization + 1 language, §19); no new code may violate them.
- `docs/governance/DOCUMENTATION_MODEL.md` and `docs/DOCUMENTATION_INDEX.md` —
  documental governance model and arbiter of authority/classification.

## Operational rules (pointer summary; detail in the canonical docs)

- Every phase requires explicit authorization from the architect; phases do not
  chain automatically.
- Staging-only environment: Supabase `ucrjtfswnfdlxwtmxnoo`; production **FORBIDDEN**
  without separate explicit authorization.
- Git: selective staging by literal path; no push without explicit
  authorization; forbidden without authorization: `add -A`/`add .`, `reset`, `rebase`,
  force push, `merge`, `tag`, `amend`.
- Every phase closes with a documental closeout (`PROJECT_STATE.md`,
  `AGENT_HANDOFF.md`, front ledger).
- A task without updated documentation is a task not completed.

## Language policy

- New code, comments, and commit messages: English
- Canonical state documents and reports: English
- Ledger entries: language of original entry, immutable
- Architect orders may be issued in Portuguese; once recorded in canonical documents they are recorded in English, with the original wording preserved in the ledger or archive
- User-facing UI text: Portuguese (pt-BR)
- No retroactive translation outside the DOC-LANGUAGE-MIGRATION track

Canonical homes for this policy: `docs/governance/DOCUMENTATION_MODEL.md` (§18,
Language policy), `docs/architecture/CODE_HEALTH_RULES.md` (§19),
`docs/governance/SUPERVISION_PROTOCOL.md` (§3, order format). This section is a
pointer summary; in divergence, those canonical homes prevail.

## In case of conflict

This file **is not authority** — it is a pointer. In divergence between this
summary and the canonical documents, the canonical ones prevail: stop and
report, do not follow this summary.
