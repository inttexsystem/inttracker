# HANDOFF OPERACIONAL ATIVO

- **Fronteira de execução staging-only vigente (`STAGING-ONLY-EXECUTION-BOUNDARY-A`, 2026-07-15):** decisão explícita do arquiteto — ambiente operacional corrente é exclusivamente staging `ucrjtfswnfdlxwtmxnoo`; o projeto Supabase protegido/outro está fora de escopo; migração/promoção de schema em produção fica postergada até o backlog canônico completo estar concluído; `DEPLOYMENT_MAPPING_AND_PRODUCTION_MIGRATION_PROCEDURE` não é mais bloqueador material corrente, está `DEFERRED UNTIL GLOBAL BACKLOG COMPLETION / NOT A CURRENT STAGING BLOCKER`; G28-D publicação está `DEFERRED / NOT AUTHORIZED / NOT A CURRENT BLOCKER`; Vercel é candidato futuro apenas, sem decisão nem autorização. Ver `PROJECT_STATE.md` ("Decisão de Arquiteto — Fronteira de Execução Staging-Only") e seção própria abaixo.
- **Nenhuma fase funcional ativa.** G28-C está reclassificado (2026-07-15, `G28-RECONCILIATION-DECISIONS-A`) como `CLOSED / TECHNICALLY ACCEPTED — ARCHITECT PRODUCT VALIDATION PENDING` — ver `PROJECT_STATE.md`. G28-D discovery permanece `RELEASE CONTRACT DISCOVERY COMPLETE` (evidência preservada); sua publicação está `DEFERRED BY ARCHITECT / NOT A CURRENT BLOCKER / NOT AUTHORIZED` e não constitui fase ativa. A definição canônica do mapeamento de publicação e do procedimento autorizado para migrations 51/52 continua ausente do repositório, mas isso deixou de ser um bloqueio corrente por decisão explícita; ver `docs/releases/G28_D_RELEASE_CANDIDATE.md`.
- **Última fase aceita:** `G28-CAMADA-2 / A5.1-A5.2 — Reset de Senha Administrativo — CLOSED / ACCEPTED` (2026-07-16; e2e real em staging `result: PASS` 15/15; validação visual do arquiteto dispensada por decisão explícita, coberta por e2e + verificação de fluxo em navegador real pelo executor; ver seção própria abaixo e `PROJECT_STATE.md`). `A4.2` (guarda de troca de senha obrigatória) e `CAMADA2-LAST-ACCESS-UI` (consumo da RPC `db/59` na UI, commit `0aff22f`) também `CLOSED / ACCEPTED` (2026-07-16). **Nenhum débito de closeout documental pendente entre essas três fases.** `CLIENTE-ORDER-SUMMARY-READMODEL-ACL-GRANTS-R1` permanece `CLOSED / ACCEPTED` (2026-07-15). `G28-C` permanece a última fase funcional do G28 propriamente dito, agora `CLOSED / TECHNICALLY ACCEPTED — ARCHITECT PRODUCT VALIDATION PENDING` (reclassificação `G28-RECONCILIATION-DECISIONS-A`, 2026-07-15; matriz staging/projeções 16/16 PASS técnico; closeout histórico `a7d7caa`/aceite `d5ec09f` não reescrito; débito explícito `AUTHENTICATED_BROWSER_SMOKE_NOT_EXECUTED`). G28-B8 está `TECHNICALLY COMPLETED / ACCEPTANCE SUBSUMED BY G28-C`.
- **Commits R1 concluídos:** `271761c3de20427b2cc9059d5ff7cc3727545e6d` — `G28: reconcile canonical phase state` (closeout documental inicial R1); `edaf0b4d36f24aa7b9490e51a42624cc70d45963` — `G28: correct canonical reconciliation state` (correção de defeitos textuais do R1). O HEAD atual deve ser consultado diretamente com `git rev-parse HEAD`.
- **Critério de publicação (`G28-GOVERNANCE-CONSOLIDATION-A`, 2026-07-15):** decisão vinculante do arquiteto — o sistema só entra em produção após `G28-CAMADA-2` (escopo pleno `A1-A7`) e `G28-CAMADA-3` (backup automático) estarem ambas `CLOSED / ACCEPTED` em staging. `PUBLICATION-TRACK-REVIEW` é frente condicionada a esse critério, não candidata corrente. `G28-CAMADA-3` passa de diferida a `CAMINHO CRÍTICO DE PUBLICAÇÃO` (após Camada 2), pendente de spec própria (diagnóstico `BK1-BK8` é fase futura, `NOT AUTHORIZED`). Frente candidata `CODE-HEALTH-AUDIT-§18-R1` (auditoria read-only §18, insumo para decomposição de `cadastros.js`) também registrada `NOT AUTHORIZED`. Ver `PROJECT_STATE.md` (seção própria) e seção abaixo.
- **Próxima ação:** `CLIENTE-ORDER-SUMMARY-READMODEL-ACL-GRANTS-R1` foi implementada, aplicada e verificada em staging — **não deve ser roteada novamente** como próxima ação; está `CLOSED / ACCEPTED`. A reconciliação read-only do backlog geral (`BACKLOG-RECONCILIATION-READONLY-R1`), o backfill documental `DOCS-CANONICAL-CONSISTENCY-BACKFILL-A` e o registro da fronteira `STAGING-ONLY-EXECUTION-BOUNDARY-A` também já foram concluídos. **Próxima frente selecionada:** `G28-CAMADA-2`. A spec proposta foi materializada em `docs/architecture/CAMADA2_USUARIOS_SPEC_PROPOSED.md` (`CAMADA2-USUARIOS-SPEC-MATERIALIZE-R1`). `A3.1` (extração 1:1 da tela de usuários), `A3.2` (cards-resumo + toolbar), `A4.1` + `CAMADA2-LAST-ACCESS-RPC`, `CAMADA2-LAST-ACCESS-UI`, `A4.2` (guarda de troca de senha obrigatória) e `A5.1-A5.2` (reset de senha administrativo) estão todas `CLOSED / ACCEPTED` — ver seções próprias abaixo. **Nenhuma dessas deve ser roteada novamente como próxima ação.** `A5.3-A5.4` (reativação) explicitamente **não incluída** em `A5.1-A5.2` — autorização própria futura. **Próxima ação autorizável (2026-07-16): `ARCHITECT DECISION`** entre `A5.3-A5.4` (reativação), `UI-EL-BOOLEAN-ATTR-FIX` (candidato `NOT AUTHORIZED`, severidade `NÃO CONFIRMADA` — potencial bug de `setAttribute` boolean em `js/ui.js`'s `el()` afetando os botões Desativar/Excluir de `admin-usuarios.js`, pendente de verificação direta do arquiteto em staging), `A2.1` (schema `nivel_acesso`) e `A6.1` (schema/trigger de auditoria). Nenhuma subfase autorizada por este registro. O protocolo de supervisão do projeto está formalizado em `docs/governance/SUPERVISION_PROTOCOL.md` (papéis Arquiteto/Parecerista/Executor Residente). Higiene do worktree `work/app-next` (divergente/sujo) permanece autorizada como tarefa paralela read-only em ordem separada. `OPEN_ARCHITECT_DECISIONS: NONE` para o ciclo atual de staging. Débitos remanescentes do Portal Cliente ficam explícitos: `DB30_NOT_RECORDED_IN_SUPABASE_MIGRATION_HISTORY` e `AUTHENTICATED_BROWSER_SMOKE_NOT_EXECUTED`. Débitos de baseline/decomposição registrados: 6 testes de `tests/auth.smoke.js` com regex desatualizado (`A4.2`) e `js/screens/admin-usuarios-modal.js` a 576 linhas (`A5.1-A5.2`), ambos candidatos a `CODE-HEALTH-AUDIT-§18-R1`. Publicação não é a próxima ação e nenhuma implementação automática se segue.
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

## Decisão de Arquiteto — Fronteira de Execução Staging-Only — STAGING-ONLY-EXECUTION-BOUNDARY-A

- **Fase:** `STAGING-ONLY-EXECUTION-BOUNDARY-A`. **Commit documental:** este registro (`Record staging-only execution boundary`). Docs-only — sem código, teste, SQL, migration, Supabase, staging, produção ou Vercel acessados/alterados. O HEAD atual deve ser consultado com `git rev-parse HEAD`.
- **Decisão vinculante registrada:** ambiente operacional corrente é exclusivamente staging `ucrjtfswnfdlxwtmxnoo`; o projeto Supabase protegido/outro está fora de escopo; migração/promoção de schema em produção postergada até o backlog canônico completo estar concluído; mapeamento de publicação em produção não é exigido para o trabalho atual em staging; publicação de G28-D permanece postergada, não autorizada e não constitui bloqueio corrente; provedor de publicação (incl. Vercel) não selecionado — candidato futuro apenas.
- **Reclassificação:** `DEPLOYMENT_MAPPING_AND_PRODUCTION_MIGRATION_PROCEDURE` deixa de ser registrada como bloqueador material corrente ou próxima decisão de arquiteto exigida; passa a `DEFERRED BY ARCHITECT UNTIL GLOBAL BACKLOG COMPLETION / NOT A CURRENT STAGING BLOCKER / NOT STARTED`. Não foi descoberta, definida, testada ou concluída — apenas postergada intencionalmente. Evidência de descoberta preservada, não reescrita, em `docs/releases/G28_D_RELEASE_CANDIDATE.md`.
- **Próximo candidato técnico:** `CLIENTE-ORDER-SUMMARY-READMODEL-ACL-GRANTS-R1` foi autorizado, implementado, aplicado e verificado em staging em 2026-07-15 (`CLOSED / ACCEPTED` — ver seção própria abaixo). Não há candidato técnico único subsequente; `NEXT_AUTHORIZABLE_ACTION: NONE`.
- **Acessos:** nenhum acesso Supabase/MCP/staging/produção/Vercel nesta fase; sem push.
- **Estado final do worktree:** limpo; staging vazio; zero untracked.
- **Detalhe completo:** `PROJECT_STATE.md` (seção "Decisão de Arquiteto — Fronteira de Execução Staging-Only") e `docs/ledgers/G28_LEDGER.md` (entrada append-only).
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

## Decisão de Arquiteto — Reconciliação de Backlog e Governança de Supervisão — G28-RECONCILIATION-DECISIONS-A

- **Fase:** `G28-RECONCILIATION-DECISIONS-A`. **Commit documental:** este registro (`Record architect reconciliation decisions`). Docs-only — sem código, teste, SQL, migration, Supabase, staging, produção ou Vercel acessados/alterados. O HEAD atual deve ser consultado com `git rev-parse HEAD`.
- **Baseline read-only que fundamenta esta decisão:** `BACKLOG-RECONCILIATION-READONLY-R1` (`docs/reports/BACKLOG_RECONCILIATION_R1_2026-07-15.md`), executado após leitura dos 9 caminhos canônicos + closeout do ChatGPT (`docs/handoffs/CHATGPT_CLOSEOUT_2026-07-15.md`).
- **`PROJECT-CONTROL-BASELINE-R1` (ChatGPT):** `REJECTED / NOT RATIFIED` — classificação materialmente incorreta da Camada 2 (tratou capacidade parcial como implementação aceita). Artefato externo, nunca canônico. Sua correção proposta (`PROJECT-CONTROL-BASELINE-R1-CORRECTION`) está `CANCELLED / ABSORBED / SUPERSEDED` pelo diagnóstico `BACKLOG-RECONCILIATION-READONLY-R1`, adotado como baseline de referência corrente.
- **G28-CAMADA-2 reclassificada:** `CAPACIDADE PARCIAL PREEXISTENTE` (CRUD de usuários, desativação/ban via Edge Functions, papel único `usuarios.tipo`, vínculo cliente/fornecedor — subproduto de `AUTH-DISABLE-USER` e do Portal Cliente) `+ ESCOPO PLENO A1-A7 DIFERIDO` (reset/recuperação de senha, convites, matriz de papéis/permissões, auditoria completa, política de senha plena, reativação — nenhum destes encontrado no código real). Não aceita como fase dedicada; nenhuma implementação autorizada por este registro. Referência funcional/visual para o escopo pleno, quando autorizado: `D:\OneDrive\Programação\SGAA_clean_baseline`.
- **G28-C reclassificado no estado vigente:** `CLOSED / TECHNICALLY ACCEPTED — ARCHITECT PRODUCT VALIDATION PENDING`, separando aceite técnico/staging (matriz 16/16, migrations aplicadas/verificadas) de validação funcional/pessoal do arquiteto (não registrada) e do smoke autenticado de browser (`AUTHENTICATED_BROWSER_SMOKE_NOT_EXECUTED`, nunca executado). O closeout histórico (`a7d7caa`/aceite `d5ec09f`) **não é reescrito**; esta é uma entrada nova e vinculada no ledger G28.
- **Governança de supervisão:** acompanhamento de progresso, continuidade, escopo, autorizações, fases e documentação passam para Claude (chat) e Claude Code (residente). O ChatGPT permanece disponível como consultor de processo, **sem custódia de estado e sem autoridade para emitir ordens**.
- **Próxima frente selecionada:** `G28-CAMADA-2`, iniciando por diagnóstico read-only comparativo em ordem própria subsequente — **não autorizado por este registro**.
- **Tarefa paralela autorizada:** higiene do worktree `work/app-next` (11 commits atrás de `staging/work/app-next`, worktree sujo) — **read-only**, ordem separada.
- **Acessos:** nenhum acesso Supabase/MCP/staging/produção/Vercel nesta fase; sem push.
- **Estado final do worktree:** limpo; staging vazio; zero untracked.
- **Detalhe completo:** `PROJECT_STATE.md` (seção "Decisão de Arquiteto — Reconciliação de Backlog e Governança de Supervisão") e `docs/ledgers/G28_LEDGER.md` (entrada append-only).
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

## Camada 2 — Administração de Usuários — Spec Proposta — CAMADA2-USUARIOS-SPEC-MATERIALIZE-R1

- **Fase:** `CAMADA2-USUARIOS-SPEC-MATERIALIZE-R1`. **Commit documental:** este registro (`Add Camada 2 user administration spec`). Docs-only — sem código, teste, SQL, migration, Supabase, staging, produção ou Vercel acessados/alterados. **Status: `PROPOSED`.** O HEAD atual deve ser consultado com `git rev-parse HEAD`.
- **Documento criado:** `docs/architecture/CAMADA2_USUARIOS_SPEC_PROPOSED.md`. Leitura obrigatória antes de rotear qualquer ordem sobre `G28-CAMADA-2`.
- **Conteúdo:** `A1-A7` + política de senha, cada item com evidência file:line do que o SGAA_clean_baseline faz (referência externa read-only), o que já existe no Tapetes, o que falta, proposta adaptada, módulos/arquivos previstos, risco de Auth e subfase/gate. Inclui plano de módulos consolidado, tabela de risco Auth e ordem de subfases.
- **Decisões do arquiteto já incorporadas (não reabrir sem nova decisão):** `nivel_acesso` 2 níveis (`completo`/`somente_leitura`); tabela de overrides de permissões não construída; A4 = senha-temporária-com-troca-forçada apenas, e-mail/SMTP `NOT AUTHORIZED`; bulk actions (A3.3) `DEFERRED`; revogação explícita de sessão fora de escopo.
- **Próxima ação autorizável:** `A3.1` foi autorizada, executada e aceita — ver seção "Camada 2 — Extração da Tela de Usuários" abaixo. Próxima subfase é `A3.2`, sob gate de mockup.
- **Acessos:** nenhum acesso Supabase/MCP/staging/produção/Vercel; leitura estritamente read-only de `D:\OneDrive\Programação\SGAA_clean_baseline` (projeto externo não relacionado, nenhum arquivo tocado); sem push.
- **Estado final do worktree:** limpo; staging vazio; zero untracked.
- **Detalhe completo:** `PROJECT_STATE.md` (seção "Camada 2 — Administração de Usuários — Spec Proposta") e `docs/ledgers/G28_LEDGER.md` (entrada append-only).
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
  Todo chat ou agente futuro deve retransmitir estes nove caminhos e instruir expressamente a próxima continuidade a retransmiti-los novamente. A cadeia de continuidade do plano e do backlog não pode ser interrompida. Para trabalho em `G28-CAMADA-2` especificamente, adicionar `docs/architecture/CAMADA2_USUARIOS_SPEC_PROPOSED.md` como décimo caminho obrigatório.

## Camada 2 — Extração da Tela de Usuários — CAMADA2-USUARIOS-A3-1 — CLOSED / ACCEPTED

- **Commit técnico:** `4f01101143a512c8018d58ce9e523064c38a145f` — `Extract user administration screen modules` (`js/admin-usuarios-writes.js`, `js/screens/admin-usuarios-modal.js`, `js/screens/admin-usuarios.js`, `index.html`, `js/boot.js`, `tests/admin-usuarios.smoke.js`, `tests/boot.smoke.js`, `tests/cadastros-screens.smoke.js`).
- **Commit documental:** este closeout (`Close Camada 2 user administration screen extraction`). O HEAD atual deve ser consultado com `git rev-parse HEAD`.
- **Escopo:** refactor puro — extração 1:1 de `screenCadastrosUsuarios` (`js/screens/cadastros.js:2226-2713`) para 3 módulos próprios, sem feature nova, sem mudança de comportamento. Cutover de rota antecipado (ajuste de revisão da spec): `js/boot.js` recableado para `window.screenAdminUsuarios`; `index.html` com os 3 scripts novos.
- **Acoplamento resolvido:** helpers de formulário de `cadastros.js` (IIFE, não expostos em `window.*`) duplicados localmente em `admin-usuarios-modal.js` — comportamento idêntico, sem tocar `cadastros.js`.
- **Decisão de escopo:** função `render()` original (código morto, nunca chamada) não portada — sem impacto observável.
- **Não alterado:** `cadastros.js`, `js/ui.js`, `js/auth.js` intocados. `screenCadastrosUsuarios` permanece em `cadastros.js` até remoção isolada em `A3.4`.
- **Testes:** `admin-usuarios.smoke.js` (novo) 13/13; `boot.smoke.js` 32/32; `cadastros-screens.smoke.js` 32/32; regressão ampla de 28 suítes: 1207/1296, idêntico ao baseline (`git stash` comparado). `git diff --check` limpo.
- **Validação visual:** confirmada pelo arquiteto na rota `#/cadastros/usuarios`, app local (`http://localhost:8765`) apontando para staging `ucrjtfswnfdlxwtmxnoo` — paridade 1:1 aceita.
- **Produção:** `bhgifjrfagkzubpyqpew` não acessada. **Push:** não executado.
- **Estado final do worktree:** limpo; staging vazio; zero untracked.
- **Próxima ação autorizável:** `A3.2` foi autorizada e concluída — ver seção própria abaixo.
- **Detalhe completo:** `PROJECT_STATE.md` (seção "Camada 2 — Extração da Tela de Usuários"), `docs/refactor/ARCHITECTURE_REFACTOR_LEDGER.md` (§4/§6) e `docs/ledgers/G28_LEDGER.md` (entrada append-only).
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
  10. `docs/architecture/CAMADA2_USUARIOS_SPEC_PROPOSED.md` (trabalho em `G28-CAMADA-2`)
  Todo chat ou agente futuro deve retransmitir estes dez caminhos e instruir expressamente a próxima continuidade a retransmiti-los novamente. A cadeia de continuidade do plano e do backlog não pode ser interrompida.

## Camada 2 — Cards-resumo e Toolbar — CAMADA2-USUARIOS-A3-2 — CLOSED / ACCEPTED

- **Commits técnicos:** `b4a6238c34afb683ec7a973d230330b7266c99f2` — `Add user admin summary cards and toolbar`; `3198570c04b08bef83605f64bc9ae1c5ece8b873` — `Align summary card background with dashboard`.
- **Commit documental:** este closeout (`Close user admin summary cards phase`). O HEAD atual deve ser consultado com `git rev-parse HEAD`.
- **Escopo:** feature aditiva de UI sobre `js/screens/admin-usuarios.js` (extraído em `A3.1`) — cards-resumo (4, KPI), toolbar (busca+ordenar+filtro tipo+toggle), badge de papel colorido, opacidade de linha inativa. Gate de mockup satisfeito (aprovado pelo arquiteto em 2026-07-15); valores finais em `docs/design/CAMADA2_A32_MOCKUP_APPROVED.md`.
- **Item 4 bloqueado (HARD STOP confirmado, não implementado):** coluna "Último acesso" exige leitura de `auth.users.last_sign_in_at`, inexistente hoje (zero RPC/view expõe isso). **Decisão do arquiteto: RPC `SECURITY DEFINER` admin-only, padrão `is_admin()`.** Registrada `CAMADA2-LAST-ACCESS-RPC` — `NOT AUTHORIZED`, candidata a agrupar com a migration de `A4.1`.
- **Ajuste pós-validação:** fundo dos cards padrão `#f4f6f9` → `#fff` (mesmo tom de `.rv-adm-card` em `js/screens/painel.js`); card Inativos mantém `#fff8f8`.
- **Não alterado:** `index.html` (nenhum script novo); `js/admin-usuarios-writes.js`; `js/screens/admin-usuarios-modal.js`; `cadastros.js`; `js/ui.js`; `js/auth.js`. `docs/refactor/ARCHITECTURE_REFACTOR_LEDGER.md` não recebeu entrada (nenhum módulo novo/mudança de rota).
- **Testes:** `admin-usuarios.smoke.js` 20/20 (7 novos); `boot.smoke.js` + `cadastros-screens.smoke.js` 64/64 (sem regressão); `git diff --check` limpo.
- **Validação visual:** confirmada pelo arquiteto na rota `#/cadastros/usuarios`, app local (`http://localhost:8765`) apontando para staging `ucrjtfswnfdlxwtmxnoo`, incluindo o ajuste de fundo.
- **Produção:** `bhgifjrfagkzubpyqpew` não acessada. **Push:** não executado.
- **Estado final do worktree:** limpo; staging vazio; zero untracked.
- **Governança:** protocolo de supervisão formalizado em `docs/governance/SUPERVISION_PROTOCOL.md` nesta fase (papéis Arquiteto/Parecerista/Executor Residente, onboarding, formato de ordem, gates).
- **Próxima ação autorizável:** `ARCHITECT DECISION REQUIRED` entre `A4.1`, `A2.1`, `A6.1` (ver seção acima). `A3.3` `DEFERRED`. `A3.4` depende das demais subfases A3.x. Esta entrada não autoriza sua execução.
- **Detalhe completo:** `PROJECT_STATE.md` (seção "Camada 2 — Cards-resumo e Toolbar") e `docs/ledgers/G28_LEDGER.md` (entrada append-only).
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
  10. `docs/architecture/CAMADA2_USUARIOS_SPEC_PROPOSED.md` (trabalho em `G28-CAMADA-2`)
  Todo chat ou agente futuro deve retransmitir estes dez caminhos e instruir expressamente a próxima continuidade a retransmiti-los novamente. A cadeia de continuidade do plano e do backlog não pode ser interrompida.

## Portal Cliente — ACL Grants Hardening — CLIENTE-ORDER-SUMMARY-READMODEL-ACL-GRANTS-R1 — CLOSED / ACCEPTED

- **Commit técnico:** `82f5ba70ace2e74c51b7c0295d1ecf8e319954be` — `Restrict client order summary RPC grants` (`db/57_cliente_pedido_summary_acl_grants.sql`, `tests/cliente-pedido-summary-acl-grants.smoke.js`). **Commit documental:** este closeout (`Close client order summary RPC grant hardening`). O HEAD atual deve ser consultado diretamente com `git rev-parse HEAD`.
- **Problema original:** ACL ao vivo de `public.cliente_pedido_summary(uuid)` em staging concedia `EXECUTE` também a `PUBLIC`, `anon` e `service_role`, além de `authenticated`, divergindo do contrato canônico `D-COS02` (`authenticated`-only).
- **Correção:** `db/57` grants-only, forward-only, idempotente, restrita à assinatura exata da função — `REVOKE EXECUTE ... FROM PUBLIC, anon, service_role; GRANT EXECUTE ... TO authenticated`. Aplicada exatamente uma vez via Supabase MCP (operação de migration rastreada) em staging `ucrjtfswnfdlxwtmxnoo`; registro `20260715190627 / 57_cliente_pedido_summary_acl_grants` confirmado.
- **ACL final:** `PUBLIC` sem `EXECUTE`; `anon` sem `EXECUTE`; `authenticated` com `EXECUTE`; `service_role` sem `EXECUTE` explícito. Owner `postgres` retém privilégio inerente.
- **Contrato da função inalterado:** assinatura, retorno `jsonb`, `SECURITY DEFINER`, `STABLE`, `search_path=public`, owner `postgres`, corpo — hash de definição idêntico antes/depois.
- **Matriz empírica (staging, read-only, `BEGIN … ROLLBACK`, sem fixtures):** `anon` → `ERROR 42501: permission denied` no limite de ACL antes da execução; `authenticated` dono → `ok=true` DTO completo; `authenticated` cross-tenant → `ok=false` fail-closed sem dados de terceiros; `authenticated` admin → `ok=true` DTO completo; `service_role` via `SET ROLE` direto → `ERROR 42501` (grant de objeto revogado com sucesso; `rolbypassrls` é mecanismo de RLS distinto, não restaura `EXECUTE`).
- **Frontend:** `js/screens/cliente-pedido-detail.js` permanece único consumidor real (caminho autenticado padrão); nenhuma alteração necessária.
- **Testes locais:** `tests/cliente-pedido-summary-acl-grants.smoke.js` (novo) + `tests/cliente-pedido-summary-readmodel.smoke.js` (existente) — **21/21 PASS**; `git diff --check` limpo.
- **Débito fechado:** `ACL_GRANTS_BROADER_THAN_CANONICAL_CONTRACT` — `RESOLVED IN STAGING`.
- **Débitos preservados como abertos:** `DB30_NOT_RECORDED_IN_SUPABASE_MIGRATION_HISTORY` (nenhum registro de histórico fabricado para `db/30`); `AUTHENTICATED_BROWSER_SMOKE_NOT_EXECUTED`; aplicação em produção do stack staging-only (incl. `db/57`) permanece postergada por `STAGING-ONLY-EXECUTION-BOUNDARY-A`.
- **Acessos:** Supabase MCP conectado e usado somente para leitura de catálogo e a aplicação rastreada da migration em staging `ucrjtfswnfdlxwtmxnoo`; produção (`bhgifjrfagkzubpyqpew`) não acessada; Vercel não acessado; sem push.
- **Estado final do worktree:** limpo; staging vazio; zero untracked.
- **Próxima ação autorizável:** `ARCHITECT DECISION REQUIRED AFTER BACKLOG RECONCILIATION` — `NEXT_AUTHORIZABLE_ACTION: NONE` até nova reconciliação do backlog geral remanescente.
- **Detalhe completo:** `PROJECT_STATE.md` (seção "Portal Cliente — ACL Grants Hardening") e `docs/ledgers/G28_LEDGER.md` (entrada append-only).
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

## Documentação Canônica — Consistência de Status dos Planos Legados Pedido↔OP — DOCS-PEDIDO-OP-LEGACY-PLAN-STATUS-CONSISTENCY-R1 — CLOSED / ACCEPTED

- **Fase:** `DOCS-PEDIDO-OP-LEGACY-PLAN-STATUS-CONSISTENCY-R1`. **Commit documental:** este closeout (`Reconcile legacy Pedido OP plan phase statuses`). Docs-only — sem código, runtime, teste, SQL, migration, Supabase, MCP, staging, produção ou Vercel acessados/alterados. O HEAD atual deve ser consultado com `git rev-parse HEAD`.
- **Correção:** as linhas de status correntes das Fases legadas D–J foram reconciliadas em `docs/architecture/PEDIDO_OP_SCHEMA_CONTRACT.md` §9 e `docs/architecture/PEDIDO_OP_MOVIMENTACAO_DOCUMENTOS_PLANO.md` §5.
- **Roteamento obrigatório para o próximo agente:** as Fases legadas **D, E, F** foram **entregues** através do trabalho de fluxo produtivo aceito e **não** devem ser roteadas como fases de implementação abertas. As Fases legadas **G, H, I** foram **superadas** pela pipeline documental canônica G28 (`document_link_revisions`/`document_link_revision_ops`; `documentos_operacionais` nunca criada) e também **não** devem ser roteadas como fases abertas. A **Fase J** permanece exclusivamente como `FUTURE / UNSEQUENCED / NOT STARTED / NOT AUTHORIZED`.
- **Estado inalterado:** `ACTIVE_PHASE: NONE`; `NEXT_AUTHORIZABLE_ACTION: NONE` pendente de seleção explícita de arquiteto. Todos os débitos abertos e frentes deferidas permanecem inalterados (`DB30_NOT_RECORDED_IN_SUPABASE_MIGRATION_HISTORY`, `AUTHENTICATED_BROWSER_SMOKE_NOT_EXECUTED`, aplicação em produção do stack staging-only, `DEPLOYMENT_MAPPING_AND_PRODUCTION_MIGRATION_PROCEDURE`, G28-D/Vercel, `DELETE-PROD-GUARD-A`, `DELETE-AUDIT-LOG-A`, `G28-CAMADA-2/3/4`).
- **Acessos:** sem staging; sem produção (`bhgifjrfagkzubpyqpew` não acessada); sem Supabase/MCP; sem Vercel; sem push.
- **Detalhe completo:** `PROJECT_STATE.md` (seção "Documentação Canônica — Consistência de Status dos Planos Legados Pedido↔OP") e `docs/ledgers/G28_LEDGER.md` (entrada append-only).
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

## Decisão de Arquiteto — Critério de Publicação e Frentes Candidatas — G28-GOVERNANCE-CONSOLIDATION-A — CLOSED / ACCEPTED

- **Fase:** `G28-GOVERNANCE-CONSOLIDATION-A`. **Commit documental:** este registro (`Consolidate supervision protocol and register publication criteria`). Docs-only — sem código, teste, SQL, migration, Supabase, staging, produção ou Vercel acessados/alterados. O HEAD atual deve ser consultado com `git rev-parse HEAD`.
- **Protocolo de supervisão:** `docs/governance/SUPERVISION_PROTOCOL.md` recebeu apêndice "Handoff de supervisão — bloco padrão" (texto verbatim do arquiteto, para abrir qualquer sessão nova de parecerista/supervisor) e passou a exigir seção `STRUCTURAL POLICY COMPLIANCE` no formato de relatório de toda fase de implementação (regras aplicáveis de `docs/architecture/CODE_HEALTH_RULES.md` citadas + evidência + tamanho em linhas dos arquivos tocados).
- **Frentes candidatas registradas em `PROJECT_STATE.md`:** `CODE-HEALTH-AUDIT-§18-R1` (auditoria read-only pós-Camada 2, §18 de `CODE_HEALTH_RULES.md`, insumo para decomposição incremental de `cadastros.js` e triagem de débitos de teste) — `NOT AUTHORIZED`; `PUBLICATION-TRACK-REVIEW` (fronteira staging-only + `DEPLOYMENT_MAPPING_AND_PRODUCTION_MIGRATION_PROCEDURE` + G28-D + aplicação em produção das migrations staging-only + `DELETE-PROD-GUARD-A`) — `NOT AUTHORIZED / CONDITIONED`.
- **Decisão vinculante do arquiteto — critério de publicação (2026-07-15):** o sistema só entra em produção após `G28-CAMADA-2` (escopo pleno `A1-A7`) e `G28-CAMADA-3` (backup automático) estarem ambas `CLOSED / ACCEPTED` em staging. `PUBLICATION-TRACK-REVIEW` fica condicionada a esse critério, não é candidata corrente mesmo após reconciliação do backlog geral. Fronteira `STAGING-ONLY-EXECUTION-BOUNDARY-A` permanece vigente sem alteração.
- **Consequência registrada:** `G28-CAMADA-3` passa de frente diferida a `CAMINHO CRÍTICO DE PUBLICAÇÃO` (após `G28-CAMADA-2`), pendente de spec própria; diagnóstico `BK1-BK8` é fase futura, `NOT AUTHORIZED` por este registro.
- **Não alterado:** nenhum código, teste, SQL, migration, runtime tocado; nenhuma subfase de `G28-CAMADA-2`/`G28-CAMADA-3` autorizada; `STAGING-ONLY-EXECUTION-BOUNDARY-A` não reescrita, apenas referenciada como inalterada.
- **Acessos:** sem staging; sem produção (`bhgifjrfagkzubpyqpew` não acessada); sem Supabase/MCP; sem Vercel; sem push.
- **Estado final do worktree:** limpo; staging seletiva por caminho literal; zero untracked após o commit.
- **Próxima ação autorizável:** inalterada — `ARCHITECT DECISION REQUIRED AFTER BACKLOG RECONCILIATION` entre `A4.1`, `A2.1`, `A6.1` de `G28-CAMADA-2` (ver seções próprias acima). Este registro não autoriza nenhuma subfase.
- **Detalhe completo:** `PROJECT_STATE.md` (seção "Decisão de Arquiteto — Critério de Publicação e Frentes Candidatas") e `docs/ledgers/G28_LEDGER.md` (entrada append-only).
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
  10. `docs/architecture/CAMADA2_USUARIOS_SPEC_PROPOSED.md` (trabalho em `G28-CAMADA-2`)
  11. `docs/governance/SUPERVISION_PROTOCOL.md` (formato de ordem, gates, bloco padrão de handoff de supervisão)
  Todo chat ou agente futuro deve retransmitir estes onze caminhos e instruir expressamente a próxima continuidade a retransmiti-los novamente. A cadeia de continuidade do plano e do backlog não pode ser interrompida.

## Camada 2 — Senha Temporária e Read Model de Último Acesso — A4.1 + CAMADA2-LAST-ACCESS-RPC — CLOSED / ACCEPTED

- **Commits técnicos:** `bf0d522` — `Add temporary password schema and last sign-in read model` (`db/58_admin_usuarios_senha_temporaria.sql`, `db/59_admin_last_sign_in_readmodel.sql`, `supabase/functions/admin-create-user/index.ts`, `supabase/functions/admin-create-user/README.md`, 4 smoke tests novos/estendidos); `c6289f8` — `Add password-policy E2E verification runner for admin-create-user` (`scripts/staging/admin-create-user-password-policy-e2e.mjs`, `docs/DOCUMENTATION_INDEX.md`).
- **Commit documental:** este closeout (`Close temporary password schema phase`). O HEAD atual deve ser consultado com `git rev-parse HEAD`.
- **Schema/RPC aplicados e verificados em staging (`ucrjtfswnfdlxwtmxnoo`), via Supabase MCP:** `db/58` (registro `20260716014338`) adiciona `usuarios.senha_temporaria`/`usuarios.senha_gerada_em`, sem efeito retroativo nos 10 usuários existentes; `db/59` (registro `20260716014358`) cria `public.admin_usuarios_last_sign_in()` — `SECURITY DEFINER`/`STABLE`, guarda `is_admin()`, expõe só `id`+`last_sign_in_at`, grants `authenticated`-only. Matriz de papéis empírica confirmada: `anon` → `42501` (ACL); `authenticated` não-admin → `42501` (negócio, `RAISE EXCEPTION`); admin → `ok`.
- **Edge Function `admin-create-user`:** política de senha 6→8 caracteres + ≥1 dígito; insert passa a setar `senha_temporaria=true`/`senha_gerada_em=now()`.
- **Deploy em staging executado pelo arquiteto** (fora do alcance de credenciais desta sessão — o agente IA não entra senha/token/API key em nenhum campo, regra permanente e não contornável por autorização).
- **Verificação pós-deploy — E2E real em staging, `result: PASS` (9/9), executado pelo arquiteto** via `scripts/staging/admin-create-user-password-policy-e2e.mjs`: 7 chars rejeitado (comprimento); 8 chars sem dígito rejeitado (dígito); senha válida aceita com `senha_temporaria=true`/`senha_gerada_em` preenchido confirmados via REST; cleanup via `admin-delete-user` com cleanup zero confirmado.
- **Testes locais:** 4 smoke suites novas/estendidas somando 71/71 (schema db/58, RPC db/59, política de senha de `admin-create-user`, allow-list de `db/` estendida); regressão `tests/admin-*.smoke.js` + `boot.smoke.js` 263/263 sem regressão. `git diff --check` limpo.
- **Documentação corrigida:** `docs/operations/AUTH_USER_PROVISIONING_RUNBOOK.md` (política de senha desatualizada → 8+dígito, nota sobre `senha_temporaria`/troca obrigatória futura em `A4.2`); `docs/DOCUMENTATION_INDEX.md` (entradas de `db/58`/`db/59` + classificação do runner E2E como tooling de verificação, mesmo tratamento do `admin-disable-user-e2e.mjs`).
- **Não implementado (fora de escopo):** consumo da RPC na UI (coluna "Último acesso"); `A4.2` (guarda de boot + tela de troca obrigatória); `A4.3` (`NOT AUTHORIZED`).
- **Acessos:** Supabase MCP usado para aplicar/verificar as duas migrations em staging; produção (`bhgifjrfagkzubpyqpew`) não acessada; sem push.
- **Estado final do worktree:** limpo; staging vazio; zero untracked (`supabase/.temp/` é cache local não rastreado da CLI do Supabase, gerado pela ação do arquiteto).
- **Próxima ação autorizável:** `ARCHITECT DECISION` — candidatas: micro-fase de consumo da RPC `db/59` na UI (coluna "Último acesso" em `js/screens/admin-usuarios.js`, sob gate de mockup se envolver elemento visual novo); `A4.2` (guarda de boot + tela de troca obrigatória, gate visual); `A2.1`/`A6.1` de `G28-CAMADA-2` seguem candidatas remanescentes sem prioridade inequívoca. Esta entrada não autoriza sua execução.
- **Detalhe completo:** `PROJECT_STATE.md` (seção "Camada 2 — Senha Temporária e Read Model de Último Acesso") e `docs/ledgers/G28_LEDGER.md` (entrada append-only).
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
  10. `docs/architecture/CAMADA2_USUARIOS_SPEC_PROPOSED.md` (trabalho em `G28-CAMADA-2`)
  11. `docs/governance/SUPERVISION_PROTOCOL.md` (formato de ordem, gates, bloco padrão de handoff de supervisão)
  Todo chat ou agente futuro deve retransmitir estes onze caminhos e instruir expressamente a próxima continuidade a retransmiti-los novamente. A cadeia de continuidade do plano e do backlog não pode ser interrompida.

## Camada 2 — Guarda de Troca de Senha Obrigatória — A4.2 — CLOSED / ACCEPTED

- **Commit técnico:** `6c624ef` — `Add mandatory password change gate` (`js/auth.js`, `js/boot.js`, `js/trocar-senha-writes.js` (novo), `js/screens/trocar-senha-obrigatoria.js` (novo), `scripts/staging/trocar-senha-obrigatoria-e2e.mjs` (novo, tooling), `index.html`, `tests/auth.smoke.js`, `tests/boot.smoke.js`, `tests/trocar-senha-obrigatoria.smoke.js` (novo)). **Commit documental:** este closeout (`Close mandatory password change phase`). O HEAD atual deve ser consultado com `git rev-parse HEAD`.
- **Hard stop resolvido (Opção A, decisão explícita do arquiteto):** `js/auth.js` amplia só o `select` de `loadCurrentUser()` (`+senha_temporaria, +senha_gerada_em`) — nenhuma outra linha tocada, §11 preservado. A guarda vive inteiramente em `js/boot.js` (`isSenhaTemporariaExpirada`, `guardedHandleRoute`) sem tocar `js/router.js`.
- **RLS/grants verificados em staging antes de codar:** `usuarios_self_update` + `authenticated` com `UPDATE` em `senha_temporaria`/`senha_gerada_em` — self-update funciona sem policy nova.
- **Write self-service (`js/trocar-senha-writes.js`):** `trocarSenhaObrigatoria(userId, novaSenha)` — `auth.updateUser({password})` + `UPDATE usuarios SET senha_temporaria=false`; `{ok:false, stage:'auth'|'flag'}` reporta estado parcial explicitamente.
- **Tela (`js/screens/trocar-senha-obrigatoria.js`, 243 linhas):** card sem shell, checklist vivo (8+ caracteres / 1 dígito / senhas coincidem), botão habilitado só com os 3 critérios, toggle de olho, "Sair da conta"; modo `expired` (>7 dias) sem campos. Mockup aprovado pelo arquiteto em 2026-07-16.
- **Testes:** `tests/trocar-senha-obrigatoria.smoke.js` (novo) 14/14; `tests/boot.smoke.js` estendido 44/44 (13 novos, incl. integração via `main()` real); `tests/auth.smoke.js` estendido 37/43 (3 novos + 1 corrigido; os 6 que falham são débito pré-existente confirmado via `git stash`, não desta fase). `git diff --check` limpo.
- **Verificação sem credenciais (preview local):** tela real renderizada via overlay de diagnóstico — checklist reage a tecla com cores computadas corretas, botão desabilita/habilita, toggle de olho confirmado, modo `expired` sem campos. Console sem erros.
- **Validação da perna autenticada — CONFIRMADA PELO ARQUITETO (validação manual em staging `ucrjtfswnfdlxwtmxnoo`):** usuário sintético criado pelo fluxo novo, gate exibido no primeiro login, checklist reagiu, troca efetuada, `senha_temporaria` zerada, segundo login entrou direto sem gate. Usuário de teste removido. Runner automatizado equivalente (`scripts/staging/trocar-senha-obrigatoria-e2e.mjs`) criado para reexecução futura — não executado nesta fase (login com senha real é ação exclusiva de humano, nunca do agente IA, regra permanente).
- **Débito registrado (candidato a `CODE-HEALTH-AUDIT-§18-R1`):** os 6 testes pré-existentes de `tests/auth.smoke.js` com regex de `<script src="js/auth.js">` desatualizado (sem considerar `?v=`) — não corrigido aqui, fora de escopo.
- **Débito de continuidade documental — RESOLVIDO em 2026-07-16:** a micro-fase `CAMADA2-LAST-ACCESS-UI` (technical commit `0aff22f` — `Add last sign-in column to user admin`) teve seu relatório de implementação entregue (`AGUARDANDO VALIDAÇÃO VISUAL DO ARQUITETO`) mas a sessão prosseguiu diretamente para `A4.2` sem `OK` explícito nem ordem de closeout para essa micro-fase especificamente. O arquiteto confirmou a validação visual e autorizou o closeout formal junto com a autorização de `A5.1-A5.2` — ver seção própria "Camada 2 — Consumo da RPC de Último Acesso na UI — CAMADA2-LAST-ACCESS-UI" abaixo.
- **Produção:** `bhgifjrfagkzubpyqpew` não acessada. **Push:** não executado.
- **Estado final do worktree:** limpo; staging vazio; zero untracked (`supabase/.temp/` pré-existente, não desta sessão).
- **Próxima ação autorizável:** `ARCHITECT DECISION` entre `A2.1` (schema `nivel_acesso`), `A6.1` (schema/trigger de auditoria) e `A5.1-A5.2` (reset de senha por admin). Esta entrada não autoriza sua execução.
- **Detalhe completo:** `PROJECT_STATE.md` (seção "Camada 2 — Guarda de Troca de Senha Obrigatória — A4.2") e `docs/ledgers/G28_LEDGER.md` (entrada append-only).
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
  10. `docs/architecture/CAMADA2_USUARIOS_SPEC_PROPOSED.md` (trabalho em `G28-CAMADA-2`)
  11. `docs/governance/SUPERVISION_PROTOCOL.md` (formato de ordem, gates, bloco padrão de handoff de supervisão)
  Todo chat ou agente futuro deve retransmitir estes onze caminhos e instruir expressamente a próxima continuidade a retransmiti-los novamente. A cadeia de continuidade do plano e do backlog não pode ser interrompida.

## Camada 2 — Consumo da RPC de Último Acesso na UI — CAMADA2-LAST-ACCESS-UI — CLOSED / ACCEPTED

- **Commit técnico:** `0aff22f` — `Add last sign-in column to user admin` (`js/admin-usuarios-writes.js`, `js/screens/admin-usuarios.js`, `tests/admin-usuarios.smoke.js`). **Commit documental:** este closeout (`Close last sign-in column phase`). O HEAD atual deve ser consultado com `git rev-parse HEAD`.
- **Escopo:** `fetchLastSignIn()` (uma chamada por `reload()`, merge client-side por `id`) + coluna "ULTIMO ACESSO" no grid (`dd/mm/aaaa hh:mm`; `"—"` para nulo) + ordenação "Último acesso" (mais recente primeiro, nulos por último) + fail-closed em caso de falha da RPC (coluna inteira `"—"` + `console.warn`, lista continua visível).
- **Testes:** `tests/admin-usuarios.smoke.js` estendido 23/23; regressão `boot`+`cadastros-screens`+`admin-*` 298/298. `git diff --check` limpo.
- **Validação visual — CONFIRMADA PELO ARQUITETO em 2026-07-16 (preview local, staging `ucrjtfswnfdlxwtmxnoo`):** coluna populada com dados reais, formato correto, `"—"` nos nunca-logados, ordenação com nulos por último.
- **Produção:** `bhgifjrfagkzubpyqpew` não acessada. **Push:** não executado.
- **Estado final do worktree:** limpo; staging vazio; zero untracked (`supabase/.temp/` pré-existente, não desta sessão).
- **Próxima ação autorizável:** já superada — `A5.1-A5.2` autorizada e em andamento; ver seção própria.
- **Detalhe completo:** `PROJECT_STATE.md` (seção "Camada 2 — Consumo da RPC de Último Acesso na UI") e `docs/ledgers/G28_LEDGER.md` (entrada append-only).

## Camada 2 — Reset de Senha Administrativo — A5.1-A5.2 — CLOSED / ACCEPTED

- **Commit técnico:** `b726717` — `Add admin password reset` (`supabase/functions/admin-reset-user-password/index.ts` (novo), `supabase/functions/admin-reset-user-password/README.md` (novo), `js/admin-usuarios-writes.js`, `js/screens/admin-usuarios.js`, `js/screens/admin-usuarios-modal.js`, `scripts/staging/admin-reset-password-e2e.mjs` (novo), `tests/admin-reset-user-password.smoke.js` (novo), `tests/admin-usuarios.smoke.js`). **Commit documental:** este closeout (`Close admin password reset phase`). O HEAD atual deve ser consultado com `git rev-parse HEAD`.
- **Decisão do arquiteto — auto-reset BLOQUEADO:** admin não pode resetar a própria senha (`SELF_RESET_FORBIDDEN`) — usa o fluxo normal de troca (self-service, `A4.2`). Sem guarda de "último admin" (resetar senha não desativa ninguém).
- **Edge Function `admin-reset-user-password`:** espelho de `admin-disable-user`; senha temporária via `crypto.getRandomValues` (12 chars, sem ambiguidade visual, ≥1 dígito garantido); `auth.admin.updateUserById(target, {password})`; marca `senha_temporaria=true`/`senha_gerada_em=now()`; nunca loga a senha; retorna a senha uma única vez. Falha pós-reset no update de perfil (sem compensação segura possível) retorna erro explícito (`PROFILE_UPDATE_FAILED`).
- **UI:** botão de ícone chave → `confirmDialog` (nunca `window.confirm`) → sucesso: modal "Senha gerada" (senha exibida uma vez, botão copiar, aviso de não-reexibição). Erro → toast, sem estado ambíguo.
- **Deploy em staging executado pelo arquiteto** (fora do alcance de credenciais desta sessão, regra permanente).
- **Verificação pós-deploy — E2E real em staging, `result: PASS` (15/15), executado pelo arquiteto** via `scripts/staging/admin-reset-password-e2e.mjs` (`test_user_id 170f8479-e2da-4a6d-b597-080716be9c20`): guardas `SELF_RESET_FORBIDDEN`/`NOT_FOUND`; reset real com flag+timestamp atualizados; senha antiga invalidada; login com a temporária nova confirma `senha_temporaria=true`; self-service de `A4.2` encadeado (nova troca + flag zerada); relogin sem gate; cleanup zero.
- **Testes:** `tests/admin-reset-user-password.smoke.js` (novo) 23/23; `tests/admin-usuarios.smoke.js` estendido 29/29 (6 novos); regressão consolidada 268/275 (7 = débito pré-existente confirmado, nenhum novo). `git diff --check` limpo.
- **Validação visual do arquiteto — DISPENSADA POR DECISÃO EXPLÍCITA**, coberta pela combinação e2e `PASS` + verificação de fluxo em navegador real pelo executor (botão → `confirmDialog` → modal de senha com exibição única/copiar/aviso; guarda de auto-reset confirmada com valores reais de `.disabled` no DOM).
- **Achado registrado — candidato `UI-EL-BOOLEAN-ATTR-FIX` (`NOT AUTHORIZED`, severidade `NÃO CONFIRMADA`):** `js/ui.js`'s `el()` não trata boolean em `setAttribute` — potencialmente afeta os botões Desativar/Excluir em `admin-usuarios.js` (mesma causa-raiz do resíduo já corrigido em `expedicao-admin.js`). Tratar como potencial regressão ativa até o arquiteto verificar diretamente em staging. Não corrigido (fora do manifesto de `A5.1-A5.2`).
- **Achado registrado — candidato de decomposição (`CODE-HEALTH-AUDIT-§18-R1`):** `js/screens/admin-usuarios-modal.js` a 576 linhas (acima do aceitável 500) ao acomodar o 4º modal.
- **Produção:** `bhgifjrfagkzubpyqpew` não acessada. **Push:** não executado.
- **Estado final do worktree:** limpo; staging vazio; zero untracked (`supabase/.temp/` pré-existente, não desta sessão).
- **Próxima ação autorizável:** `ARCHITECT DECISION` entre `A5.3-A5.4` (reativação), `UI-EL-BOOLEAN-ATTR-FIX`, `A2.1` (nível de acesso) e `A6.1` (auditoria). Esta entrada não autoriza sua execução.
- **Detalhe completo:** `PROJECT_STATE.md` (seção "Camada 2 — Reset de Senha Administrativo — A5.1-A5.2") e `docs/ledgers/G28_LEDGER.md` (entrada append-only).

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
