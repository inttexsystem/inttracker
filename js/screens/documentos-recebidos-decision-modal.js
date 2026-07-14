(function (window) {
  'use strict';

  var ns = window.RAVATEX_DOCUMENTS || {};

  // Types for which an expected canonical link (Pedido) is normally present.
  // Absence only produces a non-blocking warning; it never blocks the action
  // and never enforces a database NOT NULL linkage.
  function isExpectedLinkType(tipo) {
    if (typeof tipo !== 'string') return false;
    var t = tipo.toLowerCase();
    return t.indexOf('nf') === 0 || t === 'romaneio';
  }

  function createDocumentDecisionModal(options) {
    options = options || {};
    var doc = options.document || window.document;
    var prefix = 'r8x-dm';

    var overlay = null;
    var _isOpen = false;
    var _opener = null;
    var _handlers = null;
    var _elements = {};
    var _busy = false;
    var _listeners = [];
    var _targets = { pedidos: [], ops: [] };
    var _tipoDocumento = null;
    var _expectedActiveRevisionId = null;

    function addListener(el, type, fn) {
      el.addEventListener(type, fn);
      _listeners.push({ el: el, type: type, fn: fn });
    }

    function removeAllListeners() {
      for (var i = 0; i < _listeners.length; i++) {
        var l = _listeners[i];
        try { l.el.removeEventListener(l.type, l.fn); } catch (_) {}
      }
      _listeners = [];
    }

    function build() {
      overlay = doc.createElement('div');
      overlay.setAttribute('role', 'dialog');
      overlay.setAttribute('aria-modal', 'true');
      overlay.setAttribute('aria-labelledby', prefix + '-title');
      overlay.setAttribute('aria-describedby', prefix + '-error ' + prefix + '-outcome');
      overlay.className = 'r8x-decision-overlay';

      var card = doc.createElement('div');
      card.className = 'r8x-decision-card';

      var title = doc.createElement('h2');
      title.id = prefix + '-title';
      title.textContent = 'Decidir e vincular documento';
      card.appendChild(title);

      var docLine = doc.createElement('p');
      docLine.id = prefix + '-doc-line';
      card.appendChild(docLine);

      var decGroup = doc.createElement('div');
      decGroup.className = 'r8x-decision-group';

      var acceptLabel = doc.createElement('label');
      var acceptRadio = doc.createElement('input');
      acceptRadio.type = 'radio';
      acceptRadio.name = prefix + '-decision';
      acceptRadio.value = 'accepted';
      acceptLabel.appendChild(acceptRadio);
      acceptLabel.appendChild(doc.createTextNode(' Validar e vincular'));

      var rejectLabel = doc.createElement('label');
      var rejectRadio = doc.createElement('input');
      rejectRadio.type = 'radio';
      rejectRadio.name = prefix + '-decision';
      rejectRadio.value = 'rejected';
      rejectLabel.appendChild(rejectRadio);
      rejectLabel.appendChild(doc.createTextNode(' Rejeitar'));

      decGroup.appendChild(acceptLabel);
      decGroup.appendChild(rejectLabel);
      card.appendChild(decGroup);

      // --- Link section (shown for the accept path) -------------------------
      var linkSection = doc.createElement('div');
      linkSection.id = prefix + '-link-section';
      linkSection.className = 'r8x-link-section';

      // Ingestor suggestion, read-only and visibly separate from the human
      // confirmed link. Never auto-selected.
      var suggestionEl = doc.createElement('p');
      suggestionEl.id = prefix + '-suggestion';
      suggestionEl.className = 'r8x-link-suggestion';
      linkSection.appendChild(suggestionEl);

      var pedidoLabel = doc.createElement('label');
      pedidoLabel.setAttribute('for', prefix + '-pedido');
      pedidoLabel.textContent = 'Pedido confirmado';
      linkSection.appendChild(pedidoLabel);

      var pedidoSelect = doc.createElement('select');
      pedidoSelect.id = prefix + '-pedido';
      linkSection.appendChild(pedidoSelect);

      var opLabel = doc.createElement('div');
      opLabel.id = prefix + '-op-label';
      opLabel.className = 'r8x-link-op-label';
      opLabel.textContent = 'OPs confirmadas';
      linkSection.appendChild(opLabel);

      var opList = doc.createElement('div');
      opList.id = prefix + '-oplist';
      opList.className = 'r8x-link-oplist';
      linkSection.appendChild(opList);

      var linkWarning = doc.createElement('div');
      linkWarning.id = prefix + '-link-warning';
      linkWarning.className = 'r8x-link-warning';
      linkWarning.setAttribute('role', 'status');
      linkSection.appendChild(linkWarning);

      card.appendChild(linkSection);

      // --- Motivo (shown for the reject path) --------------------------------
      var motivoGroup = doc.createElement('div');
      motivoGroup.className = 'r8x-motivo-group';
      motivoGroup.id = prefix + '-motivo-group';
      var motivoLabel = doc.createElement('label');
      motivoLabel.setAttribute('for', prefix + '-motivo');
      motivoLabel.textContent = 'Motivo';
      motivoGroup.appendChild(motivoLabel);
      var motivoTa = doc.createElement('textarea');
      motivoTa.id = prefix + '-motivo';
      motivoTa.rows = 3;
      motivoGroup.appendChild(motivoTa);
      card.appendChild(motivoGroup);

      var errorEl = doc.createElement('div');
      errorEl.id = prefix + '-error';
      errorEl.setAttribute('role', 'alert');
      card.appendChild(errorEl);

      var outcomeEl = doc.createElement('div');
      outcomeEl.id = prefix + '-outcome';
      outcomeEl.setAttribute('aria-live', 'polite');
      card.appendChild(outcomeEl);

      var btnGroup = doc.createElement('div');
      btnGroup.className = 'r8x-decision-buttons';

      var cancelBtn = doc.createElement('button');
      cancelBtn.type = 'button';
      cancelBtn.id = prefix + '-cancel';
      cancelBtn.textContent = 'Cancelar';

      var confirmBtn = doc.createElement('button');
      confirmBtn.type = 'button';
      confirmBtn.id = prefix + '-confirm';
      confirmBtn.textContent = 'Confirmar';

      btnGroup.appendChild(cancelBtn);
      btnGroup.appendChild(confirmBtn);
      card.appendChild(btnGroup);

      overlay.appendChild(card);

      _elements = {
        card: card,
        title: title,
        docLine: docLine,
        acceptRadio: acceptRadio,
        rejectRadio: rejectRadio,
        linkSection: linkSection,
        suggestionEl: suggestionEl,
        pedidoSelect: pedidoSelect,
        opLabel: opLabel,
        opList: opList,
        linkWarning: linkWarning,
        motivoTa: motivoTa,
        motivoGroup: motivoGroup,
        errorEl: errorEl,
        outcomeEl: outcomeEl,
        cancelBtn: cancelBtn,
        confirmBtn: confirmBtn,
      };

      addListener(cancelBtn, 'click', function () {
        handleCancelRequest();
      });

      addListener(acceptRadio, 'change', syncSections);
      addListener(rejectRadio, 'change', syncSections);
      addListener(pedidoSelect, 'change', function () {
        rebuildOpList();
        updateWarning();
      });

      addListener(confirmBtn, 'click', function () {
        if (_busy || confirmBtn.disabled) return;
        _elements.errorEl.textContent = '';
        if (!_handlers || !_handlers.onConfirm) return;

        var decision = acceptRadio.checked ? 'accepted' : (rejectRadio.checked ? 'rejected' : null);
        if (decision === 'rejected' && motivoTa.value.trim() === '') {
          _elements.errorEl.textContent = 'Informe o motivo da rejeição.';
          return;
        }

        var pedidoId = decision === 'accepted' ? (getSelectedPedidoId()) : null;
        var opIds = decision === 'accepted' ? getSelectedOpIds() : [];

        _handlers.onConfirm({
          decision: decision,
          motivo: motivoTa.value,
          pedidoId: pedidoId,
          opIds: opIds,
          expectedActiveRevisionId: _expectedActiveRevisionId,
        });
      });

      addListener(doc, 'keydown', handleKeyDown);
    }

    function getSelectedPedidoId() {
      var v = _elements.pedidoSelect ? _elements.pedidoSelect.value : '';
      return v === '' ? null : v;
    }

    // Recursive checkbox collector — avoids a hard dependency on
    // querySelectorAll so the modal works with any node exposing `.children`.
    function collectCheckboxes(root) {
      var out = [];
      (function walk(n) {
        if (!n || typeof n !== 'object') return;
        if (n.tagName === 'INPUT' && n.type === 'checkbox') out.push(n);
        var kids = n.children || [];
        for (var i = 0; i < kids.length; i++) walk(kids[i]);
      })(root);
      return out;
    }

    function getSelectedOpIds() {
      var out = [];
      if (!_elements.opList) return out;
      var boxes = collectCheckboxes(_elements.opList);
      for (var i = 0; i < boxes.length; i++) {
        if (boxes[i].checked) {
          var n = parseInt(boxes[i].value, 10);
          if (!isNaN(n)) out.push(n);
        }
      }
      return out;
    }

    function syncSections() {
      var showLinks = _elements.acceptRadio.checked;
      var showMotivo = _elements.rejectRadio.checked;
      if (_elements.linkSection) _elements.linkSection.style.display = showLinks ? '' : 'none';
      if (_elements.motivoGroup) _elements.motivoGroup.style.display = showMotivo ? '' : 'none';
      updateWarning();
    }

    function opLabelText(op) {
      var numero = (op.numero != null ? op.numero : op.id);
      var ano = op.ano != null ? ('/' + op.ano) : '';
      var tipo = op.tipo ? (' ' + op.tipo) : '';
      var status = op.status ? (' · ' + op.status) : '';
      return 'OP ' + numero + ano + tipo + status;
    }

    function rebuildOpList() {
      var listEl = _elements.opList;
      if (!listEl) return;
      var prevChecked = {};
      var existing = collectCheckboxes(listEl);
      for (var e = 0; e < existing.length; e++) {
        if (existing[e].checked) prevChecked[existing[e].value] = true;
      }
      if (typeof listEl.replaceChildren === 'function') listEl.replaceChildren();
      else listEl.children = [];

      var selectedPedido = getSelectedPedidoId();
      var ops = _targets.ops || [];
      var shown = 0;
      for (var i = 0; i < ops.length; i++) {
        var op = ops[i];
        var opPedido = op.pedido_id || null;
        // Compatibility filter mirrors the canonical RPC rule:
        //  - Pedido selected -> only OPs owned by that Pedido
        //  - no Pedido       -> only genuinely avulsa OPs
        var compatible = selectedPedido ? (opPedido === selectedPedido) : (opPedido === null);
        if (!compatible) continue;
        shown++;

        var row = doc.createElement('label');
        row.className = 'r8x-link-op-row';
        var box = doc.createElement('input');
        box.type = 'checkbox';
        box.value = String(op.id);
        box.name = prefix + '-op';
        if (prevChecked[String(op.id)]) box.checked = true;
        row.appendChild(box);
        row.appendChild(doc.createTextNode(' ' + opLabelText(op)));
        listEl.appendChild(row);
      }

      if (shown === 0) {
        var emptyEl = doc.createElement('p');
        emptyEl.className = 'r8x-link-op-empty';
        emptyEl.textContent = selectedPedido
          ? 'Nenhuma OP compatível com este Pedido.'
          : 'Nenhuma OP avulsa disponível.';
        listEl.appendChild(emptyEl);
      }
    }

    function updateWarning() {
      var warnEl = _elements.linkWarning;
      if (!warnEl) return;
      var accepting = _elements.acceptRadio.checked;
      var noPedido = getSelectedPedidoId() === null;
      if (accepting && noPedido && isExpectedLinkType(_tipoDocumento)) {
        warnEl.textContent = 'Documento fiscal ou romaneio sem Pedido vinculado. Vincule um Pedido ou confirme mesmo assim.';
      } else {
        warnEl.textContent = '';
      }
    }

    function populateLinkFields(model) {
      _targets = (model && model.linkTargets) || { pedidos: [], ops: [] };
      if (!_targets.pedidos) _targets.pedidos = [];
      if (!_targets.ops) _targets.ops = [];
      _tipoDocumento = (model && model.tipoDocumento) || null;
      var active = model && model.activeLink;
      _expectedActiveRevisionId = (active && typeof active.revision_id === 'string') ? active.revision_id : null;

      var suggestion = model && model.suggestion;
      _elements.suggestionEl.textContent = suggestion
        ? ('Sugestão do Ingestor: ' + suggestion)
        : 'Sugestão do Ingestor: nenhuma';

      // Pedido select: explicit "Nenhum" default. The suggestion is never
      // auto-selected.
      var sel = _elements.pedidoSelect;
      if (typeof sel.replaceChildren === 'function') sel.replaceChildren();
      else sel.children = [];
      var noneOpt = doc.createElement('option');
      noneOpt.value = '';
      noneOpt.textContent = 'Nenhum pedido';
      sel.appendChild(noneOpt);
      var pedidos = _targets.pedidos || [];
      for (var i = 0; i < pedidos.length; i++) {
        var p = pedidos[i];
        var opt = doc.createElement('option');
        opt.value = String(p.id);
        var label = 'Pedido' + (p.numero != null ? (' #' + p.numero) : (' ' + p.id));
        if (p.status) label += ' · ' + p.status;
        opt.textContent = label;
        sel.appendChild(opt);
      }
      sel.value = '';

      rebuildOpList();
    }

    function handleCancelRequest() {
      if (_busy) return;
      var shouldClose = true;
      if (_handlers && _handlers.onCancel) {
        var result = _handlers.onCancel();
        if (result === false || (result && result.closeModal === false)) {
          shouldClose = false;
        }
      }
      if (shouldClose) close();
    }

    function handleKeyDown(e) {
      if (!_isOpen) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        handleCancelRequest();
        return;
      }
      if (e.key === 'Tab') {
        trapFocus(e);
      }
    }

    function getFocusable() {
      if (!overlay) return [];
      var all = overlay.querySelectorAll('input, select, textarea, button, [tabindex]:not([tabindex="-1"])');
      var result = [];
      for (var i = 0; i < all.length; i++) {
        var el = all[i];
        if (el.type !== 'hidden' && !el.disabled) result.push(el);
      }
      return result;
    }

    function trapFocus(e) {
      var focusable = getFocusable();
      if (focusable.length === 0) { e.preventDefault(); return; }
      var active = doc.activeElement;
      var idx = -1;
      for (var i = 0; i < focusable.length; i++) {
        if (focusable[i] === active) { idx = i; break; }
      }
      if (e.shiftKey) {
        if (idx <= 0) {
          e.preventDefault();
          focusable[focusable.length - 1].focus();
        }
      } else {
        if (idx === -1 || idx === focusable.length - 1) {
          e.preventDefault();
          focusable[0].focus();
        }
      }
    }

    function open(model, handlers) {
      if (_isOpen) close();
      _opener = doc.activeElement;
      _handlers = handlers;

      if (!overlay) build();

      var docId = (model && model.documentId) || '';
      _elements.docLine.textContent = 'Documento: ' + docId;
      _elements.acceptRadio.checked = false;
      _elements.rejectRadio.checked = false;
      _elements.motivoTa.value = '';
      _elements.errorEl.textContent = '';
      _elements.outcomeEl.textContent = '';

      populateLinkFields(model);
      syncSections();

      doc.body.appendChild(overlay);
      _isOpen = true;

      setTimeout(function () {
        if (_elements.acceptRadio && typeof _elements.acceptRadio.focus === 'function') {
          _elements.acceptRadio.focus();
        }
      }, 0);
    }

    function setInteractiveDisabled(disabled) {
      if (_elements.pedidoSelect) _elements.pedidoSelect.disabled = disabled;
      if (_elements.motivoTa) _elements.motivoTa.disabled = disabled;
      if (_elements.acceptRadio) _elements.acceptRadio.disabled = disabled;
      if (_elements.rejectRadio) _elements.rejectRadio.disabled = disabled;
      if (_elements.opList) {
        var boxes = collectCheckboxes(_elements.opList);
        for (var i = 0; i < boxes.length; i++) boxes[i].disabled = disabled;
      }
    }

    function setBusy(busy) {
      _busy = busy;
      _elements.confirmBtn.disabled = busy;
      _elements.cancelBtn.disabled = busy;
      _elements.confirmBtn.textContent = busy ? 'Enviando...' : 'Confirmar';
      setInteractiveDisabled(busy);
    }

    function setError(message) {
      _elements.errorEl.textContent = message || '';
    }

    function setOutcome(message, tone) {
      _elements.outcomeEl.textContent = message || '';
      var color = '';
      if (tone === 'success') color = '#2e7d32';
      else if (tone === 'warning') color = '#f57f17';
      else if (tone === 'error') color = '#d32f2f';
      _elements.outcomeEl.style.color = color;
    }

    function close() {
      if (!_isOpen) return;
      removeAllListeners();
      if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
      overlay = null;
      _isOpen = false;
      _busy = false;
      _handlers = null;
      _targets = { pedidos: [], ops: [] };
      _tipoDocumento = null;
      _expectedActiveRevisionId = null;
      if (_opener && typeof _opener.focus === 'function') {
        try { _opener.focus(); } catch (_) {}
      }
      _opener = null;
    }

    function isOpen() { return _isOpen; }

    function destroy() {
      close();
      overlay = null;
      _elements = {};
      _listeners = [];
      _busy = false;
      _handlers = null;
      _opener = null;
    }

    return {
      open: open,
      setBusy: setBusy,
      setError: setError,
      setOutcome: setOutcome,
      close: close,
      isOpen: isOpen,
      destroy: destroy,
    };
  }

  ns.createDocumentDecisionModal = createDocumentDecisionModal;
  window.RAVATEX_DOCUMENTS = ns;
})(window);
