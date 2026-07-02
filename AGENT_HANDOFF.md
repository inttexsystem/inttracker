# Estado pos-fase - OP Em Producao Tecelagem Standalone B (ajuste fino visual)

- Fase concluida no codigo (continuacao/ajuste fino da mesma fase
  `RAVATEX-TAPETES-OP-EM-PRODUCAO-TECELAGEM-STANDALONE-B`, sem transformar
  nenhum placeholder em funcionalidade real).
- Escopo fechado:
  `js/screens/op-nova.js`, `tests/op-nova.smoke.js`,
  `tests/op-recalculo.smoke.js` (1 teste precisado — ver abaixo),
  `PROJECT_STATE.md`, `AGENT_HANDOFF.md`.
- O que foi ajustado nesta rodada (paridade estrutural mais fina com o
  standalone `Admin - PROD-OP-TECELAGEM- standalone.html`):
  breadcrumb "OPs / OP X/ANO" + botao Voltar;
  cadeia produtiva (lineage strip) para a OP de Acabamento/Latex gerada
  por entrega parcial (le dados ja carregados, sem write);
  nomenclatura alinhada ao standalone ("Entregue p/ acabamento" no
  resumo lateral, "Ja enviado" no bloco de Movimentacao);
  bloco novo `4. Capacidade e ajuste` (read-only, le `saldo_fios_op` —
  ja gravada por `aplicarRecalculoOP`/`op-recalculo.js`, nao alterado —
  cruzada com `ordens` para consumo/sobra real por fio; sem "fator
  proporcional" fabricado; fallback controlado sem dados);
  card "Entregas tecelagem" reposicionado apos o Bloco 4 e sem o
  numeral "4." no titulo (evita colisao — "4." passou a pertencer so
  ao Capacidade e ajuste);
  Documentos da OP com visual de lista (Romaneio/Nota fiscal de
  entrada/Nota fiscal de saida, pill neutro "Aguardando integracao"),
  continua placeholder controlado;
  Historico com visual de timeline (ponto + conector), mesma fonte de
  dados/fallback (`op_eventos`);
  tratamento visual de saldo negativo/excedente (entrega acima do
  ajustado) no Resumo lateral, bloco Movimentacao e nas colunas Falta
  dos Cards 2 e Entregas tecelagem — antes ficava escondido atras de
  "✅ completo".
- Ajuste de teste fora do escopo usual (justificado): `tests/op-recalculo.smoke.js`
  teste `12.` tinha uma regex que bloqueava qualquer
  `supa.from('saldo_fios_op')` em `op-nova.js`, mas seu proprio
  comentario ja dizia que a intencao era so bloquear writes (o write
  real fica em `op-recalculo.js`). A leitura read-only nova do Bloco 4
  precisou dessa precisao: a regra passou a bloquear especificamente
  insert/update/delete/upsert nessa tabela, preservando a garantia
  original sem impedir a leitura legitima.
- Testes: `node --check js/screens/op-nova.js` OK;
  `node --test tests/op-nova.smoke.js` OK (55/55);
  `node --test tests/op-nova.smoke.js tests/op-latex-admin.smoke.js
  tests/op-persistir.smoke.js tests/boot.smoke.js
  tests/pedido-detail.smoke.js tests/op-recalculo.smoke.js` OK (294/294).
- Regra absoluta desta fase (vinculante para fases futuras):
  OP Aberta != OP Em Producao;
  Nova OP != PROD-OP;
  Preparacao != Operacao;
  Pedido organiza != OP executa.
  OP Em Producao NAO e um incremento visual da OP Aberta — usa
  template proprio, baseado no standalone
  `Admin - PROD-OP-TECELAGEM- standalone.html`.
- Implementado:
  `buildScreen()` em `op-nova.js` bifurca para
  `buildScreenProducaoTecelagem()` quando `isOpEmProducaoTecelagem()`
  (status `em_producao`, tipo != `latex`);
  header operacional com badges Tecelagem + Em producao e acoes
  Abrir Pedido / Pausar (placeholder) / Movimentar (ancora) / Concluir
  (placeholder) / Documentos / Historico;
  Card 1 Dados da OP e Card 2 Itens da OP read-only (nao parecem
  formulario de preparacao);
  Card 3 Insumos reaproveita `buildBlocoFios` sem alteracao;
  Card 4 Entregas tecelagem reaproveita `buildBlocoTecelagem` sem
  alteracao (preserva `+ Nova entrega`, Editar, Excluir,
  `salvarEntregaCima`, `atualizarEntregaCima`, `excluirEntrega` e o
  best-effort de `gerar_op_latex`);
  Card 5 Movimentacao e bloco visual controlado que aponta (CTA
  "Transferir") para o card de entregas existente, sem gravacao nova;
  Card 6 Documentos da OP e placeholder controlado ("Documentos da OP
  serao integrados em fase propria"), sem schema/upload/gravacao;
  Card 7 Historico le `op_eventos` (read-only, tabela ja aplicada em
  staging por `db/21_op_lifecycle_status_eventos.sql`) com fallback
  controlado quando vazio/erro.
- Preservacoes obrigatorias confirmadas:
  OP Aberta/Nova OP nao foi redesenhada (buildHeader/buildCardDados/
  buildCardItens/buildRight inalterados);
  Acabamento/Latex nao foi tocado — `op.tipo === 'latex'` continua
  delegando para `js/screens/op-latex-admin.js`, sem template
  PROD-OP-TECELAGEM e sem o card `4. Entregas tecelagem`;
  nenhuma chamada a RPC de transicao de status;
  nenhum `ops.update({ status: ... })` novo;
  nenhum schema/tabela/coluna nova;
  sem SQL, sem Supabase, sem producao, sem push.
- Proximo gap (registrado, nao corrigido nesta fase):
  OP Em Producao Acabamento standalone (fase propria futura, mesmo
  padrao aplicado aqui para Tecelagem);
  ajuste futuro de `gerar_op_latex` para nascer em
  preparacao/entrada (`aberta`) em vez de `em_producao` direto;
  documentos reais da OP (schema/tabela/upload);
  lifecycle Pausar/Concluir via contrato proprio (RPC de transicao de
  status ja existe em `db/21_op_lifecycle_status_eventos.sql`, mas
  sem UI ainda).
- Testes do R1 inicial desta fase (48/48, 228/228) — ver contagem
  atualizada (55/55, 294/294) no topo deste registro, apos o ajuste
  fino visual.
- Residual preservado:
  `?? supabase/.temp/` permanece fora do stage/commit;
  104 falhas pre-existentes em `tests/*.smoke.js` (fora do pacote de
  regressao desta fase, relacionadas a ordem/estrutura de scripts em
  `index.html` e outras telas) ja existiam antes desta fase — confirmado
  via `git stash` + `node --test tests/*.smoke.js` no HEAD anterior.
- Proxima recomendacao:
  OP Em Producao Acabamento/Latex standalone, replicando esta mesma
  decisao arquitetural (template PROD-OP proprio, sem incrementar a
  tela de preparacao).

# Estado pos-fase - Nova OP Acabamento Standalone B R1

- Fase concluida no codigo:
  `RAVATEX-TAPETES-OP-NOVA-ACABAMENTO-STANDALONE-B-R1`.
- Escopo fechado:
  `js/screens/op-latex-admin.js`,
  `tests/op-latex-admin.smoke.js`,
  `PROJECT_STATE.md`,
  `AGENT_HANDOFF.md`.
- Regra vigente:
  Acabamento aberto = preparacao visual standalone;
  card 3 = `Material recebido da tecelagem`;
  item/card `4. Entregas tecelagem` fica fora da preparacao.
- Correcao de escopo aplicada:
  a transicao funcional indevida foi removida;
  nao existe `colocarEmProducao`;
  nao existe write de `ops.status = em_producao`;
  `Colocar em producao` permanece apenas como placeholder disabled
  com aviso de fase propria.
- Preservacoes obrigatorias confirmadas:
  OP Em Producao nao foi redesenhada nesta fase;
  fluxo legado de recebimento, editar enviado e finalizar foi mantido;
  sem SQL, sem Supabase, sem producao, sem lifecycle novo.
- Testes do R1:
  `node --check js/screens/op-latex-admin.js` OK;
  `node --check tests/op-latex-admin.smoke.js` OK;
  `node --test tests/op-latex-admin.smoke.js` OK (38/38);
  `node --test tests/op-nova.smoke.js tests/op-latex-admin.smoke.js` OK (77/77).
- Proxima recomendacao:
  closeout/push staging com remoto staging explicito.
# AGENT_HANDOFF.md Ã¢â‚¬â€ Controle de Tapetes

> Para uma nova sessÃƒÂ£o de IA continuar com seguranÃƒÂ§a. Leia junto:
> `PROJECT_STATE.md`, `docs/architecture/PORTAL_B2B_ARCHITECTURE_RULES.md`
> e `docs/refactor/ARCHITECTURE_REFACTOR_LEDGER.md`.
> Regras vinculantes em `docs/architecture/CODE_HEALTH_RULES.md`.
> ÃƒÂndice de fontes canÃƒÂ´nicas vs. legadas em
> `docs/DOCUMENTATION_INDEX.md`.
> ConvenÃƒÂ§ÃƒÂ£o: **tudo em portuguÃƒÂªs brasileiro**.

#### Ãšltimo estado aceito

- Estado pos-fase - Nova OP Tecelagem Standalone B R1 Boot Smoke
- Fase concluida no codigo:
  `RAVATEX-TAPETES-OP-NOVA-TECELAGEM-STANDALONE-B-R1-BOOT-SMOKE`.
- Escopo do R1:
  nenhuma mudanca funcional na UI;
  ajuste focado em `tests/boot.smoke.js` para aceitar o call-site
  canonico de `#/ops/nova?pedido_id=<id>` e completar o sandbox do
  boot com `window.addEventListener`, `window.removeEventListener`
  e `document.getElementById('app')`.
- Resultado:
  o residual que bloqueava a fase B foi removido;
  `node --test tests/boot.smoke.js` fecha verde;
  `node --test tests/op-nova.smoke.js tests/op-persistir.smoke.js tests/boot.smoke.js tests/pedido-detail.smoke.js`
  fecha verde (`181/181`).
- Proximo passo recomendado:
  validacao visual / closeout final da Nova OP Tecelagem.

- Estado pos-fase - Nova OP Tecelagem Standalone B
- Fase concluida no codigo:
  `RAVATEX-TAPETES-OP-NOVA-TECELAGEM-STANDALONE-B`.
- Referencia visual obrigatoria usada:
  `Admin - NOVA-OP-TECELAGEM.html`.
- Arquivos alterados na fase:
  `js/screens/op-nova.js`,
  `tests/op-nova.smoke.js`,
  `PROJECT_STATE.md`,
  `AGENT_HANDOFF.md`.
- Resultado funcional:
  Nova OP de Tecelagem agora usa o template visual da referencia;
  quando houver `pedido_id`, o bloco principal passa a ser
  **Pedido vinculado** e o Cliente vira dado derivado do Pedido;
  o fluxo avulso sem pedido foi preservado;
  OP Aberta de Tecelagem usa linguagem de preparacao;
  `4. Entregas tecelagem` ficou fora da preparacao e segue apenas
  no comportamento atual de `em_producao`;
  OP Em Producao nao foi redesenhada nesta fase.
- Fora desta fase por decisao explicita:
  Nova OP Acabamento;
  item/card `4. Entregas tecelagem` como parte da futura tela de
  OP Em Producao;
  movimentacao;
  entrega produtiva;
  transicao de status / `alterar_status_op`;
  backend / SQL / Supabase / producao.
- Testes da fase:
  `node --check js/screens/op-nova.js` OK;
  `node --test tests/op-nova.smoke.js` OK (39/39).
- Check amplo exigido pela instrucao:
  `node --test tests/op-nova.smoke.js tests/op-persistir.smoke.js tests/boot.smoke.js tests/pedido-detail.smoke.js`
  ainda fecha com 1 falha residual fora do escopo desta fase:
  `tests/boot.smoke.js` teste 10, que nao aceita o render atual de
  `#/ops/nova` com parse de `pedido_id`.
- Proxima fase recomendada:
  validacao visual / closeout da Nova OP Tecelagem antes de abrir
  qualquer trabalho de OP Em Producao.

- HEAD 79eaab8
- migration 21 aplicada em staging
- evidencia do check consolidado
- producao nao tocada
- proximo passo recomendado: UI lifecycle OP, usando:
  - OP Aberta = Admin - Nova OP
  - OP Em producao = Admin - Detalhe da OP

- **Lifecycle de OP backend** (Fase L,
  `db/21_op_lifecycle_status_eventos.sql`, migration versionada,
  **APLICADA em staging**): `ops.status` CHECK expandido
  (`pausada`/`concluida`/`cancelada` + legado `finalizada`);
  `op_eventos` + trigger `trg_op_evento` + RPC
  `alterar_status_op`. `gerar_op_latex` e `op-latex-admin.js`
  intocados. Nenhum JS alterado. Proximo: UI de transicao de
  status na tela de OP.
- **R1 hardening** sobre a Fase L (mesmo arquivo db/21,
  aplicado em staging): (1) `alterar_status_op` agora
  **admin-only**
  (`is_admin()` no inicio, padrao `gerar_op_latex`) â€”
  fornecedor nao transita status nesta fase; (2) observacao
  vinculada determinicamente ao evento `status_alterado` de
  `status_novo = p_novo_status` (`criado_em DESC, id DESC`),
  sem segundo evento e sem `SET LOCAL` nesta fase. Docs
  atualizados (D-L03-R1 / D-L08-R1 / D-L09-R1).

- **Migration 20 aplicada em staging** (`ucrjtfswnfdlxwtmxnoo`):
  `op_itens.pedido_item_id` (uuid, nullable, FK -> pedido_itens,
  indice) confirmado. Producao `bhgifjrfagkzubpyqpew` intocada.

## Vinculo Pedido -> OP implementado (com R1)

- **Fase C concluida** (`RAVATEX-TAPETES-PEDIDO-OP-LINK-C-R1`):
  migration `db/20_op_itens_pedido_item_link.sql` criada;
  `persistirOP` preenche `lotes.pedido_id` e `op_itens.pedido_item_id`
  (via `item.pedidoItemId` explicito, sem map por modelo_id);
  `screenNovaOP(opId, pedidoId)` aceita pedido_id e pre-preenche
  itens; `#/ops/nova` suporta `?pedido_id=`. R1 removeu
  `itemPedidoMap` por modeloId (inseguro â€” modelo nao e chave
  unica no pedido). Teste 68/68 incluindo duplicidade de
  modelo_id. Proximo passo: **Fase D** â€” OPs vinculadas no
  detalhe do Pedido Admin.

## Vinculo Pedido -> OP implementado

- **Fase C concluida** (`RAVATEX-TAPETES-PEDIDO-OP-LINK-C`):
  migration `db/20_op_itens_pedido_item_link.sql` criada
  (`op_itens.pedido_item_id` UUID FK -> pedido_itens);
  `persistirOP` agora preenche `lotes.pedido_id` e
  `op_itens.pedido_item_id` quando contexto de pedido
  disponivel; `screenNovaOP(opId, pedidoId)` aceita
  pedido_id opcional e pre-preenche itens; `#/ops/nova`
  suporta `?pedido_id=` via query param. OP avulsa
  preservada. Proximo passo: **Fase D** â€” OPs vinculadas
  no detalhe do Pedido Admin.

## Contrato schema Pedido -> OP -> Movimentacao -> Documentos

- **Contrato tecnico registrado** em
  `docs/architecture/PEDIDO_OP_SCHEMA_CONTRACT.md`
  na fase `RAVATEX-TAPETES-PEDIDO-OP-SCHEMA-CONTRACT-B` (docs-only),
  sobre o HEAD `04613ee`. O contrato valida 13 tabelas, 5 RPCs,
  4 triggers e RLS completa; confirma que `lotes.pedido_id` existe
  mas nunca e populado e que `op_itens.pedido_item_id` nao existe;
  estabelece contrato para Fase C (popular `lotes.pedido_id` +
  criar `op_itens.pedido_item_id`); desenha tabela
  `documentos_operacionais`; recomenda manter `entregas`/
  `entrega_itens` como fonte canonica de movimentacao; define
  5 etapas do stepper; e registra 8 decisoes tecnicas
  (D-B01 a D-B08). Proximo passo: Fase C. **O proximo chat DEVE
  consultar `docs/architecture/PEDIDO_OP_MOVIMENTACAO_DOCUMENTOS_PLANO.md`
  e `docs/architecture/PEDIDO_OP_SCHEMA_CONTRACT.md`** antes de
  qualquer acao de implementacao.

## Plano persistente Pedido -> OP -> Movimentacao -> Documentos

- **Plano de arquitetura persistente registrado** em
  `docs/architecture/PEDIDO_OP_MOVIMENTACAO_DOCUMENTOS_PLANO.md`
  na fase `RAVATEX-TAPETES-PEDIDO-OP-MOVEMENT-PLAN-A` (docs-only),
  sobre o HEAD `3e8e78f`. **O proximo chat DEVE consultar este plano**
  antes de qualquer acao na frente Pedido -> OP -> Movimentacao ->
  Documentos. O plano fixa: hierarquia de dominio, estrutura de OPs
  por etapa, stepper/preview produtivo, operacao canonica de
  movimentacao, parciais como camada comercial, documentos como
  pendencia nao bloqueante, modelo alvo, papeis das telas, 9 fases
  futuras (B a J), obrigacao permanente de consulta/atualizacao,
  riscos mapeados e template de evidencia por fase. Proximo passo:
  Fase B (contrato arquitetura/schema detalhado). Nenhum arquivo
  funcional alterado. `js/screens/pedidos-list.js` e
  `supabase/.temp/` preservados.

## Homologacao visual Admin Novo Pedido

- **Estado atual aceito:** `work/app-next` na fase
  `RAVATEX-TAPETES-ADMIN-NOVO-PEDIDO-MATCH-CLIENTE-NOVA-VIEW-A-R1`,
  com aceite visual explicito do dono para `#/pedidos/novo`.
- **HEAD de base da fase:** `4989727`.
- **Arquivo funcional alterado:** `js/screens/pedido-form.js`.
- **Referencia visual usada:** `js/screens/cliente-pedido-form.js`,
  mantendo Admin -> Novo Pedido na mesma base visual homologada de
  Cliente -> Novo Pedido.
- **Admin homologado:** header, cards, dados gerais, area de itens,
  modal/adicao de item, resumo e CTA final foram alinhados ao padrao do
  cliente, sem perder o fluxo administrativo.
- **Comportamento admin preservado:** selecao de cliente, status inicial
  em `rascunho`, payload real `pedidos` + `pedido_itens`, validacoes,
  compensacao em falha de itens, toast e navegacao final para
  `#/pedidos`.
- **Cliente intacto:** `js/screens/cliente-pedido-form.js` nao foi
  alterado nesta fase.
- **Correcao R1 registrada:** bloco `InstruÃ§Ãµes gerais` com titulo
  correto, `textarea` com `min-height: 40px` e recalculo de altura apos
  entrada no DOM para eliminar o corte visual.
- **Validacao real aceita:** pedido admin `#7` salvo no staging/local e
  exibido em `#/pedidos` como `Rascunho` para o cliente `Teste`.
- **Checks executados:** `node --check js/screens/pedido-form.js` OK;
  `git diff --check` OK com warnings LF/CRLF;
  `node --test tests/cliente-routing.smoke.js` OK `19/19`;
  `node --test tests/pedidos-list.smoke.js` OK;
  `node --test tests/pedido-form.smoke.js` com `34/35`.
- **Falha residual conhecida:** a unica falha restante em
  `tests/pedido-form.smoke.js` e externa/preexistente, causada pelo
  dirty diff de `js/screens/pedidos-list.js`, fora do escopo de
  `pedido-form.js`.
- **Residuos preservados fora do commit funcional da fase:**
  `M js/screens/pedidos-list.js` permanece fora do escopo e
  `?? supabase/.temp/` permanece como residual permitido.
- **Escopo preservado:** nenhum schema, SQL, Supabase estrutural,
  OP/Pedido/parciais estruturais, `common.js`, `index.html`, producao
  ou `origin/main` foi tocado.
- **Proximo passo recomendado:** abrir somente apos este closeout a fase
  `RAVATEX-TAPETES-PEDIDO-OP-MOVEMENT-PLAN-A`, para criar/registrar o
  plano persistente **Pedido â†” OP â†” Movimentacao â†” Documentos**.

## Estado atual aceito
- **Estado atual aceito:** `work/app-next`, ponta da fase
  `RAVATEX-TAPETES-ADMIN-CORES-MATCH-STANDALONE-CLOSEOUT`.
  O miolo da tela Admin -> Cores (`#/cadastros/cores`) foi alinhado
  visualmente ao HTML standalone de referencia (`Admin - Cores -
  standalone.html`). **Aceite visual explicito do dono do projeto em
  2026-06-30.** Arquivo funcional alterado:
  `js/screens/cadastros.js` (unico). Elementos homologados: botao
  `Nova cor`, busca, tabela/card, swatches, acoes e footer alinhados
  ao standalone; icones corrigidos com `SquarePen` para editar e
  lixeira para excluir; label `AÃ‡Ã•ES` centralizado; footer acoplado ao
  card da tabela no padrao do mockup. Shell/sidebar/topbar globais
  preservados; rota, acoes, validacoes e permissoes admin preservadas.
  Preview temporario `.codex-cores-visual-check.html` removido antes
  do fechamento e nao commitado. Pushed para `staging/main`. Producao
  e `origin/main` nao tocados.
- **Contrato preservado:** tela continua usando os dados reais de
  `cores`; leituras em `select('*').order('nome')`, edicao por
  `update(...).eq('id', ...)`, criacao por `insert(...)` e exclusao
  por `delete().eq('id', ...)`; sem schema, SQL, mutation Supabase
  nova, RPC nova ou alteracao de payload.
- **Teste focado conhecido:** `tests/cadastros-screens.smoke.js`
  continua verde para `screenCadastrosCores`; a unica falha
  remanescente fica fora do escopo desta fase, em `screenPainel`, por
  contagem esperada de itens do `ADMIN_MENU`.
-- **Estado atual aceito:** `work/app-next`, ponta da fase
  `RAVATEX-TAPETES-ADMIN-PARAMETROS-CALCULO-MATCH-STANDALONE-CLOSEOUT`.
  O miolo da tela Admin -> Parametros de calculo
  (`#/cadastros/parametros`) foi alinhado visualmente ao HTML
  standalone de referencia (`Admin - Parametros - standalone.html`).
  **Aceite visual explicito do dono do projeto em 2026-06-30.**
  Arquivo funcional alterado: `js/screens/cadastros.js` (unico).
  Elementos homologados: header interno e espacamentos alinhados;
  callout azul com icone e bloco compacto; tabela convertida para grid
  no desenho do mockup; inputs, tooltips e rodape alinhados em
  radius, padding e tipografia; acoes `Cancelar alteracoes` e
  `Salvar parametros` no padrao visual esperado. Shell/sidebar/topbar
  globais preservados; rota, acoes, validacoes e permissoes admin
  preservadas. Preview temporario `.codex-parametros-visual-check.html`
  removido antes do fechamento e nao commitado. Pushed para
  `staging/main`. Producao e `origin/main` nao tocados.
- **Contrato preservado:** tela continua usando os dados reais de
  `parametros_largura`; leituras em `select('*').order('largura')` e
  salvamento por `update(...).eq('largura', ...)`; sem schema, SQL,
  mutation Supabase nova, RPC nova ou alteracao de payload.
- **Diferencas residuais conhecidas:** `Atualizado por` usa fallback
  seguro em `atualizado_por_nome`, `atualizado_por` ou
  `atualizado_por_email`; se ausentes, exibe `-`, sem inventar dado.
- **Teste focado conhecido:** `tests/cadastros-screens.smoke.js`
  continua verde para `screenCadastrosParametros`; a unica falha
  remanescente fica fora do escopo desta fase, em `screenPainel`, por
  contagem esperada de itens do `ADMIN_MENU`. **Estado atual aceito:** `work/app-next`, ponta da fase
  `RAVATEX-TAPETES-ADMIN-OPS-LIST-MATCH-STANDALONE-CLOSEOUT`.
  O miolo da tela Admin Ã¢â€ â€™ Lista de OPs (`#/ops`) foi alinhado
  visualmente ao HTML standalone de referencia (`Admin - Lista de
  OPs - standalone.html`). **Aceite visual explicito do dono do
  projeto em 2026-06-30.** Arquivo funcional principal alterado:
  `js/screens/ops-list.js`. Microfix pontual no shell global em
  `js/screens/common.js`, limitado a derivacao das iniciais do avatar
  para eliminar o bug visual `A(` no admin. Elementos homologados:
  header com botao `Nova OP` sem `+` textual duplicado; 4 KPIs
  corretos (Total / Em producao / Simuladas / Abertas); busca com
  icone inline; tabs `Todas / Tecelagem / Latex`; filtros/dropdowns
  `Cliente / Todos os clientes`, `Status / Todos` e `Criada em /
  Todos os periodos`; tabela 7 colunas (`OP / LOTE`, `TIPO`,
  `CLIENTE`, `STATUS`, `ENTREGUE`, `CRIADA EM`, `AÃƒâ€¡Ãƒâ€¢ES`) com label de
  `AÃƒâ€¡Ãƒâ€¢ES` centralizado, botoes `Visualizar`/`Mais` centralizados na
  celula, badges, progresso entregue e paginacao. Shell/sidebar/
  topbar globais preservados fora esse microfix de avatar; rota
  `#/ops`, navegacao para detalhe/novo, acoes e permissoes admin
  preservadas. Regra de acao preservada: OP simulada Ã¢â€ â€™ `Editar`;
  demais OPs Ã¢â€ â€™ `Visualizar`; botao `Mais` apenas visual/disabled.
  Pushed para `staging/main`. Producao e `origin/main` nao tocados.
- **Contrato preservado:** tela continua read-only; somente SELECTs em
  `ops` e `entrega_itens`; sem insert/update/delete/rpc/functions;
  sem schema, SQL ou mutation Supabase; sem alteracao em telas fora
  do escopo.
- **Diferencas residuais conhecidas:** KPIs/contagens/linhas seguem
  dinamicos conforme dados reais; filtro `Cliente` e derivado dos
  clientes presentes na lista; progresso `Entregue` continua vindo de
  `percentualEntregueOP(...)` sobre `op_itens` + `entrega_itens`, sem
  logica nova.
- **Teste focado conhecido:** `tests/ops-list-screen.smoke.js`
  continua desatualizado nesta branch por blocos estaticos antigos
  pre-`boot.js`/pre-querystring em `index.html`; se falhar, registrar
  como teste legado fora de sincronia, sem deformar o visual para
  tentar faze-lo passar.
- **Estado atual aceito:** `work/app-next`, ponta da fase
  `RAVATEX-TAPETES-ADMIN-PEDIDOS-LIST-MATCH-STANDALONE-CLOSEOUT`.
  O miolo da tela Admin Ã¢â€ â€™ Lista de pedidos (`#/pedidos`) foi alinhado
  visualmente ao HTML standalone de referencia (`Admin - Lista de
  Pedidos - standalone.html`). **Aceite visual explicito do dono do
  projeto em 2026-06-30.** Arquivo funcional alterado:
  `js/screens/pedidos-list.js` (unico). Elementos homologados:
  header com botao "Novo pedido"; 5 KPIs (Abertos / Em producao /
  Parciais / Atrasados / Prontos); busca com icone inline; tabs com
  contagem; linha de filtros; tabela 9 colunas (Pedido / Cliente /
  Sit. interna / Visivel ao cliente / Parcial / Prazo / Recebimento /
  Atualizado / Acoes); badges; acao real `Visualizar`; paginacao.
  Shell/sidebar/topbar globais preservados; rota `#/pedidos`,
  acoes e permissoes admin preservadas. Coluna `Parcial` ligada a
  dados reais seguros via leitura read-only de `pedido_itens` e
  `pedido_parciais`, reaproveitando
  `buildPedidoAcompanhamentoParcial(..., { forCliente: false })`.
  O menu de "mais acoes" permanece apenas visual/disabled porque a
  unica acao real existente segue sendo `Visualizar`. Pushed para
  `staging/main`. Producao e `origin/main` nao tocados.
- **Contrato preservado:** tela continua read-only; somente SELECTs em
  `pedidos`, `clientes`, `pedido_itens` e `pedido_parciais`; sem
  insert/update/delete/rpc/functions; sem schema, SQL ou mutation
  Supabase; sem alteracao em `js/screens/common.js` ou `index.html`.
- **Diferencas residuais conhecidas:** KPIs/contagens/linhas sao
  dinamicos conforme dados reais; `tipo_recebimento` fica em fallback
  seguro "Ã¢â‚¬â€" quando ausente; "Visivel ao cliente" usa a taxonomia
  publicada em `status_cliente_visual` / `status_cliente_excecao`,
  podendo divergir do texto decorativo estatico do mockup.
- **Estado atual aceito:** `work/app-next`, ponta da fase
  `RAVATEX-TAPETES-CLIENTE-PEDIDOS-LIST-MATCH-STANDALONE-CLAUDE-R1`. O
  miolo da tela "Meus pedidos" do Cliente (`#/cliente/pedidos`) foi
  alinhado visualmente ao HTML standalone de referÃƒÂªncia (`Cliente -
  Lista de Pedidos - standalone.html`). **Aceite visual explÃƒÂ­cito do
  dono do projeto em 2026-06-30.** Um patch anterior do agente
  GLM/ZCode para esta tela **nÃƒÂ£o foi aceito** (busca sem ÃƒÂ­cone dentro
  de card indevido, texto do botÃƒÂ£o trocado por causa de teste, ÃƒÂ­cones
  de aÃƒÂ§ÃƒÂ£o invisÃƒÂ­veis) e foi descartado via `git restore` antes desta
  implementaÃƒÂ§ÃƒÂ£o final. Arquivo alterado: `js/screens/cliente-pedidos
  -list.js` (ÃƒÂºnico). Elementos homologados: header com botÃƒÂ£o
  "Solicitar pedido"; busca com ÃƒÂ­cone de lupa inline (sem card
  duplicado) + 5 tabs com badge de contagem (Todos / Em produÃƒÂ§ÃƒÂ£o /
  Pronto p/ expediÃƒÂ§ÃƒÂ£o / Entregue / Cancelado); tabela 7 colunas
  (Pedido / SituaÃƒÂ§ÃƒÂ£o / AvanÃƒÂ§o / Prazo / Recebimento / Atualizado /
  AÃƒÂ§ÃƒÂ£o) com pill de situaÃƒÂ§ÃƒÂ£o, avanÃƒÂ§o "Parcial Ã‚Â· X / Y m" / "Total Ã‚Â·
  Y m" e botÃƒÂ£o olho visÃƒÂ­vel/funcional para o detalhe; rodapÃƒÂ© de
  paginaÃƒÂ§ÃƒÂ£o. Parciais preservadas via
  `buildPedidoAcompanhamentoParcial(..., { forCliente: true })` (mesma
  API do dashboard/detalhe). Shell/sidebar/topbar globais preservados.
  Pushed para `staging/main`. ProduÃƒÂ§ÃƒÂ£o e `origin/main` nÃƒÂ£o tocados.
- **Contrato preservado:** SELECT de `pedidos` mantido idÃƒÂªntico ao jÃƒÂ¡
  travado pelos testes (nenhum campo novo, nenhum campo interno
  exposto); novos SELECTs em `pedido_itens`/`pedido_parciais` usam as
  mesmas colunas seguras jÃƒÂ¡ consultadas pelo dashboard/detalhe; RLS/
  schema intocados; nenhuma tela fora do escopo alterada.
- **DiferenÃƒÂ§as residuais conhecidas:** botÃƒÂ£o usa o texto do standalone
  "Solicitar pedido" em vez do literal "+ Novo pedido" exigido por um
  guard de teste desatualizado (`cliente-pedidos-list.smoke.js`,
  1 falha conhecida Ã¢â‚¬â€ nÃƒÂ£o corrigido para nÃƒÂ£o deformar o visual); coluna
  "Recebimento" exibe fallback seguro "Ã¢â‚¬â€" (campo `tipo_recebimento` jÃƒÂ¡
  existe no schema mas estÃƒÂ¡ fora do contrato de SELECT travado e nÃƒÂ£o ÃƒÂ©
  capturado hoje na criaÃƒÂ§ÃƒÂ£o do pedido Ã¢â‚¬â€ ver
  `docs/ui/CLIENTE_PORTAL_UI_GAP_INVENTORY.md`); rÃƒÂ³tulos de situaÃƒÂ§ÃƒÂ£o
  usam a taxonomia compartilhada (`getClienteTrackingStatusLabel`), por
  isso "ExpediÃƒÂ§ÃƒÂ£o"/"Acabamento"/"Aguardando definicao" em vez do texto
  decorativo do mockup.
- **Gap fechado:** `Meus Pedidos` (lista) marcado como resolvido em
  `docs/ui/CLIENTE_PORTAL_UI_GAP_INVENTORY.md`.
- **Estado atual aceito:** `work/app-next`, ponta da fase
  `RAVATEX-TAPETES-STANDARD-SHELL-SIDEBAR-TOPSTRIP-A`. O chrome global
  (topbar 62px + sidebar 196px) foi alinhado visualmente aos HTMLs
  standalone (`Admin - Topbar` / `Admin - Sidebar`). **Aceite visual
  explÃƒÂ­cito do dono do projeto em 2026-06-30** (apÃƒÂ³s hard-refresh para
  descartar cache). ImplementaÃƒÂ§ÃƒÂ£o ÃƒÂºnica em `shellLayout` em
  `js/screens/common.js` Ã¢â‚¬â€ propaga para admin/fornecedor e (via
  `clienteShellLayout`) para cliente, sem duplicaÃƒÂ§ÃƒÂ£o. Arquivos
  alterados: `js/screens/common.js` (chrome em inline styles pixel
  -exatos, sem Tailwind arbitrary) + `index.html` (apenas bump do
  `?v=` do `common.js` para forÃƒÂ§ar re-fetch). Elementos homologados:
  topbar com brand "Inttex" + sectionLabel por perfil + sino + avatar
  com iniciais + nome + chevron; sidebar com nav-items iconizados,
  estado ativo por `window.location.hash` (novo Ã¢â‚¬â€ antes nÃƒÂ£o havia
  destaque), hover via JS, separador e "Sair" no rodapÃƒÂ©. Menus/rotas/
  privilÃƒÂ©gios de cada perfil intactos. Miolos das pÃƒÂ¡ginas nÃƒÂ£o
  redesenhados. Pushed para `staging/main`. ProduÃƒÂ§ÃƒÂ£o e `origin/main`
  nÃƒÂ£o tocados.
- **Contrato preservado:** nenhum campo interno exposto (o shell sÃƒÂ³ lÃƒÂª
  `nome`/`tipo` do `CURRENT_USER` e dispara `logout`); nenhum SELECT;
  RLS/schema intocados; nenhuma tela fora do escopo alterada.
- **Gap fechado:** `Shell/Menu cliente` marcado como resolvido em
  `docs/ui/CLIENTE_PORTAL_UI_GAP_INVENTORY.md`. ObservaÃƒÂ§ÃƒÂ£o operacional:
  ao mexer no shell no futuro, o cache-busting `?v=` do `common.js` em
  `index.html` deve ser bumped para o navegador re-buscar o arquivo.
- **Estado atual aceito:** `work/app-next`, ponta da fase
  `RAVATEX-TAPETES-CLIENTE-DASHBOARD-MATCH-STANDALONE-GLM`. O miolo da
  tela Dashboard do Cliente (`#/cliente/dashboard`) foi alinhado
  visualmente ao HTML standalone de referÃƒÂªncia (`Dashboard Cliente v3
  - standalone.html`). **Aceite visual explÃƒÂ­cito do dono do projeto em
  2026-06-29** (apÃƒÂ³s ajuste R1: coluna "Resumo" removida de "Pedidos
  em destaque" e largura/alinhamento do card "Resumo dos pedidos"
  corrigidos). Arquivo alterado: `js/screens/cliente-dashboard.js`
  (ÃƒÂºnico). Elementos homologados: header com botÃƒÂ£o "Novo pedido"; 4
  KPI cards (Meus pedidos / Em produÃƒÂ§ÃƒÂ£o / ConcluÃƒÂ­do / Atrasado) com
  ÃƒÂ­cone; "Pedidos em destaque" como tabela 6 colunas (Pedido Ã‚Â·
  SituaÃƒÂ§ÃƒÂ£o Ã‚Â· AvanÃƒÂ§o Ã‚Â· Atualizado Ã‚Â· Prazo previsto Ã‚Â· AÃƒÂ§ÃƒÂ£o) com badge de
  situaÃƒÂ§ÃƒÂ£o e avanÃƒÂ§o "Parcial Ã‚Â· X / Y m" / "Total Ã‚Â· Y m"; "Resumo dos
  pedidos" com donut SVG + legenda; "ÃƒÅ¡ltimas atualizaÃƒÂ§ÃƒÂµes" e "Prazos
  prÃƒÂ³ximos". Parciais preservadas via
  `buildPedidoAcompanhamentoParcial` (dados seguros, mesma API do
  detalhe). Shell/sidebar/topbar globais preservados. Pushed para
  `staging/main`. ProduÃƒÂ§ÃƒÂ£o e `origin/main` nÃƒÂ£o tocados.
- **Contrato preservado:** nenhum campo interno exposto; SELECTs
  read-only mantidos; RLS intocada; schema nÃƒÂ£o alterado; nenhuma tela
  fora do escopo alterada; shell global nÃƒÂ£o redesenhado.
- **Gap fechado:** `Dashboard Cliente` marcado como resolvido em
  `docs/ui/CLIENTE_PORTAL_UI_GAP_INVENTORY.md`. PrÃƒÂ³ximos gaps
  remanescentes: Acompanhamento/Stepper (datas por etapa) e
  Shell/Menu cliente, este ÃƒÂºltimo de risco alto (componente
  compartilhado com admin/fornecedor).
- **Estado atual aceito:** `work/app-next`, ponta da fase
  `RAVATEX-TAPETES-UI-MATCH-STANDALONE-NOVO-PEDIDO-ADD-ITEM-MODAL`.
  O modal "Adicionar item" da tela `#/cliente/pedidos/novo` foi
  alinhado visualmente ao HTML standalone de referÃƒÂªncia
  (`Modal Adicionar Item - standalone.html`). **Aceite visual
  explÃƒÂ­cito do dono do projeto em 2026-06-29.** Arquivo alterado:
  `js/screens/cliente-pedido-form.js` (ÃƒÂºnico). Elementos homologados:
  overlay com backdrop; card 460px com radius/shadow; header
  (tÃƒÂ­tulo + subtÃƒÂ­tulo + botÃƒÂ£o fechar); campo Modelo (select real);
  Cor 1/Cor 2 derivadas do modelo selecionado (somente leitura,
  override por item deferido); Largura derivada + Metragem (input
  numÃƒÂ©rico); "ReferÃƒÂªncia visual" decorativa (gradiente/cÃƒÂ­rculo/borda
  tracejada); ObservaÃƒÂ§ÃƒÂ£o do item (textarea + contador "0/200");
  footer Cancelar/Adicionar item. Funcionalidade preservada: abertura
  via clique, inclusÃƒÂ£o real do item em `state.itens`, validaÃƒÂ§ÃƒÂµes de
  modelo e metragem > 0, fechamento por botÃƒÂ£o/overlay/Esc. DiferenÃƒÂ§as
  residuais documentadas: Metragem usa `type="number"` (nÃƒÂ£o `text`,
  para manter validaÃƒÂ§ÃƒÂ£o numÃƒÂ©rica) e placeholder de ObservaÃƒÂ§ÃƒÂ£o evita o
  termo interno "lote". Pushed para `staging/main`. ProduÃƒÂ§ÃƒÂ£o e
  `origin/main` nÃƒÂ£o tocados.
- **Contrato preservado:** nenhum campo interno exposto; RLS intocada;
  schema nÃƒÂ£o alterado; nenhuma tela fora do escopo alterada (dashboard
  nÃƒÂ£o tocado).
- **Gap fechado:** `Modal Adicionar Item` marcado como resolvido em
  `docs/ui/CLIENTE_PORTAL_UI_GAP_INVENTORY.md`. PrÃƒÂ³xima etapa:
  avaliar demais gaps (Dashboard, shell), com decisÃƒÂµes `OP-001` a
  `OP-012` respondidas antes de nova UI.
- **Estado atual aceito:** `work/app-next`, ponta da fase
  `RAVATEX-TAPETES-UI-MATCH-STANDALONE-NOVO-PEDIDO`.
  A tela `#/cliente/pedidos/novo` foi alinhada visualmente ao HTML
  standalone de referÃƒÂªncia (`Novo Pedido - standalone.html`). **Aceite
  visual explÃƒÂ­cito do dono do projeto em 2026-06-29.** Arquivo alterado:
  `js/screens/cliente-pedido-form.js` (ÃƒÂºnico). Elementos homologados:
  header back + tÃƒÂ­tulo 23px/800 + Cancelar; card "Dados gerais" 3 colunas;
  tabela de itens grid `60px 1.1fr 1.1fr .8fr 1.1fr 1.2fr 84px`;
  rodapÃƒÂ© de totais; seÃƒÂ§ÃƒÂ£o bottom grid 3fr/1fr com textarea auto-extensÃƒÂ­vel
  + card "Ir para checkout"; align-items:stretch. Funcionalidade de criaÃƒÂ§ÃƒÂ£o
  preservada (INSERT `pedidos` + `pedido_itens`, compensaÃƒÂ§ÃƒÂ£o, validaÃƒÂ§ÃƒÂµes).
  Campos `referencia`/`recebimento` em UI mas **nÃƒÂ£o enviados ao DB**.
  Modal "Adicionar item" deferido para fase posterior. Pushed para
  `staging/main`. ProduÃƒÂ§ÃƒÂ£o e `origin/main` nÃƒÂ£o tocados.
- **Contrato preservado:** nenhum campo interno exposto; RLS intocada;
  schema nÃƒÂ£o alterado; nenhuma tela fora do escopo alterada.
- **Gap fechado:** `Novo Pedido` marcado como resolvido em
  `docs/ui/CLIENTE_PORTAL_UI_GAP_INVENTORY.md`. PrÃƒÂ³xima etapa:
  avaliar demais gaps (Dashboard, Modal Adicionar Item, shell), com
  decisÃƒÂµes `OP-001` a `OP-012` respondidas antes de nova UI.
- **Estado atual aceito:** `work/app-next`, HEAD `8650bb5` ("Match
  cliente pedido detail to standalone reference"), ponta da fase
  `RAVATEX-TAPETES-CLIENTE-DETAIL-VISUAL-HOMOLOG-RECORD-A`
  (docs-only, registro de homologaÃƒÂ§ÃƒÂ£o visual). A tela
  `#/cliente/pedidos/<uuid>` foi alinhada visualmente ao HTML standalone
  de referÃƒÂªncia (`Detalhe do Pedido v2 - standalone.html`). **Aceite
  visual explÃƒÂ­cito do dono do projeto em 2026-06-29.** Elementos
  entregues e homologados: breadcrumb + tÃƒÂ­tulo inline + badge de status;
  meta card 3 colunas; stepper 42px conic-gradient two-tone
  (`#2563eb`/`#dbeafe`), check SVG nos concluÃƒÂ­dos, wrapper ÃƒÂ¢mbar para
  exceÃƒÂ§ÃƒÂ£o; preview com textura preservada; distribuiÃƒÂ§ÃƒÂ£o com barras;
  parciais em tabela 4 colunas; histÃƒÂ³rico com timeline vertical. 92/92
  testes passam. Pushed para `staging/main`. ProduÃƒÂ§ÃƒÂ£o `bhgifjrfagkzubpyqpew`
  e `origin/main` nÃƒÂ£o tocados.
- **Contrato preservado:** tela permanece 100% read-only; nenhum campo
  interno exposto (OP, lote, fornecedor, NF, romaneio, custo, margem,
  metadata, criado_por, origem, observacao_admin, token_acesso); RLS
  intocada; dashboard/lista/admin nÃƒÂ£o alterados.
- **Gap fechado:** `Detalhe do Pedido` marcado como resolvido em
  `docs/ui/CLIENTE_PORTAL_UI_GAP_INVENTORY.md`. PrÃƒÂ³xima etapa:
  avaliar demais gaps (Dashboard, Novo Pedido, shell), com decisÃƒÂµes
  `OP-001` a `OP-012` respondidas antes de nova UI.
- **Estado atual aceito:** `work/app-next` na ponta da fase
  `RAVATEX-TAPETES-CLIENTE-STATUS-VISUAL-LIST-A-R1` (frontend cliente
  read-only). `js/screens/cliente-pedidos-list.js` passou a consumir
  somente a taxonomia compartilhada de `window.RavatexPedidoTracking`
  para filtro e badge visual da lista `Meus pedidos`.
- **Contrato preservado:** lista continua read-only, com
  `from('pedidos')` e `select(...)` explicito; usa apenas campos
  seguros de status visual publicados ao cliente; sem `select('*')`,
  sem writes, sem RPC, sem Edge Function, sem admin e sem fornecedor.
- **Sem contaminaÃƒÂ§ÃƒÂ£o de escopo:** nenhuma alteracao em schema, SQL,
  Supabase ou helper/read-model parcial; nenhuma tela consumidora fora
  da lista foi alterada nesta fase.
- **Validacao registrada:** `tests/cliente-pedidos-list.smoke.js`,
  `tests/cliente-portal-visual.smoke.js`,
  `tests/cliente-dashboard.smoke.js` e
  `tests/cliente-routing.smoke.js` passaram.
- **Proximo estado esperado:** working tree limpo ao final desta fase.
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
  `docs/DOCUMENTATION_INDEX.md` Ã‚Â§1b.
- **Estado atual aceito:** `work/app-next` na ponta da fase
  `RAVATEX-TAPETES-CLIENTE-PORTAL-UI-GAP-INVENTORY-A` (docs-only,
  inventÃƒÂ¡rio de gaps de UI, read-only/diagnÃƒÂ³stico Ã¢â‚¬â€ sem cÃƒÂ³digo, sem
  schema, sem SQL, sem Supabase). HEAD: ver `git log -1` (commit desta
  fase, mensagem `"Inventory cliente portal UI gaps"`). Supabase
  staging: `ucrjtfswnfdlxwtmxnoo` (nÃƒÂ£o acessado nesta fase Ã¢â‚¬â€ sÃƒÂ³
  leitura de arquivos locais). ProduÃƒÂ§ÃƒÂ£o/original
  `bhgifjrfagkzubpyqpew` e `origin/main` **intocados**.
- **InventÃƒÂ¡rio de gaps de UI do Portal Cliente B2B** (fase
  `RAVATEX-TAPETES-CLIENTE-PORTAL-UI-GAP-INVENTORY-A`, esta, docs-only).
  Produzido `docs/ui/CLIENTE_PORTAL_UI_GAP_INVENTORY.md`, comparando os
  5 mockups aprovados (localizados fora do repo em
  `D:\OneDrive\Ravatex\Inttex\Mockups - nova interface\`: Dashboard
  Cliente, Novo Pedido, Modal Adicionar Item, Detalhe do Pedido,
  Admin-Cliente-Acompanhamento B2B) contra as 6 telas/ÃƒÂ¡reas do portal
  cliente atual (Dashboard, Novo Pedido, Modal Adicionar Item, Detalhe
  do Pedido, Acompanhamento/Stepper/Timeline, Shell/Menu). Gaps
  principais: KPIs do dashboard com semÃƒÂ¢ntica diferente do mockup;
  fluxo de novo pedido em 1 etapa/itens inline em vez de tabela+modal+
  checkout em 2 etapas; campos jÃƒÂ¡ existentes no schema
  (`referencia_cliente`, `tipo_recebimento`, `cor_1_id`/`cor_2_id`/
  `largura` por item) nÃƒÂ£o capturados na criaÃƒÂ§ÃƒÂ£o; exibiÃƒÂ§ÃƒÂ£o simultÃƒÂ¢nea
  do status operacional (`pedidoStatusBadge`) e do status visual no
  detalhe; stepper sem datas por etapa; shell/menu cliente com 2 itens
  (faltam "Novo pedido" e "Suporte") e sem identidade visual prÃƒÂ³pria,
  usando `shellLayout` **compartilhado com admin/fornecedor** (risco
  alto para qualquer correÃƒÂ§ÃƒÂ£o futura). Particularidades operacionais
  registradas como **TBD explÃƒÂ­cito** (sem inventar regra): obrigaÃƒÂ§ÃƒÂ£o
  ou nÃƒÂ£o de "tipo de recebimento"; checkout em 1 ou 2 etapas; manter
  ou nÃƒÂ£o o status operacional visÃƒÂ­vel ao cliente; campos obrigatÃƒÂ³rios
  do formulÃƒÂ¡rio; regras futuras de ediÃƒÂ§ÃƒÂ£o/cancelamento pelo cliente.
  Proposta de 6 fases futuras no documento (`UI-GAP-FIX-DASHBOARD-A`,
  `UI-GAP-FIX-NOVO-PEDIDO-A`, `UI-GAP-FIX-MODAL-ITEM-A`,
  `UI-GAP-FIX-DETALHE-A`, `UI-GAP-FIX-SHELL-A`,
  `UI-OPERATIONS-RULES-A`), com `UI-OPERATIONS-RULES-A` recomendada
  como **primeira** (resolve os TBDs antes do cÃƒÂ³digo) e
  `UI-GAP-FIX-SHELL-A` como **ÃƒÂºltima** (maior risco, cross-role).
  **A UI permanece funcional, NÃƒÆ’O final.** **ProduÃƒÂ§ÃƒÂ£o permanece
  bloqueada.** Sem cÃƒÂ³digo, sem schema, sem SQL, sem Supabase, sem Edge
  Function, sem frontend, sem testes de app (apenas verificaÃƒÂ§ÃƒÂ£o Git).
  Senha, token e credencial **nÃƒÂ£o foram registrados**.
  `docs/ui/CLIENTE_PORTAL_UI_GAP_INVENTORY.md` ÃƒÂ© diagnÃƒÂ³stico/nÃƒÂ£o-
  canÃƒÂ´nico, indexado em `docs/DOCUMENTATION_INDEX.md` Ã‚Â§1b.
- **Estado anterior:** fase
  `RAVATEX-TAPETES-CLIENTE-PORTAL-STAGING-CLOSEOUT-A` (docs-only,
  closeout do marco funcional do portal cliente em staging Ã¢â‚¬â€ sem
  schema/SQL/Supabase). HEAD fechado: `23286ae`. `staging/main`:
  `23286ae`. Supabase staging: `ucrjtfswnfdlxwtmxnoo`. ProduÃƒÂ§ÃƒÂ£o/
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
  final** Ã¢â‚¬â€ o dono do projeto confirmou que a apresentacao atual ainda
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
  registro de homologacao visual aprovada Ã¢â‚¬â€ sem schema/SQL/Supabase).
  HEAD homologado: `3b0f8e4`.
- **HomologaÃƒÂ§ÃƒÂ£o visual do portal cliente APROVADA** (fase
  `RAVATEX-TAPETES-CLIENTE-PORTAL-VISUAL-HOMOLOG-RECORD-A`, esta,
  docs-only). ValidaÃƒÂ§ÃƒÂ£o manual/controlada pelo dono do projeto, no HEAD
  `3b0f8e4`, em ambiente conectado ao Supabase staging
  `ucrjtfswnfdlxwtmxnoo`, **sem tocar produÃƒÂ§ÃƒÂ£o/original**
  `bhgifjrfagkzubpyqpew`. Aprovados: **Dashboard Cliente**, **Meus
  pedidos**, **Detalhe do pedido**, **Stepper/Acompanhamento** e
  **Timeline de atualizaÃƒÂ§ÃƒÂµes** Ã¢â‚¬â€ as 5 telas refinadas na fase
  `RAVATEX-TAPETES-CLIENTE-PORTAL-VISUAL-POLISH-A`. **Responsividade
  bÃƒÂ¡sica** aprovada (desktop e largura menor, sem sobreposiÃƒÂ§ÃƒÂ£o
  grosseira, tabelas com rolagem horizontal quando necessÃƒÂ¡rio, menu
  permanece utilizÃƒÂ¡vel). **Nenhum dado interno**
  (OP/lote/fornecedor/NF/romaneio/custo/margem/metadata/criado_por/
  origem/token_acesso) exposto ao cliente. Portal cliente **permanece
  read-only** Ã¢â‚¬â€ sem editar pedido, cancelar pedido, atualizar status,
  publicar evento ou mexer em fornecedor. **Nenhuma regressÃƒÂ£o
  funcional reportada**. **Sem** cÃƒÂ³digo/schema/SQL/Supabase/frontend/
  teste nesta fase. Senha, token e qualquer credencial **nÃƒÂ£o foram
  registrados**.
- **Polish visual do portal cliente** (fase
  `RAVATEX-TAPETES-CLIENTE-PORTAL-VISUAL-POLISH-A`, esta): refinada a
  camada de apresentaÃƒÂ§ÃƒÂ£o das 5 telas do portal cliente sem alterar
  nenhum comportamento homologado. `cliente-dashboard.js` ganhou
  cards/KPIs com borda de cor, grade de 2 colunas (desktop) entre
  "Pedidos recentes" e "ÃƒÅ¡ltimas atualizaÃƒÂ§ÃƒÂµes", e badges com tom de
  cor derivado da exceÃƒÂ§ÃƒÂ£o (mesma paleta do stepper, antes fixo em
  azul). `cliente-pedidos-list.js` ganhou contador de resultados,
  rolagem horizontal na tabela e renomeou a aÃƒÂ§ÃƒÂ£o "Visualizar" para
  "Ver pedido" (consistÃƒÂªncia com o Dashboard) Ã¢â‚¬â€ **select de pedidos
  inalterado**. `cliente-pedido-detail.js` reorganizou o resumo em
  grade de 3 colunas e deu ÃƒÂ  timeline "AtualizaÃƒÂ§ÃƒÂµes do pedido" um
  indicador visual de linha do tempo (ponto + conector) Ã¢â‚¬â€ **selects
  de pedidos/pedido_itens/pedido_cliente_eventos inalterados**.
  `cliente-pedido-tracking.js` recebeu apenas ajustes de classe
  (cantos, sombra, tamanho de cÃƒÂ­rculo); taxonomia, exceÃƒÂ§ÃƒÂµes,
  "cancelado" como exceÃƒÂ§ÃƒÂ£o terminal e mensagem personalizada
  permanecem intactos; continua sem consultar Supabase.
  `cliente-common.js` **nÃƒÂ£o foi alterado** (menu "InÃƒÂ­cio"/"Meus
  pedidos" jÃƒÂ¡ atendia ao padrÃƒÂ£o). Novo teste cruzado
  `tests/cliente-portal-visual.smoke.js` (49 casos) garante, num sÃƒÂ³
  lugar, que nenhuma das 5 telas ganhou exposiÃƒÂ§ÃƒÂ£o de
  metadata/criado_por/origem/`pedido_eventos`/OP/lote/fornecedor/NF/
  romaneio/custo/margem/token_acesso nem aÃƒÂ§ÃƒÂ£o de escrita, e que os
  SELECTs de dados permanecem **literalmente idÃƒÂªnticos** aos de antes
  da fase (guarda anti-regressÃƒÂ£o por comparaÃƒÂ§ÃƒÂ£o de string exata).
  VerificaÃƒÂ§ÃƒÂ£o visual manual feita em app local conectado ao staging
  `ucrjtfswnfdlxwtmxnoo` (usuÃƒÂ¡rio `cliente@teste.com`): Dashboard,
  Detalhe e Meus pedidos renderizam sem erro de console, com o tom de
  cor e o layout em 2 colunas funcionando como esperado. **Admin e
  fornecedor nÃƒÂ£o foram tocados. Sem schema/SQL/Supabase nesta fase.**
  Testes: lista obrigatÃƒÂ³ria da fase + `cliente-pedidos-list` +
  `cliente-portal-visual` (novo, com 49 casos) = 265 testes, todos
  passando.
- **HomologaÃƒÂ§ÃƒÂ£o Dashboard Cliente APROVADA** (fase
  `RAVATEX-TAPETES-CLIENTE-DASHBOARD-HOMOLOG-RECORD-A`, esta,
  docs-only). ValidaÃƒÂ§ÃƒÂ£o manual/controlada feita em **app local
  (`http://localhost:8765/`) conectado ao Supabase staging
  `ucrjtfswnfdlxwtmxnoo`** (runtime confirmou `APP_ENV=staging` e
  `SUPABASE_URL` Ã¢â€ â€™ `ucrjtfswnfdlxwtmxnoo`), no HEAD `54fabfa`, **sem
  tocar produÃƒÂ§ÃƒÂ£o/original `bhgifjrfagkzubpyqpew`**. Confirmado: login
  cliente cai em `#/cliente/dashboard`; menu "InÃƒÂ­cio" + "Meus pedidos"
  funcionais; dashboard sem erro de console; KPIs coerentes (em aberto
  2, em andamento 2, prontos/concluidos 0, atualizacoes recentes 3);
  pedidos recentes (#3 excecao "Aguardando insumo", #2 "Acabamento");
  ultimas atualizacoes exibidas; "Ver pedido" abre o detalhe correto
  com **stepper + timeline** preservados; navegacao
  dashboardÃ¢â€ â€™detalheÃ¢â€ â€™Meus pedidosÃ¢â€ â€™dashboard OK; **sem** dados internos
  (OP/lote/fornecedor/NF/romaneio/custo/margem/metadata/criado_por/
  origem/token_acesso) e **sem** acoes de escrita (read-only). Cliente
  de teste usado: `cliente@teste.com`, `tipo=cliente`, `cliente_id=3`,
  nome "Teste" (**senha nÃƒÂ£o registrada**). Observacao nao bloqueante:
  evento cujo `titulo` = status pode repetir o texto no titulo e no
  badge Ã¢â‚¬â€ dado do evento, nao defeito. **Sem** codigo/schema/SQL/
  Supabase/frontend/teste nesta fase.
- **Dashboard Cliente read-only** (fase
  `RAVATEX-TAPETES-CLIENTE-DASHBOARD-A`, esta): novo modulo
  `js/screens/cliente-dashboard.js` (`screenClienteDashboard`) servindo
  de pagina inicial do portal B2B em `#/cliente/dashboard`
  (`roles: ['cliente']`, registrada em `js/boot.js`). `routeAfterLogin`
  (em `js/router.js`) passa a levar o cliente para `#/cliente/dashboard`
  apos login; `#/cliente/pedidos`, `#/cliente/pedidos/novo` e
  `#/cliente/pedidos/<uuid>` continuam funcionando. Menu cliente
  (`CLIENTE_MENU` em `cliente-common.js`) ganha **"InÃƒÂ­cio"** preservando
  **"Meus pedidos"**. Dashboard mostra cards/KPIs (em aberto, em
  andamento, prontos/concluidos, atualizacoes recentes) derivados
  localmente; ate 5 pedidos recentes com label visual via
  `window.RavatexPedidoTracking` e botao "Ver pedido"; e as ultimas
  atualizacoes (ate 8) lidas de `pedido_cliente_eventos`, com empty
  state "Suas atualizaÃƒÂ§ÃƒÂµes aparecerÃƒÂ£o aqui.". **Pedidos** lidos com
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
  homologaÃƒÂ§ÃƒÂ£o manual feita sobre esse HEAD, sem alterar cÃƒÂ³digo).
- **HEAD homologado em staging:** `fc7843c`.
- **Working tree:** limpo apÃƒÂ³s commit.
- **origin/main:** `1047181eba888242c6428de366cbd9fda2f1c72c` Ã¢â‚¬â€ intocado
- **PR #2:** intocado
- **Ã¢Å¡Â Ã¯Â¸Â NÃƒÆ’O CHAMAR `ucrjtfswnfdlxwtmxnoo` DE "PRODUÃƒâ€¡ÃƒÆ’O ORIGINAL".**
  Ãƒâ€° o ambiente paralelo. O app original online estÃƒÂ¡ em
  `bhgifjrfagkzubpyqpew` + Vercel e **nÃƒÂ£o deve ser tocado**.
- **Ã¢Å¡Â Ã¯Â¸Â NÃƒÆ’O TOCAR `bhgifjrfagkzubpyqpew`.**
- **Ã¢Å¡Â Ã¯Â¸Â NÃƒÆ’O TOCAR Vercel original.**
- **Schema Pedidos** `db/13_pedidos_schema.sql` aplicado em
  `ucrjtfswnfdlxwtmxnoo`: tabelas `pedidos`, `pedido_itens`,
  `pedido_eventos` e `lotes.pedido_id` (nullable). RLS admin-only.
  Sem policy pÃƒÂºblica. Sem `pedidos.op_id`.
- **Schema Cliente Perfil** `db/14_cliente_perfil_schema.sql`
  **aplicado em staging** `ucrjtfswnfdlxwtmxnoo` via Management API
  (fase B2). Role `cliente`, `usuarios.cliente_id`, `meu_cliente_id()`
  e 5 policies cliente SELECT/INSERT operacionais. Sem UPDATE/DELETE
  cliente. Sem token pÃƒÂºblico. `pedido_eventos` admin-only.
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
- **HomologaÃƒÂ§ÃƒÂ£o manual E2E aprovada** (fase
  `RAVATEX-TAPETES-PEDIDOS-CLIENTE-TRACKING-E2E-HOMOLOG-RECORD-A`,
  esta, docs-only). HMNlead validou manualmente em staging
  `ucrjtfswnfdlxwtmxnoo`, no HEAD `fc7843c`, sem tocar
  `bhgifjrfagkzubpyqpew`: admin publicou `status_cliente_visual =
  acabamento` com mensagem personalizada via
  `pedido-tracking-admin.js`; `pedidos.status_cliente_*` foram
  gravados; `pedido_cliente_eventos` recebeu o evento correspondente
  (`origem = manual`, `visivel_cliente = true`); cliente visualizou o
  stepper na etapa "Acabamento" com mensagem e data de atualizaÃƒÂ§ÃƒÂ£o; a
  seÃƒÂ§ÃƒÂ£o "AtualizaÃƒÂ§ÃƒÂµes do pedido" exibiu o evento. Excecao visual
  (`status_cliente_excecao = aguardando_insumo`) tambem foi testada e
  exibida corretamente, sem quebrar o stepper, com novo evento na
  timeline. `metadata`, `criado_por` e `origem` nao apareceram ao
  cliente; nenhum dado de OP/lote/fornecedor/NF/romaneio/custo/margem
  foi exposto. **Cancelado nao foi testado** (pedido usado nao era
  seguro para esse teste). **DecisÃƒÂ£o: fluxo aprovado** para avanÃƒÂ§ar ao
  Dashboard Cliente read-only ou refinamento visual do portal cliente.
  **Sem** alteraÃƒÂ§ÃƒÂ£o de cÃƒÂ³digo/schema/SQL/Supabase/frontend nesta fase.
- **Provisionamento cliente** (fase PROV-A): `admin-create-user`
  aceita `cliente` (valida `cliente_id` em `public.clientes`, rejeita
  `fornecedor_id` simultÃƒÂ¢neo). UI `#/cadastros/usuarios` com tipo
  Cliente + select de cliente. `loadCurrentUser()` carrega
  `cliente_id` e `cliente_nome`. `isCliente()` disponÃƒÂ­vel.
  **CorreÃƒÂ§ÃƒÂ£o 2026-06-27 (HOMOLOG-RECORD-A):** jÃƒÂ¡ **existe um cliente
  de teste funcional em staging** (`cliente@teste.com`, `cliente_id=3`,
  nome "Teste"), com login validado e dashboard homologado.
  **CONFIRMADO 2026-06-27 (PROVISIONING-STAGING-VERIFY-A):** o **deploy
  da versÃƒÂ£o de `admin-create-user` que aceita `tipo=cliente` estÃƒÂ¡ ATIVO
  em staging** `ucrjtfswnfdlxwtmxnoo`. Verificado por probe nÃƒÂ£o
  destrutivo: admin (`admin@tapetes.test`) invocou
  `functions.invoke('admin-create-user', { body: { tipo: 'cliente',
  cliente_id: 999999, ... } })` e recebeu HTTP 400 `VALIDATION_ERROR
  "cliente_id nÃƒÂ£o existe em public.clientes."` Ã¢â‚¬â€ mensagem exclusiva do
  ramo `cliente` da funÃƒÂ§ÃƒÂ£o; a versÃƒÂ£o antiga teria barrado antes no gate
  de `tipo`. **Nenhum usuÃƒÂ¡rio real foi criado** (a validaÃƒÂ§ÃƒÂ£o de
  `cliente_id` ocorre antes de `createUser`). Senha/token **nÃƒÂ£o
  registrados**; produÃƒÂ§ÃƒÂ£o `bhgifjrfagkzubpyqpew` **nÃƒÂ£o tocada**. A
  lacuna "provisionamento self-service via Edge Function em staging =
  a confirmar" estÃƒÂ¡ **resolvida**.
- **Frontend Pedidos cliente entregue (UI-A + CREATE-A):**
  shell mÃƒÂ­nimo (`js/screens/cliente-common.js` com `CLIENTE_MENU`:
  "Meus pedidos" apenas), listagem read-only com botÃƒÂ£o
  "+ Novo pedido" (`js/screens/cliente-pedidos-list.js`,
  `#/cliente/pedidos`, `screenClientePedidosLista`, confia na
  RLS), detalhe sanitizado (`js/screens/cliente-pedido-detail.js`,
  `#/cliente/pedidos/<uuid>`, `screenClientePedidoDetalhe`,
  sem editar/cancelar, sem expor OP/lote/fornecedor/
  token/eventos), formulÃƒÂ¡rio de criaÃƒÂ§ÃƒÂ£o
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
- **Admin Pedidos completo (C1-C3C3):** listagem, formulÃƒÂ¡rio,
  detalhe, aÃƒÂ§ÃƒÂµes de status, ediÃƒÂ§ÃƒÂ£o de dados gerais e itens.
- **GovernanÃƒÂ§a obrigatÃƒÂ³ria antes da prÃƒÂ³xima implementaÃƒÂ§ÃƒÂ£o:**
  `docs/architecture/PORTAL_B2B_ARCHITECTURE_RULES.md` fixa os
  limites da frente Portal B2B/Pedidos. **NÃƒÂ£o iniciar**
  `RAVATEX-TAPETES-PEDIDOS-CLIENTE-TRACKING-SCHEMA-A` sem
  respeitar esse documento. Em especial: separar cliente,
  admin e fornecedor; separar status operacional de
  `status_cliente_visual`; nÃƒÂ£o colar HTML standalone no app;
  reaproveitar componentes comuns; manter SPA estÃƒÂ¡tico + JS
  clÃƒÂ¡ssico + `window.*`; quebrar prÃƒÂ³ximas entregas em fases
  pequenas (schema, staging SQL, admin UI, cliente UI,
  dashboard, redesign shell, fornecedor, automaÃƒÂ§ÃƒÂ£o).
- **Sketch de acompanhamento visual no detalhe cliente
  (fase TRACKING-UI-A, esta):** novo mÃƒÂ³dulo
  `js/screens/cliente-pedido-tracking.js`
  (`buildClientePedidoTrackingCard(pedido)`) Ã¢â‚¬â€ componente puro
  de apresentaÃƒÂ§ÃƒÂ£o (sem Supabase, sem writes), com stepper de 6
  etapas (Recebido/Confirmado/Em produÃƒÂ§ÃƒÂ£o/Em acabamento/Pronto
  para entrega/Entregue) + banner de situaÃƒÂ§ÃƒÂ£o atual.
  `cliente-pedido-detail.js` chama o componente no topo do
  detalhe via `buildTracking()`. Etapa ÃƒÂ© DERIVADA de
  `pedido.status` (`statusParaEtapaCliente`): `rascunho`/
  `recebido` Ã¢â€ â€™ "Recebido", `confirmado` Ã¢â€ â€™ "Confirmado", demais
  status (`produzindo`, `entregue`) ficam neutros (sem etapa
  marcada) por nÃƒÂ£o terem transiÃƒÂ§ÃƒÂ£o alcanÃƒÂ§ÃƒÂ¡vel nesta fase nem
  correspondÃƒÂªncia 1:1 com um ÃƒÂºnico nÃƒÂ³ do stepper. `cancelado`
  substitui o stepper por um aviso calmo. **Sem** campo
  `status_cliente_visual` real ainda no frontend, **sem** tabela de
  eventos visivel ainda, **sem** dropdown admin, **sem**
  schema/SQL/Edge Function na fase TRACKING-UI-A, **sem**
  dados internos sensÃƒÂ­veis. Script carregado em `index.html`
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
- `index.html` estÃƒÂ¡ declarativo, sem script inline final, com
  cache-busting `?v=20260623-asset1` em 26 assets locais
  (23 originais + `js/screens/pedido-detail.js` adicionado em C3A).
- `js/boot.js` ÃƒÂ© o entrypoint oficial; respeita DOM ready
  (`startApp` aguarda `DOMContentLoaded` se
  `document.readyState === 'loading'`).
- `js/router.js` ÃƒÂ© engine genÃƒÂ©rica e nÃƒÂ£o foi alterado no ciclo.
- `js/ui.js` faz lookup lazy do root `#app` via `getAppRoot()` Ã¢â‚¬â€
  `replaceChildren null` foi eliminado apÃƒÂ³s cache limpo.
- `js/screens/op-pdf.js` foi extraÃƒÂ­do de `op-nova.js` em
  `7f3c6da` (`RAVATEX-TAPETES-OP-NOVA-PDF-MODULE-A`).
- `run-local.bat` ÃƒÂ© o tooling local para servir o app em
  `http://localhost:8765/`.

## DecisÃƒÂ£o arquitetural vigente
**REFATORAÃƒâ€¡ÃƒÆ’O ARQUITETURAL CONGELADA.**

PrÃƒÂ³xima fase esperada ÃƒÂ© **homologaÃƒÂ§ÃƒÂ£o / release**, **nÃƒÂ£o** nova
extraÃƒÂ§ÃƒÂ£o em `op-nova.js`. Em particular, **NÃƒÆ’O iniciar** novas fases
como `RAVATEX-TAPETES-OP-BLOCO-FIOS-DIAG-A`,
`RAVATEX-TAPETES-OP-PROPOSTA-DIAG-A` ou
`RAVATEX-TAPETES-TRANSACTION-RISK-DIAG-A` sem nova instruÃƒÂ§ÃƒÂ£o
explÃƒÂ­cita do dono do projeto: o refactor estÃƒÂ¡ fechado e essas
sugestÃƒÂµes sÃƒÂ£o **opcionais** (vide `docs/refactor/ARCHITECTURE_REFACTOR_LEDGER.md`
seÃƒÂ§ÃƒÂ£o 9).

## Comandos de verificaÃƒÂ§ÃƒÂ£o (rodar antes de qualquer patch)

```bash
cd "D:\OneDrive\ProgramaÃƒÂ§ÃƒÂ£o\Ravatex\controle-tapetes"

git status --short
git branch --show-current
git rev-parse --short HEAD
git remote -v
git ls-remote --heads staging main
git ls-remote --heads origin main
```

Abortar e revisar o escopo se:
- branch != `work/app-next`;
- HEAD nÃƒÂ£o estiver no commit `247b8ca` ou commit posterior
  da fase `RAVATEX-TAPETES-PEDIDOS-CLIENTE-SCHEMA-RLS-B1`
  (commit "Add cliente perfil schema and RLS" no topo);
- working tree nÃƒÂ£o estiver limpo;
- `staging/main` nÃƒÂ£o tiver sido atualizado para o commit
  desta fase (antes do push era `247b8ca`);
- `origin/main` != `1047181eba888242c6428de366cbd9fda2f1c72c`
  (qualquer mudanÃƒÂ§a em `origin/main` ÃƒÂ© regressÃƒÂ£o grave).

## Regras (NÃƒÆ’O renegocia)

1. **Push autorizado somente para `staging`**, salvo ordem explÃƒÂ­cita
   futura. Nunca `git push origin` em `work/app-next:main`.
2. **NÃƒÂ£o tocar `origin/main` oficial.**
3. **NÃƒÂ£o tocar PR #2.**
4. **NÃƒÂ£o acessar Supabase real** em refactors/testes mockados. Toda
   validaÃƒÂ§ÃƒÂ£o de chain de Supabase usa `fakeSupa` em `vm.Context`.
5. **NÃƒÂ£o registrar** em relatÃƒÂ³rio ou doc: `service_role`, senha,
   `JWT secret`, connection string com senha, anon key completa.
6. **Testes focados** por fase (`node --test <arquivo>.smoke.js`).
   NÃƒÂ£o rodar suÃƒÂ­te completa por padrÃƒÂ£o.
7. **Fase schema-only atual**: sÃƒÂ³ `db/15_status_cliente_visual.sql`,
   `tests/cliente-tracking-schema.smoke.js`, `PROJECT_STATE.md`,
   `AGENT_HANDOFF.md` e `docs/DOCUMENTATION_INDEX.md` podem ser
   criados/alterados. Qualquer diff fora desses 5 arquivos reprova.
8. **NÃƒÂ£o mexer** em `aplicarRecalculoOP` ou `persistirOP` sem
   nova fase explÃƒÂ­cita.
9. **NÃƒÂ£o fazer docs + cÃƒÂ³digo na mesma fase.**
10. **NÃƒÂ£o iniciar nova extraÃƒÂ§ÃƒÂ£o em `op-nova.js`** (refactor
    congelado). PrÃƒÂ³xima aÃƒÂ§ÃƒÂ£o ÃƒÂ© homologaÃƒÂ§ÃƒÂ£o/release, nÃƒÂ£o refactor.

## MÃƒÂ³dulos principais e responsabilidades

### `boot.js` (RAVATEX-TAPETES-ROUTES-BOOT-MODULE-A + 87d4559)
- Registra rotas via `window.RAVATEX_ROUTER.setRoutes` (15 rotas).
- Executa `main()` via `startApp()` (que aguarda `DOMContentLoaded`
  se `document.readyState === 'loading'`).
- Registra `hashchange` listener.
- Carrega usuÃƒÂ¡rio atual via `window.loadCurrentUser`.
- Direciona para `navigate('#/login')`, `handleRoute()` ou
  `routeAfterLogin()`.
- Captura erro de boot via `main().catch()` + `toast('Erro ao iniciar o app', 'error')`.

### `op-nova.js` (RAVATEX-TAPETES-SCREENNOVAOP-MODULE-A)
- `screenNovaOP` (closure inteira com `~20` subfunÃƒÂ§ÃƒÂµes aninhadas).
- UI/estado da Nova OP.
- Proposta, blocos de fios, tecelagem, wrappers de
  persistÃƒÂªncia/recÃƒÂ¡lculo.
- Call-site de PDF: `window.gerarPdfCompraFios({ op, ordens })`.
- **NÃƒÆ’O** contÃƒÂ©m mais a funÃƒÂ§ÃƒÂ£o `gerarPdfCompraFios` (extraÃƒÂ­da em
  `7f3c6da`).
- MantÃƒÂ©m read-only em Supabase (apenas `.select()`).
- Writes delegados: `window.persistirOP`, `window.aplicarRecalculoOP`,
  `window.registrarRecebimentoOrdemFio`,
  `window.atribuirFornecedorFioOp`, `window.renderOPLatexAdmin`.

### `op-pdf.js` (RAVATEX-TAPETES-OP-NOVA-PDF-MODULE-A)
- `gerarPdfCompraFios({ op, ordens })` Ã¢â‚¬â€ helper puro, sem closure.
- Usa `window.jspdf.jsPDF` (CDN) e `window.agruparOrdensCompraFio`
  (de `calculo-op.js`).
- Fallback `toast` quando jsPDF ausente.
- Exports: `window.gerarPdfCompraFios` e
  `window.RAVATEX_SCREENS.opPdf.gerarPdfCompraFios`.
- NÃƒÂ£o toca Supabase, nÃƒÂ£o muta DOM.

### `op-persistir.js` (RAVATEX-TAPETES-OP-PERSISTIR-MODULE-A)
- Helpers puros de persistÃƒÂªncia: `itensValidosOP`,
  `montarPayloadItensOP`, `montarPayloadFornecedoresOP`,
  `montarPayloadOP`, `montarPayloadLote`.
- Write helper: `persistirOP` Ã¢â‚¬â€ executa 8 writes da persistÃƒÂªncia
  (ops, lotes, op_itens, op_fornecedores, ordens_compra_fio).
  Retorna envelope `{ error, step, partial, opId }`.

### `op-recalculo.js` (RAVATEX-TAPETES-OP-RECALCULO-MODULE-A)
- Helpers puros: `maxMetrosItem`, `normalizarChaveSaldo`.
- Write helper: `aplicarRecalculoOP` Ã¢â‚¬â€ executa 4 writes do recÃƒÂ¡lculo
  (`op_itens.update`, `saldo_fios_op.insert`, `saldo_fios`
  select/update/insert, `ops.update status='em_producao'`).
  Retorna envelope `{ error, step, partial }`.

### `ui.js` (87d4559 + e0dbfcd)
- `el`, `toast`, `pageHeader`, `textInput`, `selectInput`,
  `formField`, `dataTable`, `modal`, `confirmDialog`, `shellLayout`,
  `ADMIN_MENU`.
- `getAppRoot()` Ã¢â‚¬â€ lookup lazy do root `#app`.

## PrÃƒÂ³xima recomendaÃƒÂ§ÃƒÂ£o operacional

**GovernanÃƒÂ§a Portal B2B/Pedidos registrada (fase GOV-A, esta).**
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
admin Ã¢â€ â€™ cliente (status visual + excecao + timeline) foi validado
manualmente em staging `ucrjtfswnfdlxwtmxnoo`, no HEAD `fc7843c`, e
**aprovado** pelo dono do projeto. Cancelado nao foi testado (fica
para fase futura com pedido de teste dedicado, se necessario).

**Proxima fase recomendada:** Dashboard Cliente read-only ou
refinamento visual do portal cliente, conforme decisao do dono do
projeto.

**Sequencia recomendada depois desta fase:** dashboard cliente;
redesign de shell/componentes comuns; e so depois fornecedor/automacao.

**Homologado (fase `RAVATEX-TAPETES-CLIENTE-PORTAL-VISUAL-HOMOLOG-RECORD-A`,
esta):** a homologaÃƒÂ§ÃƒÂ£o visual manual do portal cliente B2B (Dashboard,
Meus pedidos, Detalhe, Stepper/Acompanhamento, Timeline), pÃƒÂ³s
refinamento visual da fase POLISH-A, foi validada e **aprovada** pelo
dono do projeto, no HEAD `3b0f8e4`, em ambiente conectado ao Supabase
staging `ucrjtfswnfdlxwtmxnoo`, sem tocar `bhgifjrfagkzubpyqpew`.

**Proxima fase recomendada (atualizada):** decidir, com o dono do
projeto, entre preparaÃƒÂ§ÃƒÂ£o para produÃƒÂ§ÃƒÂ£o/staging closeout do portal
cliente ou avanÃƒÂ§o para o prÃƒÂ³ximo bloco funcional.

**NÃƒÂ£o iniciar execuÃƒÂ§ÃƒÂ£o sem autorizaÃƒÂ§ÃƒÂ£o explÃƒÂ­cita.**
**NÃƒÆ’O tocar `bhgifjrfagkzubpyqpew`, Vercel original, ou `origin/main`.**

## Fases de implementaÃƒÂ§ÃƒÂ£o do design Auth (aprovadas para execuÃƒÂ§ÃƒÂ£o)

Design concluÃƒÂ­do em `docs/architecture/AUTH_PROVISIONING_EDGE_DESIGN.md`.
Fases, em ordem:

1. **`RAVATEX-TAPETES-AUTH-EDGE-FUNCTION-A`** Ã¢â‚¬â€ criar/implementar a
   Edge Function `admin-create-user` (sem UI ainda). **ConcluÃƒÂ­da
   localmente (sem deploy).**
2. **`RAVATEX-TAPETES-AUTH-EDGE-STAGING-DEPLOY-A`** Ã¢â‚¬â€ deploy controlado
   em staging e validaÃƒÂ§ÃƒÂ£o de permissÃƒÂµes. **ConcluÃƒÂ­da em staging.**
3. **`RAVATEX-TAPETES-AUTH-ADMIN-UI-A`** Ã¢â‚¬â€ adaptar
   `screenCadastrosUsuarios` para chamar a Edge Function. **ConcluÃƒÂ­da.**
4. **`RAVATEX-TAPETES-AUTH-PROVISIONING-DOCS-A`** Ã¢â‚¬â€ documentar operaÃƒÂ§ÃƒÂ£o
   final (runbook). **ConcluÃƒÂ­da.**
5. **`RAVATEX-TAPETES-AUTH-DELETE-USER-DESIGN-A`** Ã¢â‚¬â€ decidir
   exclusÃƒÂ£o/desativaÃƒÂ§ÃƒÂ£o de usuÃƒÂ¡rios pelo app. **ConcluÃƒÂ­da.**
   RecomendaÃƒÂ§ÃƒÂ£o: desativar (soft delete + ban Auth), nÃƒÂ£o deletar.
   Design em `docs/architecture/AUTH_DELETE_USER_DESIGN.md`.
6. **`RAVATEX-TAPETES-AUTH-DELETE-UI-GUARD-A`** Ã¢â‚¬â€ contenÃƒÂ§ÃƒÂ£o
   imediata: remover `.from('usuarios').delete()` do front-end e
   substituir botÃƒÂ£o "Excluir vÃƒÂ­nculo" por placeholder "Em breve".
   **ConcluÃƒÂ­da.** Nenhum write Supabase exposto; nenhum `auth.admin`
   no front; smoke tests 48/48 verdes.
7. **`RAVATEX-TAPETES-AUTH-DISABLE-USER-SCHEMA-A`** Ã¢â‚¬â€ schema
   versionado para desativaÃƒÂ§ÃƒÂ£o (colunas + recriaÃƒÂ§ÃƒÂ£o de funÃƒÂ§ÃƒÂµes e
   policies RLS em `public.usuarios`). **ConcluÃƒÂ­da.** Migration em
   `db/12_auth_user_disable_schema.sql`; testes 20/20 em
   `tests/auth-disable-user-schema.smoke.js`. **Aplicada em staging**
   (ver item 8b).
8. **`RAVATEX-TAPETES-AUTH-DISABLE-USER-SCHEMA-APPLY-A`** Ã¢â‚¬â€ aplicar
   a migration em staging. **ConcluÃƒÂ­da como docs-only (commit
   `8fa924a`).** OrientaÃƒÂ§ÃƒÂ£o e validaÃƒÂ§ÃƒÂ£o local para aplicaÃƒÂ§ÃƒÂ£o em
   staging; smoke 20/20 e regressÃƒÂµes 65/65 verdes; SQL limpo
   (sem DELETE/DROP/TRUNCATE/secrets). A execuÃƒÂ§ÃƒÂ£o real do SQL
   ficou pendente de HMNlead e foi registrada na fase 8b.
8b. **`RAVATEX-TAPETES-AUTH-DISABLE-USER-SCHEMA-APPLY-EVIDENCE-A`**
    *(esta fase, docs-only)* Ã¢â‚¬â€ registro da **aplicaÃƒÂ§ÃƒÂ£o real** de
    `db/12_auth_user_disable_schema.sql` no Supabase **staging**
    `ucrjtfswnfdlxwtmxnoo`, feita manualmente pelo HMNlead no
    SQL Editor do Dashboard. EvidÃƒÂªncias: 4 colunas novas em
    `public.usuarios`; funÃƒÂ§ÃƒÂµes `is_admin`/`meu_fornecedor_id`
    recriadas com checagem de `ativo`; policies
    `usuarios_select`/`usuarios_admin_all`/`usuarios_self_update`
    recriadas; contagem `ativo = true, total = 3`,
    `auth_users_total = 3`, `public_usuarios_total = 3`,
    `auth_sem_perfil = 0`, `perfil_sem_auth = 0`. Nenhum usuÃƒÂ¡rio
    foi criado, excluÃƒÂ­do ou desativado. `db/10_reset_producao.sql`
    e `db/11_reset_ops.sql` nÃƒÂ£o foram rodados. ProduÃƒÂ§ÃƒÂ£o
    `bhgifjrfagkzubpyqpew` nÃƒÂ£o foi tocada. App validado
    manualmente em staging: login OK, `#/cadastros/usuarios`
    carrega, `+ Novo usuÃƒÂ¡rio` visÃƒÂ­vel, exclusÃƒÂ£o insegura segue
    bloqueada como `Em breve`, sem erros crÃƒÂ­ticos de Auth/RLS
    no console. Warnings nÃƒÂ£o bloqueantes: Tailwind CDN,
    `favicon.ico` 404.
9. **`RAVATEX-TAPETES-AUTH-DISABLE-USER-EDGE-A`** Ã¢â‚¬â€ Edge Function
   `admin-disable-user` (soft delete no perfil + ban Auth).
   **ConcluÃƒÂ­da localmente (sem deploy).** ImplementaÃƒÂ§ÃƒÂ£o em
   `supabase/functions/admin-disable-user/index.ts` (mesmos
   `_shared/cors.ts` e `_shared/response.ts` de `admin-create-user`).
   ValidaÃƒÂ§ÃƒÂµes: JWT no header `Authorization` + `tipo = 'admin' AND
   ativo IS TRUE` em `public.usuarios` server-side; UUID regex
   para `user_id`; `reason` Ã¢â€°Â¤ 500 chars (trim, opcional);
   `SELF_DISABLE_FORBIDDEN` quando `target_id === caller_id`;
   `LAST_ADMIN_FORBIDDEN` quando alvo ÃƒÂ© o ÃƒÂºnico admin ativo;
   idempotÃƒÂªncia (`already_disabled: true`) se alvo jÃƒÂ¡ estÃƒÂ¡ inativo;
   soft delete via `.update({ ativo: false, desativado_em, desativado_por,
   motivo_desativacao })`; ban Auth via
   `auth.admin.updateUserById(target_id, { ban_duration: '876000h' })`;
   compensaÃƒÂ§ÃƒÂ£o (reverte `ativo = true` e limpa campos) se ban
   falhar; `COMPENSATION_FAILED` se a reversÃƒÂ£o tambÃƒÂ©m falhar.
   **Sem `auth.admin.deleteUser` e sem `.delete()`** Ã¢â‚¬â€ apenas soft
   delete. Smoke `tests/admin-disable-user.smoke.js` 39/39 verde.
   RegressÃƒÂµes preservadas: `admin-create-user` 17/17,
   `auth-disable-user-schema` 20/20, `cadastros-usuarios-auth-ui`
   16/16, `cadastros-screens` 32/32. **Sem deploy nesta fase.**
   Deploy e validaÃƒÂ§ÃƒÂ£o E2E em staging:
   `RAVATEX-TAPETES-AUTH-DISABLE-USER-EDGE-STAGING-DEPLOY-A`
   (prÃƒÂ³xima fase).
10. **`RAVATEX-TAPETES-AUTH-DISABLE-USER-EDGE-STAGING-DEPLOY-A`**
    *(prÃƒÂ³xima Ã¢â‚¬â€ separada da fase atual)* Ã¢â‚¬â€ deploy controlado de
    `admin-disable-user` em staging e validaÃƒÂ§ÃƒÂ£o manual. A fase
    E2E-AUTO-RUNNER-A abaixo jÃƒÂ¡ cria o runner que automatiza a
    validaÃƒÂ§ÃƒÂ£o E2E.
 11. **`RAVATEX-TAPETES-AUTH-DISABLE-USER-E2E-AUTO-RUNNER-A`**
     *(em andamento, fase atual, repo-only)* Ã¢â‚¬â€ runner local
     automatizado em `scripts/staging/admin-disable-user-e2e.mjs`
     com comandos `setup` (coleta admin_email/admin_password uma
     ÃƒÂºnica vez; detecta staging de `js/config.js`; salva em
     `.ravatex-local/admin-disable-user-e2e.config.json`,
     gitignored) e `run` (carrega config; aborta se URL nÃƒÂ£o for
     `ucrjtfswnfdlxwtmxnoo` ou se for `bhgifjrfagkzubpyqpew`;
     login admin; valida `tipo=admin AND ativo=true`; resolve
     `fornecedor_id` config/autodetect; cria fornecedor descartÃƒÂ¡vel
     via `admin-create-user`; tenta desativar admin como fornecedor
     esperando `FORBIDDEN`; revalida admin; desativa descartÃƒÂ¡vel
     esperando `auth_banned=true`; valida `desativado_em`/
     `desativado_por`/`motivo_desativacao`; tenta login do
     desativado esperando falha; re-desativa esperando
     `already_disabled=true`; tenta self-disable esperando
     `SELF_DISABLE_FORBIDDEN`; imprime resumo sanitizado).
     Smoke estÃƒÂ¡tico
     `tests/admin-disable-user-e2e-runner.smoke.js` 32/32 verde
     (apÃƒÂ³s `E2E-RUNNER-FIX-A`).
     `.gitignore` agora ignora `.ravatex-local/`. **E2E real
     nÃƒÂ£o foi rerodado apÃƒÂ³s o fix** Ã¢â‚¬â€ fica para a prÃƒÂ³xima
     (`RAVATEX-TAPETES-AUTH-DISABLE-USER-E2E-A` ou similar).
 11b. **`RAVATEX-TAPETES-AUTH-DISABLE-USER-E2E-RUNNER-FIX-A`**
     *(esta fase, repo-only)* Ã¢â‚¬â€ correÃƒÂ§ÃƒÂ£o do bug do runner no
     passo `login_blocked`. ExecuÃƒÂ§ÃƒÂ£o real do runner em staging
     avanÃƒÂ§ou atÃƒÂ© `profile_inactive` e falhou com
     `HTTP 400 User is banned` tratado como erro fatal, porque
     `supabaseLogin` chamava `die()`/`process.exit` em qualquer
     HTTP 4xx e usava mensagem hardcoded "Login admin falhou"
     (rÃƒÂ³tulo incorreto para o usuÃƒÂ¡rio descartÃƒÂ¡vel desativado).
     CorreÃƒÂ§ÃƒÂ£o: helpers separados `loginExpectSuccess(...)` (fatal,
     rÃƒÂ³tulo parametrizado: `admin_login failed`,
     `test_user_login failed`, `admin_relogin failed`) e
     `loginExpectFailure(...)` (nÃƒÂ£o-fatal; aceita HTTP 4xx com
     `User is banned`/`banned`/`Banned user`/`User is already
     registered` como falha esperada; retorna
     `{ ok, unexpected, status, detail }` para o caller decidir).
     Camada HTTP crua em `postSupabaseLogin(...)` (sem `die()`).
     Passo `login_blocked` agora imprime `login_blocked: OK` e
     continua para `idempotency` e `self_disable_blocked`. Smoke
     estÃƒÂ¡tico
     `tests/admin-disable-user-e2e-runner.smoke.js` 32/32 verde
     (4 testes novos: login bloqueado esperado, fluxo continua,
     loginExpectSuccess nos 3 logins, loginExpectFailure com
     substrings banned, loginExpectFailure retorna controle).
     RegressÃƒÂ£o `admin-disable-user.smoke.js` 39/39. **E2E real
     nÃƒÂ£o foi rerodado nesta fase** Ã¢â‚¬â€ sÃƒÂ³ apÃƒÂ³s autorizaÃƒÂ§ÃƒÂ£o do
     HMNlead. **Sem deploy, sem Supabase real, sem SQL, sem
     alteraÃƒÂ§ÃƒÂ£o de UI, sem produÃƒÂ§ÃƒÂ£o, sem origin/main, sem PR
     #2.**
 11c. **`RAVATEX-TAPETES-AUTH-DISABLE-USER-UI-A`** *(esta
     fase, repo-only)* Ã¢â‚¬â€ integraÃƒÂ§ÃƒÂ£o da tela
     `#/cadastros/usuarios` com a Edge Function
     `admin-disable-user` (jÃƒÂ¡ deployada em staging
     `ucrjtfswnfdlxwtmxnoo`). BotÃƒÂ£o `Desativar` substitui o
     placeholder `Em breve`; chama
     `window.supa.functions.invoke('admin-disable-user', {
     body: { user_id: usr.id, reason } })`; modal de
     confirmaÃƒÂ§ÃƒÂ£o com campo de motivo opcional (Ã¢â€°Â¤ 500 chars,
     default `"DesativaÃƒÂ§ÃƒÂ£o via UI"`); mapeia 8 cÃƒÂ³digos de erro
     (`FORBIDDEN`/`SELF_DISABLE_FORBIDDEN`/
     `LAST_ADMIN_FORBIDDEN`/`NOT_FOUND`/`AUTH_BAN_FAILED`/
     `COMPENSATION_FAILED`/`VALIDATION_ERROR`/`UNAUTHORIZED`)
     para mensagens PT-BR; guarda de UX para o prÃƒÂ³prio usuÃƒÂ¡rio
     logado e para usuÃƒÂ¡rios jÃƒÂ¡ inativos (proteÃƒÂ§ÃƒÂ£o visual, nÃƒÂ£o
     substitui server-side); coluna `Status` na listagem
     (`Ativo`/`Inativo`). Helper top-level
     `friendlyDisableMessage(code, fallback)` no
     `js/screens/cadastros.js`. Preserva `+ Novo usuÃƒÂ¡rio` e a
     chamada `admin-create-user`. **Sem deploy, sem Supabase
     real, sem SQL, sem produÃƒÂ§ÃƒÂ£o, sem origin/main, sem PR
     #2, sem E2E real nesta fase.** E2E real do runner jÃƒÂ¡
     havia passado em `result: PASS` em staging ANTES desta
     fase (evidÃƒÂªncia sanitizada em LEDGER Ã‚Â§5k). Smoke
     `tests/cadastros-usuarios-auth-ui.smoke.js` 23/23 verde
     (+7 testes novos para a fase UI-A: botÃƒÂ£o `Desativar`
     substitui `Em breve`, chamada `admin-disable-user` com
     payload `user_id`+`reason`, leitura de
     `error.context.json`, tratamento dos 8 cÃƒÂ³digos, guarda
     de UX para self e inativo, coluna Status, preservaÃƒÂ§ÃƒÂ£o
     de `+ Novo usuÃƒÂ¡rio` e `admin-create-user`); regressÃƒÂµes
     focais `tests/cadastros-screens.smoke.js` 32/32,
     `tests/admin-disable-user.smoke.js` 39/39,
     `tests/admin-create-user.smoke.js` 17/17,
     `tests/admin-disable-user-e2e-runner.smoke.js` 32/32 Ã¢â‚¬â€
     todas verdes.
12. **`RAVATEX-TAPETES-AUTH-DISABLE-USER-UI-A`** *(futura)* Ã¢â‚¬â€ restaurar
    botÃƒÂ£o "Desativar" na UI quando Edge Function estiver
    deployada e validada em staging.

## PossÃƒÂ­veis fases futuras opcionais (NÃƒÆ’O obrigatÃƒÂ³rias)

Estas fases **nÃƒÂ£o** fazem parte do fechamento do refactor e **nÃƒÂ£o**
sÃƒÂ£o bloqueadas pelo design Auth. SÃƒÂ£o sugestÃƒÂµes para trabalho futuro,
se houver benefÃƒÂ­cio prÃƒÂ¡tico **e** autorizaÃƒÂ§ÃƒÂ£o explÃƒÂ­cita do dono do
projeto:

- **`RAVATEX-TAPETES-OP-BLOCO-FIOS-DIAG-A`** Ã¢â‚¬â€ diagnosticar
  `buildBlocoFios` (montagem do bloco de recebimento de fios).
- **`RAVATEX-TAPETES-OP-PROPOSTA-DIAG-A`** Ã¢â‚¬â€ diagnosticar
  `buildProposta` / `recompute` / `onAceitar` (UI de proposta +
  interaÃƒÂ§ÃƒÂ£o com recÃƒÂ¡lculo).
- **`RAVATEX-TAPETES-TRANSACTION-RISK-DIAG-A`** Ã¢â‚¬â€ avaliar uso de
  RPC/transaÃƒÂ§ÃƒÂµes Supabase para `persistirOP` e `aplicarRecalculoOP`
  (risco de produto/dados, nÃƒÂ£o de refactor).

> **Nota:** `RAVATEX-TAPETES-OP-PDF-MODULE-A` foi **executada** em
> `7f3c6da`; nÃƒÂ£o estÃƒÂ¡ mais em backlog.

## ProibiÃƒÂ§ÃƒÂµes operacionais

- **NÃƒÂ£o tocar `origin/main` nem PR #2 sem autorizaÃƒÂ§ÃƒÂ£o explÃƒÂ­cita.**
- **NÃƒÂ£o mexer em `persistirOP` ou `aplicarRecalculoOP` sem fase
  especÃƒÂ­fica** (risco transacional residual, documentado em
  `PROJECT_STATE.md` e no LEDGER).
- **NÃƒÂ£o fazer docs + cÃƒÂ³digo na mesma fase.**
- **NÃƒÂ£o tratar cortes opcionais como obrigatÃƒÂ³rios** (sugestÃƒÂµes acima
  sÃƒÂ£o apenas para futuro).
- **NÃƒÂ£o iniciar nova extraÃƒÂ§ÃƒÂ£o em `op-nova.js`** (refactor
  congelado em `7f3c6da`).
- **NÃƒÂ£o remover o cache-busting `?v=20260623-asset1`** de `index.html`
  (proteÃƒÂ§ÃƒÂ£o contra navegador servindo JS antigo).
- **NÃƒÂ£o remover `getAppRoot()`** de `js/ui.js` (proteÃƒÂ§ÃƒÂ£o contra
  `replaceChildren null` no boot).

## Resumo do refactor (24 mÃƒÂ³dulos extraÃƒÂ­dos)

| # | MÃƒÂ³dulo | Commit | Fase |
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
| 24 | `js/screens/pedido-detail.js` | `7184388` + `d2b5a6a` + (commit desta fase) | RAVATEX-TAPETES-PEDIDOS-UI-ADMIN-C3A (+ C3B: aÃƒÂ§ÃƒÂµes reais de status + C3C1: Editar funcional por status) |
| 25 | `js/screens/pedido-edit.js` | `2d36077` C3C1: ediÃƒÂ§ÃƒÂ£o admin dos dados gerais do Pedido |
| 26 | `js/screens/pedido-itens-edit.js` | `acc96c3` C3C2B: ediÃƒÂ§ÃƒÂ£o admin de itens existentes (update 3 chaves) + `fd1a9a3` C3C2C1: tambÃƒÂ©m ADICIONAR novos itens (insert 5 chaves, `isNew`, `Descartar novo item`) + `bd3aedc` C3C2C2: tambÃƒÂ©m REMOVER itens existentes (delete em `pedido_itens` com `.eq('id').eq('pedido_id')`, `markedForDeletion`, `window.confirmDialog`, "Desfazer remoÃƒÂ§ÃƒÂ£o", mÃƒÂ­nimo 1) + (commit desta fase) C3C2C3: tambÃƒÂ©m NORMALIZAR `ordem` automaticamente no `salvar()` (loop `activeItems[i].ordem = i` por posiÃƒÂ§ÃƒÂ£o final; update com 4 chaves incluindo `ordem`; insert com `ordem: it.ordem`; sem drag/setas/reordenar) |

## Testes recentes (focados passando)
- `cliente-pedido-tracking.smoke.js` Ã¢â‚¬â€ novo (fase TRACKING-UI-A).
- `cliente-pedido-detail.smoke.js` Ã¢â‚¬â€ atualizado (fase TRACKING-UI-A).
- `cliente-perfil-schema.smoke.js` Ã¢â‚¬â€ 49/49
- `pedido-itens-edit.smoke.js` Ã¢â‚¬â€ 64/64
- `pedido-edit.smoke.js` Ã¢â‚¬â€ 35/35
- `pedido-detail.smoke.js` Ã¢â‚¬â€ 43/43
- `pedido-form.smoke.js` Ã¢â‚¬â€ 35/35
- `pedido-ui.test.js` Ã¢â‚¬â€ 18/18
- `pedidos-list.smoke.js` Ã¢â‚¬â€ 29/29
- `pedidos-schema.smoke.js` Ã¢â‚¬â€ 41/41
- `boot.smoke.js` Ã¢â‚¬â€ 28/28
- `router.smoke.js` Ã¢â‚¬â€ 41/41
- **Total Pedidos (C1+C2+C2-R1+C3A+C3B+C3C1+C3C2B+C3C2C1+C3C2C2+C3C2C3): 334/334** (todos os focados
  passam).

Focados do refactor (mantidos verdes):
- `op-pdf.smoke.js` Ã¢â‚¬â€ 20/20
- `op-nova.smoke.js` Ã¢â‚¬â€ 30/30
- `op-recalculo.smoke.js` Ã¢â‚¬â€ 59/59
- `op-persistir.smoke.js` Ã¢â‚¬â€ 65/65
- `op-writes.smoke.js` Ã¢â‚¬â€ 49/49
- `op-latex-admin.smoke.js` Ã¢â‚¬â€ 30/30
- `op-form-helpers.smoke.js` Ã¢â‚¬â€ 36/36
- `painel-screen.smoke.js` Ã¢â‚¬â€ 16/16
- `fornecedor-screens.smoke.js` Ã¢â‚¬â€ 35/35

PrÃƒÂ©-existentes dependentes de `http.server :8765`: 6 falhas em
`tests/index-inline.smoke.js` e 17 em `tests/write-guard.smoke.js`
Ã¢â‚¬â€ nÃƒÂ£o relacionadas ao refactor; exigem servidor local
(`.\run-local.bat` ou `python -m http.server 8765`).
Falhas prÃƒÂ©-existentes em `tests/ops-list-screen.smoke.js` (10/30)
sÃƒÂ£o de testes do refactor monolÃƒÂ­tico antigo, **fora do escopo**
da fase `RAVATEX-TAPETES-PEDIDOS-UI-ADMIN-C3A`.

## Comandos seguros por fase

```bash
# ApÃƒÂ³s mudanÃƒÂ§a em js/screens/<X>.js:
node --check js/screens/<X>.js
node --test tests/<X>.smoke.js

# ValidaÃƒÂ§ÃƒÂ£o focada de regressÃƒÂ£o completa:
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

## O que um agente NÃƒÆ’O deve fazer

- Editar `index.html`, `js/**`, `tests/**` em fase docs-only.
- Rodar `db/10_*`/`db/11_*` (resets destrutivos de produÃƒÂ§ÃƒÂ£o).
- Fazer push em `origin/main`.
- Acessar Supabase real em testes/refactors.
- Registrar `service_role`, senha, `JWT secret`, connection string
  com senha ou anon key completa em qualquer doc/relatÃƒÂ³rio.
- Mexer em `persistirOP` ou `aplicarRecalculoOP` sem nova fase
  explÃƒÂ­cita.
- Tentar mover `renderOPLatexAdmin` para outro mÃƒÂ³dulo (jÃƒÂ¡ estÃƒÂ¡
  isolada em `op-latex-admin.js`).
- Tentar mover `screenPainel` (jÃƒÂ¡ estÃƒÂ¡ isolada em `painel.js`).
- Tentar mover `gerarPdfCompraFios` (jÃƒÂ¡ estÃƒÂ¡ isolada em `op-pdf.js`).
- Rodar `git add .` (sempre stage seletivo por arquivo).
- Mexer no PR #2.
- Tratar fases opcionais (bloco fios, proposta, transaction risk)
  como obrigatÃƒÂ³rias.
- Iniciar nova extraÃƒÂ§ÃƒÂ£o em `op-nova.js` (refactor congelado).
- Remover cache-busting `?v=20260623-asset1` de `index.html`.
- Remover `getAppRoot()` de `js/ui.js`.
- Tratar `docs/superpowers/plans/*.md` como playbook executÃƒÂ¡vel
  (esses planos foram escritos para o monÃƒÂ³lito prÃƒÂ©-refactor e
  instruem a modificar `index.html` diretamente; devem ser
  adaptados ÃƒÂ  arquitetura atual antes de qualquer uso).
- Tratar `docs/qa/*.md` como especificaÃƒÂ§ÃƒÂ£o tÃƒÂ©cnica atual
  (checklists histÃƒÂ³ricos; ver `docs/qa/README.md`).
## Registro documental de schema versionado

- **Estado atual aceito:** `work/app-next` na ponta da fase
  `RAVATEX-TAPETES-CLIENTE-PARCIAIS-SCHEMA-DOCS-R1` (docs-only,
  fechamento documental). A fase
  `RAVATEX-TAPETES-CLIENTE-PARCIAIS-SCHEMA-A-R1` fica aceita com
  **ressalva documental** por registrar, apos o fato, o commit
  publicado `0a02f6a Ã¢â‚¬â€ Add pedido parciais schema`.
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

- **Estado atual aceito:** `work/app-next` na ponta da fase
  `RAVATEX-TAPETES-CLIENTE-PARCIAIS-SCHEMA-APPLY-STAGING-A`
  (aplicacao controlada em staging). O arquivo versionado
  `db/17_pedido_parciais_schema.sql` foi aplicado exatamente como
  publicado no projeto Supabase paralelo/staging
  `ucrjtfswnfdlxwtmxnoo`, via Supabase CLI/Management API, sem tocar
  producao/original `bhgifjrfagkzubpyqpew`.
- **Validacao estrutural registrada:** colunas
  `parcial_habilitado`, `parcial_atualizado_em`, `metros_total` em
  `public.pedidos`; tabelas `pedido_parciais` e
  `pedido_parcial_itens`; RLS habilitada nas duas; policies admin +
  cliente SELECT; funcoes
  `recalcular_pedido_metros_total`,
  `sincronizar_pedido_parciais_resumo`,
  `touch_pedido_parciais_updated_at`,
  `pedido_parciais_after_change`,
  `pedido_itens_sync_parciais_after_change`; triggers
  `pedido_parciais_touch_updated_at`,
  `pedido_parciais_after_change_trigger`,
  `pedido_itens_sync_parciais_after_change_trigger`; constraints
  esperadas presentes, incluindo UNIQUE
  `pedido_parcial_itens_parcial_item_key`.
- **Dados e escopo preservados:** contagens `pedido_parciais = 0` e
  `pedido_parcial_itens = 0`; nenhum dado de negocio foi inserido;
  nenhum frontend foi alterado; parciais ainda nao foram ligadas a
  tela consumidora real nesta fase.
- **Testes locais registrados:** `tests/pedido-parciais-schema.smoke.js`,
  `tests/pedido-acompanhamento-parcial.smoke.js`,
  `tests/cliente-pedidos-list.smoke.js` e
  `tests/cliente-portal-visual.smoke.js` passaram.
- **Proxima decisao recomendada:** escolher entre ativacao controlada
  da leitura parcial em detalhe/lista ou homologacao tecnica dos
  dados reais de parciais.

## Registro documental de controle admin de parciais

- **Estado atual aceito:** `work/app-next` na ponta da fase
  `RAVATEX-TAPETES-CLIENTE-PARCIAIS-ADMIN-CONTROL-A`
  (controle manual admin no detalhe do pedido, sem leitura cliente).
- **Escopo publicado:** novo modulo
  `js/screens/pedido-parciais-admin.js`, integracao em
  `js/screens/pedido-detail.js`, carregamento em `index.html` e smoke
  dedicado `tests/pedido-parciais-admin-control.smoke.js`.
- **Comportamento entregue:** admin lista parciais existentes em
  `pedido_parciais` com SELECT explicito (`id`, `pedido_id`,
  `sequencia`, `situacao`, `metros`, `data_referencia`, `titulo`,
  `mensagem_cliente`, `visivel_cliente`, `criado_em`,
  `atualizado_em`) e pode cadastrar novas parciais manuais via insert
  controlado em `pedido_parciais`, usando `origem = 'manual'`,
  `criado_por` quando `window.CURRENT_USER.id` estiver disponivel e
  `visivel_cliente` default `false`. O formulario reaproveita o
  catalogo compartilhado
  `window.RavatexPedidoTracking.CLIENTE_PARCIAL_SITUACOES` e mostra
  preview tecnico simples com `buildPedidoAcompanhamentoParcial`,
  tolerando `pedidos.metros_total` nulo.
- **Escopo preservado:** cliente ainda nao le `pedido_parciais`;
  lista/dashboard/detalhe/tracking cliente permanecem sem alteracao;
  `pedido_parcial_itens` continua fora do MVP; nenhuma policy, schema,
  SQL, Supabase apply ou producao/original foi tocado.
- **Validacao registrada:** `tests/pedido-parciais-admin-control.smoke.js`,
  `tests/pedido-parciais-schema.smoke.js`,
  `tests/pedido-acompanhamento-parcial.smoke.js`,
  `tests/cliente-pedido-detail.smoke.js`,
  `tests/cliente-pedidos-list.smoke.js` e
  `tests/cliente-dashboard.smoke.js` passaram.
- **Proxima fase recomendada:** homologacao tecnica do fluxo admin
  criando parciais reais em staging, ou leitura read-only de parciais
  no detalhe cliente depois de haver dados controlados suficientes.

## Registro documental de homologacao admin de parciais

- **Estado atual aceito:** `work/app-next` na ponta da fase
  `RAVATEX-TAPETES-CLIENTE-PARCIAIS-ADMIN-HOMOLOG-RECORD-A`
  (docs-only). Homologacao tecnica controlada da UI admin de
  parciais aprovada no HEAD `e2b8723`.
- **Ambiente homologado:** app local conectado ao Supabase staging
  `ucrjtfswnfdlxwtmxnoo`, sem tocar producao/original
  `bhgifjrfagkzubpyqpew`.
- **Pedido e parcial homologados:** pedido `#2`
  (`ee62b4aa-aa97-46b9-a44f-3b7d992dcdcb`) recebeu parcial real criada
  via UI admin, sem SQL manual, com id
  `3966fb1f-c333-4024-92f9-7fabdaa4e532`, `sequencia = 1`,
  `situacao = em_acabamento`, `metros = 2500`,
  `data_referencia = 2026-06-29`, titulo `Parcial em acabamento`,
  mensagem cliente `Parte do pedido esta em etapa de acabamento.`,
  `visivel_cliente = true`, `origem = manual`, `metadata = {}` e
  `criado_por` preenchido (valor nao registrado).
- **Validacao read-only registrada:** `pedido_parciais` gravou o
  registro corretamente; `pedidos` sincronizou
  `parcial_habilitado = true`,
  `parcial_atualizado_em = 2026-06-29T12:39:43.739178+00:00` e
  `metros_total = 10000.00`; `status` permaneceu `recebido`;
  `status_cliente_visual` permaneceu `acabamento`;
  `status_cliente_excecao` permaneceu `null`.
- **Escopo preservado:** `pedido_parcial_itens` continua fora do MVP e
  nao foi usado; cliente ainda nao le `pedido_parciais`; nenhuma tela
  cliente foi alterada; nenhum dado interno foi exposto ao cliente.
- **Restricoes preservadas:** sem schema, sem SQL, sem Supabase
  mutation adicional, sem alteracao de codigo, sem commit de frontend
  novo nesta fase docs-only.
- **Proxima fase recomendada:** leitura read-only de parciais no
  detalhe cliente.

## Registro de leitura cliente de parciais no detalhe

- **Estado atual aceito:** `work/app-next` na ponta da fase
  `RAVATEX-TAPETES-CLIENTE-PARCIAIS-CLIENTE-DETAIL-A`
  (frontend cliente read-only apenas no detalhe do pedido).
- **Escopo publicado:** `js/screens/cliente-pedido-detail.js` passou a
  ler `public.pedido_parciais` com SELECT explicito e sanitizado
  (`id`, `pedido_id`, `sequencia`, `situacao`, `metros`,
  `data_referencia`, `titulo`, `mensagem_cliente`, `criado_em`,
  `atualizado_em`), filtro por `pedido_id` e ordenacao por
  `sequencia asc`, `criado_em asc`. O render do detalhe cliente agora
  exibe a secao `Parciais do pedido`, reaproveitando
  `window.RavatexPedidoTracking.buildPedidoAcompanhamentoParcial` para
  taxonomia e labels compartilhados.
- **Escopo preservado:** leitura estritamente read-only; sem
  insert/update/delete/rpc/functions/service role; sem
  `pedido_parcial_itens`; sem alteracao em
  `js/screens/cliente-pedidos-list.js`,
  `js/screens/cliente-dashboard.js`,
  `js/screens/pedido-detail.js`,
  `js/screens/pedido-parciais-admin.js`, fornecedor, schema ou
  Supabase. Tracking, resumo, itens e timeline continuam funcionando
  mesmo se a consulta de parciais falhar, com aviso discreto.
- **Seguranca preservada:** nenhum campo interno/administrativo foi
  exposto ao cliente; fora do SELECT ficaram `metadata`, `criado_por`,
  `origem`, `observacao_admin`, `visivel_cliente`, alem de dados como
  `OP`, `lote`, `fornecedor`, `NF`, `romaneio`, `custo`, `margem` e
  `token_acesso`.
- **Validacao focada registrada:** `tests/cliente-pedido-detail.smoke.js`,
  `tests/pedido-acompanhamento-parcial.smoke.js`,
  `tests/pedido-parciais-admin-control.smoke.js`,
  `tests/cliente-pedidos-list.smoke.js` e
  `tests/cliente-dashboard.smoke.js`.
- **Proxima fase recomendada:** homologacao E2E admin -> cliente das
  parciais em staging, antes de qualquer resumo em lista/dashboard.

## Registro documental da homologacao cliente de parciais com ressalva visual

- **Estado atual aceito:** `work/app-next` na ponta da fase
  `RAVATEX-TAPETES-CLIENTE-PARCIAIS-HOMOLOG-RECORD-A`
  (docs-only). A decisao de entrada
  `RAVATEX-TAPETES-CLIENTE-PARCIAIS-E2E-HOMOLOG-R1` fica aceita como
  **APROVADA COM RESSALVA VISUAL** no HEAD `91f7159`.
- **Ambiente homologado:** app local conectado ao Supabase staging
  `ucrjtfswnfdlxwtmxnoo`, sem tocar producao/original
  `bhgifjrfagkzubpyqpew`.
- **Fluxo funcional minimo homologado:** o cliente dono do pedido `#2`
  (`ee62b4aa-aa97-46b9-a44f-3b7d992dcdcb`) visualizou no detalhe do
  proprio pedido a secao `Parciais do pedido`, com a parcial visivel
  ja homologada (`sequencia = 1`, situacao amigavel
  `Em acabamento`, `metros = 2500`, `data_referencia = 2026-06-29`,
  titulo `Parcial em acabamento`, mensagem
  `Parte do pedido esta em etapa de acabamento.`). Tracking, resumo,
  itens e timeline permaneceram operacionais no fluxo validado.
- **Seguranca funcional preservada:** a leitura cliente permaneceu
  read-only e sem exposicao de `metadata`, `criado_por`, `origem`,
  `observacao_admin`, `OP`, `lote`, `fornecedor`, `NF`, `romaneio`,
  `custo`, `margem`, `token_acesso` ou `service_role`.
- **Escopo preservado:** lista e dashboard cliente continuam sem
  resumo/bloco de parciais nesta entrega funcional minima; nenhum
  codigo, schema, SQL, Supabase mutation ou alteracao visual foi
  realizado nesta fase documental.
- **Ressalva registrada:** o acabamento visual do detalhe cliente
  ainda esta distante do HTML de referencia. Essa lacuna nao bloqueia
  a aprovacao funcional minima da leitura de parciais, mas deve seguir
  como frente separada de polish visual.
- **Proxima fase recomendada:** abrir frente dedicada de acabamento
  visual do detalhe cliente, separada da funcionalidade de parciais.

## Homologacao visual da tela Admin Nova OP

- **Estado atual aceito:** `work/app-next` no HEAD `9495918`, fase
  `RAVATEX-TAPETES-ADMIN-NOVA-OP-MATCH-STANDALONE-CLOSEOUT`. Fica
  aceita como **APROVADA** a homologacao visual da tela Admin Ã¢â€ â€™
  Nova OP, com aceite visual explicito do dono do projeto em app
  local (`run-local.bat`).
- **Escopo publicado:** `js/screens/op-nova.js` (rota `#/ops/nova` e
  edicao `#/ops/:id`) foi redesenhado para igualar ao HTML standalone
  `Admin - Nova OP - standalone.html` Ã¢â‚¬â€ header com subtitulo e botao
  Voltar, card "1. Dados da OP", card "2. Itens da OP", card
  "3. Recebimento de fios" (pendentes, recebidas, proposta por
  sliders), card "4. Entregas tecelagem", coluna lateral "Resumo da
  OP" e barra inferior informativa. Unico arquivo funcional alterado.
- **Shell preservado:** `js/screens/common.js`, `index.html`,
  sidebar e topbar nao foram tocados (shell ja homologado em
  `1afdce8`).
- **Acoes/validacoes/writes preservados:** rota, validacoes de
  numero/ano/cliente/itens/fornecedor, toasts e os call-sites de
  `window.persistirOP`, `window.aplicarRecalculoOP`,
  `window.registrarRecebimentoOrdemFio`,
  `window.atribuirFornecedorFioOp`, `window.renderOPLatexAdmin`
  permanecem identicos; nenhum payload, RPC ou query foi alterado.
- **Diferenca residual deferida:** as colunas Quantidade e
  Observacao por item, presentes no standalone, nao existem em
  `op_itens` (`db/01_schema.sql` so tem `modelo_id` e
  `metros_pedidos`) e exigiriam schema/logica nova Ã¢â‚¬â€ a tabela real
  usa apenas Modelo/Metros/Acoes; decisao de adicionar esses campos
  fica para fase futura.
- **Seguranca/escopo preservados:** nenhum schema, SQL, Supabase
  mutation, producao ou `origin/main` foi tocado nesta fase.
- **Validacao focada registrada:** `node --check js/screens/op-nova.js`,
  `tests/op-nova.smoke.js` (30/30) e `git diff --check` verdes.
  Suite opcional de nao-regressao do fluxo OP
  (`tests/op-persistir.smoke.js`, `tests/op-recalculo.smoke.js`,
  `tests/op-writes.smoke.js`, `tests/op-form-helpers.smoke.js`,
  `tests/op-pdf.smoke.js`, `tests/op-latex-admin.smoke.js`) tambem
  executada: 2 falhas pre-existentes e nao relacionadas
  (`screenPainel ... 9 itens do ADMIN_MENU`, ja presentes no HEAD
  `9495918` antes desta fase, confirmadas via `git stash`) Ã¢â‚¬â€ nao
  corrigidas por estarem fora do escopo desta fase.
- **Proxima fase recomendada:** avaliar, em frente separada, se vale
  criar campos de quantidade/observacao por item de OP (exige
  schema).

## Homologacao visual Admin Fornecedores + campos opcionais de contato

- **Estado atual aceito:** `work/app-next` na fase
  `RAVATEX-TAPETES-ADMIN-FORNECEDORES-MATCH-STANDALONE-AND-CONTACT-FIELDS-CLOSEOUT`,
  com aceite visual/funcional explicito do dono no HEAD `1fdc54b`.
- **Arquivo funcional alterado:** `js/screens/cadastros.js`.
- **Escopo homologado em Fornecedores:** a tela Admin ->
  `#/cadastros/fornecedores` ficou alinhada visualmente ao standalone
  em header, busca, tabela/card, coluna `EMAIL (opcional)`, acoes,
  modal e footer, preservando o CRUD real e as permissoes admin.
- **Campos opcionais homologados:** a migration
  `db/18_fornecedores_clientes_optional_contact_fields.sql` foi
  versionada para registrar a ampliacao de schema ja aplicada somente
  no Supabase staging `ucrjtfswnfdlxwtmxnoo`, sem tocar producao nem
  `origin/main`.
- **Campos adicionados por tabela:** `fornecedores.email`,
  `fornecedores.telefone`, `clientes.contato`,
  `clientes.telefone`.
- **Validacao funcional em staging:** Fornecedores carregou lista,
  exibiu `EMAIL (opcional)`, permitiu criar sem email/telefone,
  permitiu editar com email/telefone e manteve registros antigos sem
  quebra. Clientes carregou lista, exibiu `Contato` e `Telefone` no
  modal, permitiu criar/editar com os novos campos e manteve registros
  antigos funcionando. Registros temporarios de validacao foram
  removidos ao final.
- **Shell preservado:** sidebar, topbar e shell global permaneceram
  intactos; nao houve alteracoes em `common.js`, `index.html` ou em
  outras telas fora de `cadastros`.
- **Checks executados:** `node --check js/screens/cadastros.js`,
  `tests/cadastros-screens.smoke.js` e `git diff --check`. O smoke de
  cadastros permanece em 31/32 por uma unica falha conhecida e fora do
  escopo: `screenPainel` espera 9 itens de `ADMIN_MENU` e renderiza
  10.
- **Escopo preservado:** producao e `origin/main` nao foram tocados;
  `supabase/.temp/` permanece fora do stage/commit.

## Homologacao visual Admin Cadastros Clientes + Precos + Usuarios

- **Estado atual aceito:** `work/app-next` na fase
  `RAVATEX-TAPETES-ADMIN-CADASTROS-CLIENTES-PRECOS-USUARIOS-CLOSEOUT`,
  com aceite visual explicito do dono sobre as tres telas do pacote.
- **Arquivo funcional alterado:** `js/screens/cadastros.js`.
- **Clientes homologado:** `#/cadastros/clientes` foi alinhado ao
  padrao visual homologado de Cadastros com header, botao principal,
  busca full-width, tabela/card, footer e acoes centralizadas,
  preservando CRUD, rota, validacoes e os campos opcionais
  `contato`/`telefone`.
- **Precos homologado:** `#/cadastros/precos` foi alinhado ao mesmo
  padrao visual com busca, tabela/card, footer e acoes, preservando
  modais, validacoes e writes reais do cadastro de precos de
  terceirizadas.
- **Usuarios homologado:** `#/cadastros/usuarios` foi alinhado ao
  mesmo padrao visual com busca, toggle de inativos, tabela/card,
  badges de status e acoes administrativas, preservando rotas,
  validacoes, permissoes e os fluxos reais de editar, desativar e
  excluir usuario.
- **Shell preservado:** sidebar, topbar e shell global permaneceram
  intactos; nao houve alteracoes em `common.js`, `index.html` ou em
  outras telas fora deste pacote.
- **Checks executados:** `node --check js/screens/cadastros.js`,
  `tests/cadastros-screens.smoke.js` e `git diff --check`. O smoke de
  cadastros permaneceu em 31/32 pela unica falha conhecida e fora do
  escopo: `screenPainel` espera 9 itens de `ADMIN_MENU` e renderiza
  10.
- **Escopo preservado:** nenhum schema, SQL, Supabase, producao ou
  `origin/main` foi tocado nesta fase; `supabase/.temp/` permanece
  fora do stage/commit.

## Persistencia real de Observacoes nos Cadastros Admin

- **Estado atual aceito:** `work/app-next` na fase
  `RAVATEX-TAPETES-ADMIN-CADASTROS-MODALS-SCHEMA-PERSISTENCE-CLOSEOUT`,
  com aceite funcional do pacote de persistencia de `observacoes`.
- **Arquivo funcional alterado:** `js/screens/cadastros.js`.
- **Migration versionada:** `db/19_cadastros_observacoes.sql`.
- **Migration aplicada apenas em staging:** projeto Supabase
  `ucrjtfswnfdlxwtmxnoo`, sem tocar producao
  `bhgifjrfagkzubpyqpew`.
- **Colunas confirmadas em staging:** `cores.observacoes`,
  `clientes.observacoes`, `modelos.observacoes`,
  `fornecedores.observacoes`, `precos_terceirizada.observacoes` e
  `usuarios.observacoes`, todas `text` nullable.
- **Persistencia homologada:** `ObservaÃ§Ãµes` agora persiste de verdade
  nos 6 cadastros admin, preservando compatibilidade por
  `detectOptionalColumns` em ambientes sem a migration.
- **CRUD/payloads preservados:** os fluxos existentes foram mantidos,
  com acrescimo opcional de `observacoes`; em `Usuarios`, a criacao
  segue pela Edge Function `admin-create-user` e recebe update
  posterior de `observacoes` quando aplicavel.
- **Validacao funcional aceita:** `Cores`, `Clientes`, `Modelos` e
  `Fornecedores` passaram por criar/reload/reabrir/editar/reconfirmar
  persistencia, com remocao dos registros temporarios; `Precos` e
  `Usuarios` foram aceitos como validados manualmente pelo dono; nao
  restaram marcadores `RAVATEX_TEST%` nas 6 tabelas.
- **Decisao sobre imagem de Modelos:** nenhuma persistencia real de
  imagem foi implementada. Nao ha infraestrutura atual de Supabase
  Storage, bucket, policy, upload helper ou `imagem_url` no repo; a UI
  de preview local segue homologada e a persistencia real de imagem
  fica deferida para uma fase propria de Storage. Nao foi salvo base64
  em tabela.
- **Shell preservado:** sidebar, topbar e shell global permaneceram
  intactos; nao houve alteracoes em `common.js`, `index.html` ou em
  outras telas fora de `cadastros`.
- **Checks executados:** `node --check js/screens/cadastros.js`,
  `tests/cadastros-screens.smoke.js` e `git diff --check`. O smoke de
  cadastros permaneceu em 31/32 pela unica falha conhecida e fora do
  escopo: `screenPainel` espera 9 itens de `ADMIN_MENU` e renderiza
  10.
- **Escopo preservado:** producao e `origin/main` permaneceram
  intocados; `supabase/.temp/` segue fora do stage/commit.

## Homologacao visual Admin Cadastros Modais

- **Estado atual aceito:** `work/app-next` na fase
  `RAVATEX-TAPETES-ADMIN-CADASTROS-MODALS-VISUAL-FINALIZE-A`, com
  aceite visual explicito do dono para os modais de Cadastros Admin.
- **Arquivo funcional alterado:** `js/screens/cadastros.js`.
- **Escopo homologado:** modais novo/editar de `Cores`, `Clientes`,
  `Modelos`, `Fornecedores`, `Precos` e `Usuarios` foram alinhados ao
  mesmo padrao visual homologado de Cadastros, com header, overlay,
  campos, footer, botoes, radius e espacamento consistentes.
- **Helpers preservados e limpos:** os helpers visuais de modal
  permaneceram no arquivo e a fase removeu duplicacoes, funcoes mortas
  e blocos intermediarios, deixando uma unica implementacao final de
  `openModal` por tela.
- **Observacoes mantido:** o ultimo campo visual `ObservaÃ§Ãµes` foi
  mantido nos modais ajustados, sem alterar payloads persistidos nesta
  fase.
- **Modelos preservado:** a area de imagem/preview visual de
  `Modelos` foi mantida no modal, junto com o layout ajustado para os
  campos de cor e largura.
- **Precos limpo:** a sobra intermediaria do modal de `Precos` foi
  removida e ficou apenas uma construcao final legivel do body, no
  layout homologado de duas linhas.
- **Funcionalidade preservada:** CRUD anterior, payloads existentes,
  validacoes e permissoes admin dos campos ja persistidos permaneceram
  intactos; nao houve alteracao de schema, SQL, Supabase nem regras de
  negocio.
- **Shell preservado:** sidebar, topbar e shell global permaneceram
  intactos; nao houve alteracoes em `common.js`, `index.html` ou em
  telas fora de `cadastros`.
- **Checks executados:** `node --check js/screens/cadastros.js`,
  `tests/cadastros-screens.smoke.js` e `git diff --check`. O smoke de
  cadastros permaneceu em 31/32 pela unica falha conhecida e fora do
  escopo: `screenPainel` espera 9 itens de `ADMIN_MENU` e renderiza
  10.
- **Escopo preservado:** nenhum schema, SQL, Supabase, producao ou
  `origin/main` foi tocado nesta fase; `supabase/.temp/` permanece
  fora do stage/commit.

## Homologacao visual Admin Modelos

- **Estado atual aceito:** `work/app-next` na fase
  `RAVATEX-TAPETES-ADMIN-MODELOS-MATCH-STANDALONE-CLOSEOUT`, com
  aceite visual explicito do dono para `#/cadastros/modelos`.
- **Arquivo funcional alterado:** `js/screens/cadastros.js`.
- **Modelos homologado:** a tela foi alinhada ao padrao visual
  homologado de Cadastros com header, botao principal, busca
  full-width, card/tabela e footer.
- **Preview sintetico registrado:** cada modelo agora exibe preview
  sintetico construido a partir de `cor_1`, `cor_2`, `largura` e
  nome, sem uso de imagem real, storage ou alteracao de schema.
- **Representacao visual homologada:** nome como coluna principal com
  ID secundario, swatches lado a lado para `cor_1`/`cor_2` e acoes com
  icones `SquarePen` e `Trash`.
- **CRUD e regras preservados:** carregamento real, criacao, edicao,
  exclusao, payloads, validacoes, permissoes admin e schema atual
  permaneceram intactos.
- **Correcao runtime registrada:** Modelos passou a abrir normalmente
  com helper local de swatch, sem depender do escopo de Cores.
- **Hotfix visual em Usuarios:** o icone de excluir foi mantido em
  vermelho, com botao neutro, sem alterar fluxos administrativos.
- **Shell preservado:** sidebar, topbar e shell global permaneceram
  intactos; nao houve alteracoes em `common.js`, `index.html` ou em
  qualquer arquivo fora do escopo.
- **Checks executados:** `node --check js/screens/cadastros.js`,
  `tests/cadastros-screens.smoke.js` e `git diff --check`. O smoke de
  cadastros permaneceu em 31/32 pela unica falha conhecida e fora do
  escopo: `screenPainel` espera 9 itens de `ADMIN_MENU` e renderiza
  10.
- **Escopo preservado:** nenhum schema, SQL, Supabase, producao ou
  `origin/main` foi tocado nesta fase; `supabase/.temp/` permanece
  fora do stage/commit.
## Fechamento R1 do Detalhe do Pedido + Cleanup B da Lista Admin

- **Estado atual pos-R1 + Cleanup B:** branch `work/app-next`,
  commit HEAD atual (patch `RAVATEX-TAPETES-PEDIDOS-LIST-ADMIN-VISUAL-CLEANUP-B`
  aplicado sobre `e88b218`).
- **Refatoracao modular do Detalhe concluida (R1):** o antigo monolito de
  `js/screens/pedido-detail.js` foi extraido para
  `js/screens/pedido-detail.js`,
  `js/screens/pedido-detail-data.js`,
  `js/screens/pedido-detail-render.js`,
  `js/screens/pedido-detail-progress.js` e
  `js/screens/pedido-detail-events.js`, preservando o visual/fluxo do
  standalone e mantendo `index.html` apenas como loader dos modulos.
- **Residual da lista admin resolvido (Cleanup B):**
  `js/screens/pedidos-list.js` recebeu patch proprio com extracao de
  constantes, refatoracao de estado visivel e ajustes visuais da lista
  admin `#/pedidos`.
- **Validacao registrada:** testes focados do pacote Detail R1 fecharam
  em `177/177`; `tests/pedidos-list.smoke.js` verde.
- **Residual restante:** `supabase/.temp/` continua fora do stage/commit.
- **Proximo passo recomendado:** Modal Movimentar Producao, somente
  com worktree limpo exceto `supabase/.temp/`.

## Closeout do Modal Movimentar Producao B

- **Estado atual aceito:** branch `work/app-next`, fase
  `RAVATEX-TAPETES-MOVIMENTAR-PRODUCAO-MODAL-B`, validada sobre o HEAD
  base `583f90a`.
- **Arquivos alterados nesta fase:** `js/screens/pedido-detail-events.js`
  e `tests/pedido-detail.smoke.js`.
- **Entrega publicada nesta fase:** o Detalhe do Pedido passou a abrir
  um modal de Movimentar Producao **pre-carregado e readonly** a partir
  dos atalhos `Transferir`/`Movimentar`, com origem, destino, OP de
  origem, itens envolvidos, saldo/restante calculado, documentos
  esperados e CTA para abrir a OP de origem.
- **Regra preservada:** o Pedido continua sendo apenas **visao
  consolidada**. A movimentacao canonica continua na OP/cadeia
  produtiva; o modal nao cria lancamento paralelo no Pedido nem estado
  concorrente.
- **Escopo explicitamente preservado:** nenhuma gravacao operacional foi
  implementada; nao houve chamadas a `salvarEntregaCima`,
  `salvarEntregaLatex`, `gerar_op_latex` ou `alterar_status_op`; nenhum
  SQL/schema/OP lifecycle/Supabase/producao foi tocado.
- **Validacao registrada:** `node --check
  js/screens/pedido-detail-events.js`, `node --test
  tests/pedido-detail.smoke.js` e o pacote de closeout
  `node --test tests/pedido-detail.smoke.js tests/pedido-edit.smoke.js
  tests/pedido-itens-edit.smoke.js
  tests/admin-pedido-tracking-control.smoke.js
  tests/pedido-parciais-admin-control.smoke.js`, com
  `pedido-detail.smoke.js` em `46/46` e o agregado em `180/180`.
- **Residual preservado:** `?? supabase/.temp/` permanece fora do
  stage/commit.
- **Proximo passo recomendado:** abrir a frente de telas de OP,
  comecando por **OP Aberta** baseada em **Admin -> Nova OP**, para
  levar a movimentacao canonica ao fluxo operacional proprio da OP.
