// =====================================================================
// === ADMIN USUARIOS SCREEN (Camada 2 — A3.1) ===========================
// Extraído 1:1 de js/screens/cadastros.js (screenCadastrosUsuarios,
// linhas 2226-2713), sem alteração visual ou de comportamento. Tela de
// administração de usuários: listar, buscar, alternar "mostrar
// inativos", criar/editar (via modal), desativar, excluir.
//
// Escopo desta extração (A3.1): paridade 1:1 com a tela anterior.
// Cards-resumo, toolbar busca/ordenar/filtro avançada e coluna "último
// acesso" são A3.2 (gate de mockup próprio) — NÃO incluídos aqui.
//
// Nota de escopo: a função `render()` original de cadastros.js
// (dataTable() genérico, cadastros.js:2266-2317) nunca era chamada —
// `reload()` só chamava `renderStandalone()` (cadastros.js:2263). Por
// ser código morto e inalcançável, não foi portado para este módulo:
// omiti-lo não altera nenhum comportamento observável. Ver relatório de
// closeout desta fase para detalhe.
//
// Carregar via <script src="js/screens/admin-usuarios.js"></script> no
// <head>, DEPOIS de js/screens/admin-usuarios-modal.js e ANTES de
// js/boot.js.
//
// Dependências resolvidas em tempo de chamada (não no load):
//   - window.el / window.shellLayout / window.ADMIN_MENU
//   - window.RAVATEX_ADMIN_USUARIOS_WRITES   (js/admin-usuarios-writes.js)
//   - window.RAVATEX_ADMIN_USUARIOS_MODAL    (js/screens/admin-usuarios-modal.js)
//   - window.supa, window.CURRENT_USER
//
// Compatibilidade: expõe window.screenAdminUsuarios. A rota
// #/cadastros/usuarios passa a apontar para esta função em js/boot.js
// (troca de handler, mesma fase). window.screenCadastrosUsuarios
// permanece em cadastros.js, intocado, até a remoção isolada em A3.4.
// =====================================================================

(function (window) {
  'use strict';

  async function screenAdminUsuarios() {
    const W = window.RAVATEX_ADMIN_USUARIOS_WRITES;
    const M = window.RAVATEX_ADMIN_USUARIOS_MODAL;
    const container = window.el('div', {});
    let mostrarInativos = false;
    let allUsers = [];
    let allForns = [];
    let allClients = [];
    let busca = '';
    let columnSupport = { observacoes: false };

    function svgIcon(markup) {
      var tmp = document.createElement('div');
      tmp.innerHTML = markup.trim();
      return tmp.firstChild;
    }

    var ICON_PLUS = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>';
    var ICON_SEARCH = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9aa2af" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>';
    var ICON_SQUARE_PEN = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4z"></path></svg>';
    var ICON_BAN = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"></circle><path d="M5.7 5.7l12.6 12.6"></path></svg>';
    var ICON_TRASH = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path><path d="M10 11v6M14 11v6"></path><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path></svg>';

    async function reload() {
      columnSupport = await W.detectOptionalColumns('usuarios', ['observacoes']);
      const { users, forns, clients, error } = await W.fetchUsuariosPageData(columnSupport);
      if (error) { window.toast('Erro ao carregar', 'error'); console.error(error); return; }
      allUsers = users;
      allForns = forns;
      allClients = clients;
      renderStandalone();
    }

    function renderStandalone() {
      const meId = (window.CURRENT_USER && window.CURRENT_USER.id) || null;
      const baseRows = mostrarInativos ? allUsers : allUsers.filter((u) => u.ativo !== false);
      const rows = busca
        ? baseRows.filter((u) => [u.email, u.nome, u.tipo, u.fornecedor?.nome, u.cliente?.nome, u.ativo === false ? 'inativo' : 'ativo'].join(' ').toLowerCase().includes(busca.trim().toLowerCase()))
        : baseRows;

      const page = window.el('div', { style: 'display:flex; flex-direction:column;' });
      const header = window.el('div', {
        style: 'display:flex; align-items:center; justify-content:space-between; gap:16px; flex-wrap:wrap; margin-bottom:20px;'
      });
      header.appendChild(window.el('div', {},
        window.el('div', { style: 'font-size:22px; font-weight:800; color:#16203a; letter-spacing:-.01em;' }, 'Usuarios'),
        window.el('div', { style: 'font-size:13px; color:#8a93a3; margin-top:3px;' }, 'Gerencie acessos, vinculos e status de usuarios administrativos.')
      ));
      header.appendChild(window.el('button', {
        type: 'button',
        onclick: () => M.openUsuarioModal(null, allForns, allClients, columnSupport, { onSaved: reload }),
        style: 'display:inline-flex; align-items:center; gap:7px; background:#2563eb; color:#fff; border:none; border-radius:4px; padding:9px 16px; font-weight:600; font-size:14px; font-family:inherit; cursor:pointer;'
      }, svgIcon(ICON_PLUS), window.el('span', {}, 'Novo usuario')));

      const controls = window.el('div', { style: 'display:flex; align-items:center; gap:12px; margin-bottom:14px; flex-wrap:wrap;' });
      const searchWrap = window.el('div', {
        style: 'display:flex; align-items:center; gap:8px; flex:1 1 520px; min-width:280px; background:#fff; border:1px solid #d8dce2; border-radius:4px; padding:8px 13px;'
      });
      searchWrap.appendChild(svgIcon(ICON_SEARCH));
      searchWrap.appendChild(window.el('input', {
        type: 'search',
        value: busca,
        placeholder: 'Buscar por e-mail, nome, tipo ou vinculo...',
        oninput: (e) => { busca = e.target.value || ''; renderStandalone(); },
        style: 'width:100%; border:0; outline:none; background:transparent; font-size:13px; color:#16203a; padding:0; font-family:inherit;'
      }));
      controls.appendChild(searchWrap);
      const toggle = window.el('label', { style: 'display:inline-flex; align-items:center; gap:8px; font-size:13px; color:#5b6472; user-select:none; cursor:pointer; white-space:nowrap;' });
      toggle.appendChild(window.el('input', {
        type: 'checkbox',
        checked: mostrarInativos,
        onchange: (ev) => { mostrarInativos = !!ev.target.checked; renderStandalone(); }
      }));
      toggle.appendChild(window.el('span', {}, 'Mostrar inativos'));
      controls.appendChild(toggle);
      page.appendChild(window.el('span', {
        style: 'position:absolute; width:1px; height:1px; padding:0; margin:-1px; overflow:hidden; clip:rect(0,0,0,0); white-space:nowrap; border:0;'
      }, '+ Novo usuário Desativar'));

      const tableWrap = window.el('div', { style: 'display:flex; flex-direction:column;' });
      const card = window.el('div', { style: 'background:#fff; border:1px solid #eceef1; border-radius:6px 6px 0 0; overflow:hidden;' });
      const gridTemplate = '1.3fr 1fr 110px 1fr 1fr 90px 102px';
      const headRow = window.el('div', { style: `display:grid; grid-template-columns:${gridTemplate}; align-items:center; gap:16px; padding:10px 18px; background:#f8f9fb; border-bottom:1px solid #eceef1;` });
      ['E-MAIL', 'NOME', 'TIPO', 'FORNECEDOR', 'CLIENTE', 'STATUS'].forEach((label) => {
        headRow.appendChild(window.el('div', { style: 'font-size:11px; font-weight:700; color:#8a93a3; letter-spacing:.04em; white-space:nowrap;' }, label));
      });
      headRow.appendChild(window.el('div', { style: 'font-size:11px; font-weight:700; color:#8a93a3; letter-spacing:.04em; text-align:center; white-space:nowrap;' }, 'ACOES'));
      card.appendChild(headRow);

      rows.forEach((user, index) => {
        const line = window.el('div', { style: `display:grid; grid-template-columns:${gridTemplate}; align-items:center; gap:16px; padding:13px 18px; border-bottom:${index === rows.length - 1 ? '0' : '1px solid #f1f3f6'};` });
        line.appendChild(window.el('div', { style: 'font-size:13.5px; color:#3f4757;' }, user.email || ''));
        line.appendChild(window.el('div', { style: 'font-size:14px; font-weight:500; color:#16203a;' }, user.nome || '—'));
        line.appendChild(window.el('div', { style: 'font-size:13.5px; color:#3f4757;' }, user.tipo || ''));
        line.appendChild(window.el('div', { style: `font-size:13.5px; color:${user.fornecedor?.nome ? '#3f4757' : '#aab2bf'};` }, user.fornecedor?.nome || '—'));
        line.appendChild(window.el('div', { style: `font-size:13.5px; color:${user.cliente?.nome ? '#3f4757' : '#aab2bf'};` }, user.cliente?.nome || '—'));
        line.appendChild(window.el('div', {},
          window.el('span', {
            style: `display:inline-flex; align-items:center; border-radius:4px; padding:3px 9px; font-size:12px; font-weight:600; white-space:nowrap; background:${user.ativo === false ? '#fff1f1' : '#e6f4ec'}; color:${user.ativo === false ? '#d6403a' : '#18794a'};`
          }, user.ativo === false ? 'Inativo' : 'Ativo')
        ));
        const actions = window.el('div', { style: 'display:flex; align-items:center; justify-content:center; gap:6px;' });
        actions.appendChild(window.el('button', { type: 'button', onclick: () => M.openUsuarioModal(user, allForns, allClients, columnSupport, { onSaved: reload }), title: 'Editar usuario', 'aria-label': 'Editar usuario', style: 'width:30px; height:30px; display:inline-flex; align-items:center; justify-content:center; border:1px solid #eceef1; border-radius:4px; background:#fff; color:#8a93a3; cursor:pointer;' }, svgIcon(ICON_SQUARE_PEN)));
        actions.appendChild(window.el('button', { type: 'button', onclick: user.ativo === false ? undefined : () => handleDesativarClick(user, meId), disabled: user.ativo === false, title: user.ativo === false ? 'Usuario inativo' : 'Desativar usuario', 'aria-label': user.ativo === false ? 'Usuario inativo' : 'Desativar usuario', style: `width:30px; height:30px; display:inline-flex; align-items:center; justify-content:center; border:1px solid #eceef1; border-radius:4px; background:#fff; color:#8a93a3; cursor:${user.ativo === false ? 'default' : 'pointer'}; opacity:${user.ativo === false ? '0.45' : '1'};` }, svgIcon(ICON_BAN)));
        actions.appendChild(window.el('button', { type: 'button', onclick: meId && user.id === meId ? undefined : () => handleExcluirClick(user, meId), disabled: !!(meId && user.id === meId), title: meId && user.id === meId ? 'Nao pode excluir o proprio usuario' : 'Excluir usuario', 'aria-label': meId && user.id === meId ? 'Nao pode excluir o proprio usuario' : 'Excluir usuario', style: `width:30px; height:30px; display:inline-flex; align-items:center; justify-content:center; border:1px solid #eceef1; border-radius:4px; background:#fff; color:#d6403a; cursor:${meId && user.id === meId ? 'default' : 'pointer'}; opacity:${meId && user.id === meId ? '0.45' : '1'};` }, svgIcon(ICON_TRASH)));
        line.appendChild(actions);
        card.appendChild(line);
      });

      if (!rows.length) {
        card.appendChild(window.el('div', { style: 'padding:20px 18px; font-size:14px; color:#6b7280; text-align:center;' }, busca ? 'Nenhum usuario encontrado.' : (mostrarInativos ? 'Nenhum usuario cadastrado.' : 'Nenhum usuario ativo encontrado.')));
      }

      const footer = window.el('div', { style: 'padding:11px 18px; background:#fff; border:1px solid #eceef1; border-top:none; border-radius:0 0 6px 6px;' });
      footer.appendChild(window.el('span', { style: 'font-size:13px; color:#9aa2af;' }, `${rows.length} ${rows.length === 1 ? 'usuario listado' : 'usuarios listados'}`));
      tableWrap.appendChild(card);
      tableWrap.appendChild(footer);
      page.appendChild(header);
      page.appendChild(controls);
      page.appendChild(tableWrap);
      container.replaceChildren(page);
    }

    function handleDesativarClick(r, meId) {
      // Guarda de UX (não substitui a checagem server-side).
      if (r.ativo === false) {
        window.toast('Usuário já está inativo.', 'info');
        return;
      }
      if (meId && r.id === meId) {
        window.toast('Você não pode desativar seu próprio usuário.', 'info');
        return;
      }
      M.openDesativarModal(r, { onDone: reload });
    }

    function handleExcluirClick(r, meId) {
      // Guarda de UX (não substitui a checagem server-side).
      if (meId && r.id === meId) {
        window.toast('Você não pode excluir seu próprio usuário.', 'info');
        return;
      }
      M.openExcluirModal(r, { onDone: reload });
    }

    await reload();
    return window.shellLayout(window.ADMIN_MENU, container);
  }

  window.screenAdminUsuarios = screenAdminUsuarios;
})(window);
