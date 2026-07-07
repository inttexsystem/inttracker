# AGENT HANDOFF

## Branch/HEAD/Status
### documentos-ingestor (este repositório)
- Branch: master
- HEAD: `60bc12e` — Record G8 integration sync design

### Controle de Tapetes (staging/work/app-next)
- HEAD canônico: `997486a`
- Push staging: `af919a2..997486a`
- Produção/origin oficial: intocados

## Fase concluída
RAVATEX-DOC-INGESTOR-G8-A-INTEGRATION-SYNC-DESIGN

## Fase anterior
G7-C-R1 — Persistência de reason no re-export

## Objetivo da fase G8-A
Desenhar integração G8 sem implementar código funcional. Mapear fontes de verdade, invariants, riscos e ponto de entrada para próximo patch.

---

## A) Link local-only vs assign real

### Evidência
- `realAssign.ts:73` — `if (doc.status !== 'pending') return null` — assign real bloqueia documentos já linked (assigned/accepted/rejected)
- `realAssign.ts:134-155` — UPDATE seta status='assigned', pedido_manual, e atualiza storage_uri/drive_file_id do Drive
- `realAssign.ts:175-195` — cria evento `document.detected` (type hardcoded por `createDocumentEvent`)
- `link.ts:53-55` — UPDATE seta status='assigned', pedido_manual, sem tocar Drive
- `link.ts:86-107` — cria evento `document.linked`

### Decisão
**link é alternativa ao assign, não complemento.** O assign real espera documento pending e faz Drive move + manifest. O link é vínculo lógico sem Drive. Não devem coexistir no mesmo documento.

### Risco
Se o operador fizer link e depois assign, o assign será bloqueado (status !== 'pending'). Se fizer assign e depois link, o link será bloqueado (já assigned). Ambos são comportamentos corretos, mas o operador precisa entender a diferença.

### Patch mínimo (G8-B)
Nenhum. Comportamento atual já é seguro. Apenas documentar claramente no help do CLI e no projeto.

### Deferido?
Não — já resolvido pelo design atual.

---

## B) Manifest Drive

### Evidência
- `manifest.ts` — opera em arquivos locais (loadManifest/saveManifest)
- `realAssign.ts:106-115` — upload manifest para Drive via `deps.uploadManifest`
- `realAssign.ts:117-132` — `addDocumentToManifest('/dev/null', ...)` — usa path placeholder
- `link.ts` — não toca manifest
- `acceptance.ts` — não toca manifest
- Manifest é artefato do assign real. Contrato documentado: Drive folder `pedidos/PED-XX-YYYY/manifest.json`

### Decisão
**Manifest é artefato derivado do assign real, não fonte de verdade.** Fonte de verdade é:
1. **SQLite** para estado do documento (status, pedido_manual, taxonomy)
2. **Outbox JSONL** para eventos e histórico

### Risco
Manifest fica desatualizado quando documentos são linked/accepted/rejected sem assign real. Aceitável — o outbox supre essa lacuna.

### Patch mínimo (G8-B)
Nenhum. Manifest permanece como artefato Drive-only. Link/accept/reject não devem mexer nele.

### Deferido?
Sim — sync manifest Drive deferido até que assign real seja revisado para batch sync de documentos linked.

---

## C) Outbox para Controle de Tapetes

### Evidência
- Eventos existentes no outbox: `document.detected`, `document.linked`, `document.accepted`, `document.rejected`
- `event.ts:28-40` — DocumentEvent inclui todos os campos de metadata
- `ingestion_event_id` já presente (G7-B)
- `reason` já persistente (G7-C-R1)
- Contrato documentado (`docs/CONTROL_TAPETES_DOCUMENTS_CONTRACT.md`) refere apenas `document.detected` — **desatualizado**
- JSON schema (`contracts/document-event.schema.json`) define v1/v2 mas enum `event_type` só lista `["document.detected"]` — **desatualizado**

### Decisão
**Outbox JSONL continua sendo o contrato de integração.** O Controle de Tapetes deve consumir eventos de todos os tipos (`detected`, `linked`, `accepted`, `rejected`).

### Lacunas no contrato
1. JSON schema não inclui `document.linked`, `document.accepted`, `document.rejected` nos enums de `event_type`
2. Contrato documentado não menciona `ingestion_event_id`, `reason`, `formato`, `direcao_nf`
3. Schema v1/v2 não inclui `ingestion_event_id` no nível raiz
4. Schema não documenta que `event_id` pode ser `document_id` (legado)

### Patch mínimo (G8-B)
Atualizar `contracts/document-event.schema.json` para:
- Ampliar `event_type` enum em v1/v2 para incluir `document.linked`, `document.accepted`, `document.rejected`
- Adicionar `ingestion_event_id` ao nível raiz (opcional)
- Adicionar `reason` ao DocumentEventDocument v1/v2 (opcional)
- Documentar que `event_id` mantido por compatibilidade, `ingestion_event_id` é o identificador real

### Deferido?
Não — é apenas atualização documental, não código funcional.

---

## D) Visualização direta do Drive no app

### Evidência
- `drive.ts:32-34` — `fileViewLink()` gera links padrão do Google Drive
- Campos de preview no outbox: `drive_file_id`, `drive_web_view_link`, `drive_web_content_link`, `storage_uri`
- Documentos `document.detected` (assign real) têm todos os campos Drive preenchidos
- Documentos `document.linked` (local-only) podem ter `drive_file_id` mas não necessariamente `drive_web_view_link`

### Decisão
**O Controle de Tapetes deve usar `drive_web_view_link` para abrir arquivo no Drive em nova aba.** Sem iframe, sem proxy, sem download. O ingestor entrega metadata com links Drive. O app apenas renderiza links clicáveis.

### Requisitos para o app
- Campo mínimo para preview: `drive_web_view_link`
- Fallback: `storage_uri` (gdrive://file/<id>)
- Sem necessidade de permissões Drive adicionais (link público dentro do workspace)
- Sem Supabase/backend para servir arquivos

### Patch mínimo (G8-B)
Nenhum no ingestor. O contrato de outbox já entrega os campos necessários. A implementação é no Controle de Tapetes.

### Deferido?
Não — é requisito de consumo, não de produção. Ingestor já entrega o necessário.

---

## E) event_id v2

### Evidência
- `event_id` = `document_id` (legado, `outbox.ts:62`)
- `ingestion_event_id` = `ingestion_events.id` (UUID real, `outbox.ts:63`)
- Documento com múltiplos eventos (linked → accepted) tem mesmo `event_id`, diferentes `ingestion_event_id`
- Consumidores que dependem de `event_id` como identificador único de evento recebem valor duplicado

### Decisão
**Manter `event_id` legado, usar `ingestion_event_id` como identificador real.** Migração de `event_id` para UUID real em schema v2 quando houver quebra de compatibilidade planejada.

### Risco
Se consumidor futuro usar `event_id` como chave única, eventos do mesmo documento colidirão. Mitigação: documentar que `ingestion_event_id` é o identificador canônico.

### Patch mínimo (G8-B)
Nenhum. Apenas documentar no contrato.

### Deferido?
Sim — migração completa deferida para schema v2 com quebra planejada.

---

## F) Report/Operacional

### Evidência
- `cli.ts:308-358` — report em 3 seções: import, funnel, taxonomy, outbox
- `list:pending` filtra por status, tipo, formato, direção — mas não por `pedido_manual`
- `inspect` mostra documento, email, eventos — mas não mostra link Drive clicável
- `export:events` exporta todos os eventos pendentes — sem filtro por event_type ou documento

### Decisão
**Report atual é suficiente.** Pequenas melhorias operacionais podem ser adicionadas sem alterar arquitetura.

### Patch mínimo (G8-B)
Opcional:
1. `list:pending --pedido <PED-XX-YYYY>` — filtrar documentos por pedido
2. `export:events --event-type <type>` — filtrar por tipo de evento
3. `inspect` mostrar `drive_web_view_link` legível

### Deferido?
Sim — não é bloqueador para G8. Pode entrar em G8-C (operational polish).

---

## Matriz de decisão

| Tema | Decisão | Risco | Patch G8-B? | Deferido? |
|---|---|---|---|---|
| Link vs assign | Link é alternativa, não complemento | Nenhum — design atual é seguro | NÃO | — |
| Manifest Drive | Artefato derivado, não fonte de verdade | Baixo — outbox supre | NÃO | Sim (sync G8-C) |
| Contrato outbox | Atualizar schema JSON com novos event_types e campos | Médio — contrato desatualizado | SIM — atualizar contracts/ | — |
| Visualização Drive | App abre `drive_web_view_link` em nova aba | Nenhum — metadata já existe | NÃO (app-side) | — |
| event_id v2 | Manter legado, usar ingestion_event_id | Baixo — documentado | NÃO | Sim (v2) |
| Report operacional | Suficiente para G8 | Nenhum | NÃO | Opcional G8-C |

---

## Recomendação objetiva para G8-B

**RAVATEX-DOC-INGESTOR-G8-B-CONTRACT-UPDATE** — Atualizar contrato documental (JSON schema + docs) para refletir o estado real do outbox pós-G6/G7: novos event_types, ingestion_event_id, reason, formato, direcao_nf.

**Ordem pronta para o próximo IAExecutor:**

```
FASE: RAVATEX-DOC-INGESTOR-G8-B-CONTRACT-UPDATE

Agente: DeepSeek Flash
Modo: atualização documental + validação schema
HEAD base: (G8-A commit)

Escopo:
  1. contracts/document-event.schema.json:
     - Ampliar event_type enum em v1/v2 para:
       ["document.detected", "document.linked", "document.accepted", "document.rejected"]
     - Adicionar ingestion_event_id (opcional, string, format uuid) ao nível raiz
     - Adicionar reason (opcional, string) ao DocumentEventDocument v1/v2
     - Atualizar descrições para refletir G6/G7
  2. docs/CONTROL_TAPETES_DOCUMENTS_CONTRACT.md:
     - Atualizar tabela de campos com ingestion_event_id, reason, formato, direcao_nf
     - Documentar novos event_types
     - Atualizar status de "Design / read-only" para "G6+ estado atual"
  3. Validar que schema JSON é válido (todos os events gerados no outbox passam)
  4. Rodar npm.cmd test (garantir ≥264 passando)
  5. Atualizar PROJECT_STATE.md e AGENT_HANDOFF.md

Não fazer:
  - Não alterar código funcional
  - Não tocar assign real, link, acceptance, outbox funcional
  - Não chamar Google/Drive real
  - Não alterar schema SQLite
  - Não criar migração

Critério de aceite:
  - Schema JSON aceita document.linked, document.accepted, document.rejected
  - Schema JSON inclui ingestion_event_id e reason
  - Contrato documentado reflete estado real do outbox
  - Testes passam sem alteração funcional
```
