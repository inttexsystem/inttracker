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
- **Última fase aceita:** `G28-DOCS-B3-C` — `CLOSED / ACCEPTED`
- **Correção vinculada:** `G28-DOCS-B2-R1` — `CLOSED / ACCEPTED`
- **Fase em curso:** nenhuma fase de implementação documental em execução
- **Próxima ação:** `G28-DOCS-B3-D1` — `G28 PROSPECTIVE LEDGER BOOTSTRAP`
  Criar o primeiro ledger por frente para G28, sem reconstrução automática
  do histórico pré-modelo e sem usar os mapas rejeitados de `G28-DOCS-B3-A`
  ou `G28-DOCS-B3-A-R1` como fonte de verdade.
- **Fase técnica suspensa:** `G28-B3-B5-C` — `NOT STARTED / SUSPENDED`

### Débitos relevantes

- Ledger estruturado da frente G28 ainda não criado.
- `G28-B3-B5-C` — `NOT STARTED / SUSPENDED`.
- Migration 49 — versionada, não aplicada.
- Supabase real — não acessado.
- Push — não autorizado nesta cadeia.

### Referência histórica

- Preservação pré-modelo: `docs/legacy/pre-model/MANIFEST.md`

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
