# PROJECT STATE

## Objetivo
Ingerir documentos (XML/PDF) recebidos por email (Gmail), classificar, permitir atribuição manual a Pedido e gerar eventos para integração futura com o app principal (Controle de Tapetes).

## Workspace
D:\OneDrive\Programação\Ravatex\documents-ingestor

## Stack
- Node.js 22.22.3 / npm 10.9.8
- TypeScript 5.7 (ESM strict)
- better-sqlite3 (SQLite local)
- googleapis (Gmail API + Drive API — preparado, validado em smoke real C2)
- Vitest 3.0
- Commander 13.1

## Contratos locais
- `contracts/document-event.schema.json` — schema do evento de documento detectado
- `contracts/manifest.schema.json` — schema do manifest de Pedido

## Status atual
- HEAD (documents-ingestor): `61841b2` (em fechamento G12-E4)
- HEAD canônico staging/work/app-next (Controle de Tapetes): `997486a`
- Push staging: `af919a2..997486a` (produção/origin oficial intocados)
- 340+17=357 testes passando (28 suites) — incluindo integração mockada completa
- Hermético: nenhum teste depende de `.env` real, token real ou chamadas Google
- OAuth real validado (C1)
- Smoke real com Drive/Gmail reais validado (C2)
- Hardening de scan (caps, wide-scan guard, cross-msg dedup, run log) aplicado (D)
- Drive tests isolados de credenciais reais (D-R1)
- CI workflow criado (E)
- G5 taxonomy validado em real (R4-R1): retry por Gmail messageId confirmado funcional
- G12-B folder taxonomy paths: builders Recebidos/Pedidos com YYYY/MM/DD
- G12-C1: scan emite document.detected (pedido_manual=''); assign emite document.linked
- G12-D1: exportReceivedDocuments + CLI export-received (9 testes herméticos)
- G12-E1: design do export de documentos mapeados (read-only, zero alterações)
- G12-E2: exportMappedDocuments + CLI export-mapped (13 testes herméticos)
- G12-E3: diagnóstico de duplicata no export mapeado (causa raiz + queries before/after)
- G12-E4: hardening de dedup dentro do mesmo email + cleanup local da duplicata 5c3074bb

## Comandos disponíveis
- `npm run dev` — tsx watch
- `npm run scan` — scan (dry-run por padrão; use `--confirm-real-google` para real)
- `npm run list:pending` — lista documentos pendentes
- `npm run assign -- --id <id> --pedido <num> --confirm-real-google` — atribui Pedido (Drive real)
- `npm run link -- --id <id> --pedido <num>` — vincula documento a Pedido (local-only, sem Google)
- `npm run accept -- --id <id>` — aceita documento vinculado (local-only)
- `npm run reject -- --id <id> --reason "<motivo>"` — rejeita documento vinculado (local-only)
- `npm run export:events` — exporta eventos para JSONL
- `npm run login` — OAuth interativo (gera `data/google-token.json`)
- `npm test` — roda testes herméticos
- `npm run test:ci` — alias para CI
- `npm run test:watch` — modo watch

## Proibições permanentes
- Sem Supabase nesta fase
- Sem processamento automático de email
- Sem OCR
- Sem identificação automática de Pedido
- Sem watcher contínuo
- Sem uso de escopo `drive` (amplo)

## Última evidência de testes
```
Test Files  28 passed (28)
     Tests  357 passed (357)
```

## Decisão arquitetural
Não integrar Supabase nesta fase. O outbox JSONL é o contrato de integração. O app principal consumirá os eventos quando estiver pronto.

### Funil operacional (G6-C)
- **pending** → `link` → **assigned** → `accept` → **accepted** | `reject` → **rejected**
- `report` mostra: `pendingWithoutPedido`, `pendingAppAcceptance`, `documentsAccepted`, `documentsRejected`, `assignedByPedido`, `documentsByStatus`
- Eventos outbox: `document.detected`, `document.linked`, `document.accepted`, `document.rejected`

### Semântica de eventos (G12-C1)
- `document.detected` → emitido no **scan** (documento recebido, ainda não atrelado a Pedido). `pedido_manual=''` como sentinela.
- `document.linked` → emitido no **assign real** e **link local** (documento vinculado a Pedido). `pedido_manual=PED-XX-YYYY`.
- `document.accepted` / `document.rejected` → emitidos no **accept/reject** (decisão sobre documento vinculado).

## Fases concluídas
- A — Scaffold
- B — Gmail scan (dry-run)
- C1 — Login OAuth interativo
- C2 — Smoke real (1 email → Drive → assign → outbox)
- D — Hardening (caps, dedup, run log)
- D-R1 — Test isolation (drive.test.ts com fake Drive)
- E — CI mock integration (hermetic setup + integration test + workflow)
- F — UX (documents-ingestor operational UX)
- G1 — Taxonomia 3 eixos: types + contracts + storage (21 files, 152 testes)
- G2 — Classificação XML NF-e direção (entrada/saída via CNPJs)
- G3 — Drive folder layout hierarchical (pendentes + pedidos por tipo/direção)
- G4 — Manifest do Pedido (estrutura + add document ao manifest)
- G5 — Retry por Gmail messageId + validação real R4-R1 + crossMessageDuplicates tracking
- G6-B — Comando `link` local-only (vincular documento pending a pedido sem Drive)
- G6-B-R1 — Preservação de event_type/status no outbox export (fix `buildEventFromRow`)
- G6-C — Comandos `accept`/`reject` local-only + funil operacional no report
- G7-A — Diagnóstico de guardrails (direção NF, event_id, manifest, report)
- G7-B — Guardrails patch (warning direção, ingestion_event_id, report seções)
- G7-C — Smoke local sintético (funil pending→link→accept/reject→outbox→report validado)
- G7-C-R1 — Persistência de `reason` no re-export de document.rejected
- G8-A — Design de integração e sync (matriz link/assign/manifest/outbox/Drive/event_id)
- G8-B — Atualização de contrato (JSON schema + docs) refletindo estado real G6/G7
- G8-C — Polish operacional (filtro por pedido, export eventos filtrado, inspect com links Drive)
- G8-D — Smoke real-lite (link+accept local-only validados em documento real existente)
- G8-E — Pacote de handoff de integração (exemplos JSONL, regras de consumo, idempotência documentadas)
- G9-A — Design de sincronização manifest Drive (matriz opções, recomendação sync:manifest)
- G9-B — Manifest local exportável + sync scaffold (dry-run, comando sync:manifest, 8 testes)
- G9-C — Smoke real de manifest (sync real confirmado, manifest Drive publicado, 0 efeitos colaterais)
- G10-A — Design de integração Controle de Tapetes (modelo outbox, fonte de verdade, transporte, UI)
- G10-B — Pacote export:package (eventos + manifest + summary + README por pedido, 8 testes)
- G10-C — Smoke real-lite do export:package em PED-99-2026 (4 arquivos validados, 0 alterações)
- G12-A — Design da taxonomia futura de Drive (Recebidos + Pedidos com YYYY/MM/DD)
- G12-B — Path builders da taxonomia futura + testes (sem ativação no fluxo real)
- G12-C1 — Evento document.detected no scan + document.linked no assign (sem schema novo)
- G12-D1 — exportReceivedDocuments + CLI `export-received` (read-only, sem Drive, sem scan, sem schema)
- G12-E1 — Design do export de documentos mapeados (todos os status, com timestamps por evento)
- G12-E2 — exportMappedDocuments + CLI `export-mapped` (read-only, sem Drive, sem scan, sem schema, 13 testes)
- G12-E3 — Diagnóstico de data quality no export mapeado (causa raiz + queries before/after)
- G12-E4 — Hardening dedup dentro do mesmo email + cleanup local (5c3074bb removido após backup)
- G/H — UI Backlog (Controle de Tapetes — staging/work/app-next)

## Fase G1: Taxonomia de Documentos (3 eixos)
- **TipoDocumento**: `nf | romaneio | desconhecido` (novo) + legado (`nf_xml | nf_pdf`)
- **FormatoDocumento**: `pdf | xml | desconhecido`
- **DirecaoNF**: `entrada | saida | desconhecida`
- Helpers: `fromLegacyTipo()`, `toLegacyTipo()`, `formatoFromMimeType()`
- SQLite: colunas `formato`, `direcao_nf`; CHECK expandido para ambos legado e novo
- Contracts: suporte a `schema_version: 1` (legado) e `schema_version: 2` (novo)
- Commit: `2c8f316` — 21 files, 753 inserções, 208 remoções

## Fase G/H: UI Backlog Closeout (Controle de Tapetes)
- **TRANSFER-GRID-CELL-CENTER-R1** — CLOSED em `c8b45b6`
- **LINKED-OPS-FOOTER-BUTTONS-UX-F** — CLOSED em `e80b9de` + `55bc32b` + `997486a`
- **UI-BACKLOG-RECONCILIATION-G** — 14/14 itens fechados, 0 pendentes
- HEAD canônico staging/work/app-next: `997486a`
- Push staging: `af919a2..997486a`
- Produção/origin oficial: intocados
- Status residual esperado: `?? supabase/.temp/`

## Fase G12-E4: Document Dedupe Hardening (cleanup local)
- **HEAD inicial**: `61841b2`
- **Causa raiz**: o dedup index `(gmail_message_id, attachment_id, sha256)` permitia duplicata quando o mesmo arquivo físico (mesmo sha256 + mesmo gmail_message_id) reaparecia com `attachment_id` diferente (reprocessamento / attachment_id re-emitido pelo Gmail). O segundo documento entrava como `desconhecido` e ficava pendurado sem classificação, poluindo o export mapeado.
- **Nova regra** (`src/core/dedupe.ts` + `src/core/realScan.ts`): `isDuplicateInSameMessage(gmail_message_id, sha256)` bloqueia novo documento quando já existe registro com mesmo `gmail_message_id` e mesmo `sha256` (não vazio), mesmo que `attachment_id` seja diferente. Aplicado no fluxo de scan, antes do cross-message dedup.
- **Cross-message dedup preservado**: mesmo `sha256` em `gmail_message_id` diferente continua criando cross-message duplicate (reuso do Drive file) — comportamento desejado, não regredido.
- **Cleanup local** (read-only DB + DELETE por critério): removido `5c3074bb-76f5-4096-a50e-767a4be090ab` (status=pending, pedido_manual=NULL, 0 eventos, sha256=d71f327..., drive_file_id=1ao8qFfl..., classificação desconhecida, mesmo sha256/drive_file_id do cda18ef9 aceito). `cda18ef9` (accepted / PED-99-2026) preservado. `ec07577a` (L.pdf fixture) preservado.
- **Backup**: `data/app.db.backup-g12-e4-20260708-210928` (65536 bytes, idêntico ao DB pré-DELETE). Backup ignorado por `.gitignore` (nova regra `data/*.backup-*`).
- **Export regenerado**: `data/exports/documentos-mapeados.jsonl` agora tem 2 linhas (cda18ef9 + ec07577a); 5c3074bb removido. `npm run export:mapped` reporta `Exported 2 mapped document(s)`.
- **Não alterado**: `schema.sql`, `sqlite.ts` (migrations), `outbox.jsonl`, `realAssign.ts`, `manifest.ts`, `outbox.ts`, `link.ts`, `acceptance.ts`, `exportPackage.ts`, `cli.ts`, `index.ts`. Controle de Tapetes não tocado.
- **Não executado**: nenhuma chamada Gmail/Drive real, nenhum scan real, nenhum assign/accept/reject, nenhuma migration.
- **Testes**: 357 totais (28 suites), todos passando.
  - `tests/dedupe.test.ts` — 10/10 (5 novos para `isDuplicateInSameMessage`)
  - `tests/scan.test.ts` — 27/27 (2 novos G12-E4 + 1 existente ajustado)
  - `tests/export-mapped.test.ts` — 13/13
  - `tests/export-received.test.ts` — 9/9
- **Riscos remanescentes**: pré-existente (não introduzido por este patch) — `src/core/realAssign.ts:117` chama `addDocumentToManifest('/dev/null', ...)`, que falha em Windows porque `/dev/null` aponta para um arquivo com lixo. Testes `assign-real.test.ts`, `cli-ops.test.ts`, `integration-mock-flow.test.ts` falham por isso em Windows; deveriam usar `os.devNull` (fase futura).
- **Próxima fase recomendada**: G12-E5 — corrigir `realAssign.ts:117` para usar `os.devNull` cross-platform (eliminar falha pré-existente nos testes de assign em Windows).

## Próxima fase recomendada
RAVATEX-DOCUMENTS-G12-F-MAPPED-DOCUMENTS-CONSUMER (G12-E4 primeiro fecha o hardening de dedup; a integração no Controle de Tapetes continua opcional e read-only).
Foco: integração opcional do `documentos-mapeados.jsonl` (e/ou `documentos-recebidos.jsonl`) no Controle de Tapetes para exibir a fila de documentos com status, pedido, timestamps por evento e `rejected_reason` (read-only, sem mutação, mesmo contrato JSONL).
