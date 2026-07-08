// =====================================================================
// === SCREENS: DOCUMENTOS RECEBIDOS ==================================
// Tela admin `#/documentos/recebidos` — read-only sobre o estado
// `window.RAVATEX_DOCUMENTS_RECEIVED` populado pelo loader dedicado
// do G12-G1. NAO consome `window.RAVATEX_DOCUMENTS_LOADED_EVENTS` (que
// permanece exclusivo do Pedido Detail).
//
// Cada item da fila representa um documento recebido do Gmail/Drive
// que ainda nao foi atrelado a um Pedido. Esta tela apenas EXIBE —
// nenhum atrelamento e criado aqui; o botao "Ver" abre o link do
// Drive em nova aba.
//
// Fase: RAVATEX-TAPETES-G12-G2 + G12-R1 (UX: botao inline, sem
// flutuante) + G12-R3 (limpeza UX: copy de import, exibicao
// das colunas Status/Pedido/Recebido em, esconder botao legado
// "Importar eventos" na rota).
//
// Sem Supabase, sem Google/Drive real, sem persistencia, sem
// watcher/polling. Documentos NAO sao armazenados no navegador
// alem do snapshot em memoria ja carregado via import manual
// (botao inline nesta tela).
//
// Carregar via <script src="js/screens/documentos-recebidos.js"></script>
// DEPOIS de js/documents-ingestor.js, js/documents-ingestor-loader.js
// e js/documents-ingestor-import-received.js (para ter o botao
// inline), e DEPOIS de js/screens/common.js (precisa de
// window.shellLayout e window.ADMIN_MENU), e ANTES de js/boot.js
// (que registra a rota).
// =====================================================================

(function (window) {
  'use strict';

  function getReceived() {
    if (typeof window.RAVATEX_DOCUMENTS_RECEIVED === 'undefined') return [];
    var v = window.RAVATEX_DOCUMENTS_RECEIVED;
    return Array.isArray(v) ? v : [];
  }

  function badgeTone(tipo) {
    if (tipo === 'nf') return { bg: '#eaf1fd', text: '#2563eb', label: 'NF' };
    if (tipo === 'romaneio') return { bg: '#f3effd', text: '#6a3db8', label: 'Romaneio' };
    if (tipo === 'desconhecido') return { bg: '#f1f3f6', text: '#5b6472', label: 'Desconhecido' };
    return { bg: '#f1f3f6', text: '#5b6472', label: tipo || 'Doc' };
  }

  function formatoBadge(formato) {
    if (formato === 'pdf') return { bg: '#fdeee6', text: '#b65630', label: 'PDF' };
    if (formato === 'xml') return { bg: '#e6f1fd', text: '#2563eb', label: 'XML' };
    if (formato === 'desconhecido') return { bg: '#f1f3f6', text: '#5b6472', label: '?' };
    return null;
  }

  function direcaoBadge(direcao) {
    if (direcao === 'entrada') return { bg: '#e6f4ec', text: '#18794a', label: 'Entrada' };
    if (direcao === 'saida') return { bg: '#fdf0e6', text: '#b65630', label: 'Saida' };
    if (direcao === 'desconhecida') return { bg: '#f1f3f6', text: '#5b6472', label: '?' };
    return null;
  }

  function fmtDataHoraCurta(iso) {
    if (!iso) return '-';
    try {
      var d = new Date(iso);
      if (isNaN(d.getTime())) return '-';
      var day = String(d.getDate()).padStart(2, '0');
      var mon = String(d.getMonth() + 1).padStart(2, '0');
      var hour = String(d.getHours()).padStart(2, '0');
      var min = String(d.getMinutes()).padStart(2, '0');
      return day + '/' + mon + ' ' + hour + ':' + min;
    } catch (_e) {
      return String(iso).slice(0, 16);
    }
  }

  function buildBadge(meta) {
    if (!meta) return null;
    return window.el('span', {
      style: 'display:inline-flex;background:' + meta.bg + ';color:' + meta.text
        + ';border-radius:4px;padding:2px 8px;font-size:10.5px;font-weight:700;'
        + 'letter-spacing:.02em;flex-shrink:0;',
    }, meta.label);
  }

  function buildHeader() {
    var header = window.el('div', { style: 'margin-bottom:8px;' },
      window.el('div', {
        style: 'font-size:20px;font-weight:800;color:#16203a;letter-spacing:-.01em;margin-bottom:4px;',
      }, 'Documentos Recebidos'),
      window.el('div', {
        style: 'font-size:13px;color:#5b6472;line-height:1.5;',
      }, 'Importe a lista gerada pelo Documents Ingestor para revisar documentos mapeados. '
        + 'Aceita os exports documentos-recebidos.jsonl (antigo) e documentos-mapeados.jsonl (G12-F1).')
    );
    return header;
  }

  function buildImportAction() {
    // Container horizontal para o botao inline de import.
    // Anexa o file input + button via API exposta em G12-G3.
    var wrap = window.el('div', {
      'data-section': 'documentos-recebidos-import-action',
      style: 'display:flex;align-items:center;gap:10px;'
        + 'background:#fff;border:1px solid #eceef1;border-radius:4px;'
        + 'padding:10px 14px;margin-bottom:14px;',
    });

    if (window.RAVATEX_DOCUMENTS
        && typeof window.RAVATEX_DOCUMENTS.createReceivedImportButton === 'function') {
      var importPair = window.RAVATEX_DOCUMENTS.createReceivedImportButton({
        buttonId: 'rv-docs-received-import-btn-inline',
      });
      importPair.mount(wrap);
    } else {
      // Fallback defensivo: o modulo de import nao carregou.
      // Mostra aviso sem quebrar a tela.
      wrap.appendChild(window.el('div', {
        style: 'font-size:12.5px;color:#b45309;',
      }, 'Modulo de import nao carregado.'));
    }
    return wrap;
  }

  function buildEmptyState() {
    var card = window.el('div', {
      style: 'background:#fff;border:1px solid #eceef1;border-radius:8px;'
        + 'padding:32px 24px;text-align:center;',
    },
      window.el('div', {
        style: 'font-size:15px;font-weight:700;color:#16203a;margin-bottom:6px;',
      }, 'Nenhum documento recebido'),
      window.el('div', {
        style: 'font-size:13px;color:#8a93a3;line-height:1.5;',
      }, 'Use o botao acima para carregar o arquivo JSONL exportado pelo Documents Ingestor '
        + '(documentos-recebidos.jsonl ou documentos-mapeados.jsonl). '
        + 'A lista abaixo sera preenchida com os documentos importados.')
    );
    return card;
  }

  function buildCountHeader(count) {
    return window.el('div', {
      style: 'display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;',
    },
      window.el('div', {
        style: 'font-size:11px;font-weight:700;color:#8a93a3;letter-spacing:.05em;',
      }, 'DOCUMENTOS RECEBIDOS'),
      window.el('div', {
        style: 'font-size:12px;color:#5b6472;',
      }, String(count) + ' documento' + (count === 1 ? '' : 's'))
    );
  }

  function buildColumnsLegend() {
    // Cabecalho tabular com os nomes das colunas exibidas em cada
    // linha (Status, Pedido, Recebido em). Posicionado logo apos
    // o contador e antes do primeiro row. Marca tambem a presenca
    // da coluna acao (Ver / Sem link).
    var cell = function (label) {
      return window.el('div', {
        style: 'font-size:10px;font-weight:700;color:#8a93a3;letter-spacing:.06em;',
      }, label);
    };
    return window.el('div', {
      'data-section': 'documentos-recebidos-columns',
      style: 'display:flex;align-items:center;gap:14px;padding:8px 18px;'
        + 'background:#f8f9fb;border-bottom:1px solid #eceef1;'
        + 'font-family:inherit;',
    },
      window.el('div', {
        style: 'flex:1 1 0%;display:flex;align-items:center;gap:14px;min-width:0;',
      },
        cell('DOCUMENTO'),
        cell('STATUS'),
        cell('PEDIDO'),
        cell('RECEBIDO EM')
      ),
      cell('AÇÃO')
    );
  }

  function buildDocumentRow(doc) {
    var tipo = doc && doc.tipo_documento;
    var formato = doc && doc.formato;
    var direcao = doc && doc.direcao_nf;
    var filename = doc && doc.filename_original ? doc.filename_original : 'Documento';
    var driveLink = doc && doc.drive_web_view_link ? doc.drive_web_view_link : null;
    // G12-F2: o export documentos-mapeados.jsonl usa received_at;
    // o antigo documentos-recebidos.jsonl so trazia created_at.
    // Fallback encadeado para manter compatibilidade.
    var when = doc && (doc.received_at || doc.created_at)
      ? (doc.received_at || doc.created_at)
      : null;
    var pedido = doc && doc.pedido_manual ? doc.pedido_manual : '';
    // G12-F2: status agora vem do doc (mapeados); antigo nao trazia.
    // Mapeamento operacional consistente.
    var statusRaw = doc && doc.status ? String(doc.status).toLowerCase() : '';
    var statusLabel;
    var statusBg = '#fff4e6';
    var statusFg = '#c2610c';
    if (statusRaw === 'pending') {
      statusLabel = 'Pendente';
    } else if (statusRaw === 'assigned') {
      statusLabel = 'Atrelado';
      statusBg = '#eaf1fd'; statusFg = '#2563eb';
    } else if (statusRaw === 'accepted') {
      statusLabel = 'Aceito';
      statusBg = '#e6f4ec'; statusFg = '#18794a';
    } else if (statusRaw === 'rejected') {
      statusLabel = 'Rejeitado';
      statusBg = '#fde6e6'; statusFg = '#b65050';
    } else {
      // Fallback seguro (legado ou valor desconhecido) -> Pendente.
      statusLabel = 'Pendente';
    }

    var badges = window.el('div', { style: 'display:flex;gap:5px;flex-wrap:wrap;align-items:center;' });
    var tipoB = buildBadge(badgeTone(tipo));
    if (tipoB) badges.appendChild(tipoB);
    var formatoB = buildBadge(formatoBadge(formato));
    if (formatoB) badges.appendChild(formatoB);
    var direcaoB = buildBadge(direcaoBadge(direcao));
    if (direcaoB) badges.appendChild(direcaoB);

    var statusPill = window.el('span', {
      'data-field': 'status',
      'data-status': statusRaw || 'pending',
      style: 'display:inline-flex;background:' + statusBg + ';color:' + statusFg + ';'
        + 'border-radius:4px;padding:2px 8px;font-size:10.5px;font-weight:700;'
        + 'letter-spacing:.02em;flex-shrink:0;',
    }, statusLabel);

    var pedidoCell;
    if (pedido) {
      pedidoCell = window.el('span', {
        'data-field': 'pedido',
        'data-pedido': pedido,
        style: 'display:inline-flex;background:#eaf1fd;color:#2563eb;'
          + 'border-radius:4px;padding:2px 8px;font-size:10.5px;font-weight:700;'
          + 'letter-spacing:.02em;flex-shrink:0;',
      }, pedido);
    } else {
      pedidoCell = window.el('span', {
        'data-field': 'pedido',
        'data-pedido': '',
        style: 'color:#9aa2af;font-size:11px;font-style:italic;flex-shrink:0;',
      }, '— sem pedido');
    }

    var recebidoEm = window.el('span', {
      'data-field': 'recebido-em',
      style: 'font-size:11.5px;color:#5b6472;flex-shrink:0;white-space:nowrap;',
    }, fmtDataHoraCurta(when));

    var verBtn;
    if (driveLink) {
      verBtn = window.el('button', {
        type: 'button',
        'data-action': 'ver-documento-drive',
        'data-document-id': (doc && doc.document_id) || '',
        style: 'display:inline-flex;align-items:center;gap:6px;background:#fff;color:#2563eb;'
          + 'border:1px solid #2563eb;border-radius:4px;padding:4px 12px;'
          + 'font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;flex-shrink:0;',
        onclick: function () {
          if (typeof window.open === 'function') {
            window.open(driveLink, '_blank', 'noopener,noreferrer');
          }
        },
      }, 'Ver');
    } else {
      verBtn = window.el('span', {
        'data-action': 'sem-link',
        'data-document-id': (doc && doc.document_id) || '',
        style: 'color:#9aa2af;font-size:11.5px;font-style:italic;flex-shrink:0;',
      }, 'Sem link');
    }

    var metaRow = window.el('div', {
      'data-row': 'documento-recebido-meta',
      style: 'display:flex;align-items:center;gap:14px;flex-wrap:wrap;'
        + 'padding-top:6px;border-top:1px dashed #f1f3f6;margin-top:6px;',
    },
      window.el('div', { style: 'display:flex;align-items:center;gap:5px;flex-shrink:0;' },
        window.el('span', {
          style: 'font-size:10px;font-weight:700;color:#8a93a3;letter-spacing:.06em;',
        }, 'STATUS'),
        statusPill
      ),
      window.el('div', { style: 'display:flex;align-items:center;gap:5px;flex-shrink:0;' },
        window.el('span', {
          style: 'font-size:10px;font-weight:700;color:#8a93a3;letter-spacing:.06em;',
        }, 'PEDIDO'),
        pedidoCell
      ),
      window.el('div', { style: 'display:flex;align-items:center;gap:5px;flex-shrink:0;' },
        window.el('span', {
          style: 'font-size:10px;font-weight:700;color:#8a93a3;letter-spacing:.06em;',
        }, 'RECEBIDO EM'),
        recebidoEm
      )
    );

    var right = window.el('div', {
      style: 'display:flex;align-items:center;gap:10px;flex-shrink:0;',
    }, verBtn);

    var left = window.el('div', {
      style: 'display:flex;align-items:center;gap:14px;min-width:0;flex:1 1 0%;',
    },
      window.el('div', {
        style: 'display:flex;flex-direction:column;gap:6px;min-width:0;flex:1 1 0%;',
      },
        window.el('div', {
          style: 'display:flex;align-items:center;gap:10px;min-width:0;',
        },
          window.el('div', {
            style: 'font-size:13.5px;font-weight:600;color:#16203a;'
              + 'overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1 1 0%;min-width:0;',
          }, filename),
          badges
        ),
        metaRow
      ),
      right
    );

    return window.el('div', {
      'data-document-id': (doc && doc.document_id) || '',
      'data-row': 'documento-recebido',
      style: 'display:flex;align-items:center;justify-content:space-between;'
        + 'gap:14px;padding:12px 18px;background:#fff;'
        + 'border-bottom:1px solid #f1f3f6;',
    }, left);
  }

  function buildCard(received) {
    var card = window.el('div', {
      style: 'background:#fff;border:1px solid #eceef1;border-radius:8px;'
        + 'overflow:hidden;margin-bottom:14px;',
    });

    card.appendChild(buildCountHeader(received.length));
    card.appendChild(buildColumnsLegend());

    var list = window.el('div', { style: 'display:flex;flex-direction:column;' });
    received.forEach(function (doc, index) {
      var row = buildDocumentRow(doc);
      if (index === received.length - 1) {
        row.style.borderBottom = 'none';
      }
      list.appendChild(row);
    });
    card.appendChild(list);

    return card;
  }

  function screenDocumentosRecebidos() {
    var container = window.el('div', {});
    var received = getReceived();

    var page = window.el('div', { style: 'max-width:1100px;' });
    page.appendChild(buildHeader());

    // Botao inline: aparece APENAS dentro desta tela (G12-R1).
    // Substitui o antigo botao flutuante, que ficava sempre visivel.
    page.appendChild(buildImportAction());

    if (!received.length) {
      page.appendChild(buildEmptyState());
    } else {
      page.appendChild(buildCard(received));
    }

    container.appendChild(page);
    return window.shellLayout(window.ADMIN_MENU, container);
  }

  window.RAVATEX_SCREENS = window.RAVATEX_SCREENS || {};
  window.RAVATEX_SCREENS.documentosRecebidos = {
    screenDocumentosRecebidos: screenDocumentosRecebidos,
  };
  window.screenDocumentosRecebidos = screenDocumentosRecebidos;
})(window);
