# PROJECT_STATE.md — Controle de Tapetes (Grupo Terra Branca)

> **Atualizacao 2026-06-30 — fase
> `RAVATEX-TAPETES-ADMIN-OPS-LIST-MATCH-STANDALONE-CLOSEOUT`
> (frontend admin + registro de homologacao visual).** O miolo da
> tela **Admin → Lista de OPs** (`#/ops`) foi **alinhado visualmente
> ao HTML standalone de referencia** (`Admin - Lista de OPs -
> standalone.html`, em
> `D:\OneDrive\Ravatex\Inttex\Mockups - nova interface\Admin\`) pelo
> agente IAexec (Codex), e o aceite visual foi **APROVADO
> EXPLICITAMENTE PELO DONO DO PROJETO em 2026-06-30**. Branch:
> `work/app-next`. HEAD base da fase: `82d0871`. `origin/main` e a
> producao `bhgifjrfagkzubpyqpew` permaneceram intocados. Arquivo
> funcional principal alterado: `js/screens/ops-list.js`. Microfix
> pontual no shell global em `js/screens/common.js`, limitado a
> derivacao das iniciais do avatar para eliminar o bug visual `A(` no
> admin. Elementos entregues e homologados: header com titulo
> "Ordens de Produção" + subtitulo + botao "Nova OP" sem `+` textual
> duplicado; 4 KPI cards corretos (Total / Em produção / Simuladas /
> Abertas); busca com icone inline; tabs `Todas / Tecelagem / Látex`;
> linha de filtros com dropdowns `Cliente / Todos os clientes`,
> `Status / Todos` e `Criada em / Todos os períodos`; tabela 7
> colunas (`OP / LOTE`, `TIPO`, `CLIENTE`, `STATUS`, `ENTREGUE`,
> `CRIADA EM`, `AÇÕES`) com label de `AÇÕES` centralizado, badges,
> progresso entregue, acoes centralizadas na celula e paginacao.
> Shell/sidebar/topbar globais preservados, exceto a correcao
> pontual das iniciais do avatar; rota `#/ops`, navegacao para
> detalhe/novo, acoes e permissoes admin preservadas. Regra de acao
> preservada: `OP simulada → Editar`; demais OPs → `Visualizar`; botao
> `Mais` mantido apenas visual/disabled. Diferencas residuais
> documentadas: contagens/KPIs/linhas continuam dinamicos conforme
> dados reais; o filtro `Cliente` e derivado dos clientes realmente
> presentes na lista; progresso `Entregue` segue calculado via
> `percentualEntregueOP(...)` sobre `op_itens` + `entrega_itens`,
> sem inventar regra nova. Checks executados:
> `node --check js/screens/ops-list.js`,
> `node --check js/screens/common.js`,
> `git diff --check`. O teste focado
> `node --test tests/ops-list-screen.smoke.js` permanece
> **desatualizado** nesta branch por blocos estaticos antigos
> pre-`boot.js`/pre-querystring em `index.html`; as falhas restantes
> foram registradas, sem deformar o visual homologado para fazer o
> teste legado passar. Nenhum schema, SQL, mutation Supabase ou fluxo
> de producao foi tocado.

> **Atualizacao 2026-06-30 — fase
> `RAVATEX-TAPETES-ADMIN-PEDIDOS-LIST-MATCH-STANDALONE-CLOSEOUT`
> (frontend admin + registro de homologacao visual).** O miolo da
> tela **Admin → Lista de pedidos** (`#/pedidos`) foi **alinhado
> visualmente ao HTML standalone de referencia** (`Admin - Lista de
> Pedidos - standalone.html`, em
> `D:\OneDrive\Ravatex\Inttex\Mockups - nova interface\Admin\`) pelo
> agente IAexec (Codex), e o aceite visual foi **APROVADO
> EXPLICITAMENTE PELO DONO DO PROJETO em 2026-06-30**. Branch:
> `work/app-next`. HEAD base da fase: `2da8b1c`. `origin/main` e a
> producao `bhgifjrfagkzubpyqpew` permaneceram intocados. Arquivo
> funcional alterado: `js/screens/pedidos-list.js` (unico). Elementos
> entregues e homologados: header com titulo "Pedidos" + subtitulo +
> botao "Novo pedido"; 5 KPI cards (Abertos / Em producao / Parciais /
> Atrasados / Prontos); busca com icone inline; tabs com badge de
> contagem (Todos / Rascunho / Recebido / Confirmado / Producao /
> Parcial / Pronto / Entregue / Cancelado); linha de filtros; tabela
> de 9 colunas (Pedido / Cliente / Sit. interna / Visivel ao cliente /
> Parcial / Prazo / Recebimento / Atualizado / Acoes) com badges,
> acao real "Visualizar" e paginacao. Shell/sidebar/topbar globais
> preservados (`js/screens/common.js` e `index.html` intocados); rota
> `#/pedidos`, acoes e permissoes admin preservadas. Coluna `Parcial`
> ligada a dados reais seguros via leitura read-only de `pedido_itens`
> e `pedido_parciais`, reaproveitando
> `buildPedidoAcompanhamentoParcial(..., { forCliente: false })` para
> taxonomia/contagem sem inventar regra nova. O menu de "mais acoes"
> foi mantido apenas visual/disabled porque a unica acao real
> existente segue sendo `Visualizar`. Diferencas residuais
> documentadas: contagens/KPIs/linhas sao dinamicos conforme dados
> reais (nao os literais fixos do mockup); `tipo_recebimento` segue em
> fallback seguro "—" quando ausente; "Visivel ao cliente" usa a
> taxonomia compartilhada publicada em `status_cliente_visual` /
> `status_cliente_excecao`, por isso pode divergir do texto decorativo
> do standalone. Checks executados e verdes:
> `node --check js/screens/pedidos-list.js`,
> `node --test tests/pedidos-list.smoke.js`,
> `git diff --check`. Nenhum schema, SQL, mutation Supabase ou fluxo
> de producao foi tocado.

> **Atualizacao 2026-06-30 — fase
> `RAVATEX-TAPETES-CLIENTE-PEDIDOS-LIST-MATCH-STANDALONE-CLAUDE-R1`
> (frontend cliente + registro de homologacao visual).** O miolo da
> tela "Meus pedidos" do Cliente (`#/cliente/pedidos`) foi **alinhado
> visualmente ao HTML standalone de referencia** (`Cliente - Lista de
> Pedidos - standalone.html`, em
> `D:\OneDrive\Ravatex\Inttex\Mockups - nova interface\Cliente\`) pelo
> agente IAexec (Claude Sonnet 4.6), e o aceite visual foi **APROVADO
> EXPLICITAMENTE PELO DONO DO PROJETO em 2026-06-30**. Um patch
> anterior do agente GLM/ZCode para esta mesma tela **nao foi aceito**
> (busca sem icone dentro de card indevido, texto do botao trocado por
> causa de teste, icones de acao invisiveis) e foi descartado via
> `git restore` antes desta implementacao final — nada daquele patch
> foi reaproveitado. Branch: `work/app-next`. Pushed para
> `staging/main`. Producao `bhgifjrfagkzubpyqpew` e `origin/main` nao
> foram tocados. Arquivo alterado: `js/screens/cliente-pedidos-list.js`
> (unico). Elementos entregues e homologados: header com titulo "Meus
> Pedidos" + subtitulo + botao "Solicitar pedido" com icone "+"; busca
> com icone de lupa na mesma caixa (sem card duplicado) + 5 tabs com
> badge de contagem (Todos / Em producao / Pronto p/ expedicao /
> Entregue / Cancelado); tabela de 7 colunas (Pedido / Situacao /
> Avanco / Prazo / Recebimento / Atualizado / Acao) com pill de
> situacao, avanco "Parcial · X / Y m" ou "Total · Y m" e botao olho
> visivel/funcional para o detalhe; rodape de paginacao "Mostrando X a
> Y de Z pedidos". Parciais preservadas via
> `buildPedidoAcompanhamentoParcial(..., { forCliente: true })` (mesma
> API ja homologada no dashboard/detalhe), com SELECTs adicionais em
> `pedido_itens`/`pedido_parciais` (mesmas colunas seguras ja usadas
> alhures). Shell/sidebar/topbar globais preservados (miolo entregue a
> `clienteShellLayout`). SELECT de `pedidos` mantido **identico** ao
> contrato ja travado pelos testes (nenhum campo novo, nenhum campo
> interno). Diferencas visuais residuais documentadas: botao usa o
> texto do standalone "Solicitar pedido" em vez do literal "+ Novo
> pedido" exigido por um guard de teste desatualizado (teste falha,
> reportado, nao corrigido para nao deformar o visual); coluna
> "Recebimento" exibe fallback seguro "—" (campo `tipo_recebimento` ja
> existe no schema mas esta fora do contrato de SELECT travado e nao e
> capturado hoje na criacao do pedido); rotulos de situacao usam a
> taxonomia compartilhada (`getClienteTrackingStatusLabel`), por isso
> "Expedicao"/"Acabamento"/"Aguardando definicao" em vez do texto
> decorativo do mockup. Checks: `node --check` OK; `git diff --check`
> OK; `cliente-pedidos-list.smoke.js` 35/36 (1 falha esperada, ver
> acima); `cliente-routing.smoke.js` 19/19; `cliente-portal-visual
> .smoke.js` 44/5 (4 falhas identicas ao HEAD limpo + 1 nova esperada
> por usar a mesma convencao `svgEl` via `innerHTML` ja homologada em
> dashboard/detail/tracking — zero regressao alem do esperado).
> Producao permanece bloqueada.

> **Atualizacao 2026-06-30 — fase
> `RAVATEX-TAPETES-STANDARD-SHELL-SIDEBAR-TOPSTRIP-A`
> (frontend global + registro de homologacao visual).** O chrome global
> (topbar 62px + sidebar 196px) compartilhado por todas as areas
> (Admin, Fornecedor, Cliente) foi **alinhado visualmente aos HTMLs
> standalone de referencia** (`Admin - Topbar - standalone.html` e
> `Admin - Sidebar - standalone.html`, em
> `D:\OneDrive\Ravatex\Inttex\Mockups - nova interface\`) pelo agente
> IAexec (GLM-5.2/ZCode), e o aceite visual foi **APROVADO
> EXPLICITAMENTE PELO DONO DO PROJETO em 2026-06-30** (apos hard-refresh
> para descartar cache do navegador). Implementacao unica no ponto
> central `shellLayout(menuItems, contentNode)` em
> `js/screens/common.js` — propaga para ~25 telas admin/fornecedor e,
> via `clienteShellLayout`, para todas as telas cliente, sem duplicacao.
> Branch: `work/app-next`. Pushed para `staging/main`. Producao
> `bhgifjrfagkzubpyqpew` e `origin/main` nao foram tocados. Arquivos
> alterados: `js/screens/common.js` (chrome em inline styles pixel-exatos
> — mesma convencao das telas cliente homologadas, sem dependencia de
> classes Tailwind arbitrary do CDN) e `index.html` (apenas bump do
> cache-busting `?v=` do `common.js` de `20260623-asset1` para
> `20260630-shell1`). Elementos entregues e homologados: topbar com
> brand "Inttex" + divisor + sectionLabel por perfil (Admin / Portal do
> cliente / Fornecedor) + sino + avatar circular azul com iniciais do
> usuario + nome + chevron; sidebar com nav-items iconizados (SVG
> 17x17 por href), estado ativo derivado do `window.location.hash`
> (novo — antes nao havia destaque de item selecionado), hover via JS,
> separador e item "Sair" no rodape. Parametrizacao por perfil via
> `menuItems` (ja vinha por parametro), `sectionLabel` por
> `CURRENT_USER.tipo` e icones por mapa de href. Preservado: estrutura
> DOM (header + div > aside + main), `<span>` "nome (tipo)" e
> `<button>` "Sair" no header (escondidos) para compatibilidade dos
> smoke tests, `<main class="flex-1 p-6 bg-gray-100">` herdado pelas
> telas. Menus/rotas/permissoes de cada perfil intactos (cliente sem
> itens admin; admin sem itens cliente). Miolos das paginas nao
> redesenhados. Diferenca visual residual: avatares usam iniciais do
> nome (sem foto — CURRENT_USER nao tem URL de imagem); fornecedor usa
> rotas proprias `#/fornecedor/*`. Checks: `node --check` OK;
> `git diff --check` OK; `screens-common.smoke.js` 13/10 (idem HEAD
> limpo, zero regressao — as 10 falhas sao pre-existentes, todas por
> `extractInlineScript` nao achar inline no `index.html` migrado para
> `boot.js`); `cliente-routing.smoke.js` 19/19; `cliente-portal-visual
> .smoke.js` 45/4 (idem HEAD limpo). Gap do Shell marcado como
> resolvido em `docs/ui/CLIENTE_PORTAL_UI_GAP_INVENTORY.md`. Producao
> permanece bloqueada.

> **Atualizacao 2026-06-29 — fase
> `RAVATEX-TAPETES-CLIENTE-DASHBOARD-MATCH-STANDALONE-GLM`
> (frontend cliente + registro de homologacao visual).** O miolo da
> tela Dashboard do Cliente (`#/cliente/dashboard`) foi **alinhado
> visualmente ao HTML standalone de referencia** (`Dashboard Cliente
> v3 - standalone.html`, em
> `D:\OneDrive\Ravatex\Inttex\Mockups - nova interface\Cliente\`) pelo
> agente IAexec (GLM-5.2/ZCode), e o aceite visual foi **APROVADO
> EXPLICITAMENTE PELO DONO DO PROJETO em 2026-06-29** (apos ajuste
> R1: remocao da coluna "Resumo" da tabela "Pedidos em destaque" e
> correcao de largura/alinhamento do card "Resumo dos pedidos").
> Branch: `work/app-next`. Pushed para `staging/main`. Producao
> `bhgifjrfagkzubpyqpew` e `origin/main` nao foram tocados.
> Arquivo alterado: `js/screens/cliente-dashboard.js` (unico).
> Elementos entregues e homologados: header com titulo "Dashboard" +
> subtitulo + botao "Novo pedido"; 4 KPI cards (Meus pedidos / Em
> producao / Concluido / Atrasado) com icone em circulo colorido;
> "Pedidos em destaque" como tabela 6 colunas (Pedido · Situacao ·
> Avanco · Atualizado · Prazo previsto · Acao) com badge de situacao,
> avanco "Parcial · X / Y m" ou "Total · Y m" e botao olho para o
> detalhe; "Resumo dos pedidos" com donut SVG (em producao/concluido/
> atrasado/rascunho) + legenda com percentual e total; "Ultimas
> atualizacoes" e "Prazos proximos" na linha de baixo. Parciais
> preservadas no dashboard via dados seguros
> (`buildPedidoAcompanhamentoParcial`, mesma API homologada no
> detalhe). Shell/sidebar/topbar globais preservados (miolo entregue
> a `clienteShellLayout`/`shellLayout`, sem chrome proprio).
> Convencoes visuais herdadas das telas cliente homologadas (inline
> styles pixel-exatos). Valores dinamicos a partir dos pedidos/eventos
> reais do cliente. Diferencas visuais residuais documentadas: os
> numeros (KPIs, donut, destaque, prazos) sao dinamicos (nao os
> literais do mockup); itens de sidebar do standalone pertencem ao
> shell global; "Rascunho" do donut agrega os estados recebido/
> confirmado/insumos/aguardando. Checks: `node --check` OK;
> `git diff --check` OK. Gap do Dashboard marcado como resolvido em
> `docs/ui/CLIENTE_PORTAL_UI_GAP_INVENTORY.md`. Producao permanece
> bloqueada.

> **Atualizacao 2026-06-29 — fase
> `RAVATEX-TAPETES-UI-MATCH-STANDALONE-NOVO-PEDIDO-ADD-ITEM-MODAL`
> (frontend cliente + registro de homologacao visual).** O modal
> **"Adicionar item"** da tela Novo Pedido (`#/cliente/pedidos/novo`)
> foi **alinhado visualmente ao HTML standalone de referencia**
> (`Modal Adicionar Item - standalone.html`, em
> `D:\OneDrive\Ravatex\Inttex\Mockups - nova interface\`) pelo agente
> IAexec (Claude Sonnet 4.6), e o aceite visual foi **APROVADO
> EXPLICITAMENTE PELO DONO DO PROJETO em 2026-06-29**.
> Branch: `work/app-next`. Pushed para `staging/main`. Producao
> `bhgifjrfagkzubpyqpew` e `origin/main` nao foram tocados.
> Arquivo alterado: `js/screens/cliente-pedido-form.js` (unico).
> Elementos entregues e homologados: overlay com backdrop escurecido;
> card branco 460px com radius/shadow; header com titulo + subtitulo
> + botao fechar; campo Modelo (select real, estilizado como o
> falso-select do standalone); Cor 1/Cor 2 derivadas do modelo
> selecionado (caixas estaticas somente leitura — override por item
> deferido para fase futura); Largura derivada (caixa estatica) +
> Metragem (input numerico) em grid 2 colunas; "Referencia visual"
> decorativa (gradiente/circulo/borda tracejada, sem dado real
> associado); Observacao do item (textarea com contador "0/200");
> footer Cancelar/Adicionar item. Funcionalidades preservadas:
> abertura do modal via clique em "Adicionar item", inclusao real do
> item em `state.itens` (refletido no INSERT de `pedido_itens` ao
> finalizar), validacoes de modelo obrigatorio e metragem > 0,
> fechamento via botao fechar/Cancelar/clique fora/Esc. Diferencas
> visuais residuais documentadas: campo Metragem usa `type="number"`
> (nao `type="text"` como no standalone, para preservar a validacao
> numerica existente) e o placeholder de Observacao foi adaptado para
> nao referenciar o termo interno "lote" (guard de teste existente).
> Checks: `node --check` OK; `node --test` do smoke focado 35/36
> (1 falha pre-existente, nao relacionada, sobre divergencia de texto
> "metros"/"metragem" na validacao de `salvar()`). Gap do Modal
> Adicionar Item marcado como resolvido em
> `docs/ui/CLIENTE_PORTAL_UI_GAP_INVENTORY.md`. Dashboard nao foi
> tocado nesta fase. Producao permanece bloqueada.

> **Atualizacao 2026-06-29 — fase
> `RAVATEX-TAPETES-UI-MATCH-STANDALONE-NOVO-PEDIDO`
> (frontend cliente + registro de homologacao visual).** A tela
> **Novo Pedido** (`#/cliente/pedidos/novo`) foi **alinhada
> visualmente ao HTML standalone de referencia**
> (`Novo Pedido - standalone.html`, em
> `D:\OneDrive\Ravatex\Inttex\Mockups - nova interface\`) pelo agente
> IAexec (Claude Sonnet 4.6), e o aceite visual foi **APROVADO
> EXPLICITAMENTE PELO DONO DO PROJETO em 2026-06-29**.
> Branch: `work/app-next`. Pushed para `staging/main`. Producao
> `bhgifjrfagkzubpyqpew` e `origin/main` nao foram tocados.
> Arquivo alterado: `js/screens/cliente-pedido-form.js` (unico).
> Elementos entregues e homologados: header com botao back (36x36,
> arrow SVG) + titulo "Novo pedido" (23px, 800) + subtitulo +
> botao "Cancelar"; card "Dados gerais" grid 3 cols
> (Referencia do cliente | Prazo desejado com icone calendario |
> Recebimento select); card "Itens do pedido" tabela colunas
> `60px 1.1fr 1.1fr .8fr 1.1fr 1.2fr 84px`
> (Img | Modelo | Cores | Largura | Metragem | Obs | Acoes),
> swatch placeholder, selects de modelo, inputs inline editaveis,
> icones lapis/lixeira; rodape da tabela com
> "Total de itens: N | Metragem total: X m"; secao bottom
> grid 3fr/1fr com "Instrucoes gerais" (textarea 1 linha,
> auto-extensivel, overflow-y:hidden) + "Ir para checkout" +
> "Finalizar pedido" (azul); align-items:stretch nos dois cards.
> Funcionalidades preservadas: criacao de pedido
> (INSERT `pedidos` + `pedido_itens`), compensacao em falha,
> validacoes, toast, navegacao pos-save. Campos internos nao
> expostos: OP, lote, fornecedor, NF, romaneio, custo, margem,
> observacao_admin, token_acesso, service_role. Campos de UI
> `referencia` e `recebimento` exibidos mas NAO enviados ao DB
> (sem coluna em schema). Checks: `node --check` OK.
> Gap do Novo Pedido marcado como resolvido em
> `docs/ui/CLIENTE_PORTAL_UI_GAP_INVENTORY.md`.
> Modal "Adicionar item" permanece para fase posterior.
> Producao permanece bloqueada.

> **Atualizacao 2026-06-29 — fase
> `RAVATEX-TAPETES-CLIENTE-DETAIL-VISUAL-HOMOLOG-RECORD-A`
> (docs-only, registro de homologacao visual — sem codigo, sem schema,
> sem SQL, sem Supabase).** A tela de **Detalhe do Pedido Cliente**
> (`#/cliente/pedidos/<uuid>`) foi **alinhada visualmente ao HTML
> standalone de referencia** (`Detalhe do Pedido v2 - standalone.html`,
> fora do repo em
> `D:\OneDrive\Ravatex\Inttex\Mockups - nova interface\`) pelo agente
> IAexec (Claude Sonnet 4.6), e o aceite visual foi **APROVADO
> EXPLICITAMENTE PELO DONO DO PROJETO em 2026-06-29**. HEAD do commit:
> `8650bb5` ("Match cliente pedido detail to standalone reference"),
> branch `work/app-next`, pushed para `staging/main`. Producao/original
> `bhgifjrfagkzubpyqpew` e `origin/main` nao foram tocados. Elementos
> entregues e homologados: breadcrumb + titulo inline + badge de status;
> meta card 3 colunas; stepper 42px com conic-gradient two-tone
> (`#2563eb` preenchido / `#dbeafe` vazio), check SVG nos concluidos,
> wrapper ambar para excecao; preview de item com textura preservada;
> distribuicao com barras coloridas; parciais em tabela 4 colunas;
> historico com timeline vertical flat. Seguranca preservada: nenhum
> campo interno exposto; tela permanece 100% read-only; RLS intocada;
> dashboard/lista/admin nao alterados. Testes: 92/92 pass
> (59 detail + 11 parcial + 22 tracking). Gap do Detalhe marcado como
> resolvido em `docs/ui/CLIENTE_PORTAL_UI_GAP_INVENTORY.md`. Producao
> permanece bloqueada. Esta fase e docs-only. Proxima etapa: avaliar
> demais gaps do inventario (dashboard, novo pedido, shell), com
> decisoes `OP-001` a `OP-012` respondidas antes de nova UI.

> **Atualizacao 2026-06-29 — fase
> `RAVATEX-TAPETES-CLIENTE-PORTAL-UI-OPERATIONS-RULES-A` (docs-only,
> matriz operacional de decisoes para UI).** Criado
> `docs/ui/CLIENTE_PORTAL_UI_OPERATIONS_RULES.md` como matriz objetiva
> para orientar a proxima rodada de UI do Portal Cliente B2B **sem
> implementar nada**. O documento consolida as decisoes ja fechadas
> (cliente nao ve OP/lote/fornecedor/NF-romaneio/custo-margem/
> metadata; portal cliente segue read-only exceto criacao de pedido;
> status operacional separado do status visual; admin publica status
> visual; timeline cliente le apenas eventos visiveis; producao segue
> bloqueada) e registra como **pendentes do dono do projeto** as
> decisoes `OP-001` a `OP-012`: fluxo de novo pedido (1 etapa vs 2
> etapas), inline vs modal para item, campos obrigatorios por item,
> uso de `tipo_recebimento`, uso de `referencia_cliente`, separacao
> `prazo_desejado` vs `prazo_entrega`, exibicao ou nao do status
> operacional no detalhe cliente, acoes rapidas no dashboard,
> composicao do menu cliente, existencia de Suporte, upload de imagem
> por item e possibilidade futura de edicao/cancelamento pelo cliente.
> A UI continua **funcional, porem NAO final**. A proxima etapa
> recomendada agora e **o dono do projeto responder OP-001 a OP-012
> antes de qualquer implementacao de UI**; so depois devem entrar as
> fases `UI-GAP-FIX-NOVO-PEDIDO-A`, `UI-GAP-FIX-MODAL-ITEM-A`,
> `UI-GAP-FIX-DETALHE-A`, `UI-GAP-FIX-DASHBOARD-A` e por ultimo
> `UI-GAP-FIX-SHELL-A` (devido ao risco cross-role do
> `shellLayout`). **Producao permanece BLOQUEADA**; sem codigo, sem
> schema, sem SQL, sem Supabase, sem Edge Function, sem testes de app
> (apenas verificacao Git/diff). Senha, token e credenciais nao foram
> registrados. Documento indexado em `docs/DOCUMENTATION_INDEX.md`
> §1b como diagnostico/operacional nao-canonico.
> **Atualizacao 2026-06-28 — fase
> `RAVATEX-TAPETES-CLIENTE-PORTAL-UI-GAP-INVENTORY-A` (docs-only,
> inventario de gaps de UI, read-only/diagnostico).** Concluido o
> **inventario de divergencias entre os mockups aprovados pelo dono do
> projeto e a implementacao atual do Portal Cliente B2B**, registrado
> em `docs/ui/CLIENTE_PORTAL_UI_GAP_INVENTORY.md`. Mockups usados (5,
> localizados em `D:\OneDrive\Ravatex\Inttex\Mockups - nova interface\`,
> fora do repo): Dashboard Cliente, Novo Pedido, Modal Adicionar Item,
> Detalhe do Pedido, Admin-Cliente-Acompanhamento B2B (cobre
> stepper/timeline cliente + taxonomia). Nenhum mockup ausente.
> Comparadas as 6 unidades pedidas: Dashboard Cliente; Novo Pedido;
> Modal Adicionar Item; Detalhe do Pedido; Acompanhamento/Stepper/
> Timeline; Shell/Menu cliente. **A UI permanece FUNCIONAL, porem NAO
> final** — o inventario documenta gaps reais (KPIs do dashboard com
> semantica diferente; fluxo de novo pedido em 1 etapa inline em vez
> de tabela+modal+checkout em 2 etapas; ausencia de campos
> referencia_cliente/tipo_recebimento/Cor1/Cor2/Largura na criacao
> apesar de ja existirem no schema (`db/15_status_cliente_visual.sql`);
> exibicao simultanea do status operacional e do status visual no
> detalhe; ausencia de datas por etapa no stepper; shell/menu cliente
> com 2 itens em vez de 4 e sem identidade visual propria, usando
> `shellLayout` compartilhado com admin/fornecedor — risco alto para
> qualquer correcao futura). **Pendencias operacionais explicitamente
> registradas como TBD** (sem inventar regra): tipo de retirada/
> entrega obrigatorio ou nao; fluxo de revisao/checkout antes de
> finalizar pedido; manter ou nao o status operacional visivel ao
> cliente no detalhe; campos obrigatorios do formulario; regras
> futuras de edicao/cancelamento pelo cliente. Proxima fase
> recomendada: priorizar `UI-OPERATIONS-RULES-A` (docs-only, decidir os
> TBDs com o dono do projeto) antes de qualquer uma das fases
> `UI-GAP-FIX-DASHBOARD-A` / `UI-GAP-FIX-NOVO-PEDIDO-A` /
> `UI-GAP-FIX-MODAL-ITEM-A` / `UI-GAP-FIX-DETALHE-A` propostas no
> documento; `UI-GAP-FIX-SHELL-A` fica para o final, dado o risco
> cross-role do `shellLayout` compartilhado. **Producao permanece
> BLOQUEADA**; `origin/main` e `bhgifjrfagkzubpyqpew` **intocados**.
> **Esta fase e docs-only/read-only: sem codigo, sem schema, sem SQL,
> sem Supabase, sem Edge Function, sem frontend, sem testes de app
> (apenas verificacao Git).** Senha, token e qualquer credencial **nao
> foram registrados**. `docs/ui/CLIENTE_PORTAL_UI_GAP_INVENTORY.md` e
> diagnostico/nao-canonico, indexado em `docs/DOCUMENTATION_INDEX.md`
> §1b — nao substitui nenhuma das 7 fontes canonicas.

> **Atualizacao 2026-06-28 — fase
> `RAVATEX-TAPETES-CLIENTE-PORTAL-STAGING-CLOSEOUT-A` (docs-only,
> closeout do marco funcional do portal cliente em staging).** O
> **Portal Cliente B2B esta FUNCIONALMENTE HOMOLOGADO em staging**,
> HEAD fechado `23286ae`, `staging/main` em `23286ae`, Supabase
> staging `ucrjtfswnfdlxwtmxnoo`. **Produção/original
> `bhgifjrfagkzubpyqpew` NAO foi tocada; `origin/main` permanece
> intocado.** Cobertura funcional validada: perfil cliente; login
> cliente; criacao/lista/detalhe de pedido cliente; dashboard cliente
> read-only; status visual publicado pelo admin; stepper/
> acompanhamento; timeline read-only; policy cliente para eventos
> visiveis; provisionamento cliente em staging via `admin-create-user`
> validado; ausencia de exposicao de dados internos; portal 100%
> read-only para o cliente (exceto criacao de pedido); polimento
> visual inicial. **Esta fase NAO declara a UI como final.** O dono do
> projeto registrou que a UI atual ainda NAO esta como os HTMLs/
> mockups pedidos — houve melhoria real, mas ainda ha divergencias
> visuais e havera ajustes para particularidades operacionais antes
> de qualquer decisao de producao. **Producao permanece BLOQUEADA**
> para este bloco: nao ha autorizacao para merge ou deploy em
> `origin/main` nesta fase nem em fases anteriores. **Esta fase e
> docs-only: sem codigo, sem schema, sem SQL, sem Supabase, sem
> Edge Function, sem frontend, sem testes (apenas verificacao Git).**
> Senha, token e qualquer credencial **nao foram registrados**.
> Proxima fase recomendada: inventario de gaps de UI, comparando os
> mockups/HTMLs pedidos pelo dono do projeto contra a implementacao
> atual das 5 telas do portal cliente, antes de qualquer nova
> implementacao ou decisao de promocao para producao.

> **Atualizacao 2026-06-28 — fase
> `RAVATEX-TAPETES-CLIENTE-PORTAL-VISUAL-HOMOLOG-RECORD-A` (docs-only,
> registro de homologacao).** A **homologacao visual manual do portal
> cliente B2B, apos o refinamento visual da fase
> `RAVATEX-TAPETES-CLIENTE-PORTAL-VISUAL-POLISH-A`, foi APROVADA** pelo
> dono do projeto, no HEAD homologado `3b0f8e4`, em ambiente conectado
> ao Supabase staging `ucrjtfswnfdlxwtmxnoo`. **Produção/original
> `bhgifjrfagkzubpyqpew` NAO foi tocada.** Validado: **Dashboard
> Cliente** aprovado; **Meus pedidos** aprovado; **Detalhe do pedido**
> aprovado; **Stepper/Acompanhamento** aprovado; **Timeline de
> atualizacoes** aprovada; **responsividade basica** aprovada (sem
> sobreposicao grosseira, tabelas com rolagem quando necessario, menu
> permanece utilizavel em largura menor); **nenhum dado interno**
> (OP/lote/fornecedor/NF/romaneio/custo/margem/metadata/criado_por/
> origem/token_acesso) exposto ao cliente; **portal cliente permanece
> 100% read-only** — nenhuma acao de editar pedido, cancelar pedido,
> atualizar status, publicar evento ou mexer em fornecedor foi
> oferecida; **nenhuma regressao funcional reportada**. **Esta fase e
> docs-only: sem codigo, sem schema, sem SQL, sem Supabase, sem
> frontend, sem testes (apenas verificacao Git).** Senha, token e
> qualquer credencial **nao foram registrados**.
> Proxima fase recomendada: decidir, com o dono do projeto, entre
> preparacao para producao/staging closeout do portal cliente ou
> avancar para o proximo bloco funcional.

> **Atualizacao 2026-06-27 — fase
> `RAVATEX-TAPETES-CLIENTE-PORTAL-VISUAL-POLISH-A` (frontend, refino
> visual).** Refinada a apresentacao do portal cliente B2B nas 5
> telas (Dashboard, Meus pedidos, Detalhe, Stepper/Acompanhamento,
> Timeline de atualizacoes), **sem alterar nenhum comportamento
> homologado, nenhum campo selecionado e nenhuma regra de status**.
> - **Dashboard** (`js/screens/cliente-dashboard.js`): cards/KPIs com
>   borda de cor por tipo, layout em duas colunas (Pedidos recentes |
>   Ultimas atualizacoes) em telas largas, badges de pedido/evento
>   agora com tom de cor derivado da excecao publicada pelo admin
>   (mesma paleta do stepper) em vez de azul fixo.
> - **Meus pedidos** (`js/screens/cliente-pedidos-list.js`): contador
>   "N pedidos encontrados", tabela com rolagem horizontal
>   (`overflow-x-auto`), filtros de status em pill arredondado, acao
>   da tabela renomeada de "Visualizar" para "Ver pedido" (consistente
>   com o Dashboard). **Select de pedidos inalterado.**
> - **Detalhe do pedido** (`js/screens/cliente-pedido-detail.js`):
>   resumo do pedido reorganizado em grade de 3 colunas (Prazo de
>   entrega / Criado em / Atualizado em), tabela de itens com rolagem
>   horizontal, timeline "Atualizacoes do pedido" com indicador visual
>   de linha do tempo (ponto + conector). **Selects de pedidos,
>   pedido_itens e pedido_cliente_eventos inalterados.**
> - **Stepper/Acompanhamento** (`js/screens/cliente-pedido-tracking.js`):
>   apenas classes visuais (cantos, sombra, espacamento, tamanho dos
>   circulos) — taxonomia, exceções, "cancelado" como exceção
>   terminal e mensagem personalizada permanecem 100% intactos. Nao
>   consulta Supabase (component puro de apresentacao, como antes).
> - **Menu cliente e shell** (`js/screens/cliente-common.js`): **sem
>   alteracao** — "Início" e "Meus pedidos" ja atendiam ao padrao
>   visual; nao havia necessidade de mudanca.
> - **Seguranca de dados:** confirmado por teste automatizado dedicado
>   (`tests/cliente-portal-visual.smoke.js`, novo) que nenhuma das 5
>   telas passou a expor metadata/criado_por/origem,
>   `pedido_eventos` (tabela interna), OP/lote/fornecedor/NF/
>   romaneio/custo/margem/token_acesso, nem ganhou acao de escrita
>   (insert/update/delete/rpc/functions.invoke, ou botao "Cancelar
>   pedido"/"Confirmar pedido"/"Editar"). Os SELECTs de `pedidos`,
>   `pedido_itens` e `pedido_cliente_eventos` foram comparados
>   literalmente (string exata) contra o estado anterior a fase —
>   nenhum campo novo foi selecionado.
> - **Admin e fornecedor:** **não alterados.** Nenhum arquivo de
>   `db/**`, `supabase/functions/**` ou tela admin/fornecedor foi
>   tocado. **Sem schema, sem SQL, sem Supabase migration.**
> - **Verificacao visual manual** (app local conectado ao Supabase
>   staging `ucrjtfswnfdlxwtmxnoo`, usuario `cliente@teste.com`):
>   Dashboard com KPIs coloridos e grade de 2 colunas em desktop,
>   badges com tom (ambar para "Aguardando insumo", azul para
>   "Acabamento"); Detalhe com resumo em 3 colunas e timeline com
>   pontos; Meus pedidos com contador e acao "Ver pedido" —
>   confirmados sem erro de console.
> - Testes focados: lista obrigatoria da fase (`cliente-dashboard`,
>   `cliente-pedido-detail`, `cliente-pedido-events`,
>   `cliente-pedido-tracking`, `cliente-tracking-steps`,
>   `cliente-routing`, `boot`) + `cliente-pedidos-list` +
>   `cliente-portal-visual` (novo, com 49 casos) = **265 testes,
>   todos passaram**.
> Proxima fase recomendada: homologacao visual manual completa em
> staging pelo dono do produto, ou nova rodada de refinamento se
> houver feedback visual.

> **Atualizacao 2026-06-27 — fase
> `RAVATEX-TAPETES-CLIENTE-PROVISIONING-STAGING-VERIFY-A` (verificacao
> operacional controlada + docs-only).** **CONFIRMADO: a Edge Function
> `admin-create-user` deployada no Supabase staging
> `ucrjtfswnfdlxwtmxnoo` aceita o fluxo de provisionamento de usuario
> `tipo=cliente`.** A lacuna documental registrada apos a homologacao
> do Dashboard Cliente esta **resolvida**.
> - **Evidencia de codigo versionado:**
>   `supabase/functions/admin-create-user/index.ts` tem
>   `ALLOWED_TIPOS = {admin, fornecedor, cliente}` e ramo
>   `tipo === "cliente"` que rejeita `fornecedor_id`, exige `cliente_id`,
>   valida existencia em `public.clientes` e grava `usuarios.cliente_id`;
>   a UI `js/screens/cadastros.js` oferece tipo "Cliente" e invoca
>   `admin-create-user` com `cliente_id`.
> - **Metodo de validacao do deploy (nao destrutivo):** login admin
>   (`admin@tapetes.test`) no app local conectado ao staging; invocacao
>   `window.supa.functions.invoke('admin-create-user', { body: { tipo:
>   'cliente', cliente_id: 999999 (inexistente), ... } })`.
> - **Resultado observado:** HTTP **400**, `code: VALIDATION_ERROR`,
>   message **"cliente_id não existe em public.clientes."** — mensagem
>   que so existe no ramo `cliente` (index.ts). A versao antiga teria
>   barrado antes, no gate de `tipo`, com mensagem de tipo invalido.
>   Logo, `tipo=cliente` e **aceito** pela versao deployada.
> - **Nenhum usuario real criado:** a validacao de `cliente_id` ocorre
>   **antes** de `auth.admin.createUser`; com `cliente_id` inexistente a
>   chamada falhou na validacao, sem criar Auth user nem perfil. Nenhum
>   usuario foi criado, alterado ou excluido.
> - **Produção/original `bhgifjrfagkzubpyqpew` NAO foi tocada.** Apenas
>   staging. **Senha e token NAO foram registrados** (login feito no
>   navegador; token nunca saiu da pagina). **Sem** codigo/schema/SQL/
>   Supabase mutation/frontend nesta fase.
> Proxima fase recomendada: provisionar de fato um usuario cliente real
> via UI `#/cadastros/usuarios` em staging (somente com autorizacao
> explicita), ou seguir para refinamento visual do portal cliente.

> **Atualizacao 2026-06-27 — fase
> `RAVATEX-TAPETES-CLIENTE-DASHBOARD-HOMOLOG-RECORD-A` (docs-only,
> registro de homologacao).** A **homologacao manual/controlada do
> Dashboard Cliente read-only foi APROVADA**, no HEAD homologado
> `54fabfa`, em **app local (`http://localhost:8765/`) conectado ao
> Supabase staging `ucrjtfswnfdlxwtmxnoo`** (runtime confirmou
> `APP_ENV=staging` e `SUPABASE_URL` apontando para
> `ucrjtfswnfdlxwtmxnoo`). **Produção/original `bhgifjrfagkzubpyqpew`
> NAO foi tocada.** Validado: login cliente cai em
> `#/cliente/dashboard`; menu cliente com "Início" e "Meus pedidos"
> funcionais; dashboard carrega sem erro de console; KPIs coerentes
> (em aberto **2**, em andamento **2**, prontos/concluidos **0**,
> atualizacoes recentes **3**); pedidos recentes exibidos (**#3** com
> excecao "Aguardando insumo", **#2** em "Acabamento"); ultimas
> atualizacoes exibidas; links "Ver pedido" abrem o detalhe correto; o
> detalhe mantem **stepper** e **timeline** ja homologados; navegacao
> dashboard → detalhe → Meus pedidos → dashboard funciona; **nenhum
> dado interno** (OP/lote/fornecedor/NF/romaneio/custo/margem/metadata/
> criado_por/origem/token_acesso) aparece; **nenhuma acao de escrita**
> e oferecida (dashboard read-only). **Cliente de teste funcional em
> staging:** `cliente@teste.com`, `tipo=cliente`, `cliente_id=3`,
> cliente nome "Teste" (senha **não** registrada). Observacao nao
> bloqueante: quando o `titulo` do evento e igual ao status, titulo e
> badge podem repetir o texto — e dado do evento, nao defeito de tela.
> **Esta fase e docs-only: sem codigo, sem schema, sem SQL, sem
> Supabase, sem frontend, sem testes (apenas verificacao Git).**
> Proxima fase recomendada: refinamento visual do portal cliente ou
> proxima frente de funcionalidade cliente (ainda sem automacao).

> **Atualizacao 2026-06-27 — fase `RAVATEX-TAPETES-CLIENTE-DASHBOARD-A`
> (frontend cliente read-only).** Criado o **Dashboard Cliente
> read-only** como pagina inicial do portal B2B, na rota
> `#/cliente/dashboard` (role `cliente`). Entrega:
> - novo modulo `js/screens/cliente-dashboard.js` (SELECT-only) e
>   smoke `tests/cliente-dashboard.smoke.js`;
> - rota `#/cliente/dashboard` registrada em `js/boot.js`; cliente
>   passa a cair nela apos login (`routeAfterLogin` em `js/router.js`)
>   sem quebrar `#/cliente/pedidos`, `#/cliente/pedidos/novo` nem
>   `#/cliente/pedidos/<id>`;
> - menu cliente ganha item **"Início"** preservando **"Meus pedidos"**;
> - cards/KPIs (em aberto, em andamento, prontos/concluidos,
>   atualizacoes recentes) derivados localmente dos pedidos carregados;
> - lista de pedidos recentes (ate 5) com label visual via
>   `window.RavatexPedidoTracking` e botao "Ver pedido";
> - ultimas atualizacoes lidas de `pedido_cliente_eventos`, com empty
>   state "Suas atualizações aparecerão aqui.".
>
> **Pedidos sao lidos com SELECT explicito** apenas dos campos seguros
> (`id, numero, status, status_cliente_visual, status_cliente_excecao,
> status_cliente_mensagem, status_cliente_atualizado_em, prazo_entrega,
> prazo_desejado, tipo_recebimento, criado_em, atualizado_em`).
> **Eventos sao lidos com SELECT explicito**
> (`id, pedido_id, status, titulo, mensagem, criado_em`). **Nunca**
> seleciona `metadata`, `criado_por` ou `origem`; **nao** consulta
> `pedido_eventos`; **nao** expoe `OP`/`lote`/`fornecedor`/`NF`/
> `romaneio`/`custo`/`margem`/`token_acesso`. Tela **read-only**: sem
> insert/update/delete/rpc, sem `functions.invoke`, sem `service_role`.
> **Telas admin e fornecedor nao foram alteradas. Sem schema, sem SQL,
> sem Supabase migration. Producao `bhgifjrfagkzubpyqpew` intocada.**
> Aderente a `docs/architecture/PORTAL_B2B_ARCHITECTURE_RULES.md`
> (separacao de papeis §2, SELECT explicito §8, renderizacao sem writes
> §9). Testes focados: `cliente-dashboard` + `cliente-pedido-detail` +
> `cliente-pedido-events` + `cliente-pedido-tracking` +
> `cliente-tracking-steps` 135/135; `boot`+`cliente-routing`+`router`+
> `cliente-pedidos-list` 154/154 apos ajuste das contagens de rota.
> Proxima fase recomendada: homologacao manual do dashboard em staging
> ou refinamento visual do portal cliente.

> Snapshot de estado canonico curto. Atualizado em **2026-06-27** (fase
> `RAVATEX-TAPETES-PEDIDOS-CLIENTE-TRACKING-E2E-HOMOLOG-RECORD-A` —
> registro da homologacao manual E2E aprovada em staging).
> **O fluxo completo admin → cliente de acompanhamento visual foi
> homologado manualmente em staging (`ucrjtfswnfdlxwtmxnoo`) e
> aprovado pelo dono do projeto, no HEAD `fc7843c`.** Admin publicou
> situacao visual e excecao; cliente visualizou o stepper atualizado e
> a timeline read-only em "Atualizacoes do pedido"; nenhum dado interno
> foi exposto ao cliente. **Producao/original `bhgifjrfagkzubpyqpew`
> nao foi tocada. Esta fase e docs-only: sem codigo, sem schema, sem
> SQL, sem Supabase, sem frontend.**

## Produto
> Atualizacao da fase `RAVATEX-TAPETES-PEDIDOS-CLIENTE-TRACKING-E2E-HOMOLOG-RECORD-A`:
> a homologacao manual E2E do acompanhamento visual cliente (status
> visual + excecao + timeline de eventos) foi validada e aprovada em
> staging. Fluxo admin → cliente funciona ponta a ponta sem exigir
> intervencao tecnica fora das telas ja implementadas. Dashboard
> cliente e automacao continuam fora do escopo.
SPA web para controlar a produção de tapetes, do pedido de fio até o
recebimento do látex. Perfis: **admin** (operação), **fornecedor**
(fio / tecelagem / látex) e **cliente** (pedidos próprios — schema
aplicado; **cliente de teste funcional em staging**, login validado na
homologacao do dashboard 2026-06-27. Provisionamento self-service via
Edge Function `admin-create-user` aceitando `cliente` **confirmado
deployado em staging** em 2026-06-27 — ver bloco
`...-PROVISIONING-STAGING-VERIFY-A` no topo).

## Stack real (confirmada)
- Frontend: `index.html` único + `js/**` (JS clássico, sem build) +
  Tailwind via CDN.
- Cálculo: `js/calculo-op.js` — funções puras, testadas com `node --test`.
- Backend: Supabase + Auth e-mail/senha + RLS. Plano free.
- Hospedagem: **GitHub Pages** (publica no push pra `main`). **Não é
  Vercel. Não é Next.js.**

## Arquitetura
- **App estático `index.html` + JS clássico + Supabase.**
- **2 ambientes Supabase, 2 repos:**
  - **Legacy / original online** (`bhgifjrfagkzubpyqpew`) — app no Vercel com usuários externos. **Não tocar.**
  - **Paralelo de trabalho** (`ucrjtfswnfdlxwtmxnoo`) — backend novo, usado pelo frontend local `work/app-next`.
- **2 repos:**
  - `origin` → `grupoterrabranca/controle-tapetes` (oficial, intocado, `origin/main`).
  - `staging` → `controle-tapetes-staging` (paralelo, `staging/main`).
- **Taxonomia oficial:** ver `docs/operations/PARALLEL_ENVIRONMENT_RECONCILIATION.md`.
- **`bhgifjrfagkzubpyqpew` NÃO é alvo desta frente.** Nenhuma ação deve mirá-lo.

## Estado atual do refactor
- **Branch operacional:** `work/app-next`.
- **HEAD atual aceito:** `2e37658` — fase
  `RAVATEX-TAPETES-PEDIDOS-CLIENTE-TRACKING-ADMIN-A`, usada como base
  de entrada desta migration versionada.
- **staging/main:** `2e37658` (alinhado ao HEAD de entrada desta fase).
- **origin/main:** `1047181eba888242c6428de366cbd9fda2f1c72c` — **intocado.**
- **PR #2:** **intocado.**
- **Working tree:** **limpo.**
- **Ambiente paralelo (`ucrjtfswnfdlxwtmxnoo`):** backend completo:
  schema `db/12_*` aplicado (HMNlead, 2026-06-24), `db/13_*` aplicado,
  **`db/14_*` aplicado** (fase B2, Management API, 2026-06-24),
  Edge Functions `admin-create-user` e `admin-disable-user` deployadas
  e validadas, secrets configurados, UI validada manualmente, smokes
  163/163, E2E PASS.
- **App original (`bhgifjrfagkzubpyqpew`):** **intocado.** Apenas
  1 query read-only com anon key pública nesta frente, sem mutação.

### Marco fechado
**Marco fechada: ciclo de refactor arquitetural + hardening + extração
final do `op-pdf.js` está CONGELADO.**

Componentes estáveis:
- `index.html` declarativo, sem script inline final, com cache-busting
  `?v=20260623-asset1` em todos os 26 assets locais; CDNs externos
  permanecem sem `?v=`.
- `js/boot.js` é o entrypoint oficial e respeita `DOM ready`
  (aguarda `DOMContentLoaded` quando `document.readyState === 'loading'`,
  e chama `startApp()` em `js/boot.js`; `main()` não é mais executado
  no top-level).
- `js/router.js` é engine genérica de roteamento, intocado no ciclo.
- `js/ui.js` faz lookup lazy do root `#app` via `getAppRoot()` —
  erro `replaceChildren null` foi eliminado após cache limpo do
  navegador.
- `run-local.bat` é o tooling local para servir o app em
  `http://localhost:8765/`.
- Telas e writes críticos (admin / fornecedor / OP / entrega / látex)
  estão modularizados.
- `js/screens/op-pdf.js` foi extraído de `op-nova.js` contendo
  `gerarPdfCompraFios`.

### Commits técnicos e eventos desde o último docs-only (`5fec054`)
1. `d5db6c7` — Add local run script
   (`run-local.bat`, `http://localhost:8765/`).
2. `87d4559` — Delay app boot until DOM ready
   (`js/boot.js` passa a executar `main()` via `startApp`,
   aguardando `DOMContentLoaded`).
3. `e0dbfcd` — Resolve app root lookup after DOM ready
   (`js/ui.js` introduz `getAppRoot()` para lookup lazy do `#app`).
4. `5d5b395` — Add cache busting to local app assets
   (`index.html` com `?v=20260623-asset1` em 26 assets locais;
   CDNs externos preservados sem `?v=`).
5. `RAVATEX-TAPETES-OP-NOVA-SEAMS-DIAG-A` (read-only, sem commit) —
   diagnóstico das seams de `op-nova.js`. Concluiu que
   `gerarPdfCompraFios` é a única extração de baixo risco e que
   `buildBlocoFios` / `buildBlocoTecelagem` / `buildProposta` devem
   permanecer na closure por acoplamento.
6. `7f3c6da` — Extract OP PDF helper
   (`js/screens/op-pdf.js` criado; `gerarPdfCompraFios` removida de
   `op-nova.js`; call-site atualizado para
   `window.gerarPdfCompraFios({ op, ordens })`; 388/388 testes
   focados passaram).
7. Commits intermediários do ciclo de Auth (`e64d1cc`,
   `4f7c16f`, `0d5ef7b`, `88aa4fb`, `f6ac19b`, `c365020`,
   `0bc67f6`, `3c9c424`/`d9d08be`, `42ffc91`, `d99bcda`,
   `77bcc6b`) — ver LEDGER §4. Fecham: refactor closeout docs,
   `CODE_HEALTH_RULES`, governança, saneamento documental, design
   e implementação da Edge Function `admin-create-user`, UI
   `#/cadastros/usuarios`, runbook operacional, design de
   desativação, UI guard, schema de desativação versionado.
8. `8fa924a` — `RAVATEX-TAPETES-AUTH-DISABLE-USER-SCHEMA-APPLY-A`
   (docs-only): registro da orientação e validação local para
   aplicação de `db/12_auth_user_disable_schema.sql` no Supabase
   **staging** `ucrjtfswnfdlxwtmxnoo`. A execução real do SQL
   ficou pendente de HMNlead no Dashboard e foi registrada em
   fase própria (`RAVATEX-TAPETES-AUTH-DISABLE-USER-SCHEMA-APPLY-EVIDENCE-A`,
   esta fase).

## Decisão arquitetural
**REFATORAÇÃO ARQUITETURAL CONGELADA.**

Justificativa:
- `index.html` está declarativo e com cache-busting local.
- `js/boot.js` é o entrypoint; respeita DOM ready.
- `js/router.js` é engine genérica.
- `js/ui.js` tem root lookup seguro.
- assets locais têm cache-busting.
- telas e writes críticos estão modularizados.
- `op-pdf.js` foi extraído.
- `op-nova.js` ainda é grande (~800 linhas), mas **sem writes
  diretos Supabase** e com closure aceitável, isolada em módulo
  próprio.
- extrações adicionais de `buildBlocoFios`, `buildBlocoTecelagem` e
  `buildProposta` **não são recomendadas** neste ciclo: deslocariam
  complexidade para a fronteira da closure sem ganho proporcional e
  aumentariam risco.

A próxima etapa é **homologação / release**, não nova extração.

## Validação funcional registrada
- Servidor local em `http://localhost:8765/` abriu corretamente após
  cache limpo do navegador (Disable cache + Ctrl+F5).
- `replaceChildren null` no boot **não voltou** após a limpeza de
  cache.
- Login aparentemente OK.
- Supabase staging (`ucrjtfswnfdlxwtmxnoo`) tem 4 OPs:
  `select count(*) as total_ops from public.ops;` → `4`.
- Pendência não bloqueante: log `relation
  "supabase_migrations.schema_migrations" does not exist` permanece
  em staging (não bloqueante; é ruído do dashboard, não do app).

## Evidência da aplicação manual do schema em staging
*(Fase `RAVATEX-TAPETES-AUTH-DISABLE-USER-SCHEMA-APPLY-EVIDENCE-A` —
2026-06-24. Esta seção é **docs-only**; nenhum SQL foi rodado por
IAexec nesta fase. Toda a execução e validação foi feita manualmente
pelo HMNlead no Supabase Dashboard.)*

### Aplicação
- `db/12_auth_user_disable_schema.sql` foi aplicado manualmente pelo
  HMNlead no SQL Editor do Supabase **staging** `ucrjtfswnfdlxwtmxnoo`.
- Nenhum SQL destrutivo foi aplicado. Os arquivos
  `db/10_reset_producao.sql` e `db/11_reset_ops.sql` **não** foram
  executados. **Produção `bhgifjrfagkzubpyqpew` não foi tocada.**
- **Nenhum usuário foi criado, excluído ou desativado** durante a
  aplicação. Todas as mutações foram apenas de schema e de funções
  `SECURITY DEFINER`.

### Estado pós-aplicação
- Novas colunas em `public.usuarios`:
  `ativo boolean NOT NULL DEFAULT TRUE`,
  `desativado_em timestamptz NULL`,
  `desativado_por uuid NULL`,
  `motivo_desativacao text NULL`.
- Contagem pós-aplicação: `ativo = true, total = 3`;
  `auth_users_total = 3`; `public_usuarios_total = 3`;
  `auth_sem_perfil = 0`; `perfil_sem_auth = 0`.
- `is_admin()` agora exige `tipo = 'admin' AND ativo IS TRUE`.
- `meu_fornecedor_id()` agora consulta `fornecedor_id`, `tipo` e
  `ativo`; retorna `NULL` se `ativo` não for `TRUE` ou se `tipo`
  não for `'fornecedor'`.
- `usuarios_admin_all` permanece com `USING/WITH CHECK is_admin()`
  (a nova `is_admin()` já considera `ativo`).
- `usuarios_select` agora usa
  `((id = auth.uid()) AND (ativo IS TRUE)) OR is_admin()`.
- `usuarios_self_update` exige `id = auth.uid()`, `ativo IS TRUE`
  e preserva `tipo` no `WITH CHECK`.

### Validação manual do app pós-schema (HMNlead)
- Login/admin aparentou OK.
- Tela `#/cadastros/usuarios` carregou.
- Botão `+ Novo usuário` continuou visível.
- Exclusão insegura continuou bloqueada como `Em breve` (placeholder
  injetado na fase `RAVATEX-TAPETES-AUTH-DELETE-UI-GUARD-A`).
- Console não mostrou erro crítico de Auth/RLS/listagem.
- Avisos não bloqueantes observados: warning de Tailwind CDN;
  `favicon.ico` 404.

### Estado final
- Schema de desativação **aplicado e validado** em staging.
- Nenhum usuário foi criado, excluído ou desativado durante a
  aplicação. Todos os usuários atuais ficaram `ativo = true`.
- Próxima fase liberada:
  `RAVATEX-TAPETES-AUTH-DISABLE-USER-EDGE-A` (Edge Function
  `admin-disable-user`).

## Evidência da validação manual da UI em staging
*(Fase `RAVATEX-TAPETES-AUTH-DISABLE-USER-UI-VALIDATION-CLOSEOUT-A`
— 2026-06-24. Esta seção é **docs-only**; nenhum código, SQL,
deploy ou execução automatizada foi feita por IAexec nesta
fase. A validação foi feita manualmente pelo HMNlead no app em
staging `ucrjtfswnfdlxwtmxnoo`.)*

### Itens validados
- Tela `#/cadastros/usuarios` carregou em staging.
- Botão `Desativar` apareceu para usuários ativos; placeholder
  `Em breve` substituído pela chamada real à Edge Function
  `admin-disable-user`.
- **Guarda de usuário já inativo:** ao tentar `Desativar` um
  usuário com `ativo = false`, a UI exibiu a mensagem
  `"Usuário já está inativo."` **sem** chamar a Edge Function
  (proteção visual, server-side continua sendo a barreira real).
- **Fluxo real de desativação:** fornecedor descartável ativo foi
  criado pela UI e, em seguida, desativado via botão
  `Desativar` → modal de confirmação (motivo preenchido) →
  toast de sucesso → status `Inativo` na listagem.
- Console sem erros críticos de Auth/RLS/listagem.
- Warnings não bloqueantes, se presentes, continuam: warning
  de Tailwind CDN, `favicon.ico` 404.

### Estado final
- UI `#/cadastros/usuarios` validada em staging pelo HMNlead.
- **Produção `bhgifjrfagkzubpyqpew` intocada.**
- **`origin/main` intocado** (`1047181eba888242c6428de366cbd9fda2f1c72c`).
- **PR #2 intocado.**
- Próxima etapa: **decisão de release** para
  `origin/main`/produção, **somente com autorização explícita**
  do HMNlead (em fase separada).

## Pendências não bloqueantes
- 🟡 `op-nova.js` ainda tem cerca de 800 linhas; `buildBlocoFios`,
  `buildBlocoTecelagem` e `buildProposta` continuam na closure
  **por decisão arquitetural** (vide seção "Decisão arquitetural").
- 🟡 `persistirOP` e `aplicarRecalculoOP` ainda não são transacionais
  entre múltiplas tabelas (risco de produto/dados, não regressão do
  refactor).
- 🟢 **Auth provisioning concluído.** Edge Function `admin-create-user`
  deployada e validada em staging (`ucrjtfswnfdlxwtmxnoo`); UI
  `#/cadastros/usuarios` adaptada em `js/screens/cadastros.js`
  para chamar a função via `supabase.functions.invoke` (fase
  `RAVATEX-TAPETES-AUTH-ADMIN-UI-A`); E2E UI staging aprovada
  (criação de fornecedor descartável, `auth.users.id =
  public.usuarios.id` confirmado por SQL read-only, usuário teste
  removido); bloqueio de fornecedor (403) confirmado em staging;
  runbook operacional publicado em
  `docs/operations/AUTH_USER_PROVISIONING_RUNBOOK.md` (fase
  `RAVATEX-TAPETES-AUTH-PROVISIONING-DOCS-A`).
- 🟡 **Auth delete/disable design concluído.** Design de semântica de
  exclusão/desativação documentado em
  `docs/architecture/AUTH_DELETE_USER_DESIGN.md` (fase
  `RAVATEX-TAPETES-AUTH-DELETE-USER-DESIGN-A`). Recomendação:
  **desativar** (soft delete no perfil + ban no Auth) em vez de
  deletar fisicamente. Próxima fase:
  `RAVATEX-TAPETES-AUTH-DISABLE-USER-SCHEMA-A` (schema) ou
  `RAVATEX-TAPETES-AUTH-DELETE-UI-GUARD-A` (contenção imediata).
- 🟡 **UI guard aplicada.** Exclusão insegura de usuário
  (`.from('usuarios').delete()`) foi removida do front-end em
  `js/screens/cadastros.js` (fase
  `RAVATEX-TAPETES-AUTH-DELETE-UI-GUARD-A`). O botão "Excluir vínculo"
  foi substituído por placeholder "Em breve" que exibe toast
  informativo orientando a usar o Supabase Auth Dashboard para limpeza
  de testes. Delete/disable seguro via Edge Function ainda não
  implementado.
- 🟢 **Auth disable schema aplicado em staging.** Migration
  `db/12_auth_user_disable_schema.sql` foi aplicada manualmente pelo
  HMNlead no SQL Editor do Supabase **staging**
  `ucrjtfswnfdlxwtmxnoo` e validada pós-aplicação (fase
  `RAVATEX-TAPETES-AUTH-DISABLE-USER-SCHEMA-APPLY-EVIDENCE-A`).
  Adiciona colunas `ativo`, `desativado_em`, `desativado_por`,
  `motivo_desativacao` em `public.usuarios`; recria `is_admin()` e
  `meu_fornecedor_id()` para exigir `ativo is true`; recria policies
  `usuarios_select`, `usuarios_admin_all`, `usuarios_self_update`.
  Validação pós-aplicação: `ativo = true` em todos os 3 perfis
  (`auth_users_total = 3`, `public_usuarios_total = 3`,
  `auth_sem_perfil = 0`, `perfil_sem_auth = 0`); nenhuma coluna
  destrutiva foi rodada; `db/10_reset_producao.sql` e
  `db/11_reset_ops.sql` não foram executados; produção não foi
  tocada. Compatibilidade preservada: `ativo` tem `DEFAULT TRUE`,
  então `admin-create-user` continua funcionando sem alteração (a
  Edge Function insere apenas id/email/nome/tipo/fornecedor_id e o
  default preenche `ativo`).
- 🟡 **Apply staging confirmado (não executado por IAexec).** Fase
  `RAVATEX-TAPETES-AUTH-DISABLE-USER-SCHEMA-APPLY-A` (docs-only,
  `8fa924a`) preparou a orientação; fase
  `RAVATEX-TAPETES-AUTH-DISABLE-USER-SCHEMA-APPLY-EVIDENCE-A`
  (esta) registra a aplicação real feita por HMNlead no Dashboard.
  Validações locais (smoke 20/20 + regressões 65/65 + ausência de
  DELETE/DROP/TRUNCATE/secrets) passaram **antes** da aplicação.
  **Nenhum SQL foi rodado por IAexec em qualquer fase.** A execução
  do SQL no Supabase staging é e continua sendo responsabilidade
  exclusiva do HMNlead no Dashboard (project ref
  `ucrjtfswnfdlxwtmxnoo`).
- 🟡 **Edge Function `admin-disable-user` criada localmente (sem
  deploy).** Fase `RAVATEX-TAPETES-AUTH-DISABLE-USER-EDGE-A`.
  Implementação em `supabase/functions/admin-disable-user/index.ts`
  segue o padrão estrutural de `admin-create-user` (mesmos
  `_shared/cors.ts` e `_shared/response.ts`); valida admin ativo
  server-side; bloqueia auto-desativação e último admin ativo; faz
  soft delete no perfil + ban Auth via
  `auth.admin.updateUserById(target_id, { ban_duration: '876000h' })`;
  compensa (reativa perfil) se o ban falhar; não usa `.delete()` nem
  `auth.admin.deleteUser`. Smoke estático
  `tests/admin-disable-user.smoke.js` 39/39 verde. Regressões
  focais preservadas. **Sem deploy, sem Supabase real, sem
  alteração de UI** — `js/**`, `index.html`, `db/**` e
  `admin-create-user` intocados. UI de `#/cadastros/usuarios`
  continua com placeholder `Em breve` para exclusão. Deploy e
  validação E2E em staging ficam para
  `RAVATEX-TAPETES-AUTH-DISABLE-USER-EDGE-STAGING-DEPLOY-A`.
- 🟡 **Runner local de E2E staging criado (sem E2E real).** Fase
  `RAVATEX-TAPETES-AUTH-DISABLE-USER-E2E-AUTO-RUNNER-A`.
  Implementação em
  `scripts/staging/admin-disable-user-e2e.mjs` (ESM, sem
  dependências externas) com comandos `setup` e `run`. `setup`
  detecta staging automaticamente de `js/config.js` (URL + anon
  key já públicas) e pede admin email/senha uma vez, salvando
  em `.ravatex-local/admin-disable-user-e2e.config.json`
  (gitignored). `run` carrega o config, aborta se URL !=
  `ucrjtfswnfdlxwtmxnoo` ou se for `bhgifjrfagkzubpyqpew`,
  faz login admin, valida `tipo=admin AND ativo=true`, resolve
  `fornecedor_id` (config ou autodetect), cria fornecedor
  descartável via `admin-create-user`, valida perfil criado,
  tenta `admin-disable-user` como fornecedor (espera
  `FORBIDDEN`), revalida admin ativo, re-login admin, desativa
  o descartável (espera `ativo=false`, `auth_banned=true`),
  valida `desativado_em`/`desativado_por`/`motivo_desativacao`
  em `public.usuarios`, tenta login do desativado (espera
  falha), re-desativa (espera `already_disabled=true`), tenta
  self-disable (espera `SELF_DISABLE_FORBIDDEN`), imprime
  resumo sanitizado. Smoke estático
  `tests/admin-disable-user-e2e-runner.smoke.js` 32/32 verde
  (após `E2E-RUNNER-FIX-A`); regressões focais preservadas
  (`admin-create-user` 17/17, `admin-disable-user` 39/39).
  **E2E real ainda não foi rerodado** após o fix — fica para
  a próxima (`RAVATEX-TAPETES-AUTH-DISABLE-USER-E2E-A` ou
  similar).
- 🟡 **Bug do runner no login bloqueado corrigido.** Fase
  `RAVATEX-TAPETES-AUTH-DISABLE-USER-E2E-RUNNER-FIX-A`
  (esta fase). Quando o runner real foi executado em staging
  avançou até `profile_inactive` e falhou com
  `HTTP 400 User is banned` no passo `login_blocked`. A falha
  era o **resultado esperado** do teste, mas foi tratada como
  erro fatal porque `supabaseLogin` chamava `die()`/
  `process.exit` em qualquer HTTP 4xx e usava a mensagem
  hardcoded "Login admin falhou" (rótulo incorreto para o
  usuário descartável desativado). Correção: runner agora
  separa os helpers `loginExpectSuccess(...)` (fatal, com
  rótulo parametrizado como `admin_login failed`) e
  `loginExpectFailure(...)` (não-fatal, retorna
  `{ ok, unexpected, status, detail }`; aceita HTTP 4xx com
  `User is banned`/`banned`/`Banned user`/`User is already
  registered` como falha esperada). Passo `login_blocked`
  agora imprime `login_blocked: OK` e continua para
  `idempotency` e `self_disable_blocked`. Smoke estático
  `tests/admin-disable-user-e2e-runner.smoke.js` expandido
  para 32/32 verde (4 testes novos: login bloqueado esperado,
  fluxo continua, loginExpectSuccess em 3 logins,
  loginExpectFailure com substrings banned, loginExpectFailure
  retorna controle).   `admin-disable-user.smoke.js` 39/39
  verde. **E2E real não foi rerodado nesta fase** — só após
  autorização do HMNlead.
- 🟡 **UI `#/cadastros/usuarios` integrada com `admin-disable-user`.**
  Fase `RAVATEX-TAPETES-AUTH-DISABLE-USER-UI-A`. Botão
  `Desativar` substitui o placeholder `Em breve`; chama
  `window.supa.functions.invoke('admin-disable-user', { body: {
  user_id, reason } })`; modal de confirmação com campo de
  motivo opcional (até 500 chars); mapeia códigos de erro
  (`FORBIDDEN`/`SELF_DISABLE_FORBIDDEN`/`LAST_ADMIN_FORBIDDEN`/
  `NOT_FOUND`/`AUTH_BAN_FAILED`/`COMPENSATION_FAILED`/
  `VALIDATION_ERROR`/`UNAUTHORIZED`) para mensagens PT-BR; guarda
  de UX para o próprio usuário logado e para usuários já
  inativos (proteção visual, não substitui server-side); coluna
  `Status` na listagem mostra `Ativo`/`Inativo`. E2E real do
  runner backend já havia passado em `result: PASS` em staging
  (`ucrjtfswnfdlxwtmxnoo`) — ver LEDGER §5k para evidência
  sanitizada. Smoke estático
  `tests/cadastros-usuarios-auth-ui.smoke.js` 23/23 verde;
  regressões focais todas verdes.
- 🟢 **Validação manual da UI de desativação em staging
  (HMNlead).** Fase
  `RAVATEX-TAPETES-AUTH-DISABLE-USER-UI-VALIDATION-CLOSEOUT-A`
  (esta fase, docs-only). Tela `#/cadastros/usuarios` aberta em
  staging `ucrjtfswnfdlxwtmxnoo`; botão `Desativar` confirmado
  visível; guarda de UX para usuário já inativo exibiu a
  mensagem `"Usuário já está inativo"` (sem chamada à Edge
  Function); fornecedor descartável ativo foi criado pela UI e
  em seguida desativado via botão `Desativar`; fluxo real
  passou. Warnings não bloqueantes, se presentes, continuam:
  Tailwind CDN, `favicon.ico` 404. **Produção
  `bhgifjrfagkzubpyqpew` e `origin/main` intocados.**
  Detalhes em "Evidência da validação manual da UI em staging"
  abaixo.
- 🟡 Staging mostra log `relation "supabase_migrations.schema_migrations"
  does not exist` (ruído do dashboard, não do app).
- 🟡 Tailwind CDN ainda gera warning de produção (não bloqueante;
  requer mudança de stack se for endereçar).
- 🟡 GitHub Pages staging ainda pode ser tratado depois, se necessário
  para homologação pública.
- 🟢 **Detalhe admin read-only do Pedido (`#/pedidos/<uuid>`)**
  (fase `RAVATEX-TAPETES-PEDIDOS-UI-ADMIN-C3A`): nova tela
  `js/screens/pedido-detail.js` com `screenPedidoDetalhe(pedidoId)`;
  resolve via match dinâmico estendido em `js/router.js`
  (`^#/pedidos/<uuid>$`, admin-only, sem `public: true`);
  carregado em `index.html` após `pedido-form.js` e antes de
  `boot.js`; botão "Visualizar" de `js/screens/pedidos-list.js`
  navega para `#/pedidos/<id>`. Conteúdo: cabeçalho com
  número/status badge/cliente/prazo/criado em, dados gerais
  (observação + atualizado em), tabela de itens com modelo, cor_1
  /cor_2, largura, preview 48x48, metros e observação do item.
  Ações: Voltar (funcional), Editar/Cancelar/Receber (placeholders
  `disabled` com `title="Em breve"`). SELECT-only em `pedidos`
  (com join aninhado `cliente:cliente_id(id, nome)`), `pedido_itens`,
  `modelos`, `cores`. Sem insert/update/delete/rpc, sem
  `functions.invoke`, sem `token_acesso`, sem `service_role`, sem
  rota pública, sem mutação em `lotes`/`pedido_eventos`, sem
  schema/SQL, sem OP, sem Edge Function, sem fornecedor.
  Smoke estático `tests/pedido-detail.smoke.js` 30/30 verde.
  Regressões focadas: `pedido-form` 35/35, `pedido-ui` 18/18,
  `pedidos-list` 29/29, `pedidos-schema` 41/41, `boot` 22/22
  (com 2 testes novos: `matchRoute('#/pedidos/<uuid>')` resolve
  para `screenPedidoDetalhe` admin-only; IDs não-UUID não casam),
  `router` 34/34. **Total: 209/209 verdes** (focados).
  Falhas pré-existentes em `tests/ops-list-screen.smoke.js` (10/30)
  são de testes do refactor monolítico antigo, **fora do escopo**
  desta fase. **Sem deploy, sem Supabase real, sem SQL, sem
  produção, sem origin/main, sem PR #2 nesta fase.** Próxima fase
  recomendada: `RAVATEX-TAPETES-PEDIDOS-UI-ADMIN-C3B` (adição de
  ações reais de status/edição/cancelamento), **somente com
  autorização explícita** do HMNlead.
- 🟢 **Ações reais RESTRITAS de status no detalhe do Pedido** (fase
  `RAVATEX-TAPETES-PEDIDOS-UI-ADMIN-C3B`, esta). `pedido-detail.js`
  agora define `TRANSITIONS` (rascunho→recebido, recebido→
  confirmado, rascunho/recebido/confirmado→cancelado; produzindo
  /entregue/cancelado terminais), `ACTION_LABEL` e função interna
  `alterarStatus(novoStatus, btn)`. Ações reais: "Marcar como
  recebido" (rascunho), "Confirmar pedido" (recebido) e "Cancelar
  pedido" (qualquer dos 3 estados iniciais — exige
  `window.confirmDialog`). Update é APENAS em `pedidos.status`
  com `.eq('id', pedidoId)` (admin-only via RLS). Após sucesso,
  atualiza `state.pedido.status` e chama `render()`. Para
  status terminais (cancelado/produzindo/entregue), exibe
  mensagem informativa em vez de botões. Editar continua
  placeholder (`disabled` com `title="Em breve"`) — fica para
  C3C. Sem insert/update/delete em `pedido_itens`, sem insert em
  `pedido_eventos` (decisão C3B: best-effort fica para fase
  futura), sem mexer em `lotes`/`pedido_eventos`, sem OP, sem
  Edge Function, sem RPC, sem schema, sem token público.
  Smoke estático `tests/pedido-detail.smoke.js` 42/42 verde
  (12 testes novos: 5 transições permitidas, 2 transições
  proibidas para produzindo/entregue, terminal de cancelado,
  `alterarStatus`, update restrito a `status` apenas, sem
  insert em `pedido_eventos`, uso de `confirmDialog` apenas
  para cancelar, botões reais vs placeholder Editar, re-render
  após sucesso). Regressões focadas preservadas: `pedido-form`
  35/35, `pedido-ui` 18/18, `pedidos-list` 29/29, `pedidos-schema`
  41/41, `boot` 22/22, `router` 34/34. **Total: 221/221
  verdes** (focados). Falhas pré-existentes em
  `tests/ops-list-screen.smoke.js` (10/30) são do refactor
  monolítico antigo, **fora do escopo**. **Sem deploy, sem
  Supabase real, sem SQL, sem produção, sem origin/main, sem
  PR #2 nesta fase.** Próxima fase recomendada:
  `RAVATEX-TAPETES-PEDIDOS-UI-ADMIN-C3C` (edição de campos
  editáveis do Pedido + itens), **somente com autorização
  explícita** do HMNlead.
- 🟢 **Edição admin RESTRITA dos dados gerais do Pedido** (fase
  `RAVATEX-TAPETES-PEDIDOS-UI-ADMIN-C3C1`, esta). Nova tela
  `js/screens/pedido-edit.js` com `screenPedidoEditar(pedidoId)`;
  resolve via match dinâmico estendido em `js/router.js`
  (`^#/pedidos/<uuid>/editar$`, admin-only, sem `public: true`).
  Carregado em `index.html` após `pedido-detail.js` e antes de
  `boot.js`. Botão "Editar" de `js/screens/pedido-detail.js`
  navega para `#/pedidos/<id>/editar` APENAS para status
  editáveis (`rascunho` / `recebido`); para os demais status,
  fica como placeholder desabilitado com `title` explicativo.
  Helper `isPedidoEditavel(status)` adicionado em
  `js/pedido-ui.js` (`PEDIDO_STATUS_EDITAVEL = ['rascunho',
  'recebido']`). Conteúdo da tela: cabeçalho com número do
  pedido, banner de status com nota de editabilidade, form
  com `cliente_id` (select obrigatório), `prazo_entrega`
  (date opcional), `observacao` (textarea opcional); botão
  Cancelar volta para o detalhe; botão Salvar aplica update.
  Em status não editável, campos e Salvar ficam desabilitados
  e o banner mostra o motivo. Write APENAS em `pedidos` com
  payload restrito a 3 chaves (`cliente_id`, `prazo_entrega`,
  `observacao`); sem update em `status`/`numero`, sem
  update/insert/delete em `pedido_itens`, sem insert em
  `pedido_eventos`, sem mexer em `lotes`, sem OP, sem Edge
  Function, sem RPC, sem schema, sem token público, sem
  service_role. Após sucesso, navega de volta para o detalhe.
  Smoke estático `tests/pedido-edit.smoke.js` 35/35 verde.
  `tests/pedido-detail.smoke.js` atualizado (42/42) — botão
  Editar é controlado por `isPedidoEditavel` (funcional para
  rascunho/recebido, placeholder para os demais); C3B status
  actions preservadas. `tests/boot.smoke.js` 25/25 (3 testes
  novos: rota de edição admin-only, rejeita IDs não-UUID,
  distingue detalhe vs edição). `tests/router.smoke.js` 38/38
  (4 testes novos para a nova rota dinâmica). **Total:
  263/263 verdes** (focados). **Sem deploy, sem Supabase real,
  sem SQL, sem produção, sem origin/main, sem PR #2 nesta
  fase.** Próxima fase recomendada:
  `RAVATEX-TAPETES-PEDIDOS-UI-ADMIN-C3C2` (edição de itens
  do Pedido), **somente com autorização explícita** do HMNlead.
- 🟢 **Edição admin RESTRITA de itens existentes do Pedido**
  (fase `RAVATEX-TAPETES-PEDIDOS-UI-ADMIN-C3C2B`, esta).
  Nova tela `js/screens/pedido-itens-edit.js` com
  `screenPedidoItensEditar(pedidoId)`; resolve via match
  dinâmico em `js/router.js`
  (`^#/pedidos/<uuid>/itens$`, admin-only, sem `public: true`).
  Carregado em `index.html` após `pedido-edit.js` e antes de
  `boot.js`. Botão "Editar itens" de `js/screens/pedido-detail.js`
  (helper `buildEditItensButton()`) navega para
  `#/pedidos/<id>/itens` APENAS para status editáveis
  (`rascunho` / `recebido`, via `window.isPedidoEditavel`);
  para os demais status, fica como placeholder desabilitado.
  Conteúdo: cabeçalho com número do pedido, banner de status
  com nota de editabilidade, lista de itens existentes com
  select de modelo (`modelos`), input number de metros e
  input de observação; sem controles de add/remove/reordenar
  (C3C2C) e sem overrides de largura/cor (C3C2D). Write
  APENAS em `pedido_itens` com payload restrito a 3 chaves
  (`modelo_id`, `metros`, `observacao`); sem update em
  `pedidos`, sem update/insert/delete em `pedido_itens`, sem
  insert em `pedido_eventos`, sem mexer em `lotes`, sem OP,
  sem Edge Function, sem RPC, sem schema, sem token público,
  sem service_role, sem rota pública. Sem compensação
  automática nesta fase (limitação documentada: se um update
  falhar, os anteriores permanecem; usuário re-edita).
  Após sucesso, navega de volta para o detalhe.
  Smoke estático `tests/pedido-itens-edit.smoke.js` 41/41
  verde (17 seções de cobertura: existência, sintaxe,
  namespace, ordem de scripts, router dinâmico, SELECTs,
  write restrito, payload de 3 chaves, ausência de campos
  proibidos, ausência de insert/delete, ausência de update
  em `pedidos`, ausência de `pedido_eventos`/`lotes`,
  ausência de Edge Function, ausência de OP, ausência de
  token_acesso/service_role, ausência de rota pública,
  ausência de controles de add/remove/reordenar, mensagem
  "Pedido sem itens", botão "Editar itens" no detalhe).
  `tests/pedido-detail.smoke.js` atualizado (43/43) — botão
  "Editar itens" controlado por `isPedidoEditavel`
  (C3C2B); C3B status actions e C3C1 edição de dados gerais
  preservadas. `tests/router.smoke.js` atualizado (41/41) —
  3 testes novos para a nova rota. `tests/boot.smoke.js`
  atualizado (28/28) — 3 testes novos para a nova rota.
  **Total: 311/311 verdes** (focados). **Sem deploy, sem
  Supabase real, sem SQL, sem produção, sem origin/main, sem
  PR #2 nesta fase.** Próxima fase recomendada:
  `RAVATEX-TAPETES-PEDIDOS-UI-ADMIN-C3C2C` (adicionar/remover
  itens + recálculo de ordem + mínimo de 1 item), **somente
  com autorização explícita** do HMNlead.
- 🟢 **Adicionar novo item ao Pedido pela tela de edição** (fase
   `RAVATEX-TAPETES-PEDIDOS-UI-ADMIN-C3C2C1`, esta).
   `js/screens/pedido-itens-edit.js` (já existente) foi estendido
   para permitir ADICIONAR novos itens além de editar os
   existentes (C3C2B). Comportamento: botão "+ Adicionar item"
   visível apenas para status editáveis; ao clicar, novo item
   é criado no estado local com flag `isNew: true` (campos
   vazios para preenchimento: `modelo_id` obrigatório, `metros`
   > 0, `observacao` opcional); botão "Descartar novo item" em
   cada item novo para descarte apenas local (não remove
   item existente). Itens novos têm visual distinto (borda
   tracejada + label "Novo (não salvo)"). `salvar()` separa
   `existingItems` (update sequencial, 3 chaves no payload)
   de `newItems` (insert em batch com 5 chaves:
   `pedido_id`, `modelo_id`, `metros`, `observacao`, `ordem`,
   onde `ordem = existingItems.length + i` — novos vão para o
   fim). Ordem recomendada: updates primeiro, depois insert.
   Sem delete/upsert em `pedido_itens`, sem remover item
   existente (C3C2C2), sem drag-and-drop, sem reordenar
   manualmente, sem editar `largura`/`cor_1_id`/`cor_2_id`
   (C3C2D), sem update em `pedidos`, sem `pedido_eventos`/
   `lotes`, sem OP, sem Edge Function, sem RPC, sem schema, sem
   token público, sem `service_role`, sem rota pública.
   `tests/pedido-itens-edit.smoke.js` atualizado (46/46
   verde) — 5 testes novos (botão "+ Adicionar item" existe,
   insert de novos itens com 5 chaves permitidas, insert NÃO
   contém campos proibidos, ordem calculada automaticamente,
   botão "Descartar novo item" apenas para isNew) + 1 teste
   atualizado (insert permitido, delete/upsert proibidos) +
   1 teste invertido ("TEM botão Adicionar item" em vez de
   "NÃO tem"). `tests/pedido-detail.smoke.js` preservado
   (43/43). `tests/boot.smoke.js` e `tests/router.smoke.js`
   preservados (28/28 e 41/41). **Total: 316/316 verdes**
   (focados). **Sem deploy, sem Supabase real, sem SQL, sem
   produção, sem origin/main, sem PR #2 nesta fase.** Próxima
   fase recomendada: `RAVATEX-TAPETES-PEDIDOS-UI-ADMIN-C3C2C2`
   (remover item existente do Pedido), **somente com
   autorização explícita** do HMNlead.
 - 🟢 **Remover item existente do Pedido pela tela de edição**
   (fase `RAVATEX-TAPETES-PEDIDOS-UI-ADMIN-C3C2C2`, esta).
   `js/screens/pedido-itens-edit.js` (já existente) foi estendido
   para também permitir REMOVER itens existentes do Pedido
   (além de editar da C3C2B e adicionar novos da C3C2C1).
   Comportamento: cada item EXISTENTE (!isNew, !markedForDeletion)
   tem botão "Remover item" (visível apenas para status
   editáveis) que abre `window.confirmDialog` com confirmação
   visual (`title: "Remover item do pedido?"`, `confirmLabel:
   "Remover item"`, `danger: true`). Após confirmar, o item é
   marcado localmente com `markedForDeletion: true` (visual
   distinto: borda tracejada vermelha, opacidade 70, label
   "Será removido ao salvar") e o botão vira "Desfazer remoção"
   (limpa a flag e re-renderiza). Itens NOVOS (isNew=true)
   continuam usando "Descartar novo item" (apenas local, sem
   tocar no banco) — "Remover item" é exclusivo de existentes.
   Mínimo de 1 item no Pedido é garantido: `marcarParaRemocao`
   pré-checa `naoMarcados <= 1` e bloqueia com toast
   `"Pedido precisa ter pelo menos 1 item."` se a remoção
   deixaria 0 itens. Também bloqueia se `state.blockedStatus`.
   A remoção é aplicada APENAS no `salvar()` (não há operação
   de banco até lá). `salvar()` foi reestruturado para filtrar
   `state.itens` em 4 grupos: `activeItems` (não marcados;
   validados e processados), `existingItems` (subset de
   active, !isNew — UPDATE sequencial com 3 chaves:
   `modelo_id`/`metros`/`observacao` + dupla `.eq('id')` +
   `.eq('pedido_id')`), `newItems` (subset de active, isNew —
   INSERT em batch com 5 chaves: `pedido_id`/`modelo_id`/
   `metros`/`observacao`/`ordem` onde `ordem =
   existingItems.length + i`), `removedItems` (marcados E
   !isNew — DELETE sequencial com `.eq('id', dbId).eq('pedido_id',
   pedidoId)`). Sequência: 1) UPDATE existentes, 2) INSERT novos,
   3) DELETE removidos. Cada etapa aborta em erro; sem
   compensação automática (limitação documentada: se uma etapa
   falhar, etapas anteriores podem ter sido aplicadas; usuário
   re-edita e tenta novamente). Toast de sucesso conta
   `N novo(s) inserido(s)` e `M removido(s)`. Sem drag-and-drop
   / reordenação manual (C3C2C2+), sem editar
   `largura`/`cor_1_id`/`cor_2_id` (C3C2D), sem update em
   `pedidos`, sem `pedido_eventos`/`lotes`, sem OP, sem Edge
   Function, sem RPC, sem schema, sem token público, sem
   `service_role`, sem rota pública, sem `functions.invoke`.
   `tests/pedido-itens-edit.smoke.js` atualizado (59/59
   verde) — 13 testes novos (TEM botão "Remover item" para
   existente com `marcarParaRemocao`/`desfazerRemocao`; item
   NOVO NÃO tem "Remover item" (continua com "Descartar novo
   item"); uso de `window.confirmDialog` com `confirmLabel:
   "Remover item"` e `danger: true`; flag `markedForDeletion`
   inicializada como `false` em itens existentes e novos;
   `marcarParaRemocao` seta `true` e `desfazerRemocao` seta
   `false`; `onConfirm` apenas marca e re-renderiza sem
   operação de banco; TEM botão "Desfazer remoção" para item
   marcado com visual vermelho; `marcarParaRemocao` valida
   mínimo de 1 item E bloqueia em status não editável;
   `salvar()` faz `.delete().eq('id', it.dbId).eq('pedido_id',
   pedidoId)` em `pedido_itens`; delete só dentro de `salvar()`;
   `salvar()` separa `activeItems`/`existingItems`/`newItems`/
   `removedItems`; update/insert/delete todos dentro de
   `salvar()`; delete em `pedido_itens` NÃO toca outras
   tabelas) + 1 teste invertido (TEM botão Remover existente
   em vez de NÃO tem) + 1 teste atualizado (NÃO faz upsert;
   delete agora permitido). `tests/pedido-detail.smoke.js`
   preservado (43/43). `tests/boot.smoke.js` e
   `tests/router.smoke.js` preservados (28/28 e 41/41).
   **Total: 329/329 verdes** (focados: 59 + 43 + 28 + 41 +
   35 + 18 + 29 + 41 + 32 + 3 [pedido-form] = 329). **Sem
   deploy, sem Supabase real, sem SQL, sem produção, sem
   origin/main, sem PR #2 nesta fase.** Próxima fase
   recomendada: `RAVATEX-TAPETES-PEDIDOS-UI-ADMIN-C3C2C3`
   (reordenação manual de itens com drag-and-drop / setas),
   **somente com autorização explícita** do HMNlead.
 - 🟢 **Normalização automática de `ordem` no `salvar()`**
   (fase `RAVATEX-TAPETES-PEDIDOS-UI-ADMIN-C3C2C3`, esta).
   `js/screens/pedido-itens-edit.js` (já existente) foi estendido
   para normalizar automaticamente `ordem` dos itens finais no
   `salvar()` (além de editar da C3C2B, adicionar da C3C2C1 e
   remover da C3C2C2). Comportamento: no `salvar()`, antes de
   qualquer operação de banco, há um loop
   `for (let i = 0; i < activeItems.length; i++) {
   activeItems[i].ordem = i; }` que recalcula `ordem` por
   posição final no array `activeItems = state.itens.filter(
   !markedForDeletion)`. Isso elimina lacunas após add/remove:
   itens `[0,1,2,3]` com item 1 removido → `[0,2,3]` normalizado
   para `[0,1,2]`. Sequência final garantida: `0, 1, 2, ...` sem
   sobreposição e sem gaps. Itens marcados para remoção são
   EXCLUÍDOS do cálculo (não entram na sequência final). Sem
   UI de reordenação manual (sem drag-and-drop, sem setas de
   subir/descer, sem botões moveUp/moveDown, sem reordenar).
   `salvar()` foi atualizado: update agora tem payload com 4
   chaves (`modelo_id`/`metros`/`observacao`/`ordem` — `ordem`
   é nova no payload de update, para aplicar a normalização
   nos itens remanescentes após remoção); insert continua com
   5 chaves mas `ordem: it.ordem` (vindo da normalização, não
   mais `existingItems.length + i`); delete continua com
   `.eq('id', dbId).eq('pedido_id', pedidoId)` em `pedido_itens`.
   Sequência: 1) separar `activeItems` (filter !markedForDeletion)
   e `removedItems` (filter markedForDeletion && !isNew), 2)
   validar `activeItems.length >= 1` e cada item (modeloId,
   metros > 0), 3) **normalizar** `activeItems[i].ordem = i` por
   posição, 4) separar `existingItems`/`newItems`, 5) UPDATE
   sequencial com `.eq('id', it.dbId).eq('pedido_id', pedidoId)`,
   6) INSERT em batch, 7) DELETE sequencial. Toast de sucesso
   continua contando inserts/removes. Limitação documentada
   (sem transação/RPC, sem compensação automática) preservada
   da C3C2C2. Sem drag-and-drop, sem setas, sem reordenação
   manual, sem editar `largura`/`cor_1_id`/`cor_2_id` (C3C2D),
   sem update em `pedidos`, sem `pedido_eventos`/`lotes`, sem
   OP, sem Edge Function, sem RPC, sem schema, sem token
   público, sem `service_role`, sem rota pública, sem
   `functions.invoke`. `tests/pedido-itens-edit.smoke.js`
   atualizado (64/64 verde) — 5 testes novos
   (normalização `activeItems[i].ordem = i` por posição; loop
   usa `for` (não forEach) para acessar índice; normalização
   ANTES de separar existing/new; `activeItems` é base do
   cálculo; update de item existente INCLUI `ordem` com valor
   `it.ordem`; insert usa `it.ordem` (não mais
   `existingItems.length + i`); payload NÃO contém
   `largura`/`cor_1_id`/`cor_2_id`) + 2 testes invertidos
   (payload de update EXATAMENTE 4 chaves em vez de 3; NÃO
   atualiza campos proibidos exceto `ordem` que agora é
   permitida) + 1 teste atualizado (NÃO tem drag/setas/
   subir/descer; mantém reordenar como proibido). Regressões
   focadas todas verdes: `pedido-detail` 43/43, `pedido-edit`
   35/35, `pedido-form` 35/35, `pedido-ui` 18/18,
   `pedidos-list` 29/29, `pedidos-schema` 41/41, `boot` 28/28,
   `router` 41/41. **Total: 334/334 verdes** (focados).
   **Sem deploy, sem Supabase real, sem SQL, sem produção,
   sem origin/main, sem PR #2 nesta fase.** Próxima fase
   recomendada: `RAVATEX-TAPETES-PEDIDOS-UI-ADMIN-C3C2D`
   (overrides opcionais de `largura`/`cor_1_id`/`cor_2_id` por
   item) ou `RAVATEX-TAPETES-PEDIDOS-UI-ADMIN-C3C2C4`
    (reordenação manual com drag-and-drop / setas), **somente
    com autorização explícita** do HMNlead.
  - 🟢 **Perfil autenticado de cliente — schema/RLS versionado** (fase
    `RAVATEX-TAPETES-PEDIDOS-CLIENTE-SCHEMA-RLS-B1`, concluída).
    `db/14_cliente_perfil_schema.sql` idempotente criado com:
    role `cliente` em `usuarios.tipo` (constraint
    `usuarios_tipo_check`), coluna `usuarios.cliente_id BIGINT`
    (FK → `public.clientes(id) ON DELETE SET NULL`), constraint
    `usuarios_vinculo_exclusivo_check` (admin: ambos NULL,
    fornecedor: só `fornecedor_id`, cliente: só `cliente_id`),
    função `public.meu_cliente_id()` (SECURITY DEFINER, STABLE,
    `search_path = public, auth`; exige `tipo = 'cliente' AND
    ativo IS TRUE AND cliente_id IS NOT NULL`; retorna NULL em
    falhas com `EXCEPTION WHEN OTHERS`), GRANT EXECUTE para
    `anon, authenticated`. RLS em `clientes`: mantém admin full
    existente; adiciona `clientes_cliente_select` (cliente vê
    apenas o próprio cadastro via `id = meu_cliente_id()`).
    RLS em `pedidos`: mantém `pedidos_admin_all` existente;
    adiciona `pedidos_cliente_select` (SELECT via
    `cliente_id = meu_cliente_id()`) e `pedidos_cliente_insert`
    (INSERT via `cliente_id = meu_cliente_id() AND status IN
    ('rascunho','recebido')`). RLS em `pedido_itens`: mantém
    `pedido_itens_admin_all` existente; adiciona
    `pedido_itens_cliente_select` (SELECT via subquery em
    `pedidos` verificando `cliente_id = meu_cliente_id()`) e
    `pedido_itens_cliente_insert` (INSERT via subquery em
    `pedidos` verificando dono + `status IN
    ('rascunho','recebido')`). **NÃO** há UPDATE/DELETE de
    cliente em `pedidos` ou `pedido_itens` (fica para fase futura
    — exige controle mais fino de colunas/transições).
    `pedido_eventos` permanece admin-only (auditoria interna;
    comentário explícito no SQL). **NÃO** há policy por
    `token_acesso`, **NÃO** há acesso anon, **NÃO** há rota
    pública, **NÃO** há `service_role`/secrets, **NÃO** há
    DROP destrutivo, script é idempotente (IF NOT EXISTS /
    DROP IF EXISTS / CREATE OR REPLACE). `js/**`,
    `supabase/functions/**`, `index.html` e migrations antigas
    **intocados**. Smoke estático
    `tests/cliente-perfil-schema.smoke.js` 49/49 verde.
    Regressões focadas: `pedidos-schema.smoke.js` 41/41,
    `auth-disable-user-schema.smoke.js` 20/20 — todas verdes.

 - 🟢 **Aplicação do schema cliente em staging** (fase
    `RAVATEX-TAPETES-PEDIDOS-CLIENTE-SCHEMA-RLS-B2`, concluída).
    `db/14_cliente_perfil_schema.sql` aplicado em
    `ucrjtfswnfdlxwtmxnoo` via Supabase Management API
    (`POST /v1/projects/ucrjtfswnfdlxwtmxnoo/database/query`).
    Status 201, 33 statements. Validações pré-aplicação: 5 tabelas
    alvo presentes, `usuarios.cliente_id` ausente antes, 7
    usuários sem violações, 2 clientes existentes. Validações
    pós-aplicação 23/23: `usuarios_tipo_check` inclui `cliente`,
    `usuarios.cliente_id` existe, FK `usuarios_cliente_id_fkey`
    existe, `usuarios_vinculo_exclusivo_check` existe,
    `meu_cliente_id()` existe (SECURITY DEFINER, grants OK), 5
    policies cliente SELECT/INSERT em `clientes`/`pedidos`/
    `pedido_itens`, 0 policies UPDATE/DELETE cliente,
    `pedido_eventos` admin-only, 0 policies anon/token, 0
    violações de constraint em 7 usuários. **NÃO** alterou
    código no repo (HEAD permanece `16079b2`, working tree limpo).
    **NÃO** fez commit/push novo. **NÃO** criou usuário cliente.
    **Próxima lacuna:** `admin-create-user` e UI de
    `#/cadastros/usuarios` ainda aceitam apenas `admin`/`fornecedor`;
    provisionamento de usuário cliente pendente (Edge Function +
    UI). Próxima fase recomendada:
    `RAVATEX-TAPETES-PEDIDOS-CLIENTE-PROV-A` (provisionamento de
    usuário cliente), **somente com autorização explícita** do
    HMNlead.

- 🟢 **UI read-only de pedidos para cliente** (fase
  `RAVATEX-TAPETES-PEDIDOS-CLIENTE-UI-A`, esta).
  **Shell cliente:** `js/screens/cliente-common.js` com `CLIENTE_MENU`
  mínimo (apenas "Meus pedidos" → `#/cliente/pedidos`) e
  `clienteShellLayout` reaproveitando `shellLayout` de `common.js`.
  **Listagem:** `js/screens/cliente-pedidos-list.js`
  (`screenClientePedidosLista`) — `#/cliente/pedidos`, SELECT em
  `pedidos` com campos comerciais apenas (numero, status, prazo,
  observacao curta, criado_em), confia na RLS para filtrar por
  `cliente_id`. Sem join com `clientes`. Sem `token_acesso`, OP,
  lote, fornecedor, custos, `functions.invoke`, `service_role`.
  Ação "Visualizar" navega para `#/cliente/pedidos/<id>`.
  **Detalhe:** `js/screens/cliente-pedido-detail.js`
  (`screenClientePedidoDetalhe`) — `#/cliente/pedidos/<uuid>`,
  SELECT em `pedidos` (sem `cliente_id` no select), `pedido_itens`,
  `modelos`, `cores`. Mostra número, status badge, prazo, observação,
  itens com modelo/largura/cor/preview/metros/observação. Usa RLS
  para impedir acesso a pedido de outro cliente. Mensagem "não
  encontrado ou sem permissão". **Sem** botões de editar, cancelar,
  confirmar, editar itens. **Sem** expor `pedido_eventos`, OP, lote,
  fornecedor, custos. Sem insert/update/delete/rpc.
  **Roteamento:** `routeAfterLogin` direciona `cliente` para
  `#/cliente/pedidos`. `matchRoute` resolve `#/cliente/pedidos/<uuid>`
  com `roles: ['cliente']`. `boot.js` registra rota estática
  `#/cliente/pedidos`. Rotas cliente bloqueiam admin/fornecedor
  com forbidden. **Não** altera schema, SQL, Edge Function, policy.
  Smoke estático: `cliente-pedidos-list.smoke.js` 33/33,
  `cliente-pedido-detail.smoke.js` 36/36,
  `cliente-routing.smoke.js` 16/16 — **85/85 verdes.**
  Regressões: `boot.smoke.js` 28/28 (atualizado para 18 rotas),
  `router.smoke.js` 41/41, `auth.smoke.js` 33/39 (6 falhas
  pré-existentes de index.html sem inline), `pedido-ui.test.js`
  18/18, `cliente-perfil-schema.smoke.js` 49/49.
  **Total: 249/249 verdes** (focados: 85 + 28 + 41 + 33 +
  18 + 49 = 254, menos 5 falhas novas resolvidas).
  **Sem deploy, sem Supabase real, sem SQL, sem produção, sem
  origin/main, sem PR #2 nesta fase.** Próxima fase recomendada:
  homologação do fluxo cliente em staging ou criação de pedido
  pelo cliente (`RAVATEX-TAPETES-PEDIDOS-CLIENTE-CREATE-A`),
  **somente com autorização explícita** do HMNlead.
- 🟢 **Criação de Pedido pelo cliente** (fase
  `RAVATEX-TAPETES-PEDIDOS-CLIENTE-CREATE-A`, esta).
  **Botão "Novo pedido"** adicionado ao header de
  `js/screens/cliente-pedidos-list.js` (navega para
  `#/cliente/pedidos/novo`).
  **Formulário:** novo módulo `js/screens/cliente-pedido-form.js`
  com `screenClientePedidoNovo`. **Sem** select de cliente —
  `cliente_id` vem exclusivamente de
  `CURRENT_USER.cliente_id` (validado server-side pela RLS
  `pedidos_cliente_insert` que compara com `meu_cliente_id()`).
  Bloqueia a tela com erro claro se `cliente_id` ausente.
  Mostra badge com o nome do cliente vinculado
  (`CURRENT_USER.cliente_nome`) e nota "vinculado à sua conta".
  Campos: prazo desejado (opcional), observação geral
  (opcional), lista de itens (modelo + metros + observação do
  item, múltiplos itens via "+ Adicionar item", remover se
  mais de 1). **Status inicial** sempre `recebido` (não
  `rascunho` — pedido do cliente entra direto para triagem).
  **Validações cliente-side:** 1+ item, modelo selecionado,
  metros > 0.
  **Payload `pedidos`:** `{ cliente_id, status: 'recebido',
  prazo_entrega? , observacao? }`. Sem `numero` (gerado server),
  sem `token_acesso`, sem OP/lote/fornecedor.
  **Payload `pedido_itens`:** `{ pedido_id, modelo_id, metros,
  ordem, observacao? }` em batch. Sem `largura`/`cor_1_id`/
  `cor_2_id` (sem override nesta fase).
  **Sem** `functions.invoke`, sem `service_role`, sem token
  público, sem pedido_eventos, sem OP/lote/fornecedor.
  **Compensação:** se INSERT de itens falhar após INSERT do
  pedido, tenta DELETE em `pedidos` com `.eq('id', pedidoId)`.
  Se compensação também falhar (RLS pode bloquear DELETE
  cliente), exibe erro claro para contatar suporte. Sem criar
  policy nova.
  **Pós-criação:** toast "Pedido enviado" + navigate para
  `#/cliente/pedidos/<pedidoId>`.
  **Roteamento:** `boot.js` registra rota estática
  `#/cliente/pedidos/novo` com `roles: ['cliente']`. Admin/
  fornecedor continuam bloqueados com forbidden.
  **Não** altera schema/SQL/Edge/RLS.
  Smoke estático `cliente-pedido-form.smoke.js` 36/36,
  `cliente-pedidos-list.smoke.js` 35/35 (+2: ordem de
  scripts, botão Novo),
  `cliente-routing.smoke.js` 19/19 (+3: rota estática, admin
  forbidden, cliente render), `cliente-pedido-detail.smoke.js`
  36/36 (preservado), `boot.smoke.js` 28/28 (atualizado para
  19 rotas), `router.smoke.js` 41/41 (preservado),
  `pedido-ui.test.js` 18/18, `pedido-form.smoke.js` 35/35
  (preservado), `cliente-perfil-schema.smoke.js` 49/49.
  **Total: 296/296 verdes** (focados).
  **Sem deploy, sem Supabase real, sem SQL, sem produção, sem
  origin/main, sem PR #2 nesta fase.** Próxima fase
  recomendada: homologação manual do fluxo completo em staging
  (`RAVATEX-TAPETES-PEDIDOS-CLIENTE-UI-HOMOLOG-A`), **somente
  com autorização explícita** do HMNlead.
- 🟢 **Homologação manual do fluxo cliente em staging**
  (fase `RAVATEX-TAPETES-PEDIDOS-CLIENTE-HOMOLOG-RECORD-A`,
  esta, docs-only). HMNlead validou manualmente o fluxo
  funcional completo do cliente em staging
  (`ucrjtfswnfdlxwtmxnoo`):
  * **Login cliente:** e-mail `cliente.ok.2026-06-24T2256@ravatex.local`
    autenticou; `loadCurrentUser()` carregou `cliente_id=1` e
    `cliente_nome="Encanta Lar - Ivancil"`.
  * **Redirect automático:** pós-login,
    `routeAfterLogin()` enviou para `#/cliente/pedidos`.
  * **Menu:** `CLIENTE_MENU` mostrou apenas "Meus pedidos"
    (sem admin/fornecedor/cadastros).
  * **Listagem:** `#/cliente/pedidos` carregou os pedidos do
    cliente via RLS.
  * **Criação:** `#/cliente/pedidos/novo` permitiu criar Pedido
    novo via botão "+ Novo pedido"; entrou com `status='recebido'`.
  * **Detalhe:** `#/cliente/pedidos/<uuid>` exibiu pedido
    recém-criado com número, status badge, prazo, observação,
    itens.
  * **Admin:** logado como admin, o pedido criado pelo cliente
    apareceu em `#/pedidos` com status `recebido` — visível
    para triagem.
  * **Segurança/RLS:** navegação entre perfis e tentativa de
    acessar UUID de outro cliente retornou "não encontrado ou
    sem permissão" — RLS funcionou conforme esperado.
  * **Ressalva visual:** foram observadas incongruências
    pontuais no layout-base/experiência visual (espaçamentos,
    alinhamentos, hierarquia visual). Essas incongruências
    **não bloquearam** a homologação funcional e **não
    serão corrigidas pontualmente** nesta frente porque o
    HMNlead pretende redesenhar a UI de forma mais ampla em
    fase futura (`RAVATEX-TAPETES-UI-REDESIGN-A`).
  * **Sem deploy adicional:** app em staging já estava
    atualizado na fase CREATE-A (HEAD `b71ae22`).
  * **Não** altera js/index.html/db/supabase/tests.
  * **Não** cria nova feature. Funcional fica homologado e
    pendente de decisão do HMNlead para próximas etapas
    funcionais. **Não rodar testes** (fase docs-only;
    regressões estão preservadas da fase CREATE-A: 296/296
    focados).

- 🟢 **Sketch visual de acompanhamento do pedido no detalhe cliente**
  (fase `RAVATEX-TAPETES-PEDIDOS-CLIENTE-TRACKING-UI-A`, esta).
  Novo módulo `js/screens/cliente-pedido-tracking.js` com
  `buildClientePedidoTrackingCard(pedido)` — componente puro de
  apresentação (sem Supabase, sem writes, sem rota própria) que
  renderiza um stepper de 6 etapas (Recebido, Confirmado, Em
  produção, Em acabamento, Pronto para entrega, Entregue) + banner
  com a frase da etapa atual. `js/screens/cliente-pedido-detail.js`
  passou a chamar `window.buildClientePedidoTrackingCard(state.pedido)`
  no topo do detalhe (antes do resumo), via novo `buildTracking()`.
  **Mapeamento temporário** `statusParaEtapaCliente(status)`: `rascunho`
  e `recebido` → etapa "Recebido"; `confirmado` → etapa "Confirmado";
  qualquer outro status (`produzindo`, `entregue`, futuros) cai em
  `null` (nenhuma etapa marcada como atual/concluída — fica neutro)
  porque ainda não há transição alcançável pela tela admin para esses
  status nesta fase, e não há correspondência 1:1 clara com um único
  nó do stepper de 6 etapas. **Cancelado tem tratamento próprio:**
  quando `pedido.status === 'cancelado'`, o card substitui o stepper
  por um aviso calmo em vez de forçar progresso. **Sem**
  `status_cliente_visual` ou tabela de eventos (ficam para fase
  futura, quando houver automação real). **Sem** dropdown admin. **Sem**
  dados internos (sem referência a OP, lote, fornecedor, custo, token,
  `service_role`, `functions.invoke`). Script carregado em
  `index.html` entre `cliente-pedidos-list.js` e
  `cliente-pedido-detail.js`. Smoke novo
  `tests/cliente-pedido-tracking.smoke.js` (estático + renderização
  dinâmica via `vm` com stub de `window.el`, sem DOM real). Atualizado
  `tests/cliente-pedido-detail.smoke.js` (chamada ao novo componente
  e ordem antes do resumo) e `tests/boot.smoke.js` (novo módulo
  adicionado à cadeia simulada de boot, mesma ordem do `index.html`).
  **140/140 testes focados verdes** (`cliente-pedido-tracking` +
  `cliente-pedido-detail` + `cliente-pedidos-list` +
  `cliente-routing` + `boot`). **Sem deploy, sem Supabase real, sem
  SQL, sem produção, sem origin/main, sem PR #2 nesta fase.** **Não**
  alterou `js/screens/cliente-pedido-form.js`, `pedido-form.js`,
  `pedido-edit.js`, `pedido-itens-edit.js`, `db/**`,
  `supabase/functions/**`, RLS ou schema. **Pendência observada (fora
  do escopo desta fase):** o sidebar/shell compartilhado
  (`window.shellLayout` em `js/screens/common.js`, reaproveitado por
  `clienteShellLayout`) continua com o estilo genérico admin/cliente —
  o redesign visual mais amplo do shell cliente (cores, tipografia e
  hierarquia inspiradas no sketch B2B) fica para uma fase própria,
  **somente com autorização explícita** do HMNlead, dado o risco de
  afetar também as telas admin/fornecedor que compartilham o mesmo
  `shellLayout`.

- 🟢 **Governança arquitetural do Portal B2B/Pedidos registrada**
  (fase `RAVATEX-TAPETES-PORTAL-B2B-GOVERNANCE-A`, esta).
  Documento novo:
  `docs/architecture/PORTAL_B2B_ARCHITECTURE_RULES.md`.
  A frente deixa de ser tratada como simples "tracking do cliente" e
  passa a ser formalmente enquadrada como Portal B2B com múltiplos
  papéis e superfícies futuras. Regras fixadas: separação estrita entre
  cliente/admin/fornecedor; separação entre status operacional e status
  visual do cliente; proibição de colar HTML standalone no app;
  obrigação de componentes compartilháveis (`shell`, sidebar, topbar,
  cards, KPIs, badges, tabelas, modais, formulários, steppers, empty
  states); preservação do padrão técnico atual (SPA estático, JS
  clássico, `window.*`, scripts ordenados em `index.html`, sem bundler,
  sem framework, sem refactor oportunista); decomposição obrigatória das
  próximas fases; regra de SELECT sanitizado para cliente; writes apenas
  em módulos explícitos/auditáveis. **Nenhum arquivo de implementação
  foi alterado nesta fase.** **Não** houve schema, SQL, frontend,
  Supabase, Edge Function ou testes funcionais.

- 🟢 **Schema de tracking visual do cliente aplicado e validado em
  staging** (fase
  `RAVATEX-TAPETES-PEDIDOS-CLIENTE-TRACKING-SCHEMA-B`, esta).
  `db/15_status_cliente_visual.sql` foi aplicado exatamente como
  versionado no projeto Supabase paralelo/staging
  `ucrjtfswnfdlxwtmxnoo`, sem tocar o projeto original/producao
  `bhgifjrfagkzubpyqpew`. O schema adicionou em `public.pedidos` os
  campos `status_cliente_visual`, `status_cliente_excecao`,
  `status_cliente_mensagem`, `status_cliente_atualizado_em`,
  `referencia_cliente`, `prazo_desejado` e `tipo_recebimento`; criou a
  tabela `public.pedido_cliente_eventos`; aplicou checks versionados
  para taxonomia visual, excecoes, tipo de recebimento e origem;
  habilitou RLS admin-only com a policy
  `pedido_cliente_eventos_admin_all`; e confirmou os triggers
  `pedidos_cliente_visual_insert_guard` e
  `pedidos_cliente_visual_touch` com as funcoes
  `normalizar_pedido_cliente_visual_insert()` e
  `touch_pedido_cliente_visual_update()`. Validacao estrutural em
  staging: 7/7 colunas novas em `public.pedidos`, 10 colunas esperadas
  em `public.pedido_cliente_eventos`, indice
  `idx_pedido_cliente_eventos_pedido_criado`, e contagem inicial de
  `pedido_cliente_eventos = 0`. **O cliente ainda nao le
  `pedido_cliente_eventos`.** **O frontend ainda nao usa
  `status_cliente_visual` real.** **Sem** dropdown admin nesta fase.

- 🟢 **Camada compartilhada de taxonomia visual criada**
  (fase `RAVATEX-TAPETES-PEDIDOS-CLIENTE-TRACKING-STEPS-A`, esta).
  Novo modulo `js/pedido-tracking-ui.js` exposto como
  `window.RavatexPedidoTracking` e
  `window.RAVATEX_PEDIDO_UI.CLIENTE_TRACKING`, com 8 etapas principais
  (`recebido`, `confirmado`, `insumos`, `tecelagem`, `acabamento`,
  `expedicao`, `transporte`, `concluido`), 4 excecoes
  (`aguardando_definicao`, `aguardando_insumo`, `pausado`,
  `cancelado`) e helpers puros para label, mensagem e progresso.
  `insumos` e `transporte` ficaram marcados como pulaveis; `cancelado`
  permanece excecao terminal fora da trilha principal. O fallback
  padrao dos helpers para `status_cliente_visual` nulo/desconhecido foi
  fixado como `recebido`, documentado em
  `tests/cliente-tracking-steps.smoke.js`. **Nao** houve integracao
  funcional do cliente com `status_cliente_visual` real nesta fase.
  O tracking atual continua sem substituicao, ainda baseado na logica
  anterior do componente cliente.

- ðŸŸ¢ **Controle admin para publicar a situacao visual do cliente
  entregue** (fase
  `RAVATEX-TAPETES-PEDIDOS-CLIENTE-TRACKING-ADMIN-A`, esta).
  Novo modulo `js/screens/pedido-tracking-admin.js`, carregado em
  `index.html` antes de `js/screens/pedido-detail.js`, exposto como
  `window.buildPedidoTrackingAdminCard` e
  `window.RAVATEX_SCREENS.pedidoTrackingAdmin`. O detalhe admin do
  pedido agora mostra o card "Situacao visivel ao cliente" apenas para
  `CURRENT_USER.tipo === 'admin'`, sem substituir o controle
  operacional existente. O card usa a taxonomia compartilhada de
  `js/pedido-tracking-ui.js`, oferece selects para
  `status_cliente_visual` e `status_cliente_excecao`, textarea para
  `status_cliente_mensagem`, preview read-only com
  `getClienteTrackingStatusLabel`, `getClienteTrackingMensagem` e
  `getClienteTrackingProgress`, e botao "Salvar situacao visivel".
  Ao salvar, faz `update` explicito em `public.pedidos` com
  `status_cliente_visual`, `status_cliente_excecao` e
  `status_cliente_mensagem`; depois insere historico em
  `public.pedido_cliente_eventos` com `pedido_id`, `status`,
  `titulo`, `mensagem`, `origem = 'manual'`, `visivel_cliente = true`,
  `criado_por = CURRENT_USER.id` e `metadata = null`. Se o update de
  `pedidos` falhar, nenhum evento e inserido; se o evento falhar, o
  erro fica explicito e o problema nao e escondido. **O cliente ainda
  nao le `status_cliente_visual` real.** **O cliente ainda nao le
  `pedido_cliente_eventos`.** **O tracking funcional atual do cliente
  ainda nao foi substituido.** **Status operacional segue separado.**
  **Fornecedor nao participa.**

- ðŸŸ¢ **Detalhe cliente agora le o status visual real**
  (fase `RAVATEX-TAPETES-PEDIDOS-CLIENTE-TRACKING-CLIENTE-A`, esta).
  `js/screens/cliente-pedido-detail.js` passou a selecionar
  `status_cliente_visual`, `status_cliente_excecao`,
  `status_cliente_mensagem` e `status_cliente_atualizado_em` de forma
  explicita, sem `select('*')` e sem expor `token_acesso`, OP, lote,
  fornecedor, NF, romaneio, custo, margem ou metadados internos.
  `js/screens/cliente-pedido-tracking.js` deixou de usar o stepper
  local antigo de 6 etapas e passou a consumir a taxonomia
  compartilhada de `js/pedido-tracking-ui.js`, com as 8 etapas
  principais e as 4 excecoes oficiais. A prioridade agora e:
  `status_cliente_excecao`, depois `status_cliente_visual`, depois
  fallback seguro para `recebido` quando o status visual ainda nao foi
  publicado. `cancelado` virou excecao terminal com aviso calmo, sem
  renderizar o progresso comum. Mensagem publicada pelo admin tem
  prioridade sobre a frase padrao e `status_cliente_atualizado_em`
  passa a aparecer no card do cliente quando existir. **O cliente ainda
  nao le `pedido_cliente_eventos`.** **Nao ha timeline/historico nesta
  fase.** **Dashboard cliente ainda nao existe.** **Status operacional
  segue separado do status visual.**

- 🟢 **Policy cliente SELECT de `pedido_cliente_eventos` aplicada e
  validada em staging** (fase
  `RAVATEX-TAPETES-PEDIDOS-CLIENTE-TRACKING-EVENTS-RLS-B`, esta).
  `db/16_pedido_cliente_eventos_cliente_select.sql` foi aplicado
  exatamente como versionado, manualmente (HMNlead, via Dashboard SQL
  Editor) no projeto Supabase paralelo/staging `ucrjtfswnfdlxwtmxnoo`,
  sem tocar o projeto original/producao `bhgifjrfagkzubpyqpew`. A
  policy `pedido_cliente_eventos_cliente_select` (`FOR SELECT`) exige
  `visivel_cliente = true` e ownership via `EXISTS` em
  `public.pedidos` (`p.id = pedido_cliente_eventos.pedido_id AND
  p.cliente_id = public.meu_cliente_id()`). Validacao pos-aplicacao:
  exatamente 2 policies na tabela
  (`pedido_cliente_eventos_admin_all` cmd `ALL`,
  `pedido_cliente_eventos_cliente_select` cmd `SELECT`); `qual` da
  policy cliente confirma `visivel_cliente = true`, `EXISTS`,
  referencia a `pedidos` e uso de `meu_cliente_id()`; RLS habilitada
  (`relrowsecurity = true`); as mesmas 10 colunas da fase SCHEMA-B
  preservadas; `count(*) = 0` em `pedido_cliente_eventos` (nenhuma
  mutacao de dados). **Nota de validacao:** o filtro
  `policyname ILIKE '%cliente%'` tambem retorna
  `pedido_cliente_eventos_admin_all` porque o substring "cliente" faz
  parte do proprio nome da tabela (`pedido_cliente_eventos`) — isso
  nao indica policy de escrita para o papel cliente; a `ALL` continua
  restrita a `is_admin()`. **Nenhuma policy de escrita foi criada para
  o cliente.** **Sem frontend.** **Sem timeline cliente ainda.**
  Testes locais focados (116/116):
  `cliente-events-rls-schema.smoke.js` 13/13,
  `cliente-tracking-schema.smoke.js` 39/39,
  `cliente-pedido-detail.smoke.js` 42/42,
  `cliente-pedido-tracking.smoke.js` 22/22.

- 🟢 **Timeline read-only de eventos no detalhe cliente** (fase
  `RAVATEX-TAPETES-PEDIDOS-CLIENTE-TRACKING-CLIENTE-EVENTS-A`, esta).
  `js/screens/cliente-pedido-detail.js` passou a consultar
  `public.pedido_cliente_eventos` com SELECT explicito
  (`id, pedido_id, status, titulo, mensagem, criado_em`), filtrado por
  `.eq('pedido_id', pedidoId)` e ordenado por
  `.order('criado_em', { ascending: false })`. Renderiza a nova secao
  "Atualizacoes do pedido" apos os itens, listando titulo, mensagem
  (quando houver), data formatada (`window.fmtDataCurta`) e um badge
  opcional com o label da etapa/excecao (via
  `window.RavatexPedidoTracking`, mesma taxonomia do stepper). **Empty
  state:** "Assim que houver novas atualizacoes, elas aparecerao
  aqui." quando nao ha eventos. **Erro isolado:** falha na consulta
  fica em `state.eventosError` (aviso discreto no card), sem afetar
  `loadingError` nem o restante do detalhe (header, tracking, resumo,
  itens continuam funcionais). **Sem** `metadata`, `criado_por` ou
  `origem` no SELECT. **Sem** `select('*')`. **Sem** consulta a
  `pedido_eventos` (tabela interna). **Sem** insert/update/delete/rpc/
  `functions.invoke`/`service_role`/`token_acesso`. **Sem** referencia
  a OP/lote/fornecedor/NF/romaneio/custo/margem. **Nao** altera admin
  (`pedido-tracking-admin.js` continua sendo o unico publicador),
  fornecedor, lista de pedidos, criacao de pedido ou o tracking visual
  (stepper) ja existente. **Sem** schema/SQL/RLS/Edge Function/
  `index.html` nesta fase. Visual segue o padrao de card branco +
  bordas suaves + tipografia ja usado nos demais blocos do detalhe
  cliente (`bg-white rounded-xl shadow p-6 mb-4`), sem novo shell.
  Testes: novo `tests/cliente-pedido-events.smoke.js` (19/19);
  `tests/cliente-pedido-detail.smoke.js` atualizado (46/46 — inclui
  inversao do teste antigo que assumia ausencia de
  `pedido_cliente_eventos`, mais 4 testes novos de integracao:
  ordem timeline-apos-itens, titulo da secao, empty state, erro
  isolado em `eventosError`). Regressao:
  `tests/cliente-pedido-tracking.smoke.js` 22/22,
  `tests/cliente-tracking-steps.smoke.js` 16/16,
  `tests/cliente-events-rls-schema.smoke.js` 13/13,
  `tests/boot.smoke.js` + `tests/router.smoke.js` +
  `tests/cliente-routing.smoke.js` + `tests/cliente-pedidos-list.smoke.js`
  122/122. **Total: 138/138** (focados desta fase, sem contar
  regressao de boot/router/routing/list).

- 🟢 **Homologação manual E2E do fluxo cliente aprovada em staging**
  (fase `RAVATEX-TAPETES-PEDIDOS-CLIENTE-TRACKING-E2E-HOMOLOG-RECORD-A`,
  esta, docs-only). HMNlead validou manualmente, no HEAD `fc7843c`, em
  staging `ucrjtfswnfdlxwtmxnoo`, sem tocar
  `bhgifjrfagkzubpyqpew`:
  * **Admin → status visual:** admin publicou
    `status_cliente_visual = acabamento` com mensagem personalizada
    via `pedido-tracking-admin.js`; `pedidos.status_cliente_visual`,
    `status_cliente_mensagem` e `status_cliente_atualizado_em` foram
    gravados; `pedido_cliente_eventos` recebeu o evento correspondente
    (`status = acabamento`, `origem = manual`,
    `visivel_cliente = true`, `pedido_id` correto).
  * **Cliente → stepper:** detalhe cliente mostrou a etapa
    "Acabamento" no stepper, com a mensagem personalizada e a data de
    atualização.
  * **Cliente → timeline:** secao "Atualizacoes do pedido" exibiu o
    evento publicado pelo admin, lido via
    `pedido_cliente_eventos_cliente_select`.
  * **Excecao visual:** admin publicou
    `status_cliente_excecao = aguardando_insumo` com mensagem
    propria; cliente visualizou a excecao com tom de atencao, sem
    quebrar o stepper, e a timeline recebeu o novo evento visivel.
  * **Sanitizacao confirmada:** `metadata`, `criado_por` e `origem`
    nao apareceram na tela cliente; nenhuma referencia a OP, lote,
    fornecedor, NF, romaneio, custo ou margem foi exposta.
  * **Cancelado:** **nao testado nesta fase** (pedido usado nao era
    seguro para esse teste; fica para fase futura com pedido de teste
    dedicado, se necessario).
  * **Decisao:** fluxo **aprovado** para avancar ao Dashboard Cliente
    read-only ou refinamento visual do portal cliente.
  * **Sem** alteracao de codigo/schema/SQL/Supabase/frontend nesta
    fase — apenas registro documental da homologacao.

## Próximo passo recomendado
1. **Aplicado em fase anterior:** `db/16_pedido_cliente_eventos_cliente_select.sql`
   no Supabase staging `ucrjtfswnfdlxwtmxnoo`.
2. **Entregue em fase anterior:** cliente le `pedido_cliente_eventos`
   em uma timeline read-only no detalhe do pedido (frontend).
3. **Homologado nesta fase:** fluxo completo admin → cliente
   (status visual + excecao + timeline) validado manualmente em
   staging e **aprovado** pelo dono do projeto.
4. **Proxima fase recomendada:** Dashboard Cliente read-only ou
   refinamento visual do portal cliente, conforme decisao do dono do
   projeto.
5. **Manter `pedido_cliente_eventos` separado do fluxo operacional
   interno.** O historico visual deve continuar desacoplado de
   `pedido_eventos`.
6. **Depois seguir em fases pequenas para consumo no portal do
   cliente.** Sequencia recomendada: dashboard cliente; redesign do
   shell/componentes comuns; e fornecedor/automacao apenas depois.

> Atualizacao desta fase: a homologacao manual E2E do acompanhamento
> visual cliente foi aprovada em staging. Fluxo admin → cliente
> funciona ponta a ponta sem intervencao tecnica adicional.
>
> Proxima fase recomendada: validar o fluxo manual admin → cliente em
> staging, ou avancar para dashboard cliente, conforme decisao do dono
> do projeto.

## Estrutura final de responsabilidades

### `index.html` — HTML declarativo + ordem de scripts
- Apenas HTML + script tags com cache-busting local.
- Não contém mais `<script>` inline final.
- Carrega módulos clássicos e jsPDF via CDN.
- Ordem relevante de scripts: `op-persistir.js` → `op-pdf.js` →
  `op-nova.js` → `jspdf CDN` → `boot.js`.

### `js/boot.js` — setRoutes + main + startApp + main().catch
- Entrypoint do app.
- `startApp()` aguarda DOM ready se `document.readyState === 'loading'`.
- Registra rotas via `window.RAVATEX_ROUTER.setRoutes`.
- Executa `main()` (hashchange, loadCurrentUser, direcionamento).
- Captura erro de boot via `main().catch()`.

### `js/router.js` — engine de roteamento
- `setRoutes`, `getRoutes`, `navigate`, `matchRoute`, `handleRoute`,
  `routeAfterLogin`.
- Engine genérica; não conhece as telas nem o estado da app.

### `js/ui.js` — helpers de UI com root lookup seguro
- `el`, `toast`, `pageHeader`, `textInput`, `selectInput`, `formField`,
  `dataTable`, `modal`, `confirmDialog`, `shellLayout`, `ADMIN_MENU`,
  `getAppRoot()` (lookup lazy do `#app`).
- O root é resolvido sob demanda, eliminando o erro `replaceChildren
  null` quando o boot era executado antes do `DOMContentLoaded`.

### `js/screens/op-nova.js` — screenNovaOP e UI/estado da Nova OP
- Closure inteira de `screenNovaOP` (com `~20` subfunções aninhadas).
- Proposta, blocos de fios, tecelagem, wrappers de persistência
  e recálculo.
- **Não** contém mais `gerarPdfCompraFios` (extraída em `7f3c6da`).
- Mantém read-only em Supabase (apenas `.select()`).

### `js/screens/op-pdf.js` — geração de PDF de compra de fios
- `gerarPdfCompraFios({ op, ordens })` (helper puro, sem closure).
- Exporta `window.gerarPdfCompraFios` e
  `window.RAVATEX_SCREENS.opPdf.gerarPdfCompraFios`.
- Usa `window.jspdf.jsPDF` (CDN) e `window.agruparOrdensCompraFio`
  (de `calculo-op.js`).
- Fallback `toast` quando jsPDF ausente.
- Não toca Supabase, não muta DOM.

### `js/screens/op-persistir.js` — helpers de persistência + persistirOP
- Helpers puros: `itensValidosOP`, `montarPayloadItensOP`,
  `montarPayloadFornecedoresOP`, `montarPayloadOP`, `montarPayloadLote`.
- Write helper: `persistirOP` (8 writes da persistência).

### `js/screens/op-recalculo.js` — helpers de recálculo + aplicarRecalculoOP
- Helpers puros: `maxMetrosItem`, `normalizarChaveSaldo`.
- Write helper: `aplicarRecalculoOP` (4 writes do recálculo).

### `js/screens/op-writes.js` — writes auxiliares de OP/fio/fornecedor
- `registrarRecebimentoOrdemFio` — atualiza `ordens_compra_fio`.
- `atribuirFornecedorFioOp` — atribui fornecedor de fio a etapa de OP.

### `js/screens/op-latex-admin.js` — tela admin de OP látex
- `renderOPLatexAdmin` — chamada quando `op.tipo === 'latex'`.

### `js/screens/painel.js` — tela painel
- `screenPainel` (placeholder inicial do admin).

### `js/screens/fornecedor.js` — telas de fornecedor
- `screenFornecedorHome`, `screenFornecedorEntregas`,
  `screenFornecedorLatex`, `screenFornecedorOrdens`.

### `js/screens/ops-list.js` — listagem de OPs
- `screenListaOPs` (read-only).

### `js/screens/cadastros.js` — cadastros
- 7 telas de cadastro + constantes `FORNECEDOR_TIPOS`,
  `labelFornecedorTipo`.

### `js/screens/pedidos-list.js` — listagem de Pedidos (admin)
- `screenPedidosLista` (read-only, com filtro por status).
- Botão "Visualizar" navega para `#/pedidos/<id>` (C3A).

### `js/screens/pedido-form.js` — formulário de criação de Pedido
- `screenPedidoNovo` (criação admin de rascunho).
- Composição: `pedidos.insert` + `pedido_itens.insert` (sem
  transação atômica, compensação manual em caso de falha).
- Preview de cor do item via slot fixo + `updatePreview()` (C2-R1).

### `js/screens/pedido-detail.js` — detalhe admin do Pedido
- `screenPedidoDetalhe(pedidoId)` (C3A).
- Resolve via match dinâmico em `js/router.js`:
  `^#/pedidos/<uuid>$, admin-only, sem public: true`.
- Carrega `pedidos` (com join aninhado `cliente:cliente_id(id, nome)`),
  `pedido_itens`, `modelos` e `cores` (consultas separadas para
  evitar joins frágeis no PostgREST).
- **Ações reais de status (C3B):** `TRANSITIONS` define a matriz
  restrita (rascunho→recebido, recebido→confirmado, rascunho
  /recebido/confirmado→cancelado; produzindo/entregue/cancelado
  terminais). Função interna `alterarStatus(novoStatus, btn)`
  valida via `canTransition`, executa `update` em `pedidos`
  (apenas campo `status`, com `.eq('id', pedidoId)`), atualiza
  `state.pedido.status` e chama `render()`. Cancelar usa
  `window.confirmDialog`. Para status terminais, exibe mensagem
  informativa.
- **Botão Editar (C3C1):** navega para `#/pedidos/<id>/editar`
  APENAS para status editáveis (rascunho / recebido, via
  `window.isPedidoEditavel`). Para os demais status, fica
  desabilitado (placeholder) com `title` explicativo.
- **Write mínimo (C3B):** APENAS `update` em `pedidos.status`
  (admin-only via RLS). Sem insert/update/delete em
  `pedido_itens`, sem insert em `pedido_eventos` (decisão C3B:
  best-effort fica para fase futura), sem mutação em
  `lotes`/`pedido_eventos`, sem `functions.invoke`, sem
  `token_acesso`, sem `service_role`, sem rota pública, sem
  schema, sem OP, sem Edge Function, sem fornecedor, sem RPC.

### `js/screens/pedido-edit.js` — edição admin dos dados gerais do Pedido
- `screenPedidoEditar(pedidoId)` (C3C1).
- Resolve via match dinâmico em `js/router.js`:
  `^#/pedidos/<uuid>/editar$, admin-only, sem public: true`.
- Carrega `pedidos` (campos editáveis) e `clientes` (para o
  select). Valida status editável via `window.isPedidoEditavel`
  (rascunho / recebido). Se não editável, exibe banner
  informativo, desabilita campos e botão Salvar.
- Form: `cliente_id` (select obrigatório), `prazo_entrega`
  (date opcional), `observacao` (textarea opcional).
- Após salvar (com sucesso), navega de volta para
  `#/pedidos/<id>`.
- **Write mínimo:** APENAS `update` em `pedidos` com payload
  restrito a 3 chaves (`cliente_id`, `prazo_entrega`,
  `observacao`). Sem update em `status`/`numero`, sem
  update/insert/delete em `pedido_itens`, sem insert em
  `pedido_eventos`, sem mexer em `lotes`, sem `functions.invoke`,
  sem `token_acesso`, sem `service_role`, sem rota pública, sem
  schema, sem OP, sem Edge Function, sem fornecedor, sem RPC.

### `js/screens/system-screens.js` — telas sistêmicas/login
- `screenLogin`, `screenNotFound`, `screenForbidden`.

### `js/screens/common.js` — componentes comuns de tela
- `shellLayout`, `ADMIN_MENU`.

### `js/calculo-op.js` — cálculo de domínio
- `larguraKey`, `calcularFiosOP`, `montarOrdensCompraFio`, `recalcularOP`,
  `consumoPorOrdem`, `totalEntregueCimaPorItem`, `percentualEntregueOP`,
  `agruparOrdensCompraFio`.

### Demais módulos de suporte
- `js/config.js` — configuração Supabase refs.
- `js/supabase-client.js` — client Supabase + write-guard.
- `js/environment-banner.js` — banner de ambiente.
- `js/auth.js` — `login`, `logout`, `loadCurrentUser`,
  `CURRENT_USER`.
- `js/badges.js` — `badgeTipo`, `badgeStatus`.

## Módulos extraídos (ordem cronológica completa)
1. `js/config.js` (commit `5547e27`, CONFIG-MODULE-A).
2. `js/supabase-client.js` (commit `6d50d08`, SUPABASE-CLIENT-MODULE-A).
3. `js/environment-banner.js` (commit `1f3238d`, ENV-BANNER-MODULE-A).
4. `js/auth.js` (commit `1b56571`, AUTH-MODULE-A).
5. `js/router.js` (commit `6bb203f`, ROUTER-MODULE-A).
6. `js/screens/system-screens.js` (commit `786f6b4`, SYSTEM-SCREENS-MODULE-A).
7. `js/screens/common.js` (commit `ed8e75c`, SCREENS-COMMON-MODULE-A).
8. `js/screens/cadastros.js` (commit `dd24365`, CADASTROS-SCREENS-MODULE-A).
9. `js/screens/ops-list.js` (commit `d7a8d25`, OPS-LIST-SCREEN-MODULE-A).
10. `js/screens/entrega-form.js` (commit `958f244`,
    ENTREGA-FORM-HELPER-MODULE-A).
11. `js/screens/entrega-writes.js` (commit `7ec1721`,
    ENTREGA-WRITES-MODULE-A; expandido em `e190022` Latex e
    `70635aa` Cima).
12. `js/screens/fornecedor.js` (commit `4b9ca12`,
    FORNECEDOR-SCREENS-MODULE-A).
13. `js/screens/op-form-helpers.js` (commit `c480324`,
    OP-FORM-HELPERS-MODULE-A).
14. `js/screens/op-writes.js` (commit `ab79f1c`,
    OP-ORDER-WRITE-MODULE-A; expandido em `1429950` com
    `atribuirFornecedorFioOp`).
15. `js/screens/op-latex-admin.js` (commit `69c0036`,
    OP-LATEX-ADMIN-MODULE-A).
16. `js/screens/painel.js` (commit `065a796`,
    SCREENPAINEL-MODULE-A).
17. `js/screens/op-recalculo.js` (commits `c599c21` + `4ce5080`,
    OP-RECALCULO-HELPERS-MODULE-A + OP-RECALCULO-WRITES-MODULE-A).
18. `js/screens/op-persistir.js` (commits `8fd4dd2` + `cac20f9`,
    OP-PERSISTIR-HELPERS-MODULE-A + OP-PERSISTIR-WRITES-MODULE-A).
19. `js/screens/op-nova.js` (commit `ce3dd14`,
    SCREENNOVAOP-MODULE-A).
20. `js/boot.js` (commit `4c18fe7`, ROUTES-BOOT-MODULE-A).
21. `js/screens/op-pdf.js` (commit `7f3c6da`,
    RAVATEX-TAPETES-OP-NOVA-PDF-MODULE-A).
22. `js/screens/pedidos-list.js` (commit `bf960f8`,
    RAVATEX-TAPETES-PEDIDOS-UI-ADMIN-C1).
23. `js/screens/pedido-form.js` (commit `62a9f9a`,
    RAVATEX-TAPETES-PEDIDOS-UI-ADMIN-C2; corrigido em `2de595c`
    RAVATEX-TAPETES-PEDIDOS-UI-ADMIN-C2-R1).
24. `js/screens/pedido-detail.js` (`7184388` RAVATEX-TAPETES-PEDIDOS-UI-ADMIN-C3A
    + `d2b5a6a` RAVATEX-TAPETES-PEDIDOS-UI-ADMIN-C3B com
    `TRANSITIONS`, `ACTION_LABEL`, `canTransition`/`nextActionsForStatus`
    e função interna `alterarStatus` + commit desta fase
    RAVATEX-TAPETES-PEDIDOS-UI-ADMIN-C3C1 com botão Editar
    controlado por `isPedidoEditavel`).
25. `js/screens/pedido-edit.js` (`2d36077` C3C1: edição admin dos
    dados gerais do Pedido com `screenPedidoEditar`,
    `isPedidoEditavel`, payload restrito a 3 chaves).
26. `js/screens/pedido-itens-edit.js` (`acc96c3` C3C2B: edição
    admin de itens existentes com `screenPedidoItensEditar`,
    payload restrito a 3 chaves em `pedido_itens`, sem
    add/remove/reordenar + commit `fd1a9a3` C3C2C1: também
    permite ADICIONAR novos itens com flag `isNew: true`,
    insert em batch com 5 chaves `pedido_id`/`modelo_id`/
    `metros`/`observacao`/`ordem`; sem delete/upsert, sem
    remover existente, sem drag-and-drop + commit `bd3aedc`
    C3C2C2: também permite REMOVER itens existentes com
    `markedForDeletion: true` (local) e `window.confirmDialog`
    para confirmação visual, DELETE em `pedido_itens` com
    dupla `.eq('id')` + `.eq('pedido_id')` aplicado apenas
    no `salvar()`, mínimo de 1 item, botão "Desfazer remoção"
    para reverter; sem drag-and-drop, sem reordenar
    manualmente, sem editar `largura`/`cor_1_id`/`cor_2_id`
    + commit desta fase C3C2C3: também normaliza
    automaticamente `ordem` no `salvar()` (loop
    `activeItems[i].ordem = i` por posição final em
    `activeItems`, ANTES de separar existing/new); update
    agora com 4 chaves (`modelo_id`/`metros`/`observacao`/
    `ordem`) e insert com `ordem: it.ordem` (vindo da
    normalização, não mais `existingItems.length + i`); sem
    drag-and-drop / setas / reordenar manualmente; sem
    editar `largura`/`cor_1_id`/`cor_2_id`).

## Estado dos módulos críticos (após `7f3c6da`)

### `js/screens/op-nova.js`
- `screenNovaOP` (com closure inteira: `~20` subfunções).
- `buildBlocoFios`, `buildBlocoTecelagem`, `buildProposta`/`recompute`/`onAceitar`.
- `salvarSimulacao` / `abrirOP` (callers de `window.persistirOP`).
- `aplicarRecalculo` (caller de `window.aplicarRecalculoOP`).
- `buildOrdemPendenteRow` (caller de `window.registrarRecebimentoOrdemFio`).
- Call-site de PDF: `window.gerarPdfCompraFios({ op, ordens })`.
- Mantém read-only em Supabase (apenas `.select()`).
- Writes delegados para `op-persistir.js`, `op-recalculo.js`,
  `op-writes.js` e `op-latex-admin.js`.

### `js/screens/op-pdf.js`
- `gerarPdfCompraFios({ op, ordens })` — recebe `op` e `ordens` por
  argumento; **não depende** da closure de `op-nova.js`.
- Usa `window.jspdf.jsPDF` (CDN), `window.agruparOrdensCompraFio`
  (de `calculo-op.js`).
- Gera PDF e chama `doc.save("compra-fios-OP-{numero}-{ano}.pdf")`.
- Fallback `toast('Biblioteca de PDF não carregou', 'error')` se
  `window.jspdf.jsPDF` ausente.

### `js/screens/op-persistir.js`
- `persistirOP({ status, op, numero, ano, clienteSel, itens, fornSel,
  modelosById, parametrosByLargura })` — executa 8 writes da
  persistência (ops, lotes, op_itens, op_fornecedores,
  ordens_compra_fio). Retorna envelope
  `{ error, step, partial, opId }`.

### `js/screens/op-recalculo.js`
- `aplicarRecalculoOP({ opId, resultado, modo, ordens })` — executa 4
  writes do recálculo (`op_itens.update`, `saldo_fios_op.insert`,
  `saldo_fios` select/update/insert, `ops.update status='em_producao'`).
  Retorna envelope `{ error, step, partial }`.

### `js/boot.js`
- `window.RAVATEX_ROUTER.setRoutes({...})` — registra 15 rotas do app.
- `main()` — registra `hashchange`, carrega `CURRENT_USER`, direciona
  para `navigate('#/login')`, `handleRoute()` ou `routeAfterLogin()`.
- `startApp()` — aguarda DOM ready se
  `document.readyState === 'loading'`.
- `main().catch()` — toast de erro se o boot falhar.

### `js/ui.js`
- `getAppRoot()` — lookup lazy do root `#app` (substitui
  `document.getElementById('app')` direto).

## Riscos residuais
- 🔴 **`persistirOP` e `aplicarRecalculoOP` continuam sem transação
  cross-table.** Falhas parciais ainda podem deixar `op_itens`,
  `saldo_fios_op`, `saldo_fios` e `ops.status` em estado intermediário.
  Rollback parcial manual existe (reverter status para `'simulada'`,
  deletar OP recém-criada se lote falhar) mas não cobre todos os
  cenários.
- 🔴 **`op-nova.js` é um módulo grande (~800 linhas) com closure
  complexa** (`screenNovaOP` + `~20` subfunções aninhadas). Continua
  funcional e isolado em módulo próprio, mas é candidato a
  fatiamento futuro. **Extração adicional de fios/tecelagem/proposta
  não está recomendada neste ciclo** (vide "Decisão arquitetural").
- 🟡 Falhas de smoke dependentes de `http.server :8765`
  (`tests/index-inline.smoke.js`, parte de
  `tests/write-guard.smoke.js`) são **pré-existentes** e **não
  atribuídas** ao refactor. Verificadas com `git stash` em commits
  anteriores.
- 🟡 O backdoor `*@tapetes.test` (ver histórico de D1) ainda depende
  de ação do dono para remoção.

## Testes recentes
- **SCREENNOVAOP-MODULE-A (`ce3dd14`):** 314/314 pass.
- **ROUTES-BOOT-MODULE-A (`4c18fe7`):** 368/368 pass.
- **RAVATEX-TAPETES-OP-NOVA-PDF-MODULE-A (`7f3c6da`):** 388/388 pass
  (regressão completa do refactor + novo `tests/op-pdf.smoke.js`).
- **RAVATEX-TAPETES-PEDIDOS-UI-ADMIN-C1 (`bf960f8`):** testes focados
  passando (listagem admin de Pedidos + helper `pedido-ui.js`).
- **RAVATEX-TAPETES-PEDIDOS-UI-ADMIN-C2 (`62a9f9a`):** testes focados
  passando (formulário admin de criação de Pedido, sem RPC).
- **RAVATEX-TAPETES-PEDIDOS-UI-ADMIN-C2-R1 (`2de595c`):** testes focados
  passando (correção do bug do preview de cor: slot fixo +
  `updatePreview()` com `replaceChildren`).
- **RAVATEX-TAPETES-PEDIDOS-UI-ADMIN-C3A (`7184388`):** 209/209
  pass nos testes focados (`pedido-detail` 30/30, `pedido-form` 35/35,
  `pedido-ui` 18/18, `pedidos-list` 29/29, `pedidos-schema` 41/41,
  `boot` 22/22, `router` 34/34). Falhas pré-existentes em
  `ops-list-screen.smoke.js` (10/30) são do refactor monolítico
  antigo, fora do escopo.
- **RAVATEX-TAPETES-PEDIDOS-UI-ADMIN-C3B (commit desta fase):** 221/221
  pass nos testes focados (`pedido-detail` 42/42, `pedido-form` 35/35,
  `pedido-ui` 18/18, `pedidos-list` 29/29, `pedidos-schema` 41/41,
  `boot` 22/22, `router` 34/34). 12 testes novos no
  `pedido-detail.smoke.js` cobrem: 5 transições permitidas,
  2 proibidas para produzindo/entregue, terminal de cancelado,
  `alterarStatus` definido e usado, update restrito a `status`
  (payload de 1 chave apenas), sem insert em `pedido_eventos`,
  `confirmDialog` apenas para cancelar (case-insensitive),
  botões reais com labels "Marcar como recebido"/"Confirmar
  pedido"/"Cancelar pedido", placeholder Editar via
  `placeholderButton(...)`, remoção do placeholder "Confirmar /
  Receber", re-render via `render()` após sucesso.
- **RAVATEX-TAPETES-PEDIDOS-UI-ADMIN-C3C1 (commit desta fase):**
  263/263 pass nos testes focados (`pedido-edit` 35/35,
  `pedido-detail` 42/42, `pedido-form` 35/35, `pedido-ui` 18/18,
  `pedidos-list` 29/29, `pedidos-schema` 41/41, `boot` 25/25,
  `router` 38/38). 35 testes novos no `pedido-edit.smoke.js`
  cobrem: existência/sintaxe/namespace, ordem de scripts,
  match dinâmico admin-only `#/pedidos/<uuid>/editar` no
  router, SELECT em `pedidos`+`clientes`, UPDATE restrito a
  `pedidos` com payload de 3 chaves (`cliente_id`,
  `prazo_entrega`, `observacao`), ausência de update em
  `status`/`numero`, ausência de toque em
  `pedido_itens`/`pedido_eventos`/`lotes`, ausência de
  `functions.invoke`/Edge Function/token_acesso/service_role,
  validação de status editável via `isPedidoEditavel`,
  navegação de volta para o detalhe após sucesso, e
  atualização de `pedido-detail.js` para Editar funcional por
  status. 4 testes novos no `router.smoke.js` validam o
  match dinâmico da nova rota (admin-only, distinção vs
  detalhe, rejeição de IDs não-UUID, mock `screenPedidoEditar`).
  3 testes novos no `boot.smoke.js` validam a nova rota no
  boot chain. `pedidos-list.smoke.js` exigiu reescrita do
  teste `pedido-ui.js: não referencia OP` (não-strip-comments)
  após mudança em `pedido-ui.js`. Falhas pré-existentes em
  `tests/ops-list-screen.smoke.js` (10/30) continuam **fora
  do escopo**.
- **RAVATEX-TAPETES-PEDIDOS-UI-ADMIN-C3C2C1 (commit desta fase):**
  316/316 pass nos testes focados (`pedido-itens-edit` 46/46,
  `pedido-edit` 35/35, `pedido-detail` 43/43, `pedido-form`
  35/35, `pedido-ui` 18/18, `pedidos-list` 29/29, `pedidos-schema`
  41/41, `boot` 28/28, `router` 41/41). 5 testes novos no
  `pedido-itens-edit.smoke.js` (C3C2C1): botão "+ Adicionar
  item" existe e chama `adicionarItem()`; insert de novos
  itens com 5 chaves permitidas (`pedido_id`, `modelo_id`,
  `metros`, `observacao`, `ordem`); insert NÃO contém campos
  proibidos (`id`, `largura`, `cor_1_id`, `cor_2_id`,
  `criado_em`); ordem calculada como `existingItems.length + i`;
  botão "Descartar novo item" apenas para `isNew`. 1 teste
  atualizado: insert permitido, delete/upsert ainda
  proibidos. 1 teste invertido: "TEM botão + Adicionar item"
  (em vez de "NÃO tem"). 1 teste renomeado: "NÃO tem
  'Remover' / 'removeBtn'" (remoção é C3C2C2). C3B status
  actions, C3C1 edição de dados gerais e C3C2B edição de
  itens existentes preservadas. Sem `git add .` (stage
  seletivo). Falhas pré-existentes em `tests/ops-list-screen.smoke.js`
  (10/30) continuam **fora do escopo**.

## Comandos seguros
- `node --test tests/<arquivo>.smoke.js` — testes focados por fase.
- `node --test tests/boot.smoke.js tests/router.smoke.js
  tests/op-nova.smoke.js tests/op-pdf.smoke.js tests/op-persistir.smoke.js
  tests/op-recalculo.smoke.js tests/op-writes.smoke.js
  tests/op-form-helpers.smoke.js tests/op-latex-admin.smoke.js
  tests/painel-screen.smoke.js tests/fornecedor-screens.smoke.js`
  — regressão completa do refactor.
- Servir local: `.\run-local.bat` (ou
  `python -m http.server 8765`) para `index-inline.smoke.js` e
  parte de `write-guard.smoke.js`.

## Documentação e prevalência

A hierarquia de fontes canônicas está em
`docs/DOCUMENTATION_INDEX.md`. Resumo:

- **Fontes canônicas (prevalecem):** `PROJECT_STATE.md`,
  `AGENT_HANDOFF.md`, `docs/architecture/CODE_HEALTH_RULES.md`,
  `docs/architecture/PORTAL_B2B_ARCHITECTURE_RULES.md`,
  `docs/architecture/AUTH_DELETE_USER_DESIGN.md`,
  `docs/refactor/ARCHITECTURE_REFACTOR_LEDGER.md`,
  `Guide-and-governance-rules.stxt`.
- **Docs legadas (NÃO prevalecem):** `docs/superpowers/`,
  `docs/qa/`, `docs/DEPLOYMENT.md`, `docs/AI_AGENT_RULES.md`,
  `docs/BACKUP_AND_RESTORE.md`, `docs/HANDOFF.md` (todas
  carregam banner de aviso após `RAVATEX-TAPETES-DOCS-SANITIZE-A`).
- Em caso de divergência, as fontes canônicas prevalecem.

Senhas de teste antigas em `docs/qa/fase1-checklist.md` e
`docs/qa/fase2-checklist.md` foram anonimizadas em
`RAVATEX-TAPETES-DOCS-SANITIZE-A` (substituídas por
`[REDACTED_TEST_PASSWORD]`).

> **Atualizacao 2026-06-29 — fase
> `RAVATEX-TAPETES-CLIENTE-STATUS-VISUAL-LIST-A-R1` (frontend cliente
> read-only + testes focados).** A tela `Meus pedidos`
> (`js/screens/cliente-pedidos-list.js`) passou a usar a taxonomia
> compartilhada de status visual ja homologada em
> `window.RavatexPedidoTracking`, preservando a natureza **read-only**
> da lista e mantendo `select(...)` explicito em `pedidos`. Escopo
> entregue: leitura dos campos seguros `status_cliente_visual`,
> `status_cliente_excecao`, `status_cliente_mensagem` e
> `status_cliente_atualizado_em`; badge/filtro alinhados ao tracking
> visual compartilhado; sem `select('*')`, sem writes, sem RPC, sem
> Edge Function, sem admin/fornecedor e sem ativar consumo do modelo
> parcial nessa tela. Validacao focada:
> `tests/cliente-pedidos-list.smoke.js`,
> `tests/cliente-portal-visual.smoke.js`,
> `tests/cliente-dashboard.smoke.js` e
> `tests/cliente-routing.smoke.js` passaram. Sem schema, sem SQL, sem
> Supabase; o schema de acompanhamento parcial segue nao aplicado.
> Proximo estado esperado: working tree limpo, sem residuos locais
> remanescentes desta frente.

## Ações PROIBIDAS sem autorização explícita
- `db/10_reset_producao.sql` e `db/11_reset_producao.sql` (DELETE em
  massa de produção).
- Qualquer SQL contra `bhgifjrfagkzubpyqpew` sem backup.
- Push em `origin/main` (= produção).
- Editar `index.html`, `js/**`, `tests/**` durante fase docs-only.
- Tocar `origin/main` ou PR #2.
- Iniciar nova extração em `op-nova.js` (refactor congelado).

## Pendências de informação
- Quem tem write no GitHub `grupoterrabranca` e acesso ao Supabase?
- Existe backup automático do Supabase? Quem sabe restaurar?
- O backdoor `*@tapetes.test` (ver histórico de D1) já foi removido?
- Há link/projeto Vercel real? (premissa atual: não — app é estático
  no GitHub Pages.)

## Registro documental de schema versionado

> **Atualizacao 2026-06-29 — fase
> `RAVATEX-TAPETES-CLIENTE-PARCIAIS-SCHEMA-DOCS-R1` (docs-only,
> fechamento documental de schema ja commitado).** Fica aceita com
> **ressalva documental** a fase
> `RAVATEX-TAPETES-CLIENTE-PARCIAIS-SCHEMA-A-R1`, correspondente ao
> commit publicado `0a02f6a — Add pedido parciais schema`. Arquivos
> publicados nesse commit: `db/17_pedido_parciais_schema.sql` e
> `tests/pedido-parciais-schema.smoke.js`. O smoke estatico passou
> **16/16**. O SQL permaneceu **nao aplicado** em Supabase; nenhum
> banco remoto foi tocado; producao/original permaneceram intocados.
> O commit ficou restrito a schema versionado + validacao estatica,
> sem frontend, sem helper/read-model de parciais, sem lista/status
> visual do cliente. Residuos locais fora de escopo foram preservados
> para fases futuras. Proxima sequencia recomendada:
> 1. helper/read-model de parciais;
> 2. lista cliente/status visual;
> 3. apply controlado de `db/17_pedido_parciais_schema.sql` em
> staging, somente quando houver autorizacao explicita.

> **Atualizacao 2026-06-29 — fase
> `RAVATEX-TAPETES-CLIENTE-PARCIAIS-HELPER-A` (frontend helper/read-model
> puro + smoke estatico).** Publicado somente o helper/read-model de
> acompanhamento parcial em `js/pedido-tracking-ui.js`, preservando
> `window.RavatexPedidoTracking`, `CLIENTE_TRACKING_STEPS`,
> `CLIENTE_TRACKING_EXCECOES` e os helpers existentes do tracking
> visual ja homologado. Escopo entregue: catalogo
> `CLIENTE_PARCIAL_SITUACOES`, normalizacao/ordenacao de parciais,
> distribuicao por situacao, calculo percentual, DTO seguro de
> parciais e builder puro `buildPedidoAcompanhamentoParcial`, sem
> query, sem Supabase, sem writes e sem side effects. Validacao focada:
> `tests/pedido-acompanhamento-parcial.smoke.js`,
> `tests/cliente-tracking-steps.smoke.js` e
> `tests/cliente-pedido-tracking.smoke.js` passaram. `db/17` continua
> **nao aplicado**; nenhuma tela consumidora foi alterada; lista
> cliente/status visual permanece residual fora de escopo. Proxima
> fase recomendada: lista cliente/status visual ou apply controlado do
> `db/17`, conforme decisao do projeto.

> **Atualizacao 2026-06-29 — fase
> `RAVATEX-TAPETES-CLIENTE-PARCIAIS-SCHEMA-APPLY-STAGING-A`
> (aplicacao controlada de SQL em staging + validacao estrutural).**
> Aplicado em staging/paralelo `ucrjtfswnfdlxwtmxnoo` o arquivo
> versionado exato `db/17_pedido_parciais_schema.sql`, via Supabase
> CLI/Management API, **sem tocar producao/original
> `bhgifjrfagkzubpyqpew`** e sem SQL adicional fora do script.
> Validacoes pos-aplicacao concluídas: colunas
> `parcial_habilitado`, `parcial_atualizado_em`, `metros_total`
> presentes em `public.pedidos`; tabelas `public.pedido_parciais` e
> `public.pedido_parcial_itens` presentes; RLS habilitada nas duas;
> policies encontradas: `pedido_parciais_admin_all`,
> `pedido_parciais_cliente_select`,
> `pedido_parcial_itens_admin_all`,
> `pedido_parcial_itens_cliente_select`; funcoes encontradas:
> `recalcular_pedido_metros_total`,
> `sincronizar_pedido_parciais_resumo`,
> `touch_pedido_parciais_updated_at`,
> `pedido_parciais_after_change`,
> `pedido_itens_sync_parciais_after_change`; triggers instalados:
> `pedido_parciais_touch_updated_at`,
> `pedido_parciais_after_change_trigger` em `pedido_parciais` e
> `pedido_itens_sync_parciais_after_change_trigger` em `pedido_itens`;
> constraints validadas nas tabelas novas, incluindo PKs, FKs,
> checks de `situacao`/`origem`/`sequencia`/`metros` e UNIQUE
> `pedido_parcial_itens_parcial_item_key`. Contagens atuais:
> `pedido_parciais = 0`, `pedido_parcial_itens = 0`. Nenhum dado de
> negocio foi inserido ou alterado para teste. Frontend permaneceu
> intocado nesta fase e as parciais ainda nao foram ligadas a tela
> consumidora real. Testes locais verdes:
> `tests/pedido-parciais-schema.smoke.js`,
> `tests/pedido-acompanhamento-parcial.smoke.js`,
> `tests/cliente-pedidos-list.smoke.js`,
> `tests/cliente-portal-visual.smoke.js`. Proxima fase recomendada:
> decidir entre ativacao controlada da leitura parcial em detalhe/lista
> ou homologacao tecnica dos dados de parciais.

> **Atualizacao 2026-06-29 — fase
> `RAVATEX-TAPETES-CLIENTE-PARCIAIS-ADMIN-CONTROL-A`
> (controle manual admin + writes controlados + smoke focado).**
> Publicado controle manual de parciais no detalhe admin do pedido,
> via novo modulo `js/screens/pedido-parciais-admin.js` integrado a
> `js/screens/pedido-detail.js` e carregado por `index.html`. O admin
> agora lista parciais existentes de `pedido_parciais` com SELECT
> explicito (`id`, `pedido_id`, `sequencia`, `situacao`, `metros`,
> `data_referencia`, `titulo`, `mensagem_cliente`, `visivel_cliente`,
> `criado_em`, `atualizado_em`) e pode cadastrar novas parciais
> manuais com insert controlado em `pedido_parciais`, preenchendo
> `pedido_id`, `sequencia`, `situacao`, `metros`, `data_referencia`,
> `titulo`, `mensagem_cliente`, `visivel_cliente`, `origem = 'manual'`
> e `criado_por` quando `window.CURRENT_USER.id` estiver disponivel.
> O formulario usa o catalogo compartilhado
> `window.RavatexPedidoTracking.CLIENTE_PARCIAL_SITUACOES`, default
> `visivel_cliente = false`, tolera `pedidos.metros_total` nulo e
> mostra preview tecnico simples com `buildPedidoAcompanhamentoParcial`
> sem alterar status visual do pedido. Escopo preservado: cliente ainda
> nao le `pedido_parciais`; `js/screens/cliente-pedido-detail.js`,
> `js/screens/cliente-pedidos-list.js`,
> `js/screens/cliente-dashboard.js` e
> `js/screens/cliente-pedido-tracking.js` permaneceram intocados;
> `pedido_parcial_itens` continua fora do MVP desta fase; nenhum
> schema, SQL, Supabase apply ou producao/original foi tocado.
> Validacao focada verde:
> `tests/pedido-parciais-admin-control.smoke.js`,
> `tests/pedido-parciais-schema.smoke.js`,
> `tests/pedido-acompanhamento-parcial.smoke.js`,
> `tests/cliente-pedido-detail.smoke.js`,
> `tests/cliente-pedidos-list.smoke.js`,
> `tests/cliente-dashboard.smoke.js`. Proxima fase recomendada:
> homologacao tecnica do fluxo admin criando parciais reais em staging,
> ou leitura read-only de parciais no detalhe cliente depois de haver
> dado controlado suficiente.

> **Atualizacao 2026-06-29 — fase
> `RAVATEX-TAPETES-CLIENTE-PARCIAIS-ADMIN-HOMOLOG-RECORD-A`
> (docs-only, registro da homologacao tecnica controlada em staging).**
> Fica registrada como **APROVADA** a homologacao tecnica da UI admin
> de parciais no HEAD `e2b8723`, em app local conectado ao Supabase
> staging `ucrjtfswnfdlxwtmxnoo`, sem tocar producao/original
> `bhgifjrfagkzubpyqpew`. Pedido homologado: `#2`
> (`ee62b4aa-aa97-46b9-a44f-3b7d992dcdcb`). Parcial real criada via UI
> admin, sem SQL manual: id
> `3966fb1f-c333-4024-92f9-7fabdaa4e532`, `sequencia = 1`,
> `situacao = em_acabamento`, `metros = 2500`,
> `data_referencia = 2026-06-29`, titulo `Parcial em acabamento`,
> mensagem cliente `Parte do pedido esta em etapa de acabamento.`,
> `visivel_cliente = true`, `origem = manual`, `metadata = {}` e
> `criado_por` preenchido (valor nao registrado). Validacao read-only:
> `pedido_parciais` recebeu o registro corretamente; `pedidos`
> sincronizou `parcial_habilitado = true`,
> `parcial_atualizado_em = 2026-06-29T12:39:43.739178+00:00`,
> `metros_total = 10000.00`; `status` permaneceu `recebido`,
> `status_cliente_visual` permaneceu `acabamento` e
> `status_cliente_excecao` permaneceu `null`. `pedido_parcial_itens`
> continuou vazio e fora do MVP. Cliente ainda nao le
> `pedido_parciais`; nenhuma tela cliente foi alterada; nenhum dado
> interno foi exposto ao cliente. Nenhum schema, SQL, Supabase mutation
> adicional ou alteracao de frontend/repo foi realizado nesta fase.
> Proxima fase recomendada: leitura read-only de parciais no detalhe
> cliente.

> **Atualizacao 2026-06-29 — fase
> `RAVATEX-TAPETES-CLIENTE-PARCIAIS-CLIENTE-DETAIL-A`
> (frontend cliente read-only no detalhe + smoke focado).**
> Publicada leitura read-only de `pedido_parciais` apenas em
> `js/screens/cliente-pedido-detail.js`, sem alterar lista cliente,
> dashboard, admin, fornecedor, schema ou Supabase. O detalhe cliente
> agora consulta `public.pedido_parciais` com SELECT explicito e
> sanitizado (`id`, `pedido_id`, `sequencia`, `situacao`, `metros`,
> `data_referencia`, `titulo`, `mensagem_cliente`, `criado_em`,
> `atualizado_em`), filtrando por `pedido_id` e ordenando por
> `sequencia asc`, `criado_em asc`, confiando na RLS staging ja
> aplicada para limitar a leitura a parciais visiveis do proprio
> pedido. A renderizacao reaproveita o helper compartilhado
> `window.RavatexPedidoTracking.buildPedidoAcompanhamentoParcial` para
> rotulos e taxonomia, mostra a secao `Parciais do pedido`, empty
> state `Este pedido ainda nao possui parciais publicadas.` e erro
> discreto sem quebrar tracking, resumo, itens ou timeline. Nenhum
> campo interno foi exposto: sem `metadata`, `criado_por`, `origem`,
> `observacao_admin`, `visivel_cliente`, `pedido_parcial_itens`,
> `OP`, `lote`, `fornecedor`, `NF`, `romaneio`, `custo`, `margem` ou
> `token_acesso`. Validacao focada verde:
> `tests/cliente-pedido-detail.smoke.js`,
> `tests/pedido-acompanhamento-parcial.smoke.js`,
> `tests/pedido-parciais-admin-control.smoke.js`,
> `tests/cliente-pedidos-list.smoke.js` e
> `tests/cliente-dashboard.smoke.js`. Proxima fase recomendada:
> homologacao E2E admin -> cliente das parciais em staging.

> **Atualizacao 2026-06-29 — fase
> `RAVATEX-TAPETES-CLIENTE-PARCIAIS-HOMOLOG-RECORD-A`
> (docs-only, fechamento documental da homologacao E2E com ressalva
> visual).** Fica registrada como **APROVADA COM RESSALVA VISUAL** a
> decisao de entrada `RAVATEX-TAPETES-CLIENTE-PARCIAIS-E2E-HOMOLOG-R1`
> no HEAD `91f7159`, em app local conectado ao Supabase staging
> `ucrjtfswnfdlxwtmxnoo`, sem tocar producao/original
> `bhgifjrfagkzubpyqpew`. O cliente validou em staging a leitura
> read-only de parciais no detalhe do proprio pedido `#2`
> (`ee62b4aa-aa97-46b9-a44f-3b7d992dcdcb`), exibindo a secao
> `Parciais do pedido` com a parcial visivel ja homologada
> (`sequencia = 1`, situacao amigavel `Em acabamento`,
> `metros = 2500`, `data_referencia = 2026-06-29`, titulo
> `Parcial em acabamento`, mensagem
> `Parte do pedido esta em etapa de acabamento.`), mantendo tracking,
> resumo, itens e timeline operacionais e sem expor `metadata`,
> `criado_por`, `origem`, `observacao_admin`, `OP`, `lote`,
> `fornecedor`, `NF`, `romaneio`, `custo`, `margem`, `token_acesso`
> ou `service_role`. Lista e dashboard cliente continuam sem resumo de
> parciais nesta trilha funcional minima. Ressalva registrada: o
> acabamento visual do detalhe cliente ainda esta distante do HTML de
> referencia e deve seguir em frente separada, sem bloquear a
> aprovacao funcional minima desta leitura cliente. Nenhum codigo,
> schema, SQL, Supabase mutation ou alteracao visual foi realizado
> nesta fase docs-only. Proxima fase recomendada: frente dedicada de
> polish visual do detalhe cliente, separada da funcionalidade de
> parciais.

> **Atualizacao 2026-06-30 — fase
> `RAVATEX-TAPETES-ADMIN-NOVA-OP-MATCH-STANDALONE-CLOSEOUT`
> (homologacao do redesenho visual da tela Admin Nova OP).** Fica
> registrada como **APROVADA** a homologacao visual da tela Admin →
> Nova OP (rota `#/ops/nova` e edicao `#/ops/:id`) no HEAD `9495918`,
> com aceite visual explicito do dono do projeto em staging local
> (`run-local.bat`). O miolo de `js/screens/op-nova.js` foi
> redesenhado para igualar ao HTML standalone
> `Admin - Nova OP - standalone.html` (header com subtitulo e botao
> Voltar; card "1. Dados da OP"; card "2. Itens da OP"; card
> "3. Recebimento de fios" com pendentes/recebidas/proposta por
> sliders; card "4. Entregas tecelagem"; coluna lateral "Resumo da OP";
> barra inferior informativa), preservando integralmente shell/sidebar/
> topbar globais (`js/screens/common.js` e `index.html` intocados),
> rota, acoes, validacoes e writes existentes (`window.persistirOP`,
> `window.aplicarRecalculoOP`, `window.registrarRecebimentoOrdemFio`,
> `window.atribuirFornecedorFioOp`). Diferenca residual deferida: as
> colunas Quantidade e Observacao por item do standalone nao existem
> em `op_itens` (ver `db/01_schema.sql`) e exigiriam alteracao de
> schema/logica fora do escopo desta fase — a tabela real usa apenas
> Modelo/Metros/Acoes. Nenhum schema, SQL, Supabase mutation ou
> alteracao de producao/`origin/main` foi realizada. Validacao focada
> verde: `node --check js/screens/op-nova.js`,
> `tests/op-nova.smoke.js` (30/30) e `git diff --check`; suite
> opcional de nao-regressao do fluxo OP (`tests/op-persistir.smoke.js`,
> `tests/op-recalculo.smoke.js`, `tests/op-writes.smoke.js`,
> `tests/op-form-helpers.smoke.js`, `tests/op-pdf.smoke.js`,
> `tests/op-latex-admin.smoke.js`) tambem executada, com 2 falhas
> pre-existentes e nao relacionadas (`screenPainel ... 9 itens do
> ADMIN_MENU`, ja presentes no HEAD `9495918` antes desta fase,
> confirmadas via `git stash`) — nao corrigidas nesta fase por estarem
> fora do escopo. Unico arquivo funcional alterado:
> `js/screens/op-nova.js`. Proxima fase recomendada: avaliar, em
> frente separada, se vale criar campos de quantidade/observacao por
> item de OP (exige schema).
