// =====================================================================
// === SCREENS: TECELAGEM V1 — primeira fatia vertical ==================
//
// Superfície operacional do fornecedor de TECELAGEM. Três telas:
//
//   MINHAS OPs -> ABRIR OP -> INICIAR PRODUÇÃO -> REGISTRAR PRODUÇÃO
//                                              -> VER ROLOS
//
// INICIAR PRODUÇÃO É LOCAL A ESTA SUPERFÍCIE (regra de produto ratificada)
// Iniciar a produção aqui grava UM fato operacional desta superfície — «esta
// OP foi iniciada pelo operador da tecelagem» — e NADA no Admin. Não é a
// transição autoritativa do ciclo de vida administrativo: ops.status não é
// escrito, public.iniciar_producao_op não é chamada, e a integração com o
// Admin é fase posterior. O registro de rolos fica indisponível até esse
// início, e essa recusa mora no SERVIDOR (db/123), não neste arquivo.
//
//   - screenTecelagemOps     '#/tecelagem/ops'
//   - screenTecelagemOp      '#/tecelagem/ops/<opId>'
//   - screenTecelagemRolos   '#/tecelagem/ops/<opId>/produtos/<opItemId>/rolos'
//
// ISOLAMENTO (restrição vinculante desta fase)
// Esta superfície LÊ a OP e o produto definidos pela Ravatex e ESCREVE apenas
// o próprio estado operacional de tecelagem. A leitura passa pelas políticas
// SELECT que já existem para o fornecedor (db/03); a escrita passa por UM
// único dono, public.registrar_producao_tecelagem (db/123). Nenhuma tela
// daqui grava em tabela do Admin, nem direta nem indiretamente.
//
// DADO DA RAVATEX É SOMENTE LEITURA — e isso é garantido no SERVIDOR, não
// aqui: o fornecedor não tem grant de escrita em ops, op_itens nem modelos.
// A ausência de controle de edição nesta tela é consequência, não a defesa.
//
// O ESTADO EXIBIDO É O OPERACIONAL DA TECELAGEM, não o ciclo de vida do
// Admin. Nesta fase os dois são fatos distintos e mostrá-los lado a lado só
// produziria contradição visível ("Aberta" + "Produção iniciada"). O que o
// operador precisa saber é o que ele pode fazer agora.
//
// Dependências resolvidas em tempo de chamada (não no load):
//   - window.el, window.pageHeader, window.modal, window.toast,
//     window.textInput, window.formField                     (js/ui.js)
//   - window.RV_BADGES.rvStatusPill                          (js/badges.js)
//   - window.RAVATEX_OP_DISPLAY.formatOpOperationalCode      (js/op-display.js)
//   - window.shellLayout                                     (js/screens/common.js)
//   - window.supa                                            (js/supabase-client.js)
//   - window.CURRENT_USER                                    (js/auth.js)
// =====================================================================

(function (window) {
  'use strict';

  // -------------------------------------------------------------------
  // Ícones Lucide (stroke 1.8–2, sem preenchimento, sem emoji) — §7.
  var ICON_LAYERS = '<path d="M12 2 2 7l10 5 10-5-10-5Z"></path><path d="m2 17 10 5 10-5"></path><path d="m2 12 10 5 10-5"></path>';
  var ICON_BOX = '<path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"></path><path d="m3.3 7 8.7 5 8.7-5"></path><path d="M12 22V12"></path>';
  var ICON_LIST = '<line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line>';

  function icon(markup, size) {
    var svg = window.el('span', {});
    svg.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="' + size + '" height="' + size
      + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"'
      + ' stroke-linecap="round" stroke-linejoin="round">' + markup + '</svg>';
    return svg.firstChild;
  }

  // Menu lateral da superfície de tecelagem.
  function menu() {
    return [{ href: '#/tecelagem/ops', label: 'Minhas OPs' }];
  }

  // Card canônico (§2.4): superfície, borda simples, raio do token, PLANO.
  function card() {
    var children = Array.prototype.slice.call(arguments);
    return window.el('div', {
      style: 'background:var(--rv-surface); border:1px solid var(--rv-border);'
        + ' border-radius:var(--rv-radius); padding:var(--rv-pad-card);'
        + ' box-shadow:var(--rv-shadow-none);',
    }, ...children);
  }

  // Cabeçalho de seção (§2.4): chip de 20px + rótulo caixa-alta.
  function sectionChip(label, iconMarkup) {
    return window.el('div', { style: 'display:flex; align-items:center; gap:8px; margin-bottom:11px;' },
      window.el('span', {
        style: 'width:20px; height:20px; display:inline-flex; align-items:center; justify-content:center;'
          + ' border-radius:var(--rv-radius); background:var(--rv-chip-bg);'
          + ' color:var(--rv-chip-glyph); flex:none;',
      }, icon(iconMarkup, 13)),
      window.el('span', {
        style: 'font-size:var(--rv-fs-label); font-weight:700; text-transform:uppercase;'
          + ' letter-spacing:.02em; color:var(--rv-text-tertiary);',
      }, label)
    );
  }

  // Rodapé de ações do card (§2.1): SEMPRE à direita, com divisor superior.
  function cardFooter() {
    var children = Array.prototype.slice.call(arguments);
    return window.el('div', {
      style: 'display:flex; justify-content:flex-end; gap:8px; margin-top:13px;'
        + ' border-top:1px solid var(--rv-border-soft); padding-top:11px;',
    }, ...children);
  }

  function primaryButton(label, onclick, disabled) {
    var attrs = {
      style: 'border-radius:var(--rv-radius); font-size:var(--rv-fs-body); font-weight:600;'
        + ' height:var(--rv-h-primary); padding:0 16px; display:inline-flex;'
        + ' align-items:center; justify-content:center; border:none;'
        + ' background:var(--rv-brand); color:var(--rv-text-on-brand);'
        + (disabled ? ' opacity:.45; cursor:default;' : ' cursor:pointer;'),
      onclick: disabled ? null : onclick,
    };
    // §2.1: a chave `disabled` entra no objeto SOMENTE quando a condição é
    // verdadeira, e com valor TRUTHY — el() trata `disabled` como atributo
    // booleano e um valor falsy (por exemplo '') o REMOVE, deixando o botão
    // acionável.
    if (disabled) attrs.disabled = true;
    return window.el('button', attrs, label);
  }

  function secondaryButton(label, onclick) {
    return window.el('button', {
      style: 'border-radius:var(--rv-radius); font-size:var(--rv-fs-body); font-weight:600;'
        + ' height:var(--rv-h-default); padding:0 14px; display:inline-flex;'
        + ' align-items:center; justify-content:center; cursor:pointer;'
        + ' background:var(--rv-surface); border:1px solid var(--rv-border-strong);'
        + ' color:var(--rv-text-secondary);',
      onclick: onclick,
    }, label);
  }

  function emptyText(message) {
    return window.el('p', {
      style: 'font-size:var(--rv-fs-sm); color:var(--rv-text-tertiary); margin:0;',
    }, message);
  }

  // -------------------------------------------------------------------
  // Formatação pt-BR: vírgula decimal, unidade explícita, .tnum (§7).
  function fmtMetros(value) {
    var n = Number(value);
    if (!isFinite(n)) return '—';
    return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' m';
  }

  function fmtLargura(value) {
    var n = Number(value);
    if (!isFinite(n)) return '—';
    return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' m';
  }

  function fmtRolo(numero) {
    var n = Number(numero);
    if (!isFinite(n)) return '—';
    return String(n).padStart(3, '0');
  }

  function num(node) {
    node.className = 'tnum';
    return node;
  }

  // Rótulo do produto: NOITE · 2,10 m · KRAFT/CRU
  function rotuloProduto(modelo) {
    if (!modelo) return 'Produto não identificado';
    var cor1 = modelo.cor_1 && modelo.cor_1.nome ? modelo.cor_1.nome : null;
    var cor2 = modelo.cor_2 && modelo.cor_2.nome ? modelo.cor_2.nome : null;
    var cores = (cor1 && cor2) ? (cor1 + '/' + cor2) : (cor1 || cor2 || null);
    var partes = [modelo.nome, fmtLargura(modelo.largura)];
    if (cores) partes.push(cores);
    return partes.join(' · ');
  }

  function fmtData(valor) {
    if (!valor) return null;
    var d = new Date(valor);
    if (isNaN(d.getTime())) return null;
    return d.toLocaleDateString('pt-BR');
  }

  // Motivos estáveis devolvidos por _tecelagem_op_pode_iniciar (db/123), que
  // por sua vez encaminha os de _pedido_permite_op_tecelagem (db/121).
  // Um código desconhecido nunca é escondido nem traduzido em suposição.
  var MOTIVO = {
    PEDIDO_NAO_CONFIRMADO:   'o pedido ainda não foi confirmado',
    PEDIDO_CANCELADO:        'o pedido foi cancelado',
    PEDIDO_NAO_ENCONTRADO:   'o pedido não foi localizado',
    OP_TECELAGEM_SEM_PEDIDO: 'a OP ainda não está ligada a um pedido',
    OP_AINDA_NAO_ABERTA:     'a OP ainda não foi aberta',
    OP_ENCERRADA:            'a OP já foi encerrada',
    OP_TECELAGEM_INEXISTENTE:'a OP não está mais disponível',
  };

  // O estado da execução mapeado para um estado de ciclo de vida JÁ regrado em
  // js/badges.js. A tela não declara família nem cor: escolhe o significado e
  // o dono canônico decide como ele se parece.
  var ESTADO_CANONICO = {
    em_producao: 'em_producao',
    pode_iniciar: 'aberta',
    encerrada: 'finalizada',
  };

  // O que o operador pode fazer com esta OP AGORA — derivado do read model,
  // nunca recalculado aqui. `podeIniciar` e `podeRegistrar` são as duas únicas
  // portas de ação, e são mutuamente exclusivas por construção do read model.
  function execucao(op) {
    var s = op && op.situacao_execucao;

    if (s === 'em_producao') {
      var data = fmtData(op && op.producao_iniciada_em);
      return {
        podeIniciar: false,
        podeRegistrar: true,
        pill: 'Produção iniciada',
        rotulo: data
          ? ('Produção iniciada em ' + data + '. O registro de rolos está liberado.')
          : 'Produção iniciada. O registro de rolos está liberado.',
      };
    }

    if (s === 'pode_iniciar') {
      return {
        podeIniciar: true,
        podeRegistrar: false,
        pill: 'Pronta para iniciar',
        rotulo: 'Pronta para iniciar produção. Inicie a produção para registrar rolos.',
      };
    }

    if (s === 'encerrada') {
      return {
        podeIniciar: false,
        podeRegistrar: false,
        pill: 'Encerrada',
        rotulo: 'OP encerrada. Os rolos permanecem visíveis para consulta.',
      };
    }

    var motivo = MOTIVO[op && op.motivo_bloqueio] || null;
    return {
      podeIniciar: false,
      podeRegistrar: false,
      pill: 'Não liberada',
      rotulo: motivo
        ? ('Ainda não liberada: ' + motivo + '.')
        : 'Ainda não liberada para produção.',
    };
  }

  // A pílula carrega o estado OPERACIONAL da tecelagem — o mesmo que a linha
  // de texto declara por extenso logo abaixo.
  function execucaoPill(op) {
    var e = execucao(op);
    return window.RV_BADGES.rvStatusPill(
      e.pill, ESTADO_CANONICO[op && op.situacao_execucao] || 'bloqueada');
  }

  // Linha de execução: o estado NUNCA é comunicado só pela cor da pílula.
  function linhaExecucao(op) {
    return window.el('div', {
      style: 'font-size:var(--rv-fs-sm); color:var(--rv-text-secondary); margin-top:6px;',
    }, execucao(op).rotulo);
  }

  // Cliente — informação definida pela Ravatex, somente leitura.
  function linhaCliente(op) {
    var nome = op && op.cliente_nome ? String(op.cliente_nome).trim() : '';
    return window.el('div', { style: 'margin-top:5px;' },
      window.el('span', {
        style: 'font-size:var(--rv-fs-sm); color:var(--rv-text-tertiary);',
      }, 'Cliente: '),
      window.el('span', {
        style: 'font-size:var(--rv-fs-sm); color:var(--rv-text-primary); font-weight:600;',
      }, nome || 'não informado')
    );
  }

  function guardaFornecedor(container, titulo) {
    if (window.CURRENT_USER && window.CURRENT_USER.fornecedor_id) return false;
    container.replaceChildren(
      window.pageHeader(titulo),
      card(emptyText('Seu usuário não está vinculado a um fornecedor. Fale com o administrador.'))
    );
    return true;
  }

  // -------------------------------------------------------------------
  // Leituras. Todas passam pelas políticas SELECT do fornecedor: uma OP que
  // não é deste fornecedor simplesmente não retorna linha.
  // -------------------------------------------------------------------

  // A lista de trabalho da tecelagem. Vem inteira do dono do read model, que
  // já resolve o CLIENTE e a elegibilidade de execução a partir do ciclo de
  // vida existente. A tela não recalcula nem reinterpreta nenhum dos dois.
  async function carregarOps() {
    var res = await window.supa.rpc('tecelagem_minhas_ops');
    if (res.error) throw res.error;
    return res.data || [];
  }

  async function carregarOp(opId) {
    var ops = await carregarOps();
    return ops.filter(function (o) { return String(o.op_id) === String(opId); })[0] || null;
  }

  // Produtos da OP + o modelo que os descreve. Dado definido pela Ravatex.
  async function carregarProdutos(opId) {
    var itensRes = await window.supa.from('op_itens')
      .select('id, op_id, modelo_id, metros_pedidos, metros_ajustados')
      .eq('op_id', opId)
      .order('id');
    if (itensRes.error) throw itensRes.error;
    var itens = itensRes.data || [];
    if (!itens.length) return [];

    var modeloIds = Array.from(new Set(itens.map(function (i) { return i.modelo_id; })));
    var modelosRes = await window.supa.from('modelos')
      .select('id, nome, largura, cor_1:cor_1_id(id,nome), cor_2:cor_2_id(id,nome)')
      .in('id', modeloIds);
    if (modelosRes.error) throw modelosRes.error;

    var porId = {};
    (modelosRes.data || []).forEach(function (m) { porId[m.id] = m; });
    itens.forEach(function (i) { i.modelo = porId[i.modelo_id] || null; });
    return itens;
  }

  // Rolos já registrados, por produto. RLS garante que só vêm os deste
  // fornecedor.
  async function carregarRolos(opItemIds) {
    if (!opItemIds.length) return {};
    var res = await window.supa.from('tecelagem_rolos')
      .select('id, op_id, op_item_id, numero, comprimento_m, situacao, criado_em')
      .in('op_item_id', opItemIds)
      .order('numero');
    if (res.error) throw res.error;
    var porItem = {};
    (res.data || []).forEach(function (r) {
      (porItem[r.op_item_id] = porItem[r.op_item_id] || []).push(r);
    });
    return porItem;
  }

  // -------------------------------------------------------------------
  // TELA 1 — MINHAS OPs
  // -------------------------------------------------------------------
  function screenTecelagemOps() {
    var container = window.el('div', {});

    async function reload() {
      if (guardaFornecedor(container, 'Minhas OPs')) return;

      var ops;
      try {
        ops = await carregarOps();
      } catch (e) {
        console.error(e);
        container.replaceChildren(window.pageHeader('Minhas OPs'),
          card(emptyText('Não foi possível carregar suas OPs agora. Tente novamente.')));
        return;
      }

      var corpo = window.el('div', { style: 'display:flex; flex-direction:column; gap:12px;' });

      if (!ops.length) {
        corpo.appendChild(card(emptyText('Nenhuma OP em produção atribuída a você no momento.')));
      } else {
        ops.forEach(function (op) {
          var identidade = window.RAVATEX_OP_DISPLAY.formatOpOperationalCode(op);
          corpo.appendChild(card(
            window.el('div', {},
              window.el('div', {
                style: 'font-size:var(--rv-fs-section-heading); font-weight:700; color:var(--rv-text-primary);',
              }, identidade),
              linhaCliente(op),
              window.el('div', { style: 'margin-top:6px;' }, execucaoPill(op)),
              linhaExecucao(op)
            ),
            cardFooter(primaryButton('Abrir OP', function () {
              window.navigate('#/tecelagem/ops/' + op.op_id);
            }))
          ));
        });
      }

      container.replaceChildren(window.pageHeader('Minhas OPs'), corpo);
    }

    reload();
    return window.shellLayout(menu(), container);
  }

  // -------------------------------------------------------------------
  // TELA 2 — OP / PRODUÇÃO
  // O produto é a unidade operacional desta tela.
  // -------------------------------------------------------------------
  function screenTecelagemOp(opId) {
    var container = window.el('div', {});

    async function reload() {
      if (guardaFornecedor(container, 'OP')) return;

      var op, produtos, rolosPorItem;
      try {
        op = await carregarOp(opId);
        if (!op) {
          container.replaceChildren(
            window.pageHeader('OP'),
            card(emptyText('Esta OP não está disponível para o seu usuário.')),
            window.el('div', { style: 'margin-top:12px;' },
              secondaryButton('Voltar para Minhas OPs', function () { window.navigate('#/tecelagem/ops'); }))
          );
          return;
        }
        produtos = await carregarProdutos(opId);
        rolosPorItem = await carregarRolos(produtos.map(function (p) { return p.id; }));
      } catch (e) {
        console.error(e);
        container.replaceChildren(window.pageHeader('OP'),
          card(emptyText('Não foi possível carregar a OP agora. Tente novamente.')));
        return;
      }

      var identidade = window.RAVATEX_OP_DISPLAY.formatOpOperationalCode(op);

      var corpo = window.el('div', { style: 'display:flex; flex-direction:column; gap:12px;' });

      // Identidade da OP e CLIENTE — dado da Ravatex, somente leitura.
      // INICIAR PRODUÇÃO pertence à OP, não ao produto: o fato local que ela
      // grava é da OP inteira, e é o que libera o registro em todos os
      // produtos dela.
      var estado = execucao(op);
      var opCard = card(
        sectionChip('Ordem de produção', ICON_LAYERS),
        window.el('div', { style: 'display:flex; align-items:center; gap:10px; flex-wrap:wrap;' },
          window.el('span', {
            style: 'font-size:var(--rv-fs-section-heading); font-weight:700; color:var(--rv-text-primary);',
          }, identidade),
          execucaoPill(op)
        ),
        linhaCliente(op),
        linhaExecucao(op)
      );
      if (estado.podeIniciar) {
        var botaoIniciar = primaryButton('Iniciar produção', function () {
          iniciarProducao(op, botaoIniciar, reload);
        });
        opCard.appendChild(cardFooter(botaoIniciar));
      }
      corpo.appendChild(opCard);

      var podeRegistrar = estado.podeRegistrar;

      // Produtos.
      if (!produtos.length) {
        corpo.appendChild(card(
          sectionChip('Produtos', ICON_BOX),
          emptyText('Esta OP ainda não tem produtos cadastrados.')
        ));
      } else {
        produtos.forEach(function (produto) {
          var rolos = rolosPorItem[produto.id] || [];
          var previsto = produto.metros_ajustados != null ? produto.metros_ajustados : produto.metros_pedidos;

          corpo.appendChild(card(
            sectionChip('Produto', ICON_BOX),
            window.el('div', {
              style: 'font-size:var(--rv-fs-body); font-weight:600; color:var(--rv-text-primary);',
            }, rotuloProduto(produto.modelo)),
            window.el('div', {
              style: 'display:flex; gap:24px; flex-wrap:wrap; margin-top:11px;',
            },
              window.el('div', {},
                window.el('div', {
                  style: 'font-size:var(--rv-fs-label); font-weight:700; text-transform:uppercase;'
                    + ' letter-spacing:.02em; color:var(--rv-text-tertiary);',
                }, 'Previsto'),
                num(window.el('div', {
                  style: 'font-size:var(--rv-fs-body); color:var(--rv-text-primary); margin-top:3px;',
                }, fmtMetros(previsto)))
              ),
              window.el('div', {},
                window.el('div', {
                  style: 'font-size:var(--rv-fs-label); font-weight:700; text-transform:uppercase;'
                    + ' letter-spacing:.02em; color:var(--rv-text-tertiary);',
                }, 'Produzido'),
                num(window.el('div', {
                  style: 'font-size:var(--rv-fs-body); color:var(--rv-text-primary); margin-top:3px;',
                }, rolos.length === 1 ? '1 rolo' : rolos.length + ' rolos'))
              )
            ),
            cardFooter(
              secondaryButton('Ver rolos', function () {
                window.navigate('#/tecelagem/ops/' + op.op_id + '/produtos/' + produto.id + '/rolos');
              }),
              // A ação só fica acionável depois do INÍCIO LOCAL da produção
              // desta OP. A recusa de verdade é do servidor (db/123); aqui ela
              // é apenas antecipada para o operador ver o estado.
              primaryButton('Registrar produção', function () {
                abrirRegistro(produto, reload);
              }, !podeRegistrar)
            )
          ));
        });
      }

      corpo.appendChild(window.el('div', {},
        secondaryButton('Voltar para Minhas OPs', function () { window.navigate('#/tecelagem/ops'); })));

      container.replaceChildren(window.pageHeader('OP'), corpo);
    }

    reload();
    return window.shellLayout(menu(), container);
  }

  // -------------------------------------------------------------------
  // INICIAR PRODUÇÃO (local à tecelagem)
  //
  // Grava o fato operacional desta superfície e recarrega a tela a partir do
  // read model — o estado exibido depois do início é o que o SERVIDOR diz, não
  // uma suposição otimista do cliente.
  // -------------------------------------------------------------------
  async function iniciarProducao(op, botao, aoConcluir) {
    // Um segundo clique enquanto o primeiro está em voo não pode virar uma
    // segunda chamada. (O dono da escrita é idempotente, mas a tela não pode
    // depender disso para não confundir o operador.)
    if (botao) {
      if (botao.disabled) return;
      botao.disabled = true;
    }

    var res = await window.supa.rpc('iniciar_producao_tecelagem', { p_op_id: op.op_id });

    if (res.error) {
      console.error(res.error);
      if (botao) botao.disabled = false;
      window.toast(mensagemDeInicio(res.error), 'error');
      return;
    }

    window.toast('Produção iniciada.', 'success');
    if (typeof aoConcluir === 'function') aoConcluir();
  }

  // -------------------------------------------------------------------
  // REGISTRAR PRODUÇÃO
  // A quantidade de rolos é a entrada primária. O comprimento individual é
  // OPCIONAL: registrar sem informá-lo é um caminho normal, não uma exceção.
  // -------------------------------------------------------------------
  function abrirRegistro(produto, aoConcluir) {
    var inputQtd = window.textInput({ type: 'number', value: '', placeholder: 'Ex.: 10' });
    inputQtd.setAttribute('min', '1');
    inputQtd.setAttribute('step', '1');
    inputQtd.setAttribute('inputmode', 'numeric');

    var inputComprimento = window.textInput({ type: 'number', value: '', placeholder: 'Opcional' });
    inputComprimento.setAttribute('min', '0');
    inputComprimento.setAttribute('step', '0.01');
    inputComprimento.setAttribute('inputmode', 'decimal');

    window.modal({
      title: 'Registrar produção',
      saveLabel: 'Registrar produção',
      body: window.el('div', { style: 'display:flex; flex-direction:column; gap:12px;' },
        window.el('div', {},
          window.el('div', {
            style: 'font-size:var(--rv-fs-label); font-weight:700; text-transform:uppercase;'
              + ' letter-spacing:.02em; color:var(--rv-text-tertiary);',
          }, 'Produto'),
          window.el('div', {
            style: 'font-size:var(--rv-fs-body); font-weight:600; color:var(--rv-text-primary); margin-top:3px;',
          }, rotuloProduto(produto.modelo))
        ),
        window.formField({ label: 'Quantidade de rolos produzidos', input: inputQtd }),
        window.formField({
          label: 'Comprimento dos rolos',
          input: inputComprimento,
          hint: 'Opcional. Se informado, vale para todos os rolos deste registro.',
        })
      ),
      // O dono do modal fecha sozinho quando onSave NÃO devolve `false`. Toda
      // recusa devolve `false` explicitamente para manter o formulário aberto
      // com o que o operador digitou.
      onSave: async function () {
        var qtd = parseInt(String(inputQtd.value).trim(), 10);
        if (!isFinite(qtd) || qtd < 1) {
          window.toast('Informe quantos rolos foram produzidos.', 'error');
          return false;
        }

        // O comprimento é opcional. Vazio significa "não informado", e isso
        // NÃO impede o registro: os rolos nascem sem comprimento e seguem
        // válidos.
        var bruto = String(inputComprimento.value).trim();
        var comprimentos = null;
        if (bruto !== '') {
          var c = Number(bruto.replace(',', '.'));
          if (!isFinite(c) || c <= 0) {
            window.toast('O comprimento informado precisa ser maior que zero.', 'error');
            return false;
          }
          comprimentos = new Array(qtd).fill(c);
        }

        var res = await window.supa.rpc('registrar_producao_tecelagem', {
          p_op_item_id: produto.id,
          p_quantidade_rolos: qtd,
          p_comprimentos: comprimentos,
        });

        if (res.error) {
          console.error(res.error);
          window.toast(mensagemDeErro(res.error), 'error');
          return false;
        }

        var criados = (res.data && res.data.quantidade_rolos) || qtd;
        window.toast(criados === 1 ? '1 rolo registrado.' : criados + ' rolos registrados.', 'success');
        if (typeof aoConcluir === 'function') aoConcluir();
      },
    });
  }

  // Traduz a recusa do dono da escrita para uma frase operacional. Um código
  // desconhecido nunca é escondido: cai numa mensagem honesta e genérica.
  function mensagemDeErro(error) {
    var texto = (error && (error.message || error.details)) || '';
    if (texto.indexOf('TECELAGEM_PRODUTO_FORA_DO_ESCOPO_DO_FORNECEDOR') >= 0) {
      return 'Este produto não pertence a uma OP atribuída a você.';
    }
    if (texto.indexOf('TECELAGEM_FORNECEDOR_NAO_IDENTIFICADO') >= 0) {
      return 'Seu usuário não está ativo como fornecedor. Fale com o administrador.';
    }
    if (texto.indexOf('TECELAGEM_PRODUCAO_NAO_INICIADA') >= 0) {
      return 'Inicie a produção desta OP antes de registrar rolos.';
    }
    if (texto.indexOf('TECELAGEM_OP_ENCERRADA') >= 0) {
      return 'Esta OP já foi encerrada e não recebe mais produção.';
    }
    if (texto.indexOf('TECELAGEM_QUANTIDADE_ACIMA_DO_LIMITE') >= 0) {
      return 'Registre no máximo 500 rolos por vez.';
    }
    if (texto.indexOf('TECELAGEM_QUANTIDADE_INVALIDA') >= 0) {
      return 'Informe quantos rolos foram produzidos.';
    }
    if (texto.indexOf('TECELAGEM_COMPRIMENTO_INVALIDO') >= 0) {
      return 'O comprimento informado precisa ser maior que zero.';
    }
    return 'Não foi possível registrar a produção. Nada foi gravado.';
  }

  // Recusas do início local. O DETAIL carrega o motivo estável de
  // _tecelagem_op_pode_iniciar, então a mensagem diz POR QUE, sem inventar.
  function mensagemDeInicio(error) {
    var texto = (error && (error.message || '')) || '';
    var detalhe = (error && (error.details || error.detail || '')) || '';

    if (texto.indexOf('TECELAGEM_FORNECEDOR_NAO_IDENTIFICADO') >= 0) {
      return 'Seu usuário não está ativo como fornecedor. Fale com o administrador.';
    }
    if (texto.indexOf('TECELAGEM_OP_FORA_DO_ESCOPO_DO_FORNECEDOR') >= 0) {
      return 'Esta OP não está atribuída a você.';
    }
    if (texto.indexOf('TECELAGEM_OP_NAO_ELEGIVEL_PARA_INICIO') >= 0) {
      var motivo = null;
      Object.keys(MOTIVO).forEach(function (codigo) {
        if (detalhe.indexOf(codigo) >= 0) motivo = MOTIVO[codigo];
      });
      return motivo
        ? ('Não é possível iniciar a produção: ' + motivo + '.')
        : 'Esta OP ainda não pode ter a produção iniciada.';
    }
    return 'Não foi possível iniciar a produção. Nada foi gravado.';
  }

  // -------------------------------------------------------------------
  // TELA 3 — VER ROLOS
  // -------------------------------------------------------------------
  function screenTecelagemRolos(opId, opItemId) {
    var container = window.el('div', {});

    async function reload() {
      if (guardaFornecedor(container, 'Rolos')) return;

      var op, produtos, produto, rolos;
      try {
        op = await carregarOp(opId);
        produtos = op ? await carregarProdutos(opId) : [];
        produto = produtos.filter(function (p) { return String(p.id) === String(opItemId); })[0] || null;
        if (!op || !produto) {
          container.replaceChildren(
            window.pageHeader('Rolos'),
            card(emptyText('Este produto não está disponível para o seu usuário.')),
            window.el('div', { style: 'margin-top:12px;' },
              secondaryButton('Voltar para Minhas OPs', function () { window.navigate('#/tecelagem/ops'); }))
          );
          return;
        }
        rolos = (await carregarRolos([produto.id]))[produto.id] || [];
      } catch (e) {
        console.error(e);
        container.replaceChildren(window.pageHeader('Rolos'),
          card(emptyText('Não foi possível carregar os rolos agora. Tente novamente.')));
        return;
      }

      var corpo = window.el('div', { style: 'display:flex; flex-direction:column; gap:12px;' });

      corpo.appendChild(card(
        sectionChip('Produto', ICON_BOX),
        window.el('div', {
          style: 'font-size:var(--rv-fs-body); font-weight:600; color:var(--rv-text-primary);',
        }, rotuloProduto(produto.modelo)),
        window.el('div', {
          style: 'font-size:var(--rv-fs-sm); color:var(--rv-text-secondary); margin-top:5px;',
        }, window.RAVATEX_OP_DISPLAY.formatOpOperationalCode(op)),
        linhaCliente(op)
      ));

      var tabela = card(sectionChip('Rolos registrados', ICON_LIST));
      if (!rolos.length) {
        tabela.appendChild(emptyText('Nenhum rolo registrado ainda.'));
      } else {
        tabela.appendChild(tabelaRolos(rolos));
      }
      corpo.appendChild(tabela);

      corpo.appendChild(window.el('div', { style: 'display:flex; gap:8px; flex-wrap:wrap;' },
        secondaryButton('Voltar para a OP', function () { window.navigate('#/tecelagem/ops/' + op.op_id); }),
        secondaryButton('Minhas OPs', function () { window.navigate('#/tecelagem/ops'); })
      ));

      container.replaceChildren(window.pageHeader('Ver rolos'), corpo);
    }

    reload();
    return window.shellLayout(menu(), container);
  }

  // Tabela §2.5: UM dono de largura, lido pelo cabeçalho E pelas linhas, para
  // que os dois não possam divergir. Coluna numérica alinhada à direita no
  // cabeçalho e no valor.
  var GRID_COLS = '90px 1fr 1fr';

  function tabelaRolos(rolos) {
    var wrap = window.el('div', { style: 'overflow-x:auto;', 'data-rv-table-scroll': '' });
    var tabela = window.el('div', { style: 'min-width:360px;' });

    function linha(estilo, celulas) {
      return window.el('div', {
        style: 'display:grid; grid-template-columns:' + GRID_COLS + '; gap:8px; ' + estilo,
      }, ...celulas);
    }

    var thStyle = 'font-size:var(--rv-fs-thead); font-weight:600; text-transform:uppercase;'
      + ' color:var(--rv-text-tertiary);';

    tabela.appendChild(linha('padding:0 8px 8px;', [
      window.el('div', { style: thStyle }, 'Rolo'),
      window.el('div', { style: thStyle + ' text-align:right;' }, 'Comprimento'),
      window.el('div', { style: thStyle }, 'Situação'),
    ]));

    rolos.forEach(function (rolo) {
      var comprimento = rolo.comprimento_m == null ? '—' : fmtMetros(rolo.comprimento_m);
      var celComprimento = window.el('div', {
        style: 'font-size:var(--rv-fs-body); color:var(--rv-text-primary); text-align:right;',
      }, comprimento);
      // .tnum só onde há número de verdade; o travessão não é número.
      if (rolo.comprimento_m != null) celComprimento.className = 'tnum';

      tabela.appendChild(linha(
        'padding:9px 8px; border-top:1px solid var(--rv-border-soft); align-items:center;',
        [
          num(window.el('div', {
            style: 'font-size:var(--rv-fs-body); font-weight:600; color:var(--rv-text-primary);',
          }, fmtRolo(rolo.numero))),
          celComprimento,
          window.el('div', {}, window.RV_BADGES.rvStatusPill('Na tecelagem', 'em_producao')),
        ]
      ));
    });

    wrap.appendChild(tabela);
    return wrap;
  }

  // -------------------------------------------------------------------
  window.screenTecelagemOps = screenTecelagemOps;
  window.screenTecelagemOp = screenTecelagemOp;
  window.screenTecelagemRolos = screenTecelagemRolos;

  window.RAVATEX_TECELAGEM = {
    screenTecelagemOps: screenTecelagemOps,
    screenTecelagemOp: screenTecelagemOp,
    screenTecelagemRolos: screenTecelagemRolos,
    rotuloProduto: rotuloProduto,
    fmtRolo: fmtRolo,
    fmtMetros: fmtMetros,
    execucao: execucao,
    mensagemDeErro: mensagemDeErro,
    mensagemDeInicio: mensagemDeInicio,
  };
})(window);
