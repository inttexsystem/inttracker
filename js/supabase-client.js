// =====================================================================
// === SUPABASE CLIENT + WRITE-GUARD (Seam A) ===========================
// Cria o client Supabase real e aplica a guarda de writes que bloqueia
// insert/update/delete/upsert/rpc em TODO ambiente sem permissão de
// escrita — isto é, sempre que APP_CONFIG.writesEnabled !== true.
//
// INTTRACKER-PRODUCTION-CUTOVER-R1: não existe banco não-produtivo
// válido, então localhost e os preview deployments da Vercel resolvem
// para o MESMO projeto de produção em modo SOMENTE LEITURA (ambiente
// `restricted` em js/config.js). Esta guarda deixou de ser apenas
// "defesa em profundidade para um caso impossível" e passou a ser o
// mecanismo PRIMÁRIO que impede localhost e previews de gravarem em
// produção. Por isso a condição NÃO é mais `local && url de produção`
// (que não cobriria um preview *.vercel.app, que não é local): a
// condição é a ausência de permissão de escrita do ambiente corrente.
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

  // -- 2. Detecção do ambiente de execução --------------------------------
  // _IS_LOCAL e _IS_PROD_URL continuam publicados para diagnóstico, mas
  // NÃO decidem mais o bloqueio: quem decide é a permissão de escrita
  // declarada pelo ambiente em js/config.js. Um preview *.vercel.app tem
  // _IS_LOCAL === false e mesmo assim precisa ser bloqueado.
  const _LOCAL_HOSTS = new Set(['localhost', '127.0.0.1']);
  const _IS_LOCAL =
    (typeof location !== 'undefined') && _LOCAL_HOSTS.has(location.hostname);
  const _IS_PROD_URL =
    window.SUPABASE_URL === window.APP_ENVIRONMENTS.production.supabaseUrl;

  // Fail-safe: só um `writesEnabled === true` explícito libera escrita.
  // Qualquer ambiente ausente, malformado ou desconhecido bloqueia.
  const _WRITES_ENABLED =
    !!(window.APP_CONFIG && window.APP_CONFIG.writesEnabled === true);
  const _GUARD_BLOCK_WRITES = !_WRITES_ENABLED;

  // -- 2b. RPCs de LEITURA -----------------------------------------------
  // O guard bloqueava TODA `.rpc()`, sem olhar o nome. Como várias telas
  // leem exclusivamente por RPC, elas ficavam completamente inutilizáveis
  // fora dos três hostnames de produção — a lista de Pedidos de Compra
  // (`listar_ordens_compra_admin`) e o detalhe do Pedido
  // (`listar_ordens_compra_fio_compat`, chamada por `attemptCanonicalRead`)
  // quebravam no carregamento, e a mensagem ainda afirmava que "reads
  // funcionam normalmente", o que era falso.
  //
  // A lista abaixo NÃO foi deduzida por nome. Nome não é evidência:
  // `resolver_regime_compra_fio_pedido` e `proximo_numero_op` PARECEM
  // leitura e gravam de verdade, e por isso continuam bloqueados.
  //
  // Cada entrada foi provada sobre a DEFINIÇÃO SQL versionada — o arquivo
  // db/NN citado ao lado do nome é a ÚLTIMA redefinição da função no
  // repositório — por três verificações cumulativas:
  //   (1) volatilidade declarada na própria definição;
  //   (2) varredura do corpo terminal: nenhum INSERT/UPDATE/DELETE/
  //       TRUNCATE/MERGE/COPY, nenhum nextval/setval/set_config,
  //       nenhum DDL, nenhum FOR UPDATE, nenhum advisory lock;
  //   (3) fecho transitivo das funções chamadas, cada uma submetida à
  //       mesma varredura (2). Os auxiliares alcançados são
  //       is_admin, meu_cliente_id, pedido_snapshot,
  //       pedido_tem_op_relacionada, pedido_ano_comercial,
  //       _distribuicao_completa_ordem, oc_elegivel_exclusao e
  //       diagnosticar_impacto_pedido_pre53 — todos sem mutação.
  // Para as entradas STABLE, (1) é reforço: o PostgreSQL recusa DML em
  // função não-volátil. Para as VOLATILE, (2) e (3) são a prova inteira.
  //
  // Fail-closed: nome ausente da lista continua bloqueado. Ao adicionar um
  // nome, refaça (1)+(2)+(3) sobre a definição terminal — nunca pelo nome.
  const _READ_ONLY_RPCS = new Set([
    // STABLE — DML recusado pelo PostgreSQL, corpo e fecho sem mutação
    'admin_alteracao_comparacao',               // db/92
    'admin_usuarios_last_sign_in',              // db/59
    'cliente_alteracao_resumo',                 // db/94
    'cliente_pedido_summary',                   // db/30
    'listar_fila_aceite_fornecedor',            // db/103
    'listar_ordens_compra_fio_compat',          // db/76
    'obter_historico_recebimento_ordem_compra', // db/70
    'obter_planejamento_compra_pedido',         // db/99
    'oc_disponibilidade_op',                    // db/101
    'pedido_elegivel_cancelamento',             // db/105
    'pode_recuperar_op_acabamento',             // db/108
    'sugerir_codigo_ordem_compra',              // db/99
    // VOLATILE (padrão do PL/pgSQL) — corpo e fecho transitivo sem mutação
    'avaliar_necessidades_compra_fio',          // db/69
    'consultar_saldo_expedicao_latex',          // db/32
    'diagnosticar_impacto_pedido',              // db/56
    'listar_ordens_compra_admin',               // db/77
    'obter_distribuicao_ordem_compra',          // db/69
    'obter_ordem_compra_admin'                  // db/97
  ]);

  // -- 2c. INVENTÁRIO DECLARATIVO DAS RPCs DO P2 (METADADO, NÃO AUTORIZAÇÃO) --
  // NATIVE-RECEIPT-COORDINATED-RELEASE-P2: as catorze RPCs nativas que o
  // front-end do P2 consome. Esta lista é DOCUMENTAÇÃO e superfície de teste,
  // NADA MAIS.
  //
  // Ela NÃO concede execução, NÃO é lida pelo proxy do write-guard, NÃO é
  // passada para `_READ_ONLY_RPCS` e NUNCA pode ser unida a ela: apenas as
  // QUATRO entradas provadas como leitura (oc_disponibilidade_op,
  // pedido_elegivel_cancelamento, listar_fila_aceite_fornecedor,
  // pode_recuperar_op_acabamento) estão na allowlist acima, cada uma aprovada
  // pelas três verificações de 2b sobre a definição SQL versionada — todas
  // STABLE, e todo o seu fecho transitivo (_oc_disponibilidade_linhas,
  // _oc_material_recebido_liquido, _oc_reserva_ativa, oc_cobertura_ativa)
  // também STABLE.
  //
  // As DEZ escritoras abaixo continuam BLOQUEADAS em ambiente guardado, como
  // qualquer outra escrita: aparecer aqui não as libera. Os auxiliares
  // owner-only (_op_status_aplicar, _pedido_status_recalcular,
  // _expedicao_estorno_aplicar, _oc_*) são deliberadamente omitidos — não são
  // superfície de cliente.
  const _P2_RPC_INVENTORY = Object.freeze({
    leitura: Object.freeze([
      'oc_disponibilidade_op',                  // db/101
      'pedido_elegivel_cancelamento',           // db/105
      'listar_fila_aceite_fornecedor',          // db/103
      'pode_recuperar_op_acabamento'            // db/108
    ]),
    escrita: Object.freeze([
      'salvar_ajuste_producao_op',              // db/102
      'iniciar_producao_op',                    // db/102
      'alterar_status_pedido',                  // db/105
      'cancelar_pedido',                        // db/105
      'aceitar_ordem_compra',                   // db/103
      'rejeitar_ordem_compra',                  // db/103
      'registrar_entrega_cima_com_acabamento',  // db/111
      'gerar_op_acabamento',                    // db/108
      'estornar_expedicao_tapete_parcial',      // db/109
      'corrigir_entrega_expedicao'              // db/109
    ])
  });

  const _WG_ERROR = (op) => new Error(
    'WRITE-GUARD: gravação bloqueada' + (op ? ' (' + op + ')' : '') + '. Este ' +
    'ambiente é SOMENTE LEITURA sobre o banco de produção (localhost ou ' +
    'preview deployment). Leituras por tabela e as RPCs de leitura ' +
    'declaradas funcionam normalmente, assim como o login; escritas e RPCs ' +
    'não declaradas como leitura só a partir do domínio de produção.'
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
      'box-shadow:var(--rv-shadow-sm);';
    _banner.textContent =
      'BANCO DE PRODUÇÃO EM SOMENTE LEITURA — WRITES BLOQUEADOS (insert/update/delete/upsert/rpc). ' +
      'Reads e login funcionam normalmente.';
    document.body.prepend(_banner);
    console.warn('[WRITE-GUARD] write-guard-banner renderizado.');
    return _banner;
  }

  if (_GUARD_BLOCK_WRITES) {
    console.warn(
      '%c[WRITE-GUARD] SOMENTE LEITURA — writes bloqueados (insert/update/delete/upsert/rpc).',
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
            if (typeof fn === 'string' && _READ_ONLY_RPCS.has(fn)) {
              return target.rpc(fn, params);
            }
            return Promise.reject(_WG_ERROR(fn)).then(
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
    WRITES_ENABLED: _WRITES_ENABLED,
    GUARD_BLOCK_WRITES: _GUARD_BLOCK_WRITES,
    LOCAL_HOSTS: _LOCAL_HOSTS,
    renderWriteGuardBanner: _renderWriteGuardBanner,
    // Metadado declarativo do P2. Publicado para documentação e teste; o
    // proxy acima nunca o consulta e ele não concede execução a ninguém.
    P2_RPC_INVENTORY: _P2_RPC_INVENTORY,
  };

  // Compatibilidade com o script inline atual.
  window._supaRaw = _supaRaw;
  window._LOCAL_HOSTS = _LOCAL_HOSTS;
  window._IS_LOCAL = _IS_LOCAL;
  window._IS_PROD_URL = _IS_PROD_URL;
  window._WRITES_ENABLED = _WRITES_ENABLED;
  window._GUARD_BLOCK_WRITES = _GUARD_BLOCK_WRITES;
  window._WG_ERROR = _WG_ERROR;
  window._wrapQueryBuilder = _wrapQueryBuilder;
  window.supa = supa;
})(window);
