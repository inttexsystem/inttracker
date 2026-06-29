# Inventário de Gaps de UI — Portal Cliente B2B

> **Fase:** `RAVATEX-TAPETES-CLIENTE-PORTAL-UI-GAP-INVENTORY-A`
> **Tipo:** diagnóstico/documentação. **Read-only.** Sem implementação.
> **Status da UI:** funcional em staging, **NÃO final** (confirmado em
> `PROJECT_STATE.md`, fase `RAVATEX-TAPETES-CLIENTE-PORTAL-STAGING-CLOSEOUT-A`).
> **Produção:** permanece bloqueada. Este documento não autoriza,
> recomenda prazo, nem implica decisão de promoção para produção.

## 0. Natureza deste documento

Este documento **mapeia divergências**, não as corrige. Ele compara os
mockups/HTMLs aprovados pelo dono do projeto contra a implementação
atual das telas do Portal Cliente B2B, para permitir que a próxima
rodada de refinamento visual seja escopada com controle. Nenhum
arquivo de `js/**`, `db/**`, `supabase/functions/**`, `index.html` ou
de testes foi alterado para produzir este inventário.

## 1. Estado base

- **Branch:** `work/app-next`.
- **HEAD no início e no fim desta fase:** `932ba38` (working tree
  limpo antes e depois; nenhum commit de código foi criado).
- **Staging Supabase:** `ucrjtfswnfdlxwtmxnoo` (não acessado nesta
  fase — apenas leitura de arquivos locais).
- **Produção/original** `bhgifjrfagkzubpyqpew` e `origin/main`: não
  tocados.

### 1.1 Mockups localizados

Todos os 5 mockups foram **localizados na máquina do dono do
projeto**, fora do repositório git, em:

`D:\OneDrive\Ravatex\Inttex\Mockups - nova interface\`

| Arquivo | Tela de referência |
|---|---|
| `Dashboard Cliente - standalone.html` | Dashboard Cliente |
| `Novo Pedido - standalone.html` | Novo Pedido |
| `Modal Adicionar Item - standalone.html` | Modal Adicionar Item |
| `Detalhe do Pedido - standalone.html` | Detalhe do Pedido |
| `Admin-Cliente-Acompanhamento B2B - standalone.html` | Acompanhamento/Stepper/Timeline (cliente) + tela admin de controle de status visual + página de legenda/taxonomia — os três conteúdos estão **no mesmo arquivo** |

Esses 5 arquivos coincidem exatamente com os mockups listados em
`docs/architecture/PORTAL_B2B_ARCHITECTURE_RULES.md` §10 (Dashboard
Cliente, Novo Pedido, Modal Adicionar Item, Detalhe do Pedido), mais o
arquivo de Acompanhamento B2B que contextualiza o stepper/timeline e a
taxonomia compartilhada já documentada em `js/pedido-tracking-ui.js`.

**Formato dos arquivos:** cada HTML é um wrapper "Bundled Page" de uma
ferramenta de design com IA — o HTML real fica serializado como string
JSON dentro de `<script type="__bundler/template">`. Não são
renderizáveis por leitura direta de texto; o conteúdo foi extraído
programaticamente (decodificação JSON + remoção de tags) apenas para
leitura/comparação, sem nunca colar HTML bruto em nenhum arquivo do
projeto — em conformidade com a proibição de
`docs/architecture/PORTAL_B2B_ARCHITECTURE_RULES.md` §10.

**Mockup ausente para a listagem "Meus pedidos":** não foi localizado
nenhum mockup dedicado para a tela `#/cliente/pedidos` (listagem). Essa
tela não está entre as 4 mockups oficiais de
`PORTAL_B2B_ARCHITECTURE_RULES.md` §10 nem nas 6 unidades de
comparação desta fase. Registrado aqui apenas para rastreabilidade —
**não é um bloqueio** desta fase.

### 1.2 Arquivos de implementação lidos (contexto obrigatório + telas)

- `PROJECT_STATE.md`, `AGENT_HANDOFF.md` (lidos na íntegra).
- `docs/architecture/PORTAL_B2B_ARCHITECTURE_RULES.md` (lido na íntegra).
- `js/screens/cliente-common.js`
- `js/screens/cliente-dashboard.js`
- `js/screens/cliente-pedidos-list.js`
- `js/screens/cliente-pedido-detail.js`
- `js/screens/cliente-pedido-tracking.js`
- `js/screens/cliente-pedido-form.js`
- `js/pedido-tracking-ui.js`
- `js/screens/common.js` (shellLayout compartilhado, para entender o
  shell cliente)
- `js/pedido-ui.js` (badges/labels de status operacional, para
  entender a duplicidade de status descrita em §6)
- `tests/cliente-portal-visual.smoke.js` (existe; usado como
  guarda-anti-regressão de referência — não executado nesta fase)
- `db/15_status_cliente_visual.sql` (consulta pontual, apenas para
  confirmar valores já versionados de `tipo_recebimento`)

### 1.3 Confirmação do estado funcional

`PROJECT_STATE.md` confirma, na própria fase anterior
(`...-STAGING-CLOSEOUT-A`), que esta é exatamente a próxima fase
recomendada: *"inventário de gaps de UI, comparando os mockups/HTMLs
pedidos pelo dono do projeto contra a implementação atual das 5 telas
do portal cliente, antes de qualquer nova implementação ou decisão de
promoção para produção"*. Este documento entrega essa recomendação.

## 2. Matriz por tela

Legenda de severidade: 🟢 baixa · 🟡 média · 🔴 alta.
Legenda de risco de tocar: baixo (isolado a 1 módulo cliente) · médio
(toca módulo cliente + dado novo) · alto (toca componente compartilhado
com admin/fornecedor, ex.: `shellLayout`).

| Tela | Referência analisada | Arquivos atuais | Diverge (resumo) | Severidade | Tipo de gap | Risco de tocar | Fase futura sugerida |
|---|---|---|---|---|---|---|---|
| Dashboard Cliente | `Dashboard Cliente - standalone.html` | `js/screens/cliente-dashboard.js` | KPIs com semântica diferente; sem "pedidos em destaque"; sem distribuição por etapa; sem "ações rápidas"; layout 2 colunas em vez de pilha de seções; sem CTA no header | 🟡 média | layout, hierarquia visual, componente ausente, nomenclatura | baixo | `UI-GAP-FIX-DASHBOARD-A` |
| Novo Pedido | `Novo Pedido - standalone.html` | `js/screens/cliente-pedido-form.js` | Sem "Dados gerais" (referência do cliente, recebimento); itens inline em vez de tabela+modal; sem totais; fluxo de 1 etapa em vez de checkout em 2 etapas | 🔴 alta | componente ausente, fluxo, particularidade operacional | médio | `UI-GAP-FIX-NOVO-PEDIDO-A` |
| Modal Adicionar Item | `Modal Adicionar Item - standalone.html` | `js/screens/cliente-pedido-form.js` (inline, sem modal) | Não existe como modal; sem Cor 1/Cor 2/Largura por item; sem referência visual (upload); sem contador de caracteres | 🔴 alta | componente ausente, fluxo | médio | `UI-GAP-FIX-MODAL-ITEM-A` |
| Detalhe do Pedido | `Detalhe do Pedido - standalone.html` | `js/screens/cliente-pedido-detail.js` | ~~Resumo com 3 colunas em vez de 4 cards; sem breadcrumb; status operacional e status visual exibidos juntos (duas taxonomias); colunas de itens com nomenclatura diferente~~ **✅ RESOLVIDO 2026-06-29 — HEAD `8650bb5`** | ✅ fechado | — | — | `RAVATEX-TAPETES-CLIENTE-DETAIL-VISUAL-HOMOLOG-RECORD-A` |
| Acompanhamento/Stepper/Timeline | `Admin-Cliente-Acompanhamento B2B - standalone.html` (seção cliente) | `js/screens/cliente-pedido-tracking.js`, `js/screens/cliente-pedido-detail.js` | Sem datas de conclusão por etapa; taxonomia das 8 etapas + 4 exceções já bate exatamente com o mockup (alinhamento confirmado) | 🟡 média (apenas a parte de datas) | componente ausente | baixo–médio (depende de novo dado/evento) | `UI-GAP-FIX-DETALHE-A` (mesma fase do detalhe, ou subfase própria se exigir novo dado) |
| Shell/Menu cliente | sidebar/topbar presentes em todos os mockups | `js/screens/cliente-common.js` + `js/screens/common.js` (`shellLayout`, **compartilhado com admin/fornecedor**) | Menu com 2 itens em vez de 4 (sem "Novo pedido", sem "Suporte"); sem marca "Inttex"/"Portal do cliente"; sem pílula de papel "Cliente"; sem ícones; topbar genérica "Controle de Tapetes" | 🔴 alta | layout, hierarquia visual, componente ausente | **alto** (componente compartilhado com admin/fornecedor) | `UI-GAP-FIX-SHELL-A` (fase própria, com autorização explícita) |

## 3. Dashboard Cliente — comparação detalhada

**Mockup** (`Dashboard Cliente - standalone.html`):
- Header "Início" + subtítulo "Acompanhe seus pedidos em produção,
  acabamento e expedição." + botão "+ Novo pedido" no canto superior
  direito do header.
- 4 KPIs: **Pedidos em aberto** (8), **Em produção** (3), **Prontos
  para expedição** (2), **Atenção** (1) — cada um com contagem +
  legenda "N pedidos".
- **"Pedidos em destaque"** (subtítulo: "Pedidos que precisam da sua
  atenção ou estão em etapas avançadas"): tabela com colunas Pedido /
  Situação / Prazo previsto / Resumo (`N itens · X m`) / Ação ("Ver"),
  com link "Ver todos os pedidos".
- **"Situação dos pedidos"** (subtítulo: "Distribuição dos pedidos por
  etapa do acompanhamento"): contagem por cada uma das 8 etapas
  (Recebidos, Confirmados, Insumos, Tecelagem, Acabamento, Expedição,
  Transporte, Concluídos).
- **"Últimas atualizações"**: lista de eventos com data + texto, link
  "Ver histórico completo".
- **"Ações rápidas"**: 3 cards (Novo pedido / Meus pedidos / Falar com
  suporte), cada um com ícone + título + subtítulo.

**Implementação atual** (`js/screens/cliente-dashboard.js`):
- Header é apenas `window.pageHeader('Início')`
  ([cliente-dashboard.js:331](js/screens/cliente-dashboard.js:331)) —
  **sem subtítulo e sem botão "+ Novo pedido"** no header.
- 4 KPIs construídos em `buildKpis()`
  ([cliente-dashboard.js:209-217](js/screens/cliente-dashboard.js:209)):
  **"Pedidos em aberto"**, **"Em andamento"**, **"Prontos /
  concluídos"**, **"Atualizações recentes"**. Divergências de
  semântica, não só de rótulo:
  - "Em andamento" agrega `tecelagem`/`acabamento`/`expedicao`/
    `transporte` ([cliente-dashboard.js:52](js/screens/cliente-dashboard.js:52)),
    enquanto o mockup separa "Em produção" de "Prontos para
    expedição" (que parece cobrir apenas a etapa `expedicao`).
  - "Prontos / concluídos" mistura `concluido` com o que seria
    "pronto para expedição" no mockup — são conceitos distintos no
    mockup, fundidos aqui.
  - O 4º card é **"Atualizações recentes"** (contagem de eventos),
    não **"Atenção"** (contagem de pedidos em estado de exceção). O
    dado para calcular "Atenção" já existe (`status_cliente_excecao`
    é selecionado), mas não é usado para nenhum KPI hoje.
- `buildPedidosRecentes()`
  ([cliente-dashboard.js:244](js/screens/cliente-dashboard.js:244))
  lista os 5 pedidos mais recentes por `criado_em` — **não** é uma
  seleção por "destaque" (exceção ativa ou etapa avançada) como no
  mockup. Colunas atuais: número, badge, prazo, atualizado em, "Ver
  pedido" — **sem** a coluna "Resumo" (itens/metragem) do mockup, que
  exigiria nova consulta agregada (não existe hoje).
- **Não existe** seção "Situação dos pedidos" (distribuição por etapa)
  em nenhum lugar do dashboard atual.
- **Não existe** seção "Ações rápidas" (cards de atalho).
- "Últimas atualizações" existe (`buildEventos()`,
  [cliente-dashboard.js:305](js/screens/cliente-dashboard.js:305)) e
  cobre o conceito do mockup, mas **sem** link "Ver histórico
  completo" (não há uma página de histórico global de eventos — só a
  timeline por pedido no detalhe).
- Layout: grid de 2 colunas (Pedidos recentes | Últimas atualizações)
  lado a lado em telas largas
  ([cliente-dashboard.js:332](js/screens/cliente-dashboard.js:332)) —
  o mockup empilha cada seção em largura cheia, em ordem diferente
  (KPIs → destaque → distribuição → atualizações → ações rápidas).

## 4. Novo Pedido — comparação detalhada

**Mockup** (`Novo Pedido - standalone.html`):
- Header "Novo pedido" + subtítulo "Preencha os itens do pedido. Após
  o envio, ele ficará como Recebido para conferência." + botão
  "Cancelar" no topo.
- Card **"Dados gerais"**: Referência do cliente (texto livre, ex.
  placeholder "Pedido #8431"), Prazo desejado (data), Recebimento
  (select, ex. "Retirada").
- Card **"Itens do pedido"**: botão "+ Adicionar item" (abre modal,
  ver §5) + tabela com colunas Img / Modelo / Cores / Largura /
  Metragem (m) / Observação / Ações, com 4 itens de exemplo e rodapé
  "Total de itens: 4" / "Metragem total: 35.700,00 m".
- Campo separado **"Instruções gerais"** (textarea, distinto da
  observação por item).
- Footer com **dois botões**: "Ir para checkout" (secundário) e
  "Finalizar pedido" (primário) — fluxo de 2 etapas.

**Implementação atual** (`js/screens/cliente-pedido-form.js`):
- Header é apenas `pageHeader('Novo pedido', [...])` com botão "←
  Voltar para lista" ([cliente-pedido-form.js:199-206](js/screens/cliente-pedido-form.js:199))
  — **sem subtítulo** e **sem botão "Cancelar" no topo** (existe um
  "Cancelar" só no rodapé do form).
- **Não existe** card "Dados gerais" com Referência do cliente nem
  Recebimento. O form atual só tem **Prazo desejado** (campo
  `prazoEntrega`) e **Observação geral**
  ([cliente-pedido-form.js:242-252](js/screens/cliente-pedido-form.js:242)).
  As colunas `referencia_cliente` e `tipo_recebimento` **já existem no
  schema** (`db/15_status_cliente_visual.sql:40-42`), mas não são
  capturadas nem enviadas no payload de criação
  ([cliente-pedido-form.js:289-294](js/screens/cliente-pedido-form.js:289)).
- Itens **não usam tabela + modal**. São linhas inline sempre visíveis
  (`buildItemRow`,
  [cliente-pedido-form.js:115-177](js/screens/cliente-pedido-form.js:115))
  com select de Modelo + input de Metros + input de Observação, e
  "+ Adicionar item" / "Remover" como links de texto — **estrutura de
  fluxo totalmente diferente** da tabela com modal do mockup.
- **Sem** colunas de Img/preview, Cores (Cor 1/Cor 2) ou Largura por
  item no formulário — essas só aparecem depois, no Detalhe (§6), e lá
  são somente leitura.
- **Sem** rodapé de totais ("Total de itens" / "Metragem total").
- Fluxo de envio é **uma única etapa**: botão "Enviar pedido"
  ([cliente-pedido-form.js:236-240](js/screens/cliente-pedido-form.js:236))
  que já cria o pedido com `status: 'recebido'` diretamente — **não
  há** uma etapa intermediária de "checkout"/revisão antes de
  finalizar, como no mockup.

## 5. Modal Adicionar Item — comparação detalhada

**Mockup** (`Modal Adicionar Item - standalone.html`):
- Modal com título "Adicionar item" + subtítulo "Informe os dados do
  item que será incluído no pedido."
- Campos: **Modelo*** (select), **Cores*** — "Cor 1" (select) + "Cor
  2" (select) como overrides independentes do modelo, **Largura***
  (campo numérico/derivado do modelo), **Metragem*** (número, com
  unidade "m"), **Referência visual** (upload de imagem, opcional),
  **Observação do item** (textarea com contador "0/200").
- Footer: "Cancelar" + "Adicionar item".

**Implementação atual:** **não existe nenhum modal de adicionar
item.** O formulário de criação (`cliente-pedido-form.js`) adiciona
itens inline na própria página (ver §4). Mapeando campo a campo contra
o que existe hoje:
- **Modelo:** existe, como select inline
  ([cliente-pedido-form.js:125-130](js/screens/cliente-pedido-form.js:125)).
- **Cor 1 / Cor 2:** **não existe** nenhum campo de override de cor no
  formulário de criação. O header do módulo documenta explicitamente:
  *"Sem `largura`/`cor_1_id`/`cor_2_id` (sem override nesta fase)"*
  ([cliente-pedido-form.js:35-38](js/screens/cliente-pedido-form.js:35)).
  No detalhe (`cliente-pedido-detail.js`), os campos `cor_1_id`/
  `cor_2_id`/`largura` por item **já existem no SELECT**
  ([cliente-pedido-detail.js:205](js/screens/cliente-pedido-detail.js:205))
  e já são exibidos — mas só leitura, nunca capturados na criação.
- **Largura:** mesma situação — coluna existe no schema/SELECT do
  detalhe, mas o formulário de criação não a captura.
- **Metragem:** existe (`item.metros`,
  [cliente-pedido-form.js:135-145](js/screens/cliente-pedido-form.js:135)),
  validada como número > 0.
- **Referência visual (upload de imagem):** **não existe.** Não há
  nenhum input de arquivo em nenhuma tela cliente atual.
- **Observação do item:** existe (`item.observacao`,
  [cliente-pedido-form.js:150-159](js/screens/cliente-pedido-form.js:150)),
  mas **sem contador de caracteres** "0/200" nem limite de tamanho
  aplicado client-side.

## 6. Detalhe do Pedido — comparação detalhada

> **STATUS: RESOLVIDO / GAP FECHADO** — Homologação visual aprovada
> pelo dono do projeto em **2026-06-29**. HEAD do commit: `8650bb5`
> ("Match cliente pedido detail to standalone reference"). Todos os
> itens abaixo foram implementados e aceitos. A seção é mantida apenas
> como registro histórico.

**Mockup** (`Detalhe do Pedido - standalone.html`):
- Breadcrumb "Meus pedidos / Pedido #2" + botão "← Voltar para
  pedidos".
- Header com número do pedido, status visual ("Em acabamento") e
  "Atualizado em [data] às [hora]" — uma única fonte de status.
- 4 cards de resumo: **Itens** (contagem), **Metragem total**,
  **Última atualização**, **Prazo previsto** — cada um com ícone.
- Tabela "Itens do pedido": Modelo, **Cores**, Largura, Metragem,
  Observação.
- "Histórico": timeline com data/hora, título, mensagem.

**Implementação atual** (`js/screens/cliente-pedido-detail.js`):
- **Sem breadcrumb.** Header é só `pageHeader('Pedido', [...])` com
  "← Voltar para lista"
  ([cliente-pedido-detail.js:260-267](js/screens/cliente-pedido-detail.js:260)).
- **Duas fontes de status na mesma tela** (gap de hierarquia/nomenclatura,
  não presente no mockup):
  1. O card de tracking (`buildTracking()`, delegado a
     `buildClientePedidoTrackingCard`) mostra o **status visual do
     cliente** (taxonomia das 8 etapas/4 exceções de
     `js/pedido-tracking-ui.js`, ex. "Acabamento").
  2. O resumo (`buildResumo()`,
     [cliente-pedido-detail.js:274-288](js/screens/cliente-pedido-detail.js:274))
     mostra, ao lado do número do pedido, `window.pedidoStatusBadge(p.status)`
     — o **status operacional bruto** (`rascunho`/`recebido`/
     `confirmado`/`produzindo`/`entregue`/`cancelado`, ver
     `js/pedido-ui.js:63-66`), que é um campo diferente e pode estar
     em uma etapa diferente da publicada visualmente. O mockup mostra
     **apenas uma** linha de status no topo. Esta duplicidade é
     funcionalmente segura (nenhum dado interno é exposto — ambos os
     campos já são "client-safe" por design,
     `PORTAL_B2B_ARCHITECTURE_RULES.md`), mas é uma divergência visual
     real e uma fonte potencial de confusão para o cliente.
- Resumo tem **3 colunas** (Prazo de entrega / Criado em / Atualizado
  em,
  [cliente-pedido-detail.js:282-286](js/screens/cliente-pedido-detail.js:282))
  em vez dos **4 cards com ícone** do mockup (Itens / Metragem total /
  Última atualização / Prazo previsto). Os dados de "Itens" (contagem)
  e "Metragem total" (soma) **podem ser derivados** dos itens já
  carregados (`state.itens`) sem nova consulta. **"Prazo previsto"**
  no mockup parece corresponder à coluna `prazo_desejado`, que **não é
  selecionada** no SELECT atual de `pedidos`
  ([cliente-pedido-detail.js:174](js/screens/cliente-pedido-detail.js:174))
  — só o dashboard seleciona esse campo hoje.
- Tabela de itens usa cabeçalho **"Cor 1 / Cor 2"**
  ([cliente-pedido-detail.js:322-325](js/screens/cliente-pedido-detail.js:322))
  em vez de **"Cores"** (nomenclatura — divergência de baixo impacto).
  Tem também uma coluna **"Preview"** (amostra de cor) que o mockup
  não tem como coluna própria — possível componente excedente, baixo
  impacto.
- "Atualizações do pedido"
  ([cliente-pedido-detail.js:376-398](js/screens/cliente-pedido-detail.js:376))
  cobre o conceito de "Histórico" do mockup de forma equivalente
  (timeline com ponto + conector, título, mensagem, data) — apenas
  nomenclatura do título da seção diverge.

## 7. Acompanhamento/Stepper/Timeline — comparação detalhada

**Mockup** (seção cliente de `Admin-Cliente-Acompanhamento B2B -
standalone.html`):
- Stepper com as mesmas 8 etapas (Recebido, Confirmado, Insumos,
  Tecelagem, Acabamento, Expedição, Transporte, Concluído).
- Cada etapa **concluída** mostra uma **data** abaixo do nome (ex.
  "25/06", "27/06", "03/07", "14/08"). A etapa atual mostra rótulo "em
  andamento".
- Banner abaixo do stepper com a frase da etapa atual.
- A página de legenda/taxonomia do mesmo mockup (seção "Taxonomia ·
  Chave de estados B2B") descreve as 8 etapas e as 4 exceções
  (Aguardando definição, Aguardando insumo, Pausado, Cancelado) com a
  mesma semântica já implementada.

**Implementação atual** (`js/screens/cliente-pedido-tracking.js` +
`js/pedido-tracking-ui.js`):
- **Taxonomia confirmada como alinhada**: as 8 etapas principais
  (`recebido, confirmado, insumos, tecelagem, acabamento, expedicao,
  transporte, concluido`) e as 4 exceções (`aguardando_definicao,
  aguardando_insumo, pausado, cancelado`) em
  `js/pedido-tracking-ui.js:4-20` correspondem exatamente às etapas e
  exceções do mockup, incluindo o tratamento de "Cancelado" como
  exceção terminal que substitui o stepper por um aviso (
  `buildCanceladoCard`,
  [cliente-pedido-tracking.js:161-177](js/screens/cliente-pedido-tracking.js:161)).
  Isso **não é um gap** — é um ponto de conformidade que deve ser
  preservado em qualquer fase futura.
- O rótulo do "em andamento" sob a etapa atual também já existe
  ([cliente-pedido-tracking.js:124-125](js/screens/cliente-pedido-tracking.js:124)),
  alinhado ao mockup.
- **Gap real:** os círculos do stepper mostram apenas "OK" (concluída),
  número (futura) ou "!" (exceção ativa) —
  ([cliente-pedido-tracking.js:99-114](js/screens/cliente-pedido-tracking.js:99))
  — **sem nenhuma data de conclusão por etapa**. Não há, hoje, dado
  estruturado que amarre "etapa X concluída em data Y" — o
  `pedido_cliente_eventos` tem `criado_em` por evento, mas não há
  lógica que mapeie eventos para "data em que cada etapa foi
  concluída". Implementar isso exigiria decidir uma regra de
  derivação (provavelmente o primeiro evento cujo `status` corresponde
  à etapa), o que é uma decisão de produto, não só visual.
- Banner do card mostra rótulo + mensagem + texto de progresso ("Etapa
  N de M.") + data de atualização
  ([cliente-pedido-tracking.js:133-159](js/screens/cliente-pedido-tracking.js:133)).
  O texto "Etapa N de M" não aparece na visão pura do cliente no
  mockup (aparece só no preview do painel **admin** do mesmo arquivo)
  — possível componente excedente, mas de baixo impacto/utilidade
  questionável a remover.

## 8. Shell/Menu cliente — comparação detalhada

**Mockup** (sidebar/topbar presentes em todos os 5 arquivos, idêntica
entre eles):
- Marca "Inttex" + subtítulo "Portal do cliente" no topo da sidebar.
- Menu com **4 itens**, cada um com ícone: Início, Meus pedidos, Novo
  pedido, Suporte.
- Rodapé da sidebar com cartão de usuário: pílula de papel "Cliente" +
  e-mail (`cliente@sctp.com.br`) + botão "Sair" com ícone.

**Implementação atual** (`js/screens/cliente-common.js` +
`js/screens/common.js`):
- `CLIENTE_MENU` tem **apenas 2 itens**: "Início" (`#/cliente/dashboard`)
  e "Meus pedidos" (`#/cliente/pedidos`)
  ([cliente-common.js:24-27](js/screens/cliente-common.js:24)). **Sem**
  "Novo pedido" e **sem** "Suporte" no menu (o acesso a "Novo pedido"
  hoje só existe via botão dentro da tela "Meus pedidos"; não existe
  nenhuma tela ou contato de "Suporte" no app).
- O shell em si (`shellLayout`,
  [common.js:39-63](js/screens/common.js:39)) é **compartilhado
  literalmente entre admin, fornecedor e cliente** — sem nenhuma
  variação visual por papel:
  - Header fixo com texto **"Controle de Tapetes"**
    ([common.js:43](js/screens/common.js:43)) — sem marca
    "Inttex"/"Portal do cliente".
  - Identificação do usuário é só texto simples `"Nome (tipo)"` +
    botão "Sair" ([common.js:45-46](js/screens/common.js:45)) — sem
    pílula de papel, sem cartão de rodapé na sidebar, sem ícones.
  - Sidebar é uma lista plana de links de texto, sem ícones
    ([common.js:50-56](js/screens/common.js:50)).
- **Risco elevado de qualquer correção aqui:** como o mesmo
  `shellLayout`/`ADMIN_MENU` é usado por admin e fornecedor
  (`js/screens/common.js`), qualquer redesenho visual do shell cliente
  que toque o componente compartilhado também afeta as telas
  admin/fornecedor. Isso já estava registrado como pendência conhecida
  em `PROJECT_STATE.md` (fase `...-TRACKING-UI-A`): *"o
  redesign visual mais amplo do shell cliente [...] fica para uma fase
  própria, somente com autorização explícita do HMNlead, dado o risco
  de afetar também as telas admin/fornecedor que compartilham o mesmo
  shellLayout"*. Este inventário reafirma essa mesma cautela.

## 9. Particularidades operacionais a detalhar com o dono do projeto

Os itens abaixo **não foram inventados**: ou já estão documentados em
schema/regras versionadas (citados com a fonte) ou são perguntas
abertas reais identificadas pela comparação. Nenhuma regra nova foi
assumida.

- **Tipo de retirada/entrega.** Já versionado em
  `db/15_status_cliente_visual.sql:56-57` e `:130-134`: a coluna
  `pedidos.tipo_recebimento` aceita exatamente `retirada` ou `entrega`
  (ou `NULL`). O mockup de Novo Pedido tem um campo "Recebimento" com
  esse propósito. **TBD:** nenhuma tela cliente atual captura ou exibe
  esse campo hoje — decidir se ele entra no formulário de criação,
  como obrigatório ou opcional, e se aparece no detalhe/dashboard.
- **Revisão antes de finalizar o pedido (checkout em 2 etapas).** O
  mockup de Novo Pedido tem botões "Ir para checkout" + "Finalizar
  pedido"; a implementação atual tem um único botão "Enviar pedido"
  que já grava `status: 'recebido'` diretamente. **TBD:** não há
  nenhuma documentação prévia definindo se deve existir uma etapa de
  revisão/confirmação antes do envio definitivo — decisão do dono do
  projeto.
- **Informações que o cliente deve/não deve ver.** **Já documentado**
  (não é TBD) em `docs/architecture/PORTAL_B2B_ARCHITECTURE_RULES.md`
  e reforçado por `tests/cliente-portal-visual.smoke.js`: nunca expor
  `service_role`, `token_acesso`, `metadata`, `criado_por`, `origem`,
  a tabela interna `pedido_eventos`, nem OP/lote/fornecedor/NF/
  romaneio/custo/margem. Qualquer fase futura de correção visual deve
  preservar essa regra e os testes existentes que a verificam.
- **Status operacional exibido junto do status visual no Detalhe.**
  Identificado em §6: a tela atual mostra tanto o status visual
  publicado (ex. "Acabamento") quanto o status operacional bruto (ex.
  "Confirmado", via `pedidoStatusBadge(p.status)`) na mesma página. O
  mockup mostra só uma fonte de status. **TBD:** decidir se o badge de
  status operacional deve continuar visível para o cliente no resumo,
  ou se deve ser removido dessa tela, mantendo só o status visual do
  card de acompanhamento.
- **Campos obrigatórios do pedido.** Hoje só modelo e metros (> 0) são
  obrigatórios no formulário de criação
  (`cliente-pedido-form.js:271-281`). **TBD:** se "Referência do
  cliente" e/ou "Recebimento" (caso sejam adicionados) devem ser
  obrigatórios ou opcionais.
- **Regras de alteração/cancelamento pelo cliente.** Hoje o portal
  cliente é **100% read-only, exceto a criação** do pedido (confirmado
  em `PROJECT_STATE.md`) — não há edição, cancelamento ou qualquer
  ação de escrita pós-criação pelo cliente, e nenhum mockup analisado
  mostra essas ações para o cliente. **TBD:** não há nenhuma decisão
  documentada sobre se isso vai mudar no futuro; nenhuma ação deve ser
  assumida ou implementada sem autorização explícita futura.
- **Nomenclatura final de status.** A taxonomia das 8 etapas + 4
  exceções (stepper) **já está alinhada** ao mockup (confirmado em
  §7) — não é TBD. O que é TBD é a nomenclatura dos **KPIs do
  dashboard** ("Em produção"/"Prontos para expedição"/"Atenção" no
  mockup vs. "Em andamento"/"Prontos / concluídos"/"Atualizações
  recentes" hoje) — decidir se os rótulos e a segmentação dos KPIs
  devem ser alinhados ao mockup ou mantidos como estão.

## 10. Proposta de próximas fases

Pacotes pequenos, cada um isolado por tela/responsabilidade, seguindo
a decomposição obrigatória de
`docs/architecture/PORTAL_B2B_ARCHITECTURE_RULES.md`. Nenhum destes
pacotes está autorizado a iniciar por este documento — cada um precisa
de autorização explícita própria, na ordem que o dono do projeto
escolher.

### `UI-GAP-FIX-DASHBOARD-A`
- **Objetivo:** alinhar visualmente o Dashboard Cliente ao mockup —
  rótulos/segmentação de KPIs, seção de pedidos em destaque (se a
  definição de "destaque" for aprovada), seção de distribuição por
  etapa, ações rápidas.
- **Arquivos provavelmente tocados:** `js/screens/cliente-dashboard.js`
  (único arquivo cliente desta tela); possivelmente novo teste
  `tests/cliente-dashboard.smoke.js` (já existe, precisaria de
  extensão).
- **Risco:** baixo — escopo isolado a um módulo cliente já read-only.
- **Testes provavelmente necessários:** `cliente-dashboard.smoke.js`,
  regressão de `cliente-portal-visual.smoke.js` (guarda anti-regressão
  de SELECTs/segurança).
- **Dependências:** decisão do dono do projeto sobre a definição de
  "pedidos em destaque" (§9 não cobre isso explicitamente — seria
  preciso definir o critério antes de implementar).

### `UI-GAP-FIX-NOVO-PEDIDO-A`
- **Objetivo:** adicionar campos de "Dados gerais" (referência do
  cliente, recebimento), reorganizar itens em tabela com totais, e
  decidir o fluxo de 1 ou 2 etapas (checkout).
- **Arquivos provavelmente tocados:** `js/screens/cliente-pedido-form.js`;
  possivelmente schema já cobre os campos (`referencia_cliente`,
  `tipo_recebimento` já existem em `db/15_status_cliente_visual.sql`),
  então **não deveria** exigir SQL novo, só capturar campos já
  existentes no payload de INSERT.
- **Risco:** médio — toca o único ponto de escrita do portal cliente
  (INSERT em `pedidos`/`pedido_itens`); exige cuidado para não abrir
  campos novos sem validar contra a RLS existente
  (`pedidos_cliente_insert`).
- **Testes provavelmente necessários:**
  `tests/cliente-pedido-form.smoke.js` (existência a confirmar/criar),
  regressão de `cliente-portal-visual.smoke.js`.
- **Dependências:** decisão sobre checkout em 1 ou 2 etapas (§9);
  depende de `UI-GAP-FIX-MODAL-ITEM-A` se a tabela de itens passar a
  abrir o modal em vez do formulário inline atual.

### `UI-GAP-FIX-MODAL-ITEM-A`
- **Objetivo:** decidir se o fluxo de adicionar item migra de "linha
  inline" para "modal", e se isso vier a ser aprovado, implementar
  campos de Cor 1/Cor 2/Largura por item (já existem na leitura do
  detalhe, faltam na escrita) e avaliar a viabilidade de "referência
  visual" (upload de imagem).
- **Arquivos provavelmente tocados:** `js/screens/cliente-pedido-form.js`
  (ou novo módulo de modal, se a decisão for por componente
  reutilizável); `js/ui.js` (se for usar `window.modal` já existente).
- **Risco:** médio — upload de imagem introduziria uma superfície nova
  (armazenamento de arquivo) que não existe hoje em nenhuma tela do
  app; precisa de decisão explícita antes de qualquer código.
- **Testes provavelmente necessários:** novo smoke dedicado ao
  componente de modal/item, regressão do formulário de criação.
- **Dependências:** decisão do dono do projeto sobre upload de imagem
  (pode ficar fora de escopo desta fase se não houver
  bucket/Storage decidido); depende de `UI-GAP-FIX-NOVO-PEDIDO-A` para
  o contexto de tabela onde o modal seria acionado.

### `UI-GAP-FIX-DETALHE-A`
- **Objetivo:** resumo em 4 cards (itens/metragem/última
  atualização/prazo previsto), breadcrumb, decisão sobre exibir ou não
  o status operacional junto do status visual, datas por etapa no
  stepper (se aprovado), ajuste de nomenclatura de colunas
  ("Cores").
- **Arquivos provavelmente tocados:** `js/screens/cliente-pedido-detail.js`,
  possivelmente `js/screens/cliente-pedido-tracking.js` (se as datas
  por etapa forem aprovadas — exigiria nova lógica de derivação a
  partir de `pedido_cliente_eventos`).
- **Risco:** baixo para o resumo/breadcrumb/nomenclatura (dados já
  carregados ou já no schema); médio para as datas por etapa do
  stepper, pois depende de uma regra de derivação ainda não definida.
- **Testes provavelmente necessários:** `cliente-pedido-detail.smoke.js`,
  `cliente-pedido-tracking.smoke.js`, regressão de
  `cliente-portal-visual.smoke.js`.
- **Dependências:** decisão sobre exibição do status operacional (§9);
  decisão sobre regra de derivação de datas por etapa antes de tocar o
  stepper.

### `UI-GAP-FIX-SHELL-A`
- **Objetivo:** redesenhar a sidebar/topbar cliente (marca, pílula de
  papel, cartão de usuário, ícones, itens "Novo pedido" e "Suporte" no
  menu).
- **Arquivos provavelmente tocados:** `js/screens/cliente-common.js`
  no mínimo; **possivelmente** `js/screens/common.js` (`shellLayout`),
  o que afetaria também admin e fornecedor.
- **Risco:** **alto** — é o único pacote desta lista com risco de
  efeito colateral fora do portal cliente, por causa do
  `shellLayout` compartilhado. Decisão prévia necessária: criar um
  shell exclusivo para cliente (duplicando a estrutura, sem tocar
  `common.js`) versus parametrizar o `shellLayout` existente por
  papel. Ambas as abordagens têm trade-offs que devem ser decididos
  antes do código, não durante.
- **Testes provavelmente necessários:** regressão completa de
  `boot.smoke.js`, `cliente-routing.smoke.js`, e qualquer smoke que
  hoje assuma a estrutura atual de `shellLayout`/`ADMIN_MENU`.
- **Dependências:** autorização explícita extra dado o risco
  cross-role; nenhuma outra fase desta lista depende desta, mas esta
  deveria ser a **última** a rodar, justamente para isolar o risco.

### `UI-OPERATIONS-RULES-A`
- **Objetivo:** fase **docs-only** para resolver, com o dono do
  projeto, os TBDs do §9 (tipo de recebimento obrigatório ou não,
  checkout em 1 ou 2 etapas, status operacional visível ou não no
  detalhe, campos obrigatórios, regras futuras de
  edição/cancelamento) **antes** de qualquer uma das fases de UI acima
  que dependa dessas decisões.
- **Arquivos provavelmente tocados:** apenas documentação
  (`PROJECT_STATE.md`, possivelmente um novo doc de regras de negócio
  do portal cliente).
- **Risco:** nenhum (sem código).
- **Testes:** nenhum (fase docs-only).
- **Dependências:** nenhuma — pode (e talvez deva) ser a **primeira**
  fase a rodar, pois `UI-GAP-FIX-NOVO-PEDIDO-A`,
  `UI-GAP-FIX-MODAL-ITEM-A` e parte de `UI-GAP-FIX-DETALHE-A` dependem
  de decisões que ela resolveria primeiro.

## 11. Confirmações finais

- **Nenhuma alteração de UI foi implementada** nesta fase.
- **Nenhum código (`js/**`), schema, SQL, Edge Function ou chamada
  Supabase foi feita ou alterada** nesta fase.
- **Produção permanece bloqueada**; `origin/main` e
  `bhgifjrfagkzubpyqpew` não foram tocados.
- **Nenhuma senha, token ou credencial foi registrada** neste
  documento.
- **A UI atual não é declarada final** — este documento apenas
  registra divergências para decisão futura do dono do projeto.
