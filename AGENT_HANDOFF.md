# AGENT HANDOFF

## Branch/HEAD/Status
### documentos-ingestor (este repositório)
- Branch: master
- HEAD: `(new commit)` — Add documents integration handoff package (G8-E)

### Controle de Tapetes (staging/work/app-next)
- HEAD canônico: `997486a`

## Fase concluída
RAVATEX-DOC-INGESTOR-G8-E-INTEGRATION-HANDOFF-PACKAGE

## Fase anterior
G8-D — Smoke real-lite operacional

## Objetivo da fase G8-E
Entregar pacote de handoff claro para integração futura com Controle de Tapetes: eventos, campos, exemplos JSONL, regras de consumo/idempotência, comandos operacionais e limites.

### Pacote criado

**1. Exemplo JSONL** (`contracts/examples/document-events.sample.jsonl`)
- 4 eventos fictícios: `document.detected`, `document.linked`, `document.accepted`, `document.rejected`
- IDs fictícios (sem dados reais)
- `event_id` repete-se (legado), `ingestion_event_id` é único por evento
- `reason` presente apenas em `document.rejected`

**2. Contrato atualizado** (`docs/CONTROL_TAPETES_DOCUMENTS_CONTRACT.md`)
- Seção 6: Regras de idempotência (5 regras: `ingestion_event_id` canônico, `event_id` legado, ordenação, status derivado)
- Seção 7: Exemplo JSONL (tabela com 4 eventos)
- Seção 8-10: Fases, limites, comandos expandidos (inclui export filtrado, --pedido, --event-type, --mark-exported)

### Decisões documentadas
- `ingestion_event_id` deve ser usado como identificador canônico do evento pelo consumidor
- `event_id` é legado e pode repetir-se (documento com linked+accepted compartilha event_id)
- Visualização Drive: consumidor abre `drive_web_view_link` em nova aba, sem Supabase/backend
- Assign real e link local-only são rotas alternativas, não complementares
- Manifest Drive sync deferido
- Bloqueio de direção NF deferido (falta modelo de pedido)
- event_id v2 deferido

### Arquivos alterados/criados
- `contracts/examples/document-events.sample.jsonl` — **novo** (4 eventos fictícios)
- `docs/CONTROL_TAPETES_DOCUMENTS_CONTRACT.md` — seções 6-10 adicionadas/expandidas
- `PROJECT_STATE.md`, `AGENT_HANDOFF.md` — atualização

### Testes
- Apenas documentação/fixture (sem código funcional)
- `git diff --check` limpo

### Riscos remanescentes
1. Manifest Drive sync deferido
2. Bloqueio de mismatch entrada/saída deferido
3. event_id v2 deferido
4. Integração real com Controle de Tapetes não iniciada

### Próxima fase recomendada
RAVATEX-DOC-INGESTOR-G9-DRIVE-MANIFEST-SYNC
Foco: sincronizar assign real com documentos linked, atualizar manifest Drive para refletir estado local, preparar integração com Controle de Tapetes.
