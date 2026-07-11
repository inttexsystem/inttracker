# Ravatex Documents Ingestor

Módulo separado para ingestão de documentos (XML/PDF) via Gmail para o sistema Ravatex.

## Decisão arquitetural: **Drive-first**

> O Google Drive da mesma conta usada para leitura do Gmail é o **armazenamento canônico** dos documentos PDF/XML.

O disco local é usado **apenas** para:
- **SQLite** (`data/app.db`) — estado de processamento
- **Outbox JSONL** (`data/outbox/document-events.jsonl`) — eventos para o app principal
- **Cache temporário** (`data/cache/`) — espelho local *opcional* dos documentos, **nunca** fonte de verdade
- **Token Google** (`data/google-token.json`) — protegido pelo `.gitignore`

## Por que está fora do app principal

- **Responsabilidade única**: o app principal (Controle de Tapetes) gerencia pedidos, clientes e produção.
- **Segurança**: OAuth Gmail/Drive fica isolado.
- **Independência**: execução sob demanda via CLI.
- **Acoplamento futuro**: via outbox JSONL com referências Drive.

## Stack

- Node.js 22 + TypeScript (ESM strict)
- SQLite (better-sqlite3)
- googleapis (Gmail API + Drive API)
- Vitest para testes
- Commander para CLI

## Configuração

1. Copie `.env.example` para `.env` e preencha:
   ```
   GOOGLE_CLIENT_ID=seu-client-id
   GOOGLE_CLIENT_SECRET=seu-client-secret
   GOOGLE_REDIRECT_URI=http://localhost
   GOOGLE_OAUTH_SCOPES=https://www.googleapis.com/auth/gmail.readonly,https://www.googleapis.com/auth/drive.file
   GOOGLE_DRIVE_ROOT_FOLDER_NAME=Ravatex Documents Ingestor
   GOOGLE_DRIVE_CREATE_MISSING_FOLDERS=true
   INGEST_REAL_GOOGLE=false
   ```

2. Crie credenciais OAuth 2.0 no [Google Cloud Console](https://console.cloud.google.com/):
   - Habilite **Gmail API** e **Google Drive API**
   - Crie OAuth 2.0 Client ID (tipo "Desktop app" ou "Web application")
   - Salve as credenciais em `data/google-token.json` (gerado pelo primeiro login)

3. Instale dependências:
   ```bash
   npm install
   ```

## Segurança operacional

> **Nenhuma chamada real ao Google é feita sem comando explícito.**

| Comando | Comportamento |
|---------|---------------|
| `npm run scan` (sem flag) | **DRY-RUN** — não chama Gmail/Drive. |
| `npm run scan -- --confirm-real-google` | **REAL** — chama Gmail API e Drive API. |
| `npm run scan -- --dry-run` | Força DRY-RUN mesmo se flag estiver ativa. |
| `npm run assign -- --id X --pedido Y` | DRY-RUN (apenas valida). |
| `npm run assign -- --id X --pedido Y --confirm-real-google` | **REAL** — move/copia no Drive. |
| `npm run sync:mapped` (sem flag) | **DRY-RUN** — orquestra scan → export mapped → report sem chamadas reais. |
| `npm run sync:mapped -- --confirm-real-google` | **REAL** — scan real + export mapped + report. |
| `npm run write:latest` | **LOCAL** — gera `data/exports/latest.json` com metadados do export mapped. |
| `npm run list:pending` | Apenas leitura local. |
| `npm run export:events` | Apenas leitura/escrita local. |
| `npm run export:mapped` | Apenas leitura/escrita local (gera `data/exports/documentos-mapeados.jsonl`). |

Quando `INGEST_REAL_GOOGLE=false` (padrão no `.env.example`), o `confirmReal: true` ainda é exigido pela CLI — ambos os gates são necessários.

## Canonical Events for Supabase

Run `npm run export:ingestion-events` to generate `data/exports/ingestion-events.jsonl` from SQLite `ingestion_events`. The file preserves each database ID as `ingestion_event_id` and is the only supported `--events` input for `sync:supabase`.

Do not use `data/outbox/document-events.jsonl` for Supabase. It is a legacy transport and can lack canonical event IDs.

`export:mapped` also emits `latest_ingestion_event_id` with its matching
`latest_ingestion_event_at`. The service-role Supabase writer sends a candidate
only when this canonical base is complete; incomplete rows are reported as
skipped and never receive an invented status or timestamp.

## Escopos OAuth (preferenciais)

- `https://www.googleapis.com/auth/gmail.readonly` — leitura da caixa (read-only)
- `https://www.googleapis.com/auth/drive.file` — acesso apenas a arquivos criados/abertos pelo app

**Não usar** `https://www.googleapis.com/auth/drive` (escopo amplo) sem justificativa explícita. O connector OAuth recusa broad-scope via `assertSafeScopes()`.

## Como usar

### 1. Setup (uma vez)
```bash
# 1.1 — primeiro login OAuth (gera data/google-token.json)
# Em fase futura (RAVATEX-DOC-INGESTOR-REAL-ACCOUNT-SMOKE-C).

# 1.2 — instalar deps
npm install
```

### 2. Scan dry-run (seguro, padrão)
```bash
npm run scan
```
Saída esperada:
```
[scan] DRY-RUN — no real Gmail/Drive calls performed.
[scan] Pass --confirm-real-google to perform real processing.
```

### 3. Scan real
```bash
npm run scan -- --confirm-real-google
```
Saída esperada (real):
```
[scan] REAL mode:
  emailsScanned:    1
  attachmentsFound: 2
  newDocuments:     2
  duplicates:       0
```

### 4. Listar pendentes
```bash
npm run list:pending
```

### 5. Atribuir Pedido manualmente
```bash
npm run assign -- --id <document_id_ou_email_id> --pedido 25/2026 --confirm-real-google
```

### 6. Exportar eventos
```bash
npm run export:events
```

### 7. Sincronização local em um comando (`sync:mapped`)

`npm run sync:mapped` é um **atalho operacional** que executa em sequência, em um único processo:

1. **scan** — varre Gmail (ou dry-run)
2. **export mapped** — gera `data/exports/documentos-mapeados.jsonl`
3. **report** — imprime o relatório agregado do SQLite no stdout

Tudo local. **Não toca o Controle de Tapetes**, **não envia nada por HTTP**, **não cria scheduler/daemon/watcher** — é uma única execução sob demanda do operador.

#### 7.1 Dry-run (padrão, seguro)
```bash
npm run sync:mapped
```
Saída esperada (sem chamadas reais ao Google):
```
[sync-mapped] DRY-RUN — no real Gmail/Drive calls performed.
[sync-mapped] Pass --confirm-real-google to perform real processing.
[sync-mapped] Step 1/3: scan
[sync-mapped] scan: dry-run (no Gmail calls).
[sync-mapped] Step 2/3: export mapped documents
[sync-mapped] exported N mapped document(s) → .../data/exports/documentos-mapeados.jsonl
[sync-mapped] Step 3/3: report
--- import report ---
  totalDocuments:        N
  ...
[sync-mapped] DONE in <ms>ms — sequence: scan → export → report.
```

#### 7.2 Real mode (requer OAuth + confirmação explícita)
```bash
npm run sync:mapped -- --confirm-real-google --days 3
```
- Sem `--confirm-real-google`, o scan é dry-run mesmo se outras flags sugerirem operação real.
- REAL + `--max-attachments > 5` exige `--query` (ou `--retry-message`) para segurança.
- `--days > 7` exige `--wide-scan` (mesma proteção do `npm run scan`).

#### 7.3 Retry de uma mensagem específica (narrow, seguro)
```bash
# Dry-run: apenas mostra o que faria
npm run sync:mapped -- --retry-message <MESSAGE_ID> --max-attachments 1

# Real: processa a mensagem específica (sem scan amplo)
npm run sync:mapped -- --confirm-real-google --retry-message <MESSAGE_ID> --max-attachments 1
```
- O comando **força `days=1` internamente** quando `--retry-message` é fornecido sem `--days`.
- O scan usa `fetchMessageById` direto (sem query `after:YYYY/MM/DD`), isolando a mensagem.
- O dedupe existente (`isDuplicate` + `isDuplicateInSameMessage`) bloqueia criação de duplicata se a mensagem já foi processada.

#### 7.4 Guardas de segurança de `--retry-message`

| Combinação | Resultado |
|------------|-----------|
| `--retry-message <id>` (sem `--days`) | OK — `days=1` automático, modo narrow |
| `--retry-message <id> --days 1` | OK — modo narrow |
| `--retry-message <id> --days > 1` | **FALHA** com `[sync-mapped] --retry-message requires --days <= 1` |
| `--retry-message <id> --wide-scan` | **FALHA** com `[sync-mapped] --retry-message cannot be combined with --wide-scan` |
| `--retry-message <id> --query "..."` | **FALHA** com `[sync-mapped] --retry-message cannot be combined with --query` |

Essas guardas **impedem scan amplo acidental** quando o operador quer reprocessar uma mensagem específica.

#### 7.5 Saída esperada e contrato

O comando gera/atualiza **`data/exports/documentos-mapeados.jsonl`** no formato JSONL com `schema_version: 1`, contendo um registro por documento, com timestamps por evento (`detected_at`, `linked_at`, `accepted_at`, `rejected_at`) e `pedido_manual` quando aplicável. Cada linha pode ser consumida independentemente.

O **report** impresso no stdout segue o mesmo formato do `npm run report` (modo texto ou `--json-report`).

#### 7.6 Relação com outros comandos

`sync:mapped` é um **atalho** que combina três comandos já existentes. Executar `sync:mapped` equivale a rodar em sequência:

| Etapa | Comando equivalente | Tipo |
|-------|---------------------|------|
| 1. Scan | `npm run scan -- [flags]` | real (com `--confirm-real-google`) ou dry-run |
| 2. Export | `npm run export:mapped` | sempre local (read + write JSONL) |
| 3. Report | `npm run report` | sempre read-only |

Após `sync:mapped`, você pode usar:
- `npm run list:pending -- --limit 20` para ver a tabela atualizada
- `npm run report -- --json` para extrair o mesmo report em JSON
- `npm run export:mapped` para re-gerar o JSONL a qualquer momento

#### 7.7 Limites e fora de escopo

- **Não** toca o Controle de Tapetes (sem HTTP, sem Supabase, sem outbox cross-app).
- **Não** cria scheduler, daemon ou watcher — é uma única execução sob demanda.
- **Não** envia notificações, e-mails, webhooks.
- **Não** altera schema SQLite, **não** cria migrations.
- **Consumo automático pelo Controle de Tapetes é fase posterior.** Hoje, o JSONL é apenas snapshot local. Veja `docs/CONTROL_TAPETES_DOCUMENTS_CONTRACT.md` §4.4 e §9 para o estado atual do contrato.

#### 7.8 Manifest `latest.json` (`write:latest`)

O comando `npm run write:latest` gera um arquivo `data/exports/latest.json` com **metadados do último export mapped**. É uma operação puramente local — não faz chamadas Gmail/Drive.

**Formato do manifest:**

```json
{
  "schema_version": 1,
  "kind": "documents-mapped-latest",
  "generated_at": "2026-07-09T17:00:00.000Z",
  "exported_at": "2026-07-09T16:55:00.000Z",
  "jsonl_path": "data/exports/documentos-mapeados.jsonl",
  "jsonl_filename": "documentos-mapeados.jsonl",
  "count": 2,
  "hash": "a1b2c3d4e5f67890",
  "bytes": 1234,
  "last_error": null
}
```

**Uso:**
```bash
npm run write:latest

# Caminhos customizados (opcional):
npm run write:latest -- --jsonl data/exports/documentos-mapeados.jsonl --output data/exports/latest.json
```

**Com `sync:mapped`:**
```bash
# Gera latest.json junto com o scan/export/report:
npm run sync:mapped -- --write-latest
npm run sync:mapped -- --confirm-real-google --days 3 --write-latest
```

**Objetivo:** O Controle de Tapetes consumirá `latest.json` para detectar quando há novos documentos exportados, sem precisar de file picker manual (fase G22+). O scheduler (Task Scheduler) rodará `sync:mapped --write-latest` diariamente.

## Estrutura de armazenamento

### Google Drive (canônico)

Novo layout (G3+) — organizado por data/tipo/direção:

```
Ravatex Documents Ingestor/                 ← GOOGLE_DRIVE_ROOT_FOLDER_NAME
├── pendentes/
│   └── YYYY-MM-DD/
│       ├── nf/
│       │   ├── entrada/
│       │   │   └── <anexo>.pdf|xml
│       │   ├── saida/
│       │   │   └── <anexo>.pdf|xml
│       │   └── desconhecida/
│       │       └── <anexo>.pdf|xml
│       ├── romaneio/
│       │   └── <anexo>.pdf
│       └── desconhecido/
│           └── <anexo>.*
└── pedidos/
    └── PED-XX-YYYY/
        ├── manifest.json
        └── YYYY-MM-DD/
            ├── nf/
            │   ├── entrada/
            │   ├── saida/
            │   └── desconhecida/
            ├── romaneio/
            └── desconhecido/
```

Layout antigo (pré-G3) — para compatibilidade, arquivos enviados antes de G3 podem permanecer em:

```
pendentes/YYYY-MM-DD/email-<gmail_message_id>/<anexo>.pdf|xml
pedidos/PED-XX-YYYY/YYYY-MM-DD/{nf,romaneio,desconhecido}/<anexo>.pdf|xml
```

Manifests e eventos existentes apontando para paths antigos continuam legíveis.

### Disco local (não-canônico)
```
data/
  app.db              # SQLite
  outbox/             # JSONL events
  cache/              # Mirror local opcional
  google-token.json   # OAuth token (protegido por .gitignore)
```

## Contrato de integração (evento JSONL)

Cada `document.detected` carrega referências Drive:

```json
{
  "schema_version": 1,
  "event_type": "document.detected",
  "event_id": "uuid",
  "created_at": "ISO-8601",
  "pedido_manual": "PED-25-2026",
  "source": "gmail",
  "gmail_message_id": "...",
  "thread_id": "...",
  "document": {
    "document_id": "uuid",
    "tipo_documento": "nf_pdf",
    "filename_original": "...",
    "sha256": "...",
    "storage_backend": "google_drive",
    "storage_uri": "gdrive://file/<drive_file_id>",
    "drive_file_id": "...",
    "drive_folder_id": "...",
    "drive_web_view_link": "https://drive.google.com/file/d/<id>/view",
    "drive_web_content_link": "https://drive.google.com/uc?...",
    "local_cache_path": "./data/cache/pedidos/.../arquivo.pdf",
    "manifest_storage_uri": "gdrive://file/<manifest_id>"
  },
  "status": "pending_app_acceptance"
}
```

## Fluxo

1. **Scan**: Gmail → classifica → upload para Drive em `pendentes/`
2. **Assign**: usuário atribui Pedido manualmente → move/copia no Drive para `pedidos/PED-XX-YYYY/...` → manifest é criado/atualizado no Drive → evento `pending_app_acceptance` é gerado no outbox local
3. **Integração futura**: app Controle de Tapetes consome outbox local via `storage_uri`/`drive_file_id`, mostra notificação no Pedido
4. **Aceite/Rejeição**: o app principal decide incorporar/rejeitar (fase futura)
5. **Documento só entra no Pedido após aceite futuro** — nunca antes

## Comportamento de movimento no Drive

Por padrão, `assignPedido` **copia** o documento do Drive `pendentes/` para `pedidos/PED-XX-YYYY/...` (não apaga o original). Isso preserva o original como trilha de auditoria. Para mudar, ver `AssignOptions.copyInsteadOfMove`.

## Proibições nesta fase

- ❌ Sem Supabase
- ❌ Sem processamento real automático sem `--confirm-real-google`
- ❌ Sem OCR
- ❌ Sem identificação automática de Pedido
- ❌ Sem watcher/daemon contínuo
- ❌ Sem uso de escopo `drive` (amplo)
- ❌ Sem deletar/mover emails
- ❌ Sem usar disco local como fonte canônica de documento

## Validação hermética / CI

A suíte de testes é **hermética**: não usa `.env` real, não usa `data/google-token.json` real, não faz chamadas reais a Gmail/Drive. Todo o tráfego para Google é injetado via mocks/fakes (DI explícita em `createScan`/`createAssignPedido` e fake `drive_v3.Drive`).

| Comando | O que faz | Dependências externas |
|---------|-----------|----------------------|
| `npm test` | Roda todos os testes com setup hermético (`tests/setup.ts`) | Nenhuma |
| `npm run test:ci` | Mesmo que `npm test` (alias para CI) | Nenhuma |
| `npm run test:watch` | Modo watch para desenvolvimento local | Nenhuma |

### Garantias automáticas

- `tests/setup.ts` força `GOOGLE_TOKEN_PATH` para um path **inexistente** em `os.tmpdir()` antes de qualquer módulo carregar `config.ts`. Resultado: nenhum token real é lido.
- `DATABASE_PATH`, `OUTBOX_PATH`, `LOCAL_CACHE_PATH` apontam para diretórios temporários únicos por run. Nenhum `data/app.db`, `data/outbox/*.jsonl` ou `data/cache/` real é tocado.
- `INGEST_REAL_GOOGLE=false` é forçado no env de teste.
- O teste de integração (`tests/integration-mock-flow.test.ts`) exercita o fluxo completo fake Gmail → fake Drive → SQLite temporário → outbox JSONL temporário, sem nenhuma chamada de rede.

### Smoke real (opcional, manual)

O smoke real com conta Google (`REAL-ACCOUNT-SMOKE-C2`) é **manual e explícito**:
- Requer `npm run login` para gerar `data/google-token.json`.
- Requer `--confirm-real-google` na CLI.
- Toca o Drive real e o Gmail real.

Não faz parte de `npm test` / `npm run test:ci` / CI. Nunca commite `data/google-token.json`, `data/app.db`, `data/outbox/*.jsonl` ou `data/runs/*.jsonl` — todos estão no `.gitignore`.

### Workflow CI

`.github/workflows/test.yml` roda `npm install && npm run test:ci` em push/PR. Não requer secrets, não usa credenciais Google, não publica artefatos.

## Operação diária

Comandos para inspecionar, reportar e reprocessar documentos sem fazer chamadas reais ao Google.

| Comando | Tipo | O que faz | Requer `--confirm-real-google`? |
|---------|------|-----------|-------------------------------|
| `npm run list:pending` | read-only | Lista documentos com saída segura (IDs mascarados) | não |
| `npm run inspect -- --id <id>` | read-only | Mostra detalhes de um documento/email | não |
| `npm run report` | read-only | Relatório agregado (por tipo, formato, direção, status, pedido) | não |
| `npm run reprocess -- --id <id>` | dry-run | Mostra o que faria (padrão) | não |
| `npm run reprocess -- --id <id> --confirm` | write local | Aplica ações locais idempotentes | não |
| `npm run scan -- --confirm-real-google` | real Google | Scan + upload Drive | sim |
| `npm run assign -- --id <id> --pedido <p> --confirm-real-google` | real Google | Atribui Pedido + move Drive | sim |
| `npm run sync:mapped` | dry-run (padrão) ou real | scan + export mapped + report em um comando | sim (apenas para o scan) |
| `npm run export:mapped` | read + write local | Gera `data/exports/documentos-mapeados.jsonl` (snapshot) | não |
| `npm run write:latest` | read + write local | Gera `data/exports/latest.json` com metadados count/hash/bytes/timestamp | não |

### Exemplos

```bash
# Listar últimos 20 documentos pendentes
npm run list:pending

# Filtrar por status e tipo
npm run list:pending -- --status pending --tipo nf

# Filtrar por formato e direção NF
npm run list:pending -- --tipo nf --formato xml
npm run list:pending -- --tipo nf --direcao entrada

# Filtrar usando tipo legado (mapeia automaticamente)
npm run list:pending -- --tipo nf_pdf

# Limitar a 10 resultados
npm run list:pending -- --limit 10

# Saída JSON (para automação)
npm run list:pending -- --json

# Inspecionar um documento específico
npm run inspect -- --id doc-abc123
npm run inspect -- --id msg-gmail-id --json

# Relatório agregado
npm run report
npm run report -- --days 30 --pedido PED-25-2026
npm run report -- --json

# Sincronização local em um comando (scan + export mapped + report)
npm run sync:mapped                                    # dry-run padrão
npm run sync:mapped -- --confirm-real-google --days 3  # real (3 dias)
npm run sync:mapped -- --status pending --export-days 7 --json-report

# Retry narrow de uma mensagem específica (nunca dispara scan amplo)
npm run sync:mapped -- --retry-message <MESSAGE_ID>
npm run sync:mapped -- --confirm-real-google --retry-message <MESSAGE_ID> --max-attachments 1

# Manifest do último export (metadados count/hash/bytes/timestamp)
npm run write:latest
npm run sync:mapped -- --write-latest
```

### Segurança de saída

- Modo texto: IDs longos são mascarados (ex: `1a2b****c3d4`). Emails têm parte local mascarada. Assuntos são truncados. Links Drive mostram apenas o ID do arquivo mascarado.
- Modo JSON: mesma política de mascaramento. Nenhum token, secret ou credencial é incluído.
- Nenhum comando (exceto `scan --confirm-real-google`, `assign --confirm-real-google` e `sync:mapped --confirm-real-google`) faz chamadas reais ao Google.

### O que nunca commitar

- `data/google-token.json` — token OAuth real
- `data/app.db` — banco SQLite local
- `data/outbox/*.jsonl` — eventos reais
- `data/runs/*.jsonl` — logs de run reais
- `data/cache/` — cache local de arquivos
- `.env` — credenciais

Todos estão no `.gitignore`. Use `git status --short` antes de qualquer commit.

## Contrato futuro

O contrato de integração com o Controle de Tapetes está documentado em `docs/CONTROL_TAPETES_DOCUMENTS_CONTRACT.md`. Nenhuma integração é implementada nesta fase — o documento é apenas design/read-only.
