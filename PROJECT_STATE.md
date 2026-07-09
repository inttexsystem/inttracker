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
- HEAD (documents-ingestor): `bedbe909` (fechamento G13-D, produtor `sync:mapped` pronto)
- HEAD canônico staging/work/app-next (Controle de Tapetes): `fff052b` (consumidor bridge G14-D pronto)
- Push staging: `a6574fd..fff052b` via G14-D (produção/origin oficial intocados)
- 340+17+23=380 testes passando (29 suites) — incluindo integração mockada completa
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
- G12-E5: correção cross-platform do `/dev/null` em realAssign (os.devNull)
- G13-A: design do comando `sync:mapped` (read-only)
- G13-B: comando `sync:mapped` (CLI + script + 23 testes)
- G13-C-R1: smoke real-lite do `sync:mapped` (isolamento confirmado, 0 mutação)
- G13-D: documentação operacional do `sync:mapped` (README + contratos)
- G14-A/G14-B/G14-C/G14-D: **consumidor implementado no Controle de Tapetes** (bridge flat → Pedido Detail, staging publicado, ver Controle de Tapetes PROJECT_STATE.md)

## Comandos disponíveis
- `npm run dev` — tsx watch
- `npm run scan` — scan (dry-run por padrão; use `--confirm-real-google` para real)
- `npm run list:pending` — lista documentos pendentes
- `npm run assign -- --id <id> --pedido <num> --confirm-real-google` — atribui Pedido (Drive real)
- `npm run link -- --id <id> --pedido <num>` — vincula documento a Pedido (local-only, sem Google)
- `npm run accept -- --id <id>` — aceita documento vinculado (local-only)
- `npm run reject -- --id <id> --reason "<motivo>"` — rejeita documento vinculado (local-only)
- `npm run export:events` — exporta eventos para JSONL
- `npm run export:mapped` — exporta `data/exports/documentos-mapeados.jsonl` (snapshot read-only)
- `npm run sync:mapped` — scan + export mapped + report em um comando (dry-run padrão; suporta `--retry-message` narrow)
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
Test Files  29 passed (29)
     Tests  370 passed (370)
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
- G12-E5 — Correção `/dev/null` cross-platform em realAssign (os.devNull, 1 linha + 1 import)
- G13-A — Design do comando `sync:mapped` (mapeamento read-only de scan/export/report)
- G13-B — Comando `sync:mapped` (CLI + script npm + 23 testes focados; dry-run padrão; retry-message narrow)
- G13-C-R1 — Smoke real-lite do `sync:mapped` com MESSAGE_ID autorizado (1 doc duplicado detectado, isolamento confirmado, 0 mutação)
- G13-D — Documentação operacional do `sync:mapped` (README + PROJECT_STATE + AGENT_HANDOFF + contrato)
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
- **Riscos remanescentes**: ~~`src/core/realAssign.ts:117` usava `/dev/null` (falhava em Windows).~~ Corrigido em G12-E5 (substituído por `os.devNull`).
- **Próxima fase recomendada**: G12-E5 — corrigir `realAssign.ts:117` para usar `os.devNull` cross-platform (eliminar falha pré-existente nos testes de assign em Windows).

## Fase G12-E5: Dev Null Cross-Platform Fix (patch 1 linha)
- **HEAD inicial**: `800d4af`
- **Causa raiz**: `realAssign.ts:117` usava path literal `'/dev/null'` que não é um dispositivo nulo real em Windows (aponta para arquivo comum com lixo residual de sessões PowerShell anteriores). `loadManifest('/dev/null')` fazia `JSON.parse()` sobre conteúdo binário randômico → `SyntaxError: is not valid JSON`.
- **Correção**: importado `os` de `node:os`; substituído `'/dev/null'` por `os.devNull` (dispositivo nulo cross-platform, suportado desde Node.js 0.x).
- **Arquivo alterado**: `src/core/realAssign.ts` (+1 import, -1 string literal).
- **Não alterado**: `schema.sql`, `sqlite.ts`, `outbox.jsonl`, `cli.ts`, `exportPackage.ts`, `manifest.ts`, DB, backup. Controle de Tapetes não tocado.
- **Não executado**: nenhuma chamada Gmail/Drive, nenhum scan real, nenhum assign/accept/reject.
- **Testes corrigidos**:
  - `tests/assign-real.test.ts` — 8/8 passando (eram 5/8 falhando por `loadManifest('/dev/null')`)
  - `tests/integration-mock-flow.test.ts` — 3/3 passando (eram 2/3 falhando pelo mesmo motivo)
- **Regressão verificada**: `tests/export-mapped.test.ts` 13/13, `tests/dedupe.test.ts` 10/10.
- **Risco residual**: nenhum. `os.devNull` é suportado em todas as plataformas desde Node.js 0.x.

## Fase G13-A: Sync Mapped Command Design (read-only)
- **HEAD inicial**: `c2f89b4`
- **Atividade**: mapeamento read-only dos blocos existentes (scan / export-mapped / assign / report / retry-message) e proposta de `sync:mapped`. Documento de design entregue ao arquiteto.
- **Não alterado**: nenhum arquivo (apenas leitura).
- **Próxima fase recomendada**: G13-B — implementar `sync:mapped` (CLI + script + testes focados) com dry-run padrão e guards de retry-message.

## Fase G13-B: Sync Mapped Command Implementation
- **HEAD inicial**: `c2f89b4`
- **Objetivo**: comando único local `npm run sync:mapped` que orquestra `scan → export mapped → report` em sequência, com dry-run por padrão, sem tocar Controle de Tapetes.
- **Arquivos alterados (3) + 1 novo**:
  - `src/core/syncMapped.ts` (**novo**, 112 linhas) — orquestrador puro com `validateSyncMappedOptions()`, `buildScanOptions()`, `buildExportOptions()`, `runSyncMapped(opts, deps)`. Aceita deps injetáveis para teste.
  - `src/cli.ts` (+~140 linhas no final) — comando `sync-mapped` com banner dry-run, guards de retry-message, propagação de opções a scan/export/report, impressão de report formatado ou JSON.
  - `package.json` (+1 script) — `"sync:mapped": "tsx src/cli.ts sync-mapped"`.
  - `tests/sync-mapped.test.ts` (**novo**, 23 testes) — validação, opções de scan, opções de export, sequência scan→export→report, guards de retry-message (com days, com wide-scan, com query), wiring de package.json, end-to-end com DB hermético (escrita real de JSONL e report).
- **Comportamento**:
  - Dry-run por padrão; `scan()` é chamado com `confirmReal=false` e retorna mode='dry-run'.
  - `--confirm-real-google` propaga para `scan()`; sem isso, zero chamadas Gmail/Drive.
  - `--retry-message` força `daysBack=1` internamente (sem precisar de --days).
  - `--retry-message + --days > 1` falha com mensagem clara.
  - `--retry-message + --wide-scan` falha.
  - `--retry-message + --query` falha.
  - Sequência explícita: scan → export → report.
  - `result.sequence: ['scan', 'export', 'report']` retornado no envelope.
- **Não alterado**: `schema.sql`, `sqlite.ts` (migrations), `realScan.ts`, `realAssign.ts`, `manifest.ts`, `outbox.ts`, `link.ts`, `acceptance.ts`, `exportPackage.ts` (núcleo intocado), `index.ts`, `data/app.db`, `data/app.db.backup-*`, `data/outbox/`, `data/exports/documentos-mapeados.jsonl`. Controle de Tapetes não tocado.
- **Não executado**: nenhuma chamada Gmail/Drive real, nenhum scan real, nenhum assign/accept/reject, nenhuma migration, nenhum push, nenhum `git reset/rebase/stash/clean`. Backup local preservado.
- **Testes**:
  - `tests/sync-mapped.test.ts` — 23/23 passando (novo arquivo).
  - `tests/scan.test.ts` — 27/27 (regressão verificada).
  - `tests/dedupe.test.ts` — 10/10 (regressão verificada).
  - `tests/export-mapped.test.ts` — 13/13 (regressão verificada).
  - **Total**: 370 testes / 29 suites, todos passando (`+23` novos).
- **Riscos remanescentes**: nenhum. Implementação é integração de blocos já validados (scan, export-mapped, report) sem alteração de semântica.
- **Próxima fase recomendada**: G13-C — smoke real-lite do `sync:mapped` em uma mensagem real (similar a C2 do G12).

## Fase G13-C-R1: Sync Mapped Smoke Real-Lite
- **HEAD inicial**: `7cc673f` (em fechamento G13-B)
- **Objetivo**: validar `npm run sync:mapped -- --confirm-real-google --retry-message <MESSAGE_ID> --max-attachments 1` em ambiente real-lite, sem scan amplo.
- **MESSAGE_ID autorizado pelo operador**: `19f3c813e8d45be1` (do smoke G5 R4-R1 / C2).
- **Sequência executada**:
  1. Dry-run: `npm run sync:mapped -- --retry-message 19f3c813e8d45be1 --max-attachments 1` → 25ms, mode=dry-run, banner narrow.
  2. Real-lite: `npm run sync:mapped -- --confirm-real-google --retry-message 19f3c813e8d45be1 --max-attachments 1` → 1934ms, `emailsScanned=1 newDocuments=0 duplicates=1 crossMessageDuplicates=0 skippedByCap=0 errors=0`.
  3. Validações pós-smoke: `export-mapped` (2 docs), `report --days 1` (9 emails, 2 docs, 0 erros), `list-pending --limit 20` (mesmos 2 docs).
- **Run log gerado**: `data/runs/run-2026-07-09T13-25-28-394Z.jsonl` (6 eventos: run.start, retry.direct_fetch, retry.start, attachment.processed, email.scanned, run.end).
- **Verificações de segurança**:
  - Scan amplo ocorreu? **NÃO** — `fetchMessageById` direto, sem `after:YYYY/MM/DD`.
  - retry-message isolou uma mensagem? **SIM** — `emailsScanned=1`.
  - Documento duplicado criado? **NÃO** — `newDocuments=0`, dedupe `duplicate_same_message` detectado.
  - Backup local `data/app.db.backup-g12-e4-20260708-210928` preservado? **SIM**.
  - DB inalterado em conteúdo? **SIM** — 65536 bytes (mesmo do pré-smoke); nenhum INSERT novo.
  - Controle de Tapetes tocado? **NÃO**.
  - Schema alterado? **NÃO** (apenas UPDATE trivial em `emails_processados.attachments_count`, esperado pelo fluxo retry).
  - Push realizado? **NÃO**.
  - `git add .` / `reset` / `rebase` / `stash` / `clean`? **NENHUM**.
- **Não executado**: nenhuma chamada ampla, nenhuma deleção, nenhuma migration.
- **Testes**: suíte completa não rodada neste smoke (read-only + real-lite). Suíte hermética prévia: 370/29 suites passando.
- **Riscos remanescentes**: nenhum. Smoke validou isolamento, dedupe, persistência e geração de JSONL.
- **Próxima fase recomendada**: G13-D — documentação operacional do `sync:mapped` (README + PROJECT_STATE + AGENT_HANDOFF + contrato).

## Fase G13-D: Sync Mapped Operational Documentation
- **HEAD inicial**: `7cc673f` (inalterado desde G13-B; G13-C-R1 não fez commit)
- **Objetivo**: documentar o fluxo operacional do `npm run sync:mapped` para futuros operadores e para a próxima fase de integração com o Controle de Tapetes.
- **Arquivos alterados (4)**:
  - `README.md` (+~70 linhas) — nova seção 7 "Sincronização local em um comando (`sync:mapped`)" com 7 sub-seções: dry-run, real mode, retry narrow, guardas de segurança, saída/contrato, relação com outros comandos, limites fora de escopo. Tabela de "Segurança operacional" e "Operação diária" atualizadas. Exemplos atualizados.
  - `PROJECT_STATE.md` (+~30 linhas) — registro das fases G13-C-R1 e G13-D; nova seção dedicada a G13-C-R1 (smoke real-lite).
  - `AGENT_HANDOFF.md` (+~80 linhas) — registro das fases G13-C-R1 e G13-D; nova seção G13-C-R1 (smoke) e G13-D (docs) com `Fase concluída = G13-D`.
  - `docs/CONTROL_TAPETES_DOCUMENTS_CONTRACT.md` (+~45 linhas) — nova subseção 4.4 "Sincronização local em um comando (`sync:mapped`)" + entradas em "Fases concluídas" (G13-A/B/C-R1/D) e em "Comandos úteis" + nota explícita em "O que NÃO será feito" sobre não consumir automaticamente o JSONL.
- **Não alterado**: `src/**` (zero alterações de código), `tests/**` (zero alterações), `schema.sql`, `data/**` (zero mutações), `package.json` (zero alterações). Controle de Tapetes não tocado.
- **Não executado**: nenhuma chamada Gmail/Drive, nenhum scan real, nenhum assign/accept/reject, nenhuma migration, nenhum push, nenhum `git add .`, nenhum `reset/rebase/stash/clean`. Backup local preservado.
- **Documentação do contrato**:
  - Dry-run padrão com saída esperada (banner + 3 steps + DONE).
  - Real-lite com `--confirm-real-google` (gate duplo: flag CLI + env `INGEST_REAL_GOOGLE`).
  - Retry narrow com `--retry-message <id>` — `days=1` automático, sem query amplo.
  - 4 guardas de segurança de `--retry-message` (com `--days > 1`, `--wide-scan`, `--query`, ou sem flag → narrow).
  - Saída `data/exports/documentos-mapeados.jsonl` (JSONL, `schema_version: 1`, timestamps por evento).
  - Relação com `export:mapped`, `report`, `list-pending` (equivalência de comandos).
  - Limites: não toca Controle, não cria scheduler, consumo automático é fase posterior.
- **Riscos remanescentes**: nenhum. Documentação é apenas textual.
- **Próxima fase recomendada**: G14-A — design de integração `sync:mapped` ↔ Controle de Tapetes (fase futura, não implementar nesta rodada).

## Próxima fase recomendada
RAVATEX-DOCUMENTS-G14-CLOSEOUT (já concluída via fases G14-A a G14-D no Controle de Tapetes)
- Produtor `sync:mapped` pronto (HEAD `bedbe909`, master, sem remote staging)
- Consumidor bridge flat → Pedido Detail pronto (HEAD `fff052b`, work/app-next, staging publicado)
- Próximo roadmap: UX de último import/timestamp/hash no Controle; `ingestion_event_id` no JSONL como melhoria futura; aceite/rejeição dentro do Controle como feature posterior.
