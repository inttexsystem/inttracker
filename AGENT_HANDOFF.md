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
