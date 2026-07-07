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
- HEAD (documents-ingestor): `984c7f0`
- HEAD canônico staging/work/app-next (Controle de Tapetes): `997486a`
- Push staging: `af919a2..997486a` (produção/origin oficial intocados)
- 264 testes passando (24 suites) — incluindo integração mockada completa
- Hermético: nenhum teste depende de `.env` real, token real ou chamadas Google
- OAuth real validado (C1)
- Smoke real com Drive/Gmail reais validado (C2)
- Hardening de scan (caps, wide-scan guard, cross-msg dedup, run log) aplicado (D)
- Drive tests isolados de credenciais reais (D-R1)
- CI workflow criado (E)
- G5 taxonomy validado em real (R4-R1): retry por Gmail messageId confirmado funcional

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
Test Files  24 passed (24)
     Tests  264 passed (264)
```

## Decisão arquitetural
Não integrar Supabase nesta fase. O outbox JSONL é o contrato de integração. O app principal consumirá os eventos quando estiver pronto.

### Funil operacional (G6-C)
- **pending** → `link` → **assigned** → `accept` → **accepted** | `reject` → **rejected**
- `report` mostra: `pendingWithoutPedido`, `pendingAppAcceptance`, `documentsAccepted`, `documentsRejected`, `assignedByPedido`, `documentsByStatus`
- Eventos outbox: `document.linked`, `document.accepted`, `document.rejected`

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

## Próxima fase recomendada
RAVATEX-DOC-INGESTOR-G11-CONTROLE-TAPETES-WATCHER
Foco: implementar watcher no Controle de Tapetes para consumir outbox JSONL, exibir documentos no pedido via drive_web_view_link, e integrar timeline de eventos. A implementação é no repositório do Controle de Tapetes — ingestor entrega pacote, app consome.
