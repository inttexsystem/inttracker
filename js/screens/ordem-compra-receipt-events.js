// =====================================================================
// === SCREENS: ORDEM DE COMPRA — RECEIPT EVENTS (PHASE-C4) =============
// Phase: PHASE-C4 (docs/architecture/ORDEM_COMPRA_C4_PHASE_CONTRACT.md,
// OC-C4-ADMIN-001). Wires the receipt registration and admin reversal
// actions to dedicated action modals (js/ui.js primitives only) and submits
// through ordem-compra-receipt-data.js's native writers. Owns the TWO
// independent in-memory idempotency attempt trackers (§12) — one for
// registration, one for reversal, never shared.
//
// Transition modals contain actions only (§R.16): the receipt entity,
// balances, allocations and full history stay on the dedicated screen
// (rendered by ordem-compra-receipt-render.js); these modals carry just the
// inputs needed to perform the transition. After a deterministic success the
// UI performs an authoritative server reload (never patches local state as
// the final truth). Deterministic rejections render as toasts with the form
// kept open; a genuinely ambiguous transport keeps the same token for a
// same-intent retry and never falls back to any other path.
// =====================================================================

(function (window) {
  'use strict';

  window.RAVATEX_SCREENS = window.RAVATEX_SCREENS || {};
  var ns = window.RAVATEX_SCREENS.ordemCompra = window.RAVATEX_SCREENS.ordemCompra || {};

  var el = window.el;

  function fmtKg(v) {
    if (v == null) return '—';
    return (typeof window.fmtKg === 'function') ? window.fmtKg(v) : String(v);
  }
  // OP-CANONICAL-IDENTITY-REFOUNDATION-R1: `opLabel` vive DENTRO da factory
  // (ver createReceiptEvents), porque precisa do `state` da tela para resolver
  // a identidade e o `state` e uma closure daquela funcao. ANTES a versao de
  // modulo devolvia `'OP ' + opId` — a chave primaria crua como nome.
  // BACKLOG-7 PHASE 2 — o mesmo defeito de cor da superficie de render, na
  // superficie de acao. Ver a nota longa em ordem-compra-receipt-render.js: o
  // read model de recebimento nao projeta cor_nome, mas obter_ordem_compra_admin
  // projeta, e os dois chaveiam pelo mesmo ordem_compra_item.id. Aqui o impacto
  // e maior que estetico: era o rotulo do campo em que o operador digita o peso.
  //
  // `itens` e o state.ordem.itens ja carregado; ausente, cai no rotulo anterior.
  function fioLabelCom(itensPorId, row) {
    var doPedido = (itensPorId && row && row.item_id != null)
      ? itensPorId[String(row.item_id)] : null;
    var mat = row.material === 'algodao' ? 'Algodão' : 'Poliéster';
    var cor = (doPedido && (doPedido.cor_nome || doPedido.cor_poliester))
      || row.cor_poliester
      || (row.cor_id != null ? ('Cor ' + row.cor_id) : '—');
    return mat + ' · ' + cor;
  }
  function todayIso() { return new Date().toISOString().slice(0, 10); }

  var CODE_MESSAGES = {
    recebimento_canonico_inativo: 'Recebimento canônico inativo neste ambiente.',
    aceite_pendente: 'A ordem aguarda aceite; recebimento indisponível.',
    aceite_rejeitada: 'Aceite rejeitado; recebimento indisponível.',
    estado_invalido: 'Estado da ordem inválido para esta operação.',
    excede_alocacao: 'Quantidade acima do saldo da alocação.',
    excede_item: 'Quantidade acima do saldo do item.',
    excede_estornavel: 'Quantidade acima do saldo reversível.',
    idempotencia_conflitante: 'Conflito de idempotência; recarregue a ordem e tente novamente.',
    idempotencia_invalida: 'Chave de idempotência inválida.',
    sem_permissao: 'Sem permissão para esta ação.',
    fornecedor_incorreto: 'Fornecedor incorreto para esta ordem.',
    linha_invalida: 'Linhas de recebimento inválidas.',
    linhas_invalidas: 'Linhas de recebimento inválidas.',
    ordem_nao_encontrada: 'Ordem de compra não encontrada.',
    lancamento_invalido: 'Lançamento inválido para estorno.',
    nao_encontrado: 'Recebimento não encontrado.',
    comando_invalido: 'Recebimento inválido: data e tipo de origem são obrigatórios.',
    concorrencia_ocupada: 'Outra operação está alterando este recebimento. Tente novamente.',
    item_invalido: 'Item inválido.',
    alocacao_invalida: 'Alocação inválida.',
    erro_interno: 'Erro interno ao processar a solicitação.',
  };

  // Recusas do ESTORNO falam de estorno. O mapa geral descreve recebimento —
  // `comando_invalido` virava "Dados do recebimento inválidos." num modal de
  // estorno, sem dizer o que faltava, e o operador concluía que a quantidade
  // ou o motivo que ele digitou estavam errados quando o campo ausente era a
  // data que a tela nunca pediu.
  var REVERSAL_CODE_MESSAGES = {
    comando_invalido: 'Estorno inválido: informe data, motivo e quantidade.',
    linha_invalida: 'Lançamento inválido para estorno.',
    linhas_invalidas: 'Nenhum lançamento válido para estorno.',
    lancamento_invalido: 'Este lançamento não pode ser estornado.',
    excede_estornavel: 'Quantidade acima do saldo reversível deste lançamento.',
    recebimento_canonico_inativo: 'Estorno canônico inativo neste ambiente.',
    sem_permissao: 'Sem permissão para estornar recebimento.',
    concorrencia_ocupada: 'Outra operação está alterando este Pedido. Tente novamente.',
  };

  function rejectionMessage(res, contexto) {
    var mapa = contexto === 'estorno' ? REVERSAL_CODE_MESSAGES : null;
    function traduzir(codigo) {
      if (!codigo) return null;
      return (mapa && mapa[codigo]) || CODE_MESSAGES[codigo] || null;
    }
    if (res.outcome === 'hard_failure') {
      return traduzir(res.codigo) || (res.error && res.error.message) || 'Erro ao processar a solicitação.';
    }
    var data = res.result || {};
    return traduzir(data.codigo) || data.erro
      || (contexto === 'estorno' ? 'Não foi possível concluir o estorno.' : 'Não foi possível concluir a ação.');
  }

  ns.createReceiptEvents = function (ctx) {
    var state = ctx.state || {};
    var reload = ctx.reload;
    var ordemId = ctx.ordemId;

    // Atribuicao de origem pela identidade canonica da OP. O mapa
    // op_id -> identidade e resolvido uma vez por carga em
    // ordem-compra-receipt-data.js e vive em `state.opIdentidades`.
    function opLabel(opId) {
      return window.RAVATEX_OP_DISPLAY.formatOpIdentityFromMap(opId, state.opIdentidades);
    }

    // Resolvido no momento da abertura do modal, nao no carregamento do modulo:
    // `state.ordem` e recarregado a cada reload autoritativo.
    function itensPorId() {
      var itens = (state.ordem && state.ordem.itens) || null;
      if (!itens || !itens.length) return null;
      var mapa = {};
      itens.forEach(function (it) {
        if (it && it.item_id != null) mapa[String(it.item_id)] = it;
      });
      return mapa;
    }
    function fioLabel(row) {
      return fioLabelCom(itensPorId(), row);
    }

    // Two independent attempt trackers (contract §12) — never shared, never
    // persisted outside these closures.
    var registrationTracker = ns.createReceiptAttemptTracker();
    var reversalTracker = ns.createReceiptAttemptTracker();

    // ---- R12: continuação pós-recebimento ------------------------------
    //
    // A lista de OPs afetadas é AUTORITATIVA e vem do resultado do comando:
    // `lancamentos[].op_id` é o vínculo que o SERVIDOR resolveu ao gravar cada
    // linha do razão (db/74 F1: origem-OP recebe a OP real da alocação;
    // origem-Pedido, compartilhada, permanece com op_id NULL; excedente fica
    // sem alocação e sem OP). Não se conta linha do formulário, não se conta
    // alocação da tela e não se adivinha nada no cliente.
    function opsAfetadasDoResultado(result) {
      var ids = [];
      var linhas = (result && result.lancamentos) || [];
      linhas.forEach(function (l) {
        if (!l || l.op_id == null) return;              // pool do Pedido ou excedente
        if (ids.indexOf(l.op_id) === -1) ids.push(l.op_id);
      });
      return ids;
    }

    // TRÊS destinos, não dois. O servidor grava a diferença em cada linha e o
    // resultado do comando a projeta (alocacao_id, op_id, kg_excesso):
    //   OP direta   — op_id != null: necessidade de ORIGEM OP (hoje algodão).
    //   Pool Pedido — alocacao_id != null E op_id == null: necessidade de
    //                 ORIGEM PEDIDO (hoje poliéster). op_id é NULL por
    //                 constraint (db/67 necessidade_origem_shape), NÃO por
    //                 falta de destino: db/101 §9.9.A escopa esse material por
    //                 pedido_id e ele é o teto COMPARTILHADO de todas as OPs
    //                 do Pedido.
    //   Excedente   — alocacao_id == null: recebido além do pedido, sem
    //                 alocação e sem OP. Esse sim não tem destino produtivo.
    //
    // Antes as duas últimas eram fundidas num único "nenhuma OP afetada — o
    // material entrou como excedente ou no pool do Pedido". Para um
    // recebimento de poliéster inteiramente alocado ao pool a tela afirmava o
    // OPOSTO do que acontecera: o material tinha acabado de elevar o teto das
    // OPs do Pedido.
    function classificarDestinos(result) {
      var linhas = (result && result.lancamentos) || [];
      var opIds = [];
      var temPool = false;
      var temExcedente = false;
      linhas.forEach(function (l) {
        if (!l) return;
        if (l.op_id != null) {
          if (opIds.indexOf(l.op_id) === -1) opIds.push(l.op_id);
        } else if (l.alocacao_id != null) {
          temPool = true;
        } else {
          temExcedente = true;
        }
      });
      return { opIds: opIds, temPool: temPool, temExcedente: temExcedente };
    }

    // Rota de continuação, conforme a ruling R12:
    //   1 OP    -> a própria OP, no seu bloco de ajuste/produção;
    //   N OPs   -> o painel consolidado de produção do Pedido;
    //   0 OP    -> nenhuma: excedente/pool não têm destino produtivo.
    function rotaContinuacao(opIds) {
      if (opIds.length === 1) return '#/ops/' + opIds[0];
      if (opIds.length > 1) {
        var pedidoId = state.ordem && state.ordem.pedido_id;
        return pedidoId ? '#/pedidos/' + pedidoId + '/producao' : null;
      }
      return null;
    }

    // O slider COMPLETO nunca é renderizado aqui: este modal carrega apenas a
    // AÇÃO de continuação (§R.16). O ajuste acontece na superfície da OP ou no
    // painel do Pedido, sempre pelo dono compartilhado.
    function abrirContinuacaoProducao(result) {
      var destinos = classificarDestinos(result);
      var opIds = destinos.opIds;
      var pedidoId = state.ordem && state.ordem.pedido_id;

      // POOL DO PEDIDO — material produtivo COMPARTILHADO. Não há uma OP
      // única a apontar porque ele eleva o teto de TODAS as OPs do Pedido que
      // consomem esse eixo; a continuação certa é o painel consolidado.
      if (!opIds.length && destinos.temPool) {
        var rotaPool = pedidoId ? '#/pedidos/' + pedidoId + '/producao' : null;
        var textoPool = 'O material entrou no pool compartilhado do Pedido. Ele não pertence a uma OP específica: '
          + 'eleva o teto de produção de todas as OPs do Pedido que consomem esse fio.'
          + (destinos.temExcedente ? ' Parte do recebimento foi classificada como excedente, que não tem destino produtivo.' : '');
        if (!rotaPool) {
          window.toast('Recebimento registrado no pool do Pedido. Não foi possível resolver a rota de continuação.', 'success');
          return null;
        }
        return window.modal({
          title: 'Recebimento registrado',
          body: window.el('div', { style: 'font-size:var(--rv-fs-body);color:var(--rv-text-secondary);line-height:1.5;' }, textoPool),
          saveLabel: 'Revisar produção do Pedido',
          onSave: function () {
            window.navigate(rotaPool);
            return true;
          },
        });
      }

      if (!opIds.length) {
        // Só excedente: aí sim não há destino produtivo, e a tela diz isso
        // sem embutir o pool na mesma frase.
        window.toast('Recebimento registrado como excedente. Nenhuma OP foi afetada e nenhum teto de produção mudou.', 'success');
        return null;
      }
      var rota = rotaContinuacao(opIds);
      if (!rota) {
        window.toast('Recebimento registrado. Não foi possível resolver a rota de continuação.', 'success');
        return null;
      }
      var descricao = opIds.length === 1
        ? 'O recebimento afetou ' + opLabel(opIds[0]) + '. Revise a distribuição de produção dessa OP.'
        : 'O recebimento afetou ' + opIds.length + ' OPs. Revise a produção no painel consolidado do Pedido.';
      return window.modal({
        title: 'Recebimento registrado',
        body: window.el('div', { style: 'font-size:var(--rv-fs-body);color:var(--rv-text-secondary);line-height:1.5;' }, descricao),
        saveLabel: 'Revisar produção',
        onSave: function () {
          window.navigate(rota);
          return true;
        },
      });
    }

    // ---- Registration modal ------------------------------------------
    function abrirRegistroRecebimento() {
      var hist = state.receiptHistory;
      if (!hist || hist.ok !== true || !(hist.acoes && hist.acoes.receber)) {
        window.toast('Registro de recebimento indisponível para esta ordem.', 'error');
        return;
      }

      var dateInput = window.textInput({ type: 'date', value: todayIso() });
      var docInput = window.textInput({ placeholder: 'Documento / referência (opcional)' });
      // ORIGEM É OBRIGATÓRIA NO ESCRITOR, não opcional na tela:
      //   IF p_recebido_em IS NULL OR p_origem_tipo IS NULL
      //      OR length(btrim(p_origem_tipo)) NOT BETWEEN 1 AND 80
      //   THEN 'comando_invalido', 'Data e origem sao obrigatorias'
      // O campo dizia "(opcional)". Quem acreditava no rótulo e deixava vazio
      // tinha o recebimento recusado antes de qualquer escrita, com uma
      // mensagem que não nomeava o campo. Vem preenchido com um valor honesto
      // ("Sem nota") para que o caminho comum não exija digitação, e continua
      // editável quando existe nota real.
      var origemTipoInput = window.textInput({ value: 'Sem nota', placeholder: 'Ex.: nota_fiscal' });
      origemTipoInput.setAttribute('data-receipt-origem-tipo', '1');
      var origemRefInput = window.textInput({ placeholder: 'Referência de origem (opcional)' });

      var body = el('div', {});
      body.appendChild(window.formField({ label: 'Data do recebimento', input: dateInput }));
      body.appendChild(window.formField({ label: 'Documento', input: docInput }));
      body.appendChild(window.formField({ label: 'Tipo de origem *', input: origemTipoInput, hint: 'Obrigatório. Ex.: nota_fiscal. Use "Sem nota" quando não houver documento fiscal.' }));
      body.appendChild(window.formField({ label: 'Referência de origem', input: origemRefInput }));

      // One kg input per allocation + exactly one explicit "Excesso" row per
      // item. Excess is entered distinctly and never fabricates an allocation.
      var rows = [];
      (hist.itens || []).forEach(function (it) {
        body.appendChild(el('div', {
          class: 'mt-4 mb-1',
          style: 'font-size:var(--rv-fs-label);font-weight:700;text-transform:uppercase;'
            + 'letter-spacing:var(--rv-tracking-label);color:var(--rv-text-tertiary);',
        }, fioLabel(it) + ' — restante ' + fmtKg(it.kg_restante)));
        (it.alocacoes || []).forEach(function (a) {
          var input = window.textInput({ placeholder: '0,000' });
          input.setAttribute('data-alocacao-id', String(a.alocacao_id));
          rows.push({ itemId: it.item_id, destino: 'alocacao', alocacaoId: a.alocacao_id, input: input });
          body.appendChild(window.formField({ label: opLabel(a.op_id) + ' — restante ' + fmtKg(a.kg_restante), input: input }));
        });
        var exInput = window.textInput({ placeholder: '0,000' });
        exInput.setAttribute('data-excesso-item', String(it.item_id));
        rows.push({ itemId: it.item_id, destino: 'excesso', input: exInput });
        body.appendChild(window.formField({
          label: 'Excesso (sem alocação)', input: exInput,
          hint: 'Quantidade recebida além do pedido; não vincula alocação nem OP.',
        }));
      });

      // Sticky total summary — stays visible above the modal footer even when
      // a multi-item order makes the body scroll (VISUAL-GATE-R1). Token colors.
      // EMPHASISED_METRIC (§5): a modal-local operational readout, not a
      // screen-level aggregate and not a heading. `text-sm` painted 14px, which
      // is absent from the enum entirely. Promoting this to SUMMARY_TOTAL is the
      // registration-modal phase's decision, not this token pass's.
      var totalEl = el('div', {
        id: 'oc-reg-total',
        style: 'position:sticky;bottom:0;margin:12px -24px 0;padding:10px 24px;'
          + 'font-size:var(--rv-fs-metric);font-weight:700;'
          + 'background:var(--rv-surface);border-top:1px solid var(--rv-border);'
          + 'color:var(--rv-text-primary);font-variant-numeric:tabular-nums;',
      });
      body.appendChild(totalEl);
      function recompute() {
        var aloc = 0, exc = 0;
        rows.forEach(function (r) {
          var kg = ns.parseKgInput(r.input.value);
          if (!(kg > 0)) return;
          if (r.destino === 'excesso') exc += kg; else aloc += kg;
        });
        totalEl.textContent = 'Alocado: ' + fmtKg(aloc) + ' · Excesso: ' + fmtKg(exc) + ' · Total: ' + fmtKg(aloc + exc);
      }
      rows.forEach(function (r) { r.input.addEventListener('input', recompute); });
      recompute();

      window.modal({
        title: 'Registrar recebimento',
        body: body,
        saveLabel: 'Registrar',
        onClose: function () { registrationTracker.complete(); },
        onSave: async function () {
          var linhas = ns.buildReceiptLinhas(rows.map(function (r) {
            return { itemId: r.itemId, destino: r.destino, alocacaoId: r.alocacaoId, kg: ns.parseKgInput(r.input.value) };
          }));
          if (!linhas.length) {
            window.toast('Informe ao menos uma quantidade maior que zero.', 'error');
            return false;
          }
          // Os DOIS campos que o escritor exige. Recusar aqui evita gastar uma
          // tentativa contra um `comando_invalido` que não nomeia o campo.
          if (!String(dateInput.value || '').trim()) {
            window.toast('Informe a data do recebimento.', 'error');
            return false;
          }
          if (!String(origemTipoInput.value || '').trim()) {
            window.toast('Informe o tipo de origem do recebimento.', 'error');
            return false;
          }
          var params = {
            ordemId: ordemId,
            ocorridoEm: dateInput.value || null,
            documentoRef: docInput.value || null,
            origemTipo: origemTipoInput.value || null,
            origemRef: origemRefInput.value || null,
            linhas: linhas,
          };
          var intent = {
            ordemId: ordemId, ocorridoEm: params.ocorridoEm || '', documentoRef: params.documentoRef || '',
            origemTipo: params.origemTipo || '', origemRef: params.origemRef || '', sig: JSON.stringify(linhas),
          };
          var attempt = registrationTracker.resolveAttempt(intent);
          var res = await ns.registrarRecebimento(params, attempt);
          if (res.outcome === 'success') {
            registrationTracker.complete();
            await reload();
            // R12: a recarga autoritativa vem ANTES da continuação, para que a
            // OP (ou o painel) seja aberta sobre o estado já atualizado.
            abrirContinuacaoProducao(res.result);
            return; // closes the modal
          }
          if (res.outcome === 'ambiguous') {
            // Commit status unknown: retain the token (no complete()); a same-
            // intent resubmit reuses it. Never fall back to any other path.
            window.toast('Falha de conexão. A operação pode não ter sido concluída — tente novamente.', 'error');
            return false;
          }
          // Deterministic rejection / hard failure: new token next submission.
          registrationTracker.complete();
          window.toast(rejectionMessage(res), 'error');
          return false;
        },
      });
    }

    // ---- Metadata correction modal (db/119) ---------------------------
    //
    // Corrects ONLY the four administrative fields of an existing receipt.
    // It creates no receipt, triggers no reversal, moves no kilogram and never
    // opens the R12 production-review continuation — nothing productive
    // changed, so offering to "review production" would be a lie.
    //
    // No idempotency tracker: the command is naturally idempotent (it sets the
    // four values absolutely), so there is no ambiguous-commit window to
    // protect and no token to retain.
    function editarMetadadosRecebimento(comando) {
      var hist = state.receiptHistory;
      if (!hist || hist.ok !== true || hist.ator_tipo !== 'admin' || comando.comando_tipo !== 'recebimento') {
        window.toast('Edição de dados do recebimento indisponível.', 'error');
        return;
      }

      // Pre-filled with the CURRENT values. `ocorrido_em` arrives as an ISO
      // timestamp; the date control owns only the calendar day.
      var dateInput = window.textInput({
        type: 'date',
        value: comando.ocorrido_em ? String(comando.ocorrido_em).slice(0, 10) : '',
      });
      var docInput = window.textInput({
        placeholder: 'Documento / referência (opcional)',
        value: comando.documento_ref || '',
      });
      var origemTipoInput = window.textInput({
        placeholder: 'Ex.: nota_fiscal',
        value: comando.origem_tipo || '',
      });
      var origemRefInput = window.textInput({
        placeholder: 'Referência de origem (opcional)',
        value: comando.origem_ref || '',
      });

      var body = el('div', {});
      body.appendChild(el('div', { class: 'mb-3', style: 'font-size:var(--rv-fs-body);color:var(--rv-text-secondary);' },
        'As quantidades, alocações, excedente e OPs deste recebimento não são alteradas por esta edição.'));
      body.appendChild(window.formField({ label: 'Data do recebimento', input: dateInput }));
      body.appendChild(window.formField({ label: 'Documento', input: docInput }));
      body.appendChild(window.formField({ label: 'Tipo de origem', input: origemTipoInput }));
      body.appendChild(window.formField({ label: 'Referência de origem', input: origemRefInput }));

      window.modal({
        title: 'Editar dados do recebimento',
        body: body,
        saveLabel: 'Salvar',
        onSave: async function () {
          if (!dateInput.value) {
            window.toast('Informe a data do recebimento.', 'error');
            return false;
          }
          if (!String(origemTipoInput.value || '').trim()) {
            window.toast('Informe o tipo de origem.', 'error');
            return false;
          }
          var res = await ns.corrigirMetadadosRecebimento({
            recebimentoId: comando.id,
            ocorridoEm: dateInput.value,
            documentoRef: docInput.value || null,
            origemTipo: origemTipoInput.value,
            origemRef: origemRefInput.value || null,
          });
          if (res.outcome === 'success') {
            // Authoritative reload: the corrected values are read back from
            // the server projection, never patched into local state.
            await reload();
            window.toast('Dados do recebimento atualizados.', 'success');
            return; // closes the modal
          }
          if (res.outcome === 'ambiguous') {
            window.toast('Falha de conexão. Recarregue a ordem para conferir se a alteração foi aplicada.', 'error');
            return false;
          }
          window.toast(rejectionMessage(res), 'error');
          return false;
        },
      });
    }

    // ---- Reversal modal ----------------------------------------------
    function estornarLancamento(comando, lanc) {
      var hist = state.receiptHistory;
      if (!hist || !(hist.acoes && hist.acoes.estornar) || !(Number(lanc.kg_reversivel) > 0)) {
        window.toast('Estorno indisponível para este lançamento.', 'error');
        return;
      }

      var kgInput = window.textInput({ value: '', placeholder: '0,000' });
      kgInput.setAttribute('data-reversal-kg', String(lanc.id));
      // DATA DO ESTORNO — entrada OBRIGATÓRIA do escritor, não opcional da
      // tela. `_c3c_estornar_recebimento_impl` recusa com `comando_invalido`
      // quando p_estornado_em chega NULL:
      //   IF p_idempotency_key IS NULL ... OR p_estornado_em IS NULL
      //      OR p_motivo IS NULL ... THEN 'comando_invalido'
      // O modal não coletava este campo e o handler não o enviava, então TODO
      // estorno era recusado antes de qualquer escrita. Mesmo primitivo e
      // mesmo default do modal de recebimento, que sempre enviou a data.
      var dataInput = window.textInput({ type: 'date', value: todayIso() });
      dataInput.setAttribute('data-reversal-date', String(lanc.id));
      // B1: a row-sized textarea declares no minimum — the rows attribute is
      // its geometry — so it takes the canonical `rows` role. The reversal
      // reason itself, its placeholder and the submit handling that reads it
      // are unchanged; the two deprecated compatibility tokens it used to
      // reference (--rv-border-strong, --rv-radius) are retired
      // with the inline style, because css/tokens.css now owns the border.
      var motivoInput = window.textArea({
        role: 'rows',
        rows: 3,
        placeholder: 'Motivo do estorno',
        ariaLabel: 'Motivo do estorno',
      });

      var body = el('div', {});
      body.appendChild(el('div', { class: 'mb-3', style: 'font-size:var(--rv-fs-body);color:var(--rv-text-secondary);' },
        'Lançamento #' + lanc.id + ' — ' + fioLabel(lanc) + ' · ' + opLabel(lanc.op_id)
        + ' · reversível ' + fmtKg(lanc.kg_reversivel) + '.'));
      body.appendChild(window.formField({ label: 'Data do estorno', input: dataInput }));
      body.appendChild(window.formField({ label: 'Quantidade a estornar (kg)', input: kgInput }));
      body.appendChild(window.formField({ label: 'Motivo', input: motivoInput }));

      var modalRef = window.modal({
        title: 'Estornar recebimento',
        body: body,
        saveLabel: 'Estornar',
        danger: true,
        onClose: function () { reversalTracker.complete(); },
        onSave: function () {
          var kg = ns.parseKgInput(kgInput.value);
          var motivo = String(motivoInput.value || '').trim();
          var ocorridoEm = String(dataInput.value || '').trim();
          if (!(kg > 0)) { window.toast('Informe uma quantidade válida.', 'error'); return false; }
          if (kg > Number(lanc.kg_reversivel)) { window.toast('Quantidade acima do saldo reversível.', 'error'); return false; }
          if (!motivo) { window.toast('Informe o motivo do estorno.', 'error'); return false; }
          // A data é exigida pelo servidor; recusar aqui evita gastar uma
          // tentativa e um `comando_invalido` que o operador não conseguiria
          // interpretar.
          if (!ocorridoEm) { window.toast('Informe a data do estorno.', 'error'); return false; }

          // Guard 6 (§8.1): confirmDialog before execution — reversal never
          // fires on a single click. Executed inside onConfirm; the reversal
          // modal is kept open (onSave returns false) and is closed on
          // success. Cancelling the confirm leaves the reversal modal open.
          window.confirmDialog({
            title: 'Confirmar estorno',
            message: 'Estornar ' + fmtKg(kg) + ' do lançamento #' + lanc.id + '? Esta ação é irreversível.',
            confirmLabel: 'Estornar',
            onConfirm: async function () {
              var params = {
                ordemId: ordemId,
                ocorridoEm: ocorridoEm,
                motivo: motivo,
                linhas: ns.buildReversalLinhas(lanc.id, kg),
              };
              // A data entra na INTENÇÃO: mudar a data é um comando diferente
              // e tem de cunhar um token novo, como kg e motivo já faziam.
              var intent = { ordemId: ordemId, lancamentoId: lanc.id, kg: kg, motivo: motivo, ocorridoEm: ocorridoEm };
              var attempt = reversalTracker.resolveAttempt(intent);
              var res = await ns.estornarRecebimento(params, attempt);
              if (res.outcome === 'success') {
                reversalTracker.complete();
                window.toast('Estorno registrado.', 'success');
                modalRef.close();
                await reload();
                return;
              }
              if (res.outcome === 'ambiguous') {
                window.toast('Falha de conexão. A operação pode não ter sido concluída — tente novamente.', 'error');
                return; // retain token; reversal modal stays open
              }
              reversalTracker.complete();
              window.toast(rejectionMessage(res, 'estorno'), 'error');
            },
          });
          return false;
        },
      });
    }

    return {
      abrirRegistroRecebimento: abrirRegistroRecebimento,
      estornarLancamento: estornarLancamento,
      editarMetadadosRecebimento: editarMetadadosRecebimento,
      // R12 exposto para prova direta do roteamento, sem renderizar o modal
      // de registro inteiro.
      opsAfetadasDoResultado: opsAfetadasDoResultado,
      classificarDestinos: classificarDestinos,
      rotaContinuacao: rotaContinuacao,
      abrirContinuacaoProducao: abrirContinuacaoProducao,
    };
  };
})(window);
