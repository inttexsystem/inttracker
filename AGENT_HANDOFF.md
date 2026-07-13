# HANDOFF OPERACIONAL ATIVO

- **Frente ativa:** G28 — evidence sync concluída; reader pendente
- **Workspace:** `D:\OneDrive\Programação\Ravatex\controle-tapetes-g28`
- **Branch:** `work/g28-document-qualification`
- **Estado aceito:**
  - `G28-DOCS-B3-E1` — `CLOSED / ACCEPTED`;
    commit `793185701a4c09917354330f2596e2991e8b1dfc`.
  - `G28-B3-B5-C` — `CLOSED / ACCEPTED`;
    commit técnico `3465405db42bfedd0c1f2c479f9be61c46078d87`.
  - staging: configuração CLI validada, migration 49 aplicada/verificada,
    smoke controlado aprovado (insert, unchanged, conflict, cleanup zero).
  - 227 testes — 223 focados + 4 CLI — todos aprovados; `git diff --check` limpo.
- **Produção:** intocada.
- **Próxima fase substantiva:** `G28-B3-B6 — TECHNICAL EVIDENCE READER`.
- **Restrições:** não editar snapshots; não aplicar migrations pendentes em
  lote; não acessar produção/origin; não fazer push.
- **Links canônicos:** estado → `PROJECT_STATE.md`; ledger →
  `docs/ledgers/G28_LEDGER.md`; contexto do componente →
  `services/documents-ingestor/PROJECT_STATE.md`.

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
