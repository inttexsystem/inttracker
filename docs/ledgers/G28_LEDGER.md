# G28 — LEDGER DE FASES ACEITAS

## Papel

Este arquivo é o ledger append-only da frente G28 — Document Qualification /
Documents Ingestor.

Registra fases encerradas e aceitas, commits, arquivos principais, validações,
riscos residuais e a próxima fase indicada no momento do fechamento.

Não é fonte do estado operacional atual.
O estado atual pertence ao `PROJECT_STATE.md` da raiz.

Não substitui o Git.
Commits, diffs e manifestos exatos devem ser consultados diretamente no Git.

## Cobertura

A cobertura estruturada deste ledger começa no baseline técnico imediatamente
anterior à adoção do modelo documental e segue prospectivamente.

O histórico pré-modelo completo permanece preservado, sem reconstrução
especulativa, em:

`docs/legacy/pre-model/MANIFEST.md`

Os diagnósticos rejeitados `G28-DOCS-B3-A` e `G28-DOCS-B3-A-R1` não são
fontes deste ledger e não geram entradas de fase aceita.

## Regra append-only

Entradas aceitas não são reescritas.
Correções posteriores recebem nova entrada vinculada à fase anterior.
Cada fase aceita gera no máximo uma entrada neste ledger.

## Modelo de entrada

Cada fase registra: gate, commit aceito, arquivos principais, validação,
risco residual e próxima fase indicada no fechamento.

---

## 2026-07-12 — G28-B3-B5-B — Prepare technical evidence sync input

- **Gate:** CLOSED / ACCEPTED
- **Commit aceito:** `013a0e18157bf31215eed651eae3e8e1617f5815` — `Prepare technical evidence sync input`
- **Arquivos principais:**
  - `services/documents-ingestor/src/core/syncSupabase.ts`
  - `services/documents-ingestor/tests/sync-supabase.test.ts`
- **Validação:** 108 testes aprovados em duas execuções focadas; dry-run sem
  efeitos remotos; confirmed write com technical evidence ainda falha
  localmente antes de qualquer efeito remoto porque a integração final
  pertence a `G28-B3-B5-C`.
- **Risco residual:** integração de escrita confirmada ainda pendente;
  migration 49 versionada e não aplicada.
- **Próxima fase indicada no fechamento:** `G28-B3-B5-C`, posteriormente
  suspensa durante o refactor documental.

> Entrada técnica pré-modelo importada como baseline. Única entrada técnica
> pré-modelo autorizada. As fases anteriores (`G28-P0`, `G28-B1`, `G28-B2`,
> `G28-B3-B1` até `B3-B5-A`) não foram reconstruídas a partir dos snapshots.

---

## 2026-07-12 — G28-DOCS-B1 — Define documentation source-of-truth model

- **Gate:** CLOSED / ACCEPTED
- **Commit aceito:** `81cff64df7d2acf989c77a4a15f5c27e8cbc8d84` — `Define documentation source-of-truth model`
- **Arquivos principais:**
  - `docs/governance/DOCUMENTATION_MODEL.md`
  - `docs/DOCUMENTATION_INDEX.md`
- **Validação:** fase documental; `git diff --check` limpo; Git final limpo.
- **Risco residual:** arquivos operacionais ainda continham histórico
  pré-modelo.
- **Próxima fase indicada no fechamento:** `G28-DOCS-B2`.

---

## 2026-07-12 — G28-DOCS-B2 — Cut over active documentation state ownership

- **Gate:** CLOSED / ACCEPTED
- **Commit aceito:** `0b4df167d1206624a41a6febddbf46df966cdda1` — `Cut over active documentation state ownership`
- **Arquivos principais:**
  - `PROJECT_STATE.md`
  - `AGENT_HANDOFF.md`
  - `services/documents-ingestor/PROJECT_STATE.md`
- **Validação:** fase documental; `git diff --check` limpo; Git final limpo.
- **Risco residual:** o contexto técnico do componente ainda duplicava versões
  de ferramentas e estado de apply da migration, o que originou a correção
  `G28-DOCS-B2-R1`.
- **Próxima fase indicada no fechamento:** `G28-DOCS-B2-R1`.

---

## 2026-07-12 — G28-DOCS-B2-R1 — Keep component state non-operational

- **Gate:** CLOSED / ACCEPTED
- **Commit aceito:** `8c21c20d9d01d261380f4eead766d90d67d8e905` — `Keep component state non-operational`
- **Arquivos principais:**
  - `services/documents-ingestor/PROJECT_STATE.md`
- **Validação:** fase documental; `git diff --check` limpo; Git final limpo.
- **Risco residual:** versões de ferramentas e estado de apply da migration
  deixaram de ser duplicados no state local do Ingestor; o apontamento
  definitivo desses fatos pertence ao `PROJECT_STATE.md` da raiz e ao ledger
  da frente.
- **Próxima fase indicada no fechamento:** `G28-DOCS-B2-CLOSEOUT`.

---

## 2026-07-12 — G28-DOCS-B2-CLOSEOUT — Record G28 documentation cutover acceptance

- **Gate:** CLOSED / ACCEPTED
- **Commit aceito:** `08b9af5e251de48e938600e5e4b4214e4d1e824e` — `Record G28 documentation cutover acceptance`
- **Arquivos principais:**
  - `PROJECT_STATE.md`
  - `AGENT_HANDOFF.md`
- **Validação:** fase documental; `git diff --check` limpo; Git final limpo.
- **Risco residual:** os blocos ativos passaram a apontar para o diagnóstico
  histórico, sem alteração dos históricos congelados; a compactação dos
  históricos ainda estava pendente.
- **Próxima fase indicada no fechamento:** `G28-DOCS-B3-B0`.

---

## 2026-07-12 — G28-DOCS-B3-B0 — Preserve pre-model documentation snapshots

- **Gate:** CLOSED / ACCEPTED
- **Commit aceito:** `5960e3b75ce62521d89d32586d4660198f8f52c0` — `Preserve pre-model documentation snapshots`
- **Arquivos principais:**
  - `docs/legacy/pre-model/PROJECT_STATE_FULL_SNAPSHOT.md`
  - `docs/legacy/pre-model/AGENT_HANDOFF_FULL_SNAPSHOT.md`
  - `docs/legacy/pre-model/DOCUMENTS_INGESTOR_PROJECT_STATE_FULL_SNAPSHOT.md`
  - `docs/legacy/pre-model/MANIFEST.md`
- **Validação:** tamanho em bytes idêntico entre cada origem e seu snapshot;
  SHA-256 idêntico; `fc /b` sem diferenças; blobs Git correspondentes aos
  conteúdos preservados.
- **Risco residual:** histórico ainda duplicado nos arquivos operacionais
  antes do cutover `G28-DOCS-B3-C`.
- **Próxima fase indicada no fechamento:** `G28-DOCS-B3-C`.

---

## 2026-07-12 — G28-DOCS-B3-C — Replace active histories with immutable snapshot references

- **Gate:** CLOSED / ACCEPTED
- **Commit aceito:** `391f3ee3cd41c8729304e4751b9508a1e0259b0e` — `Replace active histories with immutable snapshot references`
- **Arquivos principais:**
  - `PROJECT_STATE.md`
  - `AGENT_HANDOFF.md`
  - `services/documents-ingestor/PROJECT_STATE.md`
- **Validação:** snapshots com hashes inalterados após o corte; históricos
  congelados substituídos por referências auditáveis aos snapshots
  imutáveis; `git diff --check` limpo.
- **Risco residual:** ledger da frente G28 ainda não criado.
- **Próxima fase indicada no fechamento:** `G28-DOCS-B3-C-CLOSEOUT`.

---

## 2026-07-12 — G28-DOCS-B3-C-CLOSEOUT — Record immutable history cutover acceptance

- **Gate:** CLOSED / ACCEPTED
- **Commit aceito:** `88f62ca5e92005a1677aa99ce761645cbafdc3b4` — `Record immutable history cutover acceptance`
- **Arquivos principais:**
  - `PROJECT_STATE.md`
  - `AGENT_HANDOFF.md`
- **Validação:** diff restrito aos blocos ativos; snapshots intactos;
  Git final limpo.
- **Risco residual:** criação do ledger G28 pendente.
- **Próxima fase indicada no fechamento:** `G28-DOCS-B3-D1`.

---

## 2026-07-12 — G28-DOCS-B3-D1 — Bootstrap prospective G28 phase ledger

- **Gate:** CLOSED / ACCEPTED
- **Commit aceito:** `dcd9823a73d6846e40ff0112543b3c9fe194309b` — `Bootstrap prospective G28 phase ledger`
- **Arquivos principais:** `docs/ledgers/G28_LEDGER.md`; `docs/DOCUMENTATION_INDEX.md`
- **Validação:** oito commits de origem verificados como existentes e ancestrais
  da cadeia; ledger criado com exatamente oito entradas iniciais; somente
  `G28-B3-B5-B` importado como baseline técnico pré-modelo; diagnósticos
  rejeitados excluídos como fontes; `git diff --check` limpo; Git final limpo.
- **Risco residual:** listas documentais legadas ainda concorrem parcialmente
  com o modelo de autoridade; nenhum ledger de outra frente foi criado.
- **Próxima fase indicada no fechamento:** `G28-DOCS-B3-E1 — DOCUMENTATION AUTHORITY LIST RECONCILIATION`.

---

## 2026-07-13 — G28-DOCS-B3-E1 — Documentation authority list reconciliation

- **Gate:** CLOSED / ACCEPTED
- **Commit aceito:** `793185701a4c09917354330f2596e2991e8b1dfc` — `Reconcile documentation authority references`
- **Arquivos principais:**
  - `Guide-and-governance-rules.stxt`
  - `docs/DOCUMENTATION_INDEX.md`
  - `docs/architecture/CLAUDE_PROJECT_ASSET_MAP.md`
- **Validação:** lista única de autoridade consolidada em
  `docs/DOCUMENTATION_INDEX.md`; asset map e guia redirecionados ao modelo
  canônico; `git diff --check` limpo.
- **Risco residual:** inventário de migrations permanece volumoso e deve ser
  consultado diretamente no repositório, não reconstruído neste ledger.
- **Próxima fase indicada no fechamento:** retomada técnica
  `G28-B3-B5-C`.

---

## 2026-07-13 — G28-B3-B5-C — Complete technical evidence sync integration

- **Gate:** LOCAL IMPLEMENTATION ACCEPTED / STAGING BLOCKED
- **Commit técnico:** `3465405db42bfedd0c1f2c479f9be61c46078d87` —
  `Integrate technical evidence into Supabase sync`
- **Arquivos principais:**
  - `services/documents-ingestor/src/core/syncSupabase.ts`
  - `services/documents-ingestor/src/supabase/serviceRoleClient.ts`
  - `services/documents-ingestor/src/cli.ts`
  - `services/documents-ingestor/tests/sync-supabase.test.ts`
  - `services/documents-ingestor/tests/sync-supabase-cli.test.ts`
- **Validação local:** revisão independente aprovada após correção; testes
  focados repetidos após a revisão: 223 testes em cinco arquivos e quatro
  testes de CLI em arquivo adicional, todos aprovados; `git diff --check`
  limpo. Um único client service-role é reutilizado; a ordem é candidate →
  evidence → events; não há retry automático.
- **Staging:** bloqueado antes de SQL/RPC. A identidade do endpoint MCP aponta
  para `ucrjtfswnfdlxwtmxnoo`, mas a configuração local do writer não contém
  `SUPABASE_PROJECT_REF`, URL, service-role key nem writer habilitado; portanto
  a guarda obrigatória da CLI não pode ser comprovada e migration 49, smoke e
  cleanup não foram executados.
- **Risco residual:** a persistência confirmada é multichamada, sem atomicidade
  global; além disso, falta resolver a configuração local exclusiva de staging
  antes do apply e do smoke controlado.
- **Próxima ação indicada:** resolver o gate de staging e retomar somente
  migration 49 + smoke controlado, preservando produção intocada.

---

## 2026-07-13 — G28-B3-B5-C — CLOSED / ACCEPTED

- **Gate:** CLOSED / ACCEPTED
- **Commit técnico:** `3465405db42bfedd0c1f2c479f9be61c46078d87` —
  `Integrate technical evidence into Supabase sync`
- **Arquivos principais:**
  - `services/documents-ingestor/src/core/syncSupabase.ts`
  - `services/documents-ingestor/src/supabase/serviceRoleClient.ts`
  - `services/documents-ingestor/src/cli.ts`
  - `services/documents-ingestor/tests/sync-supabase.test.ts`
  - `services/documents-ingestor/tests/sync-supabase-cli.test.ts`
  - `db/49_document_technical_evidences.sql`
- **Validação de staging:** configuração CLI comprovada via caminho de código
  real; ref `ucrjtfswnfdlxwtmxnoo` confirmada na URL e no project ref; writer
  habilitado; production target false. Migration 49 aplicada e verificada
  em staging (tabela, PK, FK cascade, checks, RLS, admin policy, RPC
  SECURITY DEFINER, contrato escritor inserted/unchanged/conflict).
- **Smoke controlado:** dry-run sem efeitos remotos; primeiro confirmed write
  inseriu candidate e evidence; replay idempotente retornou unchanged sem
  duplicata; conflito com conteúdo divergente detectado, scan finalizada como
  failed, sem retry; cleanup confirmou zero linhas sintéticas em candidates,
  evidences, events, scan runs e decisions.
- **Testes locais:** 223 aprovados em cinco arquivos focados; 4 aprovados no
  arquivo CLI; `git diff --check` limpo.
- **Produção:** não acessada.
- **Risco residual:** persistência confirmada é multichamada e não oferece
  atomicidade global; a convergência depende da idempotência dos contratos
  remotos.
- **Próxima fase indicada:** `G28-B3-B6 — TECHNICAL EVIDENCE READER`.

---

## 2026-07-13 — G28-B3-B6-B — Current technical evidence admin reader

- **Gate:** CLOSED / ACCEPTED
- **Commit técnico:** `6ade74fd6b8584320dbf12df1dbf334aeabbc8b6` — `Read current technical evidence in document reader`
- **Arquivos principais:**
  - `js/documents-supabase-reader.js`
  - `tests/documents-supabase-reader.test.js`
- **Contrato público preservado:** `window.RAVATEX_DOCUMENTS.loadReceivedDocumentsFromSupabase()`
- **Campo interno de attachment:** `_ravatex_technical_evidence`
- **Fonte remota:** `public.document_technical_evidences`
- **Acesso:** admin autenticado direto, sob RLS existente
- **Versão carregada:** versão corrente (highest valid positive numeric `evidence_version`)
- **Estados:** `available`, `missing`, `invalid`
- **Falha remota:** distinta de `missing`; não há fallback silencioso
- **Versão inválida:** a versão corrente é rejeitada como `invalid`; não há fallback para evidência mais antiga
- **Evidência histórica:** diferida; não carregada
- **UI:** inalterada; sem renderização
- **Database:** inalterada; Documents Ingestor inalterado
- **Writes/RPC:** nenhum; sem segundo client Supabase; sem fonte paralela
- **Validação:** `node --check` passou; 39 reader tests aprovados; 91 screen smoke tests aprovados; diff checks passaram
- **Revisão independente:** APPROVE
- **Produção:** não acessada
- **Push:** não executado
- **Risco residual:** reader 268 linhas; reader test 618 linhas; qualquer expansão funcional substancial exige nova revisão de coesão antes de adicionar lógica substancial a qualquer um dos dois arquivos; isto não é um defeito ou bloqueador.
- **Próxima fase indicada no fechamento:** `NEXT SUBSTANTIVE PHASE: REQUIRES ARCHITECT DECISION`. O plano mestre autoritativo (`DOCUMENTOS_VALIDACAO_VINCULOS_E_EVOLUCAO_PLANO.md`) está inconsistente com a baseline aceita B3-B5-C e B6-B (ainda nomeia B3-B5-B como `NOT STARTED` e posiciona diferentemente os estágios genéricos posteriores), enquanto os demais planos/backlogs obrigatórios cobrem preocupações separadas de Pedido/OP e produção. Portanto os planos/backlogs autoritativos não sequenciam univocamente um sucessor após a baseline B6-B aceita; um arquiteto deve reconciliar o plano/backlog G28 antes de uma nova fase de implementação.

---

## 2026-07-13 — G28-B4 — DOCUMENT QUEUE

- **Gate:** CLOSED / ACCEPTED
- **Subfases aceitas:** G28-B4-A, G28-B4-B1, G28-B4-B2, G28-B4-B1-R1, G28-B4-B3, G28-B4-B4
- **Commits aceitos:**
  - `50f543ff8c6917599cf35768e9e84531532bf177` — Add pure document queue read model
  - `d0f0424924b57b3754fe87a0be0336292f5c2b74` — Bind received documents queue filters
  - `948213885506fdb6e41cfe10451af21e006ce441` — Distinguish missing Pedido link availability
  - `2958e6451b49986ac1af414e62cd31df698dcaa5` — Show document queue state indicators
  - `f007ab3c733d584e9da57c8436294d9b42ea9652` — Consolidate document queue file access
- **Escopo funcional:** pure queue read model com eixos source/evidence/review/Pedido; estados Pedido `confirmed_pedido_reference`, `suggested_pedido`, `no_confirmed_link`, `unavailable`; OP e duplicate indisponíveis; alertas determinísticos display-only; sem Supabase/DOM/network/write no read model; binding/filtros/indicadores aceitos; gate exclusivo por `queueItem.source_file.state`; ações Drive preservadas apenas após `drive_available`; spans unsupported/missing explicativos e não interativos; validation informacional; sem action/modal/write/RPC/backend/Gmail/filesystem
- **Validação focada:** model 48, queue UI 58, decisions 20, reader 39, screen smoke 133, import received 36, import UI 40, router 43; 3 node checks; diff check limpo (apenas avisos pré-existentes LF→CRLF)
- **Validação visual:** fixture local in-memory; ambas as posições do wrapper horizontal intencional inspecionadas; Drive um Ver e um Baixar apenas; spans unsupported/missing sem clique; wrapping sem clipping; servidor local parado
- **Push:** não executado
- **Baseline pré-closeout:** `f007ab3c733d584e9da57c8436294d9b42ea9652`; worktree/staging limpos; zero untracked
- **Débitos não bloqueantes:** `documentos-recebidos.js` excepcionalmente grande; document-row rendering ~151 linhas, candidato a code-health futuro; sem refatoração autorizada; semântica atual exige mudanças de nomenclatura testadas deliberadamente; B4 não implementa modal de validação humana, novas writes de decisão, linking canônico Pedido/OP, detecção de duplicatas, histórico de evidência, correção/revogação, backends Gmail/novos arquivos
- **Próxima fase indicada no fechamento:** `G28-B5 — HUMAN VALIDATION CONTRACT AND MODAL`
- **Próxima ação autorizada:** `G28-B5-A — Human validation, persistence, and linking boundary diagnosis`

---

## 2026-07-14 — G28-B5 — Human decision command contract and staging verification

- **Gate:** `G28-B5-B1 — CLOSED / ACCEPTED`; `G28-B5-B2 — CLOSED / ACCEPTED`; `G28-B5 — CLOSED / ACCEPTED`
- **Workspace:** `D:\OneDrive\Programação\Ravatex\controle-tapetes-g28`
- **Branch:** `work/g28-document-qualification`
- **HEAD técnico:** `b247e43504c0afcc0d25e95f8012f93a09eb0692` — `Add idempotent document decision command contract`
- **Target de staging:** `ucrjtfswnfdlxwtmxnoo`
- **Migration:** registrada como `20260714012641 document_decision_command`
- **Validação estrutural:** coluna UUID nullable `document_decisions.command_id`, índice único parcial válido `document_decisions_command_id_uidx`, RPC `registrar_decisao_documento(...)`, propriedades de segurança e grants aprovados; RPCs legadas preservadas
- **Validação comportamental:** autorização admin, rejeição de anon/não-admin, normalização, seis outcomes, replay idempotente, conflitos sem mutação, precondição de decisão ativa e rollback transacional aprovados
- **Concorrência real:** sessões com backends e janelas sobrepostas; A produziu `created` + `replayed` para o mesmo comando; B produziu `created` + `active_decision_exists` para comandos distintos no mesmo candidato; C produziu `created` + `command_conflict` para o mesmo comando com payload divergente
- **Limpeza:** fixtures removidas; 39 candidates, 0 decisions e zero resíduos em usuários, candidates, decisions, events, scan requests, scan runs e technical evidences
- **Produção:** projeto `bhgifjrfagkzubpyqpew` não acessado
- **Documentação de closeout:** `PROJECT_STATE.md`, `AGENT_HANDOFF.md` e este ledger; commit documental `Record G28 B5 staging decision command verification`
- **Push:** não executado
- **Risco residual:** nenhum consumidor runtime foi redirecionado; a RPC canônica ainda não está integrada à UI; `decidir_documento` permanece ativa e não idempotente; modal, B6-A, B6-B e B8 continuam separados
- **Próxima decisão indicada:** decisão arquitetural explícita antes de qualquer implementação de integração runtime, UI/modal, linking ou correção/revogação

---

## 2026-07-14 — G28-B5-D4-R1 — Load canonical document decision runtime modules

- **Gate:** CLOSED / ACCEPTED
- **Antecedente:** G28-B5-D4-V1 — `PATCH COMMITTED / NOT ACCEPTED`. Auditoria read-only confirmou que index.html não carregava `documents-decision-command.js`, `documentos-recebidos-decision-modal.js` nem `documents-decision-controller.js`, tornando o runtime D4 inoperante.
- **Commit técnico aceito:** `425172a95cbf2b340aa5f72110d317917a79e1f6` — `Load canonical document decision runtime modules`
- **Arquivos alterados:** `index.html` e `tests/documentos-recebidos.smoke.js`.
- **Mudança efetiva:** index.html passou a carregar os três módulos runtime estaticamente; ordem efetiva: `documents-supabase-decisions → documents-supabase-reader → documents-decision-command → documentos-recebidos-decision-modal → documents-decision-controller → documentos-recebidos`. Sem import dinâmico; smoke test inspeciona index.html real para exactly-once e ordem.
- **Validação local:** `node --check` em 4 arquivos; 11 integration, 135 screen smoke, 58 queue UI, 68 controller, 41 modal, 96 lifecycle, 59 adapter, 46 reader, 23 migration contract, 48 queue read model — 585 pass/0 fail.
- **Git diff check:** aprovado com aviso LF→CRLF informacional não bloqueante.
- **Revisão independente:** OpenCode `opencode-go/deepseek-v4-flash`, read-only, retornou `APPROVE` sem mutação.
- **Staging:** não acessado.
- **Produção:** projeto `bhgifjrfagkzubpyqpew` não acessado.
- **Push:** não executado.
- **D4 aceito:** D4-V1 rejeitado; D4-R1 aceita como a integração runtime canônica corrigida. D4 e R1 agora CLOSED / ACCEPTED.
- **Risco residual:** aviso LF→CRLF não bloqueante; nenhuma pendência técnica identificada.
- **D5:** não iniciado e não autorizado. D5 e quaisquer mudanças remotas, de banco, linking, undo/revogação ou ampliação de UI requerem nova decisão arquitetural explícita.
- **Próxima decisão indicada:** D5 — indeferido e não autorizado.

---

## 2026-07-14 — G28-B5-D5-A / G28-B5-D5-B1 — Explicit document source boundary

- **G28-B5-D5-A:** diagnóstico read-only; defeito confirmado: source ausente era tratado implicitamente como legacy. Decisão: ausência de `_ravatex_source` não significa legacy.
- **G28-B5-D5-B1:** implementação do boundary explícito; commit técnico `2bac73d0f386ca61a53548d304b98e076fbb06ef` — `G28-B5-D5-B1: enforce explicit document source boundary`.
- **Manifesto técnico:**
  - `js/screens/documentos-recebidos.js`
  - `tests/documentos-recebidos-source-boundary.test.js`
  - `tests/documentos-recebidos-decision-integration.test.js`
  - `tests/documentos-recebidos.smoke.js`
- **Classificação:** `supabase | legacy | unknown`.
- **Boundary:** `unknown` fail-closed; Supabase preservado; `legacy`/`manual` explícito preservado; fallback G22 sem source tratado como `unknown`.
- **Validação:** gates verdes; revisão independente `APPROVE`; telemetria partial e não bloqueante.
- **Acessos remotos:** sem staging; sem produção; sem push.
- **Próxima fase:** D5-B2, D5-B3 e D5-B4 não iniciadas.

---

## 2026-07-14 — G28-B5-D5-B2 — Harden local decision helpers and explicit legacy call sites

- **Gate:** `CLOSED / ACCEPTED_WITH_PREEXISTING_TEST_DEBT`; auditoria V1 `VERIFIED`.
- **Baseline técnico:** `ff15d0c`.
- **Commit técnico final:** `c51542244ab6e3c683a1a0a54fcc634df6f7478d` — `G28-B5-D5-B2: require explicit legacy source for local decisions`.
- **Amend excepcional:** somente correção de mensagem do commit `b483620c5248665614e576b2f7c742c9fcd08dea`; tree preservada `66cad0f089e56b94c4c0471d442e33fa162d3443`.
- **Manifesto literal:**
  - `js/documents-ingestor-import-received.js`
  - `js/documents-ingestor-loader.js`
  - `js/documents-ingestor.js`
  - `js/screens/documentos-recebidos.js`
  - `tests/documentos-recebidos-source-boundary.test.js`
  - `tests/documents-ingestor-loader.test.js`
  - `tests/documents-ingestor-local-decision-boundary.test.js`
  - `tests/g14-c-bridge-smoke.test.js`
- **Mudança funcional:** helpers locais endurecidos; somente provenance explícita `manual`/`legacy` permite decisão local. Provenance explícita foi materializada no loader/bridge por documento; source ausente e `g22-auto` são `unknown`; Pedido Detail foi preservado e recebe o documento materializado.
- **Proporção:** 87 inserções e 23 remoções em produção; 804 inserções e 22 remoções em testes; classificação `SCOPE_PROPORTIONATE`.
- **Validação:** gates obrigatórios verdes; revisão independente read-only `APPROVE`; nenhuma regressão nova.
- **Dívida preexistente:** 2 falhas em `tests/documents-ingestor.test.js` e 15 falhas em `tests/g14-c-bridge-smoke.test.js`, idênticas ao baseline.
- **Acessos:** sem staging, produção, Supabase ou push.
- **Próxima fase indicada:** `G28-B5-D5-B3 — REMOVE STATUSOVERRIDES`; D5-B3/D5-B4 não iniciadas.

---

## 2026-07-14 — G28-B5-D5-B3 — Remove local decision status overrides

- **Gate:** `CLOSED / ACCEPTED`.
- **Baseline técnico:** `3f12bd0` (`3f12bd015d233b8686a8d495435e17294cf66b12`).
- **Commit técnico:** `3532aa8` (`3532aa8417281fbc0f143963a1e7ef44b73cc2e7`) — `G28-B5-D5-B3: remove local decision status overrides`.
- **Manifesto literal:**
  - `js/screens/documentos-recebidos.js`
  - `tests/documentos-recebidos-source-boundary.test.js`
  - `tests/documentos-recebidos-status-overrides-removal.test.js`
- **Causa raiz:** falha de persistência local podia simular visualmente estado aceito/rejeitado.
- **Mudança efetiva:** remoção completa de `statusOverrides` do runtime; nenhum estado paralelo substituto foi criado.
- **Comportamento de falha:** save/remove local exibem erro explícito e preservam o status real ou a decisão persistida; sucesso rerenderiza a partir da persistência real.
- **Proveniência preservada:** `manual`/`legacy` permanecem elegíveis para decisões locais; Supabase permanece canônico/cloud-only; unknown, ausente, inválido, vazio, `null` e `g22-auto` permanecem fail-closed.
- **Validação:** gate focado 26/26; todos os gates prescritos verdes; node checks e diff checks aprovados; revisão independente `APPROVE`; code health `+13/-12`.
- **Telemetria:** `TELEMETRY_STATUS: partial`; `TELEMETRY_RUN_IDS: 7a2b1ac6-2114-4cd2-a99a-4a57005991c2`; `TELEMETRY_FAILURES: invalid_outcome, arguments_invalid`; não bloqueante.
- **Acessos:** zero staging, produção, Supabase, SQL, migration e push.
- **Escopo:** B2 helpers, RPCs, banco e fluxo canônico não foram alterados; D5-B4 não foi iniciada.
- **Próxima fase nomeável:** `G28-B5-D5-B4 — BLOCK LEGACY DECISION RPC RUNTIME CONSUMERS`; não criar nem iniciar.

---

## 2026-07-14 — G28-B5-D5-B4 — Record legacy decision RPC runtime removal closeout

- **Gate:** `CLOSED / ACCEPTED`.
- **Technical HEAD:** `3d64b62f25516ef0d18e2613fc50298e2faee16a` — `G28-B5-D5-B4: remove legacy document decision RPC runtime`.
- **Manifesto literal:**
  - `js/documents-supabase-decisions.js`
  - `tests/documentos-recebidos.smoke.js`
  - `tests/documents-supabase-decisions.test.js`
  - `tests/document-legacy-decision-rpc-runtime-boundary.test.js`
- **Removals:**
  - `decideDocumentInCloud` (function) removed.
  - `window.RAVATEX_DOCUMENTS.decideDocumentInCloud` removed.
  - Zero JavaScript runtime calls to `decidir_documento`.
- **Preserved:**
  - `registerDocumentDecisionInCloud` and `registrar_decisao_documento` (canonical command adapter).
  - `undoDocumentDecisionInCloud` and `desfazer_decisao_documento` (undo adapter).
  - SQL `decidir_documento` was not removed.
- **Validation:** focused gates green; independent review `APPROVE`.
- **Access:** no external, database, staging, production, migration, or push access.
- **Telemetry:** unavailable and non-blocking.
- **Residual risk:** external consumers of `decidir_documento` outside this repository may exist.
- **Next phases:** `G28-B5-D5-B5` and `G28-B8` remain unauthorized and not started.

---

## 2026-07-14 — G28-B5-D5-B4-C-R1 — Documentary closeout correction

- **Corrected phase identifier:** `G28-B5-D5-B4-C` (the prior entry was imprecisely named).
- **Canonical documentary HEAD** (before this correction): `18afe021f54e422b7fe54ed60f26e49e402f41db` — `G28-B5-D5-B4-C: record legacy decision RPC runtime removal closeout`.
- **Technical HEAD** remains: `3d64b62f25516ef0d18e2613fc50298e2faee16a` — `G28-B5-D5-B4: remove legacy document decision RPC runtime`.
- **Corrected residual risk:** external consumers of `window.RAVATEX_DOCUMENTS.decideDocumentInCloud` may exist and will no longer find that export. The prior residual risk statement incorrectly described the risk as concerning SQL `decidir_documento`.
- **SQL `decidir_documento`** remains preserved.
- **Nature of prior entry:** the prior entry was not a technical-state change; it contained phase identifier imprecision and residual risk scope imprecision only. No code, tests, SQL, or package files were modified by this correction.

---

## 2026-07-14 — G28-B5-D5 — Consolidated regression and residual legacy decision closeout

- **Gate:** `CLOSED / ACCEPTED`.
- **B1 — explicit source boundary:** `CLOSED / ACCEPTED`.
- **B2 — source-gated local decision helpers:** `CLOSED / ACCEPTED_WITH_PREEXISTING_TEST_DEBT`.
- **B3 — removal of statusOverrides:** `CLOSED / ACCEPTED`.
- **B4 — removal of legacy JavaScript decision RPC consumer:** `CLOSED / ACCEPTED`.
- **B5 — consolidated regression and residual legacy decision:** `CLOSED / ACCEPTED`.
- **Technical commits:**
  - B1: `b247e43504c0afcc0d25e95f8012f93a09eb0692` — `Add idempotent document decision command contract`
  - B2: `c51542244ab6e3c683a1a0a54fcc634df6f7478d` — `G28-B5-D5-B2: require explicit legacy source for local decisions`
  - B3: `3532aa8417281fbc0f143963a1e7ef44b73cc2e7` — `G28-B5-D5-B3: remove local decision status overrides`
  - B4: `3d64b62f25516ef0d18e2613fc50298e2faee16a` — `G28-B5-D5-B4: remove legacy document decision RPC runtime`
- **Documentary closeout commits:**
  - B4-C: `18afe021f54e422b7fe54ed60f26e49e402f41db` — `G28-B5-D5-B4-C: record legacy decision RPC runtime removal closeout`
  - D5 (this closeout entry): documentary commit containing this entry; resolve the final HEAD with `git rev-parse HEAD` after commit.
- **Syntax checks (all exit 0):**
  - `node --check js/documents-supabase-decisions.js`
  - `node --check js/documents-ingestor.js`
  - `node --check js/screens/documentos-recebidos.js`
- **Focused tests (all exit 0):**
  - `documents-supabase-decisions.test.js`: 47 pass / 0 fail
  - `documentos-recebidos-decision-integration.test.js`: 11 / 0
  - `documentos-recebidos.smoke.js`: 135 / 0
  - `document-legacy-decision-rpc-runtime-boundary.test.js`: 3 / 0
  - `documents-decision-controller.test.js`: 68 / 0
  - `documentos-recebidos-decision-modal.test.js`: 41 / 0
  - `documents-decision-command.test.js`: 96 / 0
  - `documents-supabase-reader.test.js`: 46 / 0
  - `document-decision-command-contract.test.js`: 23 / 0
  - `document-queue-read-model.test.js`: 48 / 0
  - `documentos-recebidos-source-boundary.test.js`: 14 / 0
  - `documentos-recebidos-status-overrides-removal.test.js`: 12 / 0
  - `documents-ingestor-local-decision-boundary.test.js`: 40 / 0
  - **Total: 584 pass / 0 fail**
- **Runtime static counts:**
  - `D5_REGRESSION_GREEN`
  - `RUNTIME_DECIDIR_DOCUMENTO_CALLS=0`
  - `RUNTIME_DECIDE_DOCUMENT_IN_CLOUD_EXPORTS=0`
  - `RUNTIME_STATUS_OVERRIDES=0`
  - `CANONICAL_REGISTER_ADAPTER_PRESENT=1`
  - `CANONICAL_REGISTER_RPC_CALL_PRESENT=1`
  - `CANONICAL_UNDO_ADAPTER_PRESENT=1`
  - `CANONICAL_UNDO_RPC_CALL_PRESENT=1`
  - `SQL_DECIDIR_DOCUMENTO_PRESENT=1`
- **Known historical debt (not blocking, identical to baseline):**
  - `tests/documents-ingestor.test.js`: 2 known failures
  - `tests/g14-c-bridge-smoke.test.js`: 15 known fixture failures
- **Binding residual decision:** The explicit manual/legacy local decision domain remains temporarily supported. Only documents explicitly classified as manual or legacy may read, write, or remove local decisions. Supabase, unknown, absent, empty, null, invalid, and g22-auto sources must remain fail-closed and must never use local decision persistence. D5 does not authorize migration, automatic conversion, database removal, or removal of the explicit legacy local decision domain. Any future migration or removal of the legacy domain requires a separate read-only diagnosis and explicit architect authorization. This does not preserve or authorize silent fallback, source inference, local persistence for Supabase/unknown, visual parallel state, `decideDocumentInCloud`, JavaScript calls to `decidir_documento`, aliases, proxies, wrappers, or stubs.
- **Residual external-consumer risk:** External consumers of `window.RAVATEX_DOCUMENTS.decideDocumentInCloud` outside this repository may exist and will no longer find that export.
- **SQL and canonical register/undo preservation:** SQL `decidir_documento` preserved (not removed, not migrated). Canonical register adapter `registerDocumentDecisionInCloud`/`registrar_decisao_documento` preserved. Canonical undo adapter `undoDocumentDecisionInCloud`/`desfazer_decisao_documento` preserved.
- **Access:** No remote access. No staging, production, Supabase, database, network, MCP, or push.
- **Next phases:** B6 and B8 not started. No next phase authorized. Any future implementation requires separate architect authorization.

---

## 2026-07-14 — G28-PLAN-R1 — Documentary plan/state/handoff/ledger reconciliation

- **Gate:** RECONCILIATION EXECUTED (docs-only, no runtime/code/SQL/migration/test/staging/production/push)
- **Cause:** canonical plan, state, handoff and ledger exhibited drift after accepted phases G28-B5-D5 and prior; stale active-phase text in master plan incorrectly implied G28-P0 active; matrix showed B3 IN_PROGRESS, B4 PLANNED, B5 PLANNED when all are accepted; header referenced G27 as last milestone; plan suggested reentering B1 after approval
- **Authority files used for evidence:** `PROJECT_STATE.md`, `AGENT_HANDOFF.md`, this ledger, `docs/architecture/DOCUMENTOS_VALIDACAO_VINCULOS_E_EVOLUCAO_PLANO.md`, `docs/governance/DOCUMENTATION_MODEL.md`
- **Verified checkpoint:**
  - Last fully accepted TECHNICAL block: `G28-B5-D5` — `CLOSED / ACCEPTED`
  - Baseline: `7d3e0261b668a46a80208198352039dc1f352010` (branch `work/g28-document-qualification`, clean worktree/index, no untracked)
  - No active implementation phase
  - Next authorizable action: none; requires architect authorization
  - Open architect decisions: Documento↔Pedido cardinality/relationship; Documento↔OP cardinality including multiplicity/representation; required/optional links per document type; compatibility (Documento↔OP proven open; no accepted cardinality decision exists)
- **B6 classification:** PLANNED / DIAGNOSED (architectural boundaries only) / NOT DECIDED / NOT IMPLEMENTED / NOT ACCEPTED
  - No B6 contract, schema, RPC, read-model, or UI accepted
  - Existing `document_candidates.pedido_id` / `document_events.pedido_id` (db/38_documentos_schema.sql, commit 5a92a436) and B4 display-only queue read model are noncanonical pre-B6 evidence; they do not establish accepted canonical Documento↔Pedido cardinality or link contract
  - G28-B6-B: PLANNED / NOT STARTED; no accepted definition, contract, or implementation evidence
  - B1 and accepted B5 decision-command contract did not implement canonical linking
  - No B6/B6-A/B6-B commits in Git history; no `document_pedido_*`, `document_op_*`, or B6 schema/RPC/read-model/UI found
  - G28-B1 plan lines 560–568 documented architectural boundaries/open decisions (cardinality/multiplicity, required/optional links, incompatible link treatment). This is a completed architectural-boundary diagnosis, not a completed architect cardinality decision and not B6 implementation
  - Documento↔OP cardinality remains open from B1 plan lines 511–519
- **Deferred/not-started:** B6, B7, B8
- **Files modified:** `docs/architecture/DOCUMENTOS_VALIDACAO_VINCULOS_E_EVOLUCAO_PLANO.md` (added CURRENT EXECUTION CHECKPOINT, updated header, matrix, subphase section, allowed states, closure criteria, next-action section), `PROJECT_STATE.md` (compacted operational state, added open decisions, deferred phases, active-phase=none), `AGENT_HANDOFF.md` (mandatory reading list, reconciliation baseline, prohibition on numbering inference), this ledger (this entry), `docs/governance/DOCUMENTATION_MODEL.md` (added §17 PHASE CHECKPOINT RECONCILIATION)
- **No activity:** no code, SQL, migration, runtime, test, staging, production, Supabase, network, MCP, or push executed by this reconciliation
- **Next indicated:** any future B6 order must use this reconciled checkpoint, not phase numbering; reconcile master plan before issuing any future order

---

## 2026-07-14 — G28-B6 — Canonical document links (Documento↔Pedido / Documento↔OP)

- **Gate:** `READY FOR IASUP ACCEPTANCE` — `IMPLEMENTED LOCALLY / STAGING VERIFICATION BLOCKED`. No Supabase MCP/CLI is available in this environment; staging `ucrjtfswnfdlxwtmxnoo` was not accessed and `db/51` was not applied. Not `CLOSED`, not `ACCEPTED`; G28-B7 not authorized.
- **Approved contract implemented:** Documento→Pedido `0..1` confirmed; Documento→OP `0..N` confirmed. Dedicated, typed, versioned canonical persistence. `document_candidates.pedido_id` / `document_events.pedido_id` NOT promoted/populated/reinterpreted; `pedido_manual` remains suggestion only.
- **Schema (additive, versioned, NOT applied):** `db/51_document_canonical_links.sql` — `document_link_revisions` (one complete link-state revision per document: `pedido_id` nullable, `version`, `active`, unique `command_id`, `created_by/at`, `revoked_by/at/reason`; typed FKs to `document_candidates(document_id)`, `pedidos(id)`, `auth.users`; unique `(document_id, version)`; partial-unique active revision per document; active/revocation CHECK; ON DELETE RESTRICT preserving audit) and `document_link_revision_ops` (PK `(revision_id, op_id)`; typed FKs to revision and `ops(id)`). Admin-only RLS + grants mirroring `db/38`.
- **RPCs (SECURITY DEFINER, admin-only, idempotent):**
  - `registrar_vinculos_documento(TEXT, UUID, BIGINT[], UUID, UUID)` — advisory lock by `command_id`, candidate `FOR UPDATE`, existence/not-cancelled/compatibility (OP→Pedido via `lotes.pedido_id`) fail-closed, revokes prior active revision without deleting; bounded outcomes (created, updated, no_change, replayed, active_revision_exists, stale_active_revision, command_conflict, candidate_not_found, duplicate_op, pedido_not_found, pedido_not_linkable, op_not_found, op_not_linkable, op_pedido_mismatch, op_not_avulsa, input_error, auth_error).
  - `registrar_decisao_e_vinculos_documento(...)` — atomic composition of `registrar_vinculos_documento` + `registrar_decisao_documento` (B5 preserved, unchanged), full rollback via block savepoint if either fails; allows explicit empty-link state; does not merge link data into `document_decisions`.
- **Runtime:** `js/documents-supabase-links.js` (register / atomic apply / read active revision / read linkable targets — reads are read-only); `js/documents-validation-command.js` (idempotent lifecycle, two command ids reused on retry); `js/documents-supabase-reader.js` attaches `_ravatex_link_revision` (fail-closed `unavailable`, never silent "no links"); `js/document-queue-read-model.js` confirmed Pedido only from the active revision (candidate `pedido_id` ignored), OP projection replaces the unavailable placeholder, cancelled-target warnings; `js/screens/documentos-recebidos-decision-modal.js` completes "Validar e vincular" (suggestion shown separately, Pedido `0..1`, OP `0..N` compatibility-filtered, non-blocking NF/romaneio warning); screen routes accept→atomic action, reject/undo on the existing canonical paths; `index.html` loads the two new modules.
- **Preserved / not created:** `registrar_decisao_documento`, `desfazer_decisao_documento`, SQL `decidir_documento` (no runtime caller). No `documentos_operacionais`, no generic `document_links(target_type,target_id)`, no scalar `op_id` on candidates, no confirmed-link write to `document_candidates.pedido_id`, no dual writes, no backfill, no localStorage/fallback/aliases/service-role in the cloud runtime.
- **Local focused tests (green):** 654/654 across the document battery, incl. new files: `document-canonical-links-contract` (21), `documents-supabase-links` (13), `documents-supabase-reader-links` (4), `documents-validation-command` (10); updated `document-queue-read-model` (59), `documentos-recebidos-decision-modal` (52), `documentos-recebidos-decision-integration` (11), `documentos-recebidos.smoke` (135). `git diff --check` clean (non-blocking LF→CRLF warnings); `node --check` on all changed JS.
- **Pre-existing debt unchanged:** `documents-ingestor.test.js` 2 fail; `g14-c-bridge-smoke.test.js` 15 fail (identical to baseline).
- **Access:** no staging, production, Supabase, applied migration, network, MCP, or push. `db/51` versioned and NOT applied.
- **Commit:** single local commit `G28-B6: implement canonical document links` (resolve final HEAD with `git rev-parse HEAD` after commit).
- **Residual risk:** staging unverified — tables/columns/types/constraints/indexes/RLS/policies/grants/RPC signatures/idempotent replay/compatibility must be applied and verified in `ucrjtfswnfdlxwtmxnoo` before acceptance; wrapper atomicity depends on savepoint behavior under real execution; historically under-populated `lotes.pedido_id` limits linkable OPs (avulsa rule covers, no backfill).
- **Next indicated (not authorized):** apply + verify `db/51` in staging, then `G28-B7` (surface display) requires explicit architect authorization.

---

## 2026-07-14 — G28-B6 — Direct staging verification and closeout

- **Gate:** `STAGING FUNCTIONALLY VERIFIED / READY FOR ARCHITECT ACCEPTANCE`; not `CLOSED` or `ACCEPTED`. `G28-B7` remains `NOT AUTHORIZED`.
- **Operator / mode:** Hermes / `gpt-5.6-terra`, direct Supabase MCP execution; no delegation for Supabase. Workspace `D:\OneDrive\Programação\Ravatex\controle-tapetes-g28`, branch `work/g28-document-qualification`, initial HEAD `b2f180ed0e6f1c2ee6c02881d0199d1bfaf29366`, clean worktree.
- **Scope and safety:** staging `ucrjtfswnfdlxwtmxnoo` only; production `bhgifjrfagkzubpyqpew` not accessed; no secrets recorded; no push. Fixture marker `G28-B6-VERIFY-c63b6c2c8aff4da58e87d1e75f7a9236` was isolated from production data.
- **Contract evidence:** live `document_link_revisions` / `document_link_revision_ops`, dependent columns, RLS/grants and the four critical RPCs were inspected. `registrar_vinculos_documento` exercised 20 cases: valid Pedido/OP, duplicate/replay/no_change, expected-active conflict/stale, missing/cancelled targets, Pedido↔OP mismatch, avulsa-only rule and validation outcomes; result `20/20`.
- **Ownership and read-model evidence:** canonical revisions changed while `document_candidates.pedido_id`, `document_candidates.pedido_manual` and `document_events.pedido_id` remained byte-for-byte as fixture input. Reader projection exposed active revision Pedido/OP/statuses; frontend configured for staging returned explicit `supabase_unavailable` when its link source was removed and did not write.
- **Atomic wrapper evidence:** `registrar_decisao_e_vinculos_documento` covered success, duplicate/retry/conflict, invalid link and a decision-side failure after a valid link request. The latter returned `decision_failed` and proved `no_new_revision`, `no_new_decision`, prior active revision and OP rows preserved (PostgreSQL rollback).
- **Functional UI evidence:** local app was served temporarily with staging configuration and confirmed the staging URL. Authenticated modal smoke was not executable because no admin browser session was available: `LIVE_MODAL_SMOKE_BLOCKED_BY_TOOLING`; this is a residual risk, not a backend failure.
- **Fixture cleanup:** deleted event, decision, OP B, cancelled OP, cancelled Pedido and the unreferenced lot B; restored candidate to `pending` with `accepted_at/rejected_at = NULL`. Remaining restrictive audit graph is explicit: 1 client, 2 Pedidos, 2 lotes, 4 OPs, 1 candidate, 8 link revisions and 10 link-revision OP rows. It was intentionally retained because deleting audit children to force cleanup would destroy the approved `ON DELETE RESTRICT` history.
- **Cause / corrective action:** no B6 technical defect was found; no code/schema/runtime patch made. Documentation state only was corrected.
- **Local validation:** B6 affected source battery (10 files) `374 pass / 0 fail`. Extended 14-file document battery `641 pass / 2 fail`: two pre-existing stale expectations in `tests/documentos-recebidos-queue-ui.test.js` expect candidate-based Pedido/OP presentation contradicted by B6 canonical revision behavior (`candidate.pedido_id` ignored; no active OP projects `no_confirmed_op`). No JS changed during this closeout and no correction was authorized.
- **Files changed in closeout:** `PROJECT_STATE.md`, `AGENT_HANDOFF.md`, `docs/architecture/DOCUMENTOS_VALIDACAO_VINCULOS_E_EVOLUCAO_PLANO.md`, this ledger.
- **Residual risks:** authenticated live-modal smoke pending browser admin auth; two stale queue-ui assertions as above; architect acceptance pending. Next step is architect acceptance only; no B7 work, migration, backfill, repair or push.

---

## 2026-07-14 — G28-B6 — Architect acceptance and G28-B7 authorization

- **Gate:** `CLOSED / ACCEPTED_WITH_NONBLOCKING_TEST_DEBT`. Explicit architect decision recorded in this session; it intentionally supersedes the prior checkpoint that still described G28-B6 as `READY FOR ARCHITECT ACCEPTANCE`. Not an inference from phase numbering.
- **Technical implementation commit:** `b2f180ed0e6f1c2ee6c02881d0199d1bfaf29366` — `G28-B6: implement canonical document links`.
- **Staging verification closeout commit:** `b130db44d32718ddf6d3e2bffb1439dac3a1948f` — `docs(G28-B6): record staging verification closeout`.
- **Staging project:** `ucrjtfswnfdlxwtmxnoo`. Production `bhgifjrfagkzubpyqpew` not accessed. No push.
- **Accepted non-blocking debts:**
  1. authenticated browser smoke remains pending;
  2. two stale expectations remain in `tests/documentos-recebidos-queue-ui.test.js`;
  3. the synthetic staging audit graph remains preserved under `ON DELETE RESTRICT` and is documented.
- **Accepted B6 contract (unchanged):** Documento→Pedido `0..1` confirmed; Documento→OP `0..N` confirmed; canonical source `document_link_revisions` / `document_link_revision_ops`; `document_candidates.pedido_id` / `document_events.pedido_id` remain Ingestor-owned; `pedido_manual` remains suggestion only.
- **Authorization:** `G28-B7` (exibição nas superfícies) is explicitly authorized. No later phase (`G28-B8`+) is authorized.
- **Next authorizable action:** implement `G28-B7` per master plan §CAMADA 1 / §SEQUÊNCIA DE IMPLEMENTAÇÃO — G28-B7.

---

## 2026-07-14 — G28-B7 — Surface display of canonical document links (Pedido detail increment)

- **Gate:** `IMPLEMENTED / TESTED (local) / READY FOR ARCHITECT ACCEPTANCE`. Not `CLOSED`, not `ACCEPTED` (IAexec does not self-close). No later phase authorized.
- **Scope implemented:** canonical reverse projection ("documents linked to a target") + wiring on the **Pedido detail** admin surface, which previously presented `pedido_manual` matches as if they were links (a B6-contract violation). All surfaces now consume the same canonical projection.
- **New pure read model:** `js/document-surface-links-read-model.js` — `RAVATEX_DOCUMENT_SURFACE_LINKS.buildLinkedDocumentsForPedido(pedidoId)` and `buildLinkedDocumentsForOp(opId)`. Read-only; derives confirmed links **only** from the active canonical revision attached by the reader (`_ravatex_link_revision`). `pedido_manual`, `candidate.pedido_id`, CNPJ and technical evidence are never read as links. Explicit states: `loading | invalid | unavailable | empty | available` (fail-closed — never a silent "no links"). No writes, no DOM, no network.
- **Pedido detail wiring:** `js/screens/pedido-detail-progress.js` computes `linkedDocumentRows` / `linkedDocumentsState` from the read model (guarded, fail-closed to `unavailable` when the module or globals are absent). `js/screens/pedido-detail-render.js` renders a `DOCUMENTOS VINCULADOS` section (confirmed-only, "Vinculo confirmado" pill, revision version, linked-OP ids, cancelled-target warning, explicit empty/unavailable states) and relabels the pre-existing Ingestor section as suggestions (not confirmed links). `index.html` loads the new module.
- **Distinct from suggestions:** confirmed canonical links (new section) vs `pedido_manual` Ingestor suggestions (existing section, now explicitly labeled). No inference, no dual write, no new writer, no generic polymorphic link, no `documentos_operacionais`, no B8 correction/revocation UI, no OP-lifecycle/inventory/financial change.
- **B6 stale test debt resolved (in this commit):** `tests/documentos-recebidos-queue-ui.test.js` — (1) `getPedidoOptions` no longer expects `uuid-ped` from `candidate.pedido_id`; (2) OP state expectation corrected from `unavailable` to `no_confirmed_op` (`{ state:'no_confirmed_op', op_ids:[] }`). Behavioral assertions preserved.
- **New focused tests:** `tests/document-surface-links-read-model.test.js` (14) — confirmed pedido/op, multiple OPs `0..N`, suggestion-vs-confirmation, cancelled target, unavailable/loading/invalid, non-supabase never confirmed. `tests/pedido-detail-linked-documents.smoke.js` (6) — view model + `buildDocuments` DOM for available/empty/unavailable.
- **Tests (LF, exit 0):** document surface links 14/14; pedido-detail-linked-documents 6/6; queue-ui 58/58; full document battery + pedido-detail-linked-ops + documents-ingestor-ui-smoke 475/475; B5-D5 document regression 303/303. `node --check` on all changed JS; `git diff --check` clean (informational LF→CRLF only).
- **Pre-existing debt unchanged:** `tests/pedido-detail.smoke.js` has 41 pre-existing failures driven by CRLF working-tree line endings breaking `\n`-anchored source-slice regexes over other untouched files (op-latex-admin, op-nova, entrega-form); identical set with and without this change (verified against the LF baseline). `tests/documents-ingestor.test.js` and `tests/g14-c-bridge-smoke.test.js` pre-existing failures also unchanged.
- **Not wired this increment (mechanism ready, reported remaining B7 work):** OP detail surface (`op-latex-admin` document card is an intentional Drive-attachment stub, not a linked-documents display; a green smoke asserts its stub text), Pedido/OP timeline canonical entries, and a dedicated global document search. The canonical central Documentos queue and its `pedido_state` filters were already canonical from B6. `buildLinkedDocumentsForOp` is implemented and tested and is the ready consumer for the OP surface.
- **Remote verification required (not performed — Supabase access prohibited for Claude):** authenticated admin rendering of the Pedido-detail `DOCUMENTOS VINCULADOS` section against staging `ucrjtfswnfdlxwtmxnoo` with a document whose active revision links the Pedido; confirm confirmed-vs-suggestion separation and the empty/unavailable states in the live app. No new remote queries were introduced (the projection reads the already-loaded reader output).
- **Access:** no push; no production; no Supabase; no migration; no network.
- **Commit:** single local commit `G28-B7: display canonical document links on Pedido detail` (resolve final HEAD with `git rev-parse HEAD` after commit).
- **Next indicated (not authorized):** architect acceptance of this B7 increment and/or explicit authorization to continue the remaining B7 surfaces. `G28-B8` remains unauthorized.

---

## 2026-07-14 — G28-B7 — Complete canonical link display surfaces (continuation)

- **Gate:** `IMPLEMENTED / TESTED (local) / READY FOR ARCHITECT ACCEPTANCE`. Same-phase continuation of the entry above; not a new phase, not `CLOSED`, not `ACCEPTED` (IAexec does not self-close). `G28-B8` remains unauthorized.
- **Antecedent:** partial Pedido-detail B7 commit `ed35f049397af4061ed6e8bb2d9ec3056c543724` (Pedido detail only). A prior session exhausted credits after implementing the remaining B7 surfaces and running tests, before documentation closeout and commit. This continuation recovers, audits, verifies and commits that work without redesign.
- **Surfaces completed in this continuation:**
  - **OP detail:** `js/screens/op-latex-admin.js` and `js/screens/op-tecelagem-producao-admin.js` now render `Documentos vinculados` (confirmed canonical links via `buildLinkedDocumentsForOp`) and append canonical document-link timeline entries. The pre-existing Drive-attachment slots are preserved as the visual-only attachment layer, unchanged.
  - **Pedido / OP canonical timeline:** `js/document-surface-links-read-model.js` gains `buildDocumentLinkTimelineForPedido` / `buildDocumentLinkTimelineForOp` and `TIMELINE_KIND` (`linked`/`replaced`/`unlinked`). Ordered newest-first; confirmed-only by default; an OP entry is included ONLY when the OP is explicitly in the revision's typed OP children — never inferred via Pedido membership. Pedido detail renders a `LINHA DO TEMPO DOS VINCULOS` block; `js/screens/pedido-detail-progress.js` exposes `linkedDocumentTimeline` in the view model.
  - **Global canonical search/filtering:** `js/screens/documentos-recebidos-queue-ui.js` adds `matchesConfirmedPedido`, `matchesConfirmedOp`, `matchesLinkAvailability` (filter axis `all`/`available`/`unavailable`), `getConfirmedOpOptions`, and the `confirmedPedidoId` / `confirmedOpId` / `linkAvailability` criteria wired into `filterQueue`. A confirmed Pedido filter matches ONLY the active canonical revision's `pedido_id`; a confirmed OP filter matches ONLY OPs explicitly present in the active revision's typed OP children; `pedido_manual` and `candidate.pedido_id` never satisfy a confirmed filter; unavailable link source is fail-closed.
  - **Shared surface UI helper:** new `js/document-links-surface-ui.js` (`window.RAVATEX_DOCUMENT_LINKS_UI`) — pure, dependency-injected DOM builders `buildLinkedDocumentNodes` and `buildLinkTimelineNodes` consumed by the OP surfaces and the Pedido-detail timeline. No Supabase, no writes, no globals beyond injected `el`/`svgEl`. `index.html` loads it statically.
- **Contract preserved (B6/B7):** confirmed links read only from the active canonical revision (`_ravatex_link_revision`); `document_candidates.pedido_id` and `pedido_manual` remain Ingestor-owned suggestions; no writers, no localStorage, no parallel state, no OP/Pedido/inventory/production/financial lifecycle change, no B8 correction/revocation UI.
- **Tests (LF, exit 0):**
  - `node --check` on every changed JS (10 files) — all OK.
  - New focused `tests/document-links-surface.test.js`: **14/14** (timeline pedido/op projection + shared UI helper, incl. pedido_manual/candidate.pedido_id never confirmed, OP-not-present not inferred).
  - `tests/documentos-recebidos-queue-ui.test.js`: **69/69** (added 11 canonical search/filter cases; existing 58 preserved).
  - `tests/pedido-detail-linked-documents.smoke.js`: **7/7** (added canonical-timeline render case).
  - B4–B7 document battery (19 files): **616/616**.
  - OP + ingestor UI battery: **670 pass / 15 pre-existing** (see pre-existing comparison below). `op-latex-admin.smoke.js` (the OP file modified by this increment): **55/0**.
- **Pre-existing failure comparison (verified against baseline `ed35f04`):**
  - `tests/ops-list-screen.smoke.js` 11 fail, `tests/op-form-helpers.smoke.js` 3 fail, `tests/op-writes.smoke.js` 1 fail: stale-regex expectations that read `index.html` with a strict `<script\s+src="js/screens/cadastros\.js"\s*></script>` pattern ignoring the `?v=` cache-buster suffix; proven identical on baseline HEAD (`findScriptIdx` returns `-1` on both worktree and baseline). None of these files are modified by this increment. Classification: `STALE EXPECTATION` / `PRE-EXISTING`.
  - `tests/pedido-detail.smoke.js`: 140 pass / 41 fail (CRLF `\n`-anchored regexes over untouched files) — identical to the figure reported by the prior session and to baseline. Classification: `ENVIRONMENT / CRLF ARTIFACT` / `PRE-EXISTING`.
  - `tests/documents-ingestor.test.js`: 2 fail; `tests/g14-c-bridge-smoke.test.js`: 15 fail — unchanged from the B5-D5 ledger debt. Classification: `PRE-EXISTING`.
- **No corrections required:** the audited diff satisfies all 10 B7-contract review points; no working code was rewritten for style.
- **Remote verification required (not performed — Supabase access prohibited for Claude):** authenticated admin rendering of the new sections (Pedido-detail `DOCUMENTOS VINCULADOS` + timeline; OP-detail `Documentos vinculados` + timeline; queue canonical filters) against staging `ucrjtfswnfdlxwtmxnoo`. No new remote queries were introduced.
- **Access:** no push; no production; no Supabase; no migration; no network.
- **Commit:** single local commit `G28-B7: complete canonical link display surfaces` (resolve final HEAD with `git rev-parse HEAD` after commit).
- **Next indicated (not authorized):** architect acceptance of `G28-B7` (all surfaces implemented and tested locally). `G28-B8` remains unauthorized.

---

## 2026-07-14 — G28-B7 — Architect acceptance and G28-B8 authorization

- **Gate:** `CLOSED / ACCEPTED_WITH_NONBLOCKING_REMOTE_SMOKE_DEBT`. Explicit architect decision recorded in this session; not an inference from phase numbering.
- **Partial commit (Pedido-detail increment):** `ed35f049397af4061ed6e8bb2d9ec3056c543724`.
- **Completion commit (all surfaces):** `9ef61e1896af631bc5aeeced4af93c77051f4de4`.
- **Accepted contract:** canonical reverse projection consumed by every surface (Pedido detail, OP detail, Pedido/OP timeline, central Documentos search/filters) reads confirmed links **only** from the active canonical revision (`_ravatex_link_revision`); `pedido_manual` and `candidate.pedido_id` remain Ingestor suggestions and are never read as links; OP never inferred via Pedido membership; unavailable link source is fail-closed.
- **Accepted non-blocking debt:** authenticated staging smoke of the B7 Pedido, OP, timeline and search surfaces against `ucrjtfswnfdlxwtmxnoo` remains pending (Supabase prohibited for the local agent; no new remote queries were introduced).
- **Authorization:** `G28-B8` (correction / revocation / restoration / audit) is explicitly authorized. No phase after `G28-B8` is authorized.
- **Next authorizable action:** implement `G28-B8` per master plan §1.10 / §SEQUÊNCIA — G28-B8.

---

## 2026-07-14 — G28-B8 — Correction, revocation, restoration and audit of canonical links

- **Gate:** `IMPLEMENTED / TESTED (local) / READY FOR ARCHITECT ACCEPTANCE`. Not `CLOSED`, not `ACCEPTED` (IAexec does not self-close). No phase after `G28-B8` authorized.
- **Scope implemented:** the minimum complete contract for human administration of canonical document links, extending the single canonical command boundary (no competing writer):
  - **Correction** — replace the complete active link set with a corrected state (new revision; previous revision revoked, not deleted; requires the expected active revision id; idempotent; fails closed on stale/divergent state; records actor/timestamp/reason).
  - **Revocation / unlink** — register the canonical explicit empty-link state (`pedido_id` NULL, no OPs); previous linked revision preserved; reason + actor recorded; the Ingestor suggestion and the document decision are never touched.
  - **Restoration** — copy a selected historical revision's normalized Pedido/OP set into a NEW active revision, stamping `restored_from_revision_id`; the historical row is never reactivated or mutated; current Pedido/OP validity and compatibility are revalidated (fail-closed); optimistic concurrency + idempotency.
  - **Audit** — read-only trail of every append-only revision (version, active/revoked, Pedido, OPs, actor, created_at, revoked actor/at, reason, restoration source, command id), newest-first, with active-revision-uniqueness anomaly detection; fail-closed when history is unavailable.
- **Schema / RPC (additive migration `db/52_document_link_correction_revocation_restoration.sql`, NOT applied):**
  - Additive column `document_link_revisions.restored_from_revision_id UUID` (typed FK to `document_link_revisions(id)` ON DELETE RESTRICT + partial index). No backfill.
  - Evolved the single writer `registrar_vinculos_documento` (DROP of the 5-arg signature + recreate with two trailing DEFAULT NULL params `p_reason`, `p_restored_from_revision_id`): reason → `revocation_reason` of the superseded revision (COALESCE `'superseded'`); provenance stamped on the new revision. Five-arg positional callers (the B6 atomic wrapper) keep identical behavior. All B6 outcomes/locks/validation preserved; still no DELETE, no candidate/decision mutation, no inference.
  - New RPC `restaurar_vinculos_documento(...)` — reads the historical source (read-only), copies its normalized Pedido/OP set and delegates to `registrar_vinculos_documento` (no duplicated compatibility logic), stamping provenance; rejects `restore_source_not_found` / `restore_source_mismatch` and propagates the writer's fail-closed outcomes when the historical target is no longer valid.
  - Admin-only grants reapplied; PostgREST reload. Additive: no DROP TABLE; B5 decision RPCs and legacy `decidir_documento` untouched.
- **Runtime:** `js/documents-supabase-links.js` gains `loadDocumentLinkRevisionHistory` (full append-only history + OP children, read-only, fail-closed) and `restoreDocumentLinksInCloud` (→ `restaurar_vinculos_documento`); `registerDocumentLinksInCloud` carries an optional `reason` (sent only when present, preserving the accepted five-param shape for correction/unlink). New pure `js/document-link-audit-read-model.js` (ordered audit trail + active-uniqueness). New pure `js/document-link-admin-controller.js` (correction/revocation/restoration orchestration; in-memory command-id reuse on retry with the server RPC as idempotency authority; optimistic concurrency; outcome→UI mapping). New pure `js/screens/document-link-admin-modal.js` (inspect active links + full history, correct, unlink, restore; reason required; stale/conflict/unavailable fail-closed). Wired into the central Documentos queue only (`js/screens/documentos-recebidos.js`: guarded `handleLinkAdmin` + a per-row "Histórico e vínculos" action); read-only Pedido/OP display surfaces untouched. `index.html` loads the three new modules.
- **UI boundary:** the administrative surface lives only in the central Documentos queue (plan-authorized); no parallel generic admin screen; no mutation from Pedido/OP read-only surfaces. A human reason is required for every mutating action.
- **Local focused tests (LF, exit 0):** `document-link-correction-restoration-contract` 13/13; `document-link-audit-read-model` 11/11; `document-link-admin-controller` 18/18; `document-link-admin-modal.smoke` 12/12; `documents-supabase-links` 25/25 (12 new B8 cases). Full B4–B8 document/link battery (26 files) **831/831**. `node --check` on all five changed/new JS files; `git diff --check` clean (informational LF→CRLF only). Updated `document-decision-command-contract` allow-list to admit `db/52` (git-manifest gate), consistent with the db/51 precedent.
- **Regression:** B6 atomic validation + B7 read-only display surfaces remain green within the 831/831 battery. Pre-existing failures unchanged vs the B7 baseline: `pedido-detail.smoke.js` 140/41 (CRLF), `ops-list-screen.smoke.js` 19/11, `op-form-helpers.smoke.js` 33/3, `op-writes.smoke.js` 48/1 (stale index.html regexes over untouched files), `documents-ingestor.test.js` 2, `g14-c-bridge-smoke.test.js` 15.
- **Remote verification required (not performed — Supabase prohibited for the local agent):** apply + verify `db/52` in staging `ucrjtfswnfdlxwtmxnoo` (column, FK, index, evolved writer signature/grants, restoration RPC semantics, idempotent replay, optimistic concurrency, fail-closed restore of invalidated targets) and authenticated admin render of the link-admin modal (history, correct, unlink, restore, stale/conflict feedback). No new remote query shape beyond the additive history read.
- **Access:** no push; no production; no Supabase; no applied migration; no network. `db/52` versioned and NOT applied.
- **Commit:** single local technical commit including this closeout (resolve final HEAD with `git rev-parse HEAD` after commit).
- **Residual risk:** staging unverified — schema/RPC/idempotency/compatibility must be applied and verified in `ucrjtfswnfdlxwtmxnoo` before acceptance; the client controller keeps command-id reuse in memory (durable convergence relies on the server RPC idempotency, not sessionStorage).
- **Next indicated (not authorized):** architect acceptance of `G28-B8`. No phase after `G28-B8` is authorized.

---

## 2026-07-14 — G28-B8 — Direct staging deployment, verification and closeout

- **Gate:** `STAGING FUNCTIONALLY VERIFIED / READY FOR ARCHITECT ACCEPTANCE`; not `CLOSED` or `ACCEPTED`. No phase after B8 is authorized.
- **Operator / mode:** Hermes / `gpt-5.6-terra`, direct Supabase MCP; no delegation. Initial technical HEAD `f985f8b857f83d977936eae47ea830a5cb6ba4c3`, branch `work/g28-document-qualification`, clean worktree; production not accessed and no push.
- **Target/apply:** `https://ucrjtfswnfdlxwtmxnoo.supabase.co` proved the staging ref. Preflight found migration 52 absent, the five-argument writer active and the B6 wrapper as textual caller. The exact repository db/52 file was applied once; registry `20260715024449 / 52_document_link_correction_revocation_restoration`.
- **Proof:** UUID column, RESTRICT self-FK, partial index, evolved defaulted writer, restore RPC, SECURITY DEFINER/search_path/grants and unchanged B5 hashes were verified. Authenticated fixture `G28-B8-VERIFY` passed 18/18: correction/unlink/history, no-change/stale/replay/conflict, restoration/provenance/revalidation, audit/ownership and B6 wrapper compatibility. RPCs produced no operational side effects; all nine marker-residue categories are zero after cleanup.
- **Local:** B8 focused suite 79/79; five `node --check` and `git diff --check` passed before documentation.
- **Modal smoke:** `LIVE_B8_MODAL_SMOKE_BLOCKED_BY_TOOLING` — browser has neither the staging admin application nor an authenticated admin session; no auth was weakened.
- **Corrections:** none; staging did not prove a defect from the technical commit.
- **Residual / next action:** only architect acceptance of B8; G28-C/D and later phases remain deferred/not authorized.

---

## 2026-07-15 — G28-C — Direct staging validation closeout

- **Operator / target:** Hermes direct, staging `ucrjtfswnfdlxwtmxnoo`; no delegation, production access or push.
- **Harness / result:** harness-only fixture-order and assertion-variable defects were corrected; integrated database/canonical-projection matrix `16/16 PASS` covered technical evidence, decisions, B6 multi-OP linking, B8 correction/unlink/restoration/audit and canonical projections.
- **Proof / safety:** confirmed links derived only from `document_link_revisions` and `document_link_revision_ops`; Ingestor-owned candidate/event suggestion fields and Pedido/OP operational snapshots remained unchanged. No product, schema, RPC, migration or architecture defect was proven.
- **Cleanup / debt:** `G28-C-VERIFY` residue is zero in candidates, technical evidence, events, decisions, revisions, revision ops, pedidos, lotes, ops, clientes and fornecedores. `AUTHENTICATED_BROWSER_SMOKE_BLOCKED_BY_TOOLING`: no staging administrative application/session was available.
- **Gate:** `G28-C — READY FOR ARCHITECT ACCEPTANCE`, not closed or accepted. No later phase, including G28-D, is authorized.

---

## 2026-07-15 — G28-C — Architect acceptance recording

- **Decision:** `G28-C — CLOSED / ACCEPTED_WITH_NONBLOCKING_AUTHENTICATED_BROWSER_SMOKE_DEBT`.
- **Basis:** staging database/canonical projection matrix 16/16 PASS; no product, schema, RPC, migration, ownership or architectural defect; harness-only corrections; zero fixture residue; prior append-only ledger proof and canonical closeout commit `a7d7caa8984e56b44c0302bff5d578a8be5ff536`.
- **Residual / authority:** authenticated administrative browser smoke remains a non-blocking tooling debt. G28-D and later phases remain not authorized; no push and no production access.

---

## 2026-07-15 — G28-D — Release contract discovery and release-candidate preparation

- **Gate:** `RELEASE CONTRACT DISCOVERY COMPLETE / BLOCKED BY SPECIFIC MISSING DEPLOYMENT DEFINITION`; this is not acceptance, publication, or authorization of later phases.
- **Baseline / accepted lineage:** B8 technical `f985f8b857f83d977936eae47ea830a5cb6ba4c3`; B8 staging closeout `5c30c147601ac5b31e9fb09569cc057dee02de09`; C closeout `a7d7caa8984e56b44c0302bff5d578a8be5ff536`; C acceptance `d5ec09f803c2c64697ee3605b7d4ecfee168a66a`.
- **Discovery:** static root app has no build command. Historical repository text names GitHub Pages/main, but labels itself legacy; no current canonical publication mapping, exact push contract, production migration 51/52 state/apply procedure, rollback contract, or authenticated post-deploy smoke is defined in repository evidence.
- **Candidate:** `docs/releases/G28_D_RELEASE_CANDIDATE.md` records the source-backed fields, exact unknowns, migration prerequisites, local remote-ref relation, readiness checks and a deliberately empty publication-command contract.
- **Local checks:** selected B4–B8 document/link battery `901` pass / `0` fail; five B8 syntax checks and `git diff --check` passed. `services/documents-ingestor` combined `npm run build; npm test` timed out locally after 120 seconds without output; no dependency installation, network, production, Supabase access, push, tag, or publication occurred.
- **Blocker / next authority:** architect must define the current production provider/target/ref/command and authorize a production migration 51/52 verification/apply procedure before a publication plan can exist. Later phases remain unauthorized.

---

## 2026-07-15 — G28-STATE-RECONCILIATION-R1 — Canonical phase state reconciliation

- **Gate:** RECONCILIATION EXECUTED (docs-only; no code, SQL, migration, test, staging, production, push, remote)
- **Root cause:** documented canonical-state divergence. After G28-C architect acceptance and G28-D release-contract discovery, the master plan's CURRENT EXECUTION CHECKPOINT, phase matrix, PRÓXIMA AÇÃO section, AGENT_HANDOFF.md and PROJECT_STATE.md exhibited stale claims: checkpoint still described B7 as last accepted and B8 as active; matrix showed C as DEFERRED and D as DEFERRED; handoff cited B7 as last accepted and stated B8 acceptance pending; B8 classification was still READY FOR ARCHITECT ACCEPTANCE when it had been subsumed by C's gate.
- **Historical checkpoint:** `d5ec09f803c2c64697ee3605b7d4ecfee168a66a` (C acceptance).
- **Discovery HEAD:** `b27e79fdba1ed8fb8a6232d8e0b8ca4b37ac3a2c` (pre-reconciliation HEAD; worktree/index clean; no untracked).
- **Classification:** `MATERIAL_DIVERGENCE` — the canonical phase state was recorded differently across four authoritative documents.
- **B8 / C relationship:** B8 is `TECHNICALLY COMPLETED / ACCEPTANCE SUBSUMED BY G28-C`. G28-C's staging validation matrix (16/16 PASS) explicitly validated and accepted the correction, revocation, restoration and audit capabilities that B8 implemented. B8 is not pending; its capabilities were incorporated into C's gate and architectural acceptance. No separate B8 acceptance was invented.
- **D discovery:** `RELEASE CONTRACT DISCOVERY COMPLETE / BLOCKED BY SPECIFIC MISSING DEPLOYMENT DEFINITION`. The release candidate `docs/releases/G28_D_RELEASE_CANDIDATE.md` records the source-backed discovery and the blocker list. No publication authorization is implied by the discovery state.
- **D publication:** `NOT STARTED / NOT ACCEPTED / NOT AUTHORIZED`. No publication, push, production access, tag, release or deploy is authorized.
- **Active functional phase:** `NONE`. G28-C is CLOSED; G28-D discovery is completed/blocked and does not constitute an active functional phase.
- **Files updated:**
  - `docs/architecture/DOCUMENTOS_VALIDACAO_VINCULOS_E_EVOLUCAO_PLANO.md` — renamed stale CURRENT EXECUTION CHECKPOINT to HISTORICAL EXECUTION CHECKPOINT — SUPERSEDED; updated B8/C/D matrix rows; rewrote PRÓXIMA AÇÃO — ESTADO ATUAL.
  - `PROJECT_STATE.md` — identified b27e79f as prior technical/documentary head; stated current reconciliation action G28-STATE-RECONCILIATION-R1; clarified no functional phase active and no next phase named.
  - `AGENT_HANDOFF.md` — fixed last accepted phase to G28-C; classified B8 as subsumed by C; added nine-path continuity list with retransmission sentence; removed stale B8-acceptance-pending claim.
  - `docs/ledgers/G28_LEDGER.md` — this entry (append-only).
- **No activity:** no code, SQL, migration, runtime, test, staging, production, Supabase, network, MCP, or push executed. No functional tests, no browser, no remote, no deployment, no tag.
- **Commit:** this closeout commit; resolve final HEAD with `git rev-parse HEAD` after commit. Do not invent future SHA.
- **Next indicated:** after this reconciliation is committed, a new read-only reconciliation of the general backlog (`PEDIDO_PRODUCTION_FLOW_BACKLOG.md` and other fronts) shall choose the next functional front. Publication is not the next action.

---

## G28-STATE-RECONCILIATION-R1 — Corrective documentary addendum

- **Gate:** CORRECTIVE ADDENDUM (docs-only; no code, SQL, migration, test, staging, production, push, remote)
- **Original R1 commit:** `271761c3de20427b2cc9059d5ff7cc3727545e6d` — `G28: reconcile canonical phase state`
- **Corrected textual defects in original R1:**
  1. **Active header (master plan):** replaced claim "G28-D is the active authorized phase" — corrected to "Nenhuma fase funcional está ativa", G28-C accepted, G28-D discovery/preparation completed/blocked, publication not started/not accepted/not authorized.
  2. **B7/B8 classification (master plan header):** B7 corrected from `IMPLEMENTED / TESTED (local)` to `CLOSED / ACCEPTED_WITH_NONBLOCKING_REMOTE_SMOKE_DEBT` (evidenced); B8 corrected from `STAGING FUNCTIONALLY VERIFIED / READY FOR ARCHITECT ACCEPTANCE` to `TECHNICALLY COMPLETED / ACCEPTANCE SUBSUMED BY G28-C` with explanation that C's 16/16 gate accepted B8 capabilities and B8 is not pending.
  3. **G28-D commit reference (phase matrix):** corrected false reference "release candidate `d5ec09f`" to the actual discovery/preparation commit `b27e79fdba1ed8fb8a6232d8e0b8ca4b37ac3a2c`. D5 did not create the release candidate.
  4. **Independent-acceptance wording (PRÓXIMA AÇÃO):** removed claim that B8 "foi aceito" as if independent; listed B8 separately as `TECHNICALLY COMPLETED / ACCEPTANCE SUBSUMED BY G28-C` with explicit note that B8 has no independent acceptance.
  5. **PROJECT_STATE.md and AGENT_HANDOFF.md SHA recording:** recorded the already-created R1 commit SHA `271761c3de20427b2cc9059d5ff7cc3727545e6d`; removed forward-looking "resolve after commit" language for R1; instructed next chat to resolve current Git HEAD directly.
- **No technical state changed:** no code, tests, SQL, migration, runtime, staging, production, Supabase, network, MCP, or push was executed. This is strictly a documentary correction.
- **Corrective commit:** resolve final HEAD with `git rev-parse HEAD` after commit.

---
## 2026-07-15 — G28-STATE-RECONCILIATION-R1 — Superseded-checkpoint reference addendum

- **Gate:** CORRECTIVE ADDENDUM (docs-only; no code, SQL, migration, test, staging, production, push, remote)
- **Prior corrective commit:** `edaf0b4d36f24aa7b9490e51a42624cc70d45963` — `G28: correct canonical reconciliation state`
- **Cause:** the prior R1 corrective commit missed two live non-historical references to the renamed CURRENT EXECUTION CHECKPOINT in the master plan: (1) the P0 historical record line `Estado atual: ver CURRENT EXECUTION CHECKPOINT acima` still pointed to a superseded label as if current; (2) the `CRITÉRIO DE FECHAMENTO DO PLANO` section still asserted that historical cardinality/type/compatibility decisions remained listed in CURRENT EXECUTION CHECKPOINT. Additionally, the G28-D publication triple was incomplete at several summary points (`NOT STARTED / NOT AUTHORIZED` instead of `NOT STARTED / NOT ACCEPTED / NOT AUTHORIZED`).
- **Resulting canonical state:** zero occurrences of the token CURRENT EXECUTION CHECKPOINT remain in the live master plan. The historical checkpoint title `HISTORICAL EXECUTION CHECKPOINT — SUPERSEDED` is preserved. The G28-D publication triple is normalized to `NOT STARTED / NOT ACCEPTED / NOT AUTHORIZED` across the master plan, PROJECT_STATE.md and AGENT_HANDOFF.md. The prior corrective commit `edaf0b4d36f24aa7b9490e51a42624cc70d45963` is recorded in PROJECT_STATE.md and AGENT_HANDOFF.md. The ledger entry `G28-STATE-RECONCILIATION-R1 — Corrective documentary addendum` is not altered.
- **Files changed (this addendum):** `docs/architecture/DOCUMENTOS_VALIDACAO_VINCULOS_E_EVOLUCAO_PLANO.md`, `PROJECT_STATE.md`, `AGENT_HANDOFF.md`, `docs/ledgers/G28_LEDGER.md` (this entry).
- **No code, tests, remotes, production, or push.**

---

## 2026-07-15 — Controlled Delete × Document Link History Guard — CLOSED / ACCEPTED

- **Gate:** `CLOSED / ACCEPTED`. Technical commit `707a37bd1d2c4728ab2a17433b6441049bd88062` — `Guard controlled delete against document link history`.
- **Original defect:** the pre-existing Controlled Delete RPCs (`db/34`–`db/37`, `RAVATEX-TAPETES-PEDIDO-OP-CONTROLLED-DELETE-*`) attempted physical deletion of an OP still referenced by canonical, append-only document link history and failed with a raw foreign-key violation on `document_link_revision_ops_op_id_fkey`. The documentary history cannot be deleted merely to permit an unrelated physical delete.
- **Guard applied — `db/53_controlled_delete_document_link_guard.sql`:** renamed the four legacy RPCs from `db/37` to `*_pre53` and revoked `EXECUTE` on them for every role (anti-bypass); recreated the four public signatures (`diagnosticar_impacto_pedido`, `diagnosticar_impacto_op`, `remover_pedido`, `remover_op`) as `SECURITY DEFINER` wrappers that call the corresponding `*_pre53` diagnostic, enrich the JSON with `document_link_revision_ops` / `document_link_revisions` / `documentos_vinculados` counts, and block (`classification=blocked`, `ok=false`) before ever delegating to the destructive `*_pre53` logic when canonical documentary history exists. Never mutates `document_link_revisions`, `document_link_revision_ops`, or `op_numeros`.
- **ACL corrected — `db/54_controlled_delete_document_link_grants.sql`:** staging inspection after `db/53` found `anon_execute = true` on the four public RPCs (a live security defect, not present in the intended design). `db/54` is an additive grants-only correction: revokes `EXECUTE` from `PUBLIC`/`anon`, keeps `authenticated`. No function body, table, or cascade logic touched.
- **Cast corrected — `db/55_controlled_delete_document_link_policy_cast.sql`:** the first staging smoke on `db/53` failed with `could not determine polymorphic type because input has type unknown`, caused by `to_jsonb(<string literal>)` without an explicit cast on the guard's policy-message literal (the only untyped `to_jsonb` call among 16 in the file; all others already carry typed boolean/bigint arguments). `db/55` is a forward-only `DO` block that locates the untyped literal in the two live diagnostic functions via `pg_get_functiondef` + `position()`, and rewrites them in place via `EXECUTE replace(...)` to add `::TEXT`. No grants, cascade, or destructive logic touched.
- **Null-safe diagnostic corrected — `db/56_controlled_delete_document_link_diagnostics_null_safe.sql`:** staging smoke of an eligible (non-blocked) target revealed a second regression introduced by `db/53`: `jsonb_set(...)` is `STRICT`, and the wrappers' final `jsonb_set(..., '{reason}', to_jsonb(v_reason), TRUE)` collapsed the *entire* RPC return to raw SQL `NULL` whenever `v_reason` was `NULL` — which is every non-blocked classification (`safe`, `requires_confirmation`, `requires_cascade_confirmation`), because the inherited `db/37` diagnostic logic never sets `v_blocked=TRUE` on its own (blocking by entrega/expedição was replaced by cascade in that phase). `db/56` redefines the same two diagnostic wrappers, changing only `to_jsonb(v_reason)` to `COALESCE(to_jsonb(v_reason), 'null'::jsonb)` in the final return, restoring the original `jsonb_build_object`-equivalent null-safe contract (`{"reason": null, ...}` instead of a collapsed `NULL`). No other line, grant, or function redefined.
- **`db/53` provenance note (pre-closeout integrity pass):** before the technical commit, `db/53`'s local (uncommitted) source was found to contain the post-`db/55` cast (`::TEXT`) already baked into its two policy-literal `to_jsonb()` calls, diverging from the SQL actually applied to staging (which lacked the cast, per `db/55`'s own precondition check against the live function definition). This was a retrospective, pre-commit normalization of an untracked file and broke replay-safety of a fresh `53→54→55→56` install (`db/55`'s precondition would raise an exception). Resolved before commit by restoring `db/53` to the two-literal, no-cast form actually applied originally, keeping `db/55` as the sole forward-only cast fix. No migration file was rewritten after being committed; `db/53` had never been committed at any point in this history.
- **Staging functional validation (synthetic fixtures, reserved numbers/`ano=2099`, zero residue after cleanup, `op_numeros` unchanged throughout):**
  - **Case A1 — eligible OP with a real dependency, no documentary history:** `diagnosticar_impacto_op` returned a non-null object (`blocked=false`, `classification=requires_confirmation`, `reason` JSON `null`); `remover_op(id, 'EXCLUIR')` returned `ok=true` and deleted the OP and its dependent `op_itens` row.
  - **Case A2 — eligible Pedido with a real dependency, no documentary history:** `diagnosticar_impacto_pedido` returned a non-null object with the same classification; `remover_pedido(id, 'EXCLUIR')` returned `ok=true` and deleted the Pedido, its lote, and its OP.
  - **Case B — Pedido/OP with canonical documentary history (`document_link_revisions` active revision + `document_link_revision_ops`):** both diagnostics returned `blocked=true`, `classification=blocked`, `documentary_history_blocker=true`; both `remover_op` and `remover_pedido` (called with `'EXCLUIR TUDO'`) returned a controlled block (`ok=false`, `blocked=true`) with no foreign-key exception and no partial mutation; Pedido, OP, `document_candidates`, the active `document_link_revisions` row (`active=true`, unchanged `version`/`revoked_at`), and `document_link_revision_ops` all persisted unchanged.
  - All synthetic fixtures across both smoke rounds were removed by targeted cleanup; a final residue check confirmed zero remaining fixture rows and an unchanged `op_numeros` (`latex/2026`, `tecelagem/2026`) relative to the value recorded before any fixture was created.
- **ACL verified live in catalog (post-`db/56`, unchanged from post-`db/54`):** the four public RPCs — `PUBLIC` and `anon` without `EXECUTE`, `authenticated` with `EXECUTE`. The four `*_pre53` functions — `PUBLIC`, `anon`, and `authenticated` all without `EXECUTE` (owner/`postgres` only).
- **Local test gates (final, pre- and post-commit, identical results):** `node --check js/delete-helpers.js` PASS; `node --test tests/controlled-delete.smoke.js` **53/53** (includes 6 new regression tests added for `db/56`: file existence, both diagnostics redefined, null-safe `COALESCE` construction present, vulnerable unguarded pattern absent, `remover_op`/`remover_pedido`/`*_pre53`/grants not redefined, no function beyond the two diagnostics touched); `node --test tests/document-canonical-links-contract.test.js` **21/21**; `git diff --check` PASS.
- **Technical commit:** `707a37bd1d2c4728ab2a17433b6441049bd88062` — `Guard controlled delete against document link history`. Contains exactly `js/delete-helpers.js` (M), `tests/controlled-delete.smoke.js` (M), `db/53_controlled_delete_document_link_guard.sql` (A), `db/54_controlled_delete_document_link_grants.sql` (A), `db/55_controlled_delete_document_link_policy_cast.sql` (A), `db/56_controlled_delete_document_link_diagnostics_null_safe.sql` (A). No documentation file included in the technical commit.
- **Documental closeout:** this entry, together with `PROJECT_STATE.md`, `AGENT_HANDOFF.md`, `docs/architecture/PEDIDO_OP_SCHEMA_CONTRACT.md`, `docs/architecture/PEDIDO_PRODUCTION_FLOW_BACKLOG.md`, `docs/architecture/DOCUMENTOS_VALIDACAO_VINCULOS_E_EVOLUCAO_PLANO.md`, and `docs/architecture/PEDIDO_OP_MOVIMENTACAO_DOCUMENTOS_PLANO.md` (D-DEL10–D-DEL13).
- **Not claimed by this closeout:** no global Controle de Tapetes closure; no publication; no production readiness; G28-D remains not accepted; the general production backlog remains open; no later phase is auto-authorized. Production (`bhgifjrfagkzubpyqpew`) was not accessed; no push was executed.
- **Known pre-existing documentation gap (not created by, and not resolved by, this closeout):** `db/37_controlled_delete_expedicao_cascade.sql` (Expedição Cascade) was never given its own `D-DEL` decision-table entry in `PEDIDO_OP_MOVIMENTACAO_DOCUMENTOS_PLANO.md`, nor an `## Atualizacao` section in `PEDIDO_OP_SCHEMA_CONTRACT.md` / `PEDIDO_PRODUCTION_FLOW_BACKLOG.md` (both stop at `db/36` / FK Order Fix E); `db/34`–`db/37` were also never indexed in `docs/DOCUMENTATION_INDEX.md` §4. This closeout continues the `D-DEL` sequence from `D-DEL10` for its own migrations only and does not backfill the missing `db/37` entry.

---

## 2026-07-15 — Admin/Pedido Static Residue — CLOSED / ACCEPTED

- **Gate:** `CLOSED / ACCEPTED`. Technical commit `7978e0a4fe021467cc23e0aeed63ac87ba738f1b` — `Fix admin order completion button state`.
- **Origin:** identified during the read-only backlog reconciliation of 2026-07-15 (`docs/architecture/PEDIDO_PRODUCTION_FLOW_BACKLOG.md` §9.6/§9.7) as the sole remaining open item of the Admin/Pedido/Production backlog: static residue `disabled: ready ? null : 'disabled'` in `js/screens/expedicao-admin.js:405`.
- **Root cause confirmed:** the shared helper `el()` (`js/ui.js:10-22`) calls `setAttribute(k, v)` for every attribute in the passed object without skipping `null` (unlike its child-node handling, which does skip `null`/`false`). A `null` value is stringified by the DOM into the literal attribute `disabled="null"` — a present boolean attribute — disabling the "Concluir pedido" button even when `ready === true`.
- **Decision not to alter the shared helper:** this was the only call site across the entire repository using the null-as-omission convention for an `el()` attribute (confirmed by `git grep`); modifying `el()` would have a broader, unassessed blast radius across every screen using the helper. The fix was scoped exclusively to the call site.
- **Localized patch:** `js/screens/expedicao-admin.js`, function `buildConclusao` — `buttonAttrs` is now built as a local variable before the `return`; the `disabled` key is added to the object only when `!ready` (`buttonAttrs.disabled = 'disabled'`), and is never assigned `null`. `onclick`, button text, styles and structure are unchanged; the guard `if (!ready) return;` inside `onclick` is preserved.
- **Regression test:** `tests/expedicao-flow.smoke.js` gained one new static test asserting (1) the original `disabled: ready ? null : 'disabled'` pattern must not reappear, (2) the inverted equivalent (`disabled: !ready ? 'disabled' : null`) must not appear, and (3) the correct conditional pattern (`if (!ready) { buttonAttrs.disabled = 'disabled'; }`) must be present.
- **Local validation (LF, exit 0):** `node --check js/screens/expedicao-admin.js` PASS; `tests/expedicao-flow.smoke.js` **9/9**; `tests/expedicao-partial-flow.smoke.js` **12/12** (no regression); `git diff --check` PASS.
- **Manifesto:** exactly `js/screens/expedicao-admin.js` (M) and `tests/expedicao-flow.smoke.js` (M). `js/ui.js` untouched. No documentation file in the technical commit.
- **Access:** no staging; no production (`bhgifjrfagkzubpyqpew` not accessed); no push.
- **Documental closeout:** this entry, together with `PROJECT_STATE.md`, `AGENT_HANDOFF.md` and `docs/architecture/PEDIDO_PRODUCTION_FLOW_BACKLOG.md`.
- **Not claimed by this closeout:** no global Controle de Tapetes closure; no publication; no production readiness; G28-D remains `NOT STARTED / NOT ACCEPTED / NOT AUTHORIZED`; `CLIENTE-ORDER-SUMMARY-READMODEL-APPLY-STAGING-A`, `DELETE-PROD-GUARD-A`, `DELETE-AUDIT-LOG-A`, `G28-CAMADA-2`, `G28-CAMADA-3` and `G28-CAMADA-4` remain unchanged/deferred.
- **Next authorizable action:** `CLIENTE-ORDER-SUMMARY-READMODEL-APPLY-STAGING-A` — `READY FOR EXPLICIT ARCHITECT AUTHORIZATION` / `NOT STARTED`. This entry does not authorize its execution.

---

## 2026-07-15 — Cliente Order Summary Read Model — Staging Validation — CLOSED / ACCEPTED_WITH_NONBLOCKING_DEBTS

- **Phase:** `CLIENTE-ORDER-SUMMARY-READMODEL-APPLY-STAGING-A`.
- **Gate:** `CLOSED / ACCEPTED_WITH_NONBLOCKING_DEBTS`. No technical commit — the phase changed no files (verification-only). This entry is the documental closeout.
- **Closeout sequence:** `db/30` found already deployed → no drift confirmed → verification-only mode → real RPC contract validated → ACL catalog inspected → anonymous behavior empirically fail-closed → broader grants retained as debt → browser smoke blocked → no remediation performed → documentary closeout.
- **Object state (staging `ucrjtfswnfdlxwtmxnoo`, PostgreSQL 17.6):** `public.cliente_pedido_summary(uuid)` already present — signature `cliente_pedido_summary(p_pedido_id uuid)`, `RETURNS jsonb`, `SECURITY DEFINER`, `STABLE`, `search_path=public`, owner `postgres`, language `plpgsql`. `pg_get_functiondef` body is byte-for-byte equivalent to `db/30_cliente_pedido_summary_readmodel.sql` (only CRLF vs LF line-endings differ) — **no schema drift**. All 16 dependency tables referenced by the function exist.
- **Migration provenance:** `db/30` is **not recorded** in `supabase_migrations.schema_migrations` (the tracked history begins at `document_technical_evidences` / `document_decision_command` / `52`…`56`; `db/30` predates this tracking). The deployed object exists without a migration-history row; provenance kept explicit.
- **ACL inspected live (divergence from canonical intent):** `EXECUTE` granted to `PUBLIC`, `anon`, `authenticated`, and `service_role`. `db/30` (and decision `D-COS02`) intend **only** `authenticated`. The broader grants are the Supabase default-privileges artifact — same class as the `db/54` finding. Not silently normalized: retained as a governance/hygiene debt.
- **Empirical behavior (read-only; each RPC call ran inside `BEGIN … ROLLBACK`; the function is `STABLE`/read-only; zero data mutation):**
  - T1 — authenticated test client (`usuarios.tipo='cliente'`, `cliente_id=3`) on its own Pedido (`numero 33`, `rascunho`): `ok=true`, full DTO; `itens[1]`, other collections `[]` via `COALESCE`.
  - T2 — `anon` role on the same Pedido: `ok=false`, `"Pedido nao encontrado ou sem permissao"` — **fail-closed**: `anon` can execute but receives no customer data → **no confirmed data exposure**.
  - T3 — client `cliente_id=3` on a foreign Pedido (`cliente_id=22`): `ok=false` — cross-tenant denial.
  - T4 — admin (`usuarios.tipo='admin'`) on the foreign Pedido: `ok=true`, complete key set (admin path).
- **Frontend contract match (`js/screens/cliente-pedido-detail.js` → `supa.rpc('cliente_pedido_summary', { p_pedido_id })`, ~line 180):** every consumed field present with correct type — top-level `ok/pedido/itens/parciais/entregas/pendencias/chain_state/timeline/status/status_label/progresso_percentual`; `pedido.{numero,status,status_cliente_visual,status_cliente_atualizado_em,atualizado_em,prazo_entrega,tipo_recebimento,observacao}`; `chain_state.{isOperationalOverride,displayStatus}`; `entregas[]{descricao,data,quantidade}`; `timeline[]{data,titulo,descricao,status}`; `itens[]{modelo,largura,cor_1,cor_2,metros}`. Null fields (`tipo_recebimento`, `observacao`) and empty collections handled gracefully by the consumer; the `loadingError` branches are not on the happy path — **no silent-fallback dependency**.
- **Portal validation level:** `STATIC_CONTRACT_WITH_REAL_RPC_PAYLOAD` (real RPC payload compared field-by-field against the consumer). Authenticated browser smoke not executed — no test-client password available; recorded as a nonblocking debt (real RPC + ACL behavior + payload contract all validated).
- **Local gates:** `node --check js/screens/cliente-pedido-detail.js` PASS; `git diff --check` clean; `git status --short` empty; HEAD unchanged at `33a8034…` throughout the technical verification.
- **Access & tooling:** Supabase MCP **not exposed in the session** (no `.mcp.json`, no installed connector); Supabase CLI not installed. The architect-authorized **direct PostgreSQL fallback** was used for verification only; the temporary out-of-repo tooling (pg driver + guarded runner + credentials file) was removed afterward; no secret was echoed to any command, log, report, or Git. Production (`bhgifjrfagkzubpyqpew`) not accessed; the runner refuses the production ref internally.
- **No changes during verification:** no schema mutation, no data mutation, no fixtures, no code/SQL change, no new migration, no ACL remediation, no commit, no push.
- **Nonblocking debts:**
  1. `ACL_GRANTS_BROADER_THAN_CANONICAL_CONTRACT` — `PUBLIC` and `anon` retain `EXECUTE`; empirical `anon` behavior is fail-closed; no confirmed customer-data exposure; remediation requires a separate authorized grants-only migration.
  2. `DB30_NOT_RECORDED_IN_SUPABASE_MIGRATION_HISTORY` — deployed object exists, no drift; environment/tooling provenance kept explicit.
  3. `AUTHENTICATED_BROWSER_SMOKE_NOT_EXECUTED` — blocked by absence of a test-client password; real RPC and frontend contract verification passed.
- **ACL remediation candidate (recorded, not authorized, not started):** `CLIENTE-ORDER-SUMMARY-READMODEL-ACL-GRANTS-R1` — `ARCHITECT DECISION REQUIRED`. Intended scope, if later authorized: a grants-only forward migration analogous to `db/54` (`REVOKE EXECUTE … FROM PUBLIC, anon`, preserving canonical `authenticated`). Not created in this closeout.
- **Documental closeout:** this entry, together with `PROJECT_STATE.md`, `AGENT_HANDOFF.md`, `docs/architecture/PEDIDO_PRODUCTION_FLOW_BACKLOG.md`, and (materially required) `docs/architecture/PEDIDO_OP_MOVIMENTACAO_DOCUMENTOS_PLANO.md` (§9 next-step + decision `D-COS06`).
- **Not claimed by this closeout:** no global Controle de Tapetes closure; no publication; no production readiness; G28-D remains `NOT STARTED / NOT ACCEPTED / NOT AUTHORIZED`; the general production backlog remains open; `DELETE-PROD-GUARD-A`, `DELETE-AUDIT-LOG-A`, `G28-CAMADA-2`, `G28-CAMADA-3`, `G28-CAMADA-4` unchanged/deferred.
- **Next authorizable action:** `ARCHITECT DECISION REQUIRED AFTER BACKLOG RECONCILIATION` — no unequivocal single next action exists; the ACL remediation candidate must not be auto-selected.

---

## 2026-07-15 — Docs Canonical Consistency Backfill A — CLOSED / ACCEPTED

- **Phase:** `DOCS-CANONICAL-CONSISTENCY-BACKFILL-A`.
- **Gate:** `CLOSED / ACCEPTED`. Documentation-only — no code, test, SQL, migration, staging, or production access. Commit: `Backfill canonical migration documentation`.
- **Sequence:** full canonical backlog reconciliation (prior read-only pass, 2026-07-15) → documentation gaps confirmed (db/37 missing `D-DEL` entry; db/34–37 and db/53–56 missing from `docs/DOCUMENTATION_INDEX.md` §4; stale `db/30` index status) → `db/37_controlled_delete_expedicao_cascade.sql` migration and the accepted Controlled Delete contract inspected → missing `D-DEL` decision documented → `db/34`–`db/37` index entries added → `db/53`–`db/56` index entries added → `db/30` stale status corrected → technical and environment debts preserved as open → documentation backfill closed.
- **Gap 1 — db/37 D-DEL entry:** `db/37_controlled_delete_expedicao_cascade.sql` (fase `RAVATEX-TAPETES-PEDIDO-OP-CONTROLLED-DELETE-EXPEDICAO-CASCADE-E2`) was applied and validated in staging alongside `db/34`–`db/36` but had never received its own `D-DEL` decision row — a gap explicitly flagged in `docs/architecture/PEDIDO_OP_MOVIMENTACAO_DOCUMENTOS_PLANO.md` next to decisions `D-DEL10`–`D-DEL13` ("lacuna pre-existente, fora do escopo"). Derived directly from the real `db/37` file (expedição stops being an unconditional blocker and joins the `EXCLUIR TUDO` cascade — `expedicao_movimento_itens` → `expedicao_movimentos` → `expedicao_itens` → `expedicoes` removed before OPs/entregas/lotes/pedido) and from the `db/34`–`db/36` sequence it supersedes. Added as `D-DEL14` in `docs/architecture/PEDIDO_OP_SCHEMA_CONTRACT.md` §10, new subsection "Fase Controlled Delete — Expedição Cascade (db/37)", numbered to continue from the existing `D-DEL13` without colliding with the decisions already registered in the plano.
- **Gap 2 — db/34–37 and db/53–56 index coverage:** 8 rows added to `docs/DOCUMENTATION_INDEX.md` §4, each description derived from reading the actual migration file (not inferred from numbering alone): `db/34` (diagnostics + removal RPCs, drops legacy numbered-OP trigger), `db/35` (adds cascade with `EXCLUIR TUDO`), `db/36` (fixes FK order + DELETE guard return value), `db/37` (expedição joins the cascade), `db/53` (document-link guard wrappers, renames legacy functions to `*_pre53`), `db/54` (emergency grants fix), `db/55` (polymorphic cast fix), `db/56` (`jsonb_set` STRICT null-collapse fix). All 8 recorded as applied/validated staging-only (`ucrjtfswnfdlxwtmxnoo`); production `bhgifjrfagkzubpyqpew` untouched by all of them.
- **Gap 3 — db/30 stale index status:** `docs/DOCUMENTATION_INDEX.md` §4 still classified `db/30_cliente_pedido_summary_readmodel.sql` as "Versionado no repo, ainda nao aplicado" — stale since the `CLIENTE-ORDER-SUMMARY-READMODEL-APPLY-STAGING-A` closeout (2026-07-15, same day, earlier in this ledger) found it already deployed. Corrected to the precise accepted state: deployed and functionally verified in staging, no schema drift confirmed, not recorded in `supabase_migrations.schema_migrations`, live ACL broader than the `authenticated`-only canonical intent (`D-COS02`), anonymous empirical behavior fail-closed, no confirmed customer-data exposure, ACL remediation (`CLIENTE-ORDER-SUMMARY-READMODEL-ACL-GRANTS-R1`) remains a separate architect decision, authenticated browser smoke remains a nonblocking debt. Neither the ACL debt nor the migration-history divergence is claimed fixed by this entry.
- **No history rewritten:** no prior ledger entry, `PROJECT_STATE.md` block, or plan section was edited to make the previous omission disappear; the gap remains visible in `docs/architecture/PEDIDO_OP_MOVIMENTACAO_DOCUMENTOS_PLANO.md` exactly as recorded at the time of the Controlled Delete Document Link Guard closeout, with the correction appended as new content.
- **Conditional files read, not changed:** `docs/architecture/PEDIDO_OP_MOVIMENTACAO_DOCUMENTOS_PLANO.md` (contains the D-DEL10–D-DEL13 table and the db/37 gap note — historically accurate, not a stale current-state claim, so left untouched); `docs/architecture/DOCUMENTOS_VALIDACAO_VINCULOS_E_EVOLUCAO_PLANO.md` (references db/34–db/37 only in the already-accurate Controlled Delete Document Link Guard summary); `docs/governance/DOCUMENTATION_MODEL.md` (no db/NN or D-DEL references at all). No materially incorrect current-state statement found in any of the three.
- **Files changed:** `docs/architecture/PEDIDO_OP_SCHEMA_CONTRACT.md`, `docs/architecture/PEDIDO_PRODUCTION_FLOW_BACKLOG.md`, `docs/DOCUMENTATION_INDEX.md`, `PROJECT_STATE.md`, `AGENT_HANDOFF.md`, this ledger. No source code, test, SQL, migration, environment, or runtime file touched.
- **Preserved open/unresolved (not closed by this entry):** `CLIENTE-ORDER-SUMMARY-READMODEL-ACL-GRANTS-R1` (`ARCHITECT DECISION REQUIRED`); `DB30_NOT_RECORDED_IN_SUPABASE_MIGRATION_HISTORY`; authenticated-browser-smoke debts (G28-C/D/B7/Portal Cliente); `DEPLOYMENT_MAPPING_AND_PRODUCTION_MIGRATION_PROCEDURE`; `G28-D` publication; production application of the staging-only migration stack (`db/12`, `db/21`, `db/30`, `db/49`–`db/56`); `DELETE-PROD-GUARD-A`; `DELETE-AUDIT-LOG-A`; `G28-CAMADA-2/3/4`.
- **Access:** no Supabase MCP, no staging connection, no production access (`bhgifjrfagkzubpyqpew` not accessed), no database connection of any kind this phase. **Push:** not executed.
- **Local gates:** `git diff --check` clean; worktree clean, staging empty, zero untracked before and after.
- **Next authorizable action:** `ARCHITECT DECISION REQUIRED` — `DEPLOYMENT_MAPPING_AND_PRODUCTION_MIGRATION_PROCEDURE` remains the sole material gate. This documentation backfill does not authorize any subsequent technical phase.

---

## 2026-07-15 — Staging-Only Execution Boundary A — ARCHITECT DECISION RECORDED

- **Phase:** `STAGING-ONLY-EXECUTION-BOUNDARY-A`.
- **Gate:** `ARCHITECT DECISION RECORDED — DOCUMENTATION ONLY`. No code, test, SQL, migration, Supabase/MCP, staging, production, or Vercel access. Commit: `Record staging-only execution boundary`.
- **Sequence:** full backlog reconciliation completed (prior read-only pass, 2026-07-15) → deployment mapping identified as the prior material gate (`DEPLOYMENT_MAPPING_AND_PRODUCTION_MIGRATION_PROCEDURE`, recorded across `PROJECT_STATE.md`, `AGENT_HANDOFF.md`, and the master plan) → architect explicitly selected staging-only continuation (binding decision: current operational environment is Supabase staging `ucrjtfswnfdlxwtmxnoo` exclusively) → protected/production environment (`bhgifjrfagkzubpyqpew`) removed from current scope → production migration planning deferred until global backlog completion → G28-D reclassified as deferred and nonblocking for staging (publication `NOT STARTED / NOT ACCEPTED / NOT AUTHORIZED`, unchanged, but no longer the current blocker) → Vercel retained only as a future publication candidate, not selected, not a decision, not an authorization → staging backlog allowed to continue → ACL grants-only staging candidate (`CLIENTE-ORDER-SUMMARY-READMODEL-ACL-GRANTS-R1`) becomes `READY FOR EXPLICIT ARCHITECT AUTHORIZATION` → no technical phase started by this entry.
- **Reclassification recorded:** `DEPLOYMENT_MAPPING_AND_PRODUCTION_MIGRATION_PROCEDURE` no longer recorded as the current material blocker or as the next required architect decision. Reclassified as `DEFERRED BY ARCHITECT UNTIL GLOBAL BACKLOG COMPLETION / NOT A CURRENT STAGING BLOCKER / NOT STARTED`. This entry does not claim the deployment procedure has been discovered, defined, tested, or completed — it remains exactly as undiscovered as before; only its blocking status changed, by explicit architect choice, not by technical progress.
- **G28-D:** discovery status unchanged — `RELEASE CONTRACT DISCOVERY COMPLETE`, evidence preserved verbatim in `docs/releases/G28_D_RELEASE_CANDIDATE.md` (status line updated to reference this deferral; all discovery fields, unknowns, and evidence untouched). Publication reclassified from `BLOCKED BY SPECIFIC MISSING DEPLOYMENT DEFINITION` to `DEFERRED BY ARCHITECT / NOT A CURRENT BLOCKER / NOT AUTHORIZED`.
- **Vercel:** recorded as a future publication-provider candidate only. No selection, no decision, no authorization, no access performed.
- **No history rewritten:** no prior ledger entry, `PROJECT_STATE.md` closeout block, or plan section describing the earlier "blocked" characterization was deleted or altered; this entry and the corresponding append/update sections in `PROJECT_STATE.md`, `AGENT_HANDOFF.md`, `docs/architecture/DOCUMENTOS_VALIDACAO_VINCULOS_E_EVOLUCAO_PLANO.md`, and `docs/architecture/PEDIDO_PRODUCTION_FLOW_BACKLOG.md` record the reclassification as new, dated content layered on top of the prior record, with an explicit note that the new state prevails going forward.
- **Conditional files read, not changed:** `docs/architecture/PEDIDO_OP_MOVIMENTACAO_DOCUMENTOS_PLANO.md` (contains historical `D-DEL` decisions and its own `OPEN_ARCHITECT_DECISIONS`/G28-D references were already reconciled in the prior `DOCS-CANONICAL-CONSISTENCY-BACKFILL-A` pass and are not the live-state owner for this cross-cutting environment decision — `PROJECT_STATE.md` is; no materially stale statement requiring edit here beyond what governance assigns to `PROJECT_STATE.md`); `docs/architecture/PEDIDO_OP_SCHEMA_CONTRACT.md` (schema/RPC contract — no deployment-mapping or G28-D claims present); `docs/DOCUMENTATION_INDEX.md` (documentation arbiter — no deployment-mapping or G28-D current-state claims present, index rows already accurate as of the prior backfill); `docs/governance/DOCUMENTATION_MODEL.md` (governance rules only — no db/NN, D-DEL, or deployment-mapping references at all). No materially incorrect current-state statement found requiring edits to these four beyond the mandatory files already updated.
- **Files changed:** `PROJECT_STATE.md` (new "Decisão de Arquiteto — Fronteira de Execução Staging-Only" section + `OPEN_ARCHITECT_DECISIONS` line update), `AGENT_HANDOFF.md` (continuity summary update + new closeout section), `docs/architecture/DOCUMENTOS_VALIDACAO_VINCULOS_E_EVOLUCAO_PLANO.md` (header fields, G28-D matrix row, closure criterion, next-action section), `docs/architecture/PEDIDO_PRODUCTION_FLOW_BACKLOG.md` (append/update section), `docs/releases/G28_D_RELEASE_CANDIDATE.md` (status line only, all discovery evidence preserved), this ledger. No source code, test, SQL, migration, environment, or runtime file touched.
- **Preserved open/unresolved (not closed by this entry):** `CLIENTE-ORDER-SUMMARY-READMODEL-ACL-GRANTS-R1` — now explicitly `READY FOR EXPLICIT ARCHITECT AUTHORIZATION` but **not started, not executed by this entry**; `DB30_NOT_RECORDED_IN_SUPABASE_MIGRATION_HISTORY`; authenticated-browser-smoke debts (G28-C/D/B7/Portal Cliente); production application of the staging-only migration stack (`db/12`, `db/21`, `db/30`, `db/49`–`db/56`); `DELETE-PROD-GUARD-A`; `DELETE-AUDIT-LOG-A`; `G28-CAMADA-2/3/4`; the deployment-mapping/production-migration-procedure definition itself (still undefined — only its blocking status changed).
- **Access:** no Supabase MCP, no staging connection, no protected/production project access (`bhgifjrfagkzubpyqpew` not accessed), no database connection of any kind, no Vercel access. **Push:** not executed.
- **Local gates:** `git diff --check` clean; worktree clean, staging empty, zero untracked before and after.
- **Next authorizable action:** `CLIENTE-ORDER-SUMMARY-READMODEL-ACL-GRANTS-R1` — `READY FOR EXPLICIT ARCHITECT AUTHORIZATION` / `NOT STARTED` / staging-only. This entry does not execute or authorize that phase; it only records readiness per the architect's explicit instruction.

---

## 2026-07-15 — Cliente Order Summary ACL Grants R1 — CLOSED / ACCEPTED (technical + documentary)

- **Phase:** `CLIENTE-ORDER-SUMMARY-READMODEL-ACL-GRANTS-R1`.
- **Gate:** `CLOSED / ACCEPTED`. Technical commit `82f5ba70ace2e74c51b7c0295d1ecf8e319954be` — `Restrict client order summary RPC grants` (`db/57_cliente_pedido_summary_acl_grants.sql`, `tests/cliente-pedido-summary-acl-grants.smoke.js`). Documentary closeout commit: this entry (`Close client order summary RPC grant hardening`).
- **Sequence:** broader staging ACL confirmed (prior closeout `CLIENTE-ORDER-SUMMARY-READMODEL-APPLY-STAGING-A`, `D-COS06`) → architect authorized grants-only remediation (`CLIENTE-ORDER-SUMMARY-READMODEL-ACL-GRANTS-R1` order) → `db/57_cliente_pedido_summary_acl_grants.sql` created (grants-only, forward-only, idempotent, exact-signature) → Supabase MCP exposed and connected to authorized staging (confirmed via migration-registry and table fingerprint against `ucrjtfswnfdlxwtmxnoo`, distinct from the protected/legacy project) → migration applied through `mcp__supabase__apply_migration` (tracked operation, exactly once) → migration registry confirmed (`20260715190627 / 57_cliente_pedido_summary_acl_grants` present; `db/30` still absent, not fabricated) → `PUBLIC`/`anon`/`service_role` `EXECUTE` revoked → `authenticated` `EXECUTE` preserved → function definition and contract unchanged (identical `pg_get_functiondef` md5 hash before/after: `fd428d6f3ae7c8c9a935a1f774903de1`) → empirical role matrix passed (anon `42501` at ACL boundary; authenticated owner `ok=true`; authenticated cross-tenant `ok=false` fail-closed; authenticated admin `ok=true`; service_role direct `SET ROLE` `42501`, `rolbypassrls` distinguished from function `EXECUTE`) → tests 21/21 passed → no data mutation (all empirical checks in `BEGIN … ROLLBACK`, no fixtures created, existing pedidos 33/34 and usuarios reused) → technical commit → documentary closeout (this entry).
- **Preflight consumer search:** full-repository grep for `cliente_pedido_summary` found 12 files — 9 documentation/ledger references, 3 test files (static contract), and exactly one runtime consumer: `js/screens/cliente-pedido-detail.js` via `window.supa.rpc('cliente_pedido_summary', ...)` on the standard authenticated frontend path. Targeted searches of `supabase/`, `scripts/`, `services/` found zero Edge Function or server-side/`service_role` consumers. No consumer required `service_role`; the preflight therefore authorized including `service_role` in the `REVOKE` list (not merely preserving whatever the ACL happened to already grant).
- **Final ACL (verified live via `pg_proc.proacl`):** before — `{=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}` (`PUBLIC`, `anon`, `authenticated`, `service_role` all granted). After — `{postgres=X/postgres,authenticated=X/postgres}` (`PUBLIC` false, `anon` false, `authenticated` true, `service_role` false; owner `postgres` retains inherent privilege).
- **Function contract (verified unchanged):** name `cliente_pedido_summary`, signature `(uuid)`, return `jsonb`, `SECURITY DEFINER` true, `STABLE`, `search_path=public`, owner `postgres`, body byte-identical (md5 hash and byte length identical before/after).
- **Anonymous behavior upgrade recorded explicitly:** prior to this migration, `anon` executed the function and received a business-layer fail-closed JSON (`{"ok":false,"erro":"Pedido nao encontrado ou sem permissao"}`). After this migration, `anon` is rejected at the function ACL boundary (`ERROR 42501: permission denied for function cliente_pedido_summary`) before the function body runs at all. This entry does not describe the current behavior as merely "fail-closed after execution" — it is ACL-boundary denial.
- **service_role distinction:** `service_role` has `rolbypassrls=true` (a Postgres role attribute that bypasses row-level security on tables). This is a separate mechanism from function `EXECUTE` privilege and does not restore access to this function; direct `SET ROLE service_role` invocation correctly receives `42501` after this migration. The migration was not altered to change this result — it is the intended, correct outcome.
- **Frontend:** `js/screens/cliente-pedido-detail.js` reconfirmed as the sole runtime consumer, unchanged; no frontend defect found; no frontend file modified.
- **Debts closed:** `ACL_GRANTS_BROADER_THAN_CANONICAL_CONTRACT` (Portal Cliente closeout debt #1) — **RESOLVED IN STAGING**.
- **Debts preserved as open (not closed by this phase):** `DB30_NOT_RECORDED_IN_SUPABASE_MIGRATION_HISTORY` (no migration-history entry fabricated or repaired for `db/30`); `AUTHENTICATED_BROWSER_SMOKE_NOT_EXECUTED`; production application of the staging-only migration stack (now including `db/57`); `DEPLOYMENT_MAPPING_AND_PRODUCTION_MIGRATION_PROCEDURE` (deferred per `STAGING-ONLY-EXECUTION-BOUNDARY-A`); `DELETE-PROD-GUARD-A`; `DELETE-AUDIT-LOG-A`; `G28-CAMADA-2/3/4`; `db/57` is classified as applied only in staging (`ucrjtfswnfdlxwtmxnoo`) — not production.
- **No history rewritten:** the earlier ledger entry recording the ACL debt (`CLIENTE-ORDER-SUMMARY-READMODEL-APPLY-STAGING-A`, 2026-07-15, above) was not edited; this entry and the corresponding append/update sections in `PROJECT_STATE.md`, `AGENT_HANDOFF.md`, `docs/architecture/PEDIDO_OP_MOVIMENTACAO_DOCUMENTOS_PLANO.md` (`D-COS07`), and `docs/architecture/PEDIDO_PRODUCTION_FLOW_BACKLOG.md` record the closure as new, dated content layered on top of the prior record.
- **Conditional files decisions:** `docs/architecture/DOCUMENTOS_VALIDACAO_VINCULOS_E_EVOLUCAO_PLANO.md` — **CHANGED**: its live-state header ("Decisões de arquiteto em aberto") and its "PRÓXIMA AÇÃO — ESTADO ATUAL" section both still described `CLIENTE-ORDER-SUMMARY-READMODEL-ACL-GRANTS-R1` as `READY FOR EXPLICIT ARCHITECT AUTHORIZATION` — a materially stale current-state claim (not a dated historical note), corrected to reflect `CLOSED / ACCEPTED` and `NEXT_AUTHORIZABLE_ACTION: NONE`. `docs/architecture/PEDIDO_OP_SCHEMA_CONTRACT.md` — **NOT CHANGED**: its one `CLIENTE-ORDER-SUMMARY-READMODEL-ACL-GRANTS-R1` mention sits inside the dated, historical `## Atualizacao 2026-07-15 - Docs Canonical Consistency Backfill A` section, accurately describing that backfill's scope at the time it was written — not a current-state claim. `docs/governance/DOCUMENTATION_MODEL.md` — **NOT CHANGED**: no `cliente_pedido_summary`, `db/NN`, or ACL references of any kind. `docs/releases/G28_D_RELEASE_CANDIDATE.md` — **NOT CHANGED**: G28-D publication discovery, unrelated to this Portal Cliente ACL phase; no stale statement found.
- **Files changed:** `PROJECT_STATE.md` (new "Portal Cliente — ACL Grants Hardening" section + staging-only decision block's next-candidate field updated), `AGENT_HANDOFF.md` (continuity summary update + new closeout section), `docs/architecture/PEDIDO_OP_MOVIMENTACAO_DOCUMENTOS_PLANO.md` (`D-COS07` added, §9 next-step updated, `D-COS06` left unedited), `docs/architecture/PEDIDO_PRODUCTION_FLOW_BACKLOG.md` (append/update closeout section), `docs/DOCUMENTATION_INDEX.md` (`db/57` row added, `db/30` row ACL statement corrected), `docs/architecture/DOCUMENTOS_VALIDACAO_VINCULOS_E_EVOLUCAO_PLANO.md` (conditional file, two stale current-state lines corrected — see above), this ledger. No source code, test, SQL, migration, environment, or runtime file touched by this documentary pass (the technical files were already committed in `82f5ba7`).
- **Access:** no Supabase/MCP/staging/production/Vercel access during this documentary pass (all staging access occurred in the prior technical phase, commit `82f5ba7`). **Push:** not executed.
- **Local gates:** `git diff --check` clean; worktree clean, staging empty, zero untracked before and after.
- **Next authorizable action:** `NEXT_AUTHORIZABLE_ACTION: NONE`. `ARCHITECT_DECISION_REQUIRED:` explicit reconciliation of the remaining staging backlog (candidates include, but this entry does not select: production deployment, G28-D, Vercel, `db/30` migration-history repair, authenticated browser smoke, Controlled Delete production guard — none auto-selected).

---

## 2026-07-15 — DOCS-PEDIDO-OP-LEGACY-PLAN-STATUS-CONSISTENCY-R1 — Reconcile legacy Pedido↔OP plan phase statuses

- **Gate:** `CLOSED / ACCEPTED`. Docs-only; no code, test, SQL, migration, runtime, Supabase, MCP, staging, protected/production project, Vercel, network, or push. Documentary commit `Reconcile legacy Pedido OP plan phase statuses` (resolve final HEAD with `git rev-parse HEAD` after commit).
- **Sequence:** prior read-only backlog reconciliation → materially stale current-state rows found in two legacy plans (`docs/architecture/PEDIDO_OP_SCHEMA_CONTRACT.md` §9 "Fases futuras — sequência atualizada"; `docs/architecture/PEDIDO_OP_MOVIMENTACAO_DOCUMENTOS_PLANO.md` §5 "Fases futuras sugeridas") → current authorities compared → D/E/F confirmed delivered → G/H/I confirmed superseded by the G28 canonical document pipeline → J confirmed future and unsequenced → the two plan representations corrected → no code/SQL/migration/environment access → documentary commit → Git final verification.
- **Root cause:** both legacy plans still represented Fases D–J as currently pending (`Pendente` in the schema-contract §9 status column; blank/absent status cells in the movement-plan §5 table), contradicting the current-state authorities that show the production flow operational and the `documentos_operacionais`-based document design superseded by the accepted G28 canonical link pipeline. Classification: `MATERIAL_DIVERGENCE` between two legacy planning tables and the current-state authorities. These were current-state planning rows, not dated historical records.
- **D/E/F — delivered through accepted production-flow work:**
  - **D** (OPs vinculadas no Pedido Detail Admin): the Pedido Detail lists linked OPs with status/progress/link — `PEDIDO_PRODUCTION_FLOW_BACKLOG.md` §1.2, §9.4 (§2 item H resolved).
  - **E** (stepper/preview produtivo): stepper/preview with real OP-derived progress via `derivePedidoChainState` — backlog §2 item F resolved (§9.4), §9.7 hub R2 closed.
  - **F** (operação canônica de movimentação): the Pedido reuses the OP canonical operations (`salvarEntregaCima`, `liberar_expedicao_latex_parcial`, `registrar_entrega_expedicao`, `registrarRecebimentoOrdemFio`) with no parallel write — backlog §1.1, §9.5.
  - Classified `Entregue via fluxo produtivo aceito` (delivered), not `CLOSED / ACCEPTED` under the legacy phase name — no per-legacy-phase formal acceptance was invented.
- **G/H/I — superseded by the G28 canonical document pipeline:** the generic `documentos_operacionais` design (§4/§5 of the schema contract) was never created; the accepted G28 front (`DOCUMENTOS_VALIDACAO_VINCULOS_E_EVOLUCAO_PLANO.md`, G28-B1…C) built typed canonical `document_link_revisions` / `document_link_revision_ops` (db/51/52), Documento→Pedido `0..1` / Documento→OP `0..N`, explicitly forbidding the generic `document_links(target_type,target_id)` / `documentos_operacionais` approach. G (documentary pending), H (Drive/OneDrive external-file design), I (Gmail/PDF/XML automation = the Documents Ingestor detection + human-validation queue) are all superseded, not silently deleted — the rows remain visible and relabeled `Superada`.
- **J — future and unsequenced:** the transactional inter-stage saldo guard (`PEDIDO_OP_SCHEMA_CONTRACT.md` §7) is not delivered, not started, not authorized; retained and relabeled `Futura / não sequenciada / não iniciada / não autorizada`. Its description was not removed.
- **Preserved unchanged:** no dated historical section rewritten; the original architectural intent (`documentos_operacionais` §4, saldo por etapa §7) preserved; no accepted-implementation record altered; no code/runtime/behavior changed; no new implementation phase authorized.
- **Files changed:** `docs/architecture/PEDIDO_OP_SCHEMA_CONTRACT.md` (§9 status cells D–J + reconciliation note), `docs/architecture/PEDIDO_OP_MOVIMENTACAO_DOCUMENTOS_PLANO.md` (§5 table Status column + D–J cells + reconciliation note), `PROJECT_STATE.md` (new closeout block), `AGENT_HANDOFF.md` (new closeout section + routing instruction that D–I are not open implementation phases), this ledger (this append-only entry).
- **Conditional files decisions:** `docs/architecture/PEDIDO_PRODUCTION_FLOW_BACKLOG.md` — **NOT CHANGED** (its production-flow current-state is already accurate; this correction only cited it as evidence). `docs/DOCUMENTATION_INDEX.md` — **NOT CHANGED** (authority/classification/paths unaffected; no stale row introduced by this correction).
- **State unchanged by this correction:** `ACTIVE_PHASE: NONE`; `NEXT_AUTHORIZABLE_ACTION: NONE` pending explicit architect selection of a new front. All open debts and deferred fronts preserved.
- **Access:** no Supabase/MCP/staging/protected-project/production/Vercel access; **MCP invocations: 0; Supabase invocations: 0.** **Push:** not executed.
- **Local gates:** `git diff --check` clean; worktree clean, staging empty, zero untracked before and after.
- **Continuity (retransmit in every future handoff):** `docs/architecture/PEDIDO_OP_MOVIMENTACAO_DOCUMENTOS_PLANO.md`, `docs/architecture/PEDIDO_PRODUCTION_FLOW_BACKLOG.md`, `docs/architecture/DOCUMENTOS_VALIDACAO_VINCULOS_E_EVOLUCAO_PLANO.md`, `docs/architecture/PEDIDO_OP_SCHEMA_CONTRACT.md`, `PROJECT_STATE.md`, `AGENT_HANDOFF.md`, `docs/ledgers/G28_LEDGER.md`, `docs/DOCUMENTATION_INDEX.md`, `docs/governance/DOCUMENTATION_MODEL.md`. Every future agent must retransmit these nine paths and instruct the next continuity to retransmit them again.
- **Next authorizable action:** `NEXT_AUTHORIZABLE_ACTION: NONE`. `ARCHITECT_DECISION_REQUIRED:` explicit selection of the next front (this documentary correction authorizes none).

---

## 2026-07-15 — G28-RECONCILIATION-DECISIONS-A — Record architect reconciliation decisions

- **Gate:** DOCUMENTARY / ARCHITECT DECISIONS RECORDED. Docs-only; sem código, teste, SQL, migration, Supabase, MCP, staging, produção ou Vercel acessados/alterados.
- **Commit documental:** `Record architect reconciliation decisions` (HEAD a consultar com `git rev-parse HEAD`).
- **Baseline de origem:** `BACKLOG-RECONCILIATION-READONLY-R1` — diagnóstico read-only anterior (sem alteração de arquivo), preservado verbatim em `docs/reports/BACKLOG_RECONCILIATION_R1_2026-07-15.md`.
- **Arquivos principais:** `PROJECT_STATE.md` (nova seção `G28-RECONCILIATION-DECISIONS-A`); `AGENT_HANDOFF.md` (nova seção de continuidade + bullets de topo atualizados); `docs/DOCUMENTATION_INDEX.md` (entradas para o relatório e o closeout do ChatGPT); `docs/governance/DOCUMENTATION_MODEL.md` (referência ao contrato de saúde arquitetural, se aplicável); `docs/reports/BACKLOG_RECONCILIATION_R1_2026-07-15.md` (novo); `docs/handoffs/CHATGPT_CLOSEOUT_2026-07-15.md` (já commitado em fase anterior; confirmado, não modificado nesta fase); este ledger.
- **Decisões registradas:**
  1. `PROJECT-CONTROL-BASELINE-R1` (ChatGPT): `REJECTED / NOT RATIFIED` — classificação materialmente incorreta da Camada 2 (tratou capacidade parcial como implementação aceita). Artefato externo, nunca canônico.
  2. `PROJECT-CONTROL-BASELINE-R1-CORRECTION` (ChatGPT): `CANCELLED / ABSORBED / SUPERSEDED` pelo diagnóstico `BACKLOG-RECONCILIATION-READONLY-R1`, adotado como baseline de referência corrente.
  3. `G28-CAMADA-2`: reclassificada `CAPACIDADE PARCIAL PREEXISTENTE` (CRUD de usuários, desativação/ban via Edge Functions, papel único `usuarios.tipo`, vínculo cliente/fornecedor — subproduto de `AUTH-DISABLE-USER` e do Portal Cliente) `+ ESCOPO PLENO A1-A7 DIFERIDO` (reset/recuperação de senha, convites, matriz de papéis/permissões, auditoria completa, política de senha plena, reativação — nenhum encontrado no código real). Referência funcional/visual para o escopo pleno: `D:\OneDrive\Programação\SGAA_clean_baseline`. Nenhuma implementação autorizada.
  4. `G28-C`: reclassificado no estado vigente `CLOSED / TECHNICALLY ACCEPTED — ARCHITECT PRODUCT VALIDATION PENDING`, separando aceite técnico/staging (matriz 16/16, migrations aplicadas/verificadas) de validação funcional/pessoal do arquiteto (não registrada) e do smoke autenticado de browser (`AUTHENTICATED_BROWSER_SMOKE_NOT_EXECUTED`, nunca executado). Closeout histórico (`a7d7caa`/aceite `d5ec09f`) **não reescrito** — ver entradas próprias "G28-C — Direct staging validation closeout" e "G28-C — Architect acceptance recording" acima, preservadas inalteradas.
  5. Governança de supervisão: acompanhamento de progresso, continuidade, escopo, autorizações, fases e documentação transferidos para Claude (chat) + Claude Code (residente); ChatGPT passa a consultor de processo, sem custódia de estado e sem autoridade para emitir ordens.
  6. Próxima frente selecionada: `G28-CAMADA-2`, início por diagnóstico read-only comparativo em ordem própria subsequente (não autorizado por esta entrada). Higiene do worktree `work/app-next` (11 commits atrás de `staging/work/app-next`, worktree sujo) autorizada como tarefa paralela read-only, em ordem separada.
- **Não alterado:** nenhuma entrada histórica deste ledger foi reescrita; nenhum código/teste/SQL/migration/runtime tocado; nenhuma fase de implementação autorizada.
- **Produção:** `bhgifjrfagkzubpyqpew` não acessada. **Push:** não executado nesta fase.
- **Estado final do worktree:** limpo; staging vazio; zero untracked.
- **Risco residual:** nenhum novo introduzido; débitos preexistentes preservados (`AUTHENTICATED_BROWSER_SMOKE_NOT_EXECUTED`, `DB30_NOT_RECORDED_IN_SUPABASE_MIGRATION_HISTORY`, worktree `app-next` divergente/sujo, worktree detached órfão em `2a492f0`).
- **Próxima fase indicada no fechamento:** diagnóstico read-only comparativo de `G28-CAMADA-2` (ordem própria, não autorizada por esta entrada); higiene read-only de `work/app-next` (tarefa paralela autorizada, ordem separada).

---

## 2026-07-15 — Add CLAUDE.md agent entrypoint

- **Gate:** DOCUMENTARY / HARNESS CONFIG. Docs-only; sem código, teste, SQL, migration, Supabase, MCP, staging, produção ou Vercel acessados/alterados.
- **Commit:** `Add CLAUDE.md agent entrypoint` (HEAD a consultar com `git rev-parse HEAD`).
- **Arquivo criado:** `CLAUDE.md` (raiz) — ponteiro de harness, carregado automaticamente por agentes Claude Code neste diretório.
- **Conteúdo:** lista de leitura obrigatória (`PROJECT_STATE.md`, `AGENT_HANDOFF.md`, `docs/architecture/CODE_HEALTH_RULES.md`, `docs/governance/DOCUMENTATION_MODEL.md`, `docs/DOCUMENTATION_INDEX.md`) e resumo-ponteiro de regras operacionais (fase por autorização explícita, staging-only, restrições de Git, closeout documental obrigatório). Não duplica regra nenhuma em detalhe — aponta para os canônicos.
- **Autoridade:** `CLAUDE.md` **não é fonte canônica**. Em conflito com qualquer documento canônico, os canônicos prevalecem; divergência exige interromper e reportar, não seguir o resumo.
- **Não alterado:** nenhuma regra canônica reescrita ou duplicada; nenhum código/teste/SQL/migration/runtime tocado.
- **Produção:** `bhgifjrfagkzubpyqpew` não acessada. **Push:** não executado.
- **Estado final do worktree:** limpo; staging vazio; zero untracked.
- **Próxima fase indicada no fechamento:** nenhuma — este registro não autoriza fase técnica alguma.

---

## 2026-07-15 — CAMADA2-USUARIOS-SPEC-MATERIALIZE-R1 — Add Camada 2 user administration spec

- **Gate:** DOCUMENTARY / PROPOSED. Docs-only; sem código, teste, SQL, migration, Supabase, MCP, staging, produção ou Vercel acessados/alterados.
- **Commit:** `Add Camada 2 user administration spec` (HEAD a consultar com `git rev-parse HEAD`).
- **Antecedente:** `CAMADA2-USUARIOS-SPEC-DIAGNOSTIC-R1` — diagnóstico read-only cross-repo (Tapetes × `D:\OneDrive\Programação\SGAA_clean_baseline`, projeto Flask/SQLite não relacionado, lido em modo estritamente read-only via dois agentes de exploração), cujo conteúdo foi incorporado com decisões do arquiteto e 5 ajustes de revisão.
- **Arquivo criado:** `docs/architecture/CAMADA2_USUARIOS_SPEC_PROPOSED.md` — spec `A1-A7` + política de senha, cada item com: o que o SGAA faz, o que já existe no Tapetes (evidência file:line), o que falta, proposta adaptada, módulos/arquivos previstos, riscos de Auth, subfase/gate.
- **Decisões do arquiteto incorporadas:** `nivel_acesso` com 2 níveis (`completo`/`somente_leitura`); tabela de overrides de permissões **não construída** (opção futura condicionada); A4 = caminho único senha-temporária-com-troca-forçada, e-mail/SMTP `NOT AUTHORIZED`; bulk actions (A3.3) `DEFERRED`.
- **Ajustes de revisão aplicados:** (1) cutover de rota antecipado para A3.1 (troca do handler em `js/boot.js` + validação visual do arquiteto), A3.4 vira remoção isolada do código legado; (2) "último acesso" incluído em A3.2 (leitura de `auth.users.last_sign_in_at`, sem write) e revogação explícita de sessão declarada fora de escopo; (3) gate de mockup obrigatório antes de A3.2; (4) plano de módulos e gates atualizados com edições pontuais de `index.html`/cache-busting (§2/§12/§17) e smoke de rota/boot (§13) nas subfases que tocam `index.html`/`boot.js`; (5) `docs/refactor/ARCHITECTURE_REFACTOR_LEDGER.md` adicionado aos artefatos de closeout de A3.1/A3.4, e a localização de `js/admin-usuarios-writes.js`/`js/admin-usuarios-audit-read-model.js` na raiz de `js/` justificada como precedente consciente do trio `document-link-*`.
- **Caveat de segurança preservado:** a spec rejeita explicitamente 4 práticas do SGAA (senhas padrão em texto puro exibidas na UI, ausência de política de complexidade, ausência de auditoria, confirmação via `window.confirm()` nativo) — usado apenas como referência de arquitetura de informação/organização de tela, nunca de política de segurança.
- **Arquivos principais:** `docs/architecture/CAMADA2_USUARIOS_SPEC_PROPOSED.md` (novo); `docs/DOCUMENTATION_INDEX.md` (nova entrada, classificação "Spec proposta (design)", autoridade condicionada a aceite); `PROJECT_STATE.md` (bloco de estado — spec criada, `PROPOSED`); `AGENT_HANDOFF.md` (continuidade); este ledger.
- **Não alterado:** nenhum código, teste, SQL, migration, runtime tocado; nenhuma subfase autorizada; nenhum arquivo do repositório SGAA_clean_baseline tocado (leitura estritamente read-only, confirmada por dois agentes de exploração independentes).
- **Produção:** `bhgifjrfagkzubpyqpew` não acessada. **Push:** não executado.
- **Estado final do worktree:** limpo; staging vazio; zero untracked.
- **Risco residual:** nenhum novo — a spec em si não muda nenhum estado de código/dado; débitos preexistentes preservados.
- **Próxima fase indicada no fechamento:** `A3.1` — `READY FOR EXPLICIT ARCHITECT AUTHORIZATION / NOT STARTED`. Este registro não autoriza sua execução.

---

## 2026-07-15 — CAMADA2-USUARIOS-A3-1 — Extract user administration screen modules

- **Gate:** `CLOSED / ACCEPTED`. Refactor puro (§14 `CODE_HEALTH_RULES.md`) — sem feature nova, sem mudança de comportamento visual/funcional.
- **Commit técnico:** `4f01101143a512c8018d58ce9e523064c38a145f` — `Extract user administration screen modules`.
- **Commit documental:** este closeout (`Close Camada 2 user administration screen extraction`). O HEAD atual deve ser consultado com `git rev-parse HEAD`.
- **Autorização:** ordem do arquiteto explícita, escopo restrito a A3.1 (sem encadeamento automático de subfases seguintes), conforme `docs/architecture/CAMADA2_USUARIOS_SPEC_PROPOSED.md`.
- **Arquivos principais:**
  - `js/admin-usuarios-writes.js` (novo, 196L) — camada de I/O pura (sem toast/DOM), reads de usuarios/fornecedores/clientes, writes via Edge Functions `admin-create-user`/`admin-disable-user`/`admin-delete-user` + PostgREST update, mapeamento de erro consolidado. Padrão `op-writes.js`/`entrega-writes.js`/`document-link-admin-controller.js`.
  - `js/screens/admin-usuarios-modal.js` (novo, 500L) — 3 modais (criar/editar, desativar, excluir). Helpers de formulário (`adminUsuariosModalField`, `openAdminUsuariosFormModal` etc.) duplicados localmente de `cadastros.js:204-449`, renomeados com prefixo `adminUsuarios` — necessário porque `cadastros.js` é uma IIFE que não expõe esses helpers em `window.*` e a ordem proibia alterá-lo.
  - `js/screens/admin-usuarios.js` (novo, 188L) — orquestração/render, extração 1:1 de `screenCadastrosUsuarios` (`cadastros.js:2226-2713`).
  - `index.html` — +3 `<script>` (writes → modal → screen), cache-busting `?v=20260715-camada2-a31`, inseridos logo após `cadastros.js`, antes de `ops-list.js`.
  - `js/boot.js` — rota `#/cadastros/usuarios` recableada de `window.screenCadastrosUsuarios` para `window.screenAdminUsuarios` (1 linha); comentário de dependências do cabeçalho corrigido.
  - `tests/admin-usuarios.smoke.js` (novo, 402L, 13 testes) — paridade visual (grid/badges/busca/toggle/botões), guardas de auto-proteção, wiring de escrita (spies sobre `RAVATEX_ADMIN_USUARIOS_MODAL`), unit dos writes (`RAVATEX_ADMIN_USUARIOS_WRITES` chamando `supa` corretamente), não-regressão (`cadastros.js` intocado).
  - `tests/boot.smoke.js` — +2 testes: cutover de rota (`render.name === 'screenAdminUsuarios'`), ordem/cache-busting dos 3 scripts novos.
  - `tests/cadastros-screens.smoke.js` — sandboxes de boot completo (testes 22/23) ajustados para carregar os 3 módulos novos (sem isso, teste 22 quebrava por consequência indireta da troca de rota, não por alteração em `cadastros.js`); nova asserção `routes['#/cadastros/usuarios'].render.name === 'screenAdminUsuarios'`.
- **Acoplamento oculto encontrado e resolvido (não constituiu HARD STOP):** os 8 helpers de formulário usados por `screenCadastrosUsuarios` são privados à IIFE de `cadastros.js` (só `window.labelFornecedorTipo` é global). Duplicados como funções puras (dependem só de `window.el`/`window.supa`, sem estado privado de `cadastros.js`), preservando comportamento idêntico sem tocar o arquivo proibido.
- **Decisão de escopo registrada:** a função `render()` original (`cadastros.js:2266-2317`, dataTable genérico) nunca era chamada — `reload()` só chamava `renderStandalone()`. Código morto/inalcançável, **não portado**: omissão não altera nenhum comportamento observável.
- **Não alterado:** `js/screens/cadastros.js`, `js/ui.js`, `js/auth.js` — intocados, confirmado por `git status`. `screenCadastrosUsuarios`/`window.screenCadastrosUsuarios` permanecem em `cadastros.js` como código morto até remoção isolada em `A3.4`.
- **Testes:** `node --check` nos 3 arquivos novos + `boot.js` PASS; `tests/admin-usuarios.smoke.js` **13/13**; `tests/boot.smoke.js` **32/32**; `tests/cadastros-screens.smoke.js` **32/32**; regressão ampla de 28 suítes adicionais referenciando `boot.js`/rotas: **1207 pass / 89 fail — contagem idêntica ao baseline pré-fase**, confirmado via `git stash`/`stash pop` (89 falhas são débito pré-existente — servidor `:8765` não rodando, extração de inline-script antiga — nenhuma nova). `git diff --check` limpo.
- **Validação visual:** confirmada explicitamente pelo arquiteto na rota `#/cadastros/usuarios`, app local (`http://localhost:8765`, `.claude/launch.json` criado nesta fase para o preview) apontando para staging `ucrjtfswnfdlxwtmxnoo` — paridade 1:1 aceita antes deste closeout, conforme gate de aceite da ordem.
- **Produção:** `bhgifjrfagkzubpyqpew` não acessada. **Push:** não executado.
- **Estado final do worktree:** limpo; staging vazio; zero untracked.
- **Documentação atualizada:** `docs/refactor/ARCHITECTURE_REFACTOR_LEDGER.md` (§16 — novo módulo estrutural + mudança de rota; nova linha em §4 "Tabela de fases" e 3 novas linhas em §6 "Módulos extraídos"); `PROJECT_STATE.md` (nova seção "Camada 2 — Extração da Tela de Usuários"); `AGENT_HANDOFF.md` (novo closeout + continuidade).
- **Risco residual:** nenhum novo introduzido. Débitos preexistentes preservados (`AUTHENTICATED_BROWSER_SMOKE_NOT_EXECUTED`, `DB30_NOT_RECORDED_IN_SUPABASE_MIGRATION_HISTORY`, worktree `app-next` divergente/sujo).
- **Próxima fase indicada no fechamento:** `A3.2` — sob **gate de mockup** (cards-resumo + toolbar exigem aprovação de mockup do arquiteto antes de implementar). `A3.3` (bulk actions) permanece `DEFERRED`. `A3.4` (remoção do código legado) depende das demais subfases A3.x aceitas. Nenhuma subfase autorizada por esta entrada.

---

## 2026-07-15 — CAMADA2-USUARIOS-A3-2 — Add user admin summary cards and toolbar

- **Gate:** `CLOSED / ACCEPTED`. Feature aditiva de UI (§14 `CODE_HEALTH_RULES.md`) sobre módulo extraído em A3.1 — sem refactor, sem write novo, sem Auth.
- **Commits técnicos:** `b4a6238c34afb683ec7a973d230330b7266c99f2` — `Add user admin summary cards and toolbar`; `3198570c04b08bef83605f64bc9ae1c5ece8b873` — `Align summary card background with dashboard` (ajuste pós-validação visual: fundo dos cards de `#f4f6f9` para `#fff`, mesmo tom de `.rv-adm-card` em `js/screens/painel.js`).
- **Commit documental:** este closeout (`Close user admin summary cards phase`). O HEAD atual deve ser consultado com `git rev-parse HEAD`.
- **Gate de mockup:** `SATISFEITO` — mockup aprovado pelo arquiteto em 2026-07-15 (cards-resumo com ícone KPI + toolbar + badge de papel por cor), registrado em `docs/design/CAMADA2_A32_MOCKUP_APPROVED.md` com os valores finais (incluindo o ajuste de fundo pós-validação).
- **Escopo implementado (itens 1, 2, 3, 5 da ordem):**
  - **Cards-resumo (4):** Administradores/Fornecedores/Clientes/Inativos, contagens derivadas de `allUsers` (já carregado por `reload()`, sem query nova), ícones KPI (escudo/fábrica/usuários/user-off).
  - **Toolbar:** busca (placeholder "Buscar por nome ou e-mail"), select Ordenar (Nome A–Z/Z–A/Tipo/Último acesso), select Filtrar por tipo (Todos/Admin/Fornecedor/Cliente), toggle "Mostrar inativos" — todos client-side sobre `allUsers`.
  - **Badge de papel** (coluna Tipo): Admin `#e8eefc`/`#2563eb`, Fornecedor `#eceef1`/`#5a6472`, Cliente `#f0edfc`/`#6d5bd0`.
  - **Opacidade de linha inativa:** `0.6` na linha inteira do grid quando `ativo === false`.
- **Item 4 (coluna "Último acesso") — NÃO implementado, HARD STOP confirmado:** busca exaustiva no repositório confirmou zero leitura de `auth.users.last_sign_in_at` e nenhuma RPC/view que o exponha; qualquer via de leitura exige migration nova. **Decisão do arquiteto (2026-07-15): via escolhida = RPC `SECURITY DEFINER` admin-only, padrão `is_admin()`.** Registrada como micro-fase futura `CAMADA2-LAST-ACCESS-RPC` — `NOT AUTHORIZED`, candidata a ser agrupada com a migration de `A4.1`. A opção "Último acesso" existe no select Ordenar (parte do item 2, UI) mas é inerte (sort estável, sem efeito visível) até a RPC existir.
- **Arquivos principais:** `js/screens/admin-usuarios.js` (cards-resumo, toolbar, badge de papel, opacidade — `kpiCard`/`tipoBadge`/`sortRows` novos; `renderStandalone()` estendido); `tests/admin-usuarios.smoke.js` (7 testes novos: contagens dos cards, opções da toolbar, filtro por tipo sem query nova, ordenação Z–A, cores do badge, opacidade de linha inativa, ausência confirmada da coluna "Último acesso"; teste 11-13 corrigido para localizar linhas por conteúdo em vez de índice posicional, já que a ordenação padrão alfabética reordena o grid); `docs/design/CAMADA2_A32_MOCKUP_APPROVED.md` (novo); `docs/governance/SUPERVISION_PROTOCOL.md` (novo); `docs/DOCUMENTATION_INDEX.md` (2 entradas novas); `PROJECT_STATE.md`; `AGENT_HANDOFF.md`.
- **Não alterado:** `index.html` (nenhum script novo — feature inteira dentro de `admin-usuarios.js` existente); `js/admin-usuarios-writes.js` (nenhum read novo necessário); `js/screens/admin-usuarios-modal.js`; `js/screens/cadastros.js`; `js/ui.js`; `js/auth.js`. `docs/refactor/ARCHITECTURE_REFACTOR_LEDGER.md` **não recebeu entrada nesta fase** — nenhum módulo estrutural novo foi criado (apenas edição de arquivos já existentes de A3.1), consistente com o §16 (só exige registro para módulo novo/mudança de rota, nenhum dos dois ocorreu aqui).
- **Testes:** `node --check` PASS; `tests/admin-usuarios.smoke.js` **20/20**; `tests/boot.smoke.js` + `tests/cadastros-screens.smoke.js` **64/64** (sem regressão); `git diff --check` limpo.
- **Validação visual:** confirmada explicitamente pelo arquiteto na rota `#/cadastros/usuarios`, app local (`http://localhost:8765`) apontando para staging `ucrjtfswnfdlxwtmxnoo`, incluindo o ajuste de fundo dos cards aplicado antes do fechamento.
- **Produção:** `bhgifjrfagkzubpyqpew` não acessada. **Push:** não executado.
- **Estado final do worktree:** limpo; staging vazio; zero untracked.
- **Risco residual:** nenhum novo. Débitos preexistentes preservados. Novo débito registrado (não bloqueante): `CAMADA2-LAST-ACCESS-RPC` — `NOT AUTHORIZED`, candidata a agrupar com `A4.1`.
- **Próxima fase indicada no fechamento:** `ARCHITECT DECISION REQUIRED` — candidatas sem prioridade inequívoca: `A4.1` (schema `senha_temporaria`/política de senha, possivelmente agrupada com `CAMADA2-LAST-ACCESS-RPC`), `A2.1` (schema `nivel_acesso`), `A6.1` (schema/trigger de auditoria). `A3.3` permanece `DEFERRED`. `A3.4` depende das demais subfases A3.x aceitas. Nenhuma subfase autorizada por esta entrada.

---

## 2026-07-15 — G28-GOVERNANCE-CONSOLIDATION-A — Consolidate supervision protocol and register publication criteria

- **Gate:** `CLOSED / ACCEPTED`. Docs-only — sem código, teste, SQL, migration, Supabase, staging, produção ou Vercel acessados/alterados.
- **Commit documental:** `Consolidate supervision protocol and register publication criteria`. O HEAD atual deve ser consultado com `git rev-parse HEAD`.
- **Arquivos principais:**
  - `docs/governance/SUPERVISION_PROTOCOL.md` — apêndice "Handoff de supervisão — bloco padrão" (texto verbatim do arquiteto); formato de relatório (§3) passou a exigir seção `STRUCTURAL POLICY COMPLIANCE` em toda fase de implementação.
  - `PROJECT_STATE.md` — nova seção "Decisão de Arquiteto — Critério de Publicação e Frentes Candidatas".
  - `AGENT_HANDOFF.md` — novo closeout + continuidade (11 caminhos obrigatórios, `SUPERVISION_PROTOCOL.md` adicionado).
- **Frentes candidatas registradas (`NOT AUTHORIZED`):** `CODE-HEALTH-AUDIT-§18-R1` — auditoria read-only pós-Camada 2 (§18 `CODE_HEALTH_RULES.md`), insumo para decomposição incremental de `cadastros.js` (~2.200 linhas, 6 telas embutidas remanescentes) e triagem de débitos de teste de baseline; `PUBLICATION-TRACK-REVIEW` — revisão da fronteira staging-only + `DEPLOYMENT_MAPPING_AND_PRODUCTION_MIGRATION_PROCEDURE` + G28-D + aplicação em produção das migrations staging-only + `DELETE-PROD-GUARD-A`, `NOT AUTHORIZED / CONDITIONED`.
- **Decisão vinculante do arquiteto — critério de publicação:** produção só é autorizada após `G28-CAMADA-2` (escopo pleno `A1-A7`) e `G28-CAMADA-3` (backup automático) estarem ambas `CLOSED / ACCEPTED` em staging. `PUBLICATION-TRACK-REVIEW` condicionada a esse critério. `STAGING-ONLY-EXECUTION-BOUNDARY-A` permanece vigente sem alteração.
- **Consequência registrada:** `G28-CAMADA-3` reclassificada de diferida para `CAMINHO CRÍTICO DE PUBLICAÇÃO` (após `G28-CAMADA-2`), pendente de spec própria; diagnóstico `BK1-BK8` fica como fase futura, `NOT AUTHORIZED`.
- **Não alterado:** nenhum código, teste, SQL, migration, runtime tocado; nenhuma subfase de `G28-CAMADA-2`/`G28-CAMADA-3` autorizada; `git diff --check` limpo.
- **Produção:** `bhgifjrfagkzubpyqpew` não acessada. **Push:** não executado.
- **Estado final do worktree:** limpo; staging seletiva por caminho literal; zero untracked após o commit.
- **Risco residual:** nenhum novo. Débitos preexistentes preservados.
- **Próxima fase indicada no fechamento:** `ARCHITECT DECISION REQUIRED AFTER BACKLOG RECONCILIATION` — inalterada; candidatas de `G28-CAMADA-2` (`A4.1`, `A2.1`, `A6.1`) seguem sem prioridade inequívoca. Este registro não autoriza nenhuma subfase.

---

## 2026-07-16 — A4.1 + CAMADA2-LAST-ACCESS-RPC — Add temporary password schema and last sign-in read model

- **Gate:** `CLOSED / ACCEPTED`. Schema/RPC aditivo + extensão pontual de Edge Function (§14 `CODE_HEALTH_RULES.md` — sem UI, sem boot, sem produção, sem mistura de domínios).
- **Frente:** `G28-CAMADA-2`, subfases `A4.1` (schema `senha_temporaria`/política de senha) agrupada com a micro-fase `CAMADA2-LAST-ACCESS-RPC` (RPC de "último acesso"), conforme decisão do arquiteto registrada no closeout de `A3.2`.
- **Autorização:** ordem explícita do arquiteto ("AUTORIZAÇÃO DO ARQUITETO — SUBFASE A4.1 + CAMADA2-LAST-ACCESS-RPC"), Sonnet 5 / esforço médio, escopo restrito às duas migrations + extensão da Edge Function `admin-create-user` + aplicação em staging. UI de consumo (coluna "Último acesso") explicitamente **fora de escopo** desta ordem.
- **Commits técnicos:**
  - `bf0d522` — `Add temporary password schema and last sign-in read model` (`db/58_admin_usuarios_senha_temporaria.sql`, `db/59_admin_last_sign_in_readmodel.sql`, `supabase/functions/admin-create-user/index.ts`, `supabase/functions/admin-create-user/README.md`, `tests/admin-usuarios-senha-temporaria-schema.smoke.js`, `tests/admin-last-sign-in-readmodel.smoke.js`, `tests/admin-create-user.smoke.js`, `tests/document-decision-command-contract.test.js`).
  - `c6289f8` — `Add password-policy E2E verification runner for admin-create-user` (`scripts/staging/admin-create-user-password-policy-e2e.mjs`, `docs/DOCUMENTATION_INDEX.md`).
- **Commit documental:** este closeout (`Close temporary password schema phase`). O HEAD atual deve ser consultado com `git rev-parse HEAD`.
- **Schema (`db/58_admin_usuarios_senha_temporaria.sql`):** `usuarios.senha_temporaria BOOLEAN NOT NULL DEFAULT FALSE` + `usuarios.senha_gerada_em TIMESTAMPTZ NULL`. Aditiva, idempotente (`ADD COLUMN IF NOT EXISTS`). Base do caminho único decidido para `A4` (senha temporária + troca forçada no primeiro login); `A4.2` (guarda de boot + tela de troca) e `A4.3` (convite por e-mail, `NOT AUTHORIZED`) permanecem fora desta fase.
- **RPC (`db/59_admin_last_sign_in_readmodel.sql`):** `public.admin_usuarios_last_sign_in()` — `RETURNS TABLE(id UUID, last_sign_in_at TIMESTAMPTZ)`, `SECURITY DEFINER`, `STABLE`, `search_path=public,auth`, guarda `is_admin()` (padrão `db/12`) com `RAISE EXCEPTION ... USING ERRCODE = '42501'` para chamador não-admin. Expõe apenas `id`+`last_sign_in_at`; nunca email/senha/metadata. Grants explícitos no próprio arquivo: `REVOKE EXECUTE ... FROM PUBLIC, anon, service_role; GRANT EXECUTE ... TO authenticated` (lição de `db/30`/`db/54`/`db/57` — nunca confiar em default privileges).
- **Edge Function `admin-create-user` (extensão pontual):** `PASSWORD_MIN_LENGTH` 6→8 + `PASSWORD_DIGIT_RE = /[0-9]/` (≥1 dígito obrigatório); insert em `public.usuarios` passou a setar `senha_temporaria: true`, `senha_gerada_em: new Date().toISOString()`. `README.md` atualizado com a nova política.
- **Aplicação em staging (`ucrjtfswnfdlxwtmxnoo`), via Supabase MCP, migration rastreada:** `db/58` → registro `20260716014338 / 58_admin_usuarios_senha_temporaria`; `db/59` → registro `20260716014358 / 59_admin_last_sign_in_readmodel`. Ambos confirmados no catálogo antes/depois via `list_migrations`. Colunas verificadas ao vivo com tipo/nullability/default do arquivo; os 10 usuários pré-existentes preservados sem efeito retroativo (`senha_temporaria=false`, `senha_gerada_em=NULL` em todos, `count` confirmado). `pg_get_functiondef` de `admin_usuarios_last_sign_in` idêntico ao arquivo fonte.
- **Matriz de papéis da RPC (staging, read-only, `BEGIN…ROLLBACK`, sem fixtures):** `anon` → `ERROR 42501: permission denied for function admin_usuarios_last_sign_in` (bloqueado no limite de ACL, antes de executar); `authenticated` não-admin (fornecedor real ativo) → `ERROR 42501: Apenas administradores podem consultar o ultimo acesso de usuarios.` (negação de negócio dentro da função, `RAISE EXCEPTION`); `authenticated` admin (admin real ativo) → `ok`, retorna somente `id`+`last_sign_in_at`. ACL final verificada em `information_schema.routine_privileges`: apenas `authenticated` (EXECUTE explícito) e `postgres` (owner); `PUBLIC`/`anon`/`service_role` sem `EXECUTE`.
- **Deploy da Edge Function:** **executado pelo arquiteto** diretamente em staging (`ucrjtfswnfdlxwtmxnoo`) — fora do alcance de ferramentas/credenciais desta sessão (sem `SUPABASE_ACCESS_TOKEN`/CLI logada, sem tool MCP de deploy de Edge Function). Evidência indireta: `supabase/.temp/project-ref` (gerado localmente pela CLI do arquiteto, não versionado) contém `ucrjtfswnfdlxwtmxnoo`.
- **Verificação pós-deploy (E2E real em staging, `result: PASS`, 9/9 passos):** runner `scripts/staging/admin-create-user-password-policy-e2e.mjs` (mesmo esqueleto/garantias de segurança do `admin-disable-user-e2e.mjs` — login com senha real executado por humano, nunca pelo agente IA; sanitização de segredos; guarda de staging-only; config local gitignored), **executado pelo arquiteto** (o agente IA está estruturalmente impedido de entrar senha/token em qualquer campo, mesmo sob autorização explícita — regra permanente, não específica deste projeto). Passos confirmados: (1) `admin_login`; (2) `admin_active`; (3) `fornecedor_resolved` (`fornecedor_id=5`, fixture sintética "Teste"); (4) senha de 7 caracteres → `VALIDATION_ERROR` com mensagem de comprimento; (5) senha de 8 caracteres sem dígito → `VALIDATION_ERROR` com mensagem de dígito; (6) senha válida (8+ caracteres, 1+ dígito) → usuário sintético criado com sucesso; (7) `public.usuarios` confirmado via REST com `senha_temporaria=true` e `senha_gerada_em` preenchido; (8) cleanup via `admin-delete-user` (fluxo existente, hard delete + `confirm_email`) → `deleted=true`; (9) `cleanup_verify` — perfil ausente em `public.usuarios` após delete, **cleanup zero confirmado**.
- **Testes locais:** `node --check` PASS em todos os arquivos JS/`.mjs` tocados; `admin-usuarios-senha-temporaria-schema.smoke.js` **7/7**; `admin-last-sign-in-readmodel.smoke.js` **9/9**; `admin-create-user.smoke.js` estendido (7 chars falha por comprimento, 8 sem dígito falha por dígito, 8+dígito passa — validação real extraída do source; marcação `senha_temporaria`/`senha_gerada_em` no insert) **25/25**; allow-list de `db/` em `document-decision-command-contract.test.js` estendida (precedente `db/51`/`db/52`) para `db/58`/`db/59`; os 4 arquivos combinados **71/71**; regressão ampla `tests/admin-*.smoke.js` + `boot.smoke.js` **263/263**, sem regressão. `git diff --check` limpo (apenas avisos informativos LF→CRLF).
- **STRUCTURAL POLICY COMPLIANCE:** §7 (tamanho — todos os arquivos tocados entre 28–440 linhas, abaixo do teto aceitável de 500); §9 (writes Supabase — nenhum write novo em módulo de render; Edge Function existente estendida pontualmente); §13 (testes proporcionais — smokes novos + regressão 263/263 + E2E real de staging); §14 (fases — schema/RPC/Edge Function isolados de UI/docs; runner E2E e entrada de índice tratados em commit próprio, separado do commit técnico de schema); §15 (Git — `git status`/branch/HEAD verificados antes do patch, staging seletivo por caminho literal, sem `add -A`/`reset`/`rebase`/push); §16 (documentação — este closeout).
- **Não implementado nesta fase (fora de escopo, não iniciado):** consumo da RPC `db/59` na UI (coluna "Último acesso" em `js/screens/admin-usuarios.js`); `A4.2` (guarda de boot + tela de troca obrigatória, self-service `auth.updateUser`, gate visual); `A4.3` (convite por e-mail/SMTP, `NOT AUTHORIZED`).
- **Débito corrigido nesta fase:** `docs/operations/AUTH_USER_PROVISIONING_RUNBOOK.md` — os 2 pontos que citavam "mínimo 6 caracteres"/"senha < 6" (desatualizados desde a extensão da Edge Function) corrigidos para a política vigente (8 caracteres + 1 dígito) com nota sobre `senha_temporaria`/troca obrigatória prevista em `A4.2`.
- **Débitos preexistentes preservados (inalterados por esta fase):** `DB30_NOT_RECORDED_IN_SUPABASE_MIGRATION_HISTORY`; `AUTHENTICATED_BROWSER_SMOKE_NOT_EXECUTED` (G28-C/D/B7/Portal Cliente); `DEPLOYMENT_MAPPING_AND_PRODUCTION_MIGRATION_PROCEDURE`; `G28-D`; `DELETE-PROD-GUARD-A`; `DELETE-AUDIT-LOG-A`; `G28-CAMADA-3`/`G28-CAMADA-4`; worktree `app-next` divergente/sujo.
- **Produção:** `bhgifjrfagkzubpyqpew` não acessada em nenhum momento. **Push:** não executado.
- **Estado final do worktree:** limpo; staging vazio; zero untracked (`supabase/.temp/` é cache local da CLI do Supabase, não rastreado, gerado pela ação do arquiteto — não constitui trabalho pendente).
- **Risco residual:** nenhum novo. Guarda `is_admin()` e ACL de `db/59` testadas empiricamente nos 3 papéis relevantes; política de senha testada em produção real de staging (não apenas estaticamente).
- **Próxima fase indicada no fechamento:** `ARCHITECT DECISION` — candidatas: micro-fase de consumo da RPC `db/59` na UI (coluna "Último acesso" em `js/screens/admin-usuarios.js`, sob gate de mockup se envolver elemento visual novo); `A4.2` (guarda de boot + tela de troca obrigatória, gate visual). Nenhuma subfase autorizada por este registro.

## 2026-07-16 — A4.2 — Add mandatory password change gate

- **Gate:** `CLOSED / ACCEPTED`. Feature aditiva (tela + guarda) sobre schema já existente (`db/58`, `A4.1`) — sem migration nova, sem Edge Function nova, sem produção (§14 `CODE_HEALTH_RULES.md`).
- **Frente:** `G28-CAMADA-2`, subfase `A4.2` de `docs/architecture/CAMADA2_USUARIOS_SPEC_PROPOSED.md`, autorizada após `A4.1` + `CAMADA2-LAST-ACCESS-RPC`.
- **Autorização:** ordem explícita do arquiteto ("AUTORIZAÇÃO DO ARQUITETO — SUBFASE A4.2"), gate de mockup satisfeito (card centrado sem shell, checklist vivo, toggle de visibilidade, link "Sair da conta", aprovado em 2026-07-16), Sonnet 5 / esforço médio.
- **Hard stop levantado e resolvido dentro da fase, com decisão explícita do arquiteto (Opção A):** a guarda projetada (`se CURRENT_USER.senha_temporaria === true`) não podia funcionar porque `js/auth.js` (`loadCurrentUser()`) nunca selecionava `senha_temporaria`/`senha_gerada_em` — colunas adicionadas por `db/58` em `A4.1`, mas nunca lidas em nenhum lugar do repositório (confirmado por grep antes de escrever qualquer código). `js/auth.js` não estava no manifesto original da ordem. Antes de decidir unilateralmente, a sessão parou, verificou RLS/grants (read-only, catálogo ao vivo) e reportou 2 opções ao arquiteto: (A) ampliar `auth.js` só no `select`; (B) manter o manifesto e ler a flag via um helper próprio em `boot.js`. O arquiteto escolheu **Opção A**, ampliando o manifesto em exatamente 1 arquivo, para exatamente 1 mudança (2 colunas a mais no `select` de `loadCurrentUser()`) — nenhuma outra linha de `auth.js` tocada, mecanismo de Auth (§11) intocado.
- **Commit técnico:** `6c624ef` — `Add mandatory password change gate` (`js/auth.js`, `js/boot.js`, `js/trocar-senha-writes.js` (novo), `js/screens/trocar-senha-obrigatoria.js` (novo), `scripts/staging/trocar-senha-obrigatoria-e2e.mjs` (novo), `index.html`, `tests/auth.smoke.js`, `tests/boot.smoke.js`, `tests/trocar-senha-obrigatoria.smoke.js` (novo)).
- **Commit documental:** este closeout (`Close mandatory password change phase`). O HEAD atual deve ser consultado com `git rev-parse HEAD`.
- **RLS/grants verificados em staging (`ucrjtfswnfdlxwtmxnoo`) antes de codar, via Supabase MCP, read-only:** `pg_policy` em `public.usuarios` — `usuarios_self_update` (`polcmd='w'`, `USING id=auth.uid() AND ativo IS TRUE`, `WITH CHECK` preserva `tipo`, impede auto-escalação de papel); `information_schema.column_privileges` confirma `authenticated` com `UPDATE` explícito em `senha_temporaria` e `senha_gerada_em`. Conclusão: self-update funciona sem policy nova, sem afrouxamento de RLS existente.
- **`js/auth.js` (única mudança):** `select` de `loadCurrentUser()` ganha `senha_temporaria, senha_gerada_em` entre `cliente_id` e o join de `fornecedores`. Nenhuma outra linha alterada.
- **`js/boot.js`:** `isSenhaTemporariaExpirada(geradaEm)` — pura, 7 dias (política de `CAMADA2_USUARIOS_SPEC_PROPOSED.md`), sem estado de closure. `guardedHandleRoute()` — envolve `window.handleRoute` (de `js/router.js`, **intocado**) sem alterá-lo: usado no listener de `hashchange` (substitui o `window.handleRoute` direto) e na decisão inicial de `main()`, pós-`loadCurrentUser()`/pré-bootstrap G24-C. Se `CURRENT_USER.senha_temporaria === true`, renderiza a tela via `window.setApp` e retorna sem rotear. Exportado só para teste em `window.RAVATEX_BOOT_GUARD = { isSenhaTemporariaExpirada, guardedHandleRoute }`.
- **`js/trocar-senha-writes.js` (novo módulo, 51 linhas, write puro sem DOM/toast, mesmo contrato de `admin-usuarios-writes.js`):** `trocarSenhaObrigatoria(userId, novaSenha)` — `supabase.auth.updateUser({password})` self-service (sem `auth.admin.*`) e, em sucesso, `UPDATE usuarios SET senha_temporaria=false WHERE id=userId` via PostgREST. Retorna `{ok:true}` ou `{ok:false, stage:'auth'|'flag', error}` — `stage:'flag'` sinaliza estado parcial real (senha já trocada no Auth, perfil não atualizado), nunca tratado como sucesso silencioso.
- **`js/screens/trocar-senha-obrigatoria.js` (novo, 243 linhas, dentro do alvo ≤250L da ordem):** card centrado sem shell/menu (`#eceef1` fundo, card branco `#d8dce2` radius 6px), ícone cadeado (`#e8eefc`/`#2563eb`), título+texto, 2 campos com toggle de olho (`#8a93a3`), checklist vivo em `#f4f6f9` (3 critérios: 8+ caracteres, 1+ dígito, senhas coincidem — `#8a93a3` pendente → `#18794a` satisfeito, atualiza por tecla), botão "Definir nova senha" full-width `#2563eb` habilitado só com os 3 critérios verdes, link discreto "Sair da conta" (logout real via `window.logout`). Modo `expired` (`senha_gerada_em` > 7 dias): sem campos/checklist/botão, mensagem de expiração + "Sair da conta" como botão primário.
- **`index.html`:** `js/trocar-senha-writes.js?v=20260716-camada2-a42` (após `auth.js`, antes de `router.js`) e `js/screens/trocar-senha-obrigatoria.js?v=20260716-camada2-a42` (após `system-screens.js`), ambos antes de `boot.js`.
- **Testes locais:** `node --check` PASS nos 5 arquivos JS/`.mjs` tocados/novos; `tests/trocar-senha-obrigatoria.smoke.js` (novo) **14/14** (write sucesso/falha `auth`/falha `flag`; render normal título/campos/checklist/botão desabilitado/"Sair da conta"; checklist reage por tecla real via `dispatchEvent`; toggle de olho; submit sucesso com `loadCurrentUser`+`routeAfterLogin`; submit falha sem navegação silenciosa; modo `expired`; "Sair da conta" nos 2 modos); `tests/boot.smoke.js` estendido **44/44** (13 testes novos: namespace `RAVATEX_BOOT_GUARD`, `isSenhaTemporariaExpirada` pura incl. limite de 7 dias, `guardedHandleRoute` unitário nos 3 casos — `CURRENT_USER` nulo/flag false/flag true —, integração real via `main()` com sessão autenticada mockada — flag true bloqueia e renderiza, flag+expiração renderiza modo expirado, flag false segue fluxo normal —, ordem/cache-busting dos 2 scripts novos); `tests/auth.smoke.js` estendido (3 testes novos + 1 pré-existente corrigido — regex do formato do `select`, que mudou legitimamente) **37/43**, os 6 que falham confirmados idênticos ao baseline via `git stash` (regex desatualizado quanto a `?v=` em cache-busting de `<script src="js/auth.js">`, anterior a esta fase — não corrigido aqui, ver débito abaixo). Regressão consolidada (`boot`+`auth`+`trocar-senha-obrigatoria`+`admin-usuarios`+`cadastros-screens`) **150/156**, mesma contagem de débito pré-existente confirmada via `git stash`. `git diff --check` limpo (só avisos informativos LF→CRLF).
- **Verificação visual/funcional sem credenciais (preview local `http://localhost:8765`, staging `ucrjtfswnfdlxwtmxnoo`, sem login):** tela real (módulos carregados sem mock) renderizada num overlay de diagnóstico — modo normal confirmado via `get_page_text`; checklist reage a tecla real (`dispatchEvent('input')`) com cores computadas reais do navegador: 8+ caracteres+dígito com confirmação diferente → 2/3 verde (`rgb(24,121,74)`=`#18794a`) + 1 cinza (`rgb(138,147,163)`=`#8a93a3`), botão **continua desabilitado**; corrigindo a confirmação → 3/3 verde, botão **habilita**; toggle de olho `password→text→password` confirmado; modo `expired` — 0 campos, 0 `<form>`, só mensagem + "Sair da conta" confirmado via `querySelectorAll`. Console sem erros. Overlay desmontado ao final, nenhum estado real alterado.
- **Validação da perna autenticada — CONFIRMADA PELO ARQUITETO, validação manual em staging (`ucrjtfswnfdlxwtmxnoo`):** usuário sintético criado pelo fluxo novo (senha temporária via `admin-create-user`), gate exibido no primeiro login, checklist reagiu, troca efetuada, `senha_temporaria` zerada, segundo login entrou direto sem o gate. Usuário de teste removido ao final. **Motivo de o agente IA não ter executado essa perna diretamente:** entrar senha em qualquer campo (mesmo senha sintética/descartável) é proibido para o agente, regra permanente já registrada no closeout de `A4.1` — por isso foi criado `scripts/staging/trocar-senha-obrigatoria-e2e.mjs` (mesmo esqueleto/garantias de segurança do `admin-create-user-password-policy-e2e.mjs`: senha sintética gerada pelo próprio script, login automatizado feito pelo script quando executado por um humano, nunca pelo agente; sanitização de segredos; guarda de staging-only; config local gitignored) como runner equivalente para reexecução futura — **não executado nesta fase**, já que a validação usada para o closeout foi a manual do arquiteto.
- **Débito registrado nesta fase (não bloqueante, candidato a `CODE-HEALTH-AUDIT-§18-R1`):** os 6 testes pré-existentes em `tests/auth.smoke.js` que falham checando `<script src="js/auth.js">` sem considerar `?v=` (regex desatualizado desde que cache-busting foi adicionado a `auth.js`, confirmado idêntico ao baseline via `git stash`, anterior a esta fase) — não corrigido aqui, fora de escopo desta ordem.
- **Débito de continuidade documental (pré-existente, não gerado por esta fase, mas explicitado aqui):** a micro-fase `CAMADA2-LAST-ACCESS-UI` (consumo da RPC `db/59` — coluna "Último acesso" em `js/screens/admin-usuarios.js`, technical commit `0aff22f` — `Add last sign-in column to user admin`) teve seu relatório de implementação entregue (`IMPLEMENTAÇÃO VALIDADA / AGUARDANDO VALIDAÇÃO VISUAL DO ARQUITETO`), mas a sessão prosseguiu diretamente para a autorização de `A4.2` sem um `OK` explícito nem ordem de closeout registrada para essa micro-fase especificamente. Funcionalidade implementada e no histórico; falta apenas o registro documental formal (`CLOSED/ACCEPTED`) — pendente de confirmação/ordem própria do arquiteto.
- **STRUCTURAL POLICY COMPLIANCE:** §7 (tamanho — `trocar-senha-obrigatoria.js` 243L dentro do alvo ≤250L da ordem; `trocar-senha-writes.js` 51L; `boot.js` 166L, era 121L; `auth.js` 150L, era 149L — todos abaixo do teto aceitável de 500); §9 (writes Supabase — write novo isolado em módulo próprio, tabela/operação/payload/comportamento de erro/risco de estado parcial documentados no cabeçalho do arquivo, teste smoke correspondente); §10 (reads — leitura de perfil permanece em `auth.js`, único ponto de leitura de `CURRENT_USER`, sem duplicação); §11 (auth/perfil — `auth.js` alterado só no `select`, `id=auth.uid()` preservado, nenhuma máscara de ausência de perfil); §12 (cache-busting — os 2 scripts novos com `?v=20260716-camada2-a42`, ordem correta, smokes de `boot`/`index.html` atualizados); §13 (testes — `node --check` + smoke do módulo novo + smoke de boot atualizado, cobrindo rota/ordem de scripts + smokes existentes verdes, débito pré-existente isolado e confirmado); §14 (fases — escopo único: guarda+tela, sem migration, sem Edge Function nova, sem Admin API; hard stop resolvido em ordem separada de decisão, não misturado ao código); §15 (Git — `git status`/branch/HEAD verificados antes do patch, staging seletivo por caminho literal, sem `add -A`/`reset`/`rebase`/push); §16 (documentação — este closeout + `DOCUMENTATION_INDEX.md`).
- **Não implementado nesta fase (fora de escopo, não iniciado):** `A4.3` (convite por e-mail, `NOT AUTHORIZED`); `A2.1` (schema `nivel_acesso`); `A6.1` (schema/trigger de auditoria); `A5.1-A5.2` (reset de senha por admin, `Auth` risco médio — requer verificação dedicada equivalente a `admin-disable-user`).
- **Débitos preexistentes preservados (inalterados por esta fase):** `DB30_NOT_RECORDED_IN_SUPABASE_MIGRATION_HISTORY`; `AUTHENTICATED_BROWSER_SMOKE_NOT_EXECUTED` (G28-C/D/B7/Portal Cliente); `DEPLOYMENT_MAPPING_AND_PRODUCTION_MIGRATION_PROCEDURE`; `G28-D`; `DELETE-PROD-GUARD-A`; `DELETE-AUDIT-LOG-A`; `G28-CAMADA-3`/`G28-CAMADA-4`; worktree `app-next` divergente/sujo.
- **Produção:** `bhgifjrfagkzubpyqpew` não acessada em nenhum momento. **Push:** não executado.
- **Estado final do worktree:** limpo; staging vazio; zero untracked (`supabase/.temp/` pré-existente, cache local da CLI do Supabase, não gerado por esta sessão).
- **Risco residual:** nenhum novo. RLS `usuarios_self_update` e grants de `authenticated` verificados empiricamente antes de codar; guarda testada unitariamente nos 3 casos relevantes (`CURRENT_USER` nulo, flag false, flag true) e via integração real de `main()`; perna autenticada completa validada manualmente pelo arquiteto em staging real.
- **Próxima fase indicada no fechamento:** `ARCHITECT DECISION` — candidatas: `A2.1` (schema `nivel_acesso`), `A6.1` (schema/trigger de auditoria), `A5.1-A5.2` (reset de senha por admin). Nenhuma subfase autorizada por este registro. Confirmação/closeout formal de `CAMADA2-LAST-ACCESS-UI` também pendente (ver débito acima).

## 2026-07-16 — CAMADA2-LAST-ACCESS-UI — Close last sign-in column phase

- **Gate:** `CLOSED / ACCEPTED`. Feature aditiva de UI consumindo RPC já existente (`db/59`, `A4.1`) — sem schema, sem Edge Function, sem boot (§14 `CODE_HEALTH_RULES.md`).
- **Frente:** `G28-CAMADA-2`, micro-fase de consumo da RPC `admin_usuarios_last_sign_in` na tela de usuários, autorizada após `A4.1` + `CAMADA2-LAST-ACCESS-RPC`.
- **Autorização original:** "AUTORIZAÇÃO DO ARQUITETO — MICRO-FASE CAMADA2-LAST-ACCESS-UI", Sonnet 5 / esforço baixo, escopo restrito a `js/admin-usuarios-writes.js` + `js/screens/admin-usuarios.js` + smoke estendido; proibido write novo/migration/`index.html`/modal/boot.
- **Commit técnico:** `0aff22f` — `Add last sign-in column to user admin` (`js/admin-usuarios-writes.js`, `js/screens/admin-usuarios.js`, `tests/admin-usuarios.smoke.js`).
- **Commit documental:** este closeout (`Close last sign-in column phase`). O HEAD atual deve ser consultado com `git rev-parse HEAD`.
- **`js/admin-usuarios-writes.js`:** `fetchLastSignIn()` — `window.supa.rpc('admin_usuarios_last_sign_in')`, read puro sem DOM/toast, mesmo contrato do módulo.
- **`js/screens/admin-usuarios.js`:** `reload()` faz uma única chamada à RPC por ciclo, mergeando por `id` em `lastSignInById` (nenhuma chamada por linha); coluna "ULTIMO ACESSO" no grid (`formatLastSignIn`, `dd/mm/aaaa hh:mm`, `"—"` para nulo/ausente/inválido); ordenação "Último acesso" ativada em `sortRows` (mais recente primeiro, nulos sempre por último, independente da direção); falha da RPC capturada em `try/catch` — `console.warn`, `lastSignInById` fica vazio, coluna inteira cai para `"—"`, tela e lista continuam normais (fail-open para leitura, nunca derruba a UI).
- **Não tocado (confirmado por `git status` na fase):** nenhum write novo; nenhuma migration; `index.html` intocado; nenhum modal; `js/boot.js` intocado.
- **Testes locais:** `node --check` PASS; `tests/admin-usuarios.smoke.js` estendido **23/23** (4 testes novos: 22 — coluna presente/formato/fallback de nulo; 23 — RPC chamada exatamente 1x por `reload()`; 24 — falha da RPC não derruba a tela; 25 — ordenação com nulos por último); regressão `tests/boot.smoke.js` + `tests/cadastros-screens.smoke.js` + `tests/admin-*.smoke.js` **298/298**, sem regressão. `git diff --check` limpo.
- **Verificação em preview local (staging real `ucrjtfswnfdlxwtmxnoo`, sessão já autenticada, sem credenciais entradas pelo agente):** coluna "ULTIMO ACESSO" populada com dados reais (timestamps formatados corretamente, `"—"` para usuários nunca logados) via `get_page_text`; ordenação "Último acesso" aplicada ao vivo confirmou ordem decrescente correta com todos os `"—"` agrupados por último; console sem erros/warnings.
- **Validação visual — CONFIRMADA PELO ARQUITETO em 2026-07-16:** "coluna populada com dados reais, formato correto, `"—"` nos nunca-logados, ordenação com nulos por último — conferido no preview em 2026-07-16".
- **STRUCTURAL POLICY COMPLIANCE:** §7 (tamanho — `js/screens/admin-usuarios.js` 334 linhas, era 305; `js/admin-usuarios-writes.js` 206 linhas, era 196; ambos abaixo do teto aceitável de 500); §10 (reads Supabase — `fetchLastSignIn()` é read simples ligado à montagem da tela, extraído para o módulo de I/O já existente, mesmo padrão de `fetchUsuariosPageData`, sem write); §13 (testes — `node --check` + smoke do módulo (23/23) + regressão de boot/cadastros/admin-* (298/298); sem alteração de `index.html`/`boot.js`/ordem de scripts, smoke de rota/boot não exigido e não alterado); §14 (fases — escopo único, só frontend consumindo RPC já existente, sem Supabase/schema tocado).
- **Débito de continuidade documental fechado por este registro:** o relatório de implementação desta micro-fase ficou em `IMPLEMENTAÇÃO VALIDADA / AGUARDANDO VALIDAÇÃO VISUAL DO ARQUITETO` enquanto a sessão prosseguiu diretamente para a autorização de `A4.2`, sem `OK` explícito nem ordem de closeout registrada para esta micro-fase especificamente naquele momento. Confirmado e fechado nesta entrada, junto com a autorização de `A5.1-A5.2`.
- **Não implementado (fora de escopo, já registrado antes):** demais itens de `A3.2`/`A4` não relacionados a "último acesso".
- **Produção:** `bhgifjrfagkzubpyqpew` não acessada em nenhum momento. **Push:** não executado.
- **Estado final do worktree:** limpo; staging vazio; zero untracked (`supabase/.temp/` pré-existente, não gerado por esta sessão).
- **Risco residual:** nenhum. RPC já validada em staging com matriz de papéis (fase `A4.1`); consumo na UI é read-only, fail-closed em caso de erro.
- **Próxima fase indicada no fechamento:** já superada — `A5.1-A5.2` (reset de senha administrativo) autorizada e em andamento (ver entrada própria).

## 2026-07-16 — A5.1-A5.2 — Add admin password reset

- **Gate:** `CLOSED / ACCEPTED`. Edge Function nova + UI de ação (§14 `CODE_HEALTH_RULES.md`) — sem migration (db/58 cobre), sem boot, sem reativação (`A5.3-A5.4`), sem produção.
- **Frente:** `G28-CAMADA-2`, subfase `A5.1-A5.2` de `docs/architecture/CAMADA2_USUARIOS_SPEC_PROPOSED.md`, autorizada após `A4.2`. `A5.3-A5.4` explicitamente não inclusas.
- **Autorização:** ordem explícita do arquiteto ("ORDEM — A5.1-A5.2"), Sonnet 5 / esforço médio (superfície Admin API nova: `updateUserById({password})`, nunca exercitada antes neste repo). Decisão do arquiteto incorporada: auto-reset **BLOQUEADO** — admin usa o fluxo normal de troca (`A4.2`), evita footgun.
- **Commit técnico:** `b726717` — `Add admin password reset` (`supabase/functions/admin-reset-user-password/index.ts`, `supabase/functions/admin-reset-user-password/README.md`, `js/admin-usuarios-writes.js`, `js/screens/admin-usuarios.js`, `js/screens/admin-usuarios-modal.js`, `scripts/staging/admin-reset-password-e2e.mjs`, `tests/admin-reset-user-password.smoke.js`, `tests/admin-usuarios.smoke.js`).
- **Commit documental:** este closeout (`Close admin password reset phase`). O HEAD atual deve ser consultado com `git rev-parse HEAD`.
- **Edge Function `admin-reset-user-password` (espelho do esqueleto `admin-disable-user`):** JWT→admin ATIVO (`tipo='admin' AND ativo=true`)→payload; `SELF_RESET_FORBIDDEN` se `target_id === caller_id`; busca alvo em `public.usuarios` (`NOT_FOUND` se ausente); gera senha temporária de 12 caracteres via `crypto.getRandomValues` (charset sem ambiguidade visual `0`/`O`/`1`/`l`/`I`, garantia determinística de ≥1 dígito — nunca `Math.random`, nunca valor fixo por papel); `auth.admin.updateUserById(target_id, {password: newPassword})`; em sucesso, `UPDATE usuarios SET senha_temporaria=true, senha_gerada_em=now() WHERE id=target_id`; retorna `{user_id, email, tipo, password, senha_temporaria:true}` — a senha **uma única vez**, nunca logada em nenhum branch de erro (`console.error` só referencia `targetId`). Sem `ban_duration`, sem `auth.admin.createUser/deleteUser` (fora de escopo).
- **Estado parcial sem compensação segura:** o reset toca `updateUserById` **antes** do update de perfil. Se o update falhar após o reset no Auth ter sucesso (`PROFILE_UPDATE_FAILED`), não há reversão segura possível (senha antiga desconhecida/não recuperável) — retorna erro explícito orientando nova tentativa (idempotente, cada chamada gera uma senha nova independente do estado anterior). Documentado no README da função.
- **`js/admin-usuarios-writes.js`:** `resetarSenha(userId)` — `supa.functions.invoke('admin-reset-user-password', {body:{user_id}})`; `friendlyResetMessage(code, fallback)` mapeando os 8 códigos de erro para PT-BR.
- **`js/screens/admin-usuarios.js`:** botão de ícone chave (`ICON_KEY`, convenção visual idêntica aos 3 botões existentes — 30×30, borda `#eceef1`, cor `#8a93a3`) entre Editar e Desativar; guarda de auto-reset visual (desabilitado + tooltip "Nao pode resetar a propria senha" na própria linha), construída com atributo `disabled` **condicionalmente incluído no objeto de attrs** (só quando `true`) — padrão seguro que evita o footgun de `el()`/`setAttribute` com boolean (ver achado registrado abaixo).
- **`js/screens/admin-usuarios-modal.js`:** `openResetarSenhaModal(usr, {onDone})` — `window.confirmDialog` (nunca `window.confirm`), mensagem cita o e-mail do alvo; em sucesso, `openSenhaGeradaModal(password, email)` — `window.modal` com a senha em bloco monoespaçado selecionável, botão "Copiar senha" (Clipboard API, fallback gracioso via toast se a permissão for negada, sem crash), aviso "Esta senha não será exibida novamente"; a senha não é persistida em lugar nenhum além da closure da função (sai de escopo ao fechar o modal). Erro → toast + `friendlyResetMessage`, sem abrir o modal de senha (sem estado ambíguo).
- **Deploy da Edge Function:** **executado pelo arquiteto** diretamente em staging (`ucrjtfswnfdlxwtmxnoo`) — fora do alcance de credenciais/ferramentas desta sessão (agente IA não entra senha/token/API key em nenhum campo, regra permanente e não contornável por autorização, já registrada nos closeouts de `A4.1`/`A4.2`).
- **Verificação pós-deploy — E2E real em staging, `result: PASS` (15/15 passos), executado pelo arquiteto** via `scripts/staging/admin-reset-password-e2e.mjs` (mesmo esqueleto/garantias de segurança dos runners anteriores — login com senha real só por humano, nunca pelo agente; todas as senhas P1/P2/P3 geradas pelo próprio script ou recebidas da Edge Function, nunca digitadas; sanitização de segredos; guarda de staging-only; config local gitignored). `test_user_id: 170f8479-e2da-4a6d-b597-080716be9c20`. Passos confirmados: `admin_login`; `admin_active`; `fornecedor_resolved`; `create_synthetic_user` (senha P1); `self_reset_forbidden` (admin tenta resetar a própria senha → `403 SELF_RESET_FORBIDDEN`); `reset_not_found` (UUID inexistente → `404 NOT_FOUND`); `reset_synthetic_user` (senha P2 recebida, não impressa); `reset_flag_and_timestamp` (`senha_temporaria=true`, `senha_gerada_em` atualizado, comparado ao valor da criação); `old_password_rejected` (P1 não funciona mais — login esperado falhar, confirmado); `synthetic_login_new_password` (login com P2 ok, próprio token lê `senha_temporaria=true` — a guarda `A4.2` dispararia aqui no app real); `self_service_password_change` (P3 via `PATCH /auth/v1/user` + `PATCH /rest/v1/usuarios` self-service, mesmo caminho de `A4.2`); `flag_cleared_confirmed` (`senha_temporaria=false`, token admin); `relogin_no_gate` (login com P3 ok, `senha_temporaria=false` — "próximo login entra direto", sem gate); `cleanup_delete` (`admin-delete-user`, `deleted=true`); `cleanup_verify` (perfil ausente, cleanup zero confirmado).
- **Testes locais:** `node --check` PASS em todos os arquivos JS/TS/`.mjs` tocados/novos; `tests/admin-reset-user-password.smoke.js` (novo, estático) **23/23** — inclui simulação real de 1000 amostras da régua de senha com `crypto.randomBytes` (nunca menos de 8 caracteres, sempre ≥1 dígito), charset sem ambiguidade visual confirmado, nenhum `console.*` referenciando `newPassword`; `tests/admin-usuarios.smoke.js` estendido **29/29** (6 testes novos: namespaces, botão+guarda visual, `confirmDialog` com e-mail correto, fluxo de sucesso completo até "Senha gerada" com senha/copiar/aviso, fluxo de erro sem modal de senha, write isolado); regressão consolidada (9 suítes relacionadas: `admin-usuarios`, `admin-reset-user-password`, `boot`, `cadastros-screens`, `admin-create-user`, `auth-disable-user-schema`, `cadastros-usuarios-auth-ui`, `auth`, `trocar-senha-obrigatoria`) **268/275**, os 7 que falham confirmados idênticos ao baseline pré-existente (6 de `tests/auth.smoke.js` + 1 de `tests/cadastros-*`, nenhum novo). `git diff --check` limpo.
- **Verificação visual sem credenciais (preview local, sem login), aceita pelo arquiteto como evidência suficiente dispensando o gate de validação visual separado:** fluxo completo exercitado em navegador real (`window.supa` mockado localmente, nenhuma escrita real em staging) — botão → `confirmDialog` (título "Resetar senha", menciona o e-mail do alvo) → confirmar → `invoke('admin-reset-user-password', {user_id})` → modal "Senha gerada" com a senha/botão copiar/aviso confirmados via `textContent` real; guarda de auto-reset confirmada com valores reais de `.disabled` (`window.el(...).disabled`) no DOM real, não em mock de teste.
- **Achado fora de escopo — candidato `UI-EL-BOOLEAN-ATTR-FIX` (`NOT AUTHORIZED`, severidade `NÃO CONFIRMADA` — verificação do arquiteto pendente):** durante a implementação, o executor observou empiricamente em navegador real (`window.el('button', {disabled:false}, 'x').disabled === true`) que `js/ui.js`'s `el()` não trata boolean em `setAttribute` — `setAttribute('disabled', false)` marca o atributo presente em qualquer navegador real. Isso potencialmente afeta os botões "Desativar" (`disabled: user.ativo === false`) e "Excluir" (`disabled: !!(meId && user.id === meId)`) em `js/screens/admin-usuarios.js`, que poderiam ficar incorretamente desabilitados no caso comum (usuário ativo / não é o próprio admin) — mesma causa-raiz do resíduo já corrigido uma vez em `expedicao-admin.js` (fase "Admin/Pedido — Resíduo Estático do Botão de Conclusão"). **Por decisão do arquiteto, registrado como severidade NÃO CONFIRMADA — tratar como potencial regressão ativa até verificação direta do arquiteto nos botões Desativar/Excluir da tela de usuários em staging.** Não corrigido nesta fase (fora do manifesto de `A5.1-A5.2`, que proíbe explicitamente tocar `admin-disable/delete/create`). O botão de reset novo usa o padrão seguro (chave `disabled` só entra no objeto de attrs quando `true`), confirmado empiricamente no mesmo navegador.
- **Achado fora de escopo — candidato de decomposição (`CODE-HEALTH-AUDIT-§18-R1`):** `js/screens/admin-usuarios-modal.js` chegou a 576 linhas (acima do "aceitável" 500 de §7) ao acomodar o 4º modal (mesmo padrão dos 3 existentes: criar/editar, desativar, excluir). Não extraído para arquivo novo nesta fase — a ordem autorizou explicitamente `admin-usuarios-modal.js` como destino (item 3 do escopo), sem arquivo novo no manifesto (`PROIBIDO: qualquer necessidade fora do manifesto`).
- **STRUCTURAL POLICY COMPLIANCE:** §7 (tamanho — `admin-reset-user-password/index.ts` 267L, `admin-usuarios-writes.js` 239L, `admin-usuarios.js` 351L, todos abaixo do teto; `admin-usuarios-modal.js` 576L acima do aceitável, justificado acima); §9 (writes Supabase — write novo isolado `resetarSenha`, operação/payload/comportamento de erro documentados, teste smoke correspondente); §13 (testes — `node --check` + smoke da Edge Function 23/23 + smoke da UI 6 novos + regressão 268/275 com débito isolado); §14 (fases — escopo único: Edge Function + UI de ação, sem migration, sem tocar `admin-disable/delete/create`, sem `ban_duration`, sem reativação); §15 (Git — staging seletivo por caminho literal, 8 arquivos exatos, sem `add -A`/`reset`/`rebase`/push); §16 (documentação — este closeout + `docs/DOCUMENTATION_INDEX.md`).
- **Não implementado nesta fase (fora de escopo, não iniciado):** `A5.3-A5.4` (reativação, autorização própria futura); `A2.1` (schema `nivel_acesso`); `A6.1` (schema/trigger de auditoria); correção de `UI-EL-BOOLEAN-ATTR-FIX`.
- **Débitos preexistentes preservados (inalterados por esta fase):** `DB30_NOT_RECORDED_IN_SUPABASE_MIGRATION_HISTORY`; `AUTHENTICATED_BROWSER_SMOKE_NOT_EXECUTED`; `DEPLOYMENT_MAPPING_AND_PRODUCTION_MIGRATION_PROCEDURE`; `G28-D`; `DELETE-PROD-GUARD-A`; `DELETE-AUDIT-LOG-A`; `G28-CAMADA-3`/`G28-CAMADA-4`; débito de teste de baseline de `A4.2` (6 testes de `tests/auth.smoke.js`); worktree `app-next` divergente/sujo.
- **Produção:** `bhgifjrfagkzubpyqpew` não acessada em nenhum momento. **Push:** não executado.
- **Estado final do worktree:** limpo; staging vazio; zero untracked (`supabase/.temp/` pré-existente, cache local da CLI do Supabase, não gerado por esta sessão).
- **Risco residual:** nenhum novo confirmado. `UI-EL-BOOLEAN-ATTR-FIX` é um achado NÃO CONFIRMADO (severidade pendente de verificação do arquiteto), registrado explicitamente para não ser esquecido, não tratado como bloqueio corrente.
- **Próxima fase indicada no fechamento:** `ARCHITECT DECISION` — candidatas: `A5.3-A5.4` (reativação), `UI-EL-BOOLEAN-ATTR-FIX` (pendente de confirmação), `A2.1` (schema `nivel_acesso`), `A6.1` (schema/trigger de auditoria). Nenhuma subfase autorizada por este registro.

## 2026-07-16 — DOC-LANGUAGE-MIGRATION-L1 — Translate governance documents to English (L1)

- **Gate:** `CLOSED / ACCEPTED`. Docs-only translation slice — no code, SQL, migration, Supabase, staging, production or push. First English-authored entry of the DOC-LANGUAGE-MIGRATION era; earlier entries are immutable and remain in their original language.
- **Front:** `DOC-LANGUAGE-MIGRATION`, batch `L1` (governance and rules), authorized by explicit architect order plus an addendum that distributes the language policy across the canonical homes.
- **Authorization:** architect order "ORDEM — DOC-LANGUAGE-MIGRATION-L1" (translation configured for Sonnet 5 / medium effort; audit as a separate high-effort pass) plus "ADENDO À ORDEM DOC-LANGUAGE-MIGRATION-L1". Runtime note: Sonnet 5 was unavailable in this environment (the model alias resolved to an inaccessible model), so the translate and audit passes ran on the session model instead — the two-pass structure and the medium-translate / high-audit effort split were preserved.
- **Accepted commit:** this closeout (`Translate governance documents to English (L1)`). Consult the actual HEAD with `git rev-parse HEAD`.
- **Translated files (content to English; canonical paths, file names, anchors and cross-references unchanged):** `docs/architecture/CODE_HEALTH_RULES.md`, `docs/governance/SUPERVISION_PROTOCOL.md`, `docs/governance/DOCUMENTATION_MODEL.md`, `CLAUDE.md`. Each pt-BR original was moved, in this same commit, to `docs/archive/pt-BR/<original-path>` (byte-for-byte preservation, verified with `cmp`).
- **Preserved verbatim (not translated):** canonical status vocabulary (`CLOSED`, `ACCEPTED`, `NOT AUTHORIZED`, `AUTHORIZED`, `DEFERRED`, `PROPOSED`, `HARD STOP`, `READ-ONLY`, `STRUCTURAL POLICY COMPLIANCE`, the `PLAN_ALIGNMENT` label block); the architect's verbatim supervision-handoff block in `SUPERVISION_PROTOCOL.md` (Appendix, kept in Portuguese); the operational gate marker `IMPLEMENTAÇÃO VALIDADA / AGUARDANDO VALIDAÇÃO VISUAL DO ARQUITETO`; and `DOCUMENTATION_MODEL.md` §17 (already English). Role names were mapped ARQUITETO→ARCHITECT / PARECERISTA→REVIEWER / EXECUTOR RESIDENTE→RESIDENT EXECUTOR.
- **Language policy incorporated (addendum; English; same commit):** `DOCUMENTATION_MODEL.md` §18 "Language policy"; `CODE_HEALTH_RULES.md` §19 "Rule for language"; `SUPERVISION_PROTOCOL.md` §3 order-format language line; `CLAUDE.md` pointer-summary pointing to those canonical homes.
- **Index:** `docs/DOCUMENTATION_INDEX.md` updated — new §7 recording the DOC-LANGUAGE-MIGRATION track and the `docs/archive/pt-BR/` archive, plus provenance notes on the four translated rows. The index itself was kept in Portuguese (not in L1 scope; its own future slice).
- **Audit (separate high-effort pass, order step 3):** original × translation compared line by line on normative load (status, conditions, negations, quantifiers, prohibitions) and on structural fidelity. Divergences found and fixed: 1 by the audit pass (`DOCUMENTATION_MODEL.md` H1 title left in Portuguese → corrected) and 1 by the resident executor's final review (`CLAUDE.md` `**PROIBIDA**` left untranslated → `**FORBIDDEN**`). Structural invariants (heading count, code fences, table rows) match the originals; code fences byte-identical; no `[pt: ...]` pending items.
- **Verification:** `git diff --check` clean; archive copies byte-identical to originals (`cmp`); Portuguese-residue scan clean except the intended verbatim items above.
- **Residual risk:** none functional (docs-only). Non-blocking consistency note: `CODE_HEALTH_RULES.md` now carries 19 numbered rules; the "18 rules of modularization" descriptors (`DOCUMENTATION_MODEL.md` §2, `CLAUDE.md`, `docs/DOCUMENTATION_INDEX.md`) were left as-is because rule 19 is a language rule, not a modularization rule ("demais termos inalterados") — a count change is a one-line follow-up if the architect prefers it.
- **Production:** `bhgifjrfagkzubpyqpew` not accessed. **Push:** not executed.
- **Final worktree state:** clean; staging by literal path only; `supabase/.temp/` remains pre-existing untracked (not generated by this session, not staged).
- **Next phase indicated at closeout:** `ARCHITECT DECISION` — subsequent DOC-LANGUAGE-MIGRATION batches (`L2`+) are not authorized by this entry.

## 2026-07-16 — DOC-LANGUAGE-MIGRATION-L2 — Translate living state documents to English (L2)

- **Gate:** `CLOSED / ACCEPTED`. Docs-only translation slice — no code, SQL, migration, Supabase, staging, production or push. Second batch of the DOC-LANGUAGE-MIGRATION track (living state documents).
- **Front:** `DOC-LANGUAGE-MIGRATION`, batch `L2`, authorized by explicit architect order plus an amendment that replaced Rule 2.
- **Authorization:** architect order "ORDER — DOC-LANGUAGE-MIGRATION-L2" (translate pass Sonnet 5; separate mandatory Opus 4.8 high-effort audit, "think hard") plus "AMENDMENT TO DOC-LANGUAGE-MIGRATION-L2". Runtime note: Sonnet 5 was unavailable in this environment (its alias resolves to an inaccessible model) — the translate pass ran on session-model subagents (one per file; `PROJECT_STATE.md` split into 3 section-aligned chunks after a single-agent stall), and the mandatory Opus 4.8 high-effort audit was performed by the resident executor in the main context (precedent: L1 runtime deviation, accepted).
- **Amendment (Rule 2 replaced):** ALL content translated to English, including recorded architect decisions and previously-verbatim Portuguese blocks. Each translated Architect Decision record carries the provenance note `(translated from the architect's original Portuguese; original in docs/archive/pt-BR/)` (3 in `PROJECT_STATE.md`, 3 in `AGENT_HANDOFF.md`). The pt-BR archive remains the authoritative wording of those decisions in any nuance dispute.
- **Translated files (content to English; file names, anchors, paths, cross-references unchanged):** `PROJECT_STATE.md`, `AGENT_HANDOFF.md`. Each pre-L2 original was moved, in this same commit, to `docs/archive/pt-BR/<path>` (byte-for-byte, verified with `cmp`).
- **Language policy updated (amendment, same commit):** `DOCUMENTATION_MODEL.md` §18 reworded — "architect orders may be issued in Portuguese; once recorded in canonical documents they are recorded in English, with the original wording preserved in the ledger or archive"; `SUPERVISION_PROTOCOL.md` §3 language line aligned and its appendix supervision-handoff block translated to English (a template, not a signed decision; pt-BR original preserved in the L1 archive); `CLAUDE.md` language summary updated to match; `docs/DOCUMENTATION_INDEX.md` §7 intro + a new `L2` batch table + provenance notes on the two rows.
- **Kept verbatim:** canonical status vocabulary; the operational gate marker `IMPLEMENTAÇÃO VALIDADA / AGUARDANDO VALIDAÇÃO VISUAL DO ARQUITETO`; the front labels `Camada N`; user-facing pt-BR UI strings (`Concluir pedido`, `Último acesso`/`ULTIMO ACESSO`, `Senha gerada`, `Sair da conta`, `Desativar`, `Excluir`, `dd/mm/aaaa hh:mm`); phase IDs, commit SHAs, dates, environment refs, code identifiers; the already-English L1 block in `PROJECT_STATE.md` (reproduced byte-identical).
- **Audit (Opus 4.8, high effort, separate pass over the concatenated files):** SHAs and dates identical between originals and translations (set diff); status-token counts preserved (only intended pt→en increases, e.g. `DIFERIDO`→`DEFERRED`, `NÃO ACEITA`→`NOT ACCEPTED`; zero losses); structure intact (headings/fences/table-rows match; `PROJECT_STATE.md` −10 lines = wrapping compression, no content drop — verified 66/66 bold-label bullets identical); L1 block byte-identical; all 16 `AGENT_HANDOFF.md` section cross-references resolve to `PROJECT_STATE.md` headings. No `[pt: ...]` pending items.
- **Cross-seam terminology reconciled (chunk/agent divergences fixed to a single rendering):** `documental`→`documentation`/`document` (unified to the AGENT_HANDOFF rendering; note: L1 uses "documentary" — flagged, not re-edited); `Portal Cliente`→`Client Portal`; `Guarda`→`Guard` (the immutable commit message keeps `gate`); `Users`→`User Screen Extraction`; Last-Access-RPC-consumption word order unified.
- **Verification:** `git diff --check` clean; archive copies byte-identical (`cmp`); the commit message `Add mandatory password change gate` and the code field `documentary_history_blocker` preserved intact.
- **Accepted commit:** this closeout (`Translate living state documents to English (L2)`). Consult the actual HEAD with `git rev-parse HEAD`.
- **Production:** `bhgifjrfagkzubpyqpew` not accessed. **Push:** not executed.
- **Final worktree state:** clean; staging by literal path only; `supabase/.temp/` remains pre-existing untracked (not staged).
- **Next phase indicated at closeout:** `ARCHITECT DECISION` — subsequent DOC-LANGUAGE-MIGRATION batches (`L3`+) are not authorized by this entry.

## 2026-07-16 — PROJECT-STATE-COMPACTION-A — Compact PROJECT_STATE to current-state-only

- **Gate:** `CLOSED / ACCEPTED`. Docs-only structural reorganization — no code, SQL, migration, Supabase, staging, production or push. `PROJECT_STATE.md` rewritten to current-state-only with no content loss.
- **Front:** living-state maintenance, authorized by explicit architect order "ORDER — PROJECT-STATE-COMPACTION-A" (paste-gated to run only after L2 was `CLOSED / ACCEPTED`).
- **Preceding follow-up (same session, commit `e980265`):** applied the two L2-acceptance rulings — unified the documentation term (`documental` → `documentation`/`document`, including re-editing committed L1 `docs/governance/DOCUMENTATION_MODEL.md` as explicitly authorized for this one term) and recorded the phase-ID naming rule in `DOCUMENTATION_MODEL.md` §18 (`Camada N` ↔ `G28-CAMADA-N`, never translated).
- **Result:** `PROJECT_STATE.md` **999 → 189 lines** (active phase / next action, binding decisions in force, live debts and candidates, environment/worktree standing facts, "Closed phases" index, mandatory links, historical-reference pointers).
- **Archive (new):** the historical phase-closeout narratives (former `PROJECT_STATE.md` lines 7–954 — 18 phase sections) moved verbatim, in original order, to `docs/closeouts/PROJECT_STATE_ARCHIVE_2026-07.md`. Binding rulings from the three Architect Decision sections are restated (condensed) in `PROJECT_STATE.md` §"Binding decisions in force"; their full verbatim records remain in the archive and in `docs/archive/pt-BR/PROJECT_STATE.md`.
- **No content loss (block classification):** MOVE = former lines 7–954 → archive verbatim (948 lines); KEEP = former lines 1–6 (preamble) + 955–999 (Relevant debts, Historical reference, Mandatory links, legacy pre-model pointer) → carried into the new `PROJECT_STATE.md` (debts/links/reference near-verbatim; preamble and legacy pointer condensed with all facts preserved). Every former block accounted for.
- **AGENT_HANDOFF.md:** not compacted (per order). Its 17 "Full detail" pointers to former `PROJECT_STATE.md` sections were redirected to `docs/closeouts/PROJECT_STATE_ARCHIVE_2026-07.md`; a compaction note added at the top; the mandatory-reading `PROJECT_STATE.md` references left intact.
- **Index:** `docs/DOCUMENTATION_INDEX.md` §1c registers the archive file as preservation (not a current-state source).
- **Verification:** new `PROJECT_STATE.md` 189 lines (≤ ~300 target); archive 948 moved lines + header; canonical status tokens preserved; commit SHAs preserved; `git diff --check` clean; cross-references (mandatory links, archive pointer) resolve.
- **Accepted commit:** this closeout (`Compact PROJECT_STATE to current-state-only`). Consult the actual HEAD with `git rev-parse HEAD`.
- **Production:** `bhgifjrfagkzubpyqpew` not accessed. **Push:** not executed.
- **Final worktree state:** clean; staging by literal path only; `supabase/.temp/` remains pre-existing untracked (not staged).
- **Next phase indicated at closeout:** `ARCHITECT DECISION`. This phase satisfies the stated precondition for `DOC-LANGUAGE-MIGRATION-L3`, which remains `NOT AUTHORIZED` pending its own explicit order.

## 2026-07-16 — DOC-LANGUAGE-MIGRATION-L3 — Translate specs and plans to English (L3)

- **Gate:** `CLOSED / ACCEPTED`. Docs-only translation slice — no code, SQL, migration, staging, production or push. Final lot of the DOC-LANGUAGE-MIGRATION track for currently-scoped canonical documents.
- **Front:** `DOC-LANGUAGE-MIGRATION`, batch `L3`, authorized by explicit architect order after `PROJECT-STATE-COMPACTION-A` closed (stated precondition).
- **Authorization:** architect order "ORDER — DOC-LANGUAGE-MIGRATION-L3 (final lot: specs and plans)". Runtime note (accepted precedent from L1/L2): Sonnet 5 unavailable in this environment; translate pass ran on session-model subagents (large files split into section-aligned chunks by heading text, not line number, after two off-by-one line-citation errors were self-corrected by the agents matching on heading text); the mandatory high-effort whole-file audit was performed by the resident executor in the main context.
- **Scope — 19 files translated** (content only; file names, anchors, paths, cross-references unchanged): the 7 files named in the order (`CAMADA2_USUARIOS_SPEC_PROPOSED.md`, `DOCUMENTOS_VALIDACAO_VINCULOS_E_EVOLUCAO_PLANO.md`, `PEDIDO_PRODUCTION_FLOW_BACKLOG.md`, `PEDIDO_OP_MOVIMENTACAO_DOCUMENTOS_PLANO.md`, `PEDIDO_OP_SCHEMA_CONTRACT.md`, `BACKLOG_RECONCILIATION_R1_2026-07-15.md`, `CAMADA2_A32_MOCKUP_APPROVED.md`) plus, per architect scope ruling on the order's "plus any remaining pt-BR file in docs/" clause: 3 `docs/operations/` runbooks, 8 `docs/architecture/`+`docs/ui/` living contracts, and `docs/DOCUMENTATION_INDEX.md` itself (the arbiter — not previously touched in L1/L2). Each pt-BR original moved, same commit, to `docs/archive/pt-BR/<path>` (byte-for-byte, verified with `cmp`, all 19 identical).
- **Explicitly excluded from L3 (architect ruling, remain pt-BR):** `docs/qa/*` and `docs/superpowers/*` (18 files, self-classified `NÃO GUIAM EXECUÇÃO` / one subfolder flagged dangerous for AI to follow literally — historical/quarantined, same class as ledgers/archive); the root `docs/*.md` legacy files in the same `DOCUMENTATION_INDEX.md` §4 "Docs legadas" table (`DEPLOYMENT.md`, `AI_AGENT_RULES.md`, `BACKUP_AND_RESTORE.md`, `HANDOFF.md`, `STAGING_BASELINE.md`); `docs/legacy/pre-model/*.md` (byte-immutable snapshots with a recorded SHA-256 — translating would violate their own immutability guarantee, not literally named in the order's exclusion list but in direct conflict with a separate binding rule); `docs/releases/G28_D_RELEASE_CANDIDATE.md` (already English, 0 pt-BR content found).
- **Kept verbatim:** canonical status vocabulary; the gate marker `IMPLEMENTAÇÃO VALIDADA / AGUARDANDO VALIDAÇÃO VISUAL DO ARQUITETO`; front labels `Camada N`; user-facing pt-BR UI strings; phase/decision IDs, commit SHAs, dates, environment refs, code/SQL identifiers; fenced code blocks reproduced byte-for-byte (including literal order-format blocks such as the G28-P0/PLAN_ALIGNMENT-style blocks and one "Ready-to-issue order for G11-B" block in `DOCUMENTS_INGESTOR_CONSUMER_DESIGN.md`, flagged as a discretionary preserved-verbatim judgment call for architect review).
- **Structural check (before audit, per order):** all 19 files — heading count, fence count, and table-row count identical original vs. translation, verified before and after every subsequent fix. Line-count deltas (−86 to +9 lines) fully explained: wrapping compression/expansion, never a content drop (spot-verified in depth on the largest delta, `PEDIDO_OP_SCHEMA_CONTRACT.md` −86 lines/−11%, by direct side-by-side reading of its largest section, all 24 decision IDs present).
- **Audit (whole-file, high effort, resident executor):** SHAs and dates identical (set diff) across all 19 files, zero mismatches. Full read-and-compare of the two highest-normative-stakes files: `BACKLOG_RECONCILIATION_R1_2026-07-15.md` (ratified reference baseline; §6 divergence verdicts D1–D7 verified clause-by-clause, zero drift on any negation/quantifier/judgment) and `docs/DOCUMENTATION_INDEX.md` (the arbiter; full read).
- **Divergences found and corrected (cross-file terminology + line-wrap false positives + real gaps):**
  - `documental` (adjective) reappeared in 4 files (translate-pass regression vs. the L2 architect ruling) — swept and unified to `documentation`/`document` across all 19 files (0 remaining).
  - `Atualizacao` vs. `Update` section-heading inconsistency across 4 files — unified to `Update` (majority rendering; the one file forced to keep it verbatim by an over-specific instruction was corrected).
  - `Portal Cliente` leftover in 3 files — unified to `Client Portal`.
  - `Pedido`/`Order` inconsistency within `CLIENTE_PORTAL_UI_GAP_INVENTORY.md` (its own §4 vs. §6, from two different chunk agents) — unified to `Pedido` (the file's and project's dominant rendering).
  - 3 instances of a canonical multi-word status token (`NOT AUTHORIZED`) split across a markdown line-wrap (present in 2 files; 1 pre-existing in the pt-BR original itself, 2 introduced by translation reflow) — rejoined for grep-ability; a systematic re-scan across all 19 files for the same pattern on 11 tokens found zero further instances.
  - **8 table-header rows left in Portuguese** (`Documento`→`Document`, `Arquivo`→`File`, `Papel`→`Role`, `Propósito`→`Purpose`, `Categoria`→`Category`, `Fase`→`Phase`) in `docs/DOCUMENTATION_INDEX.md`, plus **6 more** of the same defect class found by a full-file sweep in `CAMADA2_USUARIOS_SPEC_PROPOSED.md` and `PEDIDO_PRODUCTION_FLOW_BACKLOG.md` (content/prose correctly translated, header row left pt-BR) — all 14 fixed; re-swept to zero across all 19 files.
  - Broader residual-Portuguese-prose sweep (connector words, common verbs) across all 19 files: every hit traced to a legitimate cause (quoted pt-BR UI string, fenced code block preserved verbatim) — no further translation gaps found.
- **`docs/DOCUMENTATION_INDEX.md` self-update (same file, same commit):** §7 gained a `Batch DOC-LANGUAGE-MIGRATION-L3` table (19 rows) plus a note recording the excluded-file categories above; §1/§1c/§1d rows for the 4 previously-untranslated-index-referenced files (`DOCUMENTATION_MODEL.md`, `SUPERVISION_PROTOCOL.md`, `PROJECT_STATE.md`, `AGENT_HANDOFF.md`, `CODE_HEALTH_RULES.md`, `CLAUDE.md`) already carried provenance notes from L1/L2 and were left as-is; new `docs/closeouts/PROJECT_STATE_ARCHIVE_2026-07.md` (from `PROJECT-STATE-COMPACTION-A`) already indexed in §1c.
- **No `[pt: ...]` pending items** — no phrase was too ambiguous to translate with certainty across all 19 files.
- **Verification:** `git diff --check` clean (only pre-existing Markdown hard-break trailing-space markers, confirmed present in the pt-BR originals too, not introduced); archive copies byte-identical (`cmp`, all 19); structural counts (headings/fences/tables) identical original vs. final translation for all 19 files after every fix.
- **Accepted commit:** this closeout (`Translate specs and plans to English (L3)`). Consult the actual HEAD with `git rev-parse HEAD`.
- **Production:** `bhgifjrfagkzubpyqpew` not accessed. **Push:** not executed.
- **Final worktree state:** clean; staging by literal path only; `supabase/.temp/` remains pre-existing untracked (not staged).
- **Next phase indicated at closeout:** `ARCHITECT DECISION`. `DOC-LANGUAGE-MIGRATION` closes for the currently-scoped canonical documents; any translation of the excluded historical/quarantined categories requires its own future order.

## 2026-07-16 — DOC-LANGUAGE-MIGRATION-L3-FOLLOWUP — Translate G11-B historical order block

- **Gate:** `CLOSED / ACCEPTED`. Docs-only follow-up to L3 — no code, SQL, migration, staging, production or push.
- **Front:** `DOC-LANGUAGE-MIGRATION`, small follow-up to batch `L3`, authorized by explicit architect ruling on the one item flagged for review in the L3 report.
- **Scope:** `docs/architecture/DOCUMENTS_INGESTOR_CONSUMER_DESIGN.md` §5, "Ready-to-issue order for G11-B (next IAExecutor)" — the one fenced block in the L3 scope left in Portuguese as a discretionary "preserve fenced content verbatim" judgment call. Architect ruling: translate it, with the standard provenance note. Translated (labels, prose, "Do not" list, section title) while keeping verbatim: phase ID, commit SHAs (`381506c`, `956682d`), branch/file names, function names, namespace, test commands, and — per the file's own established convention elsewhere — the quoted literal UI section name (`"Documentos Recebidos"`), status-enum literals (`Aceito`/`Pendente`/`Rejeitado`), and domain direction/type literals (`Entrada`/`Saída`, `NF`/`Romaneio`). Provenance note `(translated from the architect's original Portuguese; original in docs/archive/pt-BR/)` added under the heading — the byte-identical pt-BR original was already archived in the `L3` commit (`77c8243`) and remains authoritative for any nuance dispute.
- **Permanent exclusion ratified (`DOCUMENTATION_MODEL.md` §18):** the `docs/legacy/pre-model/*` immutability exclusion — flagged as a discretionary judgment call in the `L3` report (not literally named in that order's exclusion list, but in direct conflict with the separate binding immutability rule for those SHA-256-anchored snapshots) — is now recorded as a permanent, standing exclusion alongside ledgers/`docs/handoffs/`/`docs/archive/`, together with `docs/qa/*`, `docs/superpowers/*`, and the root `docs/*.md` legacy files (already excluded by ruling in `L3`).
- **Verification:** fence count and heading count unchanged in the touched file; no residual Portuguese prose outside the deliberately-kept literals; `git diff --check` clean.
- **Accepted commit:** this closeout (`Translate G11-B historical order block`). Consult the actual HEAD with `git rev-parse HEAD`.
- **Production:** `bhgifjrfagkzubpyqpew` not accessed. **Push:** not executed.
- **Final worktree state:** clean; staging by literal path only; `supabase/.temp/` remains pre-existing untracked (not staged).
- **Track closure — `DOC-LANGUAGE-MIGRATION`: `COMPLETE`.** `L1` (governance: `CODE_HEALTH_RULES.md`, `SUPERVISION_PROTOCOL.md`, `DOCUMENTATION_MODEL.md`, `CLAUDE.md`) + `L2` (living state: `PROJECT_STATE.md`, `AGENT_HANDOFF.md`) + `L3` (19 files: the remaining active specs/plans/contracts/reports/runbooks + the `DOCUMENTATION_INDEX.md` arbiter itself) + this follow-up (the one remaining historical order block) together translate every currently-scoped canonical document to English. `docs/qa/*`, `docs/superpowers/*`, the root `docs/*.md` legacy files, and `docs/legacy/pre-model/*` are permanently excluded — quarantined (historical, self-classified as not guiding execution) or immutable (SHA-256-anchored snapshots) by standing rule in `DOCUMENTATION_MODEL.md` §18, not by omission. **`DOC-LANGUAGE-MIGRATION-L4` and any further batch: `NOT AUTHORIZED`** — reopening translation of an excluded category requires its own future architect order.

## 2026-07-16 — A5.3-A5.4 — Add admin user reactivation

- **Gate:** `CLOSED / ACCEPTED`. New Edge Function + UI action (§14 `CODE_HEALTH_RULES.md`) — no migration, no boot, no production.
- **Front:** `G28-CAMADA-2`, subphase `A5.3-A5.4` of `docs/architecture/CAMADA2_USUARIOS_SPEC_PROPOSED.md`, authorized in parallel with `A5.1-A5.2` per the subphase/gate table. Completes the `A5` track (reset + reactivation).
- **Authorization:** explicit architect order ("ARCHITECT AUTHORIZATION — SUBPHASE A5.3-A5.4"), Sonnet 5 / medium effort (Edge Function mirroring `admin-disable-user` with one new Admin API parameter, `ban_duration: 'none'`).
- **Technical commit:** `f886e26` — `Add admin user reactivation` (`supabase/functions/admin-reactivate-user/index.ts`, `supabase/functions/admin-reactivate-user/README.md`, `js/admin-usuarios-writes.js`, `js/screens/admin-usuarios.js`, `js/screens/admin-usuarios-modal.js`, `scripts/staging/admin-reactivate-e2e.mjs`, `tests/admin-reactivate-user.smoke.js`, `tests/admin-usuarios.smoke.js`).
- **Documentation commit:** this closeout (`Close admin user reactivation phase`). The current HEAD must be consulted with `git rev-parse HEAD`.
- **Edge Function `admin-reactivate-user` (symmetric counterpart of `admin-disable-user`):** JWT→active admin (`tipo='admin' AND ativo=true`)→payload; `SELF_REACTIVATE_FORBIDDEN` if `target_id === caller_id` (practically unreachable, guarded for symmetry); fetches the target in `public.usuarios` (`NOT_FOUND` if absent); requires the target to be inactive (`REACTIVATE_NOT_INACTIVE` otherwise — deliberately **not** idempotent, unlike `admin-disable-user`'s `already_disabled`: reactivating an already-active user is a caller error, there is no ambiguous "already reactivated" state to collapse into); `UPDATE usuarios SET ativo=true, desativado_em=null, desativado_por=null, motivo_desativacao=null WHERE id=target_id`; `auth.admin.updateUserById(target_id, {ban_duration:'none'})`; returns `{user_id, email, tipo, ativo:true, auth_banned:false}`.
- **Compensation on partial failure:** if the Auth unban call fails after the profile has already been marked `ativo=true`, the function reverts to the *exact* previous inactive state — `desativado_em`/`desativado_por`/`motivo_desativacao` are read and preserved **before** the update, not re-stamped with new values — returning `AUTH_UNBAN_FAILED`; if the reversion itself fails, `COMPENSATION_FAILED` (manual action required). Same design pattern as `admin-disable-user`'s compensation.
- **`js/admin-usuarios-writes.js`:** `reativarUsuario(userId)` — `supa.functions.invoke('admin-reactivate-user', {body:{user_id}})`; `friendlyReactivateMessage(code, fallback)` mapping the error codes to PT-BR.
- **`js/screens/admin-usuarios.js`:** inactive rows swap the ban icon for a refresh icon in the same action slot (safe boolean-attr pattern — no `disabled` key on this button in either state, which incidentally also cleared the `UI-EL-BOOLEAN-ATTR-FIX` risk for this specific control, see finding below).
- **`js/screens/admin-usuarios-modal.js`:** `openReativarModal(usr, {onDone})` — `window.confirmDialog` (non-destructive, `danger:false`), message cites the target's e-mail; success → toast; error → toast + `friendlyReactivateMessage`, no ambiguous state.
- **Deploy of the Edge Function: executed by the architect** directly in staging (`ucrjtfswnfdlxwtmxnoo`) — outside the credential reach of this session (AI agent does not enter password/token/API key in any field, permanent rule).
- **Post-deploy verification — real E2E in staging, `result: PASS` (13/13 steps), executed by the architect** via `scripts/staging/admin-reactivate-e2e.mjs` (`test_user_id: 860b6fea-ac9e-45b1-8b85-9cfa255020e4`). Steps confirmed: `admin_login`; `admin_active`; `fornecedor_resolved`; `create_synthetic_user`; `synthetic_login_before_disable`; `disable_synthetic_user` (`ativo=false`, `auth_banned=true`, existing `admin-disable-user` flow); `login_blocked_after_disable` (HTTP 400, banned); `reactivate_synthetic_user` (`ativo=true`, `auth_banned=false`); `profile_flags_cleared` (`desativado_em`/`desativado_por`/`motivo_desativacao` all `null`); `login_restored`; `reactivate_not_inactive_guard` (`REACTIVATE_NOT_INACTIVE` on the now-active target); `cleanup_delete`; `cleanup_verify` (zero cleanup confirmed).
- **Local tests:** `node --check` PASS on all touched/new files; `tests/admin-reactivate-user.smoke.js` (new, static) **22/22**; `tests/admin-usuarios.smoke.js` extended **35/35** (6 new tests: icon swap by `ativo` state, `confirmDialog`, full success flow, error flow, isolated write); consolidated regression across the touched suites (`admin-usuarios`, `admin-reactivate-user`, `admin-disable-user`, `admin-reset-user-password`, `boot`, `cadastros-screens`) **195/195**, no regressions. `git diff --check` clean.
- **Architect visual validation:** Desativar button on an active user **confirmed working** in staging.
- **Finding — `UI-EL-BOOLEAN-ATTR-FIX` severity updated from `NOT CONFIRMED` to `CONFIRMED — ACTIVE REGRESSION`:** while validating the Reativar flow, the architect found that a disabled user disappears from the Usuários screen and stays gone even with "Mostrar inativos" checked — the checkbox does not visually reflect its real state and appears to always render checked. Root cause diagnosed: `js/screens/admin-usuarios.js`'s toggle passes `checked: mostrarInativos` straight into `window.el()`, which calls `node.setAttribute('checked', mostrarInativos)` unconditionally; since `renderStandalone()` creates a brand-new `<input>` on every re-render, the `checked` attribute is always present as a string (`"true"`/`"false"`), and HTML boolean attributes are true-by-presence regardless of value — so the fresh checkbox always renders checked, independent of the actual `mostrarInativos` state. Same root cause as the `disabled="null"` residue already fixed once in `expedicao-admin.js`, now empirically reproduced via a second control. The Excluir button in the same file (`disabled: !!(meId && user.id === meId)`) carries the identical pattern and is unconfirmed but suspect. Not fixed in this phase (outside the `A5.3-A5.4` manifest; mixing diagnosis with a patch here would violate `CODE_HEALTH_RULES.md` §14). Recorded as the priority `ARCHITECT DECISION` candidate.
- **Finding unchanged — decomposition candidate (`CODE-HEALTH-AUDIT-§18-R1`):** `js/screens/admin-usuarios-modal.js` grew from 576 to 604 lines accommodating the 5th modal (`openReativarModal`); already a recorded candidate, no action taken.
- **Production:** `bhgifjrfagkzubpyqpew` not accessed. **Push:** not executed.
- **Final worktree state:** clean; staging by literal path only; `supabase/.temp/` remains pre-existing untracked (not staged).
- **A5 track closure:** `A5.1-A5.2` (administrative password reset) + `A5.3-A5.4` (user reactivation) together close the full `A5` track (reset + blocking + reactivation) of `docs/architecture/CAMADA2_USUARIOS_SPEC_PROPOSED.md`.
- **Next phase indicated at closeout:** `ARCHITECT DECISION` among `UI-EL-BOOLEAN-ATTR-FIX` (now `CONFIRMED — ACTIVE REGRESSION`, recommended priority), `A2.1` (`nivel_acesso` schema) and `A6.1` (audit schema/trigger). `A3.4` unlocks once the remaining `A2`/`A6` subphases close.
