# AGENT HANDOFF

## Branch/HEAD/Status
### documentos-ingestor (este repositório)
- Branch: master
- HEAD: `d0f3bc4` — Add document guardrails and outbox event identifiers (G7-B)

### Controle de Tapetes (staging/work/app-next)
- HEAD canônico: `997486a`
- Push staging: `af919a2..997486a`
- Produção/origin oficial: intocados

## Fase concluída
RAVATEX-DOC-INGESTOR-G7-B-GUARDRAILS-PATCH

## Fase anterior
G7-A — Diagnóstico de guardrails (direção NF, event_id, manifest, report)

## Objetivo da fase G7-B
Implementar 3 patches seguros diagnosticados em G7-A: warning de direção NF no link, ingestion_event_id no outbox, e reorganização do report.

### Patch 1 — Warning direção NF no link
- `link.ts`: verifica se documento é NF com `direcao_nf = null` ou `'desconhecida'` e seta `warnedDirection = true`
- `LinkResult` inclui campo `warnedDirection: boolean`
- CLI (`cli.ts`) exibe warning: "document NF direction is unknown — linked without direction guard"
- **Não bloqueia** o link — apenas avisa
- Direção determinada (`entrada`/`saida`) não gera warning
- 5 testes em `link.test.ts`

### Patch 2 — ingestion_event_id no outbox
- `outbox.ts`: SELECT adiciona `e.id AS ingestion_event_id`
- `buildEventFromRow` inclui `ingestion_event_id: row.ingestion_event_id`
- `event.ts`: `DocumentEvent` ganha `ingestion_event_id?: string`
- `event_id` legado (document_id) **preservado** para compatibilidade
- `ingestion_event_id` contém o UUID real de `ingestion_events.id`
- 4 testes em `guardrails.test.ts`

### Patch 3 — Report reorganizado em seções
- `cli.ts` report output dividido em 3 seções:
  - `--- import report ---` (totais + erros)
  - `--- funnel ---` (pendingWithoutPedido, accepted, rejected, by status, by pedido)
  - `--- taxonomy ---` (by tipo, by formato, by direcao NF)
  - `--- outbox ---` (pendingAppAcceptance, outbox path)
- `pendingAppAcceptance` agora na seção outbox (semântica correta)
- JSON output inalterado
- 1 teste em `guardrails.test.ts`

### Arquivos alterados/criados
- `src/core/link.ts` — warning direção + LinkResult.warnedDirection
- `src/core/outbox.ts` — ingestion_event_id no SELECT + buildEventFromRow
- `src/types/event.ts` — DocumentEvent.ingestion_event_id
- `src/cli.ts` — warning output + report reorganizado em seções
- `tests/link.test.ts` — +5 testes de warning direção
- `tests/guardrails.test.ts` — novo, 5 testes de event_id + report
- `PROJECT_STATE.md`, `AGENT_HANDOFF.md` — atualização

### Testes
- 23 suites, 260 testes passando (10 novos: 5 direção + 5 guardrails/event_id/report)
- Nenhuma regressão

### Riscos remanescentes
1. Bloqueio de mismatch entrada/saída ainda deferido (falta modelo de pedido)
2. Manifest Drive desatualizado após link local-only (deferido até G8)
3. Migração de event_id para schema v2 ainda pendente

### Próxima fase recomendada
RAVATEX-DOC-INGESTOR-G8-INTEGRATION-AND-SYNC
Foco: revisar assign real para incluir documentos já linked, sync de manifest Drive, e preparação para integração com Controle de Tapetes.
