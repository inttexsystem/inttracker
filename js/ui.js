// =====================================================================
// === UI PRIMITIVES (Seam A) ==========================================
// Helpers de DOM e componentes de UI — sem Supabase, sem estado de app,
// sem regra de negócio. Extraído de index.html. Carregar ANTES do
// <script> principal. Usa apenas document e os ids #app / #toasts.
// =====================================================================
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v;
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
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
function modal({ title, body, onSave, saveLabel = 'Salvar', onClose }) {
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
    class: 'px-5 py-2 rounded bg-[#2563eb] hover:bg-[#1e56d6] text-white font-bold',
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
