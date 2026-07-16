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
  const node = el('div', {
    class: 'toast text-white px-4 py-2 rounded-lg shadow-lg ' + (colors[type] || colors.info)
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
  const card = el('div', { class: 'bg-white rounded-lg shadow-xl border border-[#eceef1] w-full max-w-lg max-h-[90vh] flex flex-col' });
  const header = el('div', { class: 'px-6 py-4 border-b border-[#eceef1] flex justify-between items-center' },
    el('h2', { class: 'text-base font-bold text-[#16203a]' }, title),
    el('button', { class: 'text-gray-400 hover:text-gray-700 text-2xl leading-none', onclick: close }, '×')
  );
  const content = el('div', { class: 'px-6 py-4 overflow-y-auto flex-1' }, body);

  const btnCancel = el('button', { type: 'button',
    class: 'px-4 py-2 rounded border border-[#d8dce2] text-[#3f4757] font-semibold hover:bg-gray-50', onclick: close }, 'Cancelar');
  const btnSave = el('button', { type: 'button',
    class: 'px-5 py-2 rounded text-white font-bold ' + (danger ? 'bg-red-600 hover:bg-red-700' : 'bg-[#2563eb] hover:bg-[#1e56d6]'),
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

  const footer = el('div', { class: 'px-6 py-4 border-t border-[#eceef1] flex justify-end gap-2' }, btnCancel, btnSave);

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
function formField({ label, input, hint }) {
  const wrap = el('div', { class: 'mb-4' });
  wrap.appendChild(el('label', { class: 'block text-sm font-medium text-gray-700 mb-1' }, label));
  wrap.appendChild(input);
  if (hint) wrap.appendChild(el('p', { class: 'text-xs text-gray-500 mt-1' }, hint));
  return wrap;
}

// --- Input texto/email/numero padrão ---
function textInput({ type = 'text', value = '', placeholder = '', required = false, step }) {
  const attrs = { type, placeholder,
    class: 'w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500' };
  if (required) attrs.required = 'required';
  if (step) attrs.step = step;
  const input = el('input', attrs);
  input.value = value;
  return input;
}

// --- Select padrão ---
function selectInput({ options, value, placeholder = 'Selecione...' }) {
  const sel = el('select', {
    class: 'w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500'
  });
  sel.appendChild(el('option', { value: '' }, placeholder));
  // Comparação tolerante: o banco devolve numeric como 1.4, options podem ter '1.40' como string.
  const valStr = value == null ? '' : String(value);
  const valNum = valStr === '' ? null : Number(valStr);
  for (const opt of options) {
    const o = el('option', { value: opt.value }, opt.label);
    const optStr = String(opt.value);
    const optNum = optStr === '' ? null : Number(optStr);
    const matches = optStr === valStr
      || (valNum !== null && optNum !== null && !Number.isNaN(valNum) && !Number.isNaN(optNum) && valNum === optNum);
    if (matches) o.selected = true;
    sel.appendChild(o);
  }
  return sel;
}

// --- Tabela de dados ---
// Uso: dataTable({columns: [{key, label, render?}], rows, actions: [{label, onclick, class?}]})
function dataTable({ columns, rows, actions = [] }) {
  const wrap = el('div', { class: 'bg-white rounded-xl shadow overflow-hidden' });
  if (rows.length === 0) {
    wrap.appendChild(el('div', { class: 'p-8 text-center text-gray-500' }, 'Nenhum registro ainda.'));
    return wrap;
  }
  const table = el('table', { class: 'w-full' });
  const thead = el('thead', { class: 'bg-gray-50 border-b' });
  const trHead = el('tr', {});
  for (const col of columns) trHead.appendChild(el('th', { class: 'px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase' }, col.label));
  if (actions.length) trHead.appendChild(el('th', { class: 'px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase' }, 'Ações'));
  thead.appendChild(trHead);

  const tbody = el('tbody', { class: 'divide-y divide-gray-100' });
  for (const row of rows) {
    const tr = el('tr', { class: 'hover:bg-gray-50' });
    for (const col of columns) {
      const cellValue = col.render ? col.render(row) : (row[col.key] ?? '');
      const td = el('td', { class: 'px-4 py-3 text-sm text-gray-800' });
      if (cellValue instanceof Node) td.appendChild(cellValue); else td.textContent = String(cellValue);
      tr.appendChild(td);
    }
    if (actions.length) {
      const td = el('td', { class: 'px-4 py-3 text-right' });
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
  wrap.appendChild(table);
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
  wrap.appendChild(el('h1', { class: 'text-2xl font-bold' }, title));
  const actWrap = el('div', { class: 'flex gap-2' });
  for (const a of actions) {
    actWrap.appendChild(el('button', {
      class: 'bg-blue-700 hover:bg-blue-800 text-white font-semibold px-4 py-2 rounded-lg',
      onclick: a.onclick
    }, a.label));
  }
  wrap.appendChild(actWrap);
  return wrap;
}
