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
