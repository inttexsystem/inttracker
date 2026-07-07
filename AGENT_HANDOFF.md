# AGENT HANDOFF

## Branch/HEAD/Status
### documentos-ingestor (este repositório)
- Branch: master
- HEAD: `2c8f316` — Add document taxonomy contract compatibility (G1)
- Status: limpo

### Controle de Tapetes (staging/work/app-next)
- HEAD canônico: `997486a`
- Push staging: `af919a2..997486a`
- Produção/origin oficial: intocados
- Status residual esperado: `?? supabase/.temp/`

## Fase concluída
RAVATEX-DOC-INGESTOR-TAXONOMY-G1-TYPES-CONTRACTS-STORAGE-PATCH

## Fase anterior
RAVATEX-TAPETES-UI-BACKLOG-CLOSEOUT-H

## Objetivo da fase G1
Implementar taxonomia de documentos em 3 eixos (tipo_documento + formato + direcao_nf), com compatibilidade retroativa para tipos legados (nf_xml/nf_pdf). Schema SQLite com colunas formato e direcao_nf. Contracts JSON Schema com suporte a v1 (legado) e v2 (novo). 152 testes passando (20 suites).

## Objetivo da fase H (anterior)
Fechamento do bloco UI do Controle de Tapetes no staging/work/app-next.

### Itens fechados
1. **TRANSFER-GRID-CELL-CENTER-R1** — CLOSED em `c8b45b6`
2. **LINKED-OPS-FOOTER-BUTTONS-UX-F** — CLOSED em `e80b9de` + `55bc32b` + `997486a`
3. **UI-BACKLOG-RECONCILIATION-G** — 14/14 itens fechados, 0 pendentes

### Commits de referência
- `c8b45b6` — TRANSFER-GRID-CELL-CENTER-R1
- `e80b9de`, `55bc32b`, `997486a` — LINKED-OPS-FOOTER-BUTTONS-UX-F (HEAD)
- `af919a2` — base anterior ao push staging

## O que NÃO foi feito (intencionalmente)
- Nenhuma alteração de código no documents-ingestor
- Nenhuma migration criada
- Nenhum SQL aplicado
- Nenhum toque em produção/origin oficial
- Nenhum commit de `supabase/.temp/`

## Histórico de fases
### documentos-ingestor
- A — Scaffold (28 testes, 6 suites)
- B — Gmail scan dry-run
- C1 — Login OAuth interativo
- C2 — Smoke real (1 email → Drive → assign → outbox)
- D — Hardening (caps, dedup, run log)
- D-R1 — Test isolation (drive.test.ts com fake Drive)
- E — CI mock integration (94 testes, 16 suites)
- F — UX (operational UX)
- G1 — Taxonomia 3 eixos (types + contracts + storage)

### Controle de Tapetes (staging/work/app-next)
- G/H — UI Backlog Closeout (14/14 itens, HEAD 997486a)

## Próxima fase recomendada
RAVATEX-DOC-INGESTOR-TAXONOMY-G2-XML-NF-DIRECTION-PATCH
Foco: classificar XML NF-e como entrada/saída/desconhecida usando RAVATEX_CNPJS.
