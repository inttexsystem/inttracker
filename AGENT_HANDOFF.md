# AGENT HANDOFF

## Branch/HEAD/Status
### documentos-ingestor (este repositório)
- Branch: master
- HEAD: `(new commit)` — Add Controle Tapetes export package (G10-B)

### Controle de Tapetes (staging/work/app-next)
- HEAD canônico: `997486a`

## Fase concluída
RAVATEX-DOC-INGESTOR-G10-B-EXPORT-PACKAGE

## Fase anterior
G10-A — Design de integração Controle de Tapetes

## Objetivo da fase G10-B
Criar comando `export:package` que gera pacote consolidado por pedido para consumo pelo Controle de Tapetes.

### Comando implementado
```
npm run export:package -- --pedido 25/2026
npm run export:package -- --pedido PED-25-2026 --output ./my-exports
```

### Formato do pacote
4 arquivos gerados em `data/exports/packages/<PEDIDO>/` (ou `--output`):

| Arquivo | Conteúdo |
|---|---|
| `document-events.jsonl` | Eventos filtrados por pedido (read-only do SQLite) |
| `manifest.json` | Snapshot derivado do SQLite com todos os documentos do pedido |
| `summary.json` | totalEvents, totalDocuments, eventsByType, documentsWithDriveLink |
| `README.md` | Instruções de consumo (ingestion_event_id, drive_web_view_link, idempotência) |

### Semântica
- **Read-only**: não altera banco, outbox, status, documentos
- **Local-only**: não chama Google/Drive, não toca Controle de Tapetes
- **Idempotente**: mesma execução gera mesmo output (timestamps diferem)
- Eventos filtrados por `pedido_manual` via `queryAndExportEvents`
- Manifest via `buildManifestFromDb`
- Normalização de pedido: `25/2026` → `PED-25-2026`

### Garantias
- `ingestion_event_id` preservado em eventos
- `event_id` legado preservado
- `reason` preservado em `document.rejected`
- Campos Drive preservados quando presentes
- README contém instruções de consumo

### Testes
- 8 testes em `tests/export-package.test.ts`
- 26 suites, 286 testes passando (8 novos)
- Nenhuma regressão

### Arquivos alterados/criados
- `src/core/exportPackage.ts` — novo (exportPackage function)
- `src/cli.ts` — comando export-package
- `src/index.ts` — export ExportPackageResult
- `package.json` — script npm
- `tests/export-package.test.ts` — novo, 8 testes
- `PROJECT_STATE.md`, `AGENT_HANDOFF.md` — atualização

### Riscos remanescentes
1. Bloqueio de mismatch entrada/saída deferido
2. event_id v2 deferido
3. Controle de Tapetes ainda não implementa consumo de outbox

### Próxima fase recomendada
RAVATEX-DOC-INGESTOR-G11-CONTROLE-TAPETES-WATCHER
Foco: implementar consumo de outbox no Controle de Tapetes. Exibir documentos no pedido via drive_web_view_link. Integrar timeline de eventos. A implementação é no repositório do Controle de Tapetes.
