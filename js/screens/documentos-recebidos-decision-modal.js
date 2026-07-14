(function (window) {
  'use strict';

  var ns = window.RAVATEX_DOCUMENTS || {};

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

    function q(sel) {
      return overlay ? overlay.querySelector(sel) : null;
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
      title.textContent = 'Decidir Documento';
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
      acceptLabel.appendChild(doc.createTextNode(' Aceitar'));

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

      var motivoGroup = doc.createElement('div');
      motivoGroup.className = 'r8x-motivo-group';
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

      addListener(confirmBtn, 'click', function () {
        if (_busy || confirmBtn.disabled) return;
        _elements.errorEl.textContent = '';
        if (_handlers && _handlers.onConfirm) {
          var decision = acceptRadio.checked ? 'accepted' : (rejectRadio.checked ? 'rejected' : null);
          if (decision === 'rejected' && motivoTa.value.trim() === '') {
            _elements.errorEl.textContent = 'Informe o motivo da rejeição.';
            return;
          }
          _handlers.onConfirm({ decision: decision, motivo: motivoTa.value });
        }
      });

      addListener(doc, 'keydown', handleKeyDown);
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
      var all = overlay.querySelectorAll('input, textarea, button, [tabindex]:not([tabindex="-1"])');
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

      doc.body.appendChild(overlay);
      _isOpen = true;

      setTimeout(function () {
        if (_elements.acceptRadio && typeof _elements.acceptRadio.focus === 'function') {
          _elements.acceptRadio.focus();
        }
      }, 0);
    }

    function setBusy(busy) {
      _busy = busy;
      _elements.confirmBtn.disabled = busy;
      _elements.cancelBtn.disabled = busy;
      _elements.confirmBtn.textContent = busy ? 'Enviando...' : 'Confirmar';
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
