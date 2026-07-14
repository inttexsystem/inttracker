const { describe, test, before, mock } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');
const MODAL_PATH = path.join(ROOT, 'js', 'screens', 'documentos-recebidos-decision-modal.js');

var src;

function _matchesAttr(n, attr, val) {
  if (n._attrs && n._attrs[attr] === val) return true;
  if (attr === 'value' && n.value === val) return true;
  if (attr === 'type' && n.type === val) return true;
  if (attr === 'name' && n.name === val) return true;
  return false;
}
function _hasAttr(n, attr) {
  if (n._attrs && attr in n._attrs) return true;
  if (attr === 'value' && n.value !== undefined) return true;
  return false;
}

class FakeNode {
  constructor(tag) {
    this.tagName = (tag + '').toUpperCase();
    this.children = [];
    this._attrs = {};
    this._text = null;
    this.className = '';
    this.style = {};
    this.disabled = false;
    this.checked = false;
    this.value = '';
    this.type = '';
    this.name = '';
    this.id = '';
    this.rows = 0;
    this.parentNode = null;
    this._listeners = {};
    this._removed = false;
    this._focused = false;
  }
  appendChild(n) {
    if (typeof n === 'string') n = { textContent: n };
    this.children.push(n);
    if (n && typeof n === 'object') n.parentNode = this;
    return n;
  }
  removeChild(n) {
    var idx = this.children.indexOf(n);
    if (idx !== -1) this.children.splice(idx, 1);
    return n;
  }
  replaceChildren() {
    this.children = [];
  }
  setAttribute(k, v) { this._attrs[k] = v; if (k === 'class') this.className = v; if (k === 'id') this.id = v; }
  getAttribute(k) { return this._attrs[k]; }
  get textContent() {
    if (this._text != null) return this._text;
    return this.children.map(function (c) {
      if (typeof c === 'string') return c;
      if (c && c.textContent) return c.textContent;
      return '';
    }).join('');
  }
  set textContent(v) { this._text = v; this.children = []; }
  addEventListener(type, fn) {
    if (!this._listeners[type]) this._listeners[type] = [];
    this._listeners[type].push(fn);
  }
  removeEventListener(type, fn) {
    if (!this._listeners[type]) return;
    var idx = this._listeners[type].indexOf(fn);
    if (idx !== -1) this._listeners[type].splice(idx, 1);
  }
  focus() { this._focused = true; this._activeElement = this; }
  remove() { this._removed = true; if (this.parentNode) this.parentNode.removeChild(this); }
  querySelector(sel) {
    var all = this.querySelectorAll(sel);
    return all.length > 0 ? all[0] : null;
  }
  querySelectorAll(sel) {
    var parts = sel.split(',');
    var result = [];
    for (var pi = 0; pi < parts.length; pi++) {
      var part = parts[pi].trim();
      var attrMatch = part.match(/^(\w+)\[([^=]+)=["']?([^"'\]]+)["']?\]$/);
      if (attrMatch) {
        var tag = attrMatch[1].toUpperCase();
        var attr = attrMatch[2];
        var val = attrMatch[3];
        var found = this._findAllByPred(function (n) {
          if (tag !== '*' && n.tagName !== tag) return false;
          return _matchesAttr(n, attr, val);
        });
        result = result.concat(found);
        continue;
      }
      if (part.indexOf('[') !== -1) {
        var attrName = part.match(/\[([^\]=]+)/);
        if (attrName) {
          found = this._findAllByPred(function (n) {
            return _hasAttr(n, attrName[1]);
          });
          result = result.concat(found);
          continue;
        }
      }
      var tag2 = part.toUpperCase();
      if (part[0] === '#') {
        found = this._findAllByPred(function (n) { return n.id === part.slice(1); });
        result = result.concat(found);
      } else if (part[0] === '.') {
        var cls = part.slice(1);
        found = this._findAllByPred(function (n) { return n.className && n.className.indexOf(cls) !== -1; });
        result = result.concat(found);
      } else {
        found = this._findAllByPred(function (n) { return n.tagName === tag2; });
        result = result.concat(found);
      }
    }
    return result;
  }
  _findByPred(pred) {
    if (pred(this)) return this;
    for (var i = 0; i < this.children.length; i++) {
      var c = this.children[i];
      if (typeof c !== 'object' || !c.querySelector) continue;
      var found = c._findByPred(pred);
      if (found) return found;
    }
    return null;
  }
  _findAllByPred(pred, out) {
    out = out || [];
    if (pred(this)) out.push(this);
    for (var i = 0; i < this.children.length; i++) {
      var c = this.children[i];
      if (typeof c !== 'object' || !c._findAllByPred) continue;
      c._findAllByPred(pred, out);
    }
    return out;
  }
  cloneNode() { return new FakeNode(this.tagName); }
}

function makeFakeDocument() {
  var body = new FakeNode('body');
  var activeElement = body;
  var _docListeners = {};
  var doc = {
    createElement: function (t) { return new FakeNode(t); },
    createTextNode: function (t) { var n = new FakeNode('#text'); n._text = t; return n; },
    get body() { return body; },
    get activeElement() { return activeElement; },
    set activeElement(el) { activeElement = el; },
    addEventListener: function (type, fn) {
      if (!_docListeners[type]) _docListeners[type] = [];
      _docListeners[type].push(fn);
    },
    removeEventListener: function (type, fn) {
      if (!_docListeners[type]) return;
      var idx = _docListeners[type].indexOf(fn);
      if (idx !== -1) _docListeners[type].splice(idx, 1);
    },
    _listeners: _docListeners,
  };
  body._activeElement = body;
  body.focus = function () { activeElement = body; };
  return doc;
}

before(function () {
  src = fs.readFileSync(MODAL_PATH, 'utf8');
});

function createModal(options) {
  options = options || {};
  var doc = options.document || makeFakeDocument();
  var sandbox = {
    document: doc,
    window: { document: doc, RAVATEX_DOCUMENTS: {} },
    setTimeout: setTimeout,
    console: console,
  };
  sandbox.window.window = sandbox.window;
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox, { filename: MODAL_PATH });
  var factory = sandbox.window.RAVATEX_DOCUMENTS.createDocumentDecisionModal;
  var modal = factory({ document: doc });
  return { modal: modal, doc: doc, sandbox: sandbox };
}

describe('modal factory', function () {
  test('exposes createDocumentDecisionModal on RAVATEX_DOCUMENTS', function () {
    var { sandbox } = createModal();
    var factory = sandbox.window.RAVATEX_DOCUMENTS.createDocumentDecisionModal;
    assert.equal(typeof factory, 'function');
  });

  test('created modal has all required methods', function () {
    var { modal } = createModal();
    assert.equal(typeof modal.open, 'function');
    assert.equal(typeof modal.setBusy, 'function');
    assert.equal(typeof modal.setError, 'function');
    assert.equal(typeof modal.setOutcome, 'function');
    assert.equal(typeof modal.close, 'function');
    assert.equal(typeof modal.isOpen, 'function');
    assert.equal(typeof modal.destroy, 'function');
  });
});

describe('open and structure', function () {
  test('open creates one dialog with role and aria-modal', function () {
    var { modal, doc } = createModal();
    modal.open({ documentId: 'DOC-X' }, { onCancel: function () {}, onConfirm: function () {} });
    var dialogs = doc.body._findAllByPred(function (n) {
      return n.getAttribute && n.getAttribute('role') === 'dialog' && n.getAttribute('aria-modal') === 'true';
    });
    assert.equal(dialogs.length, 1);
    modal.close();
  });

  test('dialog has aria-labelledby pointing to title', function () {
    var { modal, doc } = createModal();
    modal.open({ documentId: 'DOC-X' }, { onCancel: function () {}, onConfirm: function () {} });
    var dialog = doc.body._findByPred(function (n) {
      return n.getAttribute && n.getAttribute('role') === 'dialog';
    });
    var labelledby = dialog.getAttribute('aria-labelledby');
    assert.ok(labelledby);
    var title = doc.body._findByPred(function (n) { return n.id === labelledby; });
    assert.ok(title);
    assert.match(title.textContent, /Decidir/i);
    modal.close();
  });

  test('documentId is displayed as text', function () {
    var { modal, doc } = createModal();
    modal.open({ documentId: 'DOC-123' }, { onCancel: function () {}, onConfirm: function () {} });
    assert.ok(doc.body.textContent.indexOf('DOC-123') !== -1);
    modal.close();
  });

  test('dialog has aria-describedby referencing error and outcome elements', function () {
    var { modal, doc } = createModal();
    modal.open({ documentId: 'DOC' }, { onCancel: function () {}, onConfirm: function () {} });
    var dialog = doc.body._findByPred(function (n) {
      return n.getAttribute && n.getAttribute('role') === 'dialog';
    });
    var describedby = dialog.getAttribute('aria-describedby');
    assert.ok(describedby);
    var ids = describedby.split(/\s+/);
    assert.ok(ids.indexOf('r8x-dm-error') !== -1, 'includes error id');
    assert.ok(ids.indexOf('r8x-dm-outcome') !== -1, 'includes outcome id');
    modal.close();
  });

  test('outcome element has aria-live polite', function () {
    var { modal, doc } = createModal();
    modal.open({ documentId: 'DOC' }, { onCancel: function () {}, onConfirm: function () {} });
    var outcomeEl = doc.body.querySelector('#r8x-dm-outcome');
    assert.ok(outcomeEl);
    assert.equal(outcomeEl.getAttribute('aria-live'), 'polite');
    modal.close();
  });

  test('open is idempotent when already open', function () {
    var { modal, doc } = createModal();
    modal.open({ documentId: 'DOC-1' }, { onCancel: function () {}, onConfirm: function () {} });
    modal.open({ documentId: 'DOC-2' }, { onCancel: function () {}, onConfirm: function () {} });
    var dialogs = doc.body._findAllByPred(function (n) {
      return n.getAttribute && n.getAttribute('role') === 'dialog';
    });
    assert.equal(dialogs.length, 1);
    modal.close();
  });
});

describe('decision controls', function () {
  test('accept and reject radio buttons present', function () {
    var { modal, doc } = createModal();
    modal.open({ documentId: 'DOC' }, { onCancel: function () {}, onConfirm: function () {} });
    var radios = doc.body._findAllByPred(function (n) { return n.type === 'radio'; });
    assert.equal(radios.length, 2);
    var values = radios.map(function (r) { return r.value; }).sort();
    assert.deepEqual(values, ['accepted', 'rejected']);
    modal.close();
  });

  test('motivo textarea present', function () {
    var { modal, doc } = createModal();
    modal.open({ documentId: 'DOC' }, { onCancel: function () {}, onConfirm: function () {} });
    var ta = doc.body._findByPred(function (n) { return n.tagName === 'TEXTAREA'; });
    assert.ok(ta);
    modal.close();
  });

  test('Cancel and Confirm buttons type="button"', function () {
    var { modal, doc } = createModal();
    modal.open({ documentId: 'DOC' }, { onCancel: function () {}, onConfirm: function () {} });
    var buttons = doc.body._findAllByPred(function (n) { return n.tagName === 'BUTTON'; });
    assert.ok(buttons.length >= 2);
    for (var i = 0; i < buttons.length; i++) {
      assert.equal(buttons[i].type, 'button');
    }
    modal.close();
  });
});

describe('confirm behavior', function () {
  function findAll(body, tag) {
    return body._findAllByPred(function (n) { return n.tagName === tag; });
  }
  function findInput(body, val) {
    var all = findAll(body, 'INPUT');
    for (var i = 0; i < all.length; i++) {
      if (all[i].value === val) return all[i];
    }
    return null;
  }

  test('confirm calls onConfirm with decision and motivo', function () {
    var { modal, doc } = createModal();
    var captured = null;
    modal.open({ documentId: 'DOC' }, {
      onCancel: function () {},
      onConfirm: function (draft) { captured = draft; },
    });
    var acceptRadio = findInput(doc.body, 'accepted');
    var motivoTa = findAll(doc.body, 'TEXTAREA')[0];
    var confirmBtn = findAll(doc.body, 'BUTTON').filter(function (b) { return b.textContent === 'Confirmar'; })[0];
    assert.ok(acceptRadio, 'acceptRadio found');
    assert.ok(confirmBtn, 'confirmBtn found');
    assert.ok(motivoTa, 'motivoTa found');
    acceptRadio.checked = true;
    motivoTa.value = 'some reason';
    if (confirmBtn._listeners && confirmBtn._listeners.click) {
      confirmBtn._listeners.click[0]();
    }
    assert.ok(captured);
    assert.equal(captured.decision, 'accepted');
    assert.equal(captured.motivo, 'some reason');
    modal.close();
  });

  test('confirm is blocked when busy', function () {
    var { modal, doc } = createModal();
    var count = 0;
    modal.open({ documentId: 'DOC' }, {
      onCancel: function () {},
      onConfirm: function () { count++; },
    });
    modal.setBusy(true);
    var allBtns = doc.body._findAllByPred(function (n) { return n.tagName === 'BUTTON'; });
    var confirmBtn = null;
    for (var i = 0; i < allBtns.length; i++) {
      if (allBtns[i].textContent === 'Confirmar' || allBtns[i].id === 'r8x-dm-confirm') { confirmBtn = allBtns[i]; break; }
    }
    assert.ok(confirmBtn);
    assert.equal(confirmBtn.disabled, true);
    if (confirmBtn._listeners && confirmBtn._listeners.click) {
      confirmBtn._listeners.click[0]();
    }
    assert.equal(count, 0, 'confirm should not fire when disabled');
    modal.close();
  });

  test('confirm blocks rejected with empty motivo and shows error', function () {
    var { modal, doc } = createModal();
    var captured = null;
    modal.open({ documentId: 'DOC' }, {
      onCancel: function () {},
      onConfirm: function (draft) { captured = draft; },
    });
    var rejectRadio = findInput(doc.body, 'rejected');
    var motivoTa = findAll(doc.body, 'TEXTAREA')[0];
    var confirmBtn = findAll(doc.body, 'BUTTON').filter(function (b) { return b.textContent === 'Confirmar'; })[0];
    var errorEl = doc.body.querySelector('#r8x-dm-error');
    rejectRadio.checked = true;
    motivoTa.value = '   ';
    confirmBtn._listeners.click[0]();
    assert.equal(captured, null, 'onConfirm should not be called');
    assert.equal(errorEl.textContent, 'Informe o motivo da rejeição.');
    modal.close();
  });

  test('confirm allows accepted with empty motivo', function () {
    var { modal, doc } = createModal();
    var captured = null;
    modal.open({ documentId: 'DOC' }, {
      onCancel: function () {},
      onConfirm: function (draft) { captured = draft; },
    });
    var acceptRadio = findInput(doc.body, 'accepted');
    var motivoTa = findAll(doc.body, 'TEXTAREA')[0];
    var confirmBtn = findAll(doc.body, 'BUTTON').filter(function (b) { return b.textContent === 'Confirmar'; })[0];
    acceptRadio.checked = true;
    motivoTa.value = '';
    confirmBtn._listeners.click[0]();
    assert.ok(captured);
    assert.equal(captured.decision, 'accepted');
    assert.equal(captured.motivo, '');
    modal.close();
  });
});

describe('cancel behavior', function () {
  test('cancel button calls onCancel and closes modal by default', function () {
    var { modal, doc } = createModal();
    var called = false;
    modal.open({ documentId: 'DOC' }, {
      onCancel: function () { called = true; },
      onConfirm: function () {},
    });
    var cancelBtn = doc.body.querySelector('#r8x-dm-cancel');
    assert.ok(cancelBtn);
    if (cancelBtn._listeners && cancelBtn._listeners.click) {
      cancelBtn._listeners.click[0]();
    }
    assert.equal(called, true);
    assert.equal(modal.isOpen(), false);
  });

  test('Escape key calls onCancel and closes modal when not busy', function () {
    var { modal, doc } = createModal();
    var called = false;
    var registeredHandler = null;
    var origAE = doc.addEventListener;
    doc.addEventListener = function (type, fn) {
      if (type === 'keydown') registeredHandler = fn;
      if (origAE) origAE.call(doc, type, fn);
    };
    modal.open({ documentId: 'DOC' }, {
      onCancel: function () { called = true; },
      onConfirm: function () {},
    });
    assert.ok(registeredHandler, 'keydown handler registered');
    assert.equal(modal.isOpen(), true);
    if (registeredHandler) {
      registeredHandler({ key: 'Escape', preventDefault: function () {} });
    }
    assert.equal(called, true);
    assert.equal(modal.isOpen(), false);
  });

  test('Escape busy does not call onCancel and does not close', function () {
    var { modal, doc } = createModal();
    var called = false;
    modal.open({ documentId: 'DOC' }, {
      onCancel: function () { called = true; },
      onConfirm: function () {},
    });
    modal.setBusy(true);
    var handler = doc._listeners.keydown[0];
    assert.ok(handler);
    assert.equal(modal.isOpen(), true);
    handler({ key: 'Escape', preventDefault: function () {} });
    assert.equal(called, false);
    assert.equal(modal.isOpen(), true);
    modal.close();
  });

  test('Escape with closeModal:false result calls handler but leaves modal open', function () {
    var { modal, doc } = createModal();
    var called = false;
    modal.open({ documentId: 'DOC' }, {
      onCancel: function () { called = true; return { closeModal: false }; },
      onConfirm: function () {},
    });
    var handler = doc._listeners.keydown[0];
    assert.ok(handler);
    handler({ key: 'Escape', preventDefault: function () {} });
    assert.equal(called, true);
    assert.equal(modal.isOpen(), true);
    modal.close();
  });

  test('Cancel button uses same veto semantics with false', function () {
    var { modal, doc } = createModal();
    var called = false;
    modal.open({ documentId: 'DOC' }, {
      onCancel: function () { called = true; return false; },
      onConfirm: function () {},
    });
    var cancelBtn = doc.body.querySelector('#r8x-dm-cancel');
    assert.ok(cancelBtn);
    cancelBtn._listeners.click[0]();
    assert.equal(called, true);
    assert.equal(modal.isOpen(), true);
    modal.close();
  });

  test('Cancel button uses same veto semantics with closeModal:false', function () {
    var { modal, doc } = createModal();
    var called = false;
    modal.open({ documentId: 'DOC' }, {
      onCancel: function () { called = true; return { closeModal: false }; },
      onConfirm: function () {},
    });
    var cancelBtn = doc.body.querySelector('#r8x-dm-cancel');
    assert.ok(cancelBtn);
    cancelBtn._listeners.click[0]();
    assert.equal(called, true);
    assert.equal(modal.isOpen(), true);
    modal.close();
  });

  test('Cancel button busy does not call handler or close', function () {
    var { modal, doc } = createModal();
    var called = false;
    modal.open({ documentId: 'DOC' }, {
      onCancel: function () { called = true; },
      onConfirm: function () {},
    });
    modal.setBusy(true);
    var cancelBtn = doc.body.querySelector('#r8x-dm-cancel');
    assert.ok(cancelBtn);
    cancelBtn._listeners.click[0]();
    assert.equal(called, false);
    assert.equal(modal.isOpen(), true);
    modal.close();
  });
});

describe('busy state', function () {
  test('setBusy disables confirm and cancel buttons', function () {
    var { modal, doc } = createModal();
    modal.open({ documentId: 'DOC' }, { onCancel: function () {}, onConfirm: function () {} });
    var confirmBtn = doc.body.querySelector('#r8x-dm-confirm');
    var cancelBtn = doc.body.querySelector('#r8x-dm-cancel');
    modal.setBusy(true);
    assert.equal(confirmBtn.disabled, true);
    assert.equal(cancelBtn.disabled, true);
    modal.setBusy(false);
    assert.equal(confirmBtn.disabled, false);
    assert.equal(cancelBtn.disabled, false);
    modal.close();
  });

  test('busy changes confirm button text', function () {
    var { modal, doc } = createModal();
    modal.open({ documentId: 'DOC' }, { onCancel: function () {}, onConfirm: function () {} });
    var confirmBtn = doc.body.querySelector('#r8x-dm-confirm');
    modal.setBusy(true);
    assert.equal(confirmBtn.textContent, 'Enviando...');
    modal.setBusy(false);
    assert.equal(confirmBtn.textContent, 'Confirmar');
    modal.close();
  });
});

describe('error and outcome', function () {
  test('setError displays message as text', function () {
    var { modal, doc } = createModal();
    modal.open({ documentId: 'DOC' }, { onCancel: function () {}, onConfirm: function () {} });
    var errorEl = doc.body.querySelector('#r8x-dm-error');
    modal.setError('Erro de validacao');
    assert.equal(errorEl.textContent, 'Erro de validacao');
    modal.close();
  });

  test('setError role is alert', function () {
    var { modal, doc } = createModal();
    modal.open({ documentId: 'DOC' }, { onCancel: function () {}, onConfirm: function () {} });
    var errorEl = doc.body.querySelector('#r8x-dm-error');
    assert.equal(errorEl.getAttribute('role'), 'alert');
    modal.close();
  });

  test('setOutcome displays message with tone color', function () {
    var { modal, doc } = createModal();
    modal.open({ documentId: 'DOC' }, { onCancel: function () {}, onConfirm: function () {} });
    var outcomeEl = doc.body.querySelector('#r8x-dm-outcome');
    modal.setOutcome('Sucesso', 'success');
    assert.equal(outcomeEl.textContent, 'Sucesso');
    assert.equal(outcomeEl.style.color, '#2e7d32');
    modal.setOutcome('Aviso', 'warning');
    assert.equal(outcomeEl.style.color, '#f57f17');
    modal.setOutcome('Erro', 'error');
    assert.equal(outcomeEl.style.color, '#d32f2f');
    modal.close();
  });
});

describe('focus management', function () {
  test('initial focus on accept radio after open', function () {
    var { modal, doc } = createModal();
    modal.open({ documentId: 'DOC' }, { onCancel: function () {}, onConfirm: function () {} });
    var allInputs = doc.body._findAllByPred(function (n) { return n.tagName === 'INPUT'; });
    var acceptRadio = null;
    for (var i = 0; i < allInputs.length; i++) {
      if (allInputs[i].value === 'accepted') { acceptRadio = allInputs[i]; break; }
    }
    assert.ok(acceptRadio);
    return new Promise(function (resolve) {
      setTimeout(function () {
        assert.ok(acceptRadio._focused);
        modal.close();
        resolve();
      }, 15);
    });
  });

  test('close returns focus to opener', function () {
    var { modal, doc } = createModal();
    var opener = new FakeNode('button');
    opener.focus();
    doc.activeElement = opener;
    modal.open({ documentId: 'DOC' }, { onCancel: function () {}, onConfirm: function () {} });
    modal.close();
    assert.equal(doc.activeElement, opener);
  });

  test('Tab from last focusable wraps to first', function () {
    var { modal, doc } = createModal();
    modal.open({ documentId: 'DOC' }, { onCancel: function () {}, onConfirm: function () {} });
    var handler = doc._listeners.keydown[0];
    var focusables = doc.body._findAllByPred(function (n) {
      return (n.tagName === 'INPUT' || n.tagName === 'TEXTAREA' || n.tagName === 'BUTTON') && !n.disabled && n.type !== 'hidden';
    });
    assert.ok(focusables.length >= 2, 'need at least 2 focusable elements');
    var first = focusables[0];
    var last = focusables[focusables.length - 1];
    doc.activeElement = last;
    handler({ key: 'Tab', shiftKey: false, preventDefault: function () {} });
    assert.ok(first._focused, 'first element should receive focus');
    modal.close();
  });

  test('Shift+Tab from first focusable wraps to last', function () {
    var { modal, doc } = createModal();
    modal.open({ documentId: 'DOC' }, { onCancel: function () {}, onConfirm: function () {} });
    var handler = doc._listeners.keydown[0];
    var focusables = doc.body._findAllByPred(function (n) {
      return (n.tagName === 'INPUT' || n.tagName === 'TEXTAREA' || n.tagName === 'BUTTON') && !n.disabled && n.type !== 'hidden';
    });
    assert.ok(focusables.length >= 2, 'need at least 2 focusable elements');
    var first = focusables[0];
    var last = focusables[focusables.length - 1];
    doc.activeElement = first;
    handler({ key: 'Tab', shiftKey: true, preventDefault: function () {} });
    assert.ok(last._focused, 'last element should receive focus');
    modal.close();
  });
});

describe('close and cleanup', function () {
  test('close removes overlay from body', function () {
    var { modal, doc } = createModal();
    modal.open({ documentId: 'DOC' }, { onCancel: function () {}, onConfirm: function () {} });
    assert.equal(doc.body.children.length, 1);
    modal.close();
    assert.equal(doc.body.children.length, 0);
  });

  test('close is idempotent', function () {
    var { modal } = createModal();
    modal.open({ documentId: 'DOC' }, { onCancel: function () {}, onConfirm: function () {} });
    modal.close();
    modal.close();
    assert.equal(modal.isOpen(), false);
  });

  test('isOpen reflects state', function () {
    var { modal } = createModal();
    assert.equal(modal.isOpen(), false);
    modal.open({ documentId: 'DOC' }, { onCancel: function () {}, onConfirm: function () {} });
    assert.equal(modal.isOpen(), true);
    modal.close();
    assert.equal(modal.isOpen(), false);
  });

  test('destroy is idempotent and cleans up', function () {
    var { modal } = createModal();
    modal.destroy();
    modal.destroy();
    assert.equal(modal.isOpen(), false);
  });

  test('re-open after close reinstalls listeners and works', function () {
    var { modal, doc } = createModal();
    var confirmCount = 0;
    var cancelCount = 0;
    modal.open({ documentId: 'DOC-1' }, {
      onCancel: function () { cancelCount++; },
      onConfirm: function () { confirmCount++; },
    });
    modal.close();
    modal.open({ documentId: 'DOC-2' }, {
      onCancel: function () { cancelCount++; return { closeModal: false }; },
      onConfirm: function () { confirmCount++; },
    });
    var allBtns = doc.body._findAllByPred(function (n) { return n.tagName === 'BUTTON'; });
    var confirmBtn = null;
    var cancelBtn = null;
    for (var i = 0; i < allBtns.length; i++) {
      if (allBtns[i].id === 'r8x-dm-confirm') confirmBtn = allBtns[i];
      if (allBtns[i].id === 'r8x-dm-cancel') cancelBtn = allBtns[i];
    }
    assert.ok(confirmBtn);
    assert.ok(cancelBtn);
    confirmBtn._listeners.click[0]();
    assert.equal(confirmCount, 1);
    cancelBtn._listeners.click[0]();
    assert.equal(cancelCount, 1);
    var handler = doc._listeners.keydown[0];
    assert.ok(handler);
    handler({ key: 'Escape', preventDefault: function () {} });
    assert.equal(cancelCount, 2);
    modal.close();
  });

  test('close removes document keydown listener', function () {
    var { modal, doc } = createModal();
    modal.open({ documentId: 'DOC' }, { onCancel: function () {}, onConfirm: function () {} });
    assert.ok(doc._listeners.keydown && doc._listeners.keydown.length > 0, 'listener added on open');
    modal.close();
    assert.equal(doc._listeners.keydown.length, 0, 'listener removed after close');
  });

  test('destroy removes document keydown listener', function () {
    var { modal, doc } = createModal();
    modal.open({ documentId: 'DOC' }, { onCancel: function () {}, onConfirm: function () {} });
    assert.ok(doc._listeners.keydown && doc._listeners.keydown.length > 0);
    modal.destroy();
    assert.equal(doc._listeners.keydown.length, 0);
  });
});

describe('text safety', function () {
  test('external values use textContent not innerHTML', function () {
    var { modal, doc } = createModal();
    modal.open({ documentId: 'DOC' }, { onCancel: function () {}, onConfirm: function () {} });
    var errorEl = doc.body.querySelector('#r8x-dm-error');
    modal.setError('<script>alert("xss")</script>');
    assert.equal(errorEl.textContent, '<script>alert("xss")</script>');
    assert.ok(errorEl.children.length === 0 || errorEl._text !== null);
    modal.close();
  });

  test('documentId displayed via textContent', function () {
    var srcCheck = fs.readFileSync(MODAL_PATH, 'utf8');
    assert.doesNotMatch(srcCheck, /\.innerHTML\s*=/, 'no innerHTML assignments');
  });
});

describe('static source assertions', function () {
  test('no Supabase, storage, lifecycle references', function () {
    assert.doesNotMatch(src, /Supabase/i, 'no Supabase');
    assert.doesNotMatch(src, /storage/i, 'no storage');
    assert.doesNotMatch(src, /localStorage/, 'no localStorage');
    assert.doesNotMatch(src, /sessionStorage/, 'no sessionStorage');
    assert.doesNotMatch(src, /\.rpc\s*\(/, 'no .rpc()');
    assert.doesNotMatch(src, /randomUUID/, 'no UUID generation');
    assert.doesNotMatch(src, /documentDecisionCommand/, 'no lifecycle');
    assert.doesNotMatch(src, /fila/i, 'no fila');
    assert.doesNotMatch(src, /Pedido/i, 'no Pedido');
    assert.doesNotMatch(src, /\bOP\b/, 'no OP');
    assert.doesNotMatch(src, /B8/i, 'no B8');
  });
});
