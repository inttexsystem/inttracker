# AGENT HANDOFF

## Branch/HEAD/Status
### documentos-ingestor (este repositório)
- Branch: master
- HEAD: `(new commit)` — Add local manifest export and sync dry run (G9-B)

### Controle de Tapetes (staging/work/app-next)
- HEAD canônico: `997486a`

## Fase concluída
RAVATEX-DOC-INGESTOR-G9-B-MANIFEST-LOCAL-AND-SYNC-SCAFFOLD

## Fase anterior
G9-A — Design de sincronização manifest Drive

## Objetivo da fase G9-B
Implementar export local de manifest e scaffold de sync, sem execução real Google/Drive.

### Comandos implementados

**export-manifest** (local-only, sem Drive):
```
npm run export:manifest -- --pedido 25/2026
```
Lê SQLite, gera manifest JSON para stdout. Read-only, não altera documentos, não chama Drive.

**sync-manifest** (dry-run por padrão):
```
npm run sync:manifest -- --pedido 25/2026
npm run sync:manifest -- --pedido 25/2026 --confirm-real-google
```
Dry-run: imprime preview JSON, não toca Drive.
Com `--confirm-real-google`: chama `uploadManifest()` do `drive.ts` com payload do SQLite (stub em modo hermético).

### Arquivos
- `src/core/syncManifest.ts` — novo: buildManifestFromDb, exportManifest, syncManifest
- `src/cli.ts` — comandos export-manifest e sync-manifest
- `src/index.ts` — export das novas funções
- `package.json` — scripts npm
- `tests/manifest-sync.test.ts` — novo, 8 testes

### Formato do manifest local
- `generated_at` (via created_at/updated_at)
- `source`: implícito (SQLite)
- `schema_version`: 1
- `pedido`: normalizado
- `documents[]`: com document_id, tipo_documento, formato, direcao_nf, filename, sha256, storage_backend, storage_uri, drive_file_id, drive_*, ingested_at, event_id, status

### Comportamento de sync
- **Sem `--confirm-real-google`**: dry-run. Imprime preview, não chama Drive, retorna `{ dryRun: true, driveSyncApplied: false }`
- **Com `--confirm-real-google`**: chama `uploadManifest` (usando stub Drive em ambiente sem token, ou mock em testes)
- Sync não altera documentos, não move arquivos, não altera status

### Testes
- 8 testes em `tests/manifest-sync.test.ts`
- buildManifestFromDb retorna manifesto com linked/accepted/rejected
- exportManifest não chama Drive
- syncManifest dry-run não chama Drive
- syncManifest com confirmRealGoogle retorna stub (hermético, sem Drive real)
- manifest não altera documentos.status
- 25 suites, 278 testes passando

### Riscos remanescentes
1. Sync real com Drive nunca executado em smoke
2. Bloqueio de mismatch entrada/saída deferido
3. event_id v2 deferido

### Próxima fase recomendada
RAVATEX-DOC-INGESTOR-G9-C-MANIFEST-REAL-SMOKE
Foco: validar sync real com --confirm-real-google em documento teste, integração do manifest Drive e consumo de outbox pelo Controle de Tapetes.
