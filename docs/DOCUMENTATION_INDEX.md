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

> **Em caso de divergência entre qualquer doc e estas 5 fontes,
> as 5 fontes prevalecem.** Isso inclui este índice.

## 2. Regra de prevalência

Toda decisão operacional, arquitetural ou de governança deve seguir
a seguinte ordem de autoridade:

1. `Guide-and-governance-rules.stxt`
2. `docs/architecture/CODE_HEALTH_RULES.md`
3. `PROJECT_STATE.md`
4. `AGENT_HANDOFF.md`
5. `docs/refactor/ARCHITECTURE_REFACTOR_LEDGER.md`
6. `docs/DOCUMENTATION_INDEX.md` (este arquivo)
7. `docs/STAGING_BASELINE.md` (atual; regra de ambiente)
8. Docs legadas (`docs/superpowers`, `docs/qa`, docs antigos na raiz
   de `docs/`) — **NÃO** devem guiar execução.

## 3. Runbooks operacionais atuais

Pasta `docs/operations/`. Documentam **como executar** procedimentos
aprovados pelas fontes canônicas. Quando houver divergência entre
um runbook e uma fonte canônica, as fontes canônicas prevalecem.

| Arquivo | Procedimento | Fase |
|---|---|---|
| `AUTH_USER_PROVISIONING_RUNBOOK.md` | Criação de usuários (admin/fornecedor) via Edge Function `admin-create-user` + UI `#/cadastros/usuarios`. Substitui o fluxo manual de criar Auth user no Studio e copiar UID. | `RAVATEX-TAPETES-AUTH-PROVISIONING-DOCS-A` |

Convenção: estes runbooks são **docs-only** e **operacionais**.
Atualizações devem ser feitas em fases docs-only dedicadas.

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
- Manter as 5 fontes canônicas como âncora; este índice é referência
  cruzada, não fonte primária.
- Fase: docs-only. Sem alteração funcional.
