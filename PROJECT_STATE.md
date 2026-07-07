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
- HEAD (documents-ingestor): `2c8f316`
- HEAD canônico staging/work/app-next (Controle de Tapetes): `997486a`
- Push staging: `af919a2..997486a` (produção/origin oficial intocados)
- 152 testes passando (20 suites) — incluindo integração mockada completa
- Hermético: nenhum teste depende de `.env` real, token real ou chamadas Google
- OAuth real validado (C1)
- Smoke real com Drive/Gmail reais validado (C2)
- Hardening de scan (caps, wide-scan guard, cross-msg dedup, run log) aplicado (D)
- Drive tests isolados de credenciais reais (D-R1)
- CI workflow criado (E)

## Comandos disponíveis
- `npm run dev` — tsx watch
- `npm run scan` — scan (dry-run por padrão; use `--confirm-real-google` para real)
- `npm run list:pending` — lista documentos pendentes
- `npm run assign -- --id <id> --pedido <num> --confirm-real-google` — atribui Pedido
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
Test Files  20 passed (20)
     Tests  152 passed (152)
```

## Decisão arquitetural
Não integrar Supabase nesta fase. O outbox JSONL é o contrato de integração. O app principal consumirá os eventos quando estiver pronto.

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
RAVATEX-DOC-INGESTOR-TAXONOMY-G2-XML-NF-DIRECTION-PATCH
Foco: classificar XML NF-e como entrada/saída/desconhecida usando RAVATEX_CNPJS, sem OCR e sem PDF parsing ainda.
