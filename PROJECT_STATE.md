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
- **Última fase aceita:** `G28-B5 — HUMAN DECISION COMMAND CONTRACT` — `CLOSED / ACCEPTED`
- **G28-B5-B1:** `CLOSED / ACCEPTED`; commit técnico `b247e43504c0afcc0d25e95f8012f93a09eb0692` — `Add idempotent document decision command contract`
- **G28-B5-B2:** `CLOSED / ACCEPTED`; migration `20260714012641 document_decision_command` aplicada e verificada no staging `ucrjtfswnfdlxwtmxnoo`
- **Produção:** projeto `bhgifjrfagkzubpyqpew` não acessado
- **Contrato aceito:** coluna nullable `document_decisions.command_id`, índice único parcial `document_decisions_command_id_uidx` e RPC canônica `registrar_decisao_documento(...)`; validações estrutural, de autorização, idempotência, atomicidade e concorrência A/B/C aprovadas
- **Limpeza:** fixtures sintéticas removidas; 39 candidates, 0 decisions e zero resíduos verificados após o gate
- **Runtime:** nenhum consumidor foi redirecionado; UI e modal não integram a RPC canônica; `decidir_documento` permanece ativa e não idempotente
- **Push:** não executado
- **Próxima decisão:** requer decisão arquitetural antes de qualquer nova implementação; B6-A, B6-B e B8 permanecem fases separadas, sem autorização automática de UI, modal, integração runtime, linking ou revogação/correção

### Débitos relevantes

- Migrations 49 e 50 — aplicadas e verificadas em staging; não aplicadas em produção por esta cadeia.
- Integração da RPC canônica à UI/runtime e destino da RPC legada — pendentes de decisão arquitetural.
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
