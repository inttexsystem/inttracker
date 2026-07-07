# AGENT HANDOFF

## Branch/HEAD/Status
### documentos-ingestor (este repositório)
- Branch: master
- HEAD: `3ff31a7` — Validate local document funnel smoke (G7-C)

### Controle de Tapetes (staging/work/app-next)
- HEAD canônico: `997486a`
- Push staging: `af919a2..997486a`
- Produção/origin oficial: intocados

## Fase concluída
RAVATEX-DOC-INGESTOR-G7-C-LOCAL-FUNNEL-SMOKE-AND-CLOSEOUT

## Fase anterior
G7-B — Guardrails patch (warning direção, ingestion_event_id, report seções)

## Objetivo da fase G7-C
Validar localmente, sem Google/Drive real, que o funil operacional completo funciona: pending → link → accept/reject → outbox → report.

### Estratégia
Opção C: teste de integração hermético (`tests/funnel-smoke.test.ts`) com banco temporário em `$TMPDIR/ravatex-hermetic-*/funnel-smoke-*/`.

### Cenários validados (4 testes)

**1. pending → link → document.linked → accept → document.accepted**
- Documento NF/XML/entrada sintético
- Link: status → assigned, pedido_manual → PED-25-2026
- Outbox linked export: event_type=document.linked, event_id=docId, ingestion_event_id=UUID
- Accept: status → accepted, evento document.accepted com ingestion_event_id diferente do linked
- Ambos os eventos persistem no DB

**2. pending → link → reject with reason → document.rejected**
- Documento NF/PDF/direcao=desconhecida
- Link: warnedDirection=true
- Outbox initial: document.rejected com reason="Documento duplicado" no payload
- Re-export: event_type=document.rejected, status=rejected, event_id=docId, ingestion_event_id=UUID
- Nota: reason não é persistido em ingestion_events (coluna ausente) — preservado apenas no outbox inicial

**3. warning não bloqueante para direção desconhecida**
- Documento NF com direcao_nf='desconhecida'
- Link prossegue normalmente
- warnedDirection=true
- Evento document.linked criado e exportado

**4. report com seções e contadores corretos**
- 2 documentos: 1 accepted, 1 rejected
- totalDocuments=2, documentsAccepted=1, documentsRejected=1
- pendingAppAcceptance=2 (2 eventos linked aguardando export)
- Agregações por tipo/formato/direção preservadas

### Testes
- 24 suites, 264 testes passando (4 novos funnel smoke)
- Comando: `npm.cmd test` — banco temporário, sem rede, sem Google/Drive, sem data/app.db real

### Riscos remanescentes
1. `reason` não é persistido em `ingestion_events` — preservado apenas no outbox inicial, perdido em re-export via `exportPendingEvents`
2. Bloqueio de mismatch entrada/saída deferido (falta modelo de pedido)
3. Manifest Drive desatualizado após link local-only (deferido)
4. event_id legado (documento com múltiplos eventos compartilha event_id)

### Próxima fase recomendada
RAVATEX-DOC-INGESTOR-G8-INTEGRATION-AND-SYNC
Foco: revisar assign real para incluir documentos já linked, sync manifest Drive, e integração com Controle de Tapetes. Funil local completo e validado.
