# Modelo de Documentação — Ravatex Controle de Tapetes

> **Fase:** `G28-DOCS-B1` — contrato permanente de governança documental
> (aditivo; sem migração, sem compactação, sem movimentação de arquivos).
> **Status:** `AUTHORIZED` para referência; migração concreta de
> estados/handoffs/ledgers em slices posteriores.
> **Workspace:** `D:\OneDrive\Programação\Ravatex\controle-tapetes-g28`
> **Branch:** `work/g28-document-qualification`
> **Última atualização:** `2026-07-12`

Este documento é o **contrato permanente de propriedade, autoridade e
atualização** da documentação do projeto. Ele governa **como** cada
categoria de documento deve ser escrita, quem é dono do quê, o que
pertence a qual arquivo e o que deve ser derivado de outra fonte
(Git, ambiente, Supabase) em vez de copiado em prosa.

Quando outros documentos do projeto (planos, estados, handoffs, índices
legados) precisarem decidir **quem é o dono** de um fato, **como**
devem ser atualizados ou **quando** se tornam obsoletos, este contrato
prevalece. Em caso de conflito, este modelo tem prioridade sobre
qualquer outra descrição de processo, exceto quando explicitamente
revisto em fase autorizada e registrado em `docs/DOCUMENTATION_INDEX.md`.

---

## 1. Princípio central

**Cada fato possui exatamente um proprietário documental. Os demais
arquivos referenciam o proprietário; não copiam o fato.**

Consequências diretas:

- Não existe "snapshot canônico" em mais de um lugar para o mesmo
  fato. Onde parecer haver duplicação, a fonte secundária é apenas
  uma **referência** (link) à fonte primária.
- Documentos que se julgam "fonte" de algo fora do seu escopo
  perdem essa autoridade ao serem migrados para o modelo. Listas
  concorrentes de "fontes canônicas" existentes hoje são tratadas
  como **legado a reconciliar** em slices futuros (ver §13).
- Fatos derivados (HEAD, working tree, staging, divergência,
  status de ambiente, evidência de apply) **não são copiados em
  Markdown** como estado permanente: são obtidos das suas fontes
  vivas (Git, ambiente) ou registrados como evento histórico
  (ledger).

---

## 2. Árvore de papéis

| Papel | Arquivo | Fato de que é dono |
|---|---|---|
| **Árbitro documental** | `docs/DOCUMENTATION_INDEX.md` | Ordem de autoridade, classificação de documentos, caminhos canônicos, mapeamento de legado, responsabilidade por categoria. |
| **Estado permanente por frente** | `PROJECT_STATE.md` (raiz) e `services/*/PROJECT_STATE.md` (quando aplicável) | Estado operacional atual de cada frente (fase, próxima ação, bloqueio, links de contexto). |
| **Handoff operacional ativo** | `AGENT_HANDOFF.md` (raiz) | Continuidade da próxima sessão: objetivo imediato, arquivos obrigatórios, restrições, links. |
| **Ledger histórico (append-only)** | `docs/refactor/ARCHITECTURE_REFACTOR_LEDGER.md` (refactor) e ledgers específicos por frente (a criar) | Histórico auditável de fases encerradas, commits aceitos, testes, risco residual e próxima fase. |
| **Plano arquitetural** | `docs/architecture/PLANO_*.md` | Arquitetura-alvo, requisitos, decisões permanentes, dependências, fases planejadas, critérios de aceite, backlog. |
| **Contrato de domínio / API** | `docs/architecture/*_CONTRACT.md` e `services/documents-ingestor/contracts/*` | Contrato técnico de uma área (schema, RLS, RPCs, eventos, JSON schemas). |
| **Contrato visual** | `docs/architecture/UI_VISUAL_CONTRACT.md` | Regras visuais versionadas. |
| **Contrato de saúde arquitetural / modularização** | `docs/architecture/CODE_HEALTH_RULES.md` | 18 regras vinculantes de modularização, estrutura de arquivos, limites de responsabilidade por módulo/tela e o que `index.html` pode e não pode conter. Toda nova fase deve respeitar. |
| **Runbook operacional** | `docs/operations/*` | Como executar procedimentos já aprovados. |
| **Governança documental** | `docs/governance/DOCUMENTATION_MODEL.md` (este arquivo) | Regras de como a documentação se organiza e se atualiza. |

Esses papéis **não se sobrepõem**. Um mesmo arquivo pode exercer
mais de um papel **somente** se a fronteira for explicitamente
declarada no próprio arquivo e mantida no `DOCUMENTATION_INDEX`.

---

## 3. Árbitro documental — `docs/DOCUMENTATION_INDEX.md`

`docs/DOCUMENTATION_INDEX.md` é a **única fonte** para:

- ordem de autoridade documental;
- classificação de documentos (canônico, operacional, contrato,
  runbook, legado, diagnóstico, governança);
- caminhos canônicos de arquivos do projeto;
- mapeamento de documentos legados (`docs/superpowers/`,
  `docs/qa/`, `docs/DEPLOYMENT.md`, etc.);
- responsabilidade de cada categoria (quem é dono de qual fato).

`docs/DOCUMENTATION_INDEX.md` **não** é fonte de:

- fase atual;
- próxima ação;
- HEAD atual;
- working tree;
- status operacional;
- histórico de closeouts;
- progresso cronológico de fases.

Essas listas de "fontes canônicas" hoje presentes em outros arquivos
(por exemplo, ordem de prevalência enumerada em arquivos legados)
**não são alteradas neste slice** (G28-DOCS-B1). Elas serão
substituídas por referência ao índice em slices futuros, conforme
§13.

---

## 4. Estado permanente — `PROJECT_STATE.md`

`PROJECT_STATE.md` (raiz) será futuramente a **única fonte** de
estado atual por frente do monorepo. Cada frente, no seu bloco
dentro de `PROJECT_STATE.md`, conterá somente:

- nome da frente;
- workspace;
- branch;
- remoto permitido;
- última fase aceita;
- fase atual;
- próxima ação;
- bloqueio ou débito que afete a continuidade;
- links para plano, ledger e contexto do componente.

`PROJECT_STATE.md` **não** conterá:

- HEAD atual como prosa (exceto como referência transitória durante
  o slice de aceitação — ver §9);
- working tree;
- staging;
- divergência Git;
- pilhas de closeouts;
- relatórios integrais (logs de execução, diffs completos,
  histórico de testes);
- histórico cronológico extenso;
- comandos completos de execução;
- cópias de requisitos dos planos.

### 4.1 Fontes vivas que substituem o que era copiado

- **HEAD aceito** de uma fase → registro histórico no **ledger**
  da frente (§7).
- **HEAD atual** e **working tree** → `git rev-parse HEAD`,
  `git status --short --untracked-files=all`, `git rev-parse
  --abbrev-ref HEAD`. Obtidos via Git, **não** em Markdown.
- **Divergência** entre local e remoto → `git rev-list --left-right
  --count <local>...<remoto>/<branch>`. Obtida via Git.
- **Staging** → `git diff --cached --name-status`. Obtido via Git.

### 4.2 Workspace, branch e remoto

`workspace`, `branch` e `remoto permitido` são **metadados de
roteamento** e podem constar do bloco da frente em
`PROJECT_STATE.md`. Eles identificam onde a frente é operada, não
o estado vivo da execução.

---

## 5. Estados locais de componente

Arquivos como `services/documents-ingestor/PROJECT_STATE.md`
**não podem** funcionar como segunda fonte do estado canônico da
frente correspondente. Em particular, é proibido repetirem:

- fase canônica atual;
- próxima fase;
- HEAD;
- working tree;
- push;
- status global da frente (ex.: `G28-B3 IN PROGRESS`).

A migração futura desses arquivos escolherá uma de duas formas,
em slice posterior (após inventário do conteúdo exclusivo):

1. **Contexto técnico estável do componente**, sem fase atual e
   próxima ação. Apenas decisões, contratos, comandos, dependências
   e estrutura do pacote.
2. **Ponteiro** reduzido a `PROJECT_STATE.md` da raiz e aos planos
   do componente.

A escolha concreta (1 ou 2) será executada em slice posterior.
Este slice não migra nem decide entre as alternativas.

---

## 6. Handoff operacional — `AGENT_HANDOFF.md`

`AGENT_HANDOFF.md` é o **único handoff operacional ativo**.

Poderá conter:

- frente ativa;
- objetivo imediato;
- estado de entrada necessário (pré-condições, ambiente);
- arquivos obrigatórios (leitura mínima para a próxima ação);
- restrições da próxima ação;
- decisões ainda relevantes (somente as que afetam a continuidade);
- links para `PROJECT_STATE.md`, plano e ledger.

`AGENT_HANDOFF.md` **não** poderá conter:

- pilha de closeouts;
- histórico completo de commits;
- estado detalhado de frentes inativas;
- cópia integral de planos;
- HEAD declarado como fonte canônica;
- working tree, staging ou divergência como estado vivo;
- duplicação do estado da frente (a fase e a próxima ação
  pertencem a `PROJECT_STATE.md`).

O handoff **não substitui** `PROJECT_STATE.md`. Menções ao ID da
fase são permitidas para **orientar a execução**, mas o status
canônico da fase pertence somente a `PROJECT_STATE.md`.

---

## 7. Ledger de closeouts

O modelo futuro adotará **ledger append-only por frente**. Cada
entrada do ledger deverá registrar, no mínimo:

- fase (ID);
- gate ou status final;
- commit ou commits aceitos;
- arquivos principais;
- testes e resultado;
- risco residual;
- próxima fase indicada no momento do closeout;
- data.

### 7.1 Regras do ledger

- Entradas antigas **não** são reescritas para representar o
  estado atual. Correções posteriores entram como **nova linha**
  ou como **nota vinculada** à linha original.
- O ledger **não** determina a fase atual. A fase atual é
  declarada em `PROJECT_STATE.md` da frente.
- O **Git continua sendo a fonte dos commits e diffs**. O ledger
  é índice histórico e auditável, não um espelho do `git log`.
- O ledger **não** substitui `AGENT_HANDOFF.md` nem
  `PROJECT_STATE.md`; ele complementa.

### 7.2 Fase deste slice

**Nenhum ledger novo deve ser criado neste slice.** O
`docs/refactor/ARCHITECTURE_REFACTOR_LEDGER.md` já existente
permanece como está; novos ledgers por frente serão abertos em
slices posteriores, quando a frente os necessitar.

---

## 8. Planos, contratos e backlogs

Planos arquiteturais (ex.: `docs/architecture/PLANO_*.md`,
`docs/architecture/PEDIDO_OP_*.md`) podem conter:

- arquitetura;
- requisitos;
- decisões permanentes;
- dependências;
- fases planejadas;
- critérios de aceite;
- backlog;
- progresso **macro não operacional** (ex.: "B2 concluído;
  B3 em curso" — referência a estados que vivem em
  `PROJECT_STATE.md`).

Não devem conter como **estado ativo**:

- HEAD atual;
- working tree;
- push;
- migration aplicada/não aplicada **sem referência ambiental**
  (ex.: "db/49 aplicada em staging `ucrjtfswnfdlxwtmxnoo`
  em 2026-MM-DD" é aceitável; "db/49 aplicada" sem
  contexto é histórico solto);
- próxima ordem temporária;
- relatórios completos de commits.

Progresso detalhado deve apontar para `PROJECT_STATE.md` e para o
ledger correspondente.

---

## 9. Metadados Git — tratamento explícito

A documentação deve distinguir três classes de informação vinda
do Git:

| Classe | Natureza | Onde deve aparecer |
|---|---|---|
| **Workspace, branch, remoto** | Metadado de roteamento (estável até nova fase de migração) | Bloco da frente em `PROJECT_STATE.md` e em `AGENT_HANDOFF.md` (se relevante). |
| **HEAD, working tree, staging, divergência** | Fato vivo | Obtido via `git` no momento da consulta. **Não** copiado em Markdown. |
| **Commit aceito de uma fase** | Fato histórico | Linha do **ledger** da frente, com SHA, mensagem e arquivos principais. |

Esta classificação **corrige** formulações que tratavam branch
como se nunca pudesse constar em documentação. Branch e workspace
são metadados de roteamento e podem ser persistidos; HEAD, working
tree e staging são fatos vivos e não.

---

## 10. Estado de migrations

O cabeçalho do arquivo SQL **não é prova única** de que a
migration está aplicada em um ambiente. O contrato distingue
três estados:

1. **Versionada** — o arquivo `db/NN_*.sql` existe no repo e
   foi aceito em uma fase. Prova: histórico Git + ledger da
   fase que a introduziu.
2. **Aplicada por ambiente** — a migration foi executada em
   um Supabase específico (staging `ucrjtfswnfdlxwtmxnoo` ou
   produção `bhgifjrfagkzubpyqpew`). Prova: **ledger
   operacional** da frente, registrando apply confirmado,
   ambiente, evidência e commit.
3. **Verificada por ambiente** — o estado pós-apply foi
   inspecionado (assertevas estruturais, contagens, RLS).
   Prova: mesma ledger, com resultados de verificação.

Fonte futura recomendada:

- **arquivo SQL + histórico Git** → prova de que a migration
  está versionada;
- **ledger operacional da frente** → registro de apply
  confirmado, ambiente, evidência e commit;
- **Supabase real** → fonte final quando consultado em uma
  fase autorizada.

**Não criar ledger de migrations neste slice.** A separação entre
"versionada", "aplicada" e "verificada" é uma regra de
classificação; a infraestrutura de ledger dedicado a migrations
será decidida em slice posterior.

---

## 11. Regra de atualização por fase

A tabela abaixo define, para cada evento de fase, qual(is)
documento(s) canônico(s) deve(m) ser atualizado. **Nenhuma fase
técnica deve atualizar automaticamente todos os documentos.**

| Evento | Atualização documental |
|---|---|
| Diagnóstico read-only | nenhuma |
| Patch técnico ainda não aceito | nenhuma |
| Gate rejeitado | nenhuma alteração canônica; relatório permanece fora do estado permanente |
| Gate técnico aceito | ledger da frente; `PROJECT_STATE.md` somente se fase ou próxima ação mudarem |
| Correção R1/R2 dentro da mesma fase | nova entrada ou vínculo no ledger; sem duplicar todo o estado |
| Mudança arquitetural | plano ou contrato correspondente |
| Troca de chat | `AGENT_HANDOFF.md` |
| Troca de workspace, branch ou remoto | bloco da frente em `PROJECT_STATE.md` |
| Apply de migration | ledger com ambiente e evidência; estado apenas quando isso alterar a fase |
| Push | ledger da fase, quando operacionalmente relevante |
| Compactação documental | ledger registra origem, destino e redução; índice é atualizado somente se caminhos mudarem |

---

## 12. Transação documental mínima

Depois de um **gate aceito**, a atualização normal deverá
envolver no máximo:

1. **1 ledger** da frente;
2. **+ 1 bloco de `PROJECT_STATE.md`**, somente quando a fase
   ou a próxima ação mudarem;
3. **+ `AGENT_HANDOFF.md`**, apenas quando houver continuidade
   operacional relevante ou troca de chat.

Planos só são alterados quando arquitetura, requisitos ou backlog
mudarem. `docs/DOCUMENTATION_INDEX.md` só é alterado quando houver
mudança de autoridade, classificação ou caminhos.

> **Nenhuma fase técnica deve atualizar automaticamente todos os
> documentos.** A tentação de "tudo-em-um" é o sintoma mais comum
> de duplicação documental; deve ser combatida ativamente.

---

## 13. Compactação

A compactação é uma operação **transacional** sobre a
documentação. Deve ser disparada quando sinais objetivos forem
observados, **não** por estética ou por calendário.

### 13.1 Sinais de compactação

`PROJECT_STATE.md` ou `AGENT_HANDOFF.md` precisará de compactação
quando **qualquer** dos sinais abaixo for verdadeiro:

- `PROJECT_STATE.md` ou `AGENT_HANDOFF.md` acima de aproximadamente
  **300 linhas**;
- mais de **um bloco histórico de closeout** dentro do mesmo
  arquivo;
- mais de **uma frente detalhada** dentro do handoff;
- presença de **HEAD, working tree, staging ou divergência** como
  estado ativo (em vez de referência derivada do Git);
- duplicação de **fase** ou **próxima ação** entre dois arquivos
  da mesma frente.

### 13.2 Procedimento de compactação

A compactação deve:

1. **Preservar** decisões permanentes nos planos;
2. **Mover** o histórico para o **ledger** da frente (ou
   append-only existente);
3. **Manter** o estado atual legível em `PROJECT_STATE.md` e
   `AGENT_HANDOFF.md`;
4. **Registrar** a operação no ledger (origem, destino, redução);
5. **Atualizar** referências em `docs/DOCUMENTATION_INDEX.md`
   somente quando caminhos mudarem.

### 13.3 Fase deste slice

**Nenhuma compactação será realizada neste slice.** A regra é
estabelecida para uso em slices futuros.

---

## 14. Listas concorrentes existentes — legado a reconciliar

Os documentos abaixo contêm hoje listas ou ordenações que
**competem** com o papel de árbitro do
`docs/DOCUMENTATION_INDEX.md`. Nenhum deles foi alterado por
G28-DOCS-B1. A reconciliação será feita em slices posteriores
que, idealmente, substituirão essas listas por referência ao
índice e a este modelo.

| Documento | Lista/ordenação concorrente | Observação |
|---|---|---|
| `docs/DOCUMENTATION_INDEX.md` §2 — "Regra de prevalência" | Enumera 7 fontes canônicas por ordem. | Deverá ser reescrita para referenciar este modelo. |
| `docs/architecture/CLAUDE_PROJECT_ASSET_MAP.md` §1, §3, §4, §11, §12 | Catálogo de "documentos canônicos", "arquivos de estado", "arquivos de handoff", precedência funcional. | Deverá ser reescrito para apontar ao índice e a este modelo. |
| `docs/superpowers/STATUS.md`, `docs/superpowers/README.md` | Auto-rotulam-se como "estado canônico atual" ou referenciam-no. | Conteúdo legado (Fases 1–6). Mantidos como histórico; **não** devem guiar execução. |
| `docs/HANDOFF.md` (raiz) | "Snapshot canônico" e "refs canônicos". | Banner existente já indica que o estado atual está em `PROJECT_STATE.md`. Será revisitado em slice de reconciliação. |
| `Guide-and-governance-rules.stxt` | Regras de governança geral para ChatGPT, não para o modelo documental interno. | Continua válido para o agente, mas **não** é árbitro da documentação interna do projeto. |

Esses pontos estão sob jurisdição de slices próprios. G28-DOCS-B1
apenas os **declara como legados a reconciliar**, sem mover nem
reescrever conteúdo.

---

## 15. Verificações obrigatórias ao aceitar uma fase documental

Para que uma fase que toque este modelo (ou seus consumidores)
possa ser aceita:

1. `git diff --check` limpo.
2. Working tree final limpo, staging final vazio.
3. `docs/DOCUMENTATION_INDEX.md` permanece como árbitro de
   autoridade, **não** de estado operacional.
4. `PROJECT_STATE.md` (após migração) é o **único** proprietário
   do estado atual por frente.
5. Estados locais de componente (`services/*/PROJECT_STATE.md`)
   não duplicam fase e próxima ação.
6. `AGENT_HANDOFF.md` tem papel operacional, **não** histórico.
7. Ledger (onde aplicável) é append-only.
8. HEAD e working tree são derivados do Git; nada disso vive
   como estado ativo em Markdown.
9. Branch e workspace são tratados como metadados de
   roteamento, permitidos no bloco da frente em
   `PROJECT_STATE.md`.
10. Migrations versionadas, aplicadas e verificadas são
    distinguidas; a prova de "aplicada em staging" é o ledger
    da frente, não apenas o cabeçalho do SQL.
11. A matriz de atualização por fase (§11) foi respeitada.
12. Nenhum estado atual foi migrado sem slice dedicado.
13. Nenhum arquivo foi movido, renomeado, arquivado ou
    compactado sem slice dedicado.
14. Nenhum push foi executado.

---

## 16. Próximo slice recomendado

`G28-DOCS-B2` — **MIGRATION OF STATE TO OWNER FILES** (docs-only,
aditivo, sem compactação ainda). Sugestão de escopo:

- Para cada frente, criar/revisar o **bloco de frente** em
  `PROJECT_STATE.md` da raiz, contendo apenas os campos da §4.
- Marcar em cada `services/*/PROJECT_STATE.md` quais blocos
  são contexto técnico estável e quais são duplicação de
  estado (sem removê-los ainda; apenas anotando).
- Anexar ao `AGENT_HANDOFF.md` apenas a frente ativa, sem
  histórico de closeouts.
- **Não** criar ledgers novos neste slice; somente mapear
  quais ledgers serão abertos em `B3`.

Esta proposta é **registro**, não autorização. A abertura real
de `G28-DOCS-B2` depende de nova ordem do arquiteto.

---

> **Este modelo é contrato permanente.** Ele será revisitado
> somente em fase docs-only autorizada, e a revisão será
> registrada no `docs/DOCUMENTATION_INDEX.md` e, quando
> aplicável, no ledger da frente.

---

## 17. PHASE CHECKPOINT RECONCILIATION

A phase checkpoint reconciliation is the mandatory end-of-phase protocol. It applies after any authorized work — technical or documentary — concludes. The protocol is a closeout procedure, not a corrective phase. It does not by itself authorize the next phase.

### 17.1 Requirements

1. Verify real branch, HEAD, worktree, staging, and untracked state.

2. Read applicable master plan, PROJECT_STATE.md, AGENT_HANDOFF.md, applicable append-only ledger.

3. Compare planned objective, work actually performed, accepted evidence, remaining work, next authorizable action.

4. Update master plan status using SEPARATE labels: diagnosed, decided, implemented, tested, accepted, deferred.

5. Update PROJECT_STATE.md current operational state.

6. Update AGENT_HANDOFF.md when continuity remains.

7. Append ledger when required.

8. Include this EXACT literal section in final report (labels only, no fixed G28 values):

```
PLAN_ALIGNMENT:
MASTER_PLAN:
LAST_ACCEPTED_PHASE:
CURRENT_PHASE:
NEXT_AUTHORIZABLE_ACTION:
OPEN_ARCHITECT_DECISIONS:
DEFERRED_PHASES:
STATE_FILES_UPDATED:
MATERIAL_DIVERGENCES:
```

9. A phase cannot be accepted if PLAN_ALIGNMENT is missing or material divergence unresolved.

10. Harmless wording difference must not create a corrective phase.

11. No next phase may be inferred solely from numbering.

12. Plans define architecture/backlog; they do not authorize execution by themselves.

13. Next phase derives from reconciled checkpoint plus explicit architect authorization.
