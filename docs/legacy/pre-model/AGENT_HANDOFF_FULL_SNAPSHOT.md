# HANDOFF OPERACIONAL ATIVO

- **Frente ativa:** G28 — Documentation Source-of-Truth Refactor
- **Workspace:** `D:\OneDrive\Programação\Ravatex\controle-tapetes-g28`
- **Branch:** `work/g28-document-qualification`
- **Objetivo imediato:** executar `G28-DOCS-B3-A`, diagnóstico read-only
  de partição do histórico, sem criar ledgers, mover conteúdo ou
  alterar documentos.
- **Estado de entrada:**
  - `G28-DOCS-A` — `CLOSED / ACCEPTED`
  - `G28-DOCS-B1` — `CLOSED / ACCEPTED`
  - `G28-DOCS-B2` — `CLOSED / ACCEPTED`
  - `G28-DOCS-B2-R1` — `CLOSED / ACCEPTED`
  - `G28-B3-B5-C` — `SUSPENDED`
- **Arquivos obrigatórios:**
  - `docs/governance/DOCUMENTATION_MODEL.md`
  - `docs/DOCUMENTATION_INDEX.md`
  - `PROJECT_STATE.md`
  - `AGENT_HANDOFF.md`
  - `services/documents-ingestor/PROJECT_STATE.md`
- **Restrições:**
  - não iniciar a extração histórica;
  - não criar ledger;
  - não remover conteúdo congelado;
  - não retomar `G28-B3-B5-C`;
  - não aplicar migration 49;
  - não acessar Supabase real;
  - não fazer push.
- **Próxima entrega:** relatório de `G28-DOCS-B3-A` ao arquiteto com
  mapa exato de:
  - entradas estruturadas de ledger;
  - conteúdo verbatim destinado a arquivo legado;
  - decisões permanentes que pertencem a planos ou contratos;
  - duplicações entre os três históricos congelados.
- **Links canônicos:**
  - estado atual → `PROJECT_STATE.md`
  - modelo documental → `docs/governance/DOCUMENTATION_MODEL.md`
  - autoridade documental → `docs/DOCUMENTATION_INDEX.md`
  - plano G28 → `docs/architecture/DOCUMENTOS_VALIDACAO_VINCULOS_E_EVOLUCAO_PLANO.md`

# HISTÓRICO DE HANDOFFS — CONGELADO

O conteúdo abaixo é histórico pré-modelo.
Não representa o handoff operacional ativo.
Não deve receber novos closeouts.
Será migrado ou arquivado em slice posterior.

---

# G28-B3-B5-A-C — TECHNICAL EVIDENCE SYNC DIAGNOSTIC DOCUMENTARY CLOSEOUT

- Status: **`G28-B3-B5-A — CLOSED / ACCEPTED`**. O diagnóstico foi exclusivamente read-only: sem implementação, alteração de arquivos, commit, push, acesso ao Supabase real ou migration apply.
- Workspace: `D:\OneDrive\Programação\Ravatex\controle-tapetes-g28`. Branch: `work/g28-document-qualification`. HEAD canônico atual: `410951f7817809c57de7fb8f7071750789c92dd8` (`Reconcile G28 master plan status`), último closeout documental anterior; o diagnóstico read-only não produziu novo commit.
- Gate: **`READY FOR SLICED IMPLEMENTATION`**. Isto não conclui G28-B3-B5, não integra o writer, não altera CLI, não implementa retry e não autoriza apply da migration.
- Diagnóstico aceito: a fonte é `export-technical-evidence JSONL`; `runSyncSupabase()` continua consumidor de artefatos JSONL e não abre SQLite. Ordem futura: `recover stale run → start scan run → document candidates → technical evidence → document events → finish scan run`; o conteúdo é `candidate → technical evidence → events` pela FK para `document_candidates.document_id`.
- Não há transação global entre candidate, evidence, events e scan run; a RPC de evidência é idempotente somente por `(document_id, evidence_version)`. A futura integração reutiliza a mesma instância autenticada service-role por adapter compatível com `TechnicalEvidenceRpcClient`, sem segunda configuração, credencial ou fallback. Dry-run não cria client, RPC ou scan run e não exige migration aplicada. Legado sem evidência não gera linha sintética, `unavailable`, evidência negativa ou decisão.
- Estado atual: **G28-B3-B5 `IN PROGRESS`**. **G28-B3-B5-B — Technical Evidence Sync Input Contract and Dry-Run `NOT STARTED`, aguardando nova autorização do arquiteto.** Slices futuros somente registrados: B5-C adapter/ordem, B5-D erros/retomada, B5-E CLI/relatório.
- Migration 49: `VERSIONED / NOT APPLIED`. Supabase real: `NOT ACCESSED`. Push: `NOT EXECUTED`. Preservar `clientes.cnpj`/`fornecedores.cnpj`; não introduzir `parceiros`, dupla escrita, fallback ou fonte paralela. Fila humana, UI, `document_decisions`, ignore/reject/revoke, vínculos confirmados, autoaceite e score como decisão continuam fora de B3-B5.

---

# HISTÓRICO / SUPERADO PELO CLOSEOUT B3-B5-A-C — G28-B3-B4-C — TECHNICAL EVIDENCE WRITER — B3-B4 DOCUMENT CLOSEOUT

- Status: **`G28-B3-B4 — CLOSED / ACCEPTED`**. Fase exclusivamente documental; nenhum código, teste, schema ou migration alterado nesta fase de closeout.
- Workspace: `D:\OneDrive\Programação\Ravatex\controle-tapetes-g28`. Branch: `work/g28-document-qualification`. HEAD técnico final: `96f2d4de5034891e2d2f520459bb2317d437b4f1`.

## Cadeia G28-B3 — fases e evidência

### G28-B3-B1 — contrato de exportação — CLOSED / ACCEPTED

- Commit: `b794bb7` — `Define technical evidence export contract`.
- Arquivos: `src/core/technicalEvidenceExport.ts`, `src/types/technicalEvidenceExport.ts`, `tests/technical-evidence-export.test.ts`.

### G28-B3-B2 — exportação JSONL — CLOSED / ACCEPTED

- Commit: `812433d` — `Export current technical evidence as JSONL`.
- Arquivos: `src/cli.ts`, `src/core/exportTechnicalEvidence.ts`, `tests/export-technical-evidence.test.ts`.

### G28-B3-B3 — schema remoto e RPC — CLOSED / ACCEPTED

- Commit: `7abafbb` — `Add Supabase technical evidence storage`.
- Migration `db/49_document_technical_evidences.sql`: tabela filha `document_technical_evidences`; PK composta `document_id + evidence_version`; FK `document_id → document_candidates(document_id)` com `ON DELETE CASCADE`; RLS admin-only (`SELECT` autenticado condicionado por `is_admin()`); RPC `upsert_document_technical_evidence_ingestor_state` restrita a `service_role`, idempotente por chave, conflito de conteúdo divergente rejeitado por exceção, versão fora de ordem permitida.
- Migration **versionada, não aplicada**. Nenhum acesso real ao Supabase.
- Testes: 92/92.

### G28-B3-B4 — writer service-role — CLOSED / ACCEPTED

- Commit técnico: `abe49f1` — `Add Supabase technical evidence writer`; hardening: `96f2d4d` — `Harden technical evidence writer errors` (G28-B3-B4-R1).
- Writer estreito (`src/supabase/technicalEvidenceWriter.ts`) sobre a RPC `upsert_document_technical_evidence_ingestor_state`; client RPC injetado (`TechnicalEvidenceRpcClient`, porta estrutural mínima); nenhuma criação de client, ambiente ou credencial; uma chamada RPC por invocação; nenhum retry, backoff ou log; nenhuma integração com sync.
- Mapeamento exato dos cinco parâmetros da RPC (`p_document_id`, `p_evidence_version`, `p_technical_evidence`, `p_origin`, `p_created_at`); `schemaVersion` pertence ao transporte local e nunca é enviado.
- Resultados válidos: `inserted`, `unchanged`. Resposta remota validada estritamente (uma linha; `document_id`/`evidence_version` coerentes; `outcome` conhecido); qualquer desvio é `invalid_response`.
- Erros tipados (`TechnicalEvidenceWriterError`): `conflict`, `writer_required`, `migration_required`, `invalid_response`, `remote_error`.
- **Hardening R1:** o nome isolado da RPC não implica `migration_required`; `does not exist` não relacionado à RPC não implica `migration_required`; `permission denied` na RPC vira `remote_error`; `migration_required` exige sinal concreto (`PGRST202`, ou `42883`/mensagem de ausência referenciando a RPC esperada); rejeições de `client.rpc()` são convertidas em erro tipado, sem retry, reutilizando a mesma classificação quando o sinal for concreto; `cause` sempre preservada; mensagens nunca incluem payload técnico, CNPJ, evidência ou timestamp de documento.
- Testes finais: 91/91, duas execuções (primeira e após autorrevisão). Typecheck global: **vermelho por falhas preexistentes** em `src/connectors/drive.ts`, `src/core/realScan.ts` e `src/core/syncMapped.ts` (nenhum desses arquivos foi tocado por B3-B4/R1); nenhuma falha reportada em `technicalEvidenceWriter.ts`. Typecheck global **não** é registrado como aprovado.
- Push: não realizado em nenhum dos dois commits técnicos.

## Estado final do B3-B4

`G28-B3-B4 — CLOSED / ACCEPTED`

- G28-B3-B1: `CLOSED / ACCEPTED`.
- G28-B3-B2: `CLOSED / ACCEPTED`.
- G28-B3-B3: `CLOSED / ACCEPTED`.
- G28-B3-B4: `CLOSED / ACCEPTED` (inclui hardening R1).
- **G28-B3-B5: NOT STARTED (estado histórico, superado pelo closeout B3-B5-A-C).**
- Migration 49: `VERSIONED / NOT APPLIED`.
- Supabase real: `NOT ACCESSED`.
- Push: `NOT EXECUTED`.
- Fronteiras arquiteturais preservadas: evidência técnica separada de decisão humana; nenhum autoaceite; nenhum score como decisão; `document_decisions` fora de escopo de B3; eventos não são storage de evidência; histórico local permanece canônico; remoto recebe versões idempotentes; legado permanece sem evidência sintética; `clientes.cnpj`/`fornecedores.cnpj` preservados; nenhuma entidade `parceiros`/`parceiro_id`/`parceiro_cnpjs`; nenhuma dupla escrita ou fallback silencioso.

## Próxima fase

`G28-B3-B5-A — TECHNICAL EVIDENCE SYNC INTEGRATION DIAGNOSTIC` — **READ-ONLY** (próxima fase histórica, superada pelo closeout B3-B5-A-C).
Diagnóstico de integração do writer e do export JSONL ao fluxo de sincronização;
não implementar o sync nesta próxima fase. Nenhuma arquitetura humana de B4/B5
(decisão, vínculos Pedido/OP, modal) é antecipada.

## Débito administrativo não bloqueante (worktrees)

O Git continua emitindo permission denied ao tentar remover metadata dos
worktrees baseline-worktree e controle-tapetes-g27-build-baseline.

Nenhuma limpeza, prune ou manipulação de .git/worktrees foi executada.

---

# G28-B2-B5 — TECHNICAL EVIDENCE PERSISTENCE — B2 DOCUMENT CLOSEOUT

- Status: **`G28-B2 — CLOSED / ACCEPTED`**. Fase exclusivamente documental; nenhum código, teste, schema, migration ou persistência alterado.
- Workspace: `D:\OneDrive\Programação\Ravatex\controle-tapetes-g28`. Branch: `work/g28-document-qualification`. HEAD técnico de entrada: `cb496ade5aa69d66b435409ba55745373a01ae30`.

## Cadeia G28-B2 — fases e evidência

### G28-B2-B1 — schema local — CLOSED / ACCEPTED

- Commit: `db02d6d` — `Add technical evidence history schema`.
- Tabela: `document_technical_evidences`; PK composta: `document_id + evidence_version`; FK: `document_id → documentos(id)`.
- Banco novo, banco legado, idempotência e constraints validados.
- Testes: 42/42.

### G28-B2-B2 — evidence store — CLOSED / ACCEPTED

- Commit técnico: `82baee3` — `Add local technical evidence store`; closeout documental: `ed2ef9c` — `Close G28 B2 evidence store phase`.
- Conexão SQLite injetada; versão gerada internamente pelo store; transação `immediate()` quando invocado fora de transação; participação em transação externa; sincronização entre a coluna `evidence_version` e `origin.evidenceVersion`; rejeição de JSON inválido; legado sem evidência retorna `null` e histórico vazio.
- Testes: 48/48.

### G28-B2-B3-A — observações do classifier — CLOSED / ACCEPTED

- Commit: `f46fb21` — `Expose classifier technical observations`.
- Observações XML, PDF, MIME/extensão e CNPJ por lado; nenhuma duplicação de parsing; compatibilidade dos campos anteriores preservada; nenhuma persistência ou autoaceite.
- Testes: 208/208.

### G28-B2-B3-B — builder puro — CLOSED / ACCEPTED

- Commit: `b521509` — `Build technical evidence snapshots`.
- Builder puro; direção e contraparte estruturais; registry separado de matching; duplicidade relacional; origem sem versão; nenhum IO, SQLite, parsing ou decisão humana.
- Testes: 225/225.

### G28-B2-B4 — integração atômica — CLOSED / ACCEPTED

- Commit: `cb496ad` — `Persist scan technical evidence atomically`. Auditoria: G28-B2-B4-R1.
- `documentos`, `ingestion_events` e `document_technical_evidences` atômicos no caminho normal; caminho cross-message preserva a ausência histórica de `document.detected`, com documento e evidência atômicos; IO externo fora da transação; builder e store consumidos sem alteração contratual; rollback integral comprovado; dedupe, contadores e retornos legados preservados; nenhum payload de evidência em `ingestion_events`; nenhum autoaceite ou decisão humana.
- Testes finais: 299/299.

## Anomalia de processo (B2-B4)

O commit cb496ad já estava presente quando a execução formal de B2-B4
foi iniciada, embora ainda não estivesse registrado no acompanhamento.

Havia também um resíduo unstaged em classifier.ts que invertia a ordem
dos ramos unavailable/insufficient_evidence.

O resíduo foi documentado e restaurado exclusivamente para o estado do
HEAD. O commit cb496ad foi então auditado integralmente no working tree
limpo e aprovado com 299/299 testes focados.

Nenhum reset, revert, amend ou novo commit técnico foi realizado.

A anomalia é de processo e não constitui alteração técnica do contrato.

## Estado final do B2

`G28-B2 — CLOSED / ACCEPTED`

- Evidência técnica persistida localmente.
- Histórico versionado.
- Leitura da versão corrente e do histórico.
- Classifier expondo observações canônicas.
- Builder puro.
- Integração atômica no scan.
- Documentos legados permanecem sem evidência sintética.
- Decisão humana continua fora do SQLite.
- Supabase, exportação e reader ainda não iniciados.

## Próxima fase

`G28-B3 — eventos, exportação, Supabase e reader` — STATUS: NOT STARTED.
Implementação, migration e manifesto do B3 não definidos nesta fase.

## Débito administrativo não bloqueante (worktrees)

O Git continua emitindo permission denied ao tentar remover metadata
dos worktrees baseline-worktree e controle-tapetes-g27-build-baseline.

Nenhuma limpeza, prune ou manipulação de .git/worktrees foi executada.

---

# G28-B2-B2 — LOCAL TECHNICAL EVIDENCE STORE — CLOSEOUT

- Status: `G28-B2-B2 — CLOSED / ACCEPTED`; a aceitação técnica precedeu o fechamento documental. G28-B2-B1 `CLOSED / ACCEPTED`.
- Supervisor: Hermes IAsup. Executor: delegação nativa, implementação seletiva; o runtime não reportou identificador de modelo verificável.
- Workspace: `D:\OneDrive\Programação\Ravatex\controle-tapetes-g28\services\documents-ingestor`.
- Branch / HEAD: `work/g28-document-qualification`; HEAD anterior `db02d6d0ed21e4f933b86a49372576e70719000f` (`db02d6d`); HEAD técnico `82baee39dd139a82d0791512c7176192a933b715`.
- Causa raiz: a tabela `document_technical_evidences` já existia, mas não havia API local de persistência/histórico.
- Arquivos técnicos alterados e commitados seletivamente: `src/core/evidenceStore.ts`, `tests/evidence-store.test.ts`.
- Contrato entregue: versão interna, `db.transaction(append).immediate()` fora de transação, participação em transação externa/rollback, igualdade `evidence_version` ↔ `origin.evidenceVersion`, rejeição de JSON malformado e divergência, e retorno `null`/`[]` para legado.
- Evidência: `npm.cmd test -- tests/evidence-store.test.ts tests/storage-schema.test.ts` → 2 arquivos / 48 testes aprovados; `git diff --cached --check` vazio; revisão independente: `passed=true`, sem achados de segurança ou lógica bloqueantes.
- Commit: `82baee3` — `Add local technical evidence store`. Push: não realizado. Nenhum arquivo fora do commit técnico foi staged.
- Estado Git após commit: index vazio; metadados operacionais `PROJECT_STATE.md` e `AGENT_HANDOFF.md` permanecem modificados fora do commit técnico.
- Risco residual: Git mantém o débito administrativo já conhecido de `permission denied` ao tentar limpar metadados dos worktrees `baseline-worktree` e `controle-tapetes-g27-build-baseline`; nenhuma limpeza foi executada.
- G28-B2-B3-A: ainda não iniciado.
- G28-B2-B3-B: ainda não iniciado.
- G28-B2-B4: ainda não iniciado.
- Próxima fase: G28-B2-B3-A — expor observações técnicas produzidas pelo classifier.

---

# G28-B1-R1 — DOCUMENT CLOSEOUT

PROJETO: Ravatex — Controle de Tapetes (monorepo)
WORKSPACE G28: `D:\OneDrive\Programação\Ravatex\controle-tapetes-g28`
BRANCH: `work/g28-document-qualification`
HEAD INICIAL: `c73c6b074cb618a2bdbe37022c7f26738aceea37`
HEAD TÉCNICO FINAL: `c65fa41eff52d84a6ede2e31cd2f74580c143f20`
COMMIT: `c65fa41` — `Define document review domain contract`
FASE: G28-B1-R1 `CLOSED / ACCEPTED`

## RESULTADO

- **G28-B1-R1:** `CLOSED / ACCEPTED` — contrato puro de domínio para evidência, sugestão, revisão e decisão humana.
- **Push:** não realizado.
- **G28-B2:** não iniciado.

### Evidência técnica

- 3 arquivos alterados, 1130 insertions.
- Test Files: 3 passed, Tests: 187 passed.
- Revisão independente Kimi: `APPROVE`.
- `git diff --cached --check`: OK.
- staging final: vazio; working tree final: limpo.

### Contrato de domínio (B1)

1. Contrato puro para evidência, sugestão, revisão e decisão humana.
2. Direção e contraparte estruturalmente protegidas.
3. Cliente e Fornecedor mantidos independentes.
4. CNPJ preservado por lado com estados `unavailable`, `missing`, `invalid` e `valid`.
5. PDF fiscal provável mantido apenas como sugestão.
6. Duplicidade modelada como relação.
7. Vínculos Pedido/OP separados entre sugeridos e confirmados.
8. Ausência de IO, persistência, Supabase, Gmail, Drive, UI ou autoaceite.
9. Persistência de ignore deferida para G28-B5.
10. Testes 187/187 e revisão Kimi `APPROVE`.
11. Commit técnico `c65fa41`; nenhum push.
12. G28-B2 ainda não iniciado.

### Débito não bloqueante (administrativo)

Git emitiu avisos de `permission denied` ao tentar podar metadata de
`baseline-worktree` e `controle-tapetes-g27-build-baseline`.
Nenhuma limpeza foi autorizada ou executada.
Investigar em fase administrativa própria.

## PROXIMO CHECKPOINT

G28-B2 — fase futura. NÃO iniciar implementação. Persistência de ignore segue
deferida para G28-B5. Nenhum push, migration, Supabase ou UI autorizados.

---

# G28-P0 — CLOSEOUT MECÂNICO

- Status: `CLOSED / ACCEPTED`.
- HEAD de fechamento: `383db586e70852fba3c5ae5d5ac5312ab1b49284`.
- G28-A: `REJECTED AS CONTRACT / RETAINED AS DIAGNOSTIC INPUT`.
- G28-B1: `AUTHORIZED`; sem implementação existente no momento do closeout.
- Próxima fase: contrato puro de domínio; migration, persistência, Supabase e UI continuam proibidos.

---

# G28-P0-R1 — CORRECAO ARQUITETURAL DOS DOCUMENTOS DE GOVERNANCA

PROJETO: Ravatex — Controle de Tapetes (monorepo)
WORKSPACE G28: `D:\OneDrive\Programação\Ravatex\controle-tapetes-g28`
BRANCH: `work/g28-document-qualification`
HEAD INICIAL: `bdb2fa3b05361c761d55506192483fe4d8be5034`
FASE: G28-P0 `ARCHITECTURAL CORRECTION IN PROGRESS` — docs-only, aguardando aceite do IAlead.

## RESULTADO

- **G28-A:** `REJECTED AS CONTRACT / RETAINED AS DIAGNOSTIC INPUT` (schema, `db/49`, `qualified` como estado final e `duplicate` como estado principal nao aprovados; evidencias aproveitaveis).
- **G28-B1:** `PLANNED / NOT AUTHORIZED` — nao iniciado.
- Sequencia B1–B8 corrigida; o modal funcional (B6) **nao antecede** a persistencia da decisao humana e dos vinculos (B5).
- Antes de nova persistencia, G28-B1 deve mapear `document_decisions` e `documentos_operacionais` existentes; **proibido** criar fonte paralela de validacao humana se a decisao canonica existente representar o fluxo.
- Correcoes: plano mestre (status, sequencia, governanca, proxima acao); mapa de ativos (precedencia funcional; migrations como snapshot; skill `KEEP_AS_SKILL` + `PROMOTE_RULES_TO_VERSIONED_DOC`); contrato visual (taxonomia de regras; acessibilidade minima obrigatoria; validacao por harness autorizado nao exclusivo de untracked).
- Nenhum runtime, migration, Supabase ou UI alterado. Sem push. Workspace original intocado.

## PROXIMO CHECKPOINT

Aceite arquitetural de G28-P0-R1 pelo IAlead. So entao reabrir conducao pelo Hermes e emitir G28-B1 (exclusivamente contrato de dominio; sem migration, runtime ou UI). Nao iniciar implementacao.

---

# G28-P0 — REGISTRO DO PLANO DOCUMENTAL, MAPA DE ATIVOS E GOVERNANCA

PROJETO: Ravatex — Controle de Tapetes (monorepo)
WORKSPACE G28: `D:\OneDrive\Programação\Ravatex\controle-tapetes-g28`
WORKSPACE ORIGINAL EM QUARENTENA (somente leitura): `D:\OneDrive\Programação\Ravatex\controle-tapetes`
BRANCH: `work/g28-document-qualification`
HEAD: `247345c8b4d63d9b4c871f55109fe39af244f40f` (closeout G27; G27 CLOSED/ACCEPTED TECHNICALLY, staging CI verde)
FASE: G28-P0 IN_PROGRESS — docs-only. **G28-A em HOLD.**

## ARQUIVOS CANONICOS OBRIGATORIOS (ler antes de qualquer acao)

- `PROJECT_STATE.md` (raiz) e `AGENT_HANDOFF.md` (raiz).
- `services/documents-ingestor/PROJECT_STATE.md`.
- `docs/architecture/DOCUMENTOS_VALIDACAO_VINCULOS_E_EVOLUCAO_PLANO.md` (plano mestre).
- `docs/architecture/PEDIDO_OP_MOVIMENTACAO_DOCUMENTOS_PLANO.md`.
- `docs/architecture/CLAUDE_PROJECT_ASSET_MAP.md` (mapa de ativos + precedencia).
- `docs/architecture/UI_VISUAL_CONTRACT.md` (contrato visual versionado).

## GATE ESTRUTURAL

Preservar: CNPJ direto em `clientes.cnpj`/`fornecedores.cnpj`; Cliente e Fornecedor
independentes (mesmo CNPJ permitido nos dois); **proibido** `parceiros`/`parceiro_id`/
`parceiro_cnpjs`, dupla escrita, fallback silencioso, fonte paralela. Pedido e OP
canonicos; documento vinculado direto as entidades reais; deteccao ≠ decisao humana ≠
vinculo ≠ movimentacao. Sem autoaceite. Validar documento NAO movimenta estoque, NAO
conclui transferencia, NAO aceita OP. Operacao independe do fornecedor.

## GATE VISUAL

Antes de UI/modal/lista/tabela/card/navegacao, consultar `UI_VISUAL_CONTRACT.md`,
`css/tokens.css` (`--rv-*`) e a skill `.claude/design-skill` **quando presente**.
Cantos baixos (card 6px / controle 4px); pilula so em badge; cards flat; regra de
ouro das tabelas; uma acao primaria por tela; destrutivo com icone+texto; sem
solucoes simplificadas que nao cumpram o requisito real.

## LEITURA OBRIGATORIA DE `.claude` EM UI

`.claude` e untracked e **ausente do worktree G28** (existe so no original). Antes
de fase de UI, consultar a skill visual no original OU o `UI_VISUAL_CONTRACT.md`
versionado (que a consolida). Regras permanentes de UI nunca podem viver so em `.claude`.

## PROIBICOES NESTA FASE (G28-P0)

Sem migration, sem Supabase, sem UI funcional, sem tocar `.claude`, `js/**`,
`tests/**`, `db/**`, `supabase/**`, `services/documents-ingestor/src|tests`,
workflows, `package*.json`, `.env` ou fixtures. Sem push. G28-A permanece HOLD:
`db/49`, `qualified`, `duplicate` como estado principal e matriz de qualificacao
**nao aprovados**.

## HARD STOPS

Parar e retornar ao arquiteto se: proposta contrariar fonte canonica; surgir
entidade intermediaria; houver dupla escrita/fallback; misturar validacao com
movimentacao; UI esconder arquitetura incorreta; migration preceder contrato
aprovado; fornecedor virar dependencia; autoaceite introduzido; `.claude`/contrato
visual nao consultados em UI; conflito entre documentos canonicos.

## PROXIMO CHECKPOINT

Aceite do IAlead ao plano mestre, mapa de ativos e contrato visual; decisao
arquitetural sobre G28-A antes de iniciar G28-B1. Nao iniciar implementacao.

---

# G27-D3 — DOCUMENTATION-ONLY PATCH — G27-B-CORE CLOSED/ACCEPTED TECHNICALLY

PROJETO: Ravatex — Controle de Tapetes (monorepo)
WORKSPACE ORIGINAL EM QUARENTENA: `D:\\OneDrive\\Programação\\Ravatex\\controle-tapetes`
WORKSPACE G27: `D:\\OneDrive\\Programação\\Ravatex\\controle-tapetes-g27`
BRANCH G27: `work/g27-document-recognition-safety`
HEAD INICIAL CANONICO: `26111e04ab185dc1f484567cc48f3516cd6012a1`
FASE: G27-D3 — ARQUITETURA G27-B2-R1 E G27-B-CORE-GATE-R1 ACEITAS; G27-B-CORE CLOSED/ACCEPTED TECHNICALLY

## RESULTADO E EVIDENCIA

- Arquitetura G27-B2-R1 (XML integral sem persistencia, PDF prefixado, processEntities false, validacao CNPJ) e G27-B-CORE-GATE-R1 (gate de evidencia tecnica) aceitas pelo arquiteto. G27-B-CORE CLOSED/ACCEPTED TECHNICALLY.
- HEAD tecnico `21f6a7dfb879e78fb1d142828818e40fce9824fc` publicado diretamente em `staging/work/app-next` a partir da worktree isolada `work/g27-document-recognition-safety`.
- Primeiro CI workflow Documents Ingestor Tests: run `29172909813`, evento `push`, branch `work/app-next`, SHA `21f6a7dfb879e78fb1d142828818e40fce9824fc`, conclusao `success`, 40 files / 812 tests. URL: https://github.com/ravatexapps-dotcom/controle-tapetes-staging/actions/runs/29172909813
- Build debt preexistente verificado: conjunto identico de 8/8 erros TypeScript em baseline e G27.
- Workspace original permanece em quarentena, inalterado. Nenhum `origin` ou force push. `work/app-next` local nao atualizado; `staging/work/app-next` remoto e a referencia publicada.
- Branch G27 preservada. Diretorio residual `controle-tapetes-g27-build-baseline` permanece debito de cleanup; metadata orfa `baseline-worktree` (`.git/worktrees/baseline-worktree`) e debito separado de cleanup.

## DEBITOS FUTUROS SEPARADOS

- Persisted qualification
- Review UI
- Manifest accumulation
- Historic TypeScript build
- npm vulnerabilities
- Worktree cleanup

---

# G26-C-D — FINAL MONOREPO CLOSEOUT DOCUMENTATION

PROJETO: Ravatex — Controle de Tapetes (monorepo)
WORKSPACE: D:\OneDrive\Programação\Ravatex\controle-tapetes
BRANCH INTEGRADA: work/app-next
HEAD FINAL LOCAL/REMOTO: 8f1df9b6d9e80444b31ed69f3187fa52183023fb
FASE: G26-C CLOSED — STAGING CI VALIDADO

## RESULTADO

- O Documents Ingestor foi incorporado em `services/documents-ingestor`.
- `work/app-next` recebeu a integracao somente por fast-forward e foi publicado exclusivamente em `staging/work/app-next`.
- O remoto staging e a branch local terminaram no mesmo HEAD (`8f1df9b`), com divergencia `0 0`.
- Nenhum push usou `origin`; nenhum force push foi usado.
- O repositorio antigo `D:\OneDrive\Programação\Ravatex\documents-ingestor` permanece preservado para consulta e transicao, sem novos commits.

## VALIDACAO

- Suite limpa local: 39 arquivos, 673/673 testes.
- Primeiro Actions run: `29157931768`, falhou. Causas comprovadas: `tsx.cmd` hardcoded nos testes CLI e uso de `os.devNull` como manifest, que no Linux le `/dev/null` vazio.
- Correcao: `8f1df9b Fix ingestor CI cross-platform tests`; seleciona `tsx` por plataforma e envia o documento no payload do manifest sem dispositivo nulo.
- Actions final: run `29158174870`, evento `push`, SHA `8f1df9b`, conclusao `success`; executou os 39 arquivos / 673 testes.
- O aviso de deprecacao do runtime Node 20 interno de `actions/checkout@v4` e `actions/setup-node@v4` nao bloqueou o CI.

## DEBITOS

- 4 vulnerabilidades moderadas reportadas por `npm audit`.
- Metadata orfa `.git/worktrees/baseline-worktree`.
- Acumulacao do manifest remoto e debito separado: a correcao de CI garante o payload de um documento, nao implementa leitura-modificacao-escrita remota.
- Projecao futura de sha256 e attachment_id.

## PROXIMO PASSO

G26 esta fechado. Tratar os debitos separados por prioridade; nao apagar a branch `work/documents-ingestor-monorepo` nem o repositorio antigo nesta fase.
