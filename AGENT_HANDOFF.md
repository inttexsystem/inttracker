# HANDOFF OPERACIONAL ATIVO

- **Frente ativa:** G28 — G28-B5 closed and accepted no banco de staging; integração runtime pendente
- **Workspace:** `D:\OneDrive\Programação\Ravatex\controle-tapetes-g28`
- **Branch:** `work/g28-document-qualification`
- **Fase aceita mais recente:** `G28-B5 — HUMAN DECISION COMMAND CONTRACT` — `CLOSED / ACCEPTED`
- **G28-B5-B1:** `CLOSED / ACCEPTED`; commit técnico `b247e43504c0afcc0d25e95f8012f93a09eb0692` — `Add idempotent document decision command contract`
- **G28-B5-B2:** `CLOSED / ACCEPTED`; migration `20260714012641 document_decision_command` aplicada e verificada no staging `ucrjtfswnfdlxwtmxnoo`
- **HEAD documental final:** o commit que contém este handoff; consultar `git rev-parse HEAD` para o identificador imutável
- **Contrato canônico disponível:** `registrar_decisao_documento(...)`, com autorização, idempotência, atomicidade e concorrência verificadas; fixtures removidas e contagens restauradas
- **Integração:** a RPC canônica ainda não está integrada à UI ou a outro consumidor runtime
- **Legado:** `decidir_documento` permanece ativa e não idempotente
- **Pendências:** modal e integração runtime continuam pendentes; B6-A, B6-B e B8 permanecem fases separadas
- **Produção:** projeto `bhgifjrfagkzubpyqpew` não acessado
- **Push:** não executado
- **Próxima ação:** decisão arquitetural explícita sobre integração runtime, transição da RPC legada e sequenciamento; este handoff não autoriza implementação
- **Hard prohibitions:**
  - `Do not start UI, modal, runtime integration, B6-A, B6-B or B8 without a new explicit order.`
  - `Do not modify code, tests, schema, Supabase, or production from this closeout.`
  - `Do not redirect consumers to the canonical RPC by implication.`
  - `Do not push.`
- **Arquivos autoritativos obrigatórios antes da próxima implementação:**
  - `PROJECT_STATE.md`
  - `AGENT_HANDOFF.md`
  - `docs/DOCUMENTATION_INDEX.md`
  - `docs/governance/DOCUMENTATION_MODEL.md`
  - `docs/ledgers/G28_LEDGER.md`
  - `docs/architecture/DOCUMENTOS_VALIDACAO_VINCULOS_E_EVOLUCAO_PLANO.md`
  - `docs/architecture/DOCUMENTS_INGESTOR_CONSUMER_DESIGN.md`
  - `docs/architecture/CODE_HEALTH_RULES.md`
- **Links canônicos:** estado → `PROJECT_STATE.md`; ledger → `docs/ledgers/G28_LEDGER.md`

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
