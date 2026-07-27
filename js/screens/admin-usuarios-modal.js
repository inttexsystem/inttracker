// =====================================================================
// === ADMIN USUARIOS MODAL (Camada 2 — A3.1) ============================
// Extraído 1:1 de js/screens/cadastros.js (screenCadastrosUsuarios,
// linhas 2226-2713), sem alteração de comportamento visual/validação.
// Concentra os 3 modais da tela: criar/editar, confirmar desativação,
// confirmar exclusão permanente.
// Helpers de formulário abaixo (applyAdminUsuariosControlStyle,
// adminUsuariosModalField/Stack, setAdminUsuariosModalFieldVisibility,
// adminUsuariosTextarea/ObservacoesField, openAdminUsuariosFormModal)
// são cópias funcionais dos helpers homônimos privados de cadastros.js
// (cadastrosModalField etc. — cadastros.js:204-449). Duplicados aqui
// porque cadastros.js é uma IIFE que não os expõe em window.*, e A3.1
// não pode alterar cadastros.js (ver CAMADA2_USUARIOS_SPEC_PROPOSED.md).
// Prefixo "adminUsuarios" deixa claro que são cópias locais.
//
// Carregar DEPOIS de js/ui.js e js/admin-usuarios-writes.js, ANTES de
// js/screens/admin-usuarios.js.
//
// Dependências em tempo de chamada: window.el/toast/formField/
// textInput/selectInput (js/ui.js); window.labelFornecedorTipo
// (js/screens/cadastros.js); window.RAVATEX_ADMIN_USUARIOS_WRITES.
// =====================================================================

(function (window) {
  'use strict';

  // -------------------------------------------------------------------
  // Helpers de formulário (cópia funcional de cadastros.js:204-449)
  // -------------------------------------------------------------------

  function applyAdminUsuariosControlStyle(control) {
    if (!control) return control;

    control.style.width = '100%';
    // Pass-3 §8: the generic 44px minimum no longer reaches every control
    // type. A single-line input or select resolves through the canonical
    // compact rung declared by the shared primitive in js/ui.js, so this
    // helper must not fight it with a competing minimum or with vertical
    // padding that would clip the fixed height. A multiline textarea is
    // outside the generic ladder and keeps its own minimum and padding
    // (UI-SPECIALIZED-CONTROL-CONTRACT-GAP).
    if (control.tagName === 'TEXTAREA') {
      control.style.minHeight = '44px';
      control.style.padding = '10px 13px';
    } else {
      control.style.padding = control.tagName === 'SELECT' ? '0 38px 0 13px' : '0 13px';
    }
    control.style.border = '1px solid var(--rv-border-strong)';
    control.style.borderRadius = '4px';
    control.style.background = control.disabled ? 'var(--rv-surface-subtle)' : 'var(--rv-surface)';
    control.style.boxShadow = 'none';
    control.style.outline = 'none';
    control.style.fontSize = '14px';
    control.style.fontFamily = 'inherit';
    control.style.lineHeight = '1.45';
    control.style.color = control.disabled ? 'var(--rv-text-tertiary)' : 'var(--rv-text-primary)';
    control.style.transition = 'border-color .18s ease, box-shadow .18s ease, background .18s ease';

    if (control.tagName === 'SELECT') {
      control.style.appearance = 'none';
      control.style.backgroundImage = 'url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2714%27 height=%2714%27 viewBox=%270 0 24 24%27 fill=%27none%27 stroke=%27%239aa2af%27 stroke-width=%272%27 stroke-linecap=%27round%27 stroke-linejoin=%27round%27%3E%3Cpolyline points=%276 9 12 15 18 9%27/%3E%3C/svg%3E")';
      control.style.backgroundRepeat = 'no-repeat';
      control.style.backgroundPosition = 'right 13px center';
      control.style.backgroundSize = '14px 14px';
    }

    if (!control.disabled) {
      control.addEventListener('focus', function () {
        control.style.borderColor = 'var(--rv-brand)';
        control.style.boxShadow = '0 0 0 3px var(--rv-focus-ring)';
      });
      control.addEventListener('blur', function () {
        control.style.borderColor = 'var(--rv-border-strong)';
        control.style.boxShadow = 'none';
      });
    }

    return control;
  }

  // PASS-7-A4: a <label> rendered as a SIBLING names nothing, and
  // role="combobox" — unlike a plain button — does not take its accessible
  // name from its own content. The canonical select popover therefore needs
  // the visible label bound explicitly, or it reaches assistive technology
  // unnamed. Binding is applied ONLY to an unnamed canonical trigger; every
  // other control this helper renders is untouched.
  var adminUsuariosLabelSeq = 0;
  function bindSelectPopoverLabel(labelNode, control) {
    if (!control || typeof control.getAttribute !== 'function') return;
    if (control.getAttribute('data-rv-select-popover') !== '1') return;
    if (control.getAttribute('aria-label') || control.getAttribute('aria-labelledby')) return;
    adminUsuariosLabelSeq += 1;
    var id = 'rv-admin-usuarios-field-label-' + adminUsuariosLabelSeq;
    labelNode.setAttribute('id', id);
    control.setAttribute('aria-labelledby', id);
  }

  function adminUsuariosModalField(options) {
    var label = options.label;
    var input = options.input;
    var hint = options.hint;
    var fullWidth = !!options.fullWidth;
    var wrap = window.el('div', {
      style: 'display:flex; flex-direction:column; gap:7px; min-width:0;'
    });

    if (fullWidth) wrap.style.gridColumn = '1 / -1';

    var labelNode = window.el('label', {
      style: 'font-size:12px; line-height:1.2; font-weight:700; letter-spacing:.04em; text-transform:uppercase; color:var(--rv-text-secondary);'
    }, label);
    bindSelectPopoverLabel(labelNode, input);
    wrap.appendChild(labelNode);
    wrap.appendChild(applyAdminUsuariosControlStyle(input));

    if (hint) {
      wrap.appendChild(window.el('p', {
        style: 'margin:0; font-size:12px; line-height:1.45; color:var(--rv-text-tertiary);'
      }, hint));
    }

    return wrap;
  }

  function adminUsuariosModalStack(children) {
    return window.el('div', {
      style: 'display:flex; flex-direction:column; gap:16px;'
    }, ...children);
  }

  function setAdminUsuariosModalFieldVisibility(field, visible) {
    field.style.display = visible ? 'flex' : 'none';
  }

  function adminUsuariosTextarea(options) {
    var textarea = window.el('textarea', {
      rows: String(options.rows || 4),
      placeholder: options.placeholder || ''
    });
    textarea.value = options.value || '';
    applyAdminUsuariosControlStyle(textarea);
    textarea.style.minHeight = options.minHeight || '104px';
    textarea.style.resize = 'vertical';
    return textarea;
  }

  function adminUsuariosObservacoesField(value) {
    var input = adminUsuariosTextarea({
      value: value || '',
      placeholder: 'Observacoes internas (opcional)'
    });
    var field = adminUsuariosModalField({
      label: 'Observações',
      input: input,
      hint: 'Opcional. Fica salvo junto do cadastro.',
      fullWidth: true
    });
    return { field: field, input: input };
  }

  function openAdminUsuariosFormModal(options) {
    var title = options.title;
    var body = options.body;
    var onSave = options.onSave;
    var saveLabel = options.saveLabel || 'Salvar';
    var onClose = options.onClose;
    var maxWidth = options.maxWidth || 680;
    var overlay = window.el('div', {
      style: 'position:fixed; inset:0; z-index:40; display:flex; align-items:center; justify-content:center; padding:24px 18px; background:var(--rv-overlay-scrim); backdrop-filter:blur(2px);',
      onclick: function (e) {
        if (e.target === overlay) close();
      }
    });

    function close() {
      overlay.remove();
      document.removeEventListener('keydown', escListener);
      if (onClose) onClose();
    }

    function escListener(e) {
      if (e.key === 'Escape') close();
    }

    document.addEventListener('keydown', escListener);

    var card = window.el('div', {
      style: `width:min(100%, ${maxWidth}px); max-height:min(92vh, 860px); display:flex; flex-direction:column; background:var(--rv-surface); border:1px solid var(--rv-border); border-radius:var(--rv-radius); box-shadow:var(--rv-shadow-popover); overflow:hidden;`
    });
    var titleWrap = window.el('div', {
      style: 'display:flex; flex-direction:column; gap:4px; min-width:0;'
    });
    titleWrap.appendChild(window.el('h2', {
      style: 'margin:0; font-size:var(--rv-fs-component-heading); line-height:1.2; font-weight:700; color:var(--rv-text-primary);'
    }, title));

    var closeButton = window.el('button', {
      type: 'button',
      'aria-label': 'Fechar',
      onclick: close,
      style: 'width:32px; height:32px; flex:0 0 auto; display:inline-flex; align-items:center; justify-content:center; border:1px solid var(--rv-border-soft); border-radius:4px; background:var(--rv-surface); color:var(--rv-text-tertiary); font-size:var(--rv-icon-glyph-lg); line-height:1; cursor:pointer;'
    }, '×');
    closeButton.addEventListener('mouseenter', function () {
      closeButton.style.borderColor = 'var(--rv-border-strong)';
      closeButton.style.color = 'var(--rv-text-primary)';
      closeButton.style.background = 'var(--rv-surface-subtle)';
    });
    closeButton.addEventListener('mouseleave', function () {
      closeButton.style.borderColor = 'var(--rv-border-soft)';
      closeButton.style.color = 'var(--rv-text-tertiary)';
      closeButton.style.background = 'var(--rv-surface)';
    });

    var header = window.el('div', {
      style: 'display:flex; align-items:flex-start; justify-content:space-between; gap:18px; padding:18px 20px 16px; border-bottom:1px solid var(--rv-border-soft);'
    }, titleWrap, closeButton);
    var content = window.el('div', {
      style: 'padding:18px 20px 20px; overflow-y:auto;'
    }, body);

    var btnCancel = window.el('button', {
      type: 'button',
      onclick: close,
      style: 'height:var(--rv-h-default); min-width:110px; padding:0 16px; border:1px solid var(--rv-border-strong); border-radius:4px; background:var(--rv-surface); color:var(--rv-text-secondary); font-size:14px; font-weight:600; font-family:inherit; cursor:pointer; box-shadow:none;'
    }, 'Cancelar');
    btnCancel.addEventListener('mouseenter', function () {
      btnCancel.style.borderColor = 'var(--rv-border-strong)';
      btnCancel.style.background = 'var(--rv-surface-subtle)';
    });
    btnCancel.addEventListener('mouseleave', function () {
      btnCancel.style.borderColor = 'var(--rv-border-strong)';
      btnCancel.style.background = 'var(--rv-surface)';
    });

    var btnSave = window.el('button', {
      type: 'button',
      style: 'height:var(--rv-h-primary); min-width:110px; padding:0 16px; border:none; border-radius:4px; background:var(--rv-brand); color:var(--rv-text-on-brand); font-size:14px; font-weight:600; font-family:inherit; cursor:pointer; box-shadow:none; transition:background .18s ease, opacity .18s ease;',
      onclick: async function () {
        btnSave.disabled = true;
        btnSave.style.opacity = '0.78';
        btnSave.style.cursor = 'default';
        btnSave.textContent = 'Salvando...';
        try {
          var result = await onSave();
          if (result !== false) close();
        } finally {
          btnSave.disabled = false;
          btnSave.style.opacity = '1';
          btnSave.style.cursor = 'pointer';
          btnSave.textContent = saveLabel;
        }
      }
    }, saveLabel);
    btnSave.addEventListener('mouseenter', function () {
      if (btnSave.disabled) return;
      btnSave.style.background = 'var(--rv-brand-strong)';
    });
    btnSave.addEventListener('mouseleave', function () {
      if (btnSave.disabled) return;
      btnSave.style.background = 'var(--rv-brand)';
    });

    var footer = window.el('div', {
      style: 'display:flex; align-items:center; justify-content:flex-end; gap:10px; padding:14px 20px; border-top:1px solid var(--rv-border-soft); background:var(--rv-surface);'
    }, btnCancel, btnSave);

    card.appendChild(header);
    card.appendChild(content);
    card.appendChild(footer);
    overlay.appendChild(card);
    document.body.appendChild(overlay);

    return { close: close };
  }

  // -------------------------------------------------------------------
  // Modal: criar / editar usuário (cadastros.js:2543-2709)
  // -------------------------------------------------------------------

  function openUsuarioModal(usr, forns, clients, columnSupport, options) {
    var onSaved = (options && options.onSaved) || function () {};
    var W = window.RAVATEX_ADMIN_USUARIOS_WRITES;
    var isEdit = !!usr;
    var fornOptions = forns.map(function (f) { return { value: f.id, label: `${f.nome} (${window.labelFornecedorTipo(f.tipo)})` }; });
    var tipoOptions = [{ value: 'admin', label: 'Admin' }, { value: 'fornecedor', label: 'Fornecedor' }, { value: 'cliente', label: 'Cliente' }];
    var emailInput = window.textInput({ type: 'email', value: usr?.email || '', placeholder: 'usuario@exemplo.com' });
    var nomeInput = window.textInput({ value: usr?.nome || '', placeholder: 'Ex: Fornecedor X' });
    var tipoSel = window.selectInput({ options: tipoOptions, value: usr?.tipo });
    var clienteOptions = clients.map(function (c) { return { value: c.id, label: c.nome }; });
    var fornSel = window.selectInput({ options: fornOptions, value: usr?.fornecedor?.id, placeholder: '(nenhum)' });
    var clienteSel = window.selectInput({ options: clienteOptions, value: usr?.cliente?.id, placeholder: '(nenhum)' });
    var fields = [];
    if (isEdit) {
      var idInput = window.textInput({ value: usr?.id || '', placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx' });
      idInput.disabled = true;
      idInput.classList.add('bg-gray-100');
      fields.push(adminUsuariosModalField({ label: 'UID do Auth', input: idInput, hint: 'Não pode ser alterado', fullWidth: true }));
    }
    fields.push(adminUsuariosModalField({
      label: 'E-mail',
      input: emailInput,
      hint: isEdit ? '' : 'Será usado para login no Supabase Auth',
      fullWidth: true
    }));
    fields.push(adminUsuariosModalField({ label: 'Nome', input: nomeInput, fullWidth: true }));
    fields.push(adminUsuariosModalField({ label: 'Tipo', input: tipoSel, fullWidth: true }));
    // A2.2 — nível de acesso do admin (db/62 usuarios.nivel_acesso).
    // Hidden entirely (not merely disabled) for fornecedor/cliente — the
    // field is meaningless for them, same treatment as wrapperForn/
    // wrapperCli below. Rendered on EDIT only: admin-create-user's
    // INSERT (supabase/functions/admin-create-user/index.ts) has no
    // nivel_acesso column, so on CREATE any selection here would be
    // silently discarded by the Edge Function — showing an interactive
    // control whose value is dropped is worse than not showing it. A
    // new admin is created at the schema default ('completo', db/62)
    // and its level can be set right after, via this same field in a
    // follow-up edit. HARD STOP registered at this phase: wiring
    // nivel_acesso into admin-create-user's INSERT requires an Edge
    // Function change, out of this order's scope
    // (A2-CREATE-NIVEL-ACESSO-WIRING, NOT AUTHORIZED).
    var nivelAcessoOptions = [
      { value: 'completo', label: 'Completo' },
      { value: 'somente_leitura', label: 'Somente leitura' },
    ];
    var nivelAcessoSel = isEdit
      ? window.selectInput({ options: nivelAcessoOptions, value: usr?.nivel_acesso || 'completo' })
      : null;
    var wrapperNivel = isEdit
      ? adminUsuariosModalField({
        label: 'Nível de acesso',
        input: nivelAcessoSel,
        hint: 'Completo ou somente leitura. Relevante apenas para administradores.',
        fullWidth: true
      })
      : null;
    if (wrapperNivel) fields.push(wrapperNivel);
    var wrapperForn = adminUsuariosModalField({
      label: 'Fornecedor vinculado',
      input: fornSel,
      hint: 'Obrigatório se tipo = Fornecedor',
      fullWidth: true
    });
    var wrapperCli = adminUsuariosModalField({
      label: 'Cliente vinculado',
      input: clienteSel,
      hint: 'Obrigatório se tipo = Cliente',
      fullWidth: true
    });
    fields.push(wrapperForn, wrapperCli);
    function updateVinculoVisibility() {
      var t = tipoSel.value;
      setAdminUsuariosModalFieldVisibility(wrapperForn, t === 'fornecedor');
      setAdminUsuariosModalFieldVisibility(wrapperCli, t === 'cliente');
      if (wrapperNivel) setAdminUsuariosModalFieldVisibility(wrapperNivel, t === 'admin');
    }
    tipoSel.addEventListener('change', updateVinculoVisibility);
    updateVinculoVisibility();
    var passwordInput = null;
    if (!isEdit) {
      passwordInput = window.textInput({ type: 'password', value: '', placeholder: 'Mínimo 6 caracteres' });
      fields.push(adminUsuariosModalField({
        label: 'Senha temporária',
        input: passwordInput,
        hint: 'Defina uma senha inicial e oriente a troca depois.',
        fullWidth: true
      }));
    }
    var observacoesField = null;
    if (columnSupport.observacoes) {
      observacoesField = adminUsuariosObservacoesField(usr?.observacoes);
      fields.push(observacoesField.field);
    }
    var body = adminUsuariosModalStack(fields);
    // A6.3 — read-only audit panel. Edit only (isEdit): a new user has
    // no history yet. Panel failure must never break the modal — the
    // render function itself is fail-closed (js/screens/
    // admin-usuarios-audit-panel.js), so a missing/broken dependency
    // here only degrades to no panel appended, form stays usable.
    if (isEdit && usr && usr.id) {
      var auditPanelApi = window.RAVATEX_ADMIN_USUARIOS_AUDIT_PANEL;
      if (auditPanelApi && typeof auditPanelApi.renderUsuarioAuditPanel === 'function') {
        try {
          body.appendChild(auditPanelApi.renderUsuarioAuditPanel(usr.id));
        } catch (auditErr) {
          console.error('admin-usuarios-modal: falha ao montar painel de auditoria', auditErr);
        }
      }
    }
    openAdminUsuariosFormModal({
      title: isEdit ? 'Editar usuário' : 'Novo usuário',
      maxWidth: 560,
      body,
      onSave: async () => {
        var email = emailInput.value.trim();
        var nome = nomeInput.value.trim();
        var tipo = tipoSel.value;
        var fornecedor_id_raw = fornSel.value || null;
        var cliente_id_raw = clienteSel.value || null;
        if (!email || !nome || !tipo) {
          window.toast('Preencha e-mail, nome e tipo', 'error');
          return false;
        }
        if (tipo === 'fornecedor' && !fornecedor_id_raw) {
          window.toast('Usuário tipo "fornecedor" precisa de fornecedor vinculado', 'error');
          return false;
        }
        if (tipo === 'fornecedor' && cliente_id_raw) {
          window.toast('Usuário fornecedor não pode ter cliente vinculado', 'error');
          return false;
        }
        if (tipo === 'cliente' && !cliente_id_raw) {
          window.toast('Usuário tipo "cliente" precisa de cliente vinculado', 'error');
          return false;
        }
        if (tipo === 'cliente' && fornecedor_id_raw) {
          window.toast('Usuário cliente não pode ter fornecedor vinculado', 'error');
          return false;
        }
        if (tipo === 'admin' && fornecedor_id_raw) {
          window.toast('Usuário admin não pode ter fornecedor vinculado', 'error');
          return false;
        }
        if (tipo === 'admin' && cliente_id_raw) {
          window.toast('Usuário admin não pode ter cliente vinculado', 'error');
          return false;
        }
        if (isEdit) {
          var updatePayload = { email, nome, tipo, fornecedor_id: fornecedor_id_raw, cliente_id: cliente_id_raw };
          // A2.2 — direct PostgREST update (not an Edge Function): RLS
          // (usuarios_admin_all, is_admin()-based) already allows any
          // admin to write this column, so unlike create this actually
          // persists. Only sent when the (possibly just-changed) tipo
          // is 'admin' — meaningless otherwise, so a non-admin row's
          // existing nivel_acesso (schema default 'completo') is left
          // untouched by this modal.
          if (tipo === 'admin' && nivelAcessoSel) updatePayload.nivel_acesso = nivelAcessoSel.value;
          if (columnSupport.observacoes) updatePayload.observacoes = observacoesField.input.value.trim() || null;
          const { error } = await W.updateUsuario(usr.id, updatePayload, options.readOnly);
          if (error) {
            var msg = error.code === 'CLIENT_READONLY_FORBIDDEN' ? error.message : 'Erro ao salvar';
            if (error.message && error.message.includes('duplicate')) msg = 'E-mail já cadastrado';
            window.toast(msg, 'error');
            console.error(error);
            return false;
          }
          window.toast('Usuário atualizado', 'success');
          onSaved();
          return;
        }
        var password = passwordInput ? passwordInput.value : '';
        if (!password || password.length < 6) {
          window.toast('Senha temporária deve ter no mínimo 6 caracteres', 'error');
          return false;
        }
        var fornecedor_id = fornecedor_id_raw ? Number(fornecedor_id_raw) : null;
        var cliente_id = cliente_id_raw ? Number(cliente_id_raw) : null;
        const { data: createData, error } = await W.createUsuario({ email, password, nome, tipo, fornecedor_id, cliente_id }, options.readOnly);
        if (error) {
          var parsed = await W.parseEdgeFunctionError(error, 'Erro ao criar usuário');
          var code = parsed.code;
          var msg2 = parsed.message;
          if (code === 'CONFLICT') msg2 = 'E-mail já cadastrado.';
          else if (code === 'FORBIDDEN') msg2 = 'Apenas admins podem criar usuários.';
          else if (code === 'UNAUTHORIZED') msg2 = 'Sessão expirada. Faça login novamente.';
          window.toast(msg2, 'error');
          console.error('admin-create-user error', code, error);
          return false;
        }
        var observacoesValue = columnSupport.observacoes && observacoesField
          ? (observacoesField.input.value.trim() || null)
          : null;
        var newUserId = createData && createData.user_id;
        if (observacoesValue && newUserId) {
          const { error: obsError } = await W.updateUsuarioObservacoes(newUserId, observacoesValue);
          if (obsError) {
            console.error('Falha ao salvar observações do novo usuário', obsError);
            window.toast('Usuário criado, mas falha ao salvar observações', 'error');
            onSaved();
            return;
          }
        }
        window.toast('Usuário criado', 'success');
        onSaved();
      },
    });
  }

  // -------------------------------------------------------------------
  // Modal: confirmar desativação (cadastros.js:2422-2471)
  // -------------------------------------------------------------------

  function openDesativarModal(usr, options) {
    var onDone = (options && options.onDone) || function () {};
    var W = window.RAVATEX_ADMIN_USUARIOS_WRITES;
    var motivoInput = window.textInput({
      type: 'text',
      value: '',
      placeholder: 'Opcional — ex.: fornecedor descartável de teste',
    });
    var body = window.el('div', {},
      window.el('p', { class: 'text-sm text-gray-700 mb-3' },
        'Desativar "' + usr.email + '"? O perfil será marcado como inativo e o login no Auth será bloqueado. Esta ação pode ser revertida por outro admin.'),
      window.formField({
        label: 'Motivo (opcional)',
        input: motivoInput,
        hint: 'Será registrado em public.usuarios.motivo_desativacao (até 500 caracteres).',
      })
    );
    window.modal({
      title: 'Desativar usuário',
      body,
      saveLabel: 'Desativar',
      onSave: async () => {
        var reason = (motivoInput.value || '').trim().slice(0, 500);
        var { error } = await W.disableUsuario(usr.id, reason || 'Desativação via UI', options.readOnly);
        if (error) {
          var parsed = await W.parseEdgeFunctionError(error, 'Erro ao desativar usuário');
          var friendly = W.friendlyDisableMessage(parsed.code, parsed.message);
          window.toast(friendly, 'error');
          console.error('admin-disable-user error', parsed.code, error);
          return;
        }
        window.toast('Usuário desativado', 'success');
        onDone();
      },
    });
  }

  // -------------------------------------------------------------------
  // Modal: confirmar exclusão permanente (cadastros.js:2486-2541)
  // -------------------------------------------------------------------

  function openExcluirModal(usr, options) {
    var onDone = (options && options.onDone) || function () {};
    var W = window.RAVATEX_ADMIN_USUARIOS_WRITES;
    var emailInput = window.textInput({
      type: 'email',
      value: '',
      placeholder: usr.email,
    });
    var body = window.el('div', {},
      window.el('p', { class: 'text-sm text-red-700 font-semibold mb-2' },
        'Exclusão permanente. Esta ação não pode ser desfeita.'),
      window.el('p', { class: 'text-sm text-gray-700 mb-3' },
        'Para confirmar, digite o e-mail do usuário (' + usr.email + '). O perfil e a conta de Auth serão removidos.'),
      window.formField({
        label: 'Confirmar e-mail',
        input: emailInput,
        hint: 'Deve ser exatamente igual ao e-mail do usuário.',
      })
    );
    window.modal({
      title: 'Excluir usuário',
      body,
      saveLabel: 'Excluir permanentemente',
      onSave: async () => {
        var confirmEmail = (emailInput.value || '').trim();
        if (confirmEmail.toLowerCase() !== String(usr.email || '').toLowerCase()) {
          window.toast('O e-mail digitado não confere com o e-mail do usuário.', 'error');
          return;
        }
        var { error } = await W.deleteUsuario(usr.id, confirmEmail, options.readOnly);
        if (error) {
          var parsed = await W.parseEdgeFunctionError(error, 'Erro ao excluir usuário');
          var friendly = W.friendlyDeleteMessage(parsed.code, parsed.message);
          window.toast(friendly, 'error');
          console.error('admin-delete-user error', parsed.code, error);
          return;
        }
        window.toast('Usuário excluído permanentemente.', 'success');
        onDone();
      },
    });
  }

  // -------------------------------------------------------------------
  // Modal: reset de senha administrativo (A5.1-A5.2)
  // -------------------------------------------------------------------

  function openResetarSenhaModal(usr, options) {
    var onDone = (options && options.onDone) || function () {};
    var W = window.RAVATEX_ADMIN_USUARIOS_WRITES;
    window.confirmDialog({
      title: 'Resetar senha',
      message: 'Gerar uma nova senha temporária para "' + usr.email + '"? '
        + 'A senha atual deixará de funcionar imediatamente. O usuário verá '
        + 'a tela de troca de senha obrigatória no próximo login.',
      confirmLabel: 'Resetar senha',
      danger: true,
      onConfirm: async () => {
        var { data, error } = await W.resetarSenha(usr.id, options.readOnly);
        if (error) {
          var parsed = await W.parseEdgeFunctionError(error, 'Erro ao resetar senha');
          var friendly = W.friendlyResetMessage(parsed.code, parsed.message);
          window.toast(friendly, 'error');
          console.error('admin-reset-user-password error', parsed.code, error);
          return;
        }
        window.toast('Senha resetada', 'success');
        openSenhaGeradaModal(data && data.password, usr.email);
        onDone();
      },
    });
  }

  // Exibe a senha gerada UMA vez, com botão copiar e aviso de que não
  // será reexibida. Não persistida em lugar nenhum além desta closure
  // (nem localStorage, nem estado de módulo) — sai de escopo ao fechar.
  function openSenhaGeradaModal(password, email) {
    if (!password) {
      window.toast('Senha resetada, mas a resposta não trouxe o valor gerado.', 'error');
      console.error('openSenhaGeradaModal: password ausente na resposta de admin-reset-user-password');
      return;
    }
    var passwordBox = window.el('div', {
      style: 'font-family:ui-monospace,SFMono-Regular,Consolas,monospace; font-size:var(--rv-fs-metric); font-weight:700; '
        + 'letter-spacing:.03em; background:var(--rv-surface-subtle); border:1px solid var(--rv-border-strong); border-radius:4px; '
        + 'padding:12px 14px; user-select:all; word-break:break-all;',
    }, password);
    var copyBtn = window.el('button', {
      type: 'button',
      style: 'margin-top:10px; height:var(--rv-h-default); padding:0 14px; border:1px solid var(--rv-border-strong); border-radius:4px; '
        + 'background:var(--rv-surface); color:var(--rv-accent-blue); font-size:13px; font-weight:600; font-family:inherit; cursor:pointer;',
      onclick: async () => {
        try {
          await navigator.clipboard.writeText(password);
          copyBtn.textContent = 'Copiado!';
          window.setTimeout(() => { copyBtn.textContent = 'Copiar senha'; }, 2000);
        } catch (_) {
          window.toast('Não foi possível copiar automaticamente — selecione o texto manualmente.', 'error');
        }
      },
    }, 'Copiar senha');
    var body = window.el('div', {},
      window.el('p', { class: 'text-sm text-gray-700 mb-3' },
        'Nova senha temporária para "' + email + '":'),
      passwordBox,
      copyBtn,
      window.el('p', { style: 'margin-top:14px; font-size:12.5px; color:var(--rv-signal-negative); font-weight:600;' },
        'Esta senha não será exibida novamente. Copie e repasse ao usuário agora.')
    );
    window.modal({
      title: 'Senha gerada',
      body,
      saveLabel: 'Já copiei, fechar',
      onSave: () => true,
    });
  }

  // -------------------------------------------------------------------
  // Modal: confirmar reativação (A5.3-A5.4)
  // -------------------------------------------------------------------

  function openReativarModal(usr, options) {
    var onDone = (options && options.onDone) || function () {};
    var W = window.RAVATEX_ADMIN_USUARIOS_WRITES;
    window.confirmDialog({
      title: 'Reativar usuário',
      message: 'Reativar "' + usr.email + '"? O perfil voltará a ficar ativo e o login no Auth será liberado.',
      confirmLabel: 'Reativar',
      danger: false,
      onConfirm: async () => {
        var { error } = await W.reativarUsuario(usr.id, options.readOnly);
        if (error) {
          var parsed = await W.parseEdgeFunctionError(error, 'Erro ao reativar usuário');
          var friendly = W.friendlyReactivateMessage(parsed.code, parsed.message);
          window.toast(friendly, 'error');
          console.error('admin-reactivate-user error', parsed.code, error);
          return;
        }
        window.toast('Usuário reativado', 'success');
        onDone();
      },
    });
  }

  // -------------------------------------------------------------------
  // Namespace
  // -------------------------------------------------------------------

  window.RAVATEX_ADMIN_USUARIOS_MODAL = window.RAVATEX_ADMIN_USUARIOS_MODAL || {};
  window.RAVATEX_ADMIN_USUARIOS_MODAL.openUsuarioModal = openUsuarioModal;
  window.RAVATEX_ADMIN_USUARIOS_MODAL.openDesativarModal = openDesativarModal;
  window.RAVATEX_ADMIN_USUARIOS_MODAL.openExcluirModal = openExcluirModal;
  window.RAVATEX_ADMIN_USUARIOS_MODAL.openResetarSenhaModal = openResetarSenhaModal;
  window.RAVATEX_ADMIN_USUARIOS_MODAL.openSenhaGeradaModal = openSenhaGeradaModal;
  window.RAVATEX_ADMIN_USUARIOS_MODAL.openReativarModal = openReativarModal;
})(window);
