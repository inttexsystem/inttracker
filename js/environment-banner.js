// =====================================================================
// === ENVIRONMENT BANNER (Seam A UI) ==================================
// Banner laranja/amarelo fixo no RODAPÉ da janela, visível apenas
// quando APP_ENV !== 'production'. Não impede login; é um sinal
// visual para o operador de que está em staging.
//
// Carregar via <script src="js/environment-banner.js"></script> no
// <head>, DEPOIS de js/config.js (que provê APP_ENV, APP_CONFIG) e
// DEPOIS de js/supabase-client.js (que pode criar write-guard-banner
// com prioridade visual superior). ANTES do script inline principal.
//
// Comportamento preservado do script inline original:
//   - aparece só quando APP_ENV !== 'production';
//   - texto exato: 'AMBIENTE STAGING — DADOS DE TESTE. Não usar para
//     operações reais.';
//   - id: 'env-banner';
//   - role: 'status';
//   - position: fixed; bottom: 0; left: 0; right: 0; z-index: 99998;
//   - se o banner vermelho (write-guard-banner) existir, o laranja
//     é inserido logo após ele no DOM (preserva empilhamento);
//   - console.info laranja com label e host (acoplado ao banner).
//
// BANNER-HEAD-DEFER-FIX (2026-07-18): este script carrega em <head>,
// ANTES de <body> existir (index.html §index) — document.body é `null`
// no momento em que este arquivo executa. A versão anterior tratava
// isso como best-effort silencioso (try/catch vazio), o que fazia o
// banner nunca aparecer em nenhum host não-produção (local e qualquer
// preview), sem log nem erro — a guarda de segurança escondia a própria
// falha. Corrigido na raiz: se document.body já existe, renderiza na
// hora; se não existe ainda, adia para 'DOMContentLoaded' e renderiza
// então — e ambos os caminhos são logados (nunca silencioso).
// =====================================================================

(function (window) {
  'use strict';

  const ENV_BANNER_ID = 'env-banner';
  const ENV_BANNER_TEXT =
    'AMBIENTE STAGING — DADOS DE TESTE. Não usar para operações reais.';

  // Cria e insere o elemento do banner no DOM. Assume document.body
  // já existe — chamado só depois dessa checagem (imediata ou via
  // DOMContentLoaded).
  function renderEnvironmentBanner() {
    const _envBanner = document.createElement('div');
    _envBanner.id = ENV_BANNER_ID;
    _envBanner.setAttribute('role', 'status');
    _envBanner.style.cssText = 'position:fixed;bottom:0;left:0;right:0;z-index:99998;' +
      'background:#f59e0b;color:#000;text-align:center;padding:6px 12px;' +
      'font-family:Inter,system-ui,sans-serif;font-size:13px;font-weight:600;' +
      'box-shadow:0 -1px 4px rgba(0,0,0,.2);';
    _envBanner.textContent = ENV_BANNER_TEXT;
    // Banner é independente do write-guard banner (que fica no topo e
    // é criado por js/supabase-client.js). Insere no body (append) —
    // fica no final do DOM, mas com position:fixed o ponto de inserção
    // não afeta o posicionamento visual. Se o write-guard banner já
    // existe, insere logo após ele para preservar empilhamento.
    const _wg = document.getElementById('write-guard-banner');
    if (_wg && _wg.parentNode) {
      _wg.parentNode.insertBefore(_envBanner, _wg.nextSibling);
    } else {
      document.body.appendChild(_envBanner);
    }
    console.info(
      '%c[APP-ENV] env-banner renderizado (host: ' +
        (typeof location !== 'undefined' ? location.hostname : '(no location)') + ')',
      'background:#f59e0b;color:#000;padding:2px 6px;border-radius:3px;font-weight:bold;'
    );
    return _envBanner;
  }

  function ensureEnvironmentBanner() {
    if (window.APP_ENV === 'production') return null;

    // log laranja (preservado idêntico ao script inline original)
    console.info(
      '%c[APP-ENV] ' + window.APP_CONFIG.label + ' — host: ' +
        (typeof location !== 'undefined' ? location.hostname : '(no location)'),
      'background:#f59e0b;color:#000;padding:2px 6px;border-radius:3px;font-weight:bold;'
    );

    if (typeof document === 'undefined') {
      console.info('[APP-ENV] env-banner não renderizado: sem `document` neste ambiente.');
      return null;
    }

    if (document.body) {
      return renderEnvironmentBanner();
    }

    if (typeof document.addEventListener !== 'function') {
      // Ambiente sem document.body E sem addEventListener (ex.: mock de
      // teste minimalista) — não há como adiar. Loga a razão em vez de
      // desistir em silêncio (era exatamente esse silêncio que escondia
      // o bug original).
      console.info('[APP-ENV] env-banner não renderizado: document.body ausente e document.addEventListener indisponível (não é possível adiar).');
      return null;
    }

    // document.body ainda não existe (script carregado em <head>,
    // ANTES do <body> ser parseado) — adia para DOMContentLoaded em
    // vez de desistir silenciosamente.
    console.info('[APP-ENV] env-banner adiado até DOMContentLoaded (document.body ainda não existe).');
    document.addEventListener('DOMContentLoaded', function () {
      renderEnvironmentBanner();
    }, { once: true });
    return null;
  }

  // Expõe namespace para testes e para consumidores novos.
  window.RAVATEX_ENV_BANNER = {
    ensureEnvironmentBanner,
    renderEnvironmentBanner,
    ENV_BANNER_ID,
    ENV_BANNER_TEXT,
  };

  // Auto-init na carga do script. Renderiza na hora se o body já
  // existir; senão adia para DOMContentLoaded (ver comentário acima).
  ensureEnvironmentBanner();
})(window);
