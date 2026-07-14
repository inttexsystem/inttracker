# HANDOFF OPERACIONAL ATIVO

- **Frente:** G28 — D5-B4 record legacy decision RPC runtime removal — `CLOSED / ACCEPTED`
- **Workspace:** `D:\OneDrive\Programação\Ravatex\controle-tapetes-g28`
- **Branch:** `work/g28-document-qualification`
- **HEAD:** `3d64b62f25516ef0d18e2613fc50298e2faee16a` — `G28-B5-D5-B4: remove legacy document decision RPC runtime`
- **Estado:** `G28-B5-D5-B4 — CLOSED / ACCEPTED`.
- **Manifesto técnico:** `js/documents-supabase-decisions.js`, `tests/documents-supabase-decisions.test.js`, `tests/documentos-recebidos.smoke.js`, `tests/document-legacy-decision-rpc-runtime-boundary.test.js`.
- **Remoção:** `decideDocumentInCloud` e `window.RAVATEX_DOCUMENTS.decideDocumentInCloud` removidos; zero chamadas JavaScript runtime a `decidir_documento`.
- **Preservado:** `registerDocumentDecisionInCloud`/`registrar_decisao_documento` (adapter canônico) e `undoDocumentDecisionInCloud`/`desfazer_decisao_documento` (undo adapter) permanecem. SQL `decidir_documento` não foi removido.
- **Validação:** gates focados verdes; revisão independente `APPROVE`.
- **Nenhum acesso remoto:** sem external, database, staging, produção, Supabase, SQL, migration ou push.
- **Telemetria:** indisponível e não bloqueante.
- **Risco residual:** consumidores externos de `decidir_documento` fora deste repositório podem existir.
- **D5-B5 e B8:** permanecem não autorizados e não iniciados.

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
