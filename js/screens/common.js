// =====================================================================
// === SCREENS: COMMON (Seam A) ========================================
// Layout compartilhado por praticamente todas as telas admin/fornecedor.
// Extraído do <script> inline de index.html sem alterar comportamento.
// Concentra:
//   - shellLayout(menuItems, contentNode) — header + menu lateral + main
//   - ADMIN_MENU                          — itens do menu lateral admin
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

  function shellLayout(menuItems, contentNode) {
    const root = window.el('div', { class: 'min-h-screen flex flex-col' });

    const header = window.el('header', { class: 'bg-white border-b px-4 py-3 flex justify-between items-center' },
      window.el('div', { class: 'font-bold text-lg' }, 'Controle de Tapetes'),
      window.el('div', { class: 'flex items-center gap-3' },
        window.el('span', { class: 'text-sm text-gray-600' }, window.CURRENT_USER ? (window.CURRENT_USER.nome + ' (' + window.CURRENT_USER.tipo + ')') : ''),
        window.el('button', { class: 'text-sm text-red-600 hover:underline', onclick: window.logout }, 'Sair')
      )
    );

    const aside = window.el('aside', { class: 'w-56 bg-white border-r p-4 hidden md:block' });
    for (const item of menuItems) {
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
