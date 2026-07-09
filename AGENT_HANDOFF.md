# AGENT HANDOFF

## Branch/HEAD/Status
### documentos-ingestor (este repositório)
- Branch: master
- HEAD: `4346275` (G17-B fechado — `ingestion_event_id` no mapped export)

### Controle de Tapetes (staging/work/app-next)
- HEAD canônico: `fff052b` (G14-D fechado — consumidor bridge flat pronto)

## Fase concluída
RAVATEX-DOCUMENTS-G17-B-INGESTION-EVENT-ID-EXPORT-PATCH — `ingestion_event_id` adicionado ao mapped export

## Fase anterior
G17-A — Ingestion Event ID Export Design (read-only)

## Objetivo da fase G13-B
Implementar comando único local `npm run sync:mapped` que orquestra `scan → export mapped → report` em sequência. Dry-run por padrão. Guards rígidos para `--retry-message` (forçar `days=1` quando não fornecido; falhar com `days > 1`, `--wide-scan` ou `--query`).

### Patch aplicado

**`src/core/syncMapped.ts` (novo, 112 linhas):**
- Orquestrador puro com DI: `runSyncMapped(opts, deps)`.
- `validateSyncMappedOptions(opts)`: retorna `{ ok, reason?, resolvedDaysBack? }`.
- `buildScanOptions(opts)`: monta `ScanGmailOptions` para `scanGmail()`.
- `buildExportOptions(opts)`: monta `ExportMappedOptions` para `exportMappedDocuments()`.
- Regras de retry-message:
  - sem `--days`: `resolvedDaysBack = 1`
  - com `--days > 1`: rejeita com mensagem clara
  - com `--wide-scan`: rejeita
  - com `--query`: rejeita
- Retorna `SyncMappedResult { scan, export, report, sequence: ['scan','export','report'] }`.

**`src/cli.ts` (comando `sync-mapped`, +~140 linhas):**
- Opções: `--days`, `--max-attachments`, `--wide-scan`, `--confirm-real-google`, `--query`, `--retry-message`, `--status`, `--export-days`, `--limit`, `--output`, `--json-report`.
- Valida dias (1-30, >7 exige `--wide-scan`).
- Detecta se `--days` foi explicitamente fornecido via `process.argv` (necessário para retry sem --days usar 1 em vez do config default 7).
- Replica guards de retry-message vindos do orquestrador.
- Banner: dry-run por padrão, real mode com `--confirm-real-google`.
- Passos: 1/3 scan, 2/3 export, 3/3 report (com `--json-report` opcional).
- Mensagem final: `DONE in <ms>ms — sequence: scan → export → report`.

**`package.json` (+1 script):**
- `"sync:mapped": "tsx src/cli.ts sync-mapped"`.

**`tests/sync-mapped.test.ts` (novo, 23 testes, 5 describe blocks):**
- `validation` (7): retry sem days → days=1; retry+days=1 ok; retry+days>1 fail; retry+wide-scan fail; retry+query fail; wide-scan alone ok; plain run ok.
- `buildScanOptions` (3): propagação de days/query/maxAttachments/confirmReal; retry forces days=1.
- `buildExportOptions` (2): mapeamento de days/limit/status/output; omissão quando undefined.
- `runSyncMapped` (8): ordem scan→export→report; dry-run default; confirm-real propaga; retry+days>1 throws; retry+wide-scan throws; retry+query throws; envelope result; package.json wiring.
- `end-to-end hermetic` (2): write real de `documentos-mapeados.jsonl` com 1 doc seedado (asserts: existsSync, totalDocuments=1, schema_version=1, document_id, status); report computa contagens corretas (2 docs seedados).

### Garantias
- Nenhuma migration / schema alterado.
- Nenhuma chamada Gmail/Drive real sem `--confirm-real-google`.
- Nenhum push, nenhum `git reset/rebase/stash/clean`, nenhum `git add .`.
- Backup local preservado.
- Controle de Tapetes não tocado.
- Credenciais não tocadas.
- Sem scheduler, daemon ou watcher.

### Testes
- `tests/sync-mapped.test.ts`: 23/23 passando (novo)
- `tests/scan.test.ts`: 27/27 (sem regressão)
- `tests/dedupe.test.ts`: 10/10 (sem regressão)
- `tests/export-mapped.test.ts`: 13/13 (sem regressão)
- **Total**: 370 testes / 29 suites (era 357 / 28).

### Comportamento dry-run vs real
- **Sem `--confirm-real-google`**: `scanGmail()` recebe `confirmReal=false` → retorna `mode: 'dry-run'` com 0 contadores. `exportMappedDocuments()` e `generateReport()` rodam normalmente (ambos são read-only por natureza). Zero chamadas reais Gmail/Drive.
- **Com `--confirm-real-google`**: scan real é executado (delega para `createScan` em `realScan.ts` com `confirmReal=true`). Upload real no Drive só acontece se autenticado e dentro de cap.

### Comportamento retry-message
- `sync:mapped --retry-message <id>`: usa `daysBack=1` (config default 7 é descartado). Modo narrow.
- `sync:mapped --retry-message <id> --days 5`: falha com `[sync-mapped] --retry-message requires --days <= 1 (got 5)`.
- `sync:mapped --retry-message <id> --wide-scan`: falha com `[sync-mapped] --retry-message cannot be combined with --wide-scan.`
- `sync:mapped --retry-message <id> --query "from:foo"`: falha com `[sync-mapped] --retry-message cannot be combined with --query.`

### Exemplo de uso
```
# Dry-run padrão (zero chamadas reais)
npm run sync:mapped

# Real mode (requer token OAuth + confirmação explícita)
npm run sync:mapped -- --confirm-real-google --days 3

# Retry por mensagem específica (narrow, days=1 automático)
npm run sync:mapped -- --retry-message <msgId>

# Filtrar export por status
npm run sync:mapped -- --status pending --export-days 7

# Report em JSON
npm run sync:mapped -- --json-report
```

### Riscos remanescentes
Nenhum. Implementação é integração de blocos já validados (scan, export-mapped, report) sem alteração de semântica. Os guards de retry-message são testados unitariamente e end-to-end via CLI.

## Fase anterior
G13-C-R1 — Sync Mapped Smoke Real-Lite (MESSAGE_ID 19f3c813e8d45be1, isolamento confirmado)

## Fase anterior
G13-B — Sync Mapped Command Implementation (CLI + script + 23 testes)

## Fase anterior
G13-A — Design do comando `sync:mapped` (read-only, mapeamento de blocos)

## Fase anterior
G12-E5 — Dev Null Cross-Platform Fix (1 linha)

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

---

## Fase G12-E2: Mapped Documents Export (patch pequeno)

### Objetivo
Exportar todos os documentos mapeados (pending/assigned/accepted/rejected) para JSONL (`documentos-mapeados.jsonl`), com timestamps por evento, sem mutar DB, sem Drive, sem schema, sem scan real.

### Patch aplicado (a partir de `60ccada`)

**src/core/exportPackage.ts:**
- `listMappedDocuments({ status?, daysBack?, limit? })` — consulta `documentos` (todas as status) com subqueries correlacionadas em `ingestion_events` para `detected_at`, `linked_at`, `accepted_at`, `rejected_at` (via `MIN(created_at)` por `event_type`) e `rejected_reason` (do evento rejected)
- `exportMappedDocuments({ outputPath?, status?, daysBack?, limit? })` — gera JSONL; default `data/exports/documentos-mapeados.jsonl`
- Tipos: `MappedDocumentRow`, `ExportMappedOptions`, `ExportMappedResult`
- Idempotente: não altera DB, não marca `exported_at`, não escreve no outbox
- Cada linha inclui `schema_version: 1`

**src/index.ts:**
- Re-exporta `exportMappedDocuments`, `listMappedDocuments` e tipos `ExportMappedResult`, `ExportMappedOptions`, `MappedDocumentRow`

**src/cli.ts:**
- Novo comando `export-mapped` com flags `--output`, `--status`, `--days`, `--limit` (cap 5000)
- Sem `--confirm-real-google` — operação é inerentemente read-only

**package.json:**
- Script `export:mapped` (`tsx src/cli.ts export-mapped`)

**tests/export-mapped.test.ts (novo, 13 testes):**
- Exporta pending sem pedido_manual
- Exporta assigned com pedido_manual
- Exporta accepted com accepted_at
- Exporta rejected com rejected_at e rejected_reason
- Campos não aplicáveis saem null
- schema_version: 1 em todas as linhas
- Filtro --status
- Filtro --days
- --limit
- Idempotência (DB, outbox, eventos intactos)
- Duplicatas de evento do mesmo tipo não duplicam documento no export
- Integração com link/accept flow
- Integração com link/reject flow

### Contrato JSONL por linha (documentos-mapeados.jsonl)
```json
{
  "schema_version": 1,
  "document_id": "uuid",
  "filename_original": "NF-12345.xml",
  "tipo_documento": "nf",
  "formato": "xml",
  "direcao_nf": "entrada",
  "status": "pending|assigned|accepted|rejected",
  "pedido_manual": "PED-XX-YYYY ou null",
  "gmail_message_id": "...",
  "thread_id": "...",
  "drive_file_id": "...",
  "drive_web_view_link": "https://...",
  "received_at": "ISO",
  "detected_at": "ISO ou null",
  "linked_at": "ISO ou null",
  "accepted_at": "ISO ou null",
  "rejected_at": "ISO ou null",
  "rejected_reason": "string ou null"
}
```

### Query final (partindo de `documentos d`)
```sql
SELECT
  d.id, d.filename_original, d.tipo_documento, d.formato, d.direcao_nf,
  d.status, d.pedido_manual, d.gmail_message_id, d.thread_id,
  d.drive_file_id, d.drive_web_view_link,
  d.created_at AS received_at,
  (SELECT MIN(e.created_at) FROM ingestion_events e
    WHERE e.document_id = d.id AND e.event_type = 'document.detected') AS detected_at,
  (SELECT MIN(e.created_at) FROM ingestion_events e
    WHERE e.document_id = d.id AND e.event_type = 'document.linked') AS linked_at,
  (SELECT MIN(e.created_at) FROM ingestion_events e
    WHERE e.document_id = d.id AND e.event_type = 'document.accepted') AS accepted_at,
  (SELECT MIN(e.created_at) FROM ingestion_events e
    WHERE e.document_id = d.id AND e.event_type = 'document.rejected') AS rejected_at,
  (SELECT e.reason FROM ingestion_events e
    WHERE e.document_id = d.id AND e.event_type = 'document.rejected'
    ORDER BY e.created_at ASC LIMIT 1) AS rejected_reason
FROM documentos d
[WHERE d.status = ? AND d.created_at >= ?]
ORDER BY d.created_at DESC
LIMIT ?
```

A query parte de `documentos` (não de eventos) — `MIN(created_at)` agregado por `event_type` garante que duplicatas de evento (cenário defensivo) não duplicam documentos.

### Garantias
- Nenhuma chamada Google/Drive
- Nenhum scan real
- Nenhum export real externo
- SQLite/schema.sql não alterado
- `exportPackage()` e `exportReceivedDocuments()` inalterados
- `outbox.ts`, `link.ts`, `queries.ts`, `acceptance.ts`, `realAssign.ts`, `realScan.ts` não alterados
- Controle de Tapetes não tocado
- `documentos-recebidos.jsonl` continua funcionando (sem quebra)
- 13 testes novos passando, 0 quebrados nas regressões

### Riscos remanescentes
- **Sem `received_at` nativo**: usa `documentos.created_at` (≈scan time). Se a UI precisar do timestamp do email, JOIN com `emails_processados.processed_at` seria necessário em fase futura.
- **Múltiplos eventos do mesmo tipo**: mitigado com `MIN(created_at)` — se houver, o timestamp mais antigo prevalece (semântica: "quando o documento foi detectado/pela primeira vez").
- **Sem marca `exported_at`**: consumidor (Controle) deve dedupar por `document_id` se rodar o export múltiplas vezes.

### Próxima fase recomendada
RAVATEX-DOCUMENTS-G12-F-MAPPED-DOCUMENTS-CONSUMER
Foco: opcionalmente integrar `documentos-mapeados.jsonl` no Controle de Tapetes para exibir a fila de documentos com status, pedido_manual, timestamps por evento e `rejected_reason` (read-only, mesmo contrato JSONL).

---

## Fase G12-E3: Mapped Export Data Quality Diagnostic (read-only)

### Objetivo
Diagnosticar a duplicata encontrada no `documentos-mapeados.jsonl` exportado: 3 registros (teste-nfe-entrada.xml aparecendo 2× + L.pdf fixture), explicar por que um deles é `desconhecido/desconhecido`, por que `detected_at` saiu null, e classificar L.pdf como fixture/mock.

### Achados
- 3 documentos no DB: `cda18ef9` (teste-nfe-entrada.xml, accepted, PED-99-2026), `5c3074bb` (teste-nfe-entrada.xml, pending, desconhecido), `ec07577a` (L.pdf, pending, desconhecido, fixture mock com gmail_message_id=m-log, drive_file_id=mock-L.pdf)
- `cda18ef9` e `5c3074bb` têm o mesmo `gmail_message_id` (19f3c813e8d45be1) e mesmo `sha256` (d71f327...) e mesmo `drive_file_id` (1ao8qFfl...) mas `attachment_id` diferentes
- Apenas `cda18ef9` tem eventos (linked+accepted); `5c3074bb` e `ec07577a` não têm eventos — por isso `detected_at`, `linked_at`, `accepted_at` saem null no export
- L.pdf é fixture mock (evidências: gmail_message_id=m-log, drive_file_id=mock-L.pdf, thread_id=t, email subject=LOG)
- Índice de dedup `(gmail_message_id, attachment_id, sha256)` não cobre o caso em que o mesmo arquivo físico reaparece com `attachment_id` diferente

### Causa raiz
O pipeline de scan inseria o mesmo arquivo físico duas vezes (mesmo `gmail_message_id` + mesmo `sha256`, mas `attachment_id` diferente) porque o índice de dedup tratava `attachment_id` como parte da chave. O segundo documento entrava como `desconhecido` e nunca era classificado.

### Garantias do diagnóstico
- Nenhuma alteração em arquivo
- Nenhuma query destrutiva
- Nenhuma chamada Gmail/Drive
- Nenhum scan real

---

## Fase G12-E4: Document Dedupe Hardening (patch + cleanup local)

### Objetivo
Endurecer o dedup no pipeline de scan para bloquear inserção de documento duplicado dentro do mesmo email (mesmo `gmail_message_id` + mesmo `sha256` não vazio, mesmo com `attachment_id` diferente) e remover a duplicata pendente (`5c3074bb`) já presente no DB local, com backup prévio.

### Patch aplicado (a partir de `61841b2`)

**src/core/dedupe.ts:**
- Nova função `isDuplicateInSameMessage(gmailMessageId, sha256)`: retorna true se já existir documento com mesmo `gmail_message_id` e mesmo `sha256` (não vazio). Não consulta `attachment_id` (intencional — queremos bloquear independente do attachment_id).
- Função `isDuplicate` (estrita `(msg, att, sha)`) preservada como fallback rápido.

**src/core/realScan.ts:**
- Importa `isDuplicateInSameMessage` de `dedupe.js`
- No loop de scan, após `isDuplicate(...)` (chave completa), chama `isDuplicateInSameMessage(email.gmailMessageId, sha256)`. Se retornar true, loga `status: 'duplicate_same_message'`, incrementa `duplicates`, faz `continue` (não insere novo documento, não chama cross-message dedup, não faz upload).
- Cross-message dedup (`findExistingBySha256`) preservado e rodando depois dessa verificação.

**tests/dedupe.test.ts:**
- Novo describe `isDuplicateInSameMessage (G12-E4 hardening)` com 5 testes:
  - retorna false quando não há documento
  - retorna false quando sha256 é vazio
  - retorna true quando mesmo `gmail_message_id` + mesmo `sha256` (attachment_id diferente)
  - retorna false quando mesmo `sha256` mas `gmail_message_id` diferente (cross-message ainda permitido)
  - retorna false quando mesmo `gmail_message_id` mas `sha256` diferente
- Total dedupe.test.ts: 10/10 passando

**tests/scan.test.ts:**
- Novo teste `G12-E4: same email + same sha256 + different attachment_id does NOT create a second document`: valida que `createScan` rejeita 2º anexo com mesmo sha256 no mesmo email (newDocuments=1, duplicates=1, uploadCalls=1)
- Novo teste `G12-E4: cross-message dedup behavior is preserved (same sha256 across different emails still allowed)`: valida que mensagens diferentes com mesmo sha256 ainda criam cross-message duplicate
- Ajuste em `hardening: per-run maxAttachments cap is enforced`: usa buffers distintos entre anexos (antes usava mesmo buffer para n1.pdf e n2.pdf, o que conflitava com a nova regra)
- Total scan.test.ts: 27/27 passando

**.gitignore:**
- Adicionada regra `data/*.backup-*` para ignorar backups do DB fora do versionamento

### Critério de delete aplicado
- `documentos.id = '5c3074bb-76f5-4096-a50e-767a4be090ab'`
- `status = 'pending'`
- `pedido_manual IS NULL`
- 0 eventos em `ingestion_events`
- mesmo `sha256` (d71f327...) e `drive_file_id` (1ao8qFfl...) de `cda18ef9` aceito
- classificação `desconhecido/desconhecido`

`cda18ef9` (aceito, PED-99-2026) preservado. `ec07577a` (L.pdf fixture) preservado.

### Backup
- `data/app.db.backup-g12-e4-20260708-210928` (65536 bytes, idêntico ao DB pré-DELETE)
- Backup NÃO commitado (ignorado por `.gitignore` via `data/*.backup-*`)
- Backup NÃO deletado (preservado em disco para eventual rollback)

### Export pós-cleanup
- `data/exports/documentos-mapeados.jsonl` regenerado: 2 linhas
  - `cda18ef9` (teste-nfe-entrada.xml, accepted, PED-99-2026) preservado com `linked_at` e `accepted_at`
  - `ec07577a` (L.pdf, pending) preservado
  - `5c3074bb` removido
- `npm run export:mapped` reporta `Exported 2 mapped document(s). Local-only — no Google Drive calls performed.`

### Garantias
- Nenhuma migration, nenhuma alteração de schema
- Nenhuma chamada Gmail/Drive real
- Nenhum scan real, nenhum assign/accept/reject
- Nenhuma alteração em `outbox.jsonl` (intacto, 5 eventos preservados)
- Controle de Tapetes não tocado
- Backup local preservado e ignorado pelo git

### Testes (357 totais, 28 suites, 0 falhas)
- `tests/dedupe.test.ts` — 10/10 (5 novos)
- `tests/scan.test.ts` — 27/27 (2 novos G12-E4 + 1 ajustado)
- `tests/export-mapped.test.ts` — 13/13 (regressão verde)
- `tests/export-received.test.ts` — 9/9 (regressão verde)
- Demais suites: 298/298 (regressão verde)

### Riscos remanescentes
- **Pré-existente (corrigido em G12-E5)**: ~~`src/core/realAssign.ts:117` chama `addDocumentToManifest('/dev/null', ...)`, que falha em Windows porque `/dev/null` aponta para um arquivo com lixo.~~ Resolvido: substituído por `os.devNull`.
- **Reenvio cross-email**: a nova regra NÃO bloqueia reenvio do mesmo arquivo em outro `gmail_message_id` — esse caso ainda cria cross-message duplicate (reuso do Drive file), que é o comportamento operacional desejado.
- **Colisão de sha256**: se dois arquivos logicamente diferentes tiverem o mesmo `sha256` no mesmo email (improvável mas possível), a nova regra trata como duplicata. Aceitável dado que o `sha256` é o identificador físico do arquivo.

### Próxima fase recomendada
RAVATEX-DOCUMENTS-G12-F-MAPPED-DOCUMENTS-CONSUMER
Foco: integrar `documentos-mapeados.jsonl` no Controle de Tapetes para exibir a fila de documentos com status, pedido_manual, timestamps por evento e `rejected_reason` (read-only, mesmo contrato JSONL).

---

## Fase G12-E5: Dev Null Cross-Platform Fix (patch 1 linha)

### Objetivo
Corrigir `realAssign.ts:117` que usava o path literal `'/dev/null'`, o qual falha em Windows por não ser um dispositivo nulo real (aponta para um arquivo comum com lixo residual). Substituir por `os.devNull`, que funciona cross-platform (Linux, macOS, Windows).

### Patch aplicado (a partir de `800d4af`)

**src/core/realAssign.ts:**
- Adicionado `import os from 'node:os'` (linha 11)
- Linha 117 (antiga): `addDocumentToManifest('/dev/null', normalized, {`
- Linha 117 (nova): `addDocumentToManifest(os.devNull, normalized, {`

### Garantias
- Nenhuma alteração de schema
- Nenhuma migration
- Nenhuma chamada Gmail/Drive real
- Nenhum scan real
- DB, outbox, export não alterados
- Controle de Tapetes não tocado
- Backup (data/app.db.backup-g12-e4-*) preservado em disco

### Testes corrigidos
- `tests/assign-real.test.ts` — 8/8 passando (eram 5/8 falhando por `loadManifest('/dev/null')` → `SyntaxError: is not valid JSON`)
- `tests/integration-mock-flow.test.ts` — 3/3 passando (eram 2/3 falhando pelo mesmo motivo)

### Testes regressão
- `tests/export-mapped.test.ts` — 13/13 ✓
- `tests/dedupe.test.ts` — 10/10 ✓

### Risco residual
- Nenhum introduzido. `os.devNull` é suportado em Node.js desde a versão 0.x em todas as plataformas. O projeto usa Node.js 22, sem risco de incompatibilidade.

### Próxima fase recomendada
RAVATEX-DOCUMENTS-G12-F-MAPPED-DOCUMENTS-CONSUMER
Foco: integrar `documentos-mapeados.jsonl` no Controle de Tapetes para exibir a fila de documentos com status, pedido_manual, timestamps por evento e `rejected_reason` (read-only, mesmo contrato JSONL).

## Fase G13-C-R1: Sync Mapped Smoke Real-Lite (não commitada)
- **HEAD inicial**: `7cc673f` (em fechamento G13-B)
- **Objetivo**: validar `npm run sync:mapped -- --confirm-real-google --retry-message <MESSAGE_ID> --max-attachments 1` em ambiente real-lite, sem scan amplo.
- **MESSAGE_ID autorizado**: `19f3c813e8d45be1` (do smoke G5 R4-R1 / C2).
- **Sequência**:
  1. `git branch --show-current; git rev-parse HEAD; git status --short` → `master`, `7cc673f`, limpo.
  2. Dry-run: `npm run sync:mapped -- --retry-message 19f3c813e8d45be1 --max-attachments 1` → OK em 25ms, mode=dry-run, banner narrow.
  3. Real-lite: `npm run sync:mapped -- --confirm-real-google --retry-message 19f3c813e8d45be1 --max-attachments 1` → OK em 1934ms, `emailsScanned=1 new=0 duplicates=1 crossMessageDuplicates=0 skippedByCap=0 errors=0`.
  4. Validações: `export-mapped` (2 docs), `report --days 1` (9 emails, 2 docs, 0 erros), `list-pending --limit 20` (2 docs).
- **Run log**: `data/runs/run-2026-07-09T13-25-28-394Z.jsonl` (6 eventos: run.start, retry.direct_fetch, retry.start, attachment.processed [status=duplicate_same_message], email.scanned, run.end).
- **Verificações de segurança**:
  - Scan amplo? **NÃO** — `fetchMessageById` direto, sem `after:YYYY/MM/DD`.
  - retry isolou uma mensagem? **SIM** — `emailsScanned=1`.
  - Documento duplicado criado? **NÃO** — `newDocuments=0`, dedupe `duplicate_same_message` detectado.
  - Backup local `data/app.db.backup-g12-e4-20260708-210928` preservado? **SIM**.
  - DB inalterado em conteúdo? **SIM** — 65536 bytes (mesmo do pré-smoke); nenhum INSERT novo.
  - Controle de Tapetes tocado? **NÃO**.
  - Schema alterado? **NÃO** (apenas UPDATE trivial em `emails_processados.attachments_count`).
  - Push realizado? **NÃO**.
  - `git add .` / `reset` / `rebase` / `stash` / `clean`? **NENHUM**.
- **Não executado**: scan amplo, deleção, migration, push, modificação de código/testes.
- **Riscos**: nenhum.
- **Próxima fase**: G13-D — documentação operacional do `sync:mapped`.

## Fase G13-D: Sync Mapped Operational Documentation
- **HEAD inicial**: `7cc673f` (inalterado desde G13-B; G13-C-R1 não commitou)
- **Objetivo**: documentar `npm run sync:mapped` para operadores e para a próxima fase de integração com o Controle de Tapetes.
- **Arquivos alterados (4)**:
  - `README.md` — nova seção 7 "Sincronização local em um comando (`sync:mapped`)" com 7 sub-seções (dry-run, real mode, retry narrow, guardas de segurança, saída/contrato, relação com outros comandos, limites fora de escopo). Tabela "Segurança operacional" e "Operação diária" atualizadas. Exemplos atualizados.
  - `PROJECT_STATE.md` — registro das fases G13-C-R1 e G13-D; nova seção G13-C-R1.
  - `AGENT_HANDOFF.md` (este arquivo) — `Fase concluída = G13-D`, chain de "Fase anterior" até G12-C1, nova seção G13-C-R1 e G13-D.
  - `docs/CONTROL_TAPETES_DOCUMENTS_CONTRACT.md` — nova subseção 4.4 "Sincronização local em um comando (`sync:mapped`)" + entradas em "Fases concluídas" (G13-A/B/C-R1/D) e em "Comandos úteis" + nota em "O que NÃO será feito".
- **Não alterado**: `src/**`, `tests/**`, `schema.sql`, `data/**`, `package.json`. Controle de Tapetes não tocado.
- **Não executado**: nenhuma chamada Gmail/Drive, nenhum scan real, nenhum assign/accept/reject, nenhuma migration, nenhum push, nenhum `git add .`, nenhum `reset/rebase/stash/clean`. Backup local preservado.
- **Conteúdo documental**:
  - Dry-run padrão com saída esperada (banner + 3 steps + DONE em ms).
  - Real-lite com `--confirm-real-google` (gate duplo: flag CLI + env `INGEST_REAL_GOOGLE`).
  - Retry narrow com `--retry-message <id>` — `days=1` automático, sem query amplo.
  - 4 guardas de segurança de `--retry-message` (com `--days > 1`, `--wide-scan`, `--query`, ou sem flag → narrow).
  - Saída `data/exports/documentos-mapeados.jsonl` (JSONL, `schema_version: 1`, timestamps por evento: `detected_at`, `linked_at`, `accepted_at`, `rejected_at`).
  - Relação com `export:mapped`, `report`, `list-pending` (equivalência: `sync:mapped` é atalho que executa 3 comandos em sequência).
  - Limites: não toca Controle, não cria scheduler/daemon/watcher, consumo automático é fase posterior.
- **Riscos**: nenhum. Documentação é apenas textual.

## Fase G14: Sync Mapped Consumer — Bridge no Controle de Tapetes (cross-repo, design + implementação)
- **HEAD Documents Ingestor**: `bedbe909` (master, produtor inalterado — sem alterações no produtor para G14)
- **HEAD Controle de Tapetes**: `fff052b` (work/app-next, consumidor bridge implementado e staging publicado)
- **Objetivo**: implementar o consumo do `documentos-mapeados.jsonl` (gerado por `sync:mapped`) pelo Controle de Tapetes via bridge `RAVATEX_DOCUMENTS_RECEIVED` → `mapReceivedDocToEventShape` → Pedido Detail.
- **Fases dentro do Controle de Tapetes**:
  - G14-A: design (read-only) — diagnóstico do import atual, decisão por bridge manual sem polling
  - G14-B: patch `mapReceivedDocToEventShape` + fallback `RAVATEX_DOCUMENTS_RECEIVED` no Pedido Detail (commit `624d064`)
  - G14-C: smoke real com `documentos-mapeados.jsonl` real (teste `g14-c-bridge-smoke.test.js`, 22/22 pass, commit `fff052b`)
  - G14-D: closeout + staging push (`fff052b` → `staging main`)
- **Pontos entregues**:
  - Botão "Importar documentos" na tela `#/documentos/recebidos` — preservado, funcional
  - Botão legado "Importar eventos" — ausente (sem flag `RAVATEX_ENABLE_DOCUMENTS_EVENTS_IMPORT_UI`)
  - Bridge: `loadReceivedDocumentsFromText(JSONL)` → `RAVATEX_DOCUMENTS_RECEIVED` → `mapReceivedDocToEventShape()` → Pedido Detail filtra por `pedido_manual`
  - Idempotência por `document_id` (dedup no reimport)
  - Precedência: `RAVATEX_DOCUMENTS_LOADED_EVENTS` (eventos legados) vence sobre `RAVATEX_DOCUMENTS_RECEIVED`
  - Flat JSONL não gera timeline (eventos de histórico ausentes)
  - Documents Ingestor **não foi alterado** — produtor permanece idêntico
- **Não implementado em G14**: polling, scheduler, endpoint local, backend, aceite/rejeição no Controle, `ingestion_event_id` no JSONL
- **Próxima fase recomendada**: G15 — UX de último import/timestamp/hash no Controle; `ingestion_event_id` no JSONL como melhoria futura; aceite/rejeição dentro do Controle como feature posterior. Produtor `sync:mapped` estável, consumidor bridge publicado em staging. Sem scheduler/daemon/watcher.

## Fase G17-A: Ingestion Event ID Export Design (read-only)
- **HEAD inicial**: `4346275`
- **Objetivo**: mapear como incluir `ingestion_event_id` no `documentos-mapeados.jsonl` sem quebrar o Controle de Tapetes.
- **Diagnóstico**:
  - `ingestion_events.id` é UUID estável (PRIMARY KEY), imutável desde inserção.
  - `exportMappedDocuments` já faz JOIN com `ingestion_events` via subqueries correlacionadas, mas **nunca seleciona `e.id`**.
  - Controle de Tapetes ignora campos extras (validador allowlist, bridge não lê `ingestion_event_id`).
  - Recomendado: 5 campos opcionais (`latest`, `detected`, `linked`, `accepted`, `rejected`), `schema_version: 1` mantido.
- **Não alterado**: nenhum arquivo (read-only).
- **Próxima fase**: G17-B — implementar patch.

## Fase G17-B: Ingestion Event ID Export Patch
- **HEAD inicial**: `4346275`
- **Objetivo**: adicionar 5 campos opcionais de `ingestion_event_id` ao mapped export.
- **Arquivos alterados**:
  - `src/core/exportPackage.ts` — `MappedDocumentRow` expandido com 5 campos (`latest_ingestion_event_id`, `detected_ingestion_event_id`, `linked_ingestion_event_id`, `accepted_ingestion_event_id`, `rejected_ingestion_event_id`, todos `string | null`). 5 subqueries SQL adicionadas com tie-breaker por `id` para determinismo.
  - `tests/export-mapped.test.ts` — 3 novos testes + asserções expandidas nos existentes (latest é o mais recente, UUID format, null quando sem eventos, schema_version=1 mantido).
  - `docs/CONTROL_TAPETES_DOCUMENTS_CONTRACT.md` — nova seção 4.5 documentando os campos opcionais.
  - `PROJECT_STATE.md` — registro G17-A e G17-B.
  - `AGENT_HANDOFF.md` — este arquivo.
- **Campos SQL** (5 subqueries):
  ```sql
  (SELECT e.id FROM ingestion_events e
    WHERE e.document_id = d.id
    ORDER BY e.created_at DESC, e.id DESC LIMIT 1) AS latest_ingestion_event_id,
  (SELECT e.id FROM ingestion_events e
    WHERE e.document_id = d.id AND e.event_type = 'document.detected'
    ORDER BY e.created_at ASC, e.id ASC LIMIT 1) AS detected_ingestion_event_id,
  (SELECT e.id FROM ingestion_events e
    WHERE e.document_id = d.id AND e.event_type = 'document.linked'
    ORDER BY e.created_at ASC, e.id ASC LIMIT 1) AS linked_ingestion_event_id,
  (SELECT e.id FROM ingestion_events e
    WHERE e.document_id = d.id AND e.event_type = 'document.accepted'
    ORDER BY e.created_at ASC, e.id ASC LIMIT 1) AS accepted_ingestion_event_id,
  (SELECT e.id FROM ingestion_events e
    WHERE e.document_id = d.id AND e.event_type = 'document.rejected'
    ORDER BY e.created_at ASC, e.id ASC LIMIT 1) AS rejected_ingestion_event_id
  ```
- **schema_version**: mantido `1` (retrocompatível — campos opcionais).
- **Não alterado**: `schema.sql`, `sqlite.ts`, `types/event.ts`, `outbox.ts`, `link.ts`, `acceptance.ts`, `cli.ts`, `index.ts`, Controle de Tapetes, DB, backups.
- **Não executado**: Gmail/Drive real, push, `git add .`, `reset/rebase/stash/clean`.
- **Garantias**:
  - Zero migrations, zero alterações de schema.
  - Controle de Tapetes ignora campos extras (evidência: `isValidReceivedDocument` allowlist, `mapReceivedDocToEventShape` não lê `ingestion_event_id`, testes bridge G14-C smoke).
  - `schema_version` permanece `1`.
  - Tie-breaker por `id` garante resultado determinístico.
- **Riscos**: nenhum.
- **Próxima fase recomendada**: G18 — consumo de `ingestion_event_id` pelo Controle (bridge enhance, fora de escopo do produtor). Produtor `sync:mapped` estável, consumidor bridge publicado em staging.
