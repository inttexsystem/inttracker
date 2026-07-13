# HANDOFF OPERACIONAL ATIVO

- **Frente ativa:** G28 — Documentation Source-of-Truth Refactor
- **Workspace:** `D:\OneDrive\Programação\Ravatex\controle-tapetes-g28`
- **Branch:** `work/g28-document-qualification`
- **Objetivo imediato:** abrir `G28-DOCS-B3-D1` para criar o ledger
  prospectivo da frente G28, usando commits e gates aceitos como fontes e
  mantendo todo o conteúdo pré-modelo exclusivamente preservado nos
  snapshots imutáveis.
- **Estado de entrada:**
  - `G28-DOCS-B1` — `CLOSED / ACCEPTED`
  - `G28-DOCS-B2` — `CLOSED / ACCEPTED`
  - `G28-DOCS-B2-R1` — `CLOSED / ACCEPTED`
  - `G28-DOCS-B2-CLOSEOUT` — `CLOSED / ACCEPTED`
  - `G28-DOCS-B3-B0` — `CLOSED / ACCEPTED`
  - `G28-DOCS-B3-C` — `CLOSED / ACCEPTED`
  - `G28-B3-B5-B` — `CLOSED / ACCEPTED`
  - `G28-B3-B5-C` — `SUSPENDED`
  - Os diagnósticos `G28-DOCS-B3-A` e `G28-DOCS-B3-A-R1` foram rejeitados e
    substituídos pela estratégia de snapshots integrais.
- **Arquivos obrigatórios:**
  - `docs/governance/DOCUMENTATION_MODEL.md`
  - `docs/DOCUMENTATION_INDEX.md`
  - `PROJECT_STATE.md`
  - `AGENT_HANDOFF.md`
  - `services/documents-ingestor/PROJECT_STATE.md`
- **Restrições:**
  - não editar snapshots;
  - não reconstruir automaticamente o histórico pré-modelo;
  - não usar os mapas `B3-A`/`B3-A-R1` como fonte de verdade;
  - não criar ledgers de outras frentes nesta fase;
  - não retomar `G28-B3-B5-C`;
  - não aplicar migration 49;
  - não acessar Supabase real;
  - não fazer push.
- **Próxima entrega:**
  - patch de `G28-DOCS-B3-D1` com o ledger da frente G28 criado,
    sem backfill especulativo de fases antigas e sem alterar os snapshots.
- **Links canônicos:**
  - estado atual → `PROJECT_STATE.md`
  - modelo documental → `docs/governance/DOCUMENTATION_MODEL.md`
  - autoridade documental → `docs/DOCUMENTATION_INDEX.md`
  - plano G28 → `docs/architecture/DOCUMENTOS_VALIDACAO_VINCULOS_E_EVOLUCAO_PLANO.md`
  - preservação pré-modelo → `docs/legacy/pre-model/MANIFEST.md`

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
