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

  function gerarPdfCompraFios({ op, ordens }) {
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
    doc.text(`OP Nº ${op.numero}/${op.ano} · ${new Date().toLocaleDateString('pt-BR')}`, 14, y); y += 10;

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

    doc.save(`compra-fios-OP-${op.numero}-${op.ano}.pdf`);
  }

  window.RAVATEX_SCREENS = window.RAVATEX_SCREENS || {};
  window.RAVATEX_SCREENS.opPdf = {
    gerarPdfCompraFios,
  };

  window.gerarPdfCompraFios = gerarPdfCompraFios;
})(window);
