// =====================================================================
// === TELA: TROCAR SENHA OBRIGATÓRIA (Camada 2 — A4.2) ===================
// Tela de troca de senha forçada, sem shell/menu do app — renderizada
// diretamente por js/boot.js (guarda pós-loadCurrentUser) quando
// CURRENT_USER.senha_temporaria === true, substituindo qualquer rota.
//
// Dois modos:
//   - normal (padrão): campos Nova senha / Confirmar nova senha, com
//     checklist vivo (mínimo 8 caracteres, 1 dígito, senhas coincidem)
//     e botão "Definir nova senha" habilitado só com os 3 critérios OK.
//   - expired (senha_gerada_em > 7 dias): sem campos, só mensagem +
//     "Sair da conta" — a política de expiração exige reset por um
//     administrador (A5, fora de escopo desta fase).
//
// Mockup aprovado pelo arquiteto em 2026-07-16 (card centrado sem
// shell, checklist vivo, toggle de visibilidade, link "Sair da conta").
//
// Carregar via <script src="js/screens/trocar-senha-obrigatoria.js">
// </script> no <head>, DEPOIS de js/trocar-senha-writes.js e ANTES de
// js/boot.js.
//
// Dependências resolvidas em tempo de chamada (não no load):
//   - window.el / window.toast                        (js/ui.js)
//   - window.RAVATEX_TROCAR_SENHA_WRITES.trocarSenhaObrigatoria
//                                                       (js/trocar-senha-writes.js)
//   - window.CURRENT_USER, window.loadCurrentUser, window.logout
//                                                       (js/auth.js)
//   - window.routeAfterLogin                           (js/router.js)
//
// Compatibilidade: expõe window.screenTrocarSenhaObrigatoria. Não é
// registrada como rota do router — é renderizada via window.setApp
// diretamente pela guarda de js/boot.js.
// =====================================================================

(function (window) {
  'use strict';

  const CHECKLIST_ITEMS = [
    { key: 'length', label: 'Mínimo de 8 caracteres' },
    { key: 'digit', label: 'Ao menos 1 dígito' },
    { key: 'match', label: 'As duas senhas coincidem' },
  ];

  function checklistState(novaSenha, confirmarSenha) {
    return {
      length: novaSenha.length >= 8,
      digit: /\d/.test(novaSenha),
      match: novaSenha.length > 0 && novaSenha === confirmarSenha,
    };
  }

  function svgIcon(inner, color, size) {
    const s = size || 16;
    const tmp = document.createElement('div');
    tmp.innerHTML = '<svg width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" stroke="'
      + color + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">'
      + inner + '</svg>';
    return tmp.firstChild;
  }

  const ICON_LOCK = '<rect x="3" y="11" width="18" height="11" rx="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path>';
  const ICON_EYE = '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle>';
  const ICON_EYE_OFF = '<path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a18.5 18.5 0 0 1 5.06-5.94M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line>';
  const ICON_CHECK = '<polyline points="20 6 9 17 4 12"></polyline>';

  function passwordField(placeholder) {
    const input = window.el('input', {
      type: 'password',
      placeholder,
      autocomplete: 'new-password',
      style: 'width:100%;border:1px solid #d8dce2;border-radius:4px;padding:10px 42px 10px 14px;'
        + 'font-size:14px;font-family:inherit;color:#16203a;outline:none;background:#fff;',
    });
    const toggleBtn = window.el('button', {
      type: 'button',
      'aria-label': 'Mostrar senha',
      style: 'position:absolute;right:9px;top:50%;transform:translateY(-50%);background:none;border:none;'
        + 'cursor:pointer;padding:5px;color:#8a93a3;display:flex;align-items:center;justify-content:center;',
      onclick: () => {
        const visible = input.type === 'text';
        input.type = visible ? 'password' : 'text';
        toggleBtn.setAttribute('aria-label', visible ? 'Mostrar senha' : 'Ocultar senha');
        toggleBtn.replaceChildren(svgIcon(visible ? ICON_EYE : ICON_EYE_OFF, '#8a93a3', 17));
      },
    }, svgIcon(ICON_EYE, '#8a93a3', 17));
    const wrap = window.el('div', { style: 'position:relative;' }, input, toggleBtn);
    return { input, wrap };
  }

  function checklistRow(label) {
    const icon = window.el('span', { style: 'display:flex;align-items:center;justify-content:center;flex-shrink:0;' },
      svgIcon(ICON_CHECK, '#8a93a3', 14));
    const text = window.el('span', { style: 'font-size:12.5px;color:#8a93a3;' }, label);
    const row = window.el('div', { style: 'display:flex;align-items:center;gap:8px;padding:3px 0;' }, icon, text);
    function setSatisfied(ok) {
      const color = ok ? '#18794a' : '#8a93a3';
      icon.replaceChildren(svgIcon(ICON_CHECK, color, 14));
      text.style.color = color;
    }
    return { row, setSatisfied };
  }

  function sairDaContaButton(primary) {
    return window.el('button', {
      type: 'button',
      style: primary
        ? 'width:100%;background:#2563eb;color:#fff;border:none;border-radius:4px;padding:12px 16px;'
          + 'font-weight:700;font-size:14.5px;font-family:inherit;cursor:pointer;'
        : 'display:block;width:100%;background:none;border:none;padding:0;margin-top:16px;'
          + 'font-size:12.5px;color:#8a93a3;text-align:center;cursor:pointer;font-family:inherit;'
          + 'text-decoration:underline;',
      onclick: async () => { await window.logout(); },
    }, 'Sair da conta');
  }

  function screenTrocarSenhaObrigatoria(opts) {
    const expired = !!(opts && opts.expired);

    const root = window.el('div', {
      style: 'min-height:100vh;display:flex;align-items:center;justify-content:center;'
        + 'padding:24px;background:#eceef1;color:#16203a;font-family:inherit;',
    });
    const shell = window.el('div', { style: 'width:100%;max-width:400px;' });
    const card = window.el('div', {
      style: 'background:#fff;border:1px solid #d8dce2;border-radius:6px;padding:32px 32px 28px;',
    });

    card.appendChild(window.el('div', {
      style: 'display:flex;justify-content:center;margin-bottom:20px;',
    }, window.el('div', {
      style: 'width:56px;height:56px;border-radius:8px;background:#e8eefc;color:#2563eb;'
        + 'display:flex;align-items:center;justify-content:center;',
    }, svgIcon(ICON_LOCK, '#2563eb', 26))));

    card.appendChild(window.el('h1', {
      style: 'margin:0 0 8px;font-size:19px;font-weight:800;color:#16203a;text-align:center;line-height:1.3;',
    }, expired ? 'Senha expirada' : 'Troca de senha obrigatória'));

    card.appendChild(window.el('p', {
      style: 'font-size:13.5px;color:#8a93a3;margin:0 0 24px;text-align:center;line-height:1.5;',
    }, expired
      ? 'Sua senha temporária expirou. Contate um administrador para receber um novo reset.'
      : 'Sua senha atual é temporária. Defina uma nova senha para continuar usando o sistema.'));

    if (expired) {
      card.appendChild(sairDaContaButton(true));
      shell.appendChild(card);
      root.appendChild(shell);
      return root;
    }

    const novaField = passwordField('Nova senha');
    const confirmField = passwordField('Confirmar nova senha');

    const checklistBlock = window.el('div', {
      style: 'background:#f4f6f9;border-radius:5px;padding:10px 14px;margin:14px 0 18px;',
    });
    const rows = {};
    CHECKLIST_ITEMS.forEach(({ key, label }) => {
      const r = checklistRow(label);
      rows[key] = r;
      checklistBlock.appendChild(r.row);
    });

    const submitBtn = window.el('button', {
      type: 'submit',
      disabled: 'disabled',
      style: 'width:100%;background:#2563eb;color:#fff;border:none;border-radius:4px;padding:12px 16px;'
        + 'font-weight:700;font-size:14.5px;font-family:inherit;cursor:pointer;opacity:0.5;',
    }, 'Definir nova senha');

    function updateChecklist() {
      const state = checklistState(novaField.input.value, confirmField.input.value);
      CHECKLIST_ITEMS.forEach(({ key }) => rows[key].setSatisfied(state[key]));
      const allOk = CHECKLIST_ITEMS.every(({ key }) => state[key]);
      submitBtn.disabled = !allOk;
      submitBtn.style.opacity = allOk ? '1' : '0.5';
      submitBtn.style.cursor = allOk ? 'pointer' : 'default';
      return allOk;
    }

    novaField.input.addEventListener('input', updateChecklist);
    confirmField.input.addEventListener('input', updateChecklist);

    const form = window.el('form', {
      onsubmit: async (e) => {
        e.preventDefault();
        if (!updateChecklist() || submitBtn.disabled) return;
        submitBtn.disabled = true;
        submitBtn.textContent = 'Salvando...';
        try {
          const W = window.RAVATEX_TROCAR_SENHA_WRITES;
          const userId = window.CURRENT_USER && window.CURRENT_USER.id;
          const result = await W.trocarSenhaObrigatoria(userId, novaField.input.value);

          if (!result.ok && result.stage === 'auth') {
            window.toast('Não foi possível definir a nova senha. Tente novamente.', 'error');
            console.error('trocarSenhaObrigatoria (auth):', result.error);
            return;
          }
          if (!result.ok && result.stage === 'flag') {
            // Estado parcial real: a senha JÁ foi trocada no Auth, mas o
            // perfil não foi atualizado. Reportar explicitamente — nunca
            // tratar como sucesso silencioso nem re-tentar o updateUser.
            window.toast('Senha definida, mas houve uma falha ao atualizar seu status. Contate um administrador.', 'error');
            console.error('trocarSenhaObrigatoria (flag):', result.error);
            return;
          }

          window.toast('Senha atualizada com sucesso.', 'success');
          await window.loadCurrentUser();
          await window.routeAfterLogin();
        } finally {
          submitBtn.textContent = 'Definir nova senha';
          updateChecklist();
        }
      },
    },
      window.el('div', { style: 'margin-bottom:14px;' },
        window.el('label', {
          style: 'display:block;font-size:12.5px;font-weight:600;color:#3f4757;margin-bottom:7px;',
        }, 'Nova senha'),
        novaField.wrap
      ),
      window.el('div', { style: 'margin-bottom:4px;' },
        window.el('label', {
          style: 'display:block;font-size:12.5px;font-weight:600;color:#3f4757;margin-bottom:7px;',
        }, 'Confirmar nova senha'),
        confirmField.wrap
      ),
      checklistBlock,
      submitBtn
    );

    card.appendChild(form);
    card.appendChild(sairDaContaButton(false));
    shell.appendChild(card);
    root.appendChild(shell);
    return root;
  }

  window.screenTrocarSenhaObrigatoria = screenTrocarSenhaObrigatoria;
})(window);
