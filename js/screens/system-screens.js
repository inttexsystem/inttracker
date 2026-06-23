// =====================================================================
// === SCREENS: SYSTEM (Seam A) ========================================
// Telas sistêmicas de baixíssimo acoplamento: login, 404 e acesso
// negado. Extraídas do <script> inline de index.html sem alterar
// comportamento. Concentra:
//   - screenLogin()       — formulário de login (chama login + routeAfterLogin)
//   - screenNotFound()    — tela 404 (chama navigate)
//   - screenForbidden()   — tela de acesso negado (chama routeAfterLogin)
//
// Carregar via <script src="js/screens/system-screens.js"></script> no
// <head>, DEPOIS de js/router.js e ANTES do script inline principal.
//
// Dependências resolvidas em tempo de chamada (não no load):
//   - window.el / window.toast      (js/ui.js)
//   - window.login                  (js/auth.js)
//   - window.navigate / window.routeAfterLogin (js/router.js)
//
// Compatibilidade: window.screenLogin, window.screenNotFound e
// window.screenForbidden continuam disponíveis exatamente como antes
// para o inline (setRoutes) e para js/router.js (handleRoute).
// =====================================================================

(function (window) {
  'use strict';

  function screenLogin() {
    const root = window.el('div', { class: 'min-h-screen flex items-center justify-center p-4' });
    const card = window.el('div', { class: 'bg-white rounded-2xl shadow-lg p-8 w-full max-w-md' });

    card.appendChild(window.el('h1', { class: 'text-2xl font-bold mb-1' }, 'Controle de Tapetes'));
    card.appendChild(window.el('p', { class: 'text-gray-500 mb-6' }, 'Entre com seu e-mail e senha'));

    const emailInput = window.el('input', { type: 'email', placeholder: 'seu@email.com', required: 'required',
      class: 'w-full border rounded-lg px-3 py-2 mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500' });
    const senhaInput = window.el('input', { type: 'password', placeholder: 'senha', required: 'required',
      class: 'w-full border rounded-lg px-3 py-2 mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500' });
    const btn = window.el('button', { type: 'submit',
      class: 'w-full bg-blue-700 hover:bg-blue-800 text-white font-semibold rounded-lg py-2 transition' }, 'Entrar');

    const form = window.el('form', {
      onsubmit: async (e) => {
        e.preventDefault();
        btn.disabled = true;
        btn.textContent = 'Entrando...';
        try {
          await window.login(emailInput.value.trim(), senhaInput.value);
          window.toast('Login OK', 'success');
          await window.routeAfterLogin();
        } catch (err) {
          window.toast('E-mail ou senha incorretos', 'error');
          console.error(err);
        } finally {
          btn.disabled = false;
          btn.textContent = 'Entrar';
        }
      }
    }, emailInput, senhaInput, btn);

    card.appendChild(form);
    root.appendChild(card);
    return root;
  }

  function screenForbidden() {
    return window.el('div', { class: 'min-h-screen flex flex-col items-center justify-center p-4 text-center' },
      window.el('h1', { class: 'text-3xl font-bold text-red-600 mb-2' }, 'Acesso negado'),
      window.el('p', { class: 'text-gray-600 mb-4' }, 'Você não tem permissão pra essa tela.'),
      window.el('button', { class: 'bg-blue-700 text-white px-4 py-2 rounded-lg', onclick: () => window.routeAfterLogin() }, 'Voltar pro início')
    );
  }

  function screenNotFound() {
    return window.el('div', { class: 'min-h-screen flex flex-col items-center justify-center p-4 text-center' },
      window.el('h1', { class: 'text-3xl font-bold mb-2' }, '404'),
      window.el('p', { class: 'text-gray-600 mb-4' }, 'Tela não encontrada.'),
      window.el('button', { class: 'bg-blue-700 text-white px-4 py-2 rounded-lg', onclick: () => window.navigate('#/login') }, 'Ir pro login')
    );
  }

  // -------------------------------------------------------------------
  // Namespace principal
  // -------------------------------------------------------------------

  window.RAVATEX_SCREENS = window.RAVATEX_SCREENS || {};

  window.RAVATEX_SCREENS.system = {
    screenLogin,
    screenNotFound,
    screenForbidden,
  };

  // Compatibilidade com o script inline atual e js/router.js.
  window.screenLogin = screenLogin;
  window.screenNotFound = screenNotFound;
  window.screenForbidden = screenForbidden;
})(window);
