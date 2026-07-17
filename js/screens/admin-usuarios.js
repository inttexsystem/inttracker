// =====================================================================
// === ADMIN USUARIOS SCREEN (Camada 2 — A3.1) ===========================
// Extraído 1:1 de js/screens/cadastros.js (screenCadastrosUsuarios,
// linhas 2226-2713), sem alteração visual ou de comportamento. Tela de
// administração de usuários: listar, buscar, alternar "mostrar
// inativos", criar/editar (via modal), desativar, excluir.
//
// Escopo desta extração (A3.1): paridade 1:1 com a tela anterior.
// Cards-resumo e toolbar busca/ordenar/filtro avançada são A3.2 (gate de
// mockup próprio). Coluna "último acesso" (leitura via RPC db/59) é
// CAMADA2-LAST-ACCESS-UI, subfase posterior a A3.2 — ambas já incluídas
// neste módulo.
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
    // CAMADA2-LAST-ACCESS-UI — último acesso por usuário (db/59), mergeado
    // client-side por id a cada reload(); vazio/ausente = "—" na coluna.
    let lastSignInById = {};

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
    // A5.1-A5.2 — ícone de reset de senha.
    var ICON_KEY = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"></path></svg>';
    // A5.3-A5.4 — ícone de reativação (linhas inativas), substitui o
    // ícone de ban (proibido) na mesma posição de ação.
    var ICON_REFRESH = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>';
    // A3.2 — ícones dos cards-resumo (KPI).
    var ICON_SHIELD = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#8a93a3" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>';
    var ICON_FACTORY = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#8a93a3" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M2 20h20"></path><path d="M4 20V10l5 3V10l5 3V10l5 3v7"></path><path d="M4 10V6l2-2"></path></svg>';
    var ICON_USERS = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#8a93a3" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>';
    var ICON_USER_OFF = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#b06a6a" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><line x1="17" y1="8" x2="22" y2="13"></line><line x1="22" y1="8" x2="17" y2="13"></line></svg>';

    // A3.2 — estado da toolbar (ordenação/filtro por tipo). Client-side,
    // sobre os dados já carregados por reload(); sem query nova.
    let ordenarPor = 'nome-asc';
    let filtroTipo = 'todos';

    // A3.2 — card de resumo (KPI). tone='danger' estiliza o card de Inativos.
    function kpiCard({ label, icon, value, subtitle, tone }) {
      const danger = tone === 'danger';
      // Cor padrão de fundo = branco, mesmo tom dos cards KPI do dashboard
      // admin (.rv-adm-card em js/screens/painel.js: background:#fff).
      const bg = danger ? '#fff8f8' : '#fff';
      const border = danger ? '#f3dcdc' : '#e4e8ee';
      const labelColor = danger ? '#b06a6a' : '#8a93a3';
      const valueColor = danger ? '#d6403a' : '#16203a';
      const card = window.el('div', { style: `background:${bg}; border:1px solid ${border}; border-radius:5px; padding:14px 16px;` });
      card.appendChild(window.el('div', { style: 'display:flex; align-items:center; justify-content:space-between; margin-bottom:8px;' },
        window.el('span', { style: `font-size:12px; color:${labelColor};` }, label),
        svgIcon(icon)
      ));
      card.appendChild(window.el('div', { style: `font-size:22px; font-weight:500; color:${valueColor};` }, String(value)));
      card.appendChild(window.el('div', { style: `font-size:11.5px; color:${labelColor}; margin-top:2px;` }, subtitle));
      return card;
    }

    // A3.2 — badge de papel colorido por tipo (coluna Tipo do grid).
    // A2.2 — para admin, sufixo discreto quando nivel_acesso='somente_leitura'
    // ("Admin · leitura"); nenhum sufixo para 'completo' (mantém o badge
    // igual ao de antes — não é uma coluna nova, só um dado a mais no
    // mesmo badge, por instrução do arquiteto).
    function tipoBadge(tipo, nivelAcesso) {
      const map = {
        admin: { bg: '#e8eefc', color: '#2563eb', label: 'Admin' },
        fornecedor: { bg: '#eceef1', color: '#5a6472', label: 'Fornecedor' },
        cliente: { bg: '#f0edfc', color: '#6d5bd0', label: 'Cliente' },
      };
      const t = map[tipo] || { bg: '#eceef1', color: '#5a6472', label: tipo || '—' };
      const label = (tipo === 'admin' && nivelAcesso === 'somente_leitura') ? `${t.label} · leitura` : t.label;
      return window.el('span', {
        style: `display:inline-flex; align-items:center; border-radius:4px; padding:2px 8px; font-size:11.5px; font-weight:600; white-space:nowrap; background:${t.bg}; color:${t.color};`
      }, label);
    }

    // UI-GRID-TEXT-HELPER: truncatedCell()/TRUNCATE_CELL_STYLE promoted to
    // js/ui.js (window.truncatedCell / window.TRUNCATE_CELL_STYLE).

    // CAMADA2-LAST-ACCESS-UI — dd/mm/aaaa hh:mm; "—" para nulo/inválido.
    function formatLastSignIn(value) {
      if (!value) return '—';
      const d = new Date(value);
      if (isNaN(d.getTime())) return '—';
      const pad = (n) => String(n).padStart(2, '0');
      return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }

    // A3.2 — ordenação client-side sobre as linhas já filtradas.
    // 'ultimo-acesso': mais recente primeiro; usuários sem acesso
    // registrado (nulo) sempre por último, independente da direção.
    function sortRows(list, mode) {
      const arr = list.slice();
      if (mode === 'nome-desc') {
        arr.sort((a, b) => String(b.nome || '').localeCompare(String(a.nome || '')));
      } else if (mode === 'tipo') {
        arr.sort((a, b) => String(a.tipo || '').localeCompare(String(b.tipo || '')));
      } else if (mode === 'ultimo-acesso') {
        arr.sort((a, b) => {
          const av = lastSignInById[a.id];
          const bv = lastSignInById[b.id];
          if (!av && !bv) return 0;
          if (!av) return 1;
          if (!bv) return -1;
          return new Date(bv) - new Date(av);
        });
      } else {
        arr.sort((a, b) => String(a.nome || '').localeCompare(String(b.nome || '')));
      }
      return arr;
    }

    async function reload() {
      columnSupport = await W.detectOptionalColumns('usuarios', ['observacoes']);
      const { users, forns, clients, error } = await W.fetchUsuariosPageData(columnSupport);
      if (error) { window.toast('Erro ao carregar', 'error'); console.error(error); return; }
      allUsers = users;
      allForns = forns;
      allClients = clients;
      // CAMADA2-LAST-ACCESS-UI — uma chamada por reload(); falha não
      // derruba a tela (admin sempre vê a lista) — coluna inteira "—".
      lastSignInById = {};
      try {
        const { data: lastSignInRows, error: lastSignInError } = await W.fetchLastSignIn();
        if (lastSignInError) throw lastSignInError;
        (lastSignInRows || []).forEach((row) => { lastSignInById[row.id] = row.last_sign_in_at; });
      } catch (err) {
        console.warn('Falha ao carregar último acesso dos usuários:', err);
      }
      renderStandalone();
    }

    function renderStandalone() {
      const meId = (window.CURRENT_USER && window.CURRENT_USER.id) || null;
      // A2.3 — pilot enforcement route (this screen). Derived from the
      // already-fetched allUsers (no new query) by matching the acting
      // admin's own row — the same source that will feed the grid badge
      // (A2.2). CLIENT-SIDE ONLY: a somente_leitura admin whose JWT
      // still says tipo='admin' can bypass this via direct API calls;
      // RLS (usuarios_admin_all) does not check nivel_acesso. Real
      // server-side enforcement is registered as
      // A2-SERVER-SIDE-ENFORCEMENT, NOT AUTHORIZED.
      const meUser = meId ? allUsers.find((u) => u.id === meId) : null;
      const meSomenteLeitura = !!(meUser && meUser.tipo === 'admin' && meUser.nivel_acesso === 'somente_leitura');
      let baseRows = mostrarInativos ? allUsers : allUsers.filter((u) => u.ativo !== false);
      if (filtroTipo !== 'todos') baseRows = baseRows.filter((u) => u.tipo === filtroTipo);
      const filteredRows = busca
        ? baseRows.filter((u) => [u.email, u.nome, u.tipo, u.fornecedor?.nome, u.cliente?.nome, u.ativo === false ? 'inativo' : 'ativo'].join(' ').toLowerCase().includes(busca.trim().toLowerCase()))
        : baseRows;
      const rows = sortRows(filteredRows, ordenarPor);

      // A3.2 — contagens dos cards-resumo: sempre sobre allUsers (dados já
      // carregados por reload(), sem query nova), independentes de busca/
      // filtro/ordenação aplicados ao grid abaixo.
      function porTipoESubtitulo(tipo) {
        const doTipo = allUsers.filter((u) => u.tipo === tipo);
        const ativos = doTipo.filter((u) => u.ativo !== false).length;
        const inativos = doTipo.length - ativos;
        return { total: doTipo.length, subtitle: `${ativos} ativos · ${inativos} inativos` };
      }
      const kAdmin = porTipoESubtitulo('admin');
      const kFornecedor = porTipoESubtitulo('fornecedor');
      const kCliente = porTipoESubtitulo('cliente');
      const totalInativos = allUsers.filter((u) => u.ativo === false).length;

      const page = window.el('div', { style: 'display:flex; flex-direction:column;' });
      const header = window.el('div', {
        style: 'display:flex; align-items:center; justify-content:space-between; gap:16px; flex-wrap:wrap; margin-bottom:20px;'
      });
      header.appendChild(window.el('div', {},
        window.el('div', { style: 'font-size:22px; font-weight:800; color:#16203a; letter-spacing:-.01em;' }, 'Usuarios'),
        window.el('div', { style: 'font-size:13px; color:#8a93a3; margin-top:3px;' }, 'Gerencie acessos, vinculos e status de usuarios administrativos.')
      ));
      // A2.3 — "Novo usuario" disabled for a somente_leitura admin (safe
      // boolean pattern: `disabled` key only set when true, never
      // `disabled:false`, per UI-EL-BOOLEAN-ATTR-FIX).
      const novoUsuarioAttrs = {
        type: 'button',
        style: `display:inline-flex; align-items:center; gap:7px; background:#2563eb; color:#fff; border:none; border-radius:4px; padding:9px 16px; font-weight:600; font-size:14px; font-family:inherit; cursor:${meSomenteLeitura ? 'default' : 'pointer'}; opacity:${meSomenteLeitura ? '0.55' : '1'};`,
      };
      if (meSomenteLeitura) {
        novoUsuarioAttrs.disabled = true;
        novoUsuarioAttrs.title = 'Seu acesso é somente leitura — criação de usuário desabilitada';
      } else {
        novoUsuarioAttrs.onclick = () => M.openUsuarioModal(null, allForns, allClients, columnSupport, { onSaved: reload, readOnly: meSomenteLeitura });
      }
      header.appendChild(window.el('button', novoUsuarioAttrs, svgIcon(ICON_PLUS), window.el('span', {}, 'Novo usuario')));

      // A3.2 — cards-resumo (KPI), acima da toolbar.
      const kpiGrid = window.el('div', { style: 'display:grid; grid-template-columns:repeat(4, 1fr); gap:14px; margin-bottom:18px;' });
      kpiGrid.appendChild(kpiCard({ label: 'Administradores', icon: ICON_SHIELD, value: kAdmin.total, subtitle: kAdmin.subtitle }));
      kpiGrid.appendChild(kpiCard({ label: 'Fornecedores', icon: ICON_FACTORY, value: kFornecedor.total, subtitle: kFornecedor.subtitle }));
      kpiGrid.appendChild(kpiCard({ label: 'Clientes', icon: ICON_USERS, value: kCliente.total, subtitle: kCliente.subtitle }));
      kpiGrid.appendChild(kpiCard({ label: 'Inativos', icon: ICON_USER_OFF, value: totalInativos, subtitle: `de ${allUsers.length} no total`, tone: 'danger' }));

      const controls = window.el('div', { style: 'display:flex; align-items:center; gap:12px; margin-bottom:14px; flex-wrap:wrap;' });
      const searchWrap = window.el('div', {
        style: 'display:flex; align-items:center; gap:8px; flex:1 1 320px; min-width:220px; background:#fff; border:1px solid #d8dce2; border-radius:5px; padding:8px 13px;'
      });
      searchWrap.appendChild(svgIcon(ICON_SEARCH));
      searchWrap.appendChild(window.el('input', {
        type: 'search',
        value: busca,
        placeholder: 'Buscar por nome ou e-mail',
        oninput: (e) => { busca = e.target.value || ''; renderStandalone(); },
        style: 'width:100%; border:0; outline:none; background:transparent; font-size:13px; color:#16203a; padding:0; font-family:inherit;'
      }));
      controls.appendChild(searchWrap);

      const selectStyle = 'border:1px solid #d8dce2; border-radius:5px; padding:8px 11px; font-size:13px; color:#16203a; background:#fff; font-family:inherit; cursor:pointer;';
      const ordenarSelect = window.el('select', {
        value: ordenarPor,
        onchange: (e) => { ordenarPor = e.target.value; renderStandalone(); },
        style: selectStyle,
        'aria-label': 'Ordenar'
      },
        window.el('option', { value: 'nome-asc' }, 'Nome A–Z'),
        window.el('option', { value: 'nome-desc' }, 'Nome Z–A'),
        window.el('option', { value: 'tipo' }, 'Tipo'),
        window.el('option', { value: 'ultimo-acesso' }, 'Último acesso')
      );
      ordenarSelect.value = ordenarPor;
      controls.appendChild(ordenarSelect);

      const filtroTipoSelect = window.el('select', {
        value: filtroTipo,
        onchange: (e) => { filtroTipo = e.target.value; renderStandalone(); },
        style: selectStyle,
        'aria-label': 'Filtrar por tipo'
      },
        window.el('option', { value: 'todos' }, 'Todos'),
        window.el('option', { value: 'admin' }, 'Admin'),
        window.el('option', { value: 'fornecedor' }, 'Fornecedor'),
        window.el('option', { value: 'cliente' }, 'Cliente')
      );
      filtroTipoSelect.value = filtroTipo;
      controls.appendChild(filtroTipoSelect);

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
      // UI-ACTION-BUTTON-MIGRATION-2: ACOES holds 4 actionButton()s
      // (30px) + 3 gaps (6px) = 138px. The previous 102px undersized the
      // column (architect-reported); widened to the exact math, one
      // grid-template value, no other layout change.
      // UI-USERS-GRID-TEXT-OVERFLOW: E-MAIL widened 1.3fr→2fr so typical
      // addresses fit before truncating; NOME/FORNECEDOR/CLIENTE unchanged
      // at 1fr; TIPO/STATUS/ULTIMO ACESSO/ACOES fixed px unchanged.
      const gridTemplate = '2fr 1fr 110px 1fr 1fr 90px 130px 138px';
      const TRUNCATE_HEAD_LABELS = new Set(['E-MAIL', 'NOME', 'FORNECEDOR', 'CLIENTE']);
      const headRow = window.el('div', { style: `display:grid; grid-template-columns:${gridTemplate}; align-items:center; gap:16px; padding:10px 18px; background:#f8f9fb; border-bottom:1px solid #eceef1;` });
      ['E-MAIL', 'NOME', 'TIPO', 'FORNECEDOR', 'CLIENTE', 'STATUS', 'ULTIMO ACESSO'].forEach((label) => {
        const headStyle = TRUNCATE_HEAD_LABELS.has(label)
          ? `font-size:11px; font-weight:700; color:#8a93a3; letter-spacing:.04em; ${window.TRUNCATE_CELL_STYLE}`
          : 'font-size:11px; font-weight:700; color:#8a93a3; letter-spacing:.04em; white-space:nowrap;';
        headRow.appendChild(window.el('div', { style: headStyle }, label));
      });
      headRow.appendChild(window.el('div', { style: 'font-size:11px; font-weight:700; color:#8a93a3; letter-spacing:.04em; text-align:center; white-space:nowrap;' }, 'ACOES'));
      card.appendChild(headRow);

      rows.forEach((user, index) => {
        const inativo = user.ativo === false;
        const line = window.el('div', { style: `display:grid; grid-template-columns:${gridTemplate}; align-items:center; gap:16px; padding:13px 18px; border-bottom:${index === rows.length - 1 ? '0' : '1px solid #f1f3f6'}; opacity:${inativo ? '0.6' : '1'};` });
        line.appendChild(window.truncatedCell(user.email || '', user.email, 'font-size:13.5px; color:#3f4757;'));
        line.appendChild(window.truncatedCell(user.nome || '—', user.nome, 'font-size:14px; font-weight:500; color:#16203a;'));
        line.appendChild(window.el('div', {}, tipoBadge(user.tipo, user.nivel_acesso)));
        line.appendChild(window.truncatedCell(user.fornecedor?.nome || '—', user.fornecedor?.nome, `font-size:13.5px; color:${user.fornecedor?.nome ? '#3f4757' : '#aab2bf'};`));
        line.appendChild(window.truncatedCell(user.cliente?.nome || '—', user.cliente?.nome, `font-size:13.5px; color:${user.cliente?.nome ? '#3f4757' : '#aab2bf'};`));
        line.appendChild(window.el('div', {},
          window.el('span', {
            style: `display:inline-flex; align-items:center; border-radius:4px; padding:3px 9px; font-size:12px; font-weight:600; white-space:nowrap; background:${inativo ? '#fff1f1' : '#e6f4ec'}; color:${inativo ? '#d6403a' : '#18794a'};`
          }, inativo ? 'Inativo' : 'Ativo')
        ));
        line.appendChild(window.el('div', { style: 'font-size:13.5px; color:#8a93a3;' }, formatLastSignIn(lastSignInById[user.id])));
        // UI-ACTION-BUTTON-MIGRATION-2: all 4 row actions now built via
        // the shared actionButton() primitive (UI_VISUAL_CONTRACT.md
        // §8.1) — same handlers, same confirmDialog/modal gating, same
        // disabled conditions and icon-swap logic; only the button
        // rendering changes.
        const actions = window.el('div', { style: 'display:flex; align-items:center; justify-content:center; gap:6px;' });
        // A2.3 — every write action in this pilot route also merges in
        // meSomenteLeitura (in addition to the existing self-protection
        // guards), disabling the button and explaining why via title.
        const readOnlySuffix = ' (acesso somente leitura)';
        actions.appendChild(window.actionButton({
          title: meSomenteLeitura ? ('Editar usuario' + readOnlySuffix) : 'Editar usuario',
          icon: svgIcon(ICON_SQUARE_PEN),
          disabled: meSomenteLeitura,
          onclick: meSomenteLeitura ? undefined : () => M.openUsuarioModal(user, allForns, allClients, columnSupport, { onSaved: reload, readOnly: meSomenteLeitura }),
        }));
        // A5.1-A5.2 — reset de senha.
        const resetSelf = !!(meId && user.id === meId);
        const resetDisabled = resetSelf || meSomenteLeitura;
        actions.appendChild(window.actionButton({
          title: meSomenteLeitura ? ('Resetar senha' + readOnlySuffix) : (resetSelf ? 'Nao pode resetar a propria senha' : 'Resetar senha'),
          icon: svgIcon(ICON_KEY),
          disabled: resetDisabled,
          onclick: resetDisabled ? undefined : () => M.openResetarSenhaModal(user, { onDone: reload, readOnly: meSomenteLeitura }),
        }));
        // A5.3-A5.4 — linhas inativas trocam a ação "Desativar" (ícone
        // ban) por "Reativar" (ícone refresh) na mesma posição; ambas
        // sempre acionáveis (sem `disabled`) nesta coluna. Neutral color
        // (not danger) — matches the pre-migration behavior verbatim.
        actions.appendChild(window.actionButton({
          title: meSomenteLeitura
            ? ((inativo ? 'Reativar usuario' : 'Desativar usuario') + readOnlySuffix)
            : (inativo ? 'Reativar usuario' : 'Desativar usuario'),
          icon: svgIcon(inativo ? ICON_REFRESH : ICON_BAN),
          disabled: meSomenteLeitura,
          onclick: meSomenteLeitura ? undefined : (inativo ? () => handleReativarClick(user, meSomenteLeitura) : () => handleDesativarClick(user, meId, meSomenteLeitura)),
        }));
        const excluirSelf = !!(meId && user.id === meId);
        const excluirDisabled = excluirSelf || meSomenteLeitura;
        actions.appendChild(window.actionButton({
          title: meSomenteLeitura ? ('Excluir usuario' + readOnlySuffix) : (excluirSelf ? 'Nao pode excluir o proprio usuario' : 'Excluir usuario'),
          icon: svgIcon(ICON_TRASH),
          danger: true,
          disabled: excluirDisabled,
          onclick: excluirDisabled ? undefined : () => handleExcluirClick(user, meId, meSomenteLeitura),
        }));
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
      page.appendChild(kpiGrid);
      page.appendChild(controls);
      page.appendChild(tableWrap);
      container.replaceChildren(page);
    }

    function handleDesativarClick(r, meId, readOnly) {
      // Guarda de UX (não substitui a checagem server-side).
      if (r.ativo === false) {
        window.toast('Usuário já está inativo.', 'info');
        return;
      }
      if (meId && r.id === meId) {
        window.toast('Você não pode desativar seu próprio usuário.', 'info');
        return;
      }
      M.openDesativarModal(r, { onDone: reload, readOnly });
    }

    function handleExcluirClick(r, meId, readOnly) {
      // Guarda de UX (não substitui a checagem server-side).
      if (meId && r.id === meId) {
        window.toast('Você não pode excluir seu próprio usuário.', 'info');
        return;
      }
      M.openExcluirModal(r, { onDone: reload, readOnly });
    }

    function handleReativarClick(r, readOnly) {
      // Guarda de UX (não substitui a checagem server-side).
      if (r.ativo !== false) {
        window.toast('Usuário já está ativo.', 'info');
        return;
      }
      M.openReativarModal(r, { onDone: reload, readOnly });
    }

    await reload();
    return window.shellLayout(window.ADMIN_MENU, container);
  }

  window.screenAdminUsuarios = screenAdminUsuarios;
})(window);
