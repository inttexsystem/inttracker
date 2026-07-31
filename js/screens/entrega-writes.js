// =====================================================================
// === SCREENS: ENTREGA WRITES (Seam A) ================================
// Helpers de escrita de entrega. Esta fase contém:
//   - excluirEntrega            (Fase 2.1 do DIAG)
//   - salvarEntregaLatex        (Fase 2.2 do DIAG)
//   - atualizarEntregaLatex     (Fase 2.2 do DIAG)
//   - salvarEntregaCima         (Fase 2.3 do DIAG)
//   - atualizarEntregaCima      (Fase 2.3 do DIAG)
//
// Carregar via <script src="js/screens/entrega-writes.js"></script>
// no <head>, DEPOIS de js/screens/entrega-form.js e ANTES do
// script inline principal. As telas inline (screenFornecedorEntregas,
// screenFornecedorLatex, screenNovaOP, renderOPLatexAdmin)
// referenciam os helpers acima como identificadores bare, que são
// resolvidos como globais do <script> (window).
//
// Dependências resolvidas em tempo de chamada (não no load):
//   - window.supa            (js/supabase-client.js)
//   - window.toast           (js/ui.js)
//   - window.confirmDialog   (js/ui.js)
//
// Compatibilidade: window.excluirEntrega, window.salvarEntregaLatex,
// window.atualizarEntregaLatex, window.salvarEntregaCima e
// window.atualizarEntregaCima seguem disponíveis exatamente como
// antes para o inline (call-sites bare preservados).
// =====================================================================

(function (window) {
  'use strict';

  // -------------------------------------------------------------------
  // IDEMPOTÊNCIA DE COMANDO (P2-B)
  //
  // Um comando do servidor (TD3, aceite, estorno, correção) é identificado
  // por UMA chave estável por INTENÇÃO do operador. As regras, que valem
  // igualmente para as quatro superfícies do P2-B:
  //
  //   * uma intenção inalterada, reenviada depois de uma falha de transporte
  //     AMBÍGUA (não se sabe se o servidor gravou), reusa a MESMA chave — o
  //     servidor então devolve o resultado guardado em vez de gravar de novo;
  //   * qualquer desfecho DETERMINÍSTICO (sucesso, recusa reconhecida ou
  //     rejeição do servidor) fecha a tentativa: o próximo envio, mesmo
  //     idêntico, nasce com chave nova;
  //   * a chave é sempre aleatória; a intenção só decide se ela é reusada,
  //     nunca vira a própria chave.
  //
  // Este é o único dono dessa mecânica no P2-B; fornecedor.js e
  // expedicao-admin.js consomem daqui em vez de reimplementar.
  function novoTokenComando() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
      return window.crypto.randomUUID();
    }
    return 'p2b-' + Date.now() + '-' + Math.random().toString(36).slice(2);
  }

  function criarRastreadorComando() {
    var token = null;
    var intencao = null;
    return {
      // Devolve a chave retida quando a intenção é idêntica à da última
      // tentativa não resolvida; senão cunha uma nova.
      resolverChave: function (intencaoAtual) {
        var serial = JSON.stringify(intencaoAtual);
        if (token && intencao === serial) return token;
        token = novoTokenComando();
        intencao = serial;
        return token;
      },
      // Chamar após QUALQUER desfecho determinístico.
      concluir: function () { token = null; intencao = null; },
      chaveAtual: function () { return token; },
    };
  }

  // -------------------------------------------------------------------
  // Preflight: uma entrega de tecelagem (etapa='cima') que já alimenta
  // uma OP de Acabamento/Látex consolidada (vínculo em op_latex_entregas)
  // não pode ser editada nem excluída livremente pelo app — vira
  // documento de origem/entrada da OP seguinte. Correção futura deve ser
  // retificação auditável (guard server-side db/25).
  // Retorna { bloqueada: bool, opLabel: string|null }.
  //   - bloqueada=true quando a entrega está vinculada em op_latex_entregas
  //     a uma ops tipo='latex' (consolidação por origem_op + destino).
  //   - Silenciosa em erro de leitura (fallback permissivo) para não
  //     travar o app por falha de infra; o gate server-side é a
  //     defesa definitiva.
  async function entregaCimaTemOpLatex(entregaId) {
    var op = null;
    try {
      var res = await window.supa
        .from('op_latex_entregas')
        .select('op_latex_id, ops:op_latex_id(id, numero, ano, identidade_operacional, identidade_pedido_id, tipo)')
        .eq('entrega_id', entregaId)
        .maybeSingle();
      if (res && res.error) return { bloqueada: false, opLabel: null };
      op = res && res.data && res.data.ops;
    } catch (err) {
      console.error('entrega-writes: preflight OP Latex falhou', err);
      return { bloqueada: false, opLabel: null };
    }

    // A DECISAO de bloquear depende so do vinculo, e e tomada FORA do try.
    //
    // OP-CANONICAL-IDENTITY-REFOUNDATION-R1 encontrou aqui um defeito real de
    // robustez: quando a formatacao do rotulo estava DENTRO do try, qualquer
    // falha ao formatar — inclusive o dono central ausente por erro de
    // carregamento — caia no catch e o fallback "permissivo" devolvia
    // `bloqueada: false`, ou seja, um erro COSMETICO desativava um gate de
    // ESCRITA. Decisao e apresentacao ficam separadas: um rotulo que falha
    // nunca mais libera uma escrita que deveria estar bloqueada.
    if (!(op && op.id && op.tipo === 'latex')) return { bloqueada: false, opLabel: null };

    var opLabel = null;
    try {
      opLabel = window.RAVATEX_OP_DISPLAY.formatOpOperationalCode(op);
    } catch (err) {
      console.error('entrega-writes: rotulo da OP de acabamento indisponivel', err);
    }
    return { bloqueada: true, opLabel: opLabel };
  }

  async function etapaDaEntrega(entregaId) {
    try {
      var res = await window.supa
        .from('entregas')
        .select('etapa')
        .eq('id', entregaId)
        .maybeSingle();
      if (res && res.data) return res.data.etapa || null;
    } catch (err) {
      console.error('entrega-writes: preflight etapa falhou', err);
    }
    return null;
  }

  // -------------------------------------------------------------------
  // D-C-C: detecção de erro do trigger server-side
  // `entrega_cima_latex_guard` (em entregas) e
  // `entrega_itens_cima_latex_guard` (em entrega_itens) — ver
  // db/24_tec_to_acabamento_guard.sql. Quando o app tenta editar/
  // excluir uma entrega cima já vinculada a OP de Látex, o PostgREST
  // retorna um erro com code P0001 e a mensagem do trigger em
  // error.message / error.details / error.hint. Esta função detecta
  // esse padrão e devolve true para que o callsite mostre um toast
  // amigável em vez de vazar a mensagem técnica do Postgres.
  // Não classifica erros genéricos como sendo do guard.
  var GUARD_UPDATE_MSG = 'Esta entrega já gerou OP de acabamento e não pode ser alterada. Abra a OP de acabamento ou use uma retificação autorizada.';
  var GUARD_DELETE_MSG = 'Esta entrega já gerou OP de acabamento e não pode ser excluída. Abra a OP de acabamento ou use uma retificação autorizada.';

  function isEntregaLatexGuardError(err) {
    if (!err) return false;
    var parts = [];
    if (typeof err.message === 'string') parts.push(err.message);
    if (typeof err.details === 'string') parts.push(err.details);
    if (typeof err.hint === 'string') parts.push(err.hint);
    if (typeof err.code === 'string') parts.push(err.code);
    if (parts.length === 0) return false;
    var blob = parts.join(' \u0001 ').toLowerCase();
    // Marcadores suficientes para identificar a mensagem do trigger
    // (PostgREST prefixa o message com "P0001:" e pode quebrar a
    // frase original em message/details; checamos ambos os ramos
    // do trigger para tolerar variações de formato).
    var isGuardCode = /p0001/.test(blob);
    var isGuardText = blob.indexOf('tecelagem vinculada a op de acabamento') !== -1
      || blob.indexOf('retifica') !== -1 && blob.indexOf('autorizada') !== -1;
    return isGuardText || (isGuardCode && blob.indexOf('tecelagem') !== -1);
  }

  function normalizeGerarOpLatexResult(data) {
    if (Array.isArray(data)) data = data[0] || null;
    if (data && typeof data === 'object') {
      if ('op_latex_id' in data || 'created' in data || 'accumulated' in data || 'already_linked' in data) return data;
      if ('id' in data) return { op_latex_id: data.id, numero: data.numero, ano: data.ano };
      return data;
    }
    if (data == null || data === false) return null;
    return { op_latex_id: data };
  }

  // OP-CANONICAL-IDENTITY-REFOUNDATION-R1: `gerar_op_latex` (db/78) devolve
  // `{op_latex_id, numero, ano, created, ...}` e NAO a identidade canonica — ela
  // e uma RPC aceita de outra fase e nao e reescrita por esta ordem.
  //
  // Quando a identidade vem no payload, e ela que nomeia a OP. Quando nao vem,
  // o toast usa o rotulo da ETAPA ("OP de acabamento"), nao o estado
  // diagnostico: um toast e uma confirmacao de acao, e "OP (identidade
  // pendente)" ali seria ruido sem informacao. O rotulo de etapa e honesto
  // porque descreve o que foi criado sem inventar um segundo NOME para a OP —
  // e a identidade real aparece ao abrir a OP.
  //
  // Buscar a identidade no banco so para compor o texto de um toast seria uma
  // ida extra desproporcional ao valor.
  function opLatexLabelFromRpc(info) {
    return (info && window.RAVATEX_OP_DISPLAY.getCanonicalIdentity(info)) || 'OP de acabamento';
  }

  function toastMsgGerarOpLatex(data) {
    var info = normalizeGerarOpLatexResult(data);
    if (!info || (!info.op_latex_id && info.numero == null && info.ano == null)) return 'Entrega registrada';
    var label = opLatexLabelFromRpc(info);
    if (info.split === true && info.created === true) return 'OP de acabamento separada criada: ' + label;
    if (info.already_linked === true && info.erro) return info.erro;
    if (info.split === false && info.already_linked === true) return 'Entrega ja vinculada a ' + label + '. Nenhuma OP separada foi criada.';
    if (info.created === true) return 'Criou ' + label;
    if (info.accumulated === true) return 'Acumulou na ' + label;
    if (info.already_linked === true) return 'Já vinculada à ' + label;
    return 'Entrega registrada · vinculada à OP de acabamento';
  }

  // -------------------------------------------------------------------
  // Excluir entrega: usa o padrao de callback do confirmDialog (que so dispara
  // onConfirm em caso afirmativo). onSuccess() roda apos delete bem-sucedido.
  async function excluirEntrega(entregaId, onSuccess) {
    // Entrega cima vinculada a OP Látex (op_latex_entregas) não pode ser
    // excluída — é documento de entrada de uma OP de acabamento consolidada.
    var etapa = await etapaDaEntrega(entregaId);
    if (etapa === 'cima') {
      var pre = await entregaCimaTemOpLatex(entregaId);
      if (pre.bloqueada) {
        window.toast('Entrega vinculada à ' + (pre.opLabel || 'OP de acabamento') + '. Exclusão bloqueada — use retificação.', 'error');
        return false;
      }
    }
    window.confirmDialog({
      title: 'Excluir entrega',
      message: 'Esta ação remove a entrega e todos os seus itens. Continuar?',
      confirmLabel: 'Excluir',
      onConfirm: async () => {
        const r = await window.supa.from('entregas').delete().eq('id', entregaId);
        if (r.error) {
          if (isEntregaLatexGuardError(r.error)) {
            window.toast(GUARD_DELETE_MSG, 'error');
            console.error('entrega-writes: trigger entrega_cima_latex_guard', r.error);
            return;
          }
          window.toast('Erro ao excluir entrega', 'error'); console.error(r.error); return;
        }
        window.toast('Entrega excluída', 'success');
        if (onSuccess) onSuccess();
      },
    });
  }

  // -------------------------------------------------------------------
  // Persistência dos recebimentos de látex (Fase 5b). Espelha as de
  // tecelagem, mas etapa='latex', sem destino e sem gerar OP (a OP
  // de látex já existe).
  async function salvarEntregaLatex({ fornecedorId, opId, payload }) {
    if (payload.linhas.length === 0) { window.toast('Adicione ao menos 1 item com metros recebidos', 'error'); return false; }
    const ins = await window.supa.from('entregas').insert({
      fornecedor_id: fornecedorId, etapa: 'latex', data: payload.data, observacao: payload.observacao,
    }).select().single();
    if (ins.error) { window.toast('Erro ao gravar recebimento', 'error'); console.error(ins.error); return false; }
    const entregaId = ins.data.id;
    const itens = payload.linhas.map(l => ({ entrega_id: entregaId, op_id: opId, ...l }));
    const insItens = await window.supa.from('entrega_itens').insert(itens);
    if (insItens.error) {
      await window.supa.from('entregas').delete().eq('id', entregaId);
      window.toast('Erro ao gravar itens do recebimento', 'error'); console.error(insItens.error); return false;
    }
    window.toast('Recebimento registrado', 'success');
    return true;
  }

  async function atualizarEntregaLatex({ entregaId, opId, payload }) {
    if (payload.linhas.length === 0) { window.toast('Adicione ao menos 1 item com metros recebidos', 'error'); return false; }
    const upd = await window.supa.from('entregas').update({
      data: payload.data, observacao: payload.observacao,
    }).eq('id', entregaId);
    if (upd.error) { window.toast('Erro ao atualizar recebimento', 'error'); console.error(upd.error); return false; }
    await window.supa.from('entrega_itens').delete().eq('entrega_id', entregaId);
    const itens = payload.linhas.map(l => ({ entrega_id: entregaId, op_id: opId, ...l }));
    const insItens = await window.supa.from('entrega_itens').insert(itens);
    // MVP: se a reinsercao falhar aqui, a entrega fica sem itens.
    // Como o app eh single-admin e baixo volume, aceitamos o risco
    // e a correcao manual via Supabase.
    if (insItens.error) { window.toast('Erro ao regravar itens do recebimento', 'error'); console.error(insItens.error); return false; }
    window.toast('Recebimento atualizado', 'success');
    return true;
  }

  // -------------------------------------------------------------------
  // ENTREGA DE TECELAGEM DA ROTA TAPETE — TD3 (db/111, §9.9.J)
  //
  // ANTES esta função era uma sequência de QUATRO escritas do cliente:
  // insert em `entregas`, insert em `entrega_itens`, delete compensatório
  // quando os itens falhavam, e uma chamada best-effort a
  // `gerar_op_latex` / `gerar_op_latex_split` cujo fracasso virava um toast
  // pedindo ao operador para "gerar manualmente". Uma queda entre os passos
  // deixava entrega sem itens, ou entrega sem acabamento, sem ninguém dono
  // da reconciliação.
  //
  // A RULING TD3 é vinculante: a atomicidade entrega-para-acabamento é do
  // SERVIDOR e o frontend submete EXATAMENTE UM comando. Este helper agora
  // manda um único `registrar_entrega_cima_com_acabamento`, que cria
  // `entregas`, `entrega_itens` e a OP de acabamento na MESMA transação. O
  // JavaScript não insere entrega, não insere item, não faz delete
  // compensatório e não chama nenhum escritor de acabamento em separado.
  //
  // A rota MANTA não passa por aqui: ela tem seu PRÓPRIO comando, que vive
  // exclusivamente em js/screens/manta-writes.js. A escolha entre as duas
  // rotas é feita pelo chamador a partir da IDENTIDADE DO PRODUTO
  // (`modelos.tipo_produto`), nunca por inferência sobre o nome do modelo.
  // Este arquivo é do Tapete e não nomeia nenhum escritor da rota Manta.
  //
  // A chave de idempotência é de TOPO e por intenção de submissão: um
  // reenvio da MESMA submissão depois de uma falha ambígua reusa a chave, e
  // o servidor devolve o resultado já gravado em vez de duplicar a entrega.
  var rastreadorEntregaCima = criarRastreadorComando();

  // Interpretação EXATA do resultado autoritativo. As três leituras são
  // mutuamente exclusivas e nenhuma delas é inferida de outra.
  function interpretarResultadoEntregaCima(data) {
    if (!data || typeof data !== 'object') {
      return { estado: 'falha_validacao', codigo: null, entregaId: null, acabamento: null };
    }
    // 1. FALHA DE VALIDAÇÃO — nada foi registrado.
    if (data.entrega_registrada !== true) {
      return { estado: 'falha_validacao', codigo: data.codigo || null, entregaId: null, acabamento: null };
    }
    var acab = data.acabamento || null;
    // 2. ENTREGA E ACABAMENTO OK.
    if (acab && acab.ok === true) {
      return { estado: 'entrega_e_acabamento', codigo: null, entregaId: data.entrega_id || null, acabamento: acab };
    }
    // 3. ENTREGA GRAVADA, ACABAMENTO FALHOU — recuperação explícita depois.
    return {
      estado: 'entrega_sem_acabamento',
      codigo: (acab && acab.codigo) || null,
      entregaId: data.entrega_id || null,
      acabamento: acab,
      proximaAcao: data.proxima_acao || null,
    };
  }

  // Identidade AUTORITATIVA da OP de acabamento, ou null quando o servidor não
  // a devolveu. Devolver null (em vez de um rótulo genérico) deixa o chamador
  // escolher uma frase honesta para cada caso.
  function rotuloOpAcabamento(acabamento) {
    if (!acabamento) return null;
    var identidade = window.RAVATEX_OP_DISPLAY
      && window.RAVATEX_OP_DISPLAY.getCanonicalIdentity
      && window.RAVATEX_OP_DISPLAY.getCanonicalIdentity(acabamento);
    if (identidade) return identidade;
    if (acabamento.op_latex_id != null) return 'OP de acabamento #' + acabamento.op_latex_id;
    return null;
  }

  async function salvarEntregaCima({ fornecedorId, opId, payload }, options) {
    var splitOpts = options || {};
    var forceSplit = splitOpts.forceSplit === true;
    var splitMotivo = forceSplit && splitOpts.motivo != null ? String(splitOpts.motivo).trim() : '';
    var rastreador = splitOpts.rastreador || rastreadorEntregaCima;
    if (payload.linhas.length === 0) { window.toast('Adicione ao menos 1 item com metros entregues', 'error'); return false; }
    if (!payload.destino_fornecedor_id) { window.toast('Escolha a empresa de látex de destino', 'error'); return false; }
    if (forceSplit && !splitMotivo) { window.toast('Informe o motivo para criar uma OP de acabamento separada', 'error'); return false; }

    var linhas = payload.linhas.map(function (l) {
      return {
        op_item_id: l.op_item_id,
        metros_entregues: l.metros_entregues,
        defeito: l.defeito === true,
        observacao: l.observacao != null ? l.observacao : null,
      };
    });
    var chave = rastreador.resolverChave({
      comando: 'entrega_cima_v1',
      fornecedor_id: fornecedorId,
      op_id: opId,
      data: payload.data || null,
      observacao: payload.observacao || null,
      destino_fornecedor_id: payload.destino_fornecedor_id,
      motivo_split: splitMotivo || null,
      linhas: linhas,
    });

    var res = await window.supa.rpc('registrar_entrega_cima_com_acabamento', {
      p_fornecedor_id: fornecedorId,
      p_op_id: opId,
      p_data: payload.data,
      p_observacao: payload.observacao || null,
      p_destino_fornecedor_id: payload.destino_fornecedor_id,
      p_linhas: linhas,
      p_idempotency_key: chave,
      p_motivo_split: splitMotivo || null,
    });

    // Falha de TRANSPORTE: o servidor pode ter gravado. A tentativa NÃO é
    // concluída, então um reenvio da mesma submissão reusa esta chave.
    if (res.error) {
      window.toast('Não foi possível confirmar a entrega. Tente novamente — o reenvio é seguro.', 'error');
      console.error('entrega-writes: registrar_entrega_cima_com_acabamento', res.error);
      return false;
    }

    var r = interpretarResultadoEntregaCima(res.data);
    rastreador.concluir();

    if (r.estado === 'falha_validacao') {
      // NADA foi registrado. A cópia não pode sugerir sucesso parcial.
      window.toast('Entrega NÃO registrada: ' + (r.codigo || 'recusada pelo servidor') + '. Nenhum dado foi gravado.', 'error');
      console.error('entrega-writes: entrega recusada', res.data);
      return false;
    }

    if (r.estado === 'entrega_sem_acabamento') {
      // A entrega ESTÁ salva; só o acabamento falhou. Nenhuma retentativa
      // automática: a recuperação é ação explícita do operador, depois da
      // recarga autoritativa que torna o estado de falha provada alcançável.
      window.toast(
        'Entrega salva. A criação da OP de acabamento FALHOU (' + (r.codigo || 'falha') + ') — '
        + 'use "Recuperar OP de acabamento" nesta entrega.',
        'error');
      console.error('entrega-writes: acabamento falhou', res.data);
      return true;
    }

    // LINGUAGEM DE VÍNCULO, preservada do Contrato 6: o toast diz que a
    // entrega ficou VINCULADA à OP de acabamento, nunca que "gerou" uma — o
    // servidor cria OU reaproveita a OP conforme a identidade de replay. O que
    // o TD3 acrescenta é a identidade canônica, quando o servidor a devolve.
    var rotulo = rotuloOpAcabamento(r.acabamento);
    window.toast(rotulo
      ? 'Entrega registrada · vinculada à ' + rotulo
      : 'Entrega registrada · vinculada à OP de acabamento', 'success');
    return true;
  }

  // -------------------------------------------------------------------
  // RECUPERAÇÃO DE OP DE ACABAMENTO APÓS FALHA PROVADA (P2-B.3)
  //
  // Elegibilidade é do SERVIDOR: `pode_recuperar_op_acabamento` só devolve
  // true quando existe a entrega, NÃO existe OP de acabamento dela e existe
  // uma tentativa registrada com resultado 'falha'. Ausência, erro, dado
  // malformado ou false => NÃO elegível. Nunca se infere elegibilidade de um
  // resultado de entrega guardado no cliente.
  async function podeRecuperarOpAcabamento(entregaId) {
    if (entregaId == null) return { elegivel: false, error: null };
    var res = await window.supa.rpc('pode_recuperar_op_acabamento', { p_entrega_id: entregaId });
    if (res.error) {
      console.error('entrega-writes: pode_recuperar_op_acabamento', res.error);
      return { elegivel: false, error: res.error };
    }
    // Estritamente booleano: qualquer outra coisa é tratada como NÃO elegível.
    return { elegivel: res.data === true, error: null };
  }

  var rastreadorRecuperacao = criarRastreadorComando();

  // O ÚNICO escritor da recuperação. Sem criação livre de OP: o comando
  // carrega apenas a entrega de origem, a chave e um motivo — nenhum campo
  // de OP é aceito do formulário.
  async function recuperarOpAcabamento({ entregaId, motivo, rastreador }) {
    var tracker = rastreador || rastreadorRecuperacao;
    var chave = tracker.resolverChave({
      comando: 'op_acabamento_recuperacao',
      entrega_id: entregaId,
      motivo: motivo || null,
    });
    var res = await window.supa.rpc('gerar_op_acabamento', {
      p_entrega_id: entregaId,
      p_idempotency_key: chave,
      p_motivo: motivo || null,
    });
    if (res.error) {
      // Transporte ambíguo: retém a chave para um reenvio seguro.
      return { ok: false, ambiguo: true, codigo: null, error: res.error, acabamento: null };
    }
    tracker.concluir();
    var data = res.data || {};
    if (data.ok !== true) {
      return { ok: false, ambiguo: false, codigo: data.codigo || null, error: null, acabamento: null };
    }
    return { ok: true, ambiguo: false, codigo: null, error: null, acabamento: data, rotulo: rotuloOpAcabamento(data) };
  }

  // - atualizarEntregaCima: delete+insert não transacional. Se a
  //   reinserção dos itens falhar, a entrega fica sem itens.
  //   Decisão aceita por design (single-admin / baixo volume);
  //   correção manual via Supabase.
  async function atualizarEntregaCima({ entregaId, opId, payload }) {
    // D-B: se a entrega cima já gerou OP Latex, a edição livre criaria
    // divergência silenciosa (op_itens da OP Latex não é propagada).
    var pre = await entregaCimaTemOpLatex(entregaId);
    if (pre.bloqueada) {
      window.toast('Entrega vinculada à ' + (pre.opLabel || 'OP de acabamento') + '. Edição bloqueada — use retificação.', 'error');
      return false;
    }
    if (payload.linhas.length === 0) { window.toast('Adicione ao menos 1 item com metros entregues', 'error'); return false; }
    if (!payload.destino_fornecedor_id) { window.toast('Escolha a empresa de látex de destino', 'error'); return false; }
    const upd = await window.supa.from('entregas').update({
      data: payload.data, observacao: payload.observacao,
      destino_fornecedor_id: payload.destino_fornecedor_id,
    }).eq('id', entregaId);
    if (upd.error) {
      if (isEntregaLatexGuardError(upd.error)) {
        window.toast(GUARD_UPDATE_MSG, 'error');
        console.error('entrega-writes: trigger entrega_cima_latex_guard', upd.error);
        return false;
      }
      window.toast('Erro ao atualizar entrega', 'error'); console.error(upd.error); return false;
    }
    const delItens = await window.supa.from('entrega_itens').delete().eq('entrega_id', entregaId);
    if (delItens && delItens.error && isEntregaLatexGuardError(delItens.error)) {
      window.toast(GUARD_UPDATE_MSG, 'error');
      console.error('entrega-writes: trigger entrega_itens_cima_latex_guard', delItens.error);
      return false;
    }
    const itens = payload.linhas.map(l => ({ entrega_id: entregaId, op_id: opId, ...l }));
    const insItens = await window.supa.from('entrega_itens').insert(itens);
    // MVP: se a reinsercao falhar aqui, a entrega fica sem itens. Como o app eh
    // single-admin e baixo volume, aceitamos o risco e a correcao manual via Supabase.
    if (insItens.error) {
      if (isEntregaLatexGuardError(insItens.error)) {
        window.toast(GUARD_UPDATE_MSG, 'error');
        console.error('entrega-writes: trigger entrega_itens_cima_latex_guard', insItens.error);
        return false;
      }
      window.toast('Erro ao regravar itens da entrega', 'error'); console.error(insItens.error); return false;
    }
    window.toast('Entrega atualizada', 'success');
    return true;
  }

  // -------------------------------------------------------------------
  // Namespace principal
  // -------------------------------------------------------------------

  window.RAVATEX_ENTREGA_WRITES = window.RAVATEX_ENTREGA_WRITES || {};

  window.RAVATEX_ENTREGA_WRITES.excluirEntrega = excluirEntrega;
  window.RAVATEX_ENTREGA_WRITES.salvarEntregaLatex = salvarEntregaLatex;
  window.RAVATEX_ENTREGA_WRITES.atualizarEntregaLatex = atualizarEntregaLatex;
  window.RAVATEX_ENTREGA_WRITES.salvarEntregaCima = salvarEntregaCima;
  window.RAVATEX_ENTREGA_WRITES.atualizarEntregaCima = atualizarEntregaCima;
  // P2-B: dono canônico da idempotência de comando e da recuperação de
  // acabamento. entrega-form.js e as telas DELEGAM para cá — nenhuma delas
  // abre um caminho de escrita próprio.
  window.RAVATEX_ENTREGA_WRITES.criarRastreadorComando = criarRastreadorComando;
  window.RAVATEX_ENTREGA_WRITES.interpretarResultadoEntregaCima = interpretarResultadoEntregaCima;
  window.RAVATEX_ENTREGA_WRITES.podeRecuperarOpAcabamento = podeRecuperarOpAcabamento;
  window.RAVATEX_ENTREGA_WRITES.recuperarOpAcabamento = recuperarOpAcabamento;

  // Compatibilidade com o inline (call-sites bare preservados).
  window.excluirEntrega = excluirEntrega;
  window.salvarEntregaLatex = salvarEntregaLatex;
  window.atualizarEntregaLatex = atualizarEntregaLatex;
  window.salvarEntregaCima = salvarEntregaCima;
  window.atualizarEntregaCima = atualizarEntregaCima;
})(window);
