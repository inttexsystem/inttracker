// =====================================================================
// === UI PRIMITIVES (Seam A) ==========================================
// Helpers de DOM e componentes de UI — sem Supabase, sem estado de app,
// sem regra de negócio. Extraído de index.html. Carregar ANTES do
// <script> principal. Usa apenas document e os ids #app / #toasts.
// =====================================================================
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// HTML boolean attributes: in any real browser, the attribute's mere
// presence makes it true, regardless of its string value —
// setAttribute('disabled', false) still stringifies to "false" and still
// renders as disabled. This allow-list is where el() must turn a JS-falsy
// value (false/null/undefined) into attribute REMOVAL instead of a
// stringified falsy value (UI-EL-BOOLEAN-ATTR-FIX). Deliberately narrow —
// keys outside this list (including aria-* attributes, which take a
// literal "true"/"false" string by spec, not a native boolean) keep the
// original setAttribute(k, v) behavior untouched, so e.g. value="false" as
// a string still survives as-is.
const BOOLEAN_ATTRS = new Set([
  'checked', 'disabled', 'selected', 'readonly', 'required', 'multiple',
  'hidden', 'open', 'autofocus', 'autoplay', 'controls', 'default',
  'defer', 'ismap', 'loop', 'muted', 'novalidate', 'reversed',
]);

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v;
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else if (BOOLEAN_ATTRS.has(k)) {
      if (v) node.setAttribute(k, k);
      else node.removeAttribute(k);
    }
    else node.setAttribute(k, v);
  }
  for (const child of children.flat()) {
    if (child == null || child === false) continue;
    node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
  }
  return node;
}

function toast(message, type = 'info') {
  const colors = { info: 'bg-blue-600', success: 'bg-green-600', error: 'bg-red-600' };
  // Pass-4: the toast is a nonmodal banner, so it takes the canonical small
  // elevation. Tailwind no longer owns any product shadow.
  const node = el('div', {
    style: 'border-radius:var(--rv-radius); box-shadow:var(--rv-shadow-sm);',
    class: 'toast text-white px-4 py-2 ' + (colors[type] || colors.info)
  }, message);
  $('#toasts').appendChild(node);
  setTimeout(() => node.remove(), 4000);
}

function getAppRoot() {
  const root = document.getElementById('app');
  if (!root) {
    throw new Error('App root #app not found');
  }
  return root;
}

function setApp(node) {
  const app = getAppRoot();
  app.replaceChildren(node);
}

// --- Barra de ações de modal (dono canônico) ---
// ACTION-CONTAINMENT-A1 §6. This is the SINGLE owner of the modal action-bar
// role. Before this pass six independent bars existed — the generic modal()
// bar below plus five screen-local ones — and they disagreed on gap (8 / 10 /
// 12px), on horizontal padding (20 / 22 / 24px) and on the divider colour
// (a literal #eceef1, var(--rv-border) and var(--rv-border-soft)). The
// generic one also declared its geometry through Tailwind utilities, so a
// static guard anchored on inline style text could not even see it.
//
// The bar carries `data-rv-modal-actions`, which is the contract declaration
// itself: "this element is a modal action bar". It is deliberately NOT
// `data-card-actions` — a modal action bar is full-bleed and is held outside
// the in-card footer contract (UIC-008), a separation ratified in phase-5
// pass 5 and preserved here.
//
// The role owns geometry ONLY. It creates no state, no handler and no
// business behaviour: the caller keeps its own buttons, its own labels, its
// own ordering and its own onclick functions, and simply hands them over.
//
// Uso: modalActionBar([btnCancel, btnSave])
//   - children: a node, an array of nodes, or nested arrays. null / false
//     entries are skipped, matching el()'s own child contract.
//   - options.marginTop: outer spacing OWNED BY THE CALLER, not by the bar.
//     Only the cliente add-item modal needs it, because its bar is separated
//     from the body instead of sitting flush against it. It is a named
//     option rather than a free style escape hatch precisely so the canonical
//     six declarations below can never be overridden by a caller.
//   - options.el: element factory injection. The five screen-local consumers
//     all reach this helper through `window.`, so none needs it today; it
//     exists so a consumer running under a stub factory can still build the
//     canonical bar instead of forking the geometry.
const MODAL_ACTION_BAR_STYLE = 'display:flex; align-items:center; justify-content:flex-end;'
  + ' gap:10px; padding:14px 20px; border-top:1px solid var(--rv-border-soft);';

function modalActionBar(children, options) {
  const opts = options || {};
  const factory = typeof opts.el === 'function' ? opts.el : el;
  const style = opts.marginTop
    ? MODAL_ACTION_BAR_STYLE + ' margin-top:' + opts.marginTop + ';'
    : MODAL_ACTION_BAR_STYLE;
  const bar = factory('div', { 'data-rv-modal-actions': '', style });
  for (const child of [].concat(children || []).flat()) {
    if (child == null || child === false) continue;
    bar.appendChild(child);
  }
  return bar;
}

// --- Modal genérico ---
// Uso: modal({title, body: node, onSave, saveLabel='Salvar'})
function modal({ title, body, onSave, saveLabel = 'Salvar', onClose, danger = false }) {
  const overlay = el('div', {
    class: 'fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-40',
    onclick: (e) => { if (e.target === overlay) close(); }
  });

  function close() {
    overlay.remove();
    document.removeEventListener('keydown', escListener);
    if (onClose) onClose();
  }
  function escListener(e) { if (e.key === 'Escape') close(); }
  document.addEventListener('keydown', escListener);

  // Padrao visual atual: cantos pouco arredondados, borda clara, espacamento
  // limpo e botoes consistentes com o restante da UI (#2563eb / borda #d8dce2).
  // Pass-4: the generic modal card takes the canonical popover elevation
  // (contract §2.10). Tailwind no longer owns any product shadow.
  const card = el('div', { style: 'border-radius:var(--rv-radius); box-shadow:var(--rv-shadow-popover);', class: 'bg-white border border-[#eceef1] w-full max-w-lg max-h-[90vh] flex flex-col' });
  const header = el('div', { class: 'px-6 py-4 border-b border-[#eceef1] flex justify-between items-center' },
    // Pass-6: css/tokens.css owns typography. The modal title is a
    // COMPONENT_HEADING and the close "×" is an icon-only text glyph, so each
    // takes its own semantic token instead of a Tailwind size utility.
    el('h2', { style: 'font-size:var(--rv-fs-component-heading);', class: 'font-bold text-[#16203a]' }, title),
    el('button', { style: 'font-size:var(--rv-icon-glyph-lg);', class: 'text-gray-400 hover:text-gray-700 leading-none', onclick: close }, '×')
  );
  const content = el('div', { class: 'px-6 py-4 overflow-y-auto flex-1' }, body);

  const btnCancel = el('button', { type: 'button', style: 'border-radius:var(--rv-radius);',
    class: 'px-4 py-2 border border-[#d8dce2] text-[#3f4757] font-semibold hover:bg-gray-50', onclick: close }, 'Cancelar');
  const btnSave = el('button', { type: 'button', style: 'border-radius:var(--rv-radius);',
    class: 'px-5 py-2 text-white font-bold ' + (danger ? 'bg-red-600 hover:bg-red-700' : 'bg-[#2563eb] hover:bg-[#1e56d6]'),
    onclick: async () => {
      btnSave.disabled = true;
      btnSave.textContent = 'Salvando...';
      try {
        const result = await onSave();
        if (result !== false) close();
      } finally {
        btnSave.disabled = false;
        btnSave.textContent = saveLabel;
      }
    }
  }, saveLabel);

  // A1: the generic modal now consumes the canonical owner instead of
  // declaring its own Tailwind geometry. Both buttons, their handlers and
  // their order are unchanged.
  const footer = modalActionBar([btnCancel, btnSave]);

  card.appendChild(header);
  card.appendChild(content);
  card.appendChild(footer);
  overlay.appendChild(card);
  document.body.appendChild(overlay);

  return { close };
}

// --- Confirmação destrutiva ---
function confirmDialog({ title, message, confirmLabel = 'Confirmar', danger = true, onConfirm }) {
  const body = el('p', { class: 'text-gray-700' }, message);
  modal({
    title,
    body,
    saveLabel: confirmLabel,
    danger: danger,
    onSave: async () => {
      await onConfirm();
    }
  });
}

// --- Campo de formulário (label + input/select/etc) ---
let formFieldSeq = 0;
function formField({ label, input, hint }) {
  const wrap = el('div', { class: 'mb-4' });
  const labelNode = el('label', { class: 'block text-sm font-medium text-gray-700 mb-1' }, label);
  // Pass-7: a select popover is a <button role="combobox">, so the visible
  // label cannot name it implicitly the way a wrapping <label> names a
  // native control. When the caller supplied no explicit name, bind the
  // visible label to the trigger — no interactive trigger may be unnamed.
  if (input && typeof input.getAttribute === 'function'
      && input.getAttribute('data-rv-select-popover')
      && !input.getAttribute('aria-labelledby') && !input.getAttribute('aria-label')) {
    formFieldSeq += 1;
    const labelId = 'rv-field-label-' + formFieldSeq;
    labelNode.setAttribute('id', labelId);
    input.setAttribute('aria-labelledby', labelId);
  }
  wrap.appendChild(labelNode);
  wrap.appendChild(input);
  if (hint) wrap.appendChild(el('p', { class: 'text-xs text-gray-500 mt-1' }, hint));
  return wrap;
}

// --- Input texto/email/numero padrão ---
function textInput({ type = 'text', value = '', placeholder = '', required = false, step }) {
  // Pass-3 §8: this is the canonical shared owner of single-line field
  // geometry, so the ratified compact rung is declared here rather than left
  // to a screen-local override. `py-2` is removed because a fixed border-box
  // height plus 8px of vertical padding clips the text; horizontal padding is
  // unchanged. A native input centres its own value vertically.
  const attrs = { type, placeholder,
    style: 'height:var(--rv-h-compact); border-radius:var(--rv-radius);',
    class: 'w-full border px-3 focus:outline-none focus:ring-2 focus:ring-blue-500' };
  if (required) attrs.required = 'required';
  if (step) attrs.step = step;
  const input = el('input', attrs);
  input.value = value;
  return input;
}

// --- Select padrão ---
// Pass-7 (UIC-006): this is now a THIN COMPATIBILITY ADAPTER. It keeps the
// external argument shape every existing caller already passes and returns
// the canonical select-popover trigger. It builds no native <select>, no
// native <option> and no hidden native value owner — js/select-popover.js
// is the single owner of the control, its geometry (--rv-h-compact), its
// accessibility contract and its tolerant numeric value matching.
function selectInput({ options, value, placeholder = 'Selecione...', ariaLabel, labelledBy, disabled }) {
  return createSelectPopover({
    options,
    value,
    placeholder,
    ariaLabel,
    labelledBy,
    disabled,
    widthMode: 'block',
  });
}

// --- Tabela de dados ---
// UI_VISUAL_CONTRACT.md §2.5 — golden rule. The width and alignment of a
// column's HEADER must be identical to those of its VALUES. This helper is the
// single owner of that guarantee for every dataTable() surface, so no call site
// may reimplement it (phase-5 pass 8):
//
//   - `table-layout: fixed` plus ONE <colgroup> whose <col> order matches the
//     rendered column order exactly, including the actions column;
//   - alignment declared once per column and repeated on `th` and `td`;
//   - `numeric: true` implies right-aligned header AND value plus `data-num`
//     on the value cell, which is the canonical tabular-numeral owner in
//     css/tokens.css (`.tnum, [data-num]`).
//
// The contract is DECLARATIVE. Nothing here inspects label text to guess that a
// column is numeric, and nothing measures runtime content to guess a width: a
// column is numeric only when the call site says so, and is only as wide as the
// call site declares. Columns with no declared width share the remaining space
// equally, which `table-layout: fixed` resolves deterministically.
//
// When the resulting contract declares any FIXED-PIXEL column the table gains
// the canonical `data-rv-table-scroll` owner (css/responsive.css) rather than a
// second overflow system, so a wide table scrolls locally and never pushes the
// document.
//
// Uso: dataTable({
//   columns: [{ key, label, render?, width?, align?, numeric? }],
//   rows,
//   actions: [{ label, onclick, class? }],
//   actionsWidth?, minWidth?
// })
function dataTable({ columns, rows, actions = [], actionsWidth, minWidth }) {
  const wrap = el('div', { style: 'border-radius:var(--rv-radius);', class: 'bg-white shadow overflow-hidden' });
  if (rows.length === 0) {
    wrap.appendChild(el('div', { class: 'p-8 text-center text-gray-500' }, 'Nenhum registro ainda.'));
    return wrap;
  }

  // One resolved descriptor per RENDERED column, actions included. Everything
  // below — colgroup, header, values — walks this single list, so the three can
  // never disagree about the count, the order or the alignment.
  const hasActions = actions.length > 0;
  const layout = columns.map((col) => ({
    width: col.width || null,
    align: col.align || (col.numeric ? 'right' : 'left'),
    numeric: col.numeric === true,
  }));
  if (hasActions) layout.push({ width: actionsWidth || null, align: 'right', numeric: false });

  const table = el('table', { class: 'w-full', style: 'table-layout:fixed;' });

  const colgroup = el('colgroup', {});
  for (const spec of layout) {
    colgroup.appendChild(spec.width ? el('col', { style: 'width:' + spec.width + ';' }) : el('col', {}));
  }
  table.appendChild(colgroup);

  const thead = el('thead', { class: 'bg-gray-50 border-b' });
  const trHead = el('tr', {});
  columns.forEach((col, i) => {
    trHead.appendChild(el('th', {
      class: 'px-4 py-3 text-' + layout[i].align + ' text-xs font-semibold text-gray-600 uppercase',
    }, col.label));
  });
  // A1 §8: `data-rv-table-actions` declares the action COLUMN owner. It lands
  // on the header cell and on every value cell of that column, and nowhere
  // else — never on a data cell, a badge or a button. Alignment, order,
  // classes, the colgroup entry and `data-num` are untouched.
  if (hasActions) trHead.appendChild(el('th', { 'data-rv-table-actions': '', class: 'px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase' }, 'Ações'));
  thead.appendChild(trHead);

  const tbody = el('tbody', { class: 'divide-y divide-gray-100' });
  for (const row of rows) {
    const tr = el('tr', { class: 'hover:bg-gray-50' });
    columns.forEach((col, i) => {
      const cellValue = col.render ? col.render(row) : (row[col.key] ?? '');
      // `data-num` only ever lands on a declared numeric VALUE cell — never on
      // a button, a badge or an action container.
      const attrs = { class: 'px-4 py-3 text-sm text-gray-800 text-' + layout[i].align };
      if (layout[i].numeric) attrs['data-num'] = '1';
      const td = el('td', attrs);
      if (cellValue instanceof Node) td.appendChild(cellValue); else td.textContent = String(cellValue);
      tr.appendChild(td);
    });
    if (hasActions) {
      const td = el('td', { 'data-rv-table-actions': '', class: 'px-4 py-3 text-right' });
      for (const a of actions) {
        const cls = a.class || 'text-blue-700 hover:underline';
        const lbl = typeof a.label === 'function' ? a.label(row) : a.label;
        td.appendChild(el('button', { class: 'text-sm ml-3 ' + cls, onclick: () => a.onclick(row) }, lbl));
      }
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  }
  table.appendChild(thead);
  table.appendChild(tbody);

  // A fixed-pixel column cannot shrink, so the table needs its OWN scroll
  // owner. `data-rv-table-scroll` already carries overflow-x/max-width/min-width
  // in css/responsive.css; this adds no second mechanism.
  const hasFixedPx = layout.some((spec) => spec.width && /px\s*$/.test(spec.width));
  if (hasFixedPx) {
    if (minWidth) table.style.minWidth = minWidth;
    wrap.appendChild(el('div', { 'data-rv-table-scroll': '', style: 'overflow-x:auto;' }, table));
  } else {
    wrap.appendChild(table);
  }
  return wrap;
}

// --- Row-level compact icon button (UI_VISUAL_CONTRACT.md §8.1) ---
// Ratified against the Clients screen reference
// (js/screens/cadastros.js's screenCadastrosClientes makeIconButton).
// Renders the 30x30px icon-only button used for table/grid row actions
// (Editar, Ver, Ativar/Desativar, Resetar, Excluir, ...) — exempt from
// the destructive-button icon+text rule in §8, which stays binding for
// entity-level header actions (Finalizar OP / Excluir OP, as in the
// op-latex-admin.js / op-tecelagem-producao-admin.js pilots).
//
// Contract-mandated guards enforced here:
//   - title tooltip + aria-label (both set from `title`);
//   - screen-reader label via the clip-rect sr-only pattern (never
//     display:none, which also hides it from assistive tech).
// confirmDialog gating on destructive actions is the CALLER's duty —
// this helper only renders the button; it has no notion of whether
// `onclick` is destructive.
//
// Uso: actionButton({ title, icon, danger, disabled, onclick, srLabel })
//   - icon: a DOM Node (caller builds the 14px svg icon per §13).
//   - srLabel: visually-hidden text; defaults to `title`.
//   - disabled: the safe boolean pattern (UI-EL-BOOLEAN-ATTR-FIX) — the
//     `disabled` key only enters the attrs object when this is `true`.
function actionButton({ title, icon, danger = false, disabled = false, onclick, srLabel }) {
  const restBorder = '#eceef1';
  const restColor = danger ? '#d6403a' : '#8a93a3';
  const hoverBorder = danger ? '#fca5a5' : '#d0d5de';
  const hoverBg = danger ? '#fff1f1' : '#fff';
  const hoverColor = danger ? '#c53030' : '#3f4757';

  const attrs = {
    type: 'button',
    title,
    'aria-label': title,
    style: `width:30px; height:30px; display:inline-flex; align-items:center; justify-content:center; `
      + `border:1px solid ${restBorder}; border-radius:4px; background:#fff; color:${restColor}; `
      + `cursor:${disabled ? 'default' : 'pointer'}; opacity:${disabled ? '0.45' : '1'}; `
      + `transition:border-color .18s ease, color .18s ease, background .18s ease;`,
  };
  if (disabled) attrs.disabled = true;
  if (!disabled && typeof onclick === 'function') attrs.onclick = onclick;

  const button = el('button', attrs);

  if (!disabled) {
    button.addEventListener('mouseenter', () => {
      button.style.borderColor = hoverBorder;
      button.style.background = hoverBg;
      button.style.color = hoverColor;
    });
    button.addEventListener('mouseleave', () => {
      button.style.borderColor = restBorder;
      button.style.background = '#fff';
      button.style.color = restColor;
    });
  }

  if (icon) button.appendChild(icon);

  button.appendChild(el('span', {
    style: 'position:absolute; width:1px; height:1px; padding:0; margin:-1px; '
      + 'overflow:hidden; clip:rect(0,0,0,0); white-space:nowrap; border:0;',
  }, srLabel || title));

  return button;
}

// --- Grid/list text-cell overflow (UI_VISUAL_CONTRACT.md §7.1) ---
// Promoted from js/screens/admin-usuarios.js (UI-USERS-GRID-TEXT-OVERFLOW).
// Single-line ellipsis cell with a `title` tooltip carrying the full value
// (mandatory — ellipsis without a reveal trades one usability bug for
// another). `min-width:0` is required for ellipsis to work inside a CSS
// grid track (grid items default to min-width:auto, which ignores
// overflow:hidden). `title` is only set when there is a real value, so
// fallback dashes ("—") never show a useless "—" tooltip.
const TRUNCATE_CELL_STYLE = 'white-space:nowrap; overflow:hidden; text-overflow:ellipsis; min-width:0;';
window.TRUNCATE_CELL_STYLE = TRUNCATE_CELL_STYLE;
function truncatedCell(displayText, rawValue, colorStyle) {
  const attrs = { style: `${colorStyle} ${TRUNCATE_CELL_STYLE}` };
  if (rawValue) attrs.title = rawValue;
  return el('div', attrs, displayText);
}

// --- Page header padrão (título + botão de ação) ---
function pageHeader(title, actions = []) {
  const wrap = el('div', { class: 'flex justify-between items-center mb-4' });
  // Pass-6: the page-header title is a PAGE_TITLE; Tailwind no longer owns it.
  wrap.appendChild(el('h1', { style: 'font-size:var(--rv-fs-title);', class: 'font-bold' }, title));
  // A1 §7: `data-rv-page-actions` declares this element as THE page-header
  // action group. pageHeader() is the single owner of that role across all
  // of its call sites, so no screen reimplements the grouping. The existing
  // Tailwind `flex gap-2` layout is unchanged: A1 authorized adding
  // `align-items:center` / `flex-wrap:wrap` only if rendering proved them
  // necessary, and measurement said otherwise. The parent row already centres
  // via `items-center`, and the widest real call site — op-latex-admin.js's
  // three-action header (Voltar / Ir para OP de tecelagem / Excluir OP) —
  // measured 258px wide at a 390px viewport, clearing the title and clipping
  // nothing, so there is no wrap to accommodate.
  const actWrap = el('div', { 'data-rv-page-actions': '', class: 'flex gap-2' });
  for (const a of actions) {
    // Pass-6 A1: the PRIMARY PAGE ACTION owns its own typography and height.
    // It used to declare neither, so it inherited the 16px document default and
    // took its height from `py-2` — 40px, off the canonical ladder. The vertical
    // Tailwind padding is removed because it competes with the explicit height;
    // `px-4` keeps the horizontal 16px exactly as it was.
    actWrap.appendChild(el('button', {
      style: 'border-radius:var(--rv-radius); font-size:var(--rv-fs-body);'
        + ' height:var(--rv-h-primary); padding-top:0; padding-bottom:0;'
        + ' display:inline-flex; align-items:center; justify-content:center;',
      class: 'bg-blue-700 hover:bg-blue-800 text-white font-semibold px-4',
      onclick: a.onclick
    }, a.label));
  }
  wrap.appendChild(actWrap);
  return wrap;
}
