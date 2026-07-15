# HANDOFF OPERACIONAL ATIVO

- **Frente ativa:** `G28-B7 — exibição nas superfícies — IMPLEMENTED / TESTED (local) / READY FOR ARCHITECT ACCEPTANCE`. Incremento: read model canônico de projeção reversa (`js/document-surface-links-read-model.js`) + seção `DOCUMENTOS VINCULADOS` no detalhe do Pedido (`pedido-detail-progress.js`/`pedido-detail-render.js`), confirmados via revisão canônica ativa, distintos das sugestões `pedido_manual`. Superfícies restantes de B7 (detalhe da OP, timeline, busca global) têm o mecanismo pronto (`buildLinkedDocumentsForOp`) e exigem verificação de render autenticado em staging `ucrjtfswnfdlxwtmxnoo` (Supabase proibido para o Claude). Testes locais LF: read model 14/14, pedido-detail-linked-documents 6/6, queue-ui 58/58, bateria de documentos 475/475, regressão B5-D5 303/303; `pedido-detail.smoke.js` mantém 41 falhas CRLF pré-existentes idênticas ao baseline.
- **Workspace / branch / base técnico:** `D:\OneDrive\Programação\Ravatex\controle-tapetes-g28` / `work/g28-document-qualification` / commit técnico B6 `b2f180ed0e6f1c2ee6c02881d0199d1bfaf29366`; closeout de verificação em staging `b130db44d32718ddf6d3e2bffb1439dac3a1948f`.
- **Última fase aceita:** `G28-B6 — CLOSED / ACCEPTED_WITH_NONBLOCKING_TEST_DEBT` (aceite arquitetural explícito em 2026-07-14; supersede o checkpoint anterior). Staging `ucrjtfswnfdlxwtmxnoo`; produção `bhgifjrfagkzubpyqpew` não acessada. Débitos aceitos: (1) smoke autenticado de browser pendente; (2) duas expectativas obsoletas em `tests/documentos-recebidos-queue-ui.test.js`; (3) grafo sintético de auditoria em staging preservado sob `ON DELETE RESTRICT`.
- **Staging diretamente verificado:** projeto `ucrjtfswnfdlxwtmxnoo` (produção `bhgifjrfagkzubpyqpew` não acessada). Matriz `registrar_vinculos_documento` 20/20; composição atômica com sucesso, falha de link, rollback de falha de decisão, retry e conflitos; links confirmados não escrevem `document_candidates/document_events.{pedido_id,pedido_manual}`. Sem correção técnica.
- **Fixtures:** marcador `G28-B6-VERIFY-c63b6c2c8aff4da58e87d1e75f7a9236`; event, decisão, OP B/cancelada, pedido cancelado e lote B órfão removidos. Permanecem somente candidate + grafo canônico restritivo (1 cliente, 2 pedidos, 2 lotes, 4 OPs, 8 revisões/10 linhas OP), pois apagar filhos de auditoria para forçar remoção destruiria o histórico aprovado.
- **Frontend:** app local servido temporariamente em `127.0.0.1` confirmou URL Supabase staging; login/admin browser não disponível, portanto `LIVE_MODAL_SMOKE_BLOCKED_BY_TOOLING`. Fallback do leitor retornou `supabase_unavailable`; sem write do leitor.
- **Próxima ação autorizável:** aceite arquitetural do incremento `G28-B7` e/ou autorização para continuar as superfícies restantes de B7. `G28-B8` não autorizado; sem push.
- **Leitura obrigatória antes de rotear qualquer ordem:** `PROJECT_STATE.md`, este handoff, plano mestre, ledger G28 e contratos/runtime aplicáveis.
- **Runtime boundaries:** contrato Documento→Pedido 0..1 e Documento→OP 0..N; tabelas de revisão dedicadas; Ingestor retém campos candidate/event; B5 preservado; sem `statusOverrides`, dupla escrita, backfill ou produção.
- **Risco residual:** smoke do modal autenticado ficou bloqueado exclusivamente por ausência de autenticação admin no browser; aceite arquitetural ainda pendente.

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
