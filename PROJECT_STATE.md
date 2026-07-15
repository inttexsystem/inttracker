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
- **Última fase aceita:** `G28-C — CLOSED / ACCEPTED_WITH_NONBLOCKING_AUTHENTICATED_BROWSER_SMOKE_DEBT` (decisão arquitetural explícita). Base: matriz staging/projeções 16/16, sem defeito material, cleanup zero e ledger append-only; produção não acessada.
- **Fase ativa:** `G28-D — RELEASE CONTRACT DISCOVERY AND RELEASE-CANDIDATE PREPARATION`; autorizado somente para descoberta/preparo local, sem publicação, push, produção ou aceite.
- **Schema/RPC (migration aditiva `db/52_document_link_correction_revocation_restoration.sql`, APLICADA em staging):** registro `20260715024449 / 52_document_link_correction_revocation_restoration` em `ucrjtfswnfdlxwtmxnoo`; `restored_from_revision_id UUID`, FK self-reference `ON DELETE RESTRICT`, índice parcial, escritor evoluído com `p_reason`/`p_restored_from_revision_id` DEFAULT NULL e `restaurar_vinculos_documento` foram verificados em catálogo. Chamadas B6 posicionais de 5 argumentos e as RPCs B5 permaneceram compatíveis/inalteradas. Aditiva: sem backfill, sem tocar candidates/events/decisions.
- **Runtime/UI:** `js/documents-supabase-links.js` (+`loadDocumentLinkRevisionHistory` read-only fail-closed; +`restoreDocumentLinksInCloud`; `registerDocumentLinksInCloud` carrega `reason` opcional preservando a forma de 5 params); novos módulos puros `js/document-link-audit-read-model.js` (trilha ordenada + unicidade da ativa) e `js/document-link-admin-controller.js` (orquestração correção/revogação/restauração; reuso de command-id na retry com a RPC como autoridade de idempotência; concorrência otimista; mapeamento outcome→UI); novo modal `js/screens/document-link-admin-modal.js` (inspeciona ativos + histórico, corrige, desvincula, restaura; motivo obrigatório; stale/conflict/indisponível fail-closed). Wired só na fila central Documentos (`js/screens/documentos-recebidos.js`: `handleLinkAdmin` guardado + ação de linha "Histórico e vínculos"); superfícies read-only Pedido/OP não tocadas. `index.html` carrega os três módulos novos.
- **Verificação direta de staging:** Hermes aplicou a migration 52 e aprovou estrutura/RPC/grants e matriz autenticada `G28-B8-VERIFY` 18/18; B6 cinco-argumentos e B5 intacto foram confirmados. O browser não possui aplicação/sessão admin: `LIVE_B8_MODAL_SMOKE_BLOCKED_BY_TOOLING`.
- **Testes locais (LF, exit 0):** `document-link-correction-restoration-contract` 13/13; `document-link-audit-read-model` 11/11; `document-link-admin-controller` 18/18; `document-link-admin-modal.smoke` 12/12; `documents-supabase-links` 25/25 (12 novos B8). Bateria documental B4–B8 (26 arquivos) **831/831**. `node --check` nos 5 arquivos JS alterados/novos; `git diff --check` limpo (apenas LF→CRLF informativo). Allow-list de `db/` em `document-decision-command-contract` estendida para `db/52` (gate de manifesto git), consistente com o precedente de `db/51`.
- **Débitos pré-existentes inalterados vs baseline B7:** `pedido-detail.smoke.js` 140/41 (CRLF); `ops-list-screen.smoke.js` 19/11, `op-form-helpers.smoke.js` 33/3, `op-writes.smoke.js` 48/1 (regex estrito de index.html sobre arquivos não tocados); `documents-ingestor.test.js` 2; `g14-c-bridge-smoke.test.js` 15.
- **Estado G28-D:** `RELEASE CONTRACT DISCOVERY COMPLETE / BLOCKED BY SPECIFIC MISSING DEPLOYMENT DEFINITION`. Falta uma definição canônica atual do mapeamento de publicação de produção e do procedimento autorizado para migrations 51/52; ver `docs/releases/G28_D_RELEASE_CANDIDATE.md`. Sem push; produção proibida. Débito não bloqueante: `AUTHENTICATED_BROWSER_SMOKE_BLOCKED_BY_TOOLING`.
- **Contrato B6/B8 preservado:** Documento→Pedido 0..1; Documento→OP 0..N; revisão canônica append-only tipada/versionada; `document_candidates.pedido_id`/`document_events.pedido_id` sob propriedade do Ingestor; `pedido_manual` permanece sugestão; correção/revogação/restauração nunca apagam histórico nem tocam decisão/sugestão.
- **OPEN_ARCHITECT_DECISIONS:** `DEPLOYMENT_MAPPING_AND_PRODUCTION_MIGRATION_PROCEDURE`.
- **Fases posteriores:** não autorizadas. G28-D não foi aceito nem publicado; esta autorização limitada não autoriza publicação nem fases posteriores.
- **Plano mestre reconciliado:** `docs/architecture/DOCUMENTOS_VALIDACAO_VINCULOS_E_EVOLUCAO_PLANO.md` (G28-PLAN-R1 2026-07-14)
- **Subfases B5-D5 aceitas:** B5-B1 (idempotent decision command contract), B5-B2 (migration applied/verified staging), D4-R1 (canonical runtime modules loaded), D5-A (source boundary diagnosis), D5-B1 (explicit source classification), D5-B2 (source-gated local decision helpers), D5-B3 (statusOverrides removal), D5-B4 (legacy decision RPC runtime removal), D5 (consolidated regression GREEN). Ver ledger G28 para detalhes de commits e validação.
- **Push:** não executado
- **Produção:** projeto `bhgifjrfagkzubpyqpew` não acessado
- **Runtime boundaries:** canonical register/undo adapters and RPCs preserved; SQL `decidir_documento` preserved (not removed, not migrated); no `statusOverrides` or parallel state; no `decideDocumentInCloud`; explicit manual/legacy local domain temporarily supported; Supabase/unknown/absent/null/invalid/g22-auto fail-closed; no migration, conversion, or removal of legacy domain authorized.

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
