# Documentation Index — Ravatex Controle de Tapetes

> Índice de documentação. Toda nova sessão de IA ou pessoa deve
> começar pela **lista de autoridade** da §1, que é a única lista
> ativa de autoridade documental do projeto. As **docs legadas**
> foram preservadas como contexto histórico e **não devem guiar
> execução** após o ciclo de refactor/hardening.
>
> **Convenção:** este diretório é docs-only. Nenhuma alteração de
> código, teste ou `index.html` é feita aqui.

## 0. Papel deste índice e contrato de governança documental

A partir de `G28-DOCS-B1` (fase aditiva, sem migração), este
arquivo é formalmente reconhecido como o **árbitro único de
autoridade documental e caminhos canônicos** do projeto. Ele
responde a:

- qual é a **ordem de autoridade** entre documentos;
- qual é a **classificação** de cada documento (canônico,
  operacional, contrato, runbook, legado, diagnóstico,
  governança);
- quais são os **caminhos canônicos**;
- quais documentos são **legados** a reconciliar;
- qual é a **responsabilidade** de cada categoria de documento.

Este índice **não** é fonte de fase atual, próxima ação, HEAD,
working tree, status operacional nem histórico de closeouts.
Esses fatos pertencem a `PROJECT_STATE.md`, ao Git e ao ledger
da frente, conforme o contrato em
[`docs/governance/DOCUMENTATION_MODEL.md`](governance/DOCUMENTATION_MODEL.md).

O **modelo de governança documental** que rege propriedade,
duplicação, atualização por fase, transação documental mínima,
compactação e tratamento de Git/migrations/HEAD é o
`docs/governance/DOCUMENTATION_MODEL.md`. Em conflito entre
qualquer documento do projeto e este modelo, prevalece o modelo,
exceto se a revisão estiver registrada neste índice e no
respectivo ledger.

As listas concorrentes de "fontes canônicas", "precedência
funcional" e "documentos obrigatórios" que existiam em outros
arquivos (§2 deste índice, `docs/architecture/CLAUDE_PROJECT_ASSET_MAP.md`,
`Guide-and-governance-rules.stxt`) foram reconciliadas em
`G28-DOCS-B3-E1`: passaram a apontar para a §1 deste índice como
única lista ativa de autoridade. Nenhuma outra lista concorrente
deve ser criada.

## 1. Autoridade documental canônica (lista única)

Esta é a **única lista ativa de autoridade documental** do
projeto. Qualquer outro documento que descreva autoridade,
prevalência, precedência ou "documentos obrigatórios" deve
apontar para esta seção, não repetir a lista.

| Documento | Papel |
|---|---|
| `docs/DOCUMENTATION_INDEX.md` (este arquivo) | Classifica os documentos e define seus papéis. |
| `docs/governance/DOCUMENTATION_MODEL.md` | Define o modelo de governança e as regras de atualização documental por fase. Conteúdo em inglês desde `DOC-LANGUAGE-MIGRATION-L1`; original pt-BR arquivado em `docs/archive/pt-BR/` (ver §7). |
| `docs/governance/SUPERVISION_PROTOCOL.md` | Define papéis do processo de supervisão (Arquiteto/Parecerista/Executor Residente), onboarding de parecerista novo, formato de ordem e gates (validação visual, mockup aprovado, migration como gate próprio, risco Auth separado). Não define estado nem regras de organização documental — isso é `DOCUMENTATION_MODEL.md`. Conteúdo em inglês desde `DOC-LANGUAGE-MIGRATION-L1`; original pt-BR arquivado em `docs/archive/pt-BR/` (ver §7). |
| `PROJECT_STATE.md` (raiz) | Único proprietário do estado operacional atual por frente. Conteúdo em inglês desde `DOC-LANGUAGE-MIGRATION-L2`; original pt-BR arquivado em `docs/archive/pt-BR/PROJECT_STATE.md` (ver §7). |
| `AGENT_HANDOFF.md` (raiz) | Único handoff operacional ativo. Conteúdo em inglês desde `DOC-LANGUAGE-MIGRATION-L2`; original pt-BR arquivado em `docs/archive/pt-BR/AGENT_HANDOFF.md` (ver §7). |
| `docs/ledgers/G28_LEDGER.md` | Histórico estruturado append-only da frente G28. |
| `docs/refactor/ARCHITECTURE_REFACTOR_LEDGER.md` | Histórico exclusivo da frente de refactor. |
| `docs/legacy/pre-model/MANIFEST.md` | Preservação imutável pré-modelo; não operacional. |
| Git | Commits, diffs, manifestos, branch, HEAD, staging e divergência — consultar diretamente. |

> Estes papéis **não se sobrepõem**. Em divergência entre
> documentos de papéis distintos, resolve o documento cujo papel
> corresponde à questão (estado → `PROJECT_STATE.md`; regra de
> atualização → `DOCUMENTATION_MODEL.md`; autoridade/classificação
> → este índice; commit/diff → Git). A matriz detalhada de
> atualização por fase está em
> [`docs/governance/DOCUMENTATION_MODEL.md`](governance/DOCUMENTATION_MODEL.md) §11.

### Inventário classificatório (documentos por categoria)

Os documentos abaixo têm função classificatória ou contratual
legítima; **não** são uma segunda lista de prevalência. Em
divergência com a §1, resolve-se pelo papel de cada um.

| Documento | Categoria | Propósito |
|---|---|---|
| `docs/architecture/CODE_HEALTH_RULES.md` | Contrato arquitetural | 19 regras vinculantes de saúde arquitetural (18 de modularização + a regra 19, de idioma). Toda nova fase deve respeitar. Conteúdo em inglês desde `DOC-LANGUAGE-MIGRATION-L1`; original pt-BR arquivado em `docs/archive/pt-BR/` (ver §7). |
| `docs/architecture/PORTAL_B2B_ARCHITECTURE_RULES.md` | Contrato arquitetural | Regras da frente Portal B2B/Pedidos: separa cliente/admin/fornecedor, status operacional vs. visual, componentes comuns, decomposição de fases. |
| `docs/architecture/PEDIDO_OP_MOVIMENTACAO_DOCUMENTOS_PLANO.md` | Plano persistente | Plano da frente Pedido ↔ OP ↔ Movimentação ↔ Documentos: estado de entrada, decisões, modelo alvo, papéis das telas, fases futuras (B a J), template de evidência. |
| `docs/architecture/PEDIDO_OP_SCHEMA_CONTRACT.md` | Contrato técnico | Contrato de schema para Pedido ↔ OP ↔ Movimentação ↔ Documentos: valida tabelas, FKs, RPCs, triggers, RLS; estabelece vínculo Pedido→OP, movimentação canônica, stepper, saldo por etapa. |
| `docs/architecture/PEDIDO_PRODUCTION_FLOW_BACKLOG.md` | Backlog | Backlog do fluxo produtivo do Pedido (§1-8) + backlog Admin (§9). 8 itens de produção (A-H) + 10 itens Admin (P1/P2). Leitura obrigatória antes de implementação no fluxo produtivo. |
| `docs/architecture/AUTH_DELETE_USER_DESIGN.md` | Design | Semântica de exclusão/desativação de usuários: desativar (soft delete + ban Auth) em vez de deletar fisicamente. |
| `docs/architecture/CAMADA2_USUARIOS_SPEC_PROPOSED.md` | Spec proposta (design) | Spec da Camada 2 (administração de usuários, A1-A7 + política de senha): comparação evidenciada Tapetes × SGAA_clean_baseline (referência funcional/visual externa, read-only), plano de módulos, classificação de risco Auth e ordem de subfases com gates. **Status: `PROPOSED`. Autoridade condicionada a aceite explícito do arquiteto por subfase** — não é fonte de implementação autorizada até que cada subfase individual seja aprovada. |
| `docs/design/CAMADA2_A32_MOCKUP_APPROVED.md` | Design (aprovado) | Especificação visual aprovada de `A3.2` (cards-resumo/KPI, toolbar, badge de papel, opacidade de linha inativa): valores finais de cor/espaçamento/tipografia, implementados em `js/screens/admin-usuarios.js`. Documenta explicitamente o que ficou fora de escopo (coluna "Último acesso", bloqueada por HARD STOP de migration; ícones de A5; bulk actions de A3.3). **Status: `CLOSED / ACCEPTED`** (validação visual do arquiteto confirmada 2026-07-15). |
| `docs/architecture/CLAUDE_PROJECT_ASSET_MAP.md` | Inventário de ativos | Mapa de componentes, entrypoints, contratos e estrutura de `.claude`. **Não é fonte de estado atual nem árbitro de autoridade.** |
| `Guide-and-governance-rules.stxt` (raiz) | Governança de agente | Regras operacionais estáveis para o agente Arquiteto/IAexec (Git, escopo, decomposição, roteamento). **Não repete esta lista de autoridade.** |

### Runbooks operacionais (complementam, não substituem)

Runbooks descrevem **como executar** procedimentos aprovados. Não
substituem a autoridade da §1; em divergência, a §1 prevalece.

| Documento | Propósito |
|---|---|
| `docs/operations/AUTH_USER_PROVISIONING_RUNBOOK.md` | Procedimento operacional padrão para criação de usuários (admin/fornecedor) via Edge Function `admin-create-user` + UI `#/cadastros/usuarios`. Substitui o fluxo manual de criar Auth user no Studio e copiar UID. |
| `docs/operations/AUTH_DISABLE_USER_PROD_RELEASE_PLAN.md` | Plano operacional de release para levar a cadeia Auth do staging para produção. Ordem obrigatória, critérios GO/NO-GO, rollback, validações read-only. |
| `docs/operations/PARALLEL_ENVIRONMENT_RECONCILIATION.md` | Taxonomia oficial dos ambientes: `bhgifjrfagkzubpyqpew` = Legacy (não tocar), `ucrjtfswnfdlxwtmxnoo` = paralelo de trabalho. Estado de cada ambiente, decisão arquitetural, próximas etapas. |

## 1b. Documentos de diagnóstico de UI (não normativos, não executáveis)

Documentos desta seção **comparam** mockups aprovados contra a
implementação atual, para escopar fases futuras de ajuste visual.
**Não são fonte canônica**, não autorizam implementação por si só e
não substituem a lista de autoridade da §1.

| Documento | Propósito | Fase |
|---|---|---|
| `docs/ui/CLIENTE_PORTAL_UI_GAP_INVENTORY.md` | Inventário read-only de divergências entre os 5 mockups do Portal Cliente B2B (Dashboard, Novo Pedido, Modal Adicionar Item, Detalhe do Pedido, Acompanhamento) e as telas `js/screens/cliente-*.js` atuais. Matriz por tela, gaps detalhados, particularidades operacionais ainda em TBD e proposta de fases futuras (`UI-GAP-FIX-*`, `UI-OPERATIONS-RULES-A`). Não implementa nem corrige nada. | `RAVATEX-TAPETES-CLIENTE-PORTAL-UI-GAP-INVENTORY-A` |
| `docs/ui/CLIENTE_PORTAL_UI_OPERATIONS_RULES.md` | Matriz operacional docs-only para a UI do Portal Cliente B2B. Consolida decisões já fechadas, registra as pendências `OP-001` a `OP-012`, recomendações técnicas, impacto por tela e a sequência futura (`UI-GAP-FIX-NOVO-PEDIDO-A` até `UI-GAP-FIX-SHELL-A`). Não implementa UI nem altera código/schema/Supabase. | `RAVATEX-TAPETES-CLIENTE-PORTAL-UI-OPERATIONS-RULES-A` |

## 1c. Histórico estruturado e preservação por frente

Detalhamento classificatório dos papéis de histórico e preservação
declarados na §1. Não é uma segunda lista de autoridade.

- `docs/ledgers/G28_LEDGER.md` — append-only; não é fonte do estado atual;
  não substitui o Git; não reconstrói automaticamente o histórico pré-modelo.
- `docs/refactor/ARCHITECTURE_REFACTOR_LEDGER.md` — ledger histórico
  exclusivo da frente de refactor; permanece no caminho atual; não deve ser
  copiado para `docs/legacy/`.
- `docs/legacy/pre-model/MANIFEST.md` — índice dos snapshots completos e
  imutáveis anteriores à compactação; snapshots não são fontes de estado
  atual; snapshots não recebem novos closeouts; conteúdo preservado para
  auditoria, não para roteamento operacional.
- `docs/closeouts/PROJECT_STATE_ARCHIVE_2026-07.md` — narrativas de closeout
  de fases movidas de `PROJECT_STATE.md` por `PROJECT-STATE-COMPACTION-A`
  (2026-07-16), verbatim e em ordem original. **Não é fonte do estado atual**
  (esse é `PROJECT_STATE.md`, agora current-state-only); as fases arquivadas
  estão indexadas na tabela "Closed phases" de `PROJECT_STATE.md`. Append-only
  para este lote; as decisões de arquiteto ali registradas permanecem em vigor
  e estão condensadas em `PROJECT_STATE.md` §"Binding decisions in force".

## 1d. Relatórios de diagnóstico e reconciliação, e artefatos de supervisão externa (não normativos)

Documentos desta seção registram diagnósticos read-only ou artefatos de
supervisão externa. Não são fonte canônica de estado, não autorizam
implementação por si só e não substituem a lista de autoridade da §1. As
decisões do arquiteto derivadas destes documentos são registradas em
`PROJECT_STATE.md` e no ledger da frente aplicável, não neles próprios.

| Documento | Propósito | Fase |
|---|---|---|
| `docs/reports/BACKLOG_RECONCILIATION_R1_2026-07-15.md` | Diagnóstico read-only do backlog geral: inventário no código real da Camada 2 (administração de usuários) e Camada 3 (backup), auditoria dos worktrees, evidência factual de validação da seção de Documentos (sem classificar aceite), tabela única de backlog remanescente e divergências entre canônicos/código/closeout do ChatGPT. Não altera estado; decisões derivadas registradas em `PROJECT_STATE.md` (`G28-RECONCILIATION-DECISIONS-A`). | `BACKLOG-RECONCILIATION-READONLY-R1` |
| `docs/handoffs/CHATGPT_CLOSEOUT_2026-07-15.md` | Registro de encerramento da supervisão do ChatGPT: estado segundo seu próprio registro, ordens emitidas não fechadas, decisões discutidas fora dos arquivos canônicos e pendências aguardando decisão do arquiteto. Artefato externo, não canônico; seu relatório `PROJECT-CONTROL-BASELINE-R1` foi avaliado e rejeitado (`REJECTED / NOT RATIFIED`) em `PROJECT_STATE.md` (`G28-RECONCILIATION-DECISIONS-A`). | Handoff externo (ChatGPT), não numerado como fase do projeto |
| `CLAUDE.md` (raiz) | Ponteiro de harness carregado automaticamente por agentes Claude Code. **Autoridade: NENHUMA** — não é fonte de estado, regra ou classificação; aponta para `PROJECT_STATE.md`, `AGENT_HANDOFF.md`, `docs/architecture/CODE_HEALTH_RULES.md`, `docs/governance/DOCUMENTATION_MODEL.md` e este índice. Em conflito com qualquer canônico, o canônico prevalece. Conteúdo em inglês desde `DOC-LANGUAGE-MIGRATION-L1` (inclui resumo-ponteiro da política de idioma, apontando às casas canônicas); original pt-BR arquivado em `docs/archive/pt-BR/CLAUDE.md` (ver §7). | `Add CLAUDE.md agent entrypoint` |
| `.claude/launch.json` | Config de harness para subir o servidor estático local (`python -m http.server 8765`) usada nos gates de validação visual do arquiteto (A3.1 e subfases futuras de Camada 2 que tocam UI: A3.2, A4.2, A6.3). **Autoridade: NENHUMA** — não é fonte de estado, regra ou classificação; não contém credencial, URL ou segredo (inspecionado antes do commit). Mesmo tratamento do `CLAUDE.md`: ponteiro de tooling, não canônico. | `Add local preview launch config` |

## 2. Regra de prevalência

A única lista ativa de autoridade documental está na **§1** deste
índice. A regra de prevalência é: resolve a questão pelo **papel**
do documento (estado → `PROJECT_STATE.md`; regra de atualização →
`docs/governance/DOCUMENTATION_MODEL.md`; classificação/autoridade
→ §1 deste índice; commit/diff/HEAD/staging/divergência → Git).

A matriz detalhada de **qual documento atualizar por tipo de
evento de fase** está em
[`docs/governance/DOCUMENTATION_MODEL.md`](governance/DOCUMENTATION_MODEL.md)
§11 ("Regra de atualização por fase") e §12 ("Transação documental
mínima").

A lista numerada de prevalência que existia nesta seção foi
removida em `G28-DOCS-B3-E1` por ser concorrente da §1. Docs
legadas (`docs/superpowers`, `docs/qa`, docs antigos na raiz de
`docs/`) continuam **não** devendo guiar execução.

## 3. Runbooks operacionais atuais

Pasta `docs/operations/`. Documentam **como executar** procedimentos
aprovados pelas fontes canônicas. Quando houver divergência entre
um runbook e uma fonte canônica, as fontes canônicas prevalecem.

| Arquivo | Procedimento | Fase |

| Arquivo | Procedimento | Fase |
|---|---|---|
| `AUTH_USER_PROVISIONING_RUNBOOK.md` | Criação de usuários (admin/fornecedor) via Edge Function `admin-create-user` + UI `#/cadastros/usuarios`. Substitui o fluxo manual de criar Auth user no Studio e copiar UID. | `RAVATEX-TAPETES-AUTH-PROVISIONING-DOCS-A` |
| `AUTH_DISABLE_USER_PROD_RELEASE_PLAN.md` | Plano de release produção — schema, secrets, Edge Functions, frontend. Ordem obrigatória, rollback, GO/NO-GO. | `RAVATEX-TAPETES-AUTH-DISABLE-USER-PROD-RELEASE-PLAN-A` |
| `PARALLEL_ENVIRONMENT_RECONCILIATION.md` | Taxonomia oficial de ambientes. Legacy vs paralelo, estado de cada, bloqueios. | `RAVATEX-TAPETES-PARALLEL-ENV-RECONCILIATION-A` |

Convenção: estes runbooks são **docs-only** e **operacionais**.
Atualizações devem ser feitas em fases docs-only dedicadas.

## 4. Schema / migrations versionadas (Supabase)

A pasta `db/` contém o schema canônico e as migrations aplicadas
(parcialmente) em staging e produção. As migrations
**schema-only** (sem deletes destrutivos) são criadas em fases
próprias e validadas por smoke tests antes de qualquer aplicação
no Supabase. Quando uma migration ainda **não foi aplicada**,
isso é registrado explicitamente no header do arquivo e em
`PROJECT_STATE.md`.

| Arquivo | Propósito | Fase | Status |
|---|---|---|---|
| `db/01_schema.sql` | Schema base das tabelas do app. | `RAVATEX-TAPETES-FASE-1` | aplicado em staging/produção |
| `db/02_functions.sql` | Funções RLS auxiliares originais (`is_admin`, `meu_fornecedor_id`). | `RAVATEX-TAPETES-FASE-1` | aplicado (substituído em produção por `db/05_fix_pgrst.sql`) |
| `db/03_policies.sql` | Policies RLS de todas as tabelas. | `RAVATEX-TAPETES-FASE-1` | aplicado em staging/produção |
| `db/04_seed.sql` | Seeds de cadastro. | `RAVATEX-TAPETES-FASE-1` | aplicado em staging |
| `db/05_fix_pgrst.sql` | Fix PGRST + recriação de `is_admin`/`meu_fornecedor_id` com `EXCEPTION`. | `RAVATEX-TAPETES-FASE-5A` | aplicado em staging/produção |
| `db/06_fase5a_policies.sql` | Policies adicionais para entregas de fornecedor. | `RAVATEX-TAPETES-FASE-5A` | aplicado em staging/produção |
| `db/07_fase5a_destino_latex.sql` | Colunas de destino de látex em entregas. | `RAVATEX-TAPETES-FASE-5A` | aplicado em staging |
| `db/08_fase5b_latex.sql` | Suporte a OP de látex (tipo, origem, fornecedor de látex). | `RAVATEX-TAPETES-FASE-5B` | aplicado em staging |
| `db/09_fase6_cliente_lote.sql` | Tabelas `clientes` e `lotes`, função `gerar_op_latex`. | `RAVATEX-TAPETES-FASE-6` | aplicado em staging |
| `db/10_reset_producao.sql` | Reset destrutivo de produção (DELETE em massa). | — | **NÃO executar** sem autorização. |
| `db/11_reset_ops.sql` | Reset destrutivo de OPs (DELETE em massa). | — | **NÃO executar** sem autorização. |
| `db/12_auth_user_disable_schema.sql` | Suporte a desativação de usuários: colunas `ativo`, `desativado_em`, `desativado_por`, `motivo_desativacao`; recriação de `is_admin` e `meu_fornecedor_id` para exigir `ativo is true`; recriação de policies `usuarios_select`, `usuarios_admin_all`, `usuarios_self_update`. | `RAVATEX-TAPETES-AUTH-DISABLE-USER-SCHEMA-A` (+ `...-SCHEMA-APPLY-A` + `...-SCHEMA-APPLY-EVIDENCE-A`) | **Aplicado em staging** (`ucrjtfswnfdlxwtmxnoo`) em `2026-06-24`, manualmente por HMNlead no SQL Editor. Validação pós-aplicação: `ativo = true, total = 3`; nenhuma coluna destrutiva rodada; `db/10_reset_producao.sql` e `db/11_reset_ops.sql` não foram executados; produção `bhgifjrfagkzubpyqpew` não foi tocada. Validado por `tests/auth-disable-user-schema.smoke.js` (20/20) **antes** da aplicação. |
| `db/13_pedidos_schema.sql` | Schema/RLS de Pedidos do cliente: tabelas `pedidos`, `pedido_itens`, `pedido_eventos`; coluna `lotes.pedido_id` (nullable); RLS admin-only em todas as 3 tabelas; índices em `cliente_id`, `status`, `token_acesso`, `pedido_id`. **Não** cria `pedidos.op_id`. **Não** cria policy pública. | `RAVATEX-TAPETES-PEDIDOS-SCHEMA-RLS-A` (+ `...-SCHEMA-APPLY-UCR-A` + `...-SCHEMA-APPLY-RECORD-A`) | **Aplicado em ucr** (`ucrjtfswnfdlxwtmxnoo`) em `2026-06-24` via Management API. Validação pós-aplicação: 3 tabelas criadas, RLS habilitada, policies admin-only, índices OK, `pedidos.op_id` ausente, `lotes.pedido_id` presente. Validado por `tests/pedidos-schema.smoke.js` (41/41). Frontend implementado (C1 + C2 + C2-R1 + C3A): listagem `#/pedidos`, formulário `#/pedidos/novo` (criação admin como `rascunho`), correção do preview de cor (C2-R1) e detalhe read-only `#/pedidos/<uuid>` (C3A). Validação de frontend focada: `pedido-detail.smoke.js` 30/30, `pedido-form.smoke.js` 35/35, `pedido-ui.test.js` 18/18, `pedidos-list.smoke.js` 29/29. **Estritamente read-only** no detalhe (sem insert/update/delete/rpc, sem `functions.invoke`, sem `token_acesso`, sem rota pública, sem mutação em `lotes`/`pedido_eventos`). |
| `db/14_cliente_perfil_schema.sql` | Perfil autenticado de cliente: role `cliente` em `usuarios.tipo` (constraint `usuarios_tipo_check`), coluna `usuarios.cliente_id` (FK → `public.clientes`), constraint `usuarios_vinculo_exclusivo_check` (admin/fornecedor/cliente com vínculos exclusivos), função `public.meu_cliente_id()` (SECURITY DEFINER, STABLE; exige `tipo='cliente' AND ativo=true AND cliente_id NOT NULL`; retorna NULL em falhas), policies RLS mínimas para cliente SELECT/INSERT em `clientes`, `pedidos` e `pedido_itens`. **Não** libera UPDATE/DELETE de cliente. **Não** expõe token público. **Não** cria policy anon. `pedido_eventos` permanece admin-only (auditoria interna). | `RAVATEX-TAPETES-PEDIDOS-CLIENTE-SCHEMA-RLS-B1` + `B2` + `B2-RECORD-A` | **Aplicado em staging** (`ucrjtfswnfdlxwtmxnoo`) via Management API em `2026-06-24` (fase B2). Status 201, 33 statements. Validações pós 23/23: `usuarios_tipo_check` com `cliente`, `usuarios.cliente_id` + FK, `usuarios_vinculo_exclusivo_check`, `meu_cliente_id()` (SECURITY DEFINER, grants OK), 5 policies cliente SELECT/INSERT, 0 policies UPDATE/DELETE cliente, 0 policies anon/token, 0 violações de constraint. **Lacuna:** `admin-create-user` e UI aceitam apenas `admin`/`fornecedor`; provisionamento de usuário cliente pendente. |
| `db/15_status_cliente_visual.sql` | Base versionada do tracking visual do cliente B2B: novas colunas visuais em `public.pedidos` (`status_cliente_visual`, `status_cliente_excecao`, `status_cliente_mensagem`, `status_cliente_atualizado_em`, `referencia_cliente`, `prazo_desejado`, `tipo_recebimento`); checks TEXT + CHECK idempotentes; tabela `public.pedido_cliente_eventos`; RLS admin-only nessa nova tabela; trigger guard de INSERT para impedir cliente de publicar estado visual; trigger de touch para `status_cliente_atualizado_em` em updates visuais. | `RAVATEX-TAPETES-PEDIDOS-CLIENTE-TRACKING-SCHEMA-A` + `...-SCHEMA-B` | **Aplicado e validado em staging** (`ucrjtfswnfdlxwtmxnoo`) em `2026-06-26`. Validações estruturais concluídas: 7 colunas novas em `pedidos`, 10 colunas em `pedido_cliente_eventos`, 4 constraints, 2 triggers, 2 funções, 1 índice, `pedido_cliente_eventos = 0`. Frontend cliente já lê `status_cliente_visual` real, mas ainda não expõe `pedido_cliente_eventos`. |
| `db/16_pedido_cliente_eventos_cliente_select.sql` | Policy RLS versionada para liberar somente `SELECT` do cliente em `public.pedido_cliente_eventos`, restrita a linhas com `visivel_cliente = true` e pertencentes a pedidos cujo `cliente_id = public.meu_cliente_id()`. Preserva a policy admin existente e não cria writes, view, RPC ou trigger. | `RAVATEX-TAPETES-PEDIDOS-CLIENTE-TRACKING-EVENTS-RLS-A` | **Versionado no repo, ainda não aplicado** em Supabase. Prepara a fase seguinte de apply em staging e a timeline read-only futura do cliente. |
| `db/30_cliente_pedido_summary_readmodel.sql` | RPC publica `cliente_pedido_summary(UUID)` para o detalhe do pedido no Portal Cliente. Encapsula as tabelas operacionais internas atras de `SECURITY DEFINER`, autoriza admin ou cliente dono, retorna DTO JSONB simplificado (`pedido`, `itens`, `parciais`, `timeline`, `entregas`, `pendencias`, `etapas`, `chain_state`) e nao publica OP/lote/fornecedor/NF/romaneio/custo/margem/IDs de catalogo. | `RAVATEX-TAPETES-CLIENTE-ORDER-SUMMARY-READMODEL-A-B` (+ `...-APPLY-STAGING-A` + `...-ACL-GRANTS-R1`) | **Funcao aplicada e funcionalmente verificada em staging** (`ucrjtfswnfdlxwtmxnoo`), confirmado em `2026-07-15` (`CLIENTE-ORDER-SUMMARY-READMODEL-APPLY-STAGING-A`, `CLOSED / ACCEPTED_WITH_NONBLOCKING_DEBTS`). `public.cliente_pedido_summary(uuid)` existe com corpo equivalente byte a byte ao arquivo (**sem drift de schema**). **`db/30` em si permanece ausente** de `supabase_migrations.schema_migrations` (divida de proveniencia preservada, `DB30_NOT_RECORDED_IN_SUPABASE_MIGRATION_HISTORY`, nao reparada). ACL de execucao **nao mais ampla que o contrato canonico**: remediada em `2026-07-15` pela migration grants-only `db/57_cliente_pedido_summary_acl_grants.sql` (ver linha propria abaixo, fase `CLIENTE-ORDER-SUMMARY-READMODEL-ACL-GRANTS-R1`), que revogou `EXECUTE` de `PUBLIC`/`anon`/`service_role`, mantendo apenas `authenticated`. Smoke autenticado de browser continua divida nao bloqueante (`AUTHENTICATED_BROWSER_SMOKE_NOT_EXECUTED`, sem senha de cliente de teste). |
| `db/34_controlled_delete_pedido_op.sql` | RPCs de exclusao fisica controlada de teste/staging para Pedido e OP: `diagnosticar_impacto_pedido`, `diagnosticar_impacto_op`, `remover_pedido`, `remover_op`. Remove o trigger legado `ops_numeradas_no_delete` (db/26) para permitir remover OP numerada sem bloqueadores reais. Bloqueia quando ha entrega, expedicao ou OP filha nao tratada; exige confirmacao `EXCLUIR` para dependencias nao bloqueadoras. `op_numeros` nunca e alterado. | `RAVATEX-TAPETES-PEDIDO-OP-CONTROLLED-DELETE-B` (+ `...-POLICY-FIX-C`) | **Aplicada e validada somente em staging** (`ucrjtfswnfdlxwtmxnoo`); producao `bhgifjrfagkzubpyqpew` intocada. Logica destrutiva renomeada `*_pre53` por `db/53` (ver abaixo); sem API publica sob o nome original desde entao. |
| `db/35_controlled_delete_test_cascade.sql` | Substitui as quatro RPCs de `db/34` por versoes que aceitam cascata fisica controlada (entrega + OP filha) quando nao ha expedicao vinculada, exigindo confirmacao textual `EXCLUIR TUDO` (`requires_cascade_confirmation`). Expedicao permanece bloqueador nesta migration. `op_numeros` inalterado. | `RAVATEX-TAPETES-PEDIDO-OP-CONTROLLED-DELETE-CASCADE-TEST-D` | **Aplicada e validada somente em staging** (`ucrjtfswnfdlxwtmxnoo`); producao intocada. Substituida functionalmente por `db/36`/`db/37` na mesma fase de Controlled Delete; renomeada `*_pre53` por `db/53`. |
| `db/36_controlled_delete_fk_order_fix.sql` | Corrige a ordem transacional da cascata de `db/35`: monta alvos FK explicitos (`target_ops`, `target_op_itens`, `target_entregas`, `target_op_latex_links`, `target_child_ops`, `target_child_op_itens`), zera `entrega_itens` por `op_id` e por `op_item_id` antes de remover OPs, e corrige os guards `entrega_cima_latex_guard_fn`/`entrega_itens_cima_latex_guard_fn` para retornar `OLD` em `DELETE` autorizado (evita cancelamento silencioso). Expedicao continua bloqueador. `op_numeros` inalterado. | `RAVATEX-TAPETES-PEDIDO-OP-CONTROLLED-DELETE-FK-ORDER-FIX-E` | **Aplicada e validada somente em staging** (`ucrjtfswnfdlxwtmxnoo`) com teste sintetico real (Pedido #29, OPs 45/46, entrega 21); producao intocada. Renomeada `*_pre53` por `db/53`. |
| `db/37_controlled_delete_expedicao_cascade.sql` | Substitui as quatro RPCs de `db/36` (mesmos guards de entrega): expedicao deixa de ser bloqueador incondicional e passa a integrar a cascata `EXCLUIR TUDO` (`expedicao_movimento_itens` → `expedicao_movimentos` → `expedicao_itens` → `expedicoes`, removidos antes de OPs/entregas/lotes/pedido). `op_numeros` inalterado. Ver decisao `D-DEL14` em `docs/architecture/PEDIDO_OP_SCHEMA_CONTRACT.md` SS10. | `RAVATEX-TAPETES-PEDIDO-OP-CONTROLLED-DELETE-EXPEDICAO-CASCADE-E2` | **Aplicada e validada somente em staging** (`ucrjtfswnfdlxwtmxnoo`); producao intocada. Desde `db/53`, renomeada para `diagnosticar_impacto_pedido_pre53`/`diagnosticar_impacto_op_pre53`/`remover_pedido_pre53`/`remover_op_pre53` (`EXECUTE` revogado de todos os papeis); logica preservada e chamada pelos wrappers publicos do guard documental somente quando elegivel. |
| `db/53_controlled_delete_document_link_guard.sql` | Guarda documental permanente entre a exclusao fisica controlada de teste (Pedido/OP) e o historico documental canonico G28 (`document_link_revisions`/`document_link_revision_ops`). Renomeia as quatro funcoes legadas de `db/37` para `*_pre53` (revoga `EXECUTE` de `PUBLIC`/`anon`/`authenticated`/`service_role`) e recria as assinaturas publicas originais como wrappers `SECURITY DEFINER` que diagnosticam historico documental, bloqueiam quando ha vinculo canonico e delegam a `*_pre53` somente quando elegivel. Nunca apaga/altera `document_link_revisions`/`document_link_revision_ops`/`op_numeros`. | `RAVATEX-TAPETES-CONTROLLED-DELETE-DOCUMENT-LINK-GUARD-B` | **Aplicada e validada em staging** (`ucrjtfswnfdlxwtmxnoo`), commit tecnico `707a37bd1d2c4728ab2a17433b6441049bd88062`. `CLOSED / ACCEPTED`. Producao intocada. Ver `docs/architecture/PEDIDO_OP_SCHEMA_CONTRACT.md` (decisoes `D-DEL10`-`D-DEL13`). |
| `db/54_controlled_delete_document_link_grants.sql` | Correcao de seguranca emergencial staging-only: apos `db/53`, as quatro RPCs publicas mantinham `EXECUTE` concedido a `PUBLIC`/`anon` por grants anteriores/default. Revoga esses grants e restringe `EXECUTE` a `authenticated`, sem alterar corpo, `SECURITY DEFINER` ou tabelas. | `RAVATEX-TAPETES-CONTROLLED-DELETE-DOCUMENT-LINK-GRANTS-54` | **Aplicada e validada em staging** (`ucrjtfswnfdlxwtmxnoo`), parte do mesmo commit tecnico `707a37bd...`. `CLOSED / ACCEPTED`. Producao intocada. |
| `db/55_controlled_delete_document_link_policy_cast.sql` | Correcao emergencial staging-only para `db/53` ja aplicada: `to_jsonb(<literal>)` sem cast explicito falhava com `could not determine polymorphic type`. Patch forward-only (`DO $repair$`) localiza e substitui o literal de politica documental por `to_jsonb(<literal>::TEXT)` nas duas diagnosticas publicas ja aplicadas. Nao altera regras, grants ou cascatas. | `RAVATEX-TAPETES-CONTROLLED-DELETE-DOCUMENT-LINK-POLICY-CAST-55` | **Aplicada e validada em staging** (`ucrjtfswnfdlxwtmxnoo`), parte do mesmo commit tecnico `707a37bd...`. `CLOSED / ACCEPTED`. Producao intocada. |
| `db/56_controlled_delete_document_link_diagnostics_null_safe.sql` | Correcao emergencial staging-only para regressao de `db/53`: `jsonb_set(...)` e `STRICT`, entao o retorno inteiro das diagnosticas publicas colapsava para `NULL` sempre que o alvo nao estava bloqueado por historico documental (`reason` nulo). Corrigido com `COALESCE(to_jsonb(v_reason), 'null'::jsonb)` no `jsonb_set` final de cada diagnostica, preservando o schema JSON e sem alterar guard/ACL/`remover_*`/`*_pre53`. | `RAVATEX-TAPETES-CONTROLLED-DELETE-DOCUMENT-LINK-DIAGNOSTICS-NULL-SAFE-56` | **Aplicada e validada em staging** (`ucrjtfswnfdlxwtmxnoo`), parte do mesmo commit tecnico `707a37bd...`. `CLOSED / ACCEPTED`. Producao intocada. |
| `db/57_cliente_pedido_summary_acl_grants.sql` | Migration grants-only, forward-only e idempotente para `public.cliente_pedido_summary(UUID)`: `REVOKE EXECUTE ... FROM PUBLIC, anon, service_role; GRANT EXECUTE ... TO authenticated`. Nao recria nem altera corpo, `SECURITY DEFINER`, volatilidade, `search_path`, owner, assinatura ou tipo de retorno da funcao. Resolve a divergencia de ACL registrada em `D-COS06` (`docs/architecture/PEDIDO_OP_MOVIMENTACAO_DOCUMENTOS_PLANO.md`), fechando-a em `D-COS07`. | `CLIENTE-ORDER-SUMMARY-READMODEL-ACL-GRANTS-R1` | **Aplicada e verificada somente em staging** (`ucrjtfswnfdlxwtmxnoo`), `2026-07-15`, via operacao de migration rastreada do Supabase MCP; registro `20260715190627 / 57_cliente_pedido_summary_acl_grants` confirmado no catalogo. `CLOSED / ACCEPTED`. ACL final verificada ao vivo: `PUBLIC` sem `EXECUTE`, `anon` sem `EXECUTE`, `authenticated` com `EXECUTE`, `service_role` sem `EXECUTE` explicito (owner `postgres` retem privilegio inerente). Contrato da funcao (assinatura `cliente_pedido_summary(uuid)`, retorno `jsonb`, `SECURITY DEFINER`, `STABLE`, `search_path=public`, owner `postgres`, corpo) confirmado byte a byte inalterado (hash de definicao identico antes/depois). Producao (`bhgifjrfagkzubpyqpew`) intocada; sem push. |
| `db/58_admin_usuarios_senha_temporaria.sql` | Migration aditiva, forward-only, idempotente (`ADD COLUMN IF NOT EXISTS`) para a fase `A4.1` (`docs/architecture/CAMADA2_USUARIOS_SPEC_PROPOSED.md`): `usuarios.senha_temporaria BOOLEAN NOT NULL DEFAULT FALSE` + `usuarios.senha_gerada_em TIMESTAMPTZ NULL`. Base do caminho unico decidido para A4 (senha temporaria + troca forcada no primeiro login, A4.2 ainda `NOT AUTHORIZED`). | `A4.1` | **Aplicada e verificada em staging** (`ucrjtfswnfdlxwtmxnoo`), `2026-07-16`, via Supabase MCP; registro `20260716014338 / 58_admin_usuarios_senha_temporaria` confirmado no catalogo. `CLOSED / ACCEPTED`. Colunas confirmadas ao vivo com o tipo/nullability/default do arquivo; os 10 usuarios existentes preservados sem efeito retroativo (`senha_temporaria=false`, `senha_gerada_em=NULL` em todos). Producao intocada; sem push. |
| `db/59_admin_last_sign_in_readmodel.sql` | RPC `public.admin_usuarios_last_sign_in()` — read model admin-only (`SECURITY DEFINER`, `STABLE`, `search_path=public,auth`), guarda `is_admin()` (padrao `db/12`) com `RAISE EXCEPTION ... ERRCODE 42501` para chamador nao-admin. Retorna apenas `id`+`last_sign_in_at` de `auth.users` para os usuarios visiveis em `public.usuarios` — nao expoe email/senha/metadata. Grants explicitos: `REVOKE FROM PUBLIC, anon, service_role; GRANT TO authenticated`. Fecha o HARD STOP da coluna "Ultimo acesso" registrado no closeout de `A3.2`. | `CAMADA2-LAST-ACCESS-RPC` | **Aplicada e verificada em staging** (`ucrjtfswnfdlxwtmxnoo`), `2026-07-16`, via Supabase MCP; registro `20260716014358 / 59_admin_last_sign_in_readmodel` confirmado no catalogo. `CLOSED / ACCEPTED`. Matriz de papeis empirica (`BEGIN...ROLLBACK`): `anon` → `42501` no limite de ACL (antes de executar); `authenticated` nao-admin → `42501` de negocio (RAISE EXCEPTION dentro da funcao); `authenticated` admin → `ok`, DTO minimo confirmado (so `id`+`last_sign_in_at`). Consumo na UI (coluna "Ultimo acesso" em `js/screens/admin-usuarios.js`) e micro-fase futura propria, `NOT AUTHORIZED` por este registro. Producao intocada; sem push. |

### Smoke tests estáticos de schema versionado

| Arquivo | Propósito | Fase |
|---|---|---|
| `tests/cliente-tracking-schema.smoke.js` | Validação estática de `db/15_status_cliente_visual.sql`: colunas novas, taxonomia visual, exceções, `pedido_cliente_eventos`, RLS admin-only, trigger guard de INSERT, trigger de touch em UPDATE e ausência de comandos destrutivos/secrets. | `RAVATEX-TAPETES-PEDIDOS-CLIENTE-TRACKING-SCHEMA-A` |
| `tests/cliente-events-rls-schema.smoke.js` | Validação estática de `db/16_pedido_cliente_eventos_cliente_select.sql`: existência do arquivo, policy `pedido_cliente_eventos_cliente_select`, `FOR SELECT`, filtro `visivel_cliente = true`, ownership via `public.pedidos` + `public.meu_cliente_id()`, ausência de writes de cliente e ausência de escopo indevido. | `RAVATEX-TAPETES-PEDIDOS-CLIENTE-TRACKING-EVENTS-RLS-A` |
| `tests/cliente-tracking-steps.smoke.js` | Validação estática e em sandbox de `js/pedido-tracking-ui.js`: namespace global, 8 etapas principais, 4 exceções, helpers puros, fallback para `recebido`, ausência de termos internos proibidos e ausência de query/write. | `RAVATEX-TAPETES-PEDIDOS-CLIENTE-TRACKING-STEPS-A` |
| `tests/admin-pedido-tracking-control.smoke.js` | Validação estática do controle admin de publish do tracking visual: novo módulo `js/screens/pedido-tracking-admin.js`, integração com `pedido-detail.js`, uso da taxonomia compartilhada, writes em `pedidos.status_cliente_*` e `pedido_cliente_eventos`, separação do status operacional e ausência de mudanças funcionais nas telas cliente/fornecedor. | `RAVATEX-TAPETES-PEDIDOS-CLIENTE-TRACKING-ADMIN-A` |
| `tests/pedido-parciais-admin-control.smoke.js` | Validação estática do controle admin manual de parciais: novo módulo `js/screens/pedido-parciais-admin.js`, integração com `pedido-detail.js`, SELECT explícito e insert controlado em `pedido_parciais`, reaproveitamento do catálogo compartilhado `CLIENTE_PARCIAL_SITUACOES`, ausência de uso obrigatório de `pedido_parcial_itens` e ausência de mudanças funcionais nas telas cliente. | `RAVATEX-TAPETES-CLIENTE-PARCIAIS-ADMIN-CONTROL-A` |
| `tests/cliente-dashboard.smoke.js` | Validação estática do Dashboard Cliente read-only: existência do módulo `js/screens/cliente-dashboard.js`, rota `#/cliente/dashboard` (role cliente), menu "Início", SELECT explícito de pedidos restrito aos campos permitidos, `pedido_cliente_eventos` apenas com colunas seguras, ausência de `metadata`/`criado_por`/`origem`/`pedido_eventos`, uso da taxonomia `window.RavatexPedidoTracking`, render de KPIs/pedidos recentes/atualizações e ausência de writes/`service_role`/dados internos. | `RAVATEX-TAPETES-CLIENTE-DASHBOARD-A` |
| `tests/cliente-pedido-summary-readmodel.smoke.js` | Validação estática da RPC publica `cliente_pedido_summary(UUID)`: permissão por admin ou cliente dono, `SECURITY DEFINER`, `search_path`, grant apenas para `authenticated`, DTO publico, ausência de chaves internas proibidas, parciais/timeline apenas com `visivel_cliente IS TRUE` e ausência de writes destrutivos. | `RAVATEX-TAPETES-CLIENTE-ORDER-SUMMARY-READMODEL-A-B` |

### Módulos frontend de tracking visual

| Arquivo | Papel | Fase |
|---|---|---|
| `js/pedido-tracking-ui.js` | Camada compartilhada de taxonomia visual e helpers puros para status, mensagem e progresso do tracking cliente. | `RAVATEX-TAPETES-PEDIDOS-CLIENTE-TRACKING-STEPS-A` |
| `js/screens/pedido-tracking-admin.js` | Card admin para publicar a situação visível ao cliente, com preview e writes auditáveis em `pedidos.status_cliente_*` e `pedido_cliente_eventos`. | `RAVATEX-TAPETES-PEDIDOS-CLIENTE-TRACKING-ADMIN-A` |
| `js/screens/pedido-parciais-admin.js` | Card admin para listar e cadastrar manualmente parciais do pedido em `pedido_parciais`, reaproveitando o catálogo compartilhado `CLIENTE_PARCIAL_SITUACOES` e preview técnico simples por `buildPedidoAcompanhamentoParcial`, sem leitura cliente e sem ativar `pedido_parcial_itens`. | `RAVATEX-TAPETES-CLIENTE-PARCIAIS-ADMIN-CONTROL-A` |
| `js/screens/cliente-dashboard.js` | Dashboard Cliente read-only (`#/cliente/dashboard`, `screenClienteDashboard`): página inicial do portal B2B. Cards/KPIs derivados localmente, pedidos recentes e últimas atualizações. SELECT explícito em `pedidos` (campos seguros) e `pedido_cliente_eventos` (`id, pedido_id, status, titulo, mensagem, criado_em`). Sem writes, sem `metadata`/`criado_por`/`origem`, sem `pedido_eventos`, sem expor `OP`/`lote`/`fornecedor`/`NF`/`romaneio`/`custo`/`margem`. | `RAVATEX-TAPETES-CLIENTE-DASHBOARD-A` |
| `js/screens/cliente-pedido-detail.js` | Detalhe do pedido no Portal Cliente. A partir de `CLIENTE-ORDER-SUMMARY-READMODEL-A-B`, consome somente `supa.rpc('cliente_pedido_summary')` e nao consulta diretamente tabelas operacionais internas como `ops`, `lotes`, `op_itens`, `entregas`, `expedicoes` ou `ordens_compra_fio`. | `RAVATEX-TAPETES-CLIENTE-ORDER-SUMMARY-READMODEL-A-B` |

> O design que justifica a migration de schema está em
> `docs/architecture/AUTH_DELETE_USER_DESIGN.md` (fase
> `RAVATEX-TAPETES-AUTH-DELETE-USER-DESIGN-A`). A migration
> `db/12_auth_user_disable_schema.sql` foi aplicada em staging
> (`ucrjtfswnfdlxwtmxnoo`) em `2026-06-24` — vide fases
> `RAVATEX-TAPETES-AUTH-DISABLE-USER-SCHEMA-APPLY-A` (orientação,
> commit `8fa924a`) e `...-SCHEMA-APPLY-EVIDENCE-A` (registro da
> aplicação real, commit `1a35e1d`) no LEDGER. A Edge Function
> `admin-disable-user` foi criada localmente no repo na fase
> `RAVATEX-TAPETES-AUTH-DISABLE-USER-EDGE-A`, commit `eb5d2e0`
> (ver `supabase/functions/admin-disable-user/README.md`);
> deployada em staging `ucrjtfswnfdlxwtmxnoo` (fase
> `...-EDGE-STAGING-DEPLOY-A`, ver LEDGER). Um **runner local
> automatizado** de E2E foi criado em
> `scripts/staging/admin-disable-user-e2e.mjs` (fase
> `...-E2E-AUTO-RUNNER-A`) e o tratamento do login bloqueado
> esperado foi corrigido em `...-E2E-RUNNER-FIX-A`. **E2E real
> em staging já passou com `result: PASS`** (ver LEDGER §5k
> para evidência sanitizada do descartável
> `disable-edge-e2e-20260624-115027@tapetes.test`,
> user_id `d12b005e-d455-4f78-b401-59ebd9f971c5`,
> desativado em staging, login bloqueado confirmado). A
> **tela `#/cadastros/usuarios` foi integrada** com
> `admin-disable-user` na fase `...-UI-A` (botão `Desativar`
> substitui o placeholder `Em breve`; chama
> `window.supa.functions.invoke('admin-disable-user', { body:
> { user_id, reason } })`; modal com motivo opcional; mapeia
> `FORBIDDEN`/`SELF_DISABLE_FORBIDDEN`/`LAST_ADMIN_FORBIDDEN`/
> `NOT_FOUND`/`AUTH_BAN_FAILED`/`COMPENSATION_FAILED`/
> `VALIDATION_ERROR`/`UNAUTHORIZED` para mensagens PT-BR;
> guarda de UX para self/inativos). **Validação manual da UI
> de desativação em staging registrada** na fase
> `RAVATEX-TAPETES-AUTH-DISABLE-USER-UI-VALIDATION-CLOSEOUT-A`
> (HMNlead, app/staging `ucrjtfswnfdlxwtmxnoo`): tela
> `#/cadastros/usuarios`, botão `Desativar`, guarda de
> usuário já inativo, criação de fornecedor descartável
> ativo e desativação via UI — fluxo real passou. Detalhes
> em `PROJECT_STATE.md`. **Produção `bhgifjrfagkzubpyqpew` e
> `origin/main` intocados.** Próxima etapa: decisão de
> release para `origin/main`/produção, somente com
> autorização explícita do HMNlead (em fase separada).

> **A4.1 + `CAMADA2-LAST-ACCESS-RPC` (`2026-07-16`):** a Edge
> Function `admin-create-user` foi estendida — política de senha
> 6→8 caracteres + exigência de ≥1 dígito (`PASSWORD_MIN_LENGTH`,
> `PASSWORD_DIGIT_RE`) e o insert em `public.usuarios` passou a
> setar `senha_temporaria: true` / `senha_gerada_em: now()` (ver
> `supabase/functions/admin-create-user/README.md`). **Deploy em
> staging (`ucrjtfswnfdlxwtmxnoo`) executado pelo arquiteto.** Um
> **runner local automatizado de E2E**, mesmo esqueleto e mesmas
> garantias de segurança do `admin-disable-user-e2e.mjs` (login com
> senha real feito por humano, nunca pelo agente IA; sanitização de
> segredos; guarda de staging-only; config local gitignored), foi
> criado em `scripts/staging/admin-create-user-password-policy-e2e.mjs`.
> **E2E real em staging passou com `result: PASS` (9/9 passos)**,
> cobrindo: senha de 7 caracteres rejeitada (mensagem de
> comprimento), senha de 8 caracteres sem dígito rejeitada (mensagem
> de dígito), senha válida aceita com `senha_temporaria=true` e
> `senha_gerada_em` preenchido confirmados via REST, cleanup via
> `admin-delete-user` (fluxo existente) com cleanup zero verificado.
> Consumo da coluna "Último acesso" na UI (`js/screens/admin-usuarios.js`,
> via `db/59`) e `A4.2` (guarda de boot + tela de troca obrigatória)
> permanecem `NOT AUTHORIZED`, candidatas a `ARCHITECT DECISION`.
> Produção `bhgifjrfagkzubpyqpew` não acessada; sem push.
>
> **Atualização (`2026-07-16`, superada acima):** o consumo da coluna
> "Último acesso" foi implementado e fechado (`CAMADA2-LAST-ACCESS-UI`
> — `CLOSED / ACCEPTED`, technical commit `0aff22f` — `Add last
> sign-in column to user admin`; validação visual do arquiteto
> confirmada em preview: coluna populada com dados reais, formato
> correto, `"—"` nos nunca-logados, ordenação com nulos por último).
> **`A4.2` (guarda de troca de
> senha obrigatória) — `CLOSED / ACCEPTED` (2026-07-16).** `js/auth.js`
> ganhou `senha_temporaria`/`senha_gerada_em` no `select` de
> `loadCurrentUser()` (única mudança, decisão explícita do arquiteto —
> Opção A de um hard stop levantado em sessão); `js/boot.js` ganhou a
> guarda (`isSenhaTemporariaExpirada` + `guardedHandleRoute`, sem tocar
> `js/router.js`); `js/trocar-senha-writes.js` (novo) faz o self-service
> `auth.updateUser({password})` + `UPDATE usuarios SET
> senha_temporaria=false`; `js/screens/trocar-senha-obrigatoria.js`
> (novo) é a tela (card sem shell, checklist vivo, modo `expired` após
> 7 dias). Um **runner local automatizado de E2E**, mesmo esqueleto e
> mesmas garantias de segurança dos runners anteriores (login com senha
> real só por humano, nunca pelo agente IA; senha sintética gerada pelo
> próprio script; sanitização de segredos; guarda de staging-only;
> config local gitignored), foi criado em
> `scripts/staging/trocar-senha-obrigatoria-e2e.mjs` — **não executado
> nesta fase**; a evidência usada para o closeout foi a **validação
> manual do arquiteto em staging**: usuário sintético criado, gate
> exibido, checklist reagiu, troca efetuada, `senha_temporaria` zerada,
> segundo login entrou direto sem gate, usuário removido. Débito
> registrado (candidato a `CODE-HEALTH-AUDIT-§18-R1`, não corrigido
> nesta fase): 6 testes pré-existentes de `tests/auth.smoke.js` com
> regex desatualizado quanto a `?v=` de cache-busting em
> `<script src="js/auth.js">`. `A4.3` (convite por e-mail) permanece
> `NOT AUTHORIZED`. Produção `bhgifjrfagkzubpyqpew` não acessada; sem
> push.
>
> **`A5.1-A5.2` (`2026-07-16`) — `CLOSED / ACCEPTED`:** Edge Function
> nova `admin-reset-user-password` (espelho de `admin-disable-user`) —
> `auth.admin.updateUserById(target, {password})` com senha temporária
> gerada via `crypto.getRandomValues` (nunca `Math.random`, nunca valor
> fixo), auto-reset **bloqueado** (`SELF_RESET_FORBIDDEN`, decisão do
> arquiteto), marca `senha_temporaria=true`/`senha_gerada_em=now()`,
> senha retornada uma única vez, nunca logada (ver
> `supabase/functions/admin-reset-user-password/README.md`). UI:
> botão de ícone chave em `js/screens/admin-usuarios.js` →
> `confirmDialog` → modal "Senha gerada" (senha/copiar/aviso de
> exibição única) em `js/screens/admin-usuarios-modal.js`. **Deploy em
> staging (`ucrjtfswnfdlxwtmxnoo`) executado pelo arquiteto.** Um
> **runner local automatizado de E2E**, 4º do mesmo padrão dos
> anteriores (`admin-disable-user-e2e.mjs`,
> `admin-create-user-password-policy-e2e.mjs`,
> `trocar-senha-obrigatoria-e2e.mjs` — login com senha real só por
> humano, nunca pelo agente IA; senhas sintéticas geradas pelo próprio
> script/pela Edge Function; sanitização de segredos; guarda de
> staging-only; config local gitignored), foi criado em
> `scripts/staging/admin-reset-password-e2e.mjs`. **E2E real em
> staging passou com `result: PASS` (15/15 passos)**, cobrindo:
> guardas `SELF_RESET_FORBIDDEN`/`NOT_FOUND` ao vivo, reset real com
> flag+timestamp atualizados, senha antiga invalidada, login com a
> temporária nova, self-service de `A4.2` encadeado (nova troca + flag
> zerada), relogin sem gate ("próximo login entra direto"), cleanup
> zero. Validação visual do arquiteto **dispensada por decisão
> explícita**, coberta pela combinação e2e + verificação de fluxo em
> navegador real pelo executor. Achados registrados como candidatos
> `NOT AUTHORIZED`: `UI-EL-BOOLEAN-ATTR-FIX` (potencial bug de
> `setAttribute` boolean em `js/ui.js`'s `el()`, severidade **não
> confirmada** — pendente de verificação do arquiteto nos botões
> Desativar/Excluir de `admin-usuarios.js`) e decomposição de
> `admin-usuarios-modal.js` (576 linhas, candidato a
> `CODE-HEALTH-AUDIT-§18-R1`). `A5.3-A5.4` (reativação) permanece
> `NOT AUTHORIZED`, autorização própria futura. Produção
> `bhgifjrfagkzubpyqpew` não acessada; sem push.

## 4. Docs legadas (NÃO GUIAM EXECUÇÃO)

Preservadas para contexto histórico. Cada pasta ou arquivo carrega
banner próprio. Em caso de uso, **adaptar à arquitetura atual** e
confirmar com fontes canônicas.

### `docs/superpowers/`

Conteúdo das fases 1–7 do projeto. Inclui `STATUS.md`, `specs/` e
`plans/`.

| Tipo | Classificação | Observação |
|---|---|---|
| `STATUS.md` | Histórico | Fases 1–6 listadas; assume arquitetura pré-refactor. |
| `specs/*.md` (9 arquivos) | Obsoleto | Designs escritos para `index.html` monolítico. A arquitetura foi modularizada. |
| `plans/*.md` (9 arquivos) | **PERIGOSO PARA IA** | Instrui a modificar `index.html` diretamente, com writes Supabase inline e `git add .`. **Não seguir literalmente.** |

> Antes de usar qualquer spec/plan daqui como requisito funcional,
> adaptá-lo à arquitetura modular atual
> (`js/boot.js`, `js/router.js`, `js/ui.js`, `js/screens/*`,
> `js/calculo-op.js`).
> Ver `docs/superpowers/README.md` para detalhes.

### `docs/qa/`

Checklists e roteiros de QA das fases 1–6 + roteiro da Fase 6.

| Tipo | Classificação | Observação |
|---|---|---|
| `fase1-checklist.md`, `fase2-checklist.md` | Histórico + credenciais anonimizadas | Podiam conter senhas de teste; anonimizadas em `RAVATEX-TAPETES-DOCS-SANITIZE-A`. |
| Demais checklists (`fase3`–`fase6`, `fase5a`, `fase5b`) | Histórico | Úteis como registro de QA, não como especificação técnica. |
| `roteiro-teste-fase6.md` | Histórico | Roteiro manual para Vinícius. |
| `fase2-bugs-pendentes.md` | Histórico | Bug pendente da Fase 2. Precisa de verificação atual antes de qualquer ação. |

> Ver `docs/qa/README.md` para detalhes.

### `docs/` raiz (docs antigos)

| Arquivo | Classificação | Observação |
|---|---|---|
| `DEPLOYMENT.md` | Parcialmente obsoleto | Foi escrito antes da separação staging/origin. Hoje há staging; `origin/main` é protegido. Ver banner no topo. |
| `AI_AGENT_RULES.md` | Parcialmente legado | Algumas regras continuam úteis, mas o contexto D1/D1A/D2 não é a fase vigente. Ver banner no topo. |
| `BACKUP_AND_RESTORE.md` | Parcialmente atual | Runbook correto, mas status de backup pode estar desatualizado. Ver nota no topo. |
| `HANDOFF.md` | Histórico/parcialmente legado | Mistura arquitetura antiga com práticas pós-staging. Ver banner no topo. |
| `STAGING_BASELINE.md` | **Atual** | Checkpoint de staging bem detalhado. Refs e regra de ambiente ainda valem. |

## 5. Avisos críticos

### Plans em `docs/superpowers/plans/`

Os plans descrevem modificações diretas em `index.html`, writes
Supabase inline, `git add .` e fluxo sem staging. **Segui-los
literalmente reintroduziria o monólito pré-refactor**, violando
`docs/architecture/CODE_HEALTH_RULES.md` §2 e §6.

> Trate os plans como **registro histórico da intenção** das fases
> antigas, não como playbook executável.

### Credenciais antigas em `docs/qa/`

`docs/qa/fase1-checklist.md` e `docs/qa/fase2-checklist.md` continham
senhas de teste (e.g. `Admin123!`, `Fornec123!`). Foram
**anonimizadas** em `RAVATEX-TAPETES-DOCS-SANITIZE-A` substituídas
por `[REDACTED_TEST_PASSWORD]`. Não confiar em nenhuma credencial
encontrada em docs legadas; rotacionar se necessário.

### `docs/DEPLOYMENT.md` e `docs/AI_AGENT_RULES.md`

Ambos os docs foram escritos em um contexto anterior ao
`staging`/`origin` split e à modularização. Hoje há:

- remote `staging` (`controle-tapetes-staging`) que é o destino
  padrão de push em `work/app-next`;
- remote `origin` (`grupoterrabranca/controle-tapes`) que é
  produção e está **intocado** desde a fase de refactor;
- ref Supabase staging `ucrjtfswnfdlxwtmxnoo`;
- ref Supabase produção `bhgifjrfagkzubpyqpew`.

A regra vigente está em `AGENT_HANDOFF.md` (regras 1, 2, 3, 15) e em
`docs/architecture/CODE_HEALTH_RULES.md` §15.

## 6. Política de atualização deste índice

- Atualizar este índice quando houver mudança na lista de
  autoridade da §1, novo documento classificatório (entrar no
  inventário da §1), novo runbook (entrar em §3) ou nova
  categoria de docs legadas (entrar em §4).
- A §1 é a única lista ativa de autoridade; nenhuma outra seção
  deste índice e nenhum outro arquivo deve manter lista
  concorrente de "fontes canônicas", "prevalência" ou
  "precedência".
- Fase: docs-only. Sem alteração funcional.
- A atualização do índice é regida pela **matriz de atualização
  por fase** de `docs/governance/DOCUMENTATION_MODEL.md` §11 e
  pela **transação documental mínima** §12 do mesmo modelo.
  Mudanças de autoridade, classificação ou caminhos exigem
  revisão deste índice; mudanças cosméticas devem ser evitadas.
- As listas concorrentes que existiam na antiga §2 "Regra de
  prevalência" deste índice, em `docs/architecture/CLAUDE_PROJECT_ASSET_MAP.md`
  e em `Guide-and-governance-rules.stxt` foram reconciliadas em
  `G28-DOCS-B3-E1`: passaram a apontar para a §1. O histórico
  dessa reconciliação está no `docs/ledgers/G28_LEDGER.md`.

## 7. Migração de idioma da documentação (DOC-LANGUAGE-MIGRATION) e arquivo pt-BR

A frente `DOC-LANGUAGE-MIGRATION` traduz progressivamente a
documentação canônica para inglês, em lotes autorizados por ordem
própria. Cada arquivo traduzido tem seu original pt-BR **movido**, no
mesmo commit, para `docs/archive/pt-BR/<caminho-original>`
(preservação byte a byte; não operacional, apenas referência
histórica). Nomes de arquivos, âncoras, caminhos e referências
cruzadas permanecem **inalterados** — só o conteúdo é traduzido. O
vocabulário canônico de status (`CLOSED`, `ACCEPTED`,
`NOT AUTHORIZED`, `DEFERRED`, `PROPOSED`, `HARD STOP`, `READ-ONLY`
etc.) permanece verbatim. A partir de `DOC-LANGUAGE-MIGRATION-L2`,
decisões de arquiteto e blocos antes mantidos em português nas casas
canônicas também passam a ser traduzidos para inglês, marcados com nota
de proveniência (`(translated from the architect's original Portuguese;
original in docs/archive/pt-BR/)`); a redação pt-BR original preservada
no arquivo permanece autoritativa em qualquer disputa de nuance.
Ledgers e `docs/handoffs/` **não** são traduzidos.

A política de idioma vigente está registrada nas casas canônicas:
`docs/governance/DOCUMENTATION_MODEL.md` (§18, "Language policy"),
`docs/architecture/CODE_HEALTH_RULES.md` (§19, "Rule for language") e
`docs/governance/SUPERVISION_PROTOCOL.md` (§3, linha de idioma no
formato de ordem). `CLAUDE.md` mantém um resumo-ponteiro apontando a
essas casas.

### Lote `DOC-LANGUAGE-MIGRATION-L1`

| Caminho canônico (agora em inglês) | Original pt-BR arquivado |
|---|---|
| `docs/architecture/CODE_HEALTH_RULES.md` | `docs/archive/pt-BR/docs/architecture/CODE_HEALTH_RULES.md` |
| `docs/governance/SUPERVISION_PROTOCOL.md` | `docs/archive/pt-BR/docs/governance/SUPERVISION_PROTOCOL.md` |
| `docs/governance/DOCUMENTATION_MODEL.md` | `docs/archive/pt-BR/docs/governance/DOCUMENTATION_MODEL.md` |
| `CLAUDE.md` | `docs/archive/pt-BR/CLAUDE.md` |

### Lote `DOC-LANGUAGE-MIGRATION-L2`

| Caminho canônico (agora em inglês) | Original pt-BR arquivado |
|---|---|
| `PROJECT_STATE.md` | `docs/archive/pt-BR/PROJECT_STATE.md` |
| `AGENT_HANDOFF.md` | `docs/archive/pt-BR/AGENT_HANDOFF.md` |

No `L2`, além da tradução, a política de idioma foi ajustada: ordens de
arquiteto podem ser emitidas em português, mas uma vez registradas nos
canônicos passam a ser gravadas em inglês, com a redação original
preservada no ledger ou arquivo. `docs/governance/DOCUMENTATION_MODEL.md`
§18, `CLAUDE.md` e a linha de idioma de
`docs/governance/SUPERVISION_PROTOCOL.md` §3 foram atualizados no mesmo
commit; o bloco-apêndice de handoff de supervisão (template, não decisão
assinada) foi traduzido para inglês, com o original pt-BR preservado no
arquivo de `L1`.

Os arquivos sob `docs/archive/pt-BR/` são preservação imutável (não
operacional); em divergência, o arquivo canônico em inglês prevalece.
