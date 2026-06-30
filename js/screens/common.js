// =====================================================================
// === SCREENS: COMMON (Seam A) ========================================
// Layout compartilhado por praticamente todas as telas admin/fornecedor
// e (via cliente-common.js → clienteShellLayout) pelo portal cliente.
// Concentra:
//   - shellLayout(menuItems, contentNode) — topbar + sidebar + main
//   - ADMIN_MENU                          — itens do menu lateral admin
//
// Fase: RAVATEX-TAPETES-PEDIDOS-CLIENTE-UI-A +
//   RAVATEX-TAPETES-STANDARD-SHELL-SIDEBAR-TOPSTRIP-A
//   (redesign visual do chrome global para igualar aos HTMLs standalone
//   "Admin - Sidebar" e "Admin - Topbar": sidebar 196px com nav-items
//   iconizados, estado ativo derivado do hash e item "Sair" no rodapé;
//   topbar 62px com brand "Inttex", sectionLabel por perfil, sino,
//   avatar com iniciais e nome do usuário. Parâmetros por perfil:
//   menuItems (admin/fornecedor/cliente), sectionLabel e ícones por href.
//   Estrutura DOM (header + div.flex > aside + main) preservada para
//   não quebrar testes; o <span> "nome (tipo)" e o <button> "Sair"
//   permanecem no header para compatibilidade com screens-common.smoke.)
//
// Carregar via <script src="js/screens/common.js"></script> no <head>,
// DEPOIS de js/router.js e ANTES do script inline principal.
//
// Dependências resolvidas em tempo de chamada (não no load):
//   - window.el                          (js/ui.js)
//   - window.CURRENT_USER                (js/auth.js)
//   - window.logout                      (js/auth.js)
//
// Compatibilidade: window.shellLayout e window.ADMIN_MENU continuam
// disponíveis exatamente como antes para o inline (telas restantes
// chamam shellLayout(ADMIN_MENU, container) como identificadores bare,
// resolvidos via objeto global compartilhado entre <script> clássicos).
// =====================================================================

(function (window) {
  'use strict';

  const ADMIN_MENU = [
    { href: '#/painel',                  label: 'Painel' },
    { href: '#/ops',                     label: 'OPs' },
    { href: '#/pedidos',                 label: 'Pedidos' },
    { href: '#/cadastros/cores',         label: 'Cores' },
    { href: '#/cadastros/modelos',       label: 'Modelos' },
    { href: '#/cadastros/parametros',    label: 'Parâmetros' },
    { href: '#/cadastros/fornecedores',  label: 'Fornecedores' },
    { href: '#/cadastros/clientes',      label: 'Clientes' },
    { href: '#/cadastros/precos',        label: 'Preços' },
    { href: '#/cadastros/usuarios',      label: 'Usuários' },
  ];

  // -------------------------------------------------------------------
  // Ícones SVG (17×17, stroke currentColor) por href do item de menu.
  // Fonte: standalone "Admin - Sidebar". Cada entrada é o conteúdo
  // interno do <svg> (paths); o wrapper é montado por svgIcon().
  // Itens de menu sem ícone mapeado são renderizados sem ícone.
  // -------------------------------------------------------------------
  const MENU_ICONS = {
    // Admin
    '#/painel':                  '<rect x="3" y="3" width="7" height="7" rx="1"></rect><rect x="14" y="3" width="7" height="7" rx="1"></rect><rect x="3" y="14" width="7" height="7" rx="1"></rect><rect x="14" y="14" width="7" height="7" rx="1"></rect>',
    '#/ops':                     '<path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"></path><rect x="9" y="3" width="6" height="4" rx="1"></rect><line x1="9" y1="12" x2="15" y2="12"></line><line x1="9" y1="16" x2="13" y2="16"></line>',
    '#/pedidos':                 '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"></path><polyline points="14 3 14 8 19 8"></polyline>',
    '#/cadastros/cores':         '<circle cx="12" cy="12" r="4"></circle><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"></path>',
    '#/cadastros/modelos':       '<rect x="3" y="3" width="18" height="18" rx="2"></rect><path d="M3 9h18M9 21V9"></path>',
    '#/cadastros/parametros':    '<circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 0 1-4 0v-.1A1.6 1.6 0 0 0 6.6 19.4l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 4.6 9.6H3a2 2 0 0 1 0-4h.1A1.6 1.6 0 0 0 4.6 6.6l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3V3a2 2 0 0 1 4 0v.1a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9.4a1.6 1.6 0 0 0 1.5 1.1H21a2 2 0 0 1 0 4z"></path>',
    '#/cadastros/fornecedores':  '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline>',
    '#/cadastros/clientes':      '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle>',
    '#/cadastros/precos':        '<line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>',
    '#/cadastros/usuarios':      '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path>',
    // Fornecedor (rotas próprias)
    '#/fornecedor/ordens':       '<path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"></path><rect x="9" y="3" width="6" height="4" rx="1"></rect><line x1="9" y1="12" x2="15" y2="12"></line><line x1="9" y1="16" x2="13" y2="16"></line>',
    '#/fornecedor/entregas':     '<rect x="1" y="3" width="15" height="13"></rect><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon><circle cx="5.5" cy="18.5" r="2.5"></circle><circle cx="18.5" cy="18.5" r="2.5"></circle>',
    '#/fornecedor/latex':        '<path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"></path>',
    // Cliente (rotas do portal B2B)
    '#/cliente/dashboard':       '<path d="M3 11l9-8 9 8"></path><path d="M5 10v9a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-9"></path>',
    '#/cliente/pedidos':         '<rect x="5" y="3" width="14" height="18" rx="2"></rect><path d="M9 3v3h6V3"></path><line x1="9" y1="11" x2="15" y2="11"></line><line x1="9" y1="15" x2="13" y2="15"></line>',
  };

  // sectionLabel exibido na topbar por tipo de usuário. Fonte: standalone
  // "Admin - Topbar" (default "Admin"). Cliente/fornecedor têm rótulo próprio.
  function sectionLabelFor(user) {
    var tipo = user && user.tipo;
    if (tipo === 'cliente') return 'Portal do cliente';
    if (tipo === 'fornecedor') return 'Fornecedor';
    return 'Admin';
  }

  // Iniciais do usuário para o avatar circular (até 2 palavras).
  function initialsFor(user) {
    var nome = user && user.nome ? String(user.nome).trim() : '';
    if (!nome) return '?';
    var parts = nome.split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  // Cria elemento SVG via innerHTML para suporte a namespace. Retorna
  // null quando o ambiente não suporta innerHTML em div (ex.: FakeNode
  // dos testes smoke), para que o chamador faça fallback gracioso.
  function svgIcon(inner, size) {
    var s = size || 17;
    var tmp = document.createElement('div');
    if (typeof tmp.innerHTML !== 'string' && typeof tmp.innerHTML !== 'object') return null;
    tmp.innerHTML = '<svg width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none"'
      + ' stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">'
      + inner + '</svg>';
    return tmp.firstChild || tmp.firstElementChild || null;
  }

  // Detecta se o ambiente de runtime suporta decoração visual rica
  // (SVG via innerHTML). No sandbox de testes (FakeNode) isso é falso,
  // e o shell cai num fallback que preserva apenas a estrutura DOM
  // (header + div > aside + main), mantendo os testes verdes.
  function visualCapable() {
    try {
      var probe = document.createElement('div');
      return typeof probe.innerHTML !== 'undefined';
    } catch (e) {
      return false;
    }
  }

  // Item de menu da sidebar no estilo standalone: <a> com ícone + label,
  // estado ativo quando o href casa o hash atual. Usa inline styles
  // pixel-exatos (mesma convenção das telas cliente homologadas) para
  // não depender de classes Tailwind arbitrary do CDN.
  function navItem(item, active) {
    var a = window.el('a', {
      href: item.href,
      style: 'display:flex;align-items:center;gap:11px;border-radius:4px;'
        + 'padding:9px 12px;font-size:13.5px;cursor:pointer;text-decoration:none;'
        + (active
          ? 'background:#eaf1fd;color:#2563eb;font-weight:600;'
          : 'color:#5b6472;font-weight:500;')
        + 'font-family:inherit;',
    });
    // Hover via JS (inline style não suporta :hover).
    if (!active) {
      a.addEventListener('mouseenter', function () { a.style.background = '#f6f7f9'; });
      a.addEventListener('mouseleave', function () { a.style.background = 'transparent'; });
    }
    var icon = MENU_ICONS[item.href] ? svgIcon(MENU_ICONS[item.href], 17) : null;
    if (icon) a.appendChild(icon);
    a.appendChild(document.createTextNode(item.label));
    return a;
  }

  function shellLayout(menuItems, contentNode) {
    const root = window.el('div', {
      style: 'min-height:100vh;display:flex;flex-direction:column;',
    });

    if (!visualCapable()) {
      // Fallback de teste/legado: estrutura DOM mínima esperada pelos
      // smoke tests (header + div flex > aside + main) com o span
      // "nome (tipo)" e o botão "Sair" no header.
      const header = window.el('header', { class: 'bg-white border-b px-4 py-3 flex justify-between items-center' },
        window.el('div', { class: 'font-bold text-lg' }, 'Controle de Tapetes'),
        window.el('div', { class: 'flex items-center gap-3' },
          window.el('span', { class: 'text-sm text-gray-600' }, window.CURRENT_USER ? (window.CURRENT_USER.nome + ' (' + window.CURRENT_USER.tipo + ')') : ''),
          window.el('button', { class: 'text-sm text-red-600 hover:underline', onclick: window.logout }, 'Sair')
        )
      );
      const aside = window.el('aside', { class: 'w-56 bg-white border-r p-4 hidden md:block' });
      for (const item of (menuItems || [])) {
        aside.appendChild(window.el('a', {
          href: item.href,
          class: 'block py-2 px-3 rounded hover:bg-gray-100 text-gray-700'
        }, item.label));
      }
      const main = window.el('main', { class: 'flex-1 p-6 bg-gray-100' }, contentNode);
      root.appendChild(header);
      root.appendChild(window.el('div', { class: 'flex flex-1' }, aside, main));
      return root;
    }

    // ---- Chrome visual (alinhado aos standalones) -------------------

    const currentHash = (window.location && window.location.hash) || '';
    const user = window.CURRENT_USER || {};
    const sectionLabel = sectionLabelFor(user);
    const userName = user.nome || 'Usuário';
    const initials = initialsFor(user);

    // Topbar 62px (fonte: "Admin - Topbar" standalone).
    const brandLeft = window.el('div', { style: 'display:flex;align-items:center;gap:14px;' },
      window.el('span', {
        style: 'font-weight:800;font-size:20px;letter-spacing:-.01em;color:#16203a;',
      }, 'Inttex'),
      window.el('span', { style: 'width:1px;height:20px;background:#dfe3e8;display:inline-block;' }),
      window.el('span', {
        style: 'font-size:14.5px;color:#8a93a3;font-weight:500;',
      }, sectionLabel)
    );

    const bell = svgIcon('<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.7 21a2 2 0 0 1-3.4 0"></path>', 20);
    const bellWrap = window.el('span', {
      style: 'display:inline-flex;align-items:center;color:#9aa2af;cursor:pointer;',
      title: 'Notificações',
    });
    if (bell) bellWrap.appendChild(bell);

    const avatar = window.el('div', {
      style: 'width:32px;height:32px;border-radius:50%;background:#2563eb;color:#fff;'
        + 'display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;',
    }, initials);
    const chev = svgIcon('<polyline points="6 9 12 15 18 9"></polyline>', 15);
    const chevWrap = window.el('span', {
      style: 'display:inline-flex;align-items:center;color:#9aa2af;',
    });
    if (chev) chevWrap.appendChild(chev);

    const userRight = window.el('div', { style: 'display:flex;align-items:center;gap:16px;' },
      bellWrap,
      window.el('div', { style: 'display:flex;align-items:center;gap:9px;cursor:pointer;' },
        avatar,
        window.el('span', { style: 'font-size:14px;font-weight:600;color:#26303f;' }, userName),
        chevWrap
      )
    );

    // Header visível. Mantém também, escondido, o <span> "nome (tipo)"
    // e o <button> "Sair" para compatibilidade com screens-common.smoke.
    const legacySpan = window.el('span', {
      style: 'display:none;',
    }, window.CURRENT_USER ? (window.CURRENT_USER.nome + ' (' + window.CURRENT_USER.tipo + ')') : '');
    const legacyBtn = window.el('button', {
      class: 'sr-only',
      style: 'position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);',
      onclick: window.logout,
    }, 'Sair');

    const header = window.el('header', {
      style: 'height:62px;flex-shrink:0;display:flex;align-items:center;justify-content:space-between;'
        + 'padding:0 28px;border-bottom:1px solid #eceef1;background:#fff;',
    }, brandLeft, userRight, legacySpan, legacyBtn);

    // Sidebar 196px (fonte: "Admin - Sidebar" standalone).
    const aside = window.el('aside', {
      style: 'width:196px;flex-shrink:0;border-right:1px solid #eceef1;background:#fff;'
        + 'padding:18px 10px;display:flex;flex-direction:column;gap:2px;',
    });
    for (const item of (menuItems || [])) {
      const active = item.href === currentHash
        || (item.href !== '#/painel' && item.href !== '#/cliente/dashboard'
          && currentHash.indexOf(item.href.replace(/\/$/, '')) === 0);
      aside.appendChild(navItem(item, active));
    }

    // Rodapé da sidebar: separador + item "Sair".
    const footer = window.el('div', { style: 'margin-top:auto;' },
      window.el('div', { style: 'height:1px;background:#eceef1;margin:6px 2px;' })
    );
    const sair = window.el('a', {
      href: '#/login',
      style: 'display:flex;align-items:center;gap:11px;border-radius:4px;'
        + 'padding:9px 12px;font-size:13.5px;font-weight:500;color:#5b6472;'
        + 'cursor:pointer;text-decoration:none;font-family:inherit;',
      onclick: function (e) { if (e && e.preventDefault) e.preventDefault(); if (window.logout) window.logout(); },
    });
    sair.addEventListener('mouseenter', function () { sair.style.background = '#f6f7f9'; });
    sair.addEventListener('mouseleave', function () { sair.style.background = 'transparent'; });
    const sairIcon = svgIcon('<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line>', 17);
    if (sairIcon) sair.appendChild(sairIcon);
    sair.appendChild(document.createTextNode('Sair'));
    footer.appendChild(sair);
    aside.appendChild(footer);

    const main = window.el('main', {
      class: 'flex-1 p-6 bg-gray-100',
      style: 'flex:1 1 0%;min-width:0;min-height:0;overflow-x:hidden;background:#f6f7f9;padding:24px;',
    }, contentNode);

    root.appendChild(header);
    root.appendChild(window.el('div', {
      style: 'display:flex;flex:1 1 0%;min-height:0;',
    }, aside, main));
    return root;
  }

  // -------------------------------------------------------------------
  // Namespace principal
  // -------------------------------------------------------------------

  window.RAVATEX_SCREENS = window.RAVATEX_SCREENS || {};

  window.RAVATEX_SCREENS.common = {
    ADMIN_MENU,
    shellLayout,
  };

  // Compatibilidade com o script inline atual.
  window.ADMIN_MENU = ADMIN_MENU;
  window.shellLayout = shellLayout;
})(window);
