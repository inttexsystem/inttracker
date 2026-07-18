// =====================================================================
// === SUPABASE CLIENT + WRITE-GUARD (Seam A) ===========================
// Cria o client Supabase real e aplica a guarda de writes que bloqueia
// insert/update/delete/upsert/rpc quando o app roda em localhost/127.0.0.1
// e a URL do Supabase selecionada é a de produção (cenário geometricamente
// impossível em produção, mas mantido como defesa em profundidade).
//
// Carregar via <script src="js/supabase-client.js"></script> no <head>,
// DEPOIS de js/config.js (que provê SUPABASE_URL / SUPABASE_ANON_KEY /
// APP_ENVIRONMENTS) e DEPOIS do CDN do Supabase. ANTES do script inline
// principal que usa `supa`.
//
// Dependências (fornecidas pelo <head>):
//   - window.supabase (CDN)
//   - window.SUPABASE_URL, window.SUPABASE_ANON_KEY (js/config.js)
//   - window.APP_ENVIRONMENTS (js/config.js)
//
// Compatibilidade: expõe os identificadores legados que o script inline
// principal já referencia, e também a namespace RAVATEX_SUPABASE_CLIENT
// para consumidores novos.
// =====================================================================

(function (window) {
  'use strict';

  // -- 1. Client Supabase bruto (sem guarda) -----------------------------
  const _supaRaw = window.supabase.createClient(
    window.SUPABASE_URL,
    window.SUPABASE_ANON_KEY,
    { auth: { persistSession: true, autoRefreshToken: true } }
  );

  // -- 2. Detecção do ambiente de execução (defesa em profundidade) -------
  const _LOCAL_HOSTS = new Set(['localhost', '127.0.0.1']);
  const _IS_LOCAL =
    (typeof location !== 'undefined') && _LOCAL_HOSTS.has(location.hostname);
  const _IS_PROD_URL =
    window.SUPABASE_URL === window.APP_ENVIRONMENTS.production.supabaseUrl;
  const _GUARD_BLOCK_WRITES = _IS_LOCAL && _IS_PROD_URL;

  const _WG_ERROR = () => new Error(
    'WRITE-GUARD: gravação bloqueada. App local apontando para Supabase produção. ' +
    'Use a branch work/app-next com URL de staging para testar writes.'
  );

  // -- 3. Banner vermelho do write-guard (topo) ---------------------------
  // BANNER-HEAD-DEFER-FIX (2026-07-18): este script carrega em <head>,
  // ANTES de <body> existir — document.body é `null` no momento em que
  // este arquivo executa. Corrigido na raiz (mesmo padrão de
  // js/environment-banner.js): renderiza na hora se document.body já
  // existir, senão adia para 'DOMContentLoaded' — nunca falha em
  // silêncio (sempre loga o que aconteceu).
  function _renderWriteGuardBanner() {
    const _banner = document.createElement('div');
    _banner.id = 'write-guard-banner';
    _banner.setAttribute('role', 'alert');
    _banner.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:99999;' +
      'background:#dc2626;color:#fff;text-align:center;padding:6px 12px;' +
      'font-family:Inter,system-ui,sans-serif;font-size:13px;font-weight:600;' +
      'box-shadow:0 1px 4px rgba(0,0,0,.2);';
    _banner.textContent =
      'LOCAL APONTANDO PARA PRODUÇÃO — WRITES BLOQUEADOS (insert/update/delete/upsert/rpc). ' +
      'Reads e login funcionam normalmente.';
    document.body.prepend(_banner);
    console.warn('[WRITE-GUARD] write-guard-banner renderizado.');
    return _banner;
  }

  if (_GUARD_BLOCK_WRITES) {
    console.warn(
      '%c[WRITE-GUARD] LOCAL + PRODUÇÃO — writes bloqueados (insert/update/delete/upsert/rpc).',
      'background:#dc2626;color:#fff;padding:2px 6px;border-radius:3px;font-weight:bold;'
    );
    if (typeof document === 'undefined') {
      console.warn('[WRITE-GUARD] write-guard-banner não renderizado: sem `document` neste ambiente.');
    } else if (document.body) {
      _renderWriteGuardBanner();
    } else if (typeof document.addEventListener !== 'function') {
      console.warn('[WRITE-GUARD] write-guard-banner não renderizado: document.body ausente e document.addEventListener indisponível (não é possível adiar).');
    } else {
      console.warn('[WRITE-GUARD] write-guard-banner adiado até DOMContentLoaded (document.body ainda não existe).');
      document.addEventListener('DOMContentLoaded', function () {
        _renderWriteGuardBanner();
      }, { once: true });
    }
  }

  // -- 4. Wrap do query builder ------------------------------------------
  // Quando o guard está ativo, substitui os métodos de escrita por stubs
  // que rejeitam imediatamente. Métodos terminais (.select, .single, .eq,
  // .order etc) e encadeamento (then/catch) permanecem intactos.
  function _wrapQueryBuilder(qb) {
    if (!_GUARD_BLOCK_WRITES) return qb;
    const _block = (op) => function () {
      return Promise.reject(_WG_ERROR()).then(
        (v) => v,
        (e) => { throw e; }
      );
    };
    qb.insert = _block('insert');
    qb.update = _block('update');
    qb.delete = _block('delete');
    qb.upsert = _block('upsert');
    return qb;
  }

  // -- 5. Proxy do client (aplica a guarda) ------------------------------
  const supa = (() => {
    if (!_GUARD_BLOCK_WRITES) return _supaRaw;
    // Wrap .from() e .rpc() apenas; .auth, .storage etc passam direto.
    return new Proxy(_supaRaw, {
      get(target, prop, receiver) {
        if (prop === 'from') {
          return (table) => _wrapQueryBuilder(target.from(table));
        }
        if (prop === 'rpc') {
          return (fn, params) => {
            void fn; void params;
            return Promise.reject(_WG_ERROR()).then(
              (v) => v,
              (e) => { throw e; }
            );
          };
        }
        return Reflect.get(target, prop, receiver);
      }
    });
  })();

  // -- 6. Namespace e compatibilidade ------------------------------------
  window.RAVATEX_SUPABASE_CLIENT = {
    raw: _supaRaw,
    guarded: supa,
    IS_LOCAL: _IS_LOCAL,
    IS_PROD_URL: _IS_PROD_URL,
    GUARD_BLOCK_WRITES: _GUARD_BLOCK_WRITES,
    LOCAL_HOSTS: _LOCAL_HOSTS,
    renderWriteGuardBanner: _renderWriteGuardBanner,
  };

  // Compatibilidade com o script inline atual.
  window._supaRaw = _supaRaw;
  window._LOCAL_HOSTS = _LOCAL_HOSTS;
  window._IS_LOCAL = _IS_LOCAL;
  window._IS_PROD_URL = _IS_PROD_URL;
  window._GUARD_BLOCK_WRITES = _GUARD_BLOCK_WRITES;
  window._WG_ERROR = _WG_ERROR;
  window._wrapQueryBuilder = _wrapQueryBuilder;
  window.supa = supa;
})(window);
