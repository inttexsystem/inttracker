# HANDOFF OPERACIONAL ATIVO

- **Frente ativa:** `G28-B8 — correção, revogação, restauração e auditoria — IMPLEMENTED / TESTED (local) / READY FOR ARCHITECT ACCEPTANCE` (IAexec não auto-fecha). Escopo mínimo completo estendendo o escritor canônico único (sem escritor concorrente): correção (conjunto completo → nova revisão; anterior revogada, não apagada; revisão ativa esperada; idempotente; stale/divergente falham; ator/timestamp/motivo); revogação/unlink (estado explícito vazio; anterior preservada; sugestão/decisão intocadas); restauração (`restaurar_vinculos_documento` copia o estado histórico para nova revisão carimbando `restored_from_revision_id`, sem mutar a linha histórica, revalidando compatibilidade fail-closed); auditoria (trilha read-only append-only + unicidade da revisão ativa, fail-closed). Migration aditiva `db/52` (coluna `restored_from_revision_id` + evolução DEFAULT-NULL do escritor `registrar_vinculos_documento` + RPC de restauração; sem DROP TABLE/backfill; B5/legada intactas). Módulos: `js/document-link-audit-read-model.js`, `js/document-link-admin-controller.js`, `js/screens/document-link-admin-modal.js`; adapter estendido (`loadDocumentLinkRevisionHistory`, `restoreDocumentLinksInCloud`, `reason` opcional em `registerDocumentLinksInCloud`); wired só na fila central (`documentos-recebidos.js` `handleLinkAdmin` + ação de linha); `index.html` carrega os três. Resolve o HEAD final deste commit com `git rev-parse HEAD`.
- **Verificação remota exigida (não executada — Supabase proibido para o agente local):** aplicar + verificar `db/52` em staging `ucrjtfswnfdlxwtmxnoo` (coluna/FK/índice, assinatura/grants do escritor evoluído, RPC de restauração, replay idempotente, concorrência otimista, restauração fail-closed de alvo invalidado) e render autenticado admin do modal (histórico/correção/unlink/restauração/feedback). Sem nova forma de query remota além da leitura aditiva de histórico.
- **Testes locais (LF):** document-link-correction-restoration-contract 13/13, document-link-audit-read-model 11/11, document-link-admin-controller 18/18, document-link-admin-modal.smoke 12/12, documents-supabase-links 25/25 (12 novos B8); bateria documental B4–B8 (26 arquivos) **831/831**. `node --check` nos 5 JS alterados/novos; `git diff --check` limpo (LF→CRLF informativo). Débitos pré-existentes inalterados vs baseline B7: `pedido-detail.smoke.js` 140/41 (CRLF), `ops-list-screen.smoke.js` 19/11, `op-form-helpers.smoke.js` 33/3, `op-writes.smoke.js` 48/1, `documents-ingestor.test.js` 2, `g14-c-bridge-smoke.test.js` 15.
- **Workspace / branch / base técnico:** `D:\OneDrive\Programação\Ravatex\controle-tapetes-g28` / `work/g28-document-qualification` / baseline B7 `9ef61e1896af631bc5aeeced4af93c77051f4de4`.
- **Última fase aceita:** `G28-B7 — exibição nas superfícies — CLOSED / ACCEPTED_WITH_NONBLOCKING_REMOTE_SMOKE_DEBT` (aceite arquitetural explícito em 2026-07-14; parcial `ed35f04`, conclusão `9ef61e1`). Débito não bloqueante: smoke autenticado das superfícies B7 em staging `ucrjtfswnfdlxwtmxnoo`. B6 permanece `CLOSED / ACCEPTED_WITH_NONBLOCKING_TEST_DEBT`. Produção `bhgifjrfagkzubpyqpew` não acessada.
- **Staging diretamente verificado:** projeto `ucrjtfswnfdlxwtmxnoo` (produção `bhgifjrfagkzubpyqpew` não acessada). Matriz `registrar_vinculos_documento` 20/20; composição atômica com sucesso, falha de link, rollback de falha de decisão, retry e conflitos; links confirmados não escrevem `document_candidates/document_events.{pedido_id,pedido_manual}`. Sem correção técnica.
- **Fixtures:** marcador `G28-B6-VERIFY-c63b6c2c8aff4da58e87d1e75f7a9236`; event, decisão, OP B/cancelada, pedido cancelado e lote B órfão removidos. Permanecem somente candidate + grafo canônico restritivo (1 cliente, 2 pedidos, 2 lotes, 4 OPs, 8 revisões/10 linhas OP), pois apagar filhos de auditoria para forçar remoção destruiria o histórico aprovado.
- **Frontend:** app local servido temporariamente em `127.0.0.1` confirmou URL Supabase staging; login/admin browser não disponível, portanto `LIVE_MODAL_SMOKE_BLOCKED_BY_TOOLING`. Fallback do leitor retornou `supabase_unavailable`; sem write do leitor.
- **Próxima ação autorizável:** aceite arquitetural de `G28-B8` (correção/revogação/restauração/auditoria implementadas e testadas localmente). Nenhuma fase posterior a B8 autorizada; sem push. `OPEN_ARCHITECT_DECISIONS: NONE`.
- **Leitura obrigatória antes de rotear qualquer ordem:** `PROJECT_STATE.md`, este handoff, plano mestre, ledger G28 e contratos/runtime aplicáveis.
- **Runtime boundaries:** contrato Documento→Pedido 0..1 e Documento→OP 0..N; tabelas de revisão dedicadas; Ingestor retém campos candidate/event; B5 preservado; sem `statusOverrides`, dupla escrita, backfill ou produção.
- **Risco residual:** `db/52` versionada e NÃO aplicada — schema/RPC/idempotência/compatibilidade e o smoke autenticado do modal de administração precisam ser aplicados e verificados em `ucrjtfswnfdlxwtmxnoo` (por Hermes, sem delegação) antes do aceite; o controller B8 mantém o reuso de command-id em memória (convergência durável depende da idempotência da RPC servidor). Aceite arquitetural de B8 ainda pendente.

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
