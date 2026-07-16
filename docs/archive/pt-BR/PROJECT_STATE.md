# ESTADO ATUAL CANÔNICO

Este bloco é a única fonte de estado operacional atual por frente.
HEAD, working tree, staging e divergência devem ser consultados diretamente no Git.
O conteúdo histórico abaixo não determina o estado atual.

## DOC-LANGUAGE-MIGRATION-L1 — Governance Documents Translated to English — CLOSED / ACCEPTED

- **Front:** `DOC-LANGUAGE-MIGRATION`, batch `L1` (governance and rules) —
  docs-only translation slice. First English-authored state block of the new
  language era.
- **Classification: `CLOSED / ACCEPTED`** (architect acceptance, 2026-07-16).
- **Scope:** translated to English, content only (file names, anchors, paths
  and cross-references unchanged): `docs/architecture/CODE_HEALTH_RULES.md`,
  `docs/governance/SUPERVISION_PROTOCOL.md`,
  `docs/governance/DOCUMENTATION_MODEL.md`, `CLAUDE.md`. Each pt-BR original was
  moved, in the same commit, to `docs/archive/pt-BR/<original-path>`
  (byte-for-byte). The language policy is recorded in the canonical homes
  (`DOCUMENTATION_MODEL.md` §18, `CODE_HEALTH_RULES.md` §19,
  `SUPERVISION_PROTOCOL.md` §3; `CLAUDE.md` pointer-summary). Canonical status
  vocabulary, the architect verbatim handoff block, the gate marker
  `IMPLEMENTAÇÃO VALIDADA / AGUARDANDO VALIDAÇÃO VISUAL DO ARQUITETO`, and
  `DOCUMENTATION_MODEL.md` §17 were preserved verbatim.
- **Audit (separate high-effort pass):** 2 divergences found and corrected —
  `DOCUMENTATION_MODEL.md` H1 title left in Portuguese (audit pass);
  `CLAUDE.md` `**PROIBIDA**` → `**FORBIDDEN**` (resident-executor final
  review). No `[pt: ...]` pending items.
- **Runtime note (accepted by architect):** Sonnet 5 was unavailable in this
  environment; the translate and audit passes ran on the session model — the
  two-pass structure and the medium/high effort split were preserved.
- **Commits:** `cab741c` — `Translate governance documents to English (L1)`;
  plus the follow-up `Record L1 in project state and fix rule counts` (this
  block + CODE_HEALTH rule count 18→19 in `DOCUMENTATION_MODEL.md` §2,
  `CLAUDE.md` and `docs/DOCUMENTATION_INDEX.md`). Consult HEAD with
  `git rev-parse HEAD`.
- **Production:** `bhgifjrfagkzubpyqpew` not accessed. **Push:** not executed.
- **Next authorizable action:** `ARCHITECT DECISION` — batches `L2`/`L3`
  (further canonical-doc translation) are not authorized by this record.
- **Ledger:** `docs/ledgers/G28_LEDGER.md` (append-only entry for L1).

## Camada 2 — Reset de Senha Administrativo — A5.1-A5.2

- **Frente:** `G28-CAMADA-2`, subfase `A5.1-A5.2` de
  `docs/architecture/CAMADA2_USUARIOS_SPEC_PROPOSED.md`, autorizada após
  `A4.2`. `A5.3-A5.4` (reativação) explicitamente **não incluídas** —
  autorização própria futura.
- **Classificação: `CLOSED / ACCEPTED`** (e2e real em staging `result:
  PASS` 15/15 + fluxo verificado em navegador real pelo executor;
  validação visual do arquiteto **dispensada por decisão explícita**,
  coberta pela combinação e2e + verificação de fluxo).
- **Technical HEAD:** `b726717` — `Add admin password reset`
  (`supabase/functions/admin-reset-user-password/index.ts` (novo),
  `supabase/functions/admin-reset-user-password/README.md` (novo),
  `js/admin-usuarios-writes.js`, `js/screens/admin-usuarios.js`,
  `js/screens/admin-usuarios-modal.js`,
  `scripts/staging/admin-reset-password-e2e.mjs` (novo),
  `tests/admin-reset-user-password.smoke.js` (novo),
  `tests/admin-usuarios.smoke.js`). **Commit documental:** este
  closeout (`Close admin password reset phase`). O HEAD atual deve ser
  consultado com `git rev-parse HEAD`.
- **Decisão do arquiteto incorporada — auto-reset BLOQUEADO:** um
  admin não pode resetar a própria senha por `admin-reset-user-password`
  (`SELF_RESET_FORBIDDEN`) — usa o fluxo normal de troca (self-service,
  `A4.2`). Simplifica e evita o footgun de um admin trocar a própria
  senha por um valor gerado que ele mesmo não escolheu. Não há guarda
  de "último admin" (resetar senha não desativa ninguém).
- **Edge Function (`admin-reset-user-password`):** espelho do
  esqueleto `admin-disable-user` — JWT→admin ATIVO→payload; senha
  temporária gerada via `crypto.getRandomValues` (12 caracteres,
  charset sem ambiguidade visual, garantia determinística de ≥1
  dígito — nunca `Math.random`, nunca valor fixo);
  `auth.admin.updateUserById(target, {password})`; marca
  `senha_temporaria=true`/`senha_gerada_em=now()`; nunca loga a senha;
  retorna a senha uma única vez na resposta de sucesso. Falha do
  update de perfil pós-reset (senha já trocada no Auth, sem
  compensação segura possível) retorna erro explícito
  (`PROFILE_UPDATE_FAILED`), nunca sucesso silencioso.
- **UI:** botão de ícone chave na tela de usuários (mesma convenção
  visual dos botões existentes) → `confirmDialog` (nunca
  `window.confirm`) → em sucesso, modal "Senha gerada" com a senha
  exibida uma única vez, botão copiar (Clipboard API com fallback
  gracioso) e aviso de que não será reexibida. Erro → toast, sem
  estado ambíguo.
- **Deploy em staging (`ucrjtfswnfdlxwtmxnoo`) executado pelo
  arquiteto** — fora do alcance de credenciais desta sessão (agente IA
  não entra senha/token/API key em nenhum campo, regra permanente).
- **Verificação pós-deploy — E2E real em staging, `result: PASS`
  (15/15), executado pelo arquiteto** via
  `scripts/staging/admin-reset-password-e2e.mjs`
  (`test_user_id 170f8479-e2da-4a6d-b597-080716be9c20`): guardas
  `SELF_RESET_FORBIDDEN`/`NOT_FOUND` confirmadas ao vivo; reset real
  com flag+`senha_gerada_em` atualizados; senha antiga confirmada
  inválida após o reset; login com a senha temporária nova confirma
  `senha_temporaria=true` (gate `A4.2` dispararia); self-service de
  `A4.2` encadeado (nova troca + flag zerada); relogin com a senha
  final confirma `senha_temporaria=false` ("próximo login entra
  direto", sem gate); cleanup total via `admin-delete-user`, cleanup
  zero confirmado.
- **Testes locais:** `node --check` PASS em todos os arquivos
  tocados/novos; `tests/admin-reset-user-password.smoke.js` (novo,
  estático) **23/23** (guardas, régua da senha — simulação real de
  1000 amostras com `crypto.randomBytes`, sempre 8+ caracteres com
  dígito —, nunca loga a senha, estado parcial sem sucesso silencioso);
  `tests/admin-usuarios.smoke.js` estendido **29/29** (6 testes novos:
  botão + guarda de auto-reset, `confirmDialog`, fluxo de sucesso
  completo, fluxo de erro, write isolado); regressão consolidada (9
  suítes relacionadas) **268/275**, os 7 que falham são débito
  pré-existente confirmado idêntico ao baseline (6 de
  `tests/auth.smoke.js` + 1 de `tests/cadastros-*`, nenhum novo).
  `git diff --check` limpo.
- **Verificação visual sem credenciais (preview local, sem login) —
  aceita como evidência suficiente pelo arquiteto, dispensando gate de
  validação visual separado:** fluxo completo exercitado em navegador
  real com `window.supa` mockado — botão → `confirmDialog` (título e
  e-mail corretos) → confirmar → `invoke('admin-reset-user-password')`
  → modal "Senha gerada" com senha/copiar/aviso confirmados; guarda de
  auto-reset confirmada com valores reais de `.disabled` no DOM (não
  mock).
- **Achado fora de escopo — candidato `UI-EL-BOOLEAN-ATTR-FIX`
  (`NOT AUTHORIZED`, severidade `NÃO CONFIRMADA` — verificação do
  arquiteto pendente):** ao adicionar o botão novo, o executor
  observou em navegador real que `js/ui.js`'s `el()` faz
  `setAttribute(k, v)` sem tratar boolean — `setAttribute('disabled',
  false)` marca o atributo presente (`.disabled` vira `true`) em
  qualquer navegador real. Isso potencialmente afeta os botões
  "Desativar" (`disabled: user.ativo === false`) e "Excluir"
  (`disabled: !!(meId && user.id === meId)`) em
  `js/screens/admin-usuarios.js`, que poderiam ficar incorretamente
  desabilitados no caso comum (usuário ativo / não é o próprio admin)
  — mesma causa-raiz do resíduo já corrigido uma vez em
  `expedicao-admin.js`. **Tratar como potencial regressão ativa até o
  arquiteto testar diretamente os botões Desativar/Excluir na tela de
  usuários em staging.** Não corrigido nesta fase (fora do manifesto
  de `A5.1-A5.2`, que proíbe tocar `admin-disable/delete/create`). O
  botão de reset novo usa o padrão seguro (chave `disabled` só entra
  no objeto quando `true`), confirmado ao vivo.
- **Achado fora de escopo — candidato de decomposição (`CODE-HEALTH-AUDIT-§18-R1`):**
  `js/screens/admin-usuarios-modal.js` chegou a 576 linhas (acima do
  "aceitável" 500) ao acomodar o 4º modal (mesmo padrão dos 3
  existentes). Não extraído para arquivo novo nesta fase — a ordem
  autorizou explicitamente `admin-usuarios-modal.js` como destino, sem
  arquivo novo no manifesto.
- **Produção:** `bhgifjrfagkzubpyqpew` não acessada. **Push:** não
  executado.
- **Próxima ação autorizável:** `ARCHITECT DECISION` — candidatas:
  `A5.3-A5.4` (reativação, autorização própria); `UI-EL-BOOLEAN-ATTR-FIX`
  (correção na causa-raiz de `js/ui.js`'s `el()` + regressão ampla,
  pendente de confirmação do arquiteto); `A2.1` (schema `nivel_acesso`);
  `A6.1` (schema/trigger de auditoria). Nenhuma subfase autorizada por
  este registro.
- **Ledger:** `docs/ledgers/G28_LEDGER.md` (entrada append-only desta
  fase).

## Camada 2 — Consumo da RPC de Último Acesso na UI — CAMADA2-LAST-ACCESS-UI

- **Frente:** `G28-CAMADA-2`, micro-fase de consumo da RPC `db/59`
  (`admin_usuarios_last_sign_in`) na tela de usuários, autorizada após
  `A4.1` + `CAMADA2-LAST-ACCESS-RPC`.
- **Classificação: `CLOSED / ACCEPTED`** (validação visual do
  arquiteto confirmada em preview local em 2026-07-16: coluna populada
  com dados reais, formato correto, `"—"` nos nunca-logados, ordenação
  com nulos por último).
- **Technical HEAD:** `0aff22f` — `Add last sign-in column to user
  admin`. **Commit documental:** este closeout (`Close last sign-in
  column phase`). O HEAD atual deve ser consultado com `git rev-parse
  HEAD`.
- **Escopo implementado:** `js/admin-usuarios-writes.js` ganhou
  `fetchLastSignIn()` (chama `supa.rpc('admin_usuarios_last_sign_in')`,
  uma chamada por `reload()`, merge client-side por `id`);
  `js/screens/admin-usuarios.js` ganhou a coluna "ULTIMO ACESSO" no
  grid (`dd/mm/aaaa hh:mm`; `"—"` para nulo/ausente/inválido), ativou a
  ordenação "Último acesso" (mais recente primeiro, nulos sempre por
  último) e trata falha da RPC sem derrubar a tela (coluna inteira em
  `"—"` + `console.warn`, lista de usuários continua visível).
- **Não tocado:** nenhum write novo, nenhuma migration, `index.html`
  intocado, nenhum modal, `js/boot.js` intocado — confirmado por `git
  status` na fase.
- **Testes locais:** `node --check` PASS; `tests/admin-usuarios.smoke.js`
  estendido **23/23** (4 testes novos: coluna/formato/fallback de nulo/
  ordenação com nulos por último/chamada única da RPC); regressão
  `tests/boot.smoke.js` + `tests/cadastros-screens.smoke.js` +
  `tests/admin-*.smoke.js` **298/298**, sem regressão. `git diff
  --check` limpo.
- **Verificação em preview local (staging real, sessão já
  autenticada):** coluna populada com dados reais de staging
  (`ucrjtfswnfdlxwtmxnoo`) — timestamps formatados corretamente,
  `"—"` para usuários nunca logados; ordenação "Último acesso" aplicada
  ao vivo confirmou ordem decrescente correta com todos os `"—"`
  agrupados por último. Console sem erros/warnings.
- **Débito de continuidade documental fechado por este registro:** o
  relatório de implementação desta micro-fase ficou em `AGUARDANDO
  VALIDAÇÃO VISUAL DO ARQUITETO` enquanto a sessão prosseguiu para a
  autorização de `A4.2`; a validação visual e a autorização de closeout
  foram confirmadas explicitamente pelo arquiteto em 2026-07-16, junto
  com a autorização da frente seguinte (`A5.1-A5.2`).
- **Produção:** `bhgifjrfagkzubpyqpew` não acessada. **Push:** não
  executado.
- **Próxima ação autorizável:** já superada — `A5.1-A5.2` (reset de
  senha administrativo) autorizada e em andamento; ver seção própria
  para o estado corrente de "próxima ação".
- **Ledger:** `docs/ledgers/G28_LEDGER.md` (entrada append-only desta
  fase).

## Camada 2 — Guarda de Troca de Senha Obrigatória — A4.2

- **Frente:** `G28-CAMADA-2`, subfase `A4.2` de
  `docs/architecture/CAMADA2_USUARIOS_SPEC_PROPOSED.md`, autorizada após
  `A4.1` + `CAMADA2-LAST-ACCESS-RPC`.
- **Classificação: `CLOSED / ACCEPTED`** (gate de mockup satisfeito +
  validação manual do arquiteto confirmada em staging com usuário
  sintético).
- **Technical HEAD:** `6c624ef` — `Add mandatory password change gate`
  (`js/auth.js`, `js/boot.js`, `js/trocar-senha-writes.js` (novo),
  `js/screens/trocar-senha-obrigatoria.js` (novo),
  `scripts/staging/trocar-senha-obrigatoria-e2e.mjs` (novo, tooling),
  `index.html`, `tests/auth.smoke.js`, `tests/boot.smoke.js`,
  `tests/trocar-senha-obrigatoria.smoke.js` (novo)). **Commit
  documental:** este closeout (`Close mandatory password change
  phase`). O HEAD atual deve ser consultado com `git rev-parse HEAD`.
- **Hard stop resolvido nesta fase (decisão explícita do arquiteto —
  Opção A):** a guarda projetada (`CURRENT_USER.senha_temporaria`) não
  funcionava porque `js/auth.js` (`loadCurrentUser()`) não selecionava
  `senha_temporaria`/`senha_gerada_em` — campos adicionados por `db/58`
  em `A4.1`, mas nunca lidos em lugar nenhum do repositório
  (confirmado por grep antes do stop). `js/auth.js` não estava no
  manifesto original desta ordem; o arquiteto ampliou o manifesto em 1
  arquivo, exclusivamente para o `select` de `loadCurrentUser()` — mais
  nenhuma linha de `auth.js` tocada (`§11` preservado, mecanismo de
  Auth intocado).
- **Guarda (`js/boot.js`):** `isSenhaTemporariaExpirada(geradaEm)`
  (pura, 7 dias, testável isoladamente) + `guardedHandleRoute()`
  (envolve `window.handleRoute` de `js/router.js` **sem alterá-lo** —
  `router.js` continua intocado) usado tanto no listener de
  `hashchange` quanto na decisão inicial de `main()`, pós-
  `loadCurrentUser()` e pré-bootstrap G24-C. Exportado só para teste em
  `window.RAVATEX_BOOT_GUARD`.
- **Write self-service (`js/trocar-senha-writes.js`, novo módulo):**
  `trocarSenhaObrigatoria(userId, novaSenha)` — `supabase.auth.
  updateUser({password})` (self-service, sem Admin API) e, em
  sucesso, `UPDATE usuarios SET senha_temporaria=false WHERE id=userId`
  via PostgREST. Retorna `{ok:false, stage:'auth'|'flag', error}` para
  distinguir estado parcial real (senha trocada mas flag não zerada) —
  reportado explicitamente pela tela, nunca silencioso.
- **RLS/grants verificados em staging antes de codar (read-only,
  catálogo ao vivo):** policy `usuarios_self_update` em
  `public.usuarios` (`USING id=auth.uid() AND ativo IS TRUE`,
  `WITH CHECK` preserva `tipo`) + `authenticated` com `UPDATE`
  explícito em `senha_temporaria`/`senha_gerada_em` — sem policy nova,
  sem afrouxamento.
- **Tela (`js/screens/trocar-senha-obrigatoria.js`, novo, 243 linhas):**
  card centrado sem shell, ícone cadeado, checklist vivo (mínimo 8
  caracteres / 1 dígito / senhas coincidem — cinza `#8a93a3` pendente,
  verde `#18794a` satisfeito), botão habilitado só com os 3 critérios,
  toggle de olho nos 2 campos, link "Sair da conta" (logout real). Modo
  `expired` (`senha_gerada_em` > 7 dias): sem campos, mensagem de
  expiração + "Sair da conta" como botão primário. Mockup aprovado pelo
  arquiteto em 2026-07-16.
- **Testes locais:** `node --check` PASS nos 5 arquivos JS/`.mjs`
  tocados/novos; `tests/trocar-senha-obrigatoria.smoke.js` (novo)
  **14/14**; `tests/boot.smoke.js` estendido **44/44** (13 testes
  novos, incl. integração real via `main()` com sessão autenticada
  mockada, flag true/false/expirada); `tests/auth.smoke.js` estendido
  **37/43** (3 testes novos + 1 corrigido; os 6 que falham são débito
  pré-existente confirmado idêntico via `git stash`, não relacionado a
  esta fase — ver débito registrado abaixo); regressão consolidada
  (`boot`+`auth`+`trocar-senha-obrigatoria`+`admin-usuarios`+
  `cadastros-screens`) **150/156**, mesma contagem de débito
  pré-existente. `git diff --check` limpo.
- **Verificação visual sem credenciais (preview local, sem login):**
  tela real renderizada via overlay de diagnóstico — checklist reage a
  tecla real com cores computadas corretas (`rgb(24,121,74)`=`#18794a`
  satisfeito / `rgb(138,147,163)`=`#8a93a3` pendente), botão desabilita/
  habilita corretamente, toggle de olho `password↔text` confirmado,
  modo `expired` sem campos/formulário. Console sem erros.
- **Validação da perna autenticada — confirmada pelo arquiteto
  (validação manual em staging, `ucrjtfswnfdlxwtmxnoo`):** usuário
  sintético criado pelo fluxo novo (senha temporária), gate exibido no
  primeiro login, checklist reagiu, troca efetuada, flag
  `senha_temporaria` zerada, segundo login entrou direto sem o gate.
  Usuário de teste removido. Runner automatizado equivalente
  disponível em `scripts/staging/trocar-senha-obrigatoria-e2e.mjs`
  (mesmo esqueleto/garantias de `admin-create-user-password-policy-
  e2e.mjs` — login com senha real só por humano, nunca pelo agente IA;
  senha sintética gerada pelo próprio script) para reexecução futura,
  não executado nesta fase (a validação usada foi a manual).
- **Débito registrado nesta fase (não bloqueante, candidato a
  `CODE-HEALTH-AUDIT-§18-R1`):** os 6 testes pré-existentes em
  `tests/auth.smoke.js` que falham checando tags `<script src="js/
  auth.js">` sem `?v=` (regex desatualizado desde que cache-busting foi
  adicionado a `auth.js`, anterior a esta fase) — confirmado idêntico
  ao baseline via `git stash`, não corrigido aqui (fora de escopo desta
  ordem). Ver seção "Frente candidata `CODE-HEALTH-AUDIT-§18-R1`"
  abaixo.
- **Débito de continuidade documental (não fechado por esta fase):** a
  micro-fase `CAMADA2-LAST-ACCESS-UI` (consumo da RPC `db/59` — coluna
  "Último acesso" em `js/screens/admin-usuarios.js`, technical commit
  `0aff22f` — `Add last sign-in column to user admin`) teve seu
  relatório de implementação entregue (`IMPLEMENTAÇÃO VALIDADA /
  AGUARDANDO VALIDAÇÃO VISUAL DO ARQUITETO`) mas a sessão prosseguiu
  diretamente para a autorização de `A4.2` sem um `OK` explícito nem
  ordem de closeout registrada para essa micro-fase especificamente.
  O commit técnico já está no histórico e a funcionalidade está
  implementada; falta apenas o registro documental formal (`CLOSED /
  ACCEPTED`) — pendente de ordem própria do arquiteto.
- **Não implementado (fora de escopo, não iniciado):** `A4.3` (convite
  por e-mail, `NOT AUTHORIZED`); `A2.1` (schema `nivel_acesso`); `A6.1`
  (schema/trigger de auditoria); `A5.1-A5.2` (reset de senha por
  admin).
- **Produção:** `bhgifjrfagkzubpyqpew` não acessada. **Push:** não
  executado.
- **Próxima ação autorizável:** `ARCHITECT DECISION` — candidatas:
  `A5.1-A5.2` (reset de senha — Edge Function + staging verify); `A2.1`
  (schema `nivel_acesso`); `A6.1` (schema/trigger de auditoria).
  Nenhuma subfase autorizada por este registro.
- **Ledger:** `docs/ledgers/G28_LEDGER.md` (entrada append-only desta
  fase).

## Camada 2 — Senha Temporária e Read Model de Último Acesso — A4.1 + CAMADA2-LAST-ACCESS-RPC

- **Frente:** `G28-CAMADA-2`, subfase `A4.1` (schema `senha_temporaria`/política
  de senha) agrupada com a micro-fase `CAMADA2-LAST-ACCESS-RPC` (RPC de
  "último acesso"), conforme decisão do arquiteto registrada no closeout
  de `A3.2` e autorização explícita desta fase.
- **Classificação: `CLOSED / ACCEPTED`** (deploy da Edge Function
  executado pelo arquiteto + verificação E2E real em staging `result:
  PASS` 9/9, evidência abaixo).
- **Technical HEADs:** `bf0d522` — `Add temporary password schema and
  last sign-in read model`; `c6289f8` — `Add password-policy E2E
  verification runner for admin-create-user`. **Commit documental:**
  este closeout (`Close temporary password schema phase`). O HEAD
  atual deve ser consultado com `git rev-parse HEAD`.
- **Schema (`db/58_admin_usuarios_senha_temporaria.sql`, aplicada e
  verificada em staging `ucrjtfswnfdlxwtmxnoo`, registro
  `20260716014338 / 58_admin_usuarios_senha_temporaria`):**
  `usuarios.senha_temporaria BOOLEAN NOT NULL DEFAULT FALSE` +
  `usuarios.senha_gerada_em TIMESTAMPTZ NULL`. Os 10 usuários
  pré-existentes preservados sem efeito retroativo.
- **RPC (`db/59_admin_last_sign_in_readmodel.sql`, aplicada e
  verificada em staging, registro `20260716014358 /
  59_admin_last_sign_in_readmodel`):** `public.admin_usuarios_last_sign_in()`
  — `SECURITY DEFINER`, `STABLE`, `search_path=public,auth`, guarda
  `is_admin()` (padrão `db/12`), expõe apenas `id`+`last_sign_in_at`.
  Grants explícitos: `authenticated`-only. Matriz de papéis empírica
  (`BEGIN…ROLLBACK`): `anon` → `42501` no limite de ACL; `authenticated`
  não-admin → `42501` de negócio (`RAISE EXCEPTION` dentro da função);
  `authenticated` admin → `ok`, DTO mínimo confirmado. Fecha o HARD
  STOP da coluna "Último acesso" registrado no closeout de `A3.2`.
- **Edge Function `admin-create-user` (extensão pontual):**
  `PASSWORD_MIN_LENGTH` 6→8 + `PASSWORD_DIGIT_RE` (≥1 dígito); insert em
  `public.usuarios` passa a setar `senha_temporaria: true`,
  `senha_gerada_em: now()`.
- **Deploy:** executado pelo arquiteto diretamente em staging
  (`ucrjtfswnfdlxwtmxnoo`) — fora do alcance de credenciais/ferramentas
  desta sessão (agente IA não entra senha/token/API key em nenhum
  campo, regra permanente).
- **Verificação pós-deploy — E2E real em staging (`result: PASS`,
  9/9), executado pelo arquiteto** via
  `scripts/staging/admin-create-user-password-policy-e2e.mjs` (mesmo
  esqueleto/garantias do `admin-disable-user-e2e.mjs` aceito):
  senha de 7 caracteres rejeitada (mensagem de comprimento); senha de
  8 caracteres sem dígito rejeitada (mensagem de dígito); senha válida
  aceita com `senha_temporaria=true`/`senha_gerada_em` preenchido
  confirmados via REST em `public.usuarios`; cleanup via
  `admin-delete-user` (fluxo existente) com cleanup zero verificado
  (perfil ausente após delete).
- **Testes locais:** `admin-usuarios-senha-temporaria-schema.smoke.js`
  7/7; `admin-last-sign-in-readmodel.smoke.js` 9/9; `admin-create-user.smoke.js`
  estendido (política de senha com validação real extraída do source)
  25/25; allow-list de `db/` em `document-decision-command-contract.test.js`
  estendida para `db/58`/`db/59`; regressão `tests/admin-*.smoke.js` +
  `boot.smoke.js` 263/263, sem regressão. `git diff --check` limpo.
- **Documentação corrigida nesta fase:**
  `docs/operations/AUTH_USER_PROVISIONING_RUNBOOK.md` (política de
  senha desatualizada corrigida para 8+dígito, nota sobre
  `senha_temporaria`/troca obrigatória prevista em `A4.2`).
- **Não implementado (fora de escopo, não iniciado):** consumo da RPC
  `db/59` na UI (coluna "Último acesso" em
  `js/screens/admin-usuarios.js`); `A4.2` (guarda de boot + tela de
  troca obrigatória); `A4.3` (convite por e-mail, `NOT AUTHORIZED`).
- **Produção:** `bhgifjrfagkzubpyqpew` não acessada. **Push:** não
  executado.
- **Próxima ação autorizável:** `ARCHITECT DECISION` — candidatas:
  micro-fase de consumo da RPC `db/59` na UI (coluna "Último acesso",
  sob gate de mockup se envolver elemento visual novo); `A4.2` (guarda
  de boot + tela de troca obrigatória, gate visual). Nenhuma subfase
  autorizada por este registro.
- **Ledger:** `docs/ledgers/G28_LEDGER.md` (entrada append-only desta
  fase).

## Decisão de Arquiteto — Critério de Publicação e Frentes Candidatas — G28-GOVERNANCE-CONSOLIDATION-A

Registro vivo e permanente das decisões do arquiteto (2026-07-15) que
consolidam o protocolo de supervisão (`docs/governance/SUPERVISION_PROTOCOL.md`)
e registram duas frentes candidatas `NOT AUTHORIZED`, mais o critério de
arquiteto que condiciona a publicação em produção.

```text
CODE-HEALTH-AUDIT-§18-R1:
NOT AUTHORIZED / CANDIDATE

PUBLICATION-TRACK-REVIEW:
NOT AUTHORIZED / CONDITIONED — NOT A CURRENT CANDIDATE

PUBLICATION CRITERION (ARCHITECT DECISION 2026-07-15):
PRODUCTION ENTRY REQUIRES G28-CAMADA-2 (FULL SCOPE A1-A7) AND
G28-CAMADA-3 (AUTOMATED BACKUP) BOTH CLOSED / ACCEPTED IN STAGING

G28-CAMADA-3:
RECLASSIFIED FROM DEFERRED TO PUBLICATION CRITICAL PATH (AFTER CAMADA 2)
PENDING OWN SPEC (BK1-BK8 DIAGNOSIS IS A FUTURE PHASE)

STAGING-ONLY-EXECUTION-BOUNDARY-A:
UNCHANGED / REMAINS IN FORCE
```

- **Frente candidata `NOT AUTHORIZED`: `CODE-HEALTH-AUDIT-§18-R1`** —
  auditoria read-only pós-Camada 2 (`docs/architecture/CODE_HEALTH_RULES.md`
  §18), insumo para decomposição incremental de `cadastros.js` (~2.200
  linhas, 6 telas embutidas remanescentes após a extração de `A3.1`) e
  triagem dos débitos de teste de baseline. Não iniciada; nenhuma
  implementação autorizada por este registro. **Débito concreto
  registrado na fase `A4.2` (2026-07-16):** os 6 testes em
  `tests/auth.smoke.js` que checam `<script src="js/auth.js">` sem
  considerar `?v=` de cache-busting (regex desatualizado desde antes
  de `A4.2`, confirmado idêntico ao baseline via `git stash`) — candidato
  de correção quando esta auditoria for autorizada. **Débito concreto
  registrado na fase `A5.1-A5.2` (2026-07-16):**
  `js/screens/admin-usuarios-modal.js` chegou a 576 linhas (acima do
  "aceitável" 500) ao acomodar o 4º modal — candidato de decomposição
  quando esta auditoria for autorizada.
- **Frente candidata `NOT AUTHORIZED`, severidade `NÃO CONFIRMADA`:
  `UI-EL-BOOLEAN-ATTR-FIX`** — registrada na fase `A5.1-A5.2`
  (2026-07-16). `js/ui.js`'s `el()` faz `setAttribute(k, v)` sem tratar
  boolean; `setAttribute('disabled', false)` marca o atributo presente
  em qualquer navegador real, potencialmente afetando os botões
  "Desativar"/"Excluir" em `js/screens/admin-usuarios.js` (poderiam
  ficar incorretamente desabilitados no caso comum) — mesma
  causa-raiz do resíduo já corrigido uma vez em `expedicao-admin.js`.
  **Tratar como potencial regressão ativa até verificação direta do
  arquiteto nos botões Desativar/Excluir em staging.** Não
  confirmada/reproduzida pelo arquiteto ainda; não iniciada; nenhuma
  implementação autorizada por este registro.
- **Frente condicionada `NOT AUTHORIZED`: `PUBLICATION-TRACK-REVIEW`** —
  revisão da fronteira staging-only + `DEPLOYMENT_MAPPING_AND_PRODUCTION_
  MIGRATION_PROCEDURE` + G28-D + aplicação em produção das migrations hoje
  staging-only + `DELETE-PROD-GUARD-A`, como pré-requisito de usuários
  reais. Passa a `CONDICIONADA` pelo critério de publicação abaixo — não é
  candidata corrente, mesmo depois de o backlog geral remanescente ser
  reconciliado.
- **Decisão vinculante do arquiteto — critério de publicação (2026-07-15):**
  o sistema só entra em produção após `G28-CAMADA-2` (escopo pleno `A1-A7`,
  hoje apenas `CAPACIDADE PARCIAL PREEXISTENTE` + `ESCOPO PLENO DIFERIDO` —
  ver `G28-RECONCILIATION-DECISIONS-A` abaixo) e `G28-CAMADA-3` (backup
  automático) estarem ambas `CLOSED / ACCEPTED` em staging.
  `PUBLICATION-TRACK-REVIEW` fica condicionada a esse critério. A fronteira
  `STAGING-ONLY-EXECUTION-BOUNDARY-A` permanece vigente sem alteração.
- **Consequência registrada:** `G28-CAMADA-3` deixa de ser tratada apenas
  como frente diferida e passa a `CAMINHO CRÍTICO DE PUBLICAÇÃO` (após
  `G28-CAMADA-2`), pendente de spec própria — o diagnóstico `BK1-BK8` é
  fase futura, não autorizada por este registro.
- **Protocolo de supervisão:** `docs/governance/SUPERVISION_PROTOCOL.md`
  recebeu apêndice "Handoff de supervisão — bloco padrão" (texto verbatim
  do arquiteto, para abrir sessões novas de parecerista/supervisor) e
  passou a exigir seção `STRUCTURAL POLICY COMPLIANCE` no relatório de toda
  fase de implementação (regras aplicáveis de `CODE_HEALTH_RULES.md`
  citadas + evidência + tamanho em linhas dos arquivos tocados).
- **Produção:** `bhgifjrfagkzubpyqpew` não acessada. **Push:** não
  executado.
- **Ledger:** `docs/ledgers/G28_LEDGER.md` (entrada append-only desta
  decisão).

## Decisão de Arquiteto — Fronteira de Execução Staging-Only — STAGING-ONLY-EXECUTION-BOUNDARY-A

Registro vivo e permanente do ciclo atual do projeto (2026-07-15). Este bloco
prevalece sobre qualquer menção anterior a `DEPLOYMENT_MAPPING_AND_
PRODUCTION_MIGRATION_PROCEDURE` como bloqueador material corrente em
qualquer seção histórica abaixo.

```text
ACTIVE FUNCTIONAL PHASE:
NONE

CURRENT ENVIRONMENT POLICY:
STAGING ONLY

AUTHORIZED SUPABASE PROJECT:
ucrjtfswnfdlxwtmxnoo

PRODUCTION / OTHER SUPABASE:
OUT OF SCOPE

DEPLOYMENT_MAPPING_AND_PRODUCTION_MIGRATION_PROCEDURE:
DEFERRED UNTIL GLOBAL BACKLOG COMPLETION

G28-D:
DEFERRED / NOT AUTHORIZED / NOT A CURRENT BLOCKER

CLIENTE-ORDER-SUMMARY-READMODEL-ACL-GRANTS-R1:
CLOSED / ACCEPTED

MIGRATION:
db/57_cliente_pedido_summary_acl_grants.sql

STAGING REGISTRY:
20260715190627 / 57_cliente_pedido_summary_acl_grants

ACL DEBT:
RESOLVED IN STAGING

DB30 MIGRATION-HISTORY DEBT:
OPEN

ACTIVE FUNCTIONAL PHASE:
NONE

NEXT AUTHORIZABLE TECHNICAL CANDIDATE:
NONE
ARCHITECT DECISION REQUIRED AFTER BACKLOG RECONCILIATION
STAGING ONLY
```

- **Decisão vinculante do arquiteto:** o ambiente operacional corrente é
  exclusivamente o Supabase de staging `ucrjtfswnfdlxwtmxnoo`. O projeto
  Supabase protegido/outro (`bhgifjrfagkzubpyqpew`) permanece fora de escopo
  e não deve ser acessado.
- **Migração ou promoção de schema em produção:** postergada até a
  conclusão do backlog canônico completo. Mapeamento de publicação em
  produção não é exigido para o trabalho atual em staging.
- **`DEPLOYMENT_MAPPING_AND_PRODUCTION_MIGRATION_PROCEDURE`:** deixa de ser
  registrada como bloqueador material corrente ou como próxima decisão de
  arquiteto exigida. Reclassificada como `DEFERRED BY ARCHITECT UNTIL
  GLOBAL BACKLOG COMPLETION / NOT A CURRENT STAGING BLOCKER / NOT STARTED`.
  Não descoberta, definida, testada ou concluída — apenas postergada
  intencionalmente. Evidência de descoberta preservada, não reescrita, em
  `docs/releases/G28_D_RELEASE_CANDIDATE.md`.
- **G28-D:** publicação `DEFERRED, NOT AUTHORIZED, NOT A CURRENT BLOCKER`.
- **Frontend/publicação:** provedor de publicação não selecionado. Vercel
  permanece candidato futuro apenas; isto não é uma decisão nem uma
  autorização.
- **Política de execução corrente (permanente para este ciclo):**
  1. continuar implementando e validando o backlog canônico remanescente
     exclusivamente contra staging;
  2. não acessar o projeto Supabase protegido;
  3. não planejar, preparar, simular ou executar migrations de produção;
  4. não deixar o mapeamento de produção ausente bloquear o trabalho em
     staging;
  5. não autorizar a publicação de G28-D;
  6. revisitar migração e publicação somente após o backlog canônico
     completo estar reconciliado e concluído;
  7. Vercel pode ser avaliado depois, mas não está selecionado atualmente.
- **Próximo candidato técnico:** `CLIENTE-ORDER-SUMMARY-READMODEL-ACL-GRANTS-R1`
  foi autorizado, implementado, aplicado e verificado em staging em
  2026-07-15 (`CLOSED / ACCEPTED` — ver seção própria "Portal Cliente — ACL
  Grants Hardening" abaixo). Não há candidato técnico único e inequívoco
  para o ciclo atual de staging; a próxima ação depende de reconciliação
  do backlog geral remanescente.
- **Produção:** `bhgifjrfagkzubpyqpew` não acessada. **Push:** não
  executado. **Vercel:** não acessado.
- **Ledger:** `docs/ledgers/G28_LEDGER.md` (entrada append-only desta
  decisão).

## Decisão de Arquiteto — Reconciliação de Backlog e Governança de Supervisão — G28-RECONCILIATION-DECISIONS-A

Registro vivo e permanente das decisões do arquiteto (2026-07-15) sobre o
diagnóstico read-only `BACKLOG-RECONCILIATION-READONLY-R1`
(`docs/reports/BACKLOG_RECONCILIATION_R1_2026-07-15.md`). Este bloco
prevalece sobre qualquer classificação anterior do relatório
`PROJECT-CONTROL-BASELINE-R1` (ChatGPT) referente à Camada 2 e ao aceite da
seção de Documentos.

```text
PROJECT-CONTROL-BASELINE-R1 (ChatGPT):
REJECTED / NOT RATIFIED — classificação materialmente incorreta da Camada 2.
Artefato externo, nunca canônico.

PROJECT-CONTROL-BASELINE-R1-CORRECTION (ChatGPT):
CANCELLED / ABSORBED / SUPERSEDED BY BACKLOG-RECONCILIATION-READONLY-R1

BASELINE DE REFERÊNCIA ADOTADO:
BACKLOG-RECONCILIATION-READONLY-R1
(docs/reports/BACKLOG_RECONCILIATION_R1_2026-07-15.md)

G28-CAMADA-2:
CAPACIDADE PARCIAL PREEXISTENTE (subproduto de AUTH-DISABLE-USER e Portal
Cliente) / ESCOPO PLENO A1-A7 DIFERIDO / NÃO ACEITA COMO FASE DEDICADA
REFERÊNCIA FUNCIONAL/VISUAL PARA O ESCOPO PLENO:
D:\OneDrive\Programação\SGAA_clean_baseline

G28-C:
CLOSED / TECHNICALLY ACCEPTED — ARCHITECT PRODUCT VALIDATION PENDING
(reclassificação do estado vigente; ledger histórico `a7d7caa`/`d5ec09f`
NÃO reescrito; nova entrada append-only no ledger G28)
DÉBITO REGISTRADO: AUTHENTICATED_BROWSER_SMOKE_NOT_EXECUTED (pendente)

GOVERNANÇA DE SUPERVISÃO:
Acompanhamento e pareceres transferidos para Claude (chat) + Claude Code
(residente). ChatGPT passa a consultor sem custódia de estado e sem
emissão de ordens.

PRÓXIMA FRENTE SELECIONADA:
G28-CAMADA-2 — início por diagnóstico read-only comparativo (ordem própria
subsequente, não autorizada por este registro)

TAREFA PARALELA AUTORIZADA:
Higiene do worktree `work/app-next` — read-only, ordem separada
```

- **Decisão vinculante do arquiteto:** o relatório `PROJECT-CONTROL-BASELINE-R1`
  do ChatGPT é `REJECTED / NOT RATIFIED` quanto à classificação da Camada 2;
  sua correção (`PROJECT-CONTROL-BASELINE-R1-CORRECTION`) é `CANCELLED /
  ABSORBED / SUPERSEDED` pelo diagnóstico `BACKLOG-RECONCILIATION-READONLY-R1`,
  adotado como baseline de referência corrente.
- **G28-CAMADA-2** é reclassificada como `CAPACIDADE PARCIAL PREEXISTENTE`
  (CRUD de usuários, desativação/ban, papel único `usuarios.tipo`, vínculo
  cliente/fornecedor — subproduto de `AUTH-DISABLE-USER` e do Portal Cliente,
  não de uma fase Camada-2 dedicada) mais `ESCOPO PLENO A1-A7 DIFERIDO`
  (reset/recuperação de senha, convites, matriz de papéis/permissões,
  auditoria de create/edit/delete, política de senha completa, reativação).
  Não aceita como fase; nenhuma implementação autorizada por este registro.
  Referência funcional/visual para o escopo pleno, quando autorizado:
  `D:\OneDrive\Programação\SGAA_clean_baseline`.
- **G28-C** é reclassificado no estado vigente como `CLOSED / TECHNICALLY
  ACCEPTED — ARCHITECT PRODUCT VALIDATION PENDING`, separando explicitamente
  aceite técnico/staging (matriz 16/16, migrations aplicadas e verificadas)
  de validação funcional/pessoal do arquiteto (não registrada) e do smoke
  autenticado de browser (nunca executado, `AUTHENTICATED_BROWSER_SMOKE_
  NOT_EXECUTED`). O closeout histórico (`a7d7caa`/aceite `d5ec09f`) não é
  reescrito; esta reclassificação é registrada como entrada nova e vinculada
  no ledger G28.
- **Governança de supervisão:** o acompanhamento de progresso, continuidade,
  escopo, autorizações, fases e documentação passa para Claude (chat) e
  Claude Code (residente). O ChatGPT permanece disponível como consultor,
  sem custódia de estado e sem autoridade para emitir ordens.
- **Próxima frente:** `G28-CAMADA-2`, iniciando por diagnóstico read-only
  comparativo em ordem própria subsequente (não autorizada por este
  registro). Higiene do worktree `work/app-next` (divergente do remoto e
  com mudanças não commitadas) autorizada como tarefa paralela read-only,
  em ordem separada.
- **Produção:** `bhgifjrfagkzubpyqpew` não acessada. **Push:** não
  executado nesta fase.
- **Ledger:** `docs/ledgers/G28_LEDGER.md` (entrada append-only desta
  decisão).

## Camada 2 — Administração de Usuários — Spec Proposta — CAMADA2-USUARIOS-SPEC-MATERIALIZE-R1

- **Frente:** `G28-CAMADA-2`, selecionada como próxima frente em
  `G28-RECONCILIATION-DECISIONS-A` (ver seção acima).
- **Fase:** `CAMADA2-USUARIOS-SPEC-MATERIALIZE-R1`. Docs-only — sem
  código, teste, SQL, migration, Supabase, staging, produção ou Vercel
  acessados/alterados. **Status: `PROPOSED`.**
- **Documento criado:** `docs/architecture/CAMADA2_USUARIOS_SPEC_PROPOSED.md`
  — spec `A1-A7` + política de senha, com comparação evidenciada
  Tapetes × `D:\OneDrive\Programação\SGAA_clean_baseline` (referência
  externa read-only, projeto Flask/SQLite não relacionado), plano de
  módulos consolidado, classificação de risco Auth por item e ordem de
  subfases com gates.
- **Decisões do arquiteto incorporadas na spec:** `nivel_acesso` com 2
  níveis (`completo`/`somente_leitura`); tabela de overrides de
  permissões **não construída** (opção futura condicionada a necessidade
  real); A4 = caminho único senha-temporária-com-troca-forçada,
  convite por e-mail/SMTP `NOT AUTHORIZED`; bulk actions (A3.3)
  `DEFERRED`.
- **Ajustes de revisão aplicados:** cutover de rota antecipado para A3.1
  (com validação visual do arquiteto); A3.4 restrito a remoção isolada
  do código legado; "último acesso" incluído em A3.2; revogação
  explícita de sessão fora de escopo; gate de mockup obrigatório antes
  de A3.2; edições de `index.html`/cache-busting e smokes de rota/boot
  endereçados por subfase; `docs/refactor/ARCHITECTURE_REFACTOR_LEDGER.md`
  incluído no closeout de A3.1/A3.4.
- **Caveat de segurança:** a spec rejeita explicitamente 4 práticas do
  SGAA usadas como referência (senhas padrão em texto puro na UI,
  ausência de política de complexidade, ausência de auditoria,
  confirmação via `window.confirm()` nativo) — usado apenas para
  arquitetura de informação/organização de tela.
- **Produção:** `bhgifjrfagkzubpyqpew` não acessada. **Push:** não
  executado.
- **Próxima ação autorizável:** `A3.1` foi autorizada e concluída — ver
  seção própria abaixo. Próxima subfase: `A3.2`, sob gate de mockup
  (ver `CAMADA2_USUARIOS_SPEC_PROPOSED.md`), **não autorizada**.
- **Ledger:** `docs/ledgers/G28_LEDGER.md` (entrada append-only desta
  fase).

## Camada 2 — Extração da Tela de Usuários — CAMADA2-USUARIOS-A3-1

- **Frente:** `G28-CAMADA-2`, subfase `A3.1` de
  `docs/architecture/CAMADA2_USUARIOS_SPEC_PROPOSED.md`.
- **Fase:** `CAMADA2-USUARIOS-A3-1`. Refactor puro (§14
  `CODE_HEALTH_RULES.md`) — sem feature nova, sem mudança de
  comportamento visual ou funcional. **Classificação: `CLOSED /
  ACCEPTED`** (autorização explícita do arquiteto + validação visual
  manual confirmada na tela real em app local staging).
- **Technical HEAD:** `4f01101143a512c8018d58ce9e523064c38a145f` —
  `Extract user administration screen modules`.
- **Escopo:** extração 1:1 de `screenCadastrosUsuarios`
  (`js/screens/cadastros.js:2226-2713`, arquivo de 2.750 linhas com 7
  telas embutidas — violação ativa do limite de tamanho §7) para 3
  módulos próprios: `js/admin-usuarios-writes.js` (I/O puro, sem toast/
  DOM, padrão `op-writes.js`/`entrega-writes.js`), `js/screens/
  admin-usuarios-modal.js` (3 modais: criar/editar, desativar,
  excluir), `js/screens/admin-usuarios.js` (orquestração/render).
  Cutover de rota antecipado (ajuste de revisão da spec): `js/boot.js`
  recableado (`#/cadastros/usuarios` → `window.screenAdminUsuarios`);
  `index.html` com os 3 scripts novos (ordem writes→modal→screen,
  cache-busting `?v=20260715-camada2-a31`).
- **Acoplamento resolvido:** `cadastros.js` é uma IIFE que não expõe em
  `window.*` os 8 helpers de formulário usados pela tela (só
  `window.labelFornecedorTipo` é global). Como a ordem proibia tocar
  `cadastros.js`, os helpers (funções puras, dependem só de `window.el`/
  `window.supa`) foram duplicados localmente em `admin-usuarios-modal.js`,
  renomeados com prefixo `adminUsuarios` e comentário de origem.
- **Decisão de escopo registrada:** a função `render()` original
  (`cadastros.js:2266-2317`, dataTable genérico) nunca era chamada —
  `reload()` só chamava `renderStandalone()`. Código morto/inalcançável,
  **não portado**: omiti-lo não altera nenhum comportamento observável.
- **Não alterado:** `js/screens/cadastros.js`, `js/ui.js`, `js/auth.js`
  — intocados, confirmado por `git status`.
  `screenCadastrosUsuarios`/`window.screenCadastrosUsuarios` permanecem
  em `cadastros.js`, como código morto, até remoção isolada em `A3.4`
  (fase própria, refactor puro, sem mistura com feature).
- **Testes (gate §13):** `node --check` nos 3 arquivos novos + `boot.js`
  PASS; `tests/admin-usuarios.smoke.js` (novo) **13/13**; `tests/
  boot.smoke.js` **32/32** (2 testes novos: cutover de rota, ordem/
  cache-busting); `tests/cadastros-screens.smoke.js` **32/32** (sandbox
  de boot ajustado para carregar os 3 módulos novos — sem essa correção
  o teste 22 quebrava por consequência indireta da troca de rota, não
  por alteração em `cadastros.js`); regressão ampla de 28 suítes
  adicionais: **1207 pass / 89 fail — contagem idêntica ao baseline
  antes da fase**, confirmado via `git stash`/`stash pop` (as 89
  falhas são débito pré-existente, servidor `:8765` não rodando e
  extração de inline-script antiga; nenhuma nova). `git diff --check`
  limpo.
- **Validação visual:** confirmada pelo arquiteto na rota
  `#/cadastros/usuarios` em app local (`http://localhost:8765`,
  `.claude/launch.json` criado nesta fase), staging `ucrjtfswnfdlxwtmxnoo`
  — paridade 1:1 aceita.
- **Produção:** `bhgifjrfagkzubpyqpew` não acessada. **Push:** não
  executado.
- **Documentação atualizada:** `docs/refactor/ARCHITECTURE_REFACTOR_LEDGER.md`
  (§16 — novo módulo estrutural + mudança de rota; nova linha na
  tabela de fases §4 e na lista canônica de módulos §6).
- **Próxima ação autorizável:** `A3.2` foi autorizada e concluída — ver
  seção própria abaixo.
- **Ledger:** `docs/ledgers/G28_LEDGER.md` (entrada append-only desta
  fase).

## Camada 2 — Cards-resumo e Toolbar — CAMADA2-USUARIOS-A3-2

- **Frente:** `G28-CAMADA-2`, subfase `A3.2` de
  `docs/architecture/CAMADA2_USUARIOS_SPEC_PROPOSED.md`.
- **Fase:** `CAMADA2-USUARIOS-A3-2`. Feature aditiva de UI (§14
  `CODE_HEALTH_RULES.md`) sobre o módulo extraído em `A3.1` — sem
  refactor, sem write novo, sem Auth. **Classificação: `CLOSED /
  ACCEPTED`** (gate de mockup satisfeito + validação visual manual
  confirmada, incluindo ajuste pós-validação).
- **Technical HEADs:** `b4a6238c34afb683ec7a973d230330b7266c99f2` —
  `Add user admin summary cards and toolbar`; `3198570c04b08bef83605f64bc9ae1c5ece8b873`
  — `Align summary card background with dashboard`.
- **Gate de mockup:** `SATISFEITO` — aprovado pelo arquiteto em
  2026-07-15 (cards-resumo com ícone KPI + toolbar + badge de papel por
  cor); valores finais registrados em
  `docs/design/CAMADA2_A32_MOCKUP_APPROVED.md`.
- **Escopo implementado (itens 1, 2, 3, 5 da ordem):** cards-resumo (4:
  Administradores/Fornecedores/Clientes/Inativos, contagens sobre
  `allUsers` já carregado, sem query nova); toolbar (busca + select
  Ordenar + select Filtrar por tipo + toggle "Mostrar inativos",
  client-side); badge de papel colorido na coluna Tipo; opacidade
  `0.6` em linhas inativas.
- **Item 4 (coluna "Último acesso") — NÃO implementado, HARD STOP
  confirmado:** `auth.users.last_sign_in_at` não é lido em lugar
  nenhum do repositório e nenhuma RPC/view o expõe; qualquer via de
  leitura exige migration nova. **Decisão do arquiteto: via escolhida
  = RPC `SECURITY DEFINER` admin-only, padrão `is_admin()`.**
  Registrada como micro-fase futura `CAMADA2-LAST-ACCESS-RPC` —
  `NOT AUTHORIZED`, candidata a agrupar com a migration de `A4.1`. A
  opção "Último acesso" existe no select Ordenar (UI, item 2) mas é
  inerte até a RPC existir.
- **Ajuste pós-validação:** fundo dos cards padrão (Administradores/
  Fornecedores/Clientes) alterado de `#f4f6f9` para `#fff` — mesmo tom
  de `.rv-adm-card` em `js/screens/painel.js` (dashboard admin). Card
  de Inativos mantém `#fff8f8` (tom de alerta intencional, inalterado).
- **Não alterado:** `index.html` (nenhum script novo); `js/admin-usuarios-writes.js`;
  `js/screens/admin-usuarios-modal.js`; `js/screens/cadastros.js`;
  `js/ui.js`; `js/auth.js`.
  `docs/refactor/ARCHITECTURE_REFACTOR_LEDGER.md` **não recebeu
  entrada nesta fase** — nenhum módulo estrutural novo, nenhuma
  mudança de rota (§16 não se aplica).
- **Testes:** `node --check` PASS; `tests/admin-usuarios.smoke.js`
  **20/20** (7 testes novos); `tests/boot.smoke.js` + `tests/cadastros-screens.smoke.js`
  **64/64** (sem regressão); `git diff --check` limpo.
- **Validação visual:** confirmada pelo arquiteto na rota
  `#/cadastros/usuarios`, app local (`http://localhost:8765`) apontando
  para staging `ucrjtfswnfdlxwtmxnoo`, incluindo o ajuste de fundo dos
  cards aplicado antes do fechamento.
- **Produção:** `bhgifjrfagkzubpyqpew` não acessada. **Push:** não
  executado.
- **Documentação criada/atualizada:** `docs/design/CAMADA2_A32_MOCKUP_APPROVED.md`
  (novo); `docs/governance/SUPERVISION_PROTOCOL.md` (novo, protocolo de
  supervisão — papéis Arquiteto/Parecerista/Executor Residente,
  onboarding, formato de ordem, gates); `docs/DOCUMENTATION_INDEX.md`
  (2 entradas novas).
- **Débito registrado (não bloqueante, à época):** `CAMADA2-LAST-ACCESS-RPC` —
  `NOT AUTHORIZED`, candidata a agrupar com `A4.1`. **Fechado em
  2026-07-16** — ver seção "Camada 2 — Senha Temporária e Read Model
  de Último Acesso — A4.1 + CAMADA2-LAST-ACCESS-RPC" no topo deste
  arquivo.
- **Próxima ação autorizável (à época; `A4.1` + `CAMADA2-LAST-ACCESS-RPC`
  já `CLOSED / ACCEPTED` — ver seção própria no topo deste arquivo):**
  candidatas remanescentes sem prioridade inequívoca: `A2.1` (schema
  `nivel_acesso`), `A6.1` (schema/trigger de auditoria). `A3.3` (bulk
  actions) permanece `DEFERRED`. `A3.4` (remoção do código legado)
  depende das demais subfases A3.x aceitas. Nenhuma subfase autorizada
  por este registro.
- **Ledger:** `docs/ledgers/G28_LEDGER.md` (entrada append-only desta
  fase).

## Bloco da frente ativa

### Document Qualification / Documents Ingestor — G28

- **Frente:** Document Qualification / Documents Ingestor — G28
- **Workspace:** `D:\OneDrive\Programação\Ravatex\controle-tapetes-g28`
- **Branch:** `work/g28-document-qualification`
- **Remoto permitido:** nenhum push sem autorização expressa nesta cadeia
- **HEAD técnico/documental anterior:** `b27e79fdba1ed8fb8a6232d8e0b8ca4b37ac3a2c` (linha de base histórica de descoberta G28-D; este registro documental a sucede).
- **Commit documental R1 inicial concluído:** `271761c3de20427b2cc9059d5ff7cc3727545e6d` — `G28: reconcile canonical phase state` (closeout documental inicial R1; já criado e registrado).
- **Ação corrente:** correção documental R1 concluída (docs-only, sem código, testes, staging, produção ou push). Commit corretivo `edaf0b4d36f24aa7b9490e51a42624cc70d45963` — `G28: correct canonical reconciliation state`. O HEAD atual deve ser consultado diretamente com `git rev-parse HEAD`.
- **Última fase aceita:** `G28-C — CLOSED / ACCEPTED_WITH_NONBLOCKING_AUTHENTICATED_BROWSER_SMOKE_DEBT` (decisão arquitetural explícita). Base: matriz staging/projeções 16/16, sem defeito material, cleanup zero e ledger append-only; produção não acessada.
- **Fase funcional ativa:** `NENHUMA`. G28-C está `CLOSED`. G28-D discovery está `RELEASE CONTRACT DISCOVERY COMPLETE / BLOCKED BY SPECIFIC MISSING DEPLOYMENT DEFINITION` e não constitui fase funcional ativa; sua publicação está `NOT STARTED / NOT ACCEPTED / NOT AUTHORIZED`.
- **Próxima fase funcional:** não nomeada. Após esta reconciliação documental, uma reconciliação read-only do backlog geral (`PEDIDO_PRODUCTION_FLOW_BACKLOG.md` e demais frentes) definirá a próxima frente.
- **Schema/RPC (migration aditiva `db/52_document_link_correction_revocation_restoration.sql`, APLICADA em staging):** registro `20260715024449 / 52_document_link_correction_revocation_restoration` em `ucrjtfswnfdlxwtmxnoo`; `restored_from_revision_id UUID`, FK self-reference `ON DELETE RESTRICT`, índice parcial, escritor evoluído com `p_reason`/`p_restored_from_revision_id` DEFAULT NULL e `restaurar_vinculos_documento` foram verificados em catálogo. Chamadas B6 posicionais de 5 argumentos e as RPCs B5 permaneceram compatíveis/inalteradas. Aditiva: sem backfill, sem tocar candidates/events/decisions.
- **Runtime/UI:** `js/documents-supabase-links.js` (+`loadDocumentLinkRevisionHistory` read-only fail-closed; +`restoreDocumentLinksInCloud`; `registerDocumentLinksInCloud` carrega `reason` opcional preservando a forma de 5 params); novos módulos puros `js/document-link-audit-read-model.js` (trilha ordenada + unicidade da ativa) e `js/document-link-admin-controller.js` (orquestração correção/revogação/restauração; reuso de command-id na retry com a RPC como autoridade de idempotência; concorrência otimista; mapeamento outcome→UI); novo modal `js/screens/document-link-admin-modal.js` (inspeciona ativos + histórico, corrige, desvincula, restaura; motivo obrigatório; stale/conflict/indisponível fail-closed). Wired só na fila central Documentos (`js/screens/documentos-recebidos.js`: `handleLinkAdmin` guardado + ação de linha "Histórico e vínculos"); superfícies read-only Pedido/OP não tocadas. `index.html` carrega os três módulos novos.
- **Verificação direta de staging:** Hermes aplicou a migration 52 e aprovou estrutura/RPC/grants e matriz autenticada `G28-B8-VERIFY` 18/18; B6 cinco-argumentos e B5 intacto foram confirmados. O browser não possui aplicação/sessão admin: `LIVE_B8_MODAL_SMOKE_BLOCKED_BY_TOOLING`.
- **Testes locais (LF, exit 0):** `document-link-correction-restoration-contract` 13/13; `document-link-audit-read-model` 11/11; `document-link-admin-controller` 18/18; `document-link-admin-modal.smoke` 12/12; `documents-supabase-links` 25/25 (12 novos B8). Bateria documental B4–B8 (26 arquivos) **831/831**. `node --check` nos 5 arquivos JS alterados/novos; `git diff --check` limpo (apenas LF→CRLF informativo). Allow-list de `db/` em `document-decision-command-contract` estendida para `db/52` (gate de manifesto git), consistente com o precedente de `db/51`.
- **Débitos pré-existentes inalterados vs baseline B7:** `pedido-detail.smoke.js` 140/41 (CRLF); `ops-list-screen.smoke.js` 19/11, `op-form-helpers.smoke.js` 33/3, `op-writes.smoke.js` 48/1 (regex estrito de index.html sobre arquivos não tocados); `documents-ingestor.test.js` 2; `g14-c-bridge-smoke.test.js` 15.
- **Estado G28-D:** `RELEASE CONTRACT DISCOVERY COMPLETE / BLOCKED BY SPECIFIC MISSING DEPLOYMENT DEFINITION`. Falta uma definição canônica atual do mapeamento de publicação de produção e do procedimento autorizado para migrations 51/52; ver `docs/releases/G28_D_RELEASE_CANDIDATE.md`. Sem push; produção proibida. Débito não bloqueante: `AUTHENTICATED_BROWSER_SMOKE_BLOCKED_BY_TOOLING`.
- **Contrato B6/B8 preservado:** Documento→Pedido 0..1; Documento→OP 0..N; revisão canônica append-only tipada/versionada; `document_candidates.pedido_id`/`document_events.pedido_id` sob propriedade do Ingestor; `pedido_manual` permanece sugestão; correção/revogação/restauração nunca apagam histórico nem tocam decisão/sugestão.
- **OPEN_ARCHITECT_DECISIONS:** `NONE` para o ciclo atual de staging (ver "Decisão de Arquiteto — Fronteira de Execução Staging-Only" no topo deste arquivo). `DEPLOYMENT_MAPPING_AND_PRODUCTION_MIGRATION_PROCEDURE` está `DEFERRED UNTIL GLOBAL BACKLOG COMPLETION / NOT A CURRENT STAGING BLOCKER`.
- **Fases posteriores:** não autorizadas. G28-D não foi aceito nem publicado; esta autorização limitada não autoriza publicação nem fases posteriores.
- **Plano mestre reconciliado:** `docs/architecture/DOCUMENTOS_VALIDACAO_VINCULOS_E_EVOLUCAO_PLANO.md` (G28-PLAN-R1 2026-07-14)
- **Subfases B5-D5 aceitas:** B5-B1 (idempotent decision command contract), B5-B2 (migration applied/verified staging), D4-R1 (canonical runtime modules loaded), D5-A (source boundary diagnosis), D5-B1 (explicit source classification), D5-B2 (source-gated local decision helpers), D5-B3 (statusOverrides removal), D5-B4 (legacy decision RPC runtime removal), D5 (consolidated regression GREEN). Ver ledger G28 para detalhes de commits e validação.
- **Push:** não executado
- **Produção:** projeto `bhgifjrfagkzubpyqpew` não acessado
- **Runtime boundaries:** canonical register/undo adapters and RPCs preserved; SQL `decidir_documento` preserved (not removed, not migrated); no `statusOverrides` or parallel state; no `decideDocumentInCloud`; explicit manual/legacy local domain temporarily supported; Supabase/unknown/absent/null/invalid/g22-auto fail-closed; no migration, conversion, or removal of legacy domain authorized.

### Controlled Delete × Histórico Documental (Pedido/OP) — RAVATEX-TAPETES-CONTROLLED-DELETE-DOCUMENT-LINK-GUARD

- **Frente:** Controlled Delete (Pedido/OP, teste/staging) × histórico documental canônico G28.
- **Branch:** `work/g28-document-qualification`.
- **Technical HEAD:** `707a37bd1d2c4728ab2a17433b6441049bd88062` — `Guard controlled delete against document link history`.
- **Classificação:** `CLOSED / ACCEPTED`.
- **Problema original:** a exclusão física controlada de Pedido/OP (`db/34`–`db/37`) falhava com violação de FK (`document_link_revision_ops_op_id_fkey`) ao tentar remover OP ainda referenciada por histórico documental canônico (`document_link_revisions` / `document_link_revision_ops`), que é append-only e não pode ser apagado só para permitir a exclusão.
- **Causa raiz e correção (migrations `db/53`–`db/56`, aplicadas e verificadas em staging `ucrjtfswnfdlxwtmxnoo`):**
  - `db/53_controlled_delete_document_link_guard.sql` — renomeia as quatro RPCs legadas de `db/37` para `*_pre53` (revoga `EXECUTE` de todos os papéis) e recria as assinaturas públicas (`diagnosticar_impacto_pedido`, `diagnosticar_impacto_op`, `remover_pedido`, `remover_op`) como wrappers `SECURITY DEFINER`: diagnosticam e enriquecem com contagens documentais, bloqueiam quando há histórico canônico e delegam a `*_pre53` somente quando elegível.
  - `db/54_controlled_delete_document_link_grants.sql` — corrige achado de segurança emergencial (`anon_execute = true` nas 4 RPCs públicas pós-53); revoga `PUBLIC`/`anon`, mantém `authenticated`.
  - `db/55_controlled_delete_document_link_policy_cast.sql` — corrige `to_jsonb(<literal>)` sem cast explícito (erro `could not determine polymorphic type`) via `DO` forward-only que localiza e substitui o literal de política nas duas diagnósticas já aplicadas.
  - `db/56_controlled_delete_document_link_diagnostics_null_safe.sql` — corrige regressão introduzida por `db/53`: `jsonb_set(...)` é `STRICT` e colapsava o retorno inteiro para `NULL` sempre que o alvo não estava bloqueado por histórico documental (`reason` nulo). Corrigido com `COALESCE(to_jsonb(v_reason), 'null'::jsonb)`, preservando o schema JSON.
- **Validação funcional em staging (fixtures sintéticas, cleanup zero, `op_numeros` preservado):**
  - Caso A1 (OP elegível, com dependência real, sem histórico documental): diagnóstico não nulo, `remover_op(...)` concluiu a remoção.
  - Caso A2 (Pedido elegível, com dependência real, sem histórico documental): diagnóstico não nulo, `remover_pedido(...)` concluiu a remoção da cadeia completa.
  - Caso B (com histórico documental em `document_link_revisions`/`document_link_revision_ops`): diagnóstico bloqueado (`classification=blocked`, `documentary_history_blocker=true`); `remover_op`/`remover_pedido` retornaram bloqueio controlado (`ok=false`); Pedido, OP, `document_candidates`, `document_link_revisions` e `document_link_revision_ops` preservados sem nenhuma alteração.
- **ACL final (catálogo verificado ao vivo):** as 4 RPCs públicas — `PUBLIC` sem `EXECUTE`, `anon` sem `EXECUTE`, `authenticated` com `EXECUTE`. As 4 funções `*_pre53` — `PUBLIC`/`anon`/`authenticated` sem `EXECUTE` (só `postgres`).
- **Testes locais finais:** `node --check js/delete-helpers.js` PASS; `tests/controlled-delete.smoke.js` **53/53**; `tests/document-canonical-links-contract.test.js` **21/21**; `git diff --check` PASS.
- **Contrato permanente registrado:** exclusão física de Pedido/OP é bloqueada quando existir histórico documental canônico; `document_link_revisions`/`document_link_revision_ops` nunca são apagados pelo Controlled Delete; wrappers públicos sempre diagnosticam antes de delegar; funções destrutivas internas (`*_pre53`) não constituem API pública; na ausência de histórico documental, a política de exclusão anterior (`db/34`–`db/37`) segue vigente inalterada; histórico documental permanece append-only. Ver `docs/architecture/PEDIDO_OP_SCHEMA_CONTRACT.md`.
- **Produção:** projeto `bhgifjrfagkzubpyqpew` não acessado.
- **Push:** não executado.
- **Ledger:** `docs/ledgers/G28_LEDGER.md` (entrada append-only desta correção).
- **Próxima ação autorizável:** `ARCHITECT DECISION REQUIRED AFTER BACKLOG RECONCILIATION` — múltiplas frentes candidatas sem prioridade inequívoca (G28-D publicação bloqueada por `OPEN_ARCHITECT_DECISIONS: DEPLOYMENT_MAPPING_AND_PRODUCTION_MIGRATION_PROCEDURE`; backlog geral de produção ainda não reconciliado). Esta reconciliação read-only permanece pendente e não é assumida automaticamente por este closeout.

### Admin/Pedido — Resíduo Estático do Botão de Conclusão (Expedição) — ADMIN-PEDIDO-STATIC-RESIDUE

- **Frente:** resíduo estático identificado pela auditoria visual Admin/Pedido de `2026-07-05` (`PEDIDO_PRODUCTION_FLOW_BACKLOG.md` §9.6/§9.7) e reconfirmado como único item aberto na reconciliação read-only do backlog geral de `2026-07-15`.
- **Branch:** `work/g28-document-qualification`.
- **Technical HEAD:** `7978e0a4fe021467cc23e0aeed63ac87ba738f1b` — `Fix admin order completion button state`.
- **Classificação:** `CLOSED / ACCEPTED`.
- **Problema original:** `js/screens/expedicao-admin.js:405` (`buildConclusao`) construía `disabled: ready ? null : 'disabled'`. O helper compartilhado `el()` (`js/ui.js:10-22`) chama `setAttribute(k, v)` para todo atributo do objeto sem omitir `null` (diferente do tratamento de filhos, que pula `null`/`false`); o DOM real materializava isso como `disabled="null"` — atributo booleano presente — desabilitando o botão "Concluir pedido" mesmo quando `ready === true`.
- **Causa raiz confirmada:** comportamento do `el()`, não alterado por esta correção; ocorrência única no repositório (confirmada por `git grep`), sem outra tela reproduzindo o mesmo padrão.
- **Correção aplicada:** localizada inteiramente no call site. `buttonAttrs` passou a ser construído como variável antes do `return`; a chave `disabled` só é adicionada ao objeto quando `!ready` (`buttonAttrs.disabled = 'disabled'`), nunca como `null`. `onclick` (incluindo o guard `if (!ready) return;`), texto, estilos e estrutura do botão preservados sem mudança semântica. O helper global `js/ui.js` não foi alterado.
- **Teste regressivo:** `tests/expedicao-flow.smoke.js` ganhou um novo teste estático que proíbe o padrão original, proíbe a variante invertida (`disabled: !ready ? 'disabled' : null`) e exige o padrão condicional correto.
- **Testes locais:** `node --check js/screens/expedicao-admin.js` PASS; `tests/expedicao-flow.smoke.js` **9/9**; `tests/expedicao-partial-flow.smoke.js` **12/12** (sem regressão); `git diff --check` PASS.
- **Produção:** projeto `bhgifjrfagkzubpyqpew` não acessado.
- **Staging:** não acessado; patch validado apenas localmente.
- **Push:** não executado.
- **Escopo do encerramento:** este closeout encerra especificamente o resíduo estático acima. Não encerra o Controle de Tapetes globalmente, não constitui publicação, não é readiness de produção, não aceita G28-D e não conclui `CLIENTE-ORDER-SUMMARY-READMODEL-APPLY-STAGING-A`, `DELETE-PROD-GUARD-A`, `DELETE-AUDIT-LOG-A`, `G28-CAMADA-2`, `G28-CAMADA-3` ou `G28-CAMADA-4`, que permanecem inalterados.
- **Próxima ação autorizável:** `CLIENTE-ORDER-SUMMARY-READMODEL-APPLY-STAGING-A` — `READY FOR EXPLICIT ARCHITECT AUTHORIZATION` / `NOT STARTED`. Este registro não autoriza sua execução.
- **Ledger:** `docs/ledgers/G28_LEDGER.md` (entrada append-only deste closeout).

### Portal Cliente — Read Model do Detalhe do Pedido — CLIENTE-ORDER-SUMMARY-READMODEL-APPLY-STAGING-A

- **Frente:** read model público do detalhe do Pedido no Portal Cliente (`public.cliente_pedido_summary(uuid)`), consumido por `js/screens/cliente-pedido-detail.js` (~linha 180, `supa.rpc('cliente_pedido_summary', { p_pedido_id })`).
- **Branch:** `work/g28-document-qualification`.
- **Technical HEAD:** não aplicável — a fase não alterou arquivos (verificação-somente). **Commit documental:** este closeout (`Close client order summary read model staging validation`). O HEAD atual deve ser consultado com `git rev-parse HEAD`.
- **Classificação:** `CLOSED / ACCEPTED_WITH_NONBLOCKING_DEBTS` (decisão arquitetural explícita 2026-07-15).
- **Objeto em staging (`ucrjtfswnfdlxwtmxnoo`, PostgreSQL 17.6):** `db/30_cliente_pedido_summary_readmodel.sql` **já estava aplicada**. A função existe com assinatura `cliente_pedido_summary(p_pedido_id uuid)`, `RETURNS jsonb`, `SECURITY DEFINER`, `STABLE`, `search_path=public`, owner `postgres`, `plpgsql`; o corpo (`pg_get_functiondef`) é equivalente byte a byte ao `db/30` (só diferem finais de linha CRLF vs LF) — **sem drift de schema**. As 16 tabelas de dependência existem.
- **Proveniência de migration:** `db/30` **não está registrada** em `supabase_migrations.schema_migrations` (o histórico rastreado começa em `document_technical_evidences`/`document_decision_command`/`52`…`56`; `db/30` antecede esse rastreio). Objeto existe sem linha de histórico; proveniência mantida explícita.
- **ACL ao vivo (divergente do contrato canônico):** `EXECUTE` concedido a `PUBLIC`, `anon`, `authenticated` e `service_role`. O `db/30` (e a decisão `D-COS02`) pretendem **apenas** `authenticated`. Os grants extras são artefato dos default privileges do Supabase — mesma classe do achado `db/54`. **Não normalizado silenciosamente**: retido como dívida de governança/higiene.
- **Comportamento empírico (somente-leitura; cada RPC em `BEGIN … ROLLBACK`; função `STABLE`/read-only; zero mutação de dados):** T1 cliente de teste (`tipo='cliente'`, `cliente_id=3`) no Pedido próprio (`numero 33`, `rascunho`) → `ok=true`, DTO completo; T2 `anon` no mesmo Pedido → `ok=false`, "Pedido nao encontrado ou sem permissao" (**fail-closed**: executa mas não recebe dados — **sem exposição confirmada**); T3 cliente 3 em Pedido de terceiro (`cliente_id=22`) → `ok=false` (negação cross-tenant); T4 admin em Pedido de terceiro → `ok=true` (caminho admin).
- **Contrato com o frontend:** todos os campos consumidos presentes com tipo correto (top-level `ok/pedido/itens/parciais/entregas/pendencias/chain_state/timeline/status/status_label/progresso_percentual`; `pedido.*`; `chain_state.{isOperationalOverride,displayStatus}`; `entregas[]{descricao,data,quantidade}`; `timeline[]{data,titulo,descricao,status}`; `itens[]{modelo,largura,cor_1,cor_2,metros}`). Coleções vazias vêm como `[]` (COALESCE) e nulos (`tipo_recebimento`, `observacao`) são tratados sem erro pelo consumidor; ramos `loadingError` não estão no caminho feliz — **sem dependência de fallback silencioso**.
- **Nível de validação do portal:** `STATIC_CONTRACT_WITH_REAL_RPC_PAYLOAD`. Smoke autenticado no browser não executado (sem senha do cliente de teste) — dívida não bloqueante.
- **Gates locais:** `node --check js/screens/cliente-pedido-detail.js` PASS; `git diff --check` limpo; `git status --short` vazio; HEAD inalterado durante a verificação técnica.
- **Acesso e ferramentas:** Supabase MCP **não exposto na sessão** (sem `.mcp.json`, sem connector instalado); CLI `supabase` não instalada. O **fallback direto PostgreSQL autorizado** foi usado apenas para verificação; o tooling temporário fora do repo (driver pg + runner guardado + arquivo de credenciais) foi removido depois; nenhum segredo ecoado em comando/log/relatório/Git. Produção (`bhgifjrfagkzubpyqpew`) não acessada; o runner recusa o ref de produção internamente.
- **Sem alterações na verificação:** sem mutação de schema, sem mutação de dados, sem fixtures, sem alteração de código/SQL, sem nova migration, sem remediação de ACL, sem commit, sem push.
- **Débitos não bloqueantes:** (1) `ACL_GRANTS_BROADER_THAN_CANONICAL_CONTRACT` — `PUBLIC`/`anon` ainda com `EXECUTE`, anon fail-closed, sem exposição confirmada, remediação exige migration grants-only autorizada em fase própria; (2) `DB30_NOT_RECORDED_IN_SUPABASE_MIGRATION_HISTORY` — objeto existe, sem drift, proveniência explícita; (3) `AUTHENTICATED_BROWSER_SMOKE_NOT_EXECUTED` — bloqueado por ausência de senha de cliente de teste; RPC real e contrato de frontend validados.
- **Candidato de remediação de ACL (registrado, não autorizado, não iniciado):** `CLIENTE-ORDER-SUMMARY-READMODEL-ACL-GRANTS-R1` — `ARCHITECT DECISION REQUIRED`. Escopo pretendido, se autorizado: migration grants-only forward análoga ao `db/54` (`REVOKE EXECUTE … FROM PUBLIC, anon`, preservando `authenticated`). Não criada neste closeout.
- **Escopo do encerramento:** encerra especificamente esta validação de staging do read model. Não encerra o Controle de Tapetes globalmente, não é publicação, não é readiness de produção, não aceita G28-D e não altera `DELETE-PROD-GUARD-A`, `DELETE-AUDIT-LOG-A`, `G28-CAMADA-2`, `G28-CAMADA-3`, `G28-CAMADA-4`.
- **Próxima ação autorizável:** `ARCHITECT DECISION REQUIRED AFTER BACKLOG RECONCILIATION` — sem próxima ação única inequívoca; o candidato de remediação de ACL não deve ser autosselecionado.
- **Ledger:** `docs/ledgers/G28_LEDGER.md` (entrada append-only deste closeout).

### Documentação Canônica — Backfill de Consistência — DOCS-CANONICAL-CONSISTENCY-BACKFILL-A

- **Frente:** fecha 3 lacunas de documentação identificadas pela reconciliação read-only do backlog geral de `2026-07-15`. Docs-only: sem código, teste, SQL, migration, staging ou produção alterados.
- **Branch:** `work/g28-document-qualification`.
- **Commit documental:** este closeout (`Backfill canonical migration documentation`). O HEAD atual deve ser consultado diretamente com `git rev-parse HEAD`.
- **Classificação:** `CLOSED / ACCEPTED`.
- **Lacunas fechadas:**
  1. `db/37_controlled_delete_expedicao_cascade.sql` nunca havia recebido entrada `D-DEL` própria (lacuna registrada em `docs/architecture/PEDIDO_OP_MOVIMENTACAO_DOCUMENTOS_PLANO.md` junto às decisões `D-DEL10`–`D-DEL13`) — adicionada `D-DEL14` em `docs/architecture/PEDIDO_OP_SCHEMA_CONTRACT.md` §10 ("Fase Controlled Delete — Expedição Cascade (db/37)"), derivada do arquivo `db/37` real e da sequência `db/34`–`db/36`.
  2. `db/34`–`db/37` e `db/53`–`db/56` ausentes de `docs/DOCUMENTATION_INDEX.md` §4 — 8 linhas adicionadas com descrição derivada do conteúdo real de cada arquivo de migration.
  3. Status de `db/30` no mesmo índice ainda descrito como "ainda não aplicado" — corrigido para: aplicada e funcionalmente verificada em staging (`ucrjtfswnfdlxwtmxnoo`), sem drift de schema confirmado, não registrada em `supabase_migrations.schema_migrations`, ACL ao vivo mais ampla que a intenção canônica `authenticated`-only (`D-COS02`), comportamento `anon` empiricamente fail-closed, sem exposição de dados de cliente confirmada, remediação de ACL como decisão de arquiteto separada, smoke autenticado de browser como débito não bloqueante.
- **Não alterado:** nenhuma entrada histórica de closeout foi reescrita para fazer a omissão anterior desaparecer; `docs/architecture/PEDIDO_OP_MOVIMENTACAO_DOCUMENTOS_PLANO.md` e `docs/architecture/DOCUMENTOS_VALIDACAO_VINCULOS_E_EVOLUCAO_PLANO.md` foram lidos e permaneceram inalterados (nenhuma afirmação de estado atual materialmente incorreta encontrada); nenhum código, teste, SQL, migration, staging ou produção tocados; `git diff --check` limpo.
- **Débitos preservados como abertos** (não fechados nem resolvidos por este backfill): `CLIENTE-ORDER-SUMMARY-READMODEL-ACL-GRANTS-R1` (`ARCHITECT DECISION REQUIRED`); `DB30_NOT_RECORDED_IN_SUPABASE_MIGRATION_HISTORY`; débitos de smoke autenticado (G28-C/D/B7/Portal Cliente); `DEPLOYMENT_MAPPING_AND_PRODUCTION_MIGRATION_PROCEDURE`; `G28-D` (publicação); aplicação em produção das migrations staging-only (`db/12`, `db/21`, `db/30`, `db/49`–`db/56`); `DELETE-PROD-GUARD-A`; `DELETE-AUDIT-LOG-A`; frentes `G28-CAMADA-2/3/4`.
- **Produção:** projeto `bhgifjrfagkzubpyqpew` não acessado. **Push:** não executado.
- **Próxima ação autorizável:** `ARCHITECT DECISION REQUIRED` — `DEPLOYMENT_MAPPING_AND_PRODUCTION_MIGRATION_PROCEDURE` permanece o único gate material do backlog. Este backfill documental não autoriza nenhuma fase técnica posterior.
- **Ledger:** `docs/ledgers/G28_LEDGER.md` (entrada append-only deste closeout).

### Portal Cliente — ACL Grants Hardening — CLIENTE-ORDER-SUMMARY-READMODEL-ACL-GRANTS-R1

- **Frente:** remediação de ACL do read model público `public.cliente_pedido_summary(uuid)`, fechando o débito `ACL_GRANTS_BROADER_THAN_CANONICAL_CONTRACT` registrado no closeout `CLIENTE-ORDER-SUMMARY-READMODEL-APPLY-STAGING-A`.
- **Branch:** `work/g28-document-qualification`.
- **Technical HEAD:** `82f5ba70ace2e74c51b7c0295d1ecf8e319954be` — `Restrict client order summary RPC grants`. **Commit documental:** este closeout (`Close client order summary RPC grant hardening`). O HEAD atual deve ser consultado diretamente com `git rev-parse HEAD`.
- **Classificação:** `CLOSED / ACCEPTED`.
- **Migration:** `db/57_cliente_pedido_summary_acl_grants.sql`, grants-only, forward-only, idempotente. Aplicada exatamente uma vez via Supabase MCP (operação de migration rastreada) em staging `ucrjtfswnfdlxwtmxnoo`; registro `20260715190627 / 57_cliente_pedido_summary_acl_grants` confirmado no catálogo de migrations.
- **ACL final (verificada ao vivo):** `PUBLIC` sem `EXECUTE`; `anon` sem `EXECUTE`; `authenticated` com `EXECUTE`; `service_role` sem `EXECUTE` explícito (nenhum consumidor real encontrado na busca completa do repositório — apenas o cliente frontend autenticado em `js/screens/cliente-pedido-detail.js`). Owner `postgres` retém privilégio inerente de owner.
- **Contrato da função preservado sem alteração:** nome, assinatura `cliente_pedido_summary(uuid)`, retorno `jsonb`, `SECURITY DEFINER`, `STABLE`, `search_path=public`, owner `postgres`, corpo — hash de definição idêntico antes/depois da migration (verificado via `pg_get_functiondef`).
- **Matriz empírica de papéis (staging, read-only, `BEGIN … ROLLBACK`):** `anon` agora recebe `ERROR 42501: permission denied for function cliente_pedido_summary` no limite de ACL, antes de qualquer execução da função (upgrade em relação ao fail-closed pós-execução anterior); `authenticated` dono → `ok=true`, DTO completo; `authenticated` cross-tenant → `ok=false` (negação de negócio, fail-closed, sem dados de terceiros); `authenticated` admin → `ok=true`, DTO completo; `service_role` via `SET ROLE` direto → `ERROR 42501` (grant de objeto revogado com sucesso; o atributo de plataforma `rolbypassrls` do `service_role` é um mecanismo de bypass de RLS em tabelas, distinto e não relacionado ao `EXECUTE` de função, e não restaura acesso).
- **Frontend:** `js/screens/cliente-pedido-detail.js` permanece o único consumidor real, via `window.supa.rpc('cliente_pedido_summary', ...)` no caminho autenticado padrão; nenhuma alteração de frontend foi necessária ou realizada.
- **Testes locais:** `tests/cliente-pedido-summary-acl-grants.smoke.js` (novo, 13 asserções) + `tests/cliente-pedido-summary-readmodel.smoke.js` (existente) — **21/21 PASS**; `git diff --check` limpo.
- **Sem mutação de dados:** todas as verificações empíricas rodaram em transações `BEGIN … ROLLBACK`; nenhuma fixture criada; registros reais pré-existentes reutilizados (pedido 33/cliente_id 3, pedido 34/cliente_id 22, usuários admin/cliente existentes).
- **Débito fechado:** `ACL_GRANTS_BROADER_THAN_CANONICAL_CONTRACT` — **RESOLVED IN STAGING**.
- **Débitos preservados como abertos (não fechados por esta fase):** `DB30_NOT_RECORDED_IN_SUPABASE_MIGRATION_HISTORY` (nenhum registro de migration-history fabricado ou reparado para `db/30`); `AUTHENTICATED_BROWSER_SMOKE_NOT_EXECUTED`; aplicação em produção do stack staging-only (`db/57` incluído) permanece postergada por `STAGING-ONLY-EXECUTION-BOUNDARY-A`.
- **Produção:** `bhgifjrfagkzubpyqpew` não acessada. **Push:** não executado. **Vercel:** não acessado.
- **Escopo do encerramento:** encerra especificamente a remediação de ACL desta RPC. Não autoriza produção, publicação, G28-D, reparo do histórico de migration de `db/30`, smoke autenticado de browser ou Controlled Delete production guard.
- **Próxima ação autorizável:** `ARCHITECT DECISION REQUIRED AFTER BACKLOG RECONCILIATION` — sem candidato técnico único inequívoco após remover esta fase do backlog aberto.
- **Ledger:** `docs/ledgers/G28_LEDGER.md` (entrada append-only deste closeout).

### Documentação Canônica — Consistência de Status dos Planos Legados Pedido↔OP — DOCS-PEDIDO-OP-LEGACY-PLAN-STATUS-CONSISTENCY-R1

- **Frente:** reconcilia as linhas de status materialmente desatualizadas das Fases legadas D–J nos dois planos técnicos da frente Pedido ↔ OP ↔ Movimentação ↔ Documentos. Docs-only: sem código, runtime, teste, SQL, migration, staging ou produção alterados.
- **Branch:** `work/g28-document-qualification`.
- **Commit documental:** este closeout (`Reconcile legacy Pedido OP plan phase statuses`). O HEAD atual deve ser consultado com `git rev-parse HEAD`.
- **Classificação:** `CLOSED / ACCEPTED`.
- **Correção aplicada** (`docs/architecture/PEDIDO_OP_SCHEMA_CONTRACT.md` §9 e `docs/architecture/PEDIDO_OP_MOVIMENTACAO_DOCUMENTOS_PLANO.md` §5):
  - Fases **D/E/F** deixam de aparecer como `Pendente`/em branco e passam a **Entregue** através do trabalho de fluxo produtivo aceito (Pedido Detail lista OPs vinculadas; stepper/preview via `derivePedidoChainState`; Pedido reutiliza operações canônicas da OP sem write paralelo). Base: `PEDIDO_PRODUCTION_FLOW_BACKLOG.md` §1.1/§1.2/§9.4/§9.5/§9.7.
  - Fases **G/H/I** passam a **Superada** pela pipeline documental canônica G28 (`document_link_revisions`/`document_link_revision_ops`, db/51/52; `documentos_operacionais` nunca criada). Base: `DOCUMENTOS_VALIDACAO_VINCULOS_E_EVOLUCAO_PLANO.md`, G28-B1…C aceitos.
  - Fase **J** permanece visível como `Futura / não sequenciada / não iniciada / não autorizada` (bloqueio transacional de saldo por etapa; `PEDIDO_OP_SCHEMA_CONTRACT.md` §7).
- **Não alterado:** nenhuma seção datada histórica reescrita; o desenho arquitetural original (`documentos_operacionais` §4, saldo por etapa §7) preservado como intenção; nenhum código/teste/SQL/migration/runtime tocado; nenhuma fase de implementação autorizada.
- **Estado inalterado por esta correção:** `ACTIVE_PHASE: NONE`; `NEXT_AUTHORIZABLE_ACTION: NONE` pendente de seleção explícita de arquiteto de uma nova frente. Débitos e frentes deferidas permanecem abertos e inalterados.
- **Produção:** `bhgifjrfagkzubpyqpew` não acessada. **Push:** não executado. **Supabase/MCP/staging/Vercel:** não acessados.
- **Ledger:** `docs/ledgers/G28_LEDGER.md` (entrada append-only deste closeout).

### Débitos relevantes

- Migrations 49 e 50 — aplicadas e verificadas em staging; não aplicadas em produção por esta cadeia.
- Evoluções posteriores de UI/runtime, destino da RPC legada e qualquer linking/revogação requerem nova decisão arquitetural.
- Push — não autorizado nesta cadeia.

### Referência histórica

- Preservação pré-modelo: `docs/legacy/pre-model/MANIFEST.md`
- Ledger da frente G28: `docs/ledgers/G28_LEDGER.md`

### Links obrigatórios

- Modelo de governança documental: `docs/governance/DOCUMENTATION_MODEL.md`
- Árbitro de autoridade documental: `docs/DOCUMENTATION_INDEX.md`
- Plano mestre G28: `docs/architecture/DOCUMENTOS_VALIDACAO_VINCULOS_E_EVOLUCAO_PLANO.md`
- Plano Pedido/OP/Movimentação/Documentos: `docs/architecture/PEDIDO_OP_MOVIMENTACAO_DOCUMENTOS_PLANO.md`
- Estado local do Ingestor (contexto técnico): `services/documents-ingestor/PROJECT_STATE.md`

# HISTÓRICO LEGADO PRÉ-MODELO — ARQUIVADO

O conteúdo histórico completo que existia neste arquivo antes da
compactação foi preservado, byte a byte, em:

`docs/legacy/pre-model/PROJECT_STATE_FULL_SNAPSHOT.md`

Manifesto de integridade:

`docs/legacy/pre-model/MANIFEST.md`

Commit de origem do snapshot:

`08b9af5e251de48e938600e5e4b4214e4d1e824e`

SHA-256 do snapshot completo:

`7cacddd59c5b2fe9bae1add1a54a3433c370ccdad713bbd4010a1d11f1b39a98`

O snapshot não é fonte de estado atual e não deve ser editado nem receber
novos closeouts.

A evolução histórica estruturada será registrada em ledger próprio da
frente em fase posterior.

Esta seção não deve acumular novo conteúdo histórico.
