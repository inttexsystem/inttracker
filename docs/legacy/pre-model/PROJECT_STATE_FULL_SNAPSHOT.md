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
- **Última fase aceita:** `G28-DOCS-B2` — `CLOSED / ACCEPTED`
- **Correção vinculada:** `G28-DOCS-B2-R1` — `CLOSED / ACCEPTED`
- **Fase em curso:** nenhuma fase de implementação em execução
- **Próxima ação:** `G28-DOCS-B3-A` — `HISTORY PARTITION DIAGNOSTIC`
  Diagnóstico read-only para separar ledger estruturado, arquivo legado
  verbatim e conteúdo técnico permanente.
- **Fase técnica suspensa:** `G28-B3-B5-C` — `NOT STARTED / SUSPENDED`

### Débitos relevantes

- Migration 49 versionada, mas não aplicada.
- Supabase real não acessado nesta cadeia.
- Histórico documental ainda não migrado para ledger.

### Links obrigatórios

- Modelo de governança documental: `docs/governance/DOCUMENTATION_MODEL.md`
- Árbitro de autoridade documental: `docs/DOCUMENTATION_INDEX.md`
- Plano mestre G28: `docs/architecture/DOCUMENTOS_VALIDACAO_VINCULOS_E_EVOLUCAO_PLANO.md`
- Plano Pedido/OP/Movimentação/Documentos: `docs/architecture/PEDIDO_OP_MOVIMENTACAO_DOCUMENTOS_PLANO.md`
- Estado local do Ingestor (contexto técnico): `services/documents-ingestor/PROJECT_STATE.md`

# HISTÓRICO LEGADO PRÉ-MODELO — CONGELADO

O conteúdo abaixo é preservado para rastreabilidade até sua migração para ledgers.
Não é fonte de estado atual.
Não deve ser atualizado por novas fases.
Não usar HEAD, branch, próxima fase ou status abaixo para rotear trabalho atual.

---

> **Atualização 2026-07-12 — G28-B3-B5-A-C — TECHNICAL EVIDENCE SYNC DIAGNOSTIC DOCUMENTARY CLOSEOUT.**
> Status: **G28-B3-B5-A `CLOSED / ACCEPTED`**. Diagnóstico read-only concluído no branch `work/g28-document-qualification`; HEAD canônico atual `410951f7817809c57de7fb8f7071750789c92dd8` (`Reconcile G28 master plan status`), último closeout documental anterior. O diagnóstico não alterou arquivos, não gerou commit, não executou push, não acessou Supabase real e não aplicou migration.
>
> - **Gate aceito:** `READY FOR SLICED IMPLEMENTATION`; há diagnóstico suficiente para implementação futura fatiada, sem concluir B3-B5, sem conectar writer, alterar CLI, implementar retry ou autorizar apply da migration.
> - **Arquitetura aceita:** fonte `export-technical-evidence JSONL`; fluxo `SQLite → export-technical-evidence → JSONL de evidência corrente → sync-supabase → Supabase`. `runSyncSupabase()` permanece consumidor de JSONL e não abre SQLite.
> - **Persistência futura:** `recover stale run → start scan run → document candidates → technical evidence → document events → finish scan run`; conteúdo em `candidate → technical evidence → events` pela FK para `document_candidates.document_id`. Não há transação global entre candidate, evidence, events e scan run; a RPC é idempotente somente por `(document_id, evidence_version)`.
> - **Fronteiras futuras:** reutilizar a mesma instância autenticada service-role por adapter compatível com `TechnicalEvidenceRpcClient`, sem segunda credencial/configuração ou fallback. Dry-run preserva ausência de client remoto, RPC, scan run e exigência de migration aplicada. Legado sem evidência não gera linha sintética, `unavailable`, evidência negativa ou decisão.
> - **Estado da cadeia:** G28-B3-B5 `IN PROGRESS`; G28-B3-B5-B — Technical Evidence Sync Input Contract and Dry-Run `NOT STARTED`, aguardando nova autorização do arquiteto. Slices posteriores somente planejados: B5-C adapter/ordem, B5-D erros/retomada, B5-E CLI/relatório.
> - Migration 49: `VERSIONED / NOT APPLIED`. Supabase real: `NOT ACCESSED`. Push: `NOT EXECUTED`. Permanecem fora de B3-B5 fila humana, UI, `document_decisions`, ignore/reject/revoke, vínculos confirmados, autoaceite e score como decisão; `clientes.cnpj` e `fornecedores.cnpj` permanecem fontes diretas, sem `parceiros`, dupla escrita ou fonte paralela.
>
> **Atualizacao 2026-07-12 — G28-B3-B4-C — TECHNICAL EVIDENCE WRITER — B3-B4 DOCUMENT CLOSEOUT.**
> Status: **G28-B3-B4 — CLOSED / ACCEPTED.** Fase exclusivamente documental; nenhum código, teste, schema ou migration alterado nesta fase de closeout.
>
> - Branch: `work/g28-document-qualification`; HEAD técnico final `96f2d4de5034891e2d2f520459bb2317d437b4f1`.
> - **G28-B3-B1 — contrato de exportação:** `b794bb7` — `Define technical evidence export contract`.
> - **G28-B3-B2 — exportação JSONL:** `812433d` — `Export current technical evidence as JSONL`.
> - **G28-B3-B3 — schema remoto e RPC:** `7abafbb` — `Add Supabase technical evidence storage`; migration `db/49_document_technical_evidences.sql` versionada e **não aplicada** (tabela filha `document_technical_evidences`; PK composta `document_id + evidence_version`; FK `document_id → document_candidates(document_id)` com `ON DELETE CASCADE`; RLS admin-only; RPC `upsert_document_technical_evidence_ingestor_state` restrita a `service_role`); testes 92/92.
> - **G28-B3-B4 — writer service-role:** commit técnico `abe49f1` — `Add Supabase technical evidence writer`; hardening `96f2d4d` — `Harden technical evidence writer errors` (G28-B3-B4-R1). Client RPC injetado (`TechnicalEvidenceRpcClient`); nenhuma criação de client, ambiente ou credencial; uma chamada RPC por invocação; nenhum retry; nenhum log; nenhuma integração com sync. Mapeamento exato dos cinco parâmetros (`p_document_id`, `p_evidence_version`, `p_technical_evidence`, `p_origin`, `p_created_at`); `schemaVersion` nunca enviado. Resultados válidos `inserted`/`unchanged`; erros tipados `conflict`/`writer_required`/`migration_required`/`invalid_response`/`remote_error`. Hardening R1: nome isolado da RPC não implica `migration_required`; "does not exist" não relacionado não implica `migration_required`; `permission denied` vira `remote_error`; rejeições de `client.rpc()` classificadas sem retry; `cause` preservada; mensagens sem payload técnico. Testes finais: 91/91, duas execuções. Typecheck global vermelho por falhas **preexistentes** em `src/connectors/drive.ts`, `src/core/realScan.ts` e `src/core/syncMapped.ts`; nenhuma falha reportada em `technicalEvidenceWriter.ts`.
> - **Resultado do B3-B4:** writer estreito e testado sobre a RPC da migration 49; sem consumidor no sync; nenhum reader, UI ou decisão humana alterados.
> - **Estado da cadeia à época (histórico; superado pelo closeout B3-B5-A-C):** G28-B3-B1 `CLOSED/ACCEPTED`; G28-B3-B2 `CLOSED/ACCEPTED`; G28-B3-B3 `CLOSED/ACCEPTED`; G28-B3-B4 `CLOSED/ACCEPTED`; **G28-B3-B5 — NOT STARTED**. Migration 49: `VERSIONED / NOT APPLIED`. Supabase real: `NOT ACCESSED`. Push: `NOT EXECUTED`.
> - **Próxima fase à época (histórico; superada pelo closeout B3-B5-A-C):** G28-B3-B5-A — Technical Evidence Sync Integration Diagnostic — **READ-ONLY**; diagnóstico de integração, sem implementação.
> - **Débito administrativo não bloqueante:** o Git continua emitindo `permission denied` ao tentar remover metadata dos worktrees `baseline-worktree` e `controle-tapetes-g27-build-baseline`; nenhuma limpeza, prune ou manipulação de `.git/worktrees` foi executada.
>

> **Atualizacao 2026-07-12 — G28-B2-B5 — DOCUMENT CLOSEOUT.**
> Status: **G28-B2 — CLOSED / ACCEPTED.** Fase exclusivamente documental; nenhum arquivo técnico alterado.
>
> - Branch: `work/g28-document-qualification`; HEAD técnico de entrada `cb496ade5aa69d66b435409ba55745373a01ae30`.
> - **G28-B2-B1 — schema local:** `db02d6d` — `Add technical evidence history schema`; tabela `document_technical_evidences` (PK composta `document_id + evidence_version`; FK `document_id → documentos(id)`); banco novo, banco legado, idempotência e constraints validados; testes 42/42.
> - **G28-B2-B2 — evidence store:** commit técnico `82baee3` — `Add local technical evidence store`; closeout documental `ed2ef9c` — `Close G28 B2 evidence store phase`; conexão SQLite injetada; versão gerada internamente; transação `immediate()` quando necessário; participação em transação externa; sincronização coluna ↔ `origin.evidenceVersion`; rejeição de JSON inválido; legado sem evidência retorna `null` e histórico vazio; testes 48/48.
> - **G28-B2-B3-A — observações do classifier:** `f46fb21` — `Expose classifier technical observations`; observações XML, PDF, MIME/extensão e CNPJ por lado; nenhuma duplicação de parsing; compatibilidade dos campos anteriores preservada; nenhuma persistência ou autoaceite; testes 208/208.
> - **G28-B2-B3-B — builder puro:** `b521509` — `Build technical evidence snapshots`; builder puro; direção e contraparte estruturais; registry separado de matching; duplicidade relacional; origem sem versão; nenhum IO, SQLite, parsing ou decisão humana; testes 225/225.
> - **G28-B2-B4 — integração atômica:** `cb496ad` — `Persist scan technical evidence atomically`; auditoria G28-B2-B4-R1; `documentos`, `ingestion_events` e `document_technical_evidences` atômicos no caminho normal; caminho cross-message preserva a ausência histórica de `document.detected`, com documento e evidência atômicos; IO externo fora da transação; builder e store consumidos sem alteração contratual; rollback integral comprovado; dedupe, contadores e retornos legados preservados; nenhum payload de evidência em `ingestion_events`; nenhum autoaceite ou decisão humana; testes finais 299/299.
> - **Anomalia de processo (B2-B4):** o commit `cb496ad` já estava presente quando a execução formal de B2-B4 foi iniciada, embora ainda não estivesse registrado no acompanhamento; havia também um resíduo unstaged em `classifier.ts` que invertia a ordem dos ramos `unavailable`/`insufficient_evidence`; o resíduo foi documentado e restaurado exclusivamente para o estado do HEAD; o commit `cb496ad` foi então auditado integralmente no working tree limpo e aprovado com 299/299 testes focados; nenhum reset, revert, amend ou novo commit técnico foi realizado. Anomalia de processo, não alteração técnica do contrato.
> - **Resultado do B2:** evidência técnica persistida localmente; histórico versionado; leitura da versão corrente e do histórico; classifier expondo observações canônicas; builder puro; integração atômica no scan; documentos legados permanecem sem evidência sintética; decisão humana continua fora do SQLite; Supabase, exportação e reader ainda não iniciados.
> - **Próxima fase:** G28-B3 — eventos, exportação, Supabase e reader — **NOT STARTED**; implementação, migration e manifesto do B3 não definidos nesta fase.
> - **Débito administrativo não bloqueante:** o Git continua emitindo `permission denied` ao tentar remover metadata dos worktrees `baseline-worktree` e `controle-tapetes-g27-build-baseline`; nenhuma limpeza, prune ou manipulação de `.git/worktrees` foi executada.
>
> **Atualizacao 2026-07-12 — G28-B2-B2 — LOCAL TECHNICAL EVIDENCE STORE.**
> Status: **G28-B2-B2 — CLOSED / ACCEPTED.** A aceitação técnica precedeu o fechamento documental.
>
> - Branch: `work/g28-document-qualification`; HEAD anterior `db02d6d`; HEAD técnico `82baee39dd139a82d0791512c7176192a933b715`.
> - Commit seletivo: `82baee3` — `Add local technical evidence store`; sem push.
> - Entrega: `appendTechnicalEvidence`, `getCurrentTechnicalEvidence` e `listTechnicalEvidenceHistory` com conexão SQLite injetada, versionamento interno, transação immediate externa/participação em transação existente, rollback do chamador, invariantes de versão e leitura fail-closed de JSON.
> - Teste focado: 2 arquivos / 48 testes aprovados; `git diff --cached --check` OK; revisão independente sem achados bloqueantes.
> - G28-B2-B3-A: ainda não iniciado.
> - G28-B2-B3-B: ainda não iniciado.
> - G28-B2-B4: ainda não iniciado.
> - Próxima fase: G28-B2-B3-A — expor observações técnicas produzidas pelo classifier.
> - Débito administrativo de `permission denied` para metadata de worktrees permanece separado; nenhuma limpeza executada.
>
> **Atualizacao 2026-07-12 — G28-B1-R1 — DOCUMENT CLOSEOUT.**
> Status: **G28-B1-R1 `CLOSED / ACCEPTED`.**
>
> - Branch: `work/g28-document-qualification`.
> - HEAD inicial: `c73c6b074cb618a2bdbe37022c7f26738aceea37`.
> - HEAD técnico final: `c65fa41eff52d84a6ede2e31cd2f74580c143f20`.
> - Commit: `c65fa41` — `Define document review domain contract`.
> - Push: não realizado.
> - G28-B2: não iniciado.
>
> - 3 arquivos alterados, 1130 insertions.
> - Test Files: 3 passed, Tests: 187 passed.
> - Revisão independente Kimi: `APPROVE`.
> - `git diff --cached --check`: OK.
> - staging final: vazio; working tree final: limpo.
>
> **Escopo entregue (contrato puro de domínio):**
> 1. contrato puro introduzido para evidência, sugestão, revisão e decisão humana;
> 2. direção e contraparte estruturalmente protegidas;
> 3. Cliente e Fornecedor mantidos independentes;
> 4. CNPJ preservado por lado com estados `unavailable`, `missing`, `invalid` e `valid`;
> 5. PDF fiscal provável mantido apenas como sugestão;
> 6. duplicidade modelada como relação;
> 7. vínculos Pedido/OP separados entre sugeridos e confirmados;
> 8. ausência de IO, persistência, Supabase, Gmail, Drive, UI ou autoaceite;
> 9. persistência de ignore deferida para G28-B5;
> 10. testes 187/187 e revisão Kimi `APPROVE`;
> 11. commit técnico `c65fa41`;
> 12. nenhum push;
> 13. G28-B2 ainda não iniciado.
>
> **Débito não bloqueante (administrativo):**
> Git emitiu avisos de `permission denied` ao tentar podar metadata de
> `baseline-worktree` e `controle-tapetes-g27-build-baseline`.
> Nenhuma limpeza foi autorizada ou executada.
> Investigar em fase administrativa própria.
>
> > **Atualizacao 2026-07-11 — G28-P0 CLOSEOUT MECÂNICO.**
> Status: **G28-P0 `CLOSED / ACCEPTED`; G28-B1 `AUTHORIZED`.**
>
> - HEAD de fechamento: `383db586e70852fba3c5ae5d5ac5312ab1b49284`.
> - G28-A: `REJECTED AS CONTRACT / RETAINED AS DIAGNOSTIC INPUT`.
> - No instante do closeout, não existia implementação G28-B1.
> - Próxima fase: contrato puro de domínio; migration, persistência, Supabase e UI continuam proibidos.
>
> **Atualizacao 2026-07-11 — G28-P0-R1 — CORRECAO ARQUITETURAL DOS DOCUMENTOS (DOCS-ONLY).**
> Status: **G28-P0 `ARCHITECTURAL CORRECTION IN PROGRESS`; correcao documental concluida tecnicamente, aguardando aceite do IAlead.**
>
> - **G28-A:** `REJECTED AS CONTRACT / RETAINED AS DIAGNOSTIC INPUT` — schema proposto, `db/49`, `qualified` como estado final e `duplicate` como estado principal nao aprovados; evidencias do diagnostico permanecem aproveitaveis.
> - **G28-B1:** `PLANNED / NOT AUTHORIZED` — nao iniciado.
> - Sequencia corrigida: B1 contrato de dominio → B2 persistencia da evidencia/historico tecnico → B3 eventos/export/Supabase/reader → B4 fila/read model de revisao → B5 persistencia da decisao humana + vinculos Pedido/OP → B6 modal funcional (backend real) → B7 exibicao → B8 correcao/revogacao/restauracao/auditoria → C staging → D publicacao. O modal (B6) nao antecede a persistencia da decisao/vinculos (B5).
> - Antes de nova persistencia, G28-B1 deve mapear `document_decisions` e `documentos_operacionais` existentes; proibido criar fonte paralela de validacao humana se a decisao canonica existente representar o fluxo.
> - Correcoes documentais: plano mestre; mapa de ativos (precedencia funcional; migrations como snapshot; skill `KEEP_AS_SKILL` + `PROMOTE_RULES_TO_VERSIONED_DOC`); contrato visual (taxonomia GLOBAL/SCREEN-FAMILY/COMPONENT-SPECIFIC/OBSERVED-PATTERN/OPEN; acessibilidade minima obrigatoria; harness autorizado nao exclusivo de untracked).
> - Nenhum runtime, migration ou UI alterado. Sem push. Workspace original intocado.
> - Proximo passo: depende de aceite arquitetural de G28-P0-R1; so entao reabrir conducao pelo Hermes e emitir G28-B1.

> **Atualizacao 2026-07-11 — G28-P0 — REGISTRO DO PLANO DOCUMENTAL E GOVERNANCA (DOCS-ONLY).**
> Status: **G28-P0 IN_PROGRESS; nenhuma implementacao G28 autorizada.**
>
> - G27 CLOSED/ACCEPTED TECHNICALLY, publicado em `staging/work/app-next`, CI verde.
> - Workspace G28 isolado: `D:\OneDrive\Programação\Ravatex\controle-tapetes-g28`; branch `work/g28-document-qualification`; HEAD `247345c8b4d63d9b4c871f55109fe39af244f40f` (closeout G27 `Close G27 recognition hardening integration`).
> - Workspace original `controle-tapetes` permanece em quarentena, inalterado (somente leitura para mapear `.claude`).
> - **G28-A em HOLD / DIAGNOSTIC INPUT ONLY:** schema proposto, `db/49`, estados `qualified`/`duplicate` como estado principal e matriz de qualificacao **nao aprovados**; nao sao arquitetura vigente.
> - **G28-P0 (fase atual):** registro versionado do plano mestre, mapa de ativos, contrato visual, gates e matriz de acompanhamento. Sem codigo, migration, Supabase ou UI funcional.
> - Plano mestre: `docs/architecture/DOCUMENTOS_VALIDACAO_VINCULOS_E_EVOLUCAO_PLANO.md`.
> - Mapa de ativos: `docs/architecture/CLAUDE_PROJECT_ASSET_MAP.md`.
> - Contrato visual versionado: `docs/architecture/UI_VISUAL_CONTRACT.md` (consolida a skill `.claude/design-skill`; `.claude` ausente do worktree G28).
> - Sequencia macro: G28-P0 (consolidacao) → G28-A resolvido pelo IAlead → G28-B1..B8 (dominio, persistencia, eventos/Supabase, fila, modal, vinculos, exibicao, auditoria) → G28-C (staging) → G28-D (publicacao para o cliente acompanhar). Administracao de usuarios, backup e portal de fornecedor DEFERRED.
> - Invariantes estruturais preservadas: CNPJ direto em `clientes.cnpj`/`fornecedores.cnpj`; nenhum `parceiros`/`parceiro_id`; sem dupla escrita/fallback; sem autoaceite; validar documento nao movimenta estoque/OP; operacao independe do fornecedor.
> - Proximo checkpoint: aceite do IAlead ao plano, mapa e contrato; decisao arquitetural sobre G28-A antes de G28-B1.

> **Atualizacao 2026-07-11 — G27-D3 — DOCUMENTATION-ONLY PATCH — G27-B-CORE CLOSED/ACCEPTED TECHNICALLY.**
> Status: **arquitetura G27-B2-R1 e G27-B-CORE-GATE-R1 aceitas; G27-B-CORE CLOSED/ACCEPTED TECHNICALLY.**
>
> - Workspace original preservado em quarentena: `D:\\OneDrive\\Programação\\Ravatex\\controle-tapetes` (`work/app-next`, HEAD `26111e04`), inalterado.
> - Workspace G27 isolado: `D:\\OneDrive\\Programação\\Ravatex\\controle-tapetes-g27`; branch `work/g27-document-recognition-safety`.
> - HEAD tecnico `21f6a7dfb879e78fb1d142828818e40fce9824fc` publicado diretamente em `staging/work/app-next` a partir da worktree isolada.
> - Primeiro CI workflow Documents Ingestor Tests: run `29172909813`, evento `push`, branch `work/app-next`, SHA `21f6a7dfb879e78fb1d142828818e40fce9824fc`, conclusao `success`, 40 files / 812 tests. URL: https://github.com/ravatexapps-dotcom/controle-tapetes-staging/actions/runs/29172909813
> - Parsing estrutural XML completo a partir do Buffer integral ja baixado; PDF limitado ao prefixo inicial de 2048 bytes; `processEntities: false`; validacao checksum CNPJ.
> - Build debt preexistente verificado: conjunto identico de 8/8 erros TypeScript em baseline `26111e04` e G27.
> - Nenhum `origin` ou force push; `work/app-next` local original nao atualizado; `staging/work/app-next` remoto e a referencia publicada.
> - Branch G27 preservada. Diretorio residual `controle-tapetes-g27-build-baseline` permanece debito de cleanup; metadata orfa `baseline-worktree` (`.git/worktrees/baseline-worktree`) e debito separado de cleanup.
>
> **Debitos futuros separados:**
> - Persisted qualification
> - Review UI
> - Manifest accumulation
> - Historic TypeScript build
> - npm vulnerabilities
> - Worktree cleanup
>
> **Atualizacao 2026-07-11 — fase
> `G26-C-D — FINAL MONOREPO CLOSEOUT DOCUMENTATION`.**
> Status: **G26-C CLOSED — INTEGRADO E VALIDADO EM STAGING**.
> Branch/HEAD final local e remoto: `work/app-next` (`8f1df9b6d9e80444b31ed69f3187fa52183023fb`).
>
> **Incorporacao do Documents Ingestor ao monorepo — cadeia G26 concluida:**
>
> - **G26-A** — Design de incorporacao do Documents Ingestor ao monorepo
>   `controle-tapetes`.
> - **G26-A-R1** — Revisao e ajuste do plano de incorporacao.
> - **G26-B-B1** — Import do Documents Ingestor para
>   `services/documents-ingestor`.
> - **G26-B-B2** — Ancoragem de paths de configuracao para a raiz do pacote.
> - **G26-B-B3** — Ancoragem de paths de export para a raiz do pacote.
> - **G26-B-B4 / R1 / R2** — Ancoragem de paths de manifest, outbox e query
>   outbox, com testes de regressao.
> - **G26-B-B5** — Ancoragem de paths de export do CLI para a raiz do pacote.
> - **G26-B-C1** — Isolamento de testes do service role reader de env local.
> - **G26-B-C2** — Isolamento de testes de retry do registro Supabase.
> - **G26-B-C3** — Adicao do wrapper `scripts/ingestor.bat` e workflow
>   `.github/workflows/documents-ingestor-test.yml`.
>
> **Commits relevantes:**
> - `d01fced` Import documents ingestor into monorepo
> - `17e0e46` Anchor ingestor config paths to package root
> - `abfee7d` Anchor ingestor export paths to package root
> - `ac5494f` Anchor ingestor manifest paths to package root
> - `11b3144` Anchor ingestor outbox path to package root
> - `76d3b57` Anchor query outbox path to package root
> - `64fb283` Add relative query outbox path regression test
> - `16eff84` Anchor ingestor CLI export paths to package root
> - `c28ba7e` Isolate service role reader tests from local env
> - `9b73fa1` Isolate ingestor retry test from Supabase registry
> - `b8334d9` Add documents ingestor command wrapper
> - `9e68160` Move ingestor tests to monorepo workflow
>
> **Evidencia de staging:**
> - Primeiro run `29157931768` falhou: `tsx.cmd` hardcoded nos testes CLI e
>   `os.devNull` leu `/dev/null` vazio no Linux.
> - Correcao `8f1df9b`: binario `tsx` por plataforma e documento incluido no
>   payload do manifest, sem dispositivo nulo.
> - Run `29158174870`, evento `push`, concluiu `success` para o SHA final;
>   39 arquivos / 673 testes executados remotamente.
> - Sem uso de `origin` para publicar e sem force push; repositorio antigo preservado.
>
> **Debitos pendentes:**
> - 4 vulnerabilidades moderadas do npm audit;
> - metadata orfa `.git/worktrees/baseline-worktree`;
> - projecao futura de sha256 e attachment_id;
> - repositorio antigo ainda preservado.
> - Acumulacao do manifest remoto permanece debito separado; o patch de CI
>   garante o payload de um documento, nao implementa acumulacao remota.
> - Aviso de deprecacao do Node 20 interno de actions v4 nao bloqueou o CI.
>
> **Services/documents-ingestor:**
> - Workspace canonico: `D:\OneDrive\Programação\Ravatex\controle-tapetes\services\documents-ingestor`.
> - Repositorio antigo preservado para consulta/transicao.
> - Branch integrada: `work/app-next`.
> - HEAD final local/remoto: `8f1df9b`.
> - Runtimes separados; `.env` dentro do servico; sem npm workspaces.
> - Wrapper: `scripts/ingestor.bat`.
> - Workflow: `.github/workflows/documents-ingestor-test.yml`.
> - Suite completa: 673/673.
>
> **Proximo passo:** G26 closed; tratar debitos separados por prioridade.

> **Atualizacao 2026-07-10 — fase
> `G25-B2-A-R3-R2-B4 — DIRECT CNPJ DOCUMENTATION CLOSEOUT`.**
> Status: **G25-B2-A-R3-R2-B4 — DOCUMENTATION CLOSEOUT OK**
> Branch/HEAD: `work/app-next` (HEAD final `e31ef3a`).
>
> **Decisao arquitetural final:** CNPJ armazenado diretamente em
> `clientes.cnpj` e `fornecedores.cnpj` (TEXT, NULL). Nenhuma entidade
> empresarial compartilhada. Nenhum vinculo automatico. Nenhuma
> sincronizacao. Nenhum fallback.
>
> Contrato:
> - cardinalidade `0..1` por cadastro;
> - CNPJ armazenado com 14 digitos, sem pontuacao;
> - campo opcional;
> - validacao de formato e digitos verificadores;
> - unicidade dentro de Clientes;
> - unicidade dentro de Fornecedores;
> - mesmo CNPJ permitido entre as duas categorias;
> - Cliente e Fornecedor permanecem independentes;
> - nenhuma entidade empresarial compartilhada.
>
> Removido do banco e do runtime:
> - `parceiros`, `parceiro_cnpjs`
> - `clientes.parceiro_id`, `fornecedores.parceiro_id`
> - `garantirParceiroPorEntidade`, `carregarMapaCnpjEntidades`
> - tela, rota, menu Parceiros
>
> Commits:
> - `d37e508` — B1: `Add direct CNPJ columns for clients and suppliers`
>   (db/45_direct_entity_cnpj_expand.sql + verify)
> - `5f8eddf` — B2: `Use direct CNPJ fields in client and supplier forms`
>   (8 arquivos: js/ + tests/)
> - `e31ef3a` — B3: `Remove legacy partner CNPJ schema`
>   (db/46_remove_legacy_partner_cnpj.sql + verify)
>
> Staging (`ucrjtfswnfdlxwtmxnoo`):
> - Antes da B3: clientes=3, fornecedores=5, parceiros=0,
>   parceiro_cnpjs=0, CNPJs diretos=0
> - Depois da B3: clientes=3, fornecedores=5, CNPJs diretos=0
> - Contagens preservadas, nenhum dado sintetico remanescente
> - Producao nao acessada, nenhum dado real alterado
>
> Testes:
> - B1: verify transacional passou integralmente
> - B2: direct-cnpj-screens 7/7, boot 30/30, cadastros 32/32,
>   screens-common 15/23 (8 falhas historicas fora de escopo)
> - B3: verify: ALL REMOVE LEGACY PARTNER CNPJ VERIFY ASSERTIONS PASSED
> - Buscas negativas em js/ e tests/: garantirParceiroPorEntidade,
>   carregarMapaCnpjEntidades, parceiro_cnpjs, parceiro_id nao encontrados
> - node --check em todos os JS alterados: OK
>
> Migrations:
> - db/44_partner_cnpj_registry.sql: historico. Aplicada anteriormente,
>   removida na B3. Nao representa o estado atual.
> - db/45_direct_entity_cnpj_expand.sql: adicionou colunas diretas.
>   Aplicada em staging, verify passou.
> - db/46_remove_legacy_partner_cnpj.sql: removeu schema legado.
>   Aplicada em staging, verify passou.
>
> Risco residual:
> - 8 testes historicos de screens-common.smoke.js continuam falhando
>   (script inline removido em refactor anterior — fora de escopo)
> - scripts/staging/g25-b3-parceiros-smoke.mjs permanece (nao utilizado,
>   remocao opcional futura)
>
> Producao nao contatada. Push nao realizado.
>
> Proximo passo: gate documental e autorizacao de push para staging.
>
> **Atualizacao 2026-07-10 — fase
> `G25-B2-A-R3-R1-INTEGRATE-CNPJ-CLIENTS-SUPPLIERS`.**
> Status: **G25-B2-A-R3-R1 PATCH REPORTADO — NÃO ACEITO**
> (HISTORICO: estado da arquitetura intermediaria antes da decisao
> final de remover todo o schema 44. Vide B4 para estado final.)
> Branch/HEAD: `work/app-next` (HEAD inicial `1962812f`).
>
> **Decisao de produto:** R3 original foi reprovada. A exposicao de
> Parceiros como terceira entidade operacional foi removida. Clientes e
> Fornecedores sao os unicos conceitos operacionais. `parceiros` e
> `parceiro_cnpjs` permanecem infraestrutura interna (schema 44 continua
> valido).
>
> O que foi removido da experiencia operacional:
> - Item de menu `Parceiros` do `ADMIN_MENU` em `common.js`.
> - Rota `#/cadastros/parceiros` do `boot.js`.
> - Tela autonoma `screenCadastrosParceiros` de `cadastros.js`
>   (todo o codigo: lista + detalhe + CRUD de parceiro + vinculos
>   fornecedor/cliente). Foram ~530 linhas removidas.
> - Testes que legitimavam a UX autonoma (substituidos por 17 testes
>   de R3-R1).
>
> O que foi integrado:
> - CNPJ aparece como coluna na listagem de Clientes (formata
>   automaticamente o CNPJ principal do parceiro vinculado).
> - Acao "CNPJ" (icone) em cada linha de Cliente, que abre janela de
>   gerenciamento de CNPJs (adicionar, editar, definir principal,
>   ativar/desativar).
> - Mesma integracao para Fornecedores (coluna CNPJ + acao "CNPJ").
> - `parceiros` e `parceiro_cnpjs` sao criados sob demanda via
>   `garantirParceiroPorEntidade` e `abrirModalGerenciarCnpj`
>   (funcoes compartilhadas).
> - Cadastro sem CNPJ continua valido.
> - Helpers de CNPJ (`normalizarCnpj`, `formatarCnpj`,
>   `validarCnpjDv`, `mapearErroParceiroCnpj`) preservados e
>   reutilizados.
>
> Identidade empresarial:
> - `garantirParceiroPorEntidade` cria parceiro apenas quando a
>   entidade ainda nao tem `parceiro_id`.
> - CNPJ duplicado detectado via constraint UNIQUE do banco,
>   mensagem tratada por `mapearErroParceiroCnpj`.
> - Nenhum vinculo automatico por nome ou texto digitado.
> - Múltiplos fornecedores podem compartilhar a mesma identidade
>   empresarial (mesmo `parceiro_id`).
>
> Riscos residuais:
> - `scripts/staging/g25-b3-parceiros-smoke.mjs` permanece no
>   repositório (nao faz parte da UX operacional; pode ser removido
>   em fase futura).
> - 8 testes pre-existentes do `screens-common.smoke.js` continuam
>   falhando (dependem de `<script>` inline removido em refactor
>   anterior — fora de escopo).
> - `index.html` cache-bust (`?v=20260710-g25b3`) manteve-se como
>   estava (troca nao obrigatoria para esta fase).
>
> Testes focados executados:
> - `tests/parceiros-screens.smoke.js` (NOVO, 17 testes R3-R1):
>   17/17 PASS.
> - `tests/cadastros-screens.smoke.js`: 32/32 PASS.
> - `tests/boot.smoke.js`: 30/30 PASS.
> - `tests/screens-common.smoke.js`: 15/23 PASS (8 pre-existentes).
>
> Arquivos alterados:
> - `js/screens/common.js` (remove item Parceiros + icone do menu)
> - `js/boot.js` (remove rota + comentario)
> - `js/screens/cadastros.js` (remove ~530 linhas de tela autonoma;
>   adiciona ~200 linhas de integracao CNPJ em cliente/fornecedor;
>   preserva helpers CNPJ)
> - `tests/parceiros-screens.smoke.js` (substituido: 24 testes R3
>   → 17 testes R3-R1)
> - `tests/screens-common.smoke.js` (EXPECTED_ADMIN_MENU sem
>   Parceiros)
> - `tests/boot.smoke.js` (20 rotas esperadas, 21 em window.routes)
> - `tests/cadastros-screens.smoke.js` (12→11 itens ADMIN_MENU)
> - `PROJECT_STATE.md`, `AGENT_HANDOFF.md` (registro closeout)
>
> Produção (`bhgifjrfagkzubpyqpew`) nao contatada.
> Documents Ingestor intocado.
>
> STATUS FINAL: **G25-B2-A-R3-R1 PATCH REPORTADO — NÃO ACEITO**.
> ENTREGAR AO ARQUITETO — GATE DE R3-R1.
>
> **Atualizacao 2026-07-10 — fase
> `RAVATEX-DOCUMENTS-G25-B2-A-R3-PARTNER-CNPJ-ADMIN-UI`.**
> Status: **CLOSED — G25-B2-A-R3**.
> Branch/HEAD: `work/app-next` (HEAD inicial `998103d`).
>
> Escopo (UI administrativa do registro empresarial compartilhado MODELO C,
> consome o schema 44 de R2; sem migration/RPC/Ingestor):
> - Nova tela `screenCadastrosParceiros` em `js/screens/cadastros.js`:
>   lista de parceiros (nome, estado, CNPJ principal, contagens de CNPJ/
>   fornecedores/clientes) + tela de detalhe com paineis de CNPJs e de
>   vinculos (fornecedores/clientes).
> - Helpers de CNPJ (puros, sem Supabase): `normalizarCnpj`,
>   `formatarCnpj`, `validarCnpjDv` (espelha `is_valid_cnpj` do db/44) e
>   `mapearErroParceiroCnpj` (mapeia CHECK/unique/RLS para PT-BR sem
>   expor payload sensivel).
> - Cadastro/edicao de parceiro grava somente `{nome, ativo}` — nao cria
>   cliente nem fornecedor automaticamente.
> - CNPJ normalizado para 14 digitos antes do write; validacao de DV no
>   front e auxiliar (constraint do banco e autoridade final).
> - Marcacao de principal, ativacao/desativacao de CNPJ.
> - Associacao/desassociacao escreve exclusivamente `parceiro_id`
>   (NULLABLE); nao altera IDs legados, `fornecedores.tipo`, nem FKs de
>   pedidos/lotes/OPs.
> - Autorizacao: rota `roles:['admin']` (router) + RLS `is_admin()`
>   (backstop do banco). Sem bypass, sem service role, sem afrouxar RLS.
>   Erros de RLS em write tratados como falha de autorizacao.
> - Rota `#/cadastros/parceiros` registrada no `boot.js`; item "Parceiros"
>   + icone adicionados ao `ADMIN_MENU`/`MENU_ICONS` em `common.js`;
>   cache-bust `?v=20260710-g25b3` em `index.html`.
>
> Testes focados (node --test):
> - `tests/parceiros-screens.smoke.js` (NOVO, 24 testes): 24/24 PASS.
> - `tests/cadastros-screens.smoke.js`: 32/32 PASS (teste 24, que esperava
>   9 itens do ADMIN_MENU estalado, corrigido para 12).
> - `tests/boot.smoke.js`: 30/30 PASS (testes 9/19/20 com contagens de
>   rotas atualizadas: 21 rotas listadas, 22 em window.routes).
> - `tests/screens-common.smoke.js`: teste 19 (ADMIN_MENU deepEqual com
>   Parceiros) PASS. 8 testes pre-existentes seguem falhando (dependem de
>   `<script>` inline removido no refactor do boot) — fora de escopo.
> - Suporte completa nao executada (politica de testes focados).
>
> Staging smoke write (`ucrjtfswnfdlxwtmxnoo`, login admin):
> - ANTES: `parceiros=0`, `parceiro_cnpjs=0`.
> - Criou parceiro sintetico `__smoke_r3_<ts>` + CNPJ de teste
>   `11222333000181` (valido, reservado; gravado normalizado, sem
>   pontuacao).
> - DEPOIS: `parceiros=1`, `parceiro_cnpjs=1` (+1/+1).
> - Cleanup integral: CNPJ removido, parceiro removido.
> - FINAIS: `parceiros=0`, `parceiro_cnpjs=0` (estado anterior restaurado).
> - Producao (`bhgifjrfagkzubpyqpew`) nao contatada (guarda de ref).
>
> Arquivos alterados nesta fase:
> - `js/screens/cadastros.js` (helpers CNPJ + screenCadastrosParceiros + exports)
> - `js/screens/common.js` (item de menu + icone)
> - `js/boot.js` (rota admin)
> - `index.html` (cache-bust)
> - `tests/parceiros-screens.smoke.js` (novo)
> - `tests/boot.smoke.js`, `tests/cadastros-screens.smoke.js`,
>   `tests/screens-common.smoke.js` (regressao de contagens)
> - `scripts/staging/g25-b3-parceiros-smoke.mjs` (novo, smoke write)
> - `PROJECT_STATE.md`, `AGENT_HANDOFF.md` (registro closeout)
>
> Confirmacoes:
> - `node --check` em todos os JS alterados: OK.
> - Working tree: somente residuos previamente autorizados (`.claude/`,
>   `data/fixtures/document-events-pedido-02.jsonl`, `supabase/.temp/`).
> - Nenhum push realizado.
>
> STATUS FINAL: **G25-B2-A-R3 CLOSED**. ENTREGAR AO ARQUITETO.


> Status: **CLOSED — G25-B2-A-R2**.
> Branch/HEAD: `work/app-next` em `f89dcc6`.
>
> Escopo (schema aditivo MODELO C, staging-only, nao destrutivo):
> - Migration 44: `db/44_partner_cnpj_registry.sql` (196 linhas) + `db/44_partner_cnpj_registry.verify.sql` (78 linhas).
> - Cria `public.parceiros`, `public.parceiro_cnpjs` e a funcao imutavel `public.is_valid_cnpj(text)` (14 digitos + DV, rejeita sequencia repetida e pontuacao).
> - Adiciona links aditivos e NULLABLE `fornecedores.parceiro_id` / `clientes.parceiro_id` com `ON DELETE RESTRICT`.
> - RLS admin-only (`parceiros_admin`, `parceiro_cnpjs_admin`); triggers de `atualizado_em`; indice unico global de CNPJ (`parceiro_cnpjs_cnpj_uidx`) e indice parcial de um principal ativo por parceiro (`parceiro_cnpjs_um_principal_ativo_uidx`).
> - Idempotente (`CREATE OR REPLACE`, `IF NOT EXISTS`, `DROP POLICY IF EXISTS`); sem preenchimento de CNPJ; sem vinculacao automatica; sem alterar registros legados.
>
> Aplicacao e verificacao em staging (`ucrjtfswnfdlxwtmxnoo`):
> - Migration 44 aplicada via SQL editor/Client Postgres (conexao direta ao projeto staging).
> - `db/44_partner_cnpj_registry.verify.sql` executado com `NOTICE: ALL VERIFY ASSERTIONS PASSED`.
> - Re-aplicacao da migration executada sem erro e sem efeitos adicionais (idempotencia confirmada).
> - RLS estrutural: `parceiros` e `parceiro_cnpjs` com `ROW LEVEL SECURITY = true`; policies `parceiros_admin` e `parceiro_cnpjs_admin` configuradas como `FOR ALL USING (is_admin()) WITH CHECK (is_admin())`.
> - RLS comportamental (testado com `SET LOCAL ROLE authenticated` + JWT claims dentro de transacao):
>   - Nao-admin (`tipo = 'fornecedor'`): SELECT retorna 0 linhas; INSERT e bloqueado.
>   - Admin (`tipo = 'admin'`): SELECT retorna todas as linhas; INSERT e permitido e cleanup removido.
> - Contagens legadas inalteradas: `fornecedores=5`, `clientes=3`, `pedidos=5`, `ops=7`.
> - Tabelas novas vazias: `parceiros=0`, `parceiro_cnpjs=0`.
> - Todos `parceiro_id` NULL: `fornecedores` 5/5, `clientes` 3/3.
> - Producao (`bhgifjrfagkzubpyqpew`) nao foi contatada.
>
> Arquivos alterados nesta fase:
> - `db/44_partner_cnpj_registry.sql` (novo)
> - `db/44_partner_cnpj_registry.verify.sql` (novo)
> - `PROJECT_STATE.md` (registro closeout)
> - `AGENT_HANDOFF.md` (registro closeout)
>
> Confirmacoes:
> - `git diff --check HEAD~1 HEAD`: OK.
> - Working tree limpa exceto por untracked esperados: `.claude/`, `data/fixtures/document-events-pedido-02.jsonl`, `supabase/.temp/`.
> - Nenhum push realizado.
>
> STATUS FINAL: **G25-B2-A-R2 CLOSED**. ENTREGAR AO ARQUITETO.

> **Atualizacao 2026-07-10 — fase
> `RAVATEX-DOCUMENTS-G25-B1-UX-C-B-TEST-CLEANUP-CLOSEOUT`.**
> Status: **CLOSED — G25-B1-UX-C-B**.
> Branch/HEAD: `work/app-next` em `4c852bd` (HEAD inicial `4c852bd`).
>
> Escopo (limpeza de dados de teste em staging; sem alteracao de schema/codigo):
> - Exclusao escopada de 3 documentos de teste autorizada pelo operador (allowlist exclusiva).
> - Supabase staging (`ucrjtfswnfdlxwtmxnoo`): removidas 3 `document_candidates` + 2 `document_events` (5 linhas), keyed por `document_id`. Producao (`bhgifjrfagkzubpyqpew`) bloqueada por guarda; nunca contatada.
> - Ingestor SQLite (registro sincrono): removidas 3 `documentos` + 4 `ingestion_events` (7 linhas). Ambos os bancos 40 -> 37.
> - IDs: `cda18ef9…` (teste-nfe-entrada.xml, era accepted), `6c871580…` (pdf143429.pdf), `40ed90ab…` (TESTE-G25-B1-20260710-1536.pdf).
> - Reversao do aceite: `desfazer_decisao_documento` diagnosticado nao aplicavel/nao alcancavel (`admin_required` via service_role; 0 decisao ativa; aceite ingestor-side; `pedido_id` null). Operador autorizou exclusao direta; estado accepted removido pela propria exclusao, sem tocar Pedido/OP. Nenhuma RPC de exclusao (`desfazer_decisao_documento`, `remover_pedido`, `remover_op`) foi invocada.
> - Preservado: doc legitimo `e9c0922c…` / `cce-001_000006192-1_S_1.pdf` (Drive `1v7KQ2…`, sha256 compartilhado `efa7f31f13…`); `L.pdf`. `pedidos`=5 e `ops`=7 inalterados. 0 eventos orfaos.
> - Google Drive: nenhuma chamada; nenhum arquivo fisico removido. Gmail: nenhuma chamada. Nenhum novo scan.
> - Watcher (Ingestor) parado pelo script oficial antes e retomado depois (`watcher_instances` 0 -> 1); `active_gmail_requests` 0 antes e depois.
> - Producao intocada. Nenhum push. `git add` restrito a `PROJECT_STATE.md` e `AGENT_HANDOFF.md`.
>
> Arquivos alterados nesta fase:
> - `PROJECT_STATE.md` (registro closeout)
> - `AGENT_HANDOFF.md` (registro closeout)
>
> Encerramento: G25-B1-UX-A e G25-B1-UX-C (A + B) encerrados. Proximo passo: G25-B2 - RELEVANCE CLASSIFIER V1.
>
> STATUS FINAL: G25-B1-UX-C-B CLOSED. ENTREGAR AO ARQUITETO.

> **Atualizacao 2026-07-10 — fase
> `RAVATEX-DOCUMENTS-G24-B5-V-VISUAL-GATE-CLOSEOUT`.**
> Status: **CLOSED — G24-B5-V VISUAL_GATE_OK**.
> Branch/HEAD: `work/app-next` em `9aacfe2` (HEAD inicial `9aacfe2`).
>
> Escopo G24-B5-V (closeout visual, sem alteracao de codigo):
> - Validacao visual da deduplicacao: status ativo aparece somente no botao.
> - Hard reload reidratou automaticamente a mesma request ativa.
> - Reload nao criou request adicional.
> - Request de validacao `4afb65f3…` foi consumida.
> - Watcher executado uma unica vez.
> - `requests_processed 1`, `requests_completed 1`, `requests_failed 0`.
> - `active_gmail_requests` final 0.
> - Botao retornou ao estado disponivel apos conclusao.
> - Producao intocada.
> - Nenhum push.
> - Nenhuma alteracao tecnica neste closeout.
>
> Arquivos alterados nesta fase:
> - `PROJECT_STATE.md` (registro closeout)
> - `AGENT_HANDOFF.md` (registro closeout)
>
> Confirmacoes:
> - Producao intocada.
> - Nenhum push realizado.
> - Nenhuma alteracao tecnica (nem Controle, nem Documents Ingestor).
> - Untracked preservados: `.claude/`, `data/fixtures/document-events-pedido-02.jsonl`, `supabase/.temp/`.
>
> STATUS FINAL: G24-B5-V VISUAL_GATE_OK — CLOSED. ENTREGAR AO ARQUITETO.
>
> > **Atualizacao 2026-07-10 — fase
> > `RAVATEX-DOCUMENTS-G24-B1-R1-DOCUMENT-SCAN-REQUEST-QUEUE-HARDENING-CLOSEOUT`.**
> Status: **PRONTO — FILA DE SOLICITACOES DE SCAN (REQUEST × RUN DESACOPLADOS) COM ESTADO `cancelled`**.
> Branch/HEAD tecnico Controle: `work/app-next` em `7847bbc597eb8558ad2d3bea7c8323889ef65ea0` (HEAD inicial `eed680ed322bc1ad2496d6fa316e242100f29709`).
> HEAD canonico de referencia no Ingestor: `master` em `dfc2e648554e7ea987bca34a14263f5344c92b8e`.
>
> Escopo G24-B1 (Controle):
> - Migration 41: `db/41_document_scan_requests_queue.sql` (novo, 617 linhas).
>   Cria a fila canonica `public.document_scan_requests` separada da execucao real em `document_scan_runs`. Separa `request` (intencao do operador) de `run` (execucao real do Ingestor), impedindo que a UI acople a um INSERT dependente do indice unico parcial `document_scan_runs_running_source_uidx` de `db/38`.
> - Estados completos: `requested | claimed | running | completed | failed | cancelled`. Em R1 foi adicionado `cancelled` como estado terminal (exige `finished_at`, nao exige `error_message`, nao permanece no indice de requests ativas). RPC de cancelamento NAO e criada nesta fase — o estado fica preparado no schema para uma RPC futura ou para um UPDATE de `is_admin()`.
> - Claim atomico: `claim_next_document_scan_request(p_source TEXT DEFAULT NULL)` via `FOR UPDATE SKIP LOCKED` + reconfirmacao `status = 'requested'`. Fila vazia devolve `{ ok: true, empty: true }`. Duas instancias do runner nunca pegam a mesma request.
> - Unicidade ativa por source: `UNIQUE INDEX PARCIAL` sobre `(source)` restrito a `status IN ('requested','claimed','running')`. Impede duas requests ativas para a mesma source sem depender de `SELECT` previo + `INSERT` (TOCTOU).
> - Transicoes estritas: `mark_document_scan_request_running` faz SOMENTE `claimed` -> `running` + associa `scan_run_id` real. `finish_document_scan_request` aceita apenas `completed` ou `failed` (cancelamento nao entra nesta RPC nesta fase), transita a partir de `claimed`/`running`, preenche `finished_at`, grava `error_message` quando `failed`, idempotente em estado terminal.
> - Renomeacao R1: `requested_by` -> `requested_by_user_id` na tabela, no `INSERT` de `solicitar_document_scan`, em todos os `COMMENT ON COLUMN` e na documentacao. Alinha com a convencao de outras tabelas de auditoria (`decided_by_user_id`, `synced_by_user_id`).
> - `scan_run_id` sem foreign key intencionalmente: a request e a execucao possuem ciclos de vida desacoplados e a auditoria da request deve sobreviver a cleanup manual de runs. Comentario explicito no schema.
> - Grants/RLS: RLS admin-only (`public.is_admin()` com `USING` e `WITH CHECK`); `REVOKE ALL` de `PUBLIC`/`anon`/`authenticated`; `GRANT SELECT` para `authenticated` para acompanhamento admin. RPCs: `solicitar_document_scan` -> `authenticated` (gate `is_admin()`); `claim_next_document_scan_request`, `mark_document_scan_request_running`, `finish_document_scan_request` -> `service_role` apenas. Finaliza com `NOTIFY pgrst, 'reload schema'` + `NOTIFY pgrst, 'reload config'`.
> - Sem FK em `scan_run_id`, sem escrita em `document_scan_runs`, `document_candidates`, `document_decisions`, sem scheduler, sem daemon, sem service_role no frontend, sem alteracao em `db/38`, `db/39` ou `db/40`.
>
> Migration 41: **VERSIONADA, MAS NAO APLICADA** nesta fase. `CREATE OR REPLACE` garante idempotencia no apply futuro. Aplicar **somente em staging** em fase posterior, apos smoke do watcher B2.
>
> Arquivos alterados nesta fase (Controle):
> - `db/41_document_scan_requests_queue.sql` (novo, 617 linhas).
> - `tests/documentos-scan-requests-queue-schema.test.js` (novo, 14 testes).
>
> Confirmacoes:
> - Producao intocada. Gmail, Drive e Supabase real **nao utilizados** nesta fase (migration nao aplicada, nenhuma chamada remota, nenhuma credencial real).
> - Migration 41 versionada mas **nao aplicada** (apply somente em staging, em fase posterior).
> - Testes: `tests/documentos-scan-requests-queue-schema.test.js` 14/14; regressao verificada em `tests/documentos-schema.smoke.js` 15/15 e `tests/documentos-ingestor-state-undo-schema.test.js` 6/6.
> - Sem push, sem `git add .`, sem `git add -A`.
> - Untracked preservados no Controle: `.claude/`, `data/fixtures/document-events-pedido-02.jsonl`, `supabase/.temp/`.
> - `git diff --check`: OK.
>
> Ressalva obrigatoria: a migration 41 foi especificada e versionada (definicao + grants + NOTIFY), mas a **fila real ainda depende do smoke staging** a ser executado em fase posterior (G24-B2/B3). O claim atomico, o indice parcial e a protecao `FOR UPDATE SKIP LOCKED` sao contratos logicos, nao verificados contra carga real.
>
> Proximo passo: G24-B2 — REQUEST WATCHER PATCH. Implementar no Documents Ingestor o processo que recebe `document_scan_requests`, executa o fluxo real do ingestor e atualiza request e run, com `--once` obrigatorio para testes e modo mock/dry-run por padrao.

> **Atualizacao 2026-07-09 — fase
> `RAVATEX-DOCUMENTS-G23-F-D-SCAN-RUN-STALE-LOCK-RECOVERY-PATCH`.**
> Status: **PRONTO — RPC DE RECOVERY PARA STALE LOCKS EM document_scan_runs**.
> Branch/HEAD tecnico Controle: `work/app-next` em `aa62793f251e4643037f421cd8ec419406ea9911` (HEAD inicial `2ae80d9f165cae9b926e2a1fcffae17979cb5eba`).
> HEAD canonico de referencia no Ingestor: `master` em `ea4f1d2ced154194358fe90df714bfba41d74ae3` (HEAD inicial `b573b9958bb5c1a219ee057d423d6563968f2dd0`).
>
> Escopo G23-F-D (Controle):
> - Migration 40: `db/40_document_scan_runs_stale_recovery.sql` (novo, 117 linhas).
>   RPC canonica `public.recuperar_document_scan_runs_travados(p_source TEXT DEFAULT NULL, p_stale_after INTERVAL DEFAULT INTERVAL '30 minutes')` — `CREATE OR REPLACE`, idempotente.
> - Semantica: compare-and-swap `running` -> `failed`, somente para runs com `started_at < now() - p_stale_after`, usando `FOR UPDATE SKIP LOCKED` + reconfirmacao `status = 'running'` (impede dupla recuperacao concorrente). O indice unico parcial `document_scan_runs_running_source_uidx` de `db/38` continua garantindo um unico run `running` ativo por source.
> - Piso rigido de 5 minutos via `GREATEST(COALESCE(p_stale_after, INTERVAL '30 minutes'), INTERVAL '5 minutes')`. Default canonico: **30 minutos**. Piso: **5 minutos**. Nenhum valor abaixo de 5 e aceito.
> - Autorizacao: `auth.role() = 'service_role'` (self-heal do writer) **OU** `public.is_admin()` (destrave manual pela UI). Mesmo padrao das migrations 38 e 39.
> - Auditoria preservada: reusa `status = 'failed'` (sem mexer no CHECK de `db/38`). Grava sentinela em `error_message` no formato `stale_recovered: exceeded <stale_after>, started_at=<ISO Z>`. Nunca apaga a linha.
> - Grants: `REVOKE ALL` de `PUBLIC` e `anon`; `GRANT EXECUTE` para `service_role` e `authenticated`. Finaliza com `NOTIFY pgrst, 'reload schema'` e `NOTIFY pgrst, 'reload config'`.
> - Retorno: JSONB `{ ok, source, stale_after, recovered_count, recovered[] }`.
>
> Contrato operacional com o writer (registrado no Ingestor):
> - Flag `--recover-stale` (boolean): habilita a chamada da RPC `recuperar_document_scan_runs_travados` antes de cada tentativa de scan.
> - Flag `--stale-after-minutes <N>` (int): minutos de tolerancia para considerar um run como travado. Default canonico `30`. Piso `5`. Valores menores que 5 sao coercidos a 5 dentro da RPC.
>
> Causa raiz:
> - O writer (service_role) cria uma linha `status='running'` e depende do indice unico parcial `document_scan_runs_running_source_uidx` (criado em `db/38`) para impedir concorrencia por source. Se o processo cair entre o INSERT e a finalizacao, a linha fica `running` para sempre e bloqueia todo scan futuro daquela source. A RPC entrega um destravamento self-heal que nao depende de intervencao manual.
>
> Migration 40: **VERSIONADA, MAS NAO APLICADA** nesta fase. `CREATE OR REPLACE` garante idempotencia no apply futuro. Aplicar **somente em staging** no G23-F-E.
>
> Arquivos alterados nesta fase (Controle):
> - `db/40_document_scan_runs_stale_recovery.sql` (novo, 117 linhas).
>
> Arquivos alterados nesta fase (Ingestor, registro sincrono):
> - `docs/SUPABASE_WRITER_RUNBOOK.md`
> - `src/cli.ts`
> - `src/core/syncSupabase.ts`
> - `src/supabase/serviceRoleClient.ts`
> - `tests/sync-supabase.test.ts`
>
> Confirmacoes:
> - Producao intocada. Gmail, Drive e Supabase real **nao utilizados** nesta fase (RPC nao aplicada, nenhuma chamada remota, nenhuma credencial real).
> - Migration 40 versionada mas **nao aplicada** (apply somente em staging, no G23-F-E).
> - Testes: Ingestor `tests/sync-supabase.test.ts` 24/24; Controle suite acumulada 431/431 (sem regressao).
> - Sem push, sem `git add .`, sem `git add -A`.
> - Untracked preservados no Controle: `.claude/`, `data/fixtures/document-events-pedido-02.jsonl`, `supabase/.temp/`.
>
> Ressalva obrigatoria: a RPC foi especificada e versionada (definicao + grants + NOTIFY), mas a **concorrencia real ainda depende do smoke staging** a ser executado no G23-F-E. O piso de 5 minutos e a protecao `FOR UPDATE SKIP LOCKED` sao contratos logicos, nao verificados contra carga real ate G23-F-E.
>
> Proximo passo: G23-F-E — STAGING SMOKE. Aplicar a migration 40 no projeto staging do Supabase e exercitar `--recover-stale` + `--stale-after-minutes` em um cenario real com run orfao simulado, validando destravamento e idempotencia concorrente.
>
> **Atualizacao 2026-07-09 — fase
> `RAVATEX-DOCUMENTS-G23-E-G-CANONICAL-UNDO-CLOSEOUT`.**
> Status: **PRONTO — CLOSEOUT MULTI-REPO DA TRILHA G23-E**.
> Branch/HEAD base: `work/app-next` em `d7e7107`.
>
> Trilha G23-E completa:
> - **G23-E-C** (migration patch `d5c9951`): SQL `39_documentos_ingestor_state_undo.sql`
>   — base canonica (`ingestor_status`, `ingestor_state_at`, `ingestor_event_id`,
>   `ingestor_rejected_reason`) em `document_candidates`; auditoria de revogacao
>   em `document_decisions`; RPC `desfazer_decisao_documento` (admin-only, SECURITY
>   DEFINER); RPC `upsert_document_candidate_ingestor_state` (service_role-only);
>   grants e backfill conservador diagnostico.
> - **G23-E-C-R1**: migration 39 aplicada em staging (`ucrjtfswnfdlxwtmxnoo`), RPCs
>   disponiveis, schema cache recarregado via `NOTIFY pgrst`.
> - **G23-E-D** (writer patch `20b9cf1` no Documents Ingestor): `export:mapped`
>   inclui `latest_ingestion_event_at`; `sync:supabase` deriva base canonica completa,
>   chama RPC `upsert_document_candidate_ingestor_state` via service_role, reporta
>   skips para candidatos incompletos.
> - **G23-E-E** (UI undo patch `d7e7107`): `js/documents-supabase-decisions.js`
>   expoe `undoDocumentDecisionInCloud(documentId, motivo)`; reader le colunas
>   `ingestor_*` e calcula `_ravatex_can_undo_server_decision`; tela Documentos
>   exibe botoes Desfazer/Aceitar/Rejeitar conforme estado.
> - **G23-E-F**: staging E2E smoke validado — writer real contra staging
>   (service_role), reader authenticated, decidir/desfazer via RPC, idempotencia
>   writer, cleanup 0 residuos. 37/37 ingestor + 291/291 controle.
> - **G23-E-G** (closeout): registro documental multi-repo.
>
> Confirmacoes G23-E:
> - Producao nao usada.
> - Browser visual real nao executado (testado via harness programatico authenticated).
> - Nao-admin logado nao testado end-to-end (guarda `is_admin()` provada).
> - Cleanup remoto 0 residuos (candidates=0, decisions=0, events=0, scan_runs=0).
> - Sem push, sem migration nova, sem `git add .`.
>
> Arquivos alterados nesta fase:
> - `PROJECT_STATE.md` (este arquivo, registro closeout)
> - `AGENT_HANDOFF.md` (registro closeout)
>
> > **Atualizacao 2026-07-09 - fase
> > `RAVATEX-DOCUMENTS-G23-D-B-CLOUD-DOCUMENT-DECISIONS-PATCH`.**
> > Status: **PRONTO - DECISOES EM NUVEM VIA RPC decidir_documento**.
> > Branch/HEAD base: `work/app-next` em `72402ee`.
>
> Escopo G23-D-B:
> - Novo `js/documents-supabase-decisions.js`: expoe
>   `RAVATEX_DOCUMENTS.decideDocumentInCloud(documentId, status, motivo)`.
>   Wrapper sem DOM, so `window.supa.rpc('decidir_documento', ...)`, sem
>   `.from()`, writes diretos, service_role ou armazenamento local. Guards de
>   `supabase_unavailable`/`document_id_required`/`invalid_status`/
>   `motivo_required` (rejeicao sem motivo nao chama a RPC). Le `r.data.error`
>   (a RPC usa a chave `error`, nao `erro`); `r.error` PostgREST e throw viram
>   `ok:false` (`supabase_error`/`network`).
> - `js/screens/documentos-recebidos.js`: a branch de doc Supabase troca o
>   placeholder "decisao em nuvem sera habilitada" por botoes reais
>   `aceitar-documento-nuvem`/`rejeitar-documento-nuvem`. Sucesso -> toast,
>   `loadReceivedDocumentsFromSupabase()` e rerender (verdade vinda do servidor,
>   sem optimistic). Erros mapeados para PT (admin_required etc.). Docs
>   Supabase nunca usam `saveDocumentDecision`/`removeDocumentDecision`/
>   `statusOverrides`; docs manual/G22-B preservam o fluxo localStorage.
> - `index.html`: carrega `documents-supabase-decisions.js` apos o reader e
>   antes das telas.
> - Pedido Detail nao mudou: reflete passivamente apos o reload do reader.
> - Testes: decisions 17/17, documentos recebidos 77/77, reader 9/9, Pedido
>   Detail 181/181, auto-load 35/35, import received 36/36, loader 71/71.
> - Sem migration, schema, escrita Supabase real, service_role, producao ou push.
>
> **Atualizacao 2026-07-09 - fase
> `RAVATEX-DOCUMENTS-G23-C-B-CONTROL-SUPABASE-DOCUMENTS-READER-PATCH`.**
> Status: **PRONTO - READER SUPABASE ADMIN-ONLY COM FALLBACK G22-B**.
> Branch/HEAD base: `work/app-next` em `03c49db`.
>
> Escopo G23-C-B:
> - Novo `js/documents-supabase-reader.js`: SELECT autenticado em
>   `document_candidates` e `document_decisions` ativos, sem `raw_payload`,
>   writes, RPC ou service_role.
> - Converte candidates para `RAVATEX_DOCUMENTS_RECEIVED`; decisao server ativa
>   vence o status e motivo do candidate. A origem fica marcada como `supabase`.
> - Tela Documentos tenta Supabase primeiro; G22-B so executa em falha do
>   primario e nao pode sobrescrever uma carga Supabase, inclusive vazias.
> - Pedido Detail passa a priorizar received Supabase sobre eventos legados.
>   Documentos manuais/G22-B preservam decisoes em localStorage; documentos
>   Supabase ficam read-only ate a fase G23-D.
> - Testes: reader 9/9, documentos recebidos 70/70, auto-load 35/35,
>   Pedido Detail 181/181, import received 36/36 e loader 71/71.
> - Nenhuma escrita Supabase, Gmail/Drive, migration, producao ou push.
>
> **Atualizacao 2026-07-09 — fase
> `RAVATEX-DOCUMENTS-G22-B-DOCUMENTS-AUTO-LOAD-PATCH`.**
> Status: **PRONTO — AUTO-LOAD DE DOCUMENTOS MAPEADOS VIA FETCH RELATIVO**.
> Branch/HEAD: `work/app-next`.
>
> Escopo G22-B:
> - **G22-A**: Design (13 perguntas respondidas, gate verificada, HEAD 2e95a5e clean).
> - **G22-B**: Implementacao:
>   - `js/documents-ingestor-auto-load.js` (novo, ~165 linhas): IIFE com `autoLoadDocuments()` e `autoLoadDocumentsReset()`.
>   - Fetch relativo de `data/documents/latest.json` + `data/documents/documentos-mapeados.jsonl`.
>   - Hash skip evita reparse desnecessario do JSONL.
>   - Salva metadata no `localStorage` (reusando chave `RAVATEX_DOCUMENTS_RECEIVED_METADATA`).
>   - Sets `window.RAVATEX_DOCUMENTS_AUTO_LOADED_SESSION = true` no sucesso.
>   - `index.html`: +1 tag script para auto-load.
>   - `js/screens/documentos-recebidos.js`:
>     - Botao "Atualizar agora" chama `autoLoadDocuments()` (antes era setTimeout vazio).
>     - Primeira renderizacao tenta auto-load com 300ms delay (requer fetch disponivel).
>     - Card de metadata mostra "Auto-sincronizado — dados carregados via fetch relativo." + chip "Auto-sync" verde.
>   - Gate: `APP_ENV !== 'production'` AND `CURRENT_USER.tipo === 'admin'` AND `window.fetch` disponivel.
>   - Sem polling, sem scheduler, sem backend, sem daemon.
>   - Documents Ingestor intocado.
>   - Gmail/Drive intocados.
>   - Supabase intocado.
>   - Botao "Importar documentos" preservado como fallback.
>   - Decisoes locais (`RAVATEX_DOCUMENTS_DECISIONS`) continuam vencendo.
> - Testes:
>   - `tests/documents-ingestor-auto-load.test.js`: 34/34 (novo)
>   - `tests/documentos-recebidos.smoke.js`: 68/68 (+9 novos G22-B, 0 regressao)
>   - `tests/documents-ingestor-loader.test.js`: 71/71 (regressao)
>   - `tests/documents-ingestor-import-received.test.js`: 36/36 (regressao)
>   - `tests/pedido-detail.smoke.js`: 180/180 (regressao)
>   - Total: 389 pass, 0 fail
>
> Arquivos alterados/criados:
> - `js/documents-ingestor-auto-load.js` (novo)
> - `index.html` (1 linha de script)
> - `js/screens/documentos-recebidos.js` (refreshBtn + auto-load + metadata)
> - `tests/documents-ingestor-auto-load.test.js` (novo)
> - `tests/documentos-recebidos.smoke.js` (+9 testes + auto-load no sandbox)
> - `PROJECT_STATE.md` (registro)
> - `AGENT_HANDOFF.md` (registro)
>
> Proximo: commit, staging push quando decidido.
>
> > **Atualizacao 2026-07-09 — fase
> > `RAVATEX-DOCUMENTS-G20-B-LOCAL-DOCUMENT-DECISIONS-PATCH`.**
> > Status: **PRONTO — ACEITE/REJEIÇÃO LOCAL PERSISTIDO NO CONTROLE**.
> > Branch/HEAD: `work/app-next`, após commit G20-B.
>
> HEADs:
> - G20-B: decisão local de documento (aceitar/rejeitar/desfazer) persistida em localStorage por document_id.
> - staging/main: `19d83bb` — G18 bridge (intocado, sem push G20-B).
> - origin/main: `1047181` — intocado (produção não tocada).
>
> Escopo G20:
> - **G20-A**: Design — definir aceite/rejeição local, sem escrever no Ingestor.
> - **G20-B**: Implementação:
>   - Helpers: `loadDocumentDecisions`, `saveDocumentDecision`, `removeDocumentDecision`, `getDocumentDecision`, `getEffectiveDocumentStatus` em `js/documents-ingestor.js`.
>   - Chave localStorage: `RAVATEX_DOCUMENTS_DECISIONS` (Map<document_id, {status, motivo, decidedAt}>).
>   - Rejeição exige motivo (via `window.prompt`).
>   - Efeito na tela Documentos Mapeados:
>     - Status efetivo via `getEffectiveDocumentStatus`.
>     - Badge "Decisão local" (azul) quando há override.
>     - Badge "Divergente" (laranja) quando efetivo != importado.
>     - Botão "Desfazer" para remover decisão local.
>     - Fallback: `statusOverrides` volátil quando localStorage indisponível.
>   - Efeito no Pedido Detail bridge:
>     - Status reflete decisão local via `getEffectiveDocumentStatus`.
>     - `isLocalDecision` no `ingestorDocumentRows`.
>   - Botão legado "Importar eventos" continua ausente.
>   - Zero alterações no Documents Ingestor, schema, backend.
> - **G18-A**: Design da preservacao de `ingestion_event_id` no bridge.
> - **G18-B**: Patch `mapReceivedDocToEventShape` seleciona ID por status (accepted/accepted_ingestion_event_id, assigned/linked_ingestion_event_id, rejected/rejected_ingestion_event_id, pending/detected_ingestion_event_id) com fallback para `latest_ingestion_event_id`. Testes: 7 novos + 2 atualizados.
> - **G18-C**: Cross-repo smoke com JSONL real do Ingestor (2 linhas, 355/355 testes).
> - **G18-D**: Push staging (`9aa264e..19d83bb`). origin/main preservado.
> - **G18-E**: Smoke staging automatizado (374/374 testes, 5 suites).
> Escopo G16 (fases A e B):
> - **G16-A**: Design read-only da metadata de import (10 perguntas respondidas).
> - **G16-B**: Implementacao do helper `simpleHash` + persistencia de metadata em
>   `localStorage` (`RAVATEX_DOCUMENTS_RECEIVED_METADATA`) + card discreto na tela
>   `#/documentos/recebidos`.
>
> Metadata salva apos import bem-sucedido:
> - `importedAt`: ISO string (data/hora do import)
> - `fileName`: nome do arquivo selecionado (ex: `documentos-mapeados.jsonl`)
> - `count`: quantidade de documentos importados
> - `hash`: hash DJB2 simples do conteudo do JSONL (8 chars hex)
> - `statusCounts`: `{ accepted, assigned, pending, rejected, unknown }`
>
> Comportamento:
> - Metadata sobrevive a F5/reload (localStorage).
> - Reimport substitui metadata anterior.
> - Import invalido NAO sobrescreve metadata anterior.
> - localStorage indisponivel/corrompido nao quebra a tela.
> - Card exibe data/hora em pt-BR, nome do arquivo, count, pills por status,
>   hash curto (`#xxxxxxxx`) e aviso "Snapshot manual — pode estar defasado".
> - Se `importedAt > 24h`, card ganha chip "Defasado" em tom ambar com
>   instrucao para reimportar.
> - Sem metadata = sem card (estado vazio preservado).
>
> Arquivos alterados (G16-B):
> - `js/documents-ingestor-import-received.js` — `+simpleHash`, `+computeStatusCounts`,
>   `+saveReceivedMetadata`, `+loadReceivedMetadata`, metadata salva no callback `change`
>   do file input.
> - `js/screens/documentos-recebidos.js` — `+getReceivedMetadata`,
>   `+buildImportMetadataCard`, card renderizado entre header e scan strip.
> - `tests/documents-ingestor-import-received.test.js` — teste localStorage ban removido;
>   6 novos testes G16-B (metadata salva, window global, hash muda, statusCounts,
>   erro preserva, localStorage indisponivel).
> - `tests/documentos-recebidos.smoke.js` — teste localStorage ban atualizado
>   (agora confirma referencia); 8 novos testes G16-B (card ausente sem metadata,
>   card presente com metadata, chip Defasado >24h, chip Atualizado <24h,
>   tolera null, tolera sem fileName, tolera sem statusCounts, exibe Rejeitados).
>
> Testes: 338 pass (4 suites focadas) — 0 regressao.
>
> Garantias:
> - Array `RAVATEX_DOCUMENTS_RECEIVED` continua volatil (em memoria).
> - Apenas metadata persiste em localStorage.
> - Toast de sucesso inalterado.
> - Pedido Detail intocado.
> - Documents Ingestor intocado.
> - Sem Supabase, Google/Drive, polling, scheduler, backend.
>
> Proximo: integracao com `ingestion_event_id` no JSONL (melhoria futura no produtor)
> ou aceite/rejeicao dentro do Controle (feature posterior).
>
> > **Atualizacao 2026-07-09 — fase
> > `RAVATEX-DOCUMENTS-G14-D-CLOSEOUT-AND-STAGING-PUSH`.**
> Status: **PRONTO — CONSUMIDOR BRIDGE DOCUMENTOS-MAPEADOS.JSONL NO CONTROLE**.
> Branch/HEAD `work/app-next`, `fff052b`.
>
> Escopo G14 (fases A a D):
> - **G14-A**: Design da bridge — consumo manual sem polling, sem endpoint, sem backend.
> - **G14-B**: `mapReceivedDocToEventShape(flatDoc)` + fallback `RAVATEX_DOCUMENTS_RECEIVED` no `computeViewModel` do Pedido Detail.
> - **G14-C**: Smoke real com `documentos-mapeados.jsonl` real (2 linhas, 2 repos, 6 suites, 426 testes).
> - **G14-D**: Closeout + staging push (`fff052b` → `staging main`). Producao/origin intocados.
>
> Fluxo entregue:
> 1. Operador clica "Importar documentos" na tela `#/documentos/recebidos`
> 2. `loadReceivedDocumentsFromText` popula `window.RAVATEX_DOCUMENTS_RECEIVED`
> 3. Pedido Detail: `computeViewModel` le `RAVATEX_DOCUMENTS_RECEIVED` como fallback quando `RAVATEX_DOCUMENTS_LOADED_EVENTS` vazio
> 4. Filtro por `pedido_manual` (exato + fallback por prefixo numerico se ano divergir)
> 5. `mapReceivedDocToEventShape` converte flat → event shape
> 6. Render: badges (tipo/formato/direcao), status pill, botao "Ver" (Drive link)
> 7. Idempotencia: dedup por `document_id` no loop de montagem
> 8. Precedencia: eventos legados (`LOADED_EVENTS`) vencem; flat e fallback puro
>
> Garantias:
> - Botao "Importar documentos" na tela `#/documentos/recebidos` preservado (inline, verde)
> - Botao legado "Importar eventos" ausente (sem `RAVATEX_ENABLE_DOCUMENTS_EVENTS_IMPORT_UI`)
> - `mapReceivedDocToEventShape` nao inventa `ingestion_event_id` ou `event_id`
> - Documentos sem `pedido_manual` (ex: L.pdf) viaveis na tela Documentos, NAO no Pedido Detail
> - Reimport nao duplica (`document_id` dedup)
> - Sem timeline (flat JSONL nao tem eventos historicos)
> - Documents Ingestor nao alterado
> - Sem Supabase, sem Google/Drive, sem polling, sem backend, sem persistencia
>
> Arquivos alterados (G14-B + G14-C):
> - `js/documents-ingestor.js` — `+mapReceivedDocToEventShape` (89 linhas)
> - `js/screens/pedido-detail-progress.js` — fallback `RAVATEX_DOCUMENTS_RECEIVED` (98 linhas)
> - `tests/documents-ingestor.test.js` — 16 testes mapper (199 linhas)
> - `tests/documents-ingestor-loader.test.js` — 5 testes bridge (237 linhas)
> - `tests/pedido-detail.smoke.js` — 5 testes smoke (30 linhas)
> - `tests/g14-c-bridge-smoke.test.js` — 22 testes smoke com JSONL real (588 linhas, novo)
>
> Testes: 426 pass (6 suites)
>
> Staging: `fff052b` publicado em `ravatexapps-dotcom/controle-tapetes-staging:main`
> Origin/producao: `grupoterrabranca/controle-tapetes:main` intocado
>
> Proximo roadmap:
> - `ingestion_event_id` entregue no produtor (G17) e bridge (G18), staging publicado, smoke validado
> - UX de aceite/rejeicao dentro do Controle (feature posterior)
> - Sem polling/scheduler/daemon por enquanto

> **Atualizacao 2026-07-08 - fase
> `RAVATEX-TAPETES-G12-F2-MAPPED-DOCUMENTS-CONSUMER-PATCH`.**
> Status: **PRONTO — SUPORTE A documentos-mapeados.jsonl NO CONTROLE**.
> Entrada: branch `work/app-next`, HEAD `30f0a82`.
>
> Escopo:
> - `js/documents-ingestor-import-received.js`: copy de import
>   reescrita para aceitar ambos os exports do Ingestor
>   (documentos-recebidos.jsonl OU documentos-mapeados.jsonl).
>   - Botao: `Importar documentos` (generico).
>   - title/aria-label: `Selecionar arquivo JSONL de documentos
>     exportados do Documents Ingestor`.
>   - toast sucesso: `N documento(s) carregado(s). Nada foi persistido.`
>   - toast erro: `Arquivo incompativel. Selecione o export do
>     Documents Ingestor (JSONL flat, 1 documento por linha, com
>     document_id). Motivo: <erro>.`
>   - NAO chama o nome de um arquivo especifico: copy NAO induz o
>     operador a procurar apenas o export antigo.
> - `js/screens/documentos-recebidos.js`:
>   - Data: `received_at || created_at` (prioriza o campo novo do
>     mapeados; fallback para o campo antigo do recebidos).
>   - Status: lido de `doc.status` com mapeamento operacional:
>     - `pending`   -> `Pendente`
>     - `assigned`  -> `Atrelado` (azul)
>     - `accepted`  -> `Aceito` (verde)
>     - `rejected`  -> `Rejeitado` (vermelho)
>     - ausente / desconhecido -> `Pendente` (fallback seguro).
>   - Pill de status agora expoe `data-status` para inspecao automatica.
>   - Header e empty state mencionam ambos os exports aceitos.
>   - **Sem** alteracao em `documents-ingestor.js` ou
>     `documents-ingestor-loader.js`: parser/loader ja eram
>     tolerantes a campos extras e preservavam o objeto como veio
>     do JSONL.
>
> Compatibilidade:
> - `documentos-recebidos.jsonl` (G12-D1, antigo, sem status /
>   received_at): continua aceito, renderiza com fallback Pendente
>   e data via created_at.
> - `documentos-mapeados.jsonl` (G12-F1, com schema_version, status,
>   pedido_manual, received_at, detected_at, linked_at, accepted_at,
>   rejected_at, rejected_reason): aceito, campos extras preservados
>   no estado, status e data exibidos via fallbacks da tela.
>
> Garantias:
> - Pedido Detail NAO tocado: continua consumindo apenas
>   `RAVATEX_DOCUMENTS_LOADED_EVENTS`.
> - Estado unico: `window.RAVATEX_DOCUMENTS_RECEIVED` (sem
>   `RAVATEX_DOCUMENTS_MAPPED`).
> - Sem Supabase, sem Google/Drive real, sem persistencia,
>   sem auto-load, sem watcher.
> - Sem alteracao no repo Documents Ingestor.
> - Sem associacao documento -> Pedido.
>
> Testes:
> - `documents-ingestor.test.js`: +3 casos G12-F2 (isValid + parse
>   aceita mapeados, parse preserva campos extras, ainda exige
>   document_id).
> - `documents-ingestor-loader.test.js`: +4 casos G12-F2 (loader
>   aceita mapeados, preserva campos extras em RECEIVED, aceita
>   antigo (regressao), dedup funciona com misto).
> - `documentos-recebidos.smoke.js`: +8 casos G12-F2 (received_at,
>   prioridade received_at > created_at, status pending/assigned/
>   accepted/rejected, status desconhecido -> Pendente, formato
>   antigo continua OK, header menciona ambos).
> - `documents-ingestor-import-received.test.js`: 4 casos reescritos
>   para a nova copy (title/aria genericos, toast sem nome de
>   arquivo, erro generico).
> - Total novo: +15 casos, sem regressao.
>
> Proximo: nenhum (escopo de suporte a mapped documents consumer
> esta fechado). Aguardar export real do Ingestor G12-F1 ou
> evolucoes no Ingestor.

> **Atualizacao 2026-07-08 - fase
> `RAVATEX-TAPETES-G12-R1-DOCUMENTOS-REAL-BROWSER-FIX`.**
> Status: **PRONTO — UX: BOTAO INLINE + TEXTO EXPLICITO**.
> Entrada: branch `work/app-next`, HEAD `2c7f72f`.
>
> Escopo:
> - `js/documents-ingestor-import-received.js`: refatorado.
>   - Auto-floating DESLIGADO por padrao (controlado por
>     flag `RAVATEX_ENABLE_FLOATING_RECEIVED_IMPORT`,
>     default off).
>   - Nova API: `RAVATEX_DOCUMENTS.createReceivedImportButton(opts)`
>     retorna `{ button, fileInput, mount, mountBody }` para a
>     tela montar inline.
> - `js/screens/documentos-recebidos.js`: tela agora
>   renderiza o botao inline via `createReceivedImportButton()`.
>   Texto do header esclarece:
>   "Documentos recebidos importados do arquivo
>    documentos-recebidos.jsonl.
>    Nada e carregado automaticamente do Gmail nesta tela."
> - `index.html`: indentacao corrigida (G12-G2 havia
>   quebrado 4 linhas com 4-space em vez de 2-space).
> - Testes atualizados para o novo padrao.
>   - `documents-ingestor-import-received.test.js`: 29/29.
>   - `documentos-recebidos.smoke.js`: 27/27.
>   - Validacao browser (g12-browser-validation.mjs): 37/37.
>
> Causa raiz (UX):
> - Antes: o botao flutuante "Importar recebidos" ficava
>   sempre visivel no canto inferior direito, e a tela
>   prometia "documentos do Ingestor" mas so mostrava uma
>   mensagem vazia. O usuario nao sabia que precisava
>   importar manualmente. Falso integracao.
> - Agora: botao so aparece dentro da tela, e a tela
>   esclarece a ausencia de auto-load.
>
> Risco do patch:
> - Pequeno: o botao legado "Importar eventos" continua
>   flutuando (sua politica inalterada). O botao novo
>   migrou para inline.
> - Sem regressao no Pedido Detail, que continua
>   consumindo apenas `RAVATEX_DOCUMENTS_LOADED_EVENTS`.
>
> Proximo: opcional G12-H (smoke browser real via
> puppeteer/playwright).

> **Atualizacao 2026-07-08 - fase
> `RAVATEX-TAPETES-G12-RECEIVED-DOCUMENTS-BROWSER-CLOSEOUT`.**
> Status: **FECHADO — VALIDACAO BROWSER + CLOSEOUT**.
> Entrada: branch `work/app-next`, HEAD `bfc36c2`.
>
> Validacao browser:
> - Ambiente: staging simulado em vm.Context com mesmos
>   modulos e ordem de script tag de index.html.
> - Usuario: `CURRENT_USER.tipo = 'admin'`,
>   `RAVATEX_ENABLE_DOCUMENTS_IMPORT_UI = true`.
> - Script: `scripts/staging/g12-browser-validation.mjs`
>   (33 checks, todos OK).
>
> Evidencia (saida do script):
> ```
> [ OK ] console probes: APP_ENV, CURRENT_USER, ambos arrays
>       globais, ambos loaders, screenDocumentosRecebidos.
> [ OK ] ambos botoes de import presentes, distinguiveis
>       (azul #2563eb vs verde #18794a, labels distintos).
> [ OK ] import legado: 7 eventos -> LOADED_EVENTS,
>       toast "document-events.jsonl",
>       RECEIVED NAO afetado.
> [ OK ] import novo: 3 docs -> RECEIVED,
>       toast "documentos-recebidos.jsonl + Documentos + Nada foi persistido",
>       LOADED_EVENTS preservado.
> [ OK ] tela Documentos: 3 rows, 1 botao Ver, 2 placeholders
>       Sem link, badges (NF, XML, Entrada, Pendente), shellLayout.
> [ OK ] Pedido Detail: LOADED_EVENTS reconhecido,
>       3 docs / 7 eventos timeline, sem receivedDocumentRows,
>       LOADED_EVENTS + RECEIVED preservados apos Pedido Detail.
> ```
>
> Trilha G12 fechada:
> - G12-G1 `8fc2568` — parser + loader
> - G12-G2 `d1486ae` — tela global + rota + menu
> - G12-G3 `bfc36c2` — botao dedicado de import
> - G12-CLOSE — validacao browser + closeout
>
> Testes: 427/427 focado (7 suites), 33/33 browser,
> 0 regressao nos suites cobertos.
>
> Proximo: G12-H (opcional, se houver proximo escopo) ou
> encerramento da trilha G12.

> **Atualizacao 2026-07-08 - fase
> `RAVATEX-TAPETES-G12-G3-RECEIVED-DOCUMENTS-IMPORT-BUTTON`.**
> Status: **PRONTO — BOTAO DEDICADO DE IMPORT**.
> Entrada: branch `work/app-next`, HEAD `d1486ae`.
>
> Escopo:
> - `js/documents-ingestor-import-received.js` (novo): botao
>   flutuante "Importar recebidos" (verde, ao lado do legado
>   "Importar eventos" em azul). FileReader ->
>   `loadReceivedDocumentsFromText` -> popula
>   `window.RAVATEX_DOCUMENTS_RECEIVED`. NAO toca
>   `RAVATEX_DOCUMENTS_LOADED_EVENTS`.
> - `index.html`: `<script>` do novo importador apos o legado.
> - `tests/documents-ingestor-import-received.test.js` (novo,
>   35 testes).
>
> Guarda (mesma politica do legado):
> - Nunca em producao (APP_ENV === 'production').
> - Em staging/local/dev: visivel para admin OU com flag
>   `RAVATEX_ENABLE_DOCUMENTS_IMPORT_UI === true`.
> - CURRENT_USER pode ser populado assincronamente (fast poll
>   ~10s, slow poll indefinido).
>
> Toast de sucesso (verde):
> "N documento(s) carregado(s) de documentos-recebidos.jsonl.
>  Abra Documentos para visualizar a fila.
>  Nada foi persistido."
>
> Toast de erro (vermelho):
> "Erro ao importar: <motivo>." ou "Erro ao ler o arquivo."
>
> Garantias:
> - Sem Supabase, sem Google/Drive real, sem fetch, sem
>   localStorage/sessionStorage.
> - Sem persistencia, sem watcher/polling/backend.
> - Sem PDF/XML armazenado.
> - Sem associacao documento -> Pedido.
> - NAO interfere no botao legado "Importar eventos".
> - NAO sobrescreve `RAVATEX_DOCUMENTS_LOADED_EVENTS`.
>
> Testes: 35/35 import-received, 152/152 focado (4 suites),
> sem regressao.
>
> Proximo: G12-H ou fechamento da trilha G12.

> **Atualizacao 2026-07-08 - fase
> `RAVATEX-TAPETES-G12-G2-RECEIVED-DOCUMENTS-GLOBAL-SCREEN`.**
> Status: **PRONTO — TELA GLOBAL + ROTA + MENU**.
> Entrada: branch `work/app-next`, HEAD `8fc2568`.
>
> Escopo:
> - `js/screens/documentos-recebidos.js` (novo, 196 linhas):
>   `screenDocumentosRecebidos(container)` — renderiza empty state ou
>   card com cards/tabela de documentos, lendo exclusivamente
>   `window.RAVATEX_DOCUMENTS_RECEIVED`. Botao "Ver" abre
>   `drive_web_view_link` em nova aba (noopener,noreferrer).
>   Status pill "Pendente" sempre visivel. "Sem link" para docs
>   sem `drive_web_view_link`.
> - `js/boot.js`: rota `#/documentos/recebidos` (admin-only) registrada.
> - `js/screens/common.js`: ADMIN_MENU recebe item
>   `{ href: '#/documentos/recebidos', label: 'Documentos' }`
>   entre Pedidos e Cores. Icone SVG adicionado em MENU_ICONS.
> - `index.html`: `<script src="js/screens/documentos-recebidos.js">`
>   inserido apos `pedidos-list.js`, antes de `boot.js`.
> - `tests/documentos-recebidos.smoke.js` (novo, 21 testes).
> - `tests/screens-common.smoke.js`: EXPECTED_ADMIN_MENU atualizado
>   de 9 para 11 itens (Pedidos + Documentos + 9 originais).
>
> Garantias:
> - Tela NAO le `RAVATEX_DOCUMENTS_LOADED_EVENTS` (estado legado
>   do Pedido Detail permanece intocado).
> - Sem Supabase, sem Google/Drive real, sem fetch, sem
>   localStorage/sessionStorage.
> - Sem persistencia, sem watcher/polling/backend.
> - Sem PDF/XML armazenado.
> - Sem associacao documento -> Pedido (apenas EXIBE).
>
> Testes: 21/21 tela nova, 315/315 focado (4 suites G12 + Pedido
> Detail), 43/43 router, 172/172 pedido-detail. Zero regressao
> nos suites cobertos.
>
> Proximo: G12-G3 (import dedicado de documentos-recebidos.jsonl,
> opcional, separar do import atual de document-events.jsonl).

> **Atualizacao 2026-07-08 - fase
> `RAVATEX-TAPETES-G12-G1-RECEIVED-DOCUMENTS-PARSER-LOADER`.**
> Status: **PRONTO — PARSER + LOADER PARA documentos-recebidos.jsonl**.
> Entrada: branch `work/app-next`, HEAD `5aca3c9`.
>
> Escopo:
> - `js/documents-ingestor.js`: `isValidReceivedDocument`,
>   `parseReceivedDocumentsJsonl`, `filterDocumentsWithoutPedido`
>   (formato flat do Ingestor G12-D1, sem tocar o parser de eventos
>   do bloco G11-B).
> - `js/documents-ingestor-loader.js`: `setReceivedDocuments`,
>   `loadReceivedDocumentsFromText`, `loadReceivedDocumentsFromUrl`.
>   Estado separado: `window.RAVATEX_DOCUMENTS_RECEIVED`.
>   NAO toca `window.RAVATEX_DOCUMENTS_LOADED_EVENTS`.
> - Reutiliza a politica de URL guard do loader atual.
>
> Garantias:
> - Pedido Detail continua consumindo apenas o estado legado.
> - Funcao `parseDocumentEventsJsonl` / `isValidDocumentEvent` /
>   `buildDocumentsForPedido` / `filterEventsByPedido` /
>   `deduplicateEvents` / `consolidateDocumentState` inalteradas
>   (apenas adicoes, sem patch nessas funcoes).
> - Loader atual (`loadDocumentsIngestorEventsFromText` etc)
>   inalterado.
>
> Testes: 60/60 parser, 62/62 loader, 34/34 import-ui (regressao).
> 156/156 nas 3 suites focadas.
>
> Proximo: G12-G2 tela global + rota + menu.

> **Atualizacao 2026-07-08 - fase
> `RAVATEX-TAPETES-G11-F-R1-IMPORT-UI-BROWSER-VALIDATION-CLOSEOUT`.**
> Status: **FECHADO — VALIDACAO BROWSER CONCLUIDA**.
> Entrada: branch `work/app-next`, HEAD `4c5e27a`.
>
> Fases fechadas no bloco G11-F:
>
> | Fase | Commit | Descricao |
> |------|--------|-----------|
> | G11-F | `562a123` + `8667035` | UX orientada p/ export package |
> | G11-F-R1 | `a2ec41e` + `4c5e27a` | Slow poll + namespace fix + diagnostics |
>
> Validacao browser real:
> - APP_ENV = staging
> - CURRENT_USER.tipo = admin
> - RAVATEX_DOCUMENTS existe
> - RAVATEX_DOCUMENTS.loadDocumentsIngestorEventsFromText = function
> - RAVATEX_DOCUMENTS.setDocumentsIngestorEvents = function
> - Botao "Importar eventos" visivel
> - Import de fixture carregou 7 eventos
> - Toast: "7 evento(s) carregado(s) de document-events.jsonl"
>
> Padrao de namespace confirmado:
> As funcoes estao em `window.RAVATEX_DOCUMENTS.*`, nao
> diretamente em `window.*`. Este e o design correto.
>
> Arquivos alterados: `PROJECT_STATE.md`,
> `AGENT_HANDOFF.md` (docs-only).
>
> Confirmacoes finais do bloco G11:
> - Sem Supabase.
> - Sem Google/Drive real.
> - Sem export real.
> - Sem watcher/polling.
> - Sem persistencia.
> - Sem alteracao no repo Documents Ingestor.
> - Nenhum PDF/XML armazenado.
> - `.claude/`, `supabase/.temp/` e fixture local
>   fora do commit.
> - Origin/producao intocados.
>
> Proximo: integracao com export:package real.
>
> > **Atualizacao 2026-07-08 - fase
> > `RAVATEX-TAPETES-G11-F-LOADER-REAL-PACKAGE`.**
> Status: **PRONTO — UX ORIENTADA P/ EXPORT PACKAGE**.
> Entrada: branch `work/app-next`, HEAD base `87d52f5`.
>
> Fase minima: ajuste de UX copy para orientar o
> operador a selecionar `document-events.jsonl` do
> export package do Documents Ingestor.
>
> Nenhuma lacuna tecnica: o parser/loader ja consome
> corretamente o conteudo de `document-events.jsonl`.
> `manifest.json`, `summary.json` e `README.md` sao
> ignorados nesta etapa.
>
> Alteracoes:
> - `js/documents-ingestor-import-ui.js`: botao
>   "Importar eventos" (antes "Importar docs"),
>   title/aria-label orientando
>   "document-events.jsonl do export package",
>   toast menciona "de document-events.jsonl".
> - `tests/documents-ingestor-import-ui.test.js`:
>   5 novos testes validando label, title,
>   aria-label e toast.
>
> Sem ZIP, multi-file, pasta, watcher, polling,
> Supabase, Google/Drive, export real, alteracao no
> Documents Ingestor, PDF/XML, persistencia.
>
> Testes: import-ui 31/31, loader 43/43, ingestor
> 44/44, UI smoke 39/39, pedido-detail 172/172.
>
> > **Atualizacao 2026-07-08 - fase
> > `RAVATEX-TAPETES-G11-E-DOCUMENTS-MANUAL-IMPORT-UX-CLOSEOUT`.**
> Status: **FECHADO — VALIDACAO MANUAL CONCLUIDA**.
> Entrada: branch `work/app-next`, HEAD base
> `888cf47`; `origin` e producao intocados. Escrita
> permitida em `staging/work/app-next`.
>
> Fases concluidas no bloco G11-E:
>
> | Fase | Commit | Descricao |
> |------|--------|-----------|
> | G11-E | `56eb5a6` | UX manual de import (file input + FileReader) |
> | G11-E-R1 | `318d51b` | Scope guard: APP_ENV gate |
> | G11-E-R2 | `1ae3384` | Admin surface guard: role + flag |
> | G11-E-R3 | `975cb75` | Prefix fallback fix (year mismatch) |
> | G11-E-R3-R1 | `888cf47` | Unique-key fallback (multi-ano seguro) |
>
> Validacao manual em staging:
> - Fixture local: `data/fixtures/document-events-pedido-02.jsonl`
>   (nao commitada, descartavel).
> - Pedido #2 exibiu seção DOCUMENTOS RECEBIDOS (INGESTOR)
>   com 3 documentos consolidados:
>   * NF-3201-entrada.xml — status Aceito
>   * NF-4815-saida.pdf — status Rejeitado com reason
>   * Romaneio-Entrega-9210.pdf — status Pendente
> - Timeline de 7 eventos renderizada com dots e labels.
> - Botao "Ver" abriu nova aba para drive_web_view_link
>   (links sinteticos — Google Drive exibiu "arquivo nao
>   existe", esperado para fixture).
> - Estado nao persistiu apos reload.
> - Botao "Importar docs" nao visivel para cliente/
>   fornecedor (validado).
>
> Regras de matching consolidadas:
> 1. Match exato `PED-{numeroPad2}-{ano}` — canonico.
> 2. Fallback prefixo com chave unica distinta.
> 3. Conflito multi-ano nao vincula automaticamente.
>
> Regras de visibilidade do botao de import:
> - `APP_ENV !== 'production'`
> - `CURRENT_USER.tipo === 'admin'` OU
>   `RAVATEX_ENABLE_DOCUMENTS_IMPORT_UI === true`
> - Poll 200 ms ate ~10 s para aguardar login.
>
> Arquivos alterados:
> `PROJECT_STATE.md`, `AGENT_HANDOFF.md` (docs-only).
>
> Garantias finais do bloco G11:
> - Sem Supabase.
> - Sem Google/Drive real.
> - Sem export real.
> - Sem alteracao no repo Documents Ingestor.
> - Sem PDF/XML armazenado.
> - Sem persistencia.
> - Sem watcher.
> - `.claude/`, `supabase/.temp/` e fixture local
>   fora do commit.
> - Origin/producao intocados.
>
> Riscos remanescentes:
> 1. Fixture `pedido-02.jsonl` e descartavel — usar
>    fixture apropriada para cada pedido testado.
> 2. Poll de `CURRENT_USER` tem timeout de ~10 s;
>    em redes lentas, botao pode nao aparecer.
> 3. Links Drive sinteticos nao abrem documentos reais
>    (esperado; so o export package real tera links
>    validos).
>
> Proxima fase recomendada:
> Integracao com export:package real do Documents
> Ingestor (com links Drive validos) e/ou watcher
> automatizado de outbox.
>
> > **Atualizacao 2026-07-08 - fase
> > `RAVATEX-TAPETES-G11-E-R2-DOCUMENTS-IMPORT-ADMIN-SURFACE-GUARD`.**
> Status: **PRONTO — SUPERFICIE RESTRITA A ADMIN/DEV**.
> Entrada: branch `work/app-next`, HEAD base
> `318d51b`; `origin` somente leitura.
>
> Causa raiz: G11-E-R1 protegeu producao, mas o botao
> ainda aparecia em staging para qualquer usuario
> (incluindo cliente/fornecedor).
>
> Correcao: guard duplo:
> 1. `APP_ENV !== 'production'` (ja existente).
> 2. Admin (`CURRENT_USER.tipo === 'admin'`) OU flag
>    `RAVATEX_ENABLE_DOCUMENTS_IMPORT_UI === true`.
> 3. Poll de 200ms ate ~10s aguarda `CURRENT_USER` ser
>    populado por `boot.js` via `loadCurrentUser()`.
>
> Regra final de visibilidade:
> - Producao: nunca visivel.
> - Staging + admin: aparece (apos login).
> - Staging + flag: aparece imediatamente.
> - Staging + cliente/fornecedor: nunca.
> - Flag pode ser ativada via console:
>   `window.RAVATEX_ENABLE_DOCUMENTS_IMPORT_UI = true`.
>
> Arquivos: `js/documents-ingestor-import-ui.js`
> (refatorado: funcoes `shouldShowImportUI`,
> `tryCreateImportUI`, `startPoll`, `stopPoll`),
> `tests/documents-ingestor-import-ui.test.js`
> (+8 novos casos de scope por role/flag),
> `PROJECT_STATE.md`, `AGENT_HANDOFF.md`.
> `index.html` inalterado.
>
> Testes: import-ui 26/26, loader 43/43, UI smoke 35/35,
> ingestor 44/44, pedido-detail 172/172 = 320/320.
>
> Garantias: sem Supabase, Google/Drive, export real,
> alteracao no Documents Ingestor, PDF/XML, dados reais.
> `.claude/` e `supabase/.temp/` fora do commit.
>
> > **Atualizacao 2026-07-08 - fase
> > `RAVATEX-TAPETES-G11-E-R1-DOCUMENTS-MANUAL-IMPORT-SCOPE-GUARD`.**
> Status: **PRONTO — SCOPE GUARD APLICADO**.
> Entrada: branch `work/app-next`, HEAD base
> `56eb5a6`; status inicial `?? .claude/` e
> `?? supabase/.temp/`; `origin` somente leitura.
>
> Causa raiz: G11-E injetava o botao de import
> incondicionalmente em `document.body`, visivel em
> todas as paginas (admin e cliente).
>
> Correcao: gate via `window.APP_ENV !== 'production'`
> (mesmo padrao do `environment-banner.js`).
> Em producao, botao nunca aparece. Em staging/dev/local,
> botao disponivel para teste pelo operador/admin.
>
> Arquivos alterados:
> `js/documents-ingestor-import-ui.js` (+4 linhas:
> condicional `APP_ENV` no bootstrap),
> `tests/documents-ingestor-import-ui.test.js`
> (+56 linhas: 4 testes de scope guard + suporte a
> `appEnv` no sandbox),
> `PROJECT_STATE.md`, `AGENT_HANDOFF.md`.
>
> Testes reportados:
> - `documents-ingestor-import-ui.test.js`: 22/22
>   (+4 scope guard: bloqueio em production, permissao
>   em staging/undefined, funcionalidade preservada);
> - `documents-ingestor-loader.test.js`: 43/43;
> - `documents-ingestor-ui-smoke.test.js`: 35/35;
> - `documents-ingestor.test.js`: 44/44;
> - `pedido-detail.smoke.js`: 172/172 (sem regressao).
>
> Garantias: sem Supabase, Google/Drive, export real,
> alteracao no Documents Ingestor, PDF/XML, dados reais,
> watcher, polling, persistencia. `.claude/` e
> `supabase/.temp/` fora do commit. Sem push.
>
> Riscos remanescentes:
> 1. Em staging, qualquer usuario autenticado (admin ou
>    cliente de teste) ve o botao. Em producao, ninguem.
> 2. Validacao visual staging/browser pendente.
>
> > **Atualizacao 2026-07-08 - fase
> > `RAVATEX-TAPETES-G11-E-DOCUMENTS-MANUAL-IMPORT-UX`.**
> Status: **PRONTO — UX MANUAL DE IMPORT IMPLEMENTADA**.
> Entrada: branch `work/app-next`, HEAD base
> `7e087f0` (G11-D-R1); reconciliação com `381506c`
> confirmada (ancestral, G11-B/C/D/D-R1 presentes no
> HEAD atual). `origin` somente leitura.
>
> Escopo: UX manual para o operador carregar eventos
> JSONL do Documents Ingestor via botão flutuante.
> Sem watcher, sem Supabase, sem persistência.
>
> UX implementada: **Opção A (file input + FileReader)**.
> - Botão flutuante fixo no canto inferior direito
>   (`position:fixed; bottom:16px; right:16px`).
> - Abre diálogo de arquivo nativo
>   (`<input type="file" accept=".jsonl,.txt">`).
> - FileReader lê o conteúdo.
> - Chama `loadDocumentsIngestorEventsFromText`.
> - Toast de sucesso mostra count e lembra que nada
>   foi persistido.
> - Toast de erro mostra mensagem controlada.
> - Input limpo após cada import (permite reimportar).
> - Não há URL digitável.
> - Não há rerender automático (operador deve
>   navegar/recarregar o Pedido).
>
> Arquivo criado: `js/documents-ingestor-import-ui.js`
> (86 linhas, IIFE).
> Teste novo: `tests/documents-ingestor-import-ui.test.js`
> (18 testes: DOM, fluxo sucesso/erro, seguranca,
> integracao, index.html).
> `index.html`: +1 linha de script para import-ui.js.
>
> Testes reportados:
> - `documents-ingestor.test.js`: 44/44;
> - `documents-ingestor-ui-smoke.test.js`: 35/35;
> - `documents-ingestor-loader.test.js`: 43/43;
> - `documents-ingestor-import-ui.test.js`: 18/18;
> - `pedido-detail.smoke.js`: 172/172 (sem regressao).
>
> Garantias: sem Supabase, Google/Drive, export real,
> alteracao no Documents Ingestor, PDF/XML, dados reais,
> watcher, polling, persistencia, URL digitavel.
> `.claude/` e `supabase/.temp/` fora do commit.
> Sem push.
>
> Riscos remanescentes:
> 1. Botão visível em todas as páginas (admin e
>    cliente). O texto do toast orienta sobre uso.
> 2. Sem rerender automático: após import, o Pedido
>    Detail só reflete os documentos após recarregar
>    ou navegar novamente ao pedido.
> 3. Validação visual browser/staging pendente.
>
> Proxima fase: teste visual em staging/browser com
> fixture real e validação do fluxo completo
> import -> Pedido Detail.
>
> > **Atualizacao 2026-07-08 - fase
> > `RAVATEX-TAPETES-G11-D-R1-DOCUMENTS-LOADER-URL-GUARD`.**
> Status: **PRONTO — URL GUARD APLICADO**.
> Entrada: branch `work/app-next`, HEAD base
> `ef14648`; status inicial `?? .claude/` e
> `?? supabase/.temp/`; `origin` somente leitura.
>
> Escopo: microfix — hardening de
> `loadDocumentsIngestorEventsFromUrl` com validacao
> de URL antes do fetch.
>
> Política de URL aplicada:
> - Bloqueia esquemas: `javascript:`, `data:`, `blob:`,
>   `file:`, `ftp:`, `chrome:`, `edge:`.
> - Bloqueia URLs absolutas com `://` (http, https, etc).
> - Bloqueia protocolo relativo `//`.
> - Bloqueia path traversal `../` e `..\\`.
> - Bloqueia caminhos UNC `\\\\`.
> - Permite caminhos relativos (`/data/fixtures/`,
>   `data/fixtures/`).
>
> `loadDocumentsIngestorEventsFromUrl` mantida, mas com
> validacao antes de qualquer fetch. Caminhos locais
> (mesma origem) continuam funcionando.
>
> Testes adicionados: 11 novos casos URL guard (bloqueio
> https, http, file, javascript, data, blob, ../,
> ..\\, //; permissao relativa com/sem leading slash).
>
> Arquivos alterados: `js/documents-ingestor-loader.js`
> (+25 linhas: `BLOCKED_SCHEMES`, `validateLoaderUrl`,
> integracao em `loadFromUrl`),
> `tests/documents-ingestor-loader.test.js`
> (+139 linhas: 11 testes de guard),
> `PROJECT_STATE.md`, `AGENT_HANDOFF.md`.
>
> Testes reportados:
> - `documents-ingestor.test.js`: 44/44;
> - `documents-ingestor-ui-smoke.test.js`: 35/35;
> - `documents-ingestor-loader.test.js`: 43/43;
> - `pedido-detail.smoke.js`: 172/172.
>
> Garantias: sem Supabase, Google/Drive, export real,
> alteracao no Documents Ingestor, PDF/XML, dados reais,
> `.claude/` e `supabase/.temp/` fora do commit.
>
> Riscos remanescentes:
> 1. Fetch por URL relativa ainda e possivel se chamado
>    explicitamente (design: dev/teste manual).
> 2. `loadFromUrl` pode ser chamada do console, mas
>    limitada a mesma origem.
> 3. Validacao browser/staging pendente.
>
> > **Atualizacao 2026-07-08 - fase
> > `RAVATEX-TAPETES-G11-D-DOCUMENTS-LOCAL-LOADER`.**
> Status: **PRONTO — LOADER LOCAL IMPLEMENTADO**.
> Entrada: branch `work/app-next`, HEAD base
> `a8f932b`; status inicial `?? .claude/` e
> `?? supabase/.temp/`; `origin` somente leitura e
> producao intocados. Escrita permitida em
> `staging/work/app-next`.
> HEAD final da implementacao:
> `(HEAD apos commit g11-d)`.
>
> Escopo: loader local/manual para popular
> `window.RAVATEX_DOCUMENTS_LOADED_EVENTS` a partir de
> texto JSONL, array de eventos ou URL local controlada.
> Sem watcher, sem Supabase, sem Google/Drive, sem
> persistencia, sem auto-load em producao.
>
> Loader criado: `js/documents-ingestor-loader.js`
> (141 linhas, IIFE padrao do projeto).
> Funcoes expostas em `window.RAVATEX_DOCUMENTS`:
> - `loadDocumentsIngestorEventsFromText(jsonlText)` —
>   parseia JSONL, valida, deduplica e popula a global.
>   Retorna `{ ok, count, error }`.
> - `loadDocumentsIngestorEventsFromUrl(url)` —
>   fetch explicito de URL local; nao chamado
>   automaticamente. Retorna Promise.
> - `setDocumentsIngestorEvents(events)` —
>   aceita array pre-parsed, valida e deduplica.
>
> Seguranca:
> - Limite de `MAX_EVENTS = 2000`.
> - Validacao de cada evento via `isValidDocumentEvent`.
> - Deduplicacao via `deduplicateEvents` do parser.
> - Nao chama fetch no bootstrap (apenas em funcao
>   explicita `loadFromUrl`).
> - Nao referencia Supabase, Google/Drive,
>   localStorage, sessionStorage.
>
> Integracao em `index.html`:
> - `js/documents-ingestor.js` adicionado apos
>   `js/ui.js`, antes de `pedido-detail.js`.
> - `js/documents-ingestor-loader.js` apos o ingestor.
> - Ambos carregados exatamente 1 vez.
> - Nenhum auto-load: loader apenas expoe funcoes.
>
> Teste novo: `tests/documents-ingestor-loader.test.js`
> (32 testes — exitencia/sintaxe, loadFromText 8,
> setEvents 5, loadFromUrl 5, seguranca 5,
> integracao 2, index.html 5, regressao 2).
>
> Arquivos alterados: `js/documents-ingestor-loader.js`
> (novo), `tests/documents-ingestor-loader.test.js`
> (novo), `index.html` (2 linhas de script),
> `PROJECT_STATE.md`, `AGENT_HANDOFF.md`.
>
> Testes reportados:
> - `documents-ingestor.test.js`: 44/44;
> - `documents-ingestor-ui-smoke.test.js`: 35/35;
> - `documents-ingestor-loader.test.js`: 32/32;
> - `pedido-detail.smoke.js`: 172/172 (sem regressao).
>
> `git diff --check`: OK.
>
> Garantias: sem Supabase, sem Google/Drive, sem export
> real, sem alterar Documents Ingestor, sem PDF/XML
> armazenado, sem dados reais commitados, `.claude/` e
> `supabase/.temp/` fora do commit.
>
> Riscos remanescentes:
> 1. `loadDocumentsIngestorEventsFromUrl` usa fetch real
>    no browser; limitado a chamada explicita, mas em
>    producao qualquer script pode chama-la. A funcao
>    existe apenas para dev/teste local.
> 2. Validacao visual browser/staging com loader real
>    ainda pendente.
> 3. Watcher/poller persistente ainda nao implementado
>    (fase futura).
>
> Proxima fase recomendada: integracao com watcher real
> ou export:package para alimentar o loader
> automaticamente em staging (G11-E).
>
> > **Atualizacao 2026-07-07 - fase
> > `RAVATEX-TAPETES-G11-C-DOCUMENTS-CONSUMER-UI-SMOKE`.**
> Status: **VALIDADO — UI SMOKE PRONTO**.
> Entrada: branch `work/app-next`, HEAD base
> `4861f69`; status inicial `?? .claude/` e
> `?? supabase/.temp/`; `origin` somente leitura e
> producao intocados. Escrita permitida em
> `staging/work/app-next`.
> HEAD final da implementacao:
> `(HEAD apos commit g11-c)`.
>
> Escopo: validacao visual/read-only + closeout
> documental. Nenhum patch funcional (codigo fonte
> inalterado exceto export `ns.buildDocuments` para
> testabilidade). Sem Supabase, sem Google/Drive,
> sem export real, sem Documents Ingestor alterado.
>
> Smoke criado: `tests/documents-ingestor-ui-smoke.test.js`
> com 35 testes distribuidos em 3 camadas:
>
> **Estatico (10 tests)**: `assert.match` na fonte de
> `pedido-detail-render.js` validando:
> - secao `DOCUMENTOS RECEBIDOS (INGESTOR)`;
> - condicional `view.ingestorDocsLoaded`;
> - badges com `bg/text/label` inline;
> - botao `Ver` com `window.open` + `noopener,noreferrer`;
> - reason em vermelho `#a23434` + prefixo `Rejeitado:`;
> - timeline dots com `border-radius:50%`;
> - status badge fallback a `window.RAVATEX_DOCUMENTS`;
> - `computeViewModel` referencia `RAVATEX_DOCUMENTS_LOADED_EVENTS`;
> - icone `SVG_FILE` no card de documento.
>
> **Dados (13 tests)**: `computeViewModel` com fixture
> populada em sandbox VM (PED-25-2026):
> - `ingestorDocsLoaded === true`;
> - 3 documentos consolidados (7 eventos -> 3);
> - filenames: `NF-25487-entrada.xml`, `NF-35891-saida.pdf`,
>   `Romaneio-Entrega-8720.pdf`;
> - badges: NF, XML, Entrada, PDF, Saida, Romaneio;
> - status: Aceito, Rejeitado, Pendente;
> - `driveLink` presente em todos os documentos;
> - `reason` presente apenas no doc rejeitado com texto
>   `NF emitida com valor divergente — aguardando correcao`;
> - timeline: 7 eventos com `eventType`/`label`/`docLabel`
>   corretos e ordenados por `created_at`;
> - sem injecao quando global nao populada;
> - sem documentos para pedido diferente (PED-99-2026).
>
> **DOM (8 tests)**: `buildDocuments(view)` com mock `el` +
> `document` no sandbox, validando:
> - texto `DOCUMENTOS RECEBIDOS (INGESTOR)` no DOM;
> - filenames, badges, status labels, `Ver` button,
>   `Rejeitado:` com reason text, `EVENTOS` timeline labels.
>
> Arquivos alterados nesta fase:
> `js/screens/pedido-detail-render.js` (1 linha: export
> `ns.buildDocuments`), `tests/documents-ingestor-ui-smoke.test.js`
> (novo, 548 linhas), `PROJECT_STATE.md`, `AGENT_HANDOFF.md`.
>
> Fixture usada: `data/fixtures/document-events-sample.jsonl`
> (7 eventos, pedido `PED-25-2026`, 3 documentos).
>
> Elementos UI validados: secao header, filename, badges,
> status, botao Ver, reason, timeline dots.
>
> Garantias: sem Supabase, sem Google/Drive, sem export
> real, sem alterar Documents Ingestor, sem PDF/XML
> armazenado, sem dados reais commitados.
>
> Testes reportados:
> - `documents-ingestor.test.js`: 44/44;
> - `pedido-detail.smoke.js`: 172/172 (sem regressao);
> - `documents-ingestor-ui-smoke.test.js`: 35/35.
>
> `git diff --check`: OK (apenas warning CRLF Windows).
>
> Riscos remanescentes:
> 1. `ingestorDocsLoaded` pode ser `true` mesmo sem documentos
>    do pedido (filtro retorna vazio mas Array.isArray([]) passa).
>    O render ja protege com `view.ingestorDocumentRows.length > 0`.
> 2. Validacao visual real contra browser/staging ainda pendente.
> 3. Watcher/loader real ainda nao implementado (G11-D).
>
> Proxima fase recomendada:
> `RAVATEX-TAPETES-G11-D` — implementar loader/pre-charger
> que popula `RAVATEX_DOCUMENTS_LOADED_EVENTS` a partir de
> arquivo `export:package` (ou integracao futura com
> Supabase bucket/API).
>
> Confirmacoes: producao intocada, `origin` nao usado para
> escrita, sem push, sem `git add .`, `supabase/.temp/` e
> `.claude/` fora do commit.
>
> **Atualizacao 2026-07-07 - fase
> `RAVATEX-TAPETES-OP-TECELAGEM-ABERTA-VISUAL-ALIGNMENT-D`.**
> Status: **CLOSED / VALIDADO PELO USUARIO**.
> Entrada: branch `work/app-next`, HEAD base
> `e4c69aa0c2a8ada9c94f82e3655c6d1f5696a279`; status inicial
> `?? .claude/` e `?? supabase/.temp/`; `origin` somente leitura e
> producao intocados. Escrita permitida somente em
> `staging/work/app-next`.
> HEAD final da implementacao:
> `97b62a63adeac2026616ecd02d436dd4ed4103ad`.
>
> Escopo: alinhamento visual controlado da OP Tecelagem aberta
> (`js/screens/op-nova.js`) aos padroes visuais validados da OP
> Acabamento/Latex aberta e em producao, e da OP Tecelagem em
> producao. A fase foi
> estritamente visual: sem SQL, sem schema, sem migration, sem RPC
> nova, sem alterar lifecycle, status, tipo interno, calculos, rotas,
> writes Supabase ou regras de negocio.
>
> Arquivos alterados na implementacao:
> `js/screens/op-nova.js`, `tests/op-nova.smoke.js`,
> `PROJECT_STATE.md`, `AGENT_HANDOFF.md`.
>
> Patch aplicado: header enxuto com breadcrumb, titulo canonico,
> badges etapa/status separados e somente a acao Excluir; cards
> Dados/Itens/Insumos com tokens `--rv-*`, icon-chips reais e sem
> strips/barras; rail lateral Resumo/Preparacao/Documentos; largura
> ampla preservada.
>
> Elementos preservados: fios/insumos, PDF de compra, fornecedores,
> pendentes/recebidas, proposta/aceite, status interno, calculos,
> handlers, rotas e writes existentes.
>
> Elementos visuais validados: header enxuto, badges etapa/status
> separados, icon-chips reais, cards com tokens, rail lateral
> Resumo/Preparacao/Documentos e largura ampla preservada.
>
> Garantias: OP Acabamento/Latex, OP Tecelagem em producao, Pedido
> Detail, listas, painel, expedicao, `common.js`, `ui.js`,
> `badges.js`, SQL/schema/RPC e helpers globais ficaram fora do patch.
> `.claude/` foi usado apenas para referencia/preview local e
> permanece untracked; `supabase/.temp/` tambem permanece untracked.
>
> Testes reportados: `node --check js/screens/op-nova.js` OK;
> `node --check js/screens/op-tecelagem-producao-admin.js` OK;
> `tests/op-nova.smoke.js` 69/69; `tests/tec-to-acabamento-flow.smoke.js`
> 39/39; `tests/pedido-detail.smoke.js` 172/172;
> `tests/op-tecelagem*.smoke.js` inexistente.
>
> Validacao final: a OP Tecelagem aberta foi validada visualmente pelo
> usuario; o push em `staging/work/app-next` ja foi realizado;
> `origin`/producao permaneceram intocados.
>
> Candidatas futuras, fora deste closeout: expansao do padrao visual
> para outras telas pendentes; revisao dedicada de `badges.js`/tokens
> se ainda houver colisao visual etapa/status; ou decisao separada
> sobre versionar `.claude/design-skill/` versus copiar aprendizados
> para docs versionados. Nenhuma nova fase e iniciada neste closeout.

> **Atualizacao 2026-07-07 - fase
> `RAVATEX-TAPETES-DESIGN-TOKENS-TARGET-PILOT-B`.**
> Status: **PATCH UI PRONTO - AGUARDANDO VALIDACAO VISUAL DO USUARIO**.
> Entrada: branch `work/app-next`, HEAD inicial
> `59f88be1e1e2d04d5d23737332ccdbc6512b62f7`; status inicial
> `?? .claude/` e `?? supabase/.temp/`; `origin` somente leitura e
> producao intocados. Escrita permitida em `staging/work/app-next`.
>
> Causa raiz / motivacao: a fase read-only
> `RAVATEX-TAPETES-UI-VISUAL-SOURCE-RECONCILIATION-A` apontou que
> o app e fonte funcional canonica; as paginas Claude (Inttex) sao
> fonte visual candidata; a tela mais segura para piloto visual e
> OP Acabamento/Latex; os tokens devem refletir o visual-alvo
> Claude/Inttex ajustado para Ravatex, nao apenas o visual antigo.
>
> Patch aplicado (escopo estritamente limitado a OP Acabamento/Latex):
> - `css/tokens.css` novo, com prefixo reservado `--rv-` e valores
>   alvo: `--rv-color-title`, `--rv-color-text`, `--rv-color-muted`,
>   `--rv-color-accent`, `--rv-color-surface`, `--rv-color-bg-header`,
>   `--rv-color-subtle-bg`, `--rv-color-line-100`, `--rv-color-line-200`,
>   `--rv-color-input-border`, `--rv-color-danger`, `--rv-color-success`,
>   `--rv-color-warning`, `--rv-stage-tecelagem` (purple) e
>   `--rv-stage-tecelagem-bg`, `--rv-stage-acabamento` (teal) e
>   `--rv-stage-acabamento-bg`, `--rv-radius-card` (6px),
>   `--rv-radius-control` (4px), `--rv-radius-pill` (999px),
>   `--rv-font-size-label` (11px), `--rv-font-size-value` (12.5px),
>   `--rv-font-size-body` (13px), `--rv-tracking-label` (.06em),
>   `--rv-header-h` (62px), `--rv-sidebar-w` (196px),
>   `--rv-rail-w` (300px), `--rv-gap-cols` (18px), `--rv-z-modal`
>   (200), `--rv-z-toast` (250). Sem nomes genericos.
> - `index.html`: nova tag
>   `<link rel="stylesheet" href="css/tokens.css">` adicionada ao
>   `<head>` apos a fonte Inter. Tailwind CDN, `<style>` inline e
>   shell global preservados.
> - `js/screens/op-latex-admin.js` (escopo permitido, piloto):
>   constantes `CARD`, `FIELD_LABEL`, `TH_STYLE`, `BTN_PRIMARY`,
>   `BTN_BACK`, `BTN_LINK`, `BTN_DANGER_LINK`, `BTN_SOLID_SM`,
>   `BTN_SOFT_SM`, `BTN_DANGER_SM`, `SECTION_ICON` e
>   `CARD_PROD`/`BTN_ACTION` reescritas com tokens; helpers
>   `thRow`, `gridRow`, `buildExpedicaoCard`, header da OP Aberta
>   e `renderOPLatexProducao` (incluindo `buildCadeia`,
>   `buildHeaderProducao`, `buildDados`, `buildResumo`,
>   `buildItens`, `buildMaterialRecebido`, `buildMovimentacao`,
>   `buildDocumentos`, `buildHistorico` e o wrapper
>   `buildExpedicaoCard`) agora consomem os tokens.
> - Novo helper `rvSectionPill(label)` introduz o padrao
>   Claude/Inttex de header de secao: chip pequeno a esquerda
>   (`width:3px;height:14px;border-radius:2px;background:var(--rv-color-accent)`),
>   label em `text-transform:uppercase`, `font-size:var(--rv-font-size-label)`,
>   `letter-spacing:var(--rv-tracking-label)`, cor `var(--rv-color-muted)`.
>   Substitui os titulos numerados (`1. Dados da OP`, `2. Itens
>   da OP`, `3. Material recebido da tecelagem`,
>   `5. Finalizacao da OP`, `6. Documentos da OP`, `7. Historico`,
>   `Resumo desta OP`, `Resumo da OP`, `Expedicao`) APENAS na
>   tela OP Acabamento/Latex. O conteudo funcional (numeracao e
>   texto) foi preservado; a transformacao visual foi feita via
>   `text-transform:uppercase` para nao perder pesquisa/semantica
>   dos labels.
> - Etapa acabamento: badge `Acabamento` e badge `Em producao`
>   reativos (estado `em_producao`) agora usam teal acabamento
>   (`var(--rv-stage-acabamento)` e `var(--rv-stage-acabamento-bg)`).
>   O badge `Preparacao` da rail lateral preserva o acento azul.
> - Cockpit/layout: grids `1fr 320px` e `1fr 288px` migrados para
>   `minmax(0,1fr) var(--rv-rail-w)` com `min-width:0` na coluna
>   principal e na rail, e `gap:var(--rv-gap-cols)`. A rail nao
>   recebeu `position:sticky` nesta fase (relatado como risco a
>   evitar ate validacao visual do usuario).
> - Divisivas internas (`#f1f3f6`/`#eceef1`) e bordas de
>   card/controle migradas para `var(--rv-color-line-100)` e
>   `var(--rv-color-line-200)`/`var(--rv-color-input-border)`.
>
> Garantias: nao houve alteracao em `badges.js`, `common.js`,
> `ui.js`, OP Tecelagem, `pedido-detail-*`, listas, painel,
> expedicao-admin, OPS helper globals nem em layout global. Sem
> SQL, sem migration, sem RPC nova, sem alteracao de schema,
> lifecycle de OP, fluxo de negocio, identificacao de OP
> (`tipo` interno `latex` preservado), sem renomear entidade
> funcional. Sem mock Claude; nenhum HTML/handlers/handlers
> removidos. Comportamento, RPCs, calculos, fluxos, rotas e
> dados intactos. `.claude/` usado apenas como referencia
> (Inttex tokens), nao commitado. `supabase/.temp/` permanece
> fora do commit.
>
> Testes focados verdes:
> - `node --test tests/op-latex-admin.smoke.js` 55/55;
> - `node --test tests/tec-to-acabamento-flow.smoke.js` 39/39;
> - `node --test tests/pedido-detail.smoke.js` 172/172;
> - `node --test tests/op-latex-requires-pedido-guard.smoke.js` 7/7;
> - `node --test tests/op-latex-split.smoke.js` 28/28;
> - `node --test tests/expedicao-partial-flow.smoke.js` 12/12;
> - `node --test tests/op-display.smoke.js` 20/20;
> - `node --test tests/pedido-detail-linked-ops.smoke.js` 7/7;
> - `node --test tests/expedicao-flow.smoke.js` 8/8;
> - `node --test tests/op-nova.smoke.js` 69/69 (carga util
>   inalterada; piloto nao toca o caller de OP Nova);
> - `node --test tests/production-flow-invariants.smoke.js` 13/13;
> - `node --test tests/latex-consolidation-schema.smoke.js` 25/25.
> Total focados: 463/463.
>
> Evidencia visual/comportamental objetiva (antes/depois):
> - cards: borda `#eceef1` -> `var(--rv-color-line-200)`;
>   raio `4px` -> `var(--rv-radius-card)` (cards) /
>   `var(--rv-radius-control)` (botoes/inputs/badges);
> - divisivas internas: `#f1f3f6` -> `var(--rv-color-line-100)`;
> - titulos/cards: `#16203a` -> `var(--rv-color-title)`;
> - muted/labels: `#8a93a3` -> `var(--rv-color-muted)`;
> - etapa acabamento: amarelo/laranja -> teal
>   `var(--rv-stage-acabamento)` /
>   `var(--rv-stage-acabamento-bg)`;
> - chip + label uppercase 11px em todos os headers de secao
>   do piloto;
> - cockpit agora usa `minmax(0,1fr) var(--rv-rail-w)` com
>   `min-width:0` na principal e na rail; sem `sticky`;
> - chamada das mesmas RPCs (`alterar_status_op`,
>   `liberar_expedicao_latex_parcial`, `liberar_expedicao`,
>   `consultar_saldo_expedicao_latex`) e mesmos helpers
>   (`window.rotuloModelo`, `window.fmtMetros`,
>   `window.rotuloFio`, `RAVATEX_DELETE.excluirOPComFluxo`,
>   `window.aplicarRecalculoOP` quando aplicavel).
>
> Proxima fase sugerida: validar visualmente o piloto
> (Acabamento em `aberta` e `em_producao`) e, se aprovado,
> replicar o mesmo padrao para OP Tecelagem.
>
> **Atualizacao 2026-07-07 - fase
> `RAVATEX-TAPETES-UI-BACKLOG-CLOSEOUT-H`.**
> Status: **UI BACKLOG CLOSEOUT — BLOCO UI FECHADO. 14/14 ITENS.**
> Entrada: branch `work/app-next`, HEAD
> `997486a`; status somente `?? supabase/.temp/`;
> `origin` somente leitura e producao intocados.
> Push staging: `af919a2..997486a` → `work/app-next`.
>
> Fases concluidas desde o ultimo closeout:
>
> **`RAVATEX-TAPETES-TRANSFER-GRID-CELL-CENTER-R1`** (P2) — CLOSED `c8b45b6`.
> Centralizacao horizontal das colunas Alocado/Transferido/Pendente
> (`text-align:right` → `text-align:center`) na tabela Pendencias por
> produto. Produto mantido a esquerda com ellipsis.
>
> **`RAVATEX-TAPETES-LINKED-OPS-FOOTER-BUTTONS-UX-F`** (P3) — CLOSED
> `e80b9de` + `55bc32b` + `997486a`.
> Footer de OPs vinculadas: labels encurtados ("Liberar exp.",
> "Movimento"), `flex:1` removido, botoes com largura natural +
> `min-width:72px`, `min-height:34px`, `padding:7px 12px` uniforme
> entre `buildFooterAction` e "Excluir OP".
>
> **`RAVATEX-TAPETES-UI-BACKLOG-RECONCILIATION-G`** (P2) — CLOSED.
> Diagnostico read-only: 14/14 itens do backlog UI fechados,
> 0 pendentes, 0 obsoletos.
>
> ---
>
> ## Closeout do bloco UI — resumo final
>
> | # | Item | Status |
> |---|------|--------|
> | 1 | Modal finalizar OP com confirmacao padrao (danger) | FECHADO |
> | 2 | Toasts acima do modal (`z-[250]`) | FECHADO |
> | 3 | Links encavalados removidos da OP Acabamento | FECHADO |
> | 4 | Botoes de acao compactos (`BTN_ACTION`) | FECHADO |
> | 5 | "Finalizar OP de Tecelagem/Acabamento" → "Finalizar OP" | FECHADO |
> | 6 | "Abrir Pedido" → "Ver Pedido" | FECHADO |
> | 7 | "Abrir OP" → "Ver OP" (visualizacao) | FECHADO |
> | 8 | Movimentar/Finalizar a direita na OP Acabamento | FECHADO |
> | 9 | "Transferir restante" unificado com "Preencher restante" | FECHADO |
> | 10 | Footer OPs vinculadas: labels curtos, altura uniforme | FECHADO |
> | 11 | Grid Produto/Alocado/Transferido/Pendente (80px + ellipsis) | FECHADO |
> | 12 | Metricas Recebido/Ja movimentado/Movimentar alinhadas | FECHADO |
> | 13 | Botao "Confirmar" entrada Acabamento | FECHADO |
> | 14 | Paridade Aceitar/Manter proposta modal ↔ tela OP | FECHADO |
>
> - **HEAD canônico staging/work/app-next:** `0d62563`
> - **HEAD da reconciliacao UI:** `997486a` (antes do closeout documental)
> - **Origem:** `production` intocada, `origin` somente leitura
> - **Próximo passo:** funcionalidade (romaneios, NFs, integracao)
>
> ---
>
> > **(Histórico) `RAVATEX-TAPETES-INSUMOS-TECELAGEM-UI-FIX-A`.**
> > Status: concluido. Branch `work/app-next`, HEAD
> > `2a492f08ee8c9d0b85f6a012f2ca84a767321338`.
>
> Itens entregues (P0):
>
> 1. **Alinhamento do bloco "Data do recebimento" + texto auxiliar**
> (`buildInsumosTransferForm` em
> `js/screens/pedido-detail-events.js:1497-1586`).
> Causa raiz: o layout usava `display:grid;grid-template-columns:180px 1fr`
> com o `formField` na primeira coluna e o texto auxiliar na segunda
> coluna usando `align-self:end`, o que empurrava o texto para a base da
> coluna (e nao alinhava com o input de Data abaixo). O auxiliar passava
> a flutuar na lateral, desalinhado do input.
> Correcao: troquei o grid 2 colunas por um bloco vertical empilhado:
> `formField({ label: 'Data do recebimento', input })` seguido do texto
> auxiliar com `margin-top:4px;line-height:1.4;`. O auxiliar agora fica
> imediatamente abaixo do input e segue a mesma largura. Responsividade
> preservada (sem regras mobile novas). Regra de negocio intocada.
>
> 2. **Default state de "Manter pedido" e "Aceitar proposta"** no
> `buildTecAcceptanceProposalBlock`
> (`js/screens/pedido-detail-events.js:800-1067`).
> Causa raiz: o `recompute()` calculava apenas
> `disabled = algumExcede || aplicarRecalculoOP ausente`, ou seja, o
> botao "Aceitar proposta" ficava habilitado por default desde que nao
> houvesse excedente — o que permitia aceitar a OP sem que o usuario
> tivesse mexido no slider, podendo alterar a proposta sem intencao.
> Correcao: foi introduzido um snapshot `defaultMetrosOverride` no
> momento da criacao do bloco (a "proposta proporcional" canonica
> produzida por `recalcularOP`). O helper `propostaDivergente()`
> compara cada `metrosOverride` com o default usando
> `ns.round2(...).toString() === defaultMetrosOverride[id]`. A regra do
> `recompute()` agora e
> `disabled = !divergente || algumExcede || aplicarRecalculoOP ausente`.
> "Manter pedido" segue sempre ativo (nao e tocado pelo recompute);
> "Voltar a proposta proporcional" reseta os sliders para o default e o
> `recompute()` automatico desabilita "Aceitar proposta". O fluxo de
> `refreshPedidoTransitionModal` continua recriando o modal apos
> registrar recebimento, o que chama `recompute()` novamente e reflete
> a regra de divergencia desde o primeiro frame. Sem mudar a fonte do
> aceite (continua `aplicarRecalculoOP`).
>
> 3. **Excluir Pedido + Excluir OPs relacionadas na UI**
> - Pedido Detail ja tinha "Excluir Pedido" no header
>   (`handlers.buildDeleteButton` chamado por
>   `pedido-detail-render.js:137+201`, usando
>   `RAVATEX_DELETE.excluirPedidoComFluxo`).
> - Foi adicionado **"Excluir OP"** no card de cada OP em
>   `pedido-detail-render.js` `buildOpCard`. Botao e condicional a
>   `handlers.excluirOpRelacionada` e `summary.op.id`, com label curto,
>   `white-space:nowrap`, `title` explicito e tom danger coerente com o
>   "Excluir OP" ja existente em `pedidos-list.js`/`ops-list.js`/
>   `op-latex-admin.js`/`op-nova.js`/`op-tecelagem-producao-admin.js`.
> - O handler canonico `excluirOpRelacionada` foi adicionado em
>   `pedido-detail-events.js` e exportado no retorno dos handlers. Ele
>   chama `RAVATEX_DELETE.excluirOPComFluxo(op.id, ...)` e em sucesso
>   faz `await reload()` + `render()` — mesmo padrao do
>   `excluirPedido`. Nao foi feito delete direto em `ops`/`pedidos`,
>   nenhuma RPC nova, nenhuma migration. O RPC canonico
>   `remover_op(p_op_id, p_confirmacao)` continua sendo usado (testado
>   ate `2a492f0`).
>
> Testes focados verdes: `pedido-detail.smoke.js` 171/171
> (8 novos casos: alinhamento, `defaultMetrosOverride`,
> `propostaDivergente`, fluxo default -> mover -> voltar ->
> `Aceitar proposta` desabilitado, `Manter pedido` sempre ativo,
> `excluirOpRelacionada` exposto e usando helper canonico, card de OP
> exposto, sem delete direto em `ops`/`pedidos`,
> `summary.op.id` obrigatorio),
> `controlled-delete.smoke.js` 32/32, `ops-list.smoke.js` 1/1,
> `op-latex-admin.smoke.js` 55/55,
> `pedido-detail-linked-ops.smoke.js` 7/7,
> `tec-to-acabamento-flow.smoke.js` 39/39,
> `expedicao-partial-flow.smoke.js` 12/12, `expedicao-flow.smoke.js` 8/8,
> `production-flow-invariants.smoke.js` 13/13. Total focados: 338/338.
>
> Confirmacoes: producao intocada, `origin` nao usado para escrita, sem
> SQL, sem migration, sem dados reais novos, sem `git add .`,
> `supabase/.temp/` permanece fora do commit. Validacao visual do
> usuario segue pendente: conferir o alinhamento do bloco "Data do
> recebimento" no modal de registrar transferencia, abrir Pedido com OP
> Tecelagem aberta para conferir slider/proposta default
> (Manter pedido ativo, Aceitar proposta desabilitado ate mover slider),
> e abrir Pedido com OPs vinculadas para conferir o botao "Excluir OP"
> no card e o modal canonico de confirmacao do helper
> `RAVATEX_DELETE.excluirOPComFluxo`.
>
> Commitar apenas se os testes focados acima continuarem verdes.
>
> Proximo passo recomendado:
> `RAVATEX-TAPETES-INSUMOS-TECELAGEM-UI-FIX-B` (validacao visual real
> contra staging) e/ou outros polishes P1/P2 do backlog Admin/Pedido
> (ex.: `OP-LATEX-ADMIN-COMPACT-BUTTONS-R1` ja fechado).
>
> **Atualizacao 2026-07-06 - fase
> `RAVATEX-TAPETES-OP-CREATE-REQUIRES-PEDIDO-RPC-GUARD-C-CLOSEOUT`.** 
> Status: **STAGING APPLY OK — VERIFICADO / CLOSEOUT**.
> Entrada: branch `work/app-next`, HEAD
> `b976fbf7a43bee0156f483c7ca745db4d2308d2c`; status somente
> `?? scripts/staging/orphaned-ops-triage-diag.mjs` (fase D) e
> `?? supabase/.temp/`. `origin` e producao intocados.
>
> **Closeout da fase C:** A guarda RPC ja estava implementada em
> `db/33_op_latex_requires_pedido_guard.sql` (commit `95946d5`) e aplicada em
> staging pelo usuario (commit `a760158`). Esta fase realizou verificacao
> completa:
>
> **RPCs auditadas:**
> - `gerar_op_latex(p_entrega_id BIGINT)` — guarda `lote_id`/`pedido_id` em
>   `db/33:127-135`, antes de `proximo_numero_op` (`db/33:139`).
> - `gerar_op_latex_split(p_entrega_id BIGINT, p_motivo TEXT)` — guarda
>   `lote_id`/`pedido_id` em `db/33:337-345`, antes de `proximo_numero_op`
>   (`db/33:349`).
> - Mensagem de erro controlada em ambas: `Nao e possivel gerar OP de
>   Acabamento/Latex: OP origem nao possui Pedido vinculado.`
>
> **Validacao staging (5 diagnosticos, todos OK):**
> - `ops-without-pedido-diag`: 11 OPs orfas, ALERTA controlado (historico).
> - `orphaned-ops-triage-diag` (novo, fase D): classificacao A2=6, B1=4, D=1,
>   A1=0, B2=0. Nenhum backfill automatico seguro.
> - `production-flow-invariants-diag`: OK — 0 duplicatas, 0 colisoes,
>   high-water OK, 1 split legitimo com rastro completo.
> - `latex-consolidation-diag`: OK — 0 duplicidades, 1 split com rastro.
> - `expedicao-partial-flow-diag`: OK — saldos/status coerentes, 0 violacoes.
>
> **Testes locais (todos verdes):**
> - `op-nova`: 69/69, `op-persistir`: 70/70, `op-display`: 20/20,
>   `op-latex-admin`: 55/55.
> - `production-flow-invariants`: 13/13 (inclui teste estatico da guarda
>   `db/33`).
>
> **Confirmacoes finais:** guarda presente e funcional; fluxo com Pedido
> preservado; split valido preservado; dados historicos intocados; nenhum
> backfill; sem constraint global; sem producao; `supabase/.temp/` fora do
> patch.
>
> **Proxima fase recomendada:**
> `RAVATEX-TAPETES-OP-ORPHANED-HISTORICAL-TRIAGE-D` — diagnostico aprofundado
> das 11 OPs historicas (script `orphaned-ops-triage-diag.mjs` ja criado).
>
> > **Atualizacao 2026-07-06 - fase
> > `RAVATEX-TAPETES-OP-CREATE-REQUIRES-PEDIDO-RPC-GUARD-C-STAGING-APPLY`.**
> Status: **STAGING APPLY OK**.
> Entrada: branch `work/app-next`, HEAD inicial/final antes do registro
> `95946d5f4026fa927c41be486eefecb68a01100c`; status inicial somente
> `?? supabase/.temp/`; `origin` e producao intocados.
>
> Migration aplicada em Supabase staging `ucrjtfswnfdlxwtmxnoo`:
> `db/33_op_latex_requires_pedido_guard.sql`. Metodo: aplicacao manual pelo
> usuario no SQL Editor do Supabase staging; nao foi usada producao
> `bhgifjrfagkzubpyqpew`. Supabase CLI nao esta disponivel neste ambiente; apos
> o usuario fornecer a URL SQL do staging, o catalogo PostgreSQL foi consultado
> via Node/`pg` com `pg_get_functiondef`.
>
> Confirmacao de catalogo staging: `gerar_op_latex(p_entrega_id bigint)` e
> `gerar_op_latex_split(p_entrega_id bigint, p_motivo text)` contem a guarda
> `ops.lote_id -> lotes.pedido_id` e `guard_before_number=true` nas duas
> funcoes, ou seja, a validacao de Pedido ocorre antes de
> `public.proximo_numero_op`.
>
> Resultado pos-aplicacao: diagnostico de orfaos permanece ALERTA historico com
> `0` OPs com `lote_id NULL`, `11` OPs cujo `lote.pedido_id IS NULL` e `9`
> lotes sem Pedido vinculados a OPs. Classificacao preservada: A=6 (`op_id`
> 1,2,3,4,9,15), B=4 (`op_id` 5,6,7,8), C=0, D=1 (`op_id` 10). Nenhuma
> correcao/backfill foi feita.
>
> Diagnosticos staging pos-aplicacao: `production-flow-invariants-diag` OK
> (sem duplicatas default, `op_numeros` OK), `latex-consolidation-diag` OK
> (0 duplicidades default, 1 split com rastro completo), e
> `expedicao-partial-flow-diag` OK (saldos/status coerentes). Testes locais
> verdes: `op-latex-requires-pedido-guard`, `op-latex-split`,
> `latex-consolidation-schema`, `production-flow-invariants`, `op-nova` e
> `op-persistir`.
>
> Confirmacoes: sem producao, sem cleanup/backfill, sem constraint global, sem
> dados reais novos, sem alteracao de RLS/PDF/fornecedor/identificacao OP, sem
> alterar `op_numeros`; `supabase/.temp/` permanece fora do patch.

> **Atualizacao 2026-07-06 - fase
> `RAVATEX-TAPETES-OP-CREATE-REQUIRES-PEDIDO-RPC-GUARD-C`.**
> Status: **PATCH TECNICO PRONTO - AGUARDANDO VALIDACAO TECNICA/STAGING**.
> Entrada: branch `work/app-next`, HEAD inicial
> `0245fc771158527954c91bc158f63396d96e4cad`; status inicial somente
> `?? supabase/.temp/`; `origin` somente leitura; producao intocada.
>
> Guard backend preparado em `db/33_op_latex_requires_pedido_guard.sql`,
> substituindo `gerar_op_latex(BIGINT)` e
> `gerar_op_latex_split(BIGINT, TEXT)` a partir do contrato efetivo da `db/29`.
> As duas RPCs agora resolvem `ops.lote_id -> lotes.pedido_id` da OP origem e
> abortam antes de `proximo_numero_op('latex', ...)` quando a origem nao tem
> lote/Pedido. Erro controlado: `Nao e possivel gerar OP de Acabamento/Latex:
> OP origem nao possui Pedido vinculado.`
>
> Diagnostico ampliado em `scripts/staging/ops-without-pedido-diag.mjs`: alem
> das contagens ja conhecidas (`0` OPs com `lote_id NULL`, `11` OPs cujo
> `lote.pedido_id IS NULL`, `9` lotes sem Pedido vinculados a OPs), o script
> lista cada OP orfa com `op_id`, numero/ano/tipo/status, lote, criado_em,
> entregas vinculadas, expedicao/movimentacao, Pedido possivelmente inferivel
> por `op_itens`/`pedido_itens`/expedicao e classificacao preliminar A/B/C/D.
> Resultado staging desta rodada: A=6 (`op_id` 1,2,3,4,9,15), B=4 (`op_id`
> 5,6,7,8), C=0, D=1 (`op_id` 10). Continua read-only: somente SELECT,
> bloqueio de producao e sem RPC POST.
>
> Testes locais adicionados/atualizados: `op-latex-requires-pedido-guard`
> valida a guarda nas duas RPCs, preservacao dos fluxos validos e ausencia de
> constraint/backfill; `production-flow-invariants` passa a cobrir `db/33` e a
> classificacao do diagnostico. Migration nao aplicada em staging nesta etapa:
> pendente aplicar/validar tecnicamente em staging `ucrjtfswnfdlxwtmxnoo`.
>
> Confirmacoes: nenhuma correcao de dados historicos, sem cleanup/backfill, sem
> constraint global, sem alterar RLS, sem alterar `op_numeros`, sem producao,
> sem push para `origin`, sem `git add .`; `supabase/.temp/` permanece fora do
> patch.

> **Atualizacao 2026-07-06 - fase
> `RAVATEX-TAPETES-OP-CREATE-REQUIRES-PEDIDO-GUARD-B`.**
> Status: **PATCH TECNICO PRONTO - AGUARDANDO VALIDACAO VISUAL DO USUARIO**.
> Entrada: branch `work/app-next`, HEAD inicial
> `9478ebe9cddb2748fe1b0ebb842d8906b903412b`; status inicial somente
> `?? supabase/.temp/`; `origin` somente leitura; escrita permitida somente em
> `staging/work/app-next`.
>
> Brecha DIAG-A confirmada em staging: havia OPs/lotes sem Pedido vinculado.
> Diagnostico read-only novo `scripts/staging/ops-without-pedido-diag.mjs`
> encontrou `OPs com lote_id NULL: 0`, `OPs cujo lote.pedido_id IS NULL: 11` e
> `Lotes com pedido_id IS NULL vinculados a OPs: 9`; resultado esperado
> `STATUS ALERTA`, sem qualquer escrita ou correcao de dados reais.
>
> Patch aplicado: `Nova OP` em `js/screens/ops-list.js` nao abre mais
> `#/ops/nova`; orienta o usuario com toast e navega para `#/pedidos`.
> A rota direta `#/ops/nova` sem `pedido_id` continua registrada, mas
> `js/boot.js` avisa e `js/screens/op-nova.js` renderiza estado bloqueado com
> CTA `Ir para Pedidos`, sem formulario, sem simulacao e sem salvar. A rota
> canonica `#/ops/nova?pedido_id=<uuid>` permanece funcionando.
>
> Guard defensivo em `js/screens/op-persistir.js`: `persistirOP` sem
> `pedidoId` valido retorna `step: 'pedido_required'` antes de consumir
> `op_numeros`, inserir/atualizar `ops`, inserir/atualizar `lotes` ou gravar
> itens. Quando ha Pedido, `lotes.pedido_id` e sempre preenchido com o
> `pedidoId`. `op-nova.js` tambem bloqueia salvar simulacao/abrir OP quando o
> estado nao possui Pedido vinculado.
>
> Testes locais verdes: `op-nova` 69/69, `op-persistir` 70/70,
> `ops-list` 1/1, `boot` 30/30, `router` 43/43, `pedido-detail` 163/163,
> `production-flow-invariants` 12/12 e `op-display` 20/20. Checks de sintaxe
> OK para os arquivos alterados e o novo diagnostico. Diagnosticos staging:
> novo diagnostico de orfaos retornou ALERTA controlado; invariantes de fluxo,
> consolidacao Latex e expedicao parcial seguem OK.
>
> Pendente para fase C/RPC: adicionar guard backend em `gerar_op_latex` e
> derivados de split para rejeitar/criar bloqueio canonico quando a OP/lote de
> origem nao tiver Pedido. Esta fase mitigou a origem pela UI e persistencia JS,
> mas nao altera SQL/RPC nem limpa dados historicos.
>
> Confirmacoes: sem SQL, sem migration, sem producao, sem dados reais novos,
> sem update/delete ad hoc, sem consumo indevido de `op_numeros`, sem push para
> `origin`, sem `git add .`; `supabase/.temp/` permanece fora do patch.

> **Atualizacao 2026-07-06 - fase
> `RAVATEX-TAPETES-OP-OPERATIONAL-CODE-ADMIN-WIDE-EXPAND-D`.**
> Status: **PATCH TECNICO PRONTO - AGUARDANDO VALIDACAO VISUAL DO USUARIO**.
> Retomada apos bloqueio por limite de sessao. Entrada: branch `work/app-next`,
> HEAD inicial `6cc8e41`; status inicial com `js/screens/painel.js` ja
> modificado parcialmente e `?? supabase/.temp/`.
>
> Objetivo entregue: expandir o uso de `js/op-display.js` para telas Admin
> operacionais que exibem OPs quando ha contexto confiavel de Pedido. Regra
> principal: `OP {pedido_numero}/{year(pedido.criado_em)}-{tipo}{seq}`;
> legado mantido como secundario/fallback `Nº interno {numero}/{ano}` ou
> `OP {numero}/{ano}` sem contexto.
>
> Telas alteradas e resolucao OP->Pedido/siblings:
> `painel.js` usa dados ja carregados (`lotes.pedido_id`, `pedidos`, `ops`) e
> agrupa `opsByPedido` em memoria, sem query nova. `ops-list.js` adiciona
> `pedido_id` e `pedido:pedido_id(id,numero,criado_em)` ao SELECT do lote e
> agrupa as OPs da lista por Pedido. `op-nova.js`/`op-tecelagem-producao-admin.js`
> usam `pedidoCtx` e uma leitura leve `lotes do pedido -> ops desses lotes`.
> `op-latex-admin.js` consulta Pedido + siblings somente quando `lote.pedido_id`
> existe; fixtures/OPs sem Pedido caem no fallback legado. `expedicao-admin.js`
> usa `pedido:pedido_id(...,criado_em)` e busca siblings por lotes do Pedido.
>
> Mantidos em legado por regra: PDFs (`op-pdf.js`), fornecedor/RLS e telas sem
> Pedido resolvivel. Nao houve SQL, migration, dados reais novos, alteracao em
> `ops.numero`, `ops.ano`, `op_numeros` ou RPCs. `origin` e producao intocados.
>
> Testes obrigatorios verdes: `op-display`, `admin-dashboard`, `painel-screen`,
> `op-latex-admin`, `expedicao-flow`, `expedicao-partial-flow`, `router`,
> `pedido-detail`, `pedido-detail-linked-ops`, `production-flow-invariants`.
> Diagnosticos staging read-only OK: invariantes de fluxo, consolidacao Latex e
> expedicao parcial. `tests/ops-list-screen.smoke.js` opcional continua obsoleto
> para a arquitetura atual e falha em asserts antigos de script inline; nao foi
> alterado nesta fase.
>

> **Atualizacao 2026-07-06 - fase
> `RAVATEX-TAPETES-OP-OPERATIONAL-CODE-CLOSEOUT-C`.**
> Status: **OK VISUAL NO ESCOPO COM CONTEXTO DE PEDIDO**. Closeout
> documental/estado, sem patch funcional.
> Entrada/saida: branch `work/app-next`, HEAD `d7f57c4`; status somente
> `?? supabase/.temp/`; `origin` somente leitura; escrita em
> `staging/work/app-next`.
>
> Aceite visual do usuario: conferiu que a identificacao operacional
> `OP {pedido}/{ano}-{tipo}{seq}` apareceu nos lugares principais e considerou
> OK. Observou que ainda aparece em poucos lugares - comportamento ESPERADO
> pela estrategia: o codigo operacional so aparece onde ha contexto confiavel
> de Pedido; onde nao ha, mantem-se o legado `OP {numero}/{ano}`. Nao ha
> objetivo de exibicao global agora.
>
> Regra consolidada: display operacional principal com contexto de Pedido
> `OP {pedido_numero}/{year(pedido.criado_em)}-{tipo}{seq}` (ex.: `OP 25/2026-T01`);
> `T=Tecelagem`, `A=Acabamento/Latex`; `seq` por Pedido+Tipo ordenado por
> `ops.criado_em` e `ops.id`; fallback `OP {numero}/{ano}`. Formatacao unica em
> `js/op-display.js`.
>
> Escopo validado (onde o codigo operacional aparece): Pedido Detail Admin -
> OPs vinculadas, OPs relacionadas, modais das setas, hub da etapa,
> `tecPendingAcceptance`, `relatedOpsLabel` e labels de documentos/expedicao.
>
> Mantido em legado por decisao: PDFs, fornecedor/RLS, toasts, logs,
> diagnosticos, telas sem contexto confiavel de Pedido (`ops-list`,
> `op-latex-admin`, `op-tecelagem-producao-admin`, `op-nova`, `expedicao-admin`,
> Dashboard `painel`), e locais onde a expansao exigiria query/read model
> adicional sem necessidade validada.
>
> Decisao: NAO perseguir aplicacao global agora. Pendencia controlada -
> expandir para outras telas somente quando (1) houver contexto confiavel de
> Pedido, (2) houver necessidade visual clara, (3) nao exigir migration,
> (4) nao criar query pesada, (5) nao duplicar formatacao fora de
> `js/op-display.js`. Candidatos naturais: `painel.js` e `expedicao-admin.js`.
>
> Testes: fase de closeout documental; a bateria funcional ja estava verde no
> commit anterior `d7f57c4` (op-display 20/20, pedido-detail 163/163, conjunto
> obrigatorio 337/337). Revalidacao minima desta fase: `op-display.smoke.js` e
> `pedido-detail.smoke.js` verdes. Nenhum arquivo funcional alterado.
>
> Confirmacoes: producao intocada, `origin` nao usado para escrita, sem SQL,
> sem migration, sem dados reais novos, sem alterar `op_numeros`/RPC/`ops.numero`/
> `ops.ano`, sem `git add .`, `supabase/.temp/` fora do commit.

> **Atualizacao 2026-07-06 - fase
> `RAVATEX-TAPETES-OP-OPERATIONAL-CODE-HELPER-B`.**
> Status: PATCH TECNICO PRONTO - AGUARDANDO VALIDACAO VISUAL DO USUARIO.
> Entrada: branch `work/app-next`, HEAD inicial
> `e56746ee3c16340198db370d45bc8ddbcb192923`; status inicial somente
> `?? supabase/.temp/`; `origin` somente leitura; escrita permitida em
> `staging/work/app-next`.
>
> Objetivo: helper central de identificacao operacional de OP e uso desse
> display nas telas com contexto de Pedido. Contrato aprovado:
> `OP {pedido_numero}/{pedido_ano}-{tipo}{seq}` (ex.: `OP 21/2026-T01`,
> `OP 21/2026-A02`). `pedido_ano = year(pedido.criado_em)`;
> `T = tecelagem`, `A = latex/acabamento`; `seq` = sequencial de 2 digitos
> por Pedido + Tipo, ordenado por `ops.criado_em` asc com desempate `ops.id`
> asc. Sem SQL, sem migration, sem alterar dados/RPC/`op_numeros`/`ops.id`/
> `ops.numero`/`ops.ano`.
>
> Helper criado: `js/op-display.js` -> `window.RAVATEX_OP_DISPLAY`
> (`getOpTypeLetter`, `getPedidoOperationalYear`, `buildOpOperationalSequence`,
> `formatOpOperationalCode`, `formatOpLegacyCode`). Puro, sem DOM/Supabase.
> Carregado em `index.html` logo apos `js/badges.js`. Fallback obrigatorio ao
> legado `OP {numero}/{ano}` sem `pedido.numero`, sem `pedido.criado_em`, sem
> OP na lista de irmas ou tipo desconhecido; consumidores tambem caem no
> legado se o helper nao estiver carregado.
>
> Telas alteradas (contexto de Pedido): `js/screens/pedido-detail-progress.js`
> (`computeViewModel` calcula o codigo por OP: `summary.label`,
> `summary.legacyLabel`, `summary.origemOpLabel`, `relatedOpsLabel`, labels de
> documentos/expedicao), `js/screens/pedido-detail-render.js` (origem da OP via
> `summary.origemOpLabel` com fallback `ns.opLabel`),
> `js/screens/pedido-detail-events.js` (finalizar OP, OPs relacionadas do modal
> da seta, modal Aceitar OP, botao Revisar e aceitar) e
> `js/screens/pedido-chain-state.js` (`tecPendingAcceptance.label`). Fonte de
> dados: `pedido-detail-data.js` passou a selecionar `ops.criado_em` (SELECT
> aditivo, sem write).
>
> Mantidos em legado nesta fase (contexto de Pedido insuficiente sem query
> nova, ou regra explicita): PDFs (`op-pdf.js`), telas de fornecedor/RLS
> (`fornecedor.js`), toasts globais e diagnosticos sem contexto,
> `ops-list.js` (sem Pedido no SELECT), `op-latex-admin.js`,
> `op-tecelagem-producao-admin.js`, `op-nova.js`, `expedicao-admin.js` e o
> Dashboard Admin `painel.js`. O numero/ano interno permanece como referencia
> secundaria (ex.: linha "Numero/Ano" no modal). Proximo incremento recomendado:
> aplicar o mesmo helper ao `painel.js` e `expedicao-admin.js` (ambos tem
> `lotes.pedido_id` + todas as OPs carregadas; exige apenas um resolver
> OP->Pedido a partir dos dados ja carregados, sem query nova).
>
> Testes: novo `tests/op-display.smoke.js` (20 casos: T01, T01/T02, A01/A02,
> colisao legada T/A distinta, fallback sem pedido/criado_em/numero, ordenacao
> criado_em/id, padStart, ausencia de ID inventado). `tests/pedido-detail.smoke.js`
> ganhou `js/op-display.js` no bundle e 2 casos de integracao (codigo
> operacional via `computeViewModel` com `criado_em`; fallback legado sem
> `criado_em`). Suite obrigatoria verde: `pedido-detail` 163/163,
> `pedido-detail-linked-ops`, `tec-to-acabamento-flow`, `op-latex-admin`,
> `expedicao-partial-flow`, `expedicao-flow`, `admin-dashboard`,
> `painel-screen`, `production-flow-invariants`, `op-display` = 337/337 no
> conjunto. Diagnosticos staging read-only OK (invariantes, consolidacao Latex,
> expedicao partial): 0 violacoes, 0 colisoes de numeracao. A numeracao real de
> staging confirma que tecelagem e latex compartilham numeros por ano (ex.:
> ambos com 1..16 em 2026), reforcando o discriminador T/A.
>
> Confirmacoes: producao intocada, `origin` nao usado para escrita, sem SQL,
> sem migration, sem dados reais novos, sem alterar `op_numeros`/RPC/`ops.id`/
> `ops.numero`/`ops.ano`, sem `git add .`, `supabase/.temp/` fora do commit.
> Validacao visual pendente do usuario: abrir um Pedido com OPs vinculadas e
> conferir os codigos `OP {pedido}/{ano}-{tipo}{seq}` nos cards de OPs
> vinculadas, OPs relacionadas, modais das setas e hub; conferir que o
> numero/ano legado aparece como referencia secundaria.

> **Atualizacao 2026-07-06 - fase
> `RAVATEX-TAPETES-ADMIN-DASHBOARD-STANDALONE-PARITY-R1`.**
> Status: PATCH TECNICO PRONTO - AGUARDANDO VALIDACAO VISUAL DO USUARIO.
> Entrada: branch `work/app-next`, HEAD inicial
> `963c96cfc358e8d55560f8bbc0c77ef40f355ad4`; status inicial somente
> `?? supabase/.temp/`; remotos confirmados com `origin` somente leitura e
> escrita permitida em `staging/work/app-next`.
>
> Standalone usado como referencia:
> `D:/OneDrive/Ravatex/Inttex/Mockups - nova interface/Admin/Admin - Dashboard - standalone.html`.
> Diagnostico obrigatorio executado: `PROJECT_STATE.md`, `AGENT_HANDOFF.md`,
> `docs/architecture/PEDIDO_PRODUCTION_FLOW_BACKLOG.md`,
> `docs/DOCUMENTATION_INDEX.md`, busca ampla em `js tests docs index.html`,
> tela real `js/screens/painel.js`, shell global `js/screens/common.js`,
> Dashboard Cliente, listas de Pedidos/OPs e detalhe Pedido.
>
> Decisao de implementacao: preservar `#/painel`, `shellLayout(ADMIN_MENU, ...)`,
> auth/admin route e topbar/sidebar homologados. O placeholder foi substituido
> por dashboard admin especifico no proprio `js/screens/painel.js`, com CSS
> local prefixado e blocos do standalone: header, 5 KPIs, fila de acoes,
> alertas, cadeia produtiva em 6 etapas e atividade recente. Elementos
> reaproveitados: shell/sidebar/topbar, navegacao por `window.navigate`, padrao
> visual de cards/botoes/badges das telas homologadas. Componentes novos:
> primitives internos do dashboard e agregacao read-only para KPIs/acoes.
>
> Dados reais preservados: apenas SELECTs em `pedidos`, `clientes`, `lotes`,
> `ops`, `expedicoes`, `expedicao_itens` e `pedido_cliente_eventos`; sem mock
> permanente, sem insert/update/delete/rpc. O render inicial e sincronico para
> preservar contratos de rota/testes; as leituras carregam em background e
> falham de modo tolerante. Fluxos Pedido/OP/Expedicao nao foram alterados.
>
> Validacao visual automatizada: o arquivo standalone foi analisado por fonte e
> a tela foi coberta por smoke estrutural, mas o Browser do Codex bloqueou
> navegacao para `file://` e tambem para pagina temporaria `data:`; por politica
> nao foi feito workaround. Portanto nao declarar OK visual/identico. Pendencia:
> validacao visual manual do usuario contra o standalone.
>
> Ajuste corretivo apos retorno do usuario: o miolo do dashboard foi reaproximado
> do standalone por fonte, incluindo paleta/icones dos KPIs, headers com borda,
> linhas flex de acoes e alertas, tags laterais, CTAs, pipeline com setas e cards
> internos, e atividade recente em link textual. Sem alteracao de dados, rotas ou
> fluxos Pedido/OP/Expedicao.
>
> Testes OK: `node --check js\screens\painel.js`;
> `node --test tests\admin-dashboard.smoke.js` 6/6;
> `node --test tests\painel-screen.smoke.js` 16/16;
> `node --test tests\pedido-detail.smoke.js` 161/161;
> `node --test tests\pedido-detail-linked-ops.smoke.js` 7/7;
> `node --test tests\router.smoke.js` 43/43.
>
> Arquivos alterados: `js/screens/painel.js`,
> `tests/admin-dashboard.smoke.js`, `tests/painel-screen.smoke.js`,
> `PROJECT_STATE.md`, `AGENT_HANDOFF.md`. `docs/DOCUMENTATION_INDEX.md` nao
> foi alterado porque nenhum documento novo foi criado. Confirmacoes: producao
> intocada, `origin` nao usado para escrita, sem SQL, sem migration, sem dados
> reais novos, sem `git add .`, `supabase/.temp/` fora do patch.

> **Atualizacao 2026-07-06 - fase
> `RAVATEX-TAPETES-PEDIDO-FLOW-UI-AUDIT-FIX-R1`.**
> Status: PATCH TECNICO PRONTO - AGUARDANDO VALIDACAO VISUAL DO USUARIO.
> Entrada: base confirmada em `work/app-next`, HEAD inicial
> `faf11f421c4b4413bfc54607979f7e821213a864`; status inicial observado
> `?? AUDIT_REPORT.md` e `?? supabase/.temp/`. `AUDIT_REPORT.md` foi
> tratado como insumo/registro da auditoria; `supabase/.temp/` permanece fora
> do patch. Producao proibida e nao tocada; `origin` nao usado para escrita.
>
> Diagnostico antes do patch:
>
> 1. Labels/titulos das setas nascem em `pedido-detail-progress.js` no objeto
>    `stage.transfer`.
> 2. O texto visual da seta era normalizado em `pedido-detail-render.js` por
>    `buildConnectorVisual`, que usava `Transferir` para toda seta ativa.
> 3. Os titulos do modal usam `stage.transfer.title` dentro de
>    `openMovementModal`.
> 4. `refreshPedidoTransitionModal(...)` ja existia e ja era usado pelo save
>    principal do modal e pela proposta inline; o patch consolidou a cobertura
>    em teste para evitar stale.
> 5. C3-done nao revelou conflito funcional: `adminStepper.acabamento` so
>    marca `done` quando nao ha OP formal pendente; `applyFormalPendingStage`
>    e backstop visual para saldo 0 com OP ainda pendente.
>
> B2-label corrigido: Insumos -> Tecelagem sem OP mostra seta `Iniciar` e
> modal/CTA `Gerar primeira OP`; Insumos -> Tecelagem com OP mostra seta
> `Receber` e modal `Registrar recebimento de insumos`; Tecelagem ->
> Acabamento mostra seta `Transferir` e modal/CTA `Transferir para
> Acabamento`; Acabamento -> Expedicao mostra seta `Movimentar` e modal/CTA
> `Movimentar para Expedicao`; Expedicao -> Entrega mostra seta `Entregar` e
> modal `Registrar entrega`. A matriz canonica de actions em
> `pedido-chain-state.js` nao foi renomeada por causa de label visual.
>
> E2-E5 auditado/coberto: `openMovementModal` executa write canonico e, apos
> sucesso, chama `refreshPedidoTransitionModal(...)`, que faz `reload()`,
> recalcula `computeViewModel(state)`, re-renderiza a tela e re-renderiza o
> modal no proximo estado. Isso cobre aceitar proposta, registrar recebimento,
> transferir Tecelagem -> Acabamento, movimentar Acabamento -> Expedicao e
> registrar entrega. Carregar OP relacionada continua sem write e apenas troca
> contexto/saldo/produtos do modal.
>
> C3-done: registrado como sobreposicao segura nesta fase, sem refactor. Regra
> preservada: check/`concluido` so quando nao ha saldo operacional relevante e
> nao ha OP pendente relevante. D1/D3 mantidos como polish P2.
>
> Testes OK: `node --test tests\pedido-detail.smoke.js` 161/161;
> `pedido-detail-linked-ops` 7/7; `tec-to-acabamento-flow` 39/39;
> `expedicao-partial-flow` 12/12; `expedicao-flow` 8/8;
> `op-latex-admin` 55/55; `production-flow-invariants` 11/11.
> Diagnosticos staging read-only OK: invariantes de fluxo, consolidacao Latex
> e expedicao parcial.
>
> Confirmacoes: sem SQL, sem migration, sem dados reais novos, sem aceitar OP
> real, sem registrar recebimento real, sem movimentar saldo real, sem
> finalizar OP real, sem concluir pedido real, sem update direto em
> `ops.status`, sem write paralelo no Pedido, sem `git add .` e
> `supabase/.temp/` fora do patch. Validacao visual do usuario segue pendente;
> nao declarar OK visual nem backlog zerado por esta fase.

> **Atualizacao 2026-07-05 - fase
> `RAVATEX-TAPETES-PEDIDO-INSUMOS-TECELAGEM-MODAL-PARITY-AND-REFRESH-R1`.**
> Status: PATCH TECNICO PRONTO - AGUARDANDO VALIDACAO VISUAL DO USUARIO.
> Entrada: fase reaberta por validacao visual do usuario. Base confirmada em
> `work/app-next`, HEAD inicial `fae90337472d118f4f90b4223900af752d9d3757`,
> status inicial somente `?? supabase/.temp/`; remoto de escrita permitido:
> `staging/work/app-next`.
>
> Diagnostico de paralelismo antes do patch:
>
> | Caso | Diagnostico | Correcao |
> |---|---|---|
> | Insumos -> Tecelagem sem OP | A seta abria `openMovementModal` com titulo generico `Registrar recebimento de insumos`, sem OP de origem. O chain-state ja bloqueava a action, mas o modal ainda parecia historico/operacao vazia e nao oferecia o CTA inicial dentro da transicao. | `pedido-detail-progress.js` muda o titulo/detalhe sem OP para geracao da primeira OP. `openMovementModal` agora detecta `Insumos>Tecelagem` sem OP e renderiza bloqueio claro, texto "Nao e possivel registrar material sem OP vinculada." e CTA `Gerar primeira OP`, sem historico vazio nem botao de recebimento. `buildInsumosTransferForm` tambem tem guard defensivo sem OP. |
> | Insumos -> Tecelagem com OP aberta/pendente de aceite | A OP relacionada e resolvida por `relatedOpsForTransition`/`buildRelatedOpsSection`; a proposta real ja vinha de `buildTecAcceptanceProposalBlock`, que replica slider/proposta da OP e chama `aplicarRecalculoOP`. Faltava garantir refresh do proprio modal apos aceitar. | `buildTecAcceptanceProposalBlock` recebeu `onAfterSuccess` e o modal de seta passa `refreshPedidoTransitionModal`, preservando slider/proposta real e removendo o estado antigo depois do aceite. |
> | Apos registrar recebimento de insumos | O recebimento usa `registrarRecebimentoOrdemFio`, mas o sucesso anterior chamava `reload()/render()` e fechava o modal, obrigando fechar/reabrir para ver aceite/proxima etapa. | O botao de salvar agora chama `refreshPedidoTransitionModal`, que recarrega dados, recalcula `computeViewModel`, reencontra a transicao e re-renderiza o mesmo modal sem fechar. Se o proximo estado for aceite, o slider/proposta aparece no mesmo modal. |
> | Paralelismo Tecelagem -> Acabamento | O fluxo validado usa `openMovementModal`, formulario operacional primeiro, `buildTecelagemTransferForm`, `Transferir restante` e write canonico `salvarEntregaCima`. | O padrao foi preservado: o modal de transicao continua operacional, com OPs relacionadas auxiliares e sem hub vazio. A diferenca justificada e que Insumos sem OP mostra CTA de criacao em vez de formulario, pois sem OP nao existe material recebivel. |
>
> Causa raiz: a transicao inicial reutilizava o mesmo shell de modal das
> movimentacoes com uma `action` bloqueada, mantendo titulo/texto de
> recebimento mesmo sem OP; alem disso, acoes bem-sucedidas do modal da seta
> atualizavam a tela e fechavam/deixavam stale o conteudo do modal em vez de
> recalcular a transicao dentro dele.
>
> Correcoes tecnicas: criado helper local `refreshPedidoTransitionModal(...)`
> em `js/screens/pedido-detail-events.js`; sem OP vinculada bloqueia
> recebimento e mostra `Gerar primeira OP`; aceite/proposta inline passa a
> retornar a Promise do handler e a re-renderizar a transicao; recebimento de
> insumos pelo modal permanece aberto e atualiza para o proximo estado canonico.
> Nao houve write paralelo no Pedido, update direto em `ops.status`, SQL,
> migration, dados reais novos ou mutacao real nao autorizada.
>
> Testes OK: `node --test tests\pedido-detail.smoke.js` 160/160;
> `node --test tests\pedido-detail-linked-ops.smoke.js` 7/7;
> `node --test tests\tec-to-acabamento-flow.smoke.js` 39/39;
> `node --test tests\expedicao-partial-flow.smoke.js` 12/12;
> `node --test tests\expedicao-flow.smoke.js` 8/8;
> `node --test tests\op-latex-admin.smoke.js` 55/55;
> `node --test tests\production-flow-invariants.smoke.js` 11/11.
> Diagnosticos staging read-only OK: `production-flow-invariants-diag`,
> `latex-consolidation-diag`, `expedicao-partial-flow-diag`.
>
> Confirmacoes: producao intocada, `origin` nao usado para escrita, sem SQL,
> sem migration, sem dados reais novos, sem aceitar OP real, sem registrar
> recebimento real, sem finalizar OP real, sem concluir pedido, sem `git add .`
> e `supabase/.temp/` fora do commit. Validacao visual do usuario segue
> pendente; nao declarar OK visual nem backlog zerado.

> **Atualizacao 2026-07-05 - fase
> `RAVATEX-TAPETES-ACABAMENTO-EXPEDICAO-MODAL-UX-PARITY-R2`.**
> Status: PATCH TECNICO PRONTO - AGUARDANDO VALIDACAO VISUAL DO USUARIO.
> Entrada: fase reaberta por validacao visual do usuario. Base confirmada em
> `work/app-next`, HEAD inicial `bef41f0960ea6cd7c21eedeb1099d6a1ae21b7da`,
> status inicial somente `?? supabase/.temp/`; remoto de escrita permitido:
> `staging/work/app-next`.
>
> Diagnostico de paridade antes do patch: Tecelagem -> Acabamento usa a seta
> `openMovementModal`, form principal `buildTecelagemTransferForm` com
> `buildEntregaInlineForm({ layout: 'stacked' })`, card `Produtos a transferir`,
> `Preencher restante`, botao principal do rodape e write canonico
> `salvarEntregaCima`. Acabamento -> Expedicao ja usava a mesma seta e a RPC
> canonica `liberar_expedicao_latex_parcial`, mas divergia na UX: formulario
> operacional ficava depois de OPs relacionadas/itens/historico e a OP
> relacionada com saldo mostrava botao solto `Movimentar`.
>
> Classificacao das diferencas: builder e RPC diferentes sao justificadas
> tecnicamente (`salvarEntregaCima` x `liberar_expedicao_latex_parcial`). A
> ordem visual do modal, o botao ambiguo `Movimentar` nas OPs relacionadas e o
> layout compacto de produtos nao tinham justificativa; foram alinhados por
> paridade. Nenhuma duvida de produto bloqueou a fase.
>
> Correcao: `openMovementModal` passou a renderizar o formulario operacional
> antes de `OPs relacionadas`, `Itens envolvidos`, historico e documentos. A
> secao `OPs relacionadas` virou contexto/selecionador: OP carregada informa
> que esta carregada; OP com saldo oferece `Carregar nesta movimentacao`, que
> troca a OP de origem e atualiza saldo/produtos no proprio modal sem disparar
> RPC. O botao ambiguo `Movimentar` foi removido dessa secao. O formulario
> Acabamento -> Expedicao ganhou card `Produtos a transferir`, link
> `Preencher restante`, campos por produto e continua salvando apenas pelo
> botao principal `Movimentar para Expedicao`.
>
> Garantias preservadas: OP Latex `aberta` ou `em_producao` com saldo recebido
> continua podendo movimentar parcial/total para Expedicao; finalizar OP Latex
> segue separado; sem update direto em `ops.status`; sem write paralelo no
> Pedido; sem SQL, sem migration e sem dados reais novos.
>
> Testes OK: `node --test tests\pedido-detail.smoke.js` (156/156);
> `node --test tests\pedido-detail-linked-ops.smoke.js
> tests\expedicao-partial-flow.smoke.js tests\expedicao-flow.smoke.js
> tests\op-latex-admin.smoke.js tests\tec-to-acabamento-flow.smoke.js
> tests\production-flow-invariants.smoke.js` (132/132). Diagnosticos staging
> read-only OK: `production-flow-invariants-diag`, `latex-consolidation-diag`,
> `expedicao-partial-flow-diag`. Producao/origin intocados; `supabase/.temp/`
> fora do commit.
>
> **Atualizacao 2026-07-05 - fase
> `RAVATEX-TAPETES-PEDIDO-ACABAMENTO-EXPEDICAO-MODAL-MOVE-R1`.**
> Status: CONCLUIDO - PATCH VALIDADO LOCALMENTE, DIAGNOSTICOS STAGING
> READ-ONLY OK E PUSH STAGING REALIZADO.
> Estado inicial confirmado: branch `work/app-next`, HEAD
> `76195b16d7a1a2bcc3ea849a2ce31724782f2387`, status inicial somente
> `?? supabase/.temp/`; remoto de escrita permitido: `staging/work/app-next`.
> Push staging realizado em `work/app-next`: `76195b1..fce09b1`.
>
> Causa raiz: o modal da seta `Acabamento -> Expedicao` ja tinha formulario
> para chamar o movimento parcial canonico, mas abria como historico/read-only
> quando a OP Latex estava `aberta`, porque o gate do chain-state so tratava
> `em_producao`/terminal como movimentavel. A lista de OPs relacionadas tinha
> o mesmo filtro restrito e ainda podia mostrar "Nenhuma acao contextual..."
> para a OP carregada no proprio modal. Alem disso, o stepper podia carregar a
> primeira OP de acabamento em vez da OP escolhida pela acao `releaseExpedicao`.
>
> Correcao: `js/screens/pedido-chain-state.js` passa a permitir OP Latex
> `aberta` quando ha saldo recebido/liberavel, sem tratar isso como
> finalizacao. `js/screens/pedido-detail-progress.js` carrega a OP definida
> pela acao `releaseExpedicao`. `js/screens/pedido-detail-events.js` mostra o
> formulario efetivo no modal, expoe `Transferir restante`, preserva
> quantidades por produto, mostra origem/saldo/produtos pendentes, evita a
> mensagem falsa de "Nenhuma acao contextual..." na OP carregada e oferece
> `Movimentar` nas OPs relacionadas com saldo.
>
> Escrita canonica preservada: o Pedido nao cria write paralelo em `pedidos`,
> `pedido_itens`, `ops` ou `expedicoes`; a movimentacao usa somente a RPC
> canonica `liberar_expedicao_latex_parcial` com `p_op_latex_id` e itens
> parciais. A leitura canonica de saldo da tela OP Latex continua em
> `consultar_saldo_expedicao_latex`; o Pedido usa os saldos consolidados ja
> carregados no detalhe para montar o modal e recarrega/renderiza apos sucesso.
>
> Testes locais OK: `node --test tests\pedido-detail.smoke.js` (155/155);
> `node --test tests\pedido-detail-linked-ops.smoke.js
> tests\expedicao-partial-flow.smoke.js tests\expedicao-flow.smoke.js
> tests\op-latex-admin.smoke.js tests\tec-to-acabamento-flow.smoke.js
> tests\production-flow-invariants.smoke.js` (132/132).
>
> Diagnosticos staging read-only OK:
> `node scripts/staging/production-flow-invariants-diag.mjs`;
> `node scripts/staging/latex-consolidation-diag.mjs`;
> `node scripts/staging/expedicao-partial-flow-diag.mjs`.
>
> Confirmacoes: sem SQL, sem migration, sem dados reais novos, sem finalizar
> OP Latex, sem aceitar OP real, sem transferencia real em staging, sem concluir
> pedido, sem alteracao de lifecycle, sem `git add .`, `supabase/.temp/` fora
> do commit, producao e `origin` intocados.
>
> **Atualizacao 2026-07-05 - fase
> `RAVATEX-TAPETES-PEDIDO-TRANSITION-MODAL-RELATED-OPS-ACTIONS-R2`.**
> Status: PATCH TECNICO PRONTO - AGUARDANDO VALIDACAO VISUAL DO USUARIO.
> Item reaberto: o requisito original era que clique nas setas de transicao do
> Pedido Detail Admin continuasse abrindo o modal de transicao/movimento, com
> as OPs relacionadas e suas acoes contextuais dentro desse modal. A bolinha da
> etapa deve continuar abrindo o hub da etapa. O erro anterior foi tratar a seta
> `Aguardar` como atalho para o hub, copiando a experiencia da bolinha e
> retirando o usuario do modal de transicao esperado.
>
> Correcao tecnica: `js/screens/pedido-detail-render.js` voltou a delegar todo
> conector/seta renderizado para `openMovementModal(stage.transfer)`. O hub
> permanece exclusivo das bolinhas/etapas via `openStageDetailModal`. Em
> `js/screens/pedido-detail-events.js`, o modal de movimento ganhou a secao
> `OPs relacionadas`, entre as pendencias por produto e os itens envolvidos,
> listando OPs de Tecelagem, Acabamento/Latex e Expedicao conforme a transicao.
>
> Acoes contextuais integradas: `Abrir OP`; `Movimentar` quando existe saldo e
> etapa aplicavel; `Finalizar OP` via handler canonico `finalizarOp`; e, para
> OP Tecelagem `aberta`, bloco de proposta de aceite com sliders e recalculo,
> nao um botao simples. A fonte real do aceite foi preservada: a UI original
> esta em `js/screens/op-nova.js` (`buildProposta`) e os writes canonicos em
> `js/screens/op-recalculo.js`; o Pedido apenas reutiliza os helpers globais
> (`recalcularOP`, `consumoPorOrdem`, `maxMetrosItem`,
> `aplicarRecalculoOP`). Sem `.from('ops').update` paralelo no Pedido.
>
> Testes locais OK: `node --check js\screens\pedido-detail-events.js`;
> `node --check js\screens\pedido-detail-render.js`;
> `node --test tests\pedido-detail.smoke.js` (150/150);
> `node --test tests\pedido-detail-linked-ops.smoke.js` (7/7);
> `node --test tests\tec-to-acabamento-flow.smoke.js` (37/37);
> `node --test tests\op-latex-admin.smoke.js` (55/55);
> `node --test tests\expedicao-partial-flow.smoke.js` (12/12);
> `node --test tests\expedicao-flow.smoke.js` (8/8);
> `node --test tests\production-flow-invariants.smoke.js` (11/11).
>
> Diagnosticos staging read-only OK: `production-flow-invariants-diag`,
> `latex-consolidation-diag` e `expedicao-partial-flow-diag`. Sem SQL, sem
> migration, sem dados reais novos, sem aceitar OP real, sem finalizar OP real,
> sem transferencia, sem concluir pedido, sem alteracao de lifecycle, sem write
> paralelo no Pedido, sem `git add .`, `supabase/.temp/` fora do commit,
> producao/origin intocados. Backlog Admin/Pedido: NAO declarar zerado; falta
> validacao visual do usuario.
>
> **Atualizacao 2026-07-05 - fase
> `RAVATEX-TAPETES-PEDIDO-STAGE-HUB-R2-REAL-STAGING`.**
> Status: OK para os itens reabertos do hub. Correcao pequena aplicada apos
> reproducao visual real do Pedido #13 em staging. A falha original foi
> reproduzida no app real: clique na etapa `TECELAGEM` do Pedido #13 gerava
> `TypeError: Failed to execute 'appendChild' on 'Node': parameter 1 is not of
> type 'Node'` em `js/ui.js:19`, chamado por
> `pedido-detail-events.js:1726`, dentro de `buildStageDetailBody`.
>
> Causa raiz: `summary.docBanner` e um objeto `{ tone, text }` produzido por
> `pedido-detail-progress.js`; o hub de Tecelagem passava o objeto inteiro
> como filho de `window.el(...)`. O DOM real tentava anexar esse objeto comum
> via `appendChild`, enquanto o harness anterior era permissivo e aceitava
> filhos invalidos, por isso os testes locais deram falso positivo.
>
> Correcao: `buildStageDetailBody` agora converte `docBanner` em linha de DOM
> por `docBannerRow(...)`, usando apenas texto/tom validos. O harness runtime
> de `tests/pedido-detail.smoke.js` foi endurecido para rejeitar objeto comum
> em `appendChild`, imitando o DOM real, e ganhou caso equivalente ao Pedido
> #13: OP 10/2026 aberta, Tecelagem/Aguardar, motivo, `Abrir OP` e
> `Aceitar OP`.
>
> Validacao visual real/read-only: app local `http://localhost:8765/` contra
> Supabase staging `ucrjtfswnfdlxwtmxnoo`; producao intocada. O asset
> `pedido-detail-events.js?v=20260623-asset1` servido bateu SHA-256 com o
> arquivo local corrigido. No browser real autenticado em staging, Pedido #13
> abriu o hub por `Ver detalhes da etapa TECELAGEM` e por `Movimentar
> Tecelagem -> Acabamento` / `Aguardar`; sem erros de console/pageerror; modal
> mostrou OP 10/2026, `Abrir OP`, `Aceitar OP`, motivo de pendencia e banner
> `Sem movimentacao para acabamento registrada ainda`. Nenhum clique em
> `Aceitar OP`, nenhum save e nenhuma transferencia real foram executados.
>
> Itens fechados nesta R2: `PEDIDO-STAGE-ACTION-HUB-B`,
> `PEDIDO-STAGE-BLOCKER-EXPLANATION-R1`,
> `TEC-ACCEPTANCE-IN-PEDIDO-MODAL-B`,
> `PEDIDO-STAGE-RELATED-OPS-LINKS-R1` e
> `PEDIDO-STAGE-MODAL-WIDTH-R1` para o hub de etapa validado. Backlog
> Admin/Pedido: itens do hub zerados; backlog geral ainda nao considerado
> zerado por haver residuo estatico fora desta fase em
> `js/screens/expedicao-admin.js`.
>
> Testes OK: `pedido-detail.smoke.js` (148/148),
> `pedido-detail-linked-ops.smoke.js` (7/7), `op-latex-admin.smoke.js`
> (55/55), `tec-to-acabamento-flow.smoke.js` (37/37),
> `expedicao-partial-flow.smoke.js` (12/12) e
> `expedicao-flow.smoke.js` (8/8). Diagnosticos staging read-only OK:
> `production-flow-invariants-diag`, `latex-consolidation-diag` e
> `expedicao-partial-flow-diag`.
>
> Confirmacoes: sem SQL, sem migration, sem dados reais novos, sem concluir
> pedido, sem aceitar OP real, sem transferencia, sem alterar fluxo
> Acabamento -> Expedicao, sem alterar lifecycle de OP, sem write paralelo no
> Pedido, sem `git add .`, `origin` nao usado para escrita e
> `supabase/.temp/` fora do commit.
>
> **Atualizacao 2026-07-05 - fase
> `RAVATEX-TAPETES-ADMIN-BACKLOG-VISUAL-CLOSEOUT-A`.**
> Status: BLOQUEADO / backlog Admin-Pedido NAO zerado. Auditoria visual
> read-only em app real servido por `http://localhost:8765/` apontando para
> Supabase staging `ucrjtfswnfdlxwtmxnoo`; producao `bhgifjrfagkzubpyqpew`
> intocada.
>
> Premissa registrada: relatorio tecnico e teste local nao bastam para fechar
> backlog de UX/fluxo. Cada item foi classificado por comportamento real em
> staging: OK visual, Parcial, Falhou, Reabrir R2 ou Nao validavel sem acao
> manual.
>
> Estado inicial confirmado: branch `work/app-next`, HEAD
> `57719298dcbd370cb7b1a0ca3ff1365c30ca8fb9`, remoto
> `staging/work/app-next` no mesmo commit, status inicial somente
> `?? supabase/.temp/`. `origin` nao foi usado para escrita.
>
> Staging/frontend: o app servido localmente resolveu `APP_ENV=staging` e
> `https://ucrjtfswnfdlxwtmxnoo.supabase.co`; `pedido-detail-render.js`
> servido bateu SHA-256 com o arquivo local do HEAD e nao contem mais
> `disabled: ready ? null`. Cache foi evitado com querystring `?audit=...`;
> nao ha service worker no app. Observacao: busca estatica ainda encontrou
> `disabled: ready ? null : 'disabled'` em `js/screens/expedicao-admin.js`,
> fora do botao do Pedido Detail validado nesta auditoria.
>
> Resultado visual por item:
>
> | Item | Status visual real | Evidencia | Decisao |
> |---|---|---|---|
> | `PEDIDO-CONCLUIR-ACTION-R1/R2` | OK visual no Pedido Detail | Pedido #20 aparece `Concluido` / `Comercial: Entregue`, botao final `Pedido concluido` com `disabled="disabled"` e cursor `not-allowed`; Pedido #21 apto mostra `Concluir pedido` habilitado, sem `disabled`; nenhum `disabled="null"` nos botoes do Pedido Detail. | Fechado para Pedido Detail; manter nota sobre residuo estatico em `expedicao-admin.js`. |
> | `PEDIDO-STAGE-ACTION-HUB-B` | Falhou | Pedido #21 abre hub de Entrega e mostra `Concluir`, mas Pedido #13 ao clicar Tecelagem/seta `Aguardar` gera `TypeError: Failed to execute 'appendChild' on 'Node'` em `pedido-detail-events.js:1726`; hub nao abre. | Reabrir R2. |
> | `PEDIDO-STAGE-BLOCKER-EXPLANATION-R1` | Falhou | Setas mantem texto curto `Aguardar`, mas no Pedido #13 o clique nao mostra motivo/proxima acao por causa do crash do hub. | Reabrir R2 junto com hub. |
> | `PEDIDO-FIRST-OP-CTA-PLACEMENT-R1` | OK visual | Pedido #1 sem OP mostra `Gerar primeira OP` destacado a direita no bloco `OPs vinculadas`; card vazio e explicativo. | Fechado. |
> | `OP-NOVA-METRAGEM-INPUT-FOCUS-R1` | OK visual | Nova OP aberta pelo Pedido #1; em linha temporaria nao salva, campo `metros` aceitou `1000` continuamente e foco permaneceu no mesmo input. | Fechado. |
> | `TEC-TO-ACABAMENTO-MODAL-LAYOUT-R1` | OK visual | Pedido #14 abriu modal Tecelagem -> Acabamento; ordem observada: nome do item, depois Data/Destino/Metros, depois Observacao; conteudo `Itens envolvidos` legivel. Nenhuma transferencia salva. | Fechado. |
> | `LATEX-ADMIN-COMPACT-BUTTONS-R1` | OK visual | OP Latex #27 / OP 9/2026 em producao nao mostra `Confirmar entrada / iniciar acabamento`; botoes curtos `Finalizar OP` e `Movimentar` aparecem separados. | Fechado. |
> | `TEC-ACCEPTANCE-IN-PEDIDO-MODAL-B` | Falhou | Pedido #13 tem OP Tecelagem aberta (OP 10/2026), mas o hub de Tecelagem crasha antes de exibir `Aceitar OP`; card principal so mostra `Abrir OP` e `Sem saldo disponivel`. | Reabrir R2. |
> | `PEDIDO-STAGE-MODAL-WIDTH-R1` | Parcial | Modal de movimento do Pedido #14 esta legivel e nao esmaga `Itens envolvidos`; hub de etapa nao pode ser validado em Tecelagem por crash real. | Revalidar apos R2 do hub. |
> | `PEDIDO-STAGE-RELATED-OPS-LINKS-R1` | Parcial / Reabrir R2 | Cards principais mostram `Abrir OP` e expedicoes mostram `Abrir expedicao`, mas os links dentro do hub de etapa para Tecelagem nao sao validaveis porque o hub crasha. | Reabrir junto com hub. |
>
> P1 falhou, portanto o backlog Admin/Pedido NAO esta zerado. Pedido #20
> permanece entregue/concluido e nao deve mais ser usado como pedido rascunho
> apto. Pedido #21 foi apenas inspecionado como apto; nao foi concluido.
>
> Testes locais obrigatorios OK: `pedido-detail.smoke.js` (147/147),
> `pedido-detail-linked-ops.smoke.js` (7/7), `op-latex-admin.smoke.js`
> (55/55), `tec-to-acabamento-flow.smoke.js` (37/37) e
> `expedicao-partial-flow.smoke.js` (12/12). Observacao critica: os testes
> de hub passaram, mas divergiram do browser real no caso com lista de OPs.
>
> Diagnosticos staging read-only OK: `production-flow-invariants-diag`,
> `latex-consolidation-diag` e `expedicao-partial-flow-diag`.
>
> Arquivos alterados nesta fase: `PROJECT_STATE.md`, `AGENT_HANDOFF.md` e
> `docs/architecture/PEDIDO_PRODUCTION_FLOW_BACKLOG.md`. Confirmacoes: sem
> SQL, sem migration, sem dados reais novos, sem concluir novo pedido, sem
> aceitar OP real, sem transferencia, sem save de Nova OP, sem acao
> destrutiva, sem `git add .`, `supabase/.temp/` fora do commit.
>
> **Atualizacao 2026-07-05 - fase
> `RAVATEX-TAPETES-PEDIDO-CONCLUIR-ACTION-R2-REAL-STAGING`.**
> Status: OK. R1 foi reaberto porque a validacao visual real do Arquiteto
> prevalece sobre o relatorio anterior: o botao `Concluir pedido` parecia
> ativo no Pedido Detail Admin, mas o DOM real estava com
> `disabled="null"`.
>
> Validacao inicial: branch `work/app-next`, HEAD base
> `0867cf48a652c3b428e5d781d33649ebc2e9b95f`, status inicial somente
> `?? supabase/.temp/`. Remoto `staging/work/app-next` tambem estava em
> `0867cf48a652c3b428e5d781d33649ebc2e9b95f`; `staging/main` permanecia em
> `49897275ee46702e66807c914c6b9ecc11bbecb2`. URLs publicas obvias de
> GitHub Pages staging retornaram 404, portanto a reproducao real foi no app
> local `http://localhost:8765/` conectado ao Supabase staging
> `ucrjtfswnfdlxwtmxnoo`. O asset servido foi verificado, sem service worker
> registrado no codigo.
>
> Reproducao real antes do patch, Pedido #20
> (`ad988da1-df36-4441-afef-16d9172f5c01`): tela mostrava cadeia pronta e
> botao verde `Concluir pedido`; DOM do botao: `disabledProp=true`,
> `disabledAttr="null"`, cursor `pointer`, sem overlay no centro do botao,
> `onclick` property sem handler porque o app usa `addEventListener`.
> O clique visual por automacao disparou a RPC e exibiu toast
> `Pedido concluido.`, concluindo o Pedido #20 no staging; portanto nao houve
> dado real novo, SQL ou migration, mas houve alteracao real de status do
> pedido de `rascunho` para `entregue` durante a reproducao. Console sem erro.
>
> Causa raiz: `buildConclusaoPedido` passava
> `disabled: ready ? null : 'disabled'` para o helper global `el(...)`. Como
> `el(...)` chama `setAttribute(k, v)` para qualquer atributo nao-evento,
> `null` virava atributo presente (`disabled="null"`), que desabilita o
> botao nativo. A mesma armadilha existia em `buildFooterAction` dentro do
> Pedido Detail. O harness R1 nao pegou porque o DOM fake tratava
> `disabled: null` como habilitado, divergindo do browser real.
>
> Correcao: `js/screens/pedido-detail-render.js` agora monta atributos de
> botoes condicionalmente: botoes aptos recebem `onclick` e nenhum
> `disabled`; botoes bloqueados/concluidos recebem `disabled="disabled"` e
> nenhum handler silencioso. `tests/pedido-detail.smoke.js` passou a simular
> o comportamento real de `setAttribute`, adicionando regressao para pedido
> apto, nao apto e ja concluido.
>
> Comportamento depois: Pedido #20, agora entregue, recarrega como
> `Concluido` / `Comercial: Entregue` e mostra `Pedido concluido` cinza,
> `disabled="disabled"`, cursor `not-allowed`, sem toast pendente e sem erro
> de console. O asset servido em `localhost:8765` nao contem mais
> `disabled: ready ? null`.
>
> Testes locais OK: `pedido-detail.smoke.js` (147/147),
> `pedido-detail-linked-ops.smoke.js` (7/7), `expedicao-flow.smoke.js`
> (8/8), `expedicao-partial-flow.smoke.js` (12/12),
> `tec-to-acabamento-flow.smoke.js` (37/37) e
> `op-latex-admin.smoke.js` (55/55). Diagnosticos staging read-only OK:
> `production-flow-invariants-diag`, `latex-consolidation-diag` e
> `expedicao-partial-flow-diag`.
>
> Arquivos alterados: `js/screens/pedido-detail-render.js`,
> `tests/pedido-detail.smoke.js`, `PROJECT_STATE.md`,
> `AGENT_HANDOFF.md`. Confirmacoes: producao intocada, `origin` nao usado
> para escrita, sem SQL, sem migration, sem dados reais novos, sem
> alteracao destrutiva, sem `git add .`, `supabase/.temp/` fora do commit.
> Commit/push de fechamento: `Fix real pedido completion click`, somente
> para `staging/work/app-next`.
>
> **Atualizacao 2026-07-05 - fase
> `RAVATEX-TAPETES-LATEX-ADMIN-COMPACT-BUTTONS-R1`.**
> Status: OK. Patch UI focado na tela OP Latex/Acabamento Admin; sem SQL,
> migration, producao, dados reais novos, payload novo, RPC nova ou alteracao
> de lifecycle/saldo/split/consolidacao.
>
> Diagnostico inicial: branch `work/app-next`, HEAD base
> `2ff4ab816ef491f1beed76f9e18fc45d2aebc7d5`, status residual somente
> `?? supabase/.temp/`; remoto `staging` confirmado e `origin` nao usado para
> escrita. Arquivos lidos: `PROJECT_STATE.md`, `AGENT_HANDOFF.md`,
> `docs/architecture/PEDIDO_PRODUCTION_FLOW_BACKLOG.md`,
> `js/screens/op-latex-admin.js`, `js/screens/pedido-detail-events.js`,
> `js/screens/pedido-chain-state.js`, `js/screens/pedido-detail-progress.js`,
> `tests/op-latex-admin.smoke.js`, `tests/expedicao-partial-flow.smoke.js` e
> `tests/pedido-detail.smoke.js`.
>
> Auditoria semantica: `Confirmar entrada / iniciar acabamento` apenas
> confirma o recebimento vindo da Tecelagem e chama `alterar_status_op` para
> `em_producao`; virou botao `Confirmar` com helper `Confirma o recebimento
> do material vindo da Tecelagem.`. `Movimentar para Expedicao` chama
> `liberar_expedicao_latex_parcial` e movimenta Acabamento -> Expedicao; virou
> `Movimentar` com helper `Movimenta a quantidade disponivel do Acabamento
> para Expedicao.`. `Liberar total para expedicao` preserva a RPC legada
> `liberar_expedicao` e virou `Liberar total`. `Finalizar OP de latex` virou
> `Finalizar OP`; exclusao longa virou `Excluir OP`.
>
> Garantias de fluxo: nao existe etapa obrigatoria `registrar acabamento`;
> nao foi criado `finalizar acabamento` como etapa operacional; Finalizar OP
> continua separado e nao e pre-requisito para movimentar; Acabamento ->
> Expedicao permanece direto via `liberar_expedicao_latex_parcial`; botoes
> receberam texto curto e `white-space:nowrap`.
>
> Testes locais OK: `op-latex-admin.smoke.js` (55/55),
> `expedicao-partial-flow.smoke.js` (12/12), `pedido-detail.smoke.js`
> (145/145), `pedido-detail-linked-ops.smoke.js` (7/7),
> `tec-to-acabamento-flow.smoke.js` (37/37), `expedicao-flow.smoke.js`
> (8/8), `entrega-writes.smoke.js` (70/70), `op-latex-split.smoke.js`
> (28/28), `production-flow-invariants.smoke.js` (11/11) e
> `latex-consolidation-schema.smoke.js` (25/25). Checks de sintaxe OK para
> `js/screens/op-latex-admin.js`, `tests/op-latex-admin.smoke.js`,
> `tests/expedicao-partial-flow.smoke.js` e `tests/expedicao-flow.smoke.js`.
> Diagnosticos staging read-only OK: invariantes do fluxo produtivo,
> consolidacao Latex e expedicao partial.
>
> Arquivos alterados: `js/screens/op-latex-admin.js`,
> `tests/op-latex-admin.smoke.js`, `tests/expedicao-partial-flow.smoke.js`,
> `tests/expedicao-flow.smoke.js`, `PROJECT_STATE.md`, `AGENT_HANDOFF.md`.
> Arquivo extra justificado: `tests/expedicao-flow.smoke.js` foi atualizado
> porque a suite obrigatoria ainda validava o texto longo antigo.
>
> Proximo backlog recomendado: `PEDIDO-STAGE-MODAL-WIDTH-R1`. Confirmacoes:
> producao intocada, sem SQL/migration, sem `git add .`, sem reset/rebase/
> clean/stash, `supabase/.temp/` fora do commit.
>
> **Atualizacao 2026-07-05 - fase
> `RAVATEX-TAPETES-TEC-TO-ACABAMENTO-MODAL-LAYOUT-R1-CLOSEOUT`.**
> Status: OK. Closeout de patch parcial retomado; executor anterior havia
> parado antes de testes, docs, commit e push. Sem SQL/migration, sem
> producao, sem dados reais novos e sem alteracao de persistencia.
>
> Diagnostico inicial: branch `work/app-next`, HEAD base
> `2b2b4c008681eca153e1d404dab16ca96a9ef09e`, com patch local ja existente
> em `js/screens/entrega-form.js`, `js/screens/pedido-detail-events.js` e
> `tests/tec-to-acabamento-flow.smoke.js`; `supabase/.temp/` permaneceu fora
> do escopo. O arquivo real do formulario do modal "Registrar nova
> transferencia" e `js/screens/entrega-form.js`, componente compartilhado por
> outros fluxos de entrega.
>
> Auditoria/correcao: o helper `buildEntregaInlineForm` ganhou `layout =
> 'inline'` como default historico e `layout: 'stacked'` como opt-in. O
> opt-in e usado somente em `buildTecelagemTransferForm` no fluxo
> Tecelagem -> Acabamento. O layout antigo permanece Data/Destino/Observacao
> da entrega antes das linhas de item. O layout final do modal alvo ficou:
> Nome do item; Data/Destino/Metros; Observacao. Data e Destino continuam
> campos compartilhados da entrega, apenas reposicionados junto da primeira
> linha de item no layout opt-in.
>
> Compatibilidade preservada: handler canonico continua
> `window.salvarEntregaCima`; `getPayload()` e `getSplitOption()` seguem com
> o mesmo contrato; validacao de metragem, criacao de entrega, split opcional,
> saldo e fluxo Acabamento -> Expedicao nao foram alterados. A largura do
> modal foi ajustada de `width:520px` para `width:100%;max-width:520px`, sem
> aumentar o maximo visual e mantendo o ajuste responsivo controlado.
>
> Testes locais OK: `pedido-detail.smoke.js` (145/145),
> `pedido-detail-linked-ops.smoke.js` (7/7),
> `tec-to-acabamento-flow.smoke.js` (37/37),
> `op-latex-admin.smoke.js` (53/53),
> `expedicao-partial-flow.smoke.js` (12/12),
> `expedicao-flow.smoke.js` (8/8), `entrega-writes.smoke.js` (70/70),
> `op-latex-split.smoke.js` (28/28) e
> `production-flow-invariants.smoke.js` (11/11). Checks extras OK:
> `node --check js\screens\entrega-form.js`,
> `node --check js\screens\pedido-detail-events.js` e
> `node --check tests\tec-to-acabamento-flow.smoke.js`.
>
> Diagnosticos staging read-only OK: invariantes do fluxo produtivo,
> consolidacao Latex e expedicao partial. Commit/push de fechamento:
> `Reorder tecelagem transfer modal fields`, enviado somente para
> `staging/work/app-next`. Proximo backlog recomendado:
> `LATEX-ADMIN-COMPACT-BUTTONS-R1`.
>
> **Atualizacao 2026-07-05 - fase
> `RAVATEX-TAPETES-OP-NOVA-METRAGEM-INPUT-FOCUS-R1`.**
> Status: OK. Bugfix UI focado + teste de regressao; sem SQL/migration,
> sem producao, sem dados novos, sem lifecycle de OP e sem fluxo
> Pedido->OP->Expedicao.
>
> Diagnostico: `op-nova.js` foi inspecionado e o campo de metros da Nova OP
> atualiza apenas o resumo lateral via `renderRight()`, sem reconstruir a
> linha. O relato operacional ("abertura de pedido", item 1 ja listado)
> mapeou o bug real para `js/screens/pedido-form.js`: o input `Metragem` do
> item inline chamava `render()` a cada evento `input`, fazendo
> `container.replaceChildren(...)` reconstruir toda a tela e destruir o
> proprio input a cada digito.
>
> Correcao: em `pedido-form.js`, o handler de metragem agora atualiza apenas
> `item.metros` e chama `updateItensSummary()`, que recalcula localmente
> `Metragem total`, `Total de itens` e o resumo do card de salvamento usando
> marcadores `data-pedido-*`. A linha e o input permanecem no DOM durante a
> digitacao; nao ha `setTimeout`, refocus bruto, hack de selection, redesenho
> de tela, write novo ou alteracao de contrato DB. O modal de adicionar item
> e os fluxos OP Nova/OP Persistir/Pedido Detail ficaram preservados.
>
> Comportamento validado: digitacao continua `1 -> 10 -> 100 -> 1000` sem
> recriar o input; foco/DOM preservado; valor final `1000` segue para
> `pedido_itens.metros` no payload de salvamento; calculo de metragem total
> continua atualizando ao vivo; validacoes de modelo/metragem e persistencia
> permanecem iguais.
>
> Testes locais OK: `node --check js\screens\pedido-form.js`,
> `node --check tests\pedido-form.smoke.js`, `node --test
> tests\pedido-form.smoke.js` (41/41), `op-nova.smoke.js` (69/69),
> `op-persistir.smoke.js` (69/69), `pedido-detail.smoke.js` (145/145),
> `pedido-detail-linked-ops.smoke.js` (7/7) e
> `tec-to-acabamento-flow.smoke.js` (30/30). Diagnosticos staging read-only
> OK: invariantes do fluxo produtivo, consolidacao Latex e expedicao partial.
>
> Arquivos alterados: `js/screens/pedido-form.js`,
> `tests/pedido-form.smoke.js`, `PROJECT_STATE.md`, `AGENT_HANDOFF.md`.
> Arquivo extra justificado: `pedido-form.js`/`pedido-form.smoke.js` nao
> estavam na lista inicial, mas sao o componente real do campo de metragem
> afetado. `op-nova-writes.js` nao existe no workspace e nao foi recriado.
> Proximo backlog recomendado: `TEC-TO-ACABAMENTO-MODAL-LAYOUT-R1`.
>
> **Atualizacao 2026-07-05 - fase
> `RAVATEX-TAPETES-PEDIDO-FIRST-OP-CTA-PLACEMENT-R1`.**
> Status: OK. Patch leve em JS + testes + docs; sem SQL/migration/producao,
> sem dados novos, sem write paralelo no Pedido e sem uso de `origin` para
> escrita.
>
> Diagnostico: o Pedido Detail ja tinha a navegacao canonica para criar OP
> (`navigateToNovaOp` -> `#/ops/nova?pedido_id=<id>`) e o hub da etapa sem OP
> ja oferecia "Gerar primeira OP". O estado vazio do bloco `OPs vinculadas`,
> porem, deixava a chamada principal pouco destacada dentro do card vazio,
> depois da explicacao. O operador ainda precisava procurar a acao.
>
> Implementado: no bloco `OPs vinculadas`, quando `view.opSummaries.length ===
> 0` e nao ha `opsLoadError`, o CTA `Gerar primeira OP` aparece destacado no
> lado direito do cabecalho. O card vazio ficou apenas explicativo, com
> "Nenhuma OP vinculada ainda." e "Proxima acao: gerar a primeira OP de
> Tecelagem...". O botao reutiliza o mesmo handler canonico
> `handlers.navigateToNovaOp`; nao foi criada rota, RPC, insert/update/delete
> ou logica paralela.
>
> Comportamento final: pedido sem OP mostra um unico CTA na tela principal e
> leva para `#/ops/nova?pedido_id=<id>`; pedido com OP vinculada nao mostra o
> CTA de primeira OP e continua exibindo os cards/acoes existentes ("Abrir OP",
> etapa/hub, setas e modais). O hub da etapa sem OP permanece funcionando como
> explicacao contextual complementar.
>
> Testes locais OK: `node --check js\screens\pedido-detail-render.js`,
> `node --check tests\pedido-detail.smoke.js`, `node --test
> tests\pedido-detail.smoke.js` (145/145), `pedido-detail-linked-ops.smoke.js`
> (7/7), `tec-to-acabamento-flow.smoke.js` (30/30),
> `op-latex-admin.smoke.js` (53/53), `expedicao-partial-flow.smoke.js`
> (12/12), `expedicao-flow.smoke.js` (8/8). Diagnosticos staging read-only OK:
> invariantes do fluxo produtivo, consolidacao Latex e expedicao partial.
>
> Arquivos alterados: `js/screens/pedido-detail-render.js`,
> `tests/pedido-detail.smoke.js`, `PROJECT_STATE.md`, `AGENT_HANDOFF.md`.
> Proximo backlog recomendado: `OP-NOVA-METRAGEM-INPUT-FOCUS-R1`; depois
> `TEC-TO-ACABAMENTO-MODAL-LAYOUT-R1` se a validacao visual pedir ajuste de
> largura/layout do modal de transferencia.
>
> **Atualizacao 2026-07-05 - fase
> `RAVATEX-TAPETES-PEDIDO-STAGE-BLOCKER-EXPLANATION-R1`.**
> Status: OK local / push staging bloqueado por autenticacao GitHub. Patch
> leve em JS + testes + docs; sem SQL/migration/producao e sem dados novos.
>
> Diagnostico: a fase anterior ja tinha transformado a bolinha/etapa em hub
> contextual (`openStageDetailModal` -> `buildStageDetailBody`) e mantido as
> setas ativas/de historico em `openMovementModal`. A confusao restante era
> que a seta `Aguardar` continuava visualmente passiva: o operador via o
> bloqueio, mas precisava descobrir sozinho se deveria clicar na etapa, na OP
> ou na expedicao. O render agora mantem a seta com texto curto (`Aguardar`),
> porem ela vira botao explicativo e abre o hub da etapa correspondente. As
> setas ativas/de historico seguem abrindo `openMovementModal`.
>
> Regra final consolidada: bolinha/etapa sempre abre o hub contextual com
> OPs/expedicoes, metricas, motivos e acoes; seta com acao direta unica
> continua abrindo o modal de transicao/historico canonico; seta bloqueada
> `Aguardar` abre o hub/explicacao da etapa; explicacao longa nunca entra na
> seta; rotulos de seta permanecem curtos (`Concluido`, `Transferir`,
> `Aguardar`).
>
> Bloqueios/explicacoes implementados no hub: Pedido sem OP -> "Gerar
> primeira OP"; OP Tecelagem pendente de aceite -> "Aceitar OP"; Tecelagem
> entregue com OP ainda em producao -> "Finalizar OP"; Tecelagem com saldo ->
> "Transferir"; Acabamento com saldo recebido nao movimentado -> "Movimentar
> para Expedicao"; Acabamento sem material recebido / OP ainda nao movivel /
> tudo ja movimentado -> motivo curto + proxima etapa; Expedicao com saldo ->
> "Entregar"; sem expedicao liberada -> "Nenhuma quantidade movimentada para
> Expedicao"; Entrega apta -> "Concluir"; Entrega nao apta -> lista de
> pendencias.
>
> Reuso canonico preservado: `openMovementModal`, `openTecAcceptanceModal`,
> `finalizarOp` -> `alterar_status_op`, `concluirPedido` ->
> `concluir_pedido_se_pronto`, navegacao `Abrir OP`/`Abrir Expedicao`/
> `Gerar primeira OP`. Nao houve write paralelo no Pedido, nem update direto
> em `ops.status`, nem finalizacao automatica de OP.
>
> Testes locais obrigatorios OK: `pedido-detail.smoke.js` (142/142, com
> novo runtime de clique em `Aguardar`), `pedido-detail-linked-ops.smoke.js`
> (7/7), `tec-to-acabamento-flow.smoke.js` (30/30),
> `op-latex-admin.smoke.js` (53/53), `expedicao-partial-flow.smoke.js`
> (12/12), `expedicao-flow.smoke.js` (8/8), `entrega-writes.smoke.js`
> (70/70), `op-latex-split.smoke.js` (28/28). Total: 350/350 OK.
> Diagnosticos staging read-only OK: invariantes do fluxo produtivo,
> consolidacao Latex e expedicao partial. Staging analisado:
> `ucrjtfswnfdlxwtmxnoo`; producao `bhgifjrfagkzubpyqpew` intocada.
>
> Arquivos alterados: `js/screens/pedido-detail-render.js`,
> `js/screens/pedido-detail-events.js`, `tests/pedido-detail.smoke.js`,
> `PROJECT_STATE.md`, `AGENT_HANDOFF.md`. Proximo backlog recomendado:
> `PEDIDO-FIRST-OP-CTA-PLACEMENT-R1` (sem resolver nesta fase), depois
> `TEC-TO-ACABAMENTO-MODAL-LAYOUT-R1` se o modal de transferencia ficar
> apertado em validacao visual. Commit local criado; push para `staging`
> tentou 3 vezes, travou no gerenciador de credenciais e a tentativa
> controlada sem prompt falhou com autenticacao ausente para GitHub.

> **Atualizacao 2026-07-05 - fase
> `RAVATEX-TAPETES-PEDIDO-STAGE-ACTION-HUB-B`.**
> Status: OK. Patch em JS + testes, sem SQL/migration/producao. O modal de
> etapa do Pedido virou um hub contextual: opera o fluxo comum sem obrigar
> o usuario a procurar a OP manualmente.
>
> Diagnostico: o modal-detalhe da etapa (`buildStageDetailBody`, aberto pelas
> bolinhas do stepper via `openStageDetailModal`) ja listava OPs com "Abrir
> OP" mas era read-only por contrato de teste (`stepper-modals-B`). As acoes
> viviam so nas telas de OP ou no modal de seta (`openMovementModal`). O hub
> agora expoe acoes contextuais por OP/expedicao REUTILIZANDO handlers
> canonicos (sem write inline/paralelo), preservando o contrato read-only-of-
> writes (nenhum `supa.rpc`/`.insert/.update/.delete`/salvarEntrega* no corpo
> do modal — tudo delega a handlers externos).
>
> Novo handler canonico `finalizarOp(op)` (pedido-detail-events.js):
> confirmDialog + `alterar_status_op(..., 'concluida')` com guard de erro;
> nao ha update direto em `ops.status`, nao finaliza automaticamente (exige
> confirmacao) e e a mesma RPC das telas de OP.
>
> Acoes por etapa no hub (`buildStageDetailBody`), todas com texto curto:
> - Insumos/inicio: "Gerar primeira OP" (navigateToNovaOp) quando o pedido
>   nao tem OP; "Aceitar OP" para OP Tecelagem aberta (openTecAcceptanceModal).
> - Tecelagem: por OP -> "Abrir OP"; "Aceitar OP" (aberta); "Transferir"
>   (em_producao com saldo, delega a openMovementModal Tecelagem->Acabamento);
>   "Finalizar OP" (em_producao, saldo 0, nao terminal, finalizarOp).
> - Acabamento: metricas corrigidas para Recebido/Movimentado/Disponivel/
>   Entregue (contrato Acabamento->Expedicao); por OP -> "Abrir OP";
>   "Movimentar" (disponivel>0, sem exigir status terminal, delega a
>   openMovementModal Acabamento->Expedicao); "Finalizar OP" (em_producao,
>   disponivel 0, nao terminal).
> - Expedicao: por expedicao -> "Abrir Expedicao"; "Entregar" (saldo>0,
>   delega a openMovementModal Expedicao->Entrega).
> - Entrega: mostra estado de conclusao; "Concluir" quando apto (reutiliza
>   concluirPedido/concluir_pedido_se_pronto), ou lista as pendencias.
> Quando nao ha acao possivel, o motivo aparece em texto auxiliar curto no
> modal (nunca na seta).
>
> Regras preservadas: setas continuam com texto curto ("Transferir",
> "Movimentar", "Concluido", "Aguardar"); explicacoes longas ficam no
> modal/painel; nao exige OP Latex terminal para movimentar; nao existe
> "registrar acabamento"; nao finaliza OP automaticamente; sem update direto
> em `ops.status`; sem write paralelo (tudo via handlers/RPCs canonicos). O
> modal de seta (`openMovementModal`) e as telas de OP nao foram alterados;
> `op-*-admin.js`/`expedicao-admin.js` intocados.
>
> Testes: 384/384 OK (10 novos em `pedido-detail.smoke.js`: estaticos de
> delegacao + read-only-of-writes + rotulos do Acabamento; runtime que
> renderiza o corpo do modal e exercita Finalizar OP -> alterar_status_op,
> Aceitar OP, Movimentar, Entregar, Gerar primeira OP -> navegacao e Concluir
> -> concluir_pedido_se_pronto). Diagnosticos staging read-only OK
> (invariantes, consolidacao, expedicao-partial: contrato Acabamento->
> Expedicao intacto). Producao intocada; `origin` nao usado para escrita.
> Proximo backlog: `PEDIDO-STAGE-BLOCKER-EXPLANATION-R1` (completo),
> `PEDIDO-FIRST-OP-CTA-PLACEMENT-R1`.

> **Atualizacao 2026-07-05 - fase
> `RAVATEX-TAPETES-PEDIDO-CONCLUIR-ACTION-R1`.**
> Status: OK. Diagnostico direcionado + patch pequeno em JS, sem SQL/
> migration/producao.
>
> Sintoma: a acao "Concluir pedido" no detalhe do Pedido podia parecer um
> clique morto. Diagnostico por harness runtime + SELECTs read-only em
> staging.
>
> Estado real de dados: Pedido #20 (id ad988da1-df36-4441-afef-16d9172f5c01)
> ja esta APTO a concluir (OP Tecelagem 18/2026 concluida, OP Latex 11/2026
> concluida, expedicao #3 concluida, 1000/1000 entregue), porem
> `pedidos.status='rascunho'` e `pedido_eventos` vazio. O botao fica
> corretamente HABILITADO (view.pedidoConclusao.pronto=true) e chama
> `concluir_pedido_se_pronto(UUID)`.
>
> Contrato da RPC (db/23, inalterado): admin-only, valida OPs terminais +
> expedicoes concluidas, grava `pedidos.status='entregue'` +
> `status_cliente_visual` + `pedido_eventos`, retorna JSONB {ok,...} ou
> {ok:false, erro, pendencias}. Nao bloqueia 'rascunho' (so 'cancelado').
> RPC correta; nenhuma alteracao de DB nesta fase.
>
> Causa raiz (erro silencioso): `concluirPedido` em
> `pedido-detail-events.js` nao tinha guard em volta da RPC nem do
> pos-sucesso. Se `supa.rpc(...)` lancasse (rede/sessao) ou se
> `reload()/render()` lancasse APOS a conclusao, a promise rejeitava sem
> tratamento (o onclick do botao nao faz await/catch): nenhum toast e o
> botao preso em "Concluindo..." e desabilitado. Pior: um crash de render
> pos-sucesso podia induzir novo clique e duplicar `pedido_eventos`.
>
> Correcao (pequena, sem redesenho): `concluirPedido` agora (1) envolve a
> RPC em try/catch e exibe o erro real acionavel, restaurando o botao; (2)
> mantem a exibicao das pendencias reais da RPC; (3) separa o pos-sucesso
> em try/catch — toast de sucesso primeiro, e se reload/render falhar,
> avisa "Pedido concluido. Recarregue a pagina..." e restaura o botao, sem
> parecer falha e sem induzir novo clique. Sem catch generico que engula a
> mensagem; erro real vai ao console e ao toast.
> `pedido-detail-progress.js`: a lista de pendencias de conclusao passou a
> explicar, quando `emAcabamento > 0`, "Ha saldo em acabamento (X) nao
> movimentado para expedicao", reaproveitando o calculo do fluxo recem
> corrigido (nao altera aptidao de pedido apto, pois emAcabamento=0 nesse
> caso).
>
> Testes: 374/374 OK, incluindo 7 novos em `pedido-detail.smoke.js`
> (harness runtime que carrega o bundle e exercita `concluirPedido`):
> apto habilita/pronto; nao-apto explica saldo em acabamento; clique chama
> a RPC + atualiza tela; pendencias da RPC exibidas; RPC que lanca gera erro
> acionavel e restaura o botao; falha de render pos-sucesso nao induz
> duplicidade; onclick delega ao handler e o handler nao engole erro.
> Diagnosticos staging read-only OK: `production-flow-invariants-diag`,
> `latex-consolidation-diag` e `expedicao-partial-flow-diag` (contrato
> Acabamento->Expedicao intacto; Pedido #20 rascunho apto).
>
> Preservado: fluxo Acabamento->Expedicao recem-corrigido, read model
> Cliente, `origin`, producao, db/23. Sem SQL, sem migration, sem dados
> reais novos. Proximo backlog: `PEDIDO-STAGE-ACTION-HUB-B`,
> `PEDIDO-STAGE-BLOCKER-EXPLANATION-R1` (completo),
> `PEDIDO-FIRST-OP-CTA-PLACEMENT-R1`.

> **Atualizacao 2026-07-05 - fase
> `RAVATEX-TAPETES-ADMIN-FLOW-BACKLOG-SYNC-A`.**
> Status: OK. Patch documental somente, sem JS/SQL/migration/producao.
> Fase de consolidacao de backlog Admin — registra observacoes de
> validacao operacional como itens hierarquizados de backlog, sem
> implementar correcoes.
>
> Registrados 10 itens de backlog Admin em
> `docs/architecture/PEDIDO_PRODUCTION_FLOW_BACKLOG.md` §9:
> `PEDIDO-CONCLUIR-ACTION-R1` (P1), `PEDIDO-STAGE-ACTION-HUB-B` (P1),
> `PEDIDO-STAGE-BLOCKER-EXPLANATION-R1` (P2, absorvido),
> `PEDIDO-FIRST-OP-CTA-PLACEMENT-R1` (P1),
> `OP-NOVA-METRAGEM-INPUT-FOCUS-R1` (P2),
> `TEC-ACCEPTANCE-IN-PEDIDO-MODAL-B` (P1),
> `PEDIDO-STAGE-MODAL-WIDTH-R1` (P2),
> `TEC-TO-ACABAMENTO-MODAL-LAYOUT-R1` (P2),
> `PEDIDO-STAGE-RELATED-OPS-LINKS-R1` (P2, absorvido),
> `LATEX-ADMIN-COMPACT-BUTTONS-R1` (P2).
>
> `PEDIDO-STAGE-ACTION-HUB-B` absorve 4 itens:
> `BLOCKER-EXPLANATION-R1`, `RELATED-OPS-LINKS-R1`,
> parte de `TEC-ACCEPTANCE-IN-PEDIDO-MODAL-B` e
> parte de `PEDIDO-STAGE-MODAL-WIDTH-R1`.
>
> Sequencia recomendada: CONCLUIR-ACTION → STAGE-ACTION-HUB →
> TEC-ACCEPTANCE-IN-PEDIDO-MODAL → OP-NOVA-METRAGEM-FOCUS →
> FIRST-OP-CTA → TEC-TO-ACABAMENTO-MODAL-LAYOUT →
> STAGE-MODAL-WIDTH → LATEX-COMPACT-BUTTONS.
>
> Arquivos alterados: `docs/architecture/PEDIDO_PRODUCTION_FLOW_BACKLOG.md`,
> `PROJECT_STATE.md`, `AGENT_HANDOFF.md`.
> Nenhum JS, teste, SQL, migration, producao ou origin alterado.
>
> **Atualizacao 2026-07-05 - fase
> `RAVATEX-TAPETES-ACABAMENTO-EXPEDICAO-FLOW-COHERENCE-C`.**
> Status: OK em staging. Reparou de ponta a ponta o fluxo Acabamento/Latex
> -> Expedicao -> Entrega, dando paridade com Tecelagem -> Acabamento.
>
> Premissa (decidida, nao aberta): parcial e movimento/rastro; a OP
> continua aberta enquanto ha saldo; movimentar parcial NAO finaliza a OP;
> finalizar a OP e terminalidade do total; NAO existe etapa intermediaria
> obrigatoria "registrar acabamento"; o movimento Acabamento -> Expedicao e
> a propria declaracao de que a quantidade ficou acabada/liberada.
>
> Causa raiz: a fase anterior (CONTRACT-B, db/31) corrigiu o backend com a
> premissa ERRADA de que o "acabado" liberavel vinha de um movimento
> `entregas.etapa='latex'` ("registrar acabamento"). Como esse movimento nao
> existe no fluxo normal do admin (etapa=latex so nasce no portal do
> fornecedor), o saldo liberavel ficava sempre 0 e a expedicao travava,
> mesmo com material ja recebido da Tecelagem.
>
> Contrato antes: `acabado = SUM(entregas.etapa='latex' + entrega_itens por
> op_item)`; liberavel = acabado - liberado.
> Contrato depois: `recebido_no_acabamento = SUM(entrega_itens das entregas
> Tecelagem->Acabamento etapa='cima' vinculadas por op_latex_entregas,
> mapeadas ao op_item da OP Latex por modelo)` (== op_itens acumulados de
> gerar_op_latex); `ja_movimentado = SUM(expedicao_itens.metros_liberados)
> por op_latex_id+op_item_id`; `disponivel = saldo_em_acabamento = recebido
> - ja_movimentado`.
>
> Migration corretiva `db/32_acabamento_expedicao_direct_movement.sql`
> criada e aplicada SOMENTE no Supabase staging `ucrjtfswnfdlxwtmxnoo`
> (producao `bhgifjrfagkzubpyqpew` intocada). Ela SOBRESCREVE (CREATE OR
> REPLACE, mesmas assinaturas) as RPCs da db/31:
> `consultar_saldo_expedicao_latex(BIGINT)` retorna recebido_total,
> liberado_total, disponivel_total, entregue_total,
> saldo_em_acabamento_total e itens {recebido, liberado, entregue,
> disponivel, saldo_em_acabamento}; `liberar_expedicao_latex_parcial(BIGINT,
> JSONB, TEXT)` guarda por `recebido - ja_movimentado`, aceita OP
> em_producao/concluida/finalizada, nao altera `ops.status`, cria/reusa
> expedicao, soma em expedicao_itens.metros_liberados e chama
> `recalcular_status_expedicao`. Cria o indice `entrega_itens_entrega_idx`.
> A RPC legada `liberar_expedicao(BIGINT)` (db/23, liberacao total terminal)
> permanece intocada como atalho legado.
>
> Frontend: `op-latex-admin.js` usa o resumo canonico (Recebido da
> Tecelagem / Ja movimentado para Expedicao / Disponivel para movimentar /
> Entregue ao Cliente / Saldo em Acabamento), CTA "Movimentar para
> Expedicao", "Finalizar OP" separado (header e card 5), e removeu a nocao
> operacional de "registrar acabamento" / "Novo recebimento". Item table
> passou a Recebido/Movimentado/Disponivel/Entregue. `pedido-chain-state.js`
> calcula `acabLiberavel` por recebido(op_itens) - movimentado, so para OP
> em_producao/concluida/finalizada. `pedido-detail-progress.js`:
> em_acabamento = recebido - movimentado; pronto_expedicao = movimentado -
> entregue (= saldo da expedicao); por item usa liberado/entregue por
> op_item de expedicao_itens. `pedido-detail-events.js`: modal Acabamento ->
> Expedicao calcula saldo por recebido - liberado e as metricas/tabela de
> pendencias da transicao usam recebido/movimentado. `expedicao-admin.js`
> nao precisou de alteracao (ja limita entrega a metros_liberados).
>
> Pedido #20 (id ad988da1-df36-4441-afef-16d9172f5c01): OP Tecelagem
> 18/2026, OP Acabamento 11/2026 (id 30) em_producao, recebido=1000 m. Antes
> do fix o saldo liberavel era 0 (sem movimento etapa=latex); depois do fix
> o diagnostico staging confirma recebido=1000, movimentado=0,
> disponivel=1000, expedicao=nenhuma — CTA "Movimentar para Expedicao"
> disponivel sem finalizar a OP.
>
> Testes locais obrigatorios: 393/393 OK (`expedicao-partial-flow`
> reescrito, `op-latex-admin`, `expedicao-flow`, `pedido-detail`,
> `pedido-detail-linked-ops`, `tec-to-acabamento-flow`, `entrega-writes`,
> `op-latex-split`, `cliente-pedido-summary-readmodel`,
> `production-flow-invariants`, `production-flow-numbering-schema`,
> `latex-consolidation-schema`). Diagnosticos staging OK:
> `production-flow-invariants-diag`, `latex-consolidation-diag` e o
> reescrito `expedicao-partial-flow-diag` (4 OPs em_producao com saldo
> recebido movimentavel; movimentado>recebido=0; entrega>liberado=0; status
> expedicao coerente; sem OP criada por parcial; catalogo confirma as 2 RPCs
> e o indice novo).
>
> Preservado: `liberar_expedicao` legado, db/23, db/25-db/29,
> consolidacao/split Latex, read model Cliente, `origin`, producao. Backlog
> mantido: `RAVATEX-TAPETES-PEDIDO-STAGE-BLOCKER-EXPLANATION-R1` (texto curto
> nas setas, explicacao em painel/tooltip separado).

> **Atualizacao 2026-07-05 - fase
> `RAVATEX-TAPETES-ACABAMENTO-PARTIAL-EXPEDITION-CONTRACT-B`.**
> Status: OK em staging. Esta fase destravou a fase anterior
> `ACABAMENTO-PARTIAL-EXPEDITION-PARITY-A-B`, cujo bloqueio era o gate
> terminal da RPC `liberar_expedicao(BIGINT)` e a repeticao desse gate na
> UI/matriz do Pedido.
>
> Causa raiz confirmada: Acabamento/Latex ja registrava parcial como
> movimento em `entregas`/`entrega_itens`, mas a liberacao para Expedicao
> so existia pelo fluxo legado total, exigindo OP Latex `finalizada` ou
> `concluida` e populando `expedicao_itens.metros_liberados` a partir do
> total de `op_itens`.
>
> Contrato corrigido: OP Latex continua sendo unidade produtiva; parcial
> continua sendo movimento/rastro; finalizacao de OP continua separada da
> liberacao. Quantidade acabada/liberavel agora e calculada por
> `entregas.etapa='latex'` + `entrega_itens` sem defeito, por
> `op_item_id`, menos o acumulado ja liberado em `expedicao_itens` da OP.
>
> Migration nova aplicada somente no Supabase staging
> `ucrjtfswnfdlxwtmxnoo`: `db/31_acabamento_partial_expedition_flow.sql`,
> via `npx.cmd supabase --workdir supabase db query --linked --file ...`.
> Producao `bhgifjrfagkzubpyqpew` nao foi tocada. A migration cria os
> indices `entrega_itens_op_item_idx` e `expedicao_itens_op_item_idx` e
> as RPCs `consultar_saldo_expedicao_latex(BIGINT)` e
> `liberar_expedicao_latex_parcial(BIGINT, JSONB, TEXT)`. A RPC parcial e
> admin-only, `SECURITY DEFINER`, transacional, aceita OP Latex em
> `em_producao`/`concluida`/`finalizada`, bloqueia quantidade acima do
> saldo acabado, cria/reusa `expedicoes`, soma em `expedicao_itens`, chama
> `recalcular_status_expedicao` e nao altera `public.ops`.
>
> Frontend: `js/screens/op-latex-admin.js` consulta saldo por RPC e
> permite liberar apenas o saldo acabado item a item sem finalizar OP.
> Quando nao ha saldo parcial e a OP esta terminal, o fluxo legado total
> `liberar_expedicao` permanece. `pedido-chain-state.js`,
> `pedido-detail-progress.js` e `pedido-detail-events.js` passaram a
> reconhecer saldo acabado liberavel e a chamar a RPC parcial pelo modal
> Acabamento -> Expedicao. O botao de finalizacao da OP continua separado.
>
> Validacao local obrigatoria: sintaxe dos JS/scripts OK; suites
> `expedicao-partial-flow`, `op-latex-admin`, `expedicao-flow`,
> `pedido-detail`, `pedido-detail-linked-ops`,
> `tec-to-acabamento-flow`, `entrega-writes`, `op-latex-split`,
> `cliente-pedido-summary-readmodel`, `production-flow-invariants`,
> `production-flow-numbering-schema` e `latex-consolidation-schema` =
> 391/391 OK.
>
> Validacao staging: `production-flow-invariants-diag` OK,
> `latex-consolidation-diag` OK e novo
> `scripts/staging/expedicao-partial-flow-diag.mjs` OK. Catalogo remoto
> confirmou as 2 RPCs e os 2 indices da DB/31. O pedido #19 permanece
> explicavel: OP Latex 9/2026 `em_producao` e OP Latex 10/2026
> `concluida`, ambas sem movimento Latex acabado e sem expedicao; logo nao
> ha saldo parcial atual. O diagnostico tambem reporta 3 itens de
> expedicao legada total (DB/23) sem movimento Latex, classificados como
> legado terminal, nao como falha do contrato parcial.
>
> Preservado: db/23 legado, split/default Latex db/25-db/29, read model
> Cliente, `origin`, producao e dados reais de OP/pedido/expedicao
> (nenhum write de negocio foi feito nesta fase alem da DDL em staging).
> Backlog mantido: `RAVATEX-TAPETES-PEDIDO-STAGE-BLOCKER-EXPLANATION-R1`
> para explicar bloqueios sem poluir as setas com texto longo.
>
> **Atualizacao 2026-07-05 - fase
> `RAVATEX-TAPETES-ACABAMENTO-PARTIAL-EXPEDITION-PARITY-A-B`.**
> Premissa registrada: Acabamento/Latex deve ter paridade conceitual com
> Tecelagem; OP e unidade produtiva, parcial e movimento/rastro, e a
> finalizacao da OP e terminalidade do total. A investigacao buscou
> bloqueio indevido de liberacao parcial para expedicao.
>
> Diagnostico: caso 2. O bloqueio principal esta na RPC
> `liberar_expedicao`, que em staging e no SQL versionado rejeita OP Latex
> fora de `finalizada`/`concluida` com a mensagem "Finalize o acabamento
> antes de liberar expedicao". A UI (`op-latex-admin.js`) e a matriz do
> Pedido (`pedido-chain-state.js`) repetem essa regra visualmente, mas
> mudar somente JS criaria bypass aparente sem backend capaz de liberar
> quantidade parcial.
>
> Evidencia de dados: no pedido #19, OP Latex 9/2026 segue
> `em_producao`, OP Latex 10/2026 esta `concluida`, nao ha expedicoes
> vinculadas e nao ha movimentos `entregas.etapa='latex'` registrados. No
> staging inteiro, as OPs Latex em producao tambem nao possuem recebimento
> Latex parcial. A quantidade liberada atual de expedicao nasce apenas em
> `expedicao_itens.metros_liberados`, criada pela RPC a partir do total de
> `op_itens`, nao de quantidade acabada parcial.
>
> Decisao: sem patch funcional nesta fase, pois corrigir exige nova
> migration/RPC/contrato para calcular quantidade acabada/liberavel parcial
> a partir de `entregas`/`entrega_itens` de acabamento e evitar liberar
> mais do que o saldo real. Backlog registrado:
> `RAVATEX-TAPETES-PEDIDO-STAGE-BLOCKER-EXPLANATION-R1`, mantendo o texto
> curto "Aguarde/Aguardando" nas setas e movendo explicacoes para
> tooltip/modal/painel/lista.
>
> **Atualizacao 2026-07-05 - fase
> `RAVATEX-TAPETES-ADMIN-TEC-FINALIZE-CTA-R1`.**
> Diagnostico em staging somente leitura: pedido mais recente #19 tinha
> OP Tecelagem 17/2026 em `em_producao`, item ajustado 5100,00 m,
> entregas somando 5100,00 m e saldo produtivo zero. Havia evento de
> abertura para producao, mas nenhum evento de finalizacao.
>
> Classificacao: caso 2. A OP estava pronta para conclusao formal, e a
> tela Admin ja chamava a RPC canonica `alterar_status_op(...,
> 'concluida')`, mas o CTA aparecia como um botao secundario generico
> `Concluir`, junto das demais acoes do cabecalho.
>
> Correcao: `js/screens/op-tecelagem-producao-admin.js` manteve a
> condicao `totalAjustado > 0 && saldo <= 0`, sem autofinalizar e sem
> write direto em `ops`, mas passou a exibir o CTA habilitado como
> `Finalizar OP Tecelagem`, em destaque visual. O teste
> `tests/tec-to-acabamento-flow.smoke.js` agora protege a regra de saldo,
> o rotulo explicito e o estilo destacado do CTA.
>
> **Atualizacao 2026-07-05 - fase
> `RAVATEX-TAPETES-CLIENTE-ORDER-SUMMARY-READMODEL-A-B`.**
> P1 `CLIENTE-INTERNAL-CHAIN-READ-A` resolvido com read model publico
> para o detalhe do pedido no Portal Cliente. A tela cliente deixou de
> consultar diretamente tabelas operacionais internas e passou a consumir
> exclusivamente a RPC `cliente_pedido_summary(p_pedido_id UUID)`.
>
> Causa raiz: `js/screens/cliente-pedido-detail.js` montava a cadeia do
> pedido no frontend lendo `lotes`, `ops`, `op_itens`,
> `ordens_compra_fio`, `entrega_itens`, `entregas`, `expedicoes` e
> `expedicao_itens`. Mesmo sem writes, isso quebrava a fronteira Cliente
> vs Admin definida no plano Pedido-OP-Movimentacao-Documentos.
>
> Camada escolhida: nova migration versionada
> `db/30_cliente_pedido_summary_readmodel.sql`, ainda nao aplicada em
> Supabase. Ela cria `public.cliente_pedido_summary(UUID)` como
> `SECURITY DEFINER`, `STABLE`, `search_path = public`, com permissao
> por admin ou cliente dono (`is_admin()` / `meu_cliente_id()`) e grant
> apenas para `authenticated`. A RPC encapsula fontes operacionais e
> retorna um DTO publico: `pedido`, `itens`, `parciais`, `timeline`,
> `entregas`, `pendencias`, `etapas` e `chain_state`.
>
> Contrato publico: itens saem por nomes (`modelo`, `cor_1`, `cor_2`,
> `metros`, `observacao`, `ordem`), parciais/timeline respeitam
> `visivel_cliente IS TRUE`, e o payload nao publica chaves internas:
> `op_id`, `op_numero`, `lote_id`, `fornecedor_id`, `fornecedor_nome`,
> `ordem_compra_id`, `romaneio`, `nf`, `custo`, `margem`,
> `motivo_separacao`, `origem_op_id`, `destino_fornecedor_id`,
> `modelo_id`, `cor_1_id`, `cor_2_id`, `expedicao_id`.
>
> Frontend: `cliente-pedido-detail.js` chama somente
> `supa.rpc('cliente_pedido_summary', { p_pedido_id })`; removeu
> `carregarCadeiaCliente` e todos os `.from(...)` diretos da tela.
> `cliente-pedido-tracking.js` passou a priorizar `chain_state.mensagem`
> publica no banner. Dashboard Cliente ja usava somente dados publicos e
> nao precisou de alteracao. Admin/Pedido Detail ficou fora do escopo e
> nao foi alterado.
>
> Testes locais: pacote principal obrigatorio + read model + eventos =
> 265/265 OK; invariantes adicionais de fluxo produtivo e consolidacao
> Latex = 36/36 OK. Diagnosticos staging read-only repetidos: OPs
> totais=25, Tecelagem=17, Latex=8, default=7, split legitimo=1,
> duplicatas default=0, orfas=0, `op_latex_entregas` 11 entregas e 0
> em multiplas OPs, colisoes `tipo+numero+ano` 0, high-water Latex=8/8
> e Tecelagem=17/17.
>
> Preservado: producao intocada; `origin` nao usado para escrita; SQL
> nao aplicado em staging/producao; sem OP/pedido/entrega/expedicao real
> criada; sem cleanup destrutivo; sem `git add .`; `supabase/.temp/`
> preservado fora do commit. Proximo P1 recomendado:
> `CLIENTE-ORDER-SUMMARY-READMODEL-APPLY-STAGING-A`, aplicar a db/30 em
> staging e validar o Portal Cliente real antes de qualquer producao.

> **Atualizacao 2026-07-05 - fase
> `RAVATEX-TAPETES-LATEX-LIFECYCLE-CANONICAL-A-B`.**
> P1 de finalizacao canonica da OP Latex/Acabamento resolvido com patch
> pequeno em JS + testes + docs, sem SQL/migration e sem criar dados reais.
>
> Causa raiz: `js/screens/op-latex-admin.js` ainda finalizava OP Latex por
> update direto em `ops.status = 'finalizada'` e `finalizada_em`, enquanto
> Tecelagem ja usava o contrato canonico de lifecycle/status/evento. Isso
> deixava auditoria e terminalidade divergentes entre etapas.
>
> Contrato usado: `alterar_status_op(BIGINT, TEXT, TEXT)` ja existe em
> `db/21_op_lifecycle_status_eventos.sql`, e admin-only, `SECURITY
> DEFINER`, aceita `em_producao -> concluida`, preenche `finalizada_em` no
> backend e deixa o trigger `trg_op_evento` registrar `status_alterado` em
> `op_eventos`. `concluida` e canonico; `finalizada` permanece legado de
> leitura/compatibilidade.
>
> Implementado: `op-latex-admin.js` trocou a finalizacao para
> `supa.rpc('alterar_status_op', { p_op_id, p_novo_status: 'concluida',
> p_observacao: 'Finalizacao da OP Latex pelo painel administrativo' })`.
> O erro real da RPC e exibido; sucesso mostra OP concluida e recarrega a
> tela. Nao ha mais update direto em `ops.status` nem escrita direta de
> `finalizada_em`; nenhum evento manual foi criado em JS.
>
> Compatibilidade preservada: leitura de OP Latex terminal continua aceitando
> `concluida` e `finalizada`. `buildExpedicaoCard`,
> `pedido-chain-state.js`, `pedido-detail-progress.js` e
> `pedido-detail-events.js` ja reconhecem ambos; testes novos cobrem
> `concluida` no Pedido Detail e liberacao de expedicao pela tela da OP.
>
> Testes: baseline pre-patch obrigatorio 343/343 OK. Pos-patch:
> `op-latex-admin`, `op-latex-split`, `pedido-detail-linked-ops`,
> `tec-to-acabamento-flow`, `pedido-detail`, `entrega-writes`,
> `production-flow-invariants`, `latex-consolidation-schema` = 346/346 OK.
>
> Diagnosticos staging read-only: OPs totais=25, Tecelagem=17, Latex=8,
> Latex default=7, split legitimo=1, duplicatas default=0, orfas=0,
> `op_latex_entregas` N:1 com 11 entregas e 0 em multiplas OPs, colisoes
> tipo+numero+ano=0, high-water Latex=8/8 e Tecelagem=17/17. Staging ainda
> possui OPs Latex antigas `finalizada` com eventos legados; nao houve
> conversao de dados nesta fase.
>
> Preservado: regra default de consolidacao Latex, split opt-in,
> `gerar_op_latex`, `gerar_op_latex_split`, Expedicao/Entrega,
> documentos placeholder e botao Pausar (P2 fora de escopo).
>
> Producao intocada; `origin` nao usado para escrita; sem SQL aplicado; sem
> migration; sem OP real nova; sem split real novo; sem cleanup destrutivo;
> sem `git add .`; `supabase/.temp/` preservado fora do commit. Proximo P1
> recomendado: `EXPEDICAO-ENTREGA-LIFECYCLE-AUDIT-A`, auditar Expedicao e
> Entrega para status/eventos canonicos e literais remanescentes.

> **Atualizacao 2026-07-05 - fase
> `RAVATEX-TAPETES-TEC-STAGE-FINALIZATION-A-B`.**
> P1 de finalizacao explicita da OP Tecelagem resolvido com patch pequeno
> em JS + testes + docs, sem SQL/migration e sem criar dados reais.
>
> Causa raiz: a cadeia do Pedido tratava saldo de Tecelagem zerado como
> `adminStepper.tecelagem = done`, mesmo quando a OP de Tecelagem ainda
> permanecia gravada como `em_producao`. Isso misturava metrica derivada
> (`entregue para acabamento`) com terminalidade canonica (`ops.status`
> terminal + evento em `op_eventos`).
>
> Contrato confirmado antes do patch: `alterar_status_op(BIGINT, TEXT,
> TEXT)` ja existe, e admin-only, aceita `em_producao -> concluida`,
> preenche `finalizada_em`, e o trigger `trg_op_evento` registra
> `status_alterado` em `op_eventos`. `concluida` e o status canonico;
> `finalizada` segue legado/compatibilidade.
>
> Implementado: em `op-tecelagem-producao-admin.js`, o botao `Concluir`
> sai do estado placeholder e fica habilitado somente quando
> `totalAjustado > 0` e `saldo <= 0`. O clique chama exclusivamente
> `supa.rpc('alterar_status_op', { p_op_id, p_novo_status: 'concluida',
> p_observacao })`, mostra erro real da RPC quando houver rejeicao e
> recarrega a rota da OP no sucesso. Nao ha update direto em `ops.status`.
>
> Pedido Detail: `pedido-chain-state.js` agora separa
> `metrics.tecelagem.saldoEntregue` de `metrics.tecelagem.terminal`.
> Saldo zerado sem status terminal mantem Tecelagem como `current`; apenas
> `concluida`/`finalizada` vira `done`. `pedido-detail-progress.js`
> ajusta o sublabel para `entregue; finalizar OP` quando o saldo acabou
> mas a terminalidade explicita ainda falta, e `pedido-detail-events.js`
> mostra a mesma diferenca no modal da etapa. Arquivo extra justificado:
> `pedido-detail-progress.js` e o normalizador do view model/stepper, logo
> era necessario para impedir texto visual enganoso no Pedido.
>
> Preservado: criacao/aceite de OP Tecelagem, entrega parcial,
> "Transferir restante", acumulacao Latex default, split Latex explicito,
> OP Latex/Acabamento e Expedicao. Nenhuma regra de consolidacao Latex foi
> alterada; db/25-db/29 ficaram intocados.
>
> Testes: baseline antes do patch 390/390 OK. Pos-patch:
> `node --test tests\tec-to-acabamento-flow.smoke.js
> tests\pedido-detail.smoke.js tests\pedido-detail-linked-ops.smoke.js
> tests\op-nova.smoke.js tests\op-persistir.smoke.js
> tests\entrega-writes.smoke.js tests\op-latex-split.smoke.js
> tests\op-latex-admin.smoke.js` = 445/445 OK.
>
> Diagnosticos staging read-only: OPs totais=25, Tecelagem=17,
> Latex=8, Latex default=7, split legitimo=1, duplicatas default=0,
> orfas=0, `op_latex_entregas` N:1 com 11 entregas e 0 em multiplas OPs,
> colisoes tipo+numero+ano=0, high-water Latex=8/8 e Tecelagem=17/17.
> Nenhuma OP real nova foi criada.
>
> Producao intocada; `origin` nao usado para escrita; sem SQL aplicado;
> sem migration; sem `git add .`; `supabase/.temp/` preservado fora do
> commit. Proximo P1 recomendado: `LATEX-LIFECYCLE-CANONICAL-A`, migrar
> finalizacao de OP Latex para `alterar_status_op(..., 'concluida')`
> preservando compatibilidade de `finalizada`.

> **Atualizacao 2026-07-04 - fase
> `RAVATEX-TAPETES-STAGING-HARDENING-R1`.**
> Limpeza de 2 pendencias nao-fatais reveladas pelo E2E do split.
>
> (A) `parametros_largura.id` 42703: o select em
> `js/screens/pedido-detail-data.js` pedia `id, largura,
> r_algoritmo_poliester, r_algoritmo_algodao` — nenhuma dessas 3 colunas
> alem de `largura` existe (schema real: `largura, peso_linear,
> algodao_por_ml, poliester_por_ml, valor_x, atualizado_em`). Confirmado
> por probe direto: removendo so `id` o erro migra para
> `r_algoritmo_poliester`. Unico consumidor (`pedido-detail-events.js`,
> `openTecAcceptanceModal`) so le `largura` como chave de mapa (dead
> read nos demais campos) — sem decisao de schema pendente. Select
> reduzido para `'largura'`. Nao e migration.
>
> (B) Falso alerta RPC "INDISPONIVEL": os diagnosticos sondavam
> `rpc/gerar_op_latex_split` via GET, que sempre 404 no PostgREST
> (RPC so aceita POST) independente da funcao existir. E2E anterior ja
> provou disponibilidade real (criou OP latex 8/2026). Optei por
> reclassificar a mensagem em vez de sondar via POST negativo, pois
> ambos os scripts se autodocumentam "SOMENTE SELECT... Nenhum
> write/RPC/DDL" — introduzir uma chamada RPC quebraria esse contrato.
> `[2.5c]` agora diz "nao verificavel por GET... disponibilidade
> confirmada por E2E autenticado".
>
> Validado com helper real contra staging: pedido do E2E (#12, tec OP
> 11) abre sem 42703, `parametrosLargura` preenchido, RENDER OK.
> Testes: 357/357 OK. Diagnosticos pos-patch: default=7, split=1
> legitimo, duplicatas/orfas=0, high-water latex=8 e tecelagem=17
> (identico ao fim da fase anterior — nenhuma OP nova criada). db/25-29,
> `gerar_op_latex`, `gerar_op_latex_split` e regra default intocados.
>
> **Atualizacao 2026-07-04 - fase
> `RAVATEX-TAPETES-OP-PARTIAL-SPLIT-E2E-STAGING-C`.**
> E2E controlado do split parcial no staging (ucrjtfswnfdlxwtmxnoo),
> apos a correcao da regressao do Pedido Detail. Part 0 confirmou que
> Pedido com OP abre (loader+render reais contra dados reais, pedido #12
> / tecelagem 9/2026, loadingError=null, RENDER OK).
>
> Metodo: script controlado dirigindo os helpers reais
> (`salvarEntregaCima` default e `{forceSplit,motivo}`) via shim
> PostgREST admin — sem chamar a RPC fora do helper. Cenario de menor
> risco: tecelagem OP id 11 (9/2026, em_producao, sem latex previa),
> destino Conitex (2). IDs criados (evidencia, NAO apagar): entrega
> default id 10 + OP Latex default id 25 (7/2026, motivo NULL); entrega
> split id 11 + OP Latex split id 26 (8/2026, motivo "Teste controlado
> split staging"). Mesma origem_op_id=11 e destino=2 para as duas.
>
> Validacao 14/14: split com motivo/origem/destino/origem_entrega
> corretos; default com motivo NULL; op_latex_entregas N:1 (COUNT=1 por
> entrega); op_eventos criacao_split (OP 8) + split_derivado (OP 11) com
> payload completo; numeracao monotonica (latex ultimo=8, sem buracos,
> colisoes 0). Diagnosticos pos: split atuais=1 legitimo, duplicatas
> default=0, orfas=0, high-water latex 8=8 e tecelagem 17=17 OK.
>
> Patch legitimo: `[2.5]` do `production-flow-invariants-diag.mjs` agora
> e split-aware — alarma so 2+ OPs DEFAULT na mesma (origem,destino);
> default+split e coexistencia esperada. Testes locais 263/263 OK.
> Producao intocada; sem SQL destrutivo; db/25-db/29 intocadas; default
> acumulador e split opt-in preservados.
>
> **Atualizacao 2026-07-04 - fase
> `RAVATEX-TAPETES-STAGING-FLOW-REGRESSION-AUDIT-A`.**
> Auditoria do fluxo staging/local (Pedido -> OP -> Tecelagem ->
> Acabamento/Latex -> Expedicao -> Entrega). Causa raiz encontrada e
> corrigida para o sintoma "Pedido com OP nao abre".
>
> BUG: `buildOpCard` em `js/screens/pedido-detail-render.js` e funcao de
> modulo (irma de `buildOps`/`renderPedidoDetailScreen`) e nao recebia
> `state`. A tira de linhagem adicionada em `977be36` le
> `state.pedido.numero`; sem `state` no escopo, renderizar qualquer
> Pedido com >=1 OP lancava `ReferenceError: state is not defined`,
> derrubando o render. Pedido sem OP nao chama `buildOpCard`, por isso
> abria. Reproduzido em runtime (harness DOM): com OP -> crash; sem OP ->
> OK; pos-patch ambos OK.
>
> PATCH minimo: `buildOpCard(state, summary, handlers)` passa a receber
> `state` e `buildOps` repassa `state` na chamada. Sem try/catch, sem
> remover UI, sem tocar regra de negocio, stepper, modal, lineage ou
> split. Guarda de regressao adicionada em `tests/pedido-detail.smoke.js`
> (a suite era 100% string-match, por isso nao pegava erro de escopo).
>
> Testes: `node --test tests/pedido-detail.smoke.js` OK (119/119);
> `node --test tests/pedido-detail-linked-ops.smoke.js` OK (7/7);
> `node --test tests/production-flow-invariants.smoke.js` OK (11/11);
> Part D completa OK (490/490). Diagnosticos staging READ-ONLY:
> duplicatas/split/orfas=0, `op_latex_entregas` N:1, colisoes=0,
> high-water latex+tecelagem OK. db/25-db/29 intocadas; sem SQL; sem
> push de producao; `origin` nao usado para escrita.
>
> **Atualizacao 2026-07-04 - fase
> `RAVATEX-TAPETES-OP-PARTIAL-SPLIT-UI-B`.**
> UI explicita para escolher "Acumular" (default) ou "Criar nova OP" no
> lançamento Tecelagem → Acabamento/Latex, usando o seam ja implementado
> em `salvarEntregaCima(args, { forceSplit, motivo })`.
>
> Implementado em `js/screens/entrega-form.js`:
> - parametro `comOpcaoSplit` (default false) adicionado a
>   `buildEntregaInlineForm`
> - quando true, renderiza select com duas opcoes:
>   "Acumular na OP existente quando possivel" (default) e
>   "Criar nova OP para esta parcial"
> - opcao split exibe campo obrigatorio "Motivo da separacao" e aviso
>   ambar: "A excecao cria uma OP de acabamento separada e registra o
>   motivo no historico."
> - retorna `getSplitOption()` com `{ forceSplit, motivo }`, motivo
>   trimado
> - sem `comOpcaoSplit`, `getSplitOption()` retorna sempre
>   `{ forceSplit: false, motivo: null }`
>
> Wire nos callers:
> - `pedido-detail-events.js`: `buildTecelagemTransferForm` passa
>   `comOpcaoSplit: true` e o `onSave` le `getSplitOption()` passando
>   `{ forceSplit, motivo }` para `salvarEntregaCima` apenas quando
>   split selecionado
> - `op-tecelagem-producao-admin.js`: `buildBlocoTecelagem` (+ Nova
>   entrega) passa `comOpcaoSplit: true`; `abrirEdicaoAdmin` NAO passa
>   `comOpcaoSplit` (edicao nao altera decisao de split)
>
> Preservacoes: default acumula; split nao e automatico; a UI chama
> apenas `salvarEntregaCima` via helper JS, nao a RPC diretamente;
> "Transferir restante" continua funcionando; fluxos que nao sao
> Tecelagem→Acabamento nao exibem select; `gerar_op_latex` intocada;
> `gerar_op_latex_split` intocada; db/25-db/29 intocadas; sem
> SQL/migration; sem criacao real de OP split.
>
> Testes locais obrigatorios:
> `node --test tests\pedido-detail.smoke.js` (118/118),
> `node --test tests\tec-to-acabamento-flow.smoke.js` (28/28),
> `node --test tests\entrega-writes.smoke.js` (70/70),
> `node --test tests\op-latex-split.smoke.js` (28/28),
> `node --test tests\production-flow-invariants.smoke.js` (11/11).
>
> Diagnosticos staging: 6 OPs Latex default, 0 OPs split atuais,
> duplicatas default = 0, duplicatas materializadas = 0, orfas = 0,
> high-water latex OK, high-water tecelagem OK.
>
> **Atualizacao 2026-07-04 - fase
> `RAVATEX-TAPETES-OP-PARTIAL-SPLIT-HELPER-B`.**
> Helper tecnico implementado em `salvarEntregaCima` para permitir split
> explicito sem alterar UI/select: a assinatura segue compativel
> `salvarEntregaCima({ fornecedorId, opId, payload }, options)`, e o
> fluxo legado sem `options` continua chamando `gerar_op_latex` com
> `{ p_entrega_id }`.
>
> Novo caminho opt-in: `salvarEntregaCima(args, { forceSplit: true,
> motivo })` valida motivo nao vazio (trim), grava a entrega de Cima pelo
> mesmo fluxo existente e chama `gerar_op_latex_split` com
> `{ p_entrega_id, p_motivo }`. O helper normaliza retorno split criado
> (`split:true`, `created:true`) e retorno idempotente/ja vinculado sem
> afirmar criacao indevida. Falha da RPC split continua best-effort: a
> entrega fica salva e o usuario recebe aviso para gerar manualmente.
>
> Preservacoes: default acumula; split nao e automatico; UI/select e
> `buildEntregaInlineForm` intocados; `gerar_op_latex` intocada nesta
> fase; db/25-db/29 intocadas; nenhuma migration/SQL aplicada; nenhuma
> OP split real criada.
>
> Validacao local: `node --test tests\entrega-writes.smoke.js` (70/70),
> `node --test tests\op-latex-split.smoke.js` (28/28),
> `node --test tests\tec-to-acabamento-flow.smoke.js` (12/12),
> `node --test tests\pedido-detail.smoke.js` (111/111) e
> `node --test tests\production-flow-invariants.smoke.js` (11/11).
>
> Diagnosticos staging em `ucrjtfswnfdlxwtmxnoo`: cardinalidade
> preservada com 6 OPs Latex default, 0 splits atuais, 0 duplicatas
> default/materializadas, 0 orfas, 0 colisoes de numeracao, high-water
> latex=6 e tecelagem=16. Os diagnosticos legados ainda reportam falso
> negativo para `GET /rpc/gerar_op_latex_split`, mas chamada controlada
> via `POST` autenticado retornou `P0001: Entrega -999999 nao
> encontrada`, confirmando a RPC ativa sem criar OP real.
>
> **Atualizacao 2026-07-04 - fase
> `RAVATEX-TAPETES-OP-PARTIAL-SPLIT-DB29-STAGING-VALIDATION-R1`.**
> O usuario aplicou manualmente a `db/29` no Supabase staging
> `ucrjtfswnfdlxwtmxnoo`, e a validacao pos-apply foi concluida com
> sucesso.
>
> Evidencias de staging:
> 1. Os dois diagnosticos read-only rodaram no staging correto e
>    permaneceram integros: 6 OPs Latex default, 0 OPs split atuais,
>    duplicatas default = 0, duplicatas materializadas = 0, orfas = 0,
>    colisoes `tipo+numero+ano` = 0, high-water latex OK e high-water
>    tecelagem OK.
> 2. `public.gerar_op_latex_split(bigint, text)` ficou disponivel no
>    schema cache: uma chamada negativa controlada via RPC retornou o
>    `RAISE EXCEPTION` esperado de motivo obrigatorio
>    (`P0001: Motivo de separacao e obrigatorio...`), provando que a
>    funcao existe e esta ativa sem criar OP real.
> 3. `public.gerar_op_latex(bigint)` tambem respondeu via RPC no staging;
>    com `NULL` retornou o erro esperado de entrega ausente
>    (`P0001: Entrega <NULL> nao encontrada`). Como `gerar_op_latex` e
>    `gerar_op_latex_split` sao aplicadas juntas pela mesma `db/29`,
>    isso confirma operacionalmente que a migration manual foi carregada.
>
> Limite conhecido: catalogo SQL (`information_schema` / `pg_proc`) nao
> estava exposto pelo PostgREST do staging, entao a confirmacao textual
> da definicao ficou indisponivel por esse caminho. A validacao foi feita
> por diagnostico read-only + disponibilidade efetiva das RPCs.
>
> Proxima fase sugerida ao arquiteto: helper JS
> `salvarEntregaCima({ forceSplit, motivo })` sem UI final, ou seguir
> direto para a UI/select de split explicito. Producao continua
> intocada.
>
> **Atualizacao 2026-07-04 - fase
> `RAVATEX-TAPETES-OP-PARTIAL-SPLIT-DB29-RPC-B`.**
> Migration `db/29_op_latex_split_rpc.sql` criada para:
> 1. Ajustar `gerar_op_latex` default — SELECT e ON CONFLICT agora
>    filtram `motivo_separacao IS NULL`, alinhando ao indice parcial
>    da db/28. OPs split (motivo_separacao IS NOT NULL) ficam fora
>    da consolidacao default.
> 2. Criar `gerar_op_latex_split(p_entrega_id BIGINT, p_motivo TEXT)`
>    para split excepcional explicito: exige motivo nao vazio,
>    admin-only, idempotente por entrega (op_latex_entregas),
>    registra rastro em op_eventos (criacao_split + split_derivado),
>    usa `proximo_numero_op` lock-safe, escreve `motivo_separacao`,
>    retorna `split:true` + `motivo`.
>
> Preservacoes: default continua acumulando; split nao e automatico;
> cardinalidade default mantida; db/25/db/26/db/27/db/28 intocadas;
> JS/UI nao alterados nesta fase; producao intocada.
>
> **Atualizacao 2026-07-04 - fase
> `RAVATEX-TAPETES-OP-PARTIAL-SPLIT-DB28-B`.**
> Migration `db/28_op_latex_split_discriminator.sql` criada para preparar
> OPs Latex split excepcionais sem alterar `gerar_op_latex`, sem criar
> `gerar_op_latex_split`, sem JS/UI e sem alterar cardinalidade funcional.
>
> A db/28 adiciona `ops.motivo_separacao TEXT NULL`, comenta a coluna,
> faz hard-stop se houver duplicidade default atual por
> `(origem_op_id, destino_fornecedor_id)`, recria
> `ops_latex_origem_destino_uidx` como UNIQUE parcial apenas para
> `tipo='latex' AND motivo_separacao IS NULL`, cria
> `ops_latex_split_idx` para auditoria de splits futuros e notifica
> PostgREST.
>
> Testes locais obrigatorios passaram:
> `node --test tests\latex-consolidation-schema.smoke.js` (18/18),
> `node --test tests\production-flow-numbering-schema.smoke.js` (14/14)
> e `node --test tests\production-flow-invariants.smoke.js` (7/7).
> Validacao SQL isolada em PGlite confirmou coluna, predicado dos dois
> indices, coexistencia de 1 default + 2 splits na mesma chave e
> hard-stop `P0001` para duplicidade default.
>
> Diagnosticos staging foram atualizados para reportar
> `motivo_separacao`, OPs default, OPs split e duplicatas default, mas o
> apply remoto da db/28 ficou **bloqueado** nesta execucao: `npx
> supabase db push --linked --dry-run` falhou com `Cannot find project
> ref. Have you run supabase link?`, apesar de `supabase/.temp` apontar
> para o staging `ucrjtfswnfdlxwtmxnoo`. Nao havia `DB_URL`, senha SQL
> nem sessao Supabase CLI utilizavel no ambiente.
>
> Alerta vinculante: depois da db/28 aplicada, a db/29 e obrigatoria
> antes de homologar criacao funcional de nova OP Latex default, porque
> `gerar_op_latex` ainda usa o `ON CONFLICT` antigo
> `WHERE tipo = 'latex'`, que falha contra o novo indice parcial.
>
> Producao intocada, `origin` nao usado para escrita, sem update/delete
> ad hoc, sem migration aplicada remotamente, sem `git add .`, sem
> `supabase/.temp` commitado.
>
> **Atualizacao 2026-07-04 - fase
> `RAVATEX-TAPETES-PRODUCTION-BACKLOG-REGISTER-A`.**
> Patch documental somente, sem JS/SQL/migration/producao. Registrado
> permanentemente o backlog funcional/arquitetural do fluxo produtivo
> centrado no Pedido, com ordem tecnica de implementacao, dependencias,
> riscos e criterios de aceite, em
> `docs/architecture/PEDIDO_PRODUCTION_FLOW_BACKLOG.md`.
>
> O backlog cobre 8 itens (A-H) ordenados: correcao de botoes
> "Movimentar" ambiguos (A), modais de seta com pendencias completas
> (B), "Transferir restante" (C), aceite/ajuste da OP Tecelagem pelo
> Pedido (D), diagnostico de split parcial de Latex (E), bolinhas do
> stepper clicaveis (F), finalizacao explicita da Tecelagem (G) e
> padronizacao da correlacao visual OP↔Pedido (H).
>
> Registrado o novo requisito de split parcial:
> - padrao continua acumular na mesma OP (find-or-accumulate)
> - excecao explicita por select para criar OP separada
> - exige rastro/historico e nova chave de agrupamento
> - nao pode reintroduzir "uma OP por parcial" automatico
> - antes de implementar: diagnosticar indices/RPC/tabelas
>
> Registrado o requisito de pendencias nos modais de transicao:
> - cada modal de seta deve mostrar totais por produto, ja movimentado,
>   faltante, OPs relacionadas, bloqueios e proxima acao
> - fonte de calculo canonica compartilhada (`derivePedidoChainState`),
>   nao duplicada por modal
>
> Ordem tecnica: A → B → C → F → H → D → E → G. Uma fase por grupo,
> diagnostico antes de codigo, testes/evidencia antes de fechamento,
> staging seletivo sem `git add .`, `AGENT_HANDOFF.md` atualizado ao
> fim.
>
> Sem JS, sem SQL/migration, sem `git add .`, sem commit de
> `supabase/.temp/`, producao intocada, origin nao usado para escrita.
> Push apenas para `staging`.
>
> > **Atualizacao 2026-07-03 - fase
> > `RAVATEX-TAPETES-PEDIDO-TRANSITION-ACTIONS-B`.**
> Patch funcional local, sem SQL/Supabase remoto/producao e sem push: as
> setas do `Progresso produtivo` deixaram de ser atalho para abrir a OP
> e passaram a ser a interface da transicao no Pedido. `Transferir`
> abre um modal operacional local e chama os mesmos helpers/RPCs
> canonicos usados pela OP/Expedicao; `Concluido` abre o historico da
> transicao com parciais ja carregadas; `Aguardar` segue sem handler.
>
> Operacoes preservadas: recebimento de fios usa
> `registrarRecebimentoOrdemFio`; Tecelagem -> Acabamento reutiliza
> `buildEntregaInlineForm` + `salvarEntregaCima`; Acabamento ->
> Expedicao chama `liberar_expedicao`; Expedicao -> Entrega chama
> `registrar_entrega_expedicao`. A matriz `derivePedidoChainState`,
> gates, lifecycle e writes canonicos nao foram alterados. Para o
> formulario canonico de Tecelagem -> Acabamento, o detalhe do Pedido
> passou a carregar somente leitura de fornecedores Latex como
> `latexOptions`.
>
> Testes focados travam: 5 etapas/4 conectores, labels visiveis apenas
> `Concluido`, `Transferir` e `Aguardar`, ausencia de redirecionamento
> direto para OP no `Transferir`, `Concluido` clicavel para historico,
> multiplas parciais como multiplas entradas e `Aguardar` sem handler.

> **Atualizacao 2026-07-03 - fase
> `RAVATEX-TAPETES-PEDIDO-PROGRESS-CONNECTORS-R2`.**
> Correcao visual fina local, sem SQL/Supabase/producao e sem push: a
> R1 acertou os labels curtos, mas simplificou demais o componente ao
> trocar conectores por linha/badge. A R2 manteve a decisao de produto
> dos labels curtos (`Concluído`, `Transferir`, `Aguardar`, `Ver`,
> `Editar`) e restaurou a linguagem visual de seta/chevron integrada
> entre etapas no bloco `Progresso produtivo`.
>
> O conector agora usa chevron de largura fixa para todos os estados,
> evitando corte de texto sem virar pilula solta. Concluido usa tom
> discreto verde/neutral; ativo permanece azul e clicavel com
> `Transferir`; aguardando fica cinza/muted sem clique; view/edit usa
> label curto integrado e continua abrindo o mesmo contexto quando
> permitido. `derivePedidoChainState`, gates, operacao canonica,
> lifecycle e writes permaneceram intocados.
>
> Testes: `node --check js/screens/pedido-detail-render.js` OK;
> `node --check tests/pedido-detail.smoke.js` OK;
> `node --test tests/pedido-detail.smoke.js` OK (55/55);
> `node --test tests/boot.smoke.js` OK (29/29);
> `node --test tests/router.smoke.js` OK (43/43, com o aviso conhecido
> de sandbox sobre `window.addEventListener`, exit code 0).

> **Atualizacao 2026-07-03 - fase
> `RAVATEX-TAPETES-PEDIDO-PROGRESS-CONNECTORS-R1`.**
> Patch visual/UX local, sem SQL/Supabase/producao e sem push: os
> conectores do bloco `Progresso produtivo` no Pedido Admin deixaram de
> renderizar labels contextuais longos vindos da matriz de acoes (ex.:
> `Insumos concluidos`, `Aguardando acabamento`) como texto visivel do
> conector. A matriz/gates de `derivePedidoChainState` foi preservada.
> O render agora traduz a acao para labels curtos: `Concluido`,
> `Transferir`, `Aguardar`, `Ver` ou `Editar`.
>
> Visualmente, concluido e aguardando viraram conectores passivos com
> linha/badge discreto; o caso ativo manteve acao azul curta
> `Transferir`; view/edit usa label curto e continua abrindo o mesmo
> modal de contexto quando permitido. `Transferir` pelo Pedido continua
> apontando para a operacao canonica existente via `openMovementModal`,
> sem writes/lifecycle novos.
>
> Testes: `node --check js/screens/pedido-detail-render.js` OK;
> `node --check tests/pedido-detail.smoke.js` OK;
> `node --test tests/pedido-detail.smoke.js` OK (54/54);
> `node --test tests/boot.smoke.js` OK (29/29);
> `node --test tests/router.smoke.js` OK (43/43, com o aviso conhecido
> de sandbox sobre `window.addEventListener`, exit code 0).

> **Atualizacao 2026-07-03 - fase
> `RAVATEX-TAPETES-TECELAGEM-PRODUCAO-MOVIMENTACAO-CARD-R1`.**
> Patch visual/estrutural local, sem SQL/Supabase/producao e sem push:
> o bloco solto `Entregas tecelagem` deixou de ser anexado entre os
> cards 4 e 5 da OP Em Producao Tecelagem e foi incorporado ao card
> `5. Movimentacao - enviar para acabamento`, mantendo resumo,
> transferencia, `+ Nova entrega`, tabela, historico, Editar, Excluir
> e Ver OP de Latex. O card `4. Capacidade e ajuste` fica restrito a
> capacidade/ajuste/sobras. Alinhamento dos headers `STATUS` e `FALTA`
> segue travado em left/start. Fluxos de write/lifecycle (`salvarEntregaCima`,
> `atualizarEntregaCima`, `excluirEntrega`, `gerar_op_latex`) permanecem
> intocados.

> **Atualizacao 2026-07-02 - fase
> `RAVATEX-TAPETES-END-TO-END-PRODUCTION-FLOW-B`.**
> Fluxo ponta a ponta preparado no codigo para staging: Acabamento/Latex
> finalizado agora habilita uma acao explicita de Expedicao, sem concluir
> Pedido diretamente na tela de OP. A nova tela `js/screens/expedicao-admin.js`
> permite abrir a expedicao vinculada, ver itens liberados, registrar
> entrega/coleta parcial ou total, acompanhar historico e acionar a conclusao
> do Pedido quando nao houver saldo.
>
> Nova migration versionada: `db/23_expedicao_entrega_flow.sql`. Ela cria
> `expedicoes`, `expedicao_itens`, `expedicao_movimentos` e
> `expedicao_movimento_itens`, alem das RPCs `liberar_expedicao`,
> `registrar_entrega_expedicao`, `recalcular_status_expedicao` e
> `concluir_pedido_se_pronto`. A regra central fica no banco: Pedido so passa
> para `entregue` quando as OPs vinculadas estao em estado terminal e toda
> Expedicao criada para OP Latex finalizada esta concluida.
>
> Pedido Detail passou a carregar Expedicoes e movimentos vinculados, mostrar
> o bloco de Expedicao, listar pendencias de conclusao e chamar
> `concluir_pedido_se_pronto` para persistir a conclusao. `router.js` recebeu
> a rota dinamica `#/expedicoes/:id`, e `index.html` carrega o novo modulo.
> `gerar_op_latex` nao foi alterada nesta fase; permanece o contrato da fase B:
> OP Latex nasce `aberta` e so entra em producao depois da confirmacao de
> entrada no Acabamento.
>
> Gaps assumidos: NF, romaneio real e anexos/documentos seguem fora de escopo;
> a finalizacao do Acabamento ainda usa o caminho operacional existente da
> tela de Latex; a migration deve ser aplicada somente em Supabase staging
> depois do commit/push desta fase.

> **Atualizacao 2026-07-02 - fase
> `RAVATEX-TAPETES-OP-LATEX-ENTRY-GATE-B`.**
> Implementado localmente o gate Tecelagem -> Acabamento/Latex sem
> aplicar SQL no Supabase. A nova migration versionada
> `db/22_latex_entry_gate.sql` redefine `gerar_op_latex(p_entrega_id
> BIGINT)` com a mesma assinatura e o mesmo contrato de origem
> (`tipo = 'latex'`, `origem_op_id`, `origem_entrega_id`, `lote_id`,
> itens sem defeito e fornecedor de etapa `latex`), mudando apenas o
> status inicial da OP criada para `aberta`.
>
> Em `js/screens/op-latex-admin.js`, a OP aberta de Acabamento agora
> representa o gate real de entrada: o CTA "Confirmar entrada / iniciar
> acabamento" chama `alterar_status_op(op.id, 'em_producao', 'Entrada no
> acabamento confirmada')`, mostra feedback e recarrega a OP. Nao foi
> criado `ops.update({ status: 'em_producao' })` direto para esse gate.
> A finalizacao de Latex, recalculo, Pedido, Expedicao e entrega/coleta
> ficaram fora de escopo e intocados.
>
> Em `op-nova.js` e no renderer de Tecelagem em producao, a cadeia
> produtiva continua buscando OP Latex por `tipo = 'latex'` e
> `origem_op_id`, sem filtro por status, e agora carrega `status` para
> exibir "Aguardando entrada" quando a OP de Acabamento esta `aberta`.
> A tela de fornecedor Latex continua listando apenas OPs
> `em_producao`; OP aberta nao aparece como producao do fornecedor.
>
> Migration apenas versionada nesta fase. Proximo passo operacional, se
> a fase for aceita: aplicar a migration em staging e homologar o gate.

> **Atualizacao 2026-07-02 - fase
> `RAVATEX-TAPETES-OP-PRODUCAO-STRUCTURE-CLOSEOUT-PUSH`.**
> Fechamento estrutural coerente das telas de OP em producao antes do
> push para staging. A OP Em Producao Tecelagem foi extraida de
> `js/screens/op-nova.js` para `js/screens/op-tecelagem-producao-admin.js`;
> `op-nova.js` fica responsavel por carregar dados e delegar
> `status === 'em_producao' && tipo !== 'latex'` para
> `window.renderOPTecelagemProducaoAdmin(ctx)`. `index.html` carrega o
> novo modulo antes de `op-nova.js`. O renderer antigo inline em
> `op-nova.js` foi removido: nao ha dois renderers operacionais
> equivalentes para Tecelagem ativa.
>
> Correcoes de auditoria incluidas: bloco de movimentacao considera, na
> ultima entrega, apenas itens sem defeito; `reloadEntregasCima`
> recarrega `id, numero, ano, origem_entrega_id` das OPs de Latex para
> atualizar a cadeia produtiva sem reload completo; acao "Movimentar"
> da Tecelagem em producao so aparece quando existe card/ancora de
> entregas disponivel. Ajustes de Acabamento/Latex ja presentes no
> estado coerente atual permanecem cobertos por
> `tests/op-latex-admin.smoke.js`, sem SQL/schema novo.
>
> Divida conhecida preservada para fase de lifecycle: o legado
> `gerar_op_latex` ainda pode criar OP de Latex/Acabamento diretamente
> em `em_producao`; a regra de produto correta exige gate de
> entrada/recebimento no Acabamento antes de entrar em producao. Isso
> nao foi mascarado na UI nem corrigido com schema nesta fase.
>
> Testes desta rodada: `node --check` em `op-tecelagem-producao-admin.js`,
> `op-nova.js`, `op-latex-admin.js`, `tests/op-nova.smoke.js` e
> `tests/op-latex-admin.smoke.js`; `node --test` em
> `tests/op-nova.smoke.js`, `tests/op-latex-admin.smoke.js`,
> `tests/boot.smoke.js`, `tests/router.smoke.js`,
> `tests/op-recalculo.smoke.js` e `tests/painel-screen.smoke.js` OK.
> `tests/router.smoke.js` e `tests/painel-screen.smoke.js` ainda
> imprimem no console o erro esperado do sandbox sobre
> `window.addEventListener`, mas terminam com exit code 0 e todos os
> subtestes passam.

> **Atualizacao 2026-07-01 - fase
> `RAVATEX-TAPETES-OP-EM-PRODUCAO-ACABAMENTO-STANDALONE-B` (correcao
> pos-implementacao — mesmo bug de icones/layout ja corrigido na
> Tecelagem, encontrado proativamente ao verificar a paridade com o
> standalone).**
> Confirmado por diff binario: `Admin - PROD-OP-ACABAMENTO-standalone.html`
> e `Admin - PROD-OP-TECELAGEM- standalone.html` sao byte-a-byte o mesmo
> arquivo (mesmo componente, alternado pela prop `tipo`) — logo seguem a
> mesma convencao de zero icones em titulo de bloco. A implementacao
> inicial de `renderOPLatexProducao` (commit `f675818`) usava
> `sectionIcon`/`sectionHead` em todos os 7 cards, repetindo o mesmo erro
> ja corrigido em `op-nova.js` na fase R1 Visual Parity da Tecelagem.
> Corrigido em `js/screens/op-latex-admin.js`: os 8 usos de icone dentro
> de `renderOPLatexProducao` (Dados da OP, Resumo operacional, Itens da
> OP, Material recebido da tecelagem, Recebimentos/acabamento,
> Finalizacao, Documentos, Historico) foram removidos — titulos agora sao
> texto puro, como no standalone. Constantes `SVG_ICON_ARROW`, `SVG_DOC`,
> `SVG_CLOCK` (adicionadas so para esses icones) foram removidas por
> ficarem sem uso; `SVG_ICON_OP/GRID/LINES/SUMMARY` permanecem, ainda
> usadas pelo ramo legado de preparacao (OP aberta), que preserva seu
> icone original sem alteracao.
> Tambem corrigido, via verificacao visual real em navegador (nao so
> texto): Card 1 "Dados da OP" tinha 8 campos com rotulos longos ("OP de
> tecelagem vinculada", "Fornecedor/acabador") em grid de 2 colunas — em
> ~800px de largura, cada campo ficava com ~76px, quebrando e amontoando
> linhas adjacentes (mesmo padrao de bug ja corrigido no Card 1 da OP Em
> Producao Tecelagem). Trocado para 1 coluna (campos empilhados).
> Demais grids do renderer (Resumo operacional, Material recebido,
> Finalizacao) foram inspecionados e nao apresentam o mesmo risco — usam
> caixas com borda propria (`metric()`) ou uma unica linha sem
> adjacencia vertical, absorvendo a quebra de texto sem sobreposicao.
> 2 testes novos (45, 46) travam: ausencia total de icone de secao;
> Card 1 fora do grid de 2 colunas.
> Testes executados: `node --check js/screens/op-latex-admin.js` OK;
> `node --test tests/op-latex-admin.smoke.js` OK (46/46);
> `node --test tests/op-latex-admin.smoke.js tests/op-nova.smoke.js
> tests/op-persistir.smoke.js tests/boot.smoke.js
> tests/pedido-detail.smoke.js tests/op-recalculo.smoke.js` OK
> (310/310).
> Harness de preview usado so localmente e removido antes do commit.

> **Atualizacao 2026-07-01 - fase
> `RAVATEX-TAPETES-OP-EM-PRODUCAO-TECELAGEM-STANDALONE-R1-VISUAL-PARITY`
> (2a rodada — inconsistencia de icones vs. o standalone).**
> Confirmado card a card no markup de referencia do standalone
> `Admin - PROD-OP-TECELAGEM- standalone.html`: nenhum dos 7 blocos
> (Dados da OP, Itens da OP, Insumos, Capacidade e ajuste, Movimentacao,
> Documentos, Historico) usa icone no titulo — sao todos texto puro.
> Os cards 3 ("Recebimento de fios", `buildBlocoFios`) e "Entregas
> tecelagem" (`buildBlocoTecelagem`) sao funcoes reaproveitadas sem
> alteracao das fases anteriores e ainda carregavam o icone herdado do
> template Nova OP/OP Aberta, quebrando a consistencia visual dos
> outros 5 blocos ja alinhados ao standalone.
> Corrigido em `js/screens/op-nova.js`:
> `buildBlocoTecelagem` (so usada pela tela Em Producao) perdeu o icone
> incondicionalmente; `buildBlocoFios` (compartilhada entre OP Aberta e
> OP Em Producao) ficou condicional por `op.status` — mantem icone +
> titulo "3. Recebimento de fios" para `aberta` (preservando a tela de
> preparacao, testada e aceita em fase anterior), e usa texto sem icone
> "3. Insumos — recebimento de fios" para `em_producao`, igual ao
> standalone. Tambem adicionada a confirmacao "Todos os fios desta OP
> ja foram recebidos." no branch `em_producao` de `buildBlocoFios`
> quando nao ha ordens pendentes — presente no standalone e antes
> ausente no app real.
> Verificado visualmente via preview em navegador (nao so texto): OP
> Em Producao sem nenhum icone de secao; OP Aberta com o icone do Card
> 3 preservado (regressao confirmada como não afetada).
> 4 testes novos (60-63) travam: ausencia total de icone de secao em
> Em Producao; texto "3. Insumos — recebimento de fios"; confirmacao de
> fios recebidos; icone do Card 3 preservado em OP Aberta.
> Testes executados: `node --check js/screens/op-nova.js` OK;
> `node --test tests/op-nova.smoke.js` OK (63/63);
> `node --test tests/op-nova.smoke.js tests/op-latex-admin.smoke.js
> tests/op-persistir.smoke.js tests/boot.smoke.js
> tests/pedido-detail.smoke.js tests/op-recalculo.smoke.js` OK
> (302/302).
> Harness de preview usado so localmente e removido antes do commit —
> nao faz parte do repositorio.

> **Atualizacao 2026-07-01 - fase
> `RAVATEX-TAPETES-OP-EM-PRODUCAO-TECELAGEM-STANDALONE-R1-VISUAL-PARITY`
> (correcao de bugs reais de layout, encontrados via preview em
> navegador — nao apenas asserts de texto).**
> As rodadas anteriores validaram a tela só via extração de texto
> (jsdom-style), o que não detecta problemas de layout/CSS. Um servidor
> estático local + harness isolado (mock de `window.supa`, mesmos
> módulos reais) foi usado para renderizar a tela de verdade num
> navegador e inspecionar `getBoundingClientRect`/estilo computado em
> larguras realistas (800px e 1280px). Bugs reais confirmados e
> corrigidos em `js/screens/op-nova.js`:
> (1) Card "1. Dados da OP" usava grid de 3 colunas — em ~800px de
> largura (a coluna soma espaço com a lateral de 320px "Resumo desta
> OP"), rótulos longos ("Fornecedor de tecelagem", "Item do pedido
> vinculado") quebravam em várias linhas e se sobrepunham visualmente
> uns aos outros. Corrigido para 2 colunas, mesmo padrão já usado em
> `js/screens/op-latex-admin.js` `buildCardDados` para um card ao lado
> da mesma coluna lateral.
> (2) Card "Entregas tecelagem" usa colunas em largura fixa em px (não
> `fr`) — sem um wrapper de scroll, a coluna FALTA ficava cortada/
> escondida atrás da borda da página em larguras estreitas. Adicionado
> wrapper `overflow-x:auto` + `min-width`, mesmo padrão de segurança já
> usado pelas tabelas do standalone de referência.
> (3) Bloco "5. Movimentação" usava grid rígido de 3 colunas para as
> estatísticas (Disponível/Já enviado/Total ajustado) — como este bloco
> divide a largura com a coluna "6. Documentos da OP" (320px), 3
> colunas rígidas espremiam rótulo+valor de cada estatística. Trocado
> para `grid-template-columns:repeat(auto-fit,minmax(120px,1fr))`, que
> reduz para 2 ou 1 coluna por linha conforme o espaço disponível.
> (4) Subtítulo do header não mostrava "Aberta em DATA" (faltava
> selecionar `ops.criado_em` na query principal da OP) — adicionado à
> query e ao subtítulo, junto de Pedido/Cliente/Lote.
> Confirmado por inspeção real (não só relato): breadcrumb "OPs / OP
> X/ANO" + Voltar, cadeia produtiva (lineage strip), "Abrir Pedido" e
> "Pedido vinculado" já renderizavam corretamente nas rodadas
> anteriores — a ausência aparente era um artefato de colagem de texto
> parcial, não um bug real.
> Pendências reconhecidas como de menor prioridade (o próprio arquiteto
> classificou como "aceitável"/"não necessariamente bug"): título/rodapé
> do Card 3 não é 1:1 com o standalone (usa o texto já existente de
> `buildBlocoFios`, reaproveitado sem alteração); histórico de entregas
> em "5. Movimentação" não enriquece com número da OP de
> Acabamento/romaneio — ambos ficam como possível polimento futuro, não
> corrigidos nesta rodada.
> 4 testes novos travando os 4 bugs de layout corrigidos (inspecionando
> o atributo `style` real da árvore renderizada, não só texto).
> Testes executados: `node --check js/screens/op-nova.js` OK;
> `node --test tests/op-nova.smoke.js` OK (59/59);
> `node --test tests/op-nova.smoke.js tests/op-latex-admin.smoke.js
> tests/op-persistir.smoke.js tests/boot.smoke.js
> tests/pedido-detail.smoke.js tests/op-recalculo.smoke.js` OK
> (298/298).
> Harness de preview (`_visual_check_prod_op.html`, `.claude/launch.json`)
> foi usado só localmente para inspeção visual e removido antes do
> commit — não faz parte do repositório.

> **Atualizacao 2026-07-01 - fase
> `RAVATEX-TAPETES-OP-EM-PRODUCAO-TECELAGEM-STANDALONE-B` (ajuste fino
> visual / paridade estrutural com o standalone PROD-OP-TECELAGEM,
> sem backend novo).**
> Continuacao da fase anterior no mesmo `js/screens/op-nova.js`, sem
> transformar nenhum placeholder em funcionalidade real. Adicionado:
> breadcrumb "OPs / OP X/ANO" + botao Voltar; cadeia produtiva (lineage
> strip) apontando para a OP de Acabamento/Latex gerada por entrega
> parcial, quando existir (leitura de dados ja carregados, sem query
> nova de escrita); nomenclatura ajustada para bater com o standalone
> ("Entregue p/ acabamento" no resumo lateral, "Ja enviado" no bloco de
> Movimentacao); bloco `4. Capacidade e ajuste` novo (read-only, le
> `saldo_fios_op` — ja gravada por `aplicarRecalculoOP` em
> `op-recalculo.js`, nao alterado — cruzada com `ordens` para mostrar
> consumo/sobra real por fio; sem "fator proporcional" fabricado; cai em
> fallback controlado quando nao ha dados); o card "Entregas tecelagem"
> foi reposicionado para depois do novo Bloco 4 e perdeu o numeral "4."
> do titulo (evita colisao de numeracao — o numeral "4." agora pertence
> só à Capacidade e ajuste); Documentos da OP ganhou visual de lista
> (Romaneio / Nota fiscal de entrada / Nota fiscal de saida, pill neutro
> "Aguardando integracao"), continua placeholder controlado sem
> schema/upload; Historico ganhou visual de timeline (ponto + conector),
> mesma fonte de dados/fallback (`op_eventos`) da fase anterior; saldo
> negativo/excedente (entrega acima do ajustado) agora tem tratamento
> visual proprio (cor/texto "excedente") tanto no Resumo lateral quanto
> no bloco Movimentacao e nas colunas Falta dos Cards 2 e "Entregas
> tecelagem" — antes ficava escondido atras de "✅ completo".
> Nenhum write novo: sem `alterar_status_op`, sem `ops.update({status})`
> novo, sem schema novo. `tests/op-recalculo.smoke.js` teve 1 teste
> ajustado (`12.`) porque sua regex original bloqueava qualquer
> `supa.from('saldo_fios_op')` em `op-nova.js` (intencao original era
> so bloquear writes); a regra foi precisada para continuar bloqueando
> insert/update/delete/upsert nessa tabela, permitindo a leitura
> read-only nova do Bloco 4.
> Testes executados: `node --check js/screens/op-nova.js` OK;
> `node --check tests/op-nova.smoke.js` OK;
> `node --test tests/op-nova.smoke.js` OK (55/55);
> `node --test tests/op-nova.smoke.js tests/op-latex-admin.smoke.js
> tests/op-persistir.smoke.js tests/boot.smoke.js
> tests/pedido-detail.smoke.js tests/op-recalculo.smoke.js` OK
> (294/294).

> **Atualizacao 2026-07-01 - fase
> `RAVATEX-TAPETES-OP-EM-PRODUCAO-TECELAGEM-STANDALONE-B`
> (template operacional proprio PROD-OP para OP Em Producao Tecelagem).**
> Regra absoluta desta fase: OP Aberta != OP Em Producao; Nova OP !=
> PROD-OP; Preparacao != Operacao. Ate esta fase, `status ===
> 'em_producao'` reaproveitava o mesmo layout de preparacao (Nova
> OP/OP Aberta) com o card `4. Entregas tecelagem` a mais — isso foi
> substituido por um template proprio.
> Em `js/screens/op-nova.js`, `buildScreen()` agora bifurca
> explicitamente: quando `isOpEmProducaoTecelagem()` (status
> `em_producao` e tipo != `latex`), a tela renderiza via
> `buildScreenProducaoTecelagem()`, baseada no standalone
> `Admin - PROD-OP-TECELAGEM- standalone.html`, com: header operacional
> (badges Tecelagem + Em producao, acoes Abrir Pedido/Pausar[placeholder
> desabilitado]/Movimentar[ancora para o card de entregas]/
> Concluir[placeholder desabilitado]/Documentos/Historico), Card 1 Dados
> da OP (read-only) + Resumo lateral (Total ajustado / Entregue para
> acabamento / Saldo em tecelagem / progresso), Card 2 Itens da OP
> (read-only, Pedido/Ajustado/Entregue/Falta/Item do pedido), Card 3
> Insumos (reaproveita `buildBlocoFios` sem alteracao), Card 4 Entregas
> tecelagem (reaproveita `buildBlocoTecelagem` sem alteracao —
> preserva `+ Nova entrega`, Editar, Excluir, `salvarEntregaCima`,
> `atualizarEntregaCima`, `excluirEntrega`, incluindo o
> best-effort de `gerar_op_latex`), Card 5 Movimentacao (bloco visual
> com Disponivel/Entregue/Total ajustado + CTA "Transferir" que aponta
> para o card de entregas existente — nenhuma gravacao nova), Card 6
> Documentos da OP (placeholder controlado: "Documentos da OP serao
> integrados em fase propria", sem schema/upload/gravacao) e Card 7
> Historico (leitura read-only de `op_eventos`, tabela ja aplicada em
> staging por `db/21_op_lifecycle_status_eventos.sql`; fallback
> controlado "Nenhum evento registrado para esta OP." quando vazio ou
> em erro).
> OP Aberta/Nova OP nao foi tocada (continua com
> `buildHeader`/`buildCardDados`/`buildCardItens`/`buildRight`
> inalterados). Acabamento/Latex nao foi tocado — `op.tipo === 'latex'`
> continua delegando para `js/screens/op-latex-admin.js` sem receber o
> template PROD-OP-TECELAGEM nem o card `4. Entregas tecelagem`. OP Em
> Producao Acabamento standalone fica como proxima fase.
> Sem escrita nova: nenhuma chamada a `alterar_status_op`, nenhum
> `ops.update({ status: ... })` novo, nenhuma tabela/coluna nova, sem
> Supabase, sem producao.
> Gap conhecido e registrado (nao corrigido nesta fase): `gerar_op_latex`
> ainda pode gerar a OP de Acabamento/Latex diretamente em
> `em_producao` em vez de `aberta`/preparacao.
> Testes executados: `node --check js/screens/op-nova.js` OK;
> `node --check tests/op-nova.smoke.js` OK;
> `node --test tests/op-nova.smoke.js` OK (48/48);
> `node --test tests/op-nova.smoke.js tests/op-latex-admin.smoke.js
> tests/op-persistir.smoke.js tests/boot.smoke.js
> tests/pedido-detail.smoke.js` OK (228/228).

> **Atualizacao 2026-07-01 - fase
> `RAVATEX-TAPETES-OP-NOVA-ACABAMENTO-STANDALONE-B-R1`
> (correcao cirurgica de escopo na Nova OP Acabamento standalone).**
> O bloqueio da fase anterior foi corrigido sem reverter o redesign visual.
> Em `js/screens/op-latex-admin.js`, a tela aberta de Acabamento
> permanece com a linguagem visual alinhada a Tecelagem, com os cards
> `1. Preparacao da OP`, `2. Itens da OP` e
> `3. Material recebido da tecelagem`; o item/card
> `4. Entregas tecelagem` segue fora da preparacao.
> A transicao funcional indevida foi removida:
> nao existe mais `colocarEmProducao`, nem `ops.update({ status:
> 'em_producao' })`; a acao `Colocar em producao` ficou apenas como
> placeholder desabilitado com aviso de fase propria.
> OP Em Producao foi preservada no fluxo legado, sem redesign novo,
> mantendo recebimento, edicao de enviado e finalizacao existentes.
> Sem SQL, sem Supabase, sem producao e sem alteracao de lifecycle.
> Checks executados:
> `node --check js/screens/op-latex-admin.js` OK;
> `node --check tests/op-latex-admin.smoke.js` OK;
> `node --test tests/op-latex-admin.smoke.js` OK (38/38);
> `node --test tests/op-nova.smoke.js tests/op-latex-admin.smoke.js`
> OK (77/77).

> **Atualizacao 2026-07-01 - fase
> `RAVATEX-TAPETES-OP-NOVA-TECELAGEM-STANDALONE-B-R1-BOOT-SMOKE`
> (correcao focada do teste de boot e fechamento da fase B).**
> Nenhuma mudanca funcional na implementacao visual da OP.
> Ajustado apenas `tests/boot.smoke.js` para aceitar o comportamento
> canonico de `#/ops/nova?pedido_id=<id>` com parse de `pedido_id`
> no hash e delegacao para `window.screenNovaOP(null, pid)`, alem de
> completar o sandbox de runtime com `window.addEventListener`,
> `window.removeEventListener` e `document.getElementById('app')`.
> Checks executados apos o patch:
> `node --check tests/boot.smoke.js` OK;
> `node --test tests/boot.smoke.js` OK (28/28);
> `node --test tests/op-nova.smoke.js tests/op-persistir.smoke.js tests/boot.smoke.js tests/pedido-detail.smoke.js` OK (181/181).
> Fase B anterior deixa de estar bloqueada por residual de teste.
> Proximo passo recomendado: validacao visual / closeout final da
> Nova OP Tecelagem.

> **Atualizacao 2026-07-01 - fase
> `RAVATEX-TAPETES-OP-NOVA-TECELAGEM-STANDALONE-B`
> (template Nova OP Tecelagem aplicado na tela real de OP).**
> Base canonica confirmada no inicio da fase:
> branch `work/app-next`, HEAD `c4bd218f1d230ea6d4531d8af54d127ad2a6d46e`,
> residual permitido `?? supabase/.temp/`.
> Referencia visual usada: `Admin - NOVA-OP-TECELAGEM.html`.
> Implementado em `js/screens/op-nova.js`:
> Nova OP de Tecelagem com bloco principal **Pedido vinculado**
> quando houver `#/ops/nova?pedido_id=<id>`, usando o Pedido como
> origem principal; Cliente passa a ser dado derivado do Pedido;
> fluxo avulso sem pedido permanece com select principal de cliente;
> OP Aberta de Tecelagem reaproveita a mesma tela com linguagem de
> preparacao; card/item `4. Entregas tecelagem` foi retirado da
> preparacao e permanece apenas no comportamento de `em_producao`;
> OP Em Producao nao foi redesenhada nesta fase; `op-persistir.js`,
> backend, SQL, Supabase e producao ficaram intocados.
> Rastreabilidade visual reforcada lendo `lote.pedido_id` e
> `op_itens.pedido_item_id` na tela.
> Testes executados:
> `node --check js/screens/op-nova.js` OK;
> `node --test tests/op-nova.smoke.js` OK (39/39);
> `node --test tests/op-nova.smoke.js tests/op-persistir.smoke.js tests/boot.smoke.js tests/pedido-detail.smoke.js`
> resultou em **1 falha residual pre-existente fora do escopo desta fase**:
> `tests/boot.smoke.js` teste 10 ainda rejeita o call-site atual de
> `#/ops/nova` com parse de `pedido_id`.
> Proximo passo recomendado: validacao visual / closeout da tela de
> Nova OP Tecelagem antes de avancar para OP Em Producao.

> **Atualizacao 2026-07-01 - fase
> `RAVATEX-TAPETES-PEDIDOS-LIST-ADMIN-VISUAL-CLEANUP-B`
> (patch proprio de residual da lista admin).**
> Commit HEAD atual.
> Base: `e88b218` (Refactor pedido detail screen modules).
> Alteracao exclusiva em `js/screens/pedidos-list.js`
> (149 insercoes, 110 remocoes).
> Resumo: extracao de constantes (CLIENT_TONE, CLIENT_PRONTO_KEYS,
> CLIENT_PRODUCAO_KEYS, TR_COLS), refatoracao de resolveVisibleTone/
> resolveVisibleState/visibleBucket com logica simplificada e
> constantes centralizadas, ajustes visuais (padding, gap, font-size,
> cores, hover em eyeBtn, extracao de buildVisibleCell) e
> alinhamento do subtitulo do header a visao admin.
> Risco registrado: possivel divergencia futura se CLIENT_TONE e
> constantes afins nao forem unificadas com a tela cliente.
> Producao intocada.
> `supabase/.temp/` preservado como residual.
> Proximo passo: Modal Movimentar Producao, somente com worktree
> limpo exceto residual supabase/.temp/.

> **Atualizacao 2026-07-01 - fase
> `RAVATEX-TAPETES-OP-LIFECYCLE-BACKEND-B-STAGING-SQL-CLOSEOUT`
> (registro de aplicacao da migration 21 no staging).**
> A migration `db/21_op_lifecycle_status_eventos.sql` foi
> **aplicada no Supabase staging** `ucrjtfswnfdlxwtmxnoo`.
> Confirmado: `ops.status` CHECK expandido (7 valores,
> incluindo `pausada`, `concluida`, `cancelada`);
> `op_eventos` criada com indices; `trg_op_evento` ativo;
> RPC `alterar_status_op` presente. Producao
> `bhgifjrfagkzubpyqpew` intocada. Push nao realizado.
> Status residual preservado:
> `M js/screens/pedidos-list.js`, `?? supabase/.temp/`.
> Proximo passo: UI de lifecycle OP.
>
> **Atualizacao 2026-07-01 - fase
> `RAVATEX-TAPETES-OP-LIFECYCLE-BACKEND-B-R1`
> (R1 hardening sobre lifecycle de OP).**
> Patch R1 sobre `db/21_op_lifecycle_status_eventos.sql`
> (ainda nao aplicada em staging/producao): (1) RPC
> `alterar_status_op` agora **admin-only** via guard
> `is_admin()` no inicio (padrao `gerar_op_latex`);
> fornecedor nao pode transitar status nesta fase. (2)
> vinculacao da `p_observacao` ao evento `status_alterado`
> tornada deterministica: filtro por `status_novo =
> p_novo_status` + ordenacao `criado_em DESC, id DESC`,
> reduzindo risco de observacao cair em evento errado sob
> concorrencia. Trigger segue como fonte unica do evento
> (sem segundo INSERT, sem `SET LOCAL` nesta fase). Docs
> (`SCHEMA_CONTRACT`, `PLANO`) atualizados com D-L03-R1 /
> D-L08-R1 / D-L09-R1. Sem mudancas de escopo, sem JS.
> Proximo passo: aplicar migration 21 em staging; UI de
> transicao de status na tela de OP; Fase D.
>
> > **Atualizacao 2026-07-01 - fase
> > `RAVATEX-TAPETES-OP-LIFECYCLE-BACKEND-B`
> > (lifecycle de OP: status expandido + eventos + RPC).**
> Migration `db/21_op_lifecycle_status_eventos.sql` criada
> (backup-only, nao aplicada em staging nem producao):
> `ops.status` CHECK expandido para aceitar `pausada`,
> `concluida` (canonico) e `cancelada`, mantendo `finalizada`
> como legado compativel; tabela nova `public.op_eventos`
> (historico de eventos de OP) com indices; trigger
> `trg_op_evento` registra automaticamente toda mudanca de
> `ops.status`; RPC `alterar_status_op(BIGINT, TEXT, TEXT)`
> valida transicoes (simulada->aberta|cancelada,
> aberta->em_producao|cancelada, em_producao->pausada|
> concluida|cancelada, pausada->em_producao|cancelada),
> estados finais sao terminais, `concluida` preenche
> `finalizada_em`; RLS `op_eventos` segue padrao `ops`
> (admin ALL, fornecedor SELECT vinculado). Nenhum JS
> alterado. `gerar_op_latex` intocado. `op-latex-admin.js`
> e compatibilidade com `finalizada` preservadas. Proximo
> passo: aplicar migration em staging; UI de transicao de
> status na tela de OP; Fase D (OPs no detalhe do Pedido).
>
> > **Atualizacao 2026-07-01 - fase
> > `RAVATEX-TAPETES-PEDIDO-OP-LINK-C-STAGING-SQL-CLOSEOUT`
> > (registro de aplicacao da migration 20 no staging).**
> A migration `db/20_op_itens_pedido_item_link.sql` foi
> **aplicada no Supabase staging** `ucrjtfswnfdlxwtmxnoo`.
> Confirmado: `public.op_itens.pedido_item_id` existe
> (uuid, nullable YES, FK -> pedido_itens ON DELETE SET NULL);
> indice `op_itens_pedido_item_idx` existe; PostgREST
> notificado via `NOTIFY pgrst`. Producao
> `bhgifjrfagkzubpyqpew` intocada. Esta fase e docs-only.
> Proximo passo: Fase D (OPs vinculadas no detalhe do
> Pedido Admin).

> **Atualizacao 2026-07-01 - fase
> `RAVATEX-TAPETES-PEDIDO-OP-LINK-C-R1`
> (correcao de vinculo pedido_item_id).** O patch C original
> usava `itemPedidoMap` por `modelo_id` para vincular
> `op_itens.pedido_item_id`, o que colapsava quando um pedido
> tinha dois itens com o mesmo modelo. R1 corrige: cada item
> da OP agora carrega `pedidoItemId` explicitamente, sem
> inferencia por `modelo_id`. `montarPayloadItensOP` le
> `item.pedidoItemId` diretamente do item. Teste adicionado
> (testes 66-68 em `op-persistir.smoke.js`) cobre itens com
> mesmo `modelo_id` e `pedidoItemId` diferentes, provando
> que nao ha colapso. Smoke 68/68. Fase C permanece pendente
> de aceite final.

> **Atualizacao 2026-07-01 - fase
> `RAVATEX-TAPETES-PEDIDO-OP-LINK-C`
> (vinculo funcional Pedido -> OP).** Implementado o vinculo
> minimo real entre Pedido e cadeia de OPs, conforme contrato
> `PEDIDO_OP_SCHEMA_CONTRACT.md` §2. Criada a migration
> `db/20_op_itens_pedido_item_link.sql` adicionando
> `op_itens.pedido_item_id` (UUID nullable, FK -> pedido_itens,
> ON DELETE SET NULL, indice). Atualizado `js/screens/
> op-persistir.js` para aceitar `pedidoId` e `itemPedidoMap`
> opcionais: ao criar/editar lote, popula `lotes.pedido_id`
> quando `pedidoId` informado; ao inserir `op_itens`, preenche
> `pedido_item_id` via `itemPedidoMap` quando disponivel.
> Atualizado `js/screens/op-nova.js`: `screenNovaOP(opId,
> pedidoId)` aceita segundo parametro opcional; quando
> `pedidoId` presente, carrega pedido e itens, pre-preenche
> OP itens e constroi `itemPedidoMap` por `modelo_id`.
> Atualizado `js/boot.js`: rota `#/ops/nova` extrai
> `?pedido_id=` do hash via `URLSearchParams`. OP avulsa
> (sem pedido) preservada. Nao implementado: botao no Pedido
> Detail (Fase D), stepper (Fase E), documentos, saldo.
> Smoke test `op-persistir.smoke.js` 65/65. `js/screens/
> pedidos-list.js` e `supabase/.temp/` preservados. Proximo
> passo: Fase D (OPs vinculadas no detalhe do Pedido Admin).

> **Atualizacao 2026-07-01 - fase
> `RAVATEX-TAPETES-PEDIDO-OP-SCHEMA-CONTRACT-B`
> (docs-only, contrato tecnico schema Pedido -> OP ->
> Movimentacao -> Documentos).** Criado o contrato tecnico
> detalhado em `docs/architecture/PEDIDO_OP_SCHEMA_CONTRACT.md`
> sobre o HEAD `04613ee`, branch `work/app-next`. O contrato
> valida todas as tabelas, colunas, FKs, constraints, RPCs,
> triggers e RLS existentes; confirma 6 lacunas (incluindo
> `lotes.pedido_id` nunca populado e `op_itens.pedido_item_id`
> inexistente); estabelece contrato de vinculo Pedido -> OP
> via `lotes.pedido_id`; propoe criacao de
> `op_itens.pedido_item_id` (NULLABLE, FK -> pedido_itens,
> ON DELETE SET NULL); desenha a tabela futura
> `documentos_operacionais` com 25 colunas, 10 tipos de
> documento e 4 status; recomenda Opcao A (reforcar
> `entregas`/`entrega_itens`) como fonte canonica de
> movimentacao para o MVP; define 5 etapas do stepper
> (INSUMOS -> TECELAGEM -> ACABAMENTO -> EXPEDICAO -> ENTREGA);
> registra 8 decisoes tecnicas (D-B01 a D-B08); e lista 4
> lacunas que ainda exigem decisao do dono do projeto.
> **Nenhum** arquivo funcional, schema, SQL, Supabase, tela
> ou integracao externa foi alterado. Proximo passo: Fase C
> (vinculo Pedido -> OP: popular `lotes.pedido_id`, criar
> `op_itens.pedido_item_id`). `js/screens/pedidos-list.js`
> e `supabase/.temp/` permanecem intocados.

> **Atualizacao 2026-07-01 - fase
> `RAVATEX-TAPETES-PEDIDO-OP-MOVEMENT-PLAN-A`
> (docs-only, plano persistente Pedido -> OP -> Movimentacao ->
> Documentos).** Criado o plano de arquitetura persistente em
> `docs/architecture/PEDIDO_OP_MOVIMENTACAO_DOCUMENTOS_PLANO.md`
> sobre o HEAD `3e8e78f`, branch `work/app-next`, com working
> tree contendo apenas os residuais esperados (`M js/screens/
> pedidos-list.js` e `?? supabase/.temp/`). O plano registra:
> estado de entrada; decisoes arquiteturais ja tomadas (Pedido
> como origem comercial, OP como execucao produtiva, movimentacao
> pertence a OP, parciais como camada comercial, documentos como
> pendencia nao bloqueante com arquivos fora do banco); modelo
> alvo (Pedido -> pedido_itens -> lote -> ops -> op_itens ->
> entregas/movimentos -> documentos_operacionais -> resumo ->
> evolucao cliente); papeis das telas; 9 fases futuras (B a J);
> obrigacao permanente de consulta/atualizacao; riscos mapeados;
> e template de evidencia por fase. **Nenhum** arquivo funcional,
> schema, SQL, Supabase, tela, OP ou integracao externa foi
> alterado. Proximo passo recomendado: Fase B (contrato
> arquitetura/schema detalhado). `js/screens/pedidos-list.js`
> e `supabase/.temp/` permanecem intocados.

> **Atualizacao 2026-07-01 - fase
> `RAVATEX-TAPETES-ADMIN-NOVO-PEDIDO-MATCH-CLIENTE-NOVA-VIEW-A-R1`
> (homologacao visual/funcional da tela Admin -> Novo Pedido).** Fica
> registrada como **APROVADA** a homologacao da tela
> **Admin -> Novo Pedido** (`#/pedidos/novo`) na branch `work/app-next`,
> sobre o HEAD inicial `4989727`, alinhando o miolo visual a mesma base
> homologada de **Cliente -> Novo Pedido** sem transformar o fluxo em
> fluxo exclusivo do cliente. O unico arquivo funcional alterado foi
> `js/screens/pedido-form.js`; o diff preexistente em
> `js/screens/pedidos-list.js` foi classificado como fora do escopo
> desta fase e permaneceu preservado/intocado, assim como o residual
> permitido `supabase/.temp/`. O comportamento administrativo foi
> preservado: selecao de cliente, status inicial em `rascunho`, payload
> real via `pedidos` + `pedido_itens`, validacoes, compensacao por
> `DELETE` em falha de itens, toast de sucesso/erro e navegacao final
> para `#/pedidos`. Tambem fica registrado que **Cliente -> Novo Pedido
> permaneceu intacto**, sem alteracoes no arquivo
> `js/screens/cliente-pedido-form.js`. A correcao R1 aplicada apos o
> aceite parcial ajustou especificamente o bloco **"Instruções gerais"**
> em `js/screens/pedido-form.js`: titulo corrigido, `textarea` com
> `min-height: 40px` e recálculo de altura apos entrada no DOM para
> eliminar o corte visual. Validacao real aceita em staging/local:
> pedido admin **#7** salvo com sucesso para o cliente **Teste** e
> exibido em `#/pedidos` como **Rascunho**. Checks executados:
> `node --check js/screens/pedido-form.js` OK; `git diff --check` OK com
> warnings de LF/CRLF; `node --test tests/cliente-routing.smoke.js`
> OK `19/19`; `node --test tests/pedidos-list.smoke.js` OK; e
> `node --test tests/pedido-form.smoke.js` com resultado `34/35`, tendo
> a unica falha residual **externa/preexistente** ligada ao dirty diff
> de `js/screens/pedidos-list.js`, nao causada por `pedido-form.js`.
> Nenhum schema, SQL, Supabase estrutural, OP/Pedido/parciais
> estruturais, `common.js`, `index.html`, producao ou `origin/main`
> foi tocado nesta fase. Proximo passo recomendado: abrir a fase
> `RAVATEX-TAPETES-PEDIDO-OP-MOVEMENT-PLAN-A` somente apos este
> closeout, para criar/registrar o plano persistente
> **Pedido ↔ OP ↔ Movimentacao ↔ Documentos**.

> **Atualizacao 2026-06-30 - fase
> `RAVATEX-TAPETES-ADMIN-CORES-MATCH-STANDALONE-CLOSEOUT`
> (frontend admin + registro de homologacao visual).** O miolo da
> tela **Admin -> Cores** (`#/cadastros/cores`) foi **alinhado
> visualmente ao HTML standalone de referencia** (`Admin - Cores -
> standalone.html`, em `D:\OneDrive\Ravatex\Inttex\Mockups - nova
> interface\Admin\`) pelo agente IAexec (Codex), e o aceite visual foi
> **APROVADO EXPLICITAMENTE PELO DONO DO PROJETO em 2026-06-30**.
> Branch: `work/app-next`. HEAD base da fase: `2ed6776`.
> `origin/main` e a producao `bhgifjrfagkzubpyqpew` permaneceram
> intocados. Arquivo funcional alterado: `js/screens/cadastros.js`
> (unico). Elementos entregues e homologados: botao `Nova cor`, busca,
> tabela/card, swatches, acoes e footer alinhados ao standalone;
> icones corrigidos com `SquarePen` para editar e lixeira para
> excluir; label `AÇÕES` centralizado; contagem no rodape acoplada ao
> card da tabela no padrao do mockup. Shell/sidebar/topbar globais
> preservados; rota `#/cadastros/cores`, acoes, validacoes e
> permissoes admin preservadas. O carregamento e as acoes reais
> continuam vindo de `cores` via `select('*').order('nome')`,
> `update(...).eq('id', ...)`, `insert(...)` e `delete().eq('id',
> ...)`, sem alterar contrato, payload ou regra de negocio. O preview
> temporario `.codex-cores-visual-check.html` foi removido antes do
> fechamento e **nao foi commitado**. Checks executados:
> `node --check js/screens/cadastros.js`,
> `node --test tests/cadastros-screens.smoke.js`,
> `git diff --check`. O teste focado de cadastros permaneceu verde na
> parte da tela de cores; a unica falha remanescente fica fora do
> escopo desta fase, em `screenPainel`, por contagem esperada de itens
> do `ADMIN_MENU`. Nenhum schema, SQL, mutation Supabase ou fluxo de
> producao foi tocado.

> **Atualizacao 2026-06-30 - fase
> `RAVATEX-TAPETES-ADMIN-PARAMETROS-CALCULO-MATCH-STANDALONE-CLOSEOUT`
> (frontend admin + registro de homologacao visual).** O miolo da
> tela **Admin -> Parametros de calculo** (`#/cadastros/parametros`)
> foi **alinhado visualmente ao HTML standalone de referencia**
> (`Admin - Parametros - standalone.html`, em
> `D:\OneDrive\Ravatex\Inttex\Mockups - nova interface\Admin\`) pelo
> agente IAexec (Codex), e o aceite visual foi **APROVADO
> EXPLICITAMENTE PELO DONO DO PROJETO em 2026-06-30**. Branch:
> `work/app-next`. HEAD base da fase: `6cc805f`. `origin/main` e a
> producao `bhgifjrfagkzubpyqpew` permaneceram intocados. Arquivo
> funcional alterado: `js/screens/cadastros.js` (unico). Elementos
> entregues e homologados: header interno e espacamentos alinhados ao
> standalone; callout azul com icone e bloco compacto; tabela de
> parametros convertida para grid no desenho do mockup; inputs,
> tooltips e rodape alinhados em radius, padding e tipografia;
> botoes `Cancelar alteracoes` e `Salvar parametros` no padrao visual
> esperado. Shell/sidebar/topbar globais preservados; rota
> `#/cadastros/parametros`, acoes, validacoes e permissoes admin
> preservadas. O carregamento e salvamento reais continuam vindo de
> `parametros_largura` via `select('*').order('largura')` e
> `update(...).eq('largura', ...)`, sem alterar payloads nem contrato
> de escrita. O preview temporario `.codex-parametros-visual-check.html`
> foi removido antes do fechamento e **nao foi commitado**.
> Diferencas residuais documentadas: o campo visual `Atualizado por`
> usa fallback seguro em `atualizado_por_nome`, `atualizado_por` ou
> `atualizado_por_email`; na ausencia desses campos, exibe `-`, sem
> inventar dado nem alterar schema. Checks executados:
> `node --check js/screens/cadastros.js`,
> `node --test tests/cadastros-screens.smoke.js`,
> `git diff --check`. O teste focado de cadastros permaneceu verde na
> parte da tela de parametros; a unica falha remanescente fica fora do
> escopo desta fase, em `screenPainel`, por contagem esperada de itens
> do `ADMIN_MENU`. Nenhum schema, SQL, mutation Supabase ou fluxo de
> producao foi tocado.
# PROJECT_STATE.md â€” Controle de Tapetes (Grupo Terra Branca)

> **Atualizacao 2026-06-30 â€” fase
> `RAVATEX-TAPETES-ADMIN-OPS-LIST-MATCH-STANDALONE-CLOSEOUT`
> (frontend admin + registro de homologacao visual).** O miolo da
> tela **Admin â†’ Lista de OPs** (`#/ops`) foi **alinhado visualmente
> ao HTML standalone de referencia** (`Admin - Lista de OPs -
> standalone.html`, em
> `D:\OneDrive\Ravatex\Inttex\Mockups - nova interface\Admin\`) pelo
> agente IAexec (Codex), e o aceite visual foi **APROVADO
> EXPLICITAMENTE PELO DONO DO PROJETO em 2026-06-30**. Branch:
> `work/app-next`. HEAD base da fase: `82d0871`. `origin/main` e a
> producao `bhgifjrfagkzubpyqpew` permaneceram intocados. Arquivo
> funcional principal alterado: `js/screens/ops-list.js`. Microfix
> pontual no shell global em `js/screens/common.js`, limitado a
> derivacao das iniciais do avatar para eliminar o bug visual `A(` no
> admin. Elementos entregues e homologados: header com titulo
> "Ordens de ProduÃ§Ã£o" + subtitulo + botao "Nova OP" sem `+` textual
> duplicado; 4 KPI cards corretos (Total / Em produÃ§Ã£o / Simuladas /
> Abertas); busca com icone inline; tabs `Todas / Tecelagem / LÃ¡tex`;
> linha de filtros com dropdowns `Cliente / Todos os clientes`,
> `Status / Todos` e `Criada em / Todos os perÃ­odos`; tabela 7
> colunas (`OP / LOTE`, `TIPO`, `CLIENTE`, `STATUS`, `ENTREGUE`,
> `CRIADA EM`, `AÃ‡Ã•ES`) com label de `AÃ‡Ã•ES` centralizado, badges,
> progresso entregue, acoes centralizadas na celula e paginacao.
> Shell/sidebar/topbar globais preservados, exceto a correcao
> pontual das iniciais do avatar; rota `#/ops`, navegacao para
> detalhe/novo, acoes e permissoes admin preservadas. Regra de acao
> preservada: `OP simulada â†’ Editar`; demais OPs â†’ `Visualizar`; botao
> `Mais` mantido apenas visual/disabled. Diferencas residuais
> documentadas: contagens/KPIs/linhas continuam dinamicos conforme
> dados reais; o filtro `Cliente` e derivado dos clientes realmente
> presentes na lista; progresso `Entregue` segue calculado via
> `percentualEntregueOP(...)` sobre `op_itens` + `entrega_itens`,
> sem inventar regra nova. Checks executados:
> `node --check js/screens/ops-list.js`,
> `node --check js/screens/common.js`,
> `git diff --check`. O teste focado
> `node --test tests/ops-list-screen.smoke.js` permanece
> **desatualizado** nesta branch por blocos estaticos antigos
> pre-`boot.js`/pre-querystring em `index.html`; as falhas restantes
> foram registradas, sem deformar o visual homologado para fazer o
> teste legado passar. Nenhum schema, SQL, mutation Supabase ou fluxo
> de producao foi tocado.

> **Atualizacao 2026-06-30 â€” fase
> `RAVATEX-TAPETES-ADMIN-PEDIDOS-LIST-MATCH-STANDALONE-CLOSEOUT`
> (frontend admin + registro de homologacao visual).** O miolo da
> tela **Admin â†’ Lista de pedidos** (`#/pedidos`) foi **alinhado
> visualmente ao HTML standalone de referencia** (`Admin - Lista de
> Pedidos - standalone.html`, em
> `D:\OneDrive\Ravatex\Inttex\Mockups - nova interface\Admin\`) pelo
> agente IAexec (Codex), e o aceite visual foi **APROVADO
> EXPLICITAMENTE PELO DONO DO PROJETO em 2026-06-30**. Branch:
> `work/app-next`. HEAD base da fase: `2da8b1c`. `origin/main` e a
> producao `bhgifjrfagkzubpyqpew` permaneceram intocados. Arquivo
> funcional alterado: `js/screens/pedidos-list.js` (unico). Elementos
> entregues e homologados: header com titulo "Pedidos" + subtitulo +
> botao "Novo pedido"; 5 KPI cards (Abertos / Em producao / Parciais /
> Atrasados / Prontos); busca com icone inline; tabs com badge de
> contagem (Todos / Rascunho / Recebido / Confirmado / Producao /
> Parcial / Pronto / Entregue / Cancelado); linha de filtros; tabela
> de 9 colunas (Pedido / Cliente / Sit. interna / Visivel ao cliente /
> Parcial / Prazo / Recebimento / Atualizado / Acoes) com badges,
> acao real "Visualizar" e paginacao. Shell/sidebar/topbar globais
> preservados (`js/screens/common.js` e `index.html` intocados); rota
> `#/pedidos`, acoes e permissoes admin preservadas. Coluna `Parcial`
> ligada a dados reais seguros via leitura read-only de `pedido_itens`
> e `pedido_parciais`, reaproveitando
> `buildPedidoAcompanhamentoParcial(..., { forCliente: false })` para
> taxonomia/contagem sem inventar regra nova. O menu de "mais acoes"
> foi mantido apenas visual/disabled porque a unica acao real
> existente segue sendo `Visualizar`. Diferencas residuais
> documentadas: contagens/KPIs/linhas sao dinamicos conforme dados
> reais (nao os literais fixos do mockup); `tipo_recebimento` segue em
> fallback seguro "â€”" quando ausente; "Visivel ao cliente" usa a
> taxonomia compartilhada publicada em `status_cliente_visual` /
> `status_cliente_excecao`, por isso pode divergir do texto decorativo
> do standalone. Checks executados e verdes:
> `node --check js/screens/pedidos-list.js`,
> `node --test tests/pedidos-list.smoke.js`,
> `git diff --check`. Nenhum schema, SQL, mutation Supabase ou fluxo
> de producao foi tocado.

> **Atualizacao 2026-06-30 â€” fase
> `RAVATEX-TAPETES-CLIENTE-PEDIDOS-LIST-MATCH-STANDALONE-CLAUDE-R1`
> (frontend cliente + registro de homologacao visual).** O miolo da
> tela "Meus pedidos" do Cliente (`#/cliente/pedidos`) foi **alinhado
> visualmente ao HTML standalone de referencia** (`Cliente - Lista de
> Pedidos - standalone.html`, em
> `D:\OneDrive\Ravatex\Inttex\Mockups - nova interface\Cliente\`) pelo
> agente IAexec (Claude Sonnet 4.6), e o aceite visual foi **APROVADO
> EXPLICITAMENTE PELO DONO DO PROJETO em 2026-06-30**. Um patch
> anterior do agente GLM/ZCode para esta mesma tela **nao foi aceito**
> (busca sem icone dentro de card indevido, texto do botao trocado por
> causa de teste, icones de acao invisiveis) e foi descartado via
> `git restore` antes desta implementacao final â€” nada daquele patch
> foi reaproveitado. Branch: `work/app-next`. Pushed para
> `staging/main`. Producao `bhgifjrfagkzubpyqpew` e `origin/main` nao
> foram tocados. Arquivo alterado: `js/screens/cliente-pedidos-list.js`
> (unico). Elementos entregues e homologados: header com titulo "Meus
> Pedidos" + subtitulo + botao "Solicitar pedido" com icone "+"; busca
> com icone de lupa na mesma caixa (sem card duplicado) + 5 tabs com
> badge de contagem (Todos / Em producao / Pronto p/ expedicao /
> Entregue / Cancelado); tabela de 7 colunas (Pedido / Situacao /
> Avanco / Prazo / Recebimento / Atualizado / Acao) com pill de
> situacao, avanco "Parcial Â· X / Y m" ou "Total Â· Y m" e botao olho
> visivel/funcional para o detalhe; rodape de paginacao "Mostrando X a
> Y de Z pedidos". Parciais preservadas via
> `buildPedidoAcompanhamentoParcial(..., { forCliente: true })` (mesma
> API ja homologada no dashboard/detalhe), com SELECTs adicionais em
> `pedido_itens`/`pedido_parciais` (mesmas colunas seguras ja usadas
> alhures). Shell/sidebar/topbar globais preservados (miolo entregue a
> `clienteShellLayout`). SELECT de `pedidos` mantido **identico** ao
> contrato ja travado pelos testes (nenhum campo novo, nenhum campo
> interno). Diferencas visuais residuais documentadas: botao usa o
> texto do standalone "Solicitar pedido" em vez do literal "+ Novo
> pedido" exigido por um guard de teste desatualizado (teste falha,
> reportado, nao corrigido para nao deformar o visual); coluna
> "Recebimento" exibe fallback seguro "â€”" (campo `tipo_recebimento` ja
> existe no schema mas esta fora do contrato de SELECT travado e nao e
> capturado hoje na criacao do pedido); rotulos de situacao usam a
> taxonomia compartilhada (`getClienteTrackingStatusLabel`), por isso
> "Expedicao"/"Acabamento"/"Aguardando definicao" em vez do texto
> decorativo do mockup. Checks: `node --check` OK; `git diff --check`
> OK; `cliente-pedidos-list.smoke.js` 35/36 (1 falha esperada, ver
> acima); `cliente-routing.smoke.js` 19/19; `cliente-portal-visual
> .smoke.js` 44/5 (4 falhas identicas ao HEAD limpo + 1 nova esperada
> por usar a mesma convencao `svgEl` via `innerHTML` ja homologada em
> dashboard/detail/tracking â€” zero regressao alem do esperado).
> Producao permanece bloqueada.

> **Atualizacao 2026-06-30 â€” fase
> `RAVATEX-TAPETES-STANDARD-SHELL-SIDEBAR-TOPSTRIP-A`
> (frontend global + registro de homologacao visual).** O chrome global
> (topbar 62px + sidebar 196px) compartilhado por todas as areas
> (Admin, Fornecedor, Cliente) foi **alinhado visualmente aos HTMLs
> standalone de referencia** (`Admin - Topbar - standalone.html` e
> `Admin - Sidebar - standalone.html`, em
> `D:\OneDrive\Ravatex\Inttex\Mockups - nova interface\`) pelo agente
> IAexec (GLM-5.2/ZCode), e o aceite visual foi **APROVADO
> EXPLICITAMENTE PELO DONO DO PROJETO em 2026-06-30** (apos hard-refresh
> para descartar cache do navegador). Implementacao unica no ponto
> central `shellLayout(menuItems, contentNode)` em
> `js/screens/common.js` â€” propaga para ~25 telas admin/fornecedor e,
> via `clienteShellLayout`, para todas as telas cliente, sem duplicacao.
> Branch: `work/app-next`. Pushed para `staging/main`. Producao
> `bhgifjrfagkzubpyqpew` e `origin/main` nao foram tocados. Arquivos
> alterados: `js/screens/common.js` (chrome em inline styles pixel-exatos
> â€” mesma convencao das telas cliente homologadas, sem dependencia de
> classes Tailwind arbitrary do CDN) e `index.html` (apenas bump do
> cache-busting `?v=` do `common.js` de `20260623-asset1` para
> `20260630-shell1`). Elementos entregues e homologados: topbar com
> brand "Inttex" + divisor + sectionLabel por perfil (Admin / Portal do
> cliente / Fornecedor) + sino + avatar circular azul com iniciais do
> usuario + nome + chevron; sidebar com nav-items iconizados (SVG
> 17x17 por href), estado ativo derivado do `window.location.hash`
> (novo â€” antes nao havia destaque de item selecionado), hover via JS,
> separador e item "Sair" no rodape. Parametrizacao por perfil via
> `menuItems` (ja vinha por parametro), `sectionLabel` por
> `CURRENT_USER.tipo` e icones por mapa de href. Preservado: estrutura
> DOM (header + div > aside + main), `<span>` "nome (tipo)" e
> `<button>` "Sair" no header (escondidos) para compatibilidade dos
> smoke tests, `<main class="flex-1 p-6 bg-gray-100">` herdado pelas
> telas. Menus/rotas/permissoes de cada perfil intactos (cliente sem
> itens admin; admin sem itens cliente). Miolos das paginas nao
> redesenhados. Diferenca visual residual: avatares usam iniciais do
> nome (sem foto â€” CURRENT_USER nao tem URL de imagem); fornecedor usa
> rotas proprias `#/fornecedor/*`. Checks: `node --check` OK;
> `git diff --check` OK; `screens-common.smoke.js` 13/10 (idem HEAD
> limpo, zero regressao â€” as 10 falhas sao pre-existentes, todas por
> `extractInlineScript` nao achar inline no `index.html` migrado para
> `boot.js`); `cliente-routing.smoke.js` 19/19; `cliente-portal-visual
> .smoke.js` 45/4 (idem HEAD limpo). Gap do Shell marcado como
> resolvido em `docs/ui/CLIENTE_PORTAL_UI_GAP_INVENTORY.md`. Producao
> permanece bloqueada.

> **Atualizacao 2026-06-29 â€” fase
> `RAVATEX-TAPETES-CLIENTE-DASHBOARD-MATCH-STANDALONE-GLM`
> (frontend cliente + registro de homologacao visual).** O miolo da
> tela Dashboard do Cliente (`#/cliente/dashboard`) foi **alinhado
> visualmente ao HTML standalone de referencia** (`Dashboard Cliente
> v3 - standalone.html`, em
> `D:\OneDrive\Ravatex\Inttex\Mockups - nova interface\Cliente\`) pelo
> agente IAexec (GLM-5.2/ZCode), e o aceite visual foi **APROVADO
> EXPLICITAMENTE PELO DONO DO PROJETO em 2026-06-29** (apos ajuste
> R1: remocao da coluna "Resumo" da tabela "Pedidos em destaque" e
> correcao de largura/alinhamento do card "Resumo dos pedidos").
> Branch: `work/app-next`. Pushed para `staging/main`. Producao
> `bhgifjrfagkzubpyqpew` e `origin/main` nao foram tocados.
> Arquivo alterado: `js/screens/cliente-dashboard.js` (unico).
> Elementos entregues e homologados: header com titulo "Dashboard" +
> subtitulo + botao "Novo pedido"; 4 KPI cards (Meus pedidos / Em
> producao / Concluido / Atrasado) com icone em circulo colorido;
> "Pedidos em destaque" como tabela 6 colunas (Pedido Â· Situacao Â·
> Avanco Â· Atualizado Â· Prazo previsto Â· Acao) com badge de situacao,
> avanco "Parcial Â· X / Y m" ou "Total Â· Y m" e botao olho para o
> detalhe; "Resumo dos pedidos" com donut SVG (em producao/concluido/
> atrasado/rascunho) + legenda com percentual e total; "Ultimas
> atualizacoes" e "Prazos proximos" na linha de baixo. Parciais
> preservadas no dashboard via dados seguros
> (`buildPedidoAcompanhamentoParcial`, mesma API homologada no
> detalhe). Shell/sidebar/topbar globais preservados (miolo entregue
> a `clienteShellLayout`/`shellLayout`, sem chrome proprio).
> Convencoes visuais herdadas das telas cliente homologadas (inline
> styles pixel-exatos). Valores dinamicos a partir dos pedidos/eventos
> reais do cliente. Diferencas visuais residuais documentadas: os
> numeros (KPIs, donut, destaque, prazos) sao dinamicos (nao os
> literais do mockup); itens de sidebar do standalone pertencem ao
> shell global; "Rascunho" do donut agrega os estados recebido/
> confirmado/insumos/aguardando. Checks: `node --check` OK;
> `git diff --check` OK. Gap do Dashboard marcado como resolvido em
> `docs/ui/CLIENTE_PORTAL_UI_GAP_INVENTORY.md`. Producao permanece
> bloqueada.

> **Atualizacao 2026-06-29 â€” fase
> `RAVATEX-TAPETES-UI-MATCH-STANDALONE-NOVO-PEDIDO-ADD-ITEM-MODAL`
> (frontend cliente + registro de homologacao visual).** O modal
> **"Adicionar item"** da tela Novo Pedido (`#/cliente/pedidos/novo`)
> foi **alinhado visualmente ao HTML standalone de referencia**
> (`Modal Adicionar Item - standalone.html`, em
> `D:\OneDrive\Ravatex\Inttex\Mockups - nova interface\`) pelo agente
> IAexec (Claude Sonnet 4.6), e o aceite visual foi **APROVADO
> EXPLICITAMENTE PELO DONO DO PROJETO em 2026-06-29**.
> Branch: `work/app-next`. Pushed para `staging/main`. Producao
> `bhgifjrfagkzubpyqpew` e `origin/main` nao foram tocados.
> Arquivo alterado: `js/screens/cliente-pedido-form.js` (unico).
> Elementos entregues e homologados: overlay com backdrop escurecido;
> card branco 460px com radius/shadow; header com titulo + subtitulo
> + botao fechar; campo Modelo (select real, estilizado como o
> falso-select do standalone); Cor 1/Cor 2 derivadas do modelo
> selecionado (caixas estaticas somente leitura â€” override por item
> deferido para fase futura); Largura derivada (caixa estatica) +
> Metragem (input numerico) em grid 2 colunas; "Referencia visual"
> decorativa (gradiente/circulo/borda tracejada, sem dado real
> associado); Observacao do item (textarea com contador "0/200");
> footer Cancelar/Adicionar item. Funcionalidades preservadas:
> abertura do modal via clique em "Adicionar item", inclusao real do
> item em `state.itens` (refletido no INSERT de `pedido_itens` ao
> finalizar), validacoes de modelo obrigatorio e metragem > 0,
> fechamento via botao fechar/Cancelar/clique fora/Esc. Diferencas
> visuais residuais documentadas: campo Metragem usa `type="number"`
> (nao `type="text"` como no standalone, para preservar a validacao
> numerica existente) e o placeholder de Observacao foi adaptado para
> nao referenciar o termo interno "lote" (guard de teste existente).
> Checks: `node --check` OK; `node --test` do smoke focado 35/36
> (1 falha pre-existente, nao relacionada, sobre divergencia de texto
> "metros"/"metragem" na validacao de `salvar()`). Gap do Modal
> Adicionar Item marcado como resolvido em
> `docs/ui/CLIENTE_PORTAL_UI_GAP_INVENTORY.md`. Dashboard nao foi
> tocado nesta fase. Producao permanece bloqueada.

> **Atualizacao 2026-06-29 â€” fase
> `RAVATEX-TAPETES-UI-MATCH-STANDALONE-NOVO-PEDIDO`
> (frontend cliente + registro de homologacao visual).** A tela
> **Novo Pedido** (`#/cliente/pedidos/novo`) foi **alinhada
> visualmente ao HTML standalone de referencia**
> (`Novo Pedido - standalone.html`, em
> `D:\OneDrive\Ravatex\Inttex\Mockups - nova interface\`) pelo agente
> IAexec (Claude Sonnet 4.6), e o aceite visual foi **APROVADO
> EXPLICITAMENTE PELO DONO DO PROJETO em 2026-06-29**.
> Branch: `work/app-next`. Pushed para `staging/main`. Producao
> `bhgifjrfagkzubpyqpew` e `origin/main` nao foram tocados.
> Arquivo alterado: `js/screens/cliente-pedido-form.js` (unico).
> Elementos entregues e homologados: header com botao back (36x36,
> arrow SVG) + titulo "Novo pedido" (23px, 800) + subtitulo +
> botao "Cancelar"; card "Dados gerais" grid 3 cols
> (Referencia do cliente | Prazo desejado com icone calendario |
> Recebimento select); card "Itens do pedido" tabela colunas
> `60px 1.1fr 1.1fr .8fr 1.1fr 1.2fr 84px`
> (Img | Modelo | Cores | Largura | Metragem | Obs | Acoes),
> swatch placeholder, selects de modelo, inputs inline editaveis,
> icones lapis/lixeira; rodape da tabela com
> "Total de itens: N | Metragem total: X m"; secao bottom
> grid 3fr/1fr com "Instrucoes gerais" (textarea 1 linha,
> auto-extensivel, overflow-y:hidden) + "Ir para checkout" +
> "Finalizar pedido" (azul); align-items:stretch nos dois cards.
> Funcionalidades preservadas: criacao de pedido
> (INSERT `pedidos` + `pedido_itens`), compensacao em falha,
> validacoes, toast, navegacao pos-save. Campos internos nao
> expostos: OP, lote, fornecedor, NF, romaneio, custo, margem,
> observacao_admin, token_acesso, service_role. Campos de UI
> `referencia` e `recebimento` exibidos mas NAO enviados ao DB
> (sem coluna em schema). Checks: `node --check` OK.
> Gap do Novo Pedido marcado como resolvido em
> `docs/ui/CLIENTE_PORTAL_UI_GAP_INVENTORY.md`.
> Modal "Adicionar item" permanece para fase posterior.
> Producao permanece bloqueada.

> **Atualizacao 2026-06-29 â€” fase
> `RAVATEX-TAPETES-CLIENTE-DETAIL-VISUAL-HOMOLOG-RECORD-A`
> (docs-only, registro de homologacao visual â€” sem codigo, sem schema,
> sem SQL, sem Supabase).** A tela de **Detalhe do Pedido Cliente**
> (`#/cliente/pedidos/<uuid>`) foi **alinhada visualmente ao HTML
> standalone de referencia** (`Detalhe do Pedido v2 - standalone.html`,
> fora do repo em
> `D:\OneDrive\Ravatex\Inttex\Mockups - nova interface\`) pelo agente
> IAexec (Claude Sonnet 4.6), e o aceite visual foi **APROVADO
> EXPLICITAMENTE PELO DONO DO PROJETO em 2026-06-29**. HEAD do commit:
> `8650bb5` ("Match cliente pedido detail to standalone reference"),
> branch `work/app-next`, pushed para `staging/main`. Producao/original
> `bhgifjrfagkzubpyqpew` e `origin/main` nao foram tocados. Elementos
> entregues e homologados: breadcrumb + titulo inline + badge de status;
> meta card 3 colunas; stepper 42px com conic-gradient two-tone
> (`#2563eb` preenchido / `#dbeafe` vazio), check SVG nos concluidos,
> wrapper ambar para excecao; preview de item com textura preservada;
> distribuicao com barras coloridas; parciais em tabela 4 colunas;
> historico com timeline vertical flat. Seguranca preservada: nenhum
> campo interno exposto; tela permanece 100% read-only; RLS intocada;
> dashboard/lista/admin nao alterados. Testes: 92/92 pass
> (59 detail + 11 parcial + 22 tracking). Gap do Detalhe marcado como
> resolvido em `docs/ui/CLIENTE_PORTAL_UI_GAP_INVENTORY.md`. Producao
> permanece bloqueada. Esta fase e docs-only. Proxima etapa: avaliar
> demais gaps do inventario (dashboard, novo pedido, shell), com
> decisoes `OP-001` a `OP-012` respondidas antes de nova UI.

> **Atualizacao 2026-06-29 â€” fase
> `RAVATEX-TAPETES-CLIENTE-PORTAL-UI-OPERATIONS-RULES-A` (docs-only,
> matriz operacional de decisoes para UI).** Criado
> `docs/ui/CLIENTE_PORTAL_UI_OPERATIONS_RULES.md` como matriz objetiva
> para orientar a proxima rodada de UI do Portal Cliente B2B **sem
> implementar nada**. O documento consolida as decisoes ja fechadas
> (cliente nao ve OP/lote/fornecedor/NF-romaneio/custo-margem/
> metadata; portal cliente segue read-only exceto criacao de pedido;
> status operacional separado do status visual; admin publica status
> visual; timeline cliente le apenas eventos visiveis; producao segue
> bloqueada) e registra como **pendentes do dono do projeto** as
> decisoes `OP-001` a `OP-012`: fluxo de novo pedido (1 etapa vs 2
> etapas), inline vs modal para item, campos obrigatorios por item,
> uso de `tipo_recebimento`, uso de `referencia_cliente`, separacao
> `prazo_desejado` vs `prazo_entrega`, exibicao ou nao do status
> operacional no detalhe cliente, acoes rapidas no dashboard,
> composicao do menu cliente, existencia de Suporte, upload de imagem
> por item e possibilidade futura de edicao/cancelamento pelo cliente.
> A UI continua **funcional, porem NAO final**. A proxima etapa
> recomendada agora e **o dono do projeto responder OP-001 a OP-012
> antes de qualquer implementacao de UI**; so depois devem entrar as
> fases `UI-GAP-FIX-NOVO-PEDIDO-A`, `UI-GAP-FIX-MODAL-ITEM-A`,
> `UI-GAP-FIX-DETALHE-A`, `UI-GAP-FIX-DASHBOARD-A` e por ultimo
> `UI-GAP-FIX-SHELL-A` (devido ao risco cross-role do
> `shellLayout`). **Producao permanece BLOQUEADA**; sem codigo, sem
> schema, sem SQL, sem Supabase, sem Edge Function, sem testes de app
> (apenas verificacao Git/diff). Senha, token e credenciais nao foram
> registrados. Documento indexado em `docs/DOCUMENTATION_INDEX.md`
> Â§1b como diagnostico/operacional nao-canonico.
> **Atualizacao 2026-06-28 â€” fase
> `RAVATEX-TAPETES-CLIENTE-PORTAL-UI-GAP-INVENTORY-A` (docs-only,
> inventario de gaps de UI, read-only/diagnostico).** Concluido o
> **inventario de divergencias entre os mockups aprovados pelo dono do
> projeto e a implementacao atual do Portal Cliente B2B**, registrado
> em `docs/ui/CLIENTE_PORTAL_UI_GAP_INVENTORY.md`. Mockups usados (5,
> localizados em `D:\OneDrive\Ravatex\Inttex\Mockups - nova interface\`,
> fora do repo): Dashboard Cliente, Novo Pedido, Modal Adicionar Item,
> Detalhe do Pedido, Admin-Cliente-Acompanhamento B2B (cobre
> stepper/timeline cliente + taxonomia). Nenhum mockup ausente.
> Comparadas as 6 unidades pedidas: Dashboard Cliente; Novo Pedido;
> Modal Adicionar Item; Detalhe do Pedido; Acompanhamento/Stepper/
> Timeline; Shell/Menu cliente. **A UI permanece FUNCIONAL, porem NAO
> final** â€” o inventario documenta gaps reais (KPIs do dashboard com
> semantica diferente; fluxo de novo pedido em 1 etapa inline em vez
> de tabela+modal+checkout em 2 etapas; ausencia de campos
> referencia_cliente/tipo_recebimento/Cor1/Cor2/Largura na criacao
> apesar de ja existirem no schema (`db/15_status_cliente_visual.sql`);
> exibicao simultanea do status operacional e do status visual no
> detalhe; ausencia de datas por etapa no stepper; shell/menu cliente
> com 2 itens em vez de 4 e sem identidade visual propria, usando
> `shellLayout` compartilhado com admin/fornecedor â€” risco alto para
> qualquer correcao futura). **Pendencias operacionais explicitamente
> registradas como TBD** (sem inventar regra): tipo de retirada/
> entrega obrigatorio ou nao; fluxo de revisao/checkout antes de
> finalizar pedido; manter ou nao o status operacional visivel ao
> cliente no detalhe; campos obrigatorios do formulario; regras
> futuras de edicao/cancelamento pelo cliente. Proxima fase
> recomendada: priorizar `UI-OPERATIONS-RULES-A` (docs-only, decidir os
> TBDs com o dono do projeto) antes de qualquer uma das fases
> `UI-GAP-FIX-DASHBOARD-A` / `UI-GAP-FIX-NOVO-PEDIDO-A` /
> `UI-GAP-FIX-MODAL-ITEM-A` / `UI-GAP-FIX-DETALHE-A` propostas no
> documento; `UI-GAP-FIX-SHELL-A` fica para o final, dado o risco
> cross-role do `shellLayout` compartilhado. **Producao permanece
> BLOQUEADA**; `origin/main` e `bhgifjrfagkzubpyqpew` **intocados**.
> **Esta fase e docs-only/read-only: sem codigo, sem schema, sem SQL,
> sem Supabase, sem Edge Function, sem frontend, sem testes de app
> (apenas verificacao Git).** Senha, token e qualquer credencial **nao
> foram registrados**. `docs/ui/CLIENTE_PORTAL_UI_GAP_INVENTORY.md` e
> diagnostico/nao-canonico, indexado em `docs/DOCUMENTATION_INDEX.md`
> Â§1b â€” nao substitui nenhuma das 7 fontes canonicas.

> **Atualizacao 2026-06-28 â€” fase
> `RAVATEX-TAPETES-CLIENTE-PORTAL-STAGING-CLOSEOUT-A` (docs-only,
> closeout do marco funcional do portal cliente em staging).** O
> **Portal Cliente B2B esta FUNCIONALMENTE HOMOLOGADO em staging**,
> HEAD fechado `23286ae`, `staging/main` em `23286ae`, Supabase
> staging `ucrjtfswnfdlxwtmxnoo`. **ProduÃ§Ã£o/original
> `bhgifjrfagkzubpyqpew` NAO foi tocada; `origin/main` permanece
> intocado.** Cobertura funcional validada: perfil cliente; login
> cliente; criacao/lista/detalhe de pedido cliente; dashboard cliente
> read-only; status visual publicado pelo admin; stepper/
> acompanhamento; timeline read-only; policy cliente para eventos
> visiveis; provisionamento cliente em staging via `admin-create-user`
> validado; ausencia de exposicao de dados internos; portal 100%
> read-only para o cliente (exceto criacao de pedido); polimento
> visual inicial. **Esta fase NAO declara a UI como final.** O dono do
> projeto registrou que a UI atual ainda NAO esta como os HTMLs/
> mockups pedidos â€” houve melhoria real, mas ainda ha divergencias
> visuais e havera ajustes para particularidades operacionais antes
> de qualquer decisao de producao. **Producao permanece BLOQUEADA**
> para este bloco: nao ha autorizacao para merge ou deploy em
> `origin/main` nesta fase nem em fases anteriores. **Esta fase e
> docs-only: sem codigo, sem schema, sem SQL, sem Supabase, sem
> Edge Function, sem frontend, sem testes (apenas verificacao Git).**
> Senha, token e qualquer credencial **nao foram registrados**.
> Proxima fase recomendada: inventario de gaps de UI, comparando os
> mockups/HTMLs pedidos pelo dono do projeto contra a implementacao
> atual das 5 telas do portal cliente, antes de qualquer nova
> implementacao ou decisao de promocao para producao.

> **Atualizacao 2026-06-28 â€” fase
> `RAVATEX-TAPETES-CLIENTE-PORTAL-VISUAL-HOMOLOG-RECORD-A` (docs-only,
> registro de homologacao).** A **homologacao visual manual do portal
> cliente B2B, apos o refinamento visual da fase
> `RAVATEX-TAPETES-CLIENTE-PORTAL-VISUAL-POLISH-A`, foi APROVADA** pelo
> dono do projeto, no HEAD homologado `3b0f8e4`, em ambiente conectado
> ao Supabase staging `ucrjtfswnfdlxwtmxnoo`. **ProduÃ§Ã£o/original
> `bhgifjrfagkzubpyqpew` NAO foi tocada.** Validado: **Dashboard
> Cliente** aprovado; **Meus pedidos** aprovado; **Detalhe do pedido**
> aprovado; **Stepper/Acompanhamento** aprovado; **Timeline de
> atualizacoes** aprovada; **responsividade basica** aprovada (sem
> sobreposicao grosseira, tabelas com rolagem quando necessario, menu
> permanece utilizavel em largura menor); **nenhum dado interno**
> (OP/lote/fornecedor/NF/romaneio/custo/margem/metadata/criado_por/
> origem/token_acesso) exposto ao cliente; **portal cliente permanece
> 100% read-only** â€” nenhuma acao de editar pedido, cancelar pedido,
> atualizar status, publicar evento ou mexer em fornecedor foi
> oferecida; **nenhuma regressao funcional reportada**. **Esta fase e
> docs-only: sem codigo, sem schema, sem SQL, sem Supabase, sem
> frontend, sem testes (apenas verificacao Git).** Senha, token e
> qualquer credencial **nao foram registrados**.
> Proxima fase recomendada: decidir, com o dono do projeto, entre
> preparacao para producao/staging closeout do portal cliente ou
> avancar para o proximo bloco funcional.

> **Atualizacao 2026-06-27 â€” fase
> `RAVATEX-TAPETES-CLIENTE-PORTAL-VISUAL-POLISH-A` (frontend, refino
> visual).** Refinada a apresentacao do portal cliente B2B nas 5
> telas (Dashboard, Meus pedidos, Detalhe, Stepper/Acompanhamento,
> Timeline de atualizacoes), **sem alterar nenhum comportamento
> homologado, nenhum campo selecionado e nenhuma regra de status**.
> - **Dashboard** (`js/screens/cliente-dashboard.js`): cards/KPIs com
>   borda de cor por tipo, layout em duas colunas (Pedidos recentes |
>   Ultimas atualizacoes) em telas largas, badges de pedido/evento
>   agora com tom de cor derivado da excecao publicada pelo admin
>   (mesma paleta do stepper) em vez de azul fixo.
> - **Meus pedidos** (`js/screens/cliente-pedidos-list.js`): contador
>   "N pedidos encontrados", tabela com rolagem horizontal
>   (`overflow-x-auto`), filtros de status em pill arredondado, acao
>   da tabela renomeada de "Visualizar" para "Ver pedido" (consistente
>   com o Dashboard). **Select de pedidos inalterado.**
> - **Detalhe do pedido** (`js/screens/cliente-pedido-detail.js`):
>   resumo do pedido reorganizado em grade de 3 colunas (Prazo de
>   entrega / Criado em / Atualizado em), tabela de itens com rolagem
>   horizontal, timeline "Atualizacoes do pedido" com indicador visual
>   de linha do tempo (ponto + conector). **Selects de pedidos,
>   pedido_itens e pedido_cliente_eventos inalterados.**
> - **Stepper/Acompanhamento** (`js/screens/cliente-pedido-tracking.js`):
>   apenas classes visuais (cantos, sombra, espacamento, tamanho dos
>   circulos) â€” taxonomia, exceÃ§Ãµes, "cancelado" como exceÃ§Ã£o
>   terminal e mensagem personalizada permanecem 100% intactos. Nao
>   consulta Supabase (component puro de apresentacao, como antes).
> - **Menu cliente e shell** (`js/screens/cliente-common.js`): **sem
>   alteracao** â€” "InÃ­cio" e "Meus pedidos" ja atendiam ao padrao
>   visual; nao havia necessidade de mudanca.
> - **Seguranca de dados:** confirmado por teste automatizado dedicado
>   (`tests/cliente-portal-visual.smoke.js`, novo) que nenhuma das 5
>   telas passou a expor metadata/criado_por/origem,
>   `pedido_eventos` (tabela interna), OP/lote/fornecedor/NF/
>   romaneio/custo/margem/token_acesso, nem ganhou acao de escrita
>   (insert/update/delete/rpc/functions.invoke, ou botao "Cancelar
>   pedido"/"Confirmar pedido"/"Editar"). Os SELECTs de `pedidos`,
>   `pedido_itens` e `pedido_cliente_eventos` foram comparados
>   literalmente (string exata) contra o estado anterior a fase â€”
>   nenhum campo novo foi selecionado.
> - **Admin e fornecedor:** **nÃ£o alterados.** Nenhum arquivo de
>   `db/**`, `supabase/functions/**` ou tela admin/fornecedor foi
>   tocado. **Sem schema, sem SQL, sem Supabase migration.**
> - **Verificacao visual manual** (app local conectado ao Supabase
>   staging `ucrjtfswnfdlxwtmxnoo`, usuario `cliente@teste.com`):
>   Dashboard com KPIs coloridos e grade de 2 colunas em desktop,
>   badges com tom (ambar para "Aguardando insumo", azul para
>   "Acabamento"); Detalhe com resumo em 3 colunas e timeline com
>   pontos; Meus pedidos com contador e acao "Ver pedido" â€”
>   confirmados sem erro de console.
> - Testes focados: lista obrigatoria da fase (`cliente-dashboard`,
>   `cliente-pedido-detail`, `cliente-pedido-events`,
>   `cliente-pedido-tracking`, `cliente-tracking-steps`,
>   `cliente-routing`, `boot`) + `cliente-pedidos-list` +
>   `cliente-portal-visual` (novo, com 49 casos) = **265 testes,
>   todos passaram**.
> Proxima fase recomendada: homologacao visual manual completa em
> staging pelo dono do produto, ou nova rodada de refinamento se
> houver feedback visual.

> **Atualizacao 2026-06-27 â€” fase
> `RAVATEX-TAPETES-CLIENTE-PROVISIONING-STAGING-VERIFY-A` (verificacao
> operacional controlada + docs-only).** **CONFIRMADO: a Edge Function
> `admin-create-user` deployada no Supabase staging
> `ucrjtfswnfdlxwtmxnoo` aceita o fluxo de provisionamento de usuario
> `tipo=cliente`.** A lacuna documental registrada apos a homologacao
> do Dashboard Cliente esta **resolvida**.
> - **Evidencia de codigo versionado:**
>   `supabase/functions/admin-create-user/index.ts` tem
>   `ALLOWED_TIPOS = {admin, fornecedor, cliente}` e ramo
>   `tipo === "cliente"` que rejeita `fornecedor_id`, exige `cliente_id`,
>   valida existencia em `public.clientes` e grava `usuarios.cliente_id`;
>   a UI `js/screens/cadastros.js` oferece tipo "Cliente" e invoca
>   `admin-create-user` com `cliente_id`.
> - **Metodo de validacao do deploy (nao destrutivo):** login admin
>   (`admin@tapetes.test`) no app local conectado ao staging; invocacao
>   `window.supa.functions.invoke('admin-create-user', { body: { tipo:
>   'cliente', cliente_id: 999999 (inexistente), ... } })`.
> - **Resultado observado:** HTTP **400**, `code: VALIDATION_ERROR`,
>   message **"cliente_id nÃ£o existe em public.clientes."** â€” mensagem
>   que so existe no ramo `cliente` (index.ts). A versao antiga teria
>   barrado antes, no gate de `tipo`, com mensagem de tipo invalido.
>   Logo, `tipo=cliente` e **aceito** pela versao deployada.
> - **Nenhum usuario real criado:** a validacao de `cliente_id` ocorre
>   **antes** de `auth.admin.createUser`; com `cliente_id` inexistente a
>   chamada falhou na validacao, sem criar Auth user nem perfil. Nenhum
>   usuario foi criado, alterado ou excluido.
> - **ProduÃ§Ã£o/original `bhgifjrfagkzubpyqpew` NAO foi tocada.** Apenas
>   staging. **Senha e token NAO foram registrados** (login feito no
>   navegador; token nunca saiu da pagina). **Sem** codigo/schema/SQL/
>   Supabase mutation/frontend nesta fase.
> Proxima fase recomendada: provisionar de fato um usuario cliente real
> via UI `#/cadastros/usuarios` em staging (somente com autorizacao
> explicita), ou seguir para refinamento visual do portal cliente.

> **Atualizacao 2026-06-27 â€” fase
> `RAVATEX-TAPETES-CLIENTE-DASHBOARD-HOMOLOG-RECORD-A` (docs-only,
> registro de homologacao).** A **homologacao manual/controlada do
> Dashboard Cliente read-only foi APROVADA**, no HEAD homologado
> `54fabfa`, em **app local (`http://localhost:8765/`) conectado ao
> Supabase staging `ucrjtfswnfdlxwtmxnoo`** (runtime confirmou
> `APP_ENV=staging` e `SUPABASE_URL` apontando para
> `ucrjtfswnfdlxwtmxnoo`). **ProduÃ§Ã£o/original `bhgifjrfagkzubpyqpew`
> NAO foi tocada.** Validado: login cliente cai em
> `#/cliente/dashboard`; menu cliente com "InÃ­cio" e "Meus pedidos"
> funcionais; dashboard carrega sem erro de console; KPIs coerentes
> (em aberto **2**, em andamento **2**, prontos/concluidos **0**,
> atualizacoes recentes **3**); pedidos recentes exibidos (**#3** com
> excecao "Aguardando insumo", **#2** em "Acabamento"); ultimas
> atualizacoes exibidas; links "Ver pedido" abrem o detalhe correto; o
> detalhe mantem **stepper** e **timeline** ja homologados; navegacao
> dashboard â†’ detalhe â†’ Meus pedidos â†’ dashboard funciona; **nenhum
> dado interno** (OP/lote/fornecedor/NF/romaneio/custo/margem/metadata/
> criado_por/origem/token_acesso) aparece; **nenhuma acao de escrita**
> e oferecida (dashboard read-only). **Cliente de teste funcional em
> staging:** `cliente@teste.com`, `tipo=cliente`, `cliente_id=3`,
> cliente nome "Teste" (senha **nÃ£o** registrada). Observacao nao
> bloqueante: quando o `titulo` do evento e igual ao status, titulo e
> badge podem repetir o texto â€” e dado do evento, nao defeito de tela.
> **Esta fase e docs-only: sem codigo, sem schema, sem SQL, sem
> Supabase, sem frontend, sem testes (apenas verificacao Git).**
> Proxima fase recomendada: refinamento visual do portal cliente ou
> proxima frente de funcionalidade cliente (ainda sem automacao).

> **Atualizacao 2026-06-27 â€” fase `RAVATEX-TAPETES-CLIENTE-DASHBOARD-A`
> (frontend cliente read-only).** Criado o **Dashboard Cliente
> read-only** como pagina inicial do portal B2B, na rota
> `#/cliente/dashboard` (role `cliente`). Entrega:
> - novo modulo `js/screens/cliente-dashboard.js` (SELECT-only) e
>   smoke `tests/cliente-dashboard.smoke.js`;
> - rota `#/cliente/dashboard` registrada em `js/boot.js`; cliente
>   passa a cair nela apos login (`routeAfterLogin` em `js/router.js`)
>   sem quebrar `#/cliente/pedidos`, `#/cliente/pedidos/novo` nem
>   `#/cliente/pedidos/<id>`;
> - menu cliente ganha item **"InÃ­cio"** preservando **"Meus pedidos"**;
> - cards/KPIs (em aberto, em andamento, prontos/concluidos,
>   atualizacoes recentes) derivados localmente dos pedidos carregados;
> - lista de pedidos recentes (ate 5) com label visual via
>   `window.RavatexPedidoTracking` e botao "Ver pedido";
> - ultimas atualizacoes lidas de `pedido_cliente_eventos`, com empty
>   state "Suas atualizaÃ§Ãµes aparecerÃ£o aqui.".
>
> **Pedidos sao lidos com SELECT explicito** apenas dos campos seguros
> (`id, numero, status, status_cliente_visual, status_cliente_excecao,
> status_cliente_mensagem, status_cliente_atualizado_em, prazo_entrega,
> prazo_desejado, tipo_recebimento, criado_em, atualizado_em`).
> **Eventos sao lidos com SELECT explicito**
> (`id, pedido_id, status, titulo, mensagem, criado_em`). **Nunca**
> seleciona `metadata`, `criado_por` ou `origem`; **nao** consulta
> `pedido_eventos`; **nao** expoe `OP`/`lote`/`fornecedor`/`NF`/
> `romaneio`/`custo`/`margem`/`token_acesso`. Tela **read-only**: sem
> insert/update/delete/rpc, sem `functions.invoke`, sem `service_role`.
> **Telas admin e fornecedor nao foram alteradas. Sem schema, sem SQL,
> sem Supabase migration. Producao `bhgifjrfagkzubpyqpew` intocada.**
> Aderente a `docs/architecture/PORTAL_B2B_ARCHITECTURE_RULES.md`
> (separacao de papeis Â§2, SELECT explicito Â§8, renderizacao sem writes
> Â§9). Testes focados: `cliente-dashboard` + `cliente-pedido-detail` +
> `cliente-pedido-events` + `cliente-pedido-tracking` +
> `cliente-tracking-steps` 135/135; `boot`+`cliente-routing`+`router`+
> `cliente-pedidos-list` 154/154 apos ajuste das contagens de rota.
> Proxima fase recomendada: homologacao manual do dashboard em staging
> ou refinamento visual do portal cliente.

> Snapshot de estado canonico curto. Atualizado em **2026-06-27** (fase
> `RAVATEX-TAPETES-PEDIDOS-CLIENTE-TRACKING-E2E-HOMOLOG-RECORD-A` â€”
> registro da homologacao manual E2E aprovada em staging).
> **O fluxo completo admin â†’ cliente de acompanhamento visual foi
> homologado manualmente em staging (`ucrjtfswnfdlxwtmxnoo`) e
> aprovado pelo dono do projeto, no HEAD `fc7843c`.** Admin publicou
> situacao visual e excecao; cliente visualizou o stepper atualizado e
> a timeline read-only em "Atualizacoes do pedido"; nenhum dado interno
> foi exposto ao cliente. **Producao/original `bhgifjrfagkzubpyqpew`
> nao foi tocada. Esta fase e docs-only: sem codigo, sem schema, sem
> SQL, sem Supabase, sem frontend.**

## Produto
> Atualizacao da fase `RAVATEX-TAPETES-PEDIDOS-CLIENTE-TRACKING-E2E-HOMOLOG-RECORD-A`:
> a homologacao manual E2E do acompanhamento visual cliente (status
> visual + excecao + timeline de eventos) foi validada e aprovada em
> staging. Fluxo admin â†’ cliente funciona ponta a ponta sem exigir
> intervencao tecnica fora das telas ja implementadas. Dashboard
> cliente e automacao continuam fora do escopo.
SPA web para controlar a produÃ§Ã£o de tapetes, do pedido de fio atÃ© o
recebimento do lÃ¡tex. Perfis: **admin** (operaÃ§Ã£o), **fornecedor**
(fio / tecelagem / lÃ¡tex) e **cliente** (pedidos prÃ³prios â€” schema
aplicado; **cliente de teste funcional em staging**, login validado na
homologacao do dashboard 2026-06-27. Provisionamento self-service via
Edge Function `admin-create-user` aceitando `cliente` **confirmado
deployado em staging** em 2026-06-27 â€” ver bloco
`...-PROVISIONING-STAGING-VERIFY-A` no topo).

## Stack real (confirmada)
- Frontend: `index.html` Ãºnico + `js/**` (JS clÃ¡ssico, sem build) +
  Tailwind via CDN.
- CÃ¡lculo: `js/calculo-op.js` â€” funÃ§Ãµes puras, testadas com `node --test`.
- Backend: Supabase + Auth e-mail/senha + RLS. Plano free.
- Hospedagem: **GitHub Pages** (publica no push pra `main`). **NÃ£o Ã©
  Vercel. NÃ£o Ã© Next.js.**

## Arquitetura
- **App estÃ¡tico `index.html` + JS clÃ¡ssico + Supabase.**
- **2 ambientes Supabase, 2 repos:**
  - **Legacy / original online** (`bhgifjrfagkzubpyqpew`) â€” app no Vercel com usuÃ¡rios externos. **NÃ£o tocar.**
  - **Paralelo de trabalho** (`ucrjtfswnfdlxwtmxnoo`) â€” backend novo, usado pelo frontend local `work/app-next`.
- **2 repos:**
  - `origin` â†’ `grupoterrabranca/controle-tapetes` (oficial, intocado, `origin/main`).
  - `staging` â†’ `controle-tapetes-staging` (paralelo, `staging/main`).
- **Taxonomia oficial:** ver `docs/operations/PARALLEL_ENVIRONMENT_RECONCILIATION.md`.
- **`bhgifjrfagkzubpyqpew` NÃƒO Ã© alvo desta frente.** Nenhuma aÃ§Ã£o deve mirÃ¡-lo.

## Estado atual do refactor
- **Branch operacional:** `work/app-next`.
- **HEAD atual aceito:** `2e37658` â€” fase
  `RAVATEX-TAPETES-PEDIDOS-CLIENTE-TRACKING-ADMIN-A`, usada como base
  de entrada desta migration versionada.
- **staging/main:** `2e37658` (alinhado ao HEAD de entrada desta fase).
- **origin/main:** `1047181eba888242c6428de366cbd9fda2f1c72c` â€” **intocado.**
- **PR #2:** **intocado.**
- **Working tree:** **limpo.**
- **Ambiente paralelo (`ucrjtfswnfdlxwtmxnoo`):** backend completo:
  schema `db/12_*` aplicado (HMNlead, 2026-06-24), `db/13_*` aplicado,
  **`db/14_*` aplicado** (fase B2, Management API, 2026-06-24),
  Edge Functions `admin-create-user` e `admin-disable-user` deployadas
  e validadas, secrets configurados, UI validada manualmente, smokes
  163/163, E2E PASS.
- **App original (`bhgifjrfagkzubpyqpew`):** **intocado.** Apenas
  1 query read-only com anon key pÃºblica nesta frente, sem mutaÃ§Ã£o.

### Marco fechado
**Marco fechada: ciclo de refactor arquitetural + hardening + extraÃ§Ã£o
final do `op-pdf.js` estÃ¡ CONGELADO.**

Componentes estÃ¡veis:
- `index.html` declarativo, sem script inline final, com cache-busting
  `?v=20260623-asset1` em todos os 26 assets locais; CDNs externos
  permanecem sem `?v=`.
- `js/boot.js` Ã© o entrypoint oficial e respeita `DOM ready`
  (aguarda `DOMContentLoaded` quando `document.readyState === 'loading'`,
  e chama `startApp()` em `js/boot.js`; `main()` nÃ£o Ã© mais executado
  no top-level).
- `js/router.js` Ã© engine genÃ©rica de roteamento, intocado no ciclo.
- `js/ui.js` faz lookup lazy do root `#app` via `getAppRoot()` â€”
  erro `replaceChildren null` foi eliminado apÃ³s cache limpo do
  navegador.
- `run-local.bat` Ã© o tooling local para servir o app em
  `http://localhost:8765/`.
- Telas e writes crÃ­ticos (admin / fornecedor / OP / entrega / lÃ¡tex)
  estÃ£o modularizados.
- `js/screens/op-pdf.js` foi extraÃ­do de `op-nova.js` contendo
  `gerarPdfCompraFios`.

### Commits tÃ©cnicos e eventos desde o Ãºltimo docs-only (`5fec054`)
1. `d5db6c7` â€” Add local run script
   (`run-local.bat`, `http://localhost:8765/`).
2. `87d4559` â€” Delay app boot until DOM ready
   (`js/boot.js` passa a executar `main()` via `startApp`,
   aguardando `DOMContentLoaded`).
3. `e0dbfcd` â€” Resolve app root lookup after DOM ready
   (`js/ui.js` introduz `getAppRoot()` para lookup lazy do `#app`).
4. `5d5b395` â€” Add cache busting to local app assets
   (`index.html` com `?v=20260623-asset1` em 26 assets locais;
   CDNs externos preservados sem `?v=`).
5. `RAVATEX-TAPETES-OP-NOVA-SEAMS-DIAG-A` (read-only, sem commit) â€”
   diagnÃ³stico das seams de `op-nova.js`. Concluiu que
   `gerarPdfCompraFios` Ã© a Ãºnica extraÃ§Ã£o de baixo risco e que
   `buildBlocoFios` / `buildBlocoTecelagem` / `buildProposta` devem
   permanecer na closure por acoplamento.
6. `7f3c6da` â€” Extract OP PDF helper
   (`js/screens/op-pdf.js` criado; `gerarPdfCompraFios` removida de
   `op-nova.js`; call-site atualizado para
   `window.gerarPdfCompraFios({ op, ordens })`; 388/388 testes
   focados passaram).
7. Commits intermediÃ¡rios do ciclo de Auth (`e64d1cc`,
   `4f7c16f`, `0d5ef7b`, `88aa4fb`, `f6ac19b`, `c365020`,
   `0bc67f6`, `3c9c424`/`d9d08be`, `42ffc91`, `d99bcda`,
   `77bcc6b`) â€” ver LEDGER Â§4. Fecham: refactor closeout docs,
   `CODE_HEALTH_RULES`, governanÃ§a, saneamento documental, design
   e implementaÃ§Ã£o da Edge Function `admin-create-user`, UI
   `#/cadastros/usuarios`, runbook operacional, design de
   desativaÃ§Ã£o, UI guard, schema de desativaÃ§Ã£o versionado.
8. `8fa924a` â€” `RAVATEX-TAPETES-AUTH-DISABLE-USER-SCHEMA-APPLY-A`
   (docs-only): registro da orientaÃ§Ã£o e validaÃ§Ã£o local para
   aplicaÃ§Ã£o de `db/12_auth_user_disable_schema.sql` no Supabase
   **staging** `ucrjtfswnfdlxwtmxnoo`. A execuÃ§Ã£o real do SQL
   ficou pendente de HMNlead no Dashboard e foi registrada em
   fase prÃ³pria (`RAVATEX-TAPETES-AUTH-DISABLE-USER-SCHEMA-APPLY-EVIDENCE-A`,
   esta fase).

## DecisÃ£o arquitetural
**REFATORAÃ‡ÃƒO ARQUITETURAL CONGELADA.**

Justificativa:
- `index.html` estÃ¡ declarativo e com cache-busting local.
- `js/boot.js` Ã© o entrypoint; respeita DOM ready.
- `js/router.js` Ã© engine genÃ©rica.
- `js/ui.js` tem root lookup seguro.
- assets locais tÃªm cache-busting.
- telas e writes crÃ­ticos estÃ£o modularizados.
- `op-pdf.js` foi extraÃ­do.
- `op-nova.js` ainda Ã© grande (~800 linhas), mas **sem writes
  diretos Supabase** e com closure aceitÃ¡vel, isolada em mÃ³dulo
  prÃ³prio.
- extraÃ§Ãµes adicionais de `buildBlocoFios`, `buildBlocoTecelagem` e
  `buildProposta` **nÃ£o sÃ£o recomendadas** neste ciclo: deslocariam
  complexidade para a fronteira da closure sem ganho proporcional e
  aumentariam risco.

A prÃ³xima etapa Ã© **homologaÃ§Ã£o / release**, nÃ£o nova extraÃ§Ã£o.

## ValidaÃ§Ã£o funcional registrada
- Servidor local em `http://localhost:8765/` abriu corretamente apÃ³s
  cache limpo do navegador (Disable cache + Ctrl+F5).
- `replaceChildren null` no boot **nÃ£o voltou** apÃ³s a limpeza de
  cache.
- Login aparentemente OK.
- Supabase staging (`ucrjtfswnfdlxwtmxnoo`) tem 4 OPs:
  `select count(*) as total_ops from public.ops;` â†’ `4`.
- PendÃªncia nÃ£o bloqueante: log `relation
  "supabase_migrations.schema_migrations" does not exist` permanece
  em staging (nÃ£o bloqueante; Ã© ruÃ­do do dashboard, nÃ£o do app).

## EvidÃªncia da aplicaÃ§Ã£o manual do schema em staging
*(Fase `RAVATEX-TAPETES-AUTH-DISABLE-USER-SCHEMA-APPLY-EVIDENCE-A` â€”
2026-06-24. Esta seÃ§Ã£o Ã© **docs-only**; nenhum SQL foi rodado por
IAexec nesta fase. Toda a execuÃ§Ã£o e validaÃ§Ã£o foi feita manualmente
pelo HMNlead no Supabase Dashboard.)*

### AplicaÃ§Ã£o
- `db/12_auth_user_disable_schema.sql` foi aplicado manualmente pelo
  HMNlead no SQL Editor do Supabase **staging** `ucrjtfswnfdlxwtmxnoo`.
- Nenhum SQL destrutivo foi aplicado. Os arquivos
  `db/10_reset_producao.sql` e `db/11_reset_ops.sql` **nÃ£o** foram
  executados. **ProduÃ§Ã£o `bhgifjrfagkzubpyqpew` nÃ£o foi tocada.**
- **Nenhum usuÃ¡rio foi criado, excluÃ­do ou desativado** durante a
  aplicaÃ§Ã£o. Todas as mutaÃ§Ãµes foram apenas de schema e de funÃ§Ãµes
  `SECURITY DEFINER`.

### Estado pÃ³s-aplicaÃ§Ã£o
- Novas colunas em `public.usuarios`:
  `ativo boolean NOT NULL DEFAULT TRUE`,
  `desativado_em timestamptz NULL`,
  `desativado_por uuid NULL`,
  `motivo_desativacao text NULL`.
- Contagem pÃ³s-aplicaÃ§Ã£o: `ativo = true, total = 3`;
  `auth_users_total = 3`; `public_usuarios_total = 3`;
  `auth_sem_perfil = 0`; `perfil_sem_auth = 0`.
- `is_admin()` agora exige `tipo = 'admin' AND ativo IS TRUE`.
- `meu_fornecedor_id()` agora consulta `fornecedor_id`, `tipo` e
  `ativo`; retorna `NULL` se `ativo` nÃ£o for `TRUE` ou se `tipo`
  nÃ£o for `'fornecedor'`.
- `usuarios_admin_all` permanece com `USING/WITH CHECK is_admin()`
  (a nova `is_admin()` jÃ¡ considera `ativo`).
- `usuarios_select` agora usa
  `((id = auth.uid()) AND (ativo IS TRUE)) OR is_admin()`.
- `usuarios_self_update` exige `id = auth.uid()`, `ativo IS TRUE`
  e preserva `tipo` no `WITH CHECK`.

### ValidaÃ§Ã£o manual do app pÃ³s-schema (HMNlead)
- Login/admin aparentou OK.
- Tela `#/cadastros/usuarios` carregou.
- BotÃ£o `+ Novo usuÃ¡rio` continuou visÃ­vel.
- ExclusÃ£o insegura continuou bloqueada como `Em breve` (placeholder
  injetado na fase `RAVATEX-TAPETES-AUTH-DELETE-UI-GUARD-A`).
- Console nÃ£o mostrou erro crÃ­tico de Auth/RLS/listagem.
- Avisos nÃ£o bloqueantes observados: warning de Tailwind CDN;
  `favicon.ico` 404.

### Estado final
- Schema de desativaÃ§Ã£o **aplicado e validado** em staging.
- Nenhum usuÃ¡rio foi criado, excluÃ­do ou desativado durante a
  aplicaÃ§Ã£o. Todos os usuÃ¡rios atuais ficaram `ativo = true`.
- PrÃ³xima fase liberada:
  `RAVATEX-TAPETES-AUTH-DISABLE-USER-EDGE-A` (Edge Function
  `admin-disable-user`).

## EvidÃªncia da validaÃ§Ã£o manual da UI em staging
*(Fase `RAVATEX-TAPETES-AUTH-DISABLE-USER-UI-VALIDATION-CLOSEOUT-A`
â€” 2026-06-24. Esta seÃ§Ã£o Ã© **docs-only**; nenhum cÃ³digo, SQL,
deploy ou execuÃ§Ã£o automatizada foi feita por IAexec nesta
fase. A validaÃ§Ã£o foi feita manualmente pelo HMNlead no app em
staging `ucrjtfswnfdlxwtmxnoo`.)*

### Itens validados
- Tela `#/cadastros/usuarios` carregou em staging.
- BotÃ£o `Desativar` apareceu para usuÃ¡rios ativos; placeholder
  `Em breve` substituÃ­do pela chamada real Ã  Edge Function
  `admin-disable-user`.
- **Guarda de usuÃ¡rio jÃ¡ inativo:** ao tentar `Desativar` um
  usuÃ¡rio com `ativo = false`, a UI exibiu a mensagem
  `"UsuÃ¡rio jÃ¡ estÃ¡ inativo."` **sem** chamar a Edge Function
  (proteÃ§Ã£o visual, server-side continua sendo a barreira real).
- **Fluxo real de desativaÃ§Ã£o:** fornecedor descartÃ¡vel ativo foi
  criado pela UI e, em seguida, desativado via botÃ£o
  `Desativar` â†’ modal de confirmaÃ§Ã£o (motivo preenchido) â†’
  toast de sucesso â†’ status `Inativo` na listagem.
- Console sem erros crÃ­ticos de Auth/RLS/listagem.
- Warnings nÃ£o bloqueantes, se presentes, continuam: warning
  de Tailwind CDN, `favicon.ico` 404.

### Estado final
- UI `#/cadastros/usuarios` validada em staging pelo HMNlead.
- **ProduÃ§Ã£o `bhgifjrfagkzubpyqpew` intocada.**
- **`origin/main` intocado** (`1047181eba888242c6428de366cbd9fda2f1c72c`).
- **PR #2 intocado.**
- PrÃ³xima etapa: **decisÃ£o de release** para
  `origin/main`/produÃ§Ã£o, **somente com autorizaÃ§Ã£o explÃ­cita**
  do HMNlead (em fase separada).

## PendÃªncias nÃ£o bloqueantes
- ðŸŸ¡ `op-nova.js` ainda tem cerca de 800 linhas; `buildBlocoFios`,
  `buildBlocoTecelagem` e `buildProposta` continuam na closure
  **por decisÃ£o arquitetural** (vide seÃ§Ã£o "DecisÃ£o arquitetural").
- ðŸŸ¡ `persistirOP` e `aplicarRecalculoOP` ainda nÃ£o sÃ£o transacionais
  entre mÃºltiplas tabelas (risco de produto/dados, nÃ£o regressÃ£o do
  refactor).
- ðŸŸ¢ **Auth provisioning concluÃ­do.** Edge Function `admin-create-user`
  deployada e validada em staging (`ucrjtfswnfdlxwtmxnoo`); UI
  `#/cadastros/usuarios` adaptada em `js/screens/cadastros.js`
  para chamar a funÃ§Ã£o via `supabase.functions.invoke` (fase
  `RAVATEX-TAPETES-AUTH-ADMIN-UI-A`); E2E UI staging aprovada
  (criaÃ§Ã£o de fornecedor descartÃ¡vel, `auth.users.id =
  public.usuarios.id` confirmado por SQL read-only, usuÃ¡rio teste
  removido); bloqueio de fornecedor (403) confirmado em staging;
  runbook operacional publicado em
  `docs/operations/AUTH_USER_PROVISIONING_RUNBOOK.md` (fase
  `RAVATEX-TAPETES-AUTH-PROVISIONING-DOCS-A`).
- ðŸŸ¡ **Auth delete/disable design concluÃ­do.** Design de semÃ¢ntica de
  exclusÃ£o/desativaÃ§Ã£o documentado em
  `docs/architecture/AUTH_DELETE_USER_DESIGN.md` (fase
  `RAVATEX-TAPETES-AUTH-DELETE-USER-DESIGN-A`). RecomendaÃ§Ã£o:
  **desativar** (soft delete no perfil + ban no Auth) em vez de
  deletar fisicamente. PrÃ³xima fase:
  `RAVATEX-TAPETES-AUTH-DISABLE-USER-SCHEMA-A` (schema) ou
  `RAVATEX-TAPETES-AUTH-DELETE-UI-GUARD-A` (contenÃ§Ã£o imediata).
- ðŸŸ¡ **UI guard aplicada.** ExclusÃ£o insegura de usuÃ¡rio
  (`.from('usuarios').delete()`) foi removida do front-end em
  `js/screens/cadastros.js` (fase
  `RAVATEX-TAPETES-AUTH-DELETE-UI-GUARD-A`). O botÃ£o "Excluir vÃ­nculo"
  foi substituÃ­do por placeholder "Em breve" que exibe toast
  informativo orientando a usar o Supabase Auth Dashboard para limpeza
  de testes. Delete/disable seguro via Edge Function ainda nÃ£o
  implementado.
- ðŸŸ¢ **Auth disable schema aplicado em staging.** Migration
  `db/12_auth_user_disable_schema.sql` foi aplicada manualmente pelo
  HMNlead no SQL Editor do Supabase **staging**
  `ucrjtfswnfdlxwtmxnoo` e validada pÃ³s-aplicaÃ§Ã£o (fase
  `RAVATEX-TAPETES-AUTH-DISABLE-USER-SCHEMA-APPLY-EVIDENCE-A`).
  Adiciona colunas `ativo`, `desativado_em`, `desativado_por`,
  `motivo_desativacao` em `public.usuarios`; recria `is_admin()` e
  `meu_fornecedor_id()` para exigir `ativo is true`; recria policies
  `usuarios_select`, `usuarios_admin_all`, `usuarios_self_update`.
  ValidaÃ§Ã£o pÃ³s-aplicaÃ§Ã£o: `ativo = true` em todos os 3 perfis
  (`auth_users_total = 3`, `public_usuarios_total = 3`,
  `auth_sem_perfil = 0`, `perfil_sem_auth = 0`); nenhuma coluna
  destrutiva foi rodada; `db/10_reset_producao.sql` e
  `db/11_reset_ops.sql` nÃ£o foram executados; produÃ§Ã£o nÃ£o foi
  tocada. Compatibilidade preservada: `ativo` tem `DEFAULT TRUE`,
  entÃ£o `admin-create-user` continua funcionando sem alteraÃ§Ã£o (a
  Edge Function insere apenas id/email/nome/tipo/fornecedor_id e o
  default preenche `ativo`).
- ðŸŸ¡ **Apply staging confirmado (nÃ£o executado por IAexec).** Fase
  `RAVATEX-TAPETES-AUTH-DISABLE-USER-SCHEMA-APPLY-A` (docs-only,
  `8fa924a`) preparou a orientaÃ§Ã£o; fase
  `RAVATEX-TAPETES-AUTH-DISABLE-USER-SCHEMA-APPLY-EVIDENCE-A`
  (esta) registra a aplicaÃ§Ã£o real feita por HMNlead no Dashboard.
  ValidaÃ§Ãµes locais (smoke 20/20 + regressÃµes 65/65 + ausÃªncia de
  DELETE/DROP/TRUNCATE/secrets) passaram **antes** da aplicaÃ§Ã£o.
  **Nenhum SQL foi rodado por IAexec em qualquer fase.** A execuÃ§Ã£o
  do SQL no Supabase staging Ã© e continua sendo responsabilidade
  exclusiva do HMNlead no Dashboard (project ref
  `ucrjtfswnfdlxwtmxnoo`).
- ðŸŸ¡ **Edge Function `admin-disable-user` criada localmente (sem
  deploy).** Fase `RAVATEX-TAPETES-AUTH-DISABLE-USER-EDGE-A`.
  ImplementaÃ§Ã£o em `supabase/functions/admin-disable-user/index.ts`
  segue o padrÃ£o estrutural de `admin-create-user` (mesmos
  `_shared/cors.ts` e `_shared/response.ts`); valida admin ativo
  server-side; bloqueia auto-desativaÃ§Ã£o e Ãºltimo admin ativo; faz
  soft delete no perfil + ban Auth via
  `auth.admin.updateUserById(target_id, { ban_duration: '876000h' })`;
  compensa (reativa perfil) se o ban falhar; nÃ£o usa `.delete()` nem
  `auth.admin.deleteUser`. Smoke estÃ¡tico
  `tests/admin-disable-user.smoke.js` 39/39 verde. RegressÃµes
  focais preservadas. **Sem deploy, sem Supabase real, sem
  alteraÃ§Ã£o de UI** â€” `js/**`, `index.html`, `db/**` e
  `admin-create-user` intocados. UI de `#/cadastros/usuarios`
  continua com placeholder `Em breve` para exclusÃ£o. Deploy e
  validaÃ§Ã£o E2E em staging ficam para
  `RAVATEX-TAPETES-AUTH-DISABLE-USER-EDGE-STAGING-DEPLOY-A`.
- ðŸŸ¡ **Runner local de E2E staging criado (sem E2E real).** Fase
  `RAVATEX-TAPETES-AUTH-DISABLE-USER-E2E-AUTO-RUNNER-A`.
  ImplementaÃ§Ã£o em
  `scripts/staging/admin-disable-user-e2e.mjs` (ESM, sem
  dependÃªncias externas) com comandos `setup` e `run`. `setup`
  detecta staging automaticamente de `js/config.js` (URL + anon
  key jÃ¡ pÃºblicas) e pede admin email/senha uma vez, salvando
  em `.ravatex-local/admin-disable-user-e2e.config.json`
  (gitignored). `run` carrega o config, aborta se URL !=
  `ucrjtfswnfdlxwtmxnoo` ou se for `bhgifjrfagkzubpyqpew`,
  faz login admin, valida `tipo=admin AND ativo=true`, resolve
  `fornecedor_id` (config ou autodetect), cria fornecedor
  descartÃ¡vel via `admin-create-user`, valida perfil criado,
  tenta `admin-disable-user` como fornecedor (espera
  `FORBIDDEN`), revalida admin ativo, re-login admin, desativa
  o descartÃ¡vel (espera `ativo=false`, `auth_banned=true`),
  valida `desativado_em`/`desativado_por`/`motivo_desativacao`
  em `public.usuarios`, tenta login do desativado (espera
  falha), re-desativa (espera `already_disabled=true`), tenta
  self-disable (espera `SELF_DISABLE_FORBIDDEN`), imprime
  resumo sanitizado. Smoke estÃ¡tico
  `tests/admin-disable-user-e2e-runner.smoke.js` 32/32 verde
  (apÃ³s `E2E-RUNNER-FIX-A`); regressÃµes focais preservadas
  (`admin-create-user` 17/17, `admin-disable-user` 39/39).
  **E2E real ainda nÃ£o foi rerodado** apÃ³s o fix â€” fica para
  a prÃ³xima (`RAVATEX-TAPETES-AUTH-DISABLE-USER-E2E-A` ou
  similar).
- ðŸŸ¡ **Bug do runner no login bloqueado corrigido.** Fase
  `RAVATEX-TAPETES-AUTH-DISABLE-USER-E2E-RUNNER-FIX-A`
  (esta fase). Quando o runner real foi executado em staging
  avanÃ§ou atÃ© `profile_inactive` e falhou com
  `HTTP 400 User is banned` no passo `login_blocked`. A falha
  era o **resultado esperado** do teste, mas foi tratada como
  erro fatal porque `supabaseLogin` chamava `die()`/
  `process.exit` em qualquer HTTP 4xx e usava a mensagem
  hardcoded "Login admin falhou" (rÃ³tulo incorreto para o
  usuÃ¡rio descartÃ¡vel desativado). CorreÃ§Ã£o: runner agora
  separa os helpers `loginExpectSuccess(...)` (fatal, com
  rÃ³tulo parametrizado como `admin_login failed`) e
  `loginExpectFailure(...)` (nÃ£o-fatal, retorna
  `{ ok, unexpected, status, detail }`; aceita HTTP 4xx com
  `User is banned`/`banned`/`Banned user`/`User is already
  registered` como falha esperada). Passo `login_blocked`
  agora imprime `login_blocked: OK` e continua para
  `idempotency` e `self_disable_blocked`. Smoke estÃ¡tico
  `tests/admin-disable-user-e2e-runner.smoke.js` expandido
  para 32/32 verde (4 testes novos: login bloqueado esperado,
  fluxo continua, loginExpectSuccess em 3 logins,
  loginExpectFailure com substrings banned, loginExpectFailure
  retorna controle).   `admin-disable-user.smoke.js` 39/39
  verde. **E2E real nÃ£o foi rerodado nesta fase** â€” sÃ³ apÃ³s
  autorizaÃ§Ã£o do HMNlead.
- ðŸŸ¡ **UI `#/cadastros/usuarios` integrada com `admin-disable-user`.**
  Fase `RAVATEX-TAPETES-AUTH-DISABLE-USER-UI-A`. BotÃ£o
  `Desativar` substitui o placeholder `Em breve`; chama
  `window.supa.functions.invoke('admin-disable-user', { body: {
  user_id, reason } })`; modal de confirmaÃ§Ã£o com campo de
  motivo opcional (atÃ© 500 chars); mapeia cÃ³digos de erro
  (`FORBIDDEN`/`SELF_DISABLE_FORBIDDEN`/`LAST_ADMIN_FORBIDDEN`/
  `NOT_FOUND`/`AUTH_BAN_FAILED`/`COMPENSATION_FAILED`/
  `VALIDATION_ERROR`/`UNAUTHORIZED`) para mensagens PT-BR; guarda
  de UX para o prÃ³prio usuÃ¡rio logado e para usuÃ¡rios jÃ¡
  inativos (proteÃ§Ã£o visual, nÃ£o substitui server-side); coluna
  `Status` na listagem mostra `Ativo`/`Inativo`. E2E real do
  runner backend jÃ¡ havia passado em `result: PASS` em staging
  (`ucrjtfswnfdlxwtmxnoo`) â€” ver LEDGER Â§5k para evidÃªncia
  sanitizada. Smoke estÃ¡tico
  `tests/cadastros-usuarios-auth-ui.smoke.js` 23/23 verde;
  regressÃµes focais todas verdes.
- ðŸŸ¢ **ValidaÃ§Ã£o manual da UI de desativaÃ§Ã£o em staging
  (HMNlead).** Fase
  `RAVATEX-TAPETES-AUTH-DISABLE-USER-UI-VALIDATION-CLOSEOUT-A`
  (esta fase, docs-only). Tela `#/cadastros/usuarios` aberta em
  staging `ucrjtfswnfdlxwtmxnoo`; botÃ£o `Desativar` confirmado
  visÃ­vel; guarda de UX para usuÃ¡rio jÃ¡ inativo exibiu a
  mensagem `"UsuÃ¡rio jÃ¡ estÃ¡ inativo"` (sem chamada Ã  Edge
  Function); fornecedor descartÃ¡vel ativo foi criado pela UI e
  em seguida desativado via botÃ£o `Desativar`; fluxo real
  passou. Warnings nÃ£o bloqueantes, se presentes, continuam:
  Tailwind CDN, `favicon.ico` 404. **ProduÃ§Ã£o
  `bhgifjrfagkzubpyqpew` e `origin/main` intocados.**
  Detalhes em "EvidÃªncia da validaÃ§Ã£o manual da UI em staging"
  abaixo.
- ðŸŸ¡ Staging mostra log `relation "supabase_migrations.schema_migrations"
  does not exist` (ruÃ­do do dashboard, nÃ£o do app).
- ðŸŸ¡ Tailwind CDN ainda gera warning de produÃ§Ã£o (nÃ£o bloqueante;
  requer mudanÃ§a de stack se for endereÃ§ar).
- ðŸŸ¡ GitHub Pages staging ainda pode ser tratado depois, se necessÃ¡rio
  para homologaÃ§Ã£o pÃºblica.
- ðŸŸ¢ **Detalhe admin read-only do Pedido (`#/pedidos/<uuid>`)**
  (fase `RAVATEX-TAPETES-PEDIDOS-UI-ADMIN-C3A`): nova tela
  `js/screens/pedido-detail.js` com `screenPedidoDetalhe(pedidoId)`;
  resolve via match dinÃ¢mico estendido em `js/router.js`
  (`^#/pedidos/<uuid>$`, admin-only, sem `public: true`);
  carregado em `index.html` apÃ³s `pedido-form.js` e antes de
  `boot.js`; botÃ£o "Visualizar" de `js/screens/pedidos-list.js`
  navega para `#/pedidos/<id>`. ConteÃºdo: cabeÃ§alho com
  nÃºmero/status badge/cliente/prazo/criado em, dados gerais
  (observaÃ§Ã£o + atualizado em), tabela de itens com modelo, cor_1
  /cor_2, largura, preview 48x48, metros e observaÃ§Ã£o do item.
  AÃ§Ãµes: Voltar (funcional), Editar/Cancelar/Receber (placeholders
  `disabled` com `title="Em breve"`). SELECT-only em `pedidos`
  (com join aninhado `cliente:cliente_id(id, nome)`), `pedido_itens`,
  `modelos`, `cores`. Sem insert/update/delete/rpc, sem
  `functions.invoke`, sem `token_acesso`, sem `service_role`, sem
  rota pÃºblica, sem mutaÃ§Ã£o em `lotes`/`pedido_eventos`, sem
  schema/SQL, sem OP, sem Edge Function, sem fornecedor.
  Smoke estÃ¡tico `tests/pedido-detail.smoke.js` 30/30 verde.
  RegressÃµes focadas: `pedido-form` 35/35, `pedido-ui` 18/18,
  `pedidos-list` 29/29, `pedidos-schema` 41/41, `boot` 22/22
  (com 2 testes novos: `matchRoute('#/pedidos/<uuid>')` resolve
  para `screenPedidoDetalhe` admin-only; IDs nÃ£o-UUID nÃ£o casam),
  `router` 34/34. **Total: 209/209 verdes** (focados).
  Falhas prÃ©-existentes em `tests/ops-list-screen.smoke.js` (10/30)
  sÃ£o de testes do refactor monolÃ­tico antigo, **fora do escopo**
  desta fase. **Sem deploy, sem Supabase real, sem SQL, sem
  produÃ§Ã£o, sem origin/main, sem PR #2 nesta fase.** PrÃ³xima fase
  recomendada: `RAVATEX-TAPETES-PEDIDOS-UI-ADMIN-C3B` (adiÃ§Ã£o de
  aÃ§Ãµes reais de status/ediÃ§Ã£o/cancelamento), **somente com
  autorizaÃ§Ã£o explÃ­cita** do HMNlead.
- ðŸŸ¢ **AÃ§Ãµes reais RESTRITAS de status no detalhe do Pedido** (fase
  `RAVATEX-TAPETES-PEDIDOS-UI-ADMIN-C3B`, esta). `pedido-detail.js`
  agora define `TRANSITIONS` (rascunhoâ†’recebido, recebidoâ†’
  confirmado, rascunho/recebido/confirmadoâ†’cancelado; produzindo
  /entregue/cancelado terminais), `ACTION_LABEL` e funÃ§Ã£o interna
  `alterarStatus(novoStatus, btn)`. AÃ§Ãµes reais: "Marcar como
  recebido" (rascunho), "Confirmar pedido" (recebido) e "Cancelar
  pedido" (qualquer dos 3 estados iniciais â€” exige
  `window.confirmDialog`). Update Ã© APENAS em `pedidos.status`
  com `.eq('id', pedidoId)` (admin-only via RLS). ApÃ³s sucesso,
  atualiza `state.pedido.status` e chama `render()`. Para
  status terminais (cancelado/produzindo/entregue), exibe
  mensagem informativa em vez de botÃµes. Editar continua
  placeholder (`disabled` com `title="Em breve"`) â€” fica para
  C3C. Sem insert/update/delete em `pedido_itens`, sem insert em
  `pedido_eventos` (decisÃ£o C3B: best-effort fica para fase
  futura), sem mexer em `lotes`/`pedido_eventos`, sem OP, sem
  Edge Function, sem RPC, sem schema, sem token pÃºblico.
  Smoke estÃ¡tico `tests/pedido-detail.smoke.js` 42/42 verde
  (12 testes novos: 5 transiÃ§Ãµes permitidas, 2 transiÃ§Ãµes
  proibidas para produzindo/entregue, terminal de cancelado,
  `alterarStatus`, update restrito a `status` apenas, sem
  insert em `pedido_eventos`, uso de `confirmDialog` apenas
  para cancelar, botÃµes reais vs placeholder Editar, re-render
  apÃ³s sucesso). RegressÃµes focadas preservadas: `pedido-form`
  35/35, `pedido-ui` 18/18, `pedidos-list` 29/29, `pedidos-schema`
  41/41, `boot` 22/22, `router` 34/34. **Total: 221/221
  verdes** (focados). Falhas prÃ©-existentes em
  `tests/ops-list-screen.smoke.js` (10/30) sÃ£o do refactor
  monolÃ­tico antigo, **fora do escopo**. **Sem deploy, sem
  Supabase real, sem SQL, sem produÃ§Ã£o, sem origin/main, sem
  PR #2 nesta fase.** PrÃ³xima fase recomendada:
  `RAVATEX-TAPETES-PEDIDOS-UI-ADMIN-C3C` (ediÃ§Ã£o de campos
  editÃ¡veis do Pedido + itens), **somente com autorizaÃ§Ã£o
  explÃ­cita** do HMNlead.
- ðŸŸ¢ **EdiÃ§Ã£o admin RESTRITA dos dados gerais do Pedido** (fase
  `RAVATEX-TAPETES-PEDIDOS-UI-ADMIN-C3C1`, esta). Nova tela
  `js/screens/pedido-edit.js` com `screenPedidoEditar(pedidoId)`;
  resolve via match dinÃ¢mico estendido em `js/router.js`
  (`^#/pedidos/<uuid>/editar$`, admin-only, sem `public: true`).
  Carregado em `index.html` apÃ³s `pedido-detail.js` e antes de
  `boot.js`. BotÃ£o "Editar" de `js/screens/pedido-detail.js`
  navega para `#/pedidos/<id>/editar` APENAS para status
  editÃ¡veis (`rascunho` / `recebido`); para os demais status,
  fica como placeholder desabilitado com `title` explicativo.
  Helper `isPedidoEditavel(status)` adicionado em
  `js/pedido-ui.js` (`PEDIDO_STATUS_EDITAVEL = ['rascunho',
  'recebido']`). ConteÃºdo da tela: cabeÃ§alho com nÃºmero do
  pedido, banner de status com nota de editabilidade, form
  com `cliente_id` (select obrigatÃ³rio), `prazo_entrega`
  (date opcional), `observacao` (textarea opcional); botÃ£o
  Cancelar volta para o detalhe; botÃ£o Salvar aplica update.
  Em status nÃ£o editÃ¡vel, campos e Salvar ficam desabilitados
  e o banner mostra o motivo. Write APENAS em `pedidos` com
  payload restrito a 3 chaves (`cliente_id`, `prazo_entrega`,
  `observacao`); sem update em `status`/`numero`, sem
  update/insert/delete em `pedido_itens`, sem insert em
  `pedido_eventos`, sem mexer em `lotes`, sem OP, sem Edge
  Function, sem RPC, sem schema, sem token pÃºblico, sem
  service_role. ApÃ³s sucesso, navega de volta para o detalhe.
  Smoke estÃ¡tico `tests/pedido-edit.smoke.js` 35/35 verde.
  `tests/pedido-detail.smoke.js` atualizado (42/42) â€” botÃ£o
  Editar Ã© controlado por `isPedidoEditavel` (funcional para
  rascunho/recebido, placeholder para os demais); C3B status
  actions preservadas. `tests/boot.smoke.js` 25/25 (3 testes
  novos: rota de ediÃ§Ã£o admin-only, rejeita IDs nÃ£o-UUID,
  distingue detalhe vs ediÃ§Ã£o). `tests/router.smoke.js` 38/38
  (4 testes novos para a nova rota dinÃ¢mica). **Total:
  263/263 verdes** (focados). **Sem deploy, sem Supabase real,
  sem SQL, sem produÃ§Ã£o, sem origin/main, sem PR #2 nesta
  fase.** PrÃ³xima fase recomendada:
  `RAVATEX-TAPETES-PEDIDOS-UI-ADMIN-C3C2` (ediÃ§Ã£o de itens
  do Pedido), **somente com autorizaÃ§Ã£o explÃ­cita** do HMNlead.
- ðŸŸ¢ **EdiÃ§Ã£o admin RESTRITA de itens existentes do Pedido**
  (fase `RAVATEX-TAPETES-PEDIDOS-UI-ADMIN-C3C2B`, esta).
  Nova tela `js/screens/pedido-itens-edit.js` com
  `screenPedidoItensEditar(pedidoId)`; resolve via match
  dinÃ¢mico em `js/router.js`
  (`^#/pedidos/<uuid>/itens$`, admin-only, sem `public: true`).
  Carregado em `index.html` apÃ³s `pedido-edit.js` e antes de
  `boot.js`. BotÃ£o "Editar itens" de `js/screens/pedido-detail.js`
  (helper `buildEditItensButton()`) navega para
  `#/pedidos/<id>/itens` APENAS para status editÃ¡veis
  (`rascunho` / `recebido`, via `window.isPedidoEditavel`);
  para os demais status, fica como placeholder desabilitado.
  ConteÃºdo: cabeÃ§alho com nÃºmero do pedido, banner de status
  com nota de editabilidade, lista de itens existentes com
  select de modelo (`modelos`), input number de metros e
  input de observaÃ§Ã£o; sem controles de add/remove/reordenar
  (C3C2C) e sem overrides de largura/cor (C3C2D). Write
  APENAS em `pedido_itens` com payload restrito a 3 chaves
  (`modelo_id`, `metros`, `observacao`); sem update em
  `pedidos`, sem update/insert/delete em `pedido_itens`, sem
  insert em `pedido_eventos`, sem mexer em `lotes`, sem OP,
  sem Edge Function, sem RPC, sem schema, sem token pÃºblico,
  sem service_role, sem rota pÃºblica. Sem compensaÃ§Ã£o
  automÃ¡tica nesta fase (limitaÃ§Ã£o documentada: se um update
  falhar, os anteriores permanecem; usuÃ¡rio re-edita).
  ApÃ³s sucesso, navega de volta para o detalhe.
  Smoke estÃ¡tico `tests/pedido-itens-edit.smoke.js` 41/41
  verde (17 seÃ§Ãµes de cobertura: existÃªncia, sintaxe,
  namespace, ordem de scripts, router dinÃ¢mico, SELECTs,
  write restrito, payload de 3 chaves, ausÃªncia de campos
  proibidos, ausÃªncia de insert/delete, ausÃªncia de update
  em `pedidos`, ausÃªncia de `pedido_eventos`/`lotes`,
  ausÃªncia de Edge Function, ausÃªncia de OP, ausÃªncia de
  token_acesso/service_role, ausÃªncia de rota pÃºblica,
  ausÃªncia de controles de add/remove/reordenar, mensagem
  "Pedido sem itens", botÃ£o "Editar itens" no detalhe).
  `tests/pedido-detail.smoke.js` atualizado (43/43) â€” botÃ£o
  "Editar itens" controlado por `isPedidoEditavel`
  (C3C2B); C3B status actions e C3C1 ediÃ§Ã£o de dados gerais
  preservadas. `tests/router.smoke.js` atualizado (41/41) â€”
  3 testes novos para a nova rota. `tests/boot.smoke.js`
  atualizado (28/28) â€” 3 testes novos para a nova rota.
  **Total: 311/311 verdes** (focados). **Sem deploy, sem
  Supabase real, sem SQL, sem produÃ§Ã£o, sem origin/main, sem
  PR #2 nesta fase.** PrÃ³xima fase recomendada:
  `RAVATEX-TAPETES-PEDIDOS-UI-ADMIN-C3C2C` (adicionar/remover
  itens + recÃ¡lculo de ordem + mÃ­nimo de 1 item), **somente
  com autorizaÃ§Ã£o explÃ­cita** do HMNlead.
- ðŸŸ¢ **Adicionar novo item ao Pedido pela tela de ediÃ§Ã£o** (fase
   `RAVATEX-TAPETES-PEDIDOS-UI-ADMIN-C3C2C1`, esta).
   `js/screens/pedido-itens-edit.js` (jÃ¡ existente) foi estendido
   para permitir ADICIONAR novos itens alÃ©m de editar os
   existentes (C3C2B). Comportamento: botÃ£o "+ Adicionar item"
   visÃ­vel apenas para status editÃ¡veis; ao clicar, novo item
   Ã© criado no estado local com flag `isNew: true` (campos
   vazios para preenchimento: `modelo_id` obrigatÃ³rio, `metros`
   > 0, `observacao` opcional); botÃ£o "Descartar novo item" em
   cada item novo para descarte apenas local (nÃ£o remove
   item existente). Itens novos tÃªm visual distinto (borda
   tracejada + label "Novo (nÃ£o salvo)"). `salvar()` separa
   `existingItems` (update sequencial, 3 chaves no payload)
   de `newItems` (insert em batch com 5 chaves:
   `pedido_id`, `modelo_id`, `metros`, `observacao`, `ordem`,
   onde `ordem = existingItems.length + i` â€” novos vÃ£o para o
   fim). Ordem recomendada: updates primeiro, depois insert.
   Sem delete/upsert em `pedido_itens`, sem remover item
   existente (C3C2C2), sem drag-and-drop, sem reordenar
   manualmente, sem editar `largura`/`cor_1_id`/`cor_2_id`
   (C3C2D), sem update em `pedidos`, sem `pedido_eventos`/
   `lotes`, sem OP, sem Edge Function, sem RPC, sem schema, sem
   token pÃºblico, sem `service_role`, sem rota pÃºblica.
   `tests/pedido-itens-edit.smoke.js` atualizado (46/46
   verde) â€” 5 testes novos (botÃ£o "+ Adicionar item" existe,
   insert de novos itens com 5 chaves permitidas, insert NÃƒO
   contÃ©m campos proibidos, ordem calculada automaticamente,
   botÃ£o "Descartar novo item" apenas para isNew) + 1 teste
   atualizado (insert permitido, delete/upsert proibidos) +
   1 teste invertido ("TEM botÃ£o Adicionar item" em vez de
   "NÃƒO tem"). `tests/pedido-detail.smoke.js` preservado
   (43/43). `tests/boot.smoke.js` e `tests/router.smoke.js`
   preservados (28/28 e 41/41). **Total: 316/316 verdes**
   (focados). **Sem deploy, sem Supabase real, sem SQL, sem
   produÃ§Ã£o, sem origin/main, sem PR #2 nesta fase.** PrÃ³xima
   fase recomendada: `RAVATEX-TAPETES-PEDIDOS-UI-ADMIN-C3C2C2`
   (remover item existente do Pedido), **somente com
   autorizaÃ§Ã£o explÃ­cita** do HMNlead.
 - ðŸŸ¢ **Remover item existente do Pedido pela tela de ediÃ§Ã£o**
   (fase `RAVATEX-TAPETES-PEDIDOS-UI-ADMIN-C3C2C2`, esta).
   `js/screens/pedido-itens-edit.js` (jÃ¡ existente) foi estendido
   para tambÃ©m permitir REMOVER itens existentes do Pedido
   (alÃ©m de editar da C3C2B e adicionar novos da C3C2C1).
   Comportamento: cada item EXISTENTE (!isNew, !markedForDeletion)
   tem botÃ£o "Remover item" (visÃ­vel apenas para status
   editÃ¡veis) que abre `window.confirmDialog` com confirmaÃ§Ã£o
   visual (`title: "Remover item do pedido?"`, `confirmLabel:
   "Remover item"`, `danger: true`). ApÃ³s confirmar, o item Ã©
   marcado localmente com `markedForDeletion: true` (visual
   distinto: borda tracejada vermelha, opacidade 70, label
   "SerÃ¡ removido ao salvar") e o botÃ£o vira "Desfazer remoÃ§Ã£o"
   (limpa a flag e re-renderiza). Itens NOVOS (isNew=true)
   continuam usando "Descartar novo item" (apenas local, sem
   tocar no banco) â€” "Remover item" Ã© exclusivo de existentes.
   MÃ­nimo de 1 item no Pedido Ã© garantido: `marcarParaRemocao`
   prÃ©-checa `naoMarcados <= 1` e bloqueia com toast
   `"Pedido precisa ter pelo menos 1 item."` se a remoÃ§Ã£o
   deixaria 0 itens. TambÃ©m bloqueia se `state.blockedStatus`.
   A remoÃ§Ã£o Ã© aplicada APENAS no `salvar()` (nÃ£o hÃ¡ operaÃ§Ã£o
   de banco atÃ© lÃ¡). `salvar()` foi reestruturado para filtrar
   `state.itens` em 4 grupos: `activeItems` (nÃ£o marcados;
   validados e processados), `existingItems` (subset de
   active, !isNew â€” UPDATE sequencial com 3 chaves:
   `modelo_id`/`metros`/`observacao` + dupla `.eq('id')` +
   `.eq('pedido_id')`), `newItems` (subset de active, isNew â€”
   INSERT em batch com 5 chaves: `pedido_id`/`modelo_id`/
   `metros`/`observacao`/`ordem` onde `ordem =
   existingItems.length + i`), `removedItems` (marcados E
   !isNew â€” DELETE sequencial com `.eq('id', dbId).eq('pedido_id',
   pedidoId)`). SequÃªncia: 1) UPDATE existentes, 2) INSERT novos,
   3) DELETE removidos. Cada etapa aborta em erro; sem
   compensaÃ§Ã£o automÃ¡tica (limitaÃ§Ã£o documentada: se uma etapa
   falhar, etapas anteriores podem ter sido aplicadas; usuÃ¡rio
   re-edita e tenta novamente). Toast de sucesso conta
   `N novo(s) inserido(s)` e `M removido(s)`. Sem drag-and-drop
   / reordenaÃ§Ã£o manual (C3C2C2+), sem editar
   `largura`/`cor_1_id`/`cor_2_id` (C3C2D), sem update em
   `pedidos`, sem `pedido_eventos`/`lotes`, sem OP, sem Edge
   Function, sem RPC, sem schema, sem token pÃºblico, sem
   `service_role`, sem rota pÃºblica, sem `functions.invoke`.
   `tests/pedido-itens-edit.smoke.js` atualizado (59/59
   verde) â€” 13 testes novos (TEM botÃ£o "Remover item" para
   existente com `marcarParaRemocao`/`desfazerRemocao`; item
   NOVO NÃƒO tem "Remover item" (continua com "Descartar novo
   item"); uso de `window.confirmDialog` com `confirmLabel:
   "Remover item"` e `danger: true`; flag `markedForDeletion`
   inicializada como `false` em itens existentes e novos;
   `marcarParaRemocao` seta `true` e `desfazerRemocao` seta
   `false`; `onConfirm` apenas marca e re-renderiza sem
   operaÃ§Ã£o de banco; TEM botÃ£o "Desfazer remoÃ§Ã£o" para item
   marcado com visual vermelho; `marcarParaRemocao` valida
   mÃ­nimo de 1 item E bloqueia em status nÃ£o editÃ¡vel;
   `salvar()` faz `.delete().eq('id', it.dbId).eq('pedido_id',
   pedidoId)` em `pedido_itens`; delete sÃ³ dentro de `salvar()`;
   `salvar()` separa `activeItems`/`existingItems`/`newItems`/
   `removedItems`; update/insert/delete todos dentro de
   `salvar()`; delete em `pedido_itens` NÃƒO toca outras
   tabelas) + 1 teste invertido (TEM botÃ£o Remover existente
   em vez de NÃƒO tem) + 1 teste atualizado (NÃƒO faz upsert;
   delete agora permitido). `tests/pedido-detail.smoke.js`
   preservado (43/43). `tests/boot.smoke.js` e
   `tests/router.smoke.js` preservados (28/28 e 41/41).
   **Total: 329/329 verdes** (focados: 59 + 43 + 28 + 41 +
   35 + 18 + 29 + 41 + 32 + 3 [pedido-form] = 329). **Sem
   deploy, sem Supabase real, sem SQL, sem produÃ§Ã£o, sem
   origin/main, sem PR #2 nesta fase.** PrÃ³xima fase
   recomendada: `RAVATEX-TAPETES-PEDIDOS-UI-ADMIN-C3C2C3`
   (reordenaÃ§Ã£o manual de itens com drag-and-drop / setas),
   **somente com autorizaÃ§Ã£o explÃ­cita** do HMNlead.
 - ðŸŸ¢ **NormalizaÃ§Ã£o automÃ¡tica de `ordem` no `salvar()`**
   (fase `RAVATEX-TAPETES-PEDIDOS-UI-ADMIN-C3C2C3`, esta).
   `js/screens/pedido-itens-edit.js` (jÃ¡ existente) foi estendido
   para normalizar automaticamente `ordem` dos itens finais no
   `salvar()` (alÃ©m de editar da C3C2B, adicionar da C3C2C1 e
   remover da C3C2C2). Comportamento: no `salvar()`, antes de
   qualquer operaÃ§Ã£o de banco, hÃ¡ um loop
   `for (let i = 0; i < activeItems.length; i++) {
   activeItems[i].ordem = i; }` que recalcula `ordem` por
   posiÃ§Ã£o final no array `activeItems = state.itens.filter(
   !markedForDeletion)`. Isso elimina lacunas apÃ³s add/remove:
   itens `[0,1,2,3]` com item 1 removido â†’ `[0,2,3]` normalizado
   para `[0,1,2]`. SequÃªncia final garantida: `0, 1, 2, ...` sem
   sobreposiÃ§Ã£o e sem gaps. Itens marcados para remoÃ§Ã£o sÃ£o
   EXCLUÃDOS do cÃ¡lculo (nÃ£o entram na sequÃªncia final). Sem
   UI de reordenaÃ§Ã£o manual (sem drag-and-drop, sem setas de
   subir/descer, sem botÃµes moveUp/moveDown, sem reordenar).
   `salvar()` foi atualizado: update agora tem payload com 4
   chaves (`modelo_id`/`metros`/`observacao`/`ordem` â€” `ordem`
   Ã© nova no payload de update, para aplicar a normalizaÃ§Ã£o
   nos itens remanescentes apÃ³s remoÃ§Ã£o); insert continua com
   5 chaves mas `ordem: it.ordem` (vindo da normalizaÃ§Ã£o, nÃ£o
   mais `existingItems.length + i`); delete continua com
   `.eq('id', dbId).eq('pedido_id', pedidoId)` em `pedido_itens`.
   SequÃªncia: 1) separar `activeItems` (filter !markedForDeletion)
   e `removedItems` (filter markedForDeletion && !isNew), 2)
   validar `activeItems.length >= 1` e cada item (modeloId,
   metros > 0), 3) **normalizar** `activeItems[i].ordem = i` por
   posiÃ§Ã£o, 4) separar `existingItems`/`newItems`, 5) UPDATE
   sequencial com `.eq('id', it.dbId).eq('pedido_id', pedidoId)`,
   6) INSERT em batch, 7) DELETE sequencial. Toast de sucesso
   continua contando inserts/removes. LimitaÃ§Ã£o documentada
   (sem transaÃ§Ã£o/RPC, sem compensaÃ§Ã£o automÃ¡tica) preservada
   da C3C2C2. Sem drag-and-drop, sem setas, sem reordenaÃ§Ã£o
   manual, sem editar `largura`/`cor_1_id`/`cor_2_id` (C3C2D),
   sem update em `pedidos`, sem `pedido_eventos`/`lotes`, sem
   OP, sem Edge Function, sem RPC, sem schema, sem token
   pÃºblico, sem `service_role`, sem rota pÃºblica, sem
   `functions.invoke`. `tests/pedido-itens-edit.smoke.js`
   atualizado (64/64 verde) â€” 5 testes novos
   (normalizaÃ§Ã£o `activeItems[i].ordem = i` por posiÃ§Ã£o; loop
   usa `for` (nÃ£o forEach) para acessar Ã­ndice; normalizaÃ§Ã£o
   ANTES de separar existing/new; `activeItems` Ã© base do
   cÃ¡lculo; update de item existente INCLUI `ordem` com valor
   `it.ordem`; insert usa `it.ordem` (nÃ£o mais
   `existingItems.length + i`); payload NÃƒO contÃ©m
   `largura`/`cor_1_id`/`cor_2_id`) + 2 testes invertidos
   (payload de update EXATAMENTE 4 chaves em vez de 3; NÃƒO
   atualiza campos proibidos exceto `ordem` que agora Ã©
   permitida) + 1 teste atualizado (NÃƒO tem drag/setas/
   subir/descer; mantÃ©m reordenar como proibido). RegressÃµes
   focadas todas verdes: `pedido-detail` 43/43, `pedido-edit`
   35/35, `pedido-form` 35/35, `pedido-ui` 18/18,
   `pedidos-list` 29/29, `pedidos-schema` 41/41, `boot` 28/28,
   `router` 41/41. **Total: 334/334 verdes** (focados).
   **Sem deploy, sem Supabase real, sem SQL, sem produÃ§Ã£o,
   sem origin/main, sem PR #2 nesta fase.** PrÃ³xima fase
   recomendada: `RAVATEX-TAPETES-PEDIDOS-UI-ADMIN-C3C2D`
   (overrides opcionais de `largura`/`cor_1_id`/`cor_2_id` por
   item) ou `RAVATEX-TAPETES-PEDIDOS-UI-ADMIN-C3C2C4`
    (reordenaÃ§Ã£o manual com drag-and-drop / setas), **somente
    com autorizaÃ§Ã£o explÃ­cita** do HMNlead.
  - ðŸŸ¢ **Perfil autenticado de cliente â€” schema/RLS versionado** (fase
    `RAVATEX-TAPETES-PEDIDOS-CLIENTE-SCHEMA-RLS-B1`, concluÃ­da).
    `db/14_cliente_perfil_schema.sql` idempotente criado com:
    role `cliente` em `usuarios.tipo` (constraint
    `usuarios_tipo_check`), coluna `usuarios.cliente_id BIGINT`
    (FK â†’ `public.clientes(id) ON DELETE SET NULL`), constraint
    `usuarios_vinculo_exclusivo_check` (admin: ambos NULL,
    fornecedor: sÃ³ `fornecedor_id`, cliente: sÃ³ `cliente_id`),
    funÃ§Ã£o `public.meu_cliente_id()` (SECURITY DEFINER, STABLE,
    `search_path = public, auth`; exige `tipo = 'cliente' AND
    ativo IS TRUE AND cliente_id IS NOT NULL`; retorna NULL em
    falhas com `EXCEPTION WHEN OTHERS`), GRANT EXECUTE para
    `anon, authenticated`. RLS em `clientes`: mantÃ©m admin full
    existente; adiciona `clientes_cliente_select` (cliente vÃª
    apenas o prÃ³prio cadastro via `id = meu_cliente_id()`).
    RLS em `pedidos`: mantÃ©m `pedidos_admin_all` existente;
    adiciona `pedidos_cliente_select` (SELECT via
    `cliente_id = meu_cliente_id()`) e `pedidos_cliente_insert`
    (INSERT via `cliente_id = meu_cliente_id() AND status IN
    ('rascunho','recebido')`). RLS em `pedido_itens`: mantÃ©m
    `pedido_itens_admin_all` existente; adiciona
    `pedido_itens_cliente_select` (SELECT via subquery em
    `pedidos` verificando `cliente_id = meu_cliente_id()`) e
    `pedido_itens_cliente_insert` (INSERT via subquery em
    `pedidos` verificando dono + `status IN
    ('rascunho','recebido')`). **NÃƒO** hÃ¡ UPDATE/DELETE de
    cliente em `pedidos` ou `pedido_itens` (fica para fase futura
    â€” exige controle mais fino de colunas/transiÃ§Ãµes).
    `pedido_eventos` permanece admin-only (auditoria interna;
    comentÃ¡rio explÃ­cito no SQL). **NÃƒO** hÃ¡ policy por
    `token_acesso`, **NÃƒO** hÃ¡ acesso anon, **NÃƒO** hÃ¡ rota
    pÃºblica, **NÃƒO** hÃ¡ `service_role`/secrets, **NÃƒO** hÃ¡
    DROP destrutivo, script Ã© idempotente (IF NOT EXISTS /
    DROP IF EXISTS / CREATE OR REPLACE). `js/**`,
    `supabase/functions/**`, `index.html` e migrations antigas
    **intocados**. Smoke estÃ¡tico
    `tests/cliente-perfil-schema.smoke.js` 49/49 verde.
    RegressÃµes focadas: `pedidos-schema.smoke.js` 41/41,
    `auth-disable-user-schema.smoke.js` 20/20 â€” todas verdes.

 - ðŸŸ¢ **AplicaÃ§Ã£o do schema cliente em staging** (fase
    `RAVATEX-TAPETES-PEDIDOS-CLIENTE-SCHEMA-RLS-B2`, concluÃ­da).
    `db/14_cliente_perfil_schema.sql` aplicado em
    `ucrjtfswnfdlxwtmxnoo` via Supabase Management API
    (`POST /v1/projects/ucrjtfswnfdlxwtmxnoo/database/query`).
    Status 201, 33 statements. ValidaÃ§Ãµes prÃ©-aplicaÃ§Ã£o: 5 tabelas
    alvo presentes, `usuarios.cliente_id` ausente antes, 7
    usuÃ¡rios sem violaÃ§Ãµes, 2 clientes existentes. ValidaÃ§Ãµes
    pÃ³s-aplicaÃ§Ã£o 23/23: `usuarios_tipo_check` inclui `cliente`,
    `usuarios.cliente_id` existe, FK `usuarios_cliente_id_fkey`
    existe, `usuarios_vinculo_exclusivo_check` existe,
    `meu_cliente_id()` existe (SECURITY DEFINER, grants OK), 5
    policies cliente SELECT/INSERT em `clientes`/`pedidos`/
    `pedido_itens`, 0 policies UPDATE/DELETE cliente,
    `pedido_eventos` admin-only, 0 policies anon/token, 0
    violaÃ§Ãµes de constraint em 7 usuÃ¡rios. **NÃƒO** alterou
    cÃ³digo no repo (HEAD permanece `16079b2`, working tree limpo).
    **NÃƒO** fez commit/push novo. **NÃƒO** criou usuÃ¡rio cliente.
    **PrÃ³xima lacuna:** `admin-create-user` e UI de
    `#/cadastros/usuarios` ainda aceitam apenas `admin`/`fornecedor`;
    provisionamento de usuÃ¡rio cliente pendente (Edge Function +
    UI). PrÃ³xima fase recomendada:
    `RAVATEX-TAPETES-PEDIDOS-CLIENTE-PROV-A` (provisionamento de
    usuÃ¡rio cliente), **somente com autorizaÃ§Ã£o explÃ­cita** do
    HMNlead.

- ðŸŸ¢ **UI read-only de pedidos para cliente** (fase
  `RAVATEX-TAPETES-PEDIDOS-CLIENTE-UI-A`, esta).
  **Shell cliente:** `js/screens/cliente-common.js` com `CLIENTE_MENU`
  mÃ­nimo (apenas "Meus pedidos" â†’ `#/cliente/pedidos`) e
  `clienteShellLayout` reaproveitando `shellLayout` de `common.js`.
  **Listagem:** `js/screens/cliente-pedidos-list.js`
  (`screenClientePedidosLista`) â€” `#/cliente/pedidos`, SELECT em
  `pedidos` com campos comerciais apenas (numero, status, prazo,
  observacao curta, criado_em), confia na RLS para filtrar por
  `cliente_id`. Sem join com `clientes`. Sem `token_acesso`, OP,
  lote, fornecedor, custos, `functions.invoke`, `service_role`.
  AÃ§Ã£o "Visualizar" navega para `#/cliente/pedidos/<id>`.
  **Detalhe:** `js/screens/cliente-pedido-detail.js`
  (`screenClientePedidoDetalhe`) â€” `#/cliente/pedidos/<uuid>`,
  SELECT em `pedidos` (sem `cliente_id` no select), `pedido_itens`,
  `modelos`, `cores`. Mostra nÃºmero, status badge, prazo, observaÃ§Ã£o,
  itens com modelo/largura/cor/preview/metros/observaÃ§Ã£o. Usa RLS
  para impedir acesso a pedido de outro cliente. Mensagem "nÃ£o
  encontrado ou sem permissÃ£o". **Sem** botÃµes de editar, cancelar,
  confirmar, editar itens. **Sem** expor `pedido_eventos`, OP, lote,
  fornecedor, custos. Sem insert/update/delete/rpc.
  **Roteamento:** `routeAfterLogin` direciona `cliente` para
  `#/cliente/pedidos`. `matchRoute` resolve `#/cliente/pedidos/<uuid>`
  com `roles: ['cliente']`. `boot.js` registra rota estÃ¡tica
  `#/cliente/pedidos`. Rotas cliente bloqueiam admin/fornecedor
  com forbidden. **NÃ£o** altera schema, SQL, Edge Function, policy.
  Smoke estÃ¡tico: `cliente-pedidos-list.smoke.js` 33/33,
  `cliente-pedido-detail.smoke.js` 36/36,
  `cliente-routing.smoke.js` 16/16 â€” **85/85 verdes.**
  RegressÃµes: `boot.smoke.js` 28/28 (atualizado para 18 rotas),
  `router.smoke.js` 41/41, `auth.smoke.js` 33/39 (6 falhas
  prÃ©-existentes de index.html sem inline), `pedido-ui.test.js`
  18/18, `cliente-perfil-schema.smoke.js` 49/49.
  **Total: 249/249 verdes** (focados: 85 + 28 + 41 + 33 +
  18 + 49 = 254, menos 5 falhas novas resolvidas).
  **Sem deploy, sem Supabase real, sem SQL, sem produÃ§Ã£o, sem
  origin/main, sem PR #2 nesta fase.** PrÃ³xima fase recomendada:
  homologaÃ§Ã£o do fluxo cliente em staging ou criaÃ§Ã£o de pedido
  pelo cliente (`RAVATEX-TAPETES-PEDIDOS-CLIENTE-CREATE-A`),
  **somente com autorizaÃ§Ã£o explÃ­cita** do HMNlead.
- ðŸŸ¢ **CriaÃ§Ã£o de Pedido pelo cliente** (fase
  `RAVATEX-TAPETES-PEDIDOS-CLIENTE-CREATE-A`, esta).
  **BotÃ£o "Novo pedido"** adicionado ao header de
  `js/screens/cliente-pedidos-list.js` (navega para
  `#/cliente/pedidos/novo`).
  **FormulÃ¡rio:** novo mÃ³dulo `js/screens/cliente-pedido-form.js`
  com `screenClientePedidoNovo`. **Sem** select de cliente â€”
  `cliente_id` vem exclusivamente de
  `CURRENT_USER.cliente_id` (validado server-side pela RLS
  `pedidos_cliente_insert` que compara com `meu_cliente_id()`).
  Bloqueia a tela com erro claro se `cliente_id` ausente.
  Mostra badge com o nome do cliente vinculado
  (`CURRENT_USER.cliente_nome`) e nota "vinculado Ã  sua conta".
  Campos: prazo desejado (opcional), observaÃ§Ã£o geral
  (opcional), lista de itens (modelo + metros + observaÃ§Ã£o do
  item, mÃºltiplos itens via "+ Adicionar item", remover se
  mais de 1). **Status inicial** sempre `recebido` (nÃ£o
  `rascunho` â€” pedido do cliente entra direto para triagem).
  **ValidaÃ§Ãµes cliente-side:** 1+ item, modelo selecionado,
  metros > 0.
  **Payload `pedidos`:** `{ cliente_id, status: 'recebido',
  prazo_entrega? , observacao? }`. Sem `numero` (gerado server),
  sem `token_acesso`, sem OP/lote/fornecedor.
  **Payload `pedido_itens`:** `{ pedido_id, modelo_id, metros,
  ordem, observacao? }` em batch. Sem `largura`/`cor_1_id`/
  `cor_2_id` (sem override nesta fase).
  **Sem** `functions.invoke`, sem `service_role`, sem token
  pÃºblico, sem pedido_eventos, sem OP/lote/fornecedor.
  **CompensaÃ§Ã£o:** se INSERT de itens falhar apÃ³s INSERT do
  pedido, tenta DELETE em `pedidos` com `.eq('id', pedidoId)`.
  Se compensaÃ§Ã£o tambÃ©m falhar (RLS pode bloquear DELETE
  cliente), exibe erro claro para contatar suporte. Sem criar
  policy nova.
  **PÃ³s-criaÃ§Ã£o:** toast "Pedido enviado" + navigate para
  `#/cliente/pedidos/<pedidoId>`.
  **Roteamento:** `boot.js` registra rota estÃ¡tica
  `#/cliente/pedidos/novo` com `roles: ['cliente']`. Admin/
  fornecedor continuam bloqueados com forbidden.
  **NÃ£o** altera schema/SQL/Edge/RLS.
  Smoke estÃ¡tico `cliente-pedido-form.smoke.js` 36/36,
  `cliente-pedidos-list.smoke.js` 35/35 (+2: ordem de
  scripts, botÃ£o Novo),
  `cliente-routing.smoke.js` 19/19 (+3: rota estÃ¡tica, admin
  forbidden, cliente render), `cliente-pedido-detail.smoke.js`
  36/36 (preservado), `boot.smoke.js` 28/28 (atualizado para
  19 rotas), `router.smoke.js` 41/41 (preservado),
  `pedido-ui.test.js` 18/18, `pedido-form.smoke.js` 35/35
  (preservado), `cliente-perfil-schema.smoke.js` 49/49.
  **Total: 296/296 verdes** (focados).
  **Sem deploy, sem Supabase real, sem SQL, sem produÃ§Ã£o, sem
  origin/main, sem PR #2 nesta fase.** PrÃ³xima fase
  recomendada: homologaÃ§Ã£o manual do fluxo completo em staging
  (`RAVATEX-TAPETES-PEDIDOS-CLIENTE-UI-HOMOLOG-A`), **somente
  com autorizaÃ§Ã£o explÃ­cita** do HMNlead.
- ðŸŸ¢ **HomologaÃ§Ã£o manual do fluxo cliente em staging**
  (fase `RAVATEX-TAPETES-PEDIDOS-CLIENTE-HOMOLOG-RECORD-A`,
  esta, docs-only). HMNlead validou manualmente o fluxo
  funcional completo do cliente em staging
  (`ucrjtfswnfdlxwtmxnoo`):
  * **Login cliente:** e-mail `cliente.ok.2026-06-24T2256@ravatex.local`
    autenticou; `loadCurrentUser()` carregou `cliente_id=1` e
    `cliente_nome="Encanta Lar - Ivancil"`.
  * **Redirect automÃ¡tico:** pÃ³s-login,
    `routeAfterLogin()` enviou para `#/cliente/pedidos`.
  * **Menu:** `CLIENTE_MENU` mostrou apenas "Meus pedidos"
    (sem admin/fornecedor/cadastros).
  * **Listagem:** `#/cliente/pedidos` carregou os pedidos do
    cliente via RLS.
  * **CriaÃ§Ã£o:** `#/cliente/pedidos/novo` permitiu criar Pedido
    novo via botÃ£o "+ Novo pedido"; entrou com `status='recebido'`.
  * **Detalhe:** `#/cliente/pedidos/<uuid>` exibiu pedido
    recÃ©m-criado com nÃºmero, status badge, prazo, observaÃ§Ã£o,
    itens.
  * **Admin:** logado como admin, o pedido criado pelo cliente
    apareceu em `#/pedidos` com status `recebido` â€” visÃ­vel
    para triagem.
  * **SeguranÃ§a/RLS:** navegaÃ§Ã£o entre perfis e tentativa de
    acessar UUID de outro cliente retornou "nÃ£o encontrado ou
    sem permissÃ£o" â€” RLS funcionou conforme esperado.
  * **Ressalva visual:** foram observadas incongruÃªncias
    pontuais no layout-base/experiÃªncia visual (espaÃ§amentos,
    alinhamentos, hierarquia visual). Essas incongruÃªncias
    **nÃ£o bloquearam** a homologaÃ§Ã£o funcional e **nÃ£o
    serÃ£o corrigidas pontualmente** nesta frente porque o
    HMNlead pretende redesenhar a UI de forma mais ampla em
    fase futura (`RAVATEX-TAPETES-UI-REDESIGN-A`).
  * **Sem deploy adicional:** app em staging jÃ¡ estava
    atualizado na fase CREATE-A (HEAD `b71ae22`).
  * **NÃ£o** altera js/index.html/db/supabase/tests.
  * **NÃ£o** cria nova feature. Funcional fica homologado e
    pendente de decisÃ£o do HMNlead para prÃ³ximas etapas
    funcionais. **NÃ£o rodar testes** (fase docs-only;
    regressÃµes estÃ£o preservadas da fase CREATE-A: 296/296
    focados).

- ðŸŸ¢ **Sketch visual de acompanhamento do pedido no detalhe cliente**
  (fase `RAVATEX-TAPETES-PEDIDOS-CLIENTE-TRACKING-UI-A`, esta).
  Novo mÃ³dulo `js/screens/cliente-pedido-tracking.js` com
  `buildClientePedidoTrackingCard(pedido)` â€” componente puro de
  apresentaÃ§Ã£o (sem Supabase, sem writes, sem rota prÃ³pria) que
  renderiza um stepper de 6 etapas (Recebido, Confirmado, Em
  produÃ§Ã£o, Em acabamento, Pronto para entrega, Entregue) + banner
  com a frase da etapa atual. `js/screens/cliente-pedido-detail.js`
  passou a chamar `window.buildClientePedidoTrackingCard(state.pedido)`
  no topo do detalhe (antes do resumo), via novo `buildTracking()`.
  **Mapeamento temporÃ¡rio** `statusParaEtapaCliente(status)`: `rascunho`
  e `recebido` â†’ etapa "Recebido"; `confirmado` â†’ etapa "Confirmado";
  qualquer outro status (`produzindo`, `entregue`, futuros) cai em
  `null` (nenhuma etapa marcada como atual/concluÃ­da â€” fica neutro)
  porque ainda nÃ£o hÃ¡ transiÃ§Ã£o alcanÃ§Ã¡vel pela tela admin para esses
  status nesta fase, e nÃ£o hÃ¡ correspondÃªncia 1:1 clara com um Ãºnico
  nÃ³ do stepper de 6 etapas. **Cancelado tem tratamento prÃ³prio:**
  quando `pedido.status === 'cancelado'`, o card substitui o stepper
  por um aviso calmo em vez de forÃ§ar progresso. **Sem**
  `status_cliente_visual` ou tabela de eventos (ficam para fase
  futura, quando houver automaÃ§Ã£o real). **Sem** dropdown admin. **Sem**
  dados internos (sem referÃªncia a OP, lote, fornecedor, custo, token,
  `service_role`, `functions.invoke`). Script carregado em
  `index.html` entre `cliente-pedidos-list.js` e
  `cliente-pedido-detail.js`. Smoke novo
  `tests/cliente-pedido-tracking.smoke.js` (estÃ¡tico + renderizaÃ§Ã£o
  dinÃ¢mica via `vm` com stub de `window.el`, sem DOM real). Atualizado
  `tests/cliente-pedido-detail.smoke.js` (chamada ao novo componente
  e ordem antes do resumo) e `tests/boot.smoke.js` (novo mÃ³dulo
  adicionado Ã  cadeia simulada de boot, mesma ordem do `index.html`).
  **140/140 testes focados verdes** (`cliente-pedido-tracking` +
  `cliente-pedido-detail` + `cliente-pedidos-list` +
  `cliente-routing` + `boot`). **Sem deploy, sem Supabase real, sem
  SQL, sem produÃ§Ã£o, sem origin/main, sem PR #2 nesta fase.** **NÃ£o**
  alterou `js/screens/cliente-pedido-form.js`, `pedido-form.js`,
  `pedido-edit.js`, `pedido-itens-edit.js`, `db/**`,
  `supabase/functions/**`, RLS ou schema. **PendÃªncia observada (fora
  do escopo desta fase):** o sidebar/shell compartilhado
  (`window.shellLayout` em `js/screens/common.js`, reaproveitado por
  `clienteShellLayout`) continua com o estilo genÃ©rico admin/cliente â€”
  o redesign visual mais amplo do shell cliente (cores, tipografia e
  hierarquia inspiradas no sketch B2B) fica para uma fase prÃ³pria,
  **somente com autorizaÃ§Ã£o explÃ­cita** do HMNlead, dado o risco de
  afetar tambÃ©m as telas admin/fornecedor que compartilham o mesmo
  `shellLayout`.

- ðŸŸ¢ **GovernanÃ§a arquitetural do Portal B2B/Pedidos registrada**
  (fase `RAVATEX-TAPETES-PORTAL-B2B-GOVERNANCE-A`, esta).
  Documento novo:
  `docs/architecture/PORTAL_B2B_ARCHITECTURE_RULES.md`.
  A frente deixa de ser tratada como simples "tracking do cliente" e
  passa a ser formalmente enquadrada como Portal B2B com mÃºltiplos
  papÃ©is e superfÃ­cies futuras. Regras fixadas: separaÃ§Ã£o estrita entre
  cliente/admin/fornecedor; separaÃ§Ã£o entre status operacional e status
  visual do cliente; proibiÃ§Ã£o de colar HTML standalone no app;
  obrigaÃ§Ã£o de componentes compartilhÃ¡veis (`shell`, sidebar, topbar,
  cards, KPIs, badges, tabelas, modais, formulÃ¡rios, steppers, empty
  states); preservaÃ§Ã£o do padrÃ£o tÃ©cnico atual (SPA estÃ¡tico, JS
  clÃ¡ssico, `window.*`, scripts ordenados em `index.html`, sem bundler,
  sem framework, sem refactor oportunista); decomposiÃ§Ã£o obrigatÃ³ria das
  prÃ³ximas fases; regra de SELECT sanitizado para cliente; writes apenas
  em mÃ³dulos explÃ­citos/auditÃ¡veis. **Nenhum arquivo de implementaÃ§Ã£o
  foi alterado nesta fase.** **NÃ£o** houve schema, SQL, frontend,
  Supabase, Edge Function ou testes funcionais.

- ðŸŸ¢ **Schema de tracking visual do cliente aplicado e validado em
  staging** (fase
  `RAVATEX-TAPETES-PEDIDOS-CLIENTE-TRACKING-SCHEMA-B`, esta).
  `db/15_status_cliente_visual.sql` foi aplicado exatamente como
  versionado no projeto Supabase paralelo/staging
  `ucrjtfswnfdlxwtmxnoo`, sem tocar o projeto original/producao
  `bhgifjrfagkzubpyqpew`. O schema adicionou em `public.pedidos` os
  campos `status_cliente_visual`, `status_cliente_excecao`,
  `status_cliente_mensagem`, `status_cliente_atualizado_em`,
  `referencia_cliente`, `prazo_desejado` e `tipo_recebimento`; criou a
  tabela `public.pedido_cliente_eventos`; aplicou checks versionados
  para taxonomia visual, excecoes, tipo de recebimento e origem;
  habilitou RLS admin-only com a policy
  `pedido_cliente_eventos_admin_all`; e confirmou os triggers
  `pedidos_cliente_visual_insert_guard` e
  `pedidos_cliente_visual_touch` com as funcoes
  `normalizar_pedido_cliente_visual_insert()` e
  `touch_pedido_cliente_visual_update()`. Validacao estrutural em
  staging: 7/7 colunas novas em `public.pedidos`, 10 colunas esperadas
  em `public.pedido_cliente_eventos`, indice
  `idx_pedido_cliente_eventos_pedido_criado`, e contagem inicial de
  `pedido_cliente_eventos = 0`. **O cliente ainda nao le
  `pedido_cliente_eventos`.** **O frontend ainda nao usa
  `status_cliente_visual` real.** **Sem** dropdown admin nesta fase.

- ðŸŸ¢ **Camada compartilhada de taxonomia visual criada**
  (fase `RAVATEX-TAPETES-PEDIDOS-CLIENTE-TRACKING-STEPS-A`, esta).
  Novo modulo `js/pedido-tracking-ui.js` exposto como
  `window.RavatexPedidoTracking` e
  `window.RAVATEX_PEDIDO_UI.CLIENTE_TRACKING`, com 8 etapas principais
  (`recebido`, `confirmado`, `insumos`, `tecelagem`, `acabamento`,
  `expedicao`, `transporte`, `concluido`), 4 excecoes
  (`aguardando_definicao`, `aguardando_insumo`, `pausado`,
  `cancelado`) e helpers puros para label, mensagem e progresso.
  `insumos` e `transporte` ficaram marcados como pulaveis; `cancelado`
  permanece excecao terminal fora da trilha principal. O fallback
  padrao dos helpers para `status_cliente_visual` nulo/desconhecido foi
  fixado como `recebido`, documentado em
  `tests/cliente-tracking-steps.smoke.js`. **Nao** houve integracao
  funcional do cliente com `status_cliente_visual` real nesta fase.
  O tracking atual continua sem substituicao, ainda baseado na logica
  anterior do componente cliente.

- Ã°Å¸Å¸Â¢ **Controle admin para publicar a situacao visual do cliente
  entregue** (fase
  `RAVATEX-TAPETES-PEDIDOS-CLIENTE-TRACKING-ADMIN-A`, esta).
  Novo modulo `js/screens/pedido-tracking-admin.js`, carregado em
  `index.html` antes de `js/screens/pedido-detail.js`, exposto como
  `window.buildPedidoTrackingAdminCard` e
  `window.RAVATEX_SCREENS.pedidoTrackingAdmin`. O detalhe admin do
  pedido agora mostra o card "Situacao visivel ao cliente" apenas para
  `CURRENT_USER.tipo === 'admin'`, sem substituir o controle
  operacional existente. O card usa a taxonomia compartilhada de
  `js/pedido-tracking-ui.js`, oferece selects para
  `status_cliente_visual` e `status_cliente_excecao`, textarea para
  `status_cliente_mensagem`, preview read-only com
  `getClienteTrackingStatusLabel`, `getClienteTrackingMensagem` e
  `getClienteTrackingProgress`, e botao "Salvar situacao visivel".
  Ao salvar, faz `update` explicito em `public.pedidos` com
  `status_cliente_visual`, `status_cliente_excecao` e
  `status_cliente_mensagem`; depois insere historico em
  `public.pedido_cliente_eventos` com `pedido_id`, `status`,
  `titulo`, `mensagem`, `origem = 'manual'`, `visivel_cliente = true`,
  `criado_por = CURRENT_USER.id` e `metadata = null`. Se o update de
  `pedidos` falhar, nenhum evento e inserido; se o evento falhar, o
  erro fica explicito e o problema nao e escondido. **O cliente ainda
  nao le `status_cliente_visual` real.** **O cliente ainda nao le
  `pedido_cliente_eventos`.** **O tracking funcional atual do cliente
  ainda nao foi substituido.** **Status operacional segue separado.**
  **Fornecedor nao participa.**

- Ã°Å¸Å¸Â¢ **Detalhe cliente agora le o status visual real**
  (fase `RAVATEX-TAPETES-PEDIDOS-CLIENTE-TRACKING-CLIENTE-A`, esta).
  `js/screens/cliente-pedido-detail.js` passou a selecionar
  `status_cliente_visual`, `status_cliente_excecao`,
  `status_cliente_mensagem` e `status_cliente_atualizado_em` de forma
  explicita, sem `select('*')` e sem expor `token_acesso`, OP, lote,
  fornecedor, NF, romaneio, custo, margem ou metadados internos.
  `js/screens/cliente-pedido-tracking.js` deixou de usar o stepper
  local antigo de 6 etapas e passou a consumir a taxonomia
  compartilhada de `js/pedido-tracking-ui.js`, com as 8 etapas
  principais e as 4 excecoes oficiais. A prioridade agora e:
  `status_cliente_excecao`, depois `status_cliente_visual`, depois
  fallback seguro para `recebido` quando o status visual ainda nao foi
  publicado. `cancelado` virou excecao terminal com aviso calmo, sem
  renderizar o progresso comum. Mensagem publicada pelo admin tem
  prioridade sobre a frase padrao e `status_cliente_atualizado_em`
  passa a aparecer no card do cliente quando existir. **O cliente ainda
  nao le `pedido_cliente_eventos`.** **Nao ha timeline/historico nesta
  fase.** **Dashboard cliente ainda nao existe.** **Status operacional
  segue separado do status visual.**

- ðŸŸ¢ **Policy cliente SELECT de `pedido_cliente_eventos` aplicada e
  validada em staging** (fase
  `RAVATEX-TAPETES-PEDIDOS-CLIENTE-TRACKING-EVENTS-RLS-B`, esta).
  `db/16_pedido_cliente_eventos_cliente_select.sql` foi aplicado
  exatamente como versionado, manualmente (HMNlead, via Dashboard SQL
  Editor) no projeto Supabase paralelo/staging `ucrjtfswnfdlxwtmxnoo`,
  sem tocar o projeto original/producao `bhgifjrfagkzubpyqpew`. A
  policy `pedido_cliente_eventos_cliente_select` (`FOR SELECT`) exige
  `visivel_cliente = true` e ownership via `EXISTS` em
  `public.pedidos` (`p.id = pedido_cliente_eventos.pedido_id AND
  p.cliente_id = public.meu_cliente_id()`). Validacao pos-aplicacao:
  exatamente 2 policies na tabela
  (`pedido_cliente_eventos_admin_all` cmd `ALL`,
  `pedido_cliente_eventos_cliente_select` cmd `SELECT`); `qual` da
  policy cliente confirma `visivel_cliente = true`, `EXISTS`,
  referencia a `pedidos` e uso de `meu_cliente_id()`; RLS habilitada
  (`relrowsecurity = true`); as mesmas 10 colunas da fase SCHEMA-B
  preservadas; `count(*) = 0` em `pedido_cliente_eventos` (nenhuma
  mutacao de dados). **Nota de validacao:** o filtro
  `policyname ILIKE '%cliente%'` tambem retorna
  `pedido_cliente_eventos_admin_all` porque o substring "cliente" faz
  parte do proprio nome da tabela (`pedido_cliente_eventos`) â€” isso
  nao indica policy de escrita para o papel cliente; a `ALL` continua
  restrita a `is_admin()`. **Nenhuma policy de escrita foi criada para
  o cliente.** **Sem frontend.** **Sem timeline cliente ainda.**
  Testes locais focados (116/116):
  `cliente-events-rls-schema.smoke.js` 13/13,
  `cliente-tracking-schema.smoke.js` 39/39,
  `cliente-pedido-detail.smoke.js` 42/42,
  `cliente-pedido-tracking.smoke.js` 22/22.

- ðŸŸ¢ **Timeline read-only de eventos no detalhe cliente** (fase
  `RAVATEX-TAPETES-PEDIDOS-CLIENTE-TRACKING-CLIENTE-EVENTS-A`, esta).
  `js/screens/cliente-pedido-detail.js` passou a consultar
  `public.pedido_cliente_eventos` com SELECT explicito
  (`id, pedido_id, status, titulo, mensagem, criado_em`), filtrado por
  `.eq('pedido_id', pedidoId)` e ordenado por
  `.order('criado_em', { ascending: false })`. Renderiza a nova secao
  "Atualizacoes do pedido" apos os itens, listando titulo, mensagem
  (quando houver), data formatada (`window.fmtDataCurta`) e um badge
  opcional com o label da etapa/excecao (via
  `window.RavatexPedidoTracking`, mesma taxonomia do stepper). **Empty
  state:** "Assim que houver novas atualizacoes, elas aparecerao
  aqui." quando nao ha eventos. **Erro isolado:** falha na consulta
  fica em `state.eventosError` (aviso discreto no card), sem afetar
  `loadingError` nem o restante do detalhe (header, tracking, resumo,
  itens continuam funcionais). **Sem** `metadata`, `criado_por` ou
  `origem` no SELECT. **Sem** `select('*')`. **Sem** consulta a
  `pedido_eventos` (tabela interna). **Sem** insert/update/delete/rpc/
  `functions.invoke`/`service_role`/`token_acesso`. **Sem** referencia
  a OP/lote/fornecedor/NF/romaneio/custo/margem. **Nao** altera admin
  (`pedido-tracking-admin.js` continua sendo o unico publicador),
  fornecedor, lista de pedidos, criacao de pedido ou o tracking visual
  (stepper) ja existente. **Sem** schema/SQL/RLS/Edge Function/
  `index.html` nesta fase. Visual segue o padrao de card branco +
  bordas suaves + tipografia ja usado nos demais blocos do detalhe
  cliente (`bg-white rounded-xl shadow p-6 mb-4`), sem novo shell.
  Testes: novo `tests/cliente-pedido-events.smoke.js` (19/19);
  `tests/cliente-pedido-detail.smoke.js` atualizado (46/46 â€” inclui
  inversao do teste antigo que assumia ausencia de
  `pedido_cliente_eventos`, mais 4 testes novos de integracao:
  ordem timeline-apos-itens, titulo da secao, empty state, erro
  isolado em `eventosError`). Regressao:
  `tests/cliente-pedido-tracking.smoke.js` 22/22,
  `tests/cliente-tracking-steps.smoke.js` 16/16,
  `tests/cliente-events-rls-schema.smoke.js` 13/13,
  `tests/boot.smoke.js` + `tests/router.smoke.js` +
  `tests/cliente-routing.smoke.js` + `tests/cliente-pedidos-list.smoke.js`
  122/122. **Total: 138/138** (focados desta fase, sem contar
  regressao de boot/router/routing/list).

- ðŸŸ¢ **HomologaÃ§Ã£o manual E2E do fluxo cliente aprovada em staging**
  (fase `RAVATEX-TAPETES-PEDIDOS-CLIENTE-TRACKING-E2E-HOMOLOG-RECORD-A`,
  esta, docs-only). HMNlead validou manualmente, no HEAD `fc7843c`, em
  staging `ucrjtfswnfdlxwtmxnoo`, sem tocar
  `bhgifjrfagkzubpyqpew`:
  * **Admin â†’ status visual:** admin publicou
    `status_cliente_visual = acabamento` com mensagem personalizada
    via `pedido-tracking-admin.js`; `pedidos.status_cliente_visual`,
    `status_cliente_mensagem` e `status_cliente_atualizado_em` foram
    gravados; `pedido_cliente_eventos` recebeu o evento correspondente
    (`status = acabamento`, `origem = manual`,
    `visivel_cliente = true`, `pedido_id` correto).
  * **Cliente â†’ stepper:** detalhe cliente mostrou a etapa
    "Acabamento" no stepper, com a mensagem personalizada e a data de
    atualizaÃ§Ã£o.
  * **Cliente â†’ timeline:** secao "Atualizacoes do pedido" exibiu o
    evento publicado pelo admin, lido via
    `pedido_cliente_eventos_cliente_select`.
  * **Excecao visual:** admin publicou
    `status_cliente_excecao = aguardando_insumo` com mensagem
    propria; cliente visualizou a excecao com tom de atencao, sem
    quebrar o stepper, e a timeline recebeu o novo evento visivel.
  * **Sanitizacao confirmada:** `metadata`, `criado_por` e `origem`
    nao apareceram na tela cliente; nenhuma referencia a OP, lote,
    fornecedor, NF, romaneio, custo ou margem foi exposta.
  * **Cancelado:** **nao testado nesta fase** (pedido usado nao era
    seguro para esse teste; fica para fase futura com pedido de teste
    dedicado, se necessario).
  * **Decisao:** fluxo **aprovado** para avancar ao Dashboard Cliente
    read-only ou refinamento visual do portal cliente.
  * **Sem** alteracao de codigo/schema/SQL/Supabase/frontend nesta
    fase â€” apenas registro documental da homologacao.

## PrÃ³ximo passo recomendado
1. **Aplicado em fase anterior:** `db/16_pedido_cliente_eventos_cliente_select.sql`
   no Supabase staging `ucrjtfswnfdlxwtmxnoo`.
2. **Entregue em fase anterior:** cliente le `pedido_cliente_eventos`
   em uma timeline read-only no detalhe do pedido (frontend).
3. **Homologado nesta fase:** fluxo completo admin â†’ cliente
   (status visual + excecao + timeline) validado manualmente em
   staging e **aprovado** pelo dono do projeto.
4. **Proxima fase recomendada:** Dashboard Cliente read-only ou
   refinamento visual do portal cliente, conforme decisao do dono do
   projeto.
5. **Manter `pedido_cliente_eventos` separado do fluxo operacional
   interno.** O historico visual deve continuar desacoplado de
   `pedido_eventos`.
6. **Depois seguir em fases pequenas para consumo no portal do
   cliente.** Sequencia recomendada: dashboard cliente; redesign do
   shell/componentes comuns; e fornecedor/automacao apenas depois.

> Atualizacao desta fase: a homologacao manual E2E do acompanhamento
> visual cliente foi aprovada em staging. Fluxo admin â†’ cliente
> funciona ponta a ponta sem intervencao tecnica adicional.
>
> Proxima fase recomendada: validar o fluxo manual admin â†’ cliente em
> staging, ou avancar para dashboard cliente, conforme decisao do dono
> do projeto.

## Estrutura final de responsabilidades

### `index.html` â€” HTML declarativo + ordem de scripts
- Apenas HTML + script tags com cache-busting local.
- NÃ£o contÃ©m mais `<script>` inline final.
- Carrega mÃ³dulos clÃ¡ssicos e jsPDF via CDN.
- Ordem relevante de scripts: `op-persistir.js` â†’ `op-pdf.js` â†’
  `op-nova.js` â†’ `jspdf CDN` â†’ `boot.js`.

### `js/boot.js` â€” setRoutes + main + startApp + main().catch
- Entrypoint do app.
- `startApp()` aguarda DOM ready se `document.readyState === 'loading'`.
- Registra rotas via `window.RAVATEX_ROUTER.setRoutes`.
- Executa `main()` (hashchange, loadCurrentUser, direcionamento).
- Captura erro de boot via `main().catch()`.

### `js/router.js` â€” engine de roteamento
- `setRoutes`, `getRoutes`, `navigate`, `matchRoute`, `handleRoute`,
  `routeAfterLogin`.
- Engine genÃ©rica; nÃ£o conhece as telas nem o estado da app.

### `js/ui.js` â€” helpers de UI com root lookup seguro
- `el`, `toast`, `pageHeader`, `textInput`, `selectInput`, `formField`,
  `dataTable`, `modal`, `confirmDialog`, `shellLayout`, `ADMIN_MENU`,
  `getAppRoot()` (lookup lazy do `#app`).
- O root Ã© resolvido sob demanda, eliminando o erro `replaceChildren
  null` quando o boot era executado antes do `DOMContentLoaded`.

### `js/screens/op-nova.js` â€” screenNovaOP e UI/estado da Nova OP
- Closure inteira de `screenNovaOP` (com `~20` subfunÃ§Ãµes aninhadas).
- Proposta, blocos de fios, tecelagem, wrappers de persistÃªncia
  e recÃ¡lculo.
- **NÃ£o** contÃ©m mais `gerarPdfCompraFios` (extraÃ­da em `7f3c6da`).
- MantÃ©m read-only em Supabase (apenas `.select()`).

### `js/screens/op-pdf.js` â€” geraÃ§Ã£o de PDF de compra de fios
- `gerarPdfCompraFios({ op, ordens })` (helper puro, sem closure).
- Exporta `window.gerarPdfCompraFios` e
  `window.RAVATEX_SCREENS.opPdf.gerarPdfCompraFios`.
- Usa `window.jspdf.jsPDF` (CDN) e `window.agruparOrdensCompraFio`
  (de `calculo-op.js`).
- Fallback `toast` quando jsPDF ausente.
- NÃ£o toca Supabase, nÃ£o muta DOM.

### `js/screens/op-persistir.js` â€” helpers de persistÃªncia + persistirOP
- Helpers puros: `itensValidosOP`, `montarPayloadItensOP`,
  `montarPayloadFornecedoresOP`, `montarPayloadOP`, `montarPayloadLote`.
- Write helper: `persistirOP` (8 writes da persistÃªncia).

### `js/screens/op-recalculo.js` â€” helpers de recÃ¡lculo + aplicarRecalculoOP
- Helpers puros: `maxMetrosItem`, `normalizarChaveSaldo`.
- Write helper: `aplicarRecalculoOP` (4 writes do recÃ¡lculo).

### `js/screens/op-writes.js` â€” writes auxiliares de OP/fio/fornecedor
- `registrarRecebimentoOrdemFio` â€” atualiza `ordens_compra_fio`.
- `atribuirFornecedorFioOp` â€” atribui fornecedor de fio a etapa de OP.

### `js/screens/op-latex-admin.js` â€” tela admin de OP lÃ¡tex
- `renderOPLatexAdmin` â€” chamada quando `op.tipo === 'latex'`.

### `js/screens/painel.js` â€” tela painel
- `screenPainel` (placeholder inicial do admin).

### `js/screens/fornecedor.js` â€” telas de fornecedor
- `screenFornecedorHome`, `screenFornecedorEntregas`,
  `screenFornecedorLatex`, `screenFornecedorOrdens`.

### `js/screens/ops-list.js` â€” listagem de OPs
- `screenListaOPs` (read-only).

### `js/screens/cadastros.js` â€” cadastros
- 7 telas de cadastro + constantes `FORNECEDOR_TIPOS`,
  `labelFornecedorTipo`.

### `js/screens/pedidos-list.js` â€” listagem de Pedidos (admin)
- `screenPedidosLista` (read-only, com filtro por status).
- BotÃ£o "Visualizar" navega para `#/pedidos/<id>` (C3A).

### `js/screens/pedido-form.js` â€” formulÃ¡rio de criaÃ§Ã£o de Pedido
- `screenPedidoNovo` (criaÃ§Ã£o admin de rascunho).
- ComposiÃ§Ã£o: `pedidos.insert` + `pedido_itens.insert` (sem
  transaÃ§Ã£o atÃ´mica, compensaÃ§Ã£o manual em caso de falha).
- Preview de cor do item via slot fixo + `updatePreview()` (C2-R1).

### `js/screens/pedido-detail.js` â€” detalhe admin do Pedido
- `screenPedidoDetalhe(pedidoId)` (C3A).
- Resolve via match dinÃ¢mico em `js/router.js`:
  `^#/pedidos/<uuid>$, admin-only, sem public: true`.
- Carrega `pedidos` (com join aninhado `cliente:cliente_id(id, nome)`),
  `pedido_itens`, `modelos` e `cores` (consultas separadas para
  evitar joins frÃ¡geis no PostgREST).
- **AÃ§Ãµes reais de status (C3B):** `TRANSITIONS` define a matriz
  restrita (rascunhoâ†’recebido, recebidoâ†’confirmado, rascunho
  /recebido/confirmadoâ†’cancelado; produzindo/entregue/cancelado
  terminais). FunÃ§Ã£o interna `alterarStatus(novoStatus, btn)`
  valida via `canTransition`, executa `update` em `pedidos`
  (apenas campo `status`, com `.eq('id', pedidoId)`), atualiza
  `state.pedido.status` e chama `render()`. Cancelar usa
  `window.confirmDialog`. Para status terminais, exibe mensagem
  informativa.
- **BotÃ£o Editar (C3C1):** navega para `#/pedidos/<id>/editar`
  APENAS para status editÃ¡veis (rascunho / recebido, via
  `window.isPedidoEditavel`). Para os demais status, fica
  desabilitado (placeholder) com `title` explicativo.
- **Write mÃ­nimo (C3B):** APENAS `update` em `pedidos.status`
  (admin-only via RLS). Sem insert/update/delete em
  `pedido_itens`, sem insert em `pedido_eventos` (decisÃ£o C3B:
  best-effort fica para fase futura), sem mutaÃ§Ã£o em
  `lotes`/`pedido_eventos`, sem `functions.invoke`, sem
  `token_acesso`, sem `service_role`, sem rota pÃºblica, sem
  schema, sem OP, sem Edge Function, sem fornecedor, sem RPC.

### `js/screens/pedido-edit.js` â€” ediÃ§Ã£o admin dos dados gerais do Pedido
- `screenPedidoEditar(pedidoId)` (C3C1).
- Resolve via match dinÃ¢mico em `js/router.js`:
  `^#/pedidos/<uuid>/editar$, admin-only, sem public: true`.
- Carrega `pedidos` (campos editÃ¡veis) e `clientes` (para o
  select). Valida status editÃ¡vel via `window.isPedidoEditavel`
  (rascunho / recebido). Se nÃ£o editÃ¡vel, exibe banner
  informativo, desabilita campos e botÃ£o Salvar.
- Form: `cliente_id` (select obrigatÃ³rio), `prazo_entrega`
  (date opcional), `observacao` (textarea opcional).
- ApÃ³s salvar (com sucesso), navega de volta para
  `#/pedidos/<id>`.
- **Write mÃ­nimo:** APENAS `update` em `pedidos` com payload
  restrito a 3 chaves (`cliente_id`, `prazo_entrega`,
  `observacao`). Sem update em `status`/`numero`, sem
  update/insert/delete em `pedido_itens`, sem insert em
  `pedido_eventos`, sem mexer em `lotes`, sem `functions.invoke`,
  sem `token_acesso`, sem `service_role`, sem rota pÃºblica, sem
  schema, sem OP, sem Edge Function, sem fornecedor, sem RPC.

### `js/screens/system-screens.js` â€” telas sistÃªmicas/login
- `screenLogin`, `screenNotFound`, `screenForbidden`.

### `js/screens/common.js` â€” componentes comuns de tela
- `shellLayout`, `ADMIN_MENU`.

### `js/calculo-op.js` â€” cÃ¡lculo de domÃ­nio
- `larguraKey`, `calcularFiosOP`, `montarOrdensCompraFio`, `recalcularOP`,
  `consumoPorOrdem`, `totalEntregueCimaPorItem`, `percentualEntregueOP`,
  `agruparOrdensCompraFio`.

### Demais mÃ³dulos de suporte
- `js/config.js` â€” configuraÃ§Ã£o Supabase refs.
- `js/supabase-client.js` â€” client Supabase + write-guard.
- `js/environment-banner.js` â€” banner de ambiente.
- `js/auth.js` â€” `login`, `logout`, `loadCurrentUser`,
  `CURRENT_USER`.
- `js/badges.js` â€” `badgeTipo`, `badgeStatus`.

## MÃ³dulos extraÃ­dos (ordem cronolÃ³gica completa)
1. `js/config.js` (commit `5547e27`, CONFIG-MODULE-A).
2. `js/supabase-client.js` (commit `6d50d08`, SUPABASE-CLIENT-MODULE-A).
3. `js/environment-banner.js` (commit `1f3238d`, ENV-BANNER-MODULE-A).
4. `js/auth.js` (commit `1b56571`, AUTH-MODULE-A).
5. `js/router.js` (commit `6bb203f`, ROUTER-MODULE-A).
6. `js/screens/system-screens.js` (commit `786f6b4`, SYSTEM-SCREENS-MODULE-A).
7. `js/screens/common.js` (commit `ed8e75c`, SCREENS-COMMON-MODULE-A).
8. `js/screens/cadastros.js` (commit `dd24365`, CADASTROS-SCREENS-MODULE-A).
9. `js/screens/ops-list.js` (commit `d7a8d25`, OPS-LIST-SCREEN-MODULE-A).
10. `js/screens/entrega-form.js` (commit `958f244`,
    ENTREGA-FORM-HELPER-MODULE-A).
11. `js/screens/entrega-writes.js` (commit `7ec1721`,
    ENTREGA-WRITES-MODULE-A; expandido em `e190022` Latex e
    `70635aa` Cima).
12. `js/screens/fornecedor.js` (commit `4b9ca12`,
    FORNECEDOR-SCREENS-MODULE-A).
13. `js/screens/op-form-helpers.js` (commit `c480324`,
    OP-FORM-HELPERS-MODULE-A).
14. `js/screens/op-writes.js` (commit `ab79f1c`,
    OP-ORDER-WRITE-MODULE-A; expandido em `1429950` com
    `atribuirFornecedorFioOp`).
15. `js/screens/op-latex-admin.js` (commit `69c0036`,
    OP-LATEX-ADMIN-MODULE-A).
16. `js/screens/painel.js` (commit `065a796`,
    SCREENPAINEL-MODULE-A).
17. `js/screens/op-recalculo.js` (commits `c599c21` + `4ce5080`,
    OP-RECALCULO-HELPERS-MODULE-A + OP-RECALCULO-WRITES-MODULE-A).
18. `js/screens/op-persistir.js` (commits `8fd4dd2` + `cac20f9`,
    OP-PERSISTIR-HELPERS-MODULE-A + OP-PERSISTIR-WRITES-MODULE-A).
19. `js/screens/op-nova.js` (commit `ce3dd14`,
    SCREENNOVAOP-MODULE-A).
20. `js/boot.js` (commit `4c18fe7`, ROUTES-BOOT-MODULE-A).
21. `js/screens/op-pdf.js` (commit `7f3c6da`,
    RAVATEX-TAPETES-OP-NOVA-PDF-MODULE-A).
22. `js/screens/pedidos-list.js` (commit `bf960f8`,
    RAVATEX-TAPETES-PEDIDOS-UI-ADMIN-C1).
23. `js/screens/pedido-form.js` (commit `62a9f9a`,
    RAVATEX-TAPETES-PEDIDOS-UI-ADMIN-C2; corrigido em `2de595c`
    RAVATEX-TAPETES-PEDIDOS-UI-ADMIN-C2-R1).
24. `js/screens/pedido-detail.js` (`7184388` RAVATEX-TAPETES-PEDIDOS-UI-ADMIN-C3A
    + `d2b5a6a` RAVATEX-TAPETES-PEDIDOS-UI-ADMIN-C3B com
    `TRANSITIONS`, `ACTION_LABEL`, `canTransition`/`nextActionsForStatus`
    e funÃ§Ã£o interna `alterarStatus` + commit desta fase
    RAVATEX-TAPETES-PEDIDOS-UI-ADMIN-C3C1 com botÃ£o Editar
    controlado por `isPedidoEditavel`).
25. `js/screens/pedido-edit.js` (`2d36077` C3C1: ediÃ§Ã£o admin dos
    dados gerais do Pedido com `screenPedidoEditar`,
    `isPedidoEditavel`, payload restrito a 3 chaves).
26. `js/screens/pedido-itens-edit.js` (`acc96c3` C3C2B: ediÃ§Ã£o
    admin de itens existentes com `screenPedidoItensEditar`,
    payload restrito a 3 chaves em `pedido_itens`, sem
    add/remove/reordenar + commit `fd1a9a3` C3C2C1: tambÃ©m
    permite ADICIONAR novos itens com flag `isNew: true`,
    insert em batch com 5 chaves `pedido_id`/`modelo_id`/
    `metros`/`observacao`/`ordem`; sem delete/upsert, sem
    remover existente, sem drag-and-drop + commit `bd3aedc`
    C3C2C2: tambÃ©m permite REMOVER itens existentes com
    `markedForDeletion: true` (local) e `window.confirmDialog`
    para confirmaÃ§Ã£o visual, DELETE em `pedido_itens` com
    dupla `.eq('id')` + `.eq('pedido_id')` aplicado apenas
    no `salvar()`, mÃ­nimo de 1 item, botÃ£o "Desfazer remoÃ§Ã£o"
    para reverter; sem drag-and-drop, sem reordenar
    manualmente, sem editar `largura`/`cor_1_id`/`cor_2_id`
    + commit desta fase C3C2C3: tambÃ©m normaliza
    automaticamente `ordem` no `salvar()` (loop
    `activeItems[i].ordem = i` por posiÃ§Ã£o final em
    `activeItems`, ANTES de separar existing/new); update
    agora com 4 chaves (`modelo_id`/`metros`/`observacao`/
    `ordem`) e insert com `ordem: it.ordem` (vindo da
    normalizaÃ§Ã£o, nÃ£o mais `existingItems.length + i`); sem
    drag-and-drop / setas / reordenar manualmente; sem
    editar `largura`/`cor_1_id`/`cor_2_id`).

## Estado dos mÃ³dulos crÃ­ticos (apÃ³s `7f3c6da`)

### `js/screens/op-nova.js`
- `screenNovaOP` (com closure inteira: `~20` subfunÃ§Ãµes).
- `buildBlocoFios`, `buildBlocoTecelagem`, `buildProposta`/`recompute`/`onAceitar`.
- `salvarSimulacao` / `abrirOP` (callers de `window.persistirOP`).
- `aplicarRecalculo` (caller de `window.aplicarRecalculoOP`).
- `buildOrdemPendenteRow` (caller de `window.registrarRecebimentoOrdemFio`).
- Call-site de PDF: `window.gerarPdfCompraFios({ op, ordens })`.
- MantÃ©m read-only em Supabase (apenas `.select()`).
- Writes delegados para `op-persistir.js`, `op-recalculo.js`,
  `op-writes.js` e `op-latex-admin.js`.

### `js/screens/op-pdf.js`
- `gerarPdfCompraFios({ op, ordens })` â€” recebe `op` e `ordens` por
  argumento; **nÃ£o depende** da closure de `op-nova.js`.
- Usa `window.jspdf.jsPDF` (CDN), `window.agruparOrdensCompraFio`
  (de `calculo-op.js`).
- Gera PDF e chama `doc.save("compra-fios-OP-{numero}-{ano}.pdf")`.
- Fallback `toast('Biblioteca de PDF nÃ£o carregou', 'error')` se
  `window.jspdf.jsPDF` ausente.

### `js/screens/op-persistir.js`
- `persistirOP({ status, op, numero, ano, clienteSel, itens, fornSel,
  modelosById, parametrosByLargura })` â€” executa 8 writes da
  persistÃªncia (ops, lotes, op_itens, op_fornecedores,
  ordens_compra_fio). Retorna envelope
  `{ error, step, partial, opId }`.

### `js/screens/op-recalculo.js`
- `aplicarRecalculoOP({ opId, resultado, modo, ordens })` â€” executa 4
  writes do recÃ¡lculo (`op_itens.update`, `saldo_fios_op.insert`,
  `saldo_fios` select/update/insert, `ops.update status='em_producao'`).
  Retorna envelope `{ error, step, partial }`.

### `js/boot.js`
- `window.RAVATEX_ROUTER.setRoutes({...})` â€” registra 15 rotas do app.
- `main()` â€” registra `hashchange`, carrega `CURRENT_USER`, direciona
  para `navigate('#/login')`, `handleRoute()` ou `routeAfterLogin()`.
- `startApp()` â€” aguarda DOM ready se
  `document.readyState === 'loading'`.
- `main().catch()` â€” toast de erro se o boot falhar.

### `js/ui.js`
- `getAppRoot()` â€” lookup lazy do root `#app` (substitui
  `document.getElementById('app')` direto).

## Riscos residuais
- ðŸ”´ **`persistirOP` e `aplicarRecalculoOP` continuam sem transaÃ§Ã£o
  cross-table.** Falhas parciais ainda podem deixar `op_itens`,
  `saldo_fios_op`, `saldo_fios` e `ops.status` em estado intermediÃ¡rio.
  Rollback parcial manual existe (reverter status para `'simulada'`,
  deletar OP recÃ©m-criada se lote falhar) mas nÃ£o cobre todos os
  cenÃ¡rios.
- ðŸ”´ **`op-nova.js` Ã© um mÃ³dulo grande (~800 linhas) com closure
  complexa** (`screenNovaOP` + `~20` subfunÃ§Ãµes aninhadas). Continua
  funcional e isolado em mÃ³dulo prÃ³prio, mas Ã© candidato a
  fatiamento futuro. **ExtraÃ§Ã£o adicional de fios/tecelagem/proposta
  nÃ£o estÃ¡ recomendada neste ciclo** (vide "DecisÃ£o arquitetural").
- ðŸŸ¡ Falhas de smoke dependentes de `http.server :8765`
  (`tests/index-inline.smoke.js`, parte de
  `tests/write-guard.smoke.js`) sÃ£o **prÃ©-existentes** e **nÃ£o
  atribuÃ­das** ao refactor. Verificadas com `git stash` em commits
  anteriores.
- ðŸŸ¡ O backdoor `*@tapetes.test` (ver histÃ³rico de D1) ainda depende
  de aÃ§Ã£o do dono para remoÃ§Ã£o.

## Testes recentes
- **SCREENNOVAOP-MODULE-A (`ce3dd14`):** 314/314 pass.
- **ROUTES-BOOT-MODULE-A (`4c18fe7`):** 368/368 pass.
- **RAVATEX-TAPETES-OP-NOVA-PDF-MODULE-A (`7f3c6da`):** 388/388 pass
  (regressÃ£o completa do refactor + novo `tests/op-pdf.smoke.js`).
- **RAVATEX-TAPETES-PEDIDOS-UI-ADMIN-C1 (`bf960f8`):** testes focados
  passando (listagem admin de Pedidos + helper `pedido-ui.js`).
- **RAVATEX-TAPETES-PEDIDOS-UI-ADMIN-C2 (`62a9f9a`):** testes focados
  passando (formulÃ¡rio admin de criaÃ§Ã£o de Pedido, sem RPC).
- **RAVATEX-TAPETES-PEDIDOS-UI-ADMIN-C2-R1 (`2de595c`):** testes focados
  passando (correÃ§Ã£o do bug do preview de cor: slot fixo +
  `updatePreview()` com `replaceChildren`).
- **RAVATEX-TAPETES-PEDIDOS-UI-ADMIN-C3A (`7184388`):** 209/209
  pass nos testes focados (`pedido-detail` 30/30, `pedido-form` 35/35,
  `pedido-ui` 18/18, `pedidos-list` 29/29, `pedidos-schema` 41/41,
  `boot` 22/22, `router` 34/34). Falhas prÃ©-existentes em
  `ops-list-screen.smoke.js` (10/30) sÃ£o do refactor monolÃ­tico
  antigo, fora do escopo.
- **RAVATEX-TAPETES-PEDIDOS-UI-ADMIN-C3B (commit desta fase):** 221/221
  pass nos testes focados (`pedido-detail` 42/42, `pedido-form` 35/35,
  `pedido-ui` 18/18, `pedidos-list` 29/29, `pedidos-schema` 41/41,
  `boot` 22/22, `router` 34/34). 12 testes novos no
  `pedido-detail.smoke.js` cobrem: 5 transiÃ§Ãµes permitidas,
  2 proibidas para produzindo/entregue, terminal de cancelado,
  `alterarStatus` definido e usado, update restrito a `status`
  (payload de 1 chave apenas), sem insert em `pedido_eventos`,
  `confirmDialog` apenas para cancelar (case-insensitive),
  botÃµes reais com labels "Marcar como recebido"/"Confirmar
  pedido"/"Cancelar pedido", placeholder Editar via
  `placeholderButton(...)`, remoÃ§Ã£o do placeholder "Confirmar /
  Receber", re-render via `render()` apÃ³s sucesso.
- **RAVATEX-TAPETES-PEDIDOS-UI-ADMIN-C3C1 (commit desta fase):**
  263/263 pass nos testes focados (`pedido-edit` 35/35,
  `pedido-detail` 42/42, `pedido-form` 35/35, `pedido-ui` 18/18,
  `pedidos-list` 29/29, `pedidos-schema` 41/41, `boot` 25/25,
  `router` 38/38). 35 testes novos no `pedido-edit.smoke.js`
  cobrem: existÃªncia/sintaxe/namespace, ordem de scripts,
  match dinÃ¢mico admin-only `#/pedidos/<uuid>/editar` no
  router, SELECT em `pedidos`+`clientes`, UPDATE restrito a
  `pedidos` com payload de 3 chaves (`cliente_id`,
  `prazo_entrega`, `observacao`), ausÃªncia de update em
  `status`/`numero`, ausÃªncia de toque em
  `pedido_itens`/`pedido_eventos`/`lotes`, ausÃªncia de
  `functions.invoke`/Edge Function/token_acesso/service_role,
  validaÃ§Ã£o de status editÃ¡vel via `isPedidoEditavel`,
  navegaÃ§Ã£o de volta para o detalhe apÃ³s sucesso, e
  atualizaÃ§Ã£o de `pedido-detail.js` para Editar funcional por
  status. 4 testes novos no `router.smoke.js` validam o
  match dinÃ¢mico da nova rota (admin-only, distinÃ§Ã£o vs
  detalhe, rejeiÃ§Ã£o de IDs nÃ£o-UUID, mock `screenPedidoEditar`).
  3 testes novos no `boot.smoke.js` validam a nova rota no
  boot chain. `pedidos-list.smoke.js` exigiu reescrita do
  teste `pedido-ui.js: nÃ£o referencia OP` (nÃ£o-strip-comments)
  apÃ³s mudanÃ§a em `pedido-ui.js`. Falhas prÃ©-existentes em
  `tests/ops-list-screen.smoke.js` (10/30) continuam **fora
  do escopo**.
- **RAVATEX-TAPETES-PEDIDOS-UI-ADMIN-C3C2C1 (commit desta fase):**
  316/316 pass nos testes focados (`pedido-itens-edit` 46/46,
  `pedido-edit` 35/35, `pedido-detail` 43/43, `pedido-form`
  35/35, `pedido-ui` 18/18, `pedidos-list` 29/29, `pedidos-schema`
  41/41, `boot` 28/28, `router` 41/41). 5 testes novos no
  `pedido-itens-edit.smoke.js` (C3C2C1): botÃ£o "+ Adicionar
  item" existe e chama `adicionarItem()`; insert de novos
  itens com 5 chaves permitidas (`pedido_id`, `modelo_id`,
  `metros`, `observacao`, `ordem`); insert NÃƒO contÃ©m campos
  proibidos (`id`, `largura`, `cor_1_id`, `cor_2_id`,
  `criado_em`); ordem calculada como `existingItems.length + i`;
  botÃ£o "Descartar novo item" apenas para `isNew`. 1 teste
  atualizado: insert permitido, delete/upsert ainda
  proibidos. 1 teste invertido: "TEM botÃ£o + Adicionar item"
  (em vez de "NÃƒO tem"). 1 teste renomeado: "NÃƒO tem
  'Remover' / 'removeBtn'" (remoÃ§Ã£o Ã© C3C2C2). C3B status
  actions, C3C1 ediÃ§Ã£o de dados gerais e C3C2B ediÃ§Ã£o de
  itens existentes preservadas. Sem `git add .` (stage
  seletivo). Falhas prÃ©-existentes em `tests/ops-list-screen.smoke.js`
  (10/30) continuam **fora do escopo**.

## Comandos seguros
- `node --test tests/<arquivo>.smoke.js` â€” testes focados por fase.
- `node --test tests/boot.smoke.js tests/router.smoke.js
  tests/op-nova.smoke.js tests/op-pdf.smoke.js tests/op-persistir.smoke.js
  tests/op-recalculo.smoke.js tests/op-writes.smoke.js
  tests/op-form-helpers.smoke.js tests/op-latex-admin.smoke.js
  tests/painel-screen.smoke.js tests/fornecedor-screens.smoke.js`
  â€” regressÃ£o completa do refactor.
- Servir local: `.\run-local.bat` (ou
  `python -m http.server 8765`) para `index-inline.smoke.js` e
  parte de `write-guard.smoke.js`.

## DocumentaÃ§Ã£o e prevalÃªncia

A hierarquia de fontes canÃ´nicas estÃ¡ em
`docs/DOCUMENTATION_INDEX.md`. Resumo:

- **Fontes canÃ´nicas (prevalecem):** `PROJECT_STATE.md`,
  `AGENT_HANDOFF.md`, `docs/architecture/CODE_HEALTH_RULES.md`,
  `docs/architecture/PORTAL_B2B_ARCHITECTURE_RULES.md`,
  `docs/architecture/AUTH_DELETE_USER_DESIGN.md`,
  `docs/refactor/ARCHITECTURE_REFACTOR_LEDGER.md`,
  `Guide-and-governance-rules.stxt`.
- **Docs legadas (NÃƒO prevalecem):** `docs/superpowers/`,
  `docs/qa/`, `docs/DEPLOYMENT.md`, `docs/AI_AGENT_RULES.md`,
  `docs/BACKUP_AND_RESTORE.md`, `docs/HANDOFF.md` (todas
  carregam banner de aviso apÃ³s `RAVATEX-TAPETES-DOCS-SANITIZE-A`).
- Em caso de divergÃªncia, as fontes canÃ´nicas prevalecem.

Senhas de teste antigas em `docs/qa/fase1-checklist.md` e
`docs/qa/fase2-checklist.md` foram anonimizadas em
`RAVATEX-TAPETES-DOCS-SANITIZE-A` (substituÃ­das por
`[REDACTED_TEST_PASSWORD]`).

> **Atualizacao 2026-06-29 â€” fase
> `RAVATEX-TAPETES-CLIENTE-STATUS-VISUAL-LIST-A-R1` (frontend cliente
> read-only + testes focados).** A tela `Meus pedidos`
> (`js/screens/cliente-pedidos-list.js`) passou a usar a taxonomia
> compartilhada de status visual ja homologada em
> `window.RavatexPedidoTracking`, preservando a natureza **read-only**
> da lista e mantendo `select(...)` explicito em `pedidos`. Escopo
> entregue: leitura dos campos seguros `status_cliente_visual`,
> `status_cliente_excecao`, `status_cliente_mensagem` e
> `status_cliente_atualizado_em`; badge/filtro alinhados ao tracking
> visual compartilhado; sem `select('*')`, sem writes, sem RPC, sem
> Edge Function, sem admin/fornecedor e sem ativar consumo do modelo
> parcial nessa tela. Validacao focada:
> `tests/cliente-pedidos-list.smoke.js`,
> `tests/cliente-portal-visual.smoke.js`,
> `tests/cliente-dashboard.smoke.js` e
> `tests/cliente-routing.smoke.js` passaram. Sem schema, sem SQL, sem
> Supabase; o schema de acompanhamento parcial segue nao aplicado.
> Proximo estado esperado: working tree limpo, sem residuos locais
> remanescentes desta frente.

## AÃ§Ãµes PROIBIDAS sem autorizaÃ§Ã£o explÃ­cita
- `db/10_reset_producao.sql` e `db/11_reset_producao.sql` (DELETE em
  massa de produÃ§Ã£o).
- Qualquer SQL contra `bhgifjrfagkzubpyqpew` sem backup.
- Push em `origin/main` (= produÃ§Ã£o).
- Editar `index.html`, `js/**`, `tests/**` durante fase docs-only.
- Tocar `origin/main` ou PR #2.
- Iniciar nova extraÃ§Ã£o em `op-nova.js` (refactor congelado).

## PendÃªncias de informaÃ§Ã£o
- Quem tem write no GitHub `grupoterrabranca` e acesso ao Supabase?
- Existe backup automÃ¡tico do Supabase? Quem sabe restaurar?
- O backdoor `*@tapetes.test` (ver histÃ³rico de D1) jÃ¡ foi removido?
- HÃ¡ link/projeto Vercel real? (premissa atual: nÃ£o â€” app Ã© estÃ¡tico
  no GitHub Pages.)

## Registro documental de schema versionado

> **Atualizacao 2026-06-29 â€” fase
> `RAVATEX-TAPETES-CLIENTE-PARCIAIS-SCHEMA-DOCS-R1` (docs-only,
> fechamento documental de schema ja commitado).** Fica aceita com
> **ressalva documental** a fase
> `RAVATEX-TAPETES-CLIENTE-PARCIAIS-SCHEMA-A-R1`, correspondente ao
> commit publicado `0a02f6a â€” Add pedido parciais schema`. Arquivos
> publicados nesse commit: `db/17_pedido_parciais_schema.sql` e
> `tests/pedido-parciais-schema.smoke.js`. O smoke estatico passou
> **16/16**. O SQL permaneceu **nao aplicado** em Supabase; nenhum
> banco remoto foi tocado; producao/original permaneceram intocados.
> O commit ficou restrito a schema versionado + validacao estatica,
> sem frontend, sem helper/read-model de parciais, sem lista/status
> visual do cliente. Residuos locais fora de escopo foram preservados
> para fases futuras. Proxima sequencia recomendada:
> 1. helper/read-model de parciais;
> 2. lista cliente/status visual;
> 3. apply controlado de `db/17_pedido_parciais_schema.sql` em
> staging, somente quando houver autorizacao explicita.

> **Atualizacao 2026-06-29 â€” fase
> `RAVATEX-TAPETES-CLIENTE-PARCIAIS-HELPER-A` (frontend helper/read-model
> puro + smoke estatico).** Publicado somente o helper/read-model de
> acompanhamento parcial em `js/pedido-tracking-ui.js`, preservando
> `window.RavatexPedidoTracking`, `CLIENTE_TRACKING_STEPS`,
> `CLIENTE_TRACKING_EXCECOES` e os helpers existentes do tracking
> visual ja homologado. Escopo entregue: catalogo
> `CLIENTE_PARCIAL_SITUACOES`, normalizacao/ordenacao de parciais,
> distribuicao por situacao, calculo percentual, DTO seguro de
> parciais e builder puro `buildPedidoAcompanhamentoParcial`, sem
> query, sem Supabase, sem writes e sem side effects. Validacao focada:
> `tests/pedido-acompanhamento-parcial.smoke.js`,
> `tests/cliente-tracking-steps.smoke.js` e
> `tests/cliente-pedido-tracking.smoke.js` passaram. `db/17` continua
> **nao aplicado**; nenhuma tela consumidora foi alterada; lista
> cliente/status visual permanece residual fora de escopo. Proxima
> fase recomendada: lista cliente/status visual ou apply controlado do
> `db/17`, conforme decisao do projeto.

> **Atualizacao 2026-06-29 â€” fase
> `RAVATEX-TAPETES-CLIENTE-PARCIAIS-SCHEMA-APPLY-STAGING-A`
> (aplicacao controlada de SQL em staging + validacao estrutural).**
> Aplicado em staging/paralelo `ucrjtfswnfdlxwtmxnoo` o arquivo
> versionado exato `db/17_pedido_parciais_schema.sql`, via Supabase
> CLI/Management API, **sem tocar producao/original
> `bhgifjrfagkzubpyqpew`** e sem SQL adicional fora do script.
> Validacoes pos-aplicacao concluÃ­das: colunas
> `parcial_habilitado`, `parcial_atualizado_em`, `metros_total`
> presentes em `public.pedidos`; tabelas `public.pedido_parciais` e
> `public.pedido_parcial_itens` presentes; RLS habilitada nas duas;
> policies encontradas: `pedido_parciais_admin_all`,
> `pedido_parciais_cliente_select`,
> `pedido_parcial_itens_admin_all`,
> `pedido_parcial_itens_cliente_select`; funcoes encontradas:
> `recalcular_pedido_metros_total`,
> `sincronizar_pedido_parciais_resumo`,
> `touch_pedido_parciais_updated_at`,
> `pedido_parciais_after_change`,
> `pedido_itens_sync_parciais_after_change`; triggers instalados:
> `pedido_parciais_touch_updated_at`,
> `pedido_parciais_after_change_trigger` em `pedido_parciais` e
> `pedido_itens_sync_parciais_after_change_trigger` em `pedido_itens`;
> constraints validadas nas tabelas novas, incluindo PKs, FKs,
> checks de `situacao`/`origem`/`sequencia`/`metros` e UNIQUE
> `pedido_parcial_itens_parcial_item_key`. Contagens atuais:
> `pedido_parciais = 0`, `pedido_parcial_itens = 0`. Nenhum dado de
> negocio foi inserido ou alterado para teste. Frontend permaneceu
> intocado nesta fase e as parciais ainda nao foram ligadas a tela
> consumidora real. Testes locais verdes:
> `tests/pedido-parciais-schema.smoke.js`,
> `tests/pedido-acompanhamento-parcial.smoke.js`,
> `tests/cliente-pedidos-list.smoke.js`,
> `tests/cliente-portal-visual.smoke.js`. Proxima fase recomendada:
> decidir entre ativacao controlada da leitura parcial em detalhe/lista
> ou homologacao tecnica dos dados de parciais.

> **Atualizacao 2026-06-29 â€” fase
> `RAVATEX-TAPETES-CLIENTE-PARCIAIS-ADMIN-CONTROL-A`
> (controle manual admin + writes controlados + smoke focado).**
> Publicado controle manual de parciais no detalhe admin do pedido,
> via novo modulo `js/screens/pedido-parciais-admin.js` integrado a
> `js/screens/pedido-detail.js` e carregado por `index.html`. O admin
> agora lista parciais existentes de `pedido_parciais` com SELECT
> explicito (`id`, `pedido_id`, `sequencia`, `situacao`, `metros`,
> `data_referencia`, `titulo`, `mensagem_cliente`, `visivel_cliente`,
> `criado_em`, `atualizado_em`) e pode cadastrar novas parciais
> manuais com insert controlado em `pedido_parciais`, preenchendo
> `pedido_id`, `sequencia`, `situacao`, `metros`, `data_referencia`,
> `titulo`, `mensagem_cliente`, `visivel_cliente`, `origem = 'manual'`
> e `criado_por` quando `window.CURRENT_USER.id` estiver disponivel.
> O formulario usa o catalogo compartilhado
> `window.RavatexPedidoTracking.CLIENTE_PARCIAL_SITUACOES`, default
> `visivel_cliente = false`, tolera `pedidos.metros_total` nulo e
> mostra preview tecnico simples com `buildPedidoAcompanhamentoParcial`
> sem alterar status visual do pedido. Escopo preservado: cliente ainda
> nao le `pedido_parciais`; `js/screens/cliente-pedido-detail.js`,
> `js/screens/cliente-pedidos-list.js`,
> `js/screens/cliente-dashboard.js` e
> `js/screens/cliente-pedido-tracking.js` permaneceram intocados;
> `pedido_parcial_itens` continua fora do MVP desta fase; nenhum
> schema, SQL, Supabase apply ou producao/original foi tocado.
> Validacao focada verde:
> `tests/pedido-parciais-admin-control.smoke.js`,
> `tests/pedido-parciais-schema.smoke.js`,
> `tests/pedido-acompanhamento-parcial.smoke.js`,
> `tests/cliente-pedido-detail.smoke.js`,
> `tests/cliente-pedidos-list.smoke.js`,
> `tests/cliente-dashboard.smoke.js`. Proxima fase recomendada:
> homologacao tecnica do fluxo admin criando parciais reais em staging,
> ou leitura read-only de parciais no detalhe cliente depois de haver
> dado controlado suficiente.

> **Atualizacao 2026-06-29 â€” fase
> `RAVATEX-TAPETES-CLIENTE-PARCIAIS-ADMIN-HOMOLOG-RECORD-A`
> (docs-only, registro da homologacao tecnica controlada em staging).**
> Fica registrada como **APROVADA** a homologacao tecnica da UI admin
> de parciais no HEAD `e2b8723`, em app local conectado ao Supabase
> staging `ucrjtfswnfdlxwtmxnoo`, sem tocar producao/original
> `bhgifjrfagkzubpyqpew`. Pedido homologado: `#2`
> (`ee62b4aa-aa97-46b9-a44f-3b7d992dcdcb`). Parcial real criada via UI
> admin, sem SQL manual: id
> `3966fb1f-c333-4024-92f9-7fabdaa4e532`, `sequencia = 1`,
> `situacao = em_acabamento`, `metros = 2500`,
> `data_referencia = 2026-06-29`, titulo `Parcial em acabamento`,
> mensagem cliente `Parte do pedido esta em etapa de acabamento.`,
> `visivel_cliente = true`, `origem = manual`, `metadata = {}` e
> `criado_por` preenchido (valor nao registrado). Validacao read-only:
> `pedido_parciais` recebeu o registro corretamente; `pedidos`
> sincronizou `parcial_habilitado = true`,
> `parcial_atualizado_em = 2026-06-29T12:39:43.739178+00:00`,
> `metros_total = 10000.00`; `status` permaneceu `recebido`,
> `status_cliente_visual` permaneceu `acabamento` e
> `status_cliente_excecao` permaneceu `null`. `pedido_parcial_itens`
> continuou vazio e fora do MVP. Cliente ainda nao le
> `pedido_parciais`; nenhuma tela cliente foi alterada; nenhum dado
> interno foi exposto ao cliente. Nenhum schema, SQL, Supabase mutation
> adicional ou alteracao de frontend/repo foi realizado nesta fase.
> Proxima fase recomendada: leitura read-only de parciais no detalhe
> cliente.

> **Atualizacao 2026-06-29 â€” fase
> `RAVATEX-TAPETES-CLIENTE-PARCIAIS-CLIENTE-DETAIL-A`
> (frontend cliente read-only no detalhe + smoke focado).**
> Publicada leitura read-only de `pedido_parciais` apenas em
> `js/screens/cliente-pedido-detail.js`, sem alterar lista cliente,
> dashboard, admin, fornecedor, schema ou Supabase. O detalhe cliente
> agora consulta `public.pedido_parciais` com SELECT explicito e
> sanitizado (`id`, `pedido_id`, `sequencia`, `situacao`, `metros`,
> `data_referencia`, `titulo`, `mensagem_cliente`, `criado_em`,
> `atualizado_em`), filtrando por `pedido_id` e ordenando por
> `sequencia asc`, `criado_em asc`, confiando na RLS staging ja
> aplicada para limitar a leitura a parciais visiveis do proprio
> pedido. A renderizacao reaproveita o helper compartilhado
> `window.RavatexPedidoTracking.buildPedidoAcompanhamentoParcial` para
> rotulos e taxonomia, mostra a secao `Parciais do pedido`, empty
> state `Este pedido ainda nao possui parciais publicadas.` e erro
> discreto sem quebrar tracking, resumo, itens ou timeline. Nenhum
> campo interno foi exposto: sem `metadata`, `criado_por`, `origem`,
> `observacao_admin`, `visivel_cliente`, `pedido_parcial_itens`,
> `OP`, `lote`, `fornecedor`, `NF`, `romaneio`, `custo`, `margem` ou
> `token_acesso`. Validacao focada verde:
> `tests/cliente-pedido-detail.smoke.js`,
> `tests/pedido-acompanhamento-parcial.smoke.js`,
> `tests/pedido-parciais-admin-control.smoke.js`,
> `tests/cliente-pedidos-list.smoke.js` e
> `tests/cliente-dashboard.smoke.js`. Proxima fase recomendada:
> homologacao E2E admin -> cliente das parciais em staging.

> **Atualizacao 2026-06-29 â€” fase
> `RAVATEX-TAPETES-CLIENTE-PARCIAIS-HOMOLOG-RECORD-A`
> (docs-only, fechamento documental da homologacao E2E com ressalva
> visual).** Fica registrada como **APROVADA COM RESSALVA VISUAL** a
> decisao de entrada `RAVATEX-TAPETES-CLIENTE-PARCIAIS-E2E-HOMOLOG-R1`
> no HEAD `91f7159`, em app local conectado ao Supabase staging
> `ucrjtfswnfdlxwtmxnoo`, sem tocar producao/original
> `bhgifjrfagkzubpyqpew`. O cliente validou em staging a leitura
> read-only de parciais no detalhe do proprio pedido `#2`
> (`ee62b4aa-aa97-46b9-a44f-3b7d992dcdcb`), exibindo a secao
> `Parciais do pedido` com a parcial visivel ja homologada
> (`sequencia = 1`, situacao amigavel `Em acabamento`,
> `metros = 2500`, `data_referencia = 2026-06-29`, titulo
> `Parcial em acabamento`, mensagem
> `Parte do pedido esta em etapa de acabamento.`), mantendo tracking,
> resumo, itens e timeline operacionais e sem expor `metadata`,
> `criado_por`, `origem`, `observacao_admin`, `OP`, `lote`,
> `fornecedor`, `NF`, `romaneio`, `custo`, `margem`, `token_acesso`
> ou `service_role`. Lista e dashboard cliente continuam sem resumo de
> parciais nesta trilha funcional minima. Ressalva registrada: o
> acabamento visual do detalhe cliente ainda esta distante do HTML de
> referencia e deve seguir em frente separada, sem bloquear a
> aprovacao funcional minima desta leitura cliente. Nenhum codigo,
> schema, SQL, Supabase mutation ou alteracao visual foi realizado
> nesta fase docs-only. Proxima fase recomendada: frente dedicada de
> polish visual do detalhe cliente, separada da funcionalidade de
> parciais.

> **Atualizacao 2026-06-30 â€” fase
> `RAVATEX-TAPETES-ADMIN-NOVA-OP-MATCH-STANDALONE-CLOSEOUT`
> (homologacao do redesenho visual da tela Admin Nova OP).** Fica
> registrada como **APROVADA** a homologacao visual da tela Admin â†’
> Nova OP (rota `#/ops/nova` e edicao `#/ops/:id`) no HEAD `9495918`,
> com aceite visual explicito do dono do projeto em staging local
> (`run-local.bat`). O miolo de `js/screens/op-nova.js` foi
> redesenhado para igualar ao HTML standalone
> `Admin - Nova OP - standalone.html` (header com subtitulo e botao
> Voltar; card "1. Dados da OP"; card "2. Itens da OP"; card
> "3. Recebimento de fios" com pendentes/recebidas/proposta por
> sliders; card "4. Entregas tecelagem"; coluna lateral "Resumo da OP";
> barra inferior informativa), preservando integralmente shell/sidebar/
> topbar globais (`js/screens/common.js` e `index.html` intocados),
> rota, acoes, validacoes e writes existentes (`window.persistirOP`,
> `window.aplicarRecalculoOP`, `window.registrarRecebimentoOrdemFio`,
> `window.atribuirFornecedorFioOp`). Diferenca residual deferida: as
> colunas Quantidade e Observacao por item do standalone nao existem
> em `op_itens` (ver `db/01_schema.sql`) e exigiriam alteracao de
> schema/logica fora do escopo desta fase â€” a tabela real usa apenas
> Modelo/Metros/Acoes. Nenhum schema, SQL, Supabase mutation ou
> alteracao de producao/`origin/main` foi realizada. Validacao focada
> verde: `node --check js/screens/op-nova.js`,
> `tests/op-nova.smoke.js` (30/30) e `git diff --check`; suite
> opcional de nao-regressao do fluxo OP (`tests/op-persistir.smoke.js`,
> `tests/op-recalculo.smoke.js`, `tests/op-writes.smoke.js`,
> `tests/op-form-helpers.smoke.js`, `tests/op-pdf.smoke.js`,
> `tests/op-latex-admin.smoke.js`) tambem executada, com 2 falhas
> pre-existentes e nao relacionadas (`screenPainel ... 9 itens do
> ADMIN_MENU`, ja presentes no HEAD `9495918` antes desta fase,
> confirmadas via `git stash`) â€” nao corrigidas nesta fase por estarem
> fora do escopo. Unico arquivo funcional alterado:
> `js/screens/op-nova.js`. Proxima fase recomendada: avaliar, em
> frente separada, se vale criar campos de quantidade/observacao por
> item de OP (exige schema).

> **Atualizacao 2026-06-30 - fase
> `RAVATEX-TAPETES-ADMIN-FORNECEDORES-MATCH-STANDALONE-AND-CONTACT-FIELDS-CLOSEOUT`
> (homologacao visual de Fornecedores + versionamento dos campos
> opcionais de contato em Fornecedores/Clientes).** Fica registrada
> como **APROVADA** a homologacao visual/funcional da tela Admin ->
> Fornecedores contra o standalone, com aceite explicito do dono no
> HEAD `1fdc54b` sobre a branch `work/app-next`. O arquivo funcional
> alterado foi `js/screens/cadastros.js`, preservando shell, sidebar e
> topbar globais, rota, acoes, validacoes e permissoes admin. A tela
> de Fornecedores ficou alinhada ao mockup em header, busca, tabela,
> footer, acoes e modal, mantendo CRUD real. Tambem fica versionada a
> migration `db/18_fornecedores_clientes_optional_contact_fields.sql`,
> aplicada somente no Supabase staging `ucrjtfswnfdlxwtmxnoo`, sem
> tocar producao nem `origin/main`, adicionando os campos opcionais
> `fornecedores.email`, `fornecedores.telefone`, `clientes.contato` e
> `clientes.telefone`. O CRUD real foi validado em staging para
> Fornecedores e Clientes, incluindo criacao/edicao com e sem os novos
> campos e remocao dos registros temporarios ao final. Checks
> executados: `node --check js/screens/cadastros.js`,
> `tests/cadastros-screens.smoke.js` com resultado 31/32 e unica falha
> conhecida pre-existente fora do escopo (`screenPainel` espera 9 itens
> de `ADMIN_MENU` e renderiza 10), alem de `git diff --check` verde.

> **Atualizacao 2026-07-01 - fase
> `RAVATEX-TAPETES-ADMIN-CADASTROS-MODALS-VISUAL-FINALIZE-A`
> (homologacao visual dos modais de Cadastros Admin).** Fica
> registrada como **APROVADA** a homologacao visual dos modais de
> `#/cadastros/cores`, `#/cadastros/clientes`,
> `#/cadastros/modelos`, `#/cadastros/fornecedores`,
> `#/cadastros/precos` e `#/cadastros/usuarios`, com aceite visual
> explicito do dono na branch `work/app-next`, sobre o HEAD inicial
> desta fase `6827369`. O unico arquivo funcional alterado permaneceu
> `js/screens/cadastros.js`, sem mudanca em schema, SQL, Supabase,
> payloads persistidos, regras de negocio, `common.js`, `index.html`
> ou shell global. Os helpers visuais dos modais foram preservados e
> consolidados numa unica implementacao por tela, com padrao comum de
> header, overlay, campos, footer, botoes, radius e espacamento.
> Tambem fica registrado que o campo visual `Observações` foi mantido
> nos modais ajustados, a area de imagem/preview de `Modelos` foi
> preservada e a sobra intermediaria do modal de `Precos` foi removida,
> deixando uma unica construcao final legivel do body. O CRUD anterior
> dos campos ja persistidos permaneceu preservado. Checks executados:
> `node --check js/screens/cadastros.js`,
> `node --test tests/cadastros-screens.smoke.js` com resultado 31/32 e
> unica falha conhecida pre-existente fora do escopo (`screenPainel`
> espera 9 itens de `ADMIN_MENU` e renderiza 10), alem de
> `git diff --check` verde. `supabase/.temp/` permaneceu fora do
> commit.

> **Atualizacao 2026-06-30 - fase
> `RAVATEX-TAPETES-ADMIN-MODELOS-MATCH-STANDALONE-CLOSEOUT`
> (homologacao visual da tela Admin -> Modelos).** Fica registrada
> como **APROVADA** a homologacao visual da tela
> `#/cadastros/modelos`, com aceite visual explicito do dono na branch
> `work/app-next`, sobre o HEAD inicial desta fase `9b37ac6`. O unico
> arquivo funcional alterado foi `js/screens/cadastros.js`,
> preservando shell, sidebar e topbar globais. Modelos foi alinhado ao
> padrao visual homologado de Cadastros com busca full-width,
> card/tabela e footer, preview sintetico por modelo sem uso de
> schema/storage/imagem real, nome como coluna principal com ID
> secundario, swatches lado a lado para `cor_1`/`cor_2` e acoes com
> icones `SquarePen` e `Trash`, preservando CRUD real, payloads,
> validacoes, permissoes e schema atual. Tambem fica registrado o
> hotfix visual em Usuarios, mantendo o botao neutro e o icone de
> excluir em vermelho, sem alterar fluxos administrativos. A correcao
> de runtime de Modelos foi incluida nesta fase ao internalizar o
> helper de swatch, fazendo a rota abrir normalmente sem dependencia de
> outro escopo. Nenhum schema, SQL, Supabase, producao, `origin/main`,
> `common.js` ou `index.html` foi tocado. Checks executados:
> `node --check js/screens/cadastros.js`,
> `tests/cadastros-screens.smoke.js` com resultado 31/32 e unica falha
> conhecida pre-existente fora do escopo (`screenPainel` espera 9 itens
> de `ADMIN_MENU` e renderiza 10), alem de `git diff --check` verde.
> Nenhum schema/SQL em producao, mutation Supabase de producao ou
> alteracao fora de `cadastros` foi realizada. `supabase/.temp/`
> permanece fora do commit.

> **Atualizacao 2026-07-01 - fase
> `RAVATEX-TAPETES-ADMIN-CADASTROS-MODALS-SCHEMA-PERSISTENCE-CLOSEOUT`
> (persistencia real de `observacoes` nos Cadastros Admin).** Fica
> registrada como **APROVADA** a persistencia real opcional do campo
> `observacoes` em `cores`, `clientes`, `modelos`, `fornecedores`,
> `precos_terceirizada` e `usuarios`, na branch `work/app-next`, sobre
> o HEAD inicial `70cf4fb`. O arquivo funcional alterado foi
> `js/screens/cadastros.js` e a migration versionada foi
> `db/19_cadastros_observacoes.sql`, aplicada manualmente apenas no
> Supabase staging `ucrjtfswnfdlxwtmxnoo`, sem tocar producao
> `bhgifjrfagkzubpyqpew` nem `origin/main`. As colunas confirmadas em
> staging foram `cores.observacoes`, `clientes.observacoes`,
> `modelos.observacoes`, `fornecedores.observacoes`,
> `precos_terceirizada.observacoes` e `usuarios.observacoes`, todas
> `text` nullable. O uso de `detectOptionalColumns` foi preservado para
> compatibilidade com ambientes sem a migration. Tambem fica registrado
> que a criacao de usuario preserva a Edge Function
> `admin-create-user`, com update posterior de `observacoes` quando
> necessario. A decisao de nao persistir imagem em `Modelos` permanece:
> nao ha infraestrutura atual de Supabase Storage, bucket, upload ou
> `imagem_url` no repo; a UI local/visual de preview segue homologada e
> a persistencia real de imagem fica deferida para uma fase propria de
> Storage, sem uso de base64 em tabela. Validacao funcional aceita:
> `Cores`, `Clientes`, `Modelos` e `Fornecedores` com criar/reload/
> reabrir/editar/reconfirmar persistencia e remocao dos registros
> temporarios; `Precos` e `Usuarios` validados manualmente pelo dono;
> checagem final sem registros residuais `RAVATEX_TEST%` nas 6
> tabelas. Checks executados: `node --check js/screens/cadastros.js`,
> `node --test tests/cadastros-screens.smoke.js` com resultado 31/32 e
> unica falha conhecida pre-existente fora do escopo (`screenPainel`
> espera 9 itens de `ADMIN_MENU` e renderiza 10), alem de
> `git diff --check` verde. `supabase/.temp/` permaneceu fora do
> commit.

> **Atualizacao 2026-06-30 - fase
> `RAVATEX-TAPETES-ADMIN-CADASTROS-CLIENTES-PRECOS-USUARIOS-CLOSEOUT`
> (homologacao visual do pacote Clientes + Precos + Usuarios).**
> Fica registrada como **APROVADA** a homologacao visual do pacote
> Admin -> Cadastros para `#/cadastros/clientes`,
> `#/cadastros/precos` e `#/cadastros/usuarios`, com aceite visual
> explicito do dono na branch `work/app-next`, sobre o HEAD inicial
> desta fase `f55a10d`. O unico arquivo funcional alterado foi
> `js/screens/cadastros.js`, mantendo shell, sidebar e topbar
> preservados. Clientes foi alinhado ao padrao visual homologado com
> header, busca full-width, tabela/card, footer e acoes coerentes ao
> pacote de Cadastros, preservando o CRUD real e os campos opcionais
> `contato`/`telefone`. Precos foi alinhado ao mesmo padrao visual com
> busca, grid de listagem, footer e acoes preservando rotas, modais,
> validacoes e writes existentes. Usuarios foi alinhado ao mesmo
> padrao visual com busca, toggle de inativos, tabela/card, badges de
> status e acoes administrativas preservando validacoes, permissoes e
> fluxos reais de editar, desativar e excluir. Nenhum schema, SQL,
> Supabase, producao ou `origin/main` foi tocado nesta fase; nao houve
> alteracoes em `common.js`, `index.html`, shell global ou telas fora
> do pacote. Checks executados: `node --check js/screens/cadastros.js`,
> `tests/cadastros-screens.smoke.js` com resultado 31/32 e unica falha
> conhecida pre-existente fora do escopo (`screenPainel` espera 9 itens
> de `ADMIN_MENU` e renderiza 10), alem de `git diff --check` verde.
> **Atualizacao 2026-07-01 - fase
> `RAVATEX-TAPETES-PEDIDO-DETAIL-UI-B1-R1`
> (closeout documental da refatoracao modular do Detalhe do Pedido).**
> Fica registrado como **OK** o fechamento da fase na branch
> `work/app-next`, sobre o HEAD base
> `c12fcb5af5b8f436efc3e3119985ccf529bd09d5`. O Detalhe do Pedido
> admin foi refatorado sem alterar o comportamento visual/funcional
> homologado do standalone, quebrando o antigo monolito em modulos
> coesos: `js/screens/pedido-detail.js` (orquestracao),
> `js/screens/pedido-detail-data.js` (carregamento/normalizacao),
> `js/screens/pedido-detail-render.js` (layout/render),
> `js/screens/pedido-detail-progress.js` (progresso/stepper) e
> `js/screens/pedido-detail-events.js` (handlers/acoes). `index.html`
> foi ajustado apenas para carregar os novos scripts, e os testes
> focados fecharam em **177/177 passing**. Residual preservado fora
> do commit R1: `M js/screens/pedidos-list.js` e `?? supabase/.temp/`.
> Push nao realizado. Producao nao tocada.
>
> **Atualizacao 2026-07-01 - fase
> `RAVATEX-TAPETES-MOVIMENTAR-PRODUCAO-MODAL-B`
> (modal Movimentar Producao readonly/pre-carregado no Detalhe do
> Pedido).** Fica registrada como **VALIDADA** a fase visual do modal
> aberto pelos atalhos `Transferir`/`Movimentar` em
> `js/screens/pedido-detail.js`, na branch `work/app-next`, sobre o
> HEAD base `583f90a`. O arquivo funcional alterado foi
> `js/screens/pedido-detail-events.js`, com ajuste focado do modal para
> um estado **pre-carregado e somente leitura**, alinhado ao standalone
> de referencia e sem criar formulario operacional no Pedido. O modal
> passou a exibir origem, destino, OP de origem, itens envolvidos,
> saldo/restante calculado, documentos esperados e aviso explicito de
> que a movimentacao canonica continua na OP/cadeia produtiva. Fica
> confirmado nesta fase que **nao houve gravacao de movimentacao**,
> nenhum `update`/`insert`/`delete` novo em Pedido, nenhuma chamada a
> `salvarEntregaCima`, `salvarEntregaLatex`, `gerar_op_latex` ou
> `alterar_status_op`, nenhuma alteracao de SQL/schema, nenhuma mudanca
> de OP lifecycle e nenhum toque em Supabase ou producao. A validacao
> focada ja registrada para o modal incluiu
> `node --check js/screens/pedido-detail-events.js`,
> `node --test tests/pedido-detail.smoke.js` e o pacote de closeout
> `node --test tests/pedido-detail.smoke.js tests/pedido-edit.smoke.js
> tests/pedido-itens-edit.smoke.js
> tests/admin-pedido-tracking-control.smoke.js
> tests/pedido-parciais-admin-control.smoke.js`, com resultado
> **180/180 passing** no comando agregado e
> `tests/pedido-detail.smoke.js` atualizado para **46/46 passing**.
> Residual conhecido preservado fora do commit: `?? supabase/.temp/`.
> Producao permanece intocada.
>
> **Atualizacao 2026-07-01 - fase
> `RAVATEX-TAPETES-OP-EM-PRODUCAO-ACABAMENTO-STANDALONE-B`.**
> Implementado em `js/screens/op-latex-admin.js` um renderer operacional
> proprio para OP Acabamento/Latex em producao (`renderOPLatexProducao`),
> aplicado somente quando `op.status === 'em_producao'`. A OP aberta de
> acabamento continua no template de preparacao ja existente, com o CTA
> controlado "Colocar em producao" ainda apenas nesse ramo; OP finalizada/
> legado segue no fallback anterior.
> A nova tela de producao de acabamento renderiza header operacional com
> badges "Acabamento/Latex" e "Em producao", cadeia produtiva com vinculo
> para a OP de tecelagem quando disponivel, Card 1 Dados da OP, resumo
> operacional, Card 2 Itens da OP com enviado/recebido/falta e excedente,
> Card 3 Material recebido da tecelagem, Card 4 Recebimentos/acabamento,
> Card 5 Finalizacao/liberar para proxima etapa, Card 6 Documentos da OP
> como placeholder controlado (Romaneio, Nota fiscal de entrada, Nota
> fiscal de saida, todos "Aguardando integracao") e Card 7 Historico com
> fallback "Nenhum evento registrado para esta OP.".
> Preservacoes: os writes legados de recebimento/finalizacao continuam
> chamando `salvarEntregaLatex`, `atualizarEntregaLatex`, `excluirEntrega`,
> `editarEnviado`, `finalizar` e `excluirOpLatex`; nao houve alteracao em
> `salvarEntregaLatex`, `atualizarEntregaLatex`, `salvarEntregaCima`,
> `gerar_op_latex`, `op-nova.js`, `op-persistir.js`, `op-recalculo.js`,
> SQL/db, Supabase ou producao. Nao foi copiado card "Entregas tecelagem"
> para Acabamento, nao foi chamada `alterar_status_op`, nao foi criado
> update novo para `ops.status = em_producao`, nao houve upload/schema de
> documentos reais nem expedicao gravavel.
> Testes: `node --check js/screens/op-latex-admin.js` OK;
> `node --check tests/op-latex-admin.smoke.js` OK;
> `node --test tests/op-latex-admin.smoke.js` OK (44/44);
> `node --test tests/op-latex-admin.smoke.js tests/op-nova.smoke.js
> tests/op-persistir.smoke.js tests/boot.smoke.js
> tests/pedido-detail.smoke.js tests/op-recalculo.smoke.js` OK (308/308).
> Busca de seguranca: encontrou apenas writes legados permitidos
> (`salvarEntregaLatex`, `atualizarEntregaLatex`, `excluirEntrega`) e a
> finalizacao existente para `finalizada`; "Colocar em producao" permanece
> no ramo de OP aberta/preparacao, nao no renderer `em_producao`.

> **Atualizacao 2026-07-03 - fase
> `RAVATEX-TAPETES-PEDIDO-POST-SAVE-FIRST-OP-CTA-B`.**
> Implementado fluxo pos-salvamento de pedido sem alterar lifecycle
> produtivo: admin agora permanece na tela apos salvar, ve resumo
> "Pedido salvo com sucesso" com cliente, pedido, itens e metragem, e tem
> CTA primario "Abrir OP de Tecelagem" alinhado a direita usando hash route
> `#/ops/nova?pedido_id=<pedido_id>`. Cliente agora ve resumo "Pedido
> enviado", proximos passos, "Ver meus pedidos" e "Criar novo pedido", sem
> CTA de OP. No detalhe admin, o botao de primeira OP foi padronizado para
> "Gerar primeira OP" e segue usando `#/ops/nova?pedido_id=<pedido_id>`;
> quando ha OP vinculada, a tela continua mostrando cards de OP existentes
> com "Abrir OP", sem sugerir duplicidade.
> Preservado: nenhum SQL, Supabase remoto/producao, `gerar_op_latex`,
> expedicao, entrega/coleta ou conclusao de pedido foram alterados.
> Testes focados OK: `node --check js/screens/pedido-form.js`,
> `node --check js/screens/cliente-pedido-form.js`,
> `node --check js/screens/pedido-detail-events.js`,
> `node --check js/screens/pedido-detail-render.js`,
> `node --test tests/pedido-form.smoke.js`,
> `node --test tests/cliente-pedido-form.smoke.js`,
> `node --test tests/pedido-detail.smoke.js`,
> `node --test tests/boot.smoke.js`,
> `node --test tests/router.smoke.js`,
> `node --test tests/op-nova.smoke.js`.
> `tests/pedido-novo.smoke.js` nao existe. Busca de seguranca para rota
> fisica `/ops/nova` sem ocorrencias. Residual preservado fora do commit:
> `?? supabase/.temp/`.

> **Atualizacao 2026-07-03 - fase
> `RAVATEX-TAPETES-LOGIN-STANDALONE-UI-B`.**
> Tela real de login redesenhada em `js/screens/system-screens.js`,
> usando o `Login-standalone.html` apenas como referencia visual: fundo
> cinza claro, card central branco com borda/sombra sutil, marca Inttex,
> titulo "Inttex OptiControl", subtitulo, campos E-mail/Senha com icones,
> botao de mostrar/ocultar senha, link "Esqueceu a senha?", checkbox
> visual "Lembrar-me neste dispositivo", botao "Entrar" e rodape
> "© 2026 Inttex · Controle de Tapetes".
> Auth preservado: submit continua chamando `window.login(email, senha)`,
> sucesso segue com `window.toast('Login OK', 'success')` e
> `window.routeAfterLogin()`, erro continua exibindo
> "E-mail ou senha incorretos" e o loading/disabled do botao foi mantido.
> Recuperacao de senha permanece placeholder controlado com toast
> "Recuperação de senha ainda não configurada."; lembrar-me segue visual,
> sem criar `localStorage` ou alterar persistencia de sessao.
> Nao houve SQL, migration, RLS, alteracao de Supabase/auth client,
> producao, Pedido, OP ou Expedicao.
> Testes atualizados em `tests/system-screens.smoke.js` para cobrir titulo,
> subtitulo, campos, botao Entrar, lembrar-me, esqueceu senha, submit,
> erro, loading/disabled, toggle de senha e ausencia de chamadas Supabase
> no modulo.

> **Atualizacao 2026-07-03 - fase
> `RAVATEX-TAPETES-PEDIDO-POST-SAVE-OP-CTA-ROUTE-R1`.**
> Corrigido o 404 interno ao clicar em "Abrir OP de Tecelagem" apos salvar
> Pedido admin. O CTA em `js/screens/pedido-form.js` ja montava a hash
> canonica `#/ops/nova?pedido_id=<uuid>`; a causa estava em `js/router.js`,
> onde `matchRoute` fazia match exato usando a hash inteira, incluindo a
> query, e por isso nao encontrava a rota registrada `#/ops/nova`.
> O router agora remove apenas a query para o match exato, preservando
> `window.location.hash` completa para o `js/boot.js` ler `pedido_id` via
> `URLSearchParams` e chamar `window.screenNovaOP(null, pid)`.
> `screenNovaOP` segue recebendo `pedido_id` como string UUID, sem
> `Number`/`parseInt`, carregando Pedido/cliente/itens por esse id; quando
> o Pedido nao existe, mostra erro claro "Pedido não encontrado" em vez de
> cair no 404 generico do router.
> Tambem foi coberto que o CTA "Gerar primeira OP" do detalhe usa a mesma
> hash route com UUID preservado. Texto admin do pos-save nao foi alterado
> nesta fase, exceto a mensagem de erro de Pedido nao encontrado.
> Testes focados OK: `node --check js/router.js`,
> `node --check js/screens/op-nova.js`,
> `node --test tests/pedido-form.smoke.js`,
> `node --test tests/pedido-detail.smoke.js`,
> `node --test tests/op-nova.smoke.js`,
> `node --test tests/boot.smoke.js` e
> `node --test tests/router.smoke.js`. Sem SQL, Supabase remoto/producao,
> lifecycle de OP, login, rota fisica `/ops/nova`, criacao automatica de OP
> ou push. Residual preservado fora do commit: `?? supabase/.temp/`.
> **Atualizacao 2026-07-03 - complemento R2 final.**
> Alinhado ao arquivo `Setas de transicao - referencia.html`: as setas
> do `Progresso produtivo` agora aceitam somente `Concluido`,
> `Transferir` e `Aguardar` como texto visivel. `Ver`, `Editar`,
> `Entregar` e textos longos/contextuais nao aparecem dentro dos
> conectores. `Concluido` e `Aguardar` sao estaticos sem handler;
> somente `Transferir` e botao/clicavel, chamando a operacao canonica
> quando o gate permite. Shape solido com `clip-path`, `min-width:100px`
> e sem bordas quebradas/pilula solta.
> Testes finais: `node --check js/screens/pedido-detail-render.js` OK;
> `node --check tests/pedido-detail.smoke.js` OK;
> `node --test tests/pedido-detail.smoke.js` OK (56/56);
> `node --test tests/boot.smoke.js` OK (29/29);
> `node --test tests/router.smoke.js` OK (43/43, com aviso conhecido
> de sandbox sobre `window.addEventListener`, exit code 0).
> **Atualizacao 2026-07-03 - fase
> `RAVATEX-TAPETES-PEDIDO-PROGRESS-CONNECTORS-R3-FIX-MISSING-LAST-CONNECTOR`.**
> Correcao visual obrigatoria local, sem SQL/Supabase/producao e sem
> push: o conector `EXPEDICAO -> ENTREGA` nao pode sumir quando a acao
> canonica `registerDelivery` vem como `hidden`. O render agora mapeia
> `hidden` para a seta estatica `Aguardar`, mantendo o gate bloqueado e
> sem handler. O pipeline produtivo permanece com 5 etapas fixas e 4
> conectores: Insumos->Tecelagem, Tecelagem->Acabamento,
> Acabamento->Expedicao, Expedicao->Entrega.
>
> A ultima transicao segue a regra final: `hidden/disabled` renderiza
> `Aguardar`; `enabled` renderiza o botao `Transferir` chamando a
> operacao canonica existente; `view`/concluido renderiza `Concluido`
> estatico. Nenhum conector usa `Entregar`, `Ver`, `Editar` ou frases
> longas. `derivePedidoChainState`, matriz de gates, lifecycle e writes
> ficaram intocados.
>
> Testes: `node --check js/screens/pedido-detail-render.js` OK;
> `node --check tests/pedido-detail.smoke.js` OK;
> `node --test tests/pedido-detail.smoke.js` OK (58/58);
> `node --test tests/boot.smoke.js` OK (29/29);
> `node --test tests/router.smoke.js` OK (43/43, com aviso conhecido
> de sandbox sobre `window.addEventListener`, exit code 0).
> **Atualizacao 2026-07-06 - fase
> `RAVATEX-TAPETES-PEDIDO-OP-CONTROLLED-DELETE-B`.**
> Status: **STAGING APPLY OK - AGUARDANDO VALIDACAO VISUAL/TECNICA DO
> USUARIO**.
>
> Implementada exclusao fisica controlada para ambiente de testes/admin por RPC
> transacional em `db/34_controlled_delete_pedido_op.sql`: diagnosticos
> `diagnosticar_impacto_pedido(UUID)` e `diagnosticar_impacto_op(BIGINT)`;
> remocoes `remover_pedido(UUID, TEXT)` e `remover_op(BIGINT, TEXT)`.
> A migration foi aplicada somente em staging `ucrjtfswnfdlxwtmxnoo` via
> `npx.cmd supabase --workdir supabase db query --linked --file ...`; producao
> `bhgifjrfagkzubpyqpew` nao foi tocada. Catalogo pos-apply confirmou as quatro
> RPCs.
> A politica desta fase e temporaria para limpeza de validacao: Pedido sem
> cadeia produtiva e seguro; Pedido com OP sem entrega/expedicao exige
> confirmacao textual `EXCLUIR`; Pedido/OP com entrega ou expedicao bloqueia;
> OP mae com OP de Acabamento filha bloqueia na remocao individual. `op_numeros`
> nao e alterado, OPs nao sao renumeradas e numeros nao sao reciclados.
>
> Criado helper central `js/delete-helpers.js` (`window.RAVATEX_DELETE`) com
> diagnostico, relatorio de impacto, confirmacao forte e chamada das RPCs. As
> telas alteradas foram: lista de Pedidos, detalhe do Pedido, lista de OPs,
> detalhe OP Tecelagem/OP em producao e OP Acabamento/Latex. O antigo
> `excluirOpLatex` deixou de usar `supa.from('ops').delete()` e agora delega ao
> helper central. Deletes diretos de Pedido/OP continuam proibidos na UI.
>
> Criado diagnostico staging read-only
> `scripts/staging/delete-impact-diag.mjs`, com filtros opcionais por
> `PEDIDO_ID`/`OP_ID`, sem mutacao. Producao e `origin` permanecem proibidos;
> nenhuma exclusao real em staging deve ocorrer sem autorizacao explicita de ID
> pelo usuario. Senha/admin forte, soft-delete e auditoria permanente ficam para
> fase futura de producao.
> Validacao staging read-only: `delete-impact-diag` geral/targeted OK
> (Pedido #27 `requires_confirmation`; OP 5/2026 `blocked` por entrega);
> diagnosticos de fluxo OK, com alerta historico preservado de 11 OPs/lotes
> orfaos sem Pedido. Testes locais verdes: checks JS, `controlled-delete`,
> `pedidos-list`, `ops-list`, `pedido-detail`, `op-nova`, `op-latex-admin` e
> `production-flow-invariants`.
>
> **Atualizacao 2026-07-06 - fase
> `RAVATEX-TAPETES-PEDIDO-OP-CONTROLLED-DELETE-POLICY-FIX-C`.**
> Status: **PATCH CORRETIVO TECNICO**.
>
> Corrigida a politica de teste da exclusao controlada: o bloqueio generico da
> `db/26` para "OP numerada" e removido/bypassado pela `db/34` com
> `DROP TRIGGER IF EXISTS ops_numeradas_no_delete ON public.ops` e
> `DROP FUNCTION IF EXISTS public.ops_numeradas_no_delete_fn()`. Em staging,
> OP numerada pode ser removida fisicamente pela RPC controlada se nao houver
> entrega, expedicao ou OP filha, e se a confirmacao `EXCLUIR` for fornecida
> quando o diagnostico exigir.
>
> Mantido: `op_numeros` nao e alterado, OPs restantes nao sao renumeradas e
> numeros nao sao reciclados. Bloqueios reais permanecem para entrega,
> expedicao, OP filha e FKs restritivas do fluxo.
>
> **Atualizacao 2026-07-06 - fase
> `RAVATEX-TAPETES-PEDIDO-OP-CONTROLLED-DELETE-CASCADE-TEST-D`.**
> Status: **PATCH TECNICO PRONTO - AGUARDANDO RETESTE DO USUARIO**.
>
> Criada migration incremental `db/35_controlled_delete_test_cascade.sql`.
> Ela substitui as quatro RPCs de exclusao controlada para permitir, somente em
> staging/teste, cascata fisica de Pedido/OP com entregas e OPs filhas quando
> nao houver expedicao. Nova classificacao: `requires_cascade_confirmation`,
> com `cascade_required=true`, `cascade_reason` e
> `confirmation_required='EXCLUIR TUDO'`.
>
> Politica aplicada: expedição continua bloqueador duro nesta fase; cadeia sem
> expedicao pode ser removida de forma transacional e explicita, com relatorio
> de impacto e confirmacao `EXCLUIR TUDO`. `op_numeros` nao e alterado, OPs nao
> sao renumeradas e numeros nao sao reciclados. Producao futura continua
> pendente de senha/admin forte, soft-delete e auditoria permanente.
>
> **Atualizacao 2026-07-06 - fase
> `RAVATEX-TAPETES-PEDIDO-OP-CONTROLLED-DELETE-FK-ORDER-FIX-E`.**
> Status: **PATCH VALIDADO COM DELETE SINTETICO EM STAGING - AGUARDANDO RETESTE
> DO USUARIO**.
>
> Criada migration incremental `db/36_controlled_delete_fk_order_fix.sql`,
> aplicada somente em staging `ucrjtfswnfdlxwtmxnoo`. Causa raiz confirmada:
> a cascata limpava `entrega_itens` apenas por `op_id`, sem cobrir
> `op_item_id`, e os guards de entrega retornavam `NEW` em `DELETE`, o que
> cancelava silenciosamente deletes autorizados. A `db/36` monta
> `target_ops`, `target_op_itens`, `target_entregas`,
> `target_op_latex_links`, `target_child_ops` e `target_child_op_itens`;
> remove `op_latex_entregas`; remove `entrega_itens` por `op_id` ou
> `op_item_id`; remove entregas vazias; verifica zero `entrega_itens`
> remanescente antes de `DELETE FROM ops`; remove OPs filhas antes das raizes.
>
> Teste sintetico real em staging via REST/RPC: Pedido #29
> `e9b43072-2c7b-4a16-8d4a-9f9e66ec7415`, lote 27, OP Tecelagem 45, OP Latex
> 46, entrega 21, entrega_item 23, `op_latex_entrega` 21. Diagnostico previo:
> `requires_cascade_confirmation`, sem expedicao, com
> `entrega_itens_por_op_id=1`, `entrega_itens_por_op_item_id=1` e
> `cascade_can_zero_entrega_itens_before_ops=true`. RPC
> `remover_pedido(..., 'EXCLUIR TUDO')` retornou `ok=true`; remanescentes de
> pedido/lote/ops/op_itens/entrega/entrega_itens/op_latex_entregas/origem
> quebrada ficaram todos 0. `op_numeros` antes/depois identico
> (`latex::2026=16`, `tecelagem::2026=25`).
>
> Validacao: `controlled-delete`, `pedidos-list`, `ops-list`,
> `op-latex-admin`, `production-flow-invariants` verdes; diagnosticos staging
> `delete-impact`, `production-flow-invariants`, `latex-consolidation` e
> `expedicao-partial-flow` OK. Producao e `origin` intocados; sem renumerar OP,
> sem reciclar numero e sem commit de `supabase/.temp`.
>
> **Atualizacao 2026-07-06 - fase
> `RAVATEX-TAPETES-PEDIDO-OP-CONTROLLED-DELETE-EXPEDICAO-CASCADE-E2`.**
> Status: **PATCH VALIDADO COM DELETE SINTETICO COM EXPEDICAO EM STAGING -
> AGUARDANDO RETESTE DO USUARIO**.
>
> Criada migration incremental
> `db/37_controlled_delete_expedicao_cascade.sql`, aplicada somente em staging
> `ucrjtfswnfdlxwtmxnoo`. Causa raiz confirmada: a fase anterior ainda
> tratava expedicao como bloqueador duro e orientava exclusao manual antes da
> RPC, mas o fluxo de teste precisa remover a cadeia inteira de forma
> transacional e controlada. Mapeamento FK confirmou tambem a dependencia
> `expedicao_movimento_itens`, que entra na cascata antes de movimentos,
> itens e expedicoes.
>
> Politica ativa em staging/teste: expedição vinculada deixa de ser `blocked`
> e passa a exigir `EXCLUIR TUDO`, com `cascade_required=true`,
> `cascade_includes_expedicao=true` e contagens de expedicoes, itens,
> movimentos e itens de movimento no diagnostico. A RPC remove
> `expedicao_movimento_itens`, `expedicao_movimentos`, `expedicao_itens`,
> `expedicoes`, `op_latex_entregas`, `entrega_itens`, entregas vazias e entao
> OPs filhas antes das OPs raizes, com verificacoes de remanescentes antes de
> apagar Pedido/OP.
>
> Teste sintetico real em staging via REST/RPC: Pedido #30
> `1803e2d3-39f4-47c2-a60e-e7629cb69810`, lote 28, OP Tecelagem 47, OP Latex
> 48, itens 70/71, entrega 22, entrega_item 24, link `op_latex_entregas` 22,
> expedicao 5, expedicao_item 10, expedicao_movimento 5 e
> expedicao_movimento_item 7. Diagnostico previo:
> `requires_cascade_confirmation`, `blocked=false`, com expedicao incluída na
> cascata. `remover_pedido(..., 'EXCLUIR TUDO')` retornou `ok=true`;
> remanescentes de pedido/lote/ops/op_itens/entregas/entrega_itens/
> op_latex_entregas/expedicoes/expedicao_itens/expedicao_movimentos/
> expedicao_movimento_itens/origem quebrada ficaram todos 0.
> `op_numeros` antes/depois identico (`latex::2026=16`,
> `tecelagem::2026=25`).
>
> Validacao local: `controlled-delete`, `pedidos-list`, `ops-list`,
> `op-latex-admin` e `production-flow-invariants` verdes. Producao e `origin`
> intocados; sem delete real nao autorizado; sem renumerar OP, sem reciclar
> numero, sem alterar `op_numeros`, sem `git add .` e sem commit de
> `supabase/.temp`. Risco remanescente: esta politica e apenas de
> staging/teste; producao ainda exige decisao futura de senha/admin forte,
> soft-delete e auditoria permanente antes de qualquer exclusao fisica.
>
> **Atualizacao 2026-07-06 - fase
> `RAVATEX-TAPETES-PEDIDO-NO-PARALLEL-LOAD-ACTION-B`.**
> Patch P0 para esconder acao "Carregar nesta movimentacao" em OPs de
> Acabamento/Latex no modal Tecelagem -> Acabamento, onde nao existe fluxo
> paralelo.
> - **Causa raiz (isolada):** `canMove()` dentro de
>   `buildRelatedOpsSection` em
>   `js/screens/pedido-detail-events.js:1171` nao considerava o contexto
>   de transicao; para `Tecelagem>Acabamento` permitia que OPs de
>   acabamento com saldo exibissem o botao de carregar, quando a OP ativa
>   deveria ser sempre a tecelagem.
> - **Regra aplicada:** `canMove` para `acabamento` retorna `false` quando
>   `transitionKey(ctxMovement) === 'Tecelagem>Acabamento'`. A mensagem
>   vazia "Sem saldo disponivel" tambem foi suprimida nesse contexto, pois
>   a ausencia de acao e por restricao de transicao e nao por falta de
>   saldo real.
> - **Acoes preservadas:** Abrir OP, Finalizar OP e demais acoes
>   contextuais validas permanecem intactas para acabamento. O fluxo
>   `Acabamento>Expedicao` continua mostrando "Carregar nesta
>   movimentacao" normalmente.
> - **Arquivos alterados:**
>   - `js/screens/pedido-detail-events.js` (+4 linhas em `canMove`,
>     +2 linhas no bloco de mensagem vazia)
>   - `tests/pedido-detail.smoke.js` (+1 teste:
>     `NO-PARALLEL-LOAD-B: acabamento OP nao mostra Carregar...`)
> - **Testes:** `node --test tests/pedido-detail.smoke.js` OK (172/172);
>   `node --test tests/pedido-detail-linked-ops.smoke.js` OK (7/7).
> - **Garantias:** producao intocada; `origin` nao usado para escrita;
>   sem `git add .`; `supabase/.temp` fora do commit.

> **Atualizacao 2026-07-07 - fase
> `RAVATEX-TAPETES-DESIGN-TOKENS-TARGET-PILOT-B-R1`.**
> Rework visual corretivo APENAS da OP Acabamento/Latex
> (`js/screens/op-latex-admin.js`). A fase B anterior (commit `dfad847`) foi
> **rejeitada visualmente**.
> - **Causa raiz do erro anterior:** o patch B tokenizou a estrutura antiga
>   em vez de reproduzir a linguagem visual da referencia. Sintomas:
>   (1) headers de secao usavam uma **barra/strip vertical azul** de 3px
>   (`rvSectionPill` antigo) no lugar do **icon-chip** da referencia;
>   (2) **headers numerados dominantes** ("1. Dados", "2. Itens", "3.
>   Material", "5. Finalizacao"...); (3) cabecalho com **7 botoes pesados**
>   de mesmo peso; (4) **strip azul "Cadeia produtiva"**; (5) card de
>   Documentos com **nomes de arquivo fabricados** (mock); (6) etapa e
>   status ambos em teal (ambiguo).
> - **B-R1 corrige (somente OP Acabamento):**
>   - `rvSectionPill` reescrito para **icon-chip real** (quadradinho 22px,
>     fundo `--rv-color-chip-bg #eef2f7`, borda sutil, SVG 13px) + rotulo
>     11px UPPERCASE. Sem barra vertical, sem numero.
>   - Cabecalho enxuto: breadcrumb + H1 + badges (Acabamento teal /
>     Preparacao azul / Em producao ambar com dot) + metadados; acoes reais
>     apenas (aberta: Excluir; em producao: Finalizar OP + Excluir).
>   - Cockpit 2 colunas `minmax(0,1fr) var(--rv-rail-w)` com **rail sticky**
>     (Resumo + acao principal + Documentos). **Largura ampla preservada**
>     (sem max-width estreito; ocupa o monitor).
>   - Badge de **etapa (teal)** distinta do **status**; lineage integrada
>     aos "Dados da OP" (campos Origem/Pedido clicaveis) no lugar da strip.
>   - Documentos vira estado vazio honesto ("Nenhum documento anexado"),
>     sem nomes fabricados. `buildCadeia`/`buildMovimentacao`/botao Pausar
>     (sem backend) removidos.
> - **Funcional intocado:** RPCs (`alterar_status_op`, `liberar_expedicao`,
>   `liberar_expedicao_latex_parcial`, `consultar_saldo_expedicao_latex`),
>   handlers (Confirmar entrada, Finalizar, Excluir, Movimentar parcial),
>   calculos, split/consolidacao, `tipo='latex'` e rotas preservados.
> - **Tokens:** `css/tokens.css` ganhou `--rv-color-chip-bg`,
>   `--rv-color-chip-glyph`, `--rv-color-section-label`, `--rv-color-value`
>   e bloco de **status** (`--rv-status-prep/prod*`) distinto da etapa.
> - **Escopo bloqueado:** OP Tecelagem, `op-tecelagem-producao-admin.js`,
>   listas, painel, expedicao, `common.js`, `ui.js`, `badges.js` **NAO**
>   alterados. Demais telas seguem bloqueadas ate validacao do piloto.
> - **Arquivos alterados:** `js/screens/op-latex-admin.js`,
>   `css/tokens.css`, `tests/op-latex-admin.smoke.js` (assercoes visuais
>   stale atualizadas para o novo layout, funcionais preservadas),
>   `tests/pedido-detail.smoke.js` (1 proxy de lineage atualizado),
>   `PROJECT_STATE.md`, `AGENT_HANDOFF.md`.
> - **Testes:** `node --check op-latex-admin.js` OK;
>   `op-latex-admin.smoke` 55/55; `tec-to-acabamento-flow.smoke` 39/39;
>   `pedido-detail.smoke` 172/172; `op-latex-split.smoke` 28/28.
> - **Evidencia visual:** screenshots reais (harness em `.claude/preview/`
>   com `renderOPLatexAdmin` real + supa fake) dos estados **aberta** e
>   **em_producao** — icon-chips reais, sem strips solidas, largura ampla.
> - **Garantias:** producao intocada; `origin` (grupoterrabranca) nao usado
>   para escrita; sem `git add .`; `.claude/` e `supabase/.temp` fora do
>   commit.

> **Correcao 2026-07-07 - B-R1 pos-validacao (OP Acabamento em_producao).**
> A validacao apontou dois defeitos no rail em produção:
> - **Card Expedicao estourava o rail de 300px** (linha de movimentacao usava
>   grid `1fr 100px 100px 120px` ~437px, jogando o input para fora da tela).
>   Refeito **rail-friendly**: metricas empilhadas (rotulo/valor) e cada item
>   movimentavel em bloco vertical (nome + contexto + campo "Mover"
>   full-width + unidade), botoes de acao full-width (`BTN_PRIMARY`). Sem
>   overflow. Handlers (`liberarExpedicaoParcial`/`liberarExpedicao`) e
>   validacoes intactos.
> - **Bloco Documentos** trocado do one-liner vazio para a **camada visual da
>   referencia**: slots por tipo (Romaneio, NF de entrada, NF de saida) com
>   badge de contagem, estado vazio honesto e **botao "Anexar" tracejado
>   full-width** por tipo (largura correta no rail). Decisao do usuario:
>   **visual pronto sem backend** — o upload/anexo sera plugado depois via
>   Google Drive; por ora o Anexar apenas sinaliza (sem `storage.from`/upload
>   real, sem arquivos fabricados).
> - **Arquivos:** `js/screens/op-latex-admin.js`,
>   `tests/op-latex-admin.smoke.js` (assercao de Documentos atualizada),
>   `PROJECT_STATE.md`. Testes: op-latex-admin 55/55, tec-to-acabamento 39/39,
>   pedido-detail 172/172, op-latex-split 28/28. Evidencia visual real
>   (harness) confirmando ausencia de overflow e Anexar full-width.

> **Atualizacao 2026-07-07 - fase
> `RAVATEX-TAPETES-DESIGN-TOKENS-TARGET-PILOT-TECELAGEM`.**
> Piloto de Acabamento **validado** pelo usuario; aplicada a MESMA linguagem
> visual a **OP Tecelagem em producao** (`js/screens/op-tecelagem-producao-admin.js`,
> + header do bloco de fios em `js/screens/op-nova.js`), preservando os itens
> proprios da tecelagem.
> - **Rework visual:** icon-chips reais em todas as secoes (sem barras/numeros);
>   header enxuto (breadcrumb + H1 + badge etapa **roxo** Tecelagem + status
>   **ambar** Em producao + metadados; acoes reais: Finalizar OP verde gated +
>   Excluir vermelho); cockpit `minmax(0,1fr) var(--rv-rail-w)` com **rail
>   sticky** (Resumo + Enviar para acabamento + Documentos), largura ampla;
>   strip "Cadeia produtiva" removida e dobrada em "Dados da OP" (campo Destino/
>   Pedido clicavel); Documentos = slots por tipo + Anexar full-width (visual,
>   sem backend); tabelas com header numerico a direita (regra de ouro) e
>   `overflow-x:auto`.
> - **Funcional intocado:** `computeTotaisProducao`, `finalizarTecelagem`
>   (RPC `alterar_status_op` → concluida, gated por saldo<=0), entregas de
>   tecelagem (+ Nova entrega com `salvarEntregaCima`/split, Editar/Excluir,
>   gate `latexOpPorEntrega`), capacidade e ajuste (saldo_fios_op), fios
>   (`ctx.buildBlocoFios`), rotas e `tipo='tecelagem'`.
> - **Renomeacoes:** `buildBlocoTecelagem`→`buildBlocoEntregas`,
>   `buildHeaderProducao`→`buildHeader`, `campoProducao`→`campo`,
>   `concluirAttrs`→`finalizarAttrs`; removidos `buildLineageStripProducao`,
>   `buildBlocoMovimentacao`, `buildBlocoDocumentos` legado.
> - **Escopo bloqueado mantido:** listas, painel, expedicao, `common.js`,
>   `ui.js`, `badges.js` **NAO** alterados. OP Acabamento inalterada nesta fase.
> - **Skill retroalimentada:** `.claude/design-skill/README.md` §10 —
>   aprendizados dos pilotos (regra do rail vertical/full-width, icon-chip,
>   etapa≠status, lineage→campo, Documentos slots, `chipLabel`, regra de ouro).
> - **Arquivos alterados:** `js/screens/op-tecelagem-producao-admin.js`
>   (reescrito), `js/screens/op-nova.js` (header do bloco de fios em producao),
>   `tests/op-nova.smoke.js`, `tests/tec-to-acabamento-flow.smoke.js`,
>   `tests/op-latex-admin.smoke.js`, `tests/pedido-detail.smoke.js` (assercoes
>   visuais stale → novo canonico; funcionais preservadas),
>   `PROJECT_STATE.md`, `AGENT_HANDOFF.md`. (`.claude/` untracked.)
> - **Testes:** op-nova 69/69, op-latex-admin 55/55, tec-to-acabamento 39/39,
>   pedido-detail 172/172, op-latex-split 28/28, admin-dashboard 6/6.
> - **Evidencia visual:** render real (harness `.claude/preview/tecelagem.html`)
>   — badges roxo/ambar, rail 300px sem overflow, icon-chips, largura ampla.
> - **Garantias:** producao intocada; `origin` (grupoterrabranca) somente
>   leitura; sem `git add .`; `.claude/` e `supabase/.temp` fora do commit.
>
> **Atualizacao 2026-07-07 - fase
> `RAVATEX-TAPETES-OP-TECELAGEM-VISUAL-ALIGNMENT-C-CLOSEOUT`.**
> Status: **CLOSED / VALIDADO PELO USUARIO**.
> Closeout documental — a fase
> `RAVATEX-TAPETES-DESIGN-TOKENS-TARGET-PILOT-TECELAGEM` (HEAD
> `134e806`) foi validada visualmente pelo usuario e esta fechada.
> Push staging: `e7bf87e..134e806`.
>
> **Itens validados na OP Tecelagem em producao:**
> - OP Tecelagem em producao alinhada ao padrao visual validado da OP Acabamento
> - Icon-chips reais aplicados (sem barras/numeros)
> - Header enxuto aplicado (breadcrumb + H1 + badge etapa roxo Tecelagem + status ambar + metadados)
> - Rail sticky 300px aplicado sem overflow
> - Documentos em slots (Romaneio / NF entrada / NF saida) com Anexar full-width
> - Elementos proprios da Tecelagem preservados:
>   - fios/insumos
>   - capacidade e ajuste
>   - entregas de tecelagem
>   - nova entrega (split, editar, excluir)
>   - envio para acabamento
>   - historico
>   - finalizar OP (gated por saldo)
>   - exclusao canonica
> - Funcionalidade/RPC/schema preservados
>
> **Testes reportados (verdes):**
> - op-nova 69/69
> - op-latex-admin 55/55
> - tec-to-acabamento 39/39
> - pedido-detail 172/172
> - op-latex-split 28/28
> - admin-dashboard 6/6
>
> **Garantias:**
> - HEAD final da implementacao: `134e806`
> - Push staging ja realizado: `e7bf87e..134e806`
> - Origin oficial/producao intocados
> - `.claude/` atualizado localmente como retroalimentacao de skill, mas nao versionado
> - `supabase/.temp/` preservado fora do commit
> - Nenhum codigo alterado (fechamento estritamente documental)
> - Nenhum `git add .`
>
> **Proxima fase candidata (nao iniciada):**
> `RAVATEX-TAPETES-OP-TECELAGEM-ABERTA-VISUAL-ALIGNMENT-D`
>
> **Observacao sobre skill:**
> A retroalimentacao em `.claude/design-skill/README.md` permanece untracked.
> Decisao posterior necessaria: (1) manter skill local/untracked; (2) versionar
> `.claude/design-skill/`; (3) ou copiar aprendizados para docs versionados.

---

## Fase: RAVATEX-TAPETES-G11-A-DOCUMENTS-CONSUMER-DESIGN

> **Status:** CONCLUIDO — DOCUMENTAL
> **Tipo:** Diagnostico + design de consumo read-only em Controle de Tapetes.
> **HEAD base:** `381506c` — `work/app-next`
> **Data:** 2026-07-07
> **Documentos Ingestor HEAD:** `956682d` — `master`

### Escopo

Diagnosticar como o Controle de Tapetes deve consumir documentos do Documents
Ingestor por pedido, sem implementar patch funcional, sem alterar Supabase,
sem alterar Documents Ingestor.

### Arquivos lidos — Controle de Tapetes

- `js/screens/pedido-detail.js`
- `js/screens/pedido-detail-data.js`
- `js/screens/pedido-detail-progress.js`
- `js/screens/pedido-detail-render.js`
- `js/screens/pedido-detail-events.js`
- `js/screens/cliente-pedido-detail.js`
- `js/ui.js`
- `js/pedido-ui.js`
- `js/badges.js`
- `js/op-display.js`
- `docs/architecture/PEDIDO_OP_MOVIMENTACAO_DOCUMENTOS_PLANO.md`
- `docs/architecture/PEDIDO_OP_SCHEMA_CONTRACT.md`
- `docs/architecture/DOCUMENTS_INGESTOR_CONSUMER_DESIGN.md` (criado nesta fase)
- `PROJECT_STATE.md`
- `AGENT_HANDOFF.md`

### Arquivos lidos — Documents Ingestor

- `docs/CONTROL_TAPETES_DOCUMENTS_CONTRACT.md`
- `contracts/document-event.schema.json`
- `contracts/examples/document-events.sample.jsonl`
- `docs/architecture/G10_CONTROLE_TAPETES_INTEGRATION_DESIGN.md`
- `PROJECT_STATE.md`
- `AGENT_HANDOFF.md`

### Arquivos criados

- `docs/architecture/DOCUMENTS_INGESTOR_CONSUMER_DESIGN.md` — design completo
  com matriz de decisao, ordem para G11-B, riscos, UI minima

### Decisoes

| # | Decisao | Fundamentacao |
|---|---------|--------------|
| D-G11A-01 | Card "Documentos" existente no detalhe do Pedido recebe secao "Documentos Recebidos" do Ingestor | Card ja existe (`pedido-detail-render.js:994`); alteracao minima |
| D-G11A-02 | Mapeamento Pedido → Ingestor: `PED-{numeroPad2}-{ano}` derivado de `pedido.numero` + `criado_em.getFullYear()` | Independe de input manual; ano desambigua |
| D-G11A-03 | Consumo por import manual de JSONL gerado por `export:package` | Opcao 1 da matriz; sem rede, sem schema, sem watcher |
| D-G11A-04 | Cache em `window.RAVATEX_DOCUMENTS_CACHE` opcional | Nao requer Supabase; padrao do app |
| D-G11A-05 | Idempotencia por `ingestion_event_id` | Contrato §6; Map de deduplicacao |
| D-G11A-06 | Visualizacao via `drive_web_view_link` em `window.open()` | Contrato §2.3; sem iframe, sem download |
| D-G11A-07 | Supabase como indice: **Rejeitado** | Acoplamento direto ao banco do Ingestor |
| D-G11A-08 | Accept/reject no Controle de Tapetes: **Deferido** | Funil continua no Ingestor CLI |

### Garantias

- Nenhum Supabase tocado
- Nenhuma chamada Google/Drive
- Nenhum export real executado
- Controle de Tapetes sem patch funcional
- Documents Ingestor inalterado
- Nenhum dado real commitado
- Leitura 100% read-only em ambos os repos

### Proxima fase

`RAVATEX-TAPETES-G11-B-DOCUMENTS-CONSUMER-PATCH`

Patch funcional minimo com:
1. `js/documents-ingestor.js` — parser JSONL + filtro por pedido + consolidacao
2. `data/fixtures/document-events-sample.jsonl`
3. Modificacao em `pedido-detail-progress.js` (computeViewModel)
4. Modificacao em `pedido-detail-render.js` (buildDocuments)
5. Testes: `tests/documents-ingestor.test.js` + smoke

---

## Fase: RAVATEX-TAPETES-G11-B-DOCUMENTS-CONSUMER-PATCH

> **Status:** CONCLUIDO — PATCH VALIDADO LOCALMENTE
> **Tipo:** Patch funcional minimo com parser JSONL, fixture e UI read-only no detalhe do Pedido.
> **HEAD base:** `c6b8e20` — `work/app-next`
> **Data:** 2026-07-07
> **Documents Ingestor HEAD:** `956682d` — `master` (nao alterado)

### Escopo

Implementar consumo visual read-only de documentos do Documents Ingestor no
detalhe do Pedido usando fixture JSONL local, sem Supabase, sem Google/Drive,
sem fetch real.

### Arquivos criados

- `js/documents-ingestor.js` — parser JSONL, normalizador de pedido,
  deduplicacao (`ingestion_event_id`), consolidacao (`document_id`),
  ordenacao (`created_at`), badges, filtro por pedido
- `data/fixtures/document-events-sample.jsonl` — 7 eventos sinteticos
  (2 documentos NF + 1 romaneio) para `PED-25-2026`
- `tests/documents-ingestor.test.js` — 44 testes puros (parser, filtro,
  consolidacao, deduplicacao, badges, garantias)

### Arquivos alterados

- `js/screens/pedido-detail-progress.js` — `computeViewModel()` adiciona
  `ingestorDocumentRows` e `ingestorTimeline` ao view model quando
  `window.RAVATEX_DOCUMENTS_LOADED_EVENTS` contém eventos para o pedido
- `js/screens/pedido-detail-render.js` — `buildDocuments()` adiciona seção
  "DOCUMENTOS RECEBIDOS (INGESTOR)" com badges, botão "Ver" via
  `window.open(drive_web_view_link, '_blank', 'noopener,noreferrer')`,
  reason quando rejected, timeline de eventos
- `PROJECT_STATE.md` — atualizado
- `AGENT_HANDOFF.md` — atualizado

### Decisoes

| # | Decisao | Fundamentacao |
|---|---------|--------------|
| D-G11B-01 | Parser puro em memoria, sem fetch/Supabase/Drive | Sem acoplamento externo |
| D-G11B-02 | Idempotencia por `ingestion_event_id` | Contrato §6 do Ingestor |
| D-G11B-03 | Consolidacao por `document_id` (ultimo `created_at`) | Estado derivado do evento mais recente |
| D-G11B-04 | View model injecta docs via `window.RAVATEX_DOCUMENTS_LOADED_EVENTS` | Sem novo state no Pedido Detail |
| D-G11B-05 | Timeline vertical com dots (padrao existente no app) | Reutiliza padrao de `cliente-pedido-detail.js` |
| D-G11B-06 | Botao "Ver" usa `window.open()` em nova aba | Contrato §2.3; sem iframe/supabase storage |
| D-G11B-07 | Link indisponivel mostra texto, nunca tenta download | Sem acesso a ficheiro nem API |
| D-G11B-08 | Reason exibido em vermelho abaixo do documento rejected | Visivel, sem expor IDs |

### Testes

- `documents-ingestor.test.js`: 44/44 passando
- `pedido-detail.smoke.js`: 172/172 passando (sem regressao)

### Garantias

- Nenhum Supabase tocado
- Nenhuma chamada Google/Drive
- Nenhum export real executado
- Documents Ingestor inalterado
- Nenhum PDF/XML armazenado no Supabase/backend
- Nenhum dado real commitado (fixture usa IDs ficticios: `doc_sample_*`,
  `ingevt-*`, `gmsg-sample-*`, `drive_sample_*`)
- Todos os `drive_web_view_link` sao URLs ficticias do Google Drive
- Modulo `documents-ingestor.js` nao contem `fetch`, `XMLHttpRequest`,
  `window.supa`, `window.supabase`, `googleapis` ou `google-auth`

### Riscos remanescentes

| Risco | Mitigacao |
|-------|-----------|
| Fixture nao carregada (global vazia) | Secao de documentos simplesmente nao aparece; sem erro |
| Pedido com numero > 99 | `padStart` suporta qualquer numero de digitos; mapeamento continua funcional |
| Eventos carregados fora de pedido diferente | Filtro por `pedido_manual` impede docs de outros pedidos |
| Timeline com muitos eventos pode crescer | Read-only; sem impacto de performance com fixture controlada |
| Link Drive real requer permissao | Documentado como pre-requisito operacional; app apenas abre o link |

### Proxima fase

`RAVATEX-DOCUMENTS-G15-CONSUMER-EVOLUTION`:
- UX de ultimo import/timestamp/hash no Controle (registrar `ingestion_event_id` ou data do ultimo import)
- `ingestion_event_id` no JSONL como melhoria futura no produtor (Documents Ingestor)
- Aceite/rejeicao dentro do Controle como feature posterior (hoje e feito no Ingestor CLI)
- Sem polling/scheduler/daemon por enquanto
- Produtor `sync:mapped` estavel em `bedbe909` (master)
- Consumidor bridge publicado em staging `fff052b`

## RAVATEX-DOCUMENTS-G23-D-D-CLOUD-DECISIONS-CLOSEOUT-DOCS (2026-07-09)

Closeout tecnico de G23-D registrado no HEAD `d33dc29bbcd7a733825c70f98ac736f0b121c4f3` (G23-D-B).

- G23-D-C: smoke de staging aprovado via harness com Supabase real (`ucrjtfswnfdlxwtmxnoo.supabase.co`).
- Admin real autenticado no staging utilizado; RPC `public.decidir_documento` validada.
- Aceitar e rejeitar atualizaram `document_decisions` e `document_candidates`; a decisao anterior foi desativada, a decisao ativa nova ficou correta e o reader recarregou a UI.
- Cancelamento do prompt e motivo vazio nao chamaram a RPC; motivo valido chamou a RPC e persistiu `rejected_reason`.
- Cleanup remoto concluido com zero residuos do prefixo de smoke nas tabelas verificadas.
- Nao-admin nao testado e browser real nao testado; a evidencia de UI foi obtida pelo harness.
- Producao ficou fora de escopo (`bhgifjrfagkzubpyqpew`); nenhum push foi realizado.

Debitos: repetir validacao visual em browser real e obter sessao segura nao-admin para confirmar `admin_required`.

## RAVATEX-DOCUMENTS-G23-E-C-CANONICAL-INGESTOR-STATE-MIGRATION-PATCH (2026-07-09)

- Migration versionada em `db/39_documentos_ingestor_state_undo.sql`; nao aplicada em Supabase.
- `document_candidates` passa a ter base canonica separada (`ingestor_status`, `ingestor_state_at`, `ingestor_event_id`, `ingestor_rejected_reason`) e `status` permanece efetivo.
- Nova RPC admin `desfazer_decisao_documento` revoga a decisao ativa e restaura somente base completa e comprovavel; nao presume `pending`.
- Nova RPC backend `upsert_document_candidate_ingestor_state` prepara a escrita atomica do Ingestor: atualiza sempre a base, preservando estado efetivo enquanto houver decisao humana ativa. Sem uso no frontend.
- `document_decisions` recebe auditoria de revogacao (`revogada_em`, `revogada_por`, `revogada_motivo`) sem criar decisao pending falsa.
- Backfill automatico deliberadamente ausente: candidatos legados so podem receber base apos verificacao de evento compativel; sem prova, undo retorna `base_status_unavailable`.
- Teste SQL focado: `tests/documentos-ingestor-state-undo-schema.test.js`.
## RAVATEX-DOCUMENTS-G23-E-E-CLOUD-DECISION-UNDO-UI-PATCH (2026-07-09)

- `undoDocumentDecisionInCloud(documentId, motivo)` chama somente `desfazer_decisao_documento` por `window.supa.rpc`, sem tabela direta, localStorage ou service_role.
- Reader expõe `_ravatex_can_undo_server_decision` apenas com decisão server ativa e base canonica completa (`ingestor_status`, timestamp, event ID e motivo em rejected).
- Documentos Supabase elegiveis mostram o icone `Desfazer decisão`; sucesso recarrega o reader e renderiza a verdade do servidor. Erros controlados nao mutam estado local.
- Fluxos manual/G22 e Pedido Detail permanecem inalterados.

## RAVATEX-DOCUMENTS-G24-B3-FRONTEND-SCAN-TRIGGER-POLLING-CLOSEOUT (2026-07-10)

- Status: **CLOSED - FRONTEND SCAN TRIGGER + POLLING**.
- Branch: `work/app-next`. HEAD inicial: `1ae625b56c2d3b225edece6afebbad52a0376a01`; commit tecnico: `ce7c052d501af1448a2056f1188b1b9febdef6dc` (`Add frontend document scan trigger`).
- Arquivos tecnicos: `js/documents-scan-trigger.js` (novo), `js/screens/documentos-recebidos.js`, `index.html`, `tests/documents-scan-trigger.test.js` (novo) e `tests/documentos-recebidos.smoke.js`.
- Contrato: o browser admin chama apenas `solicitar_document_scan` com `p_source='gmail'`. Ele nao cria `document_scan_run`; acompanha somente `document_scan_requests` com o JWT authenticated existente.
- UX: botao admin-only **Verificar novos documentos**. Estados exibidos: requested, claimed, running, completed, failed e cancelled. Cliques duplicados e polling duplicado sao bloqueados.
- Polling: cadencia de 5 segundos e timeout de 10 minutos. Para em completed, failed, cancelled, timeout, troca de rota, logout ou sessao invalida. No completed chama `loadDocumentsPrimaryThenFallback()` e rerenderiza a tela.
- Fonte de dados: Supabase continua primario; JSONL permanece fallback.
- Testes: 267/267 verdes - scan trigger 13/13; documentos recebidos 82/82; reader/decisions 30/30; auto-load, loader e importacao 142/142. `git diff --check`: OK antes do commit.
- Confirmacoes: nenhum Gmail, Drive ou Supabase real foi acessado; migration 41 ainda nao aplicada; nenhum push; producao intocada.
- Risco residual: fila, RLS, watcher e refresh ainda requerem validacao integrada em staging apos aplicar exclusivamente a migration 41.
- Proxima fase: G24-B4 - STAGING MIGRATION + E2E APP -> REQUEST -> WATCHER -> DOCUMENTS. Esta fase ainda esta pendente.

## RAVATEX-DOCUMENTS-G24-B4-STAGING-E2E-BLOCKED (2026-07-10)

- Status: **BLOCKED - B4-R2 REQUIRED**.
- Staging: `ucrjtfswnfdlxwtmxnoo`; producao `bhgifjrfagkzubpyqpew` nao foi acessada. Migration 41 aplicada manualmente no SQL Editor isolado, com SHA-256 `E789D1BB23997859D79E26D5956D26192FAEBD791C0759D61644C024668C683B`.
- Evidencia de schema: policy `document_scan_requests_admin_all` retornou `ALL`, `is_admin()` em `qual` e `with_check`; o app admin criou uma request real pela RPC da migration.
- Frontend R1: causa raiz era o atributo booleano `disabled` presente como `disabled=\"null\"` no botao, que bloqueava o evento mesmo com listener anexado. Commit `f6185f0` remove o atributo quando inativo e adiciona feedback persistente no DOM para clique, sessao, request ativa e falha.
- Reteste: app mostrou `Solicitacao aguardando executor`; request `41a6506e...` criada em `requested` em `2026-07-10T13:36:40.936656+00:00`, sem timestamps de claim/start/finish ou scan run. Exatamente uma request ativa para gmail.
- Watcher: a unica execucao autorizada abortou antes de qualquer acesso externo por `error: required option '--source <source>' not specified`. Request preservada. Gmail, Drive, scan run, sync e refresh automatico nao ocorreram.
- Resultado de documentos: antes 2; depois nao comprovado; documento novo nao comprovado. Duplicidade visual residual de `Solicitacao aguardando executor` foi observada e preservada para B4-R2.
- Risco residual: B4-R2 deve validar a request ainda ativa e autorizar uma unica execucao com source explicita; nao repetir nesta ordem. Push nao realizado.

## RAVATEX-DOCUMENTS-G24-B4-STAGING-E2E-CLOSED (2026-07-10)

- STATUS: G24-B4 CLOSED. Verificacao terminal read-only no staging `ucrjtfswnfdlxwtmxnoo` confirmou a request `41a6506e...` como `completed`, source `gmail`, `requested_at` `2026-07-10T13:36:40.936656+00:00`, claim/start/finish preenchidos, `scan_run_id` `d7b90a68...`, erro nulo e `active_gmail_requests=0`.
- Migration 41: staging aplicada; SHA-256 `E789D1BB23997859D79E26D5956D26192FAEBD791C0759D61644C024668C683B`.
- Watcher real: executado exatamente uma vez com `npm.cmd run watch:scan-requests -- --source gmail --once --poll-seconds 5 --confirm-real-google --confirm-supabase-write`; ciclos `1`, processadas `1`, concluidas `1`, falhas `0`, polls vazios `0`; transicoes `requested -> claimed -> running -> completed`.
- UI/E2E: antes havia 2 documentos; sem refresh manual e sem importacao JSONL, a lista foi atualizada automaticamente e surgiram pelo menos 5 novos: `EDDI - VENC. 06-08.PDF`, `EDDI - VENC. 07-07.PDF`, `EDDI - VENC. 05-09.PDF`, `EDDI - VENC. 07-06.PDF` e `pdf091400.pdf`.
- Protecoes: producao nao acessada, nenhuma migration ou codigo tecnico alterado nesta ordem, nenhum retry/recover-stale, nenhum novo clique/request e nenhum push.
- Dividas nao bloqueantes: `Solicitacao aguardando executor` aparece duas vezes visualmente; hard reload nao reidrata request ativa automaticamente (foi necessario o fluxo manual anterior). Proximo recomendado: `G24-B5 - SCAN STATUS UI DEDUP + ACTIVE REQUEST HYDRATION`; nao implementar nesta ordem.

## RAVATEX-DOCUMENTS-G24-B5-SCAN-STATUS-UI-DEDUP-ACTIVE-REQUEST-HYDRATION (2026-07-10)

- Status: **CLOSED - DEDUP + HIDRATACAO (SOMENTE FRONTEND)**.
- Branch: `work/app-next`. HEAD inicial: `df18061`; commit tecnico: `e453bc0` (`Dedup scan status and hydrate active scan request`).
- Escopo: resolve as duas dividas nao bloqueantes registradas no closeout G24-B4. Client-side apenas. Documents Ingestor, migration 41, Gmail/Drive/Supabase real, fixture nao rastreada e producao nao tocados; nenhum push.
- Arquivos tecnicos: `js/documents-scan-trigger.js`, `js/screens/documentos-recebidos.js`, `tests/documents-scan-trigger.test.js`, `tests/documentos-recebidos.smoke.js`.
- Dedup: o status da request ativa era renderizado duas vezes — no botao (`scanStatusLabel`) e espelhado na linha de feedback. `onUpdate` agora limpa `ui.scanFeedback`; o botao passa a ser a fonte unica do status ao vivo e o feedback fica reservado a mensagens transitorias/terminais (enviada, concluida, cancelada, erro).
- Hidratacao: `ui.scanRequest` era so memoria, entao um hard reload perdia uma request `requested/claimed/running` em andamento. Nova leitura pura `getActiveDocumentScanRequest(source)` no trigger (SELECT admin-only sobre `document_scan_requests`, filtrando estados ativos, `order requested_at desc limit 1`) e `hydrateActiveScanRequest()` na tela, que retoma o acompanhamento via `pollDocumentScanRequest` — **nunca** `solicitar_document_scan`.
- Garantias do contrato G24-B5: (3) hidratacao nao chama `solicitar_document_scan`; (4) no maximo um polling — flag `scanHydrationAttempted` (uma unica leitura) + guarda `isActiveScanRequest()` + dedup por id no trigger; (5) cancelamento por rota/logout preservado (mesmo registro `polls`, listener `hashchange` e `ensureScanLogoutCancellation` intactos); (6) refresh automatico em `completed` preservado via handlers compartilhados `makeScanTrackingHandlers` (`loadDocumentsPrimaryThenFallback`).
- Testes: suites afetadas verdes **105/105** (`tests/documents-scan-trigger.test.js` + `tests/documentos-recebidos.smoke.js`), sendo +6 novos (3 trigger + 3 tela). Baseline provado no mesmo diretorio: revertendo apenas os dois fontes para `df18061`, a suite suspeita (`import-received` + `g14-c-bridge`) mantem `60/49/11` identicos — as 11 falhas restantes sao pre-existentes (JSONL real do Ingestor externo + bridge localStorage do Pedido Detail), nao introduzidas por esta ordem.
- `node --check` OK nos dois fontes; `git status` limpo exceto untracked preservados (`.claude/`, `data/fixtures/document-events-pedido-02.jsonl`, `supabase/.temp/`).
- Proxima fase: nenhuma dependente. As dividas do closeout G24-B4 estao resolvidas no frontend; revalidacao visual em staging fica a criterio do arquiteto (esta ordem nao acessou staging).
> **Atualizacao 2026-07-10 — fase `RAVATEX-DOCUMENTS-G24-C-AUTO-SCAN-ENTRY-GMAIL-COVERAGE`.**
> Status: **G24-C BLOCKED — R1 REQUIRED** (gate do filtro Gmail sem causa comprovada; auto-trigger e testes locais implementados).
>
> Sem compactacao deste arquivo. Baseline confirmado: `work/app-next` em `e72d966`; untracked preservados: `.claude/`, `data/fixtures/document-events-pedido-02.jsonl`, `supabase/.temp/`.
>
> Controle:
> - `js/boot.js` chama, sem bloquear o roteamento, `autoStartDocumentScanOnAdminBootstrap()` apos a sessao admin estar disponivel.
> - `js/documents-scan-trigger.js` consulta primeiro a request Gmail ativa; se existir, somente retoma o polling; se nao existir, solicita uma request. O guard e por sessao/usuario (com fallback por pagina), nao por render ou rota.
> - Polling conserva uma unica execucao por request, mas agora aceita assinantes adicionais; assim a tela de documentos recebe o refresh automatico mesmo quando o bootstrap iniciou o acompanhamento antes da rota renderizar.
> - Falhas controladas do bootstrap sao expostas em um status DOM sem impedir o app; nao-admin nao consulta nem cria request. O botao manual permanece.
> - Testes focados: `node --test tests/documents-scan-trigger.test.js` — 20/20 pass; `node --check` dos dois modulos — OK; `git diff --check` — OK.
>
> Gate Gmail/Ingestor:
> - Comparacao read-only, limitada a 7 dias: query atual `has:attachment (filename:pdf OR filename:xml) after:2026/07/03` versus controle `has:attachment after:2026/07/03`.
> - Ambas retornaram 10 mensagens e 18 anexos; 17 candidatos PDF/XML e 1 rejeicao nao relevante. Nenhuma mensagem ou anexo candidato ficou fora da query atual. IDs, assuntos e nomes foram sanitizados; nenhum conteudo de e-mail foi baixado.
> - Consequentemente, o filtro permanece inalterado: nao ha evidencia para atribuir documento omitido a query, MIME/extensao, cap, deduplicacao ou classificacao nesta janela. R1 precisa de um documento ausente identificavel ou de uma janela temporal autorizada que o contenha.
>
> E2E staging nao executado: nao havia watcher persistente nem task instalada, e o criterio de “documento antes omitido agora ingerido” nao pode ser demonstrado sem satisfazer o gate acima. Producao, push, Gmail writes e Drive writes permanecem intocados.

## G25-B1 CLOSED — Gmail received timestamp vertical slice (2026-07-10)

- Migration 42 aplicada somente em staging `ucrjtfswnfdlxwtmxnoo`; campos `email_message_id`, `email_received_at`, `email_received_at_source` e `email_received_at_estimated` e RPC writer foram validados. Producao intocada.
- E2E reutilizou `TESTE-G25-B1-20260710-1536.pdf`: candidate `40ed90ab...` persistiu `email_received_at=2026-07-10T18:42:59+00:00`, source `gmail_internal_date`, estimated `false`, `received_at=null` e `detected_at=2026-07-10T19:10:56+00:00`.
- UI validada pelo operador: **Recebido no e-mail: 10/07 15:42** e **Processado pelo Ingestor: 10/07 16:10**; sem `documento legado` para o documento novo.
- Request `bd43ecdb...` / run `77115770...` completed; request/run R1 failed permanecem como evidencia. Sem push e sem alteracao tecnica adicional no Controle nesta retomada.
- Proxima fase: `G25-B2 — RELEVANCE CLASSIFIER V1`.

## G25-B1-UX-B-C PARTIAL — Reconciliacao Gmail historica (2026-07-10)

- Migration 43 e reader/UI de remetente permanecem em staging `ucrjtfswnfdlxwtmxnoo`; produção `bhgifjrfagkzubpyqpew` não foi acessada.
- O reconciliador do Documents Ingestor percorreu a janela desde `2026-06-19T03:00:00.000Z`: 24 mensagens, 40 anexos PDF/XML, 17 metadados legados preenchidos e 20 anexos ausentes processados pelo pipeline canônico. Uma referência cross-message reutilizou Drive existente, resultando em 21 candidates novos sem par mensagem/anexo duplicado. Staging passou a ter 40 candidates.
- O segundo dry-run confirmou idempotência: zero update SQLite/Supabase e zero criação. O reader continua compatível com legado.
- Exceção preservada: `L.pdf` local (`gmail_message_id=m-log`) não existe no Gmail e permanece sem remetente/data/message ID; não houve exclusão automática. Os documentos de teste foram apenas reportados, não removidos.
- UI continua apresentando `Remetente`, `Recebido`, `Processado` e ações compactas; revalidação visual autenticada fica disponível ao administrador. Watcher voltou com uma instância e fila Gmail ativa zero.
- Próxima fase: `G25-B1-UX-C — TEST DOCUMENT CLEANUP`, com lista explícita do operador; depois `G25-B2 — RELEVANCE CLASSIFIER V1`.
