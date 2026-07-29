// =====================================================================
// === SCREENS: PEDIDO FORM ============================================
// Tela admin `#/pedidos/novo` - formulario de criacao de Pedido.
//
// Fase: RAVATEX-TAPETES-PEDIDOS-UI-ADMIN-C2 +
//   RAVATEX-TAPETES-ADMIN-NOVO-PEDIDO-MATCH-CLIENTE-NOVA-VIEW-A
// Escopo: criacao admin de Pedido (rascunho), reaproveitando a base
//   visual homologada de Cliente -> Novo Pedido sem alterar o payload,
//   permissoes, fluxo de salvamento ou navegacao administrativa.
//
// Carregar via <script src="js/screens/pedido-form.js?v=...></script>
// no <head>, DEPOIS de js/screens/pedidos-list.js, js/pedido-ui.js e
// js/ui.js, e ANTES do <script> inline principal (compatibilidade com
// o setRoutes registrado em js/boot.js).
//
// Limitacao conhecida:
//   - Sem RPC/transacao atomica: grava 1 INSERT em `pedidos` e depois
//     N INSERTs em `pedido_itens`. Se a segunda etapa falhar, compensa
//     com DELETE do pedido criado.
//
// KLEBER-APP-OPERATIONAL-STABILIZATION-BATCH-02-R1:
//   - cabecalho ganha `Numero do pedido` (opcional, SOMENTE nesta tela de
//     criacao admin) e `Data do pedido` (obrigatoria), nesta ordem, antes de
//     `Prazo desejado`. `data_pedido` persiste em coluna propria; `criado_em`
//     NUNCA e usado como data comercial (db/89);
//   - o item deixou de ser uma entidade dentro de um modal: `Adicionar item`
//     acrescenta uma LINHA EDITAVEL, e Tipo/Modelo sao selecionados na propria
//     linha (VER A CORRECAO DE DUPLA ENTRADA ABAIXO);
//   - a linha e a regra Tipo-antes-de-Modelo pertencem a
//     js/screens/pedido-item-row-editor.js. Este arquivo caiu de 1089 para
//     ~700 linhas com a extracao, e o debito estrutural de BATCH-01 esta
//     QUITADO (CODE_HEALTH_RULES.md sec.7);
//   - `modelos.tipo_produto` agora FALHA FECHADA: sem o metadado a tela nao
//     oferece modelo algum, em vez de degradar tudo para Tapete.
//   O payload de `pedido_itens` permanece semanticamente inalterado: o tipo
//   NAO e persistido, continua sendo fato de `modelos.tipo_produto`.
//
// CORRECAO — PRE-PREENCHIMENTO DO NUMERO DO PEDIDO:
//   - `Numero do pedido` NAO abre mais vazio com o placeholder `Automático`.
//     Ao abrir, a tela consulta `public.consultar_proximo_numero_pedido()`
//     (db/90) e mostra o CANDIDATO NUMERICO dentro do input editavel;
//   - a sugestao vem do estado da sequencia de identidade, NUNCA de
//     MAX(numero)+1, e consultar NAO consome nem avanca a sequencia;
//   - o numero visivel e exatamente o numero tentado no salvamento;
//   - a sugestao NAO e reserva. Se outro Pedido tomar o numero antes do
//     envio, o UNIQUE do banco recusa (23505) e a tela pede uma sugestao
//     NOVA e a exibe — jamais troca o numero em silencio;
//   - se o operador digitou um numero proprio e ele estiver ocupado, o valor
//     digitado e PRESERVADO e a mensagem e "Este número de pedido já está em
//     uso.";
//   - a superficie de cliente (`cliente-pedido-form.js`) continua sem expor
//     este numero interno: ela nao tem o campo e nao chama a RPC.
//
// PEDIDO-ADMIN-DUAL-ITEM-ENTRY-RESTORE-R1 — CORRECAO PROGRESSIVA.
//   BATCH-02 trocou o modal detalhado pela linha editavel e REMOVEU o modal,
//   perdendo uma superficie homologada. O arquiteto decidiu que as DUAS
//   convivem e nenhuma substitui a outra: `Adicionar item` (botao principal do
//   cabecalho) abre o MODAL DETALHADO — dono js/screens/pedido-item-modal.js,
//   rascunho LOCAL, abri-lo NAO insere linha —, e `Adicionar linha` (acao
//   discreta em hyperlink, canto inferior direito) acrescenta UMA linha em
//   branco a tabela inline. Ambos convergem no MESMO `state.itens` (construtor
//   unico novoItem) e no MESMO payload. Edicao inline, remocao, totais, ordem,
//   data, numeracao e salvamento nao mudaram.
// =====================================================================

(function (window) {
  'use strict';

  // PEDIDO-UNIFIED-ADMIN-EDITOR-R1: identidade local de item e totais
  // passam a ter UM dono compartilhado com o editor administrativo
  // (js/pedido-draft.js), em vez de uma segunda implementacao aqui.
  // Persistencia (INSERT direto) e validacao de salvamento permanecem
  // locais: esta tela grava por DML direto, nao pela RPC salvar_pedido_admin,
  // entao o payload e as mensagens de erro sao um caminho estruturalmente
  // diferente e continuam nao migrados nesta fase.
  function novoUid() {
    return window.RAVATEX_PEDIDO_DRAFT.novoUid();
  }

  function svgEl(markup) {
    var tmp = document.createElement('div');
    tmp.innerHTML = markup;
    return tmp.firstElementChild;
  }

  var SVG_BACK = '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="var(--rv-text-primary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>';
  var SVG_PLUS = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>';
  var SVG_CALENDAR = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--rv-text-tertiary)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="8" y1="3" x2="8" y2="6"></line><line x1="16" y1="3" x2="16" y2="6"></line></svg>';
  var SVG_CHEVRON = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--rv-text-tertiary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>';

  // Dono UNICO da linha de item e da regra Tipo-antes-de-Modelo.
  function itemRowApi() {
    return window.RAVATEX_PEDIDO_ITEM_ROW || null;
  }

  // Dono UNICO do modal detalhado de item (js/screens/pedido-item-modal.js).
  function itemModalApi() { return window.RAVATEX_PEDIDO_ITEM_MODAL || null; }

  // Forma LOCAL unica do item: modal e linha rapida passam os DOIS por aqui, e
  // por isso um item de um caminho e indistinguivel do outro — estado e payload.
  function novoItem(dados) {
    // buildRow() sempre RE-DERIVA item.tipo a partir de item.modeloId quando
    // ha modelo selecionado, entao a forma do dono compartilhado (sem `tipo`
    // proprio) e equivalente para os dois caminhos de entrada: o modal exige
    // modelo antes de confirmar, e a linha rapida comeca sem modelo e sem tipo.
    return window.RAVATEX_PEDIDO_DRAFT.novoItem(dados);
  }

  // Dono UNICO do contrato de numeracao (candidato, deteccao de ocupado,
  // textos). Ver js/screens/pedido-numero-sugestao.js.
  function numeroApi() {
    return window.RAVATEX_PEDIDO_NUMERO;
  }

  // Data local do NAVEGADOR em YYYY-MM-DD. Nao usar toISOString(): ela
  // converte para UTC e, a noite no Brasil, devolveria o dia seguinte.
  function hojeLocalISO() {
    var now = new Date();
    var mes = String(now.getMonth() + 1);
    var dia = String(now.getDate());
    return now.getFullYear() + '-' + (mes.length < 2 ? '0' + mes : mes) + '-' + (dia.length < 2 ? '0' + dia : dia);
  }

  async function screenPedidoNovo() {
    var container = window.el('div', {});

    var clientes = [];
    var modelos = [];
    var loadingError = null;
    var isLoading = true;
    // Falha fechada: enquanto o metadado de tipo nao for carregado, nenhum
    // modelo pode ser oferecido (ver js/screens/pedido-item-row-editor.js).
    var tipoMetadataOk = false;

    var state = {
      clienteId: '',
      numero: '',
      dataPedido: hojeLocalISO(),
      prazoEntrega: '',
      observacao: '',
      itens: [novoItem()]
    };
    var postSave = null;
    // PEDIDO-ITEM-MENTION-OBSERVATION-UX-R1: o textarea e recriado a cada
    // render(); estas 3 vivem fora de buildBottomSection porque
    // buildItensCard() roda ANTES dela no mesmo render() e so LE (nunca
    // captura por valor) no clique — a build mais recente sempre vale.
    var obsTextareaRef = null;
    var obsTextareaFocused = false;
    var syncObservacaoRef = null;

    // Insere a mencao via js/pedido-draft.js (aritmetica pura) + o MESMO
    // path normal de input (syncObservacaoRef) — sem estado paralelo.
    // Cliques repetidos inserem referencias repetidas, sem dedup.
    function handleItemMention(mentionText) {
      var textarea = obsTextareaRef;
      var draft = window.RAVATEX_PEDIDO_DRAFT;
      if (!textarea || !mentionText || !draft || typeof draft.computeMentionInsertion !== 'function') return;
      var result = draft.computeMentionInsertion(textarea.value, textarea.selectionStart, obsTextareaFocused, mentionText);
      textarea.value = result.value;
      if (typeof syncObservacaoRef === 'function') syncObservacaoRef();
      if (typeof textarea.focus === 'function') textarea.focus();
      if (typeof textarea.setSelectionRange === 'function') textarea.setSelectionRange(result.caret, result.caret);
      if (typeof window.autosizeTextarea === 'function') window.autosizeTextarea(textarea);
      if (typeof textarea.scrollIntoView === 'function') textarea.scrollIntoView({ block: 'nearest' });
    }

    var numeroErro = null;
    // Aviso NAO-erro: usado quando o numero sugerido foi tomado por outro
    // Pedido entre a abertura da tela e o envio, e uma sugestao nova entrou
    // no lugar.
    var numeroAviso = null;
    // `true` enquanto o valor do campo for a sugestao vinda da RPC e o
    // operador nao o tiver editado. Distingue os dois tratamentos de conflito
    // exigidos: sugestao tomada -> renovar; numero digitado ocupado -> manter.
    var numeroEhSugestao = false;
    // `true` quando a RPC nao pode ser consultada (sem permissao, offline,
    // db/90 ainda nao aplicado). O campo fica vazio e o salvamento cai na
    // alocacao automatica da coluna de identidade.
    var numeroSugestaoIndisponivel = false;

    function totalMetrosStr() {
      return window.RAVATEX_PEDIDO_DRAFT.totalMetrosLabel(state.itens);
    }

    function updateItensSummary() {
      var totalLabel = totalMetrosStr();
      var itemCountLabel = String(state.itens.length);
      if (!container.querySelectorAll) return;

      var totalNodes = container.querySelectorAll('[data-pedido-total-metros]');
      for (var i = 0; i < totalNodes.length; i++) {
        totalNodes[i].textContent = totalLabel;
      }

      var countNodes = container.querySelectorAll('[data-pedido-total-itens]');
      for (var c = 0; c < countNodes.length; c++) {
        countNodes[c].textContent = itemCountLabel;
      }

      var summaryNodes = container.querySelectorAll('[data-pedido-checkout-summary]');
      for (var s = 0; s < summaryNodes.length; s++) {
        summaryNodes[s].textContent = 'Resumo: ' + itemCountLabel + ' item(ns) | ' + totalLabel;
      }
    }

    function clienteNomeById(id) {
      for (var i = 0; i < clientes.length; i++) {
        if (String(clientes[i].id) === String(id)) return clientes[i].nome;
      }
      return '-';
    }


    async function carregarDados() {
      var results = await Promise.all([
        window.supa.from('clientes').select('id, nome').order('nome'),
        window.supa
          .from('modelos')
          .select('id, nome, largura, cor_1:cor_1_id(id, nome), cor_2:cor_2_id(id, nome)')
          .order('nome')
      ]);

      var cliRes = results[0];
      var modRes = results[1];

      if (cliRes.error) {
        loadingError = 'clientes';
        window.toast('Erro ao carregar clientes', 'error');
        console.error(cliRes.error);
      } else {
        clientes = cliRes.data || [];
      }

      if (modRes.error) {
        loadingError = loadingError || 'modelos';
        window.toast('Erro ao carregar modelos', 'error');
        console.error(modRes.error);
      } else {
        modelos = modRes.data || [];
        await carregarTipoProduto();
      }

      await carregarProximoNumero();
    }

    // Sugestao numerica exibida na ABERTURA e renovada apos um conflito.
    // Falhar aqui NAO impede criar Pedido: o campo fica vazio e a coluna de
    // identidade aloca o numero no INSERT.
    async function carregarProximoNumero() {
      var candidato = await numeroApi().consultarProximoNumero(window.supa);
      if (candidato === null) {
        numeroSugestaoIndisponivel = true;
        numeroEhSugestao = false;
        state.numero = '';
        return;
      }
      numeroSugestaoIndisponivel = false;
      numeroEhSugestao = true;
      state.numero = String(candidato);
    }

    // Carrega `modelos.tipo_produto`. FALHA FECHADA (BATCH-02): se o metadado
    // de tipo nao chega, a tela NAO oferece modelo algum e reporta o erro.
    // Degradar todo modelo desconhecido para Tapete e proibido — colocaria uma
    // Manta na rota de acabamento sem ninguem perceber. Somente LEITURA;
    // `tipo_produto` nunca e escrito por esta tela.
    async function carregarTipoProduto() {
      try {
        var tpRes = await window.supa.from('modelos').select('id, tipo_produto');
        if (tpRes.error || !Array.isArray(tpRes.data)) {
          loadingError = loadingError || 'tipo de produto dos modelos';
          console.error('pedido-form: tipo_produto indisponivel', tpRes.error);
          return;
        }
        var tpById = {};
        tpRes.data.forEach(function (row) {
          if (row && row.id != null) tpById[String(row.id)] = row.tipo_produto;
        });
        modelos.forEach(function (modelo) {
          if (tpById[String(modelo.id)] != null) modelo.tipo_produto = tpById[String(modelo.id)];
        });
        tipoMetadataOk = true;
      } catch (e) {
        loadingError = loadingError || 'tipo de produto dos modelos';
        console.error('pedido-form: tipo_produto indisponivel', e);
      }
    }

    function buildHeader() {
      return window.el('div', {
        style: 'display:flex; align-items:flex-start; justify-content:space-between; gap:16px; margin-bottom:16px; flex-wrap:wrap;'
      },
      window.el('div', { style: 'display:flex; align-items:flex-start; gap:16px;' },
        window.el('div', {
          style: 'width:36px; height:36px; border:1px solid var(--rv-border-soft); border-radius:var(--rv-radius); display:flex; align-items:center; justify-content:center; flex-shrink:0; cursor:pointer;',
          onclick: function () { window.navigate('#/pedidos'); }
        }, svgEl(SVG_BACK)),
        window.el('div', {},
          window.el('h1', {
            style: 'margin:0; font-size:var(--rv-fs-title); font-weight:800; color:var(--rv-text-primary); letter-spacing:-.01em;'
          }, 'Novo pedido'),
          window.el('div', {
            style: 'font-size:var(--rv-fs-value); color:var(--rv-text-tertiary); margin-top:4px; max-width:760px;'
          }, 'Preencha os itens do pedido. Após o salvamento, ele ficará como Rascunho.')
        )
      ),
      // SCREEN-GROUP-1: a secondary action in an entity header is the
      // --rv-h-default rung (34px). It used to take its height from `padding:8px`
      // (~37px, off the ladder) and to spell 14px, a size the typography enum
      // does not own. The vertical padding goes because it competes with an
      // explicit height; the horizontal 18px is unchanged.
      window.el('button', {
        type: 'button',
        style: 'background:var(--rv-surface); color:var(--rv-text-primary); border:1px solid var(--rv-border-strong); border-radius:var(--rv-radius); height:var(--rv-h-default); padding:0 18px; display:inline-flex; align-items:center; justify-content:center; font-weight:600; font-size:var(--rv-fs-body); font-family:inherit; cursor:pointer; white-space:nowrap;',
        onclick: function () { window.navigate('#/pedidos'); }
      }, 'Cancelar'));
    }

    function buildFieldLabel(text, required) {
      var children = [text];
      if (required) {
        children.push(' ');
        children.push(window.el('span', { style: 'color:var(--rv-signal-negative);' }, '*'));
      }
      return window.el('label', {
        style: 'display:block; font-size:var(--rv-fs-sm); color:var(--rv-text-secondary); margin-bottom:5px; white-space:nowrap;'
      }, children);
    }

    // Altura UNICA de controle para os CINCO campos de Dados gerais.
    //
    // SCREEN-GROUP-1 — CORRECAO PROGRESSIVA DA INVARIANTE DE BATCH-03.
    // BATCH-03 declarou uma altura unica e a fixou em 40px porque, naquele
    // momento, os cinco campos usavam esta mesma caixa: Cliente e Status eram
    // <select> nativos dentro dela. A passada 7 (UIC-006) tirou os dois da
    // caixa — Cliente virou o trigger canonico do select-popover e Status virou
    // o campo somente-leitura canonico —, e ambos declaram
    // `height:var(--rv-h-compact)` (32px). A INVARIANTE quebrou em silencio:
    // desde entao a mesma linha do grid renderiza 32px, 40px, 40px, 40px, 32px.
    //
    // A invariante de BATCH-03 e "uma altura para os cinco", nao "40px". Ela e
    // restaurada aqui no degrau canonico que os dois donos compartilhados ja
    // usam, com o mesmo padding horizontal de 12px do trigger. O valor 40px
    // nunca pertenceu ao enum de altura de controle (32/34/38).
    function fieldBoxStyle(erro) {
      return 'display:flex; align-items:center; gap:8px; height:var(--rv-h-compact); box-sizing:border-box;'
        + ' border:1px solid ' + (erro ? 'var(--rv-signal-negative-border)' : 'var(--rv-border-strong)')
        + '; border-radius:var(--rv-radius); padding:0 12px; background:var(--rv-surface);';
    }

    function buildDadosGeraisCard() {
      // Pass-7 (UIC-006): canonical select popover. It owns its own box and
      // chevron, so the former buildSelectBox facade is gone.
      var clienteOpcoes = [];
      for (var i = 0; i < clientes.length; i++) {
        clienteOpcoes.push({ value: clientes[i].id, label: clientes[i].nome });
      }
      var clienteSelect = window.createSelectPopover({
        options: clienteOpcoes,
        value: state.clienteId,
        placeholder: 'Selecione o cliente...',
        ariaLabel: 'Cliente'
      });
      clienteSelect.addEventListener('change', function () {
        state.clienteId = clienteSelect.value;
      });

      // Numero do pedido: campo ADMIN, apenas na criacao.
      // ABRE PRE-PREENCHIDO com o candidato lido da sequencia de identidade
      // (db/90). NAO existe placeholder `Automático`: o operador ve o numero
      // real que sera tentado, e pode substitui-lo por qualquer positivo
      // livre. A checagem de disponibilidade e apenas consultiva: a autoridade
      // e o UNIQUE do banco.
      var numeroInput = window.el('input', {
        type: 'number',
        min: '1',
        step: '1',
        value: state.numero,
        'data-pedido-numero': '1',
        'data-pedido-numero-sugerido': numeroEhSugestao ? '1' : '0',
        style: 'flex:1; border:none; outline:none; font-size:var(--rv-fs-body); color:var(--rv-text-primary); background:transparent; font-family:inherit; min-width:0;'
      });
      numeroInput.addEventListener('input', function () {
        state.numero = numeroInput.value;
        // A partir da primeira edicao o valor e do operador, nao da sugestao:
        // um conflito passa a ser tratado preservando o que ele digitou.
        numeroEhSugestao = false;
        numeroErro = null;
        numeroAviso = null;
        numeroMsg.textContent = '';
        numeroAjuda.textContent = '';
      });
      // Sem `min-height`: uma linha de mensagem vazia colapsa para 0px em vez
      // de reservar uma faixa permanente sob um unico campo da linha.
      var numeroMsg = window.el('div', {
        'data-pedido-numero-erro': '1',
        style: 'font-size:var(--rv-fs-2xs); line-height:1.35; color:var(--rv-signal-negative); margin-top:3px;'
      }, numeroErro || '');
      // Linha auxiliar: aviso de sugestao renovada (ambar) ou o texto de ajuda
      // permanente (cinza). Nunca compete com a mensagem de erro acima.
      var numeroAjudaTexto = '';
      var numeroAjudaCor = 'var(--rv-text-tertiary)';
      if (numeroAviso) {
        numeroAjudaTexto = numeroAviso;
        numeroAjudaCor = 'var(--rv-signal-caution)';
      } else if (numeroEhSugestao) {
        numeroAjudaTexto = numeroApi().MSG_AJUDA_SUGESTAO;
      } else if (numeroSugestaoIndisponivel && String(state.numero).trim() === '') {
        numeroAjudaTexto = numeroApi().MSG_SEM_SUGESTAO;
      }
      var numeroAjuda = window.el('div', {
        'data-pedido-numero-ajuda': '1',
        style: 'font-size:var(--rv-fs-2xs); line-height:1.35; color:' + numeroAjudaCor + '; margin-top:3px;'
      }, numeroAjudaTexto);
      var numeroWrap = window.el('div', { style: fieldBoxStyle(numeroErro) }, numeroInput);

      // Data do pedido: data COMERCIAL, obrigatoria, default hoje (local).
      // Persiste em pedidos.data_pedido; nunca derivada de criado_em.
      var dataPedidoInput = window.el('input', {
        type: 'date',
        value: state.dataPedido,
        'data-pedido-data': '1',
        style: 'flex:1; border:none; outline:none; font-size:var(--rv-fs-body); color:var(--rv-text-primary); background:transparent; font-family:inherit; min-width:0;'
      });
      dataPedidoInput.addEventListener('change', function () {
        state.dataPedido = dataPedidoInput.value;
      });
      var dataPedidoWrap = window.el('div', { style: fieldBoxStyle(false) },
        dataPedidoInput, svgEl(SVG_CALENDAR));

      var prazoInput = window.el('input', {
        type: 'date',
        value: state.prazoEntrega,
        'data-pedido-prazo': '1',
        style: 'flex:1; border:none; outline:none; font-size:var(--rv-fs-body); color:var(--rv-text-primary); background:transparent; font-family:inherit; min-width:0;'
      });
      prazoInput.addEventListener('change', function () {
        state.prazoEntrega = prazoInput.value;
      });
      var prazoWrap = window.el('div', { style: fieldBoxStyle(false) },
        prazoInput, svgEl(SVG_CALENDAR));

      // Pass-7 (UIC-006) §12: Status inicial offered exactly ONE permanently
      // disabled option, so it was never a selection decision — it is a
      // read-only statement of the state a new Pedido opens in. It is now a
      // static compact field: no combobox role, no popup, no tab stop and no
      // native select. The persisted state and payload are unchanged; the
      // screen never read this control's value.
      var statusSelect = window.createReadonlyFieldValue({ text: 'Rascunho' });
      statusSelect.setAttribute('data-pedido-status-readonly', '1');

      // UMA unica grade para os cinco campos. As duas grades fixas anteriores
      // (2 colunas + 3 colunas) produziam uma faixa vertical vazia entre elas
      // que nao carregava informacao alguma, e esticavam Numero/Data/Prazo/
      // Status em blocos largos demais num monitor amplo.
      //
      // As proporcoes 30/17/17/17/19 dao a Cliente — o unico campo com texto
      // livre longo — o dobro de qualquer outro, e mantem os quatro curtos
      // compactos. A adaptacao por largura (5 -> 3 -> 2 -> 1 coluna) e do
      // contrato `data-rv-pedido-dados` em css/responsive.css: um layout fixo
      // de duas linhas para TODA largura de desktop foi rejeitado.
      return window.el('div', {
        style: 'background:var(--rv-surface); border:1px solid var(--rv-border); border-radius:var(--rv-radius); box-shadow:var(--rv-shadow-none); padding:16px; margin-bottom:12px;'
      },
      window.el('div', { style: 'font-size:var(--rv-fs-component-heading); font-weight:700; color:var(--rv-text-primary); margin-bottom:12px;' }, 'Dados gerais'),
      // Ordem visual exigida: Cliente -> Numero -> Data -> Prazo -> Status.
      window.el('div', {
        'data-pedido-header-grid': '1',
        'data-rv-pedido-dados': '1',
        style: 'display:grid; grid-template-columns:minmax(0,30fr) minmax(0,17fr) minmax(0,17fr) minmax(0,17fr) minmax(0,19fr); column-gap:14px; row-gap:12px; align-items:start;'
      },
      window.el('div', { style: 'min-width:0;' },
        buildFieldLabel('Cliente', true),
        clienteSelect
      ),
      window.el('div', { style: 'min-width:0;' },
        buildFieldLabel('Número do pedido'),
        numeroWrap,
        numeroMsg,
        numeroAjuda
      ),
      window.el('div', { style: 'min-width:0;' },
        buildFieldLabel('Data do pedido', true),
        dataPedidoWrap
      ),
      window.el('div', { style: 'min-width:0;' },
        buildFieldLabel('Prazo desejado'),
        prazoWrap
      ),
      window.el('div', { style: 'min-width:0;' },
        buildFieldLabel('Status inicial'),
        statusSelect
      )));
    }

    function buildItensCard() {
      var api = itemRowApi();
      var rowsWrap = window.el('div', {});
      for (var i = 0; i < state.itens.length; i++) {
        rowsWrap.appendChild(api.buildRow({
          item: state.itens[i],
          index: i,
          modelos: modelos,
          typeMetadata: tipoMetadataOk,
          onChange: updateItensSummary,
          onMention: handleItemMention,
          onRemove: function (target) {
            state.itens = state.itens.filter(function (current) { return current.uid !== target.uid; });
            render();
          }
        }));
      }

      // ENTRADA PRINCIPAL — abre o MODAL DETALHADO. O modal tem rascunho
      // proprio: clicar aqui NAO acrescenta linha. Ele so toca state.itens na
      // CONFIRMACAO, e pelo mesmo novoItem() da linha rapida.
      var addBtn = window.el('button', {
        type: 'button',
        'data-pedido-add-item': '1',
        style: 'display:inline-flex; align-items:center; gap:8px; background:var(--rv-surface); color:var(--rv-accent-blue); border:1px solid var(--rv-brand); border-radius:var(--rv-radius); height:var(--rv-h-default); padding:0 13px; font-weight:600; font-size:var(--rv-fs-body); font-family:inherit; cursor:pointer; white-space:nowrap;',
        onclick: function () {
          itemModalApi().openAddItemModal({
            modelos: modelos,
            typeMetadata: tipoMetadataOk,
            onConfirm: function (dados) {
              state.itens.push(novoItem(dados));
              render();
            }
          });
        }
      }, svgEl(SVG_PLUS), 'Adicionar item');

      // ENTRADA RAPIDA — acao DISCRETA em estilo hyperlink. E um <button> de
      // verdade, nao <a href="#"> nem <span>: a acao nao navega, muta estado
      // local — dai ativacao por teclado, papel correto e nome acessivel. So a
      // APARENCIA e de link: sem fundo, sem borda, sem geometria de botao, na
      // cor canonica de texto interativo.
      //
      // O estilo NAO declara `outline:none`: medido no navegador, repor o anel
      // por manipulador de foco nao cobre todo caminho de foco e a acao ficava
      // sem NENHUMA indicacao visivel. O anel nativo de :focus-visible e a
      // indicacao, como em todo botao inline desta tela. Hover vai por
      // manipulador porque a superficie e inline (padrao js/ui.js).
      var quickRowLink = window.el('button', {
        type: 'button',
        'data-pedido-add-linha': '1',
        'aria-label': 'Adicionar linha',
        title: 'Adicionar linha em branco à tabela',
        style: 'display:inline-flex; align-items:center; background:none; border:none; border-radius:var(--rv-radius); padding:2px; margin:0; color:var(--rv-accent-blue); font-family:inherit; font-size:var(--rv-fs-sm); font-weight:600; line-height:1.4; text-decoration:underline; text-underline-offset:3px; cursor:pointer;',
        onclick: function () {
          state.itens.push(novoItem());
          render();
        }
      }, 'Adicionar linha');
      quickRowLink.addEventListener('mouseenter', function () { quickRowLink.style.color = 'var(--rv-brand-strong)'; });
      quickRowLink.addEventListener('mouseleave', function () { quickRowLink.style.color = 'var(--rv-accent-blue)'; });

      // Fecha o cartao, a direita, subordinada ao botao do cabecalho — NUNCA
      // ao lado de "Adicionar item": sao dois pesos diferentes.
      var quickRowSlot = window.el('div', {
        'data-pedido-add-linha-slot': '1',
        style: 'display:flex; align-items:center; justify-content:flex-end; margin-top:10px;'
      }, quickRowLink);

      var table = window.el('div', {
        style: 'border:1px solid var(--rv-border); border-radius:var(--rv-radius); overflow:hidden;'
      },
      // O container e o dono do overflow horizontal: a linha de item tem
      // largura minima propria e nunca pode empurrar o documento num viewport
      // estreito (contrato `data-rv-table-scroll`).
      window.el('div', { 'data-rv-table-scroll': '1', style: 'overflow-x:auto;' },
        api.buildHeader(),
        rowsWrap
      ),
      // O resumo fica colado a tabela, dentro da mesma moldura.
      window.el('div', {
        style: 'display:flex; align-items:center; justify-content:space-between; gap:16px; padding:8px 14px; background:var(--rv-surface-subtle); flex-wrap:wrap;'
      },
      window.el('span', { style: 'font-size:var(--rv-fs-value); color:var(--rv-text-secondary);' },
        'Total de itens: ',
        window.el('strong', {
          style: 'color:var(--rv-text-primary); font-weight:700;',
          'data-pedido-total-itens': '1'
        }, String(state.itens.length))
      ),
      window.el('span', { style: 'font-size:var(--rv-fs-value); color:var(--rv-text-secondary);' },
        'Metragem total: ',
        window.el('strong', {
          style: 'color:var(--rv-text-primary); font-weight:700;',
          'data-pedido-total-metros': '1'
        }, totalMetrosStr())
      )));

      return window.el('div', {
        style: 'background:var(--rv-surface); border:1px solid var(--rv-border); border-radius:var(--rv-radius); box-shadow:var(--rv-shadow-none); padding:16px; margin-bottom:12px;'
      },
      window.el('div', {
        style: 'display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:12px; flex-wrap:wrap;'
      },
      window.el('div', { style: 'font-size:var(--rv-fs-component-heading); font-weight:700; color:var(--rv-text-primary);' }, 'Itens do pedido'),
      addBtn),
      table,
      quickRowSlot, window.RAVATEX_PEDIDO_PRIORITY ? window.RAVATEX_PEDIDO_PRIORITY.painelDeCriacao(state, 'admin', { modelos: modelos }, render) : null);
    }

    function buildBottomSection(saveBtn) {
      // B1: autosizing is preserved exactly, but it is now CONTENT-DRIVEN by
      // the shared owner: window.textArea({ autosize: true }) binds the sync
      // and window.autosizeTextarea() performs it. The 40px floor moves to the
      // canonical `autosize` role as a CSS min-height, which is why the old
      // Math.max() clamp is no longer needed — a min-height cannot be
      // undercut by an explicit height. The state binding is unchanged.
      function syncTextareaHeight() {
        window.autosizeTextarea(obsTextarea);
      }

      var obsTextarea = window.textArea({
        role: 'autosize',
        autosize: true,
        rows: 1,
        value: state.observacao,
        placeholder: 'Informações adicionais sobre conferência, prazo ou observações internas...',
        ariaLabel: 'Observações gerais',
      });
      function syncObservacao() {
        state.observacao = obsTextarea.value;
      }
      obsTextarea.addEventListener('input', syncObservacao);
      // Rastreamento de foco proprio, DELIBERADAMENTE sem reset no blur: um
      // clique no botao de mencao SEMPRE tira o foco do textarea ANTES do
      // onclick rodar (blur -> focus -> click, semantica padrao do
      // navegador), entao resetar aqui tornaria "inserir no caret ativo"
      // estruturalmente inalcancavel — todo clique cairia em "acrescentar ao
      // final". selectionStart/selectionEnd sao preservados pelo navegador
      // apos o blur (nao sao zerados), entao "foi focado nesta renderizacao"
      // e o sinal correto e estavel de "ha um caret significativo a respeitar".
      obsTextarea.addEventListener('focus', function () { obsTextareaFocused = true; });
      obsTextareaRef = obsTextarea;
      obsTextareaFocused = false;
      syncObservacaoRef = syncObservacao;

      var instrCard = window.el('div', {
        style: 'background:var(--rv-surface); border:1px solid var(--rv-border); border-radius:var(--rv-radius); box-shadow:var(--rv-shadow-none); padding:16px;'
      },
      window.el('div', { style: 'font-size:var(--rv-fs-component-heading); font-weight:700; color:var(--rv-text-primary); margin-bottom:10px;' }, 'Observações gerais'),
      obsTextarea);

      window.requestAnimationFrame(function () {
        syncTextareaHeight();
      });

      var checkoutCard = window.el('div', {
        style: 'background:var(--rv-surface); border:1px solid var(--rv-border); border-radius:var(--rv-radius); box-shadow:var(--rv-shadow-none); padding:16px; display:flex; flex-direction:column; justify-content:center;'
      },
      window.el('div', { style: 'font-size:var(--rv-fs-component-heading); font-weight:700; color:var(--rv-text-primary);' }, 'Salvar rascunho'),
      window.el('div', {
        style: 'font-size:var(--rv-fs-body); color:var(--rv-text-tertiary); line-height:1.5; margin-top:10px; margin-bottom:14px;',
        'data-pedido-checkout-summary': '1'
      },
        'Resumo: ' + String(state.itens.length) + ' item(ns) | ' + totalMetrosStr()
      ),
      saveBtn);

      return window.el('div', {
        'data-rv-2col': '1',
        style: 'display:grid; grid-template-columns:3fr 1fr; gap:12px; align-items:stretch;'
      }, instrCard, checkoutCard);
    }

    function buildPostSaveResumo() {
      var pedido = postSave && postSave.pedido ? postSave.pedido : {};
      var resumo = postSave && postSave.resumo ? postSave.resumo : {};
      var pedidoLabel = pedido.numero != null ? '#' + pedido.numero : pedido.id;
      var fields = [
        { label: 'Cliente', value: resumo.clienteNome || '-' },
        { label: 'Pedido', value: pedidoLabel || '-' },
        { label: 'Itens', value: String(resumo.itemCount || 0) },
        { label: 'Metragem total', value: resumo.totalMetrosLabel || '0,00 m' },
      ];

      return window.el('div', {
        style: 'background:var(--rv-surface);border:1px solid var(--rv-pill-info-border);border-radius:var(--rv-radius);box-shadow:var(--rv-shadow-none);padding:18px 20px;margin-bottom:14px;',
        'data-post-save-summary': 'admin',
      },
        window.el('div', {
          style: 'display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:14px;',
        },
          window.el('div', { style: 'min-width:240px;' },
            window.el('div', { style: 'font-size:var(--rv-fs-component-heading);font-weight:800;color:var(--rv-text-primary);margin-bottom:5px;' }, 'Pedido salvo com sucesso'),
            window.el('div', { style: 'font-size:var(--rv-fs-body);color:var(--rv-text-secondary);line-height:1.5;' },
              'O pedido foi salvo. Abra a OP de tecelagem quando estiver pronto para iniciar a producao.')
          )
        ),
        window.el('div', {
          style: 'display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-bottom:16px;',
        }, fields.map(function (field) {
          return window.el('div', {
            style: 'background:var(--rv-surface-subtle);border:1px solid var(--rv-border);border-radius:var(--rv-radius);padding:10px 12px;',
          },
            window.el('div', { style: 'font-size:var(--rv-fs-2xs);color:var(--rv-text-tertiary);font-weight:600;margin-bottom:5px;' }, field.label),
            window.el('div', { style: 'font-size:var(--rv-fs-metric-rail);color:var(--rv-text-primary);font-weight:700;' }, field.value)
          );
        })),
        // Pass-5 STANDARD_ACTION_FOOTER: actions only, right aligned.
        window.el('div', {
          style: 'display:flex;align-items:center;justify-content:flex-end;gap:8px;flex-wrap:wrap;border-top:1px solid var(--rv-border-soft);padding-top:11px;',
          'data-post-save-actions': 'right',
          'data-card-actions': '',
        },
          window.el('button', {
            type: 'button',
            style: 'background:var(--rv-surface);color:var(--rv-text-primary);border:1px solid var(--rv-border-strong);border-radius:var(--rv-radius);height:var(--rv-h-default);padding:0 14px;display:inline-flex;align-items:center;justify-content:center;font-weight:600;font-size:var(--rv-fs-body);font-family:inherit;cursor:pointer;',
            onclick: function () { window.navigate('#/pedidos/' + pedido.id); },
          }, 'Ver pedido'),
          window.el('button', {
            type: 'button',
            style: 'background:var(--rv-surface);color:var(--rv-text-primary);border:1px solid var(--rv-border-strong);border-radius:var(--rv-radius);height:var(--rv-h-default);padding:0 14px;display:inline-flex;align-items:center;justify-content:center;font-weight:600;font-size:var(--rv-fs-body);font-family:inherit;cursor:pointer;',
            onclick: function () { window.navigate('#/pedidos/novo'); },
          }, 'Novo pedido'),
          window.el('button', {
            type: 'button',
            style: 'background:var(--rv-brand);color:var(--rv-text-on-brand);border:none;border-radius:var(--rv-radius);height:var(--rv-h-default);padding:0 16px;display:inline-flex;align-items:center;justify-content:center;font-weight:700;font-size:var(--rv-fs-body);font-family:inherit;cursor:pointer;',
            onclick: function () { window.location.hash = '#/ops/nova?pedido_id=' + pedido.id; },
          }, 'Abrir OP de Tecelagem')
        )
      );
    }

    async function salvar(btn, status) {
      if (!state.clienteId) {
        window.toast('Selecione um cliente.', 'error');
        return;
      }
      if (state.itens.length === 0) {
        window.toast('Adicione ao menos um item.', 'error');
        return;
      }
      if (!state.dataPedido) {
        window.toast('Informe a data do pedido.', 'error');
        return;
      }
      // O numero VISIVEL e o numero tentado — venha ele da sugestao ou da
      // digitacao. So fica em branco quando a sugestao esta indisponivel, e
      // ai a coluna de identidade aloca.
      var numeroDigitado = numeroApi().normalizarNumeroDigitado(state.numero);
      if (!numeroDigitado.valido) {
        window.toast('Número do pedido deve ser um inteiro positivo.', 'error');
        return;
      }
      var numeroEnviado = numeroDigitado.numero;
      // Congelado ANTES do INSERT: `numeroEhSugestao` pode ser mexido por um
      // evento de input durante o await, e o tratamento do conflito tem de
      // corresponder ao valor efetivamente enviado.
      var enviouSugestao = numeroEhSugestao && numeroEnviado !== null;
      for (var i = 0; i < state.itens.length; i++) {
        var item = state.itens[i];
        if (!item.modeloId) {
          window.toast('Item ' + (i + 1) + ': selecione o tipo e o modelo.', 'error');
          return;
        }
        var meters = Number(item.metros);
        if (!Number.isFinite(meters) || meters <= 0) {
          window.toast('Item ' + (i + 1) + ': metros deve ser > 0.', 'error');
          return;
        }
      }

      btn.disabled = true;
      var oldLabel = btn.textContent;
      btn.textContent = 'Salvando...';

      try {
        var pedidoPayload = {
          cliente_id: Number(state.clienteId),
          status: status,
          data_pedido: state.dataPedido
        };
        // Em branco => a coluna de identidade aloca automaticamente.
        if (numeroEnviado !== null) pedidoPayload.numero = numeroEnviado;
        if (state.prazoEntrega) pedidoPayload.prazo_entrega = state.prazoEntrega;
        if (state.observacao) pedidoPayload.observacao = state.observacao;

        var pedidoRes = await window.supa
          .from('pedidos')
          .insert(pedidoPayload)
          .select('id, numero, status, data_pedido')
          .single();

        if (pedidoRes.error || !pedidoRes.data) {
          // Numero ja em uso: o UNIQUE do banco e a autoridade. Em NENHUM dos
          // dois caminhos o numero e trocado silenciosamente por outro — o
          // Pedido nao e criado e o operador decide.
          if (numeroEnviado !== null && numeroApi().isNumeroDuplicado(pedidoRes.error)) {
            if (enviouSugestao) {
              // A sugestao foi tomada por outro Pedido entre a abertura e o
              // envio. Conflito CONTROLADO: pedimos uma sugestao nova, ela
              // aparece no campo, e o operador e avisado do que aconteceu.
              await carregarProximoNumero();
              numeroErro = null;
              numeroAviso = numeroApi().mensagemSugestaoRenovada(
                numeroEnviado,
                numeroSugestaoIndisponivel ? null : state.numero
              );
              window.toast(numeroAviso, 'error');
              render();
              return;
            }
            // Numero digitado pelo operador: o valor digitado e PRESERVADO.
            numeroErro = numeroApi().MSG_EM_USO;
            window.toast(numeroErro, 'error');
            render();
            return;
          }
          window.toast('Erro ao criar pedido: ' + (pedidoRes.error && pedidoRes.error.message
            ? pedidoRes.error.message
            : 'desconhecido'), 'error');
          console.error(pedidoRes.error);
          return;
        }

        var pedidoId = pedidoRes.data.id;
        var itensPayload = state.itens.map(function (item, index) {
          return {
            pedido_id: pedidoId,
            modelo_id: Number(item.modeloId),
            metros: Number(item.metros),
            ordem: index,
            observacao: item.observacao || null
          };
        });

        var itensRes = await window.supa
          .from('pedido_itens')
          .insert(itensPayload)
          .select('id, ordem');

        if (itensRes.error) {
          console.error('Erro ao inserir itens, compensando:', itensRes.error);
          var delRes = await window.supa.from('pedidos').delete().eq('id', pedidoId);
          if (delRes.error) {
            window.toast(
              'Erro grave: pedido #' + pedidoRes.data.numero + ' criado sem itens e nao compensado. Contate suporte.',
              'error'
            );
            console.error('Compensacao falhou:', delRes.error);
          } else {
            window.toast('Erro ao inserir itens. Pedido cancelado. Tente novamente.', 'error');
          }
          return;
        }

        if (window.RAVATEX_PEDIDO_PRIORITY && !(await window.RAVATEX_PEDIDO_PRIORITY.persistirNaCriacao(state, pedidoId, itensRes.data, pedidoRes.data.numero))) return;
        postSave = {
          pedido: pedidoRes.data,
          resumo: {
            clienteNome: clienteNomeById(state.clienteId),
            itemCount: state.itens.length,
            totalMetrosLabel: totalMetrosStr(),
          },
        };
        window.toast('Pedido #' + pedidoRes.data.numero + ' salvo como ' + status + '.', 'success');
        render();
      } finally {
        btn.disabled = false;
        btn.textContent = oldLabel;
      }
    }

    function buildLoadingCard() {
      return window.el('div', {
        style: 'background:var(--rv-surface); border:1px solid var(--rv-border); border-radius:var(--rv-radius); box-shadow:var(--rv-shadow-none); padding:24px; color:var(--rv-text-secondary);'
      }, 'Carregando dados do formulario...');
    }

    function buildErrorCard() {
      return window.el('div', {
        style: 'background:var(--rv-surface); border:1px solid var(--rv-border); border-radius:var(--rv-radius); box-shadow:var(--rv-shadow-none); padding:24px; color:var(--rv-signal-negative);'
      }, 'Erro ao carregar dados de ' + loadingError + '. Tente recarregar a pagina.');
    }

    function render() {
      var saveBtn = window.el('button', {
        type: 'button',
        style: 'background:var(--rv-brand); color:var(--rv-text-on-brand); border:none; border-radius:var(--rv-radius); height:var(--rv-h-primary); padding:0; width:100%; display:inline-flex; align-items:center; justify-content:center; font-weight:700; font-size:var(--rv-fs-body); font-family:inherit; cursor:pointer;',
        onclick: function () { salvar(saveBtn, 'rascunho'); }
      }, 'Salvar rascunho');

      if (isLoading) {
        container.replaceChildren(buildHeader(), buildLoadingCard());
        return;
      }

      if (loadingError) {
        container.replaceChildren(buildHeader(), buildErrorCard());
        return;
      }

      if (postSave) {
        container.replaceChildren(
          buildHeader(),
          buildPostSaveResumo()
        );
        return;
      }

      container.replaceChildren(
        buildHeader(),
        buildDadosGeraisCard(),
        buildItensCard(),
        buildBottomSection(saveBtn)
      );
    }

    render();
    carregarDados()
      .catch(function (error) {
        loadingError = loadingError || 'dados';
        console.error('pedido-form: erro inesperado ao carregar dados', error);
      })
      .finally(function () {
        isLoading = false;
        render();
      });

    return window.shellLayout(window.ADMIN_MENU, container);
  }

  window.RAVATEX_SCREENS = window.RAVATEX_SCREENS || {};
  window.RAVATEX_SCREENS.pedidoForm = {
    screenPedidoNovo: screenPedidoNovo
  };

  window.screenPedidoNovo = screenPedidoNovo;
})(window);
