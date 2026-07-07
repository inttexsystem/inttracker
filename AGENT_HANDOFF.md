# AGENT HANDOFF

## Branch/HEAD/Status
### documentos-ingestor (este repositório)
- Branch: master
- HEAD: `6622526` — Add local-only document link command (G6-B)
- Status: limpo

### Controle de Tapetes (staging/work/app-next)
- HEAD canônico: `997486a`
- Push staging: `af919a2..997486a`
- Produção/origin oficial: intocados
- Status residual esperado: `?? supabase/.temp/`

## Fase concluída
RAVATEX-DOC-INGESTOR-G6-B-LINK-LOCAL-ONLY

## Fase anterior
G6-A — Diagnóstico do fluxo pending → pedido/app/outbox

## Objetivo da fase G6-B
Implementar comando `link` local-only para vincular documento pending a pedido, atualizando apenas SQLite e outbox, sem Google Drive, sem mover arquivos e sem manifest real.

### Resultados G6-B
- Comando `link` implementado em `src/cli.ts`
- Função `linkDocumentToPedido` em `src/core/link.ts`
- Exportado via `src/index.ts`
- Script npm `npm run link` em `package.json`
- 12 testes herméticos em `tests/link.test.ts`
- 229 testes passando (21 suites) — 12 novos + 217 existentes

### Sintaxe do comando
```
npm.cmd run link -- --id <document_id_or_gmail_message_id> --pedido <pedido_ref>
```

Exemplos:
```
npm.cmd run link -- --id <doc_uuid> --pedido 25/2026
npm.cmd run link -- --id <gmail_msg_id> --pedido PED-25-2026
```

### Semântica
- **Local-only**: não chama Gmail, Drive, upload, move, manifest real ou scan
- Não exige `--confirm-real-google`
- Atualiza SQLite: `pedido_manual`, `status='assigned'`, `updated_at`
- Cria evento `ingestion_events` com `event_type='document.linked'`, status `pending_app_acceptance`
- Append no outbox JSONL
- **Idempotente**: mesmo documento + mesmo pedido retorna sucesso sem duplicar evento
- **Bloqueia** vínculo conflitante (documento já vinculado a pedido diferente)
- **Bloqueia** pedido inválido, documento inexistente, status não-pending
- Output deixa claro: `Local-only — no Google Drive calls performed`

### Campos SQLite alterados pelo link
- `documentos.pedido_manual` — preenchido com pedido normalizado (PED-NN-YYYY)
- `documentos.status` — muda de `pending` para `assigned`
- `documentos.updated_at` — atualizado para datetime('now')
- `ingestion_events` — INSERT com event_type `document.linked`, status `pending_app_acceptance`

### Evento outbox emitido
- `schema_version`: 1
- `event_type`: `document.linked`
- `status`: `pending_app_acceptance`
- Contém: document_id, pedido_manual, gmail_message_id, thread_id, sha256, tipo_documento, filename_original, storage_uri, drive_file_id (se existir)

### Riscos remanescentes
1. **App acceptance é dead end**: não há comando para transicionar `assigned → accepted/rejected`
2. **ExportPendingEvents ignora event_type do DB**: `buildEventFromRow` hardcoded `document.detected`, então re-export batch override `document.linked` para `document.detected`
3. **Sem proteção contra vínculo de direção errada**: NF entrada pode ser linked a pedido de saída sem aviso
4. **Manifest do Pedido desatualizado**: se o documento for linked local-only e depois um assign real for executado, o manifest Drive não refletirá o documento (pois o arquivo não está na pasta do pedido)
5. **accepted/rejected não geram evento de outbox**

### Próxima fase recomendada
RAVATEX-DOC-INGESTOR-G6-C-APP-ACCEPTANCE-AND-FUNNEL
Foco: comando `accept`/`reject` local-only para transicionar `assigned → accepted/rejected`, com evento outbox `document.accepted`/`document.rejected`, fechando o funil de aceite do app.
