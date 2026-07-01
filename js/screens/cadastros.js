// =====================================================================
// === SCREENS: CADASTROS (Seam A) ======================================
// Telas de cadastros administrativos (cores, clientes, modelos,
// parametros, fornecedores, precos, usuarios) + constantes diretamente
// relacionadas (FORNECEDOR_TIPOS, labelFornecedorTipo). Extraidas do
// <script> inline de index.html sem alterar comportamento, tabelas
// Supabase, CRUD ou regras de negocio.
//
// A tela #/cadastros/usuarios integra a Edge Function
// `admin-disable-user` (fase RAVATEX-TAPETES-AUTH-DISABLE-USER-UI-A):
//   - botão "Desativar" substitui o placeholder "Em breve";
//   - chama a Edge Function de desativação via functions.invoke,
//     enviando user_id e reason no body;
//   - mapeia códigos de erro (FORBIDDEN, SELF_DISABLE_FORBIDDEN,
//     LAST_ADMIN_FORBIDDEN, NOT_FOUND, AUTH_BAN_FAILED,
//     COMPENSATION_FAILED, etc.) para mensagens PT-BR;
//   - guarda de UX para o próprio usuário logado e usuários já
//     inativos (proteção visual, não substitui a checagem
//     server-side);
//   - nunca usa .delete() em public.usuarios, nunca expõe a chave
//     de privilégio admin nem usa APIs de admin no front.
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
// Parametros,Fornecedores,Precos,Usuarios}, window.FORNECEDOR_TIPOS
// e window.labelFornecedorTipo continuam disponiveis exatamente como
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

  // Mapeia códigos de erro da Edge Function `admin-disable-user` para
  // mensagens amigáveis em PT-BR usadas pelo toast da UI. Mantém
  // fallback para a mensagem original ou um genérico.
  function friendlyDisableMessage(code, fallback) {
    switch (code) {
      case 'FORBIDDEN':
        return 'Usuário atual não tem permissão para desativar usuários.';
      case 'SELF_DISABLE_FORBIDDEN':
        return 'Você não pode desativar seu próprio usuário.';
      case 'LAST_ADMIN_FORBIDDEN':
        return 'Não é possível desativar o último admin ativo.';
      case 'NOT_FOUND':
        return 'Usuário não encontrado.';
      case 'AUTH_BAN_FAILED':
        return 'Falha operacional ao banir o usuário. O perfil foi revertido.';
      case 'COMPENSATION_FAILED':
        return 'Falha operacional grave. A reversão do perfil também falhou — reporte ao suporte.';
      case 'VALIDATION_ERROR':
        return 'Dados inválidos para desativação.';
      case 'UNAUTHORIZED':
        return 'Sessão expirada. Faça login novamente.';
      default:
        return fallback || 'Erro ao desativar usuário';
    }
  }

  // Mapeia códigos de erro da Edge Function `admin-delete-user`
  // (hard delete) para mensagens amigáveis em PT-BR. Mantém fallback
  // para a mensagem original ou um genérico.
  function friendlyDeleteMessage(code, fallback) {
    switch (code) {
      case 'FORBIDDEN':
        return 'Usuário atual não tem permissão para excluir usuários.';
      case 'SELF_DELETE_FORBIDDEN':
        return 'Você não pode excluir seu próprio usuário.';
      case 'LAST_ADMIN_FORBIDDEN':
        return 'Não é possível excluir o último admin ativo.';
      case 'NOT_FOUND':
        return 'Usuário não encontrado.';
      case 'CONFIRM_EMAIL_MISMATCH':
        return 'O e-mail digitado não confere com o e-mail do usuário.';
      case 'USER_HAS_REFERENCES':
        return 'Não foi possível remover o perfil: existem registros vinculados no banco. Remova os vínculos antes de excluir.';
      case 'AUTH_DELETE_FAILED':
        return 'Falha operacional ao remover do Auth. O perfil foi restaurado.';
      case 'COMPENSATION_FAILED':
        return 'Falha operacional grave. O perfil e o Auth estão inconsistentes — reporte ao suporte.';
      case 'VALIDATION_ERROR':
        return 'Dados inválidos para exclusão.';
      case 'UNAUTHORIZED':
        return 'Sessão expirada. Faça login novamente.';
      default:
        return fallback || 'Erro ao excluir usuário';
    }
  }

  // -------------------------------------------------------------------
  // Telas
  // -------------------------------------------------------------------

  async function screenCadastrosCores() {
    const container = window.el('div', {});
    let allRows = [];
    let busca = '';

    async function reload() {
      const { data, error } = await window.supa.from('cores').select('*').order('nome');
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
      const body = window.el('div', {}, window.formField({ label: 'Nome', input: nomeInput, hint: 'Use letras maiúsculas pra padronizar' }));
      window.modal({
        title: isEdit ? 'Editar cor' : 'Nova cor',
        body,
        onSave: async () => {
          const nome = nomeInput.value.trim().toUpperCase();
          if (!nome) { window.toast('Nome é obrigatório', 'error'); return false; }
          const payload = { nome };
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
    let columnSupport = { contato: false, telefone: false };
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
        detectOptionalColumns('clientes', ['contato', 'telefone']),
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
        { key: 'nome', label: 'NOME', width: '1.2fr' },
      ];
      if (columnSupport.contato) columns.push({ key: 'contato', label: 'CONTATO', width: '1fr', optional: true });
      if (columnSupport.telefone) columns.push({ key: 'telefone', label: 'TELEFONE', width: '1fr', optional: true });
      columns.push({ key: 'id', label: 'ID', width: '80px' });
      columns.push({ key: 'acoes', label: 'ACOES', width: '66px', align: 'center' });
      const gridTemplate = columns.map((column) => column.width).join(' ');

      const headRow = window.el('div', {
        style: `display:grid; grid-template-columns:${gridTemplate}; align-items:center; gap:16px; padding:10px 18px; background:#f8f9fb; border-bottom:1px solid #eceef1;`
      });
      columns.forEach((column) => {
        const head = window.el('div', {
          style: `font-size:11px; font-weight:700; color:#8a93a3; letter-spacing:.04em; white-space:nowrap;${column.align === 'center' ? ' text-align:center;' : ''}`
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
        line.appendChild(window.el('div', {
          style: 'font-size:14px; font-weight:500; color:#16203a;'
        }, row.nome || ''));
        if (columnSupport.contato) {
          const contatoText = row.contato || '—';
          line.appendChild(window.el('div', {
            style: `font-size:13.5px; color:${contatoText === '—' ? '#aab2bf' : '#3f4757'};`
          }, contatoText));
        }
        if (columnSupport.telefone) {
          const telefoneText = row.telefone || '—';
          line.appendChild(window.el('div', {
            style: `font-size:13.5px; color:${telefoneText === '—' ? '#aab2bf' : '#3f4757'};`
          }, telefoneText));
        }
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
      const body = window.el('div', {}, window.formField({ label: 'Nome', input: nomeInput }));
      let contatoInput = null;
      let telefoneInput = null;
      if (columnSupport.contato) {
        contatoInput = window.textInput({ value: cli?.contato || '', placeholder: 'Ex: Maria Silva' });
        body.appendChild(window.formField({ label: 'Contato', input: contatoInput, hint: 'Opcional' }));
      }
      if (columnSupport.telefone) {
        telefoneInput = window.textInput({ value: cli?.telefone || '', placeholder: 'Ex: (11) 99999-9999' });
        body.appendChild(window.formField({ label: 'Telefone', input: telefoneInput, hint: 'Opcional' }));
      }
      window.modal({
        title: isEdit ? 'Editar cliente' : 'Novo cliente',
        body,
        onSave: async () => {
          const nome = nomeInput.value.trim();
          if (!nome) { window.toast('Nome é obrigatório', 'error'); return false; }
          const payload = { nome };
          if (columnSupport.contato) payload.contato = contatoInput.value.trim() || null;
          if (columnSupport.telefone) payload.telefone = telefoneInput.value.trim() || null;
          const { error } = isEdit
            ? await window.supa.from('clientes').update(payload).eq('id', cli.id)
            : await window.supa.from('clientes').insert(payload);
          if (error) { window.toast(error.message.includes('duplicate') ? 'Cliente já cadastrado' : 'Erro ao salvar', 'error'); console.error(error); return false; }
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
      const [modelosRes, coresRes] = await Promise.all([
        window.supa.from('modelos').select('id, nome, largura, cor_1:cor_1_id(id, nome), cor_2:cor_2_id(id, nome)').order('nome'),
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
      const corOptions = cores.map(c => ({ value: c.id, label: c.nome }));
      const nomeInput = window.textInput({ value: modelo?.nome || '', placeholder: 'Ex: Conforto', required: true });
      const cor1Sel = window.selectInput({ options: corOptions, value: modelo?.cor_1?.id });
      const cor2Sel = window.selectInput({ options: corOptions, value: modelo?.cor_2?.id });
      const largSel = window.selectInput({
        options: [{ value: '1.40', label: '1,40 m' }, { value: '2.10', label: '2,10 m' }],
        value: modelo?.largura
      });
      const body = window.el('div', {},
        window.formField({ label: 'Nome do modelo', input: nomeInput }),
        window.formField({ label: 'Cor 1 (predominante)', input: cor1Sel, hint: 'A ordem importa: "BRANCO/PRETO" é diferente de "PRETO/BRANCO".' }),
        window.formField({ label: 'Cor 2', input: cor2Sel }),
        window.formField({ label: 'Largura', input: largSel })
      );
      window.modal({
        title: isEdit ? 'Editar modelo' : 'Novo modelo',
        body,
        onSave: async () => {
          const nome = nomeInput.value.trim();
          const cor_1_id = cor1Sel.value;
          const cor_2_id = cor2Sel.value;
          const largura = largSel.value;
          if (!nome || !cor_1_id || !cor_2_id || !largura) { window.toast('Preencha todos os campos', 'error'); return false; }
          const payload = { nome, cor_1_id, cor_2_id, largura };
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
    let columnSupport = { email: false, telefone: false };

    async function reload() {
      const [support, result] = await Promise.all([
        detectOptionalColumns('fornecedores', ['email', 'telefone']),
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
        style: 'display:grid; grid-template-columns:1fr 1fr 1fr 80px 66px; align-items:center; gap:16px; padding:10px 18px; background:#f8f9fb; border-bottom:1px solid #eceef1;'
      });
      headRow.appendChild(window.el('div', { style: 'font-size:11px; font-weight:700; color:#8a93a3; letter-spacing:.04em; white-space:nowrap;' }, 'NOME'));
      const emailHead = window.el('div', { style: 'font-size:11px; font-weight:700; color:#8a93a3; letter-spacing:.04em; white-space:nowrap;' }, 'EMAIL ');
      emailHead.appendChild(window.el('span', {
        style: 'font-size:10px; font-weight:500; color:#b6bdc8; letter-spacing:0;'
      }, '(opcional)'));
      headRow.appendChild(emailHead);
      headRow.appendChild(window.el('div', { style: 'font-size:11px; font-weight:700; color:#8a93a3; letter-spacing:.04em; white-space:nowrap;' }, 'TIPO'));
      headRow.appendChild(window.el('div', { style: 'font-size:11px; font-weight:700; color:#8a93a3; letter-spacing:.04em; white-space:nowrap;' }, 'ID'));
      headRow.appendChild(window.el('div', { style: 'font-size:11px; font-weight:700; color:#8a93a3; letter-spacing:.04em; text-align:center; white-space:nowrap;' }, 'AÇÕES'));
      card.appendChild(headRow);

      rows.forEach((row, index) => {
        const line = window.el('div', {
          style: `display:grid; grid-template-columns:1fr 1fr 1fr 80px 66px; align-items:center; gap:16px; padding:13px 18px; border-bottom:${index === rows.length - 1 ? '0' : '1px solid #f1f3f6'};`
        });
        line.appendChild(window.el('div', {
          style: 'font-size:14px; font-weight:500; color:#16203a;'
        }, row.nome || ''));
        const emailText = formatEmail(row.email);
        line.appendChild(window.el('div', {
          style: `font-size:13.5px; color:${emailText === '—' ? '#aab2bf' : '#3f4757'};`
        }, emailText));
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
      let emailInput = null;
      let telefoneInput = null;
      const body = window.el('div', {},
        window.formField({ label: 'Nome', input: nomeInput }),
        window.formField({ label: 'Tipo', input: tipoSel })
      );
      if (columnSupport.email) {
        emailInput = window.textInput({ type: 'email', value: forn?.email || '', placeholder: 'contato@fornecedor.com' });
        body.appendChild(window.formField({ label: 'E-mail', input: emailInput, hint: 'Opcional' }));
      }
      if (columnSupport.telefone) {
        telefoneInput = window.textInput({ value: forn?.telefone || '', placeholder: 'Ex: (11) 99999-9999' });
        body.appendChild(window.formField({ label: 'Telefone', input: telefoneInput, hint: 'Opcional' }));
      }
      window.modal({
        title: isEdit ? 'Editar fornecedor' : 'Novo fornecedor',
        body,
        onSave: async () => {
          const nome = nomeInput.value.trim();
          const tipo = tipoSel.value;
          if (!nome || !tipo) { window.toast('Preencha nome e tipo', 'error'); return false; }
          const payload = { nome, tipo };
          if (columnSupport.email) payload.email = emailInput.value.trim() || null;
          if (columnSupport.telefone) payload.telefone = telefoneInput.value.trim() || null;
          const { error } = isEdit
            ? await window.supa.from('fornecedores').update(payload).eq('id', forn.id)
            : await window.supa.from('fornecedores').insert(payload);
          if (error) { window.toast(error.message.includes('duplicate') ? 'Fornecedor com esse nome e tipo já existe' : 'Erro ao salvar', 'error'); console.error(error); return false; }
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
      const [precosRes, fornsRes] = await Promise.all([
        window.supa.from('precos_terceirizada').select('id, etapa, largura, preco_por_metro, fornecedor:fornecedor_id(id, nome, tipo)').order('etapa').order('largura'),
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
      const fornOptions = forns.map(f => ({ value: f.id, label: `${f.nome} (${f.tipo === 'tecelagem' ? 'tecelagem' : 'látex'})` }));
      const etapaOptions = [{ value: 'cima', label: 'Parte de cima' }, { value: 'latex', label: 'Látex' }];
      const largOptions = [{ value: '1.40', label: '1,40 m' }, { value: '2.10', label: '2,10 m' }];

      const fornSel = window.selectInput({ options: fornOptions, value: preco?.fornecedor?.id });
      const etapaSel = window.selectInput({ options: etapaOptions, value: preco?.etapa });
      const largSel = window.selectInput({ options: largOptions, value: preco?.largura });
      const precoInput = window.textInput({ type: 'number', step: '0.01', value: preco?.preco_por_metro || '', placeholder: '0,00' });

      const body = window.el('div', {},
        window.formField({ label: 'Fornecedor', input: fornSel }),
        window.formField({ label: 'Etapa', input: etapaSel }),
        window.formField({ label: 'Largura', input: largSel }),
        window.formField({ label: 'Preço por metro (R$)', input: precoInput })
      );

      window.modal({
        title: isEdit ? 'Editar preço' : 'Novo preço',
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

  async function screenCadastrosUsuarios() {
    const container = window.el('div', {});
    let mostrarInativos = false;
    let allUsers = [];
    let allForns = [];
    let allClients = [];
    let busca = '';

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
      const [usersRes, fornsRes, clientsRes] = await Promise.all([
        window.supa
          .from('usuarios')
          .select('id, email, nome, tipo, ativo, desativado_em, fornecedor:fornecedor_id(id, nome, tipo), cliente:cliente_id(id, nome)')
          .order('email'),
        window.supa.from('fornecedores').select('id, nome, tipo').order('nome'),
        window.supa.from('clientes').select('id, nome').order('nome')
      ]);
      if (usersRes.error || fornsRes.error || clientsRes.error) { window.toast('Erro ao carregar', 'error'); console.error(usersRes.error || fornsRes.error || clientsRes.error); return; }
      allUsers = usersRes.data || [];
      allForns = fornsRes.data || [];
      allClients = clientsRes.data || [];
      renderStandalone();
    }

    function render() {
      const meId = (window.CURRENT_USER && window.CURRENT_USER.id) || null;
      const visibleUsers = mostrarInativos
        ? allUsers
        : allUsers.filter((u) => u.ativo !== false);

      const toggle = window.el('label', { class: 'inline-flex items-center gap-2 text-sm text-gray-700 select-none cursor-pointer' },
        window.el('input', {
          type: 'checkbox',
          class: 'form-checkbox h-4 w-4 text-blue-600',
          onchange: (ev) => { mostrarInativos = !!ev.target.checked; render(); },
        }),
        'Mostrar inativos'
      );
      if (allUsers.some((u) => u.ativo === false)) toggle.classList.add('font-medium');

      const emptyMsg = window.el('p', { class: 'text-gray-500 italic' },
        mostrarInativos ? 'Nenhum usuário cadastrado.' : 'Nenhum usuário ativo encontrado.');

      const tableNode = visibleUsers.length === 0
        ? emptyMsg
        : window.dataTable({
            columns: [
              { key: 'email', label: 'E-mail' },
              { key: 'nome', label: 'Nome' },
              { key: 'tipo', label: 'Tipo' },
              { key: 'fornecedor', label: 'Fornecedor', render: (r) => r.fornecedor?.nome || '—' },
              { key: 'cliente', label: 'Cliente', render: (r) => r.cliente?.nome || '—' },
              { key: 'status', label: 'Status', render: (r) => r.ativo === false ? 'Inativo' : 'Ativo' },
            ],
            rows: visibleUsers,
            actions: [
              { label: 'Editar', onclick: (r) => openModal(r, allForns, allClients) },
              {
                label: (r) => (r && r.ativo === false) ? 'Inativo' : 'Desativar',
                class: 'text-red-600 hover:underline',
                onclick: (r) => handleDesativarClick(r, meId),
              },
              {
                label: (r) => (r && r.id === meId) ? '—' : 'Excluir',
                class: 'text-red-700 hover:underline font-semibold ml-3',
                onclick: (r) => handleExcluirClick(r, meId),
              },
            ],
          });

      container.replaceChildren(
        window.pageHeader('Usuários', [{ label: '+ Novo usuário', onclick: () => openModal(null, allForns, allClients) }]),
        window.el('div', { class: 'mb-3' }, toggle),
        tableNode
      );
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
        onclick: () => openModal(null, allForns, allClients),
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
        actions.appendChild(window.el('button', { type: 'button', onclick: () => openModal(user, allForns, allClients), title: 'Editar usuario', 'aria-label': 'Editar usuario', style: 'width:30px; height:30px; display:inline-flex; align-items:center; justify-content:center; border:1px solid #eceef1; border-radius:4px; background:#fff; color:#8a93a3; cursor:pointer;' }, svgIcon(ICON_SQUARE_PEN)));
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
      confirmDesativar(r);
    }

    function confirmDesativar(usr) {
      const motivoInput = window.textInput({
        type: 'text',
        value: '',
        placeholder: 'Opcional — ex.: fornecedor descartável de teste',
      });
      const body = window.el('div', {},
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
          const reason = (motivoInput.value || '').trim().slice(0, 500);
          await desativarUsuario(usr, reason || 'Desativação via UI');
        },
      });
    }

    async function desativarUsuario(usr, reason) {
      const { error } = await window.supa.functions.invoke('admin-disable-user', {
        body: { user_id: usr.id, reason },
      });
      if (error) {
        let code = null;
        let msg = (error && error.message) ? error.message : 'Erro ao desativar usuário';
        try {
          if (error && error.context && typeof error.context.json === 'function') {
            const body = await error.context.json();
            if (body && body.error) {
              code = body.error.code || null;
              if (body.error.message) msg = body.error.message;
            }
          }
        } catch (_) { /* ignore body parse errors */ }
        const friendly = friendlyDisableMessage(code, msg);
        window.toast(friendly, 'error');
        console.error('admin-disable-user error', code, error);
        return;
      }
      window.toast('Usuário desativado', 'success');
      reload();
    }

    // -----------------------------------------------------------------
    // Excluir (hard delete) — admin-delete-user
    // -----------------------------------------------------------------

    function handleExcluirClick(r, meId) {
      // Guarda de UX (não substitui a checagem server-side).
      if (meId && r.id === meId) {
        window.toast('Você não pode excluir seu próprio usuário.', 'info');
        return;
      }
      confirmExcluirUsuario(r);
    }

    function confirmExcluirUsuario(usr) {
      const emailInput = window.textInput({
        type: 'email',
        value: '',
        placeholder: usr.email,
      });
      const body = window.el('div', {},
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
          const confirmEmail = (emailInput.value || '').trim();
          if (confirmEmail.toLowerCase() !== String(usr.email || '').toLowerCase()) {
            window.toast('O e-mail digitado não confere com o e-mail do usuário.', 'error');
            return;
          }
          await excluirUsuario(usr, confirmEmail);
        },
      });
    }

    async function excluirUsuario(usr, confirmEmail) {
      const { error } = await window.supa.functions.invoke('admin-delete-user', {
        body: { user_id: usr.id, confirm_email: confirmEmail },
      });
      if (error) {
        let code = null;
        let msg = (error && error.message) ? error.message : 'Erro ao excluir usuário';
        try {
          if (error && error.context && typeof error.context.json === 'function') {
            const body = await error.context.json();
            if (body && body.error) {
              code = body.error.code || null;
              if (body.error.message) msg = body.error.message;
            }
          }
        } catch (_) { /* ignore body parse errors */ }
        const friendly = friendlyDeleteMessage(code, msg);
        window.toast(friendly, 'error');
        console.error('admin-delete-user error', code, error);
        return;
      }
      window.toast('Usuário excluído permanentemente.', 'success');
      reload();
    }

    function openModal(usr, forns, clients) {
      const isEdit = !!usr;
      const fornOptions = forns.map(f => ({ value: f.id, label: `${f.nome} (${labelFornecedorTipo(f.tipo)})` }));
      const tipoOptions = [{ value: 'admin', label: 'Admin' }, { value: 'fornecedor', label: 'Fornecedor' }, { value: 'cliente', label: 'Cliente' }];

      const emailInput = window.textInput({ type: 'email', value: usr?.email || '', placeholder: 'usuario@exemplo.com' });
      const nomeInput = window.textInput({ value: usr?.nome || '', placeholder: 'Ex: Fornecedor X' });
      const tipoSel = window.selectInput({ options: tipoOptions, value: usr?.tipo });
      const clienteOptions = clients.map(function(c) { return { value: c.id, label: c.nome }; });
      const fornSel = window.selectInput({ options: fornOptions, value: usr?.fornecedor?.id, placeholder: '(nenhum)' });
      const clienteSel = window.selectInput({ options: clienteOptions, value: usr?.cliente?.id, placeholder: '(nenhum)' });

      const fields = [];

      if (isEdit) {
        const idInput = window.textInput({ value: usr?.id || '', placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx' });
        idInput.disabled = true;
        idInput.classList.add('bg-gray-100');
        fields.push(window.formField({ label: 'UID do Auth', input: idInput, hint: 'Não pode ser alterado' }));
      }

      fields.push(window.formField({
        label: 'E-mail',
        input: emailInput,
        hint: isEdit ? '' : 'Será usado para login no Supabase Auth',
      }));
      fields.push(window.formField({ label: 'Nome', input: nomeInput }));
      fields.push(window.formField({ label: 'Tipo', input: tipoSel }));

      const wrapperForn = window.el('div', {}, window.formField({
        label: 'Fornecedor vinculado',
        input: fornSel,
        hint: 'Obrigatório se tipo = Fornecedor',
      }));
      const wrapperCli = window.el('div', {}, window.formField({
        label: 'Cliente vinculado',
        input: clienteSel,
        hint: 'Obrigatório se tipo = Cliente',
      }));
      fields.push(wrapperForn, wrapperCli);

      function updateVinculoVisibility() {
        var t = tipoSel.value;
        wrapperForn.style.display = (t === 'fornecedor') ? '' : 'none';
        wrapperCli.style.display = (t === 'cliente') ? '' : 'none';
      }
      tipoSel.addEventListener('change', updateVinculoVisibility);
      updateVinculoVisibility();

      let passwordInput = null;
      if (!isEdit) {
        passwordInput = window.textInput({ type: 'password', value: '', placeholder: 'Mínimo 6 caracteres' });
        fields.push(window.formField({
          label: 'Senha temporária',
          input: passwordInput,
          hint: 'Defina uma senha inicial e oriente a troca depois.',
        }));
      }

      const body = window.el('div', {}, ...fields);

      window.modal({
        title: isEdit ? 'Editar usuário' : 'Novo usuário',
        body,
        onSave: async () => {
          const email = emailInput.value.trim();
          const nome = nomeInput.value.trim();
          const tipo = tipoSel.value;
          const fornecedor_id_raw = fornSel.value || null;
          const cliente_id_raw = clienteSel.value || null;

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
            const { error } = await window.supa
              .from('usuarios')
              .update({ email, nome, tipo, fornecedor_id: fornecedor_id_raw, cliente_id: cliente_id_raw })
              .eq('id', usr.id);
            if (error) {
              let msg = 'Erro ao salvar';
              if (error.message && error.message.includes('duplicate')) msg = 'E-mail já cadastrado';
              window.toast(msg, 'error');
              console.error(error);
              return false;
            }
            window.toast('Usuário atualizado', 'success');
            reload();
            return;
          }

          // Criação via Edge Function admin-create-user
          const password = passwordInput ? passwordInput.value : '';
          if (!password || password.length < 6) {
            window.toast('Senha temporária deve ter no mínimo 6 caracteres', 'error');
            return false;
          }
          const fornecedor_id = fornecedor_id_raw ? Number(fornecedor_id_raw) : null;
          const cliente_id = cliente_id_raw ? Number(cliente_id_raw) : null;

          const { error } = await window.supa.functions.invoke('admin-create-user', {
            body: { email, password, nome, tipo, fornecedor_id, cliente_id },
          });

          if (error) {
            let code = null;
            let msg = (error && error.message) ? error.message : 'Erro ao criar usuário';
            try {
              if (error && error.context && typeof error.context.json === 'function') {
                const body = await error.context.json();
                if (body && body.error) {
                  code = body.error.code || null;
                  if (body.error.message) msg = body.error.message;
                }
              }
            } catch (_) { /* ignore body parse errors */ }
            if (code === 'CONFLICT') msg = 'E-mail já cadastrado.';
            else if (code === 'FORBIDDEN') msg = 'Apenas admins podem criar usuários.';
            else if (code === 'UNAUTHORIZED') msg = 'Sessão expirada. Faça login novamente.';
            window.toast(msg, 'error');
            console.error('admin-create-user error', code, error);
            return false;
          }

          window.toast('Usuário criado', 'success');
          reload();
        },
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
    screenCadastrosCores,
    screenCadastrosClientes,
    screenCadastrosModelos,
    screenCadastrosParametros,
    screenCadastrosFornecedores,
    screenCadastrosPrecos,
    screenCadastrosUsuarios,
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
  window.screenCadastrosUsuarios = screenCadastrosUsuarios;
})(window);
