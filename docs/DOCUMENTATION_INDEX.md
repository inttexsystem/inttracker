# Documentation Index — Ravatex Controle de Tapetes

> Índice de documentação. Toda nova sessão de IA ou pessoa deve
> começar pelas **fontes canônicas** listadas abaixo. As **docs
> legadas** foram preservadas como contexto histórico e **não devem
> guiar execução** após o ciclo de refactor/hardening.
>
> **Convenção:** este diretório é docs-only. Nenhuma alteração de
> código, teste ou `index.html` é feita aqui.

## 1. Fontes canônicas atuais (PREVALECEM)

Estas são as únicas fontes aceitas para decisões operacionais,
arquiteturais e de governança:

| Documento | Propósito |
|---|---|
| `PROJECT_STATE.md` (raiz) | Snapshot canônico curto. HEAD, staging, remotes, arquitetura atual, refactor congelado, pendências. |
| `AGENT_HANDOFF.md` (raiz) | Resumo para próxima sessão de IA. Estado aceito, comandos de verificação, regras, proibições. |
| `docs/architecture/CODE_HEALTH_RULES.md` | 18 regras vinculantes de saúde arquitetural. Toda nova fase deve respeitar. |
| `docs/architecture/PORTAL_B2B_ARCHITECTURE_RULES.md` | Regras arquiteturais específicas da frente Portal B2B/Pedidos. Separa cliente/admin/fornecedor, status operacional vs. status visual, componentes comuns, decomposição de fases e limites de segurança para as próximas etapas. Fase `RAVATEX-TAPETES-PORTAL-B2B-GOVERNANCE-A`. |
| `docs/architecture/AUTH_DELETE_USER_DESIGN.md` | Design de semântica de exclusão/desativação de usuários. Recomendação: desativar (soft delete + ban Auth) em vez de deletar fisicamente. Fase `RAVATEX-TAPETES-AUTH-DELETE-USER-DESIGN-A`. |
| `docs/refactor/ARCHITECTURE_REFACTOR_LEDGER.md` | Histórico cronológico de fases do refactor. Lista de módulos extraídos, ressalvas, decisão de congelamento. |
| `Guide-and-governance-rules.stxt` (raiz) | Governança geral do projeto para futuras sessões de ChatGPT. |

### Runbooks operacionais atuais (complementam as fontes canônicas)

Runbooks descrevem **como executar** procedimentos aprovados.
Não substituem as fontes canônicas; quando houver divergência, as
fontes canônicas prevalecem.

| Documento | Propósito |
|---|---|
| `docs/operations/AUTH_USER_PROVISIONING_RUNBOOK.md` | Procedimento operacional padrão para criação de usuários (admin/fornecedor) via Edge Function `admin-create-user` + UI `#/cadastros/usuarios`. Substitui o fluxo manual de criar Auth user no Studio e copiar UID. |
| `docs/operations/AUTH_DISABLE_USER_PROD_RELEASE_PLAN.md` | Plano operacional de release para levar a cadeia Auth do staging para produção. Ordem obrigatória, critérios GO/NO-GO, rollback, validações read-only. |
| `docs/operations/PARALLEL_ENVIRONMENT_RECONCILIATION.md` | Taxonomia oficial dos ambientes: `bhgifjrfagkzubpyqpew` = Legacy (não tocar), `ucrjtfswnfdlxwtmxnoo` = paralelo de trabalho. Estado de cada ambiente, decisão arquitetural, próximas etapas. |

> **Em caso de divergência entre qualquer doc e estas 7 fontes,
> as 7 fontes prevalecem.** Isso inclui este índice.

## 2. Regra de prevalência

Toda decisão operacional, arquitetural ou de governança deve seguir
a seguinte ordem de autoridade:

1. `Guide-and-governance-rules.stxt`
2. `docs/architecture/CODE_HEALTH_RULES.md`
3. `docs/architecture/PORTAL_B2B_ARCHITECTURE_RULES.md`
4. `PROJECT_STATE.md`
5. `AGENT_HANDOFF.md`
6. `docs/architecture/AUTH_DELETE_USER_DESIGN.md`
7. `docs/refactor/ARCHITECTURE_REFACTOR_LEDGER.md`
8. `docs/DOCUMENTATION_INDEX.md` (este arquivo)
9. `docs/STAGING_BASELINE.md` (atual; regra de ambiente)
10. Docs legadas (`docs/superpowers`, `docs/qa`, docs antigos na raiz
   de `docs/`) — **NÃO** devem guiar execução.

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

### Smoke tests estáticos de schema versionado

| Arquivo | Propósito | Fase |
|---|---|---|
| `tests/cliente-tracking-schema.smoke.js` | Validação estática de `db/15_status_cliente_visual.sql`: colunas novas, taxonomia visual, exceções, `pedido_cliente_eventos`, RLS admin-only, trigger guard de INSERT, trigger de touch em UPDATE e ausência de comandos destrutivos/secrets. | `RAVATEX-TAPETES-PEDIDOS-CLIENTE-TRACKING-SCHEMA-A` |
| `tests/cliente-events-rls-schema.smoke.js` | Validação estática de `db/16_pedido_cliente_eventos_cliente_select.sql`: existência do arquivo, policy `pedido_cliente_eventos_cliente_select`, `FOR SELECT`, filtro `visivel_cliente = true`, ownership via `public.pedidos` + `public.meu_cliente_id()`, ausência de writes de cliente e ausência de escopo indevido. | `RAVATEX-TAPETES-PEDIDOS-CLIENTE-TRACKING-EVENTS-RLS-A` |
| `tests/cliente-tracking-steps.smoke.js` | Validação estática e em sandbox de `js/pedido-tracking-ui.js`: namespace global, 8 etapas principais, 4 exceções, helpers puros, fallback para `recebido`, ausência de termos internos proibidos e ausência de query/write. | `RAVATEX-TAPETES-PEDIDOS-CLIENTE-TRACKING-STEPS-A` |
| `tests/admin-pedido-tracking-control.smoke.js` | Validação estática do controle admin de publish do tracking visual: novo módulo `js/screens/pedido-tracking-admin.js`, integração com `pedido-detail.js`, uso da taxonomia compartilhada, writes em `pedidos.status_cliente_*` e `pedido_cliente_eventos`, separação do status operacional e ausência de mudanças funcionais nas telas cliente/fornecedor. | `RAVATEX-TAPETES-PEDIDOS-CLIENTE-TRACKING-ADMIN-A` |
| `tests/cliente-dashboard.smoke.js` | Validação estática do Dashboard Cliente read-only: existência do módulo `js/screens/cliente-dashboard.js`, rota `#/cliente/dashboard` (role cliente), menu "Início", SELECT explícito de pedidos restrito aos campos permitidos, `pedido_cliente_eventos` apenas com colunas seguras, ausência de `metadata`/`criado_por`/`origem`/`pedido_eventos`, uso da taxonomia `window.RavatexPedidoTracking`, render de KPIs/pedidos recentes/atualizações e ausência de writes/`service_role`/dados internos. | `RAVATEX-TAPETES-CLIENTE-DASHBOARD-A` |

### Módulos frontend de tracking visual

| Arquivo | Papel | Fase |
|---|---|---|
| `js/pedido-tracking-ui.js` | Camada compartilhada de taxonomia visual e helpers puros para status, mensagem e progresso do tracking cliente. | `RAVATEX-TAPETES-PEDIDOS-CLIENTE-TRACKING-STEPS-A` |
| `js/screens/pedido-tracking-admin.js` | Card admin para publicar a situação visível ao cliente, com preview e writes auditáveis em `pedidos.status_cliente_*` e `pedido_cliente_eventos`. | `RAVATEX-TAPETES-PEDIDOS-CLIENTE-TRACKING-ADMIN-A` |
| `js/screens/cliente-dashboard.js` | Dashboard Cliente read-only (`#/cliente/dashboard`, `screenClienteDashboard`): página inicial do portal B2B. Cards/KPIs derivados localmente, pedidos recentes e últimas atualizações. SELECT explícito em `pedidos` (campos seguros) e `pedido_cliente_eventos` (`id, pedido_id, status, titulo, mensagem, criado_em`). Sem writes, sem `metadata`/`criado_por`/`origem`, sem `pedido_eventos`, sem expor `OP`/`lote`/`fornecedor`/`NF`/`romaneio`/`custo`/`margem`. | `RAVATEX-TAPETES-CLIENTE-DASHBOARD-A` |

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

- Atualizar este índice quando houver novo documento canônico
  (entrar em §1), novo runbook (entrar em §3) ou nova categoria de
  docs legadas (entrar em §4).
- Manter as 7 fontes canônicas como âncora; este índice é referência
  cruzada, não fonte primária.
- Fase: docs-only. Sem alteração funcional.
