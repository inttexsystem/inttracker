// =====================================================================
// === SCREENS: ORDEM DE COMPRA — DATA LOADER ==========================
// Phase: REFUND-B1 (spec §R.22). Data layer for the dedicated native
// purchase-order administration screens (list + detail). Mirrors the
// pedido-detail-data.js convention: reopens the shared
// window.RAVATEX_SCREENS.ordemCompra namespace and exposes async loaders
// that take (id?, state) and write onto state, returning null on success
// or a string error-code the caller branches on.
//
// All order reads go through the SECURITY DEFINER read-model RPCs
// (listar_ordens_compra_admin / obter_ordem_compra_admin, db/68) — the
// client never reconstructs administrative authority from table joins
// (§R.22.10/§R.22.11). Graceful degradation: on a database without db/68
// the RPC is missing (PostgREST PGRST202) and the loader returns
// 'indisponivel' so the screen renders a neutral notice instead of
// crashing (§R.22.0 — production carries db/01→64 only).
//
// Form reference reads (pedidos / fornecedores / cores) are simple
// table selects for the "nova ordem" / "adicionar item" pickers; they do
// not carry administrative authority.
// =====================================================================

(function (window) {
  'use strict';

  window.RAVATEX_SCREENS = window.RAVATEX_SCREENS || {};
  var ns = window.RAVATEX_SCREENS.ordemCompra = window.RAVATEX_SCREENS.ordemCompra || {};

  function isMissingFunction(error) {
    if (!error) return false;
    return error.code === 'PGRST202'
      || /function .* does not exist/i.test(error.message || '')
      || /could not find the function/i.test(error.message || '');
  }
  ns.isMissingFunction = isMissingFunction;

  ns.createInitialState = function () {
    return {
      ordens: [],
      ordem: null,
      eventos: [],
      pedidos: [],
      fornecedores: [],
      cores: [],
      distribuicao: null,
      indisponivel: false,
    };
  };

  // Distribution read model for a native draft order (PRE-PROD-A, §R.23.8).
  // Best-effort: only meaningful for native orders; a missing RPC (db/69 not
  // applied) or a legacy/non-draft order simply leaves state.distribuicao null.
  ns.loadDistribuicao = async function (ordemId, state) {
    state.distribuicao = null;
    var api = window.RAVATEX_SCREENS && window.RAVATEX_SCREENS.ordemCompraDistribuicao;
    if (!api || !state.ordem || state.ordem.modelo !== 'nativo') return null;
    var d = await api.carregar(ordemId);
    if (d && d.ok === true) state.distribuicao = d;
    return null;
  };

  // List view loader — listar_ordens_compra_admin(p_pedido_id=null).
  ns.loadOrdensList = async function (state) {
    state.ordens = [];
    state.indisponivel = false;
    var res = await window.supa.rpc('listar_ordens_compra_admin', { p_pedido_id: null });
    if (res.error) {
      if (isMissingFunction(res.error)) { state.indisponivel = true; return 'indisponivel'; }
      console.error('ordem-compra: erro ao listar', res.error);
      window.toast('Erro ao carregar ordens de compra.', 'error');
      return 'lista';
    }
    if (!res.data || res.data.ok !== true) {
      console.error('ordem-compra: listar recusou', res.data);
      window.toast((res.data && res.data.erro) || 'Sem permissao para ordens de compra.', 'error');
      return 'lista';
    }
    state.ordens = res.data.ordens || [];
    state.ocIdentidades = await ns.carregarIdentidadesOc(
      state.ordens.map(function (o) { return o.ordem_id; }));
    return null;
  };

  // Detail view loader — obter_ordem_compra_admin(p_ordem_id).
  ns.loadOrdemDetail = async function (ordemId, state) {
    state.ordem = null;
    state.eventos = [];
    state.indisponivel = false;
    var res = await window.supa.rpc('obter_ordem_compra_admin', { p_ordem_id: ordemId });
    if (res.error) {
      if (isMissingFunction(res.error)) { state.indisponivel = true; return 'indisponivel'; }
      console.error('ordem-compra: erro ao obter', res.error);
      window.toast('Erro ao carregar a ordem de compra.', 'error');
      return 'detalhe';
    }
    if (!res.data || res.data.ok !== true) {
      window.toast((res.data && res.data.erro) || 'Ordem de compra nao encontrada.', 'error');
      return 'nao_encontrada';
    }
    state.ordem = res.data.ordem || null;
    state.eventos = res.data.eventos || [];
    state.ocIdentidades = await ns.carregarIdentidadesOc(
      state.ordem ? [state.ordem.ordem_id] : []);
    return null;
  };

  // ---- Emission (PHASE-C5, OC-C5-EMISSION-001) -------------------------
  // Wraps the ONLY canonical emission writer public.emitir_ordem_compra(BIGINT)
  // (db/68 body, activated for `authenticated` by db/77; internal is_admin()
  // gate authoritative). Action availability is NEVER decided here — it is read
  // from the server `acoes.emitir` flag in obter_ordem_compra_admin (§R.22.10);
  // this layer only performs the transition and classifies its result.
  //
  // Idempotency posture (contract §9/§13): emitir_ordem_compra takes NO
  // p_idempotency_key parameter — none is invented. The attempt token below is a
  // LOCAL, in-memory, never-transmitted bookkeeping marker (mint-on-open, reused
  // only across a genuine status===0 transport-ambiguous retry of the same
  // attempt, new token after any deterministic outcome). The server's natural
  // idempotency backstop is its own status_administrativo re-check
  // (a replay of an already-emitida order deterministically returns
  // 'estado_invalido'), plus the in-flight confirm-button guard in the events
  // layer. These primitives are a structurally INDEPENDENT re-implementation of
  // the ordem-compra-receipt-data.js pattern (contract §3): this module never
  // imports, calls, or extends it, and emitirOrdem never falls back to any other
  // writer (no emitir_ordem_compra_fio, no table write) after any outcome.
  function newEmissionAttemptToken() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
      return window.crypto.randomUUID();
    }
    return 'c5-emit-' + Date.now() + '-' + Math.random().toString(36).slice(2);
  }
  ns.newEmissionAttemptToken = newEmissionAttemptToken;

  function createEmissionAttemptTracker() {
    var attempt = null;
    var intent = null;

    function sameIntent(a, b) {
      if (!a || !b) return false;
      var aKeys = Object.keys(a);
      var bKeys = Object.keys(b);
      if (aKeys.length !== bKeys.length) return false;
      return aKeys.every(function (key) { return a[key] === b[key]; });
    }

    return {
      resolveAttempt: function (currentIntent) {
        if (attempt && sameIntent(intent, currentIntent)) return attempt;
        attempt = { token: newEmissionAttemptToken() };
        intent = currentIntent;
        return attempt;
      },
      complete: function () {
        attempt = null;
        intent = null;
      },
    };
  }
  ns.createEmissionAttemptTracker = createEmissionAttemptTracker;

  // The FINITE "commit status genuinely unknown" signal, grounded in the real
  // @supabase/postgrest-js response shape: a fetch() rejection (network/DNS/
  // timeout/abort/CORS) is the ONLY path that yields status === 0 with a present
  // error. Every deterministic server response carries a real HTTP status. Never
  // inferred from message text.
  function isEmissionTransportAmbiguous(res) {
    return !!res && !!res.error && res.status === 0;
  }
  ns.isEmissionTransportAmbiguous = isEmissionTransportAmbiguous;

  // Classifies a window.supa.rpc('emitir_ordem_compra') result into exactly one
  // deterministic-or-ambiguous outcome:
  //   'success'      — data.ok === true (deterministic): mint a new token next.
  //   'rejected'     — data.ok === false with a business codigo (deterministic;
  //                    the eight writer codes sem_permissao / nao_encontrada /
  //                    ordem_legado / estado_invalido / sem_fornecedor /
  //                    sem_itens / alocacao_incompleta / alocacao_incoerente):
  //                    fixed message, new token.
  //   'hard_failure' — an RPC error carrying a real HTTP status (deterministic;
  //                    e.g. permission-denied 42501, missing function PGRST202):
  //                    fixed message, no fallback writer, new token.
  //   'ambiguous'    — status === 0 (transport unknown): RETAIN the token; the
  //                    events layer reloads authoritatively before any retry and
  //                    never falls back to another path (§8).
  function classifyEmissionResult(res) {
    if (res && res.error) {
      if (isEmissionTransportAmbiguous(res)) {
        return { outcome: 'ambiguous', error: res.error };
      }
      return { outcome: 'hard_failure', error: res.error, codigo: (res.error.code || null) };
    }
    var data = (res && res.data) || {};
    if (data.ok === true) return { outcome: 'success', result: data };
    return { outcome: 'rejected', result: data, codigo: (data.codigo || null) };
  }
  ns.classifyEmissionResult = classifyEmissionResult;

  // Native emission writer. Sends ONLY the canonical p_ordem_id (BIGINT) — no
  // idempotency key exists on this RPC and none is invented. Returns the
  // classified outcome; the caller (events layer) owns the confirmation UX,
  // the in-flight guard, the fixed pt-BR error messages, and the authoritative
  // reload.
  // Exclusao permanente (db/96 + db/97). O UNICO escritor e a RPC atomica
  // SECURITY DEFINER; esta camada nao decide elegibilidade — quem decide e
  // public.oc_elegivel_exclusao, projetada em `acoes.excluir` pelo read model.
  // A recusa do servidor viaja intacta para a tela: cada codigo tem um texto
  // proprio e nenhum deles vira a mensagem generica.
  ns.excluirOrdem = async function (ordemId) {
    var res = await window.supa.rpc('excluir_ordem_compra', { p_ordem_id: Number(ordemId) });
    if (res.error) {
      return { ok: false, codigo: 'transporte',
        erro: 'Falha de comunicacao ao excluir a ordem. Recarregue antes de tentar novamente.' };
    }
    return res.data || { ok: false, codigo: 'resposta_vazia', erro: 'Resposta vazia do servidor.' };
  };

  ns.emitirOrdem = async function (ordemId) {
    var res = await window.supa.rpc('emitir_ordem_compra', { p_ordem_id: ordemId });
    return classifyEmissionResult(res);
  };

  // Reference data for the create/edit forms. Best-effort: a failure here
  // does not block rendering the (read-only) order view — the pickers just
  // stay empty and the write actions surface their own errors.
  ns.loadFormRefs = async function (state) {
    var pedRes = await window.supa.from('pedidos').select('id, numero').order('numero', { ascending: false });
    state.pedidos = (pedRes && !pedRes.error && pedRes.data) ? pedRes.data : [];
    var fornRes = await window.supa.from('fornecedores').select('id, nome, tipo').order('nome', { ascending: true });
    state.fornecedores = (fornRes && !fornRes.error && fornRes.data) ? fornRes.data : [];
    var corRes = await window.supa.from('cores').select('id, nome').order('nome', { ascending: true });
    state.cores = (corRes && !corRes.error && corRes.data) ? corRes.data : [];
    return null;
  };

  // =====================================================================
  // OP-CANONICAL-IDENTITY-REFOUNDATION-R1 — resolvedor de identidade de OP
  // para as superficies de compra e recebimento.
  //
  // POR QUE ISTO EXISTE
  //   As RPCs aceitas deste dominio (`obter_distribuicao_ordem_compra`
  //   db/69, `obter_historico_recebimento_ordem_compra` db/70/db/74)
  //   atribuem a origem de cada alocacao/lancamento APENAS por `op_id`. Era
  //   isso que fazia as telas imprimirem `OP 137` — a chave primaria crua
  //   como se fosse nome de negocio, uma TERCEIRA identidade da mesma OP.
  //
  //   Reescrever essas RPCs para projetarem a identidade esta FORA do escopo
  //   desta ordem (ciclo de vida de ordem de compra e dominio aceito, com
  //   testes de contrato congelados). Em vez disso, db/95 expoe a view
  //   somente leitura `public.op_identidade_projecao`, e este resolvedor a
  //   consulta para os `op_id` efetivamente exibidos.
  //
  //   A view usa `security_invoker`, portanto a RLS de `public.ops` continua
  //   valendo: nenhum papel passa a ver OP que nao veria direto.
  //
  // FALHA FECHADA
  //   Se a leitura falhar, o mapa volta VAZIO e as telas renderizam o estado
  //   diagnostico explicito. Nunca a chave primaria.
  // =====================================================================
  // Dedupe preservando a ordem; ids nulos nunca entram na consulta.
  function idsUnicos(ids) {
    var unicos = [];
    var visto = {};
    (ids || []).forEach(function (id) {
      if (id == null) return;
      var key = String(id);
      if (visto[key]) return;
      visto[key] = true;
      unicos.push(id);
    });
    return unicos;
  }

  // Resolvedor de identidade em lote, unico para OP e OC. Recebe a origem
  // (tabela/view + coluna-chave) e devolve `chave -> linha`. Uma leitura que
  // falha devolve mapa vazio de proposito: o formatador central entao declara
  // o estado diagnostico, em vez de a tela inventar um nome.
  async function carregarIdentidades(origem, chave, colunas, ids, rotuloLog) {
    var unicos = idsUnicos(ids);
    if (!unicos.length) return {};
    var res = await window.supa.from(origem).select(colunas).in(chave, unicos);
    if (res.error || !res.data) {
      console.error('ordem-compra: falha ao resolver identidade de ' + rotuloLog, res.error);
      return {};
    }
    var mapa = {};
    res.data.forEach(function (row) {
      if (row && row[chave] != null) mapa[String(row[chave])] = row;
    });
    return mapa;
  }

  ns.carregarIdentidadesOp = async function (opIds) {
    return carregarIdentidades(
      'op_identidade_projecao', 'op_id',
      'op_id, identidade_operacional, identidade_pedido_id, numero, ano, tipo',
      opIds, 'OP');
  };

  // Identidade canonica da OC (db/95), lida DIRETO de public.ordem_compra:
  // db/67 concede SELECT a `authenticated` sob a policy ordem_compra_admin_select
  // (USING is_admin()), entao o administrador ja enxerga a coluna. As RPCs
  // db/77 continuam a projetar apenas `ordem_id`; ate que uma migracao revisada
  // as atualize, este e o unico caminho de leitura da identidade.
  //
  // `pedido_id` e `identidade_pedido_id` viajam junto porque o formatador
  // central distingue com eles a OC legada SEM Pedido (rotulo nao numerado,
  // deliberado) da OC vinculada cuja identidade ainda nao foi atribuida.
  ns.carregarIdentidadesOc = async function (ordemIds) {
    return carregarIdentidades(
      'ordem_compra', 'id',
      'id, identidade_operacional, identidade_pedido_id, pedido_id',
      ordemIds, 'OC');
  };

  // A FORMATACAO do rotulo vive no dono central
  // (RAVATEX_OP_DISPLAY.formatOpIdentityFromMap): este modulo owns apenas o
  // I/O. Manter as duas coisas aqui invertia o acoplamento — telas de render
  // passariam a depender do modulo de dados so para formatar texto.
})(window);
