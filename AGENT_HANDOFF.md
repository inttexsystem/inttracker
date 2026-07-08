# AGENT HANDOFF

## Branch/HEAD/Status
### documentos-ingestor (este repositório)
- Branch: master
- HEAD: `7affcfe` — G12-C1: scan emite document.detected, assign emite document.linked (sem schema novo)

### Controle de Tapetes (staging/work/app-next)
- HEAD canônico: `997486a`

## Fase concluída
RAVATEX-DOCUMENTS-G12-D1-RECEIVED-DOCUMENTS-EXPORT

## Fase anterior
G12-C1 — Evento document.detected no scan (sem schema novo)

## Objetivo da fase G12-C1
Emitir evento `document.detected` no scan para documento recebido ainda não atrelado a Pedido. Corrigir semântica do assign real de `document.detected` para `document.linked`.

### Patch aplicado

**src/types/event.ts:**
- `createDocumentEvent` aceita novo parâmetro opcional `eventType` (default `'document.detected'`)

**src/core/realScan.ts:**
- Após INSERT de novo documento pending, emite evento `document.detected` com `pedido_manual=''`
- Insere em `ingestion_events` e `appendEvent` no outbox JSONL
- Dedup natural pelo scan existente (isDuplicate + findExistingBySha256) — retry não duplica

**src/core/realAssign.ts:**
- `event_type` mudou de `'document.detected'` para `'document.linked'`
- Payload mantém todos os campos: storage_uri, drive_file_id, manifest_storage_uri, etc.
- Semanticamente alinhado com `link.ts`

### Formato do evento document.detected no scan
```json
{
  "schema_version": 1,
  "event_type": "document.detected",
  "event_id": "<uuid>",
  "created_at": "<iso>",
  "pedido_manual": "",
  "source": "gmail",
  "gmail_message_id": "<msgId>",
  "thread_id": "<threadId>",
  "document": {
    "document_id": "<uuid>",
    "tipo_documento": "nf",
    "filename_original": "NF-12345.pdf",
    "sha256": "<sha256>",
    "storage_backend": "google_drive",
    "storage_uri": "gdrive://file/<id>",
    "drive_file_id": "<id>",
    "drive_folder_id": "<id>",
    "drive_web_view_link": "https://...",
    "drive_web_content_link": "https://...",
    "formato": "pdf",
    "direcao_nf": "entrada"
  },
  "status": "pending_app_acceptance"
}
```

### Garantias
- Nenhum schema/migration
- Nenhum Drive real chamado
- Nenhum scan real executado
- Nenhum export real executado
- Nenhum arquivo real movido
- SQLite/schema não alterado
- Manifest não alterado
- Export package por Pedido continua excluindo eventos com `pedido_manual=''`
- Controle de Tapetes não tocado
- Credenciais não tocadas

### Testes
- `tests/scan.test.ts`: 25 testes (+3 G12-C1: detected event, dedup, cross-msg)
- `tests/outbox.test.ts`: 5 testes (+2 G12-C1: pedido_manual='', eventType param)
- `tests/assign-real.test.ts`: 8 testes (event_type assertions updated)
- `tests/export-package.test.ts`: 9 testes (+1 G12-C1: exclusão eventos sem pedido)
- `tests/integration-mock-flow.test.ts`: 3 testes (counts updated for 2 events)
- 318 testes totais passando (26 suites)

### Próxima fase recomendada
RAVATEX-DOCUMENTS-G12-D-EXPORT-GLOBAL-RECEIVED
Foco: criar export global de documentos recebidos (`documentos-recebidos.jsonl`) filtrando por `pedido_manual=''`, sem alterar Controle de Tapetes.

---

## Fase G12-D1: Received Documents Export (patch pequeno)

### Objetivo
Exportar documentos ainda não atrelados a Pedido para JSONL (`documentos-recebidos.jsonl`), sem mutar DB, sem Drive, sem schema, sem scan real.

### Patch aplicado (a partir de `ac9cb15`)

**src/core/exportPackage.ts:**
- `listReceivedDocuments({ daysBack?, limit? })` — consulta `documentos` com `status='pending' AND (pedido_manual IS NULL OR pedido_manual='')`, INNER JOIN com subquery de `ingestion_events` filtrada por `event_type='document.detected'`
- `exportReceivedDocuments({ outputPath?, daysBack?, limit? })` — gera JSONL; default `data/exports/documentos-recebidos.jsonl`
- Idempotente: não altera DB, não marca `exported_at`, não escreve no outbox

**src/index.ts:**
- Re-exporta `exportReceivedDocuments`, `listReceivedDocuments` e tipos `ExportReceivedResult`, `ExportReceivedOptions`, `ReceivedDocumentRow`

**src/cli.ts:**
- Novo comando `export-received` com flags `--output`, `--days`, `--limit` (cap 5000)
- Sem `--confirm-real-google` — operação é inerentemente read-only

**tests/export-received.test.ts (novo, 9 testes):**
- Exporta pending sem pedido_manual com detected event
- Exclui documentos já linkados (assigned)
- Exclui documentos com `pedido_manual` preenchido
- Exclui documentos sem evento `document.detected`
- Respeita `--limit`
- Idempotência (DB, outbox, eventos intactos)
- `listReceivedDocuments` consistente com export
- Filtro `--days` (documentos antigos excluídos)
- Documentos aceitos (status no longer pending) excluídos

### Garantias
- Nenhuma chamada Google/Drive
- Nenhum scan real
- Nenhum export real externo
- SQLite/schema.sql não alterado
- `exportPackage()` existente inalterado
- `outbox.ts`, `link.ts`, `queries.ts` não alterados
- Controle de Tapetes não tocado
- 327 testes totais passando (27 suites) — 9 novos, 0 quebrados

### Critério de export (3 condições)
1. `documentos.status = 'pending'`
2. `documentos.pedido_manual IS NULL OR documentos.pedido_manual = ''`
3. EXISTS evento `document.detected` em `ingestion_events` para esse documento

A consulta parte do estado atual do documento (não do evento), protegendo contra o risco de exportar como "não atrelado" um documento que já foi linkado depois.

### Riscos remanescentes
- Nenhum no fluxo read-only. A única ressalva é que o consumidor (Controle de Tapetes) deve dedupar por `document_id` se rodar o export múltiplas vezes — não há marca `exported_at`.

### Próxima fase recomendada
RAVATEX-DOCUMENTS-G12-D2-RECEIVED-DOCUMENTS-CONSUMER
Foco: opcionalmente integrar `documentos-recebidos.jsonl` no Controle de Tapetes para exibir a fila de documentos pendentes de atrelamento (read-only, mesmo contrato JSONL).
