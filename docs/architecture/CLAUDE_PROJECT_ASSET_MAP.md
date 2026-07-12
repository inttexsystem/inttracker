# MAPA DE ATIVOS E ARQUIVOS DO PROJETO — CLAUDE / RAVATEX

> **Fase:** `G28-P0` / correção `G28-P0-R1` — registro e correção dos documentos de governança (docs-only).
> **Tipo:** inventário read-only; nenhum código, migration, teste ou `.claude`
> foi alterado.
> **Workspace:** `D:\OneDrive\Programação\Ravatex\controle-tapetes-g28`
> **Branch:** `work/g28-document-qualification`
> **Baseline do inventário:** `247345c8b4d63d9b4c871f55109fe39af244f40f` — HEAD sobre o qual `.claude` e os entrypoints foram inventariados.
> **Commit inicial de registro:** `bdb2fa3b05361c761d55506192483fe4d8be5034` (G28-P0).
> **HEAD atual:** não é permanente; confirmar sempre em `PROJECT_STATE.md` e via `git rev-parse HEAD`.
> **Workspace original (quarentena, somente leitura):** `D:\OneDrive\Programação\Ravatex\controle-tapetes`

Este mapa registra onde vivem as fontes de verdade do projeto, quais são
obrigatórias por tipo de tarefa, qual a precedência entre elas e quais ativos
precisam ser promovidos de `.claude` para documentação versionada. Serve para
que qualquer worktree novo saiba o que ler antes de agir — inclusive quando a
pasta `.claude` **não existir** nele (ver §13).

---

## 1. Documentos canônicos (arquitetura vigente)

§1 é o **catálogo canônico** de fontes — **não** é uma ordem de leitura integral
obrigatória antes de toda tarefa:

- o **gate inicial** de qualquer tarefa é `PROJECT_STATE.md` + `AGENT_HANDOFF.md`
  + o plano aplicável;
- §11 define as leituras específicas por tipo de tarefa;
- as demais referências são lidas quando afetarem o escopo da tarefa.

| Documento | Papel |
|---|---|
| `PROJECT_STATE.md` (raiz) | Snapshot canônico: HEAD, staging, remotes, fase atual, pendências. |
| `AGENT_HANDOFF.md` (raiz) | Resumo para a próxima sessão: estado aceito, gates, proibições, próximo checkpoint. |
| `services/documents-ingestor/PROJECT_STATE.md` | Estado do serviço Documents Ingestor. |
| `docs/architecture/DOCUMENTOS_VALIDACAO_VINCULOS_E_EVOLUCAO_PLANO.md` | **Plano mestre** da frente documental (Camadas 0–4, sequência, backlog, matriz de fases, hard stops). |
| `docs/architecture/PEDIDO_OP_MOVIMENTACAO_DOCUMENTOS_PLANO.md` | Plano persistente Pedido ↔ OP ↔ Movimentação ↔ Documentos. |
| `docs/architecture/PEDIDO_OP_SCHEMA_CONTRACT.md` | Contrato técnico de schema Pedido/OP/documentos. |
| `docs/architecture/CODE_HEALTH_RULES.md` | 18 regras vinculantes de saúde arquitetural. |
| `docs/architecture/PORTAL_B2B_ARCHITECTURE_RULES.md` | Separação Cliente / Admin / Fornecedor; status operacional vs. visual. |
| `docs/architecture/DOCUMENTS_INGESTOR_CONSUMER_DESIGN.md` | Contrato do reader do Controle sobre o Ingestor. |
| `docs/architecture/CLAUDE_PROJECT_ASSET_MAP.md` | **Este mapa.** |
| `docs/architecture/UI_VISUAL_CONTRACT.md` | **Contrato visual versionado** (consolidação da skill `.claude/design-skill`). |
| `docs/DOCUMENTATION_INDEX.md` | Índice geral: fontes canônicas × docs legadas. |

## 2. Planos persistentes

| Plano | Frente | Regra de atualização |
|---|---|---|
| `docs/architecture/DOCUMENTOS_VALIDACAO_VINCULOS_E_EVOLUCAO_PLANO.md` | Documentos, validação, vínculos, evolução | Atualizar a matriz de fases após cada aceite técnico. |
| `docs/architecture/PEDIDO_OP_MOVIMENTACAO_DOCUMENTOS_PLANO.md` | Pedido/OP/Movimentação/Documentos | Obrigação permanente §6: consultar antes, atualizar ao fechar. |
| `docs/architecture/PEDIDO_PRODUCTION_FLOW_BACKLOG.md` | Fluxo produtivo do Pedido + backlog Admin | Leitura obrigatória antes de implementação no fluxo produtivo. |
| `docs/refactor/ARCHITECTURE_REFACTOR_LEDGER.md` | Histórico de fases do refactor | Ledger cronológico. |

## 3. Arquivos de estado

| Arquivo | Escopo | Formato |
|---|---|---|
| `PROJECT_STATE.md` (raiz) | Monorepo Controle de Tapetes | Log reverso-cronológico (bloco mais recente no topo). |
| `services/documents-ingestor/PROJECT_STATE.md` | Serviço Documents Ingestor | Log reverso-cronológico. |

## 4. Arquivos de handoff

| Arquivo | Escopo |
|---|---|
| `AGENT_HANDOFF.md` (raiz) | Handoff da próxima sessão do monorepo. Seção mais recente no topo, separada por `---`. |

## 5. Inventário da pasta `.claude`

`.claude` é **untracked** (não versionada, não ignorada) e existe fisicamente
**apenas no workspace original** em quarentena. O worktree `controle-tapetes-g28`
**não contém `.claude`** (ver §13). Nenhum arquivo abaixo contém credenciais,
tokens de autenticação, chaves ou segredos — os arquivos chamados `tokens/` são
**design tokens CSS** (cores/layout/tipografia), não segredos.

| Path (`.claude/…`) | Tracked | Finalidade | Tipo | Regra permanente? | Caminho local? | Usável em worktree novo? | Ação |
|---|---|---|---|---|---|---|---|
| `design-skill/SKILL.md` | untracked | Skill visual `inttex-ui` (gera telas no estilo Ravatex) | skill / instrução visual | Sim (regras de UI) | Não | Não (só existe no original) | `KEEP_AS_SKILL` (arquivo) + `PROMOTE_RULES_TO_VERSIONED_DOC` (regras permanentes → `UI_VISUAL_CONTRACT.md`) |
| `design-skill/README.md` | untracked | Guia visual completo (fundações, layout cockpit, componentes, regra de ouro de tabelas) | referência visual / instrução | Sim | Não | Não | `KEEP_AS_SKILL` (arquivo) + `PROMOTE_RULES_TO_VERSIONED_DOC` (regras consolidadas em `UI_VISUAL_CONTRACT.md`) |
| `design-skill/styles.css` | untracked | Entry CSS que importa Inter + tokens | referência visual | Parcial | Não | Não | REFERENCE_ONLY (equivalente versionado: `css/tokens.css`) |
| `design-skill/tokens/colors.css` | untracked | Design tokens de cor da skill | referência visual | Parcial | Não | Não | REFERENCE_ONLY → canônico versionado `css/tokens.css` (`--rv-*`) |
| `design-skill/tokens/layout.css` | untracked | Design tokens de layout | referência visual | Parcial | Não | Não | REFERENCE_ONLY |
| `design-skill/tokens/typography.css` | untracked | Design tokens de tipografia | referência visual | Parcial | Não | Não | REFERENCE_ONLY |
| `design-skill/tailwind-preset.js` | untracked | Preset Tailwind que mapeia tokens → classes | referência visual / config | Parcial | Não | Não | REFERENCE_ONLY |
| `design-skill/example.html` | untracked | Exemplo de tela | exemplo | Não | Não | Não | REFERENCE_ONLY |
| `design-skill/OP Acabamento - Aberta (standalone).html` | untracked | Mock standalone de OP Acabamento | exemplo / referência visual | Não | Não | Não | REFERENCE_ONLY |
| `design-skill/OP Tecelagem - Em produção - Compacto (standalone).html` | untracked | Mock standalone de OP Tecelagem | exemplo / referência visual | Não | Não | Não | REFERENCE_ONLY |
| `tokens/colors.css` | untracked | Design tokens de cor (raiz `.claude`) | referência visual | Parcial | Não | Não | REFERENCE_ONLY (duplica `design-skill/tokens`) |
| `tokens/layout.css` | untracked | Design tokens de layout | referência visual | Parcial | Não | Não | REFERENCE_ONLY |
| `tokens/typography.css` | untracked | Design tokens de tipografia | referência visual | Parcial | Não | Não | REFERENCE_ONLY |
| `preview/*.html` | untracked | Harness de render real (tecelagem/acabamento/op-aberta) | exemplo / verificação | Não | Não | Não | KEEP_LOCAL (harness de verificação visual) |
| `preview/screenshots/*.png` | untracked | Evidência visual dos pilotos | referência visual | Não | Não | Não | KEEP_LOCAL |
| `launch.json` | untracked | Config de preview local (`python -m http.server 5599`) | configuração local | Não | Sim (runtime local) | Sim (regenerável) | KEEP_LOCAL |
| `settings.local.json` | untracked | Allowlist de permissões da máquina (sem segredos) | configuração local / específico da máquina | Não | Sim (path local) | Não | KEEP_LOCAL |

> Nenhum conteúdo sensível foi encontrado; portanto não há linha marcada como
> `SENSITIVE — CONTENT NOT COPIED`. Se, em revisão futura, `.claude` passar a
> conter segredos, esses arquivos devem ser marcados assim e **não copiados**.

## 6. Skills visuais

- **Fonte operacional:** `.claude/design-skill/` (skill `inttex-ui`, `user-invocable`).
- **Regras permanentes promovidas para:** `docs/architecture/UI_VISUAL_CONTRACT.md`.
- **Tokens canônicos versionados:** `css/tokens.css` (prefixo `--rv-*`).
- **Pilotos reais de referência:** `js/screens/op-latex-admin.js`,
  `js/screens/op-tecelagem-producao-admin.js`.
- **Harness de verificação:** `.claude/preview/*.html` (local, não versionado).

Regra: a skill pode **ensinar** a aplicar o padrão, mas o contrato visual
versionado prevalece. Uma skill não pode contrariar a arquitetura.

## 7. Entrypoints da seção Documentos

| Arquivo | Papel |
|---|---|
| `js/screens/documentos-recebidos.js` | Tela central de Documentos recebidos. |
| `js/documents-ingestor.js` | Núcleo de integração com o Ingestor no frontend. |
| `js/documents-ingestor-loader.js` / `js/documents-ingestor-auto-load.js` | Carregamento/boot da integração. |
| `js/documents-ingestor-import-received.js` / `js/documents-ingestor-import-ui.js` | Importação de documentos recebidos + UI. |
| `js/documents-scan-trigger.js` | Disparo da RPC de scan (fila de solicitações). |
| `js/documents-supabase-reader.js` | Reader dos `document_candidates`/eventos no Supabase. |
| `js/documents-supabase-decisions.js` | Decisões (aceite/rejeição/undo) sobre documentos. |

## 8. Entrypoints de Pedido

| Arquivo | Papel |
|---|---|
| `js/screens/pedidos-list.js` | Lista Admin de pedidos. |
| `js/screens/pedido-detail.js` (+ `pedido-detail-data/events/progress/render.js`) | Detalhe Admin do pedido (índice central de documentos). |
| `js/screens/pedido-form.js` / `pedido-edit.js` / `pedido-itens-edit.js` | Criação/edição de pedido e itens. |
| `js/screens/pedido-parciais-admin.js` / `pedido-tracking-admin.js` / `pedido-chain-state.js` | Parciais, tracking e estado da cadeia. |
| `js/screens/cliente-pedido-detail.js` / `cliente-pedido-form.js` / `cliente-pedido-tracking.js` / `cliente-pedidos-list.js` | Superfícies do Portal Cliente (read model público). |

## 9. Entrypoints de OP

| Arquivo | Papel |
|---|---|
| `js/screens/op-latex-admin.js` | OP de látex/acabamento (piloto visual). |
| `js/screens/op-tecelagem-producao-admin.js` | OP de tecelagem em produção (piloto visual). |
| `js/screens/op-nova.js` / `op-form-helpers.js` | Criação de OP (exige Pedido — guard). |
| `js/screens/op-persistir.js` / `op-writes.js` / `op-recalculo.js` | Persistência, escrita e recálculo da OP. |
| `js/screens/op-pdf.js` | Geração de PDF da OP. |

## 10. Contratos de Supabase / documentos existentes

**Snapshot de G28-P0 — não é fonte operacional permanente.** O estado das
migrations abaixo é um retrato do momento do registro:

- o estado atual deve ser confirmado em `PROJECT_STATE.md`, nas evidências de
  aplicação e no ambiente alvo;
- "Aplicado" aqui significa "reportado aplicado no snapshot de G28-P0", não uma
  garantia permanente;
- **nunca** executar ou pular uma migration com base apenas neste mapa.

| Artefato | Papel | Estado (snapshot G28-P0) |
|---|---|---|
| `db/38_documentos_schema.sql` | Schema base de documentos | Aplicado |
| `db/39_documentos_ingestor_state_undo.sql` | Estado do ingestor + undo de decisão | Aplicado |
| `db/40_document_scan_runs_stale_recovery.sql` | Recuperação de scan runs travados | Aplicado |
| `db/41_document_scan_requests_queue.sql` | Fila de solicitações de scan | **Versionada, NÃO aplicada** |
| `db/42_email_received_timestamp.sql` / `db/43_document_sender_email.sql` | Metadados de e-mail recebido | Aplicado |
| `db/47_document_candidate_cnpj.sql` / `db/48_document_candidate_cnpj_projection.sql` | CNPJ em `document_candidates` + projeção | Aplicado |
| `services/documents-ingestor/docs/CONTROL_TAPETES_DOCUMENTS_CONTRACT.md` | Contrato Ingestor ↔ Controle | Canônico |
| `services/documents-ingestor/contracts/document-event.schema.json` | Schema de evento de documento | Canônico |
| `services/documents-ingestor/contracts/manifest.schema.json` | Schema do manifest | Canônico |
| `docs/architecture/DOCUMENTS_INGESTOR_CONSUMER_DESIGN.md` | Design do consumer/reader do Controle | Canônico |

> `db/49` **não existe** no tree versionado. A arquitetura proposta em G28-A
> (incluindo `db/49`, `qualified` como estado final, `duplicate` como estado
> principal e a matriz de qualificação) está
> `REJECTED AS CONTRACT / RETAINED AS DIAGNOSTIC INPUT` — **não** é arquitetura
> vigente; suas evidências permanecem como insumo diagnóstico.

## 11. Arquivos obrigatórios por tipo de tarefa

| Tipo de tarefa | Ler obrigatoriamente antes |
|---|---|
| Qualquer fase | §1 (documentos canônicos) + `PROJECT_STATE.md` + `AGENT_HANDOFF.md` |
| Frente Documentos | Plano mestre + `PEDIDO_OP_MOVIMENTACAO_DOCUMENTOS_PLANO.md` + `DOCUMENTS_INGESTOR_CONSUMER_DESIGN.md` + `services/documents-ingestor/PROJECT_STATE.md` |
| Schema / migration | `PEDIDO_OP_SCHEMA_CONTRACT.md` + `CODE_HEALTH_RULES.md` + contratos §10 |
| UI / modal / tabela / card | `UI_VISUAL_CONTRACT.md` + `css/tokens.css` + skill `.claude/design-skill` (quando presente) + pilotos §9 |
| Pedido / OP | `PEDIDO_OP_MOVIMENTACAO_DOCUMENTOS_PLANO.md` + `PEDIDO_PRODUCTION_FLOW_BACKLOG.md` + entrypoints §8/§9 |
| Portal Cliente / Fornecedor | `PORTAL_B2B_ARCHITECTURE_RULES.md` + `docs/ui/CLIENTE_PORTAL_UI_*` |

## 12. Precedência funcional das fontes

Cada fonte resolve um tipo de questão. Em divergência, use a fonte cujo **escopo**
corresponde à questão — não a posição em uma lista:

- **decisão explícita vigente do IAlead/arquiteto** — resolve decisão reservada e supersessão;
- **contrato arquitetural do domínio** — resolve invariantes e semântica;
- **`PROJECT_STATE.md`** — resolve fase, HEAD, publicação, ambiente e estado corrente;
- **plano persistente aplicável** — resolve sequência, dependências e backlog;
- **contrato específico da tarefa** (UI, schema, integração, outro domínio técnico) — resolve o domínio técnico correspondente;
- **`AGENT_HANDOFF.md`** — resolve continuidade operacional, sem criar arquitetura;
- **skill** — orienta a execução, sem alterar contrato;
- **preferência do agente** — não cria regra.

> **Em conflito real, parar e escalar.** Não escolher silenciosamente uma fonte
> apenas pela posição em uma lista. Uma skill não pode contrariar a arquitetura.

## 13. Risco: worktree limpo pode não conter `.claude`

`.claude` é untracked e físico por diretório. O worktree `controle-tapetes-g28`
**não tem `.claude`** — foi verificado (`git ls-files .claude` vazio; `.claude`
ausente no disco; não está em `.gitignore`). Consequências:

- skills e tokens de `.claude` **não** estão disponíveis automaticamente em
  worktrees novos;
- regras permanentes de produto/UI que vivam só em `.claude` ficam invisíveis;
- por isso, toda regra permanente **deve** existir também em documentação
  versionada (§15). Este é o motivo de promover a skill visual para
  `UI_VISUAL_CONTRACT.md` e de fixar os tokens em `css/tokens.css`.

## 14. Itens que devem permanecer locais

- `.claude/launch.json` (preview local regenerável);
- `.claude/settings.local.json` (permissões da máquina, sem segredos);
- `.claude/preview/*.html` e `.claude/preview/screenshots/*.png` (harness/evidência de verificação);
- os mocks standalone e `example.html` (referência de apoio).

> Previews, screenshots e mocks permanecem `KEEP_LOCAL` / `REFERENCE_ONLY`.
> Somente um artefato **formalmente designado** como
> `CANONICAL_VISUAL_ACCEPTANCE_REFERENCE` poderá ser promovido a documentação
> versionada depois.

## 15. Itens que devem virar documentação versionada

- **Regras visuais permanentes** de `.claude/design-skill/SKILL.md` e `README.md`
  → `docs/architecture/UI_VISUAL_CONTRACT.md` (feito nesta fase).
- **Tokens visuais** → já versionados em `css/tokens.css` (`--rv-*`); os tokens
  de `.claude` ficam como referência.
- Qualquer nova regra permanente de produto/UI descoberta em `.claude` deve ser
  promovida antes de sustentar uma fase de implementação.

---

> **Este mapa é fonte canônica de localização de ativos.** Deve ser consultado no
> início de cada fase e atualizado quando entrypoints, contratos ou a estrutura
> de `.claude` mudarem.
