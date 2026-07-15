// =====================================================================
// === DOCUMENT LINK ADMIN MODAL (G28-B8) ==============================
// Administrative surface over the canonical link revisions of one document:
//   - inspect the current active links;
//   - inspect the full append-only revision history (audit);
//   - correct the complete link set (Pedido 0..1 / OP 0..N);
//   - explicitly unlink (revoke all links -> empty state);
//   - restore a valid historical revision.
//
// Pure, dependency-injected DOM (options.document). Emits structured intents
// via handlers (onCorrect / onUnlink / onRestore / onCancel); it performs NO
// Supabase, RPC, write, localStorage or link inference. The Ingestor
// suggestion (pedido_manual) is shown read-only and never treated as a link.
//
// Fail-closed: when the audit history is unavailable or still loading, all
// mutating actions are disabled — an admin cannot correct/unlink/restore
// without a trustworthy current state and expected active revision.
//
// A human reason is required for every mutating action (correction, unlink,
// restoration) so the audit trail always records why the state changed.
// =====================================================================

(function (window) {
  'use strict';

  var ns = window.RAVATEX_DOCUMENTS || {};

  function createDocumentLinkAdminModal(options) {
    options = options || {};
    var doc = options.document || window.document;
    var prefix = 'r8x-la';

    var overlay = null;
    var _isOpen = false;
    var _opener = null;
    var _handlers = null;
    var _elements = {};
    var _busy = false;
    var _listeners = [];
    var _targets = { pedidos: [], ops: [] };
    var _audit = null;
    var _selectedRestoreSource = null;
    var _actionsEnabled = false;

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
      overlay.className = 'r8x-linkadmin-overlay';

      var card = doc.createElement('div');
      card.className = 'r8x-linkadmin-card';

      var title = doc.createElement('h2');
      title.id = prefix + '-title';
      title.textContent = 'Histórico e vínculos do documento';
      card.appendChild(title);

      var docLine = doc.createElement('p');
      docLine.id = prefix + '-doc-line';
      card.appendChild(docLine);

      var suggestionEl = doc.createElement('p');
      suggestionEl.id = prefix + '-suggestion';
      suggestionEl.className = 'r8x-linkadmin-suggestion';
      card.appendChild(suggestionEl);

      // --- Current active links -------------------------------------------
      var currentTitle = doc.createElement('h3');
      currentTitle.textContent = 'Vínculos confirmados (ativos)';
      card.appendChild(currentTitle);

      var currentEl = doc.createElement('div');
      currentEl.id = prefix + '-current';
      currentEl.className = 'r8x-linkadmin-current';
      card.appendChild(currentEl);

      // --- Unavailable / fail-closed banner -------------------------------
      var unavailableEl = doc.createElement('div');
      unavailableEl.id = prefix + '-unavailable';
      unavailableEl.className = 'r8x-linkadmin-unavailable';
      unavailableEl.setAttribute('role', 'status');
      card.appendChild(unavailableEl);

      // --- Audit history --------------------------------------------------
      var historyTitle = doc.createElement('h3');
      historyTitle.textContent = 'Linha do tempo (auditoria)';
      card.appendChild(historyTitle);

      var historyEl = doc.createElement('div');
      historyEl.id = prefix + '-history';
      historyEl.className = 'r8x-linkadmin-history';
      card.appendChild(historyEl);

      // --- Correction editor ----------------------------------------------
      var correctionTitle = doc.createElement('h3');
      correctionTitle.textContent = 'Corrigir vínculos';
      card.appendChild(correctionTitle);

      var correctionSection = doc.createElement('div');
      correctionSection.id = prefix + '-correction';
      correctionSection.className = 'r8x-linkadmin-correction';

      var pedidoLabel = doc.createElement('label');
      pedidoLabel.setAttribute('for', prefix + '-pedido');
      pedidoLabel.textContent = 'Pedido confirmado';
      correctionSection.appendChild(pedidoLabel);

      var pedidoSelect = doc.createElement('select');
      pedidoSelect.id = prefix + '-pedido';
      correctionSection.appendChild(pedidoSelect);

      var opLabel = doc.createElement('div');
      opLabel.className = 'r8x-linkadmin-op-label';
      opLabel.textContent = 'OPs confirmadas';
      correctionSection.appendChild(opLabel);

      var opList = doc.createElement('div');
      opList.id = prefix + '-oplist';
      opList.className = 'r8x-linkadmin-oplist';
      correctionSection.appendChild(opList);

      card.appendChild(correctionSection);

      // --- Reason (required for every mutating action) --------------------
      var reasonLabel = doc.createElement('label');
      reasonLabel.setAttribute('for', prefix + '-reason');
      reasonLabel.textContent = 'Motivo (obrigatório)';
      card.appendChild(reasonLabel);

      var reasonTa = doc.createElement('textarea');
      reasonTa.id = prefix + '-reason';
      reasonTa.rows = 2;
      card.appendChild(reasonTa);

      var errorEl = doc.createElement('div');
      errorEl.id = prefix + '-error';
      errorEl.setAttribute('role', 'alert');
      card.appendChild(errorEl);

      var outcomeEl = doc.createElement('div');
      outcomeEl.id = prefix + '-outcome';
      outcomeEl.setAttribute('aria-live', 'polite');
      card.appendChild(outcomeEl);

      // --- Buttons --------------------------------------------------------
      var btnGroup = doc.createElement('div');
      btnGroup.className = 'r8x-linkadmin-buttons';

      var correctBtn = doc.createElement('button');
      correctBtn.type = 'button';
      correctBtn.id = prefix + '-correct';
      correctBtn.setAttribute('data-action', 'corrigir-vinculos');
      correctBtn.textContent = 'Aplicar correção';

      var unlinkBtn = doc.createElement('button');
      unlinkBtn.type = 'button';
      unlinkBtn.id = prefix + '-unlink';
      unlinkBtn.setAttribute('data-action', 'desvincular');
      unlinkBtn.textContent = 'Desvincular';

      var restoreBtn = doc.createElement('button');
      restoreBtn.type = 'button';
      restoreBtn.id = prefix + '-restore';
      restoreBtn.setAttribute('data-action', 'restaurar-revisao');
      restoreBtn.textContent = 'Restaurar selecionada';

      var cancelBtn = doc.createElement('button');
      cancelBtn.type = 'button';
      cancelBtn.id = prefix + '-cancel';
      cancelBtn.setAttribute('data-action', 'cancelar');
      cancelBtn.textContent = 'Fechar';

      btnGroup.appendChild(correctBtn);
      btnGroup.appendChild(unlinkBtn);
      btnGroup.appendChild(restoreBtn);
      btnGroup.appendChild(cancelBtn);
      card.appendChild(btnGroup);

      overlay.appendChild(card);

      _elements = {
        card: card, title: title, docLine: docLine, suggestionEl: suggestionEl,
        currentEl: currentEl, unavailableEl: unavailableEl, historyEl: historyEl,
        correctionSection: correctionSection, pedidoSelect: pedidoSelect, opList: opList,
        reasonTa: reasonTa, errorEl: errorEl, outcomeEl: outcomeEl,
        correctBtn: correctBtn, unlinkBtn: unlinkBtn, restoreBtn: restoreBtn, cancelBtn: cancelBtn,
      };

      addListener(cancelBtn, 'click', function () { handleCancelRequest(); });
      addListener(pedidoSelect, 'change', function () { rebuildOpList(); });
      addListener(correctBtn, 'click', function () { runAction('correct'); });
      addListener(unlinkBtn, 'click', function () { runAction('unlink'); });
      addListener(restoreBtn, 'click', function () { runAction('restore'); });
      addListener(doc, 'keydown', handleKeyDown);
    }

    function getReason() {
      return (_elements.reasonTa && typeof _elements.reasonTa.value === 'string')
        ? _elements.reasonTa.value.trim() : '';
    }

    function getSelectedPedidoId() {
      var v = _elements.pedidoSelect ? _elements.pedidoSelect.value : '';
      return v === '' ? null : v;
    }

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
        row.className = 'r8x-linkadmin-op-row';
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
        emptyEl.className = 'r8x-linkadmin-op-empty';
        emptyEl.textContent = selectedPedido
          ? 'Nenhuma OP compatível com este Pedido.'
          : 'Nenhuma OP avulsa disponível.';
        listEl.appendChild(emptyEl);
      }
    }

    function pedidoLabelFor(pedidoId) {
      var pedidos = _targets.pedidos || [];
      for (var i = 0; i < pedidos.length; i++) {
        if (String(pedidos[i].id) === String(pedidoId)) {
          var p = pedidos[i];
          return 'Pedido' + (p.numero != null ? (' #' + p.numero) : (' ' + p.id));
        }
      }
      return 'Pedido ' + pedidoId;
    }

    function renderCurrent(active) {
      var el = _elements.currentEl;
      if (typeof el.replaceChildren === 'function') el.replaceChildren();
      else el.children = [];
      if (!active) {
        el.appendChild(doc.createTextNode('Sem vínculos confirmados ativos.'));
        return;
      }
      var line = 'Revisão ' + (active.version != null ? active.version : '?') + ' — ';
      line += active.pedido_id ? pedidoLabelFor(active.pedido_id) : 'sem Pedido';
      if (active.op_ids && active.op_ids.length) {
        line += ' · OPs: ' + active.op_ids.join(', ');
      } else {
        line += ' · sem OPs';
      }
      el.appendChild(doc.createTextNode(line));
    }

    function renderHistory(audit) {
      var el = _elements.historyEl;
      if (typeof el.replaceChildren === 'function') el.replaceChildren();
      else el.children = [];
      _selectedRestoreSource = null;

      var entries = (audit && Array.isArray(audit.entries)) ? audit.entries : [];
      if (entries.length === 0) {
        el.appendChild(doc.createTextNode('Sem revisões registradas.'));
        return;
      }
      if (audit.integrity === 'multiple_active') {
        var warn = doc.createElement('p');
        warn.className = 'r8x-linkadmin-integrity';
        warn.setAttribute('role', 'alert');
        warn.textContent = 'Anomalia: mais de uma revisão ativa. Recarregue antes de agir.';
        el.appendChild(warn);
      }

      for (var i = 0; i < entries.length; i++) {
        var entry = entries[i];
        var row = doc.createElement('div');
        row.className = 'r8x-linkadmin-history-row';
        row.setAttribute('data-revision-id', entry.revision_id || '');
        row.setAttribute('data-active', entry.active ? 'true' : 'false');

        var state = entry.active ? 'ATIVA' : 'revogada';
        var pedidoTxt = entry.pedido_id ? pedidoLabelFor(entry.pedido_id) : 'sem Pedido';
        var opsTxt = (entry.op_ids && entry.op_ids.length) ? entry.op_ids.join(', ') : '—';
        var text = 'v' + (entry.version != null ? entry.version : '?') + ' · ' + state
          + ' · ' + entry.kind + ' · ' + pedidoTxt + ' · OPs: ' + opsTxt;
        if (entry.reason) text += ' · motivo: ' + entry.reason;
        if (entry.restored_from_revision_id) text += ' · restaurada de ' + entry.restored_from_revision_id;
        var meta = doc.createElement('span');
        meta.className = 'r8x-linkadmin-history-meta';
        meta.textContent = text;
        row.appendChild(meta);

        // Only historical (revoked) revisions are restore candidates.
        if (!entry.active && entry.revision_id) {
          var radioLabel = doc.createElement('label');
          var radio = doc.createElement('input');
          radio.type = 'radio';
          radio.name = prefix + '-restore-source';
          radio.value = entry.revision_id;
          radio.setAttribute('data-role', 'restore-source');
          (function (revId, radioEl) {
            addListener(radioEl, 'change', function () {
              if (radioEl.checked) _selectedRestoreSource = revId;
            });
          })(entry.revision_id, radio);
          radioLabel.appendChild(radio);
          radioLabel.appendChild(doc.createTextNode(' Restaurar esta revisão'));
          row.appendChild(radioLabel);
        }
        el.appendChild(row);
      }
    }

    function populatePedidoSelect() {
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
    }

    function setActionsEnabled(enabled) {
      _actionsEnabled = enabled;
      if (_elements.correctBtn) _elements.correctBtn.disabled = !enabled;
      if (_elements.unlinkBtn) _elements.unlinkBtn.disabled = !enabled;
      if (_elements.restoreBtn) _elements.restoreBtn.disabled = !enabled;
      if (_elements.pedidoSelect) _elements.pedidoSelect.disabled = !enabled;
      if (_elements.reasonTa) _elements.reasonTa.disabled = !enabled;
      if (_elements.opList) {
        var boxes = collectCheckboxes(_elements.opList);
        for (var i = 0; i < boxes.length; i++) boxes[i].disabled = !enabled;
      }
    }

    function applyAuditState() {
      var audit = _audit || { state: 'unavailable', entries: [] };
      var state = audit.state;
      var active = null;
      if (state === 'available') {
        for (var i = 0; i < audit.entries.length; i++) {
          if (audit.entries[i].active) { active = audit.entries[i]; break; }
        }
      }

      renderHistory(audit);
      renderCurrent(active);

      var unavailableEl = _elements.unavailableEl;
      if (state === 'loading') {
        unavailableEl.textContent = 'Carregando histórico...';
        setActionsEnabled(false);
      } else if (state === 'unavailable') {
        unavailableEl.textContent = 'Histórico indisponível. Não é possível administrar vínculos com segurança.';
        setActionsEnabled(false);
      } else if (audit.integrity === 'multiple_active') {
        unavailableEl.textContent = 'Estado inconsistente. Recarregue antes de agir.';
        setActionsEnabled(false);
      } else {
        unavailableEl.textContent = '';
        setActionsEnabled(true);
      }
    }

    function runAction(kind) {
      if (_busy || !_actionsEnabled) return;
      _elements.errorEl.textContent = '';
      if (!_handlers) return;

      var reason = getReason();
      if (!reason) {
        _elements.errorEl.textContent = 'Informe o motivo desta ação.';
        return;
      }

      if (kind === 'correct') {
        if (typeof _handlers.onCorrect !== 'function') return;
        _handlers.onCorrect({
          pedidoId: getSelectedPedidoId(),
          opIds: getSelectedOpIds(),
          reason: reason,
        });
        return;
      }
      if (kind === 'unlink') {
        if (typeof _handlers.onUnlink !== 'function') return;
        _handlers.onUnlink({ reason: reason });
        return;
      }
      if (kind === 'restore') {
        if (typeof _handlers.onRestore !== 'function') return;
        if (!_selectedRestoreSource) {
          _elements.errorEl.textContent = 'Selecione uma revisão do histórico para restaurar.';
          return;
        }
        _handlers.onRestore({ sourceRevisionId: _selectedRestoreSource, reason: reason });
        return;
      }
    }

    function handleCancelRequest() {
      if (_busy) return;
      var shouldClose = true;
      if (_handlers && _handlers.onCancel) {
        var result = _handlers.onCancel();
        if (result === false || (result && result.closeModal === false)) shouldClose = false;
      }
      if (shouldClose) close();
    }

    function handleKeyDown(e) {
      if (!_isOpen) return;
      if (e.key === 'Escape') { e.preventDefault(); handleCancelRequest(); return; }
      if (e.key === 'Tab') { trapFocus(e); }
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
        if (idx <= 0) { e.preventDefault(); focusable[focusable.length - 1].focus(); }
      } else {
        if (idx === -1 || idx === focusable.length - 1) { e.preventDefault(); focusable[0].focus(); }
      }
    }

    function open(model, handlers) {
      if (_isOpen) close();
      _opener = doc.activeElement;
      _handlers = handlers || {};

      if (!overlay) build();

      model = model || {};
      _targets = model.linkTargets || { pedidos: [], ops: [] };
      if (!_targets.pedidos) _targets.pedidos = [];
      if (!_targets.ops) _targets.ops = [];
      _audit = model.audit || { state: 'unavailable', entries: [] };
      _selectedRestoreSource = null;

      _elements.docLine.textContent = 'Documento: ' + ((model && model.documentId) || '');
      _elements.suggestionEl.textContent = model.suggestion
        ? ('Sugestão do Ingestor: ' + model.suggestion + ' (não é vínculo)')
        : 'Sugestão do Ingestor: nenhuma';
      _elements.reasonTa.value = '';
      _elements.errorEl.textContent = '';
      _elements.outcomeEl.textContent = '';

      populatePedidoSelect();
      rebuildOpList();
      applyAuditState();

      doc.body.appendChild(overlay);
      _isOpen = true;

      setTimeout(function () {
        if (_elements.reasonTa && typeof _elements.reasonTa.focus === 'function') {
          _elements.reasonTa.focus();
        }
      }, 0);
    }

    function setBusy(busy) {
      _busy = busy;
      _elements.correctBtn.disabled = busy || !_actionsEnabled;
      _elements.unlinkBtn.disabled = busy || !_actionsEnabled;
      _elements.restoreBtn.disabled = busy || !_actionsEnabled;
      _elements.cancelBtn.disabled = busy;
      if (_elements.pedidoSelect) _elements.pedidoSelect.disabled = busy || !_actionsEnabled;
      if (_elements.reasonTa) _elements.reasonTa.disabled = busy || !_actionsEnabled;
      if (_elements.opList) {
        var boxes = collectCheckboxes(_elements.opList);
        for (var i = 0; i < boxes.length; i++) boxes[i].disabled = busy || !_actionsEnabled;
      }
    }

    function setError(message) { _elements.errorEl.textContent = message || ''; }

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
      _audit = null;
      _selectedRestoreSource = null;
      _actionsEnabled = false;
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

  ns.createDocumentLinkAdminModal = createDocumentLinkAdminModal;
  window.RAVATEX_DOCUMENTS = ns;
})(window);
