// =====================================================================
// === PEDIDO / INSUMOS — PURCHASE DISTRIBUTION =========================
// F2 owns the only purchasing-distribution surface. Server state remains
// authoritative: this module renders canonical projections and sends only
// need, supplier, absolute target, and an idempotency key to the F1 RPC.
// =====================================================================

(function (window) {
  'use strict';

  var ns = window.RAVATEX_SCREENS = window.RAVATEX_SCREENS || {};
  var UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  var el = window.el;

  function kg(value) {
    return typeof window.fmtKg === 'function' ? window.fmtKg(value) : String(value || 0);
  }

  function commandKey() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') return window.crypto.randomUUID();
    return 'f2-' + Date.now() + '-' + Math.random().toString(36).slice(2);
  }

  function errorText(code, fallback) {
    var texts = {
      sem_permissao: 'Você não tem permissão para distribuir esta necessidade.',
      necessidade_nao_encontrada: 'A necessidade não foi encontrada.',
      fornecedor_invalido: 'O fornecedor não foi encontrado.',
      fornecedor_incompativel: 'O fornecedor não atende este tipo de fio.',
      kg_invalido: 'Informe uma quantidade válida, com até três casas decimais.',
      excede_saldo: 'A quantidade alvo excede o saldo disponível da necessidade.',
      estado_invalido: 'A ordem já está emitida ou congelada para alteração.',
      idempotencia_conflitante: 'Esta chave de comando já foi usada com uma ação diferente. Não repita como um novo comando.',
      necessidade_origem_invalida: 'A proveniência da necessidade está inconsistente.',
      pedido_incoerente: 'A necessidade não pertence ao Pedido informado.',
      codigo_ordem_obrigatorio: 'Informe o número da ordem de compra para criar a ordem deste fornecedor.',
      codigo_ordem_duplicado: 'Já existe uma ordem de compra com este número. Escolha outro.',
      codigo_ordem_invalido: 'O número da ordem deve ter até 40 caracteres, sem espaço no início ou fim.',
      limpeza_conflitante: 'A remoção não pode limpar um item ou ordem com histórico.',
      alocacao_duplicada: 'Houve conflito de concorrência. Refaça a leitura antes de uma nova alteração.',
    };
    return texts[code] || fallback || 'Não foi possível concluir a distribuição.';
  }

  async function loadData(pedidoId) {
    var needs = await window.supa.from('necessidade_compra_fio')
      .select('id, origem_tipo, op_id, material, cor_id, cor_poliester, kg_necessario, kg_alocado, legado, ops:op_id(id,numero,ano,identidade_operacional,identidade_pedido_id), cores:cor_id(nome)')
      .eq('pedido_id', pedidoId).eq('legado', false).order('id');
    if (needs.error) throw needs.error;
    var ids = (needs.data || []).map(function (item) { return item.id; });
    var allocations = ids.length ? await window.supa.from('ordem_compra_item_alocacao')
      .select('id, necessidade_id, kg_alocado, item:ordem_compra_item!inner(ordem_id, ordem:ordem_id!inner(id, fornecedor_id, status_administrativo, status_recebimento, fornecedores:fornecedor_id(nome)))')
      .in('necessidade_id', ids) : { data: [], error: null };
    if (allocations.error) throw allocations.error;
    var suppliers = await window.supa.from('fornecedores').select('id, nome, tipo').order('nome');
    if (suppliers.error) throw suppliers.error;
    // Rascunhos vivos deste Pedido, por fornecedor. E exatamente o mesmo
    // criterio que o servidor usa para decidir entre REUTILIZAR e CRIAR
    // (db/74/db/96: pedido + fornecedor + legado=false + rascunho), lido aqui
    // so para dizer ao operador o que vai acontecer ANTES de ele confirmar.
    // A decisao continua sendo do servidor: sem codigo ele recusa a criacao.
    var drafts = await window.supa.from('ordem_compra')
      .select('id, codigo, identidade_operacional, identidade_pedido_id, pedido_id, fornecedor_id')
      .eq('pedido_id', pedidoId).eq('legado', false).eq('status_administrativo', 'rascunho');
    if (drafts.error) throw drafts.error;
    var draftBySupplier = {};
    (drafts.data || []).forEach(function (row) {
      if (row && row.fornecedor_id != null) draftBySupplier[String(row.fornecedor_id)] = row;
    });
    (needs.data || []).forEach(function (need) {
      need.alocacoes = (allocations.data || []).filter(function (row) { return Number(row.necessidade_id) === Number(need.id); });
    });
    return { needs: needs.data || [], suppliers: suppliers.data || [], draftBySupplier: draftBySupplier };
  }

  // OP-CANONICAL-IDENTITY-REFOUNDATION-R1: a necessidade de compra atribui
  // origem pela identidade CANONICA da OP. ANTES concatenava numero/ano
  // direto (`OP 42/2026`) e, quando a projecao nao trazia numero, caia no
  // `op_id` cru — dois nomes diferentes para a mesma OP.
  function needLabel(need) {
    if (need.origem_tipo === 'op') {
      return window.RAVATEX_OP_DISPLAY.formatOpOperationalCode(need.ops || null);
    }
    return 'Pedido compartilhado';
  }

  function materialLabel(need) {
    return (need.material === 'algodao' ? 'Algodão' : 'Poliéster') + ' · '
      + ((need.cores && need.cores.nome) || need.cor_poliester || '—');
  }

  function orderFrom(allocation) {
    return allocation && allocation.item && allocation.item.ordem;
  }

  // Saldo distribuivel da necessidade — dono unico no cliente.
  // Espelha EXATAMENTE a invariante do servidor em
  // public.definir_alocacao_necessidade_compra_fio (db/74):
  //   v_available := kg_necessario - (kg_alocado - v_previous)
  // onde `v_previous` e o alvo absoluto que ESTA alocacao ja ocupa (0 quando
  // e uma distribuicao nova). Por isso `alocacao` participa do calculo: o alvo
  // e absoluto, nao incremental, e o que este fornecedor ja detem volta ao
  // saldo antes do teto.
  //
  // Quantizado em 3 casas porque kg_necessario/kg_alocado sao NUMERIC(12,3) e
  // a subtracao binaria produz residuo (12.5 - 3.2 === 9.299999999999999). Sem
  // a quantizacao o proprio validador do modal (/^\d+(\.\d{1,3})?$/) e o
  // `round(p_kg_alocado,3) IS DISTINCT FROM p_kg_alocado` do RPC recusariam o
  // valor que a tela acabou de sugerir.
  function distributableBalance(need, allocation) {
    var necessary = Number(need && need.kg_necessario);
    var allocated = Number(need && need.kg_alocado);
    var previous = allocation ? Number(allocation.kg_alocado) : 0;
    if (!Number.isFinite(necessary) || !Number.isFinite(allocated) || !Number.isFinite(previous)) return 0;
    var available = Math.round((necessary - (allocated - previous)) * 1000) / 1000;
    return available > 0 ? available : 0;
  }

  // Valor inicial do campo de quantidade alvo. Distribuir uma necessidade
  // intocada ou parcialmente distribuida abre com TODO o saldo ainda
  // distribuivel, ja preenchido e editavel para baixo. Sem saldo o campo abre
  // vazio: zero e um comando de REMOCAO nesta tela e nao pode ser sugerido.
  // Alterar uma alocacao existente conserva o alvo absoluto ja persistido.
  function targetFieldValue(need, allocation) {
    if (allocation) return String(allocation.kg_alocado);
    var balance = distributableBalance(need, null);
    return balance > 0 ? String(balance) : '';
  }

  function renderNeed(need, openAllocation) {
    var remaining = distributableBalance(need, null);
    var card = el('section', { style: 'border-radius:var(--rv-radius);', class: 'bg-white shadow p-5 mb-4', 'data-necessidade-id': String(need.id) });
    card.appendChild(el('div', { class: 'flex items-start justify-between gap-3 flex-wrap' },
      el('div', {},
        el('h2', { class: 'font-semibold text-gray-900' }, materialLabel(need)),
        el('div', { class: 'text-xs text-gray-500 mt-1' }, needLabel(need) + ' · proveniência somente leitura')),
      el('button', { type: 'button', style: 'border-radius:var(--rv-radius);', class: 'bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold px-3 py-2', onclick: function () { openAllocation(need, null); } }, 'Distribuir')));
    card.appendChild(el('div', { class: 'grid grid-cols-3 gap-2 text-sm mt-4' },
      el('div', { style: 'border-radius:var(--rv-radius);', class: 'bg-gray-50 p-2' }, 'Necessário: ' + kg(need.kg_necessario)),
      el('div', { style: 'border-radius:var(--rv-radius);', class: 'bg-gray-50 p-2' }, 'Alocado: ' + kg(need.kg_alocado)),
      el('div', { style: 'border-radius:var(--rv-radius);', class: 'bg-gray-50 p-2' }, 'Restante: ' + kg(remaining))));
    var allocations = need.alocacoes || [];
    card.appendChild(el('div', { class: 'mt-4 text-xs font-semibold text-gray-600 uppercase' }, 'Alocações atuais'));
    if (!allocations.length) card.appendChild(el('div', { class: 'text-sm text-gray-500 mt-1' }, 'Nenhuma alocação para esta necessidade.'));
    allocations.forEach(function (allocation) {
      var order = orderFrom(allocation) || {};
      var supplier = order.fornecedores || {};
      var row = el('div', { class: 'flex items-center justify-between gap-3 mt-2 text-sm border-t pt-2', 'data-alocacao-id': String(allocation.id) },
        el('span', {}, (supplier.nome || 'Fornecedor') + ' · alvo ' + kg(allocation.kg_alocado) + ' kg'),
        el('div', { class: 'flex gap-3' },
          el('button', { type: 'button', class: 'text-blue-700 font-semibold', onclick: function () { openAllocation(need, allocation); } }, 'Alterar'),
          order.id != null ? el('button', { type: 'button', class: 'text-blue-700 font-semibold', onclick: function () { window.navigate('#/ordens-compra/' + order.id); } }, 'Ver ordem') : null));
      card.appendChild(row);
    });
    return card;
  }

  function openModal(need, allocation, suppliers, draftBySupplier, onDone, setNotice) {
    var order = orderFrom(allocation) || {};
    var selectedSupplier = order.fornecedor_id || '';
    var supplierType = need.material === 'algodao' ? 'fio_algodao' : 'fio_poliester';
    var validSuppliers = suppliers.filter(function (supplier) { return supplier.tipo === supplierType; });
    var supplier = window.selectInput({ options: validSuppliers.map(function (item) { return { value: item.id, label: item.nome }; }), value: selectedSupplier, placeholder: 'Selecione o fornecedor...' });

    // NUMERO DA ORDEM (db/96): o sistema NAO escolhe e NAO sugere. Quando a
    // alocacao vai criar uma ordem para este fornecedor, o operador digita o
    // codigo visivel; quando ja existe um rascunho vivo, ele e reutilizado e
    // nada e perguntado. O bloco abaixo apenas ANTECIPA qual dos dois casos e
    // — a decisao final continua sendo do servidor.
    var codigoInput = el('input', {
      type: 'text', maxlength: '40', autocomplete: 'off',
      placeholder: 'Ex.: PC 2026/0042',
      style: 'border-radius:var(--rv-radius);', class: 'w-full border px-3 py-2',
    });
    var ocBlock = el('div', {});
    function draftFor(supplierId) {
      return supplierId ? draftBySupplier[String(supplierId)] : null;
    }
    function renderOcBlock() {
      var existing = draftFor(supplier.value);
      if (!supplier.value) {
        ocBlock.replaceChildren(el('div', { style: 'border-radius:var(--rv-radius);', class: 'text-xs text-gray-500 bg-gray-50 p-3' },
          'Selecione o fornecedor para saber se a alocação entra numa ordem existente ou cria uma nova.'));
        return;
      }
      if (existing) {
        var nome = window.RAVATEX_OP_DISPLAY.formatOcOperationalCode(existing);
        ocBlock.replaceChildren(el('div', { id: 'oc-reaproveitada', style: 'border-radius:var(--rv-radius);', class: 'text-xs text-gray-700 bg-gray-50 p-3' },
          'Esta alocação entra na ordem de compra existente ' + nome + '. Nenhum número novo é necessário.'));
        return;
      }
      ocBlock.replaceChildren(
        window.formField({ label: 'Número da ordem de compra', input: codigoInput }),
        el('div', { class: 'text-xs text-gray-500 mt-1' },
          'Ainda não existe ordem em rascunho para este fornecedor neste Pedido. '
          + 'Informe o número que a ordem terá — ele é gravado exatamente como digitado.'));
    }
    supplier.addEventListener('change', renderOcBlock);
    var target = el('input', { type: 'number', min: '0', step: '0.001', value: targetFieldValue(need, allocation), style: 'border-radius:var(--rv-radius);', class: 'w-full border px-3 py-2' });
    var current = allocation ? Number(allocation.kg_alocado) : 0;
    var body = el('div', { class: 'space-y-3' },
      el('div', { class: 'text-sm text-gray-700' }, materialLabel(need) + ' · ' + needLabel(need)),
      window.formField({ label: 'Fornecedor', input: supplier }),
      ocBlock,
      window.formField({ label: 'Quantidade alvo absoluta (kg)', input: target }),
      el('div', { style: 'border-radius:var(--rv-radius);', class: 'text-xs text-gray-500 bg-gray-50 p-3' },
        'Necessário: ' + kg(need.kg_necessario) + ' · total alocado: ' + kg(need.kg_alocado)
        + ' · neste fornecedor: ' + kg(current) + ' · restante atual: ' + kg(distributableBalance(need, null))
        + '. Use zero para remover esta alocação.'));
    renderOcBlock();
    var command = { key: commandKey(), submitting: false };
    window.modal({
      title: 'Distribuir necessidade', body: body, saveLabel: 'Confirmar alvo',
      onSave: async function () {
        if (command.submitting) return false;
        var supplierId = Number(supplier.value);
        var targetKg = Number(target.value);
        if (!supplierId || !Number.isFinite(targetKg) || targetKg < 0 || !/^\d+(\.\d{1,3})?$/.test(String(target.value).trim())) {
          setNotice('error', 'Informe fornecedor e quantidade alvo válida.');
          return false;
        }
        // O codigo so viaja quando a ordem sera criada. Reutilizar um rascunho
        // existente nao pede numero, e enviar um seria oferecer um dado que o
        // servidor ignora. Um alvo 0 tambem nunca cria ordem.
        var criaOrdem = !draftFor(supplierId) && targetKg > 0;
        var digitado = codigoInput.value == null ? '' : String(codigoInput.value);
        var codigo = criaOrdem ? digitado : null;
        if (criaOrdem && codigo.trim() === '') {
          setNotice('error', errorText('codigo_ordem_obrigatorio'));
          return false;
        }
        command.submitting = true;
        var result;
        try {
          result = await window.supa.rpc('definir_alocacao_necessidade_compra_fio', {
            p_necessidade_id: Number(need.id), p_fornecedor_id: supplierId,
            p_kg_alocado: targetKg, p_idempotency_key: command.key,
            p_codigo_ordem: codigo,
          });
        } catch (error) {
          command.submitting = false;
          setNotice('error', 'Resposta incerta. Reenvie para repetir com segurança a mesma chave de comando.');
          return false;
        }
        command.submitting = false;
        if (result.error || !result.data || result.data.ok !== true) {
          var data = result.data || {};
          setNotice('error', errorText(data.codigo, data.erro || 'Falha de comunicação. Reenvie para repetir com segurança a mesma chave de comando.'));
          return false;
        }
        setNotice('success', 'Distribuição atualizada (' + (result.data.discriminador || 'ok') + ').');
        await onDone();
        return true;
      },
    });
  }

  async function screenPedidoInsumosDistribuicao(pedidoId) {
    var root = el('div', { id: 'pedido-insumos-distribuicao' });
    var notice = el('div', { id: 'pedido-insumos-distribuicao-notice', class: 'hidden mb-4' });
    function setNotice(kind, text) {
      notice.className = 'mb-4 p-3 text-sm ' + (kind === 'error' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700');
      notice.style.borderRadius = 'var(--rv-radius)';
      notice.textContent = text;
    }
    function renderLoading() { root.replaceChildren(el('div', { style: 'border-radius:var(--rv-radius);', class: 'bg-white shadow p-6 text-gray-500' }, 'Carregando necessidades de compra...')); }
    async function reload() {
      renderLoading();
      try {
        var data = await loadData(pedidoId);
        var body = el('div', {},
          el('div', { class: 'flex items-center justify-between gap-3 mb-4 flex-wrap' },
            el('div', {}, el('h1', { style: 'font-size:var(--rv-fs-title);', class: 'font-bold' }, 'Insumos — distribuição de compra'), el('div', { class: 'text-sm text-gray-500 mt-1' }, 'Defina fornecedores e quantidades alvo por necessidade do Pedido.')),
            el('button', { type: 'button', class: 'text-blue-700 font-semibold', onclick: function () { window.navigate('#/pedidos/' + pedidoId); } }, 'Voltar ao Pedido')));
        if (!data.needs.length) body.appendChild(el('div', { style: 'border-radius:var(--rv-radius);', class: 'bg-white shadow p-6 text-gray-500' }, 'Nenhuma necessidade nativa disponível para este Pedido.'));
        data.needs.forEach(function (need) { body.appendChild(renderNeed(need, function (selected, allocation) { openModal(selected, allocation, data.suppliers, data.draftBySupplier, reload, setNotice); })); });
        root.replaceChildren(body);
      } catch (error) {
        setNotice('error', 'Não foi possível carregar a distribuição. Tente novamente.');
        root.replaceChildren(el('button', { type: 'button', class: 'text-blue-700 font-semibold', onclick: reload }, 'Tentar novamente'));
      }
    }
    if (!UUID.test(String(pedidoId || ''))) setNotice('error', 'Identificador de Pedido inválido.');
    else await reload();
    return window.shellLayout(window.ADMIN_MENU, el('div', {}, notice, root));
  }

  ns.pedidoInsumosDistribuicao = {
    screenPedidoInsumosDistribuicao: screenPedidoInsumosDistribuicao,
    commandKey: commandKey,
    errorText: errorText,
    distributableBalance: distributableBalance,
    targetFieldValue: targetFieldValue,
    openModal: openModal,
  };
  window.screenPedidoInsumosDistribuicao = screenPedidoInsumosDistribuicao;
})(window);
