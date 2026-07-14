# HANDOFF OPERACIONAL ATIVO

- **Frente ativa:** `G28-B5-D5 — CLOSED / ACCEPTED`.
- **Workspace:** `D:\OneDrive\Programação\Ravatex\controle-tapetes-g28`
- **Branch:** `work/g28-document-qualification`
- **Git baseline desta reconciliação:** `7d3e0261b668a46a80208198352039dc1f352010` (G28-PLAN-R1, 2026-07-14)
- **Último bloco técnico aceito:** `G28-B5-D5 — CLOSED / ACCEPTED`
- **Estado:** `G28-B5-D5 — CLOSED / ACCEPTED`. D5 regression GREEN. Semantic checks (3) exit 0. Focused tests: 584 pass / 0 fail across 13 files.
- **Próxima ação autorizável:** **nenhuma.** Qualquer implementação futura (B6, B7, B8 ou outra) exige autorização arquitetural explícita e separada.
- **Nunca inferir próxima fase pela numeração do plano.** O plano mestre foi reconciliado (G28-PLAN-R1 2026-07-14). Reconciliar o plano mestre antes de emitir qualquer ordem futura.
- **Leitura obrigatória antes de rotear qualquer ordem:**
  1. `PROJECT_STATE.md`
  2. `AGENT_HANDOFF.md` (este arquivo)
  3. `docs/architecture/DOCUMENTOS_VALIDACAO_VINCULOS_E_EVOLUCAO_PLANO.md` (plano mestre reconciliado)
  4. `docs/ledgers/G28_LEDGER.md`
  5. Contratos de domínio e runtime aplicáveis (em `docs/architecture/` e `services/documents-ingestor/contracts/`)
- **Decisões de arquiteto em aberto:** cardinalidade Documento↔Pedido; cardinalidade Documento↔OP incluindo multiplicidade/representação; vínculos obrigatórios/opcionais por tipo de documento; compatibilidade de vínculos. Os quatro itens foram diagnosticados como abertos em G28-B1 (linhas 560-568) — diagnóstico de limites arquiteturais concluído, mas não decisão de cardinalidade aceita. Nenhuma decisão de cardinalidade aceita existe.
- **Fases planejadas, não iniciadas:** G28-B6, G28-B7, G28-B8. B6 diagnóstico de limites arquiteturais concluído (G28-B1 linhas 560-568), não decidido, não implementado, não aceito; sem contrato, schema, RPC, read-model ou UI. G28-B6-B: PLANNED / NOT STARTED; no accepted definition, contract, or implementation evidence.
- **Runtime boundaries:** Canonical register/undo adapters and RPCs preserved; SQL `decidir_documento` preserved (not removed, not migrated); no `statusOverrides` or parallel state; no `decideDocumentInCloud`; explicit manual/legacy local domain temporarily supported; Supabase/unknown fail-closed.
- **Nenhum acesso remoto:** sem external, database, staging, produção, Supabase, SQL, migration ou push.
- **Risco residual:** External consumers of `window.RAVATEX_DOCUMENTS.decideDocumentInCloud` outside this repository may exist.

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
