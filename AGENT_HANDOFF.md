# HANDOFF OPERACIONAL ATIVO

- **Nenhuma fase funcional ativa.** G28-C está `CLOSED / ACCEPTED_WITH_NONBLOCKING_AUTHENTICATED_BROWSER_SMOKE_DEBT`. G28-D discovery está `RELEASE CONTRACT DISCOVERY COMPLETE / BLOCKED BY SPECIFIC MISSING DEPLOYMENT DEFINITION`; sua publicação está `NOT STARTED / NOT ACCEPTED / NOT AUTHORIZED` e não constitui fase ativa. A definição canônica atual do mapeamento de publicação e o procedimento autorizado para migrations 51/52 não existem no repositório; ver `docs/releases/G28_D_RELEASE_CANDIDATE.md`.
- **Última fase aceita:** `G28-C — CLOSED / ACCEPTED_WITH_NONBLOCKING_AUTHENTICATED_BROWSER_SMOKE_DEBT` (decisão arquitetural explícita em 2026-07-15; matriz staging/projeções 16/16 PASS; closeout `a7d7caa`, aceite `d5ec09f`). G28-B8 está `TECHNICALLY COMPLETED / ACCEPTANCE SUBSUMED BY G28-C`: suas capacidades de correção, revogação, restauração e auditoria foram explicitamente validadas e aceitas no gate de G28-C.
- **Commits R1 concluídos:** `271761c3de20427b2cc9059d5ff7cc3727545e6d` — `G28: reconcile canonical phase state` (closeout documental inicial R1); `edaf0b4d36f24aa7b9490e51a42624cc70d45963` — `G28: correct canonical reconciliation state` (correção de defeitos textuais do R1). O HEAD atual deve ser consultado diretamente com `git rev-parse HEAD`.
- **Próxima ação:** a reconciliação read-only do backlog geral e o backfill documental `DOCS-CANONICAL-CONSISTENCY-BACKFILL-A` (docs-only, ver seção própria abaixo) já foram concluídos. Nenhuma fase funcional/técnica está autorizada. `OPEN_ARCHITECT_DECISIONS: DEPLOYMENT_MAPPING_AND_PRODUCTION_MIGRATION_PROCEDURE` permanece o único gate material do backlog; publicação não é a próxima ação e nenhuma implementação automática se segue.
- **Workspace / branch / HEAD anterior:** `D:\OneDrive\Programação\Ravatex\controle-tapetes-g28` / `work/g28-document-qualification`. HEAD técnico/documental anterior: `b27e79fdba1ed8fb8a6232d8e0b8ca4b37ac3a2c` (linha de base histórica de descoberta G28-D; este registro documental a sucede).
- **Leitura obrigatória antes de rotear qualquer ordem:** `PROJECT_STATE.md`, este handoff, plano mestre G28 (`docs/architecture/DOCUMENTOS_VALIDACAO_VINCULOS_E_EVOLUCAO_PLANO.md`), `docs/architecture/PEDIDO_PRODUCTION_FLOW_BACKLOG.md`, ledger G28 (`docs/ledgers/G28_LEDGER.md`) e contratos/runtime aplicáveis.
- **Continuidade documental — caminhos obrigatórios:**
  1. `docs/architecture/PEDIDO_OP_MOVIMENTACAO_DOCUMENTOS_PLANO.md`
  2. `docs/architecture/PEDIDO_PRODUCTION_FLOW_BACKLOG.md`
  3. `docs/architecture/DOCUMENTOS_VALIDACAO_VINCULOS_E_EVOLUCAO_PLANO.md`
  4. `docs/architecture/PEDIDO_OP_SCHEMA_CONTRACT.md`
  5. `PROJECT_STATE.md`
  6. `AGENT_HANDOFF.md`
  7. `docs/ledgers/G28_LEDGER.md`
  8. `docs/DOCUMENTATION_INDEX.md`
  9. `docs/governance/DOCUMENTATION_MODEL.md`
  Todo handoff futuro deve retransmitir estes caminhos e instruir expressamente o chat seguinte a retransmiti-los novamente em qualquer handoff posterior. A cadeia de continuidade do plano e do backlog não pode ser interrompida.
- **Runtime boundaries:** contrato Documento→Pedido 0..1 e Documento→OP 0..N; tabelas de revisão dedicadas; Ingestor retém campos candidate/event; B5 preservado; sem `statusOverrides`, dupla escrita, backfill ou produção.
- **Dívida não bloqueante:** `AUTHENTICATED_BROWSER_SMOKE_BLOCKED_BY_TOOLING` (browser não possui aplicação/sessão admin de staging).

## Controlled Delete × Histórico Documental (Pedido/OP) — CLOSED / ACCEPTED

- **Commit técnico:** `707a37bd1d2c4728ab2a17433b6441049bd88062` — `Guard controlled delete against document link history` (`js/delete-helpers.js`, `tests/controlled-delete.smoke.js`, `db/53`–`db/56`).
- **Commit documental:** este closeout (`Close controlled delete document history guard`). O HEAD atual deve ser consultado diretamente com `git rev-parse HEAD`.
- **Problema original:** exclusão física controlada de Pedido/OP (`db/34`–`db/37`) violava a FK `document_link_revision_ops_op_id_fkey` ao tentar remover OP ainda referenciada por histórico documental canônico append-only.
- **Causa raiz e correções:** `db/53` adiciona guard documental via wrappers `SECURITY DEFINER` que bloqueiam exclusão física quando há histórico canônico (`document_link_revisions`/`document_link_revision_ops`), renomeando a lógica destrutiva legada para `*_pre53` (inacessível externamente); `db/54` corrige achado de segurança emergencial (`anon_execute = true` nas RPCs públicas), restringindo `EXECUTE` a `authenticated`; `db/55` corrige `to_jsonb(<literal>)` sem cast explícito (`could not determine polymorphic type`) via patch forward-only; `db/56` corrige regressão de `jsonb_set` `STRICT` que colapsava o diagnóstico para `NULL` em alvos elegíveis, usando `COALESCE(to_jsonb(v_reason), 'null'::jsonb)`.
- **Testes locais:** `node --check js/delete-helpers.js` PASS; `tests/controlled-delete.smoke.js` **53/53**; `tests/document-canonical-links-contract.test.js` **21/21**; `git diff --check` PASS.
- **Smokes de staging (`ucrjtfswnfdlxwtmxnoo`, fixtures sintéticas, cleanup zero):** Caso A1 (OP elegível com dependência, sem histórico) — diagnóstico não nulo, remoção concluída; Caso A2 (Pedido elegível com dependência, sem histórico) — diagnóstico não nulo, remoção concluída; Caso B (com histórico documental) — diagnóstico bloqueado, `remover_op`/`remover_pedido` bloqueados de forma controlada, todo o histórico documental preservado sem alteração. `op_numeros` preservado em todos os casos.
- **ACL final (verificada em catálogo ao vivo):** as 4 RPCs públicas — `authenticated`-only (`PUBLIC`/`anon` sem `EXECUTE`); as 4 funções `*_pre53` — `postgres`-only (`PUBLIC`/`anon`/`authenticated` sem `EXECUTE`).
- **Produção:** `bhgifjrfagkzubpyqpew` não acessada. **Push:** não executado.
- **Estado final do worktree:** limpo; staging vazio; zero untracked.
- **Próxima ação autorizável (conforme `PROJECT_STATE.md`):** `ARCHITECT DECISION REQUIRED AFTER BACKLOG RECONCILIATION`.
- **Detalhe completo:** `PROJECT_STATE.md` (seção "Controlled Delete × Histórico Documental") e `docs/ledgers/G28_LEDGER.md` (entrada append-only).

## Admin/Pedido — Resíduo Estático do Botão de Conclusão (Expedição) — CLOSED / ACCEPTED

- **Commit técnico:** `7978e0a4fe021467cc23e0aeed63ac87ba738f1b` — `Fix admin order completion button state` (`js/screens/expedicao-admin.js`, `tests/expedicao-flow.smoke.js`).
- **Commit documental:** este closeout (`Close admin order completion button residue`). O HEAD atual deve ser consultado diretamente com `git rev-parse HEAD`.
- **Problema original:** `js/screens/expedicao-admin.js:405` construía `disabled: ready ? null : 'disabled'`; o helper compartilhado `js/ui.js` `el()` chama `setAttribute(k, v)` para todo atributo sem omitir `null`, materializando `disabled="null"` no DOM real — atributo booleano presente, desabilitando o botão "Concluir pedido" mesmo quando `ready === true`.
- **Causa raiz e correção:** ocorrência única no repositório; correção localizada inteiramente no call site (`buildConclusao`), sem alterar `js/ui.js`. `buttonAttrs` construído como variável antes do `return`; `disabled` só entra no objeto quando `!ready`. `onclick`, texto, estilos e estrutura preservados sem mudança semântica.
- **Testes locais:** `node --check js/screens/expedicao-admin.js` PASS; `tests/expedicao-flow.smoke.js` **9/9**; `tests/expedicao-partial-flow.smoke.js` **12/12**; `git diff --check` PASS.
- **Acessos:** sem staging; sem produção (`bhgifjrfagkzubpyqpew` não acessada); sem push.
- **Estado final do worktree:** limpo; staging vazio; zero untracked.
- **Próxima ação autorizável:** `CLIENTE-ORDER-SUMMARY-READMODEL-APPLY-STAGING-A` — `READY FOR EXPLICIT ARCHITECT AUTHORIZATION` / `NOT STARTED`. Esta entrada não autoriza sua execução.
- **Detalhe completo:** `PROJECT_STATE.md` (seção "Admin/Pedido — Resíduo Estático do Botão de Conclusão") e `docs/ledgers/G28_LEDGER.md` (entrada append-only).

## Portal Cliente — Read Model do Detalhe do Pedido — CLOSED / ACCEPTED_WITH_NONBLOCKING_DEBTS

- **Fase:** `CLIENTE-ORDER-SUMMARY-READMODEL-APPLY-STAGING-A`. **Commit documental:** este closeout (`Close client order summary read model staging validation`). Sem commit técnico — a fase não alterou arquivos (verificação-somente). O HEAD atual deve ser consultado com `git rev-parse HEAD`.
- **Resultado:** `db/30_cliente_pedido_summary_readmodel.sql` **já estava aplicada** em staging (`ucrjtfswnfdlxwtmxnoo`); a função `public.cliente_pedido_summary(uuid)` existe com corpo equivalente byte a byte ao `db/30` (**sem drift**), assinatura/`SECURITY DEFINER`/`STABLE`/`search_path=public`/owner `postgres` conforme contrato; as 16 tabelas de dependência existem.
- **Contrato validado:** RPC real chamada por papel — cliente dono `ok=true` (DTO completo), `anon` `ok=false` **fail-closed** (executa, sem dados), cross-tenant `ok=false`, admin `ok=true`. Todos os campos consumidos por `js/screens/cliente-pedido-detail.js` presentes e tipados; coleções vazias `[]`; nulos tratados; sem dependência de fallback silencioso.
- **Divergências registradas (não normalizadas):** ACL ao vivo concede `EXECUTE` a `PUBLIC`/`anon`/`authenticated`/`service_role` (o `db/30` pretende só `authenticated`); `db/30` não registrada em `supabase_migrations.schema_migrations`.
- **Débitos não bloqueantes:** `ACL_GRANTS_BROADER_THAN_CANONICAL_CONTRACT` (anon fail-closed, sem exposição confirmada); `DB30_NOT_RECORDED_IN_SUPABASE_MIGRATION_HISTORY`; `AUTHENTICATED_BROWSER_SMOKE_NOT_EXECUTED` (sem senha de cliente de teste).
- **Candidato de remediação (não autorizado, não iniciado):** `CLIENTE-ORDER-SUMMARY-READMODEL-ACL-GRANTS-R1` — `ARCHITECT DECISION REQUIRED`; escopo pretendido = migration grants-only análoga ao `db/54` (`REVOKE EXECUTE … FROM PUBLIC, anon`, preservando `authenticated`).
- **Acessos:** Supabase MCP não exposto na sessão; fallback direto PostgreSQL autorizado usado só para verificação (read-only, `BEGIN … ROLLBACK`, zero mutação); tooling temporário fora do repo removido; nenhum segredo ecoado. Produção (`bhgifjrfagkzubpyqpew`) não acessada; sem push.
- **Estado final do worktree:** limpo; staging vazio; zero untracked.
- **Próxima ação autorizável:** `ARCHITECT DECISION REQUIRED AFTER BACKLOG RECONCILIATION` — sem próxima ação única inequívoca; o candidato de remediação de ACL não deve ser autosselecionado.
- **Detalhe completo:** `PROJECT_STATE.md` (seção "Portal Cliente — Read Model do Detalhe do Pedido") e `docs/ledgers/G28_LEDGER.md` (entrada append-only).

## Documentação Canônica — Backfill de Consistência — DOCS-CANONICAL-CONSISTENCY-BACKFILL-A — CLOSED / ACCEPTED

- **Fase:** `DOCS-CANONICAL-CONSISTENCY-BACKFILL-A`. **Commit documental:** este closeout (`Backfill canonical migration documentation`). Docs-only — sem código, teste, SQL, migration, staging ou produção alterados. O HEAD atual deve ser consultado com `git rev-parse HEAD`.
- **Lacunas fechadas:** (1) `db/37_controlled_delete_expedicao_cascade.sql` sem entrada `D-DEL` própria — adicionada `D-DEL14` em `docs/architecture/PEDIDO_OP_SCHEMA_CONTRACT.md` §10; (2) `db/34`–`db/37` e `db/53`–`db/56` ausentes de `docs/DOCUMENTATION_INDEX.md` §4 — 8 linhas adicionadas; (3) status de `db/30` no índice, corrigido de "ainda não aplicado" para aplicada/verificada em staging com ACL mais ampla que o contrato canônico retida como débito explícito.
- **Débitos preservados como abertos (não fechados por este backfill):** `CLIENTE-ORDER-SUMMARY-READMODEL-ACL-GRANTS-R1`; `DB30_NOT_RECORDED_IN_SUPABASE_MIGRATION_HISTORY`; débitos de smoke autenticado (G28-C/D/B7/Portal Cliente); `DEPLOYMENT_MAPPING_AND_PRODUCTION_MIGRATION_PROCEDURE`; `G28-D`; aplicação em produção do stack staging-only; `DELETE-PROD-GUARD-A`; `DELETE-AUDIT-LOG-A`; `G28-CAMADA-2/3/4`.
- **Acessos:** sem staging; sem produção (`bhgifjrfagkzubpyqpew` não acessada); sem push.
- **Estado final do worktree:** limpo; staging vazio; zero untracked.
- **Próxima ação autorizável:** `ARCHITECT DECISION REQUIRED` — `DEPLOYMENT_MAPPING_AND_PRODUCTION_MIGRATION_PROCEDURE`. Este backfill não autoriza nenhuma fase técnica.
- **Detalhe completo:** `PROJECT_STATE.md` (seção "Documentação Canônica — Backfill de Consistência") e `docs/ledgers/G28_LEDGER.md` (entrada append-only).
- **Continuidade documental obrigatória — retransmitir em todo handoff futuro:**
  1. `docs/architecture/PEDIDO_OP_MOVIMENTACAO_DOCUMENTOS_PLANO.md`
  2. `docs/architecture/PEDIDO_PRODUCTION_FLOW_BACKLOG.md`
  3. `docs/architecture/DOCUMENTOS_VALIDACAO_VINCULOS_E_EVOLUCAO_PLANO.md`
  4. `docs/architecture/PEDIDO_OP_SCHEMA_CONTRACT.md`
  5. `PROJECT_STATE.md`
  6. `AGENT_HANDOFF.md`
  7. `docs/ledgers/G28_LEDGER.md`
  8. `docs/DOCUMENTATION_INDEX.md`
  9. `docs/governance/DOCUMENTATION_MODEL.md`
  Todo chat ou agente futuro deve retransmitir estes nove caminhos e instruir expressamente a próxima continuidade a retransmiti-los novamente. A cadeia de continuidade do plano e do backlog não pode ser interrompida.

# HISTÓRICO DE HANDOFFS — ARQUIVADO

O conteúdo histórico completo dos handoffs anteriores foi preservado,
byte a byte, em:

`docs/legacy/pre-model/AGENT_HANDOFF_FULL_SNAPSHOT.md`

Manifesto de integridade:

`docs/legacy/pre-model/MANIFEST.md`

Commit de origem do snapshot:

`08b9af5e251de48e938600e5e4b4214e4d1e824e`

SHA-256 do snapshot completo:

`386810890675714527fc349fa29ddab3fe977dd80c0b270899a7b1a2b3a24b4d`

O snapshot é exclusivamente histórico. Não representa o handoff ativo,
não deve ser editado e não deve receber novos closeouts.

Esta seção não deve acumular novo conteúdo histórico.
