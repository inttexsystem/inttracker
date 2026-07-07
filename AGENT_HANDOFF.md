# AGENT HANDOFF

## Branch/HEAD/Status
### documents-ingestor (este repositório)
- Branch: master
- HEAD: `(new commit)` — Improve local document operations (G8-C)

## Fase concluída
RAVATEX-DOC-INGESTOR-G8-C-OPERATIONAL-POLISH

## Fase anterior
G8-B — Atualização de contrato (JSON schema + docs)

## Objetivo da fase G8-C
Melhorar operação local em 3 pontos: filtro por pedido, export filtrado de eventos, e inspect com links Drive claros.

### Patch 1 — Filtro por pedido
- `queries.ts`: `ListPendingFilters` ganhou `pedido?: string`; filtra por `documentos.pedido_manual`
- `cli.ts list-pending`: nova opção `--pedido <25/2026 or PED-25-2026>`
- Pedido normalizado via `normalizePedido()`: `25/2026` → `PED-25-2026`
- 2 testes em `queries.test.ts`

### Patch 2 — Export filtrado
- `outbox.ts`: nova função `queryAndExportEvents(filters)` — read-only, sem marcar exported_at
- `cli.ts export-events`: novas opções `--event-type`, `--pedido`, `--mark-exported`, `--json`
- `--mark-exported` executa o export batch original (side-effect)
- Sem `--mark-exported`: read-only, imprime eventos em JSONL ou JSON
- 3 testes em `guardrails.test.ts` (filter por event_type, por pedido, preserva ingestion_event_id + reason)

### Patch 3 — Inspect com links Drive
- `cli.ts inspect`: separa seção `--- drive links ---` com todos os campos Drive (não mascarados)
- Campos exibidos: `drive_file_id`, `drive_web_view_link`, `drive_web_content_link`, `drive_folder_id`, `storage_uri`
- Texto mode mostra valores reais; JSON mode já exibia (inalterado)
- Exibe apenas se `drive_file_id` existe

### Comandos implementados
```
npm run list:pending -- --pedido 25/2026 --status assigned
npm run export:events -- --event-type document.linked --pedido PED-25-2026 --json
npm run export:events -- --event-type document.accepted
npm run inspect -- --id <doc_id>
```

### Arquivos alterados
- `src/cli.ts` — --pedido no list-pending, export-events filtrado, inspect com Drive links
- `src/core/queries.ts` — ListPendingFilters.pedido + filtro
- `src/core/outbox.ts` — queryAndExportEvents()
- `src/index.ts` — export queryAndExportEvents
- `tests/queries.test.ts` — +2 pedido filter tests
- `tests/guardrails.test.ts` — +3 filtered export tests
- `PROJECT_STATE.md`, `AGENT_HANDOFF.md` — atualização

### Testes
- 24 suites, 270 testes passando (5 novos)
- Nenhuma regressão

### Riscos remanescentes
1. Bloqueio de mismatch entrada/saída deferido
2. Manifest Drive sync deferido
3. event_id migração v2 deferida

### Próxima fase recomendada
RAVATEX-DOC-INGESTOR-G8-D-SMOKE-REAL-REVISIT
Foco: revalidar scan + link + accept/reject com Google/Drive real, validar manifest Drive e consumo de outbox.
