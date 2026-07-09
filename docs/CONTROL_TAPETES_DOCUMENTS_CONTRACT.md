# Controle de Tapetes  Documents Ingestor: Contrato de Integração

> **Status:** G6+ validated — outbox operacional com link/accept/reject local-only.
> **Objetivo:** Documentar o contrato de eventos que o Controle de Tapetes consumirá do Documents Ingestor.

---

## 1. Visão geral

O Documents Ingestor é o módulo que recebe documentos (PDF/XML) via Gmail, classifica, armazena canonicamente no Google Drive e gera eventos para consumo externo. O Controle de Tapetes é o app principal que gerencia Pedidos, clientes e produção.

A integração é **unidirecional**: Controle de Tapetes **consome** eventos do Documents Ingestor, nunca o contrário.

```
┌─────────────────────┐         ┌──────────────────────┐
│  Gmail (PDF/XML)    │────────▶│  Documents Ingestor  │
└─────────────────────┘         │  - scan              │
                                │  - classify          │
                                │  - upload to Drive   │
                                │  - generate events   │
                                └──────────┬───────────┘
                                           │ outbox JSONL
                                           ▼
                                ┌──────────────────────┐
                                │  Controle de Tapetes  │
                                │  - consume events     │
                                │  - show in Pedido     │
                                │  - accept/reject      │
                                └──────────────────────┘
```

---

## 2. Eventos do outbox

### 2.1 Tipos de evento

O outbox (`data/outbox/document-events.jsonl`) contém 4 tipos de evento:

| event_type | Descrição | status |
|---|---|---|
| `document.detected` | Documento detectado e ingerido (scan Gmail + Drive) | `pending_app_acceptance` |
| `document.linked` | Documento vinculado a pedido (local-only, sem Drive) | `pending_app_acceptance` |
| `document.accepted` | Documento aceito pelo operador | `accepted` |
| `document.rejected` | Documento rejeitado pelo operador | `rejected` |

### 2.2 Estrutura do evento (todos os tipos)

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `schema_version` | int | sim | Versão do schema (1 ou 2) |
| `event_type` | string | sim | `document.detected` \| `document.linked` \| `document.accepted` \| `document.rejected` |
| `event_id` | string | sim | **Legado** — pode ser igual a `document_id`. Usar `ingestion_event_id` como identificador canônico |
| `ingestion_event_id` | UUID | não | Identificador canônico do evento (`ingestion_events.id`). Único por evento |
| `created_at` | ISO-8601 | sim | Timestamp de criação |
| `pedido_manual` | string | sim | Pedido normalizado (`PED-XX-YYYY`) |
| `source` | string | sim | `gmail` |
| `gmail_message_id` | string | sim | ID da mensagem Gmail original |
| `thread_id` | string | sim | ID da thread Gmail |
| `status` | enum | sim | `pending_app_acceptance` \| `accepted` \| `rejected` |
| `document.document_id` | UUID | sim | ID interno do documento |
| `document.tipo_documento` | enum | sim | `nf` \| `romaneio` \| `desconhecido` (v2) ou `nf_pdf` \| `nf_xml` \| `romaneio` \| `desconhecido` (v1 legado) |
| `document.formato` | enum | não | `pdf` \| `xml` \| `desconhecido` (v2) |
| `document.direcao_nf` | enum | não | `entrada` \| `saida` \| `desconhecida` (apenas NF, v2) |
| `document.filename_original` | string | sim | Nome original do arquivo |
| `document.sha256` | hex | sim | Hash SHA256 do conteúdo |
| `document.storage_backend` | string | sim | `google_drive` |
| `document.storage_uri` | URI | sim | `gdrive://file/<drive_file_id>` |
| `document.drive_file_id` | string | não | ID do arquivo no Google Drive (ausente para fixtures sintéticos) |
| `document.drive_web_view_link` | URL | não | Link de visualização no Drive |
| `document.drive_web_content_link` | URL | não | Link de download direto |
| `document.manifest_storage_uri` | URI | não | URI do manifest do Pedido no Drive (apenas assign real) |
| `document.reason` | string | não | Motivo da rejeição (apenas `document.rejected`) |

### 2.3 Visualização de documentos

O Controle de Tapetes deve abrir documentos via **link direto do Google Drive**:

- Usar `document.drive_web_view_link` para abrir em nova aba
- Fallback: construir link a partir de `document.drive_file_id` (`https://drive.google.com/file/d/{id}/view`)
- **Não armazenar** PDF/XML no Supabase ou backend
- **Não usar** iframe, proxy ou download via API (decisões futuras, não requisito atual)

---

## 3. Campos mínimos para exibição no Pedido

Para mostrar um documento na UI do Controle de Tapetes:

| Campo | Origem | Obrigatório |
|---|---|---|
| `document_id` | evento | sim |
| `pedido_manual` | evento | sim |
| `tipo_documento` | evento | sim |
| `formato` | evento | recomendado |
| `direcao_nf` | evento | recomendado (NF) |
| `filename_original` | evento | sim |
| `drive_web_view_link` | evento | sim (link para abrir no Drive) |
| `drive_file_id` | evento | sim (fallback para link) |
| `status` | evento | sim |
| `event_type` | evento | sim (para ícone/ação contextual) |
| `reason` | evento | recomendado (quando rejected) |
| `created_at` | evento | sim (ordenação) |
| `ingestion_event_id` | evento | recomendado (chave única) |

---

## 4. Fluxo operacional atual

### 4.1 Scan (Gmail → Drive)
```
Gmail → scan → classify → upload Drive → SQLite → document.detected
```

### 4.2 Rota 1: Assign real (Drive)
```
document.detected → assign --confirm-real-google → Drive move + manifest → document.detected (pendente aceite)
```

### 4.3 Rota 2: Link local-only (sem Drive)
```
document.detected → link → document.linked → accept/reject → document.accepted / document.rejected
```

**Importante:** assign real e link local-only são **rotas alternativas**. Não devem ser usadas no mesmo documento. Assign real exige documento `pending` e faz Drive move + manifest. Link é vínculo lógico sem Drive.

### 4.4 Sincronização local em um comando (`sync:mapped`)

`npm run sync:mapped` é um atalho operacional que executa em sequência, em um único processo:

```
sync:mapped → scan (Gmail) → export mapped (JSONL) → report (stdout)
```

- **Dry-run por padrão.** Sem `--confirm-real-google`, zero chamadas reais ao Gmail/Drive.
- **Real mode** requer `--confirm-real-google` explícito (gate duplo com `INGEST_REAL_GOOGLE` no `.env`).
- **Retry narrow** com `--retry-message <MESSAGE_ID>` força `days=1` e usa `fetchMessageById` direto (sem scan amplo).
- **Saída:** `data/exports/documentos-mapeados.jsonl` (JSONL, `schema_version: 1`).

**Importante:** `sync:mapped` é um **produtor** de `documentos-mapeados.jsonl`. **Não toca o Controle de Tapetes** — é apenas geração local sob demanda do operador. O **consumo automático** desse JSONL pelo Controle é **fase posterior** (G14+) e não está implementado nesta versão. Hoje, o JSONL é gerado apenas como snapshot local para inspeção manual ou polling externo.

### 4.5 Campos opcionais de `ingestion_event_id` no mapped export (`schema_version: 1`)

A partir da fase G17-B, `documentos-mapeados.jsonl` (`schema_version: 1`) pode incluir **5 campos opcionais**:

| Campo | Tipo | Descrição |
|---|---|---|
| `latest_ingestion_event_id` | UUID \| null | ID do evento mais recente do documento (maior `created_at`) |
| `detected_ingestion_event_id` | UUID \| null | ID do evento `document.detected` (primeiro detectado) |
| `linked_ingestion_event_id` | UUID \| null | ID do evento `document.linked` (primeiro vinculado) |
| `accepted_ingestion_event_id` | UUID \| null | ID do evento `document.accepted` (primeiro aceito) |
| `rejected_ingestion_event_id` | UUID \| null | ID do evento `document.rejected` (primeiro rejeitado) |

**Regras de consumo:**
- Campos **opcionais** — consumidores devem ignorar campos desconhecidos.
- `null` significa ausência daquele evento para o documento.
- O Controle de Tapetes **não depende** desses campos na bridge atual.
- Não há mudança de schema SQLite, migration, ou outbox.
- O `schema_version` permanece `1`.

---

## 5. Decision points

| Decisão | Status |
|---|---|
| Manifest Drive após link local-only | **Deferido** — outbox supre a lacuna. Manifest é artefato de assign real |
| event_id legado (document_id) | **Preservado** — usar `ingestion_event_id` como identificador canônico. Migração para v2 deferida |
| Bloqueio de direção NF (entrada vs saída) | **Deferido** — falta modelo de pedido com direção esperada |
| Controle de Tapetes consome eventos via outbox JSONL | **Atual** — polling do arquivo local, sem HTTP/Supabase |

---

## 6. Regras de idempotência para o consumidor

1. **`ingestion_event_id` é o identificador canônico do evento.** O consumidor deve usá-lo como chave primária. Reprocessar o mesmo `ingestion_event_id` deve ser idempotente (ignorar duplicatas).
2. **`event_id` é legado.** Pode repetir-se em eventos do mesmo documento. Não usar como chave única.
3. **`document_id` identifica o documento.** Pode ser usado para consolidar o estado atual do documento a partir do último evento recebido.
4. **Ordem de processamento:** processar eventos por `created_at` ascendente. Se dois eventos tiverem o mesmo timestamp, usar `ingestion_event_id` lexicográfico como desempate.
5. **Status derivado:** o status final de um documento é o `status` do evento mais recente (maior `created_at`).

---

## 7. Exemplo de eventos (JSONL)

Arquivo: `contracts/examples/document-events.sample.jsonl`

Contém 4 eventos sequenciais com IDs fictícios:

| event_type | doc_id | ingestion_event_id | status |
|---|---|---|---|
| `document.detected` | doc_example_001 | 550e8400-...-440001 | pending_app_acceptance |
| `document.linked` | doc_example_001 | 550e8400-...-440002 | pending_app_acceptance |
| `document.accepted` | doc_example_001 | 550e8400-...-440003 | accepted |
| `document.rejected` | doc_example_002 | 550e8400-...-440004 | rejected + reason |

Notas:
- `event_id` repete-se em `doc_example_001` (3 eventos, mesmo event_id).
- `ingestion_event_id` é único por evento.
- `reason` aparece apenas no `document.rejected`.

---

## 8. Fases concluídas (documents-ingestor)

| Fase | Descrição |
|---|---|
| G5 | Ingestão Gmail real → Drive → taxonomia NF/XML/entrada |
| G6-B | Link local-only (pending → assigned) |
| G6-B-R1 | Preservação de event_type no outbox |
| G6-C | Accept/reject local-only + funil no report |
| G7-B | Warning direção NF, ingestion_event_id, report em seções |
| G7-C | Validação hermética do funil completo |
| G7-C-R1 | Persistência de reason no re-export |
| G8-A | Design de integração e sync |
| G8-B | Atualização de contrato (JSON schema + docs) |
| G8-C | Polish operacional (filtros, export, inspect) |
| G8-D | Smoke real-lite (link+accept validados em documento real) |
| G12-C1 | Evento `document.detected` no scan + `document.linked` no assign (sem schema novo) |
| G12-D1 | `export-received` (pending sem pedido) |
| G12-E1 | Design do export de documentos mapeados |
| G12-E2 | `export:mapped` + CLI `export-mapped` (snapshot JSONL) |
| G12-E3 | Diagnóstico de data quality no export mapeado |
| G12-E4 | Hardening dedup + cleanup local |
| G12-E5 | Correção `/dev/null` cross-platform (realAssign) |
| G13-A | Design do comando `sync:mapped` (read-only) |
| G13-B | Comando `sync:mapped` (CLI + script + 23 testes) |
| G13-C-R1 | Smoke real-lite do `sync:mapped` (MESSAGE_ID autorizado, isolamento confirmado) |
| G13-D | Documentação operacional do `sync:mapped` (README + contrato) |

---

## 9. O que NÃO será feito (fase atual)

- Nenhuma chamada HTTP/Webhook para o Controle de Tapetes
- Nenhum polling ativo do Controle de Tapetes (consumo passivo via arquivo)
- Nenhum Supabase
- Nenhuma autenticação compartilhada entre os dois apps
- Nenhum mapeamento automático de email → Pedido (atribuição é manual)
- Nenhuma deleção automática de arquivo no Drive
- **Nenhum consumo automático de `documentos-mapeados.jsonl` pelo Controle** — o JSONL gerado por `sync:mapped` / `export:mapped` é snapshot local. Integração automática é fase G14+ (não implementada).
- **Nenhum scheduler/daemon/watcher** — `sync:mapped` é uma única execução sob demanda do operador.

---

## 10. Comandos úteis

```bash
# Listar documentos por pedido
npm run list:pending -- --pedido 25/2026 --status assigned

# Inspecionar documento (mostra links Drive)
npm run inspect -- --id <doc_id_or_gmail_msg_id>

# Ver relatório agregado do funil
npm run report

# Vincular localmente (sem Drive)
npm run link -- --id <doc_id> --pedido 25/2026

# Aceitar/rejeitar localmente
npm run accept -- --id <doc_id>
npm run reject -- --id <doc_id> --reason "motivo"

# Exportar eventos (filtrado, read-only)
npm run export:events -- --pedido PED-99-2026 --event-type document.accepted --json
npm run export:events -- --event-type document.linked

# Exportar eventos pendentes (com side-effect)
npm run export:events -- --mark-exported

# Sincronização local em um comando (scan + export mapped + report)
# Dry-run padrão — seguro, zero chamadas reais
npm run sync:mapped

# Real mode — requer --confirm-real-google explícito
npm run sync:mapped -- --confirm-real-google --days 3

# Retry narrow — processa UMA mensagem específica sem scan amplo
npm run sync:mapped -- --retry-message <MESSAGE_ID>
npm run sync:mapped -- --confirm-real-google --retry-message <MESSAGE_ID> --max-attachments 1

# Gera o JSONL que este contrato descreve (snapshot local)
# Formato: schema_version=1, com detected_at/linked_at/accepted_at/rejected_at por documento
npm run export:mapped
```

**Nota sobre `sync:mapped` e este contrato:** O JSONL gerado por `sync:mapped` (via `export:mapped`) é um **snapshot** local, não um stream. **Não há polling automático pelo Controle de Tapetes** nesta fase. O consumo automático do JSONL pelo Controle é fase posterior (G14+). Hoje, o arquivo é apenas referência local para inspeção manual ou integração futura.
