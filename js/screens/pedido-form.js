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
//     linha. O modal foi REMOVIDO — nao existem dois editores concorrentes;
//   - a linha e a regra Tipo-antes-de-Modelo pertencem a
//     js/screens/pedido-item-row-editor.js. Este arquivo caiu de 1089 para
//     ~700 linhas com a extracao, e o debito estrutural de BATCH-01 esta
//     QUITADO (CODE_HEALTH_RULES.md sec.7);
//   - `modelos.tipo_produto` agora FALHA FECHADA: sem o metadado a tela nao
//     oferece modelo algum, em vez de degradar tudo para Tapete.
//   O payload de `pedido_itens` permanece semanticamente inalterado: o tipo
//   NAO e persistido, continua sendo fato de `modelos.tipo_produto`.
// =====================================================================

(function (window) {
  'use strict';

  function novoUid() {
    return 'i_' + Math.random().toString(36).slice(2, 10);
  }

  function svgEl(markup) {
    var tmp = document.createElement('div');
    tmp.innerHTML = markup;
    return tmp.firstElementChild;
  }

  var SVG_BACK = '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#3f4757" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>';
  var SVG_PLUS = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>';
  var SVG_CALENDAR = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9aa2af" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="8" y1="3" x2="8" y2="6"></line><line x1="16" y1="3" x2="16" y2="6"></line></svg>';
  var SVG_CHEVRON = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9aa2af" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>';

  // Dono UNICO da linha de item e da regra Tipo-antes-de-Modelo.
  function itemRowApi() {
    return window.RAVATEX_PEDIDO_ITEM_ROW || null;
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
      itens: [
        { uid: novoUid(), tipo: '', modeloId: '', metros: '', observacao: '' }
      ]
    };
    var postSave = null;
    var numeroErro = null;





    function totalMetros() {
      var total = 0;
      for (var i = 0; i < state.itens.length; i++) {
        var value = parseFloat(state.itens[i].metros);
        if (Number.isFinite(value) && value > 0) total += value;
      }
      return total;
    }

    function totalMetrosStr() {
      var total = totalMetros();
      return total > 0
        ? total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' m'
        : '0,00 m';
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
          style: 'width:36px; height:36px; border:1px solid #e2e5ea; border-radius:4px; display:flex; align-items:center; justify-content:center; flex-shrink:0; cursor:pointer;',
          onclick: function () { window.navigate('#/pedidos'); }
        }, svgEl(SVG_BACK)),
        window.el('div', {},
          window.el('h1', {
            style: 'margin:0; font-size:23px; font-weight:800; color:#16203a; letter-spacing:-.01em;'
          }, 'Novo pedido'),
          window.el('div', {
            style: 'font-size:13.5px; color:#8a93a3; margin-top:4px; max-width:760px;'
          }, 'Preencha os itens do pedido. Após o salvamento, ele ficará como Rascunho.')
        )
      ),
      window.el('button', {
        type: 'button',
        style: 'background:#fff; color:#3f4757; border:1px solid #d8dce2; border-radius:4px; padding:8px 18px; font-weight:600; font-size:14px; cursor:pointer; white-space:nowrap;',
        onclick: function () { window.navigate('#/pedidos'); }
      }, 'Cancelar'));
    }

    function buildFieldLabel(text, required) {
      var children = [text];
      if (required) {
        children.push(' ');
        children.push(window.el('span', { style: 'color:#d6403a;' }, '*'));
      }
      return window.el('label', {
        style: 'display:block; font-size:13px; color:#5b6472; margin-bottom:6px;'
      }, children);
    }

    function buildSelectBox(selectEl) {
      return window.el('div', {
        style: 'display:flex; align-items:center; gap:8px; border:1px solid #d8dce2; border-radius:4px; padding:9px 12px; background:#fff;'
      }, selectEl, svgEl(SVG_CHEVRON));
    }

    function buildDadosGeraisCard() {
      var clienteSelect = window.el('select', {
        style: 'flex:1; border:none; outline:none; font-size:14px; color:#16203a; background:transparent; font-family:inherit; cursor:pointer; -webkit-appearance:none; appearance:none; min-width:0;'
      }, window.el('option', { value: '' }, 'Selecione o cliente...'));
      for (var i = 0; i < clientes.length; i++) {
        var option = window.el('option', { value: clientes[i].id }, clientes[i].nome);
        if (String(clientes[i].id) === String(state.clienteId)) option.selected = true;
        clienteSelect.appendChild(option);
      }
      clienteSelect.addEventListener('change', function () {
        state.clienteId = clienteSelect.value;
      });

      // Numero do pedido: campo ADMIN, apenas na criacao, OPCIONAL.
      // Em branco => numeracao automatica. A checagem de disponibilidade que
      // fazemos aqui e apenas consultiva: a autoridade e o UNIQUE do banco.
      var numeroInput = window.el('input', {
        type: 'number',
        min: '1',
        step: '1',
        value: state.numero,
        placeholder: 'Automático',
        'data-pedido-numero': '1',
        style: 'flex:1; border:none; outline:none; font-size:14px; color:#16203a; background:transparent; font-family:inherit; min-width:0;'
      });
      numeroInput.addEventListener('input', function () {
        state.numero = numeroInput.value;
        numeroErro = null;
        numeroMsg.textContent = '';
      });
      var numeroMsg = window.el('div', {
        'data-pedido-numero-erro': '1',
        style: 'font-size:12.5px; color:#d6403a; margin-top:5px; min-height:16px;'
      }, numeroErro || '');
      var numeroWrap = window.el('div', {
        style: 'display:flex; align-items:center; gap:8px; border:1px solid ' + (numeroErro ? '#d6403a' : '#d8dce2') + '; border-radius:4px; padding:9px 12px; background:#fff;'
      }, numeroInput);

      // Data do pedido: data COMERCIAL, obrigatoria, default hoje (local).
      // Persiste em pedidos.data_pedido; nunca derivada de criado_em.
      var dataPedidoInput = window.el('input', {
        type: 'date',
        value: state.dataPedido,
        'data-pedido-data': '1',
        style: 'flex:1; border:none; outline:none; font-size:14px; color:#16203a; background:transparent; font-family:inherit; min-width:0;'
      });
      dataPedidoInput.addEventListener('change', function () {
        state.dataPedido = dataPedidoInput.value;
      });
      var dataPedidoWrap = window.el('div', {
        style: 'display:flex; align-items:center; gap:8px; border:1px solid #d8dce2; border-radius:4px; padding:9px 12px; background:#fff;'
      }, dataPedidoInput, svgEl(SVG_CALENDAR));

      var prazoInput = window.el('input', {
        type: 'date',
        value: state.prazoEntrega,
        'data-pedido-prazo': '1',
        style: 'flex:1; border:none; outline:none; font-size:14px; color:#16203a; background:transparent; font-family:inherit; min-width:0;'
      });
      prazoInput.addEventListener('change', function () {
        state.prazoEntrega = prazoInput.value;
      });
      var prazoWrap = window.el('div', {
        style: 'display:flex; align-items:center; gap:8px; border:1px solid #d8dce2; border-radius:4px; padding:9px 12px; background:#fff;'
      }, prazoInput, svgEl(SVG_CALENDAR));

      var statusSelect = window.el('select', {
        disabled: 'disabled',
        style: 'flex:1; border:none; outline:none; font-size:14px; color:#16203a; background:transparent; font-family:inherit; cursor:default; -webkit-appearance:none; appearance:none; min-width:0; opacity:1;'
      }, window.el('option', { value: 'rascunho', selected: 'selected' }, 'Rascunho'));

      return window.el('div', {
        style: 'background:#fff; border:1px solid #eceef1; border-radius:4px; box-shadow:0 1px 2px rgba(20,30,45,.04); padding:16px 20px; margin-bottom:14px;'
      },
      window.el('div', { style: 'font-size:16px; font-weight:700; color:#16203a; margin-bottom:12px;' }, 'Dados gerais'),
      // Ordem visual exigida: Numero do pedido -> Data do pedido -> Prazo desejado.
      window.el('div', {
        'data-pedido-header-grid': '1',
        style: 'display:grid; grid-template-columns:1fr 1fr; gap:20px; margin-bottom:16px;'
      },
      window.el('div', { style: 'min-width:0;' },
        buildFieldLabel('Cliente', true),
        buildSelectBox(clienteSelect)
      ),
      window.el('div', { style: 'min-width:0;' },
        buildFieldLabel('Número do pedido'),
        numeroWrap,
        numeroMsg
      )),
      window.el('div', {
        style: 'display:grid; grid-template-columns:1fr 1fr 1fr; gap:20px;'
      },
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
        buildSelectBox(statusSelect)
      )));
    }

    function buildItensCard() {
      var api = itemRowApi();
      var rowsWrap = window.el('div', {});
      for (var i = 0; i < state.itens.length; i++) {
        rowsWrap.appendChild(api.buildRow({
          item: state.itens[i],
          modelos: modelos,
          typeMetadata: tipoMetadataOk,
          onChange: updateItensSummary,
          onRemove: function (target) {
            state.itens = state.itens.filter(function (current) { return current.uid !== target.uid; });
            render();
          }
        }));
      }

      // "Adicionar item" acrescenta uma LINHA EDITAVEL na tela; nao existe
      // mais um modal dono do item.
      var addBtn = window.el('button', {
        type: 'button',
        style: 'display:inline-flex; align-items:center; gap:8px; background:#fff; color:#2563eb; border:1px solid #2563eb; border-radius:4px; padding:7px 13px; font-weight:600; font-size:13.5px; font-family:inherit; cursor:pointer; white-space:nowrap;',
        onclick: function () {
          state.itens.push({ uid: novoUid(), tipo: '', modeloId: '', metros: '', observacao: '' });
          render();
        }
      }, svgEl(SVG_PLUS), 'Adicionar item');

      var table = window.el('div', {
        style: 'border:1px solid #eceef1; border-radius:4px; overflow:hidden;'
      },
      window.el('div', { style: 'overflow-x:auto;' },
        api.buildHeader(),
        rowsWrap
      ),
      window.el('div', {
        style: 'display:flex; align-items:center; justify-content:space-between; gap:16px; padding:10px 18px; background:#f8f9fb; flex-wrap:wrap;'
      },
      window.el('span', { style: 'font-size:13.5px; color:#5b6472;' },
        'Total de itens: ',
        window.el('strong', {
          style: 'color:#16203a; font-weight:700;',
          'data-pedido-total-itens': '1'
        }, String(state.itens.length))
      ),
      window.el('span', { style: 'font-size:13.5px; color:#5b6472;' },
        'Metragem total: ',
        window.el('strong', {
          style: 'color:#16203a; font-weight:700;',
          'data-pedido-total-metros': '1'
        }, totalMetrosStr())
      )));

      return window.el('div', {
        style: 'background:#fff; border:1px solid #eceef1; border-radius:4px; box-shadow:0 1px 2px rgba(20,30,45,.04); padding:16px 20px; margin-bottom:14px;'
      },
      window.el('div', {
        style: 'display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:12px; flex-wrap:wrap;'
      },
      window.el('div', { style: 'font-size:16px; font-weight:700; color:#16203a;' }, 'Itens do pedido'),
      addBtn),
      table);
    }

    function buildBottomSection(saveBtn) {
      function syncTextareaHeight(textarea) {
        textarea.style.height = 'auto';
        textarea.style.height = Math.max(textarea.scrollHeight, 40) + 'px';
      }

      var obsTextarea = window.el('textarea', {
        rows: 1,
        placeholder: 'Informações adicionais sobre conferência, prazo ou observações internas...',
        style: 'width:100%; min-height:40px; border:1px solid #d8dce2; border-radius:4px; padding:9px 12px; font-size:14px; color:#16203a; background:#fff; font-family:inherit; outline:none; resize:none; line-height:1.5; box-sizing:border-box; overflow-y:hidden;'
      });
      obsTextarea.value = state.observacao;
      obsTextarea.addEventListener('input', function () {
        state.observacao = obsTextarea.value;
        syncTextareaHeight(obsTextarea);
      });

      var instrCard = window.el('div', {
        style: 'background:#fff; border:1px solid #eceef1; border-radius:4px; box-shadow:0 1px 2px rgba(20,30,45,.04); padding:16px 20px;'
      },
      window.el('div', { style: 'font-size:16px; font-weight:700; color:#16203a; margin-bottom:10px;' }, 'Instruções gerais'),
      obsTextarea);

      window.requestAnimationFrame(function () {
        syncTextareaHeight(obsTextarea);
      });

      var checkoutCard = window.el('div', {
        style: 'background:#fff; border:1px solid #eceef1; border-radius:4px; box-shadow:0 1px 2px rgba(20,30,45,.04); padding:16px 20px; display:flex; flex-direction:column; justify-content:center;'
      },
      window.el('div', { style: 'font-size:16px; font-weight:700; color:#16203a;' }, 'Salvar rascunho'),
      window.el('div', {
        style: 'font-size:13px; color:#8a93a3; line-height:1.5; margin-top:10px; margin-bottom:14px;',
        'data-pedido-checkout-summary': '1'
      },
        'Resumo: ' + String(state.itens.length) + ' item(ns) | ' + totalMetrosStr()
      ),
      saveBtn);

      return window.el('div', {
        style: 'display:grid; grid-template-columns:3fr 1fr; gap:14px; align-items:stretch;'
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
        style: 'background:#fff;border:1px solid #d7e6fb;border-radius:4px;box-shadow:0 1px 2px rgba(20,30,45,.04);padding:18px 20px;margin-bottom:14px;',
        'data-post-save-summary': 'admin',
      },
        window.el('div', {
          style: 'display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:14px;',
        },
          window.el('div', { style: 'min-width:240px;' },
            window.el('div', { style: 'font-size:18px;font-weight:800;color:#16203a;margin-bottom:5px;' }, 'Pedido salvo com sucesso'),
            window.el('div', { style: 'font-size:13px;color:#5b6472;line-height:1.5;' },
              'O pedido foi salvo. Abra a OP de tecelagem quando estiver pronto para iniciar a producao.')
          )
        ),
        window.el('div', {
          style: 'display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-bottom:16px;',
        }, fields.map(function (field) {
          return window.el('div', {
            style: 'background:#f8f9fb;border:1px solid #eceef1;border-radius:4px;padding:10px 12px;',
          },
            window.el('div', { style: 'font-size:11.5px;color:#8a93a3;font-weight:600;margin-bottom:5px;' }, field.label),
            window.el('div', { style: 'font-size:14px;color:#16203a;font-weight:700;' }, field.value)
          );
        })),
        window.el('div', {
          style: 'display:flex;align-items:center;justify-content:flex-end;gap:10px;flex-wrap:wrap;',
          'data-post-save-actions': 'right',
        },
          window.el('button', {
            type: 'button',
            style: 'background:#fff;color:#3f4757;border:1px solid #d8dce2;border-radius:4px;padding:9px 14px;font-weight:600;font-size:13.5px;font-family:inherit;cursor:pointer;',
            onclick: function () { window.navigate('#/pedidos/' + pedido.id); },
          }, 'Ver pedido'),
          window.el('button', {
            type: 'button',
            style: 'background:#fff;color:#3f4757;border:1px solid #d8dce2;border-radius:4px;padding:9px 14px;font-weight:600;font-size:13.5px;font-family:inherit;cursor:pointer;',
            onclick: function () { window.navigate('#/pedidos/novo'); },
          }, 'Novo pedido'),
          window.el('button', {
            type: 'button',
            style: 'background:#2563eb;color:#fff;border:none;border-radius:4px;padding:9px 16px;font-weight:700;font-size:13.5px;font-family:inherit;cursor:pointer;',
            onclick: function () { window.location.hash = '#/ops/nova?pedido_id=' + pedido.id; },
          }, 'Abrir OP de Tecelagem')
        )
      );
    }

    // Um numero manual ocupado chega como violacao de unicidade (23505) da
    // constraint pedidos_numero_key. Detectar deterministicamente evita
    // confundir esse caso com qualquer outra falha de insercao.
    function isNumeroDuplicado(error) {
      if (!error) return false;
      if (String(error.code) === '23505') return true;
      var texto = String(error.message || '') + ' ' + String(error.details || '');
      return /pedidos_numero_key/i.test(texto);
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
      // Numero e OPCIONAL; quando informado tem de ser inteiro positivo.
      var numeroManual = null;
      if (String(state.numero).trim() !== '') {
        numeroManual = Number(state.numero);
        if (!Number.isInteger(numeroManual) || numeroManual <= 0) {
          window.toast('Número do pedido deve ser um inteiro positivo.', 'error');
          return;
        }
      }
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
        if (numeroManual !== null) pedidoPayload.numero = numeroManual;
        if (state.prazoEntrega) pedidoPayload.prazo_entrega = state.prazoEntrega;
        if (state.observacao) pedidoPayload.observacao = state.observacao;

        var pedidoRes = await window.supa
          .from('pedidos')
          .insert(pedidoPayload)
          .select('id, numero, status, data_pedido')
          .single();

        if (pedidoRes.error || !pedidoRes.data) {
          // Numero manual ja em uso: o UNIQUE do banco e a autoridade. O valor
          // digitado NUNCA e trocado silenciosamente por um automatico.
          if (numeroManual !== null && isNumeroDuplicado(pedidoRes.error)) {
            numeroErro = 'Este número de pedido já está em uso.';
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
          .select('id');

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
        style: 'background:#fff; border:1px solid #eceef1; border-radius:4px; box-shadow:0 1px 2px rgba(20,30,45,.04); padding:24px; color:#5b6472;'
      }, 'Carregando dados do formulario...');
    }

    function buildErrorCard() {
      return window.el('div', {
        style: 'background:#fff; border:1px solid #eceef1; border-radius:4px; box-shadow:0 1px 2px rgba(20,30,45,.04); padding:24px; color:#d6403a;'
      }, 'Erro ao carregar dados de ' + loadingError + '. Tente recarregar a pagina.');
    }

    function render() {
      var saveBtn = window.el('button', {
        type: 'button',
        style: 'background:#2563eb; color:#fff; border:none; border-radius:4px; padding:10px 0; width:100%; font-weight:700; font-size:14px; font-family:inherit; cursor:pointer;',
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
