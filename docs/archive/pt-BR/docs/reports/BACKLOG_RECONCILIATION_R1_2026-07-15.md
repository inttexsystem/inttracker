# BACKLOG-RECONCILIATION-READONLY-R1 — RELATÓRIO

> **Data:** 2026-07-15
> **Tipo:** Diagnóstico read-only. Nenhuma alteração de arquivo nesta fase.
> **Classificação:** Diagnóstico/relatório — não normativo por si só, não altera estado.
> As decisões do arquiteto tomadas a partir deste relatório estão registradas em
> `PROJECT_STATE.md` (seção `G28-RECONCILIATION-DECISIONS-A`) e em
> `docs/ledgers/G28_LEDGER.md` (entrada append-only correspondente). Este
> documento preserva o relatório original, verbatim, como evidência histórica.

**Fase:** diagnóstico read-only. **Alterações de arquivo:** nenhuma. **Estado final:** worktree limpo, staging vazio, `staging/work/g28-document-qualification...HEAD = 0 0`. **Acessos:** somente leitura de Git local + repo; **Supabase/MCP não acessado**; **produção `bhgifjrfagkzubpyqpew` não acessada**; sem push nesta ordem (o push de backup foi a ordem anterior, já concluída). **HEAD:** `06b5683`.

---

## STRUCTURAL POLICY COMPLIANCE (gate §0.6 do plano mestre)

- **Canônicos lidos (9/9 + closeout):** `docs/architecture/PEDIDO_OP_MOVIMENTACAO_DOCUMENTOS_PLANO.md`, `docs/architecture/PEDIDO_PRODUCTION_FLOW_BACKLOG.md` (1.408L, ambas as páginas), `docs/architecture/DOCUMENTOS_VALIDACAO_VINCULOS_E_EVOLUCAO_PLANO.md`, `docs/architecture/PEDIDO_OP_SCHEMA_CONTRACT.md`, `PROJECT_STATE.md`, `AGENT_HANDOFF.md`, `docs/ledgers/G28_LEDGER.md`, `docs/DOCUMENTATION_INDEX.md`, `docs/governance/DOCUMENTATION_MODEL.md`; closeout `docs/handoffs/CHATGPT_CLOSEOUT_2026-07-15.md`.
- **Invariantes preservadas:** nenhuma proposta de escrita; nenhuma entidade intermediária introduzida; nenhuma correção documental aplicada (read-only).
- **Conflitos entre canônicos:** **nenhum conflito material** encontrado (detalhe no §6 e no gate HARD STOP ao final). Uma inconsistência textual **não-material** (nota de "lacuna" db/37) foi verificada como **já resolvida**.
- **Decisões reservadas ao arquiteto:** todas as classificações abaixo são **PROPOSED**, não aplicadas.

---

## 1. CAMADA 2 — Administração de usuários (inventário no código real vs. escopo pleno)

Escopo pleno canônico = A1–A7 + política de senha (plano mestre L688–728). Inventário verificado no código:

| Capacidade (escopo pleno) | Existe? | Evidência no código real |
|---|---|---|
| Listar usuários | ✅ | `js/screens/cadastros.js:2247` `reload()`/`renderStandalone`; busca + "Mostrar inativos" |
| Criar usuário | ✅ (parcial) | `js/screens/cadastros.js:2667` → Edge `admin-create-user`; admin digita **senha temporária** manual |
| **Convidar** (invite/magic link) | ❌ | Zero matches p/ `inviteUserByEmail`/`generateLink` em todo `js`/`ts` |
| Editar perfil/vínculo | ✅ | `js/screens/cadastros.js:2645` PostgREST `.update()` (sem campo de senha) |
| Definir **permissões** | ⚠️ parcial | Papel = **string única** `usuarios.tipo ∈ {admin,fornecedor,cliente}` (`db/14_cliente_perfil_schema.sql:66`); **sem tabela de permissões, sem matriz de capacidade**; enforcement = `roles:[…]` por rota + RLS `is_admin()/meu_fornecedor_id()/meu_cliente_id()` |
| Habilitar/**bloquear** acesso | ✅ | Edge `admin-disable-user` (soft-delete `ativo=false` + ban Auth `876000h`); guardas self/último-admin |
| **Reativação** | ⚠️ não confirmada | Não há Edge de reativação; só toggle "inativos" + edição — fluxo de reativação não evidenciado |
| **Resetar senha** | ❌ | Nenhum `resetPasswordForEmail`/`updateUser({password})`; "Esqueceu a senha?" é **stub** (`js/screens/system-screens.js:131` toast "Recuperação de senha ainda não configurada.") |
| **Exigir troca de senha** | ❌ | Ausente |
| Consultar último acesso | ❌ | Ausente |
| Revogar sessões | ⚠️ | Só via ban do disable; sem revogação explícita |
| **Auditar alterações** | ⚠️ parcial | Só `desativado_em/por/motivo` (`db/12_auth_user_disable_schema.sql:38-42`) — **apenas desativação**; nada para create/edit/hard-delete |
| Política de senha | ⚠️ mínima | Só **mínimo 6 chars** (`supabase/functions/admin-create-user/index.ts:36`); **sem** expiração/uso-único/não-reuso/troca obrigatória |
| Usuário externo → Fornecedor/Cliente | ✅ | `usuarios.fornecedor_id`/`cliente_id`; portal cliente construído (`#/cliente/*`) |
| Excluir (hard) | ✅ | Edge `admin-delete-user` (confirma e-mail alvo; guardas self/último-admin) |

**CLASSIFICAÇÃO PROPOSED (não aplicada):**
> `G28-CAMADA-2 = CAPACIDADE PARCIAL PREEXISTENTE (A3 administração + parte de A5 bloqueio + A7 preparação externa) / ESCOPO PLENO A1–A7 NÃO IMPLEMENTADO (reset/recuperação de senha, convites, matriz de papéis/permissões, auditoria de create/edit/delete, política de senha completa, reativação) / NÃO ACEITA COMO FASE DEDICADA / DEFERRED conforme plano mestre.`

A capacidade existente é **subproduto** das frentes AUTH-DISABLE-USER e Portal Cliente — **não** de uma fase Camada-2 A1–A7 (que o plano mestre marca `DEFERRED`, L1025).

---

## 2. CAMADA 3 — Backup/restauração (existe implementação?)

**NÃO existe implementação in-app.** Convergência total das três fontes:
- **Código:** nenhum backup/restore/dump/export de dados, sem UI, sem Edge, sem agendamento. Único artefato = **runbook manual** `docs/BACKUP_AND_RESTORE.md` (operador roda `pg_dump`/`psql` à mão; Supabase Free tier, sem PITR/backup gerenciado). Os hits de "restore"/"export" pertencem a features não relacionadas (restauração de revisão de vínculo documental `db/52`; export de eventos do Ingestor).
- **Canônico:** plano mestre L732–796 "CAMADA 3 — BACKUP EM NUVEM", "Frente futura e independente", sequência BK1–BK8; matriz L1026 = `DEFERRED`.
- **Closeout:** L35 "A Camada 3 de backup e restauração não está implementada nem aceita."

**CLASSIFICAÇÃO PROPOSED:** `G28-CAMADA-3 = NÃO IMPLEMENTADA / DEFERRED / apenas runbook manual documentado.`

---

## 3. Auditoria de worktrees (`git worktree list`)

| Worktree | Branch/HEAD | Sujeira | vs. origin/main | vs. upstream | Propósito aparente |
|---|---|---|---|---|---|
| `controle-tapetes-g28` | `work/g28-document-qualification` @ `06b5683` | **limpo** | +555 | (sem upstream local; = staging, `0 0`) | **Frente ativa** G28; com backup remoto agora |
| `controle-tapetes` | `work/app-next` @ `26111e0` | ⚠️ **SUJO** | +456 | **11 atrás** de `staging/work/app-next` | Linha app-next; **divergente + não commitado** |
| `controle-tapetes-g27` | `work/g27-document-recognition-safety` @ `247345c` | limpo | +467 | (sem remoto) | G27 (document-recognition-safety); ancestral de g28 → **já incorporado** |
| `controle-tapetes-controlled-delete-gate` | **detached** @ `2a492f0` | limpo | +232 | (`staging/HEAD~70`) | Gate do controlled-delete parado em ancestral antigo (2026-07-06) |

**Sinais:**
- **`app-next` divergente (confirma closeout L59):** 11 commits atrás do remoto **E** worktree sujo — `MM PROJECT_STATE.md`, `MM AGENT_HANDOFF.md`, workflow deletado, `?? docs/architecture/DOCUMENTOS_VALIDACAO_VINCULOS_E_EVOLUCAO_PLANO.md` untracked, mudanças no `documents-ingestor`. Ponto de risco real.
- **Detached (`controlled-delete-gate`)** parado em `2a492f0` (merge-base comum de todos os branches, `staging/HEAD~70`) — worktree órfão de propósito concluído.
- `g27` e o detached não têm cópia remota; `g28` agora tem (backup desta sessão).
- O plano mestre já lista **"limpeza de worktrees"** entre os `ITENS EXPLICITAMENTE DIFERIDOS` (L963).

---

## 4. Evidência factual da validação da seção de Documentos (SEM classificar aceite)

Usando os rótulos separados exigidos (§17.4 da governança). **Não classifico aceite — decisão do arquiteto.**

| Dimensão | Evidência factual |
|---|---|
| DIAGNOSED | ✅ G28-A/B1 (contrato de domínio) |
| DECIDED | ✅ B1–B8 decisões registradas no ledger |
| IMPLEMENTED | ✅ pipeline completa (Ingestor + fila + modal + superfícies + correção/revogação/restauração/auditoria) |
| TESTED (local) | ✅ baterias extensas: B4–B8 **831/831**; controlled-delete **53/53**; ACL grants **21/21**; múltiplos smokes verdes |
| STAGING FUNCTIONALLY VERIFIED (RPC-level) | ✅ `db/51` matriz RPC **20/20**; `db/52` matriz **18/18** (registry `20260715024449`); G28-C matriz staging/projeções **16/16**; fixtures sintéticas, cleanup zero |
| **BROWSER (autenticado)** | ❌ **NUNCA EXECUTADO** — `AUTHENTICATED_BROWSER_SMOKE_BLOCKED_BY_TOOLING` / `LIVE_B8_MODAL_SMOKE_BLOCKED_BY_TOOLING`, recorrente em B6/B7/B8/C/D e Portal Cliente (sem app/sessão admin no browser) |
| ACCEPTED (registrado) | Canon registra G28-C `CLOSED / ACCEPTED_WITH_NONBLOCKING_AUTHENTICATED_BROWSER_SMOKE_DEBT` como **decisão arquitetural explícita** (closeout `a7d7caa`, aceite `d5ec09f`); B8 subsumido por C |
| VALIDAÇÃO MANUAL DO ARQUITETO | **Sem evidência registrada** de validação funcional/pessoal da seção de Documentos pelo arquiteto (closeout L36, L53) |

**Assimetria factual relevante:** o fluxo **Pedido/OP/Admin** recebeu **validação visual em browser real** contra staging (auditoria §9.6/§9.7 de 2026-07-05: Pedidos #13/#14/#20/#21, crash do hub reaberto e corrigido em R2). A **seção de Documentos G28 não** — sua validação parou no nível de matriz RPC + testes locais. Dois padrões distintos de "validado" coexistem no repo.

---

## 5. Backlog remanescente — tabela única

| Frente / item | Status canônico | Escopo estimado | Risco | Dependências | Cabe staging-only? |
|---|---|---|---|---|---|
| **G28-CAMADA-2** (usuários) | DEFERRED; capacidade parcial existe | Alto (A1,A2,A4,A5,A6 + política senha) | Médio (segurança/auth) | Documentos estabilizado; ref. SGAA | **Parcial** (schema/RPC sim; Edge deploy sim; mas toca Auth) |
| **G28-CAMADA-3** (backup) | DEFERRED; nada implementado | Alto (BK1–BK8) | Médio | Frente independente; auditoria app-origem | **Parcial** (staging pode; teste de restauração real é sensível) |
| **G28-CAMADA-4** (fornecedores) | DEFERRED | Alto (F0–F5) | Médio | Documentos publicado | Sim (staging) |
| **G28-D** publicação | DEFERRED BY ARCHITECT / NOT AUTHORIZED | Médio | Alto (produção/deploy) | Backlog canônico completo | **Não** (exige produção/provedor) |
| **DEPLOYMENT_MAPPING_&_PROD_MIGRATION** | DEFERRED UNTIL GLOBAL BACKLOG COMPLETION | Médio-alto | Alto | Decisão de arquiteto | **Não** (produção) |
| **DELETE-PROD-GUARD-A** | P1 futuro / não iniciado | Médio (senha admin, soft-delete, auditoria) | Alto (destrutivo em prod) | Autorização + produção | **Não** (readiness de produção) |
| **DELETE-AUDIT-LOG-A** | P2 futuro / não iniciado | Baixo-médio (trilha auditável) | Baixo | DELETE-PROD-GUARD-A | Sim (staging) |
| **Fase J** (saldo por etapa) | FUTURE / UNSEQUENCED / NOT AUTHORIZED | Alto (RPC/trigger transacional) | Alto | Fase F, rastreabilidade item | Sim (staging) |
| **Aplicação em produção do stack staging-only** (db/12,21,30,49–57) | Postergada por STAGING-ONLY-BOUNDARY | Médio | Alto | Decisão de arquiteto | **Não** |
| **DB30_NOT_RECORDED_IN_MIGRATION_HISTORY** | Débito aberto (sem drift) | Baixo | Baixo | — | Sim |
| **AUTHENTICATED_BROWSER_SMOKE** (G28-C/D/B7/Portal) | Débito não bloqueante aberto | Baixo (tooling/sessão) | Baixo-médio | Sessão admin no browser | Sim |
| **OPs órfãs históricas** (11 OPs `lote.pedido_id` NULL; 9 lotes s/ Pedido) | Só diagnosticado; `ORPHAN-OP-DATA-TRIAGE-R1` **cancelada/nunca autorizada** | Médio (backfill/decisão de produto) | Médio | Decisão de produto | Sim (staging) |
| **Limpeza de worktrees** (app-next divergente/sujo; detached órfão) | DIFERIDO (plano L963) | Baixo | Baixo-médio (perda local) | — | Sim (local/git) |
| **Débitos técnicos diferidos** (8 erros TS históricos, vulnerabilidades npm, metadata órfã, acúmulo de manifest remoto) | DIFERIDOS (plano L960–964) | Variado | Baixo | Fases próprias | Sim |

> **Nota (memória vs. canon):** o item "reuso de numeração de OP" (soft-delete vs. sequência monotônica) que consta em memória de sessões anteriores **não** aparece como item de backlog canônico aberto — o canon fixa `op_numeros` como high-water não reciclado. Sinalizado como possível decisão latente, **não** confirmada como frente aberta.

---

## 6. DIVERGÊNCIAS (canônicos × código real × closeout ChatGPT) — com evidência

| # | Divergência | Fontes | Verdito |
|---|---|---|---|
| **D1** | Camada 2 classificada como "implementação aceita/concluída" | Closeout L13,47–48 atribui isso ao relatório ChatGPT **PROJECT-CONTROL-BASELINE-R1**; canon (plano L1025; `PROJECT_STATE.md:164`,185,200) = `DEFERRED`; código = parcial | **Canon + código CONCORDAM com o closeout**: Camada 2 não está completa. `PROJECT-CONTROL-BASELINE-R1` aparece **só no closeout**, nunca no canon → sua má-classificação **nunca foi adotada** como autoridade. Divergência é ChatGPT-R1 × (canon+código), já sinalizada pelo próprio closeout. **Não é defeito do canon.** |
| **D2** | Canon não distingue "capacidade parcial já existente" de "escopo pleno pendente" na Camada 2 | Closeout L25,49–51; código mostra capacidade substancial (CRUD usuários, disable, papéis-string, vínculo cliente/fornecedor) que o canon rotula apenas como linha única `DEFERRED` | **Divergência real de documentação** entre a moldura "DEFERRED/futura" do plano mestre e o código que já implementa A3 + parte de A5/A7. A capacidade AUTH existe documentada em `docs/DOCUMENTATION_INDEX.md` §4 e runbooks, mas **não** cruzada sob "Camada 2 = parcial". **PROPOSED** (não aplicado): reclassificar Camada 2 como capacidade parcial + escopo pleno diferido. |
| **D3** | Camada 3 backup | Canon (DEFERRED, BK1–BK8) × código (nada) × closeout (não implementada) | **CONVERGÊNCIA total** — sem divergência. |
| **D4** | Seção de Documentos "ACCEPTED" vs. profundidade de validação | Canon: G28-C `CLOSED/ACCEPTED` (decisão explícita `d5ec09f`); closeout L36–37,52–53: sem validação funcional/pessoal do arquiteto, smoke browser nunca rodado | **Ambos os fatos são verdadeiros**; a divergência é de **interpretação** ("ACCEPTED técnico/staging" vs. "aceite funcional de produto"). Reservado ao arquiteto (item 4). Reforçado pela assimetria: Pedido/OP teve browser real, Documentos não. |
| **D5** | Classificação de publicação G28-D | Closeout L63 ("classificou publicação incorretamente") × canon (G28-D `DEFERRED/NOT AUTHORIZED/NOT PUBLISHED`, consistente em plano/PROJECT_STATE/HANDOFF) | **Canon íntegro e correto**: não afirma publicação. A crítica do closeout é ao ChatGPT anterior, não ao canon. Canon + realidade concordam: não publicado. |
| **D6** | Worktree `app-next` divergente | Closeout L59 × git real (11 atrás + sujo) | **CONFIRMADO** pela auditoria git. Item aberto real (higiene de worktree), já diferido no plano L963. |
| **D7** | Instabilidade de supervisão ChatGPT (alterou conclusões, confundiu fim-de-fase com fim-de-backlog, tratou capacidade parcial como concluída, misturou conclusão técnica com aceite) | Closeout L60–66 | Minha revisão **corrobora** os pontos substantivos: a distinção capacidade-parcial (D2) e técnico-vs-funcional (D4) são reais; o canon atual **já** separa "fase ativa: NONE" de "backlog aberto" corretamente (`AGENT_HANDOFF.md:7`). |

---

## PLAN_ALIGNMENT (bloco literal §17.8)

```
PLAN_ALIGNMENT: RECONCILED (read-only)
MASTER_PLAN: docs/architecture/DOCUMENTOS_VALIDACAO_VINCULOS_E_EVOLUCAO_PLANO.md (G28-PLAN-R1)
LAST_ACCEPTED_PHASE: DOCS-PEDIDO-OP-LEGACY-PLAN-STATUS-CONSISTENCY-R1 (CLOSED/ACCEPTED); última fase funcional G28 = G28-C
CURRENT_PHASE: NONE (nenhuma fase funcional ativa)
NEXT_AUTHORIZABLE_ACTION: NONE — ARCHITECT DECISION REQUIRED (sem candidato técnico único inequívoco)
OPEN_ARCHITECT_DECISIONS: seleção da próxima frente (Camada 2 parcial→completa / Camada 3 / Camada 4 / DELETE-PROD-GUARD-A / Fase J / DEPLOYMENT_MAPPING); classificação de aceite da seção de Documentos (técnico vs. funcional); reclassificação PROPOSED da Camada 2
DEFERRED_PHASES: G28-D publicação; DEPLOYMENT_MAPPING_AND_PRODUCTION_MIGRATION_PROCEDURE; G28-CAMADA-2/3/4; DELETE-PROD-GUARD-A; DELETE-AUDIT-LOG-A; Fase J; aplicação em produção do stack staging-only; limpeza de worktrees; débitos técnicos (TS/npm/metadata/manifest)
STATE_FILES_UPDATED: NONE (diagnóstico read-only)
MATERIAL_DIVERGENCES: nenhuma divergência material ENTRE canônicos (canon internamente consistente). Divergências canon×código×closeout catalogadas no §6 (D1–D7); nenhuma exige HARD STOP.
```

---

## Gate HARD STOP (divergência material entre canônicos)

**NÃO acionado.** Os documentos canônicos estão internamente consistentes quanto a estado (`ACTIVE_PHASE: NONE`, `NEXT_AUTHORIZABLE_ACTION: NONE`), débitos e camadas diferidas. A única inconsistência textual candidata — a nota de "lacuna db/37 sem D-DEL próprio" em `PEDIDO_OP_MOVIMENTACAO_DOCUMENTOS_PLANO.md` L345-347 — foi **verificada como já resolvida** (`D-DEL14` existe em `SCHEMA_CONTRACT` §10 L640; backfill documentado). É nota histórica, não estado corrente incorreto → **não-material**.

---

## Síntese

1. **A tese central do closeout resiste à verificação no código:** Camada 2 é capacidade **parcial**, Camada 3 **inexiste**, G28-D **não publicado** — e o **canon já concorda** com isso. O erro foi do relatório ChatGPT `PROJECT-CONTROL-BASELINE-R1` (artefato externo, nunca canônico), não da documentação do repo.
2. **Duas decisões do arquiteto destravam o backlog:** (a) reclassificar a **Camada 2** como capacidade parcial + escopo A1–A7 diferido (PROPOSED pronto acima); (b) definir se o **aceite da seção de Documentos** é técnico/staging ou requer validação funcional do arquiteto (o smoke autenticado de browser nunca rodou).
3. **Risco operacional pontual:** o worktree **`app-next`** está sujo e 11 commits atrás do remoto — vale uma decisão de higiene (commitar/descartar/sincronizar) em fase própria.

Nenhuma ação foi executada neste diagnóstico — decisões subsequentes do arquiteto estão registradas em `PROJECT_STATE.md` (`G28-RECONCILIATION-DECISIONS-A`) e `docs/ledgers/G28_LEDGER.md`.
