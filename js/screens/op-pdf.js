// =====================================================================
// === SCREENS: OP PDF (Seam C — extração de OP-NOVA-PDF-MODULE-A) ====
// Helper de geração de PDF para ordens de compra de fios, extraído
// de js/screens/op-nova.js (RAVATEX-TAPETES-OP-NOVA-PDF-MODULE-A).
//
// Carregar via <script src="js/screens/op-pdf.js"></script> no
// <head>, DEPOIS de js/screens/op-persistir.js e ANTES de
// js/screens/op-nova.js + jspdf CDN. Necessita:
//
//   - window.jspdf.jsPDF (CDN jspdf em index.html)
//   - window.agruparOrdensCompraFio (de js/calculo-op.js)
//   - window.toast (de js/ui.js) — para fallback de jsPDF ausente
//
// A função recebe `op` e `ordens` por argumento e NÃO depende
// da closure de screenNovaOP. Comportamento preservado 1:1 com a
// implementação original: usa agruparOrdensCompraFio, gera o PDF
// via jsPDF e chama doc.save() com o nome padrão
// `compra-fios-OP-<numero>-<ano>.pdf`.
//
// Compatibilidade:
//   window.gerarPdfCompraFios e
//   window.RAVATEX_SCREENS.opPdf.gerarPdfCompraFios ficam
//   disponíveis para o call-site em op-nova.js (buildBlocoFios).
//
// NÃO faz writes Supabase.
// NÃO acessa DOM mutante (apenas toast() para feedback).
// =====================================================================

(function (window) {
  'use strict';

  // PEDIDO-ITEM-PRODUCTION-PRIORITY-R1 — secao DERIVADA de prioridade.
  //
  // Ela e acrescentada NO FIM do documento, depois das duas secoes de fio, e
  // nao toca em nenhuma medida das secoes existentes: nem margem, nem coluna,
  // nem fonte, nem o passo vertical de 6px. O conteudo tambem nao vem da OP —
  // ele vem do Pedido, por argumento — e NADA aqui e gravado em
  // `ops.observacao` ou em qualquer outra coluna.
  //
  // Sem prioridade confirmada, a secao simplesmente nao existe no PDF.
  function secaoPrioridade(doc, y, prioridade, rotuloModelo) {
    if (!prioridade || !Array.isArray(prioridade.linhas) || prioridade.linhas.length === 0) return y;

    // Uma quebra de pagina simples evita que a secao comece colada no rodape.
    if (y > 250) {
      doc.addPage();
      y = 15;
    }

    doc.setFontSize(12);
    doc.text('ORDEM DE PRIORIDADE DO PEDIDO', 14, y); y += 6;
    doc.setFontSize(9);
    doc.text(`Pedido Nº ${prioridade.pedidoNumero} · sequência confirmada entre os itens do Pedido`, 14, y); y += 6;
    doc.setFontSize(10);
    for (const linha of prioridade.linhas) {
      const nome = typeof rotuloModelo === 'function' ? rotuloModelo(linha.modeloId) : String(linha.modeloId);
      doc.text(`${linha.posicao}º  ${nome}`, 18, y);
      doc.text(`${Number(linha.metros || 0).toFixed(2).replace('.', ',')} m`, 120, y);
      y += 6;
    }
    return y;
  }

  function gerarPdfCompraFios({ op, ordens, prioridade, rotuloModelo }) {
    const jsPDFCtor = window.jspdf && window.jspdf.jsPDF;
    if (!jsPDFCtor) {
      if (typeof window.toast === 'function') {
        window.toast('Biblioteca de PDF não carregou', 'error');
      }
      return;
    }
    const g = window.agruparOrdensCompraFio(ordens);
    const doc = new jsPDFCtor();
    const loteTxt = op.lote ? `Lote Nº ${op.lote.numero} · ${op.lote.cliente?.nome || '—'}` : 'Lote —';
    let y = 15;
    doc.setFontSize(14); doc.text('Compra de fios', 14, y); y += 8;
    doc.setFontSize(10);
    doc.text(`${loteTxt}`, 14, y); y += 6;
    // Documento externo: a identidade canonica e o UNICO nome da OP impresso.
    const opIdent = window.RAVATEX_OP_DISPLAY.formatOpOperationalCode(op);
    doc.text(`${opIdent} · ${new Date().toLocaleDateString('pt-BR')}`, 14, y); y += 10;

    const secao = (titulo, lista, total) => {
      doc.setFontSize(12); doc.text(titulo, 14, y); y += 6;
      doc.setFontSize(10);
      if (lista.length === 0) { doc.text('—', 18, y); y += 6; }
      for (const it of lista) {
        doc.text(`${it.rotulo}`, 18, y);
        doc.text(`${it.kg.toFixed(3).replace('.', ',')} kg`, 120, y);
        y += 6;
      }
      doc.setFont(undefined, 'bold');
      doc.text(`Total ${titulo}: ${total.toFixed(3).replace('.', ',')} kg`, 18, y);
      doc.setFont(undefined, 'normal');
      y += 10;
    };
    secao('Algodão', g.algodao, g.totalAlgodao);
    secao('Poliéster', g.poliester, g.totalPoliester);
    y = secaoPrioridade(doc, y, prioridade, rotuloModelo);

    doc.save(`compra-fios-OP-${op.numero}-${op.ano}.pdf`);
  }

  window.RAVATEX_SCREENS = window.RAVATEX_SCREENS || {};
  window.RAVATEX_SCREENS.opPdf = {
    gerarPdfCompraFios,
  };

  window.gerarPdfCompraFios = gerarPdfCompraFios;
})(window);
