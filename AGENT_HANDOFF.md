# AGENT HANDOFF

## Branch/HEAD/Status
### documentos-ingestor (este repositório)
- Branch: master
- HEAD: `7affcfe` — G12-C1: scan emite document.detected, assign emite document.linked (sem schema novo)

### Controle de Tapetes (staging/work/app-next)
- HEAD canônico: `997486a`

## Fase concluída
RAVATEX-DOCUMENTS-G12-C1-DETECTED-EVENT-ON-SCAN-PATCH

## Fase anterior
G12-B — Folder taxonomy paths (Recebidos/Pedidos com YYYY/MM/DD)

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
