# Documents Ingestor — Consumer Design for Controle de Tapetes

> **Phase:** `RAVATEX-TAPETES-G11-A-DOCUMENTS-CONSUMER-DESIGN` (docs-only)
> **Type:** Diagnosis + read-only consumption design.
> **Controle de Tapetes base HEAD:** `381506c` — `work/app-next`
> **Documents Ingestor base HEAD:** `956682d` — `master`
> **Date:** 2026-07-07
>
> **Current status (2026-07-09):** This design was **implemented** in G14 (Controle HEAD `fff052b`, Ingestor HEAD `bedbe909`).
> Consumption of the flat JSONL (`documentos-mapeados.jsonl`) occurs via the `RAVATEX_DOCUMENTS_RECEIVED` bridge → Pedido Detail,
> per the manual-import-without-polling decision. See `PROJECT_STATE.md` and `AGENT_HANDOFF.md` for the full G14 record.

---

## 1. Context

The Documents Ingestor (HEAD `956682d`) closed the export package in G10-C. Controle
de Tapetes (HEAD `381506c`) is a vanilla JS SPA with hash routing, no
framework, no npm, no Next.js, that manages Pedidos, Clientes, OPs, production.

The integration is **unidirectional**: Documents Ingestor produces events →
Controle de Tapetes consumes them. No direct coupling between the databases.

---

## 2. Diagnosis: Files read

### Controle de Tapetes

| File | Purpose | Finding |
|---------|-----------|--------|
| `js/screens/pedido-detail.js` | Pedido detail orchestrator | Creates state, coordinates data/progress/render/events. Route `#/pedidos/:uuid` |
| `js/screens/pedido-detail-data.js` | Supabase loading | `pedido.numero` is a sequential int. `pedido.criado_em` has the year. |
| `js/screens/pedido-detail-progress.js` | computeViewModel | `documentRowsPedido` and `documentRowsOperacionais` with hardcoded placeholders |
| `js/screens/pedido-detail-render.js` | DOM render | `buildDocuments()` card (line 994) shows Pedido documents + operational ones. `buildDocumentRow()` + `buildDocumentStatusPill()` |
| `js/screens/pedido-detail-events.js` | Handlers/modals | `buildHistoryBlock()` with vertical timeline. `Documentos esperados` in the transition modal |
| `js/ui.js` | UI primitives | `el()`, `modal()`, `toast()`, `dataTable()` |
| `js/pedido-ui.js` | Pedido helpers | `pedidoStatusBadge()`, `pedidoStatusLabel()` |
| `js/badges.js` | OP badges | Colored-pill pattern |
| `js/op-display.js` | Operational code | Format `OP {pedido.numero}/{ano}-{letra}{seq}` |
| `js/screens/cliente-pedido-detail.js` | Pedido detail (Cliente) | Vertical timeline with dots. `buildEventoItem()` |
| `docs/architecture/PEDIDO_OP_MOVIMENTACAO_DOCUMENTOS_PLANO.md` | Architectural plan | §2.5 Documents: Google Drive as storage, metadata in the database. §4.2 Pedido Admin as the central index |
| `docs/architecture/PEDIDO_OP_SCHEMA_CONTRACT.md` | Schema contract | §4 future `documentos_operacionais`. No existing schema |
| `PROJECT_STATE.md` | Project state | Last phase: Pedido/OP Controlled Delete. No mention of Documents Ingestor |
| `AGENT_HANDOFF.md` | Handoff | Recommended next step: does not mention document consumption |

### Documents Ingestor

| File | Purpose | Finding |
|---------|-----------|--------|
| `docs/CONTROL_TAPETES_DOCUMENTS_CONTRACT.md` | Integration contract | 12 minimum fields for the UI. Canonical `ingestion_event_id`. `drive_web_view_link` opens a new tab |
| `contracts/document-event.schema.json` | Event schema | Legacy V1, V2 with 3-axis taxonomy. `pedido_manual` = `PED-XX-YYYY` |
| `contracts/examples/document-events.sample.jsonl` | 4 sample events | detected → linked → accepted/rejected |
| `docs/architecture/G10_CONTROLE_TAPETES_INTEGRATION_DESIGN.md` | Integration design | Watch outbox + pull commands. Proposed UI: list + badges + drive link. No Supabase |
| `PROJECT_STATE.md` | State | G10-C complete. 264 tests. Next phase: G11 watcher |
| `AGENT_HANDOFF.md` | Handoff | Next phase in the Controle de Tapetes repository |

---

## 3. Answers to the required questions

### A) Where to display documents in Controle de Tapetes?

1. **Is there a Pedido detail screen?** Yes — `#/pedidos/:uuid` rendered by
   `pedido-detail.js` → `pedido-detail-render.js`. It is the most complex screen, with
   header, stepper, items, OPs, expedições, summary, customer evolution, and
   **Documentos** (existing card).

2. **Is there a modal/tab/section for documents?** Yes — the card `buildDocuments()` at the
   end of the Pedido detail (line 994-1031) already shows "Documentos do Pedido"
   and "Documentos Operacionais" with placeholders. There is also "Documentos esperados"
   inside the transition modal (line 2176-2192).

3. **Is there a timeline/history?** Yes — `buildHistoryBlock()` in
   `pedido-detail-events.js` and `buildEventoItem()` in `cliente-pedido-detail.js`
   with dot + vertical line.

4. **Best location:**
   - **Existing "Documentos" card in the Pedido detail** — already consolidated,
     positioned in a 2-col grid next to the customer evolution. Replace
     placeholders with real data from the Ingestor.
   - Event timeline inside the same card or below as a separate section.

5. **Smallest safe spot for G11-B:** The `buildDocuments()` card already exists and
   accepts `view.documentRowsPedido` + `view.documentRowsOperacionais`. Add a
   new "Documentos do Ingestor" section inside the same card, or create a new card
   "Documentos Recebidos" below. **Recommendation:** new section inside the
   existing "Documentos" card — minimal render change.

### B) How to map Pedido?

1. **Controle de Tapetes uses a sequential number:** `pedido.numero` = int (e.g.: 25)
   with no year in the format. Display: `#25` via `fmtNumero()`. Year extracted from
   `pedido.criado_em`.

2. **Canonical identifier:** Pedido UUID (`pedidos.id`). The number is for
   human display.

3. **Mapping to `PED-XX-YYYY`:**
   ```
   pedido_manual = "PED-" + String(pedido.numero).padStart(2, "0") + "-" + ano
   ano = new Date(pedido.criado_em).getFullYear()
   ```

4. **Conflict risk:** The Ingestor uses `pedido_manual` typed manually
   by the operator. If the operator gets the number or year wrong, the link will be
   incorrect. **Mitigation:** Controle de Tapetes must derive the
   `pedido_manual` from the canonical data (numero + criado_em) and filter
   events only for that pattern. It must not accept an arbitrary `pedido_manual`.

5. **Mapping table:** Not necessary initially. Simple normalization
   `PED-{numero}-{ano}` suffices. If there are conflicts (pedidos with the same number in
   different years), the year disambiguates.

### C) How to consume data?

| Option | Cost | Risk | Likely files | Schema needed? | Phase |
|-------|-------|-------|-------------------|-------------------|------|
| **1. Manual import of the package generated by `export:package`** | Very low — JSONL already exists | Minimal — local file, no network | `js/documents-ingestor.js` (parser), `.jsonl` fixture | No | **G11-B** |
| 2. Reading a local JSONL in a configurable folder | Low | Low — configurable path | `js/documents-ingestor.js`, `config.js` | No | G11-B+ |
| 3. Future outbox watcher | Medium | Medium — polling | Dedicated watcher | No | Deferred |
| 4. Pull via external command | Medium | Low | `exec` or wrapper | No | Deferred |
| 5. Supabase/Postgres as an index | **High** | **High** — direct coupling | SQL schema, migrations | Yes | **Rejected** |

**G11-B recommendation:** Option 1. Controle de Tapetes loads a JSONL of
events generated by `export:package --pedido <PED-XX-YYYY>`. No network coupling,
no watcher, no new schema.

### D) Local state in Controle de Tapetes

1. **Does the app need to persist imported events?** Not strictly. It can read
   the package into memory on every screen load.

2. **Can it read the package into memory?** Yes — the package is small (tens of KB),
   load it via a local `fetch` on every render of the Pedido detail.

3. **Does it need a local cache?** Optional — `sessionStorage` or the global variable
   `window.RAVATEX_DOCUMENTS_CACHE` avoid re-reading within the same load.

4. **If it persists, where?** `localStorage` or a JSON file in `.ravatex-local/`.
   Do not use Supabase.

5. **How to guarantee idempotency by `ingestion_event_id`?** When processing
   events, use `Map<ingestion_event_id, event>`. Ignore duplicates.
   Sort by `created_at` ascending.

6. **How to consolidate state by `document_id`?** For each `document_id`,
   keep the most recent event (highest `created_at`). The `status` of the most
   recent event is the document's current state.

### E) Minimal UI

Definition of the minimal UI for G11-B:

```
┌────────────────────────────────────────┐
│ Documentos                             │
│                                        │
│ DOCUMENTOS DO PEDIDO (INGESTOR)        │
│                                        │
│ 📄 NF 25/2026 - entrada.xml · XML·Entrada │ [Aceito] │ [Ver]
│ 📄 NF 25/2026 - saida.pdf   · PDF·Saída  │ [Pendente] │ [Ver]
│ 📄 Romaneio - romaneio.pdf   · PDF       │ [Rejeitado - duplicado] │ [Ver]
│                                        │
│ EVENTOS                                │
│  ● 07/07 12:20 - Documento aceito      │
│  │                                     │
│  ● 07/07 12:10 - Documento vinculado   │
│  │                                     │
│  ● 07/07 12:00 - Documento detectado   │
│                                        │
│ DOCUMENTOS DO PEDIDO (legado)          │
│ ... (placeholders existentes)          │
└────────────────────────────────────────┘
```

- **Badges:** type (NF/romaneio), format (XML/PDF), direction (Entrada/Saída),
  status (Aceito/Pendente/Rejeitado)
- **"Ver" button:** opens `drive_web_view_link` in `window.open()` new tab
- **Reason:** display next to badges when `rejected`
- **Timeline:** dots + vertical lines, pattern already used in the app

### F) Security/privacy

1. Do not display full `document_id`, `ingestion_event_id`, or `sha256` in the UI
2. Do not store PDF/XML in Supabase or the backend
3. Do not download the file — use `drive_web_view_link`
4. Do not open an iframe — `window.open()` in a new tab
5. Document in the contract: Google Drive permission is an operational
   prerequisite (users need access to the shared folder)

### G) Next G11-B patch

**Smallest safe patch in Controle de Tapetes:**

1. Create `js/documents-ingestor.js` with:
   - `parseDocumentEvents(jsonlText)` — JSONL parser
   - `filterEventsByPedido(events, pedidoNumero, ano)` — filters by `pedido_manual`
   - `consolidateDocumentState(events)` — Map<document_id, most recent event>
   - `buildIngestorDocumentRows(docs)` — prepares data for the render
   - Namespace: `window.RAVATEX_DOCUMENTS`

2. Create fixture `data/fixtures/document-events-sample.jsonl` (copy of the
   Ingestor sample)

3. Modify `pedido-detail-progress.js`:
   - `computeViewModel()` now calls `window.RAVATEX_DOCUMENTS`
     to get `ingestorDocumentRows` when available

4. Modify `pedido-detail-render.js`:
   - `buildDocuments()` now includes a "Documentos Recebidos" section
     with data from the Ingestor, keeping the legacy placeholders

5. Tests:
   - `tests/documents-ingestor.test.js` — parser, filter, consolidation
   - `tests/pedido-detail.smoke.js` — update snapshot if necessary
   (155 current tests)

**Not to do in G11-B:**
- Do not create a watcher
- Do not touch Supabase
- Do not change the schema
- Do not modify Documents Ingestor
- Do not implement accept/reject in Controle de Tapetes (accept/reject
  remains in the Ingestor)

---

## 4. Decision matrix

| Topic | Evidence in code | Decision | Risk | Minimal patch | Tests required | Phase |
|------|--------------------|---------|-------|-------------|-------------------|------|
| UI location | `pedido-detail-render.js:994` card `buildDocuments()` exists | Existing "Documentos" card receives a new "Documentos Recebidos" section | Very low | Render: add section to the card | Pedido-detail smoke | G11-B |
| Pedido mapping | `pedido.numero` int + `criado_em` year | `PED-{numeroPad2}-{ano}` | Low — operator can mistype it in the Ingestor | Formatting helper + filter | Mapper unit test | G11-B |
| Data consumption | Functional export package (`export:package --pedido`) | Manual import of local JSONL (Option 1) | Minimal — local file, no network | JSONL parser + loader | Unit test for parser + filter + consolidation | G11-B |
| Local state | App uses global `window` + direct Supabase | Cache in `window.RAVATEX_DOCUMENTS_CACHE` | Low | Global variable + optional sessionStorage | Idempotency test | G11-B |
| Idempotency | Contract §6: canonical `ingestion_event_id` | Map by `ingestion_event_id`, sorted by `created_at` | None | Logic in the consolidator | Unit test with duplicate events | G11-B |
| Viewing | Contract §2.3: `drive_web_view_link` | "Ver" button → `window.open(link, '_blank')` | None — Drive link | Button in the render | Link test (without opening) | G11-B |
| Event timeline | `pedido-detail-events.js:2171` `buildHistoryBlock()` | "Eventos" section with dots + lines | Very low | Timeline block reusing the existing pattern | Visual smoke | G11-B deferred |
| Supabase as an index | Contract §9: no Supabase | **Rejected** | High — direct coupling | Do not do | N/A | — |
| Continuous watcher | G10 design: watch deferred | Deferred to G11-C | Medium — new infra | Do not do | N/A | G11-C |
| Accept/reject in the app | Operational funnel in the Ingestor | Deferred — remains in the Ingestor CLI | Medium — state duplication | Do not do | N/A | Future |
| Modify Documents Ingestor | HEAD 956682d closed | Do not modify | None — contract closed | Do not do | N/A | — |

---

## 5. Ready-to-issue order for G11-B (next IAExecutor)

```
FASE: RAVATEX-TAPETES-G11-B-DOCUMENTS-CONSUMER-PATCH
Agente: DeepSeek Pro (3+ arquivos funcionais)
HEAD base Controle de Tapetes: 381506c (work/app-next)
HEAD base Documents Ingestor: 956682d (master, não alterar)

Escopo:
1. js/documents-ingestor.js (novo)
   - parseDocumentEvents(jsonlText)
   - filterEventsByPedido(events, pedidoNumero, ano)
   - consolidateDocumentState(events)
   - buildIngestorDocumentRows(docs)
   - Namespace: window.RAVATEX_DOCUMENTS

2. data/fixtures/document-events-sample.jsonl (novo)
   - Cópia do sample do Ingestor + adaptação para pedido real

3. js/screens/pedido-detail-progress.js (modificar)
   - computeViewModel() adiciona ingestorDocumentRows ao view

4. js/screens/pedido-detail-render.js (modificar)
   - buildDocuments() inclui seção "Documentos Recebidos" com:
     * Badges: tipo (NF/Romaneio) + formato (XML/PDF) + direção (Entrada/Saída)
     * Status: Aceito (verde) / Pendente (âmbar) / Rejeitado (vermelho + reason)
     * Botão "Ver" → window.open(drive_web_view_link, '_blank')
     * Timeline de eventos abaixo dos documentos

5. tests/documents-ingestor.test.js (novo)
   - parseDocumentEvents com JSONL válido, vazio, malformado
   - filterEventsByPedido com match e não-match
   - consolidateDocumentState com eventos duplicados e fora de ordem

6. tests/pedido-detail.smoke.js (atualizar)
   - Verificar que 155+ testes continuam passando

Não fazer:
- Não tocar Supabase
- Não alterar Documents Ingestor
- Não criar watcher
- Não implementar accept/reject no app
- Não criar schema novo
- Não executar migrations
- Não chamar Google/Drive real (links mockados na fixture)
- Não fazer push para origin

Testes obrigatórios antes do commit:
node --test tests/documents-ingestor.test.js
node --test tests/pedido-detail.smoke.js
node --check js/documents-ingestor.js
```

---

## 6. Risks

| Risk | Severity | Mitigation |
|-------|-----------|-----------|
| Operator types the wrong `pedido_manual` in the Ingestor | Medium | App derives `PED-{numero}-{ano}` canonically; does not accept an arbitrary pedido_manual |
| JSONL file not found | Low | Treat as "Nenhum documento importado" — do not break the screen |
| Pedido number > 99 breaks the `PED-XX` format | Low | If it occurs, expand padding or adjust the mapping; Ingestor contracts accept `\d{2,}` |
| Two pedidos with the same number in different years | Very low | Year disambiguates in the `pedido_manual` |
| Local cache out of sync | Low | Always reread the JSONL; cache is intra-session only |

---

## 7. Confirmations

- [x] No Supabase was touched
- [x] No Google/Drive call was made
- [x] No real export was executed
- [x] Controle de Tapetes received no functional patch
- [x] Documents Ingestor was not modified
- [x] No real data was committed
- [x] 100% read-only reading in both projects
- [x] Design documents consumption by `ingestion_event_id`
- [x] Viewing uses `drive_web_view_link`
- [x] No PDF/XML stored in Supabase/backend

---

> **This document is the formal output of G11-A.**
> It must be consulted before G11-B and updated at the end of each phase.
