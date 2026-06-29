# AGENT_HANDOFF.md — Controle de Tapetes

> Para uma nova sessão de IA continuar com segurança. Leia junto:
> `PROJECT_STATE.md`, `docs/architecture/PORTAL_B2B_ARCHITECTURE_RULES.md`
> e `docs/refactor/ARCHITECTURE_REFACTOR_LEDGER.md`.
> Regras vinculantes em `docs/architecture/CODE_HEALTH_RULES.md`.
> Índice de fontes canônicas vs. legadas em
> `docs/DOCUMENTATION_INDEX.md`.
> Convenção: **tudo em português brasileiro**.

## Estado atual aceito
- **Estado atual aceito:** `work/app-next` na ponta da fase
  `RAVATEX-TAPETES-CLIENTE-PORTAL-UI-OPERATIONS-RULES-A` (docs-only,
  matriz operacional de decisoes para UI; sem codigo, sem schema, sem
  SQL, sem Supabase). Produzido
  `docs/ui/CLIENTE_PORTAL_UI_OPERATIONS_RULES.md`, derivado do
  inventario `docs/ui/CLIENTE_PORTAL_UI_GAP_INVENTORY.md`, para
  separar: decisoes ja consolidadas, decisoes pendentes do dono do
  projeto, recomendacoes tecnicas, impacto por tela e sequencia futura
  de implementacao. **Decisoes ja fechadas preservadas:** cliente nao
  ve OP/lote/fornecedor/NF-romaneio/custo-margem/metadata; portal
  cliente permanece read-only exceto criacao de pedido; status
  operacional e status visual continuam separados; admin publica
  status visual; fornecedor nao altera status visual diretamente nesta
  etapa; timeline cliente le apenas eventos visiveis; producao segue
  bloqueada. **Pendencias principais a responder antes de qualquer UI:**
  `OP-001` fluxo de novo pedido (1 etapa vs 2 etapas), `OP-002` inline
  vs modal para item, `OP-003` campos obrigatorios por item, `OP-004`
  exibir `tipo_recebimento`, `OP-005` uso de `referencia_cliente`,
  `OP-006` separar `prazo_desejado` de `prazo_entrega`, `OP-007`
  exibir ou nao `pedido.status` operacional ao cliente, `OP-008`
  acoes rapidas no dashboard, `OP-009` menu com 2 ou 4 itens,
  `OP-010` existencia de Suporte, `OP-011` upload/imagem por item,
  `OP-012` edicao/cancelamento pelo cliente. **A UI continua
  funcional, NAO final.** **A proxima etapa correta nao e implementar
  UI ainda**: primeiro o dono do projeto deve responder `OP-001` a
  `OP-012`; so depois entram `UI-GAP-FIX-NOVO-PEDIDO-A`,
  `UI-GAP-FIX-MODAL-ITEM-A`, `UI-GAP-FIX-DETALHE-A`,
  `UI-GAP-FIX-DASHBOARD-A` e por ultimo `UI-GAP-FIX-SHELL-A`
  (risco cross-role do `shellLayout`). `docs/ui/CLIENTE_PORTAL_UI_OPERATIONS_RULES.md`
  e documento diagnostico/operacional, nao-canonico, indexado em
  `docs/DOCUMENTATION_INDEX.md` §1b.
- **Estado atual aceito:** `work/app-next` na ponta da fase
  `RAVATEX-TAPETES-CLIENTE-PORTAL-UI-GAP-INVENTORY-A` (docs-only,
  inventário de gaps de UI, read-only/diagnóstico — sem código, sem
  schema, sem SQL, sem Supabase). HEAD: ver `git log -1` (commit desta
  fase, mensagem `"Inventory cliente portal UI gaps"`). Supabase
  staging: `ucrjtfswnfdlxwtmxnoo` (não acessado nesta fase — só
  leitura de arquivos locais). Produção/original
  `bhgifjrfagkzubpyqpew` e `origin/main` **intocados**.
- **Inventário de gaps de UI do Portal Cliente B2B** (fase
  `RAVATEX-TAPETES-CLIENTE-PORTAL-UI-GAP-INVENTORY-A`, esta, docs-only).
  Produzido `docs/ui/CLIENTE_PORTAL_UI_GAP_INVENTORY.md`, comparando os
  5 mockups aprovados (localizados fora do repo em
  `D:\OneDrive\Ravatex\Inttex\Mockups - nova interface\`: Dashboard
  Cliente, Novo Pedido, Modal Adicionar Item, Detalhe do Pedido,
  Admin-Cliente-Acompanhamento B2B) contra as 6 telas/áreas do portal
  cliente atual (Dashboard, Novo Pedido, Modal Adicionar Item, Detalhe
  do Pedido, Acompanhamento/Stepper/Timeline, Shell/Menu). Gaps
  principais: KPIs do dashboard com semântica diferente do mockup;
  fluxo de novo pedido em 1 etapa/itens inline em vez de tabela+modal+
  checkout em 2 etapas; campos já existentes no schema
  (`referencia_cliente`, `tipo_recebimento`, `cor_1_id`/`cor_2_id`/
  `largura` por item) não capturados na criação; exibição simultânea
  do status operacional (`pedidoStatusBadge`) e do status visual no
  detalhe; stepper sem datas por etapa; shell/menu cliente com 2 itens
  (faltam "Novo pedido" e "Suporte") e sem identidade visual própria,
  usando `shellLayout` **compartilhado com admin/fornecedor** (risco
  alto para qualquer correção futura). Particularidades operacionais
  registradas como **TBD explícito** (sem inventar regra): obrigação
  ou não de "tipo de recebimento"; checkout em 1 ou 2 etapas; manter
  ou não o status operacional visível ao cliente; campos obrigatórios
  do formulário; regras futuras de edição/cancelamento pelo cliente.
  Proposta de 6 fases futuras no documento (`UI-GAP-FIX-DASHBOARD-A`,
  `UI-GAP-FIX-NOVO-PEDIDO-A`, `UI-GAP-FIX-MODAL-ITEM-A`,
  `UI-GAP-FIX-DETALHE-A`, `UI-GAP-FIX-SHELL-A`,
  `UI-OPERATIONS-RULES-A`), com `UI-OPERATIONS-RULES-A` recomendada
  como **primeira** (resolve os TBDs antes do código) e
  `UI-GAP-FIX-SHELL-A` como **última** (maior risco, cross-role).
  **A UI permanece funcional, NÃO final.** **Produção permanece
  bloqueada.** Sem código, sem schema, sem SQL, sem Supabase, sem Edge
  Function, sem frontend, sem testes de app (apenas verificação Git).
  Senha, token e credencial **não foram registrados**.
  `docs/ui/CLIENTE_PORTAL_UI_GAP_INVENTORY.md` é diagnóstico/não-
  canônico, indexado em `docs/DOCUMENTATION_INDEX.md` §1b.
- **Estado anterior:** fase
  `RAVATEX-TAPETES-CLIENTE-PORTAL-STAGING-CLOSEOUT-A` (docs-only,
  closeout do marco funcional do portal cliente em staging — sem
  schema/SQL/Supabase). HEAD fechado: `23286ae`. `staging/main`:
  `23286ae`. Supabase staging: `ucrjtfswnfdlxwtmxnoo`. Produção/
  original `bhgifjrfagkzubpyqpew` e `origin/main` **intocados**.
- **Closeout funcional de staging do Portal Cliente B2B** (fase
  `RAVATEX-TAPETES-CLIENTE-PORTAL-STAGING-CLOSEOUT-A`, esta,
  docs-only). O portal cliente esta **funcionalmente homologado em
  staging**: perfil cliente, login cliente, criacao/lista/detalhe de
  pedido cliente, dashboard cliente read-only, status visual publicado
  pelo admin, stepper/acompanhamento, timeline read-only, policy
  cliente para eventos visiveis, provisionamento cliente em staging
  via `admin-create-user` validado, ausencia de exposicao de dados
  internos, portal 100% read-only para o cliente (exceto criacao de
  pedido) e polimento visual inicial. **A UI NAO esta marcada como
  final** — o dono do projeto confirmou que a apresentacao atual ainda
  diverge dos HTMLs/mockups pedidos e que havera nova rodada de
  refinamento visual e ajustes para particularidades operacionais.
  **Producao permanece bloqueada**: nenhuma autorizacao de merge ou
  deploy para `origin/main` foi dada nesta fase. Sem codigo, sem
  schema, sem SQL, sem Supabase, sem Edge Function, sem frontend, sem
  testes (apenas verificacao Git). Senha, token e credencial **nao
  foram registrados**. Proxima fase recomendada: inventario de gaps de
  UI (mockups/HTMLs vs. implementacao atual) antes de qualquer nova
  implementacao ou decisao de promocao para producao.
- **Estado anterior:** fase
  `RAVATEX-TAPETES-CLIENTE-PORTAL-VISUAL-HOMOLOG-RECORD-A` (docs-only,
  registro de homologacao visual aprovada — sem schema/SQL/Supabase).
  HEAD homologado: `3b0f8e4`.
- **Homologação visual do portal cliente APROVADA** (fase
  `RAVATEX-TAPETES-CLIENTE-PORTAL-VISUAL-HOMOLOG-RECORD-A`, esta,
  docs-only). Validação manual/controlada pelo dono do projeto, no HEAD
  `3b0f8e4`, em ambiente conectado ao Supabase staging
  `ucrjtfswnfdlxwtmxnoo`, **sem tocar produção/original**
  `bhgifjrfagkzubpyqpew`. Aprovados: **Dashboard Cliente**, **Meus
  pedidos**, **Detalhe do pedido**, **Stepper/Acompanhamento** e
  **Timeline de atualizações** — as 5 telas refinadas na fase
  `RAVATEX-TAPETES-CLIENTE-PORTAL-VISUAL-POLISH-A`. **Responsividade
  básica** aprovada (desktop e largura menor, sem sobreposição
  grosseira, tabelas com rolagem horizontal quando necessário, menu
  permanece utilizável). **Nenhum dado interno**
  (OP/lote/fornecedor/NF/romaneio/custo/margem/metadata/criado_por/
  origem/token_acesso) exposto ao cliente. Portal cliente **permanece
  read-only** — sem editar pedido, cancelar pedido, atualizar status,
  publicar evento ou mexer em fornecedor. **Nenhuma regressão
  funcional reportada**. **Sem** código/schema/SQL/Supabase/frontend/
  teste nesta fase. Senha, token e qualquer credencial **não foram
  registrados**.
- **Polish visual do portal cliente** (fase
  `RAVATEX-TAPETES-CLIENTE-PORTAL-VISUAL-POLISH-A`, esta): refinada a
  camada de apresentação das 5 telas do portal cliente sem alterar
  nenhum comportamento homologado. `cliente-dashboard.js` ganhou
  cards/KPIs com borda de cor, grade de 2 colunas (desktop) entre
  "Pedidos recentes" e "Últimas atualizações", e badges com tom de
  cor derivado da exceção (mesma paleta do stepper, antes fixo em
  azul). `cliente-pedidos-list.js` ganhou contador de resultados,
  rolagem horizontal na tabela e renomeou a ação "Visualizar" para
  "Ver pedido" (consistência com o Dashboard) — **select de pedidos
  inalterado**. `cliente-pedido-detail.js` reorganizou o resumo em
  grade de 3 colunas e deu à timeline "Atualizações do pedido" um
  indicador visual de linha do tempo (ponto + conector) — **selects
  de pedidos/pedido_itens/pedido_cliente_eventos inalterados**.
  `cliente-pedido-tracking.js` recebeu apenas ajustes de classe
  (cantos, sombra, tamanho de círculo); taxonomia, exceções,
  "cancelado" como exceção terminal e mensagem personalizada
  permanecem intactos; continua sem consultar Supabase.
  `cliente-common.js` **não foi alterado** (menu "Início"/"Meus
  pedidos" já atendia ao padrão). Novo teste cruzado
  `tests/cliente-portal-visual.smoke.js` (49 casos) garante, num só
  lugar, que nenhuma das 5 telas ganhou exposição de
  metadata/criado_por/origem/`pedido_eventos`/OP/lote/fornecedor/NF/
  romaneio/custo/margem/token_acesso nem ação de escrita, e que os
  SELECTs de dados permanecem **literalmente idênticos** aos de antes
  da fase (guarda anti-regressão por comparação de string exata).
  Verificação visual manual feita em app local conectado ao staging
  `ucrjtfswnfdlxwtmxnoo` (usuário `cliente@teste.com`): Dashboard,
  Detalhe e Meus pedidos renderizam sem erro de console, com o tom de
  cor e o layout em 2 colunas funcionando como esperado. **Admin e
  fornecedor não foram tocados. Sem schema/SQL/Supabase nesta fase.**
  Testes: lista obrigatória da fase + `cliente-pedidos-list` +
  `cliente-portal-visual` (novo, com 49 casos) = 265 testes, todos
  passando.
- **Homologação Dashboard Cliente APROVADA** (fase
  `RAVATEX-TAPETES-CLIENTE-DASHBOARD-HOMOLOG-RECORD-A`, esta,
  docs-only). Validação manual/controlada feita em **app local
  (`http://localhost:8765/`) conectado ao Supabase staging
  `ucrjtfswnfdlxwtmxnoo`** (runtime confirmou `APP_ENV=staging` e
  `SUPABASE_URL` → `ucrjtfswnfdlxwtmxnoo`), no HEAD `54fabfa`, **sem
  tocar produção/original `bhgifjrfagkzubpyqpew`**. Confirmado: login
  cliente cai em `#/cliente/dashboard`; menu "Início" + "Meus pedidos"
  funcionais; dashboard sem erro de console; KPIs coerentes (em aberto
  2, em andamento 2, prontos/concluidos 0, atualizacoes recentes 3);
  pedidos recentes (#3 excecao "Aguardando insumo", #2 "Acabamento");
  ultimas atualizacoes exibidas; "Ver pedido" abre o detalhe correto
  com **stepper + timeline** preservados; navegacao
  dashboard→detalhe→Meus pedidos→dashboard OK; **sem** dados internos
  (OP/lote/fornecedor/NF/romaneio/custo/margem/metadata/criado_por/
  origem/token_acesso) e **sem** acoes de escrita (read-only). Cliente
  de teste usado: `cliente@teste.com`, `tipo=cliente`, `cliente_id=3`,
  nome "Teste" (**senha não registrada**). Observacao nao bloqueante:
  evento cujo `titulo` = status pode repetir o texto no titulo e no
  badge — dado do evento, nao defeito. **Sem** codigo/schema/SQL/
  Supabase/frontend/teste nesta fase.
- **Dashboard Cliente read-only** (fase
  `RAVATEX-TAPETES-CLIENTE-DASHBOARD-A`, esta): novo modulo
  `js/screens/cliente-dashboard.js` (`screenClienteDashboard`) servindo
  de pagina inicial do portal B2B em `#/cliente/dashboard`
  (`roles: ['cliente']`, registrada em `js/boot.js`). `routeAfterLogin`
  (em `js/router.js`) passa a levar o cliente para `#/cliente/dashboard`
  apos login; `#/cliente/pedidos`, `#/cliente/pedidos/novo` e
  `#/cliente/pedidos/<uuid>` continuam funcionando. Menu cliente
  (`CLIENTE_MENU` em `cliente-common.js`) ganha **"Início"** preservando
  **"Meus pedidos"**. Dashboard mostra cards/KPIs (em aberto, em
  andamento, prontos/concluidos, atualizacoes recentes) derivados
  localmente; ate 5 pedidos recentes com label visual via
  `window.RavatexPedidoTracking` e botao "Ver pedido"; e as ultimas
  atualizacoes (ate 8) lidas de `pedido_cliente_eventos`, com empty
  state "Suas atualizações aparecerão aqui.". **Pedidos** lidos com
  SELECT explicito apenas dos campos seguros (`id, numero, status,
  status_cliente_visual, status_cliente_excecao,
  status_cliente_mensagem, status_cliente_atualizado_em, prazo_entrega,
  prazo_desejado, tipo_recebimento, criado_em, atualizado_em`).
  **Eventos** lidos com SELECT explicito (`id, pedido_id, status,
  titulo, mensagem, criado_em`), `order('criado_em', desc)`, erro
  isolado em `state.eventosError` sem quebrar o resto. **Sem**
  `metadata`/`criado_por`/`origem`, **sem** `select('*')`, **sem**
  `pedido_eventos`, **sem** `OP`/`lote`/`fornecedor`/`NF`/`romaneio`/
  `custo`/`margem`/`token_acesso`. Read-only: sem insert/update/delete/
  rpc/`functions.invoke`/`service_role`. **Admin e fornecedor
  intocados. Sem schema/SQL/Supabase. Producao `bhgifjrfagkzubpyqpew`
  intocada.** Testes: `tests/cliente-dashboard.smoke.js` novo (32/32);
  `tests/boot.smoke.js`, `tests/cliente-routing.smoke.js` atualizados
  para a nova contagem de rotas (20) e o novo destino pos-login.
  Proxima fase recomendada: homologacao manual do dashboard em staging
  ou refinamento visual do portal cliente.
- **HEAD aceito de entrada desta fase:** `fc7843c`
  (fase TRACKING-CLIENTE-EVENTS-A tecnicamente aceita, timeline
  read-only entregue no frontend; esta fase apenas registra a
  homologação manual feita sobre esse HEAD, sem alterar código).
- **HEAD homologado em staging:** `fc7843c`.
- **Working tree:** limpo após commit.
- **origin/main:** `1047181eba888242c6428de366cbd9fda2f1c72c` — intocado
- **PR #2:** intocado
- **⚠️ NÃO CHAMAR `ucrjtfswnfdlxwtmxnoo` DE "PRODUÇÃO ORIGINAL".**
  É o ambiente paralelo. O app original online está em
  `bhgifjrfagkzubpyqpew` + Vercel e **não deve ser tocado**.
- **⚠️ NÃO TOCAR `bhgifjrfagkzubpyqpew`.**
- **⚠️ NÃO TOCAR Vercel original.**
- **Schema Pedidos** `db/13_pedidos_schema.sql` aplicado em
  `ucrjtfswnfdlxwtmxnoo`: tabelas `pedidos`, `pedido_itens`,
  `pedido_eventos` e `lotes.pedido_id` (nullable). RLS admin-only.
  Sem policy pública. Sem `pedidos.op_id`.
- **Schema Cliente Perfil** `db/14_cliente_perfil_schema.sql`
  **aplicado em staging** `ucrjtfswnfdlxwtmxnoo` via Management API
  (fase B2). Role `cliente`, `usuarios.cliente_id`, `meu_cliente_id()`
  e 5 policies cliente SELECT/INSERT operacionais. Sem UPDATE/DELETE
  cliente. Sem token público. `pedido_eventos` admin-only.
- **Schema Tracking Visual** `db/15_status_cliente_visual.sql`
  **aplicado e validado em staging** `ucrjtfswnfdlxwtmxnoo` em
  `2026-06-26`, sem tocar o projeto original/producao
  `bhgifjrfagkzubpyqpew`. Adiciona em `public.pedidos`:
  `status_cliente_visual`, `status_cliente_excecao`,
  `status_cliente_mensagem`, `status_cliente_atualizado_em`,
  `referencia_cliente`, `prazo_desejado`, `tipo_recebimento`; cria a
  tabela `public.pedido_cliente_eventos`; aplica RLS admin-only nessa
  tabela via policy `pedido_cliente_eventos_admin_all`; cria trigger
  guard de INSERT para zerar campos visuais quando o autor nao for
  admin; e cria trigger de touch para
  `status_cliente_atualizado_em` em UPDATE visual. Validacoes
  estruturais concluidas: 7 colunas em `pedidos`, 10 colunas em
  `pedido_cliente_eventos`, 4 constraints esperadas, 2 triggers,
  2 funcoes, 1 indice `(pedido_id, criado_em DESC)` e
  `pedido_cliente_eventos = 0`. Validado tambem por
  `tests/cliente-tracking-schema.smoke.js`. **Sem frontend.**
  **Sem dropdown admin.** **Sem policy cliente na nova tabela.**
- **Policy Cliente Eventos** `db/16_pedido_cliente_eventos_cliente_select.sql`
  **aplicada e validada em staging** `ucrjtfswnfdlxwtmxnoo` em
  `2026-06-27` (fase EVENTS-RLS-B), aplicada manualmente por HMNlead no
  Dashboard SQL Editor, exatamente como versionado, sem tocar
  `bhgifjrfagkzubpyqpew`. Cria de forma idempotente a policy
  `pedido_cliente_eventos_cliente_select` em
  `public.pedido_cliente_eventos`, limitada a `FOR SELECT`, exigindo
  `visivel_cliente = true` e ownership via `public.pedidos`
  (`p.id = pedido_cliente_eventos.pedido_id` e
  `p.cliente_id = public.meu_cliente_id()`). Preserva
  `pedido_cliente_eventos_admin_all`, nao cria INSERT/UPDATE/DELETE de
  cliente, nao altera frontend e nao libera timeline ainda. Validacao
  pos-aplicacao: 2 policies na tabela (`admin_all` cmd `ALL`,
  `cliente_select` cmd `SELECT`); `qual` da policy cliente confirma
  `visivel_cliente = true` + `EXISTS` + `pedidos` + `meu_cliente_id()`;
  RLS habilitada (`relrowsecurity = true`); 10 colunas preservadas;
  `count(*) = 0`. Validado por `tests/cliente-events-rls-schema.smoke.js`
  (13/13).
- **Timeline cliente de eventos** (fase
  `RAVATEX-TAPETES-PEDIDOS-CLIENTE-TRACKING-CLIENTE-EVENTS-A`, esta):
  `js/screens/cliente-pedido-detail.js` consulta
  `public.pedido_cliente_eventos` com SELECT explicito
  (`id, pedido_id, status, titulo, mensagem, criado_em`), filtro
  `.eq('pedido_id', pedidoId)` e `.order('criado_em', { ascending:
  false })`, usando a policy `pedido_cliente_eventos_cliente_select`.
  Renderiza secao "Atualizacoes do pedido" apos os itens (card branco
  no padrao visual existente). Empty state: "Assim que houver novas
  atualizacoes, elas aparecerao aqui." Erro de leitura isolado em
  `state.eventosError`, sem afetar `loadingError` nem o resto do
  detalhe. **Sem** `metadata`/`criado_por`/`origem` no SELECT, sem
  `select('*')`, sem `pedido_eventos`, sem writes/rpc/
  `functions.invoke`/`service_role`/`token_acesso`. **Sem** schema/SQL
  nesta fase. Admin continua o unico publicador (via
  `pedido-tracking-admin.js`, fase anterior). Fornecedor nao participa.
  Testes: `tests/cliente-pedido-events.smoke.js` novo (19/19);
  `tests/cliente-pedido-detail.smoke.js` atualizado (46/46).
- **Homologação manual E2E aprovada** (fase
  `RAVATEX-TAPETES-PEDIDOS-CLIENTE-TRACKING-E2E-HOMOLOG-RECORD-A`,
  esta, docs-only). HMNlead validou manualmente em staging
  `ucrjtfswnfdlxwtmxnoo`, no HEAD `fc7843c`, sem tocar
  `bhgifjrfagkzubpyqpew`: admin publicou `status_cliente_visual =
  acabamento` com mensagem personalizada via
  `pedido-tracking-admin.js`; `pedidos.status_cliente_*` foram
  gravados; `pedido_cliente_eventos` recebeu o evento correspondente
  (`origem = manual`, `visivel_cliente = true`); cliente visualizou o
  stepper na etapa "Acabamento" com mensagem e data de atualização; a
  seção "Atualizações do pedido" exibiu o evento. Excecao visual
  (`status_cliente_excecao = aguardando_insumo`) tambem foi testada e
  exibida corretamente, sem quebrar o stepper, com novo evento na
  timeline. `metadata`, `criado_por` e `origem` nao apareceram ao
  cliente; nenhum dado de OP/lote/fornecedor/NF/romaneio/custo/margem
  foi exposto. **Cancelado nao foi testado** (pedido usado nao era
  seguro para esse teste). **Decisão: fluxo aprovado** para avançar ao
  Dashboard Cliente read-only ou refinamento visual do portal cliente.
  **Sem** alteração de código/schema/SQL/Supabase/frontend nesta fase.
- **Provisionamento cliente** (fase PROV-A): `admin-create-user`
  aceita `cliente` (valida `cliente_id` em `public.clientes`, rejeita
  `fornecedor_id` simultâneo). UI `#/cadastros/usuarios` com tipo
  Cliente + select de cliente. `loadCurrentUser()` carrega
  `cliente_id` e `cliente_nome`. `isCliente()` disponível.
  **Correção 2026-06-27 (HOMOLOG-RECORD-A):** já **existe um cliente
  de teste funcional em staging** (`cliente@teste.com`, `cliente_id=3`,
  nome "Teste"), com login validado e dashboard homologado.
  **CONFIRMADO 2026-06-27 (PROVISIONING-STAGING-VERIFY-A):** o **deploy
  da versão de `admin-create-user` que aceita `tipo=cliente` está ATIVO
  em staging** `ucrjtfswnfdlxwtmxnoo`. Verificado por probe não
  destrutivo: admin (`admin@tapetes.test`) invocou
  `functions.invoke('admin-create-user', { body: { tipo: 'cliente',
  cliente_id: 999999, ... } })` e recebeu HTTP 400 `VALIDATION_ERROR
  "cliente_id não existe em public.clientes."` — mensagem exclusiva do
  ramo `cliente` da função; a versão antiga teria barrado antes no gate
  de `tipo`. **Nenhum usuário real foi criado** (a validação de
  `cliente_id` ocorre antes de `createUser`). Senha/token **não
  registrados**; produção `bhgifjrfagkzubpyqpew` **não tocada**. A
  lacuna "provisionamento self-service via Edge Function em staging =
  a confirmar" está **resolvida**.
- **Frontend Pedidos cliente entregue (UI-A + CREATE-A):**
  shell mínimo (`js/screens/cliente-common.js` com `CLIENTE_MENU`:
  "Meus pedidos" apenas), listagem read-only com botão
  "+ Novo pedido" (`js/screens/cliente-pedidos-list.js`,
  `#/cliente/pedidos`, `screenClientePedidosLista`, confia na
  RLS), detalhe sanitizado (`js/screens/cliente-pedido-detail.js`,
  `#/cliente/pedidos/<uuid>`, `screenClientePedidoDetalhe`,
  sem editar/cancelar, sem expor OP/lote/fornecedor/
  token/eventos), formulário de criação
  (`js/screens/cliente-pedido-form.js`,
  `#/cliente/pedidos/novo`, `screenClientePedidoNovo`,
  `cliente_id` de `CURRENT_USER.cliente_id`, status inicial
  `recebido`, sem select de cliente, sem editar/cancelar,
  sem expor OP/lote/fornecedor/token/eventos). Roteamento:
  `routeAfterLogin` direciona cliente para `#/cliente/pedidos`,
  `matchRoute` resolve `#/cliente/pedidos/<uuid>` com
  `roles: ['cliente']`, `boot.js` registra `#/cliente/pedidos`
  e `#/cliente/pedidos/novo`. **Sem** editar/cancelar pedido.
  **Sem** schema, SQL, Edge Function, service_role,
  functions.invoke.
- **Admin Pedidos completo (C1-C3C3):** listagem, formulário,
  detalhe, ações de status, edição de dados gerais e itens.
- **Governança obrigatória antes da próxima implementação:**
  `docs/architecture/PORTAL_B2B_ARCHITECTURE_RULES.md` fixa os
  limites da frente Portal B2B/Pedidos. **Não iniciar**
  `RAVATEX-TAPETES-PEDIDOS-CLIENTE-TRACKING-SCHEMA-A` sem
  respeitar esse documento. Em especial: separar cliente,
  admin e fornecedor; separar status operacional de
  `status_cliente_visual`; não colar HTML standalone no app;
  reaproveitar componentes comuns; manter SPA estático + JS
  clássico + `window.*`; quebrar próximas entregas em fases
  pequenas (schema, staging SQL, admin UI, cliente UI,
  dashboard, redesign shell, fornecedor, automação).
- **Sketch de acompanhamento visual no detalhe cliente
  (fase TRACKING-UI-A, esta):** novo módulo
  `js/screens/cliente-pedido-tracking.js`
  (`buildClientePedidoTrackingCard(pedido)`) — componente puro
  de apresentação (sem Supabase, sem writes), com stepper de 6
  etapas (Recebido/Confirmado/Em produção/Em acabamento/Pronto
  para entrega/Entregue) + banner de situação atual.
  `cliente-pedido-detail.js` chama o componente no topo do
  detalhe via `buildTracking()`. Etapa é DERIVADA de
  `pedido.status` (`statusParaEtapaCliente`): `rascunho`/
  `recebido` → "Recebido", `confirmado` → "Confirmado", demais
  status (`produzindo`, `entregue`) ficam neutros (sem etapa
  marcada) por não terem transição alcançável nesta fase nem
  correspondência 1:1 com um único nó do stepper. `cancelado`
  substitui o stepper por um aviso calmo. **Sem** campo
  `status_cliente_visual` real ainda no frontend, **sem** tabela de
  eventos visivel ainda, **sem** dropdown admin, **sem**
  schema/SQL/Edge Function na fase TRACKING-UI-A, **sem**
  dados internos sensíveis. Script carregado em `index.html`
  entre `cliente-pedidos-list.js` e `cliente-pedido-detail.js`.
- **Taxonomia compartilhada de tracking visual** (fase
  `RAVATEX-TAPETES-PEDIDOS-CLIENTE-TRACKING-STEPS-A`, esta):
  novo modulo `js/pedido-tracking-ui.js`, carregado em `index.html`
  logo apos `js/pedido-ui.js`. Exposicoes:
  `window.RavatexPedidoTracking` e
  `window.RAVATEX_PEDIDO_UI.CLIENTE_TRACKING`. Conteudo:
  8 etapas principais (`recebido`, `confirmado`, `insumos`,
  `tecelagem`, `acabamento`, `expedicao`, `transporte`,
  `concluido`), 4 excecoes (`aguardando_definicao`,
  `aguardando_insumo`, `pausado`, `cancelado`) e helpers puros
  `getClienteTrackingStep`, `getClienteTrackingException`,
  `getClienteTrackingStatusLabel`, `getClienteTrackingMensagem`,
  `getClienteTrackingProgress`. Regras fixadas: excecao prioriza
  label/mensagem; `status_cliente_mensagem` sobrescreve a frase
  padrao; `cancelado` e terminal fora da etapa principal;
  `insumos` e `transporte` sao pulaveis; fallback para
  `status_cliente_visual` nulo/desconhecido = `recebido`.
  **Importante:** a camada foi criada sem acoplar admin/cliente/
  fornecedor, sem writes, sem Supabase, e sem substituir ainda o
  tracking funcional atual do cliente.
- **Tracking visual do cliente agora lendo o status real**
  (fase `RAVATEX-TAPETES-PEDIDOS-CLIENTE-TRACKING-CLIENTE-A`, esta):
  `js/screens/cliente-pedido-detail.js` passou a selecionar
  `status_cliente_visual`, `status_cliente_excecao`,
  `status_cliente_mensagem` e `status_cliente_atualizado_em` em
  `pedidos`, mantendo SELECT explicito e sanitizado. O modulo
  `js/screens/cliente-pedido-tracking.js`
  (`buildClientePedidoTrackingCard(pedido)`) continua sendo puro
  (sem Supabase, sem writes), mas deixou de usar o stepper local
  antigo de 6 etapas. Agora usa a taxonomia compartilhada de
  `js/pedido-tracking-ui.js`, com 8 etapas principais, 4 excecoes,
  prioridade para `status_cliente_excecao`, depois
  `status_cliente_visual`, depois fallback seguro para `recebido`
  quando ainda nao houver status visual publicado. `cancelado`
  virou excecao terminal com aviso calmo, sem renderizar o progresso
  comum. Mensagem personalizada publicada pelo admin sobrescreve a
  frase padrao. `status_cliente_atualizado_em` aparece no card quando
  existir. **O cliente ainda nao le `pedido_cliente_eventos`.**
  **Nao ha timeline/historico nesta fase.** **Dashboard cliente ainda
  nao existe.** **Status operacional continua separado do status
  visual.**
- **Controle admin de publish do tracking visual** (fase
  `RAVATEX-TAPETES-PEDIDOS-CLIENTE-TRACKING-ADMIN-A`, esta):
  novo modulo `js/screens/pedido-tracking-admin.js`, carregado em
  `index.html` antes de `js/screens/pedido-detail.js`. Exposicoes:
  `window.buildPedidoTrackingAdminCard` e
  `window.RAVATEX_SCREENS.pedidoTrackingAdmin`.
  `pedido-detail.js` agora integra o card "Situacao visivel ao
  cliente" no detalhe admin, sem mexer no controle de
  `pedidos.status` operacional. O card aparece apenas para
  `CURRENT_USER.tipo === 'admin'`, usa a taxonomia compartilhada
  (`CLIENTE_TRACKING_STEPS` e `CLIENTE_TRACKING_EXCECOES`), permite
  selecionar `status_cliente_visual`, selecionar/limpar
  `status_cliente_excecao`, editar `status_cliente_mensagem`, ver
  preview read-only e salvar. Writes: `update` em `public.pedidos`
  para `status_cliente_visual`, `status_cliente_excecao` e
  `status_cliente_mensagem`; depois `insert` em
  `public.pedido_cliente_eventos` com `pedido_id`, `status`,
  `titulo`, `mensagem`, `origem = 'manual'`, `visivel_cliente = true`,
  `criado_por = CURRENT_USER.id` e `metadata = null`. Regras de erro:
  falha em `pedidos` aborta o historico; falha no historico apos o
  update fica explicita ao admin. **O cliente ainda nao le
  `pedido_cliente_eventos`.** **Status operacional continua separado.**
  **Fornecedor nao participa.**

## Estado operacional atual
- `index.html` está declarativo, sem script inline final, com
  cache-busting `?v=20260623-asset1` em 26 assets locais
  (23 originais + `js/screens/pedido-detail.js` adicionado em C3A).
- `js/boot.js` é o entrypoint oficial; respeita DOM ready
  (`startApp` aguarda `DOMContentLoaded` se
  `document.readyState === 'loading'`).
- `js/router.js` é engine genérica e não foi alterado no ciclo.
- `js/ui.js` faz lookup lazy do root `#app` via `getAppRoot()` —
  `replaceChildren null` foi eliminado após cache limpo.
- `js/screens/op-pdf.js` foi extraído de `op-nova.js` em
  `7f3c6da` (`RAVATEX-TAPETES-OP-NOVA-PDF-MODULE-A`).
- `run-local.bat` é o tooling local para servir o app em
  `http://localhost:8765/`.

## Decisão arquitetural vigente
**REFATORAÇÃO ARQUITETURAL CONGELADA.**

Próxima fase esperada é **homologação / release**, **não** nova
extração em `op-nova.js`. Em particular, **NÃO iniciar** novas fases
como `RAVATEX-TAPETES-OP-BLOCO-FIOS-DIAG-A`,
`RAVATEX-TAPETES-OP-PROPOSTA-DIAG-A` ou
`RAVATEX-TAPETES-TRANSACTION-RISK-DIAG-A` sem nova instrução
explícita do dono do projeto: o refactor está fechado e essas
sugestões são **opcionais** (vide `docs/refactor/ARCHITECTURE_REFACTOR_LEDGER.md`
seção 9).

## Comandos de verificação (rodar antes de qualquer patch)

```bash
cd "D:\OneDrive\Programação\Ravatex\controle-tapetes"

git status --short
git branch --show-current
git rev-parse --short HEAD
git remote -v
git ls-remote --heads staging main
git ls-remote --heads origin main
```

Abortar e revisar o escopo se:
- branch != `work/app-next`;
- HEAD não estiver no commit `247b8ca` ou commit posterior
  da fase `RAVATEX-TAPETES-PEDIDOS-CLIENTE-SCHEMA-RLS-B1`
  (commit "Add cliente perfil schema and RLS" no topo);
- working tree não estiver limpo;
- `staging/main` não tiver sido atualizado para o commit
  desta fase (antes do push era `247b8ca`);
- `origin/main` != `1047181eba888242c6428de366cbd9fda2f1c72c`
  (qualquer mudança em `origin/main` é regressão grave).

## Regras (NÃO renegocia)

1. **Push autorizado somente para `staging`**, salvo ordem explícita
   futura. Nunca `git push origin` em `work/app-next:main`.
2. **Não tocar `origin/main` oficial.**
3. **Não tocar PR #2.**
4. **Não acessar Supabase real** em refactors/testes mockados. Toda
   validação de chain de Supabase usa `fakeSupa` em `vm.Context`.
5. **Não registrar** em relatório ou doc: `service_role`, senha,
   `JWT secret`, connection string com senha, anon key completa.
6. **Testes focados** por fase (`node --test <arquivo>.smoke.js`).
   Não rodar suíte completa por padrão.
7. **Fase schema-only atual**: só `db/15_status_cliente_visual.sql`,
   `tests/cliente-tracking-schema.smoke.js`, `PROJECT_STATE.md`,
   `AGENT_HANDOFF.md` e `docs/DOCUMENTATION_INDEX.md` podem ser
   criados/alterados. Qualquer diff fora desses 5 arquivos reprova.
8. **Não mexer** em `aplicarRecalculoOP` ou `persistirOP` sem
   nova fase explícita.
9. **Não fazer docs + código na mesma fase.**
10. **Não iniciar nova extração em `op-nova.js`** (refactor
    congelado). Próxima ação é homologação/release, não refactor.

## Módulos principais e responsabilidades

### `boot.js` (RAVATEX-TAPETES-ROUTES-BOOT-MODULE-A + 87d4559)
- Registra rotas via `window.RAVATEX_ROUTER.setRoutes` (15 rotas).
- Executa `main()` via `startApp()` (que aguarda `DOMContentLoaded`
  se `document.readyState === 'loading'`).
- Registra `hashchange` listener.
- Carrega usuário atual via `window.loadCurrentUser`.
- Direciona para `navigate('#/login')`, `handleRoute()` ou
  `routeAfterLogin()`.
- Captura erro de boot via `main().catch()` + `toast('Erro ao iniciar o app', 'error')`.

### `op-nova.js` (RAVATEX-TAPETES-SCREENNOVAOP-MODULE-A)
- `screenNovaOP` (closure inteira com `~20` subfunções aninhadas).
- UI/estado da Nova OP.
- Proposta, blocos de fios, tecelagem, wrappers de
  persistência/recálculo.
- Call-site de PDF: `window.gerarPdfCompraFios({ op, ordens })`.
- **NÃO** contém mais a função `gerarPdfCompraFios` (extraída em
  `7f3c6da`).
- Mantém read-only em Supabase (apenas `.select()`).
- Writes delegados: `window.persistirOP`, `window.aplicarRecalculoOP`,
  `window.registrarRecebimentoOrdemFio`,
  `window.atribuirFornecedorFioOp`, `window.renderOPLatexAdmin`.

### `op-pdf.js` (RAVATEX-TAPETES-OP-NOVA-PDF-MODULE-A)
- `gerarPdfCompraFios({ op, ordens })` — helper puro, sem closure.
- Usa `window.jspdf.jsPDF` (CDN) e `window.agruparOrdensCompraFio`
  (de `calculo-op.js`).
- Fallback `toast` quando jsPDF ausente.
- Exports: `window.gerarPdfCompraFios` e
  `window.RAVATEX_SCREENS.opPdf.gerarPdfCompraFios`.
- Não toca Supabase, não muta DOM.

### `op-persistir.js` (RAVATEX-TAPETES-OP-PERSISTIR-MODULE-A)
- Helpers puros de persistência: `itensValidosOP`,
  `montarPayloadItensOP`, `montarPayloadFornecedoresOP`,
  `montarPayloadOP`, `montarPayloadLote`.
- Write helper: `persistirOP` — executa 8 writes da persistência
  (ops, lotes, op_itens, op_fornecedores, ordens_compra_fio).
  Retorna envelope `{ error, step, partial, opId }`.

### `op-recalculo.js` (RAVATEX-TAPETES-OP-RECALCULO-MODULE-A)
- Helpers puros: `maxMetrosItem`, `normalizarChaveSaldo`.
- Write helper: `aplicarRecalculoOP` — executa 4 writes do recálculo
  (`op_itens.update`, `saldo_fios_op.insert`, `saldo_fios`
  select/update/insert, `ops.update status='em_producao'`).
  Retorna envelope `{ error, step, partial }`.

### `ui.js` (87d4559 + e0dbfcd)
- `el`, `toast`, `pageHeader`, `textInput`, `selectInput`,
  `formField`, `dataTable`, `modal`, `confirmDialog`, `shellLayout`,
  `ADMIN_MENU`.
- `getAppRoot()` — lookup lazy do root `#app`.

## Próxima recomendação operacional

**Governança Portal B2B/Pedidos registrada (fase GOV-A, esta).**
Antes de retomar o schema de tracking do cliente, o projeto agora tem
um documento curto e vinculante de limites arquiteturais em
`docs/architecture/PORTAL_B2B_ARCHITECTURE_RULES.md`.

**Schema visual do cliente ja aplicado em staging (fase atual).**
`db/15_status_cliente_visual.sql` ja criou a base futura do tracking
visual sem reaproveitar `pedido_eventos` e sem depender de
`pedidos.status` como fonte definitiva da comunicacao externa.

**Camada compartilhada da taxonomia visual ja criada.**
`js/pedido-tracking-ui.js` centraliza etapas, excecoes e helpers
puros para admin/cliente/dashboard futuros, sem integrar ainda as
telas ao `status_cliente_visual` real.

**Aplicado:** `db/16_pedido_cliente_eventos_cliente_select.sql` ja foi
aplicado e validado no Supabase staging `ucrjtfswnfdlxwtmxnoo`
(fase EVENTS-RLS-B).

**Atualizacao:** o detalhe cliente ja passou a ler
`status_cliente_visual` real nesta fase.

**Entregue (fase TRACKING-CLIENTE-EVENTS-A):** o cliente ja le
`pedido_cliente_eventos` em uma timeline read-only no detalhe do
proprio pedido. Admin continua o unico publicador de eventos.
Fornecedor, dashboard cliente e automacao continuam fora do escopo.

**Homologado (fase E2E-HOMOLOG-RECORD-A, esta):** o fluxo completo
admin → cliente (status visual + excecao + timeline) foi validado
manualmente em staging `ucrjtfswnfdlxwtmxnoo`, no HEAD `fc7843c`, e
**aprovado** pelo dono do projeto. Cancelado nao foi testado (fica
para fase futura com pedido de teste dedicado, se necessario).

**Proxima fase recomendada:** Dashboard Cliente read-only ou
refinamento visual do portal cliente, conforme decisao do dono do
projeto.

**Sequencia recomendada depois desta fase:** dashboard cliente;
redesign de shell/componentes comuns; e so depois fornecedor/automacao.

**Homologado (fase `RAVATEX-TAPETES-CLIENTE-PORTAL-VISUAL-HOMOLOG-RECORD-A`,
esta):** a homologação visual manual do portal cliente B2B (Dashboard,
Meus pedidos, Detalhe, Stepper/Acompanhamento, Timeline), pós
refinamento visual da fase POLISH-A, foi validada e **aprovada** pelo
dono do projeto, no HEAD `3b0f8e4`, em ambiente conectado ao Supabase
staging `ucrjtfswnfdlxwtmxnoo`, sem tocar `bhgifjrfagkzubpyqpew`.

**Proxima fase recomendada (atualizada):** decidir, com o dono do
projeto, entre preparação para produção/staging closeout do portal
cliente ou avanço para o próximo bloco funcional.

**Não iniciar execução sem autorização explícita.**
**NÃO tocar `bhgifjrfagkzubpyqpew`, Vercel original, ou `origin/main`.**

## Fases de implementação do design Auth (aprovadas para execução)

Design concluído em `docs/architecture/AUTH_PROVISIONING_EDGE_DESIGN.md`.
Fases, em ordem:

1. **`RAVATEX-TAPETES-AUTH-EDGE-FUNCTION-A`** — criar/implementar a
   Edge Function `admin-create-user` (sem UI ainda). **Concluída
   localmente (sem deploy).**
2. **`RAVATEX-TAPETES-AUTH-EDGE-STAGING-DEPLOY-A`** — deploy controlado
   em staging e validação de permissões. **Concluída em staging.**
3. **`RAVATEX-TAPETES-AUTH-ADMIN-UI-A`** — adaptar
   `screenCadastrosUsuarios` para chamar a Edge Function. **Concluída.**
4. **`RAVATEX-TAPETES-AUTH-PROVISIONING-DOCS-A`** — documentar operação
   final (runbook). **Concluída.**
5. **`RAVATEX-TAPETES-AUTH-DELETE-USER-DESIGN-A`** — decidir
   exclusão/desativação de usuários pelo app. **Concluída.**
   Recomendação: desativar (soft delete + ban Auth), não deletar.
   Design em `docs/architecture/AUTH_DELETE_USER_DESIGN.md`.
6. **`RAVATEX-TAPETES-AUTH-DELETE-UI-GUARD-A`** — contenção
   imediata: remover `.from('usuarios').delete()` do front-end e
   substituir botão "Excluir vínculo" por placeholder "Em breve".
   **Concluída.** Nenhum write Supabase exposto; nenhum `auth.admin`
   no front; smoke tests 48/48 verdes.
7. **`RAVATEX-TAPETES-AUTH-DISABLE-USER-SCHEMA-A`** — schema
   versionado para desativação (colunas + recriação de funções e
   policies RLS em `public.usuarios`). **Concluída.** Migration em
   `db/12_auth_user_disable_schema.sql`; testes 20/20 em
   `tests/auth-disable-user-schema.smoke.js`. **Aplicada em staging**
   (ver item 8b).
8. **`RAVATEX-TAPETES-AUTH-DISABLE-USER-SCHEMA-APPLY-A`** — aplicar
   a migration em staging. **Concluída como docs-only (commit
   `8fa924a`).** Orientação e validação local para aplicação em
   staging; smoke 20/20 e regressões 65/65 verdes; SQL limpo
   (sem DELETE/DROP/TRUNCATE/secrets). A execução real do SQL
   ficou pendente de HMNlead e foi registrada na fase 8b.
8b. **`RAVATEX-TAPETES-AUTH-DISABLE-USER-SCHEMA-APPLY-EVIDENCE-A`**
    *(esta fase, docs-only)* — registro da **aplicação real** de
    `db/12_auth_user_disable_schema.sql` no Supabase **staging**
    `ucrjtfswnfdlxwtmxnoo`, feita manualmente pelo HMNlead no
    SQL Editor do Dashboard. Evidências: 4 colunas novas em
    `public.usuarios`; funções `is_admin`/`meu_fornecedor_id`
    recriadas com checagem de `ativo`; policies
    `usuarios_select`/`usuarios_admin_all`/`usuarios_self_update`
    recriadas; contagem `ativo = true, total = 3`,
    `auth_users_total = 3`, `public_usuarios_total = 3`,
    `auth_sem_perfil = 0`, `perfil_sem_auth = 0`. Nenhum usuário
    foi criado, excluído ou desativado. `db/10_reset_producao.sql`
    e `db/11_reset_ops.sql` não foram rodados. Produção
    `bhgifjrfagkzubpyqpew` não foi tocada. App validado
    manualmente em staging: login OK, `#/cadastros/usuarios`
    carrega, `+ Novo usuário` visível, exclusão insegura segue
    bloqueada como `Em breve`, sem erros críticos de Auth/RLS
    no console. Warnings não bloqueantes: Tailwind CDN,
    `favicon.ico` 404.
9. **`RAVATEX-TAPETES-AUTH-DISABLE-USER-EDGE-A`** — Edge Function
   `admin-disable-user` (soft delete no perfil + ban Auth).
   **Concluída localmente (sem deploy).** Implementação em
   `supabase/functions/admin-disable-user/index.ts` (mesmos
   `_shared/cors.ts` e `_shared/response.ts` de `admin-create-user`).
   Validações: JWT no header `Authorization` + `tipo = 'admin' AND
   ativo IS TRUE` em `public.usuarios` server-side; UUID regex
   para `user_id`; `reason` ≤ 500 chars (trim, opcional);
   `SELF_DISABLE_FORBIDDEN` quando `target_id === caller_id`;
   `LAST_ADMIN_FORBIDDEN` quando alvo é o único admin ativo;
   idempotência (`already_disabled: true`) se alvo já está inativo;
   soft delete via `.update({ ativo: false, desativado_em, desativado_por,
   motivo_desativacao })`; ban Auth via
   `auth.admin.updateUserById(target_id, { ban_duration: '876000h' })`;
   compensação (reverte `ativo = true` e limpa campos) se ban
   falhar; `COMPENSATION_FAILED` se a reversão também falhar.
   **Sem `auth.admin.deleteUser` e sem `.delete()`** — apenas soft
   delete. Smoke `tests/admin-disable-user.smoke.js` 39/39 verde.
   Regressões preservadas: `admin-create-user` 17/17,
   `auth-disable-user-schema` 20/20, `cadastros-usuarios-auth-ui`
   16/16, `cadastros-screens` 32/32. **Sem deploy nesta fase.**
   Deploy e validação E2E em staging:
   `RAVATEX-TAPETES-AUTH-DISABLE-USER-EDGE-STAGING-DEPLOY-A`
   (próxima fase).
10. **`RAVATEX-TAPETES-AUTH-DISABLE-USER-EDGE-STAGING-DEPLOY-A`**
    *(próxima — separada da fase atual)* — deploy controlado de
    `admin-disable-user` em staging e validação manual. A fase
    E2E-AUTO-RUNNER-A abaixo já cria o runner que automatiza a
    validação E2E.
 11. **`RAVATEX-TAPETES-AUTH-DISABLE-USER-E2E-AUTO-RUNNER-A`**
     *(em andamento, fase atual, repo-only)* — runner local
     automatizado em `scripts/staging/admin-disable-user-e2e.mjs`
     com comandos `setup` (coleta admin_email/admin_password uma
     única vez; detecta staging de `js/config.js`; salva em
     `.ravatex-local/admin-disable-user-e2e.config.json`,
     gitignored) e `run` (carrega config; aborta se URL não for
     `ucrjtfswnfdlxwtmxnoo` ou se for `bhgifjrfagkzubpyqpew`;
     login admin; valida `tipo=admin AND ativo=true`; resolve
     `fornecedor_id` config/autodetect; cria fornecedor descartável
     via `admin-create-user`; tenta desativar admin como fornecedor
     esperando `FORBIDDEN`; revalida admin; desativa descartável
     esperando `auth_banned=true`; valida `desativado_em`/
     `desativado_por`/`motivo_desativacao`; tenta login do
     desativado esperando falha; re-desativa esperando
     `already_disabled=true`; tenta self-disable esperando
     `SELF_DISABLE_FORBIDDEN`; imprime resumo sanitizado).
     Smoke estático
     `tests/admin-disable-user-e2e-runner.smoke.js` 32/32 verde
     (após `E2E-RUNNER-FIX-A`).
     `.gitignore` agora ignora `.ravatex-local/`. **E2E real
     não foi rerodado após o fix** — fica para a próxima
     (`RAVATEX-TAPETES-AUTH-DISABLE-USER-E2E-A` ou similar).
 11b. **`RAVATEX-TAPETES-AUTH-DISABLE-USER-E2E-RUNNER-FIX-A`**
     *(esta fase, repo-only)* — correção do bug do runner no
     passo `login_blocked`. Execução real do runner em staging
     avançou até `profile_inactive` e falhou com
     `HTTP 400 User is banned` tratado como erro fatal, porque
     `supabaseLogin` chamava `die()`/`process.exit` em qualquer
     HTTP 4xx e usava mensagem hardcoded "Login admin falhou"
     (rótulo incorreto para o usuário descartável desativado).
     Correção: helpers separados `loginExpectSuccess(...)` (fatal,
     rótulo parametrizado: `admin_login failed`,
     `test_user_login failed`, `admin_relogin failed`) e
     `loginExpectFailure(...)` (não-fatal; aceita HTTP 4xx com
     `User is banned`/`banned`/`Banned user`/`User is already
     registered` como falha esperada; retorna
     `{ ok, unexpected, status, detail }` para o caller decidir).
     Camada HTTP crua em `postSupabaseLogin(...)` (sem `die()`).
     Passo `login_blocked` agora imprime `login_blocked: OK` e
     continua para `idempotency` e `self_disable_blocked`. Smoke
     estático
     `tests/admin-disable-user-e2e-runner.smoke.js` 32/32 verde
     (4 testes novos: login bloqueado esperado, fluxo continua,
     loginExpectSuccess nos 3 logins, loginExpectFailure com
     substrings banned, loginExpectFailure retorna controle).
     Regressão `admin-disable-user.smoke.js` 39/39. **E2E real
     não foi rerodado nesta fase** — só após autorização do
     HMNlead. **Sem deploy, sem Supabase real, sem SQL, sem
     alteração de UI, sem produção, sem origin/main, sem PR
     #2.**
 11c. **`RAVATEX-TAPETES-AUTH-DISABLE-USER-UI-A`** *(esta
     fase, repo-only)* — integração da tela
     `#/cadastros/usuarios` com a Edge Function
     `admin-disable-user` (já deployada em staging
     `ucrjtfswnfdlxwtmxnoo`). Botão `Desativar` substitui o
     placeholder `Em breve`; chama
     `window.supa.functions.invoke('admin-disable-user', {
     body: { user_id: usr.id, reason } })`; modal de
     confirmação com campo de motivo opcional (≤ 500 chars,
     default `"Desativação via UI"`); mapeia 8 códigos de erro
     (`FORBIDDEN`/`SELF_DISABLE_FORBIDDEN`/
     `LAST_ADMIN_FORBIDDEN`/`NOT_FOUND`/`AUTH_BAN_FAILED`/
     `COMPENSATION_FAILED`/`VALIDATION_ERROR`/`UNAUTHORIZED`)
     para mensagens PT-BR; guarda de UX para o próprio usuário
     logado e para usuários já inativos (proteção visual, não
     substitui server-side); coluna `Status` na listagem
     (`Ativo`/`Inativo`). Helper top-level
     `friendlyDisableMessage(code, fallback)` no
     `js/screens/cadastros.js`. Preserva `+ Novo usuário` e a
     chamada `admin-create-user`. **Sem deploy, sem Supabase
     real, sem SQL, sem produção, sem origin/main, sem PR
     #2, sem E2E real nesta fase.** E2E real do runner já
     havia passado em `result: PASS` em staging ANTES desta
     fase (evidência sanitizada em LEDGER §5k). Smoke
     `tests/cadastros-usuarios-auth-ui.smoke.js` 23/23 verde
     (+7 testes novos para a fase UI-A: botão `Desativar`
     substitui `Em breve`, chamada `admin-disable-user` com
     payload `user_id`+`reason`, leitura de
     `error.context.json`, tratamento dos 8 códigos, guarda
     de UX para self e inativo, coluna Status, preservação
     de `+ Novo usuário` e `admin-create-user`); regressões
     focais `tests/cadastros-screens.smoke.js` 32/32,
     `tests/admin-disable-user.smoke.js` 39/39,
     `tests/admin-create-user.smoke.js` 17/17,
     `tests/admin-disable-user-e2e-runner.smoke.js` 32/32 —
     todas verdes.
12. **`RAVATEX-TAPETES-AUTH-DISABLE-USER-UI-A`** *(futura)* — restaurar
    botão "Desativar" na UI quando Edge Function estiver
    deployada e validada em staging.

## Possíveis fases futuras opcionais (NÃO obrigatórias)

Estas fases **não** fazem parte do fechamento do refactor e **não**
são bloqueadas pelo design Auth. São sugestões para trabalho futuro,
se houver benefício prático **e** autorização explícita do dono do
projeto:

- **`RAVATEX-TAPETES-OP-BLOCO-FIOS-DIAG-A`** — diagnosticar
  `buildBlocoFios` (montagem do bloco de recebimento de fios).
- **`RAVATEX-TAPETES-OP-PROPOSTA-DIAG-A`** — diagnosticar
  `buildProposta` / `recompute` / `onAceitar` (UI de proposta +
  interação com recálculo).
- **`RAVATEX-TAPETES-TRANSACTION-RISK-DIAG-A`** — avaliar uso de
  RPC/transações Supabase para `persistirOP` e `aplicarRecalculoOP`
  (risco de produto/dados, não de refactor).

> **Nota:** `RAVATEX-TAPETES-OP-PDF-MODULE-A` foi **executada** em
> `7f3c6da`; não está mais em backlog.

## Proibições operacionais

- **Não tocar `origin/main` nem PR #2 sem autorização explícita.**
- **Não mexer em `persistirOP` ou `aplicarRecalculoOP` sem fase
  específica** (risco transacional residual, documentado em
  `PROJECT_STATE.md` e no LEDGER).
- **Não fazer docs + código na mesma fase.**
- **Não tratar cortes opcionais como obrigatórios** (sugestões acima
  são apenas para futuro).
- **Não iniciar nova extração em `op-nova.js`** (refactor
  congelado em `7f3c6da`).
- **Não remover o cache-busting `?v=20260623-asset1`** de `index.html`
  (proteção contra navegador servindo JS antigo).
- **Não remover `getAppRoot()`** de `js/ui.js` (proteção contra
  `replaceChildren null` no boot).

## Resumo do refactor (24 módulos extraídos)

| # | Módulo | Commit | Fase |
|---|---|---|---|
| 1 | `js/config.js` | `5547e27` | CONFIG-MODULE-A |
| 2 | `js/supabase-client.js` | `6d50d08` | SUPABASE-CLIENT-MODULE-A |
| 3 | `js/environment-banner.js` | `1f3238d` | ENV-BANNER-MODULE-A |
| 4 | `js/auth.js` | `1b56571` | AUTH-MODULE-A |
| 5 | `js/router.js` | `6bb203f` | ROUTER-MODULE-A |
| 6 | `js/screens/system-screens.js` | `786f6b4` | SYSTEM-SCREENS-MODULE-A |
| 7 | `js/screens/common.js` | `ed8e75c` | SCREENS-COMMON-MODULE-A |
| 8 | `js/screens/cadastros.js` | `dd24365` | CADASTROS-SCREENS-MODULE-A |
| 9 | `js/screens/ops-list.js` | `d7a8d25` | OPS-LIST-SCREEN-MODULE-A |
| 10 | `js/screens/entrega-form.js` | `958f244` | ENTREGA-FORM-HELPER-MODULE-A |
| 11 | `js/screens/entrega-writes.js` | `7ec1721` (+ `e190022`, `70635aa`) | ENTREGA-WRITES-MODULE-A (+ LATEX, + CIMA) |
| 12 | `js/screens/fornecedor.js` | `4b9ca12` | FORNECEDOR-SCREENS-MODULE-A |
| 13 | `js/screens/op-form-helpers.js` | `c480324` | OP-FORM-HELPERS-MODULE-A |
| 14 | `js/screens/op-writes.js` | `ab79f1c` (+ `1429950`) | OP-ORDER-WRITE-MODULE-A (+ OP-FORNECEDOR-WRITE-MODULE-A) |
| 15 | `js/screens/op-latex-admin.js` | `69c0036` | OP-LATEX-ADMIN-SCREEN-MODULE-A |
| 16 | `js/screens/painel.js` | `065a796` | SCREENPAINEL-MODULE-A |
| 17 | `js/screens/op-recalculo.js` | `c599c21` (+ `4ce5080`) | OP-RECALCULO-HELPERS-MODULE-A (+ OP-RECALCULO-WRITES-MODULE-A) |
| 18 | `js/screens/op-persistir.js` | `8fd4dd2` (+ `cac20f9`) | OP-PERSISTIR-HELPERS-MODULE-A (+ OP-PERSISTIR-WRITES-MODULE-A) |
| 19 | `js/screens/op-nova.js` | `ce3dd14` | SCREENNOVAOP-MODULE-A |
| 20 | `js/boot.js` | `4c18fe7` | ROUTES-BOOT-MODULE-A |
| 21 | `js/screens/op-pdf.js` | `7f3c6da` | RAVATEX-TAPETES-OP-NOVA-PDF-MODULE-A |
| 22 | `js/screens/pedidos-list.js` | `bf960f8` | RAVATEX-TAPETES-PEDIDOS-UI-ADMIN-C1 |
| 23 | `js/screens/pedido-form.js` | `62a9f9a` (+ `2de595c`) | RAVATEX-TAPETES-PEDIDOS-UI-ADMIN-C2 (+ C2-R1) |
| 24 | `js/screens/pedido-detail.js` | `7184388` + `d2b5a6a` + (commit desta fase) | RAVATEX-TAPETES-PEDIDOS-UI-ADMIN-C3A (+ C3B: ações reais de status + C3C1: Editar funcional por status) |
| 25 | `js/screens/pedido-edit.js` | `2d36077` C3C1: edição admin dos dados gerais do Pedido |
| 26 | `js/screens/pedido-itens-edit.js` | `acc96c3` C3C2B: edição admin de itens existentes (update 3 chaves) + `fd1a9a3` C3C2C1: também ADICIONAR novos itens (insert 5 chaves, `isNew`, `Descartar novo item`) + `bd3aedc` C3C2C2: também REMOVER itens existentes (delete em `pedido_itens` com `.eq('id').eq('pedido_id')`, `markedForDeletion`, `window.confirmDialog`, "Desfazer remoção", mínimo 1) + (commit desta fase) C3C2C3: também NORMALIZAR `ordem` automaticamente no `salvar()` (loop `activeItems[i].ordem = i` por posição final; update com 4 chaves incluindo `ordem`; insert com `ordem: it.ordem`; sem drag/setas/reordenar) |

## Testes recentes (focados passando)
- `cliente-pedido-tracking.smoke.js` — novo (fase TRACKING-UI-A).
- `cliente-pedido-detail.smoke.js` — atualizado (fase TRACKING-UI-A).
- `cliente-perfil-schema.smoke.js` — 49/49
- `pedido-itens-edit.smoke.js` — 64/64
- `pedido-edit.smoke.js` — 35/35
- `pedido-detail.smoke.js` — 43/43
- `pedido-form.smoke.js` — 35/35
- `pedido-ui.test.js` — 18/18
- `pedidos-list.smoke.js` — 29/29
- `pedidos-schema.smoke.js` — 41/41
- `boot.smoke.js` — 28/28
- `router.smoke.js` — 41/41
- **Total Pedidos (C1+C2+C2-R1+C3A+C3B+C3C1+C3C2B+C3C2C1+C3C2C2+C3C2C3): 334/334** (todos os focados
  passam).

Focados do refactor (mantidos verdes):
- `op-pdf.smoke.js` — 20/20
- `op-nova.smoke.js` — 30/30
- `op-recalculo.smoke.js` — 59/59
- `op-persistir.smoke.js` — 65/65
- `op-writes.smoke.js` — 49/49
- `op-latex-admin.smoke.js` — 30/30
- `op-form-helpers.smoke.js` — 36/36
- `painel-screen.smoke.js` — 16/16
- `fornecedor-screens.smoke.js` — 35/35

Pré-existentes dependentes de `http.server :8765`: 6 falhas em
`tests/index-inline.smoke.js` e 17 em `tests/write-guard.smoke.js`
— não relacionadas ao refactor; exigem servidor local
(`.\run-local.bat` ou `python -m http.server 8765`).
Falhas pré-existentes em `tests/ops-list-screen.smoke.js` (10/30)
são de testes do refactor monolítico antigo, **fora do escopo**
da fase `RAVATEX-TAPETES-PEDIDOS-UI-ADMIN-C3A`.

## Comandos seguros por fase

```bash
# Após mudança em js/screens/<X>.js:
node --check js/screens/<X>.js
node --test tests/<X>.smoke.js

# Validação focada de regressão completa:
node --test tests/boot.smoke.js \
              tests/router.smoke.js \
              tests/op-nova.smoke.js \
              tests/op-pdf.smoke.js \
              tests/op-persistir.smoke.js \
              tests/op-recalculo.smoke.js \
              tests/op-writes.smoke.js \
              tests/op-form-helpers.smoke.js \
              tests/op-latex-admin.smoke.js \
              tests/painel-screen.smoke.js \
              tests/fornecedor-screens.smoke.js
```

## O que um agente NÃO deve fazer

- Editar `index.html`, `js/**`, `tests/**` em fase docs-only.
- Rodar `db/10_*`/`db/11_*` (resets destrutivos de produção).
- Fazer push em `origin/main`.
- Acessar Supabase real em testes/refactors.
- Registrar `service_role`, senha, `JWT secret`, connection string
  com senha ou anon key completa em qualquer doc/relatório.
- Mexer em `persistirOP` ou `aplicarRecalculoOP` sem nova fase
  explícita.
- Tentar mover `renderOPLatexAdmin` para outro módulo (já está
  isolada em `op-latex-admin.js`).
- Tentar mover `screenPainel` (já está isolada em `painel.js`).
- Tentar mover `gerarPdfCompraFios` (já está isolada em `op-pdf.js`).
- Rodar `git add .` (sempre stage seletivo por arquivo).
- Mexer no PR #2.
- Tratar fases opcionais (bloco fios, proposta, transaction risk)
  como obrigatórias.
- Iniciar nova extração em `op-nova.js` (refactor congelado).
- Remover cache-busting `?v=20260623-asset1` de `index.html`.
- Remover `getAppRoot()` de `js/ui.js`.
- Tratar `docs/superpowers/plans/*.md` como playbook executável
  (esses planos foram escritos para o monólito pré-refactor e
  instruem a modificar `index.html` diretamente; devem ser
  adaptados à arquitetura atual antes de qualquer uso).
- Tratar `docs/qa/*.md` como especificação técnica atual
  (checklists históricos; ver `docs/qa/README.md`).
## Registro documental de schema versionado

- **Estado atual aceito:** `work/app-next` na ponta da fase
  `RAVATEX-TAPETES-CLIENTE-PARCIAIS-SCHEMA-DOCS-R1` (docs-only,
  fechamento documental). A fase
  `RAVATEX-TAPETES-CLIENTE-PARCIAIS-SCHEMA-A-R1` fica aceita com
  **ressalva documental** por registrar, apos o fato, o commit
  publicado `0a02f6a — Add pedido parciais schema`.
- **Escopo publicado no commit `0a02f6a`:**
  `db/17_pedido_parciais_schema.sql` +
  `tests/pedido-parciais-schema.smoke.js`.
- **Validacao registrada:** smoke estatico `16/16`; SQL **nao
  aplicado** em Supabase; producao/original **intocados**; nenhum
  frontend/helper/read-model/lista entrou no commit.
- **Residuos locais preservados para fases futuras:** helper/read-model
  de parciais, lista cliente/status visual e seus testes dedicados
  permaneceram fora deste fechamento documental.
- **Proxima sequencia recomendada:**
  1. helper/read-model de parciais;
  2. lista cliente/status visual;
  3. apply controlado de `db/17_pedido_parciais_schema.sql` em
     staging, somente quando houver autorizacao explicita.

## Registro documental de helper de parciais

- **Estado atual aceito:** `work/app-next` na ponta da fase
  `RAVATEX-TAPETES-CLIENTE-PARCIAIS-HELPER-A` (helper/read-model puro,
  sem telas consumidoras). O arquivo `js/pedido-tracking-ui.js`
  recebeu somente helpers puros de acompanhamento parcial:
  catalogo `CLIENTE_PARCIAL_SITUACOES`, distribuicao por situacao,
  calculo percentual, DTO seguro de parciais e builder
  `buildPedidoAcompanhamentoParcial`.
- **Compatibilidade preservada:** `window.RavatexPedidoTracking`,
  `CLIENTE_TRACKING_STEPS`, `CLIENTE_TRACKING_EXCECOES` e helpers
  antigos de status visual permanecem disponiveis e com semantica
  preservada; nenhuma tela cliente/admin/fornecedor passou a consumir
  parciais nesta fase.
- **Validacao registrada:** `tests/pedido-acompanhamento-parcial.smoke.js`,
  `tests/cliente-tracking-steps.smoke.js` e
  `tests/cliente-pedido-tracking.smoke.js` passaram. Sem Supabase, sem
  query real, sem writes, sem apply do `db/17`.
- **Residuos fora de escopo preservados:** lista cliente/status visual
  e seus testes dedicados continuam para fase separada.
- **Proxima decisao recomendada:** ou fechar a fase de lista
  cliente/status visual, ou fazer apply controlado de
  `db/17_pedido_parciais_schema.sql` em staging quando houver
  autorizacao explicita.
