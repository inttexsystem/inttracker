# AGENT HANDOFF

## Branch/HEAD/Status
### documentos-ingestor (este repositório)
- Branch: master
- HEAD: `(new commit)` — Record Controle Tapetes integration design (G10-A)

### Controle de Tapetes (staging/work/app-next)
- HEAD canônico: `997486a`

## Fase concluída
RAVATEX-DOC-INGESTOR-G10-A-CONTROLE-TAPETES-INTEGRATION-DESIGN

## Fase anterior
G9-C — Manifest real smoke (sync Drive confirmado)

## Objetivo da fase G10-A
Desenhar integração com Controle de Tapetes sem implementar patch funcional. Mapear contratos, fontes de verdade, estratégia de transporte e lacunas.

### Decisões-chave

**Modelo de integração:** Outbox JSONL como contrato primário. Controle de Tapetes faz watch do arquivo + pull sob demanda via `export:events`.

**Fonte de verdade:** Outbox para o app; SQLite/manifest internos do ingestor.

**Contrato:** Completo — 25+ campos documentados, 4 event_types, ingestion_event_id canônico. Nenhum campo faltando.

**Transporte:** JSONL watch (modo 1) + export filtrado (modo 2). Ambos já funcionais.

**Idempotência:** 5 regras documentadas (ingestion_event_id canônico, event_id legado, consolidação por document_id, reprocessamento seguro, ordenação por created_at).

**UI Controle de Tapetes:** Botão "Ver documento" abre `drive_web_view_link` em nova aba. Badges por tipo/formato/direção/status. Timeline de eventos. Sem Supabase/upload.

**Próximo patch (G10-B):** `export:package --pedido` como comando de conveniência (JSONL + manifest + summary consolidado). Opcional — blocos já existem.

### Arquivos alterados/criados
- `docs/architecture/G10_CONTROLE_TAPETES_INTEGRATION_DESIGN.md` — novo (design completo)
- `PROJECT_STATE.md`, `AGENT_HANDOFF.md` — atualização

### Garantias
- Nenhum scan/assign/sync real executado
- Google/Drive não chamado
- Controle de Tapetes não tocado
- `data/app.db` real não tocado
- Nenhum dado commitado

### Riscos remanescentes
1. Bloqueio de mismatch entrada/saída deferido
2. event_id v2 deferido
3. Controle de Tapetes ainda não implementa consumo de outbox

### Próxima fase recomendada
RAVATEX-DOC-INGESTOR-G10-B-EXPORT-PACKAGE
Foco: comando `export:package --pedido` consolidando JSONL + manifest + summary. Consumo inicial pelo Controle de Tapetes.
