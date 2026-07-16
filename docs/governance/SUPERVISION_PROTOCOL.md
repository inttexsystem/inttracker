# Protocolo de Supervisão — Ravatex Controle de Tapetes

> Registrado em 2026-07-15 (fase `CAMADA2-USUARIOS-A3-2-CLOSEOUT`), a
> partir da reconciliação de governança de `G28-RECONCILIATION-DECISIONS-A`
> (ver `PROJECT_STATE.md`), que já havia transferido o acompanhamento de
> progresso para Claude (chat) + Claude Code (residente) e reduzido o
> ChatGPT a consultor sem custódia de estado.
> Este documento formaliza os papéis e o formato de ordem para qualquer
> parecerista (humano ou IA) que participe da supervisão do projeto.
> **Não é fonte de estado.** Estado operacional vive em `PROJECT_STATE.md`;
> continuidade em `AGENT_HANDOFF.md`; histórico em ledgers por frente.

---

## 1. Papéis

### ARQUITETO

- Único que **decide, autoriza, valida e aceita**.
- Emite ordens com autorização explícita por subfase.
- Executa validação visual manual quando UI nova está envolvida.
- Decide micro-decisões bloqueadas por HARD STOP (ex.: necessidade de
  migration).

### PARECERISTA

- Revisa relatórios, redige ordens, ajuda a formular decisões.
- **Substituível** — qualquer parecerista (ChatGPT, outro chat, outro
  modelo) pode ocupar esse papel.
- **Nunca custodia estado.** Uma afirmação do parecerista sobre o
  projeto não vira fato até ser verificada e registrada pelo executor
  residente nos arquivos canônicos.
- Em caso de dúvida sobre o estado real, deve pedir verificação no
  código/repositório ao executor residente — nunca inferir de memória
  de conversa ou de documentação não confirmada.

### EXECUTOR RESIDENTE

- (Claude Code, Codex ou equivalente com acesso direto ao repositório.)
- Executa o que foi autorizado, dentro do escopo exato da ordem.
- Roda testes, valida sintaxe, confirma manifesto de arquivos antes de
  commitar.
- Atualiza os documentos canônicos (`PROJECT_STATE.md`,
  `AGENT_HANDOFF.md`, ledgers) no closeout de cada fase.
- Reporta qualidade técnica, inspeção de repositório e resultado de
  testes — o parecerista não assume essas informações sem essa
  verificação.

## 2. Onboarding de um parecerista novo

Antes de opinar sobre estado, backlog ou próxima ação, um parecerista
novo (ou uma sessão nova de um parecerista existente) deve ler, nesta
ordem:

1. `AGENT_HANDOFF.md` — continuidade e caminhos obrigatórios.
2. `PROJECT_STATE.md` — estado operacional atual por frente.
3. O plano/spec da frente ativa (ex.: `docs/architecture/CAMADA2_USUARIOS_SPEC_PROPOSED.md`
   para `G28-CAMADA-2`).
4. O ledger da frente (ex.: `docs/ledgers/G28_LEDGER.md`).

Nada que um parecerista disser sobre o estado do projeto vira estado
até passar pelos documentos canônicos, atualizados pelo executor
residente após verificação real.

## 3. Formato de ordem

Toda ordem emitida ao executor residente deve conter:

- **Bloco de configuração:** modelo, esforço, motivo da escolha (e
  critério de quando escalar esforço/modelo).
- **Fase:** identificador da subfase, tipo (refactor puro / feature
  aditiva / docs-only / diagnóstico read-only).
- **Escopo:** o que fazer, item por item.
- **Arquivos permitidos:** lista explícita — nada fora dela sem parar
  e reportar.
- **Proibições:** o que não fazer (ex.: sem write novo, sem Auth, sem
  push).
- **Testes:** gate mínimo exigido antes do relatório.
- **Hard stops:** condições que exigem parar e reportar em vez de
  decidir sozinho (ex.: necessidade de migration, acoplamento que
  exija tocar arquivo fora do manifesto, ambiguidade entre spec e
  código real).
- **Relatório obrigatório:** formato esperado da resposta. Toda fase de
  implementação (não docs-only) inclui seção própria `STRUCTURAL POLICY
  COMPLIANCE`: regras aplicáveis de `docs/architecture/CODE_HEALTH_RULES.md`
  citadas por número, evidência de conformidade item a item e tamanho em
  linhas de cada arquivo tocado (novo ou modificado).

**Autorização é explícita por subfase — fases não se encadeiam
automaticamente.** Uma ordem cobre exclusivamente o que autoriza.

## 4. Gates

- **Validação visual do arquiteto** é obrigatória para qualquer UI
  nova ou alterada — o relatório do executor para em
  `IMPLEMENTAÇÃO VALIDADA / AGUARDANDO VALIDAÇÃO VISUAL DO ARQUITETO`
  e só fecha após o OK explícito.
- **Mockup aprovado** é pré-requisito antes de implementar elemento
  visual novo (não apenas ajuste de dado sobre elemento já existente).
- **Migration é gate próprio.** Necessidade de schema novo interrompe
  a subfase corrente; a migration em si exige autorização separada,
  mesmo que a subfase que a revelou já esteja autorizada.
- **Auth é risco à parte.** Qualquer mudança que toque
  `auth.admin.*` novo ou configuração de Auth do projeto Supabase é
  classificada e reportada separadamente de schema/RPC/Edge comuns
  (ver `docs/architecture/CAMADA2_USUARIOS_SPEC_PROPOSED.md`, tabela
  de risco Auth).

---

> Em conflito com qualquer documento canônico listado em
> `docs/DOCUMENTATION_INDEX.md` §1, o canônico prevalece — este
> protocolo rege o processo de supervisão, não o estado do projeto.

---

## Apêndice — Handoff de supervisão — bloco padrão

Bloco genérico, sem contexto imediato, para abrir qualquer sessão nova de
parecerista/supervisor (humano ou IA). Registrado verbatim pelo arquiteto em
2026-07-15.

```text
HANDOFF DE SUPERVISÃO — RAVATEX CONTROLE DE TAPETES

PAPEL DESIGNADO: PARECERISTA/SUPERVISOR conforme
docs/governance/SUPERVISION_PROTOCOL.md. Você NÃO é o executor
nesta sessão. Você NÃO custodia estado: tudo que propuser só
existe quando registrado nos canônicos por ordem executada.

INTEIRAR-SE AGORA, NESTA ORDEM:
  1. PROJECT_STATE.md — estado vigente (único dono do estado
     operacional)
  2. AGENT_HANDOFF.md — continuidade e última fase aceita
  3. docs/governance/SUPERVISION_PROTOCOL.md — papéis, formato
     de ordem, gates
  4. Demais canônicos listados no CLAUDE.md, conforme necessidade

REGRAS DE SUPERVISÃO:
  - Ordens que redigir seguem o formato do protocolo
    (configuração de modelo/esforço, escopo, arquivos
    permitidos, hard stops, relatório)
  - Nenhuma fase se encadeia; cada subfase exige autorização
    explícita do arquiteto (eu)
  - Não alegar leitura/execução/verificação que não fez de fato
  - Divergência entre sua conclusão e os canônicos: canônicos
    vencem; citar e perguntar, nunca corrigir silenciosamente

PRIMEIRA RESPOSTA OBRIGATÓRIA: fase ativa, última fase aceita,
próxima ação autorizável e decisões de arquiteto pendentes —
extraídos dos canônicos, com caminho citado. Nenhuma
recomendação antes disso.
```
