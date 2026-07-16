# CAMADA 2 — Administração de Usuários — Spec Proposta

> **Status:** `PROPOSED` — nenhuma subfase autorizada por este documento.
> **Fase de origem:** `CAMADA2-USUARIOS-SPEC-DIAGNOSTIC-R1` (diagnóstico
> read-only cross-repo, 2026-07-15), revisado e incorporado com decisões
> do arquiteto em `CAMADA2-USUARIOS-SPEC-MATERIALIZE-R1`.
> **Referência funcional/visual:** `D:\OneDrive\Programação\SGAA_clean_baseline`
> (projeto Flask/SQLite não relacionado — ver caveat abaixo).
> **Não é fonte de estado atual.** Estado operacional vive em
> `PROJECT_STATE.md`; continuidade em `AGENT_HANDOFF.md`; histórico em
> `docs/ledgers/G28_LEDGER.md`.

---

## CAVEAT CRÍTICO — SGAA não é referência de segurança

O SGAA_clean_baseline (Flask + SQLite, stack completamente distinta de
Supabase/JS) tem pelo menos **quatro práticas que esta spec REJEITA
explicitamente, não adapta**:

1. **Senhas padrão por papel armazenadas e exibidas em texto puro** na
   tela admin, inclusive no atributo `value=` de um
   `<input type="password">` (visível em view-source/devtools) —
   `admin_acesso.html:201-245`, `main.py:499-505`. É o oposto do que o
   plano mestre do Tapetes já exige (senha temporária deve expirar, ser
   de uso único, não recuperável, não reutilizada entre usuários — plano
   mestre L711-716).
2. **Zero política de complexidade de senha** — nenhum length/character-class
   check em lugar nenhum do SGAA.
3. **Zero auditoria** — nenhuma tabela ou log de quem criou/editou/desativou/
   resetou um usuário.
4. **Confirmação destrutiva via `window.confirm()` nativo do browser**, não
   modais próprios — o Tapetes já tem `confirmDialog()` em `js/ui.js:100-111`,
   superior visualmente e funcionalmente.

**Uso correto do SGAA nesta spec:** referência de **arquitetura de
informação e organização de tela** (modelo de dois eixos papel+permissão,
cards de resumo por papel, toolbar busca/ordenar/filtrar, badges de
status, ícone-por-ação) — nunca de política de segurança. Onde os dois
conflitam, o padrão mais rígido do plano mestre do Tapetes prevalece.

---

## Baseline visual Tapetes (a estender — não a redesenhar)

`screenCadastrosUsuarios` (`js/screens/cadastros.js:2226-2713`, dentro de
um arquivo de 2.750 linhas com 7 telas embutidas) já estabelece uma
linguagem visual própria e coerente para esta tela: grid CSS customizado,
badges de status (`#e6f4ec`/`#18794a` ativo, `#fff1f1`/`#d6403a` inativo),
botões de ação só-ícone com estados disabled/opacity, busca com ícone,
toggle "Mostrar inativos", paleta `#16203a`/`#8a93a3`/`#2563eb`/`#d8dce2`/
`#eceef1`, `border-radius` baixo (4-6px). **Esta é a linguagem a
estender**, não o `dataTable()` genérico de `js/ui.js` (que a própria
tela atual já não usa) nem o card-list do SGAA.

Do SGAA, esta spec toma emprestado apenas **ideias de organização**,
redesenhadas com os tokens acima: cards de resumo por papel no topo,
toolbar busca+ordenar+filtro, badge de papel com cor por tipo, ícone por
ação (Lucide-style, já usado em `cadastros.js` via `svgIcon()`).

---

## Decisões do arquiteto incorporadas (2026-07-15)

Estas decisões substituem as opções levantadas no diagnóstico original —
não são mais escolhas em aberto, são premissas desta spec:

- **`nivel_acesso`:** 2 níveis (`completo` / `somente_leitura`), CHECK
  constraint simples, expansível depois se necessário.
- **Tabela de overrides (`usuarios_permissoes`):** **NÃO CONSTRUÍDA**
  nesta spec. Registrada como opção futura, condicionada a necessidade
  real demonstrada — não pré-construída especulativamente.
- **A4 (convite/senha inicial):** caminho único = senha temporária +
  troca forçada no primeiro login. **A4.3 (convite por e-mail/SMTP):
  `NOT AUTHORIZED`** — requer diagnóstico de risco Auth próprio em ordem
  separada; não agendado nesta spec.
- **A3.3 (bulk actions):** `DEFERRED` — risco de escrita em massa
  desproporcional ao tamanho atual da base de usuários do Tapetes.

---

## A1 — Diagnóstico da autenticação

- **SGAA faz:** sessão Flask hand-rolled (cookie assinado), sem
  Flask-Login real (importado mas morto no código), sem JWT, hashing
  PBKDF2-SHA256/600k iterações, CSRF via Flask-WTF, rate-limit em memória
  (não multi-worker-safe, documentado como tal).
- **Já existe no Tapetes:** `auth.users` (Supabase Auth) + `public.usuarios`
  1:1 por UUID (`auth.users.id = public.usuarios.id`, invariante protegida
  por `CODE_HEALTH_RULES.md` §11); `js/auth.js` (151 linhas) —
  `signInWithPassword`, `getSession`, singleton `CURRENT_USER`; RLS via
  `is_admin()`/`meu_fornecedor_id()`/`meu_cliente_id()` (`db/12`, `db/14`).
- **O que falta:** nada estrutural — Tapetes já está estruturalmente à
  frente do SGAA aqui (JWT + expiração + revogação nativas do Supabase
  Auth vs. cookie sem qualquer revogação no SGAA).
- **Proposta:** nenhuma mudança de mecanismo. A1 se resume a documentar
  formalmente o que já existe (este documento) como baseline para A2-A7.
- **Módulos/arquivos:** nenhum novo.
- **Riscos (Auth!):** nenhum — sem mudança de Auth nesta etapa.
- **Subfase/gate:** A1 = `DIAGNOSED / DECIDED` por este próprio documento;
  não requer implementação.

---

## A2 — Papéis e permissões

- **SGAA faz:** dois eixos — `usuarios.tipo` (admin/aluno) + `nivel_acesso`
  (string livre, 5 valores) + tabela de override granular
  `usuarios_permissoes_acesso(usuario_id, recurso, escopo)` com 15
  recursos × 4 escopos, mesclados via `merge_resource_scopes()`.
- **Já existe no Tapetes:** só um eixo — `usuarios.tipo ∈ {admin,fornecedor,cliente}`
  (CHECK constraint, `db/14:66`), sem tabela de permissões (confirmado por
  busca exaustiva em `db/*.sql`: zero ocorrências). Enforcement =
  `roles:[...]` por rota (`js/boot.js`) + RLS.
- **O que falta:** qualquer granularidade dentro de `admin` (hoje é
  tudo-ou-nada).
- **Decisão do arquiteto:** `nivel_acesso` com **2 níveis**
  (`completo`/`somente_leitura`), CHECK expansível; **sem** tabela de
  overrides nesta spec.
- **Proposta:**
  1. Manter `usuarios.tipo` intocado (âncora de todo o RLS existente).
  2. Adicionar `usuarios.nivel_acesso TEXT NOT NULL DEFAULT 'completo'`,
     `CHECK (nivel_acesso IN ('completo', 'somente_leitura'))` —
     relevante apenas para `tipo='admin'`.
  3. Helper `is_admin_completo()` (ou equivalente), mesmo padrão
     `SECURITY DEFINER STABLE` de `is_admin()` (`db/12:59-78`), exigindo
     `ativo IS TRUE`.
  4. Registro futuro (não construído agora): se o arquiteto confirmar
     necessidade real de override por usuário, avaliar
     `public.usuarios_permissoes(usuario_id, recurso, escopo)` no mesmo
     formato do SGAA, dimensionada à necessidade real demonstrada.
- **Módulos/arquivos previstos:**
  - `db/5X_admin_nivel_acesso_schema.sql` — coluna + CHECK + função
    helper (schema/RPC, staging-only, sem tocar Auth).
  - `js/screens/admin-usuarios-modal.js` (novo) — inclui select de nível
    quando `tipo=admin`.
- **Riscos (Auth!):** nenhum — puro schema/RLS em `public.`, zero chamada
  `auth.admin.*`. **Staging ok.**
- **Subfase/gate:** A2.1 (schema+helper, staging) → A2.2 (wiring no modal
  de criação/edição, parte de A3.1/A3.2 conforme cronograma) → A2.3
  (enforcement em pelo menos 1 rota piloto antes de expandir).

---

## A3 — Administração de usuários

- **SGAA faz:** tela lista+modal única (`admin_acesso.html`), 5 cards-resumo
  por papel, toolbar busca/ordenar/filtrar, bulk actions (selecionar
  todos/deletar/resetar/nova senha), linha em grid de `<div>` (não
  `<table>`), pill de ação flutuante no hover.
- **Já existe no Tapetes:** `screenCadastrosUsuarios` (`cadastros.js:2226-2713`)
  já cobre: listar (busca+toggle inativos), criar (`openModal`→Edge
  `admin-create-user`), editar (PostgREST `.update()` direto — sem Edge
  Function, sem campo de senha), desativar (`admin-disable-user`),
  excluir hard (`admin-delete-user`, confirma e-mail alvo).
- **O que falta:** cards de resumo por papel; coluna de último acesso; a
  tela vive dentro de um arquivo de 2.750 linhas com 7 telas — violação
  ativa do §7 (`CODE_HEALTH_RULES.md`, limite excepcional 900 linhas).
- **Proposta:** extrair a funcionalidade de usuários para módulos
  próprios (fora de `cadastros.js`), preservando 100% do comportamento
  visual/grid já existente.

### A3.1 — Extração 1:1 + cutover de rota (ajuste de revisão)

Diferente do diagnóstico original, **A3.1 já termina com o cutover de
rota**, não apenas com a extração:

1. Portar `screenCadastrosUsuarios` 1:1 (sem feature nova) para os novos
   módulos abaixo.
2. Trocar o handler da rota `#/cadastros/usuarios` em `js/boot.js` de
   `screenCadastrosUsuarios` para `screenAdminUsuarios`.
3. **Validação visual do arquiteto obrigatória** antes de aceitar A3.1 —
   paridade 1:1 confirmada na tela real.
4. `screenCadastrosUsuarios` **permanece em `cadastros.js` como código
   morto** até A3.4 (não removido ainda — isolamento de refactor vs.
   cutover, §14).

### A3.2 — Cards-resumo, toolbar e último acesso (gate de mockup)

- **Gate de entrada:** A3.2 **só inicia após aprovação pelo arquiteto de
  mockup** dos cards-resumo por papel + toolbar busca/ordenar/filtro
  (elementos visuais novos, sem precedente direto na tela atual), sobre
  os tokens já citados na Baseline Visual acima.
- **Último acesso — escopo incluído nesta subfase:** nova coluna
  read-only no grid, lendo `auth.users.last_sign_in_at` (a via de leitura
  exata — RPC `SECURITY DEFINER` vs. campo já exposto via sessão admin —
  é definida dentro da própria subfase; sem write em nenhum caso).
- Cards de resumo por tipo (Admin/Fornecedor/Cliente + ativos/inativos),
  seguindo o padrão de `pageHeader()`.
- Toolbar busca+ordenar+filtro, mesma paleta da baseline visual.

### A3.3 — Bulk actions

**`DEFERRED`** por decisão do arquiteto — risco de escrita em massa
desproporcional ao tamanho atual da base de usuários do Tapetes. Não
agendado; retomar apenas mediante nova decisão explícita.

### A3.4 — Cutover final (refactor puro, isolado)

Ajuste de revisão: A3.4 deixa de ser "cutover de rota" (já feito em
A3.1) e vira **exclusivamente a remoção do código legado** de
`screenCadastrosUsuarios` em `cadastros.js` — fase isolada, refactor
puro, sem mistura com feature (§14). Reduz `cadastros.js` em ~490 linhas
(2226-2713).

- **Módulos/arquivos previstos:**
  - `js/screens/admin-usuarios.js` (novo, orquestração/render, ≤500
    linhas) — `screenAdminUsuarios()`, cards-resumo, busca, toggle, grid
    (portado 1:1 do visual atual).
  - `js/screens/admin-usuarios-modal.js` (novo, criar/editar) — mesmo
    formato 3-arquivo do precedente `document-link-admin-modal.js`.
  - `js/admin-usuarios-writes.js` (novo, writes explícitos — padrão
    `entrega-writes.js`/`op-writes.js`, §9): encapsula
    `functions.invoke('admin-create-user'|'admin-disable-user'|'admin-delete-user'|...)`.
  - `js/boot.js` — troca o handler da rota `#/cadastros/usuarios` (A3.1).
  - `index.html` — adicionar `<script src="js/screens/admin-usuarios.js?v=<versão vigente>"></script>`
    e `<script src="js/screens/admin-usuarios-modal.js?v=<versão vigente>"></script>`
    e `<script src="js/admin-usuarios-writes.js?v=<versão vigente>"></script>`
    na ordem correta de dependência (writes → modal → screen), com a
    versão de cache-busting vigente no momento da fase (§2/§12); sem
    `?v=` em CDNs.
- **Riscos (Auth!):** nenhum novo — reusa as 3 Edge Functions já
  existentes e já aceitas, sem tocar `auth.admin.*` de forma nova.
- **Gates de A3.1 (ajuste de revisão, §13):**
  - `node --check` nos arquivos JS novos/alterados.
  - Smoke test do módulo (`admin-usuarios`, `admin-usuarios-modal`,
    `admin-usuarios-writes`).
  - **Smoke de rota/boot** (obrigatório — `index.html`/`boot.js`/ordem de
    scripts foram alterados).
  - **Atualização dos smokes existentes de `index.html`** para aceitar o
    novo padrão `?v=` nos 3 scripts novos (§13).
  - Validação visual do arquiteto (paridade 1:1).
- **Subfase/gate consolidado:** A3.1 (extração + cutover + validação
  visual) → A3.2 (mockup aprovado → cards-resumo + toolbar + último
  acesso) → A3.3 `DEFERRED` → A3.4 (remoção do código legado, refactor
  isolado).

---

## A4 — Convite / senha inicial

- **SGAA faz:** sem convite algum — usuário é criado direto pelo admin
  com senha (customizada ou default-por-papel), comunicada fora de
  banda; zero capacidade de e-mail no repo inteiro.
- **Já existe no Tapetes:** o mesmo modelo — `admin-create-user` exige
  `password` no payload (mín. 6 chars, `index.ts:36,127`),
  `email_confirm:true` (sem verificação de e-mail), sem envio de e-mail,
  sem estado "pendente/convidado".
- **O que falta:** troca de senha obrigatória no primeiro login;
  qualquer capacidade de e-mail (Supabase Auth SMTP não configurado —
  sem `supabase/config.toml`, confirmado ausente).
- **Decisão do arquiteto:** caminho único = **senha temporária + troca
  forçada** (caminho 1 do diagnóstico). **A4.3 (e-mail/SMTP): `NOT
  AUTHORIZED`** — não agendado, requer diagnóstico de risco Auth próprio
  em ordem separada se o arquiteto quiser este caminho no futuro.
- **Proposta:**
  - `usuarios.senha_temporaria BOOLEAN NOT NULL DEFAULT FALSE` +
    `senha_gerada_em TIMESTAMPTZ`.
  - `admin-create-user` seta `senha_temporaria=TRUE` na criação.
  - Guarda no boot: se `senha_temporaria=TRUE` (ou expirada — ver
    Política de Senha), app força tela de troca antes de liberar
    qualquer rota, via `auth.updateUser({password})` **self-service**
    (não é chamada Admin API — baixo risco).
  - RPC/trigger zera a flag no momento da troca bem-sucedida.
- **Módulos/arquivos previstos:**
  - `db/5Y_admin_usuarios_senha_temporaria.sql` — colunas + default
    (cobre também a Política de Senha, ver abaixo).
  - `supabase/functions/admin-create-user/index.ts` — 1 linha adicional
    no insert (`senha_temporaria: true`).
  - `js/screens/trocar-senha-obrigatoria.js` (novo, ≤150 linhas) — tela
    de troca forçada, chamada a partir de `js/boot.js` (guarda pós-
    `loadCurrentUser`, antes de navegar para a rota real).
  - `index.html` — adicionar
    `<script src="js/screens/trocar-senha-obrigatoria.js?v=<versão vigente>"></script>`
    na ordem correta (após `js/auth.js`, antes do script inline principal
    que decide navegação), versão de cache-busting vigente, sem `?v=` em
    CDNs (§2/§12).
- **Riscos (Auth!):** **BAIXO** — self-service `auth.updateUser`, sem
  Admin API nova, staging ok.
- **Subfase/gate:** A4.1 (schema flag + política de senha, staging) →
  A4.2 (guarda de boot + tela de troca, self-service Auth, com
  atualização de `index.html`/cache-busting e smoke de rota/boot) →
  A4.3 **NOT AUTHORIZED** (sem subfase agendada).

---

## A5 — Reset, bloqueio e reativação

- **SGAA faz:** reset para senha-padrão-do-papel (texto puro,
  **rejeitado** — ver caveat) ou senha custom em massa; bloqueio só para
  "aluno" (`status='Inativo'`, e nem é verificado no login — achado
  factual: é apenas informativo, não é gate real); sem reativação para
  tipo "admin" (só hard-delete existe para esse eixo).
- **Já existe no Tapetes:** bloqueio via `admin-disable-user` (soft
  `ativo=false` + ban Auth `876000h`, com guardas self/último-admin — já
  mais robusto que o SGAA). **Reset de senha: não existe. Reativação:
  não existe.**
- **O que falta:** (a) reset de senha administrativo; (b) reativação
  (`ativo=true` + reverter ban).
- **Proposta:**
  1. **Reset:** nova Edge Function `admin-reset-user-password`, mesmo
     esqueleto de `admin-create-user` (validação JWT→admin→payload),
     gera senha temporária aleatória (não default-por-papel fixo — evita
     o anti-padrão do SGAA), chama
     `auth.admin.updateUserById(target_id, {password: novaSenhaAleatoria})`,
     seta `usuarios.senha_temporaria=TRUE` (reusa A4.1), nunca ecoa a
     senha em log, retorna a senha uma única vez na resposta HTTP.
  2. **Reativação:** nova Edge Function `admin-reactivate-user`,
     simétrica a `admin-disable-user` — `ativo=true`, limpa
     `desativado_em/por/motivo`, `auth.admin.updateUserById(target_id, {ban_duration: 'none'})`.
- **Módulos/arquivos previstos:**
  - `supabase/functions/admin-reset-user-password/index.ts` (novo,
    espelha o esqueleto existente).
  - `supabase/functions/admin-reactivate-user/index.ts` (novo, espelha
    `admin-disable-user`).
  - `js/admin-usuarios-writes.js` — 2 novas funções wrapper (mesmo
    arquivo já previsto em A3, sem novo módulo).
  - `js/screens/admin-usuarios.js` — 2 novos botões de ação (ícone reset
    / ícone reativar), reusando o estilo de botão-ícone já existente.
- **Riscos (Auth!):** **MÉDIO** — ambas usam
  `auth.admin.updateUserById`, superfície já usada no repo (para ban),
  mas com parâmetro novo (`password` / `ban_duration:'none'`) nunca
  exercitado. Requer verificação dedicada em staging (fixtures
  sintéticas, matriz de papéis) equivalente à recebida por
  `admin-disable-user`. **Staging ok, com verificação dedicada.**
- **Escopo explícito — revogação de sessão (ajuste de revisão):** **FORA
  DE ESCOPO** desta spec. O ban aplicado por `admin-disable-user` já
  cobre o caso crítico (usuário desativado perde acesso). Revogação
  explícita de uma sessão ativa específica (sem desativar a conta) não é
  construída aqui; reabertura exige decisão de arquiteto própria.
- **Subfase/gate:** A5.1 (reset — Edge Function + testes locais) → A5.2
  (staging verify da chamada `updateUserById({password})`) → A5.3
  (reativação — Edge Function + testes) → A5.4 (staging verify
  simétrico).

---

## A6 — Auditoria

- **SGAA faz:** nada — confirmado por busca exaustiva, zero
  tabela/coluna de auditoria para ações administrativas. Único log é
  técnico (falha de login, arquivo rotativo, sem UI).
- **Já existe no Tapetes:** só `desativado_em/desativado_por/motivo_desativacao`
  (`db/12:38-42`) — apenas para desativação.
- **O que falta:** trilha de auditoria para todas as ações
  administrativas sobre usuários.
- **Proposta:** seguir o precedente já aceito e testado neste repo —
  `document_link_revisions`/`document_link_revision_ops` (G28-B5) e
  `op_eventos`+trigger (`db/21`, Fase L) são exatamente este padrão
  (tabela de evento append-only + trigger automático).
  - Tabela `public.usuarios_eventos(id, usuario_id, tipo_evento, ator_id, payload JSONB, criado_em)`
    — mesmo desenho de `op_eventos`.
  - Trigger `trg_usuario_evento` em mudanças relevantes de `usuarios`
    (ativo, tipo, nivel_acesso) — fonte única de verdade.
  - Ações via Edge Function (create/delete/reset/reactivate, que usam
    `service_role` e não passam sempre por `UPDATE` direto) gravam
    explicitamente uma linha cada.
  - UI: painel de auditoria read-only no modal de edição do usuário
    (mirror do padrão já aprovado em `document-link-admin-modal.js`).
- **Módulos/arquivos previstos:**
  - `db/5Z_usuarios_auditoria_schema.sql` — tabela + trigger + RLS
    admin-only.
  - `js/admin-usuarios-audit-read-model.js` (novo, puro — mirror de
    `document-link-audit-read-model.js`, ≤200 linhas).
  - `js/screens/admin-usuarios-audit-panel.js` (novo, render read-only,
    ≤200 linhas).
  - As 3 Edge Functions existentes + as 2 novas (A5) ganham 1 insert
    cada em `usuarios_eventos`.
  - `index.html` — adicionar
    `<script src="js/admin-usuarios-audit-read-model.js?v=<versão vigente>"></script>`
    e `<script src="js/screens/admin-usuarios-audit-panel.js?v=<versão vigente>"></script>`
    na ordem correta (read-model antes do painel), versão vigente, sem
    `?v=` em CDNs.
- **Riscos (Auth!):** nenhum — puro schema/trigger/RLS em `public.`,
  nenhuma chamada `auth.admin.*` nova. **Staging ok.**
- **Subfase/gate:** A6.1 (schema+trigger, staging) → A6.2 (wiring das
  Edge Functions existentes) → A6.3 (painel read-only na UI, com
  atualização de `index.html`/cache-busting e smoke de rota/boot).

---

## A7 — Preparação para usuários externos

- **SGAA faz:** eixo `aluno` completamente isolado, zero acesso RBAC
  administrativo, escopo "só meus dados" via `aluno_id=?` ad hoc em cada
  view.
- **Já existe no Tapetes:** já implementado e mais maduro que o SGAA
  neste ponto — `usuarios.cliente_id`/`fornecedor_id` com constraint de
  vínculo exclusivo (`db/14:109-117`), RLS via `meu_cliente_id()`/
  `meu_fornecedor_id()` (não checks ad hoc espalhados), Portal Cliente
  completo (`#/cliente/*`).
- **O que falta:** essencialmente nada estrutural.
- **Proposta:** nenhuma implementação nova requerida. A7 é documentado
  como `SATISFIED BY EXISTING ARCHITECTURE`.
- **Módulos/arquivos previstos:** nenhum novo.
- **Riscos (Auth!):** nenhum.
- **Subfase/gate:** A7 = `DIAGNOSED / ALREADY SATISFIED` — sem subfase
  de implementação.

---

## Política de senha (transversal a A4/A5)

- **SGAA faz:** nenhuma regra de complexidade; senha padrão fixa e
  reutilizada por papel, em texto puro; hashing PBKDF2-SHA256/600k
  (razoável, mas sem ação aqui — gerenciado pelo Supabase Auth
  internamente).
- **Já existe no Tapetes:** só mínimo de 6 caracteres
  (`admin-create-user/index.ts:36`), sem expiração, sem uso-único, sem
  impedir reuso entre usuários.
- **O que falta:** os 4 requisitos do plano mestre (L711-716): expirar,
  uso único, não recuperável, não reutilizada entre usuários.
- **Proposta:**
  - **Uso único / expirar:** resolvido pela flag `senha_temporaria`
    (A4.1) — ao trocar, deixa de ser "a senha atual" por definição;
    `senha_gerada_em` permite checar expiração (ex.: 7 dias) no boot,
    forçando reset via A5 se expirado.
  - **Não recuperável:** já satisfeito — Edge Functions nunca persistem
    a senha em texto puro em lugar nenhum (nem log), só retornam na
    resposta HTTP uma vez.
  - **Não reutilizada entre usuários:** gerar senha temporária aleatória
    por chamada, nunca um valor fixo por papel — elimina de raiz o
    anti-padrão do SGAA.
  - **Complexidade mínima:** subir de 6 para 8 caracteres + pelo menos 1
    dígito, trivial de satisfazer automaticamente por senha gerada pelo
    sistema.
- **Módulos/arquivos previstos:** incorporado em A4.1/A5.1 (mesma
  migration/Edge Functions, sem arquivo extra dedicado).
- **Riscos (Auth!):** **BAIXO** — mudança de política de validação em
  `public.`/Edge Function, sem tocar configuração de Auth do projeto
  Supabase.

---

## Plano de módulos consolidado (atualizado com `index.html`/cache-busting)

| Arquivo | Tipo | Cobre | Linhas estimadas |
|---|---|---|---|
| `db/5X_admin_nivel_acesso_schema.sql` | Migration | A2 | ~80 |
| `db/5Y_admin_usuarios_senha_temporaria.sql` | Migration | A4, Política de senha | ~40 |
| `db/5Z_usuarios_auditoria_schema.sql` | Migration | A6 | ~120 |
| `supabase/functions/admin-reset-user-password/index.ts` | Edge Function (novo) | A5 | ~200 (mirror do existente) |
| `supabase/functions/admin-reactivate-user/index.ts` | Edge Function (novo) | A5 | ~180 (mirror do existente) |
| `supabase/functions/admin-create-user/index.ts` | Edge Function (existente, extensão pontual) | A4 | +5 linhas |
| `js/screens/admin-usuarios.js` | Screen (novo) | A3 | ≤500 |
| `js/screens/admin-usuarios-modal.js` | Modal (novo) | A2, A3 | ≤500 (mirror `document-link-admin-modal.js`) |
| `js/admin-usuarios-writes.js` | Writes (novo) | A3, A5 | ≤250 |
| `js/admin-usuarios-audit-read-model.js` | Puro (novo) | A6 | ≤200 (mirror `document-link-audit-read-model.js`) |
| `js/screens/admin-usuarios-audit-panel.js` | UI (novo) | A6 | ≤200 |
| `js/screens/trocar-senha-obrigatoria.js` | Screen (novo) | A4 | ≤150 |
| `js/boot.js` | Existente, edição pontual | A3.1 (cutover de rota), A4 | +poucas linhas |
| `index.html` | Existente, edição pontual | A3.1, A4.2, A6.3 | +8 linhas `<script>` (3+1+2 tags, versão de cache-busting vigente) |

Nenhum arquivo novo excede o limite "aceitável" (§7, 500 linhas); todos
seguem convenção de nomenclatura por domínio (§6).

**Localização dos módulos puros/writes na raiz de `js/` (não em
`js/screens/`):** `js/admin-usuarios-writes.js` e
`js/admin-usuarios-audit-read-model.js` seguem o precedente já
estabelecido e aceito do trio `document-link-admin-controller.js` /
`document-link-audit-read-model.js` (ambos na raiz de `js/`, não em
`js/screens/`) — decisão consciente de manter consistência com esse
precedente recente, não um desvio do §6 (que rege o conteúdo de
`js/screens/`, não a localização de módulos puros/controller
transversais).

---

## Classificação de risco Auth — resumo

| Item | Toca `auth.admin.*` novo? | Toca config. Auth do projeto? | Classificação |
|---|---|---|---|
| A1 | Não | Não | Nenhum risco |
| A2 | Não | Não | **Staging ok** |
| A3 | Não (reusa existentes) | Não | **Staging ok** |
| A4.1-A4.2 (senha temp.) | Não (self-service `updateUser`) | Não | **Staging ok, baixo risco** |
| A4.3 (convite e-mail) | Sim (`generateLink`) | **Sim (SMTP)** | **NOT AUTHORIZED — diagnóstico de risco próprio, não incluído nesta spec** |
| A5 (reset/reativação) | **Sim, novo parâmetro** (`password`, `ban_duration:'none'`) | Não | **Médio — staging ok com verificação dedicada** |
| A6 | Não | Não | **Staging ok** |
| A7 | Não | Não | Nenhum risco (já satisfeito) |
| Política de senha | Não | Não | **Staging ok** |

---

## Ordem recomendada de subfases com gates (atualizada)

| # | Subfase | Depende de | Gate de saída |
|---|---|---|---|
| 1 | A1 — consolidação documental | — | `DIAGNOSED/DECIDED` (satisfeito por este documento) |
| 2 | A2.1 — schema `nivel_acesso` (2 níveis) + helper | A1 | Staging aplicado + verificado |
| 3 | A3.1 — extração 1:1 + **cutover de rota** (`boot.js`) + `index.html`/cache-busting + smoke de rota/boot + validação visual do arquiteto | — (paralelo a A2.1) | Testes de regressão + smoke de boot verdes; paridade visual confirmada pelo arquiteto |
| 4 | A4.1 — schema `senha_temporaria`/`senha_gerada_em` + política de senha | — | Staging aplicado |
| 5 | A4.2 — guarda de boot + tela de troca obrigatória + `index.html`/cache-busting + smoke de rota/boot | A4.1, A3.1 | Teste local + staging smoke |
| 6 | A2.2/A2.3 — wiring de `nivel_acesso` no modal + 1 rota piloto | A2.1, A3.1 | Staging verificado |
| 7 | **Gate de mockup** — aprovação do arquiteto para cards-resumo + toolbar | A3.1 | Mockup aprovado |
| 8 | A3.2 — cards-resumo, toolbar, **último acesso** (`last_sign_in_at`) | Gate de mockup (7) | Staging verificado + validação visual |
| 9 | A5.1-A5.2 — reset de senha (Edge Function + staging verify) | A4.1 | Matriz de papéis em staging (mirror `admin-disable-user`) |
| 10 | A5.3-A5.4 — reativação (Edge Function + staging verify) | — (paralelo a A5.1-2) | Matriz de papéis em staging |
| 11 | A6.1-A6.3 — auditoria (schema+trigger, wiring, painel UI + `index.html`/cache-busting + smoke de rota/boot) | A3.1 (para o painel) | Staging verificado + smoke da UI |
| — | A3.3 — bulk actions | — | **`DEFERRED`** por decisão do arquiteto; não agendado |
| 12 | A3.4 — remoção do código legado em `cadastros.js` (refactor puro, isolado) | Todas as anteriores aceitas | Fase isolada, docs-only + diff mínimo |
| — | A4.3 — convite por e-mail/SMTP | Decisão de arquiteto separada | **`NOT AUTHORIZED`** — requer diagnóstico de risco Auth próprio |
| — | A7 | — | `ALREADY SATISFIED`, sem subfase |
| — | Revogação explícita de sessão | Decisão de arquiteto separada | **Fora de escopo** desta spec |

Nenhuma destas subfases está autorizada por este documento — cada uma
exige autorização explícita e individual do arquiteto no momento
próprio (regra permanente do projeto: fases não se encadeiam
automaticamente).

---

## Governança de refactor (§16 CODE_HEALTH_RULES.md)

`docs/refactor/ARCHITECTURE_REFACTOR_LEDGER.md` entra nos artefatos
obrigatórios de closeout de **A3.1** (novo módulo estrutural: extração de
tela + cutover de rota) e **A3.4** (mudança estrutural: remoção de código
legado de `cadastros.js`). As demais subfases (A2, A4-A6) não introduzem
módulo estrutural novo na acepção do §16 (são schema/Edge Function/painel
aditivos) e não exigem entrada neste ledger — apenas os artefatos de
closeout padrão (`PROJECT_STATE.md`, `AGENT_HANDOFF.md`, ledger G28).

---

## STRUCTURAL POLICY COMPLIANCE

- **Arquivos canônicos lidos:** `docs/reports/BACKLOG_RECONCILIATION_R1_2026-07-15.md` §1,
  `docs/architecture/CODE_HEALTH_RULES.md` (íntegro, 18 regras),
  `docs/architecture/DOCUMENTOS_VALIDACAO_VINCULOS_E_EVOLUCAO_PLANO.md`
  (Camada 2 §688-728), `PROJECT_STATE.md`/`AGENT_HANDOFF.md`.
- **Invariantes aplicáveis:** `auth.users.id = public.usuarios.id` (§11)
  — preservado, nenhuma proposta o toca; limite de tamanho de arquivo
  (§7) — todos os módulos novos dimensionados abaixo do teto aceitável;
  separação screen/writes/puro (§6, §8, §9) — respeitada explicitamente
  no plano de módulos; cache-busting (§2, §12) — endereçado
  explicitamente para cada subfase que altera `index.html`; testes
  proporcionais ao risco (§13) — gates de A3.1/A4.2/A6.3 incluem smoke de
  rota/boot; governança de refactor (§16) — ledger de refactor endereçado
  para A3.1/A3.4.
- **Propostas rejeitadas:** matriz de 15 recursos do SGAA (sobre-
  engenharia); senha padrão fixa por papel (vulnerabilidade);
  confirmação via `window.confirm()` nativo (regressão visual); tabela
  de overrides de permissões (não construída — sem necessidade real
  demonstrada); bulk actions (deferred); convite por e-mail (not
  authorized); revogação explícita de sessão (fora de escopo).
- **Conflitos encontrados:** nenhum entre canônicos do Tapetes; um
  conflito de prática entre SGAA e o plano mestre do Tapetes (política de
  senha) — resolvido a favor do padrão mais rígido já exigido pelo
  canônico do Tapetes.
- **Decisões reservadas ao arquiteto:** aprovação de mockup (gate antes
  de A3.2); autorização individual de cada subfase da tabela acima;
  eventual revisão futura de overrides de permissão, convite por e-mail
  ou revogação de sessão, cada uma como decisão separada.

## VISUAL POLICY COMPLIANCE

- **Arquivos/skills consultados:** `js/ui.js` (íntegro),
  `js/screens/cadastros.js:2226-2426` (grid/badges/ícones atuais),
  `js/screens/document-link-admin-modal.js` (padrão moderno de 3
  arquivos, referência estrutural).
- **Padrões reutilizados:** grid de linha já em uso na tela de usuários
  (não trocado por `dataTable()` genérico); paleta e tokens já
  consolidados; `confirmDialog()`/`modal()` de `js/ui.js` para toda nova
  confirmação (não `window.confirm()`).
- **Desvios visuais propostos:** cards-resumo por papel e toolbar
  busca+ordenar+filtro (novos, mas seguindo `pageHeader()`/paleta já
  usada) — **gate de mockup obrigatório antes de construir** (ver A3.2).
- **Evidência de aderência:** citada por arquivo:linha em cada seção
  acima.
- **Validação visual necessária:** sim, obrigatória antes de aceite de
  A3.1 (paridade 1:1) e de A3.2 (mockup + implementação dos elementos
  novos).

---

**PROPOSED — nenhuma subfase autorizada; cada uma exige autorização
explícita e individual do arquiteto.**
