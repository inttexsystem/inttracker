# HANDOFF OPERACIONAL ATIVO

- **Frente ativa:** `G28-B5-D5 — CLOSED / ACCEPTED`.
- **Workspace:** `D:\OneDrive\Programação\Ravatex\controle-tapetes-g28`
- **Branch:** `work/g28-document-qualification`
- **Pre-closeout HEAD:** `ead68843ffc60db8da4551e0aa46341ff33bfb0c` — `G28-B5-D5-B4-C-R1: correct documentary closeout state`
- **Technical HEAD (B4):** `3d64b62f25516ef0d18e2613fc50298e2faee16a` — `G28-B5-D5-B4: remove legacy document decision RPC runtime`
- **Estado:** `G28-B5-D5 — CLOSED / ACCEPTED`.
- **D5 result:** GREEN. All regression evidence accepted. Runtime: `RUNTIME_DECIDIR_DOCUMENTO_CALLS=0`, `RUNTIME_DECIDE_DOCUMENT_IN_CLOUD_EXPORTS=0`, `RUNTIME_STATUS_OVERRIDES=0`. Syntax checks (3) exit 0. Focused tests: 584 pass / 0 fail across 13 files.
- **Historical debt:** `tests/documents-ingestor.test.js` 2 known failures; `tests/g14-c-bridge-smoke.test.js` 15 known fixture failures. Identical to baseline. Not blocking D5 gates.
- **Runtime boundaries:** Canonical register adapter `registerDocumentDecisionInCloud`/`registrar_decisao_documento` preserved. Canonical undo adapter `undoDocumentDecisionInCloud`/`desfazer_decisao_documento` preserved. SQL `decidir_documento` preserved (not removed, not migrated). No `statusOverrides` or parallel state.
- **Residual decision (binding):** The explicit manual/legacy local decision domain remains temporarily supported. Only `manual` or `legacy` documents may read, write, or remove local decisions. Supabase, unknown, absent, empty, null, invalid, and g22-auto sources must remain fail-closed and must never use local decision persistence. D5 does not authorize migration, automatic conversion, database removal, or removal of the explicit legacy domain. This does not preserve or authorize silent fallback, source inference, local persistence for Supabase/unknown, visual parallel state, `decideDocumentInCloud`, JavaScript calls to `decidir_documento`, aliases, proxies, wrappers, or stubs.
- **Nenhum acesso remoto:** sem external, database, staging, produção, Supabase, SQL, migration ou push.
- **Risco residual:** External consumers outside this repository of `window.RAVATEX_DOCUMENTS.decideDocumentInCloud` may exist and will no longer find that export. The explicit legacy local domain persists temporarily as a binding residual.
- **B6/B8:** não iniciados. Nenhuma próxima fase autorizada. Qualquer nova implementação requer autorização arquitetural explícita e separada.

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
