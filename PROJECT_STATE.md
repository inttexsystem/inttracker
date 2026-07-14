# ESTADO ATUAL CANÔNICO

Este bloco é a única fonte de estado operacional atual por frente.
HEAD, working tree, staging e divergência devem ser consultados diretamente no Git.
O conteúdo histórico abaixo não determina o estado atual.

## Bloco da frente ativa

### Document Qualification / Documents Ingestor — G28

- **Frente:** Document Qualification / Documents Ingestor — G28
- **Workspace:** `D:\OneDrive\Programação\Ravatex\controle-tapetes-g28`
- **Branch:** `work/g28-document-qualification`
- **Remoto permitido:** nenhum push sem autorização expressa nesta cadeia
- **G28-B5-D5 — CLOSED / ACCEPTED**; Documentary commit: this D5 closeout commit; resolve the final HEAD with `git rev-parse HEAD` after commit.
- **Última fase aceita:** `G28-B5-D5 — documentary closeout — CLOSED / ACCEPTED`; Documentary commit: this D5 closeout commit; resolve the final HEAD with `git rev-parse HEAD` after commit.
- **G28-B5-B1:** `CLOSED / ACCEPTED`; commit técnico `b247e43504c0afcc0d25e95f8012f93a09eb0692` — `Add idempotent document decision command contract`
- **G28-B5-B2:** `CLOSED / ACCEPTED`; migration `20260714012641 document_decision_command` aplicada e verificada no staging `ucrjtfswnfdlxwtmxnoo`
- **G28-D4-V1:** `PATCH COMMITTED / NOT ACCEPTED`; commit `ae907b82613c87c5a9f2cd37031186ef94047db7` — `Wire canonical document decision runtime`; auditoria read-only detectou módulos `documents-decision-command.js`, `documentos-recebidos-decision-modal.js` e `documents-decision-controller.js` ausentes no index.html.
- **G28-D4-R1:** `CLOSED / ACCEPTED`; commit `425172a95cbf2b340aa5f72110d317917a79e1f6` — `Load canonical document decision runtime modules`; carrega os três módulos no index.html e reordena adapter/reader.
- **G28-B5-D5-A:** `CLOSED / ACCEPTED`; diagnóstico read-only confirmou que documentos sem `_ravatex_source` eram tratados implicitamente como legacy. Decisão arquitetural vinculante: ausência de `_ravatex_source` não significa legacy.
- **G28-B5-D5-B1:** `CLOSED / ACCEPTED`; classificação explícita `supabase | legacy | unknown`. `unknown` não oferece ações de decisão, não usa controller/modal/adapter, não chama RPC, não grava decisão local, não usa `statusOverrides`, preserva o status original e falha fechado até normalização da origem. Supabase mantém fluxo canônico; `manual`/`legacy` explícito mantém fluxo local temporário; fallback G22 sem source permanece `unknown`.
- **G28-B5-D5-B2-V1:** `VERIFIED`.
- **G28-B5-D5-B2:** `CLOSED / ACCEPTED_WITH_PREEXISTING_TEST_DEBT`. Helpers locais exigem provenance explícita: somente `manual` e `legacy` podem ler, gravar ou remover decisão local; `supabase`, `unknown`, source ausente, inválido, vazio ou `null` falham fechados. ID isolado não consulta decisão local sem source legacy explícita. O loader projeta `_ravatex_source` em cada documento; source ausente, inválido e `g22-auto` viram `unknown`; Pedido Detail recebe o documento já materializado. RPCs não foram alteradas. Dívida preexistente comprovada: `tests/documents-ingestor.test.js` com 2 falhas idênticas no baseline e `tests/g14-c-bridge-smoke.test.js` com 15 falhas idênticas no baseline; nenhuma regressão nova introduzida pelo B2.
- **G28-B5-D5-B3:** `CLOSED / ACCEPTED`. Remoção completa de `statusOverrides` do runtime; nenhum estado paralelo substituto. Proveniência preservada: `manual`/`legacy` permanecem elegíveis para decisões locais; Supabase permanece canônico/cloud-only; unknown, ausente, inválido, vazio, `null` e `g22-auto` permanecem fail-closed.
- **G28-B5-D5-B4:** `CLOSED / ACCEPTED`. `decideDocumentInCloud` e `window.RAVATEX_DOCUMENTS.decideDocumentInCloud` removidos. Zero chamadas JavaScript runtime a `decidir_documento`. `registerDocumentDecisionInCloud`/`registrar_decisao_documento` e `undoDocumentDecisionInCloud`/`desfazer_decisao_documento` preservados. SQL `decidir_documento` não foi removido. Gates focados verdes; revisão independente `APPROVE`. Telemetria indisponível e não bloqueante. Risco residual: External consumers outside this repository of `window.RAVATEX_DOCUMENTS.decideDocumentInCloud` may exist and will no longer find that export. D5-B5 e B8 permanecem não autorizados e não iniciados.
- **G28-B5-D5:** `CLOSED / ACCEPTED`. Consolidated regression GREEN. Runtime: D5_REGRESSION_GREEN, RUNTIME_DECIDIR_DOCUMENTO_CALLS=0, RUNTIME_DECIDE_DOCUMENT_IN_CLOUD_EXPORTS=0, RUNTIME_STATUS_OVERRIDES=0, CANONICAL_REGISTER_ADAPTER_PRESENT=1, CANONICAL_REGISTER_RPC_CALL_PRESENT=1, CANONICAL_UNDO_ADAPTER_PRESENT=1, CANONICAL_UNDO_RPC_CALL_PRESENT=1, SQL_DECIDIR_DOCUMENTO_PRESENT=1. Syntax checks: 3 exit 0. Focused tests: 584 pass / 0 fail across 13 test files. B1-B5 completed. Binding residual: explicit manual/legacy local domain remains temporarily supported; Supabase/unknown/absent/null/invalid/g22-auto fail-closed; no migration, conversion, or removal of legacy domain authorized. Canonical register/undo adapters and RPCs preserved. SQL `decidir_documento` preserved (not removed, not migrated). Historical debt: `tests/documents-ingestor.test.js` 2 known failures, `tests/g14-c-bridge-smoke.test.js` 15 known fixture failures (identical to baseline). No remote access (staging, production, Supabase, database, network). No push. B6/B8 not started. No next implementation phase claimed or inferred; requires fresh architect authorization.
- **Produção:** projeto `bhgifjrfagkzubpyqpew` não acessado
- **Contrato aceito:** coluna nullable `document_decisions.command_id`, índice único parcial `document_decisions_command_id_uidx` e RPC canônica `registrar_decisao_documento(...)`; validações estrutural, de autorização, idempotência, atomicidade e concorrência A/B/C aprovadas
- **Runtime aceito:** somente documentos `_ravatex_source === 'supabase'` em `#/documentos/recebidos` usam módulos na ordem `documents-supabase-decisions → documents-supabase-reader → documents-decision-command → documentos-recebidos-decision-modal → documents-decision-controller → documentos-recebidos`; carregados estaticamente no index.html; sem import dinâmico; `restorePending(activeDecision)` preserva pending `uncertain` e retry reusa `commandId`. O fluxo local `saveDocumentDecision` exige provenance explícita `manual` ou `legacy`; source ausente ou inválido é `unknown` e não alcança esse fluxo. Não há `statusOverrides` nem substituto paralelo no runtime.
- **Validação D4-R1:** auditoria read-only confirmou módulos ausentes no V1; R1 carrega e reordena; `node --check` em 4 arquivos; 11 integration, 135 screen smoke, 58 queue UI, 68 controller, 41 modal, 96 lifecycle, 59 adapter, 46 reader, 23 migration contract, 48 queue read model = 585 pass/0 fail; `git diff --check` aprovado com aviso LF→CRLF não bloqueante; revisão independente OpenCode `opencode-go/deepseek-v4-flash` retornou `APPROVE` sem mutação.
- **Push:** não executado
- **Próxima decisão:** Nenhuma. G28-B5-D5 encerrado e aceito. G28-B6 e G28-B8 não iniciados. Qualquer nova implementação, mudança remota, de banco, linking, undo/revogação ou ampliação de UI requer autorização arquitetural explícita e separada.

### Débitos relevantes

- Migrations 49 e 50 — aplicadas e verificadas em staging; não aplicadas em produção por esta cadeia.
- Evoluções posteriores de UI/runtime, destino da RPC legada e qualquer linking/revogação requerem nova decisão arquitetural.
- Push — não autorizado nesta cadeia.

### Referência histórica

- Preservação pré-modelo: `docs/legacy/pre-model/MANIFEST.md`
- Ledger da frente G28: `docs/ledgers/G28_LEDGER.md`

### Links obrigatórios

- Modelo de governança documental: `docs/governance/DOCUMENTATION_MODEL.md`
- Árbitro de autoridade documental: `docs/DOCUMENTATION_INDEX.md`
- Plano mestre G28: `docs/architecture/DOCUMENTOS_VALIDACAO_VINCULOS_E_EVOLUCAO_PLANO.md`
- Plano Pedido/OP/Movimentação/Documentos: `docs/architecture/PEDIDO_OP_MOVIMENTACAO_DOCUMENTOS_PLANO.md`
- Estado local do Ingestor (contexto técnico): `services/documents-ingestor/PROJECT_STATE.md`

# HISTÓRICO LEGADO PRÉ-MODELO — ARQUIVADO

O conteúdo histórico completo que existia neste arquivo antes da
compactação foi preservado, byte a byte, em:

`docs/legacy/pre-model/PROJECT_STATE_FULL_SNAPSHOT.md`

Manifesto de integridade:

`docs/legacy/pre-model/MANIFEST.md`

Commit de origem do snapshot:

`08b9af5e251de48e938600e5e4b4214e4d1e824e`

SHA-256 do snapshot completo:

`7cacddd59c5b2fe9bae1add1a54a3433c370ccdad713bbd4010a1d11f1b39a98`

O snapshot não é fonte de estado atual e não deve ser editado nem receber
novos closeouts.

A evolução histórica estruturada será registrada em ledger próprio da
frente em fase posterior.

Esta seção não deve acumular novo conteúdo histórico.
