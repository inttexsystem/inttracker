// =====================================================================
// === SCREENS: CADASTROS (Seam A) ======================================
// Telas de cadastros administrativos (cores, clientes, modelos,
// parametros, fornecedores, precos) + constantes diretamente
// relacionadas (FORNECEDOR_TIPOS, labelFornecedorTipo). Extraidas do
// <script> inline de index.html sem alterar comportamento, tabelas
// Supabase, CRUD ou regras de negocio.
//
// A tela #/cadastros/usuarios (antes screenCadastrosUsuarios, definida
// neste arquivo) foi extraida 1:1 para js/screens/admin-usuarios.js +
// js/screens/admin-usuarios-modal.js + js/admin-usuarios-writes.js
// (CAMADA2-USUARIOS-A3-1) e removida deste arquivo como codigo morto
// (A3.4) — a rota ja apontava para window.screenAdminUsuarios desde o
// cutover de A3.1; nada aqui a referenciava.
//
// Carregar via <script src="js/screens/cadastros.js"></script> no
// <head>, DEPOIS de js/screens/common.js e ANTES do script inline
// principal (o setRoutes do inline referencia as globais legadas
// expostas por este modulo).
//
// Dependencias resolvidas em tempo de chamada (nao no load):
//   - window.el / window.toast / window.modal / window.confirmDialog
//     / window.formField / window.textInput / window.selectInput
//     / window.dataTable / window.pageHeader   (js/ui.js)
//   - window.shellLayout / window.ADMIN_MENU  (js/screens/common.js)
//   - window.supa                            (js/supabase-client.js)
//
// Compatibilidade: window.screenCadastros{Cores,Clientes,Modelos,
// Parametros,Fornecedores,Precos}, window.FORNECEDOR_TIPOS e
// window.labelFornecedorTipo continuam disponiveis exatamente como
// antes para o setRoutes no inline.
// =====================================================================

(function (window) {
  'use strict';

  // -------------------------------------------------------------------
  // Constantes / helpers diretamente relacionados
  // -------------------------------------------------------------------

  const FORNECEDOR_TIPOS = [
    { value: 'fio_algodao',   label: 'Fornecedor de Algodão' },
    { value: 'fio_poliester', label: 'Fornecedor de Poliéster' },
    { value: 'tecelagem',     label: 'Tecelagem (parte de cima)' },
    { value: 'latex',         label: 'Látex (acabamento)' },
  ];

  function labelFornecedorTipo(tipo) {
    return FORNECEDOR_TIPOS.find(t => t.value === tipo)?.label || tipo;
  }

  const OPTIONAL_COLUMN_SUPPORT = {
    fornecedores: null,
    clientes: null,
    cores: null,
    modelos: null,
    precos_terceirizada: null,
    usuarios: null,
  };

  async function detectOptionalColumns(table, columns) {
    if (OPTIONAL_COLUMN_SUPPORT[table]) return OPTIONAL_COLUMN_SUPPORT[table];
    const support = {};
    await Promise.all(columns.map(async (column) => {
      const { error } = await window.supa.from(table).select(column);
      support[column] = !error;
    }));
    OPTIONAL_COLUMN_SUPPORT[table] = support;
    return support;
  }

  // -------------------------------------------------------------------
  // Helpers puros de CNPJ. O armazenamento direto em Clientes e
  // Fornecedores e canonico: 14 digitos sem pontuacao. A interface
  // normaliza antes da gravacao e formata somente para exibicao; a
  // constraint do banco permanece a autoridade final.
  // -------------------------------------------------------------------

  // Remove pontuacao/espacos e devolve ate 14 digitos (ou '').
  function normalizarCnpj(valor) {
    return String(valor == null ? '' : valor).replace(/\D/g, '').slice(0, 14);
  }

  // Formata CNPJ progressivamente enquanto digita:
  //   12 -> 12
  //   123 -> 12.3
  //   12345 -> 12.345
  //   12345678 -> 12.345.678
  //   123456789012 -> 12.345.678/9012
  //   12345678901234 -> 12.345.678/9012-34
  function formatarCnpj(valor) {
    const d = normalizarCnpj(valor);
    if (d.length <= 2) return d;
    if (d.length <= 5) return d.slice(0, 2) + '.' + d.slice(2);
    if (d.length <= 8) return d.slice(0, 2) + '.' + d.slice(2, 5) + '.' + d.slice(5);
    if (d.length <= 12) return d.slice(0, 2) + '.' + d.slice(2, 5) + '.' + d.slice(5, 8) + '/' + d.slice(8);
    return d.slice(0, 2) + '.' + d.slice(2, 5) + '.' + d.slice(5, 8) + '/' + d.slice(8, 12) + '-' + d.slice(12, 14);
  }

  // Valida DV do CNPJ canonico (exatamente 14 digitos sem pontuacao).
  // Rejeita tamanho incorreto, sequencia repetida e DV invalido.
  // NOTA: nao usa normalizarCnpj (que trunca para 14) — a validacao deve
  // rejeitar entradas com tamanho diferente de 14, como o banco faz.
  function validarCnpjDv(valor) {
    const d = String(valor == null ? '' : valor).replace(/\D/g, '');
    if (d.length !== 14) return { ok: false, motivo: 'CNPJ deve ter 14 dígitos.' };
    if (d === d[0].repeat(14)) return { ok: false, motivo: 'CNPJ com sequência repetida é inválido.' };
    const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    let s1 = 0, s2 = 0;
    for (let i = 0; i < 12; i++) s1 += parseInt(d[i], 10) * w1[i];
    let r1 = s1 % 11;
    const dv1 = r1 < 2 ? 0 : 11 - r1;
    if (dv1 !== parseInt(d[12], 10)) return { ok: false, motivo: 'Dígito verificador inválido.' };
    for (let i = 0; i < 13; i++) s2 += parseInt(d[i], 10) * w2[i];
    let r2 = s2 % 11;
    const dv2 = r2 < 2 ? 0 : 11 - r2;
    if (dv2 !== parseInt(d[13], 10)) return { ok: false, motivo: 'Dígito verificador inválido.' };
    return { ok: true, motivo: '' };
  }

  // Mapeia erros diretos de CNPJ para mensagens operacionais, sem expor
  // detalhes tecnicos de persistencia.
  function mapearErroCnpjEntidade(error, entidade, fallback) {
    if (!error) return fallback || 'Erro ao salvar.';
    const msg = String(error.message || '');
    const hint = String(error.hint || error.details || '');
    const ambos = msg + ' ' + hint;
    if (/clientes_cnpj_uidx|fornecedores_cnpj_uidx/i.test(ambos)) {
      return 'Já existe outro ' + entidade + ' com este CNPJ.';
    }
    if (/cnpj_valido|check constraint/i.test(ambos) || /^23514/.test(String(error.code))) {
      return 'CNPJ inválido.';
    }
    if (/row-level security|rls|policy/i.test(ambos)) {
      return 'Sem permissão para gravar (autorização negada).';
    }
    return fallback || 'Erro ao salvar.';
  }

  function applyCadastrosModalControlStyle(control) {
    if (!control) return control;

    control.style.width = '100%';
    control.style.minHeight = '44px';
    control.style.padding = control.tagName === 'SELECT' ? '10px 38px 10px 13px' : '10px 13px';
    control.style.border = '1px solid #d8dce2';
    control.style.borderRadius = '4px';
    control.style.background = control.disabled ? '#f4f6f8' : '#fff';
    control.style.boxShadow = 'none';
    control.style.outline = 'none';
    control.style.fontSize = '14px';
    control.style.fontFamily = 'inherit';
    control.style.lineHeight = '1.45';
    control.style.color = control.disabled ? '#97a0af' : '#2f3642';
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
        control.style.borderColor = '#2563eb';
        control.style.boxShadow = '0 0 0 3px rgba(37, 99, 235, 0.12)';
      });
      control.addEventListener('blur', function () {
        control.style.borderColor = '#d8dce2';
        control.style.boxShadow = 'none';
      });
    }

    return control;
  }

  function cadastrosModalField(options) {
    var label = options.label;
    var input = options.input;
    var hint = options.hint;
    var fullWidth = !!options.fullWidth;
    var wrap = window.el('div', {
      style: 'display:flex; flex-direction:column; gap:7px; min-width:0;'
    });

    if (fullWidth) wrap.style.gridColumn = '1 / -1';

    wrap.appendChild(window.el('label', {
      style: 'font-size:12px; line-height:1.2; font-weight:700; letter-spacing:.04em; text-transform:uppercase; color:#5b6472;'
    }, label));
    wrap.appendChild(applyCadastrosModalControlStyle(input));

    if (hint) {
      wrap.appendChild(window.el('p', {
        style: 'margin:0; font-size:12px; line-height:1.45; color:#8a93a3;'
      }, hint));
    }

    return wrap;
  }

  function cadastrosModalGrid(fields, minWidth) {
    return window.el('div', {
      style: `display:grid; grid-template-columns:repeat(auto-fit, minmax(${minWidth || 220}px, 1fr)); gap:16px 18px;`
    }, ...fields);
  }

  function cadastrosModalRow(fields, columns, breakpoint) {
    var useSingleColumn = window.innerWidth < (breakpoint || 720);
    return window.el('div', {
      style: `display:grid; grid-template-columns:${useSingleColumn ? '1fr' : `repeat(${columns || 2}, minmax(0, 1fr))`}; gap:16px 18px;`
    }, ...fields);
  }

  function cadastrosModalStack(children) {
    return window.el('div', {
      style: 'display:flex; flex-direction:column; gap:16px;'
    }, ...children);
  }

  function cadastrosModalPanel(options) {
    var title = options.title;
    var hint = options.hint;
    var content = options.content;
    var wrap = window.el('div', {
      style: 'display:flex; flex-direction:column; gap:12px; padding:14px; border:1px solid #eceef1; border-radius:4px; background:#fbfcfd;'
    });
    wrap.appendChild(window.el('div', {
      style: 'font-size:12px; line-height:1.2; font-weight:700; letter-spacing:.04em; text-transform:uppercase; color:#5b6472;'
    }, title));
    if (hint) {
      wrap.appendChild(window.el('p', {
        style: 'margin:0; font-size:12px; line-height:1.45; color:#8a93a3;'
      }, hint));
    }
    wrap.appendChild(content);
    return wrap;
  }

  function cadastrosTextarea(options) {
    var textarea = window.el('textarea', {
      rows: String(options.rows || 4),
      placeholder: options.placeholder || ''
    });
    textarea.value = options.value || '';
    applyCadastrosModalControlStyle(textarea);
    textarea.style.minHeight = options.minHeight || '104px';
    textarea.style.resize = 'vertical';
    return textarea;
  }

  function cadastrosObservacoesField(value) {
    var input = cadastrosTextarea({
      value: value || '',
      placeholder: 'Observacoes internas (opcional)'
    });
    var field = cadastrosModalField({
      label: 'Observações',
      input: input,
      hint: 'Opcional. Fica salvo junto do cadastro.',
      fullWidth: true
    });
    return { field: field, input: input };
  }

  function openCadastrosFormModal(options) {
    var title = options.title;
    var body = options.body;
    var onSave = options.onSave;
    var saveLabel = options.saveLabel || 'Salvar';
    var onClose = options.onClose;
    var maxWidth = options.maxWidth || 680;
    var overlay = window.el('div', {
      style: 'position:fixed; inset:0; z-index:40; display:flex; align-items:center; justify-content:center; padding:24px 18px; background:rgba(15, 23, 42, 0.42); backdrop-filter:blur(2px);',
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
      style: `width:min(100%, ${maxWidth}px); max-height:min(92vh, 860px); display:flex; flex-direction:column; background:#fff; border:1px solid #eceef1; border-radius:6px; box-shadow:0 20px 54px rgba(15, 23, 42, 0.18); overflow:hidden;`
    });
    var titleWrap = window.el('div', {
      style: 'display:flex; flex-direction:column; gap:4px; min-width:0;'
    });
    titleWrap.appendChild(window.el('h2', {
      style: 'margin:0; font-size:20px; line-height:1.2; font-weight:700; color:#1f2937;'
    }, title));

    var closeButton = window.el('button', {
      type: 'button',
      'aria-label': 'Fechar',
      onclick: close,
      style: 'width:32px; height:32px; flex:0 0 auto; display:inline-flex; align-items:center; justify-content:center; border:1px solid #e5e7eb; border-radius:4px; background:#fff; color:#8a93a3; font-size:20px; line-height:1; cursor:pointer;'
    }, '×');
    closeButton.addEventListener('mouseenter', function () {
      closeButton.style.borderColor = '#d0d5de';
      closeButton.style.color = '#475569';
      closeButton.style.background = '#f8fafc';
    });
    closeButton.addEventListener('mouseleave', function () {
      closeButton.style.borderColor = '#e5e7eb';
      closeButton.style.color = '#8a93a3';
      closeButton.style.background = '#fff';
    });

    var header = window.el('div', {
      style: 'display:flex; align-items:flex-start; justify-content:space-between; gap:18px; padding:18px 20px 16px; border-bottom:1px solid #edf1f5;'
    }, titleWrap, closeButton);
    var content = window.el('div', {
      style: 'padding:18px 20px 20px; overflow-y:auto;'
    }, body);

    var btnCancel = window.el('button', {
      type: 'button',
      onclick: close,
      style: 'height:40px; min-width:110px; padding:0 16px; border:1px solid #d8dce2; border-radius:4px; background:#fff; color:#5b6472; font-size:14px; font-weight:600; font-family:inherit; cursor:pointer; box-shadow:none;'
    }, 'Cancelar');
    btnCancel.addEventListener('mouseenter', function () {
      btnCancel.style.borderColor = '#c8d0db';
      btnCancel.style.background = '#f8fafc';
    });
    btnCancel.addEventListener('mouseleave', function () {
      btnCancel.style.borderColor = '#d8dce2';
      btnCancel.style.background = '#fff';
    });

    var btnSave = window.el('button', {
      type: 'button',
      style: 'height:40px; min-width:110px; padding:0 16px; border:none; border-radius:4px; background:#2563eb; color:#fff; font-size:14px; font-weight:600; font-family:inherit; cursor:pointer; box-shadow:none; transition:background .18s ease, opacity .18s ease;',
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
      btnSave.style.background = '#1d4ed8';
    });
    btnSave.addEventListener('mouseleave', function () {
      if (btnSave.disabled) return;
      btnSave.style.background = '#2563eb';
    });

    var footer = window.el('div', {
      style: 'display:flex; align-items:center; justify-content:flex-end; gap:10px; padding:14px 20px; border-top:1px solid #edf1f5; background:#fff;'
    }, btnCancel, btnSave);

    card.appendChild(header);
    card.appendChild(content);
    card.appendChild(footer);
    overlay.appendChild(card);
    document.body.appendChild(overlay);

    return { close: close };
  }

  // -------------------------------------------------------------------
  // Telas
  // -------------------------------------------------------------------

  async function screenCadastrosCores() {
    const container = window.el('div', {});
    let allRows = [];
    let busca = '';
    let columnSupport = { observacoes: false };

    async function reload() {
      const [support, result] = await Promise.all([
        detectOptionalColumns('cores', ['observacoes']),
        window.supa.from('cores').select('*').order('nome')
      ]);
      columnSupport = support;
      const { data, error } = result;
      if (error) { window.toast('Erro ao carregar cores', 'error'); console.error(error); return; }
      allRows = data || [];
      render();
    }

    function getSwatchTone(nome) {
      const normalized = String(nome || '').trim().toUpperCase();
      const palette = {
        AMARELO: '#facc15',
        AREIA: '#d6c3a1',
        AZUL: '#2563eb',
        AZUL_CLARO: '#60a5fa',
        BEGE: '#d6b98c',
        BRANCO: '#f8fafc',
        CINZA: '#8a93a3',
        CRU: '#e8dcc8',
        GRAFITE: '#4b5563',
        KRAFT: '#b5722e',
        LARANJA: '#f97316',
        MARINHO: '#1e3a5f',
        PRETO: '#1a1a1a',
        ROSA: '#ec4899',
        ROXO: '#7c3aed',
        VERDE: '#16a34a',
        VERMELHO: '#dc2626'
      };
      if (palette[normalized]) return palette[normalized];
      if (normalized.includes('AZUL')) return '#2563eb';
      if (normalized.includes('CINZA')) return '#8a93a3';
      if (normalized.includes('CRU')) return '#e8dcc8';
      if (normalized.includes('KRAFT')) return '#b5722e';
      if (normalized.includes('MARINHO')) return '#1e3a5f';
      if (normalized.includes('PRETO')) return '#1a1a1a';
      if (normalized.includes('BRANCO')) return '#f8fafc';
      if (normalized.includes('VERDE')) return '#16a34a';
      if (normalized.includes('VERMELHO')) return '#dc2626';
      if (normalized.includes('ROSA')) return '#ec4899';
      if (normalized.includes('ROXO')) return '#7c3aed';
      if (normalized.includes('AMARELO')) return '#facc15';
      if (normalized.includes('LARANJA')) return '#f97316';
      return '#cbd5e1';
    }

    function svgIcon(markup) {
      var tmp = document.createElement('div');
      tmp.innerHTML = markup.trim();
      return tmp.firstChild;
    }

    var ICON_PLUS = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>';
    var ICON_SEARCH = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9aa2af" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>';
    var ICON_SQUARE_PEN = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4z"></path></svg>';
    var ICON_TRASH = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path><path d="M10 11v6M14 11v6"></path><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path></svg>';

    function makeIconButton(title, icon, onClick, danger) {
      const button = window.el('button', {
        type: 'button',
        title,
        'aria-label': title,
        onclick: onClick,
        style: [
          'width:30px',
          'height:30px',
          'display:inline-flex',
          'align-items:center',
          'justify-content:center',
          'border:1px solid #eceef1',
          'border-radius:4px',
          'background:#fff',
          `color:${danger ? '#d6403a' : '#8a93a3'}`,
          'cursor:pointer',
          'transition:border-color .18s ease, color .18s ease, background .18s ease'
        ].join(';'),
        onmouseenter: () => {
          if (danger) {
            button.style.borderColor = '#fca5a5';
            button.style.background = '#fff5f5';
            button.style.color = '#d6403a';
          } else {
            button.style.borderColor = '#d0d5de';
            button.style.color = '#3f4757';
          }
        },
        onmouseleave: () => {
          button.style.borderColor = '#eceef1';
          button.style.background = '#fff';
          button.style.color = danger ? '#d6403a' : '#8a93a3';
        }
      });
      if (typeof icon === 'string') button.appendChild(window.el('span', {}, icon));
      else if (icon) button.appendChild(icon);
      return button;
    }

    function makePrimaryButton(label, onClick) {
      const button = window.el('button', {
        type: 'button',
        onclick: onClick,
        style: 'display:inline-flex; align-items:center; gap:7px; background:#2563eb; color:#fff; border:none; border-radius:4px; padding:9px 16px; font-weight:600; font-size:14px; font-family:inherit; cursor:pointer;'
      });
      button.appendChild(svgIcon(ICON_PLUS));
      button.appendChild(window.el('span', {}, label));
      return button;
    }

    function formatColorName(nome) {
      return String(nome || '')
        .toLowerCase()
        .replace(/\b([a-zà-ÿ])/g, function (_, chr) { return chr.toUpperCase(); });
    }

    function filteredRows() {
      const term = busca.trim().toUpperCase();
      if (!term) return allRows;
      return allRows.filter((row) => String(row.nome || '').toUpperCase().includes(term));
    }

    function render() {
      const rows = filteredRows();
      const page = window.el('div', {
        style: 'display:flex; flex-direction:column;'
      });

      const header = window.el('div', {
        style: 'display:flex; justify-content:space-between; align-items:flex-start; gap:16px; flex-wrap:wrap; margin-bottom:20px;'
      });
      const headerText = window.el('div', {},
        window.el('div', {
          style: 'font-size:22px; font-weight:800; color:#16203a; letter-spacing:-.01em;'
        }, 'Cores'),
        window.el('div', {
          style: 'font-size:13px; color:#8a93a3; margin-top:3px;'
        }, 'Gerencie as cores disponíveis na operação.')
      );
      header.appendChild(headerText);
      header.appendChild(makePrimaryButton('Nova cor', () => openModal(null)));

      const searchWrap = window.el('div', {
        style: 'display:flex; align-items:center; gap:8px; background:#fff; border:1px solid #d8dce2; border-radius:4px; padding:8px 13px; margin-bottom:14px;'
      });
      const searchIcon = svgIcon(ICON_SEARCH);
      const searchInput = window.el('input', {
        type: 'search',
        value: busca,
        placeholder: 'Buscar por nome...',
        oninput: (e) => {
          busca = e.target.value || '';
          render();
        },
        style: 'width:100%; border:0; outline:none; background:transparent; font-size:13px; color:#16203a; padding:0; font-family:inherit;'
      });
      searchInput.setAttribute('aria-label', 'Buscar por nome');
      searchWrap.appendChild(searchIcon);
      searchWrap.appendChild(searchInput);

      const tableWrap = window.el('div', {
        style: 'display:flex; flex-direction:column;'
      });
      const card = window.el('div', {
        style: 'background:#fff; border:1px solid #eceef1; border-radius:6px 6px 0 0; overflow:hidden;'
      });
      const headRow = window.el('div', {
        style: 'display:grid; grid-template-columns:1fr 80px 66px; align-items:center; gap:16px; padding:10px 18px; background:#f8f9fb; border-bottom:1px solid #eceef1;'
      });
      headRow.appendChild(window.el('div', { style: 'font-size:11px; font-weight:700; color:#8a93a3; letter-spacing:.04em;' }, 'NOME'));
      headRow.appendChild(window.el('div', { style: 'font-size:11px; font-weight:700; color:#8a93a3; letter-spacing:.04em;' }, 'ID'));
      headRow.appendChild(window.el('div', { style: 'font-size:11px; font-weight:700; color:#8a93a3; letter-spacing:.04em; text-align:center;' }, 'AÇÕES'));
      card.appendChild(headRow);

      rows.forEach((row, index) => {
        const line = window.el('div', {
          style: `display:grid; grid-template-columns:1fr 80px 66px; align-items:center; gap:16px; padding:13px 18px; border-bottom:${index === rows.length - 1 ? '0' : '1px solid #f1f3f6'};`
        });
        const tone = getSwatchTone(row.nome);
        const nameCell = window.el('div', {
          style: 'display:flex; align-items:center; gap:12px; min-width:0;'
        });
        nameCell.appendChild(window.el('span', {
          'aria-hidden': 'true',
          style: `width:22px; height:22px; border-radius:50%; background:${tone}; flex-shrink:0; box-shadow:0 0 0 1px ${tone === '#e8dcc8' ? 'rgba(0,0,0,.08)' : 'rgba(0,0,0,.06)'};`
        }));
        nameCell.appendChild(window.el('span', {
          style: 'font-size:14px; font-weight:500; color:#16203a; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;'
        }, formatColorName(row.nome || '')));
        const idCell = window.el('div', {
          style: 'font-size:13px; color:#9aa2af; font-weight:500;'
        }, String(row.id ?? ''));
        const actions = window.el('div', {
          style: 'display:flex; align-items:center; justify-content:center; gap:6px;'
        });
        actions.appendChild(makeIconButton('Editar cor', svgIcon(ICON_SQUARE_PEN), () => openModal(row), false));
        actions.appendChild(makeIconButton('Excluir cor', svgIcon(ICON_TRASH), () => confirmExcluir(row), true));
        line.appendChild(nameCell);
        line.appendChild(idCell);
        line.appendChild(actions);
        card.appendChild(line);
      });

      if (!rows.length) {
        card.appendChild(window.el('div', {
          style: 'padding:20px 18px; font-size:14px; color:#6b7280; text-align:center;'
        }, busca ? 'Nenhuma cor encontrada.' : 'Nenhuma cor cadastrada.'));
      }

      const footer = window.el('div', {
        style: 'padding:11px 18px; background:#fff; border:1px solid #eceef1; border-top:none; border-radius:0 0 6px 6px;'
      });
      footer.appendChild(window.el('span', {
        style: 'font-size:13px; color:#9aa2af;'
      }, `${rows.length} ${rows.length === 1 ? 'cor cadastrada' : 'cores cadastradas'}`));

      tableWrap.appendChild(card);
      tableWrap.appendChild(footer);
      page.appendChild(header);
      page.appendChild(searchWrap);
      page.appendChild(tableWrap);
      container.replaceChildren(page);
    }

    function openModal(cor) {
      const isEdit = !!cor;
      const nomeInput = window.textInput({ value: cor?.nome || '', placeholder: 'Ex: VERMELHO', required: true });
      const bodyFields = [
        cadastrosModalField({ label: 'Nome', input: nomeInput, hint: 'Use letras maiúsculas para padronizar.', fullWidth: true })
      ];
      let observacoesField = null;
      if (columnSupport.observacoes) {
        observacoesField = cadastrosObservacoesField(cor?.observacoes);
        bodyFields.push(observacoesField.field);
      }
      const body = cadastrosModalStack(bodyFields);
      openCadastrosFormModal({
        title: isEdit ? 'Editar cor' : 'Nova cor',
        maxWidth: 560,
        body,
        onSave: async () => {
          const nome = nomeInput.value.trim().toUpperCase();
          if (!nome) { window.toast('Nome é obrigatório', 'error'); return false; }
          const payload = { nome };
          if (columnSupport.observacoes) payload.observacoes = observacoesField.input.value.trim() || null;
          const { error } = isEdit
            ? await window.supa.from('cores').update(payload).eq('id', cor.id)
            : await window.supa.from('cores').insert(payload);
          if (error) { window.toast(error.message.includes('duplicate') ? 'Cor já cadastrada' : 'Erro ao salvar', 'error'); console.error(error); return false; }
          window.toast(isEdit ? 'Cor atualizada' : 'Cor criada', 'success');
          reload();
        }
      });
    }

    function confirmExcluir(cor) {
      window.confirmDialog({
        title: 'Excluir cor',
        message: `Excluir "${cor.nome}"? Se algum modelo usar essa cor, a exclusão vai falhar.`,
        confirmLabel: 'Excluir',
        onConfirm: async () => {
          const { error } = await window.supa.from('cores').delete().eq('id', cor.id);
          if (error) { window.toast('Cor está em uso (não dá pra excluir)', 'error'); console.error(error); return; }
          window.toast('Cor excluída', 'success');
          reload();
        }
      });
    }

    await reload();
    return window.shellLayout(window.ADMIN_MENU, container);
  }

  async function screenCadastrosClientes() {
    const container = window.el('div', {});
    let columnSupport = { contato: false, telefone: false, observacoes: false };
    let allRows = [];
    let busca = '';

    var ICON_SEARCH = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9aa2af" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>';
    var ICON_SQUARE_PEN = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4z"></path></svg>';
    var ICON_TRASH = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path><path d="M10 11v6M14 11v6"></path><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path></svg>';

    function svgIcon(markup) {
      const wrap = window.el('span', {
        style: 'display:inline-flex; align-items:center; justify-content:center;'
      });
      wrap.innerHTML = markup;
      return wrap.firstChild;
    }

    function makePrimaryButton(label, onClick) {
      const icon = svgIcon('<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>');
      return window.el('button', {
        type: 'button',
        onclick: onClick,
        style: 'display:inline-flex; align-items:center; gap:7px; background:#2563eb; color:#fff; border:none; border-radius:4px; padding:9px 16px; font-weight:600; font-size:14px; font-family:inherit; cursor:pointer; box-shadow:none;'
      }, icon, label);
    }

    function makeIconButton(title, icon, onClick, danger) {
      const button = window.el('button', {
        type: 'button',
        title,
        'aria-label': title,
        onclick: onClick,
        style: [
          'width:30px',
          'height:30px',
          'display:inline-flex',
          'align-items:center',
          'justify-content:center',
          'border:1px solid #eceef1',
          'border-radius:4px',
          'background:#fff',
          `color:${danger ? '#d6403a' : '#8a93a3'}`,
          'cursor:pointer',
          'padding:0',
          'transition:border-color .18s ease, color .18s ease, background .18s ease'
        ].join(';'),
        onmouseenter: () => {
          if (danger) {
            button.style.borderColor = '#fca5a5';
            button.style.background = '#fff1f1';
            button.style.color = '#c53030';
          } else {
            button.style.borderColor = '#d0d5de';
            button.style.color = '#3f4757';
          }
        },
        onmouseleave: () => {
          button.style.borderColor = '#eceef1';
          button.style.background = '#fff';
          button.style.color = danger ? '#d6403a' : '#8a93a3';
        }
      }, icon);
      return button;
    }

    async function reload() {
      const [support, result] = await Promise.all([
        detectOptionalColumns('clientes', ['contato', 'telefone', 'observacoes']),
        window.supa.from('clientes').select('*').order('nome')
      ]);
      columnSupport = support;
      const { data, error } = result;
      if (error) { window.toast('Erro ao carregar clientes', 'error'); console.error(error); return; }
      allRows = data || [];
      render();
    }

    function render() {
      const rows = busca
        ? allRows.filter((row) => String(row.nome || '').toLowerCase().includes(busca.trim().toLowerCase()))
        : allRows.slice();

      const page = window.el('div', {
        style: 'display:flex; flex-direction:column;'
      });

      const header = window.el('div', {
        style: 'display:flex; align-items:center; justify-content:space-between; gap:16px; flex-wrap:wrap; margin-bottom:20px;'
      });
      const headerText = window.el('div', {},
        window.el('div', {
          style: 'font-size:22px; font-weight:800; color:#16203a; letter-spacing:-.01em;'
        }, 'Clientes'),
        window.el('div', {
          style: 'font-size:13px; color:#8a93a3; margin-top:3px;'
        }, 'Gerencie os clientes da operacao.')
      );
      header.appendChild(headerText);
      header.appendChild(makePrimaryButton('Novo cliente', () => openModal(null)));

      const searchWrap = window.el('div', {
        style: 'display:flex; align-items:center; gap:8px; width:100%; background:#fff; border:1px solid #d8dce2; border-radius:4px; padding:8px 13px; margin-bottom:14px;'
      });
      const searchInput = window.el('input', {
        type: 'search',
        value: busca,
        placeholder: 'Buscar por nome...',
        oninput: (e) => {
          busca = e.target.value || '';
          render();
        },
        style: 'width:100%; border:0; outline:none; background:transparent; font-size:13px; color:#16203a; padding:0; font-family:inherit;'
      });
      searchInput.setAttribute('aria-label', 'Buscar por nome');
      searchWrap.appendChild(svgIcon(ICON_SEARCH));
      searchWrap.appendChild(searchInput);

      const tableWrap = window.el('div', { style: 'display:flex; flex-direction:column;' });
      const card = window.el('div', {
        style: 'background:#fff; border:1px solid #eceef1; border-radius:6px 6px 0 0; overflow:hidden;'
      });
      const columns = [
        { key: 'nome', label: 'NOME', width: '1.2fr', truncate: true },
      ];
      if (columnSupport.contato) columns.push({ key: 'contato', label: 'CONTATO', width: '1fr', optional: true, truncate: true });
      if (columnSupport.telefone) columns.push({ key: 'telefone', label: 'TELEFONE', width: '1fr', optional: true });
      columns.push({ key: 'cnpj', label: 'CNPJ', width: '1.2fr' });
      columns.push({ key: 'id', label: 'ID', width: '70px' });
      columns.push({ key: 'acoes', label: 'ACOES', width: '100px', align: 'center' });
      const gridTemplate = columns.map((column) => column.width).join(' ');

      const headRow = window.el('div', {
        style: `display:grid; grid-template-columns:${gridTemplate}; align-items:center; gap:16px; padding:10px 18px; background:#f8f9fb; border-bottom:1px solid #eceef1;`
      });
      columns.forEach((column) => {
        const head = window.el('div', {
          style: `font-size:11px; font-weight:700; color:#8a93a3; letter-spacing:.04em; ${column.truncate ? window.TRUNCATE_CELL_STYLE : 'white-space:nowrap;'}${column.align === 'center' ? ' text-align:center;' : ''}`
        }, column.label + (column.optional ? ' ' : ''));
        if (column.optional) {
          head.appendChild(window.el('span', {
            style: 'font-size:10px; font-weight:500; color:#b6bdc8; letter-spacing:0;'
          }, '(opcional)'));
        }
        headRow.appendChild(head);
      });
      card.appendChild(headRow);

      rows.forEach((row, index) => {
        const line = window.el('div', {
          style: `display:grid; grid-template-columns:${gridTemplate}; align-items:center; gap:16px; padding:13px 18px; border-bottom:${index === rows.length - 1 ? '0' : '1px solid #f1f3f6'};`
        });
        line.appendChild(window.truncatedCell(row.nome || '', row.nome, 'font-size:14px; font-weight:500; color:#16203a;'));
        if (columnSupport.contato) {
          const contatoText = row.contato || '—';
          line.appendChild(window.truncatedCell(contatoText, row.contato, `font-size:13.5px; color:${contatoText === '—' ? '#aab2bf' : '#3f4757'};`));
        }
        if (columnSupport.telefone) {
          const telefoneText = row.telefone || '—';
          line.appendChild(window.el('div', {
            style: `font-size:13.5px; color:${telefoneText === '—' ? '#aab2bf' : '#3f4757'};`
          }, telefoneText));
        }
        line.appendChild(window.el('div', {
          style: 'font-size:13.5px; color:' + (row.cnpj ? '#3f4757' : '#aab2bf') + '; font-variant-numeric:tabular-nums;'
        }, row.cnpj ? formatarCnpj(row.cnpj) : '—'));
        line.appendChild(window.el('div', {
          style: 'font-size:13px; color:#9aa2af; font-weight:500;'
        }, String(row.id ?? '')));
        const actions = window.el('div', {
          style: 'display:flex; align-items:center; justify-content:center; gap:6px;'
        });
        actions.appendChild(makeIconButton('Editar cliente', svgIcon(ICON_SQUARE_PEN), () => openModal(row), false));
        actions.appendChild(makeIconButton('Excluir cliente', svgIcon(ICON_TRASH), () => confirmExcluir(row), true));
        line.appendChild(actions);
        card.appendChild(line);
      });

      if (!rows.length) {
        card.appendChild(window.el('div', {
          style: 'padding:20px 18px; font-size:14px; color:#6b7280; text-align:center;'
        }, busca ? 'Nenhum cliente encontrado.' : 'Nenhum cliente cadastrado.'));
      }

      const footer = window.el('div', {
        style: 'padding:11px 18px; background:#fff; border:1px solid #eceef1; border-top:none; border-radius:0 0 6px 6px;'
      });
      footer.appendChild(window.el('span', {
        style: 'font-size:13px; color:#9aa2af;'
      }, `${rows.length} ${rows.length === 1 ? 'cliente cadastrado' : 'clientes cadastrados'}`));

      tableWrap.appendChild(card);
      tableWrap.appendChild(footer);
      page.appendChild(header);
      page.appendChild(searchWrap);
      page.appendChild(tableWrap);
      container.replaceChildren(page);
    }

    function openModal(cli) {
      const isEdit = !!cli;
      const nomeInput = window.textInput({ value: cli?.nome || '', placeholder: 'Ex: LOJA CENTRAL', required: true });
      const cnpjInput = window.textInput({ value: formatarCnpj(cli?.cnpj || ''), placeholder: '00.000.000/0000-00' });
      cnpjInput.addEventListener('input', function () {
        const start = cnpjInput.selectionStart;
        const before = cnpjInput.value;
        const normalizado = normalizarCnpj(cnpjInput.value);
        cnpjInput.value = normalizado.length > 1 ? formatarCnpj(normalizado) : normalizado;
        const delta = cnpjInput.value.length - before.length;
        const pos = Math.max(0, (start || 0) + (delta > 0 ? 1 : 0));
        try { cnpjInput.setSelectionRange(pos, pos); } catch (_) {}
      });
      const bodyRows = [
        cadastrosModalField({ label: 'Nome', input: nomeInput, fullWidth: true }),
        cadastrosModalField({ label: 'CNPJ', input: cnpjInput, hint: 'Opcional. Armazenado sem pontuação.' })
      ];
      const optionalFields = [];
      let contatoInput = null;
      let telefoneInput = null;
      if (columnSupport.contato) {
        contatoInput = window.textInput({ value: cli?.contato || '', placeholder: 'Ex: Maria Silva' });
        optionalFields.push(cadastrosModalField({ label: 'Contato', input: contatoInput, hint: 'Opcional' }));
      }
      if (columnSupport.telefone) {
        telefoneInput = window.textInput({ value: cli?.telefone || '', placeholder: 'Ex: (11) 99999-9999' });
        optionalFields.push(cadastrosModalField({ label: 'Telefone', input: telefoneInput, hint: 'Opcional' }));
      }
      if (optionalFields.length > 1) bodyRows.push(cadastrosModalRow(optionalFields, 2, 720));
      else if (optionalFields.length === 1) bodyRows.push(optionalFields[0]);
      let observacoesField = null;
      if (columnSupport.observacoes) {
        observacoesField = cadastrosObservacoesField(cli?.observacoes);
        bodyRows.push(observacoesField.field);
      }
      const body = cadastrosModalStack(bodyRows);
      openCadastrosFormModal({
        title: isEdit ? 'Editar cliente' : 'Novo cliente',
        maxWidth: 640,
        body,
        onSave: async () => {
          const nome = nomeInput.value.trim();
          if (!nome) { window.toast('Nome é obrigatório', 'error'); return false; }
          const cnpj = normalizarCnpj(cnpjInput.value);
          if (cnpj) {
            const validacao = validarCnpjDv(cnpj);
            if (!validacao.ok) { window.toast(validacao.motivo, 'error'); return false; }
          }
          const payload = { nome, cnpj: cnpj || null };
          if (columnSupport.contato) payload.contato = contatoInput.value.trim() || null;
          if (columnSupport.telefone) payload.telefone = telefoneInput.value.trim() || null;
          if (columnSupport.observacoes) payload.observacoes = observacoesField.input.value.trim() || null;
          const { error } = isEdit
            ? await window.supa.from('clientes').update(payload).eq('id', cli.id)
            : await window.supa.from('clientes').insert(payload);
          if (error) { window.toast(mapearErroCnpjEntidade(error, 'Cliente', error.message.includes('duplicate') ? 'Cliente já cadastrado' : 'Erro ao salvar'), 'error'); console.error(error); return false; }
          window.toast(isEdit ? 'Cliente atualizado' : 'Cliente criado', 'success');
          reload();
        }
      });
    }

    function confirmExcluir(cli) {
      window.confirmDialog({
        title: 'Excluir cliente',
        message: `Excluir "${cli.nome}"? Se algum lote usar esse cliente, a exclusão vai falhar.`,
        confirmLabel: 'Excluir',
        onConfirm: async () => {
          const { error } = await window.supa.from('clientes').delete().eq('id', cli.id);
          if (error) { window.toast('Cliente está em uso (não dá pra excluir)', 'error'); console.error(error); return; }
          window.toast('Cliente excluído', 'success');
          reload();
        }
      });
    }

    await reload();
    return window.shellLayout(window.ADMIN_MENU, container);
  }

  async function screenCadastrosModelos() {
    const container = window.el('div', {});
    let allRows = [];
    let allCores = [];
    let busca = '';
    let columnSupport = { observacoes: false };

    function svgIcon(markup) {
      const wrap = window.el('span', {
        style: 'display:inline-flex; align-items:center; justify-content:center;'
      });
      wrap.innerHTML = markup;
      return wrap.firstChild;
    }

    var ICON_PLUS = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>';
    var ICON_SEARCH = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9aa2af" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>';
    var ICON_SQUARE_PEN = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4z"></path></svg>';
    var ICON_TRASH = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path><path d="M10 11v6M14 11v6"></path><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path></svg>';

    function makePrimaryButton(label, onClick) {
      const icon = svgIcon(ICON_PLUS);
      return window.el('button', {
        type: 'button',
        onclick: onClick,
        style: 'display:inline-flex; align-items:center; gap:7px; background:#2563eb; color:#fff; border:none; border-radius:4px; padding:9px 16px; font-weight:600; font-size:14px; font-family:inherit; cursor:pointer; box-shadow:none;'
      }, icon, label);
    }

    function makeIconButton(title, icon, onClick, danger) {
      const button = window.el('button', {
        type: 'button',
        title,
        'aria-label': title,
        onclick: onClick,
        style: [
          'width:30px',
          'height:30px',
          'display:inline-flex',
          'align-items:center',
          'justify-content:center',
          'border:1px solid #eceef1',
          'border-radius:4px',
          'background:#fff',
          `color:${danger ? '#d6403a' : '#8a93a3'}`,
          'cursor:pointer',
          'padding:0',
          'transition:border-color .18s ease, color .18s ease, background .18s ease'
        ].join(';'),
        onmouseenter: () => {
          if (danger) {
            button.style.borderColor = '#fca5a5';
            button.style.background = '#fff1f1';
            button.style.color = '#c53030';
          } else {
            button.style.borderColor = '#d0d5de';
            button.style.color = '#3f4757';
          }
        },
        onmouseleave: () => {
          button.style.borderColor = '#eceef1';
          button.style.background = '#fff';
          button.style.color = danger ? '#d6403a' : '#8a93a3';
        }
      }, icon);
      return button;
    }

    function formatWidthBadge(value) {
      return Number(value).toFixed(2).replace('.', ',') + ' m';
    }

    function getSwatchTone(nome) {
      const normalized = String(nome || '').trim().toUpperCase();
      const palette = {
        AMARELO: '#facc15',
        AREIA: '#d6c3a1',
        AZUL: '#2563eb',
        AZUL_CLARO: '#60a5fa',
        BEGE: '#d6b98c',
        BRANCO: '#f8fafc',
        CINZA: '#8a93a3',
        CRU: '#e8dcc8',
        GRAFITE: '#4b5563',
        KRAFT: '#b5722e',
        LARANJA: '#f97316',
        MARINHO: '#1e3a5f',
        PRETO: '#1a1a1a',
        ROSA: '#ec4899',
        ROXO: '#7c3aed',
        VERDE: '#16a34a',
        VERMELHO: '#dc2626'
      };
      if (palette[normalized]) return palette[normalized];
      if (normalized.includes('AZUL')) return '#2563eb';
      if (normalized.includes('CINZA')) return '#8a93a3';
      if (normalized.includes('CRU')) return '#e8dcc8';
      if (normalized.includes('KRAFT')) return '#b5722e';
      if (normalized.includes('MARINHO')) return '#1e3a5f';
      if (normalized.includes('PRETO')) return '#1a1a1a';
      if (normalized.includes('BRANCO')) return '#f8fafc';
      if (normalized.includes('VERDE')) return '#16a34a';
      if (normalized.includes('VERMELHO')) return '#dc2626';
      if (normalized.includes('ROSA')) return '#ec4899';
      if (normalized.includes('ROXO')) return '#7c3aed';
      if (normalized.includes('AMARELO')) return '#facc15';
      if (normalized.includes('LARANJA')) return '#f97316';
      return '#cbd5e1';
    }

    function buildSwatchChip(color) {
      const tone = getSwatchTone(color?.nome || '');
      const isLight = ['#f8fafc', '#e8dcc8', '#facc15', '#d6c3a1', '#d6b98c'].includes(String(tone).toLowerCase());
      return window.el('span', {
        style: 'display:inline-flex; align-items:center; gap:8px; min-width:0;'
      },
      window.el('span', {
        style: `width:14px; height:14px; border-radius:999px; border:1px solid ${isLight ? '#d8dce2' : 'rgba(22,32,58,.12)'}; background:${tone}; flex:0 0 auto;`
      }),
      window.el('span', {
        style: `font-size:13px; color:${color?.nome ? '#3f4757' : '#aab2bf'}; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;`
      }, color?.nome || '—'));
    }

    function buildPreviewCard(row) {
      const tone1 = getSwatchTone(row.cor_1?.nome || '');
      const tone2 = getSwatchTone(row.cor_2?.nome || '');
      const widthLabel = formatWidthBadge(row.largura);
      const preview = window.el('div', {
        style: 'width:72px; height:48px; border-radius:6px; border:1px solid #e5e7eb; background:#fff; position:relative; overflow:hidden; box-shadow:inset 0 1px 0 rgba(255,255,255,.55);'
      });
      preview.appendChild(window.el('div', {
        style: `position:absolute; inset:0; background:linear-gradient(135deg, ${tone1} 0%, ${tone1} 49%, ${tone2} 51%, ${tone2} 100%);`
      }));
      preview.appendChild(window.el('div', {
        style: 'position:absolute; inset:10px 12px; border-radius:999px; border:2px solid rgba(255,255,255,.85);'
      }));
      preview.appendChild(window.el('div', {
        style: 'position:absolute; left:0; right:0; bottom:0; padding:3px 6px; background:rgba(22,32,58,.58); color:#fff; font-size:9px; font-weight:700; letter-spacing:.04em; text-align:center;'
      }, widthLabel));
      return preview;
    }

    async function reload() {
      columnSupport = await detectOptionalColumns('modelos', ['observacoes']);
      const modelosSelect = 'id, nome, largura, cor_1:cor_1_id(id, nome), cor_2:cor_2_id(id, nome)'
        + (columnSupport.observacoes ? ', observacoes' : '');
      const [modelosRes, coresRes] = await Promise.all([
        window.supa.from('modelos').select(modelosSelect).order('nome'),
        window.supa.from('cores').select('id, nome').order('nome')
      ]);
      if (modelosRes.error || coresRes.error) { window.toast('Erro ao carregar', 'error'); console.error(modelosRes.error || coresRes.error); return; }
      allRows = modelosRes.data || [];
      allCores = coresRes.data || [];
      render();
    }

    function render() {
      const rows = busca
        ? allRows.filter((row) => {
            const q = busca.trim().toLowerCase();
            return [row.nome, row.cor_1?.nome, row.cor_2?.nome, String(row.id), String(row.largura)].join(' ').toLowerCase().includes(q);
          })
        : allRows.slice();

      const page = window.el('div', { style: 'display:flex; flex-direction:column;' });
      const header = window.el('div', {
        style: 'display:flex; align-items:center; justify-content:space-between; gap:16px; flex-wrap:wrap; margin-bottom:20px;'
      });
      const headerText = window.el('div', {},
        window.el('div', {
          style: 'font-size:22px; font-weight:800; color:#16203a; letter-spacing:-.01em;'
        }, 'Modelos'),
        window.el('div', {
          style: 'font-size:13px; color:#8a93a3; margin-top:3px;'
        }, 'Gerencie os modelos com preview sintético, cores e largura.')
      );
      header.appendChild(headerText);
      header.appendChild(makePrimaryButton('Novo modelo', () => openModal(null, allCores)));

      const searchWrap = window.el('div', {
        style: 'display:flex; align-items:center; gap:8px; width:100%; background:#fff; border:1px solid #d8dce2; border-radius:4px; padding:8px 13px; margin-bottom:14px;'
      });
      const searchInput = window.el('input', {
        type: 'search',
        value: busca,
        placeholder: 'Buscar por nome, cor, largura ou ID...',
        oninput: (e) => {
          busca = e.target.value || '';
          render();
        },
        style: 'width:100%; border:0; outline:none; background:transparent; font-size:13px; color:#16203a; padding:0; font-family:inherit;'
      });
      searchInput.setAttribute('aria-label', 'Buscar modelos');
      searchWrap.appendChild(svgIcon(ICON_SEARCH));
      searchWrap.appendChild(searchInput);

      const tableWrap = window.el('div', { style: 'display:flex; flex-direction:column;' });
      const card = window.el('div', {
        style: 'background:#fff; border:1px solid #eceef1; border-radius:6px 6px 0 0; overflow:hidden;'
      });
      const gridTemplate = '92px 1.25fr 1.2fr 100px 66px';
      const headRow = window.el('div', {
        style: `display:grid; grid-template-columns:${gridTemplate}; align-items:center; gap:16px; padding:10px 18px; background:#f8f9fb; border-bottom:1px solid #eceef1;`
      });
      ['PREVIEW', 'MODELO', 'CORES', 'LARGURA'].forEach((label) => {
        headRow.appendChild(window.el('div', {
          style: 'font-size:11px; font-weight:700; color:#8a93a3; letter-spacing:.04em; white-space:nowrap;'
        }, label));
      });
      headRow.appendChild(window.el('div', {
        style: 'font-size:11px; font-weight:700; color:#8a93a3; letter-spacing:.04em; text-align:center; white-space:nowrap;'
      }, 'ACOES'));
      card.appendChild(headRow);

      rows.forEach((row, index) => {
        const line = window.el('div', {
          style: `display:grid; grid-template-columns:${gridTemplate}; align-items:center; gap:16px; padding:13px 18px; border-bottom:${index === rows.length - 1 ? '0' : '1px solid #f1f3f6'};`
        });

        line.appendChild(buildPreviewCard(row));

        const modelInfo = window.el('div', {
          style: 'display:flex; flex-direction:column; min-width:0;'
        });
        modelInfo.appendChild(window.el('div', {
          style: 'font-size:14px; font-weight:600; color:#16203a; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;'
        }, row.nome || ''));
        modelInfo.appendChild(window.el('div', {
          style: 'font-size:12px; color:#9aa2af; margin-top:3px;'
        }, `ID ${row.id ?? '—'}`));
        line.appendChild(modelInfo);

        const colorsWrap = window.el('div', {
          style: 'display:flex; flex-direction:column; gap:7px; min-width:0;'
        });
        colorsWrap.appendChild(buildSwatchChip(row.cor_1));
        colorsWrap.appendChild(buildSwatchChip(row.cor_2));
        line.appendChild(colorsWrap);

        line.appendChild(window.el('div', {},
          window.el('span', {
            style: 'display:inline-flex; align-items:center; border-radius:4px; padding:3px 9px; font-size:12px; font-weight:600; white-space:nowrap; background:#eef2ff; color:#3b5bcc;'
          }, formatWidthBadge(row.largura))
        ));

        const actions = window.el('div', {
          style: 'display:flex; align-items:center; justify-content:center; gap:6px;'
        });
        actions.appendChild(makeIconButton('Editar modelo', svgIcon(ICON_SQUARE_PEN), () => openModal(row, allCores), false));
        actions.appendChild(makeIconButton('Excluir modelo', svgIcon(ICON_TRASH), () => confirmExcluir(row), true));
        line.appendChild(actions);
        card.appendChild(line);
      });

      if (!rows.length) {
        card.appendChild(window.el('div', {
          style: 'padding:20px 18px; font-size:14px; color:#6b7280; text-align:center;'
        }, busca ? 'Nenhum modelo encontrado.' : 'Nenhum modelo cadastrado.'));
      }

      const footer = window.el('div', {
        style: 'padding:11px 18px; background:#fff; border:1px solid #eceef1; border-top:none; border-radius:0 0 6px 6px;'
      });
      footer.appendChild(window.el('span', {
        style: 'font-size:13px; color:#9aa2af;'
      }, `${rows.length} ${rows.length === 1 ? 'modelo cadastrado' : 'modelos cadastrados'}`));

      tableWrap.appendChild(card);
      tableWrap.appendChild(footer);
      page.appendChild(header);
      page.appendChild(searchWrap);
      page.appendChild(tableWrap);
      container.replaceChildren(page);
    }

    function openModal(modelo, cores) {
      const isEdit = !!modelo;
      const corOptions = cores.map(function (c) { return { value: c.id, label: c.nome }; });
      const nomeInput = window.textInput({ value: modelo?.nome || '', placeholder: 'Ex: Conforto', required: true });
      const cor1Sel = window.selectInput({ options: corOptions, value: modelo?.cor_1?.id });
      const cor2Sel = window.selectInput({ options: corOptions, value: modelo?.cor_2?.id });
      const largSel = window.selectInput({
        options: [{ value: '1.40', label: '1,40 m' }, { value: '2.10', label: '2,10 m' }],
        value: modelo?.largura
      });
      const imageInput = window.el('input', {
        type: 'file',
        accept: 'image/*',
        style: 'display:block; width:100%; font-size:13px; color:#5b6472;'
      });
      const previewEmpty = window.el('div', {
        style: 'display:flex; align-items:center; justify-content:center; width:100%; min-height:180px; border:1px dashed #d8dce2; border-radius:4px; background:#fff; font-size:13px; color:#9aa2af; text-align:center; padding:18px;'
      }, 'Anexe uma imagem para visualizar o preview do modelo.');
      const previewImage = window.el('img', {
        alt: 'Preview do modelo',
        style: 'display:none; width:100%; max-height:240px; object-fit:contain; border:1px solid #eceef1; border-radius:4px; background:#fff;'
      });
      const previewWrap = window.el('div', {
        style: 'display:flex; flex-direction:column; gap:10px;'
      }, previewEmpty, previewImage);
      imageInput.addEventListener('change', function () {
        var file = imageInput.files && imageInput.files[0];
        if (!file) {
          previewImage.removeAttribute('src');
          previewImage.style.display = 'none';
          previewEmpty.style.display = 'flex';
          return;
        }
        var reader = new FileReader();
        reader.onload = function () {
          previewImage.src = String(reader.result || '');
          previewImage.style.display = 'block';
          previewEmpty.style.display = 'none';
        };
        reader.readAsDataURL(file);
      });
      const bodyFields = [
        cadastrosModalField({ label: 'Nome do modelo', input: nomeInput, fullWidth: true }),
        cadastrosModalRow([
          cadastrosModalField({ label: 'Cor 1 (predominante)', input: cor1Sel, hint: 'A ordem importa: "BRANCO/PRETO" é diferente de "PRETO/BRANCO".' }),
          cadastrosModalField({ label: 'Cor 2', input: cor2Sel })
        ], 2, 720),
        cadastrosModalField({ label: 'Largura', input: largSel, fullWidth: true }),
        cadastrosModalPanel({
          title: 'Imagem do modelo',
          hint: 'Selecione uma imagem para conferir o preview abaixo.',
          content: window.el('div', {
            style: 'display:flex; flex-direction:column; gap:12px;'
          }, imageInput, previewWrap)
        })
      ];
      let observacoesField = null;
      if (columnSupport.observacoes) {
        observacoesField = cadastrosObservacoesField(modelo?.observacoes);
        bodyFields.push(observacoesField.field);
      }
      const body = cadastrosModalStack(bodyFields);
      openCadastrosFormModal({
        title: isEdit ? 'Editar modelo' : 'Novo modelo',
        maxWidth: 620,
        body,
        onSave: async () => {
          const nome = nomeInput.value.trim();
          const cor_1_id = cor1Sel.value;
          const cor_2_id = cor2Sel.value;
          const largura = largSel.value;
          if (!nome || !cor_1_id || !cor_2_id || !largura) { window.toast('Preencha todos os campos', 'error'); return false; }
          const payload = { nome, cor_1_id, cor_2_id, largura };
          if (columnSupport.observacoes) payload.observacoes = observacoesField.input.value.trim() || null;
          const { error } = isEdit
            ? await window.supa.from('modelos').update(payload).eq('id', modelo.id)
            : await window.supa.from('modelos').insert(payload);
          if (error) { window.toast(error.message.includes('duplicate') ? 'Modelo já cadastrado com essa combinação' : 'Erro ao salvar', 'error'); console.error(error); return false; }
          window.toast(isEdit ? 'Modelo atualizado' : 'Modelo criado', 'success');
          reload();
        }
      });
    }

    function confirmExcluir(modelo) {
      window.confirmDialog({
        title: 'Excluir modelo',
        message: `Excluir "${modelo.nome}"? Se algum item de OP usar esse modelo, a exclusão vai falhar.`,
        confirmLabel: 'Excluir',
        onConfirm: async () => {
          const { error } = await window.supa.from('modelos').delete().eq('id', modelo.id);
          if (error) { window.toast('Modelo está em uso (não dá pra excluir)', 'error'); console.error(error); return; }
          window.toast('Modelo excluído', 'success');
          reload();
        }
      });
    }

    await reload();
    return window.shellLayout(window.ADMIN_MENU, container);
  }

  async function screenCadastrosParametros() {
    const container = window.el('div', {});
    let lastRows = [];
    let saving = false;

    async function reload() {
      const { data, error } = await window.supa.from('parametros_largura').select('*').order('largura');
      if (error) { window.toast('Erro ao carregar par\u00e2metros', 'error'); console.error(error); return; }
      lastRows = (data || []).map((row) => ({ ...row }));
      render(lastRows);
    }

    function render(rows) {
      const orderedRows = [...rows].sort((a, b) => Number(a.largura) - Number(b.largura));
      const inputsByWidth = new Map();
      const latestMeta = getLatestMeta(orderedRows);

      const page = window.el('div', {
        style: 'display:flex; flex-direction:column;'
      });
      const headerBlock = window.el('div', {
        style: 'margin-bottom:22px;'
      });
      headerBlock.appendChild(window.el('div', {
        style: 'font-size:22px; font-weight:800; color:#16203a; letter-spacing:-.01em;'
      }, 'Par\u00e2metros de c\u00e1lculo'));
      headerBlock.appendChild(window.el('div', {
        style: 'font-size:13px; color:#8a93a3; margin-top:3px;'
      }, 'Esses valores s\u00e3o usados no c\u00e1lculo de fios ao simular uma OP. Edite com cuidado.'));
      page.appendChild(headerBlock);

      const card = window.el('section', {
        style: 'background:#fff; border:1px solid #eceef1; border-radius:6px; overflow:hidden;'
      });

      const cardHeader = window.el('div', {
        style: 'display:flex; align-items:flex-start; justify-content:space-between; gap:24px; padding:20px 24px 18px;'
      });
      const headerLeft = window.el('div', {
        style: 'display:flex; align-items:center; gap:14px; min-width:0;'
      });
      headerLeft.appendChild(window.el('div', {
        style: 'width:36px; height:36px; border-radius:6px; background:#eaf1fd; display:flex; align-items:center; justify-content:center; flex-shrink:0;'
      }, svgEl('<svg viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"></rect><path d="M3 9h18M9 21V9"></path></svg>', 18)));
      const headerText = window.el('div', {
        style: 'display:flex; flex-direction:column;'
      });
      headerText.appendChild(window.el('h2', {
        style: 'margin:0; font-size:15px; font-weight:700; color:#16203a;'
      }, 'Par\u00e2metros por largura'));
      headerText.appendChild(window.el('p', {
        style: 'margin:2px 0 0 0; font-size:12.5px; color:#8a93a3;'
      }, 'Valores em kg/ml, salvo indica\u00e7\u00e3o contr\u00e1ria.'));
      headerLeft.appendChild(headerText);

      const callout = window.el('div', {
        style: 'display:flex; align-items:flex-start; gap:8px; background:#f6f9ff; border:1px solid #d0e0fb; border-radius:4px; padding:10px 14px; max-width:340px; flex-shrink:0;'
      });
      callout.appendChild(svgEl('<svg viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;margin-top:1px;"><circle cx="12" cy="12" r="9"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>', 15));
      callout.appendChild(window.el('span', {
        style: 'font-size:12.5px; color:#2563eb; line-height:1.5;'
      }, 'Altera\u00e7\u00f5es afetam novas simula\u00e7\u00f5es de OP.', window.el('br'), 'OPs j\u00e1 abertas n\u00e3o s\u00e3o recalculadas automaticamente.'));
      cardHeader.appendChild(headerLeft);
      cardHeader.appendChild(callout);
      card.appendChild(cardHeader);

      const tableWrap = window.el('div', {
        style: 'border-top:1px solid #eceef1; overflow-x:auto;'
      });
      const grid = window.el('div', {});
      const headRow = window.el('div', {
        style: 'display:grid; grid-template-columns:1fr 1fr 1fr; gap:0; background:#f8f9fb; border-bottom:1px solid #eceef1;'
      });
      headRow.appendChild(headerCell('PAR\u00c2METRO', true));
      for (const row of orderedRows) headRow.appendChild(headerCell(`LARGURA ${formatWidth(row.largura)} m`, false));
      grid.appendChild(headRow);

      const fieldDefs = [
        { key: 'peso_linear', label: 'Peso linear', step: '0.0001' },
        { key: 'algodao_por_ml', label: 'Algod\u00e3o / ML', step: '0.000001' },
        { key: 'poliester_por_ml', label: 'Poli\u00e9ster / ML', step: '0.000001' },
        { key: 'valor_x', label: 'Fator X', step: '0.0001' },
      ];

      for (let index = 0; index < fieldDefs.length; index += 1) {
        const field = fieldDefs[index];
        const rowNode = window.el('div', {
          style: `display:grid; grid-template-columns:1fr 1fr 1fr; gap:0; align-items:center; border-bottom:${index === fieldDefs.length - 1 ? 'none' : '1px solid #f1f3f6'};`
        });
        rowNode.appendChild(paramLabelCell(field.label, index === fieldDefs.length - 1));
        for (const row of orderedRows) {
          const input = window.textInput({
            type: 'text',
            step: field.step,
            value: formatInputValue(row[field.key] ?? '')
          });
          styleInput(input);
          const widthKey = String(row.largura);
          if (!inputsByWidth.has(widthKey)) inputsByWidth.set(widthKey, {});
          inputsByWidth.get(widthKey)[field.key] = input;
          rowNode.appendChild(valueCell(input, index === fieldDefs.length - 1));
        }
        grid.appendChild(rowNode);
      }

      tableWrap.appendChild(grid);
      card.appendChild(tableWrap);

      const footer = window.el('div', {
        style: 'display:flex; align-items:center; justify-content:space-between; gap:16px; padding:16px 24px; border-top:1px solid #eceef1; margin-top:4px; flex-wrap:wrap;'
      });
      footer.appendChild(buildFooterMeta(latestMeta));

      const actions = window.el('div', {
        style: 'display:flex; gap:12px; align-items:center; justify-content:flex-end; flex-wrap:wrap;'
      });
      const cancelBtn = window.el('button', {
        type: 'button',
        style: 'display:inline-flex; align-items:center; gap:7px; background:#fff; color:#5b6472; border:1px solid #d8dce2; border-radius:4px; padding:9px 18px; font-weight:600; font-size:14px; font-family:inherit; cursor:pointer;',
        onclick: () => render(lastRows)
      }, 'Cancelar altera\u00e7\u00f5es');
      const saveBtn = window.el('button', {
        type: 'button',
        style: 'display:inline-flex; align-items:center; gap:8px; background:#2563eb; color:#fff; border:none; border-radius:4px; padding:9px 18px; font-weight:600; font-size:14px; font-family:inherit; cursor:pointer;',
        onclick: async () => {
          if (saving) return;
          saving = true;
          toggleActionButtons(cancelBtn, saveBtn, true);
          try {
            for (const row of orderedRows) {
              const widthKey = String(row.largura);
              const fieldInputs = inputsByWidth.get(widthKey) || {};
              const payload = {
                peso_linear: normalizeInputValue(fieldInputs.peso_linear?.value ?? row.peso_linear),
                algodao_por_ml: normalizeInputValue(fieldInputs.algodao_por_ml?.value ?? row.algodao_por_ml),
                poliester_por_ml: normalizeInputValue(fieldInputs.poliester_por_ml?.value ?? row.poliester_por_ml),
                valor_x: normalizeInputValue(fieldInputs.valor_x?.value ?? row.valor_x),
                atualizado_em: new Date().toISOString()
              };
              const { error } = await window.supa.from('parametros_largura').update(payload).eq('largura', row.largura);
              if (error) throw error;
            }
            window.toast('Par\u00e2metros atualizados', 'success');
            await reload();
          } catch (error) {
            window.toast('Erro ao salvar', 'error');
            console.error(error);
            toggleActionButtons(cancelBtn, saveBtn, false);
          } finally {
            saving = false;
          }
        }
      });
      saveBtn.appendChild(svgEl('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>', 15));
      saveBtn.appendChild(window.el('span', {}, 'Salvar par\u00e2metros'));
      actions.appendChild(cancelBtn);
      actions.appendChild(saveBtn);
      footer.appendChild(actions);
      card.appendChild(footer);

      page.appendChild(card);
      container.replaceChildren(page);
    }

    function svgEl(markup, size) {
      const wrap = window.el('span', {
        style: `width:${size}px; height:${size}px; display:inline-flex; align-items:center; justify-content:center; flex:0 0 auto;`
      });
      wrap.innerHTML = markup;
      const icon = wrap.firstChild;
      if (icon && icon.style) {
        icon.style.width = `${size}px`;
        icon.style.height = `${size}px`;
        icon.style.display = 'block';
      }
      return wrap;
    }

    function headerCell(text, isFirst) {
      return window.el('div', {
        style: [
          'padding:12px 24px',
          'text-align:left',
          'vertical-align:middle',
          `border-right:${isFirst ? '1px solid #eceef1' : 'none'}`,
          'font-size:11px',
          'font-weight:700',
          'color:#8a93a3',
          'letter-spacing:.04em'
        ].filter(Boolean).join('; ')
      }, text);
    }

    function paramLabelCell(label, isLastRow) {
      const td = window.el('div', {
        style: [
          'padding:16px 24px',
          'vertical-align:middle',
          'border-right:1px solid #eceef1'
        ].join('; ')
      });
      const wrap = window.el('div', {
        style: 'display:flex; align-items:center; font-size:14px; font-weight:500; color:#16203a;'
      });
      wrap.appendChild(window.el('span', {}, label));
      wrap.appendChild(window.el('span', {
        title: label,
        style: 'display:inline-flex; align-items:center; justify-content:center; width:16px; height:16px; border-radius:50%; border:1.5px solid #c5cad4; color:#9aa2af; font-size:10px; font-weight:700; cursor:help; flex-shrink:0; margin-left:6px;'
      }, '?'));
      td.appendChild(wrap);
      return td;
    }

    function valueCell(input, isLastRow) {
      const td = window.el('div', {
        style: [
          'padding:16px 24px',
          'vertical-align:middle'
        ].join('; ')
      });
      td.appendChild(input);
      return td;
    }

    function styleInput(input) {
      input.style.width = '100%';
      input.style.border = '1px solid #d8dce2';
      input.style.borderRadius = '4px';
      input.style.padding = '9px 12px';
      input.style.fontSize = '14px';
      input.style.fontFamily = 'inherit';
      input.style.color = '#16203a';
      input.style.border = '1px solid #d8dce2';
      input.style.background = '#fff';
      input.style.outline = 'none';
      input.style.boxSizing = 'border-box';
      input.addEventListener('focus', function () {
        input.style.borderColor = '#2563eb';
        input.style.boxShadow = '0 0 0 3px rgba(37,99,235,.1)';
      });
      input.addEventListener('blur', function () {
        input.style.borderColor = '#d8dce2';
        input.style.boxShadow = 'none';
      });
    }

    function buildFooterMeta(meta) {
      const wrap = window.el('div', {
        style: 'display:flex; align-items:center; gap:8px;'
      });
      wrap.appendChild(svgEl('<svg viewBox="0 0 24 24" fill="none" stroke="#9aa2af" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"></circle><polyline points="12 7 12 12 15 14"></polyline></svg>', 14));
      const text = window.el('div', {
        style: 'display:flex; flex-direction:column;'
      });
      text.appendChild(window.el('p', {
        style: 'margin:0; font-size:12.5px; color:#5b6472;'
      }, `\u00daltima atualiza\u00e7\u00e3o: ${meta.updatedAtLabel}`));
      text.appendChild(window.el('p', {
        style: 'margin:0; font-size:12px; color:#9aa2af;'
      }, `Atualizado por: ${meta.updatedByLabel}`));
      wrap.appendChild(text);
      return wrap;
    }

    function toggleActionButtons(cancelBtn, saveBtn, disabled) {
      cancelBtn.disabled = disabled;
      saveBtn.disabled = disabled;
      cancelBtn.style.opacity = disabled ? '0.65' : '1';
      saveBtn.style.opacity = disabled ? '0.75' : '1';
      cancelBtn.style.cursor = disabled ? 'default' : 'pointer';
      saveBtn.style.cursor = disabled ? 'default' : 'pointer';
      if (saveBtn.lastChild) saveBtn.lastChild.textContent = disabled ? 'Salvando...' : 'Salvar par\u00e2metros';
    }

    function getLatestMeta(rows) {
      const latestRow = rows.reduce((best, current) => {
        const bestTime = best?.atualizado_em ? Date.parse(best.atualizado_em) : 0;
        const currentTime = current?.atualizado_em ? Date.parse(current.atualizado_em) : 0;
        return currentTime > bestTime ? current : best;
      }, null);
      const updatedByLabel = latestRow?.atualizado_por_nome
        || latestRow?.atualizado_por
        || latestRow?.atualizado_por_email
        || '\u2014';
      return {
        updatedAtLabel: formatUpdatedAt(latestRow?.atualizado_em),
        updatedByLabel
      };
    }

    function formatUpdatedAt(value) {
      if (!value) return '\u2014';
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return '\u2014';
      const datePart = date.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
      const timePart = date.toLocaleTimeString('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        hour: '2-digit',
        minute: '2-digit'
      });
      return `${datePart} \u00e0s ${timePart}`;
    }

    function formatWidth(value) {
      return Number(value || 0).toFixed(2).replace('.', ',');
    }

    function formatInputValue(value) {
      if (value == null || value === '') return '';
      return String(value).replace('.', ',');
    }

    function normalizeInputValue(value) {
      return value == null ? value : String(value).replace(',', '.');
    }

    await reload();
    return window.shellLayout(window.ADMIN_MENU, container);
  }
  async function screenCadastrosFornecedores() {
    const container = window.el('div', {});
    let allRows = [];
    let busca = '';
    let columnSupport = { email: false, telefone: false, observacoes: false };

    async function reload() {
      const [support, result] = await Promise.all([
        detectOptionalColumns('fornecedores', ['email', 'telefone', 'observacoes']),
        window.supa.from('fornecedores').select('*').order('tipo').order('nome')
      ]);
      columnSupport = support;
      const { data, error } = result;
      if (error) { window.toast('Erro ao carregar fornecedores', 'error'); console.error(error); return; }
      allRows = data || [];
      render();
    }

    function svgIcon(markup) {
      var tmp = document.createElement('div');
      tmp.innerHTML = markup.trim();
      return tmp.firstChild;
    }

    var ICON_PLUS = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>';
    var ICON_SEARCH = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9aa2af" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>';
    var ICON_SQUARE_PEN = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4z"></path></svg>';
    var ICON_TRASH = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path><path d="M10 11v6M14 11v6"></path><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path></svg>';

    function makePrimaryButton(label, onClick) {
      const button = window.el('button', {
        type: 'button',
        onclick: onClick,
        style: 'display:inline-flex; align-items:center; gap:7px; background:#2563eb; color:#fff; border:none; border-radius:4px; padding:9px 16px; font-weight:600; font-size:14px; font-family:inherit; cursor:pointer;'
      });
      button.appendChild(svgIcon(ICON_PLUS));
      button.appendChild(window.el('span', {}, label));
      return button;
    }

    function makeIconButton(title, icon, onClick, danger) {
      const button = window.el('button', {
        type: 'button',
        title,
        'aria-label': title,
        onclick: onClick,
        style: [
          'width:30px',
          'height:30px',
          'display:inline-flex',
          'align-items:center',
          'justify-content:center',
          'border:1px solid #eceef1',
          'border-radius:4px',
          'background:#fff',
          `color:${danger ? '#d6403a' : '#8a93a3'}`,
          'cursor:pointer',
          'transition:border-color .18s ease, color .18s ease, background .18s ease'
        ].join(';'),
        onmouseenter: () => {
          if (danger) {
            button.style.borderColor = '#fca5a5';
            button.style.background = '#fff5f5';
            button.style.color = '#d6403a';
          } else {
            button.style.borderColor = '#d0d5de';
            button.style.color = '#3f4757';
          }
        },
        onmouseleave: () => {
          button.style.borderColor = '#eceef1';
          button.style.background = '#fff';
          button.style.color = danger ? '#d6403a' : '#8a93a3';
        }
      });
      button.appendChild(icon);
      return button;
    }

    function formatEmail(value) {
      const email = String(value || '').trim();
      return email || '—';
    }

    function pillTheme(tipo) {
      switch (tipo) {
        case 'fio_algodao':
          return { bg: '#e6f4ec', color: '#18794a' };
        case 'fio_poliester':
          return { bg: '#eaf1fd', color: '#2563eb' };
        case 'tecelagem':
          return { bg: '#f3effe', color: '#7c3aed' };
        case 'latex':
          return { bg: '#fef9ec', color: '#b45309' };
        default:
          return { bg: '#f3f4f6', color: '#5b6472' };
      }
    }

    function filteredRows() {
      const term = busca.trim().toUpperCase();
      if (!term) return allRows;
      return allRows.filter((row) => String(row.nome || '').toUpperCase().includes(term));
    }

    function render() {
      const rows = filteredRows();
      const page = window.el('div', { style: 'display:flex; flex-direction:column;' });

      const header = window.el('div', {
        style: 'display:flex; align-items:center; justify-content:space-between; gap:16px; flex-wrap:wrap; margin-bottom:20px;'
      });
      const headerText = window.el('div', {},
        window.el('div', {
          style: 'font-size:22px; font-weight:800; color:#16203a; letter-spacing:-.01em;'
        }, 'Fornecedores'),
        window.el('div', {
          style: 'font-size:13px; color:#8a93a3; margin-top:3px;'
        }, 'Gerencie os fornecedores da operação.')
      );
      header.appendChild(headerText);
      header.appendChild(makePrimaryButton('Novo fornecedor', () => openModal(null)));

      const searchWrap = window.el('div', {
        style: 'display:flex; align-items:center; gap:8px; width:100%; background:#fff; border:1px solid #d8dce2; border-radius:4px; padding:8px 13px; margin-bottom:14px;'
      });
      const searchInput = window.el('input', {
        type: 'search',
        value: busca,
        placeholder: 'Buscar por nome...',
        oninput: (e) => {
          busca = e.target.value || '';
          render();
        },
        style: 'width:100%; border:0; outline:none; background:transparent; font-size:13px; color:#16203a; padding:0; font-family:inherit;'
      });
      searchInput.setAttribute('aria-label', 'Buscar por nome');
      searchWrap.appendChild(svgIcon(ICON_SEARCH));
      searchWrap.appendChild(searchInput);

      const tableWrap = window.el('div', { style: 'display:flex; flex-direction:column;' });
      const card = window.el('div', {
        style: 'background:#fff; border:1px solid #eceef1; border-radius:6px 6px 0 0; overflow:hidden;'
      });
      const headRow = window.el('div', {
        style: 'display:grid; grid-template-columns:1fr 1.6fr 110px 1fr 70px 100px; align-items:center; gap:16px; padding:10px 18px; background:#f8f9fb; border-bottom:1px solid #eceef1;'
      });
      headRow.appendChild(window.el('div', { style: `font-size:11px; font-weight:700; color:#8a93a3; letter-spacing:.04em; ${window.TRUNCATE_CELL_STYLE}` }, 'NOME'));
      const emailHead = window.el('div', { style: `font-size:11px; font-weight:700; color:#8a93a3; letter-spacing:.04em; ${window.TRUNCATE_CELL_STYLE}` }, 'EMAIL ');
      emailHead.appendChild(window.el('span', {
        style: 'font-size:10px; font-weight:500; color:#b6bdc8; letter-spacing:0;'
      }, '(opcional)'));
      headRow.appendChild(emailHead);
      headRow.appendChild(window.el('div', { style: 'font-size:11px; font-weight:700; color:#8a93a3; letter-spacing:.04em; white-space:nowrap;' }, 'CNPJ'));
      headRow.appendChild(window.el('div', { style: 'font-size:11px; font-weight:700; color:#8a93a3; letter-spacing:.04em; white-space:nowrap;' }, 'TIPO'));
      headRow.appendChild(window.el('div', { style: 'font-size:11px; font-weight:700; color:#8a93a3; letter-spacing:.04em; white-space:nowrap;' }, 'ID'));
      headRow.appendChild(window.el('div', { style: 'font-size:11px; font-weight:700; color:#8a93a3; letter-spacing:.04em; text-align:center; white-space:nowrap;' }, 'AÇÕES'));
      card.appendChild(headRow);

      rows.forEach((row, index) => {
        const line = window.el('div', {
          style: `display:grid; grid-template-columns:1fr 1.6fr 110px 1fr 70px 100px; align-items:center; gap:16px; padding:13px 18px; border-bottom:${index === rows.length - 1 ? '0' : '1px solid #f1f3f6'};`
        });
        line.appendChild(window.truncatedCell(row.nome || '', row.nome, 'font-size:14px; font-weight:500; color:#16203a;'));
        const emailText = formatEmail(row.email);
        line.appendChild(window.truncatedCell(emailText, row.email, `font-size:13.5px; color:${emailText === '—' ? '#aab2bf' : '#3f4757'};`));
        line.appendChild(window.el('div', {
          style: 'font-size:13.5px; color:' + (row.cnpj ? '#3f4757' : '#aab2bf') + '; font-variant-numeric:tabular-nums;'
        }, row.cnpj ? formatarCnpj(row.cnpj) : '—'));
        const theme = pillTheme(row.tipo);
        line.appendChild(window.el('div', {},
          window.el('span', {
            style: `display:inline-flex; align-items:center; border-radius:4px; padding:3px 9px; font-size:12px; font-weight:600; white-space:nowrap; background:${theme.bg}; color:${theme.color};`
          }, labelFornecedorTipo(row.tipo))
        ));
        line.appendChild(window.el('div', {
          style: 'font-size:13px; color:#9aa2af; font-weight:500;'
        }, String(row.id ?? '')));
        const actions = window.el('div', {
          style: 'display:flex; align-items:center; justify-content:center; gap:6px;'
        });
        actions.appendChild(makeIconButton('Editar fornecedor', svgIcon(ICON_SQUARE_PEN), () => openModal(row), false));
        actions.appendChild(makeIconButton('Excluir fornecedor', svgIcon(ICON_TRASH), () => confirmExcluir(row), true));
        line.appendChild(actions);
        card.appendChild(line);
      });

      if (!rows.length) {
        card.appendChild(window.el('div', {
          style: 'padding:20px 18px; font-size:14px; color:#6b7280; text-align:center;'
        }, busca ? 'Nenhum fornecedor encontrado.' : 'Nenhum fornecedor cadastrado.'));
      }

      const footer = window.el('div', {
        style: 'padding:11px 18px; background:#fff; border:1px solid #eceef1; border-top:none; border-radius:0 0 6px 6px;'
      });
      footer.appendChild(window.el('span', {
        style: 'font-size:13px; color:#9aa2af;'
      }, `${rows.length} ${rows.length === 1 ? 'fornecedor cadastrado' : 'fornecedores cadastrados'}`));

      tableWrap.appendChild(card);
      tableWrap.appendChild(footer);
      page.appendChild(header);
      page.appendChild(searchWrap);
      page.appendChild(tableWrap);
      container.replaceChildren(page);
    }

    function openModal(forn) {
      const isEdit = !!forn;
      const nomeInput = window.textInput({ value: forn?.nome || '', placeholder: 'Ex: Tecelagem Fulano', required: true });
      const tipoSel = window.selectInput({ options: FORNECEDOR_TIPOS, value: forn?.tipo });
      const cnpjInput = window.textInput({ value: formatarCnpj(forn?.cnpj || ''), placeholder: '00.000.000/0000-00' });
      cnpjInput.addEventListener('input', function () {
        const start = cnpjInput.selectionStart;
        const before = cnpjInput.value;
        const normalizado = normalizarCnpj(cnpjInput.value);
        cnpjInput.value = normalizado.length > 1 ? formatarCnpj(normalizado) : normalizado;
        const delta = cnpjInput.value.length - before.length;
        const pos = Math.max(0, (start || 0) + (delta > 0 ? 1 : 0));
        try { cnpjInput.setSelectionRange(pos, pos); } catch (_) {}
      });
      let emailInput = null;
      let telefoneInput = null;
      const nomeField = cadastrosModalField({ label: 'Nome', input: nomeInput, fullWidth: true });
      const tipoField = cadastrosModalField({ label: 'Tipo', input: tipoSel, fullWidth: true });
      let emailField = null;
      let telefoneField = null;
      if (columnSupport.email) {
        emailInput = window.textInput({ type: 'email', value: forn?.email || '', placeholder: 'contato@fornecedor.com' });
        emailField = cadastrosModalField({ label: 'E-mail', input: emailInput, hint: 'Opcional' });
      }
      if (columnSupport.telefone) {
        telefoneInput = window.textInput({ value: forn?.telefone || '', placeholder: 'Ex: (11) 99999-9999' });
        telefoneField = cadastrosModalField({ label: 'Telefone', input: telefoneInput, hint: 'Opcional' });
      }
      const bodyRows = [
        nomeField,
        tipoField,
        cadastrosModalField({ label: 'CNPJ', input: cnpjInput, hint: 'Opcional. Armazenado sem pontuação.' })
      ];
      if (emailField || telefoneField) {
        bodyRows.push(cadastrosModalRow([emailField, telefoneField].filter(Boolean), 2, 720));
      }
      let observacoesField = null;
      if (columnSupport.observacoes) {
        observacoesField = cadastrosObservacoesField(forn?.observacoes);
        bodyRows.push(observacoesField.field);
      }
      const body = cadastrosModalStack(bodyRows);
      openCadastrosFormModal({
        title: isEdit ? 'Editar fornecedor' : 'Novo fornecedor',
        maxWidth: 680,
        body,
        onSave: async () => {
          const nome = nomeInput.value.trim();
          const tipo = tipoSel.value;
          if (!nome || !tipo) { window.toast('Preencha nome e tipo', 'error'); return false; }
          const cnpj = normalizarCnpj(cnpjInput.value);
          if (cnpj) {
            const validacao = validarCnpjDv(cnpj);
            if (!validacao.ok) { window.toast(validacao.motivo, 'error'); return false; }
          }
          const payload = { nome, tipo, cnpj: cnpj || null };
          if (columnSupport.email) payload.email = emailInput.value.trim() || null;
          if (columnSupport.telefone) payload.telefone = telefoneInput.value.trim() || null;
          if (columnSupport.observacoes) payload.observacoes = observacoesField.input.value.trim() || null;
          const { error } = isEdit
            ? await window.supa.from('fornecedores').update(payload).eq('id', forn.id)
            : await window.supa.from('fornecedores').insert(payload);
          if (error) { window.toast(mapearErroCnpjEntidade(error, 'Fornecedor', error.message.includes('duplicate') ? 'Fornecedor com esse nome e tipo já existe' : 'Erro ao salvar'), 'error'); console.error(error); return false; }
          window.toast(isEdit ? 'Fornecedor atualizado' : 'Fornecedor criado', 'success');
          reload();
        }
      });
    }

    function confirmExcluir(forn) {
      window.confirmDialog({
        title: 'Excluir fornecedor',
        message: `Excluir "${forn.nome}"? Se ele estiver vinculado a alguma OP, a exclusão vai falhar.`,
        confirmLabel: 'Excluir',
        onConfirm: async () => {
          const { error } = await window.supa.from('fornecedores').delete().eq('id', forn.id);
          if (error) { window.toast('Fornecedor em uso (não dá pra excluir)', 'error'); console.error(error); return; }
          window.toast('Fornecedor excluído', 'success');
          reload();
        }
      });
    }

    await reload();
    return window.shellLayout(window.ADMIN_MENU, container);
  }

  async function screenCadastrosPrecos() {
    const container = window.el('div', {});
    let allRows = [];
    let allForns = [];
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
    var ICON_TRASH = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path><path d="M10 11v6M14 11v6"></path><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path></svg>';

    async function reload() {
      columnSupport = await detectOptionalColumns('precos_terceirizada', ['observacoes']);
      const precosSelect = 'id, etapa, largura, preco_por_metro, fornecedor:fornecedor_id(id, nome, tipo)'
        + (columnSupport.observacoes ? ', observacoes' : '');
      const [precosRes, fornsRes] = await Promise.all([
        window.supa.from('precos_terceirizada').select(precosSelect).order('etapa').order('largura'),
        window.supa.from('fornecedores').select('id, nome, tipo').in('tipo', ['tecelagem', 'latex']).order('nome')
      ]);
      if (precosRes.error || fornsRes.error) { window.toast('Erro ao carregar', 'error'); console.error(precosRes.error || fornsRes.error); return; }
      allRows = precosRes.data || [];
      allForns = fornsRes.data || [];
      renderStandalone();
    }

    function render(precos, forns) {
      container.replaceChildren(
        window.pageHeader('Preços de terceirizadas', [{ label: '+ Novo preço', onclick: () => openModal(null, forns) }]),
        window.el('p', { class: 'text-gray-600 mb-4 text-sm' }, 'Preço cobrado por metro produzido, por etapa (parte de cima ou látex) e largura.'),
        window.dataTable({
          columns: [
            { key: 'fornecedor', label: 'Fornecedor', render: (r) => r.fornecedor?.nome || '' },
            { key: 'etapa', label: 'Etapa', render: (r) => r.etapa === 'cima' ? 'Parte de cima' : 'Látex' },
            { key: 'largura', label: 'Largura', render: (r) => Number(r.largura).toFixed(2).replace('.', ',') + ' m' },
            { key: 'preco_por_metro', label: 'R$ / metro', render: (r) => 'R$ ' + Number(r.preco_por_metro).toFixed(2).replace('.', ',') },
          ],
          rows: precos,
          actions: [
            { label: 'Editar', onclick: (r) => openModal(r, forns) },
            { label: 'Excluir', class: 'text-red-600 hover:underline', onclick: (r) => confirmExcluir(r) },
          ]
        })
      );
    }

    function renderStandalone() {
      const rows = busca
        ? allRows.filter((r) => {
            const q = busca.trim().toLowerCase();
            return String(r.fornecedor?.nome || '').toLowerCase().includes(q)
              || String(r.etapa || '').toLowerCase().includes(q);
          })
        : allRows.slice();

      const page = window.el('div', { style: 'display:flex; flex-direction:column;' });
      const header = window.el('div', {
        style: 'display:flex; align-items:center; justify-content:space-between; gap:16px; flex-wrap:wrap; margin-bottom:20px;'
      });
      header.appendChild(window.el('div', {},
        window.el('div', { style: 'font-size:22px; font-weight:800; color:#16203a; letter-spacing:-.01em;' }, 'Precos de terceirizadas'),
        window.el('div', { style: 'font-size:13px; color:#8a93a3; margin-top:3px;' }, 'Preco cobrado por metro produzido, por etapa e largura.')
      ));
      header.appendChild(window.el('button', {
        type: 'button',
        onclick: () => openModal(null, allForns),
        style: 'display:inline-flex; align-items:center; gap:7px; background:#2563eb; color:#fff; border:none; border-radius:4px; padding:9px 16px; font-weight:600; font-size:14px; font-family:inherit; cursor:pointer;'
      }, svgIcon(ICON_PLUS), window.el('span', {}, 'Novo preco')));

      const searchWrap = window.el('div', {
        style: 'display:flex; align-items:center; gap:8px; width:100%; background:#fff; border:1px solid #d8dce2; border-radius:4px; padding:8px 13px; margin-bottom:14px;'
      });
      searchWrap.appendChild(svgIcon(ICON_SEARCH));
      searchWrap.appendChild(window.el('input', {
        type: 'search',
        value: busca,
        placeholder: 'Buscar por fornecedor ou etapa...',
        oninput: (e) => { busca = e.target.value || ''; renderStandalone(); },
        style: 'width:100%; border:0; outline:none; background:transparent; font-size:13px; color:#16203a; padding:0; font-family:inherit;'
      }));

      const tableWrap = window.el('div', { style: 'display:flex; flex-direction:column;' });
      const card = window.el('div', {
        style: 'background:#fff; border:1px solid #eceef1; border-radius:6px 6px 0 0; overflow:hidden;'
      });
      const gridTemplate = '1.2fr 1fr 100px 120px 66px';
      const headRow = window.el('div', {
        style: `display:grid; grid-template-columns:${gridTemplate}; align-items:center; gap:16px; padding:10px 18px; background:#f8f9fb; border-bottom:1px solid #eceef1;`
      });
      ['FORNECEDOR', 'ETAPA', 'LARGURA', 'R$ / METRO'].forEach((label) => {
        headRow.appendChild(window.el('div', { style: 'font-size:11px; font-weight:700; color:#8a93a3; letter-spacing:.04em; white-space:nowrap;' }, label));
      });
      headRow.appendChild(window.el('div', { style: 'font-size:11px; font-weight:700; color:#8a93a3; letter-spacing:.04em; text-align:center; white-space:nowrap;' }, 'ACOES'));
      card.appendChild(headRow);

      rows.forEach((row, index) => {
        const line = window.el('div', {
          style: `display:grid; grid-template-columns:${gridTemplate}; align-items:center; gap:16px; padding:13px 18px; border-bottom:${index === rows.length - 1 ? '0' : '1px solid #f1f3f6'};`
        });
        line.appendChild(window.el('div', { style: 'font-size:14px; font-weight:500; color:#16203a;' }, row.fornecedor?.nome || ''));
        line.appendChild(window.el('div', { style: 'font-size:13.5px; color:#3f4757;' }, row.etapa === 'cima' ? 'Parte de cima' : 'Latex'));
        line.appendChild(window.el('div', { style: 'font-size:13.5px; color:#3f4757;' }, Number(row.largura).toFixed(2).replace('.', ',') + ' m'));
        line.appendChild(window.el('div', { style: 'font-size:13.5px; color:#3f4757;' }, 'R$ ' + Number(row.preco_por_metro).toFixed(2).replace('.', ',')));
        const actions = window.el('div', { style: 'display:flex; align-items:center; justify-content:center; gap:6px;' });
        actions.appendChild(window.el('button', {
          type: 'button',
          onclick: () => openModal(row, allForns),
          title: 'Editar preco',
          'aria-label': 'Editar preco',
          style: 'width:30px; height:30px; display:inline-flex; align-items:center; justify-content:center; border:1px solid #eceef1; border-radius:4px; background:#fff; color:#8a93a3; cursor:pointer;'
        }, svgIcon(ICON_SQUARE_PEN)));
        actions.appendChild(window.el('button', {
          type: 'button',
          onclick: () => confirmExcluir(row),
          title: 'Excluir preco',
          'aria-label': 'Excluir preco',
          style: 'width:30px; height:30px; display:inline-flex; align-items:center; justify-content:center; border:1px solid #f3d1d0; border-radius:4px; background:#fff5f5; color:#d6403a; cursor:pointer;'
        }, svgIcon(ICON_TRASH)));
        line.appendChild(actions);
        card.appendChild(line);
      });

      if (!rows.length) {
        card.appendChild(window.el('div', { style: 'padding:20px 18px; font-size:14px; color:#6b7280; text-align:center;' }, busca ? 'Nenhum preco encontrado.' : 'Nenhum preco cadastrado.'));
      }

      const footer = window.el('div', {
        style: 'padding:11px 18px; background:#fff; border:1px solid #eceef1; border-top:none; border-radius:0 0 6px 6px;'
      });
      footer.appendChild(window.el('span', { style: 'font-size:13px; color:#9aa2af;' }, `${rows.length} ${rows.length === 1 ? 'preco cadastrado' : 'precos cadastrados'}`));
      tableWrap.appendChild(card);
      tableWrap.appendChild(footer);
      page.appendChild(header);
      page.appendChild(searchWrap);
      page.appendChild(tableWrap);
      container.replaceChildren(page);
    }

    function openModal(preco, forns) {
      const isEdit = !!preco;
      const fornOptions = forns.map(function (f) { return { value: f.id, label: `${f.nome} (${f.tipo === 'tecelagem' ? 'tecelagem' : 'latex'})` }; });
      const etapaOptions = [{ value: 'cima', label: 'Parte de cima' }, { value: 'latex', label: 'Latex' }];
      const largOptions = [{ value: '1.40', label: '1,40 m' }, { value: '2.10', label: '2,10 m' }];
      const fornSel = window.selectInput({ options: fornOptions, value: preco?.fornecedor?.id });
      const etapaSel = window.selectInput({ options: etapaOptions, value: preco?.etapa });
      const largSel = window.selectInput({ options: largOptions, value: preco?.largura });
      const precoInput = window.textInput({ type: 'number', step: '0.01', value: preco?.preco_por_metro || '', placeholder: '0,00' });
      const bodyFields = [
        cadastrosModalRow([
          cadastrosModalField({ label: 'Fornecedor', input: fornSel }),
          cadastrosModalField({ label: 'Etapa', input: etapaSel })
        ], 2, 720),
        cadastrosModalRow([
          cadastrosModalField({ label: 'Largura', input: largSel }),
          cadastrosModalField({ label: 'Preço por metro (R$)', input: precoInput })
        ], 2, 720)
      ];
      let observacoesField = null;
      if (columnSupport.observacoes) {
        observacoesField = cadastrosObservacoesField(preco?.observacoes);
        bodyFields.push(observacoesField.field);
      }
      const body = cadastrosModalStack(bodyFields);
      openCadastrosFormModal({
        title: isEdit ? 'Editar preço' : 'Novo preço',
        maxWidth: 660,
        body,
        onSave: async () => {
          const fornecedor_id = fornSel.value;
          const etapa = etapaSel.value;
          const largura = largSel.value;
          const preco_por_metro = parseFloat(precoInput.value);
          if (!fornecedor_id || !etapa || !largura || isNaN(preco_por_metro) || preco_por_metro < 0) {
            window.toast('Preencha todos os campos com valores válidos', 'error'); return false;
          }
          const payload = { fornecedor_id, etapa, largura, preco_por_metro, atualizado_em: new Date().toISOString() };
          if (columnSupport.observacoes) payload.observacoes = observacoesField.input.value.trim() || null;
          const { error } = isEdit
            ? await window.supa.from('precos_terceirizada').update(payload).eq('id', preco.id)
            : await window.supa.from('precos_terceirizada').insert(payload);
          if (error) { window.toast(error.message.includes('duplicate') ? 'Já existe preço pra esse fornecedor + etapa + largura' : 'Erro ao salvar', 'error'); console.error(error); return false; }
          window.toast(isEdit ? 'Preço atualizado' : 'Preço criado', 'success');
          reload();
        }
      });
    }

    function confirmExcluir(preco) {
      window.confirmDialog({
        title: 'Excluir preço',
        message: `Excluir esse preço (${preco.fornecedor?.nome}, ${preco.etapa}, ${preco.largura}m)?`,
        confirmLabel: 'Excluir',
        onConfirm: async () => {
          const { error } = await window.supa.from('precos_terceirizada').delete().eq('id', preco.id);
          if (error) { window.toast('Erro ao excluir', 'error'); console.error(error); return; }
          window.toast('Preço excluído', 'success');
          reload();
        }
      });
    }

    await reload();
    return window.shellLayout(window.ADMIN_MENU, container);
  }

  // -------------------------------------------------------------------
  // Namespace principal
  // -------------------------------------------------------------------

  window.RAVATEX_SCREENS = window.RAVATEX_SCREENS || {};

  window.RAVATEX_SCREENS.cadastros = {
    FORNECEDOR_TIPOS,
    labelFornecedorTipo,
    normalizarCnpj,
    formatarCnpj,
    validarCnpjDv,
    mapearErroCnpjEntidade,
    screenCadastrosCores,
    screenCadastrosClientes,
    screenCadastrosModelos,
    screenCadastrosParametros,
    screenCadastrosFornecedores,
    screenCadastrosPrecos,
  };

  // Compatibilidade com o setRoutes do inline e com call-sites bare
  // (e.g. selectInput({ options: FORNECEDOR_TIPOS, ... }) em
  // screenCadastrosFornecedores).
  window.FORNECEDOR_TIPOS = FORNECEDOR_TIPOS;
  window.labelFornecedorTipo = labelFornecedorTipo;

  window.screenCadastrosCores = screenCadastrosCores;
  window.screenCadastrosClientes = screenCadastrosClientes;
  window.screenCadastrosModelos = screenCadastrosModelos;
  window.screenCadastrosParametros = screenCadastrosParametros;
  window.screenCadastrosFornecedores = screenCadastrosFornecedores;
  window.screenCadastrosPrecos = screenCadastrosPrecos;
})(window);
