# Plano Persistente — Pedido ↔ OP ↔ Movimentação ↔ Documentos

> **Fase:** `RAVATEX-TAPETES-PEDIDO-OP-MOVEMENT-PLAN-A` (docs-only)
> **Tipo:** Docs/architecture/state, sem patch funcional.
> **HEAD base:** `3e8e78f` — `work/app-next`
> **Data:** 2026-07-01

---

## Atualizacao 2026-07-06 - OP Create Requires Pedido Guard B

Fase `RAVATEX-TAPETES-OP-CREATE-REQUIRES-PEDIDO-GUARD-B` atualiza a frente
Pedido -> OP sem alterar schema: criar OP nova agora exige Pedido vinculado na
UI e na persistencia JS.

Decisoes novas:

| # | Decisao | Fundamentacao |
|---|---|---|
| D-GUARD01 | OP avulsa deixa de ser caminho de produto pela UI Admin. | A cadeia produtiva e o display operacional dependem de Pedido confiavel. |
| D-GUARD02 | `persistirOP` deve recusar `pedidoId` ausente antes de consumir numeracao ou escrever em `ops`/`lotes`. | Evita criar novos orfaos e evita consumo indevido de `op_numeros`. |
| D-GUARD03 | Dados historicos sem Pedido sao tratados como legado/alerta, nao corrigidos nesta fase. | Nao houve autorizacao para write SQL/backfill. |
| D-GUARD04 | Guard backend em RPCs de Latex/split fica como proxima fase P1. | Frontend nao substitui bloqueio transacional. |

Evidencia staging read-only: `scripts/staging/ops-without-pedido-diag.mjs`
retornou ALERTA com 11 OPs cujo lote nao possui Pedido e 9 lotes sem Pedido
vinculados a OPs; nenhum dado real foi alterado.

Proximo passo recomendado desta frente: `OP-LATEX-RPC-REQUIRES-PEDIDO-GUARD-C`
para bloquear em backend a geracao de OP filha quando a origem nao tiver
`lotes.pedido_id`.

## Atualizacao 2026-07-06 - OP Create Requires Pedido RPC Guard C

Fase `RAVATEX-TAPETES-OP-CREATE-REQUIRES-PEDIDO-RPC-GUARD-C` prepara a guarda
backend para impedir que movimentacao Tecelagem -> Acabamento/Latex propague OP
orfa.

Decisoes novas:

| # | Decisao | Fundamentacao |
|---|---|---|
| D-GUARD05 | RPCs de Latex/split devem bloquear OP origem sem `lotes.pedido_id`. | O backend precisa proteger caminhos transacionais que nao passam pelo bloqueio visual. |
| D-GUARD06 | A guarda roda antes de reservar numero em `op_numeros`. | Origem invalida nao deve consumir numeracao operacional. |
| D-GUARD07 | Dados historicos orfaos seguem apenas diagnosticados. | Relacao com Pedido pode exigir decisao de produto; sem backfill nesta fase. |
| D-GUARD08 | Constraint global fica fase posterior. | Primeiro e necessario triar as 11 OPs historicas e validar impacto. |

Artefatos: `db/33_op_latex_requires_pedido_guard.sql` e diagnostico ampliado
`scripts/staging/ops-without-pedido-diag.mjs`. Classificacao staging das 11 OPs
orfas: A=6 (`op_id` 1,2,3,4,9,15), B=4 (`op_id` 5,6,7,8), C=0, D=1 (`op_id`
10). Aplicacao em staging pendente; producao intocada.

## 1. Estado de entrada

| Item | Valor |
|---|---|
| **Branch** | `work/app-next` |
| **HEAD base** | `3e8e78f` |
| **Fase anterior fechada** | `RAVATEX-TAPETES-ADMIN-NOVO-PEDIDO-MATCH-CLIENTE-NOVA-VIEW-A-R1` |
| **Commit anterior** | `3e8e78f` — "Record admin novo pedido visual alignment" |
| **Residual conhecido** | `M js/screens/pedidos-list.js` — dirty diff preexistente da lista Admin `#/pedidos`, fora do escopo |
| **Residual permitido** | `?? supabase/.temp/` — residual permitido, origem externa |

A fase **Admin → Novo Pedido** foi fechada e aprovada: o miolo visual de `#/pedidos/novo` está alinhado à base homologada de Cliente → Novo Pedido, sem transformar o fluxo em fluxo exclusivo do cliente. Comportamento admin preservado: seleção de cliente, status inicial `rascunho`, payload real `pedidos` + `pedido_itens`, validações, compensação, toast e navegação.

Antes de mexer em schema, RPC, telas, OPs, pedidos, movimentação, documentos ou integrações externas, este plano registra a arquitetura de destino e as decisões que guiarão toda a evolução desta frente.

---

## 2. Decisões arquiteturais já tomadas

Estas decisões foram consolidadas durante a análise do modelo de negócio e homologadas para esta frente. Qualquer implementação futura deve respeitá-las. Se houver necessidade de revisão, o plano deve ser atualizado antes.

### 2.1. Hierarquia de domínio

1. **Pedido é origem comercial.** O cliente solicita; o admin recebe, confirma e converte em produção.
2. **OP é execução produtiva.** Cada OP representa uma etapa de fabricação (tecelagem, látex/acabamento).
3. **Movimentação produtiva pertence à OP.** Lançamentos de produção (entradas, saídas, entregas parciais) são feitos dentro da tela de OP.
4. **Pedido consolida a produção** e pode ter preview/atalhos para visualização rápida.
5. **Cliente vê evolução simplificada** — nunca dados operacionais internos (OP, lote, fornecedor, NF, romaneio, custo, margem).

### 2.2. Estrutura de OPs

6. **OPs podem existir por etapa.** Exemplos: OP de tecelagem, OP de látex/acabamento.
7. **OPs por etapa devem ser encadeadas.** A conclusão de uma etapa alimenta a próxima.
8. **A cadeia de OPs deve ser atrelada ao Pedido.** Todo lote vinculado ao pedido (`lotes.pedido_id`) permite rastrear OPs → pedido.
9. **O Pedido deve visualizar suas OPs vinculadas.** A tela de detalhe do Pedido Admin deve listar as OPs associadas.

### 2.3. Stepper / preview produtivo

10. **Pedido pode ter stepper/preview** com etapas: `INSUMOS > TECELAGEM > ACABAMENTO > EXPEDIÇÃO > ENTREGA`.
11. **Botões de atalho no Pedido devem chamar a mesma operação canônica da OP.** Ex.: "Lançar produção" no Pedido invoca a mesma função/RPC de movimentação da tela de OP.
12. **Não pode haver dupla digitação.** Lançar na OP e relançar manualmente no Pedido é proibido. A fonte de verdade da movimentação produtiva é a OP.

### 2.4. Parciais

13. **`pedido_parciais` é camada comercial/cliente**, não fonte produtiva.
14. Parciais servem para informar o cliente sobre o avanço (ex.: "Tecelagem: 300m de 500m concluídos"). Não substituem nem duplicam a movimentação real da OP.

### 2.5. Documentos

15. **Documentos fiscais/romaneios devem ser vinculáveis** a movimentos, OPs e ao Pedido.
16. **Arquivos pesados devem ficar fora do banco**, preferencialmente Google Drive ou OneDrive.
17. **Banco deve guardar metadados e ponteiros externos** (URL, nome, tipo, tamanho, hash, data de upload).
18. **Anexo documental começa como pendência não bloqueante.** A movimentação produtiva não deve ser travada pela ausência de documento.
19. **Futuramente, e-mails recebidos em `eddiravazio@gmail.com`** poderão alimentar automação de leitura/classificação de PDF/XML/romaneio, com revisão humana inicial.

---

## 3. Modelo alvo

```
Pedido
  ├── pedido_itens           (itens solicitados pelo cliente)
  ├── lote/pedido_id         (lotes vinculados ao pedido)
  ├── ops                    (OPs vinculadas via lote)
  │     └── op_itens/pedido_item_id    (rastreabilidade item↔OP)
  ├── entregas/movimentos    (movimentações produtivas das OPs)
  ├── documentos_operacionais (metadados de arquivos fiscais/romaneios)
  ├── resumo do pedido       (visão consolidada admin)
  └── evolução cliente       (visão simplificada, read-only)
```

### 3.1. Vínculos chave a estabelecer

| Vínculo | Origem | Destino | Status atual |
|---|---|---|---|
| Lote → Pedido | `lotes.pedido_id` | `pedidos.id` | Coluna existe (nullable), preenchimento pendente |
| OP Item → Pedido Item | `op_itens.pedido_item_id` | `pedido_itens.id` | A avaliar/criar se necessário |
| Documento → Movimento | `documentos_operacionais.movimento_id` | tabela de movimentos | A criar |
| Documento → OP | `documentos_operacionais.op_id` | `ops.id` | A criar |
| Documento → Pedido | `documentos_operacionais.pedido_id` | `pedidos.id` | A criar |

---

## 4. Papel das telas

### 4.1. Tela de OP
- **Bancada operacional** de movimentação produtiva.
- Aqui se lança produção real: entradas, saídas, entregas parciais.
- É a **fonte de verdade** da movimentação. Nenhuma outra tela duplica essa função.

### 4.2. Tela de Pedido Admin
- **Visão consolidada** do pedido.
- Lista OPs vinculadas com status e progresso.
- **Preview/stepper** com atalhos para operações canônicas (que delegam à OP).
- **Documentos consolidados:** índice central de todos os documentos vinculados ao pedido, suas OPs e movimentos.

### 4.3. Tela Cliente
- **Evolução simplificada** (stepper, parciais, timeline).
- **Nunca** vê OP, lote, fornecedor, NF, romaneio, custo ou margem.
- O detalhe do pedido Cliente deve consumir um read model publico
  (`cliente_pedido_summary`) e nao consultar diretamente tabelas
  operacionais internas. A RPC pode consolidar a cadeia no backend, mas
  seu payload deve publicar apenas dados simplificados e seguros.
- Documentos visíveis apenas se o admin publicar (ex.: romaneio de entrega).

### 4.4. Documentos

| Contexto | Regra |
|---|---|
| Documentos comerciais gerais (ex.: pedido de compra, contrato) | Podem ser anexados diretamente ao **Pedido**. |
| Documentos operacionais (ex.: NF de remessa, romaneio de entrega) | Devem preferencialmente ser vinculados ao **movimento/OP** e aparecer consolidados no **Pedido**. |
| O Pedido é o **índice central** de documentos. | A tela de Pedido Admin deve exibir todos os documentos, independentemente do nível de vínculo. |

---

## 5. Fases futuras sugeridas

> Ordem recomendada. Cada fase é atômica e rastreável.

| Fase | Descrição | Dependência |
|---|---|---|
| **B** | Contrato arquitetura/schema detalhado: validar colunas existentes, desenhar novas (`documentos_operacionais`, FK `op_itens.pedido_item_id`), validar índices e constraints. | Plano A (este doc) | **[x] Concluída** (`docs/architecture/PEDIDO_OP_SCHEMA_CONTRACT.md`) |
| **C** | Vínculo Pedido → OP: preencher `lotes.pedido_id` na criação/edição de lote; migration `op_itens.pedido_item_id`. | B | **[x] Concluída** (`bbc57b2`; migration `db/20_*` aplicada em staging `ucrjtfswnfdlxwtmxnoo`) |
| **D** | OPs vinculadas no detalhe do Pedido Admin: listar OPs do pedido com status, progresso e link para a tela de OP. | C |
| **E** | Stepper/preview produtivo no Pedido Admin: visão gráfica das etapas com progresso real derivado das OPs. | D |
| **F** | Operação canônica de movimentação: módulo/função reaproveitada pela tela de OP e pelos atalhos do Pedido. | D |
| **G** | Pendência documental por movimento: tabela `documentos_operacionais`, upload de metadados, vínculo com movimento/OP/Pedido. Sem upload de arquivo ainda. | B |
| **H** | Integração Drive/OneDrive: upload real de arquivos, storage externo, ponteiros no banco. | G |
| **I** | Automação futura por e-mail/PDF/XML: leitura de `eddiravazio@gmail.com`, classificação, anexo automático com revisão humana. | H |
| **J** | Saldo inteligente por etapa e bloqueio transacional: evitar que uma etapa consuma mais do que a anterior produziu. | F |
| **L** | Lifecycle de OP backend: status expandido (`pausada`/`concluida`/`cancelada`), tabela `op_eventos`, trigger de eventos, RPC `alterar_status_op` (admin-only, R1). Migration `db/21_op_lifecycle_status_eventos.sql` aplicada em staging `ucrjtfswnfdlxwtmxnoo`. | — | **[x] Concluída** (backend aplicado em staging; proximo: UI de lifecycle OP) |

---

## 6. Obrigação permanente

> **REGRA VINCULANTE PARA TODA EVOLUÇÃO DESTA FRENTE.**

Sempre que houver evolução, decisão, bloqueio, conclusão parcial ou fechamento de etapa na frente **Pedido ↔ OP ↔ Movimentação ↔ Documentos**, o executor (humano ou IA) deve:

1. **Consultar este plano** antes de iniciar qualquer ação.
2. **Atualizar este plano** ao final da etapa, registrando:
   - Decisões novas tomadas.
   - Fases concluídas (marcar `[x]`).
   - Pendências identificadas.
   - Riscos novos ou mitigados.
   - Próximo passo recomendado.
3. **Atualizar `PROJECT_STATE.md`** com o registro da fase concluída.
4. **Atualizar `AGENT_HANDOFF.md`** com o resumo para a próxima sessão.
5. **Expor no handoff** que o próximo chat deve consultar este plano antes de qualquer ação.
6. **Nunca** implementar sem antes consultar este plano.
7. **Nunca** fechar uma etapa sem atualizar este plano.

### 6.1. Decisões da Fase L — Lifecycle de OP (backend)

| # | Decisão | Fundamentação |
|---|---|---|
| D-L01 | `ops.status` expandido para aceitar `pausada`, `concluida`, `cancelada`. `finalizada` mantido como legado. | Não quebrar OP de látex existente; `concluida` é o novo canônico. |
| D-L02 | Tabela `op_eventos` criada para histórico de eventos da OP. | Necessário para auditoria e timeline futura da OP. |
| D-L03 | Trigger `trg_op_evento` registra automaticamente toda mudança de status. | Fonte única de verdade; evita duplicação com RPC. |
| D-L04 | RPC `alterar_status_op` valida transições e aplica mudança. | Transições inválidas são rejeitadas no backend. |
| D-L05 | `concluida` preenche `finalizada_em` se null. `cancelada` não preenche. | Semântica correta de conclusão vs cancelamento. |
| D-L06 | `gerar_op_latex` não alterado nesta fase. OP de látex continua nascendo `em_producao`. | Preserva compatibilidade; transição para concluida virá depois via RPC. |
| D-L07 | RLS de `op_eventos` segue padrão `ops`: admin ALL, fornecedor SELECT vinculado. | Consistência com o restante do projeto. |
| D-L08-R1 | `alterar_status_op` é **admin-only** nesta fase (`is_admin()`). Fornecedor não tem WRITE em `ops` e não pode transitar status. | Hardening R1: guard de caller explícito, no padrão de `gerar_op_latex` (db/08/09). Não prometer permissão de fornecedor. |
| D-L09-R1 | `p_observacao` da RPC é vinculada ao evento `status_alterado` correspondente a `status_novo` (filtro `status_novo = p_novo_status` + ordenação `criado_em DESC, id DESC`). Trigger segue como fonte única do evento (não há segundo `INSERT`). | Hardening R1: reduzir risco de observação cair em evento errado sob concorrência. `SET LOCAL/current_setting` fica para fase futura. |

### 6.2. Decisões da Fase Cliente Order Summary Readmodel

| # | Decisão | Fundamentação |
|---|---|---|
| D-COS01 | O Portal Cliente deve ler o detalhe do pedido por `public.cliente_pedido_summary(UUID)`, nao por joins diretos em tabelas operacionais no frontend. | Mantem a fronteira Cliente/Admin e reduz acoplamento com OP, lote, fornecedor e documentos internos. |
| D-COS02 | A RPC e `SECURITY DEFINER`, `STABLE`, `search_path = public`, com acesso para admin ou cliente dono e grant apenas para `authenticated`. | Permite consolidacao server-side sem abrir tabelas internas ao cliente ou a `anon`. |
| D-COS03 | O payload publico nao inclui chaves internas como OP, lote, fornecedor, NF, romaneio, custo, margem, split ou IDs de catalogo. | Cumpre a regra de evolucao simplificada da tela Cliente. |
| D-COS04 | `pedido_parciais` e `pedido_cliente_eventos` entram no resumo apenas quando `visivel_cliente IS TRUE`. | Preserva o papel comercial/cliente das parciais e evita publicar eventos administrativos. |
| D-COS05 | Dashboard Cliente permaneceu fora da alteracao porque ja lia dados publicos; Admin/Pedido Detail tambem ficou fora do escopo. | Limita o blast radius da fase ao P1 de leitura interna no detalhe Cliente. |

---

## 7. Riscos

| Risco | Severidade | Mitigação |
|---|---|---|
| Duplicar movimentação em Pedido e OP | **Alta** | Operação canônica única (Fase F); Pedido apenas consome/atalha. |
| Tratar `pedido_parciais` como fonte produtiva | **Alta** | Parciais = camada comercial; fonte produtiva = OP. |
| Anexar documentos sem classificação | **Média** | Tabela `documentos_operacionais` com tipo, origem e vínculo obrigatórios. |
| Armazenar arquivos pesados no banco | **Alta** | Metadados no banco; arquivos no Drive/OneDrive (Fase H). |
| Criar integração Drive/Gmail/OneDrive antes do contrato | **Média** | Fase H só após contrato de schema (Fase B) e pendência documental (Fase G). |
| Popular Pedido→OP errado (lote sem pedido_id) | **Alta** | Validar `lotes.pedido_id` na criação/edição de lote e OP. |
| Criar bloqueio de saldo só no frontend | **Alta** | Bloqueio transacional deve ser no backend (RPC/trigger). |
| Implementar RPC sem etapas canônicas | **Média** | Toda RPC de movimentação deve ser única e reutilizável. |
| Ignorar dirty diff existente em `js/screens/pedidos-list.js` | **Baixa** | Residual conhecido; não incluir em commits desta frente. |

---

## 8. Evidência obrigatória por fase

Toda fase desta frente deve registrar ao fechar:

- Branch utilizada.
- HEAD inicial e final.
- `git status --short` inicial e final.
- `git diff --stat` (se houver alterações).
- Arquivos lidos.
- Arquivos alterados/criados.
- Decisões registradas.
- Este plano atualizado.
- `PROJECT_STATE.md` atualizado.
- `AGENT_HANDOFF.md` atualizado.
- Próximos passos recomendados.

---

## 9. Próximo passo

**`CLIENTE-ORDER-SUMMARY-READMODEL-APPLY-STAGING-A`**.

Aplicar `db/30_cliente_pedido_summary_readmodel.sql` em staging
(`ucrjtfswnfdlxwtmxnoo`) e validar o Portal Cliente real lendo o detalhe
do pedido por `cliente_pedido_summary`, sem reabrir leituras diretas de
OP/lote/fornecedor/documentos internos no frontend. Producao so deve ser
discutida em fase separada, com autorizacao explicita.

---

> **Este plano é fonte canônica para a frente Pedido ↔ OP ↔ Movimentação ↔ Documentos.**
> Deve ser consultado antes de qualquer ação e atualizado ao final de cada etapa.
> Indexado em `docs/DOCUMENTATION_INDEX.md` §1.
## Atualizacao 2026-07-06 - Pedido/OP Controlled Delete B

Fase `RAVATEX-TAPETES-PEDIDO-OP-CONTROLLED-DELETE-B` cria uma porta
controlada de limpeza para dados de teste sem alterar o contrato produtivo:

| # | Decisao | Fundamentacao |
|---|---|---|
| D-DEL01 | Exclusao de Pedido/OP fica centralizada em RPC transacional. | Evita deletes diretos espalhados na UI e respeita FKs/triggers. |
| D-DEL02 | A UI sempre chama diagnostico e mostra impacto antes de remover. | O usuario ve OPs, lotes, entregas e expedicoes afetadas antes da acao final. |
| D-DEL03 | Entrega/expedicao bloqueiam exclusao. | Dados produtivos e documentos operacionais nao podem ser apagados nesta fase. |
| D-DEL04 | Pedido com OP sem movimento exige `EXCLUIR` e remove OPs/lotes vinculados. | Limpeza de teste nao deve deixar lote orfao nem OP vinculada a Pedido apagado. |
| D-DEL05 | OP mae com filha bloqueia na exclusao individual. | Evita deixar OP de Acabamento orfa; o usuario deve excluir a filha primeiro. |
| D-DEL06 | `op_numeros` nao e alterado. | Numeracao e historico operacional seguem monotonicamente preservados. |
| D-DEL07 | Em staging/teste, OP numerada sem bloqueadores reais pode ser removida pela RPC controlada. | A `db/34` remove/bypassa o trigger legado `ops_numeradas_no_delete`; o numero nao e reciclado porque `op_numeros` permanece high-water. |
| D-DEL08 | Em staging/teste, cadeia com entrega/OP filha sem expedicao exige `EXCLUIR TUDO` e pode ser removida em cascata transacional. | A `db/35` diferencia `requires_cascade_confirmation` de `blocked`; expedicao segue bloqueador e producao futura exige auditoria/soft-delete. |

Botao/fluxo adicionado nas telas principais de Pedido e OP por
`window.RAVATEX_DELETE`. O antigo `excluirOpLatex` direto foi substituido pelo
helper central. Senha admin, soft-delete e auditoria permanente ficam para a
fase futura de producao.
