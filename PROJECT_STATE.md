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
- HEAD (documents-ingestor): `6622526`
- HEAD canônico staging/work/app-next (Controle de Tapetes): `997486a`
- Push staging: `af919a2..997486a` (produção/origin oficial intocados)
- 229 testes passando (21 suites) — incluindo integração mockada completa
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
Test Files  21 passed (21)
     Tests  229 passed (229)
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
- G2 — Classificação XML NF-e direção (entrada/saída via CNPJs)
- G3 — Drive folder layout hierarchical (pendentes + pedidos por tipo/direção)
- G4 — Manifest do Pedido (estrutura + add document ao manifest)
- G5 — Retry por Gmail messageId + validação real R4-R1 + crossMessageDuplicates tracking
- G6-B — Comando `link` local-only (vincular documento pending a pedido sem Drive)
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
RAVATEX-DOC-INGESTOR-G6-C-APP-ACCEPTANCE-AND-FUNNEL
Foco: implementar transição `assigned → accepted/rejected` para fechar o funil de aceite do app, com evento outbox `document.accepted` / `document.rejected`. O link local-only (G6-B) expôs que documentos assigned aguardam aceite mas não há comando para concluir o fluxo. Ver AGENT_HANDOFF.md para riscos remanescentes.
