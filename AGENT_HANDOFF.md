# AGENT HANDOFF

## Branch/HEAD/Status
### documentos-ingestor (este repositório)
- Branch: master
- HEAD: `0889d29` — Add local document acceptance workflow (G6-C)
- Status: limpo

### Controle de Tapetes (staging/work/app-next)
- HEAD canônico: `997486a`
- Push staging: `af919a2..997486a`
- Produção/origin oficial: intocados
- Status residual esperado: `?? supabase/.temp/`

## Fase concluída
RAVATEX-DOC-INGESTOR-G6-C-APP-ACCEPTANCE-AND-FUNNEL

## Fase anterior
G6-B-R1 — Preservação de event_type/status no outbox export

## Objetivo da fase G6-C
Fechar o funil operacional local implementando comandos `accept`/`reject` para transicionar documentos `assigned → accepted/rejected`, emitindo eventos outbox e expondo o funil no report.

### Resultados G6-C
- Comandos `accept` e `reject` implementados em `src/cli.ts`
- Funções `acceptDocument`/`rejectDocument` em `src/core/acceptance.ts`
- Campo `reason?` adicionado a `DocumentEventDocument` (event.ts) para payload de rejeição
- Report estendido com `documentsAccepted` e `documentsRejected`
- 18 testes herméticos em `tests/acceptance.test.ts`
- 250 testes passando (22 suites) — 18 novos + 232 existentes

### Sintaxe dos comandos
```
npm.cmd run accept -- --id <doc_id_or_gmail_msg_id>
npm.cmd run reject -- --id <doc_id_or_gmail_msg_id> --reason "<motivo>"
```

### Semântica
- **Local-only**: não chama Gmail, Drive, upload, move, manifest ou scan
- `accept`: documento `assigned` → `accepted`
- `reject`: documento `assigned` → `rejected`
- Ambos exigem que o documento esteja `assigned` com `pedido_manual`

### Transições implementadas
```
pending ──link──▶ assigned ──accept──▶ accepted
                     │───reject──▶ rejected
```
Bloqueios:
- `pending` → accept/reject: bloqueado ("not linked")
- `accepted` → reject: bloqueado ("already accepted")
- `rejected` → accept: bloqueado ("already rejected")
- Idempotência: accept/reject no mesmo status retorna sucesso sem duplicar evento

### Campos SQLite alterados
- `documentos.status` → `'accepted'` ou `'rejected'`
- `documentos.updated_at` → `datetime('now')`
- `ingestion_events` INSERT com `event_type='document.accepted'`/`'document.rejected'`, status `'accepted'`/`'rejected'`

### Eventos outbox emitidos
- `document.accepted` — status `accepted`
- `document.rejected` — status `rejected`, payload inclui `reason` (se fornecido)
- Ambos contêm: document_id, pedido_manual, sha256, tipo_documento, formato, direcao_nf, filename, drive_file_id, storage_uri

### Mudanças no report
- `documentsAccepted`: count de `status='accepted'`
- `documentsRejected`: count de `status='rejected'`
- `documentsByStatus` já incluía ambos automaticamente
- Saída texto do report mostra as novas contagens

### Riscos remanescentes
1. **event_id no export é document_id**: `buildEventFromRow` usa `row.id` (document_id), não `e.id`. Legado.
2. **Sem proteção contra vínculo de direção errada**: NF entrada pode ser linked a pedido de saída sem aviso
3. **Manifest Drive desatualizado após link**: documento linked não está na pasta do pedido no Drive

### Próxima fase recomendada
RAVATEX-DOC-INGESTOR-G7-DIRECTION-GUARD-AND-CLEANUP
Foco: proteção contra vínculo NF entrada/saída com pedido errado, revisão do event_id legado, e opcionalmente aceitar/rejeitar via Google Drive real.
