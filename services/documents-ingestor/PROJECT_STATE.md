# PROJECT STATE

> **Atualizacao 2026-07-11 — G27-D3 — DOCUMENTATION-ONLY PATCH — G27-B-CORE CLOSED/ACCEPTED TECHNICALLY.**
> Status: **arquitetura G27-B2-R1 e G27-B-CORE-GATE-R1 aceitas; G27-B-CORE CLOSED/ACCEPTED TECHNICALLY.**
>
> - HEAD tecnico `21f6a7dfb879e78fb1d142828818e40fce9824fc` publicado diretamente em `staging/work/app-next` a partir da worktree isolada `work/g27-document-recognition-safety`.
> - Primeiro CI workflow Documents Ingestor Tests: run `29172909813`, evento `push`, branch `work/app-next`, SHA `21f6a7dfb879e78fb1d142828818e40fce9824fc`, conclusao `success`, 40 files / 812 tests. URL: https://github.com/ravatexapps-dotcom/controle-tapetes-staging/actions/runs/29172909813
> - Parsing estrutural XML completo a partir do Buffer integral ja baixado; PDF limitado ao prefixo inicial de 2048 bytes; `processEntities: false`; validacao checksum CNPJ.
> - Build debt preexistente verificado: conjunto identico de 8/8 erros TypeScript em baseline e G27.
> - Workspace original permanece em quarentena, inalterado. Nenhum `origin` ou force push. `work/app-next` local nao atualizado; `staging/work/app-next` remoto e a referencia publicada.
> - Branch G27 preservada. Diretorio residual `controle-tapetes-g27-build-baseline` permanece debito de cleanup; metadata orfa `baseline-worktree` (`.git/worktrees/baseline-worktree`) e debito separado de cleanup.
>
> **Debitos futuros separados:**
> - Persisted qualification
> - Review UI
> - Manifest accumulation
> - Historic TypeScript build
> - npm vulnerabilities
> - Worktree cleanup
>
> **Atualizacao 2026-07-11
> `G26-C-D — FINAL MONOREPO CLOSEOUT DOCUMENTATION`.**
> Status: **G26-C CLOSED — INTEGRADO E VALIDADO EM STAGING**.
> Branch/HEAD final local e remoto: `work/app-next` (`8f1df9b6d9e80444b31ed69f3187fa52183023fb`).
>
> **Monorepo Incorporation:**
> - O Documents Ingestor agora pertence ao monorepo `controle-tapetes` no path
>   `services/documents-ingestor`.
> - O repositorio antigo (`D:\OneDrive\Programação\Ravatex\documents-ingestor`)
>   permanece preservado apenas para consulta/transicao.
> - Branch integrada: `work/app-next`.
> - HEAD final local/remoto: `8f1df9b`.
> - Runtimes continuam separados (Node.js 22.22.3 independente dentro do servico).
> - `.env` do worker permanece dentro do servico (`services/documents-ingestor/.env`).
> - Nao existem npm workspaces.
> - Wrapper: `scripts/ingestor.bat`.
> - Workflow: `.github/workflows/documents-ingestor-test.yml`.
> - Suite completa atual: 673/673.
>
> **Debitos pendentes:**
> - 4 vulnerabilidades moderadas do npm audit.
> - Metadata orfa `.git/worktrees/baseline-worktree`.
> - Projecao futura de sha256 e attachment_id.
> - Repositorio antigo ainda preservado.
> - Acumulacao do manifest remoto continua debito separado; `8f1df9b` eliminou
>   `os.devNull` e inclui o documento no payload enviado.
> - Aviso de deprecacao interno das actions v4 (Node 20) nao bloqueou o CI.
>
> **Evidencia remota:**
> - Run `29157931768` falhou por `tsx.cmd` hardcoded e `/dev/null` vazio via
>   `os.devNull` no Linux.
> - Commit `8f1df9b` corrigiu ambos; run `29158174870` (push) concluiu
>   `success` com 39 arquivos / 673 testes para o SHA final.
> - Push somente para `staging/work/app-next`, sem `origin` e sem force push.
>
> **Proximo passo:** G26 closed; manter o repositorio antigo preservado para transicao.

## RAVATEX-DOCUMENTS-G25-B1-UX-C-B-TEST-CLEANUP-CLOSEOUT (2026-07-10)

- Status: **CONCLUIDO - LIMPEZA DE DOCUMENTOS DE TESTE (STAGING) AUTORIZADA E EXECUTADA**.
- Escopo: exclusao escopada de 3 documentos de teste, autorizada pelo operador (G25-B1-UX-C-B), somente em SQLite local e Supabase staging (`ucrjtfswnfdlxwtmxnoo`). Producao (`bhgifjrfagkzubpyqpew`) bloqueada por guarda de ref antes de cada operacao; nunca contatada.
- Allowlist exclusiva (3 `document_id`):
  - `cda18ef9-d1d9-4f5a-8956-74875cd60b05` - teste-nfe-entrada.xml (era `accepted`, pedido_manual `PED-99-2026`, `pedido_id` null).
  - `6c871580-6734-40f8-9cac-9fbf27daaa21` - pdf143429.pdf (`pending`, assunto "Teste Ravatex Smoke - NF 123").
  - `40ed90ab-049c-40c2-a3a2-74481f528f87` - TESTE-G25-B1-20260710-1536.pdf (`pending`; sha256 compartilhado com doc legitimo).
- Reversao do aceite (cda18ef9): o fluxo canonico `desfazer_decisao_documento` foi diagnosticado **nao aplicavel e nao alcancavel** neste dado - exige `is_admin()` (o Ingestor usa `service_role`, `auth.uid()` null -> `admin_required`) e exige decisao ativa em `document_decisions` (havia 0; o aceite era ingestor-side via status + eventos). Com `pedido_id` null (sem Pedido/OP real vinculado), o operador autorizou **exclusao direta escopada**; o estado `accepted` foi removido pela propria exclusao, sem tocar Pedido/OP.
- Removido (exato):
  - SQLite: 3 `documentos` + 4 `ingestion_events` = 7 linhas (transacional, com assercao de contagem por ID e ROLLBACK-on-mismatch).
  - Supabase staging: 3 `document_candidates` + 2 `document_events` = 5 linhas (delete keyed por `document_id`).
- Preservado e verificado intacto:
  - Doc legitimo `e9c0922c-6d1d-4801-ab91-ea17cf20306b` / `cce-001_000006192-1_S_1.pdf`, Drive `1v7KQ2...`, sha256 compartilhado `efa7f31f13...` (mesmo conteudo do teste 40ed90ab, mas Drive/mensagem distintos).
  - `L.pdf` (MESSAGE_NOT_FOUND) preservado, `pending`.
- Auditoria pos-execucao: SQLite `documentos` 40 -> 37; Supabase `document_candidates` 40 -> 37; os 3 IDs ausentes nos dois bancos; 0 eventos orfaos; `pedidos`=5 e `ops`=7 inalterados.
- Google Drive: **nenhuma chamada** (Drive IDs apenas lidos do banco; nenhum arquivo fisico do Drive removido). Gmail: nenhuma chamada. Nenhum novo scan.
- Watcher: parado pelo script oficial antes da exclusao (`watcher_instances=0`) e retomado apos (`watcher_instances=1`, worker pid 10620); `active_gmail_requests=0` antes e depois. Backup pre-exclusao do SQLite: `data/app.db.backup-g25b1uxcb-20260710-182109`.
- Producao intocada; nenhum push; `git add` restrito aos arquivos de documentacao.
- Encerramento: **G25-B1-UX-A** e **G25-B1-UX-C** (A + B) encerrados.
- Proximo passo: **G25-B2 - RELEVANCE CLASSIFIER V1**.

## RAVATEX-DOCUMENTS-G24-B2-SCAN-REQUEST-WATCHER-CLOSEOUT (2026-07-10)

- Status: **PRONTO - WATCHER DE SOLICITACOES DE SCAN**.
- HEAD inicial: `dfc2e648554e7ea987bca34a14263f5344c92b8e`; commit tecnico: `6886354` (`Add document scan request watcher`).
- Entrega: comando `watch:scan-requests` com `--once` para operacao manual controlada, gates explicitos de Gmail e Supabase, claim atomico, associacao request->run e finalizacao da solicitacao em sucesso ou falha.
- Seguranca operacional: nenhum Gmail, Drive ou Supabase real foi usado. A migration 41 permanece versionada, mas **nao aplicada**.
- Evidencia: suites focadas verdes - watcher 22/22, CLI 7/7, sync Supabase 24/24, export/sync mapped 48/48 (101 testes).
- Proximo passo: G24-B3 - frontend para disparar a RPC autenticada, acompanhar a request por polling e recarregar a lista de documentos.

## RAVATEX-DOCUMENTS-G23-F-D-SCAN-RUN-STALE-LOCK-RECOVERY-PATCH (2026-07-09)

- Status: **PRONTO — RECOVERY RPC + FLAGS DO WRITER PARA STALE LOCKS EM document_scan_runs**.
- HEAD tecnico Ingestor: `master` em `ea4f1d2ced154194358fe90df714bfba41d74ae3` (HEAD inicial `b573b9958bb5c1a219ee057d423d6563968f2dd0`).
- HEAD canonico de referencia no Controle: `work/app-next` em `aa62793f251e4643037f421cd8ec419406ea9911` (HEAD inicial `2ae80d9f165cae9b926e2a1fcffae17979cb5eba`).

- Escopo G23-F-D (Ingestor):
  - `src/supabase/serviceRoleClient.ts`: wrapper da RPC `recuperar_document_scan_runs_travados` com defaults canonicos (`p_source = null`, `p_stale_after = 30 minutes`) e piso de 5 minutos aplicado no client. Mantem `service_role` e nao consulta/escreve `document_scan_runs` diretamente; toda a logica de destravamento vive no backend.
  - `src/core/syncSupabase.ts`: quando `--recover-stale` esta ativo, chama a RPC antes do scan. Skips de candidatos sem base completa sao preservados. Nenhum INSERT/UPDATE direto em `document_scan_runs`; apenas a RPC realiza o destravamento.
  - `src/cli.ts`: novas flags `sync:supabase --recover-stale` (boolean) e `--stale-after-minutes <N>` (int). Default canonico `30`. Piso `5` (valores menores sao coercidos a 5 com aviso).
  - `docs/SUPABASE_WRITER_RUNBOOK.md`: secao dedicada a `--recover-stale` / `--stale-after-minutes`, ao piso de 5 minutos, ao retorno JSONB da RPC e a politica de apply (somente staging no G23-F-E).
  - `tests/sync-supabase.test.ts`: 24/24 passando — defaults, piso 5min, coercion, idempotencia, nao-interferencia com skips de candidatos incompletos, ausencia de writes diretos em `document_scan_runs`.

- Causa raiz:
  - O writer cria `status='running'` em `document_scan_runs` e depende do indice unico parcial `document_scan_runs_running_source_uidx` (`db/38`) para impedir concorrencia por source. Se o processo cair entre o INSERT e a finalizacao, a linha fica `running` para sempre e bloqueia todo scan futuro daquela source. A RPC entregue no Controle entrega destravamento self-heal; o Ingestor apenas a invoca quando `--recover-stale` esta ativo.

- Contrato com a RPC (canonica no Controle):
  - RPC `public.recuperar_document_scan_runs_travados(p_source TEXT DEFAULT NULL, p_stale_after INTERVAL DEFAULT INTERVAL '30 minutes')`.
  - Compare-and-swap `running` -> `failed` com `FOR UPDATE SKIP LOCKED` + reconfirmacao `status = 'running'`.
  - Default canonico: **30 minutos**. Piso: **5 minutos**.
  - Auditoria: `error_message` recebe sentinela `stale_recovered: exceeded <stale_after>, started_at=<ISO Z>`. Reusa `status = 'failed'` (sem mexer no CHECK de `db/38`).
  - Grants: `service_role` e `authenticated`; `PUBLIC`/`anon` revogados.

- Migration 40: **VERSIONADA, MAS NAO APLICADA** nesta fase. Aplicar **somente em staging** no G23-F-E.

- Arquivos alterados nesta fase (Ingestor):
  - `docs/SUPABASE_WRITER_RUNBOOK.md`
  - `src/cli.ts`
  - `src/core/syncSupabase.ts`
  - `src/supabase/serviceRoleClient.ts`
  - `tests/sync-supabase.test.ts`

- Arquivos alterados nesta fase (Controle, registro sincrono):
  - `db/40_document_scan_runs_stale_recovery.sql` (novo, 117 linhas).

- Confirmacoes:
  - Producao intocada. Gmail, Drive e Supabase real **nao utilizados** nesta fase (RPC nao aplicada, nenhuma chamada remota, nenhuma credencial real).
  - Migration 40 versionada mas **nao aplicada** (apply somente em staging, no G23-F-E).
  - Testes: Ingestor `tests/sync-supabase.test.ts` **24/24**; Controle suite acumulada **431/431** (sem regressao).
  - Sem push, sem `git add .`, sem `git add -A`.

- Ressalva obrigatoria: a RPC foi especificada e versionada, e o writer foi preparado para invoca-la. A **concorrencia real ainda depende do smoke staging** a ser executado no G23-F-E. O piso de 5 minutos e a protecao `FOR UPDATE SKIP LOCKED` sao contratos logicos, nao verificados contra carga real ate G23-F-E.

- Proximo passo: G23-F-E — STAGING SMOKE. Aplicar a migration 40 no projeto staging do Supabase e exercitar `--recover-stale` + `--stale-after-minutes` em cenario real com run orfao simulado, validando destravamento e idempotencia concorrente.

## G23-B-F-R2 Canonical Ingestion Events Export

- `npm run export:ingestion-events` creates `data/exports/ingestion-events.jsonl` exclusively from SQLite `ingestion_events`.
- Each line preserves `ingestion_events.id` as `ingestion_event_id`; no synthetic IDs and no legacy `event_id` fallback exist.
- The export normalizes `pending_app_acceptance` to `pending` and forces `document.linked` to `assigned`.
- `sync:supabase --events` must use this file, never `data/outbox/document-events.jsonl`.
- The writer remains server-side and staging-only; Gmail, Drive, production, and frontend service-role usage remain out of scope.

## Objetivo
Ingerir documentos (XML/PDF) recebidos por email (Gmail), classificar, permitir atribuição manual a Pedido e gerar eventos para integração futura com o app principal (Controle de Tapetes).

## Workspace
D:\OneDrive\Programação\Ravatex\controle-tapetes\services\documents-ingestor

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
- HEAD (documents-ingestor): `fa54b09` (G21-B latest manifest producer patch)
- HEAD anterior: `bedbe909` (fechamento G13-D, produtor `sync:mapped` pronto)
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
- `npm run sync:mapped` — scan + export mapped + report em um comando (dry-run padrão; suporta `--retry-message` narrow e `--write-latest`)
- `npm run write:latest` — gera `data/exports/latest.json` com metadados (count, hash, bytes, timestamp) do export mapped (local-only)
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
     Tests  374 passed (374)
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

## Fase G17-A: Ingestion Event ID Export Design (read-only)
- **HEAD inicial**: `4346275`
- **Objetivo**: mapear como incluir `ingestion_event_id` no `documentos-mapeados.jsonl` sem quebrar o Controle de Tapetes.
- **Diagnóstico G17-A**:
  - `ingestion_events.id` é UUID estável, imutável desde inserção.
  - `exportMappedDocuments` já faz JOIN com `ingestion_events` (subqueries para timestamps), mas **não seleciona `e.id`**.
  - Controle de Tapetes ignora campos extras (validador allowlist, bridge não lê `ingestion_event_id`).
  - Recomendado: 5 campos opcionais (`latest_ingestion_event_id`, `detected_ingestion_event_id`, `linked_ingestion_event_id`, `accepted_ingestion_event_id`, `rejected_ingestion_event_id`), `schema_version: 1` mantido.
- **Não alterado**: nenhum arquivo (read-only).
- **Próxima fase**: G17-B — implementar patch.

## Fase G17-B: Ingestion Event ID Export Patch
- **HEAD inicial**: `4346275`
- **Objetivo**: adicionar IDs de `ingestion_events` ao mapped export.
- **Campos adicionados** (5, todos `string | null`):
  - `latest_ingestion_event_id` — evento mais recente do documento.
  - `detected_ingestion_event_id` — evento `document.detected`.
  - `linked_ingestion_event_id` — evento `document.linked`.
  - `accepted_ingestion_event_id` — evento `document.accepted`.
  - `rejected_ingestion_event_id` — evento `document.rejected`.
- **schema_version**: mantido `1` (retrocompatível).
- **SQL**: 5 subqueries adicionadas em `listMappedDocuments()` com tie-breaker por `id` para determinismo.
- **Arquivos alterados**:
  - `src/core/exportPackage.ts` — `MappedDocumentRow` + SQL.
  - `tests/export-mapped.test.ts` — 3 novos testes + asserções expandidas.
  - `docs/CONTROL_TAPETES_DOCUMENTS_CONTRACT.md` — nova seção 4.5.
  - `PROJECT_STATE.md` — este registro.
  - `AGENT_HANDOFF.md` — registro G17-A/B.
- **Não alterado**: `schema.sql`, `sqlite.ts`, `types/event.ts`, `outbox.ts`, `link.ts`, `acceptance.ts`, `cli.ts`, Controle de Tapetes, DB, backups.
- **Não executado**: Gmail/Drive real, push, `git add .`, `reset/rebase/stash/clean`.

## Fase G17-C: Ingestion Event ID Export Smoke (read-only)
- **HEAD**: `e6b135d` (mesmo HEAD G17-B)
- **Objetivo**: validar JSONL real com os novos campos opcionais.
- **Resultado**: 2 linhas, `schema_version: 1`, 5 campos novos presentes, `null` onde sem evento. Testes `export-mapped.test.ts`: 17/17 pass.
- **Não alterado**: nenhum arquivo (smoke read-only).
- **Próxima fase**: G18 — consumo no Controle de Tapetes.

## Fase G21-A: Basic Auto Scan Flow Design (read-only)
- **HEAD inicial**: `e6b135d` (fechamento G17)
- **Objetivo**: definir o menor caminho real para entregar o básico: email → scan automático → documentos candidatos → tela do usuário.
- **Diagnóstico**:
  - Ingestor: CLI pronta com `sync:mapped`, SQLite local, Gmail/Drive OAuth. Zero HTTP/daemon/endpoint.
  - Controle: File picker manual (botão "Importar documentos") → `window.RAVATEX_DOCUMENTS_RECEIVED`. Sem HTTP fetch, sem auto-load, sem detecção de atualização.
  - Bloqueio: sem trigger automático, sem transporte entre os dois módulos, sem detecção de novos dados no Controle.
- **Arquitetura recomendada**: Task Scheduler → `sync:mapped` → `write:latest` → manifest `latest.json` → Controle `fetch` + timestamp.
- **Não alterado**: nenhum arquivo (read-only).

## Fase G21-B: Latest Manifest Producer Patch
- **HEAD inicial**: `fa54b09`
- **Objetivo**: implementar geração de `data/exports/latest.json` com metadados (count, hash, bytes, timestamp) do último export mapped, sem tocar Gmail/Drive.
- **Arquivos alterados (5) + 1 novo**:
  - `src/core/latestManifest.ts` (**novo**, 140 linhas) — `buildLatestManifestFromJsonl(jsonlPath, options)`, `writeLatestManifest(opts)`. Lê JSONL, conta, hash SHA256, escreve manifest.
  - `src/cli.ts` (+~2 imports, +~25 linhas para `write-latest`, +~1 option `--write-latest` em `sync-mapped`, +~15 linhas de integração no body).
  - `src/index.ts` (+2 exports).
  - `package.json` (+1 script `write:latest`).
  - `tests/latest-manifest.test.ts` (**novo**, 25 testes) — buildLatestManifestFromJsonl (18) + writeLatestManifest (7).
  - `README.md` (+~55 linhas) — seção 7.8, tabelas de segurança e operação, quick reference.
  - `PROJECT_STATE.md` (+~30 linhas) — este registro G21.
  - `AGENT_HANDOFF.md` (+~50 linhas) — registro G21-A/B.
- **Manifest esperado**:
  ```json
  {
    "schema_version": 1,
    "kind": "documents-mapped-latest",
    "generated_at": "ISO",
    "exported_at": "ISO (file mtime)",
    "jsonl_path": "data/exports/documentos-mapeados.jsonl",
    "jsonl_filename": "documentos-mapeados.jsonl",
    "count": 2,
    "hash": "sha256 hex 16 chars",
    "bytes": 1234,
    "last_error": null
  }
  ```
- **Integração com sync:mapped**: flag `--write-latest` gera `latest.json` após o step 2 (export). Warning logado se JSONL ausente/inválido, sem quebrar fluxo.
- **Não alterado**: Controle de Tapetes, schema.sql, sqlite migrations, Gmail/Drive connectors, realScan.ts, syncManifest.ts, exportPackage.ts, DB, backups.
- **Não executado**: Gmail/Drive real, push, `git add .`, `reset/rebase/stash/clean`.
- **Testes**: 25/25 latest-manifest, regressão verificada em export-mapped (17/17), sync-mapped (23/23). Total suite: 399/399 (30 files).

## Próxima fase recomendada
RAVATEX-DOCUMENTS-G22-A-AUTO-LOADER-DESIGN (Controle de Tapetes, read-only)
- Produtor `sync:mapped` pronto (HEAD fa54b09, master)
- `latest.json` gerado com metadados count/hash/bytes/timestamp (G21-B)
- `ingestion_event_id` exportado (5 campos opcionais, `schema_version: 1`)
- Controle precisa de `documents-auto-loader.js` para ler `latest.json` via fetch e carregar automaticamente
- Task Scheduler: `sync:mapped --confirm-real-google --write-latest` diário
- Próximo roadmap: UX de aceite/rejeição no Controle; dedup por `event_id`; telemetria de import
## RAVATEX-DOCUMENTS-G23-E-G-CANONICAL-UNDO-CLOSEOUT (2026-07-09)

- Status: **PRONTO — CLOSEOUT MULTI-REPO DA TRILHA G23-E**.
- HEAD Ingestor: `20b9cf1d726a1d3669352937f62b21b9c77d59e8` (master).
- HEAD Controle: `d7e71071e7c5bc673c4a0efe79c021c642742cd7` (work/app-next).

- Trilha G23-E completa:
  - G23-E-C: migration 39 (`d5c9951`) — base canonica `ingestor_*`, RPC undo (admin-only),
    RPC writer (service_role-only), grants e backfill conservador.
  - G23-E-C-R1: aplicada em staging (`ucrjtfswnfdlxwtmxnoo`).
  - G23-E-D: writer canonical state patch (`20b9cf1`) — `latest_ingestion_event_at`
    no export, RPC `upsert_document_candidate_ingestor_state`, skips para candidatos
    incompletos.
  - G23-E-E: UI undo patch (`d7e7107`) — `undoDocumentDecisionInCloud`, reader
    com `ingestor_*`, botoes Desfazer na tela.
  - G23-E-F: staging E2E smoke validado — writer real contra staging (service_role),
    reader authenticated, decidir/desfazer via RPC, idempotencia writer confirmada,
    cleanup 0 residuos. 37/37 ingestor + 291/291 controle.
  - G23-E-G: closeout docs multi-repo (este arquivo + AGENT_HANDOFF.md).

- Confirmacoes:
  - Producao nao usada.
  - Browser visual real nao executado (harness programatico usado no E2E).
  - Nao-admin logado nao testado end-to-end (guarda `is_admin()` provada).
  - Cleanup remoto 0 residuos (candidates=0, decisions=0, events=0, scan_runs=0).
  - Sem push, sem migration nova, sem `git add .`.

## RAVATEX-DOCUMENTS-G23-E-D-INGESTOR-WRITER-CANONICAL-STATE-PATCH (2026-07-09)

- `export:mapped` inclui `latest_ingestion_event_at`, derivado do mesmo ultimo evento canonico de `latest_ingestion_event_id`, sem fallback para hora atual.
- `sync:supabase` deriva base completa somente com status valido, event ID real, timestamp real e motivo para rejected; candidatos incompletos sao reportados como skipped e nao recebem base falsa.
- Escrita de candidate agora usa exclusivamente a RPC backend `upsert_document_candidate_ingestor_state`; nao consulta/escreve `document_decisions`, nao chama RPCs de decisao e preserva eventos por `ingestion_event_id`.
- Dry-run permanece sem cliente/conexao/write e retorna totais, bases completas e lista de skips. Nenhum sync real foi executado nesta fase.

## RAVATEX-DOCUMENTS-G24-B4-STAGING-E2E-BLOCKED (2026-07-10)

- Status: **BLOCKED - B4-R2 REQUIRED**. HEAD tecnico preservado: `c48e14678c7f4564790a57e6f3829551dcddbb34`.
- Ambiente staging `ucrjtfswnfdlxwtmxnoo` comprovado por project ref e hostname; writer, service credential e credenciais Google presentes sem expor valores. Producao nao acessada.
- Migration 41 foi aplicada manualmente no SQL Editor do staging pelo operador (SHA-256 `E789D1BB23997859D79E26D5956D26192FAEBD791C0759D61644C024668C683B`). A request `41a6506e...` foi criada pelo app e permanece `requested`.
- Comando real tentado uma unica vez: `npm.cmd run watch:scan-requests -- --once --poll-seconds 5 --confirm-real-google --confirm-supabase-write`.
- Resultado: abortou antes de claim, Gmail, Drive, scan run ou sync com `error: required option '--source <source>' not specified`. Nenhum run foi criado; request preservada.
- Nenhuma alteracao tecnica no Ingestor. Proximo passo: B4-R2 deve, em nova autorizacao, confirmar a request e executar uma unica vez com `--source gmail` explicito.

## RAVATEX-DOCUMENTS-G24-B4-STAGING-E2E-CLOSED (2026-07-10)

- STATUS: G24-B4 CLOSED. Staging `ucrjtfswnfdlxwtmxnoo`; migration 41 SHA-256 `E789D1BB23997859D79E26D5956D26192FAEBD791C0759D61644C024668C683B`.
- Request sanitizada `41a6506e...`, source `gmail`, terminou `completed`; requested/claimed/started/finished preenchidos; `scan_run_id` `d7b90a68...`; erro nulo; `active_gmail_requests=0`.
- Execucao unica autorizada: `npm.cmd run watch:scan-requests -- --source gmail --once --poll-seconds 5 --confirm-real-google --confirm-supabase-write`. Resultado: `cycles=1`, `requests_processed=1`, `requests_completed=1`, `requests_failed=0`, `empty_polls=0`; `requested -> claimed -> running -> completed`; eventos `cycle.start`, `cycle.start_run`, `cycle.mark_running`, `cycle.scan`, `cycle.finish_run`, `cycle.finish_request`, `watch.done`.
- Gmail/scan/export/sync/finalizacao concluidos conforme evidencia E2E; a UI atualizou a lista automaticamente e exibiu pelo menos cinco documentos novos.
- Producao nao acessada; nenhum retry ou `--recover-stale`; nenhuma migration/codigo tecnico alterado nesta ordem; nenhuma nova request e nenhum push.
- Dividas nao bloqueantes ficam para B5: duplicidade visual do feedback e ausencia de reidratacao automatica apos hard reload. Proximo recomendado: `G24-B5 - SCAN STATUS UI DEDUP + ACTIVE REQUEST HYDRATION`.
> **Atualizacao 2026-07-10 — fase `RAVATEX-DOCUMENTS-G24-C-AUTO-SCAN-ENTRY-GMAIL-COVERAGE`.**
> Status: **G24-C BLOCKED — R1 REQUIRED**. Sem compactacao deste arquivo.
>
> Baseline confirmado: `master` em `62b4e10`, working tree inicialmente limpa. O Controle permaneceu em `work/app-next` / `e72d966` (com somente os untracked explicitamente preservados).
>
> Diagnostico Gmail read-only, limitado a `after:2026/07/03`:
> - Query atual: `has:attachment (filename:pdf OR filename:xml) after:2026/07/03`.
> - Controle: `has:attachment after:2026/07/03`.
> - Resultado: 10 mensagens e 18 anexos em ambas; 17 candidatos PDF/XML, 1 anexo irrelevante e zero mensagens/candidatos ausentes da query atual.
> - IDs, assuntos e filenames foram mascarados; nao houve download de anexos, Gmail write, Drive write ou Supabase write.
>
> O filtro nao foi alterado porque a causa dos documentos omitidos nao foi comprovada. R1 requer um documento ausente identificavel ou uma janela temporal limitada que o contenha, para produzir ledger por etapa e teste causal.
>
> Operacao persistente preparada (ainda nao instalada/ativada):
> - `src/core/watcherInstanceLock.ts` cria lock atomico por source para watcher continuo e recupera somente lock de PID morto.
> - `src/cli.ts` adquire essa trava somente com `--no-once` e a libera no encerramento.
> - `ops/watcher/` contem scripts versionados para iniciar, instalar task de logon, consultar estado e parar de forma controlada. O start valida o project ref staging `ucrjtfswnfdlxwtmxnoo`; a tarefa usa `IgnoreNew` e o CLI mantem a trava por source. Nenhuma credencial e embutida.
> - Testes focados: watcher/CLI 31/31 pass; `git diff --check` OK. `npm run build` continua bloqueado por seis erros preexistentes em `drive.ts`, `realScan.ts` e `syncMapped.ts`, fora deste patch.
>
> E2E staging nao executado: nao ha watcher persistente ativo e nao existe documento antes omitido comprovado. Producao e push intocados.

## G25-B1 CLOSED — Gmail received timestamp vertical slice (2026-07-10)

- R1 preservado como evidencia: request `8717df4b...` e run `755ee531...` falharam por `no such column: email_received_at`; nenhuma linha historica foi removida.
- R2 corrigiu a abertura de SQLite legado no commit `23bcaa3`: o schema base nao cria mais prematuramente `idx_documentos_email_received_at`; `ensureLocalMigrations()` adiciona as quatro colunas e so entao cria o indice. Banco legado, banco novo e reabertura idempotente estao cobertos em `tests/storage-schema.test.ts`.
- Linhagem valida: Gmail `internalDate` -> `email_received_at` UTC; `Date` e somente fallback `header_date` marcado `estimated=true`; sem fallback para hora de ingestao. Campos persistidos: `email_message_id`, `email_received_at`, `email_received_at_source`, `email_received_at_estimated`.
- E2E staging `ucrjtfswnfdlxwtmxnoo`: request `bd43ecdb...` e run `77115770...` terminaram `completed`, com 19 processados, 17 novos e zero requests Gmail ativas. O documento controlado `TESTE-G25-B1-20260710-1536.pdf` foi reutilizado, sem novo e-mail.
- Prova temporal: `internalDate` `1783708979000` = `2026-07-10T18:42:59.000Z`; SQLite e Supabase persistiram `gmail_internal_date` / `false`; processamento `2026-07-10T19:10:56Z` ocorreu depois. UI validada pelo operador: recebido `10/07 15:42`, processado `10/07 16:10`, sem badge legado.
- Testes focados: 81/81 verdes; `git diff --check` OK. Build manteve apenas diagnosticos TypeScript preexistentes fora desta correcao, sem erros novos. Producao intocada; sem push, backfill ou alteracao de relevancia.
- Proxima fase: `G25-B2 — RELEVANCE CLASSIFIER V1`.

## G25-B1-UX-B-C PARTIAL — Full Gmail reconciliation since 2026-06-19 (2026-07-10)

- Janela canônica: `2026-06-19T03:00:00.000Z` em diante; query Gmail `after:2026/06/18 has:attachment (filename:pdf OR filename:xml)`, com filtro final pelo `internalDate` normalizado.
- Dry-run estável antes da escrita: 24 mensagens na janela, 40 anexos PDF/XML, 20 matches existentes, 20 candidatos ausentes, zero ambiguidade, zero alteração protegida e zero escrita.
- Execução controlada em staging `ucrjtfswnfdlxwtmxnoo`: 17 documentos legados receberam somente `sender_email`, `email_message_id` e timestamps Gmail ausentes; os 20 anexos ausentes foram processados pelo `createScan` canônico usando o buffer já lido. Isso gerou 21 candidates porque um é referência cross-message que reutiliza Drive existente; não há par `(gmail_message_id, attachment_id)` duplicado nem INSERT paralelo. Não houve exclusão, alteração de status, pedido, aceite/rejeição ou relevância.
- Auditoria pós-execução: 40 pares únicos `(gmail_message_id, attachment_id)`; 40 candidates no staging; segundo dry-run com `WOULD_UPDATE_SQLITE=0`, `WOULD_UPDATE_SUPABASE=0` e `WOULD_CREATE_DOCUMENTS=0`.
- Exceção documentada: `ec07577a...` / `L.pdf`, `gmail_message_id=m-log`, não pertence ao inventário Gmail e retornou `MESSAGE_NOT_FOUND=1`. Permanece sem metadados e sem qualquer exclusão automática.
- Candidatos de teste apenas reportados e preservados: `TESTE-G25-B1-20260710-1536.pdf`, `teste-nfe-entrada.xml` e `pdf143429.pdf` (sinal de assunto). Nenhuma exclusão realizada.
- Commits técnicos: `145f1c3 Reconcile Gmail document metadata since cutoff`; `4995ba6 Report unrecoverable legacy Gmail rows`. Sem push; produção `bhgifjrfagkzubpyqpew` intocada.
- Watcher reiniciado pelo script oficial: uma instância; `active_gmail_requests=0`.
- Próxima fase: `G25-B1-UX-C — TEST DOCUMENT CLEANUP`, somente com lista explícita do operador; depois `G25-B2 — RELEVANCE CLASSIFIER V1`.
