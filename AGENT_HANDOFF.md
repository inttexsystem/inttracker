# HANDOFF OPERACIONAL ATIVO

- **Frente ativa:** G28 — D4 canonical decision wiring para `#/documentos/recebidos` — `VALIDATED / READY FOR SELECTIVE COMMIT`
- **Workspace:** `D:\OneDrive\Programação\Ravatex\controle-tapetes-g28`
- **Branch:** `work/g28-document-qualification`
- **HEAD inicial D4:** `49497439855685a28c30eef1d9044e9baa47b9d4`; worktree limpo antes do handoff
- **Fase aceita mais recente:** `G28-B5 — HUMAN DECISION COMMAND CONTRACT` — `CLOSED / ACCEPTED`
- **Contrato canônico disponível:** `registrar_decisao_documento(...)`, com autorização, idempotência, atomicidade e concorrência verificadas; fixtures removidas e contagens restauradas
- **Diagnóstico D4 (IAsup / gpt-5.6-terra):** a tela usa `_ravatex_source === 'supabase'` para a ramificação cloud, mas ainda chama `decideDocumentInCloud` e `window.prompt`. D1–D3 estão presentes e sem diff: controller + modal + command; reader projeta `_ravatex_server_decision.{id,command_id}`.
- **Escopo D4 autorizado:** somente `js/screens/documentos-recebidos.js`, `tests/documentos-recebidos.smoke.js` e novo `tests/documentos-recebidos-decision-integration.test.js` pela implementação. D1–D3, reader, Supabase, migrations, `index.html`, produção e push são proibidos.
- **Correção prevista:** para documentos Supabase pendentes, a tela deve usar `documentDecisionController.open` com dados canônicos; `onSubmit` deve usar `registerDocumentDecisionInCloud`, preservar/reusar command ID e só atualizar/recarregar em resultado canônico bem-sucedido. Legacy/manual permanece no fluxo local atual.
- **Baseline D4:** `node --check js/screens/documentos-recebidos.js` e sete gates focados passaram (smoke, modal, controller, command, adapter e reader); nenhum arquivo D1–D3 tem diff.
- **D4 — tentativa de implementação rejeitada (IAsup / OpenCode `opencode/deepseek-v4-flash-free`):** produziu somente os três arquivos do manifesto, mas violou o allowlist com `npx node`/tentativa de install e encerrou por timeout; a saída não é evidência aceita. Inspeção IAsup posterior com `node` confirmou gates locais verdes (450 pass), porém encontrou lacunas contratuais: snapshot usa `doc.activeDecision` inexistente em vez de `doc.raw._ravatex_server_decision`; não há chamada de `restorePending()`; e `uncertain` nunca aciona `controller.retry()` nem prova preservação do `commandId`.
- **Correção D4 aceita provisoriamente (IAsup / gpt-5.6-terra, modo TDD):** `restoreCloudDecisionRuntime(docs)` reconcilia uma vez usando a decisão do documento pendente em `raw._ravatex_server_decision`; o handler não chama `open()` sobre `uncertain` do mesmo documento e encaminha confirmação para `retry()`. RED confirmou `reconcileCalls 0 !== 1`; GREEN inicial passou `454/454`.
- **Validação final:** revisão independente read-only por OpenCode `opencode-go/deepseek-v4-flash` (`exit 0`, log `ravatex-d4-review-output.txt`) retornou `APPROVE`, sem achados e sem mutação. Gate pós-revisão: `node --check` + sete suítes D4 = `454 pass, 0 fail`; `git diff --check` e `git diff --no-index --check` limpos. Aviso LF→CRLF do Git é não bloqueante.
- **Próximo passo:** inspecionar staging seletivo dos quatro arquivos D4/supervisão e criar commit local; não fazer push.
- **Hard prohibitions:**
  - `Do not modify D1-D3, reader, Supabase, migrations, index.html, production, profiles, skills, prompts, routing policies or orchestration configuration.`
  - `Do not expand D4 to Pedido/OP linking, undo/revocation redesign, visual redesign or legacy migration.`
  - `Do not push.`
- **Arquivos autoritativos obrigatórios antes da próxima implementação:**
  - `PROJECT_STATE.md`
  - `AGENT_HANDOFF.md`
  - `docs/DOCUMENTATION_INDEX.md`
  - `docs/governance/DOCUMENTATION_MODEL.md`
  - `docs/ledgers/G28_LEDGER.md`
  - `docs/architecture/DOCUMENTOS_VALIDACAO_VINCULOS_E_EVOLUCAO_PLANO.md`
  - `docs/architecture/DOCUMENTS_INGESTOR_CONSUMER_DESIGN.md`
  - `docs/architecture/CODE_HEALTH_RULES.md`
- **Links canônicos:** estado → `PROJECT_STATE.md`; ledger → `docs/ledgers/G28_LEDGER.md`

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
