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
- **G28-B5-D5 — CLOSED / ACCEPTED**; baseline `7d3e0261b668a46a80208198352039dc1f352010`
- **Última fase aceita:** `G28-B5-D5 — documentary closeout — CLOSED / ACCEPTED`
- **Fase ativa de implementação:** nenhuma
- **Próxima ação autorizável:** nenhuma; qualquer implementação futura exige autorização arquitetural explícita
- **Decisões de arquiteto em aberto:** cardinalidade Documento↔Pedido; cardinalidade Documento↔OP incluindo multiplicidade/representação; vínculos obrigatórios/opcionais por tipo de documento; compatibilidade de vínculos (Documento↔OP comprovadamente aberto; nenhum diagnóstico de cardinalidade aceito existe)
- **Fases planejadas, não iniciadas (deferred):** G28-B6, G28-B7, G28-B8 — B6 diagnóstico de limites arquiteturais concluído (G28-B1 linhas 560-568), não decidido/não implementado/não aceito; sem contrato, schema, RPC, read-model ou UI
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
