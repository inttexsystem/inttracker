# TEST-MOCK-FIDELITY-AUDIT — Report

- **Phase:** `TEST-MOCK-FIDELITY-AUDIT` (read-only). **Status:** `CLOSED / ACCEPTED`
  (architect ratification, 2026-07-17).
- **Authorization:** explicit architect order ("ARCHITECT AUTHORIZATION —
  TEST-MOCK-FIDELITY-AUDIT (read-only)"), session model / high effort, scoped to
  inventory + verdicts + proposal; **no file changed by the audit itself.**
- **Trigger:** three defects of one root class surfaced in a single day
  (closeout `260301a`) — a test double that diverges from the real behavior it
  imitates and therefore confirms whatever bug that divergence contains:
  1. `UI-EL-BOOLEAN-ATTR-FIX` — a DOM double stored raw `setAttribute` values;
     the real DOM coerces boolean attributes by presence.
  2. Hand-mocked `js/ui.js` primitives (`tests/direct-cnpj-screens.smoke.js`
     broke on the missing `truncatedCell` stand-in).
  3. `UI-INVOKE-ENVELOPE-FIX` — the fake Supabase client's `functions.invoke()`
     returned the inner payload flat; the real client double-wraps.

## 1. Method

All 124 suites in `tests/` were partitioned into 6 category batches and audited
against the real behavior each double imitates: `js/ui.js` `el()` boolean-attr
coercion (§`BOOLEAN_ATTRS`, `js/ui.js:20-42`), `@supabase/supabase-js`
`functions.invoke()` (raw-body pass-through → double envelope given
`jsonResponse()`), `.rpc()`/PostgREST `{data,error}` envelopes, and the real
`js/ui.js` primitive shapes. Every verdict was cross-checked centrally against
the live source; the two crown-jewel classes (invoke-envelope and boolean-attr)
were verified by direct reading of the highest-stakes suites and their covered
call sites.

Verdict rubric, per double:
- **(a) FAITHFUL** — models the real behavior on the axes the tests exercise.
- **(b) BENIGN SIMPLIFICATION** — diverges, but no current test can be fooled
  (quarantined divergence, or a divergence that fails safe).
- **(c) STRUCTURALLY BLIND** — diverges in a way that would confirm a real-code
  bug (evidence: real behavior + source, the double's behavior, a concrete bug
  shape it would mask).
- **NO-DOUBLE (static / pure-fn)** — reads a source/SQL/migration file and
  regex-asserts its text, or feeds plain objects into a pure function; no runtime
  boundary is faked. Out of fidelity scope.

## 2. Headline result

**Zero confirmed (c) STRUCTURALLY-BLIND doubles that mask a live bug.**

The three triggering defects were genuine (c) cases at the time; all three are
now fixed **and their doubles corrected into the faithful seed**:

| Fixed class | Corrected reference double (now faithful) | Proof it catches the class |
|---|---|---|
| boolean-attr coercion | `tests/ui-el-boolean-attrs.smoke.js` `DomLikeNode`; `tests/admin-usuarios.smoke.js:111-134` `FAKE_NODE_BOOLEAN_ATTRS` | self-test `ui-el-boolean-attrs.smoke.js:162-166`; `admin-usuarios` tests 38-41 assert `hasAttribute` presence |
| ui.js primitive hand-mock | `tests/ui-truncated-cell.smoke.js`, `tests/ui-action-button.smoke.js` load the **real** `js/ui.js` | asserts `disabled` **absent** (not `"false"`) at default |
| invoke double-envelope | `tests/admin-usuarios.smoke.js:219-226` returns `{data:{data:payload}}` | tests 14b/31b/32b fail if `invokeAdminFunction`'s unwrap is dropped |

Central cross-checks (verified directly, not inferred):
- **Only one suite runtime-fakes `functions.invoke`** — `admin-usuarios.smoke.js`
  — and it is the faithful double-wrapped one. Every other `invoke` reference in
  `tests/` is a static source-string assertion. The invoke-envelope class has
  **no blind siblings** — only a coverage gap on legacy dead code (§4, R3).
- The `open: open` sites flagged by grep are **module public-API returns**
  (`return { open, setBusy, ... }`), not DOM attributes.
- **No suite uses a real DOM (jsdom).** All DOM fidelity rests on either loading
  the real `js/ui.js` plus a presence-tracking FakeNode, or a hand-rolled
  stand-in.

### Verdict distribution (124 suites, dominant-double level)

| Verdict | Count | Meaning |
|---|--:|---|
| NO-DOUBLE (static / pure-fn) | ~52 | no runtime boundary faked; out of fidelity scope |
| (a) FAITHFUL | ~51 | models real behavior on the axes exercised |
| (b) BENIGN SIMPLIFICATION | ~18 | diverges, but no current test can be fooled |
| **(c) STRUCTURALLY BLIND (live)** | **0** | — |
| KNOWN-DEBT (stale / env) | 3-4 | `index-inline`, `config`, `supabase-client`, `write-guard`; not mock-fidelity |

## 3. Residual risk classes (the substantive finding)

No double currently confirms a bug, but the protection is **accidental and
per-suite**, not structural. Three residual classes, ranked by blast radius.

### R1 — Quarantined boolean-blindness (LATENT (c)) — highest severity
Hand-rolled `el()` reimplementations that store attributes raw and do **not**
coerce booleans, in suites that do **not** load the real `js/ui.js`:

| Suite | Blind double | Benign only because |
|---|---|---|
| `direct-cnpj-screens.smoke.js:70-81` | `sandbox.el` (`node._attrs[key]=value`) + `Node.setAttribute` raw | `screenCadastrosClientes/Fornecedores` have no boolean/ternary attr; asserts CNPJ/payload/`title` only |
| `pedido-form.smoke.js` `runtimeEl`/`RuntimeNode` | sets `disabled=true` on any `disabled` key | source uses `disabled:'disabled'` string literals only |
| `cliente-pedido-tracking.smoke.js` `makeElStub` | text-collector, no attrs | tracking card has no boolean attr / no supa |
| `pedido-detail-linked-documents.smoke.js` `buildMockEl` | text-flatten | asserts text only |
| `tec-to-acabamento-flow.smoke.js` `makeUISandbox` FakeEl | raw hand-roll | split-UI tests never touch the boolean axis |

This is the exact shape of the confirmed `UI-EL-BOOLEAN-ATTR-FIX` regression
(`checked/disabled: <boolean>` → raw double stores it truthy; the real DOM
renders it present regardless). These pass green only because the screens they
render have no boolean/ternary attribute today. Adding one `disabled: isBlocked`
to any of those screens makes the test go silently green on the bug.

### R2 — Fail-unsafe copy-drift in the raw-store FakeNode lineage — medium
Suites that **do** load the real `js/ui.js` but whose FakeNode lacks
`removeAttribute`/`hasAttribute` (`fornecedor-screens`, `painel-screen`, the
documentos-recebidos DOM cluster, `boot`/`system-screens`/`screens-common`).
These **fail safe** — if a falsy boolean attr were rendered, the real `el()`
calls the missing `removeAttribute` and the test crashes rather than passing.
Acceptable but fragile and inconsistent: `cadastros-screens.smoke.js:162` added
`removeAttribute` (citing `UI-EL-BOOLEAN-ATTR-FIX`); its verbatim siblings did
not.

### R3 — Invoke-envelope coverage gap on legacy dead code (missing double, not blind) — low
`cadastros-usuarios-auth-ui.smoke.js` is entirely static — it text-asserts that
`cadastros.js` contains `functions.invoke('admin-create-user')` but never runs
it. The legacy `screenCadastrosUsuarios` still has the unfixed shallow read
`createData.user_id` at `cadastros.js:2659` and `checked: mostrarInativos` at
`cadastros.js:2348`. No runtime test can catch either. But that screen is dead
code (route cut over to `admin-usuarios.js` at `A3.1`), the live path is fully
covered by `admin-usuarios.smoke.js`, and removal is scheduled as `A3.4`. It
resolves itself.

## 4. Shared-double assessment — APPROVED (as proposed): additive, opt-in, phased

Fidelity today is re-derived per suite: the faithful `DomLikeNode` is copied
~4×, `makeFakeSupabaseClient`/thenable-builder ~8×, the raw-store FakeNode ~15×
across ≥3 diverging lineages. Correctness is accidental — it holds by quarantine
(R1) and fail-safe crashes (R2), both one careless edit from breaking.

A single shared module — `tests/_doubles.js` exposing one FaithfulNode with real
DOM boolean coercion + presence, and one fake `supa` with the real
`{data,error}` / single-vs-array / **double-envelope `invoke`** / single-level
`rpc` behavior, seeded from the three corrected doubles — converts accidental
safety into structural safety.

Weighed against the named health rules:
- **§7 (size):** a canonical double is ~150-250 lines ("ideal file") and shrinks
  every adopting suite. Favorable.
- **§14 (single-scope phases; break up if >3 domains):** a big-bang migration is
  forbidden (touches admin, OP, entrega, cliente, documents at once).
  Introduction must be additive (new file, zero suites migrated) as one step,
  then adoption in lots — never bundled with feature work. Compatible if phased.
- **§13 + test-suite independence:** the real cost. A shared double couples the
  suites and **centralizes both protection and failure** — a bug in the shared
  double could turn many suites falsely green at once. Mitigation (mandatory):
  the shared double ships with its own meta-tests (the `ui-el-boolean-attrs`
  self-test pattern) proving it catches each class it exists to catch.

**Architect ruling:** APPROVED as proposed — additive, opt-in, phased; seeded
from the three corrected doubles; mandatory meta-tests; adoption in R1 suites
first (= Lot L1), then opportunistic convergence when suites are touched for
other reasons (§19 philosophy). No mandated big-bang migration.

## 5. Prioritized lots (ratified)

| Lot | Priority | Scope | Status |
|---|---|---|---|
| L0 | baseline | Record this audit; re-ground the stale baseline into the two buckets (§6); add §20 to `CODE_HEALTH_RULES.md`. Docs-only. | `AUTHORIZED` |
| L1 | P1 | Introduce `tests/_doubles.js` + meta-tests (additive, zero suites migrated) as one commit; adopt in the R1 suites + fix the R2 drift (`fornecedor-screens`, `painel-screen`) as a second commit, same phase. Proof: adopted suites keep passing AND a per-suite demonstration test showing the old double would have missed what the new one catches. | `AUTHORIZED` (next code phase) |
| L2 | P2 (hygiene) | Delete/rewrite the stale inline-`<script>` assertions (`index-inline`/`config`/`supabase-client`); ephemeral `listen(0)` replacing fixed `:8765`. | `AUTHORIZED` after L1 |
| L3 | — | Invoke-envelope coverage gap — resolved by `A3.4` (legacy removal). No separate test work. | `NO ACTION` (ratified) |

## 6. Known-debt cross-check (re-grounds the baseline)

The pre-existing "index-inline failures" and "ECONNREFUSED flakiness" resolve
into **two non-mock-fidelity buckets**:

1. **Fixed-port `:8765` environment dependency** — `index-inline.smoke.js`
   (tests 1-5,7) and `write-guard.smoke.js` (`fetchIndexHtml`) `http.get` a dev
   server on a hard-coded port 8765; `ECONNREFUSED` when it is down. By contrast
   `config`/`auth`/`environment-banner`/`supabase-client` self-host on ephemeral
   `listen(0)` and are robust. → environment issue, not mock-fidelity.
2. **Stale-assertion (inline `<script>` removed)** — a shared
   `extractInlineScript` helper in `index-inline` + `config` + `supabase-client`
   throws `'nenhum <script> inline encontrado'` because the modularization tracks
   (ROUTER-MODULE-A, SUPABASE-CLIENT-MODULE-A, env-banner extraction) removed the
   inline block entirely (`index.html` now has 79/79 `<script>` tags with `src=`,
   zero inline). These fail regardless of environment (the `config`/
   `supabase-client` copies run on ephemeral servers). → genuine stale-assertion
   test debt: one root premise in three copies.

Neither is mock-fidelity. The doubles inside these suites (`supabase-client`'s
write-guard fake; `index-inline`'s `setupSandbox` FakeNode) are adequate for
their purpose; only the index.html-structure assertions are stale.

On the numbers: `index-inline` measures **6 fail / 7** now (not the "11" carried
in the handoff); the "11" and "~87" figures are themselves stale baseline
artifacts predating further extraction. L0 re-grounds them to the two buckets
above so future regression proofs stop carrying this noise.

## 7. Per-suite verdicts (complete, grouped by batch)

### B1 — admin / user / auth (18)
- FAITHFUL: `admin-usuarios` (crown-jewel: real ui.js + double-wrapped invoke +
  presence FakeNode), `admin-usuarios-audit-panel`, `admin-dashboard`, `auth`,
  `trocar-senha-obrigatoria`.
- NO-DOUBLE: `admin-create-user`, `admin-delete-user`, `admin-disable-user`,
  `admin-disable-user-e2e-runner`, `admin-disable-user-ui-browser-e2e`,
  `admin-reactivate-user`, `admin-reset-user-password`,
  `admin-last-sign-in-readmodel`, `admin-usuarios-audit-read-model`,
  `admin-usuarios-senha-temporaria-schema`, `auth-disable-user-schema`,
  `admin-pedido-tracking-control`, `cadastros-usuarios-auth-ui` (coverage gap R3).

### B2 — ui primitives + list / dashboard screens (17)
- FAITHFUL: `ui-el-boolean-attrs`, `ui-action-button`, `ui-truncated-cell`,
  `ui-grid-text-lot-a`, `ui-grid-text-lot-b-and-c`,
  `ui-documentos-recebidos-layout-fix`, `ops-list-screen`, `cadastros-screens`,
  `fornecedor-screens` (R2 drift), `painel-screen` (R2 drift).
- BENIGN: `badges`, `direct-cnpj-screens` (R1 quarantined-blind).
- NO-DOUBLE: `cliente-dashboard`, `cliente-pedidos-list`, `pedidos-list`,
  `ops-list`, `op-display`.

### B3 — pedido / cliente / routing / common (22)
- FAITHFUL: `cliente-routing`, `cliente-tracking-steps`,
  `pedido-acompanhamento-parcial`, `pedido-detail-linked-ops` (models PostgREST
  error codes), `pedido-edit`, `pedido-ui`, `router`, `screens-common`,
  `system-screens`, `environment-banner`.
- BENIGN: `boot`, `pedido-detail` (presence-faithful node — actively catches
  `disabled:null`), `cliente-pedido-tracking` (R1),
  `pedido-detail-linked-documents` (R1), `pedido-form` (R1).
- NO-DOUBLE: `cliente-pedido-detail`, `cliente-pedido-events`,
  `cliente-pedido-form`, `cliente-pedido-summary-acl-grants`,
  `cliente-pedido-summary-readmodel`, `cliente-portal-visual`,
  `pedido-itens-edit`.

### B4 — OP / entrega / expedição / latex / schema (23)
- FAITHFUL: `entrega-writes`, `op-persistir`, `op-recalculo`, `op-writes`
  (per-step error injection), `calculo-op`.
- BENIGN: `entrega-form`, `op-form-helpers`, `op-latex-admin`, `op-nova`,
  `op-pdf`, `tec-to-acabamento-flow` (R1). ENV+BENIGN: `write-guard` (fixed
  `:8765`).
- NO-DOUBLE: `expedicao-flow` (statically guards the `disabled=null` shape),
  `expedicao-partial-flow`, `latex-consolidation-schema`,
  `latex-entry-gate-schema`, `op-latex-requires-pedido-guard`, `op-latex-split`,
  `pedido-parciais-admin-control`, `pedido-parciais-schema`,
  `production-flow-invariants`, `production-flow-numbering-schema`,
  `tec-to-acabamento-guard-schema`.

### B5 — documents ingestor / decision / reader cluster (20)
- FAITHFUL: `documents-scan-trigger` (models `single()` + list thenable —
  fidelity high-water mark), `documents-supabase-decisions`,
  `documents-supabase-links`, `documents-supabase-reader`,
  `documents-supabase-reader-links`, `documents-decision-command`,
  `documents-decision-controller`, `documents-validation-command`,
  `documents-ingestor`, `documents-ingestor-local-decision-boundary`,
  `documents-ingestor-auto-load`, `documents-ingestor-loader`.
- BENIGN: `documents-ingestor-import-received`, `documents-ingestor-import-ui`,
  `documents-ingestor-ui-smoke` (hand-rolled, not jsdom), `g14-c-bridge-smoke`.
- NO-DOUBLE: `document-decision-command-contract`,
  `documentos-ingestor-state-undo-schema`,
  `documentos-scan-requests-queue-schema`, `g25-b1-ux-a-schema`.
- (all documents adapters use `.rpc` → single-level `{data:payload}` is correct,
  not blind.)

### B6 — documentos-recebidos / document-link / read-models / known-debt (24)
- FAITHFUL: `document-link-admin-controller`, `document-link-admin-modal`,
  `document-links-surface`, `documentos-recebidos-decision-integration`,
  `documentos-recebidos-decision-modal`, `documentos-recebidos-source-boundary`,
  `documentos-recebidos-status-overrides-removal`, `documentos-recebidos`,
  `controlled-delete` (`disabled` via property — faithful path; adapter fakes at
  DI seam).
- KNOWN-DEBT (mixed): `config`, `index-inline`, `supabase-client`.
- NO-DOUBLE: `cliente-events-rls-schema`, `cliente-perfil-schema`,
  `cliente-tracking-schema`, `document-canonical-links-contract`,
  `document-legacy-decision-rpc-runtime-boundary`,
  `document-link-correction-restoration-contract`,
  `document-link-audit-read-model`, `document-queue-read-model`,
  `document-surface-links-read-model`, `documentos-recebidos-queue-ui`,
  `documentos-schema`, `pedidos-schema`.

## 8. §18 conclusion

**Continue + open specific correction phases (L0/L1/L2), non-blocking.** The
three known defects are fixed and their doubles are the faithful seed; no live
blind double survives. The real exposure is structural — boolean-attr fidelity
is guaranteed only by quarantine (R1) and fail-safe crashes (R2), and the
inline-`<script>` known-debt (L2) pollutes every baseline. The shared-double
module (§4) is the durable structural answer, APPROVED as PROPOSED: additive,
phased per §14, seeded from the corrected doubles, shipped with its own
meta-tests.

## STRUCTURAL POLICY COMPLIANCE

- **§13 (tests):** this phase changed no test; it is a read-only inventory. The
  authorized follow-up L1 carries the proportional test work (meta-tests +
  per-suite demonstration tests).
- **§14 (single scope):** the audit is inventory + verdicts + proposal only; the
  ratified lots separate docs (L0) from code (L1/L2) into distinct phases.
- **§18 (periodic audit):** executed as a read-only audit; concludes "continue +
  specific correction phase", per the §18 required outcomes.
- **§20 (test-double fidelity):** established by this audit and folded into L0.
- **Accesses:** no Supabase / MCP / staging / production; `bhgifjrfagkzubpyqpew`
  not accessed. **Git:** read-only during the audit; L0 is a docs-only commit,
  selective staging, no push.
