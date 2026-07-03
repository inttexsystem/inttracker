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

  const LOGIN_ICONS = {
    email: '<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22 6 12 13 2 6"></polyline>',
    lock: '<rect x="3" y="11" width="18" height="11" rx="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path>',
    eye: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle>',
    eyeOff: '<path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a18.5 18.5 0 0 1 5.06-5.94M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line>',
  };

  function svgIcon(inner, size) {
    var s = size || 16;
    var tmp = document.createElement('div');
    if (typeof tmp.innerHTML === 'undefined') return null;
    tmp.innerHTML = '<svg width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none"'
      + ' stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"'
      + ' aria-hidden="true" focusable="false">' + inner + '</svg>';
    return tmp.firstChild || tmp.firstElementChild || null;
  }

  function loginIcon(name, size) {
    return svgIcon(LOGIN_ICONS[name], size) || window.el('span', { 'aria-hidden': 'true' }, '');
  }

  function fieldIcon(name) {
    return window.el('span', {
      class: 'login-field-icon',
      style: 'position:absolute;left:13px;top:50%;transform:translateY(-50%);'
        + 'display:flex;align-items:center;justify-content:center;color:#9aa2af;pointer-events:none;',
    }, loginIcon(name, 16));
  }

  function screenLogin() {
    const root = window.el('div', {
      class: 'login-screen',
      style: 'min-height:100vh;display:flex;align-items:center;justify-content:center;'
        + 'padding:24px;background:#f6f7f9;color:#16203a;font-family:inherit;',
    });
    const shell = window.el('div', { style: 'width:100%;max-width:400px;' });
    const card = window.el('div', {
      class: 'login-card',
      style: 'background:#fff;border:1px solid #eceef1;border-radius:8px;'
        + 'padding:32px 32px 28px;box-shadow:0 1px 2px rgba(16,24,40,.04),'
        + '0 8px 24px rgba(16,24,40,.06);',
    });

    const brandMark = window.el('div', {
      'aria-label': 'Inttex',
      style: 'width:72px;height:72px;border-radius:8px;border:1px solid #e3e7ee;'
        + 'background:#fff;display:flex;align-items:center;justify-content:center;'
        + 'box-shadow:0 1px 2px rgba(16,24,40,.04);font-size:18px;font-weight:800;'
        + 'color:#16203a;letter-spacing:0;',
    }, 'In');
    card.appendChild(window.el('div', {
      style: 'display:flex;justify-content:center;margin-bottom:20px;',
    }, brandMark));

    card.appendChild(window.el('h1', {
      style: 'margin:0 0 6px;font-size:22px;font-weight:800;letter-spacing:0;'
        + 'color:#16203a;text-align:center;line-height:1.2;',
    }, 'Inttex OptiControl'));
    card.appendChild(window.el('p', {
      style: 'font-size:13.5px;color:#8a93a3;margin:0 0 26px;text-align:center;',
    }, 'Entre com seu e-mail e senha'));

    const emailInput = window.el('input', {
      type: 'email',
      placeholder: 'seu@email.com',
      required: 'required',
      autocomplete: 'email',
      style: 'width:100%;border:1px solid #d8dce2;border-radius:4px;'
        + 'padding:10px 14px 10px 38px;font-size:14px;font-family:inherit;'
        + 'color:#16203a;outline:none;background:#fff;',
    });
    const senhaInput = window.el('input', {
      type: 'password',
      placeholder: 'senha',
      required: 'required',
      autocomplete: 'current-password',
      style: 'width:100%;border:1px solid #d8dce2;border-radius:4px;'
        + 'padding:10px 42px 10px 38px;font-size:14px;font-family:inherit;'
        + 'color:#16203a;outline:none;background:#fff;',
    });

    const btn = window.el('button', { type: 'submit',
      style: 'width:100%;background:#2563eb;color:#fff;border:none;border-radius:4px;'
        + 'padding:12px 16px;font-weight:700;font-size:14.5px;font-family:inherit;'
        + 'cursor:pointer;',
    }, 'Entrar');

    const togglePasswordBtn = window.el('button', {
      type: 'button',
      'aria-label': 'Mostrar senha',
      style: 'position:absolute;right:9px;top:50%;transform:translateY(-50%);'
        + 'background:none;border:none;cursor:pointer;padding:5px;color:#9aa2af;'
        + 'display:flex;align-items:center;justify-content:center;',
      onclick: () => {
        const visible = senhaInput.type === 'text';
        senhaInput.type = visible ? 'password' : 'text';
        togglePasswordBtn.setAttribute('aria-label', visible ? 'Mostrar senha' : 'Ocultar senha');
        togglePasswordBtn.replaceChildren(loginIcon(visible ? 'eye' : 'eyeOff', 17));
      },
    }, loginIcon('eye', 17));

    const forgotPassword = window.el('button', {
      type: 'button',
      style: 'background:none;border:none;padding:0;font-size:12.5px;font-weight:600;'
        + 'color:#2563eb;text-decoration:none;white-space:nowrap;cursor:pointer;font-family:inherit;',
      onclick: () => window.toast('Recuperação de senha ainda não configurada.', 'info'),
    }, 'Esqueceu a senha?');

    const form = window.el('form', {
      onsubmit: async (e) => {
        e.preventDefault();
        if (btn.disabled) return;
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
    },
      window.el('div', { style: 'margin-bottom:16px;' },
        window.el('label', {
          style: 'display:block;font-size:12.5px;font-weight:600;color:#3f4757;margin-bottom:7px;',
        }, 'E-mail'),
        window.el('div', { style: 'position:relative;' }, fieldIcon('email'), emailInput)
      ),
      window.el('div', { style: 'margin-bottom:18px;' },
        window.el('div', {
          style: 'display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:7px;',
        },
          window.el('label', {
            style: 'font-size:12.5px;font-weight:600;color:#3f4757;flex-shrink:0;',
          }, 'Senha'),
          forgotPassword
        ),
        window.el('div', { style: 'position:relative;' },
          fieldIcon('lock'),
          senhaInput,
          togglePasswordBtn
        )
      ),
      window.el('label', {
        style: 'display:flex;align-items:center;gap:8px;font-size:13px;color:#5b6472;'
          + 'margin-bottom:20px;cursor:pointer;',
      },
        window.el('input', {
          type: 'checkbox',
          style: 'accent-color:#2563eb;width:15px;height:15px;',
        }),
        'Lembrar-me neste dispositivo'
      ),
      btn
    );

    card.appendChild(form);
    shell.appendChild(card);
    shell.appendChild(window.el('div', {
      style: 'text-align:center;margin-top:22px;font-size:12.5px;color:#9aa2af;',
    }, '© 2026 Inttex · Controle de Tapetes'));
    root.appendChild(shell);
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
