# HANDOFF OPERACIONAL ATIVO

- **Frente ativa:** `G28-B6 — canonical document links — READY FOR ARCHITECT ACCEPTANCE` (não `CLOSED`/`ACCEPTED`).
- **Workspace / branch / base técnico:** `D:\OneDrive\Programação\Ravatex\controle-tapetes-g28` / `work/g28-document-qualification` / `b2f180ed0e6f1c2ee6c02881d0199d1bfaf29366` antes do closeout.
- **Última fase aceita:** `G28-PLAN-R1 — CLOSED / ACCEPTED`.
- **Staging diretamente verificado:** projeto `ucrjtfswnfdlxwtmxnoo` (produção `bhgifjrfagkzubpyqpew` não acessada). Matriz `registrar_vinculos_documento` 20/20; composição atômica com sucesso, falha de link, rollback de falha de decisão, retry e conflitos; links confirmados não escrevem `document_candidates/document_events.{pedido_id,pedido_manual}`. Sem correção técnica.
- **Fixtures:** marcador `G28-B6-VERIFY-c63b6c2c8aff4da58e87d1e75f7a9236`; event, decisão, OP B/cancelada, pedido cancelado e lote B órfão removidos. Permanecem somente candidate + grafo canônico restritivo (1 cliente, 2 pedidos, 2 lotes, 4 OPs, 8 revisões/10 linhas OP), pois apagar filhos de auditoria para forçar remoção destruiria o histórico aprovado.
- **Frontend:** app local servido temporariamente em `127.0.0.1` confirmou URL Supabase staging; login/admin browser não disponível, portanto `LIVE_MODAL_SMOKE_BLOCKED_BY_TOOLING`. Fallback do leitor retornou `supabase_unavailable`; sem write do leitor.
- **Próxima ação autorizável:** somente aceite arquitetural de G28-B6. `G28-B7` e `G28-B8` não autorizados; sem push.
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
