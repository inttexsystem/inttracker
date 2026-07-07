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

---

## 5. Decision points

| Decisão | Status |
|---|---|
| Manifest Drive após link local-only | **Deferido** — outbox supre a lacuna. Manifest é artefato de assign real |
| event_id legado (document_id) | **Preservado** — usar `ingestion_event_id` como identificador canônico. Migração para v2 deferida |
| Bloqueio de direção NF (entrada vs saída) | **Deferido** — falta modelo de pedido com direção esperada |
| Controle de Tapetes consome eventos via outbox JSONL | **Atual** — polling do arquivo local, sem HTTP/Supabase |

---

## 6. Fases concluídas (documents-ingestor)

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

---

## 7. O que NÃO será feito (fase atual)

- Nenhuma chamada HTTP/Webhook para o Controle de Tapetes
- Nenhum polling ativo do Controle de Tapetes (consumo passivo via arquivo)
- Nenhum Supabase
- Nenhuma autenticação compartilhada entre os dois apps
- Nenhum mapeamento automático de email → Pedido (atribuição é manual)
- Nenhuma deleção automática de arquivo no Drive

---

## 8. Comandos úteis

```bash
npm run list:pending -- --status assigned --tipo nf
npm run inspect -- --id <doc_id_or_gmail_msg_id>
npm run report
npm run link -- --id <doc_id> --pedido 25/2026
npm run accept -- --id <doc_id>
npm run reject -- --id <doc_id> --reason "motivo"
npm run export:events
```
