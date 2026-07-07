# AGENT HANDOFF

## Branch/HEAD/Status
### documentos-ingestor (este repositório)
- Branch: master
- HEAD: `(new commit)` — Update document event contract (G8-B)

### Controle de Tapetes (staging/work/app-next)
- HEAD canônico: `997486a`

## Fase concluída
RAVATEX-DOC-INGESTOR-G8-B-CONTRACT-UPDATE

## Fase anterior
G8-A — Design de integração e sync

## Objetivo da fase G8-B
Atualizar contratos documentais (JSON schema + docs) para refletir o estado real do outbox pós-G6/G7.

### Alterações no JSON schema (`contracts/document-event.schema.json`)
- **event_type enum** expandido em v1 e v2: `["document.detected", "document.linked", "document.accepted", "document.rejected"]`
- **ingestion_event_id** adicionado a v1 e v2 (opcional, string, format uuid)
- **event_id** agora documentado como "legado — pode ser igual a document_id"
- **reason** adicionado a DocumentEventDocument v1 e v2 (opcional, string, "presente apenas em document.rejected")

### Alterações na documentação (`docs/CONTROL_TAPETES_DOCUMENTS_CONTRACT.md`)
- Status atualizado para "G6+ validated — outbox operacional"
- Seção 2.1: tabela com os 4 event_types e seus status
- Seção 2.2: tabela completa de campos (28 campos) com obrigatoriedade
- Seção 2.3: visualização via `drive_web_view_link` (nova aba, sem Supabase)
- Seção 3: campos mínimos expandidos com formato, direcao_nf, reason, ingestion_event_id
- Seção 4: fluxo operacional (scan → assign real | link local-only)
- Seção 5: decision points (manifest deferred, event_id legacy preserved, direction guard deferred)
- Seção 6: fases concluídas (G5 → G8-A)
- Seção 7: limites atuais
- Seção 8: comandos úteis atualizados (inclui link, accept, reject)

### Testes
- `contract-doc.test.ts` atualizado: verifica "outbox operacional" + todos os 4 event_types + ingestion_event_id + drive_web_view_link
- 24 suites, 265 testes passando

### Arquivos alterados
- `contracts/document-event.schema.json` — event_type enum, ingestion_event_id, reason
- `docs/CONTROL_TAPETES_DOCUMENTS_CONTRACT.md` — reescrita completa para estado atual
- `tests/contract-doc.test.ts` — teste atualizado para novo conteúdo
- `PROJECT_STATE.md`, `AGENT_HANDOFF.md` — atualização documental

### Riscos remanescentes
1. Bloqueio de mismatch entrada/saída deferido
2. Manifest Drive sync deferido
3. event_id migração v2 deferida

### Próxima fase recomendada
RAVATEX-DOC-INGESTOR-G8-C-OPERATIONAL-POLISH
Foco: filtros operacionais (list:pending --pedido, export:events --event-type), inspect com link Drive legível. Sem Google/Drive real.
