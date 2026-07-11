# G9 — Google Drive Manifest Sync Design

## Contexto
- Manifest Drive é criado apenas por `realAssign.ts` (Drive move + upload)
- Link/accept/reject são local-only (SQLite + outbox) e não tocam manifest
- G8-E documentou outbox como contrato de integração; manifest é snapshot derivado
- Visualização Drive via `drive_web_view_link` já funciona independente de manifest

## A) Manifest atual

| Pergunta | Resposta | Evidência |
|---|---|---|
| Onde é criado? | `realAssign.ts:106-132` — uploadManifest no Drive + addDocumentToManifest local | |
| Formato/campos | `Manifest` v1: pedido, created_at, updated_at, storage_backend, manifest_storage_uri, manifest_drive_file_id, documents[] | `manifest.ts:28-40` |
| Campos de documentos | document_id, tipo_documento, formato, direcao_nf, filename, sha256, storage_uri, drive_file_id, drive_fields, local_cache_path, ingested_at, event_id, status | `manifest.ts:5-26` |
| Salvo no Drive? | Sim (`drive.ts:202-265`: upload/update) | |
| Salvo local? | Sim, mas em `/dev/null` (`realAssign.ts:117` — placeholder) | |
| Atualizado quando? | Apenas no assign real | `realAssign.ts` |
| Contém status? | Sim: `pending_app_acceptance` | `realAssign.ts:131` |
| Existem testes? | `tests/manifest.test.ts` (5 testes — loadManifest/saveManifest/addDocumentToManifest) | |

## B) Assign real vs link local-only

| Comportamento | assign real | link local-only |
|---|---|---|
| Status exigido | `pending` | `pending` |
| Status final | `assigned` | `assigned` |
| Drive move/copy | Sim | Não |
| Manifest Drive | Sim (upload) | Não |
| Evento outbox | `document.detected` | `document.linked` |
| Documento já linked | **Bloqueado** (status !== pending) | Bloqueado (já assigned) |
| Documento já accepted | Bloqueado | Bloqueado |

**Conclusão:** assign real e link são rotas alternativas exclusivas. Não há comando para "promover" linked para Drive.

## C) Fonte de verdade

| Dado | Fonte primária | Fonte derivada |
|---|---|---|
| Estado operacional do documento (status, pedido, taxonomy) | **SQLite** | Nenhuma |
| Eventos/histórico | **Outbox JSONL** | Manifest (snapshot) |
| Arquivo físico | **Google Drive** | SQLite armazena metadata (drive_file_id) |
| Links de visualização | **SQLite** (drive_web_view_link) | Outbox (eventos) |
| Manifest Drive | **Assign real** (snapshot) | Deveria refletir SQLite para assigned/accepted/rejected |

**Decisão:** SQLite + outbox são fontes canônicas. Manifest é snapshot derivado que deve ser sincronizável.

## D) Opções para G9-B

### Opção 1 — Nenhuma alteração
- **Vantagens:** zero esforço, zero risco
- **Riscos:** manifest Drive desatualizado indefinidamente; linked/accepted/rejected invisíveis no Drive
- **Arquivos:** nenhum
- **Testes:** nenhum
- **Drive real:** não
- **Veredito:** não atende — linked/accepted/rejected ficam orfãos

### Opção 2 — Manifest local exportável
- **Descrição:** `npm run export:manifest -- --pedido PED-99-2026` gera manifest JSON a partir do SQLite (read-only)
- **Vantagens:** zero risco de tocar Drive; útil para debug/snapshot
- **Riscos:** baixo — só texto local
- **Arquivos:** `src/core/manifest.ts`, `src/cli.ts`, `tests/manifest.test.ts`
- **Testes:** 3-4 (gera manifest, contém documentos linked/accepted/rejected, idempotente)
- **Drive real:** não
- **Veredito:** útil como complemento, mas não resolve o gap principal

### Opção 3 — Sync manifest Drive (recomendado)
- **Descrição:** `npm run sync:manifest -- --pedido PED-99-2026 --confirm-real-google` lê SQLite, constrói manifest consolidado, faz upload/update no Drive
- **Vantagens:** manifest Drive reflete estado real; sem mover arquivos; sem alterar status
- **Riscos:** exige token Google/Drive válido; pode tocar Drive acidentalmente sem `--confirm-real-google`
- **Proteções:**
  - Exige `--confirm-real-google` (padrão dry-run)
  - Não altera `documentos.status` (read-only do SQLite)
  - Não move arquivos no Drive
  - Apenas atualiza manifest.json na pasta do pedido
- **Arquivos:** `src/core/syncManifest.ts` (novo), `src/cli.ts`, `src/connectors/drive.ts` (reuse uploadManifest), `src/index.ts`, `tests/sync-manifest.test.ts`
- **Testes:** 5-6 (dry-run, real, accepted, rejected, múltiplos documentos, idempotente)
- **Drive real:** sim — `--confirm-real-google` executa upload Drive
- **Veredito:** abordagem mais segura e útil

### Opção 4 — Revisar assign real para linked
- **Descrição:** relaxar `if (doc.status !== 'pending')` para aceitar `assigned` (linked)
- **Vantagens:** linked → Drive em um comando
- **Riscos:** quebra semântica de rotas; accepted poderia ser re-assigned sem proteção; risco de misturar fluxos
- **Arquivos:** `src/core/realAssign.ts`
- **Testes:** 5-6
- **Drive real:** sim
- **Veredito:** não recomendado — confunde as rotas e pode levar a perda de estado

## E) Impacto para Controle de Tapetes

- O pacote G8-E (outbox + exemplos JSONL) é **suficiente** para consumo inicial
- Manifest agregaria valor secundário (snapshot de pedido completo)
- O Controle de Tapetes deve consumir:
  1. **Outbox JSONL** — fonte primária de eventos
  2. **Manifest** (opcional) — snapshot para carregamento inicial
  3. **Drive links** — para visualização
- Fonte canônica: **outbox**. Manifest é derivado e opcional.

## F) Segurança operacional

- `sync:manifest` deve ser dry-run por padrão (sem `--confirm-real-google`)
- `--confirm-real-google` obrigatório para tocar Drive
- Não altera SQLite — apenas lê
- Não move arquivos
- Não altera status operacional
- Documento teste real-lite para G8-D já validou que SQLite/outbox refletem estado correto

## Matriz de decisão

| Opção | Veredito | Risco | Patch G9-B? | Testes | Drive real |
|---|---|---|---|---|---|
| 1 — Nenhuma | Não atende | Linked/rejected invisíveis no Drive | NÃO | — | — |
| 2 — Manifest local | Complemento útil | Baixo | SIM (opcional) | 3-4 | Não |
| 3 — Sync manifest Drive | **Recomendado** | Médio (dry-run protege) | **SIM** | 5-6 | Sim |
| 4 — Revisar assign real | Não recomendado | Alto (mistura rotas) | NÃO | — | Sim |

## Recomendação para G9-B

**RAVATEX-DOC-INGESTOR-G9-B-MANIFEST-LOCAL-AND-SYNC**

Implementar opção 3 (sync:manifest Drive) + opção 2 (export manifest local) como complemento gratuito.

**Ordem pronta:**

```
FASE: RAVATEX-DOC-INGESTOR-G9-B-MANIFEST-LOCAL-AND-SYNC
Agente: DeepSeek Pro
HEAD base: (G9-A commit)

Escopo:
  1. src/core/manifest.ts: add buildManifestFromDb(pedido) que consulta SQLite
     e retorna Manifest completo com todos os documentos (pending/assigned/accepted/rejected)
  2. src/cli.ts: add command "export:manifest" (local-only, read-only SQLite)
     --pedido <PED-XX-YYYY> (required)
  3. src/cli.ts: add command "sync:manifest" (Drive upload)
     --pedido <PED-XX-YYYY> (required)
     --confirm-real-google (required for Drive upload, default dry-run)
  4. src/core/syncManifest.ts: build + upload manifest to Drive
     - read-only do SQLite
     - não altera documentos
     - não move arquivos
     - chama uploadManifest em drive.ts
  5. Tests: tests/manifest-sync.test.ts
     - export:manifest local gera JSON válido
     - sync:manifest dry-run não chama Drive
     - sync:manifest com mock Drive faz upload
     - manifest contém linked/accepted/rejected docs
     - manifest não altera SQLite
  6. npm.cmd run link/accept/reject/link continuam passando
  7. Atualizar PROJECT_STATE.md e AGENT_HANDOFF.md

Não fazer:
  - Não alterar assign real
  - Não mover arquivos Drive
  - Não alterar schema SQLite
  - Não alterar outbox
  - Não alterar event_id

Testes obrigatórios:
  - npm.cmd test (≥270 passando)
  - git diff --check

Critério de aceite:
  - export:manifest local gera manifest JSON sem chamar Drive
  - sync:manifest dry-run não chama Google
  - sync:manifest com --confirm-real-google atualiza manifest Drive
  - Manifest contém linked/accepted/rejected (não só assign)
  - Nenhum arquivo real é movido
  - Nenhum status operacional é alterado
```
