# UI Gap Inventory — Client Portal B2B

> **Phase:** `RAVATEX-TAPETES-CLIENTE-PORTAL-UI-GAP-INVENTORY-A`
> **Type:** diagnostic/documentation. **Read-only.** No implementation.
> **UI status:** functional in staging, **NOT final** (confirmed in
> `PROJECT_STATE.md`, phase `RAVATEX-TAPETES-CLIENTE-PORTAL-STAGING-CLOSEOUT-A`).
> **Production:** remains blocked. This document does not authorize,
> recommend a timeline, nor imply a decision to promote to production.

## 0. Nature of this document

This document **maps divergences**, it does not fix them. It compares the
mockups/HTMLs approved by the project owner against the current
implementation of the Client Portal B2B screens, so that the next
round of visual refinement can be scoped with control. No
file under `js/**`, `db/**`, `supabase/functions/**`, `index.html`, or
tests was altered to produce this inventory.

## 1. Base state

- **Branch:** `work/app-next`.
- **HEAD at the start and end of this phase:** `932ba38` (working tree
  clean before and after; no code commit was created).
- **Staging Supabase:** `ucrjtfswnfdlxwtmxnoo` (not accessed in this
  phase — local file reads only).
- **Production/original** `bhgifjrfagkzubpyqpew` and `origin/main`: not
  touched.

### 1.1 Located mockups

All 5 mockups were **located on the project owner's machine**, outside
the git repository, at:

`D:\OneDrive\Ravatex\Inttex\Mockups - nova interface\`

| File | Reference screen |
|---|---|
| `Dashboard Cliente - standalone.html` | Client Dashboard |
| `Novo Pedido - standalone.html` | New Pedido |
| `Modal Adicionar Item - standalone.html` | Add Item Modal |
| `Detalhe do Pedido - standalone.html` | Pedido Detail |
| `Admin-Cliente-Acompanhamento B2B - standalone.html` | Tracking/Stepper/Timeline (client) + admin visual-status-control screen + legend/taxonomy page — all three contents are **in the same file** |

These 5 files coincide exactly with the mockups listed in
`docs/architecture/PORTAL_B2B_ARCHITECTURE_RULES.md` §10 (Client
Dashboard, New Pedido, Add Item Modal, Pedido Detail), plus the
Tracking B2B file that provides context for the stepper/timeline and
the shared taxonomy already documented in `js/pedido-tracking-ui.js`.

**File format:** each HTML is a "Bundled Page" wrapper from an
AI design tool — the actual HTML is serialized as a JSON string
inside `<script type="__bundler/template">`. They are not
renderable by direct text reading; the content was extracted
programmatically (JSON decoding + tag stripping) solely for
reading/comparison, without ever pasting raw HTML into any file of the
project — in compliance with the prohibition in
`docs/architecture/PORTAL_B2B_ARCHITECTURE_RULES.md` §10.

**Missing mockup for the "Meus pedidos" listing:** no dedicated mockup
was located for the `#/cliente/pedidos` screen (listing) at the time
of this inventory phase. This screen was not among the 4 official
mockups in `PORTAL_B2B_ARCHITECTURE_RULES.md` §10, nor among the 6
comparison units of this phase. Recorded here solely for
traceability — **it was not a blocker** for this inventory phase.
**2026-06-30 update:** the mockup `Cliente - Lista de Pedidos -
standalone.html` was later made available by the project owner and
the screen was approved in phase
`RAVATEX-TAPETES-CLIENTE-PEDIDOS-LIST-MATCH-STANDALONE-CLAUDE-R1`
(see the "My Pedidos (List)" row in the §2 matrix).

### 1.2 Implementation files read (mandatory context + screens)

- `PROJECT_STATE.md`, `AGENT_HANDOFF.md` (read in full).
- `docs/architecture/PORTAL_B2B_ARCHITECTURE_RULES.md` (read in full).
- `js/screens/cliente-common.js`
- `js/screens/cliente-dashboard.js`
- `js/screens/cliente-pedidos-list.js`
- `js/screens/cliente-pedido-detail.js`
- `js/screens/cliente-pedido-tracking.js`
- `js/screens/cliente-pedido-form.js`
- `js/pedido-tracking-ui.js`
- `js/screens/common.js` (shared shellLayout, to understand the
  client shell)
- `js/pedido-ui.js` (operational-status badges/labels, to
  understand the status duplication described in §6)
- `tests/cliente-portal-visual.smoke.js` (exists; used as a
  reference anti-regression guard — not run in this phase)
- `db/15_status_cliente_visual.sql` (targeted query, only to
  confirm already-versioned `tipo_recebimento` values)

### 1.3 Confirmation of the functional state

`PROJECT_STATE.md` confirms, in the previous phase itself
(`...-STAGING-CLOSEOUT-A`), that this is exactly the next recommended
phase: *"UI gap inventory, comparing the mockups/HTMLs requested by
the project owner against the current implementation of the 5 client
portal screens, before any new implementation or decision to promote
to production"*. This document delivers on that recommendation.

## 2. Matrix by screen

Severity legend: 🟢 low · 🟡 medium · 🔴 high.
Touch-risk legend: low (isolated to 1 client module) · medium
(touches client module + new data) · high (touches a component shared
with admin/supplier, e.g. `shellLayout`).

| Screen | Reference analyzed | Current files | Divergence (summary) | Severity | Gap type | Touch risk | Suggested future phase |
|---|---|---|---|---|---|---|---|
| Client Dashboard | `Dashboard Cliente - standalone.html` | `js/screens/cliente-dashboard.js` | ~~KPIs with different semantics; no "pedidos em destaque"; no distribution by stage; no "ações rápidas"; 2-column layout instead of a stack of sections; no CTA in the header~~ **✅ RESOLVED 2026-06-29 — phase `RAVATEX-TAPETES-CLIENTE-DASHBOARD-MATCH-STANDALONE-GLM`** (dynamic values from the client's real data; global shell/sidebar/topbar preserved; standalone sidebar items not ported since they belong to the global shell) | ✅ closed | — | — | `RAVATEX-TAPETES-CLIENTE-DASHBOARD-MATCH-STANDALONE-GLM` |
| New Pedido | `Novo Pedido - standalone.html` | `js/screens/cliente-pedido-form.js` | ~~No "Dados gerais" (client reference, receiving method); inline items instead of table+modal; no totals; 1-step flow instead of a 2-step checkout~~ **✅ RESOLVED 2026-06-29 — phase `RAVATEX-TAPETES-UI-MATCH-STANDALONE-NOVO-PEDIDO`** ("Adicionar item" modal deferred to a later phase) | ✅ closed | — | — | `RAVATEX-TAPETES-UI-MATCH-STANDALONE-NOVO-PEDIDO` |
| Add Item Modal | `Modal Adicionar Item - standalone.html` | `js/screens/cliente-pedido-form.js` | ~~Does not exist as a modal; no Cor 1/Cor 2/Largura per item; no visual reference (upload); no character counter~~ **✅ RESOLVED 2026-06-29 — phase `RAVATEX-TAPETES-UI-MATCH-STANDALONE-NOVO-PEDIDO-ADD-ITEM-MODAL`** (per-item Cor 1/Cor 2 override deferred to a future phase) | ✅ closed | — | — | `RAVATEX-TAPETES-UI-MATCH-STANDALONE-NOVO-PEDIDO-ADD-ITEM-MODAL` |
| Pedido Detail | `Detalhe do Pedido - standalone.html` | `js/screens/cliente-pedido-detail.js` | ~~Summary with 3 columns instead of 4 cards; no breadcrumb; operational status and visual status shown together (two taxonomies); item columns with different naming~~ **✅ RESOLVED 2026-06-29 — HEAD `8650bb5`** | ✅ closed | — | — | `RAVATEX-TAPETES-CLIENTE-DETAIL-VISUAL-HOMOLOG-RECORD-A` |
| Tracking/Stepper/Timeline | `Admin-Cliente-Acompanhamento B2B - standalone.html` (client section) | `js/screens/cliente-pedido-tracking.js`, `js/screens/cliente-pedido-detail.js` | No completion dates per stage; the taxonomy of the 8 stages + 4 exceptions already matches the mockup exactly (alignment confirmed) | 🟡 medium (dates part only) | missing component | low–medium (depends on new data/event) | `UI-GAP-FIX-DETALHE-A` (same phase as the detail, or its own subphase if it requires new data) |
| Client Shell/Menu | sidebar/topbar present in all mockups | `js/screens/cliente-common.js` + `js/screens/common.js` (`shellLayout`, **shared with admin/supplier**) | ~~Menu with 2 items instead of 4 (no "Novo pedido", no "Suporte"); no "Inttex"/"Portal do cliente" brand; no "Cliente" role pill; no icons; generic "Controle de Tapetes" topbar~~ **✅ RESOLVED 2026-06-30 — phase `RAVATEX-TAPETES-STANDARD-SHELL-SIDEBAR-TOPSTRIP-A`** (global chrome via inline styles in `common.js`'s `shellLayout`: 62px topbar with "Inttex" brand + per-profile sectionLabel + avatar; 196px sidebar with iconized nav-items and hash-based active state. Each profile's own menu items preserved; avatars use initials, no photo. "High" risk mitigated: single implementation at the central point, propagating to admin/supplier/client with no duplication) | ✅ closed | — | — | `RAVATEX-TAPETES-STANDARD-SHELL-SIDEBAR-TOPSTRIP-A` |
| My Pedidos (List) | `Cliente - Lista de Pedidos - standalone.html` (made available after the initial inventory — see note in §1.1) | `js/screens/cliente-pedidos-list.js` | ~~Header with no action button; search/tabs absent (only simple filter chips); 5-column table with no status pill or action icon; no partial/total progress column; no "Recebimento" column; no pagination~~ **✅ RESOLVED 2026-06-30 — phase `RAVATEX-TAPETES-CLIENTE-PEDIDOS-LIST-MATCH-STANDALONE-CLAUDE-R1`** (header with a "Solicitar pedido" button; search with inline magnifying-glass icon + 5 tabs with a count badge; 7-column table with a status pill, partial/total progress via `buildPedidoAcompanhamentoParcial`, an eye button, and real pagination. Residual differences: the button uses the standalone's text, not the literal string required by an outdated test guard [reported, test not fixed]; the "Recebimento" column falls back to "—" because it is outside the locked SELECT contract and is not captured today at pedido creation; status labels follow the shared taxonomy, not the mockup's decorative text) | ✅ closed | — | — | `RAVATEX-TAPETES-CLIENTE-PEDIDOS-LIST-MATCH-STANDALONE-CLAUDE-R1` |

## 3. Client Dashboard — detailed comparison

**Mockup** (`Dashboard Cliente - standalone.html`):
- "Início" header + subtitle "Acompanhe seus pedidos em produção,
  acabamento e expedição." + "+ Novo pedido" button in the top-right
  corner of the header.
- 4 KPIs: **Pedidos em aberto** (8), **Em produção** (3), **Prontos
  para expedição** (2), **Atenção** (1) — each with a count + an
  "N pedidos" caption.
- **"Pedidos em destaque"** (subtitle: "Pedidos que precisam da sua
  atenção ou estão em etapas avançadas"): table with columns Pedido /
  Situação / Prazo previsto / Resumo (`N itens · X m`) / Ação ("Ver"),
  with a "Ver todos os pedidos" link.
- **"Situação dos pedidos"** (subtitle: "Distribuição dos pedidos por
  etapa do acompanhamento"): count for each of the 8 stages
  (Recebidos, Confirmados, Insumos, Tecelagem, Acabamento, Expedição,
  Transporte, Concluídos).
- **"Últimas atualizações"**: list of events with date + text, with a
  "Ver histórico completo" link.
- **"Ações rápidas"**: 3 cards (Novo pedido / Meus pedidos / Falar com
  suporte), each with an icon + title + subtitle.

**Current implementation** (`js/screens/cliente-dashboard.js`):
- The header is just `window.pageHeader('Início')`
  ([cliente-dashboard.js:331](js/screens/cliente-dashboard.js:331)) —
  **no subtitle and no "+ Novo pedido" button** in the header.
- 4 KPIs built in `buildKpis()`
  ([cliente-dashboard.js:209-217](js/screens/cliente-dashboard.js:209)):
  **"Pedidos em aberto"**, **"Em andamento"**, **"Prontos /
  concluídos"**, **"Atualizações recentes"**. These are semantic
  divergences, not just labeling ones:
  - "Em andamento" aggregates `tecelagem`/`acabamento`/`expedicao`/
    `transporte` ([cliente-dashboard.js:52](js/screens/cliente-dashboard.js:52)),
    while the mockup separates "Em produção" from "Prontos para
    expedição" (which appears to cover only the `expedicao` stage).
  - "Prontos / concluídos" merges `concluido` with what would be
    "pronto para expedição" in the mockup — these are distinct
    concepts in the mockup, fused together here.
  - The 4th card is **"Atualizações recentes"** (event count), not
    **"Atenção"** (count of pedidos in an exception state). The data
    needed to calculate "Atenção" already exists
    (`status_cliente_excecao` is selected), but it is not used for any
    KPI today.
- `buildPedidosRecentes()`
  ([cliente-dashboard.js:244](js/screens/cliente-dashboard.js:244))
  lists the 5 most recent pedidos by `criado_em` — this is **not** a
  "featured" selection (active exception or advanced stage) as in the
  mockup. Current columns: number, badge, deadline, updated at, "Ver
  pedido" — **without** the "Resumo" (items/footage) column from the
  mockup, which would require a new aggregate query (does not exist
  today).
- **There is no** "Situação dos pedidos" section (distribution by
  stage) anywhere in the current dashboard.
- **There is no** "Ações rápidas" section (shortcut cards).
- "Últimas atualizações" exists (`buildEventos()`,
  [cliente-dashboard.js:305](js/screens/cliente-dashboard.js:305)) and
  covers the mockup's concept, but **without** the "Ver histórico
  completo" link (there is no global event-history page — only the
  per-pedido timeline in the detail).
- Layout: 2-column grid (Pedidos recentes | Últimas atualizações)
  side by side on wide screens
  ([cliente-dashboard.js:332](js/screens/cliente-dashboard.js:332)) —
  the mockup stacks each section at full width, in a different order
  (KPIs → featured → distribution → updates → quick actions).

## 4. New Pedido — detailed comparison

**Mockup** (`Novo Pedido - standalone.html`):
- "Novo pedido" header + subtitle "Preencha os itens do pedido. Após
  o envio, ele ficará como Recebido para conferência." + "Cancelar"
  button at the top.
- **"Dados gerais"** card: Referência do cliente (free text, e.g.
  placeholder "Pedido #8431"), Prazo desejado (date), Recebimento
  (select, e.g. "Retirada").
- **"Itens do pedido"** card: "+ Adicionar item" button (opens a
  modal, see §5) + table with columns Img / Modelo / Cores / Largura /
  Metragem (m) / Observação / Ações, with 4 example items and a footer
  "Total de itens: 4" / "Metragem total: 35.700,00 m".
- Separate **"Instruções gerais"** field (textarea, distinct from the
  per-item observation).
- Footer with **two buttons**: "Ir para checkout" (secondary) and
  "Finalizar pedido" (primary) — 2-step flow.

**Current implementation** (`js/screens/cliente-pedido-form.js`):
- The header is just `pageHeader('Novo pedido', [...])` with a "←
  Voltar para lista" button ([cliente-pedido-form.js:199-206](js/screens/cliente-pedido-form.js:199))
  — **no subtitle** and **no "Cancelar" button at the top** (there is
  a "Cancelar" only in the form's footer).
- **There is no** "Dados gerais" card with Referência do cliente or
  Recebimento. The current form only has **Prazo desejado** (field
  `prazoEntrega`) and **Observação geral**
  ([cliente-pedido-form.js:242-252](js/screens/cliente-pedido-form.js:242)).
  The `referencia_cliente` and `tipo_recebimento` columns **already
  exist in the schema** (`db/15_status_cliente_visual.sql:40-42`), but
  are not captured or sent in the creation payload
  ([cliente-pedido-form.js:289-294](js/screens/cliente-pedido-form.js:289)).
- Items **do not use a table + modal**. They are always-visible inline
  rows (`buildItemRow`,
  [cliente-pedido-form.js:115-177](js/screens/cliente-pedido-form.js:115))
  with a Modelo select + a Metros input + an Observação input, and
  "+ Adicionar item" / "Remover" as text links — a **completely
  different flow structure** from the table + modal of the mockup.
- **No** Img/preview columns, Cores (Cor 1/Cor 2), or Largura per item
  in the form — these only appear later, in the Detail (§6), and there
  they are read-only.
- **No** totals footer ("Total de itens" / "Metragem total").
- The submission flow is a **single step**: the "Enviar pedido" button
  ([cliente-pedido-form.js:236-240](js/screens/cliente-pedido-form.js:236))
  already creates the pedido directly with `status: 'recebido'` —
  **there is no** intermediate "checkout"/review step before
  finalizing, as in the mockup.

## 5. Add Item Modal — detailed comparison

**Mockup** (`Modal Adicionar Item - standalone.html`):
- Modal titled "Adicionar item" + subtitle "Informe os dados do item
  que será incluído no pedido."
- Fields: **Modelo*** (select), **Cores*** — "Cor 1" (select) + "Cor
  2" (select) as overrides independent from the model, **Largura***
  (numeric field/derived from the model), **Metragem*** (number, with
  the "m" unit), **Referência visual** (image upload, optional),
  **Observação do item** (textarea with a "0/200" counter).
- Footer: "Cancelar" + "Adicionar item".

**Current implementation:** **there is no add-item modal at all.**
The creation form (`cliente-pedido-form.js`) adds items inline on the
page itself (see §4). Mapping field by field against what exists
today:
- **Modelo:** exists, as an inline select
  ([cliente-pedido-form.js:125-130](js/screens/cliente-pedido-form.js:125)).
- **Cor 1 / Cor 2:** **there is no** color-override field at all in
  the creation form. The module header explicitly documents:
  *"No `largura`/`cor_1_id`/`cor_2_id` (no override in this phase)"*
  ([cliente-pedido-form.js:35-38](js/screens/cliente-pedido-form.js:35)).
  In the detail (`cliente-pedido-detail.js`), the `cor_1_id`/
  `cor_2_id`/`largura` fields per item **already exist in the SELECT**
  ([cliente-pedido-detail.js:205](js/screens/cliente-pedido-detail.js:205))
  and are already displayed — but read-only, never captured at
  creation.
- **Largura:** same situation — the column exists in the detail's
  schema/SELECT, but the creation form does not capture it.
- **Metragem:** exists (`item.metros`,
  [cliente-pedido-form.js:135-145](js/screens/cliente-pedido-form.js:135)),
  validated as a number > 0.
- **Referência visual (image upload):** **does not exist.** There is
  no file input on any current client screen.
- **Observação do item:** exists (`item.observacao`,
  [cliente-pedido-form.js:150-159](js/screens/cliente-pedido-form.js:150)),
  but **without** a "0/200" character counter or any client-side
  length limit applied.
## 6. Pedido Detail — detailed comparison

> **STATUS: RESOLVED / GAP CLOSED** — Visual homologation approved
> by the project owner on **2026-06-29**. Commit HEAD: `8650bb5`
> ("Match cliente pedido detail to standalone reference"). All
> items below were implemented and accepted. The section is kept only
> as a historical record.

**Mockup** (`Detalhe do Pedido - standalone.html`):
- Breadcrumb "Meus pedidos / Pedido #2" + "← Voltar para
  pedidos" button.
- Header with order number, visual status ("Em acabamento") and
  "Atualizado em [data] às [hora]" — a single source of status.
- 4 summary cards: **Itens** (count), **Metragem total**,
  **Última atualização**, **Prazo previsto** — each with an icon.
- "Itens do pedido" table: Model, **Cores**, Width, Meterage,
  Notes.
- "Histórico": timeline with date/time, title, message.

**Current implementation** (`js/screens/cliente-pedido-detail.js`):
- **No breadcrumb.** Header is only `pageHeader('Pedido', [...])` with
  "← Voltar para lista"
  ([cliente-pedido-detail.js:260-267](js/screens/cliente-pedido-detail.js:260)).
- **Two status sources on the same screen** (hierarchy/naming gap,
  not present in the mockup):
  1. The tracking card (`buildTracking()`, delegated to
     `buildClientePedidoTrackingCard`) shows the **client's visual
     status** (the taxonomy of the 8 stages/4 exceptions from
     `js/pedido-tracking-ui.js`, e.g. "Acabamento").
  2. The summary (`buildResumo()`,
     [cliente-pedido-detail.js:274-288](js/screens/cliente-pedido-detail.js:274))
     shows, next to the order number, `window.pedidoStatusBadge(p.status)`
     — the **raw operational status** (`rascunho`/`recebido`/
     `confirmado`/`produzindo`/`entregue`/`cancelado`, see
     `js/pedido-ui.js:63-66`), which is a different field and can be
     at a different stage than the one published visually. The mockup shows
     **only one** status line at the top. This duplication is
     functionally safe (no internal data is exposed — both
     fields are already "client-safe" by design,
     `PORTAL_B2B_ARCHITECTURE_RULES.md`), but it is a real visual
     divergence and a potential source of confusion for the client.
- The summary has **3 columns** (Delivery deadline / Created on /
  Updated on,
  [cliente-pedido-detail.js:282-286](js/screens/cliente-pedido-detail.js:282))
  instead of the mockup's **4 cards with icon** (Items / Total meterage /
  Last update / Expected deadline). The "Itens" (count)
  and "Metragem total" (sum) data **can be derived** from the items already
  loaded (`state.itens`) without a new query. **"Prazo previsto"**
  in the mockup appears to correspond to the `prazo_desejado` column, which is
  **not selected** in the current `pedidos` SELECT
  ([cliente-pedido-detail.js:174](js/screens/cliente-pedido-detail.js:174))
  — only the dashboard selects this field today.
- The items table uses the header **"Cor 1 / Cor 2"**
  ([cliente-pedido-detail.js:322-325](js/screens/cliente-pedido-detail.js:322))
  instead of **"Cores"** (naming — low-impact divergence).
  It also has a **"Preview"** column (color swatch) that the mockup
  does not have as its own column — possible extra component, low
  impact.
- "Atualizações do pedido"
  ([cliente-pedido-detail.js:376-398](js/screens/cliente-pedido-detail.js:376))
  covers the mockup's "Histórico" concept in an equivalent way
  (timeline with dot + connector, title, message, date) — only
  the section title naming diverges.

## 7. Tracking/Stepper/Timeline — detailed comparison

**Mockup** (client section of `Admin-Cliente-Acompanhamento B2B -
standalone.html`):
- Stepper with the same 8 stages (Recebido, Confirmado, Insumos,
  Tecelagem, Acabamento, Expedição, Transporte, Concluído).
- Each **completed** stage shows a **date** below the name (e.g.
  "25/06", "27/06", "03/07", "14/08"). The current stage shows the label "em
  andamento".
- Banner below the stepper with the current stage's message.
- The legend/taxonomy page of the same mockup (section "Taxonomia ·
  Chave de estados B2B") describes the 8 stages and the 4 exceptions
  (Aguardando definição, Aguardando insumo, Pausado, Cancelado) with the
  same semantics already implemented.

**Current implementation** (`js/screens/cliente-pedido-tracking.js` +
`js/pedido-tracking-ui.js`):
- **Taxonomy confirmed as aligned**: the 8 main stages
  (`recebido, confirmado, insumos, tecelagem, acabamento, expedicao,
  transporte, concluido`) and the 4 exceptions (`aguardando_definicao,
  aguardando_insumo, pausado, cancelado`) in
  `js/pedido-tracking-ui.js:4-20` correspond exactly to the mockup's
  stages and exceptions, including the treatment of "Cancelado" as a
  terminal exception that replaces the stepper with a warning (
  `buildCanceladoCard`,
  [cliente-pedido-tracking.js:161-177](js/screens/cliente-pedido-tracking.js:161)).
  This **is not a gap** — it is a compliance point that must be
  preserved in any future phase.
- The "em andamento" label under the current stage already exists too
  ([cliente-pedido-tracking.js:124-125](js/screens/cliente-pedido-tracking.js:124)),
  aligned with the mockup.
- **Real gap:** the stepper circles show only "OK" (completed),
  a number (future), or "!" (active exception) —
  ([cliente-pedido-tracking.js:99-114](js/screens/cliente-pedido-tracking.js:99))
  — **with no completion date per stage whatsoever**. There is, today, no
  structured data tying "stage X completed on date Y" — the
  `pedido_cliente_eventos` table has `criado_em` per event, but there is no
  logic mapping events to "the date each stage was
  completed". Implementing this would require deciding on a
  derivation rule (probably the first event whose `status` corresponds
  to the stage), which is a product decision, not just a visual one.
- The card banner shows a label + message + progress text ("Etapa
  N de M.") + update date
  ([cliente-pedido-tracking.js:133-159](js/screens/cliente-pedido-tracking.js:133)).
  The text "Etapa N de M" does not appear in the client's plain view in the
  mockup (it appears only in the **admin** panel preview of the same file)
  — possible extra component, but of low impact/questionable
  usefulness to remove.

## 8. Client Shell/Menu — detailed comparison

**Mockup** (sidebar/topbar present in all 5 files, identical
across them):
- "Inttex" brand + "Portal do cliente" subtitle at the top of the sidebar.
- Menu with **4 items**, each with an icon: Início, Meus pedidos, Novo
  pedido, Suporte.
- Sidebar footer with user card: role pill "Cliente" +
  e-mail (`cliente@sctp.com.br`) + "Sair" button with icon.

**Current implementation** (`js/screens/cliente-common.js` +
`js/screens/common.js`):
- `CLIENTE_MENU` has **only 2 items**: "Início" (`#/cliente/dashboard`)
  and "Meus pedidos" (`#/cliente/pedidos`)
  ([cliente-common.js:24-27](js/screens/cliente-common.js:24)). **No**
  "Novo pedido" and **no** "Suporte" in the menu (access to "Novo pedido"
  today only exists via a button inside the "Meus pedidos" screen; there is
  no "Suporte" screen or contact anywhere in the app).
- The shell itself (`shellLayout`,
  [common.js:39-63](js/screens/common.js:39)) is **literally shared
  between admin, fornecedor and cliente** — with no
  visual variation per role:
  - Fixed header with the text **"Controle de Tapetes"**
    ([common.js:43](js/screens/common.js:43)) — no "Inttex"/"Portal do
    cliente" brand.
  - User identification is just plain text `"Nome (tipo)"` +
    "Sair" button ([common.js:45-46](js/screens/common.js:45)) — no
    role pill, no sidebar footer card, no icons.
  - Sidebar is a flat list of text links, with no icons
    ([common.js:50-56](js/screens/common.js:50)).
- **Elevated risk for any fix here:** since the same
  `shellLayout`/`ADMIN_MENU` is used by admin and fornecedor
  (`js/screens/common.js`), any visual redesign of the client shell
  that touches the shared component also affects the
  admin/fornecedor screens. This was already recorded as a known pending
  item in `PROJECT_STATE.md` (phase `...-TRACKING-UI-A`): *"the
  broader visual redesign of the client shell [...] is deferred to a
  dedicated phase, only with explicit authorization from HMNlead, given the
  risk of also affecting the admin/fornecedor screens that share the same
  shellLayout"*. This inventory reaffirms that same caution.

## 9. Operational particulars to detail with the project owner

The items below **were not invented**: they are either already
documented in versioned schema/rules (cited with the source) or are
real open questions identified by the comparison. No new rule was
assumed.

- **Pickup/delivery type.** Already versioned in
  `db/15_status_cliente_visual.sql:56-57` and `:130-134`: the
  `pedidos.tipo_recebimento` column accepts exactly `retirada` or
  `entrega` (or `NULL`). The Novo Pedido mockup has a "Recebimento"
  field for this purpose. **TBD:** no current client screen captures
  or displays this field today — decide whether it goes into the
  creation form, as required or optional, and whether it appears in
  the detail/dashboard.
- **Review before finalizing the order (2-step checkout).** The Novo
  Pedido mockup has "Ir para checkout" + "Finalizar pedido" buttons;
  the current implementation has a single "Enviar pedido" button that
  already writes `status: 'recebido'` directly. **TBD:** there is no
  prior documentation defining whether a review/confirmation step
  should exist before final submission — a decision for the project
  owner.
- **Information the client should/should not see.** **Already
  documented** (not a TBD) in
  `docs/architecture/PORTAL_B2B_ARCHITECTURE_RULES.md` and reinforced
  by `tests/cliente-portal-visual.smoke.js`: never expose
  `service_role`, `token_acesso`, `metadata`, `criado_por`, `origem`,
  the internal `pedido_eventos` table, nor OP/batch/fornecedor/
  invoice/packing list/cost/margin. Any future visual-fix phase must
  preserve this rule and the existing tests that verify it.
- **Operational status shown alongside the visual status in Pedido
  Detail.** Identified in §6: the current screen shows both the
  published visual status (e.g. "Acabamento") and the raw operational
  status (e.g. "Confirmado", via `pedidoStatusBadge(p.status)`) on the
  same page. The mockup shows only one source of status. **TBD:**
  decide whether the operational status badge should remain visible
  to the client in the summary, or whether it should be removed from
  this screen, keeping only the visual status from the tracking card.
- **Required order fields.** Today only model and meters (> 0) are
  required in the creation form (`cliente-pedido-form.js:271-281`).
  **TBD:** whether "Referência do cliente" and/or "Recebimento" (if
  added) should be required or optional.
- **Rules for client-side edit/cancellation.** Today the client portal
  is **100% read-only, except for order creation** (confirmed in
  `PROJECT_STATE.md`) — there is no editing, cancellation, or any
  post-creation write action by the client, and no mockup analyzed
  shows these actions for the client. **TBD:** there is no documented
  decision on whether this will change in the future; no action
  should be assumed or implemented without explicit future
  authorization.
- **Final status naming.** The taxonomy of the 8 stages + 4 exceptions
  (stepper) **is already aligned** with the mockup (confirmed in §7)
  — it is not a TBD. What is TBD is the naming of the **dashboard
  KPIs** ("Em produção"/"Prontos para expedição"/"Atenção" in the
  mockup vs. "Em andamento"/"Prontos / concluídos"/"Atualizações
  recentes" today) — decide whether the KPI labels and segmentation
  should be aligned with the mockup or kept as they are.

## 10. Proposed next phases

Small packages, each isolated by screen/responsibility, following the
mandatory decomposition of
`docs/architecture/PORTAL_B2B_ARCHITECTURE_RULES.md`. None of these
packages is authorized to start by this document — each one needs its
own explicit authorization, in whatever order the project owner
chooses.

### `UI-GAP-FIX-DASHBOARD-A`
- **Objective:** visually align the Client Dashboard with the mockup
  — KPI labels/segmentation, featured-orders section (if the
  definition of "destaque" is approved), stage-distribution section,
  quick actions.
- **Files likely touched:** `js/screens/cliente-dashboard.js` (the
  only client file for this screen); possibly a new test
  `tests/cliente-dashboard.smoke.js` (already exists, would need
  extension).
- **Risk:** low — scope isolated to an already read-only client
  module.
- **Tests likely required:** `cliente-dashboard.smoke.js`, regression
  of `cliente-portal-visual.smoke.js` (anti-regression guard for
  SELECTs/security).
- **Dependencies:** project owner's decision on the definition of
  "pedidos em destaque" (§9 does not cover this explicitly — the
  criterion would need to be defined before implementing).

### `UI-GAP-FIX-NOVO-PEDIDO-A`
- **Objective:** add "Dados gerais" fields (client reference,
  receiving), reorganize items into a table with totals, and decide
  the 1- or 2-step (checkout) flow.
- **Files likely touched:** `js/screens/cliente-pedido-form.js`;
  the schema possibly already covers the fields (`referencia_cliente`,
  `tipo_recebimento` already exist in
  `db/15_status_cliente_visual.sql`), so it **should not** require new
  SQL, only capturing fields that already exist in the INSERT payload.
- **Risk:** medium — touches the only write point of the client
  portal (INSERT into `pedidos`/`pedido_itens`); requires care not to
  open new fields without validating against the existing RLS
  (`pedidos_cliente_insert`).
- **Tests likely required:** `tests/cliente-pedido-form.smoke.js`
  (existence to be confirmed/created), regression of
  `cliente-portal-visual.smoke.js`.
- **Dependencies:** decision on 1- or 2-step checkout (§9); depends on
  `UI-GAP-FIX-MODAL-ITEM-A` if the items table starts opening the
  modal instead of the current inline form.

### `UI-GAP-FIX-MODAL-ITEM-A`
- **Objective:** decide whether the add-item flow migrates from
  "linha inline" to "modal", and if that is approved, implement Cor
  1/Cor 2/Largura fields per item (already present when reading the
  detail, missing on write) and assess the feasibility of "referência
  visual" (image upload).
- **Files likely touched:** `js/screens/cliente-pedido-form.js` (or a
  new modal module, if the decision is for a reusable component);
  `js/ui.js` (if using the existing `window.modal`).
- **Risk:** medium — image upload would introduce a new surface (file
  storage) that does not exist today in any screen of the app;
  requires an explicit decision before any code.
- **Tests likely required:** a new smoke test dedicated to the
  modal/item component, regression of the creation form.
- **Dependencies:** project owner's decision on image upload (may fall
  outside this phase's scope if no bucket/Storage has been decided);
  depends on `UI-GAP-FIX-NOVO-PEDIDO-A` for the table context where
  the modal would be triggered.

### `UI-GAP-FIX-DETALHE-A`
- **Objective:** summary in 4 cards (items/meterage/last
  update/expected deadline), breadcrumb, decision on whether to
  display the operational status alongside the visual status,
  per-stage dates in the stepper (if approved), column-naming
  adjustment ("Cores").
- **Files likely touched:** `js/screens/cliente-pedido-detail.js`,
  possibly `js/screens/cliente-pedido-tracking.js` (if the per-stage
  dates are approved — would require new derivation logic from
  `pedido_cliente_eventos`).
- **Risk:** low for the summary/breadcrumb/naming (data already
  loaded or already in the schema); medium for the stepper's
  per-stage dates, since it depends on a derivation rule not yet
  defined.
- **Tests likely required:** `cliente-pedido-detail.smoke.js`,
  `cliente-pedido-tracking.smoke.js`, regression of
  `cliente-portal-visual.smoke.js`.
- **Dependencies:** decision on displaying the operational status
  (§9); decision on the per-stage date derivation rule before
  touching the stepper.

### `UI-GAP-FIX-SHELL-A`
- **Objective:** redesign the client sidebar/topbar (brand, role pill,
  user card, icons, "Novo pedido" and "Suporte" items in the menu).
- **Files likely touched:** `js/screens/cliente-common.js` at
  minimum; **possibly** `js/screens/common.js` (`shellLayout`), which
  would also affect admin and fornecedor.
- **Risk:** **high** — this is the only package in this list with
  risk of side effects outside the client portal, because of the
  shared `shellLayout`. A prior decision is needed: create a dedicated
  shell for the client (duplicating the structure, without touching
  `common.js`) versus parameterizing the existing `shellLayout` by
  role. Both approaches have trade-offs that must be decided before
  the code, not during.
- **Tests likely required:** full regression of `boot.smoke.js`,
  `cliente-routing.smoke.js`, and any smoke test that today assumes
  the current structure of `shellLayout`/`ADMIN_MENU`.
- **Dependencies:** extra explicit authorization given the cross-role
  risk; no other phase in this list depends on this one, but this one
  should be the **last** to run, precisely to isolate the risk.

### `UI-OPERATIONS-RULES-A`
- **Objective:** **docs-only** phase to resolve, with the project
  owner, the TBDs from §9 (receiving type required or not, 1- or
  2-step checkout, operational status visible or not in the detail,
  required fields, future edit/cancellation rules) **before** any of
  the UI phases above that depend on these decisions.
- **Files likely touched:** documentation only (`PROJECT_STATE.md`,
  possibly a new business-rules doc for the client portal).
- **Risk:** none (no code).
- **Tests:** none (docs-only phase).
- **Dependencies:** none — it can (and perhaps should) be the
  **first** phase to run, since `UI-GAP-FIX-NOVO-PEDIDO-A`,
  `UI-GAP-FIX-MODAL-ITEM-A`, and part of `UI-GAP-FIX-DETALHE-A`
  depend on decisions it would resolve first.

## 11. Final confirmations

- **No UI changes were implemented** in this phase.
- **No code (`js/**`), schema, SQL, Edge Function, or Supabase call
  was made or changed** in this phase.
- **Production remains blocked**; `origin/main` and
  `bhgifjrfagkzubpyqpew` were not touched.
- **No password, token, or credential was recorded** in this
  document.
- **The current UI is not declared final** — this document only
  records divergences for the project owner's future decision.
