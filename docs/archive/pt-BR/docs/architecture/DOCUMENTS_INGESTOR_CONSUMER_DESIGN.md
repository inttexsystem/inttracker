# Documents Ingestor — Consumer Design para Controle de Tapetes

> **Fase:** `RAVATEX-TAPETES-G11-A-DOCUMENTS-CONSUMER-DESIGN` (docs-only)
> **Tipo:** Diagnóstico + design de consumo read-only.
> **HEAD base Controle de Tapetes:** `381506c` — `work/app-next`
> **HEAD base Documents Ingestor:** `956682d` — `master`
> **Data:** 2026-07-07
>
> **Status atual (2026-07-09):** Este design foi **implementado** em G14 (HEAD Controle `fff052b`, HEAD Ingestor `bedbe909`).
> O consumo do JSONL flat (`documentos-mapeados.jsonl`) ocorre via bridge `RAVATEX_DOCUMENTS_RECEIVED` → Pedido Detail,
> conforme decisão de import manual sem polling. Ver `PROJECT_STATE.md` e `AGENT_HANDOFF.md` para o registro completo de G14.

---

## 1. Contexto

O Documents Ingestor (HEAD `956682d`) fechou o export package em G10-C. O Controle
de Tapetes (HEAD `381506c`) é uma SPA vanilla JS com roteamento hash, sem
framework, sem npm, sem Next.js, que gerencia Pedidos, Clientes, OPs, produção.

A integração é **unidirecional**: Documents Ingestor produz eventos →
Controle de Tapetes consome. Nenhum acoplamento direto entre os bancos.

---

## 2. Diagnóstico: Arquivos lidos

### Controle de Tapetes

| Arquivo | Propósito | Achado |
|---------|-----------|--------|
| `js/screens/pedido-detail.js` | Orquestrador do detalhe do Pedido | Cria estado, coordena data/progress/render/events. Rota `#/pedidos/:uuid` |
| `js/screens/pedido-detail-data.js` | Carregamento Supabase | `pedido.numero` é int sequencial. `pedido.criado_em` tem ano. |
| `js/screens/pedido-detail-progress.js` | computeViewModel | `documentRowsPedido` e `documentRowsOperacionais` com placeholders hardcoded |
| `js/screens/pedido-detail-render.js` | Render DOM | `buildDocuments()` card (linha 994) mostra documentos do pedido + operacionais. `buildDocumentRow()` + `buildDocumentStatusPill()` |
| `js/screens/pedido-detail-events.js` | Handlers/modais | `buildHistoryBlock()` com timeline vertical. `Documentos esperados` no modal de transição |
| `js/ui.js` | Primitivas UI | `el()`, `modal()`, `toast()`, `dataTable()` |
| `js/pedido-ui.js` | Helpers de Pedido | `pedidoStatusBadge()`, `pedidoStatusLabel()` |
| `js/badges.js` | Badges de OP | Padrão de pills coloridas |
| `js/op-display.js` | Código operacional | Formato `OP {pedido.numero}/{ano}-{letra}{seq}` |
| `js/screens/cliente-pedido-detail.js` | Detalhe do Pedido (cliente) | Timeline vertical com dots. `buildEventoItem()` |
| `docs/architecture/PEDIDO_OP_MOVIMENTACAO_DOCUMENTOS_PLANO.md` | Plano arquitetural | §2.5 Documentos: Google Drive como storage, metadados no banco. §4.2 Pedido Admin como índice central |
| `docs/architecture/PEDIDO_OP_SCHEMA_CONTRACT.md` | Contrato schema | §4 `documentos_operacionais` futura. Sem schema existente |
| `PROJECT_STATE.md` | Estado do projeto | Última fase: Pedido/OP Controlled Delete. Sem menção a Documents Ingestor |
| `AGENT_HANDOFF.md` | Handoff | Próximo passo recomendado: não menciona consumo de documentos |

### Documents Ingestor

| Arquivo | Propósito | Achado |
|---------|-----------|--------|
| `docs/CONTROL_TAPETES_DOCUMENTS_CONTRACT.md` | Contrato de integração | 12 campos mínimos para UI. `ingestion_event_id` canônico. `drive_web_view_link` abre nova aba |
| `contracts/document-event.schema.json` | Schema do evento | V1 legado, V2 com taxonomia 3 eixos. `pedido_manual` = `PED-XX-YYYY` |
| `contracts/examples/document-events.sample.jsonl` | 4 eventos exemplo | detected → linked → accepted/rejected |
| `docs/architecture/G10_CONTROLE_TAPETES_INTEGRATION_DESIGN.md` | Design de integração | Watch outbox + pull commands. UI proposta: lista + badges + drive link. Sem Supabase |
| `PROJECT_STATE.md` | Estado | G10-C concluído. 264 testes. Próxima fase: G11 watcher |
| `AGENT_HANDOFF.md` | Handoff | Próxima fase no repositório do Controle de Tapetes |

---

## 3. Respostas às perguntas obrigatórias

### A) Onde exibir documentos no Controle de Tapetes?

1. **Existe tela de detalhe do Pedido?** Sim — `#/pedidos/:uuid` renderizada por
   `pedido-detail.js` → `pedido-detail-render.js`. É a tela mais complexa, com
   header, stepper, itens, OPs, expedições, resumo, evolução do cliente e
   **Documentos** (card existente).

2. **Existe modal/aba/seção de documentos?** Sim — o card `buildDocuments()` no
   final do detalhe do Pedido (linha 994-1031) já mostra "Documentos do Pedido"
   e "Documentos Operacionais" com placeholders. Há também "Documentos esperados"
   dentro do modal de transição (linha 2176-2192).

3. **Existe timeline/histórico?** Sim — `buildHistoryBlock()` em
   `pedido-detail-events.js` e `buildEventoItem()` em `cliente-pedido-detail.js`
   com dot + linha vertical.

4. **Melhor ponto:**
   - **Card "Documentos" existente no detalhe do Pedido** — já consolidado,
     posicionado em grid 2-col ao lado da evolução do cliente. Substituir
     placeholders por dados reais do Ingestor.
   - Timeline de eventos dentro do mesmo card ou abaixo como seção separada.

5. **Menor local seguro para G11-B:** O card `buildDocuments()` já existe e
   aceita `view.documentRowsPedido` + `view.documentRowsOperacionais`. Adicionar
   nova seção "Documentos do Ingestor" dentro do mesmo card, ou criar novo card
   "Documentos Recebidos" abaixo. **Recomendação:** nova seção dentro do card
   existente "Documentos" — alteração mínima no render.

### B) Como mapear Pedido?

1. **Controle de Tapetes usa número sequencial:** `pedido.numero` = int (ex.: 25)
   sem ano no formato. Display: `#25` via `fmtNumero()`. Ano extraído de
   `pedido.criado_em`.

2. **Identificador canônico:** UUID do pedido (`pedidos.id`). Número é para
   display humano.

3. **Mapeamento para `PED-XX-YYYY`:**
   ```
   pedido_manual = "PED-" + String(pedido.numero).padStart(2, "0") + "-" + ano
   ano = new Date(pedido.criado_em).getFullYear()
   ```

4. **Risco de conflito:** O Ingestor usa `pedido_manual` digitado manualmente
   pelo operador. Se o operador errar o número ou ano, o vínculo será
   incorreto. **Mitigação:** o Controle de Tapetes deve derivar o
   `pedido_manual` a partir dos dados canônicos (numero + criado_em) e filtrar
   eventos apenas para esse padrão. Não deve aceitar `pedido_manual` arbitrário.

5. **Tabela de mapeamento:** Não necessária inicialmente. Normalização simples
   `PED-{numero}-{ano}` basta. Se houver conflitos (pedidos com mesmo número em
   anos diferentes), o ano desambigua.

### C) Como consumir dados?

| Opção | Custo | Risco | Arquivos prováveis | Schema necessário? | Fase |
|-------|-------|-------|-------------------|-------------------|------|
| **1. Import manual de pacote gerado por `export:package`** | Muito baixo — JSONL já existe | Mínimo — arquivo local, sem rede | `js/documents-ingestor.js` (parser), fixture `.jsonl` | Não | **G11-B** |
| 2. Leitura de JSONL local em pasta configurável | Baixo | Baixo — path configurável | `js/documents-ingestor.js`, `config.js` | Não | G11-B+ |
| 3. Watcher futuro do outbox | Médio | Médio — polling | Watcher dedicado | Não | Deferido |
| 4. Pull por comando externo | Médio | Baixo | `exec` ou wrapper | Não | Deferido |
| 5. Supabase/Postgres como índice | **Alto** | **Alto** — acoplamento direto | schema SQL, migrations | Sim | **Rejeitado** |

**Recomendação G11-B:** Opção 1. O Controle de Tapetes carrega um JSONL de
eventos gerado por `export:package --pedido <PED-XX-YYYY>`. Nenhum acoplamento
de rede, nenhum watcher, nenhum schema novo.

### D) Estado local no Controle de Tapetes

1. **O app precisa persistir eventos importados?** Não estritamente. Pode ler
   o pacote em memória a cada carregamento da tela.

2. **Pode ler pacote em memória?** Sim — o pacote é pequeno (dezenas de KB),
   carregar via `fetch` local em cada render do detalhe do Pedido.

3. **Precisa cache local?** Opcional — `sessionStorage` ou variável global
   `window.RAVATEX_DOCUMENTS_CACHE` evitam re-leitura no mesmo carregamento.

4. **Se persistir, onde?** `localStorage` ou arquivo JSON em `.ravatex-local/`.
   Não usar Supabase.

5. **Como garantir idempotência por `ingestion_event_id`?** Ao processar
   eventos, usar `Map<ingestion_event_id, event>`. Ignorar duplicatas.
   Ordenar por `created_at` ascendente.

6. **Como consolidar estado por `document_id`?** Para cada `document_id`,
   manter o evento mais recente (maior `created_at`). O `status` do evento mais
   recente é o estado atual do documento.

### E) UI mínima

Definição da UI mínima para G11-B:

```
┌────────────────────────────────────────┐
│ Documentos                             │
│                                        │
│ DOCUMENTOS DO PEDIDO (INGESTOR)        │
│                                        │
│ 📄 NF 25/2026 - entrada.xml · XML·Entrada │ [Aceito] │ [Ver]
│ 📄 NF 25/2026 - saida.pdf   · PDF·Saída  │ [Pendente] │ [Ver]
│ 📄 Romaneio - romaneio.pdf   · PDF       │ [Rejeitado - duplicado] │ [Ver]
│                                        │
│ EVENTOS                                │
│  ● 07/07 12:20 - Documento aceito      │
│  │                                     │
│  ● 07/07 12:10 - Documento vinculado   │
│  │                                     │
│  ● 07/07 12:00 - Documento detectado   │
│                                        │
│ DOCUMENTOS DO PEDIDO (legado)          │
│ ... (placeholders existentes)          │
└────────────────────────────────────────┘
```

- **Badges:** tipo (NF/romaneio), formato (XML/PDF), direção (Entrada/Saída),
  status (Aceito/Pendente/Rejeitado)
- **Botão "Ver":** abre `drive_web_view_link` em `window.open()` nova aba
- **Reason:** exibir ao lado de badges quando `rejected`
- **Timeline:** dots + linhas verticais, padrão já usado no app

### F) Segurança/privacidade

1. Não exibir `document_id`, `ingestion_event_id` ou `sha256` completos na UI
2. Não armazenar PDF/XML no Supabase ou backend
3. Não baixar arquivo — usar `drive_web_view_link`
4. Não abrir iframe — `window.open()` em nova aba
5. Documentar no contrato: permissão do Google Drive é pré-requisito
   operacional (usuários precisam acesso à pasta compartilhada)

### G) Próximo patch G11-B

**Menor patch seguro no Controle de Tapetes:**

1. Criar `js/documents-ingestor.js` com:
   - `parseDocumentEvents(jsonlText)` — parser do JSONL
   - `filterEventsByPedido(events, pedidoNumero, ano)` — filtra por `pedido_manual`
   - `consolidateDocumentState(events)` — Map<document_id, último evento>
   - `buildIngestorDocumentRows(docs)` — prepara dados para o render
   - Namespace: `window.RAVATEX_DOCUMENTS`

2. Criar fixture `data/fixtures/document-events-sample.jsonl` (cópia do
   sample do Ingestor)

3. Modificar `pedido-detail-progress.js`:
   - `computeViewModel()` passa a chamar `window.RAVATEX_DOCUMENTS`
     para obter `ingestorDocumentRows` quando disponível

4. Modificar `pedido-detail-render.js`:
   - `buildDocuments()` passa a incluir seção "Documentos Recebidos"
     com dados do Ingestor, mantendo placeholders legados

5. Testes:
   - `tests/documents-ingestor.test.js` — parser, filtro, consolidação
   - `tests/pedido-detail.smoke.js` — atualizar snapshot se necessário
   (155 testes atuais)

**Não fazer em G11-B:**
- Não criar watcher
- Não tocar Supabase
- Não alterar schema
- Não modificar Documents Ingestor
- Não implementar accept/reject no Controle de Tapetes (aceitar/rejeitar
  continua no Ingestor)

---

## 4. Matriz de decisão

| Tema | Evidência no código | Decisão | Risco | Patch mínimo | Testes necessários | Fase |
|------|--------------------|---------|-------|-------------|-------------------|------|
| Local de UI | `pedido-detail-render.js:994` card `buildDocuments()` existe | Card "Documentos" existente recebe nova seção "Documentos Recebidos" | Muito baixo | Render: adicionar seção no card | Smoke pedido-detail | G11-B |
| Mapeamento Pedido | `pedido.numero` int + `criado_em` ano | `PED-{numeroPad2}-{ano}` | Baixo — operador pode digitar errado no Ingestor | Helper de formatação + filtro | Teste unitário do mapper | G11-B |
| Consumo de dados | Export package funcional (`export:package --pedido`) | Import manual de JSONL local (Opção 1) | Mínimo — arquivo local sem rede | Parser JSONL + loader | Teste unitário parser + filtro + consolidação | G11-B |
| Estado local | App usa `window` global + Supabase direto | Cache em `window.RAVATEX_DOCUMENTS_CACHE` | Baixo | Variável global + sessionStorage opcional | Teste de idempotência | G11-B |
| Idempotência | Contrato §6: `ingestion_event_id` canônico | Map por `ingestion_event_id`, ordenar por `created_at` | Nenhum | Lógica no consolidator | Teste unitário com eventos duplicados | G11-B |
| Visualização | Contrato §2.3: `drive_web_view_link` | Botão "Ver" → `window.open(link, '_blank')` | Nenhum — link Drive | Botão no render | Teste de link (sem abrir) | G11-B |
| Timeline eventos | `pedido-detail-events.js:2171` `buildHistoryBlock()` | Seção "Eventos" com dots + linhas | Muito baixo | Bloco de timeline reutilizando padrão existente | Smoke visual | G11-B deferido |
| Supabase como índice | Contrato §9: sem Supabase | **Rejeitado** | Alto — acoplamento direto | Não fazer | N/A | — |
| Watcher contínuo | G10 design: watch deferido | Deferido para G11-C | Médio — nova infra | Não fazer | N/A | G11-C |
| Accept/reject no app | Funil operacional no Ingestor | Deferido — continua no Ingestor CLI | Médio — duplicação de estado | Não fazer | N/A | Futuro |
| Alterar Documents Ingestor | HEAD 956682d fechado | Não alterar | Nenhum — contrato fechado | Não fazer | N/A | — |

---

## 5. Ordem pronta para G11-B (próximo IAExecutor)

```
FASE: RAVATEX-TAPETES-G11-B-DOCUMENTS-CONSUMER-PATCH
Agente: DeepSeek Pro (3+ arquivos funcionais)
HEAD base Controle de Tapetes: 381506c (work/app-next)
HEAD base Documents Ingestor: 956682d (master, não alterar)

Escopo:
1. js/documents-ingestor.js (novo)
   - parseDocumentEvents(jsonlText)
   - filterEventsByPedido(events, pedidoNumero, ano)
   - consolidateDocumentState(events)
   - buildIngestorDocumentRows(docs)
   - Namespace: window.RAVATEX_DOCUMENTS

2. data/fixtures/document-events-sample.jsonl (novo)
   - Cópia do sample do Ingestor + adaptação para pedido real

3. js/screens/pedido-detail-progress.js (modificar)
   - computeViewModel() adiciona ingestorDocumentRows ao view

4. js/screens/pedido-detail-render.js (modificar)
   - buildDocuments() inclui seção "Documentos Recebidos" com:
     * Badges: tipo (NF/Romaneio) + formato (XML/PDF) + direção (Entrada/Saída)
     * Status: Aceito (verde) / Pendente (âmbar) / Rejeitado (vermelho + reason)
     * Botão "Ver" → window.open(drive_web_view_link, '_blank')
     * Timeline de eventos abaixo dos documentos

5. tests/documents-ingestor.test.js (novo)
   - parseDocumentEvents com JSONL válido, vazio, malformado
   - filterEventsByPedido com match e não-match
   - consolidateDocumentState com eventos duplicados e fora de ordem

6. tests/pedido-detail.smoke.js (atualizar)
   - Verificar que 155+ testes continuam passando

Não fazer:
- Não tocar Supabase
- Não alterar Documents Ingestor
- Não criar watcher
- Não implementar accept/reject no app
- Não criar schema novo
- Não executar migrations
- Não chamar Google/Drive real (links mockados na fixture)
- Não fazer push para origin

Testes obrigatórios antes do commit:
node --test tests/documents-ingestor.test.js
node --test tests/pedido-detail.smoke.js
node --check js/documents-ingestor.js
```

---

## 6. Riscos

| Risco | Severidade | Mitigação |
|-------|-----------|-----------|
| Operador digita `pedido_manual` errado no Ingestor | Média | App deriva `PED-{numero}-{ano}` canonicamente; não aceita pedido_manual arbitrário |
| Arquivo JSONL não encontrado | Baixa | Tratar como "Nenhum documento importado" — não quebrar tela |
| Número do pedido > 99 quebra formato `PED-XX` | Baixa | Se ocorrer, expandir padding ou ajustar mapeamento; contratos do Ingestor aceitam `\d{2,}` |
| Dois pedidos com mesmo número em anos diferentes | Muito baixa | Ano desambigua no `pedido_manual` |
| Cache local dessincronizado | Baixa | Sempre reler o JSONL; cache é apenas intra-sessão |

---

## 7. Confirmações

- [x] Nenhum Supabase foi tocado
- [x] Nenhuma chamada Google/Drive foi feita
- [x] Nenhum export real foi executado
- [x] Controle de Tapetes não recebeu patch funcional
- [x] Documents Ingestor não foi alterado
- [x] Nenhum dado real foi commitado
- [x] Leitura 100% read-only em ambos os projetos
- [x] Design documenta consumo por `ingestion_event_id`
- [x] Visualização usa `drive_web_view_link`
- [x] Nenhum PDF/XML armazenado no Supabase/backend

---

> **Este documento é a saída formal de G11-A.**
> Deve ser consultado antes de G11-B e atualizado ao final de cada fase.
