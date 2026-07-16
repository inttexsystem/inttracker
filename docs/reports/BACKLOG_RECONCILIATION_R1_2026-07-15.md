# BACKLOG-RECONCILIATION-READONLY-R1 — REPORT

> **Date:** 2026-07-15
> **Type:** Read-only diagnostic. No file changes in this phase.
> **Classification:** Diagnostic/report — not normative by itself, does not alter state.
> The architect's decisions made based on this report are recorded in
> `PROJECT_STATE.md` (section `G28-RECONCILIATION-DECISIONS-A`) and in
> `docs/ledgers/G28_LEDGER.md` (corresponding append-only entry). This
> document preserves the original report, verbatim, as historical evidence.

**Phase:** read-only diagnostic. **File changes:** none. **Final state:** clean worktree, empty staging, `staging/work/g28-document-qualification...HEAD = 0 0`. **Access:** read-only local Git + repo only; **Supabase/MCP not accessed**; **production `bhgifjrfagkzubpyqpew` not accessed**; no push in this order (the backup push was the previous order, already completed). **HEAD:** `06b5683`.

---

## STRUCTURAL POLICY COMPLIANCE (§0.6 gate of the master plan)

- **Canonical documents read (9/9 + closeout):** `docs/architecture/PEDIDO_OP_MOVIMENTACAO_DOCUMENTOS_PLANO.md`, `docs/architecture/PEDIDO_PRODUCTION_FLOW_BACKLOG.md` (1,408L, both pages), `docs/architecture/DOCUMENTOS_VALIDACAO_VINCULOS_E_EVOLUCAO_PLANO.md`, `docs/architecture/PEDIDO_OP_SCHEMA_CONTRACT.md`, `PROJECT_STATE.md`, `AGENT_HANDOFF.md`, `docs/ledgers/G28_LEDGER.md`, `docs/DOCUMENTATION_INDEX.md`, `docs/governance/DOCUMENTATION_MODEL.md`; closeout `docs/handoffs/CHATGPT_CLOSEOUT_2026-07-15.md`.
- **Invariants preserved:** no write proposals; no intermediate entity introduced; no documentary correction applied (read-only).
- **Conflicts between canonical documents:** **no material conflict** found (detail in §6 and in the HARD STOP gate at the end). One **non-material** textual inconsistency (db/37 "gap" note) was verified as **already resolved**.
- **Decisions reserved for the architect:** all classifications below are **PROPOSED**, not applied.

---

## 1. CAMADA 2 — User administration (inventory in real code vs. full scope)

Full canonical scope = A1–A7 + password policy (master plan L688–728). Inventory verified in the code:

| Capability (full scope) | Exists? | Evidence in real code |
|---|---|---|
| List users | ✅ | `js/screens/cadastros.js:2247` `reload()`/`renderStandalone`; search + "Mostrar inativos" |
| Create user | ✅ (partial) | `js/screens/cadastros.js:2667` → Edge `admin-create-user`; admin manually types a **temporary password** |
| **Invite** (invite/magic link) | ❌ | Zero matches for `inviteUserByEmail`/`generateLink` across all `js`/`ts` |
| Edit profile/link | ✅ | `js/screens/cadastros.js:2645` PostgREST `.update()` (no password field) |
| Define **permissions** | ⚠️ partial | Role = **single string** `usuarios.tipo ∈ {admin,fornecedor,cliente}` (`db/14_cliente_perfil_schema.sql:66`); **no permissions table, no capability matrix**; enforcement = `roles:[…]` per route + RLS `is_admin()/meu_fornecedor_id()/meu_cliente_id()` |
| Enable/**block** access | ✅ | Edge `admin-disable-user` (soft-delete `ativo=false` + Auth ban `876000h`); self/last-admin guards |
| **Reactivation** | ⚠️ not confirmed | There is no reactivation Edge function; only the "inativos" toggle + editing — reactivation flow not evidenced |
| **Reset password** | ❌ | None of `resetPasswordForEmail`/`updateUser({password})`; "Esqueceu a senha?" is a **stub** (`js/screens/system-screens.js:131` toast "Recuperação de senha ainda não configurada.") |
| **Require password change** | ❌ | Absent |
| Check last access | ❌ | Absent |
| Revoke sessions | ⚠️ | Only via disable's ban; no explicit revocation |
| **Audit changes** | ⚠️ partial | Only `desativado_em/por/motivo` (`db/12_auth_user_disable_schema.sql:38-42`) — **deactivation only**; nothing for create/edit/hard-delete |
| Password policy | ⚠️ minimal | Only **minimum 6 chars** (`supabase/functions/admin-create-user/index.ts:36`); **no** expiration/single-use/non-reuse/mandatory change |
| External user → Supplier/Client | ✅ | `usuarios.fornecedor_id`/`cliente_id`; client portal built (`#/cliente/*`) |
| Delete (hard) | ✅ | Edge `admin-delete-user` (confirms target email; self/last-admin guards) |

**PROPOSED CLASSIFICATION (not applied):**
> `G28-CAMADA-2 = PRE-EXISTING PARTIAL CAPABILITY (A3 administration + part of A5 blocking + A7 external preparation) / FULL A1–A7 SCOPE NOT IMPLEMENTED (password reset/recovery, invites, role/permission matrix, create/edit/delete audit, full password policy, reactivation) / NOT ACCEPTED AS A DEDICATED PHASE / DEFERRED per master plan.`

The existing capability is a **byproduct** of the AUTH-DISABLE-USER and Client Portal workstreams — **not** of a Camada-2 A1–A7 phase (which the master plan marks `DEFERRED`, L1025).

---

## 2. CAMADA 3 — Backup/restoration (does an implementation exist?)

**No in-app implementation exists.** Total convergence of the three sources:
- **Code:** no data backup/restore/dump/export, no UI, no Edge function, no scheduling. Sole artifact = **manual runbook** `docs/BACKUP_AND_RESTORE.md` (operator runs `pg_dump`/`psql` by hand; Supabase Free tier, no PITR/managed backup). The "restore"/"export" hits belong to unrelated features (document-link revision restoration `db/52`; Ingestor event export).
- **Canonical:** master plan L732–796 "CAMADA 3 — BACKUP EM NUVEM", "Frente futura e independente", BK1–BK8 sequence; matrix L1026 = `DEFERRED`.
- **Closeout:** L35 "A Camada 3 de backup e restauração não está implementada nem aceita."

**PROPOSED CLASSIFICATION:** `G28-CAMADA-3 = NOT IMPLEMENTED / DEFERRED / only a manual runbook documented.`

---

## 3. Worktree audit (`git worktree list`)

| Worktree | Branch/HEAD | Dirty state | vs. origin/main | vs. upstream | Apparent purpose |
|---|---|---|---|---|---|
| `controle-tapetes-g28` | `work/g28-document-qualification` @ `06b5683` | **clean** | +555 | (no local upstream; = staging, `0 0`) | **Active workstream** G28; now with remote backup |
| `controle-tapetes` | `work/app-next` @ `26111e0` | ⚠️ **DIRTY** | +456 | **11 behind** `staging/work/app-next` | app-next line; **divergent + uncommitted** |
| `controle-tapetes-g27` | `work/g27-document-recognition-safety` @ `247345c` | clean | +467 | (no remote) | G27 (document-recognition-safety); ancestor of g28 → **already incorporated** |
| `controle-tapetes-controlled-delete-gate` | **detached** @ `2a492f0` | clean | +232 | (`staging/HEAD~70`) | Controlled-delete gate stopped at an old ancestor (2026-07-06) |

**Signals:**
- **`app-next` divergent (confirms closeout L59):** 11 commits behind the remote **AND** dirty worktree — `MM PROJECT_STATE.md`, `MM AGENT_HANDOFF.md`, deleted workflow, `?? docs/architecture/DOCUMENTOS_VALIDACAO_VINCULOS_E_EVOLUCAO_PLANO.md` untracked, changes in `documents-ingestor`. Real point of risk.
- **Detached (`controlled-delete-gate`)** stopped at `2a492f0` (common merge-base of all branches, `staging/HEAD~70`) — orphaned worktree with a completed purpose.
- `g27` and the detached one have no remote copy; `g28` now does (backup from this session).
- The master plan already lists **"limpeza de worktrees"** among the `ITENS EXPLICITAMENTE DIFERIDOS` (L963).

---

## 4. Factual evidence of the Documents section validation (WITHOUT classifying acceptance)

Using the separate labels required (governance §17.4). **I do not classify acceptance — architect's decision.**

| Dimension | Factual evidence |
|---|---|
| DIAGNOSED | ✅ G28-A/B1 (domain contract) |
| DECIDED | ✅ B1–B8 decisions recorded in the ledger |
| IMPLEMENTED | ✅ complete pipeline (Ingestor + queue + modal + surfaces + correction/revocation/restoration/audit) |
| TESTED (local) | ✅ extensive batteries: B4–B8 **831/831**; controlled-delete **53/53**; ACL grants **21/21**; multiple green smokes |
| STAGING FUNCTIONALLY VERIFIED (RPC-level) | ✅ `db/51` RPC matrix **20/20**; `db/52` matrix **18/18** (registry `20260715024449`); G28-C staging/projections matrix **16/16**; synthetic fixtures, zero cleanup |
| **BROWSER (authenticated)** | ❌ **NEVER EXECUTED** — `AUTHENTICATED_BROWSER_SMOKE_BLOCKED_BY_TOOLING` / `LIVE_B8_MODAL_SMOKE_BLOCKED_BY_TOOLING`, recurring in B6/B7/B8/C/D and Client Portal (no app/admin session in the browser) |
| ACCEPTED (recorded) | Canon records G28-C `CLOSED / ACCEPTED_WITH_NONBLOCKING_AUTHENTICATED_BROWSER_SMOKE_DEBT` as an **explicit architectural decision** (closeout `a7d7caa`, acceptance `d5ec09f`); B8 subsumed by C |
| MANUAL VALIDATION BY THE ARCHITECT | **No recorded evidence** of functional/personal validation of the Documents section by the architect (closeout L36, L53) |

**Relevant factual asymmetry:** the **Pedido/OP/Admin** flow received **real-browser visual validation** against staging (§9.6/§9.7 audit from 2026-07-05: Pedidos #13/#14/#20/#21, hub crash reopened and fixed in R2). The **G28 Documents section did not** — its validation stopped at the RPC matrix + local tests level. Two distinct patterns of "validated" coexist in the repo.

---

## 5. Remaining backlog — single table

| Workstream / item | Canonical status | Estimated scope | Risk | Dependencies | Fits staging-only? |
|---|---|---|---|---|---|
| **G28-CAMADA-2** (users) | DEFERRED; partial capability exists | High (A1,A2,A4,A5,A6 + password policy) | Medium (security/auth) | Documents stabilized; ref. SGAA | **Partial** (schema/RPC yes; Edge deploy yes; but touches Auth) |
| **G28-CAMADA-3** (backup) | DEFERRED; nothing implemented | High (BK1–BK8) | Medium | Independent workstream; source-app audit | **Partial** (staging can; real restoration testing is sensitive) |
| **G28-CAMADA-4** (suppliers) | DEFERRED | High (F0–F5) | Medium | Documents published | Yes (staging) |
| **G28-D** publication | DEFERRED BY ARCHITECT / NOT AUTHORIZED | Medium | High (production/deploy) | Complete canonical backlog | **No** (requires production/provider) |
| **DEPLOYMENT_MAPPING_&_PROD_MIGRATION** | DEFERRED UNTIL GLOBAL BACKLOG COMPLETION | Medium-high | High | Architect decision | **No** (production) |
| **DELETE-PROD-GUARD-A** | Future P1 / not started | Medium (admin password, soft-delete, audit) | High (destructive in prod) | Authorization + production | **No** (production readiness) |
| **DELETE-AUDIT-LOG-A** | Future P2 / not started | Low-medium (auditable trail) | Low | DELETE-PROD-GUARD-A | Yes (staging) |
| **Fase J** (balance per stage) | FUTURE / UNSEQUENCED / NOT AUTHORIZED | High (transactional RPC/trigger) | High | Fase F, item traceability | Yes (staging) |
| **Production application of the staging-only stack** (db/12,21,30,49–57) | Postponed by STAGING-ONLY-BOUNDARY | Medium | High | Architect decision | **No** |
| **DB30_NOT_RECORDED_IN_MIGRATION_HISTORY** | Open debt (no drift) | Low | Low | — | Yes |
| **AUTHENTICATED_BROWSER_SMOKE** (G28-C/D/B7/Portal) | Open non-blocking debt | Low (tooling/session) | Low-medium | Admin session in the browser | Yes |
| **Historical orphan OPs** (11 OPs with `lote.pedido_id` NULL; 9 lotes without Pedido) | Only diagnosed; `ORPHAN-OP-DATA-TRIAGE-R1` **canceled/never authorized** | Medium (backfill/product decision) | Medium | Product decision | Yes (staging) |
| **Worktree cleanup** (app-next divergent/dirty; orphaned detached) | DEFERRED (plan L963) | Low | Low-medium (local loss) | — | Yes (local/git) |
| **Deferred technical debts** (8 historical TS errors, npm vulnerabilities, orphaned metadata, remote manifest accumulation) | DEFERRED (plan L960–964) | Varied | Low | Own phases | Yes |

> **Note (memory vs. canon):** the item "OP numbering reuse" (soft-delete vs. monotonic sequence) that appears in memory from previous sessions **does not** appear as an open canonical backlog item — the canon fixes `op_numeros` as a non-recycled high-water mark. Flagged as a possible latent decision, **not** confirmed as an open workstream.

---

## 6. DIVERGENCES (canonical documents × real code × ChatGPT closeout) — with evidence

| # | Divergence | Sources | Verdict |
|---|---|---|---|
| **D1** | Camada 2 classified as "implementação aceita/concluída" | Closeout L13,47–48 attributes this to the ChatGPT report **PROJECT-CONTROL-BASELINE-R1**; canon (plan L1025; `PROJECT_STATE.md:164`,185,200) = `DEFERRED`; code = partial | **Canon + code AGREE with the closeout**: Camada 2 is not complete. `PROJECT-CONTROL-BASELINE-R1` appears **only in the closeout**, never in the canon → its mis-classification **was never adopted** as authority. The divergence is ChatGPT-R1 × (canon+code), already flagged by the closeout itself. **Not a defect of the canon.** |
| **D2** | Canon does not distinguish "already-existing partial capability" from "pending full scope" in Camada 2 | Closeout L25,49–51; code shows substantial capability (user CRUD, disable, role-as-string, client/supplier link) that the canon labels only as a single `DEFERRED` line | **Real documentation divergence** between the master plan's "DEFERRED/future" framing and the code, which already implements A3 + part of A5/A7. The AUTH capability exists, documented in `docs/DOCUMENTATION_INDEX.md` §4 and runbooks, but **not** cross-referenced under "Camada 2 = partial". **PROPOSED** (not applied): reclassify Camada 2 as partial capability + deferred full scope. |
| **D3** | Camada 3 backup | Canon (DEFERRED, BK1–BK8) × code (nothing) × closeout (not implemented) | **Total CONVERGENCE** — no divergence. |
| **D4** | Documents section "ACCEPTED" vs. depth of validation | Canon: G28-C `CLOSED/ACCEPTED` (explicit decision `d5ec09f`); closeout L36–37,52–53: no functional/personal validation by the architect, browser smoke never run | **Both facts are true**; the divergence is one of **interpretation** ("technical/staging ACCEPTED" vs. "functional product acceptance"). Reserved for the architect (item 4). Reinforced by the asymmetry: Pedido/OP had a real browser test, Documents did not. |
| **D5** | G28-D publication classification | Closeout L63 ("classificou publicação incorretamente") × canon (G28-D `DEFERRED/NOT AUTHORIZED/NOT PUBLISHED`, consistent across plan/PROJECT_STATE/HANDOFF) | **Canon is intact and correct**: it does not claim publication. The closeout's criticism targets the previous ChatGPT, not the canon. Canon + reality agree: not published. |
| **D6** | Worktree `app-next` divergent | Closeout L59 × real git (11 behind + dirty) | **CONFIRMED** by the git audit. Real open item (worktree hygiene), already deferred in plan L963. |
| **D7** | ChatGPT supervision instability (altered conclusions, confused end-of-phase with end-of-backlog, treated partial capability as complete, mixed technical conclusion with acceptance) | Closeout L60–66 | My review **corroborates** the substantive points: the partial-capability distinction (D2) and technical-vs-functional (D4) are real; the current canon **already** correctly separates "active phase: NONE" from "open backlog" (`AGENT_HANDOFF.md:7`). |

---

## PLAN_ALIGNMENT (literal block §17.8)

```
PLAN_ALIGNMENT: RECONCILED (read-only)
MASTER_PLAN: docs/architecture/DOCUMENTOS_VALIDACAO_VINCULOS_E_EVOLUCAO_PLANO.md (G28-PLAN-R1)
LAST_ACCEPTED_PHASE: DOCS-PEDIDO-OP-LEGACY-PLAN-STATUS-CONSISTENCY-R1 (CLOSED/ACCEPTED); última fase funcional G28 = G28-C
CURRENT_PHASE: NONE (nenhuma fase funcional ativa)
NEXT_AUTHORIZABLE_ACTION: NONE — ARCHITECT DECISION REQUIRED (sem candidato técnico único inequívoco)
OPEN_ARCHITECT_DECISIONS: seleção da próxima frente (Camada 2 parcial→completa / Camada 3 / Camada 4 / DELETE-PROD-GUARD-A / Fase J / DEPLOYMENT_MAPPING); classificação de aceite da seção de Documentos (técnico vs. funcional); reclassificação PROPOSED da Camada 2
DEFERRED_PHASES: G28-D publicação; DEPLOYMENT_MAPPING_AND_PRODUCTION_MIGRATION_PROCEDURE; G28-CAMADA-2/3/4; DELETE-PROD-GUARD-A; DELETE-AUDIT-LOG-A; Fase J; aplicação em produção do stack staging-only; limpeza de worktrees; débitos técnicos (TS/npm/metadata/manifest)
STATE_FILES_UPDATED: NONE (diagnóstico read-only)
MATERIAL_DIVERGENCES: nenhuma divergência material ENTRE canônicos (canon internamente consistente). Divergências canon×código×closeout catalogadas no §6 (D1–D7); nenhuma exige HARD STOP.
```

---

## HARD STOP Gate (material divergence between canonical documents)

**NOT triggered.** The canonical documents are internally consistent regarding state (`ACTIVE_PHASE: NONE`, `NEXT_AUTHORIZABLE_ACTION: NONE`), debts, and deferred layers. The only candidate textual inconsistency — the "lacuna db/37 sem D-DEL próprio" note in `PEDIDO_OP_MOVIMENTACAO_DOCUMENTOS_PLANO.md` L345-347 — was **verified as already resolved** (`D-DEL14` exists in `SCHEMA_CONTRACT` §10 L640; backfill documented). It is a historical note, not an incorrect current state → **non-material**.

---

## Synthesis

1. **The closeout's central thesis holds up under code verification:** Camada 2 is **partial** capability, Camada 3 **does not exist**, G28-D **not published** — and the **canon already agrees** with this. The error was in the ChatGPT `PROJECT-CONTROL-BASELINE-R1` report (external artifact, never canonical), not in the repo's documentation.
2. **Two architect decisions unblock the backlog:** (a) reclassify **Camada 2** as partial capability + deferred A1–A7 scope (PROPOSED ready above); (b) determine whether the **Documents section acceptance** is technical/staging or requires functional validation by the architect (the authenticated browser smoke never ran).
3. **Specific operational risk:** the **`app-next`** worktree is dirty and 11 commits behind the remote — worth a hygiene decision (commit/discard/sync) in its own phase.

No action was executed in this diagnostic — subsequent architect decisions are recorded in `PROJECT_STATE.md` (`G28-RECONCILIATION-DECISIONS-A`) and `docs/ledgers/G28_LEDGER.md`.
