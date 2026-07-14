# HANDOFF OPERACIONAL ATIVO

- **Frente:** G28 — D5-A diagnosis and D5-B1 explicit source boundary — `CLOSED / ACCEPTED`
- **Workspace:** `D:\OneDrive\Programação\Ravatex\controle-tapetes-g28`
- **Branch:** `work/g28-document-qualification`
- **HEAD:** `2bac73d0f386ca61a53548d304b98e076fbb06ef` — `G28-B5-D5-B1: enforce explicit document source boundary`
- **D5-A:** concluída e aceita; diagnóstico read-only confirmou que source ausente era tratada implicitamente como legacy.
- **D5-B1:** concluída e aceita; tri-state `supabase | legacy | unknown` implementado. `unknown` é fail-closed: sem ações, controller/modal/adapter, RPC, persistência local ou `statusOverrides`; preserva o status original até normalização da origem.
- **Fluxos preservados:** Supabase mantém o fluxo canônico; `manual`/`legacy` explícito mantém o fluxo local temporário; fallback G22 sem source é `unknown`.
- **Arquivos do commit técnico:** `js/screens/documentos-recebidos.js`, `tests/documentos-recebidos-source-boundary.test.js`, `tests/documentos-recebidos-decision-integration.test.js` e `tests/documentos-recebidos.smoke.js`.
- **Validação:** 13 testes source-boundary aprovados; todos os gates obrigatórios verdes; `git diff --check` aprovado; revisão independente read-only retornou `APPROVE`.
- **Nenhum acesso remoto:** staging não acessado, produção não acessada, push não executado.
- **Próximo passo:** `G28-B5-D5-B2` — não autorizada.

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
