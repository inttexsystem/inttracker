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
