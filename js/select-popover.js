// =====================================================================
// === SELECT POPOVER (Seam A) =========================================
// The ONE application-owned single-choice control.
//
// UI-CONSOLIDATION-PHASE-5-PASS-7-NATIVE-SELECT-R1-A1 (UIC-006).
// The product has no native <select> left: this primitive owns every
// single-choice control on every surface — page form field, modal field,
// inline row editor and list filter. js/ui.js::selectInput() is a thin
// compatibility adapter over this file and owns nothing of its own.
//
// Deliberately NOT an HTMLSelectElement emulation. There is no `options`
// collection, no `selectedIndex`, no add()/remove()/replaceChildren()
// option protocol. Callers that repopulate use setOptions(); callers that
// read or write a value use `.value`. Those were the only two select-DOM
// capabilities the repository actually depended on.
//
// Loaded BEFORE js/ui.js. No Supabase, no app state, no business rule and
// no third-party positioning dependency.
//
// Environment injection: every DOM access goes through the resolved
// environment, so an injected-document factory (the document link and
// document decision modals) drives the SAME primitive with its own
// document/window instead of reaching an unrelated global.
// =====================================================================
(function (globalWindow) {
  'use strict';

  var TYPEAHEAD_RESET_MS = 700;
  var VIEWPORT_MARGIN = 8;    // minimum distance from any viewport edge
  var PANEL_GAP = 6;          // distance between trigger and panel
  var FALLBACK_VIEWPORT_W = 1024;
  var FALLBACK_VIEWPORT_H = 768;

  // Only ONE select popover may be open in the whole application at a
  // time. This module-level registry is the single owner of that rule.
  var openControl = null;

  var seq = 0;

  var CHEVRON_SVG = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" '
    + 'stroke="currentColor" stroke-width="2" stroke-linecap="round" '
    + 'stroke-linejoin="round" aria-hidden="true" focusable="false">'
    + '<polyline points="6 9 12 15 18 9"></polyline></svg>';

  var CHECK_SVG = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" '
    + 'stroke="currentColor" stroke-width="2.4" stroke-linecap="round" '
    + 'stroke-linejoin="round" aria-hidden="true" focusable="false">'
    + '<polyline points="20 6 9 17 4 12"></polyline></svg>';

  // ---- Visual contract (§10). Every value is a canonical token. ----
  var TRIGGER_STYLE = 'box-sizing:border-box; display:inline-flex; align-items:center;'
    + ' justify-content:space-between; gap:8px;'
    + ' height:var(--rv-h-compact); padding-top:0; padding-bottom:0;'
    + ' padding-left:12px; padding-right:12px;'
    + ' border:1px solid var(--rv-border-strong); border-radius:var(--rv-radius);'
    + ' background:var(--rv-surface); color:var(--rv-text-primary);'
    + ' font-size:var(--rv-fs-body); font-family:inherit; text-align:left;'
    + ' cursor:pointer; outline:none;';

  var PANEL_STYLE = 'position:fixed; box-sizing:border-box;'
    + ' background:var(--rv-surface); border:1px solid var(--rv-border-strong);'
    + ' border-radius:var(--rv-radius); box-shadow:var(--rv-shadow-popover);'
    + ' padding:5px; margin:0; z-index:var(--rv-z-popover);'
    + ' max-height:var(--rv-select-popover-max-h); overflow-y:auto;'
    + ' font-family:inherit; list-style:none;';

  var ITEM_STYLE = 'box-sizing:border-box; display:flex; align-items:center;'
    + ' justify-content:space-between; gap:8px; width:100%;'
    + ' padding:7px 8px; border:0; border-radius:var(--rv-radius);'
    + ' background:transparent; color:var(--rv-text-primary);'
    + ' font-size:var(--rv-fs-body); font-family:inherit; text-align:left;'
    + ' cursor:pointer; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;';

  var LABEL_STYLE = 'flex:1 1 auto; min-width:0; overflow:hidden;'
    + ' text-overflow:ellipsis; white-space:nowrap;';

  // ------------------------------------------------------------------
  // Environment
  // ------------------------------------------------------------------
  function resolveEnvironment(cfg) {
    var doc = (cfg && cfg.document)
      || (typeof document !== 'undefined' ? document : null)
      || (globalWindow && globalWindow.document)
      || null;
    var win = (cfg && cfg.window)
      || (doc && doc.defaultView)
      || (typeof window !== 'undefined' ? window : null)
      || globalWindow
      || null;
    return { document: doc, window: win };
  }

  function viewportWidth(env) {
    var w = env.window;
    if (w && typeof w.innerWidth === 'number' && w.innerWidth > 0) return w.innerWidth;
    var de = env.document && env.document.documentElement;
    if (de && typeof de.clientWidth === 'number' && de.clientWidth > 0) return de.clientWidth;
    return FALLBACK_VIEWPORT_W;
  }

  function viewportHeight(env) {
    var w = env.window;
    if (w && typeof w.innerHeight === 'number' && w.innerHeight > 0) return w.innerHeight;
    var de = env.document && env.document.documentElement;
    if (de && typeof de.clientHeight === 'number' && de.clientHeight > 0) return de.clientHeight;
    return FALLBACK_VIEWPORT_H;
  }

  function rectOf(node) {
    if (node && typeof node.getBoundingClientRect === 'function') {
      var r = node.getBoundingClientRect();
      if (r) {
        return {
          top: r.top || 0, left: r.left || 0,
          bottom: typeof r.bottom === 'number' ? r.bottom : (r.top || 0) + (r.height || 0),
          right: typeof r.right === 'number' ? r.right : (r.left || 0) + (r.width || 0),
          width: r.width || 0, height: r.height || 0
        };
      }
    }
    return { top: 0, left: 0, bottom: 0, right: 0, width: 0, height: 0 };
  }

  function isConnectedNode(node) {
    if (!node) return false;
    if (typeof node.isConnected === 'boolean') return node.isConnected;
    return true; // an environment that cannot report it is treated as live
  }

  // ------------------------------------------------------------------
  // Value semantics
  // ------------------------------------------------------------------
  function normalizeValue(v) {
    return (v === null || v === undefined) ? '' : String(v);
  }

  // Tolerant numeric equivalence, carried over verbatim from the previous
  // selectInput(): the database returns numeric as 1.4 while an option may
  // spell it '1.40'. Both must resolve to the same option.
  function valuesMatch(a, b) {
    var as = normalizeValue(a);
    var bs = normalizeValue(b);
    if (as === bs) return true;
    if (as === '' || bs === '') return false;
    var an = Number(as);
    var bn = Number(bs);
    return !isNaN(an) && !isNaN(bn) && an === bn;
  }

  function normalizeOptions(list, placeholder) {
    var out = [];
    var hasEmpty = false;
    var src = Array.isArray(list) ? list : [];
    for (var i = 0; i < src.length; i++) {
      var raw = src[i];
      if (raw === null || raw === undefined) continue;
      var value = normalizeValue(raw.value);
      if (value === '') hasEmpty = true;
      out.push({
        value: value,
        label: raw.label === null || raw.label === undefined ? value : String(raw.label),
        disabled: !!raw.disabled
      });
    }
    // The placeholder is a real, selectable empty entry — exactly as the
    // previous native placeholder <option value=""> was. Clearing a field
    // stays possible, so no payload changes.
    if (placeholder && !hasEmpty) {
      out.unshift({ value: '', label: String(placeholder), disabled: false, placeholder: true });
    }
    return out;
  }

  // ------------------------------------------------------------------
  // Small DOM helpers (no dependency on js/ui.js — this file loads first)
  // ------------------------------------------------------------------
  function iconNode(env, markup, marker, size) {
    var host = env.document.createElement('span');
    host.setAttribute('data-rv-icon', marker);
    host.setAttribute('style', 'display:inline-flex; align-items:center;'
      + ' justify-content:center; flex:none; width:' + size + 'px; height:' + size + 'px;');
    try { host.innerHTML = markup; } catch (e) { /* reduced DOM: marker only */ }
    return host;
  }

  function setText(node, text) {
    if (!node) return;
    node.textContent = text === null || text === undefined ? '' : String(text);
  }

  function clearChildren(node) {
    if (!node) return;
    if (typeof node.replaceChildren === 'function') { node.replaceChildren(); return; }
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  function on(target, type, fn, capture) {
    if (target && typeof target.addEventListener === 'function') {
      target.addEventListener(type, fn, capture === true);
    }
  }

  function off(target, type, fn, capture) {
    if (target && typeof target.removeEventListener === 'function') {
      target.removeEventListener(type, fn, capture === true);
    }
  }

  // ------------------------------------------------------------------
  // createSelectPopover
  // ------------------------------------------------------------------
  function createSelectPopover(configuration) {
    var cfg = configuration || {};
    var env = resolveEnvironment(cfg);
    var doc = env.document;
    if (!doc || typeof doc.createElement !== 'function') {
      throw new Error('createSelectPopover: no usable document environment');
    }

    seq += 1;
    var uid = 'rv-selpop-' + seq;
    var panelId = uid + '-panel';

    var placeholder = cfg.placeholder === null || cfg.placeholder === undefined
      ? '' : String(cfg.placeholder);
    var widthMode = cfg.widthMode === 'auto' ? 'auto' : 'block';

    var options = normalizeOptions(cfg.options, placeholder);
    var currentValue = normalizeValue(cfg.value);

    var panel = null;
    var itemNodes = [];
    var activeIndex = -1;
    var isOpen = false;
    var destroyed = false;
    var typeBuffer = '';
    var typeStamp = 0;

    // ---- trigger -------------------------------------------------
    var trigger = doc.createElement('button');
    trigger.setAttribute('type', 'button');
    trigger.setAttribute('role', 'combobox');
    trigger.setAttribute('aria-haspopup', 'listbox');
    trigger.setAttribute('aria-expanded', 'false');
    trigger.setAttribute('aria-controls', panelId);
    trigger.setAttribute('data-rv-select-popover', '1');
    trigger.setAttribute('style', TRIGGER_STYLE
      + (widthMode === 'block' ? ' width:100%;' : ''));

    if (cfg.labelledBy) trigger.setAttribute('aria-labelledby', String(cfg.labelledBy));
    else if (cfg.ariaLabel) trigger.setAttribute('aria-label', String(cfg.ariaLabel));

    var labelNode = doc.createElement('span');
    labelNode.setAttribute('data-rv-select-label', '1');
    labelNode.setAttribute('style', LABEL_STYLE);
    trigger.appendChild(labelNode);
    trigger.appendChild(iconNode(env, CHEVRON_SVG, 'chevron', 14));

    // ---- state helpers -------------------------------------------
    function indexOfValue(value) {
      for (var i = 0; i < options.length; i++) {
        if (valuesMatch(options[i].value, value)) return i;
      }
      return -1;
    }

    function currentIndex() { return indexOfValue(currentValue); }

    function paintTrigger() {
      var idx = currentIndex();
      var opt = idx === -1 ? null : options[idx];
      var showPlaceholder = !opt || opt.value === '';
      setText(labelNode, opt ? opt.label : placeholder);
      labelNode.style.color = showPlaceholder
        ? 'var(--rv-text-tertiary)' : 'var(--rv-text-primary)';
      trigger.setAttribute('data-rv-select-value', currentValue);
    }

    function emitChange() {
      var ev = null;
      var W = env.window;
      if (W && typeof W.Event === 'function') {
        try { ev = new W.Event('change', { bubbles: true }); } catch (e) { ev = null; }
      }
      if (!ev && typeof Event === 'function') {
        try { ev = new Event('change', { bubbles: true }); } catch (e2) { ev = null; }
      }
      if (!ev) ev = { type: 'change', bubbles: true, target: trigger, currentTarget: trigger };
      if (typeof trigger.dispatchEvent === 'function') trigger.dispatchEvent(ev);
    }

    // A programmatic assignment never emits. Only a user commitment does,
    // and only when the value actually moved.
    function commit(index) {
      var opt = options[index];
      if (!opt || opt.disabled) return;
      var moved = !valuesMatch(opt.value, currentValue);
      currentValue = opt.value;
      paintTrigger();
      close({ focus: true });
      if (moved) emitChange();
    }

    // ---- panel ---------------------------------------------------
    function buildPanel() {
      panel = doc.createElement('div');
      panel.id = panelId;
      if (typeof panel.setAttribute === 'function') panel.setAttribute('id', panelId);
      panel.setAttribute('role', 'listbox');
      panel.setAttribute('data-rv-select-panel', '1');
      panel.setAttribute('style', PANEL_STYLE);
      if (cfg.labelledBy) panel.setAttribute('aria-labelledby', String(cfg.labelledBy));
      else if (cfg.ariaLabel) panel.setAttribute('aria-label', String(cfg.ariaLabel));

      itemNodes = [];
      for (var i = 0; i < options.length; i++) {
        itemNodes.push(buildItem(options[i], i));
        panel.appendChild(itemNodes[i]);
      }
      return panel;
    }

    function buildItem(opt, index) {
      var item = doc.createElement('div');
      item.id = panelId + '-opt-' + index;
      if (typeof item.setAttribute === 'function') item.setAttribute('id', panelId + '-opt-' + index);
      item.setAttribute('role', 'option');
      item.setAttribute('data-rv-select-option', '1');
      item.setAttribute('data-rv-option-value', opt.value);
      item.setAttribute('style', ITEM_STYLE);
      item.setAttribute('aria-selected', valuesMatch(opt.value, currentValue) ? 'true' : 'false');
      if (opt.disabled) item.setAttribute('aria-disabled', 'true');

      var text = doc.createElement('span');
      text.setAttribute('style', LABEL_STYLE);
      setText(text, opt.label);
      item.appendChild(text);

      if (valuesMatch(opt.value, currentValue)) {
        item.appendChild(iconNode(env, CHECK_SVG, 'check', 13));
      }

      if (opt.disabled) {
        item.style.opacity = '.45';
        item.style.cursor = 'default';
      } else {
        on(item, 'mousedown', function (e) { if (e && e.preventDefault) e.preventDefault(); });
        on(item, 'click', function () { commit(index); });
        on(item, 'mousemove', function () { setActive(index); });
      }
      paintItem(item, index);
      return item;
    }

    function paintItem(item, index) {
      var opt = options[index];
      var isSelected = valuesMatch(opt.value, currentValue);
      var isActive = index === activeIndex;
      if (isSelected) {
        item.style.background = 'var(--rv-active-bg)';
        item.style.color = 'var(--rv-brand)';
      } else if (isActive) {
        item.style.background = 'var(--rv-surface-subtle)';
        item.style.color = 'var(--rv-text-primary)';
      } else {
        item.style.background = 'transparent';
        item.style.color = 'var(--rv-text-primary)';
      }
    }

    function repaintItems() {
      for (var i = 0; i < itemNodes.length; i++) paintItem(itemNodes[i], i);
    }

    function setActive(index) {
      if (index === activeIndex) return;
      activeIndex = index;
      repaintItems();
      if (index >= 0 && itemNodes[index]) {
        trigger.setAttribute('aria-activedescendant', itemNodes[index].id);
        if (typeof itemNodes[index].scrollIntoView === 'function') {
          try { itemNodes[index].scrollIntoView({ block: 'nearest' }); } catch (e) { /* noop */ }
        }
      } else {
        trigger.removeAttribute('aria-activedescendant');
      }
    }

    function firstEnabled() {
      for (var i = 0; i < options.length; i++) if (!options[i].disabled) return i;
      return -1;
    }

    function lastEnabled() {
      for (var i = options.length - 1; i >= 0; i--) if (!options[i].disabled) return i;
      return -1;
    }

    function stepEnabled(from, delta) {
      if (!options.length) return -1;
      var i = from;
      for (var guard = 0; guard < options.length; guard++) {
        i += delta;
        if (i < 0) i = options.length - 1;
        if (i >= options.length) i = 0;
        if (!options[i].disabled) return i;
      }
      return from;
    }

    // ---- positioning (§11) ---------------------------------------
    function position() {
      if (!panel) return;
      var r = rectOf(trigger);
      var vw = viewportWidth(env);
      var vh = viewportHeight(env);

      // Width: never narrower than the trigger; may grow to the longest
      // real option but only inside the available viewport width.
      var minW = r.width || 0;
      panel.style.minWidth = minW + 'px';
      panel.style.maxWidth = Math.max(minW, vw - (VIEWPORT_MARGIN * 2)) + 'px';

      var panelRect = rectOf(panel);
      var panelH = panelRect.height || 0;
      var panelW = Math.max(panelRect.width || 0, minW);

      var spaceBelow = vh - r.bottom - PANEL_GAP - VIEWPORT_MARGIN;
      var spaceAbove = r.top - PANEL_GAP - VIEWPORT_MARGIN;
      var openAbove = panelH > spaceBelow && spaceAbove > spaceBelow;

      var top = openAbove ? (r.top - PANEL_GAP - panelH) : (r.bottom + PANEL_GAP);
      if (top < VIEWPORT_MARGIN) top = VIEWPORT_MARGIN;
      if (top + panelH > vh - VIEWPORT_MARGIN) {
        top = Math.max(VIEWPORT_MARGIN, vh - VIEWPORT_MARGIN - panelH);
      }

      var left = r.left;
      if (left + panelW > vw - VIEWPORT_MARGIN) left = vw - VIEWPORT_MARGIN - panelW;
      if (left < VIEWPORT_MARGIN) left = VIEWPORT_MARGIN;

      var avail = Math.max(0, (openAbove ? spaceAbove : spaceBelow));
      panel.style.top = top + 'px';
      panel.style.left = left + 'px';
      panel.style.maxHeight = avail > 0
        ? 'min(var(--rv-select-popover-max-h), ' + avail + 'px)'
        : 'var(--rv-select-popover-max-h)';
      panel.setAttribute('data-rv-select-placement', openAbove ? 'above' : 'below');
    }

    // ---- document / window listeners while open -------------------
    function onDocPointerDown(e) {
      var target = e && (e.target || e.srcElement);
      if (target && typeof trigger.contains === 'function' && trigger.contains(target)) return;
      if (target && panel && typeof panel.contains === 'function' && panel.contains(target)) return;
      // Outside click closes WITHOUT a value change and must not steal
      // focus back from whatever the user actually clicked.
      close({ focus: false });
    }

    function onDocKeyDown(e) { handleOpenKey(e); }

    // Repositioning is EVENT driven, never a self-rearming animation loop:
    // a rAF loop cannot be stopped safely in every host, and the panel only
    // needs to move when the viewport does. A trigger that has left the
    // document takes its panel with it rather than becoming an orphan.
    function onViewportChange() {
      if (!isOpen) return;
      if (!isConnectedNode(trigger)) { close({ focus: false }); return; }
      position();
    }

    function bindOpenListeners(bind) {
      var W = env.window;
      var fn = bind ? on : off;
      fn(doc, 'mousedown', onDocPointerDown, true);
      fn(doc, 'keydown', onDocKeyDown, true);
      fn(W, 'resize', onViewportChange, false);
      fn(W, 'scroll', onViewportChange, true);
    }

    // ---- open / close --------------------------------------------
    function open() {
      if (destroyed || isOpen || isDisabled()) return;
      if (openControl && openControl !== api) openControl.close({ focus: false });
      buildPanel();
      var body = doc.body;
      if (body && typeof body.appendChild === 'function') body.appendChild(panel);
      isOpen = true;
      openControl = api;
      trigger.setAttribute('aria-expanded', 'true');
      activeIndex = -1;
      var sel = currentIndex();
      setActive(sel !== -1 && !options[sel].disabled ? sel : firstEnabled());
      position();
      bindOpenListeners(true);
      return api;
    }

    function close(configuration) {
      var opts = configuration || {};
      if (!isOpen) return api;
      bindOpenListeners(false);
      isOpen = false;
      if (openControl === api) openControl = null;
      trigger.setAttribute('aria-expanded', 'false');
      trigger.removeAttribute('aria-activedescendant');
      activeIndex = -1;
      removePanel();
      typeBuffer = '';
      if (opts.focus !== false && typeof trigger.focus === 'function') {
        try { trigger.focus(); } catch (e2) { /* noop */ }
      }
      return api;
    }

    function removePanel() {
      if (!panel) return;
      if (typeof panel.remove === 'function') panel.remove();
      else if (panel.parentNode && typeof panel.parentNode.removeChild === 'function') {
        panel.parentNode.removeChild(panel);
      }
      clearChildren(panel);
      panel = null;
      itemNodes = [];
    }

    // ---- keyboard (§9) -------------------------------------------
    function isPrintable(e) {
      return typeof e.key === 'string' && e.key.length === 1
        && !e.ctrlKey && !e.metaKey && !e.altKey && e.key !== ' ';
    }

    function typeAhead(chr) {
      var now = Date.now();
      if (now - typeStamp > TYPEAHEAD_RESET_MS) typeBuffer = '';
      typeStamp = now;
      typeBuffer += String(chr).toLowerCase();
      for (var i = 0; i < options.length; i++) {
        if (options[i].disabled) continue;
        if (String(options[i].label).toLowerCase().indexOf(typeBuffer) === 0) {
          setActive(i);
          return true;
        }
      }
      return false;
    }

    function handleClosedKey(e) {
      if (isDisabled()) return;
      var key = e.key;
      var sel = currentIndex();
      if (key === 'ArrowDown') {
        e.preventDefault();
        open();
        setActive(sel !== -1 && !options[sel].disabled ? sel : firstEnabled());
      } else if (key === 'ArrowUp') {
        e.preventDefault();
        open();
        setActive(sel !== -1 && !options[sel].disabled ? sel : lastEnabled());
      } else if (key === 'Enter' || key === ' ' || key === 'Spacebar') {
        e.preventDefault();
        open();
      } else if (isPrintable(e)) {
        open();
        if (typeAhead(e.key)) e.preventDefault();
      }
    }

    function handleOpenKey(e) {
      if (!isOpen) return;
      var key = e.key;
      if (key === 'ArrowDown') {
        e.preventDefault();
        setActive(stepEnabled(activeIndex === -1 ? -1 : activeIndex, 1));
      } else if (key === 'ArrowUp') {
        e.preventDefault();
        setActive(stepEnabled(activeIndex === -1 ? options.length : activeIndex, -1));
      } else if (key === 'Home') {
        e.preventDefault();
        setActive(firstEnabled());
      } else if (key === 'End') {
        e.preventDefault();
        setActive(lastEnabled());
      } else if (key === 'Enter' || key === ' ' || key === 'Spacebar') {
        e.preventDefault();
        if (activeIndex !== -1) commit(activeIndex);
        else close({ focus: true });
      } else if (key === 'Escape' || key === 'Esc') {
        e.preventDefault();
        close({ focus: true });
      } else if (key === 'Tab') {
        // Close and let the browser continue normal navigation — no
        // preventDefault, no focus trap.
        close({ focus: false });
      } else if (isPrintable(e)) {
        if (typeAhead(e.key)) e.preventDefault();
      }
    }

    on(trigger, 'keydown', function (e) {
      // While open, the capturing document handler owns the key. It may
      // have just committed and closed on this very event, so a handled
      // key must not fall through and re-open the panel.
      if (isOpen) return;
      if (e && e.defaultPrevented) return;
      handleClosedKey(e);
    });

    on(trigger, 'click', function (e) {
      if (e && e.preventDefault) e.preventDefault();
      if (isDisabled()) return;
      if (isOpen) close({ focus: true }); else open();
    });

    // ---- hover / focus affordances (§10) --------------------------
    on(trigger, 'mouseenter', function () {
      if (isDisabled()) return;
      trigger.style.background = 'var(--rv-surface-subtle)';
      trigger.style.borderColor = 'var(--rv-accent-blue)';
    });
    on(trigger, 'mouseleave', function () {
      if (isDisabled()) return;
      trigger.style.background = 'var(--rv-surface)';
      trigger.style.borderColor = 'var(--rv-border-strong)';
    });
    on(trigger, 'focus', function () {
      if (isDisabled()) return;
      trigger.style.borderColor = 'var(--rv-accent-blue)';
      trigger.style.boxShadow = '0 0 0 3px var(--rv-focus-ring)';
    });
    on(trigger, 'blur', function () {
      trigger.style.borderColor = 'var(--rv-border-strong)';
      trigger.style.boxShadow = 'none';
    });

    // ---- disabled -------------------------------------------------
    function isDisabled() {
      return trigger.getAttribute('disabled') !== null
        && trigger.getAttribute('disabled') !== undefined;
    }

    // Re-entrancy guard. `disabled` is exposed as an accessor on the
    // trigger, and some DOM implementations reflect removeAttribute()
    // back onto the IDL property — which would call this setter again.
    var applyingDisabled = false;
    function applyDisabled(next) {
      if (applyingDisabled) return;
      applyingDisabled = true;
      try { applyDisabledInner(next); } finally { applyingDisabled = false; }
    }

    function applyDisabledInner(next) {
      if (next) {
        trigger.setAttribute('disabled', 'disabled');
        trigger.style.opacity = '.45';
        trigger.style.cursor = 'default';
        if (isOpen) close({ focus: false });
      } else {
        // Only touch the attribute when it is actually present: enabling an
        // already-enabled control must not be a DOM write.
        if (isDisabled()) trigger.removeAttribute('disabled');
        trigger.style.opacity = '1';
        trigger.style.cursor = 'pointer';
      }
    }

    // ---- public API ----------------------------------------------
    var api = trigger;

    Object.defineProperty(trigger, 'value', {
      configurable: true,
      enumerable: false,
      get: function () { return currentValue; },
      set: function (next) {
        // Programmatic assignment: resolve tolerantly, fall back to the
        // empty placeholder state, and never emit a change.
        var v = normalizeValue(next);
        var idx = indexOfValue(v);
        currentValue = idx === -1 ? '' : options[idx].value;
        paintTrigger();
        if (isOpen) { repaintItems(); rebuildOpenPanel(); }
      }
    });

    Object.defineProperty(trigger, 'disabled', {
      configurable: true,
      enumerable: false,
      get: function () { return isDisabled(); },
      set: function (next) { applyDisabled(!!next); }
    });

    function rebuildOpenPanel() {
      if (!isOpen || !panel) return;
      clearChildren(panel);
      itemNodes = [];
      for (var i = 0; i < options.length; i++) {
        itemNodes.push(buildItem(options[i], i));
        panel.appendChild(itemNodes[i]);
      }
      if (activeIndex >= options.length) activeIndex = -1;
      repaintItems();
      position();
    }

    trigger.setOptions = function (nextOptions, configuration) {
      var opts = configuration || {};
      var nextPlaceholder = Object.prototype.hasOwnProperty.call(opts, 'placeholder')
        ? (opts.placeholder === null || opts.placeholder === undefined ? '' : String(opts.placeholder))
        : placeholder;
      placeholder = nextPlaceholder;
      options = normalizeOptions(nextOptions, placeholder);

      // The current value survives when an equivalent option remains, and
      // resets to the empty placeholder state when it no longer exists.
      // Repopulating alone NEVER emits: the caller decides whether the
      // business value changed.
      var desired = Object.prototype.hasOwnProperty.call(opts, 'value')
        ? normalizeValue(opts.value) : currentValue;
      var idx = indexOfValue(desired);
      currentValue = idx === -1 ? '' : options[idx].value;

      paintTrigger();
      rebuildOpenPanel();
      return trigger;
    };

    trigger.setValue = function (nextValue, configuration) {
      var opts = configuration || {};
      trigger.value = nextValue;
      if (opts.emitChange === true) emitChange();
      return trigger;
    };

    trigger.open = open;
    trigger.close = close;

    // control.focus() is the button's own native method — this primitive
    // deliberately adds no second focus owner.

    trigger.destroy = function () {
      if (destroyed) return trigger;
      // The caller owns the trigger's position in the tree; destroy only
      // guarantees no orphaned panel and no live listener survives.
      close({ focus: false });
      destroyed = true;
      return trigger;
    };

    // ---- initial paint --------------------------------------------
    // Canonicalize the incoming value to the matched option's own value,
    // exactly as a native select did: an option with value '1.40' selected
    // by the numeric 1.4 reported '1.40' back, not '1.4'. An unmatched
    // value resolves to the empty placeholder state.
    (function normalizeInitialValue() {
      var idx = indexOfValue(currentValue);
      currentValue = idx === -1 ? '' : options[idx].value;
    })();

    if (cfg.disabled) applyDisabled(true); else applyDisabled(false);
    paintTrigger();

    return trigger;
  }

  // ------------------------------------------------------------------
  // Read-only single-value field presentation (§12).
  //
  // A control with exactly one permanently disabled option is not a
  // selection decision, so it must not render combobox semantics, a
  // popup or a tab stop. Same compact field geometry, value visible.
  // ------------------------------------------------------------------
  function createReadonlyFieldValue(configuration) {
    var cfg = configuration || {};
    var env = resolveEnvironment(cfg);
    var doc = env.document;
    var node = doc.createElement('div');
    node.setAttribute('data-rv-readonly-field', '1');
    node.setAttribute('style', 'box-sizing:border-box; display:flex; align-items:center;'
      + ' height:var(--rv-h-compact); padding-top:0; padding-bottom:0;'
      + ' padding-left:12px; padding-right:12px;'
      + ' border:1px solid var(--rv-border-strong); border-radius:var(--rv-radius);'
      + ' background:var(--rv-surface); color:var(--rv-text-primary);'
      + ' font-size:var(--rv-fs-body); font-family:inherit;'
      + (cfg.widthMode === 'auto' ? '' : ' width:100%;'));
    if (cfg.labelledBy) node.setAttribute('aria-labelledby', String(cfg.labelledBy));
    else if (cfg.ariaLabel) node.setAttribute('aria-label', String(cfg.ariaLabel));
    setText(node, cfg.text === null || cfg.text === undefined ? '' : String(cfg.text));
    return node;
  }

  globalWindow.createSelectPopover = createSelectPopover;
  globalWindow.createReadonlyFieldValue = createReadonlyFieldValue;
})(typeof window !== 'undefined' ? window : this);
