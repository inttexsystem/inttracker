# G28-P0 — MECHANICAL CLOSEOUT (HISTORICAL RECORD)

- **Status:** `CLOSED / ACCEPTED` (historical).
- **Closing HEAD:** `383db586e70852fba3c5ae5d5ac5312ab1b49284`.
- **G28-A:** `REJECTED AS CONTRACT / RETAINED AS DIAGNOSTIC INPUT`.
- **G28-B1:** `AUTHORIZED` at the moment of this closeout; since then G28-B1, B2, B3, B4 and B5-D5 have been accepted.
- **Current state (historical):** see HISTORICAL EXECUTION CHECKPOINT — SUPERSEDED above. The current operational state is in `PROJECT_STATE.md`.
- **Historical record only:** the active phase, the last accepted block, and the next authorizable action are in the checkpoint and in `PROJECT_STATE.md`.

---

# MASTER PLAN — DOCUMENTS, HUMAN VALIDATION, LINKS AND EVOLUTION

**Project:** Ravatex — Controle de Tapetes / Documents Ingestor  
**Plan status:** reconciled (G28-PLAN-R1 on 2026-07-14); this plan is the architectural backlog of G28 and `PROJECT_STATE.md` holds the current operational state.
**Active phase:** No functional phase is active. G28-C is `CLOSED / ACCEPTED_WITH_NONBLOCKING_AUTHENTICATED_BROWSER_SMOKE_DEBT`. G28-D discovery/preparation remains `RELEASE CONTRACT DISCOVERY COMPLETE` (evidence preserved in `docs/releases/G28_D_RELEASE_CANDIDATE.md`); by explicit architect decision (`STAGING-ONLY-EXECUTION-BOUNDARY-A`, 2026-07-15) its publication is `DEFERRED BY ARCHITECT UNTIL GLOBAL BACKLOG COMPLETION` and does not constitute a current blocker for staging work. Publication remains `NOT STARTED / NOT ACCEPTED / NOT AUTHORIZED`.
**Last accepted phase:** `G28-C — CLOSED / ACCEPTED_WITH_NONBLOCKING_AUTHENTICATED_BROWSER_SMOKE_DEBT`.
**G28-D:** discovery `RELEASE CONTRACT DISCOVERY COMPLETE`; publication `DEFERRED BY ARCHITECT / NOT A CURRENT BLOCKER / NOT AUTHORIZED` (explicit decision `STAGING-ONLY-EXECUTION-BOUNDARY-A`, 2026-07-15 — postponed until completion of the full canonical backlog, not discovered/defined/tested/completed). No publication, push, production, or acceptance; discovery evidence preserved in `docs/releases/G28_D_RELEASE_CANDIDATE.md`.
**G28-B6:** `DECIDED / IMPLEMENTED / TESTED / STAGING FUNCTIONALLY VERIFIED / ACCEPTED_WITH_NONBLOCKING_TEST_DEBT` — technical commit `b2f180ed0e6f1c2ee6c02881d0199d1bfaf29366`; staging verification closeout `b130db44d32718ddf6d3e2bffb1439dac3a1948f`; `db/51` applied in `ucrjtfswnfdlxwtmxnoo`; RPC matrix 20/20, proof of dual ownership and PostgreSQL rollback of the wrapper. Contract: Document→Pedido 0..1, Document→OP 0..N; dedicated, typed/versioned revision; Ingestor fields not promoted. Accepted non-blocking debts: authenticated browser smoke pending; two stale expectations in `tests/documentos-recebidos-queue-ui.test.js`; synthetic audit graph in staging preserved under `ON DELETE RESTRICT`. See G28 ledger (B6 closeout and acceptance).
**G28-B7:** `CLOSED / ACCEPTED_WITH_NONBLOCKING_REMOTE_SMOKE_DEBT` — explicit architectural acceptance on 2026-07-14. Canonical reverse-projection read model (`js/document-surface-links-read-model.js`) + `DOCUMENTOS VINCULADOS` section in the Pedido detail, confirmed via active canonical revision and distinct from `pedido_manual` suggestions. Partial Pedido-detail B7 commit: `ed35f049397af4061ed6e8bb2d9ec3056c543724`; completion `9ef61e1896af631bc5aeeced4af93c77051f4de4`. Remaining surfaces complete: OP detail (`op-latex-admin` + `op-tecelagem-producao-admin`), canonical Pedido/OP timeline, canonical global search in the central queue, shared UI helper `js/document-links-surface-ui.js`. Non-blocking debt: authenticated B7 smoke in staging. See G28 ledger (B7).
**G28-B8:** `TECHNICALLY COMPLETED / ACCEPTANCE SUBSUMED BY G28-C` — `db/52` applied once in `ucrjtfswnfdlxwtmxnoo` (registry `20260715024449`), structure/RPC/grants verified and synthetic authenticated matrix 18/18 approved, including the five-argument B6 wrapper and the ownership boundary. B8's correction, revocation, restoration, and audit capabilities were explicitly validated and accepted in the G28-C staging/projections matrix (16/16 PASS). B8 is not pending; its acceptance was subsumed by the G28-C gate and architectural acceptance. The authenticated modal smoke remains `LIVE_B8_MODAL_SMOKE_BLOCKED_BY_TOOLING`; see G28 ledger (B8).
**G28-C:** `CLOSED / ACCEPTED_WITH_NONBLOCKING_AUTHENTICATED_BROWSER_SMOKE_DEBT`; staging/projections matrix `16/16 PASS`; authenticated browser remains a tooling debt. **G28-D:** `RELEASE CONTRACT DISCOVERY COMPLETE / BLOCKED BY SPECIFIC MISSING DEPLOYMENT DEFINITION`; not accepted and not published.
**Controlled Delete × documentary history (cross-cutting, outside the numbered G28-A..D sequence):** `CLOSED / ACCEPTED` — technical commit `707a37bd1d2c4728ab2a17433b6441049bd88062`. The canonical documentary link (`document_link_revisions` / `document_link_revision_ops`) now also protects the physical test deletion of Pedido/OP (`db/34`–`db/37`): deletion is blocked in a controlled manner when linked documentary history exists, without deleting, altering, or reactivating any revision; in the absence of history, the prior deletion policy remains unchanged. The `Documento→Pedido 0..1` / `Documento→OP 0..N` contract and the two canonical tables (`document_link_revisions`, `document_link_revision_ops`) are preserved without change in cardinality or ownership. Does not constitute acceptance of G28-D, publication, or a later G28 phase. See `PROJECT_STATE.md`, `docs/architecture/PEDIDO_OP_SCHEMA_CONTRACT.md`, and `docs/ledgers/G28_LEDGER.md`.
**Open architect decisions:** `OPEN_ARCHITECT_DECISIONS: NONE` for the current staging cycle. `DEPLOYMENT_MAPPING_AND_PRODUCTION_MIGRATION_PROCEDURE` was reclassified by explicit architect decision (`STAGING-ONLY-EXECUTION-BOUNDARY-A`, 2026-07-15) as `DEFERRED UNTIL GLOBAL BACKLOG COMPLETION / NOT A CURRENT STAGING BLOCKER / NOT STARTED` — not discovered, defined, tested, or completed; only postponed. Current operational environment: staging (`ucrjtfswnfdlxwtmxnoo`) exclusively; the protected Supabase project is out of scope. `CLIENTE-ORDER-SUMMARY-READMODEL-ACL-GRANTS-R1` was authorized, implemented, applied, and verified in staging on 2026-07-15 (`CLOSED / ACCEPTED`; see `D-COS07` §6.2 and `PROJECT_STATE.md`). `NEXT_AUTHORIZABLE_ACTION: NONE` — no single unambiguous technical candidate after removing this item; `ARCHITECT DECISION REQUIRED AFTER BACKLOG RECONCILIATION`.
**Last reconciliation:** 2026-07-14 (G28-PLAN-R1; B6 checkpoint updated after direct verification).
**Authority rules:** Git proves live branch/HEAD/index/worktree; `PROJECT_STATE.md` holds the current operational state; `AGENT_HANDOFF.md` holds continuity; the G28 ledger holds the append-only history of closeouts; this master plan holds architecture/backlog; plans alone do not authorize execution.

---

## HISTORICAL EXECUTION CHECKPOINT — SUPERSEDED

> **This checkpoint has been superseded.** The subsequent canonical state is recorded in the header of this plan (lines 1–25) and in `PROJECT_STATE.md`. G28-C is `CLOSED / ACCEPTED_WITH_NONBLOCKING_AUTHENTICATED_BROWSER_SMOKE_DEBT`; G28-D discovery is `COMPLETED / BLOCKED_BY_MISSING_DEPLOYMENT_DEFINITION`; G28-B8 was subsumed by the acceptance of G28-C. No functional phase is active. See the header and `PROJECT_STATE.md` for the current state.

**Date:** 2026-07-14 (HISTORICAL)
**Technical baseline:** `9ef61e1896af631bc5aeeced4af93c77051f4de4` (branch `work/g28-document-qualification`; clean worktree before B8 implementation).

**Last accepted phase in this checkpoint:** `G28-B7 — surface display — CLOSED / ACCEPTED_WITH_NONBLOCKING_REMOTE_SMOKE_DEBT` (explicit architectural acceptance on 2026-07-14; partial `ed35f04`, completion `9ef61e1`).

**Active phase in this checkpoint:** `G28-B8 — correction, revocation, restoration, and audit — IMPLEMENTED / TESTED (local) / READY FOR ARCHITECT ACCEPTANCE`.

**G28-B8 increment:** `db/52` applied once in `ucrjtfswnfdlxwtmxnoo` (registry `20260715024449`), without B5 backfill/alteration. Structure/RPC/grants and the `G28-B8-VERIFY` matrix 18/18 verified directly; the candidate/event/decision boundary remained intact and fixtures were cleaned up. The only debt is `LIVE_B8_MODAL_SMOKE_BLOCKED_BY_TOOLING`.

**Staging evidence (B6/B8):** project `ucrjtfswnfdlxwtmxnoo`, no production access; migration 51 preserved and `db/52` applied/verified. B8: functional RPC matrix 18/18, no mutation of Ingestor/decision fields, no operational effects, and zero fixture cleanup residue. B6: atomic wrapper passed the five-argument internal path after the signature evolution.

**Open architect decisions in this checkpoint:** `OPEN_ARCHITECT_DECISIONS: NONE`.

**Verified limit:** local tests cover the B6/B7/B8 contracts; the application and verification of `db/52` in staging, and the authenticated smoke of the administration modal, are required and do not authorize production, backfill, or historical repair.

**Authority rules in this checkpoint:**
- Git proves live branch/HEAD/index/worktree;
- `PROJECT_STATE.md` holds the current operational state;
- `AGENT_HANDOFF.md` holds continuity;
- The G28 ledger holds the append-only history of closeouts;
- This master plan holds architecture and backlog;
- Plans alone do not authorize execution.

---

## 1. OBJECTIVE

Organize the evolution of the Documents front without breaking the already-consolidated architecture, while preserving:

- real sources of truth;
- separation between technical detection, human validation, operational linking, and administrative decision;
- canonical integration with Pedido and OP;
- visual continuity of the app;
- complete operation even without active supplier participation;
- auditable implementation sequence;
- future backlog for access, backup, and external collaboration.

This plan must be read together with:

- `PROJECT_STATE.md`;
- `AGENT_HANDOFF.md`;
- `docs/architecture/PEDIDO_OP_MOVIMENTACAO_DOCUMENTOS_PLANO.md`;
- architecture documents referenced by those files;
- versioned visual contract, when created;
- relevant skills and instructions existing in `.claude/`.

---

# CAMADA 0 — MANDATORY GOVERNANCE

## 0.1 Canonical sources

Before any diagnosis, implementation, migration, UI, or integration, the IAsup must read:

1. `PROJECT_STATE.md`;
2. `AGENT_HANDOFF.md`;
3. `services/documents-ingestor/PROJECT_STATE.md`;
4. `docs/architecture/PEDIDO_OP_MOVIMENTACAO_DOCUMENTOS_PLANO.md`;
5. this plan;
6. other architecture documents directly referenced;
7. applicable visual instructions and skills in `.claude/`.

No order should depend solely on conversation memory or a previous report.

## 0.2 Structural invariants

### Entities and CNPJ

- `clientes.cnpj` is the direct source of Cliente CNPJ.
- `fornecedores.cnpj` is the direct source of Fornecedor CNPJ.
- Cliente and Fornecedor remain independent.
- The same CNPJ can legitimately exist in both categories.
- It is forbidden to reintroduce:
  - `parceiros`;
  - `parceiro_id`;
  - `parceiro_cnpjs`;
  - mandatory generic business entity;
  - dual writing;
  - silent fallback;
  - parallel synchronization;
  - competing source of truth;
  - temporary layer that hides incorrect architecture.

### Pedido, OP, and documents

- Pedido and OP are real operational entities.
- Documento must link directly to the applicable canonical entities.
- No UI abstraction may hide an unnecessary intermediate entity.
- No opaque generic link should replace real relationships without approved architectural justification.

### Separation of concerns

The following must remain separate:

1. technical detection;
2. suggested classification;
3. technical evidence;
4. human validation;
5. link with Pedido/OP;
6. operational state;
7. administrative decision;
8. duplicity;
9. origin and authorship;
10. history and version.

A human decision must not erase the original technical evidence.

## 0.3 NF-e structural rule

The analysis must be guided by the direction and the relevant counterparty.

### Inbound NF

- issuer = expected Fornecedor;
- recipient = Ravatex's own CNPJ.

### Outbound NF

- issuer = Ravatex's own CNPJ;
- recipient = expected Cliente.

Do not require a Cliente/Fornecedor match on both sides of the note.

## 0.4 Visual gate

Before altering UI, modal, list, table, card, navigation, or interaction, the IAsup and the IAexec must consult:

- `.claude/`;
- applicable visual skills;
- UI instructions;
- existing components;
- modal, form, table, and navigation patterns;
- real Pedido and OP screens;
- visual acceptance references.

Preserve:

- already-consolidated visual language;
- corners with little curvature;
- absence of pills and heavy shadows without necessity;
- already-approved PT-BR terminology;
- consistency between Documentos, Pedido, and OP;
- canonical components and flows;
- responsiveness and accessibility;
- prohibition of simplified replicas that do not meet the actual requirement.

## 0.5 Role of the `.claude` folder

The `.claude` folder must be inventoried before the first relevant visual implementation.

Separate:

- operational skills;
- permanent visual instructions;
- local configurations;
- examples and references;
- machine-specific files;
- content that needs to be promoted to versioned documentation.

Rule:

- `.claude/skills` may teach agents to apply patterns;
- permanent product and UI rules must not exist only in `.claude`;
- a versioned visual contract must be created or consolidated, preferably:
  - `docs/architecture/UI_VISUAL_CONTRACT.md`.

## 0.6 Mandatory compliance gate

Every technical report must include:

### STRUCTURAL POLICY COMPLIANCE

- canonical files read;
- applicable invariants;
- how they were preserved;
- rejected proposals;
- conflicts found;
- decisions reserved for the architect.

Every UI phase must also include:

### VISUAL POLICY COMPLIANCE

- files and skills consulted;
- patterns reused;
- visual deviations;
- evidence of adherence;
- necessary visual validation.

Without these sections, the phase cannot be accepted.

---

# CAMADA 1 — DOCUMENTS

This is the active and priority front.

## 1.1 Objective of the first operational delivery

Enable the Documents section so that the system:

1. detects candidate files;
2. presents the technical suggestion;
3. allows human validation;
4. correctly links to Pedido and OP;
5. shows the document on the correct surfaces;
6. preserves history, authorship, and evidence;
7. works end-to-end in staging;
8. is published for the client to follow.

There will be no auto-acceptance in this first version.

---

## 1.2 Target flow

```text
Entrada do documento
→ detecção técnica
→ fila de validação
→ modal “Validar e vincular”
→ vínculos canônicos
→ exibição em Documentos / Pedido / OP
→ correção e auditoria
→ validação em staging
→ publicação para o cliente acompanhar
```

### Expected origins

- Gmail;
- internal manual upload;
- future Fornecedor upload;
- future external integrations.

Every entry must record origin and authorship.

---

## 1.3 Technical detection

Record, when applicable:

- format;
- file signature;
- probable type;
- NF-e structure;
- issuer and recipient CNPJ;
- validity of each CNPJ;
- probable direction;
- probable counterparty;
- possible Cliente/Fornecedor matches;
- MIME/extension conflict;
- duplicity;
- technical reasons for the suggestion.

Detection is a technical hypothesis, not an administrative decision.

---

## 1.4 Human validation queue

The central Documents section must allow:

- listing candidates;
- filtering pending items;
- opening the file;
- viewing evidence;
- viewing alerts;
- identifying duplicity;
- opening validation;
- consulting links;
- consulting history.

Expected visual states, without yet finalizing the schema:

- awaiting validation;
- validated;
- rejected;
- ignored;
- validation revoked;
- duplicity detected;
- technical conflict;
- registry unavailable;
- unknown document.

---

## 1.5 Modal “Validar e vincular”

The recommended primary action is:

```text
Validar e vincular
```

The modal must display:

### Technical evidence

- file name;
- origin;
- sender;
- date;
- format;
- suggested type;
- suggested direction;
- CNPJs;
- possible Cliente/Fornecedor;
- reasons for the suggestion;
- warnings;
- preview or access to the file.

### Human fields

- actual type;
- subtype, when applicable;
- direction;
- Cliente or Fornecedor;
- number/key/date, when applicable;
- Pedido;
- OP or OPs;
- note;
- reason for rejection or ignoring.

Fields must appear according to the selected type.

### Actions

- validate and link;
- reject;
- ignore;
- cancel;
- future correct or revoke.

---

## 1.6 Rules by type

### NF-e XML

Confirm:

- inbound or outbound;
- issuer;
- recipient;
- expected counterparty;
- Pedido;
- OPs;
- number/key/date, when extractable.

### NF in PDF

- type only probable;
- mandatory human confirmation;
- never auto-accept;
- counterparty and links confirmed manually.

### Romaneio

Confirm:

- Fornecedor;
- Pedido;
- OP;
- related stage or movement;
- date;
- note.

### Unknown document

Allow:

- choosing type;
- classifying manually;
- linking;
- rejecting;
- ignoring with justification.

### Duplicity

Show:

- canonical document;
- previous occurrence;
- existing links;
- option to keep the new occurrence;
- option to reuse links;
- option to treat as different with justification.

---

## 1.7 Prohibited effects in the modal

Validating a document must not automatically:

- receive material;
- complete a transfer;
- accept an OP;
- change production status;
- move inventory;
- complete a Pedido;
- generate financial records;
- replace a previous document.

These actions must remain explicit and separate.

---

## 1.8 Canonical links

First scope:

```text
Documento ↔ Pedido
Documento ↔ OP
```

Future, only when the process requires it:

```text
Documento ↔ recebimento
Documento ↔ transferência
Documento ↔ expedição
Documento ↔ ordem de compra
```

Avoid an opaque generic relationship `target_type/target_id` as an architectural shortcut.

---

## 1.9 Display surfaces

After validation, the document must appear in:

- central Documents screen;
- Pedido detail;
- OP detail;
- applicable timeline/history;
- searches and filters;
- future Fornecedor area.

All screens must consume the same canonical link.

---

## 1.10 Correction, revocation, and audit

Allow:

- correcting type;
- changing counterparty;
- changing Pedido;
- adding/removing OP;
- rejecting;
- ignoring;
- revoking validation;
- restoring;
- consulting versions;
- identifying actor and timestamp.

Never silently overwrite history.

---

# IMPLEMENTATION SEQUENCE — DOCUMENTS

## G28-P0 — Plan consolidation and gates

Objective:

- approve this plan;
- inventory `.claude`;
- consolidate the structural contract;
- consolidate the visual contract;
- record canonical sources;
- fix the G28-A diagnosis.

No code, migration, or UI.

## G28-B1 — Documentation domain contract

Define the pure types and the domain contract for:

- technical evidence;
- suggestion;
- direction and counterparty;
- human review;
- canonical decision;
- duplicity;
- links;
- cardinalities;
- correction/revocation;
- compatibility with existing structures.

### Mandatory mapping before any new persistence

The separation of domain axes (detection, evidence, review, linkage, decision)
**does not require independent tables**. Before proposing new persistence, G28-B1
must map:

- the existing `document_decisions`;
- the existing `documentos_operacionais`;
- current states;
- the possibility of extending the current canonical source;
- risk of double writing;
- risk of concurrent human decisions.

**Creating a parallel source for human validation is forbidden if the existing
canonical decision can correctly represent the flow.**

### Open decisions for G28-B1 (not decided in this documentation fix)

- Document ↔ OP cardinality;
- whether a document may or may not link multiple OPs;
- how `documentos_operacionais` represents this;
- which types require Pedido;
- which types require OP;
- which links are optional;
- how to handle a link incompatible with the type.

No persistence, no runtime, and no UI in this phase.

## G28-B2 — Local persistence of evidence and technical history

Locally persist (e.g., SQLite) the technical evidence and the technical history,
without inventing legacy data and without anticipating the human decision:

- technical evidence;
- reasons;
- origin;
- authorship;
- version;
- duplicity relation;
- technical history.

## G28-B3 — Events, export, Supabase, and reader

Propagate:

```text
persistência local
→ eventos/outbox
→ JSONL
→ exportPackage
→ writer
→ Supabase
→ reader do Controle
```

Migration only additive and validated first in staging.

## G28-B4 — Documentation review queue / read model

Implement the read model and the review queue:

- listing;
- filters;
- alerts;
- file access;
- link indication;
- duplicity indication;
- indication that a validation action is available.

No human decision persistence in this phase.

## G28-B5 — Persistence of the human decision and canonical links

Persist the **human decision** and the **canonical links with Pedido/OP**,
reusing the existing canonical source whenever it correctly represents the flow
(see the mandatory mapping in G28-B1). No functional UI in this phase.

## G28-B6 — Functional "Validate and link" modal

Implement the dynamic modal and the action contracts **consuming the real
backend** for decisions and links.

**The functional modal cannot precede the persistence of the decision and the
links (G28-B5).**

## G28-B7 — Display on surfaces

Display on:

- Documentos;
- Pedido;
- OP;
- timeline;
- searches.

## G28-B8 — Correction, revocation, restoration, and audit

Implement:

- reclassification;
- link changes;
- revocation;
- restoration;
- history;
- authorship.

## G28-C — Real validation in staging

Minimum scenarios:

- NF entrada;
- NF saída;
- XML;
- PDF;
- romaneio;
- unknown;
- duplicity;
- MIME/extension conflict;
- invalid CNPJ;
- registry unavailable;
- Cliente/Fornecedor not found;
- Pedido;
- OP;
- correction;
- revocation.

## G28-D — Publication for the client to follow

Criteria:

- functional identification;
- human validation;
- correct links;
- display on the screens;
- correction and audit;
- validated staging;
- green CI;
- no implicit operational effect.

Milestone:

```text
DOCUMENTOS — CLIENT OBSERVATION RELEASE
```

After publication:

- observe real usage;
- fix friction points;
- measure false positives;
- adjust the modal;
- validate where users look for documents.

---

# CAMADA 2 — USER AND ACCESS ADMINISTRATION

Future initiative, deferred until Documentos stabilizes.

## Objectives

- list users;
- create or invite;
- define profile;
- define permissions;
- enable/block access;
- reset password;
- require password change;
- check last access;
- revoke sessions, if supported;
- audit changes;
- in the future, link external user directly to Fornecedor.

## Password policy

Avoid a shared default password.

Prefer:

- temporary password with mandatory change; or
- invitation to set the first password.

The temporary password must:

- expire;
- be single-use;
- not be recoverable;
- not be reused across users.

## Future sequence

```text
A1 — diagnóstico da autenticação
A2 — papéis e permissões
A3 — administração de usuários
A4 — convite/senha inicial
A5 — reset, bloqueio e reativação
A6 — auditoria
A7 — preparação para usuários externos
```

---

# CAMADA 3 — CLOUD BACKUP

Future and independent initiative.

There is another app with reusable infrastructure and frontend, but the adaptation requires an audit because the source app uses SQLite and this application has a different persistence architecture.

## Mandatory diagnosis

Map:

- what is copied;
- data origin;
- destination;
- encryption;
- retention;
- versioning;
- scheduling;
- logs;
- checksums;
- restoration;
- failure handling;
- permissions.

## Backup section

Display:

- last backup;
- next backup;
- size;
- destination;
- retention;
- history;
- failures;
- manual backup;
- integrity;
- controlled restoration.

## Rule

A backup without a tested restoration is not considered reliable.

Minimum flow:

```text
backup
→ armazenamento
→ checksum
→ retenção
→ teste de restauração
→ auditoria
```

## Future sequence

```text
BK1 — auditoria do app existente
BK2 — mapeamento para Ravatex
BK3 — contrato de backup
BK4 — backend
BK5 — adaptação do frontend
BK6 — retenção e histórico
BK7 — restauração controlada
BK8 — teste real de recuperação
```

---

# CAMADA 4 — FUTURE FORNECEDOR PARTICIPATION

The internal application must remain functional without active participation from the fornecedor.

## Principle

External user must link directly to `fornecedor_id`.

Do not create a generic partner.

## Evolution

### F0 — structural preparation

Anticipate:

- origin;
- authorship;
- direct fornecedor;
- future permissions;
- submission history.

### F1 — read-only portal

Fornecedor can:

- view its OPs;
- view authorized documents;
- view pending items;
- track applicable transfers/receipts;
- download allowed documents.

### F2 — document upload

Fornecedor can submit:

- NF;
- romaneio;
- receipt;
- report;
- other authorized types.

Every upload enters the same human queue.

### F3 — responses and corrections

Fornecedor can:

- respond to a pending item;
- replace file;
- correct metadata;
- receive rejection;
- resend.

### F4 — controlled operational participation

In the future:

- report shipment;
- confirm expedição;
- propose transfer;
- report quantity;
- report forecast;
- attach movement document.

Initially, every critical action requires internal acceptance.

### F5 — expanded collaboration

- notifications;
- comments;
- SLA;
- discrepancies;
- bilateral acceptance;
- communication history;
- API.

---

# PRIORITIZED BACKLOG
## P0 — mandatory before new implementation

- [ ] Approve this plan.
- [ ] Formally correct the architecture proposed in G28-A.
- [ ] Inventory `.claude`.
- [ ] Create/consolidate a versioned visual contract.
- [ ] Make the structural and visual gates mandatory.
- [ ] Confirm the NF rule by direction and counterparty.
- [ ] Separate qualification, review, duplicity, linkage, and decision.

## P1 — documents, main delivery

- [ ] Domain contract.
- [ ] Local persistence.
- [ ] History.
- [ ] Events/export.
- [ ] Supabase.
- [ ] Reader.
- [ ] Documents queue.
- [ ] "Validate and link" modal.
- [ ] Pedido/OP links.
- [ ] Display on surfaces.
- [ ] Correction/revocation.
- [ ] Real staging.
- [ ] Publication for client tracking.

## P2 — post-publication stabilization

- [ ] Observe real usage.
- [ ] Adjust false positives.
- [ ] Adjust UX.
- [ ] Improve filters.
- [ ] Improve history.
- [ ] Handle legacy documents.
- [ ] Refine duplicity handling.

## P3 — administration

- [ ] Users.
- [ ] Roles.
- [ ] Permissions.
- [ ] Initial password.
- [ ] Reset.
- [ ] Blocking.
- [ ] Audit.

## P4 — backup

- [ ] Audit existing app.
- [ ] Adapt backend.
- [ ] Adapt frontend.
- [ ] Scheduling.
- [ ] Retention.
- [ ] Integrity.
- [ ] Tested restoration.

## P5 — Fornecedor

- [ ] Read-only portal.
- [ ] OPs.
- [ ] Documents.
- [ ] Pending items.
- [ ] Upload.
- [ ] Corrections.
- [ ] Transfers.
- [ ] Controlled operational participation.

---

# EXPLICITLY DEFERRED ITEMS

- automatic acceptance of documents;
- automatic movement by document;
- Fornecedor portal;
- external upload;
- direct operational change by Fornecedor;
- full user administration;
- cloud backup;
- restoration;
- correction of the eight historical TypeScript errors;
- npm vulnerabilities;
- worktree cleanup;
- orphan metadata;
- remote manifest accumulation.

These items must have their own phases.

---

# HARD STOPS

Stop and return to the architect if:

- a proposal contradicts a canonical source;
- an intermediate entity emerges;
- there is double writing or fallback;
- it becomes necessary to mix validation with movement;
- the UI hides incorrect architecture;
- a migration precedes an approved contract;
- Fornecedor becomes a dependency of the internal flow;
- automatic acceptance is introduced;
- access, backup, or portal contaminate the active document chain;
- `.claude` or the visual contract are not consulted during a UI phase;
- there is a conflict between canonical documents.

---

# PERMANENT TRACKING AND PHASE MATRIX

> **IAexec documentation record — phase `G28-P0`.** This section was added
> during the governance record (`G28-P0`). It does not replace any IAlead
> decision: it merely materializes the permanent tracking and the update
> governance required to follow the phases. The original architectural
> content above remains unchanged.

## Allowed states

`PLANNED` · `DIAGNOSED` · `DECIDED` · `IMPLEMENTED` · `TESTED` · `ACCEPTED` ·
`DEFERRED` · `AUTHORIZED` · `IN_PROGRESS` · `HOLD` · `TECHNICALLY_ACCEPTED` ·
`PUBLISHED` · `BLOCKED` · `REJECTED` · `CLOSED` · `SUPERSEDED` · `NOT_STARTED`.

Accepted phases must explicitly display the separate labels that apply
(`DIAGNOSED / DECIDED / IMPLEMENTED / TESTED / ACCEPTED`), not just `CLOSED`.
Planned phases that have not started must display `PLANNED / NOT DIAGNOSED / NOT DECIDED
/ NOT IMPLEMENTED / NOT ACCEPTED` when relevant, not a plain `PLANNED`.
Compound qualifiers may detail a base state — for example
`REJECTED AS CONTRACT / RETAINED AS DIAGNOSTIC INPUT` and `PLANNED / NOT AUTHORIZED`.

## Phase matrix

| ID | Phase | Status dimension labels | Dependencies | Branch / workspace | Commit / HEAD | Evidence | Next step |
|---|---|---|---|---|---|---|---|
| G28-P0 | Plan consolidation, asset map and gates | `PLANNED / IMPLEMENTED / ACCEPTED` | G27 CLOSED/published | `work/g28-document-qualification` @ `controle-tapetes-g28` | Per G28 ledger | Documentation phase completed; G28-P0-R1 reconciled | — |
| G28-A | Documentation schema/domain diagnosis | `PLANNED / DIAGNOSED / REJECTED AS CONTRACT / RETAINED AS DIAGNOSTIC INPUT` | G28-P0 | — | — | Schema, `db/49`, `qualified`, `duplicate` not approved; usable evidence | Diagnostic input for G28-B1 |
| G28-B1 | Documentation domain contract | `PLANNED / DIAGNOSED / DECIDED / IMPLEMENTED / TESTED / ACCEPTED` | G28-P0 | `work/g28-document-qualification` @ `controle-tapetes-g28` | `c65fa41` | Pure domain contract for evidence, suggestion, review, and human decision; tests 187/187 | — |
| G28-B2 | Local persistence of technical evidence and history | `PLANNED / DIAGNOSED / DECIDED / IMPLEMENTED / TESTED / ACCEPTED` | G28-B1 | `work/g28-document-qualification` @ `controle-tapetes-g28` | Per G28 ledger | Technical evidence persisted locally; versioned history; final tests 299/299 | — |
| G28-B3 | Events, export, Supabase, and reader | `PLANNED / DIAGNOSED / DECIDED / IMPLEMENTED / TESTED / ACCEPTED` (accepted subphases; see subphases below) | G28-B2 | `work/g28-document-qualification` @ `controle-tapetes-g28` | Per G28 ledger | B3-B1 through B3-B4, B3-B5-A, B3-B5-B, B3-B5-C, B3-B6-B accepted; migration 49 applied and verified in staging | — |
| G28-B4 | Documentation review queue / read model | `PLANNED / DIAGNOSED / DECIDED / IMPLEMENTED / TESTED / ACCEPTED` | G28-B3 | `work/g28-document-qualification` @ `controle-tapetes-g28` | Per G28 ledger | Subphases B4-A through B4-B4 accepted; queue read model, filters, state indicators, and file access implemented | — |
| G28-B5 | Persistence of the human decision and the canonical Pedido/OP links | `PLANNED / DIAGNOSED / DECIDED / IMPLEMENTED / TESTED / ACCEPTED` (B5-D5 consolidated: B1–B5) | G28-B4 | `work/g28-document-qualification` @ `controle-tapetes-g28` | `7d3e0261b668a46a80208198352039dc1f352010` | Canonical decision-command, explicit source boundary, removal of statusOverrides and legacy runtime RPC accepted; canonical linking not implemented | — |
| G28-B6 | Canonical Documento↔Pedido/OP links + "Validate and link" modal | `DECIDED / IMPLEMENTED / TESTED / STAGING FUNCTIONALLY VERIFIED / ACCEPTED_WITH_NONBLOCKING_TEST_DEBT` | G28-B5 | `work/g28-document-qualification` @ `controle-tapetes-g28` | technical `b2f180ed0e6f1c2ee6c02881d0199d1bfaf29366`; staging closeout `b130db44d32718ddf6d3e2bffb1439dac3a1948f` | staging `ucrjtfswnfdlxwtmxnoo`: RPC matrix 20/20, dual ownership and wrapper rollback proven; authenticated modal blocked by tooling; no fix required | Accepted 2026-07-14; G28-B7 authorized |
| G28-B7 | Display on surfaces (Documentos/Pedido/OP/timeline/search) | `CLOSED / ACCEPTED_WITH_NONBLOCKING_REMOTE_SMOKE_DEBT` | G28-B6 | `work/g28-document-qualification` @ `controle-tapetes-g28` | partial `ed35f049397af4061ed6e8bb2d9ec3056c543724`; completion `9ef61e1896af631bc5aeeced4af93c77051f4de4` | canonical read model + Pedido/OP/timeline/search surfaces; non-blocking debt: authenticated B7 smoke in staging | Accepted 2026-07-14; G28-B8 authorized |
| G28-B8 | Correction, revocation, restoration, and audit | `TECHNICALLY COMPLETED / ACCEPTANCE SUBSUMED BY G28-C` | G28-B7 | `work/g28-document-qualification` @ `controle-tapetes-g28` | technical commit `f985f8b857f83d977936eae47ea830a5cb6ba4c3` | `db/52` applied and verified in staging (`ucrjtfswnfdlxwtmxnoo`, registry `20260715024449`); RPC matrix 18/18; B4–B8 battery 831/831. The correction, revocation, restoration, and audit capabilities were explicitly validated and accepted in the G28-C staging/projections matrix (16/16 PASS). B8 is not pending; its acceptance was subsumed by the G28-C architectural gate and acceptance. | — (subsumed by G28-C) |
| G28-C | Real validation in staging | `CLOSED / ACCEPTED_WITH_NONBLOCKING_AUTHENTICATED_BROWSER_SMOKE_DEBT` | G28-B8 | `work/g28-document-qualification` @ `controle-tapetes-g28` | closeout `a7d7caa8984e56b44c0302bff5d578a8be5ff536`; acceptance `d5ec09f803c2c64697ee3605b7d4ecfee168a66a` | staging/projections matrix 16/16 PASS; zero material defects; no change to product, schema, RPC, migration, or architecture. Non-blocking debt: `AUTHENTICATED_BROWSER_SMOKE_BLOCKED_BY_TOOLING`. | — |
| G28-D | Publication for client tracking | `RELEASE CONTRACT DISCOVERY COMPLETE / DEFERRED BY ARCHITECT UNTIL GLOBAL BACKLOG COMPLETION` (publication: `NOT STARTED / NOT ACCEPTED / NOT AUTHORIZED`) | G28-C | `work/g28-document-qualification` @ `controle-tapetes-g28` | discovery/preparation commit `b27e79fdba1ed8fb8a6232d8e0b8ca4b37ac3a2c` | contractual discovery completed and recorded in `docs/releases/G28_D_RELEASE_CANDIDATE.md` (evidence preserved, not rewritten). By explicit architect decision (`STAGING-ONLY-EXECUTION-BOUNDARY-A`, 2026-07-15), the publication/production mapping and the production migrations 51/52 procedure are postponed until completion of the full canonical backlog — this is not a current blocker for staging work. Publication, push, production, tag, and release not authorized. | Resume defining the publication/production contract only after completion of the full canonical backlog (architect decision already recorded as a deferral, not a blocker) |
| CAMADA 2 (A1–A7) | User and access administration | DEFERRED | Documents stabilized | — | — | — | Only after Camada 1 is published |
| CAMADA 3 (BK1–BK8) | Cloud backup and tested restoration | DEFERRED | Independent front | — | — | — | Audit of the source app |
| CAMADA 4 (F0–F5) | Future Fornecedor participation | DEFERRED | Documents published | — | — | — | Internal operation never depends on the Fornecedor |

### G28-B3 — Subphase progress

The G28-B3 subphases that were accepted are listed below. The `G28-B3`
block is considered complete in its accepted subphases; the aggregate status is in
the matrix above.

| Subphase | Description | State | Commit(s) |
|---|---|---|---|
| G28-B3-B1 | Technical evidence export contract | `CLOSED / ACCEPTED` | `b794bb7` |
| G28-B3-B2 | Export of current evidence as JSONL | `CLOSED / ACCEPTED` | `812433d` |
| G28-B3-B3 | Remote schema and RPC (`db/49_document_technical_evidences.sql`) | `CLOSED / ACCEPTED` | `7abafbb` |
| G28-B3-B4 | Service-role writer over the RPC, with error-classification hardening | `CLOSED / ACCEPTED` | `abe49f1`; `96f2d4d` (R1) |
| G28-B3-B5-A | Technical evidence sync integration diagnosis | `CLOSED / ACCEPTED` — read-only | — |
| G28-B3-B5-B | JSONL input contract and local dry-run | `CLOSED / ACCEPTED` | `013a0e1` |
| G28-B3-B5-C | Complete technical evidence sync integration | `CLOSED / ACCEPTED` | `3465405` |
| G28-B3-B6-B | Current technical evidence admin reader | `CLOSED / ACCEPTED` | `6ade74f` |

Migration 49: applied and verified in staging `ucrjtfswnfdlxwtmxnoo` (per
G28 ledger). Push: `NOT EXECUTED`. Production `bhgifjrfagkzubpyqpew`: not accessed.
The reader (B3-B6-B) loads current technical evidence via direct authenticated
admin RLS, without a second Supabase client and without writes.

## Update governance (permanent rule)

- a phase may be recorded as `AUTHORIZED`, `IN_PROGRESS`, `HOLD`, or
  `BLOCKED` during its execution;
- definitive decisions, final evidence, accepted HEADs, and closure are only entered
  after the applicable technical/architectural acceptance;
- IAexec **does not** declare its own work `CLOSED`;
- `PROJECT_STATE.md` records the current state (phase, HEAD, publication, environment);
- this plan records the sequence and the decisions;
- `AGENT_HANDOFF.md` records operational continuity.

Recording the state during execution does not anticipate acceptance: closure
(`CLOSED`) and publication (`PUBLISHED`) depend on the applicable review.

---

# PLAN CLOSURE CRITERION

This plan was reconciled on 2026-07-14 (G28-PLAN-R1) and updated on
2026-07-15 (`STAGING-ONLY-EXECUTION-BOUNDARY-A`). There is no architect decision
currently open for the staging cycle: `DEPLOYMENT_MAPPING_AND_
PRODUCTION_MIGRATION_PROCEDURE`, previously recorded as the only open decision,
was explicitly reclassified by the architect as `DEFERRED UNTIL
GLOBAL BACKLOG COMPLETION / NOT A CURRENT STAGING BLOCKER / NOT STARTED` —
not discovered, defined, tested, or completed, merely postponed until the
full canonical backlog is reconciled. See the header of this plan and
`PROJECT_STATE.md`. The historical decisions on Documento↔Pedido cardinality,
Documento↔OP, per-type links, and compatibility were resolved in the accepted
phases G28-B1 through G28-B8 and G28-C, and are no longer open.
The plan will be considered fully closed when:

- the architect closes the open publication/production decision;
- the backlog is ordered and reconciled with the operational state;
- no future item has been confused with active scope;
- there is no contradiction with `PEDIDO_OP_MOVIMENTACAO_DOCUMENTOS_PLANO.md`.

---

# NEXT ACTION — CURRENT STATE

**G28-P0-R1, G28-B1, G28-B2, G28-B3 (accepted subphases), G28-B4, G28-B5-D5, G28-B6,
G28-B7, and G28-C have been accepted** (G28-C on 2026-07-15, `CLOSED / ACCEPTED_WITH_NONBLOCKING_AUTHENTICATED_BROWSER_SMOKE_DEBT`;
closeout `a7d7caa`, acceptance `d5ec09f`). **G28-B8 is `TECHNICALLY COMPLETED / ACCEPTANCE SUBSUMED BY G28-C`:**
its correction, revocation, restoration, and audit capabilities were explicitly
validated in the G28-C staging/projections matrix (16/16 PASS) and accepted in C's
architectural gate. B8 has no independent acceptance. **No functional phase is active.** The current action is this
documentation reconciliation (`G28-STATE-RECONCILIATION-R1`). After this
reconciliation closes, a new read-only reconciliation of the general backlog (`PEDIDO_PRODUCTION_FLOW_BACKLOG.md`
and other fronts) will choose the next functional front. **Publication is not the next
action and no automatic implementation follows.** The read-only reconciliation of the
general backlog and the documentation backfill `DOCS-CANONICAL-CONSISTENCY-BACKFILL-A` have already
been completed (2026-07-15). By explicit architect decision
(`STAGING-ONLY-EXECUTION-BOUNDARY-A`, 2026-07-15): `OPEN_ARCHITECT_DECISIONS: NONE`
for the current staging cycle; `DEPLOYMENT_MAPPING_AND_PRODUCTION_MIGRATION_PROCEDURE`
is `DEFERRED UNTIL GLOBAL BACKLOG COMPLETION / NOT A CURRENT STAGING BLOCKER`.
`CLIENTE-ORDER-SUMMARY-READMODEL-ACL-GRANTS-R1` was authorized, implemented,
applied, and verified in staging on 2026-07-15 (`CLOSED / ACCEPTED`; see
`D-COS07` §6.2). There is no single subsequent technical candidate:
`NEXT_AUTHORIZABLE_ACTION: NONE`; `ARCHITECT DECISION REQUIRED AFTER BACKLOG
RECONCILIATION`.

Accepted phases: G28-P0, G28-A (rejected as contract / retained as diagnostic input), G28-B1, G28-B2,
G28-B3 (accepted subphases), G28-B4, G28-B5-D5, G28-B6, G28-B7, G28-B8 (subsumed by C), G28-C.
G28-D discovery: `COMPLETED` (evidence preserved in `docs/releases/G28_D_RELEASE_CANDIDATE.md`, not
rewritten). G28-D publication: `DEFERRED BY ARCHITECT / NOT A CURRENT BLOCKER / NOT AUTHORIZED`.
Later phases: `DEFERRED / NOT AUTHORIZED`.

Current operational state: `PROJECT_STATE.md`.
Continuity: `AGENT_HANDOFF.md`.
Closeout history: `docs/ledgers/G28_LEDGER.md`.
Architecture/backlog: this master plan.
