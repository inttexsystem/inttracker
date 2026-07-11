# G27-B0 + G27-B-CORE — ISOLATED DOCUMENT RECOGNITION SAFETY HARDENING

PROJETO: Ravatex — Controle de Tapetes (monorepo)
WORKSPACE ORIGINAL EM QUARENTENA: `D:\\OneDrive\\Programação\\Ravatex\\controle-tapetes`
WORKSPACE G27: `D:\\OneDrive\\Programação\\Ravatex\\controle-tapetes-g27`
BRANCH G27: `work/g27-document-recognition-safety`
HEAD INICIAL CANONICO: `26111e04ab185dc1f484567cc48f3516cd6012a1`
FASE: G27-B2-R1 E G27-B-CORE-GATE-R1 COM EVIDENCIA TECNICA; DECISAO ARQUITETURAL E INTEGRACAO EM `work/app-next` PENDENTES

## RESULTADO E EVIDENCIA

- G27-B0 confirmou o worktree novo limpo: branch exclusiva, HEAD canônico, index/working tree/untracked/diffs vazios. O original foi consultado somente em leitura e preservado sem mutacao.
- B1: CNPJ normalizado somente de pontuacao e validado por tamanho, repeticao e digitos verificadores antes de matching, direcao e persistencia; invalidos resultam `null`.
- B2-R1: XML candidato usa o texto UTF-8 integral do Buffer ja baixado para XML bem-formado + estrutura NF-e; nao faz novo download, nao tem limite de tamanho e nao persiste XML bruto. PDF continua usando somente o prefixo inicial de 2048 bytes. XML truncado/malformado/generico falha fechado como `desconhecido`; CNPJ apos 2048 e extraido quando estruturalmente valido.
- Parser: `processEntities: false`; entidades XML internas nao expandem CNPJ, mantendo extração fail-closed.
- B3: PDF exige prefixo inicial `%PDF-` para NF; tokens explicitos eliminam falsos positivos `info.pdf`/`conferencia.pdf`; romaneio por nome/assunto tem precedencia e nenhum autoaceite foi criado.
- Commits locais: `5b012a0`, `3cc3999`, `09b45f8`, `8b3f9fd`, `aac06be`, `ab1e85e`, `a06fa62`.
- Testes focados: classifier/scan **4 arquivos / 250 testes** verdes; suite completa Documents Ingestor: **40 arquivos / 812 testes** verde.
- Build: baseline detached `26111e04` e G27 retornaram `tsc` exit 2 com os mesmos 8 erros (`drive.ts`, eventos historicos em `realScan.ts`, `syncMapped.ts`); debt comprovado preexistente.
- Revisao integral independente final: Kimi K2.7 Code, somente leitura, revisou `26111e04..9a3aae2` e retornou `APPROVE`; a arvore permaneceu limpa.
- Git final antes da documentacao: apenas os tres documentos permanentes previstos em alteracao; staging seletivo sera usado. Nenhum push, merge, cherry-pick ou contato remoto; `work/app-next` continua intocada.
- Debito preservado: metadata orfa `.git/worktrees/baseline-worktree`; nao executar prune sem ordem independente.

## PROXIMO PASSO

Executar snapshot somente-leitura final do original e submeter a cadeia ao arquiteto. Nao integrar, cherry-pickar, mesclar nem publicar nesta cadeia.

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
