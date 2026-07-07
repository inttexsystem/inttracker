# G10 — Controle de Tapetes Integration Design

## Status: Design / Read-only

## Contexto
- G5-G9: ingestão, taxonomia, link/acceptance local, outbox, contrato, manifest, smoke real completo
- Controle de Tapetes = app principal (gerencia Pedidos, clientes, produção)
- Apps são independentes; integração unidirecional via outbox JSONL
- Arquivos vivem no Google Drive; apps não devem armazenar PDF/XML

---

## A) Modelo de integração

### Decisão: Consumo por outbox JSONL

O Controle de Tapetes deve consumir o outbox via um dos seguintes modos (em ordem de preferência):

1. **Watch do arquivo `data/outbox/document-events.jsonl`** — mais simples, sem acoplamento. O ingestor escreve, o app lê. Polling ou watch local.
2. **Pull via comandos do ingestor** — `export:events --pedido PED-XX --event-type <type> --json`. O Controle de Tapetes executa o comando e processa o JSON.
3. **Manifest local** — snapshot opcional para carregamento inicial. Não substitui outbox.

**Recomendado:** Opção 1 (watch outbox) como fluxo primário. Opção 2 como sob demanda.

### O que o ingestor já entrega hoje

| Comando | Uso |
|---|---|
| `export:events --pedido PED-XX --event-type linked --json` | Eventos filtrados para pedido |
| `export:manifest --pedido PED-XX` | Snapshot completo do pedido |
| `inspect --id <doc_id>` | Detalhes de documento + links Drive |
| `report` | Agregação do funil |
| `list:pending --pedido PED-XX` | Lista documentos por pedido |

Nenhum comando adicional é estritamente necessário. O pacote já é funcional.

---

## B) Fonte de verdade

| Dado | Fonte | Nota |
|---|---|---|
| Estado atual do documento | Último evento (by `created_at`) para `document_id` | Consolidar por document_id |
| Histórico/auditoria | Todos os eventos para `document_id` | Ordenar por created_at |
| Visualização | `drive_web_view_link` | Abrir em nova aba |
| Snapshot do pedido | Manifest (local ou Drive) | Opcional, derivado |

**Decisão:** Outbox é a fonte canônica para o Controle de Tapetes. SQLite e manifest são internos do ingestor.

---

## C) Contrato de dados — completo

Todos os campos obrigatórios estão presentes no outbox. O contrato documentado (`docs/CONTROL_TAPETES_DOCUMENTS_CONTRACT.md`) lista 25+ campos.

### Campos essenciais para a UI

| Campo | Uso |
|---|---|
| `document_id` | Chave do documento |
| `ingestion_event_id` | Chave do evento (idempotência) |
| `pedido_manual` | Vínculo com pedido |
| `event_type` | Ícone/ação contextual |
| `status` | Estado (pending_app_acceptance/accepted/rejected) |
| `tipo_documento` | Badge (nf/romaneio/desconhecido) |
| `formato` | Badge (xml/pdf) |
| `direcao_nf` | Badge (entrada/saída) |
| `filename_original` | Nome do arquivo |
| `drive_web_view_link` | Link "Ver documento" |
| `reason` | Motivo de rejeição (apenas `document.rejected`) |
| `created_at` | Timestamp para ordenação |

**Nenhum campo está faltando.**

---

## D) Estratégia de transporte

| Opção | Risco | Esforço | Fase recomendada |
|---|---|---|---|
| 1. Watch JSONL local | Baixo — arquivo local | Baixo | **G10-B (agora)** |
| 2. Export filtrado (pull) | Baixo — comando existente | Baixo | **G10-B (agora)** |
| 3. Push via outbox processor | Médio — nova infra | Médio | Deferido |
| 4. Pasta compartilhada | Médio — coordenação de paths | Médio | Deferido |
| 5. Supabase | Alto — decisão arquitetural contrária | Alto | **Rejeitado** |

**Recomendação:** Opção 1 (watch outbox) + Opção 2 (pull sob demanda). Ambas já funcionais.

---

## E) Regras de idempotência (já documentadas)

1. Consumidor deduplica por `ingestion_event_id` (UUID único)
2. `event_id` é legado — pode repetir para múltiplos eventos do mesmo documento
3. Estado por documento: consolidar via último `created_at` para `document_id`
4. Reprocessamento seguro: mesmo `ingestion_event_id` = ignorar
5. Eventos fora de ordem: processar por `created_at` ascendente

---

## F) Proposta de UI para Controle de Tapetes

### Na tela do Pedido
- Lista de documentos vinculados (badges: tipo, formato, direção, status)
- Botão "Ver documento" → abre `drive_web_view_link` em nova aba
- Histórico de eventos (timeline: linked → accepted/rejected)
- Se rejected: exibir `reason`
- **Sem** upload de arquivo para Supabase Storage
- **Sem** download via API (link direto do Drive)

### Na tela de documento
- Metadados: tipo, formato, direção, status, filename, sha256
- Link direto para Drive
- Eventos relacionados (linked, accepted/rejected)

---

## G) Matriz de decisão

| Tema | Decisão | Risco | Patch G10-B? |
|---|---|---|---|
| Modelo de integração | Watch outbox + pull commands | Muito baixo | NÃO (já funciona) |
| Fonte de verdade | Outbox para app, SQLite/Docs para ingestor | Baixo | NÃO |
| Contrato de dados | Completo — 25+ campos | Nenhum | NÃO |
| Transporte | JSONL watch + export sob demanda | Baixo | NÃO |
| Idempotência | ingestioneventid canônico | Nenhum | NÃO (já documentado) |
| UI Controle de Tapetes | driveweblink em nova aba | Nenhum | App-side |
| Convenience export | `export:package --pedido` | Baixo | SIM (opcional) |

---

## H) Recomendação para G10-B

**RAVATEX-DOC-INGESTOR-G10-B-EXPORT-PACKAGE**

O menor patch útil é um comando de conveniência: `export:package --pedido PED-XX-YYYY` que gera um arquivo consolidado (JSONL + manifest + summary) para facilitar o consumo pelo Controle de Tapetes. Opcional — os blocos já existem.

**Ordem pronta:**

```
FASE: RAVATEX-DOC-INGESTOR-G10-B-EXPORT-PACKAGE
Agente: DeepSeek Flash
HEAD base: (G10-A commit)

Escopo (opcional):
  1. cli.ts: command "export-package"
     --pedido <PED-XX-YYYY> (required)
     --output <path> (optional, defaults to stdout)
     Output: JSON with { pedido, events[], manifest, summary }
  2. src/core/exportPackage.ts: buildAndExportPackage(pedido)
     - call export:events + export:manifest
     - add summary (document count, status counts)
  3. Tests (2-3): package has events, manifest, summary
  4. Docs: update contract + examples

Não fazer:
  - Não tocar Controle de Tapetes
  - Não alterar outbox funcional
  - Não alterar schema
  - Não chamar Google/Drive
```

---

## I) O que NÃO será feito agora

- Polling ativo do Controle de Tapetes (implementação no app)
- Webhook/notificação push
- Supabase como índice
- Upload de arquivos para Supabase Storage
- Iframe/proxy para visualização Drive
- Sincronização bidirecional
