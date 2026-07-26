# VISUAL CONFORMANCE — INTTRACKER

> Layer 4 of the contract. Screen → archetype → state → fixture.
> **State is filled by the detector, not by eye.** Until the phase-4 detector runs,
> anything not read line by line stays `unaudited`.
>
> **Status: PHASE-3 CONFORMED (CORRECTED) / PHASE-4 DETECTOR PENDING.**
> The Archetype-A reference fixture obeys the contract **and renders with every
> external origin blocked**, so a green baseline exists to diff against. The general
> detector does **not** exist yet; every `unaudited` row below stays `unaudited` until
> it runs. One conforming screen does **not** ratify an archetype — see § Archetype
> ratification.
>
> **Forward correction of the classification recorded at `2641a44`.** That commit
> already read `conforming`, and it was premature on three counts: the fixture booted
> its React runtime from a public CDN and therefore rendered a **blank page** with no
> internet access; its status pill kept a borderless `padding: 3px 9px` construction
> instead of §2.6's `height: 18px` bordered form; and its document count badge used a
> literal `font-size: 10px`, below the §5 type-enum floor of `10.5px`. All three are
> corrected. The earlier text is not rewritten — this note supersedes it. The
> classification now rests on four satisfied preconditions: a local offline runtime,
> the canonical status pill, count typography inside the enum, and semantic-radius
> validation (D6.1), with a complete four-image visual-evidence set held outside the
> repository. Phase 3 itself is **not** accepted; that remains the architect's call.

**Generation** (to size effort — see `DESIGN_DECISIONS.md`):
`G1` legacy generic · rebuild — `G2` minimalist with vibrant colour · mechanical pass
— `G3` compact · reference — `SGAA` already retokenised.

**State:** `conforming` · `deviation` (list which) · `rebuild` · `unaudited`

---

## Archetype A — Detail cockpit

| Screen | Generation | State | Note |
|---|---|---|---|
| `docs/ui/fixtures/op-detail-compacto/OP Detail - Compacto.dc.html` | G3 | **fixture** · conforming | Geometry **and** value reference. Conformed in phase 3: loads `css/tokens.css`, 0 literal colours, radius ∈ {`--rv-radius`, `--rv-radius-pill`} scoped by D6.1, heights ∈ the 32/34/38 ladder, cards flat, in-card action row marked `data-card-actions`, status pill per §2.6, every font size inside the §5 enum. Renders offline: its React runtime is versioned at `docs/ui/fixtures/vendor/react-18.3.1/`, so no external origin is required. Guarded by `tests/ui-op-detail-compacto-fixture.test.mjs` (36 tests). State asserted by that focused test, not by the phase-4 detector. |
| `OP Acabamento - Aberta.dc.html` | G3 | unaudited | Candidate second screen — this is what ratifies archetype A. |
| `Admin - Detalhe da OP.dc.html` | unaudited | unaudited | Native `<select>` (D8). |
| `Admin - Detalhe da OP (Acabamento).dc.html` | unaudited | unaudited | Native `<select>` (D8). |
| `Admin - Detalhe do Pedido.dc.html` | unaudited | unaudited | Native `<select>` (D8). |
| `Fase B - Tela da OP - Config ON.dc.html` | unaudited | unaudited | |
| `Fase B - Tela da OP - Config OFF.dc.html` | unaudited | unaudited | |
| `Fase B - Tela da OP - OFF e ON.dc.html` | unaudited | unaudited | Comparison view — may not be a product screen. |
| `Fase B - Ordens na Tela da OP.dc.html` | unaudited | unaudited | |
| `Fase B2 - Detalhe da Ordem de Compra.dc.html` | unaudited | unaudited | Native `<select>` (D8). |

## Archetype B — Work queue

| Screen | Generation | State | Note |
|---|---|---|---|
| `Admin - Lista de OPs.dc.html` | unaudited | unaudited | **Candidate fixture.** |
| `Admin - Lista de Pedidos.dc.html` | unaudited | unaudited | |
| `Admin - Documentos.dc.html` | unaudited | unaudited | No cockpit — picks the layout review needs. |
| `Admin - Fornecedores.dc.html` | unaudited | unaudited | |
| `Cliente - Lista de Pedidos.dc.html` | unaudited | unaudited | A queue, but under archetype E's content restriction. |

## Archetype C — Creation form

| Screen | Generation | State | Note |
|---|---|---|---|
| `Novo Pedido.dc.html` | unaudited | unaudited | **Candidate fixture.** |
| `Admin - Nova OP.dc.html` | unaudited | unaudited | Native `<select>` (D8). |

## Archetype D — Decision modal

| Screen | Generation | State | Note |
|---|---|---|---|
| `Modal Movimentar Produção.dc.html` | unaudited | unaudited | **Candidate fixture.** |
| `Modal Adicionar Item.dc.html` | unaudited | unaudited | |

## Archetype E — Client portal

| Screen | Generation | State | Note |
|---|---|---|---|
| `Detalhe do Pedido v2.dc.html` | unaudited | unaudited | **Candidate fixture.** |
| `Detalhe do Pedido.dc.html` | G2 | rebuild or retire | Superseded by v2. |
| `Dashboard Cliente.dc.html` | G2 | unaudited | |
| `Acompanhamento B2B.dc.html` | **G2** | confirmed deviation | `#2563eb` in ~20 places, a 4th popover shadow, its own stepper. Furthest screen from canonical. |

## Archetype F — Configuration

| Screen | Generation | State | Note |
|---|---|---|---|
| `Admin - Parâmetros.dc.html` | unaudited | unaudited | **Candidate fixture.** |
| `Admin - Cores.dc.html` | unaudited | unaudited | Consumes the 7 alert presets + free colour. |
| `Admin - Login.dc.html` | unaudited | unaudited | Brand signature point (teal rule). |

## Outside the archetypes — chrome and documentation

| File | Role |
|---|---|
| `Admin - Sidebar.dc.html` · `Admin - Topbar.dc.html` | Shell pieces, not screens. |
| `PainelAdmin.dc.html` | Unaudited; classify. |
| `Inttex - Identidade Visual.dc.html` | **SGAA** · brand documentation. |
| `docs/ui/evidence/ui-consolidation/Reconciliação de Tokens.dc.html` | **SGAA** · round-1 documentation. Evidence, never runtime. |
| `Setas de transicao - referencia.html` | Internal reference. |
| `*-standalone.html` · `*-bundle-ready.html` · `*-print-*` | Export derivatives. **Do not audit or hand-edit** — regenerate from source after the passes. |

---

## Execution order — by property batch

One pass per property across **all** screens, in this order. A pass closes when the
detector reports zero for its rule. Never screen by screen.

| # | Pass | Change | Verification |
|---|---|---|---|
| 1 | Token | literal hex → `var(--rv-*)` | detector: 0 literals |
| 2 | Colour | `#2563eb` / `#14509E` / `#0A326D` → `--rv-brand` / `--rv-accent-blue`; text → 4 levels | detector: 0 out-of-enum colours |
| 3 | Radius | all → `4px`; pills → `999px` | detector: radius ∈ {4px, 999px} |
| 4 | Height | controls → 32 / 34 / 38 | detector: height ∈ enum |
| 5 | Shadow | 4 popover values → 1; cards flat | detector: shadow ∈ enum |
| 6 | Alignment | in-card action → right-aligned footer | detector rule 8 |
| 7 | Popover | native `<select>` → own popover | detector: 0 `<select>` |
| 8 | Tables | header width/alignment identical to values | **manual review** |

Passes 1–7 are mechanical and verifiable. Pass 8 is the only one that needs eyes.
Do not open a pass while the previous one is still failing.

**None of these passes is closed.** Phase 3 applied passes 1–6 to the **reference
fixture alone**, so that the detector has a green baseline instead of flagging the
reference first. That is a single-file exception granted precisely because the
reference cannot be remediated by batch — it is what the batch is measured against.
Every pass still has to run across all screens in phase 5, and a pass closes only
when the phase-4 detector reports zero for its rule repository-wide. The fixture's
conformance is **not** precedent for remediating any other screen individually.

---

## Versioned fixture provenance

The external intake contained `OP Detail - Compacto copy.dc.html`. Its SHA-256 was
identical to the primary fixture
(`852cd0e7631dfe1622bbf520885533a9036144f5029e9e37bc9aa7dd2034dd26`), so it was not
promoted. Only the primary fixture is the versioned reference.

Versioning two byte-identical files would have created a second citable precedent for
archetype A while adding no information — and two copies of the fixture is how the
third visual generation started. The copy remains in the external intake package,
untouched; it is not a precedent and must not be cited as one.

One `support.js` is versioned, at `docs/ui/fixtures/op-detail-compacto/support.js`.
The evidence document loads that same instance. It is fixture infrastructure only:
no product bundle, no application file and no `index.html` entry may reference it.

### Vendored fixture runtime — immutable third-party assets

`support.js` boots with `loadReactUmd().then(init)`. While that runtime came from a
public CDN the fixture rendered a blank page whenever the origin was unreachable, so
the reference only existed with internet access. React **18.3.1** and ReactDOM
**18.3.1** (MIT) are therefore versioned at
`docs/ui/fixtures/vendor/react-18.3.1/`, promoted byte-for-byte from the official npm
packages, and loaded before `support.js`, which short-circuits when the globals are
already present. `support.js` itself was not modified. Custody — package, version,
license, registry integrity, per-file digests and byte counts — is recorded in
`docs/ui/fixtures/vendor/react-18.3.1/README.md`, and the digests also reproduce the
Subresource Integrity values `support.js` already pinned for the CDN copies, which is
independent proof nothing was substituted or rebuilt.

They are **immutable third-party fixture runtime assets**: not project-authored
source, exempt from the `CODE_HEALTH_RULES.md` §7 size thresholds, never edited, never
imported by the product runtime, and no precedent for minified code as project source,
for further vendored dependencies or for a version upgrade. Changing the versions
requires a separate explicit order.

## Archetype ratification

`CANDIDATE` → `RATIFIED` when **two** screens of that archetype pass the detector with
no deviation. Until then the archetype may not be cited as precedent for a new screen.
Record the ratification in `DESIGN_DECISIONS.md`.

**Archetype A is NOT fully ratified by phase 3.** Exactly one conforming screen
exists, and it was verified by a fixture-specific test rather than by the general
detector, which does not exist yet. The second conforming screen — the candidate is
`OP Acabamento - Aberta.dc.html` — and a detector run are both still required.
